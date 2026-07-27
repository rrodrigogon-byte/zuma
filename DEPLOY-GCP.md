# Guia de Deploy — SetPoint Ultra no Google Cloud Platform

**Versão:** 4.5.0 · **Região:** `southamerica-east1` (São Paulo) · **Última atualização:** Jul 2026

---

## Visão Geral da Arquitetura de Produção

O SetPoint Ultra é implantado como um serviço gerenciado no Google Cloud Run, conectado a um banco PostgreSQL 15 no Cloud SQL, com armazenamento de arquivos no Cloud Storage e segredos gerenciados pelo Secret Manager. O pipeline de CI/CD é executado automaticamente via Cloud Build a cada push na branch `main`.

| Componente | Serviço GCP | Configuração |
|---|---|---|
| Aplicação Backend + Frontend | Cloud Run | 1–10 instâncias, 1 vCPU, 1 GB RAM |
| Banco de Dados | Cloud SQL PostgreSQL 15 | `db-custom-1-3840`, 10 GB SSD, backup diário |
| Arquivos (certificados, XMLs) | Cloud Storage | Bucket privado com lifecycle de 5 anos |
| Segredos (senhas, chaves) | Secret Manager | Rotação automática habilitada |
| CI/CD | Cloud Build | Trigger no push da branch `main` |
| DNS e HTTPS | Cloud Run + Cloud DNS | TLS automático gerenciado pelo Google |

---

## Pré-requisitos

Antes de iniciar, você precisa ter:

1. Uma conta Google Cloud com faturamento ativo.
2. O [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) instalado e autenticado (`gcloud auth login`).
3. O Docker instalado localmente (para testes de build local).
4. Acesso ao repositório GitHub `rrodrigogon-byte/agro-open`.

---

## Passo 1 — Criar e Configurar o Projeto GCP

Execute os comandos abaixo no terminal com o `gcloud` instalado:

```bash
# Criar o projeto (ou usar um existente)
gcloud projects create setpoint-ultra-prd --name="SetPoint Ultra PRD"
gcloud config set project setpoint-ultra-prd

# Vincular conta de faturamento (substitua BILLING_ACCOUNT_ID)
gcloud billing projects link setpoint-ultra-prd \
  --billing-account=BILLING_ACCOUNT_ID

# Habilitar todas as APIs necessárias
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  compute.googleapis.com \
  cloudresourcemanager.googleapis.com
```

---

## Passo 2 — Criar a Instância Cloud SQL (PostgreSQL)

A criação da instância leva entre 5 e 10 minutos. Escolha o tier conforme o número de clientes:

| Tier | vCPUs | RAM | Clientes estimados | Custo/mês |
|---|---|---|---|---|
| `db-custom-1-3840` | 1 | 3,75 GB | Até 50 tenants | ~R$ 180 |
| `db-custom-2-7680` | 2 | 7,5 GB | 50–200 tenants | ~R$ 360 |
| `db-custom-4-15360` | 4 | 15 GB | 200+ tenants | ~R$ 720 |

```bash
# Criar instância PostgreSQL 15 em São Paulo
gcloud sql instances create setpoint-db-prd \
  --database-version=POSTGRES_15 \
  --tier=db-custom-1-3840 \
  --region=southamerica-east1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --deletion-protection

# Criar banco de dados e usuário
gcloud sql databases create setpoint_ultra --instance=setpoint-db-prd

# Definir senha forte (guarde em local seguro!)
DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
echo "Senha gerada: $DB_PASS"

gcloud sql users create setpoint_admin \
  --instance=setpoint-db-prd \
  --password=$DB_PASS
```

---

## Passo 3 — Configurar o Secret Manager

Os segredos sensíveis nunca devem estar em variáveis de ambiente em texto plano. Use o Secret Manager:

```bash
# Senha do banco
echo -n "$DB_PASS" | gcloud secrets create setpoint-db-pass --data-file=-

# Chave JWT (gere uma chave forte)
JWT_SECRET=$(openssl rand -base64 64)
echo -n "$JWT_SECRET" | gcloud secrets create setpoint-jwt-secret --data-file=-

# Chave de criptografia dos certificados A1 (NF-e)
CERT_KEY=$(openssl rand -hex 32)
echo -n "$CERT_KEY" | gcloud secrets create setpoint-cert-key --data-file=-
```

---

## Passo 4 — Criar Service Account para o Cloud Run

```bash
# Criar service account
gcloud iam service-accounts create setpoint-cloudrun \
  --display-name="SetPoint Ultra Cloud Run"

SA="setpoint-cloudrun@setpoint-ultra-prd.iam.gserviceaccount.com"

# Permissões necessárias
gcloud projects add-iam-policy-binding setpoint-ultra-prd \
  --member="serviceAccount:$SA" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding setpoint-ultra-prd \
  --member="serviceAccount:$SA" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding setpoint-ultra-prd \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Passo 5 — Criar Bucket no Cloud Storage

```bash
# Criar bucket para arquivos do sistema (XMLs de NF-e, certificados, uploads)
gsutil mb -p setpoint-ultra-prd \
  -c STANDARD \
  -l southamerica-east1 \
  gs://setpoint-ultra-storage

