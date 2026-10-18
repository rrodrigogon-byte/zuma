// Textos base da régua de retenção (item 4.1), por gatilho e por tom.
// Cada tom tem variações; a escolhida depende do aluno e do episódio, então a mesma pessoa não
// recebe sempre a mesma frase e a escolha é estável (reenvio após falha usa o mesmo texto).
// Marcadores: {nome} {valor} {link} {dias} {mimo} {oferta} {academia} {data}
import { createHash } from 'node:crypto';

export const TONS = ['formal', 'proximo', 'divertido'];

export const TEXTOS_BASE = {
  faltante_leve: {
    formal: [
      'Olá, {nome}. Notamos que você não vem à academia há {dias} dias. Está tudo bem? Se quiser, reservo um horário para você.',
      '{nome}, sentimos sua falta nos últimos {dias} dias. Posso ajudar a encaixar um treino na sua semana?',
    ],
    proximo: [
      'Oi, {nome}! Sentimos sua falta por aqui, já são {dias} dias. Tá tudo bem? Quer que eu reserve um horário pra você?',
      '{nome}, faz {dias} dias que você não aparece. Bora voltar? Me diz um horário que eu já deixo reservado.',
    ],
    divertido: [
      '{nome}, os aparelhos estão perguntando por você! 😄 {dias} dias sem treino. Quer que eu guarde um horário?',
      'Ei, {nome}! {dias} dias longe da academia… seu treino está com saudade. Te reservo uma vaga?',
    ],
  },
  faltante_serio: {
    formal: [
      'Olá, {nome}. Faz {dias} dias que você não treina conosco. Aconteceu algo? Podemos ajustar horário, plano ou congelar por um período.',
      '{nome}, percebemos {dias} dias sem treino. Se algo mudou na sua rotina, temos opções: troca de horário, de plano ou congelamento.',
    ],
    proximo: [
      'Oi, {nome}. Já são {dias} dias sem te ver por aqui. Aconteceu alguma coisa? Se a rotina apertou, dá pra trocar o horário, o plano ou congelar um tempo.',
      '{nome}, tudo certo por aí? {dias} dias sem treino. Me conta o que está pegando que a gente encontra um jeito.',
    ],
    divertido: [
      '{nome}, {dias} dias! A gente já ia mandar um grupo de busca 😅 Tá tudo bem? Dá pra trocar horário, plano ou dar uma pausa.',
      'Oi, {nome}! Sumiu, hein? {dias} dias. Se a vida corrida pegou, me fala que a gente ajeita horário, plano ou congela.',
    ],
  },
  risco_cancelar: {
    formal: [
      'Olá, {nome}. Que tal uma reavaliação com o professor para renovar seu treino? Posso agendar para você.',
      '{nome}, gostaríamos de convidá-lo para um treino novo, montado pelo professor. Quer agendar?',
    ],
    proximo: [
      'Oi, {nome}! Bora dar uma renovada no treino? Posso marcar uma avaliação com o professor essa semana.',
      '{nome}, que tal um treino novo pra animar? Te encaixo com o professor quando ficar bom pra você.',
    ],
    divertido: [
      '{nome}, treino repetido cansa, né? 😄 Bora montar um novo com o professor? Te marco um horário.',
      'Ei, {nome}! Hora de subir de nível: treino novinho com o professor. Quer que eu agende?',
    ],
  },
  vencimento: {
    formal: [
      'Olá, {nome}. Sua mensalidade de {valor} vence em {dias} dia(s). {link}',
      '{nome}, lembrete: a mensalidade de {valor} vence em {dias} dia(s). {link}',
    ],
    proximo: [
      'Oi, {nome}! Sua mensalidade de {valor} vence em {dias} dia(s). {link}',
      '{nome}, passando pra lembrar: a mensalidade ({valor}) vence em {dias} dia(s). {link}',
    ],
    divertido: [
      'Oi, {nome}! Só um toque: a mensalidade de {valor} vence em {dias} dia(s). {link}',
      '{nome}, aviso amigo: mensalidade de {valor} vence em {dias} dia(s). {link}',
    ],
  },
  inadimplente: {
    formal: [
      'Olá, {nome}. Consta em aberto a mensalidade, com {dias} dia(s) de atraso, no valor atualizado de {valor}. {link} Se já pagou, desconsidere.',
      '{nome}, identificamos mensalidade em aberto há {dias} dia(s), valor atualizado {valor}. {link} Se preferir, podemos combinar o pagamento.',
    ],
    proximo: [
      'Oi, {nome}. Ficou em aberto a mensalidade ({dias} dia(s) de atraso), valor atualizado {valor}. {link} Se já pagou, pode ignorar.',
      '{nome}, tudo bem? A mensalidade está em aberto há {dias} dia(s), valor atualizado {valor}. {link} Se precisar, a gente combina o melhor jeito.',
    ],
    divertido: [
      'Oi, {nome}! A mensalidade ficou pra trás ({dias} dia(s)), valor atualizado {valor}. {link} Se já pagou, desconsidera 😉',
      '{nome}, lembrete sem drama: mensalidade em aberto há {dias} dia(s), {valor}. {link} Se quiser, a gente combina.',
    ],
  },
  renovacao: {
    formal: [
      'Olá, {nome}. Seu plano termina em {dias} dias. Preparamos uma condição para a renovação: {oferta}. Posso enviar o contrato?',
      '{nome}, seu plano vence em {dias} dias. Para renovar, temos: {oferta}. Deseja seguir?',
    ],
    proximo: [
      'Oi, {nome}! Seu plano termina em {dias} dias. Pra você continuar com a gente: {oferta}. Te mando o contrato?',
      '{nome}, faltam {dias} dias pro fim do seu plano. Separei uma condição pra renovar: {oferta}. Bora?',
    ],
    divertido: [
      '{nome}, faltam {dias} dias pro fim do plano! Pra não parar agora: {oferta}. Renovamos? 💪',
      'Oi, {nome}! Contagem regressiva: {dias} dias de plano. Condição especial pra renovar: {oferta}. Topa?',
    ],
  },
  aniversario: {
    formal: ['Feliz aniversário, {nome}! A equipe da academia deseja um ótimo dia. {mimo}', 'Parabéns, {nome}! Desejamos um excelente aniversário. {mimo}'],
    proximo: ['Feliz aniversário, {nome}! 🎉 Que seu dia seja incrível. {mimo}', 'Parabéns, {nome}! Muita saúde e muitos treinos pela frente. {mimo}'],
    divertido: ['Parabéns, {nome}! 🎂 Hoje o treino pode ser de bolo. {mimo}', 'Feliz aniversário, {nome}! 🎉 Mais um ano mais forte. {mimo}'],
  },
  prospect: {
    formal: [
      'Olá, {nome}. Ficou alguma dúvida sobre os planos? Posso ajudar a escolher e já deixar sua matrícula pronta.',
      '{nome}, obrigado pelo interesse. Quer que eu envie as opções de plano e a matrícula?',
    ],
    proximo: [
      'Oi, {nome}! Ficou alguma dúvida sobre os planos? Te ajudo a escolher e já deixo tudo pronto pra você começar.',
      '{nome}, e aí, bora começar? Me diz o horário que você prefere que eu te mostro o plano ideal.',
    ],
    divertido: [
      'Oi, {nome}! Ainda pensando? 😄 Me fala seu objetivo que eu te mostro o plano certo.',
      '{nome}, o primeiro treino é o mais difícil, depois vicia! Quer que eu deixe sua matrícula pronta?',
    ],
  },
  ex_aluno: {
    formal: ['Olá, {nome}. Temos novidades na academia e uma condição para o seu retorno: {oferta}. Gostaria de voltar?', '{nome}, sentimos sua falta. Para o seu retorno: {oferta}. Posso reativar sua matrícula?'],
    proximo: ['Oi, {nome}! Tem novidade por aqui e uma condição pra você voltar: {oferta}. Bora?', '{nome}, que tal voltar a treinar com a gente? {oferta}. Te ajudo a reativar.'],
    divertido: ['{nome}, a academia não é a mesma sem você 😄 Condição de volta: {oferta}. Topa?', 'Oi, {nome}! Bateu saudade? A gente também. {oferta}. Bora voltar?'],
  },
  parceiro_frequente: {
    formal: ['Olá, {nome}. Você já treinou {dias} vezes este mês conosco. Temos um plano próprio com condição de boas-vindas: {oferta}. Deseja conhecer?', '{nome}, notamos sua frequência ({dias} treinos no mês). Um plano direto conosco pode valer a pena: {oferta}.'],
    proximo: ['Oi, {nome}! {dias} treinos este mês, mandou bem! Tenho um plano direto com a academia, com condição de boas-vindas: {oferta}. Quer ver?', '{nome}, você já é de casa: {dias} treinos no mês. Que tal um plano próprio? {oferta}.'],
    divertido: ['{nome}, {dias} treinos no mês! Você já é praticamente da equipe 😄 Plano próprio com condição especial: {oferta}. Bora?', 'Oi, {nome}! Com {dias} treinos no mês, vale um plano só seu: {oferta}. Quer?'],
  },
  pos_aula: {
    formal: ['Olá, {nome}. Como foi sua primeira semana? De 0 a 10, quanto você recomendaria a academia?', '{nome}, sua opinião é importante: de 0 a 10, como avalia sua primeira semana conosco?'],
    proximo: ['Oi, {nome}! Como foi a primeira semana? De 0 a 10, quanto você indicaria a gente pra um amigo?', '{nome}, uma pergunta rápida: de 0 a 10, como foi sua primeira semana aqui?'],
    divertido: ['{nome}, primeira semana concluída! 💪 De 0 a 10, quanto você indicaria a academia?', 'Oi, {nome}! Sobreviveu à primeira semana? 😄 De 0 a 10, como foi?'],
  },
};

