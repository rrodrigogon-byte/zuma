-- ============================================================================
-- KYTTO ERP v4.0 — FUNDAÇÃO MULTILOJA E AUDITORIA IMUTÁVEL
-- Migração: 003_multiloja_auditoria_imutavel.sql
--
-- Esta migração é incremental e preserva os dados existentes. Cada empresa
-- recebe uma loja MATRIZ e todos os dados legados são vinculados a ela antes
-- de a coluna loja_id se tornar obrigatória nas operações transacionais.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. LOJAS E VÍNCULO USUÁRIO-LOJA
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lojas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(30) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  cnpj VARCHAR(14),
  inscricao_estadual VARCHAR(20),
  inscricao_municipal VARCHAR(20),
  telefone VARCHAR(20),
  email VARCHAR(255),
  endereco_logradouro VARCHAR(255),
  endereco_numero VARCHAR(20),
  endereco_complemento VARCHAR(255),
  endereco_bairro VARCHAR(100),
  endereco_cidade VARCHAR(100),
  endereco_estado VARCHAR(2),
  endereco_cep VARCHAR(8),
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  ativa BOOLEAN NOT NULL DEFAULT true,
  configuracoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_lojas_empresa_codigo UNIQUE (empresa_id, codigo),
  CONSTRAINT chk_lojas_codigo CHECK (codigo ~ '^[A-Za-z0-9_-]+$')
);

CREATE INDEX IF NOT EXISTS idx_lojas_empresa_ativa
  ON lojas (empresa_id, ativa);

CREATE TABLE IF NOT EXISTS usuarios_lojas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  role_loja VARCHAR(50),
  permissoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_usuarios_lojas UNIQUE (usuario_id, loja_id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_lojas_usuario_ativo
  ON usuarios_lojas (usuario_id, ativo);
CREATE INDEX IF NOT EXISTS idx_usuarios_lojas_loja_ativo
  ON usuarios_lojas (loja_id, ativo);

-- Cada empresa existente recebe uma unidade matriz. Essa etapa também torna a
-- migração segura para ambientes que já possuam dados transacionais.
INSERT INTO lojas (
  empresa_id,
  codigo,
  nome,
  nome_fantasia,
  cnpj,
  inscricao_estadual,
  inscricao_municipal,
  telefone,
  email,
  endereco_logradouro,
  endereco_numero,
  endereco_complemento,
  endereco_bairro,
  endereco_cidade,
  endereco_estado,
  endereco_cep
)
SELECT
  e.id,
  'MATRIZ',
  COALESCE(NULLIF(e.nome, ''), 'Matriz'),
  e.nome,
  e.cnpj,
  e.inscricao_estadual,
  e.inscricao_municipal,
  e.telefone,
  e.email,
  e.endereco_logradouro,
  e.endereco_numero,
  e.endereco_complemento,
  e.endereco_bairro,
  e.endereco_cidade,
  e.endereco_estado,
  e.endereco_cep
FROM empresas e
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- Mantém o acesso atual de todos os usuários pela loja MATRIZ. Novas lojas só
-- passam a ser acessíveis após atribuição explícita no vínculo usuarios_lojas.
INSERT INTO usuarios_lojas (usuario_id, loja_id, role_loja, permissoes)
SELECT
  u.id,
  l.id,
  u.role,
  COALESCE(u.permissoes, '{}'::jsonb)
FROM usuarios u
JOIN lojas l
  ON l.empresa_id = u.empresa_id
 AND l.codigo = 'MATRIZ'
ON CONFLICT (usuario_id, loja_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. ESCOPO OPERACIONAL POR LOJA
-- ---------------------------------------------------------------------------

-- As tabelas abaixo representam operações cuja origem ou saldo precisa ser
-- conhecida por unidade. Catálogo e formas de pagamento permanecem corporativos
-- por empresa nesta fase; preço e estoque por loja serão especializadas depois.
DO $$
DECLARE
  tabela TEXT;
  tabelas TEXT[] := ARRAY[
    'estoque',
    'movimentacoes_estoque',
    'inventarios',
    'compras',
    'vendas',
    'comandas',
    'pagamentos',
    'nfce_emitidas',
    'buffer_contingencia',
    'caixas',
    'servicos',
    'agendamentos',
    'relatorios_vendas'
  ];
BEGIN
  FOREACH tabela IN ARRAY tabelas LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id) ON DELETE RESTRICT',
      tabela
    );

    EXECUTE format(
      'UPDATE %1$I AS t
       SET loja_id = l.id
       FROM lojas AS l
       WHERE l.empresa_id = t.empresa_id
         AND l.codigo = ''MATRIZ''
         AND t.loja_id IS NULL',
      tabela
    );

    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN loja_id SET NOT NULL',
      tabela
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (empresa_id, loja_id)',
      'idx_' || tabela || '_empresa_loja',
      tabela
    );
  END LOOP;
