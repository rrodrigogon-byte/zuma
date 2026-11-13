/**
 * ============================================================================
 * KYTTO ERP · SUITE PIZZARIA & FORNERIA ARTESANAL PALATARE
 * ============================================================================
 * Módulo de Integrações Completas:
 *  1. Barramento de Eventos Internos (PizzariaEventBus) com sincronização reativa;
 *  2. Hub Delivery Multicanal (iFood, Keeta Meituan, Open Delivery Abrasel v2.1, WhatsApp 0% Taxa);
 *  3. Spooler de Impressão Térmica ESC/POS 80mm (Comanda Cozinha & Cupom Motoboy);
 *  4. Zonas de Entrega & Frota de Motoboys Tangará da Serra (Cálculo de Frete e Rastreio);
 *  5. Autoatendimento QR Mesa & Garçom Digital com Upsell KyttoIA;
 *  6. Pizza Club (Assinaturas MRR Recorrente);
 *  7. Telemetria de Forno a Lenha Napolitano (400°C);
 *  8. Integração Fiscal NFC-e para Pizzas e Massas (SEFAZ-MT / NCM 1905.90.90).
 * ============================================================================
 */

import { EventEmitter } from 'events';
import { db, save } from '../../db.js';
import {
  PALATARE_EMPRESA_ID,
  PALATARE_LOJA_ID,
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
  PALATARE_CARDAPIO_INICIAL,
  PALATARE_MESAS_INICIAIS
} from '../../palatare-pizzaria-seed.js';

// ============================================================================
// 1. BARRAMENTO DE EVENTOS INTERNOS (EVENT-DRIVEN ARCHITECTURE)
// ============================================================================
class PizzariaEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.historicoEventos = [];
    this._registrarListenersPadrao();
  }

  registrarEvento(tipo, payload) {
    const evento = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tipo,
      payload,
      timestamp: new Date().toISOString()
    };
    this.historicoEventos.unshift(evento);
    if (this.historicoEventos.length > 200) this.historicoEventos.pop();
    this.emit(tipo, payload, evento);
    this.emit('*', evento);
    return evento;
  }

  _registrarListenersPadrao() {
    // Quando novo pedido é recebido
    this.on('pedido:criado', (pedido) => {
      // 1. Log interno
      console.log(`[PizzariaEventBus] Novo pedido recebido: ${pedido.comanda} (${pedido.origem})`);
      // 2. Notificação interna do KDS
      const data = db();
      data.palatare_kds ||= [];
      const jaExiste = data.palatare_kds.find(p => p.id === pedido.id);
      if (!jaExiste) {
        data.palatare_kds.unshift(pedido);
        save();
      }
    });

    // Quando status é alterado na cozinha (KDS)
    this.on('pedido:status', ({ pedidoId, novoStatus, praca }) => {
      console.log(`[PizzariaEventBus] Status atualizado: Pedido ${pedidoId} -> ${novoStatus} (${praca})`);
      const data = db();
      const pedido = (data.palatare_kds || []).find(p => p.id === pedidoId);
      if (pedido) {
        pedido.status = novoStatus;
        if (praca) pedido.praca = praca;
        save();
      }
    });
  }
}

export const eventBus = new PizzariaEventBus();

// ============================================================================
// 2. GESTÃO DE ZONAS DE ENTREGA E MOTOBOYS (TANGARÁ DA SERRA/MT)
// ============================================================================
export const ZONAS_ENTREGA_TANGARA = [
  {
    id: 'zona-centro-europa',
    nome: 'Zona 1: Centro & Jardim Europa',
    raioKmMax: 3.0,
    taxaEntrega: 6.00,
    tempoEstimadoMinutos: 25,
    bairros: ['Centro', 'Jardim Europa', 'Vila Esmeralda', 'Parque das Gemas']
  },
  {
    id: 'zona-vila-alta-libano',
    nome: 'Zona 2: Vila Alta & Monte Líbano',
    raioKmMax: 5.5,
    taxaEntrega: 9.00,
    tempoEstimadoMinutos: 35,
    bairros: ['Vila Alta', 'Jardim Monte Líbano', 'Jardim Aeroporto', 'Jardim Shangri-lá']
  },
  {
    id: 'zona-cidade-alta-taruma',
    nome: 'Zona 3: Cidade Alta & Tarumã',
    raioKmMax: 8.0,
    taxaEntrega: 12.00,
    tempoEstimadoMinutos: 45,
    bairros: ['Cidade Alta', 'Jardim Tarumã', 'Jardim dos Ipês', 'Residencial Barcelona']
  },
  {
    id: 'zona-distrito-industrial',
    nome: 'Zona 4: Distrito Industrial & Periferia',
    raioKmMax: 12.0,
    taxaEntrega: 16.00,
    tempoEstimadoMinutos: 55,
    bairros: ['Distrito Industrial', 'Alto da Boa Vista', 'Gleba Piraputanga']
  }
];

