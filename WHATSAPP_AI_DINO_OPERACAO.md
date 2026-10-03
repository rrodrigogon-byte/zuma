# Atendente humanizado da Barbearia Dino

## Objetivo

O atendente WhatsApp da Barbearia Dino opera dentro do núcleo atual do SetPoint e usa o mesmo tenant, loja, catálogo, estoque, clientes, agenda, campanhas e auditoria do ERP. Ele não mantém uma base paralela e não responde com preço, horário, profissional, estoque ou promoção inventados.

## Capacidades configuradas

| Capacidade | Comportamento |
| --- | --- |
| Atendimento humanizado | Português brasileiro, tom cordial e natural, uma pergunta por vez e transparência de que é assistente virtual na apresentação. |
| Captação de clientes | Cada mensagem recebida pode criar ou atualizar o lead em `clientes`, registrar consentimento de atendimento e gravar a interação no CRM. |
| Loja e vendas | Consulta somente produtos publicados, preço vigente e estoque disponível. Prepara pedido para retirada na unidade e exige `CONFIRMAR`. |
| Agenda | Lista serviços, profissionais e horários reais. Prepara agendamento, remarcação e cancelamento com confirmação explícita. |
| Promoções | Lista somente promoções vigentes. Marketing exige opt-in do cliente; cada envio individual exige preparação e `CONFIRMAR`. |
| Lembretes | Usa a fila governada de notificações já existente, sem disparador paralelo. |
| Handoff humano | Reclamações, exceções, reembolso, dados sensíveis, erro operacional ou pedido de pessoa interrompem a automação até a equipe liberar a sessão. |

## Fluxo de atendimento

1. O webhook Evolution recebe a mensagem e valida o canal, assinatura, empresa e loja.
2. O evento é gravado com idempotência e enfileirado para processamento assíncrono.
3. O contato é captado/atualizado no CRM por telefone e a interação é registrada.
4. O agente consulta ferramentas do sistema para responder sobre loja, catálogo, serviços, profissionais, agenda, pedidos, perfil e promoções.
5. Ações de gravação são apenas preparadas e ficam pendentes por até 30 minutos.
6. O atendente apresenta resumo verificável e aguarda `CONFIRMAR` ou `CANCELAR`.
7. A confirmação executa a transação determinística e responde com o código ou resultado real.
8. A operação fica auditada por empresa, loja, sessão, ação e cliente.

## Marketing e privacidade

Promoções não são enviadas por padrão. Para habilitar a capacidade no painel, a empresa deve marcar **Promoções** em Integrações. Mesmo habilitada, a IA exige consentimento explícito individual, registra evidência e respeita `SAIR`, `PARE`, `PARAR` e solicitações equivalentes de revogação.

A ativação da capacidade não expõe credenciais, tokens ou IDs internos. O canal continua limitado à empresa e à loja ativas; uma conversa da Dino não pode consultar clientes, pedidos, agenda ou campanhas de outro tenant.

## Configuração no painel

Acesse `/admin/barbearia-erp?area=integracoes&tab=Integrações`, selecione a empresa e loja **Barbearia Dino**, informe a instância Evolution e o nome do atendimento. Marque as capacidades desejadas, salve o canal em rascunho, execute o diagnóstico do Gemini, ative o atendente e sincronize o webhook.

As capacidades recomendadas para a Dino são:

- Tom humanizado;
- Captação de clientes;
- Loja e vendas;
- Agenda;
- Lembretes;
- Handoff humano.

A capacidade de promoções deve permanecer desligada até a política de consentimento e o conteúdo comercial da unidade serem revisados.

## Limitações intencionais

Pagamentos externos não são executados pelo WhatsApp. Pedidos são preparados para retirada e seguem o fluxo de pagamento definido pela operação. A IA também não confirma disponibilidade sem consulta ao sistema e não conclui agendamento, remarcação, cancelamento, pedido ou envio promocional sem confirmação do cliente.

## Validação técnica

A implementação foi validada com `node --check` nos módulos do atendente, CRM, worker e ferramentas; build React aprovado; testes de webhook, campanhas, carrinho, CRM e ferramentas aprovados; e regressão específica para bloquear promoções quando a capacidade não estiver habilitada.

## Atendente 2.0 — voz, foto, confirmação natural e autonomia (out/2026)

Comparado ao atendimento manual de hoje no WhatsApp Business da Dino (+55 65 9905-6008: perfil, horário 08h–21h, endereço, Instagram e respostas por áudio feitas à mão), o atendente passa a cobrir o que o cliente realmente manda e a agir sozinho dentro das travas:

