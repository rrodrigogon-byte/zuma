#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/app"

if [[ "${CONFIRM_COMMERCE_ACTIVATION:-}" != "I_UNDERSTAND_PRODUCTION" ]]; then
  cat >&2 <<'MSG'
Ativação bloqueada por segurança.
Para aplicar migrations em um banco real, execute com:
  CONFIRM_COMMERCE_ACTIVATION=I_UNDERSTAND_PRODUCTION ./scripts/activate-commerce.sh
MSG
  exit 2
fi

has_postgres="false"
if [[ -n "${DATABASE_URL:-}" || -n "${POSTGRES_URL:-}" ]]; then
  has_postgres="true"
elif [[ -n "${DB_HOST:-}" && -n "${DB_USER:-}" && -n "${DB_PASSWORD:-}" && -n "${DB_NAME:-}" ]]; then
  has_postgres="true"
fi

if [[ "$has_postgres" != "true" ]]; then
  echo "Conexão PostgreSQL não encontrada. Defina DATABASE_URL/POSTGRES_URL ou DB_HOST, DB_USER, DB_PASSWORD e DB_NAME." >&2
  exit 3
fi

if [[ ! -f "$APP_DIR/package.json" || ! -f "$APP_DIR/migrations/run-commerce-schema-migrations.js" ]]; then
  echo "Diretório do Commerce Core inválido: $APP_DIR" >&2
  exit 4
fi

if [[ "${SKIP_NPM_INSTALL:-0}" != "1" ]]; then
  echo "Instalando dependências de produção do app..."
  npm --prefix "$APP_DIR" ci --omit=dev --no-audit --no-fund
fi

echo "Aplicando schema Commerce Core com lock transacional..."
(
  cd "$APP_DIR"
  COMMERCE_SCHEMA_REQUIRED=1 node migrations/run-commerce-schema-migrations.js
)

echo "Migrations concluídas."

if [[ -n "${COMMERCE_BASE_URL:-}" ]]; then
  base="${COMMERCE_BASE_URL%/}"
  echo "Validando healthcheck do serviço..."
  curl --fail --silent --show-error --max-time 15 "$base/health" >/dev/null
  echo "Healthcheck OK."
fi

if [[ -n "${DINO_BASE_URL:-}" ]]; then
  dino="${DINO_BASE_URL%/}"
  echo "Validando contexto público do storefront Dino..."
  curl --fail --silent --show-error --max-time 20 "$dino/api/public/storefront/dino/context" >/dev/null
  echo "Contexto público do Dino OK."
fi
