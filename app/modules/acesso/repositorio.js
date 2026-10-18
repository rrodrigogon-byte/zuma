// Camada de dados do controle de acesso (item 1 da especificação Kytto Clube & Academia).
import { createHash, randomBytes } from 'node:crypto';
import {
  ErroDominio, transacao, exigirUuid, exigirTexto, exigirData, inteiroOpcional,
} from './banco.js';
import { comandoUpsertUsuario, comandoRemoverUsuario, comandoAbrirCatraca } from './controlid.js';
import { fimDoDiaNoFuso } from './regras.js';

// o driver pg converte DATE em meia-noite LOCAL: monta a data pelas partes locais (não pelo UTC)
const dataISO = (d) => (d instanceof Date
  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  : String(d).slice(0, 10));

const DIA_MS = 86400000;
const OFFLINE_APOS_MS = 3 * 60 * 1000;
const MAX_TENTATIVAS_PUSH = 5;
const REENVIO_APOS_MS = 2 * 60 * 1000;

export const hashSegredo = (segredo) => createHash('sha256').update(String(segredo)).digest('hex');

/* ------------------------------------------------------------------ */
/* Dispositivos                                                        */
/* ------------------------------------------------------------------ */

const FABRICANTES = ['controlid', 'henry', 'topdata', 'outro'];
const MODELOS = ['catraca', 'porta', 'leitor'];
const SENTIDOS = ['clockwise', 'anticlockwise', 'both'];

function dispositivoPublico(row, agora = new Date()) {
  if (!row) return null;
  const visto = row.ultimo_contato ? new Date(row.ultimo_contato) : null;
  const status = row.status !== 'aguardando' && visto && agora - visto > OFFLINE_APOS_MS ? 'offline' : row.status;
  return {
    id: row.id,
    nome: row.nome,
    unidadeId: row.unidade_id,
    fabricante: row.fabricante,
    modelo: row.modelo,
    modo: row.modo,
    sentidoEntrada: row.sentido_entrada,
    fuso: row.fuso,
    deviceIdExterno: row.device_id_externo,
    status,
    ultimoContato: row.ultimo_contato,
    firmware: row.firmware,
    ativo: row.ativo,
  };
}

/**
 * Cadastra o equipamento e devolve o segredo UMA vez. O segredo vai na URL configurada no aparelho
 * (servidor online e Push); o banco guarda só o hash.
 */
