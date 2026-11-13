import test from 'node:test';
import assert from 'node:assert/strict';
import { auditarConformidadeFiscalDino } from '../app/modules/fiscal/servico.js';

test('Fiscal Dino: Auditoria completa de CNPJ, IE SEFAZ-MT e IM Tangará da Serra', async (t) => {
  const dbMock = {
    query: async (sql, params) => {
      if (sql.includes('fis_emitentes')) {
        return {
          rows: [{
            id: 'emit-dino-01',
            empresa_id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
            cnpj: '50073355000189',
            razao_social: 'DINO BARBEARIA LTDA',
            nome_fantasia: 'BARBEARIA DINO',
            ie: '142291919',
            im: '30297',
            crt: '1',
            uf: 'MT',
            codigo_municipio: '5107958',
            csc_configurado: true,
            ambiente: 'producao',
            ativo: true
          }]
        };
      }
      if (sql.includes('empresas')) {
        return {
          rows: [{
            id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
            nome: 'BARBEARIA DINO',
            razao_social: 'DINO BARBEARIA LTDA',
            cnpj: '50.073.355/0001-89',
            inscricao_estadual: '14.229.191-9',
            inscricao_municipal: '30297',
            tipo_negocio: 'barbearia',
            endereco_cidade: 'Tangará da Serra',
            endereco_estado: 'MT'
          }]
        };
      }
      return { rows: [] };
    }
  };

  const resultado = await auditarConformidadeFiscalDino(dbMock, 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', {
    env: { FISCAL_DINO_PRODUCAO: '1' }
  });

  await t.test('1. Retorno geral bem sucedido e dados canônicos conferidos', () => {
    assert.equal(resultado.ok, true);
    assert.equal(resultado.empresa.cnpj, '50.073.355/0001-89');
    assert.equal(resultado.empresa.inscricaoEstadual, '14.229.191-9');
    assert.equal(resultado.empresa.inscricaoMunicipal, '30297');
    assert.equal(resultado.empresa.codigoMunicipio, '5107958');
    assert.equal(resultado.empresa.uf, 'MT');
  });

  await t.test('2. Validação matemática de CNPJ e Módulo 11 da IE de Mato Grosso', () => {
    const checkCnpj = resultado.conformidadeFiscal.checklist.find(c => c.item.includes('CNPJ'));
    assert.ok(checkCnpj, 'Checklist deve conter CNPJ');
    assert.equal(checkCnpj.valido, true, 'CNPJ deve ser matematicamente válido');

    const checkIe = resultado.conformidadeFiscal.checklist.find(c => c.item.includes('Inscrição Estadual'));
    assert.ok(checkIe, 'Checklist deve conter Inscrição Estadual');
    assert.equal(checkIe.valido, true, 'IE deve ser válida pelo algoritmo Módulo 11 da SEFAZ-MT');

    const checkIm = resultado.conformidadeFiscal.checklist.find(c => c.item.includes('Inscrição Municipal'));
    assert.ok(checkIm, 'Checklist deve conter Inscrição Municipal');
    assert.equal(checkIm.valido, true, 'IM deve estar presente');
  });

  await t.test('3. Percentual de conformidade deve ser 100% e status REGULAR', () => {
    assert.equal(resultado.conformidadeFiscal.statusGeral, 'REGULAR_E_HOMOLOGADO');
    assert.equal(resultado.conformidadeFiscal.percentualConformidade, 100);
    assert.equal(resultado.conformidadeFiscal.todosConformes, true);
  });

  await t.test('4. Modelos fiscais 65 (NFC-e), nfse (NFS-e) e 55 (NF-e) habilitados', () => {
    assert.equal(resultado.documentosHabilitados.length, 3);
    const nfce = resultado.documentosHabilitados.find(d => d.modelo === '65');
    const nfse = resultado.documentosHabilitados.find(d => d.modelo === 'nfse');
    assert.ok(nfce, 'NFC-e deve estar presente');
    assert.ok(nfse, 'NFS-e deve estar presente');
    assert.equal(nfce.status, 'HABILITADO');
    assert.equal(nfse.status, 'HABILITADO');
  });
});
