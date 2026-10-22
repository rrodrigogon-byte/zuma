import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';
import * as compras from './barbearia-compras-kytto.js';

const EMP = 'emp-compras';
const DEST_CNPJ = '11222333000181';
const OUTRA_CHAVE = '51261050073355000260550010000012351000012349';
beforeEach(() => {
  reset();
  db().cadastrosMestresKytto = { empresas: { [EMP]: { id: EMP, cnpj: DEST_CNPJ } } };
});
afterEach(() => reset());

const CHAVE = '51261050073355000260550010000012341000012341';
function xmlNota({ chave = CHAVE, itens } = {}) {
  const det = (itens || [
    { n: 1, cProd: 'P-POM', ean: '7891234567895', xProd: 'POMADA MODELADORA 120G', qCom: '6.0000', vUnCom: '20.00', vProd: '120.00', vDesc: '12.00' },
    { n: 2, cProd: 'P-OLEO', ean: 'SEM GTIN', xProd: 'Óleo para barba 30ml', qCom: '4', vUnCom: '15.00', vProd: '60.00' },
    { n: 3, cProd: 'BRINDE', ean: '', xProd: 'Display promocional', qCom: '1', vUnCom: '0.01', vProd: '0.01' },
  ]).map((i) => `<det nItem="${i.n}"><prod><cProd>${i.cProd}</cProd><cEAN>${i.ean}</cEAN><xProd>${i.xProd}</xProd><NCM>33059000</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>${i.qCom}</qCom><vUnCom>${i.vUnCom}</vUnCom><vProd>${i.vProd}</vProd>${i.vDesc ? `<vDesc>${i.vDesc}</vDesc>` : ''}</prod></det>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${chave}" versao="4.00"><ide><serie>1</serie><nNF>1234</nNF><dhEmi>2026-10-10T10:00:00-04:00</dhEmi></ide><emit><CNPJ>50073355000260</CNPJ><xNome>DISTRIBUIDORA BARBER LTDA</xNome><xFant>Barber Dist</xFant></emit><dest><CNPJ>${DEST_CNPJ}</CNPJ></dest>${det}<total><ICMSTot><vProd>180.01</vProd><vNF>168.01</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo><chNFe>${chave}</chNFe><nProt>135260000000001</nProt><dhRecbto>2026-10-10T10:00:05-04:00</dhRecbto></infProt></protNFe></nfeProc>`;
}

function produtos() {
  const pomada = barbearia.criarProdutoRevenda(EMP, { nome: 'Pomada modeladora', ean: '7891234567895', precoVenda: 45, custoUnitario: 18, estoqueAtual: 2, estoqueMinimo: 3 });
  const oleo = barbearia.criarProdutoRevenda(EMP, { nome: 'Óleo para barba 30ml', precoVenda: 39, custoUnitario: 0, estoqueAtual: 0, estoqueMinimo: 2 });
  return { pomada, oleo };
}

test('fornecedor: valida CNPJ e não duplica', () => {
  assert.throws(() => compras.salvarFornecedor(EMP, { nome: 'X', cnpj: '11.111.111/1111-11' }), /CNPJ/);
  const f = compras.salvarFornecedor(EMP, { nome: 'Barber Dist', cnpj: '50.073.355/0002-60', prazoEntregaDias: 5 });
  assert.equal(f.cnpj, '50073355000260');
  assert.throws(() => compras.salvarFornecedor(EMP, { nome: 'Outro', cnpj: '50073355000260' }), /Já existe/);
  assert.equal(compras.salvarFornecedor(EMP, { telefone: '65 9999' }, f.id).telefone, '65 9999');
});

test('XML de NF-e: lê itens, desconto por item e ignora GTIN genérico', () => {
  const nota = compras.lerXmlNfe(xmlNota());
  assert.equal(nota.chave, CHAVE);
  assert.equal(nota.numero, '1234');
  assert.equal(nota.emitente.cnpj, '50073355000260');
  assert.equal(nota.autorizada, true);
  assert.equal(nota.itens.length, 3);
  assert.equal(nota.itens[0].custoUnitario, 18); // (120 − 12) / 6
  assert.equal(nota.itens[1].ean, '');
  assert.throws(() => compras.lerXmlNfe('<html/>'), /NF-e/);
  assert.throws(() => compras.lerXmlNfe('nada'), /XML/);
});

test('XML incompleto ou sem autorização verificável não é aceito como autorizado', () => {
  const semDestinatario = xmlNota().replace(`<CNPJ>${DEST_CNPJ}</CNPJ>`, '<CNPJ></CNPJ>');
  assert.throws(() => compras.lerXmlNfe(semDestinatario), /CNPJ do destinatário/);
  const semProtocolo = xmlNota().replace(/<protNFe>[\s\S]*?<\/protNFe>/, '');
  const nota = compras.lerXmlNfe(semProtocolo);
  assert.equal(nota.autorizada, false);
  assert.equal(nota.validacao.protocolo, false);
  assert.throws(() => compras.lancarNotaEntrada(EMP, semProtocolo, { confirmado: true }), /autorização verificável/);
});

test('NF-e com CNPJ destinatário divergente do tenant é bloqueada antes de mutar', () => {
  const xml = xmlNota().replace(`<CNPJ>${DEST_CNPJ}</CNPJ>`, '<CNPJ>50073355000260</CNPJ>');
  const previa = compras.previaNotaEntrada(EMP, xml);
  assert.equal(previa.destinatarioVinculado, false);
  assert.equal(previa.aceitaEntrada, false);
  assert.throws(() => compras.lancarNotaEntrada(EMP, xml, { confirmado: true }), /CNPJ destinatário.*diverge/);
  assert.equal(compras.listarNotasEntrada(EMP).length, 0);
});

test('prévia sugere produto por EAN e nome; lançamento dá entrada com custo médio e não duplica', () => {
  const { pomada, oleo } = produtos();
  const previa = compras.previaNotaEntrada(EMP, xmlNota());
  assert.equal(previa.itens[0].produtoId, pomada.id);
  assert.equal(previa.itens[0].criterio, 'ean');
  assert.equal(previa.itens[1].produtoId, oleo.id);
  assert.equal(previa.itens[1].criterio, 'nome');
  assert.equal(previa.itens[2].produtoId, null);
  assert.equal(previa.jaLancada, false);
  assert.throws(() => compras.lancarNotaEntrada(EMP, xmlNota(), { confirmado: true }), /sem produto/);
  assert.throws(() => compras.lancarNotaEntrada(EMP, xmlNota(), {}), /Confirme/);
  const r = compras.lancarNotaEntrada(EMP, xmlNota(), { confirmado: true, usuario: 'gestor', itens: [{ item: 3, ignorar: true }] });
  assert.equal(r.entradas.length, 2);
  assert.equal(r.ignorados.length, 1);
  const pom = barbearia.listarProdutosRevenda(EMP).find((p) => p.id === pomada.id);
  assert.equal(pom.estoqueAtual, 8);
  assert.equal(pom.custoUnitario, 18); // (2×18 + 6×18) / 8
  assert.equal(pom.fornecedorPadraoId, r.fornecedorId);
  const ol = barbearia.listarProdutosRevenda(EMP).find((p) => p.id === oleo.id);
  assert.equal(ol.estoqueAtual, 4);
  assert.equal(ol.custoUnitario, 15);
  // Fornecedor criado pelo emitente e vínculo aprendido.
  assert.equal(compras.listarFornecedores(EMP)[0].cnpj, '50073355000260');
  assert.equal(compras.previaNotaEntrada(EMP, xmlNota()).jaLancada, true);
  const de_novo = compras.lancarNotaEntrada(EMP, xmlNota(), { confirmado: true, itens: [{ item: 3, ignorar: true }] });
  assert.equal(de_novo.repetida, true);
  assert.equal(barbearia.listarProdutosRevenda(EMP).find((p) => p.id === pomada.id).estoqueAtual, 8);
  // Nota nova do mesmo fornecedor: o código cProd já está vinculado.
  const outra = compras.previaNotaEntrada(EMP, xmlNota({ chave: OUTRA_CHAVE }));
  assert.equal(outra.itens[1].criterio, 'vinculo_anterior');
});

test('nota cria produto novo e converte caixa em unidades', () => {
  const xml = xmlNota({ itens: [{ n: 1, cProd: 'CX-SH', ean: '7890000000017', xProd: 'Shampoo 250ml cx c/12', qCom: '2', vUnCom: '240.00', vProd: '480.00' }] });
  assert.throws(() => compras.lancarNotaEntrada(EMP, xml, { confirmado: true, itens: [{ item: 1, criarProduto: true }] }), /preço de venda/);
  const r = compras.lancarNotaEntrada(EMP, xml, { confirmado: true, itens: [{ item: 1, criarProduto: true, precoVenda: 49.9, fatorConversao: 12, nome: 'Shampoo 250ml' }] });
  const novo = barbearia.listarProdutosRevenda(EMP).find((p) => p.id === r.entradas[0].produtoId);
  assert.equal(novo.nome, 'Shampoo 250ml');
  assert.equal(novo.estoqueAtual, 24);
  assert.equal(novo.custoUnitario, 20);
  assert.equal(novo.ean, '7890000000017');
});

test('falha no item intermediário compensa entradas anteriores e permite replay', () => {
  const { pomada, oleo } = produtos();
  const outraLoja = barbearia.criarProdutoRevenda(EMP, { lojaId: 'loja-b', nome: 'Produto loja B', precoVenda: 29, custoUnitario: 10 });
  const xml = xmlNota({ chave: OUTRA_CHAVE });
  const estoqueAntes = barbearia.listarProdutosRevenda(EMP).map((item) => [item.id, item.estoqueAtual]);
  assert.throws(() => compras.lancarNotaEntrada(EMP, xml, {
    confirmado: true,
    lojaId: 'loja-a',
    itens: [{ item: 1, produtoId: pomada.id }, { item: 2, produtoId: outraLoja.id }, { item: 3, ignorar: true }],
  }), /unidade ativa/);
  assert.deepEqual(barbearia.listarProdutosRevenda(EMP).map((item) => [item.id, item.estoqueAtual]), estoqueAntes);
  assert.equal(compras.listarNotasEntrada(EMP).length, 0);
  const tentativas = compras.listarTransacoesEntrada(EMP);
  assert.equal(tentativas.length, 1);
  assert.equal(tentativas[0].status, 'compensada');
  assert.equal(tentativas[0].compensacoes[0].status, 'compensada');

  const replay = compras.lancarNotaEntrada(EMP, xml, {
    confirmado: true,
    lojaId: 'loja-a',
    itens: [{ item: 1, produtoId: pomada.id }, { item: 2, produtoId: oleo.id }, { item: 3, ignorar: true }],
  });
  assert.equal(replay.repetida, undefined);
  assert.equal(replay.entradas.length, 2);
  assert.equal(compras.lancarNotaEntrada(EMP, xml, { confirmado: true, lojaId: 'loja-a', itens: [{ item: 3, ignorar: true }] }).repetida, true);
  assert.equal(barbearia.listarProdutosRevenda(EMP).find((item) => item.id === pomada.id).estoqueAtual, 8);
});

test('pedido de compra: rascunho, envio, recebimento parcial e total com custo médio', () => {
  const { pomada, oleo } = produtos();
  const f = compras.salvarFornecedor(EMP, { nome: 'Barber Dist', prazoEntregaDias: 5 });
  assert.throws(() => compras.criarPedido(EMP, { fornecedorId: f.id, itens: [] }), /pelo menos um item/);
  const p = compras.criarPedido(EMP, { fornecedorId: f.id, itens: [{ produtoId: pomada.id, quantidade: 10, custoUnitario: 21 }, { produtoId: oleo.id, quantidade: 5, custoUnitario: 14 }] });
  assert.equal(p.numero, 'PC-00001');
  assert.equal(p.total, 280);
  assert.equal(compras.enviarPedido(EMP, p.id).status, 'enviado');
  const parcial = compras.receberPedido(EMP, p.id, { itens: [{ produtoId: pomada.id, quantidade: 4 }], chaveIdempotencia: 'r1' });
  assert.equal(parcial.status, 'recebido_parcial');
  assert.equal(compras.receberPedido(EMP, p.id, { itens: [{ produtoId: pomada.id, quantidade: 4 }], chaveIdempotencia: 'r1' }).repetido, true);
  assert.throws(() => compras.receberPedido(EMP, p.id, { itens: [{ produtoId: pomada.id, quantidade: 7 }] }), /maior que o pendente/);
  assert.throws(() => compras.cancelarPedido(EMP, p.id), /recebimento/);
  const total = compras.receberPedido(EMP, p.id, { chaveIdempotencia: 'r2' });
  assert.equal(total.status, 'recebido');
  const pom = barbearia.listarProdutosRevenda(EMP).find((x) => x.id === pomada.id);
  assert.equal(pom.estoqueAtual, 12);
  assert.equal(Number(pom.custoUnitario.toFixed(2)), 20.5); // (2×18 + 10×21)/12
  const movs = barbearia.listarMovimentosEstoque(EMP, { produtoId: pomada.id }).filter((m) => m.tipo === 'entrada_compra');
  assert.equal(movs.length, 2);
  assert.ok(movs.every((m) => m.referencia === 'PC-00001'));
});

test('reposição sugere ruptura e abaixo do mínimo e gera pedido por fornecedor', () => {
  const { pomada, oleo } = produtos();
  barbearia.criarProdutoRevenda(EMP, { nome: 'Cera', precoVenda: 30, estoqueAtual: 50, estoqueMinimo: 2 });
  const f = compras.salvarFornecedor(EMP, { nome: 'Barber Dist' });
  const s = compras.sugestaoReposicao(EMP);
  assert.deepEqual(s.itens.map((i) => i.motivo), ['ruptura', 'abaixo_do_minimo']);
  assert.equal(s.itens[0].produtoId, oleo.id);
  assert.ok(s.itens.every((i) => i.quantidadeSugerida >= 1));
  const g = compras.gerarPedidosDeReposicao(EMP, {});
  assert.equal(g.pedidos.length, 0);
  assert.equal(g.semFornecedor.length, 2);
  const g2 = compras.gerarPedidosDeReposicao(EMP, { fornecedorPadraoId: f.id });
  assert.equal(g2.pedidos.length, 1);
  assert.equal(g2.pedidos[0].status, 'rascunho');
  assert.equal(g2.pedidos[0].origem, 'reposicao_automatica');
  // Com o pedido em aberto, a sugestão não repete os itens.
  assert.equal(compras.sugestaoReposicao(EMP).itens.length, 0);
  assert.ok(pomada.id);
});

test('curva ABC por receita com margem e itens parados', () => {
  const a = barbearia.criarProdutoRevenda(EMP, { nome: 'Perfume', precoVenda: 300, custoUnitario: 180, estoqueAtual: 10 });
  const b = barbearia.criarProdutoRevenda(EMP, { nome: 'Pomada', precoVenda: 40, custoUnitario: 18, estoqueAtual: 10 });
  const c = barbearia.criarProdutoRevenda(EMP, { nome: 'Pente', precoVenda: 10, custoUnitario: 3, estoqueAtual: 10 });
  barbearia.criarProdutoRevenda(EMP, { nome: 'Parado', precoVenda: 50, custoUnitario: 20, estoqueAtual: 5 });
  const vender = (produtoId, quantidade) => {
    const v = barbearia.criarVendaRevenda(EMP, { itens: [{ produtoId, quantidade }] });
    barbearia.finalizarVendaRevenda(EMP, v.id, { confirmadoPagamento: true, meioPagamento: 'pix', valorRecebido: v.total });
  };
  vender(a.id, 3); vender(b.id, 4); vender(c.id, 2);
  const abc = compras.curvaAbc(EMP, { dias: 30 });
  assert.equal(abc.receitaTotal, 1080);
  const linha = (nome) => abc.linhas.find((l) => l.nome === nome);
  assert.equal(linha('Perfume').classe, 'A');
  assert.equal(linha('Perfume').margem, 360);
  assert.equal(linha('Pomada').classe, 'B');
  assert.equal(linha('Pente').classe, 'C');
  assert.equal(linha('Parado').parado, true);
  assert.equal(abc.parados.length, 1);
  assert.equal(compras.curvaAbc(EMP, { criterio: 'margem' }).criterio, 'margem');
});

test('fornecedor sem prazo usa 7 dias', () => {
  assert.equal(compras.salvarFornecedor(EMP, { nome: 'Sem prazo' }).prazoEntregaDias, 7);
});
