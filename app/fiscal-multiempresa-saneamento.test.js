import test from 'node:test';
import assert from 'node:assert/strict';
import { sugerirClassificacao } from './modules/fiscal/lote.js';
import * as fiscalSvc from './modules/fiscal/servico.js';

test('Sugestão de NCM classifica corretamente alimentos, suplementos, vestuário e cosméticos sem falsos positivos', () => {
  const casos = [
    ['Bellaabelha extrato de própolis 30ml', '21069030'],
    ['Energy Gel Carbo Gel Limão 30g', '21069090'],
    ['Unilife Fisioblack Gel Negro Massagem', '33049990'],
    ['Seiva Real Guaraná Pro 60 caps', '21069030'],
    ['IM Booster Energy Drink Guaraná 269ml', '22029900'],
    ['Whey Protein Isolado DUX 900g', '21061000'],
    ['Creatina Creapure 300g', '21069030'],
    ['Camiseta Oficial Agro Open', '61091000'],
    ['Boné Oficial Agro Open', '65050090'],
    ['Mochila Esportiva Agro Open', '42029200'],
    ['Garrafa Squeeze 750ml', '39241000'],
    ['Cerveja Heineken Long Neck 330ml', '22030000'],
    ['Pomada Matte Alta Fixação 100g', '33059000'],
    ['Perfume Armaf Club De Nuit Intense EDP 105ml', '33030010'],
  ];

  for (const [nome, esperado] of casos) {
    const sug = sugerirClassificacao(nome);
    assert.equal(sug?.ncm, esperado, `Falha em "${nome}": esperado ${esperado}, obteve ${sug?.ncm}`);
  }
});

test('autoProvisionarFiscalDino não executa para empresas que não são a Barbearia Dino', async () => {
  let queryChamado = false;
  const fakeDb = {
    query: async () => {
      queryChamado = true;
      return { rows: [] };
    }
  };

  const outraEmpresaId = 'a1a1a1a1-8e50-4b61-8c79-de4aaa916da6';
  await fiscalSvc.autoProvisionarFiscalDino(fakeDb, outraEmpresaId);
  assert.equal(queryChamado, false, 'autoProvisionarFiscalDino NÃO deve executar queries para outras empresas');
});

test('salvarClassificacao permite NCM nulo/opcional em categorias padrão', async () => {
  let insertExecutado = false;
  const fakeDb = {
    query: async (sql, params) => {
      insertExecutado = true;
      assert.equal(params[4], null, 'NCM da categoria padrão deve ser gravado como NULL');
      return { rows: [{ fonte: params[1], fonte_id: params[2], tipo: params[3], ncm: params[4] }] };
    }
  };

  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  await fiscalSvc.salvarClassificacao(fakeDb, empresaId, {
    fonte: 'categoria',
    fonteId: 'barbearia:revenda',
    tipo: 'produto',
    cfop: '5405',
    csosn: '500',
    cest: '2002000',
    ncm: '',
  });

  assert.equal(insertExecutado, true, 'Insert deve ser executado com sucesso');
});
