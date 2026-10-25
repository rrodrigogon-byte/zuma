// E-mail transacional (nominal) via Resend HTTP API — sem dependências nativas.
// Variáveis de ambiente gerais: RESEND_API_KEY, EMAIL_FROM.
// Sem chave configurada → modo simulado (log), igual ao whatsapp.js.
//
// POLÍTICA: somente e-mail NOMINAL a quem tem uma ação (inscrição, ingresso,
// recuperação de senha). Nada em lote / alertas em massa.

const KEY  = process.env.RESEND_API_KEY || ''
const FROM = process.env.EMAIL_FROM || 'SetPoint <no-reply@setpoint.app>'

// Convites operacionais têm um remetente próprio, com fallback explícito para
// EMAIL_FROM. A configuração é lida no momento do envio para que readiness e
// testes possam refletir a configuração atual sem mudar o canal legado.
function operationalInviteConfig(env = process.env) {
  const dedicatedKey = String(env.OPERATIONAL_INVITE_RESEND_API_KEY || '').trim()
  const fallbackKey = String(env.RESEND_API_KEY || '').trim()
  const key = dedicatedKey || fallbackKey
  const from = String(env.OPERATIONAL_INVITE_EMAIL_FROM || env.EMAIL_FROM || '').trim()
  return { key, from }
}

function operationalInviteAtivo() {
  const { key, from } = operationalInviteConfig()
  return Boolean(key && from)
}

function operationalInviteFrom() {
  return operationalInviteConfig().from
}

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

