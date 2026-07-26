# Arquitetura SaaS Modular Multi-Tenant

**Plataforma:** SetPoint Ultra  
**Versão:** 2.0 - Modular  
**Data:** 26 de julho de 2026  
**Autor:** Manus AI

---

## 1. Visão Geral da Plataforma

O **SetPoint Ultra** é uma plataforma SaaS modular multi-tenant que oferece soluções de gestão de negócios para diferentes segmentos: bares, lojas, supermercados, barbearias, clubes, restaurantes e outros. Cada cliente ativa apenas os módulos que precisa, pagando uma assinatura mensal por módulo.

### Modelo de Negócio

| Aspecto | Descrição |
|--------|-----------|
| **Tipo** | SaaS Multi-Tenant com Módulos Independentes |
| **Faturamento** | Assinatura mensal por módulo + comissão sobre pagamentos |
| **Segmentação** | Por tipo de negócio (vertical) |
| **Escalabilidade** | Horizontal (múltiplos clientes, múltiplos módulos) |
| **Isolamento de Dados** | Tenant-aware (cada cliente vê apenas seus dados) |

---

## 2. Arquitetura Técnica

### 2.1 Camadas da Aplicação

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐
│  │  Web Admin   │  App Mobile  │  Painel PDV  │  Kiosk/Self  │
│  │  (React)     │  (React Nat) │  (React)     │  (React)     │
│  └──────────────┴──────────────┴──────────────┴──────────────┘
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE API (Express)                   │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐
│  │   Auth &     │   Tenant     │  Modules     │  Webhooks &  │
│  │   RBAC       │  Middleware  │  Router      │  Events      │
│  └──────────────┴──────────────┴──────────────┴──────────────┘
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE MÓDULOS                         │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐
│  │ CORE Module  │ BAR Module   │ LOJA Module  │ BARBER Mod   │
│  │ (Auth, Pay)  │ (Comanda)    │ (PDV)        │ (Agenda)     │
│  └──────────────┴──────────────┴──────────────┴──────────────┘
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐
│  │ SUPER Module │ CLUBE Module │ REST Module  │ Custom Mod   │
│  │ (Promo)      │ (Eventos)    │ (Reserva)    │ (Plugin)     │
│  └──────────────┴──────────────┴──────────────┴──────────────┘
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE SERVIÇOS                        │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐
│  │ NFC-e        │ Pagamentos   │ Estoque      │ Auditoria    │
│  │ (Multi-UF)   │ (Multi-Acq)  │ (Dose)       │ (Logs)       │
│  └──────────────┴──────────────┴──────────────┴──────────────┘
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐
│  │ Sincronização│ Notificações │ Relatórios   │ Integrações  │
│  │ (Offline)    │ (Push/SMS)   │ (BI)         │ (APIs)       │
│  └──────────────┴──────────────┴──────────────┴──────────────┘
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE DADOS                           │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐
│  │ PostgreSQL   │ Redis Cache  │ Cloud        │ Elasticsearch│
│  │ (Multi-DB)   │ (Sessions)   │ Storage      │ (Logs)       │
│  └──────────────┴──────────────┴──────────────┴──────────────┘
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura de Diretórios

