import express from 'express';
import * as svc from './servico.js';
import * as fontes from './fontes.js';
import * as conc from './conciliacao.js';
import { ErroDominio, exigirUuid, responderErro } from '../acesso/banco.js';

/**
 * /api/admin/razao — Financeiro da empresa sobre o razão único.
 *
 * `escopoDaRequisicao(req, permissao)` resolve e autoriza a empresa e devolve
 * { empresaId, lojaRestrita }: com a permissão presa a uma unidade, a leitura e a escrita ficam
 * nessa unidade. `fonteJson(empresaId)` devolve { chaveLegada, lancamentos, mapaUnidades } do
 * financeiro JSON antigo daquela empresa, ou null.
 */
export function createRazaoAdminRouter({ db, escopoDaRequisicao, fonteJson = null, ativo = () => process.env.FINANCEIRO_RAZAO === '1', fuso = svc.FUSO_PADRAO, intervaloSyncMs = 60_000 }) {
  if (!db || typeof escopoDaRequisicao !== 'function') throw new Error('createRazaoAdminRouter: db e escopoDaRequisicao são obrigatórios');
  const router = express.Router();
  const jsonPadrao = express.json({ limit: '64kb' });
  const jsonExtrato = express.json({ limit: '8mb' }); // OFX em base64
  router.use((req, res, next) => (req.path === '/conciliacao/importar' ? jsonExtrato : jsonPadrao)(req, res, next));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const ultimaLeitura = new Map();
  const leituraEmAndamento = new Map(); // empresa → promessa da leitura em curso
  // Uma leitura por empresa por vez: quem chega durante a leitura espera por ela, para resumo,
  // fluxo e lançamentos pedidos juntos mostrarem os mesmos números.
  async function lerFontes(empresaId, { forcar = false } = {}) {
    // Com o razão desligado (FINANCEIRO_RAZAO), nada é lido das fontes nem importado.
    if (ativo() !== true) return null;
    const emCurso = leituraEmAndamento.get(empresaId);
    if (emCurso) return emCurso;
    if (!forcar && Date.now() - (ultimaLeitura.get(empresaId) || 0) < intervaloSyncMs) return null;
    const leitura = (async () => {
      const resultado = await fontes.sincronizarEmpresa(db, empresaId, { fuso });
      try {
        const json = typeof fonteJson === 'function' ? await fonteJson(empresaId) : null;
        if (json?.chaveLegada) resultado.push(await fontes.sincronizarJson(db, empresaId, { ...json, fuso }));
      } catch (error) {
        resultado.push({ fonte: 'json', erro: String(error?.message || error).slice(0, 160) });
      }
      ultimaLeitura.set(empresaId, Date.now());
      return resultado;
    })().finally(() => leituraEmAndamento.delete(empresaId));
    leituraEmAndamento.set(empresaId, leitura);
    return leitura;
  }

  // Unidade pedida na consulta: '' / 'todas' = empresa toda; 'sem' = só sem unidade; uuid = a unidade.
  function unidadePedida(req, lojaRestrita) {
    const pedida = String(req.query.lojaId || req.body?.lojaId || '').trim();
    if (lojaRestrita) {
      if (pedida && pedida !== 'todas' && pedida !== lojaRestrita) throw new ErroDominio('STORE_SCOPE_MISMATCH', 'Unidade fora do seu acesso', 403);
      return lojaRestrita;
    }
    return pedida || null;
  }

  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, typeof permissao === 'function' ? permissao(req) : permissao);
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, usuario: String(req.user?.nome || req.user?.email || 'gestor') }));
    } catch (error) {
      return responderErro(res, error);
    }
  };

  // Quem só tem acesso a uma unidade não vê as contagens das fontes da empresa toda.
  router.get('/estado', rota('payments.read', async ({ empresaId, lojaRestrita }) => ({ ativo: ativo() === true, hoje: svc.hojeNoFuso(new Date(), fuso), lojaRestrita, fontes: lojaRestrita ? [] : await fontes.saudeDasFontes(db, empresaId) })));

  router.post('/sincronizar', rota('payments.write', async ({ empresaId, lojaRestrita }) => {
    const resultado = await lerFontes(empresaId, { forcar: true });
    return { fontes: lojaRestrita ? [] : resultado };
  }));

  router.get('/resumo', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => {
    await lerFontes(empresaId);
    return svc.resumo(db, empresaId, { lojaId: unidadePedida(req, lojaRestrita), fuso });
  }));
  router.get('/fluxo', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => {
    await lerFontes(empresaId);
    return svc.fluxo(db, empresaId, { meses: req.query.meses, lojaId: unidadePedida(req, lojaRestrita), fuso });
  }));
  router.get('/dre', rota('reports.read', async ({ req, empresaId, lojaRestrita }) => {
    await lerFontes(empresaId);
    return svc.dre(db, empresaId, { de: req.query.de, ate: req.query.ate, lojaId: unidadePedida(req, lojaRestrita), centroCustoId: req.query.centroCustoId || null });
  }));

  // unidade das receitas que chegam sem unidade (bar, clube, contas do A2)
  router.get('/config', rota('payments.read', ({ empresaId }) => svc.obterConfig(db, empresaId)));
  router.put('/config', rota('settings.write', async ({ req, empresaId, lojaRestrita }) => {
    if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', 'A unidade padrão vale para a empresa toda: exige permissão na empresa toda', 403);
    const r = await svc.salvarLojaPadrao(db, empresaId, req.body?.lojaPadrao || null);
    ultimaLeitura.delete(empresaId);
    return r;
  }));

  router.get('/lancamentos', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => {
    await lerFontes(empresaId);
    return svc.listar(db, empresaId, { ...req.query, lojaId: unidadePedida(req, lojaRestrita) });
  }));
  router.post('/lancamentos', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    const corpo = { ...(req.body || {}) };
    if (lojaRestrita) corpo.lojaId = lojaRestrita;
    return svc.criarManual(db, empresaId, corpo, { usuario, fuso });
  }, 201));

  async function exigirNoAlcance(empresaId, id, lojaRestrita) {
    const l = await svc.obter(db, empresaId, id);
    if (lojaRestrita && l.lojaId !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Lançamento não encontrado nesta empresa', 404);
    return l;
  }
  router.patch('/lancamentos/:id', rota('payments.write', async ({ req, empresaId, lojaRestrita }) => {
    await exigirNoAlcance(empresaId, req.params.id, lojaRestrita);
    const corpo = { ...(req.body || {}) };
    if (lojaRestrita) delete corpo.lojaId;
    return svc.atualizar(db, empresaId, req.params.id, corpo, { fuso });
  }));
  router.post('/lancamentos/:id/baixar', rota('payments.write', async ({ req, empresaId, lojaRestrita }) => {
    await exigirNoAlcance(empresaId, req.params.id, lojaRestrita);
    return svc.baixar(db, empresaId, req.params.id, { pagoEm: req.body?.pagoEm, meioPagamento: req.body?.meioPagamento }, { fuso });
  }));
  router.post('/lancamentos/:id/cancelar', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await exigirNoAlcance(empresaId, req.params.id, lojaRestrita);
    return svc.cancelar(db, empresaId, req.params.id, { usuario, motivo: req.body?.motivo });
  }));
  router.post('/lancamentos/:id/estornar', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await exigirNoAlcance(empresaId, req.params.id, lojaRestrita);
    return svc.estornar(db, empresaId, req.params.id, { usuario, motivo: req.body?.motivo, fuso });
  }));
  router.post('/series/:serieId/cancelar', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', 'Cancelar série exige permissão na empresa toda', 403);
    return svc.cancelarSerie(db, empresaId, req.params.serieId, { usuario, motivo: req.body?.motivo });
  }));

  router.get('/categorias', rota('payments.read', ({ empresaId }) => svc.listarCategorias(db, empresaId)));
  const empresaToda = (lojaRestrita) => { if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', 'Categorias e centros de custo valem para a empresa toda: exigem permissão na empresa toda', 403); };
  router.post('/categorias', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita); return svc.criarCategoria(db, empresaId, req.body || {}); }, 201));
  router.get('/centros-custo', rota('payments.read', async ({ empresaId }) => ({ centros: await svc.listarCentros(db, empresaId) })));
  router.post('/centros-custo', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita); return svc.salvarCentro(db, empresaId, req.body || {}); }, 201));
  router.patch('/centros-custo/:id', rota('settings.write', ({ req, empresaId, lojaRestrita }) => { empresaToda(lojaRestrita); return svc.salvarCentro(db, empresaId, req.body || {}, exigirUuid(req.params.id, 'centro de custo')); }));

  router.get('/fechamentos', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => ({ fechamentos: await svc.listarFechamentos(db, empresaId, { lojaId: unidadePedida(req, lojaRestrita) }) })));
  router.get('/fechamentos/previa', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => {
    await lerFontes(empresaId);
    return svc.totaisDoDia(db, empresaId, { data: req.query.data || svc.hojeNoFuso(new Date(), fuso), lojaId: unidadePedida(req, lojaRestrita), fuso });
  }));
  router.post('/fechamentos', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await lerFontes(empresaId, { forcar: true });
    return svc.fecharDia(db, empresaId, { data: req.body?.data, lojaId: unidadePedida(req, lojaRestrita), responsavel: usuario, observacao: req.body?.observacao, fuso });
  }, 201));

  // ── conciliação bancária (extrato OFX × razão) ─────────────────────────────
  router.get('/conciliacao/contas', rota('payments.read', async ({ empresaId, lojaRestrita }) => {
    const contas = await conc.resumoContas(db, empresaId);
    return lojaRestrita ? contas.filter((c) => c.lojaId === lojaRestrita) : contas;
  }));
  router.post('/conciliacao/contas', rota('settings.write', ({ req, empresaId, lojaRestrita }) => {
    if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', 'Cadastrar conta bancária exige permissão na empresa toda', 403);
    return conc.salvarConta(db, empresaId, req.body || {});
  }, 201));
  router.patch('/conciliacao/contas/:id', rota('settings.write', ({ req, empresaId, lojaRestrita }) => {
    if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', 'Editar conta bancária exige permissão na empresa toda', 403);
    return conc.salvarConta(db, empresaId, req.body || {}, req.params.id);
  }));
  router.post('/conciliacao/importar', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => conc.importarOfx(db, empresaId, {
    arquivoBase64: req.body?.arquivoBase64, nomeArquivo: req.body?.nomeArquivo, contaId: req.body?.contaId || null, conciliar: req.body?.conciliar !== false,
  }, { usuario, fuso, lojaRestrita }), 201));
  router.get('/conciliacao/linhas', rota('payments.read', ({ req, empresaId, lojaRestrita }) => conc.listarLinhas(db, empresaId, { contaId: req.query.contaId || null, status: req.query.status || 'pendente', lojaId: lojaRestrita, fuso })));
  router.post('/conciliacao/linhas/:id/conciliar', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => conc.conciliar(db, empresaId, req.params.id, req.body?.lancamentoId, { usuario, fuso, lojaRestrita })));
  router.post('/conciliacao/linhas/:id/criar-lancamento', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => conc.criarLancamentoDaLinha(db, empresaId, req.params.id, { categoria: req.body?.categoria, descricao: req.body?.descricao, lojaId: req.body?.lojaId }, { usuario, fuso, lojaRestrita })));
  router.post('/conciliacao/linhas/:id/ignorar', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => conc.ignorarLinha(db, empresaId, req.params.id, { usuario, lojaRestrita })));
  router.post('/conciliacao/linhas/:id/desfazer', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => conc.desfazer(db, empresaId, req.params.id, { lojaRestrita, usuario, fuso })));
  router.post('/conciliacao/automatico', rota('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => conc.conciliarAutomatico(db, empresaId, { contaId: req.body?.contaId || null, usuario, fuso, lojaRestrita })));

  return router;
}

/**
 * Rotas só da administração da plataforma: migração do financeiro antigo (JSON).
 * conferencia = ensaio + JSON × razão (não grava); liberar = importa e liga a leitura contínua.
 */
export function createRazaoPlataformaRouter({ db, fonteJson, fuso = svc.FUSO_PADRAO }) {
  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const comJson = (fn) => async (req, res) => {
    try {
      const empresaId = exigirUuid(req.body?.empresaId, 'empresa');
      const json = await fonteJson(empresaId);
      if (!json?.chaveLegada) throw new ErroDominio('NOT_FOUND', 'Esta empresa não tem financeiro no banco antigo', 404);
      res.json(await fn({ empresaId, json, incluirQuarentena: req.body?.incluirQuarentena === true, usuario: String(req.user?.email || req.user?.nome || 'plataforma') }));
    } catch (error) {
      responderErro(res, error);
    }
  };
  router.post('/legado/conferencia', comJson(async ({ empresaId, json, incluirQuarentena }) => ({
    ...(await fontes.conferirJsonLegado(db, empresaId, { ...json, incluirQuarentena, fuso })),
    config: await svc.obterConfig(db, empresaId),
  })));
  router.post('/legado/liberar', comJson(({ empresaId, json, incluirQuarentena, usuario }) => fontes.liberarJsonLegado(db, empresaId, { ...json, incluirQuarentena, usuario, fuso })));
  // compatibilidade: só ensaio (aplicar agora passa pela liberação conferida)
  router.post('/importar-legado', comJson(({ empresaId, json, incluirQuarentena }) => fontes.importarJsonLegado(db, empresaId, { ...json, aplicar: false, incluirQuarentena, fuso })));
  return router;
}