| Capacidade | Antes | Agora |
| --- | --- | --- |
| Áudio do cliente | Resposta fixa "só leio texto" | Transcrito pelo Gemini (multimodal) e atendido como texto, marcado `[áudio transcrito]`; o atendente confere nome, dia e horário antes de preparar ação |
| Foto de referência | Ignorada (só a legenda) | Descrita no contexto de barbearia/perfumaria (estilo de corte, produto legível) para sugerir o serviço real do catálogo; não comenta aparência; comprovante/documento não é transcrito |
| Confirmação | Só a palavra CONFIRMAR | "sim", "pode marcar", "fechado", 👍, ✅ … Ressalva, pergunta ou condição ("sim, mas às 15h?") nunca confirma: vai para o modelo. Em cancelamento, "pode cancelar" confirma |
| Oferta de horário | Um dia por consulta | `sugerir_proximos_horarios`: varre até 14 dias, qualquer profissional, por período (manhã/tarde/noite) e oferece 2–3 opções concretas numa resposta |
| Sem vaga | Fim da conversa | `entrar_lista_espera` (com aceite do cliente) usa a lista de espera já existente e o aviso automático de vaga |
| Cliente some antes de confirmar | Ação expirava em 30 min | 1 toque educado após 12 min parado, dentro da validade da ação, nunca no horário silencioso (21h–8h) nem em conversa com a equipe |

### Variáveis novas

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `WHATSAPP_AI_MEDIA` | `on` (exige `GEMINI_API_KEY`) | `off` volta à resposta fixa para áudio/foto |
| `WHATSAPP_AI_MEDIA_MAX_MB` | `12` | Limite de tamanho da mídia baixada (1–20) |
| `GEMINI_MEDIA_MODEL` | `GEMINI_MODEL` | Modelo usado para transcrever/descrever |
| `CHATBOT_BACKEND_MEDIA_PATH` | vazio | Rota de mídia do backend, ex. `/messages/{id}/media` (`{id}`, `{chatId}`, `{instance}`) |
| `WHATSAPP_AI_FOLLOWUP` | `on` | `off` desliga a retomada de conversa parada |
| `WHATSAPP_AI_FOLLOWUP_AFTER_MIN` | `12` | Minutos parado antes do toque (5–25) |

### Contrato de mídia com o backend (pendência do backend NossaGente)

Hoje o `GET /messages` entrega áudio como `content: "[ÁUDIO RECEBIDO]"`, sem o arquivo. O SetPoint já aceita qualquer uma destas formas, sem mudar código:

1. **Embutido no item**: `media: { base64, mimetype }` (ou `mediaBase64`, `base64`, data URL);
2. **URL baixável**: `mediaUrl` (a chave `X-API-KEY` só é enviada se a URL for do próprio backend);
3. **Rota dedicada**: `GET {BASE}/messages/{whatsappMessageId}/media` devolvendo o binário ou `{ base64, mimetype }`, ligada por `CHATBOT_BACKEND_MEDIA_PATH=/messages/{id}/media`.

Enquanto o backend não expõe a mídia, o comportamento é o anterior (resposta fixa pedindo texto). Na Evolution, ligar `webhook_base64` (e subir `WHATSAPP_AI_WEBHOOK_MAX_BYTES` até 524288 para fotos) já ativa voz e foto pelo webhook.

A mídia nunca é gravada: fica só em memória durante a transcrição. Mensagem repetida no polling não é transcrita de novo (o id do evento é conferido antes de chamar o Gemini).

### Ampliação (rodada 2)

| Capacidade | Comportamento |
| --- | --- |
| Rajada de mensagens | "oi" / "quero marcar" / "barba amanhã" em sequência → **uma** resposta, lendo as mensagens seguidas sem resposta (janela de 3 min). Nunca agrupa SAIR, pedido de humano, dado sensível, injeção nem resposta a ação pendente |
| Confirmação de presença | O lembrete pede "CONFIRMO"; a IA usa `confirmar_presenca` e o horário fica **confirmado** na agenda |
| Aviso de atraso | `avisar_atraso` anota "atraso de ~15 min" no horário para o barbeiro ver; não remarca |
| Falha ao confirmar | Horário tomado, limite por telefone, ação vencida, estoque: o cliente recebe a explicação e a ação sai do caminho (antes a tarefa falhava e o cliente ficava sem resposta) |
| Resumo legível | "amanhã, sábado 03/10 às 09:30" em vez de "2026-10-03 às 09:30"; cancelamento no fuso de Cuiabá |
| Lembrete | Não repete a confirmação de quem acabou de marcar para as próximas 30 h; texto diz "hoje", "amanhã" ou o dia da semana |
| Passos por resposta | `GEMINI_MAX_TOOL_STEPS` (padrão 6): listar serviço → próximos horários → preparar cabem numa resposta |

