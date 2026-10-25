import React from 'react'
import {act,create} from 'react-test-renderer'
import {beforeEach,describe,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({post:vi.fn()}))
vi.mock('../../../lib/api',()=>({api:{post:mocks.post}}))
import PerfilPacoteTelefone from './PerfilPacoteTelefone'
describe('Perfil por telefone',()=>{
 beforeEach(()=>vi.resetAllMocks())
 it('só consulta por ação explícita e apresenta validade e saldo do cliente',async()=>{
  mocks.post.mockResolvedValue({perfil:'pacote_vencido',visitasConhecidas:3,orientacao:'Renove com a equipe.',pacotes:[{assinaturaId:'sintetica',plano:'Pacote 4',utilizavel:false,restantes:4,sessoesNoCiclo:4,pagoAte:'2026-10-10T04:00:00Z',proximaRenovacao:'2026-10-10T04:00:00Z',servicosIncluidos:['Corte']}]})
  let tree;await act(async()=>{tree=create(<PerfilPacoteTelefone/>)});expect(mocks.post).not.toHaveBeenCalled()
  await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'65988880001'}}))
  await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}))
  expect(mocks.post).toHaveBeenCalledWith('/api/admin/barbearia/captacao/perfil-cliente',{telefone:'65988880001'})
  const result=JSON.stringify(tree.toJSON());expect(result).toContain('Pacote vencido');expect(result).toContain('Benefícios indisponíveis');expect(result).toContain('10/10/2026');expect(result).toContain('Corte')
 })
 it('ambiguidade não inventa pacote e mudar telefone limpa o resultado anterior',async()=>{
  mocks.post.mockResolvedValue({perfil:'cadastro_ambiguo',pacotes:[]});let tree;await act(async()=>{tree=create(<PerfilPacoteTelefone/>)});
  await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));expect(JSON.stringify(tree.toJSON())).toContain('Cadastros precisam de conferência')
  await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'65999990000'}}));expect(tree.root.findAllByProps({role:'status'})).toHaveLength(0)
 })
 it('erro de consulta não apresenta perfil ou benefícios como confirmados',async()=>{
  mocks.post.mockRejectedValue(new Error('Consulta indisponível'));let tree;await act(async()=>{tree=create(<PerfilPacoteTelefone/>)});await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));expect(JSON.stringify(tree.toJSON())).toContain('Consulta indisponível');expect(tree.root.findAllByProps({role:'status'})).toHaveLength(0)
 })
})
