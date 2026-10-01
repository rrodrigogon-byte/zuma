#!/usr/bin/env bash
set -euo pipefail

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "ABORTADO: checks destrutivos de banco nunca executam com NODE_ENV=production." >&2
  exit 64
fi

if [[ "${ALLOW_DESTRUCTIVE_DB_TESTS:-}" != "I_UNDERSTAND_THIS_RECREATES_A_DISPOSABLE_DATABASE" ]]; then
  echo "ABORTADO: defina ALLOW_DESTRUCTIVE_DB_TESTS=I_UNDERSTAND_THIS_RECREATES_A_DISPOSABLE_DATABASE apenas em ambiente descartável." >&2
  exit 65
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ABORTADO: DATABASE_URL descartável é obrigatória." >&2
  exit 66
fi

node --test app/core/commerce-customer-identity.pg.test.js app/core/commerce-admin-users.pg.test.js
