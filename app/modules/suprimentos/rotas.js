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
  const baixaEmAndamento = new Map(); // empresa → promessa: duas telas abertas não baixam em dobro
  // Baixa das vendas pela ficha técnica. Na listagem roda no máximo a cada `intervaloConsumoMs` e
  // um erro não derruba a tela; no inventário (abrir, contar, concluir) roda sempre e o erro para
  // a operação: contar com venda ainda não baixada criaria diferença falsa.
  async function baixarConsumo(empresaId, { obrigatoria = false } = {}) {
    const agora = Date.now();
    if (!obrigatoria && agora - (ultimaBaixa.get(empresaId) || 0) < intervaloConsumoMs) return;
    ultimaBaixa.set(empresaId, agora);
    try {
      let andamento = baixaEmAndamento.get(empresaId);
      if (!andamento) {
        andamento = est.baixarConsumoDasVendas(db, empresaId, { fuso }).finally(() => baixaEmAndamento.delete(empresaId));
        baixaEmAndamento.set(empresaId, andamento);
      }
      await andamento;
    } catch (error) {
      if (obrigatoria) throw error;
      console.error('[suprimentos] consumo', String(error?.message || error).slice(0, 160));
    }
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
  // Duas permissões na mesma operação: vale a restrição mais forte (a unidade, se alguma estiver presa).
  async function escopoDuplo(req, outra, lojaRestrita) {
    const segundo = await escopoDaRequisicao(req, outra);
    const outraLoja = segundo?.lojaRestrita || null;
    if (lojaRestrita && outraLoja && lojaRestrita !== outraLoja) throw new ErroDominio('STORE_SCOPE_MISMATCH', 'Suas permissões são de unidades diferentes', 403);
    return lojaRestrita || outraLoja;
  }
  async function pedidoNoAlcance(empresaId, id, lojaRestrita) {
    const p = await cmp.obterPedido(db, empresaId, exigirUuid(id, 'pedido'));
    if (lojaRestrita && p.lojaId !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Pedido não encontrado', 404);
    return p;
  }

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
  router.post('/movimentos', rota('inventory.write', ({ req, empresaId, lojaRestrita, usuario }) => est.movimentar(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, lojaRestrita) }, { usuario }), 201));
  router.post('/transferencias', rota('inventory.write', ({ req, empresaId, lojaRestrita, usuario }) => {
    exigirEmpresaToda(lojaRestrita, 'Transferir entre unidades');
    return est.transferir(db, empresaId, req.body || {}, { usuario });
  }, 201));

  // inventário
  router.get('/inventarios', rota('inventory.read', async ({ req, empresaId, lojaRestrita }) => {
    const lista = await est.listarInventarios(db, empresaId);
    const loja = unidade(req, lojaRestrita);
    return loja ? lista.filter((i) => i.lojaId === loja) : lista;
  }));
  const inventarioNoAlcance = async (empresaId, id, lojaRestrita) => {
    const inv = await est.obterInventario(db, empresaId, id);
    if (lojaRestrita && inv.lojaId !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Inventário não encontrado', 404);
    return inv;
  };
  router.get('/inventarios/:id', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => inventarioNoAlcance(empresaId, req.params.id, lojaRestrita)));
  router.post('/inventarios', rota('inventory.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await baixarConsumo(empresaId, { obrigatoria: true });
    return est.abrirInventario(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, lojaRestrita) }, { usuario });
  }, 201));
  router.post('/inventarios/:id/contagens', rota('inventory.write', async ({ req, empresaId, lojaRestrita }) => {
    await inventarioNoAlcance(empresaId, req.params.id, lojaRestrita);
    await baixarConsumo(empresaId, { obrigatoria: true });
    return est.registrarContagem(db, empresaId, req.params.id, req.body?.contagens || []);
  }));
  router.post('/inventarios/:id/concluir', rota('inventory.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await inventarioNoAlcance(empresaId, req.params.id, lojaRestrita);
    await baixarConsumo(empresaId, { obrigatoria: true });
    return est.concluirInventario(db, empresaId, req.params.id, { usuario });
  }));
  router.post('/inventarios/:id/cancelar', rota('inventory.write', async ({ req, empresaId, lojaRestrita }) => {
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

  // configuração: unidade de onde saem os insumos do bar
  router.get('/config', rota('inventory.read', ({ empresaId }) => est.obterConfig(db, empresaId)));
  router.put('/config', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { exigirEmpresaToda(lojaRestrita, 'Configurar o estoque'); return est.salvarConfig(db, empresaId, req.body || {}); }));

  // relatórios
  router.get('/sugestao-compra', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => est.sugestaoDeCompra(db, empresaId, { lojaId: unidade(req, lojaRestrita) })));
  router.get('/curva-abc', rota('inventory.read', ({ req, empresaId }) => est.curvaAbc(db, empresaId, { dias: req.query.dias })));
  router.get('/perdas', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => est.perdasDoPeriodo(db, empresaId, { de: req.query.de, ate: req.query.ate, lojaId: unidade(req, lojaRestrita), fuso })));

  // compras
  router.get('/pedidos', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => cmp.listarPedidos(db, empresaId, { status: req.query.status || null, lojaId: unidade(req, lojaRestrita) })));
  router.get('/pedidos/:id', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => pedidoNoAlcance(empresaId, req.params.id, lojaRestrita)));
  router.post('/pedidos', rota('inventory.write', ({ req, empresaId, lojaRestrita, usuario }) => cmp.criarPedido(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, lojaRestrita) }, { usuario }), 201));
  router.post('/pedidos/:id/:acao(enviar|cancelar)', rota('inventory.write', async ({ req, empresaId, lojaRestrita }) => {
    await pedidoNoAlcance(empresaId, req.params.id, lojaRestrita);
    return cmp.mudarStatusPedido(db, empresaId, exigirUuid(req.params.id, 'pedido'), req.params.acao);
  }));
  // receber gera conta a pagar: exige também poder lançar no financeiro
  router.post('/recebimentos', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    const restrita = await escopoDuplo(req, 'inventory.write', lojaRestrita);
    const pedida = String(req.body?.lojaId || '').trim();
    return cmp.receber(db, empresaId, { ...(req.body || {}), lojaId: restrita ? unidade(req, restrita) : (pedida || null) }, { usuario, fuso, lojaRestrita: restrita });
  }, 201));
  router.get('/recebimentos', rota('inventory.read', ({ req, empresaId, lojaRestrita }) => cmp.listarRecebimentos(db, empresaId, { lojaId: unidade(req, lojaRestrita) })));
  router.post('/nfe/previa', rota('inventory.write', ({ req, empresaId }) => cmp.previaNfe(db, empresaId, String(req.body?.xml || ''))));
  router.post('/nfe/lancar', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    const restrita = await escopoDuplo(req, 'inventory.write', lojaRestrita);
    return cmp.lancarNfe(db, empresaId, { ...(req.body || {}), lojaId: unidade(req, restrita) }, { usuario, fuso, lojaRestrita: restrita });
  }, 201));

  return router;
}
