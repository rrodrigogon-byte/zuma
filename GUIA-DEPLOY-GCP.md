# 🚀 GUIA DE DEPLOY - KYTTO ERP NO GCP CLOUD RUN

## Pré-requisitos

1. **Conta GCP** com projeto criado
2. **gcloud CLI** instalado e configurado
3. **Docker** instalado localmente
4. **GitHub** com repositório agro-open
5. **Credenciais** de banco de dados PostgreSQL

---

## Passo 1: Preparar o Ambiente GCP

### 1.1 Configurar projeto GCP

```bash
# Definir projeto
gcloud config set project kytto-erp-prod

# Ativar APIs necessárias
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable container.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
```

### 1.2 Criar instância PostgreSQL

```bash
# Criar instância Cloud SQL
gcloud sql instances create kytto-pg-prod \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --backup-start-time=02:00

# Criar banco de dados
gcloud sql databases create kytto_erp \
  --instance=kytto-pg-prod

# Criar usuário
gcloud sql users create kytto_user \
  --instance=kytto-pg-prod \
  --password=SENHA_SEGURA_AQUI
```

### 1.3 Criar instância Redis

```bash
gcloud redis instances create kytto-redis-prod \
  --size=1 \
  --region=us-central1 \
  --tier=basic
```

---

## Passo 2: Preparar o Código

### 2.1 Atualizar variáveis de ambiente

Criar arquivo `.env.production`:

```env
# Banco de dados
DATABASE_URL=postgresql://kytto_user:SENHA@kytto-pg-prod:5432/kytto_erp
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://kytto-redis-prod:6379

# JWT
JWT_SECRET=sua_chave_secreta_super_segura_aqui
JWT_EXPIRY=24h

# NFC-e
NFCE_PROVIDER=focus
FOCUS_API_KEY=sua_chave_focus_aqui
FOCUS_API_SECRET=seu_secret_focus_aqui

# Pagamentos
STONE_API_KEY=sua_chave_stone_aqui
CIELO_MERCHANT_ID=seu_merchant_id_cielo
PAGBANK_TOKEN=seu_token_pagbank_aqui

# Stripe
STRIPE_SECRET_KEY=sk_live_sua_chave_stripe_aqui
STRIPE_PUBLIC_KEY=pk_live_sua_chave_publica_aqui

# Mercado Pago
MERCADO_PAGO_TOKEN=seu_token_mercado_pago_aqui

# App
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
```

### 2.2 Atualizar Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código
COPY . .

# Expor porta
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Iniciar aplicação
CMD ["node", "app/server-v2.js"]
```

---

## Passo 3: Build e Deploy

### 3.1 Build local (opcional)

```bash
# Build Docker local
docker build -t kytto-erp:latest .

# Testar localmente
docker run -p 8080:8080 \
  --env-file .env.production \
  kytto-erp:latest
```

### 3.2 Push para Google Container Registry

```bash
# Configurar Docker para GCP
gcloud auth configure-docker

# Tag da imagem
docker tag kytto-erp:latest gcr.io/kytto-erp-prod/kytto-erp:latest

# Push
docker push gcr.io/kytto-erp-prod/kytto-erp:latest
```

### 3.3 Deploy no Cloud Run

```bash
gcloud run deploy kytto-erp \
  --image gcr.io/kytto-erp-prod/kytto-erp:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 100 \
  --set-env-vars DATABASE_URL=postgresql://kytto_user:SENHA@kytto-pg-prod:5432/kytto_erp \
  --set-env-vars REDIS_URL=redis://kytto-redis-prod:6379 \
  --set-env-vars JWT_SECRET=sua_chave_secreta_aqui \
  --set-env-vars NODE_ENV=production
```

---

## Passo 4: Executar Migrações

### 4.1 Conectar ao banco de dados

```bash
# Obter IP da instância Cloud SQL
INSTANCE_IP=$(gcloud sql instances describe kytto-pg-prod --format='value(ipAddresses[0].ipAddress)')

