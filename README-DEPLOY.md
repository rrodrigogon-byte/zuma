# SetPoint — Guia de Deploy

Plataforma **SetPoint** (API Express + site estático). O evento **Agro Open** roda sobre ela.

## Rodar localmente

```bash
cd app
npm install
JWT_SECRET=dev ADMIN_PASS=agroopen2026 npm start
# abre em http://localhost:3000
```

Login padrão do painel: **admin / agroopen2026** (troque via `ADMIN_USER`/`ADMIN_PASS`).

## Opção 1 — Render (recomendado, 1 clique)

1. Suba este repositório no GitHub.
2. No Render: **New → Blueprint** e aponte para o repo. O `render.yaml` já define o serviço, o disco persistente e as variáveis.
3. Defina o `ADMIN_PASS` no painel (marcado como `sync: false`). O `JWT_SECRET` é gerado automaticamente.
4. Deploy. A saúde é checada em `/api/info`. O banco (JSON) fica em `/var/data/db.json` no disco persistente — **sobrevive a cada deploy**.

## Opção 2 — Docker (qualquer nuvem)

```bash
docker build -t setpoint .
docker run -p 3000:3000 -e JWT_SECRET=troque -e ADMIN_PASS=forte -v setpoint_data:/data setpoint
```

O `Dockerfile` empacota API + site numa imagem única e usa o volume `/data` para persistência.

## Banco de dados

Hoje o SetPoint usa um **banco em arquivo JSON** (`app/db.js`), simples e portável — ótimo para começar e para o piloto.

A interface (`load/db/save/nextId/reset`) foi desenhada para ser **trocável por Postgres** sem mexer no restante do código:

1. Provisione um Postgres (no Render, **New → PostgreSQL**) e use a `DATABASE_URL`.
2. Reescreva apenas `app/db.js` para ler/gravar no Postgres (ex.: uma tabela `kv(estado JSONB)` ou tabelas por coleção).
3. Nenhuma rota do `server.js` precisa mudar.

Recomendado migrar para Postgres antes de ativar **pagamentos reais** (consistência transacional do caixa/ingressos).

## Checklist de produção

- [ ] `JWT_SECRET` forte e `ADMIN_PASS` alterado
- [ ] HTTPS (o Render já fornece) e domínio próprio
- [ ] Disco persistente (ou Postgres) configurado para o banco
- [ ] Backup periódico do `db.json` / dump do Postgres
- [ ] Rate-limit no `/api/admin/login` e LGPD (consentimento) — próximos reforços
- [ ] Pagamentos (Mercado Pago Pix/cartão) — módulo final
