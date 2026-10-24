import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createSuprimentosAdminRouter } from '../modules/suprimentos/rotas.js';
const EMPRESA='d0d0ac01-8e50-4b61-8c79-de4aaa916da6',LOJA='ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
test('consultar itens não dispara processamento de vendas; sincronização exige escrita e alcance da empresa', async () => {
  const queries=[];
  const db={async query(sql){queries.push(sql);assert.match(sql.trim(),/^SELECT /i);return {rows:[]};}};
  const app=express();
  app.use('/erp',createSuprimentosAdminRouter({db,escopoDaRequisicao:async(req,permission)=>{
    if(permission!=='inventory.read' && req.headers['x-mode']==='leitor') throw Object.assign(new Error('Sem acesso'),{status:403,code:'PERMISSION_DENIED'});
    return {empresaId:EMPRESA,lojaRestrita:req.headers['x-mode']==='unidade'?LOJA:null};
  }}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const base=`http://127.0.0.1:${server.address().port}/erp`;
    assert.equal((await fetch(`${base}/itens`,{headers:{'x-mode':'leitor'}})).status,200);
    assert.equal(queries.length,1);
    assert.equal(queries.some(sql=>sql.includes('to_regclass')),false);
    for(const mode of ['leitor','unidade']) assert.equal((await fetch(`${base}/consumo/sincronizar`,{method:'POST',headers:{'x-mode':mode}})).status,403);
    assert.equal(queries.length,1);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
