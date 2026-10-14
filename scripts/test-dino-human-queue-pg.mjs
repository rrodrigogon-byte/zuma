import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
if(process.env.NODE_ENV==='production')throw new Error('Executor sintético proibido em produção');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const bin='/usr/lib/postgresql/16/bin';
for(const name of ['initdb','pg_ctl','psql','createdb'])if(!existsSync(join(bin,name)))throw new Error('PostgreSQL 16 local necessário; nenhuma DSN remota será usada');
if(userInfo().uid===0)throw new Error('Execute como usuário local não-root');
const dir=mkdtempSync(join(tmpdir(),'dino-human-queue-pg-')),data=join(dir,'data'),socket=join(dir,'socket');
mkdirSync(socket,{mode:0o700});
const database='dino_human_queue_test',owner='dino_human_queue_fixture_owner',port=55435;
const env=Object.fromEntries(['PATH','HOME','LANG','TZ'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
let started=false;
function run(name,args){const r=spawnSync(join(bin,name),args,{env,cwd:root,encoding:'utf8',timeout:90000});if(r.error||r.status!==0)throw new Error(`${name} falhou na fixture local: ${r.error?.message||r.stderr.slice(-1200)}`)}
function ddl(file){return readFileSync(join(root,'app/migrations',file),'utf8')}
try{
 run('initdb',['-D',data,'-U',owner,'--auth-local=trust','--auth-host=reject','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-o',`-k ${socket} -p ${port} -c listen_addresses='' -c fsync=off`,'-w','start']);started=true;
 run('createdb',['-h',socket,'-p',String(port),'-U',owner,database]);
 for(const file of ['001_erp_foundation.sql','003_multiloja_auditoria_imutavel.sql','038_whatsapp_ai_conversations.sql','048_whatsapp_ai_consent_profile_guardrails.sql']){
  run('psql',['-h',socket,'-p',String(port),'-U',owner,'-d',database,'-v','ON_ERROR_STOP=1','-f',join(root,'app/migrations',file)]);console.log('DDL histórico na fixture:',file);
 }
 const hardening=ddl('047_whatsapp_ai_operational_hardening.sql');const sessionDDL=hardening.slice(hardening.indexOf('ALTER TABLE whatsapp_ai_sessions'),hardening.indexOf('ALTER TABLE canais_integracao'));
 const commerce=ddl('019_commerce_core.sql');const auditStart=commerce.indexOf('CREATE TABLE IF NOT EXISTS commerce_audit_logs');const auditDDL=commerce.slice(auditStart,commerce.indexOf('\n);',auditStart)+4);
 if(!sessionDDL.includes('assigned_to UUID')||!auditDDL.includes('fk_commerce_audit_usuario'))throw new Error('DDL histórico esperado não encontrado');
 const extra=join(dir,'handoff-ddl.sql');writeFileSync(extra,`ALTER TABLE lojas ADD UNIQUE(empresa_id,id);\nALTER TABLE usuarios ADD UNIQUE(empresa_id,id);\n${sessionDDL}\n${auditDDL}\n`,{mode:0o600});
 run('psql',['-h',socket,'-p',String(port),'-U',owner,'-d',database,'-v','ON_ERROR_STOP=1','-f',extra]);
 const marker=crypto.randomUUID(),manifest=join(dir,'fixture.json');writeFileSync(manifest,JSON.stringify({marker,socket,port,database,owner}),{mode:0o600});
 const testEnv={...env,NODE_ENV:'test',DB_PATH:join(dir,'legacy.json'),DINO_HUMAN_QUEUE_FIXTURE:manifest,DINO_HUMAN_QUEUE_FIXTURE_MARKER:marker};
 const result=spawnSync(process.execPath,['--test','--test-concurrency=1','app/core/whatsapp-human-queue.real.pg.test.js'],{env:testEnv,cwd:root,stdio:'inherit',timeout:120000});if(result.error)throw result.error;process.exitCode=result.status??1;
}finally{
 if(started){const stopped=spawnSync(join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,encoding:'utf8',timeout:30000});if(stopped.status!==0){console.error('Fixture não pôde ser parada; diretório preservado para diagnóstico.');process.exitCode=1}else{rmSync(dir,{recursive:true,force:true});console.log('Fixture PostgreSQL própria encerrada e removida.')}}else rmSync(dir,{recursive:true,force:true});
}
