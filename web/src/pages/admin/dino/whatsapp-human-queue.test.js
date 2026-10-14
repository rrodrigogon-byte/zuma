import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HUMAN_QUEUE_LIMIT,
  maskQueuePhone,
  queueErrorMessage,
  queueUrl,
  queueWaitLabel,
  validateClaimResponse,
  validateHumanQueueResponse,
} from './whatsapp-human-queue.js'

const EMPRESA = '11111111-1111-4111-8111-111111111111'
const LOJA = '22222222-2222-4222-8222-222222222222'
const CANONICAL = '33333333-3333-4333-8333-333333333333'
const SESSION = '44444444-4444-4444-8444-444444444444'
const NOW = Date.parse('2026-10-13T12:00:00.000Z')

function item(overrides = {}) {
  return {
    id: SESSION,
    telefone: '***9999',
    status: 'humano',
    assigned: false,
    isMine: false,
    assigned_at: null,
    handoff_requested_at: '2026-10-13T11:00:00.000Z',
    ultima_interacao_em: '2026-10-13T11:59:00.000Z',
    handoff_label: 'cliente pediu uma pessoa',
    priority: 2,
    ...overrides,
  }
}

function payload(overrides = {}) {
  return {
    items: [item()],
    canClaim: true,
    selection: { empresaId: EMPRESA, requestedLojaId: LOJA, canonicalLojaId: CANONICAL, inferred: false },
    ...overrides,
  }
}

test('valida allowlist, selection, limite e reduz sem carregar campos brutos', () => {
  const result = validateHumanQueueResponse(payload({ items: [item({ telefone: '5565999999999', nome: 'PII-CANARY', assigned_to: 'secret' })] }), { empresaId: EMPRESA, lojaId: LOJA })
  assert.equal(result.items[0].telefone, '***9999')
  assert.equal('nome' in result.items[0], false)
  assert.equal('assigned_to' in result.items[0], false)
  assert.equal(result.selection.canonicalLojaId, CANONICAL)
  assert.equal(result.items.length, 1)
})

test('rejeita UUID/status/selection/duplicata/campos temporais inválidos e mais de 100', () => {
  for (const bad of [
    payload({ items: [item({ id: 'not-uuid' })] }),
    payload({ items: [item({ status: 'ativo' })] }),
    payload({ selection: { empresaId: EMPRESA, requestedLojaId: 'outra', canonicalLojaId: CANONICAL, inferred: false } }),
    payload({ items: [item(), item()] }),
    payload({ items: [item({ handoff_requested_at: 123 })] }),
    payload({ items: Array.from({ length: HUMAN_QUEUE_LIMIT + 1 }, (_, index) => item({ id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}` })) }),
  ]) assert.throws(() => validateHumanQueueResponse(bad, { empresaId: EMPRESA, lojaId: LOJA }))
  assert.throws(() => validateHumanQueueResponse(payload({ selection: { empresaId: EMPRESA, requestedLojaId: LOJA, canonicalLojaId: CANONICAL, inferred: true } }), { empresaId: EMPRESA, lojaId: LOJA }))
})

test('nunca expõe telefone bruto e usa fallback de conversa', () => {
  assert.equal(maskQueuePhone('5565999999999', SESSION), '***9999')
  assert.equal(maskQueuePhone('sem telefone', SESSION), 'Mensagem/Conversa 44444444')
  assert.equal(maskQueuePhone('5565', SESSION), '***5565')
})

test('tempo de espera não inventa futuro ou data inválida', () => {
  assert.equal(queueWaitLabel('2026-10-13T13:00:00.000Z', NOW), 'não disponível')
  assert.equal(queueWaitLabel('não é data', NOW), 'não disponível')
  assert.equal(queueWaitLabel('2026-10-13T11:00:00.000Z', NOW), 'há 1 h')
})

test('constrói apenas GETs limitados e respostas de claim estritas', () => {
  assert.equal(queueUrl('unassigned'), '/api/admin/commerce/whatsapp-ai/sessions?status=humano&assignment=unassigned&limit=100')
  assert.equal(queueUrl('all'), '/api/admin/commerce/whatsapp-ai/sessions?status=humano&assignment=all&limit=100')
  assert.deepEqual(validateClaimResponse({ id: SESSION, status: 'humano', assigned_to: 'raw-secret' }, SESSION), { id: SESSION, status: 'humano' })
  assert.throws(() => validateClaimResponse({ id: SESSION, status: 'ativo' }, SESSION))
})

test('mapeia falhas sem exibir mensagem bruta de erro', () => {
  assert.equal(queueErrorMessage({ status: 403, message: 'SECRET-CANARY' }), 'Você não tem permissão para consultar a fila humana.')
  assert.equal(queueErrorMessage({ status: 503, message: 'raw backend details' }), 'A fila humana está indisponível agora. Tente atualizar.')
  assert.equal(queueErrorMessage({ uncertain: true, message: 'TOKEN-CANARY' }), 'Não foi possível confirmar com segurança. Atualize a fila antes de tentar novamente.')
})
