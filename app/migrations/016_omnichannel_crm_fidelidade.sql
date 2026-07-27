-- ============================================================================
-- KYTTO ERP v4.0 — OMNICHANNEL, CRM E FIDELIDADE
-- Migração 016
--
-- Pedidos unificados por canal, webhooks idempotentes, ações externas em fila,
-- relacionamento com clientes e fidelidade por loja. Esta migração não armazena
-- tokens de provedores em texto claro: as credenciais são referências externas e
-- o segredo de webhook é persistido cifrado pela camada de aplicação.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. CANAIS E CONECTORES DE VENDA
-- -----------------------------------------------------------------------------
-- Identificador aleatório para checkout e acompanhamento públicos, sem expor
-- chaves internas de unidade ou restringir a plataforma a uma loja fixa.
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS codigo_publico UUID;
UPDATE lojas SET codigo_publico = uuid_generate_v4() WHERE codigo_publico IS NULL;
ALTER TABLE lojas ALTER COLUMN codigo_publico SET DEFAULT uuid_generate_v4();
ALTER TABLE lojas ALTER COLUMN codigo_publico SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lojas_codigo_publico ON lojas (codigo_publico);

CREATE TABLE IF NOT EXISTS canais_integracao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  codigo_publico UUID NOT NULL DEFAULT uuid_generate_v4(),
  provedor VARCHAR(30) NOT NULL CHECK (provedor IN (
    'ifood', 'uber_eats', 'whatsapp', 'web', 'app', 'telefone', 'manual', 'outro'
  )),
  nome VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'ativo', 'pausado', 'erro', 'desativado'
  )),
  modo_operacao VARCHAR(20) NOT NULL DEFAULT 'webhook' CHECK (modo_operacao IN (
    'webhook', 'polling', 'manual', 'misto'
  )),
  cabecalho_assinatura VARCHAR(100),
  algoritmo_assinatura VARCHAR(30) NOT NULL DEFAULT 'hmac_sha256' CHECK (
    algoritmo_assinatura IN ('hmac_sha256', 'token_estatico', 'nenhum')
  ),
  segredo_webhook_cifrado TEXT,
  chave_criptografia_id VARCHAR(100),
  credencial_referencia VARCHAR(250),
  api_base_url TEXT,
  configuracao JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultimo_evento_em TIMESTAMPTZ,
  ultima_sincronizacao_em TIMESTAMPTZ,
  ultimo_erro TEXT,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_canais_integracao_codigo_publico UNIQUE (codigo_publico),
  CONSTRAINT uq_canais_integracao_loja_provedor UNIQUE (empresa_id, loja_id, provedor),
  CONSTRAINT chk_canal_assinatura_ativa CHECK (
    status <> 'ativo'
    OR algoritmo_assinatura = 'nenhum'
    OR segredo_webhook_cifrado IS NOT NULL
    OR credencial_referencia IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_canais_integracao_operacao
  ON canais_integracao (empresa_id, loja_id, status, provedor);

-- -----------------------------------------------------------------------------
-- 2. RECEPÇÃO IDÊMPOTENTE E AUDITÁVEL DE EVENTOS EXTERNOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos_integracao_canais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais_integracao(id) ON DELETE CASCADE,
  evento_externo_id VARCHAR(200) NOT NULL,
  tipo_evento VARCHAR(100) NOT NULL,
  assinatura_valida BOOLEAN NOT NULL DEFAULT false,
  hash_corpo CHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_processamento VARCHAR(20) NOT NULL DEFAULT 'recebido' CHECK (status_processamento IN (
    'recebido', 'processado', 'ignorado', 'falha'
  )),
  erro_processamento TEXT,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processado_em TIMESTAMPTZ,
  CONSTRAINT uq_eventos_integracao_idempotencia UNIQUE (canal_id, evento_externo_id)
);
CREATE INDEX IF NOT EXISTS idx_eventos_integracao_processamento
  ON eventos_integracao_canais (empresa_id, loja_id, status_processamento, recebido_em ASC);

-- Eventos de parceiros podem conter somente uma referência do pedido. A fila
-- permite obter os detalhes posteriormente, com retentativa e sem bloquear o
-- endpoint de webhook.
CREATE TABLE IF NOT EXISTS tarefas_integracao_canais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais_integracao(id) ON DELETE CASCADE,
  evento_integracao_id UUID REFERENCES eventos_integracao_canais(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('buscar_pedido', 'reconciliar', 'sincronizar_catalogo')),
  referencia_externa VARCHAR(200),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'processando', 'concluida', 'falha', 'cancelada'
  )),
  tentativas SMALLINT NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  proxima_tentativa_em TIMESTAMPTZ,
  resposta JSONB,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tarefas_integracao_canais_fila
  ON tarefas_integracao_canais (canal_id, status, proxima_tentativa_em, criado_em);

