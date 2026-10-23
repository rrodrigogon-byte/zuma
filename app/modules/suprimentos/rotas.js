import express from 'express';
import * as est from './estoque.js';
import * as cmp from './compras.js';
import { ErroDominio, exigirUuid, responderErro } from '../acesso/banco.js';

/**
 * /api/admin/suprimentos — estoque, inventário, fichas técnicas e compras da empresa ativa.
 * `escopoDaRequisicao(req, permissao)` → { empresaId, lojaRestrita } (ver server.js).
 */
export function createSuprimentosAdminRouter({ db, escopoDaRequisicao, fuso = 'America/Cuiaba', intervaloConsumoMs = 60_000 }) {
  if (!db || typeof escopoDaRequisicao !== 'function') throw new Error('createSuprimentosAdminRouter: db e escopoDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '6mb' })); // XML de NF-e
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const ultimaBaixa = new Map();
  async function baixarConsumo(empresaId) {
    const agora = Date.now();
    if (agora - (ultimaBaixa.get(empresaId) || 0) < intervaloConsumoMs) return;
    ultimaBaixa.set(empresaId, agora);
    const lojas = (await db.query('SELECT id FROM lojas WHERE empresa_id = $1 AND ativa = true', [empresaId])).rows;
    try { await est.baixarConsumoDasVendas(db, empresaId, { lojaBar: lojas.length === 1 ? lojas[0].id : null, fuso }); } catch (error) { console.error('[suprimentos] consumo', String(error?.message || error).slice(0, 160)); }
  }

  function unidade(req, lojaRestrita) {
    const pedida = String(req.query.lojaId ?? req.body?.lojaId ?? '').trim();
    if (lojaRestrita) {
      if (pedida && pedida !== lojaRestrita && pedida !== 'todas') throw new ErroDominio('STORE_SCOPE_MISMATCH', 'Unidade fora do seu acesso', 403);
      return lojaRestrita;
    }
    return pedida || null;
  }
  const exigirEmpresaToda = (lojaRestrita, acao) => { if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', `${acao} exige permissão na empresa toda`, 403); };

  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, permissao);
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, usuario: String(req.user?.nome || req.user?.email || 'equipe') }));
    } catch (error) {
      return responderErro(res, error);
    }
  };

  // itens e saldos
  router.get('/itens', rota('inventory.read', async ({ req, empresaId, lojaRestrita }) => {
    await baixarConsumo(empresaId);
    return est.listarItens(db, empresaId, { lojaId: unidade(req, lojaRestrita), q: req.query.q || '', abaixoDoMinimo: req.query.abaixoDoMinimo === 'true', incluirInativos: req.query.incluirInativos === 'true' });
  }));
  router.post('/itens', rota('inventory.write', ({ req, empresaId, lojaRestrita }) => { exigirEmpresaToda(lojaRestrita, 'Cadastrar item'); return est.criarItem(db, empresaId, req.body || {}); }, 201));
  router.patch('/itens/:id', rota('inventory.write', ({ req, empresaId, lojaRestrita }) => { exigirEmpresaToda(lojaRestrita, 'Editar item'); return est.atualizarItem(db, empresaId, req.params.id, req.body || {}); }));

  // movimentos
  router.get('/movimentos', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => est.listarMovimentos(db, empresaId, { lojaId: unidade(req, lojaRestrita), itemId: req.query.itemId || null, tipo: req.query.tipo || null, de: req.query.de || null, ate: req.query.ate || null })));
  router.post('/movimentos', rota('inventory.adjust', ({ req, empresaId, lojaRestrita, usuario }) => est.movimentar(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, lojaRestrita) }, { usuario }), 201));
  router.post('/transferencias', rota('inventory.adjust', ({ req, empresaId, lojaRestrita, usuario }) => {
    exigirEmpresaToda(lojaRestrita, 'Transferir entre unidades');
    return est.transferir(db, empresaId, req.body || {}, { usuario });
  }, 201));

  // inventário
  router.get('/inventarios', rota('inventory.read', async ({ empresaId, lojaRestrita }) => {
    const lista = await est.listarInventarios(db, empresaId);
    return lojaRestrita ? lista.filter((i) => i.lojaId === lojaRestrita) : lista;
  }));
  const inventarioNoAlcance = async (empresaId, id, lojaRestrita) => {
    const inv = await est.obterInventario(db, empresaId, id);
    if (lojaRestrita && inv.lojaId !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Inventário não encontrado', 404);
    return inv;
  };
  router.get('/inventarios/:id', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => inventarioNoAlcance(empresaId, req.params.id, lojaRestrita)));
  router.post('/inventarios', rota('inventory.adjust', ({ req, empresaId, lojaRestrita, usuario }) => est.abrirInventario(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, lojaRestrita) }, { usuario }), 201));
  router.post('/inventarios/:id/contagens', rota('inventory.adjust', async ({ req, empresaId, lojaRestrita }) => {
    await inventarioNoAlcance(empresaId, req.params.id, lojaRestrita);
    return est.registrarContagem(db, empresaId, req.params.id, req.body?.contagens || []);
  }));
  router.post('/inventarios/:id/concluir', rota('inventory.adjust', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await inventarioNoAlcance(empresaId, req.params.id, lojaRestrita);
    return est.concluirInventario(db, empresaId, req.params.id, { usuario });
  }));
  router.post('/inventarios/:id/cancelar', rota('inventory.adjust', async ({ req, empresaId, lojaRestrita }) => {
    await inventarioNoAlcance(empresaId, req.params.id, lojaRestrita);
    return est.cancelarInventario(db, empresaId, req.params.id);
  }));

  // ficha técnica
  router.get('/fichas', rota('inventory.read', ({ req, empresaId }) => est.listarFichas(db, empresaId, { fonte: req.query.fonte || null })));
  router.put('/fichas', rota('catalog.write', ({ req, empresaId, lojaRestrita }) => { exigirEmpresaToda(lojaRestrita, 'Editar ficha técnica'); return est.salvarFicha(db, empresaId, req.body || {}); }));
  router.get('/produtos-vendidos', rota('inventory.read', async ({ empresaId }) => {
    const existe = async (t) => Boolean((await db.query('SELECT to_regclass($1) AS t', [t])).rows[0]?.t);
    const bar = (await existe('bar_produtos')) ? (await db.query('SELECT id, nome, categoria FROM bar_produtos WHERE empresa_id = $1 AND ativo = true ORDER BY categoria, nome', [empresaId])).rows.map((p) => ({ fonte: 'bar_produto', id: p.id, nome: p.nome, grupo: `Bar · ${p.categoria}` })) : [];
    const loja = (await existe('commerce_product_variants')) ? (await db.query(
      `SELECT v.id, p.nome || COALESCE(' · ' || NULLIF(v.sku, ''), '') AS nome FROM commerce_product_variants v JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
        WHERE v.empresa_id = $1 AND v.ativo = true AND p.status <> 'archived' ORDER BY p.nome LIMIT 2000`, [empresaId])).rows.map((p) => ({ fonte: 'loja_variante', id: p.id, nome: p.nome, grupo: 'Loja online' })) : [];
    return [...bar, ...loja];
  }));

  // relatórios
  router.get('/sugestao-compra', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => est.sugestaoDeCompra(db, empresaId, { lojaId: unidade(req, lojaRestrita) })));
  router.get('/curva-abc', rota('inventory.read', ({ req, empresaId }) => est.curvaAbc(db, empresaId, { dias: req.query.dias })));
  router.get('/perdas', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => est.perdasDoPeriodo(db, empresaId, { de: req.query.de, ate: req.query.ate, lojaId: unidade(req, lojaRestrita), fuso })));

  // compras
  router.get('/pedidos', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => cmp.listarPedidos(db, empresaId, { status: req.query.status || null, lojaId: unidade(req, lojaRestrita) })));
  router.get('/pedidos/:id', rota('inventory.read', ({ req, empresaId }) => cmp.obterPedido(db, empresaId, req.params.id)));
  router.post('/pedidos', rota('inventory.write', ({ req, empresaId, lojaRestrita, usuario }) => cmp.criarPedido(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, lojaRestrita) }, { usuario }), 201));
  router.post('/pedidos/:id/:acao(enviar|cancelar)', rota('inventory.write', ({ req, empresaId }) => cmp.mudarStatusPedido(db, empresaId, exigirUuid(req.params.id, 'pedido'), req.params.acao)));
  // receber gera conta a pagar: exige também poder lançar no financeiro
  router.post('/recebimentos', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await escopoDaRequisicao(req, 'inventory.write');
    return cmp.receber(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, lojaRestrita) }, { usuario, fuso });
  }, 201));
  router.get('/recebimentos', rota('inventory.read', ({ empresaId }) => cmp.listarRecebimentos(db, empresaId)));
  router.post('/nfe/previa', rota('inventory.write', ({ req, empresaId }) => cmp.previaNfe(db, empresaId, String(req.body?.xml || ''))));
  router.post('/nfe/lancar', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await escopoDaRequisicao(req, 'inventory.write');
    return cmp.lancarNfe(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, lojaRestrita) }, { usuario, fuso });
  }, 201));

  return router;
}
