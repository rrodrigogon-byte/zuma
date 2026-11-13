import test from 'node:test';
import assert from 'node:assert/strict';
import * as sorteiosServico from '../app/modules/sorteios/servico.js';
import { DINO_EMPRESA_CANONICA } from '../app/dino-equipe-seed.js';

test('Módulo de Sorteios - Geração de Bilhetes por Período e Sorteio Auditado', async (t) => {
  // Cria uma campanha limpa para o teste
  const camp = await sorteiosServico.criarCampanha(DINO_EMPRESA_CANONICA, {
    titulo: 'Sorteio Teste Automatizado Dino Barbearia',
    premioPrincipal: 'Kit Barba & Perfume de Luxo',
    status: 'ativa',
    regras: { valorMinimoBilhete: 50 },
  });
  assert.ok(camp.id, 'Deve criar a campanha de teste');

  await t.test('1. Deve gerar bilhetes em lote para quem veio nos últimos 3 meses', async () => {
    const res = await sorteiosServico.gerarBilhetesPorPeriodo({
      empresaId: DINO_EMPRESA_CANONICA,
      campanhaId: camp.id,
      periodo: '3_meses',
      regra: '1_por_cliente',
    });

    assert.equal(res.ok, true);
    assert.ok(res.totalBilhetesCampanha >= 0);
    assert.ok(typeof res.mensagem === 'string');
  });

  await t.test('2. Deve gerar bilhetes em lote para quem veio apenas este mês', async () => {
    const res = await sorteiosServico.gerarBilhetesPorPeriodo({
      empresaId: DINO_EMPRESA_CANONICA,
      campanhaId: camp.id,
      periodo: 'este_mes',
      regra: '1_por_cliente',
    });

    assert.equal(res.ok, true);
    assert.ok(typeof res.mensagem === 'string');
  });

  await t.test('3. O sorteio deve selecionar o ganhador sozinho via algoritmo auditado', async () => {
    // Garante que há ao menos um bilhete para sortear
    const emitido = await sorteiosServico.emitirBilhetes({
      empresaId: DINO_EMPRESA_CANONICA,
      campanhaId: camp.id,
      cliente: { nome: 'Cliente Premiado VIP', telefone: '65999990001' },
      quantidadeManual: 1,
      motivo: 'Teste unitário do algoritmo',
    });
    assert.equal(emitido.ok, true);

    const resultadoSorteio = await sorteiosServico.executarSorteio(DINO_EMPRESA_CANONICA, camp.id, {
      realizadoPor: 'Rodrigo Gonçalves (Dino)',
    });

    assert.equal(resultadoSorteio.ok, true);
    assert.ok(resultadoSorteio.ganhador.clienteNome, 'Deve haver um cliente ganhador');
    assert.ok(resultadoSorteio.ganhador.numeroSorte, 'Deve haver o número da sorte ganhador');
    assert.ok(resultadoSorteio.certificadoAuditoria.hashAuditoria, 'Deve haver prova matemática imutável');
  });
});