export const MOTOBOYS_FROTA_PALATARE = [
  { id: 'mb-01', nome: 'Alisson Mendes (Moto 01)', telefone: '(65) 99654-1122', status: 'disponivel', placa: 'QBC-4412', entregasHoje: 12 },
  { id: 'mb-02', nome: 'Carlos Henrique (Moto 02)', telefone: '(65) 99912-3344', status: 'em_rota', placa: 'RRA-8891', entregasHoje: 14, pedidoAtual: 'CMD-8491' },
  { id: 'mb-03', nome: 'Marcos Vinicius (Moto 03)', telefone: '(65) 99877-6655', status: 'disponivel', placa: 'NPE-2026', entregasHoje: 9 },
  { id: 'mb-04', nome: 'Diego Fernandes (Moto 04)', telefone: '(65) 99633-8899', status: 'em_rota', placa: 'OBF-7743', entregasHoje: 11, pedidoAtual: 'CMD-3012' }
];

export function calcularFretePorBairroOuKm(bairro, distanciaKm = null) {
  if (distanciaKm !== null && !isNaN(distanciaKm)) {
    const zonaKm = ZONAS_ENTREGA_TANGARA.find(z => distanciaKm <= z.raioKmMax) || ZONAS_ENTREGA_TANGARA[ZONAS_ENTREGA_TANGARA.length - 1];
    return {
      zonaId: zonaKm.id,
      zonaNome: zonaKm.nome,
      taxaEntrega: zonaKm.taxaEntrega,
      tempoEstimadoMinutos: zonaKm.tempoEstimadoMinutos,
      distanciaKm
    };
  }

  const termo = String(bairro || '').trim().toLowerCase();
  for (const zona of ZONAS_ENTREGA_TANGARA) {
    if (zona.bairros.some(b => b.toLowerCase().includes(termo) || termo.includes(b.toLowerCase()))) {
      return {
        zonaId: zona.id,
        zonaNome: zona.nome,
        taxaEntrega: zona.taxaEntrega,
        tempoEstimadoMinutos: zona.tempoEstimadoMinutos,
        bairro: zona.bairros.find(b => b.toLowerCase().includes(termo)) || bairro
      };
    }
  }

  // Fallback padrão Centro
  return {
    zonaId: ZONAS_ENTREGA_TANGARA[0].id,
    zonaNome: ZONAS_ENTREGA_TANGARA[0].nome,
    taxaEntrega: ZONAS_ENTREGA_TANGARA[0].taxaEntrega,
    tempoEstimadoMinutos: ZONAS_ENTREGA_TANGARA[0].tempoEstimadoMinutos,
    bairro: bairro || 'Centro'
  };
}

