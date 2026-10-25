import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { createAccountPasswordRecovery, resetPasswordPolicy } from './account-password-reset.js';
import { credentialVersion, credentialSessionValid } from './credential-session.js';
import { createAccount, importAccount, accountCredential } from './commerce-accounts.js';
import { issueOperationalInvite, acceptOperationalInvite } from './commerce-operational-invites.js';
const connectionString=process.env.PASSWORD_RESET_TEST_DATABASE_URL || '';
let enabled=false;
try {const u=new URL(connectionString);enabled=['localhost','127.0.0.1'].includes(u.hostname)&&/_test$/.test(u.pathname)&&[...u.searchParams.keys()].every(k=>k==='host')&&(!u.searchParams.get('host')||/^\/(?:private\/)?tmp\/kytto-pg-[^/]+\/socket$/.test(u.searchParams.get('host')));}catch{}
const pool=enabled ? new pg.Pool({connectionString,ssl:false,max:6}) : null;
after(async()=>{await pool?.end();});
const database={query:(s,v=[])=>pool.query(s,v),queryRead:(s,v=[])=>pool.query(s,v),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const r=await fn({query:(s,v=[])=>c.query(s,v)});await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
const actor={id:'fixture-admin',role:'admin',platformAdmin:true};
const oldPassword='Senha-Antiga-123!',newPassword='Nova-Senha-456!';
const run=(name,fn)=>test(name,{skip:!enabled},fn);
async function company(){return (await pool.query("INSERT INTO empresas(nome,razao_social,cnpj,tipo_negocio) VALUES($1,$1,$2,'loja') RETURNING id",[`Reset ${randomUUID()}`,String(Math.floor(1e13+Math.random()*1e12))])).rows[0].id;}
async function native(){const a=await company(),b=await company();const email=`reset-${randomUUID()}@example.invalid`;const result=await createAccount(actor,{nome:'Conta Sintética',email,senha:oldPassword,access:[{empresaId:a,roleCode:'tenant_owner'},{empresaId:b,roleCode:'store_admin'}]},{database});return {id:result.account.id,email,a,b};}
function service(legacy=[],extra={}){const sent=[];let saves=0;const recovery=createAccountPasswordRecovery({database,getLegacyUsers:()=>legacy,saveLegacy:()=>{saves++;},sendMail:async(to,nome,url)=>{sent.push({to,url,token:new URLSearchParams(new URL(url).hash.slice(1)).get('token')});return {ok:true,id:'mail-synthetic'};},...extra});return {...recovery,sent,get saves(){return saves;}};}
run('conta multiempresa: envio único, token hash, corrida de consumo e memberships preservadas',async()=>{
 const user=await native(),s=service();
 const before=(await pool.query('SELECT * FROM commerce_account_users au JOIN commerce_memberships m ON m.usuario_id=au.usuario_id WHERE au.account_id=$1 ORDER BY m.id',[user.id])).rows;
 await Promise.all([s.request(user.email.toUpperCase()),s.request(user.email)]);assert.equal(s.sent.length,1);
 const token=s.sent[0].token;assert.ok(token);assert.equal(new URL(s.sent[0].url).origin,'https://kytto.com.br');
 const stored=(await pool.query('SELECT * FROM auth_password_resets WHERE subject_id=$1',[user.id])).rows[0];assert.equal(stored.delivered,true);assert.equal(JSON.stringify(stored).includes(token),false);
 assert.deepEqual(await s.validate(token),{ok:true});assert.equal((await s.consume(token,'fraca')).code,'WEAK_PASSWORD');
 const results=await Promise.all([s.consume(token,newPassword),s.consume(token,'Outra-Senha-789!')]);assert.equal(results.filter(r=>r.ok).length,1);assert.deepEqual(await s.validate(token),{ok:false});
 const row=(await pool.query('SELECT * FROM commerce_accounts WHERE id=$1',[user.id])).rows[0];assert.ok(bcrypt.compareSync(newPassword,row.senha_hash)||bcrypt.compareSync('Outra-Senha-789!',row.senha_hash));assert.ok(row.password_changed_at);
 assert.equal(credentialSessionValid({credentialVersion:credentialVersion(bcrypt.hashSync(oldPassword,4))},credentialVersion(row.senha_hash),row.password_changed_at),false);
 const afterRows=(await pool.query('SELECT * FROM commerce_account_users au JOIN commerce_memberships m ON m.usuario_id=au.usuario_id WHERE au.account_id=$1 ORDER BY m.id',[user.id])).rows;assert.deepEqual(afterRows,before);
});
run('novo link invalida anterior; expiração e mudança de credencial bloqueiam consumo',async()=>{
 const user=await native(),s=service();await s.request(user.email);const first=s.sent[0].token;
 await pool.query("UPDATE auth_password_resets SET criado_em=CURRENT_TIMESTAMP-interval '61 seconds' WHERE subject_id=$1",[user.id]);await s.request(user.email);const second=s.sent[1].token;
 assert.deepEqual(await s.validate(first),{ok:false});assert.deepEqual(await s.validate(second),{ok:true});
 await pool.query("UPDATE auth_password_resets SET expires_at=CURRENT_TIMESTAMP-interval '1 second' WHERE subject_id=$1",[user.id]);assert.equal((await s.consume(second,newPassword)).code,'INVALID_TOKEN');
 await pool.query("UPDATE auth_password_resets SET criado_em=CURRENT_TIMESTAMP-interval '61 seconds' WHERE subject_id=$1",[user.id]);await s.request(user.email);
 await pool.query('UPDATE commerce_accounts SET senha_hash=$2 WHERE id=$1',[user.id,bcrypt.hashSync(newPassword,4)]);assert.deepEqual(await s.validate(s.sent[2].token),{ok:false});
});
run('falha, simulação ou resposta sem ID não habilita link; senha fica igual',async()=>{
 for(const response of [{ok:false},{ok:true},{ok:true,id:'fake',simulado:true}]){
  const user=await native();let token='';const s=service([],{sendMail:async(to,nome,url)=>{token=new URLSearchParams(new URL(url).hash.slice(1)).get('token');return response;}});
  await s.request(user.email);assert.deepEqual(await s.validate(token),{ok:false});assert.equal(bcrypt.compareSync(oldPassword,(await pool.query('SELECT senha_hash FROM commerce_accounts WHERE id=$1',[user.id])).rows[0].senha_hash),true);
 }
});
run('convite promovido a dono redefine somente sua identidade SQL e preserva permissões',async()=>{
 const empresaId=await company(),email=`operational-${randomUUID()}@example.invalid`;let inviteToken='';
 await issueOperationalInvite({empresaId,email,nome:'Dono Sintético',sendInvite:async p=>{inviteToken=p.token;return {ok:true};}},{database});
 const user=await acceptOperationalInvite({token:inviteToken,password:oldPassword},{database});
 await pool.query("UPDATE commerce_memberships SET role_id=(SELECT id FROM commerce_roles WHERE codigo='tenant_owner' AND empresa_id IS NULL) WHERE usuario_id=$1",[user.id]);
 const before=(await pool.query('SELECT * FROM commerce_memberships WHERE usuario_id=$1',[user.id])).rows;
 const s=service();await s.request(email);assert.equal(s.sent.length,1);assert.equal((await s.consume(s.sent[0].token,newPassword)).ok,true);
 const updated=(await pool.query('SELECT * FROM usuarios WHERE id=$1',[user.id])).rows[0];assert.ok(bcrypt.compareSync(newPassword,updated.senha_hash));assert.ok(updated.password_changed_at);
 assert.deepEqual((await pool.query('SELECT * FROM commerce_memberships WHERE usuario_id=$1',[user.id])).rows,before);
});
run('legado e conta associada usam a origem correta sem trocar senha de homônimo',async()=>{
 const hash=bcrypt.hashSync(oldPassword,4),email=`legacy-${randomUUID()}@example.invalid`;
 const legacy=[{id:124,email,nome:'Legado sintético',ativo:true,senhaHash:hash},{id:125,email:'outro@example.invalid',nome:'Outro',ativo:true,senhaHash:hash}];
 const s=service(legacy);await s.request(email);assert.equal((await s.consume(s.sent[0].token,newPassword)).ok,true);assert.equal(s.saves,1);assert.ok(bcrypt.compareSync(newPassword,legacy[0].senhaHash));assert.equal(legacy[1].senhaHash,hash);
 const empresaId=await company();const account=await importAccount(actor,{source:'legacy',sourceId:'124',access:[{empresaId,roleCode:'tenant_owner'}]},{legacyUsers:legacy,database});
 const s2=service(legacy);await s2.request(email);assert.equal((await s2.consume(s2.sent[0].token,'Terceira-Senha-789!')).ok,true);
 const row=(await pool.query('SELECT * FROM commerce_accounts WHERE id=$1',[account.account.id])).rows[0];assert.ok(bcrypt.compareSync('Terceira-Senha-789!',accountCredential(row,legacy)));assert.ok(row.password_changed_at);
});
run('identidades ambíguas, conta inativa e destino inexistente não recebem e-mail',async()=>{
 const a=await company(),b=await company(),email=`ambiguous-${randomUUID()}@example.invalid`;
 await pool.query("INSERT INTO usuarios(empresa_id,email,nome_completo,senha_hash,role) VALUES($1,$3,'Um','hash','admin'),($2,$3,'Outro','hash','admin')",[a,b,email]);const s=service();await s.request(email);await s.request('missing@example.invalid');assert.equal(s.sent.length,0);
 const user=await native();await pool.query('UPDATE commerce_accounts SET ativo=false WHERE id=$1',[user.id]);await s.request(user.email);assert.equal(s.sent.length,0);
 const duplicate=service([{id:1,email,ativo:true,senhaHash:'hash'},{id:2,email,ativo:true,senhaHash:'hash'}]);await duplicate.request(email);assert.equal(duplicate.sent.length,0);
});
run('desativação depois do envio impede redefinição',async()=>{
 const user=await native(),s=service();await s.request(user.email);await pool.query('UPDATE commerce_accounts SET ativo=false WHERE id=$1',[user.id]);assert.deepEqual(await s.validate(s.sent[0].token),{ok:false});assert.equal((await s.consume(s.sent[0].token,newPassword)).ok,false);
});
test('política forte, limite UTF-8 e revogação de sessões antigas',()=>{
 assert.equal(resetPasswordPolicy(newPassword),true);for(const p of ['fraca','SemSimbolo1234','A1!'+ '😀'.repeat(20)])assert.equal(resetPasswordPolicy(p),false);
 const a=credentialVersion('hash-a'),b=credentialVersion('hash-b');const stamped=credentialVersion('hash-a','2026-01-01T00:00:00Z');assert.equal(credentialSessionValid({credentialVersion:a},stamped),false);assert.equal(credentialSessionValid({credentialVersion:stamped},credentialVersion('hash-a',new Date('2026-01-01T00:00:00Z'))),true);assert.equal(credentialSessionValid({credentialVersion:a},b),false);assert.equal(credentialSessionValid({credentialVersion:b},b),true);
 assert.equal(credentialSessionValid({iat:1},b,'2026-01-01T00:00:00Z'),false);assert.equal(credentialSessionValid({iat:1},b,null),true);
});
