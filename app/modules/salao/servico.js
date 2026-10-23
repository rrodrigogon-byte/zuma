// Reservas de mesa e lista de espera (migração 094), ligadas às mesas do bar.
// Acomodar uma reserva ou atender uma senha abre a comanda da mesa no bar; mesa com comanda
// aberta de outro cliente devolve MESA_OCUPADA. Usuário de unidade só vê os registros da unidade.
// O chamado da fila gera a mensagem pronta; o envio por WhatsApp fica com a integração de
// mensageria (não é disparado daqui).
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';
import * as bar from '../bar/servico.js';

export const FUSO_PADRAO = 'America/Cuiaba';
const TRANSICOES = {
  confirmada: ['chegou', 'no_show', 'cancelada'],
  chegou: ['em_atendimento', 'cancelada'],
  em_atendimento: ['cumprida'],
  cumprida: [], no_show: [], cancelada: [],
};
const textoOpcional = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const telefone = (v) => { const d = String(v ?? '').replace(/\D/g, ''); if (d && (d.length < 10 || d.length > 13)) throw new ErroDominio('VALIDATION_ERROR', 'Telefone inválido'); return d || null; };
const pessoas = (v) => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 200) throw new ErroDominio('VALIDATION_ERROR', 'Pessoas de 1 a 200'); return n; };
export const hojeNoFuso = (agora = new Date(), fuso = FUSO_PADRAO) => new Date(agora).toLocaleDateString('en-CA', { timeZone: fuso });

/** "2026-10-22T19:00" (hora local do fuso, como vem do input datetime-local) → instante. */
export function instanteLocal(valor, fuso = FUSO_PADRAO) {
  const t = String(valor || '').trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) { const d = new Date(t); if (!Number.isNaN(d.valueOf())) return d; }
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) throw new ErroDominio('VALIDATION_ERROR', 'Data e horário inválidos');
  const guess = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  // descobre o deslocamento do fuso naquele instante (sem bibliotecas)
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  const comoLocal = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess.valueOf() - (comoLocal - guess.valueOf()));
}

async function mesaPorNumero(q, empresa, num) {
  if (num === null || num === undefined || num === '') return null;
  if (/^[0-9a-f-]{36}$/i.test(String(num))) {
    const r = await q("SELECT id, numero FROM bar_mesas WHERE empresa_id = $1 AND id = $2 AND ativa = true AND tipo = 'fisica'", [empresa, num]);
    if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Mesa não encontrada', 404);
    return r.rows[0];
  }
  const r = await q("SELECT id, numero FROM bar_mesas WHERE empresa_id = $1 AND numero = $2 AND ativa = true AND tipo = 'fisica'", [empresa, Number(num)]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', `Mesa ${num} não encontrada`, 404);
  return r.rows[0];
}

function reservaDto(r) {
  return { id: r.id, clienteNome: r.cliente_nome, telefone: r.telefone || null, mesaId: r.mesa_id || null, mesaNum: r.mesa_numero ?? null, pessoas: r.pessoas, inicioEm: r.inicio_em, fimEm: r.fim_em, status: r.status, observacao: r.observacao || null, comandaId: r.comanda_id || null, lojaId: r.loja_id || null };
}

async function exigirMesaLivre(q, empresa, mesaId, inicio, fim, ignorarId = null) {
  await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`sal:mesa:${empresa}:${mesaId}`]);
  const r = await q(
    `SELECT cliente_nome, inicio_em FROM sal_reservas WHERE empresa_id = $1 AND mesa_id = $2 AND status IN ('confirmada', 'chegou', 'em_atendimento')
       AND inicio_em < $4 AND fim_em > $3 AND ($5::uuid IS NULL OR id <> $5::uuid) LIMIT 1`, [empresa, mesaId, inicio, fim, ignorarId]);
  if (r.rows[0]) throw new ErroDominio('MESA_RESERVADA', `A mesa já está reservada nesse horário (${r.rows[0].cliente_nome})`, 409);
}

/** Mesa com comanda aberta de outro cliente não recebe ninguém (fecha a conta antes). */
async function exigirMesaDesocupada(q, empresa, mesaId) {
  const r = await q("SELECT nome FROM bar_comandas WHERE empresa_id = $1 AND mesa_id = $2 AND status IN ('aberta', 'conta') LIMIT 1", [empresa, mesaId]);
  if (r.rows[0]) throw new ErroDominio('MESA_OCUPADA', `A mesa está ocupada${r.rows[0].nome ? ` (${r.rows[0].nome})` : ''}: feche a conta antes`, 409);
}

