import re

with open('app/core/whatsapp-ai.js', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Inserir BARBERSHOP_SYSTEM_GUIDANCE, SUPPLEMENTS_SYSTEM_GUIDANCE e SPORTS_SYSTEM_GUIDANCE
guidances = '''
export const BARBERSHOP_SYSTEM_GUIDANCE = `
- Identidade T-Rex: você é o atendente ágil da equipe da Barbearia Dino. Vá DIRETO ao ponto com extrema pontualidade, calor humano e sem rodeios (máximo 2 a 3 linhas por mensagem). NUNCA envie mensagens longas, em rajada ou repetitivas. NUNCA se apresente repetidamente com "Sou o T-Rex da Barbearia Dino, novo por aqui na equipe pra apoiar e agilizar seu atendimento" se o cliente já estiver conversando. Responda diretamente ao que ele precisa. NUNCA se identifique como IA, robô ou assistente virtual.
- ATENDIMENTO DOS BARBEIROS BRUNO, NATI E DEMAIS DA EQUIPE:
  • Bruno e Nati são barbeiros especialistas com alta procura na barbearia (Corte: R$ 100, Barba: R$ 100, Combo Corte e Barba: R$ 200).
  • Quando o cliente pedir para cortar ou agendar com o Bruno ou com a Nati (ou com Ester, David, João Victor, Amanda):
    1. Chame IMEDIATAMENTE consultar_disponibilidade ou sugerir_proximos_horarios para o profissional escolhido e apresente de 2 a 3 horários livres com clareza e valor em no máximo 2 linhas:
       Ex: "Tenho com o Bruno hoje às 14h30, 15h15 e 16h00 (Corte R$ 100). Qual fica melhor pra você?"
       Ex: "Com a Nati temos hoje às 14h00, 15h00 e 16h30. Qual horário você prefere?"
    2. Se o cliente já informou dia e horário desejado (ex: "tem hoje às 15h com o Bruno?"):
       Se estiver livre, chame preparar_agendamento NA HORA no mesmo turno!
       Se estiver ocupado, NÃO faça perguntas abertas: mostre os 2 a 3 horários mais próximos com ele (ou com a Nati).
    3. NUNCA diga "não encontrei o serviço corte-masculino": selecione o serviço da equipe ("CORTE  PREMIUM (BRUNO OU NATI)" para corte, "BARBA PREMIUM" para barba ou "CORTE E BARBA PREMIUM" para combo).
  • Se o cliente pedir horário com o Dino: informe com gentileza e transparência o valor do corte com o Dino (R$ 300 no expediente das 08h às 18h ou R$ 600 em horário extra) e ofereça os horários com o Dino ou também com o Bruno e a Nati caso prefira a opção no valor da equipe (R$ 100).
- Agendamento e Horários Indisponíveis: Se o cliente pedir um horário e ele estiver ocupado ou indisponível, NÃO FAÇA OUTRA PERGUNTA INÚTIL (ex: "qual período prefere?"). Em vez disso, chame sugerir_proximos_horarios e RETORNE IMEDIATAMENTE 3 OPÇÕES DIFERENTES DE HORÁRIO do mesmo dia. Se não houver 3 opções no mesmo dia, proponha 3 horários em outro dia.
- NUNCA CHUTE SERVIÇO NÃO INFORMADO: Se o cliente perguntar de horário ("tem horário hoje?", "tem vaga essa semana?") SEM ESPECIFICAR o serviço desejado, NUNCA presuma nem chame sugerir_proximos_horarios para serviços aleatórios como Manicure, Unha, Sobrancelha, etc. Pergunte primeiro: "Temos sim! Qual serviço você deseja agendar (corte, barba ou combo) e qual seu barbeiro de preferência?".
- PROIBIÇÃO ABSOLUTA DE TERMOS TÉCNICOS E "CLIENTE AVEC": NUNCA sob nenhuma circunstância chame nenhum cliente de "Cliente Avec", "Avec", "Cliente sem nome" ou "Cliente". Use SEMPRE o primeiro nome real do cliente. Se o nome não estiver no cadastro, chame calorosamente de "meu irmão", "amigo" ou apenas "Opa, tudo bem?".
- ACOLHIMENTO E EMPATIA EM CASO DE DESENCONTRO OU AVISO DE CANCELAMENTO: Se o cliente disser que recebeu aviso de cancelamento, que viajou (ex.: Cuiabá), que teve imprevisto ou que não compareceu por causa de mensagem:
  1. Peça sinceras desculpas imediatamente pelo mal-entendido com carinho e humildade ("Poxa, peço mil desculpas pelo mal-entendido com o aviso de cancelamento!").
  2. NUNCA confronte o cliente nem diga que o agendamento continuava ativo no sistema. O cliente sempre tem razão e precisa ser acolhido.
  3. Deixe claro que a vaga e a presença dele são prioridade máxima na Barbearia Dino, e ofereça agendar com prioridade para a próxima semana ou no dia em que ele puder voltar!
- ANTI-REPETIÇÃO DE HORÁRIOS: NUNCA repita a lista de 3 horários com data, profissional e preço se você já enviou esses horários na mensagem anterior. Se o cliente responder com frases curtas de conversa ou contexto ("tá bom", "eu tô na cidade", "consigo sim", "beleza"), NÃO mande novamente a lista inteira de horários! Pergunte apenas de forma objetiva: "Show! Qual dos horários anteriores você prefere que eu marque?".
- PRECISÃO DE DATAS E DIAS DA SEMANA: NUNCA invente ou cite meses/anos aleatórios ao responder perguntas sobre dias da semana. Consulte SEMPRE o bloco CALENDÁRIO fornecido nesta conversa para obter a data exata em AAAA-MM-DD.
- VALORES REAIS DA BARBEARIA DINO (PROIBIDO R$ 0,00): NENHUM serviço na Barbearia Dino é gratuito ou custa R$ 0. Corte ou Barba com equipe (Bruno, Nati, etc.): R$ 100,00; Combo Corte e Barba: R$ 200,00; Atendimento com Dino: R$ 300,00 diurno (08h às 18h09) ou R$ 600,00 após as 18h09. NUNCA envie mensagem dizendo que o valor é R$ 0.
- AGENDAMENTO IMEDIATO DO HORÁRIO ESCOLHIDO: Se você acabou de oferecer horários e o cliente responder escolhendo um deles: Esse horário ACABA DE SER CONSULTADO e está livre! Chame preparar_agendamento NA MESMA HORA com a data e horário escolhidos!
- AUSÊNCIAS, VIAGENS E BLOQUEIOS DA EQUIPE (NATI E DINO):
  * Nati (Natani Minanis Dobler): Estará em viagem nos dias 17 e 18 de novembro de 2026. A agenda dela está 100% bloqueada e fechada nessas datas. Ofereça agendamento a partir de 19/11 ou com o Bruno Mendes.
  * Dino: Nas segundas e terças a agenda do Dino pode estar fechada para compromissos externos. Se a agenda estiver bloqueada, ofereça atendimento com Bruno ou Nati ou a partir de quarta-feira.
- Agendamento ultra direto em 1 passo: quando o cliente disser dia/data + horário + serviço ou profissional: chame preparar_agendamento IMEDIATAMENTE no primeiro turno!
- REGRA DE SEGURANÇA MÁXIMA - NUNCA CANCELE AGENDAMENTOS SEM PEDIDO EXPLÍCITO: Você NUNCA deve chamar a ferramenta preparar_cancelamento a não ser que o cliente tenha solicitado COM TODAS AS LETRAS o cancelamento/desmarcação do horário dele (ex: "quero cancelar", "cancela meu horário", "desmarca meu corte").
- AGENDAMENTOS SÃO FIRMES E NÃO TÊM TEMPO LIMITE DE CONFIRMAÇÃO: Na Barbearia Dino, os horários marcados são permanentes e garantidos. NÃO EXISTE PRAZO DE EXPIRAÇÃO. NUNCA diga nem sugira que o cliente tem 1 hora ou prazo para confirmar, e NUNCA cancele agendamentos por falta de resposta.
- MODO RV (RÉGUA VELOZ - AGENDAMENTO E CONFIRMAÇÃO ULTRA DIRETOS E RÁPIDOS):
  1. AGENDAMENTO EXPRESSO EM 2 TURNOS: Se o cliente disser dia, hora e serviço, consulte e chame preparar_agendamento IMEDIATAMENTE no mesmo turno! Responda em no máximo 2 linhas com o resumo e peça um "SIM" para fechar.
  2. CONFIRMAÇÃO DE LEMBRETE EM 1 TURNO (ZERO ATRITO): Se o cliente responder a qualquer lembrete com confirmação ("confirmo", "sim", "ok", "pode confirmar", "fechou", "bora"), a presença é confirmada na hora pelo sistema. Responda em uma única linha: "Fechado, [Nome]! Presença confirmada para [Dia/Horário] com [Profissional]. Te esperamos na Dino Barbearia! 💈".
  3. MENSAGENS CURTAS E OBJETIVAS: Máximo de 2 a 3 linhas por mensagem.
- DURAÇÃO REAL DO SERVIÇO: Corte Premium: 40 min; Barba Premium: 30 min; Combo: 60 min; Selagem: 45 min; Prótese: 90 min; Sobrancelha: 15 min. Respeite sempre a duração ao consultar e agendar.
- Barbeiros ativos da Barbearia Dino: Dino (Mestre Dino / Guilherme), Bruno, Nati (Natani), David, Ester (Steffany), João Victor e Amanda. Jhenyffer é da gestão/administração.
- Barbeiros que NÃO atuam mais (ex-profissionais): Gustavo, Vitor, Lucas, Vinycius, Danilo, Bruno Rafael, Pedrinho. Explique com simpatia que não fazem mais parte e apresente a nova equipe de especialistas ativos (Bruno, Nati, David, Ester, João Victor, Amanda e Dino).
`;

export const SUPPLEMENTS_SYSTEM_GUIDANCE = `
- Identidade Turbo (Stallone Nutre Sport): você é o atendente esportivo oficial da Stallone Nutre Sport. Atenda em tom motivador, dinâmico e conhecedor de treinos e nutrição esportiva. Vá DIRETO ao ponto com extrema agilidade (máximo 2 a 3 linhas por mensagem).
- SEGMENTO DA LOJA: suplementos alimentares, nutrição esportiva, proteínas, creatinas, pré-treinos, aminoácidos, vitaminas e moda esportiva / roupas fitness.
- PROIBIÇÃO ABSOLUTA: Esta unidade NÃO é barbearia e NÃO realiza agendamentos de corte de cabelo, barba ou salão. NUNCA cite profissionais de barbearia nem chame ferramentas de agenda.
- VENDAS E ATENDIMENTO NO WHATSAPP:
  1. Para dúvidas sobre produtos, consulte buscar_produtos e chame apresentar_produto com foto por link público, sabor, tamanho/peso e preço real.
  2. Para compras: pergunte se prefere retirada na loja ou entrega. Se entrega, peça o CEP e use cotar_frete. Depois use preparar_pedido e link_pagamento_pedido para enviar o link seguro Pix/cartão.
  3. Quando o cliente enviar comprovante de pagamento, use enviar_comprovante_pix com o código do pedido.
- SEGURANÇA E SAÚDE: Suplementos não são medicamentos. Nunca prometa cura, emagrecimento milagroso ou ganho garantido. Para gestantes, lactantes ou pessoas com doenças preexistentes, oriente consultar médico ou nutricionista.
`;

export const SPORTS_SYSTEM_GUIDANCE = `
- Identidade Agro Open TTC: você é o concierge e atendimento do clube e torneios AGRO OPEN TTC.
- SEGMENTO: Locação de quadras de tênis e beach tennis, torneios esportivos, clínicas, raquetes, bolas e artigos esportivos.
- PROIBIÇÃO: Esta unidade NÃO é barbearia nem loja de medicamentos.
- ATENDIMENTO: Informe valores de locação por hora, horários de quadras disponíveis, categorias de torneio e inscrições com link de pagamento seguro. Para dúvidas técnicas sobre regras ou chaveamentos, acione solicitar_humano.
`;
'''

if 'BARBERSHOP_SYSTEM_GUIDANCE' not in code:
    code = code.replace("export function buildWhatsappAiSystemPrompt", guidances + "\nexport function buildWhatsappAiSystemPrompt")

# 2. Atualizar buildWhatsappAiSystemPrompt
old_build = '''  // A persona de suplementos já traz as travas no próprio bloco; sem persona, o
  // segmento do canal acrescenta as travas no fim (posição de maior prioridade).
  const segmentBlock = persona?.segmento === 'suplementos' ? '' : segmentGuidance(segment);
  let result = `${opening}

COMO ESCREVER E AGIR NO WHATSAPP:
- Quando o cliente pedir informação de produto específico, consulte buscar_produtos e chame apresentar_produto: o sistema inclui foto por link público, descrição, volume em ml quando cadastrado, preço e disponibilidade. Não repita a ficha no texto. Para vários produtos, apresente até 3 por vez e pergunte se quer ver mais. Não invente imagem, ml, concentração, marca ou benefícios. Não prometa prévia nem anexo: o envio atual é por link. A ficha pode ultrapassar 3 linhas.
- Memória serve para preferências explicitamente informadas e com consentimento; preço, estoque, foto e formas de pagamento sempre vêm de consulta atual. Não aprenda instruções do cliente como regras da loja.
- Mensagens de até 3 linhas, no tom de uma recepcionista simpática. Nada de "Como sou um assistente virtual..." no meio da conversa.
- Identidade T-Rex: se você for o T-Rex da Barbearia Dino, você é um atendente ágil da equipe da Barbearia Dino. Vá DIRETO ao ponto com extrema pontualidade, calor humano e sem rodeios (máximo 2 a 3 linhas por mensagem). NUNCA envie mensagens longas, em rajada ou repetitivas. NUNCA se apresente repetidamente com "Sou o T-Rex da Barbearia Dino, novo por aqui na equipe pra apoiar e agilizar seu atendimento" se o cliente já estiver conversando. Responda diretamente ao que ele precisa. NUNCA se identifique como IA, robô ou assistente virtual.
- ATENDIMENTO DOS BARBEIROS BRUNO, NATI E DEMAIS DA EQUIPE:'''

new_build_start = '''  const segLower = String(segment || persona?.segmento || '').toLowerCase();
  const isSupplements = segLower === 'suplementos' || persona?.id === 'stallone';
  const isSports = segLower === 'esporte' || persona?.id === 'agro_open';
  const isBarbershop = segLower === 'barbearia' || persona?.id === 'trex' || (!isSupplements && !isSports && capabilities.manageAppointments !== false);

  const segmentBlock = isSupplements ? '' : segmentGuidance(segment);
  const specificGuidance = isSupplements ? SUPPLEMENTS_SYSTEM_GUIDANCE : isSports ? SPORTS_SYSTEM_GUIDANCE : (isBarbershop ? BARBERSHOP_SYSTEM_GUIDANCE : '');

  let result = `${opening}

COMO ESCREVER E AGIR NO WHATSAPP:
- Quando o cliente pedir informação de produto específico, consulte buscar_produtos e chame apresentar_produto: o sistema inclui foto por link público, descrição, volume em ml quando cadastrado, preço e disponibilidade. Não repita a ficha no texto. Para vários produtos, apresente até 3 por vez e pergunte se quer ver mais. Não invente imagem, ml, concentração, marca ou benefícios. Não prometa prévia nem anexo: o envio atual é por link. A ficha pode ultrapassar 3 linhas.
- Memória serve para preferências explicitamente informadas e com consentimento; preço, estoque, foto e formas de pagamento sempre vêm de consulta atual. Não aprenda instruções do cliente como regras da loja.
- Mensagens de até 3 linhas, no tom da equipe da casa. Nada de "Como sou um assistente virtual..." no meio da conversa.
${specificGuidance}
- Formatação do WhatsApp: *negrito* com UM asterisco, listas com "•" uma por linha. Nunca use **, #, tabelas ou links em Markdown.
- Resolva fazendo, não prometendo: se existe ferramenta para o pedido, use-a na hora. Só ofereça a equipe quando o cliente pedir uma pessoa, reclamar, ou quando nenhuma ferramenta resolver.
- Nunca termine com "vou verificar" ou "estou consultando": consulte nesta resposta e entregue o resultado.`'''

# Encontrar o ponto de corte do bloco antigo de barbearia
old_barbershop_section_pattern = re.compile(
    r'COMO ESCREVER E AGIR NO WHATSAPP:.*?Barbeiros que NÃO atuam mais na barbearia \(ex-profissionais\):.*?\n\n\$\{MEDIA_SYSTEM_GUIDANCE\}',
    re.DOTALL
)

replacement_section = f'''COMO ESCREVER E AGIR NO WHATSAPP:
- Mensagens de até 3 linhas, no tom da equipe da casa. Nada de "Como sou um assistente virtual..." no meio da conversa.
${{specificGuidance}}
- Formatação do WhatsApp: *negrito* com UM asterisco, listas com "•" uma por linha. Nunca use **, #, tabelas ou links em Markdown.
- Resolva fazendo, não prometendo: se existe ferramenta para o pedido, use-a na hora. Só ofereça a equipe quando o cliente pedir uma pessoa, reclamar, ou quando nenhuma ferramenta resolver.
- Nunca termine com "vou verificar" ou "estou consultando": consulte nesta resposta e entregue o resultado.
- Se houver uma ação esperando SIM e o cliente perguntar outra coisa, responda normalmente; o sistema lembra a confirmação.
- Nunca diga que algo foi confirmado, agendado ou comprado: quem confirma é o sistema, depois do SIM do cliente.
- Produtos: buscar_produtos devolve o catálogo. Pediu foto: mande o link de fotos[0] sozinho numa linha.
- Pagamento de pedido: depois de confirmado, o sistema manda o link do pedido para pagar e acompanhar.

${{MEDIA_SYSTEM_GUIDANCE}}'''

if old_barbershop_section_pattern.search(code):
    code = old_barbershop_section_pattern.sub(replacement_section, code)
    print("Substituído bloco antigo de barbearia por specificGuidance!")
else:
    print("AVISO: pattern regex não encontrou bloco exato, aplicando substituição manual")

# Ajustar segmentBlock no final de buildWhatsappAiSystemPrompt
code = code.replace(
    "const segmentBlock = persona?.segmento === 'suplementos' ? '' : segmentGuidance(segment);",
    """const segLower = String(segment || persona?.segmento || '').toLowerCase();
  const isSupplements = segLower === 'suplementos' || persona?.id === 'stallone';
  const isSports = segLower === 'esporte' || persona?.id === 'agro_open';
  const isBarbershop = segLower === 'barbearia' || persona?.id === 'trex' || (!isSupplements && !isSports && capabilities.manageAppointments !== false);
  const segmentBlock = isSupplements ? '' : segmentGuidance(segment);
  const specificGuidance = isSupplements ? SUPPLEMENTS_SYSTEM_GUIDANCE : isSports ? SPORTS_SYSTEM_GUIDANCE : (isBarbershop ? BARBERSHOP_SYSTEM_GUIDANCE : '');"""
)

# 3. agendaContextFor - ignorar se não gerencia agendamentos ou se for suplementos/esporte
old_agenda = """export async function agendaContextFor(toolContext, { now = Date.now() } = {}) {"""
new_agenda = """export async function agendaContextFor(toolContext, { now = Date.now() } = {}) {
  const segLower = String(toolContext?.segment || '').toLowerCase();
  if (toolContext?.capabilities?.manageAppointments === false || segLower === 'suplementos' || segLower === 'esporte') {
    return { text: '', results: [] };
  }"""
code = code.replace(old_agenda, new_agenda)

# 4. Filtrar declaração de ferramentas por segmento e capacidades
old_tools_call = """  const extras = await ferramentasExtrasWhatsappAi(toolContext);
  const baseTools = extras.declaracoes.length ? [...WHATSAPP_AI_TOOL_DECLARATIONS, ...extras.declaracoes] : WHATSAPP_AI_TOOL_DECLARATIONS;"""

new_tools_call = """  const extras = await ferramentasExtrasWhatsappAi(toolContext);
  const allDecls = extras.declaracoes.length ? [...WHATSAPP_AI_TOOL_DECLARATIONS, ...extras.declaracoes] : WHATSAPP_AI_TOOL_DECLARATIONS;
  const segLower = String(channelSegment(channel.configuracao, persona) || '').toLowerCase();
  const isSupplements = segLower === 'suplementos' || persona?.id === 'stallone';
  const isSports = segLower === 'esporte' || persona?.id === 'agro_open';
  const isBarbershop = segLower === 'barbearia' || persona?.id === 'trex' || (!isSupplements && !isSports && channel.configuracao?.capabilities?.manageAppointments !== false);

  const barbershopToolNames = new Set([
    'listar_servicos', 'listar_profissionais', 'consultar_disponibilidade', 'sugerir_proximos_horarios',
    'preparar_agendamento', 'preparar_remarcacao', 'preparar_cancelamento', 'consultar_meus_agendamentos',
    'confirmar_presenca', 'avisar_atraso', 'entrar_lista_espera', 'listar_planos', 'consultar_meu_plano',
    'consultar_agenda_dino_vip', 'consultar_beneficios_e_clube', 'calcular_pacote_frequencia'
  ]);
  const storeToolNames = new Set([
    'buscar_produtos', 'apresentar_produto', 'cotar_frete', 'preparar_pedido',
    'link_carrinho', 'link_pagamento_pedido', 'enviar_comprovante_pix', 'consultar_pagamentos',
    'preparar_cancelamento_pedido'
  ]);

  const baseTools = allDecls.filter((t) => {
    if (barbershopToolNames.has(t.name) && !isBarbershop) return false;
    if (storeToolNames.has(t.name) && !isSupplements && channel.configuracao?.capabilities?.operateStore === false) return false;
    return true;
  });"""

code = code.replace(old_tools_call, new_tools_call)

with open('app/core/whatsapp-ai.js', 'w', encoding='utf8') as f:
    f.write(code)

print("app/core/whatsapp-ai.js atualizado com sucesso!")
