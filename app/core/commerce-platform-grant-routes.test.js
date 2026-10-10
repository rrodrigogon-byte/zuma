import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.js';
import { createPlatformAdministratorRouter } from './commerce-platform-grant-routes.js';

const fakeResponse = () => ({ statusCode:200, body:null, headers:{}, set(key,value){this.headers[key]=value;return this;}, status(code){this.statusCode=code;return this;}, json(body){this.body=body;return this;} });
const router = () => createPlatformAdministratorRouter({ getLegacyUsers:()=>[], reservedEmail:()=>false });

test('rotas globais recusam store_admin, owner empresarial e flags forjadas sem consultar o banco', async () => {
  const previous = db.queryRead;
  let reads=0;
  db.queryRead = async()=>{++reads;throw new Error('Unexpected read');};
  try {
    for (const user of [null,{id:'tenant',role:'admin',pgOperational:true,platformAdmin:true},{id:'account',role:'admin',pgAccount:true,platformAdmin:true},{id:'tenant',role:'admin'}, {id:'tenant',role:'admin',mainAdmin:true,pgAccount:true}]) {
      const response=fakeResponse();
      let next=false;
      router().stack[0].handle({user},response,()=>{next=true;});
      assert.equal(response.statusCode,403);
      assert.equal(response.body.code,'PERMISSION_DENIED');
      assert.equal(next,false);
      assert.equal(response.headers['Cache-Control'],'private, no-store');
    }
    assert.equal(reads,0);
  } finally {db.queryRead=previous;}
});

test('busca global exige três caracteres e usa SELECT com filtro server-side, sem retornar senhas', async () => {
  const previous=db.queryRead;
  const calls=[];
  db.queryRead=async sql=>{calls.push(sql);return {rows:[]};};
  try {
    const handler=router().stack.find(layer=>layer.route?.path==='/'&&layer.route.methods.get).route.stack[0].handle;
    const response=fakeResponse();
    await handler({query:{query:'ab'},user:{id:1,role:'admin',platformAdmin:true}},response);
    assert.deepEqual(response.body,{candidates:[],items:[]});
    assert.equal(calls.length,1);
    assert.match(calls[0],/FROM commerce_platform_grants/);
    assert.doesNotMatch(calls[0],/senha|hash|UPDATE|INSERT|DELETE/);
  } finally {db.queryRead=previous;}
});

test('revogação exige confirmação explícita antes de qualquer domínio ou gravação', async()=>{
  const handler=router().stack.find(layer=>layer.route?.path==='/:accountId/revoke').route.stack[0].handle;
  const response=fakeResponse();
  await handler({params:{accountId:'invalid'},body:{},user:{id:1,role:'admin',platformAdmin:true}},response);
  assert.equal(response.statusCode,400);
  assert.equal(response.body.code,'GLOBAL_CONFIRMATION_REQUIRED');
});
