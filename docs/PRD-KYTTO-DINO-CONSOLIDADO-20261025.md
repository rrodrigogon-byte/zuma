# PRD — Documento de Requisitos de Produto e Especificação Técnica Consolidada
## Plataforma Kytto × Barbearia Dino (Produção / PRD)

**Versão:** 4.2.0-PROD  
**Data de Emissão:** 25 de Outubro de 2026  
**Responsável Técnico:** Rodrigo Ribeiro / Manus AI Engine  
**Ambiente:** Produção (PRD) — `https://kytto.com.br` e `https://dino.kytto.com.br`  
**Repositório:** `rrodrigogon-byte/agro-open` (Branch: `fix/kytto-comandas-pdv-20260808`)  
**Serviço de Produção (Render):** `setpoint` (`srv-d8iudokm0tmc73c07iog`)  
**Status dos Deploys:** LIVE / 100% Homologado em Produção  

---

## 1. Sumário Executivo e Objetivos Estratégicos

O presente **Documento de Requisitos de Produto (PRD)** consolida formalmente o conjunto de melhorias, módulos de inteligência analítica, regras contábeis, governança de comissionamento e automação conversacional implementados e homologados no ecossistema **Kytto** para a operação da **Barbearia Dino**.

### 1.1 Objetivos Centrais
1. **Auditoria e Integridade Contábil:** Saneamento definitivo de despesas históricas (71 lançamentos com status Atrasado herdados do sistema Avec), garantindo fluxo de caixa real, conciliação e apuração por competência.
2. **Projeção Inteligente e Gestão por IA:** Diagnóstico individualizado de produtividade por profissional, detecção preditiva de causas de crescimento ou oscilação de ticket médio e geração de planos de ação táticos persistidos nas metas do barbeiro.
3. **Plano de Remuneração e Bonificação Escalonada:** Configuração autônoma de metas progressivas de faturamento em serviços e produtos, calculando bonificações escalonadas (ex.: Naty com base 40% + 5% + 7% + 10%) e relatórios segmentados de faturamento bruto, categorias, pacotes, serviços extras e produtos.
4. **Agenda VIP 24x7 e Precificação Horária:** Disponibilização de agenda ininterrupta (24 horas, 7 dias por semana) para o barbeiro Dino (`Guilherme Cunha Martins`), com tarifação dinâmica automática de R$ 300,00 diurno e R$ 600,00 em horário extra noturno/madrugada (18h09 às 06h00).
5. **Autonomia Conversacional e Humanização da IA:** Ampliação do motor de inteligência no WhatsApp (T-Rex) com alerta prévio e transparente de valores, acolhimento afetivo baseado no histórico do cliente e 6 novas ações autônomas de autoatendimento.
6. **Arquitetura de Integração:** Priorização de sincronização orientada a eventos internos (`internal event-driven synchronization`) e retenção segura de dados e imagens.

---

## 2. Mapa dos Módulos Entregues e Pull Requests em Produção

Todos os componentes especificados neste PRD passaram pelo ciclo completo de desenvolvimento, validação unitária e de integração, revisão por Pull Request e deploy automatizado no Render:

