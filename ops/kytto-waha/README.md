# WAHA privado do Kytto

Este diretório descreve a infraestrutura **exclusiva do Kytto** para os canais internos `gestao` e `lancamentos`. Ela não usa a sessão, grupo, número, bridge ou segredo do Vision Control e não altera o transporte legado do canal `cliente`.

## Topologia

```text
WhatsApp (novo número Gestão) ─┐
                               ├─ WAHA persistente (VM privada GCP) :3000 localhost
WhatsApp (novo número Lanç.) ──┘                 │
                                                 └─ control-bridge Kytto :3040, rede privada
                                                            │ HTTPS privado + token de bridge
                                                            ▼
                                             dino.kytto.com.br/api/webhooks/waha
```

- WAHA e seus arquivos/sessões ficam em volume persistente da VM.
- A porta 3000 escuta somente `127.0.0.1`; o bridge não deve ficar exposto à internet.
- O bridge nunca retorna API key, participantes, conteúdo de mensagens ou QR em logs.
- O aplicativo aceita somente `@g.us` configurado para a combinação empresa + unidade + perfil.
- O webhook exige o header secreto da sessão **e** HMAC SHA-512 do corpo bruto.
- Documentos são baixados apenas pela referência `/api/files/` do próprio WAHA, com limite e MIME allowlist.

## Configuração (somente runtime protegido)

1. Criar VM/serviço isolado do Vision Control, com firewall permitindo o endpoint privado do Kytto.
2. Copiar `docker-compose.yml`, `.env.example` e `control-bridge.py` para `/opt/kytto-waha`; criar `.env` e `bridge.env` fora do Git.
3. Gerar API key WAHA e segredo do bridge em Secret Manager/runtime env. Não enviar esses valores no chat, em issue, PR, log ou screenshot.
4. Fixar a imagem WAHA por versão/digest antes do primeiro rollout; `latest` no exemplo é apenas placeholder de instalação.
5. Configurar `WAHA_CONTROL_URL` no runtime do Kytto para o endpoint HTTPS privado do bridge. Não modificar `WHATSAPP_*`/`CHATBOT_BACKEND_*` usados pelo Cliente.
6. Validar `/health` do bridge e o bloqueio de `/v1/*` sem header privado. Não parear nenhum telefone ainda.

## Pareamento por empresa/perfil

1. No Kytto, abrir `/admin/whatsapp-gestao` ou `/admin/whatsapp-lancamentos` com empresa e unidade corretas.
2. A administração da plataforma deve atribuir uma sessão WAHA **única** para o perfil. A migration rejeita sessão/grupo duplicado.
3. Preparar o canal, gerar QR e pedir ao usuário responsável que faça o pareamento manual no celular. O agente não lê nem digita senha, MFA, token ou código de pareamento.
4. Depois de conectado, listar grupos sem participantes e salvar exatamente um grupo Admin novo para aquele perfil.
5. Ativar o atendente somente após sessão e grupo estarem conferidos. Gestão permanece somente leitura; Lançamentos pode preparar somente uma pendência financeira, sem pagamento, PIX, transferência ou baixa.

## Rollout

- O código Kytto entra somente por PR com base `fix/kytto-comandas-pdv-20260808`.
- Não fazer push direto, merge ou alteração de variáveis de produção sem aprovação específica.
- Antes do merge: sintaxe Node/Python, testes focados, `npm run test:node`, build `web/` e dry-run da migration.
- Após eventual merge: confirmar Render Live, health, webhook sem assinatura (401), HMAC incorreto (401), grupo não allowlisted (ignorado) e duplicidade (sem segunda tarefa).
- O primeiro E2E deve ser inofensivo: uma pergunta read-only no novo grupo Gestão. O E2E de Lançamentos usa um documento controlado e verifica apenas lançamento `pendente`; nunca efetua pagamento.
