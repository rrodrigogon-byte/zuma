import {
  carregarBaseConsolidada,
  consultarClientesRecuperacao,
  exportarCsvRecuperacao,
  invalidarCacheRecuperacao,
} from './dino-recuperacao-avec.js';
import { dispararCampanhaCRM } from './dino-crm-disparo.js';

export function registerDinoRecuperacaoAvecRoutes(app, deps) {
  const { legacyEmpresaId, legacyLojaId, barbeariaErpKytto, listarAgendamentosBarbearia } = deps;
  const BASE = '/api/admin/barbearia/recuperacao-clientes';

  async function getBase(req, force = false) {
    const empresaId = legacyEmpresaId(req);
    const lojaId = legacyLojaId(req);

    const comandas = barbeariaErpKytto?.listarComandasBarbearia
      ? barbeariaErpKytto.listarComandasBarbearia(empresaId, { lojaId })
      : [];

    const agendamentos = listarAgendamentosBarbearia
      ? listarAgendamentosBarbearia(empresaId, { lojaId })
      : [];

    return carregarBaseConsolidada({
      comandasRecentes: comandas,
      agendamentosRecentes: agendamentos,
      force,
    });
  }

  // Consulta paginada com métricas e filtros
  app.get(BASE, async (req, res) => {
    try {
      const force = req.query?.refresh === '1';
      if (force) invalidarCacheRecuperacao();

      const dados = await getBase(req, force);
      const resultado = consultarClientesRecuperacao(dados, req.query || {});
      res.json({ ok: true, ...resultado });
    } catch (error) {
      console.error('Erro ao consultar clientes para recuperação:', error);
      res.status(500).json({ ok: false, error: 'Não foi possível carregar a lista de recuperação de clientes.' });
    }
  });

  // Exportação em formato CSV
  app.get(`${BASE}/exportar.csv`, async (req, res) => {
    try {
      const dados = await getBase(req, false);
      const { itens } = consultarClientesRecuperacao(dados, { ...(req.query || {}), limite: 50000 });
      const csv = exportarCsvRecuperacao(itens);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="recuperacao-clientes-avec-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Erro ao exportar CSV de recuperação:', error);
      res.status(500).json({ ok: false, error: 'Não foi possível exportar a planilha.' });
    }
  });

  // Histórico de visitas detalhado de um cliente específico
  app.get(`${BASE}/:key/historico`, async (req, res) => {
    try {
      const key = decodeURIComponent(req.params.key);
      const dados = await getBase(req, false);
      const cliente = dados.find((c) => c.key === key);

      if (!cliente) {
        return res.status(404).json({ ok: false, error: 'Cliente não encontrado no histórico.' });
      }

      res.json({
        ok: true,
        cliente: {
          nome: cliente.nome,
          telefone: cliente.telefoneFormatado || cliente.telefone,
          cpf: cliente.cpf,
          totalVisitas: cliente.totalVisitas,
          totalGasto: cliente.totalGasto,
          ticketMedio: cliente.ticketMedio,
          primeiraVisita: cliente.primeiraVisita,
          ultimaVisita: cliente.ultimaVisita,
          diasSemVir: cliente.diasSemVir,
          profissionalPreferido: cliente.profissionalPreferido,
          servicosHabituais: cliente.servicosHabituais,
          tevePacote: cliente.tevePacote,
          servicosExtrasLista: cliente.servicosExtrasLista,
          modeloRecomendado: cliente.modeloRecomendado,
          modeloRotulo: cliente.modeloRotulo,
          mensagemWhatsapp: cliente.mensagemWhatsapp,
        },
        historico: cliente.historicoItens || [],
      });
    } catch (error) {
      console.error('Erro ao buscar histórico do cliente:', error);
      res.status(500).json({ ok: false, error: 'Não foi possível carregar o histórico de visitas do cliente.' });
    }
  });

  // Disparo em massa de Campanha de Recuperação CRM via WhatsApp
  app.post(`${BASE}/disparar`, async (req, res) => {
    try {
      const empresaId = legacyEmpresaId(req);
      const lojaId = legacyLojaId(req);
      const payload = {
        empresaId,
        lojaId,
        ...(req.body || {}),
      };

      const resultado = await dispararCampanhaCRM(payload);
      if (!resultado.ok) {
        return res.status(400).json(resultado);
      }
      res.json(resultado);
    } catch (error) {
      console.error('Erro ao processar disparo de campanha de recuperação:', error);
      res.status(500).json({ ok: false, error: error.message || 'Erro interno ao processar disparo de campanha.' });
    }
  });
}
