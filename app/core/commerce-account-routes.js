import express from 'express';
import { db } from './database.js';
import { accountDetails, accountManagementOptions, assertAccountManager, createAccount, createManagedCustomers, importAccount, listAccounts, saveAccountAccess, setAccountActive } from './commerce-accounts.js';

export function accountManagementError(res, error) {
  const code = error?.code || 'ACCOUNT_UNAVAILABLE';
  const status = code === 'PERMISSION_DENIED' ? 403
    : ['IDENTITY_ALREADY_EXISTS','23505','LAST_TENANT_OWNER_REQUIRED','CUSTOMER_EMAIL_CONFLICT','CUSTOMER_PHONE_CONFLICT','CONTACT_CONFLICT'].includes(code) ? 409
      : ['ACCOUNT_NOT_FOUND','TENANT_NOT_FOUND','STORE_NOT_FOUND','ROLE_NOT_FOUND'].includes(code) ? 404
        : ['VALIDATION_ERROR','INVALID_ID','INVALID_EMAIL','INVALID_NAME','WEAK_PASSWORD','CUSTOMER_REQUIRED','MEMBERSHIP_SCOPE_INVALID','MEMBERSHIP_EXPIRATION_INVALID'].includes(code) ? 400 : 503;
  return res.status(status).json({ error: status === 503 ? 'Gestão de contas temporariamente indisponível.' : code === '23505' ? 'Conta já cadastrada. Selecione o cadastro existente.' : error.message, code:code === '23505' ? 'IDENTITY_ALREADY_EXISTS' : code });
}

export function createAccountManagementRouter({ getLegacyUsers, reservedEmail }) {
  const router = express.Router();
  router.use((req,res,next) => {
    res.set('Cache-Control','private, no-store');
    try { assertAccountManager(req.user); next(); } catch (error) { accountManagementError(res,error); }
  });
  const deps = () => ({ legacyUsers:getLegacyUsers(), reservedEmail });
  router.get('/options', async (req,res) => {
    try { res.json(await accountManagementOptions(req.user)); } catch (error) { accountManagementError(res,error); }
  });
  router.get('/sources', async (req,res) => {
    const query = String(req.query.query || '').trim().slice(0,120);
    if (query.length < 3) return res.json({ items:[] });
    try {
      const search = query.toLocaleLowerCase('pt-BR');
      const legacy = getLegacyUsers().filter(user => user.ativo !== false && !user.platformAdmin && !reservedEmail(user.email)
        && `${user.nome} ${user.email}`.toLocaleLowerCase('pt-BR').includes(search)).slice(0,25)
        .map(user => ({ source:'legacy', sourceId:String(user.id), nome:user.nome, email:user.email, empresaNome:'Painel legado' }));
      const escaped = query.replace(/[\\%_]/g, '\\$&');
      const sql = await db.queryRead(`SELECT u.id AS "sourceId",u.nome_completo AS nome,u.email,e.nome AS "empresaNome"
        FROM usuarios u JOIN empresas e ON e.id=u.empresa_id
        WHERE u.ativo=true AND (u.nome_completo ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
        AND NOT EXISTS (SELECT 1 FROM commerce_account_users au WHERE au.usuario_id=u.id)
        AND NOT EXISTS (SELECT 1 FROM commerce_memberships m JOIN commerce_roles r ON r.id=m.role_id WHERE m.usuario_id=u.id AND r.codigo='platform_owner')
        ORDER BY u.nome_completo,u.id LIMIT 25`, [escaped]);
      res.json({ items:[...legacy,...sql.rows.filter(row => !reservedEmail(row.email)).map(row => ({ ...row, source:'commerce' }))] });
    } catch (error) { accountManagementError(res,error); }
  });
  router.get('/', async (req,res) => {
    try { res.json(await listAccounts(req.user, req.query.query || '')); } catch (error) { accountManagementError(res,error); }
  });
  router.post('/', async (req,res) => {
    try { res.status(201).json(await createAccount(req.user, req.body || {}, deps())); } catch (error) { accountManagementError(res,error); }
  });
  router.post('/import', async (req,res) => {
    try { res.status(201).json(await importAccount(req.user, req.body || {}, deps())); } catch (error) { accountManagementError(res,error); }
  });
  router.post('/customers', async (req,res) => {
    try { res.status(201).json(await createManagedCustomers(req.user, req.body || {})); } catch (error) { accountManagementError(res,error); }
  });
  router.get('/:id', async (req,res) => {
    try { res.json(await accountDetails(req.user,req.params.id)); } catch (error) { accountManagementError(res,error); }
  });
  router.post('/:id/access', async (req,res) => {
    try { res.json(await saveAccountAccess(req.user,req.params.id,req.body || {})); } catch (error) { accountManagementError(res,error); }
  });
  router.patch('/:id', async (req,res) => {
    try { res.json(await setAccountActive(req.user,req.params.id,req.body?.ativo)); } catch (error) { accountManagementError(res,error); }
  });
  return router;
}
