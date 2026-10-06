# PROMPT — Subir figurinha, mídia e foto de perfil no backend de WhatsApp da Dino

> Cole este prompt inteiro no agente (Claude Code, Codex, Manus…) **aberto dentro do repositório `chatbot-backend-nestjs`**, junto com a pasta `chatbot-backend-whatsapp-extras/` (vem do repositório agro-open, em `integracoes/chatbot-backend-whatsapp-extras/`).

---

## Contexto

Você está no `chatbot-backend-nestjs`, o backend de WhatsApp usado pela Isa/NossaGente e, em **deploy separado no Cloud Run**, pela **Barbearia Dino** (instância `dino`, linha +55 65 9660-4681). O SetPoint/Kytto (repositório agro-open, serviço Render `setpoint`) já chama este backend em `/api/v1/whats-app/*` com `POST /send` (texto) e `GET /messages`.

O SetPoint **já está pronto** para três recursos novos, que só faltam aqui no backend:

1. **Figurinha do T-Rex** — `POST /api/v1/whats-app/send-sticker`
2. **Áudio e foto do cliente** — `GET /api/v1/whats-app/messages/:id/media` (hoje o cliente que manda áudio recebe "pode me escrever?")
3. **Foto de perfil com o T-Rex** — `POST /api/v1/whats-app/instances/:name/profile-picture`

O código já está escrito e testado (15 testes) em `chatbot-backend-whatsapp-extras/src/whatsapp-extras/`. Seu trabalho é **integrar, testar, publicar no deploy da Dino e validar**.

## Regras (não negociáveis)

- **Só o deploy da Dino.** Nunca publique no serviço Cloud Run da Isa (URL `chatbot-backend-nestjs-…us-east1.run.app` da Isa) nem altere a instância dela. LGPD: números e sessões são isolados.
- Não mude o contrato existente (`/send`, `/messages`, `/instances/*`). Só **adicione** rotas.
- Não grave mídia em disco, banco ou log. Nada de `console.log` com base64, número ou conteúdo.
- Mesma autenticação das rotas existentes. Se o projeto já tem um guard de API key, aplique o dele e use `useOwnGuard: false`.
- Trabalhe em branch e PR. Não faça push direto na branch principal.

## Passo 1 — Reconhecer o projeto (antes de mexer)

Descubra e anote:

- Qual biblioteca de WhatsApp o projeto usa: `whatsapp-web.js` ou `@whiskeysockets/baileys` (`package.json`).
- Onde o `POST /send` resolve o cliente pelo `instanceName` (ex.: `WhatsAppService.getClient(name)`, um `Map` de clientes, `clientFor(...)`). As rotas novas **têm que usar a mesma função**.
- Como o `/send` autentica (guard, middleware, variável de ambiente da chave).
- Se o app usa `app.setGlobalPrefix('api/v1')`. Se usar, troque `WHATSAPP_EXTRAS_ROUTE` em `whatsapp-extras.controller.ts` de `'api/v1/whats-app'` para `'whats-app'`. A URL final precisa ser exatamente `/api/v1/whats-app/send-sticker`.
- Baileys: onde o projeto trata `sock.ev.on('messages.upsert', …)`.
- Versão do whatsapp-web.js: `setProfilePicture` existe a partir da 1.21 e `getMessageById` a partir da 1.23. Sem `getMessageById`, o módulo procura a mensagem nas últimas 50 do chat (precisa do `chatId`, que o SetPoint manda).

## Passo 2 — Integrar

1. Copie `chatbot-backend-whatsapp-extras/src/whatsapp-extras/` para `src/whatsapp-extras/` (exceto `*.spec.ts`, se preferir colocá-lo na pasta de testes do projeto; ele também roda ali).
2. Registre o módulo no `AppModule` (ou no módulo de WhatsApp), usando a mesma resolução de cliente do `/send`:

```ts
import { WhatsappExtrasModule } from './whatsapp-extras';
// whatsapp-web.js:
import { MessageMedia } from 'whatsapp-web.js';
// Baileys:
// import { downloadMediaMessage } from '@whiskeysockets/baileys';

WhatsappExtrasModule.forRootAsync({
  imports: [WhatsAppModule],                 // o módulo que já existe
  inject: [WhatsAppService],                 // o serviço que o /send usa
  useFactory: (wa: WhatsAppService) => ({
    apiKey: process.env.API_KEY,             // a MESMA variável da chave do /send
    resolveClient: (name) => wa.getClient(name),          // AJUSTE ao nome real
    isConnected: (name) => wa.isAuthenticated?.(name) ?? true,
    requireInstanceName: true,               // backend multi-instância (Dino usa instanceName)
    wwebjsMessageMedia: MessageMedia,        // só whatsapp-web.js
    // baileysDownload: downloadMediaMessage, // só Baileys
  }),
}),
```

   Backend de instância única: `resolveClient: () => wa.client` e `requireInstanceName: false`.

3. **Somente Baileys:** no handler de `messages.upsert` já existente, injete `BaileysMediaStore` e chame
   `store.rememberAll(instanceName, messages)`. O store guarda só a mensagem (chaves de mídia), em memória, com limite de 2.000 itens e 24 h.
