-- Migration 129: Exclusividade de Acesso para rrodrigogon@gmail.com
-- Desativa todos os outros usuários e assegura rrodrigogon@gmail.com como administrador principal com a senha solicitada (#080581verdao)

DO $$
DECLARE
  v_hash text := '$2a$10$rrlty1ZSku/ISq/2wI7qBuYhZMWL.PspcgaiMa39NwXcHCYvrRkGS';
  v_email text := 'rrodrigogon@gmail.com';
  v_account_id uuid;
  v_empresa RECORD;
BEGIN
  -- 1. Desativar todos os demais usuários na tabela usuarios
  UPDATE usuarios 
  SET ativo = false, data_atualizacao = NOW()
  WHERE lower(btrim(email)) <> v_email;

  -- 2. Atualizar todos os registros existentes de rrodrigogon@gmail.com
  UPDATE usuarios
  SET 
    ativo = true,
    role = 'admin',
    senha_hash = v_hash,
    nome_completo = 'Rodrigo Gonçalves',
    data_atualizacao = NOW()
  WHERE lower(btrim(email)) = v_email;

  -- 3. Garantir que rrodrigogon@gmail.com existe em todas as empresas ativas
  FOR v_empresa IN SELECT id FROM empresas WHERE ativa = true OR ativa IS NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE empresa_id = v_empresa.id AND lower(btrim(email)) = v_email) THEN
      INSERT INTO usuarios (id, empresa_id, email, senha_hash, nome_completo, role, ativo, data_criacao, data_atualizacao)
      VALUES (gen_random_uuid(), v_empresa.id, v_email, v_hash, 'Rodrigo Gonçalves', 'admin', true, NOW(), NOW());
    END IF;
  END LOOP;

  -- 4. Em commerce_accounts (se a tabela existir): desativar todas as outras contas
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commerce_accounts') THEN
    UPDATE commerce_accounts 
    SET ativo = false, atualizado_em = NOW()
    WHERE lower(btrim(email)) <> v_email;

    -- Garantir rrodrigogon@gmail.com ativa com a senha solicitada
    IF EXISTS (SELECT 1 FROM commerce_accounts WHERE lower(btrim(email)) = v_email) THEN
      UPDATE commerce_accounts 
      SET 
        ativo = true, 
        senha_hash = v_hash,
        nome = 'Rodrigo Gonçalves',
        origem = 'legacy',
        atualizado_em = NOW()
      WHERE lower(btrim(email)) = v_email;
    ELSE
      INSERT INTO commerce_accounts (id, email, senha_hash, nome, ativo, origem, criado_em, atualizado_em)
      VALUES (gen_random_uuid(), v_email, v_hash, 'Rodrigo Gonçalves', true, 'legacy', NOW(), NOW());
    END IF;
  END IF;

  -- 5. Em commerce_account_users (se a tabela existir): vincular a conta rrodrigogon aos usuários
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commerce_account_users') THEN
    SELECT id INTO v_account_id FROM commerce_accounts WHERE lower(btrim(email)) = v_email LIMIT 1;
    IF v_account_id IS NOT NULL THEN
      FOR v_empresa IN SELECT id, empresa_id FROM usuarios WHERE lower(btrim(email)) = v_email LOOP
        IF NOT EXISTS (SELECT 1 FROM commerce_account_users WHERE account_id = v_account_id AND empresa_id = v_empresa.empresa_id) THEN
          INSERT INTO commerce_account_users (account_id, empresa_id, usuario_id, criado_em)
          VALUES (v_account_id, v_empresa.empresa_id, v_empresa.id, NOW());
        ELSE
          UPDATE commerce_account_users
          SET usuario_id = v_empresa.id
          WHERE account_id = v_account_id AND empresa_id = v_empresa.empresa_id;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- 6. Em commerce_memberships: garantir role de administrador
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commerce_memberships') THEN
    FOR v_empresa IN SELECT id, empresa_id FROM usuarios WHERE lower(btrim(email)) = v_email LOOP
      IF NOT EXISTS (SELECT 1 FROM commerce_memberships WHERE empresa_id = v_empresa.empresa_id AND usuario_id = v_empresa.id) THEN
        INSERT INTO commerce_memberships (id, usuario_id, empresa_id, role_id, ativo, mfa_obrigatorio, criado_em, atualizado_em)
        VALUES (gen_random_uuid(), v_empresa.id, v_empresa.empresa_id, 'b125e523-957d-4d12-a881-56b958ecec45', true, false, NOW(), NOW());
      ELSE
        UPDATE commerce_memberships 
        SET ativo = true, role_id = 'b125e523-957d-4d12-a881-56b958ecec45', atualizado_em = NOW()
        WHERE empresa_id = v_empresa.empresa_id AND usuario_id = v_empresa.id;
      END IF;
    END LOOP;
  END IF;

END $$;