```
setpoint-ultra/
├── app/
│   ├── core/                          # Core compartilhado
│   │   ├── auth.js                    # JWT, OAuth, SAML
│   │   ├── tenant.js                  # Multi-tenant middleware
│   │   ├── rbac.js                    # Role-Based Access Control
│   │   ├── database.js                # Conexão PostgreSQL
│   │   └── cache.js                   # Redis cache
│   │
│   ├── modules/                       # Módulos independentes
│   │   ├── core/                      # Módulo CORE (obrigatório)
│   │   │   ├── routes.js
│   │   │   ├── models.js
│   │   │   ├── controllers.js
│   │   │   └── services/
│   │   │       ├── nfce.js            # NFC-e multi-UF
│   │   │       ├── payment.js         # Pagamentos multi-adquirente
│   │   │       ├── stock.js           # Estoque por dose
│   │   │       └── audit.js           # Auditoria
│   │   │
│   │   ├── bar/                       # Módulo BAR
│   │   │   ├── routes.js
│   │   │   ├── models.js
│   │   │   ├── controllers.js
│   │   │   └── services/
│   │   │       ├── comanda.js         # Comanda eletrônica
│   │   │       ├── divisao.js         # Divisão de conta
│   │   │       ├── kds.js             # Kitchen Display System
│   │   │       └── printer.js         # Impressora de cozinha
│   │   │
│   │   ├── loja/                      # Módulo LOJA
│   │   │   ├── routes.js
│   │   │   ├── models.js
│   │   │   ├── controllers.js
│   │   │   └── services/
│   │   │       ├── pdv.js             # PDV
│   │   │       ├── vendas.js          # Vendas
│   │   │       ├── comissoes.js       # Comissões de vendedores
│   │   │       └── promocoes.js       # Promoções
│   │   │
│   │   ├── barbearia/                 # Módulo BARBEARIA
│   │   │   ├── routes.js
│   │   │   ├── models.js
│   │   │   ├── controllers.js
│   │   │   └── services/
│   │   │       ├── agendamentos.js    # Agendamentos
│   │   │       ├── servicos.js        # Serviços
│   │   │       ├── clientes.js        # Gestão de clientes
│   │   │       └── fidelizacao.js     # Programa de fidelização
│   │   │
│   │   ├── supermercado/              # Módulo SUPERMERCADO
│   │   │   ├── routes.js
│   │   │   ├── models.js
│   │   │   ├── controllers.js
│   │   │   └── services/
│   │   │       ├── autoatendimento.js # Caixas de autoatendimento
│   │   │       ├── pesagem.js         # Pesagem de produtos
│   │   │       ├── promocoes.js       # Promoções
│   │   │       └── cupom.js           # Cupom fiscal
│   │   │
│   │   ├── clube/                     # Módulo CLUBE
│   │   │   ├── routes.js
│   │   │   ├── models.js
│   │   │   ├── controllers.js
│   │   │   └── services/
│   │   │       ├── eventos.js         # Gestão de eventos
│   │   │       ├── membros.js         # Gestão de membros
│   │   │       ├── reservas.js        # Reservas de espaço
│   │   │       └── mensalidades.js    # Cobranças
│   │   │
│   │   └── custom/                    # Módulos customizados
│   │       └── plugin-loader.js       # Carregador de plugins
│   │
│   ├── adapters/                      # Adaptadores de integração
│   │   ├── nfce/
│   │   │   ├── focus.js               # Focus NFe
│   │   │   ├── plugnotas.js           # PlugNotas
│   │   │   └── sefaz-connector.js     # Conector SEFAZ
│   │   │
│   │   ├── payment/
│   │   │   ├── stone.js               # Stone
│   │   │   ├── cielo.js               # Cielo
│   │   │   ├── pagbank.js             # PagBank
│   │   │   ├── mercadopago.js         # Mercado Pago
│   │   │   └── pix-processor.js       # Processador Pix
│   │   │
│   │   └── integrations/
│   │       ├── erp-connector.js       # Conectores ERP
│   │       ├── webhook-handler.js     # Webhooks
│   │       └── api-gateway.js         # API Gateway
│   │
│   ├── queues/                        # Filas de processamento
│   │   ├── nfce-queue.js              # Fila NFC-e
│   │   ├── payment-queue.js           # Fila de pagamentos
│   │   ├── sync-queue.js              # Fila de sincronização
│   │   └── email-queue.js             # Fila de e-mails
│   │
│   ├── migrations/                    # Migrações de banco
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_modules_schema.sql
│   │   └── 003_subscriptions.sql
│   │
│   ├── server.js                      # Express app
│   ├── config.js                      # Configurações
│   └── package.json
│
├── web/                               # Frontend React
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/                 # Painel admin
│   │   │   ├── dashboard/             # Dashboard
│   │   │   ├── modules/               # Páginas de módulos
│   │   │   │   ├── bar/
│   │   │   │   ├── loja/
│   │   │   │   ├── barbearia/
│   │   │   │   └── supermercado/
│   │   │   └── settings/              # Configurações
│   │   │
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── ModuleSelector/        # Seletor de módulos
│   │   │   ├── Comanda/               # Componentes de comanda
│   │   │   ├── PDV/                   # Componentes de PDV
│   │   │   └── common/
│   │   │
│   │   ├── hooks/
│   │   │   ├── useTenant.js           # Hook de tenant
│   │   │   ├── useModule.js           # Hook de módulo
│   │   │   └── useOfflineSync.js      # Hook de sincronização offline
│   │   │
│   │   ├── lib/
│   │   │   ├── api.js                 # Cliente API
│   │   │   ├── auth.js                # Autenticação
│   │   │   ├── storage.js             # Storage local
│   │   │   └── sync.js                # Sincronização
│   │   │
│   │   └── App.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── mobile/                            # App Mobile (React Native/Expo)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── AuthScreen.js
│   │   │   ├── DashboardScreen.js
│   │   │   ├── modules/
│   │   │   │   ├── ComandaScreen.js
│   │   │   │   ├── PagamentoScreen.js
│   │   │   │   └── EstoqueScreen.js
│   │   │   └── OfflineScreen.js
│   │   │
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── storage.js             # WatermelonDB
│   │   │   └── sync.js                # Sincronização offline
│   │   │
│   │   └── App.js
│   │
│   ├── app.json
│   └── package.json
│
├── docs/                              # Documentação
│   ├── ARCHITECTURE.md
│   ├── MODULES.md
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── MONETIZATION.md
│
├── tests/                             # Testes
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── cloudbuild.yaml
│
└── README.md
```

