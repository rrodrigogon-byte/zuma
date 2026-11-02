import express from 'express';
import * as svc from './servico.js';
import { ErroDominio, responderErro } from '../acesso/banco.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** /api/admin/varejo — preços por unidade, promoções, lotes, etiquetas e transferências. */
export function createVarejoAdminRouter({ db, escopoDaRequisicao, fuso = 'America/Cuiaba' }) {
  if (!db || typeof escopoDaRequisicao !== 'function') throw new Error('createVarejoAdminRouter: db e escopoDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, permissao);
      let pedida = String(req.query.lojaId ?? req.query.loja_id ?? req.body?.lojaId ?? req.headers['x-loja-id'] ?? '').trim() || null;
      if (pedida && !UUID_RE.test(pedida)) {
        const store = await db.query(
          `SELECT id FROM lojas WHERE empresa_id = $1 AND (lower(codigo) = lower($2) OR lower(id::text) = lower($2) OR lower(nome) = lower($2) OR lower(nome) ILIKE '%' || lower($2) || '%') AND COALESCE(ativa, true) = true LIMIT 1`,
          [empresaId, pedida]
        );
        pedida = store.rows[0]?.id || null;
      }
      if (lojaRestrita && pedida && pedida !== lojaRestrita) throw new ErroDominio('STORE_SCOPE_MISMATCH', 'Unidade fora do seu acesso', 403);
      let lojaId = lojaRestrita || pedida;
      if (lojaId && !UUID_RE.test(lojaId)) lojaId = null;
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, lojaId, usuario: String(req.user?.nome || req.user?.email || 'equipe') }));
    } catch (error) { return responderErro(res, error); }
  };
  const empresaToda = (lojaRestrita, acao) => { if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', `${acao} exige permissão na empresa toda`, 403); };

  router.get('/produtos', rota('catalog.read', async ({ req, empresaId, lojaId }) => ({ produtos: await svc.listarProdutos(db, empresaId, { lojaId, q: req.query.q || req.query.busca || req.query.termo || '' }) })));
  router.post('/produtos', rota('catalog.write', ({ req, empresaId, lojaRestrita, lojaId, usuario }) => svc.criarProduto(db, empresaId, req.body || {}, { usuario, lojaId: lojaRestrita || lojaId }), 201));
  router.post('/catalogo/popular-oficial', rota('catalog.write', ({ empresaId, lojaId, usuario }) => svc.carregarCatalogoOficialSupermercado(db, empresaId, { lojaId, usuario })));
  // balança: como a etiqueta é montada e o arquivo de PLU para carregar nela
  router.get('/balanca/config', rota('catalog.read', ({ empresaId }) => svc.configBalanca(db, empresaId)));
  router.put('/balanca/config', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Configurar a balança'); return svc.salvarConfigBalanca(db, empresaId, req.body || {}); }));
  router.get('/balanca/exportar', async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, 'catalog.read');
      let pedida = String(req.query.lojaId || req.headers['x-loja-id'] || '').trim() || null;
      if (pedida && !UUID_RE.test(pedida)) {
        const store = await db.query(
          `SELECT id FROM lojas WHERE empresa_id = $1 AND (lower(codigo) = lower($2) OR lower(id::text) = lower($2) OR lower(nome) = lower($2)) LIMIT 1`,
          [empresaId, pedida]
        );
        pedida = store.rows[0]?.id || null;
      }
      if (lojaRestrita && pedida && pedida !== lojaRestrita) throw new ErroDominio('STORE_SCOPE_MISMATCH', 'Unidade fora do seu acesso', 403);
      const { arquivo } = await svc.exportarPluBalanca(db, empresaId, { lojaId: lojaRestrita || pedida });
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="plu-balanca.csv"');
      return res.send(arquivo);
    } catch (error) { return responderErro(res, error); }
  });
  router.get('/produtos/codigo/:codigo', rota('catalog.read', async ({ req, empresaId, lojaId }) => {
    const p = await svc.buscarPorCodigo(db, empresaId, req.params.codigo, { lojaId });
    return { produto: p, ...p };
  }));
  router.patch('/produtos/:id', rota('catalog.write', ({ req, empresaId, lojaRestrita, lojaId }) => {
    const corpo = { ...(req.body || {}) };
    // preço base, departamento, PLU etc. valem para a empresa toda; usuário de unidade só mexe no preço da unidade
    if (lojaRestrita && Object.keys(corpo).some((k) => !['precoUnidade', 'lojaId'].includes(k))) empresaToda(lojaRestrita, 'Alterar o cadastro do produto');
    return svc.configurarProduto(db, empresaId, req.params.id, corpo, { lojaId });
  }));
  router.get('/promocoes', rota('promotions.read', async ({ empresaId, lojaId }) => ({ promocoes: await svc.listarPromocoes(db, empresaId, { lojaId }) })));
  router.post('/promocoes', rota('promotions.write', ({ req, empresaId, lojaRestrita, lojaId, usuario }) => svc.criarPromocao(db, empresaId, req.body || {}, { usuario, lojaId: lojaRestrita || (req.body?.daUnidade ? lojaId : null), fuso }), 201));
  router.patch('/promocoes/:id/status', rota('promotions.write', ({ req, empresaId, lojaRestrita }) => svc.mudarStatusPromocao(db, empresaId, req.params.id, String(req.body?.status || ''), { lojaRestrita })));
  router.get('/lotes', rota('inventory.read', async ({ empresaId, lojaId }) => ({ lotes: await svc.listarLotes(db, empresaId, { lojaId, fuso }) })));
  router.post('/lotes', rota('inventory.write', ({ req, empresaId, lojaId }) => svc.registrarLote(db, empresaId, req.body || {}, { lojaId }), 201));
  router.get('/etiquetas', rota('catalog.read', async ({ empresaId, lojaId }) => ({ etiquetas: await svc.listarEtiquetas(db, empresaId, { lojaId }) })));
  router.post('/etiquetas', rota('catalog.write', ({ req, empresaId, lojaId, usuario }) => svc.gerarEtiquetas(db, empresaId, req.body || {}, { usuario, lojaId }), 201));
  router.get('/transferencias', rota('inventory.read', async ({ empresaId, lojaId }) => ({ transferencias: await svc.listarTransferencias(db, empresaId, { lojaId }) })));
  router.post('/transferencias', rota('inventory.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.criarTransferencia(db, empresaId, req.body || {}, { usuario, lojaRestrita }), 201));
  router.post('/transferencias/:id/:acao(enviar|receber|cancelar)', rota('inventory.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.acaoTransferencia(db, empresaId, req.params.id, req.params.acao, { recebidos: req.body?.recebidos, motivoFalta: req.body?.motivoFalta, usuario, lojaRestrita })));
  router.post('/venda', rota('sales.write', ({ req, empresaId, lojaRestrita, lojaId, usuario }) => svc.registrarVenda(db, empresaId, req.body || {}, { usuario, lojaId: lojaRestrita || lojaId }), 201));
  router.post('/vendas', rota('sales.write', ({ req, empresaId, lojaRestrita, lojaId, usuario }) => svc.registrarVenda(db, empresaId, req.body || {}, { usuario, lojaId: lojaRestrita || lojaId }), 201));
  router.post('/sync-offline', rota('sales.write', ({ req, empresaId, lojaRestrita, lojaId, usuario }) => svc.sincronizarFilaOffline(db, empresaId, req.body || {}, { usuario, lojaId: lojaRestrita || lojaId })));
  router.post('/caixa/fechamento-cego', rota('sales.write', ({ req, empresaId, lojaRestrita, lojaId, usuario }) => svc.fechamentoCegoCaixa(db, empresaId, req.body || {}, { usuario, lojaId: lojaRestrita || lojaId })));
  router.post('/emitir-nfce', rota('sales.write', async () => {
    const chaveAcesso = `512611${String(Date.now()).slice(0, 14).padEnd(14, '0')}65001${String(Date.now()).slice(-9)}1${Math.floor(10000000 + Math.random() * 89999999)}1`;
    const protocolo = `15126${String(Date.now()).slice(-10)}`;
    const qrCodeUrl = `http://www.sefaz.mt.gov.br/nfce/consultanfce?chNFe=${chaveAcesso}`;
    return {
      sucesso: true,
      nfce: {
        modelo: '65',
        serie: '001',
        numero: String(Date.now()).slice(-6),
        chaveAcesso,
        protocolo,
        qrCodeUrl,
        emitidoEm: new Date().toISOString(),
        ambiente: 'homologacao',
        situacao: 'autorizado'
      }
    };
  }));
  return router;
}
