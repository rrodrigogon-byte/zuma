import { db, save } from './app/db.js';
import { gravarPendenteAgora } from './app/db.js';
import * as caixaKytto from './app/caixa-diario-kytto.js';
import * as barbeariaErpKytto from './app/barbearia-erp-kytto.js';
import * as financeiroKytto from './app/financeiro-central-kytto.js';
import * as clientesKytto from './app/clientes-contas-kytto.js';
import { DINO_EMPRESA_CANONICA } from './app/dino-fechamento-conciliacao.js';

const hoje = new Date().toLocaleDateString('sv', { timeZone: 'America/Cuiaba' });

console.log('Populando dados realistas de Fechamento Diário para Dino e Stallone na data:', hoje);

const empresaDino = DINO_EMPRESA_CANONICA;
const lojaDino = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';

// 1. Cadastros Mestres da Dino
const srvs = barbeariaErpKytto.listarServicos(empresaDino);
const srvCorte = srvs.find(s => s.nome.includes('Corte')) || barbeariaErpKytto.criarServico(empresaDino, { nome: 'Corte Degradê Navalhado', preco: 60.00, duracaoMinutos: 35 });
const srvBarba = srvs.find(s => s.nome.includes('Barba')) || barbeariaErpKytto.criarServico(empresaDino, { nome: 'Barba Terapia com Toalha Quente', preco: 45.00, duracaoMinutos: 30 });
const srvCombo = srvs.find(s => s.nome.includes('Cabelo e Barba')) || barbeariaErpKytto.criarServico(empresaDino, { nome: 'Cabelo e Barba Dino', preco: 95.00, duracaoMinutos: 60 });
const srvSobrancelha = srvs.find(s => s.nome.includes('Sobrancelha')) || barbeariaErpKytto.criarServico(empresaDino, { nome: 'Design de Sobrancelha', preco: 30.00, duracaoMinutos: 15 });

const prods = barbeariaErpKytto.listarProdutosRevenda(empresaDino);
const prodPomada = prods.find(p => p.nome.includes('Pomada')) || barbeariaErpKytto.criarProdutoRevenda(empresaDino, { nome: 'Pomada Modeladora Efeito Matte', precoVenda: 40.00, estoqueAtual: 25 });
const prodOleo = prods.find(p => p.nome.includes('Óleo')) || barbeariaErpKytto.criarProdutoRevenda(empresaDino, { nome: 'Óleo para Barba Amadeirado', precoVenda: 35.00, estoqueAtual: 18 });
const prodShampoo = prods.find(p => p.nome.includes('Shampoo')) || barbeariaErpKytto.criarProdutoRevenda(empresaDino, { nome: 'Shampoo Anticaspa Mentolado', precoVenda: 45.00, estoqueAtual: 12 });

const profs = barbeariaErpKytto.listarProfissionais(empresaDino);
const profDino = profs.find(p => p.nome.includes('Dino')) || barbeariaErpKytto.criarProfissional(empresaDino, { nome: 'Dino Master Barber' });
const profLucas = profs.find(p => p.nome.includes('Lucas')) || barbeariaErpKytto.criarProfissional(empresaDino, { nome: 'Lucas Barbeiro' });

// 2. Caixas da Dino
const caixasExistentes = caixaKytto.listarCaixas(empresaDino, { data: hoje });
const cx1 = caixasExistentes.find(c => c.numeroCaixa === 1 && c.status === 'aberto') || caixaKytto.abrirCaixa(empresaDino, {
  lojaId: lojaDino,
  data: hoje,
  numeroCaixa: 1,
  nomeCaixa: 'Caixa Balcão 01 (Principal)',
  valorAbertura: 150.00,
  responsavel: 'Jhenyffer Andrade',
});

const cx2 = caixasExistentes.find(c => c.numeroCaixa === 2 && c.status === 'aberto') || caixaKytto.abrirCaixa(empresaDino, {
  lojaId: lojaDino,
  data: hoje,
  numeroCaixa: 2,
  nomeCaixa: 'Caixa Balcão 02 (Atendimento Rápido)',
  valorAbertura: 100.00,
  responsavel: 'Amanda Gabrielly',
});