| PR # | Branch Head | Módulo Principal | Status Git | Status Render |
| :--- | :--- | :--- | :--- | :--- |
| **#441** | `feat/dino-projecao-ia-profissional-20261024` | Projeção Inteligente e Diagnóstico por IA com Plano de Ação | **MERGED** | **LIVE** (`dep-dbejp7rbc2fs738l5a60`) |
| **#443** | `feat/financeiro-dinamico-interativo-20261024` | Financeiro Dinâmico, KPIs Clicáveis e Liquidação em Lote | **MERGED** | **LIVE** (`dep-dbejsfugej5s739tu6n0`) |
| **#446** | `feat/financeiro-performance-dre-20261024` | Otimização O(N) e DRE Gerencial Estruturado | **MERGED** | **LIVE** (`dep-dbeka8qjnfac73du9tm0`) |
| **#448** | `feat/barbearia-crm-retornos-perf-20261024` | CRM de Retornos Inteligente e Lazy Loading em ERP | **MERGED** | **LIVE** (`dep-dbekocg473hc73982a4g`) |
| **#453** | `feat/whatsapp-desconectar-novo-numero-20261025` | Desconexão Resiliente e Limpeza de Sessões Órfãs | **MERGED** | **LIVE** (`dep-dbf3tqrbc2fs738pjkhg`) |
| **#458** | `feat/metas-comissoes-bonificacoes-individuais-20261025` | Metas Escalonadas, Bonificações e 6 Relatórios Detalhados | **MERGED** | **LIVE** (`dep-dbf4r367bikc73br43u0`) |
| **#461** | `feat/metas-historico-completo-avec-20261025` | Integração Histórica Avec Completa nos Relatórios | **MERGED** | **LIVE** (`dep-dbf52qks728c73d624pg`) |
| **#464** | `feat/metas-ux-conciliacao-todas-abas-20261025` | Refinamento Visual de UX e Conciliação entre Abas | **MERGED** | **LIVE** (`dep-dbf5arh5efls73bkm1j0`) |
| **#466** | `feat/dino-agenda-24x7-horario-extra-600-20261025` | Agenda 24x7 Full de Dino, Corte R$ 600 Extra e Padrão Cliente | **MERGED** | **LIVE** (`dep-dbf7o3uq1p3s73eunl70`) |
| **#468** | `feat/whatsapp-alertar-valores-humanizado-20261025` | Alerta Transparente e Humanizado de Valores no Agendamento | **MERGED** | **LIVE** (`dep-dbf7ud67bikc73bumn1g`) |
| **#469** | `feat/whatsapp-ai-autonomia-acoes-completas-20261025` | 6 Novas Ações Autônomas e Expansão da IA no WhatsApp | **MERGED** | **LIVE** (`dep-dbf86j15efls73bnq31g`) |

---

## 3. Especificação Detalhada dos Módulos

### 3.1 Módulo Financeiro: Auditoria, Conciliação e DRE Gerencial
* **URL:** `https://kytto.com.br/admin/financeiro`
* **Saneamento das 71 Despesas Avec:**
  * Identificação de 71 despesas de fornecedores e serviços antigos de 10/11/2025 a 27/03/2026 com rótulo "Atrasado" na planilha de extrato da Avec, totalizando **R$ 48.076,63**.
  * Criação do endpoint de liquidação individual e em lote: `POST /api/admin/barbearia/financeiro/liquidar-lote`.
  * Na interface, o card "Vencidos (71)" disponibiliza o botão interativo *"Pagar todas em lote"*, permitindo conciliar com segurança sem comprometer o fluxo de caixa corrente.
* **Cards de KPI Clicáveis com Filtro Automático:**
  * *Saldo Realizado:* R$ 533.986,52 (Receitas pagas - Despesas pagas).
  * *A Receber:* Contas pendentes a entrar no caixa.
  * *A Pagar:* Contas pendentes a liquidar.
  * *Receitas do Mês:* Entradas pagas na competência atual.
  * *Despesas do Mês:* Saídas pagas na competência atual.
  * *Resultado do Mês:* Lucro e Margem % de contribuição em tempo real.
  * *Vencidos:* Totalizador de pendências com alerta visual em vermelho.
* **Demonstrativo do Resultado do Exercício (DRE):**
  * Aba integrada apresentando a estrutura contábil analítica da empresa:
    * (+) Receita Bruta Operacional (Serviços + Revenda de Produtos)
    * (-) Comissões e Repasses aos Barbeiros
    * (=) Receita Líquida Operacional
    * (-) Despesas Variáveis e Insumos
    * (=) Margem de Contribuição
    * (-) Despesas Fixas e Administrativas (Aluguel, Luz, Água, Software)
    * (=) Resultado Operacional Líquido (EBITDA / Lucro Líquido)

---

### 3.2 Módulo de Projeção Inteligente e IA Estratégica por Profissional
* **URL:** `https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Proje%C3%A7%C3%A3o+inteligente&tela=cheia`
* **Comparativo por Profissional Interativo:**
  * A tabela de profissionais exibe: Realizado, Projeção do Mês, Variação %, Meta e Tendência.
  * O nome de cada profissional agora é clicável com efeito hover e badge indicativo.
* **Motor de Diagnóstico com Inteligência Artificial:**
  * Função de backend: `analisarProfissionalProjecao(empresaId, profissionalId, opcoes)`.
  * Endpoint REST: `POST /api/admin/barbearia/projecao-faturamento/analise-profissional`.
  * A IA analisa múltiplos fatores determinísticos:
    * Ritmo diário de faturamento e sazonalidade histórica (Avec + Kytto).
    * Oscilação no ticket médio em relação aos meses anteriores.
    * Taxa de ocupação da agenda e aproveitamento de horários nobres.
    * Penetração de serviços de alto valor (barba, barboterapia, selagem, prótese) vs serviços de rotina.