export async function criarDispositivo(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const nome = exigirTexto(dados.nome, 'nome', { max: 120 });
  const fabricante = dados.fabricante || 'controlid';
  const modelo = dados.modelo || 'catraca';
  const sentido = dados.sentidoEntrada || 'clockwise';
  if (!FABRICANTES.includes(fabricante)) throw new ErroDominio('VALIDATION_ERROR', 'fabricante inválido');
  if (!MODELOS.includes(modelo)) throw new ErroDominio('VALIDATION_ERROR', 'modelo inválido');
  if (!SENTIDOS.includes(sentido)) throw new ErroDominio('VALIDATION_ERROR', 'sentido de entrada inválido');
  const unidade = dados.unidadeId ? exigirUuid(dados.unidadeId, 'unidade') : null;
  const fuso = dados.fuso || 'America/Cuiaba';
  try { new Intl.DateTimeFormat('en-US', { timeZone: fuso }); } catch {
    throw new ErroDominio('VALIDATION_ERROR', 'fuso horário inválido');
  }
  const segredo = randomBytes(24).toString('base64url');
  const r = await db.query(
    `INSERT INTO acesso_dispositivos
       (empresa_id, unidade_id, nome, fabricante, modelo, modo, sentido_entrada, fuso, segredo_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [empresa, unidade, nome, fabricante, modelo, fabricante === 'controlid' ? 'pro' : 'agente', sentido, fuso, hashSegredo(segredo)],
  );
  return { dispositivo: dispositivoPublico(r.rows[0]), segredo };
}

export async function listarDispositivos(db, empresaId) {
  const r = await db.query(
    'SELECT * FROM acesso_dispositivos WHERE empresa_id = $1 ORDER BY ativo DESC, nome',
    [exigirUuid(empresaId, 'empresa')],
  );
  return r.rows.map((row) => dispositivoPublico(row));
}

export async function atualizarDispositivo(db, empresaId, id, dados = {}) {
  const campos = [];
  const valores = [exigirUuid(empresaId, 'empresa'), exigirUuid(id)];
  const set = (coluna, valor) => { valores.push(valor); campos.push(`${coluna} = $${valores.length}`); };
  if (dados.nome !== undefined) set('nome', exigirTexto(dados.nome, 'nome', { max: 120 }));
  if (dados.sentidoEntrada !== undefined) {
    if (!SENTIDOS.includes(dados.sentidoEntrada)) throw new ErroDominio('VALIDATION_ERROR', 'sentido de entrada inválido');
    set('sentido_entrada', dados.sentidoEntrada);
  }
  if (dados.ativo !== undefined) set('ativo', Boolean(dados.ativo));
  if (!campos.length) throw new ErroDominio('VALIDATION_ERROR', 'nada para atualizar');
  const r = await db.query(
    `UPDATE acesso_dispositivos SET ${campos.join(', ')}, atualizado_em = CURRENT_TIMESTAMP
     WHERE empresa_id = $1 AND id = $2 RETURNING *`,
    valores,
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Dispositivo não encontrado', 404);
  return dispositivoPublico(r.rows[0]);
}

/**
 * Identifica o aparelho que chamou a API pelo segredo da URL. No 1º contato fixa o device_id;
 * depois disso, um device_id diferente com o mesmo segredo é recusado (segredo copiado).
 */
export async function autenticarDispositivo(db, segredo, deviceIdExterno, { firmware } = {}) {
  if (!segredo || String(segredo).length < 20) return null;
  const r = await db.query(
    'SELECT * FROM acesso_dispositivos WHERE segredo_hash = $1 AND ativo = true',
    [hashSegredo(segredo)],
  );
  const row = r.rows[0];
  if (!row) return null;
  const externo = deviceIdExterno != null && deviceIdExterno !== '' ? String(deviceIdExterno).slice(0, 40) : null;
  // depois de vinculado, o aparelho é obrigado a se identificar com o mesmo device_id
  if (row.device_id_externo && row.device_id_externo !== externo) return null;
  const u = await db.query(
    `UPDATE acesso_dispositivos
        SET device_id_externo = COALESCE(device_id_externo, $2),
            status = CASE WHEN status = 'contingencia' THEN status ELSE 'online' END,
            ultimo_contato = CURRENT_TIMESTAMP,
            firmware = COALESCE($3, firmware)
      WHERE id = $1 RETURNING *`,
    [row.id, externo, firmware || null],
  );
  const d = u.rows[0];
  return {
    id: d.id,
    empresaId: d.empresa_id,
    unidadeId: d.unidade_id,
    fuso: d.fuso,
    modelo: d.modelo,
    sentidoEntrada: d.sentido_entrada,
    deviceIdExterno: d.device_id_externo,
  };
}

export async function marcarStatusDispositivo(db, dispositivoId, status) {
  await db.query(
    'UPDATE acesso_dispositivos SET status = $2, ultimo_contato = CURRENT_TIMESTAMP WHERE id = $1',
    [dispositivoId, status],
  );
}

/* ------------------------------------------------------------------ */
/* Planos e matrículas                                                 */
/* ------------------------------------------------------------------ */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarHorarios(horarios) {
  if (horarios === undefined || horarios === null) return null;
  if (typeof horarios !== 'object' || Array.isArray(horarios)) throw new ErroDominio('VALIDATION_ERROR', 'horarios inválido');
  const limpo = {};
  for (const [dia, janelas] of Object.entries(horarios)) {
    if (!/^[0-6]$/.test(dia) || !Array.isArray(janelas)) throw new ErroDominio('VALIDATION_ERROR', 'horarios: dia deve ser 0 (domingo) a 6');
    limpo[dia] = janelas.map((j) => {
      if (!HHMM.test(j?.inicio) || !HHMM.test(j?.fim)) throw new ErroDominio('VALIDATION_ERROR', 'horarios: use HH:MM');
      return { inicio: j.inicio, fim: j.fim };
    });
  }
  return limpo;
}

function planoPublico(row) {
  return {
    id: row.id,
    nome: row.nome,
    horarios: row.horarios,
    limitePorDia: row.limite_por_dia,
    limitePorSemana: row.limite_por_semana,
    unidades: row.unidades,
    exigeReserva: row.exige_reserva,
    toleranciaDias: row.tolerancia_dias,
    valorMensal: row.valor_mensal == null ? null : Number(row.valor_mensal),
    fidelidadeMeses: row.fidelidade_meses ?? null,
    congelamentoMaxDiasAno: row.congelamento_max_dias_ano ?? 30,
    congelamentoMinDias: row.congelamento_min_dias ?? 7,
    ativo: row.ativo,
  };
}

function valorOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100000) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return Math.round(n * 100) / 100;
}

export async function salvarPlano(db, empresaId, dados = {}, id = null) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const valores = [
    empresa,
    exigirTexto(dados.nome, 'nome', { max: 120 }),
    validarHorarios(dados.horarios),
    inteiroOpcional(dados.limitePorDia, 'limitePorDia', { max: 20 }),
    inteiroOpcional(dados.limitePorSemana, 'limitePorSemana', { max: 50 }),
    Array.isArray(dados.unidades) && dados.unidades.length ? dados.unidades.map((u) => exigirUuid(u, 'unidade')) : null,
    Boolean(dados.exigeReserva),
    inteiroOpcional(dados.toleranciaDias, 'toleranciaDias', { min: 0, max: 60 }) ?? 5,
    valorOpcional(dados.valorMensal, 'valorMensal'),
    inteiroOpcional(dados.fidelidadeMeses, 'fidelidadeMeses', { min: 1, max: 60 }),
    inteiroOpcional(dados.congelamentoMaxDiasAno, 'congelamentoMaxDiasAno', { min: 0, max: 180 }) ?? 30,
    inteiroOpcional(dados.congelamentoMinDias, 'congelamentoMinDias', { min: 1, max: 90 }) ?? 7,
  ];
  const r = id
    ? await db.query(
      `UPDATE acesso_planos SET nome = $2, horarios = $3, limite_por_dia = $4, limite_por_semana = $5,
         unidades = $6, exige_reserva = $7, tolerancia_dias = $8, valor_mensal = $9, fidelidade_meses = $10,
         congelamento_max_dias_ano = $11, congelamento_min_dias = $12, ativo = $14, atualizado_em = CURRENT_TIMESTAMP
       WHERE empresa_id = $1 AND id = $13 RETURNING *`,
      [...valores, exigirUuid(id), dados.ativo !== false],
    )
    : await db.query(
      `INSERT INTO acesso_planos (empresa_id, nome, horarios, limite_por_dia, limite_por_semana, unidades, exige_reserva, tolerancia_dias,
                                  valor_mensal, fidelidade_meses, congelamento_max_dias_ano, congelamento_min_dias)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      valores,
    );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Plano não encontrado', 404);
  return planoPublico(r.rows[0]);
}

