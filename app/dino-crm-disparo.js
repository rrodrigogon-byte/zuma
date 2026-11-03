import { db, save } from './db.js';
import { v4 as uuid } from 'uuid';
import { enviarMensagem } from './core/whatsapp.js';
import { sendTextViaChatbotBackend } from './core/whatsapp-provider.js';
import { carregarBaseConsolidada, consultarClientesRecuperacao } from './dino-recuperacao-avec.js';

const DINO_COMMERCE_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const DINO_COMMERCE_LOJA_ID = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
const DINO_CANAL_ID = 'ae741d39-039c-4f4b-9183-9c5f639405a0';

/**
 * Envia mensagem pelo canal oficial de WhatsApp da Dino.
 * Tenta pelo fluxo institucional do core com validação de escopo,
 * e possui fallback direto para o chatbot backend NestJS da Dino.
 */
export async function enviarMensagemDinoCRM(telefone, texto) {
  const telLimpo = String(telefone || '').replace(/\D/g, '');
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
}) {
  // 1. Modo de teste (envio único para conferência)
  if (testeApenas) {
    const telTeste = String(testeTelefone || '').replace(/\D/g, '');
    if (!telTeste || telTeste.length < 10) {
      return { ok: false, error: 'Informe um número de WhatsApp válido com DDD para o teste.' };
    }

    let textoTeste = mensagem || 'Olá! Esta é uma mensagem de teste da Campanha de Recuperação da Barbearia Dino.';
    textoTeste = textoTeste
      .replace(/\{Nome do Cliente\}|\{Nome\}/g, 'Cliente Teste')
      .replace(/\{Profissional\}/g, 'Equipe Dino')
      .replace(/\{Link Agendamento\}/g, `https://kytto.com.br/barbeiro/dino?t=${telTeste}`)
      .replace(/\{Ultima Visita\}/g, '15/08/2026')
      .replace(/\{Dias Sem Vir\}/g, '78');

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

  // 3. Filtrar apenas clientes com telefone válido
  const clientesValidos = alvos
    .map((c) => {
      const tel = String(c.telefone || '').replace(/\D/g, '');
      return { ...c, telefoneLimpo: tel };
    })
    .filter((c) => c.telefoneLimpo.length >= 10);

  if (clientesValidos.length === 0) {
    return { ok: false, error: 'Nenhum cliente com telefone válido encontrado para este disparo.' };
  }

  // 4. Registrar campanha no banco
  const campanhaId = uuid();
  const agoraIso = new Date().toISOString();

  const registroCampanha = {
    id: campanhaId,
    tipo: 'recuperacao_avec',
    empresa_id: DINO_COMMERCE_EMPRESA_ID,
    loja_id: DINO_COMMERCE_LOJA_ID,
    criado_em: agoraIso,
    mensagem: usarMensagemPersonalizadaPorModelo ? '[Mensagem Personalizada por Perfil/Modelo]' : mensagem,
    usarMensagemPersonalizadaPorModelo: Boolean(usarMensagemPersonalizadaPorModelo),
    status: 'processando',
    alvos: clientesValidos.length,
    enviados: 0,
    falhas: 0,
    amostraAlvos: clientesValidos.slice(0, 5).map((c) => ({
      nome: c.nome,
      telefone: c.telefoneFormatado || c.telefone,
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

  // 5. Processar envio assíncrono em segundo plano (background com rate limit)
  setTimeout(async () => {
    console.log(`[CRM Disparo] Iniciando envio da campanha ${campanhaId} para ${clientesValidos.length} clientes...`);

    for (let i = 0; i < clientesValidos.length; i++) {
      const c = clientesValidos[i];
      try {
        let textoFinal = '';

        if (usarMensagemPersonalizadaPorModelo && c.mensagemWhatsapp) {
          textoFinal = c.mensagemWhatsapp;
        } else {
          const primeiroNome = (c.nome || 'Cliente').trim().split(' ')[0];
          const profNome = c.profissionalPreferido && c.profissionalPreferido !== 'Não informado'
            ? c.profissionalPreferido.trim().split(' ')[0]
            : 'nossa equipe';

          textoFinal = (mensagem || 'Olá {Nome do Cliente}! Sentimos sua falta aqui na Barbearia Dino.')
            .replace(/\{Nome do Cliente\}|\{Nome\}/g, primeiroNome)
            .replace(/\{Nome Completo\}/g, c.nome || 'Cliente')
            .replace(/\{Profissional\}/g, profNome)
            .replace(/\{Ultima Visita\}/g, c.ultimaVisita ? new Date(c.ultimaVisita).toLocaleDateString('pt-BR') : 'recente')
            .replace(/\{Dias Sem Vir\}/g, String(c.diasSemVir || ''))
            .replace(/\{Link Agendamento\}/g, `https://kytto.com.br/barbeiro/dino?t=${c.telefoneLimpo}`);
        }

        const envio = await enviarMensagemDinoCRM(c.telefoneLimpo, textoFinal);
        if (envio?.ok) {
          registroCampanha.enviados++;
        } else {
          registroCampanha.falhas++;
          console.warn(`[CRM Disparo] Falha no envio para ${c.telefoneLimpo}:`, envio?.error);
        }
      } catch (err) {
        registroCampanha.falhas++;
        console.warn(`[CRM Disparo] Falha no cliente ${c.nome} (${c.telefoneLimpo}):`, err.message);
      }

      // Intervalo de segurança entre disparos para respeitar limites do WhatsApp (1.8 segundos)
      await new Promise((r) => setTimeout(r, 1800));
    }

    registroCampanha.status = 'concluida';
    registroCampanha.finalizado_em = new Date().toISOString();
    try {
      save();
    } catch {}
    console.log(`[CRM Disparo] Campanha ${campanhaId} concluída. Enviados: ${registroCampanha.enviados}, Falhas: ${registroCampanha.falhas}`);
  }, 1000);

  return {
    ok: true,
    campanha: {
      id: campanhaId,
      status: 'processando',
      alvos: clientesValidos.length,
      mensagem: registroCampanha.mensagem,
      criado_em: agoraIso,
    },
  };
}