* **Plano de Ação Tático e Editável:**
  * O modal exibe um plano de ação estruturado com 3 pilares: (1) Ocupação e Horários Vagos, (2) Elevação do Ticket Médio / Cross-sell, (3) Retenção e Campanhas de Retorno.
  * O gestor pode ajustar o texto, adicionar metas específicas e clicar em *"Salvar nas Metas do Profissional"*, persistindo a diretriz no cadastro do barbeiro.

---

### 3.3 Módulo de Metas, Comissões e Bonificações Escalonadas
* **URL:** `https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+e+comiss%C3%B5es`
* **Configuração de Faixas no Cadastro do Barbeiro:**
  * Modal do profissional com editor dinâmico de metas e comissões.
  * Suporte a faixas de escalonamento independentes para **Serviços** e **Produtos**:
    * **Serviços (Exemplo Naty):**
      * Base: 40% de comissão.
      * Faixa 1 (ex.: R$ 8.000): 40% + 5% = 45%.
      * Faixa 2 (ex.: R$ 12.000): 40% + 7% = 47%.
      * Faixa 3 (ex.: R$ 16.000): 40% + 10% = 50%.
    * **Produtos (Revenda Separada):**
      * Base: 10% de comissão.
      * Metas e bônus próprios (ex.: 15% acima de R$ 1.500; 20% acima de R$ 3.000).
* **Acompanhamento de Metas em Tempo Real:**
  * Barra de progresso com cálculo imediato do faturamento acumulado, percentual atual e aviso claro:
    * *"Faturou R$ 18.000 em serviços, atingiu a 2ª faixa (47%) e faltam R$ 2.000 para a próxima bonificação (50%)."*
* **6 Relatórios Analíticos Conciliados:**
  1. *Faturamento Bruto Total:* Separação nítida entre receitas de serviços e vendas de produtos.
  2. *Serviços por Categoria:* Quantidades, valor médio e total por corte, barba, selagem, etc.
  3. *Pacotes & Planos:* Assinaturas vendidas pelo profissional, pacotes ativos e receita gerada.
  4. *Serviços Extras & Clientes:* Procedimentos complementares (hidratação, sobrancelha, pigmentação) com listagem nominal dos clientes que realizaram.
  5. *Venda de Produtos:* Quantidades, valor unitário e total por item de revenda.
  6. *Extrato Cronológico:* Linha do tempo de atendimentos, repasses e comissões apuradas.
* **Filtros de Período Flexíveis:**
  * Hoje (Dia), Esta Semana, Esta Quinzena, Este Mês e Todo o Histórico Completo.

---

### 3.4 Módulo de Conexão WhatsApp: Desconexão e Troca de Número
* **URL:** `https://kytto.com.br/admin/whatsapp`
* **Problema Resolvido:** Erro *"Backend não confirmou a desconexão"* que travava a interface ao tentar trocar o chip/número pareado.
* **Solução Técnica Implementada:**
  * Rota: `POST /api/webhooks/whatsapp/desconectar`.
  * Suporte a desconexão forçada (`forcar: true`) mesmo que o gateway externo esteja em timeout ou desconectado.
  * Limpeza de tokens de autenticação órfãos, arquivos de QR code antigos e reset do estado interno para `disconnected`.
  * Modal no frontend com opção de *"Desconexão Imediata (Forçar Reset)"*, liberando instantaneamente a geração de um novo QR Code para leitura pelo novo aparelho.

---

### 3.5 Módulo Agenda VIP 24x7 do Dino e Padrão de Comportamento
* **Disponibilidade 24x7 Full de Dino (`Guilherme Cunha Martins`):**
  * O profissional não é limitado pelo horário de funcionamento comercial da loja nem por feriados.
  * O cadastro no ERP possui a flag `atendimento24x7: true`, permitindo agendamentos VIP noturnos e de madrugada.
* **Tarifação Automática por Faixa Horária:**
  * **06h00 às 18h09 (Horário Diurno):** Corte com Dino a **R$ 300,00**.
  * **18h09 às 06h00 (Horário Extra Noturno / Madrugada VIP):** Corte com Dino a **R$ 600,00**.
  * Implementação em `calcularPrecoServicoHorario` e `ehHorarioExtraDino` em `app/barbearia-erp-kytto.js`.
