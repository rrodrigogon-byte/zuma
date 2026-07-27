# Changelog — Kytto ERP

## [2.1.0] — 2026-07-27

### ✨ Novas Funcionalidades

#### Barbearia v4.0
- **Agenda Inteligente**: Sistema de agendamentos com bloqueios (férias, manutenção), integração com profissionais
- **Fila Eletrônica**: Rastreamento em tempo real de clientes na fila, com tempos de espera e atendimento
- **Gestão de Clientes**: Cadastro com histórico JSONB, preferências de serviço, telefone e email
- **Avaliações e NPS**: Sistema de satisfação pós-atendimento com cálculo automático de NPS
- **Notificações Multicanal**: SMS, WhatsApp, email e push notifications para confirmações e lembretes
- **Painel de Profissionais**: Gestão de barbeiros/cabeleireiros com comissões e performance

#### Supermercado — Gestão de Lotes e Margem
- **Rastreamento de Lotes**: Controle de validade, quantidade, preço de custo e venda por lote
- **Estoque em Tempo Real**: Saldo consolidado por loja com quantidade reservada (pedidos em aberto)
- **Gestão de Fornecedores**: Cadastro centralizado com múltiplos fornecedores por produto
- **Histórico de Preços**: Rastreamento de variações com motivo, percentual e data de vigência
- **Análise de Margem**: Margem por item e loja, com faturamento mensal e lucro acumulado
- **Detalhamento de Vendas**: Itens com rastreamento de lote, margem e lucro por transação

### 🏗️ Arquitetura e Segurança

- **Isolamento Multiempresa/Multiloja**: Todas as tabelas com `empresa_id` e `loja_id`
- **RBAC Expandido**: Roles específicos por módulo (admin, gerente, barbeiro, vendedor, caixa)
- **Auditoria Imutável**: Triggers automáticos em todas as operações (INSERT, UPDATE)
- **Transações ACID**: Operações críticas com rollback automático em caso de erro
- **Contexto de Autenticação**: Preservação de `req.empresaId`, `req.lojaId`, `req.usuario`

### 📊 Migrações SQL

- **017_barbearia_evolucao.sql**: 5 novas tabelas com 8 índices e triggers de auditoria
- **018_supermercado_evolucao.sql**: 7 novas tabelas com 12 índices e triggers de auditoria

### 🔌 API Expandida

#### Barbearia (15 endpoints)
- `GET/POST /api/barbearia/clientes` — Gestão de clientes
- `GET/POST /api/barbearia/agendamentos` — Agendamentos
- `GET/POST /api/barbearia/bloqueios` — Bloqueios de agenda
- `GET/POST /api/barbearia/fila` — Fila eletrônica
- `GET/POST /api/barbearia/avaliacoes` — Avaliações e NPS
- `GET/POST /api/barbearia/notificacoes` — Notificações

#### Supermercado (6 endpoints)
- `GET/POST /api/supermercado/lotes` — Gestão de lotes
- `GET/POST /api/supermercado/fornecedores` — Gestão de fornecedores
- `GET /api/supermercado/margem` — Análise de margem
- `GET /api/supermercado/margem/resumo` — Resumo de margens
- `PATCH /api/supermercado/margem/:produto_id` — Atualizar margem

### 🎨 Interface React

- **Barbearia.jsx**: Tela com 5 abas (Agenda, Fila, Clientes, Avaliações, Profissionais)
- **Supermercado.jsx**: Telas expandidas com abas "Fornecedores" e "Margem"
- **App.jsx**: Rotas registradas com lazy loading
- **Sidebar.jsx**: Links de navegação adicionados

### 📦 Build e Deploy

- **Frontend**: Build Vite otimizado com tree-shaking e minificação
- **Backend**: Validação de sintaxe e compatibilidade Node.js v22
- **Docker**: Multi-stage build com otimização de tamanho e segurança
- **Cloud Run**: Pronto para deploy no GCP com healthcheck automático

### 🔄 Compatibilidade

- ✅ Mantém isolamento multiempresa/multiloja
- ✅ Compatível com auth.js existente
- ✅ Preserva RBAC e auditoria
- ✅ Transações ACID em operações críticas
- ✅ Contexto de autenticação multiloja

### 📝 Documentação

- **DEPLOY.md**: Guia completo de deploy no Cloud Run
- **CHANGELOG.md**: Este arquivo com histórico de mudanças
- **Comentários SQL**: Documentação em todas as tabelas e colunas

## [2.0.0] — 2026-07-20

### ✨ Novas Funcionalidades

- ERP Modular com suporte a múltiplas verticais
- Autenticação JWT com RBAC
- Estoque multiloja com transferências
- Vendas e pagamentos integrados
- NFC-e e fiscal nacional
- PDV offline com sincronização
- Omnichannel com delivery integrado

### 🔧 Melhorias

- Migração para PostgreSQL
- Arquitetura modular com rotas separadas
- Transações ACID para operações críticas
- Auditoria imutável em todas as operações

---

**Versão Atual**: v2.1.0  
**Data de Release**: 2026-07-27  
**Repositório**: [GitHub](https://github.com/rrodrigogon-byte/agro-open)  
**Licença**: Proprietária — Kytto ERP
