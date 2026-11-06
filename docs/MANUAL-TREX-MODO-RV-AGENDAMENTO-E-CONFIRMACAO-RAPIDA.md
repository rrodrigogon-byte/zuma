# Manual Operacional & Diretrizes Técnicas: Modo RV (Régua Veloz) do T-Rex

**Barbearia Dino & Perfumaria × ERP Kytto**  
*Atendimento Conversacional Ágil, Direto e Humanizado via WhatsApp*

---

## 1. Visão Geral e Propósito

O **Modo RV (Régua Veloz)** foi desenvolvido para eliminar todos os atritos, atrasos conversacionais, perguntas redundantes e burocracias desnecessárias na interação entre os clientes da Barbearia Dino e a inteligência artificial **T-Rex**.

Na hotelaria e barbearia executiva de alto padrão, o cliente valoriza agilidade, clareza e acolhimento imediato. O Modo RV transforma o T-Rex em um concierge direto e resolutivo, reduzindo o tempo médio de agendamento de 4 turnos para **no máximo 2 turnos rápidos**, e a confirmação de presença de lembretes para **1 único turno definitivo**.

---

## 2. Pilares da Régua Veloz (RV)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PILAR 1: AGENDAMENTO EM 2 TURNOS                │
│ Cliente informa serviço + dia/horário ➔ T-Rex verifica e prepara direto │
│ Cliente responde "SIM" ou afirmativa ➔ Agendado na hora com Código!   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PILAR 2: CONFIRMAÇÃO DE LEMBRETE EM 1 TURNO          │
│ Lembrete enviado ➔ Cliente responde "Confirmo", "Sim", "Ok", "👍"     │
│ Sistema confirma na agenda ➔ Resposta calorosa em 1 linha de fechamento │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PILAR 3: SUPRESSÃO DE RUÍDOS E BUROCRACIA            │
│ Sem apresentações repetitivas de "Sou novo por aqui" para clientes     │
│ Sem perguntas de pesquisas ou preferências no meio do agendamento      │
│ Respostas curtas de até 2 a 3 linhas com vocabulário acolhedor da Dino │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fluxo Comparativo: Antes vs. Depois (Modo RV)

### 3.1. Cenário: Confirmação de Presença após Lembrete

| Etapa | Comportamento Anterior (Lento / Burocrático) | Comportamento Modo RV (Rápido e Direto) |
| :--- | :--- | :--- |
| **Lembrete** | *"Passando pra lembrar: amanhã às 14h45, Corte com Nati. Responda CONFIRMO..."* | *"Passando pra lembrar: amanhã às 14h45, Corte com Nati. Responda CONFIRMO..."* |
| **Resposta do Cliente** | *"Confirmo"*, *"Confirmado"*, *"Pode ser sim"* ou *"👍"* | *"Confirmo"*, *"Confirmado"*, *"Pode ser sim"* ou *"👍"* |
| **Reação da IA** | *"Tenho vários agendamentos seus aqui. Qual quer confirmar? Me fala o dia e a hora..."* ou *"Me fala um SIM pra eu deixar na régua..."* | **Confirmação Instantânea na Agenda:**<br>*"Fechado, Felipe! Presença confirmada para amanhã às 14h45 com a Nati. Te esperamos na Dino Barbearia! 💈"* |
| **Total de Turnos** | 3 a 4 mensagens com risco de cancelamento indevido | **1 turno direto e resolvido com sucesso!** |

---

### 3.2. Cenário: Agendamento de Novo Atendimento

| Etapa | Comportamento Anterior | Comportamento Modo RV |
| :--- | :--- | :--- |
| **Turno 1** | **Cliente:** *"Quero cortar amanhã às 15h com a Nati"*<br>**IA:** *"Temos sim! Corte Premium com a Nati amanhã às 15h sai por R$ 100. Quer que eu prepare o agendamento?"* | **Cliente:** *"Quero cortar amanhã às 15h com a Nati"*<br>**T-Rex (RV):** *"Show, [Nome]! Horário das 15h com a Nati tá livre! Confere pra mim: Corte Premium, amanhã (sáb 07/11) às 15h - R$ 100. Só me mandar um 'SIM' pra fechar na régua! 💈"* *(Ferramenta `preparar_agendamento` chamada no mesmo turno)* |
| **Turno 2** | **Cliente:** *"Sim"*<br>**IA:** *"Confere aí: Corte com Nati... Responda SIM para confirmar"* | **Cliente:** *"Sim"*, *"Ok"*, *"Fechou"* ou *"Pode marcar"*<br>**T-Rex (RV):** *"Prontinho, [Nome]! Agendado com sucesso para amanhã às 15h com a Nati. Código #9AB9E587. Te esperamos lá! 💈"* |
| **Turno 3** | **Cliente:** *"Sim"* pela segunda vez... | *(Não necessário - cliente já está atendido!)* |

---

## 4. Dicionário Ampliado de Confirmações Naturais

O regex de intenção de confirmação (`presenceConfirmIntent`) agora aceita de forma determinística e com latência zero:

- **Verbos e Variações Formais:** `confirmo`, `confirmando`, `confirmado`, `confirmada`, `confirma`, `confirma pra mim`, `pode confirmar`, `confirmar`, `sim confirmar`, `confirmo presença`, `estarei aí`, `estarei lá`, `vou sim`, `vou comparecer`, `confirmadíssimo`.
- **Acordos Rápidos e Gírias Naturais:** `sim`, `ok`, `pode ser`, `pode ser sim`, `sim pode ser`, `fechado`, `fechou`, `combinado`, `certo`, `marcado`, `tá marcado`, `beleza`, `blz`, `bora`, `show`, `tamo junto`, `com certeza`, `partiu`.
- **Status de Chegada / Proximidade:** `tô a caminho`, `estou a caminho`, `chegando`, `já tô chegando`, `já cheguei`, `tô chegando`.
- **Menções ao Próprio Procedimento:** `corte cabelo e barba`, `corte e barba`, `corte`, `barba`.
- **Emojis Afirmativos:** 👍, 💈, ✂️, 👌, 🤝, 🙏, ✅, ✔️, 💪, 🔥.

---

## 5. Garantias e Proteções Anti-Atrito

1. **Supressão de Pesquisas de Preferências:** O T-Rex nunca mais perguntará *"Posso salvar suas preferências pra agilizar as próximas vezes?"* durante uma conversa de agendamento ou tira-dúvidas.
2. **Eliminação do Lembrete Duplicado:** O cliente que acaba de agendar pelo WhatsApp e receber o código não recebe lembrete no minuto seguinte. Os lembretes são enviados apenas nas réguas oficiais matinais de véspera e do dia.
3. **Múltiplos Serviços Consecutivos (Combos Club):** Quando o cliente possui Barba e Corte agendados em sequência, o T-Rex confirma todos os serviços juntos, sem deixar o cliente confuso.
4. **Proteção de Identidade:** O T-Rex jamais se reapresenta como *"membro novo da equipe"* para clientes antigos com histórico na casa.

---

*Manual homologado e em produção no ERP Kytto / Barbearia Dino.*
