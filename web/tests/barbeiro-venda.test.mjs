import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const web=dirname(dirname(fileURLToPath(import.meta.url))),temp=mkdtempSync(join(web,'.barbeiro-test-'))
after(()=>rmSync(temp,{recursive:true,force:true}))
await build({entryPoints:[join(web,'src/pages/barbeiro/BarbeiroVendaRapida.jsx')],outfile:join(temp,'venda.cjs'),bundle:true,format:'cjs',platform:'node',jsx:'automatic',packages:'external',loader:{'.css':'empty'},plugins:[{name:'api-fixture',setup(b){b.onResolve({filter:/\/lib\/api$/},()=>({path:'api',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const api={get:(...a)=>globalThis.vendaApi.get(...a),post:(...a)=>globalThis.vendaApi.post(...a)}'}))}}]})
const Venda=createRequire(import.meta.url)(join(temp,'venda.cjs')).default
const text=n=>typeof n==='string'?n:(n.children||[]).map(text).join(' ')
async function fixture(){
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true})
 globalThis.window={addEventListener:()=>{},removeEventListener:()=>{}}
 const posts=[],states=[]
 globalThis.vendaApi={get:async()=>({servicos:[{id:'s1',nome:'Corte',preco:50,duracaoMinutos:30}],produtos:[{id:'p1',nome:'Pomada',preco:30,estoque:2}]}),post:(path,body,opts)=>new Promise((resolve,reject)=>posts.push({path,body,opts,resolve,reject}))}
 let render;await act(async()=>{render=Renderer.create(React.createElement(Venda,{profissional:{id:'bruno',nome:'Bruno'},onEstadoChange:v=>states.push(v)}))})
 const button=label=>render.root.findAllByType('button').find(n=>text(n).includes(label))
 const click=async label=>{await act(async()=>{button(label).props.onClick()})}
 await act(async()=>render.root.findAllByType('input')[0].props.onChange({target:{value:'Cliente teste'}}))
 return{render,posts,states,button,click,close:()=>act(()=>render.unmount())}
}
test('lançamento rápido envia IDs e quantidades, sem preço do cliente e sem cobrar',async()=>{
 const f=await fixture();try{await f.click('Corte');await f.click('Produtos');await f.click('Pomada');await f.click('Salvar comanda');assert.equal(f.posts.length,1);const p=f.posts[0];assert.match(p.path,/modo-barbeiro\/comandas$/);assert.equal(p.body.itens.length,2);assert.equal(p.body.itens[0].preco,undefined);assert.ok(p.opts.headers['Idempotency-Key']);await act(async()=>p.resolve({comanda:{id:'c1',total:80,saldoPendente:80,itens:[]}}));assert.match(text(f.render.toJSON()),/pagamento ainda precisa/);assert.equal(f.states.at(-1),false)}finally{f.close()}
})
test('duplo clique envia uma vez e falha ambígua repete mesma chave e corpo',async()=>{
 const f=await fixture();try{await f.click('Corte');const save=f.button('Salvar comanda').props.onClick;await act(async()=>{save();save()});assert.equal(f.posts.length,1);await act(async()=>f.posts[0].reject(Object.assign(new Error('gateway'),{status:502})));assert.equal(f.button('Corte').props.disabled,true);assert.equal(f.states.at(-1),true);await f.click('Conferir e tentar novamente');assert.equal(f.posts.length,2);assert.deepEqual(f.posts[1].body,f.posts[0].body);assert.equal(f.posts[1].opts.headers['Idempotency-Key'],f.posts[0].opts.headers['Idempotency-Key']);await act(async()=>f.posts[1].resolve({comanda:{id:'c1',total:50,saldoPendente:50,itens:[]}}));assert.match(text(f.render.toJSON()),/Comanda salva/)}finally{f.close()}
})
test('estoque limita quantidade e rejeição definitiva permite corrigir carrinho',async()=>{
 const f=await fixture();try{await f.click('Produtos');await f.click('Pomada');await f.click('Pomada');await f.click('Pomada');await f.click('Salvar comanda');assert.equal(f.posts[0].body.itens[0].quantidade,2);await act(async()=>f.posts[0].reject(Object.assign(new Error('Estoque insuficiente'),{status:409})));assert.equal(f.button('Pomada').props.disabled,false);assert.match(text(f.render.toJSON()),/Estoque insuficiente/);assert.equal(f.states.at(-1),false)}finally{f.close()}
})
