import { db, save } from './db.js';
import { v4 as uuid } from 'uuid';
import { enviarMensagem } from './core/whatsapp.js';
import { sendTextViaChatbotBackend } from './core/whatsapp-provider.js';
import { carregarBaseConsolidada, consultarClientesRecuperacao } from './dino-recuperacao-avec.js';
import {
  podeEnviarMensagemAtiva,
  registrarEnvioRealizado,
  gerarMensagemHumanizadaDino,
  calcularCadenciaHumanizada,
  verificarCooldownLote,
  obterConfiguracaoAntiban,
  normalizarTelefone,
} from './core/whatsapp-antiban.js';

const DINO_COMMERCE_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const DINO_COMMERCE_LOJA_ID = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
const DINO_CANAL_ID = 'ae741d39-039c-4f4b-9183-9c5f639405a0';

/**
 * Envia mensagem pelo canal oficial de WhatsApp da Dino.
 * Tenta pelo fluxo institucional do core com validação de escopo,
 * e possui fallback direto para o chatbot backend NestJS da Dino.
 */
export async function enviarMensagemDinoCRM(telefone, texto) {
  const telLimpo = normalizarTelefone(telefone);
  if (!telLimpo || telLimpo.length < 10) {
    return { ok: false, error: 'Número de telefone inválido para envio.' };
  }

  const canalTenant = {
    empresa_id: DINO_COMMERCE_EMPRESA_ID,
    loja_id: DINO_COMMERCE_LOJA_ID,
    canal_id: DINO_CANAL_ID,
    whatsapp_instance: 'dino',
    instance: 'dino',
  };

  // 1. Tentar via pipeline oficial enviarMensagem
  try {
    const res = await enviarMensagem(canalTenant, telLimpo, texto);
    if (res?.ok) {
      return { ok: true, data: res.data };
    }
    console.warn('[CRM Disparo] enviarMensagem core retornou erro:', res?.error);
  } catch (err) {
    console.warn('[CRM Disparo] Exceção em enviarMensagem core:', err.message);
  }

  // 2. Fallback direto via sendTextViaChatbotBackend para a instância Dino
  try {
    const resDirect = await sendTextViaChatbotBackend({
      instance: 'dino',
      number: telLimpo,
      text: texto,
      simulateTyping: true,
    });
    if (resDirect?.ok) {
      return { ok: true, data: resDirect.data };
    }
    console.warn('[CRM Disparo] sendTextViaChatbotBackend retornou erro:', resDirect?.error);
    return {
      ok: false,
      error: resDirect?.error || 'Provedor WhatsApp não confirmou o envio.',
      status: resDirect?.status,
    };
  } catch (errDirect) {
    console.error('[CRM Disparo] Exceção em sendTextViaChatbotBackend:', errDirect.message);
    return {
      ok: false,
      error: `Falha de conexão com backend WhatsApp: ${errDirect.message}`,
    };
  }
}