export async function listarPlanos(db, empresaId) {
  const r = await db.query('SELECT * FROM acesso_planos WHERE empresa_id = $1 ORDER BY ativo DESC, nome', [exigirUuid(empresaId, 'empresa')]);
  return r.rows.map(planoPublico);
}

function matriculaPublica(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    nome: row.nome ?? null,
    telefone: row.telefone ?? null,
    planoId: row.plano_id,
    planoNome: row.plano_nome ?? null,
    pagoAte: dataISO(row.pago_ate),
    status: row.status,
    bloqueada: row.bloqueada,
    motivoBloqueio: row.motivo_bloqueio,
    inicio: row.inicio ? dataISO(row.inicio) : null,
    fimFidelidade: row.fim_fidelidade ? dataISO(row.fim_fidelidade) : null,
    congeladaAte: row.congelada_ate ? dataISO(row.congelada_ate) : null,
  };
}

/** Garante o número da pessoa nos aparelhos (estável por empresa). */
export async function garantirUserIdEquipamento(q, empresaId, customerId) {
  const r = await q(
    `INSERT INTO acesso_pessoas_equipamento (empresa_id, customer_id) VALUES ($1, $2)
     ON CONFLICT (empresa_id, customer_id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id
     RETURNING user_id_equipamento`,
    [empresaId, customerId],
  );
  return Number(r.rows[0].user_id_equipamento);
}

