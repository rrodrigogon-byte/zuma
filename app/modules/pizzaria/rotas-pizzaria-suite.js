/**
 * ============================================================================
 * KYTTO ERP · ROTAS EXPRESS DA SUITE PIZZARIA & FORNERIA ARTESANAL
 * ============================================================================
 */

import { Router } from 'express';
import { enviarMensagem } from '../../core/whatsapp.js';
import { db, save } from '../../db.js';
import {
  eventBus,
  ZONAS_ENTREGA_TANGARA,
  MOTOBOYS_FROTA_PALATARE,
  calcularFretePorBairroOuKm,
  gerarComandaCozinhaEscPos,
  gerarCupomMotoboyEscPos,
  gerarPreviaNfcePizzaria,
  listarCardapioPublico,
  chamarGarcomMesa,
  listarEstoqueInsumos,
  darBaixaInsumosPedido,
  gerarComandasMultiPracas,
  CONFIG_IMPRESSORAS_PRACAS,
  obterEstadoPainelTv,
  obterPerfilFidelidade,
  creditarCashbackPedido
} from './pizzaria-suite-completa.js';
import {
  PALATARE_DADOS_EMPRESA,
  PALATARE_CLIENTES_CRM,
  PALATARE_CONFIG_MONTADOR,
  PALATARE_RODIZIO_CONFIG,
  PALATARE_KDS_FILA,
  PALATARE_DELIVERY_ZONAS,
  PALATARE_METRICAS_BI,
  PALATARE_ENGENHARIA_CMV,
  PALATARE_PIZZA_CLUB,
  PALATARE_TELEMETRIA_FORNO,
  PALATARE_IMPLANTACAO_CHECKLIST,
  PALATARE_EMPRESA_ID
} from '../../palatare-pizzaria-seed.js';


function normalizarPedidoParaSuite(p) {
  if (!p) return null;
  return {
    ...p,
    comanda: p.comanda || p.codigoExibicao || p.id,
    cliente: p.cliente || p.clienteNome || "Cliente Palatare",
    telefone: p.telefone || p.clienteTelefone || "",
    endereco: p.endereco || p.enderecoEntrega || "",
    total: p.total || p.totalGeral || p.subtotal || 0,
    origem: p.origem || p.canalNome || "DELIVERY",
    itens: (p.itens || []).map(it => ({
      ...it,
      nome: it.nome || (it.sabores && it.sabores.length > 0 ? it.sabores.join(" / ") : ("Pizza " + (it.tamanho || "Artesanal"))),
      qtd: it.qtd || it.quantidade || 1,
      valor: it.valor || it.valorUnitario || (it.subtotal ? it.subtotal / (it.qtd || it.quantidade || 1) : 85.00)
    }))
  };
}

function localizarPedidoPizzariaUnificado(data, pedidoId) {
  if (!data || !pedidoId) return null;
  
  // 1. Procurar no KDS
  const pedidoKds = (data.palatare_kds || []).find(p => p.id === pedidoId);
  if (pedidoKds) return normalizarPedidoParaSuite(pedidoKds);

  // 2. Procurar no Hub de Delivery Multicanal
  if (data.pizzaria_delivery_hub) {
    for (const empId of Object.keys(data.pizzaria_delivery_hub)) {
      const p = (data.pizzaria_delivery_hub[empId]?.pedidos || []).find(x => x.id === pedidoId);
      if (p) return normalizarPedidoParaSuite(p);
    }
  }

  // 3. Procurar em pedidos/comandas
  if (data.palatare_pedidos) {
    const p = data.palatare_pedidos.find(x => x.id === pedidoId);
    if (p) return normalizarPedidoParaSuite(p);
  }

  return null;
}

