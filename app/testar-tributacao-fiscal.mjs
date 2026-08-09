import assert from 'node:assert/strict';
import {
  arredondarFiscal,
  normalizarClassificacaoFiscalProduto,
  validarClassificacaoFiscalProduto,
  calcularTributosItem,
  totalizarDocumentoFiscal,
} from './tributacao-kytto.js';

let total = 0;
function test(nome, fn) {
  try {
    fn();
    total += 1;
    console.log(`✓ ${nome}`);
  } catch (error) {
    console.error(`✗ ${nome}: ${error.message}`);
    process.exitCode = 1;
  }
}

const fiscalNormal = {
  ncm: '22030000', cfop: '5102', origem: '0', unidadeTributavel: 'UN',
  cstIcms: '00', cstPis: '01', cstCofins: '01',
  aliquotaIcms: 17, aliquotaPis: 1.65, aliquotaCofins: 7.6,
  aliquotaIbptNacional: 38.5,
};

test('normaliza classificação fiscal e protege limites de alíquota', () => {
  const fiscal = normalizarClassificacaoFiscalProduto({ ...fiscalNormal, aliquotaIcms: 120, origem: '9' });
  assert.equal(fiscal.aliquotaIcms, 100);
  assert.equal(fiscal.origem, '0');
  assert.equal(fiscal.ncm, '22030000');
});

test('exige NCM com oito dígitos quando a validação rigorosa está ativa', () => {
  const resultado = validarClassificacaoFiscalProduto({ cfop: '5102', ncm: '2203' }, { exigirNcm: true });
  assert.equal(resultado.valido, false);
  assert.equal(resultado.pendencias.some(item => item.includes('NCM')), true);
});

test('calcula ICMS, PIS e COFINS no regime normal', () => {
  const resultado = calcularTributosItem({ nome: 'Cerveja', quantidade: 2, valorUnitario: 10, fiscal: fiscalNormal }, { regimeTributario: 'lucro_real', exigirNcm: true });
  assert.equal(resultado.valorProduto, 20);
  assert.equal(resultado.icms.valor, 3.4);
  assert.equal(resultado.pis.valor, 0.33);
  assert.equal(resultado.cofins.valor, 1.52);
  assert.equal(resultado.ibpt.valor, 7.7);
});

test('aplica CSOSN e zera ICMS/PIS/COFINS calculados no Simples Nacional', () => {
  const resultado = calcularTributosItem({ nome: 'Refrigerante', quantidade: 1, valorUnitario: 12, fiscal: { ...fiscalNormal, csosn: '102' } }, { regimeTributario: 'simples' });
  assert.equal(resultado.icms.csosn, '102');
  assert.equal(resultado.icms.valor, 0);
  assert.equal(resultado.pis.valor, 0);
  assert.equal(resultado.cofins.valor, 0);
});

test('trata item isento sem base e ICMS devido', () => {
  const resultado = calcularTributosItem({ nome: 'Isento', quantidade: 1, valorUnitario: 25, fiscal: { ...fiscalNormal, cstIcms: '40' } }, { regimeTributario: 'lucro_presumido' });
  assert.equal(resultado.icms.baseCalculo, 0);
  assert.equal(resultado.icms.valor, 0);
});

test('calcula ST e FCP no cenário parametrizado', () => {
  const resultado = calcularTributosItem({ nome: 'Produto ST', quantidade: 1, valorUnitario: 100, fiscal: { ...fiscalNormal, cstIcms: '10', aliquotaIcmsSt: 18, margemValorAgregadoSt: 40, aliquotaFcp: 2 } }, { regimeTributario: 'lucro_real' });
  assert.equal(resultado.icms.baseSt, 140);
  // ST = (base ST × alíquota ST) − ICMS próprio = 25,20 − 17,00.
  assert.equal(resultado.icms.valorSt, 8.2);
  assert.equal(resultado.icms.valorFcp, 2);
});

test('totaliza documento com descontos e arredondamento a duas casas', () => {
  const resultado = totalizarDocumentoFiscal([
    { nome: 'Item A', quantidade: 3, valorUnitario: 9.99, desconto: 0.01, fiscal: fiscalNormal },
    { nome: 'Item B', quantidade: 1, valorUnitario: 5.55, fiscal: fiscalNormal },
  ], { regimeTributario: 'lucro_real', exigirNcm: true });
  assert.equal(resultado.totais.valorProdutos, 35.52);
  assert.equal(resultado.totais.desconto, 0.01);
  assert.equal(resultado.totais.valorTotal, 35.51);
  // O motor arredonda ICMS por item antes da totalização: 5,09 + 0,94 = 6,03.
  assert.equal(resultado.totais.valorIcms, 6.03);
});

test('arredonda valores fiscais de forma determinística', () => {
  assert.equal(arredondarFiscal(1.005), 1.01);
  assert.equal(arredondarFiscal(2.674), 2.67);
});

if (!process.exitCode) console.log(`\n✅ Domínio tributário: ${total} testes passaram`);
process.exit(process.exitCode || 0);
