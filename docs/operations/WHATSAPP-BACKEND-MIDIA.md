# Backend do WhatsApp: rota de mídia (áudio e foto do cliente)

**Para quem:** quem mantém o `chatbot-backend-nestjs` (mesmo software da Isa/NossaGente).
**Por quê:** a Dino já transcreve áudio e descreve foto com o Gemini, mas hoje o backend entrega só o marcador `content: "[ÁUDIO RECEBIDO]"`, sem o arquivo. Enquanto a rota não existir, o cliente que manda áudio recebe "pode me escrever?".
**Esforço:** uma rota GET, sem banco novo. A mídia não precisa ser armazenada: é baixada do WhatsApp sob demanda.

> **Código pronto e testado:** `integracoes/chatbot-backend-whatsapp-extras/`. No Render use `CHATBOT_BACKEND_MEDIA_PATH=/messages/{id}/media?instance={instance}&chatId={chatId}`. Passo a passo: `integracoes/chatbot-backend-whatsapp-extras/PROMPT-SUBIR-BACKEND-WHATSAPP-DINO.md`.

## Contrato

```
GET /api/v1/whats-app/messages/{whatsappMessageId}/media
Headers: X-API-KEY: <mesma chave das outras rotas>
Query opcional: chatId=5565999990001  (ajuda a localizar a mensagem)
                instance=dino          (backend multi-instância)
```

Respostas aceitas pelo SetPoint (qualquer uma):

| Status | Corpo | Uso |
| --- | --- | --- |
| 200 | `{ "base64": "<dados>", "mimetype": "audio/ogg; codecs=opus" }` | **recomendado** |
| 200 | binário com `Content-Type: audio/ogg` | também aceito |
| 404 | `{ "error": "not found" }` | mensagem expirou ou não tem mídia → resposta fixa ao cliente |

Limites que o SetPoint aplica: até `WHATSAPP_AI_MEDIA_MAX_MB` (padrão 12 MB); só `audio/*` e `image/*`.

**Ligar na Dino** (sem deploy de código no SetPoint): no Render, `CHATBOT_BACKEND_MEDIA_PATH=/messages/{id}/media`. O SetPoint troca `{id}` pelo `whatsappMessageId` (e aceita `{chatId}` e `{instance}`). O id do item de `GET /messages` precisa ser o mesmo que essa rota entende.

## Implementação de referência (NestJS)

### Se o backend usa `whatsapp-web.js` (ids `@c.us`)

```ts
// whats-app.controller.ts
@Get('messages/:id/media')
async media(@Param('id') id: string, @Query('chatId') chatId?: string, @Res() res?: Response) {
  const msg = await this.whatsApp.findMessage(id, chatId); // client.getMessageById(id) ou varrer o chat
  if (!msg?.hasMedia) return res.status(404).json({ error: 'not found' });
  const media = await msg.downloadMedia(); // MessageMedia { mimetype, data (base64) }
  if (!media?.data) return res.status(404).json({ error: 'not found' });
  if (!/^(audio|image)\//.test(media.mimetype)) return res.status(415).json({ error: 'unsupported' });
  return res.json({ base64: media.data, mimetype: media.mimetype });
}
```

`findMessage`: `client.getMessageById(id)` (whatsapp-web.js ≥ 1.23). Se não houver, `(await client.getChatById(chatId)).fetchMessages({ limit: 50 })` e filtrar por `m.id._serialized === id || m.id.id === id`.

### Se o backend usa Baileys

```ts
import { downloadMediaMessage } from '@whiskeysockets/baileys';

@Get('messages/:id/media')
async media(@Param('id') id: string, @Res() res: Response) {
  const msg = this.store.messageById(id); // a mensagem guardada quando chegou (messages.upsert)
  if (!msg?.message) return res.status(404).json({ error: 'not found' });
  const buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: this.sock.updateMediaMessage });
  const mimetype = msg.message.audioMessage?.mimetype || msg.message.imageMessage?.mimetype || '';
  if (!/^(audio|image)\//.test(mimetype)) return res.status(415).json({ error: 'unsupported' });
  return res.json({ base64: Buffer.from(buffer).toString('base64'), mimetype });
}
```

## Segurança

- Mesma autenticação `X-API-KEY` das outras rotas; nunca pública.
- Não gravar a mídia em disco nem em log; responder e descartar.
- Instância isolada da Dino (nunca apontar para o backend da Isa: LGPD).

## Como testar

1. Pelo celular de teste, mande um áudio para o número da Dino.
2. `GET /api/v1/whats-app/messages?role=user&latest=true` → pegue o `whatsappMessageId` do item com `messageType: "audio"`.
3. `GET /api/v1/whats-app/messages/<id>/media` → deve voltar `{ base64, mimetype: "audio/ogg..." }`.
4. Configure `CHATBOT_BACKEND_MEDIA_PATH` no Render. O próximo áudio é respondido como texto, e a conversa mostra `[áudio transcrito]`. O simulador do SetPoint já cobre esse caminho (cenários 03, 05, 06 e 28).
