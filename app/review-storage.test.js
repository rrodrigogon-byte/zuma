import test from 'node:test';
import assert from 'node:assert/strict';
import { armazenamentoAvaliacaoDuravel } from './db.js';

const mounted = '101 1 8:1 / / rw,relatime - ext4 /dev/root rw\n102 101 8:2 / /var/data rw,relatime - ext4 /dev/disk/by-id/render-disk rw';
const absent = '101 1 8:1 / / rw,relatime - ext4 /dev/root rw';

test('NPS em produção exige DB_PATH dentro de disco Render realmente montado', () => {
  assert.equal(armazenamentoAvaliacaoDuravel({ ambiente: 'production', arquivo: '/var/data/db.json', montagens: mounted }), true);
  assert.equal(armazenamentoAvaliacaoDuravel({ ambiente: 'production', arquivo: '/app/data/db.json', montagens: mounted }), false);
  assert.equal(armazenamentoAvaliacaoDuravel({ ambiente: 'production', arquivo: '/var/data/db.json', montagens: absent }), false);
  assert.equal(armazenamentoAvaliacaoDuravel({ ambiente: 'production', arquivo: '/var/data/../tmp/db.json', montagens: mounted }), false);
  assert.equal(armazenamentoAvaliacaoDuravel({ ambiente: 'development', arquivo: '/tmp/review-local.json', montagens: absent }), true);
});