### Simulador de cenários (PostgreSQL real)

`app/core/whatsapp-ai-cenarios.pg.test.js` roda 33 conversas inteiras pelo caminho de produção (backend → polling → fila → worker → regras → ferramentas → envio). Só o backend do WhatsApp e o Gemini são simulados; o Gemini é uma atendente roteirizada que usa as ferramentas reais.

```bash
cd app && DATABASE_URL=postgres://…/dino_sim DB_SSL=false npm run commerce:schema:apply
cd .. && WHATSAPP_SIM_PG_URL=postgres://…/dino_sim SIM_REPORT_PATH=/tmp/cenarios.json \
  node --test app/core/whatsapp-ai-cenarios.pg.test.js
```

Defeitos de produção que o simulador encontrou e que esta branch corrige:

1. **Todo handoff para a equipe falhava** (`inconsistent types deduced for parameter $4` em `putSessionInHandoff`): pedido de humano, injeção, cartão/CPF e queda do Gemini deixavam o cliente sem resposta e a conversa nunca ia para a fila humana.
2. **"O que você precisa?" era tratado como linguagem de pressão** e mandava a conversa para a equipe.
3. **Ação vencida travava a conversa**: a expiração era desfeita pelo rollback e toda confirmação seguinte falhava em silêncio.
4. **Falha de regra ao confirmar** (horário tomado, limite por telefone) não gerava resposta ao cliente.
5. **Lembrete logo depois da confirmação** para horários nas próximas ~24 h (mensagem duplicada) e texto sempre "amanhã".
6. **Horário do cancelamento e do lembrete fora do fuso** (`toLocaleString` sem fuso / `timeZone: 'UTC'`).

### Comparativo com o sistema atual da Dino (WhatsApp 65 9905-6008, observado em 28/09–02/10)

| Situação real | Sistema atual | Atendente novo (cenário do simulador) |
| --- | --- | --- |
| "Quero cortar amanhã à tarde" | Responde com menu de 5 tipos de corte, ignora dia e período | Lê serviço, dia e período e oferece 3 horários reais (02, 34) |
| "Lá pelas 16h" | Lista a agenda inteira (5 dias × barbeiros × 15 min, cortada em "Ler mais") → cliente responde "???" | Os 2 horários mais próximos das 16h por dia, no máximo 3 opções (34) |
| Barba + manicure + pedicure | Um serviço por vez, recomeça a conversa para cada um | Um resumo, uma confirmação, serviços encaixados em sequência; tudo ou nada (35) |
| Áudio do cliente | Não entende; uma pessoa precisa ouvir | Transcrito e atendido (03) |
| "Minha e do Pedro" | Não suporta outra pessoa no mesmo número | Agenda para o Pedro com o nome dele; limite por visita, não por serviço (36) |
| Remarcação feita pela equipe | Lembrete do horário antigo/novo sem explicação; não responde "minha agenda era hoje" | Explica de quando para quando a equipe remarcou e oferece manter ou mudar (37) |
| "ou", "ou", "???" | Sem resposta até alguém da equipe ver | Responde curto na 1ª vez; na 2ª chama a equipe (38) |
| Lembrete "CONFIRMO, REMARCAR ou CANCELO" | Funciona | Mesmo padrão, com confirmação de presença gravada na agenda (14, 39) |

**Quem faz cada serviço**: em Catálogo → Serviços, cada serviço tem "Quem faz este serviço" (ex.: Manicure e Pedicure só com a Nathy; corte e barba com Dino, Bruno e Léo). Sem marcação, qualquer profissional ativo atende. A agenda online, o link público e o atendente respeitam essa regra (cenário 35).

## Atendente 3 — recepção no celular, CRM garantido e conversa real refeita (02/10/2026)

### Equipe responde pelo celular → a IA sai da frente

O backend roda como **aparelho conectado** no número da Dino: a recepção continua respondendo pelo celular. Antes desta versão a IA ignorava essas mensagens e **continuava respondendo o mesmo cliente** (duas pessoas falando ao mesmo tempo).

Agora, a cada consulta (5 s), o SetPoint também lê o que **saiu** do número (`GET /messages?role=assistant`). O próprio backend marca cada saída com `interactionType`:

| `interactionType` | Quem enviou | Efeito |
| --- | --- | --- |
| `bot` | API: IA, lembrete, campanha, carrinho | nenhum |
| `organic` | pessoa no celular / WhatsApp Web | conversa vai para a equipe (`humano`, motivo `equipe_no_celular`) |
| ausente | — | nenhum (fail-safe: a IA nunca fica muda por campo ausente) |

