# Agro Open de Tênis — Plataforma (back + front)

Aplicação completa da 4ª Agro Open: **site institucional**, **inscrições online**, **sorteio automático de chaves** (estilo Grand Slam), **ranking interno** (estilo "Meu Ranking"), **ranking ATP/WTA** e **notícias** (ao vivo via API ou snapshot), além do **painel administrativo**.

## Como rodar (local)

Pré-requisito: Node.js 18+.

```bash
cd app
npm install
cp .env.example .env      # opcional — ajuste senha/secret e chaves de API
npm start
```

Acesse: **http://localhost:3000**

- Site: `/index.html` · Sorteio: `/sorteio.html` · Ranking: `/ranking.html`
- Notícias: `/noticias.html` · Regras: `/regras.html` · Chaves: `/chaves.html`
- **Painel ADM: `/admin.html`** — login padrão **admin / agroopen2026** (troque em produção).

## Variáveis de ambiente (.env)

| Variável | Função |
|---|---|
| `PORT` | porta do servidor (padrão 3000) |
| `JWT_SECRET` | segredo dos tokens de login (troque!) |
| `ADMIN_USER` / `ADMIN_PASS` | credenciais do admin criado no 1º start |
| `RAPIDAPI_TENNIS_HOST` / `RAPIDAPI_KEY` | ativa ranking ATP/WTA **ao vivo** (provedor de dados de tênis) |
| `NEWSAPI_KEY` | ativa **notícias ao vivo** (newsapi.org) |

Sem as chaves de API, o app usa os **snapshots** em `app/data/` (ranking ATP/WTA e notícias atualizáveis manualmente).

## Estrutura

```
app/
  server.js        API Express + serve o site
  bracket.js       motor de chaveamento (cabeças de chave + byes, padrão ITF)
  ranking.js       motor de ranking interno (pontos por fase + V/D)
  tennis.js        ranking ATP/WTA e notícias (ao vivo ou snapshot)
  db.js            banco em arquivo JSON (trocável por SQLite/Postgres)
  data/            snapshots + db.json (gerado no 1º start)
site/              site + páginas (index, admin, ranking, noticias, regras, chaves, sorteio)
```

## Principais rotas da API

Públicas: `GET /api/categorias` · `POST /api/inscricao` · `GET /api/chave/:cat` · `GET /api/chaves` · `GET /api/ranking` · `GET /api/atp` · `GET /api/wta` · `GET /api/noticias`

Admin (Bearer token): `POST /api/admin/login` · `GET /api/admin/inscricoes` · `PATCH|DELETE /api/admin/inscricoes/:id` · `POST /api/admin/sortear` · `POST /api/admin/resultado` · `POST /api/admin/finalizar`

## Fluxo do administrador

1. **Inscrições** chegam pelo site (`/api/inscricao`) e aparecem no painel.
2. **Chaveamento**: escolha a categoria → "Sortear automático" (cabeças de chave + byes). A chave fica pública em `/chaves.html`.
3. **Resultados**: clique no vencedor para avançá-lo até o campeão.
4. **Finalizar & pontuar**: credita o **Ranking Agro Open** por fase alcançada.

## Deploy (sugestão)

Hospede em **Render**, **Railway** ou **Fly.io** (Node):
- Build: `npm install` · Start: `npm start`
- Defina as variáveis de ambiente no painel do serviço.
- Para dados persistentes/escaláveis, troque o `db.js` por SQLite (`node:sqlite`) ou Postgres mantendo a mesma interface.

## Notas de produção

- O `db.json` é simples e ótimo para começar; para muitos acessos simultâneos, migre para um banco real.
- Troque `JWT_SECRET` e a senha do admin.
- Os rankings ATP/WTA e notícias são exibidos **com atribuição às fontes**; o modo ao vivo depende de um provedor de dados contratado por você.
