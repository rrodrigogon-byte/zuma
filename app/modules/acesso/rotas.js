// Rotas HTTP do controle de acesso (item 1).
//
// 1) createControlIdRouter — chamado pelo APARELHO. Montar em /api/acesso/controlid
//    URL configurada na Control iD (servidor online e Push): https://<host>/api/acesso/controlid/<segredo>
// 2) createAcessoAdminRouter — chamado pelo PAINEL. Montar sob a trava /api/admin (já autenticada),
//    ex.: /api/admin/clube/acesso. A resolução da empresa ativa e do operador vem injetada do server.js,
//    reaproveitando a mesma regra de tenant do Commerce (membership; header nunca troca tenant).
import express from 'express';
import { randomUUID } from 'node:crypto';
import * as repo from './repositorio.js';
import {
  tratarIdentificacao, respostaNegada, montarRespostaPush, lerResultadoPush, EVENTO,
} from './controlid.js';
import { gerarQrDinamico, validarQrDinamico } from './qr.js';
import { responderErro, ErroDominio, exigirUuid } from './banco.js';

/* ------------------------------------------------------------------ */
/* Aparelho                                                            */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o
 * @param {object} o.db                 API do db-pg.js
 * @param {object} [o.extras]           ganchos { contrato, reservas } dos itens 3 e 5
 * @param {Function} [o.dispararAcao]   ({ acao, codigo, customerId, empresaId }) => Promise — WhatsApp/painel
 * @param {string} [o.qrSecret]         segredo do QR dinâmico (CLUBE_QR_SECRET)
 * @param {Function} [o.agora]
 */
