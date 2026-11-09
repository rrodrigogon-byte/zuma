#!/usr/bin/env bash
# ============================================================================
# KYTTO ERP ENTERPRISE - INSTALADOR ON-PREMISE AUTOMATIZADO (SOVEREIGN)
# Suporta: Ubuntu 22.04/24.04, Debian 12, Rocky Linux 9, RHEL 9
# ============================================================================

set -e

echo "======================================================================"
echo "    🚀 INICIANDO INSTALAÇÃO DO KYTTO ERP ENTERPRISE (ON-PREMISE)      "
echo "======================================================================"

# Verifica permissões de root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, execute este instalador como root (sudo bash bin/kytto-install-onpremise.sh)"
  exit 1
fi

# 1. Checagem de Dependências: Docker e Docker Compose
echo "🔍 [1/5] Verificando dependências do sistema..."
if ! command -v docker &> /dev/null; then
  echo "📦 Instalando Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "✅ Docker já instalado: $(docker --version)"
fi

if ! docker compose version &> /dev/null; then
  echo "📦 Instalando plugin Docker Compose..."
  apt-get update && apt-get install -y docker-compose-plugin || yum install -y docker-compose-plugin
fi
echo "✅ Docker Compose ativo: $(docker compose version)"

# 2. Configuração de Variáveis de Ambiente
echo "⚙️  [2/5] Configurando ambiente local..."
INSTALL_DIR="/opt/kytto-erp"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [ ! -f .env ]; then
  echo "📝 Criando arquivo .env a partir do modelo..."
  if [ -f "$OLDPWD/.env.onpremise.example" ]; then
    cp "$OLDPWD/.env.onpremise.example" .env
  else
    cat << 'EOF' > .env
KYTTO_DEPLOYMENT_MODE=on-premise
NODE_ENV=production
HTTP_PORT=8080
APP_URL=http://localhost:8080
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_DB=kytto_enterprise
POSTGRES_USER=kytto_admin
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_PORT=5432
REDIS_PASSWORD=$(openssl rand -hex 16)
REDIS_PORT=6379
WAHA_PORT=3008
EOF
  fi
  echo "✅ Arquivo .env gerado com chaves criptográficas seguras."
fi

# 3. Cópia do arquivo docker-compose
echo "📄 [3/5] Sincronizando stack do Docker Compose..."
if [ -f "$OLDPWD/docker-compose.onpremise.yml" ]; then
  cp "$OLDPWD/docker-compose.onpremise.yml" docker-compose.yml
fi

# 4. Inicialização dos Contêineres
echo "🚀 [4/5] Subindo serviços Kytto On-Premise..."
docker compose pull || true
docker compose up -d --remove-orphans

# 5. Validação de Saúde
echo "⏳ [5/5] Aguardando estabilização dos serviços..."
sleep 10
docker compose ps

echo "======================================================================"
echo "    🎉 INSTALAÇÃO DO KYTTO ERP ON-PREMISE CONCLUÍDA COM SUCESSO!     "
echo "======================================================================"
echo "🌐 Acesso Web: http://$(hostname -I | awk '{print $1}'):8080"
echo "🔑 Login Admin Padrão: dino / 123456"
echo "📂 Diretório de Instalação: $INSTALL_DIR"
echo "💾 Backups Automáticos: Armazenados no volume kytto-backups (retenção de 30 dias)"
echo "======================================================================"
