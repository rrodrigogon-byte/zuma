// Notificação de handoff para a equipe humana.
//
// Quando o atendimento vai para humano (putSessionInHandoff), a equipe precisa:
//   1. receber um E-MAIL com o histórico da conversa (canal confiável, independe
//      da trava de egress do WhatsApp);
//   2. ter a conversa INICIADA no WhatsApp do atendente humano (um número
//      DIFERENTE do cliente), para já assumir pelo telefone.
//
// Config por canal/empresa (cadastro em Integrações do admin):
//   - handoff_notify_email: destino do e-mail de histórico.
//   - handoff_human_phone: WhatsApp do atendente humano.
// Sem config, cada canal simplesmente não dispara aquela via — nada quebra.
//
// Construção (buildHandoffEmail / buildHandoffHumanMessage) é pura e testável;
// o disparo (notifyHumanHandoff) é best-effort e nunca lança.

import { mail as defaultMail } from '../email.js';
import { motivoLegivel } from './whatsapp-handoff-labels.js';
import { sensitiveCustomerData } from './whatsapp-ai-profile.js';
import { canonicalWhatsappPhone } from './whatsapp-phone.js';

// whatsapp.js é importado de forma preguiçosa só na hora de enviar: evita puxar a
// cadeia de envio (e suas deps) ao carregar este módulo, e deixa os testes injetarem
// enviarMensagem sem tocar na rede.
async function defaultEnviarMensagem(...args) {
  const mod = await import('./whatsapp.js');
  return mod.enviarMensagem(...args);
}

