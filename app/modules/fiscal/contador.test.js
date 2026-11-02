import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resumoContabil,
  gerarSpedFiscalTxt,
  gerarSpedContribuicoesTxt,
  exportarCsvContador,
  exportarPacoteContador,
} from './contador.js';

function criarDbMock() {
  return {
    async query(sql) {
      if (sql.includes('FROM fis_emitentes')) {
        return {
          rows: [{
            id: 'emit-1',
            cnpj: '12345678000199',
            razao_social: 'DINO BARBEARIA E COMERCIO LTDA',
            nome_fantasia: 'DINO BARBEARIA',
            ie: '131234567',
            im: '998877',
            crt: '1',
            uf: 'MT',
            codigo_municipio: '5103403',
            endereco: { cep: '78000000', logradouro: 'AV GETULIO VARGAS', numero: '100', bairro: 'CENTRO' },
          }],
        };
      }
      if (sql.includes('FROM fis_documentos')) {
        return {
          rows: [
            {
              id: 'doc-1',
              modelo: '65',
              serie: 1,
              numero: 101,
              ambiente: 'producao',
              status: 'autorizado',
              chave_acesso: '51261112345678000199650010000001011000001010',
              protocolo: '1512600001',
              valor_total: 150.00,
              xml_assinado: '<NFe><infNFe Id="NFe5126"/></NFe>',
              xml_autorizado: '<nfeProc><NFe><infNFe Id="NFe5126"/></NFe></nfeProc>',
              dados: {
                destinatario: { cpf: '52998224725', nome: 'CLIENTE TESTE' },
                itens: [
                  {
                    fonteId: 'prod-1',
                    descricao: 'Pomada Modeladora Matte',
                    quantidade: 2,
                    valorUnitario: 75.00,
                    classificacao: {
                      tipo: 'produto',
                      ncm: '33059000',
                      cfop: '5102',
                      csosn: '102',
                      cstPis: '01',
                      aliquotaPis: 1.65,
                      cstCofins: '01',
                      aliquotaCofins: 7.60,
                    },
                  },
                ],
              },
              criado_em: '2026-11-02T14:00:00.000Z',
            },
            {
              id: 'doc-2',
              modelo: 'nfse',
              serie: 1,
              numero: 55,
              ambiente: 'producao',
              status: 'autorizado',
              chave_acesso: 'NFSE-55',
              protocolo: 'NFSE-PROT-55',
              valor_total: 100.00,
              xml_assinado: '<DPS/>',
              xml_autorizado: null,
              dados: {
                destinatario: { cpf: '52998224725', nome: 'CLIENTE TESTE' },
                itens: [
                  {
                    fonteId: 'srv-1',
                    descricao: 'Corte Masculino',
                    quantidade: 1,
                    valorUnitario: 100.00,
                    classificacao: {
                      tipo: 'servico',
                      cTribNac: '060101',
                      aliquotaIss: 5,
                    },
                  },
                ],
              },
              criado_em: '2026-11-02T15:00:00.000Z',
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
}

test('resumoContabil apura totais por modelo, CFOP e tributos (ICMS, PIS, COFINS, ISS)', async () => {
  const db = criarDbMock();
  const r = await resumoContabil(db, 'd0d0ac01-8e50-4b61-8c79-de0000000001', { competencia: '2026-11' });
  assert.equal(r.competencia, '2026-11');
  assert.equal(r.totais.autorizados, 2);
  assert.equal(r.totais.valorAutorizado, 250);
  assert.equal(r.totais.porModelo['65'].qtd, 1);
  assert.equal(r.totais.porModelo['65'].valor, 150);
  assert.equal(r.totais.porModelo.nfse.qtd, 1);
  assert.equal(r.totais.porModelo.nfse.valor, 100);
  assert.equal(r.totais.tributos.valorIss, 5);
  assert.equal(r.porCfop.length, 2);
  assert.equal(r.porCfop[0].cfop, '5102');
  assert.equal(r.porCfop[1].cfop, '5933');
});

test('gerarSpedFiscalTxt gera blocos 0, C, E, H e 9 válidos com |0000| e |9999|', async () => {
  const db = criarDbMock();
  const arq = await gerarSpedFiscalTxt(db, 'd0d0ac01-8e50-4b61-8c79-de0000000001', { competencia: '2026-11' });
  assert.match(arq.nomeArquivo, /^SPED-FISCAL-12345678000199-2026-11\.txt$/);
  assert.ok(arq.conteudo.startsWith('|0000|017|0|20261101|20261130|DINO BARBEARIA E COMERCIO LTDA|12345678000199||MT|'));
  assert.ok(arq.conteudo.includes('|C100|1|0||65|00|1|101|51261112345678000199650010000001011000001010|'));
  assert.ok(arq.conteudo.includes('|C190|102|5102|'));
  assert.ok(arq.conteudo.trim().endsWith('|'));
  assert.ok(arq.conteudo.includes('|9999|'));
});

test('gerarSpedContribuicoesTxt gera EFD Contribuições com blocos 0, A, C, M e 9', async () => {
  const db = criarDbMock();
  const arq = await gerarSpedContribuicoesTxt(db, 'd0d0ac01-8e50-4b61-8c79-de0000000001', { competencia: '2026-11' });
  assert.match(arq.nomeArquivo, /^SPED-CONTRIBUICOES-12345678000199-2026-11\.txt$/);
  assert.ok(arq.conteudo.startsWith('|0000|006|0|||20261101|20261130|DINO BARBEARIA E COMERCIO LTDA|12345678000199|MT|5103403||00|0|'));
  assert.ok(arq.conteudo.includes('|A100|'));
  assert.ok(arq.conteudo.includes('|C100|'));
  assert.ok(arq.conteudo.includes('|M200|'));
  assert.ok(arq.conteudo.includes('|M600|'));
  assert.ok(arq.conteudo.includes('|9999|'));
});

test('exportarCsvContador e exportarPacoteContador retornam CSV e XMLs estruturados', async () => {
  const db = criarDbMock();
  const csv = await exportarCsvContador(db, 'd0d0ac01-8e50-4b61-8c79-de0000000001', { competencia: '2026-11' });
  assert.ok(csv.csv.includes('COMPETENCIA;DATA_EMISSAO;MODELO;SERIE;NUMERO;STATUS;AMBIENTE;CHAVE_ACESSO'));
  assert.ok(csv.csv.includes('51261112345678000199650010000001011000001010'));
  const pac = await exportarPacoteContador(db, 'd0d0ac01-8e50-4b61-8c79-de0000000001', { competencia: '2026-11' });
  assert.equal(pac.totalXmls, 2);
  assert.equal(pac.xmls[0].numero, 101);
});
