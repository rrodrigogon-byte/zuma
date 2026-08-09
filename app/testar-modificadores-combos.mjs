import assert from 'node:assert/strict';
process.env.DB_PATH = `/tmp/kytto-modificadores-${Date.now()}.json`;
process.env.GCS_BUCKET = '';
const mod = await import('./modificadores-combos-kytto.js');

let aprovados = 0;
async function testar(nome, fn) { try { await fn(); aprovados += 1; console.log(`✓ ${nome}`); } catch (erro) { console.error(`✗ ${nome}: ${erro.message}`); process.exitCode = 1; } }
const empresaA = 'empresa-modificadores-a';
const empresaB = 'empresa-modificadores-b';
let grupo;

await testar('cria grupo obrigatório de modificadores isolado por empresa', () => {
  grupo = mod.criarGrupoModificadores(empresaA, { nome: 'Escolha o ponto', obrigatorio: true, minimo: 1, maximo: 1, opcoes: [{ nome: 'Ao ponto', precoAdicional: 0 }, { nome: 'Bem passado', precoAdicional: 1.5, custoAdicional: 0.4, produtoId: 'insumo-bacon', quantidadeEstoque: 1 }] });
  assert.equal(mod.listarGruposModificadores(empresaA).length, 1);
  assert.equal(mod.listarGruposModificadores(empresaB).length, 0);
});

await testar('rejeita produto com grupo obrigatório sem seleção', () => {
  assert.throws(() => mod.resolverModificadoresProduto(empresaA, { modificadorGrupoIds: [grupo.id] }, []), /Selecione ao menos/);
});

await testar('calcula adicional de preço e custo por seleção válida', () => {
  const opcao = grupo.opcoes.find(item => item.nome === 'Bem passado');
  const resultado = mod.resolverModificadoresProduto(empresaA, { modificadorGrupoIds: [grupo.id] }, [{ grupoId: grupo.id, opcaoId: opcao.id }]);
  assert.equal(resultado.itens.length, 1);
  assert.equal(resultado.adicionalPreco, 1.5);
  assert.equal(resultado.adicionalCusto, 0.4);
  assert.equal(resultado.itens[0].produtoId, 'insumo-bacon');
});

await testar('rejeita modificador que não pertence ao produto', () => {
  const opcao = grupo.opcoes[0];
  assert.throws(() => mod.resolverModificadoresProduto(empresaA, { modificadorGrupoIds: [] }, [{ grupoId: grupo.id, opcaoId: opcao.id }]), /não pertence/);
});

await testar('cria e atualiza combo com componentes', () => {
  const combo = mod.criarCombo(empresaA, { nome: 'Combo teste', preco: 19.9, setor: 'bar', componentes: [{ produtoId: 'produto-1', qtd: 1 }, { produtoId: 'produto-2', qtd: 2 }] });
  assert.equal(combo.componentes.length, 2);
  const atualizado = mod.atualizarCombo(empresaA, combo.id, { preco: 18.5 });
  assert.equal(atualizado.preco, 18.5);
  assert.equal(mod.obterCombo(empresaA, combo.id).nome, 'Combo teste');
});

await testar('preserva isolamento de combos entre empresas', () => {
  assert.equal(mod.listarCombos(empresaB).length, 0);
  assert.equal(mod.listarCombos(empresaA).length, 1);
});

if (!process.exitCode) console.log(`\n✅ Modificadores e combos: ${aprovados} testes passaram`);
process.exit(process.exitCode || 0);