function limpar(value, limit = 4000) {
  return String(value ?? '')
    // Remove caracteres de controle, preservando tab (\u0009), LF (\u000A) e CR (\u000D).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .trim()
    .slice(0, Math.max(0, limit));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function horaCurta(at) {
  if (!at) return '';
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function autor(role) {
  return role === 'assistant' ? 'Atendente virtual' : 'Cliente';
}

// Transcript: array de { role: 'user'|'assistant', text, at }.
function normalizarTranscript(transcript, limite = 30) {
  const linhas = Array.isArray(transcript) ? transcript : [];
  return linhas
    .filter((linha) => linha && limpar(linha.text, 1))
    .slice(-limite)
    .map((linha) => ({
      role: linha.role === 'assistant' ? 'assistant' : 'user',
      text: sensitiveCustomerData(linha.text) ? '[Conteúdo sensível omitido; consulte a sessão autorizada no painel.]' : limpar(linha.text, 1500),
      at: linha.at || null,
    }));
}

export function buildHandoffEmail({
  storeName = 'a loja',
  customerName = '',
  customerPhone = '',
  reason = '',
  priority = null,
  transcript = [],
} = {}) {
  const loja = limpar(storeName, 120) || 'a loja';
  const nome = limpar(customerName, 120);
  const telefone = digitsOnly(customerPhone).slice(0, 15);
  const motivo = motivoLegivel(reason);
  const linhas = normalizarTranscript(transcript);

  const quemHtml = nome
    ? `${escapeHtml(nome)}${telefone ? ` · ${escapeHtml(telefone)}` : ''}`
    : telefone
      ? escapeHtml(telefone)
      : 'cliente não identificado';

  const historicoHtml = linhas.length
    ? linhas
        .map((linha) => {
          const cor = linha.role === 'assistant' ? '#0E2E1C' : '#1f5fae';
          const quando = horaCurta(linha.at);
          return `<p style="margin:0 0 10px"><b style="color:${cor}">${autor(linha.role)}${quando ? ` <span style="color:#7a9e85;font-weight:normal;font-size:12px">(${escapeHtml(quando)})</span>` : ''}:</b><br>${escapeHtml(linha.text)}</p>`;
        })
        .join('')
    : '<p style="color:#7a9e85">Sem mensagens registradas nesta sessão.</p>';

  const prioridadeHtml =
    priority != null && Number.isFinite(Number(priority))
      ? `<p style="margin:0 0 6px"><b>Prioridade:</b> ${escapeHtml(String(priority))}/5</p>`
      : '';

  const html = `<!doctype html><html><body style="margin:0;background:#F4F6EF;font-family:Arial,Helvetica,sans-serif;color:#0E2E1C">
  <div style="max-width:620px;margin:0 auto;padding:24px">
    <div style="background:#0E2E1C;border-radius:14px 14px 0 0;padding:20px 26px">
      <div style="color:#8FD64A;font-size:12px;font-weight:bold;letter-spacing:1px">ATENDIMENTO · HANDOFF PARA A EQUIPE</div>
      <div style="color:#F4F6EF;font-size:19px;font-weight:bold;margin-top:6px">${escapeHtml(loja)} — atendimento aguardando uma pessoa</div>
    </div>
    <div style="background:#fff;border:1px solid #e3e8dd;border-top:0;border-radius:0 0 14px 14px;padding:22px 26px;font-size:14px;line-height:1.5">
      <p style="margin:0 0 6px"><b>Cliente:</b> ${quemHtml}</p>
      <p style="margin:0 0 6px"><b>Motivo:</b> ${escapeHtml(motivo)}</p>
      ${prioridadeHtml}
      <hr style="border:0;border-top:1px solid #e3e8dd;margin:16px 0">
      <div style="font-size:13px;font-weight:bold;color:#0E2E1C;margin-bottom:10px">Histórico da conversa</div>
      ${historicoHtml}
      <p style="margin-top:22px;color:#7a9e85;font-size:12px">Mensagem automática do SetPoint. A automação está pausada nesta conversa até a equipe assumir e liberar a sessão.</p>
    </div>
  </div></body></html>`;

  const texto = [
    `${loja} — atendimento aguardando uma pessoa`,
    `Cliente: ${nome || 'não identificado'}${telefone ? ` (${telefone})` : ''}`,
    `Motivo: ${motivo}`,
    priority != null && Number.isFinite(Number(priority)) ? `Prioridade: ${priority}/5` : '',
    '',
    'Histórico:',
    ...linhas.map((linha) => `- ${autor(linha.role)}${horaCurta(linha.at) ? ` (${horaCurta(linha.at)})` : ''}: ${linha.text}`),
  ]
    .filter((linha) => linha !== '')
    .join('\n');

  const assunto = `SetPoint · Atendimento aguardando${nome ? ` — ${nome}` : telefone ? ` — ${telefone}` : ''}`;

  return { subject: limpar(assunto, 200), html, text: limpar(texto, 8000) };
}

export function buildHandoffHumanMessage({
  storeName = 'a loja',
  customerName = '',
  customerPhone = '',
  reason = '',
  transcript = [],
} = {}) {
  const loja = limpar(storeName, 80) || 'a loja';
  const nome = limpar(customerName, 80);
  const telefone = digitsOnly(customerPhone).slice(0, 15);
  const motivo = motivoLegivel(reason);
  const ultimas = normalizarTranscript(transcript, 4);

  const trecho = ultimas.length
    ? ultimas.map((linha) => `• ${autor(linha.role)}: ${limitar120(linha.text)}`).join('\n')
    : 'Sem mensagens registradas.';

  return limpar(
    `🔔 *${loja}* — atendimento aguardando você\n\n` +
      `👤 Cliente: ${nome || 'não identificado'}${telefone ? `\n📱 ${telefone}` : ''}\n` +
      `📌 Motivo: ${motivo}\n\n` +
      `Últimas mensagens:\n${trecho}\n\n` +
      `A automação está pausada nessa conversa. Assuma por aqui e, quando terminar, libere a sessão no painel.`,
    4000,
  );
}

function limitar120(text) {
  const value = limpar(text, 121);
  return value.length > 120 ? `${value.slice(0, 119)}…` : value;
}

// Dispara e-mail + WhatsApp para o humano. Best-effort: nunca lança; devolve o
// resultado de cada via. deps permite injetar mail/enviarMensagem nos testes.
export async function notifyHumanHandoff(
  {
    session = {},
    reason = '',
    priority = null,
    storeName = '',
    customerName = '',
    customerPhone = '',
    transcript = [],
    config = {},
    tenant = null,
  } = {},
  deps = {},
) {
  const mail = deps.mail || defaultMail;
  const enviarMensagem = deps.enviarMensagem || defaultEnviarMensagem;

  const notifyEmail = limpar(config.notify_email || config.handoff_notify_email || config.notifyEmail, 320);
  const humanPhoneDigits = canonicalWhatsappPhone(config.attendant_phone || config.handoff_human_phone || config.humanPhone);
  const customerDigits = canonicalWhatsappPhone(customerPhone);

  const resultado = { emailed: null, messaged: null };

  if (notifyEmail && /.+@.+\..+/.test(notifyEmail)) {
    if (typeof mail.ativo === 'function' && !mail.ativo()) {
      resultado.emailed = { ok: false, skipped: true, code: 'MAIL_NOT_CONFIGURED' };
    } else {
    try {
      const { subject, html, text } = buildHandoffEmail({
        storeName,
        customerName,
        customerPhone,
        reason,
        priority,
        transcript,
      });
      resultado.emailed = await mail.enviar({ to: notifyEmail, subject, html, text });
    } catch (error) {
      resultado.emailed = { ok: false, erro: String(error?.message || error).slice(0, 200) };
    }
    }
  }

  // Número do humano precisa existir e ser DIFERENTE do cliente (não notificar o
  // próprio cliente por engano).
  if (humanPhoneDigits && humanPhoneDigits.length >= 10 && humanPhoneDigits !== customerDigits) {
    try {
      const texto = buildHandoffHumanMessage({ storeName, customerName, customerPhone, reason, transcript });
      const alvoTenant = tenant || {
        empresa_id: session.empresa_id,
        loja_id: session.loja_id,
        canal_id: session.canal_id,
        nome: storeName,
      };
      resultado.messaged = await enviarMensagem(alvoTenant, humanPhoneDigits, texto);
    } catch (error) {
      resultado.messaged = { ok: false, error: String(error?.message || error).slice(0, 200) };
    }
  }

  return resultado;
}
