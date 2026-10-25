# Relatório de Validação e Evidências — IA Consultiva e Venda de Pacotes Kytto

**Data:** 25 de Outubro de 2026  
**Ambiente:** Produção (PRD) — `https://kytto.com.br`  
**Deploy:** `dep-dbf4taks728c73d5sem0` (Commit `f43a43bf`)  
**Status do Serviço:** Live / Operacional (HTTP 200 Ready)  

---

## 1. Visão Geral da Funcionalidade

A inteligência artificial da Kytto foi aprimorada para atuar como uma consultora inteligente de vendas e fidelização durante e após os agendamentos realizados via WhatsApp.

O objetivo é transformar a IA de um simples robô de agendamento em uma ferramenta ativa de aumento de faturamento e retenção de clientes, sem criar fricção ou parecer uma abordagem comercial invasiva.

A dinâmica é estruturada em três momentos:
1. **Resolução da intenção primária:** O cliente faz o agendamento do serviço e do profissional desejado e confirma com `SIM`.
2. **Pergunta relacional de qualificação:** A IA confirma o agendamento e, de forma natural, pergunta a rotina do cliente (*“Você costuma cortar o cabelo ou fazer a barba de quanto em quanto tempo?”*).
3. **Apresentação personalizada com economia real:** Ao receber a resposta de frequência, a ferramenta determinística `calcular_pacote_frequencia` calcula os valores com desconto (10%, 15% e 20%) baseados na tabela de preços do profissional agendado, calcula a economia exata em reais ($R\$$) e recomenda o pacote ideal para a rotina dele.

---

## 2. Lógica Matemática de Precificação por Profissional

A regra de pacotes se adapta ao preço unitário de cada profissional cadastrado na barbearia:

| Profissional | Procedimento Avulso | Pacote 4 Procedimentos (10% OFF) | Pacote 6 Procedimentos (15% OFF) | Pacote 8 Procedimentos (20% OFF) |
| :--- | :--- | :--- | :--- | :--- |
| **Nati / Bruno** | R$ 100,00 | **R$ 360,00** *(de R$ 400 por R$ 360, econ. R$ 40)* | **R$ 510,00** *(de R$ 600 por R$ 510, econ. R$ 90)* | **R$ 640,00** *(de R$ 800 por R$ 640, econ. R$ 160)* |
| **David / Vitor** | R$ 80,00 | **R$ 288,00** *(de R$ 320 por R$ 288, econ. R$ 32)* | **R$ 408,00** *(de R$ 480 por R$ 408, econ. R$ 72)* | **R$ 512,00** *(de R$ 640 por R$ 512, econ. R$ 128)* |
| **Dino** | R$ 300,00 | **R$ 1.080,00** *(de R$ 1.200 por R$ 1.080, econ. R$ 120)* | **R$ 1.530,00** *(de R$ 1.800 por R$ 1.530, econ. R$ 270)* | **R$ 1.920,00** *(de R$ 2.400 por R$ 1.920, econ. R$ 480)* |

---

## 3. Inteligência Comportamental: Frequência e Tipos de Serviço

A IA analisa a resposta de frequência fornecida pelo cliente e cruza com os procedimentos que ele realiza:

* **Cliente quinzenal (a cada 15 dias) de Cabelo e Barba:** Consome 4 procedimentos por mês (2 cortes + 2 barbas). A IA recomenda o **Pacote de 4 procedimentos**, destacando que cobre perfeitamente o mês dele com 10% de desconto.
* **Cliente semanal (a cada 7 dias) de Cabelo e Barba:** Consome 8 procedimentos por mês (4 cortes + 4 barbas). A IA recomenda o **Pacote de 8 procedimentos**, destacando a economia máxima de 20% de desconto.
* **Cliente quinzenal de apenas Cabelo:** Consome 2 cortes por mês. A IA apresenta que o pacote de 4 procedimentos cobre dois meses de visual alinhado ou dá margem para fazer a barba com 10% de desconto.
* **Cliente mensal:** O pacote de 4 procedimentos é recomendado com flexibilidade para os próximos meses.

---

## 4. Evidências dos Testes Automatizados

Foi criado um arquivo de suíte de testes de integração ponta a ponta (`app/core/whatsapp-ai-venda-pacotes.test.js`) validando todos os componentes da solução.

### Execução dos Testes Unitários

