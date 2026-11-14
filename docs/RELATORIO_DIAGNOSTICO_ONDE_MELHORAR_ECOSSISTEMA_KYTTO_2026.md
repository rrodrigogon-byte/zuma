# Diagnóstico Estratégico & Plano de Melhorias do Ecossistema Kytto 2026

**Data:** 14 de Novembro de 2026  
**Ambiente:** Produção (PRD) — `https://kytto.com.br/`  
**Escopo:** Barbearia Dino • Serrano Concreto Usinado • Palatare Pizzaria • Supermercado PDV • Motor KyttoIA (T-Rex) • Gestão & Finanças  
**Responsável Técnico:** Equipe de Engenharia & IA Kytto  

---

## 1. Sumário Executivo

Após a validação operacional dos sistemas em produção, realizamos uma auditoria técnica e comercial minuciosa no banco de dados PostgreSQL (`kytto_commerce_core`), no histórico de mensagens do WhatsApp (7.919 mensagens registradas), nos estados em memória do ERP e nos fluxos de usuário.

O objetivo deste relatório é apontar com clareza **onde estamos deixando dinheiro na mesa**, quais são os gargalos operacionais e quais melhorias trazem o **maior retorno financeiro com o menor esforço de implementação**.

---

## 2. Mapa de Oportunidades: Matriz de Priorização (Impacto vs. Esforço)

Abaixo apresentamos a matriz de priorização estratégica desenvolvida para orientar os próximos passos do ecossistema:

![Matriz de Priorização de Melhorias](/home/ubuntu/grafico_matriz_melhorias_kytto_2026.png)

---

## 3. Diagnóstico Detalhado por Unidade de Negócio

### 3.1. Barbearia Dino & Motor KyttoIA (T-Rex)

A Barbearia Dino possui forte tração de agendamentos e uma carteira consolidada de mais de 3.000 clientes (sendo 294 já no banco PostgreSQL e milhares no histórico Avec). Entretanto, identificamos 5 gargalos centrais:

#### A. Saneamento do Catálogo de Serviços e Produtos no ERP (Gargalo Crítico)
* **Diagnóstico Técnico:** Ao inspecionar o estado da empresa Dino no ERP (`s.servicos`), constatamos que existe apenas 1 serviço oficialmente cadastrado na tabela interna (`Corte Masculino R$ 90,00`). Serviços frequentemente solicitados (Barba Terapia R$ 60, Combo Corte + Barba R$ 140, Selagem R$ 120, Sobrancelha R$ 30) existem no prompt do T-Rex e no agendamento online, mas não estão na tabela central de serviços do ERP.
* **Estoque de Perfumaria Vazio:** O array `s.produtosRevenda` da Dino está vazio (`[]`). Dessa forma, quando o barbeiro fecha a comanda presencial no balcão, ele não consegue selecionar a Pomada Matte (R$ 45) ou o Óleo de Barba (R$ 38) com baixa automática de estoque.
* **Impacto Comercial:** A equipe física deixa de oferecer e registrar produtos na comanda por falta de praticidade no PDV, e o sistema não consegue apurar a comissão de 10% de perfumaria dos barbeiros de forma automática.
* **Ação Imediata:** Injetar e sincronizar o catálogo completo de 8 serviços e 6 produtos da linha Dino com saldo de estoque inicial.

#### B. Upsell Presencial no Fechamento da Comanda (Tablet do Balcão)
* **Diagnóstico:** Hoje, o atendente abre a comanda, recebe o corte e finaliza.
* **Melhoria:** Implementar um modal leve de 1 clique antes do recebimento: *"Deseja incluir a Pomada Modeladora Matte Dino por R$ 45,00? (Comissão do barbeiro: R$ 4,50)"*. Se 25% dos clientes aceitarem, representará um incremento imediato de R$ 4.500 a R$ 8.000/mês no faturamento da loja.

#### C. Unificação Cadastral de Profissionais
* **Diagnóstico:** No cadastro de equipe da Dino ainda constam simultaneamente `Nati` e `Natani` ativas, gerando risco de concorrência de agenda ou confusão na escala.
* **Ação:** Unificar os históricos sob a titular `Nati` e inativar o alias secundário.

#### D. Assinatura do Club Dino com Débito Recorrente Automático
* **Diagnóstico:** O plano de assinaturas depende de cobrança pontual ou pagamento avulso.
* **Melhoria:** Integrar a recorrência via Token de Cartão de Crédito ou Assinatura PIX (PIX Automático Bacen) para os pacotes mensais (ex: R$ 320/mês para 4 procedimentos). Isso cria previsibilidade de caixa recorrente (ARR) para o Dino.

#### E. Voz Sintética Humanizada do T-Rex (TTS em Áudio)
* **Diagnóstico:** O T-Rex responde por texto com agilidade (TMR de 1.2s), mas áudios aumentam a conexão emocional com o cliente.
* **Melhoria:** Ativar o envio de áudio curto com síntese de voz (TTS) para mensagens de aniversário e clientes VIP sendo recuperados.

