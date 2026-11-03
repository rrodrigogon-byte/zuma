import { db, save } from './db.js';
import { v4 as uuid } from 'uuid';
import { enviarMensagem } from './core/whatsapp.js';
import { carregarBaseConsolidada, consultarClientesRecuperacao } from './dino-recuperacao-avec.js';

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
      const canalTenant = {
        empresa_id: empresaId,
        loja_id: lojaId,
        whatsapp_instance: 'dino',
      };
      const resEnvio = await enviarMensagem(canalTenant, telTeste, textoTeste);
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

  // 4. Instância WhatsApp
  const canalTenant = {
    empresa_id: empresaId,
    loja_id: lojaId,
    whatsapp_instance: 'dino',
  };

  // 5. Registrar campanha no banco
  const campanhaId = uuid();
  const agoraIso = new Date().toISOString();

  const registroCampanha = {
    id: campanhaId,
    tipo: 'recuperacao_avec',
    empresa_id: empresaId,
    loja_id: lojaId,
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

  // 6. Processar envio assíncrono em segundo plano (background com rate limit)
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

        const envio = await enviarMensagem(canalTenant, c.telefoneLimpo, textoFinal);
        if (envio?.ok) {
          registroCampanha.enviados++;
        } else {
          registroCampanha.falhas++;
          console.warn(`[CRM Disparo] Aviso ao enviar para ${c.telefoneLimpo}:`, envio?.error);
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
