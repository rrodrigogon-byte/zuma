// Uma resposta antiga nunca pode substituir a intenção mais recente do comprador.
export function createLatestRequest() {
  let version = 0
  return {
    invalidate() { version += 1 },
    async run(request, { success, error, settled } = {}) {
      const current = ++version
      try {
        const result = await request()
        if (current === version) success?.(result)
      } catch (reason) {
        if (current === version) error?.(reason)
      } finally {
        if (current === version) settled?.()
      }
    },
  }
}
