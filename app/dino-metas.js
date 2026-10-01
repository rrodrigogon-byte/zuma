// ============================================================================
// METAS MENSAIS DA EMPRESA — cadastro e acompanhamento com projeção do mês.
// As metas são definidas pelo gestor (nunca inferidas). O progresso usa o mês
// corrente no fuso de Cuiabá e projeta o fechamento pelo ritmo diário.
// ============================================================================

import { db, save } from './db.js';

export const METAS = [
  { id: 'receita', label: 'Receita do mês', format: 'currency' },
  { id: 'resultado', label: 'Resultado estimado', format: 'currency' },
  { id: 'atendimentos', label: 'Atendimentos', format: 'number' },
  { id: 'ticketMedio', label: 'Ticket médio dos serviços', format: 'currency', media: true },
  { id: 'novosClientes', label: 'Novos clientes', format: 'number' },
];
const TIME_ZONE = 'America/Cuiaba';

function store() {
  const state = db();
  state.metasKytto ||= { empresas: {} };
  state.metasKytto.empresas ||= {};
  return state.metasKytto.empresas;
}

export function obterMetas(empresaId) {
  const item = store()[String(empresaId)] || {};
  return Object.fromEntries(METAS.map(({ id }) => [id, Number.isFinite(Number(item[id])) && Number(item[id]) > 0 ? Number(item[id]) : null]));
}

export function salvarMetas(empresaId, dados = {}, usuario = '') {
  const atual = obterMetas(empresaId);
  const proximo = { ...atual };
  for (const { id } of METAS) {
    if (dados[id] === undefined) continue;
    if (dados[id] === null || dados[id] === '') { proximo[id] = null; continue; }
    const valor = Number(String(dados[id]).replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0 || valor > 1e9) throw new Error(`Meta inválida: ${id}.`);
    proximo[id] = valor > 0 ? Number(valor.toFixed(2)) : null;
  }
  store()[String(empresaId)] = { ...proximo, atualizadoEm: new Date().toISOString(), atualizadoPor: String(usuario || '').slice(0, 120) };
  save();
  return obterMetas(empresaId);
}

function parts(date) {
  const values = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).split('-').map(Number);
  return { year: values[0], month: values[1], day: values[2] };
}

/** Janela do mês corrente (fuso de Cuiabá, UTC-4 fixo desde 2019). */
export function monthWindow(now = new Date()) {
  const { year, month, day } = parts(now);
  const fromDate = new Date(Date.UTC(year, month - 1, 1, 4, 0, 0));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { fromDate, toDate: now, day, daysInMonth, label: `${String(month).padStart(2, '0')}/${year}` };
}

/**
 * Progresso de cada meta configurada.
 * status: atingida | no_ritmo | abaixo  (para média, compara o valor atual à meta)
 */
export function progressoMetas(metas = {}, atual = {}, { day = 1, daysInMonth = 30 } = {}) {
  const fracao = Math.min(1, Math.max(day, 1) / Math.max(daysInMonth, 1));
  return METAS.filter(({ id }) => metas[id] > 0).map(({ id, label, format, media }) => {
    const meta = Number(metas[id]);
    const valor = Number(atual[id] || 0);
    const projecao = media ? valor : (fracao > 0 ? valor / fracao : valor);
    const progress = Number(Math.min(999, (valor / meta) * 100).toFixed(1));
    const status = valor >= meta ? 'atingida' : (projecao >= meta ? 'no_ritmo' : 'abaixo');
    return { id, label, format, meta, atual: Number(valor.toFixed(2)), projecao: Number(projecao.toFixed(2)), progress, status, media: Boolean(media) };
  });
}
