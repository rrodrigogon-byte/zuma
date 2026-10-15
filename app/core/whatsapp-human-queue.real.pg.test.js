import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,realpathSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { tmpdir } from 'node:os';
const enabled=Boolean(process.env.DINO_HUMAN_QUEUE_FIXTURE&&process.env.DINO_HUMAN_QUEUE_FIXTURE_MARKER);
test('Fila humana PostgreSQL real: concorrência, replay, isolamento e rollback', {skip:enabled?false:'Execute npm run test:human-queue-pg; só cluster local efêmero por socket criado pelo runner é permitido'},async t=>{
 assert.equal(process.env.NODE_ENV,'test');const manifest=realpathSync(process.env.DINO_HUMAN_QUEUE_FIXTURE),dir=dirname(manifest),f=JSON.parse(readFileSync(manifest,'utf8'));
 assert.ok(dir.startsWith(join(realpathSync(tmpdir()),'dino-human-queue-pg-')));assert.equal(f.marker,process.env.DINO_HUMAN_QUEUE_FIXTURE_MARKER);assert.equal(realpathSync(f.socket),join(dir,'socket'));assert.equal(f.database,'dino_human_queue_test');assert.equal(f.owner,'dino_human_queue_fixture_owner');assert.equal(f.port,55435);
 process.env.DATABASE_URL=`postgresql:///${f.database}?host=${encodeURIComponent(f.socket)}&port=${f.port}&user=${f.owner}`;process.env.POSTGRES_URL=process.env.DATABASE_URL;
 Object.assign(process.env,{DB_HOST:f.socket,DB_PORT:String(f.port),DB_NAME:f.database,DB_USER:f.owner,DB_PASSWORD:'',DB_SSL:'false',DEBUG_SQL:'false',DB_PATH:join(dir,'legacy.json'),GCS_BUCKET:''});
 const {db}=await import('./database.js');const {claimWhatsappAiHandoff,listWhatsappAiSessions}=await import('./whatsapp-ai.js');
 const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',L1='33333333-3333-4333-8333-333333333333',L2='44444444-4444-4444-8444-444444444444',LB='55555555-5555-4555-8555-555555555555',U1='66666666-6666-4666-8666-666666666666',U2='77777777-7777-4777-8777-777777777777',UB='88888888-8888-4888-8888-888888888888',C1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',C2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',CB='cccccccc-cccc-4ccc-8ccc-cccccccccccc',S1='dddddddd-dddd-4ddd-8ddd-dddddddddddd',S2='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',SB='ffffffff-ffff-4fff-8fff-ffffffffffff';
 const context=(empresaId,lojaId,usuarioId)=>({empresaId,lojaId,usuarioId,authenticatedUserId:usuarioId});const scope=(u=U1)=>context(A,L1,u);const fetchOriginal=globalThis.fetch;let outbound=0;globalThis.fetch=()=>{outbound++;throw new Error('Nenhum envio externo é permitido na fixture')};
 const snapshot=async()=>{const r=await db.queryRead("SELECT json_build_object('sessions',(SELECT json_agg(json_build_object('id',id,'status',status,'owner',assigned_to,'at',assigned_at,'updated',atualizado_em) ORDER BY id) FROM whatsapp_ai_sessions),'audit',(SELECT count(*) FROM commerce_audit_logs),'messages',(SELECT count(*) FROM whatsapp_ai_messages)) AS state");return r.rows[0].state};
 try{
  const identity=await db.queryRead('SELECT current_database() AS db,current_user AS owner');assert.deepEqual(identity.rows[0],{db:f.database,owner:f.owner});
  await db.query("INSERT INTO empresas(id,nome,razao_social,cnpj) VALUES($1,'Empresa sintética A','Fixture A','00000000000001'),($2,'Empresa sintética B','Fixture B','00000000000002')",[A,B]);
  for(const [id,e,c]of[[L1,A,'local-a1'],[L2,A,'local-a2'],[LB,B,'local-b']])await db.query("INSERT INTO lojas(id,empresa_id,codigo,nome) VALUES($1,$2,$3,'Unidade sintética')",[id,e,c]);
  for(const [id,e,name]of[[U1,A,'fixture-one'],[U2,A,'fixture-two'],[UB,B,'fixture-other']])await db.query("INSERT INTO usuarios(id,empresa_id,nome_completo,email,senha_hash,role) VALUES($1,$2,'Operador sintético',$3,'FIXTURE_NOT_A_CREDENTIAL','operador')",[id,e,`${name}@example.invalid`]);
  for(const [u,e,l]of[[U1,A,L1],[U1,A,L2],[U2,A,L1],[UB,B,LB]]){await db.query("INSERT INTO usuarios_lojas(usuario_id,loja_id,role_loja) VALUES($1,$2,'store_admin')",[u,l]);await db.query("INSERT INTO commerce_memberships(empresa_id,usuario_id,loja_id,role_id,ativo) SELECT $1,$2,$3,id,true FROM commerce_roles WHERE empresa_id IS NULL AND codigo='store_admin'",[e,u,l]);}
  for(const [c,e,l,s]of[[C1,A,L1,S1],[C2,A,L2,S2],[CB,B,LB,SB]]){await db.query("INSERT INTO canais_integracao(id,empresa_id,loja_id,provedor,tipo_canal,nome) VALUES($1,$2,$3,'whatsapp','cliente','Canal sintético')",[c,e,l]);await db.query("INSERT INTO whatsapp_ai_sessions(id,empresa_id,loja_id,canal_id,remote_jid,telefone,status,handoff_reason,handoff_requested_at) VALUES($1,$2,$3,$4,'fixture','0000','humano','pedido_do_cliente',CURRENT_TIMESTAMP)",[s,e,l,c]);}
  await t.test('dois operadores simultâneos produzem um vencedor e uma auditoria',async()=>{
   const results=await Promise.allSettled([claimWhatsappAiHandoff(scope(U1),S1),claimWhatsappAiHandoff(scope(U2),S1)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'WHATSAPP_AI_SESSION_CONFLICT');
   const audit=await db.queryRead('SELECT count(*)::int AS total FROM commerce_audit_logs WHERE empresa_id=$1 AND loja_id=$2 AND entidade_id=$3 AND acao=\'claimed\'',[A,L1,S1]);assert.equal(audit.rows[0].total,1);const row=await db.queryRead('SELECT status,assigned_to FROM whatsapp_ai_sessions WHERE id=$1',[S1]);assert.equal(row.rows[0].status,'humano');assert.ok([U1,U2].includes(row.rows[0].assigned_to));
  });
  await t.test('replay do vencedor mantém responsável, horário e auditoria byte-equivalentes',async()=>{
   const winner=(await db.queryRead('SELECT assigned_to FROM whatsapp_ai_sessions WHERE id=$1',[S1])).rows[0].assigned_to;const before=await snapshot();await Promise.all([claimWhatsappAiHandoff(scope(winner),S1),claimWhatsappAiHandoff(scope(winner),S1)]);assert.deepEqual(await snapshot(),before);
  });
  await t.test('outra empresa e outra unidade não podem assumir a sessão nem produzir DML',async()=>{
   const before=await snapshot();for(const ctx of [context(B,LB,UB),context(A,L2,U1)])await assert.rejects(()=>claimWhatsappAiHandoff(ctx,S1),{code:'WHATSAPP_AI_SESSION_NOT_FOUND'});assert.deepEqual(await snapshot(),before);
  });
  await t.test('GET filtrado é tenant/unidade scoped, mascara contato e não escreve',async()=>{
   const before=await snapshot();const rows=await listWhatsappAiSessions(scope(),{status:'humano',assignment:'all',limit:100});assert.deepEqual(rows.map(x=>x.id),[S1]);assert.equal(rows[0].telefone,'***0000');assert.equal(rows[0].assigned,true);assert.equal(rows[0].assigned_to,undefined);assert.equal((await listWhatsappAiSessions(scope(),{status:'humano',assignment:'unassigned'})).length,0);const other=await listWhatsappAiSessions(context(B,LB,UB),{status:'humano'});assert.deepEqual(other.map(x=>x.id),[SB]);assert.deepEqual(await snapshot(),before);
  });
  await t.test('falha de auditoria reverte a atribuição inteira na mesma transação',async()=>{
   await db.query("CREATE FUNCTION fixture_block_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit rejected'; END $$");await db.query('CREATE TRIGGER fixture_audit_guard BEFORE INSERT ON commerce_audit_logs FOR EACH ROW EXECUTE FUNCTION fixture_block_audit()');const before=await snapshot();
   await assert.rejects(()=>claimWhatsappAiHandoff(context(A,L2,U1),S2),/fixture audit rejected/);assert.deepEqual(await snapshot(),before);await db.query('DROP TRIGGER fixture_audit_guard ON commerce_audit_logs');await db.query('DROP FUNCTION fixture_block_audit()');
  });
  await t.test('sessão não humana não pode ser assumida; nenhum envio/mensagem é criado',async()=>{
   await db.query("UPDATE whatsapp_ai_sessions SET status='ativo' WHERE id=$1",[S2]);const before=await snapshot();await assert.rejects(()=>claimWhatsappAiHandoff(context(A,L2,U1),S2),{code:'WHATSAPP_AI_SESSION_NOT_FOUND'});assert.deepEqual(await snapshot(),before);assert.equal(outbound,0);assert.equal(before.messages,0);
  });
 }finally{globalThis.fetch=fetchOriginal;await db.close()}
});
