import crypto from 'node:crypto';
import { fingerprintPayload, sanitizePayload } from './dino-operational-outbox.js';

const SOURCE_TYPES = new Set(['comanda', 'revenda']);
const TERMINAL = new Set(['completed', 'skipped']);
const EFFECT_ORDER = ['payment', 'financial', 'cash', 'inventory', 'loyalty', 'commission', 'audit', 'source'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_RE = /^[0-9a-f]{64}$/i;
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;
const SECRET_RE = /(?:password|passwd|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|refresh[_-]?token|access[_-]?token|bearer|jwt)/i;

export class DinoReversalError extends Error {
  constructor(message, { code = 'DINO_REVERSAL_ERROR', status = 400, details, retryable } = {}) {
    super(message);
    this.name = 'DinoReversalError';
    this.code = code;
    this.status = status;
    this.statusCode = status;
    if (details !== undefined) this.details = details;
    if (retryable !== undefined) this.retryable = retryable;
  }
}

function fail(message, code, status = 400, details = {}) {
  throw new DinoReversalError(message, { code, status, details });
}

function text(value, label, max = 255, required = true) {
  const result = String(value ?? '').trim();
  if (required && !result) fail(`${label} é obrigatório.`, `DINO_${label.toUpperCase()}_REQUIRED`);
  if (result.length > max || CONTROL_RE.test(result)) {
    CONTROL_RE.lastIndex = 0;
    fail(`${label} inválido.`, `DINO_${label.toUpperCase()}_INVALID`);
  }
  CONTROL_RE.lastIndex = 0;
  return result;
}

function optionalText(value, label, max = 255) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, label, max, false) || null;
}

function read(value, ...names) {
  for (const name of names) if (value && value[name] !== undefined && value[name] !== null) return value[name];
  return undefined;
}

function contextOf(context = {}) {
  const empresaId = text(read(context, 'empresaId', 'empresa_id'), 'empresaId', 180);
  const lojaId = text(read(context, 'lojaId', 'loja_id'), 'lojaId', 180);
  return { empresaId, lojaId };
}

function actionIdOf(value) {
  const result = text(value, 'actionId', 180);
  // UUIDs are required by PostgreSQL. Legacy adapters may use an opaque id, but
  // never accept whitespace, control characters, or a secret-looking value.
  if (SECRET_RE.test(result)) fail('actionId inválido.', 'DINO_ACTION_ID_INVALID');
  return result;
}

function fingerprintOf(input, normalized) {
  const supplied = read(input, 'fingerprint');
  if (supplied !== undefined && (!HEX_RE.test(String(supplied).trim()) || String(supplied).trim().length !== 64)) {
    fail('fingerprint inválido.', 'DINO_FINGERPRINT_INVALID');
  }
  const payload = sanitizePayload({
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
    motivo: normalized.motivo,
    operador: normalized.operador,
    approvedBy: normalized.approvedBy,
    confirmado: normalized.confirmado,
    ...(read(input, 'payload', 'details', 'detalhes') || {}),
  });
  const calculated = fingerprintPayload(payload);
  if (supplied !== undefined && String(supplied).trim().toLowerCase() !== calculated) {
    fail('fingerprint não corresponde ao payload da reversão.', 'DINO_FINGERPRINT_MISMATCH', 409);
  }
  return calculated;
}

