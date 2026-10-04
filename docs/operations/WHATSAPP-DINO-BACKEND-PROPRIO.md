# WhatsApp da Dino: backend próprio, com instância isolada

Este runbook coloca o WhatsApp da Barbearia Dino no ar com o **mesmo software-base** da Isa (NossaGente): `chatbot-backend-nestjs`. A Dino usa um deploy Cloud Run isolado e a instância WhatsApp `dino`; o número, a sessão e a chave são exclusivos da barbearia.

## Por que um deploy separado

- O `chatbot-backend-nestjs` mantém **uma sessão de WhatsApp por deploy**: um QR, um número.
- Se a Dino apontasse para o backend da Isa, as conversas dos colaboradores da UISA e as dos clientes da barbearia cairiam na mesma caixa. Isso é vazamento de dados pessoais (LGPD).
- Por isso o Kytto **não tem URL padrão**: sem `CHATBOT_BACKEND_URL`, o WhatsApp fica desligado (fail-closed).
- Nunca use a URL `chatbot-backend-nestjs-…us-east1.run.app` da Isa aqui.

## O que já está pronto no Kytto

Tudo no Kytto já segue o contrato da Isa:

| Parte | Contrato |
|---|---|
| Envio | `POST {URL}/api/v1/whats-app/send`, corpo `{instanceName:"dino", chat_id, message, simulateTyping:false, delaySeconds:0, waitForReply:false}`, cabeçalho `X-API-KEY`. Sem instância explícita e igual à configurada, o Kytto não envia; o HTTP 200 com `accepted:true` comprova somente enfileiramento, não entrega no aparelho. |
| Recebimento | `GET /messages?latest=false&role=user&from=…&instanceName=dino` a cada 5 s. O parâmetro `instance` (sem `Name`) **não consta no Swagger** e podia devolver o dataset padrão; não usá-lo. O backend multi-instância não expõe uma rota de webhook utilizável nem `/instances/dino/messages`; a entrada efetiva é polling filtrado por instância. |
| Id do evento | `api:<chat>:<id>:<hash>`, gravado sem duplicar. A mesma mensagem nunca é respondida duas vezes. |
| Idade máxima | 30 min (`WHATSAPP_MAX_REPLY_AGE_MINUTES`). |
| Áudio | Resposta fixa pedindo texto. |
| SAIR / PARE | Revoga o consentimento e cancela os avisos pendentes. |
| Status e QR | No modo `instancias`, `GET /instances/dino/status` e `GET /instances/dino/qr`, pela tela **WhatsApp da empresa** (`/admin/whatsapp`). O estado `open` não comprova o número se o backend omitir o telefone. |
| Troca de aparelho | Somente `DELETE /instances/dino/session?confirm=true`, conforme `/docs-json` do backend Dino. Depois, `GET /instances/dino/status` deve confirmar `close` ou `qr`. Não chamar `/session` ou `/logout` global. |

No backend multi-instância, a instância deve permanecer `dino` em todas as operações. Não usar `CHATBOT_BACKEND_MODE=isa` neste deploy: esse modo consulta a sessão raiz da Isa e pode misturar o contexto operacional.

## Passo a passo

### 1. Publicar o backend da Dino

