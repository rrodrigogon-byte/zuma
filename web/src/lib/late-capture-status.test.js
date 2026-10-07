import assert from 'node:assert/strict'
import test from 'node:test'
import { hasLateCaptureReview, LATE_CAPTURE_COPY } from './late-capture-status.js'

const late = { status: 'cancelled', payment_status: 'captured', payment_review_status: 'refund_required' }
test('aviso somente com captura confirmada após cancelamento', () => {
  assert.equal(hasLateCaptureReview(late), true)
  assert.equal(hasLateCaptureReview({ ...late, payment_status: 'pending' }), false)
  assert.equal(hasLateCaptureReview({ ...late, status: 'paid' }), false)
  assert.equal(hasLateCaptureReview({ ...late, payment_review_status: null }), false)
  assert.equal(hasLateCaptureReview({ ...late, coreStatus: 'paid' }), false)
  assert.equal(hasLateCaptureReview(null), false)
})
test('aviso não promete estorno concluído nem liberação de entrega', () => {
  assert.match(LATE_CAPTURE_COPY.detail, /não foi concluído/i)
  assert.match(LATE_CAPTURE_COPY.delivery, /sem preparação ou entrega/i)
  assert.match(LATE_CAPTURE_COPY.delivery, /Não pague novamente/i)
})
