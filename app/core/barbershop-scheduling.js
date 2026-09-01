import { db } from './database.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class SchedulingError extends Error {
  constructor(message, code = 'SCHEDULING_ERROR') {
    super(message);
    this.name = 'SchedulingError';
    this.code = code;
  }
}

function uuid(value, field) {
  const normalized = String(value || '').trim();
  if (!UUID_REGEX.test(normalized)) throw new SchedulingError(`${field} inválido`, 'INVALID_ID');
  return normalized;
}

function validDate(value) {
  const normalized = String(value || '').trim();
  if (!DATE_REGEX.test(normalized) || Number.isNaN(Date.parse(`${normalized}T12:00:00Z`))) {
    throw new SchedulingError('data inválida', 'INVALID_DATE');
  }
  return normalized;
}

function validTime(value) {
  const normalized = String(value || '').trim();
  if (!TIME_REGEX.test(normalized)) throw new SchedulingError('horário inválido', 'INVALID_TIME');
  return normalized;
}

function normalizedPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new SchedulingError('telefone inválido', 'INVALID_PHONE');
  return digits;
}

function normalizedName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  if (name.length < 2) throw new SchedulingError('nome do cliente inválido', 'INVALID_CUSTOMER_NAME');
  return name;
}

function tenantScope(context = {}) {
  return {
    empresaId: uuid(context.empresaId, 'empresaId'),
    lojaId: uuid(context.lojaId, 'lojaId'),
  };
}

function slotTimestamp(date, time) {
  return `${validDate(date)}T${validTime(time)}:00`;
}

export async function listSchedulingServices(context) {
  const { empresaId } = tenantScope(context);
  const result = await db.queryRead(
    `SELECT id, nome, descricao, duracao_minutos, preco
       FROM servicos
      WHERE empresa_id = $1 AND ativo = true
      ORDER BY nome`,
    [empresaId],
  );
  return result.rows.map(row => ({
    id: row.id,
    nome: row.nome,
    descricao: row.descricao || '',
    duracaoMinutos: Math.max(15, Number(row.duracao_minutos) || 30),
    preco: Number(row.preco || 0),
  }));
}

export async function listSchedulingProfessionals(context) {
  const { empresaId, lojaId } = tenantScope(context);
  const result = await db.queryRead(
    `SELECT u.id, u.nome_completo, u.telefone
       FROM usuarios u
       JOIN usuarios_lojas ul
         ON ul.usuario_id = u.id AND ul.loja_id = $2 AND ul.ativo = true
      WHERE u.empresa_id = $1
        AND u.ativo = true
        AND COALESCE(NULLIF(ul.role_loja, ''), u.role) = 'barbeiro'
      ORDER BY u.nome_completo`,
    [empresaId, lojaId],
  );
  return result.rows.map(row => ({ id: row.id, nome: row.nome_completo, telefone: row.telefone || '' }));
}

export async function listSchedulingAvailability(context, input = {}) {
  const { empresaId, lojaId } = tenantScope(context);
  const professionalId = uuid(input.professionalId, 'professionalId');
  const serviceId = uuid(input.serviceId, 'serviceId');
  const date = validDate(input.date);
  const dateValue = new Date(`${date}T12:00:00Z`);
  const today = new Date();
  const minimum = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const maximum = minimum + (90 * 24 * 60 * 60 * 1000);
  if (dateValue.getTime() < minimum || dateValue.getTime() > maximum) {
    throw new SchedulingError('a data deve estar entre hoje e os próximos 90 dias', 'DATE_OUT_OF_RANGE');
  }

  const [service, professional, occupied] = await Promise.all([
    db.queryRead(
      `SELECT id, nome, duracao_minutos, preco FROM servicos
        WHERE id = $1 AND empresa_id = $2 AND ativo = true LIMIT 1`,
      [serviceId, empresaId],
    ),
    db.queryRead(
      `SELECT u.id, u.nome_completo
         FROM usuarios u
         JOIN usuarios_lojas ul ON ul.usuario_id = u.id AND ul.loja_id = $3 AND ul.ativo = true
        WHERE u.id = $1 AND u.empresa_id = $2 AND u.ativo = true
          AND COALESCE(NULLIF(ul.role_loja, ''), u.role) = 'barbeiro'
        LIMIT 1`,
      [professionalId, empresaId, lojaId],
    ),
    db.queryRead(
      `SELECT data_agendamento AS inicio,
              data_agendamento + (COALESCE(duracao_minutos, 30)::text || ' minutes')::interval AS fim
         FROM agendamentos
        WHERE empresa_id = $1 AND loja_id = $2 AND usuario_profissional_id = $3
          AND data_agendamento >= $4::date
          AND data_agendamento < ($4::date + INTERVAL '1 day')
          AND status NOT IN ('cancelado', 'nao_compareceu')
       UNION ALL
       SELECT data_inicio AS inicio, data_fim AS fim
         FROM agendamentos_bloqueios
        WHERE empresa_id = $1 AND (loja_id = $2 OR loja_id IS NULL)
          AND usuario_profissional_id = $3 AND ativo = true
          AND data_inicio < ($4::date + INTERVAL '1 day') AND data_fim > $4::date`,
      [empresaId, lojaId, professionalId, date],
    ),
  ]);

  if (!service.rows[0]) throw new SchedulingError('serviço não encontrado', 'SERVICE_NOT_FOUND');
  if (!professional.rows[0]) throw new SchedulingError('profissional não encontrado na unidade', 'PROFESSIONAL_NOT_FOUND');

  const duration = Math.max(15, Number(service.rows[0].duracao_minutos) || 30);
  const openingMinutes = 8 * 60;
  const closingMinutes = 20 * 60;
  const occupiedRanges = occupied.rows.map(row => ({ start: new Date(row.inicio).getTime(), end: new Date(row.fim).getTime() }));
  const slots = [];
  for (let minute = openingMinutes; minute + duration <= closingMinutes; minute += 30) {
    const hour = String(Math.floor(minute / 60)).padStart(2, '0');
    const min = String(minute % 60).padStart(2, '0');
    const timestamp = new Date(`${date}T${hour}:${min}:00`).getTime();
    const end = timestamp + duration * 60 * 1000;
    const available = !occupiedRanges.some(range => timestamp < range.end && end > range.start)
      && timestamp > Date.now();
    if (available) slots.push(`${hour}:${min}`);
  }

  return {
    date,
    service: {
      id: service.rows[0].id,
      nome: service.rows[0].nome,
      duracaoMinutos: duration,
      preco: Number(service.rows[0].preco || 0),
    },
    professional: { id: professional.rows[0].id, nome: professional.rows[0].nome_completo },
    slots,
  };
}

