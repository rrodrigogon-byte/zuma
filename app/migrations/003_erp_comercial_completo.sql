-- =============================================================================
-- MIGRATION 003: ERP Comercial Completo
-- SetPoint Ultra - Módulos: Loja de Moda, Oficina, Agropecuária,
--                           Barbearia (expandida), Varejo Geral,
--                           Compras, Fiscal, Pagamentos, BI, CRM
-- =============================================================================

-- =============================================================================
-- MÓDULO: LOJA DE MODA (Grade Cor × Tamanho)
-- =============================================================================

CREATE TABLE IF NOT EXISTS loja_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  codigo VARCHAR(50),
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(100),
  marca VARCHAR(100),
  genero VARCHAR(20) CHECK (genero IN ('masculino','feminino','infantil','unissex')),
  preco_custo NUMERIC(12,2) DEFAULT 0,
  preco_venda NUMERIC(12,2) NOT NULL,
  preco_atacado NUMERIC(12,2),
  preco_construtor NUMERIC(12,2),
  ativo BOOLEAN DEFAULT TRUE,
  imagem_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loja_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES loja_produtos(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  cor VARCHAR(50) NOT NULL,
  tamanho VARCHAR(20) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  codigo_barras VARCHAR(50),
  estoque_atual INTEGER DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 0,
  preco_venda_override NUMERIC(12,2),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(produto_id, cor, tamanho)
);