---

## 3. Módulos Disponíveis

### 3.1 Módulo CORE (Obrigatório)

**Funcionalidades:**
- Autenticação e autorização (JWT, OAuth, SAML)
- Multi-tenant com isolamento de dados
- NFC-e homologada para todas as UFs
- Integração com múltiplas adquirentes (Stone, Cielo, PagBank, Mercado Pago)
- Pix dinâmico com QR code
- Controle de estoque por dose e ficha técnica
- Auditoria completa e LGPD
- Relatórios básicos

**Preço:** R$ 99/mês (base para todos os clientes)

### 3.2 Módulo BAR

**Funcionalidades:**
- Comanda eletrônica com divisão de conta
- Fechamento por mesa
- Kitchen Display System (KDS)
- Impressora de cozinha/bar
- Controle de bebidas por dose
- Ficha técnica de drinks com custo

**Preço:** R$ 149/mês (adicional ao CORE)

### 3.3 Módulo LOJA

**Funcionalidades:**
- PDV (Ponto de Venda)
- Gestão de vendas
- Comissões de vendedores
- Promoções e descontos
- Relatórios de vendas

**Preço:** R$ 129/mês (adicional ao CORE)

### 3.4 Módulo BARBEARIA

**Funcionalidades:**
- Agendamentos online
- Gestão de serviços
- Gestão de clientes
- Programa de fidelização
- Notificações de agendamento

**Preço:** R$ 99/mês (adicional ao CORE)

### 3.5 Módulo SUPERMERCADO

**Funcionalidades:**
- Caixas de autoatendimento
- Pesagem de produtos
- Promoções e cupons
- Cupom fiscal integrado
- Controle de preços por categoria

**Preço:** R$ 199/mês (adicional ao CORE)

### 3.6 Módulo CLUBE

**Funcionalidades:**
- Gestão de eventos
- Gestão de membros
- Reservas de espaço
- Cobranças de mensalidades
- Relatórios de associados

**Preço:** R$ 149/mês (adicional ao CORE)

### 3.7 Módulo RESTAURANTE

**Funcionalidades:**
- Comanda eletrônica
- Gestão de mesas
- Integração com delivery
- Controle de receitas
- Relatórios de faturamento

