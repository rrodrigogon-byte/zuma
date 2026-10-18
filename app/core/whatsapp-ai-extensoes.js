// Extensões da IA do WhatsApp: módulos de fora do núcleo (ex.: Clube & Academia) registram
// ferramentas próprias e um aviso de mensagem recebida sem mexer na lista fixa do
// whatsapp-ai-tools.js. Cada extensão só aparece para as empresas em que está ativa, então a
// IA de uma barbearia ou loja não vê as ferramentas da academia.
//
// Uma extensão é { nome, declaracoes, ativaPara, executar, aoReceber?, orientacao? }:
//   declaracoes  ferramentas no formato Gemini (tipos em MAIÚSCULAS), nomes com prefixo próprio
//   ativaPara    async ({ empresaId, lojaId }) => boolean (fica em cache por 5 min)
//   executar     async (contexto, nome, args) => resultado; o contexto é o da conversa autenticada
//   aoReceber    async ({ empresaId, lojaId, phone, text }) => void; chamado a cada mensagem do cliente
//   orientacao   texto curto somado às instruções da IA quando a extensão está ativa

const extensoes = new Map();
const cacheAtiva = new Map();
const CACHE_MS = 5 * 60 * 1000;
const NOME_FERRAMENTA = /^[a-z][a-z0-9_]{2,63}$/;

export function registrarExtensaoWhatsappAi(extensao, { nomesReservados = [] } = {}) {
  const { nome, declaracoes = [], ativaPara, executar } = extensao || {};
  if (!nome || typeof ativaPara !== 'function' || typeof executar !== 'function') {
    throw new Error('extensão da IA precisa de nome, ativaPara e executar');
  }
  const reservados = new Set(nomesReservados);
  for (const outra of extensoes.values()) {
    if (outra.nome === nome) continue;
    for (const d of outra.declaracoes) reservados.add(d.name);
  }
  for (const d of declaracoes) {
    if (!NOME_FERRAMENTA.test(String(d?.name || ''))) throw new Error(`nome de ferramenta inválido: ${d?.name}`);
    if (reservados.has(d.name)) throw new Error(`ferramenta já existe: ${d.name}`);
  }
  extensoes.set(nome, { ...extensao, declaracoes: [...declaracoes], nomes: new Set(declaracoes.map((d) => d.name)) });
  for (const chave of [...cacheAtiva.keys()]) if (chave.startsWith(`${nome}:`)) cacheAtiva.delete(chave);
}

/** Só para testes. */
export function limparExtensoesWhatsappAi() {
  extensoes.clear();
  cacheAtiva.clear();
}

async function estaAtiva(extensao, escopo) {
  const chave = `${extensao.nome}:${escopo.empresaId}:${escopo.lojaId || ''}`;
  const salvo = cacheAtiva.get(chave);
  if (salvo && Date.now() - salvo.em < CACHE_MS) return salvo.ativa;
  let ativa = false;
  try { ativa = Boolean(await extensao.ativaPara(escopo)); } catch { ativa = false; }
  cacheAtiva.set(chave, { ativa, em: Date.now() });
  if (cacheAtiva.size > 5000) cacheAtiva.clear();
  return ativa;
}

/**
 * Igual ao núcleo: valores devolvidos pela ferramenta podem ser citados na resposta (a checagem
 * de preço sem fonte os aceita) e o link de pagamento/passe gerado sempre chega ao cliente.
 */
function registrarSaida(alvo, resultado) {
  if (!resultado || typeof resultado !== 'object') return;
  if (Array.isArray(alvo?.toolResults)) alvo.toolResults.push(resultado);
  if (!Array.isArray(alvo?.toolLinks)) return;
  for (const chave of ['link', 'linkPagamento']) {
    const url = String(resultado[chave] || '').trim();
    if (/^https:\/\/\S+$/i.test(url) && !alvo.toolLinks.includes(url)) alvo.toolLinks.push(url);
  }
}

/**
 * Ferramentas extras para esta conversa.
 * @returns {{ declaracoes: object[], orientacao: string, envolver: (executor) => executor }}
 */
export async function ferramentasExtrasWhatsappAi(contexto = {}) {
  const ativas = [];
  if (contexto.empresaId && !['gestao', 'lancamentos'].includes(contexto.channelType)) {
    for (const extensao of extensoes.values()) {
      if (await estaAtiva(extensao, { empresaId: contexto.empresaId, lojaId: contexto.lojaId })) ativas.push(extensao);
    }
  }
  const declaracoes = ativas.flatMap((e) => e.declaracoes);
  const orientacao = ativas.map((e) => String(e.orientacao || '').trim()).filter(Boolean).join(' ');
  // `alvo`: contexto desta tentativa (principal, reserva ou nova volta), onde ficam os resultados
  const envolver = (executor, alvo = contexto) => {
    if (!ativas.length) return executor;
    return async (nome, args = {}) => {
      const dona = ativas.find((e) => e.nomes.has(nome));
      if (!dona) return executor(nome, args);
      try {
        const resultado = await dona.executar(alvo, nome, args || {});
        registrarSaida(alvo, resultado);
        return resultado;
      } catch (error) {
        console.warn(`[WhatsApp AI] extensão ${dona.nome} falhou em ${nome}:`, String(error?.message || error).slice(0, 300));
        return { ok: false, erro: 'Não consegui consultar agora. Tente de novo em instantes.' };
      }
    };
  };
  return { declaracoes, orientacao, envolver };
}

/** Avisa as extensões ativas de uma mensagem do cliente. Nunca derruba o atendimento. */
export async function notificarMensagemWhatsappAi(dados = {}) {
  if (!dados.empresaId) return;
  for (const extensao of extensoes.values()) {
    if (typeof extensao.aoReceber !== 'function') continue;
    try {
      if (!(await estaAtiva(extensao, { empresaId: dados.empresaId, lojaId: dados.lojaId }))) continue;
      await extensao.aoReceber(dados);
    } catch (error) {
      console.warn(`[WhatsApp AI] extensão ${extensao.nome} não processou a mensagem:`, String(error?.message || error).slice(0, 300));
    }
  }
}
