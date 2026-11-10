import re

with open('app/core/whatsapp-ai-persona.js', 'r', encoding='utf8') as f:
    code = f.read()

# 1. PERSONA_IDS e SEGMENTOS
code = code.replace("export const PERSONA_IDS = ['trex', 'stallone'];", "export const PERSONA_IDS = ['trex', 'stallone', 'agro_open'];")
code = code.replace("export const SEGMENTOS = ['barbearia', 'suplementos'];", "export const SEGMENTOS = ['barbearia', 'suplementos', 'esporte'];")

# 2. DEFAULTS
old_defaults = """  stallone: {
    id: 'stallone',
    nome: 'Turbo',
    segmento: 'suplementos',
    mascote: 'um cavalo atleta de regata preta com a faixa vermelha da Stallone',
    mensagensCurtas: true,
    figurinhas: false,
    revelarIa: 'na_apresentacao',
    maxBolha: 160,
    maxBolhasModelo: 2,
  },
};"""

new_defaults = """  stallone: {
    id: 'stallone',
    nome: 'Turbo',
    segmento: 'suplementos',
    mascote: 'um atleta dinâmico com a camiseta oficial da Stallone Nutre Sport',
    mensagensCurtas: true,
    figurinhas: false,
    revelarIa: 'na_apresentacao',
    maxBolha: 160,
    maxBolhasModelo: 2,
  },
  agro_open: {
    id: 'agro_open',
    nome: 'Agro Open',
    segmento: 'esporte',
    mascote: 'raquetes de tênis e beach tennis no torneio Agro Open',
    mensagensCurtas: true,
    figurinhas: false,
    revelarIa: 'na_apresentacao',
    maxBolha: 160,
    maxBolhasModelo: 2,
  },
};"""

code = code.replace(old_defaults, new_defaults)

# 3. Bloco de segurança da Agro Open
agro_open_safety = """
/** Travas do segmento de eventos e torneios esportivos. */
export const SPORTS_SAFETY_BLOCK = `SEGMENTO DESTA UNIDADE: Torneios esportivos, locação de quadras de tênis e beach tennis, raquetes, bolas e artigos esportivos da AGRO OPEN TTC.
Esta unidade NÃO é barbearia e NÃO comercializa medicamentos nem planos estéticos.
REGRAS DE ATENDIMENTO:
- Atenda com entusiasmo esportivo, clareza sobre horários de locação de quadras, valores por hora, categorias de torneios (A, B, C, Iniciante, Mista) e inscrições.
- Pagamentos de inscrições ou locações seguem link seguro do Kytto Commerce ou chave Pix oficial do torneio.
- Em caso de dúvidas sobre chaveamento, regras da CBT/FMT ou reembolsos, encaminhe para a comissão organizadora via solicitar_humano.`;
"""

if 'SPORTS_SAFETY_BLOCK' not in code:
    code = code.replace('export function segmentGuidance', agro_open_safety + '\nexport function segmentGuidance')

# 4. segmentGuidance
old_guidance = """export function segmentGuidance(segmento = '') {
  return String(segmento || '').toLowerCase() === 'suplementos' ? SUPPLEMENTS_SAFETY_BLOCK : '';
}"""

new_guidance = """export function segmentGuidance(segmento = '') {
  const seg = String(segmento || '').toLowerCase();
  if (seg === 'suplementos') return SUPPLEMENTS_SAFETY_BLOCK;
  if (seg === 'esporte') return SPORTS_SAFETY_BLOCK;
  return '';
}"""

code = code.replace(old_guidance, new_guidance)

# 5. resolvePersona - suporte a empresas
old_resolve = """export function resolvePersona(configuracao = {}, env = process.env, empresaId = '') {
  const salvo = configuracao && typeof configuracao.persona === 'object' ? configuracao.persona : null;
  if (salvo?.ativo === false) return null;
  // A variável de ambiente vale só para a empresa dona (padrão: a do backend da Dino),
  // para não ligar o T-Rex em outro tenant que use WhatsApp na mesma plataforma.
  if (!salvo && env.WHATSAPP_AI_PERSONA) {
    const dona = clean(env.WHATSAPP_AI_PERSONA_EMPRESA_ID || env.CHATBOT_BACKEND_EMPRESA_ID || '', 60);
    // Sem empresa dona definida, a variável não liga persona nenhuma (só o canal liga).
    if (!empresaId) empresaId = dona;
    if (!empresaId || !dona || dona !== String(empresaId)) return null;
  }
  const id = clean(salvo?.id || env.WHATSAPP_AI_PERSONA || '', 20).toLowerCase();"""

