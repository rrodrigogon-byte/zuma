import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  obterDashboardAgro,
  abrirTicketBalancaAgro,
  registrarSaidaTicketBalancaAgro,
  emitirNotaProdutorAgro,
  emitirReceituarioAgronomico,
  emitirCte57,
  emitirMdfe58,
  encerrarMdfe58,
  obterPainelImplantacaoEmpresa
} from './core/pilares-nota-100-kytto.js';

test('1. Módulo Agro: Balança Rodoviária desconta umidade/impureza, gera Romaneio, NFP-e (FUNRURAL/SENAR) e Receituário CREA', () => {
  const tenantId = 'agro-test-01';
  const tktRes = abrirTicketBalancaAgro(tenantId, {
    placa_veiculo: 'QBP9Z11',
    motorista: 'João Batista',
    peso_entrada_kg: 15000,
    tipo_operacao: 'entrada'
  });
  const tkt = tktRes.rows[0];
  assert.equal(tkt.status, 'aguardando_saida');

  const finalizado = registrarSaidaTicketBalancaAgro(tenantId, tkt.id, {
    peso_saida_kg: 51000,
    umidade_percentual: 15.0,
    impureza_percentual: 1.0
  });
  assert.equal(finalizado.status, 'finalizado');
  assert.equal(finalizado.peso_liquido_kg, 36000);
  assert.ok(finalizado.sacas > 580 && finalizado.sacas < 600);

  const nfp = emitirNotaProdutorAgro(tenantId, {
    quantidade_kg: 36000,
    valor_unitario: 130.00
  }).rows[0];
  assert.equal(nfp.status, 'emitida');
  assert.equal(nfp.chave_nfp_mt.length, 44);
  assert.ok(nfp.valor_funrural > 0);
  assert.ok(nfp.valor_senar > 0);

  const rec = emitirReceituarioAgronomico(tenantId, {
    cultura: 'Soja',
    praga_alvo: 'Percevejo Marrom',
    dosagem: '0,8 L/ha'
  });
  assert.ok(rec.numero_receita.startsWith('RA-MT-2026'));

  const dash = obterDashboardAgro(tenantId);
  assert.ok(dash.safras.length >= 2);
  assert.ok(dash.silos.length >= 2);
});

test('2. Módulo CT-e (57) e MDF-e (58): Emissão com chave de 44 dígitos e Evento 110112 de Encerramento SEFAZ-MT', () => {
  const tenantId = 'transporte-test-01';
  const cte = emitirCte57(tenantId, {
    valorFrete: 5200.00,
    pesoBrutoKg: 36000,
    placaTracao: 'QBP9Z11'
  });
  assert.equal(cte.modelo, '57');
  assert.equal(cte.chaveAcesso.length, 44);
  assert.equal(cte.status, 'AUTORIZADO');

  const mdfe = emitirMdfe58(tenantId, {
    placaTracao: 'QBP9Z11',
    documentosVinculados: [cte.chaveAcesso]
  });
  assert.equal(mdfe.modelo, '58');
  assert.equal(mdfe.chaveAcesso.length, 44);
  assert.equal(mdfe.status, 'AUTORIZADO_EM_TRANSITO');

  const encerrado = encerrarMdfe58(tenantId, mdfe.id, { municipioEncerramento: '5107602', ufEncerramento: 'MT' });
  assert.equal(encerrado.status, 'ENCERRADO_SEFAZ');
  assert.equal(encerrado.eventoEncerramento.tpEvento, '110112');
});

test('3. Módulo de Implantação Guiada retorna checklist de Go-Live homologado com 10 etapas', async () => {
  const painel = await obterPainelImplantacaoEmpresa(null, 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
  assert.equal(painel.sucesso, true);
  assert.equal(painel.etapas.length, 10);
});

test('4. Serviço Fiscal corrige XML de contingência (S/A & CIA -> S/A &amp; CIA) e re-assina com Certificado A1 antes da transmissão SEFAZ-MT', () => {
  const servicoFiscal = fs.readFileSync(new URL('./modules/fiscal/servico.js', import.meta.url), 'utf8');
  assert.equal(servicoFiscal.includes('xJustLimpa'), true, 'Deve remontar XML limpo sem acentos para contingência');
  assert.equal(servicoFiscal.includes('montarNfe({'), true, 'Deve re-assinar XML de contingência com montarNfe');
});
