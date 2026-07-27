-- =============================================================================
-- Migration 004: Módulos ERP Novos
-- SetPoint Ultra v3.0.0
-- Módulos: Oficina, Agropecuária/Petshop, Barbearia (expand), Varejo, Compras, Fiscal, BI
-- =============================================================================

-- ============================================================================
-- MÓDULO: OFICINA MECÂNICA
-- ============================================================================

CREATE TABLE IF NOT EXISTS oficina_veiculos (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    cliente_id      INTEGER REFERENCES clientes(id),
    placa           VARCHAR(10) NOT NULL,
    chassi          VARCHAR(17),
    renavam         VARCHAR(11),
    marca           VARCHAR(50),
    modelo          VARCHAR(80),
    ano_fabricacao  SMALLINT,
    ano_modelo      SMALLINT,
    cor             VARCHAR(30),
    combustivel     VARCHAR(20) DEFAULT 'gasolina',
    observacoes     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(placa)
);

CREATE TABLE IF NOT EXISTS oficina_ordens_servico (
    id                          SERIAL PRIMARY KEY,
    tenant_id                   INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    numero_os                   VARCHAR(20) NOT NULL,
    veiculo_id                  INTEGER REFERENCES oficina_veiculos(id),
    cliente_id                  INTEGER REFERENCES clientes(id),
    mecanico_responsavel_id     INTEGER REFERENCES usuarios(id),
    km_entrada                  INTEGER,
    km_saida                    INTEGER,
    data_previsao               DATE,
    data_saida                  TIMESTAMPTZ,
    descricao_problema          TEXT,
    observacoes_internas        TEXT,
    status                      VARCHAR(30) DEFAULT 'aberta'
                                    CHECK (status IN ('aberta','orcamento_enviado','aprovado','em_execucao','finalizado','cancelado')),
    valor_pecas                 NUMERIC(12,2) DEFAULT 0,
    valor_mao_obra              NUMERIC(12,2) DEFAULT 0,
    valor_total                 NUMERIC(12,2) GENERATED ALWAYS AS (valor_pecas + valor_mao_obra) STORED,
    aprovado_em                 TIMESTAMPTZ,
    aprovado_por                VARCHAR(100),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oficina_checklist (
    id              SERIAL PRIMARY KEY,
    os_id           INTEGER NOT NULL REFERENCES oficina_ordens_servico(id) ON DELETE CASCADE,
    item            VARCHAR(100) NOT NULL,
    status          VARCHAR(10) DEFAULT 'ok' CHECK (status IN ('ok','atencao','critico','na')),
    observacao      TEXT,
    foto_url        TEXT
);

CREATE TABLE IF NOT EXISTS oficina_os_servicos (
    id                      SERIAL PRIMARY KEY,
    os_id                   INTEGER NOT NULL REFERENCES oficina_ordens_servico(id) ON DELETE CASCADE,
    descricao               VARCHAR(200) NOT NULL,
    mecanico_id             INTEGER REFERENCES usuarios(id),
    horas_estimadas         NUMERIC(5,2),
    valor_hora              NUMERIC(10,2),
    valor_total             NUMERIC(12,2) NOT NULL,
    comissao_percentual     NUMERIC(5,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS oficina_os_pecas (
    id                  SERIAL PRIMARY KEY,
    os_id               INTEGER NOT NULL REFERENCES oficina_ordens_servico(id) ON DELETE CASCADE,
    produto_id          INTEGER,
    descricao           VARCHAR(200) NOT NULL,
    quantidade          NUMERIC(10,3) NOT NULL,
    valor_unitario      NUMERIC(10,2) NOT NULL,
    valor_total         NUMERIC(12,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
    numero_serie        VARCHAR(50),
    garantia_meses      SMALLINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS oficina_garantias (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    os_id           INTEGER NOT NULL REFERENCES oficina_ordens_servico(id),
    tipo            VARCHAR(20) CHECK (tipo IN ('peca','servico')),
    descricao       VARCHAR(200),
    data_inicio     DATE NOT NULL,
    data_fim        DATE NOT NULL,
    status          VARCHAR(20) DEFAULT 'vigente' CHECK (status IN ('vigente','expirada','acionada')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MÓDULO: AGROPECUÁRIA E PETSHOP
-- ============================================================================

CREATE TABLE IF NOT EXISTS agro_receituarios (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    numero_receita          VARCHAR(30) NOT NULL UNIQUE,
    tipo                    VARCHAR(20) NOT NULL CHECK (tipo IN ('agronomico','veterinario')),
    profissional_nome       VARCHAR(100),
    profissional_registro   VARCHAR(30),
    cliente_nome            VARCHAR(100),
    cliente_cpf_cnpj        VARCHAR(18),
    propriedade             VARCHAR(200),
    validade_dias           SMALLINT DEFAULT 30,
    data_emissao            TIMESTAMPTZ DEFAULT NOW(),
    status                  VARCHAR(20) DEFAULT 'emitido' CHECK (status IN ('emitido','utilizado','cancelado')),
    observacoes             TEXT
);

CREATE TABLE IF NOT EXISTS agro_receituario_itens (
    id              SERIAL PRIMARY KEY,
    receituario_id  INTEGER NOT NULL REFERENCES agro_receituarios(id) ON DELETE CASCADE,
    produto_id      INTEGER,
    produto_nome    VARCHAR(200) NOT NULL,
    dosagem         VARCHAR(100),
    quantidade      NUMERIC(10,3),
    unidade         VARCHAR(20),
    modo_uso        TEXT
);

CREATE TABLE IF NOT EXISTS produto_fracionamentos (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    produto_origem_id   INTEGER NOT NULL,
    produto_destino_id  INTEGER NOT NULL,
    fator_conversao     NUMERIC(12,4) NOT NULL,
    unidade_origem      VARCHAR(20),
    unidade_destino     VARCHAR(20),
    ativo               BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, produto_origem_id)
);

CREATE TABLE IF NOT EXISTS petshop_pets (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    cliente_id      INTEGER REFERENCES clientes(id),
    nome            VARCHAR(80) NOT NULL,
    especie         VARCHAR(30) NOT NULL,
    raca            VARCHAR(80),
    sexo            VARCHAR(15) DEFAULT 'nao_informado',
    data_nascimento DATE,
    peso_kg         NUMERIC(6,3),
    cor_pelagem     VARCHAR(50),
    microchip       VARCHAR(30),
    castrado        BOOLEAN DEFAULT FALSE,
    foto_url        TEXT,
    observacoes     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS petshop_prontuarios (
    id                  SERIAL PRIMARY KEY,
    pet_id              INTEGER NOT NULL REFERENCES petshop_pets(id) ON DELETE CASCADE,
    tenant_id           INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    tipo                VARCHAR(30) DEFAULT 'consulta',
    data_atendimento    TIMESTAMPTZ DEFAULT NOW(),
    veterinario_nome    VARCHAR(100),
    peso_na_consulta    NUMERIC(6,3),
    temperatura         NUMERIC(4,1),
    diagnostico         TEXT,
    prescricao          TEXT,
    observacoes         TEXT,
    proxima_consulta    DATE
);

CREATE TABLE IF NOT EXISTS petshop_vacinas (
    id                      SERIAL PRIMARY KEY,
    pet_id                  INTEGER NOT NULL REFERENCES petshop_pets(id) ON DELETE CASCADE,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    nome_vacina             VARCHAR(100) NOT NULL,
    fabricante              VARCHAR(80),
    lote                    VARCHAR(30),
    data_aplicacao          DATE NOT NULL,
    data_reforco            DATE,
    veterinario_nome        VARCHAR(100),
    notificacao_enviada     BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS petshop_agendamentos (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    pet_id              INTEGER REFERENCES petshop_pets(id),
    profissional_id     INTEGER REFERENCES usuarios(id),
    tipo_servico        VARCHAR(80),
    data_hora           TIMESTAMPTZ NOT NULL,
    duracao_minutos     SMALLINT DEFAULT 60,
    valor               NUMERIC(10,2),
    status              VARCHAR(20) DEFAULT 'agendado',
    observacoes         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MÓDULO: BARBEARIA (EXPANSÃO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS barbearia_profissionais (
    id                              SERIAL PRIMARY KEY,
    tenant_id                       INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    nome                            VARCHAR(100) NOT NULL,
    telefone                        VARCHAR(20),
    email                           VARCHAR(100),
    tipo                            VARCHAR(20) DEFAULT 'parceiro' CHECK (tipo IN ('funcionario','parceiro','autonomo')),
    percentual_comissao             NUMERIC(5,2) DEFAULT 50,
    percentual_comissao_produto     NUMERIC(5,2) DEFAULT 30,
    desconta_taxa_maquininha        BOOLEAN DEFAULT TRUE,
    foto_url                        TEXT,
    ativo                           BOOLEAN DEFAULT TRUE,
    created_at                      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barbearia_rateios (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    profissional_id     INTEGER NOT NULL REFERENCES barbearia_profissionais(id),
    periodo_inicio      DATE NOT NULL,
    periodo_fim         DATE NOT NULL,
    total_servicos      INTEGER DEFAULT 0,
    valor_bruto         NUMERIC(12,2) DEFAULT 0,
    valor_liquido       NUMERIC(12,2) DEFAULT 0,
    status              VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','pago')),
    data_pagamento      DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barbearia_pacotes (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    nome                    VARCHAR(100) NOT NULL,
    descricao               TEXT,
    valor_mensal            NUMERIC(10,2) NOT NULL,
    limite_utilizacoes      SMALLINT,
    servicos_incluidos      JSONB DEFAULT '[]',
    ativo                   BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barbearia_assinaturas (
    id                          SERIAL PRIMARY KEY,
    tenant_id                   INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    cliente_id                  INTEGER NOT NULL REFERENCES clientes(id),
    pacote_id                   INTEGER NOT NULL REFERENCES barbearia_pacotes(id),
    data_inicio                 DATE NOT NULL,
    data_fim                    DATE,
    proximo_vencimento          DATE,
    utilizacoes_mes             SMALLINT DEFAULT 0,
    status                      VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','cancelada')),
    gateway_subscription_id     VARCHAR(100),
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MÓDULO: VAREJO GERAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS varejo_orcamentos (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    numero                  VARCHAR(20) NOT NULL,
    cliente_id              INTEGER REFERENCES clientes(id),
    cliente_nome            VARCHAR(100),
    vendedor_id             INTEGER REFERENCES usuarios(id),
    validade_dias           SMALLINT DEFAULT 7,
    data_validade           DATE GENERATED ALWAYS AS (CURRENT_DATE + validade_dias) STORED,
    valor_subtotal          NUMERIC(12,2) DEFAULT 0,
    desconto_percentual     NUMERIC(5,2) DEFAULT 0,
    desconto_valor          NUMERIC(12,2) DEFAULT 0,
    valor_frete             NUMERIC(10,2) DEFAULT 0,
    valor_total             NUMERIC(12,2) DEFAULT 0,
    status                  VARCHAR(20) DEFAULT 'aberto' CHECK (status IN ('aberto','convertido','expirado','cancelado')),
    pedido_id               INTEGER,
    observacoes             TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS varejo_orcamento_itens (
    id                      SERIAL PRIMARY KEY,
    orcamento_id            INTEGER NOT NULL REFERENCES varejo_orcamentos(id) ON DELETE CASCADE,
    produto_id              INTEGER,
    descricao               VARCHAR(200) NOT NULL,
    quantidade              NUMERIC(10,3) NOT NULL,
    unidade                 VARCHAR(10) DEFAULT 'UN',
    valor_unitario          NUMERIC(10,2) NOT NULL,
    desconto_percentual     NUMERIC(5,2) DEFAULT 0,
    valor_total             NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS varejo_estoques (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    nome            VARCHAR(100) NOT NULL,
    tipo            VARCHAR(20) DEFAULT 'loja' CHECK (tipo IN ('loja','deposito','consignado','transito')),
    endereco        TEXT,
    responsavel     VARCHAR(100),
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produto_estoques (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    estoque_id      INTEGER NOT NULL REFERENCES varejo_estoques(id),
    produto_id      INTEGER NOT NULL,
    quantidade      NUMERIC(12,3) DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, estoque_id, produto_id)
);

CREATE TABLE IF NOT EXISTS varejo_tabelas_preco (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    nome                    VARCHAR(100) NOT NULL,
    tipo                    VARCHAR(20) DEFAULT 'varejo' CHECK (tipo IN ('varejo','atacado','especial','funcionario')),
    desconto_percentual     NUMERIC(5,2) DEFAULT 0,
    ativo                   BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS varejo_entregas (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    pedido_id               INTEGER,
    cliente_id              INTEGER REFERENCES clientes(id),
    endereco_entrega        JSONB,
    motorista_id            INTEGER REFERENCES usuarios(id),
    data_entrega_prevista   DATE,
    data_entrega_real       TIMESTAMPTZ,
    valor_frete             NUMERIC(10,2) DEFAULT 0,
    status                  VARCHAR(30) DEFAULT 'pendente'
                                CHECK (status IN ('pendente','saiu_entrega','entregue','nao_entregue','cancelado')),
    assinatura_url          TEXT,
    foto_entrega_url        TEXT,
    observacoes             TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MÓDULO: COMPRAS E FORNECEDORES
-- ============================================================================

CREATE TABLE IF NOT EXISTS compras_fornecedores (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    razao_social            VARCHAR(150) NOT NULL,
    nome_fantasia           VARCHAR(100),
    cnpj_cpf                VARCHAR(18),
    ie                      VARCHAR(20),
    im                      VARCHAR(20),
    email                   VARCHAR(100),
    telefone                VARCHAR(20),
    celular                 VARCHAR(20),
    contato_nome            VARCHAR(100),
    endereco                JSONB,
    prazo_pagamento_dias    SMALLINT DEFAULT 30,
    limite_credito          NUMERIC(12,2) DEFAULT 0,
    categoria               VARCHAR(50),
    observacoes             TEXT,
    ativo                   BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_pedidos (
    id                          SERIAL PRIMARY KEY,
    tenant_id                   INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    numero                      VARCHAR(20) NOT NULL,
    fornecedor_id               INTEGER NOT NULL REFERENCES compras_fornecedores(id),
    solicitante_id              INTEGER REFERENCES usuarios(id),
    aprovador_id                INTEGER REFERENCES usuarios(id),
    aprovado_em                 TIMESTAMPTZ,
    status                      VARCHAR(30) DEFAULT 'rascunho'
                                    CHECK (status IN ('rascunho','aguardando_aprovacao','aprovado','enviado','parcialmente_recebido','recebido','cancelado')),
    data_previsao_entrega       DATE,
    valor_subtotal              NUMERIC(12,2) DEFAULT 0,
    valor_frete                 NUMERIC(10,2) DEFAULT 0,
    valor_total                 NUMERIC(12,2) DEFAULT 0,
    condicao_pagamento          VARCHAR(100),
    observacoes                 TEXT,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_pedido_itens (
    id                      SERIAL PRIMARY KEY,
    pedido_id               INTEGER NOT NULL REFERENCES compras_pedidos(id) ON DELETE CASCADE,
    produto_id              INTEGER,
    descricao               VARCHAR(200) NOT NULL,
    quantidade              NUMERIC(10,3) NOT NULL,
    quantidade_recebida     NUMERIC(10,3) DEFAULT 0,
    unidade                 VARCHAR(10) DEFAULT 'UN',
    valor_unitario          NUMERIC(10,2) NOT NULL,
    valor_total             NUMERIC(12,2) NOT NULL,
    status_item             VARCHAR(20) DEFAULT 'pendente' CHECK (status_item IN ('pendente','parcial','recebido'))
);

CREATE TABLE IF NOT EXISTS compras_cotacoes (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    numero          VARCHAR(20) NOT NULL,
    descricao       TEXT,
    data_limite     DATE,
    status          VARCHAR(20) DEFAULT 'aberta' CHECK (status IN ('aberta','encerrada','convertida')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_cotacao_fornecedores (
    id                      SERIAL PRIMARY KEY,
    cotacao_id              INTEGER NOT NULL REFERENCES compras_cotacoes(id) ON DELETE CASCADE,
    fornecedor_id           INTEGER NOT NULL REFERENCES compras_fornecedores(id),
    status                  VARCHAR(20) DEFAULT 'aguardando' CHECK (status IN ('aguardando','respondido','recusado')),
    valor_total             NUMERIC(12,2),
    prazo_entrega_dias      SMALLINT,
    observacoes             TEXT,
    respondido_em           TIMESTAMPTZ
);

-- ============================================================================
-- MÓDULO: FISCAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS fiscal_configuracoes (
    id                          SERIAL PRIMARY KEY,
    tenant_id                   INTEGER NOT NULL UNIQUE REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    cnpj                        VARCHAR(18),
    ie                          VARCHAR(20),
    im                          VARCHAR(20),
    razao_social                VARCHAR(150),
    nome_fantasia               VARCHAR(100),
    regime_tributario           VARCHAR(20) DEFAULT 'simples' CHECK (regime_tributario IN ('simples','lucro_presumido','lucro_real')),
    ambiente                    VARCHAR(15) DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
    uf                          CHAR(2),
    csc_id                      VARCHAR(10),
    csc                         VARCHAR(50),
    serie_nfce                  SMALLINT DEFAULT 1,
    serie_nfe                   SMALLINT DEFAULT 1,
    proximo_numero_nfce         INTEGER DEFAULT 1,
    proximo_numero_nfe          INTEGER DEFAULT 1,
    proximo_numero_nfse         INTEGER DEFAULT 1,
    provedor                    VARCHAR(30) DEFAULT 'focusnfe',
    token_provedor              TEXT,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_documentos (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    tipo                    VARCHAR(10) NOT NULL CHECK (tipo IN ('nfce','nfe','nfse','cte')),
    numero                  INTEGER NOT NULL,
    serie                   SMALLINT NOT NULL,
    status                  VARCHAR(30) DEFAULT 'pendente'
                                CHECK (status IN ('pendente','processando','autorizado','cancelado','rejeitado','contingencia','inutilizado')),
    ambiente                VARCHAR(15),
    chave_acesso            VARCHAR(44),
    protocolo               VARCHAR(30),
    data_emissao            TIMESTAMPTZ DEFAULT NOW(),
    data_autorizacao        TIMESTAMPTZ,
    valor_total             NUMERIC(12,2),
    destinatario_nome       VARCHAR(150),
    destinatario_cpf_cnpj   VARCHAR(18),
    referencia_interna      VARCHAR(50),
    nsu_tef                 VARCHAR(30),
    xml_retorno             TEXT,
    motivo_rejeicao         TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_contingencias (
    id          SERIAL PRIMARY KEY,
    tenant_id   INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    tipo        VARCHAR(10) NOT NULL,
    motivo      TEXT,
    inicio      TIMESTAMPTZ DEFAULT NOW(),
    fim         TIMESTAMPTZ,
    ativo       BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- MÓDULO: ESTOQUE MOVIMENTAÇÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    tipo                    VARCHAR(30) NOT NULL,
    produto_id              INTEGER NOT NULL,
    estoque_origem_id       INTEGER REFERENCES varejo_estoques(id),
    estoque_destino_id      INTEGER REFERENCES varejo_estoques(id),
    quantidade              NUMERIC(12,3) NOT NULL,
    valor_unitario          NUMERIC(10,2),
    observacao              TEXT,
    usuario_id              INTEGER REFERENCES usuarios(id),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_oficina_os_tenant ON oficina_ordens_servico(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_oficina_os_veiculo ON oficina_ordens_servico(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_petshop_pets_cliente ON petshop_pets(tenant_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_petshop_vacinas_reforco ON petshop_vacinas(tenant_id, data_reforco) WHERE notificacao_enviada = FALSE;
CREATE INDEX IF NOT EXISTS idx_varejo_orcamentos_tenant ON varejo_orcamentos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_compras_pedidos_tenant ON compras_pedidos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_tenant ON fiscal_documentos(tenant_id, tipo, status);
CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_chave ON fiscal_documentos(chave_acesso) WHERE chave_acesso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produto_estoques_produto ON produto_estoques(tenant_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_produto ON estoque_movimentacoes(tenant_id, produto_id, created_at);

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE oficina_ordens_servico IS 'Ordens de Serviço da Oficina Mecânica — SetPoint Ultra v3.0';
COMMENT ON TABLE agro_receituarios IS 'Receituários Agronômicos e Veterinários — controle INDEA/MAPA';
COMMENT ON TABLE petshop_pets IS 'Cadastro de pets com prontuário veterinário completo';
COMMENT ON TABLE barbearia_profissionais IS 'Profissionais da barbearia com configuração de rateio';
COMMENT ON TABLE varejo_orcamentos IS 'Orçamentos de venda com conversão automática em pedido';
COMMENT ON TABLE compras_pedidos IS 'Pedidos de compra com aprovação por alçada de valor';
COMMENT ON TABLE fiscal_documentos IS 'Documentos fiscais emitidos — NFC-e, NF-e, NF-Se, CT-e';
