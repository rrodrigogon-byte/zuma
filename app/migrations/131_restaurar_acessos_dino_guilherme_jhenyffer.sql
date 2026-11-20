-- Migration 131: Restaurar e assegurar acessos de Guilherme Cunha Martins e Jhenyffer Andrade à Barbearia Dino
-- Criação/reativação em usuarios, commerce_accounts, commerce_account_users e commerce_memberships

DO $$
DECLARE
  v_empresa_dino_id uuid := 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  v_loja_dino_id uuid := 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
  v_role_owner_id uuid := 'b125e523-957d-4d12-a881-56b958ecec45';
  v_role_prof_id uuid := '85f0c5c5-584b-4d9f-946e-a348c3688483';
  v_gui_user_id uuid;
  v_jhe_user_id uuid;
  v_gui_acc_id uuid;
  v_jhe_acc_id uuid;
  v_default_hash text := '$2a$10$fp/IZnX7t2zhJIGFqyiclO3WJU0QJVmXm3NBqSyjctH0zaqns87o6'; -- '123456'
BEGIN
  -- 1. Reativar e garantir Guilherme Cunha Martins em usuarios
  SELECT id INTO v_gui_user_id FROM usuarios WHERE lower(btrim(email)) = 'guicunha136@gmail.com' LIMIT 1;
  IF v_gui_user_id IS NULL THEN
    v_gui_user_id := gen_random_uuid();
    INSERT INTO usuarios (id, empresa_id, email, senha_hash, nome_completo, role, ativo, data_criacao, data_atualizacao)
    VALUES (v_gui_user_id, v_empresa_dino_id, 'guicunha136@gmail.com', v_default_hash, 'Guilherme Cunha Martins', 'gerente', true, NOW(), NOW());
  ELSE
    UPDATE usuarios
    SET ativo = true, role = 'gerente', empresa_id = v_empresa_dino_id, nome_completo = 'Guilherme Cunha Martins', data_atualizacao = NOW()
    WHERE id = v_gui_user_id;
  END IF;

  -- 2. Reativar e garantir Jhenyffer Andrade em usuarios
  SELECT id INTO v_jhe_user_id FROM usuarios WHERE lower(btrim(email)) = 'jhenyfferkellyn@gmail.com' LIMIT 1;
  IF v_jhe_user_id IS NULL THEN
    v_jhe_user_id := gen_random_uuid();
    INSERT INTO usuarios (id, empresa_id, email, senha_hash, nome_completo, role, ativo, data_criacao, data_atualizacao)
    VALUES (v_jhe_user_id, v_empresa_dino_id, 'jhenyfferkellyn@gmail.com', v_default_hash, 'Jhenyffer Andrade', 'gerente', true, NOW(), NOW());
  ELSE
    UPDATE usuarios
    SET ativo = true, role = 'gerente', empresa_id = v_empresa_dino_id, nome_completo = 'Jhenyffer Andrade', data_atualizacao = NOW()
    WHERE id = v_jhe_user_id;
  END IF;

  -- 3. Reativar contas em commerce_accounts desativadas indevidamente pela migration 129
  UPDATE commerce_accounts SET ativo = true, atualizado_em = NOW()
  WHERE lower(btrim(email)) IN ('rodrigo.goncalves@uisa.com.br', 'caua.goncalves@uisa.com.br');

  -- 4. Garantir Guilherme em commerce_accounts
  SELECT id INTO v_gui_acc_id FROM commerce_accounts WHERE lower(btrim(email)) = 'guicunha136@gmail.com' LIMIT 1;
  IF v_gui_acc_id IS NULL THEN
    v_gui_acc_id := gen_random_uuid();
    INSERT INTO commerce_accounts (id, email, nome, telefone, senha_hash, ativo, origem, origem_id, criado_em, atualizado_em)
    VALUES (v_gui_acc_id, 'guicunha136@gmail.com', 'Guilherme Cunha Martins', '65999990001', v_default_hash, true, 'commerce', v_gui_user_id::text, NOW(), NOW());
  ELSE
    UPDATE commerce_accounts
    SET ativo = true, nome = 'Guilherme Cunha Martins', origem = 'commerce', origem_id = v_gui_user_id::text, atualizado_em = NOW()
    WHERE id = v_gui_acc_id;
  END IF;

  -- 5. Garantir Jhenyffer em commerce_accounts
  SELECT id INTO v_jhe_acc_id FROM commerce_accounts WHERE lower(btrim(email)) = 'jhenyfferkellyn@gmail.com' LIMIT 1;
  IF v_jhe_acc_id IS NULL THEN
    v_jhe_acc_id := gen_random_uuid();
    INSERT INTO commerce_accounts (id, email, nome, telefone, senha_hash, ativo, origem, origem_id, criado_em, atualizado_em)
    VALUES (v_jhe_acc_id, 'jhenyfferkellyn@gmail.com', 'Jhenyffer Andrade', '65999990002', v_default_hash, true, 'commerce', v_jhe_user_id::text, NOW(), NOW());
  ELSE
    UPDATE commerce_accounts
    SET ativo = true, nome = 'Jhenyffer Andrade', origem = 'commerce', origem_id = v_jhe_user_id::text, atualizado_em = NOW()
    WHERE id = v_jhe_acc_id;
  END IF;

  -- 6. Garantir vínculos em commerce_account_users
  INSERT INTO commerce_account_users (account_id, empresa_id, usuario_id, criado_em)
  VALUES (v_gui_acc_id, v_empresa_dino_id, v_gui_user_id, NOW())
  ON CONFLICT (account_id, empresa_id) DO UPDATE SET usuario_id = EXCLUDED.usuario_id;

  INSERT INTO commerce_account_users (account_id, empresa_id, usuario_id, criado_em)
  VALUES (v_jhe_acc_id, v_empresa_dino_id, v_jhe_user_id, NOW())
  ON CONFLICT (account_id, empresa_id) DO UPDATE SET usuario_id = EXCLUDED.usuario_id;

  -- 7. Garantir memberships de tenant_owner (empresa inteira) e professional (unidade) para Guilherme
  IF NOT EXISTS (SELECT 1 FROM commerce_memberships WHERE usuario_id = v_gui_user_id AND empresa_id = v_empresa_dino_id AND role_id = v_role_owner_id AND loja_id IS NULL) THEN
    INSERT INTO commerce_memberships (id, usuario_id, empresa_id, loja_id, role_id, ativo, criado_em, atualizado_em)
    VALUES (gen_random_uuid(), v_gui_user_id, v_empresa_dino_id, NULL, v_role_owner_id, true, NOW(), NOW());
  ELSE
    UPDATE commerce_memberships SET ativo = true, atualizado_em = NOW()
    WHERE usuario_id = v_gui_user_id AND empresa_id = v_empresa_dino_id AND role_id = v_role_owner_id AND loja_id IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM commerce_memberships WHERE usuario_id = v_gui_user_id AND empresa_id = v_empresa_dino_id AND role_id = v_role_prof_id AND loja_id = v_loja_dino_id) THEN
    INSERT INTO commerce_memberships (id, usuario_id, empresa_id, loja_id, role_id, ativo, criado_em, atualizado_em)
    VALUES (gen_random_uuid(), v_gui_user_id, v_empresa_dino_id, v_loja_dino_id, v_role_prof_id, true, NOW(), NOW());
  ELSE
    UPDATE commerce_memberships SET ativo = true, atualizado_em = NOW()
    WHERE usuario_id = v_gui_user_id AND empresa_id = v_empresa_dino_id AND role_id = v_role_prof_id AND loja_id = v_loja_dino_id;
  END IF;

  -- 8. Garantir memberships de tenant_owner (empresa inteira) e professional (unidade) para Jhenyffer
  IF NOT EXISTS (SELECT 1 FROM commerce_memberships WHERE usuario_id = v_jhe_user_id AND empresa_id = v_empresa_dino_id AND role_id = v_role_owner_id AND loja_id IS NULL) THEN
    INSERT INTO commerce_memberships (id, usuario_id, empresa_id, loja_id, role_id, ativo, criado_em, atualizado_em)
    VALUES (gen_random_uuid(), v_jhe_user_id, v_empresa_dino_id, NULL, v_role_owner_id, true, NOW(), NOW());
  ELSE
    UPDATE commerce_memberships SET ativo = true, atualizado_em = NOW()
    WHERE usuario_id = v_jhe_user_id AND empresa_id = v_empresa_dino_id AND role_id = v_role_owner_id AND loja_id IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM commerce_memberships WHERE usuario_id = v_jhe_user_id AND empresa_id = v_empresa_dino_id AND role_id = v_role_prof_id AND loja_id = v_loja_dino_id) THEN
    INSERT INTO commerce_memberships (id, usuario_id, empresa_id, loja_id, role_id, ativo, criado_em, atualizado_em)
    VALUES (gen_random_uuid(), v_jhe_user_id, v_empresa_dino_id, v_loja_dino_id, v_role_prof_id, true, NOW(), NOW());
  ELSE
    UPDATE commerce_memberships SET ativo = true, atualizado_em = NOW()
    WHERE usuario_id = v_jhe_user_id AND empresa_id = v_empresa_dino_id AND role_id = v_role_prof_id AND loja_id = v_loja_dino_id;
  END IF;

END $$;