export async function dispararCampanhaCRM({
  empresaId = 'dino',
  lojaId = 'dino-matriz',
  filtros = null,
  mensagem = '',
  clientesIds = [],
  clientes = [],
  usarMensagemPersonalizadaPorModelo = false,
  testeApenas = false,
  testeTelefone = '',
  escopo = 'filtrados',
  ignorarJanelaHorario = false,
}) {
  // 1. Modo de teste (envio único imediato para conferência do gestor)
  if (testeApenas) {
    const telTeste = normalizarTelefone(testeTelefone);
    if (!telTeste || telTeste.length < 10) {
      return { ok: false, error: 'Informe um número de WhatsApp válido com DDD para o teste.' };
    }

    const textoTeste = gerarMensagemHumanizadaDino({
      template: mensagem || undefined,
      cliente: { nome: 'Cliente Teste (Rodrigo)', ultimaVisita: '2026-08-15', diasSemVir: 78 },
      profissional: 'Dino',
      modelo: 'essencial',
      link: `https://kytto.com.br/barbeiro/dino?t=${telTeste}`,
      incluirOptOut: true,
    });

    try {
      const resEnvio = await enviarMensagemDinoCRM(telTeste, textoTeste);
      if (!resEnvio?.ok) {
        return {
          ok: false,
          destinatario: telTeste,
          error: resEnvio?.error || 'Provedor recusou o envio do WhatsApp. Verifique se o canal está conectado.',
          resultadoProvedor: resEnvio,
        };
      }
      return {
        ok: true,
        teste: true,
        destinatario: telTeste,
        mensagem: textoTeste,
        resultadoProvedor: resEnvio,
      };
    } catch (err) {
      return {
        ok: false,
        error: `Falha ao enviar mensagem de teste: ${err.message}`,
      };
    }
  }

  // 2. Coletar clientes alvo
  let alvos = [];

  // 2.1 Se uma lista explícita de clientes com dados completos já veio
  if (Array.isArray(clientes) && clientes.length > 0) {
    alvos = clientes;
  }
  // 2.2 Se vieram filtros de coorte da recuperação Avec (ex: Cenário de Reajuste)
  else if (filtros && typeof filtros === 'object') {
    const base = await carregarBaseConsolidada();
    const consulta = consultarClientesRecuperacao(base, { ...filtros, limite: 50000 });
    alvos = consulta.itens || [];
  }
  // 2.3 Se vieram IDs ou chaves (ex: ['tel:96268383', ...])
  else if (Array.isArray(clientesIds) && clientesIds.length > 0) {
    const base = await carregarBaseConsolidada();
    const setIds = new Set(clientesIds.map(String));
    alvos = base.filter((c) => setIds.has(String(c.key)) || setIds.has(String(c.id)) || setIds.has(String(c.telefone)));

    // Fallback para db().clientes se não achou na base Avec
    if (alvos.length === 0 && db().clientes) {
      alvos = (db().clientes || []).filter((c) => setIds.has(String(c.id)));
    }
  }
  // 2.4 Fallback padrão para clientes da empresa
  else {
    const base = await carregarBaseConsolidada();
    alvos = base;
  }

  // 3. Filtrar clientes válidos
  const clientesValidos = alvos
    .map((c) => {
      const tel = normalizarTelefone(c.telefone || c.telefoneFormatado || '');
      return { ...c, telefoneLimpo: tel };
    })
    .filter((c) => c.telefoneLimpo.length >= 10);

  if (clientesValidos.length === 0) {
    return { ok: false, error: 'Nenhum cliente com telefone válido encontrado para este disparo.' };
  }

  // 4. Checar configuração de antiban da barbearia
  const configAntiban = obterConfiguracaoAntiban(empresaId);

  // 5. Registrar campanha no banco com métricas de proteção antiban
  const campanhaId = uuid();
  const agoraIso = new Date().toISOString();

  const registroCampanha = {
    id: campanhaId,
    tipo: 'recuperacao_avec',
    empresa_id: DINO_COMMERCE_EMPRESA_ID,
    loja_id: DINO_COMMERCE_LOJA_ID,
    criado_em: agoraIso,
    mensagem: usarMensagemPersonalizadaPorModelo ? '[Mensagem Humanizada por Perfil/Modelo com Spintax]' : mensagem,
    usarMensagemPersonalizadaPorModelo: Boolean(usarMensagemPersonalizadaPorModelo),
    status: 'processando',
    alvos: clientesValidos.length,
    enviados: 0,
    falhas: 0,
    puladosOptOut: 0,
    pausadaPorLimiteDiario: false,
    indiceProcessado: 0,
    protecaoAntiban: {
      estagio: configAntiban.estagio,
      limiteDiario: configAntiban.limiteDiario,
      restantesHojeNoInicio: configAntiban.restantesHoje,
      intervaloMinSec: configAntiban.estagioDados.intervaloMinSec,
      intervaloMaxSec: configAntiban.estagioDados.intervaloMaxSec,
    },
    amostraAlvos: clientesValidos.slice(0, 5).map((c) => ({
      nome: c.nome,
      telefone: c.telefoneLimpo,
      modelo: c.modeloRecomendado || 'essencial',
    })),
  };

  if (!db().campanhas) db().campanhas = [];
  db().campanhas.push(registroCampanha);
  try {
    save();
  } catch (e) {
    console.warn('[CRM Disparo] Erro ao salvar campanha em db.json:', e.message);
  }

  // 6. Processar envio em segundo plano com motor Antiban (Jitter + Cooldown + Cota Diária)
  setTimeout(async () => {
    console.log(`[CRM Disparo Antiban] Iniciando envio seguro da campanha ${campanhaId} (${clientesValidos.length} alvos, cota hoje: ${configAntiban.restantesHoje})...`);

    let enviosNestaSessao = 0;

    for (let i = 0; i < clientesValidos.length; i++) {
      registroCampanha.indiceProcessado = i;
      const c = clientesValidos[i];

      // 6.1 Validação Antiban para o destinatário
      const validacaoEnvio = podeEnviarMensagemAtiva(empresaId, c.telefoneLimpo, { ignorarJanelaHorario });
      if (!validacaoEnvio.ok) {
        if (validacaoEnvio.limiteAtingido) {
          console.warn(`[CRM Disparo Antiban] Cota diária do chip atingida. Pausando campanha ${campanhaId} para amanhã para proteger contra banimento.`);
          registroCampanha.status = 'pausada_limite_diario';
          registroCampanha.motivoPausa = validacaoEnvio.motivo;
          try { save(); } catch {}
          break;
        }

        // Se bloqueado por opt-out ou horário
        registroCampanha.puladosOptOut++;
        console.log(`[CRM Disparo Antiban] Cliente ${c.nome} (${c.telefoneLimpo}) pulado: ${validacaoEnvio.motivo}`);
        continue;
      }

      // 6.2 Geração de mensagem humanizada com variação de Spintax
      try {
        const templateEscolhido = usarMensagemPersonalizadaPorModelo && c.mensagemWhatsapp
          ? c.mensagemWhatsapp
          : mensagem;

        const textoFinal = gerarMensagemHumanizadaDino({
          template: templateEscolhido || undefined,
          cliente: c,
          profissional: c.profissionalPreferido,
          modelo: c.modeloRecomendado,
          link: `https://kytto.com.br/barbeiro/dino?t=${c.telefoneLimpo}`,
          incluirOptOut: true,
        });

        // 6.3 Disparo via WhatsApp
        const envio = await enviarMensagemDinoCRM(c.telefoneLimpo, textoFinal);
        if (envio?.ok) {
          registroCampanha.enviados++;
          enviosNestaSessao++;
          registrarEnvioRealizado(empresaId, c.telefoneLimpo);
        } else {
          registroCampanha.falhas++;
          console.warn(`[CRM Disparo] Falha no envio para ${c.telefoneLimpo}:`, envio?.error);
        }
      } catch (err) {
        registroCampanha.falhas++;
        console.warn(`[CRM Disparo] Falha no cliente ${c.nome} (${c.telefoneLimpo}):`, err.message);
      }

      try { save(); } catch {}

      // 6.4 Se ainda há clientes na fila, aplicar Cadência Humanizada Antiban
      if (i < clientesValidos.length - 1) {
        // Pausa de respiro (cooldown) a cada lote (ex: a cada 10 envios descansa 2 a 4 minutos)
        const cooldown = verificarCooldownLote(enviosNestaSessao, {
          aCada: configAntiban.estagioDados.cooldownACada,
          pausaMinSec: configAntiban.estagioDados.cooldownPausaSec,
          pausaMaxSec: configAntiban.estagioDados.cooldownPausaSec + 60,
        });

        if (cooldown.necessario) {
          console.log(`[CRM Disparo Antiban] Cooldown de proteção ativado (${cooldown.pausaSegundos}s) para respiro do chip após ${enviosNestaSessao} envios.`);
          await new Promise((r) => setTimeout(r, cooldown.pausaMs));
        } else {
          // Cadência padrão com Jitter aleatório (ex: entre 18s e 40s)
          const delayHumanizado = calcularCadenciaHumanizada({
            minSec: configAntiban.estagioDados.intervaloMinSec,
            maxSec: configAntiban.estagioDados.intervaloMaxSec,
          });
          console.log(`[CRM Disparo Antiban] Aguardando intervalo humanizado de ${Math.round(delayHumanizado / 1000)}s antes do próximo envio...`);
          await new Promise((r) => setTimeout(r, delayHumanizado));
        }
      }
    }

    if (registroCampanha.status !== 'pausada_limite_diario') {
      registroCampanha.status = 'concluida';
    }
    registroCampanha.finalizado_em = new Date().toISOString();
    try {
      save();
    } catch {}
    console.log(`[CRM Disparo Antiban] Campanha ${campanhaId} finalizada. Status: ${registroCampanha.status}. Enviados: ${registroCampanha.enviados}, Falhas: ${registroCampanha.falhas}, Pulados Opt-Out: ${registroCampanha.puladosOptOut}`);
  }, 1000);

  return {
    ok: true,
    campanha: {
      id: campanhaId,
      status: 'processando',
      alvos: clientesValidos.length,
      cotaHoje: configAntiban.restantesHoje,
      estagioChip: configAntiban.estagioDados.nome,
      intervaloSeguro: `${configAntiban.estagioDados.intervaloMinSec}s a ${configAntiban.estagioDados.intervaloMaxSec}s`,
      mensagem: registroCampanha.mensagem,
      criado_em: agoraIso,
    },
  };
}
