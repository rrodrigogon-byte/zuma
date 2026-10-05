// E-mail transacional (nominal) via Resend HTTP API — sem dependências nativas.
// Variáveis de ambiente: RESEND_API_KEY, EMAIL_FROM.
// Sem chave configurada → modo simulado (log), igual ao whatsapp.js.
//
// POLÍTICA: somente e-mail NOMINAL a quem tem uma ação (inscrição, ingresso,
// recuperação de senha). Nada em lote / alertas em massa.

const KEY  = process.env.RESEND_API_KEY || ''
const FROM = process.env.EMAIL_FROM || 'SetPoint <no-reply@setpoint.app>'

function ativo() { return !!KEY }

const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]))

// Layout HTML base com a identidade da marca
function layout(titulo, corpoHtml) {
  return `<!doctype html><html><body style="margin:0;background:#F4F6EF;font-family:Arial,Helvetica,sans-serif;color:#0E2E1C">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0E2E1C;border-radius:14px 14px 0 0;padding:22px 28px">
      <div style="color:#8FD64A;font-size:13px;font-weight:bold;letter-spacing:1px">SETPOINT · 4ª AGRO OPEN DE TÊNIS</div>
      <div style="color:#F4F6EF;font-size:20px;font-weight:bold;margin-top:6px">${titulo}</div>
    </div>
    <div style="background:#fff;border:1px solid #e3e8dd;border-top:0;border-radius:0 0 14px 14px;padding:26px 28px;font-size:15px;line-height:1.6">
      ${corpoHtml}
      <p style="margin-top:26px;color:#7a9e85;font-size:12px">Esta é uma mensagem automática do SetPoint. Em caso de dúvida, responda este e-mail.</p>
    </div>
  </div></body></html>`
}

