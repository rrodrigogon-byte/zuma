/**
 * ============================================================================
 * MIGRAÇÃO 017: EVOLUÇÃO DE BARBEARIA
 * ============================================================================
 * Novas tabelas para agenda inteligente, fila eletrônica, histórico de
 * clientes, avaliações e notificações — mantendo isolamento por empresa_id.
 *
 * Tabelas criadas:
 * - clientes_barbearia: Cadastro de clientes com histórico e preferências
 * - agendamentos_bloqueios: Bloqueios de horários (recesso, manutenção)
 * - fila_atendimento: Fila eletrônica em tempo real
 * - avaliacoes_servico: NPS e avaliação pós-atendimento
 * - notificacoes_barbearia: Lembrete, confirmação, cancelamento
 * ============================================================================
 */

-- ============================================================================
-- 1. CLIENTES DE BARBEARIA (HISTÓRICO E PREFERÊNCIAS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clientes_barbearia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  cpf VARCHAR(11),
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(200),
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultima_visita TIMESTAMP,
  total_visitas INTEGER DEFAULT 0,
  total_gasto NUMERIC(12,2) DEFAULT 0.00,
  historico_servicos JSONB DEFAULT '[]', -- [{servico_id, data, valor, profissional_id}, ...]
  preferencias JSONB DEFAULT '{}', -- {profissional_preferido_id, horario_preferido, observacoes}
  ativo BOOLEAN DEFAULT TRUE,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, cpf),
  UNIQUE(empresa_id, telefone),
  CONSTRAINT chk_clientes_barbearia_telefone CHECK (telefone ~ '^\+?[0-9\-\(\)\s]+$')
);

CREATE INDEX idx_clientes_barbearia_empresa ON clientes_barbearia(empresa_id);
CREATE INDEX idx_clientes_barbearia_telefone ON clientes_barbearia(empresa_id, telefone);
CREATE INDEX idx_clientes_barbearia_cpf ON clientes_barbearia(empresa_id, cpf);

-- ============================================================================
-- 2. BLOQUEIOS DE AGENDA (RECESSO, MANUTENÇÃO, FÉRIAS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agendamentos_bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_profissional_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data_inicio TIMESTAMP NOT NULL,
  data_fim TIMESTAMP NOT NULL,
  motivo VARCHAR(100) NOT NULL, -- 'férias', 'manutenção', 'doença', 'recesso', 'outro'
  descricao TEXT,
  recorrente BOOLEAN DEFAULT FALSE, -- Repetir anualmente?
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT chk_bloqueios_datas CHECK (data_fim > data_inicio),
  CONSTRAINT chk_bloqueios_motivo CHECK (motivo IN ('férias', 'manutenção', 'doença', 'recesso', 'outro'))
);

CREATE INDEX idx_bloqueios_empresa_profissional ON agendamentos_bloqueios(empresa_id, usuario_profissional_id);
CREATE INDEX idx_bloqueios_data_range ON agendamentos_bloqueios(empresa_id, data_inicio, data_fim);

-- ============================================================================
-- 3. FILA DE ATENDIMENTO (ELETRÔNICA EM TEMPO REAL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS fila_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  posicao INTEGER NOT NULL,
  status VARCHAR(30) DEFAULT 'aguardando', -- 'aguardando', 'chamado', 'atendendo', 'concluido', 'nao_compareceu'
  chegou_em TIMESTAMP,
  chamado_em TIMESTAMP,
  atendido_em TIMESTAMP,
  concluido_em TIMESTAMP,
  tempo_espera_minutos INTEGER, -- Calculado: chamado_em - chegou_em
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_fila_status CHECK (status IN ('aguardando', 'chamado', 'atendendo', 'concluido', 'nao_compareceu'))
);

CREATE INDEX idx_fila_empresa_status ON fila_atendimento(empresa_id, status);
CREATE INDEX idx_fila_agendamento ON fila_atendimento(empresa_id, agendamento_id);
CREATE INDEX idx_fila_posicao ON fila_atendimento(empresa_id, posicao);

-- ============================================================================
-- 4. AVALIAÇÕES DE SERVIÇO (NPS E SATISFAÇÃO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS avaliacoes_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  cliente_barbearia_id UUID REFERENCES clientes_barbearia(id) ON DELETE SET NULL,
  nota_geral INTEGER NOT NULL CHECK (nota_geral BETWEEN 1 AND 5),
  nota_atendimento INTEGER CHECK (nota_atendimento BETWEEN 1 AND 5),
  nota_pontualidade INTEGER CHECK (nota_pontualidade BETWEEN 1 AND 5),
  nota_limpeza INTEGER CHECK (nota_limpeza BETWEEN 1 AND 5),
  comentario TEXT,
  recomendaria BOOLEAN, -- NPS: recomendaria para amigo?
  data_avaliacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  respondido_por_admin BOOLEAN DEFAULT FALSE,
  resposta_admin TEXT,
  data_resposta_admin TIMESTAMP
);

CREATE INDEX idx_avaliacoes_empresa ON avaliacoes_servico(empresa_id);
CREATE INDEX idx_avaliacoes_agendamento ON avaliacoes_servico(empresa_id, agendamento_id);
CREATE INDEX idx_avaliacoes_cliente ON avaliacoes_servico(empresa_id, cliente_barbearia_id);