function normalizeInput(input = {}, context) {
  const sourceType = String(read(input, 'sourceType', 'source_type', 'tipoOrigem', 'tipo_origem') || '').trim().toLowerCase();
  if (!SOURCE_TYPES.has(sourceType)) fail('sourceType deve ser comanda ou revenda.', 'DINO_SOURCE_TYPE_INVALID');
  const sourceId = text(read(input, 'sourceId', 'source_id', 'id'), 'sourceId', 180);
  const motivo = text(read(input, 'motivo', 'reason'), 'motivo', 500);
  const operador = text(read(input, 'operador', 'operatorId', 'operator_id', 'usuarioId', 'usuario_id', 'usuario', 'approvedBy', 'approved_by') ?? context.operador, 'operador', 180);
  const approvedBy = optionalText(read(input, 'approvedBy', 'approved_by') ?? operador, 'approvedBy', 180);
  const confirmado = read(input, 'confirmado', 'confirmed', 'confirmacao', 'confirmation') === true;
  if (!confirmado) fail('A reversão exige confirmação explícita.', 'DINO_REVERSAL_CONFIRMATION_REQUIRED', 409);
  const actionId = actionIdOf(read(input, 'actionId', 'action_id'));
  const idempotencyKey = text(read(input, 'idempotencyKey', 'idempotency_key', 'chaveIdempotencia', 'chave_idempotencia'), 'idempotencyKey', 255);
  const result = { sourceType, sourceId, motivo, operador, approvedBy, confirmado, actionId, idempotencyKey };
  result.fingerprint = fingerprintOf(input, result);
  result.payload = sanitizePayload(read(input, 'payload', 'details', 'detalhes') || {});
  result.correlationId = optionalText(read(input, 'correlationId', 'correlation_id'), 'correlationId', 180);
  return result;
}

function actionKey(context, idempotencyKey) {
  return `${context.empresaId}:${context.lojaId}:${idempotencyKey}`;
}

function effectKey(actionId, effect) {
  return `${actionId}:${effect}`;
}

function safeError(error) {
  const code = String(error?.code || error?.name || 'DINO_REVERSAL_EFFECT_ERROR').replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 90) || 'DINO_REVERSAL_EFFECT_ERROR';
  const message = String(error?.message || error || 'erro não identificado').replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
  return { code, message: message || 'erro não identificado', retryable: error?.retryable !== false };
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function normalizeEffectResult(result) {
  if (result === undefined || result === null) return { status: 'completed', result: {} };
  if (typeof result !== 'object' || Array.isArray(result)) return { status: 'completed', result: sanitizePayload({ value: result }) };
  const status = String(result.status || result.estado || (result.pending ? 'pending' : result.manualRequired ? 'manual_required' : result.skipped ? 'skipped' : 'completed')).toLowerCase();
  const allowed = new Set(['completed', 'pending', 'manual_required', 'failed', 'skipped']);
  const normalizedStatus = allowed.has(status) ? status : 'completed';
  const pending = Array.isArray(result.pending) ? result.pending : result.pending ? [String(result.pending)] : [];
  const safe = {};
  for (const [key, value] of Object.entries(result)) {
    if (key === 'status' || key === 'estado' || key === 'pending' || key === 'manualRequired') continue;
    if (SECRET_RE.test(key)) continue;
    try { safe[key] = sanitizePayload(value); } catch { /* never persist unsafe adapter output */ }
  }
  return { status: normalizedStatus, result: safe, pending, manualRequired: normalizedStatus === 'manual_required' || result.manualRequired === true };
}

function expectedEffects(source, sourceType) {
  const payments = Array.isArray(source?.pagamentos) ? source.pagamentos : source?.pagamento ? [source.pagamento] : [];
  const hasCash = payments.some(item => String(item?.meio || item?.meioPagamento || '').toLowerCase() === 'dinheiro' && (item?.caixaMovimentoId || item?.caixaId));
  const hasFinancial = sourceType === 'comanda'
    ? Array.isArray(source?.financeiroLancamentoIds) && source.financeiroLancamentoIds.length > 0
    : Boolean(source?.financeiroLancamentoId);
  const hasLoyalty = Boolean(source?.fidelidadeMovimentoId || source?.fidelidadeValorPontuado || source?.clienteId || source?.clienteTelefone);
  return { payment: true, financial: hasFinancial, cash: hasCash, inventory: true, loyalty: hasLoyalty, commission: true, audit: true, source: true };
}

