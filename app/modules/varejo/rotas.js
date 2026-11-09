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
  router.post(['/catalogo-oficial/carregar', '/catalogo/popular-oficial'], rota('catalog.write', async ({ empresaId, lojaId, usuario }) => {
    const res = await svc.carregarCatalogoOficialSupermercado(db, empresaId, { lojaId, usuario });
    return { sucesso: true, totalInseridos: res.adicionados, adicionados: res.adicionados, totalCatalogo: res.totalCatalogo };
  }));
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
  router.get('/promocoes', rota('catalog.read', async ({ empresaId, lojaId }) => ({ promocoes: await svc.listarPromocoes(db, empresaId, { lojaId }) })));
  router.post('/promocoes', rota('promotions.write', ({ req, empresaId, lojaRestrita, lojaId, usuario }) => svc.criarPromocao(db, empresaId, req.body || {}, { usuario, lojaId: lojaRestrita || (req.body?.daUnidade ? lojaId : null), fuso }), 201));
  router.patch('/promocoes/:id/status', rota('promotions.write', ({ req, empresaId, lojaRestrita }) => svc.mudarStatusPromocao(db, empresaId, req.params.id, String(req.body?.status || ''), { lojaRestrita })));
  router.get('/lotes', rota('catalog.read', async ({ empresaId, lojaId }) => ({ lotes: await svc.listarLotes(db, empresaId, { lojaId, fuso }) })));
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
  // Novas rotas para o módulo expandido de supermercado
  router.get(['/dashboard', '/resumo-dashboard'], rota('catalog.read', async ({ empresaId, lojaId }) => {
    const dash = await svc.resumoDashboard(db, empresaId, { lojaId });
    return {
      dashboard: {
        ...dash,
        totalVendas: dash.faturamentoHoje,
        cuponsEmitidos: dash.vendasHoje,
        ticketMedio: dash.ticketMedioHoje,
        produtosCadastrados: dash.totalProdutos,
        itensPesaveis: dash.totalPesaveis,
        alertasRuptura: Array.isArray(dash.rupturas) ? dash.rupturas.length : 0,
        itensVencendo: (dash.lotesCriticos || 0) + (dash.lotesVencidos || 0)
      },
      ...dash
    };
  }));
  router.get('/vendas', rota('sales.read', async ({ req, empresaId, lojaId }) => ({ vendas: await svc.listarVendas(db, empresaId, { lojaId, limit: req.query.limit, offset: req.query.offset }) })));
  router.delete('/produtos/:id', rota('catalog.write', ({ req, empresaId }) => svc.inativarProduto(db, empresaId, req.params.id)));
  router.put('/produtos/:id/configuracao-loja', rota('catalog.write', ({ req, empresaId, lojaRestrita, lojaId }) => {
    const corpo = { ...(req.body || {}) };
    return svc.configurarProduto(db, empresaId, req.params.id, corpo, { lojaId });
  }));
  router.post('/lotes/:id/baixar', rota('inventory.write', ({ req, empresaId, usuario }) => svc.baixarLote(db, empresaId, req.params.id, req.body || {}, { usuario })));
  router.get('/fornecedores', rota('catalog.read', async ({ empresaId }) => svc.listarFornecedoresVarejo(db, empresaId)));
  router.post('/fornecedores', rota('catalog.write', ({ req, empresaId }) => svc.salvarFornecedorVarejo(db, empresaId, req.body || {}), 201));
  router.get(['/analise-margens', '/margem'], rota('catalog.read', async ({ empresaId, lojaId }) => {
    const res = await svc.analiseMargemCurvaABC(db, empresaId, { lojaId });
    return {
      ...res,
      analise: res.itens
    };
  }));
  router.get('/margem/resumo', rota('catalog.read', async ({ empresaId, lojaId }) => ({ resumo: (await svc.analiseMargemCurvaABC(db, empresaId, { lojaId })).resumo })));

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

  // ── Caixa e Operações de Frente de Caixa (PDV) ──
  router.get('/caixa/sessao', rota('catalog.read', async ({ req, empresaId, lojaId }) => {
    return svc.obterSessaoCaixa(db, empresaId, { lojaId, terminal: req?.query?.terminal });
  }));

  // ── Parque de Terminais PDV (Frentes de Caixa Configuráveis) ──
  router.get('/terminais', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return svc.listarTerminaisPdv(db, empresaId, { lojaId });
  }));
  router.post('/terminais', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    return svc.salvarTerminalPdv(db, empresaId, req.body || {}, { usuario, lojaId });
  }));

  router.get('/caixa/sessao-antiga', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return svc.obterSessaoCaixa(db, empresaId, { lojaId });
  }));

  router.post('/caixa/abrir', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    return svc.abrirCaixa(db, empresaId, req.body, { usuario, lojaId });
  }));

  router.post('/caixa/movimentacao', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarMovimentacaoCaixa(db, empresaId, req.body, { usuario, lojaId });
  }));

  router.post('/caixa/fechar', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    return svc.fecharCaixa(db, empresaId, req.body, { usuario, lojaId });
  }));

  // ── Cargas de Balança Oficiais (Toledo MGV6 e Filizola) ──
  router.get('/balanca/toledo-mgv', rota('catalog.read', async ({ req, empresaId, lojaId }) => {
    return svc.exportarArquivoToledoMgv(db, empresaId, { versao: req.query.versao || 'mgv6', lojaId });
  }));

  router.get('/balanca/filizola', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return svc.exportarArquivoFilizola(db, empresaId, { lojaId });
  }));

  // ── Módulo de Açougue / Desossa (Rendimento) ──
  router.get('/desossas', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return { desossas: await svc.listarDesossas(db, empresaId, { lojaId }) };
  }));

  router.post('/desossas', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarDesossa(db, empresaId, req.body, { usuario, lojaId });
  }));

  // ── Módulo de Padaria / Produção (Fichas Técnicas) ──
  router.get('/padaria/receitas', rota('catalog.read', async ({ empresaId }) => {
    return { receitas: await svc.listarReceitasPadaria(db, empresaId) };
  }));

  router.post('/padaria/receitas', rota('catalog.write', async ({ req, empresaId }) => {
    return svc.salvarReceitaPadaria(db, empresaId, req.body);
  }));

  router.post('/padaria/producao', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarProducaoPadaria(db, empresaId, req.body, { usuario, lojaId });
  }));

  // ── Inventário Cíclico e Auditoria de Gôndola ──
  router.get('/inventarios', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return { inventarios: await svc.listarInventarios(db, empresaId, { lojaId }) };
  }));

  router.post('/inventarios', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    return svc.criarInventario(db, empresaId, req.body, { usuario, lojaId });
  }));

  // ── Clube de Benefícios Kytto ──
  router.get('/clube/clientes', rota('catalog.read', async ({ empresaId }) => {
    return { clientes: await svc.listarClientesClube(db, empresaId) };
  }));

  router.get('/clube/consultar', rota('catalog.read', async ({ req, empresaId }) => {
    return svc.consultarClienteClubePorCpf(db, empresaId, req.query.cpf || req.query.q);
  }));

  router.post('/clube/clientes', rota('catalog.write', async ({ req, empresaId }) => {
    return svc.salvarClienteClube(db, empresaId, req.body);
  }));


  // ── PDV Operacional & Emissão de Vendas ──
  router.post('/vendas/pdv', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarVendaPdv(db, empresaId, req.body || {}, { usuario, lojaId });
  }));

  // ── Pacote Completo de Carga Toledo MGV6 (Nutricional, Alergênicos, Receitas) ──
  router.get('/balanca/toledo-mgv/pacote-completo', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return svc.exportarPacoteCompletoToledo(db, empresaId, { lojaId });
  }));

  // ── Etiquetas de Gôndola & Precificação por Quilo/Litro ──
  router.get('/etiquetas/itens', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return { itens: await svc.listarItensEtiquetas(db, empresaId, { lojaId }) };
  }));
  router.post('/etiquetas/gerar-zpl', rota('catalog.write', async ({ req, empresaId }) => {
    return svc.gerarEtiquetasZpl(db, empresaId, req.body || {});
  }));

  // ── Importador de XML de Compra (NF-e Modelo 55) ──
  router.post('/nfe-entrada/processar-xml', rota('catalog.write', async ({ req, empresaId, lojaId, usuario }) => {
    const xml = req.body?.xmlString || req.body?.xml || (typeof req.body === 'string' ? req.body : '');
    return svc.processarXmlNfeCompra(db, empresaId, xml, { usuario, lojaId });
  }));

  // ── Prevenção de Perdas & Indicadores ABRAS ──
  router.get('/prevencao-perdas', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return svc.obterRelatorioPrevencaoPerdas(db, empresaId, { lojaId });
  }));

  // ── Gestão de Hortifrúti (FLV) & Perecíveis ──
  router.get('/hortifruti', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return svc.listarItensHortifruti(db, empresaId, { lojaId });
  }));

  router.post('/hortifruti/remarcar', rota('catalog.write', async ({ req, empresaId, usuario }) => {
    return svc.aplicarRemarcacaoMaturacaoFLV(db, empresaId, req.body || {}, { usuario });
  }));

  // ── Ruptura de Gôndola & Reposição Automática (ROP) ──
  router.get('/ruptura', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return svc.obterRelatorioRuptura(db, empresaId, { lojaId });
  }));

  router.post('/ruptura/gerar-pedido', rota('catalog.write', async ({ req, empresaId, usuario }) => {
    return svc.gerarOrdemCompraRuptura(db, empresaId, req.body || {}, { usuario });
  }));

  // ── Auditoria de Preços Gôndola vs PDV (Lei 10.962/04 Procon) ──
  router.get('/auditoria-precos', rota('catalog.read', async ({ empresaId, lojaId }) => {
    return svc.auditarPrecosGondolaPdv(db, empresaId, { lojaId });
  }));

  // ── Entrada de NF-e e Atualização de Estoque Central ──
  router.post("/nfe-entrada/confirmar", rota("catalog.write", async ({ req, empresaId, lojaId, usuario }) => {
    return svc.confirmarEntradaNfeCompra(db, empresaId, req.body || {}, { usuario, lojaId });
  }));

  // ── Sincronização de Vendas em Contingência Offline ──
  router.post("/vendas/sincronizar-offline", rota("catalog.write", async ({ req, empresaId, lojaId, usuario }) => {
    return svc.sincronizarVendasOffline(db, empresaId, req.body?.vendas || [], { usuario, lojaId });
  }));

  // ── Gestão de Caixas Individuais & Auditoria ──
  router.get("/caixas", rota("catalog.read", async ({ empresaId, lojaId }) => {
    return svc.listarCaixas(db, empresaId, { lojaId });
  }));

  router.get("/caixas/:id/detalhes", rota("catalog.read", async ({ req, empresaId }) => {
    return svc.obterDetalhesCaixa(db, empresaId, req.params.id);
  }));

  // ── Kardex e Histórico do Produto ──
  router.get("/produtos/:id/kardex", rota("catalog.read", async ({ req, empresaId }) => {
    return svc.obterKardexProduto(db, empresaId, req.params.id);
  }));

  // ── Docas & Recebimento de Cargas (Cadeia de Frio & Conferência Cega) ──
  router.get("/docas/recebimentos", rota("catalog.read", async ({ empresaId, lojaId }) => {
    return svc.listarRecebimentosDoca(db, empresaId, { lojaId });
  }));
  router.post("/docas/recebimentos", rota("catalog.write", async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarRecebimentoDoca(db, empresaId, req.body || {}, { usuario, lojaId });
  }));

  // ── Central de Trocas & Devoluções (SAC & Vales-Compra) ──
  router.get("/trocas", rota("catalog.read", async ({ empresaId, lojaId }) => {
    return svc.listarTrocas(db, empresaId, { lojaId });
  }));
  router.post("/trocas", rota("catalog.write", async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarTrocaDevolucao(db, empresaId, req.body || {}, { usuario, lojaId });
  }));
  router.get("/trocas/validar-vale/:codigo", rota("catalog.read", async ({ req, empresaId }) => {
    return svc.validarValeCompras(db, empresaId, req.params.codigo);
  }));

  // ── SPRINT 1 ENTERPRISE: ATACAREJO, PROMOÇÕES, COMPRAS & RUPTURA ──
  router.get("/atacarejo-faixas", rota("catalog.read", async ({ req, empresaId, lojaId }) => {
    return svc.listarAtacarejoFaixas(db, empresaId, { lojaId, itemId: req.query.itemId });
  }));
  router.post("/atacarejo-faixas", rota("catalog.write", async ({ req, empresaId, lojaId }) => {
    return svc.salvarAtacarejoFaixa(db, empresaId, { ...req.body, lojaId });
  }));
  router.delete("/atacarejo-faixas/:id", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.removerAtacarejoFaixa(db, empresaId, req.params.id);
  }));

  router.get("/promocoes-avancadas", rota("catalog.read", async ({ req, empresaId, lojaId }) => {
    return svc.listarPromocoesAvancadas(db, empresaId, { lojaId, ativasApenas: req.query.todas !== "true" });
  }));
  router.post("/promocoes-avancadas", rota("catalog.write", async ({ req, empresaId, lojaId }) => {
    return svc.salvarPromocaoAvancada(db, empresaId, { ...req.body, lojaId });
  }));
  router.delete("/promocoes-avancadas/:id", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.desativarPromocaoAvancada(db, empresaId, req.params.id);
  }));

  router.post("/precificacao/calcular-carrinho", rota("catalog.read", async ({ req, empresaId, lojaId }) => {
    return svc.aplicarMotorPromocoesCarrinho(db, empresaId, req.body.itens || [], { clienteCpf: req.body.clienteCpf, lojaId });
  }));

  router.get("/sugestao-compras", rota("catalog.read", async ({ req, empresaId, lojaId }) => {
    return svc.calcularSugestaoCompras(db, empresaId, { 
      diasHistorico: Number(req.query.diasHistorico || 30), 
      margemSegurancaDias: Number(req.query.margemSegurancaDias || 5),
      lojaId 
    });
  }));
  router.post("/sugestao-compras/gerar-pedido", rota("catalog.write", async ({ req, empresaId, usuario }) => {
    return svc.gerarPedidoCompraSugerido(db, empresaId, { itens: req.body.itens || [], usuario });
  }));

  router.get("/rupturas/tempo-real", rota("catalog.read", async ({ req, empresaId, lojaId }) => {
    return svc.monitorarRupturasTempoReal(db, empresaId, { toleranciaHoras: Number(req.query.toleranciaHoras || 3), lojaId });
  }));
  router.post("/rupturas/:id/repor", rota("catalog.write", async ({ req, empresaId, usuario }) => {
    return svc.confirmarReposicaoGondola(db, empresaId, req.params.id, usuario);
  }));


  // ── Sprint 2 Enterprise: Coletor Mobile, Tributário, WMS, Avarias & Cockpit ──
  router.post("/coletor/leitura", rota("catalog.write", async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarLeituraColetor(db, empresaId, { ...req.body, lojaId, operador: usuario?.nome || req.body.operador });
  }));
  router.get("/coletor/leituras", rota("catalog.read", async ({ req, empresaId }) => {
    return svc.listarLeiturasColetor(db, empresaId, req.query);
  }));
  router.get("/tributario/matriz", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarMatrizTributaria(db, empresaId);
  }));
  router.post("/tributario/simular", rota("catalog.read", async ({ req, empresaId }) => {
    return svc.simularTributacaoItem(db, empresaId, req.body);
  }));
  router.get("/wms/enderecos", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarEnderecamentosWms(db, empresaId);
  }));
  router.post("/wms/reabastecer", rota("catalog.write", async ({ req, empresaId, usuario }) => {
    return svc.gerarOrdemReabastecimentoWms(db, empresaId, { ...req.body, operador: usuario?.nome || req.body.operador });
  }));
  router.post("/avarias/registrar", rota("catalog.write", async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarAvariaPerda(db, empresaId, { ...req.body, lojaId, responsavel: usuario?.nome || req.body.responsavel });
  }));
  router.get("/avarias/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarAvariasPerdas(db, empresaId);
  }));
  router.get("/cockpit/kpis", rota("catalog.read", async ({ req, empresaId, lojaId }) => {
    return svc.obterCockpitExecutivoSupermercado(db, empresaId, { lojaId });
  }));


  // ── Sprint 3 Enterprise: Pedidos EDI, Selinhos, DRE de Loja & SPED Bloco K ──
  router.post("/pedidos-compra/criar", rota("catalog.write", async ({ req, empresaId, lojaId }) => {
    return svc.criarPedidoCompraFornecedor(db, empresaId, { ...req.body, lojaId });
  }));
  router.get("/pedidos-compra/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarPedidosCompraFornecedor(db, empresaId);
  }));
  router.get("/fidelidade/campanhas-selinhos", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarCampanhasSelinhos(db, empresaId);
  }));
  router.post("/fidelidade/selos-cliente", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.consultarOuCreditarSelosCliente(db, empresaId, req.body);
  }));
  router.get("/dre/mensal", rota("catalog.read", async ({ req, empresaId, lojaId }) => {
    return svc.obterDreSupermercado(db, empresaId, { mesAno: req.query.mesAno, lojaId });
  }));
  router.get("/fiscal/sped-bloco-k", rota("catalog.read", async ({ empresaId }) => {
    return svc.exportarSpedFiscalBlocoK(db, empresaId);
  }));


  // ── Sprint 4 Enterprise: ESL, Rotisseria KDS, Vales/Trocas & Tesouraria/Carro-Forte ──
  router.post("/esl/sincronizar", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.sincronizarEtiquetasEletronicasEsl(db, empresaId, req.body);
  }));
  router.get("/esl/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarEtiquetasEletronicasEsl(db, empresaId);
  }));
  router.post("/rotisseria/pedidos/criar", rota("catalog.write", async ({ req, empresaId, usuario }) => {
    return svc.criarPedidoRotisseriaKds(db, empresaId, { ...req.body, operador: usuario?.nome || req.body.operador });
  }));
  router.post("/rotisseria/pedidos/status", rota("catalog.write", async ({ req, empresaId, usuario }) => {
    return svc.atualizarStatusRotisseriaKds(db, empresaId, { ...req.body, operador: usuario?.nome || req.body.operador });
  }));
  router.get("/rotisseria/pedidos/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarPedidosRotisseriaKds(db, empresaId);
  }));
  router.post("/vales-compra/emitir", rota("catalog.write", async ({ req, empresaId, lojaId }) => {
    return svc.emitirValeCompraTroca(db, empresaId, { ...req.body, lojaId });
  }));
  router.post("/vales-compra/utilizar", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.consultarOuUtilizarValeCompra(db, empresaId, req.body);
  }));
  router.get("/vales-compra/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarValesCompra(db, empresaId);
  }));
  router.post("/tesouraria/malotes/registrar", rota("catalog.write", async ({ req, empresaId, lojaId, usuario }) => {
    return svc.registrarMaloteCarroForte(db, empresaId, { ...req.body, lojaId, responsavelTesouraria: usuario?.nome || req.body.responsavelTesouraria });
  }));
  router.get("/tesouraria/malotes/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarMalotesTesouraria(db, empresaId);
  }));

  // ── FASE 5 ENTERPRISE: PICKING, DESPERDÍCIO, CONCILIAÇÃO & ACORDOS ──
  router.get("/picking/pedidos/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarPedidosPicking(db, empresaId);
  }));
  router.post("/picking/itens/status", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.atualizarStatusItemPicking(db, empresaId, req.body);
  }));
  router.post("/picking/pedidos/concluir", rota("catalog.write", async ({ req, empresaId, usuario }) => {
    return svc.concluirSeparacaoPicking(db, empresaId, { ...req.body, operador: usuario?.nome || req.body.operador });
  }));

  router.get("/desperdicio/remarcacao/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarItensRemarcacaoDesperdicio(db, empresaId);
  }));
  router.post("/desperdicio/acao", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.executarAcaoDesperdicio(db, empresaId, req.body);
  }));

  router.get("/conciliacao/cartoes/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarConciliacaoCartoes(db, empresaId);
  }));
  router.post("/conciliacao/adquirente/processar", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.conciliarLoteAdquirente(db, empresaId, req.body);
  }));

  router.get("/acordos-comerciais/listar", rota("catalog.read", async ({ empresaId }) => {
    return svc.listarAcordosComerciais(db, empresaId);
  }));
  router.post("/acordos-comerciais/criar", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.criarAcordoComercial(db, empresaId, req.body);
  }));
  router.post("/acordos-comerciais/liquidar", rota("catalog.write", async ({ req, empresaId }) => {
    return svc.liquidarAcordoComercial(db, empresaId, req.body);
  }));

  // ── Download do Instalador Windows Kytto PDV ──
  router.get("/download-instalador-windows", (req, res) => {
    const path = require("path");
    const zipPath = path.resolve("web/public/downloads/Kytto-Supermercado-Windows-Installer.zip");
    if (fs.existsSync(zipPath)) {
      res.setHeader("Content-Disposition", "attachment; filename=Kytto-Supermercado-Windows-Installer.zip");
      res.setHeader("Content-Type", "application/zip");
      fs.createReadStream(zipPath).pipe(res);
    } else {
      res.status(404).json({ erro: "Instalador não encontrado." });
    }
  });

  return router;
}


