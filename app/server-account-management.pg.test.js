import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';
const DSN=process.env.ACCOUNT_MANAGEMENT_TEST_DATABASE_URL;
const APP=path.dirname(fileURLToPath(import.meta.url));
const PASSWORD='Senha-Local-Forte-123!';
const ROOT='/api/admin/platform/accounts';

test('contas multiempresa: criação, isolamento, clientes, importação e revogação por request', {skip:!DSN && 'defina ACCOUNT_MANAGEMENT_TEST_DATABASE_URL'}, async () => {
  const sql=new pg.Client({connectionString:DSN}); await sql.connect();
  const suffix=crypto.randomBytes(5).toString('hex');
  const company=async label => (await sql.query(`INSERT INTO empresas (nome,cnpj,razao_social,tipo_negocio,ativa) VALUES ($1,$2,$1,'barbearia',true) RETURNING id`,[`${label}-${suffix}`,crypto.randomBytes(7).toString('hex').replace(/[a-f]/g,'1').slice(0,14)])).rows[0].id;
  const A=await company('Conta A'), B=await company('Conta B'), C=await company('Conta C');
  const storeA=(await sql.query(`INSERT INTO lojas (empresa_id,codigo,nome,ativa) VALUES ($1,$2,'Unidade A',true) RETURNING id`,[A,`a-${suffix}`])).rows[0].id;
  const storeB=(await sql.query(`INSERT INTO lojas (empresa_id,codigo,nome,ativa) VALUES ($1,$2,'Unidade B',true) RETURNING id`,[B,`b-${suffix}`])).rows[0].id;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'account-management-'));
  const legacyEmail=`legacy-${suffix}@example.invalid`;
  const legacyId=Number.parseInt(suffix,16);
  const hash=bcrypt.hashSync(PASSWORD,4);
  fs.writeFileSync(path.join(dir,'db.json'),JSON.stringify({seq:legacyId+10,usuarios:[{id:1,nome:'Administrador local',email:'admin',senhaHash:hash,role:'admin',ativo:true},{id:legacyId,nome:'Legado selecionado',email:legacyEmail,senhaHash:hash,role:'staff',ativo:true}]}));
  const port=35200+Math.floor(Math.random()*300), base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.js'],{cwd:APP,env:{...process.env,NODE_ENV:'development',PORT:String(port),DB_PATH:path.join(dir,'db.json'),JWT_SECRET:'account-management-local-test',COMMERCE_CORE_ENABLED:'1',DATABASE_URL:DSN,DB_SSL:'false',ADMIN_USER:'admin',SEED_DEMO:'0',WHATSAPP_CONNECTION_WATCHDOG:'false',WPP_BASE_URL:'',WPP_APIKEY:'',RESEND_API_KEY:'',OPERATIONAL_INVITE_RESEND_API_KEY:'',GEMINI_API_KEY:'',OPENAI_API_KEY:'',AI_AUTOMATION_SCHEDULER:'false',AI_LEARNING_SCHEDULER:'false'},stdio:'ignore'});
  async function request(url,method='GET',body=null,headers={}) {
    const response=await fetch(base+url,{method,headers:{'content-type':'application/json',...headers},...(body ? {body:JSON.stringify(body)}:{})});
    return {status:response.status,body:await response.json().catch(()=>({}))};
  }
  try {
    let ready=false;
    for(let i=0;i<80;i++){if(child.exitCode!==null)throw new Error('servidor saiu no boot');try{if((await request('/api/info')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,150))}
    assert.ok(ready,'servidor iniciou');
    const adminLogin=await request('/api/admin/login','POST',{user:'admin',pass:PASSWORD}); assert.equal(adminLogin.status,200,JSON.stringify(adminLogin));
    const admin={Authorization:`Bearer ${adminLogin.body.token}`};
    assert.equal((await request(`${ROOT}/options`)).status,401);
    assert.equal((await request(`${ROOT}/options`,'GET',null,admin)).body.canManage,true);
    const email=`multi-${suffix}@example.invalid`;
    const input={nome:'Multiempresa local',email,senha:PASSWORD,access:[{empresaId:A,roleCode:'store_admin'},{empresaId:B,roleCode:'finance'}]};
    const create=await request(ROOT,'POST',input,admin); assert.equal(create.status,201,JSON.stringify(create));
    const accountId=create.body.account.id;
    assert.doesNotMatch(JSON.stringify(create.body),/senha|\$2[aby]\$/);
    assert.equal((await request(ROOT,'POST',input,admin)).status,409);
    assert.equal((await request(ROOT,'POST',{...input,email:`no-platform-${suffix}@example.invalid`,access:[{empresaId:A,roleCode:'platform_owner'}]},admin)).status,403);
    assert.equal((await request(ROOT,'POST',{...input,email:`wrong-store-${suffix}@example.invalid`,access:[{empresaId:A,roleCode:'store_admin',lojaId:storeB}]},admin)).status,404);
    assert.equal((await sql.query('SELECT count(*)::integer AS n FROM commerce_accounts WHERE email=$1',[`wrong-store-${suffix}@example.invalid`])).rows[0].n,0,'rollback sem conta parcial');
    const login=await request('/api/admin/login','POST',{user:email,pass:PASSWORD}); assert.equal(login.status,200,JSON.stringify(login));
    assert.equal(login.body.user.pgAccount,true); assert.equal(login.body.user.platformAdmin,false); assert.equal(login.body.sessao.empresas_acessiveis.length,2);
    const token={Authorization:`Bearer ${login.body.token}`};
    const scopedA={...token,'X-Empresa-Id':A}, scopedB={...token,'X-Empresa-Id':B};
    const locals=(await sql.query('SELECT empresa_id,usuario_id FROM commerce_account_users WHERE account_id=$1',[accountId])).rows;
    assert.equal(locals.length,2); assert.notEqual(locals[0].usuario_id,locals[1].usuario_id);
    assert.equal((await request(`${ROOT}/options`,'GET',null,token)).status,403);
    assert.equal((await request('/api/admin/financeiro/lancamentos','GET',null,token)).status,403,'não cai no módulo global sem empresa');
    assert.equal((await request('/api/admin/commerce/customers','GET',null,scopedA)).status,200);
    assert.equal((await request('/api/admin/commerce/customers','GET',null,scopedB)).status,403,'perfil financeiro não ganha customers.read');
    assert.equal((await request('/api/admin/barbearia/estoque-revenda','POST',{nome:'Não permitido'},scopedB)).status,403,'perfil financeiro não contorna RBAC no ERP da barbearia');
    assert.equal((await request('/api/admin/barbearia/overview','GET',null,scopedB)).status,403,'perfil especializado não recebe gestão de barbearia');
    for (const alias of ['/api/auth/register','/api/auth/registro']) {
      assert.equal((await request(alias,'POST',{nome:'Homônimo',email,senha:PASSWORD})).status,409,'cadastros públicos respeitam a conta canônica');
    }
    assert.equal((await request('/api/admin/commerce/customers','GET',null,{...token,'X-Empresa-Id':C})).status,403);
    assert.equal((await request('/api/admin/commerce/customers','GET',null,{...scopedA,'X-Loja-Id':storeB})).status,403);
    const crm=await request(`${ROOT}/customers`,'POST',{nome:'Cliente sem painel',email:`crm-${suffix}@example.invalid`,empresas:[A,B]},admin);assert.equal(crm.status,201,JSON.stringify(crm)); assert.equal(crm.body.items.length,2);
    assert.equal((await sql.query('SELECT count(*)::integer AS n FROM commerce_accounts WHERE email=$1',[`crm-${suffix}@example.invalid`])).rows[0].n,0);
    const before=(await sql.query('SELECT count(*)::integer AS n FROM commerce_customers WHERE empresa_id=$1',[C])).rows[0].n;
    const failedCrm=await request(`${ROOT}/customers`,'POST',{nome:'Cliente duplicado',email:`crm-${suffix}@example.invalid`,empresas:[C,A]},admin);assert.equal(failedCrm.status,409);
    assert.equal((await sql.query('SELECT count(*)::integer AS n FROM commerce_customers WHERE empresa_id=$1',[C])).rows[0].n,before,'cadastro múltiplo também é atômico');
    const sources=await request(`${ROOT}/sources?query=${encodeURIComponent(legacyEmail)}`,'GET',null,admin);assert.ok(sources.body.items.some(row=>row.source==='legacy'&&row.sourceId===String(legacyId)));
    const oldLogin=await request('/api/admin/login','POST',{user:legacyEmail,pass:PASSWORD});assert.equal(oldLogin.status,200);
    const oldToken={Authorization:`Bearer ${oldLogin.body.token}`};
    assert.equal((await request('/api/auth/perfil','PATCH',{email,senhaAtual:PASSWORD,senhaNova:'Outra-Senha-Local-123!'},oldToken)).status,409,'troca de e-mail legada respeita reserva canônica');
    assert.equal((await request('/api/admin/login','POST',{user:legacyEmail,pass:PASSWORD})).status,200,'conflito não altera a credencial em memória');
    const imported=await request(`${ROOT}/import`,'POST',{source:'legacy',sourceId:String(legacyId),access:[{empresaId:A,roleCode:'support'},{empresaId:B,roleCode:'order_operator'}]},admin);assert.equal(imported.status,201,JSON.stringify(imported));
    const migrated=await request('/api/admin/login','POST',{user:legacyEmail,pass:PASSWORD});assert.equal(migrated.status,200);assert.equal(migrated.body.user.pgAccount,true);
    assert.equal((await request('/api/admin/financeiro/lancamentos','GET',null,{Authorization:`Bearer ${oldLogin.body.token}`})).status,403,'JWT legado antigo é escopado após associação explícita');
    const expiry=await request(`${ROOT}/${accountId}/access`,'POST',{access:[{empresaId:A,roleCode:'store_admin',expiresAt:'2020-01-01T00:00:00Z'}]},admin);assert.equal(expiry.status,200);
    assert.equal((await request('/api/admin/commerce/customers','GET',null,scopedA)).status,403,'vínculo expirado na request seguinte');
    const disabled=await request(`${ROOT}/${accountId}`,'PATCH',{ativo:false},admin);assert.equal(disabled.status,200);
    assert.equal((await request('/api/auth/me','GET',null,scopedB)).status,401,'conta desativada derruba JWT');
    const ownerEmail=`owner-${suffix}@example.invalid`;
    const owner=await request(ROOT,'POST',{nome:'Último responsável',email:ownerEmail,senha:PASSWORD,access:[{empresaId:C,roleCode:'tenant_owner'}]},admin);assert.equal(owner.status,201);
    const lastOwner=await request(`${ROOT}/${owner.body.account.id}`,'PATCH',{ativo:false},admin);assert.equal(lastOwner.status,409);assert.equal(lastOwner.body.code,'LAST_TENANT_OWNER_REQUIRED');
    const audits=(await sql.query('SELECT detalhes FROM commerce_account_audit WHERE account_id=$1',[accountId])).rows;
    assert.ok(audits.length>=3);assert.doesNotMatch(JSON.stringify(audits),/Senha-Local|senha_hash|token/);
  } finally { child.kill('SIGTERM'); await new Promise(r=>setTimeout(r,150)); await sql.end(); fs.rmSync(dir,{recursive:true,force:true}); }
});