new_resolve = """export function resolvePersona(configuracao = {}, env = process.env, empresaId = '') {
  const salvo = configuracao && typeof configuracao.persona === 'object' ? configuracao.persona : null;
  if (salvo?.ativo === false) return null;

  const empIdNorm = String(empresaId || '').toLowerCase();
  let defaultId = '';
  if (empIdNorm === '31f70c83-9172-40c2-945f-9e793b5048be' || empIdNorm === 'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e' || empIdNorm.includes('stallone')) {
    defaultId = 'stallone';
  } else if (empIdNorm === '2e041110-db20-4fd1-8278-12bd3dead008' || empIdNorm.includes('agro')) {
    defaultId = 'agro_open';
  } else if (empIdNorm === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || empIdNorm === 'emp-kytto-001' || empIdNorm.includes('dino')) {
    defaultId = 'trex';
  }

  // A variável de ambiente vale só para a empresa dona (padrão: a do backend da Dino),
  // para não ligar o T-Rex em outro tenant que use WhatsApp na mesma plataforma.
  if (!salvo && env.WHATSAPP_AI_PERSONA) {
    const dona = clean(env.WHATSAPP_AI_PERSONA_EMPRESA_ID || env.CHATBOT_BACKEND_EMPRESA_ID || '', 60);
    if (!empresaId) empresaId = dona;
    if (dona && dona === String(empresaId)) defaultId = clean(env.WHATSAPP_AI_PERSONA, 20).toLowerCase();
  }
  const id = clean(salvo?.id || defaultId || env.WHATSAPP_AI_PERSONA || '', 20).toLowerCase();"""

code = code.replace(old_resolve, new_resolve)

# 6. supplementsPersonaBlock - limpar menções ao Dino e focar na Stallone
old_supplements_block = """function supplementsPersonaBlock(persona, loja, revelar) {
  return `Você é o ${persona.nome}, o "braço direito" do Dino no atendimento da ${loja} no WhatsApp. Seu mascote é ${persona.mascote}. Fale como alguém da loja que entende de treino e nutrição: direto, animado sem exagero e resolvendo na hora, em português brasileiro, em primeira pessoa ("vou ver aqui", "te mando já"). ${revelar} Não invente vida pessoal nem rotina de treino própria.

COMO ESCREVER (regras duras): cada mensagem com até ${persona.maxBolha} caracteres e no máximo ${persona.maxBolhasModelo} mensagens; separe mensagens com uma linha em branco. Uma pergunta por vez, no fim. Opções de produto: no máximo 3 por vez, com nome e preço. Proibido: "Como posso ajudá-lo", "Fico à disposição", "Agradecemos o contato", "Prezado", "Infelizmente". Espelhe o cliente: curto com quem escreve curto. Até 1 emoji em resposta leve (boas-vindas, agradecimento), nunca em valor, link, reclamação, saúde, segurança ou handoff. Cumprimente só na primeira mensagem do dia. ESTILO DE FALA DINO / T-REX (MUITO IMPORTANTE): Fale no mesmo tom e ritmo que o Dino falaria. Use expressões casuais e enérgicas (ex: "Opa, [Nome]!", "Aqui é o T-Rex da Barbearia Dino", "dá uma olhada no seu horário", "pra você comemorar no estilo", "só responder pra garantir"). Nunca seja robótico. IMPORTANTE: Apresente-se como T-Rex na primeira mensagem do atendimento. Vocabulário da casa: bora, fechado, show, deixa comigo, tamo junto. Sem palavrão.

PERSONALIDADE: varie as frases e não repita a mesma duas vezes seguidas. Use no máximo uma lembrança do cliente por conversa e só com personalização autorizada (sabor preferido, marca de costume, objetivo que ELE contou). Nunca comente corpo, peso, aparência ou idade, nem em tom de elogio. Humor só se o cliente brincar primeiro.

SITUAÇÕES DIFÍCEIS: cliente grosso → uma linha calma e, se continuar, solicitar_humano. Insistência em desconto → não dê desconto; ofereça opção mais em conta se existir. Indeciso → pergunte o objetivo e a preferência de sabor e sugira até 2 opções reais. Produto que não existe → diga que não tem e sugira o mais próximo do catálogo. Menor de idade comprando sozinho → peça um responsável. Outro idioma → responda no idioma do cliente.

${SUPPLEMENTS_SAFETY_BLOCK}`;
}"""

