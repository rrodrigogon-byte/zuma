// Rotas do item 2: webhooks das plataformas (sem login; segredo na URL e/ou assinatura),
// painel da academia e página pública do passe de entrada.
import express from 'express';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { responderErro, ErroDominio } from '../acesso/banco.js';
import { ADAPTADORES } from './adaptadores.js';
import * as svc from './servico.js';

const PAGINA_PASSE = readFileSync(new URL('./pagina-passe.html', import.meta.url), 'utf8');
// biblioteca do QR servida pelo próprio Kytto (qrcode-generator 1.4.4, MIT, Kazuhiko Arase): sem CDN numa página com token
const QR_LIB = readFileSync(new URL('./qrcode-generator.vendor.txt', import.meta.url), 'utf8');

function lerJson(buffer) {
  if (buffer && !Buffer.isBuffer(buffer) && typeof buffer === 'object') return buffer; // já interpretado pelo express.json global
  try { return JSON.parse(Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '{}')); } catch { return null; }
}

/** Bytes crus para a assinatura: o corpo cru, ou o rawBody guardado por um express.json({ verify }) global. */
function corpoCru(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody);
  return null; // reserializar o JSON não reproduz os bytes assinados
}

/** Rate limit por passe (o IP pode ser o do balanceador quando não há trust proxy). */
function criarLimitador(max, janelaMs) {
  const mapa = new Map();
  return (chave) => {
    const agora = Date.now();
    const t = (mapa.get(chave) || []).filter((x) => agora - x < janelaMs);
    if (t.length >= max) return false;
    t.push(agora); mapa.set(chave, t);
    if (mapa.size > 20000) mapa.clear();
    return true;
  };
}

/**
 * Webhooks: /api/integracoes/wellhub/webhook[/<segredo>] e /api/integracoes/totalpass/webhook/<segredo>
 * @param {object} deps { db, criarCliente, enviarWhatsapp, urlPublica, qrSecret, reservar, cancelarReservaParceiro, fetch }
 */
export function createParceirosWebhookRouter(deps) {
  const { db } = deps;
  const router = express.Router();
  // corpo cru: a assinatura HMAC do Wellhub é calculada sobre os bytes exatos
  router.use(express.raw({ type: () => true, limit: '64kb' }));

  const processar = async (res, plataforma, conta, corpo) => {
    const evento = ADAPTADORES[plataforma].lerCheckin(corpo);
    if (evento.ignorar) return res.status(202).json({ ok: true, ignorado: evento.motivo });
    if (evento.invalido) return res.status(400).json({ ok: false, error: evento.motivo, code: 'PAYLOAD_INVALIDO' });
    const r = await svc.receberCheckin(db, conta, evento, deps);
    return res.json({ ok: true, duplicado: Boolean(r.duplicado) });
  };

  // Wellhub, URL única do parceiro: autentica pela assinatura e acha a academia pelo Gym ID
  router.post('/wellhub/webhook', async (req, res) => {
    try {
      const cru = corpoCru(req);
      if (!cru) return res.status(500).json({ ok: false, code: 'CORPO_CRU_INDISPONIVEL', error: 'Monte /api/integracoes antes do express.json global ou guarde req.rawBody.' });
      if (!ADAPTADORES.wellhub.assinaturaValida(cru, req.headers)) return res.status(401).json({ ok: false, code: 'ASSINATURA_INVALIDA' });
      const corpo = lerJson(req.body);
      if (!corpo) return res.status(400).json({ ok: false, code: 'JSON_INVALIDO' });
      const evento = ADAPTADORES.wellhub.lerCheckin(corpo);
      if (evento.ignorar) return res.status(202).json({ ok: true, ignorado: evento.motivo });
      if (evento.invalido) return res.status(400).json({ ok: false, error: evento.motivo, code: 'PAYLOAD_INVALIDO' });
      const conta = await svc.contaPorIdExterno(db, 'wellhub', evento.contaExterna);
      if (!conta) return res.status(404).json({ ok: false, code: 'ACADEMIA_NAO_CADASTRADA' });
      return await processar(res, 'wellhub', conta, corpo);
    } catch (error) { responderErro(res, error); }
  });

  // URL por academia (segredo no caminho); no Wellhub, confere também a assinatura se o segredo existir
  for (const plataforma of ['wellhub', 'totalpass']) {
    router.post(`/${plataforma}/webhook/:segredo`, async (req, res) => {
      try {
        let conta = await svc.contaPorSegredo(db, plataforma, req.params.segredo);
        if (!conta) return res.status(401).json({ ok: false, code: 'WEBHOOK_DESCONHECIDO' });
        if (plataforma === 'wellhub' && process.env.WELLHUB_WEBHOOK_SECRET) {
          const cru = corpoCru(req);
          if (!cru) return res.status(500).json({ ok: false, code: 'CORPO_CRU_INDISPONIVEL', error: 'Monte /api/integracoes antes do express.json global ou guarde req.rawBody.' });
          if (!ADAPTADORES.wellhub.assinaturaValida(cru, req.headers)) return res.status(401).json({ ok: false, code: 'ASSINATURA_INVALIDA' });
        }
        const corpo = lerJson(req.body);
        if (!corpo) return res.status(400).json({ ok: false, code: 'JSON_INVALIDO' });
        const ev = ADAPTADORES[plataforma].lerCheckin(corpo);
        // só um evento válido e da própria unidade comprova a posse
        if (!ev.ignorar && !ev.invalido && (!ev.contaExterna || String(ev.contaExterna) === String(conta.id_externo))) {
          conta = await svc.marcarVerificada(db, conta);
        }
        return await processar(res, plataforma, conta, corpo);
      } catch (error) { responderErro(res, error); }
    });

    // Reservas de aula feitas no app da plataforma (Booking API)
    router.post(`/${plataforma}/reservas/:segredo`, async (req, res) => {
      try {
        const conta = await svc.contaPorSegredo(db, plataforma, req.params.segredo);
        if (!conta) return res.status(401).json({ ok: false, code: 'WEBHOOK_DESCONHECIDO' });
        if (plataforma === 'wellhub' && process.env.WELLHUB_WEBHOOK_SECRET && !ADAPTADORES.wellhub.assinaturaValida(corpoCru(req) || Buffer.alloc(0), req.headers)) {
          return res.status(401).json({ ok: false, code: 'ASSINATURA_INVALIDA' });
        }
        const corpo = lerJson(req.body);
        const ev = corpo ? ADAPTADORES[plataforma].lerReserva(corpo) : { invalido: true, motivo: 'JSON inválido' };
        if (ev.invalido) return res.status(400).json({ ok: false, error: ev.motivo, code: 'PAYLOAD_INVALIDO' });
        if (ev.cancelamento) {
          const r = deps.cancelarReservaParceiro ? await deps.cancelarReservaParceiro(conta, ev) : { cancelada: false };
          return res.json({ ok: true, ...r });
        }
        if (!deps.reservar) throw new ErroDominio('RESERVAS_INDISPONIVEIS', 'Agenda de aulas não ligada', 503);
        const r = await svc.reservarPorParceiro(db, conta, ev, { reservar: deps.reservar, criarCliente: deps.criarCliente });
        return res.json({ ok: true, reservaId: r.reservaId });
      } catch (error) { responderErro(res, error); }
    });
  }
  return router;
}

