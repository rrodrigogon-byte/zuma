import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CommerceUsersPanel, { localDateTimeInputValue } from './CommerceUsersPanel'

const roles = [
  { id: 'role-store', codigo: 'store_admin', nome: 'Operação da loja', permissoes: ['orders.read'] },
  { id: 'role-owner', codigo: 'tenant_owner', nome: 'Proprietário da empresa', permissoes: ['users.write'] },
  { id: 'role-platform', codigo: 'platform_owner', nome: 'Proprietário da plataforma', permissoes: ['users.write'] },
]

function render(props = {}) {
  return renderToStaticMarkup(<CommerceUsersPanel roles={roles} memberships={[]} currentUserId="operator" {...props} />)
}

describe('usuários Commerce', () => {
  it('orienta desativação reversível e não expõe senha nem criação direta de identidade', () => {
    const html = render({ memberships: [{ id: 'm-1', usuario_id: 'another', nome_completo: 'Pessoa Sintética', email: 'another@example.invalid', role_id: 'role-store', role_codigo: 'store_admin', role_nome: 'Operação da loja', ativo: true, expires_at: null }] })
    expect(html).toContain('Desativar')
    expect(html).toContain('auditoria')
    expect(html).not.toContain('senha temporária')
    expect(html).not.toContain('Excluir definitivamente')
  })

  it('exibe papel, validade e status de uma membership sem poder desativar a própria conta', () => {
    const html = render({ memberships: [{ id: 'membership', usuario_id: 'operator', nome_completo: 'Pessoa Sintética', email: 'operator@example.invalid', role_id: 'role-store', role_codigo: 'store_admin', role_nome: 'Operação da loja', ativo: true, expires_at: null }] })
    expect(html).toContain('Sem vencimento')
    expect(html).toContain('Operação da loja')
    expect(html).toMatch(/Desativar<\/button>/)
    expect(html).toMatch(/disabled=""[^>]*>Desativar|disabled[^>]*>Desativar/)
  })
  it('não desloca uma validade ao abrir e salvar em fuso brasileiro', () => {
    const timezone = process.env.TZ
    try {
      process.env.TZ = 'America/Sao_Paulo'
      const original = '2026-10-05T15:00:00.000Z'
      const local = localDateTimeInputValue(original)
      expect(local).toBe('2026-10-05T12:00')
      expect(new Date(local).toISOString()).toBe(original)
    } finally { process.env.TZ = timezone }
  })
  it('oferece convite nominal somente na vitrine Dino, sem senha no formulário', () => {
    expect(render({ isDino: false })).not.toContain('Convidar novo operador Dino')
    expect(render({ isDino: true, storefrontId: 'vitrine-teste', empresaId: 'empresa-teste' })).toContain('Convidar novo operador Dino')
  })
})
