import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
const web=dirname(dirname(fileURLToPath(import.meta.url))), temp=mkdtempSync(join(web,'.caixa-test-'))
after(()=>rmSync(temp,{recursive:true,force:true}))
await build({entryPoints:[join(web,'src/pages/admin/BarbeariaComandasAbertas.jsx')],outfile:join(temp,'panel.cjs'),loader:{'.css':'empty'},bundle:true,format:'cjs',platform:'node',jsx:'automatic',packages:'external',plugins:[{name:'api-fixture',setup(b){b.onResolve({filter:/\/lib\/api$/},()=>({path:'api',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const api={get:(...args)=>globalThis.cashApi(...args)};export const fmtR=v=>`R$ ${Number(v||0).toFixed(2)}`;export const fmtDate=v=>v'}))}}]})
const Panel=createRequire(import.meta.url)(join(temp,'panel.cjs')).default
const text=n=>typeof n==='string'?n:(n?.children||[]).map(text).join(' ')
const entries=[{id:'old',clienteNome:'Ana Souza',status:'parcialmente_paga',criadoEm:'2020-01-01',profissionalId:'b',total:100,totalPago:30,saldoPendente:70,itens:[{nome:'Corte',quantidade:1}]},{id:'new',clienteNome:'José',status:'aberta',profissionalId:'d',total:40,totalPago:0,saldoPendente:40,itens:[]},{id:'paid',clienteNome:'Quitada',status:'paga',saldoPendente:0}]
test('mostra pendências antigas e saldo, filtra profissional e abre sem registrar pagamento',async()=>{
 const calls=[],opened=[];globalThis.cashApi=async path=>{calls.push(path);return{comandas:entries}}
 let r;await act(async()=>{r=Renderer.create(React.createElement(Panel,{profissionais:[{id:'b',nome:'Bruno'},{id:'d',nome:'Dino'}],onOpen:c=>opened.push(c)}))})
 try {assert.deepEqual(calls,['/api/admin/barbearia/comandas?pendentes=1']);assert.match(text(r.toJSON()),/Ana Souza/);assert.match(text(r.toJSON()),/110.00/);assert.doesNotMatch(text(r.toJSON()),/Quitada/)
 await act(async()=>r.root.findAllByType('select')[1].props.onChange({target:{value:'b'}}));assert.doesNotMatch(text(r.toJSON()),/José/);assert.match(text(r.toJSON()),/70.00/)
 await act(async()=>r.root.findAllByType('button').find(n=>text(n)==='Conferir comanda e receber').props.onClick());assert.equal(opened[0].id,'old');assert.equal(calls.length,1)
 }finally{await act(()=>r.unmount())}
})
test('falha de atualização retira valores e ações antigas; não mostra zero como consulta válida',async()=>{
 let fail=false;globalThis.cashApi=async()=>{if(fail)throw Error('Falha da consulta');return{comandas:entries}}
 let r;await act(async()=>{r=Renderer.create(React.createElement(Panel,{onOpen:()=>{}}))})
 try {fail=true;await act(async()=>r.root.findAllByType('button')[0].props.onClick());assert.match(text(r.toJSON()),/Falha da consulta/);assert.doesNotMatch(text(r.toJSON()),/Ana Souza|Saldo a receber:/)}finally{await act(()=>r.unmount())}
})
