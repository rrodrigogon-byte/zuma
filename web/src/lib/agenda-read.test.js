import test from 'node:test'
import assert from 'node:assert/strict'
import { lerAgenda, erroAgenda } from './agenda-read.js'
test('consulta se recupera de 502/503 com tentativas limitadas', async () => {
  let n=0;const esperas=[]
  const r=await lerAgenda(async()=>{if(++n<3)throw Object.assign(new Error('gateway'),{status:n===1?502:503});return 'ok'},{esperar:async n=>esperas.push(n)})
  assert.equal(r,'ok');assert.equal(n,3);assert.deepEqual(esperas,[600,1600])
})
test('erro persistente para após 3 e falha de permissão não repete', async () => {
  for(const status of [502,403,401,400]){let n=0;await assert.rejects(()=>lerAgenda(async()=>{n++;throw Object.assign(new Error('falhou'),{status})},{esperar:async()=>{}}));assert.equal(n,status===502?3:1)}
  assert.match(erroAgenda({status:502}),/temporariamente indisponível/)
})
test('cancelamento da consulta interrompe novas tentativas', async () => {
  let ativo=true,n=0
  assert.equal(await lerAgenda(async()=>{n++;throw {status:502}},{ativo:()=>ativo,esperar:async()=>{ativo=false}}),undefined)
  assert.equal(n,1)
})