// Quem é chamado da fila fica na mesa por este tempo, no mínimo, antes de uma reserva começar.
const JANELA_FILA_MIN = 90;

/** Unidade do registro × escopo do usuário: usuário de unidade só vê o que é da unidade dele. */
const foraDaUnidade = (registro, lojaRestrita) => Boolean(lojaRestrita) && registro.loja_id !== lojaRestrita;

export async function criarReserva(db, empresaId, dados = {}, { usuario = null, fuso = FUSO_PADRAO, agora = new Date(), lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const inicio = instanteLocal(dados.inicioEm, fuso);
  if (inicio < new Date(agora.valueOf() - 15 * 60 * 1000)) throw new ErroDominio('VALIDATION_ERROR', 'O horário da reserva já passou');
  const duracao = Number(dados.duracaoMinutos ?? 120);
  if (!Number.isInteger(duracao) || duracao < 15 || duracao > 720) throw new ErroDominio('VALIDATION_ERROR', 'Duração de 15 a 720 minutos');
  const fim = new Date(inicio.valueOf() + duracao * 60 * 1000);
  const idem = textoOpcional(dados.idempotencia, 100);
  const jaCriada = async (q) => (await q('SELECT r.*, m.numero AS mesa_numero FROM sal_reservas r LEFT JOIN bar_mesas m ON m.empresa_id = r.empresa_id AND m.id = r.mesa_id WHERE r.empresa_id = $1 AND r.idempotencia = $2', [empresa, idem])).rows[0];
  try {
    return await criarReservaNaTransacao();
  } catch (error) {
    // dois envios simultâneos com a mesma chave: o segundo devolve a reserva do primeiro
    if (error?.code === '23505' && idem) { const ja = await jaCriada((t, v) => db.query(t, v)); if (ja) return reservaDto(ja); }
    throw error;
  }
  async function criarReservaNaTransacao() { return transacao(db, async (q) => {
    if (idem) {
      const ja = await jaCriada(q);
      if (ja) return reservaDto(ja);
    }
    const mesa = await mesaPorNumero(q, empresa, dados.mesaNum ?? dados.mesaId);
    if (mesa) await exigirMesaLivre(q, empresa, mesa.id, inicio, fim);
    const r = (await q(
      `INSERT INTO sal_reservas (empresa_id, loja_id, mesa_id, cliente_nome, telefone, pessoas, inicio_em, fim_em, observacao, idempotencia, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [empresa, lojaId, mesa?.id || null, exigirTexto(dados.clienteNome, 'Nome do cliente', { min: 2, max: 160 }), telefone(dados.telefone), pessoas(dados.pessoas ?? 2), inicio, fim, textoOpcional(dados.observacao, 500), idem, textoOpcional(usuario, 180)])).rows[0];
    return reservaDto({ ...r, mesa_numero: mesa?.numero ?? null });
  }); }
}

export async function listarReservas(db, empresaId, { de, ate, fuso = FUSO_PADRAO, lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const d1 = /^\d{4}-\d{2}-\d{2}$/.test(String(de)) ? de : hojeNoFuso(new Date(), fuso);
  const d2 = /^\d{4}-\d{2}-\d{2}$/.test(String(ate)) ? ate : d1;
  const r = await db.query(
    `SELECT r.*, m.numero AS mesa_numero FROM sal_reservas r LEFT JOIN bar_mesas m ON m.empresa_id = r.empresa_id AND m.id = r.mesa_id
      WHERE r.empresa_id = $1 AND (r.inicio_em AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date AND ($5::uuid IS NULL OR r.loja_id = $5::uuid)
      ORDER BY r.inicio_em`, [empresa, d1, d2, fuso, lojaId]);
  return r.rows.map(reservaDto);
}

export async function visaoDoDia(db, empresaId, { data, fuso = FUSO_PADRAO, lojaId = null } = {}) {
  const lista = await listarReservas(db, empresaId, { de: data, ate: data, fuso, lojaId });
  const validas = lista.filter((r) => r.status !== 'cancelada');
  const decididas = lista.filter((r) => ['cumprida', 'no_show', 'em_atendimento', 'chegou'].includes(r.status));
  const noShow = lista.filter((r) => r.status === 'no_show').length;
  return { ocupacao: { totalReservas: validas.length, pessoasPrevistas: validas.reduce((s, r) => s + r.pessoas, 0), taxaNoShow: decididas.length ? Math.round((noShow / decididas.length) * 100) : 0 } };
}

/** Muda a situação. Acomodar (em_atendimento) com mesa abre ou reaproveita a comanda dela. */
export async function mudarStatusReserva(db, empresaId, id, status, { usuario = null, agora = new Date(), lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const res = await transacao(db, async (q) => {
    const r = (await q('SELECT * FROM sal_reservas WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'reserva')])).rows[0];
    if (!r || foraDaUnidade(r, lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Reserva não encontrada', 404);
    if (r.status === status) return r;
    if (!(TRANSICOES[r.status] || []).includes(status)) throw new ErroDominio('INVALID_STATUS', `Reserva ${r.status} não pode virar ${status}`, 409);
    if (status === 'em_atendimento' && r.mesa_id) await exigirMesaDesocupada(q, empresa, r.mesa_id);
    if (status === 'no_show' && new Date(r.inicio_em) > agora) throw new ErroDominio('INVALID_STATUS', 'Só dá para marcar no-show depois do horário da reserva', 409);
    return (await q('UPDATE sal_reservas SET status = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *', [empresa, r.id, status])).rows[0];
  });
  if (status === 'em_atendimento' && res.mesa_id && !res.comanda_id) {
    const comanda = await bar.abrirComanda(db, empresa, { mesaId: res.mesa_id, nome: res.cliente_nome, operadorId: usuario });
    await db.query('UPDATE sal_reservas SET comanda_id = $3 WHERE empresa_id = $1 AND id = $2', [empresa, res.id, comanda.id]);
    res.comanda_id = comanda.id;
  }
  const mesa = res.mesa_id ? (await db.query('SELECT numero FROM bar_mesas WHERE empresa_id = $1 AND id = $2', [empresa, res.mesa_id])).rows[0] : null;
  return reservaDto({ ...res, mesa_numero: mesa?.numero ?? null });
}

// ── lista de espera ──────────────────────────────────────────────────────────
function filaDto(r) {
  return { id: r.id, senha: r.senha, clienteNome: r.cliente_nome, telefone: r.telefone || null, pessoas: r.pessoas, previsaoMinutos: r.previsao_minutos, status: r.status, mesaNum: r.mesa_numero ?? null, chamadoEm: r.chamado_em, mensagem: r.mensagem || null, criadoEm: r.criado_em, observacao: r.observacao || null, comandaId: r.comanda_id || null };
}

export async function entrarNaFila(db, empresaId, dados = {}, { fuso = FUSO_PADRAO, agora = new Date(), lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const dia = hojeNoFuso(agora, fuso);
  const prev = dados.previsaoMinutos === undefined || dados.previsaoMinutos === '' ? null : Number(dados.previsaoMinutos);
  if (prev !== null && (!Number.isInteger(prev) || prev < 0 || prev > 720)) throw new ErroDominio('VALIDATION_ERROR', 'Previsão de 0 a 720 minutos');
  return transacao(db, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`sal:senha:${empresa}:${dia}`]);
    const senha = Number((await q('SELECT COALESCE(MAX(senha), 0) + 1 AS n FROM sal_fila WHERE empresa_id = $1 AND dia = $2', [empresa, dia])).rows[0].n);
    const r = (await q(
      'INSERT INTO sal_fila (empresa_id, loja_id, dia, senha, cliente_nome, telefone, pessoas, previsao_minutos, observacao) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [empresa, lojaId, dia, senha, exigirTexto(dados.clienteNome, 'Nome do cliente', { min: 2, max: 160 }), telefone(dados.telefone), pessoas(dados.pessoas ?? 2), prev, textoOpcional(dados.observacao, 500)])).rows[0];
    return filaDto(r);
  });
}

export async function listarFila(db, empresaId, { fuso = FUSO_PADRAO, agora = new Date(), lojaId = null, todas = false } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(
    `SELECT f.*, m.numero AS mesa_numero FROM sal_fila f LEFT JOIN bar_mesas m ON m.empresa_id = f.empresa_id AND m.id = f.mesa_id
      WHERE f.empresa_id = $1 AND ($4::uuid IS NULL OR f.loja_id = $4::uuid)
        AND ((f.dia = $2 AND ($3::boolean OR f.status IN ('aguardando', 'chamado')))
             -- quem entrou antes da meia-noite e ainda espera continua na lista (até 12 h)
             OR (f.status IN ('aguardando', 'chamado') AND f.criado_em > $5::timestamptz - INTERVAL '12 hours'))
      ORDER BY f.dia, f.senha`, [empresa, hojeNoFuso(agora, fuso), todas, lojaId, agora]);
  return r.rows.map(filaDto);
}

export async function chamar(db, empresaId, id, { mesaNum, lojaRestrita = null, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const f = (await q('SELECT * FROM sal_fila WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'senha')])).rows[0];
    if (!f || foraDaUnidade(f, lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Senha não encontrada', 404);
    if (!['aguardando', 'chamado'].includes(f.status)) throw new ErroDominio('INVALID_STATUS', 'Esta senha já foi finalizada', 409);
    const mesa = await mesaPorNumero(q, empresa, mesaNum);
    if (!mesa) throw new ErroDominio('VALIDATION_ERROR', 'Informe a mesa');
    await exigirMesaDesocupada(q, empresa, mesa.id);
    // mesa com reserva começando logo (ou com o cliente da reserva já na casa) não vai para a fila
    await exigirMesaLivre(q, empresa, mesa.id, agora, new Date(agora.valueOf() + JANELA_FILA_MIN * 60 * 1000));
    // outra senha já chamada para esta mesa e ainda não sentada
    const outra = (await q("SELECT senha FROM sal_fila WHERE empresa_id = $1 AND mesa_id = $2 AND status = 'chamado' AND id <> $3 LIMIT 1", [empresa, mesa.id, f.id])).rows[0];
    if (outra) throw new ErroDominio('MESA_OCUPADA', `A mesa já foi chamada para a senha ${outra.senha}`, 409);
    const mensagem = `${f.cliente_nome.split(' ')[0]}, sua mesa ${mesa.numero} está pronta. Senha ${f.senha}.`.slice(0, 300);
    const r = (await q("UPDATE sal_fila SET status = 'chamado', mesa_id = $3, chamado_em = CURRENT_TIMESTAMP, mensagem = $4 WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, f.id, mesa.id, mensagem])).rows[0];
    return { ...filaDto({ ...r, mesa_numero: mesa.numero }), notificacao: f.telefone ? `Mensagem pronta para ${f.telefone}: "${mensagem}"` : `Chame a senha ${f.senha} para a mesa ${mesa.numero}.` };
  });
}

/** Atendido (senta na mesa chamada: abre ou reaproveita a comanda), cancelado ou ausente. */
export async function finalizar(db, empresaId, id, status, { usuario = null, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!['atendido', 'cancelado', 'ausente'].includes(status)) throw new ErroDominio('VALIDATION_ERROR', 'status deve ser atendido, cancelado ou ausente');
  const f = await transacao(db, async (q) => {
    const atual = (await q('SELECT * FROM sal_fila WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'senha')])).rows[0];
    if (!atual || foraDaUnidade(atual, lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Senha não encontrada', 404);
    if (atual.status === status) return atual;
    if (!['aguardando', 'chamado'].includes(atual.status)) throw new ErroDominio('INVALID_STATUS', 'Esta senha já foi finalizada', 409);
    if (status === 'atendido' && !atual.mesa_id) throw new ErroDominio('INVALID_STATUS', 'Chame a senha para uma mesa antes de atender', 409);
    if (status === 'atendido') await exigirMesaDesocupada(q, empresa, atual.mesa_id);
    return (await q('UPDATE sal_fila SET status = $3, finalizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *', [empresa, atual.id, status])).rows[0];
  });
  if (status === 'atendido' && f.mesa_id && !f.comanda_id) {
    const comanda = await bar.abrirComanda(db, empresa, { mesaId: f.mesa_id, nome: f.cliente_nome, operadorId: usuario });
    await db.query('UPDATE sal_fila SET comanda_id = $3 WHERE empresa_id = $1 AND id = $2', [empresa, f.id, comanda.id]);
    f.comanda_id = comanda.id;
  }
  return filaDto(f);
}
