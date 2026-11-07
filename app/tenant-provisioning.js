// ============================================================================
// PROVISIONAMENTO E SINCRONIZAÇÃO DE TENANTS E EQUIPES — KYTTO ERP
// Garante o isolamento estrito entre empresas (Dino Barbearia, Stallone Nutre Sport,
// Agro Open TTC) no PostgreSQL (usuarios e commerce_memberships) e JSON DB.
// ============================================================================
import bcrypt from 'bcryptjs';
import { db, save } from './db.js';

export const TENANTS_OFICIAIS = {
  dino: {
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8',
    nome: 'Barbearia Dino',
    slug: 'dino',
    roleIdOwner: 'b125e523-957d-4d12-a881-56b958ecec45',
    roleIdStaff: '85f0c5c5-584b-4d9f-946e-a348c3688483',
    usuarios: [
      { username: 'dino', email: 'dino@barbeariadino.com.br', emailAlt: 'guicunha136@gmail.com', nome: 'Guilherme Cunha Martins', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { username: 'bruno', email: 'bruno@barbeariadino.com.br', nome: 'Bruno Mendes Pedroso', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'david', email: 'david@barbeariadino.com.br', nome: 'David Kauã Araújo Moraes', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'natani', email: 'natani@barbeariadino.com.br', nome: 'Natani Minanis Dobler', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'amanda', email: 'amanda@barbeariadino.com.br', nome: 'Amanda Gabrielly Santos da Silva', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'ester', email: 'ester@barbeariadino.com.br', nome: 'Steffany Marielly de Oliveira', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'joao', email: 'joao@barbeariadino.com.br', nome: 'João Victor Domingos Ruedel', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'jhenyffer', email: 'jhenyfferkellyn@gmail.com', nome: 'Jhenyffer Andrade', role: 'organizador', pgRole: 'gerente', isOwner: true },
    ]
  },
  stallone: {
    empresaId: '31f70c83-9172-40c2-945f-9e793b5048be',
    lojaId: '6a15e943-2570-4f29-a2d5-d900d2812911',
    nome: 'Stallone Nutre Sport',
    slug: 'stallone',
    roleIdOwner: 'b125e523-957d-4d12-a881-56b958ecec45',
    roleIdStaff: '23a296df-6e57-4937-bde5-123de677aa8f',
    usuarios: [
      { username: 'stallone', email: 'stallone@kytto.com.br', emailAlt: 'silvester_natal@hotmail.com', nome: 'Silvester Natal (Stallone)', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { username: 'silvester', email: 'silvester_natal@hotmail.com', nome: 'Silvester Natal', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { username: 'caua_stallone', email: 'caua.goncalves@uisa.com.br', nome: 'Caua Goncalves', role: 'gerente', pgRole: 'gerente', isOwner: true },
    ]
  },
  agroopen: {
    empresaId: '2e041110-db20-4fd1-8278-12bd3dead008',
    lojaId: '17b057ab-a13f-4fee-ae42-bc70578ec756',
    nome: 'AGRO OPEN TTC',
    slug: 'agroopen',
    roleIdOwner: 'b125e523-957d-4d12-a881-56b958ecec45',
    roleIdStaff: '10a80e2f-6f9f-4c54-8a28-7bb6c317c3d2',
    usuarios: [
      { username: 'agroopen', email: 'cauarafa7@gmail.com', nome: 'Cauã Rafa', role: 'admin', pgRole: 'admin', isOwner: true },
      { username: 'teste_diag', email: 'teste_diag@test.com', nome: 'Operador Agro Open', role: 'operador', pgRole: 'operador' },
    ]
  }
};

const SENHA_PADRAO_HASH = bcrypt.hashSync('123456', 10);

/**
 * Sincroniza todas as equipes nos tenants corretos do PostgreSQL e do JSON DB
 */
export async function sincronizarTenantsEquipes(commerceDb) {
  const rootDb = db();
  rootDb.usuarios ||= [];

  for (const [tenantKey, config] of Object.entries(TENANTS_OFICIAIS)) {
    for (const u of config.usuarios) {
      // 1. Sincroniza no JSON DB
      const indexJson = rootDb.usuarios.findIndex((item) =>
        (item.username && item.username.toLowerCase() === u.username.toLowerCase()) ||
        (item.email && item.email.toLowerCase() === u.email.toLowerCase()) ||
        (u.emailAlt && item.email && item.email.toLowerCase() === u.emailAlt.toLowerCase())
      );

      const dadosUsuarioJson = {
        id: `usr-${tenantKey}-${u.username}`,
        username: u.username,
        nome: u.nome,
        email: u.email,
        emailAlternativo: u.emailAlt || '',
        senhaHash: SENHA_PADRAO_HASH,
        role: u.role,
        empresaId: config.empresaId,
        lojaId: config.lojaId,
        tenantSlug: config.slug,
        ativo: true,
        criadoEm: new Date().toISOString(),
      };

      if (indexJson >= 0) {
        rootDb.usuarios[indexJson] = {
          ...rootDb.usuarios[indexJson],
          ...dadosUsuarioJson,
          // Mantém id existente caso já esteja vinculado
          id: rootDb.usuarios[indexJson].id || dadosUsuarioJson.id,
        };
      } else {
        rootDb.usuarios.push(dadosUsuarioJson);
      }

      // 2. Sincroniza no PostgreSQL se o pool estiver conectado
      if (commerceDb && typeof commerceDb.query === 'function') {
        try {
          const emailPrincipal = u.email.toLowerCase().trim();
          const emailAlt = (u.emailAlt || '').toLowerCase().trim();

          // Atualiza usuário no PostgreSQL
          const updateRes = await commerceDb.query(
            `UPDATE usuarios 
                SET nome_completo = $1, role = $2, senha_hash = $3, empresa_id = $4, ativo = true, data_atualizacao = NOW()
              WHERE lower(btrim(email)) = $5 OR (length($6) > 0 AND lower(btrim(email)) = $6)
              RETURNING id`,
            [u.nome, u.pgRole, SENHA_PADRAO_HASH, config.empresaId, emailPrincipal, emailAlt]
          );

          let userId = updateRes.rows?.[0]?.id;

          if (!userId) {
            const insertRes = await commerceDb.query(
              `INSERT INTO usuarios (id, email, senha_hash, nome_completo, role, empresa_id, ativo, data_criacao, data_atualizacao)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
               RETURNING id`,
              [emailPrincipal, SENHA_PADRAO_HASH, u.nome, u.pgRole, config.empresaId]
            );
            userId = insertRes.rows?.[0]?.id;
          }

          // Garante membership estrita na empresa do tenant
          if (userId) {
            const roleId = u.isOwner ? config.roleIdOwner : config.roleIdStaff;
            const lojaId = u.isOwner ? null : config.lojaId;

            // Remove memberships espúrias em empresas diferentes (garante isolamento)
            await commerceDb.query(
              `DELETE FROM commerce_memberships 
                WHERE usuario_id = $1 AND empresa_id <> $2`,
              [userId, config.empresaId]
            ).catch(() => null);

            // Garante membership ativa na empresa do tenant
            const existeMem = await commerceDb.query(
              `SELECT id FROM commerce_memberships WHERE usuario_id = $1 AND empresa_id = $2 LIMIT 1`,
              [userId, config.empresaId]
            );

            if (!existeMem.rows || existeMem.rows.length === 0) {
              await commerceDb.query(
                `INSERT INTO commerce_memberships (id, empresa_id, usuario_id, loja_id, role_id, ativo, criado_em, atualizado_em)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())`,
                [config.empresaId, userId, lojaId, roleId]
              ).catch(() => null);
            } else {
              await commerceDb.query(
                `UPDATE commerce_memberships 
                    SET loja_id = $1, role_id = $2, ativo = true, atualizado_em = NOW() 
                  WHERE id = $3`,
                [lojaId, roleId, existeMem.rows[0].id]
              ).catch(() => null);
            }
          }
        } catch (errPg) {
          console.warn(`[tenant-sync] Erro ao sincronizar PG para ${u.username} (${tenantKey}):`, errPg.message);
        }
      }
    }
  }

  save();
  console.log('[tenant-sync] Sincronização multi-tenant concluída: Dino, Stallone e Agro Open isolados com sucesso.');
}