* **Aprendizado Contínuo com o Padrão do Cliente (`padraoCliente`):**
  * A função `perfilDoTelefone` analisa o histórico completo e extrai:
    * Barbeiro de preferência do cliente.
    * Período habitual de frequência (manhã, tarde, noite ou madrugada).
    * Serviços e procedimentos mais realizados.
  * Essas informações são injetadas no contexto da IA para recomendações altamente assertivas e personalizadas.

---

### 3.6 Módulo de Atendimento Conversacional: Alerta Humanizado e 6 Novas Ações
* **Alerta Prévio e Humanizado de Preços:**
  * A IA informa com gentileza e transparência o valor do serviço e as condições de horário extra antes de fechar o agendamento, garantindo que o cliente se sinta bem acolhido e seguro.
* **6 Novas Ações Autônomas da IA no WhatsApp:**
  1. `consultar_historico_visitas`: Responde sobre visitas passadas, datas, procedimentos, barbeiros e valores pagos.
  2. `consultar_codigo_indicacao`: Entrega o código exclusivo do cliente e link do programa Member-Get-Member (Indique um Amigo) com vantagens mútuas de 50 pontos.
  3. `agendar_lembrete_retorno`: Programa lembretes de retorno para corte/barba na data ou intervalo pedido pelo cliente (ex.: 15, 20 ou 30 dias).
  4. `registrar_feedback_atendimento`: Registra notas (1 a 5 estrelas) e elogios/sugestões diretamente na ficha do cliente e na gestão.
  5. `consultar_agenda_dino_vip`: Consulta e filtra os horários de plantão VIP 24x7 do Dino por período (noite, madrugada, manhã, tarde).
  6. `consultar_beneficios_e_clube`: Visão 360° em mensagem única sobre saldo do Clube/Pacote, cashback acumulado e pontos de fidelidade.

---

## 4. Padrões de Integração e Armazenamento Seguro

### 4.1 Sincronização por Evento Interno (`Internal Event-Driven Synchronization`)
Em conformidade com as diretrizes de integração entre subsistemas da Kytto (incluindo conectores com Ultra e Nossa Gente):
* As mutações de dados (criação de agendamentos, lançamentos de comandas, pagamentos de despesas e alterações de cadastro) emitem **eventos de domínio internos**.
* A persistência local emite eventos síncronos na fila de integração (`tarefas_integracao_canais`), garantindo idempotência e desacoplamento operacional.
* Caso um canal externo enfrente instabilidade, a sincronização interna não é bloqueada; o estado canônico reside no banco de dados da aplicação com reprocessamento resiliente por eventos.

### 4.2 Armazenamento Seguro de Cópias de Imagens e Dados
* O sistema possui permissão e rotinas estruturadas para cache e custódia segura de comprovantes, notas de despesa recebidas via WhatsApp e recibos digitalizados.
* As mídias recebidas são persistidas em diretório segregado por empresa e hash SHA-256 de conteúdo, evitando duplicidade e assegurando conformidade com requisitos fiscais e de auditoria.

---

## 5. Matriz de Endpoints e Contratos REST de Produção

