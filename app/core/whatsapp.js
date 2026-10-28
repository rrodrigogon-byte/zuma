/**
 * Core: WhatsApp Notifications
 * SetPoint Ultra — Integração com Evolution API (self-hosted)
 * Suporte a: Oficina, Barbearia, Crediário, Agendamentos, Cobranças, Alertas
 */
import fetch from 'node-fetch';
import { chatbotBackendConfig, chatbotBackendMode, instanceRegistry, isRegisteredInstance, sendStickerViaChatbotBackend, sendTextViaChatbotBackend, whatsappProviderName } from './whatsapp-provider.js';
import { db } from './database.js';
import { authorizeWhatsappEgress, evaluateWhatsappEgress } from './whatsapp-egress.js';
import { sendWahaText, validWahaGroupId, validWahaSession } from './whatsapp-waha.js';

// ─── Configuração ─────────────────────────────────────────────────────────────
function getConfig(tenant) {
  return {
    baseUrl: tenant?.whatsapp_api_url || process.env.EVOLUTION_API_URL || process.env.CHATBOT_BACKEND_URL || 'http://localhost:8080',
    apiKey: tenant?.whatsapp_api_key || process.env.EVOLUTION_API_KEY || process.env.CHATBOT_BACKEND_KEY || '',
    instance: tenant?.whatsapp_instance || process.env.EVOLUTION_INSTANCE || 'setpoint',
    payloadVersion: String(process.env.EVOLUTION_SEND_PAYLOAD_VERSION || 'current').trim().toLowerCase(),
  };
}

function formatarTelefone(tel) {
  // Remove tudo que não é dígito
  const digits = tel.replace(/\D/g, '');
  // Adiciona DDI 55 se não tiver
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

export async function enviarAudio(tenant, telefone, base64Audio) {
  const numero = formatarTelefone(String(telefone || ''));
  if (whatsappProviderName() === 'chatbot_backend') {
     // Evolution Backend (not natively supported by standard wrapper without extension)
     // Evolution API uses /message/sendWhatsAppAudio
     const cfg = getConfig(tenant);
     const body = {
       number: numero,
       audio: base64Audio,
       delay: 1200
     };
     const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/message/sendWhatsAppAudio/${encodeURIComponent(cfg.instance)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.apiKey,
      },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status };
  } else {
    // Evolution standard
    const cfg = getConfig(tenant);
    const body = { number: numero, audio: base64Audio, delay: 1200 };
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/message/sendWhatsAppAudio/${encodeURIComponent(cfg.instance)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.apiKey,
      },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status };
  }
}

