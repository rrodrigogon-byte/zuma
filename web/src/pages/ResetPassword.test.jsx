import React from 'react'
import { act,create } from 'react-test-renderer'
import { beforeEach,describe,it,expect,vi } from 'vitest'
const mocks=vi.hoisted(()=>({post:vi.fn(),logout:vi.fn(),navigate:vi.fn()}))
vi.mock('../lib/api',()=>({api:{post:mocks.post}}))
vi.mock('../lib/auth',()=>({useAuth:()=>({logout:mocks.logout})}))
vi.mock('react-router-dom',()=>({useNavigate:()=>mocks.navigate}))
import ResetPassword from './ResetPassword'
const token='a'.repeat(43)
describe('Recuperação de senha',()=>{
 beforeEach(()=>{vi.clearAllMocks();globalThis.window={location:{hash:`#token=${token}`}};mocks.post.mockResolvedValue({ok:true})})
 it('valida token no corpo, confirma senha e encerra a sessão antiga',async()=>{
  let tree;await act(async()=>{tree=create(<ResetPassword/>)});
  expect(mocks.post).toHaveBeenCalledWith('/api/auth/redefinir-senha/validar',{token});
  const inputs=tree.root.findAllByType('input');
  await act(async()=>{inputs[0].props.onChange({target:{value:'Nova-Senha-Sintetica-123!'}});inputs[1].props.onChange({target:{value:'Nova-Senha-Sintetica-123!'}})});
  await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}})});
  expect(mocks.post).toHaveBeenCalledWith('/api/auth/redefinir-senha',{token,novaSenha:'Nova-Senha-Sintetica-123!',confirmacao:'Nova-Senha-Sintetica-123!'});expect(mocks.logout).toHaveBeenCalledOnce();expect(JSON.stringify(tree.toJSON())).toContain('Senha alterada');
 })
 it('link inválido não mostra formulário nem permite redefinição',async()=>{
  mocks.post.mockResolvedValue({ok:false});let tree;await act(async()=>{tree=create(<ResetPassword/>)});expect(tree.root.findAllByType('form')).toHaveLength(0);expect(JSON.stringify(tree.toJSON())).toContain('Link indisponível');expect(mocks.logout).not.toHaveBeenCalled();
 })
})