1. Use a mesma imagem/versão do `chatbot-backend-nestjs` da Isa.
2. Crie um serviço **novo** no Cloud Run (ou equivalente), por exemplo `dino-chatbot-backend`, em projeto ou serviço separado do da Isa.
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
| `CHATBOT_BACKEND_MODE` | `instancias` |
| `CHATBOT_BACKEND_INSTANCE` | `dino` |
| `CHATBOT_BACKEND_EMPRESA_ID` | `d0d0ac01-8e50-4b61-8c79-de4aaa916da6` (empresa dona do número) |
| `FEATURE_WHATSAPP_AI` | `true` |
| `GEMINI_API_KEY` | Chave do modelo da atendente |
| `WHATSAPP_POLL_MODE` | `pilot` durante o piloto; `on` somente após aprovação explícita |
| `WHATSAPP_POLL_PILOT_PHONES` | Somente o número de teste autorizado, normalizado; separados por vírgula se houver mais de um |
| `WHATSAPP_LINE_VERIFIED` | Padrão ausente/desligado. Definir `1` **somente após** o titular reconhecer a sessão no aparelho ou o backend informar linha mascarada verificável. Nunca inferir apenas de `state=open`. |
| `WHATSAPP_EGRESS_MODE` | Padrão `off`, independente do polling. `pilot` exige lista de teste; `on` exige aprovação explícita de rollout amplo. Não há fallback Evolution para a empresa Dino. |
| `WHATSAPP_FULL_ROLLOUT_APPROVED` | Padrão ausente. Definir `1` **após** piloto, opt-out, limites, consentimento e canal exclusivos serem validados. Exigido para `on` tanto de entrada quanto de saída. |
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
3. Se a instância já está conectada sem número verificado, não atribua um número por texto. Com autorização do titular e o aparelho presente, clique **Desconectar** uma vez e confirme que o backend respondeu `close`/`qr`; se falhar, não repita sem diagnóstico.
4. Clique em **Gerar QR** apenas para `dino`. No celular da Dino, abra **WhatsApp → Aparelhos conectados → Conectar aparelho** e leia o QR. Não grave nem compartilhe o QR/código.
5. Confirme a sessão ativa e o número **mascarado proveniente do backend**. Se o backend não informar o número, a tela avisa que a titularidade ainda não está comprovada: o titular deve conferir o aparelho conectado no próprio WhatsApp. Não usar um campo manual como prova.
6. A desconexão pausa a reconexão automática. Somente após confirmar a nova linha, o gestor pode reativar **Reconectar sozinho** no painel; gerar o QR não reativa essa opção implicitamente.

### 4. Ligar com segurança

1. Com a sessão ainda sem titularidade confirmada, mantenha `WHATSAPP_LINE_VERIFIED` ausente, `WHATSAPP_EGRESS_MODE=off` e o polling da Dino efetivamente desligado, mesmo se uma configuração antiga disser `on`.
2. Após verificação no aparelho do titular, use `WHATSAPP_POLL_MODE=pilot`, `WHATSAPP_EGRESS_MODE=pilot` e adicione somente o número de teste autorizado a `WHATSAPP_POLL_PILOT_PHONES`; a lista é única para entrada e saída.
3. Pelo celular de teste autorizado, envie uma mensagem inofensiva. Verifique apenas contadores/status, sem registrar conteúdo ou telefone em relatórios. Um HTTP 200 do backend prova aceitação/enfileiramento, **não** entrega no aparelho.
4. Opcionalmente, avance para a cotação de um agendamento e a listagem de horários. Não confirme atendimento, pedido, pagamento ou promoção sem fixture segura e autorização explícita.
5. Só após o piloto aprovado e com consentimento/opt-out, quotas e handoff revisados, autorize `WHATSAPP_FULL_ROLLOUT_APPROVED=1` e mude entrada/saída para `on`. Não faça isso nesta etapa.

### 5. Verificação contínua

- O log do Render mostra `[WhatsApp] entrada por consulta ativa a cada 5000 ms, modo pilot, backend instancias` durante o piloto.
- A sincronização do canal pode retornar `manual: true` e `polling: true`: isso é esperado quando o backend não oferece webhook; não tentar registrar `/instances/dino/webhook`.
- Se o backend perder a sessão, o status deixa de ser `authenticated`. Gere outro QR em **WhatsApp da empresa**.
- A fila de avisos (lembrete, vaga na lista de espera, pedido de avaliação) só envia para quem autorizou o WhatsApp de atendimento.
- Em 03/10/2026 o `setpoint` Render tinha **1 instância**; o lock do logout no Kytto é apenas em memória. Antes de escalar horizontalmente ou executar mais de um processo, implementar lock compartilhado por empresa/instância para impedir dois resets concorrentes.

## Desligar em caso de problema

- `WHATSAPP_POLL_MODE=off` **e** `WHATSAPP_EGRESS_MODE=off`: param entrada e novas tentativas de saída da Dino independentemente. Agenda, link público e admin continuam normais. Para modo multi-instância Dino, ausência de `WHATSAPP_LINE_VERIFIED=1` também desliga a entrada.
- Não remova `WHATSAPP_PROVIDER` como kill switch: outras empresas podem usar Evolution. Com backend Dino configurado, o envio não retorna silenciosamente à Evolution ao omitir provider ou escopo da empresa.
- Quando explicitamente autorizada, **Desconectar** encerra somente a sessão `dino` e pausa sua reconexão após confirmação do backend. Se o backend não confirmar, trate o estado como incerto e não anuncie desligamento total de mensagens; siga o plano de contingência de #201.
- Nada disso apaga conversas, agendamentos ou consentimentos.