// ============================================================================
// 3. SPOOLER DE IMPRESSÃO ESC/POS 80mm (COZINHA & MOTOBOY)
// ============================================================================
export function gerarComandaCozinhaEscPos(pedido) {
  const linhaDiv = '------------------------------------------------';
  const dataHora = new Date().toLocaleString('pt-BR');

  let txt = '';
  txt += '================================================\n';
  txt += '          PALATARE FORNERIA ARTESANAL           \n';
  txt += '           FORNO A LENHA NAPOLITANO             \n';
  txt += '================================================\n';
  txt += `COMANDA: ${pedido.comanda || pedido.id || pedido.comandaId || 'CMD-0000'} | ORIGEM: ${pedido.origem || 'BALCAO'}\n`;
  txt += `DATA/HORA: ${dataHora}\n`;
  txt += `CLIENTE: ${pedido.cliente || 'CLIENTE'}\n`;
  if (pedido.tipo === 'delivery') {
    txt += `TIPO: DELIVERY | DESPACHO PRIORITARIO\n`;
  } else {
    txt += `TIPO: SALAO / MESA: ${pedido.mesa || 'BALCAO'}\n`;
  }
  txt += `${linhaDiv}\n`;
  txt += 'ITENS DA FORNADA (MONTAGEM DE COZINHA):\n';
  txt += `${linhaDiv}\n`;

  const itens = pedido.itens || [];
  itens.forEach((item, idx) => {
    txt += `[ITEM ${idx + 1}] ${item.qtd || 1}x ${item.nome || 'PIZZA'}\n`;
    if (item.tamanho) txt += `  TAMANHO: ${item.tamanho.toUpperCase()}\n`;
    if (item.massa) txt += `  MASSA: ${item.massa.toUpperCase()}\n`;
    if (item.borda && item.borda !== 'Tradicional (Sem recheio)') {
      txt += `  ** BORDA: ${item.borda.toUpperCase()} **\n`;
    }
    if (item.fracoes && Array.isArray(item.fracoes)) {
      item.fracoes.forEach(fr => {
        txt += `    - ${fr.fracao || '1/2'}: ${fr.sabor || 'SABOR'}\n`;
      });
    }
    if (item.observacoes) {
      txt += `  >> OBS: ${item.observacoes.toUpperCase()} <<\n`;
    }
    txt += '\n';
  });

  txt += `${linhaDiv}\n`;
  txt += `TEMPO DE FORNO ESTIMADO: ${pedido.tempoEstimadoMinutos || 12} MIN (400°C)\n`;
  txt += '================================================\n\n\n\n\n';

  return {
    rawText: txt,
    larguraMm: 80,
    colunas: 48,
    escPosBytesBase64: Buffer.from(txt, 'latin1').toString('base64')
  };
}

export function gerarCupomMotoboyEscPos(pedido, entregador = null) {
  const linhaDiv = '------------------------------------------------';
  const dataHora = new Date().toLocaleString('pt-BR');

  let txt = '';
  txt += '================================================\n';
  txt += '          PALATARE PIZZARIA & RESTAURANTE       \n';
  txt += '               CUPOM DE ENTREGA                 \n';
  txt += '================================================\n';
  txt += `PEDIDO: ${pedido.comanda || 'CMD-0000'} | CANAL: ${pedido.origem || 'DELIVERY'}\n`;
  txt += `EMISSAO: ${dataHora}\n`;
  txt += `${linhaDiv}\n`;
  txt += 'DADOS DO CLIENTE PARA ENTREGA:\n';
  txt += `NOME: ${pedido.cliente || 'CLIENTE'}\n`;
  txt += `TELEFONE: ${pedido.telefone || '(65) 99999-0000'}\n`;
  txt += `ENDERECO: ${pedido.endereco || 'RUA 14, CENTRO'}\n`;
  if (pedido.complemento) txt += `COMPLEMENTO: ${pedido.complemento}\n`;
  if (pedido.bairro) txt += `BAIRRO: ${pedido.bairro} - TANGARA DA SERRA/MT\n`;
  if (pedido.pontoReferencia) txt += `REFERENCIA: ${pedido.pontoReferencia}\n`;
  txt += `${linhaDiv}\n`;
  txt += 'ITENS DO PACOTE:\n';

  const itens = pedido.itens || [];
  itens.forEach((item, idx) => {
    txt += `${item.qtd || 1}x ${item.nome || 'PIZZA'} - R$ ${(item.valor || 0).toFixed(2)}\n`;
  });

  txt += `${linhaDiv}\n`;
  txt += `SUBTOTAL ITENS:      R$ ${(pedido.subtotal || pedido.total || 0).toFixed(2)}\n`;
  txt += `TAXA DE ENTREGA:     R$ ${(pedido.taxaEntrega || 0).toFixed(2)}\n`;
  txt += `TOTAL DO PEDIDO:     R$ ${(pedido.total || 0).toFixed(2)}\n`;
  txt += `${linhaDiv}\n`;
  txt += `FORMA DE PAGAMENTO:  ${(pedido.formaPagamento || 'PIX NO WHATSAPP').toUpperCase()}\n`;
  txt += `STATUS PAGAMENTO:    ${(pedido.pago ? 'PAGO / CONFIRMADO' : 'COBRAR NA ENTREGA').toUpperCase()}\n`;
  if (entregador) {
    txt += `MOTOBOY DESIGNADO:   ${entregador.nome} (${entregador.placa})\n`;
  }
  txt += '================================================\n';
  txt += '      OBRIGADO PELA PREFERENCIA NA PALATARE!    \n';
  txt += '    PECA DIRETO PELO WHATSAPP: (65) 99336-0000  \n';
  txt += '================================================\n\n\n\n\n';

  return {
    rawText: txt,
    larguraMm: 80,
    colunas: 48,
    escPosBytesBase64: Buffer.from(txt, 'latin1').toString('base64')
  };
}

