import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTelefoneBR,
  sanitizarNomeCliente,
  escolherMelhorNome,
  carregarBaseConsolidada,
  invalidarCacheRecuperacao,
} from '../dino-recuperacao-avec.js';
import { buildInteligenciaVendas } from '../dino-inteligencia-vendas.js';
import { db } from '../db.js';

test('Inteligência Comercial, Anti-Churn e Saneamento de Cadastros Dino Barbearia', async (t) => {
  await t.test('sanitizarNomeCliente limpa sufixos legados entre parênteses e extrai planos', () => {
    const pablo = sanitizarNomeCliente('Pablo Selle (Club Combo - Asaas Dia 04)');
    assert.equal(pablo.nomeLimpo, 'Pablo Selle');
    assert.equal(pablo.planoDetectado, 'Club Combo - Asaas Dia 04');

    const jefferson = sanitizarNomeCliente('Jefferson Jl cestas ( Bruno )');
    assert.equal(jefferson.nomeLimpo, 'Jefferson Jl cestas');
    assert.equal(jefferson.barbeiroAnotado, 'Bruno');

    const oziel = sanitizarNomeCliente('Oziel (Club Barba)');
    assert.equal(oziel.nomeLimpo, 'Oziel');
    assert.equal(oziel.planoDetectado, 'Club Barba');

    const bruno = sanitizarNomeCliente('Bruno Carvalho');
    assert.equal(bruno.nomeLimpo, 'Bruno Carvalho');
    assert.equal(bruno.planoDetectado, '');
  });

  await t.test('normalizarTelefoneBR garante DDD 65 para Cuiabá e remove DDI 55', () => {
    assert.equal(normalizarTelefoneBR('+55 (65) 99694-6939'), '65996946939');
    assert.equal(normalizarTelefoneBR('5565996946939'), '65996946939');
    assert.equal(normalizarTelefoneBR('65996946939'), '65996946939');
    assert.equal(normalizarTelefoneBR('996946939'), '65996946939');
  });

  await t.test('escolherMelhorNome prefere nomes limpos sem parênteses e mais completos', () => {
    const melhor1 = escolherMelhorNome('Pablo Selle (Club Combo)', 'Pablo Henrique de Lima Selle');
    assert.equal(melhor1, 'Pablo Henrique de Lima Selle');

    const melhor2 = escolherMelhorNome('Cliente Avec (65996478950)', 'Jefferson Gonçalves Melo');
    assert.equal(melhor2, 'Jefferson Gonçalves Melo');
  });

  await t.test('carregarBaseConsolidada atribui diasSemVir = 0 para clientes com corte hoje', async () => {
    invalidarCacheRecuperacao();
    const hoje = '2026-11-19';
    const agendamentosHoje = [
      {
        id: 'ag-pablo-19',
        clienteNome: 'Pablo Selle (Club Combo - Asaas Dia 04)',
        clienteTelefone: '(65) 99694-6939',
        dataAgenda: hoje,
        horario: '17:15',
        status: 'confirmado',
        barbeiroNome: 'Bruno Mendes Pedroso',
        servicoNome: 'Corte Tradicional',
        valor: 75,
      },
      {
        id: 'ag-jefferson-19',
        clienteNome: 'Jefferson Gonçalves Melo',
        clienteTelefone: '(65) 99647-8950',
        dataAgenda: hoje,
        horario: '15:00',
        status: 'confirmado',
        barbeiroNome: 'Bruno Mendes Pedroso',
        servicoNome: 'Corte + Barba',
        valor: 110,
      },
    ];

    const base = await carregarBaseConsolidada({
      dataReferencia: hoje,
      agendamentosRecentes: agendamentosHoje,
      force: true,
    });

    const pablo = base.find((c) => c.telefoneNorm === '65996946939');
    assert.ok(pablo, 'Pablo deve existir na base consolidada');
    assert.equal(pablo.nome, 'Pablo Selle');
    assert.equal(pablo.planoClub, 'Club Combo - Asaas Dia 04');
    assert.equal(pablo.veioHoje, true);
    assert.equal(pablo.diasSemVir, 0);
    assert.equal(pablo.statusRecuperacao, 'ativo');
    assert.equal(pablo.emChurn, false);

    const jefferson = base.find((c) => c.telefoneNorm === '65996478950');
    assert.ok(jefferson, 'Jefferson deve existir na base consolidada');
    assert.equal(jefferson.veioHoje, true);
    assert.equal(jefferson.diasSemVir, 0);
    assert.equal(jefferson.statusRecuperacao, 'ativo');
    assert.equal(jefferson.emChurn, false);
  });

  await t.test('buildInteligenciaVendas exclui clientes atendidos hoje da lista de Reativação Anti-Churn', async () => {
    invalidarCacheRecuperacao();
    const mockBarbeariaErp = {
      listarAgendamentos: () => [
        {
          id: 'ag-pablo-live',
          clienteNome: 'Pablo Selle (Club Combo - Asaas Dia 04)',
          clienteTelefone: '65996946939',
          dataAgenda: '2026-11-19',
          horario: '17:15',
          status: 'confirmado',
          barbeiroNome: 'Bruno Mendes Pedroso',
          valor: 75,
        },
      ],
      listarComandasBarbearia: () => [],
      listarProdutosRevenda: () => [],
    };

    const diagnostico = await buildInteligenciaVendas(db(), {
      empresaId: 'dino',
      barbeariaErpKytto: mockBarbeariaErp,
      force: true,
    });

    assert.ok(diagnostico, 'Diagnóstico deve retornar dados');
    const reativacao = diagnostico.oportunidades?.reativacaoAntiChurn || [];
    const pabloNaReativacao = reativacao.find((c) => c.telefone?.includes('996946939') || c.nome.includes('Pablo'));
    assert.equal(pabloNaReativacao, undefined, 'Pablo NÃO deve estar na lista de reativação (esteve hoje)');

    // Verifica que as mensagens para outros clientes não têm preposição duplicada
    for (const c of reativacao) {
      assert.ok(!c.mensagemIa.includes('com o um dos'), `Mensagem não deve ter "com o um dos": ${c.mensagemIa}`);
      assert.ok(!c.mensagemIa.includes('com o nossa equipe'), `Mensagem não deve ter "com o nossa equipe": ${c.mensagemIa}`);
    }
  });
});
