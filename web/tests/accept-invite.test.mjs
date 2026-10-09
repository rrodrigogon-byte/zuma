import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { MemoryRouter } from 'react-router-dom'
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const web=dirname(dirname(fileURLToPath(import.meta.url))),temp=mkdtempSync(join(web,'.invite-tests-'))
after(()=>rmSync(temp,{recursive:true,force:true}))
await build({entryPoints:[join(web,'src/pages/AcceptOperationalInvite.jsx')],outfile:join(temp,'invite.cjs'),bundle:true,format:'cjs',platform:'node',jsx:'automatic',packages:'external',loader:{'.css':'empty'}})
const Invite=createRequire(import.meta.url)(join(temp,'invite.cjs')).default
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join(' ')
async function fixture(token='A'.repeat(43)){
 const oldWindow=globalThis.window,oldDocument=globalThis.document,oldFetch=globalThis.fetch
 const posts=[],urls=[]
 globalThis.window={location:{hash:token?`#token=${token}`:'',pathname:'/aceitar-convite',search:''},history:{replaceState(a,b,url){urls.push(url)}}}
 globalThis.document={title:'',querySelector:()=>null,createElement:()=>({setAttribute(){}}),head:{appendChild(){}}}
 globalThis.fetch=(url,options)=>new Promise(resolve=>posts.push({url,options,resolve}))
 let render;await act(()=>{render=Renderer.create(React.createElement(MemoryRouter,null,React.createElement(Invite)))})
 return{render,posts,urls,close(){act(()=>render.unmount());globalThis.window=oldWindow;globalThis.document=oldDocument;globalThis.fetch=oldFetch}}
}
test('convite sem token não apresenta formulário nem envia solicitação',async()=>{const f=await fixture('');try{assert.equal(f.render.root.findAllByType('form').length,0);assert.equal(f.posts.length,0);assert.match(text(f.render.toJSON()),/convite não está disponível/)}finally{f.close()}})
test('token sai da URL, nunca aparece no conteúdo e envio só ocorre após requisitos e confirmação',async()=>{
 const f=await fixture();try{
  assert.deepEqual(f.urls,['/aceitar-convite']);assert.equal(f.posts.length,0);assert.doesNotMatch(JSON.stringify(f.render.toJSON()),/A{43}/)
  const submit=f.render.root.findByType('form').props.onSubmit
  await act(()=>{submit({preventDefault(){}})});assert.equal(f.posts.length,0)
  await act(()=>{const inputs=f.render.root.findAllByType('input');inputs[0].props.onChange({target:{value:'Senha-Local-Forte-123!'}});inputs[1].props.onChange({target:{value:'Senha-Local-Forte-123!'}})})
  assert.match(text(f.render.toJSON()),/Senha forte/)
  const validSubmit=f.render.root.findByType('form').props.onSubmit
  await act(()=>{validSubmit({preventDefault(){}});validSubmit({preventDefault(){}})})
  assert.equal(f.posts.length,1);assert.equal(f.posts[0].options.referrerPolicy,'no-referrer');assert.deepEqual(JSON.parse(f.posts[0].options.body),{token:'A'.repeat(43),password:'Senha-Local-Forte-123!'})
  await act(async()=>f.posts[0].resolve({ok:true,status:200}));assert.match(text(f.render.toJSON()),/Senha definida com sucesso/);assert.equal(f.render.root.findAllByType('input').length,0)
 }finally{f.close()}
})