-- ============================================================================
-- 5. NOTIFICAÇÕES DE BARBEARIA (SMS, WHATSAPP, EMAIL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notificacoes_barbearia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  cliente_barbearia_id UUID REFERENCES clientes_barbearia(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL, -- 'confirmacao', 'lembrete', 'cancelamento', 'atraso', 'conclusao'
  canal VARCHAR(20) NOT NULL, -- 'sms', 'whatsapp', 'email', 'push'
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'enviado', 'falha', 'lido'
  conteudo TEXT NOT NULL,
  destinatario VARCHAR(200) NOT NULL, -- telefone, email ou push_token
  tentativas INTEGER DEFAULT 0,
  proxima_tentativa TIMESTAMP,
  enviado_em TIMESTAMP,
  lido_em TIMESTAMP,
  erro_mensagem TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_notif_tipo CHECK (tipo IN ('confirmacao', 'lembrete', 'cancelamento', 'atraso', 'conclusao')),
  CONSTRAINT chk_notif_canal CHECK (canal IN ('sms', 'whatsapp', 'email', 'push')),
  CONSTRAINT chk_notif_status CHECK (status IN ('pendente', 'enviado', 'falha', 'lido'))
);

CREATE INDEX idx_notificacoes_empresa_status ON notificacoes_barbearia(empresa_id, status);
CREATE INDEX idx_notificacoes_agendamento ON notificacoes_barbearia(empresa_id, agendamento_id);
CREATE INDEX idx_notificacoes_cliente ON notificacoes_barbearia(empresa_id, cliente_barbearia_id);
CREATE INDEX idx_notificacoes_proxima_tentativa ON notificacoes_barbearia(empresa_id, proxima_tentativa) WHERE status = 'pendente';

-- ============================================================================
-- 6. ADICIONAR COLUNA DE RELACIONAMENTO NA TABELA AGENDAMENTOS (OPCIONAL)
-- ============================================================================

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_barbearia_id UUID REFERENCES clientes_barbearia(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente_barbearia ON agendamentos(empresa_id, cliente_barbearia_id);

-- ============================================================================
-- 7. TRIGGERS DE AUDITORIA (COMPATÍVEL COM SISTEMA EXISTENTE)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_auditoria_barbearia()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria (
    empresa_id, loja_id, usuario_id, tabela, operacao,
    registro_id, dados_anterior, dados_novo, ip_address, user_agent
  ) VALUES (
    NEW.empresa_id,
    NULL, -- Barbearia não usa loja_id, apenas empresa_id
    CURRENT_USER::uuid,
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    row_to_json(NEW),
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de auditoria
DROP TRIGGER IF EXISTS trg_audit_clientes_barbearia ON clientes_barbearia;
CREATE TRIGGER trg_audit_clientes_barbearia
AFTER INSERT OR UPDATE ON clientes_barbearia
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_barbearia();

DROP TRIGGER IF EXISTS trg_audit_agendamentos_bloqueios ON agendamentos_bloqueios;
CREATE TRIGGER trg_audit_agendamentos_bloqueios
AFTER INSERT OR UPDATE ON agendamentos_bloqueios
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_barbearia();

DROP TRIGGER IF EXISTS trg_audit_fila_atendimento ON fila_atendimento;
CREATE TRIGGER trg_audit_fila_atendimento
AFTER INSERT OR UPDATE ON fila_atendimento
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_barbearia();

DROP TRIGGER IF EXISTS trg_audit_avaliacoes_servico ON avaliacoes_servico;
CREATE TRIGGER trg_audit_avaliacoes_servico
AFTER INSERT OR UPDATE ON avaliacoes_servico
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_barbearia();

DROP TRIGGER IF EXISTS trg_audit_notificacoes_barbearia ON notificacoes_barbearia;
CREATE TRIGGER trg_audit_notificacoes_barbearia
AFTER INSERT OR UPDATE ON notificacoes_barbearia
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_barbearia();

-- ============================================================================
-- 8. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE clientes_barbearia IS 'Cadastro de clientes com histórico de serviços, preferências e total gasto';
COMMENT ON TABLE agendamentos_bloqueios IS 'Bloqueios de agenda: férias, manutenção, doença, recesso';
COMMENT ON TABLE fila_atendimento IS 'Fila eletrônica em tempo real com rastreamento de tempos';
COMMENT ON TABLE avaliacoes_servico IS 'Avaliações pós-atendimento com NPS e comentários';
COMMENT ON TABLE notificacoes_barbearia IS 'Notificações automáticas: SMS, WhatsApp, email, push';

COMMENT ON COLUMN clientes_barbearia.historico_servicos IS 'Array JSONB com histórico de serviços: [{servico_id, data, valor, profissional_id}, ...]';
COMMENT ON COLUMN clientes_barbearia.preferencias IS 'JSONB com preferências: {profissional_preferido_id, horario_preferido, observacoes}';
COMMENT ON COLUMN avaliacoes_servico.recomendaria IS 'NPS: cliente recomendaria para amigo?';
COMMENT ON COLUMN notificacoes_barbearia.destinatario IS 'Telefone, email ou push_token conforme o canal';
