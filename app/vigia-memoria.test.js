import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarVigiaMemoria, situacaoMemoria } from './vigia-memoria.js';

test('fora de produção e sem limite configurado a vigia fica desligada', () => {
  const situacao = situacaoMemoria();
  assert.equal(situacao.vigia.ativa, false);
  assert.equal(situacao.vigia.motivoInativa, 'sem_limite');
  assert.ok(situacao.rssMb > 0 && situacao.tetoHeapMb > 0);
});

test('com limite e memória acima do gatilho a vigia coleta e respeita o intervalo mínimo', async () => {
  const estado = iniciarVigiaMemoria({ limiteMb: 512, fracao: 0.002, intervaloMs: 5, minimoEntreColetasMs: 60_000 });
  assert.equal(estado.ativa, true);
  assert.equal(estado.gatilhoMb, 1);
  let lixo = Array.from({ length: 40 }, (_, i) => new Array(200_000).fill(i)); // ~60 MB de lixo
  assert.ok(lixo.length);
  lixo = null;
  await new Promise((resolve) => setTimeout(resolve, 80));
  const { vigia } = situacaoMemoria();
  assert.equal(vigia.coletas, 1, 'só uma coleta dentro do intervalo mínimo');
  assert.ok(vigia.ultimaColetaEm);
  // chamar de novo não cria um segundo relógio
  assert.equal(iniciarVigiaMemoria({ limiteMb: 1 }).limiteMb, 512);
});

test('limite do contêiner vem do cgroup (v2, v1) e ignora "sem limite"', async () => {
  const { limiteDoConteinerMb } = await import('./vigia-memoria.js');
  assert.equal(limiteDoConteinerMb(() => '2147483648\n'), 2048);
  assert.equal(limiteDoConteinerMb((c) => { if (c.endsWith('memory.max')) return 'max'; return '536870912'; }), 512);
  assert.equal(limiteDoConteinerMb(() => '9223372036854771712'), 0);
  assert.equal(limiteDoConteinerMb(() => { throw new Error('sem cgroup'); }), 0);
});