/** Escolhe a variação de forma estável (mesmo aluno + mesmo episódio = mesma frase). */
export function escolherVariacao(lista, semente) {
  if (!Array.isArray(lista) || !lista.length) return '';
  const h = createHash('sha256').update(String(semente)).digest();
  return lista[h.readUInt32BE(0) % lista.length];
}

/** Preenche os marcadores e limpa espaços duplos de marcadores vazios. */
export function preencher(texto, dados = {}) {
  return String(texto)
    .replace(/\{(\w+)\}/g, (_, k) => (dados[k] === undefined || dados[k] === null ? '' : String(dados[k])))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

/**
 * Texto final do disparo. `personalizados` (da régua da academia) pode ser uma lista de variações
 * ou um objeto por tom; sem ele, usa os textos base.
 */
export function montarTexto(gatilho, { tom = 'proximo', personalizados = null, semente = '', dados = {} } = {}) {
  let lista = null;
  if (Array.isArray(personalizados) && personalizados.length) lista = personalizados;
  else if (personalizados && Array.isArray(personalizados[tom]) && personalizados[tom].length) lista = personalizados[tom];
  else lista = TEXTOS_BASE[gatilho]?.[tom] || TEXTOS_BASE[gatilho]?.proximo;
  if (!lista) throw new Error(`gatilho sem texto: ${gatilho}`);
  return preencher(escolherVariacao(lista, `${semente}:${gatilho}`), dados);
}

export const formatarReais = (v) => (v === null || v === undefined || Number.isNaN(Number(v))
  ? ''
  : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
