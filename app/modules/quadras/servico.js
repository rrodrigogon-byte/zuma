// Quadras e reservas por empresa (tênis, beach tennis, padel…) do Kytto Clube & Academia.
// Cada clube tem as próprias quadras, o horário de funcionamento por dia da semana e as regras de
// reserva. Choque de horário nunca acontece: toda reserva trava a quadra (pg_advisory_xact_lock)
// dentro da transação antes de conferir a agenda; a do sócio trava também o sócio, para ele não
// ocupar duas quadras no mesmo horário nem furar o limite de reservas futuras.
import { ErroDominio, transacao, exigirUuid, exigirTexto, exigirData, inteiroOpcional } from '../acesso/banco.js';
import { instanteNoFuso } from '../acesso/regras.js';

const MIN_MS = 60000;
const DIA_MS = 86400000;

export const MODALIDADES = {
  tenis: 'Tênis', beach_tennis: 'Beach tennis', padel: 'Padel', pickleball: 'Pickleball', squash: 'Squash',
  futevolei: 'Futevôlei', volei_praia: 'Vôlei de praia', futsal: 'Futsal', society: 'Society', outro: 'Outro',
};
export const PISOS = {
  saibro: 'Saibro', rapida: 'Rápida', areia: 'Areia', grama_sintetica: 'Grama sintética', grama: 'Grama', madeira: 'Madeira', outro: 'Outro',
};
export const TIPOS = {
  socio: 'Sócio', avulso: 'Avulso', aula: 'Aula', torneio: 'Torneio', manutencao: 'Manutenção', evento: 'Evento',
};
const BLOQUEIOS = ['aula', 'torneio', 'manutencao', 'evento'];
const ORIGENS = ['recepcao', 'whatsapp', 'app'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const HORA_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const FUNCIONAMENTO_PADRAO = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [{ abre: '06:00', fecha: '22:00' }]]));
const CONFIG_PADRAO = {
  fuso: 'America/Cuiaba', funcionamento: FUNCIONAMENTO_PADRAO, duracaoMin: 60, intervaloMin: 60,
  aberturaDias: 7, limiteReservasFuturas: 2, cancelamentoMinAntes: 120, exigeSocioEmDia: true,
};

/* ------------------------------------------------------------------ */
/* Horas                                                               */
/* ------------------------------------------------------------------ */

/** "05:30" → 330. "24:00" vale só como fechamento (meia-noite). */
function paraMin(hora, campo, { permiteMeiaNoite = false } = {}) {
  const h = String(hora || '').trim();
  if (permiteMeiaNoite && h === '24:00') return 1440;
  if (!HORA_RE.test(h)) throw new ErroDominio('VALIDATION_ERROR', `${campo} deve estar no formato HH:MM`);
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
}
const deMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** Dia da semana de uma data AAAA-MM-DD (0 = domingo), sem depender do fuso do servidor. */
const diaDaSemana = (data) => new Date(`${data}T12:00:00Z`).getUTCDay();
const proximoDia = (data) => new Date(Date.parse(`${data}T12:00:00Z`) + DIA_MS).toISOString().slice(0, 10);
/** Instante do horário local `minutos` (0–1440) no dia, no fuso do clube; 1440 = 00:00 do dia seguinte. Respeita horário de verão. */
const instante = (data, minutos, fuso) => (minutos >= 1440
  ? instanteNoFuso(proximoDia(data), deMin(minutos - 1440), fuso)
  : instanteNoFuso(data, deMin(minutos), fuso));