CREATE TABLE IF NOT EXISTS loja_crediario_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  nome VARCHAR(200) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  telefone VARCHAR(20),
  limite_credito NUMERIC(12,2) DEFAULT 0,
  saldo_devedor NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado','inativo')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loja_crediario_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  crediario_cliente_id UUID NOT NULL REFERENCES loja_crediario_clientes(id),
  valor_total NUMERIC(12,2) NOT NULL,
  num_parcelas INTEGER NOT NULL DEFAULT 1,
  taxa_juros NUMERIC(5,2) DEFAULT 0,
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loja_crediario_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  venda_id UUID NOT NULL REFERENCES loja_crediario_vendas(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago NUMERIC(12,2),
  multa NUMERIC(12,2) DEFAULT 0,
  juros NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'aberta' CHECK (status IN ('aberta','paga','vencida','cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loja_condicionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  cliente_nome VARCHAR(200) NOT NULL,
  cliente_telefone VARCHAR(20),
  vendedor_id UUID,
  data_saida TIMESTAMPTZ DEFAULT NOW(),
  data_retorno_prevista DATE,
  data_retorno_real DATE,
  status VARCHAR(20) DEFAULT 'aberta' CHECK (status IN ('aberta','retornada','faturada','perdida')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loja_condicionais_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condicional_id UUID NOT NULL REFERENCES loja_condicionais(id) ON DELETE CASCADE,
  grade_id UUID NOT NULL REFERENCES loja_grades(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL,
  retornado BOOLEAN DEFAULT FALSE,
  faturado BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS loja_vale_presentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  valor_original NUMERIC(12,2) NOT NULL,
  saldo_atual NUMERIC(12,2) NOT NULL,
  cpf_destinatario VARCHAR(14),
  nome_destinatario VARCHAR(200),
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_validade DATE,
  status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo','utilizado','expirado','cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MÓDULO: OFICINA MECÂNICA E ASSISTÊNCIA TÉCNICA
-- =============================================================================

CREATE TABLE IF NOT EXISTS oficina_veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  placa VARCHAR(10),
  chassi VARCHAR(30),
  renavam VARCHAR(20),
  marca VARCHAR(50),
  modelo VARCHAR(100),
  ano_fabricacao INTEGER,
  ano_modelo INTEGER,
  cor VARCHAR(30),
  combustivel VARCHAR(20),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oficina_ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  numero_os VARCHAR(20) UNIQUE NOT NULL,
  veiculo_id UUID REFERENCES oficina_veiculos(id),
  cliente_id UUID REFERENCES clientes(id),
  mecanico_responsavel_id UUID,
  km_entrada INTEGER,
  km_saida INTEGER,
  data_entrada TIMESTAMPTZ DEFAULT NOW(),
  data_previsao DATE,
  data_saida TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'aguardando_orcamento'
    CHECK (status IN ('aguardando_orcamento','orcamento_enviado','aprovado','em_servico','aguardando_peca','finalizado','cancelado','entregue')),
  descricao_problema TEXT NOT NULL,
  observacoes_internas TEXT,
  valor_pecas NUMERIC(12,2) DEFAULT 0,
  valor_mao_obra NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) GENERATED ALWAYS AS (valor_pecas + valor_mao_obra) STORED,
  desconto NUMERIC(12,2) DEFAULT 0,
  aprovado_em TIMESTAMPTZ,
  aprovado_por VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oficina_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES oficina_ordens_servico(id) ON DELETE CASCADE,
  item VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'ok' CHECK (status IN ('ok','avariado','ausente','nao_verificado')),
  observacao TEXT,
  foto_url TEXT,
  verificado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oficina_os_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES oficina_ordens_servico(id) ON DELETE CASCADE,
  descricao VARCHAR(300) NOT NULL,
  mecanico_id UUID,
  horas_estimadas NUMERIC(5,2),
  horas_realizadas NUMERIC(5,2),
  valor_hora NUMERIC(10,2),
  valor_total NUMERIC(12,2) NOT NULL,
  comissao_percentual NUMERIC(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','em_execucao','concluido'))
);

CREATE TABLE IF NOT EXISTS oficina_os_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES oficina_ordens_servico(id) ON DELETE CASCADE,
  produto_id UUID,
  descricao VARCHAR(300) NOT NULL,
  quantidade NUMERIC(10,3) NOT NULL,
  valor_unitario NUMERIC(12,2) NOT NULL,
  valor_total NUMERIC(12,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  numero_serie VARCHAR(100),
  garantia_meses INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS oficina_garantias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  os_id UUID NOT NULL REFERENCES oficina_ordens_servico(id),
  tipo VARCHAR(20) CHECK (tipo IN ('servico','peca')),
  descricao VARCHAR(300) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'vigente' CHECK (status IN ('vigente','expirada','acionada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MÓDULO: AGROPECUÁRIA, PETSHOP E CLÍNICA VETERINÁRIA
-- =============================================================================

CREATE TABLE IF NOT EXISTS agro_receituarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  numero_receita VARCHAR(50) UNIQUE NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('agronomico','veterinario')),
  profissional_nome VARCHAR(200) NOT NULL,
  profissional_registro VARCHAR(50) NOT NULL,
  cliente_nome VARCHAR(200) NOT NULL,
  cliente_cpf_cnpj VARCHAR(20),
  propriedade VARCHAR(300),
  data_emissao DATE DEFAULT CURRENT_DATE,
  validade_dias INTEGER DEFAULT 30,
  status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo','utilizado','cancelado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agro_receituario_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receituario_id UUID NOT NULL REFERENCES agro_receituarios(id) ON DELETE CASCADE,
  produto_id UUID,
  produto_nome VARCHAR(200) NOT NULL,
  dosagem VARCHAR(100),
  quantidade NUMERIC(10,3),
  unidade VARCHAR(20),
  modo_uso TEXT
);

CREATE TABLE IF NOT EXISTS petshop_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  nome VARCHAR(100) NOT NULL,
  especie VARCHAR(50) NOT NULL,
  raca VARCHAR(100),
  sexo VARCHAR(10) CHECK (sexo IN ('macho','femea','nao_informado')),
  data_nascimento DATE,
  peso_kg NUMERIC(6,2),
  cor_pelagem VARCHAR(100),
  microchip VARCHAR(50),
  castrado BOOLEAN DEFAULT FALSE,
  foto_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS petshop_prontuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES petshop_pets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  tipo VARCHAR(30) CHECK (tipo IN ('consulta','vacina','exame','cirurgia','retorno','banho_tosa','outro')),
  data_atendimento TIMESTAMPTZ DEFAULT NOW(),
  veterinario_nome VARCHAR(200),
  peso_na_consulta NUMERIC(6,2),
  temperatura NUMERIC(4,1),
  diagnostico TEXT,
  prescricao TEXT,
  observacoes TEXT,
  proxima_consulta DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS petshop_vacinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES petshop_pets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  nome_vacina VARCHAR(200) NOT NULL,
  fabricante VARCHAR(100),
  lote VARCHAR(50),
  data_aplicacao DATE NOT NULL,
  data_reforco DATE,
  veterinario_nome VARCHAR(200),
  notificacao_enviada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS petshop_agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES petshop_pets(id),
  profissional_id UUID,
  tipo_servico VARCHAR(50) CHECK (tipo_servico IN ('banho','tosa','banho_tosa','consulta','vacina','outro')),
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER DEFAULT 60,
  valor NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'agendado' CHECK (status IN ('agendado','confirmado','em_atendimento','finalizado','cancelado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MÓDULO: BARBEARIA / SALÃO (EXPANDIDO COM RATEIO)
-- =============================================================================

CREATE TABLE IF NOT EXISTS barbearia_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(200),
  tipo VARCHAR(20) DEFAULT 'parceiro' CHECK (tipo IN ('funcionario','parceiro','autonomo')),
  percentual_comissao NUMERIC(5,2) DEFAULT 50.00,
  percentual_comissao_produto NUMERIC(5,2) DEFAULT 30.00,
  desconta_taxa_maquininha BOOLEAN DEFAULT TRUE,
  ativo BOOLEAN DEFAULT TRUE,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barbearia_pacotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  valor_mensal NUMERIC(10,2) NOT NULL,
  limite_utilizacoes INTEGER,
  servicos_incluidos JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barbearia_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  pacote_id UUID NOT NULL REFERENCES barbearia_pacotes(id),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  status VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','cancelada','vencida')),
  utilizacoes_mes INTEGER DEFAULT 0,
  gateway_subscription_id VARCHAR(200),
  proximo_vencimento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barbearia_rateios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  profissional_id UUID NOT NULL REFERENCES barbearia_profissionais(id),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  total_servicos NUMERIC(12,2) DEFAULT 0,
  total_produtos NUMERIC(12,2) DEFAULT 0,
  taxa_maquininha NUMERIC(12,2) DEFAULT 0,
  valor_bruto NUMERIC(12,2) DEFAULT 0,
  valor_liquido NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MÓDULO: VAREJO GERAL (ORÇAMENTOS, ENTREGAS, MULTI-ESTOQUE)
-- =============================================================================

CREATE TABLE IF NOT EXISTS varejo_orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  numero VARCHAR(20) UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  cliente_nome VARCHAR(200),
  vendedor_id UUID,
  data_emissao DATE DEFAULT CURRENT_DATE,
  validade_dias INTEGER DEFAULT 7,
  data_validade DATE GENERATED ALWAYS AS (data_emissao + validade_dias) STORED,
  status VARCHAR(20) DEFAULT 'aberto' CHECK (status IN ('aberto','aprovado','convertido','expirado','cancelado')),
  valor_subtotal NUMERIC(12,2) DEFAULT 0,
  desconto_percentual NUMERIC(5,2) DEFAULT 0,
  desconto_valor NUMERIC(12,2) DEFAULT 0,
  valor_frete NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  pedido_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS varejo_orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES varejo_orcamentos(id) ON DELETE CASCADE,
  produto_id UUID,
  descricao VARCHAR(300) NOT NULL,
  quantidade NUMERIC(10,3) NOT NULL,
  unidade VARCHAR(20) DEFAULT 'UN',
  valor_unitario NUMERIC(12,2) NOT NULL,
  desconto_percentual NUMERIC(5,2) DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS varejo_estoques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(20) DEFAULT 'loja' CHECK (tipo IN ('loja','deposito','consignado','transito')),
  endereco TEXT,
  responsavel VARCHAR(200),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS varejo_tabelas_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(20) DEFAULT 'varejo' CHECK (tipo IN ('varejo','atacado','construtor','especial','promocional')),
  desconto_percentual NUMERIC(5,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS varejo_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  pedido_id UUID,
  cliente_id UUID REFERENCES clientes(id),
  endereco_entrega JSONB NOT NULL,
  motorista_id UUID,
  data_saida TIMESTAMPTZ,
  data_entrega_prevista DATE,
  data_entrega_real TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','saiu_entrega','entregue','tentativa_falha','devolvido','cancelado')),
  valor_frete NUMERIC(10,2) DEFAULT 0,
  observacoes TEXT,
  assinatura_url TEXT,
  foto_entrega_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MÓDULO: COMPRAS E FORNECEDORES
-- =============================================================================

CREATE TABLE IF NOT EXISTS compras_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  razao_social VARCHAR(300) NOT NULL,
  nome_fantasia VARCHAR(200),
  cnpj_cpf VARCHAR(20) UNIQUE,
  ie VARCHAR(30),
  email VARCHAR(200),
  telefone VARCHAR(20),
  celular VARCHAR(20),
  contato_nome VARCHAR(200),
  endereco JSONB,
  prazo_pagamento_dias INTEGER DEFAULT 30,
  limite_credito NUMERIC(12,2) DEFAULT 0,
  categoria VARCHAR(100),
  ativo BOOLEAN DEFAULT TRUE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  numero VARCHAR(20) UNIQUE NOT NULL,
  fornecedor_id UUID NOT NULL REFERENCES compras_fornecedores(id),
  solicitante_id UUID,
  aprovador_id UUID,
  status VARCHAR(30) DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aguardando_aprovacao','aprovado','enviado','parcialmente_recebido','recebido','cancelado')),
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_previsao_entrega DATE,
  valor_subtotal NUMERIC(12,2) DEFAULT 0,
  valor_frete NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  condicao_pagamento VARCHAR(100),
  observacoes TEXT,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES compras_pedidos(id) ON DELETE CASCADE,
  produto_id UUID,
  descricao VARCHAR(300) NOT NULL,
  quantidade NUMERIC(10,3) NOT NULL,
  unidade VARCHAR(20) DEFAULT 'UN',
  valor_unitario NUMERIC(12,2) NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL,
  quantidade_recebida NUMERIC(10,3) DEFAULT 0,
  status_item VARCHAR(20) DEFAULT 'pendente' CHECK (status_item IN ('pendente','parcial','recebido'))
);

CREATE TABLE IF NOT EXISTS compras_cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  numero VARCHAR(20) UNIQUE NOT NULL,
  descricao VARCHAR(300),
  status VARCHAR(20) DEFAULT 'aberta' CHECK (status IN ('aberta','encerrada','convertida')),
  data_limite DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_cotacao_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES compras_cotacoes(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES compras_fornecedores(id),
  status VARCHAR(20) DEFAULT 'enviado' CHECK (status IN ('enviado','respondido','vencedor','perdedor')),
  valor_total NUMERIC(12,2),
  prazo_entrega_dias INTEGER,
  observacoes TEXT,
  respondido_em TIMESTAMPTZ
);

-- =============================================================================
-- MÓDULO: FISCAL COMPLETO
-- =============================================================================

CREATE TABLE IF NOT EXISTS fiscal_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE UNIQUE,
  cnpj VARCHAR(18) NOT NULL,
  ie VARCHAR(30),
  im VARCHAR(30),
  razao_social VARCHAR(300) NOT NULL,
  nome_fantasia VARCHAR(200),
  regime_tributario VARCHAR(20) DEFAULT 'simples' CHECK (regime_tributario IN ('simples','lucro_presumido','lucro_real','mei')),
  ambiente VARCHAR(20) DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
  uf VARCHAR(2) NOT NULL,
  csc_id VARCHAR(10),
  csc VARCHAR(100),
  serie_nfce INTEGER DEFAULT 1,
  serie_nfe INTEGER DEFAULT 1,
  serie_nfse INTEGER DEFAULT 1,
  proximo_numero_nfce INTEGER DEFAULT 1,
  proximo_numero_nfe INTEGER DEFAULT 1,
  proximo_numero_nfse INTEGER DEFAULT 1,
  provedor VARCHAR(20) DEFAULT 'focusnfe' CHECK (provedor IN ('focusnfe','webmania','nfeio')),
  token_provedor VARCHAR(500),
  certificado_a1_base64 TEXT,
  certificado_senha VARCHAR(200),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('nfce','nfe','nfse','cte','mdfe')),
  numero INTEGER NOT NULL,
  serie INTEGER NOT NULL,
  chave_acesso VARCHAR(50),
  protocolo VARCHAR(50),
  status VARCHAR(30) DEFAULT 'pendente'
    CHECK (status IN ('pendente','processando','autorizado','cancelado','rejeitado','contingencia','inutilizado')),
  ambiente VARCHAR(20) DEFAULT 'homologacao',
  data_emissao TIMESTAMPTZ DEFAULT NOW(),
  data_autorizacao TIMESTAMPTZ,
  valor_total NUMERIC(12,2),
  destinatario_nome VARCHAR(300),
  destinatario_cpf_cnpj VARCHAR(20),
  xml_enviado TEXT,
  xml_retorno TEXT,
  motivo_rejeicao TEXT,
  referencia_interna UUID,
  nsu_tef VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_contingencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tipo VARCHAR(10) NOT NULL,
  motivo TEXT NOT NULL,
  inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fim TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- MÓDULO: PAGAMENTOS MULTIADQUIRENTE
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagamentos_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  adquirente VARCHAR(30) NOT NULL CHECK (adquirente IN ('stone','cielo','pagbank','mercadopago','asaas','stripe','nativo')),
  ativo BOOLEAN DEFAULT TRUE,
  ambiente VARCHAR(20) DEFAULT 'homologacao',
  credenciais JSONB NOT NULL DEFAULT '{}',
  taxa_credito NUMERIC(5,4) DEFAULT 0.0249,
  taxa_debito NUMERIC(5,4) DEFAULT 0.0149,
  taxa_pix NUMERIC(5,4) DEFAULT 0.0089,
  taxa_fixa_por_transacao NUMERIC(6,2) DEFAULT 0.39,
  prioridade INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagamentos_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('credito','debito','pix','boleto','dinheiro','carteira','crediario','vale_presente')),
  adquirente VARCHAR(30),
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','processando','aprovado','recusado','cancelado','estornado')),
  valor NUMERIC(12,2) NOT NULL,
  taxa_aplicada NUMERIC(12,2) DEFAULT 0,
  valor_liquido NUMERIC(12,2),
  nsu VARCHAR(50),
  autorizacao VARCHAR(50),
  bandeira VARCHAR(30),
  num_parcelas INTEGER DEFAULT 1,
  qr_code TEXT,
  pix_copia_cola TEXT,
  boleto_url TEXT,
  boleto_linha_digitavel TEXT,
  gateway_transaction_id VARCHAR(200),
  referencia_interna UUID,
  tipo_referencia VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MÓDULO: CRM E COMUNICAÇÃO
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_segmentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  regras JSONB NOT NULL DEFAULT '[]',
  total_clientes INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('whatsapp','email','sms','push')),
  segmento_id UUID REFERENCES crm_segmentos(id),
  mensagem TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'rascunho' CHECK (status IN ('rascunho','agendada','enviando','concluida','cancelada')),
  agendado_para TIMESTAMPTZ,
  total_enviados INTEGER DEFAULT 0,
  total_entregues INTEGER DEFAULT 0,
  total_lidos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_regua_cobranca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  regras JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MÓDULO: BI E RELATÓRIOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS bi_kpis_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  faturamento_total NUMERIC(14,2) DEFAULT 0,
  faturamento_pdv NUMERIC(14,2) DEFAULT 0,
  faturamento_reservas NUMERIC(14,2) DEFAULT 0,
  faturamento_torneios NUMERIC(14,2) DEFAULT 0,
  faturamento_servicos NUMERIC(14,2) DEFAULT 0,
  num_transacoes INTEGER DEFAULT 0,
  ticket_medio NUMERIC(12,2) DEFAULT 0,
  num_clientes_ativos INTEGER DEFAULT 0,
  custo_mercadorias NUMERIC(14,2) DEFAULT 0,
  margem_bruta NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, data)
);

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_loja_grades_produto ON loja_grades(produto_id);
CREATE INDEX IF NOT EXISTS idx_loja_grades_sku ON loja_grades(sku);
CREATE INDEX IF NOT EXISTS idx_loja_crediario_parcelas_vencimento ON loja_crediario_parcelas(data_vencimento, status);
CREATE INDEX IF NOT EXISTS idx_oficina_os_status ON oficina_ordens_servico(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_oficina_os_veiculo ON oficina_ordens_servico(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_petshop_pets_cliente ON petshop_pets(cliente_id);
CREATE INDEX IF NOT EXISTS idx_petshop_vacinas_reforco ON petshop_vacinas(data_reforco, notificacao_enviada);
CREATE INDEX IF NOT EXISTS idx_varejo_orcamentos_status ON varejo_orcamentos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_varejo_entregas_status ON varejo_entregas(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_compras_pedidos_status ON compras_pedidos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_status ON fiscal_documentos(tenant_id, status, tipo);
CREATE INDEX IF NOT EXISTS idx_pagamentos_transacoes_status ON pagamentos_transacoes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bi_kpis_data ON bi_kpis_diarios(tenant_id, data DESC);
