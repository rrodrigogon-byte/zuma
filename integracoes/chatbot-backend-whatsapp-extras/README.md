# Rotas extras do backend de WhatsApp (Dino / T-Rex)

Módulo NestJS pronto para o `chatbot-backend-nestjs` (o mesmo software da Isa/NossaGente, deploy próprio da Dino).
Funciona com **whatsapp-web.js** ou **Baileys** (detecta pelo cliente). 15 testes cobrindo os dois.

| Rota (prefixo `/api/v1/whats-app`) | Para quê | Liga no SetPoint (Render) |
|---|---|---|
| `POST /send-sticker` | Figurinha WebP do T-Rex | `CHATBOT_BACKEND_STICKER_PATH=/send-sticker` |
| `GET /messages/:id/media?instance=&chatId=` | Áudio e foto que o cliente mandou → `{ base64, mimetype }` | `CHATBOT_BACKEND_MEDIA_PATH=/messages/{id}/media?instance={instance}&chatId={chatId}` |
| `POST /instances/:name/profile-picture` | Foto de perfil da linha (o T-Rex) | — (chamada única por curl) |

Autenticação: a mesma chave do `/send` (`X-API-KEY`, `apikey` ou `Authorization: Bearer`).

## Testar o pacote isolado

```bash
npm install && npm run typecheck && npm test
```

Integração passo a passo: `PROMPT-SUBIR-BACKEND-WHATSAPP-DINO.md`.