export async function criarMatricula(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const customerId = exigirUuid(dados.customerId, 'cliente');
  const planoId = exigirUuid(dados.planoId, 'plano');
  const pagoAte = exigirData(dados.pagoAte, 'pagoAte');
  const matricula = await transacao(db, async (q) => {
    const cliente = await q('SELECT id FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresa, customerId]);
    if (!cliente.rows[0]) throw new ErroDominio('NOT_FOUND', 'Cliente não encontrado nesta empresa', 404);
    const plano = await q('SELECT id, fidelidade_meses FROM acesso_planos WHERE empresa_id = $1 AND id = $2 AND ativo', [empresa, planoId]);
    if (!plano.rows[0]) throw new ErroDominio('NOT_FOUND', 'Plano não encontrado ou inativo', 404);
    const ativa = await q("SELECT id FROM acesso_matriculas WHERE empresa_id = $1 AND customer_id = $2 AND status IN ('ativa', 'congelada')", [empresa, customerId]);
    if (ativa.rows[0]) throw new ErroDominio('MATRICULA_ATIVA', 'Cliente já tem matrícula ativa; altere a existente', 409);
    // fim da fidelidade: informado ou início + meses de fidelidade do plano
    const inicio = dados.inicio ? exigirData(dados.inicio, 'inicio') : null;
    const fimInformado = dados.fimFidelidade ? exigirData(dados.fimFidelidade, 'fimFidelidade') : null;
    const r = await q(
      `INSERT INTO acesso_matriculas (empresa_id, customer_id, plano_id, pago_ate, inicio, fim_fidelidade)
       VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE),
               COALESCE($6::date, CASE WHEN $7::int IS NULL THEN NULL
                                       ELSE (COALESCE($5::date, CURRENT_DATE) + make_interval(months => $7::int))::date END))
       RETURNING *, pago_ate::text AS pago_ate, inicio::text AS inicio, fim_fidelidade::text AS fim_fidelidade`,
      [empresa, customerId, planoId, pagoAte, inicio, fimInformado, plano.rows[0].fidelidade_meses],
    );
    await garantirUserIdEquipamento(q, empresa, customerId);
    return r.rows[0];
  });
  await sincronizarPessoa(db, empresa, customerId);
  return matriculaPublica(matricula);
}

/** Registra pagamento: estende pago_ate (nunca reduz) e sincroniza as catracas na hora. */
export async function registrarPagamento(db, empresaId, matriculaId, pagoAte) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const data = exigirData(pagoAte, 'pagoAte');
  const r = await db.query(
    `UPDATE acesso_matriculas SET pago_ate = GREATEST(pago_ate, $3::date), atualizado_em = CURRENT_TIMESTAMP
     WHERE empresa_id = $1 AND id = $2 RETURNING *, pago_ate::text AS pago_ate`,
    [empresa, exigirUuid(matriculaId), data],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Matrícula não encontrada', 404);
  await sincronizarPessoa(db, empresa, r.rows[0].customer_id);
  return matriculaPublica(r.rows[0]);
}

export async function definirBloqueio(db, empresaId, matriculaId, bloqueada, motivo) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (bloqueada) exigirTexto(motivo, 'motivo', { min: 3, max: 240 });
  const r = await db.query(
    `UPDATE acesso_matriculas SET bloqueada = $3, motivo_bloqueio = $4, atualizado_em = CURRENT_TIMESTAMP
     WHERE empresa_id = $1 AND id = $2 RETURNING *, pago_ate::text AS pago_ate`,
    [empresa, exigirUuid(matriculaId), Boolean(bloqueada), bloqueada ? String(motivo).trim() : null],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Matrícula não encontrada', 404);
  await sincronizarPessoa(db, empresa, r.rows[0].customer_id);
  return matriculaPublica(r.rows[0]);
}

export async function alterarStatusMatricula(db, empresaId, matriculaId, status) {
  if (!['ativa', 'congelada', 'cancelada'].includes(status)) throw new ErroDominio('VALIDATION_ERROR', 'status inválido');
  const empresa = exigirUuid(empresaId, 'empresa');
  // congelamento pela régua (item 4) tem dias creditados: reativar por aqui deixaria os dias extras e a
  // rotina congelaria de novo. Tem que encerrar o congelamento (que devolve os dias não usados).
  if (status !== 'congelada' && (await db.query("SELECT to_regclass('clube_congelamentos') IS NOT NULL AS ok")).rows[0].ok) {
    const c = await db.query("SELECT 1 FROM clube_congelamentos WHERE empresa_id = $1 AND matricula_id = $2 AND status = 'ativo'", [empresa, exigirUuid(matriculaId)]);
    if (c.rows[0]) throw new ErroDominio('CONGELAMENTO_ATIVO', 'Esta matrícula tem congelamento ativo ou agendado. Use "Encerrar congelamento", que devolve os dias não usados.', 409);
  }
  const r = await db.query(
    `UPDATE acesso_matriculas SET status = $3::varchar, atualizado_em = CURRENT_TIMESTAMP,
            cancelada_em = CASE WHEN $3::varchar = 'cancelada' THEN COALESCE(cancelada_em, CURRENT_TIMESTAMP) ELSE NULL END,
            congelada_ate = CASE WHEN $3::varchar = 'congelada' THEN congelada_ate ELSE NULL END
     WHERE empresa_id = $1 AND id = $2 RETURNING *, pago_ate::text AS pago_ate`,
    [empresa, exigirUuid(matriculaId), status],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Matrícula não encontrada', 404);
  await sincronizarPessoa(db, empresa, r.rows[0].customer_id);
  return matriculaPublica(r.rows[0]);
}

export async function listarMatriculas(db, empresaId, { busca = '', status = 'ativa' } = {}) {
  const termo = String(busca || '').trim().slice(0, 80);
  const r = await db.query(
    `SELECT m.*, m.pago_ate::text AS pago_ate, c.nome, c.telefone, p.nome AS plano_nome
       FROM acesso_matriculas m
       JOIN commerce_customers c ON c.empresa_id = m.empresa_id AND c.id = m.customer_id
       JOIN acesso_planos p ON p.id = m.plano_id
      WHERE m.empresa_id = $1 AND ($2 = '' OR m.status = $2)
        AND ($3 = '' OR c.nome ILIKE '%' || $3 || '%' OR c.telefone ILIKE '%' || $3 || '%')
      ORDER BY c.nome LIMIT 200`,
    [exigirUuid(empresaId, 'empresa'), status === 'todas' ? '' : status, termo.replace(/[\\%_]/g, '\\$&')],
  );
  return r.rows.map(matriculaPublica);
}

/* ------------------------------------------------------------------ */
/* Contexto do motor de regras                                         */
/* ------------------------------------------------------------------ */

/**
 * Monta o contexto que o motor `decidirAcesso` precisa, a partir do número da pessoa no aparelho.
 * `extras.contrato(q, ids)` e `extras.reservas(q, ids)` são ganchos dos itens 3 e 5.
 */
export async function carregarContexto(db, { empresaId, userIdEquipamento, customerId, agora = new Date(), fuso = 'America/Cuiaba' }, extras = {}) {
  const q = (t, v) => db.query(t, v);
  let cliente;
  if (customerId) {
    cliente = await q('SELECT id, nome FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresaId, customerId]);
  } else {
    cliente = await q(
      `SELECT c.id, c.nome FROM acesso_pessoas_equipamento pe
         JOIN commerce_customers c ON c.empresa_id = pe.empresa_id AND c.id = pe.customer_id
        WHERE pe.empresa_id = $1 AND pe.user_id_equipamento = $2`,
      [empresaId, userIdEquipamento],
    );
  }
  const pessoa = cliente.rows[0];
  if (!pessoa) return null;
  const ids = { empresaId, customerId: pessoa.id, agora };
  const [mat, acessos, contrato, reservas, passeParceiro] = await Promise.all([
    q(
      `SELECT m.*, m.pago_ate::text AS pago_ate, p.horarios, p.limite_por_dia, p.limite_por_semana, p.unidades, p.exige_reserva, p.tolerancia_dias
         FROM acesso_matriculas m JOIN acesso_planos p ON p.id = m.plano_id
        WHERE m.empresa_id = $1 AND m.customer_id = $2 AND m.status = 'ativa'`,
      [empresaId, pessoa.id],
    ),
    q(
      `SELECT ocorrido_em FROM acesso_eventos
        WHERE empresa_id = $1 AND customer_id = $2 AND decisao = 'liberado' AND ocorrido_em > $3
        ORDER BY ocorrido_em DESC LIMIT 60`,
      [empresaId, pessoa.id, new Date(agora.getTime() - 8 * DIA_MS)],
    ),
    extras.contrato ? extras.contrato(q, ids) : Promise.resolve(null),
    extras.reservas ? extras.reservas(q, ids) : Promise.resolve([]),
    extras.parceiro ? extras.parceiro(q, ids) : Promise.resolve(null),
  ]);
  const m = mat.rows[0];
  return {
    pessoa: {
      id: pessoa.id,
      nome: pessoa.nome,
      bloqueada: Boolean(m?.bloqueada),
      motivoBloqueio: m?.motivo_bloqueio || null,
    },
    matricula: m
      ? {
        id: m.id,
        // pago até o fim do dia informado, no fuso do aparelho
        pagoAte: fimDoDiaNoFuso(dataISO(m.pago_ate), fuso),
        plano: {
          horarios: m.horarios || undefined,
          limitePorDia: m.limite_por_dia ?? undefined,
          limitePorSemana: m.limite_por_semana ?? undefined,
          unidades: m.unidades || undefined,
          exigeReserva: m.exige_reserva,
          toleranciaDias: m.tolerancia_dias,
        },
      }
      : null,
    contrato,
    acessosRecentes: acessos.rows.map((r) => new Date(r.ocorrido_em)),
    reservas,
    passeParceiro,
  };
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

export async function registrarEvento(db, e) {
  await db.query(
    `INSERT INTO acesso_eventos
       (empresa_id, dispositivo_id, customer_id, ocorrido_em, decisao, codigo_regra, mensagem, origem, operador_id, motivo_manual, uuid_externo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (dispositivo_id, uuid_externo) WHERE uuid_externo IS NOT NULL DO NOTHING`,
    [
      e.empresaId, e.dispositivoId || null, e.customerId || null, e.em || new Date(), e.decisao, e.codigo,
      e.mensagem ? String(e.mensagem).slice(0, 120) : null, e.origem, e.operadorId || null, e.motivoManual || null, e.uuid || null,
    ],
  );
}

/** Decisão já tomada para a mesma identificação (retentativa do aparelho com o mesmo uuid). */
export async function decisaoAnterior(db, dispositivoId, uuid) {
  if (!uuid) return null;
  const r = await db.query(
    'SELECT decisao, codigo_regra, mensagem, customer_id FROM acesso_eventos WHERE dispositivo_id = $1 AND uuid_externo = $2',
    [dispositivoId, String(uuid).slice(0, 80)],
  );
  const e = r.rows[0];
  return e ? { liberado: e.decisao === 'liberado', codigo: e.codigo_regra, mensagem: e.mensagem || '', customerId: e.customer_id } : null;
}

export async function listarEventos(db, empresaId, { desde, limite = 50 } = {}) {
  const r = await db.query(
    `SELECT e.id, e.ocorrido_em, e.decisao, e.codigo_regra, e.mensagem, e.origem, e.customer_id,
            c.nome, d.nome AS dispositivo
       FROM acesso_eventos e
       LEFT JOIN commerce_customers c ON c.empresa_id = e.empresa_id AND c.id = e.customer_id
       LEFT JOIN acesso_dispositivos d ON d.id = e.dispositivo_id
      WHERE e.empresa_id = $1 AND ($2::timestamptz IS NULL OR e.ocorrido_em > $2)
      ORDER BY e.ocorrido_em DESC, e.id DESC LIMIT $3`,
    [exigirUuid(empresaId, 'empresa'), desde ? new Date(desde) : null, Math.min(Math.max(Number(limite) || 50, 1), 200)],
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    em: row.ocorrido_em,
    decisao: row.decisao,
    codigo: row.codigo_regra,
    mensagem: row.mensagem,
    origem: row.origem,
    customerId: row.customer_id,
    nome: row.nome,
    dispositivo: row.dispositivo,
  }));
}

/** Frequência por semana (últimas N semanas) para o perfil do aluno e para a régua de retenção. */
export async function frequenciaSemanal(db, empresaId, customerId, semanas = 8) {
  const r = await db.query(
    `SELECT date_trunc('week', ocorrido_em AT TIME ZONE 'America/Cuiaba')::date::text AS semana, COUNT(*)::int AS acessos
       FROM acesso_eventos
      WHERE empresa_id = $1 AND customer_id = $2 AND decisao = 'liberado'
        AND ocorrido_em > CURRENT_TIMESTAMP - make_interval(weeks => $3)
      GROUP BY 1 ORDER BY 1`,
    [exigirUuid(empresaId, 'empresa'), exigirUuid(customerId, 'cliente'), Math.min(Math.max(semanas, 1), 52)],
  );
  return r.rows.map((x) => ({ semana: x.semana, acessos: x.acessos }));
}

/* ------------------------------------------------------------------ */
/* Fila Push                                                           */
/* ------------------------------------------------------------------ */

export async function enfileirarComando(db, { empresaId, dispositivoId, chave, comando }) {
  await db.query(
    `INSERT INTO acesso_fila_push (empresa_id, dispositivo_id, chave, comando)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (dispositivo_id, chave) WHERE status = 'pendente'
     DO UPDATE SET comando = EXCLUDED.comando, criado_em = CURRENT_TIMESTAMP`,
    [empresaId, dispositivoId, chave, JSON.stringify(comando)],
  );
}

/**
 * Atualiza a pessoa em TODOS os aparelhos ativos da empresa: com matrícula ativa grava a validade
 * offline; sem matrícula ativa (cancelada/congelada) remove do aparelho.
 */
export async function sincronizarPessoa(db, empresaId, customerId) {
  const [disp, pessoa] = await Promise.all([
    db.query("SELECT id, fuso, unidade_id FROM acesso_dispositivos WHERE empresa_id = $1 AND ativo AND fabricante = 'controlid'", [empresaId]),
    db.query(
      `SELECT pe.user_id_equipamento, c.nome, m.pago_ate::text AS pago_ate, m.status, m.bloqueada, p.tolerancia_dias
         FROM acesso_pessoas_equipamento pe
         JOIN commerce_customers c ON c.empresa_id = pe.empresa_id AND c.id = pe.customer_id
         LEFT JOIN acesso_matriculas m ON m.empresa_id = pe.empresa_id AND m.customer_id = pe.customer_id AND m.status = 'ativa'
         LEFT JOIN acesso_planos p ON p.id = m.plano_id
        WHERE pe.empresa_id = $1 AND pe.customer_id = $2`,
      [empresaId, customerId],
    ),
  ]);
  const p = pessoa.rows[0];
  if (!p || !disp.rows.length) return 0;
  const userId = Number(p.user_id_equipamento);
  const ativa = p.status === 'ativa' && !p.bloqueada;
  // sem plano ativo, um check-in Wellhub/TotalPass válido mantém a pessoa no aparelho até expirar (item 2)
  const passe = ativa || p.bloqueada ? null : await validadeDoParceiro(db, empresaId, customerId);
  for (const d of disp.rows) {
    let comando;
    if (ativa) {
      comando = comandoUpsertUsuario({
        userIdEquipamento: userId,
        nome: p.nome,
        matricula: { pagoAte: fimDoDiaNoFuso(dataISO(p.pago_ate), d.fuso), plano: { toleranciaDias: p.tolerancia_dias } },
      });
    } else if (passe && (!passe.unidadeId || !d.unidade_id || passe.unidadeId === d.unidade_id)) {
      // check-in de parceiro vale só nos aparelhos da unidade que a plataforma paga
      comando = comandoUpsertUsuario({ userIdEquipamento: userId, nome: p.nome, matricula: { pagoAte: passe.ate, plano: { toleranciaDias: 0 } } });
    } else {
      comando = comandoRemoverUsuario({ userIdEquipamento: userId });
    }
    await enfileirarComando(db, { empresaId, dispositivoId: d.id, chave: `user:${userId}`, comando });
  }
  return disp.rows.length;
}

let temTabelaParceiros = null;
async function validadeDoParceiro(db, empresaId, customerId) {
  if (temTabelaParceiros === null) {
    temTabelaParceiros = (await db.query("SELECT to_regclass('clube_parceiro_checkins') IS NOT NULL AS ok")).rows[0].ok;
  }
  if (!temTabelaParceiros) return null;
  const r = await db.query(
    `SELECT k.expira_em, c.unidade_id FROM clube_parceiro_checkins k JOIN clube_parceiro_contas c ON c.id = k.conta_id
      WHERE k.empresa_id = $1 AND k.customer_id = $2 AND k.status IN ('recebido', 'validando', 'validado', 'falhou') AND k.expira_em > CURRENT_TIMESTAMP
      ORDER BY k.expira_em DESC LIMIT 1`,
    [empresaId, customerId],
  );
  return r.rows[0] ? { ate: new Date(r.rows[0].expira_em), unidadeId: r.rows[0].unidade_id } : null;
}

/** Reenvia todos os alunos ativos a um aparelho (aparelho novo, trocado ou resetado). */
export async function sincronizarDispositivoCompleto(db, empresaId, dispositivoId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const d = await db.query('SELECT id, fuso FROM acesso_dispositivos WHERE empresa_id = $1 AND id = $2 AND ativo', [empresa, exigirUuid(dispositivoId)]);
  if (!d.rows[0]) throw new ErroDominio('NOT_FOUND', 'Dispositivo não encontrado', 404);
  const pessoas = await db.query(
    `SELECT pe.user_id_equipamento, c.nome, m.pago_ate::text AS pago_ate, p.tolerancia_dias
       FROM acesso_matriculas m
       JOIN acesso_planos p ON p.id = m.plano_id
       JOIN acesso_pessoas_equipamento pe ON pe.empresa_id = m.empresa_id AND pe.customer_id = m.customer_id
       JOIN commerce_customers c ON c.empresa_id = m.empresa_id AND c.id = m.customer_id
      WHERE m.empresa_id = $1 AND m.status = 'ativa' AND NOT m.bloqueada`,
    [empresa],
  );
  for (const p of pessoas.rows) {
    const userId = Number(p.user_id_equipamento);
    await enfileirarComando(db, {
      empresaId: empresa,
      dispositivoId,
      chave: `user:${userId}`,
      comando: comandoUpsertUsuario({
        userIdEquipamento: userId,
        nome: p.nome,
        matricula: { pagoAte: fimDoDiaNoFuso(dataISO(p.pago_ate), d.rows[0].fuso), plano: { toleranciaDias: p.tolerancia_dias } },
      }),
    });
  }
  return pessoas.rows.length;
}

/**
 * Entrega ao aparelho os próximos comandos (até `limite`). Comandos enviados sem resultado há mais
 * de 2 min voltam a ser entregues; após 5 tentativas viram erro.
 */
export async function reservarComandos(db, dispositivoId, pushUuid, limite = 20) {
  return transacao(db, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`clube-push:${dispositivoId}`]);
    // 1) Qualquer comando mais novo da mesma chave (em qualquer status) supera os antigos ainda vivos.
    //    Isso impede que um cadastro antigo "ressuscite" depois de uma remoção já confirmada.
    await q(
      `UPDATE acesso_fila_push f SET status = 'erro', erro = 'substituído por comando mais novo'
        WHERE f.dispositivo_id = $1 AND f.status IN ('pendente', 'enviado')
          AND EXISTS (SELECT 1 FROM acesso_fila_push n WHERE n.dispositivo_id = f.dispositivo_id AND n.chave = f.chave AND n.id > f.id)`,
      [dispositivoId],
    );
    // 2) Enviados sem resposta há mais de 2 min voltam para a fila (ou viram erro após 5 tentativas).
    //    Depois do passo 1 só existe um comando vivo por chave, então não há conflito de unicidade.
    await q(
      `UPDATE acesso_fila_push f
          SET status = CASE WHEN f.tentativas >= $2 THEN 'erro' ELSE 'pendente' END,
              erro = CASE WHEN f.tentativas >= $2 THEN 'sem resposta do aparelho' ELSE f.erro END
        WHERE f.dispositivo_id = $1 AND f.status = 'enviado' AND f.enviado_em < $3`,
      [dispositivoId, MAX_TENTATIVAS_PUSH, new Date(Date.now() - REENVIO_APOS_MS)],
    );
    const r = await q(
      `WITH travados AS (
         SELECT id FROM acesso_fila_push
          WHERE dispositivo_id = $1 AND status = 'pendente'
          ORDER BY id LIMIT $3 FOR UPDATE SKIP LOCKED
       ), alvo AS (
         SELECT id, row_number() OVER (ORDER BY id) AS pos FROM travados
       )
       UPDATE acesso_fila_push f
          SET status = 'enviado', push_uuid = $2, posicao = alvo.pos, enviado_em = CURRENT_TIMESTAMP, tentativas = f.tentativas + 1
         FROM alvo WHERE f.id = alvo.id
       RETURNING f.id, f.comando, f.posicao`,
      [dispositivoId, String(pushUuid || '').slice(0, 80), limite],
    );
    return r.rows.sort((x, y) => x.posicao - y.posicao).map((x) => ({ id: Number(x.id), comando: x.comando }));
  });
}

