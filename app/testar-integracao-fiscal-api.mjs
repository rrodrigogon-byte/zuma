import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3103';
const email = process.env.TEST_ADMIN_EMAIL || 'admin@setpoint-ultra.local';
const senha = process.env.TEST_ADMIN_SENHA || 'SetPoint@2026Temp';

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) throw new Error(`${method} ${path}: ${data.erro || response.status}`);
  return data;
}

const login = await request('/api/auth/login', { method: 'POST', body: { email, senha } });
const token = login.token || login.accessToken;
assert.ok(token, 'Login administrativo deve retornar token.');
const catalogo = await request('/api/cardapio', { token });
let produto = (Array.isArray(catalogo) ? catalogo : catalogo.itens || catalogo.produtos || []).find((item) => !item.indisponivel);
if (!produto) {
  const criado = await request('/api/admin/cardapio', {
    method: 'POST', token,
    body: {
      nome: 'Produto Fiscal de Teste Isolado', preco: 10, cat: 'Bebidas', setor: 'bar', controlaEstoque: false,
      fiscal: { ncm: '22030000', cfop: '5102', origem: '0', unidadeTributavel: 'UN', csosn: '102', cstPis: '49', cstCofins: '49' },
    },
  });
  produto = criado.item;
}
assert.ok(produto?.id, 'É necessário um produto disponível para validar o fluxo fiscal.');
const abertura = await request('/api/mesa-virtual', { method: 'POST', token, body: { nome: 'Teste Fiscal Isolado', itens: [{ produtoId: produto.id, qtd: 1 }] } });
const comandaId = abertura.comandaId || abertura.id || abertura.comanda?.id;
assert.ok(comandaId, 'A abertura da comanda deve retornar id.');
const total = Number(abertura.total || abertura.comanda?.total || produto.preco || 0);
await request(`/api/comanda/${comandaId}/pagar`, { method: 'POST', token, body: { meio: 'dinheiro', totalFinal: total } });
const preview = await request(`/api/v1/fiscal/comandas/${comandaId}/preview?modelo=65`, { token });
assert.equal(preview.ok, true);
assert.equal(preview.emissaoExternaBloqueada, true, 'A prévia não pode autorizar ou transmitir documento.');
assert.equal(preview.previa.comandaId, comandaId);
assert.equal(preview.previa.modelo, '65');
assert.ok(Array.isArray(preview.previa.itens) && preview.previa.itens.length > 0);
assert.ok(Array.isArray(preview.previa.pendencias), 'A prévia precisa explicitar pendências fiscais quando existirem.');
const observabilidade = await request('/api/v1/fiscal/observabilidade', { token });
assert.equal(observabilidade.ok, true);
assert.equal(observabilidade.emissaoExternaBloqueada, true);
assert.equal(observabilidade.observabilidade.contingencia.transmissaoAutomatica, false);
console.log('✓ Fluxo PDV → comanda fechada → prévia fiscal validado sem transmissão externa');
