import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as lojaModa from './loja-moda-ia.js';

test('Loja de Moda IA: ciclo completo de catálogo, grade, malinhas, crediário e IA', async () => {
  const empresaId = 'test_empresa_moda_' + Date.now();

  // 1. Popular e listar produtos
  const est = lojaModa.popularSeedModa(empresaId);
  assert.ok(est.produtos.length >= 5, 'Deve carregar pelo menos 5 produtos iniciais com grade');

  const produtos = lojaModa.listarProdutosModa(empresaId);
  assert.ok(produtos.length >= 5, 'Deve listar produtos da empresa');
  const camisa = produtos.find(p => p.id === 'prod_linho_riviera');
  assert.ok(camisa, 'Camisa linho deve existir');
  assert.ok(camisa.variantes.length > 0, 'Deve ter variantes na grade Cor x Tamanho');

  // 2. Criar novo produto com grade
  const novoProduto = lojaModa.criarProdutoComGrade(empresaId, {
    produto_nome: 'Vestido Seda Estampado',
    referencia: 'VSE-777',
    categoria: 'Vestidos',
    genero: 'feminino',
    estilo: 'Festa / Gala',
    tecido: 'Seda Pura',
    preco_custo: 200,
    preco_venda: 599.90,
    cores: ['Bordô / Vinho', 'Preto'],
    tamanhos: ['P', 'M', 'G'],
    estoque_inicial_por_celula: 4
  });
  assert.equal(novoProduto.variantes.length, 6, '2 cores x 3 tamanhos = 6 variantes');
  assert.equal(novoProduto.estoque_total, 24, '6 variantes x 4 unidades = 24');

  // 3. Atualizar estoque de uma variante
  const primeiraVariante = novoProduto.variantes[0];
  const att = lojaModa.atualizarEstoqueVariante(empresaId, {
    varianteId: primeiraVariante.id,
    quantidade: 10,
    operacao: 'definir'
  });
  assert.equal(att.variante.estoque, 10, 'Estoque deve ser atualizado para 10');

  // 4. Condicionais (Malinhas)
  const conds = lojaModa.listarCondicionais(empresaId);
  assert.ok(conds.length >= 1, 'Deve listar malinhas em aberto');
  const novaCond = lojaModa.criarCondicional(empresaId, {
    cliente_nome: 'Sra. Mariana Guimarães',
    cliente_telefone: '(14) 99888-7766',
    vendedor_nome: 'Letícia (Consultora VIP)',
    prazo_devolucao_dias: 3,
    itens: [
      { nome: 'Vestido Seda Estampado', cor: 'Preto', tamanho: 'M', preco: 599.90, qtd: 1 }
    ]
  });
  assert.equal(novaCond.status, 'em_aberto');
  assert.equal(novaCond.valor_total, 599.90);

  const finalizada = lojaModa.finalizarCondicional(empresaId, novaCond.id, { acao: 'converter_venda' });
  assert.equal(finalizada.status, 'convertido_venda');

  // 5. Crediário próprio
  const creds = lojaModa.listarCrediario(empresaId);
  assert.ok(creds.length >= 1, 'Deve ter clientes no crediário');
  const novoCred = lojaModa.criarCrediario(empresaId, {
    cliente_nome: 'Carlos Drummond',
    cliente_cpf: '123.456.789-00',
    valor_total: 900,
    entrada: 300,
    num_parcelas: 3
  });
  assert.equal(novoCred.saldo_devedor, 600, 'Saldo deve ser 900 - 300 = 600');
  assert.equal(novoCred.parcelas.length, 3, 'Deve gerar 3 parcelas de 200');

  const pg = lojaModa.pagarParcelaCrediario(empresaId, novoCred.id);
  assert.equal(pg.cliente.saldo_devedor, 400, 'Saldo devedor deve reduzir para 400');
  assert.equal(pg.parcelaPaga.status, 'pago');

  // 6. Vales-Presente
  const vale = lojaModa.emitirVale(empresaId, { valor: 300, comprador_nome: 'Paula', destinatario_nome: 'Bruna' });
  assert.equal(vale.status, 'ativo');
  assert.equal(vale.valor, 300);
  const usado = lojaModa.utilizarVale(empresaId, vale.id);
  assert.equal(usado.status, 'utilizado');
  assert.equal(usado.saldo, 0);

  // 7. Resumo Executivo da Loja
  const resumo = lojaModa.obterResumoLojaModa(empresaId);
  assert.ok(resumo.kpis.totalProdutos >= 6);
  assert.ok(resumo.kpis.estoquePecas > 0);
  assert.ok(resumo.kpis.valorEstoqueVenda > 0);

  // 8. Inteligência Artificial de Moda (Fashion AI Engine)
  const lookIA = await lojaModa.montarLookIA(empresaId, { pecaId: camisa.id, ocasiao: 'Casamento Diurno' });
  assert.ok(lookIA.nomeLook.includes(camisa.nome));
  assert.ok(lookIA.pecasComplementares.length > 0);
  assert.ok(lookIA.dicaStylingIA.length > 20);
  assert.ok(lookIA.argumentoVendaBalcao.length > 20);

  const copyIA = await lojaModa.gerarDescricaoProdutoIA(empresaId, { produtoId: camisa.id });
  assert.ok(copyIA.tituloEcom.length > 10);
  assert.ok(copyIA.postInstagram.includes('#Moda'));
  assert.ok(copyIA.detalhesTecnicos.length >= 3);

  const diagGrade = lojaModa.diagnosticoGradePrevisaoIA(empresaId);
  assert.ok(diagGrade.saudeEstoqueScore > 0);
  assert.ok(diagGrade.recomendacoesEstrategicasIA.length >= 2);

  const msgWhats = lojaModa.gerarMensagemWhatsappIA({
    tipo: 'lembrete_malinha',
    clienteNome: 'Mariana'
  });
  assert.ok(msgWhats.texto.includes('Mariana'));
  assert.ok(msgWhats.texto.includes('malinha'));
});
