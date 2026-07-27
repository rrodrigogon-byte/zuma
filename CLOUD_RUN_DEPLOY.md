# Guia de Deploy no Google Cloud Run — Kytto ERP v2.1.0

**Data**: 27 de julho de 2026  
**Versão**: 2.1.0  
**Status**: ✅ Pronto para publicação  
**Repositório**: [GitHub — agro-open](https://github.com/rrodrigogon-byte/agro-open)

---

## 📋 Pré-requisitos

Antes de iniciar o deploy, certifique-se de que você possui:

1. **Google Cloud SDK** instalado e configurado
   ```bash
   gcloud --version
   gcloud auth login
   ```

2. **Acesso ao Projeto GCP**: `avd-uisa-sistema-vision`
   ```bash
   gcloud config set project avd-uisa-sistema-vision
   ```

3. **Docker** instalado (opcional, para build local)
   ```bash
   docker --version
   ```

4. **Credenciais do GitHub** (para clonar o repositório)
   ```bash
   git config --global user.name "seu-nome"
   git config --global user.email "seu-email@example.com"
   ```

5. **Cloud SQL** já configurado com banco PostgreSQL
   - Host: `10.0.0.2` (ou IP do Cloud SQL)
   - Banco: `kytto_erp`
   - Usuário: `kytto_user`
   - Senha: (configurada no Cloud SQL)

---

## 🚀 Passo 1: Configurar o GCP

### 1.1 Autenticar no GCP
```bash
gcloud auth login
gcloud config set project avd-uisa-sistema-vision
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 1.2 Criar o repositório no Artifact Registry (se não existir)
```bash
gcloud artifacts repositories create kytto-erp \
  --repository-format=docker \
  --location=us-central1 \
  --description="Kytto ERP - Docker images"
```

---

## 🐳 Passo 2: Build da Imagem Docker

### Opção A: Build via Cloud Build (Recomendado)
```bash
cd /home/ubuntu/agro-open

gcloud builds submit \
  --tag us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0 \
  --timeout=1800s
```

### Opção B: Build Local + Push
```bash
# Build local
docker build -t us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0 .

# Push para Artifact Registry
docker push us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0
```

---

## 🚢 Passo 3: Deploy no Cloud Run

### 3.1 Preparar Variáveis de Ambiente

Crie um arquivo `.env.production` com as variáveis necessárias:

```bash
NODE_ENV=production
PORT=8080
DB_HOST=10.0.0.2
DB_PORT=5432
DB_NAME=kytto_erp
DB_USER=kytto_user
DB_PASSWORD=<sua-senha-segura>
JWT_SECRET=<chave-aleatória-segura>
CORS_ORIGIN=https://kytto.example.com
LOG_LEVEL=info
```

### 3.2 Deploy no Cloud Run

```bash
gcloud run deploy kytto-erp \
  --image us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,DB_HOST=10.0.0.2,DB_PORT=5432,DB_NAME=kytto_erp,DB_USER=kytto_user" \
  --set-secrets="DB_PASSWORD=kytto-db-password:latest,JWT_SECRET=kytto-jwt-secret:latest" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 1
```

### 3.3 Alternativa: Deploy com arquivo YAML

Crie um arquivo `cloud-run-config.yaml`:

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: kytto-erp
  namespace: default
spec:
  template:
    spec:
      containers:
      - image: us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          value: "10.0.0.2"
        - name: DB_PORT
          value: "5432"
        - name: DB_NAME
          value: "kytto_erp"
        - name: DB_USER
          value: "kytto_user"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: kytto-db-password
              key: password
        resources:
          limits:
            memory: "2Gi"
            cpu: "2"
      timeoutSeconds: 3600
```

Deploy com YAML:
```bash
gcloud run services replace cloud-run-config.yaml --region us-central1
```

---

## 🔐 Passo 4: Configurar Secrets no GCP

### 4.1 Criar Secrets no Secret Manager

```bash
# Senha do banco de dados
echo -n "sua-senha-segura" | gcloud secrets create kytto-db-password --data-file=-

# JWT Secret
echo -n "sua-chave-jwt-aleatória" | gcloud secrets create kytto-jwt-secret --data-file=-
```

### 4.2 Conceder Acesso ao Cloud Run

```bash
# Obter a service account do Cloud Run
PROJECT_ID=$(gcloud config get-value project)
CLOUD_RUN_SA="${PROJECT_ID}@appspot.gserviceaccount.com"

# Conceder acesso aos secrets
gcloud secrets add-iam-policy-binding kytto-db-password \
  --member=serviceAccount:${CLOUD_RUN_SA} \
  --role=roles/secretmanager.secretAccessor

gcloud secrets add-iam-policy-binding kytto-jwt-secret \
  --member=serviceAccount:${CLOUD_RUN_SA} \
  --role=roles/secretmanager.secretAccessor
```

---

## 📊 Passo 5: Executar Migrações SQL

Após o deploy bem-sucedido, execute as migrações SQL:

### 5.1 Conectar ao Cloud SQL

```bash
gcloud sql connect kytto-db --user=postgres
```

### 5.2 Executar Migrações

```sql
-- Migração 017: Barbearia
\i app/migrations/017_barbearia_evolucao.sql

-- Migração 018: Supermercado
\i app/migrations/018_supermercado_evolucao.sql

-- Verificar tabelas criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

---

## ✅ Passo 6: Validar Deploy

### 6.1 Verificar Status do Serviço

```bash
gcloud run services describe kytto-erp --region us-central1
```

### 6.2 Testar Endpoint de Saúde

```bash
# Obter URL do serviço
SERVICE_URL=$(gcloud run services describe kytto-erp --region us-central1 --format='value(status.url)')

# Testar healthcheck
curl ${SERVICE_URL}/health

# Resposta esperada:
# {"status":"ok","version":"2.1.0","timestamp":"2026-07-27T..."}
```

### 6.3 Visualizar Logs

```bash
gcloud run logs read kytto-erp --region us-central1 --limit 50
```

---

## 🔄 Passo 7: Configurar CI/CD (Opcional)

### 7.1 Criar Cloud Build Trigger

```bash
gcloud builds triggers create github \
  --repo-name=agro-open \
  --repo-owner=rrodrigogon-byte \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --name=kytto-erp-deploy
```

### 7.2 Criar arquivo `cloudbuild.yaml`

```yaml
steps:
  # Build da imagem Docker
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/kytto-erp/app:$SHORT_SHA'
      - '-t'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/kytto-erp/app:latest'
      - '.'

  # Push para Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/kytto-erp/app:$SHORT_SHA'

  # Deploy no Cloud Run
  - name: 'gcr.io/cloud-builders/gke-deploy'
    args:
      - run
      - --filename=.
      - --image=us-central1-docker.pkg.dev/$PROJECT_ID/kytto-erp/app:$SHORT_SHA
      - --location=us-central1
      - --namespace=default

images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/kytto-erp/app:$SHORT_SHA'
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/kytto-erp/app:latest'

options:
  machineType: 'N1_HIGHCPU_8'
```

---

## 🚨 Passo 8: Monitoramento e Alertas

### 8.1 Criar Dashboard no Cloud Monitoring

```bash
gcloud monitoring dashboards create --config-from-file=- << 'DASHBOARD'
{
  "displayName": "Kytto ERP - Monitoring",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Request Rate",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"kytto-erp\""
                }
              }
            }]
          }
        }
      }
    ]
  }
}
DASHBOARD
```

### 8.2 Criar Alertas

```bash
# Alerta para erro 5xx
gcloud alpha monitoring policies create \
  --notification-channels=<CHANNEL_ID> \
  --display-name="Kytto ERP - 5xx Errors" \
  --condition-display-name="High error rate"
```

---

## 🔙 Rollback (se necessário)

### 9.1 Listar Revisões

```bash
gcloud run revisions list --service=kytto-erp --region=us-central1
```

### 9.2 Fazer Rollback

```bash
# Redirecionar 100% do tráfego para revisão anterior
gcloud run services update-traffic kytto-erp \
  --to-revisions <REVISION_ID>=100 \
  --region us-central1
```

---

## 📝 Checklist de Deploy

- ✅ GCP autenticado e configurado
- ✅ Artifact Registry criado
- ✅ Imagem Docker buildada e publicada
- ✅ Secrets configurados no Secret Manager
- ✅ Cloud Run service deployado
- ✅ Migrações SQL executadas
- ✅ Healthcheck respondendo
- ✅ Logs verificados
- ✅ Monitoramento configurado
- ✅ Alertas ativados

---

## 📞 Suporte

- **Documentação GCP**: [Cloud Run Docs](https://cloud.google.com/run/docs)
- **Repositório**: [GitHub — agro-open](https://github.com/rrodrigogon-byte/agro-open)
- **Issues**: Abra uma issue no GitHub

---

**Versão**: 2.1.0  
**Data**: 27 de julho de 2026  
**Status**: ✅ Pronto para Produção
