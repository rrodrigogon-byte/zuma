# SetPoint Ultra - Plataforma SaaS Modular

**SetPoint Ultra** é uma plataforma SaaS de gestão completa para bares, restaurantes, lojas, barbearias, supermercados e clubes. Desenvolvida com tecnologia enterprise-grade, oferece NFC-e multi-UF, integrações de pagamento multiadquirente, app mobile offline e relatórios BI em tempo real.

## 🚀 Características Principais

### Fiscal
- ✅ **NFC-e Multi-UF** (27 estados) com contingência offline
- ✅ **NF-e** para operações de entrada/saída
- ✅ **Adaptadores** Focus NFe + PlugNotas (fallback)
- ✅ **Emissão automática** integrada com vendas
- ✅ **Reprocessamento** de documentos em contingência

### Pagamentos
- ✅ **TEF** com máquinas físicas (Gertec, Ingenico, Verifone)
- ✅ **Stone** (cartão crédito/débito, Pix)
- ✅ **Cielo** (cartão crédito/débito, TEF)
- ✅ **PagBank** (Pix, cartão)
- ✅ **Mercado Pago** (cartão, Pix)
- ✅ **Dinheiro** com sangria/suprimento
- ✅ **Fallback automático** entre adquirentes

### Operação
- ✅ **Comanda eletrônica** com divisão de conta
- ✅ **Kitchen Display System (KDS)** para cozinha
- ✅ **PDV** com múltiplos caixas e operadores
- ✅ **Estoque** com entrada, saída, ajuste, inventário cíclico
- ✅ **Fichas técnicas** de drinks e receitas
- ✅ **Rastreabilidade** por lote, validade, origem

### Offline
- ✅ **App mobile** (React Native + Expo)
- ✅ **WatermelonDB** para sincronização offline
- ✅ **Fila de operações** com retry automático
- ✅ **Detecção automática** de conexão
- ✅ **Exponential backoff** para sincronização

### Faturamento
- ✅ **Stripe** para assinaturas
- ✅ **Mercado Pago** como alternativa
- ✅ **Planos modulares** (Core + módulos adicionais)
- ✅ **Webhooks** para eventos de pagamento
- ✅ **Reconciliação automática**

### Relatórios
- ✅ **Dashboard executivo** em tempo real
- ✅ **Vendas por período** (dia, semana, mês)
- ✅ **Produtos mais vendidos**
- ✅ **Estoque crítico**
- ✅ **Performance de operadores**
- ✅ **Margem de lucro**

### Segurança
- ✅ **PCI-DSS** para dados de cartão
- ✅ **LGPD** com consentimento e direito ao esquecimento
- ✅ **Criptografia AES-256-GCM**
- ✅ **Tokenização de cartões**
- ✅ **Auditoria completa** de operações
- ✅ **JWT** para autenticação

## 📦 Arquitetura

```
SetPoint Ultra
├── Core (Compartilhado)
│   ├── Autenticação (JWT + RBAC)
│   ├── Multi-tenant
│   ├── PostgreSQL
│   ├── NFC-e/NF-e
│   ├── Pagamentos
│   └── Segurança
├── Módulos
│   ├── BAR (Comanda, KDS, divisão)
│   ├── LOJA (PDV, vendas, comissões)
│   ├── BARBEARIA (Agendamentos, serviços)
│   ├── SUPERMERCADO (Autoatendimento, pesagem)
│   ├── CLUBE (Eventos, membros, reservas)
│   └── RESTAURANTE (Comanda, delivery)
├── App Mobile (React Native + Expo)
├── Dashboard (React + Vite)
└── Infraestrutura
    ├── PostgreSQL
    ├── Redis
    ├── Docker
    ├── Kubernetes
    └── GCP Cloud Run
```

## 🛠️ Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | Node.js 18 + Express |
| **Banco de Dados** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Frontend** | React 18 + Vite |
| **Mobile** | React Native + Expo |
| **Offline** | WatermelonDB |
| **Fila** | Bull + Redis |
| **Autenticação** | JWT + bcrypt |
| **Pagamentos** | Stripe + Mercado Pago |
| **Fiscal** | Focus NFe + PlugNotas |
| **Containerização** | Docker + Kubernetes |
| **CI/CD** | GitHub Actions + GCP Cloud Build |
| **Testes** | Jest + Supertest |
| **Documentação** | OpenAPI/Swagger |

