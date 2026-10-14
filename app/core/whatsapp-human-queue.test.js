import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.js';
import { createCommerceAdminRouter } from './commerce-routes.js';
import { listWhatsappAiSessions, claimWhatsappAiHandoff } from './whatsapp-ai.js';
const E='11111111-1111-4111-8111-111111111111';
const L='22222222-2222-4222-8222-222222222222';
const U='33333333-3333-4333-8333-333333333333';
const S='44444444-4444-4444-8444-444444444444';
const O='55555555-5555-4555-8555-555555555555';
const context=()=>({empresaId:E,lojaId:L,usuarioId:U});
function response(){return {statusCode:200,status(n){this.statusCode=n;return this},json(x){this.body=x;return this}}}
function handler(path,method='get'){return createCommerceAdminRouter().stack.find(x=>x.route?.path===path&&x.route.methods[method]).route.stack.at(-1).handle}
const originals=()=>({queryRead:db.queryRead,query:db.query,transaction:db.transaction});
function restore(o){Object.assign(db,o)}

test('filtros estritos rejeitam enum, arrays e objetos antes de consultar banco',async()=>{
 const o=originals();let reads=0;db.queryRead=async()=>{reads++;return {rows:[]}};
 try{for(const filters of [{status:'ativo'},{status:['humano']},{status:{}},{assignment:'mine'},{assignment:['all']}])await assert.rejects(()=>listWhatsappAiSessions(context(),filters),{code:'WHATSAPP_AI_SESSION_FILTER_INVALID'});assert.equal(reads,0)}finally{restore(o)}
});
test('lista mantém contrato antigo e adiciona filtros parametrizados com limite inteiro',async()=>{
 const o=originals(),calls=[];db.queryRead=async(sql,params)=>{calls.push({sql,params});return {rows:[{id:S,status:'humano',telefone:'CANARY-UNMASKED-1234',assigned_to:U,estado:{secret:'PRIVATE-CANARY'}}]}};
 try{
  const legacy=await listWhatsappAiSessions(context(),{limit:2.8});assert.deepEqual(calls[0].params,[E,L,2]);assert.match(calls[0].sql,/empresa_id = \$1 AND loja_id = \$2/);assert.equal(legacy[0].isMine,true);assert.equal(legacy[0].assigned_to,undefined);assert.equal(legacy[0].estado,undefined);assert.equal(legacy[0].telefone,'***1234');assert.doesNotMatch(JSON.stringify(legacy),/PRIVATE-CANARY|CANARY-UNMASKED/);
  await listWhatsappAiSessions(context(),{limit:10000,status:'humano',assignment:'unassigned'});assert.deepEqual(calls[1].params,[E,L,'humano',100]);assert.match(calls[1].sql,/status = \$3/);assert.match(calls[1].sql,/assigned_to IS NULL/);assert.doesNotMatch(calls[1].sql,/\b(INSERT|UPDATE|DELETE|ALTER)\b/i);
 }finally{restore(o)}
});
test('claim rejeita sessão e operador inválidos antes de abrir transação',async()=>{
 const o=originals();let calls=0;db.transaction=async()=>{calls++};
 try{await assert.rejects(()=>claimWhatsappAiHandoff(context(),'invalid'),{code:'WHATSAPP_AI_SESSION_INVALID'});await assert.rejects(()=>claimWhatsappAiHandoff({...context(),usuarioId:''},S),{code:'AUTHENTICATED_USER_REQUIRED'});assert.equal(calls,0)}finally{restore(o)}
});
test('replay próprio faz só SELECT FOR UPDATE, sem alterar timestamp ou auditar',async()=>{
 const o=originals(),calls=[];const row={id:S,status:'humano',assigned_to:U,assigned_at:'2026-01-01T00:00:00Z'};db.transaction=async(fn)=>fn({query:async(sql,params)=>{calls.push({sql,params});return {rows:[row]}}});
 try{assert.deepEqual(await claimWhatsappAiHandoff(context(),S),row);assert.equal(calls.length,1);assert.match(calls[0].sql,/FOR UPDATE/);assert.deepEqual(calls[0].params,[S,E,L]);assert.doesNotMatch(calls[0].sql,/^\s*(UPDATE|INSERT)/i)}finally{restore(o)}
});
test('outro dono e sessão ausente não produzem UPDATE/auditoria',async()=>{
 const o=originals();const calls=[];
 try{for(const row of [{id:S,status:'humano',assigned_to:O},null]){calls.length=0;db.transaction=async(fn)=>fn({query:async(sql)=>{calls.push(sql);return {rows:row?[row]:[]}}});await assert.rejects(()=>claimWhatsappAiHandoff(context(),S),{code:row?'WHATSAPP_AI_SESSION_CONFLICT':'WHATSAPP_AI_SESSION_NOT_FOUND'});assert.equal(calls.length,1);assert.match(calls[0],/FOR UPDATE/);assert.equal(calls.some(x=>/^\s*(INSERT|UPDATE)/i.test(x)),false)}}finally{restore(o)}
});
test('GET com reports.read sem settings.write retorna canClaim false; zero DML',async()=>{
 const o=originals(),calls=[];db.queryRead=async(sql,params)=>{calls.push({sql,params});if(/COUNT\(\*\)::int AS grants/.test(sql))return {rows:[{grants:params[1]==='reports.read'?1:0}]};return {rows:[]}};db.query=async()=>{throw new Error('DML PROIBIDO')};db.transaction=async()=>{throw new Error('DML PROIBIDO')};
 try{const r=response();await handler('/whatsapp-ai/sessions')({headers:{'x-empresa-id':E,'x-loja-id':L},commerceAdminContext:context(),query:{status:'humano',assignment:'unassigned'}},r);assert.equal(r.statusCode,200);assert.equal(r.body.canClaim,false);assert.equal(r.body.selection.empresaId,E);assert.equal(r.body.selection.canonicalLojaId,L);assert.equal(r.body.selection.requestedLojaId,L);assert.equal(r.body.selection.inferred,false);assert.deepEqual(r.body.items,[]);assert.equal(calls.some(x=>/^\s*(INSERT|UPDATE|DELETE)/i.test(x.sql)),false)}finally{restore(o)}
});
test('erro de infraestrutura na verificação de settings.write não vira ausência de permissão ou vazio',async()=>{
 const o=originals();db.queryRead=async(sql,p)=>{if(p[1]==='settings.write')throw new Error('PRIVATE-DATABASE-CANARY');return {rows:[{grants:1}]}};
 try{const r=response();await handler('/whatsapp-ai/sessions')({headers:{'x-empresa-id':E,'x-loja-id':L},commerceAdminContext:context(),query:{status:'humano'}},r);assert.equal(r.statusCode,500);assert.equal(r.body.canClaim,undefined);assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE-DATABASE-CANARY/)}finally{restore(o)}
});
test('fila sem unidade explícita, ou cache de outro contexto, bloqueia leitura de sessões',async()=>{
 const o=originals();let sessions=0;db.queryRead=async(sql)=>{if(/FROM whatsapp_ai_sessions/.test(sql))sessions++;return {rows:[{grants:1}]}};
 try{for(const headers of [{'x-empresa-id':E},{'x-empresa-id':E,'x-loja-id':O}]){const r=response();await handler('/whatsapp-ai/sessions')({headers,commerceAdminContext:context(),query:{status:'humano'}},r);assert.ok([400,403].includes(r.statusCode));assert.equal(r.body.items,undefined)}assert.equal(sessions,0)}finally{restore(o)}
});
test('seletor legado é canonicalizado por empresa e revalidado pelo resolver oficial',async()=>{
 const o=originals(),calls=[];db.queryRead=async(sql,p)=>{calls.push({sql,p});if(/FROM lojas/.test(sql)&&/codigo = \$2/.test(sql))return {rows:[{id:L}]};if(/FROM usuarios u/.test(sql))return {rows:[{usuario_id:U,empresa_id:E}]};if(/SELECT 1 FROM lojas/.test(sql))return {rows:[{}]};if(/AS grants/.test(sql))return {rows:[{grants:1}]};return {rows:[]}};
 try{const r=response();await handler('/whatsapp-ai/sessions')({headers:{'x-empresa-id':E,'x-loja-id':'synthetic-unit'},user:{pgOperational:true,id:U,empresaId:E},query:{status:'humano'}},r);assert.equal(r.statusCode,200);assert.equal(r.body.selection.requestedLojaId,'synthetic-unit');assert.equal(r.body.selection.canonicalLojaId,L);assert.deepEqual(calls.find(x=>/codigo = \$2/.test(x.sql)).p,[E,'synthetic-unit']);assert.ok(calls.some(x=>/administrador/.test(x.sql)===false&&/FROM usuarios u/.test(x.sql)));assert.deepEqual(calls.find(x=>/FROM whatsapp_ai_sessions/.test(x.sql)).p.slice(0,2),[E,L])}finally{restore(o)}
});
test('seletor legado sem sessão não consulta dados de unidade',async()=>{
 const o=originals();let count=0;db.queryRead=async()=>{count++;throw new Error('não permitido')};
 try{const r=response();await handler('/whatsapp-ai/sessions')({headers:{'x-empresa-id':E,'x-loja-id':'synthetic-unit'},query:{status:'humano'}},r);assert.equal(r.statusCode,401);assert.equal(count,0)}finally{restore(o)}
});
test('claim sem settings.write é 403 e não inicia transação; body não concede autoridade',async()=>{
 const o=originals();let writes=0;db.queryRead=async()=>({rows:[{grants:0}]});db.transaction=async()=>{writes++};
 try{const r=response();await handler('/whatsapp-ai/sessions/:id/claim','post')({headers:{'x-empresa-id':E,'x-loja-id':L},commerceAdminContext:context(),params:{id:S},body:{usuarioId:O,canClaim:true}},r);assert.equal(r.statusCode,403);assert.equal(r.body.code,'PERMISSION_DENIED');assert.equal(writes,0)}finally{restore(o)}
});
test('claim autorizado ignora usuário/empresa/unidade injetados no body e não envia mensagem',async()=>{
 const o=originals(),calls=[];const fetchOriginal=globalThis.fetch;globalThis.fetch=()=>{throw new Error('ENVIO PROIBIDO')};db.queryRead=async()=>({rows:[{grants:1}]});db.transaction=async(fn)=>fn({query:async(sql,p)=>{calls.push({sql,p});if(/^\s*SELECT/i.test(sql))return {rows:[{id:S,status:'humano',assigned_to:null}]};if(/^\s*UPDATE/i.test(sql))return {rows:[{id:S,status:'humano',assigned_to:U}]};return {rows:[],rowCount:1}}});
 try{const r=response();await handler('/whatsapp-ai/sessions/:id/claim','post')({headers:{'x-empresa-id':E,'x-loja-id':L},commerceAdminContext:context(),params:{id:S},body:{usuarioId:O,empresaId:O,lojaId:O}},r);assert.equal(r.statusCode,200);assert.equal(r.body.assigned_to,U);assert.deepEqual(calls.find(x=>/^\s*UPDATE/i.test(x.sql)).p,[S,E,L,U]);assert.equal(calls.filter(x=>/commerce_audit_logs/.test(x.sql)).length,1);assert.equal(calls.some(x=>/whatsapp_ai_messages|provider_runs/.test(x.sql)),false)}finally{restore(o);globalThis.fetch=fetchOriginal}
});

test('GET legado sem filtros preserva envelope items e não depende de settings.write',async()=>{
 const o=originals();let managementReads=0;db.queryRead=async(sql,p)=>{if(/AS grants/.test(sql)){if(p[1]==='settings.write'){managementReads++;throw new Error('não é dependência do contrato antigo')};return {rows:[{grants:1}]}}return {rows:[]}};
 try{const r=response();await handler('/whatsapp-ai/sessions')({headers:{'x-empresa-id':E,'x-loja-id':L},commerceAdminContext:context(),query:{limit:'20'}},r);assert.equal(r.statusCode,200);assert.deepEqual(r.body,{items:[]});assert.equal(managementReads,0)}finally{restore(o)}
});