function handlerFor(deps, effect) {
  const effects = deps?.effects || deps?.effectAdapters || {};
  const aliases = {
    payment: ['payment', 'pagamento', 'provider', 'refund'],
    financial: ['financial', 'financeiro', 'ledger'],
    cash: ['cash', 'caixa'],
    inventory: ['inventory', 'estoque'],
    loyalty: ['loyalty', 'fidelidade', 'cashback'],
    commission: ['commission', 'comissao', 'comissão'],
    audit: ['audit', 'auditoria'],
    source: ['source', 'origin', 'origem'],
  };
  for (const key of aliases[effect] || [effect]) if (typeof effects[key] === 'function') return effects[key];
  if (typeof deps?.[effect] === 'function') return deps[effect];
  return null;
}

function inMemoryState() {
  return { actions: new Map(), actionsById: new Map(), effects: new Map(), links: new Map() };
}

export function createDinoReversalMemoryAdapter(state = inMemoryState()) {
  const ensure = () => {
    state.actions ||= new Map(); state.actionsById ||= new Map(); state.effects ||= new Map(); state.links ||= new Map();
  };
  let lock = Promise.resolve();
  const serial = async callback => {
    const previous = lock;
    let release;
    lock = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await callback(); } finally { release(); }
  };
  return {
    kind: 'memory',
    state,
    async transaction(callback) { return serial(callback); },
    async getAction(context, key) { ensure(); return clone(state.actions.get(actionKey(context, key)) || null); },
    async getActionById(context, id) { ensure(); const action = state.actionsById.get(`${context.empresaId}:${context.lojaId}:${id}`); return clone(action || null); },
    async insertAction(context, input) {
      ensure();
      const key = actionKey(context, input.idempotencyKey);
      const existing = state.actions.get(key);
      if (existing) return { action: clone(existing), inserted: false };
      const action = {
        id: input.actionId, empresaId: context.empresaId, lojaId: context.lojaId,
        actionType: `dino_reversal:${input.sourceType}`, idempotencyKey: input.idempotencyKey,
        fingerprint: input.fingerprint, status: 'requested', motivo: input.motivo,
        sourceType: input.sourceType, sourceId: input.sourceId, correlationId: input.correlationId,
        requestedBy: input.operador, approvedBy: input.approvedBy, payloadSanitizado: clone(input.payload),
        effects: {}, pending: [], manualRequired: false, criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
      };
      state.actions.set(key, action); state.actionsById.set(`${context.empresaId}:${context.lojaId}:${input.actionId}`, action);
      return { action: clone(action), inserted: true };
    },
    async updateAction(context, id, patch) {
      ensure(); const key = `${context.empresaId}:${context.lojaId}:${id}`; const action = state.actionsById.get(key);
      if (!action) return null; Object.assign(action, clone(patch), { atualizadoEm: new Date().toISOString() }); return clone(action);
    },
    async getEffect(context, id, effect) { ensure(); return clone(state.effects.get(`${context.empresaId}:${context.lojaId}:${effectKey(id, effect)}`) || null); },
    async saveEffect(context, id, effect, value) {
      ensure(); const key = `${context.empresaId}:${context.lojaId}:${effectKey(id, effect)}`; state.effects.set(key, { actionId: id, effect, ...clone(value), atualizadoEm: new Date().toISOString() }); return clone(state.effects.get(key));
    },
    async link(context, id, link) { ensure(); const key = `${context.empresaId}:${context.lojaId}:${id}:${link.linkType}:${link.subjectType}:${link.subjectId}`; if (!state.links.has(key)) state.links.set(key, { ...clone(link), actionId: id }); return clone(state.links.get(key)); },
    async listEffects(context, id) { ensure(); return [...state.effects.values()].filter(row => row.actionId === id && row.empresaId !== 'never' && (!row.lojaId || row.lojaId === context.lojaId)).map(clone); },
  };
}

const defaultMemoryAdapter = createDinoReversalMemoryAdapter();
export function getDinoReversalMemoryAdapter() { return defaultMemoryAdapter; }

