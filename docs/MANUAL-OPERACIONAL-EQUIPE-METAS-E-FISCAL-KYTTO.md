# Manual Operacional e Administrativo — Kytto & Barbearia Dino
**Gestão de Equipe, Horários, Metas, Comissões, Atendimento IA, Financeiro e Central Fiscal**  
*Versão 2.0 — Outubro/2026 — Plataforma Kytto SetPoint Ultra*

---

## 1. Visão Geral da Plataforma

O sistema Kytto foi arquitetado para integrar toda a operação da Barbearia Dino em uma única plataforma em tempo real. As regras configuradas na gestão de profissionais (horários, dias de trabalho, comissões e serviços executados) alimentam imediatamente:
1. **A Agenda Operacional do Balcão e PDV**, evitando conflitos e agendamentos fora do expediente.
2. **O Assistente Inteligente de Atendimento no WhatsApp (T-Rex / Dino)**, que consulta horários livres, aplica tabelas de preços corretas e alerta valores com transparência e humanização.
3. **O Motor de Comissões e Repasses**, apurando os valores devidos a cada barbeiro de acordo com suas metas individuais e faixas de bonificação progressiva.
4. **A Central Fiscal Corporativa**, permitindo emitir NFC-e e NFS-e com 1 clique a partir das comandas pagas.

---

## 2. Gestão de Profissionais da Equipe

### 2.1 Como Acessar a Tela de Profissionais
Para gerenciar os profissionais da barbearia, acesse o menu lateral:
* **Caminho:** `Gestão Barbearia ERP` ➔ Aba `Catálogo e equipe` ➔ Sub-aba `Profissionais`.
* **Link Direto:** [https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Profissionais](https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Profissionais)

Nesta tela, cada profissional da equipe é representado por um card com sua foto, nome, especialidade, comissão padrão, jornada de trabalho e os dias da semana em que atende.

---

### 2.2 Como Ajustar o Horário e Dias de Atendimento de Cada Profissional

Cada profissional pode ter uma jornada de trabalho independente, adaptada à sua rotina e aos acordos comerciais da unidade.

#### Passo a Passo para Alterar o Horário:
1. Localize o card do profissional desejado e clique no botão **"Editar"**.
2. No modal que se abrirá, localize os campos de jornada:
   * **Início:** Horário em que o profissional começa os atendimentos (exemplo: `08:00`, `09:00` ou `10:00`).
   * **Fim:** Horário de encerramento dos atendimentos (exemplo: `18:00`, `19:00` ou `20:00`).
   * **Dias de Atendimento:** Logo abaixo, há os botões circulares para cada dia da semana (`D`, `S`, `T`, `Q`, `Q`, `S`, `S`). Clique sobre os dias para ativar (destacado na cor do sistema) ou desativar os dias de folga do barbeiro.
3. **Disponibilidade Full 24x7 (Plantão VIP / Dino):**
   * Se o profissional atender em regime de plantão ou 24 horas contínuas (como o fundador Dino), marque a opção **"Disponibilidade 24x7 (Dino / Plantão VIP)"**.
   * Ao marcar essa opção, os horários são ajustados automaticamente para `00:00` às `23:59` em todos os 7 dias da semana.
   * Para atendimentos de Dino agendados em horários extras (após as 18h09 até as 06h00 da manhã), o sistema aplica automaticamente a tarifa especial de **R$ 600,00** para o corte, avisando o cliente com clareza e cortesia pelo WhatsApp.
4. Clique em **"Salvar profissional"**.
5. **Resultado Imediato:** Tanto a agenda do sistema quanto o robô do WhatsApp passam a oferecer somente os horários dentro da nova grade cadastrada.

---

### 2.3 Como Desativar ou Excluir Profissionais que Saíram da Equipe

Quando um barbeiro se afasta temporariamente ou sai definitivamente da empresa, o gestor dispõe de duas ações seguras no próprio card do profissional:

#### Opção A: Desativar (Afastamento Temporário / Férias)
* **Quando Usar:** Ideal para quando o profissional vai entrar de férias, tirar licença ou se afastar por algumas semanas, mas retornará no futuro.
* **Como Fazer:** No card do profissional, clique no botão **"Desativar"**.
* **Efeito:** O profissional continua visível no painel administrativo com uma leve transparência visual, mas é imediatamente removido das opções de novos agendamentos da agenda online, do PDV e do WhatsApp IA.
* **Reativação:** Quando o profissional voltar, basta clicar no mesmo botão, que agora exibirá **"Reativar"**, e ele voltará imediatamente à ativa.

