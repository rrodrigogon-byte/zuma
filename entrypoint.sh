#!/bin/sh
set -eu

echo "🚀 Iniciando SetPoint Ultra no Google Cloud Run..."
export TZ="America/Cuiaba"

has_postgres="false"
if [ -n "${DATABASE_URL:-}" ] || [ -n "${POSTGRES_URL:-}" ]; then
  has_postgres="true"
elif [ -n "${DB_HOST:-}" ] && [ -n "${DB_USER:-}" ] && [ -n "${DB_PASSWORD:-}" ] && [ -n "${DB_NAME:-}" ]; then
  has_postgres="true"
fi

if [ "$has_postgres" = "true" ]; then
  echo "✅ Conexão com PostgreSQL configurada."
else
  echo "⚠️  AVISO: conexão PostgreSQL gerenciada não configurada."
fi

if [ "${COMMERCE_CORE_ENABLED:-0}" = "1" ]; then
  if [ "$has_postgres" != "true" ]; then
    echo "❌ COMMERCE_CORE_ENABLED=1 exige DATABASE_URL/POSTGRES_URL ou DB_HOST + DB_USER + DB_PASSWORD + DB_NAME." >&2
    exit 1
  fi
  if [ "${COMMERCE_SCHEMA_ON_BOOT:-1}" = "1" ]; then
    echo "▶️  Aplicando schema Commerce Core (idempotente e com advisory lock)..."
    COMMERCE_SCHEMA_REQUIRED=1 node migrations/run-commerce-schema-migrations.js
  fi
  echo "▶️  Iniciando Node.js (server.js com Commerce Core)..."
  exec node server.js
fi

# Caminho legado preservado quando o Commerce Core não foi habilitado.
echo "▶️  Iniciando Node.js (server-erp.js)..."
exec node server-erp.js
