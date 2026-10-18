// Rotas do contrato digital (item 3).
// createContratosAdminRouter  → montar sob a trava /api/admin, ex.: /api/admin/clube/contratos
// createContratosPublicRouter → montar em /api/public/contratos (página de aceite e verificação)
import express from 'express';
import { readFileSync } from 'node:fs';
import * as svc from './servico.js';
import { responderErro, ErroDominio } from '../acesso/banco.js';

/**
 * Limitador simples em memória (o serviço setpoint roda com 1 instância; com mais de uma,
 * trocar por armazenamento compartilhado). `chave(req)` define o escopo: IP, token do link etc.
 */
export function limitador({ janelaMs = 60000, max = 20, chave = (req) => req.ip } = {}) {
  const contagem = new Map();
  return (req, res, next) => {
    const agora = Date.now();
    const k = `${chave(req)}|${req.baseUrl}${req.route?.path || req.path}`;
    const atual = contagem.get(k);
    if (!atual || agora - atual.inicio > janelaMs) contagem.set(k, { inicio: agora, n: 1 });
    else if (++atual.n > max) return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.', code: 'RATE_LIMIT' });
    if (contagem.size > 5000) for (const [kk, v] of contagem) if (agora - v.inicio > janelaMs) contagem.delete(kk);
    return next();
  };
}

/** Envio que falha alto: o chamador nunca responde "enviado" se a mensagem não saiu. */
async function enviarOuFalhar(enviarWhatsapp, mensagem) {
  if (!enviarWhatsapp) throw new ErroDominio('WHATSAPP_INDISPONIVEL', 'Envio pelo WhatsApp indisponível', 503);
  const r = await enviarWhatsapp(mensagem);
  if (r && r.ok === false) throw new ErroDominio('WHATSAPP_FALHOU', 'Não foi possível enviar pelo WhatsApp agora. Tente de novo em instantes.', 502);
}

/**
 * @param {object} o
 * @param {object} o.db
 * @param {Function} o.empresaDaRequisicao
 * @param {Function} [o.operadorDaRequisicao]
 * @param {Function} o.enviarWhatsapp  ({ empresaId, customerId, telefone, texto }) => Promise
 * @param {string}  o.urlPublica       ex.: https://dino.kytto.com.br
 */
export function createContratosAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao, enviarWhatsapp, urlPublica = process.env.PUBLIC_BASE_URL || '' }) {
  if (typeof empresaDaRequisicao !== 'function') throw new Error('empresaDaRequisicao é obrigatório');
  const router = express.Router();
  router.use(express.json({ limit: '512kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const base = String(urlPublica).replace(/\/$/, '');
  const rota = (fn) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const r = await fn({ req, res, empresaId, operador: operadorDaRequisicao ? operadorDaRequisicao(req) : null });
      if (!res.headersSent) res.json(r);
    } catch (error) { responderErro(res, error); }
  };

  router.get('/modelos', rota(({ empresaId }) => svc.listarModelos(db, empresaId)));
  router.post('/modelos', rota(async ({ req, res, empresaId, operador }) => {
    res.status(201).json(await svc.salvarModelo(db, empresaId, req.body || {}, operador));
  }));
  router.post('/modelos/previa', rota(({ req }) => ({
    texto: svc.renderizar(String(req.body?.corpo || ''), req.body?.variaveis || {}),
  })));

  router.get('/', rota(({ req, empresaId }) => svc.listarContratos(db, empresaId, { status: req.query.status || '', customerId: req.query.customerId || null })));

  // Gera e envia pelo WhatsApp. O link só existe nesta resposta (o banco guarda o hash do token).
  router.post('/', rota(async ({ req, res, empresaId }) => {
    const gerado = await svc.gerarContrato(db, empresaId, req.body || {});
    const link = `${base}/contrato/${gerado.token}`;
    let enviado = false;
    if (req.body?.enviar !== false) {
      await enviarOuFalhar(enviarWhatsapp, {
        empresaId,
        customerId: gerado.signatario.customerId,
        telefone: gerado.signatario.telefone,
        texto: svc.mensagemDeEnvio({ nome: gerado.signatario.nome, titulo: gerado.titulo, link, destaques: gerado.destaques }),
      });
      enviado = true;
    }
    res.status(201).json({ contratoId: gerado.contratoId, link, enviadoWhatsapp: enviado, prazoAceiteEm: gerado.prazoAceiteEm, hashConteudo: gerado.hashConteudo });
  }));

  // Reenvio manual pela recepção (gera link novo mesmo se o anterior for recente).
  router.post('/:id/reenviar', rota(async ({ req, empresaId }) => {
    const novo = await svc.novoLinkDeAceite(db, empresaId, { contratoId: req.params.id, forcar: true });
    const link = `${base}/contrato/${novo.token}`;
    await enviarOuFalhar(enviarWhatsapp, {
      empresaId, customerId: novo.signatario.customerId, telefone: novo.signatario.telefone,
      texto: svc.mensagemDeEnvio({ nome: novo.signatario.nome, titulo: novo.titulo, link, destaques: novo.destaques }),
    });
    return { reenviado: true };
  }));

  router.post('/:id/cancelar', rota(({ req, empresaId, operador }) => svc.cancelarContrato(db, empresaId, req.params.id, req.body?.motivo, operador)));
  router.get('/:id/evidencias', rota(({ req, empresaId }) => svc.evidenciasDoContrato(db, empresaId, req.params.id)));
  router.get('/:id/comprovante', async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const ev = await svc.evidenciasDoContrato(db, empresaId, req.params.id);
      res.type('html').send(svc.comprovanteHtml(ev, { urlVerificacao: `${base}/contrato/verificar` }));
    } catch (error) { responderErro(res, error); }
  });

  return router;
}

