import test from 'node:test';
import assert from 'node:assert/strict';
import { mail } from './email.js';
test('recuperação usa contato@kytto.com.br, confirma ID e não simula sucesso sem provedor',async()=>{
 const previous={...process.env},fetchBefore=globalThis.fetch;
 try {
  delete process.env.PASSWORD_RESET_RESEND_API_KEY;delete process.env.OPERATIONAL_INVITE_RESEND_API_KEY;delete process.env.RESEND_API_KEY;
  assert.equal(mail.recuperacaoSenhaAtiva(),false);assert.equal((await mail.redefinicaoSenha('test@example.invalid','Teste','https://kytto.com.br/redefinir-senha#token=fake',new Date())).ok,false);
  process.env.PASSWORD_RESET_RESEND_API_KEY='synthetic-key';process.env.EMAIL_FROM='Outro <outro@example.invalid>';
  let sent;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');sent=JSON.parse(options.body);return {ok:true,json:async()=>({id:'synthetic-message'})};};
  const result=await mail.redefinicaoSenha('test@example.invalid','<script>teste</script>','https://kytto.com.br/redefinir-senha#token=fake',new Date());
  assert.deepEqual(result,{ok:true,id:'synthetic-message'});assert.equal(sent.from,'Kytto <contato@kytto.com.br>');assert.deepEqual(sent.to,['test@example.invalid']);assert.ok(sent.html.includes('&lt;script&gt;'));assert.ok(!sent.html.includes('<script>'));assert.ok(!sent.html.includes('4ª AGRO'));
  globalThis.fetch=async()=>({ok:true,json:async()=>({})});assert.equal((await mail.redefinicaoSenha('test@example.invalid','Teste','https://kytto.com.br/',new Date())).ok,false);
  globalThis.fetch=async()=>({ok:false,json:async()=>({message:'rejected'})});assert.equal((await mail.redefinicaoSenha('test@example.invalid','Teste','https://kytto.com.br/',new Date())).ok,false);
 }finally{globalThis.fetch=fetchBefore;for(const key of ['PASSWORD_RESET_RESEND_API_KEY','OPERATIONAL_INVITE_RESEND_API_KEY','RESEND_API_KEY','EMAIL_FROM']){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
