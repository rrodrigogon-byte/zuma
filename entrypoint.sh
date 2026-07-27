#!/bin/sh
set -e

echo "🚀 Iniciando SetPoint Ultra no Google Cloud Run..."

# Configurar timezone para o Brasil
export TZ="America/Cuiaba"

# Verificar se as variáveis de banco de dados estão configuradas
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASS" ] || [ -z "$DB_NAME" ]; then
  echo "⚠️  AVISO: Variáveis de banco de dados (DB_*) não configuradas."
  echo "⚠️  O sistema iniciará usando SQLite/JSON em memória para fallback."
else
  echo "✅ Conexão com PostgreSQL configurada ($DB_HOST:$DB_NAME)."
fi

# Executar o servidor principal do ERP
echo "▶️  Iniciando Node.js (server-erp.js)..."
exec node server-erp.js