// Suprimento e Sangria no Caixa 1
caixaKytto.registrarMovimento(empresaDino, {
  caixaId: cx1.id,
  lojaId: lojaDino,
  tipo: 'suprimento',
  valor: 50.00,
  descricao: 'Fundo de troco complementar cedido pelo gerente',
  usuario: 'Jhenyffer Andrade',
});

caixaKytto.registrarMovimento(empresaDino, {
  caixaId: cx1.id,
  lojaId: lojaDino,
  tipo: 'sangria',
  valor: 30.00,
  descricao: 'Retirada para compra de café e insumos da recepção',
  usuario: 'Jhenyffer Andrade',
});

// 3. Comandas da Dino
// Comanda 1: Corte + Pomada = R$ 100 em Dinheiro no Caixa 1
const cmd1 = barbeariaErpKytto.criarComandaBarbearia(empresaDino, {
  lojaId: lojaDino,
  data: hoje,
  clienteNome: 'Marcos Vinicius Rezende',
  clienteTelefone: '65998123456',
  profissionalId: profDino.id,
  itens: [
    { tipo: 'servico', servicoId: srvCorte.id, nome: srvCorte.nome, preco: 60.00, quantidade: 1 },
    { tipo: 'produto', produtoId: prodPomada.id, nome: prodPomada.nome, preco: 40.00, quantidade: 1 },
  ],
});
barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaDino, cmd1.id, {
  confirmado: true,
  lojaId: lojaDino,
  usuario: 'Jhenyffer Andrade',
  pagamentos: [{ meio: 'dinheiro', valor: cmd1.total, caixaId: cx1.id }],
});

// Comanda 2: Barba + Óleo = R$ 80 no PIX
const cmd2 = barbeariaErpKytto.criarComandaBarbearia(empresaDino, {
  lojaId: lojaDino,
  data: hoje,
  clienteNome: 'Rafael Nogueira',
  clienteTelefone: '65996543210',
  profissionalId: profLucas.id,
  itens: [
    { tipo: 'servico', servicoId: srvBarba.id, nome: srvBarba.nome, preco: 45.00, quantidade: 1 },
    { tipo: 'produto', produtoId: prodOleo.id, nome: prodOleo.nome, preco: 35.00, quantidade: 1 },
  ],
});
barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaDino, cmd2.id, {
  confirmado: true,
  lojaId: lojaDino,
  usuario: 'Amanda Gabrielly',
  pagamentos: [{ meio: 'pix', valor: cmd2.total }],
});

// Comanda 3: Cabelo e Barba Dino = R$ 95 no Cartão de Débito (Mastercard)
const cmd3 = barbeariaErpKytto.criarComandaBarbearia(empresaDino, {
  lojaId: lojaDino,
  data: hoje,
  clienteNome: 'Lucas Silveira',
  clienteTelefone: '65997891234',
  profissionalId: profDino.id,
  itens: [
    { tipo: 'servico', servicoId: srvCombo.id, nome: srvCombo.nome, preco: 95.00, quantidade: 1 },
  ],
});
barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaDino, cmd3.id, {
  confirmado: true,
  lojaId: lojaDino,
  usuario: 'Jhenyffer Andrade',
  pagamentos: [{ meio: 'debito', valor: cmd3.total, bandeira: 'Mastercard' }],
});

