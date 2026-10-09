import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const web=dirname(dirname(fileURLToPath(import.meta.url))), temp=mkdtempSync(join(web,'.account-tests-'))
after(()=>rmSync(temp,{recursive:true,force:true}))
await build({entryPoints:[join(web,'src/pages/admin/CommerceAccountManager.jsx')],outfile:join(temp,'accounts.cjs'),bundle:true,format:'cjs',platform:'node',jsx:'automatic',packages:'external',loader:{'.css':'empty'},plugins:[{name:'api',setup(builder){builder.onResolve({filter:/\/lib\/api$/},()=>({path:'api',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const api={get:(...a)=>globalThis.accountsApi.get(...a),post:(...a)=>globalThis.accountsApi.post(...a),patch:(...a)=>globalThis.accountsApi.patch(...a)}'}))}}]})
const Manager=createRequire(import.meta.url)(join(temp,'accounts.cjs')).default
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join(' ')
const options={canManage:true,companies:[{id:'A',nome:'Empresa A'},{id:'B',nome:'Empresa B'}],stores:[],roles:[{codigo:'store_admin',nome:'Administrador da loja'},{codigo:'tenant_owner',nome:'Dono da empresa'},{codigo:'finance',nome:'Financeiro'},{codigo:'customer',nome:'Cliente'}]}
async function fixture({allowed=true}={}){
 const posts=[]
 globalThis.accountsApi={get:async path=>path.endsWith('/options')?allowed?options:Promise.reject(Object.assign(new Error('negado'),{status:403})):{items:[]},post:(path,body)=>new Promise((resolve,reject)=>posts.push({path,body,resolve,reject}))}
 let render;await act(async()=>{render=Renderer.create(React.createElement(Manager,{empresaId:'A'}))})
 const button=label=>render.root.findAllByType('button').find(node=>text(node).includes(label))
 const click=async label=>act(()=>button(label).props.onClick())
 return{render,posts,button,click,dialog:()=>render.root.findByProps({role:'dialog'}),close:()=>act(()=>render.unmount())}
}
test('gestão global não aparece sem autorização do servidor',async()=>{const f=await fixture({allowed:false});try{assert.equal(f.render.toJSON(),null);assert.equal(f.posts.length,0)}finally{f.close()}})
test('criação envia perfis independentes de duas empresas uma única vez',async()=>{
 const f=await fixture();try{
  await f.click('Criar usuário')
  await act(()=>{const inputs=f.dialog().findAllByType('input');inputs[0].props.onChange({target:{value:'Pessoa local'}});inputs[1].props.onChange({target:{value:'local@example.invalid'}});inputs[3].props.onChange({target:{value:'Senha-Local-123!'}})})
  await f.click('Adicionar empresa')
  await act(()=>{const fields=f.dialog().findAllByType('fieldset')[1];const selects=fields.findAllByType('select');selects[0].props.onChange({target:{value:'B'}});selects[1].props.onChange({target:{value:'finance'}})})
  const submit=f.dialog().findByType('form').props.onSubmit
  await act(()=>{submit({preventDefault(){}});submit({preventDefault(){}})})
  assert.equal(f.posts.length,1);assert.deepEqual(f.posts[0].body.access.map(a=>[a.empresaId,a.roleCode]),[['A','store_admin'],['B','finance']])
  await act(async()=>f.posts[0].reject(new Error('conflito de identidade')))
  assert.match(text(f.dialog().findByProps({role:'alert'})),/conflito de identidade/)
 }finally{f.close()}
})
test('cliente usa cadastro separado e nunca envia senha, conta ou papel administrativo',async()=>{
 const f=await fixture();try{
  await f.click('Cadastrar cliente');assert.equal(f.dialog().findAllByProps({type:'password'}).length,0)
  await act(()=>{f.dialog().findAllByType('input')[0].props.onChange({target:{value:'Cliente local'}})})
  await act(()=>{f.dialog().findByType('form').props.onSubmit({preventDefault(){}})})
  assert.equal(f.posts.length,1);assert.match(f.posts[0].path,/\/customers$/);assert.deepEqual(f.posts[0].body.empresas,['A']);assert.equal('senha' in f.posts[0].body,false);assert.equal('access' in f.posts[0].body,false)
  await act(async()=>f.posts[0].resolve({items:[]}));assert.match(text(f.render.toJSON()),/sem senha e sem acesso ao painel/)
 }finally{f.close()}
})