function rowOf(result) { return result?.rows?.[0] || null; }
function rowsOf(result) { return Array.isArray(result?.rows) ? result.rows : []; }

/** Adapter SQL. Migration 083 owns the tables; no schema is fabricated at runtime. */
export function createDinoReversalPgAdapter(database) {
  if (!database || typeof database.query !== 'function' || typeof database.transaction !== 'function') {
    throw new DinoReversalError('Adapter PostgreSQL de estorno ausente.', { code: 'DINO_REVERSAL_PG_REQUIRED', status: 503 });
  }
  const query = (trx, sql, params) => trx.query(sql, params);
  return {
    kind: 'postgres',
    async transaction(callback) { return database.transaction(callback); },
    async getAction(context, key, trx = database) {
      const result = await query(trx, 'SELECT * FROM dino_reversal_actions WHERE empresa_id=$1 AND loja_id=$2 AND idempotency_key=$3 FOR UPDATE', [context.empresaId, context.lojaId, key]);
      return rowOf(result);
    },
    async getActionById(context, id, trx = database) {
      const result = await query(trx, 'SELECT * FROM dino_reversal_actions WHERE empresa_id=$1 AND loja_id=$2 AND id=$3::uuid FOR UPDATE', [context.empresaId, context.lojaId, id]);
      return rowOf(result);
    },
    async insertAction(context, input, trx = database) {
      const inserted = await query(trx, `INSERT INTO dino_reversal_actions
        (id, empresa_id, loja_id, action_type, idempotency_key, fingerprint, status, motivo, source_type, source_id, correlation_id, requested_by, approved_by)
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,'requested',$7,$8,$9,$10,$11::uuid,$12::uuid)
        ON CONFLICT (empresa_id, loja_id, idempotency_key) DO NOTHING RETURNING *`,
      [input.actionId, context.empresaId, context.lojaId, `dino_reversal:${input.sourceType}`, input.idempotencyKey, input.fingerprint, input.motivo, input.sourceType, input.sourceId, input.correlationId, input.operador, input.approvedBy]);
      if (inserted.rowCount) return { action: rowOf(inserted), inserted: true };
      return { action: await this.getAction(context, input.idempotencyKey, trx), inserted: false };
    },
    async updateAction(context, id, patch, trx = database) {
      const allowed = { status: patch.status, erro: patch.erro || null };
      const result = await query(trx, `UPDATE dino_reversal_actions SET status=$1 WHERE empresa_id=$2::uuid AND loja_id=$3::uuid AND id=$4::uuid RETURNING *`, [allowed.status, context.empresaId, context.lojaId, id]);
      return rowOf(result);
    },
    async getEffect(context, id, effect, trx = database) {
      const result = await query(trx, 'SELECT * FROM dino_effect_outbox WHERE empresa_id=$1::uuid AND loja_id=$2::uuid AND action_id=$3::uuid AND efeito=$4 ORDER BY criado_em LIMIT 1 FOR UPDATE', [context.empresaId, context.lojaId, id, `dino_reversal.${effect}`]);
      return rowOf(result);
    },
    async saveEffect(context, id, effect, value, trx = database) {
      const payload = sanitizePayload(value.result || {});
      const key = `${id}:${effect}`;
      const result = await query(trx, `INSERT INTO dino_effect_outbox
        (empresa_id,loja_id,efeito,idempotency_key,fingerprint,payload_sanitizado,status,action_id)
        VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7,$8::uuid)
        ON CONFLICT (empresa_id,loja_id,idempotency_key) DO UPDATE SET status=EXCLUDED.status, payload_sanitizado=EXCLUDED.payload_sanitizado
        RETURNING *`, [context.empresaId, context.lojaId, `dino_reversal.${effect}`, key, fingerprintPayload({ effect, actionId: id }), JSON.stringify(payload), value.status === 'completed' || value.status === 'skipped' ? 'succeeded' : 'failed', id]);
      return rowOf(result);
    },
    async link(context, id, link, trx = database) {
      const result = await query(trx, `INSERT INTO dino_reversal_links (empresa_id,loja_id,action_id,link_type,subject_type,subject_id,amount,payload_sanitizado)
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::jsonb)
        ON CONFLICT (empresa_id,loja_id,action_id,link_type,subject_type,subject_id) DO NOTHING RETURNING *`, [context.empresaId, context.lojaId, id, link.linkType, link.subjectType, link.subjectId, link.amount ?? null, JSON.stringify(sanitizePayload(link.payload || {}))]);
      return rowOf(result) || link;
    },
    async listEffects(context, id, trx = database) {
      const result = await query(trx, 'SELECT * FROM dino_effect_outbox WHERE empresa_id=$1::uuid AND loja_id=$2::uuid AND action_id=$3::uuid ORDER BY criado_em', [context.empresaId, context.lojaId, id]);
      return rowsOf(result);
    },
  };
}

