# Ativação das Figurinhas do T-Rex no Render

**Status:** código 100% implementado em produção (branch `fix/kytto-comandas-pdv-20260808`).
**Único passo pendente:** adicionar 3 variáveis de ambiente no painel do Render.

---

## Pré-requisito: implementar a rota no NestJS

O SetPoint envia a figurinha para o backend NestJS da Dino (`chatbot-backend-nestjs`) via:

```
POST {CHATBOT_BACKEND_URL}/api/v1/whats-app/send-sticker
Headers: X-API-KEY: <CHATBOT_BACKEND_KEY>
Body:
{
  "instanceName": "dino",
  "chat_id": "5565999990001",
  "sticker": {
    "url": "https://setpoint.kytto.com.br/figurinhas/trex-agendado.webp",
    "base64": "<WebP em base64>",
    "mimetype": "image/webp"
  }
}
→ 200 { "success": true }
```

Implementação de referência: `docs/operations/WHATSAPP-BACKEND-FIGURINHA.md`.

> **Sem esta rota implementada**, o SetPoint vai tentar enviar, receber 404 e registrar
> `unsupported: true` nos logs — mas o atendimento de texto continua sem interrupção.

---

## Variáveis para adicionar no Render (serviço `setpoint`)

Acesse: **Render → setpoint → Environment → Add Environment Variable**

| Variável | Valor | Obrigatório para |
|---|---|---|
| `WHATSAPP_STICKERS` | `on` | Ligar o módulo (padrão: desligado) |
| `CHATBOT_BACKEND_STICKER_PATH` | `/send-sticker` | Rota do NestJS |
| `PUBLIC_BASE_URL` | `https://setpoint.kytto.com.br` | URL pública dos WebPs (fallback ao base64) |

Após salvar, o Render reinicia o serviço automaticamente (~30 s).

---

## O que já está implementado (sem necessidade de PR)

### Código (branch `fix/kytto-comandas-pdv-20260808`)

| Arquivo | Função |
|---|---|
| `app/core/whatsapp-stickers.js` | Lógica de escolha de mood, rate limiting (1/4h, 3/dia), leitura de WebP |
| `app/core/whatsapp.js` → `enviarFigurinha()` | Envia sticker via backend NestJS (`chatbot_backend`) ou Evolution API |
| `app/core/whatsapp-provider.js` → `sendStickerViaChatbotBackend()` | Chamada HTTP `POST /send-sticker` com `url` + `base64` + `mimetype` |
| `app/core/whatsapp-ai.js` → `enviarFigurinhaDoMomento()` | Integração no pipeline da IA: depois do texto, nos momentos certos |
| `app/core/whatsapp-figurinhas.js` → `enviarFigurinhaPersona()` | Variante para canais com persona ativada |

### Figurinhas WebP

**13 arquivos já servidos em produção** (`HTTP 200`):
```
https://setpoint.kytto.com.br/figurinhas/trex-ola.webp       ✅
https://setpoint.kytto.com.br/figurinhas/trex-agendado.webp   ✅
https://setpoint.kytto.com.br/figurinhas/trex-lembrete.webp   ✅
https://setpoint.kytto.com.br/figurinhas/trex-confirmado.webp ✅
https://setpoint.kytto.com.br/figurinhas/trex-chegando.webp   ✅
https://setpoint.kytto.com.br/figurinhas/trex-valeu.webp      ✅
https://setpoint.kytto.com.br/figurinhas/trex-cheiroso.webp   ✅
https://setpoint.kytto.com.br/figurinhas/trex-parabens.webp   ✅
https://setpoint.kytto.com.br/figurinhas/trex-corte.webp      ✅
https://setpoint.kytto.com.br/figurinhas/trex-pensando.webp   ✅
https://setpoint.kytto.com.br/figurinhas/trex-desculpa.webp   ✅
https://setpoint.kytto.com.br/figurinhas/trex-promo.webp      ✅
https://setpoint.kytto.com.br/figurinhas/trex-neutro.webp     ✅
```

---

## Momentos em que a figurinha é enviada

| Mood | Quando |
|---|---|
| `ola` | Primeiro contato do cliente (sem privacy_notice_at) |
| `agendado` | Agendamento ou remarcação confirmados |
| `confirmado` | Cliente confirmou presença (`confirmar_presenca`) |
| `chegando` | Cliente avisou atraso (`avisar_atraso`) |
| `cheiroso` | Pedido de produto confirmado |
| `valeu` | Personalização autorizada |
| `desculpa` | Confirmação que falhou (`confirmation_failed`) |

**Nunca enviada** em: handoff para humano, opt-out, bloqueio, `promo`, `parabens` (estas são de campanha).

---

## Como testar após configurar as env vars

1. No Render, certifique-se que `WHATSAPP_EGRESS_MODE=on` (ou `pilot` com seu número em `WHATSAPP_POLL_PILOT_PHONES`).
2. Pelo WhatsApp, envie uma mensagem para o número do Dino (ex.: "oi").
3. Confirme um agendamento respondendo "SIM".
4. Deve chegar o texto de confirmação e, ~1 s depois, a figurinha `trex-agendado.webp`.
5. Verifique no banco: `SELECT estado->'figurinhas' FROM whatsapp_ai_sessions ORDER BY atualizado_em DESC LIMIT 1`.

---

## Logs de diagnóstico

```bash
# No Render Shell ou via Render CLI:
# Procure por:
[WhatsApp] figurinha não enviada: STICKER_ROUTE_NOT_CONFIGURED  → falta CHATBOT_BACKEND_STICKER_PATH
[WhatsApp] figurinha não enviada: desligadas                     → falta WHATSAPP_STICKERS=on
[WhatsApp] figurinha enviada: agendado                           → ✅ funcionando
```

---

*Documento criado em 06/10/2026. Código 100% implementado e testado (HTTP 200 para todos os WebPs).*
