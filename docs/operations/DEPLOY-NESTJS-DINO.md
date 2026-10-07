# Runbook — Deploy do chatbot-backend-nestjs para a Dino

> **Quem executa:** dev com acesso ao repositório `chatbot-backend-nestjs` e ao GCP da Dino.
> **Onde está o módulo:** `agro-open/integracoes/chatbot-backend-whatsapp-extras/`
> **Última revisão:** 2026-10-07

---

## Estado atual (o que já está pronto)

### ✅ SetPoint / agro-open (Render)

| Var | Valor | Status |
|-----|-------|--------|
| `WHATSAPP_STICKERS` | `on` | ✅ configurada |
| `PUBLIC_BASE_URL` | `https://setpoint.kytto.com.br` | ✅ configurada |
| `CHATBOT_BACKEND_STICKER_PATH` | `/send-sticker` | ✅ configurada |
| `CHATBOT_BACKEND_MEDIA_PATH` | `/messages/{id}/media?instance={instance}&chatId={chatId}` | ❌ aguarda NestJS |
| `CHATBOT_BACKEND_URL` | URL do Cloud Run da Dino | ❌ ausente (verificar Secret Manager GCP) |

### ✅ Código pronto (no módulo)

| Arquivo | O que faz |
|---------|-----------|
| `src/whatsapp-extras/whatsapp-extras.controller.ts` | 3 rotas HTTP |
| `src/whatsapp-extras/whatsapp-extras.service.ts` | lógica completa (wwebjs + Baileys) |
| `src/whatsapp-extras/whatsapp-extras.module.ts` | `forRoot` + `forRootAsync` |
| `src/whatsapp-extras/api-key.guard.ts` | autenticação timing-safe |
| `src/whatsapp-extras/baileys-media-store.ts` | cache Baileys (max 2000, TTL 24h) |
| `src/whatsapp-extras/whatsapp-extras.spec.ts` | 15 testes |

### WebPs do T-Rex (13 figurinhas — todos HTTP 200 em produção)

```
https://setpoint.kytto.com.br/figurinhas/trex-ola.webp
https://setpoint.kytto.com.br/figurinhas/trex-agendado.webp
https://setpoint.kytto.com.br/figurinhas/trex-lembrete.webp
https://setpoint.kytto.com.br/figurinhas/trex-confirmado.webp
https://setpoint.kytto.com.br/figurinhas/trex-chegando.webp
https://setpoint.kytto.com.br/figurinhas/trex-valeu.webp
https://setpoint.kytto.com.br/figurinhas/trex-cheiroso.webp
https://setpoint.kytto.com.br/figurinhas/trex-parabens.webp
https://setpoint.kytto.com.br/figurinhas/trex-corte.webp
https://setpoint.kytto.com.br/figurinhas/trex-pensando.webp
https://setpoint.kytto.com.br/figurinhas/trex-desculpa.webp
https://setpoint.kytto.com.br/figurinhas/trex-promo.webp
https://setpoint.kytto.com.br/figurinhas/trex-neutro.webp
```

---

## Passo 1 — Reconhecer o projeto `chatbot-backend-nestjs`

Antes de tocar em qualquer arquivo, descubra e anote:

```bash
# No diretório do chatbot-backend-nestjs:
cat package.json | grep -E '"whatsapp-web|baileys|@whiskey'
```

- **whatsapp-web.js** → use `wwebjsMessageMedia: MessageMedia` na config do módulo
- **@whiskeysockets/baileys** → use `baileysDownload: downloadMediaMessage`

```bash
# Onde o /send resolve o cliente (ex: WhatsAppService.getClient, clientFor, this.clients.get):
grep -r "getClient\|clientFor\|clients\.get\|this\.client" src/ --include="*.ts" | head -10

# Se o app usa globalPrefix:
grep "setGlobalPrefix\|globalPrefix" src/main.ts
```

Se usar `app.setGlobalPrefix('api/v1')`, mude `WHATSAPP_EXTRAS_ROUTE` em  
`src/whatsapp-extras/whatsapp-extras.controller.ts` de `'api/v1/whats-app'` para `'whats-app'`.

---

## Passo 2 — Copiar o módulo

```bash
# Clone ou pull do agro-open para ter o módulo atualizado
git clone https://github.com/rrodrigogon-byte/agro-open.git /tmp/agro-open --depth=1

# Copiar o módulo
cp -r /tmp/agro-open/integracoes/chatbot-backend-whatsapp-extras/src/whatsapp-extras \
       src/whatsapp-extras

# O spec pode ficar junto ou na pasta de testes do projeto — ambos funcionam
```

