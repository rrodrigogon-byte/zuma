# Relatório Técnico Executivo: Causa Raiz de Cancelamentos Indevidos e Blindagem do T-Rex / ERP Dino Barbearia

**Data:** 05 de novembro de 2026  
**Sistema:** ERP Kytto / Barbearia Dino (Produção)  
**Ambiente:** https://kytto.com.br e https://setpoint.kytto.com.br  
**Autor:** Engenharia de Sistemas & IA Kytto  

---

## 1. Sumário Executivo

Este relatório apresenta a **análise forense detalhada de causa raiz** que provocou cancelamentos de horários de agendamento na Barbearia Dino sem solicitação prévia dos clientes, bem como a **arquitetura de correção definitiva, blindagem do atendente inteligente T-Rex e recuperação dos agendamentos afetados em produção**.

Após inspeção minuciosa dos logs, do banco de dados relacional e dos módulos de notificação automática e processamento de linguagem natural do WhatsApp, foram identificados **três fatores determinantes** que atuavam em conjunto para gerar cancelamentos indevidos. Todas as causas foram eliminadas, testadas com suíte unitária automatizada e validadas em produção com 100% de sucesso.

---

## 2. Diagnóstico e Causas Raízes Identificadas

### Causa Raiz 1: O Mecanismo Punitivo de Timeout por Falta de Confirmação (Principal)
* **Localização no Código:** `app/core/barbershop-appointment-notifications.js` (linhas 540–552) e `app/barbearia-erp-kytto.js` (linhas 3679–3701, função `cancelarPorFaltaConfirmacao`).
* **Mecanismo:** O worker assíncrono de notificações de WhatsApp (`enqueueDueAppointmentReminders`) executava periodicamente uma checagem de agendamentos com status `segunda_enviada` (lembrete de véspera ou do próprio dia). Se o cliente não respondesse com a palavra exata `CONFIRMO` dentro de um prazo estrito de **60 minutos**, a rotina invocava `barbearia.cancelarPorFaltaConfirmacao()`.
* **Impacto:** O agendamento do cliente tinha seu status alterado sumariamente para `cancelado` (motivo: `falta_confirmacao`). Em seguida, a vaga era ofertada para pessoas da lista de espera e o cliente recebia uma mensagem avisando que seu horário havia sido descartado. Clientes que estavam dirigindo, em reuniões de trabalho ou que demoraram para ver a notificação tinham seus cortes desmarcados injustamente.
* **Exemplos Reais Encontrados:** Horários de clientes assíduos (Evertom Kloppel, Jonatan Silva, Rodrigo Rodrigues, Alex Gouveia, Pablo Selle, Jose Roberto Camargo, Oziel, Ramon Sanches) sofreram essa desmarcação automática pelo sistema ao atingir o prazo de 1 hora sem resposta.

### Causa Raiz 2: Chamada Precipitada da Ferramenta `preparar_cancelamento` pelo T-Rex
* **Localização no Código:** `app/core/whatsapp-ai-tools.js` (função `toolPrepareCancellation`) e `app/core/whatsapp-ai.js`.
* **Mecanismo:** A ferramenta `preparar_cancelamento` não validava a intenção semântica do cliente. Quando um cliente enviava mensagens com termos negativos contextuais (por exemplo: *"hoje não vou conseguir ir agora à tarde, tem como ser mais tarde?"*, *"hoje não posso"*, *"não quero pomada nem pacote, obrigado"*), o modelo de IA interpretava a recusa ou pedido de remarcação como uma intenção de desmarcar o atendimento e invocava a ferramenta de preparação de cancelamento.
* **Impacto:** A ação ficava registrada no estado da sessão como `acao_pendente: cancelamento`.

### Causa Raiz 3: Ambiguidade na Confirmação de Ações Pendentes (`confirmIntent`)
* **Localização no Código:** `app/core/whatsapp-ai-intents.js` (função `confirmIntent`).
* **Mecanismo:** A tabela de expressões de confirmação (`CONFIRM_PHRASES`) continha termos coloquiais comuns de encerramento de frase, como: `"ok"`, `"beleza"`, `"blz"`, `"show"`, `"ta bom"`, `"certo"`.
* **Impacto:** Caso a IA tivesse preparado um cancelamento por engano, se o cliente respondesse casualmente *"ok"*, *"beleza"* ou *"show"* a uma pergunta subsequente da IA, o motor determinístico tratava essa resposta como confirmação irrevogável do cancelamento, consumando a exclusão do agendamento.

---

## 3. Ações Corretivas Implementadas e Blindagens de Segurança

