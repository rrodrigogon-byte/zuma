import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3105';
const email = process.env.TEST_ADMIN_EMAIL || 'admin@setpoint-ultra.local';
const senha = process.env.TEST_ADMIN_SENHA || 'SetPoint@2026Temp';
async function request(path, { method = 'GET', token, body } = {}) {
  const resposta = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const bruto = await resposta.text(); let dados; try { dados = bruto ? JSON.parse(bruto) : {}; } catch { dados = { bruto }; }
  if (!resposta.ok) throw new Error(`${method} ${path}: ${dados.erro || resposta.status}`);
  return dados;
}
const sufixo = Date.now().toString(36);
const login = await request('/api/auth/login', { method: 'POST', body: { email, senha } });
const token = login.token || login.accessToken; assert.ok(token);
const criarProduto = async (nome, preco) => {
  const resposta = await request('/api/admin/cardapio', { method: 'POST', token, body: { nome, preco, cat: 'Cozinha', setor: 'cozinha', cozinha: true, unidade: 'UN', fiscal: { ncm: '21069090', cfop: '5102', origem: '0', unidadeTributavel: 'UN', csosn: '102', cstPis: '49', cstCofins: '49' } } });
  return resposta.item || resposta.produto || resposta;
};
const principal = await criarProduto(`Principal Mod ${sufixo}`, 10);
const adicional = await criarProduto(`Adicional Mod ${sufixo}`, 2);
assert.ok(principal.id && adicional.id);
await request('/api/admin/estoque/entrada', { method: 'POST', token, body: { produtoId: adicional.id, qtd: 20, custo: 1, registrarFinanceiro: false } });
await request('/api/admin/estoque/ajuste', { method: 'POST', token, body: { produtoId: adicional.id, controlaEstoque: true } });
const grupoResposta = await request('/api/admin/modificadores/grupos', { method: 'POST', token, body: { nome: `Adicional teste ${sufixo}`, minimo: 1, maximo: 1, obrigatorio: true, opcoes: [{ nome: 'Com adicional', precoAdicional: 3, custoAdicional: 0, produtoId: adicional.id, quantidadeEstoque: 1 }] } });
const grupo = grupoResposta.grupo; assert.ok(grupo?.id);
await request(`/api/admin/cardapio/${principal.id}`, { method: 'PATCH', token, body: { ...principal, modificadorGrupoIds: [grupo.id] } });
const opcao = grupo.opcoes[0];
const abertura = await request('/api/mesa-virtual', { method: 'POST', token, body: { nome: `Mesa mod ${sufixo}` } });
const comandaId = abertura.id || abertura.comandaId || abertura.comanda?.id; assert.ok(comandaId);
await request(`/api/comanda/${comandaId}/adicionar`, { method: 'POST', token, body: { itens: [{ produtoId: principal.id, qtd: 1, modificadores: [{ grupoId: grupo.id, opcaoId: opcao.id }] }] } });
let comanda = await request(`/api/comanda/${comandaId}`, { token });
let item = comanda.itens?.[0]; assert.ok(item, 'A comanda precisa conter o item com adicional.');
assert.equal(item.preco, 13, 'O adicional deve compor o preço do item.');
assert.equal(item.modificadores?.[0]?.nome, 'Com adicional');
assert.equal(item.adicionaisBaixados?.[0]?.produtoId, adicional.id);
let estoque = await request('/api/admin/estoque', { token });
let saldo = (estoque.estoque || estoque).find(ficha => String(ficha.produtoId || ficha.id) === adicional.id);
assert.equal(Number(saldo.qtd), 19, 'O adicional deve baixar uma unidade do estoque.');
await request(`/api/comanda/${comandaId}/item/0`, { method: 'DELETE', token });
estoque = await request('/api/admin/estoque', { token });
saldo = (estoque.estoque || estoque).find(ficha => String(ficha.produtoId || ficha.id) === adicional.id);
assert.equal(Number(saldo.qtd), 20, 'O cancelamento deve estornar o adicional.');
const comboResposta = await request('/api/admin/combos', { method: 'POST', token, body: { nome: `Combo ${sufixo}`, preco: 10, setor: 'cozinha', componentes: [{ produtoId: principal.id, qtd: 1, modificadores: [{ grupoId: grupo.id, opcaoId: opcao.id }] }, { produtoId: adicional.id, qtd: 1 }] } });
const combo = comboResposta.combo; assert.ok(combo?.id);
await request(`/api/comanda/${comandaId}/adicionar`, { method: 'POST', token, body: { itens: [{ comboId: combo.id, qtd: 1 }] } });
comanda = await request(`/api/comanda/${comandaId}`, { token });
const itensCombo = comanda.itens.filter(linha => linha.comboId === combo.id);
assert.equal(itensCombo.length, 2, 'O combo deve criar componentes roteáveis por setor.');
assert.equal(Number(itensCombo.reduce((soma, linha) => soma + Number(linha.preco) * Number(linha.qtd), 0).toFixed(2)), 10, 'Os componentes devem somar o preço promocional do combo.');
console.log('✓ Integração PDV → modificador → estoque/CMV → estorno → combo validada');