function storageFor(deps = {}) {
  if (deps.adapter) return deps.adapter;
  if (deps.storage) return deps.storage;
  if (deps.db) return createDinoReversalPgAdapter(deps.db);
  if (deps.allowMemory === true || process.env.NODE_ENV !== 'production') return defaultMemoryAdapter;
  throw new DinoReversalError('Persistência de estorno coordenado indisponível; operação bloqueada.', { code: 'DINO_REVERSAL_STORAGE_REQUIRED', status: 503 });
}

function assertReplayOrConflict(existing, input) {
  if (!existing) return;
  const existingFingerprint = String(existing.fingerprint || '').toLowerCase();
  const existingSourceType = String(existing.source_type || existing.sourceType || '');
  const existingSourceId = String(existing.source_id || existing.sourceId || '');
  if (existingFingerprint !== input.fingerprint || (existingSourceType && existingSourceType !== input.sourceType) || (existingSourceId && existingSourceId !== input.sourceId)) {
    fail('A chave de idempotência já foi usada com payload divergente.', 'DINO_REVERSAL_IDEMPOTENCY_CONFLICT', 409);
  }
}

export async function requestDinoReversal(context, input, deps = {}) {
  const scope = contextOf(context);
  const normalized = normalizeInput(input, context || {});
  const adapter = storageFor(deps);
  const operation = async trx => {
    const byKey = await adapter.getAction(scope, normalized.idempotencyKey, trx);
    if (byKey) {
      assertReplayOrConflict(byKey, normalized);
      return { ...clone(byKey), replayed: true, idempotent: true, status: publicStatus(byKey) };
    }
    const byId = await adapter.getActionById(scope, normalized.actionId, trx);
    if (byId) {
      assertReplayOrConflict(byId, normalized);
      fail('actionId já usado com outra chave de idempotência.', 'DINO_REVERSAL_ACTION_CONFLICT', 409);
    }
    if (typeof deps.assertSource === 'function') await deps.assertSource(scope, normalized);
    const created = await adapter.insertAction(scope, normalized, trx);
    const action = created.action;
    if (!action) fail('Não foi possível criar a ação de estorno.', 'DINO_REVERSAL_ACTION_CREATE_FAILED', 503);
    assertReplayOrConflict(action, normalized);
    if (created.inserted !== false) {
      for (const effect of EFFECT_ORDER) await adapter.link(scope, normalized.actionId, { linkType: 'reversal_effect', subjectType: 'effect', subjectId: effect, payload: { sourceType: normalized.sourceType, sourceId: normalized.sourceId, actionId: normalized.actionId } }, trx);
    }
    return { ...clone(action), replayed: created.inserted === false, idempotent: created.inserted === false, status: publicStatus(action) };
  };
  return typeof adapter.transaction === 'function' ? adapter.transaction(operation) : operation(adapter);
}

function publicStatus(action) {
  if (!action) return 'not_found';
  if (action.status === 'completed' || action.status === 'succeeded') return 'completed';
  if (action.manualRequired === true || action.manual_required === true) return 'manual_required';
  if (action.status === 'failed') return 'failed';
  if (action.status === 'pending' || action.status === 'processing' || action.status === 'executing') return 'pending';
  return 'pending';
}