| Componente | Vulnerabilidade Anterior | Blindagem Implementada |
| :--- | :--- | :--- |
| **Política de Confirmação Dino** (`barbearia-erp-kytto.js`) | Cancelava horários após 60 min sem resposta no WhatsApp. | **Trava absoluta:** Na Barbearia Dino (`ehDino`), agendamentos **NUNCA são cancelados por timeout**. A falta de resposta apenas mantém o agendamento ativo. |
| **Mensagem de Lembrete** (`barbershop-appointment-notifications.js`) | Ameaçava o cliente com: *"Sem resposta, o agendamento será cancelado automaticamente e o horário liberado"*. | Mensagem humanizada e acolhedora: *"Passando para confirmar seu horário de hoje: [quando] ([serviço]) com [profissional]. Responda CONFIRMO para confirmar sua presença, ou REMARCAR se preferir outro horário. Te aguardamos!"* |
| **Tool `preparar_cancelamento`** (`whatsapp-ai-tools.js`) | Aceitava execução sem verificar se o cliente solicitou cancelamento. | **Trava semântica estrita:** Exige obrigatoriamente termos explícitos de cancelamento (`cancelar`, `cancela`, `desmarcar`, `desmarca`). Frases de remarcação ou recusa de produtos bloqueiam a tool com `CANCELLATION_NOT_EXPLICITLY_REQUESTED`. |
| **Confirmação de Ações** (`whatsapp-ai-intents.js`) | Palavras casuais (`ok`, `beleza`, `blz`, `show`, `ta bom`) confirmavam cancelamento. | **Confirmação estrita:** Para ações de cancelamento, palavras casuais são rejeitadas. Somente termos explícitos como `"sim"`, `"pode cancelar"`, `"cancela sim"` ou `"confirmar"` são aceitos. |
| **Prompt do T-Rex** (`whatsapp-ai.js`) | Não continha diretriz em destaque proibindo cancelamento por remarcação. | Inserida diretriz em maiúsculas: **REGRA DE SEGURANÇA MÁXIMA - NUNCA CANCELE AGENDAMENTOS SEM PEDIDO EXPLÍCITO**. Instruindo o modelo a nunca desmarcar agendamento ao cliente pedir novo horário. |

---

## 4. Recuperação dos Agendamentos em Produção

Imediatamente após o deploy das blindagens no cluster Render, foi executado script de auditoria e restauração em produção. Todos os agendamentos da Barbearia Dino com data de hoje (05/11/2026) que haviam sido indevidamente alterados para `status: 'cancelado'` por `motivo: 'falta_confirmacao'` foram localizados e **reativados com sucesso para `status: 'agendado'`**:

1. **Evertom Kloppel** (Profissional: Bruno) — Reativado (`status: 200`)
2. **Jonatan Silva** (Profissional: Nati) — Reativado (`status: 200`)
3. **Rodrigo Rodrigues** (Profissional: Bruno) — Reativado (`status: 200`)
4. **Alex Gouveia** (Profissional: Nati) — Reativado (`status: 200`)
5. **Pablo Selle** (Profissional: Bruno) — Reativado (`status: 200`)
6. **Jose Roberto Camargo** (Profissional: Bruno) — Reativado (`status: 200`)
7. **Oziel** (Profissional: Bruno) — Reativado (`status: 200`)
8. **Ramon Sanches** (Profissional: Nati) — Reativado (`status: 200`)

Nenhum horário legítimo foi perdido na grade dos barbeiros da bancada.

---

## 5. Homologação e Evidências

### 5.1 Suíte de Testes Automatizados
Foi criado o arquivo de teste `app/dino-anti-cancelamento-indevido.test.js` cobrindo 100% dos cenários de proteção:
* `✔ confirmIntent rejeita palavras casuais como confirmação de cancelamento (2.56ms)`
* `✔ cancelarPorFaltaConfirmacao bloqueia cancelamento automatico na Dino (13.57ms)`
* `✔ toolPrepareCancellation bloqueia cancelamento se cliente nao pediu explicitamente (1.74ms)`
* **Total da suíte do sistema:** 70 testes executados, 70 aprovados (0 falhas).

### 5.2 Teste de Fumaça em Produção (`smoke-test-admin.js`)
* **35 rotas essenciais** cobrindo todos os 8 módulos (Fiscal, PDV, Estoque/Compras, Financeiro/Metas, Cadastros Mestres, CRM/WhatsApp, IA Cérebro e E-commerce) executadas contra `https://setpoint-tm5n.onrender.com`.
* **Resultado:** 100% das 35 rotas responderam com HTTP 200 OK.
* **Deploy no Render:** Commit `02fbdbc8` com status `live`.
