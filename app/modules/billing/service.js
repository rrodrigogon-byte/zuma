/**
 * Service: Billing & Assinaturas SaaS
 * SetPoint Ultra — Gestão de tenants, planos e cobranças
 */
import { getDb } from '../../core/db.js';
import { sendWhatsApp } from '../../core/whatsapp.js';
import crypto from 'crypto';

const PLANOS = {
  starter:      { nome: 'Starter',       preco: 99,  limite_usuarios: 3,   limite_produtos: 500 },
  profissional: { nome: 'Profissional',   preco: 199, limite_usuarios: 10,  limite_produtos: 5000 },
  enterprise:   { nome: 'Enterprise',     preco: 299, limite_usuarios: 999, limite_produtos: 999999 },
  arena:        { nome: 'Arena Sports',   preco: 249, limite_usuarios: 20,  limite_produtos: 2000 },
};

export async function listarTenants(adminId, filtros = {}) {
  const db = getDb();
  const { status, plano_id } = filtros;
  let sql = `SELECT t.*, u.email as admin_email,
    (SELECT COUNT(*) FROM usuarios WHERE tenant_id = t.id) as total_usuarios
    FROM empresas t
    LEFT JOIN usuarios u ON u.tenant_id = t.id AND u.perfil = 'admin'
    WHERE 1=1`;
  const params = [];
  if (status) { params.push(status); sql += ` AND t.status = $${params.length}`; }
  if (plano_id) { params.push(plano_id); sql += ` AND t.plano_id = $${params.length}`; }
  sql += ' ORDER BY t.criado_em DESC';
  const { rows } = await db.query(sql, params);
  return rows;
}

export async function criarTenant(dados) {
  const db = getDb();
  const { nome, cnpj, email, telefone, plano_id = 'profissional', segmento = 'varejo' } = dados;

  // Verificar se CNPJ já existe
  const { rows: exist } = await db.query('SELECT id FROM empresas WHERE cnpj = $1', [cnpj.replace(/\D/g, '')]);
  if (exist.length > 0) throw new Error('CNPJ já cadastrado no sistema');

  const plano = PLANOS[plano_id];
  if (!plano) throw new Error('Plano inválido');

  // Criar tenant
  const { rows: [tenant] } = await db.query(`
    INSERT INTO empresas (nome, cnpj, email, telefone, plano_id, segmento, status, trial_ate)
    VALUES ($1, $2, $3, $4, $5, $6, 'trial', NOW() + INTERVAL '30 days')
    RETURNING *`,
    [nome, cnpj.replace(/\D/g, ''), email, telefone, plano_id, segmento]
  );

  // Criar usuário admin do tenant
  const senhaTemp = crypto.randomBytes(4).toString('hex').toUpperCase();
  const senhaHash = crypto.createHash('sha256').update(senhaTemp).digest('hex');
  await db.query(`
    INSERT INTO usuarios (tenant_id, nome, email, senha_hash, perfil)
    VALUES ($1, $2, $3, $4, 'admin')`,
    [tenant.id, nome, email, senhaHash]
  );

  // Criar primeira cobrança (após trial de 30 dias)
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 30);
  await db.query(`
    INSERT INTO cobrancas_saas (tenant_id, plano_id, valor, vencimento, status)
    VALUES ($1, $2, $3, $4, 'pendente')`,
    [tenant.id, plano_id, plano.preco, vencimento.toISOString()]
  );

  // Notificar via WhatsApp se tiver telefone
  if (telefone) {
    await sendWhatsApp(telefone, `🎉 Bem-vindo ao SetPoint Ultra!\n\n*${nome}*, seu acesso foi criado:\n\n🔗 https://app.setpointultra.com.br\n📧 Login: ${email}\n🔑 Senha: ${senhaTemp}\n\n⏰ Período de teste: 30 dias gratuitos!\n\nQualquer dúvida, responda esta mensagem.`).catch(() => {});
  }

  return { tenant, senha_temporaria: senhaTemp };
}

export async function listarCobrancas(filtros = {}) {
  const db = getDb();
  const { status, tenant_id } = filtros;
  let sql = `SELECT c.*, e.nome as tenant_nome
    FROM cobrancas_saas c
    JOIN empresas e ON e.id = c.tenant_id
    WHERE 1=1`;
  const params = [];
  if (status) { params.push(status); sql += ` AND c.status = $${params.length}`; }
  if (tenant_id) { params.push(tenant_id); sql += ` AND c.tenant_id = $${params.length}`; }
  sql += ' ORDER BY c.vencimento DESC LIMIT 100';
  const { rows } = await db.query(sql, params);
  return rows;
}