const horaNoFuso = (d, fuso) => new Date(d).toLocaleTimeString('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dataNoFuso = (d, fuso) => new Date(d).toLocaleDateString('en-CA', { timeZone: fuso });
const diaBR = (data) => `${DIAS[diaDaSemana(data)]}, ${data.slice(8, 10)}/${data.slice(5, 7)}`;
/** Minutos desde a meia-noite do dia da grade (limitado a 0–1440: o fim à meia-noite vira 24:00). */
function minutosNoDia(d, data, fuso) {
  const dia = dataNoFuso(d, fuso);
  if (dia < data) return 0;
  if (dia > data) return 1440;
  return paraMin(horaNoFuso(d, fuso), 'hora');
}

/** Aceita "beach", "tênis", "Beach Tennis"… e devolve a chave da modalidade (ou ''). */
export function normalizarModalidade(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (!t) return '';
  if (MODALIDADES[t]) return t;
  if (t.includes('beach')) return 'beach_tennis';
  if (t.includes('padel')) return 'padel';
  if (t.includes('pickle')) return 'pickleball';
  if (t.includes('squash')) return 'squash';
  if (t.includes('futev')) return 'futevolei';
  if (t.includes('volei')) return 'volei_praia';
  if (t.includes('futsal')) return 'futsal';
  if (t.includes('society')) return 'society';
  if (t.includes('tenis')) return 'tenis';
  return '';
}

/* ------------------------------------------------------------------ */
/* Configuração                                                        */
/* ------------------------------------------------------------------ */

/** Valida o funcionamento: { "0": [{abre, fecha}], ... }; dia vazio = fechado. Até 3 faixas por dia. */
export function normalizarFuncionamento(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) throw new ErroDominio('VALIDATION_ERROR', 'funcionamento inválido');
  const saida = {};
  for (let d = 0; d <= 6; d += 1) {
    const faixas = f[String(d)] ?? f[d] ?? [];
    if (!Array.isArray(faixas) || faixas.length > 3) throw new ErroDominio('VALIDATION_ERROR', `funcionamento de ${DIAS[d]}: até 3 faixas`);
    const lista = faixas.map((x) => {
      const abre = paraMin(x?.abre, `abertura de ${DIAS[d]}`);
      const fecha = paraMin(x?.fecha, `fechamento de ${DIAS[d]}`, { permiteMeiaNoite: true });
      if (fecha <= abre) throw new ErroDominio('VALIDATION_ERROR', `Em ${DIAS[d]}, o fechamento precisa ser depois da abertura`);
      return { abre, fecha };
    }).sort((a, b) => a.abre - b.abre);
    for (let i = 1; i < lista.length; i += 1) {
      if (lista[i].abre < lista[i - 1].fecha) throw new ErroDominio('VALIDATION_ERROR', `Em ${DIAS[d]}, as faixas de horário se sobrepõem`);
    }
    saida[String(d)] = lista.map((x) => ({ abre: deMin(x.abre), fecha: deMin(x.fecha) }));
  }
  return saida;
}

function configDaLinha(r) {
  if (!r) return { ...CONFIG_PADRAO, configurado: false };
  return {
    fuso: r.fuso, funcionamento: r.funcionamento, duracaoMin: r.duracao_min, intervaloMin: r.intervalo_min,
    aberturaDias: r.abertura_dias, limiteReservasFuturas: r.limite_reservas_futuras,
    cancelamentoMinAntes: r.cancelamento_min_antes, exigeSocioEmDia: r.exige_socio_em_dia, configurado: true,
  };
}

export async function obterConfig(db, empresaId) {
  const r = await db.query('SELECT * FROM clube_quadras_config WHERE empresa_id = $1', [exigirUuid(empresaId, 'empresa')]);
  return configDaLinha(r.rows[0]);
}

export async function salvarConfig(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const atual = await obterConfig(db, empresa);
  const fuso = dados.fuso ? String(dados.fuso).trim() : atual.fuso;
  try { new Intl.DateTimeFormat('en-US', { timeZone: fuso }); } catch { throw new ErroDominio('VALIDATION_ERROR', 'fuso inválido'); }
  const n = (v, campo, min, max, padrao) => inteiroOpcional(v, campo, { min, max }) ?? padrao;
  const c = {
    fuso,
    funcionamento: dados.funcionamento !== undefined ? normalizarFuncionamento(dados.funcionamento) : atual.funcionamento,
    duracaoMin: n(dados.duracaoMin, 'duracaoMin', 15, 480, atual.duracaoMin),
    intervaloMin: n(dados.intervaloMin, 'intervaloMin', 15, 240, atual.intervaloMin),
    aberturaDias: n(dados.aberturaDias, 'aberturaDias', 0, 90, atual.aberturaDias),
    limiteReservasFuturas: n(dados.limiteReservasFuturas, 'limiteReservasFuturas', 1, 50, atual.limiteReservasFuturas),
    cancelamentoMinAntes: n(dados.cancelamentoMinAntes, 'cancelamentoMinAntes', 0, 2880, atual.cancelamentoMinAntes),
    exigeSocioEmDia: dados.exigeSocioEmDia === undefined ? atual.exigeSocioEmDia : dados.exigeSocioEmDia === true,
  };
  if (c.duracaoMin % 15 || c.intervaloMin % 15) throw new ErroDominio('VALIDATION_ERROR', 'Duração e passo da grade precisam ser múltiplos de 15 minutos');
  const r = await db.query(
    `INSERT INTO clube_quadras_config (empresa_id, fuso, funcionamento, duracao_min, intervalo_min, abertura_dias,
       limite_reservas_futuras, cancelamento_min_antes, exige_socio_em_dia, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id) DO UPDATE SET fuso = EXCLUDED.fuso, funcionamento = EXCLUDED.funcionamento,
       duracao_min = EXCLUDED.duracao_min, intervalo_min = EXCLUDED.intervalo_min, abertura_dias = EXCLUDED.abertura_dias,
       limite_reservas_futuras = EXCLUDED.limite_reservas_futuras, cancelamento_min_antes = EXCLUDED.cancelamento_min_antes,
       exige_socio_em_dia = EXCLUDED.exige_socio_em_dia, atualizado_em = CURRENT_TIMESTAMP
     RETURNING *`,
    [empresa, c.fuso, JSON.stringify(c.funcionamento), c.duracaoMin, c.intervaloMin, c.aberturaDias, c.limiteReservasFuturas, c.cancelamentoMinAntes, c.exigeSocioEmDia],
  );
  return configDaLinha(r.rows[0]);
}

