# WhatsApp da Dino: backend próprio, igual ao da Isa

Este runbook coloca o WhatsApp da Barbearia Dino no ar com o **mesmo software e o mesmo contrato** da Isa (NossaGente): `chatbot-backend-nestjs`. A diferença é que o deploy, o número e a chave são **da Dino**.

## Por que um deploy separado

- O `chatbot-backend-nestjs` mantém **uma sessão de WhatsApp por deploy**: um QR, um número.
- Se a Dino apontasse para o backend da Isa, as conversas dos colaboradores da UISA e as dos clientes da barbearia cairiam na mesma caixa. Isso é vazamento de dados pessoais (LGPD).
- Por isso o Kytto **não tem URL padrão**: sem `CHATBOT_BACKEND_URL`, o WhatsApp fica desligado (fail-closed).
- Nunca use a URL `chatbot-backend-nestjs-…us-east1.run.app` da Isa aqui.

## O que já está pronto no Kytto

Tudo no Kytto já segue o contrato da Isa:

| Parte | Contrato |
|---|---|
| Envio | `POST {URL}/api/v1/whats-app/send`, corpo `{chat_id, message, simulateTyping:false, delaySeconds:0, waitForReply:false}`, cabeçalho `X-API-KEY`. |
| Recebimento | Consulta `GET /messages?latest=false&role=user&from=…` a cada 5 s. É o mesmo modelo do `whatsappApiSyncWorker` da Isa; não há webhook de mensagens. |
| Id do evento | `api:<chat>:<id>:<hash>`, gravado sem duplicar. A mesma mensagem nunca é respondida duas vezes. |
| Idade máxima | 30 min (`WHATSAPP_MAX_REPLY_AGE_MINUTES`). |
| Áudio | Resposta fixa pedindo texto. |
| SAIR / PARE | Revoga o consentimento e cancela os avisos pendentes. |
| Status e QR | `GET /status` (`authenticated`, `connecting`) e `GET /qr`, pela tela **WhatsApp da empresa** (`/admin/whatsapp`). |

## Passo a passo

### 1. Publicar o backend da Dino

1. Use a mesma imagem/versão do `chatbot-backend-nestjs` da Isa.
2. Crie um serviço **novo** no Cloud Run (ou equivalente), por exemplo `chatbot-backend-dino`, em projeto ou serviço separado do da Isa.
3. Gere uma chave de API nova para a Dino, com **20 ou mais caracteres**. Guarde-a só no gerenciador de segredos.
4. Não reutilize a chave da Isa e não cole a chave em PR, chat ou log.
5. O armazenamento da sessão do WhatsApp (pasta ou volume da sessão) deve ser **exclusivo** do serviço da Dino.
6. Anote a URL pública HTTPS do serviço.

### 2. Configurar o Render (serviço `setpoint`, domínio `dino.kytto.com.br`)

| Variável | Valor |
|---|---|
| `WHATSAPP_PROVIDER` | `chatbot_backend` |
| `CHATBOT_BACKEND_URL` | URL HTTPS do backend **da Dino** (passo 1) |
| `CHATBOT_BACKEND_KEY` | A chave da Dino (≥ 20 caracteres). Cole pelo painel do Render, nunca no repositório. |
| `CHATBOT_BACKEND_EMPRESA_ID` | `d0d0ac01-8e50-4b61-8c79-de4aaa916da6` (empresa dona do número) |
| `FEATURE_WHATSAPP_AI` | `true` |
| `GEMINI_API_KEY` | Chave do modelo da atendente |
| `WHATSAPP_POLL_MODE` | Comece com `shadow` (veja a etapa 4) |
| `WHATSAPP_POLL_PILOT_PHONES` | Telefones da equipe para o piloto, separados por vírgula |
| `PUBLIC_BASE_URL` | `https://dino.kytto.com.br`. Usada no link de avaliação (NPS) e nas meta tags. |

O serviço Render é **multiempresa**: este domínio se aplica apenas ao slug público `dino`. Para outros slugs, o link NPS e o canonical ficam desativados até existir um domínio validado por empresa; nunca apontar clientes de outra barbearia para a Dino. O link de avaliação aponta exclusivamente para `/avaliar/dino` no próprio sistema. Ele não contém código de agendamento na URL: o código vai no texto da mensagem e é digitado no formulário junto ao telefone. **Não** configurar link Google nem qualquer formulário externo. Os indicadores ficam em **Relacionamento → Avaliações (NPS)**, com período, participação, distribuição, evolução e equipe, respeitando a loja da sessão.

Opcionais:

- `WHATSAPP_POLL_INTERVAL_MS`: padrão 5000, mínimo 3000.
- `WHATSAPP_SIMULATE_TYPING=true`: só se quiser o "digitando…". A Isa usa `false`.

### 3. Conectar o número

1. Entre no admin da Dino e abra **Cérebro do atendente** (`/admin/cerebro-ia`), aba **Ativação**.
2. O checklist "Colocar tudo no ar" deve marcar como OK:
   - a URL do backend da Dino;
   - a empresa do número;
   - a chave.
3. Abra **WhatsApp da empresa** (`/admin/whatsapp`) e clique em **Gerar QR**. No celular da Dino, abra **WhatsApp → Aparelhos conectados → Conectar aparelho** e leia o QR.
4. Confirme que o status mostra **autenticado**.

### 4. Ligar com segurança

1. Coloque `WHATSAPP_POLL_MODE=shadow`. As mensagens são registradas, mas ninguém recebe resposta.
   - Confira no admin que as conversas aparecem.
   - Confira que não há mensagens de outra empresa.
2. Coloque `WHATSAPP_POLL_MODE=pilot` com os telefones da equipe em `WHATSAPP_POLL_PILOT_PHONES`.
3. Pelo celular da equipe, teste:
   - "quero marcar um corte amanhã" → horários → `CONFIRMAR` → o agendamento aparece na agenda do admin com origem WhatsApp;
   - "quero remarcar" e "quero cancelar";
   - "quantos cortes ainda tenho no plano?" (com um cliente assinante de teste);
   - um áudio: deve chegar a resposta fixa pedindo texto;
   - `SAIR`: o consentimento é revogado e os avisos param.
4. Coloque `WHATSAPP_POLL_MODE=on` para todos.

### 5. Verificação contínua

- O log do Render mostra `[WhatsApp] entrada por consulta (modelo Isa) ativa a cada 5000 ms, modo on`.
- Se o backend perder a sessão, o status deixa de ser `authenticated`. Gere outro QR em **WhatsApp da empresa**.
- A fila de avisos (lembrete, vaga na lista de espera, pedido de avaliação) só envia para quem autorizou o WhatsApp de atendimento.

## Desligar em caso de problema

- `WHATSAPP_POLL_MODE=off`: para de ler e de responder na hora. Agenda, link público e admin continuam normais.
- Para desligar também os envios (lembretes e avisos), remova `WHATSAPP_PROVIDER`.
- Nada disso apaga conversas, agendamentos ou consentimentos.