---

## Passo 3 — Registrar no AppModule

Edite `src/app.module.ts` (ou o módulo de WhatsApp existente):

```typescript
// ── whatsapp-web.js ──────────────────────────────────────────────────────────
import { MessageMedia } from 'whatsapp-web.js';
import { WhatsappExtrasModule } from './whatsapp-extras';

// No array imports do @Module:
WhatsappExtrasModule.forRootAsync({
  imports: [WhatsAppModule],        // ← módulo que já existe
  inject: [WhatsAppService],        // ← serviço que o /send usa
  useFactory: (wa: WhatsAppService) => ({
    apiKey: process.env.API_KEY,    // ← mesma chave do /send
    resolveClient: (name) => wa.getClient(name),    // ← AJUSTE ao nome real
    isConnected: (name) => wa.isAuthenticated?.(name) ?? true,
    requireInstanceName: true,      // backend multi-instância (Dino usa 'dino')
    wwebjsMessageMedia: MessageMedia,
  }),
}),
```

```typescript
// ── Baileys (alternativa) ────────────────────────────────────────────────────
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { WhatsappExtrasModule } from './whatsapp-extras';

WhatsappExtrasModule.forRootAsync({
  imports: [WhatsAppModule],
  inject: [WhatsAppService],
  useFactory: (wa: WhatsAppService) => ({
    apiKey: process.env.API_KEY,
    resolveClient: (name) => wa.getSocket(name),    // ← AJUSTE
    requireInstanceName: true,
    baileysDownload: downloadMediaMessage,
  }),
}),
```

### Somente Baileys: injetar BaileysMediaStore

No handler `messages.upsert` existente do serviço de WhatsApp:

```typescript
import { BaileysMediaStore } from './whatsapp-extras';

// Injete o BaileysMediaStore via construtor do serviço:
constructor(
  private readonly baileysStore: BaileysMediaStore,
  // ... outros injetados
) {}

// No handler de messages.upsert:
sock.ev.on('messages.upsert', ({ messages }) => {
  this.baileysStore.rememberAll(instanceName, messages);
  // ... lógica existente
});
```

### Aumentar limit do body (necessário para foto de perfil, que pode ter > 100 KB)

No `src/main.ts`:

```typescript
// Nest ≥ 10 com NestExpressApplication:
import { NestExpressApplication } from '@nestjs/platform-express';
const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.useBodyParser('json', { limit: '5mb' });

// Ou Express direto (qualquer versão):
import { json } from 'express';
app.use(json({ limit: '5mb' }));
```

---

## Passo 4 — Testar localmente

```bash
npm run build

# Módulo específico (15 testes):
npx jest src/whatsapp-extras --verbose

# Suíte completa:
npm test
```

Resultado esperado:
```
✓ autenticação: sem chave → 401 (3 testes)
✓ send-sticker: wwebjs por URL (1 teste)
✓ send-sticker: wwebjs recusa host não permitido (1 teste)
✓ send-sticker: Baileys por base64 (1 teste)
✓ getMedia: wwebjs áudio por ID (1 teste)
✓ getMedia: wwebjs vídeo → 415 (1 teste)
✓ getMedia: Baileys áudio via BaileysMediaStore (1 teste)
✓ getMedia: Baileys sem store → 404 (1 teste)
✓ profile-picture: wwebjs PNG (1 teste)
✓ profile-picture: Baileys (1 teste)
✓ BaileysMediaStore: rememberAll, expiração 24h, limite 2000 (3 testes)

Tests: 15 passed
```

---

## Passo 5 — Criar branch e PR

```bash
git checkout -b feat/dino-whatsapp-extras
git add src/whatsapp-extras/ src/app.module.ts src/main.ts
git commit -m "feat(dino): módulo whatsapp-extras (figurinha, mídia, foto de perfil)"
git push origin feat/dino-whatsapp-extras
# Abrir PR → merge na branch que alimenta o deploy da Dino
```

---

## Passo 6 — Deploy no Cloud Run da Dino

> **NUNCA** publique no serviço da Isa. Confirme o nome do serviço antes.

```bash
# Confirmar qual serviço é o da Dino (não o da Isa):
gcloud run services list --region=<regiao>
# O da Dino provavelmente tem "dino" no nome ou foi descrito assim no setup original

# Build e deploy:
gcloud builds submit --tag gcr.io/<projeto>/chatbot-backend-nestjs-dino:latest
gcloud run deploy <servico-da-dino> \
  --image gcr.io/<projeto>/chatbot-backend-nestjs-dino:latest \
  --region <regiao>

# Ou se usa CI/CD: merge na branch correta → deploy automático
```