/** Aplica o POST /result: resultados na ordem dos comandos (transactionid = posição). */
export async function concluirComandos(db, dispositivoId, pushUuid, resultados) {
  return transacao(db, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`clube-push:${dispositivoId}`]);
    const enviados = await q(
      "SELECT id, posicao, tentativas FROM acesso_fila_push WHERE dispositivo_id = $1 AND push_uuid = $2 AND status = 'enviado' ORDER BY posicao",
      [dispositivoId, String(pushUuid || '').slice(0, 80)],
    );
    let ok = 0;
    for (const item of enviados.rows) {
      const res = resultados.length === 1 && resultados[0].transactionid == null
        ? resultados[0]
        : resultados.find((x) => x.transactionid === item.posicao);
      if (!res) continue;
      if (res.sucesso) {
        ok += 1;
        await q("UPDATE acesso_fila_push SET status = 'ok', concluido_em = CURRENT_TIMESTAMP, erro = NULL WHERE id = $1", [item.id]);
        continue;
      }
      // falhou: volta para a fila só se não houver comando mais novo da mesma chave
      await q(
        `UPDATE acesso_fila_push f
            SET status = CASE
                  WHEN f.tentativas >= $2 OR EXISTS (SELECT 1 FROM acesso_fila_push n WHERE n.dispositivo_id = f.dispositivo_id AND n.chave = f.chave AND n.id > f.id)
                  THEN 'erro' ELSE 'pendente' END,
                erro = $3
          WHERE f.id = $1`,
        [item.id, MAX_TENTATIVAS_PUSH, String(res.erro || res.resposta || 'erro').slice(0, 500)],
      );
    }
    return ok;
  });
}

