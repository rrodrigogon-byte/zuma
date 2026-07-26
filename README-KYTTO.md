# 🚀 Kytto ERP - Sistema Modular Brasileiro

**Kytto** é um **ERP modular, escalável e 100% brasileiro** desenvolvido para gerenciar negócios de qualquer tamanho: bares, restaurantes, clubes, lojas, barbearias, supermercados e comércio em geral.

## 📋 Características Principais

### 🔐 Segurança e Conformidade
- ✅ **PCI-DSS** para processamento de cartões
- ✅ **LGPD** com direito ao esquecimento
- ✅ **Auditoria completa** de todas as operações
- ✅ **Criptografia AES-256** de dados sensíveis
- ✅ **Multi-tenant** com isolamento de dados

### 💰 Fiscal e Pagamentos
- ✅ **NFC-e** em 27 UFs com contingência offline
- ✅ **NF-e** para vendas B2B
- ✅ **Múltiplas adquirentes**: Stone, Cielo, PagBank, Mercado Pago
- ✅ **TEF** com máquinas físicas (Gertec, Ingenico, Verifone)
- ✅ **Pix dinâmico** com QR Code
- ✅ **Dinheiro** com cálculo automático de troco

### 📦 Estoque e Inventário
- ✅ **Entrada/Saída** com rastreabilidade completa
- ✅ **FIFO** automático
- ✅ **Inventário cíclico** com divergências
- ✅ **Fichas técnicas** de drinks e receitas
- ✅ **Controle por dose** para bares
- ✅ **Lote e validade** com alertas

### 💳 PDV Completo
- ✅ **Múltiplos caixas** por turno
- ✅ **Comanda eletrônica** com divisão de conta
- ✅ **Kitchen Display System (KDS)**
- ✅ **Sangria e suprimento** de caixa
- ✅ **Fechamento** com reconciliação

### 📱 App Mobile Offline
- ✅ **React Native + Expo**
- ✅ **WatermelonDB** para sincronização offline
- ✅ **Operação 100% offline**
- ✅ **Sincronização automática** quando conectado
- ✅ **Garçom, vendedor, operador**

### 🎯 Módulos Setoriais
- ✅ **BAR**: Comanda, KDS, divisão de conta
- ✅ **RESTAURANTE**: Comanda, mesas, delivery
- ✅ **CLUBE**: Eventos, membros, mensalidades
- ✅ **LOJA**: PDV, vendas, comissões
- ✅ **BARBEARIA**: Agendamentos, serviços
- ✅ **SUPERMERCADO**: Autoatendimento, pesagem

### 📊 Relatórios e BI
- ✅ **Dashboard executivo** em tempo real
- ✅ **Vendas por operador, produto, forma de pagamento**
- ✅ **Estoque e inventário**
- ✅ **Previsões** com machine learning
- ✅ **Exportação** em Excel/PDF

### 💳 Faturamento SaaS
- ✅ **Stripe** para cartão de crédito
- ✅ **Mercado Pago** para Pix
- ✅ **Planos modulares** por segmento
- ✅ **Webhooks** para confirmação de pagamento
- ✅ **Reconciliação automática**

---

## 🏗️ Arquitetura

```
Kytto ERP
├── Backend (Node.js + Express)
│   ├── Core (Auth, Multi-tenant, DB)
│   ├── Adaptadores (NFC-e, Pagamentos, TEF)
│   ├── Módulos (PDV, Estoque, Pagamentos, NFC-e)
│   └── Verticais (Bar, Restaurante, Clube, Loja, Barbearia, Supermercado)
├── Frontend (React + Vite)
│   ├── Dashboard
│   ├── PDV
│   ├── Estoque
│   └── Relatórios
├── Mobile (React Native + Expo)
│   ├── Garçom
│   ├── Vendedor
│   └── Operador
└── Infraestrutura (GCP)
    ├── Cloud Run (API)
    ├── PostgreSQL (Banco de dados)
    ├── Redis (Cache)
    └── Cloud Storage (Arquivos)
```

