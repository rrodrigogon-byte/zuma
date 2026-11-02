import express from 'express';
import * as svc from './servico.js';
import * as lote from './lote.js';
import * as sped from './sped.js';
import { ErroDominio, responderErro } from '../acesso/banco.js';

/**
 * /api/admin/fiscal — emitente, certificado A1, classificação, documentos, inutilização,
 * contingência da NFC-e, DANFE e tabela IBPT. Ambiente por emitente (homologação ou produção liberada).
 * `escopoDaRequisicao(req, permissao)` → { empresaId, lojaRestrita } (ver server.js).
 */
export function createFiscalAdminRouter({ db, escopoDaRequisicao, env = process.env, transporte = null }) {
  if (!db || typeof escopoDaRequisicao !== 'function') throw new Error('createFiscalAdminRouter: db e escopoDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '512kb' })); // .pfx em base64
  // CSV do IBPT (≈2 MB por UF) chega como arquivo cru (text/csv ou octet-stream), fora do parser JSON global
  const csvCru = express.raw({ type: (req) => !/^application\/json\b/i.test(String(req.headers['content-type'] || '')), limit: '12mb' });
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, permissao);
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, usuario: String(req.user?.nome || req.user?.email || 'equipe') }));
    } catch (error) {
      return responderErro(res, error);
    }
  };
  const empresaToda = (lojaRestrita, acao) => { if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', `${acao} exige permissão na empresa toda`, 403); };

  router.get('/estado', rota('payments.read', ({ req, empresaId, lojaRestrita }) => svc.prontidao(db, empresaId, { lojaId: lojaRestrita || req.query.lojaId || null, env })));

  router.get('/emitentes', rota('settings.write', ({ empresaId }) => svc.listarEmitentes(db, empresaId)));
  router.put('/emitentes', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Configurar o emitente'); return svc.salvarEmitente(db, empresaId, req.body || {}, { env }); }));
  router.delete('/emitentes/:id', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Excluir o emitente'); return svc.excluirEmitente(db, empresaId, req.params.id); }));
  router.post('/emitentes/:id/reativar', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Reativar o emitente'); return svc.reativarEmitente(db, empresaId, req.params.id); }));

  router.get('/certificados', rota('settings.write', ({ empresaId }) => svc.listarCertificados(db, empresaId)));
  router.post('/certificados', rota('settings.write', ({ req, empresaId, lojaRestrita, usuario }) => {
    empresaToda(lojaRestrita, 'Enviar o certificado');
    return svc.importarCertificado(db, empresaId, { arquivoBase64: req.body?.arquivoBase64, senha: req.body?.senha }, { usuario, env });
  }, 201));
  router.delete('/certificados/:id', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Excluir o certificado'); return svc.excluirCertificado(db, empresaId, req.params.id); }));
  router.post('/certificados/:id/ativar', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Ativar o certificado'); return svc.ativarCertificado(db, empresaId, req.params.id); }));

  // sem classificação, cada item traz a sugestão de NCM/CEST pelo nome (o contador confere)
  router.get('/classificacoes', rota('catalog.read', async ({ empresaId }) => (await svc.listarClassificaveis(db, empresaId))
    .map((i) => (i.classificacao ? i : { ...i, sugestao: lote.sugerirClassificacao(i.nome) }))));
  router.get('/classificacoes/perfis', rota('catalog.read', () => lote.PERFIS));
  router.get('/classificacoes/planilha', async (req, res) => {
    try {
      const { empresaId } = await escopoDaRequisicao(req, 'catalog.read');
      const csv = await lote.exportarClassificacoesCsv(db, empresaId);
      res.set('Cache-Control', 'private, no-store');
      res.type('text/csv; charset=utf-8').attachment('classificacao-fiscal.csv').send(csv);
    } catch (error) { responderErro(res, error); }
  });
  router.post('/classificacoes/planilha', csvCru, rota('catalog.write', ({ req, empresaId, lojaRestrita }) => {
    empresaToda(lojaRestrita, 'Importar a classificação');
    const arquivo = Buffer.isBuffer(req.body) ? req.body : req.body?.arquivoBase64 ? Buffer.from(String(req.body.arquivoBase64).replace(/^data:[^,]*,/, ''), 'base64') : req.body?.csv;
    return lote.importarClassificacoesCsv(db, empresaId, { arquivo, aplicar: req.query.aplicar === '1' });
  }));
  router.post('/classificacoes/lote', rota('catalog.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Classificar em lote'); return lote.classificarEmLote(db, empresaId, req.body || {}); }));
  router.put('/classificacoes', rota('catalog.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Classificar produtos'); return svc.salvarClassificacao(db, empresaId, req.body || {}); }));
  router.delete('/classificacoes', rota('catalog.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Excluir a classificação'); return svc.excluirClassificacao(db, empresaId, { fonte: req.query.fonte || req.body?.fonte, fonteId: req.query.fonteId || req.body?.fonteId }); }));

  router.get('/vendas-sem-nota', rota('payments.read', ({ empresaId, lojaRestrita }) => svc.vendasSemNota(db, empresaId, { lojaRestrita })));
  router.get('/documentos', rota('payments.read', ({ req, empresaId, lojaRestrita }) => svc.listarDocumentos(db, empresaId, { lojaId: lojaRestrita || req.query.lojaId || null, status: req.query.status || null, modelo: req.query.modelo || null })));
  router.get('/documentos/:id/danfe', async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, 'payments.read');
      const html = await svc.danfe(db, empresaId, req.params.id, { lojaRestrita });
      res.set('Cache-Control', 'private, no-store');
      // o DANFE é só leitura: sem script, sem recurso externo
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'");
      res.type('text/html; charset=utf-8').send(html);
    } catch (error) { responderErro(res, error); }
  });
  router.get('/documentos/:id', rota('payments.read', ({ req, empresaId, lojaRestrita }) => svc.obterDocumento(db, empresaId, req.params.id, { lojaRestrita, comXml: req.query.xml === '1' })));
  router.get('/documentos/:id/xml', async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, 'payments.read');
      const d = await svc.obterDocumento(db, empresaId, req.params.id, { comXml: true, lojaRestrita });
      const xml = d.xmlAutorizado || d.xmlAssinado;
      if (!xml) throw new ErroDominio('NOT_FOUND', 'Documento sem XML', 404);
      res.set('Cache-Control', 'private, no-store');
      res.type('application/xml').attachment(`${d.modelo === 'nfse' ? 'nfse' : d.modelo === '55' ? 'nfe' : 'nfce'}-${d.serie}-${d.numero}${d.ambiente === 'producao' ? '' : '-homologacao'}.xml`).send(xml);
    } catch (error) { responderErro(res, error); }
  });
  router.post('/documentos', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.emitir(db, empresaId, req.body || {}, { usuario, env, transporte, lojaRestrita }), 201));
  router.post('/documentos/lote', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => lote.emitirEmLote(db, empresaId, req.body || {}, { usuario, env, transporte, lojaRestrita })));
  router.get('/automatica', rota('payments.read', ({ empresaId }) => lote.obterConfigAutomatica(db, empresaId)));
  router.post('/automatica/rodar', rota('payments.write', ({ empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Emitir as pendentes da emissão automática'); return lote.emitirPendentesAgora(db, empresaId, { env, ...(transporte ? { transporte } : {}) }); }));
  router.put('/automatica', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Configurar a emissão automática'); return lote.salvarConfigAutomatica(db, empresaId, req.body || {}); }));
  router.post('/documentos/:id/cancelar', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.cancelar(db, empresaId, req.params.id, { justificativa: req.body?.justificativa, usuario, env, transporte, lojaRestrita })));
  router.post('/documentos/:id/svc', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.emitirEmSvc(db, empresaId, req.params.id, { justificativa: req.body?.justificativa, usuario, env, transporte, lojaRestrita })));
  router.post('/documentos/:id/carta-correcao', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.cartaCorrecao(db, empresaId, req.params.id, { texto: req.body?.texto, usuario, env, transporte, lojaRestrita })));
  router.post('/documentos/:id/contingencia', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.entrarEmContingencia(db, empresaId, req.params.id, { justificativa: req.body?.justificativa, usuario, env, lojaRestrita })));
  router.get('/contingencias', rota('payments.read', ({ empresaId, lojaRestrita }) => svc.listarContingencias(db, empresaId, { lojaRestrita })));
  router.post('/contingencias/transmitir', rota('payments.write', ({ empresaId, lojaRestrita, usuario }) => svc.transmitirContingencias(db, empresaId, { usuario, env, transporte, lojaRestrita })));

  // SPED (EFD ICMS/IPI e EFD-Contribuições) gerado das notas emitidas aqui
  router.get('/sped/config', rota('payments.read', ({ empresaId }) => sped.obterConfigSped(db, empresaId)));
  router.put('/sped/config', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Configurar o SPED'); return sped.salvarConfigSped(db, empresaId, req.body || {}); }));
  router.post('/sped/:tipo', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => {
    empresaToda(lojaRestrita, 'Gerar o SPED');
    const p = { ano: req.body?.ano, mes: req.body?.mes, emitenteId: req.body?.emitenteId || null, ambiente: req.body?.ambiente === 'homologacao' ? 'homologacao' : 'producao' };
    if (req.params.tipo === 'efd-icms-ipi') return sped.arquivoParaDownload(await sped.gerarEfdIcmsIpi(db, empresaId, p));
    if (req.params.tipo === 'efd-contribuicoes') return sped.arquivoParaDownload(await sped.gerarEfdContribuicoes(db, empresaId, p));
    throw new ErroDominio('NOT_FOUND', 'Tipo de SPED desconhecido', 404);
  }));

  router.get('/numeracao', rota('settings.write', ({ empresaId }) => svc.listarNumeracao(db, empresaId)));
  router.put('/numeracao', rota('settings.write', ({ req, empresaId, lojaRestrita, usuario }) => { empresaToda(lojaRestrita, 'Configurar a numeração'); return svc.salvarNumeracao(db, empresaId, req.body || {}, { usuario }); }));
  router.delete('/numeracao', rota('settings.write', ({ req, empresaId, lojaRestrita }) => {
    empresaToda(lojaRestrita, 'Excluir a série');
    const p = { ...(req.body || {}), ...req.query };
    return svc.excluirNumeracao(db, empresaId, { emitenteId: p.emitenteId, modelo: p.modelo, serie: p.serie, ambiente: p.ambiente });
  }));

  router.get('/inutilizacoes', rota('settings.write', ({ empresaId, lojaRestrita }) => svc.listarInutilizacoes(db, empresaId, { lojaRestrita })));
  router.post('/inutilizacoes', rota('settings.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.inutilizarNumeracao(db, empresaId, req.body || {}, { usuario, env, transporte, lojaRestrita }), 201));

  router.get('/ibpt', rota('settings.write', ({ empresaId }) => svc.listarIbpt(db, empresaId)));
  router.post('/ibpt', csvCru, rota('settings.write', ({ req, empresaId, lojaRestrita }) => {
    empresaToda(lojaRestrita, 'Importar a tabela do IBPT');
    const arquivo = Buffer.isBuffer(req.body) ? req.body
      : req.body?.arquivoBase64 ? Buffer.from(String(req.body.arquivoBase64).replace(/^data:[^,]*,/, ''), 'base64') : req.body?.csv;
    return svc.importarIbpt(db, empresaId, { uf: req.query.uf || req.body?.uf || null, arquivo });
  }, 201));
  router.delete('/ibpt/:uf', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Excluir a tabela do IBPT'); return svc.excluirIbpt(db, empresaId, req.params.uf); }));

  router.post('/testar-comunicacao', rota('settings.write', ({ req, empresaId }) => svc.testarComunicacao(db, empresaId, { modelo: req.body?.modelo === '55' ? '55' : '65', env, transporte })));

  return router;
}
