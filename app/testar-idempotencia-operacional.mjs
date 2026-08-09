import assert from 'node:assert/strict';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3110'; const email = 'admin@setpoint-ultra.local'; const senha = 'SetPoint@2026Temp';
async function request(path, { method='GET', token, body, headers={} } = {}) { const resposta = await fetch(`${baseUrl}${path}`, { method, headers:{ 'Content-Type':'application/json', ...headers, ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:body === undefined ? undefined : JSON.stringify(body) }); const dados = await resposta.json().catch(() => ({})); if (!resposta.ok) throw new Error(`${method} ${path}: ${dados.erro || resposta.status}`); return dados; }
const login = await request('/api/auth/login', { method:'POST', body:{ email, senha } }); const token = login.token || login.accessToken; assert.ok(token);
const criado = await request('/api/admin/cardapio', { method:'POST', token, body:{ nome:`Idempotência ${Date.now()}`, preco:9, cat:'Bebidas', setor:'bar' } }); const produto = criado.item || criado.produto || criado; assert.ok(produto.id);
const aberta = await request('/api/mesa-virtual', { method:'POST', token, body:{ nome:'Teste offline', itens:[] } }); const comanda = aberta.comanda; const chave = `teste-idempotencia-${Date.now()}`;
const corpo = { itens:[{ produtoId:produto.id, qtd:1 }] };
const primeira = await request(`/api/comanda/${comanda.id}/adicionar`, { method:'POST', token, body:corpo, headers:{ 'Idempotency-Key':chave } }); const repetida = await request(`/api/comanda/${comanda.id}/adicionar`, { method:'POST', token, body:corpo, headers:{ 'Idempotency-Key':chave, 'X-Offline-Replay':'1' } });
assert.equal(primeira.itens.length, 1); assert.equal(repetida.itens.length, 1); assert.equal(repetida.idempotente, true);
const final = await request(`/api/comanda/${comanda.id}`, { token }); assert.equal(final.itens.length, 1); assert.equal(final.itens[0].qtd, 1);
console.log('✓ Reenvio offline idempotente não duplica itens, estoque ou fila operacional');
