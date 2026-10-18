-- Clube & Academia: cobrança da mensalidade por empresa (multiempresa).
-- Cada academia recebe na PRÓPRIA conta: Pix com a chave da academia (QR e copia e cola), com a
-- baixa confirmada pela recepção. O campo `provedor` deixa a porta aberta para gateways por
-- empresa (InfinitePay, Mercado Pago…) sem mudar o resto: a baixa sempre passa por
-- registrarPagamentoClube (idempotente por pagamento), que libera a catraca e soma a receita.

CREATE TABLE IF NOT EXISTS clube_cobranca_config (
  empresa_id      UUID PRIMARY KEY,
  provedor        VARCHAR(30) NOT NULL DEFAULT 'pix_manual',
  ativo           BOOLEAN NOT NULL DEFAULT false,
  pix_chave       VARCHAR(140),
  pix_nome        VARCHAR(25),
  pix_cidade      VARCHAR(15),
  validade_horas  INTEGER NOT NULL DEFAULT 72,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_clube_cobranca_provedor CHECK (provedor IN ('pix_manual')),
  CONSTRAINT chk_clube_cobranca_validade CHECK (validade_horas BETWEEN 1 AND 720),
  CONSTRAINT chk_clube_cobranca_pix CHECK (
    NOT ativo OR provedor <> 'pix_manual' OR (pix_chave IS NOT NULL AND pix_nome IS NOT NULL AND pix_cidade IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS clube_cobrancas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  customer_id     UUID NOT NULL,
  valor           NUMERIC(10,2) NOT NULL,
  -- mensalidade: estende o "pago até"; acordo: parcela de dívida (dias proporcionais);
  -- avulsa: diária, taxa, produto (só receita, não mexe no acesso)
  tipo            VARCHAR(12) NOT NULL DEFAULT 'mensalidade',
  grupo_id        UUID,
  parcela         INTEGER NOT NULL DEFAULT 1,
  parcelas        INTEGER NOT NULL DEFAULT 1,
  descricao       VARCHAR(120) NOT NULL,
  provedor        VARCHAR(30) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pendente',
  token_hash      CHAR(64),           -- parcela futura só ganha link quando chega a vez dela
  enviar_em       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_em      TIMESTAMPTZ,
  txid            VARCHAR(25) NOT NULL,
  pix_copia_cola  TEXT,
  origem          VARCHAR(20) NOT NULL DEFAULT 'regua',
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em       TIMESTAMPTZ NOT NULL,
  pago_em         TIMESTAMPTZ,
  confirmado_por  VARCHAR(120),
  cancelado_em    TIMESTAMPTZ,
  cancelado_por   VARCHAR(120),
  CONSTRAINT uq_clube_cobranca_token UNIQUE (token_hash),
  CONSTRAINT uq_clube_cobranca_txid UNIQUE (empresa_id, txid),
  CONSTRAINT chk_clube_cobranca_status CHECK (status IN ('pendente', 'paga', 'cancelada')),
  CONSTRAINT chk_clube_cobranca_valor CHECK (valor >= 1 AND valor <= 100000),
  CONSTRAINT chk_clube_cobranca_parcela CHECK (parcelas BETWEEN 1 AND 24 AND parcela BETWEEN 1 AND parcelas),
  CONSTRAINT chk_clube_cobranca_origem CHECK (origem IN ('regua', 'ia', 'recepcao', 'acordo')),
  CONSTRAINT chk_clube_cobranca_tipo CHECK (tipo IN ('mensalidade', 'acordo', 'avulsa'))
);

CREATE INDEX IF NOT EXISTS idx_clube_cobrancas_empresa_status ON clube_cobrancas (empresa_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_clube_cobrancas_cliente ON clube_cobrancas (empresa_id, customer_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_clube_cobrancas_agendadas ON clube_cobrancas (enviar_em) WHERE status = 'pendente' AND token_hash IS NULL;