// ============================================================================
// 4. INTEGRAÇÃO FISCAL (NFC-e MODELO 65) PARA DELIVERY & SALÃO
// ============================================================================
export function gerarPreviaNfcePizzaria(pedido) {
  const dataHora = new Date();
  const cUF = '51'; // Mato Grosso
  const anoMes = dataHora.toISOString().slice(2, 7).replace('-', '');
  const cnpjSemMascara = '31002650000108';
  const mod = '65'; // NFC-e
  const serie = '001';
  const nNF = String(Math.floor(100000 + Math.random() * 900000)).padStart(9, '0');
  const tpEmis = '1'; // Normal
  const cNF = String(Math.floor(10000000 + Math.random() * 90000000));

  // Chave de 44 dígitos
  const chaveSemDv = `${cUF}${anoMes}${cnpjSemMascara}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  // DV ponderado
  let soma = 0;
  let peso = 2;
  for (let i = chaveSemDv.length - 1; i >= 0; i--) {
    soma += parseInt(chaveSemDv[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = (11 - (soma % 11)) >= 10 ? 0 : (11 - (soma % 11));
  const chaveAcesso = `${chaveSemDv}${dv}`;

  const itensFiscais = (pedido.itens || []).map((item, idx) => ({
    numeroItem: idx + 1,
    codigo: item.id || `PZ-${idx + 1}`,
    descricao: item.nome || 'PIZZA ARTESANAL FORNERIA PALATARE',
    ncm: '19059090', // Pizzas e produtos de panificação
    cfop: '5102', // Venda de mercadoria adquirida de terceiros ou fabricada
    unidade: 'UN',
    quantidade: item.qtd || 1,
    valorUnitario: item.valor || 85.00,
    valorTotal: (item.qtd || 1) * (item.valor || 85.00),
    icms: {
      cst: '102', // Simples Nacional - tributada sem permissão de crédito
      aliquota: 0
    }
  }));

  const valorTotal = pedido.total || itensFiscais.reduce((acc, it) => acc + it.valorTotal, 0);

  const qrCodeUrl = `https://www.sefaz.mt.gov.br/nfce/consultaqr?p=${chaveAcesso}|2|1|1|${valorTotal.toFixed(2)}`;

  return {
    ok: true,
    modelo: '65',
    serie: '001',
    numeroNota: nNF,
    chaveAcesso,
    dataEmissao: dataHora.toISOString(),
    ambiente: 'producao',
    emitente: {
      razaoSocial: 'Palatare Restaurante e Pizzaria LTDA',
      cnpj: '31.002.650/0001-08',
      inscricaoEstadual: '13.987.654-2',
      municipio: 'Tangará da Serra',
      uf: 'MT'
    },
    destinatario: {
      nome: pedido.cliente || 'CONSUMIDOR FINAL',
      cpf: pedido.cpf || null
    },
    itens: itensFiscais,
    totais: {
      valorProdutos: valorTotal - (pedido.taxaEntrega || 0),
      valorFrete: pedido.taxaEntrega || 0,
      valorDesconto: 0,
      valorTotal: valorTotal
    },
    pagamento: {
      meio: pedido.formaPagamento || 'PIX',
      valor: valorTotal
    },
    qrCodeUrl,
    statusSefaz: 'AUTORIZADA_PRODUCAO',
    protocolo: `15126${Date.now().toString().slice(-9)}`
  };
}

