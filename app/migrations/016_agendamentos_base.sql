/*
 * ============================================================================
 * MIGRAÇÃO 016: TABELA BASE DE AGENDAMENTOS
 * ============================================================================
 * Tabela base necessária para as migrações de Barbearia (017) e Supermercado (018)
 * ============================================================================
 */

-- ============================================================================
-- TABELA DE AGENDAMENTOS (BASE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE CASCADE,
  cliente_id UUID,
  usuario_profissional_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_agendamento VARCHAR(50) NOT NULL, -- 'barbearia', 'consulta', 'outro'
  data_agendamento TIMESTAMP NOT NULL,
  duracao_minutos INTEGER DEFAULT 30,
  status VARCHAR(30) DEFAULT 'agendado', -- 'agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu'
  valor NUMERIC(12,2),
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_agendamentos_status CHECK (status IN ('agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu'))
);

CREATE INDEX idx_agendamentos_empresa ON agendamentos(empresa_id);
CREATE INDEX idx_agendamentos_loja ON agendamentos(loja_id);
CREATE INDEX idx_agendamentos_profissional ON agendamentos(usuario_profissional_id);
CREATE INDEX idx_agendamentos_data ON agendamentos(empresa_id, data_agendamento);
CREATE INDEX idx_agendamentos_status ON agendamentos(empresa_id, status);

-- ============================================================================
-- TRIGGER DE AUDITORIA PARA AGENDAMENTOS
-- ============================================================================

CREATE TRIGGER audit_agendamentos_insert AFTER INSERT ON agendamentos
FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER audit_agendamentos_update AFTER UPDATE ON agendamentos
FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER audit_agendamentos_delete AFTER DELETE ON agendamentos
FOR EACH ROW EXECUTE FUNCTION audit_log();