**Preço:** R$ 179/mês (adicional ao CORE)

---

## 4. Fluxo de Dados Multi-Tenant

### 4.1 Isolamento de Dados

Cada tenant (cliente) possui:
- **Database Schema Separado** ou **Row-Level Security (RLS)** no PostgreSQL
- **Chave de Tenant** em cada requisição HTTP
- **Middleware de Validação** que valida se o usuário tem acesso ao tenant

```javascript
// Exemplo: Middleware de Tenant
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] || req.user.tenantId;
  
  if (!tenantId) {
    return res.status(401).json({ error: 'Tenant ID required' });
  }
  
  // Validar se o usuário tem acesso a este tenant
  if (req.user.tenants.indexOf(tenantId) === -1) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  req.tenantId = tenantId;
  next();
});
```

### 4.2 Roteamento de Módulos

Cada módulo é ativado dinamicamente baseado na assinatura do cliente:

```javascript
// Exemplo: Roteador de módulos
const moduleRouter = express.Router();

// Carregar módulos ativados para o tenant
const activeModules = await getActiveModules(tenantId);

if (activeModules.includes('bar')) {
  moduleRouter.use('/bar', require('./modules/bar/routes'));
}

if (activeModules.includes('loja')) {
  moduleRouter.use('/loja', require('./modules/loja/routes'));
}

if (activeModules.includes('barbearia')) {
  moduleRouter.use('/barbearia', require('./modules/barbearia/routes'));
}

app.use('/api', moduleRouter);
```

---

## 5. Modelo de Assinatura e Faturamento

### 5.1 Planos

| Plano | Módulos Inclusos | Preço Mensal | Usuários | Suporte |
|------|-----------------|-------------|---------|---------|
| **Starter** | CORE + 1 módulo | R$ 199 | 3 | Email |
| **Professional** | CORE + 3 módulos | R$ 449 | 10 | Email + Chat |
| **Enterprise** | CORE + Todos | R$ 999 | Ilimitado | 24/7 |
| **Custom** | À negociar | À negociar | À negociar | Dedicado |

### 5.2 Faturamento Adicional

- **Transações de Pagamento:** 1,5% + R$ 0,30 por transação
- **NFC-e Emitidas:** R$ 0,05 por NFC-e
- **Usuários Adicionais:** R$ 29/mês por usuário
- **Armazenamento Extra:** R$ 0,50/GB/mês

---

## 6. Fluxo de Integração de Novo Cliente

### Passo 1: Cadastro e Criação de Tenant

```javascript
POST /api/admin/tenants
{
  "razao_social": "Bar do João",
  "cnpj": "12345678000190",
  "email": "admin@bardojoao.com.br",
  "tipo_negocio": "bar",
  "modulos_desejados": ["core", "bar"]
}
```

### Passo 2: Provisão de Recursos

- Criar schema no PostgreSQL (ou aplicar RLS)
- Criar bucket no Cloud Storage para arquivos
- Criar chave de API para integrações
- Enviar credenciais de acesso por email

### Passo 3: Configuração Inicial

- Importar catálogo de produtos
- Configurar adquirentes de pagamento
- Configurar certificado A1 e CSC (para NFC-e)
- Criar usuários iniciais

### Passo 4: Ativação

- Enviar link de primeiro acesso
- Criar comanda/mesa iniciais
- Testar fluxo de comanda → pagamento → NFC-e

---

## 7. Sincronização Offline

### 7.1 Estratégia

Cada cliente pode usar a aplicação offline (sem internet) e sincronizar quando a conexão retornar:

```javascript
// Cliente offline
const offlineStorage = new WatermelonDB({
  database: 'setpoint_offline',
  tables: [
    'comandas',
    'itens_comanda',
    'pagamentos',
    'estoque'
  ]
});

// Quando online, sincronizar
offlineStorage.sync({
  serverUrl: 'https://api.setpoint.com.br',
  tenantId: 'tenant-123',
  token: 'jwt-token'
});
```

### 7.2 Conflitos de Sincronização