# Conectar via psql (requer psql instalado localmente)
psql -h $INSTANCE_IP -U kytto_user -d kytto_erp -f app/migrations/001_erp_foundation.sql
```

### 4.2 Executar script de migração

```bash
# Via Cloud Run job (recomendado)
gcloud run jobs create kytto-migrate \
  --image gcr.io/kytto-erp-prod/kytto-erp:latest \
  --region us-central1 \
  --set-env-vars DATABASE_URL=postgresql://kytto_user:SENHA@kytto-pg-prod:5432/kytto_erp \
  --command node \
  --args app/migrations/migrate-json-to-pg.js

# Executar job
gcloud run jobs execute kytto-migrate --region us-central1
```

---

## Passo 5: Configurar CI/CD com GitHub Actions

Criar arquivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy Kytto ERP

on:
  push:
    branches: [main]

env:
  PROJECT_ID: kytto-erp-prod
  REGION: us-central1
  IMAGE_NAME: kytto-erp

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          export_default_credentials: true

      - name: Configure Docker
        run: gcloud auth configure-docker

      - name: Build Docker image
        run: |
          docker build -t gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:${{ github.sha }} .
          docker tag gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:${{ github.sha }} gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:latest

      - name: Push to Container Registry
        run: |
          docker push gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          docker push gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.IMAGE_NAME }} \
            --image gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed \
            --allow-unauthenticated
```

---

## Passo 6: Monitoramento e Logs

### 6.1 Ver logs em tempo real

```bash
gcloud run logs read kytto-erp --region us-central1 --limit 50 --follow
```

### 6.2 Configurar alertas

```bash
# Criar notificação de erro
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Kytto ERP - Erros" \
  --condition-display-name="Taxa de erro > 5%" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s
```

### 6.3 Dashboard no Cloud Monitoring

```bash
# Acessar
https://console.cloud.google.com/monitoring/dashboards
```

---

## Passo 7: Backup e Recuperação

### 7.1 Configurar backups automáticos

```bash
# Backup automático diário
gcloud sql backups create \
  --instance=kytto-pg-prod \
  --description="Backup diário Kytto ERP"
```

### 7.2 Restaurar backup

```bash
# Listar backups
gcloud sql backups list --instance=kytto-pg-prod

# Restaurar
gcloud sql backups restore BACKUP_ID \
  --backup-instance=kytto-pg-prod
```

---

## Passo 8: Segurança

### 8.1 Configurar SSL/TLS

```bash
# Gerar certificado (via Cloud Armor)
gcloud compute security-policies create kytto-policy \
  --description="Política de segurança Kytto ERP"
```

### 8.2 Configurar firewall

```bash
# Restringir acesso
gcloud sql instances patch kytto-pg-prod \
  --denied-networks="" \
  --allowed-networks=0.0.0.0/0
```

---

## URLs de Produção

- **API:** https://kytto-erp-XXXXX.run.app
- **Health Check:** https://kytto-erp-XXXXX.run.app/health
- **Admin:** https://kytto-erp-XXXXX.run.app/admin
- **Logs:** https://console.cloud.google.com/run/detail/us-central1/kytto-erp

---

## Troubleshooting

### Problema: Erro de conexão com banco de dados

```bash
# Verificar status da instância
gcloud sql instances describe kytto-pg-prod

# Verificar conexão
gcloud sql connect kytto-pg-prod --user=postgres
```

### Problema: Cloud Run timeout

```bash
# Aumentar timeout
gcloud run services update kytto-erp \
  --timeout 600 \
  --region us-central1
```

### Problema: Falta de memória

```bash
# Aumentar memória
gcloud run services update kytto-erp \
  --memory 1Gi \
  --region us-central1
```

---

## Suporte

- **Documentação GCP:** https://cloud.google.com/run/docs
- **Suporte Kytto:** support@kytto.com.br

---

**Kytto ERP © 2024**
