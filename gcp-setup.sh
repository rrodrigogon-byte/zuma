#!/bin/bash
# Script de automação para deploy do SetPoint Ultra no Google Cloud Platform
# Autor: Manus AI

set -e

# Configurações iniciais
PROJECT_ID="setpoint-ultra-prd"
REGION="southamerica-east1" # São Paulo
DB_INSTANCE="setpoint-db-prd"
DB_NAME="setpoint_ultra"
DB_USER="setpoint_admin"
SERVICE_NAME="setpoint-ultra"

echo "================================================================="
echo "🚀 SETUP AUTOMATIZADO - SETPOINT ULTRA NO GCP"
echo "================================================================="

# 1. Configurar o projeto
echo -e "\n[1/7] Configurando projeto GCP ($PROJECT_ID)..."
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

# 2. Habilitar APIs necessárias
echo -e "\n[2/7] Habilitando APIs (Cloud Run, Cloud SQL, Cloud Build, Secret Manager)..."
gcloud services enable run.googleapis.com \
    sqladmin.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    compute.googleapis.com

# 3. Criar instância do Cloud SQL (PostgreSQL)
echo -e "\n[3/7] Verificando/Criando instância Cloud SQL PostgreSQL 15..."
if gcloud sql instances describe $DB_INSTANCE --region=$REGION > /dev/null 2>&1; then
    echo "Instância $DB_INSTANCE já existe."
else
    echo "Criando nova instância Cloud SQL (isso pode levar de 5 a 10 minutos)..."
    gcloud sql instances create $DB_INSTANCE \
        --database-version=POSTGRES_15 \
        --tier=db-custom-1-3840 \
        --region=$REGION \
        --storage-type=SSD \
        --storage-size=10GB \
        --storage-auto-increase \
        --backup-start-time=03:00 \
        --enable-point-in-time-recovery
fi

# 4. Configurar banco de dados e usuário
echo -e "\n[4/7] Configurando banco de dados e usuário..."
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE || echo "Banco já existe."

# Gerar senha forte aleatória
DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
echo "Senha gerada para o banco: $DB_PASS"
echo "⚠️ GUARDE ESTA SENHA EM UM LOCAL SEGURO! ⚠️"

gcloud sql users create $DB_USER --instance=$DB_INSTANCE --password=$DB_PASS || \
gcloud sql users set-password $DB_USER --instance=$DB_INSTANCE --password=$DB_PASS

# Obter connection name
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
echo "Connection Name: $CONNECTION_NAME"

# 5. Configurar Secret Manager
echo -e "\n[5/7] Configurando Secret Manager para variáveis sensíveis..."
echo -n "$DB_PASS" | gcloud secrets create setpoint-db-pass --data-file=- || \
echo -n "$DB_PASS" | gcloud secrets versions add setpoint-db-pass --data-file=-

# 6. Executar Cloud Build (Build + Push + Deploy)
echo -e "\n[6/7] Iniciando pipeline de CI/CD via Cloud Build..."
echo "Submetendo código para build e deploy..."

gcloud builds submit --config cloudbuild.yaml \
    --substitutions=_DB_HOST="/cloudsql/$CONNECTION_NAME",_DB_USER="$DB_USER",_DB_PASS="$DB_PASS",_DB_NAME="$DB_NAME",_CLOUD_SQL_INSTANCE="$CONNECTION_NAME"

# 7. Mapear domínio personalizado (opcional)
echo -e "\n[7/7] Configuração de domínio..."
echo "Para mapear um domínio personalizado, execute:"
echo "gcloud beta run domain-mappings create --service $SERVICE_NAME --domain app.setpointultra.com.br --region $REGION"

echo -e "\n================================================================="
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "URL do serviço: $(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)' 2>/dev/null || echo 'Verifique o console do GCP')"
echo "================================================================="