---

## 📊 Estatísticas

| Métrica | Valor |
|---------|-------|
| **Linhas de código** | ~10.000 |
| **Endpoints API** | 50+ |
| **Tabelas PostgreSQL** | 30+ |
| **Módulos** | 6 completos |
| **Adaptadores** | 5 (NFC-e, Stone, Cielo, PagBank, TEF) |
| **Formas de pagamento** | 5 (dinheiro, cartão crédito, cartão débito, Pix, TEF) |
| **Máquinas TEF** | 3 (Gertec, Ingenico, Verifone) |
| **Cobertura fiscal** | 27 UFs |

---

## 🚀 Como Começar

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Docker (opcional)

### Instalação Local

```bash
# Clonar repositório
git clone https://github.com/kytto/kytto-erp.git
cd kytto-erp

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Executar migrações
npm run migrate

# Iniciar servidor
npm run dev
```

### Com Docker

```bash
# Iniciar ambiente completo
docker-compose up -d

# Acessar em http://localhost:3000
```

---

## 📚 Documentação

- **[API Reference](./docs/api.md)** — Documentação completa da API
- **[Guia de Instalação](./docs/instalacao.md)** — Passo a passo
- **[Guia de Configuração](./docs/configuracao.md)** — Variáveis de ambiente
- **[Guia de Desenvolvimento](./docs/desenvolvimento.md)** — Contribuindo
- **[Homologação Fiscal](./docs/homologacao-fiscal.md)** — NFC-e e NF-e

---

## 🔧 Configuração

### Variáveis de Ambiente

```env
# Banco de dados
DATABASE_URL=postgresql://user:password@localhost:5432/kytto

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=seu_secret_aqui

# NFC-e
NFCE_PROVIDER=focus  # focus ou plugnotas
NFCE_API_KEY=sua_chave_aqui
NFCE_CSC=seu_csc_aqui

# Pagamentos
STONE_API_KEY=sua_chave_aqui
CIELO_MERCHANT_ID=seu_merchant_id
PAGBANK_TOKEN=seu_token_aqui

# Pix
PIX_CHAVE=sua_chave_pix

# TEF
TEF_HOST=localhost
TEF_PORT=8005

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mercado Pago
MERCADO_PAGO_TOKEN=seu_token_aqui

# GCP
GCP_PROJECT_ID=seu_projeto
GCP_STORAGE_BUCKET=seu_bucket

# Node
NODE_ENV=production
PORT=3000
```

---

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes com cobertura
npm run test:coverage

# Testes de integração
npm run test:integration

# Testes E2E
npm run test:e2e
```

---

## 📦 Deploy

### GCP Cloud Run

```bash
# Build da imagem Docker
docker build -t kytto-erp .

# Tag para GCP
docker tag kytto-erp gcr.io/seu-projeto/kytto-erp

# Push para GCP
docker push gcr.io/seu-projeto/kytto-erp

# Deploy no Cloud Run
gcloud run deploy kytto-erp \
  --image gcr.io/seu-projeto/kytto-erp \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=... \
  --allow-unauthenticated
```

---

## 🤝 Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para diretrizes de contribuição.

---

## 📄 Licença

Propriedade da **Kytto** — Todos os direitos reservados.

---

## 📞 Suporte

- **Email**: suporte@kytto.com.br
- **Chat**: https://kytto.com.br/chat
- **Documentação**: https://docs.kytto.com.br

---

## 🎯 Roadmap

- [ ] **Q3 2024**: Homologação fiscal (NFC-e + NF-e)
- [ ] **Q4 2024**: App mobile (iOS + Android)
- [ ] **Q1 2025**: Marketplace de módulos
- [ ] **Q2 2025**: Inteligência artificial (previsões, recomendações)
- [ ] **Q3 2025**: Integração com ERPs (SAP, Totvs)

---

**Desenvolvido com ❤️ pela Kytto**
