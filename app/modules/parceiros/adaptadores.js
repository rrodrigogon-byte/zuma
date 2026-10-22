// Adaptadores das plataformas de benefício (item 2.1). Cada um traduz o webhook da plataforma
// para um evento interno único e faz a chamada de validação. Tudo que é específico da plataforma
// fica aqui; o resto do módulo não sabe se o check-in veio do Wellhub ou do TotalPass.
//
// ATENÇÃO (homologação): os formatos abaixo seguem a documentação pública de cada plataforma
// (Wellhub Access Control API e TotalPass "Validate Checkin"). Nomes de cabeçalho e de campos
// que só se confirmam no sandbox estão em CONFIG e podem ser ajustados por variável de ambiente
// sem mexer no código.
import { createHmac, timingSafeEqual, createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const CONFIG = {
  wellhub: {
    baseProducao: process.env.WELLHUB_API_BASE || 'https://api.partners.gympass.com',
    baseSandbox: process.env.WELLHUB_API_BASE_SANDBOX || 'https://apitesting.partners.gympass.com',
    caminhoValidar: '/access/v1/validate',
    cabecalhoAssinatura: (process.env.WELLHUB_SIGNATURE_HEADER || 'x-gympass-signature').toLowerCase(),
    algoritmoAssinatura: process.env.WELLHUB_SIGNATURE_ALG || 'sha1',
  },
  totalpass: {
    // a URL de validação vem no próprio webhook; só aceitamos hosts da TotalPass (anti-SSRF)
    hostsPermitidos: (process.env.TOTALPASS_HOSTS || 'totalpass.com,totalpass.com.br').split(',').map((h) => h.trim().toLowerCase()),
    caminhoValidacao: new RegExp(process.env.TOTALPASS_VALIDATION_PATH || '^/webhook_confirmations/[A-Za-z0-9_-]{8,200}$'),
  },
};

/* ------------------------------------------------------------------ */
/* Cifra da credencial da unidade e HMAC do documento                  */
/* ------------------------------------------------------------------ */

function chaveMestra() {
  const s = process.env.CLUBE_PARCEIROS_SECRET || '';
  if (s.length < 32) {
    const e = new Error('CLUBE_PARCEIROS_SECRET ausente ou curto (mínimo 32 caracteres)');
    e.code = 'PARCEIROS_SEGREDO_AUSENTE';
    throw e;
  }
  return createHash('sha256').update(`kytto-parceiros:${s}`).digest();
}

export function cifrar(texto) {
  if (texto === null || texto === undefined || texto === '') return null;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chaveMestra(), iv);
  const dados = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${dados.toString('base64url')}`;
}

export function decifrar(valor) {
  if (!valor) return null;
  const [v, iv, tag, dados] = String(valor).split('.');
  if (v !== 'v1') throw new Error('formato de credencial desconhecido');
  const d = createDecipheriv('aes-256-gcm', chaveMestra(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(dados, 'base64url')), d.final()]).toString('utf8');
}

/** CPF vira HMAC (só serve para reconhecer a mesma pessoa; não dá para recuperar o número). */
export function hmacDocumento(documento) {
  const n = String(documento || '').replace(/\D/g, '');
  if (n.length < 11) return null;
  return createHmac('sha256', chaveMestra()).update(`doc:${n}`).digest('hex');
}

const sha256 = (t) => createHash('sha256').update(String(t)).digest('hex');
const igualSeguro = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
const telefoneLimpo = (t) => {
  const n = String(t || '').replace(/\D/g, '');
  return n.length >= 10 ? n.slice(-13) : null;
};

/* ------------------------------------------------------------------ */
/* Wellhub                                                             */
/* ------------------------------------------------------------------ */

export const wellhub = {
  plataforma: 'wellhub',

  /** Assinatura HMAC do corpo cru com o segredo do webhook do parceiro (WELLHUB_WEBHOOK_SECRET). */
  assinaturaValida(corpoCru, cabecalhos, segredo = process.env.WELLHUB_WEBHOOK_SECRET) {
    if (!segredo) return false;
    const recebida = String(cabecalhos[CONFIG.wellhub.cabecalhoAssinatura] || '').replace(/^sha(1|256)=/i, '').trim();
    if (!recebida) return false;
    const esperada = createHmac(CONFIG.wellhub.algoritmoAssinatura, segredo).update(corpoCru).digest('hex');
    return igualSeguro(recebida.toLowerCase(), esperada);
  },

  /**
   * Webhook de check-in → evento interno. Aceita o envelope { event_type, event_data } e campos
   * equivalentes em nível raiz (variações vistas entre sandbox e produção).
   */
  lerCheckin(corpo = {}) {
    const tipo = String(corpo.event_type || corpo.type || '').toLowerCase();
    if (tipo && !['checkin', 'check-in', 'check_in', 'checkin_created'].includes(tipo)) return { ignorar: true, motivo: `evento ${tipo}` };
    const d = corpo.event_data || corpo.data || corpo;
    const u = d.user || {};
    const gym = d.gym || {};
    const pessoaExterna = String(u.unique_token || u.gympass_id || u.id || '').trim();
    const gymId = String(gym.id ?? d.gym_id ?? '').trim();
    if (!pessoaExterna || !gymId) return { invalido: true, motivo: 'sem unique_token ou gym id' };
    // identificador estável do evento: id do evento, ou pessoa + instante do check-in. Sem nenhum dos
    // dois o evento é recusado (gerar um id na chegada transformaria cada reentrega num check-in novo)
    const idEvento = String(corpo.event_id || corpo.id || d.event_id || d.checkin_id || d.id || '').trim();
    const instante = d.timestamp ? new Date(typeof d.timestamp === 'number' && d.timestamp < 1e12 ? d.timestamp * 1000 : d.timestamp) : null;
    const instanteValido = instante && !Number.isNaN(instante.getTime());
    if (!idEvento && !instanteValido) return { invalido: true, motivo: 'evento sem id nem timestamp' };
    const em = instanteValido ? instante : new Date();
    return {
      plataforma: 'wellhub',
      contaExterna: gymId,
      eventId: idEvento ? String(idEvento) : `${pessoaExterna}:${Math.floor(em.getTime() / 1000)}`,
      idExterno: idEvento ? `evt:${idEvento}` : `${pessoaExterna}:${Math.floor(em.getTime() / 1000)}`,
      pessoaExterna,
      nome: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.name || 'Aluno Wellhub',
      email: u.email || null,
      telefone: telefoneLimpo(u.phone_number || u.phone),
      documento: null,
      produto: String(gym.product?.id ?? gym.product?.description ?? d.product_id ?? '*'),
      recebidoEm: em,
      expiraEm: null, // definido pela validade da conta (padrão 20 min)
      validacao: null,
    };
  },

  async validar({ conta, checkin, fetch: f = fetch, token = process.env.WELLHUB_API_TOKEN }) {
    if (!token) return { resultado: 'erro', erro: 'WELLHUB_API_TOKEN não configurado', tentarDeNovo: false };
    const base = conta.ambiente === 'producao' ? CONFIG.wellhub.baseProducao : CONFIG.wellhub.baseSandbox;
    try {
      const r = await f(`${base}${CONFIG.wellhub.caminhoValidar}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-gym-id': String(conta.id_externo) },
        body: JSON.stringify({ gympass_id: checkin.pessoa_externa }),
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      if (r.status >= 300 && r.status < 400) return { resultado: 'erro', erro: `redirecionamento HTTP ${r.status} recusado`, tentarDeNovo: false };
      const corpo = await r.json().catch(() => ({}));
      if (r.ok) return { resultado: 'validado', resposta: resumir(corpo) };
      if (r.status === 429 || r.status >= 500) return { resultado: 'erro', erro: `HTTP ${r.status}`, tentarDeNovo: true, resposta: resumir(corpo) };
      return { resultado: 'negado', erro: mensagemErro(corpo, r.status), tentarDeNovo: false, resposta: resumir(corpo) };
    } catch (error) {
      return { resultado: 'erro', erro: String(error?.name === 'TimeoutError' ? 'tempo esgotado' : error?.message || error).slice(0, 200), tentarDeNovo: true };
    }
  },
};