/**
 * @param {object} o
 * @param {object} o.db
 * @param {Function} o.enviarWhatsapp
 * @param {Function} [o.aoAceitar]  ({ empresaId, customerId, matriculaId, contratoId }) => Promise — ex.: liberar catraca
 */
export function createContratosPublicRouter({ db, enviarWhatsapp, aoAceitar }) {
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex'); next(); });
  const porToken = (req) => `t:${String(req.params.token || '').slice(0, 64)}`;
  const leve = limitador({ max: 30 });
  const sensivelIp = limitador({ max: 6 });
  const sensivelToken = limitador({ max: 6, chave: porToken });
  const meta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') || null });

  router.get('/verificar/:hash', leve, async (req, res) => {
    try { res.json(await svc.verificarPorHash(db, req.params.hash)); } catch (error) { responderErro(res, error); }
  });

  router.get('/:token', leve, async (req, res) => {
    try { res.json(await svc.abrirContrato(db, req.params.token, meta(req))); } catch (error) { responderErro(res, error); }
  });

  router.post('/:token/codigo', sensivelIp, sensivelToken, async (req, res) => {
    try {
      const r = await svc.solicitarCodigo(db, req.params.token, meta(req));
      await enviarOuFalhar(enviarWhatsapp, { empresaId: r.empresaId, customerId: r.signatarioCustomerId, telefone: r.telefone, texto: r.mensagem });
      res.json({ enviado: true }); // o código nunca volta na resposta HTTP
    } catch (error) { responderErro(res, error); }
  });

  router.post('/:token/aceite', sensivelIp, sensivelToken, async (req, res) => {
    try {
      const geo = req.body?.geo && Number.isFinite(Number(req.body.geo.lat)) && Number.isFinite(Number(req.body.geo.lng))
        ? { lat: Number(req.body.geo.lat), lng: Number(req.body.geo.lng), precisao: Number(req.body.geo.precisao) || null, fonte: 'navegador' }
        : null;
      const r = await svc.aceitarContrato(db, req.params.token, {
        codigo: req.body?.codigo,
        clausulasMarcadas: req.body?.clausulasMarcadas,
        geo,
        ...meta(req),
      });
      // Âncora fora do sistema: o signatário guarda no WhatsApp dele o código do comprovante.
      if (enviarWhatsapp) {
        Promise.resolve(enviarWhatsapp({
          empresaId: r.empresaId, customerId: r.signatarioCustomerId, telefone: r.signatarioTelefone,
          texto: `Contrato aceito em ${new Date(r.aceitoEm).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}. Código de verificação do seu comprovante: ${r.hashEvidencias}`,
        })).catch(() => {});
      }
      // autorização de novidades no WhatsApp: opcional, separada do contrato (LGPD art. 8º §4º)
      const aceitaMarketing = req.body?.aceitaMarketing === true;
      if (aoAceitar) await Promise.resolve(aoAceitar({ ...r, aceitaMarketing })).catch((e) => console.error('[contratos] aoAceitar', e?.message));
      res.json({ aceito: true, aceitoEm: r.aceitoEm, hashEvidencias: r.hashEvidencias });
    } catch (error) { responderErro(res, error); }
  });

  return router;
}

/** Página do aluno: montar em /contrato (antes do fallback do SPA). */
export function createPaginaContratoRouter() {
  const router = express.Router();
  const html = readFileSync(new URL('./pagina-aceite.html', import.meta.url), 'utf8');
  router.get('/:token', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.set('Referrer-Policy', 'no-referrer'); // o token do link não vaza para terceiros
    res.type('html').send(html);
  });
  return router;
}
