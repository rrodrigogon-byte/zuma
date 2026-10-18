// Agenda de aulas com vagas (item 5 da especificação Kytto Clube & Academia).
// Lotação nunca é ultrapassada: toda reserva trava a linha da ocorrência (SELECT ... FOR UPDATE).
// Funções que geram avisos devolvem `avisos: [{ empresaId, customerId, texto }]` para o chamador
// enviar pelo WhatsApp (o módulo não envia nada sozinho).
import { ErroDominio, transacao, exigirUuid, exigirTexto, exigirData, inteiroOpcional } from '../acesso/banco.js';
import { instanteNoFuso } from '../acesso/regras.js';

const MIN_MS = 60000;
const DIA_MS = 86400000;
const ORIGENS = ['whatsapp', 'app', 'recepcao', 'wellhub', 'totalpass', 'fila'];
const PARCEIROS = ['wellhub', 'totalpass'];

const fmtHora = (d, fuso = 'America/Cuiaba') => new Date(d).toLocaleTimeString('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' });
const fmtDia = (d, fuso = 'America/Cuiaba') => new Date(d).toLocaleDateString('pt-BR', { timeZone: fuso, weekday: 'long', day: '2-digit', month: '2-digit' });
const primeiro = (nome) => String(nome || '').split(' ')[0];

/* ------------------------------------------------------------------ */
/* Cadastro                                                            */
/* ------------------------------------------------------------------ */

export async function salvarModalidade(db, empresaId, dados = {}, id = null) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [
    empresa,
    exigirTexto(dados.nome, 'nome', { max: 80 }),
    inteiroOpcional(dados.aberturaDias, 'aberturaDias', { min: 0, max: 60 }) ?? 7,
    inteiroOpcional(dados.limiteReservasFuturas, 'limiteReservasFuturas', { min: 1, max: 50 }) ?? 3,
    inteiroOpcional(dados.cancelamentoMinAntes, 'cancelamentoMinAntes', { min: 0, max: 2880 }) ?? 120,
    inteiroOpcional(dados.toleranciaAtrasoMin, 'toleranciaAtrasoMin', { min: 0, max: 60 }) ?? 10,
    inteiroOpcional(dados.noshowLimiteMes, 'noshowLimiteMes', { min: 1, max: 31 }) ?? 3,
    inteiroOpcional(dados.noshowBloqueioDias, 'noshowBloqueioDias', { min: 0, max: 60 }) ?? 7,
    inteiroOpcional(dados.filaRespostaMin, 'filaRespostaMin', { min: 5, max: 120 }) ?? 15,
    Array.isArray(dados.planos) && dados.planos.length ? dados.planos.map((p) => exigirUuid(p, 'plano')) : null,
  ];
  if (v[9]) {
    const ok = await db.query('SELECT COUNT(*)::int AS n FROM acesso_planos WHERE empresa_id = $1 AND id = ANY($2::uuid[])', [empresa, v[9]]);
    if (ok.rows[0].n !== v[9].length) throw new ErroDominio('VALIDATION_ERROR', 'planos: algum plano não pertence a esta empresa');
  }
  const r = id
    ? await db.query(
      `UPDATE aulas_modalidades SET nome=$2, abertura_dias=$3, limite_reservas_futuras=$4, cancelamento_min_antes=$5,
         tolerancia_atraso_min=$6, noshow_limite_mes=$7, noshow_bloqueio_dias=$8, fila_resposta_min=$9, planos=$10, ativo=$12
       WHERE empresa_id = $1 AND id = $11 RETURNING *`,
      [...v, exigirUuid(id), dados.ativo !== false],
    )
    : await db.query(
      `INSERT INTO aulas_modalidades (empresa_id, nome, abertura_dias, limite_reservas_futuras, cancelamento_min_antes,
         tolerancia_atraso_min, noshow_limite_mes, noshow_bloqueio_dias, fila_resposta_min, planos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      v,
    );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Modalidade não encontrada', 404);
  return r.rows[0];
}

export async function listarModalidades(db, empresaId) {
  return (await db.query('SELECT * FROM aulas_modalidades WHERE empresa_id = $1 ORDER BY ativo DESC, nome', [exigirUuid(empresaId, 'empresa')])).rows;
}

export async function salvarTurma(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const dias = Array.isArray(dados.diasSemana) ? [...new Set(dados.diasSemana.map(Number))] : [];
  if (!dias.length || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new ErroDominio('VALIDATION_ERROR', 'diasSemana: lista com 0 (domingo) a 6 (sábado)');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(dados.horaInicio || ''))) throw new ErroDominio('VALIDATION_ERROR', 'horaInicio: use HH:MM');
  const capacidade = inteiroOpcional(dados.capacidade, 'capacidade', { min: 1, max: 500 });
  if (!capacidade) throw new ErroDominio('VALIDATION_ERROR', 'capacidade obrigatória');
  const parceiros = inteiroOpcional(dados.vagasParceiros, 'vagasParceiros', { min: 0, max: capacidade }) ?? 0;
  const fuso = dados.fuso || 'America/Cuiaba';
  try { new Intl.DateTimeFormat('en-US', { timeZone: fuso }); } catch { throw new ErroDominio('VALIDATION_ERROR', 'fuso inválido'); }
  const modalidade = exigirUuid(dados.modalidadeId, 'modalidade');
  const m = await db.query('SELECT id FROM aulas_modalidades WHERE empresa_id = $1 AND id = $2 AND ativo', [empresa, modalidade]);
  if (!m.rows[0]) throw new ErroDominio('NOT_FOUND', 'Modalidade não encontrada', 404);
  const r = await db.query(
    `INSERT INTO aulas_turmas (empresa_id, modalidade_id, nome, professor, sala, dias_semana, hora_inicio, duracao_min,
                               capacidade, vagas_parceiros, fuso, vigencia_inicio, vigencia_fim)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      empresa, modalidade, exigirTexto(dados.nome, 'nome', { max: 120 }),
      dados.professor ? exigirTexto(dados.professor, 'professor', { max: 120 }) : null,
      dados.sala ? exigirTexto(dados.sala, 'sala', { max: 80 }) : null,
      dias, dados.horaInicio, inteiroOpcional(dados.duracaoMin, 'duracaoMin', { min: 10, max: 480 }) ?? 60,
      capacidade, parceiros, fuso, exigirData(dados.vigenciaInicio, 'vigenciaInicio'),
      dados.vigenciaFim ? exigirData(dados.vigenciaFim, 'vigenciaFim') : null,
    ],
  );
  return r.rows[0];
}