Após o deploy, a sessão do WhatsApp continua (volume/sessão persistida).  
Se pedir QR: `Admin → /admin/whatsapp → Gerar QR`

---

## Passo 7 — Validar com o script

```bash
# Clone o agro-open para pegar o script
cp /tmp/agro-open/integracoes/chatbot-backend-whatsapp-extras/scripts/validate-nestjs-dino.sh .
chmod +x validate-nestjs-dino.sh

BASE="https://<url-do-backend-da-dino>" \
KEY="<chave-api>" \
bash validate-nestjs-dino.sh
```

Resultado esperado:
```
✅ Rota raiz acessível (HTTP 200) — backend no ar
✅ Rota existe e exige chave (HTTP 401)
✅ Figurinha enviada com sucesso
✅ Foto de perfil trocada com sucesso
⏭  AUDIO_ID não definido — pule este teste...
```

Para testar áudio:
```bash
# 1. Mande um áudio do celular 14 99746-2929 para a Dino
# 2. Busque o ID:
curl -s "${BASE}/api/v1/whats-app/messages?role=user&latest=true" -H "x-api-key: $KEY"
# 3. Rode o script com o ID:
AUDIO_ID="<id-da-mensagem>" BASE="..." KEY="..." bash validate-nestjs-dino.sh
```

---

## Passo 8 — Configurar env vars no Render (SetPoint)

Só depois do Passo 7 verde:

```bash
# Via Render dashboard ou API (já temos a API key no SetPoint)
RENDER_API_KEY="rnd_2BAX5kNTu8P6R8JqQRadgujBSHkW"
SERVICE_ID="srv-d8iudokm0tmc73c07iog"

# Adicionar CHATBOT_BACKEND_MEDIA_PATH ao payload existente e fazer PUT:
# Valor: /messages/{id}/media?instance={instance}&chatId={chatId}
# (O {id}, {instance}, {chatId} são substituídos em runtime pelo SetPoint)
```

**Ou via dashboard Render:**
1. Acesse https://dashboard.render.com/web/srv-d8iudokm0tmc73c07iog/env
2. Adicione: `CHATBOT_BACKEND_MEDIA_PATH` = `/messages/{id}/media?instance={instance}&chatId={chatId}`
3. Save and deploy

> Regras do `AGENTS.md`: não altere branch, buildCommand, preDeployCommand nem autoDeploy.

---

## Passo 9 — Teste ponta a ponta (celular 14 99746-2929)

1. **Figurinha:** mande "oi" para a Dino (+55 65 9660-4681) → T-Rex responde + `trex-ola.webp` aparece como figurinha
2. **Agendamento:** confirme um horário → `trex-agendado.webp`
3. **Áudio:** mande "quero cortar amanhã às 10" por áudio → T-Rex responde ao conteúdo (sem "pode me escrever?")
4. **Foto:** no celular, abra o contato da Dino → foto é o T-Rex
5. **Diagnóstico:** em `/admin/whatsapp` (empresa Barbearia Dino), todos os itens verdes

---

## Rollback se algo der errado

```bash
# Figurinha falhou → remover sticker path no Render (atendimento texto segue normal):
# CHATBOT_BACKEND_STICKER_PATH → remover

# Mídia falhou → remover media path no Render (volta resposta fixa pedindo texto):
# CHATBOT_BACKEND_MEDIA_PATH → remover

# Backend instável → reverter Cloud Run da Dino:
gcloud run services update-traffic <servico-da-dino> \
  --to-revisions <hash-anterior>=100 \
  --region <regiao>
```

---

## Referências

| Recurso | Local |
|---------|-------|
| Módulo NestJS completo | `agro-open/integracoes/chatbot-backend-whatsapp-extras/` |
| Script de validação | `agro-open/integracoes/chatbot-backend-whatsapp-extras/scripts/validate-nestjs-dino.sh` |
| Guia de ativação (env vars) | `agro-open/docs/operations/ATIVAR-FIGURINHAS-RENDER.md` |
| Validação formal zip vs PROMPT | `agro-open/integracoes/chatbot-backend-whatsapp-extras/VALIDACAO-ZIP-VS-PROMPT.md` |
| WebPs das figurinhas | `agro-open/web/public/figurinhas/trex-*.webp` |
| Foto de perfil | `agro-open/web/public/brand/dino-whatsapp-perfil-640.png` |