4. **Limite do corpo JSON:** o padrão do Nest é 100 KB. A foto de perfil em base64 passa disso. No `main.ts`:
   `app.useBodyParser('json', { limit: '5mb' })` (Nest ≥ 10, com `NestFactory.create<NestExpressApplication>(AppModule)`), ou `app.use(json({ limit: '5mb' }))`. As figurinhas (< 30 KB) cabem no padrão.
5. As rotas só aceitam URL de mídia vinda de `https://setpoint.kytto.com.br` ou `https://dino.kytto.com.br` (proteção contra SSRF). Preferência: base64.

## Passo 3 — Testar localmente

```bash
npm run build
npx jest src/whatsapp-extras   # 15 testes devem passar
npm test                       # suíte inteira do projeto continua verde
```

Se o lint do projeto reclamar de `require` dinâmico, mantenha a injeção (`wwebjsMessageMedia` / `baileysDownload`) e remova o fallback `require(...)` correspondente.

## Passo 4 — Publicar (somente o Cloud Run da Dino)

1. Abra PR, revise e faça o merge na branch que alimenta o deploy da **Dino**.
2. Publique no serviço Cloud Run **da Dino**, com a mesma imagem/versão do processo atual (`gcloud run deploy <servico-da-dino> …`). Confirme o nome do serviço e o projeto antes. **Não** publique no serviço da Isa.
3. Depois do deploy, a sessão do WhatsApp continua (volume/sessão persistida como hoje). Se o processo reiniciar e pedir QR, gere no painel do SetPoint em `/admin/whatsapp` → **Gerar QR**.

## Passo 5 — Validar no ar (curl)

Use `BASE=https://<url-do-backend-da-dino>` e `KEY=<chave do /send da Dino>`.

```bash
# 1) Rota existe e exige chave (esperado: 401)
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/v1/whats-app/send-sticker

# 2) Figurinha para o número de teste (esperado: {"success":true,...})
curl -s -X POST $BASE/api/v1/whats-app/send-sticker -H "x-api-key: $KEY" -H 'content-type: application/json' \
  -d '{"instanceName":"dino","chat_id":"5514997462929","sticker":{"url":"https://setpoint.kytto.com.br/figurinhas/trex-ola.webp","mimetype":"image/webp"}}'

# 3) Foto de perfil com o T-Rex (esperado: {"success":true})
curl -s -X POST $BASE/api/v1/whats-app/instances/dino/profile-picture -H "x-api-key: $KEY" -H 'content-type: application/json' \
  -d '{"url":"https://setpoint.kytto.com.br/brand/dino-whatsapp-perfil-640.png"}'

# 4) Mídia: do celular de teste, mande um áudio para a Dino; pegue o id e baixe
curl -s "$BASE/api/v1/whats-app/messages?role=user&latest=true" -H "x-api-key: $KEY"   # whatsappMessageId do item de áudio
curl -s "$BASE/api/v1/whats-app/messages/<ID>/media?instance=dino&chatId=5514997462929" -H "x-api-key: $KEY" | head -c 200
# esperado: {"base64":"...","mimetype":"audio/ogg; codecs=opus"}
```

Confira se o **id que `GET /messages` devolve** é o mesmo que a rota de mídia aceita. Se `/messages` devolver outro formato (ex.: só `id.id` em vez de `_serialized`), o módulo já tenta os dois no whatsapp-web.js. No Baileys, o id é `key.id`.

## Passo 6 — Ligar no SetPoint (Render → serviço `setpoint` → Environment)

Só depois do Passo 5 verde:

| Variável | Valor |
|---|---|
| `CHATBOT_BACKEND_STICKER_PATH` | `/send-sticker` |
| `CHATBOT_BACKEND_MEDIA_PATH` | `/messages/{id}/media?instance={instance}&chatId={chatId}` |
| `WHATSAPP_STICKERS` | `on` (já está) |

Salve com **Save and deploy**. Regras do repositório agro-open (`AGENTS.md`): não mexa em branch, build, pre-deploy nem auto-deploy do Render; produção é a branch `fix/kytto-comandas-pdv-20260808`.

## Passo 7 — Teste de ponta a ponta (celular de teste 14 99746-2929)

1. Mande "oi" para a Dino: chega a resposta do T-Rex e, logo depois, a figurinha **"E aí!"**.
2. Marque um horário e confirme: chega **"Agendado!"**.
3. Mande um áudio ("quero cortar amanhã às 10"): o T-Rex responde ao conteúdo, sem "pode me escrever?".
4. Abra o contato da Dino: a foto é o T-Rex.
5. Em `/admin/whatsapp` (empresa Barbearia Dino), o diagnóstico continua todo verde.

## Entrega esperada

- Link do PR no `chatbot-backend-nestjs` e o hash publicado no Cloud Run da Dino.
- Saída dos 4 curls do Passo 5.
- Confirmação das variáveis do Passo 6 e do teste do Passo 7.
- Se algo divergir (biblioteca diferente, id de mensagem em outro formato, prefixo de rota), descreva o que ajustou.

## Se der errado

- Figurinha falha → remova `CHATBOT_BACKEND_STICKER_PATH` no Render: o atendimento em texto segue normal.
- Mídia falha → remova `CHATBOT_BACKEND_MEDIA_PATH`: volta a resposta fixa pedindo texto.
- Backend instável → reverta o deploy da Dino no Cloud Run para a revisão anterior (`gcloud run services update-traffic <servico-da-dino> --to-revisions <anterior>=100`).