/**
 * Gera as aulas concretas das turmas ativas entre duas datas (idempotente).
 * Rodar diariamente para manter a janela de abertura de reservas preenchida.
 */
export async function gerarOcorrencias(db, empresaId, { de, ate }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const inicio = exigirData(de, 'de');
  const fim = exigirData(ate, 'ate');
  if (Date.parse(fim) - Date.parse(inicio) > 62 * DIA_MS) throw new ErroDominio('VALIDATION_ERROR', 'Gere no máximo 62 dias por vez');
  const turmas = await db.query(
    `SELECT *, vigencia_inicio::text AS vigencia_inicio, vigencia_fim::text AS vigencia_fim FROM aulas_turmas WHERE empresa_id = $1 AND ativa
       AND vigencia_inicio <= $3::date AND (vigencia_fim IS NULL OR vigencia_fim >= $2::date)`,
    [empresa, inicio, fim],
  );
  let criadas = 0;
  for (const t of turmas.rows) {
    const hora = String(t.hora_inicio).slice(0, 5);
    for (let d = Date.parse(`${inicio}T12:00:00Z`); d <= Date.parse(`${fim}T12:00:00Z`); d += DIA_MS) {
      const data = new Date(d).toISOString().slice(0, 10);
      const diaSemana = new Date(d).getUTCDay();
      const vigIni = t.vigencia_inicio;
      const vigFim = t.vigencia_fim || null;
      if (!t.dias_semana.includes(diaSemana) || data < vigIni || (vigFim && data > vigFim)) continue;
      const ini = instanteNoFuso(data, hora, t.fuso);
      const r = await db.query(
        `INSERT INTO aulas_ocorrencias (empresa_id, turma_id, inicio, fim, capacidade, professor)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (turma_id, inicio) DO NOTHING RETURNING id`,
        [empresa, t.id, ini, new Date(ini.getTime() + t.duracao_min * MIN_MS), t.capacidade, t.professor],
      );
      criadas += r.rowCount;
    }
  }
  return { criadas };
}

/* ------------------------------------------------------------------ */
/* Grade e vagas                                                       */
/* ------------------------------------------------------------------ */