-- -----------------------------------------------------------------------------
-- 3. PEDIDOS OMNICHANNEL E ITENS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_omnichannel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  canal_id UUID REFERENCES canais_integracao(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  numero_interno VARCHAR(50) NOT NULL,
  numero_externo VARCHAR(160),
  codigo_rastreio VARCHAR(160),
  origem VARCHAR(30) NOT NULL CHECK (origem IN (
    'ifood', 'uber_eats', 'whatsapp', 'web', 'app', 'telefone', 'manual', 'outro'
  )),
  status VARCHAR(30) NOT NULL DEFAULT 'novo' CHECK (status IN (
    'novo', 'confirmado', 'em_preparo', 'pronto', 'despachado', 'concluido',
    'cancelado', 'rejeitado', 'falha'
  )),
  status_provedor VARCHAR(100),
  estado_pagamento VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (estado_pagamento IN (
    'pendente', 'autorizado', 'pago', 'recusado', 'estornado', 'na_entrega'
  )),
  tipo_entrega VARCHAR(20) NOT NULL DEFAULT 'retirada' CHECK (tipo_entrega IN (
    'entrega', 'retirada', 'consumo_local'
  )),
  cliente_nome VARCHAR(200),
  cliente_telefone VARCHAR(30),
  endereco_entrega JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  valor_produtos DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (valor_produtos >= 0),
  valor_desconto DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (valor_desconto >= 0),
  taxa_entrega DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0),
  taxa_servico DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (taxa_servico >= 0),
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  previsto_para TIMESTAMPTZ,
  confirmado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  cancelado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo_cancelamento TEXT,
  dados_origem JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pedidos_omnichannel_numero_interno UNIQUE (empresa_id, loja_id, numero_interno),
  CONSTRAINT uq_pedidos_omnichannel_externo UNIQUE (canal_id, numero_externo),
  CONSTRAINT uq_pedidos_omnichannel_venda UNIQUE (venda_id),
  CONSTRAINT chk_pedido_total_conferido CHECK (
    valor_total = (valor_produtos - valor_desconto + taxa_entrega + taxa_servico)
  )
);
CREATE INDEX IF NOT EXISTS idx_pedidos_omnichannel_operacao
  ON pedidos_omnichannel (empresa_id, loja_id, status, recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_omnichannel_cliente
  ON pedidos_omnichannel (empresa_id, cliente_id, recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_omnichannel_canal
  ON pedidos_omnichannel (canal_id, status, recebido_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_omnichannel_codigo_rastreio
  ON pedidos_omnichannel (codigo_rastreio)
  WHERE codigo_rastreio IS NOT NULL;

-- A materialização do pedido em venda baixa o estoque somente uma vez e permite
-- estorno rastreável se o pedido for cancelado antes da conclusão.
ALTER TABLE pedidos_omnichannel ADD COLUMN IF NOT EXISTS estoque_baixado_em TIMESTAMPTZ;
ALTER TABLE pedidos_omnichannel ADD COLUMN IF NOT EXISTS estoque_reposto_em TIMESTAMPTZ;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS pedido_omnichannel_id UUID REFERENCES pedidos_omnichannel(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_pedido_omnichannel
  ON movimentacoes_estoque (pedido_omnichannel_id)
  WHERE pedido_omnichannel_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS itens_pedido_omnichannel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos_omnichannel(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  codigo_externo VARCHAR(160),
  nome VARCHAR(250) NOT NULL,
  quantidade DECIMAL(14,3) NOT NULL CHECK (quantidade > 0),
  valor_unitario DECIMAL(12,2) NOT NULL CHECK (valor_unitario >= 0),
  valor_desconto DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (valor_desconto >= 0),
  valor_total DECIMAL(12,2) NOT NULL CHECK (valor_total >= 0),
  observacoes TEXT,
  dados_origem JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_item_pedido_total CHECK (
    valor_total = ((quantidade * valor_unitario) - valor_desconto)
  )
);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_omnichannel_pedido
  ON itens_pedido_omnichannel (pedido_id);

CREATE TABLE IF NOT EXISTS historico_status_pedido_omnichannel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos_omnichannel(id) ON DELETE CASCADE,
  status_anterior VARCHAR(30),
  status_novo VARCHAR(30) NOT NULL,
  origem VARCHAR(30) NOT NULL CHECK (origem IN ('canal', 'operador', 'sistema', 'cliente')),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  evento_integracao_id UUID REFERENCES eventos_integracao_canais(id) ON DELETE SET NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_historico_pedido_omnichannel
  ON historico_status_pedido_omnichannel (pedido_id, criado_em DESC);

-- Ações que exigem comunicação com provedores são desacopladas do webhook.
CREATE TABLE IF NOT EXISTS acoes_externas_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES pedidos_omnichannel(id) ON DELETE CASCADE,
  canal_id UUID REFERENCES canais_integracao(id) ON DELETE SET NULL,
  acao VARCHAR(30) NOT NULL CHECK (acao IN (
    'aceitar', 'rejeitar', 'iniciar_preparo', 'pronto', 'despachar', 'cancelar', 'sincronizar'
  )),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'processando', 'concluida', 'falha', 'cancelada'
  )),
  tentativas SMALLINT NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  proxima_tentativa_em TIMESTAMPTZ,
  resposta JSONB,
  erro TEXT,
  solicitado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  solicitado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acoes_externas_pedido_fila
  ON acoes_externas_pedido (status, proxima_tentativa_em, solicitado_em);

-- -----------------------------------------------------------------------------
-- 4. CRM OPERACIONAL E CONSENTIMENTOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interacoes_cliente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos_omnichannel(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
    'pedido', 'atendimento', 'telefone', 'whatsapp', 'email', 'nota', 'fidelidade', 'sistema'
  )),
  origem VARCHAR(30) NOT NULL DEFAULT 'interno' CHECK (origem IN (
    'interno', 'ifood', 'uber_eats', 'web', 'app', 'whatsapp', 'telefone', 'outro'
  )),
  assunto VARCHAR(200),
  conteudo TEXT,
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_interacoes_cliente_historico
  ON interacoes_cliente (empresa_id, cliente_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS consentimentos_cliente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  canal VARCHAR(20) NOT NULL CHECK (canal IN ('email', 'sms', 'whatsapp', 'push', 'telefone')),
  finalidade VARCHAR(30) NOT NULL CHECK (finalidade IN ('marketing', 'atendimento', 'fidelidade', 'transacional')),
  concedido BOOLEAN NOT NULL,
  origem VARCHAR(50) NOT NULL DEFAULT 'operador',
  evidencia JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_consentimento_cliente UNIQUE (empresa_id, cliente_id, canal, finalidade)
);
CREATE INDEX IF NOT EXISTS idx_consentimentos_cliente_consulta
  ON consentimentos_cliente (empresa_id, cliente_id, concedido);

-- -----------------------------------------------------------------------------
-- 5. FIDELIDADE POR LOJA, EXTRATO E RESGATES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracoes_fidelidade_loja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  pontos_por_real DECIMAL(10,4) NOT NULL DEFAULT 1 CHECK (pontos_por_real >= 0),
  valor_minimo_compra DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (valor_minimo_compra >= 0),
  pontos_por_real_resgate DECIMAL(10,4) NOT NULL DEFAULT 100 CHECK (pontos_por_real_resgate > 0),
  valor_por_bloco_resgate DECIMAL(12,2) NOT NULL DEFAULT 1 CHECK (valor_por_bloco_resgate > 0),
  percentual_maximo_desconto DECIMAL(5,2) NOT NULL DEFAULT 30 CHECK (
    percentual_maximo_desconto BETWEEN 0 AND 100
  ),
  validade_dias INTEGER CHECK (validade_dias IS NULL OR validade_dias > 0),
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_configuracoes_fidelidade_loja UNIQUE (empresa_id, loja_id)
);

