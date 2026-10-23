-- 095 — PDV offline por empresa e unidade (onda 5).
-- Terminais com credencial própria (só o hash do token fica no banco), periféricos, lotes e
-- eventos sincronizados (idempotentes por terminal) e conflitos para a gerência decidir.
-- A venda feita sem internet vira comanda paga do bar: Financeiro, estoque e fiscal seguem o
-- caminho normal.

-- Esta migração mexe em bar_comandas (coluna nova e chaves estrangeiras), que o bar usa o dia
-- todo: se o lock não sair em 3 s, a migração falha e o deploy para, sem enfileirar as vendas
-- atrás dela. Rodar de novo fora do horário de movimento.
SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS pdv_terminais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  codigo VARCHAR(60) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  identificador_dispositivo VARCHAR(160),
  token_hash CHAR(64) NOT NULL,
  modo_offline_habilitado BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  versao_agente VARCHAR(40),
  ultimo_heartbeat_em TIMESTAMPTZ,
  ultima_sincronizacao_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT uq_pdv_terminal_codigo UNIQUE (empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS pdv_dispositivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  terminal_id UUID,
  tipo VARCHAR(30) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  fabricante VARCHAR(80),
  modelo VARCHAR(80),
  endereco_conexao VARCHAR(160),
  configuracoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_status VARCHAR(20) NOT NULL DEFAULT 'desconhecido',
  ultimo_status_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT fk_pdv_disp_terminal FOREIGN KEY (empresa_id, terminal_id) REFERENCES pdv_terminais (empresa_id, id),
  CONSTRAINT chk_pdv_disp_tipo CHECK (tipo IN ('impressora_termica', 'leitor_codigo_barras', 'balanca', 'gaveta', 'pinpad', 'display_cliente', 'outro')),
  CONSTRAINT chk_pdv_disp_status CHECK (ultimo_status IN ('online', 'offline', 'erro', 'desconhecido'))
);

CREATE TABLE IF NOT EXISTS pdv_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  terminal_id UUID NOT NULL,
  lote_cliente_id UUID NOT NULL,
  versao_cliente VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'processando',
  total_eventos INTEGER NOT NULL DEFAULT 0,
  eventos_processados INTEGER NOT NULL DEFAULT 0,
  eventos_com_conflito INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processado_em TIMESTAMPTZ,
  UNIQUE (empresa_id, id),
  CONSTRAINT uq_pdv_lote UNIQUE (terminal_id, lote_cliente_id),
  CONSTRAINT fk_pdv_lote_terminal FOREIGN KEY (empresa_id, terminal_id) REFERENCES pdv_terminais (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_pdv_lote_status CHECK (status IN ('processando', 'processado', 'parcial', 'falha'))
);

CREATE TABLE IF NOT EXISTS pdv_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  terminal_id UUID NOT NULL,
  lote_id UUID,
  evento_cliente_id UUID NOT NULL,
  sequencia BIGINT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  resultado JSONB,
  comanda_id UUID,
  id_externo UUID,
  criado_no_cliente_em TIMESTAMPTZ,
  processado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT uq_pdv_evento UNIQUE (terminal_id, evento_cliente_id),
  CONSTRAINT fk_pdv_evento_terminal FOREIGN KEY (empresa_id, terminal_id) REFERENCES pdv_terminais (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_pdv_evento_status CHECK (status IN ('pendente', 'processado', 'conflito', 'falha', 'descartado'))
);
-- a mesma venda (id externo) só entra uma vez por terminal, mesmo vinda em outro evento
CREATE UNIQUE INDEX IF NOT EXISTS uq_pdv_venda_externa ON pdv_eventos (terminal_id, id_externo) WHERE id_externo IS NOT NULL AND status = 'processado';

CREATE TABLE IF NOT EXISTS pdv_conflitos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  terminal_id UUID NOT NULL,
  evento_id UUID NOT NULL,
  tipo_conflito VARCHAR(40) NOT NULL,
  bloqueante BOOLEAN NOT NULL DEFAULT false,
  dados_cliente JSONB NOT NULL DEFAULT '{}'::jsonb,
  dados_servidor JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  resolucao VARCHAR(20),
  resolvido_por VARCHAR(180),
  resolvido_em TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT fk_pdv_conf_evento FOREIGN KEY (empresa_id, evento_id) REFERENCES pdv_eventos (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_pdv_conf_status CHECK (status IN ('pendente', 'resolvido')),
  CONSTRAINT chk_pdv_conf_resolucao CHECK (resolucao IS NULL OR resolucao IN ('aceito_cliente', 'aceito_servidor', 'descartado'))
);
CREATE INDEX IF NOT EXISTS idx_pdv_conf_pendente ON pdv_conflitos (empresa_id, status, data_criacao DESC);

-- Desconto em reais da comanda (venda do PDV offline): os itens guardam o preço cobrado por
-- unidade e o desconto fica aqui, para a soma dos itens bater com o total e a nota fechar.
ALTER TABLE bar_comandas ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(12,2) NOT NULL DEFAULT 0;