- A pausa vale até **`WHATSAPP_AI_STAFF_PAUSE_MIN`** (padrão 120 min; 15–720) depois da **última** mensagem da equipe; cada nova mensagem estende.
- Venceu a pausa: a IA volta sozinha na próxima mensagem do cliente (e a fila do painel é atualizada na consulta seguinte). A equipe pode liberar antes pelo painel.
- Ação preparada pela IA (resumo aguardando "sim") é cancelada quando a equipe assume.
- Conversa já com a equipe por outro motivo (reclamação, segurança) mantém o motivo original.
- A mesma mensagem da equipe, relida a cada 5 s, não reabre uma pausa que a equipe liberou (`estado.staffLastAt`).
- Desligar: `WHATSAPP_AI_STAFF_TAKEOVER=off`. No modo `shadow` não há pausa.

### CRM: `interacoes_cliente` no schema do deploy (migration 061)

A captação de leads da IA e o Customer 360 gravam em `interacoes_cliente`, criada só pela 016 (fora da lista do `commerce:schema:apply`, que é o que o Render roda no pré-deploy). Em banco sem a 016 a captação falhava calada. A **061** cria a tabela com a mesma definição, de forma idempotente (validada em banco novo, reaplicação e banco com a 016 aplicada antes). No simulador: 0 avisos e 120 interações gravadas.

### Simulador: 42 cenários

- **40** · Recepção responde pelo celular: a IA não responde, lembrete (`bot`) de outro cliente não pausa ninguém, releitura não muda nada, pausa vencida devolve a conversa à IA, nova mensagem da equipe pausa de novo.
- **41** · A conversa real de 02/10 no WhatsApp da Dino ("Oi, boa tarde" → "Quero cortar o cabelo amanhã à tarde, tem horário?" → "Quanto custa corte e barba?" → escolhe → "pode marcar"): horários reais oferecidos, preços respondidos do catálogo e agendamento gravado. No atendimento manual do mesmo dia: o preço nunca foi respondido, sem horário concreto, respostas por áudio e mensagens apagadas.

### Única dependência externa: áudio do cliente (backend do WhatsApp)

O SetPoint já transcreve áudio e descreve foto (Gemini), mas o `chatbot-backend-nestjs` hoje entrega áudio só como `content: "[ÁUDIO RECEBIDO]"`, sem o arquivo (o NossaGente também não recebe o arquivo). Enquanto isso não mudar, áudio recebe a resposta fixa pedindo texto. **Mudança necessária no backend** (qualquer uma das três; a 3 é a recomendada):

1. incluir no item de `GET /messages`: `media: { base64, mimetype }`;
2. incluir `mediaUrl` baixável;
3. **rota** `GET /api/v1/whats-app/messages/{whatsappMessageId}/media` → binário ou `{ base64, mimetype }`, com o mesmo `X-API-KEY`.

Com a opção 3 publicada, basta setar no Render `CHATBOT_BACKEND_MEDIA_PATH=/messages/{id}/media`: sem deploy de código no SetPoint. A mídia nunca é gravada (só memória durante a transcrição).

### Ligar em produção (sequência segura)

1. Merge desta branch na de produção → o pré-deploy aplica a 061.
2. Render: `WHATSAPP_PROVIDER=chatbot_backend`, `CHATBOT_BACKEND_URL` (backend **da Dino**), `CHATBOT_BACKEND_KEY`, `CHATBOT_BACKEND_MODE=instancias`, `CHATBOT_BACKEND_INSTANCE=dino`, `CHATBOT_BACKEND_EMPRESA_ID`, `FEATURE_WHATSAPP_AI=true`, `GEMINI_API_KEY`, `WHATSAPP_POLL_MODE=pilot` + `WHATSAPP_POLL_PILOT_PHONES=<número de teste>`.
3. `/admin/whatsapp` → **Gerar QR** → no celular da Dino: Aparelhos conectados → Conectar aparelho.
4. Piloto com o número de teste; em seguida `WHATSAPP_POLL_MODE=on`.
5. Desligar a qualquer momento: `WHATSAPP_POLL_MODE=off` (agenda e painel seguem normais).

## Atendente 4: painel da recepção e resumo diário do dono

### Painel da recepção (Integrações → Fila de atendimento humano)

- O motivo aparece em português ("equipe respondendo pelo celular", "cliente pediu uma pessoa", "dado sensível enviado"…) em vez do código interno.
- Conversa pausada porque a recepção respondeu no celular mostra **"IA volta sozinha às HH:MM"** e o botão **"Devolver à IA agora"**, para quando a equipe termina antes.