- **Last-Write-Wins:** Timestamp mais recente prevalece
- **Merge Manual:** Para operações críticas (NFC-e, pagamento)
- **Fila de Reprocessamento:** Para operações que falharam

---

## 8. Segurança e Compliance

### 8.1 Autenticação

- JWT com refresh token (15 min + 7 dias)
- OAuth 2.0 para integrações
- SAML para clientes enterprise
- 2FA opcional

### 8.2 Autorização

- RBAC (Role-Based Access Control)
- Roles: Admin, Gerente, Vendedor, Garçom, Barbeiro
- Permissões granulares por módulo

### 8.3 Criptografia

- TLS 1.3 para todas as comunicações
- AES-256 para dados sensíveis (certificado A1, CSC)
- Hash bcrypt para senhas

### 8.4 Compliance

- LGPD: Direito ao esquecimento, portabilidade de dados
- PCI-DSS: Nunca armazenar dados de cartão
- NFC-e: Conformidade com SEFAZ

---

## 9. Roadmap de Desenvolvimento

### Fase 1 (Semanas 1-2): Core + Infraestrutura
- [ ] Setup PostgreSQL multi-tenant
- [ ] Implementar autenticação e RBAC
- [ ] Criar middleware de tenant
- [ ] Implementar NFC-e multi-UF
- [ ] Integrar pagamentos (Stone, Cielo, PagBank)

### Fase 2 (Semanas 3-4): Módulo BAR
- [ ] Comanda eletrônica
- [ ] Divisão de conta
- [ ] KDS (Kitchen Display System)
- [ ] Integração com impressora

### Fase 3 (Semanas 5-6): Módulos LOJA + BARBEARIA
- [ ] PDV e gestão de vendas
- [ ] Agendamentos e fidelização
- [ ] Comissões de vendedores

### Fase 4 (Semanas 7-8): App Mobile + Sincronização Offline
- [ ] React Native/Expo
- [ ] WatermelonDB
- [ ] Sincronização resiliente
- [ ] Modo offline completo

### Fase 5 (Semanas 9-10): Faturamento e Marketplace
- [ ] Sistema de assinatura (Stripe)
- [ ] Marketplace de módulos
- [ ] Dashboard de faturamento
- [ ] Relatórios de uso

### Fase 6 (Semanas 11-12): Testes e Deploy
- [ ] Testes automatizados (Jest, Supertest)
- [ ] Testes de carga (k6)
- [ ] Deploy no GCP Cloud Run
- [ ] Monitoramento e alertas

---

## 10. Stack Tecnológico

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Backend** | Node.js + Express | Performance, escalabilidade |
| **Banco de Dados** | PostgreSQL | Multi-tenant, RLS, JSONB |
| **Cache** | Redis | Sessões, cache de dados |
| **Frontend Web** | React 18 + Vite | Performance, DX |
| **Frontend Mobile** | React Native + Expo | iOS + Android com código único |
| **Storage Offline** | WatermelonDB | Sincronização eficiente |
| **Fila de Processamento** | Bull (Redis) | Processamento assíncrono |
| **NFC-e** | Focus NFe + PlugNotas | Redundância, confiabilidade |
| **Pagamentos** | Stone + Cielo + PagBank | Cobertura nacional |
| **Cloud** | Google Cloud Platform | Escalabilidade, confiabilidade |
| **CI/CD** | Cloud Build + Cloud Run | Deploy automático |
| **Monitoramento** | Cloud Logging + Cloud Monitoring | Observabilidade |

---

## 11. Próximos Passos

1. **Validar com stakeholders** a arquitetura proposta
2. **Criar protótipo** do módulo BAR (MVP)
3. **Implementar Core** com autenticação e multi-tenant
4. **Testar com cliente piloto** (bar real)
5. **Iterar baseado em feedback**
6. **Expandir para outros módulos**
7. **Lançar marketplace** de módulos

---

**Documento preparado por:** Manus AI  
**Data:** 26 de julho de 2026  
**Status:** Pronto para Implementação
