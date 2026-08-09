import assert from 'node:assert/strict';
process.env.DB_PATH = `/tmp/kytto-reservas-${Date.now()}.json`; process.env.GCS_BUCKET = '';
const reservas = await import('./reservas-kytto.js');
let aprovados = 0; async function testar(nome, fn) { try { await fn(); aprovados++; console.log(`✓ ${nome}`) } catch (erro) { console.error(`✗ ${nome}: ${erro.message}`); process.exitCode = 1 } }
const empresaA = 'empresa-reservas-a'; const empresaB = 'empresa-reservas-b';
let reserva;
await testar('cria reserva confirmada com horário no fuso Cuiabá', () => { reserva = reservas.criarReserva(empresaA, { clienteNome: 'Cliente Teste', mesaNum: 2, pessoas: 4, inicioEm: '2026-08-15T19:00', duracaoMinutos: 120 }); assert.equal(reserva.status, 'confirmada'); assert.equal(reserva.mesaNum, 2); });
await testar('impede conflito de mesa no intervalo da reserva', () => { assert.throws(() => reservas.criarReserva(empresaA, { clienteNome: 'Conflito', mesaNum: 2, pessoas: 2, inicioEm: '2026-08-15T20:00', duracaoMinutos: 60 }), /já possui reserva/); });
await testar('permite reserva em mesa diferente no mesmo intervalo', () => { const outra = reservas.criarReserva(empresaA, { clienteNome: 'Outra mesa', mesaNum: 3, pessoas: 2, inicioEm: '2026-08-15T20:00', duracaoMinutos: 60 }); assert.equal(outra.mesaNum, 3); });
await testar('controla transições e no-show auditável', () => { const noShow = reservas.alterarStatusReserva(empresaA, reserva.id, 'no_show', 'operador'); assert.equal(noShow.status, 'no_show'); assert.throws(() => reservas.alterarStatusReserva(empresaA, reserva.id, 'confirmada'), /Não é possível/); });
await testar('mantém reservas isoladas entre empresas', () => { assert.equal(reservas.listarReservas(empresaB).length, 0); assert.ok(reservas.listarReservas(empresaA).length >= 2); });
await testar('adiciona, chama e finaliza senha da fila com notificação pendente de configuração', () => { const item = reservas.adicionarFila(empresaA, { clienteNome: 'Fila Teste', pessoas: 3, telefone: '65999999999' }); const chamado = reservas.chamarFila(empresaA, item.id, 5, 'garçom'); assert.equal(chamado.status, 'chamado'); assert.equal(chamado.notificacoes[0].status, 'pendente_configuracao'); const finalizado = reservas.finalizarFila(empresaA, item.id, 'atendido', 'garçom'); assert.equal(finalizado.status, 'atendido'); });
await testar('calcula ocupação prevista e taxa de no-show', () => { const indicador = reservas.ocupacaoPrevista(empresaA, '2026-08-15'); assert.ok(indicador.porMesa[3]); assert.equal(indicador.noShows, 1); assert.equal(indicador.taxaNoShow, 50); });
if (!process.exitCode) console.log(`\n✅ Reservas e fila: ${aprovados} testes passaram`);
process.exit(process.exitCode || 0);