#### Opção B: Excluir (Saída Definitiva da Equipe)
* **Quando Usar:** Quando o profissional se desligou da empresa e não fará mais parte da equipe.
* **Como Fazer:** No card do profissional, clique no botão vermelho **"Excluir"**.
* **Confirmação de Segurança:** Uma janela de confirmação informará que o cadastro será retirado das listas ativas e das novas operações, preservando todo o histórico financeiro. Clique em **"OK"** para confirmar.
* **Garantia de Integridade Contábil (Exclusão Lógica):** 
  * O sistema **NUNCA** apaga os registros históricos. Todas as comandas antigas, atendimentos realizados, histórico de repasses, registros importados do Avec e relatórios contábeis passados continuam 100% íntegros.
  * O nome do profissional continua aparecendo nas auditorias e livros contábeis das datas em que ele trabalhou.
* **Recuperação e Restauração:** No rodapé da tela de Profissionais, existe a seção retrátil **"Excluídos"**. Se você precisar reativar um profissional excluído por engano ou readmiti-lo, basta abrir essa seção e clicar em **"Restaurar"**.

---

## 3. Gestão de Metas, Comissões e Bonificações Progressivas

### 3.1 Painel Central de Metas e Relatórios Individuais
Acesse pelo menu:
* **Caminho:** `Gestão Barbearia ERP` ➔ Aba `Gestão` ➔ Sub-aba `Metas e comissões`.
* **Link Direto:** [https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+e+comissões](https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+e+comissões)

### 3.2 Como Configurar Faixas de Bonificação por Faturamento
O sistema permite cadastrar comissões escalonadas que aumentam automaticamente conforme o barbeiro atinge metas de vendas, separando rigorosamente serviços de produtos:

1. Na tela de **Metas e comissões**, selecione o profissional no menu superior ou clique no botão **"Cadastrar Metas"**.
2. **Metas de Serviços:**
   * Defina a **Comissão Base de Serviços** (exemplo: `40%`).
   * Adicione as faixas de bonificação por faturamento bruto de serviços:
     * *Meta 1:* Ao atingir `R$ 10.000,00` ➔ Comissão sobe para `45%` (+5%).
     * *Meta 2:* Ao atingir `R$ 15.000,00` ➔ Comissão sobe para `47%` (+7%).
     * *Meta 3:* Ao atingir `R$ 20.000,00` ➔ Comissão sobe para `50%` (+10%).
3. **Metas de Venda de Produtos (Revenda):**
   * Defina a **Comissão Base de Produtos** (exemplo: `10%` ou `30%`).
   * Adicione as faixas específicas de produtos (exemplo: ao atingir `R$ 3.000,00` em vendas de pomadas e óleos, a comissão sobe para `15%`).
4. Clique em **"Salvar metas do profissional"**.

### 3.3 Acompanhamento em Tempo Real e Relatórios Analíticos
Ao selecionar um barbeiro e um período (Hoje, 7 Dias, 15 Dias, Este Mês, Mês Anterior, Este Ano ou Todo o Histórico), o sistema calcula instantaneamente:
* **Ritmo de Metas em Tempo Real:** Exibe o faturamento atual do barbeiro, a comissão vigente e quanto falta em Reais (R$) para alcançar o próximo degrau de bonificação.
* **Relatório 1 — Faturamento Bruto Total:** Gráficos e cards separando faturamento de serviços, produtos de revenda e repasse líquido estimado.
* **Relatório 2 — Serviços por Categoria:** Quantidade e receita discriminadas por categoria real (Corte, Barba, Prótese, Selagem, etc.).
* **Relatório 3 — Pacotes e Planos:** Vendas de assinaturas e planos do clube efetuadas pelo profissional.
* **Relatório 4 — Serviços Extras e Clientes:** Procedimentos especiais realizados (hidratação, pigmentação, sobrancelha) com a lista dos clientes atendidos.
* **Relatório 5 — Venda de Produtos:** Itens físicos vendidos no balcão com ticket médio e faturamento bruto.
* **Relatório 6 — Extrato Cronológico:** Linha do tempo auditável com todos os lançamentos do período.

---

## 4. Agendamento Inteligente e Atendimento via WhatsApp (IA)

O assistente no WhatsApp opera 24 horas por dia integrado à base de dados da barbearia:
1. **Respeito aos Horários de Cada Barbeiro:** Se um barbeiro trabalha das 09h às 18h de terça a sábado, o assistente jamais oferecerá horários na segunda-feira ou às 19h para ele.
2. **Transparência e Humanização de Preços:** Sempre que o cliente perguntar de preços ou agendar um serviço, a IA informa o valor com clareza, empatia e sem termos robóticos (ex.: *"O corte masculino com a Naty fica R$ 60,00 e já inclui lavagem e finalização. Qual horário fica melhor para você?"*).
3. **Aprendizado com o Padrão do Cliente:** Ao receber uma mensagem, a IA reconhece o histórico do cliente, seu barbeiro habitual e os serviços que ele costuma fazer, oferecendo agendamento ágil e personalizado.
4. **Alerta de Horário Extra do Dino:** Se um cliente solicitar atendimento com o Dino fora do expediente padrão (entre 18h09 e 06h00), a IA avisa educadamente: *"O Dino tem disponibilidade exclusiva para atendimento noturno/madrugada (24x7). Para esse horário especial, o corte tem o valor de R$ 600,00. Deseja confirmar para esse horário?"*.