/** Faixas de funcionamento de uma data, em minutos. */
function faixasDoDia(cfg, data) {
  return (cfg.funcionamento?.[String(diaDaSemana(data))] || []).map((f) => ({
    abre: paraMin(f.abre, 'abre'), fecha: paraMin(f.fecha, 'fecha', { permiteMeiaNoite: true }),
  }));
}

/** Horários de início oferecidos num dia (passo = intervalo; cabem `duracao` minutos até o fechamento). */
function iniciosDoDia(cfg, data, duracao = cfg.duracaoMin) {
  const lista = [];
  for (const f of faixasDoDia(cfg, data)) {
    for (let m = f.abre; m + duracao <= f.fecha; m += cfg.intervaloMin) lista.push(m);
  }
  return lista;
}

/* ------------------------------------------------------------------ */
/* Cadastro de quadras                                                 */
/* ------------------------------------------------------------------ */

function quadraPublica(q) {
  return {
    id: q.id, nome: q.nome, modalidade: q.modalidade, modalidadeRotulo: MODALIDADES[q.modalidade] || q.modalidade,
    piso: q.piso, pisoRotulo: q.piso ? PISOS[q.piso] || q.piso : null, coberta: q.coberta, iluminacao: q.iluminacao,
    valorHoraAvulso: q.valor_hora_avulso === null || q.valor_hora_avulso === undefined ? null : Number(q.valor_hora_avulso),
    ordem: q.ordem, ativa: q.ativa,
  };
}

export async function listarQuadras(db, empresaId, { todas = false, modalidade = '' } = {}) {
  const mod = normalizarModalidade(modalidade);
  const r = await db.query(
    `SELECT * FROM clube_quadras WHERE empresa_id = $1 AND ($2 OR ativa) AND ($3 = '' OR modalidade = $3)
      ORDER BY ordem, nome`,
    [exigirUuid(empresaId, 'empresa'), todas === true, mod],
  );
  return r.rows.map(quadraPublica);
}

function dadosDaQuadra(dados, atual = null) {
  const modalidade = dados.modalidade !== undefined ? String(dados.modalidade) : atual?.modalidade || 'tenis';
  if (!MODALIDADES[modalidade]) throw new ErroDominio('VALIDATION_ERROR', 'modalidade inválida');
  const pisoBruto = dados.piso !== undefined ? dados.piso : atual?.piso ?? null;
  const piso = pisoBruto === '' || pisoBruto === null ? null : String(pisoBruto);
  if (piso && !PISOS[piso]) throw new ErroDominio('VALIDATION_ERROR', 'piso inválido');
  const valorBruto = dados.valorHoraAvulso !== undefined ? dados.valorHoraAvulso : atual?.valor_hora_avulso ?? null;
  let valor = null;
  if (valorBruto !== null && valorBruto !== '') {
    valor = Number(String(valorBruto).replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0 || valor > 100000) throw new ErroDominio('VALIDATION_ERROR', 'valor por hora inválido');
  }
  return {
    nome: exigirTexto(dados.nome !== undefined ? dados.nome : atual?.nome, 'nome', { min: 1, max: 80 }),
    modalidade,
    piso,
    coberta: dados.coberta !== undefined ? dados.coberta === true : atual?.coberta ?? false,
    iluminacao: dados.iluminacao !== undefined ? dados.iluminacao === true : atual?.iluminacao ?? true,
    valor,
    ordem: inteiroOpcional(dados.ordem, 'ordem', { min: 0, max: 10000 }) ?? atual?.ordem ?? 0,
    ativa: dados.ativa !== undefined ? dados.ativa === true : atual?.ativa ?? true,
  };
}

