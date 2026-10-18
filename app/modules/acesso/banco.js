// Utilitários de banco compartilhados pelos módulos do Kytto Clube & Academia.
// `db` segue a API do app/db-pg.js: query, beginTransaction, queryInTransaction, commit, rollback.

export class ErroDominio extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Executa `fn(q)` numa transação; `q(text, values)` roda dentro dela. */
export async function transacao(db, fn) {
  const client = await db.beginTransaction();
  const q = (text, values = []) => db.queryInTransaction(client, text, values);
  try {
    const resultado = await fn(q);
    await db.commit(client);
    return resultado;
  } catch (error) {
    await db.rollback(client);
    throw error;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function exigirUuid(valor, campo = 'id') {
  const v = String(valor || '').trim();
  if (!UUID_RE.test(v)) throw new ErroDominio('INVALID_ID', `${campo} inválido`);
  return v.toLowerCase();
}

export function exigirTexto(valor, campo, { min = 1, max = 200 } = {}) {
  const v = String(valor ?? '').trim();
  if (v.length < min || v.length > max) {
    throw new ErroDominio('VALIDATION_ERROR', `${campo} deve ter entre ${min} e ${max} caracteres`);
  }
  return v;
}

export function exigirData(valor, campo) {
  const v = String(valor || '').trim();
  // confere a ida e volta: o Date do JS "rola" datas inexistentes (31/02 vira 03/03)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    throw new ErroDominio('VALIDATION_ERROR', `${campo} deve estar no formato AAAA-MM-DD`);
  }
  return v;
}

export function inteiroOpcional(valor, campo, { min = 1, max = 1000 } = {}) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ErroDominio('VALIDATION_ERROR', `${campo} deve ser inteiro entre ${min} e ${max}`);
  }
  return n;
}

/** Resposta HTTP padrão para erros (mesmo formato { error, code } do commerce). */
export function responderErro(res, error) {
  if (error instanceof ErroDominio) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  // erros de autenticação/permissão vindos da ligação com o server.js (status 4xx explícito)
  if (error && Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: error.message, code: error.code || 'REQUEST_ERROR' });
  }
  // erro de regra do resolvedor de clientes do Commerce (dado inválido, contato em conflito)
  if (error?.name === 'CommerceError') {
    const status = { VALIDATION_ERROR: 400, INVALID_ID: 400, CUSTOMER_REQUIRED: 400, CONTACT_CONFLICT: 409, CUSTOMER_NOT_FOUND: 404 }[error.code] || 400;
    return res.status(status).json({ error: error.message, code: error.code });
  }
  if (error && error.code === '23505') {
    return res.status(409).json({ error: 'Registro já existe.', code: 'CONFLICT' });
  }
  // sem o objeto inteiro: o `detail` do PostgreSQL pode conter dados pessoais
  console.error('[clube]', error?.code || 'erro', String(error?.message || '').slice(0, 200));
  return res.status(503).json({ error: 'Serviço temporariamente indisponível.', code: 'UNAVAILABLE' });
}
