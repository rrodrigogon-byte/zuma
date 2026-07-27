#!/bin/bash
# Script de execução das migrations do SetPoint Ultra
# Uso: ./run_migrations.sh [host] [port] [user] [password] [dbname]

HOST=${1:-localhost}
PORT=${2:-5432}
USER=${3:-setpoint}
PGPASSWORD=${4:-setpoint2026}
DB=${5:-setpoint_ultra}

export PGPASSWORD

echo "======================================================"
echo "  SetPoint Ultra — Executando Migrations"
echo "  Host: $HOST:$PORT | DB: $DB | User: $USER"
echo "======================================================"

# Criar tabela de controle de migrations
psql -h $HOST -p $PORT -U $USER -d $DB -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  checksum TEXT
);" 2>/dev/null

run_migration() {
  local version=$1
  local file=$2

  # Verificar se já foi aplicada
  local applied=$(psql -h $HOST -p $PORT -U $USER -d $DB -tAc "SELECT COUNT(*) FROM schema_migrations WHERE version='$version';")
  if [ "$applied" = "1" ]; then
    echo "  ✓ $version — já aplicada, pulando"
    return 0
  fi

  echo "  ▶ Aplicando $version ($file)..."
  if psql -h $HOST -p $PORT -U $USER -d $DB -f "$file" > /tmp/migration_output.txt 2>&1; then
    psql -h $HOST -p $PORT -U $USER -d $DB -c "INSERT INTO schema_migrations (version) VALUES ('$version');" > /dev/null
    echo "  ✅ $version aplicada com sucesso"
  else
    echo "  ❌ ERRO ao aplicar $version:"
    cat /tmp/migration_output.txt | head -20
    echo "  Abortando..."
    exit 1
  fi
}

MIGRATIONS_DIR="$(dirname "$0")"

# Executar migrations em ordem
run_migration "001_erp_foundation"    "$MIGRATIONS_DIR/001_erp_foundation.sql"
run_migration "002_catalogo_fiscal"   "$MIGRATIONS_DIR/002_catalogo_fiscal_pipas.sql"
run_migration "003_erp_comercial"     "$MIGRATIONS_DIR/003_erp_comercial_completo.sql"
run_migration "004_erp_modulos"       "$MIGRATIONS_DIR/004_erp_modulos_novos.sql"
run_migration "005_fiscal_proprio"    "$MIGRATIONS_DIR/005_fiscal_proprio.sql"

echo ""
echo "======================================================"
echo "  ✅ Todas as migrations aplicadas com sucesso!"
echo "======================================================"

# Mostrar resumo das tabelas criadas
echo ""
echo "  📊 Tabelas no banco:"
psql -h $HOST -p $PORT -U $USER -d $DB -c "\dt" 2>/dev/null | grep -v "schema_migrations" | tail -n +3 | head -40