/* ------------------------------------------------------------------ */
/* TotalPass                                                           */
/* ------------------------------------------------------------------ */

export function hostTotalpassPermitido(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    const host = u.hostname.toLowerCase();
    if (!CONFIG.totalpass.hostsPermitidos.some((h) => host === h || host.endsWith(`.${h}`))) return false;
    // só o formato documentado da URL de validação (token de uso único no fim)
    return CONFIG.totalpass.caminhoValidacao.test(u.pathname) && !u.search;
  } catch { return false; }
}

export const totalpass = {
  plataforma: 'totalpass',

  /** Webhook CHECK_IN_CREATED → evento interno. O token de validação de uso único vem em `endpoint`. */
  lerCheckin(corpo = {}) {
    const tipo = String(corpo.type || corpo.event || '').toUpperCase();
    if (tipo && tipo !== 'CHECK_IN_CREATED') return { ignorar: true, motivo: `evento ${tipo}` };
    const u = corpo.user || {};
    const c = corpo.check_in || {};
    const place = corpo.place || {};
    const endpoint = String(corpo.endpoint || '');
    if (!endpoint || !hostTotalpassPermitido(endpoint)) return { invalido: true, motivo: 'endpoint de validação ausente ou fora do domínio da TotalPass' };
    const pessoaExterna = String(u.code || '').trim();
    if (!pessoaExterna) return { invalido: true, motivo: 'sem código do usuário' };
    const recebido = c.started_at ? new Date(c.started_at) : new Date();
    const expira = c.expires_at ? new Date(c.expires_at) : null;
    return {
      plataforma: 'totalpass',
      contaExterna: String(place.code || place.place || '').trim(),
      eventId: String(corpo.event_id || corpo.eventId || corpo.id || '').trim() || sha256(endpoint),
      idExterno: sha256(endpoint), // o token é de uso único: identifica o check-in sem guardá-lo em claro
      pessoaExterna,
      nome: u.name || 'Aluno TotalPass',
      email: u.email || null,
      telefone: telefoneLimpo(u.phone),
      documento: String(u.document_type || 'cpf').toLowerCase() === 'cpf' ? u.document_number : null,
      produto: String(c.plan_code || '*'),
      recebidoEm: Number.isNaN(recebido.getTime()) ? new Date() : recebido,
      expiraEm: expira && !Number.isNaN(expira.getTime()) ? expira : null,
      validacao: endpoint,
    };
  },

  async validar({ checkin, credencial, fetch: f = fetch, partnerKey = process.env.TOTALPASS_PARTNER_API_KEY }) {
    const url = checkin.validacao_url;
    if (!url || !hostTotalpassPermitido(url)) return { resultado: 'negado', erro: 'URL de validação inválida', tentarDeNovo: false };
    const cab = { 'content-type': 'application/json' };
    if (credencial) cab.authorization = `Bearer ${credencial}`;
    if (partnerKey) cab['x-partner-api-key'] = partnerKey;
    try {
      // redirect manual: um 3xx nunca leva as chaves da academia e do Kytto para outro endereço
      const r = await f(url, { method: 'POST', headers: cab, body: '{}', redirect: 'manual', signal: AbortSignal.timeout(8000) });
      if (r.status >= 300 && r.status < 400) return { resultado: 'erro', erro: `redirecionamento HTTP ${r.status} recusado`, tentarDeNovo: false };
      const corpo = await r.json().catch(() => ({}));
      if (r.ok) return { resultado: 'validado', resposta: resumir(corpo) };
      const msg = mensagemErro(corpo, r.status);
      if (r.status === 422 && /expir/i.test(msg)) return { resultado: 'expirado', erro: msg, tentarDeNovo: false, resposta: resumir(corpo) };
      if (r.status === 429 || r.status >= 500) return { resultado: 'erro', erro: `HTTP ${r.status}`, tentarDeNovo: true, resposta: resumir(corpo) };
      return { resultado: 'negado', erro: msg, tentarDeNovo: false, resposta: resumir(corpo) };
    } catch (error) {
      return { resultado: 'erro', erro: String(error?.name === 'TimeoutError' ? 'tempo esgotado' : error?.message || error).slice(0, 200), tentarDeNovo: true };
    }
  },
};