const SQL_OCUPACAO = `
  SELECT o.*, t.nome AS turma, t.sala, t.vagas_parceiros, t.fuso, t.modalidade_id, m.nome AS modalidade,
         COUNT(r.id) FILTER (WHERE r.status IN ('reservada','presente'))::int AS ocupadas,
         COUNT(r.id) FILTER (WHERE r.status IN ('reservada','presente') AND r.origem IN ('wellhub','totalpass'))::int AS ocupadas_parceiros,
         (SELECT COUNT(*)::int FROM aulas_fila f WHERE f.ocorrencia_id = o.id AND f.status IN ('aguardando','chamado')) AS fila
    FROM aulas_ocorrencias o
    JOIN aulas_turmas t ON t.id = o.turma_id
    JOIN aulas_modalidades m ON m.id = t.modalidade_id
    LEFT JOIN aulas_reservas r ON r.ocorrencia_id = o.id`;

function ocorrenciaPublica(o) {
  const vagasProprias = Math.max(0, o.capacidade - o.vagas_parceiros - (o.ocupadas - o.ocupadas_parceiros));
  return {
    id: o.id,
    turma: o.turma,
    modalidade: o.modalidade,
    modalidadeId: o.modalidade_id,
    professor: o.professor,
    sala: o.sala,
    inicio: o.inicio,
    fim: o.fim,
    status: o.status,
    capacidade: o.capacidade,
    ocupadas: o.ocupadas,
    vagas: Math.max(0, o.capacidade - o.ocupadas),
    vagasAlunos: Math.min(vagasProprias, Math.max(0, o.capacidade - o.ocupadas)),
    vagasParceiros: Math.max(0, o.vagas_parceiros - o.ocupadas_parceiros),
    fila: o.fila,
    rotulo: `${o.modalidade} · ${fmtDia(o.inicio, o.fuso)} às ${fmtHora(o.inicio, o.fuso)}`,
  };
}

export async function listarGrade(db, empresaId, { de, ate, modalidadeId = null }) {
  const r = await db.query(
    `${SQL_OCUPACAO}
      WHERE o.empresa_id = $1 AND o.inicio >= $2 AND o.inicio < $3 AND ($4::uuid IS NULL OR t.modalidade_id = $4)
      GROUP BY o.id, t.id, m.id ORDER BY o.inicio`,
    [exigirUuid(empresaId, 'empresa'), new Date(de), new Date(ate), modalidadeId ? exigirUuid(modalidadeId, 'modalidade') : null],
  );
  return r.rows.map(ocorrenciaPublica);
}

/** Vagas livres para um dia/modalidade (usado pela IA no WhatsApp: "tem vaga no funcional amanhã?"). */
export async function listarVagas(db, empresaId, { dia, modalidade = '', agora = new Date(), fuso = 'America/Cuiaba' }) {
  const data = exigirData(dia, 'dia');
  const de = new Date(Math.max(instanteNoFuso(data, '00:00', fuso).getTime(), agora.getTime()));
  const ate = instanteNoFuso(data, '23:59:59', fuso);
  const termo = String(modalidade || '').trim().slice(0, 60);
  const r = await db.query(
    `${SQL_OCUPACAO}
      WHERE o.empresa_id = $1 AND o.status = 'ativa' AND o.inicio >= $2 AND o.inicio <= $3
        AND ($4 = '' OR m.nome ILIKE '%' || $4 || '%')
      GROUP BY o.id, t.id, m.id ORDER BY o.inicio`,
    [exigirUuid(empresaId, 'empresa'), de, ate, termo.replace(/[\\%_]/g, '\\$&')],
  );
  return r.rows.map(ocorrenciaPublica);
}

/* ------------------------------------------------------------------ */
/* Reserva                                                             */
/* ------------------------------------------------------------------ */

