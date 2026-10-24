// Troca de loja sem empresa ativa (admin da plataforma ou dono de várias empresas, logo após
// o login): a loja escolhida precisa virar a ativa, como sempre foi na produção.
import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { test, expect, vi } from 'vitest'

const memoria = {}
vi.stubGlobal('localStorage', { getItem: (k) => (k in memoria ? memoria[k] : null), setItem: (k, v) => { memoria[k] = String(v) }, removeItem: (k) => { delete memoria[k] } })
vi.stubGlobal('window', { location: { hostname: 'kytto.com.br' }, addEventListener() {}, removeEventListener() {} })

test('trocarLoja funciona sem empresa ativa', async () => {
  const { AuthProvider, useAuth } = await import('./auth.jsx')
  localStorage.setItem('sp_user', JSON.stringify({ id: 'u1', role: 'admin' }))
  localStorage.setItem('sp_lojas_acessiveis', JSON.stringify([{ id: 'l1', empresaId: 'e1' }, { id: 'l2', empresaId: 'e2' }]))
  let ctx
  function Leitor() { ctx = useAuth(); return null }
  act(() => { create(createElement(AuthProvider, null, createElement(Leitor))) })
  expect(ctx.empresaAtiva).toBeFalsy()
  act(() => { ctx.trocarLoja('l2') })
  expect(ctx.lojaAtiva?.id).toBe('l2')
})
