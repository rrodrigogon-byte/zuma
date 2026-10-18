// Kytto Clube & Academia — ponto único de integração no server.js do agro-open.
//
//   import { montarClube } from './modules/clube/index.js';
//   montarClube(app, {
//     db: clubeDb,                                // adaptador sobre core/database.js (ver server.js; não use db-pg.js)
//     empresaDaRequisicao: async (req) => ...,    // mesma regra de tenant do Commerce (membership)
//     operadorDaRequisicao: (req) => String(req.user?.id),
//     enviarWhatsapp: async ({ empresaId, customerId, telefone, texto }) => ...,  // canal da empresa
//     urlPublica: process.env.PUBLIC_BASE_URL,
//   });
//
// Rotas criadas:
//   /api/acesso/controlid/<segredo>/...   aparelho Control iD (sem login; segredo por aparelho)
//   /api/admin/clube/acesso/...           painel: aparelhos, planos, matrículas, ao vivo
//   /api/admin/clube/contratos/...        painel: modelos e contratos
//   /api/admin/clube/aulas/...            painel: modalidades, turmas, grade, reservas
//   /api/admin/clube/retencao/...         painel: régua de retenção, risco, funil, ocorrências
//   /api/admin/clube/parceiros/...        painel: Wellhub/TotalPass, check-ins, retroativos, conciliação
//   /api/integracoes/<plataforma>/...     webhooks do Wellhub e do TotalPass (sem login; segredo/assinatura)
//   /api/admin/clube/cobrancas/...        painel: Pix da academia, cobranças e baixa
//   /api/admin/clube/adesao               recepção: cadastro + matrícula + contrato + Pix em um passo
//   /api/admin/clube/quadras/...          quadras, horário de funcionamento, grade do dia e reservas
//   /clube/pagar/<token>                  página pública do Pix (QR e copia e cola)
//   /clube/passe/<token>                  passe de entrada com QR que muda a cada 30 s
//   /clube/painel                         painel da recepção e do dono (usa a sessão do Kytto)
//   /api/public/contratos/...             aceite do aluno e verificação pública
//   /contrato/<token>                     página de aceite
import { createControlIdRouter, createAcessoAdminRouter } from '../acesso/rotas.js';
import * as acessoRepo from '../acesso/repositorio.js';
import { ACOES } from '../acesso/regras.js';
import { createContratosAdminRouter, createContratosPublicRouter, createPaginaContratoRouter } from '../contratos/rotas.js';
import * as contratos from '../contratos/servico.js';
import { createAulasAdminRouter } from '../aulas/rotas.js';
import * as aulas from '../aulas/servico.js';
import { ErroDominio, exigirUuid, exigirData } from '../acesso/banco.js';
import { createRetencaoAdminRouter } from '../retencao/rotas.js';
import * as retencao from '../retencao/servico.js';
import * as retencaoOps from '../retencao/operacoes.js';
import { executarFerramentaClube } from './ferramentas-ia.js';
import * as parceiros from '../parceiros/servico.js';
import { createParceirosWebhookRouter, createParceirosAdminRouter, createPasseRouters } from '../parceiros/rotas.js';
import * as cobrancas from '../cobrancas/servico.js';
import { createCobrancasAdminRouter, createPagamentoPublicoRouters } from '../cobrancas/rotas.js';
import { createAdesaoRouter } from './adesao.js';
import { createQuadrasAdminRouter } from '../quadras/rotas.js';
import express from 'express';
import { readFileSync } from 'node:fs';

const PAINEL_HTML = readFileSync(new URL('./painel.html', import.meta.url), 'utf8');

/** Painel do clube (/clube/painel): página única que usa a sessão do Kytto (sp_token) e as APIs do admin. */
export function createPainelRouter() {
  const r = express.Router();
  r.get('/', (req, res) => {
    res.set({
      'Cache-Control': 'no-cache',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
    });
    res.type('html').send(PAINEL_HTML);
  });
  return r;
}