export async function salvarQuadra(db, empresaId, dados = {}, id = null) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (id) {
    const qid = exigirUuid(id, 'quadra');
    const atual = (await db.query('SELECT * FROM clube_quadras WHERE empresa_id = $1 AND id = $2', [empresa, qid])).rows[0];
    if (!atual) throw new ErroDominio('NOT_FOUND', 'Quadra não encontrada', 404);
    const d = dadosDaQuadra(dados, atual);
    const r = await db.query(
      `UPDATE clube_quadras SET nome = $3, modalidade = $4, piso = $5, coberta = $6, iluminacao = $7, valor_hora_avulso = $8,
         ordem = $9, ativa = $10, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empresa, qid, d.nome, d.modalidade, d.piso, d.coberta, d.iluminacao, d.valor, d.ordem, d.ativa],
    );
    return quadraPublica(r.rows[0]);
  }
  const d = dadosDaQuadra(dados);
  if (dados.ordem === undefined || dados.ordem === null || dados.ordem === '') {
    d.ordem = (await db.query('SELECT COALESCE(MAX(ordem), 0) + 1 AS o FROM clube_quadras WHERE empresa_id = $1', [empresa])).rows[0].o;
  }
  const r = await db.query(
    `INSERT INTO clube_quadras (empresa_id, nome, modalidade, piso, coberta, iluminacao, valor_hora_avulso, ordem, ativa)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [empresa, d.nome, d.modalidade, d.piso, d.coberta, d.iluminacao, d.valor, d.ordem, d.ativa],
  );
  return quadraPublica(r.rows[0]);
}

/**
 * Cria várias quadras iguais de uma vez ("Saibro 1" … "Saibro 7"). Idempotente: nome que já existe
 * na empresa é mantido como está (rodar de novo não duplica).
 */
export async function criarQuadrasEmLote(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const quantidade = inteiroOpcional(dados.quantidade, 'quantidade', { min: 1, max: 50 });
  if (!quantidade) throw new ErroDominio('VALIDATION_ERROR', 'Informe quantas quadras criar');
  const inicial = inteiroOpcional(dados.numeroInicial, 'numeroInicial', { min: 0, max: 999 }) ?? 1;
  const base = dadosDaQuadra({ ...dados, nome: 'x' });
  const prefixo = exigirTexto(dados.prefixo || MODALIDADES[base.modalidade], 'prefixo', { min: 1, max: 70 });
  return transacao(db, async (q) => {
    let ordem = (await q('SELECT COALESCE(MAX(ordem), 0) AS o FROM clube_quadras WHERE empresa_id = $1', [empresa])).rows[0].o;
    const criadas = [];
    let jaExistiam = 0;
    for (let i = 0; i < quantidade; i += 1) {
      ordem += 1;
      const r = await q(
        `INSERT INTO clube_quadras (empresa_id, nome, modalidade, piso, coberta, iluminacao, valor_hora_avulso, ordem)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (empresa_id, nome) DO NOTHING RETURNING *`,
        [empresa, `${prefixo} ${inicial + i}`, base.modalidade, base.piso, base.coberta, base.iluminacao, base.valor, ordem],
      );
      if (r.rows[0]) criadas.push(quadraPublica(r.rows[0])); else jaExistiam += 1;
    }
    return { criadas, jaExistiam };
  });
}

/* ------------------------------------------------------------------ */
/* Agenda                                                              */
/* ------------------------------------------------------------------ */