async function travarOcorrencia(q, empresa, ocorrenciaId) {
  const r = await q(
    `SELECT o.*, t.vagas_parceiros, t.fuso, t.modalidade_id, t.nome AS turma,
            m.nome AS modalidade, m.abertura_dias, m.limite_reservas_futuras, m.cancelamento_min_antes,
            m.tolerancia_atraso_min, m.noshow_limite_mes, m.noshow_bloqueio_dias, m.fila_resposta_min, m.planos
       FROM aulas_ocorrencias o
       JOIN aulas_turmas t ON t.id = o.turma_id
       JOIN aulas_modalidades m ON m.id = t.modalidade_id
      WHERE o.empresa_id = $1 AND o.id = $2 FOR UPDATE OF o`,
    [empresa, exigirUuid(ocorrenciaId, 'aula')],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Aula não encontrada', 404);
  return r.rows[0];
}

async function chamadosAtivos(q, ocorrenciaId, agora, exceto = null) {
  const r = await q(
    "SELECT COUNT(*)::int AS n FROM aulas_fila WHERE ocorrencia_id = $1 AND status = 'chamado' AND expira_em > $2 AND ($3::uuid IS NULL OR customer_id <> $3)",
    [ocorrenciaId, agora, exceto],
  );
  return r.rows[0].n;
}

async function ocupacao(q, ocorrenciaId) {
  const r = await q(
    `SELECT COUNT(*) FILTER (WHERE status IN ('reservada','presente'))::int AS total,
            COUNT(*) FILTER (WHERE status IN ('reservada','presente') AND origem IN ('wellhub','totalpass'))::int AS parceiros
       FROM aulas_reservas WHERE ocorrencia_id = $1`,
    [ocorrenciaId],
  );
  return r.rows[0];
}

/** Verifica se a pessoa pode reservar (regras do aluno). Parceiros não têm matrícula própria. */
async function validarAluno(q, o, empresa, customerId, origem, agora) {
  if (PARCEIROS.includes(origem)) return;
  const m = await q(
    "SELECT plano_id, bloqueada FROM acesso_matriculas WHERE empresa_id = $1 AND customer_id = $2 AND status = 'ativa'",
    [empresa, customerId],
  );
  if (!m.rows[0]) throw new ErroDominio('SEM_MATRICULA', 'Você não tem matrícula ativa. Fale com a recepção.', 403);
  if (m.rows[0].bloqueada) throw new ErroDominio('BLOQUEADO', 'Seu cadastro está com pendência. Fale com a recepção.', 403);
  if (o.planos && o.planos.length && !o.planos.includes(m.rows[0].plano_id)) {
    throw new ErroDominio('PLANO_SEM_MODALIDADE', `Seu plano não inclui ${o.modalidade}.`, 403);
  }
  const futuras = await q(
    `SELECT COUNT(*)::int AS n FROM aulas_reservas r JOIN aulas_ocorrencias o ON o.id = r.ocorrencia_id
      WHERE r.empresa_id = $1 AND r.customer_id = $2 AND r.status = 'reservada' AND o.inicio > $3`,
    [empresa, customerId, agora],
  );
  if (futuras.rows[0].n >= o.limite_reservas_futuras) {
    throw new ErroDominio('LIMITE_RESERVAS', `Você já tem ${futuras.rows[0].n} aulas reservadas. Esse é o limite.`, 409);
  }
  const faltas = await q(
    `SELECT COUNT(*)::int AS n, MAX(o.inicio) AS ultima FROM aulas_reservas r JOIN aulas_ocorrencias o ON o.id = r.ocorrencia_id
      WHERE r.empresa_id = $1 AND r.customer_id = $2 AND (r.status = 'falta' OR r.cancelamento_tardio)
        AND o.inicio > $3::timestamptz - interval '30 days'`,
    [empresa, customerId, agora],
  );
  const f = faltas.rows[0];
  if (f.n >= o.noshow_limite_mes && f.ultima && agora - new Date(f.ultima) < o.noshow_bloqueio_dias * DIA_MS) {
    const libera = new Date(new Date(f.ultima).getTime() + o.noshow_bloqueio_dias * DIA_MS);
    throw new ErroDominio('BLOQUEIO_FALTAS', `Por ${f.n} faltas sem aviso, novas reservas liberam em ${libera.toLocaleDateString('pt-BR', { timeZone: o.fuso })}.`, 403);
  }
}

async function inserirReserva(q, { empresa, o, customerId, origem, agora }) {
  if (o.status !== 'ativa') throw new ErroDominio('AULA_CANCELADA', 'Esta aula foi cancelada.', 409);
  if (new Date(o.inicio).getTime() + o.tolerancia_atraso_min * MIN_MS < agora.getTime()) {
    throw new ErroDominio('AULA_ENCERRADA', 'Esta aula já começou.', 409);
  }
  if (new Date(o.inicio).getTime() - agora.getTime() > o.abertura_dias * DIA_MS) {
    throw new ErroDominio('RESERVA_FECHADA', `Reservas abrem ${o.abertura_dias} dias antes da aula.`, 409);
  }
  const ja = await q("SELECT id FROM aulas_reservas WHERE ocorrencia_id = $1 AND customer_id = $2 AND status IN ('reservada','presente')", [o.id, customerId]);
  if (ja.rows[0]) throw new ErroDominio('JA_RESERVADO', 'Você já está nesta aula.', 409);
  const oc = await ocupacao(q, o.id);
  const parceiro = PARCEIROS.includes(origem);
  const livresTotal = o.capacidade - oc.total;
  const livresParceiro = o.vagas_parceiros - oc.parceiros;
  // vaga oferecida a quem foi chamado da fila fica guardada para ele até o prazo de resposta
  const guardadas = origem === 'fila' ? 0 : await chamadosAtivos(q, o.id, agora);
  const livresAluno = o.capacidade - o.vagas_parceiros - (oc.total - oc.parceiros) - guardadas;
  const temVaga = livresTotal - (parceiro ? 0 : guardadas) > 0 && (parceiro ? livresParceiro > 0 : livresAluno > 0);
  if (!temVaga) throw new ErroDominio('LOTADA', 'Turma lotada.', 409);
  const r = await q(
    'INSERT INTO aulas_reservas (empresa_id, ocorrencia_id, customer_id, origem) VALUES ($1, $2, $3, $4) RETURNING *',
    [empresa, o.id, customerId, origem],
  );
  return r.rows[0];
}

export async function reservar(db, empresaId, { ocorrenciaId, customerId, origem = 'whatsapp', agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  if (!ORIGENS.includes(origem)) throw new ErroDominio('VALIDATION_ERROR', 'origem inválida');
  return transacao(db, async (q) => {
    // trava por aluno: reservas simultâneas em aulas diferentes não furam o limite de futuras
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`clube-aluno:${empresa}:${cliente}`]);
    const o = await travarOcorrencia(q, empresa, ocorrenciaId);
    const ja = await q("SELECT id FROM aulas_reservas WHERE ocorrencia_id = $1 AND customer_id = $2 AND status IN ('reservada','presente')", [o.id, cliente]);
    if (ja.rows[0]) throw new ErroDominio('JA_RESERVADO', 'Você já está nesta aula.', 409);
    await validarAluno(q, o, empresa, cliente, origem, agora);
    const r = await inserirReserva(q, { empresa, o, customerId: cliente, origem, agora });
    return {
      reservaId: r.id,
      aula: `${o.modalidade} · ${fmtDia(o.inicio, o.fuso)} às ${fmtHora(o.inicio, o.fuso)}`,
      inicio: o.inicio,
    };
  });
}

