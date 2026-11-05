import test from 'node:test';
import assert from 'node:assert/strict';
import * as ref from '../modules/fiscal/referencias.js';
import { analisar, referencias, barrarClassificacaoInvalida } from '../modules/fiscal/classificacao-analise.js';

test('tabelas oficiais: NCM vigente com caminho, busca por código e por palavras sem acento', () => {
  const n = ref.obterNcm('3303.00.10');
  assert.equal(n.codigo, '33030010');
  assert.match(n.caminho, /Perfumes e águas-de-colônia.*Perfumes \(extratos\)/);
  assert.equal(ref.obterNcm('12345678'), null, 'código inexistente');
  assert.equal(ref.obterNcm('3303'), null, 'só folha de 8 dígitos');
  assert.deepEqual(ref.buscarNcm('3305').map((x) => x.codigo), ['33051000', '33052000', '33053000', '33059000']);
  assert.ok(ref.buscarNcm('aguas colonia').some((x) => x.codigo === '33030020'), 'busca sem acento');
  assert.ok(ref.fontes().ncm.vigencia.length > 5);
});

test('CEST: opções do NCM (mais específico primeiro), revogados fora e compatibilidade NCM × CEST', () => {
  const op = ref.cestsDoNcm('33059000').map((x) => x.codigo);
  assert.ok(op.includes('2002000') && op.includes('2002100'), 'preparações capilares e condicionadores');
  assert.equal(ref.cestsDoNcm('22011000').some((x) => ['0300100', '0300200', '0300400'].includes(x.codigo)), false, 'revogados não aparecem');
  assert.equal(ref.obterCest('2000700').descricao, 'Perfumes (extratos)');
});

test('Lista de Serviços Nacional e cIndOp oficiais', () => {
  assert.equal(ref.obterServico('060101').item, '06.01');
  assert.match(ref.obterServico('60101').descricao, /Barbearia/);
  assert.equal(ref.obterServico('069999'), null);
  assert.ok(ref.buscarServicos('barbearia').some((s) => s.codigo === '060101'));
  assert.equal(ref.obterCIndOp('030101').local, 'Estabelecimento do fornecedor');
});

test('conferência do produto: códigos inexistentes e combinações erradas são erro; o resto é aviso', () => {
  const ok = ref.conferirClassificacao({ ncm: '33030010', cfop: '5405', csosn: '500', cest: '2000700', origem: '0', cstPis: '49', cstCofins: '49', unidadeTributavel: 'UN' }, { crt: '1' });
  assert.deepEqual([ok.erros, ok.avisos], [[], []]);
  const ruim = ref.conferirClassificacao({ ncm: '12345678', cfop: '1102', cest: '123' }, { crt: '3' });
  assert.deepEqual(ruim.erros.map((e) => e.campo).sort(), ['cest', 'cfop', 'cstIcms', 'ncm']);
  // CEST que não abrange o NCM (padrão da revenda da Dino em produção: 3305.90.00 com 20.005.00)
  const cest = ref.conferirClassificacao({ ncm: '33059000', cfop: '5405', csosn: '500', cest: '2000500' }, { crt: '1' });
  assert.equal(cest.erros[0].campo, 'cest');
  assert.match(cest.erros[0].mensagem, /Lubrificação íntima.*não abrange.*20\.020\.00/);
  // ST sem CEST
  assert.ok(ref.conferirClassificacao({ ncm: '33030010', cfop: '5405', csosn: '500' }, { crt: '1' }).erros.some((e) => e.campo === 'cest'));
  // NCM do Convênio sem ST: só aviso; CFOP de ST sem CSOSN 500: aviso
  const semSt = ref.conferirClassificacao({ ncm: '33030010', cfop: '5405', csosn: '102' }, { crt: '1' });
  assert.deepEqual(semSt.erros, []);
  assert.deepEqual(semSt.avisos.map((a) => a.campo).sort(), ['cest', 'cfop']);
  // CEST fora da tabela de referência: aviso (a captura pode não ter a linha)
  assert.equal(ref.conferirClassificacao({ ncm: '22011000', cfop: '5405', csosn: '500', cest: '0300504' }, { crt: '1' }).avisos[0].campo, 'cest');
  // padrão de categoria pode ficar sem NCM
  assert.deepEqual(ref.conferirClassificacao({ fonte: 'categoria', cfop: '5102', csosn: '102' }, { crt: '1' }).erros, []);
});

test('conferência do serviço: cTribNac da lista nacional e ISS de 0 a 5%', () => {
  assert.deepEqual(ref.conferirClassificacao({ fonte: 'servico', cTribNac: '060101', aliquotaIss: 2 }).erros, []);
  assert.deepEqual(ref.conferirClassificacao({ fonte: 'servico', cTribNac: '069999', aliquotaIss: 7, cIndOp: '999999' }).erros.map((e) => e.campo), ['cTribNac', 'aliquotaIss', 'cIndOp']);
  assert.equal(ref.conferirClassificacao({ fonte: 'servico', cTribNac: '060101' }).avisos[0].campo, 'aliquotaIss');
});