export async function resumoFila(db, empresaId, dispositivoId) {
  const r = await db.query(
    `SELECT status, COUNT(*)::int AS total FROM acesso_fila_push
      WHERE empresa_id = $1 AND dispositivo_id = $2 AND criado_em > CURRENT_TIMESTAMP - interval '7 days'
      GROUP BY status`,
    [exigirUuid(empresaId, 'empresa'), exigirUuid(dispositivoId)],
  );
  return Object.fromEntries(r.rows.map((x) => [x.status, x.total]));
}

/* ------------------------------------------------------------------ */
/* Liberação manual                                                    */
/* ------------------------------------------------------------------ */

export async function liberarManual(db, empresaId, dispositivoId, { customerId, operadorId, motivo }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const operador = exigirTexto(operadorId, 'operador', { max: 80 });
  const justificativa = exigirTexto(motivo, 'motivo', { min: 3, max: 240 });
  const d = await db.query(
    'SELECT id, sentido_entrada FROM acesso_dispositivos WHERE empresa_id = $1 AND id = $2 AND ativo',
    [empresa, exigirUuid(dispositivoId)],
  );
  if (!d.rows[0]) throw new ErroDominio('NOT_FOUND', 'Dispositivo não encontrado', 404);
  let cliente = null;
  if (customerId) {
    cliente = exigirUuid(customerId, 'cliente');
    const c = await db.query('SELECT 1 FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresa, cliente]);
    if (!c.rows[0]) throw new ErroDominio('NOT_FOUND', 'Cliente não encontrado nesta empresa', 404);
  }
  await enfileirarComando(db, {
    empresaId: empresa,
    dispositivoId: d.rows[0].id,
    chave: `abrir:${Date.now()}`,
    comando: comandoAbrirCatraca({ sentido: d.rows[0].sentido_entrada }),
  });
  await registrarEvento(db, {
    empresaId: empresa,
    dispositivoId: d.rows[0].id,
    customerId: cliente,
    decisao: 'liberado',
    codigo: 'liberacao_manual',
    mensagem: 'Liberação manual',
    origem: 'manual',
    operadorId: operador,
    motivoManual: justificativa,
  });
  return { ok: true };
}