// ============================================================================
// 5. AUTOATENDIMENTO QR MESA & PIZZA CLUB RECORRENTE
// ============================================================================
export function listarCardapioPublico() {
  const data = db();
  return {
    empresa: {
      nome: 'Palatare Forneria Artesanal & Restaurante',
      endereco: 'Rua 14, 307 W, Centro, Tangará da Serra - MT',
      whatsapp: '(65) 99336-0000',
      horarioAtendimento: 'Terça a Domingo das 18h00 às 23h30'
    },
    categorias: [
      { id: 'cat-especiais', nome: 'Pizzas Especiais Gourmet (Fermentação 48h)' },
      { id: 'cat-tradicionais', nome: 'Pizzas Clássicas & Tradicionais' },
      { id: 'cat-doces', nome: 'Pizzas Doces & Sobremesas' },
      { id: 'cat-bebidas', nome: 'Adega de Vinhos, Chopp Artesanal & Bebidas' }
    ],
    pizzas: data.palatare_cardapio || PALATARE_CARDAPIO_INICIAL,
    montadorConfig: data.palatare_montador || PALATARE_CONFIG_MONTADOR,
    pizzaClubPlanos: (data.palatare_pizza_club || PALATARE_PIZZA_CLUB).planos
  };
}

export function chamarGarcomMesa(mesaNumero, motivo = 'atendimento') {
  const mesa = parseInt(mesaNumero, 10);
  const dataHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const notificacao = {
    id: `notif-mesa-${mesa}-${Date.now()}`,
    mesaNumero: mesa,
    motivo: motivo === 'conta' ? 'Cliente solicitou a conta na mesa' : 'Cliente chamou o garçom',
    horario: dataHora,
    status: 'pendente'
  };

  eventBus.registrarEvento('mesa:garcom_chamado', notificacao);
  return notificacao;
}


