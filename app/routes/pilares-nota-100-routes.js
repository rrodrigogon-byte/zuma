/**
 * Rotas REST para Agro, Agropecuária/Receituário, CT-e 57 / MDF-e 58 e Implantação Guiada
 */
import { Router } from 'express';
import {
  obterDashboardAgro,
  listarSafrasAgro,
  criarSafraAgro,
  listarTicketsBalancaAgro,
  abrirTicketBalancaAgro,
  registrarSaidaTicketBalancaAgro,
  listarRomaneiosAgro,
  listarNotasProdutorAgro,
  emitirNotaProdutorAgro,
  listarSilosAgro,
  movimentarSiloAgro,
  obterEstadoAgropecuaria,
  emitirReceituarioAgronomico,
  obterEstadoCteMdfe,
  emitirCte57,
  emitirMdfe58,
  encerrarMdfe58,
  obterPainelImplantacaoEmpresa
} from '../core/pilares-nota-100-kytto.js';

function resolverTenant(req, obterEmpresaId) {
  if (typeof obterEmpresaId === 'function') {
    const id = obterEmpresaId(req);
    if (id) return id;
  }
  return req.headers['x-empresa-id'] || req.empresaId || req.tenantId || req.user?.empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
}

export function createAgroRouter({ obterEmpresaId } = {}) {
  const router = Router();

  router.get('/dashboard', (req, res) => {
    try {
      res.json(obterDashboardAgro(resolverTenant(req, obterEmpresaId)));
    } catch (e) { res.status(500).json({ erro: e.message }); }
  });

  router.get('/safras', (req, res) => {
    try {
      res.json(listarSafrasAgro(resolverTenant(req, obterEmpresaId)));
    } catch (e) { res.status(500).json({ erro: e.message }); }
  });

  router.post('/safras', (req, res) => {
    try {
      const r = criarSafraAgro(resolverTenant(req, obterEmpresaId), req.body || {});
      res.status(201).json(r.rows[0]);
    } catch (e) { res.status(400).json({ erro: e.message }); }
  });

  router.get('/tickets', (req, res) => {
    try {
      res.json(listarTicketsBalancaAgro(resolverTenant(req, obterEmpresaId), req.query || {}));
    } catch (e) { res.status(500).json({ erro: e.message }); }
  });

  router.post('/tickets', (req, res) => {
    try {
      const r = abrirTicketBalancaAgro(resolverTenant(req, obterEmpresaId), req.body || {});
      res.status(201).json(r.rows[0]);
    } catch (e) { res.status(400).json({ erro: e.message }); }
  });

  router.put('/tickets/:id/saida', (req, res) => {
    try {
      const t = registrarSaidaTicketBalancaAgro(resolverTenant(req, obterEmpresaId), req.params.id, req.body || {});
      res.json(t);
    } catch (e) { res.status(400).json({ erro: e.message }); }
  });

  router.get('/romaneios', (req, res) => {
    try {
      res.json(listarRomaneiosAgro(resolverTenant(req, obterEmpresaId)));
    } catch (e) { res.status(500).json({ erro: e.message }); }
  });

  router.get('/notas-produtor', (req, res) => {
    try {
      res.json(listarNotasProdutorAgro(resolverTenant(req, obterEmpresaId)));
    } catch (e) { res.status(500).json({ erro: e.message }); }
  });

  router.post('/notas-produtor', (req, res) => {
    try {
      const r = emitirNotaProdutorAgro(resolverTenant(req, obterEmpresaId), req.body || {});
      res.status(201).json(r.rows[0]);
    } catch (e) { res.status(400).json({ erro: e.message }); }
  });

  router.get('/silos', (req, res) => {
    try {
      res.json(listarSilosAgro(resolverTenant(req, obterEmpresaId)));
    } catch (e) { res.status(500).json({ erro: e.message }); }
  });

  router.post('/silos/:id/movimentar', (req, res) => {
    try {
      res.json(movimentarSiloAgro(resolverTenant(req, obterEmpresaId), req.params.id, req.body || {}));
    } catch (e) { res.status(400).json({ erro: e.message }); }
  });

  return router;
}

