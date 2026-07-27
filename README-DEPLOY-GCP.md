# Guia de Deploy — Google Cloud Platform (GCP)
# SetPoint Ultra v3.1.0

Este documento descreve o processo passo-a-passo para realizar o deploy do SetPoint Ultra no ambiente de produção do GCP.

## 1. Arquitetura na Nuvem

- **Banco de Dados:** Cloud SQL (PostgreSQL 16) — `db-f1-micro` (pode ser escalado conforme a demanda).
- **Backend (API):** Cloud Run — Escalabilidade automática de 1 a 10 instâncias.
- **Frontend (Web):** Firebase Hosting ou Cloud Storage + Cloud CDN.
- **Armazenamento de Arquivos (Fotos/XML/PDF):** Cloud Storage.
- **Domínio Personalizado:** Cloud DNS (ex: `app.setpointultra.com.br`).

## 2. Preparação do Ambiente

Antes de iniciar, certifique-se de ter o `gcloud` CLI instalado e autenticado.

```bash
gcloud auth login
gcloud config set project [SEU-PROJECT-ID]
gcloud config set compute/region southamerica-east1
```

Habilite as APIs necessárias:
```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

## 3. Configuração do Cloud SQL (PostgreSQL)

1. Crie a instância:
```bash
gcloud sql instances create setpoint-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=southamerica-east1
```

2. Defina a senha do usuário `postgres`:
```bash
gcloud sql users set-password postgres \
  --instance=setpoint-db \
  --password="SUA_SENHA_FORTE_AQUI"
```

3. Crie o banco de dados:
```bash
gcloud sql databases create setpoint_ultra --instance=setpoint-db
```

## 4. Configuração do Secret Manager

Para não expor credenciais no código, crie os seguintes secrets:

```bash
# Senha do Banco
echo -n "SUA_SENHA_FORTE_AQUI" | gcloud secrets create DB_PASS --data-file=-
# JWT Secret
echo -n "CHAVE_SECRETA_JWT_MUITO_LONGA" | gcloud secrets create JWT_SECRET --data-file=-
```

Conceda permissão ao Cloud Run para acessar os secrets:
```bash
PROJECT_NUMBER=$(gcloud projects describe [SEU-PROJECT-ID] --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding DB_PASS \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 5. Deploy via Cloud Build

O projeto já contém o arquivo `cloudbuild.yaml` configurado. Basta rodar:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

O Cloud Build irá:
1. Fazer o build da imagem Docker (`Dockerfile`).
2. Enviar a imagem para o Artifact Registry.
3. Fazer o deploy no Cloud Run.

## 6. Configuração do Domínio Personalizado

Para vincular o domínio (ex: `app.setpointultra.com.br`) ao Cloud Run:

1. Acesse o console do GCP > Cloud Run > Manage Custom Domains.
2. Adicione o mapeamento para o serviço `setpoint-ultra-api`.
3. Configure os registros DNS (A, AAAA, CNAME) fornecidos pelo GCP no seu provedor de domínio (ex: Cloudflare ou Registro.br).

## 7. Execução das Migrations em Produção

Para rodar as migrations no Cloud SQL, utilize o Cloud SQL Auth Proxy localmente:

```bash
# Baixar o proxy
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
chmod +x cloud_sql_proxy

# Iniciar o proxy
./cloud_sql_proxy -instances=[SEU-PROJECT-ID]:southamerica-east1:setpoint-db=tcp:5432 &

# Rodar migrations
cd app/migrations
./run_migrations.sh localhost 5432 postgres SUA_SENHA_FORTE_AQUI setpoint_ultra
```

## 8. Monitoramento e Logs

- Acesse **Cloud Logging** para ver os logs da aplicação.
- Acesse **Cloud Monitoring** para configurar alertas (ex: uso de CPU, erros 500).
- Acesse **Error Reporting** para ver o stack trace de exceções não tratadas.
