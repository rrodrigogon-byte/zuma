// Acorda o worker do atendente assim que chega mensagem nova, sem esperar o próximo
// ciclo (antes: até 5 s do polling + até 5 s do worker antes de o modelo começar).
const listeners = new Set();

export function onWhatsappAiWake(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function wakeWhatsappAiWorker() {
  for (const listener of listeners) {
    try { listener(); } catch { /* acordar é só um atalho: o ciclo normal continua */ }
  }
}
