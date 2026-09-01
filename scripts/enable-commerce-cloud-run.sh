#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${CONFIRM_COMMERCE_CLOUD_RUN:-}" != "I_UNDERSTAND_CLOUD_RUN" ]]; then
  cat >&2 <<'MSG'
Alteração do ambiente Cloud Run bloqueada por segurança.
Para habilitar o Commerce Core explicitamente, execute:
  CONFIRM_COMMERCE_CLOUD_RUN=I_UNDERSTAND_CLOUD_RUN ./scripts/enable-commerce-cloud-run.sh
MSG
  exit 2
fi

command -v gcloud >/dev/null 2>&1 || { echo "gcloud não está instalado ou não está no PATH." >&2; exit 3; }

project="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-}}}"
region="${CLOUD_RUN_REGION:-us-central1}"
service="${CLOUD_RUN_SERVICE:-kytto-erp}"

if [[ -z "$project" ]]; then
  project="$(gcloud config get-value project 2>/dev/null || true)"
fi
[[ -n "$project" && "$project" != "(unset)" ]] || { echo "Defina GCP_PROJECT_ID ou configure o projeto ativo do gcloud." >&2; exit 4; }

printf 'Habilitando Commerce Core no serviço %s (%s/%s)...\n' "$service" "$project" "$region"
gcloud run services update "$service" \
  --project "$project" \
  --region "$region" \
  --update-env-vars 'COMMERCE_CORE_ENABLED=1,COMMERCE_SCHEMA_ON_BOOT=1'

status="$(gcloud run services describe "$service" --project "$project" --region "$region" --format='value(status.conditions[0].status)' 2>/dev/null || true)"
[[ "$status" == "True" ]] || { echo "Cloud Run não confirmou condição saudável: ${status:-desconhecida}" >&2; exit 5; }

a="$(gcloud run services describe "$service" --project "$project" --region "$region" --format='value(status.url)')"
echo "Serviço atualizado: $a"
curl --fail --silent --show-error --max-time 20 "$a/health" >/dev/null
echo "Healthcheck OK."
