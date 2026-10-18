// Rotas do painel de retenção (item 4.4). Montar sob a trava do admin, ex.: /api/admin/clube/retencao
import express from 'express';
import { responderErro, ErroDominio, exigirUuid } from '../acesso/banco.js';
import * as svc from './servico.js';
import * as ops from './operacoes.js';
import * as painel from './painel.js';

const mesAtual = (fuso) => svc.hojeNoFuso(new Date(), fuso).slice(0, 7);

/**
 * @param {object} o
 * @param {object} o.db
 * @param {Function} o.empresaDaRequisicao
 * @param {Function} [o.operadorDaRequisicao]
 * @param {Function} [o.enviarWhatsapp]
 * @param {Function} [o.gerarLinkPagamento]
 * @param {object}   [o.extras] ganchos de outros itens (ex.: checkinsParceiroMes do item 2)
 */
export function createRetencaoAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao = null, enviarWhatsapp = null, gerarLinkPagamento = null, extras = {} }) {
  if (typeof empresaDaRequisicao !== 'function') throw new Error('empresaDaRequisicao é obrigatório');
  const router = express.Router();
  router.use(express.json({ limit: '128kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const rota = (fn) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const operador = operadorDaRequisicao ? operadorDaRequisicao(req) : null;
      const r = await fn({ req, res, empresaId, operador });
      if (!res.headersSent) res.json(r);
    } catch (error) { responderErro(res, error); }
  };
  const mesDe = async (req, empresaId) => req.query.mes || mesAtual((await svc.obterConfig(db, empresaId)).fuso);
  // rotas com :customerId: o aluno precisa ser desta empresa
  router.param('customerId', async (req, res, next, id) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const r = await db.query('SELECT 1 FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresaId, exigirUuid(id, 'cliente')]);
      if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Aluno não encontrado', 404);
      next();
    } catch (error) { responderErro(res, error); }
  });

  router.get('/config', rota(({ empresaId }) => svc.obterConfig(db, empresaId)));
  router.put('/config', rota(({ req, empresaId }) => svc.salvarConfig(db, empresaId, req.body || {})));
  router.get('/reguas', rota(({ empresaId }) => svc.listarReguas(db, empresaId)));
  router.put('/reguas/:gatilho', rota(({ req, empresaId }) => svc.salvarRegua(db, empresaId, req.params.gatilho, req.body || {})));

  // prévia: quem receberia agora e com qual texto (não envia nada, ignora o horário)
  router.get('/previa', rota(async ({ empresaId }) => {
    const r = await svc.executarRegua(db, empresaId, { simular: true, extras });
    return { candidatos: r.candidatos, bloqueados: r.bloqueados, mensagens: r.previa.slice(0, 200) };
  }));

  router.get('/painel', rota(async ({ req, empresaId }) => painel.resumoPainel(db, empresaId, { mes: await mesDe(req, empresaId) })));
  router.get('/risco', rota(({ req, empresaId }) => {
    const minimo = Number.parseInt(req.query.minimo ?? '30', 10);
    return painel.alunosEmRisco(db, empresaId, { limite: req.query.limite, minimo: Number.isInteger(minimo) && minimo >= 0 && minimo <= 100 ? minimo : 30 });
  }));
  router.post('/risco/recalcular', rota(({ empresaId }) => svc.calcularScores(db, empresaId, { forcar: true, extras })));
  router.get('/funil', rota(async ({ req, empresaId }) => painel.funil(db, empresaId, { mes: await mesDe(req, empresaId) })));
  router.get('/motivos', rota(async ({ req, empresaId }) => painel.motivosDeSaida(db, empresaId, { mes: await mesDe(req, empresaId) })));
  router.get('/churn', rota(async ({ req, empresaId }) => painel.churn(db, empresaId, { mes: await mesDe(req, empresaId) })));
  router.get('/disparos', rota(({ req, empresaId }) => painel.disparosRecentes(db, empresaId, { limite: req.query.limite, customerId: req.query.customerId || null })));

  router.get('/ocorrencias', rota(({ req, empresaId }) => ops.listarOcorrencias(db, empresaId, { status: req.query.status || 'abertas' })));
  router.put('/ocorrencias/:id', rota(({ req, empresaId, operador }) => ops.atualizarOcorrencia(db, empresaId, req.params.id, {
    status: req.body?.status, solucao: req.body?.solucao, responsavel: req.body?.responsavel || operador,
  })));

  // ações da recepção no perfil do aluno
  router.get('/alunos/:customerId/financeiro', rota(({ req, empresaId }) => ops.consultarFinanceiro(db, empresaId, req.params.customerId)));
  router.get('/alunos/:customerId/frequencia', rota(({ req, empresaId }) => ops.consultarFrequencia(db, empresaId, req.params.customerId)));
  router.get('/alunos/:customerId/perfil', rota(({ req, empresaId }) => ops.obterPerfil(db, empresaId, req.params.customerId)));
  router.put('/alunos/:customerId/perfil', rota(({ req, empresaId }) => ops.salvarPerfil(db, empresaId, req.params.customerId, req.body || {})));
  router.post('/alunos/:customerId/descongelar', rota(({ req, empresaId }) => ops.encerrarCongelamentoDoAluno(db, empresaId, req.params.customerId)));
  router.post('/alunos/:customerId/congelar', rota(({ req, empresaId }) => ops.congelarPlano(db, empresaId, req.params.customerId, req.body || {}, { origem: 'recepcao' })));
  router.post('/congelamentos/:id/encerrar', rota(({ req, empresaId }) => ops.encerrarCongelamento(db, empresaId, req.params.id)));
  router.post('/alunos/:customerId/motivo', rota(({ req, empresaId }) => ops.registrarMotivoSaida(db, empresaId, req.params.customerId, req.body || {})));
  router.post('/alunos/:customerId/optout', rota(({ req, empresaId }) => (req.body?.optout === false
    ? svc.removerOptout(db, empresaId, req.params.customerId)
    : svc.registrarOptout(db, { empresaId, customerId: req.params.customerId, texto: 'registrado pela recepção' }))));
  // autorização de marketing registrada pela recepção (o aluno disse que aceita), com evidência
  router.post('/alunos/:customerId/consentimento', rota(({ req, empresaId, operador }) => svc.registrarConsentimentoMarketing(db, {
    empresaId, customerId: req.params.customerId, concedido: req.body?.concedido === true, origem: 'recepcao', operador, detalhe: req.body?.detalhe,
  })));
  router.get('/alunos/:customerId/contato', rota(async ({ req, empresaId }) => {
    const r = await db.query(
      'SELECT optout_em, marketing_consentido_em, marketing_evidencia FROM clube_retencao_contatos WHERE empresa_id = $1 AND customer_id = $2',
      [empresaId, req.params.customerId],
    );
    const x = r.rows[0] || {};
    return { optoutEm: x.optout_em || null, marketingConsentidoEm: x.marketing_consentido_em || null, evidencia: x.marketing_evidencia || null };
  }));
  router.post('/alunos/:customerId/interesse', rota(({ req, empresaId }) => ops.registrarInteresse(db, empresaId, req.params.customerId, req.body || {})));
  router.post('/alunos/:customerId/link-pagamento', rota(async ({ req, empresaId }) => {
    const r = await ops.gerarLink(db, empresaId, req.params.customerId, { gerarLinkPagamento, parcelas: Number(req.body?.parcelas) || 1 });
    if (req.body?.enviar) {
      if (!enviarWhatsapp) throw new ErroDominio('WHATSAPP_INDISPONIVEL', 'WhatsApp não configurado', 503);
      const c = await db.query('SELECT nome, telefone FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresaId, req.params.customerId]);
      if (!c.rows[0]?.telefone) throw new ErroDominio('TELEFONE_OBRIGATORIO', 'Aluno sem telefone', 409);
      await enviarWhatsapp({
        empresaId, customerId: req.params.customerId, telefone: c.rows[0].telefone,
        texto: `${ops.primeiroNome(c.rows[0].nome)}, segue o link para pagamento de ${r.valorFormatado}: ${r.link}`,
      });
      r.enviado = true;
    }
    return r;
  }));
  return router;
}
