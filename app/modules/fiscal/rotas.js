import express from 'express';
import * as svc from './servico.js';
import { ErroDominio, responderErro } from '../acesso/banco.js';

/**
 * /api/admin/fiscal — emitente, certificado A1, classificação, documentos, inutilização,
 * contingência da NFC-e, DANFE e tabela IBPT (SÓ HOMOLOGAÇÃO).
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

  router.get('/certificados', rota('settings.write', ({ empresaId }) => svc.listarCertificados(db, empresaId)));
  router.post('/certificados', rota('settings.write', ({ req, empresaId, lojaRestrita, usuario }) => {
    empresaToda(lojaRestrita, 'Enviar o certificado');
    return svc.importarCertificado(db, empresaId, { arquivoBase64: req.body?.arquivoBase64, senha: req.body?.senha }, { usuario, env });
  }, 201));

  router.get('/classificacoes', rota('catalog.read', ({ empresaId }) => svc.listarClassificaveis(db, empresaId)));
  router.put('/classificacoes', rota('catalog.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita, 'Classificar produtos'); return svc.salvarClassificacao(db, empresaId, req.body || {}); }));

  router.get('/vendas-sem-nota', rota('payments.read', ({ empresaId }) => svc.vendasSemNota(db, empresaId)));
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
      res.type('application/xml').attachment(`${d.modelo === 'nfse' ? 'nfse' : d.modelo === '55' ? 'nfe' : 'nfce'}-${d.serie}-${d.numero}-homologacao.xml`).send(xml);
    } catch (error) { responderErro(res, error); }
  });
  router.post('/documentos', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.emitir(db, empresaId, req.body || {}, { usuario, env, transporte, lojaRestrita }), 201));
  router.post('/documentos/:id/cancelar', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.cancelar(db, empresaId, req.params.id, { justificativa: req.body?.justificativa, usuario, env, transporte, lojaRestrita })));
  router.post('/documentos/:id/contingencia', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.entrarEmContingencia(db, empresaId, req.params.id, { justificativa: req.body?.justificativa, usuario, env, lojaRestrita })));
  router.get('/contingencias', rota('payments.read', ({ empresaId, lojaRestrita }) => svc.listarContingencias(db, empresaId, { lojaRestrita })));
  router.post('/contingencias/transmitir', rota('payments.write', ({ empresaId, lojaRestrita, usuario }) => svc.transmitirContingencias(db, empresaId, { usuario, env, transporte, lojaRestrita })));

  router.get('/inutilizacoes', rota('settings.write', ({ empresaId, lojaRestrita }) => svc.listarInutilizacoes(db, empresaId, { lojaRestrita })));
  router.post('/inutilizacoes', rota('settings.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.inutilizarNumeracao(db, empresaId, req.body || {}, { usuario, env, transporte, lojaRestrita }), 201));

  router.get('/ibpt', rota('settings.write', ({ empresaId }) => svc.listarIbpt(db, empresaId)));
  router.post('/ibpt', csvCru, rota('settings.write', ({ req, empresaId, lojaRestrita }) => {
    empresaToda(lojaRestrita, 'Importar a tabela do IBPT');
    const arquivo = Buffer.isBuffer(req.body) ? req.body
      : req.body?.arquivoBase64 ? Buffer.from(String(req.body.arquivoBase64).replace(/^data:[^,]*,/, ''), 'base64') : req.body?.csv;
    return svc.importarIbpt(db, empresaId, { uf: req.query.uf || req.body?.uf || null, arquivo });
  }, 201));

  router.post('/testar-comunicacao', rota('settings.write', ({ req, empresaId }) => svc.testarComunicacao(db, empresaId, { modelo: req.body?.modelo === '55' ? '55' : '65', env, transporte })));

  return router;
}
