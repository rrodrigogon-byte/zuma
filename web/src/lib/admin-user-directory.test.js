import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../pages/admin/Usuarios.jsx', import.meta.url), 'utf8')
const server = readFileSync(new URL('../../../app/server.js', import.meta.url), 'utf8')

test('listagem usa a mesma rota GET existente no runtime real e não os CRUDs órfãos', () => {
  assert.match(page, /api\.get\('\/api\/admin\/usuarios-diretorio'\)/)
  assert.match(server, /app\.get\('\/api\/admin\/usuarios-diretorio'/)
  assert.doesNotMatch(page, /usuarios-mestres|api\.post\(|api\.delete\(|api\.patch\(/)
  assert.match(page, /\/admin\/ecommerce\?tab=usuarios/)
})

test('a tabela distingue empresa, origem, papel, permissões e não apresenta documentos nem senha', () => {
  for (const field of ['Empresa', 'Origem', 'Papel e unidade', 'Permissões Commerce', 'Ativo, sem vínculo Commerce']) assert.ok(page.includes(field))
  assert.doesNotMatch(page, /\bcpf\b|senhaHash|password_hash/i)
})
