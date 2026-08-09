import assert from 'node:assert/strict';
process.env.DB_PATH = `/tmp/kytto-perdas-${Date.now()}.json`; process.env.GCS_BUCKET = '';
const modulo = await import('./perdas-inventario-kytto.js');
let passou = 0; async function testar(nome, fn) { try { await fn(); passou++; console.log(`✓ ${nome}`) } catch (erro) { console.error(`✗ ${nome}: ${erro.message}`); process.exitCode = 1 } }
const empresaA = 'empresa-perdas-a'; const empresaB = 'empresa-perdas-b'; let inventario;
await testar('registra perda com saldo e impacto financeiro auditáveis', () => { const item = modulo.registrarOcorrencia(empresaA, { tipo:'perda', produtoId:'p1', produtoNome:'Produto 1', qtd:2, unidade:'UN', motivo:'Quebra de embalagem', custoUnitario:5, saldoAnterior:10, saldoFinal:8, usuario:'admin' }); assert.equal(item.valorImpacto, 10); assert.equal(item.saldoFinal, 8); });
await testar('mantém perdas isoladas entre empresas', () => { assert.equal(modulo.listarOcorrencias(empresaB).length, 0); assert.equal(modulo.listarOcorrencias(empresaA).length, 1); });
await testar('abre inventário rotativo com snapshot do saldo', () => { inventario = modulo.criarInventario(empresaA, { tipo:'rotativo', categoria:'Bebidas', iniciadoPor:'admin' }, [{ produtoId:'p1', nome:'Produto 1', qtd:8, unidade:'UN', cat:'Bebidas', custoMedioPonderado:5 }, { produtoId:'p2', nome:'Produto 2', qtd:4, unidade:'UN', cat:'Bebidas', custoMedioPonderado:3 }]); assert.equal(inventario.status, 'aberto'); assert.equal(inventario.itens.length, 2); });
await testar('registra contagens e divergências por item', () => { let atualizado = modulo.registrarContagem(empresaA, inventario.id, 'p1', 7, 'conferente'); atualizado = modulo.registrarContagem(empresaA, inventario.id, 'p2', 4, 'conferente'); assert.equal(atualizado.itens.find(item => item.produtoId === 'p1').divergencia, -1); });
await testar('conclui inventário com ajustes e acuracidade calculada', () => { const resultado = modulo.concluirInventario(empresaA, inventario.id, 'admin'); assert.equal(resultado.ajustes.length, 1); assert.equal(resultado.inventario.resumo.acuracidade, 50); });
await testar('consolida relatório de acuracidade e ranking de perdas', () => { const relatorio = modulo.relatorioAcuracidade(empresaA); assert.equal(relatorio.acuracidade, 50); assert.equal(relatorio.rankingPerdas[0].produtoId, 'p1'); assert.equal(relatorio.totalPerdas, 10); });
if (!process.exitCode) console.log(`\n✅ Perdas e inventário: ${passou} testes passaram`);
process.exit(process.exitCode || 0);
