import test from 'node:test'
import assert from 'node:assert/strict'
import { perfilDoUsuario, profissionalPode, operadorPodeNaBarbearia, respostaParaOperador, papelLegadoDoRole, restricaoDePermissao, permissoesDoPerfil } from './perfis-acesso.js'

test('perfil da sessão: papel legado e papel do Commerce', () => {
  assert.equal(perfilDoUsuario({ role: 'admin' }), 'admin')
  assert.equal(perfilDoUsuario({ role: 'organizador' }), 'admin')
  assert.equal(perfilDoUsuario({ role: 'operador' }), 'operador')
  assert.equal(perfilDoUsuario({ role: 'profissional' }), 'profissional')
  assert.equal(perfilDoUsuario({ role: 'staff' }), null, 'equipe antiga segue a regra de antes')
  assert.equal(perfilDoUsuario({ pgAccount: true, commerceRoleCode: 'store_admin', role: 'admin' }), 'admin')
  assert.equal(perfilDoUsuario({ pgAccount: true, commerceRoleCode: 'operator', role: 'operador' }), 'operador')
  assert.equal(perfilDoUsuario({ pgAccount: true, commerceRoleCode: 'professional' }), 'profissional')
  assert.equal(perfilDoUsuario({ pgAccount: true, commerceRoleCode: 'finance' }), null)
  assert.equal(perfilDoUsuario({ platformAdmin: true, role: 'profissional' }), 'admin')
})

test('profissional: só o app do profissional', () => {
  for (const [m, c] of [['GET', '/barbearia/modo-barbeiro'], ['GET', '/barbearia/modo-barbeiro/extrato?inicio=1'], ['POST', '/barbearia/modo-barbeiro/comandas'], ['POST', '/barbearia/agenda'], ['PATCH', '/barbearia/agenda/a1/status'], ['POST', '/barbearia/bloqueios'], ['POST', '/barbearia/push/assinar'], ['GET', '/commerce-session']]) {
    assert.equal(profissionalPode(m, c), true, `${m} ${c}`)
  }
  for (const [m, c] of [['GET', '/barbearia/agenda'], ['GET', '/barbearia/comissoes'], ['GET', '/barbearia/overview'], ['GET', '/barbearia/clientes'], ['PATCH', '/barbearia/agenda/a1'], ['GET', '/razao/resumo'], ['GET', '/bar/produtos'], ['POST', '/barbearia/modo-barbeiro/qualquer']]) {
    assert.equal(profissionalPode(m, c), false, `${m} ${c}`)
  }
})

test('operador: operação do dia sim; comissões, metas, indicadores e configurações não', () => {
  const pode = [['GET', '/agenda'], ['POST', '/agenda'], ['PATCH', '/agenda/a1/status'], ['GET', '/comandas'], ['POST', '/comandas'], ['POST', '/comandas/c1/itens'], ['POST', '/comandas/c1/pagamentos'], ['PATCH', '/comandas/c1/status'], ['GET', '/clientes'], ['POST', '/clientes'], ['GET', '/operacao/caixas'], ['POST', '/operacao/fechar-dia'], ['POST', '/vendas-revenda'], ['GET', '/servicos']]
  for (const [m, c] of pode) assert.equal(operadorPodeNaBarbearia(m, c, {}), true, `${m} ${c}`)
  const nao = [['GET', '/comissoes'], ['GET', '/comissoes/extrato'], ['GET', '/metas'], ['GET', '/dashboard'], ['GET', '/financeiro/lancamentos'], ['GET', '/bi'], ['GET', '/financeiro/resumo'], ['GET', '/operacao/resumo'], ['GET', '/captacao/projecao-faturamento'], ['PATCH', '/configuracoes'], ['POST', '/profissionais'], ['POST', '/comandas/c1/cancelar'], ['POST', '/comandas/c1/estorno'], ['GET', '/rota-nova-do-manus']]
  for (const [m, c] of nao) assert.equal(operadorPodeNaBarbearia(m, c, {}), false, `${m} ${c}`)
  assert.equal(operadorPodeNaBarbearia('POST', '/financeiro/lancamentos', { tipo: 'despesa' }), true)
  assert.equal(operadorPodeNaBarbearia('POST', '/financeiro/lancamentos', { tipo: 'receita' }), false)
  assert.equal(operadorPodeNaBarbearia('PATCH', '/comandas/c1', { desconto: 10 }), false)
  assert.equal(operadorPodeNaBarbearia('PATCH', '/agenda/a1/status', { status: 'concluido', registrarFinanceiro: true }), false)
  // fechamento cego: sem o valor contado o operador não fecha
  assert.equal(operadorPodeNaBarbearia('POST', '/operacao/caixas/x/fechamento', {}), false)
  assert.equal(operadorPodeNaBarbearia('POST', '/operacao/caixas/x/fechamento', { valorInformado: 80 }), true)
})