/** Painel: /api/admin/clube/parceiros */
export function createParceirosAdminRouter({ db, empresaDaRequisicao, urlPublica = '', fuso = 'America/Cuiaba', fetch: f }) {
  if (typeof empresaDaRequisicao !== 'function') throw new Error('empresaDaRequisicao é obrigatório');
  const router = express.Router();
  router.use(express.json({ limit: '2mb' })); // relatório de repasse pode ter milhares de linhas
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const rota = (fn) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const r = await fn({ req, res, empresaId });
      if (!res.headersSent) res.json(r);
    } catch (error) {
      if (error?.code === 'PARCEIROS_SEGREDO_AUSENTE') return res.status(503).json({ error: error.message, code: error.code });
      responderErro(res, error);
    }
  };
  router.get('/contas', rota(({ empresaId }) => svc.listarContas(db, empresaId)));
  router.post('/contas', rota(async ({ req, res, empresaId }) => { res.status(201).json(await svc.criarConta(db, empresaId, req.body || {}, { urlPublica })); }));
  router.put('/contas/:id', rota(({ req, empresaId }) => svc.atualizarConta(db, empresaId, req.params.id, req.body || {})));
  router.post('/contas/:id/girar-segredo', rota(({ req, empresaId }) => svc.girarSegredo(db, empresaId, req.params.id, { urlPublica })));
  router.post('/contas/:id/testar', rota(({ req, empresaId }) => svc.testarConta(db, empresaId, req.params.id, { fetch: f })));
  router.get('/valores', rota(({ empresaId }) => svc.listarValores(db, empresaId)));
  router.put('/valores', rota(({ req, empresaId }) => svc.salvarValor(db, empresaId, req.body || {})));
  router.get('/checkins', rota(({ req, empresaId }) => svc.listarCheckins(db, empresaId, {
    status: String(req.query.status || ''), plataforma: String(req.query.plataforma || ''), limite: req.query.limite,
  })));
  router.get('/retroativos', rota(({ empresaId }) => svc.pendenciasRetroativo(db, empresaId, { fuso })));
  router.post('/retroativos/:id', rota(({ req, empresaId }) => svc.resolverRetroativo(db, empresaId, req.params.id, { aprovado: req.body?.aprovado === true })));
  router.post('/repasses', rota(({ req, empresaId }) => svc.importarRepasse(db, empresaId, req.body || {})));
  router.get('/conciliacao', rota(({ req, empresaId }) => svc.conciliacao(db, empresaId, { mes: String(req.query.mes || ''), fuso })));
  return router;
}

/** Página pública do passe (/clube/passe/<token>) e o QR atual (/api/public/clube/passes/<token>/qr). */
export function createPasseRouters({ db, qrSecret }) {
  const pagina = express.Router();
  pagina.get('/_qr.js', (req, res) => {
    res.set({ 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    res.type('application/javascript').send(QR_LIB);
  });
  pagina.get('/:token', (req, res) => {
    res.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    });
    res.type('html').send(PAGINA_PASSE);
  });
  const api = express.Router();
  const porPasse = criarLimitador(12, 60000); // a página consulta a cada ~20 s
  const porIp = criarLimitador(600, 60000);
  api.get('/:token/qr', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const chave = createHash('sha256').update(String(req.params.token)).digest('hex');
    if (!porPasse(chave) || !porIp(req.ip || 'x')) return res.status(429).json({ error: 'Muitas consultas', code: 'RATE_LIMIT' });
    try { res.json(await svc.qrDoPasse(db, req.params.token, { qrSecret })); } catch (error) { responderErro(res, error); }
  });
  return { pagina, api };
}