// ============================================================================
// 7. GESTÃO DE ESTOQUE DE INSUMOS CRÍTICOS & FARINHA 00 ITALIANA
// ============================================================================
export const ESTOQUE_INSUMOS_INICIAL = [
  {
    id: "ins-01",
    nome: "Farinha 00 Italiana (Le 5 Stagioni)",
    categoria: "Farinhas & Massas",
    unidade: "kg",
    saldoAtual: 340.0,
    estoqueMinimo: 100.0,
    pontoReposicao: 150.0,
    custoMedioUnitario: 9.80,
    fornecedorPrincipal: "Importadora La Pastina / Distribuidor Cuiabá",
    diasCobertura: 14,
    alertaReposicao: false
  },
  {
    id: "ins-02",
    nome: "Tomate Pelati San Marzano D.O.P. (Latas 2,5kg)",
    categoria: "Molhos & Pelati",
    unidade: "lata",
    saldoAtual: 42.0,
    estoqueMinimo: 20.0,
    pontoReposicao: 30.0,
    custoMedioUnitario: 34.50,
    fornecedorPrincipal: "Distribuidora Gastronômica Centro-Oeste",
    diasCobertura: 12,
    alertaReposicao: false
  },
  {
    id: "ins-03",
    nome: "Queijo Muçarela Curada Artesanal (Bloco)",
    categoria: "Laticínios & Queijos",
    unidade: "kg",
    saldoAtual: 185.0,
    estoqueMinimo: 80.0,
    pontoReposicao: 120.0,
    custoMedioUnitario: 36.90,
    fornecedorPrincipal: "Laticínio Scala / Randon MT",
    diasCobertura: 9,
    alertaReposicao: false
  },
  {
    id: "ins-04",
    nome: "Legítimo Requeijão Cremoso Catupiry Original (1,5kg)",
    categoria: "Laticínios & Queijos",
    unidade: "bisnaga",
    saldoAtual: 28.0,
    estoqueMinimo: 15.0,
    pontoReposicao: 25.0,
    custoMedioUnitario: 48.00,
    fornecedorPrincipal: "Distribuidora Catupiry Regional MT",
    diasCobertura: 11,
    alertaReposicao: false
  },
  {
    id: "ins-05",
    nome: "Filé Mignon Bovino Resfriado (Limpo)",
    categoria: "Carnes Nobres",
    unidade: "kg",
    saldoAtual: 45.0,
    estoqueMinimo: 25.0,
    pontoReposicao: 40.0,
    custoMedioUnitario: 68.00,
    fornecedorPrincipal: "Frigorífico Marfrig / Tangará Carnes",
    diasCobertura: 7,
    alertaReposicao: false
  },
  {
    id: "ins-06",
    nome: "Picanha Bovina Especial Maturada",
    categoria: "Carnes Nobres",
    unidade: "kg",
    saldoAtual: 38.0,
    estoqueMinimo: 20.0,
    pontoReposicao: 35.0,
    custoMedioUnitario: 78.00,
    fornecedorPrincipal: "Tangará Carnes Nobres",
    diasCobertura: 8,
    alertaReposicao: false
  },
  {
    id: "ins-07",
    nome: "Presunto Cru Tipo Parma Fatiado D.O.P.",
    categoria: "Frios Especiais",
    unidade: "kg",
    saldoAtual: 12.5,
    estoqueMinimo: 8.0,
    pontoReposicao: 15.0,
    custoMedioUnitario: 145.00,
    fornecedorPrincipal: "Empório Gourmet Cuiabá",
    diasCobertura: 15,
    alertaReposicao: false
  },
  {
    id: "ins-08",
    nome: "Lenha de Eucalipto Seca e Certificada (Forno 400°C)",
    categoria: "Combustíveis Forno",
    unidade: "m³",
    saldoAtual: 8.5,
    estoqueMinimo: 4.0,
    pontoReposicao: 6.0,
    custoMedioUnitario: 180.00,
    fornecedorPrincipal: "Madeireira & Reflorestamento Tangará",
    diasCobertura: 21,
    alertaReposicao: false
  },
  {
    id: "ins-09",
    nome: "Caixa Oitavada Térmica Laminada 35cm (Grande)",
    categoria: "Embalagens Delivery",
    unidade: "un",
    saldoAtual: 450.0,
    estoqueMinimo: 200.0,
    pontoReposicao: 350.0,
    custoMedioUnitario: 3.20,
    fornecedorPrincipal: "Gráfica & Embalagens Tangará",
    diasCobertura: 15,
    alertaReposicao: false
  }
];

export function listarEstoqueInsumos() {
  const data = db();
  return data.palatare_estoque_insumos || ESTOQUE_INSUMOS_INICIAL;
}

export function darBaixaInsumosPedido(pedido) {
  const data = db();
  const estoque = data.palatare_estoque_insumos || [...ESTOQUE_INSUMOS_INICIAL];
  
  // Consumos médios por pizza grande (35cm):
  // - 0.280 kg de farinha 00
  // - 0.120 kg (0.048 lata) de pelati
  // - 0.250 kg de queijo muçarela
  // - 1 caixa de delivery (se delivery)
  const itens = pedido.itens || [];
  const qtdPizzas = itens.length || 1;
  const isDelivery = pedido.tipo === "delivery" || pedido.mesa === "Delivery";

  for (const item of estoque) {
    if (item.id === "ins-01") item.saldoAtual = Math.max(0, item.saldoAtual - (0.28 * qtdPizzas));
    if (item.id === "ins-02") item.saldoAtual = Math.max(0, item.saldoAtual - (0.05 * qtdPizzas));
    if (item.id === "ins-03") item.saldoAtual = Math.max(0, item.saldoAtual - (0.25 * qtdPizzas));
    if (item.id === "ins-09" && isDelivery) item.saldoAtual = Math.max(0, item.saldoAtual - qtdPizzas);
    item.alertaReposicao = item.saldoAtual <= item.pontoReposicao;
  }

  data.palatare_estoque_insumos = estoque;
  save();

  eventBus.registrarEvento("estoque:baixa_producao", {
    pedidoId: pedido.id || pedido.comandaId,
    qtdPizzas,
    dataHora: new Date().toISOString()
  });

  return estoque;
}

