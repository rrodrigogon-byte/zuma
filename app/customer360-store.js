// Persistência do Customer 360 no store JSON (mesmo arquivo da barbearia):
// notas internas, etiquetas, vínculos/separações de identidade e a
// anonimização dos registros da barbearia. Nada aqui toca o PostgreSQL.

import { db, save } from './db.js';
import { normalizePhone } from './core/customer-360.js';

const ANON_NAME = 'Titular anonimizado';
const MAX_NOTE = 1000;
const MAX_TAG = 32;
const MAX_TAGS = 12;

function text(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function now() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pairKey(a, b) {
  return [String(a), String(b)].sort().join('|');
}

function tenant(empresaId, create = true) {
  const root = db();
  if (!create && !root.customer360Kytto?.empresas?.[String(empresaId)]) return { notas: [], etiquetas: {}, vinculos: [], separacoes: [] };
  root.customer360Kytto ||= { empresas: {} };
  root.customer360Kytto.empresas ||= {};
  const key = String(empresaId || 'principal');
  const state = (root.customer360Kytto.empresas[key] ||= {});
  state.notas ||= [];
  state.etiquetas ||= {};
  state.vinculos ||= [];
  state.separacoes ||= [];
  return state;
}

function overlaps(list = [], refs = []) {
  return list.some((ref) => refs.includes(ref));
}

// ─────────────── vínculos de identidade ───────────────

export function identityRules(empresaId) {
  const state = tenant(empresaId, false);
  return {
    links: state.vinculos.map(({ a, b }) => ({ a, b })),
    separations: state.separacoes.map(({ a, b }) => ({ a, b })),
  };
}

export function linkRecords(empresaId, { a, b, motivo = '', operador = '' }) {
  if (!a || !b || a === b) throw Object.assign(new Error('Escolha dois cadastros diferentes para vincular.'), { status: 400 });
  const state = tenant(empresaId);
  const key = pairKey(a, b);
  state.separacoes = state.separacoes.filter((item) => pairKey(item.a, item.b) !== key);
  if (!state.vinculos.some((item) => pairKey(item.a, item.b) === key)) {
    state.vinculos.push({ id: newId('vin'), a, b, motivo: text(motivo, 240), por: text(operador, 160), em: now() });
  }
  save();
  return { a, b };
}

export function separateRecords(empresaId, { a, b, motivo = '', operador = '' }) {
  if (!a || !b || a === b) throw Object.assign(new Error('Escolha dois cadastros diferentes para separar.'), { status: 400 });
  const state = tenant(empresaId);
  const key = pairKey(a, b);
  state.vinculos = state.vinculos.filter((item) => pairKey(item.a, item.b) !== key);
  if (!state.separacoes.some((item) => pairKey(item.a, item.b) === key)) {
    state.separacoes.push({ id: newId('sep'), a, b, motivo: text(motivo, 240), por: text(operador, 160), em: now() });
  }
  save();
  return { a, b };
}

// ─────────────── notas e etiquetas ───────────────

export function listNotes(empresaId, refs = []) {
  return tenant(empresaId, false).notas
    .filter((note) => overlaps(note.refs, refs))
    .sort((x, y) => String(y.em).localeCompare(String(x.em)))
    .map(({ id, texto, autor, em, fixada }) => ({ id, texto, autor, em, fixada: Boolean(fixada) }));
}

export function addNote(empresaId, { refs, texto, autor, fixada = false }) {
  const body = String(texto ?? '').trim().slice(0, MAX_NOTE);
  if (body.length < 2) throw Object.assign(new Error('Escreva a anotação.'), { status: 400 });
  const note = { id: newId('nota'), refs: [...new Set(refs)], texto: body, autor: text(autor, 160), em: now(), fixada: Boolean(fixada) };
  tenant(empresaId).notas.push(note);
  save();
  return { id: note.id, texto: note.texto, autor: note.autor, em: note.em, fixada: note.fixada };
}

export function removeNote(empresaId, { refs, noteId, autor, isAdmin }) {
  const state = tenant(empresaId);
  const note = state.notas.find((item) => item.id === noteId && overlaps(item.refs, refs));
  if (!note) throw Object.assign(new Error('Anotação não encontrada.'), { status: 404 });
  if (!isAdmin && note.autor !== text(autor, 160)) throw Object.assign(new Error('Só o autor ou um administrador pode remover esta anotação.'), { status: 403 });
  state.notas = state.notas.filter((item) => item !== note);
  save();
  return true;
}

export function normalizeTags(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',');
  return [...new Set(list.map((tag) => text(tag, MAX_TAG).toLowerCase()).filter(Boolean))].slice(0, MAX_TAGS);
}