async function reservasDoDia(db, empresa, data, fuso) {
  const de = instante(data, 0, fuso);
  const ate = instante(data, 1440, fuso);
  const r = await db.query(
    `SELECT r.id, r.quadra_id, r.customer_id, r.tipo, r.inicio, r.fim, r.origem, r.titulo, r.observacao, c.nome, c.telefone
       FROM clube_quadra_reservas r LEFT JOIN commerce_customers c ON c.empresa_id = r.empresa_id AND c.id = r.customer_id
      WHERE r.empresa_id = $1 AND r.status = 'confirmada' AND r.inicio < $3 AND r.fim > $2
      ORDER BY r.inicio`,
    [empresa, de, ate],
  );
  return r.rows;
}

/**
 * Grade do dia para a recepção: quadras × horários, com quem reservou.
 * `horarios` são as linhas da grade (passo = intervalo, dentro do funcionamento).
 */
export async function grade(db, empresaId, { data, modalidade = '', agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = await obterConfig(db, empresa);
  const dia = data ? exigirData(data, 'data') : dataNoFuso(agora, cfg.fuso);
  const [quadras, reservas] = await Promise.all([listarQuadras(db, empresa, { modalidade }), reservasDoDia(db, empresa, dia, cfg.fuso)]);
  const faixas = faixasDoDia(cfg, dia);
  const linhas = [];
  for (const f of faixas) for (let m = f.abre; m < f.fecha; m += cfg.intervaloMin) linhas.push(m);
  const porQuadra = new Map(quadras.map((q) => [q.id, []]));
  for (const r of reservas) {
    const lista = porQuadra.get(r.quadra_id);
    if (!lista) continue;
    lista.push({
      id: r.id, tipo: r.tipo, tipoRotulo: TIPOS[r.tipo], origem: r.origem, customerId: r.customer_id,
      nome: r.nome || null, telefone: r.telefone || null, titulo: r.titulo || null, observacao: r.observacao || null,
      inicio: deMin(minutosNoDia(r.inicio, dia, cfg.fuso)), fim: deMin(minutosNoDia(r.fim, dia, cfg.fuso)),
    });
  }
  const hoje = dataNoFuso(agora, cfg.fuso);
  const agoraMin = dia === hoje ? minutosNoDia(agora, dia, cfg.fuso) : dia < hoje ? 1440 : -1;
  const slotsTotais = quadras.length * linhas.length;
  const ocupa = (r, m) => paraMin(r.inicio, 'inicio') <= m && m < paraMin(r.fim, 'fim', { permiteMeiaNoite: true });
  const ocupados = quadras.reduce((n, q) => n + linhas.filter((m) => porQuadra.get(q.id).some((r) => ocupa(r, m))).length, 0);
  return {
    data: dia, diaRotulo: diaBR(dia), fuso: cfg.fuso, configurado: cfg.configurado,
    aberto: faixas.length > 0, faixas: faixas.map((f) => ({ abre: deMin(f.abre), fecha: deMin(f.fecha) })),
    intervaloMin: cfg.intervaloMin, duracaoMin: cfg.duracaoMin, agora: agoraMin >= 0 ? deMin(Math.min(agoraMin, 1439)) : null,
    passou: agoraMin >= 1440,
    horarios: linhas.map(deMin),
    quadras: quadras.map((q) => ({ ...q, reservas: porQuadra.get(q.id) })),
    ocupacao: { horarios: slotsTotais, ocupados, percentual: slotsTotais ? Math.round((ocupados / slotsTotais) * 100) : 0 },
  };
}

/**
 * Horários livres de um dia (para a IA e para quem ainda não é sócio): sem nomes de quem reservou.
 * Devolve só inícios ainda não passados, cada um com as quadras livres pela duração pedida.
 */
export async function horariosLivres(db, empresaId, {
  data, modalidade = '', duracaoMin = null, aPartirDe = '', agora = new Date(), limite = 12, respeitarAntecedencia = false,
} = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = await obterConfig(db, empresa);
  const dia = exigirData(data, 'dia');
  const dur = inteiroOpcional(duracaoMin, 'duracao_min', { min: 15, max: 240 }) ?? cfg.duracaoMin;
  if (dur % 15) throw new ErroDominio('VALIDATION_ERROR', 'A duração precisa ser múltipla de 15 minutos');
  // pelo WhatsApp, só oferece o que o sócio consegue reservar
  if (respeitarAntecedencia && dia > limiteDeAntecedencia(cfg, agora)) {
    return { data: dia, diaRotulo: diaBR(dia), duracaoMin: dur, horarios: [], aberto: faixasDoDia(cfg, dia).length > 0, reservaAindaFechada: true, aberturaDias: cfg.aberturaDias };
  }
  const desde = aPartirDe && HORA_RE.test(String(aPartirDe)) ? paraMin(aPartirDe, 'hora') : 0;
  const [quadras, reservas] = await Promise.all([listarQuadras(db, empresa, { modalidade }), reservasDoDia(db, empresa, dia, cfg.fuso)]);
  if (!quadras.length) return { data: dia, diaRotulo: diaBR(dia), duracaoMin: dur, horarios: [], aberto: faixasDoDia(cfg, dia).length > 0, semQuadras: true };
  const saida = [];
  for (const m of iniciosDoDia(cfg, dia, dur)) {
    if (m < desde) continue;
    const ini = instante(dia, m, cfg.fuso);
    const fim = new Date(ini.getTime() + dur * MIN_MS);
    if (ini <= agora) continue;
    const livres = quadras.filter((q) => !reservas.some((r) => r.quadra_id === q.id && new Date(r.inicio) < fim && new Date(r.fim) > ini));
    if (livres.length) saida.push({ hora: deMin(m), quadras: livres.map((q) => ({ id: q.id, nome: q.nome, modalidade: q.modalidadeRotulo })) });
    if (saida.length >= limite) break;
  }
  return { data: dia, diaRotulo: diaBR(dia), duracaoMin: dur, horarios: saida, aberto: faixasDoDia(cfg, dia).length > 0 };
}

/* ------------------------------------------------------------------ */
/* Reserva                                                             */
/* ------------------------------------------------------------------ */

/** Último dia que o sócio pode reservar (hoje + antecedência, no fuso do clube). */
function limiteDeAntecedencia(cfg, agora) {
  const hoje = dataNoFuso(agora, cfg.fuso);
  return new Date(Date.parse(`${hoje}T12:00:00Z`) + cfg.aberturaDias * DIA_MS).toISOString().slice(0, 10);
}

async function validarSocio(q, empresa, cliente, dia, { exigeEmDia = true } = {}) {
  const m = (await q(
    `SELECT m.bloqueada, (m.pago_ate + p.tolerancia_dias) >= $3::date AS em_dia
       FROM acesso_matriculas m JOIN acesso_planos p ON p.id = m.plano_id
      WHERE m.empresa_id = $1 AND m.customer_id = $2 AND m.status = 'ativa'`,
    [empresa, cliente, dia],
  )).rows[0];
  if (!m) throw new ErroDominio('SEM_MATRICULA', 'Reserva de sócio pede matrícula ativa. Fale com a recepção.', 403);
  if (m.bloqueada) throw new ErroDominio('BLOQUEADO', 'O cadastro está com pendência. Fale com a recepção.', 403);
  if (exigeEmDia && !m.em_dia) throw new ErroDominio('INADIMPLENTE', 'A mensalidade está em aberto. Depois do pagamento, a reserva libera.', 403);
}

/**
 * Reserva uma quadra. `origem` whatsapp/app aplica as regras do sócio (antecedência e limite de
 * reservas futuras); a recepção pode passar por cima delas, mas nunca de choque de horário,
 * funcionamento ou mensalidade em aberto (quando o clube exige sócio em dia).
 */
export async function reservar(db, empresaId, {
  quadraId, customerId = null, data, hora, duracaoMin = null, tipo = 'socio', origem = 'recepcao',
  titulo = null, observacao = null, operador = null, agora = new Date(),
} = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const qid = exigirUuid(quadraId, 'quadra');
  if (!TIPOS[tipo]) throw new ErroDominio('VALIDATION_ERROR', 'tipo de reserva inválido');
  if (!ORIGENS.includes(origem)) throw new ErroDominio('VALIDATION_ERROR', 'origem inválida');
  const bloqueio = BLOQUEIOS.includes(tipo);
  const cliente = customerId ? exigirUuid(customerId, 'cliente') : null;
  if (tipo === 'socio' && !cliente) throw new ErroDominio('VALIDATION_ERROR', 'Escolha o sócio da reserva');
  if (origem !== 'recepcao' && tipo !== 'socio') throw new ErroDominio('VALIDATION_ERROR', 'Só a recepção faz reserva avulsa ou bloqueio');
  const tituloLimpo = titulo ? exigirTexto(titulo, 'título', { min: 1, max: 120 }) : null;
  if (tipo === 'avulso' && !cliente && !tituloLimpo) throw new ErroDominio('VALIDATION_ERROR', 'Informe o nome de quem vai jogar');
  const obs = observacao ? exigirTexto(observacao, 'observação', { min: 1, max: 300 }) : null;

  const cfg = await obterConfig(db, empresa);
  const dia = exigirData(data, 'data');
  const ini = paraMin(hora, 'hora');
  const dur = inteiroOpcional(duracaoMin, 'duracaoMin', { min: 15, max: bloqueio ? 1440 : 240 }) ?? cfg.duracaoMin;
  if (dur % 15) throw new ErroDominio('VALIDATION_ERROR', 'A duração precisa ser múltipla de 15 minutos');
  const fimMin = ini + dur;
  const faixas = faixasDoDia(cfg, dia);
  if (!faixas.length) throw new ErroDominio('FECHADO', `O clube não abre neste dia (${diaBR(dia)}).`, 409);
  if (!faixas.some((f) => ini >= f.abre && fimMin <= f.fecha)) {
    throw new ErroDominio('FORA_DO_FUNCIONAMENTO', `Fora do horário de funcionamento (${faixas.map((f) => `${deMin(f.abre)} às ${deMin(f.fecha)}`).join(' e ')}).`, 409);
  }
  const inicio = instante(dia, ini, cfg.fuso);
  const fim = instante(dia, fimMin, cfg.fuso);
  if (fim <= agora) throw new ErroDominio('HORARIO_PASSOU', 'Esse horário já passou.', 409);
  const regrasDoSocio = origem !== 'recepcao';
  if (regrasDoSocio) {
    if (inicio <= agora) throw new ErroDominio('HORARIO_PASSOU', 'Esse horário já começou. Escolha um próximo.', 409);
    if (dia > limiteDeAntecedencia(cfg, agora)) throw new ErroDominio('RESERVA_FECHADA', `As reservas abrem ${cfg.aberturaDias} dia(s) antes.`, 409);
  }

  return transacao(db, async (q) => {
    const quadra = (await q('SELECT id, nome, ativa FROM clube_quadras WHERE empresa_id = $1 AND id = $2', [empresa, qid])).rows[0];
    if (!quadra || !quadra.ativa) throw new ErroDominio('NOT_FOUND', 'Quadra não encontrada ou desativada', 404);
    if (cliente) {
      const c = (await q('SELECT id FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresa, cliente])).rows[0];
      if (!c) throw new ErroDominio('NOT_FOUND', 'Cliente não encontrado nesta empresa', 404);
    }
    // trava da quadra: duas reservas no mesmo horário nunca passam juntas
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`clube-quadra:${empresa}:${qid}`]);
    if (tipo === 'socio') await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`clube-quadra-socio:${empresa}:${cliente}`]);
    const choque = (await q(
      `SELECT inicio, fim FROM clube_quadra_reservas
        WHERE empresa_id = $1 AND quadra_id = $2 AND status = 'confirmada' AND inicio < $4 AND fim > $3 LIMIT 1`,
      [empresa, qid, inicio, fim],
    )).rows[0];
    if (choque) {
      throw new ErroDominio('OCUPADA', `A ${quadra.nome} já está reservada das ${horaNoFuso(choque.inicio, cfg.fuso)} às ${horaNoFuso(choque.fim, cfg.fuso)}.`, 409);
    }
    if (tipo === 'socio') {
      // pelo WhatsApp/app é sempre preciso ser sócio (matrícula ativa); a regra do clube decide só o "em dia"
      if (cfg.exigeSocioEmDia || regrasDoSocio) await validarSocio(q, empresa, cliente, dia, { exigeEmDia: cfg.exigeSocioEmDia });
      const mesmaHora = (await q(
        `SELECT q.nome FROM clube_quadra_reservas r JOIN clube_quadras q ON q.id = r.quadra_id
          WHERE r.empresa_id = $1 AND r.customer_id = $2 AND r.status = 'confirmada' AND r.inicio < $4 AND r.fim > $3 LIMIT 1`,
        [empresa, cliente, inicio, fim],
      )).rows[0];
      if (mesmaHora) throw new ErroDominio('JA_RESERVADO', `Já existe uma reserva neste horário (${mesmaHora.nome}).`, 409);
      if (regrasDoSocio) {
        const futuras = (await q(
          "SELECT COUNT(*)::int AS n FROM clube_quadra_reservas WHERE empresa_id = $1 AND customer_id = $2 AND status = 'confirmada' AND inicio > $3",
          [empresa, cliente, agora],
        )).rows[0].n;
        if (futuras >= cfg.limiteReservasFuturas) {
          throw new ErroDominio('LIMITE_RESERVAS', `Você já tem ${futuras} reserva(s) de quadra marcadas. Esse é o limite do clube.`, 409);
        }
      }
    }
    const r = (await q(
      `INSERT INTO clube_quadra_reservas (empresa_id, quadra_id, customer_id, tipo, inicio, fim, origem, titulo, observacao, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [empresa, qid, cliente, tipo, inicio, fim, origem, tituloLimpo || (bloqueio ? TIPOS[tipo] : null), obs, operador ? String(operador).slice(0, 120) : null],
    )).rows[0];
    return {
      reservaId: r.id, quadra: quadra.nome, data: dia, inicio: deMin(ini), fim: deMin(fimMin),
      rotulo: `${quadra.nome} · ${diaBR(dia)}, das ${deMin(ini)} às ${deMin(fimMin)}`,
    };
  });
}

/** Cancela. Com `customerId` (conversa do sócio), só a reserva dele. Perto do horário fica marcado como tardio. */
export async function cancelarReserva(db, empresaId, { reservaId, customerId = null, operador = null, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const id = exigirUuid(reservaId, 'reserva');
  const cfg = await obterConfig(db, empresa);
  return transacao(db, async (q) => {
    const r = (await q(
      `SELECT r.*, q.nome AS quadra FROM clube_quadra_reservas r JOIN clube_quadras q ON q.id = r.quadra_id
        WHERE r.empresa_id = $1 AND r.id = $2 FOR UPDATE OF r`,
      [empresa, id],
    )).rows[0];
    if (!r || (customerId && r.customer_id !== exigirUuid(customerId, 'cliente'))) throw new ErroDominio('NOT_FOUND', 'Reserva não encontrada', 404);
    if (r.status === 'cancelada') return { cancelada: true, jaEstava: true, tardio: r.cancelamento_tardio };
    if (new Date(r.fim) <= agora) throw new ErroDominio('JA_PASSOU', 'Essa reserva já terminou.', 409);
    const tardio = r.tipo === 'socio' && new Date(r.inicio).getTime() - agora.getTime() < cfg.cancelamentoMinAntes * MIN_MS;
    await q(
      `UPDATE clube_quadra_reservas SET status = 'cancelada', cancelado_em = $3, cancelado_por = $4, cancelamento_tardio = $5
        WHERE empresa_id = $1 AND id = $2`,
      [empresa, id, agora, operador ? String(operador).slice(0, 120) : (customerId ? 'socio' : null), tardio],
    );
    return { cancelada: true, tardio, quadra: r.quadra };
  });
}

/** Próximas reservas confirmadas de um sócio. */
export async function reservasDoCliente(db, empresaId, customerId, { agora = new Date(), limite = 10 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = await obterConfig(db, empresa);
  const r = await db.query(
    `SELECT r.id, r.inicio, r.fim, r.tipo, q.nome AS quadra, q.modalidade FROM clube_quadra_reservas r JOIN clube_quadras q ON q.id = r.quadra_id
      WHERE r.empresa_id = $1 AND r.customer_id = $2 AND r.status = 'confirmada' AND r.fim > $3
      ORDER BY r.inicio LIMIT $4`,
    [empresa, exigirUuid(customerId, 'cliente'), agora, limite],
  );
  return r.rows.map((x) => {
    const dia = dataNoFuso(x.inicio, cfg.fuso);
    return {
      id: x.id, quadra: x.quadra, modalidade: MODALIDADES[x.modalidade] || x.modalidade, data: dia,
      inicio: horaNoFuso(x.inicio, cfg.fuso), fim: horaNoFuso(x.fim, cfg.fuso),
      rotulo: `${x.quadra} · ${diaBR(dia)}, das ${horaNoFuso(x.inicio, cfg.fuso)} às ${horaNoFuso(x.fim, cfg.fuso)}`,
    };
  });
}

/** A empresa tem quadra ativa (liga as ferramentas de quadra na IA). */
export async function temQuadras(db, empresaId) {
  const r = await db.query('SELECT EXISTS (SELECT 1 FROM clube_quadras WHERE empresa_id = $1 AND ativa) AS ok', [empresaId]);
  return r.rows[0]?.ok === true;
}