export async function entrarNaFila(db, empresaId, { ocorrenciaId, customerId, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  return transacao(db, async (q) => {
    const o = await travarOcorrencia(q, empresa, ocorrenciaId);
    if (o.status !== 'ativa' || new Date(o.inicio) < agora) throw new ErroDominio('AULA_ENCERRADA', 'Esta aula não aceita mais fila.', 409);
    await validarAluno(q, o, empresa, cliente, 'fila', agora);
    const ja = await q("SELECT id FROM aulas_reservas WHERE ocorrencia_id = $1 AND customer_id = $2 AND status IN ('reservada','presente')", [o.id, cliente]);
    if (ja.rows[0]) throw new ErroDominio('JA_RESERVADO', 'Você já está nesta aula.', 409);
    const oc = await ocupacao(q, o.id);
    const livres = o.capacidade - o.vagas_parceiros - (oc.total - oc.parceiros) - await chamadosAtivos(q, o.id, agora);
    if (livres > 0) throw new ErroDominio('VAGA_DISPONIVEL', 'Ainda há vaga nesta aula: faça a reserva direto.', 409);
    await q(
      `INSERT INTO aulas_fila (empresa_id, ocorrencia_id, customer_id) VALUES ($1, $2, $3)
       ON CONFLICT (ocorrencia_id, customer_id) WHERE status IN ('aguardando','chamado') DO NOTHING`,
      [empresa, o.id, cliente],
    );
    const pos = await q(
      `SELECT COUNT(*)::int AS n FROM aulas_fila WHERE ocorrencia_id = $1 AND status IN ('aguardando','chamado')
         AND id <= (SELECT id FROM aulas_fila WHERE ocorrencia_id = $1 AND customer_id = $2 AND status IN ('aguardando','chamado'))`,
      [o.id, cliente],
    );
    return { posicao: pos.rows[0].n };
  });
}

/**
 * Oferece a vaga livre à fila. Mais de 1 h antes: chama o 1º com prazo de resposta.
 * Menos de 1 h: avisa todos da fila e fica com quem responder primeiro.
 */
async function chamarFila(q, o, agora) {
  const oc = await ocupacao(q, o.id);
  const livresAluno = o.capacidade - o.vagas_parceiros - (oc.total - oc.parceiros) - await chamadosAtivos(q, o.id, agora);
  if (o.status !== 'ativa' || livresAluno <= 0 || new Date(o.inicio) <= agora) return [];
  const rotulo = `${o.modalidade} de ${fmtDia(o.inicio, o.fuso)} às ${fmtHora(o.inicio, o.fuso)}`;
  const corrida = new Date(o.inicio).getTime() - agora.getTime() < 60 * MIN_MS;
  // fora da corrida: chama tantos quantos forem as vagas livres; na corrida: avisa todos
  const alvo = await q(
    `SELECT f.id, f.customer_id, c.nome FROM aulas_fila f
       JOIN commerce_customers c ON c.empresa_id = f.empresa_id AND c.id = f.customer_id
      WHERE f.ocorrencia_id = $1 AND f.status = 'aguardando' ORDER BY f.id ${corrida ? '' : 'LIMIT $2'}`,
    corrida ? [o.id] : [o.id, livresAluno],
  );
  if (!alvo.rows.length) return [];
  const expira = new Date(Math.min(
    agora.getTime() + o.fila_resposta_min * MIN_MS,
    new Date(o.inicio).getTime(),
  ));
  await q(
    "UPDATE aulas_fila SET status = 'chamado', chamado_em = $2, expira_em = $3 WHERE id = ANY($1::bigint[])",
    [alvo.rows.map((x) => x.id), agora, expira],
  );
  return alvo.rows.map((x) => ({
    empresaId: o.empresa_id,
    customerId: x.customer_id,
    ocorrenciaId: o.id,
    texto: corrida
      ? `${primeiro(x.nome)}, abriu vaga no ${rotulo}. Quem responder SIM primeiro fica com ela.`
      : `${primeiro(x.nome)}, abriu vaga no ${rotulo}. Quer? Responda SIM em até ${o.fila_resposta_min} minutos.`,
  }));
}

/** Resposta do aluno chamado pela fila. SIM vira reserva; NÃO passa para o próximo. */
export async function responderFila(db, empresaId, { ocorrenciaId, customerId, aceitar, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  return transacao(db, async (q) => {
    const o = await travarOcorrencia(q, empresa, ocorrenciaId);
    const f = await q(
      "SELECT id, expira_em FROM aulas_fila WHERE ocorrencia_id = $1 AND customer_id = $2 AND status = 'chamado'",
      [o.id, cliente],
    );
    if (!f.rows[0]) throw new ErroDominio('SEM_CHAMADO', 'Não há vaga reservada para você agora.', 409);
    if (new Date(f.rows[0].expira_em) < agora) {
      await q("UPDATE aulas_fila SET status = 'expirado' WHERE id = $1", [f.rows[0].id]);
      return { reservado: false, motivo: 'expirado', avisos: await chamarFila(q, o, agora) };
    }
    if (!aceitar) {
      await q("UPDATE aulas_fila SET status = 'desistiu' WHERE id = $1", [f.rows[0].id]);
      return { reservado: false, motivo: 'desistiu', avisos: await chamarFila(q, o, agora) };
    }
    try {
      const r = await inserirReserva(q, { empresa, o, customerId: cliente, origem: 'fila', agora });
      await q("UPDATE aulas_fila SET status = 'aceito' WHERE id = $1", [f.rows[0].id]);
      const corrida = new Date(o.inicio).getTime() - agora.getTime() < 60 * MIN_MS;
      // corrida: quem não pegou volta a aguardar; e se ainda sobrou vaga, chama os próximos
      if (corrida) await q("UPDATE aulas_fila SET status = 'aguardando', chamado_em = NULL, expira_em = NULL WHERE ocorrencia_id = $1 AND status = 'chamado'", [o.id]);
      return { reservado: true, reservaId: r.id, avisos: await chamarFila(q, o, agora) };
    } catch (error) {
      if (error.code !== 'LOTADA') throw error;
      await q("UPDATE aulas_fila SET status = 'aguardando', chamado_em = NULL, expira_em = NULL WHERE id = $1", [f.rows[0].id]);
      return { reservado: false, motivo: 'alguem_pegou_antes', avisos: [] };
    }
  });
}

export async function cancelarReserva(db, empresaId, { reservaId, customerId = null, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const r = await q(
      'SELECT * FROM aulas_reservas WHERE empresa_id = $1 AND id = $2',
      [empresa, exigirUuid(reservaId, 'reserva')],
    );
    const reserva = r.rows[0];
    if (!reserva || (customerId && reserva.customer_id !== exigirUuid(customerId, 'cliente'))) throw new ErroDominio('NOT_FOUND', 'Reserva não encontrada', 404);
    if (reserva.status !== 'reservada') throw new ErroDominio('RESERVA_ENCERRADA', 'Esta reserva não pode mais ser cancelada', 409);
    const o = await travarOcorrencia(q, empresa, reserva.ocorrencia_id);
    if (new Date(o.inicio) <= agora) throw new ErroDominio('AULA_ENCERRADA', 'A aula já começou', 409);
    const tardio = new Date(o.inicio).getTime() - agora.getTime() < o.cancelamento_min_antes * MIN_MS;
    await q(
      "UPDATE aulas_reservas SET status = 'cancelada', cancelado_em = $2, cancelamento_tardio = $3 WHERE id = $1",
      [reserva.id, agora, tardio],
    );
    return { cancelada: true, tardio, avisos: await chamarFila(q, o, agora) };
  });
}

/* ------------------------------------------------------------------ */
/* Rotinas (cron a cada minuto)                                        */
/* ------------------------------------------------------------------ */

/** Chamados vencidos passam a vez. */
export async function expirarChamados(db, { agora = new Date() } = {}) {
  const vencidos = await db.query(
    "SELECT DISTINCT ocorrencia_id, empresa_id FROM aulas_fila WHERE status = 'chamado' AND expira_em <= $1",
    [agora],
  );
  const avisos = [];
  for (const v of vencidos.rows) {
    const novos = await transacao(db, async (q) => {
      const o = await travarOcorrencia(q, v.empresa_id, v.ocorrencia_id);
      await q("UPDATE aulas_fila SET status = 'expirado' WHERE ocorrencia_id = $1 AND status = 'chamado' AND expira_em <= $2", [o.id, agora]);
      return chamarFila(q, o, agora);
    });
    avisos.push(...novos);
  }
  return avisos;
}

/** Quem não apareceu até o fim da tolerância vira falta (no-show). */
export async function processarFaltas(db, { agora = new Date() } = {}) {
  const r = await db.query(
    `UPDATE aulas_reservas r SET status = 'falta'
       FROM aulas_ocorrencias o JOIN aulas_turmas t ON t.id = o.turma_id JOIN aulas_modalidades m ON m.id = t.modalidade_id
      WHERE r.ocorrencia_id = o.id AND r.status = 'reservada' AND o.status = 'ativa'
        AND o.inicio + make_interval(mins => m.tolerancia_atraso_min) < $1
      RETURNING r.id`,
    [agora],
  );
  return { faltas: r.rowCount };
}

/** Lembrete 2 h antes, com opção de cancelar (libera a vaga para a fila). */
export async function lembretesDeAula(db, { agora = new Date(), antecedenciaMin = 120 } = {}) {
  const r = await db.query(
    `UPDATE aulas_reservas r SET lembrete_enviado_em = $1
       FROM aulas_ocorrencias o, aulas_turmas t, aulas_modalidades m, commerce_customers c
      WHERE r.ocorrencia_id = o.id AND t.id = o.turma_id AND m.id = t.modalidade_id
        AND c.empresa_id = r.empresa_id AND c.id = r.customer_id
        AND r.status = 'reservada' AND r.lembrete_enviado_em IS NULL AND o.status = 'ativa'
        AND o.inicio > $1 AND o.inicio <= $1::timestamptz + make_interval(mins => $2)
      RETURNING r.id, r.empresa_id, r.customer_id, c.nome, m.nome AS modalidade, o.inicio, t.fuso`,
    [agora, antecedenciaMin],
  );
  return r.rows.map((x) => ({
    empresaId: x.empresa_id,
    customerId: x.customer_id,
    reservaId: x.id,
    texto: `${primeiro(x.nome)}, lembrete: ${x.modalidade} hoje às ${fmtHora(x.inicio, x.fuso)}. Se não puder ir, responda CANCELAR que a vaga vai para quem está na fila.`,
  }));
}

/* ------------------------------------------------------------------ */
/* Presença e catraca                                                  */
/* ------------------------------------------------------------------ */

/**
 * Chamado quando a catraca libera a entrada: marca presença na reserva da janela atual
 * (de 30 min antes do início até o fim da tolerância).
 */
export async function registrarPresencaPorAcesso(db, { empresaId, customerId, agora = new Date() }) {
  const r = await db.query(
    `UPDATE aulas_reservas r SET status = 'presente', presenca_em = $3
       FROM aulas_ocorrencias o JOIN aulas_turmas t ON t.id = o.turma_id JOIN aulas_modalidades m ON m.id = t.modalidade_id
      WHERE r.ocorrencia_id = o.id AND r.empresa_id = $1 AND r.customer_id = $2 AND r.status = 'reservada'
        AND $3 BETWEEN o.inicio - interval '30 minutes' AND o.inicio + make_interval(mins => m.tolerancia_atraso_min)
      RETURNING r.id`,
    [empresaId, customerId, agora],
  );
  return r.rowCount;
}

/** Gancho para o motor de acesso (item 1): reservas próximas no formato que `decidirAcesso` usa. */
export async function reservasParaAcesso(q, { empresaId, customerId, agora }) {
  const r = await q(
    `SELECT o.inicio, o.fim, r.status FROM aulas_reservas r JOIN aulas_ocorrencias o ON o.id = r.ocorrencia_id
      WHERE r.empresa_id = $1 AND r.customer_id = $2 AND r.status IN ('reservada','presente') AND o.status = 'ativa'
        AND o.inicio BETWEEN $3::timestamptz - interval '2 hours' AND $3::timestamptz + interval '2 hours'`,
    [empresaId, customerId, agora],
  );
  return r.rows.map((x) => ({ inicio: new Date(x.inicio), fim: new Date(x.fim), status: 'reservada' }));
}

/** Chamada do professor: lista da turma com presença. */
export async function listaDaAula(db, empresaId, ocorrenciaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(
    `SELECT r.id, r.status, r.origem, r.presenca_em, c.id AS customer_id, c.nome
       FROM aulas_reservas r JOIN commerce_customers c ON c.empresa_id = r.empresa_id AND c.id = r.customer_id
      WHERE r.empresa_id = $1 AND r.ocorrencia_id = $2 AND r.status IN ('reservada','presente','falta')
      ORDER BY c.nome`,
    [empresa, exigirUuid(ocorrenciaId, 'aula')],
  );
  return r.rows;
}

export async function marcarPresencaManual(db, empresaId, reservaId, presente) {
  const r = await db.query(
    `UPDATE aulas_reservas SET status = $3, presenca_em = CASE WHEN $3 = 'presente' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE empresa_id = $1 AND id = $2 AND status IN ('reservada','presente','falta') RETURNING id, status`,
    [exigirUuid(empresaId, 'empresa'), exigirUuid(reservaId, 'reserva'), presente ? 'presente' : 'falta'],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Reserva não encontrada', 404);
  return r.rows[0];
}

/** Cancela uma aula inteira (ex.: professor doente) e devolve avisos para todos os reservados. */
export async function cancelarAula(db, empresaId, ocorrenciaId, motivo) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const texto = exigirTexto(motivo, 'motivo', { min: 3, max: 240 });
  return transacao(db, async (q) => {
    const o = await travarOcorrencia(q, empresa, ocorrenciaId);
    await q("UPDATE aulas_ocorrencias SET status = 'cancelada', motivo_cancelamento = $2 WHERE id = $1", [o.id, texto]);
    const afetados = await q(
      `UPDATE aulas_reservas r SET status = 'cancelada', cancelado_em = CURRENT_TIMESTAMP
         FROM commerce_customers c
        WHERE r.ocorrencia_id = $1 AND r.status = 'reservada' AND c.empresa_id = r.empresa_id AND c.id = r.customer_id
        RETURNING r.customer_id, c.nome`,
      [o.id],
    );
    await q("UPDATE aulas_fila SET status = 'expirado' WHERE ocorrencia_id = $1 AND status IN ('aguardando','chamado')", [o.id]);
    return {
      avisos: afetados.rows.map((x) => ({
        empresaId: empresa,
        customerId: x.customer_id,
        texto: `${primeiro(x.nome)}, a aula de ${o.modalidade} de ${fmtDia(o.inicio, o.fuso)} às ${fmtHora(o.inicio, o.fuso)} foi cancelada (${texto}). Quer que eu veja outro horário?`,
      })),
    };
  });
}
