import assert from 'node:assert/strict'

const fiscalModule = await import('../routes/fiscal.js')
const supermercadoModule = await import('../routes/supermercado.js')
const omnichannelModule = await import('../routes/omnichannel.js')

assert.ok(fiscalModule.default, 'A rota fiscal deve exportar um roteador padrão')
assert.ok(supermercadoModule.default, 'A rota de supermercado deve exportar um roteador padrão')
assert.ok(omnichannelModule.default, 'A rota omnichannel deve exportar um roteador padrão')
assert.ok(Array.isArray(fiscalModule.default.stack), 'O roteador fiscal deve possuir uma pilha Express')
assert.ok(Array.isArray(supermercadoModule.default.stack), 'O roteador de supermercado deve possuir uma pilha Express')
assert.ok(Array.isArray(omnichannelModule.default.stack), 'O roteador omnichannel deve possuir uma pilha Express')
assert.ok(fiscalModule.default.stack.length >= 8, 'A rota fiscal deve disponibilizar os fluxos principais')
assert.ok(supermercadoModule.default.stack.length >= 10, 'A rota comercial deve disponibilizar os fluxos principais')
assert.ok(omnichannelModule.default.stack.length >= 8, 'A rota omnichannel deve disponibilizar os fluxos principais')

console.log(JSON.stringify({
  sucesso: true,
  fiscal_endpoints_registrados: fiscalModule.default.stack.length,
  supermercado_endpoints_registrados: supermercadoModule.default.stack.length,
  omnichannel_endpoints_registrados: omnichannelModule.default.stack.length,
}))