/** Evita mandar a mesma mensagem várias vezes se o aluno insistir na catraca. */
export function criarAntiRepeticao(janelaMs = 10 * 60 * 1000) {
  const ultimo = new Map();
  return (chave, agora = Date.now()) => {
    const t = ultimo.get(chave);
    if (t && agora - t < janelaMs) return false;
    ultimo.set(chave, agora);
    if (ultimo.size > 10000) for (const [k, v] of ultimo) if (agora - v > janelaMs) ultimo.delete(k);
    return true;
  };
}

/** Fuso da empresa: o das turmas dela (todas as unidades de uma empresa ficam no mesmo fuso). */
export async function fusoDaEmpresa(db, empresaId) {
  const r = await db.query('SELECT fuso FROM aulas_turmas WHERE empresa_id = $1 AND ativa ORDER BY criado_em LIMIT 1', [empresaId]);
  return r.rows[0]?.fuso || 'America/Cuiaba';
}

export const diaNoFuso = (instante, fuso) => new Date(instante).toLocaleDateString('en-CA', { timeZone: fuso });

async function telefoneDe(db, empresaId, customerId) {
  const r = await db.query('SELECT nome, telefone FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresaId, customerId]);
  return r.rows[0] || null;
}

/**
 * Reação às decisões da catraca (item 1.5, coluna "ação automática").
 * `gerarLinkPagamento({ empresaId, customerId })` é opcional: com ele a IA manda o Pix na hora.
 */
export function criarDisparadorDeAcoes({ db, enviarWhatsapp, urlPublica = '', gerarLinkPagamento = null, antiRepeticao = criarAntiRepeticao(), fetch: f = undefined }) {
  const base = String(urlPublica).replace(/\/$/, '');
  const deps = { fetch: f };
  return async (evento) => {
    const { acao, empresaId, customerId } = evento;
    if (!customerId) return;
    if (acao === ACOES.REGISTRAR_PRESENCA) {
      await aulas.registrarPresencaPorAcesso(db, { empresaId, customerId, agora: new Date() });
      return;
    }
    if (acao === ACOES.VALIDAR_PARCEIRO) {
      // passou na catraca com check-in Wellhub/TotalPass: valida na plataforma e marca presença na aula
      await parceiros.naPassagem(db, { checkinId: evento.checkinId, em: evento.em || new Date() }, { fetch: deps.fetch }).catch(() => null);
      await aulas.registrarPresencaPorAcesso(db, { empresaId, customerId, agora: new Date() }).catch(() => null);
      return;
    }
    if (!enviarWhatsapp || !antiRepeticao(`${empresaId}:${customerId}:${acao}`)) return;
    const pessoa = await telefoneDe(db, empresaId, customerId);
    const nome = String(pessoa?.nome || '').split(' ')[0];
    let texto = null;
    let telefone = pessoa?.telefone || null;
    let destinatarioId = customerId;
    if (acao === ACOES.ENVIAR_LINK_PAGAMENTO) {
      let link = null;
      if (gerarLinkPagamento) {
        const fin = await retencaoOps.consultarFinanceiro(db, empresaId, customerId).catch(() => null);
        const valor = fin?.total || fin?.valorMensal || null;
        link = await retencao.linkDePagamento(db, { empresaId, customerId, valor, descricao: 'Mensalidade em atraso', gerar: gerarLinkPagamento }).catch(() => null);
      }
      texto = link
        ? `${nome}, vi que a catraca não liberou porque a mensalidade está em aberto. Pague pelo Pix aqui e a entrada libera em até 1 minuto: ${link}`
        : `${nome}, vi que a catraca não liberou porque a mensalidade está em aberto. Quer que eu gere o Pix para você?`;
    } else if (acao === ACOES.REENVIAR_CONTRATO) {
      // o link vai para quem assina (o responsável, no caso de menor), não necessariamente para o aluno
      const novo = await contratos.novoLinkDeAceite(db, empresaId, { customerId }).catch(() => null);
      if (novo) {
        telefone = novo.signatario?.telefone || null;
        destinatarioId = novo.signatario?.customerId || customerId;
        const quem = String(novo.signatario?.nome || pessoa?.nome || '').split(' ')[0];
        const doAluno = destinatarioId === customerId ? '' : ` de ${nome}`;
        texto = novo.reaproveitado
          ? `${quem}, a catraca não liberou porque o contrato${doAluno} ainda não foi aceito. É só abrir o link que enviei há pouco aqui no WhatsApp e confirmar com o código.`
          : contratos.mensagemDeEnvio({ nome: novo.signatario?.nome || pessoa?.nome, titulo: novo.titulo, link: `${base}/contrato/${novo.token}`, destaques: novo.destaques });
      }
    } else if (acao === ACOES.MOSTRAR_VAGAS) {
      const fuso = await fusoDaEmpresa(db, empresaId);
      const agora = new Date();
      const vagas = (await aulas.listarVagas(db, empresaId, { dia: diaNoFuso(agora, fuso), agora, fuso })).filter((v) => v.vagasAlunos > 0).slice(0, 4);
      texto = vagas.length
        ? `${nome}, seu plano pede reserva. Tem vaga hoje em:\n${vagas.map((v) => `• ${v.rotulo}`).join('\n')}\nQuer que eu reserve alguma?`
        : `${nome}, seu plano pede reserva e não há vagas livres hoje. Quer entrar na lista de espera?`;
    } else if (acao === ACOES.OFERECER_DIARIA) {
      texto = `${nome}, você já usou o limite do seu plano hoje. Se quiser treinar de novo, posso liberar uma diária avulsa.`;
    } else if (acao === ACOES.OFERECER_UPGRADE) {
      texto = `${nome}, seu plano não libera este horário. Se quiser, te mostro um plano com horário livre.`;
    }
    // diária e upgrade são oferta: respeitam o "parar" do aluno (o adaptador confere o opt-out)
    const marketing = acao === ACOES.OFERECER_DIARIA || acao === ACOES.OFERECER_UPGRADE;
    if (texto && telefone) await enviarWhatsapp({ empresaId, customerId: destinatarioId, telefone, texto, ...(marketing ? { marketing: true } : {}) });
  };
}

/**
 * Baixa de pagamento (Pix da academia, crediário, gateway por empresa): estende o "pago até"
 * (informado; + N meses quando o valor cobre mensalidades; dias proporcionais quando é parcial),
 * sincroniza a catraca na hora e atribui a receita recuperada ao disparo da régua.
 *
 * Idempotente pelo `pagamentoId` e retomável: o "pago até" calculado é gravado ANTES de aplicar,
 * então uma baixa que caiu no meio é refeita com a mesma data (GREATEST no banco torna a
 * reaplicação inofensiva) e nunca estende duas vezes. `estender: false` só registra a receita
 * (cobrança avulsa, como diária ou taxa).
 */
export async function registrarPagamentoClube(db, { empresaId, customerId, pagamentoId, valor = null, pagoAte = null, meses = null, estender = true, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const id = String(pagamentoId || '').trim();
  if (!id || id.length > 120) throw new ErroDominio('VALIDATION_ERROR', 'pagamentoId (id do pagamento na cobrança) é obrigatório');
  let n = null;
  if (meses !== null && meses !== undefined && meses !== '') {
    n = Number.parseInt(meses, 10);
    if (!Number.isInteger(n) || n < 1 || n > 24 || String(n) !== String(meses).trim()) throw new ErroDominio('VALIDATION_ERROR', 'meses deve ser inteiro de 1 a 24');
  }
  const v = valor === null || valor === undefined || valor === '' ? null : Number(valor);
  if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100000)) throw new ErroDominio('VALIDATION_ERROR', 'valor inválido');
  const ate = pagoAte ? exigirData(pagoAte, 'pagoAte') : null;

  const reserva = await db.query(
    `INSERT INTO clube_pagamentos_recebidos (empresa_id, pagamento_id, customer_id, valor, criado_em) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (empresa_id, pagamento_id) DO NOTHING RETURNING pagamento_id`,
    [empresa, id, cliente, v, agora],
  );
  let etapa = null; let dataSalva = null;
  if (!reserva.rows[0]) {
    const ja = (await db.query(
      `SELECT customer_id, resultado, nova_data::text AS nova_data, criado_em > $3::timestamptz - interval '2 minutes' AS recente
         FROM clube_pagamentos_recebidos WHERE empresa_id = $1 AND pagamento_id = $2`,
      [empresa, id, agora],
    )).rows[0];
    if (ja?.resultado?.concluido) return { duplicado: true, ...ja.resultado };
    if (ja && ja.customer_id !== cliente) throw new ErroDominio('PAGAMENTO_DE_OUTRO_ALUNO', 'Este pagamento já foi lançado para outro aluno', 409);
    // outra baixa do mesmo pagamento está em andamento agora: não aplica em paralelo
    if (ja?.recente && !ja.resultado) return { duplicado: true, processando: true };
    etapa = ja?.resultado?.etapa || null;
    dataSalva = ja?.nova_data || null;
  }

  const r = await db.query(
    `SELECT m.id, m.pago_ate::text AS pago_ate, p.valor_mensal FROM acesso_matriculas m JOIN acesso_planos p ON p.id = m.plano_id
      WHERE m.empresa_id = $1 AND m.customer_id = $2 AND m.status IN ('ativa', 'congelada') ORDER BY (m.status = 'ativa') DESC LIMIT 1`,
    [empresa, cliente],
  );
  const m = r.rows[0];
  let matricula = null;
  if (m && estender && etapa !== 'matricula') {
    let novaData = dataSalva || ate;
    if (!novaData) {
      const mensal = Number(m.valor_mensal) || 0;
      if (!n && v !== null && mensal && v < mensal * 0.95) {
        // pagamento parcial (parcela de acordo, valor menor): dias proporcionais, nunca 1 mês inteiro
        const dias = Math.floor((30 * v) / mensal);
        if (dias >= 1) novaData = (await db.query('SELECT ($1::date + $2::int)::text AS d', [m.pago_ate, dias])).rows[0].d;
      } else {
        const qtd = n || (v && mensal ? Math.min(24, Math.max(1, Math.floor(v / mensal + 0.05))) : 1);
        // soma de meses no banco: 31/01 + 1 mês = 28/02 (o Date do JS transbordaria para março)
        novaData = (await db.query('SELECT ($1::date + make_interval(months => $2::int))::date::text AS d', [m.pago_ate, qtd])).rows[0].d;
      }
      await db.query('UPDATE clube_pagamentos_recebidos SET nova_data = $3 WHERE empresa_id = $1 AND pagamento_id = $2', [empresa, id, novaData]);
    }
    if (novaData) matricula = await acessoRepo.registrarPagamento(db, empresa, m.id, novaData);
    await db.query('UPDATE clube_pagamentos_recebidos SET resultado = $3 WHERE empresa_id = $1 AND pagamento_id = $2',
      [empresa, id, JSON.stringify({ etapa: 'matricula', matricula })]);
  }
  const atribuicao = await retencao.registrarPagamentoRecebido(db, { empresaId: empresa, customerId: cliente, valor: v, agora });
  const resultado = { concluido: true, matricula, atribuicao };
  await db.query('UPDATE clube_pagamentos_recebidos SET resultado = $3 WHERE empresa_id = $1 AND pagamento_id = $2', [empresa, id, JSON.stringify(resultado)]);
  return resultado;
}