export function createAgropecuariaRouter({ obterEmpresaId } = {}) {
  const router = Router();

  router.get('/agendamentos/hoje', (req, res) => {
    const st = obterEstadoAgropecuaria(resolverTenant(req, obterEmpresaId));
    res.json({ sucesso: true, agendamentos: st.agendamentos });
  });

  router.post('/agendamentos', (req, res) => {
    const st = obterEstadoAgropecuaria(resolverTenant(req, obterEmpresaId));
    const novo = {
      id: `ag-vet-${Date.now()}`,
      hora_inicio: req.body?.hora_inicio || '14:00',
      pet_nome: req.body?.pet_nome || 'Animal / Lote',
      especie: req.body?.especie || 'Bovino',
      raca: req.body?.raca || 'Nelore',
      cliente_nome: req.body?.cliente_nome || 'Produtor Rural',
      cliente_telefone: req.body?.cliente_telefone || '65999000000',
      servico_nome: req.body?.servico_nome || 'Atendimento Veterinário',
      veterinario_nome: req.body?.veterinario_nome || 'Dra. Camila Prado',
      valor: Number(req.body?.valor || 250),
      status: 'confirmado'
    };
    st.agendamentos.unshift(novo);
    res.status(201).json({ sucesso: true, agendamento: novo });
  });

  router.get('/vacinas/reforco-proximo', (req, res) => {
    const st = obterEstadoAgropecuaria(resolverTenant(req, obterEmpresaId));
    res.json({ sucesso: true, vacinas: st.vacinas });
  });

  router.get('/receituarios', (req, res) => {
    const st = obterEstadoAgropecuaria(resolverTenant(req, obterEmpresaId));
    res.json({ sucesso: true, receituarios: st.receituarios });
  });

  router.post('/receituarios', (req, res) => {
    try {
      const rec = emitirReceituarioAgronomico(resolverTenant(req, obterEmpresaId), req.body || {});
      res.status(201).json({ sucesso: true, receituario: rec });
    } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
  });

  return router;
}

export function createCteMdfeRouter({ obterEmpresaId } = {}) {
  const router = Router();

  router.get('/painel', (req, res) => {
    const st = obterEstadoCteMdfe(resolverTenant(req, obterEmpresaId));
    res.json({
      sucesso: true,
      ctes: st.ctes,
      mdfes: st.mdfes,
      resumo: {
        totalCtesAutorizados: st.ctes.length,
        totalMdfesEmitidos: st.mdfes.length,
        mdfesEmTransito: st.mdfes.filter(m => m.status === 'AUTORIZADO_EM_TRANSITO').length,
        mdfesEncerrados: st.mdfes.filter(m => m.status === 'ENCERRADO_SEFAZ').length
      }
    });
  });

  router.post('/cte/emitir', (req, res) => {
    try {
      const cte = emitirCte57(resolverTenant(req, obterEmpresaId), req.body || {});
      res.status(201).json({ sucesso: true, cte });
    } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
  });

  router.post('/mdfe/emitir', (req, res) => {
    try {
      const mdfe = emitirMdfe58(resolverTenant(req, obterEmpresaId), req.body || {});
      res.status(201).json({ sucesso: true, mdfe });
    } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
  });

  router.post('/mdfe/:id/encerrar', (req, res) => {
    try {
      const mdfe = encerrarMdfe58(resolverTenant(req, obterEmpresaId), req.params.id, req.body || {});
      res.json({ sucesso: true, mdfe });
    } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
  });

  return router;
}

export function createImplantacaoRouter({ db, obterEmpresaId } = {}) {
  const router = Router();

  router.get('/status', async (req, res) => {
    try {
      const empresaId = resolverTenant(req, obterEmpresaId);
      const painel = await obterPainelImplantacaoEmpresa(db, empresaId);
      res.json(painel);
    } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
  });

  return router;
}
