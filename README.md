# SetPoint 🎾

Plataforma de gestão esportiva e de arenas. O evento **4ª Agro Open de Tênis** (UISA · Tangará Tênis Clube) roda sobre ela.

> **Comece por aqui:** abra esta pasta no **Claude Code** (`claude`) e peça: *"Leia o CLAUDE.md, rode os testes, suba localmente e me guie no deploy."* O arquivo `CLAUDE.md` dá todo o contexto automaticamente.

## Rodar em 30 segundos
```bash
cd app
npm install
JWT_SECRET=local ADMIN_PASS=agroopen2026 npm start
```
Abra **http://localhost:3000** · Painel: **/admin.html** (login `admin` / `agroopen2026`).

> Sem terminal? Use os atalhos **`ABRIR-no-Mac.command`** / **`ABRIR-no-Windows.bat`**.

## O que tem dentro
- **6 formatos de torneio:** eliminatória simples, dupla (com repescagem), grupos+mata-mata, round-robin, suíço, qualifying/wild card.
- **8 modalidades** (tênis, beach tennis, pádel, futevôlei, squash, vôlei de praia, tênis de mesa, pickleball).
- **Ranking interno + rating Elo + ATP/WTA**, perfis de atleta e head-to-head.
- **Ingressos com QR + portaria**, **PDV** (mesas/cozinha/caixa) + estoque.
- **Reserva de quadras, aulas, loja/pro shop, patrocínio.**
- **Carteira & fidelidade, carteirinha de sócio digital + mensalidades.**
- **CRM, comunicação em massa, BI, dashboard, order of play.**
- **Login + RBAC, rate-limit, auditoria, LGPD.**
- **Pagamentos Pix/cartão (Mercado Pago + split)** — modo simulado para testar sem token.

## Estrutura
```
agro-open/
├── CLAUDE.md            ← contexto para o Claude Code (leia primeiro)
├── README.md            ← este arquivo
├── GO-LIVE.md           ← roteiro de publicação
├── README-DEPLOY.md     ← deploy (Render/Docker) e migração p/ Postgres
├── BACKLOG-MEU-RANKING.md ← mapa do escopo (tudo ✅)
├── render.yaml · Dockerfile · .env.example
├── ABRIR-no-Mac.command · ABRIR-no-Windows.bat
├── app/                 ← backend Node/Express + motores + testes
│   ├── server.js  db.js  rules.js  bracket.js  roundrobin.js
│   ├── swiss.js  doubleelim.js  grupos.js  rating.js  ranking.js
│   ├── tennis.js  pagamentos.js  test.js  package.json
└── site/                ← 26 páginas (site público + painel)
```

## Testes
```bash
cd app && node --test test.js   # 13/13 verdes
```

## Publicar
Veja **GO-LIVE.md** (Render em 1 clique via `render.yaml`) e **README-DEPLOY.md**.

---
Feito com a plataforma **SetPoint** — *a plataforma que decide o jogo.*
