import { Router } from 'express';
import {
  obterDadosConcreto,
  criarCargaConcreto,
  atualizarStatusCarga,
  registrarEventoViagem,
  registrarRupturaCorpoProva,
  calcularDosagemAvancada,
  criarPropostaComercial,
  atualizarStatusProposta,
  atualizarStatusVeiculoFrota,
  registrarMovimentacaoInsumoSilo,
  gerarListaTecnicaBOM,
  listarComprasInsumos,
  criarPedidoCompraInsumo,
  registrarRecebimentoPesagemCompra,
  calcularCustoConcretoAvancado,
  listarOrdensProducao,
  criarOrdemProducao,
  concluirOrdemProducao,
  listarMineracao,
  registrarExtracaoDraga,
  emitirRomaneioVendaAgregado,
  calcularEstatisticaResistenciaLote,
  gerarHtmlRomaneioOficial,
  assinarEntregaCarga,
  obterRomaneioCompleto,
  emitirTicketPesagemBalanca,
  gerarHtmlTicketBalanca,
  listarMedicoesObras,
  criarMedicaoObra,
  atualizarStatusMedicao
} from './servico.js';
import { CONCRETO_EMPRESA_ID } from '../../concreto-usina-seed.js';

export function criarRotasConcreto() {
  const router = Router();

  const resolverEmpresa = (req) => {
    return req.empresaId || req.headers['x-empresa-id'] || CONCRETO_EMPRESA_ID;
  };

  // 1. Dados consolidados
  router.get('/dados', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const dados = await obterDadosConcreto(empresaId);
      return res.json(dados);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 2. Lista Técnica / BOM de fabricação de concreto
  router.get('/lista-tecnica', (req, res) => {
    try {
      const listas = gerarListaTecnicaBOM();
      return res.json({ ok: true, listasTecnicas: listas });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 3. Compras de Matérias-Primas
  router.get('/compras', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await listarComprasInsumos(empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/compras', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await criarPedidoCompraInsumo(req.body, empresaId);
      return res.status(201).json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post('/compras/:id/recebimento', async (req, res) => {
    try {
      const resultado = await registrarRecebimentoPesagemCompra(req.params.id, req.body);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 4. Calculadora Industrial de Custos e Formação de Preço
  router.post('/custos/calcular', (req, res) => {
    try {
      const custos = calcularCustoConcretoAvancado(req.body);
      return res.json({ ok: true, custos });
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 5. Ordens de Produção (OP)
  router.get('/ordens-producao', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await listarOrdensProducao(empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/ordens-producao', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await criarOrdemProducao(req.body, empresaId);
      return res.status(201).json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post('/ordens-producao/:id/concluir', async (req, res) => {
    try {
      const resultado = await concluirOrdemProducao(req.params.id, req.body.consumoRealBalança);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 6. Criar nova carga
  router.post('/cargas', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await criarCargaConcreto(req.body, empresaId);
      return res.status(201).json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 7. Atualizar status de uma carga
  router.put('/cargas/:id/status', async (req, res) => {
    try {
      const { status, observacoes } = req.body;
      const resultado = await atualizarStatusCarga(req.params.id, status, observacoes);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 8. Registrar evento de viagem da betoneira (telemetria ao vivo)
  router.post('/cargas/:id/viagens/:index/evento', async (req, res) => {
    try {
      const { evento, horario } = req.body;
      const resultado = await registrarEventoViagem(req.params.id, req.params.index, evento, horario);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 9. Registrar ensaio de ruptura de CP no laboratório
  router.post('/ensaios/:loteId/ruptura', async (req, res) => {
    try {
      const { cpId, idadeDias, tensaoMpa, forcaKn } = req.body;
      const resultado = await registrarRupturaCorpoProva(req.params.loteId, cpId, idadeDias, tensaoMpa, forcaKn);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 10. Calculadora de dosagem NBR 7212
  router.post('/dosagem/calcular', (req, res) => {
    try {
      const dosagem = calcularDosagemAvancada(req.body);
      return res.json({ ok: true, dosagem });
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 11. Criar proposta comercial
  router.post('/propostas', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await criarPropostaComercial(req.body, empresaId);
      return res.status(201).json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 12. Atualizar status de proposta comercial
  router.put('/propostas/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const resultado = await atualizarStatusProposta(req.params.id, status);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 13. Atualizar status de veículo da frota
  router.put('/frota/:id/status', async (req, res) => {
    try {
      const { status, horimetro, motorista } = req.body;
      const resultado = await atualizarStatusVeiculoFrota(req.params.id, status, horimetro, motorista);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 14. Movimentação no silo ou pátio da mineração
  router.post('/silos/:id/movimento', async (req, res) => {
    try {
      const { tipo, quantidade, motivo } = req.body;
      const resultado = await registrarMovimentacaoInsumoSilo(req.params.id, tipo, quantidade, motivo);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });


  // 15. Módulo Serrano Mineração: Listar dragas, pátios e vendas de agregados
  router.get('/mineracao', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await listarMineracao(empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 16. Registrar extração de draga
  router.post('/mineracao/extracao', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { dragaId, volumeM3, horimetro, status, umidadeSuperficial } = req.body;
      const resultado = await registrarExtracaoDraga(dragaId, { volumeM3, horimetro, status, umidadeSuperficial }, empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 17. Emitir romaneio de venda de agregados na balança com CFEM
  router.post('/mineracao/venda-agregados', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await emitirRomaneioVendaAgregado(req.body, empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 18. Controle Estatístico NBR 12655 do lote de ensaio
  router.get('/ensaios/:lote/estatistica', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = calcularEstatisticaResistenciaLote(req.params.lote, empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 19. Gerar Romaneio Oficial NBR 7212 em HTML para visualização e impressão
  router.get('/cargas/:id/romaneio-html', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await gerarHtmlRomaneioOficial(req.params.id, empresaId);
      if (req.query.formato === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(resultado.html);
      }
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 20. Medições de Obras Construtora
  router.get('/medicoes', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await listarMedicoesObras(empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/medicoes', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await criarMedicaoObra(req.body, empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.put('/medicoes/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const resultado = await atualizarStatusMedicao(req.params.id, status);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });


  // 21. Assinatura Digital do Cliente na Entrega da Carga (NBR 7212)
  router.post('/cargas/:id/assinar-entrega', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await assinarEntregaCarga(req.params.id, req.body, empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 22. Obter Romaneio Completo Estruturado
  router.get('/cargas/:id/romaneio', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await obterRomaneioCompleto(req.params.id, empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(404).json({ ok: false, error: e.message });
    }
  });

  // 23. Emissão de Ticket de Pesagem da Balança Rodoviária 80t
  router.post('/balanca/tickets', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await emitirTicketPesagemBalanca(req.body, empresaId);
      return res.status(201).json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 24. Imprimir / Visualizar Ticket de Pesagem da Balança Rodoviária em HTML
  router.get('/balanca/tickets/:id/html', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await gerarHtmlTicketBalanca(req.params.id, empresaId);
      if (req.query.formato === 'html' || !req.headers.accept?.includes('application/json')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(resultado.html);
      }
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  return router;
}