/** Aviso curto para o gestor da academia (ocorrências da régua de retenção). */
export function criarNotificadorDoGestor({ db, enviarWhatsapp }) {
  return async ({ empresaId, texto }) => {
    if (!enviarWhatsapp) return;
    const { telefoneGestor } = await retencao.obterConfig(db, empresaId);
    if (!telefoneGestor) return;
    await enviarWhatsapp({ empresaId, customerId: null, telefone: telefoneGestor, texto, tipo: 'interno' });
  };
}

export function montarClube(app, {
  db, empresaDaRequisicao, operadorDaRequisicao, enviarWhatsapp, urlPublica = process.env.PUBLIC_BASE_URL || '',
  gerarLinkPagamento = null, financeiroExterno = null, qrSecret = process.env.CLUBE_QR_SECRET, prefixoAdmin = '/api/admin/clube',
  extrasRetencao = {}, criarCliente = parceiros.criarClientePadrao, fetch: f = undefined,
}) {
  if (!db || typeof empresaDaRequisicao !== 'function') throw new Error('montarClube: db e empresaDaRequisicao são obrigatórios');
  // sem gateway externo: Pix com a chave de cada academia (configurado no painel, por empresa)
  if (!gerarLinkPagamento) gerarLinkPagamento = cobrancas.criarGeradorDeLink(db, { urlPublica });
  const extras = { contrato: contratos.contratoParaAcesso, reservas: aulas.reservasParaAcesso, parceiro: parceiros.passeParaAcesso };
  const dispararAcao = criarDisparadorDeAcoes({ db, enviarWhatsapp, urlPublica, gerarLinkPagamento, fetch: f });
  // o gatilho "parceiro frequente" da régua usa os check-ins do item 2
  extrasRetencao = { checkinsParceiroMes: parceiros.checkinsParceiroMes, ...extrasRetencao };
  const notificarGestor = criarNotificadorDoGestor({ db, enviarWhatsapp });
  const enviarAvisos = async (avisos) => {
    if (!enviarWhatsapp) return;
    for (const a of avisos) {
      const p = await telefoneDe(db, a.empresaId, a.customerId);
      if (p?.telefone) await enviarWhatsapp({ empresaId: a.empresaId, customerId: a.customerId, telefone: p.telefone, texto: a.texto });
    }
  };
  // pagamento e matrícula alimentam a régua (receita recuperada, interessado convertido)
  const aoPagamento = async (d) => {
    // pago direto na matrícula: a mensalidade em aberto por Pix deixa de valer (evita duas baixas do mesmo mês)
    await cobrancas.cancelarMensalidadesPendentes(db, d.empresaId, d.customerId).catch(() => 0);
    return retencao.registrarPagamentoRecebido(db, d);
  };
  const aoMatricular = ({ empresaId, customerId }) => retencaoOps.converterInteressado(db, empresaId, customerId);

  app.use('/api/acesso/controlid', createControlIdRouter({ db, extras, dispararAcao, qrSecret }));
  app.use(`${prefixoAdmin}/acesso`, createAcessoAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao, urlPublica, qrSecret, aoPagamento, aoMatricular }));
  app.use(`${prefixoAdmin}/contratos`, createContratosAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao, enviarWhatsapp, urlPublica }));
  app.use(`${prefixoAdmin}/aulas`, createAulasAdminRouter({ db, empresaDaRequisicao, enviarAvisos }));
  app.use(`${prefixoAdmin}/retencao`, createRetencaoAdminRouter({
    db, empresaDaRequisicao, operadorDaRequisicao, enviarWhatsapp, extras: extrasRetencao,
    gerarLinkPagamento: cobrancas.comOrigem(gerarLinkPagamento, 'recepcao'),
  }));
  app.use('/api/public/contratos', createContratosPublicRouter({
    db,
    enviarWhatsapp,
    // aceite do contrato: atualiza a catraca na hora (a pessoa pode estar na porta)
    aoAceitar: async ({ empresaId, customerId, contratoId, signatarioCustomerId, aceitaMarketing }) => {
      await acessoRepo.sincronizarPessoa(db, empresaId, customerId);
      if (aceitaMarketing) {
        // aluno menor: quem autoriza é o responsável que assinou (LGPD art. 14, §1º); fica na evidência
        const peloResponsavel = signatarioCustomerId && signatarioCustomerId !== customerId;
        await retencao.registrarConsentimentoMarketing(db, {
          empresaId, customerId, concedido: true, origem: 'contrato',
          detalhe: peloResponsavel ? `contrato ${contratoId}; autorizado pelo responsável legal ${signatarioCustomerId}` : `contrato ${contratoId}`,
        });
      }
    },
  }));
  app.use('/contrato', createPaginaContratoRouter());

  // Item 2 — Wellhub e TotalPass
  const cancelarReservaParceiro = async (conta, ev) => {
    exigirUuid(ev.ocorrenciaId, 'aula');
    const r = await db.query(
      `SELECT r.id FROM aulas_reservas r JOIN clube_parceiro_pessoas pp ON pp.empresa_id = r.empresa_id AND pp.customer_id = r.customer_id
        WHERE r.empresa_id = $1 AND r.ocorrencia_id = $2 AND pp.plataforma = $3 AND pp.id_externo = $4 AND r.status = 'reservada'`,
      [conta.empresa_id, ev.ocorrenciaId, conta.plataforma, ev.pessoaExterna],
    );
    if (!r.rows[0]) return { cancelada: false };
    const c = await aulas.cancelarReserva(db, conta.empresa_id, { reservaId: r.rows[0].id });
    if (c.avisos?.length) await enviarAvisos(c.avisos).catch(() => {});
    return { cancelada: true };
  };
  app.use('/api/integracoes', createParceirosWebhookRouter({
    db, criarCliente, enviarWhatsapp, urlPublica, qrSecret, fetch: f, cancelarReservaParceiro,
    reservar: (d, empresaId, dados) => aulas.reservar(d, empresaId, dados),
  }));
  app.use(`${prefixoAdmin}/parceiros`, createParceirosAdminRouter({ db, empresaDaRequisicao, urlPublica, fetch: f }));
  const passe = createPasseRouters({ db, qrSecret });
  app.use('/clube/passe', passe.pagina);
  app.use('/clube/painel', createPainelRouter());
  app.use('/api/public/clube/passes', passe.api);

  // Cobrança da mensalidade (Pix da academia), com baixa que libera a catraca
  const registrarPagamento = (dados) => registrarPagamentoClube(db, dados);
  app.use(`${prefixoAdmin}/cobrancas`, createCobrancasAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao, registrarPagamento, urlPublica }));
  // adesão em um passo: cadastro + matrícula + contrato + Pix da 1ª mensalidade
  app.use(`${prefixoAdmin}/adesao`, createAdesaoRouter({
    db, empresaDaRequisicao, operadorDaRequisicao, enviarWhatsapp, urlPublica, gerarLinkPagamento: cobrancas.comOrigem(gerarLinkPagamento, 'recepcao'),
  }));
  // quadras e reservas (tênis, beach tennis, padel…) com horário de funcionamento por empresa
  app.use(`${prefixoAdmin}/quadras`, createQuadrasAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao }));
  const pagar = createPagamentoPublicoRouters({ db });
  app.use('/clube/pagar', pagar.pagina);
  app.use('/api/public/clube/pagamentos', pagar.api);

  /**
   * Para a IA do WhatsApp: executa uma ferramenta clube_* com as dependências já ligadas.
   * conversa = { empresaId, customerId } vindos do número autenticado da conversa.
   */
  const gerarLinkIa = cobrancas.comOrigem(gerarLinkPagamento, 'ia');
  const executarFerramenta = (conversa, nome, args) => executarFerramentaClube(db, { ...conversa, qrSecret, urlPublica }, nome, args, {
    enviarAvisos, gerarLinkPagamento: gerarLinkIa, notificarGestor, financeiroExterno,
  });
  /** Ligar no recebimento de cada mensagem do aluno (antes da IA responder): pausa a régua e grava opt-out. */
  const aoReceberMensagem = (dados) => retencao.registrarMensagemRecebida(db, dados);
  // registrarPagamento (acima): ligar em qualquer outra baixa (crediário, gateway por empresa) com o id do pagamento.
  return { gerarLinkPagamento, dispararAcao, enviarAvisos, extras, notificarGestor, executarFerramenta, aoReceberMensagem, registrarPagamento };
}