function actionIdFrom(action) { return String(action?.id || action?.action_id || ''); }
function actionValue(action, name) { return action?.[name] ?? action?.[name.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)]; }

async function sourceFor(scope, normalized, deps) {
  if (typeof deps.resolveSource === 'function') {
    const source = await deps.resolveSource(scope, normalized);
    if (!source) fail('Origem do estorno não encontrada.', 'DINO_SOURCE_NOT_FOUND', 404);
    const sourceEmpresa = String(source.empresaId ?? source.empresa_id ?? scope.empresaId);
    const sourceLoja = String(source.lojaId ?? source.loja_id ?? '');
    if (sourceEmpresa !== scope.empresaId || sourceLoja !== scope.lojaId) fail('A origem não pertence à empresa/unidade ativa.', 'DINO_SOURCE_SCOPE_MISMATCH', 409);
    return source;
  }
  if (deps.source) return deps.source;
  fail('Resolver da origem do estorno ausente.', 'DINO_SOURCE_RESOLVER_REQUIRED', 503);
}

function statusFromEffects(effects) {
  const rows = Object.values(effects || {});
  if (rows.some(row => row.status === 'manual_required')) return 'manual_required';
  if (rows.some(row => row.status === 'failed')) return 'failed';
  if (rows.some(row => row.status === 'pending')) return 'pending';
  return 'completed';
}

export async function executeDinoReversal(context, input, deps = {}) {
  const scope = contextOf(context);
  const normalized = normalizeInput(input, context || {});
  const adapter = storageFor(deps);
  // Resolve and scope-check the source before inserting the idempotent action.
  // A cross-store request must leave no actionable orphan in the tenant ledger.
  const source = await sourceFor(scope, normalized, deps);
  const request = await requestDinoReversal(scope, normalized, { ...deps, adapter });
  const actionId = actionIdFrom(request);
  if (!actionId) fail('Ação de estorno não localizada.', 'DINO_REVERSAL_ACTION_NOT_FOUND', 404);
  if (source?.dinoReversal?.actionId && source.dinoReversal.actionId !== actionId) fail('A origem já possui estorno coordenado por outra ação.', 'DINO_SOURCE_ALREADY_REVERSED', 409);
  const effects = {};
  const prior = typeof adapter.listEffects === 'function' ? await adapter.listEffects(scope, actionId) : [];
  for (const row of prior || []) {
    const effect = String(row.effect || row.efeito || '').replace(/^dino_reversal\./, '');
    if (effect) effects[effect] = row;
  }
  const expected = expectedEffects(source, normalized.sourceType);
  const pending = [];
  let failed = false;
  let manual = false;
  const run = async trx => {
    await adapter.updateAction(scope, actionId, { status: 'executing' }, trx);
    for (const effect of EFFECT_ORDER) {
      if (!expected[effect]) {
        effects[effect] ||= { effect, status: 'skipped', result: { reason: 'not_applicable' } };
        continue;
      }
      const previous = effects[effect] || await adapter.getEffect(scope, actionId, effect, trx);
      if (previous && TERMINAL.has(String(previous.status))) { effects[effect] = previous; continue; }
      const handler = handlerFor(deps, effect);
      let normalizedResult;
      if (!handler) {
        if (effect === 'payment') {
          const payments = Array.isArray(source?.pagamentos) ? source.pagamentos : source?.pagamento ? [source.pagamento] : [];
          const providerPayment = payments.some(item => !['dinheiro', 'conta'].includes(String(item?.meio || item?.meioPagamento || '').toLowerCase()));
          normalizedResult = providerPayment
            ? { status: 'manual_required', pending: ['gateway_refund_adapter'], result: { reason: 'gateway_missing', refundRequired: true } }
            : { status: 'completed', result: { reason: 'no_external_provider_refund' } };
        } else if (effect === 'audit') {
          normalizedResult = { status: 'completed', result: { recorded: true, sanitized: true } };
        } else {
          normalizedResult = { status: 'manual_required', pending: [`handler:${effect}`], result: { reason: 'handler_missing' } };
        }
      } else {
        try {
          const result = await handler({ context: scope, input: normalized, source, actionId, idempotencyKey: normalized.idempotencyKey, effect, deps });
          normalizedResult = normalizeEffectResult(result);
        } catch (error) {
          const safe = safeError(error);
          normalizedResult = { status: safe.retryable ? 'pending' : 'manual_required', pending: [safe.code], result: { error: safe.message, code: safe.code } };
          if (!safe.retryable) manual = true;
          if (safe.retryable) failed = true;
        }
      }
      effects[effect] = { effect, status: normalizedResult.status, result: normalizedResult.result, pending: normalizedResult.pending || [], manualRequired: normalizedResult.manualRequired === true };
      if (normalizedResult.status === 'pending') failed = true;
      if (normalizedResult.status === 'manual_required') manual = true;
      pending.push(...(normalizedResult.pending || []));
      await adapter.saveEffect(scope, actionId, effect, effects[effect], trx);
    }
    const status = manual ? 'manual_required' : failed ? 'pending' : 'completed';
    const dbStatus = status === 'completed' ? 'completed' : 'failed';
    await adapter.updateAction(scope, actionId, { status: dbStatus, manualRequired: manual, pending: [...new Set(pending)], effects }, trx);
    return status;
  };
  const status = typeof adapter.transaction === 'function' ? await adapter.transaction(run) : await run(adapter);
  const result = { actionId, empresaId: scope.empresaId, lojaId: scope.lojaId, sourceType: normalized.sourceType, sourceId: normalized.sourceId, status, replayed: Boolean(request.replayed), idempotencyKey: normalized.idempotencyKey, effects: Object.values(effects).map(clone), pending: [...new Set(pending)] };
  if (typeof deps.markSource === 'function') {
    await deps.markSource({ context: scope, input: normalized, source, actionId, status, result });
  }
  return result;
}

