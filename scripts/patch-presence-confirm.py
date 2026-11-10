with open('app/core/whatsapp-ai.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """export function presenceConfirmIntent(text) {
  const value = plain(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim();
  return /^(confirmo|confirmado|confirmada|confirmo presenca|confirmo sim|sim confirmo|estarei ai|estarei la|vou sim|confirmadissimo|ok confirmado|pode confirmar|ta confirmado|esta confirmado|confirmar)( obrigad[oa])?$/.test(value)
    || /^(sim|ok|pode ser|com certeza|fechado|perfeito)$/.test(value);
}"""

replacement = """const EMOJIS_CONFIRMACAO_PRESENCA = /(?:👍|👍🏻|👍🏼|👍🏽|👍🏾|👍🏿|👌|👌🏻|👌🏼|👌🏽|👌🏾|👌🏿|✌️|✌🏻|✌🏼|✌🏽|✌🏾|✌🏿|👊|👊🏻|👊🏼|👊🏽|👊🏾|👊🏿|🤝|🙏|🙌|👏|🤙|✅|✔️|✔|☑️|✂️|💈|🔥|💪)/u;

export function presenceConfirmIntent(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 100) return false;
  // Se o cliente respondeu com emoji de positivo/joinha/acordo (ex.: 👍, 🤝, 🙏, ✅)
  if (EMOJIS_CONFIRMACAO_PRESENCA.test(raw)) {
    // Não pode conter negação ou dúvida
    const semEmojis = plain(raw).replace(/[^a-z0-9 ]/g, ' ').trim();
    if (/\\b(nao|cancel|desmar|remarc|troc|mud|duvid|sera)\\b/i.test(semEmojis)) return false;
    return true;
  }
  const value = plain(raw).replace(/[^a-z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim();
  if (!value) return false;
  return /^(confirmo|confirmado|confirmada|confirmo presenca|confirmo sim|sim confirmo|estarei ai|estarei la|vou sim|vou|vou comparecer|confirmadissimo|ok confirmado|pode confirmar|ta confirmado|esta confirmado|confirmar|sim confirmar)( obrigad[oa])?$/.test(value)
    || /^(sim|ok|pode ser|com certeza|fechado|fechou|perfeito|beleza|blz|bora|show|tamo junto|combinado|certo|marcado|ta marcado|opa vou|partiu)( obrigad[oa])?$/.test(value);
}"""

if target in c:
    c = c.replace(target, replacement)
    with open('app/core/whatsapp-ai.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('presenceConfirmIntent atualizado com sucesso!')
else:
    print('Target presenceConfirmIntent nao encontrado!')