CREATE TABLE IF NOT EXISTS resgates_fidelidade (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  pedido_id UUID REFERENCES pedidos_omnichannel(id) ON DELETE SET NULL,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  extrato_debito_id UUID REFERENCES extrato_pontos(id) ON DELETE SET NULL,
  pontos_resgatados INTEGER NOT NULL CHECK (pontos_resgatados > 0),
  valor_desconto DECIMAL(12,2) NOT NULL CHECK (valor_desconto > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmado' CHECK (status IN (
    'confirmado', 'cancelado', 'estornado'
  )),
  motivo TEXT,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado_em TIMESTAMPTZ,
  CONSTRAINT uq_resgate_fidelidade_venda UNIQUE (venda_id),
  CONSTRAINT uq_resgate_fidelidade_pedido UNIQUE (pedido_id)
);
CREATE INDEX IF NOT EXISTS idx_resgates_fidelidade_cliente
  ON resgates_fidelidade (empresa_id, cliente_id, criado_em DESC);

-- Acrescenta vínculo operacional às entradas de fidelidade já existentes.
ALTER TABLE extrato_pontos ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL;
ALTER TABLE extrato_pontos ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES pedidos_omnichannel(id) ON DELETE SET NULL;
ALTER TABLE extrato_pontos ADD COLUMN IF NOT EXISTS venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL;
ALTER TABLE extrato_pontos ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_extrato_pontos_expiracao
  ON extrato_pontos (empresa_id, cliente_id, expira_em)
  WHERE expira_em IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_extrato_pontos_credito_pedido
  ON extrato_pontos (pedido_id)
  WHERE pedido_id IS NOT NULL AND tipo = 'credito';

