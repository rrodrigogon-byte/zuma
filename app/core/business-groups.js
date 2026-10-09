// ============================================================================
// GRUPOS EMPRESARIAIS (HOLDINGS) — ex.: Silvester Holding, dona da Stallone.
//
// O grupo só organiza e consolida: cada empresa continua isolada por empresa_id
// (catálogo, estoque, pedidos, pagamentos, clientes, WhatsApp). Nada aqui concede
// acesso a dados de outra empresa; as rotas são exclusivas do admin da plataforma.
// ============================================================================
import { CommerceError } from './commerce-error.js';
import { db } from './database.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

export function groupSlug(value) {
  const slug = text(value, 120)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80);
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) throw new CommerceError('nome do grupo inválido', 'BUSINESS_GROUP_NAME_INVALID');
  return slug;
}

export function groupCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) throw new CommerceError('CNPJ do grupo inválido', 'BUSINESS_GROUP_CNPJ_INVALID');
  const calc = (base) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split('').reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = calc(digits.slice(0, 12));
  const second = calc(digits.slice(0, 12) + first);
  if (Number(digits[12]) !== first || Number(digits[13]) !== second) throw new CommerceError('CNPJ do grupo inválido', 'BUSINESS_GROUP_CNPJ_INVALID');
  return digits;
}

export function validateGroupInput(input = {}) {
  const nome = text(input.nome, 255);
  if (nome.length < 2) throw new CommerceError('informe o nome do grupo', 'BUSINESS_GROUP_NAME_INVALID');
  return {
    nome,
    slug: groupSlug(input.slug || nome),
    cnpj: groupCnpj(input.cnpj),
    razaoSocial: text(input.razaoSocial, 255) || null,
  };
}

export async function listBusinessGroups() {
  const result = await db.queryRead(
    `SELECT g.id, g.nome, g.slug, g.cnpj, g.razao_social, g.ativo,
            COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'cnpj', e.cnpj, 'ativa', e.ativa)
              ORDER BY e.nome) FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb) AS empresas
       FROM grupos_empresariais g
       LEFT JOIN empresas e ON e.grupo_id = g.id
      GROUP BY g.id
      ORDER BY g.nome ASC`,
  );
  return { items: result.rows };
}

export async function createBusinessGroup(input = {}) {
  const payload = validateGroupInput(input);
  return db.transaction(async trx => {
    const existing = await trx.query(
      'SELECT id, slug, cnpj FROM grupos_empresariais WHERE slug = $1 OR ($2::text IS NOT NULL AND cnpj = $2) LIMIT 1',
      [payload.slug, payload.cnpj],
    );
    if (existing.rows[0]) throw new CommerceError('já existe um grupo com este nome ou CNPJ', 'BUSINESS_GROUP_CONFLICT');
    const created = await trx.query(
      `INSERT INTO grupos_empresariais (nome, slug, cnpj, razao_social)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, slug, cnpj, razao_social, ativo`,
      [payload.nome, payload.slug, payload.cnpj, payload.razaoSocial],
    );
    return created.rows[0];
  });
}

export async function updateBusinessGroup(groupId, input = {}) {
  if (!UUID_PATTERN.test(String(groupId || ''))) throw new CommerceError('grupo inválido', 'BUSINESS_GROUP_INVALID');
  const payload = validateGroupInput(input);
  return db.transaction(async trx => {
    const result = await trx.query(
      `UPDATE grupos_empresariais
          SET nome = $2, cnpj = $3, razao_social = $4, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, nome, slug, cnpj, razao_social, ativo`,
      [groupId, payload.nome, payload.cnpj, payload.razaoSocial],
    );
    if (!result.rows[0]) throw new CommerceError('grupo não encontrado', 'BUSINESS_GROUP_NOT_FOUND');
    return result.rows[0];
  });
}

/** Vincula (ou desvincula, com grupoId null) uma empresa a um grupo. */
export async function assignCompanyToGroup(empresaId, grupoId) {
  if (!UUID_PATTERN.test(String(empresaId || ''))) throw new CommerceError('empresa inválida', 'BUSINESS_GROUP_COMPANY_INVALID');
  if (grupoId !== null && !UUID_PATTERN.test(String(grupoId || ''))) throw new CommerceError('grupo inválido', 'BUSINESS_GROUP_INVALID');
  return db.transaction(async trx => {
    if (grupoId) {
      const group = await trx.query('SELECT id FROM grupos_empresariais WHERE id = $1 AND ativo = true', [grupoId]);
      if (!group.rows[0]) throw new CommerceError('grupo não encontrado', 'BUSINESS_GROUP_NOT_FOUND');
    }
    const result = await trx.query(
      'UPDATE empresas SET grupo_id = $2, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, nome, grupo_id',
      [empresaId, grupoId],
    );
    if (!result.rows[0]) throw new CommerceError('empresa não encontrada', 'BUSINESS_GROUP_COMPANY_NOT_FOUND');
    return result.rows[0];
  });
}