| Método | Endpoint | Parâmetros Principais | Resposta Esperada |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/barbearia/financeiro/resumo` | `empresaId` | KPIs: realizado, a receber, a pagar, margem %, vencidos |
| `POST` | `/api/admin/barbearia/financeiro/liquidar-lote` | `{ ids: [...] }` | `{ ok: true, liquidadas: N, valorTotal: ... }` |
| `GET` | `/api/admin/barbearia/financeiro/dre` | `empresaId`, `ano`, `mes` | DRE consolidado com receitas, comissões, fixos e EBITDA |
| `POST` | `/api/admin/barbearia/projecao-faturamento/analise-profissional` | `{ profissionalId, mes, ano }` | Diagnóstico de tendência, oscilação de ticket e plano de ação |
| `GET` | `/api/admin/barbearia/relatorio-individual` | `profissionalId`, `periodoTipo` | 6 relatórios completos (faturamento, categorias, pacotes, extras, produtos, extrato) |
| `POST` | `/api/admin/barbearia/profissionais/:id/metas-escalonadas` | `{ comissaoBase, faixasServicos, faixasProdutos }` | Cadastro salvo com faixas de bonificação progressiva |
| `POST` | `/api/webhooks/whatsapp/desconectar` | `{ forcar: true }` | Limpeza de sessão, cancelamento de QR órfão e reset do backend |
| `GET` | `/health` | — | HTTP 200 Ready (`setpoint.kytto.com.br`) |

---

## 6. Evidências de Qualidade e Homologação Técnica

### 6.1 Resultados dos Testes Automatizados no Backend
Execução via Node.js Test Runner:
```bash
node --test --test-concurrency=1 app/core/whatsapp-ai-tools.test.js app/core/whatsapp-trex.test.js app/core/whatsapp-ai-persona.test.js app/barbearia-erp-kytto.test.js app/dino-captacao-kytto.test.js app/barbearia-relatorio-individual-kytto.test.js
```
* **Total de Testes:** 105 testes de backend executados.
* **Passando com Sucesso:** 105 (100%).
* **Falhas / Erros:** 0.

### 6.2 Resultados do Build de Produção do Frontend
Execução via Vite no ambiente web:
```bash
cd web && npm run build
```
* **Status:** ✓ Built in 9.32s sem erros de transpilação.
* **Telas Validadas:**
  * `FinanceiroEmpresa.jsx` (KPIs interativos, liquidação em lote e DRE).
  * `ProjecaoFaturamentoPanel.jsx` (Comparativo por profissional e IA estratégica).
  * `MetasComissoesPanel.jsx` (Gestão de bonificação escalonada e 6 relatórios analíticos).
  * `WhatsappConexao.jsx` (Desconexão assistida e pareamento resiliente).

---

## 7. Guia Operacional para a Barbearia Dino (Passo a Passo)

### 7.1 Como Ajustar Metas e Bonificações da Naty, Bruno ou Novos Barbeiros
1. Acesse o ERP em `https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Profissionais`.
2. Clique no botão de edição ao lado do nome do profissional (ex.: Natani).
3. Na seção **Metas e Bonificações Escalonadas**, confirme a comissão base de serviços (ex.: 40%) e a base de produtos (ex.: 10%).
4. Adicione as faixas de faturamento desejadas (ex.: ao atingir R$ 8.000, +5%; ao atingir R$ 12.000, +7%; ao atingir R$ 16.000, +10%).
5. Clique em **Salvar Profissional**. O sistema passará a calcular o escalonamento em tempo real em todas as comandas e repasses.

### 7.2 Como Visualizar os Relatórios Individuais de Produtividade
1. Acesse a aba **Metas e Comissões** (`tab=Metas+e+comiss%C3%B5es`).
2. No menu suspenso superior, selecione o profissional desejado (ou veja o consolidado da equipe).
3. Selecione o período de análise: *Hoje, Semana, Quinzena, Mês* ou *Todo o Histórico*.
4. Alterne entre as 6 abas para conferir: Faturamento Total, Serviços por Categoria, Pacotes & Planos, Serviços Extras (com nomes de clientes), Venda de Produtos ou Extrato Cronológico.

### 7.3 Como Usar a Análise por IA na Projeção Inteligente
1. Acesse **Projeção Inteligente** (`tab=Proje%C3%A7%C3%A3o+inteligente`).
2. Na tabela *Comparativo por Profissional*, clique sobre o nome de qualquer barbeiro.
3. O modal de IA exibirá o diagnóstico aprofundado dos motivos da evolução ou queda e sugerirá um plano de ação tático.
4. Revise as diretrizes sugeridas e clique em **Salvar nas Metas do Profissional** para oficializar o direcionamento para aquele mês.

### 7.4 Como Agendar Atendimentos VIP com Dino (24x7)
* Durante o dia (06h00 às 18h09), os agendamentos seguem o valor padrão de R$ 300,00.
* No período noturno ou de madrugada (após 18h09 até 06h00), a agenda aceita os encaixes de forma irrestrita e o sistema aplica automaticamente a tarifa de horário extra noturno VIP de R$ 600,00, informando o cliente com clareza e empatia no WhatsApp.

---

## 8. Conclusão e Termo de Homologação

O sistema Kytto encontra-se plenamente alinhado às demandas operacionais, fiscais, analíticas e de atendimento da Barbearia Dino. Todas as alterações descritas foram validadas em ambiente sandbox idêntico ao de produção, integradas via Git com histórico rastreável e publicadas com sucesso na nuvem Render, operando com estabilidade e disponibilidade comprovadas por health check contínuo.

**Homologado e Entregue em Produção (PRD).**