/**
 * Rotinas periódicas (agendar a cada 1 minuto; são idempotentes e baratas).
 * Retorna um resumo para log/observabilidade.
 */
export async function executarRotinasClube(db, {
  enviarWhatsapp, gerarLinkPagamento = null, extrasRetencao = {}, agora = new Date(), gerarGrade = true, rodarRetencao = true,
  urlPublica = process.env.PUBLIC_BASE_URL || '',
} = {}) {
  const resumo = { chamadosFila: 0, faltas: 0, lembretesAula: 0, lembretesContrato: 0, ocorrencias: 0, retencao: null, congelamentos: null, erros: [] };
  extrasRetencao = { checkinsParceiroMes: parceiros.checkinsParceiroMes, ...extrasRetencao };
  const enviar = async (avisos) => {
    for (const a of avisos) {
      const p = await telefoneDe(db, a.empresaId, a.customerId);
      if (p?.telefone && enviarWhatsapp) await enviarWhatsapp({ empresaId: a.empresaId, customerId: a.customerId, telefone: p.telefone, texto: a.texto });
    }
  };
  const etapa = async (nome, fn) => { try { await fn(); } catch (e) { resumo.erros.push(`${nome}: ${e.message}`); } };

  await etapa('fila', async () => { const a = await aulas.expirarChamados(db, { agora }); resumo.chamadosFila = a.length; await enviar(a); });
  await etapa('faltas', async () => { resumo.faltas = (await aulas.processarFaltas(db, { agora })).faltas; });
  await etapa('lembretes_aula', async () => { const a = await aulas.lembretesDeAula(db, { agora }); resumo.lembretesAula = a.length; await enviar(a); });
  await etapa('lembretes_contrato', async () => {
    for (const l of await contratos.lembretesDevidos(db, { agora })) {
      if (enviarWhatsapp && l.telefone) await enviarWhatsapp({ empresaId: l.empresaId, customerId: l.customerId, telefone: l.telefone, texto: l.mensagem });
      await contratos.marcarLembreteEnviado(db, l.empresaId, l.contratoId);
      resumo.lembretesContrato += 1;
    }
  });
  // mantém 14 dias de grade gerada, contando "hoje" no fuso de cada empresa
  if (gerarGrade) {
    await etapa('ocorrencias', async () => {
      const empresas = await db.query(
        'SELECT empresa_id, MIN(fuso) AS fuso FROM aulas_turmas WHERE ativa GROUP BY empresa_id',
      );
      for (const e of empresas.rows) {
        const de = diaNoFuso(agora, e.fuso);
        const ate = diaNoFuso(agora.getTime() + 14 * 86400000, e.fuso);
        resumo.ocorrencias += (await aulas.gerarOcorrencias(db, e.empresa_id, { de, ate })).criadas;
      }
    });
  }
  // régua de retenção e congelamentos: a cada 15 min basta (a régua já respeita horário e cadência)
  if (rodarRetencao) {
    await etapa('congelamentos', async () => { resumo.congelamentos = await retencaoOps.aplicarCongelamentos(db, { agora }); });
    await etapa('retencao', async () => {
      resumo.retencao = await retencao.executarRotinaRetencao(db, { agora, enviarWhatsapp, gerarLinkPagamento, extras: extrasRetencao });
      for (const e of resumo.retencao.erros) resumo.erros.push(`retencao ${e}`);
    });
  }
  await etapa('parceiros', async () => { resumo.parceiros = await parceiros.rotinaParceiros(db, { agora }); });
  await etapa('parcelas', async () => { resumo.parcelas = await cobrancas.enviarParcelasDevidas(db, { enviarWhatsapp, urlPublica, agora }); });
  await etapa('limpeza', async () => { resumo.limpeza = await limparDadosAntigos(db, { agora }); });
  return resumo;
}