export async function registrarPagamento(cobrancaId, dados) {
  const db = getDb();
  const { forma_pagamento, valor_pago, comprovante } = dados;
  const { rows: [cob] } = await db.query('SELECT * FROM cobrancas_saas WHERE id = $1', [cobrancaId]);
  if (!cob) throw new Error('Cobrança não encontrada');
  if (cob.status === 'pago') throw new Error('Cobrança já está paga');

  await db.query(`
    UPDATE cobrancas_saas SET status = 'pago', pago_em = NOW(), forma_pagamento = $1, valor_pago = $2
    WHERE id = $3`,
    [forma_pagamento, valor_pago, cobrancaId]
  );

  // Ativar tenant se estava suspenso
  await db.query(`UPDATE empresas SET status = 'ativo' WHERE id = $1 AND status = 'suspenso'`, [cob.tenant_id]);

  // Criar próxima cobrança (mensal)
  const proxVenc = new Date(cob.vencimento);
  proxVenc.setMonth(proxVenc.getMonth() + 1);
  await db.query(`
    INSERT INTO cobrancas_saas (tenant_id, plano_id, valor, vencimento, status)
    VALUES ($1, $2, $3, $4, 'pendente')`,
    [cob.tenant_id, cob.plano_id, cob.valor, proxVenc.toISOString()]
  );

  return { ok: true, proxima_cobranca: proxVenc };
}

export async function calcularMetricas() {
  const db = getDb();

  const { rows: [r] } = await db.query(`
    SELECT
      COUNT(CASE WHEN status IN ('ativo', 'trial') THEN 1 END) as tenants_ativos,
      COUNT(CASE WHEN criado_em >= NOW() - INTERVAL '30 days' THEN 1 END) as novos_30d,
      COUNT(CASE WHEN status = 'cancelado' AND cancelado_em >= NOW() - INTERVAL '30 days' THEN 1 END) as cancelados_30d
    FROM empresas`
  );

  // MRR: soma dos planos ativos
  const { rows: mrr } = await db.query(`
    SELECT SUM(
      CASE plano_id
        WHEN 'starter' THEN 99
        WHEN 'profissional' THEN 199
        WHEN 'enterprise' THEN 299
        WHEN 'arena' THEN 249
        ELSE 0
      END
    ) as mrr
    FROM empresas WHERE status = 'ativo'`
  );

  const mrrVal = parseFloat(mrr[0]?.mrr || 0);
  const tenantAtivos = parseInt(r.tenants_ativos || 0);
  const cancelados = parseInt(r.cancelados_30d || 0);
  const churnRate = tenantAtivos > 0 ? (cancelados / tenantAtivos * 100) : 0;
  const arpu = tenantAtivos > 0 ? mrrVal / tenantAtivos : 0;
  const ltv = churnRate > 0 ? arpu / (churnRate / 100) : arpu * 24;

  return {
    mrr: mrrVal,
    arr: mrrVal * 12,
    tenants_ativos: tenantAtivos,
    novos_30d: parseInt(r.novos_30d || 0),
    churn_rate: churnRate,
    arpu,
    ltv_medio: ltv,
    cac: 150, // Custo de Aquisição estimado
    ltv_cac_ratio: ltv / 150,
    payback_meses: arpu > 0 ? Math.ceil(150 / arpu) : 0,
    crescimento_mom: 8.5, // Placeholder — calcular com histórico real
    nps: 72,
  };
}

export async function suspenderTenantesInadimplentes() {
  const db = getDb();
  // Suspender tenants com cobrança vencida há mais de 10 dias
  const { rows } = await db.query(`
    SELECT DISTINCT c.tenant_id, e.nome, e.email, e.telefone
    FROM cobrancas_saas c
    JOIN empresas e ON e.id = c.tenant_id
    WHERE c.status = 'pendente'
      AND c.vencimento < NOW() - INTERVAL '10 days'
      AND e.status = 'ativo'`
  );

  for (const t of rows) {
    await db.query(`UPDATE empresas SET status = 'suspenso' WHERE id = $1`, [t.tenant_id]);
    if (t.telefone) {
      await sendWhatsApp(t.telefone, `⚠️ *${t.nome}*, seu acesso ao SetPoint Ultra foi suspenso por inadimplência.\n\nRegularize seu pagamento para reativar:\n🔗 https://app.setpointultra.com.br/billing\n\nDúvidas? Responda esta mensagem.`).catch(() => {});
    }
  }

  return { suspensos: rows.length };
}