export function createControlIdRouter({ db, extras = {}, dispararAcao, qrSecret = process.env.CLUBE_QR_SECRET, agora = () => new Date() }) {
  const router = express.Router({ mergeParams: true });
  router.use(express.urlencoded({ extended: false, limit: '64kb' }));
  router.use(express.json({ limit: '2mb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const depsPara = (dispositivo) => ({
    agora,
    buscarDispositivo: async () => dispositivo,
    decisaoAnterior: (uuid) => repo.decisaoAnterior(db, dispositivo.id, uuid),
    carregarContexto: ({ userIdEquipamento }) => repo.carregarContexto(
      db,
      { empresaId: dispositivo.empresaId, userIdEquipamento, agora: agora(), fuso: dispositivo.fuso },
      extras,
    ),
    registrarEvento: (e) => repo.registrarEvento(db, {
      empresaId: e.empresaId,
      dispositivoId: e.dispositivoId,
      customerId: e.pessoaId,
      decisao: e.decisao,
      codigo: e.codigo,
      mensagem: e.mensagem,
      origem: e.origem,
      uuid: e.uuid,
      em: e.em,
    }),
    dispararAcao: dispararAcao
      ? (a) => dispararAcao({ acao: a.acao, codigo: a.codigo, customerId: a.pessoaId, empresaId: a.empresaId })
      : undefined,
  });

  async function autenticar(req) {
    const deviceId = req.body?.device_id ?? req.query?.deviceId ?? req.query?.device_id;
    return repo.autenticarDispositivo(db, req.params.segredo, deviceId);
  }

  // Modo Pro: o aparelho reconheceu a pessoa localmente e pergunta se pode entrar.
  router.post('/:segredo/new_user_identified.fcgi', async (req, res) => {
    try {
      const dispositivo = await autenticar(req);
      if (!dispositivo) return res.json(respostaNegada({ mensagem: 'Equipamento não autorizado', evento: EVENTO.EQUIPAMENTO_INVALIDO }));
      return res.json(await tratarIdentificacao(req.body, depsPara(dispositivo)));
    } catch (error) {
      console.error('[acesso] identificacao', error);
      // Falha do servidor: resposta negada explícita (o aparelho entra em contingência após falhas seguidas).
      return res.status(500).json(respostaNegada({ mensagem: 'Tente novamente' }));
    }
  });

  // QR dinâmico do app/WhatsApp (modo Enterprise para QR).
  router.post('/:segredo/new_qrcode.fcgi', async (req, res) => {
    try {
      const dispositivo = await autenticar(req);
      if (!dispositivo) return res.json(respostaNegada({ mensagem: 'Equipamento não autorizado', evento: EVENTO.EQUIPAMENTO_INVALIDO }));
      const userId = validarQrDinamico(qrSecret, req.body?.qrcode_value, agora().getTime());
      if (!userId) {
        return res.json(respostaNegada({ portalId: Number(req.body?.portal_id) || 1, mensagem: 'QR inválido ou expirado', evento: EVENTO.NAO_IDENTIFICADO }));
      }
      return res.json(await tratarIdentificacao({ ...req.body, user_id: String(userId), event: '7' }, depsPara(dispositivo)));
    } catch (error) {
      console.error('[acesso] qrcode', error);
      return res.status(500).json(respostaNegada({ mensagem: 'Tente novamente' }));
    }
  });

  // Aparelho saindo da contingência.
  router.post('/:segredo/device_is_alive.fcgi', async (req, res) => {
    try {
      const dispositivo = await autenticar(req);
      if (!dispositivo) return res.status(401).end();
      await repo.marcarStatusDispositivo(db, dispositivo.id, 'online');
      return res.status(200).end();
    } catch (error) {
      console.error('[acesso] alive', error);
      return res.status(503).end();
    }
  });

  // Push: o aparelho busca comandos.
  router.get('/:segredo/push', async (req, res) => {
    try {
      const dispositivo = await autenticar(req);
      if (!dispositivo) return res.status(401).end();
      const uuid = String(req.query.uuid || randomUUID()).slice(0, 80);
      const comandos = await repo.reservarComandos(db, dispositivo.id, uuid);
      const corpo = montarRespostaPush(comandos.map((c) => c.comando));
      return corpo ? res.json(corpo) : res.status(200).end();
    } catch (error) {
      console.error('[acesso] push', error);
      return res.status(200).end(); // vazio: o aparelho tenta de novo no próximo ciclo
    }
  });

  // Push: resultado dos comandos.
  router.post('/:segredo/result', async (req, res) => {
    try {
      const dispositivo = await autenticar(req);
      if (!dispositivo) return res.status(401).end();
      const uuid = String(req.query.uuid || req.body?.uuid || '').slice(0, 80);
      if (uuid) await repo.concluirComandos(db, dispositivo.id, uuid, lerResultadoPush(req.body || {}));
      return res.status(200).end();
    } catch (error) {
      console.error('[acesso] result', error);
      return res.status(200).end();
    }
  });

  return router;
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o
 * @param {object} o.db
 * @param {Function} o.empresaDaRequisicao  (req) => Promise<empresaId>; lança ErroDominio 403 sem permissão
 * @param {Function} o.operadorDaRequisicao (req) => string (id do usuário logado)
 * @param {string}  [o.urlPublica]          base pública (ex.: https://dino.kytto.com.br)
 * @param {string}  [o.qrSecret]
 * @param {Function} [o.aoPagamento]  ({ empresaId, customerId, matriculaId, valor }) => Promise — régua de retenção (item 4)
 * @param {Function} [o.aoMatricular] ({ empresaId, customerId }) => Promise — fecha o interessado em aberto
 */
export function createAcessoAdminRouter({
  db, empresaDaRequisicao, operadorDaRequisicao, urlPublica = process.env.PUBLIC_BASE_URL || '', qrSecret = process.env.CLUBE_QR_SECRET,
  aoPagamento = null, aoMatricular = null,
}) {
  if (typeof empresaDaRequisicao !== 'function') throw new Error('empresaDaRequisicao é obrigatório');
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const rota = (fn) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const operador = operadorDaRequisicao ? operadorDaRequisicao(req) : null;
      const r = await fn({ req, res, empresaId, operador });
      if (!res.headersSent) res.json(r);
    } catch (error) {
      responderErro(res, error);
    }
  };

  const configuracaoAparelho = (segredo) => {
    const base = `${String(urlPublica).replace(/\/$/, '')}/api/acesso/controlid/${segredo}`;
    return {
      servidorOnline: base,
      servidorPush: base,
      modo: 'Pro (identificação no aparelho, autorização no servidor)',
      aviso: 'Copie agora: o segredo não é exibido de novo. Se perder, gere outro aparelho.',
    };
  };

  // Dispositivos
  router.get('/dispositivos', rota(({ empresaId }) => repo.listarDispositivos(db, empresaId)));
  router.post('/dispositivos', rota(async ({ req, res, empresaId }) => {
    const { dispositivo, segredo } = await repo.criarDispositivo(db, empresaId, req.body || {});
    res.status(201).json({ dispositivo, configuracao: configuracaoAparelho(segredo) });
  }));
  router.patch('/dispositivos/:id', rota(({ req, empresaId }) => repo.atualizarDispositivo(db, empresaId, req.params.id, req.body || {})));
  router.post('/dispositivos/:id/sincronizar', rota(async ({ req, empresaId }) => ({
    enfileirados: await repo.sincronizarDispositivoCompleto(db, empresaId, req.params.id),
  })));
  router.get('/dispositivos/:id/fila', rota(({ req, empresaId }) => repo.resumoFila(db, empresaId, req.params.id)));
  router.post('/dispositivos/:id/liberar', rota(({ req, empresaId, operador }) => repo.liberarManual(db, empresaId, req.params.id, {
    customerId: req.body?.customerId || null,
    operadorId: operador,
    motivo: req.body?.motivo,
  })));

  // Planos
  router.get('/planos', rota(({ empresaId }) => repo.listarPlanos(db, empresaId)));
  router.post('/planos', rota(async ({ req, res, empresaId }) => {
    res.status(201).json(await repo.salvarPlano(db, empresaId, req.body || {}));
  }));
  router.put('/planos/:id', rota(({ req, empresaId }) => repo.salvarPlano(db, empresaId, req.body || {}, req.params.id)));

  // Matrículas
  router.get('/matriculas', rota(({ req, empresaId }) => repo.listarMatriculas(db, empresaId, {
    busca: req.query.busca, status: req.query.status || 'ativa',
  })));
  const gancho = async (fn, dados) => {
    if (!fn) return;
    try { await fn(dados); } catch (error) { console.error('[clube] gancho', String(error?.message || '').slice(0, 200)); }
  };
  router.post('/matriculas', rota(async ({ req, res, empresaId }) => {
    const m = await repo.criarMatricula(db, empresaId, req.body || {});
    await gancho(aoMatricular, { empresaId, customerId: m.customerId });
    res.status(201).json(m);
  }));
  router.post('/matriculas/:id/pagamento', rota(async ({ req, empresaId }) => {
    const valor = req.body?.valor === undefined || req.body?.valor === '' ? null : Number(String(req.body.valor).replace(',', '.'));
    if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor > 100000)) throw new ErroDominio('VALIDATION_ERROR', 'valor inválido');
    const m = await repo.registrarPagamento(db, empresaId, req.params.id, req.body?.pagoAte);
    await gancho(aoPagamento, { empresaId, customerId: m.customerId, matriculaId: m.id, valor });
    return m;
  }));
  router.post('/matriculas/:id/bloqueio', rota(({ req, empresaId }) => repo.definirBloqueio(db, empresaId, req.params.id, req.body?.bloqueada !== false, req.body?.motivo)));
  router.post('/matriculas/:id/status', rota(({ req, empresaId }) => repo.alterarStatusMatricula(db, empresaId, req.params.id, req.body?.status)));

  // Clientes (busca para matricular) — reaproveita commerce_customers
  router.get('/clientes', rota(async ({ req, empresaId }) => {
    const termo = String(req.query.busca || '').trim().slice(0, 80);
    if (termo.length < 2) return [];
    const r = await db.query(
      `SELECT id, nome, telefone FROM commerce_customers
        WHERE empresa_id = $1 AND (nome ILIKE '%' || $2 || '%' OR telefone ILIKE '%' || $2 || '%')
        ORDER BY nome LIMIT 20`,
      [empresaId, termo.replace(/[\\%_]/g, '\\$&')],
    );
    return r.rows;
  }));

  // Recepção ao vivo
  router.get('/eventos', rota(({ req, empresaId }) => repo.listarEventos(db, empresaId, { desde: req.query.desde, limite: req.query.limite })));
  router.get('/pessoas/:customerId/frequencia', rota(({ req, empresaId }) => repo.frequenciaSemanal(db, empresaId, req.params.customerId)));

  // QR dinâmico para mostrar no app/WhatsApp do aluno
  router.get('/pessoas/:customerId/qr', rota(async ({ req, empresaId }) => {
    const customerId = exigirUuid(req.params.customerId, 'cliente');
    const r = await db.query(
      'SELECT user_id_equipamento FROM acesso_pessoas_equipamento WHERE empresa_id = $1 AND customer_id = $2',
      [empresaId, customerId],
    );
    if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Pessoa sem matrícula de acesso', 404);
    if (!qrSecret) throw new ErroDominio('QR_DESATIVADO', 'QR dinâmico não configurado (CLUBE_QR_SECRET)', 503);
    return gerarQrDinamico(qrSecret, Number(r.rows[0].user_id_equipamento));
  }));

  return router;
}