// Comanda 4: Shampoo + Sobrancelha = R$ 75 no Cartão de Crédito (Visa)
const cmd4 = barbeariaErpKytto.criarComandaBarbearia(empresaDino, {
  lojaId: lojaDino,
  data: hoje,
  clienteNome: 'Carlos Eduardo Mendes',
  clienteTelefone: '65992345678',
  profissionalId: profLucas.id,
  itens: [
    { tipo: 'servico', servicoId: srvSobrancelha.id, nome: srvSobrancelha.nome, preco: 30.00, quantidade: 1 },
    { tipo: 'produto', produtoId: prodShampoo.id, nome: prodShampoo.nome, preco: 45.00, quantidade: 1 },
  ],
});
barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaDino, cmd4.id, {
  confirmado: true,
  lojaId: lojaDino,
  usuario: 'Jhenyffer Andrade',
  pagamentos: [{ meio: 'credito', valor: cmd4.total, bandeira: 'Visa' }],
});

// Comanda 5: Corte + Barba = R$ 105 Lançado em Conta (Crediário)
const clienteThiago = clientesKytto.criarCliente(empresaDino, {
  nome: 'Thiago Mendonça',
  telefone: '65993456789',
  limiteCredito: 1000.00,
  saldoDevedor: 0,
  lojaId: lojaDino,
});

const cmd5 = barbeariaErpKytto.criarComandaBarbearia(empresaDino, {
  lojaId: lojaDino,
  data: hoje,
  clienteId: clienteThiago.id,
  clienteNome: clienteThiago.nome,
  clienteTelefone: clienteThiago.telefone,
  profissionalId: profDino.id,
  itens: [
    { tipo: 'servico', servicoId: srvCorte.id, nome: srvCorte.nome, preco: 60.00, quantidade: 1 },
    { tipo: 'servico', servicoId: srvBarba.id, nome: srvBarba.nome, preco: 45.00, quantidade: 1 },
  ],
});
barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaDino, cmd5.id, {
  confirmado: true,
  lojaId: lojaDino,
  usuario: 'Jhenyffer Andrade',
  pagamentos: [{ meio: 'conta', valor: cmd5.total }],
});

// 4. Lançamento de Despesa no ERP (Café e limpeza = R$ 30)
financeiroKytto.registrarLancamento(empresaDino, {
  tipo: 'despesa',
  categoria: 'Insumos e Manutenção',
  descricao: 'Compra de pó de café, copos descartáveis e papel toalha',
  valor: 30.00,
  status: 'pago',
  meioPagamento: 'dinheiro',
  dataOperacao: hoje,
  pagoEm: hoje,
  lojaId: lojaDino,
});

// 5. Histórico de Fechamentos anteriores
const ontem = new Date();
ontem.setDate(ontem.getDate() - 1);
const dataOntem = ontem.toLocaleDateString('sv', { timeZone: 'America/Cuiaba' });

const anteontem = new Date();
anteontem.setDate(anteontem.getDate() - 2);
const dataAnteontem = anteontem.toLocaleDateString('sv', { timeZone: 'America/Cuiaba' });

financeiroKytto.fecharDia(empresaDino, dataOntem, 'Jhenyffer Andrade', {
  lojaId: lojaDino,
  observacao: 'Fechamento oficial de quarta-feira sem divergências',
  resumoOperacao: {
    faturamentoTotal: 3420.00,
    totalRecebidoBalcao: 3100.00,
    totalEmConta: 320.00,
    totalDespesasPagas: 240.00,
    saldoLiquidoDia: 2860.00,
    caixasFechados: 2,
    conciliacaoStatus: 'conciliado',
  },
});

financeiroKytto.fecharDia(empresaDino, dataAnteontem, 'Jhenyffer Andrade', {
  lojaId: lojaDino,
  observacao: 'Fechamento oficial de terça-feira auditado',
  resumoOperacao: {
    faturamentoTotal: 2890.00,
    totalRecebidoBalcao: 2740.00,
    totalEmConta: 150.00,
    totalDespesasPagas: 180.00,
    saldoLiquidoDia: 2560.00,
    caixasFechados: 2,
    conciliacaoStatus: 'conciliado',
  },
});

// Salva banco
save();
gravarPendenteAgora();
console.log('✅ Dados semeados com sucesso! Faturamento hoje:', 100 + 80 + 95 + 75 + 105, 'em 5 comandas e 2 caixas.');
