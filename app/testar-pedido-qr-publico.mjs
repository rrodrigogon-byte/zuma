import assert from 'node:assert/strict';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3106';
const email = process.env.TEST_ADMIN_EMAIL || 'admin@setpoint-ultra.local';
const senha = process.env.TEST_ADMIN_SENHA || 'SetPoint@2026Temp';
async function request(path, { method = 'GET', token, session, body, idempotencyKey } = {}) {
  const resposta = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(session ? { 'X-Mesa-Session': session } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const bruto = await resposta.text(); let dados; try { dados = bruto ? JSON.parse(bruto) : {}; } catch { dados = { bruto }; }
  if (!resposta.ok) throw new Error(`${method} ${path}: ${dados.erro || resposta.status}`); return dados;
}
const login = await request('/api/auth/login', { method: 'POST', body: { email, senha } }); const token = login.token || login.accessToken; assert.ok(token);
await request('/api/admin/mesas/config', { method: 'POST', token, body: { mesasFisicas: 1 } });
await request('/api/admin/pedidos-publicos/config', { method: 'PATCH', token, body: { confirmarGarcom: false, minutosSessao: 120, limiteItensPorPedido: 20 } });
const produtoResposta = await request('/api/admin/cardapio', { method: 'POST', token, body: { nome: `Produto QR ${Date.now()}`, preco: 12.5, cat: 'Bebidas', setor: 'bar', controlaEstoque: false, fiscal: { ncm: '22030000', cfop: '5102', origem: '0', unidadeTributavel: 'UN', csosn: '102', cstPis: '49', cstCofins: '49' } } });
const produto = produtoResposta.item || produtoResposta.produto || produtoResposta; assert.ok(produto.id);
const qr = await request('/api/admin/mesas/1/qr', { token }); assert.ok(qr.url.includes('/cardapio/mesa/')); assert.ok(qr.dataUrl.startsWith('data:image/'));
const tokenQr = qr.url.split('/').pop();
const publico = await request(`/api/public/mesa/${tokenQr}`); assert.equal(publico.mesa.numero, 1); assert.ok(publico.cardapio.some(item => item.id === produto.id));
const sessao = await request(`/api/public/mesa/${tokenQr}/sessao`, { method: 'POST' }); const sessaoToken = sessao.sessao.token; assert.ok(sessaoToken);
const chave = 'pedido-teste-idempotente';
const pedido = await request(`/api/public/mesa/${tokenQr}/pedidos`, { method: 'POST', session: sessaoToken, idempotencyKey: chave, body: { idempotencyKey: chave, itens: [{ produtoId: produto.id, qtd: 1 }] } }); assert.equal(pedido.status, 'novo');
const repetido = await request(`/api/public/mesa/${tokenQr}/pedidos`, { method: 'POST', session: sessaoToken, idempotencyKey: chave, body: { idempotencyKey: chave, itens: [{ produtoId: produto.id, qtd: 1 }] } }); assert.equal(repetido.duplicado, true); assert.equal(repetido.pedidoId, pedido.pedidoId);
let comanda = await request(`/api/comanda/${pedido.comandaId}`, { token }); assert.equal(comanda.itens.filter(item => item.origem === 'qr_mesa').length, 1, 'Reenvio idempotente não pode duplicar itens.');
await request('/api/admin/pedidos-publicos/config', { method: 'PATCH', token, body: { confirmarGarcom: true, minutosSessao: 120, limiteItensPorPedido: 20 } });
await new Promise(resolve => setTimeout(resolve, 1600));
const pedidoConfirmacao = await request(`/api/public/mesa/${tokenQr}/pedidos`, { method: 'POST', session: sessaoToken, idempotencyKey: 'pedido-com-confirmacao', body: { itens: [{ produtoId: produto.id, qtd: 1 }] } }); assert.equal(pedidoConfirmacao.status, 'aguardando_confirmacao');
const pendentes = await request('/api/admin/pedidos-publicos/pendentes', { token }); assert.ok(pendentes.pedidos.some(item => item.id === pedidoConfirmacao.pedidoId));
await request(`/api/pedidos-publicos/${pedidoConfirmacao.pedidoId}/confirmar`, { method: 'POST', token });
const setores = await request('/api/setores/pedidos', { token }); assert.ok(setores.pedidos.some(item => item.comandaId === pedido.comandaId), 'Pedido confirmado deve aparecer na fila operacional.');
await request(`/api/public/mesa/${tokenQr}/chamar-garcom`, { method: 'POST', session: sessaoToken, body: { tipo: 'conta' } });
await request('/api/admin/mesas/1/qr/rotacionar', { method: 'POST', token });
const respostaAntiga = await fetch(`${baseUrl}/api/public/mesa/${tokenQr}`); assert.equal(respostaAntiga.status, 404, 'Rotação deve invalidar o QR anterior.');
console.log('✓ QR público → sessão → pedido idempotente → confirmação → KDS → rotação validado');