/**
 * LGPD: a fila Push guarda o comando enviado ao aparelho (nome, validade). Depois de entregue
 * não serve para nada; apaga após 7 dias. Eventos de acesso ficam (são o histórico da academia).
 */
export async function limparDadosAntigos(db, { agora = new Date(), diasFila = 7 } = {}) {
  const limite = new Date(agora.getTime() - diasFila * 86400000);
  const r = await db.query("DELETE FROM acesso_fila_push WHERE status IN ('ok', 'erro') AND criado_em < $1", [limite]);
  // passes vencidos e URLs de validação de uso único que já não servem
  const temParceiros = (await db.query("SELECT to_regclass('clube_passes') IS NOT NULL AS ok")).rows[0].ok;
  if (temParceiros) {
    await db.query('DELETE FROM clube_passes WHERE expira_em < $1', [limite]);
    await db.query(
      "UPDATE clube_parceiro_checkins SET validacao_cifrada = NULL WHERE validacao_cifrada IS NOT NULL AND status IN ('validado', 'expirado', 'negado') AND recebido_em < $1",
      [limite],
    );
  }
  return r.rowCount;
}

const TRAVA_ROTINAS = 825410801;
const UMA_HORA = 60 * 60 * 1000;

/**
 * Um ciclo das rotinas sob trava de transação: a trava pertence à conexão da transação e é solta
 * no COMMIT/ROLLBACK, então não vaza no pool (pg_advisory_lock + unlock podem cair em conexões diferentes).
 */