export function criarRotasPizzariaSuite() {
  const router = Router();

  // 1. Dados Consolidados da Suite Pizzaria
  router.get('/dados', async (req, res) => {
    try {
      const data = db();
      const empresa = data.empresas?.[PALATARE_EMPRESA_ID] || PALATARE_DADOS_EMPRESA;
      const clientes = data.palatare_clientes || PALATARE_CLIENTES_CRM;
      const montador = data.palatare_montador || PALATARE_CONFIG_MONTADOR;
      const rodizio = data.palatare_rodizio || PALATARE_RODIZIO_CONFIG;
      const kds = data.palatare_kds || PALATARE_KDS_FILA;
      const delivery = data.palatare_delivery || PALATARE_DELIVERY_ZONAS;
      const metricas = data.palatare_metricas || PALATARE_METRICAS_BI;
      const engenharia = data.palatare_engenharia || PALATARE_ENGENHARIA_CMV;
      const pizzaClub = data.palatare_pizza_club || PALATARE_PIZZA_CLUB;
      const telemetriaForno = data.palatare_forno || PALATARE_TELEMETRIA_FORNO;
      const implantacao = data.palatare_implantacao || PALATARE_IMPLANTACAO_CHECKLIST;

      return res.json({
        ok: true,
        empresa,
        clientes,
        montador,
        rodizio,
        kds,
        delivery,
        metricas,
        engenharia,
        pizzaClub,
        telemetriaForno,
        implantacao,
        zonasEntregaTangara: ZONAS_ENTREGA_TANGARA,
        motoboys: MOTOBOYS_FROTA_PALATARE,
        eventosRecentes: eventBus.historicoEventos.slice(0, 15)
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 2. Criação de Novo Pedido (KDS / Salão / Balcão / Delivery)
  router.post('/pedidos', async (req, res) => {
    try {
      const data = db();
      data.palatare_kds ||= [];
      const novoPedido = {
        id: `pzp-${Date.now()}`,
        comanda: `CMD-${Math.floor(1000 + Math.random() * 9000)}`,
        origem: req.body?.origem || 'Balcão / Pedido Rápido',
        tipo: req.body?.tipo || 'salao',
        cliente: req.body?.cliente || 'Cliente Balcão',
        telefone: req.body?.telefone || '(65) 99999-0000',
        endereco: req.body?.endereco || 'Rua 14, Centro',
        bairro: req.body?.bairro || 'Centro',
        taxaEntrega: Number(req.body?.taxaEntrega || 0),
        formaPagamento: req.body?.formaPagamento || 'Pix WhatsApp',
        pago: Boolean(req.body?.pago ?? true),
        horarioRecebido: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        tempoDecorridoMinutos: 0,
        tempoEstimadoMinutos: req.body?.tempoEstimado || 12,
        status: 'na_bancada',
        praca: 'Bancada do Pizzaiolo',
        itens: req.body?.itens || [],
        total: req.body?.total || 0,
        criadoEm: new Date().toISOString()
      };

      data.palatare_kds.unshift(novoPedido);
      save();

      // Disparar evento no barramento interno
      eventBus.registrarEvento('pedido:criado', novoPedido);

      return res.status(201).json({ ok: true, pedido: novoPedido });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 3. Atualizar Status do KDS (Bancada -> Forno -> Finalização -> Despacho -> Entregue)
  router.patch('/kds/:id/status', async (req, res) => {
    try {
      const data = db();
      const pedido = localizarPedidoPizzariaUnificado(data, req.params.id);
      if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado no KDS' });

      const statusAntigo = pedido.status;
      pedido.status = req.body?.status || pedido.status;
      if (req.body?.praca) pedido.praca = req.body.praca;
      save();

      // Disparar evento
      eventBus.registrarEvento('pedido:status', {
        pedidoId: pedido.id,
        statusAntigo,
        novoStatus: pedido.status,
        praca: pedido.praca
      });

      return res.json({ ok: true, pedido });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 4. Spooler Térmico: Impressão da Comanda de Cozinha (80mm ESC/POS)
  router.post('/pedidos/:id/imprimir-cozinha', async (req, res) => {
    try {
      const data = db();
      const pedido = localizarPedidoPizzariaUnificado(data, req.params.id);
      if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

      const impressao = gerarComandaCozinhaEscPos(pedido);
      eventBus.registrarEvento('impressao:cozinha', { pedidoId: pedido.id, comanda: pedido.comanda });

      return res.json({ ok: true, impressao });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 5. Spooler Térmico: Impressão do Cupom de Entrega para o Motoboy (80mm ESC/POS)
  router.post('/pedidos/:id/imprimir-motoboy', async (req, res) => {
    try {
      const data = db();
      const pedido = localizarPedidoPizzariaUnificado(data, req.params.id);
      if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

      const entregador = MOTOBOYS_FROTA_PALATARE.find(m => m.id === req.body?.motoboyId) || MOTOBOYS_FROTA_PALATARE[0];
      const impressao = gerarCupomMotoboyEscPos(pedido, entregador);
      eventBus.registrarEvento('impressao:motoboy', { pedidoId: pedido.id, motoboy: entregador.nome });

      return res.json({ ok: true, impressao, entregador });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 6. Integração Fiscal: Emissão de NFC-e para o Pedido
  router.post('/pedidos/:id/emitir-nfce', async (req, res) => {
    try {
      const data = db();
      const pedido = localizarPedidoPizzariaUnificado(data, req.params.id);
      if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

      const nfce = gerarPreviaNfcePizzaria(pedido);
      pedido.nfceChave = nfce.chaveAcesso;
      pedido.nfceProtocolo = nfce.protocolo;
      save();

      eventBus.registrarEvento('fiscal:nfce_emitida', {
        pedidoId: pedido.id,
        chaveAcesso: nfce.chaveAcesso,
        protocolo: nfce.protocolo,
        valorTotal: nfce.totais.valorTotal
      });

      return res.json({ ok: true, nfce });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 7. Zonas de Entrega & Cálculo de Frete
  router.get('/delivery/zonas', (req, res) => {
    return res.json({ ok: true, zonas: ZONAS_ENTREGA_TANGARA });
  });

  router.post('/delivery/calcular-frete', (req, res) => {
    const { bairro, distanciaKm } = req.body || {};
    const frete = calcularFretePorBairroOuKm(bairro, distanciaKm);
    return res.json({ ok: true, frete });
  });

  // 8. Frota de Motoboys
  router.get('/delivery/motoboys', (req, res) => {
    return res.json({ ok: true, motoboys: MOTOBOYS_FROTA_PALATARE });
  });

  router.post('/delivery/alocar-motoboy', (req, res) => {
    const { pedidoId, motoboyId } = req.body || {};
    const motoboy = MOTOBOYS_FROTA_PALATARE.find(m => m.id === motoboyId);
    if (!motoboy) return res.status(404).json({ error: 'Motoboy não encontrado' });

    motoboy.status = 'em_rota';
    motoboy.pedidoAtual = pedidoId;

    const data = db();
    const pedido = localizarPedidoPizzariaUnificado(data, pedidoId);
    if (pedido) {
      pedido.status = 'saiu_entrega';
      pedido.praca = `Em rota com ${motoboy.nome}`;
      pedido.motoboyAlocado = motoboy;
      save();
    }

    eventBus.registrarEvento('delivery:motoboy_alocado', { pedidoId, motoboy: motoboy.nome });

    return res.json({ ok: true, motoboy, pedido });
  });

  // 9. Telemetria do Forno Napolitano
  router.get('/forno/telemetria', (req, res) => {
    const data = db();
    const telemetria = data.palatare_forno || PALATARE_TELEMETRIA_FORNO;
    return res.json({ ok: true, telemetria });
  });

  router.post('/forno/leitura', (req, res) => {
    const data = db();
    data.palatare_forno ||= { ...PALATARE_TELEMETRIA_FORNO };
    if (req.body?.temperaturaLastro) data.palatare_forno.temperaturaLastro = req.body.temperaturaLastro;
    if (req.body?.temperaturaCupula) data.palatare_forno.temperaturaCupula = req.body.temperaturaCupula;
    save();

    eventBus.registrarEvento('forno:leitura_termica', data.palatare_forno);
    return res.json({ ok: true, telemetria: data.palatare_forno });
  });

  // 10. Pizza Club (Assinaturas MRR)
  router.get('/pizza-club/dados', (req, res) => {
    const data = db();
    const pizzaClub = data.palatare_pizza_club || PALATARE_PIZZA_CLUB;
    return res.json({ ok: true, pizzaClub });
  });

  router.post('/pizza-club/assinar', (req, res) => {
    const data = db();
    data.palatare_pizza_club ||= { ...PALATARE_PIZZA_CLUB };
    data.palatare_pizza_club.membrosDestaque ||= [];

    const novoMembro = {
      id: `mem-${Date.now()}`,
      nome: req.body?.nome || 'Novo Assinante',
      plano: req.body?.plano || 'Plano Amici (Dupla)',
      desde: new Date().toISOString().slice(0, 7),
      proximaEntrega: '20/11/2026',
      status: 'ativo'
    };

    data.palatare_pizza_club.membrosDestaque.unshift(novoMembro);
    data.palatare_pizza_club.totalAssinantes = (data.palatare_pizza_club.totalAssinantes || 72) + 1;
    save();

    eventBus.registrarEvento('clube:novo_assinante', novoMembro);
    return res.status(201).json({ ok: true, membro: novoMembro });
  });

  // 11. Rodízio: Gestão de Mesas
  router.patch('/rodizio/:mesa/status', async (req, res) => {
    try {
      const data = db();
      const rodizio = data.palatare_rodizio || {};
      const mesas = rodizio.mesasEmRodizioHoje || [];
      const mesa = mesas.find(m => String(m.mesaNumero) === String(req.params.mesa));
      if (!mesa) return res.status(404).json({ error: 'Mesa não encontrada no rodízio' });
      if (req.body?.statusMesa) mesa.statusMesa = req.body.statusMesa;
      if (req.body?.adicionarFatias) mesa.fatiasServidas = (mesa.fatiasServidas || 0) + Number(req.body.adicionarFatias);
      save();

      eventBus.registrarEvento('rodizio:mesa_atualizada', mesa);
      return res.json({ ok: true, mesa });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  router.post('/rodizio/abrir-mesa', async (req, res) => {
    try {
      const data = db();
      data.palatare_rodizio ||= { mesasEmRodizioHoje: [] };
      data.palatare_rodizio.mesasEmRodizioHoje ||= [];
      const mesaNumero = parseInt(req.body?.mesaNumero, 10) || 1;
      const adultos = parseInt(req.body?.adultos, 10) || 2;
      const criancas = parseInt(req.body?.criancas, 10) || 0;
      const jaExiste = data.palatare_rodizio.mesasEmRodizioHoje.find(m => Number(m.mesaNumero) === mesaNumero);

      if (jaExiste) {
        jaExiste.statusMesa = 'servindo';
        jaExiste.adultos = adultos;
        jaExiste.criancas = criancas;
        jaExiste.subtotalConsumo = (adultos * 59.90) + (criancas * 29.90);
        save();
        return res.json({ ok: true, mesa: jaExiste, reaberta: true });
      }

      const novaMesa = {
        mesaNumero,
        horarioInicio: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        adultos,
        criancas,
        fatiasServidas: 0,
        statusMesa: 'servindo',
        subtotalConsumo: (adultos * 59.90) + (criancas * 29.90),
        saboresMaisAclamados: []
      };

      data.palatare_rodizio.mesasEmRodizioHoje.push(novaMesa);
      save();

      eventBus.registrarEvento('rodizio:mesa_aberta', novaMesa);
      return res.status(201).json({ ok: true, mesa: novaMesa });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 12. Implantação: Alternar Tarefa
  router.patch('/implantacao/tarefa/:id', async (req, res) => {
    try {
      const data = db();
      data.palatare_implantacao ||= JSON.parse(JSON.stringify(PALATARE_IMPLANTACAO_CHECKLIST));
      let encontrada = null;
      for (const frente of data.palatare_implantacao.frentes) {
        const t = frente.tarefas.find(item => item.id === req.params.id);
        if (t) {
          t.concluida = req.body?.concluida !== undefined ? Boolean(req.body.concluida) : !t.concluida;
          t.data = new Date().toLocaleDateString('pt-BR');
          encontrada = t;
          const concluidas = frente.tarefas.filter(x => x.concluida).length;
          frente.progresso = Math.round((concluidas / frente.tarefas.length) * 100);
          break;
        }
      }
      if (!encontrada) return res.status(404).json({ error: 'Tarefa de implantação não encontrada' });
      save();
      return res.json({ ok: true, tarefa: encontrada, implantacao: data.palatare_implantacao });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 13. Eventos do Barramento Interno
  router.get('/eventos', (req, res) => {
    return res.json({ ok: true, eventos: eventBus.historicoEventos });
  });


  // 14. Gestão de Insumos Críticos & Farinha 00
  router.get('/estoque-insumos', (req, res) => {
    return res.json({ ok: true, estoque: listarEstoqueInsumos() });
  });

  router.post('/dar-baixa-insumos', (req, res) => {
    const pedido = req.body || {};
    const estoqueAtualizado = darBaixaInsumosPedido(pedido);
    return res.json({ ok: true, mensagem: 'Baixa de insumos realizada com sucesso!', estoque: estoqueAtualizado });
  });

  // 15. Roteamento Multi-Impressoras (Forno / Bar / Caixa)
  router.get('/spooler/multi-pracas/:pedidoId', (req, res) => {
    const data = db();
    const pedidos = data.palatare_pedidos_kds || PALATARE_KDS_FILA;
    const pedido = pedidos.find(p => p.id === req.params.pedidoId) || {
      id: req.params.pedidoId,
      cliente: 'Dr. Ricardo Mendonça',
      mesa: 'Mesa 04',
      itens: [{ nome: 'Pizza Filé Mignon ao Gorgonzola (8 Fatias)', preco: 92.00 }]
    };
    const comandas = gerarComandasMultiPracas(pedido);
    return res.json({ ok: true, comandas });
  });

  router.get('/spooler/config-pracas', (req, res) => {
    return res.json({ ok: true, pracas: CONFIG_IMPRESSORAS_PRACAS });
  });

  // 16. Painel TV de Senhas & Chamadas Balcão
  router.get('/painel-tv', (req, res) => {
    return res.json({ ok: true, painel: obterEstadoPainelTv() });
  });

  // 17. Programa de Fidelidade Palatare Pass
  router.get('/fidelidade/:telefone', (req, res) => {
    const perfil = obterPerfilFidelidade(req.params.telefone);
    return res.json({ ok: true, perfil });
  });

  router.post('/fidelidade/creditar', (req, res) => {
    const { telefone, valor } = req.body || {};
    const resultado = creditarCashbackPedido(telefone, Number(valor || 100));
    return res.json({ ok: true, ...resultado });
  });

  return router;
}

export function criarRotasPizzariaPublico() {
  const router = Router();

  // Cardápio Público Digital (WhatsApp / QR Mesa)
  router.get('/cardapio', (req, res) => {
    return res.json({ ok: true, cardapio: listarCardapioPublico() });
  });

  // Chamar Garçom da Mesa
  router.post('/mesa/:numero/chamar-garcom', (req, res) => {
    const notificacao = chamarGarcomMesa(req.params.numero, req.body?.motivo);
    return res.json({ ok: true, notificacao, mensagem: 'Garçom notificado com sucesso!' });
  });

  // Painel TV de Senhas Público (para Telas e TVs de Salão)
  router.get('/painel-tv', (req, res) => {
    return res.json({ ok: true, painel: obterEstadoPainelTv() });
  });

  // Consulta de Saldo Palatare Pass / Cashback
  router.get('/fidelidade/:telefone', (req, res) => {
    const perfil = obterPerfilFidelidade(req.params.telefone);
    return res.json({ ok: true, perfil });
  });

  return router;
}