export async function enviarMensagem(tenant, telefone, mensagem) {
  if (tenant?.transport === 'waha') {
    const session = validWahaSession(tenant?.waha_session || tenant?.whatsapp_instance);
    const groupId = validWahaGroupId(tenant?.waha_group_id || telefone);
    const text = String(mensagem || '').slice(0, 4000);
    if (!session || !groupId || !text) return { ok: false, retryable: false, uncertain: false, error: 'WAHA_GROUP_DESTINATION_REQUIRED' };
    try {
      const data = await sendWahaText(session, groupId, text);
      return { ok: true, status: 202, retryable: false, uncertain: false, data };
    } catch (error) {
      const status = Number(error?.status || 0) || null;
      return { ok: false, status, retryable: status === 429, uncertain: !status || status >= 500, error: String(error?.message || 'WAHA_SEND_FAILED').slice(0, 200) };
    }
  }
  const numero = formatarTelefone(String(telefone || ''));
  const text = String(mensagem || '').slice(0, 4000);
  // Mesmo backend do NossaGente: todas as saídas (IA, campanhas, carrinho,
  // lembretes de agenda) passam por aqui e seguem pela instância da empresa.
  if (whatsappProviderName() === 'chatbot_backend') {
    const instance = tenant?.whatsapp_instance || tenant?.instance || undefined;
    if (chatbotBackendMode() === 'instancias') {
      const context = {
        empresaId: tenant?.empresa_id, lojaId: tenant?.loja_id, canalId: tenant?.canal_id,
        instance, number: numero,
      };
      const preliminary = evaluateWhatsappEgress(context);
      if (!preliminary.ok) return { ok: false, retryable: false, uncertain: false, error: `WHATSAPP_EGRESS_${preliminary.reason.toUpperCase()}` };
      let attempted = false;
      try {
        return await db.transaction(async trx => {
          // FOR SHARE mantém ownership até concluir a única tentativa HTTP. O índice
          // único parcial impede outro canal ativo de reivindicar esta instância.
          const decision = await authorizeWhatsappEgress(context, { database: { queryRead: trx.query }, lock: true });
          if (!decision.ok) return { ok: false, retryable: false, uncertain: false, error: `WHATSAPP_EGRESS_${decision.reason.toUpperCase()}` };
          attempted = true;
          return sendTextViaChatbotBackend({ instance, number: numero, text });
        });
      } catch {
        return { ok: false, retryable: false, uncertain: attempted, error: attempted ? 'WHATSAPP_SEND_COMMIT_UNCERTAIN' : 'WHATSAPP_EGRESS_CHANNEL_LOOKUP_FAILED' };
      }
    } else if (process.env.CHATBOT_BACKEND_EMPRESA_ID) {
      return { ok: false, retryable: false, uncertain: false, error: 'WHATSAPP_OWNER_REQUIRES_INSTANCE_MODE' };
    }
    return sendTextViaChatbotBackend({ instance, number: numero, text });
  }
  // Um backend Dino configurado não pode silenciosamente cair na conta global Evolution.
  if (process.env.CHATBOT_BACKEND_URL && (!process.env.WHATSAPP_PROVIDER
    || !tenant?.empresa_id || tenant.empresa_id === process.env.CHATBOT_BACKEND_EMPRESA_ID
    || [...instanceRegistry().values()].includes(String(tenant.empresa_id).toLowerCase())
    || tenant?.whatsapp_instance === chatbotBackendConfig().instance
    || isRegisteredInstance(tenant?.whatsapp_instance))) {
    return { ok: false, retryable: false, uncertain: false, error: 'WHATSAPP_PROVIDER_SCOPE' };
  }
  // Um job de empresa nunca herda URL, chave ou instância Evolution globais.
  // O legado da plataforma sem escopo conserva seu contrato separado.
  if ((tenant?.empresa_id || tenant?.loja_id || tenant?.canal_id)
    && !(tenant?.whatsapp_api_url && tenant?.whatsapp_api_key && tenant?.whatsapp_instance)) {
    return { ok: false, retryable: false, uncertain: false, error: 'WHATSAPP_EVOLUTION_TENANT_CONFIG_REQUIRED' };
  }
  const cfg = getConfig(tenant);
  const body = cfg.payloadVersion === 'legacy'
    ? { number: numero, options: { delay: 1200, presence: 'composing' }, textMessage: { text } }
    : { number: numero, text, delay: 1200 };

  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(cfg.instance)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await res.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 300) }; }
    const uncertain = !res.ok && (res.status === 408 || res.status >= 500);
    return {
      ok: res.ok,
      status: res.status,
      retryable: !res.ok && !uncertain && (res.status === 425 || res.status === 429),
      uncertain,
      data,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      retryable: false,
      uncertain: true,
      error: String(err?.name || 'NETWORK_ERROR').slice(0, 80),
    };
  }
}

/**
 * Figurinha do atendimento. Passa pela MESMA trava de saída do texto (empresa, canal,
 * instância, modo piloto/on). Evolution: /message/sendSticker; backend NossaGente:
 * rota configurável (CHATBOT_BACKEND_STICKER_PATH).
 */
export async function enviarFigurinha(tenant, telefone, figurinha = {}) {
  const numero = formatarTelefone(String(telefone || ''));
  const { url = '', base64 = '', mimetype = 'image/webp' } = figurinha;
  if (whatsappProviderName() === 'chatbot_backend') {
    const instance = tenant?.whatsapp_instance || tenant?.instance || undefined;
    if (chatbotBackendMode() !== 'instancias') return sendStickerViaChatbotBackend({ instance, number: numero, url, base64, mimetype });
    const context = { empresaId: tenant?.empresa_id, lojaId: tenant?.loja_id, canalId: tenant?.canal_id, instance, number: numero };
    const preliminary = evaluateWhatsappEgress(context);
    if (!preliminary.ok) return { ok: false, retryable: false, uncertain: false, error: `WHATSAPP_EGRESS_${preliminary.reason.toUpperCase()}` };
    try {
      return await db.transaction(async trx => {
        const decision = await authorizeWhatsappEgress(context, { database: { queryRead: trx.query }, lock: true });
        if (!decision.ok) return { ok: false, retryable: false, uncertain: false, error: `WHATSAPP_EGRESS_${decision.reason.toUpperCase()}` };
        return sendStickerViaChatbotBackend({ instance, number: numero, url, base64, mimetype });
      });
    } catch {
      return { ok: false, retryable: false, uncertain: true, error: 'WHATSAPP_STICKER_UNCERTAIN' };
    }
  }
  if (!(tenant?.whatsapp_api_url && tenant?.whatsapp_api_key && tenant?.whatsapp_instance) || !url) {
    return { ok: false, retryable: false, uncertain: false, error: 'WHATSAPP_STICKER_UNSUPPORTED' };
  }
  const cfg = getConfig(tenant);
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/message/sendSticker/${encodeURIComponent(cfg.instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
      body: JSON.stringify({ number: numero, sticker: url, delay: 800 }),
      signal: AbortSignal.timeout(20000),
    });
    return { ok: res.ok, status: res.status, retryable: false, uncertain: res.status >= 500 };
  } catch (err) {
    return { ok: false, status: null, retryable: false, uncertain: true, error: String(err?.name || 'NETWORK_ERROR').slice(0, 80) };
  }
}