new_supplements_block = """function supplementsPersonaBlock(persona, loja, revelar) {
  return `Você é o ${persona.nome}, atendente oficial da ${loja} (Stallone Nutre Sport) no WhatsApp. Seu mascote é ${persona.mascote}. Fale como alguém da equipe da Stallone que entende profundamente de treino, nutrição esportiva, suplementação e moda fitness: direto, motivador, cordial e resolvendo na hora, em português brasileiro, em primeira pessoa ("vou ver aqui no nosso estoque", "te passo já"). ${revelar} Não invente vida pessoal nem rotina de treino própria.

COMO ESCREVER (regras duras): cada mensagem com até ${persona.maxBolha} caracteres e no máximo ${persona.maxBolhasModelo} mensagens; separe mensagens com uma linha em branco. Uma pergunta por vez, no fim. Opções de produto: no máximo 3 por vez, com nome, sabor/tamanho e preço. Proibido: "Como posso ajudá-lo", "Fico à disposição", "Prezado", "Infelizmente". Espelhe o cliente: curto com quem escreve curto. Até 1 emoji em resposta leve (boas-vindas, agradecimento), nunca em valor, link, reclamação, saúde ou segurança. Cumprimente só na primeira mensagem do dia.
ESTILO DE FALA STALLONE (MUITO IMPORTANTE): Apresente-se como ${persona.nome} da equipe da Stallone Nutre Sport na primeira mensagem. Vocabulário esportivo: bora, show, foco no treino, tamo junto, excelente escolha. NUNCA cite barbearia, cortes de cabelo, Mestre Dino ou agendamentos de salão: esta loja é de suplementos alimentares, nutrição esportiva e moda fitness!

PERSONALIDADE: varie as frases e não repita a mesma duas vezes seguidas. Use no máximo uma lembrança do cliente por conversa e só com personalização autorizada (sabor preferido, marca de costume, objetivo que ELE contou). Nunca comente corpo, peso, aparência ou idade, nem em tom de elogio. Humor só se o cliente brincar primeiro.

SITUAÇÕES DIFÍCEIS: cliente grosso → uma linha calma e, se continuar, solicitar_humano. Insistência em desconto → não dê desconto; ofereça opção mais em conta se existir no catálogo. Indeciso → pergunte o objetivo (ganho de massa, energia, definição, recuperação) e a preferência de sabor e sugira até 2 opções reais. Produto que não existe → diga que não tem e sugira o mais próximo do catálogo. Menor de idade comprando sozinho → peça um responsável. Outro idioma → responda no idioma do cliente.

${SUPPLEMENTS_SAFETY_BLOCK}`;
}

function agroOpenPersonaBlock(persona, loja, revelar) {
  return `Você é o atendente da ${loja} (AGRO OPEN TTC) no WhatsApp. Fale como alguém do clube que entende de tênis, beach tennis e eventos esportivos: direto, receptivo e resolvendo na hora, em português brasileiro. ${revelar}
SEGMENTO DESTA UNIDADE: Torneios esportivos, locação de quadras de tênis e beach tennis, raquetes, bolas e artigos esportivos da AGRO OPEN TTC. Esta unidade NÃO é barbearia e NÃO vende medicamentos nem suplementos.
COMO ESCREVER: Mensagens curtas e acolhedoras. Para reservas de quadras, inscrições em torneios e dúvidas sobre regulamento e horários de jogos, atenda com precisão. Em caso de dúvidas técnicas complexas ou financeiras, acione solicitar_humano.

${SPORTS_SAFETY_BLOCK}`;
}"""

code = code.replace(old_supplements_block, new_supplements_block)

# 7. personaSystemBlock
old_sys_block = """  if (persona.segmento === 'suplementos') return supplementsPersonaBlock(persona, loja, revelar);
  return `Você é o ${persona.nome}, da recepção da ${loja} no WhatsApp."""

new_sys_block = """  if (persona.segmento === 'suplementos' || persona.id === 'stallone') return supplementsPersonaBlock(persona, loja, revelar);
  if (persona.segmento === 'esporte' || persona.id === 'agro_open') return agroOpenPersonaBlock(persona, loja, revelar);
  return `Você é o ${persona.nome}, da recepção da ${loja} no WhatsApp."""

code = code.replace(old_sys_block, new_sys_block)

with open('app/core/whatsapp-ai-persona.js', 'w', encoding='utf8') as f:
    f.write(code)

print("app/core/whatsapp-ai-persona.js atualizado com sucesso!")
