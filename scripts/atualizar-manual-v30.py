with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    texto = f.read()

# Atualizar versão no cabeçalho
texto = texto.replace('Versão do Documento:** 2.9', 'Versão do Documento:** 3.0')
texto = texto.replace('(Edição Homologada de Produção - DIMP Preventivo, Supply Chain RFQ & 3-Way Matching)', '(Edição Homologada de Produção - Cancelamento Coordenado de Comandas & Isenção de Bebidas 0%)')

# Atualizar Sumário
sumario_antigo = '''24. **Supply Chain, Cotação de Fornecedores RFQ e Comparativo CIF vs FOB**
25. **Conferência Cega 3-Way Matching (PO x MD-e x Estoque Físico)**'''

sumario_novo = '''24. **Supply Chain, Cotação de Fornecedores RFQ e Comparativo CIF vs FOB**
25. **Conferência Cega 3-Way Matching (PO x MD-e x Estoque Físico)**
26. **Procedimento de Cancelamento e Estorno Coordenado de Comandas Finalizadas no Caixa**
27. **Regras Oficiais de Comissionamento: Bebidas & Bar (0%) vs. Cosméticos de Revenda (10%)**'''

texto = texto.replace(sumario_antigo, sumario_novo)

# Adicionar novas seções antes da conclusão
secoes_novas = '''---

## 26. PROCEDIMENTO DE CANCELAMENTO E ESTORNO COORDENADO DE COMANDAS FINALIZADAS NO CAIXA

Em operações de alta rotatividade no salão ou barbearia, cancelamentos de comandas já faturadas (com pagamentos parciais ou totais em cartão, dinheiro ou Pix) demandam rigorosa integridade para evitar divergências de caixa, estoque e relatórios de comissões.

### Evidência em Produção: Comanda Finalizada Cancelada e Estornada com Sucesso
![Comandas Fechadas no Caixa e Estorno Coordenado Concluído](/home/ubuntu/agro-open/docs/prints/41-caixa-fechamento-comandas-cancelamento.png)

### Passo a Passo Operacional:
1. **Localização da Comanda:** No menu lateral, acesse **Operação > Caixa e fechamento** (`/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento`). Na seção inferior **Comandas Fechadas no Caixa**, localize a comanda pelo nome do cliente ou número da comanda.
2. **Acionamento do Modal:** Clique no botão vermelho **🚫 Cancelar comanda finalizada**.
3. **Preenchimento da Justificativa Auditada:**
   * Selecione o **Motivo do cancelamento** (ex: *Erro de digitação / valor incorreto*, *Serviço não realizado*, *Troca de meio de pagamento*);
   * Adicione observações detalhadas se necessário;
   * Se a comanda possuir agendamento na agenda de atendimento, marque a opção **"Reabrir horário do agendamento vinculado na agenda operacional"** para disponibilizar o horário novamente;
   * Insira a **Senha de Gerente/Administrador** (opcional para gestores logados).
4. **Confirmação Atômica do Estorno:** Clique em **"Estornando comanda..."**. O sistema executa o estorno coordenado atômico:
   * **Caixa:** Estorno imediato de pagamentos em dinheiro físico;
   * **Financeiro:** Inserção de lançamentos compensatórios de estorno no ledger corporativo;
   * **Estoque:** Estorno de saídas com devolução física de insumos e produtos de revenda ao saldo;
   * **Comissões:** Expurgo integral das comissões creditadas aos profissionais naquela comanda;
   * **Comanda:** A comanda é imediatamente tarjada como `CANCELADA / ESTORNADA` com valor riscado (`~~R$ 205,00~~`), eliminando qualquer impacto indevido no rateio do mês.

---

## 27. REGRAS OFICIAIS DE COMISSIONAMENTO: BEBIDAS & BAR (0%) VS. COSMÉTICOS DE REVENDA (10%)

Por determinação expressa da diretoria e gerência da **Dino Barbearia** (*"Bebidas eles não têm comissão"*), o ERP Kytto opera com segregação nativa entre produtos de revenda cosméticos e itens de consumo de bar/frigobar:

### Evidência em Produção: Tabela de Rateio de Comissões com Isenção de Bebidas
![Rateio de Comissões dos Barbeiros no Caixa com Bebidas Zero](/home/ubuntu/agro-open/docs/prints/42-caixa-rateio-comissoes-bebidas-zero.png)

### Regras de Rateio Aplicadas:
1. **Serviços Operacionais (Cabelo e Barba):**
   * Aplicação do percentual do plano do profissional (ex: 40% a 50% base, sujeito à escala de metas de produtividade).
2. **Produtos de Revenda Cosméticos (Pomadas, Óleos, Shampoos, Balms):**
   * Aplicação da taxa base de produtos configurada no cadastro do profissional (padrão **10%**).
3. **Bebidas & Bar (Água Mineral com e sem gás, Cervejas Long Neck, Refrigerantes, Doses e Cafés):**
   * **Alíquota de Comissão: 0% (Isenção Total).**
   * O valor das bebidas consumidas é computado normalmente no faturamento bruto da comanda e no numerário recebido pelo caixa, porém sua base de cálculo para a equipe é integralmente zerada (**R$ 0,00 de comissão**).
   * No relatório de fechamento do caixa, os itens de bebidas são claramente destacados com a tag explicativa `🍺 R$ 5,00 bebidas (0%)`.

---

## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL'''

texto = texto.replace('--- \n\n## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL', secoes_novas)
texto = texto.replace('---\n\n## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL', secoes_novas)

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(texto)

print('Manual v3.0 atualizado com sucesso!')