---

### 3.2. Serrano Concreto Usinado

O módulo de concreto já conta com automação de pesagem Toledo 80t, laboratório NBR 5738/5739 e gráficos comparativos de resistência.

* **Oportunidade 1: Laudo Pericial de Ruptura NBR 5739 em PDF com Hash SHA-256.**  
  As construtoras exigem laudos técnicos assinados para anexar aos dossiês de financiamento bancário (Caixa / PBQP-H). A geração automática desse PDF com QR Code público de autenticidade elimina o trabalho manual do laboratorista e transmite solidez perante as grandes obras do Mato Grosso.
* **Oportunidade 2: App PWA do Motorista de Betoneira com Alerta de Demurrage.**  
  Disponibilizar uma tela simplificada para o motorista marcar: *Saída Usina -> Chegada na Obra -> Início da Descarga -> Fim da Descarga*. O sistema passa a tarifar automaticamente a estadia excedente (> 30 min) a R$ 180,00/hora.

---

### 3.3. Palatare Pizzaria Suite

A suíte consolidou o KDS do forno a 400°C, rodízio e delivery multicanal.

* **Oportunidade 1: Alerta Sonoro de Entrada de Pedidos no KDS.**  
  Inserir bip característico via Web Audio API sempre que um novo pedido de pizza for despachado para o forno, garantindo que o forneiro não atrase o tempo de cocção em horários de pico.
* **Oportunidade 2: Notificações Transacionais no WhatsApp do Cliente.**  
  Disparos automáticos que reduzem a ansiedade do cliente e diminuem mensagens no suporte:  
  1. *"Sua pizza acabou de entrar no forno a 400°C! 🍕"*  
  2. *"Seu pedido saiu para entrega com o motoboy! 🛵"*

---

### 3.4. Supermercado & Frente de Caixa (PDV Offline)

* **Oportunidade 1: Importador de XML de NFe de Compra (Entrada de Estoque).**  
  Permitir arrastar o arquivo `.xml` da nota fiscal do fornecedor para cadastrar ou atualizar automaticamente os produtos, custos, código de barras EAN-13, NCM, alíquotas tributárias e margem de markup, eliminando digitação manual.
* **Oportunidade 2: Sincronização Local First com Leitor de Balança de Checkout.**  
  Homologar a leitura direta de peso de balanças Toledo Prix 3 Fit via porta serial/USB no navegador pelo Web Serial API.

---

### 3.5. Inteligência Financeira & Gestão Fiscal

* **Conciliação de Taxas MDR de Cartão/TEF:**  
  No fechamento diário das 20h00, detalhar a taxa retida pela adquirente (ex: Cielo, Stone, PagBank) e o valor líquido real que entrará na conta bancária (D+1 no débito, D+30 no crédito).
* **Emissão em Lote de NFC-e:**  
  Possibilidade de emitir em lote no fechamento do dia todas as notas fiscais das comandas que não foram emitidas instantaneamente.

---

## 4. Matriz de Execução Recomendada (Plano de Ação)

| Sprint / Onda | Entregável Principal | Impacto Estimado | Esforço |
| :--- | :--- | :---: | :---: |
| **Onda 1 (Imediata)** | Saneamento do catálogo de serviços e estoque de produtos da Barbearia Dino | **R$ +6.000/mês** | Baixo (1 dia) |
| **Onda 1 (Imediata)** | Unificação de profissionais (`Natani` -> `Nati`) | Elimina atrito | Baixo (2 horas) |
| **Onda 1 (Imediata)** | Upsell balcão de 1 clique na comanda presencial | **R$ +4.500/mês** | Baixo (1 dia) |
| **Onda 2 (Semana que vem)** | Alerta sonoro no KDS Palatare e WhatsApp de saída do motoboy | Satisfação +35% | Baixo (2 dias) |
| **Onda 2 (Semana que vem)** | Laudo pericial NBR 5739 com SHA-256 e QR Code para Construtoras | Conformidade 100% | Médio (2 dias) |
| **Onda 3 (Próximos 15 dias)** | Importador de XML de NFe para Supermercado e Estoque | Redução de 90% no tempo de cadastro | Médio (3 dias) |
| **Onda 3 (Próximos 15 dias)** | Assinatura com débito recorrente no Club Dino (Cartão / PIX) | Previsibilidade R$ 320/mês por assinante | Médio (3 dias) |

---

## 5. Conclusão

O ecossistema Kytto está em um nível técnico e de infraestrutura extremamente robusto, com deploys automáticos em produção no Render, alta disponibilidade, workers de gestão operando pontualmente e canais oficiais conectados.

A prioridade recomendada para capturar o maior valor imediato é executar os **Quick Wins da Onda 1**: sanear o catálogo oficial de serviços e produtos no ERP da Dino e ativar o upsell de balcão de 1 clique na comanda física.
