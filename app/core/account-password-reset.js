import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { findOperationalByEmail } from './commerce-operational-invites.js';

export const RESET_TTL_MINUTES = 20;
export const RESET_MESSAGE = 'Se este e-mail estiver cadastrado e ativo, você receberá um link para criar uma nova senha. Confira também o spam.';
const emailNorm = value => String(value || '').trim().toLowerCase();
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const tokenValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export function resetPasswordPolicy(value) {
  return typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value,'utf8') <= 72
    && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9\s]/.test(value);
}

export function createAccountPasswordRecovery({ database, getLegacyUsers, saveLegacy, sendMail, enabled = () => true, canSend = () => true }) {
  const query = (text, values) => database.query(text, values);
  async function identity(type, id, q = query) {
    if (type === 'legacy') {
      const matches = getLegacyUsers().filter(u => String(u.id) === String(id) && u.ativo === true && u.email);
      const user = matches.length === 1 ? matches[0] : null;
      return user?.senhaHash ? {type,id:String(user.id),email:emailNorm(user.email),nome:user.nome,hash:user.senhaHash,legacy:user} : null;
    }
    if (type === 'account') {
      const row = (await q('SELECT * FROM commerce_accounts WHERE id=$1 AND ativo=true',[id])).rows[0];
      if (!row) return null;
      if (row.origem === 'legacy') {
        const source = await identity('legacy',row.origem_id,q);
        return source?.email === row.email ? {...source,type,id:String(row.id)} : null;
      }
      return {type,id:String(row.id),email:row.email,nome:row.nome,hash:row.senha_hash};
    }
    const row = (await q('SELECT id,email,nome_completo,senha_hash FROM usuarios WHERE id=$1 AND ativo=true',[id])).rows[0];
    if (!row) return null;
    // A recuperação operacional segue exatamente a mesma identidade elegível do login.
    const operational = await findOperationalByEmail(row.email,{database:{queryRead:q}});
    if (!operational || String(operational.id) !== String(id)) return null;
    return {type,id:String(row.id),email:emailNorm(row.email),nome:row.nome_completo,hash:row.senha_hash};
  }
  async function findIdentity(email) {
    const account = (await query('SELECT id FROM commerce_accounts WHERE email=$1',[email])).rows[0];
    if (account) return identity('account',account.id);
    const legacy = getLegacyUsers().filter(u => emailNorm(u.email) === email);
    if (legacy.length) return legacy.length === 1 ? identity('legacy',legacy[0].id) : null;
    const rows = (await query('SELECT id FROM usuarios WHERE lower(btrim(email))=$1 AND ativo=true LIMIT 2',[email])).rows;
    return rows.length === 1 ? identity('operational',rows[0].id) : null;
  }
  async function request(email) {
    email = emailNorm(email);
    if (!enabled() || !canSend() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return;
    const target = await findIdentity(email);
    if (!target?.hash) return;
    const token = crypto.randomBytes(32).toString('base64url');
    const row = await database.transaction(async trx => {
      await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`auth-reset:${target.type}:${target.id}`]);
      const current = await identity(target.type,target.id,(text,values)=>trx.query(text,values));
      if (!current || current.email !== target.email) return null;
      Object.assign(target,current);
      const recent = (await trx.query("SELECT 1 FROM auth_password_resets WHERE subject_type=$1 AND subject_id=$2 AND criado_em>CURRENT_TIMESTAMP-interval '60 seconds' LIMIT 1",[target.type,target.id])).rows[0];
      if (recent) return null;
      await trx.query('UPDATE auth_password_resets SET used_at=CURRENT_TIMESTAMP WHERE subject_type=$1 AND subject_id=$2 AND used_at IS NULL',[target.type,target.id]);
      return (await trx.query(`INSERT INTO auth_password_resets(subject_type,subject_id,token_hash,credential_hash,expires_at)
        VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP+interval '20 minutes') RETURNING id,expires_at`,[target.type,target.id,digest(token),digest(target.hash)])).rows[0];
    });
    if (!row) return;
    let accepted = false;
    try { const result = await sendMail(target.email,target.nome,`https://kytto.com.br/redefinir-senha#token=${token}`,row.expires_at); accepted = result?.ok === true && Boolean(result.id) && !result.simulado; }
    catch { /* Falha neutra; o token não será habilitado. */ }
    await query('UPDATE auth_password_resets SET delivered=$2,used_at=CASE WHEN $2 THEN used_at ELSE CURRENT_TIMESTAMP END WHERE id=$1',[row.id,accepted]);
    console.info(accepted ? '[AUTH_RESET] mail_accepted' : '[AUTH_RESET] mail_failed');
  }
  async function loadToken(token, q = query, lock = false) {
    if (!enabled() || !tokenValid(token)) return null;
    const row = (await q(`SELECT * FROM auth_password_resets WHERE token_hash=$1 AND delivered=true AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP${lock ? ' FOR UPDATE' : ''}`,[digest(token)])).rows[0];
    if (!row) return null;
    const target = await identity(row.subject_type,row.subject_id,q);
    return target && digest(target.hash) === row.credential_hash ? {row,target} : null;
  }
  async function validate(token) { return {ok:Boolean(await loadToken(token))}; }
  async function consume(token, password) {
    if (!resetPasswordPolicy(password)) return {ok:false,code:'WEAK_PASSWORD'};
    const peek = await loadToken(token);
    if (!peek) return {ok:false,code:'INVALID_TOKEN'};
    const hash = await bcrypt.hash(password,12);
    return database.transaction(async trx => {
      await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`auth-reset:${peek.row.subject_type}:${peek.row.subject_id}`]);
      const found = await loadToken(token,(text,values)=>trx.query(text,values),true);
      if (!found) return {ok:false,code:'INVALID_TOKEN'};
      const {row,target} = found;
      const changed = new Date().toISOString();
      if (target.legacy) {
        const user = target.legacy;
        const previous = {senhaHash:user.senhaHash,passwordChangedAt:user.passwordChangedAt};
        user.senhaHash=hash; user.passwordChangedAt=changed;
        try { await saveLegacy(); } catch(error) { Object.assign(user,previous); throw error; }
        if (target.type === 'account') await trx.query('UPDATE commerce_accounts SET password_changed_at=$2,atualizado_em=CURRENT_TIMESTAMP WHERE id=$1',[target.id,changed]);
      } else {
        const table = target.type === 'account' ? 'commerce_accounts' : 'usuarios';
        const updated = target.type === 'account' ? 'atualizado_em' : 'data_atualizacao';
        const result = await trx.query(`UPDATE ${table} SET senha_hash=$2,password_changed_at=$3,${updated}=CURRENT_TIMESTAMP WHERE id=$1 AND ativo=true AND senha_hash=$4 RETURNING id`,[target.id,hash,changed,target.hash]);
        if (result.rows.length !== 1) return {ok:false,code:'INVALID_TOKEN'};
      }
      if (target.type === 'account') await trx.query('UPDATE usuarios SET password_changed_at=$2 WHERE id IN (SELECT usuario_id FROM commerce_account_users WHERE account_id=$1)',[target.id,changed]);
      await trx.query('UPDATE auth_password_resets SET used_at=CURRENT_TIMESTAMP WHERE subject_type=$1 AND subject_id=$2 AND used_at IS NULL',[row.subject_type,row.subject_id]);
      return {ok:true};
    });
  }
  return { request, validate, consume };
}