/**
 * Reserva de aula vinda da Booking API da plataforma. A grade é publicada com o id da ocorrência
 * do Kytto como "external id" da aula, então a reserva volta apontando para ela.
 * Formatos a confirmar na homologação; aceitamos as variações mais comuns.
 */
function lerReservaGenerica(plataforma, corpo = {}) {
  const tipo = String(corpo.event_type || corpo.type || '').toLowerCase();
  const cancelamento = /cancel/.test(tipo);
  const d = corpo.event_data || corpo.data || corpo;
  const u = d.user || {};
  const aula = d.slot || d.occurrence || d.class || {};
  const ocorrenciaId = String(aula.external_id || aula.externalId || d.external_id || '').trim();
  const pessoaExterna = String(u.unique_token || u.gympass_id || u.code || u.id || '').trim();
  const idReserva = String(d.booking_number || d.booking?.code || d.booking_id || d.id || '').trim();
  if (!ocorrenciaId || !pessoaExterna || !idReserva) return { invalido: true, motivo: 'reserva sem aula, pessoa ou identificador' };
  return {
    plataforma, cancelamento, ocorrenciaId, pessoaExterna, idReserva, eventId: idReserva,
    nome: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.name || `Aluno ${plataforma === 'wellhub' ? 'Wellhub' : 'TotalPass'}`,
    email: u.email || null, telefone: telefoneLimpo(u.phone_number || u.phone), documento: u.document_number || null,
  };
}
wellhub.lerReserva = (corpo) => lerReservaGenerica('wellhub', corpo);
totalpass.lerReserva = (corpo) => lerReservaGenerica('totalpass', corpo);

export const ADAPTADORES = { wellhub, totalpass };

function mensagemErro(corpo, status) {
  const m = corpo?.message || corpo?.error?.message || corpo?.error || corpo?.errors?.[0]?.message || corpo?.detail;
  return String(m || `HTTP ${status}`).slice(0, 200);
}

/** Guarda só o essencial da resposta (sem dados pessoais repetidos). */
function resumir(corpo) {
  if (!corpo || typeof corpo !== 'object') return null;
  const out = {};
  for (const k of ['status', 'message', 'code', 'id', 'validated_at', 'check_in_id', 'error']) if (corpo[k] !== undefined) out[k] = corpo[k];
  return Object.keys(out).length ? out : null;
}