```text
✔ 1. Tool calcular_pacote_frequencia está devidamente declarada na allowlist (1.15ms)
✔ 2. Cálculo com profissional Bruno ou Nati (base R$ 100) para cliente quinzenal combo (3.31ms)
✔ 3. Cálculo com profissional David (base R$ 80) para cliente semanal combo (0.92ms)
✔ 4. Resposta com valores calculados é autorizada por unbackedPrices (sem preços inventados) (2.71ms)
✔ 5. Mensagem consultiva de pacotes é aprovada pelo validador de saída sem censura (1.22ms)
✔ 6. Semeadura de pacotes no ERP da barbearia cria os 6 planos oficiais (14.05ms)
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

### Validações de Segurança e Anti-Alucinação

1. **`unbackedPrices`:** Como a ferramenta `calcular_pacote_frequencia` retorna os preços cheios, preços com desconto e valores de economia, o coletor de ferramentas registra esses valores como oficiais da sessão. O validador confirma `violacoesPreco = []` (nenhum preço bloqueado). Quando foi inserido um valor fictício não retornado pela ferramenta (R$ 1.999), o validador bloqueou imediatamente `[199900]`.
2. **`validateWhatsappAiOutput`:** A mensagem com tom consultivo e acolhedor passou com zero violações de política comercial (`violations: []`).
3. **Testes do Core:** Toda a suíte de 94 testes relacionados a WhatsApp AI, CRM, personas e perfis de acesso foi executada com 100% de sucesso.

---

## 5. Evidências de Deploy em Produção (PRD)

* **Serviço no Render:** `srv-d8iudokm0tmc73c07iog` (nome `setpoint`)
* **Deploy ID:** `dep-dbf4taks728c73d5sem0`
* **Status:** `live` (concluído às 18:48:24 UTC / 14:48:24 Horário Local)
* **Commit:** `f43a43bfe0c20811f251d473325cd215f9472d95`
* **Verificação de Healthcheck:**
  ```json
  GET https://kytto.com.br/health -> HTTP 200
  {"status":"ready","persistencia":"ok"}
  ```
* **Verificação do Snapshot no Banco de Dados (PostgreSQL):**
  Snapshot ID `1408` criado às 18:48:22 UTC com tamanho original de 116.170.288 bytes (116,1 MB), confirmando a gravação íntegra do estado e dos planos da barbearia.

---

## 6. Simulação de Cenários de Conversa Real

### Cenário 1: Agendamento com Nati (Combo Cabelo + Barba a cada 15 dias)
> **Cliente:** Olá, gostaria de marcar corte e barba com a Nati na sexta às 15h.  
> **IA:** Oi! Consigo agendar com a Nati na sexta, 31/10, às 15:00. O Corte com Bruno ou Nati é R$ 100 e a Barba é R$ 100, total R$ 200. Posso confirmar?  
> **Cliente:** Sim, confirma por favor!  
> **IA:** Fechado! Corte e Barba com Nati, sexta 31/10 às 15h. Código AG9821.  
>  
> Você costuma cortar o cabelo ou fazer a barba de quanto em quanto tempo?  
> **Cliente:** Eu corto de 15 em 15 dias e faço a barba também.  
> **IA:** Show de bola! Você sabia que temos pacotes mensais para você economizar e manter seu visual sempre alinhado?  
>  
> Como você vem a cada 15 dias e faz cabelo e barba, você consome exatamente 4 procedimentos no mês (2 cortes e 2 barbas).  
>  
> No pacote de 4 procedimentos com a Nati, você tem 10% de desconto: sai de R$ 400 por R$ 360 (já economiza R$ 40 no mês).  
> Temos também com 6 procedimentos (15% off, de R$ 600 por R$ 510, economia de R$ 90) e 8 procedimentos (20% off, de R$ 800 por R$ 640, economia de R$ 160).  
>  
> Faz sentido pra você garantir um pacote desse pra economizar?  
> **Cliente:** Poxa, faz bastante sentido! Como faço pra assinar?  
> **IA:** Maravilha! Quando você vier na sexta, é só falar com a recepção na sua chegada que eles já ativam seu pacote na hora. Te espero na sexta!

---

### Cenário 2: Agendamento com David (Cliente Semanal)
> **Cliente:** Quero marcar corte com o David amanhã às 14h.  
> **IA:** Tá preparado para amanhã, 26/10 às 14:00 com o David (R$ 80,00). Responda SIM para confirmar.  
> **Cliente:** SIM.  
> **IA:** Tá marcado! Corte com David, amanhã 26/10 às 14h. Código AG4412.  
>  
> Você costuma cortar o cabelo ou fazer a barba de quanto em quanto tempo?  
> **Cliente:** Eu venho toda semana dar um talento no cabelo e na barba.  
> **IA:** Que bacana! Sabia que temos pacotes mensais para quem mantém essa frequência?  
>  
> Como você vem toda semana e faz cabelo e barba (8 procedimentos no mês), o pacote de 8 procedimentos é perfeito: você garante 20% de desconto e economiza R$ 128 no mês!  
>  
> Sai de R$ 640 por R$ 512 com o David. Temos também com 4 procedimentos (10% off, de R$ 320 por R$ 288) e 6 procedimentos (15% off, de R$ 480 por R$ 408).  
>  
> Quer que eu te passe como funciona pra você aproveitar?  

---

### Cenário 3: Cliente que não quer pacote no momento
> **Cliente:** Agora não, prefiro pagar avulso mesmo.  
> **IA:** Tranquilo! Sem problemas. Quando quiser ver, só me chamar. Te espero amanhã no seu horário!