// ─── Templates por módulo ─────────────────────────────────────────────────────

// ── Oficina Mecânica ──────────────────────────────────────────────────────────

export async function notificarOrcamentoOficina(tenant, dados) {
  const { cliente_nome, cliente_telefone, os_numero, veiculo, valor_total, link_aprovacao } = dados;

  const msg = `🔧 *Oficina ${tenant?.nome || 'SetPoint'}*

Olá, *${cliente_nome}*! 👋

Seu orçamento está pronto:

🚗 *Veículo:* ${veiculo}
📋 *OS Nº:* ${os_numero}
💰 *Valor total:* R$ ${parseFloat(valor_total).toFixed(2).replace('.', ',')}

Para *aprovar ou recusar* o orçamento, clique no link abaixo:
👉 ${link_aprovacao}

Aguardamos sua resposta! 😊`;

  return enviarMensagem(tenant, cliente_telefone, msg);
}

export async function notificarVeiculoPronto(tenant, dados) {
  const { cliente_nome, cliente_telefone, os_numero, veiculo, valor_final } = dados;

  const msg = `✅ *Oficina ${tenant?.nome || 'SetPoint'}*

Olá, *${cliente_nome}*! 🎉

Seu veículo está *pronto para retirada*!

🚗 *Veículo:* ${veiculo}
📋 *OS Nº:* ${os_numero}
💰 *Valor a pagar:* R$ ${parseFloat(valor_final).toFixed(2).replace('.', ',')}

Nosso horário de atendimento: Seg–Sex 8h–18h | Sáb 8h–12h

Até logo! 🔧`;

  return enviarMensagem(tenant, cliente_telefone, msg);
}

// ── Barbearia / Agendamentos ──────────────────────────────────────────────────

