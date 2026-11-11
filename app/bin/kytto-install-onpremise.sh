#!/usr/bin/env bash
# ============================================================================
# KYTTO ERP ENTERPRISE - INSTALADOR ON-PREMISE AUTOMATIZADO (SOVEREIGN)
# Suporta: Ubuntu 22.04/24.04, Debian 12, Rocky Linux 9, RHEL 9
# ============================================================================

set -euo pipefail

echo "======================================================================"
echo "    INICIANDO INSTALACAO DO KYTTO ERP ENTERPRISE (ON-PREMISE)         "
echo "======================================================================"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Erro: execute este instalador como root (sudo bash kytto-install-onpremise.sh)"
  exit 1
fi

echo "[1/5] Verificando dependencias do sistema (Docker, Docker Compose e OpenSSL)..."
if ! command -v openssl &> /dev/null; then
  apt-get update && apt-get install -y openssl || yum install -y openssl
fi

if ! command -v docker &> /dev/null; then
  echo "Instalando Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "Docker instalado: $(docker --version)"
fi

if ! docker compose version &> /dev/null; then
  echo "Instalando plugin Docker Compose..."
  apt-get update && apt-get install -y docker-compose-plugin || yum install -y docker-compose-plugin
fi
echo "Docker Compose ativo: $(docker compose version)"

echo "[2/5] Configurando ambiente local e gerando chaves criptograficas unicas..."
INSTALL_DIR="/opt/kytto-erp"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

GENERATED_ADMIN_USER="admin@$(hostname -f 2>/dev/null || echo 'kytto.local')"
GENERATED_ADMIN_PASS="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16)"
GENERATED_JWT_SECRET="$(openssl rand -hex 32)"
GENERATED_PG_PASS="$(openssl rand -hex 24)"
GENERATED_REDIS_PASS="$(openssl rand -hex 24)"

if [ ! -f .env ]; then
  cat << EOF > .env
KYTTO_DEPLOYMENT_MODE=on-premise
NODE_ENV=production
HTTP_PORT=8080
APP_URL=http://localhost:8080
JWT_SECRET=${GENERATED_JWT_SECRET}
POSTGRES_DB=kytto_enterprise
POSTGRES_USER=kytto_admin
POSTGRES_PASSWORD=${GENERATED_PG_PASS}
POSTGRES_PORT=5432
REDIS_PASSWORD=${GENERATED_REDIS_PASS}
REDIS_PORT=6379
WAHA_PORT=3008
BOOTSTRAP_ADMIN_EMAIL=${GENERATED_ADMIN_USER}
BOOTSTRAP_ADMIN_PASSWORD=${GENERATED_ADMIN_PASS}
BOOTSTRAP_FORCE_PASSWORD_CHANGE=true
EOF
  chmod 600 .env
  echo "Arquivo .env gerado com segredos criptograficos exclusivos."
fi

echo "[3/5] Sincronizando stack do Docker Compose..."
if [ -f "${OLDPWD:-.}/docker-compose.onpremise.yml" ]; then
  cp "${OLDPWD:-.}/docker-compose.onpremise.yml" docker-compose.yml
fi

echo "[4/5] Subindo servicos Kytto On-Premise..."
if [ -f docker-compose.yml ]; then
  docker compose pull || true
  docker compose up -d --remove-orphans
fi

echo "[5/5] Aguardando estabilizacao dos servicos..."
sleep 5
if [ -f docker-compose.yml ]; then
  docker compose ps
fi

echo "======================================================================"
echo "    INSTALACAO DO KYTTO ERP ON-PREMISE CONCLUIDA COM SUCESSO          "
echo "======================================================================"
echo "Acesso Web: http://$(hostname -I 2>/dev/null | awk '{print $1}'):8080"
echo "Usuario Administrador Inicial: ${GENERATED_ADMIN_USER}"
echo "Senha Temporaria (exibida uma unica vez): ${GENERATED_ADMIN_PASS}"
echo "ATENCAO: A troca da senha sera exigida obrigatoriamente no primeiro acesso."
echo "Diretorio de Instalacao: $INSTALL_DIR"
echo "======================================================================"
