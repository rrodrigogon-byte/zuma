import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
const code=fs.readFileSync(new URL('../public/service-worker.js',import.meta.url),'utf8')
function setup(){
 const handlers={},dados=new Map(),fetches=[]
 let reply=()=>new Response('bad gateway',{status:502})
 const cache={put:async(k,v)=>dados.set(typeof k==='string'?k:k.url,v.clone()),match:async k=>dados.get(typeof k==='string'?k:k.url)?.clone(),addAll:async()=>{}}
 const context={URL,Response,Request,Date,Error,JSON,console,caches:{open:async()=>cache,match:cache.match,keys:async()=>[],delete:async()=>true},fetch:async r=>{fetches.push(r);return reply(r)},self:{location:{origin:'https://test.invalid'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:()=>{},clients:{claim:()=>{}}}}
 vm.runInNewContext(code,context)
 return{handlers,dados,cache,fetches,setReply:f=>{reply=f},dispatch:async request=>{let result;handlers.fetch({request,respondWith:r=>{result=r}});return result&&await result}}
}
test('PWA usa cópia identificada da agenda durante 502, sem misturar usuário ou unidade',async()=>{
 const f=setup();const req=new Request('https://test.invalid/api/admin/barbearia/modo-barbeiro?data=2026-10-09',{headers:{'X-Kytto-Usuario':'u1','X-Empresa-Id':'a','X-Loja-Id':'matriz'}})
 f.setReply(()=>Response.json({agendamentos:[{id:'a1'}]}));assert.equal((await f.dispatch(req)).status,200)
 f.setReply(()=>new Response('',{status:502}));const offline=await(await f.dispatch(req)).json();assert.equal(offline._offline.motivo,'servidor');assert.equal(offline.agendamentos[0].id,'a1')
 const outro=new Request(req.url,{headers:{'X-Kytto-Usuario':'u2','X-Empresa-Id':'a','X-Loja-Id':'matriz'}});assert.equal((await f.dispatch(outro)).status,503)
 const loja=new Request(req.url,{headers:{'X-Kytto-Usuario':'u1','X-Empresa-Id':'a','X-Loja-Id':'outra'}});assert.equal((await f.dispatch(loja)).status,503)
 f.setReply(()=>new Response('',{status:401}));assert.equal((await f.dispatch(req)).status,401)
})
test('shell já visitado abre em 502; venda nunca é interceptada nem repetida',async()=>{
 const f=setup();await f.cache.put('/barbeiro/dino',new Response('<html>app guardado</html>'))
 const r=await f.dispatch({url:'https://test.invalid/barbeiro/dino?data=2026-10-09',method:'GET',mode:'navigate'})
 assert.match(await r.text(),/app guardado/)
 const antes=f.fetches.length;assert.equal(await f.dispatch(new Request('https://test.invalid/api/admin/barbearia/modo-barbeiro/comandas',{method:'POST',body:'{}'})),undefined);assert.equal(f.fetches.length,antes)
})