export async function cicloRotinasClube(db, { agora = new Date(), gerarGrade = true, rodarRetencao = true, ...deps } = {}) {
  const client = await db.beginTransaction();
  try {
    const lock = await db.queryInTransaction(client, 'SELECT pg_try_advisory_xact_lock($1) AS ok', [TRAVA_ROTINAS]);
    if (!lock.rows[0]?.ok) return null;
    return await executarRotinasClube(db, { ...deps, agora, gerarGrade, rodarRetencao });
  } finally {
    await db.rollback(client).catch(() => {});
  }
}

/**
 * Agenda as rotinas dentro do próprio processo (o serviço setpoint roda com 1 instância).
 * Trava no banco para nunca rodar duas ao mesmo tempo, mesmo se escalar no futuro.
 * A grade é gerada na primeira volta e depois a cada hora (pelo tempo decorrido, não pelo minuto do relógio).
 */
export function iniciarRotinasClube(db, { enviarWhatsapp, gerarLinkPagamento = null, extrasRetencao = {}, intervaloMs = 60000, log = console } = {}) {
  extrasRetencao = { checkinsParceiroMes: parceiros.checkinsParceiroMes, ...extrasRetencao };
  let rodando = false;
  let ultimaGrade = 0;
  let ultimaRetencao = 0;
  const ciclo = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const gerarGrade = Date.now() - ultimaGrade >= UMA_HORA;
      const rodarRetencao = Date.now() - ultimaRetencao >= 15 * 60 * 1000;
      const r = await cicloRotinasClube(db, { enviarWhatsapp, gerarLinkPagamento, extrasRetencao, gerarGrade, rodarRetencao });
      if (r && gerarGrade && !r.erros.some((e) => e.startsWith('ocorrencias'))) ultimaGrade = Date.now();
      if (r && rodarRetencao) ultimaRetencao = Date.now();
      if (r?.erros.length) log.warn('[clube] rotinas com erro', r.erros);
    } catch (error) {
      log.error('[clube] rotinas', error.message);
    } finally {
      rodando = false;
    }
  };
  const timer = setInterval(ciclo, intervaloMs);
  timer.unref?.();
  setTimeout(ciclo, 5000).unref?.();
  return () => clearInterval(timer);
}
