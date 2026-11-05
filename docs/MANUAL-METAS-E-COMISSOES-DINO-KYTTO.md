# Manual Operacional: Gestão de Metas e Bonificações Progressivas
## ERP Kytto × Barbearia Dino

**Versão do Documento:** 2.0.0  
**Data de Emissão:** 05 de Novembro de 2026  
**Ambiente:** Produção Oficial (`kytto.com.br` / `setpoint.kytto.com.br`)  
**Autor:** Engenharia de Sistemas ERP Kytto  

---

## 1. Visão Geral & Filosofia de Metas

O sistema **ERP Kytto Barbearia Dino** dispõe de um módulo dedicado de **Metas, Comissões Escalonadas e Bonificações Progressivas Individuais**. Este módulo foi desenvolvido para incentivar a produtividade e a venda ativa de procedimentos extras e produtos de revenda, sem gerar cálculos manuais para a gestão.

### 1.1 Regras Centrais do Modelo de Bonificação
1. **Comissão Base Fixa de Serviços:** Cada profissional possui um percentual contratual de repasse base sobre serviços realizados (exemplo: **40%** para a Nati).
2. **Escala Progressiva por Faixas (Tudo na Mesma Linha):** Conforme o faturamento mensal acumulado do profissional atinge os patamares estipulados, o sistema soma automaticamente percentuais de bônus à comissão base.
3. **Separação Rigorosa de Serviços e Produtos:**
   - **Serviços (Cabelo, Barba, Pigmentação, Selagem, Sobrancelha, etc.):** Seguem a comissão base de serviços + metas de serviços.
   - **Produtos de Revenda (Pomadas, Óleos, Shampoos, Balms, etc.):** Possuem comissão base própria (iniciando em **10%**) e metas separadas com bonificações próprias, garantindo que o faturamento de produtos nunca infle indevidamente as metas de serviços nem vice-versa.
4. **Cálculo e Notificação em Tempo Real:** O profissional acompanha direto do seu celular, no **App do Barbeiro**, quanto já faturou no mês, em qual faixa de comissão está e quantos reais exatos faltam para alcançar a próxima meta e bônus.

---

## 2. Onde Cadastrar as Metas do Mês no ERP (Área da Gestão)

### 2.1 Passo a Passo de Acesso
1. Acesse o ERP Kytto no seu navegador:  
   🔗 **Link Direto:** [https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+e+comiss%C3%B5es](https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+e+comiss%C3%B5es)
2. No menu superior da Barbearia, selecione a área **Gestão**.
3. Clique na aba **Metas e comissões**.
4. Na listagem de profissionais, localize o barbeiro desejado (ex: **Nati**) e clique no botão **"⚙️ Editar Metas"** ou **"Configurar Metas & Comissões"**.

![Tela de Cadastro de Metas do Gestor no ERP](/home/ubuntu/agro-open/docs/prints-metas/01_admin_cadastro_metas_comissoes.png)

### 2.2 Estrutura do Modal de Configuração

Ao abrir o modal de configuração, o gestor define:

#### Seção 1: Comissão e Metas de Serviços (Cabelo, Barba e Extras)
* **Base Fixa (%):** Percentual base de serviços (ex: `40.0%`).
* **Faixas Progressivas na Mesma Linha:**
  * **Meta 1:** Faturamento Alvo: `R$ 15.000,00` | Bônus: `+ 5.0%` *(Efetivo: 45%)*
  * **Meta 2:** Faturamento Alvo: `R$ 20.000,00` | Bônus: `+ 7.0%` *(Efetivo: 47%)*
  * **Meta 3:** Faturamento Alvo: `R$ 26.000,00` | Bônus: `+ 10.0%` *(Efetivo: 50%)*
* Botão **[+ Adicionar Faixa de Meta de Serviços]** caso queira incluir novas faixas.

#### Seção 2: Comissão e Metas de Produtos de Revenda (Separada)
* **Base Fixa de Produtos (%):** Percentual base de produtos (ex: `10.0%`).
* **Faixas de Produtos:**
  * **Meta 1 Prod:** Vendas Alvo: `R$ 1.000,00` | Bônus: `+ 2.0%` *(Efetivo: 12%)*
  * **Meta 2 Prod:** Vendas Alvo: `R$ 2.500,00` | Bônus: `+ 5.0%` *(Efetivo: 15%)*
