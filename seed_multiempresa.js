import { db, save } from './app/db.js';
import { gravarPendenteAgora } from './app/db.js';
import * as caixaKytto from './app/caixa-diario-kytto.js';
import * as financeiroKytto from './app/financeiro-central-kytto.js';

const hoje = new Date().toLocaleDateString('sv', { timeZone: 'America/Cuiaba' });

// 1. STALLONE NUTRE SPORT (Varejo / Suplementos)
const empStallone = '31f70c83-9172-40c2-945f-9e793b5048be';
const lojaStallone = '6a15e943-2570-4f29-a2d5-d900d2812911';

// Caixas Stallone
const cxStallone1 = caixaKytto.abrirCaixa(empStallone, {
  lojaId: lojaStallone,
  data: hoje,
  numeroCaixa: 1,
  nomeCaixa: 'Caixa Balcão Varejo (Loja Matriz)',
  valorAbertura: 200.00,
  responsavel: 'Eduardo Stallone',
});

// Vendas Loja no db().vendasLoja
const d = db();
d.vendasLoja = d.vendasLoja || [];
d.vendasLoja.push(
  {
    id: `venda-stallone-101`,
    empresaId: empStallone,
    numero: 101,
    data: hoje,
    clienteNome: 'Rodrigo Gonçalves',
    vendedor: 'Eduardo Stallone',
    status: 'paga',
    formaPagamento: 'pix',
    total: 289.90,
    itens: [
      { nome: 'Whey Protein Isolado 900g', quantidade: 1, preco: 219.90 },
      { nome: 'Creatina Creapure 300g', quantidade: 1, preco: 70.00 },
    ],
  },
  {
    id: `venda-stallone-102`,
    empresaId: empStallone,
    numero: 102,
    data: hoje,
    clienteNome: 'Mariana Duarte',
    vendedor: 'Eduardo Stallone',
    status: 'paga',
    formaPagamento: 'cartao_credito',
    total: 145.00,
    itens: [
      { nome: 'Pré-Treino C4 Beta Pump', quantidade: 1, preco: 145.00 },
    ],
  }
);

financeiroKytto.registrarLancamento(empStallone, {
  tipo: 'receita',
  categoria: 'Venda de Suplementos',
  descricao: 'Vendas balcão loja PDV #101 e #102',
  valor: 434.90,
  status: 'pago',
  meioPagamento: 'pix',
  dataOperacao: hoje,
  pagoEm: hoje,
  lojaId: lojaStallone,
});

financeiroKytto.fecharDia(empStallone, '2026-11-04', 'Eduardo Stallone', {
  lojaId: lojaStallone,
  observacao: 'Fechamento diário de suplementos quarta-feira',
  resumoOperacao: {
    faturamentoTotal: 4120.00,
    totalRecebidoBalcao: 4120.00,
    totalEmConta: 0,
    totalDespesasPagas: 380.00,
    saldoLiquidoDia: 3740.00,
    caixasFechados: 1,
    conciliacaoStatus: 'conciliado',
  },
});

// 2. AGRO OPEN TTC (Bar / Restaurante)
const empAgro = '2e041110-db20-4fd1-8278-12bd3dead008';
const lojaAgro = '17b057ab-a13f-4fee-ae42-bc70578ec756';

const cxAgro1 = caixaKytto.abrirCaixa(empAgro, {
  lojaId: lojaAgro,
  data: hoje,
  numeroCaixa: 1,
  nomeCaixa: 'Caixa Bar Central (Choperia & Porções)',
  valorAbertura: 300.00,
  responsavel: 'Barman Chefe',
});

d.bar_comandas = d.bar_comandas || [];
d.bar_comandas.push(
  {
    id: `comanda-bar-201`,
    empresaId: empAgro,
    numero: 201,
    nome: 'Mesa 04 · Varanda',
    clienteNome: 'Mesa 04 (Família Silva)',
    atendente: 'Garçom Paulo',
    status: 'paga',
    fechadaEm: hoje,
    total: 184.00,
    meioPagamento: 'cartao_debito',
    itens: [
      { nome: 'Chopp Pilsen Artesanal 500ml', quantidade: 4, preco: 16.00 },
      { nome: 'Porção de Picanha na Chapa com Mandioca', quantidade: 1, preco: 120.00 },
    ],
  },
  {
    id: `comanda-bar-202`,
    empresaId: empAgro,
    numero: 202,
    nome: 'Mesa 12 · Deck',
    clienteNome: 'Mesa 12 (Torneio Beach)',
    atendente: 'Garçom Paulo',
    status: 'paga',
    fechadaEm: hoje,
    total: 96.00,
    meioPagamento: 'pix',
    itens: [
      { nome: 'Balde de Cerveja Heineken (6 un)', quantidade: 1, preco: 78.00 },
      { nome: 'Água sem Gás 500ml', quantidade: 3, preco: 6.00 },
    ],
  }
);

financeiroKytto.registrarLancamento(empAgro, {
  tipo: 'receita',
  categoria: 'Bar e Restaurante',
  descricao: 'Consumo mesas bar e choperia',
  valor: 280.00,
  status: 'pago',
  meioPagamento: 'cartao_debito',
  dataOperacao: hoje,
  pagoEm: hoje,
  lojaId: lojaAgro,
});

financeiroKytto.fecharDia(empAgro, '2026-11-04', 'Gerente Agro Open', {
  lojaId: lojaAgro,
  observacao: 'Fechamento bar e choperia quarta-feira',
  resumoOperacao: {
    faturamentoTotal: 5890.00,
    totalRecebidoBalcao: 5890.00,
    totalEmConta: 0,
    totalDespesasPagas: 850.00,
    saldoLiquidoDia: 5040.00,
    caixasFechados: 1,
    conciliacaoStatus: 'conciliado',
  },
});

save();
gravarPendenteAgora();
console.log('✅ Stallone Nutre Sport e AGRO OPEN TTC semeados com sucesso com caixas, comandas e histórico!');