END;
$$;

-- Auditoria histórica pode conter ações corporativas sem loja específica. Ela
-- recebe a MATRIZ como referência de compatibilidade, mas permanece anulável
-- para permitir eventos corporativos futuros.
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL;

UPDATE auditoria AS a
SET loja_id = l.id
FROM lojas AS l
WHERE l.empresa_id = a.empresa_id
  AND l.codigo = 'MATRIZ'
  AND a.loja_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_auditoria_empresa_loja_data
  ON auditoria (empresa_id, loja_id, data_operacao DESC);

-- A auditoria existente registra eventos de autenticação no código de aplicação.
-- A restrição original não os aceitava; esta revisão mantém os tipos operacionais
-- e agrega eventos de acesso, integração e sincronização.
ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS chk_operacao;
ALTER TABLE auditoria
  ADD CONSTRAINT chk_operacao
  CHECK (operacao IN (
    'INSERT', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT',
    'LOGIN', 'LOGOUT', 'ACCESS', 'SYNC', 'STATUS', 'CANCEL'
  ));

-- Comandas passam a ter referência explícita à venda de origem, sem reutilizar
-- chaves primárias entre entidades distintas.
ALTER TABLE comandas ADD COLUMN IF NOT EXISTS venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_comandas_venda ON comandas(venda_id) WHERE venda_id IS NOT NULL;

-- Venda e saldo de estoque precisam permitir o mesmo código/sku em lojas
-- distintas. As chaves corporativas permanecem preservadas nas demais tabelas.
ALTER TABLE estoque DROP CONSTRAINT IF EXISTS estoque_empresa_id_produto_id_lote_validade_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_empresa_loja_produto_lote_validade
  ON estoque (
    empresa_id,
    loja_id,
    produto_id,
    COALESCE(lote, ''),
    COALESCE(validade, DATE '0001-01-01')
  );

ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_empresa_id_numero_venda_key;
ALTER TABLE vendas
  ADD CONSTRAINT uq_vendas_empresa_loja_numero
  UNIQUE (empresa_id, loja_id, numero_venda);

ALTER TABLE comandas DROP CONSTRAINT IF EXISTS comandas_empresa_id_numero_comanda_key;
ALTER TABLE comandas
  ADD CONSTRAINT uq_comandas_empresa_loja_numero
  UNIQUE (empresa_id, loja_id, numero_comanda);

ALTER TABLE caixas DROP CONSTRAINT IF EXISTS caixas_empresa_id_numero_caixa_data_abertura_key;
ALTER TABLE caixas
  ADD CONSTRAINT uq_caixas_empresa_loja_numero_abertura
  UNIQUE (empresa_id, loja_id, numero_caixa, data_abertura);
CREATE UNIQUE INDEX IF NOT EXISTS uq_caixas_abertos_por_loja_terminal
  ON caixas (empresa_id, loja_id, numero_caixa)
  WHERE status = 'aberto';

ALTER TABLE relatorios_vendas DROP CONSTRAINT IF EXISTS relatorios_vendas_empresa_id_data_relatorio_key;
ALTER TABLE relatorios_vendas
  ADD CONSTRAINT uq_relatorios_vendas_empresa_loja_data
  UNIQUE (empresa_id, loja_id, data_relatorio);

