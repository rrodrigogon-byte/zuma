import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criarLoteEnsaio,
  atualizarLoteEnsaio,
  excluirLoteEnsaio,
  atualizarCorpoProva,
  gerarLaudoTecnicoImpressaoHtml,
  registrarRupturaCorpoProva
} from './servico.js';

test('1. Laboratório: Criar novo lote de ensaio de CP com NBR 5738', async () => {
  const dados = {
    cliente: 'Construtora Teste PRD',
    obra: 'Edifício Teste - Pilares Térreo',
    fckProjeto: 35,
    slumpMedidoCm: 15,
    dataMoldagem: '2026-11-12',
    tipoCura: 'Câmara Úmida Climatizada 100% UR',
    laboratorista: 'Técnico Especialista'
  };

  const res = await criarLoteEnsaio(dados);
  assert.ok(res.ok);
  assert.ok(res.ensaio.id);
  assert.equal(res.ensaio.fckProjeto, 35);
  assert.equal(res.ensaio.corposProva.length, 4);
  assert.equal(res.ensaio.corposProva[0].idadeDias, 7);
  assert.equal(res.ensaio.corposProva[2].idadeDias, 28);
});

test('2. Laboratório: Registrar ruptura de CP e recalcular FCK NBR 12655', async () => {
  const resCriacao = await criarLoteEnsaio({
    lote: 'LOTE-TEST-RUPTURA',
    fckProjeto: 30,
    cliente: 'Obra Alfa',
    obra: 'Vigas'
  });

  const loteId = resCriacao.ensaio.id;

  // Ruptura CP-1 (7d)
  const resCp1 = await atualizarCorpoProva(loteId, 'CP-1', {
    idadeDias: 7,
    dataRuptura: '2026-11-12',
    forcaKn: 196.4, // ~25.0 MPa
    tipoFratura: 'Cônica'
  });
  assert.ok(resCp1.ok);
  assert.equal(resCp1.corpoProva.tensaoMpa, 25.0);

  // Ruptura CP-3 (28d)
  await atualizarCorpoProva(loteId, 'CP-3', {
    idadeDias: 28,
    dataRuptura: '2026-11-12',
    forcaKn: 267.0, // ~34.0 MPa
    tipoFratura: 'Cônica'
  });

  // Ruptura CP-4 (28d)
  const resCp4 = await atualizarCorpoProva(loteId, 'CP-4', {
    idadeDias: 28,
    dataRuptura: '2026-11-12',
    forcaKn: 274.9, // ~35.0 MPa
    tipoFratura: 'Cônica'
  });

  assert.ok(resCp4.ok);
  assert.equal(resCp4.ensaio.status, 'aprovado');
  assert.ok(resCp4.ensaio.fckEstimado28d >= 30);
  assert.equal(resCp4.ensaio.laudoAprovado, true);
});

test('3. Laboratório: Atualizar dados de lote de ensaio e gerar HTML de laudo para impressão', async () => {
  const resCriacao = await criarLoteEnsaio({
    lote: 'LOTE-TEST-LAUDO',
    fckProjeto: 40,
    cliente: 'Engenharia Tangará',
    obra: 'Fundação Tubulões'
  });

  const loteId = resCriacao.ensaio.id;

  // Atualizar
  const resUp = await atualizarLoteEnsaio(loteId, {
    observacoes: 'Adicionado aditivo acelerador de pega Sika.'
  });
  assert.ok(resUp.ok);
  assert.equal(resUp.ensaio.observacoes, 'Adicionado aditivo acelerador de pega Sika.');

  // Gerar Laudo HTML
  const html = gerarLaudoTecnicoImpressaoHtml(loteId);
  assert.ok(html.includes('SERRANO') && html.includes('CONCRETO'));
  assert.ok(html.includes('Certificado de Controle Tecnológico'));
  assert.ok(html.includes('Fundação Tubulões'));
  assert.ok(html.includes('Engª Karin Prestes'));
});

test('4. Laboratório: Excluir lote de ensaio', async () => {
  const resCriacao = await criarLoteEnsaio({
    lote: 'LOTE-EXCLUIR',
    fckProjeto: 25,
    cliente: 'Excluir Ltda',
    obra: 'Pátio'
  });

  const loteId = resCriacao.ensaio.id;
  const resDel = await excluirLoteEnsaio(loteId);
  assert.ok(resDel.ok);
  assert.equal(resDel.removido.id, loteId);
});
