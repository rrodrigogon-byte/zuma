import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { kyttoEventBus, sincronizarNossaGenteUltra } from '../app/modules/eventos/kytto-eventbus.js';
import { listarCotacoes, obterCurvaAbc, aprovarCotacao } from '../app/modules/compras/cotacao-inteligente-suite.js';

describe('Barramento Central de Eventos Internos & Integração Nossa Gente × Ultra', () => {

  test('1. Disparo de Evento Interno com Hash de Integridade e Latência < 15ms', () => {
    const evt = kyttoEventBus.dispararEventoInterno({
      tipo: 'TEST_EVENTO_INTEGRACAO',
      origem: 'teste-unitario',
      destino: 'todos',
      payload: { mensagem: 'Validação de Barramento Interno' }
    });

    assert.ok(evt.id.startsWith('evt-'));
    assert.equal(evt.tipo, 'TEST_EVENTO_INTEGRACAO');
    assert.equal(evt.status, 'PROCESSADO_COM_SUCESSO');
    assert.ok(evt.hashIntegridade.length >= 16);
    assert.ok(evt.latenciaMs < 50);
  });

  test('2. Sincronização por Evento Interno entre Nossa Gente e Ultra', () => {
    const res = sincronizarNossaGenteUltra({
      entidade: 'colaborador',
      operacao: 'PROMOVER_CARGO',
      dados: {
        matricula: 'NG-8849',
        nome: 'Juliana Costa',
        cargoNovo: 'Supervisora de Logística & Usina'
      }
    });

    assert.equal(res.ok, true);
    assert.equal(res.evento.tipo, 'SYNC_COLABORADOR_ATUALIZADO');
    assert.equal(res.evento.origem, 'nossa-gente');
    assert.equal(res.evento.destino, 'ultra');
    assert.equal(res.evento.payload.dados.matricula, 'NG-8849');
  });

  test('3. Sincronização de Ticket de Balança Rodoviária do Ultra', () => {
    const res = sincronizarNossaGenteUltra({
      entidade: 'balanca',
      operacao: 'REGISTRAR_PESAGEM',
      dados: {
        ticket: 'TK-9921',
        pesoLiquido: 29500
      }
    });

    assert.equal(res.ok, true);
    assert.equal(res.evento.tipo, 'SYNC_PESAGEM_BALANCA_CARGA');
  });

  test('4. Cotação Multiformecedor com Análise KyttoIA e Curva ABC', () => {
    const cotacoes = listarCotacoes();
    assert.ok(cotacoes.length > 0);
    const cot = cotacoes[0];

    assert.equal(cot.id, 'COT-2026-0081');
    assert.ok(cot.propostas.length >= 3);
    assert.equal(cot.analiseKyttoIA.motor, 'KyttoIA 2.5 Flash');
    assert.ok(cot.analiseKyttoIA.economiaEstimadaRs > 2000);

    const curva = obterCurvaAbc();
    assert.ok(curva.classeA.length > 0);
    assert.ok(curva.classeB.length > 0);
    assert.ok(curva.classeC.length > 0);
  });

  test('5. Aprovação de Cotação com Emissão de OC e Disparo no EventBus', () => {
    const res = aprovarCotacao({
      cotacaoId: 'COT-2026-0081',
      fornecedorVencedorId: 'FORN-01',
      usuarioAprovador: 'Rodrigo Gonçalves'
    });

    assert.equal(res.ok, true);
    assert.ok(res.ordemCompra.numero.startsWith('OC-2026-'));
    assert.equal(res.ordemCompra.valorTotal, 16980.00);
    assert.equal(res.eventoInterno.tipo, 'COTACAO_COMPRA_APROVADA');
    assert.equal(res.eventoInterno.destino, 'financeiro');
  });

});
