# REGRAS DE PRODUÇÃO — LEIA ANTES DE QUALQUER COMMIT, PUSH OU DEPLOY

> Vale para qualquer agente (Claude, Manus, Codex, Copilot…) e para pessoas.
> Incidente de 06/10/2026: o serviço `setpoint` do Render passou a publicar a branch `main`
> (444 commits atrás da produção), com outro build command, sem o pre-deploy do schema e com
> outro health check. Todos os deploys falharam; se algum tivesse passado, a Dino perderia
> semanas de funcionalidades em produção.

## 1. Qual branch é produção

| O quê | Valor |
|---|---|
| **Branch de produção** | `fix/kytto-comandas-pdv-20260808` |
| Serviço Render | `setpoint` (`srv-d8iudokm0tmc73c07iog`), domínio `dino.kytto.com.br` / `setpoint.kytto.com.br` |
| Auto-deploy | **SEMPRE LIGADO (On Commit)** — decisão do Rodrigo em 06/10/2026. Todo merge na branch de produção vai ao ar em ~2 min. Não desligue. |
| Blueprint `agro-open` (`exs-d8iubrurnols73c54ifg`) | **pausado, autoSync=false**. Não reative nem sincronize: foi ele que trocou a branch para `main`. |
| `main` | **NÃO é produção.** Está atrás da produção. Nunca aponte o Render para ela. |

## 2. Proibido (sem aprovação explícita do Rodrigo no chat)

- Trocar a branch, o build command, o pre-deploy, o start command, o health check ou o auto-deploy do serviço `setpoint` no Render.
- Reativar, sincronizar ou recriar o Blueprint do Render.
- Fazer push direto na branch de produção. Tudo entra por **PR com base `fix/kytto-comandas-pdv-20260808`**.
- Fazer "bump" de `DEPLOY_TS` ou commits vazios para "forçar redeploy". Se o build falhou, leia o log e corrija a causa.
- Editar o `render.yaml` removendo `branch:`, `preDeployCommand`, `numInstances: 1`, o banco `kytto-commerce-core` ou o `--include=dev` do build.
- Mudar variáveis de WhatsApp (`WHATSAPP_*`, `CHATBOT_BACKEND_*`) sem pedido explícito. Elas controlam mensagens a clientes reais.

## 3. Configuração correta do serviço `setpoint` (fonte da verdade: `render.yaml` da branch de produção)

- Branch: `fix/kytto-comandas-pdv-20260808`
- Build: `cd web && npm install --include=dev && npm run build && rm -rf ../app/public/assets && cp -R dist/. ../app/public/ && cd ../app && npm install`
  (sem `--include=dev` o `vite` não é instalado porque `NODE_ENV=production` → erro `vite: not found`, status 127)
- Pre-deploy: `cd app && npm run commerce:schema:apply`
- Start: `cd app && node server.js`
- Health check: `/api/info` (a produção responde também em `/health`)
- Auto-deploy: **ligado (On Commit)** — nunca desligar
- 1 instância só (o banco JSON aceita um único processo gravando).

## 4. Como entregar uma mudança

1. Crie branch a partir de `origin/fix/kytto-comandas-pdv-20260808` (nunca de `main`).
2. Rode os testes: `npm run test:node` (raiz) e o build do `web/`.
3. Abra PR com `--base fix/kytto-comandas-pdv-20260808 --head <sua-branch>`. Confira na saída do `gh` que o head **não** é `main`.
4. O merge publica sozinho (auto-deploy). Confira no Render (Events) que o deploy ficou **Live**. Se falhar, a versão anterior continua no ar: corrija pela causa, não force redeploy.

## 5. Trabalho que existe só na `main`

Commits feitos em `main` (ex.: "onda-1/onda-2" do catálogo/loja, 06/10/2026) **não** estão em produção.
Para levá-los ao ar: crie uma branch a partir da produção, traga os commits com `git cherry-pick`, resolva conflitos, teste e abra PR para a produção.