function recoveryConfig() {
  return { key:String(process.env.PASSWORD_RESET_RESEND_API_KEY || process.env.OPERATIONAL_INVITE_RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim(), from:'Kytto <contato@kytto.com.br>' }
}

export const mail = {
  recuperacaoSenhaAtiva: () => Boolean(recoveryConfig().key),
  recuperacaoSenhaFrom: () => recoveryConfig().from,
  ativo,
  conviteOperacionalAtivo: operationalInviteAtivo,
  conviteOperacionalFrom: operationalInviteFrom,
  enviar,

  // Convites de acesso administrativo nunca usam o modo de simulação legado.
  // Um 2xx ambíguo não confirma entrega e exige revisão humana (sem reenviar).
  async conviteOperacional({ to, nome, url, empresaNome, from, inviteId }) {
    const configured = operationalInviteConfig()
    if (!configured.key || !configured.from || !to || !url) return { ok: false, code: 'MAIL_NOT_CONFIGURED' }
    const sender = String(from || configured.from).trim()
    if (sender !== configured.from) return { ok: false, code: 'MAIL_NOT_CONFIGURED' }
    const company = String(empresaNome || 'empresa selecionada').replace(/[\r\n]+/g, ' ').trim().slice(0, 180) || 'empresa selecionada'
    const subject = `Kytto · Convite para administração operacional da ${company}`
    const safeName = escapeHtml(nome || 'pessoa convidada')
    const safeCompany = escapeHtml(company)
    const safeUrl = escapeHtml(url)
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;background:#eef3ed;color:#17372f;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;padding:0;background:#eef3ed"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;margin:0 auto"><tr><td style="padding:0 4px 16px;color:#102c25;font-size:22px;font-weight:800;letter-spacing:-.6px">Kytto <span style="display:inline-block;margin-left:9px;padding-left:10px;border-left:1px solid #b8c8bd;color:#60746d;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;vertical-align:middle">Convite operacional</span></td></tr><tr><td style="overflow:hidden;border-radius:20px;background:#ffffff;box-shadow:0 14px 38px rgba(16,44,37,.12)"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="height:6px;background:#c8f169;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:34px 32px 18px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top" style="width:44px;padding:0 14px 0 0"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" valign="middle" style="width:40px;height:40px;border-radius:12px;background:#c8f169;color:#102c25;font-size:21px;font-weight:700;line-height:40px">✓</td></tr></table></td><td valign="top"><div style="margin:0 0 7px;color:#527150;font-size:10px;font-weight:700;letter-spacing:1.3px;line-height:14px;text-transform:uppercase">Convite de acesso</div><div style="margin:0;color:#102c25;font-size:28px;font-weight:700;letter-spacing:-.7px;line-height:34px">Crie sua senha de acesso</div></td></tr></table></td></tr><tr><td style="padding:0 32px"><p style="margin:0 0 13px;color:#17372f;font-size:16px;line-height:24px">Olá, <strong>${safeName}</strong>.</p><p style="margin:0;color:#60746d;font-size:15px;line-height:24px">Você recebeu um convite para acessar as operações da empresa <strong style="color:#17372f">${safeCompany}</strong> no Kytto.</p></td></tr><tr><td align="center" style="padding:27px 32px 25px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="border-radius:10px;background:#102c25"><a href="${safeUrl}" style="display:inline-block;padding:15px 22px;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;line-height:20px;text-align:center;text-decoration:none">Definir senha e aceitar convite&nbsp;&nbsp;→</a></td></tr></table></td></tr><tr><td style="padding:0 32px 30px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #dce9cc;border-radius:12px;background:#f8fcef"><tr><td style="padding:13px 14px;color:#456248;font-size:12px;font-weight:700;line-height:19px">Link individual &nbsp;•&nbsp; Uso único &nbsp;•&nbsp; Válido por 24 horas</td></tr></table><p style="margin:18px 0 0;color:#71837a;font-size:12px;line-height:19px">Por segurança, não encaminhe este convite. Se você não reconhece este acesso, pode ignorar esta mensagem.</p></td></tr></table></td></tr><tr><td style="padding:18px 8px 0;color:#71837a;font-size:11px;line-height:17px;text-align:center">Mensagem operacional do Kytto. Este e-mail foi enviado porque um convite de acesso foi criado para você.</td></tr></table></td></tr></table></body></html>`
    const text = `Olá, ${nome || 'pessoa convidada'}.

Você recebeu um convite para acessar as operações da empresa ${company} no Kytto.

Defina sua senha e aceite o convite: ${url}

Este link é individual, de uso único e válido por 24 horas. Por segurança, não encaminhe este convite. Se você não reconhece este acesso, ignore esta mensagem.`
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${configured.key}` }
    // Somente o ID interno do convite pode ser usado para idempotência. Token e
    // e-mail nunca são colocados em headers nem em logs.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(inviteId || ''))) {
      headers['Idempotency-Key'] = String(inviteId)
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({ from: sender, to: [to], subject, html, text }),
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
    const expira = expiresAt ? new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone:'America/Cuiaba' }) : 'em breve'
    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#fff9f5;font-family:Arial,sans-serif;color:#12283f"><main style="max-width:560px;margin:24px auto;padding:28px;background:#fff;border-radius:16px"><h1 style="font-size:24px">Kytto · Recuperação de acesso</h1><p>Olá, <strong>${nomeSeguro}</strong>.</p><p>Recebemos uma solicitação para criar uma nova senha da sua conta Kytto.</p><p><a href="${urlSegura}" style="display:inline-block;background:#ff6b2c;color:#fff;padding:14px 20px;border-radius:10px;text-decoration:none">Criar nova senha</a></p><p>Este link é individual, de uso único e expira em ${escapeHtml(expira)}.</p><p>Se você não fez este pedido, ignore a mensagem. Sua senha e seus acessos permanecem iguais até a confirmação.</p><p style="font-size:12px;color:#6c7884">Kytto · Sistemas inteligentes para negócios<br>contato@kytto.com.br</p></main></body></html>`
    const text = `Olá, ${nome || 'cliente'}! Acesse ${resetUrl} para criar uma nova senha. O link é de uso único e expira em ${expira}. Se não fez este pedido, ignore esta mensagem.`
    const configured = recoveryConfig()
    if (!configured.key || !to) return {ok:false,code:'MAIL_NOT_CONFIGURED'}
    try {
      const response = await fetch('https://api.resend.com/emails', { method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${configured.key}`},body:JSON.stringify({from:configured.from,to:[to],subject:'Kytto · Recuperação segura de acesso',html,text}) })
      const result = await response.json().catch(()=>({}))
      return response.ok && typeof result.id === 'string' && result.id ? {ok:true,id:result.id} : {ok:false,code:'MAIL_REJECTED'}
    } catch { return {ok:false,code:'MAIL_UNAVAILABLE'} }

  },
}
