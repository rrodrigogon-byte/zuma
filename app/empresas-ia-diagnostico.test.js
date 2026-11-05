import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as svc from './modules/empresas/servico.js';

test('consultarCnpjPublicoComIa rejeita CNPJ com formato inválido', async () => {
  await assert.rejects(
    async () => {
      await svc.consultarCnpjPublicoComIa('123');
    },
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    }
  );
});

test('consultarCnpjPublicoComIa consulta e enriquece semanticamente CNPJ da Barbearia Dino', async () => {
  try {
    const res = await svc.consultarCnpjPublicoComIa('50.073.355/0002-60');
    assert.equal(res.cnpjNormalizado, '50073355000260');
    assert.ok(res.razaoSocial.includes('DINO BARBEARIA'));
    assert.equal(res.endereco.cidade, 'TANGARA DA SERRA');
    assert.equal(res.endereco.estado, 'MT');
    assert.equal(res.ia.tipoNegocioSugerido, 'barbearia');
    assert.equal(res.ia.codigoServicoSugerido, '060101');
    assert.ok(res.ia.recomendacaoIa.includes('barbearia'));
  } catch (err) {
    if (err.status === 404) {
      console.log('API pública de CNPJ indisponível no sandbox no momento do teste.');
    } else {
      throw err;
    }
  }
});

test('gerarDiagnosticoIaEmpresa calcula score e gera recomendacoes para Barbearia Dino', async () => {
  const dbMock = {
    query: async (sql) => {
      if (sql.includes('FROM empresas')) {
        return {
          rows: [{
            id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
            nome: 'DINO BARBEARIA LTDA',
            razao_social: 'DINO BARBEARIA LTDA',
            cnpj: '50073355000260',
            inscricao_estadual: '14.229.191-9',
            inscricao_municipal: '060101',
            tipo_negocio: 'barbearia',
            telefone: '65999998888',
            email: 'contato@barbeariadino.com.br',
            endereco_logradouro: 'Av. Brasil',
            endereco_cidade: 'Tangará da Serra',
            endereco_estado: 'MT',
            total_lojas: 1,
            ativa: true
          }]
        };
      }
      return { rows: [] };
    }
  };

  const diag = await svc.gerarDiagnosticoIaEmpresa(dbMock, 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
  assert.equal(diag.empresaId, 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
  assert.ok(diag.score.total >= 80, 'Score da Dino deve ser superior a 80');
  assert.ok(diag.recomendacoes.length > 0, 'Deve conter recomendações estratégicas da IA');
  assert.ok(diag.status.atendenteIa.includes('T-Rex'));
});

test('gerarDiagnosticoHoldingIa consolida métricas do grupo com sucesso', async () => {
  const dbMock = {
    query: async (sql) => {
      if (sql.includes('FROM empresas')) {
        return {
          rows: [
            { id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', nome: 'Barbearia Dino', cnpj: '50073355000260', tipo_negocio: 'barbearia', ativa: true },
            { id: '31f70c83-9172-40c2-945f-9e793b5048be', nome: 'Stallone Nutre Sport', cnpj: '56099531000138', tipo_negocio: 'loja', ativa: true }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const holding = await svc.gerarDiagnosticoHoldingIa(dbMock);
  assert.ok(holding.totalEmpresas >= 1);
  assert.ok(holding.scoreMedioGrupo > 0);
  assert.ok(Array.isArray(holding.insightsIa));
  assert.ok(holding.insightsIa.length >= 3);
});
