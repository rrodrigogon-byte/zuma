# SetPoint — contexto do projeto (para o Claude Code)

**SetPoint** é uma plataforma de gestão esportiva e de arenas. O evento **4ª Agro Open de Tênis** (UISA / Tangará Tênis Clube) roda sobre ela. Stack: **Node.js + Express (ESM)**, banco em **arquivo JSON** (`app/db.js`, com interface trocável por Postgres), frontend em **HTML/CSS/JS puro** servido pelo próprio Express.

## Como rodar (local)
```bash
cd app
npm install
JWT_SECRET=local ADMIN_PASS=agroopen2026 npm start
# abre em http://localhost:3000  ·  painel em /admin.html (admin / agroopen2026)
```

## Testes
```bash
cd app && node --test test.js   # 13 testes dos motores, todos verdes
```
Ao validar páginas: `node --check` no JS extraído. Para testar a API: subir com `DB_PATH=/tmp/x.json` e usar curl.

## Estrutura
- `app/server.js` — API Express (≈137 rotas) + serve o site. Auth JWT + RBAC (admin/organizador/staff/atleta), trava global em `/api/admin/*`, rate-limit no login, auditoria, LGPD.
- `app/db.js` — store JSON (`load/db/save/nextId/reset`), `DB_PATH` configurável. **Trocar por Postgres = reescrever só este arquivo.**
- Motores: `rules.js` (regras multimodais), `bracket.js` (eliminatória simples + wild card/qualifying), `roundrobin.js`, `swiss.js`, `doubleelim.js` (WB+LB+grande final c/ reset), `grupos.js`, `rating.js` (Elo), `ranking.js`, `tennis.js` (ATP/WTA), `pagamentos.js` (Mercado Pago Pix + modo simulado).
- `site/*.html` — 26 páginas (site público + painel `admin.html` + portaria/PDV/cozinha + páginas de cada módulo).
- Deploy: `render.yaml`, `Dockerfile`, `.env.example`, `README-DEPLOY.md`, `GO-LIVE.md`.

## Convenções
- ESM (`import`/`export`), sem TypeScript. Sem dependências além de express, bcryptjs, jsonwebtoken, qrcode.
- Cada novo módulo segue o padrão: rota pública de leitura + rotas `/api/admin/*` protegidas + (opcional) página em `site/` + aba no `admin.html`.
- Paleta da marca: deep #0E2E1C, green #5FB335, lime #8FD64A, gold #C9A656, cream #F4F6EF.

## Variáveis de ambiente (produção)
`JWT_SECRET` (forte), `ADMIN_USER`/`ADMIN_PASS`, `DB_PATH` (disco persistente), `MP_ACCESS_TOKEN` (ativa pagamentos reais), `PLATFORM_FEE_PCT` (split, padrão 5).

## Tarefas comuns que o Claude Code pode fazer aqui
1. **Rodar localmente** e abrir no navegador.
2. **Publicar no Render**: inicializar git, criar repositório no GitHub, conectar ao Render (lê o `render.yaml`), configurar `ADMIN_PASS`/`MP_ACCESS_TOKEN`.
3. **Ativar pagamentos reais**: preencher `MP_ACCESS_TOKEN` e configurar o webhook `/api/pagamento/webhook`.
4. **Migrar para Postgres**: reescrever `app/db.js` mantendo a mesma interface.
5. Rodar os testes antes de qualquer deploy.

> O escopo do documento "Meu Ranking v4.5" está 100% implementado. Pendências são operacionais (licenciar dados oficiais, provedor de e-mail/WhatsApp, fiscal NFC-e) — ver `BACKLOG-MEU-RANKING.md`.
