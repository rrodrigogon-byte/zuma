# Backend do WhatsApp: enquete (opções para tocar)

**Para quem:** quem mantém o `chatbot-backend-nestjs` (mesmo software da Isa/NossaGente).
**Por quê:** a IA de atendimento (Stallone, Dino) passa a mandar as escolhas como **enquete**, igual à Isa nas aprovações ("Como você decide? ✅ Aprovar / ❌ Reprovar"). O cliente só toca na opção: sabores e tamanhos com preço, retirada ou entrega, Pix ou cartão, horários e a confirmação do pedido.
**Sem a rota:** nada quebra. O SetPoint manda as mesmas opções numeradas em texto (1️⃣ 2️⃣ 3️⃣) e entende a resposta pelo número ou pelo nome.

## 1. Envio

```
POST /api/v1/whats-app/send-poll            (caminho em CHATBOT_BACKEND_POLL_PATH)
Headers: X-API-KEY: <mesma chave das outras rotas>
Body:
{
  "instanceName": "stallone-1",             // modo multi-instância
  "chat_id": "5565999990001",               // mesmo formato do /send
  "poll": {
    "name": "Qual whey chocolate branco você prefere?",   // até 255 caracteres
    "options": ["Isolado 450g — R$ 329", "Sachê 4 cx — R$ 89"],  // 2 a 12, até 100 cada
    "selectableCount": 1
  }
}
→ 200 { "success": true, "messageId": "..." }
```

| Status | Significado para o SetPoint |
| --- | --- |
| 2xx `success: true` | enviada |
| 404/405 | rota não existe: manda as opções em texto |
| outro 4xx | recusada: manda as opções em texto |
| 5xx / timeout | incerto: não reenvia nada |

> Se a Isa já tem uma rota de enquete com outro nome, basta apontar `CHATBOT_BACKEND_POLL_PATH` para ela, desde que o corpo seja este. `{instance}` no caminho é trocado pela instância.

## 2. Voto (entrada)

O SetPoint lê as mensagens por `GET /messages` (como a Isa). O voto precisa aparecer ali como mensagem do cliente (`role: "user"`), em qualquer um destes formatos:

```json
{ "chatId": "5565999990001", "role": "user", "messageType": "poll_vote",
  "selectedOptions": ["Isolado 450g — R$ 329"], "content": "Isolado 450g — R$ 329",
  "whatsappMessageId": "<id do voto>", "timestamp": "2026-10-30T18:40:00Z" }
```

- `selectedOptions` pode ser lista de textos ou de `{ "name": "..." }`.
- Sem `selectedOptions`, vale `content` com o texto da opção, ou `content` em JSON com `selectedOptions`.
- Voto trocado gera nova mensagem (outro `whatsappMessageId`).

## 3. Implementação de referência

### whatsapp-web.js

```ts
import { Poll } from 'whatsapp-web.js';

@Post('send-poll')
async sendPoll(@Body() body: { instanceName?: string; chat_id: string; poll: { name: string; options: string[]; selectableCount?: number } }) {
  const client = this.clientFor(body.instanceName);              // mesma resolução de instância do /send
  const chatId = `${String(body.chat_id).replace(/\D/g, '')}@c.us`;
  const options = (body.poll?.options || []).slice(0, 12);
  const msg = await client.sendMessage(chatId, new Poll(body.poll.name, options, { allowMultipleAnswers: (body.poll.selectableCount || 1) > 1 }));
  return { success: true, messageId: msg?.id?._serialized };
}

// Voto → mesma tabela/fluxo das mensagens recebidas (aparece no GET /messages)
client.on('vote_update', async (vote) => {
  const chatId = String(vote.voter || '').replace(/@.*/, '');
  const selected = (vote.selectedOptions || []).map((o) => o.name);
  await this.messages.saveInbound({
    instanceName, chatId, role: 'user', messageType: 'poll_vote',
    content: selected.join(', '), selectedOptions: selected,
    whatsappMessageId: `${vote.parentMessage?.id?._serialized}:${vote.interractedAtTs}`,
    timestamp: new Date((vote.interractedAtTs || Date.now() / 1000) * 1000),
  });
});
```

### Baileys

```ts
import { getAggregateVotesInPollMessage } from '@whiskeysockets/baileys';

@Post('send-poll')
async sendPoll(@Body() body) {
  const sock = this.socketFor(body.instanceName);
  const jid = `${String(body.chat_id).replace(/\D/g, '')}@s.whatsapp.net`;
  const sent = await sock.sendMessage(jid, { poll: { name: body.poll.name, values: body.poll.options.slice(0, 12), selectableCount: body.poll.selectableCount || 1 } });
  this.pollStore.set(sent.key.id, sent);                       // guarda para decifrar os votos
  return { success: true, messageId: sent.key.id };
}

sock.ev.on('messages.update', async (updates) => {
  for (const { key, update } of updates) {
    if (!update.pollUpdates) continue;
    const poll = this.pollStore.get(key.id);
    if (!poll) continue;
    const votos = getAggregateVotesInPollMessage({ message: poll.message, pollUpdates: update.pollUpdates });
    const selected = votos.filter((v) => v.voters.length).map((v) => v.name);
    await this.messages.saveInbound({ instanceName, chatId: key.remoteJid.replace(/@.*/, ''), role: 'user', messageType: 'poll_vote',
      content: selected.join(', '), selectedOptions: selected, whatsappMessageId: `${key.id}:${Date.now()}`, timestamp: new Date() });
  }
});
```

## 4. Ligar

Já vem ligado: o SetPoint usa `/send-poll` por padrão. Backend sem a rota responde 404 e o cliente recebe as opções numeradas. Para desligar tudo: `CHATBOT_BACKEND_POLL_PATH=off` no Render; só uma loja: `configuracao.enquetes = false` no canal.

Implementação real: `tai-uisa/chatbot-backend-nestjs`, branch `feat/enquete-opcoes` (rota `POST /send-poll`, voto pelo mesmo `handlePollVote` da aprovação, conteúdo = texto da opção).

## Regras que o SetPoint já aplica

- Mesma trava de saída do texto (empresa dona da instância, canal ativo, `WHATSAPP_EGRESS_MODE`).
- Enquete só depois do texto; uma por resposta; nunca com a conversa na equipe nem nos canais internos (gestão/lançamentos).
- Opções só de dados reais das ferramentas (catálogo, frete, pagamento, agenda). A confirmação de pedido/agendamento vai como enquete "✅ Sim, confirmar / ✏️ Quero mudar / ❌ Cancelar", que casam com as palavras explícitas de confirmação: o SIM/NÃO em texto continua valendo.