export async function getDinoReversalStatus(context, selector, deps = {}) {
  const scope = contextOf(context);
  const adapter = storageFor(deps);
  const selectorIsAction = typeof selector !== 'string' && read(selector, 'actionId', 'action_id') !== undefined;
  const key = typeof selector === 'string' ? selector : read(selector, 'idempotencyKey', 'idempotency_key', 'actionId', 'action_id');
  if (!key) fail('actionId ou idempotencyKey é obrigatório.', 'DINO_STATUS_SELECTOR_REQUIRED');
  const action = (selectorIsAction || (String(key).includes('-') && UUID_RE.test(String(key)))) && typeof adapter.getActionById === 'function'
    ? await adapter.getActionById(scope, String(key))
    : await adapter.getAction(scope, String(key));
  if (!action) return { found: false, empresaId: scope.empresaId, lojaId: scope.lojaId, status: 'not_found' };
  const actionId = actionIdFrom(action);
  const effects = typeof adapter.listEffects === 'function' ? await adapter.listEffects(scope, actionId) : [];
  return { found: true, actionId, empresaId: scope.empresaId, lojaId: scope.lojaId, sourceType: actionValue(action, 'sourceType'), sourceId: actionValue(action, 'sourceId'), idempotencyKey: actionValue(action, 'idempotencyKey'), fingerprint: action.fingerprint, status: publicStatus({ ...action, manualRequired: action.manualRequired || action.manual_required, status: statusFromEffects(Object.fromEntries(effects.map(item => [item.effect || item.efeito, item]))) }), replayed: true, effects: effects.map(clone) };
}

export default {
  DinoReversalError,
  createDinoReversalMemoryAdapter,
  createDinoReversalPgAdapter,
  getDinoReversalMemoryAdapter,
  requestDinoReversal,
  executeDinoReversal,
  getDinoReversalStatus,
};
