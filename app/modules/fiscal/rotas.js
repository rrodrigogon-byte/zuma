import express from 'express';
import * as svc from './servico.js';
import { ErroDominio, responderErro } from '../acesso/banco.js';

/**
 * /api/admin/fiscal — emitente, certificado A1, classificação, documentos (SÓ HOMOLOGAÇÃO).
 * `escopoDaRequisicao(req, permissao)` → { empresaId, lojaRestrita } (ver server.js).
 */
export function createFiscalAdminRouter({ db, escopoDaRequisicao, env = process.env, transporte = null }) {
  if (!db || typeof escopoDaRequisicao !== 'function') throw new Error('createFiscalAdminRouter: db e escopoDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '512kb' })); // .pfx em base64
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
  router.post('/testar-comunicacao', rota('settings.write', ({ req, empresaId }) => svc.testarComunicacao(db, empresaId, { modelo: req.body?.modelo === '55' ? '55' : '65', env, transporte })));

  return router;
}
