# Backend do WhatsApp: rota de figurinha (T-Rex da Dino)

**Para quem:** quem mantém o `chatbot-backend-nestjs` (mesmo software da Isa/NossaGente), deploy da Dino.
**Por quê:** o atendente da Dino manda uma figurinha do T-Rex em momentos marcados (agendou, confirmou presença, primeiro contato…). O contrato atual do backend só tem `/send` (texto). Sem esta rota, o SetPoint simplesmente não envia figurinha: nada quebra.
**Esforço:** uma rota POST, sem banco novo.

> **Código pronto e testado:** `integracoes/chatbot-backend-whatsapp-extras/` (figurinha, mídia e foto de perfil). Passo a passo para subir: `integracoes/chatbot-backend-whatsapp-extras/PROMPT-SUBIR-BACKEND-WHATSAPP-DINO.md`.

## Contrato

```
POST /api/v1/whats-app/send-sticker
Headers: X-API-KEY: <mesma chave das outras rotas>
Body:
{
  "instanceName": "dino",               // modo multi-instância (obrigatório nesse modo)
  "chat_id": "5565999990001",           // mesmo formato do /send
  "sticker": {
    "url": "https://setpoint.kytto.com.br/figurinhas/trex-agendado.webp",
    "base64": "<WebP 512x512 em base64>",   // sempre enviado; prefira usar este
    "mimetype": "image/webp"
  }
}
```

| Status | Corpo | Significado para o SetPoint |
| --- | --- | --- |
| 200 | `{ "success": true }` | enviada (aceita na fila) |
| 4xx | `{ "error": "..." }` | recusada, não tenta de novo |
| 5xx / timeout | — | resultado incerto, não reenvia |

**Ligar na Dino** (sem deploy de código no SetPoint), no Render:
- `CHATBOT_BACKEND_STICKER_PATH=/send-sticker`
- `WHATSAPP_STICKERS=on`
- `PUBLIC_BASE_URL=https://setpoint.kytto.com.br` (para a URL pública dos arquivos)

## Implementação de referência (NestJS)

### Backend com `whatsapp-web.js`

```ts
import { MessageMedia } from 'whatsapp-web.js';

@Post('send-sticker')
async sendSticker(@Body() body: { instanceName?: string; chat_id: string; sticker: { base64?: string; url?: string; mimetype?: string } }) {
  const client = this.clientFor(body.instanceName);           // mesma resolução de instância do /send
  const chatId = `${String(body.chat_id).replace(/\D/g, '')}@c.us`;
  const media = body.sticker?.base64
    ? new MessageMedia(body.sticker.mimetype || 'image/webp', body.sticker.base64, 'figurinha.webp')
    : await MessageMedia.fromUrl(body.sticker.url, { unsafeMime: true });
  await client.sendMessage(chatId, media, {
    sendMediaAsSticker: true,
    stickerName: 'T-Rex',
    stickerAuthor: 'Dino Barbearia',
  });
  return { success: true };
}
```

### Backend com Baileys

```ts
@Post('send-sticker')
async sendSticker(@Body() body) {
  const sock = this.socketFor(body.instanceName);
  const jid = `${String(body.chat_id).replace(/\D/g, '')}@s.whatsapp.net`;
  const buffer = body.sticker?.base64 ? Buffer.from(body.sticker.base64, 'base64') : undefined;
  await sock.sendMessage(jid, { sticker: buffer ?? { url: body.sticker.url } });
  return { success: true };
}
```

## Regras que o SetPoint já aplica (o backend não precisa repetir)

- Mesma trava de saída do texto: empresa dona da instância, canal ativo, `WHATSAPP_EGRESS_MODE` (piloto/on).
- Figurinha só depois da resposta em texto; no máximo 1 a cada 4 h e 3 por dia por conversa; nunca a mesma em seguida.
- Momentos: primeiro contato (`ola`), agendamento/remarcação confirmados (`agendado`), presença confirmada (`confirmado`), atraso avisado (`chegando`), pedido confirmado (`cheiroso`), personalização autorizada (`valeu`), confirmação que falhou (`desculpa`). Nunca em encaminhamento para humano, opt-out ou bloqueio de segurança.
- `promo` e `parabens` são de campanha com opt-in de marketing, nunca do atendimento.

## Arquivos

`web/public/figurinhas/trex-*.webp` (13 figurinhas, 512x512, fundo transparente, < 30 KB cada) e `tray.png` (96x96). Para refazer depois de mudar o desenho: `tools/figurinhas/README.md`.

## Como testar

1. No Render: as três variáveis acima (comece com `WHATSAPP_EGRESS_MODE=pilot` e o seu número em `WHATSAPP_POLL_PILOT_PHONES`).
2. Pelo celular de teste, marque um horário com o T-Rex e responda SIM.
3. Deve chegar a mensagem "Agendamento confirmado…" e, logo depois, a figurinha "Agendado!".
4. No banco: `whatsapp_ai_sessions.estado->'figurinhas'` registra `{ mood: "agendado", em: … }`.