-- ---------------------------------------------------------------------------
-- 3. AUDITORIA ENCADEADA E APPEND-ONLY
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auditoria_imutavel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  sequencia BIGINT NOT NULL,
  entidade VARCHAR(128) NOT NULL,
  tipo_operacao VARCHAR(32) NOT NULL,
  registro_id VARCHAR(255) NOT NULL,
  origem VARCHAR(50) NOT NULL DEFAULT 'database',
  payload JSONB NOT NULL,
  hash_payload TEXT NOT NULL,
  hash_anterior TEXT NOT NULL,
  hash_evento TEXT NOT NULL,
  data_operacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_auditoria_imutavel_empresa_sequencia UNIQUE (empresa_id, sequencia),
  CONSTRAINT chk_auditoria_hash_payload CHECK (hash_payload ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_auditoria_hash_anterior CHECK (hash_anterior ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_auditoria_hash_evento CHECK (hash_evento ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_auditoria_imutavel_empresa_data
  ON auditoria_imutavel (empresa_id, data_operacao DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_imutavel_loja_data
  ON auditoria_imutavel (loja_id, data_operacao DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_imutavel_entidade_registro
  ON auditoria_imutavel (entidade, registro_id);

-- Impede que registros históricos sejam modificados ou removidos pelos fluxos
-- normais da aplicação. O banco somente permite a inserção encadeada.
CREATE OR REPLACE FUNCTION bloquear_mutacao_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria são append-only e não podem ser alterados ou excluídos.'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bloquear_update_delete_auditoria_imutavel ON auditoria_imutavel;
CREATE TRIGGER trg_bloquear_update_delete_auditoria_imutavel
  BEFORE UPDATE OR DELETE ON auditoria_imutavel
  FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_auditoria();

DROP TRIGGER IF EXISTS trg_bloquear_update_delete_auditoria ON auditoria;
CREATE TRIGGER trg_bloquear_update_delete_auditoria
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_auditoria();

-- O gatilho legado é reescrito para tratar INSERT, UPDATE e DELETE de forma
-- segura e também inferir empresa/loja de tabelas vinculadas quando necessário.
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  dados_anterior JSONB;
  dados_novo JSONB;
  dados_referencia JSONB;
  empresa UUID;
  loja UUID;
  registro TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    dados_anterior := to_jsonb(OLD);
    dados_referencia := dados_anterior;
  ELSE
    dados_novo := to_jsonb(NEW);
    dados_referencia := dados_novo;
  END IF;

  empresa := NULLIF(dados_referencia ->> 'empresa_id', '')::UUID;
  loja := NULLIF(dados_referencia ->> 'loja_id', '')::UUID;
  registro := COALESCE(dados_referencia ->> 'id', 'sem-id');

  IF empresa IS NULL AND loja IS NOT NULL THEN
    SELECT l.empresa_id INTO empresa FROM lojas l WHERE l.id = loja;
  END IF;

  IF empresa IS NULL AND dados_referencia ? 'caixa_id' THEN
    SELECT c.empresa_id, c.loja_id INTO empresa, loja
    FROM caixas c
    WHERE c.id = NULLIF(dados_referencia ->> 'caixa_id', '')::UUID;
  END IF;

  IF empresa IS NULL THEN
    RAISE EXCEPTION 'Não foi possível determinar empresa para auditoria de %', TG_TABLE_NAME;
  END IF;

  INSERT INTO auditoria (
    empresa_id,
    loja_id,
    tabela,
    operacao,
    registro_id,
    dados_anterior,
    dados_novo
  ) VALUES (
    empresa,
    loja,
    TG_TABLE_NAME,
    TG_OP,
    registro,
    dados_anterior,
    dados_novo
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cada inserção na auditoria operacional origina um evento encadeado. O lock na
-- linha da empresa serializa a sequência e impede bifurcação concorrente da hash chain.
CREATE OR REPLACE FUNCTION encadear_auditoria_imutavel()
RETURNS TRIGGER AS $$
DECLARE
  ultima_sequencia BIGINT;
  ultimo_hash TEXT;
  proxima_sequencia BIGINT;
  hash_anterior_evento TEXT;
  novo_payload JSONB;
  novo_hash_payload TEXT;
  novo_hash_evento TEXT;
BEGIN
  PERFORM 1 FROM empresas WHERE id = NEW.empresa_id FOR UPDATE;

  SELECT sequencia, hash_evento
    INTO ultima_sequencia, ultimo_hash
  FROM auditoria_imutavel
  WHERE empresa_id = NEW.empresa_id
  ORDER BY sequencia DESC
  LIMIT 1;

  proxima_sequencia := COALESCE(ultima_sequencia, 0) + 1;
  hash_anterior_evento := COALESCE(ultimo_hash, repeat('0', 64));

  novo_payload := jsonb_build_object(
    'entidade', NEW.tabela,
    'tipo_operacao', NEW.operacao,
    'registro_id', NEW.registro_id,
    'empresa_id', NEW.empresa_id,
    'loja_id', NEW.loja_id,
    'usuario_id', NEW.usuario_id,
    'ip_address', NEW.ip_address,
    'user_agent', NEW.user_agent,
    'data_operacao', NEW.data_operacao,
    'dados_anterior', NEW.dados_anterior,
    'dados_novo', NEW.dados_novo
  );

  novo_hash_payload := encode(digest(novo_payload::TEXT, 'sha256'), 'hex');
  novo_hash_evento := encode(
    digest(
      NEW.empresa_id::TEXT || '|' ||
      proxima_sequencia::TEXT || '|' ||
      hash_anterior_evento || '|' ||
      novo_hash_payload,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO auditoria_imutavel (
    empresa_id,
    loja_id,
    usuario_id,
    sequencia,
    entidade,
    tipo_operacao,
    registro_id,
    origem,
    payload,
    hash_payload,
    hash_anterior,
    hash_evento,
    data_operacao
  ) VALUES (
    NEW.empresa_id,
    NEW.loja_id,
    NEW.usuario_id,
    proxima_sequencia,
    NEW.tabela,
    NEW.operacao,
    NEW.registro_id,
    'auditoria_operacional',
    novo_payload,
    novo_hash_payload,
    hash_anterior_evento,
    novo_hash_evento,
    NEW.data_operacao
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_encadear_auditoria_imutavel ON auditoria;
CREATE TRIGGER trg_encadear_auditoria_imutavel
  AFTER INSERT ON auditoria
  FOR EACH ROW EXECUTE FUNCTION encadear_auditoria_imutavel();

-- Aderência da auditoria aos dados corporativos que fazem parte da operação.
DO $$
DECLARE
  tabela TEXT;
  tabelas TEXT[] := ARRAY[
    'usuarios',
    'lojas',
    'usuarios_lojas',
    'produtos',
    'estoque',
    'movimentacoes_estoque',
    'compras',
    'vendas',
    'pagamentos',
    'nfce_emitidas',
    'caixas',
    'movimentacoes_caixa',
    'fechamentos_caixa'
  ];
BEGIN
  FOREACH tabela IN ARRAY tabelas LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_audit_' || tabela, tabela);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH ROW EXECUTE FUNCTION audit_trigger()',
      'trg_audit_' || tabela,
      tabela
    );
  END LOOP;
END;
$$;

-- Evita a coexistência dos nomes de trigger usados pela migração 001 para as
-- mesmas tabelas; a função acima passa a ser a única fonte de eventos legados.
DROP TRIGGER IF EXISTS audit_usuarios ON usuarios;
DROP TRIGGER IF EXISTS audit_vendas ON vendas;
DROP TRIGGER IF EXISTS audit_pagamentos ON pagamentos;
DROP TRIGGER IF EXISTS audit_nfce ON nfce_emitidas;

-- Verificação independente da cadeia: uma única linha inválida evidencia a
-- posição e o motivo da ruptura. Um retorno sem linhas inválidas representa
-- cadeia íntegra para a empresa solicitada.
CREATE OR REPLACE FUNCTION verificar_cadeia_auditoria(p_empresa_id UUID)
RETURNS TABLE (
  sequencia BIGINT,
  valida BOOLEAN,
  motivo TEXT
) AS $$
DECLARE
  evento RECORD;
  hash_anterior_esperado TEXT := repeat('0', 64);
  hash_payload_calculado TEXT;
  hash_evento_calculado TEXT;
BEGIN
  FOR evento IN
    SELECT *
    FROM auditoria_imutavel
    WHERE empresa_id = p_empresa_id
    ORDER BY sequencia
  LOOP
    hash_payload_calculado := encode(digest(evento.payload::TEXT, 'sha256'), 'hex');
    hash_evento_calculado := encode(
      digest(
        evento.empresa_id::TEXT || '|' ||
        evento.sequencia::TEXT || '|' ||
        hash_anterior_esperado || '|' ||
        hash_payload_calculado,
        'sha256'
      ),
      'hex'
    );

    IF evento.hash_anterior <> hash_anterior_esperado THEN
      sequencia := evento.sequencia;
      valida := false;
      motivo := 'Hash anterior não corresponde ao evento precedente';
      RETURN NEXT;
      RETURN;
    END IF;

    IF evento.hash_payload <> hash_payload_calculado THEN
      sequencia := evento.sequencia;
      valida := false;
      motivo := 'Payload do evento foi alterado';
      RETURN NEXT;
      RETURN;
    END IF;

    IF evento.hash_evento <> hash_evento_calculado THEN
      sequencia := evento.sequencia;
      valida := false;
      motivo := 'Hash do evento não corresponde ao conteúdo encadeado';
      RETURN NEXT;
      RETURN;
    END IF;

    hash_anterior_esperado := evento.hash_evento;
  END LOOP;

  sequencia := NULL;
  valida := true;
  motivo := 'Cadeia íntegra';
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FIM DA MIGRAÇÃO 003
-- ============================================================================
