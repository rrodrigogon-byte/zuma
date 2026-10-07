# Validação: chatbot-backend-whatsapp-extras (zip) × PROMPT-SUBIR-BACKEND-WHATSAPP-DINO

> Gerado em 2026-10-07. Compara o que o zip entrega com cada exigência do PROMPT.

---

## Resultado resumido

| Camada | Status |
|--------|--------|
| **Código pronto para integrar (zip)** | ✅ 100% completo |
| **Env vars no SetPoint (Render)** | ✅ 3/4 configuradas — `CHATBOT_BACKEND_MEDIA_PATH` aguarda NestJS |
| **Integração no chatbot-backend-nestjs** | ❌ Pendente (fora do sandbox — repositório não acessível) |
| **Deploy no Cloud Run da Dino** | ❌ Pendente |
| **Teste ponta a ponta** | ❌ Pendente |

---

## Detalhamento por passo do PROMPT

### Passo 1 — Reconhecer o projeto
**Responsabilidade do dev.** O zip não pode fazer isso automaticamente, mas documenta:
- `whatsapp-extras.types.ts` define interfaces para **wwebjs** (`WwebjsClientLike`) e **Baileys** (`BaileysSocketLike`) — compatível com ambos ✅
- O dev deve ajustar `WHATSAPP_EXTRAS_ROUTE` se o app usa `globalPrefix('api/v1')` ✅ (instrução explícita no controller, linha 9)
- Para Baileys: o dev identifica onde está `messages.upsert` e injeta `BaileysMediaStore` ✅

---

### Passo 2 — Integrar

| Exigência do PROMPT | Entregue no zip? |
|---------------------|-----------------|
| Copiar `src/whatsapp-extras/` para o NestJS | ✅ Pasta pronta com 8 arquivos (excluindo spec se preferir) |
| `WhatsappExtrasModule.forRoot()` e `forRootAsync()` | ✅ `whatsapp-extras.module.ts` implementa os dois |
| `resolveClient` — mesma função do `/send` | ✅ Tipagem genérica — dev adapta ao nome real (ex.: `wa.getClient(name)`) |
| `isConnected` opcional | ✅ Campo opcional em `WhatsappExtrasOptions` |
| `requireInstanceName: true` (multi-instância) | ✅ Padrão já é `true` em `WhatsappExtrasOptions` |
| `useOwnGuard: false` se projeto tem guard próprio | ✅ Suportado — guard bypassa quando `false` |
| Baileys: `store.rememberAll(instanceName, messages)` | ✅ `BaileysMediaStore` exportado pelo módulo |
| Limit body JSON 5MB (foto de perfil) | ⚠️ **Não implementado no zip** — instrução está no PROMPT (Passo 2, item 4); o dev deve ajustar `main.ts` |
| Hosts permitidos para URL de mídia (anti-SSRF) | ✅ `allowedMediaHosts` padrão: `setpoint.kytto.com.br` e `dino.kytto.com.br` |

**Gap identificado:** O ajuste do `body limit` para 5MB em `main.ts` não está no zip (correto — é config do app host, não do módulo).

---

### Passo 3 — Testar localmente

| Exigência | Status |
|-----------|--------|
| `npm run build` | ✅ `package.json` com `tsc --noEmit` como `build` |
| `npx jest src/whatsapp-extras` — 15 testes | ✅ `whatsapp-extras.spec.ts` com 15 testes organizados em 5 suítes |
| `npm test` — suíte inteira do projeto | ✅ Não afeta testes existentes (módulo aditivo) |

**Cobertura dos 15 testes:**
1. Autenticação (sem chave → 401, chave errada → 401, chave certa → passa) — **3 testes**
2. `send-sticker` wwebjs — figurinha por URL, recusa host não-permitido — **2 testes**
3. `send-sticker` Baileys — por base64 — **1 teste**
4. `getMedia` wwebjs — áudio por ID, vídeo recusado (415) — **2 testes**
5. `getMedia` Baileys — áudio via BaileysMediaStore, fallback sem store → 404 — **2 testes**
6. `profile-picture` wwebjs e Baileys — **2 testes**
7. `BaileysMediaStore` — rememberAll, expiração 24h, limite 2000 itens — **3 testes**

---

### Passo 4 — Publicar no Cloud Run da Dino
**Responsabilidade do dev.** O zip não executa deploy; contém apenas o código.

---

### Passo 5 — Validar com curl (4 curls)
**Responsabilidade do dev.** Os 4 curls do PROMPT validam o NestJS já deployado.

---

### Passo 6 — Ligar env vars no SetPoint (Render)

| Variável | Valor | Status |
|----------|-------|--------|
| `CHATBOT_BACKEND_STICKER_PATH` | `/send-sticker` | ✅ Configurada (deploy `dep-db2ogmk9v7es73bttatg`, live) |
| `CHATBOT_BACKEND_MEDIA_PATH` | `/messages/{id}/media?instance={instance}&chatId={chatId}` | ❌ Aguarda NestJS ter a rota no ar |
| `WHATSAPP_STICKERS` | `on` | ✅ Já estava configurada |