-- -----------------------------------------------------------------------------
-- 6. LINKS DE PAGAMENTO DE PEDIDOS REMOTOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS links_pagamento_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES pedidos_omnichannel(id) ON DELETE CASCADE,
  provedor VARCHAR(50) NOT NULL,
  referencia_externa VARCHAR(200),
  url_pagamento TEXT,
  valor DECIMAL(12,2) NOT NULL CHECK (valor >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'pago', 'expirado', 'cancelado', 'falha'
  )),
  expira_em TIMESTAMPTZ,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pago_em TIMESTAMPTZ,
  CONSTRAINT uq_links_pagamento_referencia UNIQUE (provedor, referencia_externa)
);
CREATE INDEX IF NOT EXISTS idx_links_pagamento_pedido
  ON links_pagamento_pedido (pedido_id, status, criado_em DESC);

-- -----------------------------------------------------------------------------
-- 7. ATUALIZAÇÃO, IMUTABILIDADE E RASTREABILIDADE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION kytto_impedir_alteracao_registro_imutavel()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'O registro em % é imutável e não pode ser %', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- Um evento de integração precisa registrar o processamento posterior, mas seus
-- dados de origem jamais podem ser alterados. A função permite somente campos de
-- controle de processamento após a recepção validada.
CREATE OR REPLACE FUNCTION kytto_proteger_evento_integracao()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Eventos de integração não podem ser excluídos';
  END IF;

  IF OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
     OR OLD.loja_id IS DISTINCT FROM NEW.loja_id
     OR OLD.canal_id IS DISTINCT FROM NEW.canal_id
     OR OLD.evento_externo_id IS DISTINCT FROM NEW.evento_externo_id
     OR OLD.tipo_evento IS DISTINCT FROM NEW.tipo_evento
     OR OLD.assinatura_valida IS DISTINCT FROM NEW.assinatura_valida
     OR OLD.hash_corpo IS DISTINCT FROM NEW.hash_corpo
     OR OLD.payload IS DISTINCT FROM NEW.payload
     OR OLD.recebido_em IS DISTINCT FROM NEW.recebido_em THEN
    RAISE EXCEPTION 'Dados de origem de eventos de integração são imutáveis';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tabela TEXT;
  gatilho TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'canais_integracao',
    'pedidos_omnichannel',
    'tarefas_integracao_canais',
    'configuracoes_fidelidade_loja',
    'consentimentos_cliente'
  ]
  LOOP
    gatilho := 'trg_' || tabela || '_atualizacao';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = gatilho) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION atualizar_data_atualizacao()',
        gatilho,
        tabela
      );
    END IF;
  END LOOP;

  FOREACH tabela IN ARRAY ARRAY[
    'historico_status_pedido_omnichannel',
    'interacoes_cliente',
    'extrato_pontos'
  ]
  LOOP
    gatilho := 'trg_' || tabela || '_imutavel';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = gatilho) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION kytto_impedir_alteracao_registro_imutavel()',
        gatilho,
        tabela
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_eventos_integracao_canais_proteger') THEN
    EXECUTE 'CREATE TRIGGER trg_eventos_integracao_canais_proteger
      BEFORE UPDATE OR DELETE ON eventos_integracao_canais
      FOR EACH ROW EXECUTE FUNCTION kytto_proteger_evento_integracao()';
  END IF;
END;
$$;

-- ============================================================================
-- FIM DA MIGRAÇÃO 016
-- ============================================================================