### Resumo diário no WhatsApp (Gestão → Resumo diário)

Todo dia, no horário escolhido, o dono recebe o fechamento: atendimentos concluídos, valor atendido, faltas e cancelamentos, conversas atendidas pela IA, horários marcados sozinha (e o valor previsto), remarcações, cancelamentos e pedidos feitos pela IA, conversas esperando a equipe (por motivo) e a agenda de amanhã. A tela mostra a prévia exata da mensagem e tem **Enviar agora**.

| Variável | Exemplo | Efeito |
| --- | --- | --- |
| `DINO_RESUMO_DIARIO` | `on` | liga o envio automático (desligado por padrão) |
| `DINO_RESUMO_TELEFONES` | `5565999990001` | quem recebe (vírgula para mais de um) |
| `DINO_RESUMO_HORA` | `21:00` | horário de Cuiabá |
| `DINO_RESUMO_EMPRESA_ID` | — | padrão: `CHATBOT_BACKEND_EMPRESA_ID` |
| `DINO_RESUMO_LOJA_ID` | — | padrão: a loja do canal WhatsApp ativo |

O envio é idempotente (migration **062**, uma linha por empresa e dia): reinício do servidor não manda duas vezes. Se o envio falhar, tenta de novo até 3 vezes no mesmo dia. Sem PostgreSQL, o resumo sai só com os números da agenda.

### Áudio do cliente

A especificação da rota que falta no backend do WhatsApp, com código de referência, está em `docs/operations/WHATSAPP-BACKEND-MIDIA.md`.

## Antes de ler o QR: checklist validado em produção (03/10/2026)

Estado conferido no ar após o deploy do `4f5e2c0` (#209): migrations 061 e 062 aplicadas; feature flag, Gemini, provedor WhatsApp e canal do atendente prontos; **número ainda não pareado** (aguardando leitura do QR), então nada entra nem sai.

1. **A agenda real precisa estar no Kytto.** A IA oferece horários a partir da agenda do Kytto. Em 03/10 ela estava vazia para hoje e para segunda, enquanto a Dino ainda operava a agenda no sistema anterior. Com a IA ligada nesse estado, ela ofereceria como livres horários que já estão ocupados lá. Antes do QR: importar os agendamentos futuros ou passar a recepção a usar só o Kytto, e conferir bloqueios e folgas de cada barbeiro.
2. **Começar em piloto.** Hoje `WHATSAPP_POLL_MODE=on` no Render: assim que o QR for lido, a IA responde **todos** os clientes. Para o piloto, use `WHATSAPP_POLL_MODE=pilot` com `WHATSAPP_POLL_PILOT_PHONES=<números de teste>` e passe para `on` depois de aprovado.
3. **Resumo diário:** `DINO_RESUMO_DIARIO=on` e `DINO_RESUMO_TELEFONES=<número do dono>`. A tela em Gestão → Resumo diário mostra a prévia exata. Com a sessão em "todas as lojas", a tela usa a loja do canal WhatsApp, a mesma do envio automático.

## Antes de liberar para os clientes

A aba **Cérebro IA → Colocar tudo no ar** tem o grupo "Antes de liberar para os clientes". Só troque `WHATSAPP_POLL_MODE` de `pilot` para `on` com todos os itens verdes:

| Item | Por que importa |
| --- | --- |
| Quem fala com a IA | Em `on` com pendências, ao ler o QR todos os clientes já falam com a IA. Use `pilot` com `WHATSAPP_POLL_PILOT_PHONES` até o ensaio passar. |
| Agenda do Kytto em uso | Sem horários futuros no Kytto, a IA oferece horários que estão ocupados no sistema antigo. |
| Profissionais com dias e horário | A IA só oferece horário dentro da jornada de cada um. |
| Quem faz cada serviço especializado | Manicure, pedicure, massagem, química e estética sem "quem faz" aceitam qualquer barbeiro. |
| Fila da equipe em dia | Conversas esperando a equipe há mais de 2 horas (fora a pausa automática de quando a equipe responde pelo celular). |
| Resumo diário (opcional) | `DINO_RESUMO_DIARIO=on` e `DINO_RESUMO_TELEFONES`. |

O ensaio geral com o catálogo, a equipe e o horário reais (`app/core/fixtures/dino-producao.json`) roda com:

```
WHATSAPP_SIM_PG_URL=postgres://postgres@127.0.0.1:5433/ensaio DB_SSL=false \
  node --test app/core/whatsapp-ai-ensaio-dino.pg.test.js
```