export function listTags(empresaId, refs = []) {
  const state = tenant(empresaId, false);
  return [...new Set(refs.flatMap((ref) => state.etiquetas[ref] || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function setTags(empresaId, { refs, canonicalRef, tags }) {
  const state = tenant(empresaId);
  const normalized = normalizeTags(tags);
  for (const ref of refs) delete state.etiquetas[ref];
  if (normalized.length) state.etiquetas[canonicalRef] = normalized;
  save();
  return normalized;
}

export function allTags(empresaId) {
  const state = tenant(empresaId, false);
  const counts = new Map();
  for (const tags of Object.values(state.etiquetas)) for (const tag of tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).map(([tag, total]) => ({ tag, total }));
}

export function tagsByRef(empresaId) {
  return { ...tenant(empresaId, false).etiquetas };
}

// ─────────────── histórico de acesso (trilha JSON) ───────────────

export function localAccessHistory(refs = [], limit = 50) {
  const entries = db().auditoria || [];
  return entries
    .filter((entry) => /CUSTOMER360/.test(String(entry.acao || '')) && refs.some((ref) => String(entry.detalhe || '').includes(`ref=${ref}`)))
    .slice(-limit)
    .reverse()
    .map((entry) => ({ em: entry.ts, usuario: entry.user, acao: String(entry.acao).replace(' CUSTOMER360', '').toLowerCase(), detalhe: String(entry.detalhe || '').replace(/ref=[^;]+;?\s*/, '') }));
}

// ─────────────── anonimização (barbearia) ───────────────

/**
 * Remove dados pessoais dos registros da barbearia do titular. Mantém valores,
 * datas e status (registros financeiros/fiscais têm guarda obrigatória), troca
 * nome e contato por marcador, zera consentimentos e apaga notas/etiquetas.
 */
export function anonymizeLocalCustomer(empresaId, { clientIds = [], phones = [], refs = [], operador = '' }) {
  const ids = new Set(clientIds.map(String));
  const phoneSet = new Set(phones.map(normalizePhone).filter(Boolean));
  const stamp = now();
  const counts = { clientes: 0, agendamentos: 0, comandas: 0, vendas: 0, filas: 0, planos: 0, fidelidade: 0, notas: 0, etiquetas: 0 };
  const root = db();

  const clientesStore = root.clientesKytto?.empresas?.[String(empresaId)]?.clientes || {};
  for (const cliente of Object.values(clientesStore)) {
    if (!ids.has(String(cliente.id))) continue;
    Object.assign(cliente, {
      nome: ANON_NAME, cpfCnpj: '', email: '', telefone: '', endereco: '', observacao: '',
      // Família, gostos, redes e aniversário também são dados pessoais do titular (e de terceiros).
      dataNascimento: '', aniversario: '', familia: [], familiaConsentimento: null, preferencias: {}, redesSociais: {},
      anonimizadoEm: stamp, atualizadoEm: stamp,
    });
    for (const canal of Object.keys(cliente.consentimentos || {})) {
      for (const finalidade of Object.keys(cliente.consentimentos[canal] || {})) {
        cliente.consentimentos[canal][finalidade] = { concedido: false, atualizadoEm: stamp, origem: 'anonimizacao_lgpd' };
      }
    }
    (cliente.consentimentoHistorico ||= []).unshift({ id: newId('cons'), canal: 'todos', finalidade: 'todas', concedido: false, origem: 'anonimizacao_lgpd', responsavel: text(operador, 120), registradoEm: stamp });
    counts.clientes += 1;
  }

  const belongs = (item) => (item?.clienteId && ids.has(String(item.clienteId))) || (!item?.clienteId && item?.clienteTelefone && phoneSet.has(normalizePhone(item.clienteTelefone)));
  const scrub = (item) => {
    if ('clienteNome' in item || item.clienteId) item.clienteNome = ANON_NAME;
    if ('clienteTelefone' in item) item.clienteTelefone = '';
    item.anonimizadoEm = stamp;
  };
  const barbearia = root.barbearias?.[String(empresaId)] || {};
  for (const [bucket, counter] of [['agendamentos', 'agendamentos'], ['comandas', 'comandas'], ['vendasRevenda', 'vendas'], ['filaEspera', 'filas'], ['assinaturas', 'planos']]) {
    for (const item of Object.values(barbearia[bucket] || {})) {
      if (!belongs(item)) continue;
      scrub(item);
      counts[counter] += 1;
    }
  }

  const fidelidade = root.canaisKytto?.empresas?.[String(empresaId)]?.fidelidade;
  for (const membro of Object.values(fidelidade?.membros || {})) {
    if (!ids.has(String(membro.clienteId)) && !(membro.telefone && phoneSet.has(normalizePhone(membro.telefone)))) continue;
    Object.assign(membro, { nome: ANON_NAME, telefone: '', anonimizadoEm: stamp });
    counts.fidelidade += 1;
  }

  const state = tenant(empresaId);
  const beforeNotes = state.notas.length;
  state.notas = state.notas.filter((note) => !overlaps(note.refs, refs));
  counts.notas = beforeNotes - state.notas.length;
  for (const ref of refs) { if (state.etiquetas[ref]) { delete state.etiquetas[ref]; counts.etiquetas += 1; } }

  save();
  return counts;
}

export { ANON_NAME };
