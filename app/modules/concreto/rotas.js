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
  gerarHtmlLaudoOficial,
  assinarEntregaCarga,
  obterRomaneioCompleto,
  emitirTicketPesagemBalanca,
  gerarHtmlTicketBalanca,
  obterStatusBalancaAutomacao,
  executarComandoBalanca,
  registrarEntradaVeiculo,
  concluirSegundaPesagemBalanca,
  listarTicketsBalanca,
  obterConfiguracoesBalanca,
  salvarConfiguracoesBalanca,
  listarMedicoesObras,
  criarMedicaoObra,
  atualizarStatusMedicao,
  ajustarUmidadeBaia,
  reabastecerSiloOuTanque,
  dosarBateladaProcesso,
  obterNotasFiscaisVendas,
  emitirNotaFiscalConcreto,
  entregarNotaFiscal,
  gerarDanfeHtml,
  obterRecomendacoesKyttoIA,
  consultarKyttoIAConcreto,
  listarChecklistsFrota,
  salvarChecklistVeiculo,
  obterDadosRecicladorConcreto,
  registrarConcretoResidual,
  obterAuditoriaMetrologicaBalancas,
  obterRotasGpsFrota,
  obterTelemetriaCelulasToledo,
  calcularCartasControleEstatisticoNbr12655,
  gerarHtmlLaudoAceitacaoEstatistica,
  otimizarTracoSustentavel,
  calcularCurvaMaturidadeAstmC1074,
  obterComparativoResistenciaNbr5739PorTraco,
  analisarEscalaProgramacaoKyttoIA,
  aplicarEscalaSugeridaKyttoIA,
  obterTelemetriaFrotaTempoReal,
  atualizarTelemetriaBetoneira
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
    // 9b. Emitir Laudo Oficial A4 em HTML para impressão ou visualização (NBR 5739)
  router.get('/ensaios/:loteId/laudo/html', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const html = await gerarHtmlLaudoOficial(req.params.loteId, empresaId);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (e) {
      return res.status(404).send(`<h1>Erro ao gerar Laudo Técnico NBR 5739</h1><p>${e.message}</p>`);
    }
  });

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

  // 25. Obter Status da Balança Rodoviária 80t, Automação, Semáforos e Cancelas
  router.get('/balanca/status', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await obterStatusBalancaAutomacao(empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 26. Executar Comando Remoto na Balança Rodoviária 80t (Cancelas, Semáforos, etc.)
  router.post('/balanca/comando', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { comando, payload } = req.body;
      const resultado = await executarComandoBalanca(comando, payload, empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 27. Listar Todos os Tickets de Balança Rodoviária com Filtros
  router.get('/balanca/tickets', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await listarTicketsBalanca(empresaId, req.query);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 28. Registrar 1ª Pesagem (Entrada de Veículo no Pátio)
  router.post('/balanca/entrada', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await registrarEntradaVeiculo(req.body, empresaId);
      return res.status(201).json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 29. Concluir 2ª Pesagem (Saída e Emissão de Ticket com Líquido)
  router.post('/balanca/saida', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await concluirSegundaPesagemBalanca(req.body, empresaId);
      return res.status(201).json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 30. Obter Configurações da Balança Rodoviária 80t
  router.get('/balanca/configuracoes', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await obterConfiguracoesBalanca(empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 31. Salvar Configurações da Balança Rodoviária 80t
  router.post('/balanca/configuracoes', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const resultado = await salvarConfiguracoesBalanca(req.body, empresaId);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });


  // 32. Suprimentos e Silos - Ajuste de Umidade da Areia (NBR 7212)
  router.post('/suprimentos-silos/umidade', async (req, res) => {
    try {
      const { baiaId, umidadePercent } = req.body;
      const resultado = await ajustarUmidadeBaia(baiaId, umidadePercent);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 33. Suprimentos e Silos - Recebimento de Matéria-Prima
  router.post('/suprimentos-silos/reabastecer', async (req, res) => {
    try {
      const resultado = await reabastecerSiloOuTanque(req.body);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 34. Controle de Processo - Dosagem Automática de Batelada
  router.post('/processo-producao/dosar-batelada', async (req, res) => {
    try {
      const resultado = await dosarBateladaProcesso(req.body);
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 35. Suprimentos e Silos - Listagem consolidada
  router.get('/suprimentos-silos', async (req, res) => {
    try {
      const dados = await obterDadosConcreto(resolverEmpresa(req));
      return res.json({
        ok: true,
        silos: dados.silos || [],
        baias: dados.baias || [],
        tanques: dados.tanques || [],
        entradasSuprimentos: dados.entradasSuprimentos || []
      });
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 36. Módulo de Vendas & Notas Fiscais (NF-e / NFS-e) - Listagem e Resumos
  router.get('/vendas/notas', async (req, res) => {
    try {
      const resultado = await obterNotasFiscaisVendas(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 37. Emissão de Nova Nota Fiscal Integrada à Balança 80t e Romaneio
  router.post('/vendas/emitir-nota', async (req, res) => {
    try {
      const resultado = await emitirNotaFiscalConcreto(req.body, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 38. Visualização do DANFE A4 em HTML Oficial
  router.get('/vendas/notas/:id/danfe-html', async (req, res) => {
    try {
      const html = await gerarDanfeHtml(req.params.id, resolverEmpresa(req));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (e) {
      return res.status(400).send(`<h3>Erro ao gerar DANFE: ${e.message}</h3>`);
    }
  });

  // 39. Entrega Multicanal da Nota Fiscal (WhatsApp / E-mail)
  router.post('/vendas/notas/:id/entregar', async (req, res) => {
    try {
      const { canal, destinatario } = req.body || {};
      const resultado = await entregarNotaFiscal(req.params.id, canal, destinatario, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 40. Telemetria das 8 Células de Carga Toledo da Balança Rodoviária 80t
  router.get('/balanca/celulas/telemetria', async (req, res) => {
    try {
      const peso = req.query.peso ? Number(req.query.peso) : 0;
      const telemetria = obterTelemetriaCelulasToledo(peso);
      return res.json(telemetria);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });


  // 41. Copilot KyttoIA Industrial - Diagnósticos e Consultas Técnicas NBR 7212
  router.get('/ia/recomendacoes', async (req, res) => {
    try {
      const resultado = await obterRecomendacoesKyttoIA(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post('/ia/consultar', async (req, res) => {
    try {
      const { pergunta, contexto } = req.body || {};
      const resultado = await consultarKyttoIAConcreto(pergunta, contexto, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 42. Checklist Digital Pré-Operacional da Frota (NR-11 / NR-12)
  router.get('/frota/checklists', async (req, res) => {
    try {
      const resultado = await listarChecklistsFrota(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post('/frota/checklists', async (req, res) => {
    try {
      const resultado = await salvarChecklistVeiculo(req.body, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 43. Gestão de Concreto Residual e Reciclador Ecológico (CONAMA / NBR 15575)
  router.get('/sustentabilidade/reciclador', async (req, res) => {
    try {
      const resultado = await obterDadosRecicladorConcreto(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post('/sustentabilidade/reciclador/registrar', async (req, res) => {
    try {
      const resultado = await registrarConcretoResidual(req.body, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 44. Auditoria de Precisão Metrológica das 4 Balanças da Central Convicta (NBR 7212)
  router.get('/central/metrologia-auditoria', async (req, res) => {
    try {
      const resultado = await obterAuditoriaMetrologicaBalancas(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 45. Rastreamento GPS da Frota em Tangará da Serra/MT
  router.get('/frota/gps-rotas', async (req, res) => {
    try {
      const resultado = await obterRotasGpsFrota(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });


  // 46. Controle Estatístico NBR 12655 com Cartas de Shewhart e CUSUM
  router.get('/laboratorio/estatistica-nbr12655', (req, res) => {
    try {
      const resultado = calcularCartasControleEstatisticoNbr12655(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 47. Laudo Oficial de Aceitação Estatística ABNT NBR 12655 em HTML Timbrado
  router.get('/laboratorio/laudos/:id/aceitacao-html', async (req, res) => {
    try {
      const html = await gerarHtmlLaudoAceitacaoEstatistica(req.params.id, resolverEmpresa(req));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (e) {
      return res.status(400).send(`<h3>Erro ao gerar Laudo NBR 12655: ${e.message}</h3>`);
    }
  });

  // 48. Otimizador de Traços Sustentáveis & Pegada de Carbono (Meta BOxCrete)
  router.post('/tracos/otimizar-sustentavel', (req, res) => {
    try {
      const resultado = otimizarTracoSustentavel(req.body, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 49. Simulador de Maturidade In-Situ ASTM C1074 (Nurse-Saul & Arrhenius)
  router.get('/laboratorio/maturidade-curva', (req, res) => {
    try {
      const dados = {
        fckProjetoMpa: req.query.fck ? Number(req.query.fck) : 30,
        temperaturaAmbienteC: req.query.temp ? Number(req.query.temp) : 31
      };
      const resultado = calcularCurvaMaturidadeAstmC1074(dados, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post('/laboratorio/maturidade-curva', (req, res) => {
    try {
      const resultado = calcularCurvaMaturidadeAstmC1074(req.body, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });


  // 50. Comparativo de Resistência NBR 5739 dos Corpos de Prova por Traço
  router.get("/laboratorio/resistencia-por-traco", (req, res) => {
    try {
      const resultado = obterComparativoResistenciaNbr5739PorTraco(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 50. Otimizador KyttoIA de Escala de Betoneiras & Previsão de Gargalos
  router.post('/programacao/escala-kyttoia/analisar', async (req, res) => {
    try {
      const resultado = await analisarEscalaProgramacaoKyttoIA(req.body, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post('/programacao/escala-kyttoia/aplicar', async (req, res) => {
    try {
      const { sugestoes } = req.body;
      const resultado = await aplicarEscalaSugeridaKyttoIA(sugestoes, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  // 51. Telemetria e Rastreamento em Tempo Real das Betoneiras (RPM Balão & Cronômetro Pega NBR 7212)
  router.get('/frota/telemetria-tempo-real', async (req, res) => {
    try {
      const resultado = await obterTelemetriaFrotaTempoReal(resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post('/frota/telemetria/:codigo/atualizar', async (req, res) => {
    try {
      const resultado = await atualizarTelemetriaBetoneira(req.params.codigo, req.body, resolverEmpresa(req));
      return res.json(resultado);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  });

  return router;
}