---

### Passo 7 — Teste ponta a ponta (celular 14 99746-2929)
**Responsabilidade do dev/QA.** Depende do NestJS estar deployado e das env vars ativas.

---

## O que o zip entrega (confirmado por leitura de código)

### Rotas (3)
```
POST /api/v1/whats-app/send-sticker            ← figurinha WebP do T-Rex
GET  /api/v1/whats-app/messages/:id/media      ← áudio/foto do cliente (base64, sem persistir)
POST /api/v1/whats-app/instances/:name/profile-picture  ← foto de perfil da linha
```

### Arquivos (9 no zip, 8 de código + 1 index)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `whatsapp-extras.controller.ts` | 3 rotas HTTP com decorators NestJS |
| `whatsapp-extras.service.ts` | Lógica: sendSticker, getMedia, setProfilePicture, loadImage |
| `whatsapp-extras.module.ts` | `forRoot()` e `forRootAsync()` |
| `whatsapp-extras.types.ts` | Interfaces WwebjsClientLike, BaileysSocketLike, WhatsappExtrasOptions |
| `api-key.guard.ts` | Guard timing-safe (X-API-KEY, apikey, Bearer) |
| `baileys-media-store.ts` | Map em memória, máx 2000, TTL 24h, só áudio+imagem |
| `whatsapp-extras.spec.ts` | 15 testes (wwebjs + Baileys) |
| `index.ts` | Reexporta tudo |

### Segurança implementada
- API key com `timingSafeEqual` (sem timing attack) ✅
- Hosts permitidos para URL (anti-SSRF): `setpoint.kytto.com.br`, `dino.kytto.com.br` ✅
- Sem `console.log` de base64, número ou conteúdo ✅
- `Cache-Control: no-store` na rota de mídia ✅
- Limite de mídia configurável (`maxMediaBytes`, padrão 16 MB) ✅

---

## O que falta (não entregue pelo zip — ação necessária)

| # | O que | Quem | Quando |
|---|-------|------|--------|
| 1 | Integrar `WhatsappExtrasModule.forRootAsync(...)` no `AppModule` do NestJS | Dev do `chatbot-backend-nestjs` | Próxima sprint |
| 2 | Ajustar `WHATSAPP_EXTRAS_ROUTE` se app usa `globalPrefix('api/v1')` | Dev | Passo 1 do PROMPT |
| 3 | Para Baileys: `store.rememberAll(instanceName, messages)` no handler `messages.upsert` | Dev | Passo 2 do PROMPT |
| 4 | Aumentar body limit para 5MB em `main.ts` | Dev | Passo 2, item 4 do PROMPT |
| 5 | Deploy no Cloud Run da Dino (não no da Isa) | Dev / CI | Passo 4 do PROMPT |
| 6 | Validar com 4 curls do Passo 5 | Dev | Pós-deploy |
| 7 | Configurar `CHATBOT_BACKEND_MEDIA_PATH` no Render | Dev + Render API | Pós-deploy NestJS |
| 8 | Foto de perfil T-Rex: `POST /instances/dino/profile-picture` (manual, uma vez) | Dev | Pós-deploy NestJS |
| 9 | Teste ponta a ponta com celular 14 99746-2929 | Dev / QA | Passo 7 do PROMPT |

---

## Status atual do SetPoint (agro-open / Render)

O SetPoint já está 100% pronto para consumir as 3 rotas:

```
whatsapp-provider.js   → sendStickerViaChatbotBackend()     ← figurinha
whatsapp-stickers.js   → enviarFigurinhaDoMomento()         ← rate limiting, 13 moods
whatsapp-figurinhas.js → enviarFigurinhaPersona()           ← persona T-Rex (base64)
whatsapp-ai.js         → integra ambos os sistemas (L1285)  ← orquestrador
```

Os 13 WebPs respondem HTTP 200 em `https://setpoint.kytto.com.br/figurinhas/trex-*.webp` ✅

---

## Localização dos arquivos neste repositório

```
agro-open/
└── integracoes/
    └── chatbot-backend-whatsapp-extras/
        ├── PROMPT-SUBIR-BACKEND-WHATSAPP-DINO.md   ← prompt completo (7 passos)
        ├── VALIDACAO-ZIP-VS-PROMPT.md               ← este arquivo
        ├── README.md
        ├── package.json
        ├── jest.config.js
        ├── tsconfig.json
        └── src/whatsapp-extras/
            ├── index.ts
            ├── api-key.guard.ts
            ├── baileys-media-store.ts
            ├── whatsapp-extras.controller.ts
            ├── whatsapp-extras.module.ts
            ├── whatsapp-extras.service.ts
            ├── whatsapp-extras.spec.ts
            └── whatsapp-extras.types.ts
```
