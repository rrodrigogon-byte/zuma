// Todo código de erro de negócio lançado pelo Commerce precisa de um status HTTP próprio:
// sem ele, a API responde 500 "erro interno" e o cliente não vê a mensagem (ex.: limite de 20 unidades).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const routes = readFileSync(new URL('./commerce-routes.js', import.meta.url), 'utf8');
const mapBlock = routes.slice(routes.indexOf('const statusByCode = {'), routes.indexOf('const status = statusByCode[error?.code]'));
const INTERNAL = new Set(['ORDER_RESPONSE_INVALID']);

test('todo CommerceError lançado no core tem status HTTP mapeado', () => {
  const codes = new Set();
  for (const file of readdirSync(dir).filter(name => name.endsWith('.js') && !name.endsWith('.test.js'))) {
    const source = readFileSync(new URL(file, dir), 'utf8');
    for (const match of source.matchAll(/new CommerceError\([^;]*?'([A-Z][A-Z_]{3,})'/g)) codes.add(match[1]);
  }
  const missing = [...codes].filter(code => !INTERNAL.has(code) && !new RegExp(`\\b${code}:\\s*\\d{3}`).test(mapBlock));
  assert.deepEqual(missing, []);
});