export async function notificarConfirmacaoAgendamento(tenant, dados) {
  const { cliente_nome, cliente_telefone, servico, profissional, data, horario, codigo } = dados;

  const dataFmt = new Date(data + 'T12:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });

  const msg = `✂️ *${tenant?.nome || 'Barbearia SetPoint'}*

Olá, *${cliente_nome}*! 👋

Seu agendamento foi *confirmado*! ✅

📋 *Serviço:* ${servico}
👤 *Profissional:* ${profissional}
📅 *Data:* ${dataFmt}
⏰ *Horário:* ${horario}
🔑 *Código:* ${codigo}

Para cancelar ou remarcar, responda esta mensagem.

Até lá! ✂️`;

  return enviarMensagem(tenant, cliente_telefone, msg);
}

export async function notificarLembreteAgendamento(tenant, dados) {
  const { cliente_nome, cliente_telefone, servico, data, horario } = dados;

  const msg = `⏰ *Lembrete — ${tenant?.nome || 'Barbearia SetPoint'}*

Olá, *${cliente_nome}*!

Lembrando que você tem um agendamento *amanhã*:

✂️ *Serviço:* ${servico}
📅 *Data:* ${data}
⏰ *Horário:* ${horario}

Até amanhã! 😊`;

  return enviarMensagem(tenant, cliente_telefone, msg);
}

// ── Crediário — Régua de cobrança ─────────────────────────────────────────────

export async function notificarParcelaVencendo(tenant, dados) {
  const { cliente_nome, cliente_telefone, numero_parcela, valor, data_vencimento } = dados;

  const dataFmt = new Date(data_vencimento + 'T12:00').toLocaleDateString('pt-BR');

  const msg = `💳 *${tenant?.nome || 'SetPoint'}*

Olá, *${cliente_nome}*!

Sua parcela *${numero_parcela}* vence em *2 dias*:

💰 *Valor:* R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}
📅 *Vencimento:* ${dataFmt}

Evite juros e multa! Para pagar via PIX ou combinar, responda esta mensagem.

Obrigado! 🙏`;

  return enviarMensagem(tenant, cliente_telefone, msg);
}

export async function notificarParcelaVencida(tenant, dados) {
  const { cliente_nome, cliente_telefone, numero_parcela, valor, dias_atraso, valor_com_juros } = dados;

  const msg = `⚠️ *${tenant?.nome || 'SetPoint'} — Cobrança*

Olá, *${cliente_nome}*,

Identificamos que sua parcela *${numero_parcela}* está em atraso há *${dias_atraso} dia(s)*.

💰 *Valor original:* R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}
💸 *Com multa e juros:* R$ ${parseFloat(valor_com_juros).toFixed(2).replace('.', ',')}

Por favor, entre em contato para regularizar sua situação e evitar restrições.

📞 Responda esta mensagem para falar conosco.`;

  return enviarMensagem(tenant, cliente_telefone, msg);
}

// ── Varejo — Pedidos e Entregas ───────────────────────────────────────────────

export async function notificarPedidoConfirmado(tenant, dados) {
  const { cliente_nome, cliente_telefone, pedido_numero, valor_total, previsao_entrega } = dados;

  const msg = `📦 *${tenant?.nome || 'SetPoint'}*

Olá, *${cliente_nome}*! 🎉

Seu pedido foi *confirmado*!

🛒 *Pedido Nº:* ${pedido_numero}
💰 *Valor total:* R$ ${parseFloat(valor_total).toFixed(2).replace('.', ',')}
🚚 *Previsão de entrega:* ${previsao_entrega || 'A combinar'}

Acompanhe o status do seu pedido ou fale conosco respondendo esta mensagem.

Obrigado pela preferência! 😊`;

  return enviarMensagem(tenant, cliente_telefone, msg);
}

export async function notificarSaidaEntrega(tenant, dados) {
  const { cliente_nome, cliente_telefone, pedido_numero, entregador } = dados;

  const msg = `🚚 *${tenant?.nome || 'SetPoint'} — Entrega saindo!*

Olá, *${cliente_nome}*!

Seu pedido *Nº ${pedido_numero}* saiu para entrega agora! 📦

🏍️ *Entregador:* ${entregador || 'A caminho'}

Fique atento! Em caso de dúvidas, responda esta mensagem.`;

  return enviarMensagem(tenant, cliente_telefone, msg);
}

// ── Alertas internos (para o dono/gestor) ────────────────────────────────────

export async function alertarEstoqueBaixo(tenant, dados) {
  const { gestor_telefone, produto_nome, estoque_atual, estoque_minimo } = dados;

  const msg = `⚠️ *Alerta de Estoque — ${tenant?.nome || 'SetPoint'}*

Produto com estoque abaixo do mínimo:

📦 *Produto:* ${produto_nome}
📉 *Estoque atual:* ${estoque_atual}
⚠️ *Estoque mínimo:* ${estoque_minimo}

Acesse o sistema para realizar uma nova compra.`;

  return enviarMensagem(tenant, gestor_telefone, msg);
}

export async function alertarLoteVencendo(tenant, dados) {
  const { gestor_telefone, produto_nome, lote, data_validade, quantidade, dias } = dados;

  const msg = `🗓️ *Alerta de Validade — ${tenant?.nome || 'SetPoint'}*

Lote vencendo em *${dias} dias*:

📦 *Produto:* ${produto_nome}
🏷️ *Lote:* ${lote}
📅 *Validade:* ${new Date(data_validade + 'T12:00').toLocaleDateString('pt-BR')}
📊 *Quantidade:* ${quantidade}

Providencie a venda ou descarte conforme a legislação.`;

  return enviarMensagem(tenant, gestor_telefone, msg);
}

export async function alertarCaixaFechado(tenant, dados) {
  const { gestor_telefone, operador, total_vendas, total_dinheiro, diferenca } = dados;

  const msg = `💰 *Fechamento de Caixa — ${tenant?.nome || 'SetPoint'}*

Caixa fechado por *${operador}*

📊 *Total de vendas:* R$ ${parseFloat(total_vendas).toFixed(2).replace('.', ',')}
💵 *Dinheiro em caixa:* R$ ${parseFloat(total_dinheiro).toFixed(2).replace('.', ',')}
${diferenca !== 0 ? `⚠️ *Diferença:* R$ ${parseFloat(diferenca).toFixed(2).replace('.', ',')}` : '✅ *Caixa conferido!*'}`;

  return enviarMensagem(tenant, gestor_telefone, msg);
}

// ── Envio em lote (régua de cobrança) ────────────────────────────────────────

export async function enviarReguaCobranca(tenant, parcelas) {
  const resultados = [];
  for (const parcela of parcelas) {
    const hoje = new Date();
    const venc = new Date(parcela.data_vencimento + 'T12:00');
    const diff = Math.floor((venc - hoje) / (1000 * 60 * 60 * 24));

    let resultado;
    if (diff === 2) {
      resultado = await notificarParcelaVencendo(tenant, parcela);
    } else if (diff < 0) {
      const diasAtraso = Math.abs(diff);
      const valorComJuros = parseFloat(parcela.valor) * (1 + 0.02 + 0.001 * diasAtraso);
      resultado = await notificarParcelaVencida(tenant, { ...parcela, dias_atraso: diasAtraso, valor_com_juros: valorComJuros });
    }

    if (resultado) {
      resultados.push({ parcela_id: parcela.id, ...resultado });
      // Aguardar 1s entre envios para não ser bloqueado
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return resultados;
}
