// ============================================================================
// ROTAS REST: KYTTO ERP 360
// Propostas Comerciais, Ordens de Serviço, Expedição/Romaneios e Patrimônio
// ============================================================================
import express from 'express';
import * as svc from './servico.js';
import * as dreSvc from './dre-servico.js';
import { responderErro } from '../acesso/banco.js';

export function createErpAdminRouter({ db, escopoDaRequisicao }) {
  if (!db || typeof escopoDaRequisicao !== 'function') {
    throw new Error('createErpAdminRouter: db e escopoDaRequisicao são obrigatórios');
  }

  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, permissao);
      const usuario = String(req.user?.nome || req.user?.email || 'equipe');
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, usuario }));
    } catch (error) {
      return responderErro(res, error);
    }
  };

  // ── KPIS GERAIS DO ERP ───────────────────────────────────────────────────
  router.get('/kpis', rota('catalog.read', ({ empresaId }) => svc.obterKpisErp(db, empresaId)));

  // ── PROPOSTAS COMERCIAIS & ORÇAMENTOS ────────────────────────────────────
  router.get('/propostas', rota('catalog.read', ({ req, empresaId }) => svc.listarPropostas(db, empresaId, {
    status: req.query.status,
    busca: req.query.busca || req.query.q,
    limit: Number(req.query.limit || 50),
    offset: Number(req.query.offset || 0)
  })));

  router.get('/propostas/:id', rota('catalog.read', ({ req, empresaId }) => svc.obterProposta(db, empresaId, req.params.id)));

  router.post('/propostas', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarProposta(db, empresaId, req.body || {}, usuario), 201));

  router.put('/propostas/:id', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarProposta(db, empresaId, { ...(req.body || {}), id: req.params.id }, usuario)));

  router.post('/propostas/:id/status', rota('catalog.write', ({ req, empresaId, usuario }) => svc.alterarStatusProposta(db, empresaId, req.params.id, req.body || {}, usuario)));

  router.post('/propostas/:id/converter', rota('catalog.write', ({ req, empresaId, usuario }) => svc.converterPropostaEmVenda(db, empresaId, req.params.id, req.body || {}, usuario)));

  // ── ORDENS DE SERVIÇO & MANUTENÇÃO (OS 360) ──────────────────────────────
  router.get('/os', rota('catalog.read', ({ req, empresaId }) => svc.listarOS(db, empresaId, {
    status: req.query.status,
    prioridade: req.query.prioridade,
    busca: req.query.busca || req.query.q,
    limit: Number(req.query.limit || 50),
    offset: Number(req.query.offset || 0)
  })));

  router.get('/os/:id', rota('catalog.read', ({ req, empresaId }) => svc.obterOS(db, empresaId, req.params.id)));

  router.post('/os', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarOS(db, empresaId, req.body || {}, usuario), 201));

  router.put('/os/:id', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarOS(db, empresaId, { ...(req.body || {}), id: req.params.id }, usuario)));

  router.post('/os/:id/status', rota('catalog.write', ({ req, empresaId, usuario }) => svc.atualizarStatusOS(db, empresaId, req.params.id, req.body?.status, usuario)));

  router.post('/os/:id/faturar', rota('catalog.write', ({ req, empresaId, usuario }) => svc.faturarOS(db, empresaId, req.params.id, usuario)));

  router.post('/os/:id/assinatura', rota('catalog.write', ({ req, empresaId }) => svc.salvarAssinaturaOS(db, empresaId, req.params.id, req.body?.assinatura)));

  // ── EXPEDIÇÃO, LOGÍSTICA & ROMANEIOS ─────────────────────────────────────
  router.get('/romaneios', rota('catalog.read', ({ req, empresaId }) => svc.listarRomaneios(db, empresaId, {
    status: req.query.status,
    limit: Number(req.query.limit || 50),
    offset: Number(req.query.offset || 0)
  })));

  router.get('/romaneios/:id', rota('catalog.read', ({ req, empresaId }) => svc.obterRomaneio(db, empresaId, req.params.id)));

  router.post('/romaneios', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarRomaneio(db, empresaId, req.body || {}, usuario), 201));

  router.put('/romaneios/:id', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarRomaneio(db, empresaId, { ...(req.body || {}), id: req.params.id }, usuario)));

  router.post('/romaneios/:id/entrega/:entregaId', rota('catalog.write', ({ req, empresaId }) => svc.atualizarStatusEntrega(db, empresaId, req.params.id, req.params.entregaId, req.body || {})));

  // ── PATRIMÔNIO & ATIVOS IMOBILIZADOS ─────────────────────────────────────
  router.get('/ativos', rota('catalog.read', ({ req, empresaId }) => svc.listarAtivos(db, empresaId, {
    categoria: req.query.categoria,
    busca: req.query.busca || req.query.q,
    limit: Number(req.query.limit || 50),
    offset: Number(req.query.offset || 0)
  })));

  router.post('/ativos', rota('catalog.write', ({ req, empresaId }) => svc.salvarAtivo(db, empresaId, req.body || {}), 201));

  router.put('/ativos/:id', rota('catalog.write', ({ req, empresaId }) => svc.salvarAtivo(db, empresaId, { ...(req.body || {}), id: req.params.id })));

  router.post('/ativos/:id/manutencao', rota('catalog.write', ({ req, empresaId }) => svc.registrarManutencaoAtivo(db, empresaId, req.params.id, req.body || {})));


  // ── DRE CONTÁBIL E GERENCIAL AVANÇADA ───────────────────────────────────
  router.get('/dre', rota('reports.read', ({ req, empresaId, lojaRestrita }) => dreSvc.calcularDreCompleta(db, empresaId, {
    de: req.query.de,
    ate: req.query.ate,
    mes: req.query.mes,
    ano: req.query.ano,
    regime: req.query.regime || 'competencia',
    lojaId: req.query.lojaId || lojaRestrita,
    centroCustoId: req.query.centroCustoId
  })));

  router.get('/dre/anual', rota('reports.read', ({ req, empresaId, lojaRestrita }) => dreSvc.calcularDreAnual12Meses(db, empresaId, {
    ano: req.query.ano,
    regime: req.query.regime || 'competencia',
    lojaId: req.query.lojaId || lojaRestrita
  })));

  router.get('/dre/exportar-csv', rota('reports.read', async ({ req, empresaId, lojaRestrita }) => {
    const dre = await dreSvc.calcularDreCompleta(db, empresaId, {
      de: req.query.de,
      ate: req.query.ate,
      mes: req.query.mes,
      ano: req.query.ano,
      regime: req.query.regime || 'competencia',
      lojaId: req.query.lojaId || lojaRestrita,
      centroCustoId: req.query.centroCustoId
    });

    const linhasCsv = [
      "\uFEFFCódigo;Descrição Contábil;Valor (R$);Análise Vertical (%)",
    ];

    for (const l of dre.linhas) {
      linhasCsv.push(`"${l.codigo}";"${l.descricao}";"${Number(l.valor || 0).toFixed(2).replace(".", ",")}";"${Number(l.av || 0).toFixed(1).replace(".", ",")}%"`);
      if (Array.isArray(l.filhos)) {
        for (const f of l.filhos) {
          linhasCsv.push(`"  ${f.codigo}";"  ${f.descricao}";"${Number(f.valor || 0).toFixed(2).replace(".", ",")}";"${Number(f.av || 0).toFixed(1).replace(".", ",")}%"`);
          if (Array.isArray(f.detalhe)) {
            for (const d of f.detalhe) {
              linhasCsv.push(`"    -";"    ${d.categoria}";"${Number(d.valor || 0).toFixed(2).replace(".", ",")}";"-"`);
            }
          }
        }
      }
    }

    linhasCsv.push("");
    linhasCsv.push(`"RESUMO";"Receita Bruta";"${dre.resumo.receitaBruta.toFixed(2).replace(".", ",")}";"100,0%"`);
    linhasCsv.push(`"RESUMO";"Receita Líquida (ROL)";"${dre.resumo.receitaLiquida.toFixed(2).replace(".", ",")}";"${((dre.resumo.receitaLiquida / (dre.resumo.receitaBruta || 1)) * 100).toFixed(1).replace(".", ",")}%"`);
    linhasCsv.push(`"RESUMO";"Lucro Bruto";"${dre.resumo.lucroBruto.toFixed(2).replace(".", ",")}";"${dre.resumo.margemBrutaPct.toFixed(1).replace(".", ",")}%"`);
    linhasCsv.push(`"RESUMO";"EBITDA Operacional";"${dre.resumo.ebitda.toFixed(2).replace(".", ",")}";"${dre.resumo.margemEbitdaPct.toFixed(1).replace(".", ",")}%"`);
    linhasCsv.push(`"RESUMO";"Resultado Líquido";"${dre.resumo.resultadoLiquido.toFixed(2).replace(".", ",")}";"${dre.resumo.margemLiquidaPct.toFixed(1).replace(".", ",")}%"`);
    linhasCsv.push(`"RESUMO";"Ponto de Equilíbrio";"${dre.resumo.pontoEquilibrio.toFixed(2).replace(".", ",")}";"-"`);

    const conteudo = linhasCsv.join("\r\n");
    return {
      ok: true,
      nomeArquivo: `DRE_${dre.periodo.mes || dre.periodo.ano || "Periodo"}_${dre.periodo.regime}.csv`,
      conteudoBase64: Buffer.from(conteudo, "utf8").toString("base64"),
      csvText: conteudo
    };
  }));

  return router;
}
