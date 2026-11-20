with open('app/dino-carteira-clientes.js', 'r', encoding='utf-8') as f:
    backend_content = f.read()

target = """export function gerarMensagemWhatsappRetorno({
  clienteNome = '',
  barbeiroApelido = 'Barbeiro',
  servicoFavorito = 'corte',
  diasSemRetorno = 0,
  linkAgendamento = 'https://kytto.com.br/clube-vip',
} = {}) {"""

assert target in backend_content, "target not found"

replacement = """/**
 * Resolve marcações de Spintax {opcao1|opcao2|opcao3} para variação dinâmica anti-bloqueio.
 */
export function resolverSpintax(texto, aleatorio = true) {
  if (!texto) return '';
  return texto.replace(/\\{([^{}]+)\\}/g, (_, opcoes) => {
    const lista = opcoes.split('|');
    if (!aleatorio) return lista[0];
    const indice = Math.floor(Math.random() * lista.length);
    return lista[indice];
  });
}

/**
 * Modelos de mensagem com Spintax oficial KyttoIA para reativação em lote.
 */
export function obterModelosReativacaoSpintax({
  clienteNome = '',
  barbeiroApelido = 'Dino',
  servicoFavorito = 'corte',
  diasSemRetorno = 0,
  linkAgendamento = 'https://kytto.com.br/agendar/dino',
} = {}) {
  const primeiroNome = String(clienteNome).trim().split(/\\s+/)[0] || 'amigo';
  const tempoTexto = diasSemRetorno > 0 ? `já faz ${diasSemRetorno} dias do seu último ${servicoFavorito}` : 'já está no momento de renovar o visual';

  return [
    {
      id: 'amigavel_titular',
      nome: 'Amigável & Barbeiro Titular (Mais Recomendado)',
      descricao: 'Tom caloroso e direto assinado pelo barbeiro de costume do cliente.',
      template: `{Fala|Olá|E aí} ${primeiroNome}, tudo bem? Aqui é o ${barbeiroApelido} da Barbearia Dino! 💈\\n\\nVi aqui que ${tempoTexto}. {Bora|Vamos} dar aquele talento no visual essa semana?\\n\\nJá separei sua cadeira! {Pode me avisar por aqui|Basta responder aqui} ou escolher seu melhor horário direto no link:\\n${linkAgendamento}\\n\\n*(Caso não queira receber avisos de agenda, responda PARAR)*`,
    },
    {
      id: 'vip_fidelidade',
      nome: 'Clube VIP & Experiência Premium',
      descricao: 'Convite exclusivo valorizando o cliente especial da casa.',
      template: `{Olá|Prezado} ${primeiroNome}, {tudo bem?|como vai?} Aqui é da equipe da Barbearia Dino com o ${barbeiroApelido}! ✂️\\n\\nO ${barbeiroApelido} sentiu sua falta por aqui e reservou uma condição especial para sua volta.\\n\\nGaranta seu atendimento de ${servicoFavorito} com todo conforto:\\n${linkAgendamento}\\n\\n*(Responda SAIR para cancelar lembretes)*`,
    },
    {
      id: 'alerta_estilo',
      nome: 'Alerta de Estilo & Ciclo de Crescimento',
      descricao: 'Focado na precisão do corte e manutenção da barba e cabelo.',
      template: `{E aí|Fala} ${primeiroNome}! O ${barbeiroApelido} pediu para te mandar um toque rápido: seu ${servicoFavorito} já está pedindo aquele alinhamento de respeito! 🚀\\n\\nAgenda aberta para os próximos dias no link:\\n${linkAgendamento}\\n\\n*(Responda CANCELAR para não receber avisos)*`,
    },
  ];
}

/**
 * Avalia conformidade anti-bloqueio com as diretrizes da Meta WhatsApp.
 */
export function avaliarConformidadeMetaWhatsapp(texto) {
  const txt = String(texto || '').toLowerCase();
  const temOptOut = txt.includes('parar') || txt.includes('sair') || txt.includes('cancelar') || txt.includes('descadastr');
  const temLinkValido = txt.includes('kytto.com.br');
  const palavrasSpam = ['grátis', 'ganhe dinheiro', 'dinheiro fácil', '100% free', 'renda extra', 'urgente compre agora'];
  const spamEncontrado = palavrasSpam.filter((p) => txt.includes(p));
  const tamanhoOk = texto.length <= 600;

  return {
    valido: temOptOut && spamEncontrado.length === 0 && tamanhoOk,
    temOptOut,
    temLinkValido,
    spamEncontrado,
    tamanhoCaracteres: texto.length,
    recomendacoes: [
      !temOptOut ? 'Incluir cláusula obrigatória de opt-out (ex: \"Responda PARAR para sair\")' : null,
      !temLinkValido ? 'Utilizar domínio oficial seguro https://kytto.com.br para evitar filtros' : null,
      spamEncontrado.length > 0 ? `Remover termos sensíveis a spam: ${spamEncontrado.join(', ')}` : null,
    ].filter(Boolean),
  };
}

export function gerarMensagemWhatsappRetorno({
  clienteNome = '',
  barbeiroApelido = 'Barbeiro',
  servicoFavorito = 'corte',
  diasSemRetorno = 0,
  linkAgendamento = 'https://kytto.com.br/agendar/dino',
} = {}) {
  const primeiroNome = String(clienteNome).trim().split(/\\s+/)[0] || 'amigo';
  const tempoTexto = diasSemRetorno > 0 ? `já faz ${diasSemRetorno} dias do seu último ${servicoFavorito}` : 'já está na hora de renovar seu visual';
  
  const templateSpintax = `{Fala|Olá|E aí} ${primeiroNome}, tudo bem? Aqui é o ${barbeiroApelido} da Barbearia Dino! 💈\\n\\nVi aqui que ${tempoTexto}. {Bora|Vamos} dar aquele talento no visual essa semana?\\n\\nJá separei sua cadeira! {Pode me avisar por aqui|Basta responder aqui} ou escolher o melhor horário direto no link:\\n${linkAgendamento}\\n\\n*(Caso prefira não receber lembretes de agenda, responda PARAR)*`;
  
  return resolverSpintax(templateSpintax, true);
}

function _antiga_gerarMensagemWhatsappRetorno({"""

backend_content = backend_content.replace(target, replacement)
with open('app/dino-carteira-clientes.js', 'w', encoding='utf-8') as f:
    f.write(backend_content)

print("Sucesso ao atualizar backend com Spintax e Opt-Out Meta!")