# Configurar lifecycle: deletar arquivos temporários após 90 dias
cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [{
      "action": {"type": "Delete"},
      "condition": {"age": 90, "matchesPrefix": ["temp/"]}
    }]
  }
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://setpoint-ultra-storage
```

---

## Passo 6 — Configurar o Cloud Build (CI/CD)

```bash
# Conceder permissão ao Cloud Build para fazer deploy no Cloud Run
PROJECT_NUMBER=$(gcloud projects describe setpoint-ultra-prd --format="value(projectNumber)")
CB_SA="$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding setpoint-ultra-prd \
  --member="serviceAccount:$CB_SA" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding setpoint-ultra-prd \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser"

# Criar trigger de CI/CD conectado ao GitHub
gcloud builds triggers create github \
  --name="setpoint-ultra-deploy" \
  --repo-name="agro-open" \
  --repo-owner="rrodrigogon-byte" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_CLOUD_SQL_INSTANCE=setpoint-ultra-prd:southamerica-east1:setpoint-db-prd,_DB_USER=setpoint_admin,_DB_NAME=setpoint_ultra"
```

---

## Passo 7 — Executar as Migrations no Banco

Use o Cloud SQL Auth Proxy para conectar ao banco e rodar as migrations:

```bash
# Baixar o Cloud SQL Auth Proxy
curl -o cloud-sql-proxy \
  https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.4/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Iniciar o proxy em background
./cloud-sql-proxy setpoint-ultra-prd:southamerica-east1:setpoint-db-prd &
PROXY_PID=$!

# Aguardar o proxy iniciar
sleep 3

# Executar todas as migrations em ordem
for migration in app/migrations/00*.sql app/migrations/01*.sql; do
  echo "Executando: $migration"
  PGPASSWORD=$DB_PASS psql -h 127.0.0.1 -U setpoint_admin -d setpoint_ultra -f $migration
done

# Encerrar o proxy
kill $PROXY_PID
```

---

## Passo 8 — Primeiro Deploy Manual

Para o primeiro deploy, execute manualmente:

```bash
# Build e push da imagem
docker build -t gcr.io/setpoint-ultra-prd/setpoint-ultra:latest .
docker push gcr.io/setpoint-ultra-prd/setpoint-ultra:latest

# Deploy no Cloud Run
CONNECTION_NAME="setpoint-ultra-prd:southamerica-east1:setpoint-db-prd"

gcloud run deploy setpoint-ultra \
  --image gcr.io/setpoint-ultra-prd/setpoint-ultra:latest \
  --region southamerica-east1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --add-cloudsql-instances $CONNECTION_NAME \
  --set-env-vars "NODE_ENV=production,PORT=8080,DB_HOST=/cloudsql/$CONNECTION_NAME,DB_USER=setpoint_admin,DB_NAME=setpoint_ultra,SEFAZ_AMBIENTE=producao" \
  --set-secrets "DB_PASS=setpoint-db-pass:latest,JWT_SECRET=setpoint-jwt-secret:latest,CERT_ENCRYPTION_KEY=setpoint-cert-key:latest" \
  --service-account "setpoint-cloudrun@setpoint-ultra-prd.iam.gserviceaccount.com"
```

---

## Passo 9 — Configurar Domínio Personalizado (Opcional)

```bash
# Verificar propriedade do domínio no Search Console primeiro, depois:
gcloud beta run domain-mappings create \
  --service setpoint-ultra \
  --domain app.setpointultra.com.br \
  --region southamerica-east1

# O GCP fornecerá registros DNS para configurar no seu provedor de domínio.
# Após configurar o DNS, o TLS é provisionado automaticamente.
```

---

## Verificação Pós-Deploy

Após o deploy, verifique os endpoints principais:

```bash
SERVICE_URL=$(gcloud run services describe setpoint-ultra \
  --region southamerica-east1 \
  --format='value(status.url)')

# Healthcheck
curl $SERVICE_URL/health

# Versão da API
curl $SERVICE_URL/api/version
```

A resposta esperada do healthcheck é:

```json
{
  "status": "ok",
  "version": "4.5.0",
  "database": "connected",
  "uptime": 42.5
}
```

---

## Estimativa de Custos Mensais (GCP)

| Serviço | Configuração | Custo estimado |
|---|---|---|
| Cloud Run | 1 instância mínima, 1 vCPU, 1 GB | ~R$ 90/mês |
| Cloud SQL | `db-custom-1-3840`, 10 GB SSD | ~R$ 180/mês |
| Cloud Storage | 10 GB + transferência | ~R$ 15/mês |
| Cloud Build | 120 min/dia grátis | R$ 0/mês |
| Secret Manager | < 10 segredos | ~R$ 1/mês |
| **Total estimado** | | **~R$ 286/mês** |

Com 10 clientes pagando R$ 199/mês, o custo de infraestrutura representa apenas **14%** da receita.

---

## Monitoramento e Alertas

```bash
# Criar alerta de erro 5xx > 1% por 5 minutos
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/error-rate-alert.yaml

# Ver logs em tempo real
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=setpoint-ultra"
```

---

## Rollback de Emergência

Em caso de problema após um deploy, o rollback é imediato:

```bash
# Listar as últimas revisões
gcloud run revisions list --service setpoint-ultra --region southamerica-east1

# Redirecionar 100% do tráfego para a revisão anterior
gcloud run services update-traffic setpoint-ultra \
  --region southamerica-east1 \
  --to-revisions NOME_DA_REVISAO_ANTERIOR=100
```
