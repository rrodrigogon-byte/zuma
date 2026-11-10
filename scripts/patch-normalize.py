with open('app/core/whatsapp-ai-normalize.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """export function cleanCustomerDisplayName(rawName, { firstNameOnly = false } = {}) {
  let name = String(rawName ?? '').normalize('NFC').trim()
  if (!name) return ''
  name = name.replace(/\\s*\\([^)]*\\)/g, ' ')
  name = name.split(/[,;\\-—]/)[0]
  name = name.replace(/\\b(novo|nova|lead\\s+whatsapp\\s*\\d*|lead\\b|cliente\\s+balc[aã]o|dino|barbearia|eng\\b|eng\\.\\b|civil\\b|engenheiro\\b|engenheira\\b|adv\\b|advogado\\b|advogada\\b)\\b/gi, ' ')
  name = name.replace(/\\b(hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|\\d{1,2}\\/\\d{1,2}|\\d{1,2}h|\\d{1,2}:\\d{2})\\b/gi, ' ')
  name = name.replace(/\\s+/g, ' ').trim()
  if (!name) return ''
  if (firstNameOnly) {
    const first = name.split(/\\s+/)[0]
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : ''
  }"""

replacement = """export function cleanCustomerDisplayName(rawName, { firstNameOnly = false } = {}) {
  let name = String(rawName ?? '').normalize('NFC').trim()
  if (!name) return ''
  // Trata prefixos legados de importação como "Cliente Avec — Evertom Kloppel" ou "Cliente Avec - ..."
  if (/^cliente\\s+avec\\s*[-—]/i.test(name)) {
    const aposTraco = name.replace(/^cliente\\s+avec\\s*[-—]\\s*/i, '').trim()
    if (aposTraco && !/^(?:cel|tel|fone|\\d)/i.test(aposTraco)) {
      name = aposTraco
    } else {
      name = ''
    }
  }
  name = name.replace(/\\b(cliente\\s+avec|avec)\\b/gi, ' ')
  name = name.replace(/\\s*\\([^)]*\\)/g, ' ')
  name = name.split(/[,;\\-—]/)[0]
  name = name.replace(/\\b(novo|nova|lead\\s+whatsapp\\s*\\d*|lead\\b|cliente\\s+balc[aã]o|dino|barbearia|eng\\b|eng\\.\\b|civil\\b|engenheiro\\b|engenheira\\b|adv\\b|advogado\\b|advogada\\b)\\b/gi, ' ')
  name = name.replace(/\\b(hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|\\d{1,2}\\/\\d{1,2}|\\d{1,2}h|\\d{1,2}:\\d{2})\\b/gi, ' ')
  name = name.replace(/\\s+/g, ' ').trim()
  if (!name || /^(cliente|amigo|usuario|lead|contato)$/i.test(name)) return ''
  if (firstNameOnly) {
    const first = name.split(/\\s+/)[0]
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : ''
  }"""

if target in c:
    c = c.replace(target, replacement)
    with open('app/core/whatsapp-ai-normalize.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('cleanCustomerDisplayName atualizado com sucesso!')
else:
    print('Target nao encontrado!')