* Botão **[+ Adicionar Faixa de Meta de Produtos]**.

Ao final, basta clicar no botão azul **[💾 Salvar Metas e Comissões]**. A gravação é imediata e propaga para todo o ecossistema Kytto.

---

## 3. Configuração Oficial da Profissional Nati (Natani Dobler)

As metas solicitadas para a **Nati** já foram implantadas, homologadas e estão ativas em produção:

| Faixa de Meta | Faturamento em Serviços no Mês | Bônus Concedido | Percentual de Repasse Final |
| :--- | :---: | :---: | :---: |
| **Comissão Base** | Abaixo de R$ 15.000,00 | +0% (Base) | **40%** |
| **Meta 1** | **R$ 15.000,00** | **+5%** | **45%** |
| **Meta 2** | **R$ 20.000,00** | **+7%** | **47%** |
| **Meta 3 (Teto)** | **Acima de R$ 26.000,00** | **+10%** | **50%** |

*Obs: Sobre a venda de produtos (pomadas, shampoos, balms), a Nati possui comissão base de 10% com bônus de 2% ao atingir R$ 1.000,00 (12%) e 5% ao atingir R$ 2.500,00 (15%).*

---

## 4. Visualização no Celular pelo Barbeiro (App do Barbeiro)

O profissional da bancada não precisa perguntar à gestão sobre o andamento de suas metas. Ele acompanha tudo diretamente em seu celular.

### 4.1 Acesso do Barbeiro
* **Link:** [https://kytto.com.br/barbeiro](https://kytto.com.br/barbeiro) (ou `/modo-barbeiro`)
* **Login:** E-mail do profissional (ex: `natani@barbeariadino.com.br` ou `nati@barbeariadino.com.br`)
* **Senha Padrão:** `123456`

### 4.2 A Aba "📈 Meta Mês"
No menu de abas do App do Barbeiro, ao tocar em **"📈 Meta Mês"**, a tela exibe:
1. **Régua Visual de Metas na Mesma Linha:**
   - Cards com as Metas 1, 2 e 3 organizados horizontalmente.
   - **Card Verde com Selo "✓ BATIDA":** Identifica a meta já superada.
   - **Card Azul com Selo "PRÓXIMA":** Destaca a meta atual em disputa.
   - **Card Neutro:** Indica faixas superiores ainda futuras.
2. **Card de Repasse Ativo:**
   - Mostra o percentual atual no bolso (ex: **"🔥 +5% BÔNUS ATIVO · 45% de Repasse"**).
3. **Barra de Progresso & Contador em R$:**
   - Informa com precisão matemática:  
     *“Produção em Serviços no Mês: R$ 16.500,00 · Faltam R$ 3.500,00 para a Meta 2 (+7%).”*
4. **Régua Exclusiva de Produtos de Revenda:**
   - Exibida logo abaixo, com as metas específicas de pomadas, óleos e balms.

![App do Barbeiro com Régua de Metas](/home/ubuntu/agro-open/docs/prints-metas/02_app_barbeiro_regua_metas_mensais.png)

---

## 5. Relatórios Individuais do Gestor

O gestor consegue auditar os resultados de cada profissional de 5 maneiras distintas:
1. **Faturamento Bruto Total:** Serviços e Produtos discriminados separadamente.
2. **Relatório de Serviços:** Quantidade e receita de cortes, barbas e procedimentos.
3. **Relatório de Pacotes/Clube:** Quantidade de planos ativos atendidos no mês.
4. **Relatório de Serviços Extras:** Quantidade nominal de hidratações, sobrancelhas e químicas capilares, incluindo nomes dos clientes.
5. **Relatório de Produtos de Revenda:** Itens, quantidades e faturamento bruto de cosméticos vendidos.

---

## 6. Conclusão & Suporte

As melhorias foram compiladas, validadas pela suíte de 43 testes automatizados e estão **100% operacionais em produção** no Render sob os domínios `kytto.com.br` e `setpoint.kytto.com.br`.