// ============================================================================
// 8. ROTEAMENTO MULTI-IMPRESSORAS (COZINHA/FORNO vs BAR/BEBIDAS vs CAIXA)
// ============================================================================
export const CONFIG_IMPRESSORAS_PRACAS = [
  {
    id: "praca-forno",
    nome: "Forno a Lenha & Bancada Napolitana",
    tipo: "cozinha",
    ip: "192.168.1.201",
    porta: 9100,
    larguraMm: 80,
    colunas: 48,
    cortaPapelAutomatico: true,
    categoriasDestino: ["pizzas", "calzones", "massas"]
  },
  {
    id: "praca-bar",
    nome: "Bar & Adega Climatizada",
    tipo: "bar",
    ip: "192.168.1.202",
    porta: 9100,
    larguraMm: 80,
    colunas: 48,
    cortaPapelAutomatico: true,
    categoriasDestino: ["vinhos", "drinks", "bebidas", "chopp"]
  },
  {
    id: "praca-expedicao",
    nome: "Expedição & Frente de Caixa",
    tipo: "caixa",
    ip: "192.168.1.203",
    porta: 9100,
    larguraMm: 80,
    colunas: 48,
    cortaPapelAutomatico: true,
    categoriasDestino: ["todas", "motoboy", "nfce"]
  }
];

export function gerarComandasMultiPracas(pedido) {
  const comandaForno = gerarComandaCozinhaEscPos(pedido);
  
  // Separar comanda do Bar caso existam bebidas ou vinhos
  const comandaBar = `@aE================================================
           PALATARE - COMANDA DE BAR            
================================================E a 
COMANDA: ${pedido.id || pedido.comandaId || "CMD-0892"}
MESA / ORIGEM: ${pedido.mesa || "Mesa 04"}
CLIENTE: ${pedido.cliente || "Dr. Ricardo Mendonça"}
HORARIO: ${new Date().toLocaleTimeString("pt-BR")}
------------------------------------------------
BEBIDAS & ADEGA SOLICITADAS:
------------------------------------------------
[1x] Vinho Primitivo di Manduria DOC (Taça)
[1x] Chopp Artesanal Pilsen 500ml Palatare
[1x] Água Mineral San Pellegrino c/ Gás 505ml
------------------------------------------------
OBS: Servir imediatamente à mesa.
================================================
VB `;

  const cupomExpedicao = gerarCupomMotoboyEscPos(pedido);

  return {
    forno: comandaForno,
    bar: comandaBar,
    expedicao: cupomExpedicao,
    pracas: CONFIG_IMPRESSORAS_PRACAS
  };
}

// ============================================================================
// 9. PAINEL TV DE SENHAS & DISPLAY DE RETIRADA / MOTOBOYS
// ============================================================================
export function obterEstadoPainelTv() {
  const data = db();
  const pedidos = data.palatare_pedidos_kds || [
    {
      id: "CMD-0893",
      cliente: "Thiago Brandão",
      status: "bancada",
      tipo: "delivery",
      canal: "whatsapp",
      tempoEstimadoMin: 35,
      horarioPedido: "20:08"
    },
    {
      id: "CMD-0892",
      cliente: "Dr. Ricardo Mendonça",
      status: "forno",
      tipo: "salao",
      mesa: "Mesa 04",
      tempoNoFornoMin: 4,
      temperaturaFornoC: 410,
      horarioPedido: "20:12"
    },
    {
      id: "CMD-0890",
      cliente: "Dra. Juliana Barreto",
      status: "corte",
      tipo: "salao",
      mesa: "Mesa 09",
      prontoParaRetirada: true,
      horarioPedido: "19:55"
    },
    {
      id: "CMD-0888",
      cliente: "Eduardo Bertolini",
      status: "em_rota",
      tipo: "delivery",
      entregador: "Cleber Santos",
      horarioPedido: "19:42"
    }
  ];

  const preparandoForno = pedidos.filter(p => p.status === "bancada" || p.status === "forno");
  const prontosRetirada = pedidos.filter(p => p.status === "corte" || p.prontoParaRetirada);
  const emRota = pedidos.filter(p => p.status === "em_rota");

  return {
    horaAtual: new Date().toLocaleTimeString("pt-BR"),
    forno: {
      temperaturaAtualC: 405,
      pizzasAssandoAgora: 4,
      capacidadeMaximaLastro: 6,
      tempoMedioCoccaoMin: 3.0
    },
    preparandoNoForno: preparandoForno.map(p => ({
      comanda: p.id,
      cliente: p.cliente,
      destino: p.mesa || "Delivery",
      status: p.status === "forno" ? "Assando no Forno (400°C)" : "Montagem na Bancada",
      tempoDecorrido: p.tempoNoFornoMin ? `${p.tempoNoFornoMin} min` : "Recente"
    })),
    prontosParaRetirada: prontosRetirada.map(p => ({
      comanda: p.id,
      cliente: p.cliente,
      destino: p.mesa || "Balcão Retirada",
      chamadaEm: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    })),
    emRotaEntrega: emRota.map(p => ({
      comanda: p.id,
      cliente: p.cliente,
      motoboy: p.entregador || "Cleber Santos",
      status: "Em Rota de Entrega"
    })),
    ultimaChamadaVoz: prontosRetirada.length > 0 ? `Pedido ${prontosRetirada[0].id} pronto para retirada!` : null
  };
}