## 📋 Instalação

### Pré-requisitos
- Node.js 18+
- Docker + Docker Compose
- PostgreSQL 15
- Redis 7

### Setup Local

```bash
# Clonar repositório
git clone https://github.com/rrodrigogon-byte/agro-open.git
cd agro-open

# Instalar dependências backend
cd app
npm install

# Instalar dependências frontend
cd ../web
npm install

# Instalar dependências mobile
cd ../mobile
npm install

# Voltar para raiz
cd ..

# Criar arquivo .env
cp .env.example .env

# Iniciar com Docker Compose
docker-compose up -d

# Executar migrações
docker-compose exec api npm run migrate

# Iniciar servidor
npm run dev
```

### Variáveis de Ambiente

```bash
# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=setpoint_ultra
DB_USER=setpoint
DB_PASSWORD=senha_segura

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=sua_chave_secreta_aqui

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Focus NFe
FOCUS_API_KEY=sua_chave_api

# Stone
STONE_API_KEY=sua_chave_api

# Cielo
CIELO_MERCHANT_ID=seu_id
CIELO_MERCHANT_KEY=sua_chave

# PagBank
PAGBANK_TOKEN=seu_token

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=seu_token

# GCP
GCP_PROJECT_ID=seu_projeto
GCS_BUCKET=seu_bucket
```

## 🚀 Deploy

### GCP Cloud Run

```bash
# Autenticar com GCP
gcloud auth login

# Fazer deploy
gcloud run deploy setpoint-ultra \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production

# URL de produção
https://setpoint-ultra-prod.run.app
```

### GitHub Actions

O repositório inclui CI/CD automático com:
- Testes automatizados
- Lint de código
- Build da imagem Docker
- Push para GCR
- Deploy no Cloud Run

## 📚 Documentação

### API
- **OpenAPI/Swagger:** http://localhost:3000/api-docs
- **Postman Collection:** `docs/postman-collection.json`

### Guias
- [Guia de Implementação](./GUIA-IMPLEMENTACAO-CODIGO.md)
- [Arquitetura SaaS](./ARQUITETURA-SAAS-MODULAR.md)
- [Evolução Fiscal e Pagamentos](./EVOLUCAO-FISCAL-NACIONAL-E-PAGAMENTOS.md)

## 🧪 Testes

```bash
# Executar testes
npm test

# Testes com cobertura
npm run test:coverage

# Testes E2E
npm run test:e2e

# Lint
npm run lint
```

## 📊 Monitoramento

### Logs
```bash
# Ver logs em tempo real
docker-compose logs -f api

# Ver logs de erro
docker-compose logs api | grep ERROR
```

### Métricas
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001

## 🔐 Segurança

### Checklist
- [ ] Alterar JWT_SECRET em produção
- [ ] Configurar HTTPS/SSL
- [ ] Habilitar firewall
- [ ] Configurar backups automáticos
- [ ] Ativar logs de auditoria
- [ ] Validar conformidade PCI-DSS
- [ ] Testar contingência offline
- [ ] Documentar plano de recuperação

## 💳 Configuração de Pagamentos

### Stone
1. Criar conta em https://www.stone.com.br
2. Obter API Key
3. Configurar em `.env`

### Cielo
1. Criar conta em https://www.cielo.com.br
2. Obter Merchant ID e Key
3. Configurar em `.env`

### PagBank
1. Criar conta em https://www.pagbank.com.br
2. Obter token
3. Configurar em `.env`

## 📱 App Mobile

### Build para iOS
```bash
cd mobile
eas build --platform ios
```

### Build para Android
```bash
cd mobile
eas build --platform android
```

### Publicar
```bash
eas submit --platform ios
eas submit --platform android
```

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

- **Email:** support@setpoint-ultra.com.br
- **Documentação:** https://docs.setpoint-ultra.com.br
- **Status:** https://status.setpoint-ultra.com.br

## 📄 Licença

Proprietary - Todos os direitos reservados

## 🙏 Agradecimentos

Desenvolvido com ❤️ para a comunidade de negócios brasileiros.

---

**SetPoint Ultra** - Gestão Completa para Seu Negócio