---

## 5. Módulo Financeiro e DRE Gerencial

Acesse pelo menu:
* **Caminho:** `Gestão Barbearia ERP` ➔ Aba `Gestão` ➔ Sub-aba `Financeiro`.
* **Link Direto:** [https://kytto.com.br/admin/financeiro](https://kytto.com.br/admin/financeiro)

### Principais Recursos Financeiros:
* **Barra de Filtros por Período:** Botões de 1 clique para navegar entre *Hoje*, *7 Dias*, *15 Dias*, *Este Mês*, *Mês Anterior*, *Este Ano*, *Todo o Histórico* e seletor livre com data inicial e final.
* **Cards de Indicadores Contextuais:**
  * *Saldo Realizado:* Total de receitas recebidas menos despesas já pagas.
  * *A Receber:* Comandas em aberto ou agendamentos com pagamento pendente.
  * *A Pagar:* Despesas operacionais e contas a pagar cadastradas.
  * *Resultado do Mês / Margem %:* Lucro operacional do período apurado.
* **DRE Gerencial Automatizado:** Demonstração do Resultado do Exercício com Receita Bruta, Deduções, Custos de Mercadorias e Despesas Fixas.
* **Liquidação em Lote de Despesas Antigas:** Se houver despesas legadas vencidas, basta clicar no card de vencidos e no botão **"Liquidar todos os vencidos"** para baixá-las de uma só vez com registro de auditoria.

---

## 6. Central Fiscal Corporativa (NFC-e, NF-e, NFS-e)

Acesse pelo menu:
* **Caminho Integrado no ERP:** `Gestão Barbearia ERP` ➔ Aba `Gestão` ➔ Sub-aba `Notas fiscais`.
* **Link Direto:** [https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Notas+fiscais](https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Notas+fiscais)
* **Link da Central Autônoma:** [https://kytto.com.br/admin/notas](https://kytto.com.br/admin/notas)

### Como Emitir Notas das Comandas da Barbearia:
1. Acesse a aba **"Documentos"** na Central Fiscal.
2. Na seção **"Vendas pagas sem nota"**, o sistema lista automaticamente todas as comandas concluídas da barbearia.
3. Para emitir a nota fiscal, clique em **"Emitir NFC-e"** (para mercadorias/produtos) ou clique em **"+ NFS-e de serviço"** (para cortes e procedimentos).
4. O motor fiscal gera o XML 4.00, assina com o Certificado Digital A1 da empresa e transmite à SEFAZ ou Sefin.
5. Após autorizada, utilize as ações na tabela de documentos:
   * **Imprimir DANFE:** Gera o cupom térmico padrão 80mm com QR Code de consulta ou a folha A4 completa.
   * **XML:** Baixa o arquivo XML autenticado para envio à contabilidade.
   * **Contingência Offline:** Caso a SEFAZ fique instável, a nota pode ser emitida em contingência offline (`tpEmis = 9`) e transmitida posteriormente em até 24 horas.

---

## 7. Tabela Resumo de Links Rápidos do Sistema

| Funcionalidade | Descrição | Link de Acesso Direto |
| :--- | :--- | :--- |
| **Equipe e Horários** | Cadastro, horários, dias de trabalho e desativação | [Ver Profissionais](https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Profissionais) |
| **Metas e Comissões** | Regras progressivas, bonificações e relatórios | [Ver Metas e Comissões](https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+e+comissões) |
| **Agenda do Balcão** | Visão diária, horários ocupados e agendamentos | [Ver Agenda](https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Agenda) |
| **Atendimento WhatsApp** | Status da conexão, QR Code e inteligência artificial | [Ver Conexão WhatsApp](https://kytto.com.br/admin/whatsapp) |
| **Financeiro e DRE** | Fluxo de caixa, saldo realizado e contas | [Ver Financeiro](https://kytto.com.br/admin/financeiro) |
| **Central Fiscal** | Emissão de NFC-e, NFS-e e DANFE das comandas | [Ver Notas Fiscais](https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Notas+fiscais) |

---
*Documento homologado para a equipe administrativa e operacional da Barbearia Dino & Kytto.*
