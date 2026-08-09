#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-18090}"
DB_PATH="/tmp/kytto-kds-e2e-$(date +%s).json"
LOG="/tmp/kytto-kds-e2e-server.log"
RELATORIO="/tmp/kytto-kds-e2e-relatorio.json"
BASE="http://127.0.0.1:${PORT}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ROOT"
DB_PATH="$DB_PATH" GCS_BUCKET='' PORT="$PORT" NODE_ENV=test SIMULACAO_ISOLADA=true node app/server-erp.js >"$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 90); do
  if curl -fsS "$BASE/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "$BASE/health" >/dev/null

TOKEN=$(curl -fsS -X POST "$BASE/api/admin/login" \
  -H 'Content-Type: application/json' \
  -d '{"user":"admin@setpoint-ultra.local","senha":"SetPoint@2026Temp"}' | jq -r '.token')
[[ -n "$TOKEN" && "$TOKEN" != "null" ]]
AUTH=(-H "Authorization: Bearer $TOKEN")

CATALOGO=$(curl -fsS "${AUTH[@]}" "$BASE/api/cardapio")
BAR_ID=$(jq -r 'map(select((.setor // "bar") == "bar" and (.indisponivel != true)))[0].id // empty' <<<"$CATALOGO")
COZINHA_ID=$(jq -r 'map(select(.cozinha == true and (.indisponivel != true)))[0].id // empty' <<<"$CATALOGO")

# Banco isolado inicia vazio: cadastrar os dois itens mínimos para testar o roteamento real.
if [[ -z "$BAR_ID" ]]; then
  BAR_ID=$(curl -fsS -X POST "$BASE/api/admin/cardapio" -H 'Content-Type: application/json' "${AUTH[@]}" \
    -d '{"nome":"Cerveja teste KDS","preco":10,"setor":"bar","cozinha":false}' | jq -r '.item.id')
fi
if [[ -z "$COZINHA_ID" ]]; then
  COZINHA_ID=$(curl -fsS -X POST "$BASE/api/admin/cardapio" -H 'Content-Type: application/json' "${AUTH[@]}" \
    -d '{"nome":"Espetinho teste KDS","preco":15,"setor":"cozinha","cozinha":true}' | jq -r '.item.id')
fi
[[ -n "$BAR_ID" && "$BAR_ID" != "null" ]] || { echo 'Não foi possível cadastrar item de Bar'; exit 1; }
[[ -n "$COZINHA_ID" && "$COZINHA_ID" != "null" ]] || { echo 'Não foi possível cadastrar item de Cozinha'; exit 1; }

COMANDA=$(curl -fsS -X POST "$BASE/api/mesa-virtual" \
  -H 'Content-Type: application/json' "${AUTH[@]}" \
  -d "{\"nome\":\"Teste KDS Bar e Cozinha\",\"local\":\"Teste automatizado\",\"itens\":[{\"produtoId\":\"$BAR_ID\",\"qtd\":1},{\"produtoId\":\"$COZINHA_ID\",\"qtd\":1}]}" | jq -r '.comandaId')
[[ -n "$COMANDA" && "$COMANDA" != "null" ]]

PEDIDOS=$(curl -fsS "${AUTH[@]}" "$BASE/api/setores/pedidos")
BAR_ITEM=$(jq -r --arg id "$COMANDA" '.pedidos[] | select(.comandaId == $id) | .itens[] | select(.setor == "bar") | .indice' <<<"$PEDIDOS")
COZINHA_ITEM=$(jq -r --arg id "$COMANDA" '.pedidos[] | select(.comandaId == $id) | .itens[] | select(.cozinha == true) | .indice' <<<"$PEDIDOS")
[[ -n "$BAR_ITEM" ]] || { echo 'Item de Bar não chegou à fila operacional'; exit 1; }
[[ -n "$COZINHA_ITEM" ]] || { echo 'Item de Cozinha não chegou à fila operacional'; exit 1; }

for ITEM in "$BAR_ITEM" "$COZINHA_ITEM"; do
  curl -fsS -X PATCH "$BASE/api/kds/comanda/$COMANDA/item/$ITEM/status" \
    -H 'Content-Type: application/json' "${AUTH[@]}" \
    -d '{"status":"em_preparo"}' >/dev/null
  curl -fsS -X PATCH "$BASE/api/kds/comanda/$COMANDA/item/$ITEM/status" \
    -H 'Content-Type: application/json' "${AUTH[@]}" \
    -d '{"status":"pronto"}' >/dev/null
done

FINAL=$(curl -fsS "${AUTH[@]}" "$BASE/api/setores/pedidos")
jq --arg id "$COMANDA" '{
  sucesso: true,
  comandaId: $id,
  itens: [.pedidos[] | select(.comandaId == $id) | .itens[] | {nome, setor, cozinha, status}]
}' <<<"$FINAL" >"$RELATORIO"
cat "$RELATORIO"

echo "Relatório: $RELATORIO"
