const DEFAULT_TERMINAL_ORDER_STATUSES = new Set([
  'paid', 'processing', 'ready', 'shipped', 'delivered', 'completed', 'cancelled',
  'payment_failed', 'refunded', 'partially_refunded', 'returned', 'picked_up',
])
const DEFAULT_TERMINAL_PAYMENT_STATUSES = new Set(['captured', 'failed', 'cancelled', 'refunded', 'partially_refunded'])

export function checkoutStatusTerminal(order = {}, payment = {}) {
  const orderStatus = String(order.status || '').toLowerCase()
  const paymentStatus = String(order.payment_status || order.paymentStatus || payment.status || '').toLowerCase()
  return DEFAULT_TERMINAL_ORDER_STATUSES.has(orderStatus) || DEFAULT_TERMINAL_PAYMENT_STATUSES.has(paymentStatus)
}

export function createCheckoutOrderPoller({ load, apply, shouldStop = checkoutStatusTerminal, schedule = setTimeout, cancelSchedule = clearTimeout, now = Date.now, initialDelay = 3000, maxDelay = 15000, timeout = 5 * 60_000 } = {}) {
  if (typeof load !== 'function' || typeof apply !== 'function') throw new TypeError('load e apply são obrigatórios')
  let stopped = false
  let timer = null
  let delay = Math.max(0, initialDelay)
  const startedAt = now()

  const stop = () => {
    stopped = true
    if (timer !== null) cancelSchedule(timer)
    timer = null
  }
  const queue = () => {
    if (stopped || now() - startedAt >= timeout) return stop()
    timer = schedule(tick, delay)
    delay = Math.min(maxDelay, Math.max(initialDelay, Math.round(delay * 1.6)))
  }
  const tick = async () => {
    if (stopped) return
    timer = null
    try {
      const latest = await load()
      if (stopped) return
      apply(latest)
      if (shouldStop(latest)) return stop()
    } catch {
      if (stopped) return
    }
    queue()
  }
  queue()
  return { stop, tick, get active() { return !stopped } }
}
