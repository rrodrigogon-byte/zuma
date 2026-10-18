// Rotas da cobrança do Clube: painel (/api/admin/clube/cobrancas), página pública de pagamento
// (/clube/pagar/<token>) e os dados dela (/api/public/clube/pagamentos/<token>).
import express from 'express';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { responderErro } from '../acesso/banco.js';
import * as svc from './servico.js';

const PAGINA = readFileSync(new URL('./pagina-pagar.html', import.meta.url), 'utf8');
const QR_LIB = readFileSync(new URL('../parceiros/qrcode-generator.vendor.txt', import.meta.url), 'utf8');

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

export function createCobrancasAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao, registrarPagamento, urlPublica = '' }) {
  if (typeof empresaDaRequisicao !== 'function') throw new Error('empresaDaRequisicao é obrigatório');
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const operador = (req) => (operadorDaRequisicao ? operadorDaRequisicao(req) : 'equipe');
  const rota = (fn) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const r = await fn({ req, res, empresaId });
      if (!res.headersSent) res.json(r);
    } catch (error) { responderErro(res, error); }
  };
  router.get('/config', rota(({ empresaId }) => svc.obterConfig(db, empresaId)));
  router.put('/config', rota(({ req, empresaId }) => svc.salvarConfig(db, empresaId, req.body || {})));
  router.get('/', rota(({ req, empresaId }) => svc.listarCobrancas(db, empresaId, { status: String(req.query.status || ''), limite: req.query.limite })));
  router.post('/', rota(async ({ req, res, empresaId }) => {
    const b = req.body || {};
    res.status(201).json(await svc.criarCobranca(db, {
      empresaId, customerId: b.customerId, valor: b.valor, parcelas: b.parcelas ?? 1, descricao: b.descricao || 'Mensalidade', origem: 'recepcao',
      tipo: b.tipo === 'avulsa' ? 'avulsa' : null,
    }, { urlPublica }));
  }));
  router.post('/:id/confirmar', rota(({ req, empresaId }) => svc.confirmarCobranca(db, empresaId, req.params.id, { operador: operador(req), registrarPagamento })));
  router.post('/:id/cancelar', rota(({ req, empresaId }) => svc.cancelarCobranca(db, empresaId, req.params.id, { operador: operador(req) })));
  return router;
}

export function createPagamentoPublicoRouters({ db }) {
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
    res.type('html').send(PAGINA);
  });
  const api = express.Router();
  const porToken = criarLimitador(30, 60000);
  const porIp = criarLimitador(300, 60000);
  api.get('/:token', async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    const chave = createHash('sha256').update(String(req.params.token)).digest('hex');
    if (!porToken(chave) || !porIp(req.ip || 'x')) return res.status(429).json({ error: 'Muitas consultas', code: 'RATE_LIMIT' });
    try { res.json(await svc.cobrancaPorToken(db, req.params.token)); } catch (error) { responderErro(res, error); }
  });
  return { pagina, api };
}