async function enviar({ to, subject, html, text }) {
  if (!to) return { ok: false, erro: 'destinatário ausente' }
  if (!ativo()) {
    console.log(`[MAIL-SIM] para ${to} · "${subject}"`)
    return { ok: true, simulado: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { console.error('[MAIL] falha:', data?.message || res.status); return { ok: false, data } }
    return { ok: true, id: data?.id }
  } catch (e) {
    console.error('[MAIL] erro:', e.message)
    return { ok: false, erro: e.message }
  }
}

export const mail = {
  ativo,
  enviar,

  // Convites de acesso administrativo nunca usam o modo de simulação legado.
  // Um 2xx ambíguo não confirma entrega e exige revisão humana (sem reenviar).
  async conviteOperacional({ to, nome, url }) {
    if (!KEY || !process.env.EMAIL_FROM || !to || !url) return { ok: false, code: 'MAIL_NOT_CONFIGURED' }
    const subject = 'Kytto · Convite para administração operacional da Dino'
    const html = `<p>Olá, ${escapeHtml(nome)}.</p><p>Você recebeu um convite para administrar as operações somente da Dino, sem gestão de usuários no Kytto.</p><p><a href="${escapeHtml(url)}">Definir minha senha e aceitar o convite</a></p><p>O link é pessoal, de uso único e expira em 24 horas. Se você não esperava este convite, ignore esta mensagem.</p>`
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) return { ok: false, code: 'MAIL_REJECTED' }
      const data = await response.json().catch(() => ({}))
      return data?.id ? { ok: true } : { ok: false, code: 'MAIL_UNCERTAIN' }
    } catch {
      return { ok: false, code: 'MAIL_UNCERTAIN' }
    }
  },

  // Inscrição recebida (aguardando pagamento) — nominal ao inscrito
  async inscricaoRecebida(to, nome, categorias, total, prazoISO) {
    const cats = (Array.isArray(categorias) ? categorias : [categorias]).filter(Boolean)
    const prazo = prazoISO ? new Date(prazoISO).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
    const html = layout('Inscrição recebida 🎾', `
      <p>Olá, <b>${nome}</b>!</p>
      <p>Recebemos sua inscrição nas categorias:</p>
      <ul>${cats.map(c => `<li>${c}</li>`).join('')}</ul>
      <p>Valor total: <b>${brl(total)}</b></p>
      ${prazo ? `<p>Para confirmar sua vaga, efetue o pagamento via Pix até <b>${prazo}</b>.</p>` : ''}
      <p>Boa sorte no torneio! 🏆</p>`)
    return enviar({ to, subject: 'SetPoint · Inscrição recebida — 4ª Agro Open', html })
  },

  // Ingresso emitido — nominal ao comprador
  async ingresso(to, nome, tipoNome, code) {
    const html = layout('Seu ingresso 🎟️', `
      <p>Olá, <b>${nome}</b>!</p>
      <p>Seu ingresso <b>${tipoNome}</b> foi emitido.</p>
      <p>Código de entrada (apresente na portaria):</p>
      <p style="font-size:20px;font-weight:bold;letter-spacing:2px;background:#F4F6EF;border:1px dashed #5FB335;border-radius:10px;padding:14px;text-align:center">${code}</p>
      <p>Você também pode apresentar o QR Code disponível na sua confirmação de compra.</p>`)
    return enviar({ to, subject: 'SetPoint · Seu ingresso — 4ª Agro Open', html })
  },

  // Loja: pedido recebido (aguardando preparo) — nominal ao cliente
  async lojaPedidoRecebido(to, nome, codigo, total) {
    const html = layout('Pedido recebido 🛍️', `
      <p>Olá, <b>${nome}</b>!</p>
      <p>Recebemos seu pedido na loja da 4ª Agro Open.</p>
      <p>Código do pedido (guarde para a retirada):</p>
      <p style="font-size:20px;font-weight:bold;letter-spacing:2px;background:#F4F6EF;border:1px dashed #5FB335;border-radius:10px;padding:14px;text-align:center">${codigo}</p>
      <p>Total: <b>${brl(total)}</b></p>
      <p>Avisaremos quando estiver <b>pronto para retirada</b> no Tangará Tênis Clube.</p>`)
    return enviar({ to, subject: `SetPoint · Pedido ${codigo} recebido`, html })
  },

  // Loja: pedido pronto para retirada — nominal ao cliente
  async lojaPedidoPronto(to, nome, codigo) {
    const html = layout('Pedido pronto para retirada ✅', `
      <p>Olá, <b>${nome}</b>!</p>
      <p>Seu pedido <b>${codigo}</b> está <b>pronto para retirada</b> no Tangará Tênis Clube.</p>
      <p>Apresente este código na loja. Até já! 🎾</p>`)
    return enviar({ to, subject: `SetPoint · Pedido ${codigo} pronto para retirada`, html })
  },

  // Recuperação — link nominal de uso único; nenhuma senha é enviada por e-mail.
  async redefinicaoSenha(to, nome, resetUrl, expiresAt) {
    const nomeSeguro = escapeHtml(nome || 'cliente')
    const urlSegura = escapeHtml(resetUrl)
    const expira = expiresAt ? new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'em breve'
    const html = layout('Recuperação segura de acesso 🔐', `
      <p>Olá, <b>${nomeSeguro}</b>!</p>
      <p>Recebemos uma solicitação para criar uma nova senha na sua conta Kytto.</p>
      <p><a href="${urlSegura}" style="display:inline-block;background:#FF6B2C;color:#fff;text-decoration:none;border-radius:10px;padding:13px 18px;font-weight:bold">Criar nova senha</a></p>
      <p>Este link é de uso único e expira em <b>${expira}</b>. Se você não solicitou a recuperação, ignore esta mensagem.</p>`)
    const text = `Olá, ${nome || 'cliente'}! Acesse ${resetUrl} para criar uma nova senha. O link é de uso único e expira em ${expira}.`
    return enviar({ to, subject: 'Kytto · Recuperação segura de acesso', html, text })
  },
}
