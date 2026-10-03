-- 061 · Histórico de interações do CRM garantido no schema do Commerce.
--
-- A captação de leads do atendente WhatsApp (core/whatsapp-ai-crm.js) e o
-- Customer 360 gravam/lêem `interacoes_cliente`, criada originalmente pela 016
-- (pacote legado, fora da lista que o deploy aplica). Em banco novo ela não
-- existia: a captação falhava calada ("relation interacoes_cliente does not exist").
-- Mesma definição da 016; idempotente (não altera tabela já existente).

CREATE TABLE IF NOT EXISTS interacoes_cliente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  pedido_id UUID,
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

-- FK do pedido só quando a tabela de pedidos omnichannel existe (igual à 016).
DO $$
BEGIN
  IF to_regclass('pedidos_omnichannel') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = to_regclass('interacoes_cliente') AND contype = 'f'
         AND confrelid = to_regclass('pedidos_omnichannel')
    ) THEN
      ALTER TABLE interacoes_cliente
        ADD CONSTRAINT fk_interacoes_cliente_pedido
        FOREIGN KEY (pedido_id) REFERENCES pedidos_omnichannel(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
