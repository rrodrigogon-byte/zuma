// Toda permissão exigida pelas rotas novas precisa existir em commerce_permissions (semeada pelas
// migrações); uma permissão inexistente dá 403 para todo mundo, inclusive o dono da empresa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../migrations/', import.meta.url);
const semeadas = new Set(readdirSync(dir).filter((f) => f.endsWith('.sql')).flatMap((f) => [...readFileSync(new URL(f, dir), 'utf8').matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1])));

for (const arquivo of ['../modules/razao/rotas.js', '../modules/suprimentos/rotas.js', '../modules/unidades/rotas.js', '../modules/fiscal/rotas.js', '../modules/salao/rotas.js', '../modules/pdv-offline/rotas.js']) {
  test(`permissões de ${arquivo} existem nas migrações`, () => {
    const fonte = readFileSync(new URL(arquivo, import.meta.url), 'utf8');
    const usadas = [...fonte.matchAll(/(?:rota|gestao|escopoDaRequisicao|escopoDuplo)\([^'"]*'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]);
    for (const p of new Set(usadas)) assert.ok(semeadas.has(p), `${p} não existe em commerce_permissions`);
  });
}