test('visão geral para o operador: contagens do dia sim, dinheiro e comissões não', () => {
  const r = respostaParaOperador('/overview', {
    dashboard: { indicadores: { agendamentosHoje: 4, faturamentoHoje: 900, receitaRevendaHoje: 30 }, financeiro: { saldo: 1 }, caixa: { aberto: { valorAbertura: 100, valorEsperado: 400 } } },
    relatorio: { x: 1 }, comissoes: { total: 9 }, operacao: { a: 1 }, resumoComandas: { abertas: 2, receitaPaga: 500 },
  })
  assert.deepEqual(r.dashboard.indicadores, { agendamentosHoje: 4 })
  assert.equal(r.dashboard.financeiro, null)
  assert.deepEqual(r.dashboard.caixa, { aberto: { valorAbertura: 100 } })
  assert.equal(r.comissoes, null)
  assert.deepEqual(r.resumoComandas, { abertas: 2 })
  assert.equal(r.numerosOcultos, true)
  const dia = respostaParaOperador('/operacao/fechar-dia', { ok: true, fechamento: { data: '2026-10-23', receitas: 900, despesas: 100, fechadoEm: 'x' } })
  assert.deepEqual(dia.fechamento, { data: '2026-10-23', fechadoEm: 'x', fechadoPor: null, status: 'fechado' })
})

test('papel do Commerce vira o papel da sessão', () => {
  assert.equal(papelLegadoDoRole('tenant_owner'), 'admin')
  assert.equal(papelLegadoDoRole('operator'), 'operador')
  assert.equal(papelLegadoDoRole('professional'), 'profissional')
  assert.equal(papelLegadoDoRole('finance'), 'organizador')
  assert.equal(papelLegadoDoRole('customer'), 'cliente')
})

test('resposta ao operador: sem comissão e caixa sem o valor esperado', () => {
  const profissionais = respostaParaOperador('/profissionais', { profissionais: [{ id: 'p1', nome: 'Bruno', comissaoPercentual: 50, comissaoProdutos: 10 }] })
  assert.deepEqual(profissionais, { profissionais: [{ id: 'p1', nome: 'Bruno' }] })
  const caixa = respostaParaOperador('/operacao/caixas', { caixas: [{ id: 'c1', status: 'aberto', valorAbertura: 100, esperado: 900, diferenca: -3, movimentos: [{ valor: 50 }] }] })
  assert.deepEqual(caixa, { caixas: [{ id: 'c1', status: 'aberto', valorAbertura: 100, movimentos: [{ valor: 50 }] }] })
})

test('não tira campos que só se parecem com comissão (desconto percentual da comanda)', () => {
  assert.deepEqual(respostaParaOperador('/comandas', { descontoPercentual: 10, total: 90 }), { descontoPercentual: 10, total: 90 })
})

test('permissões do Commerce limitadas pelo perfil (inclusive vínculo mais amplo)', () => {
  const req = (role, method, url, body = {}) => ({ user: { role }, method, originalUrl: url, body })
  assert.equal(restricaoDePermissao(req('operador', 'GET', '/api/admin/commerce/orders'), 'orders.read'), null)
  assert.equal(restricaoDePermissao(req('operador', 'POST', '/api/admin/bar/comanda/c1/pagar'), 'payments.write'), null)
  assert.equal(restricaoDePermissao(req('operador', 'GET', '/api/admin/bar/caixa'), 'payments.read'), null)
  assert.equal(restricaoDePermissao(req('operador', 'POST', '/api/admin/razao/lancamentos', { tipo: 'despesa' }), 'payments.write'), null)
  for (const [m, u, p, b] of [
    ['POST', '/api/admin/razao/lancamentos', 'payments.write', { tipo: 'receita' }],
    ['PATCH', '/api/admin/razao/lancamentos/x', 'payments.write'],
    ['POST', '/api/admin/razao/fechamentos', 'payments.write'],
    ['POST', '/api/admin/commerce/payments/accounts', 'payments.write'],
    ['GET', '/api/admin/a2/contas-receber', 'payments.read'],
    ['GET', '/api/admin/fiscal/documentos', 'payments.read'],
    ['GET', '/api/admin/bar/vendas', 'payments.read'],
    ['GET', '/api/admin/razao/resumo', 'reports.read'],
    ['PATCH', '/api/admin/razao/config', 'settings.write'],
  ]) assert.ok(restricaoDePermissao(req('operador', m, u, b), p), `${m} ${u}`)
  assert.ok(restricaoDePermissao(req('profissional', 'GET', '/api/admin/commerce/orders'), 'orders.read'))
  assert.equal(restricaoDePermissao(req('admin', 'GET', '/api/admin/razao/resumo'), 'reports.read'), null)
  assert.equal(restricaoDePermissao(req('organizador', 'GET', '/api/admin/razao/resumo'), 'reports.read'), null)
  assert.deepEqual(permissoesDoPerfil({ role: 'operador' }, ['catalog.read', 'payments.read', 'reports.read', 'users.write']), ['catalog.read'])
  assert.deepEqual(permissoesDoPerfil({ role: 'profissional' }, ['catalog.read']), [])
})

test('caixa às cegas: os recebimentos não chegam ao operador', () => {
  const r = respostaParaOperador('/operacao/caixas/c1/movimentos', { caixa: { valorAbertura: 100, valorEsperado: 400 }, movimentos: [{ tipo: 'recebimento', valor: 300 }, { tipo: 'sangria', valor: 50 }, { tipo: 'estorno_recebimento', valor: 10 }] })
  assert.deepEqual(r, { caixa: { valorAbertura: 100 }, movimentos: [{ tipo: 'sangria', valor: 50 }] })
})