export async function createScheduledAppointment(trx, context, input = {}) {
  const { empresaId, lojaId } = tenantScope(context);
  const serviceId = uuid(input.serviceId, 'serviceId');
  const professionalId = uuid(input.professionalId, 'professionalId');
  const customerName = normalizedName(input.customerName);
  const customerPhone = normalizedPhone(input.customerPhone);
  const startsAt = slotTimestamp(input.date, input.time);

  const scope = await trx.query(
    `SELECT s.id AS servico_id, s.nome AS servico_nome,
            COALESCE(s.duracao_minutos, 30) AS duracao_minutos, s.preco,
            u.id AS profissional_id, u.nome_completo AS profissional_nome
       FROM servicos s
       JOIN usuarios u ON u.id = $2 AND u.empresa_id = $3 AND u.ativo = true
       JOIN usuarios_lojas ul ON ul.usuario_id = u.id AND ul.loja_id = $4 AND ul.ativo = true
      WHERE s.id = $1 AND s.empresa_id = $3 AND s.ativo = true
        AND COALESCE(NULLIF(ul.role_loja, ''), u.role) = 'barbeiro'
      LIMIT 1`,
    [serviceId, professionalId, empresaId, lojaId],
  );
  if (!scope.rows[0]) throw new SchedulingError('serviço ou profissional fora do escopo da unidade', 'SCHEDULE_SCOPE_MISMATCH');
  const selected = scope.rows[0];
  const duration = Math.max(15, Number(selected.duracao_minutos) || 30);

  await trx.query(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [`schedule:${empresaId}:${lojaId}:${professionalId}:${String(input.date)}`],
  );
  const conflict = await trx.query(
    `SELECT 1
       FROM agendamentos
      WHERE empresa_id = $1 AND loja_id = $2 AND usuario_profissional_id = $3
        AND status NOT IN ('cancelado', 'nao_compareceu')
        AND data_agendamento < $4::timestamp + ($5::text || ' minutes')::interval
        AND data_agendamento + (COALESCE(duracao_minutos, 30)::text || ' minutes')::interval > $4::timestamp
      UNION ALL
     SELECT 1
       FROM agendamentos_bloqueios
      WHERE empresa_id = $1 AND (loja_id = $2 OR loja_id IS NULL)
        AND usuario_profissional_id = $3 AND ativo = true
        AND data_inicio < $4::timestamp + ($5::text || ' minutes')::interval
        AND data_fim > $4::timestamp
      LIMIT 1`,
    [empresaId, lojaId, professionalId, startsAt, duration],
  );
  if (conflict.rows[0]) throw new SchedulingError('horário indisponível', 'SLOT_UNAVAILABLE');

  const result = await trx.query(
    `INSERT INTO agendamentos
      (empresa_id, loja_id, servico_id, usuario_profissional_id, cliente_nome, cliente_telefone,
       data_agendamento, duracao_minutos, valor, tipo_agendamento, status, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, $9, 'barbearia', 'agendado', $10)
     RETURNING id, data_agendamento, status`,
    [empresaId, lojaId, serviceId, professionalId, customerName, customerPhone, startsAt, duration, Number(selected.preco || 0), String(input.notes || '').slice(0, 1000) || null],
  );
  return {
    id: result.rows[0].id,
    status: result.rows[0].status,
    dataHora: result.rows[0].data_agendamento,
    servico: selected.servico_nome,
    profissional: selected.profissional_nome,
    duracaoMinutos: duration,
    valor: Number(selected.preco || 0),
    cliente: customerName,
  };
}
