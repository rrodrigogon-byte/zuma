with open('app/core/whatsapp-ai.js', 'r', encoding='utf8') as f:
    content = f.read()

# 1. Expandir presenceConfirmIntent para reconhecer respostas rápidas
antigo_presence = """export function presenceConfirmIntent(text) {
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
  return /^(confirmo|confirmando|confirmado|confirmada|confirmo presenca|confirmo sim|sim confirmo|estarei ai|estarei la|vou sim|vou|vou comparecer|confirmadissimo|ok confirmado|pode confirmar|ta confirmado|esta confirmado|confirmar|sim confirmar)( obrigad[oa])?$/.test(value)
    || /^(sim|ok|pode ser|com certeza|fechado|fechou|perfeito|beleza|blz|bora|show|tamo junto|combinado|certo|marcado|ta marcado|opa vou|partiu)( obrigad[oa])?$/.test(value);
}"""

novo_presence = """export function presenceConfirmIntent(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 100) return false;
  // Se o cliente respondeu com emoji de positivo/joinha/acordo (ex.: 👍, 🤝, 🙏, ✅, 💈, ✂️)
  if (EMOJIS_CONFIRMACAO_PRESENCA.test(raw)) {
    // Não pode conter negação ou dúvida
    const semEmojis = plain(raw).replace(/[^a-z0-9 ]/g, ' ').trim();
    if (/\\b(nao|cancel|desmar|remarc|troc|mud|duvid|sera)\\b/i.test(semEmojis)) return false;
    return true;
  }
  const value = plain(raw).replace(/[^a-z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim();
  if (!value) return false;
  return /^(confirmo|confirmando|confirmado|confirmada|confirmo presenca|confirmo sim|sim confirmo|confirma|confirma pra mim|pode confirmar|pode ser sim|sim pode ser|estarei ai|estarei la|vou sim|vou|vou comparecer|confirmadissimo|ok confirmado|ta confirmado|esta confirmado|confirmar|sim confirmar|pode deixar marcado|vou querer esse|deixa marcado|deixa esse|marca esse|pode marcar|to a caminho|estou a caminho|chegando|ja to chegando|ja cheguei|to chegando|corte cabelo e barba|corte e barba|corte|barba)( obrigad[oa])?$/.test(value)
    || /^(sim|ok|pode ser|com certeza|fechado|fechou|perfeito|beleza|blz|bora|show|tamo junto|combinado|certo|marcado|ta marcado|opa vou|partiu|fechado entao|combinado entao)( obrigad[oa])?$/.test(value);
}"""

if antigo_presence in content:
    content = content.replace(antigo_presence, novo_presence)
    print("presenceConfirmIntent atualizado com sucesso!")
else:
    print("AVISO: antigo_presence não encontrado exatamente")

# 2. Desativar pergunta de personalização para T-Rex
antigo_personalization = """export function shouldAskPersonalization({ policy = {}, consent = {}, session = {}, pendingAction = false } = {}) {
  return policy.personalizationEnabled === true
    && consent.personalization !== true
    && !session.personalization_prompted_at
    && session.estado?.personalizacaoRespondida !== true
    && !pendingAction;
}"""

novo_personalization = """export function shouldAskPersonalization({ policy = {}, consent = {}, session = {}, pendingAction = false, persona = null } = {}) {
  // Barbearia Dino (T-Rex) prioriza agilidade e resolução imediata sem interrupções de pesquisa
  if (persona?.id === 'trex' || persona?.segmento === 'barbearia') return false;
  return policy.personalizationEnabled === true
    && consent.personalization !== true
    && !session.personalization_prompted_at
    && session.estado?.personalizacaoRespondida !== true
    && !pendingAction;
}"""

if antigo_personalization in content:
    content = content.replace(antigo_personalization, novo_personalization)
    print("shouldAskPersonalization atualizado com sucesso!")
else:
    print("AVISO: antigo_personalization não encontrado exatamente")

# 3. Adicionar diretrizes expressas RV no prompt do sistema
alvo_prompt = "- DURAÇÃO REAL DO SERVIÇO"
bloco_rv = """- MODO RV (RÉGUA VELOZ - AGENDAMENTO E CONFIRMAÇÃO ULTRA DIRETOS E RÁPIDOS):
  1. AGENDAMENTO EXPRESSO EM 2 TURNOS: Se o cliente disser dia, hora e serviço (ex: "quero cortar amanhã às 15h"), NUNCA pergunte "Quer que eu prepare?" ou "Posso marcar?". Consulte a vaga e chame preparar_agendamento IMEDIATAMENTE no mesmo turno! Responda em no máximo 2 linhas com o resumo e peça um "SIM" para fechar. Quando o cliente disser "SIM" ou afirmativa, o sistema confirma e encerra com o código.
  2. CONFIRMAÇÃO DE LEMBRETE EM 1 TURNO (ZERO ATRITO): Se o cliente responder a qualquer lembrete com confirmação ("confirmo", "confirmando", "confirmado", "sim", "ok", "pode confirmar", "fechou", "bora", "combinado", etc.), a presença é confirmada na hora pelo sistema. Responda em uma única linha calorosa: "Fechado, [Nome]! Presença confirmada para [Dia/Horário] com [Profissional]. Te esperamos na Dino Barbearia! 💈". NUNCA peça confirmação novamente!
  3. MENSAGENS CURTAS E OBJETIVAS: Máximo de 2 a 3 linhas por mensagem. Vá direto ao ponto com calor humano, sem apresentações repetitivas de "Sou novo por aqui" para quem já é cliente.
"""

if alvo_prompt in content and "MODO RV (RÉGUA VELOZ" not in content:
    content = content.replace(alvo_prompt, f"{bloco_rv}\n{alvo_prompt}")
    print("Diretriz RV inserida no prompt com sucesso!")

with open('app/core/whatsapp-ai.js', 'w', encoding='utf8') as f:
    f.write(content)
print("app/core/whatsapp-ai.js salvo com sucesso!")
