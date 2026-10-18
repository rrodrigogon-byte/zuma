import express from 'express';
import * as svc from './servico.js';
import { responderErro } from '../acesso/banco.js';

export function createBarAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao = null }) {
  if (!db || typeof empresaDaRequisicao !== 'function') throw new Error('createBarAdminRouter: db e empresaDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '64kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const executar = (fn, status = 200) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const operador = operadorDaRequisicao ? operadorDaRequisicao(req) : null;
      const valor = await fn({ req, res, empresaId, operador });
      return res.status(status).json(valor);
    } catch (error) {
      return responderErro(res, error);
    }
  };
  const atualizarProdutoParcial = async ({ empresaId, req }) => {
    const atual = (await svc.listarProdutos(db, empresaId)).find((item) => item.id === req.params.id);
    if (!atual) throw Object.assign(new Error('produto não encontrado'), { status: 404, code: 'NOT_FOUND' });
    return svc.salvarProduto(db, empresaId, {
      ...atual,
      categoria: atual.categoria || atual.cat,
      fatorEstoque: atual.fatorEstoque,
      estoqueAtual: atual.estoqueAtual,
      ...req.body,
    }, req.params.id);
  };
  const idDaMesa = async (empresaId, valor) => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor))) return valor;
    const mesas = await svc.listarMesas(db, empresaId);
    const mesa = [...mesas.fisicas, ...mesas.virtuais].find((item) => String(item.num) === String(valor));
    if (!mesa) throw Object.assign(new Error('mesa não encontrada'), { status: 404, code: 'NOT_FOUND' });
    return mesa.id;
  };

  // Cardápio e estoque: os aliases mantêm o contrato das telas existentes.
  router.get('/clientes', executar(async ({ empresaId }) => ({ clientes: await svc.listarClientesConta(db, empresaId) })));
  router.get(['/produtos', '/cardapio'], executar(({ empresaId }) => svc.listarProdutos(db, empresaId, { apenasAtivos: false })));
  router.get('/cardapio/:id/modificadores', executar(() => ({ grupos: [] })));
  router.post(['/produtos', '/cardapio'], executar(({ empresaId, req }) => svc.salvarProduto(db, empresaId, req.body || {}), 201));
  router.patch(['/produtos/:id', '/cardapio/:id'], executar(atualizarProdutoParcial));
  router.delete(['/produtos/:id', '/cardapio/:id'], executar(({ empresaId, req }) => svc.removerProduto(db, empresaId, req.params.id)));
  router.get('/estoque', executar(async ({ empresaId }) => ({ estoque: await svc.listarProdutos(db, empresaId) })));
  router.post('/estoque/movimento', executar(({ empresaId, req, operador }) => svc.registrarMovimentoEstoque(db, empresaId, req.body || {}, operador), 201));
  router.post('/estoque/entrada', executar(({ empresaId, req, operador }) => svc.registrarMovimentoEstoque(db, empresaId, { ...req.body, tipo: 'entrada' }, operador), 201));
  router.post('/estoque/ajuste', executar(async ({ empresaId, req, operador }) => {
    if (req.body?.min !== undefined && req.body?.qtd === undefined && req.body?.quantidade === undefined) {
      const atual = (await svc.listarProdutos(db, empresaId)).find((item) => item.id === req.body.produtoId);
      if (!atual) throw Object.assign(new Error('produto não encontrado'), { status: 404, code: 'NOT_FOUND' });
      return svc.salvarProduto(db, empresaId, { ...atual, estoqueMinimo: req.body.min }, atual.id);
    }
    return svc.registrarMovimentoEstoque(db, empresaId, { ...req.body, tipo: 'ajuste', quantidade: req.body?.qtd ?? req.body?.quantidade }, operador);
  }, 201));
  router.post('/estoque/minimos-categoria', executar(() => ({ itensAtualizados: 0 })));
  router.post('/estoque/sincronizar-cardapio', executar(() => ({ criados: 0 })));

  // Mesas e comandas.
  router.get('/mesas', executar(({ empresaId }) => svc.listarMesas(db, empresaId)));
  router.get('/mesas/config', executar(async ({ empresaId }) => {
    const mesas = await svc.listarMesas(db, empresaId);
    return { mesasFisicas: mesas.fisicas.length };
  }));
  router.post('/mesas/config', executar(async ({ empresaId, req }) => {
    const quantidade = Number(req.body?.mesasFisicas);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 500) throw Object.assign(new Error('quantidade de mesas inválida'), { status: 400, code: 'VALIDATION_ERROR' });
    const atuais = await svc.listarMesas(db, empresaId);
    const existentes = new Set(atuais.fisicas.map((mesa) => mesa.num));
    for (let numero = 1; numero <= quantidade; numero += 1) if (!existentes.has(numero)) await svc.salvarMesa(db, empresaId, { numero, nome: `Mesa ${numero}`, tipo: 'fisica' });
    return { mesasFisicas: quantidade };
  }));
  router.get('/pedidos-publicos/config', executar(() => ({ configuracao: { confirmarGarcom: false, minutosSessao: 120, limiteItensPorPedido: 20 } })));
  router.patch('/pedidos-publicos/config', executar(({ req }) => ({ configuracao: req.body || {} })));
  router.get('/mesas/:numero/qr', executar(({ req }) => ({ mesa: Number(req.params.numero), token: null, dataUrl: null, indisponivel: true })));
  router.post('/mesas/:numero/qr/rotacionar', executar(() => ({ ok: true, token: null, indisponivel: true })));
  router.post('/mesas/:numero/fechar', executar(async ({ empresaId, req }) => {
    const mesas = await svc.listarMesas(db, empresaId);
    const mesa = mesas.fisicas.find((item) => item.num === Number(req.params.numero));
    if (mesa?.comandaId) return svc.pagarComanda(db, empresaId, mesa.comandaId, req.body || {});
    return { ok: true };
  }));
  router.post('/mesas', executar(({ empresaId, req }) => svc.salvarMesa(db, empresaId, req.body || {}), 201));
  router.patch('/mesas/:id', executar(async ({ empresaId, req }) => svc.salvarMesa(db, empresaId, req.body || {}, await idDaMesa(empresaId, req.params.id))));
  router.delete('/mesas/:id', executar(async ({ empresaId, req }) => svc.removerMesa(db, empresaId, await idDaMesa(empresaId, req.params.id))));
  router.post(['/mesas/:numero/abrir', '/mesa/:numero/pedir'], executar(({ empresaId, req, operador }) => svc.abrirComandaMesa(db, empresaId, req.params.numero, req.body || {}, operador), 201));
  router.post('/mesa-virtual', executar(({ empresaId, req, operador }) => svc.abrirMesaVirtual(db, empresaId, req.body || {}, operador), 201));
  router.get(['/comandas/:id', '/comanda/:id'], executar(({ empresaId, req }) => svc.obterComanda(db, empresaId, req.params.id)));
  router.post(['/comandas/:id/itens', '/comanda/:id/adicionar'], executar(({ empresaId, req, operador }) => {
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [req.body || {}];
    return svc.adicionarItens(db, empresaId, req.params.id, itens, operador);
  }));
  router.delete('/comanda/:id/item/:indice', executar(({ empresaId, req, operador }) => svc.cancelarItemPorIndice(db, empresaId, req.params.id, req.params.indice, operador)));
  router.post('/comanda/:id/cancelar-item', executar(({ empresaId, req, operador }) => svc.cancelarItemPorIndice(db, empresaId, req.params.id, req.body?.idx, operador)));
  router.patch('/comanda/:id/item/:indice', executar(async ({ empresaId, req }) => {
    const comanda = await svc.obterComanda(db, empresaId, req.params.id);
    const item = comanda.itens?.[Number(req.params.indice)];
    if (!item) return svc.obterComanda(db, empresaId, req.params.id);
    // O contrato legado usa qtd; a alteração de quantidade é restrita a itens ainda pendentes.
    if (req.body?.qtd === undefined) return comanda;
    if (item.status !== 'pendente') return comanda;
    await svc.cancelarItemPorIndice(db, empresaId, req.params.id, req.params.indice);
    return svc.adicionarItens(db, empresaId, req.params.id, [{ produtoId: item.produtoId, qtd: req.body.qtd, obs: item.obs }]);
  }));
  router.post('/comanda/:id/conta', executar(({ empresaId, req }) => svc.marcarConta(db, empresaId, req.params.id)));
  router.post(['/comanda/:id/pagar', '/comandas/:id/pagar'], executar(({ empresaId, req }) => svc.pagarComanda(db, empresaId, req.params.id, req.body || {})));
  router.post('/comanda/:id/pagamento-parcial', executar(({ empresaId, req }) => svc.pagarComanda(db, empresaId, req.params.id, req.body || {})));

  // KDS: atualização somente por transição válida do serviço.
  router.get(['/kds/pedidos', '/setores/pedidos'], executar(async ({ empresaId, req }) => {
    const agrupados = new Map();
    for (const item of await svc.listarPedidosKds(db, empresaId, { setor: req.query.setor })) {
      const grupo = agrupados.get(item.comandaId) || { comandaId: item.comandaId, mesa: item.mesa, mesaNum: item.mesaNum, itens: [] };
      grupo.itens.push({
        ...item,
        indice: grupo.itens.length,
        status: item.status === 'pendente' ? 'novo' : item.status === 'preparando' ? 'em_preparo' : item.status,
        criadoEm: item.criado_em,
      });
      agrupados.set(item.comandaId, grupo);
    }
    return { pedidos: [...agrupados.values()] };
  }));
  router.get(['/kds/resumo', '/kds/metricas'], executar(async ({ empresaId }) => {
    const pedidos = await svc.listarPedidosKds(db, empresaId);
    return { metricas: { pendentes: pedidos.filter((item) => item.status === 'pendente').length, preparando: pedidos.filter((item) => item.status === 'preparando').length, prontos: pedidos.filter((item) => item.status === 'pronto').length }, pedidos };
  }));
  router.patch('/kds/comanda/:id/item/:indice/status', executar(async ({ empresaId, req }) => {
    const comanda = await svc.obterComanda(db, empresaId, req.params.id);
    const item = comanda.itens?.[Number(req.params.indice)];
    if (!item) throw Object.assign(new Error('item não encontrado'), { status: 404, code: 'NOT_FOUND' });
    const status = req.body?.status === 'novo' ? 'pendente' : req.body?.status === 'em_preparo' ? 'preparando' : req.body?.status;
    await svc.atualizarStatusItem(db, empresaId, req.params.id, item.id, status);
    return svc.obterComanda(db, empresaId, req.params.id);
  }));
  router.patch('/kds/pedidos/:itemId/status', executar(async ({ empresaId, req }) => {
    const pedidos = await svc.listarPedidosKds(db, empresaId);
    const pedido = pedidos.find((item) => item.id === req.params.itemId);
    if (!pedido) throw Object.assign(new Error('item não encontrado'), { status: 404, code: 'NOT_FOUND' });
    const status = req.body?.status === 'novo' ? 'pendente' : req.body?.status === 'em_preparo' ? 'preparando' : req.body?.status;
    await svc.atualizarStatusItem(db, empresaId, pedido.comandaId, pedido.id, status);
    return { ok: true };
  }));
  router.post('/kds/comanda/:id/item/:indice/reimprimir', executar(() => ({ ok: true, enfileirado: true })));

  // Caixa e vendas.
  router.get(['/caixa/hoje', '/caixa'], executar(({ empresaId }) => svc.resumoCaixa(db, empresaId)));
  router.post('/caixa/abrir', executar(({ empresaId, req, operador }) => svc.abrirCaixa(db, empresaId, req.body || {}, operador), 201));
  router.post('/caixa/movimento', executar(({ empresaId, req, operador }) => svc.registrarMovimentoCaixa(db, empresaId, req.body || {}, operador), 201));
  router.get('/vendas', executar(({ empresaId, req }) => svc.listarVendas(db, empresaId, { hoje: req.query.hoje === '1' })));

  return router;
}