test('análise da lista: nome do serviço da barbearia no lugar do código, situação, descrições e busca', () => {
  const cadastro = new Map([['servico:srv-1', { nome: 'Corte degradê', grupo: 'Barbearia · Cortes', ativo: true, tipo: 'servico' }]]);
  const itens = analisar([
    { fonte: 'servico', fonteId: 'srv-1', nome: 'srv-1', grupo: 'Serviço', classificacao: { tipo: 'servico', cTribNac: '060101', aliquotaIss: 2 }, herdada: false },
    { fonte: 'servico', fonteId: 'srv-velho', nome: 'srv-velho', grupo: 'Serviço', classificacao: { tipo: 'servico', cTribNac: '060101', aliquotaIss: 2 }, herdada: false },
    { fonte: 'categoria', fonteId: 'barbearia:revenda', nome: 'barbearia:revenda', grupo: 'Padrão de categoria', classificacao: { tipo: 'produto', ncm: '33059000', cfop: '5405', csosn: '500', cest: '2000500' }, herdada: false },
    { fonte: 'est_item', fonteId: 'e1', nome: 'Presunto Cozido · FRI-002', grupo: 'Estoque · Frios', classificacao: null, herdada: false, ncmSugerido: '65050090' },
    { fonte: 'loja_variante', fonteId: 'v1', nome: 'Perfume X', grupo: 'Loja online', classificacao: { tipo: 'produto', ncm: '33030010', cfop: '5405', csosn: '500', cest: '2000700' }, herdada: false },
  ], { crt: '1', cadastro });
  assert.equal(itens[0].nome, 'Corte degradê');
  assert.equal(itens[0].situacao, 'ok');
  assert.equal(itens[1].orfa, true);
  assert.equal(itens[2].situacao, 'erro');
  assert.equal(itens[3].situacao, 'sem');
  assert.match(itens[3].sugestoes[0].descricao, /^Chapéus/, 'o NCM do cadastro mostra o que ele é de verdade');
  assert.match(itens[4].descricao.ncm, /Perfumes/);
  assert.ok(itens[4].busca.includes('3303.00.10') && itens[4].busca.includes('perfumes (extratos)') && itens[4].busca.includes('csosn 500'));
});

test('referências para o formulário e barreira de gravação', () => {
  assert.ok(referencias({ tipo: 'ncm', q: 'xampu' }).itens.some((x) => x.codigo === '33051000'));
  assert.ok(referencias({ tipo: 'ncm-detalhe', q: '33051000' }).cests.some((c) => c.codigo === '2001700'));
  assert.ok(referencias({ tipo: 'cfop', q: '5405' }).itens.length >= 1);
  assert.ok(referencias({}).csosn.length === 5);
  const mw = barrarClassificacaoInvalida();
  const res = { statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } };
  let passou = false;
  mw({ body: { fonte: 'loja_variante', fonteId: 'v1', ncm: '33030010', cfop: '5405', csosn: '500', cest: '2000500' } }, res, () => { passou = true; });
  assert.equal(passou, false);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.code, 'CLASSIFICACAO_INVALIDA');
  mw({ body: { fonte: 'loja_variante', fonteId: 'v1', ncm: '33030010', cfop: '5405', csosn: '500', cest: '2000700' } }, res, () => { passou = true; });
  assert.equal(passou, true);
  let passouLote = false;
  barrarClassificacaoInvalida({ lote: true })({ body: { itens: [{ fonte: 'servico', fonteId: 's' }], classificacao: { cTribNac: '060101', aliquotaIss: 2 } } }, res, () => { passouLote = true; });
  assert.equal(passouLote, true, 'lote só de serviços confere como serviço');
});

test('rotas: referências, conferência com o regime do emitente e gravação barrada antes do banco', async () => {
  const express = (await import('express')).default;
  const { createFiscalAdminRouter } = await import('../modules/fiscal/rotas.js');
  const consultas = [];
  const db = { query: async (sql) => { consultas.push(sql); if (/FROM fis_emitentes/.test(sql)) return { rows: [{ crt: '1' }] }; throw new Error('não deveria gravar'); } };
  const app = express(); app.use(express.json());
  app.use('/f', createFiscalAdminRouter({ db, escopoDaRequisicao: async () => ({ empresaId: '11111111-1111-4111-8111-111111111111' }) }));
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}/f`;
  try {
    let r = await fetch(`${base}/classificacoes/referencias?tipo=ncm&q=perfume`);
    assert.equal(r.status, 200);
    assert.ok((await r.json()).itens.some((x) => x.codigo === '33030010'));
    r = await fetch(`${base}/classificacoes/conferir`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ncm: '33030010', cfop: '5405', cstIcms: '60', cest: '2000700' }) });
    const c = await r.json();
    assert.equal(c.crt, '1');
    assert.ok(c.erros.some((e) => e.campo === 'csosn'), 'Simples exige CSOSN');
    r = await fetch(`${base}/classificacoes`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fonte: 'loja_variante', fonteId: 'v1', ncm: '33059000', cfop: '5405', csosn: '500', cest: '2000500' }) });
    assert.equal(r.status, 422);
    assert.equal((await r.json()).code, 'CLASSIFICACAO_INVALIDA');
    r = await fetch(`${base}/classificacoes/lote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itens: [{ fonte: 'loja_variante', fonteId: 'v1' }], classificacao: { ncm: '99999999', cfop: '5102', csosn: '102' } }) });
    assert.equal(r.status, 422);
    assert.equal(consultas.some((s) => /fis_classificacoes/.test(s)), false, 'nada chegou ao banco');
  } finally { srv.close(); }
});
