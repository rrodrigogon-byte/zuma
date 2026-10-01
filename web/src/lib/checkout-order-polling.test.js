import assert from 'node:assert/strict'
import test from 'node:test'
import { createCheckoutOrderPoller } from './checkout-order-polling.js'

test('polling do checkout aplica pending e encerra em captured sem rede', async () => {
  const scheduled = []
  const applied = []
  const responses = [
    { public_code: 'KC-POLL-1', status: 'pending_payment', payment_status: 'pending' },
    { public_code: 'KC-POLL-1', status: 'pending_payment', payment_status: 'captured' },
  ]
  let loads = 0
  const poller = createCheckoutOrderPoller({
    load: async () => {
      const response = responses[loads]
      loads += 1
      return response
    },
    apply: latest => applied.push(latest),
    schedule: callback => {
      scheduled.push(callback)
      return scheduled.length
    },
    cancelSchedule: () => {},
    now: () => 0,
    initialDelay: 0,
    maxDelay: 0,
    timeout: 1000,
  })

  assert.equal(scheduled.length, 1)
  await scheduled.shift()()
  assert.equal(poller.active, true)
  assert.equal(scheduled.length, 1)

  await scheduled.shift()()
  assert.equal(poller.active, false)
  assert.equal(scheduled.length, 0)
  assert.equal(loads, 2)
  assert.deepEqual(applied.map(item => item.payment_status), ['pending', 'captured'])
})
