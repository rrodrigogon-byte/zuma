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
    cnpj: '50073355000189',
    roleIdOwner: 'b125e523-957d-4d12-a881-56b958ecec45',
    roleIdStaff: '85f0c5c5-584b-4d9f-946e-a348c3688483',
    usuarios: [
      { username: 'bruno', email: 'bruno@barbeariadino.com.br', emailAlt: 'brunomendes@barbeariadino.com.br', nome: 'Bruno Mendes Pedroso', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'dino', email: 'dino@barbeariadino.com.br', emailAlt: 'guicunha136@gmail.com', nome: 'Guilherme Cunha Martins', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { username: 'natani', email: 'natani@barbeariadino.com.br', emailAlt: 'nati@barbeariadino.com.br', nome: 'Natani Minanis Dobler', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'ster', email: 'ster@barbeariadino.com.br', emailAlt: 'ester@barbeariadino.com.br', nome: 'Steffany Marielly de Oliveira (Ster)', role: 'operador', pgRole: 'operador' },
      { username: 'jhenyffer', email: 'jhenyfferkellyn@gmail.com', emailAlt: 'jhenyffer@barbeariadino.com.br', nome: 'Jhenyffer Andrade', role: 'organizador', pgRole: 'gerente', isOwner: true },
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
      { username: 'silvester_agro', email: 'silvester_natal@hotmail.com', nome: 'Silvester Natal', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { username: 'teste_diag', email: 'teste_diag@test.com', nome: 'Operador Agro Open', role: 'operador', pgRole: 'operador' },
    ]
  }
,
  casanova: {
    empresaId: 'b7b7ac01-8e50-4b61-8c79-de4aaa916db1',
    lojaId: 'b7b7ac01-8e50-4b61-8c79-de4aaa916db2',
    nome: 'Casa Nova Imóveis & Construtora',
    slug: 'casanova',
    roleIdOwner: 'b125e523-957d-4d12-a881-56b958ecec45',
    roleIdStaff: '85f0c5c5-584b-4d9f-946e-a348c3688483',
    usuarios: [
      { id: 'usr-casanova-keyuser-01', username: 'casanova', email: 'casanova@casanovaimoveistga.com.br', nome: 'Key User - Imóveis (Casa Nova)', role: 'keyuser', pgRole: 'operador', isOwner: false },
      { id: 'usr-casanova-admin-01', username: 'admin_casanova', email: 'contato@casanovaimoveistga.com.br', nome: 'Administrador Casa Nova', role: 'organizador', pgRole: 'gerente', isOwner: true },
    ]
  },
  palatare: {
    empresaId: 'c1c1ac01-8e50-4b61-8c79-de4aaa916da9',
    lojaId: 'c1c1ac01-8e50-4b61-8c79-de4aaa916da0',
    nome: 'Palatare Pizzaria & Restaurante',
    slug: 'palatare',
    roleIdOwner: 'b125e523-957d-4d12-a881-56b958ecec45',
    roleIdStaff: '85f0c5c5-584b-4d9f-946e-a348c3688483',
    usuarios: [
      { id: 'usr-palatare-gerente-01', username: 'palatare', email: 'contato@palatarepizzaria.com.br', emailAlt: 'admin@palatarepizzaria.com.br', nome: 'Gerente Palatare', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { id: 'usr-palatare-pizzaiolo-01', username: 'pizzaiolo', email: 'cozinha@palatarepizzaria.com.br', nome: 'Chef Pizzaiolo Palatare', role: 'operador', pgRole: 'operador' },
      { id: 'usr-palatare-atendente-01', username: 'atendente_palatare', email: 'atendimento@palatarepizzaria.com.br', nome: 'Atendente Palatare', role: 'operador', pgRole: 'operador' },
    ]
  },
  concreto: {
    empresaId: "c2c2ac01-8e50-4b61-8c79-de4aaa916da2",
    lojaId: "c2c2ac01-8e50-4b61-8c79-de4aaa916da0",
    nome: "Serrano Concreto Usinado",
    slug: "concreto",
    cnpj: "14229191000190",
    roleIdOwner: "b125e523-957d-4d12-a881-56b958ecec45",
    roleIdStaff: "85f0c5c5-584b-4d9f-946e-a348c3688483",
    usuarios: [
      { id: "usr-concreto-admin-01", username: "concreto", email: "gerente@serranoconcreto.com.br", nome: "Gerente Usina Serrano", role: "organizador", pgRole: "gerente", isOwner: true },
      { id: "usr-concreto-operador-01", username: "operador_usina", email: "usina@serranoconcreto.com.br", nome: "Operador Central Dosadora", role: "operador", pgRole: "operador" },
      { id: "usr-concreto-despacho-01", username: "despacho", email: "despacho@serranoconcreto.com.br", nome: "Despacho & Balança", role: "operador", pgRole: "operador" },
    ]
  }
};

const SENHA_PADRAO_HASH = '$2a$10$GhTXS1zakV8wRo77OFp2JOvCJj9ezTUPg75ZbBupWek/RBR/.SHcq';

/**
 * Sincroniza todas as equipes nos tenants corretos do PostgreSQL e do JSON DB
 */
export async function sincronizarTenantsEquipes(commerceDb) {
  const rootDb = db();
  rootDb.usuarios ||= [];

  for (const [tenantKey, config] of Object.entries(TENANTS_OFICIAIS)) {
    // Garante que a empresa e loja do tenant existam no PostgreSQL para respeitar as FKs
    if (commerceDb && typeof commerceDb.query === 'function') {
      try {
        await commerceDb.query(
          `INSERT INTO empresas (id, nome, razao_social, cnpj, ativa, tipo_negocio, data_criacao, data_atualizacao)
           VALUES ($1, $2, $2, $3, true, $4, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             nome = EXCLUDED.nome,
             ativa = true,
             data_atualizacao = NOW()`,
          [
            config.empresaId,
            config.nome,
            String(config.cnpj || '12345678000199').replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
            tenantKey === 'palatare' ? 'restaurante' : (tenantKey === 'casanova' || tenantKey === 'stallone' ? 'loja' : (tenantKey === 'supermercado' ? 'supermercado' : (tenantKey === 'barbearia' || tenantKey === 'dino' ? 'barbearia' : 'outro')))
          ]
        );
        if (config.lojaId) {
          await commerceDb.query(
            `INSERT INTO lojas (id, empresa_id, nome, codigo, timezone, ativa, configuracoes, data_criacao, data_atualizacao)
             VALUES ($1, $2, $3, $4, 'America/Cuiaba', true, '{}'::jsonb, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
               nome = EXCLUDED.nome,
               ativa = true,
               data_atualizacao = NOW()`,
            [config.lojaId, config.empresaId, `${config.nome} - Principal`, config.slug || 'principal']
          );
        }
      } catch (tenantInitErr) {
        console.warn(`[tenant-provisioning] Aviso ao garantir empresa/loja ${tenantKey} no PostgreSQL:`, tenantInitErr.message);
      }
    }

    for (const u of config.usuarios) {
      // 1. Sincroniza no JSON DB
      const indexJson = rootDb.usuarios.findIndex((item) =>
        (item.username && item.username.toLowerCase() === u.username.toLowerCase()) ||
        (item.email && item.email.toLowerCase() === u.email.toLowerCase()) ||
        (u.emailAlt && item.email && item.email.toLowerCase() === u.emailAlt.toLowerCase())
      );

      const dadosUsuarioJson = {
        id: u.id || `usr-${tenantKey}-${u.username}`,
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
          // Mantém id e senha existentes caso já esteja vinculado
          id: rootDb.usuarios[indexJson].id || dadosUsuarioJson.id,
          senhaHash: rootDb.usuarios[indexJson].senhaHash || SENHA_PADRAO_HASH,
        };
      } else {
        rootDb.usuarios.push(dadosUsuarioJson);
      }

      // 2. Sincroniza no PostgreSQL se o pool estiver conectado
      if (commerceDb && typeof commerceDb.query === 'function') {
        try {
          const emailPrincipal = u.email.toLowerCase().trim();
          const emailAlt = (u.emailAlt || '').toLowerCase().trim();

          // Atualiza usuário no PostgreSQL preservando senha alterada se houver
          const updateRes = await commerceDb.query(
            `UPDATE usuarios 
                SET nome_completo = $1, role = $2, empresa_id = $3, ativo = true, data_atualizacao = NOW()
              WHERE lower(btrim(email)) = $4 OR (length($5) > 0 AND lower(btrim(email)) = $5)
              RETURNING id`,
            [u.nome, u.pgRole, config.empresaId, emailPrincipal, emailAlt]
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

            const memExist = await commerceDb.query(
              `SELECT id FROM commerce_memberships WHERE usuario_id = $1 AND empresa_id = $2 LIMIT 1`,
              [userId, config.empresaId]
            );
            if (memExist.rows?.[0]?.id) {
              await commerceDb.query(
                `UPDATE commerce_memberships SET loja_id = $2, role_id = $3, ativo = true, atualizado_em = NOW() WHERE id = $1`,
                [memExist.rows[0].id, lojaId, roleId]
              );
            } else {
              await commerceDb.query(
                `INSERT INTO commerce_memberships (id, usuario_id, empresa_id, loja_id, role_id, ativo, criado_em, atualizado_em)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())`,
                [userId, config.empresaId, lojaId, roleId]
              );
            }
          }
        } catch (dbErr) {
          console.warn(`[tenant-provisioning] Aviso ao sincronizar usuário ${u.username} no PostgreSQL:`, dbErr.message);
        }
      }
    }
  }

  // 3. Desativa ex-profissionais da Dino no PostgreSQL se o pool estiver conectado (Bruno Mendes é ATIVO e titular!)
  if (commerceDb && typeof commerceDb.query === 'function') {
    try {
      const emailsDesligados = ['david@barbeariadino.com.br', 'amanda@barbeariadino.com.br', 'joao@barbeariadino.com.br', 'brunorafael@barbeariadino.com.br'];
      await commerceDb.query(
        `UPDATE usuarios SET ativo = false, data_atualizacao = NOW() WHERE lower(btrim(email)) = ANY($1::text[])`,
        [emailsDesligados]
      );
      await commerceDb.query(
        `UPDATE commerce_memberships SET ativo = false WHERE usuario_id IN (SELECT id FROM usuarios WHERE lower(btrim(email)) = ANY($1::text[]))`,
        [emailsDesligados]
      );
      await commerceDb.query(
        `UPDATE usuarios_lojas SET ativo = false WHERE usuario_id IN (SELECT id FROM usuarios WHERE lower(btrim(email)) = ANY($1::text[]))`,
        [emailsDesligados]
      );
    } catch (_) {}
  }

  save();
  return { ok: true };
}