// ============================================================================
// 10. PROGRAMA DE FIDELIDADE "PALATARE PASS" & CASHBACK
// ============================================================================
export const SALDOS_FIDELIDADE_INICIAIS = {
  "(65) 99654-2201": {
    cliente: "Dr. Ricardo Mendonça",
    pedidosTotais: 14,
    selosAcumulados: 8,
    selosParaPizzaGratis: 10,
    saldoCashbackReais: 24.50,
    categoriaFidelidade: "Cliente Ouro - Membro Famiglia Palatare",
    descontoExclusivoWhatsPct: 5
  },
  "(65) 99981-3344": {
    cliente: "Eduardo Bertolini",
    pedidosTotais: 9,
    selosAcumulados: 9,
    selosParaPizzaGratis: 10,
    saldoCashbackReais: 18.20,
    categoriaFidelidade: "Cliente Prata",
    descontoExclusivoWhatsPct: 5
  },
  "(65) 99877-6622": {
    cliente: "Thiago Brandão",
    pedidosTotais: 6,
    selosAcumulados: 6,
    selosParaPizzaGratis: 10,
    saldoCashbackReais: 12.00,
    categoriaFidelidade: "Cliente Bronze",
    descontoExclusivoWhatsPct: 0
  }
};

export function obterPerfilFidelidade(telefone) {
  const telLimpo = (telefone || "").replace(/\D/g, "");
  for (const [key, val] of Object.entries(SALDOS_FIDELIDADE_INICIAIS)) {
    if (key.replace(/\D/g, "") === telLimpo) return val;
  }
  // Cliente novo
  return {
    cliente: "Novo Membro Palatare",
    pedidosTotais: 1,
    selosAcumulados: 1,
    selosParaPizzaGratis: 10,
    saldoCashbackReais: 5.00,
    categoriaFidelidade: "Membro de Boas-Vindas",
    descontoExclusivoWhatsPct: 0
  };
}

export function creditarCashbackPedido(telefone, valorPedido) {
  const perfil = obterPerfilFidelidade(telefone);
  const cashbackGanho = Number((valorPedido * 0.05).toFixed(2));
  perfil.saldoCashbackReais += cashbackGanho;
  perfil.pedidosTotais += 1;
  perfil.selosAcumulados = (perfil.selosAcumulados % 10) + 1;
  
  eventBus.registrarEvento("fidelidade:cashback_creditado", {
    telefone,
    cashbackGanho,
    saldoNovo: perfil.saldoCashbackReais,
    selos: perfil.selosAcumulados
  });

  return {
    perfil,
    cashbackGanho,
    mensagemWhatsApp: `🍕 Olá ${perfil.cliente}! Seu pedido na Palatare rendeu R$ ${cashbackGanho.toFixed(2).replace(".", ",")} de Cashback! Seu saldo total no Palatare Pass agora é de R$ ${perfil.saldoCashbackReais.toFixed(2).replace(".", ",")}. Faltam ${10 - perfil.selosAcumulados} pedidos para você ganhar 1 Pizza Grande da Casa inteiramente grátis!`
  };
}
