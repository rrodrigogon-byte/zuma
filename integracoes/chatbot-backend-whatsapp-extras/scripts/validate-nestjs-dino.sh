#!/usr/bin/env bash
# ============================================================================
# validate-nestjs-dino.sh
#
# Valida os 4 endpoints do chatbot-backend-nestjs da Dino após o deploy.
# Equivalente ao Passo 5 do PROMPT-SUBIR-BACKEND-WHATSAPP-DINO.md.
#
# Uso:
#   chmod +x validate-nestjs-dino.sh
#   BASE=https://<url-do-backend-da-dino> KEY=<chave-api> bash validate-nestjs-dino.sh
#
# Parâmetros obrigatórios (via env):
#   BASE  — URL HTTPS do Cloud Run da Dino (sem barra final)
#   KEY   — API key (mesma do /send; também em CHATBOT_BACKEND_KEY no Render)
#
# Parâmetro opcional:
#   PHONE — número de teste com DDI (padrão: 5514997462929)
#   AUDIO_ID — ID de mensagem de áudio real para testar GET /media
#              (se omitido, o teste de mídia é pulado)
# ============================================================================

set -euo pipefail

# ── Configuração ─────────────────────────────────────────────────────────────
BASE="${BASE:?'Defina BASE=https://url-do-backend-da-dino'}"
KEY="${KEY:?'Defina KEY=chave-api'}"
PHONE="${PHONE:-5514997462929}"
AUDIO_ID="${AUDIO_ID:-}"
STICKER_URL="https://setpoint.kytto.com.br/figurinhas/trex-ola.webp"
PROFILE_URL="https://setpoint.kytto.com.br/brand/dino-whatsapp-perfil-640.png"
PASS=0; FAIL=0; SKIP=0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; ((PASS++)); }
fail() { echo -e "${RED}❌ $*${NC}"; ((FAIL++)); }
skip() { echo -e "${YELLOW}⏭  $*${NC}"; ((SKIP++)); }
hdr()  { echo -e "\n${YELLOW}═══ $* ═══${NC}"; }

# ── Teste 0: health / rota raiz ───────────────────────────────────────────────
hdr "0 — Rota raiz (health check)"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/")
if [[ "$STATUS" =~ ^(200|404)$ ]]; then
  ok "Rota raiz acessível (HTTP $STATUS) — backend no ar"
else
  fail "Backend não respondeu (HTTP $STATUS). Verifique a URL."
  echo "  → BASE=$BASE"
  exit 1
fi

# ── Teste 1: sem chave → 401 ─────────────────────────────────────────────────
hdr "1 — Sem chave → 401"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${BASE}/api/v1/whats-app/send-sticker" \
  -H 'Content-Type: application/json')
if [[ "$STATUS" == "401" ]]; then
  ok "Rota existe e exige chave (HTTP 401)"
else
  fail "Esperado 401, recebido HTTP $STATUS"
  echo "  → A rota pode não ter sido registrada ainda ou o guard está desligado"
fi

# ── Teste 2: figurinha ────────────────────────────────────────────────────────
hdr "2 — POST /send-sticker (figurinha T-Rex)"
RESP=$(curl -s -X POST "${BASE}/api/v1/whats-app/send-sticker" \
  -H "x-api-key: ${KEY}" \
  -H 'Content-Type: application/json' \
  -d "{\"instanceName\":\"dino\",\"chat_id\":\"${PHONE}\",\"sticker\":{\"url\":\"${STICKER_URL}\",\"mimetype\":\"image/webp\"}}")
echo "  Resposta: ${RESP:0:200}"
if echo "$RESP" | grep -q '"success":true'; then
  ok "Figurinha enviada com sucesso"
elif echo "$RESP" | grep -qE '"error"|"message"'; then
  fail "Backend retornou erro: $RESP"
else
  fail "Resposta inesperada: $RESP"
fi

# ── Teste 3: foto de perfil ───────────────────────────────────────────────────
hdr "3 — POST /instances/dino/profile-picture (foto T-Rex)"
RESP=$(curl -s -X POST "${BASE}/api/v1/whats-app/instances/dino/profile-picture" \
  -H "x-api-key: ${KEY}" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"${PROFILE_URL}\"}")
echo "  Resposta: ${RESP:0:200}"
if echo "$RESP" | grep -q '"success":true'; then
  ok "Foto de perfil trocada com sucesso — verifique no celular"
elif echo "$RESP" | grep -q '"NOT_IMPLEMENTED"'; then
  fail "setProfilePicture não implementado — atualize whatsapp-web.js para ≥ 1.21"
else
  fail "Erro ao trocar foto: $RESP"
fi

# ── Teste 4: mídia (áudio) ────────────────────────────────────────────────────
hdr "4 — GET /messages/:id/media (áudio do cliente)"
if [[ -z "$AUDIO_ID" ]]; then
  skip "AUDIO_ID não definido — pule este teste ou defina AUDIO_ID=<id-da-mensagem-de-audio>"
  echo "  Como obter o ID:"
  echo "    curl -s \"${BASE}/api/v1/whats-app/messages?role=user&latest=true\" -H \"x-api-key: \$KEY\""
  echo "    # Pegue o campo whatsappMessageId (ou id) do item de áudio"
else
  RESP=$(curl -s \
    "${BASE}/api/v1/whats-app/messages/${AUDIO_ID}/media?instance=dino&chatId=${PHONE}" \
    -H "x-api-key: ${KEY}")
  echo "  Resposta (primeiros 200 chars): ${RESP:0:200}"
  if echo "$RESP" | grep -q '"base64"'; then
    MIME=$(echo "$RESP" | grep -o '"mimetype":"[^"]*"' | head -1)
    ok "Mídia recuperada com sucesso — $MIME"
  elif echo "$RESP" | grep -q '"NOT_FOUND"'; then
    fail "Mensagem não encontrada pelo ID informado"
    echo "  → Use GET /messages?role=user&latest=true para pegar o ID correto"
  else
    fail "Resposta inesperada: $RESP"
  fi
fi

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════"
echo -e "  ${GREEN}✅ Passou: ${PASS}${NC}  ${RED}❌ Falhou: ${FAIL}${NC}  ${YELLOW}⏭  Pulou: ${SKIP}${NC}"
echo "════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Próximos passos se houver falhas:"
  echo "  • Figurinha HTTP 404/405 → rota send-sticker não registrada no AppModule"
  echo "  • Figurinha HTTP 502 → instância 'dino' não encontrada (verifique resolveClient)"
  echo "  • Foto HTTP 501 → whatsapp-web.js desatualizado (atualize para ≥ 1.21)"
  echo "  • Áudio NOT_FOUND → use GET /messages para pegar o ID correto"
  echo ""
  echo "Se precisar reverter o deploy da Dino:"
  echo "  gcloud run services update-traffic <servico-da-dino> --to-revisions <hash-anterior>=100"
  exit 1
fi

echo ""
echo "Tudo verde! Próximo passo:"
echo "  Configure no Render (setpoint):"
echo "  CHATBOT_BACKEND_MEDIA_PATH=/messages/{id}/media?instance={instance}&chatId={chatId}"
echo ""
echo "  Depois teste ponta a ponta (celular 14 99746-2929):"
echo "  1. 'oi' → resposta do T-Rex + figurinha trex-ola.webp"
echo "  2. Confirmar agendamento → trex-agendado.webp"
echo "  3. Enviar áudio → T-Rex responde ao conteúdo (sem 'pode me escrever?')"
