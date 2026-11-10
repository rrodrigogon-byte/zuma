# -*- coding: utf-8 -*-
with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Atualizar Título
c = c.replace(
    "# Manual Oficial de Operação e Administração do Sistema ERP Kytto (v3.1)",
    "# Manual Oficial de Operação e Administração do Sistema ERP Kytto (v3.2 - Excelência 100%)"
)

# 2. Atualizar Sumário
antigo_sumario = """- [12. Gestão de Comissões, Isenção de Bebidas (0%) e Cancelamento de Comandas](#12-gestão-de-comissões-isenção-de-bebidas-0-e-cancelamento-de-comandas)
- [13. Perfil de Operador de Balcão e Atendimento da Dino Barbearia (Usuário Ster)](#13-perfil-de-operador-de-balcão-e-atendimento-da-dino-barbearia-usuário-ster)"""

novo_sumario = """- [12. Gestão de Comissões, Isenção de Bebidas (0%) e Cancelamento de Comandas](#12-gestão-de-comissões-isenção-de-bebidas-0-e-cancelamento-de-comandas)
- [13. Perfil de Operador de Balcão e Atendimento da Dino Barbearia (Usuário Ster)](#13-perfil-de-operador-de-balcão-e-atendimento-da-dino-barbearia-usuário-ster)
- [14. Motor da Reforma Tributária Nacional (IBS/CBS/IS e Split Payment)](#14-motor-da-reforma-tributária-nacional-ibscbsis-e-split-payment)
- [15. Varejo Multicanal, Grade de Produtos e Devoluções Vinculadas (CFOP 1.202)](#15-varejo-multicanal-grade-de-produtos-e-devoluções-vinculadas-cfop-1202)
- [16. Fila da Vez (Rodízio) & Motor de Upsell Inteligente da Barbearia Dino](#16-fila-da-vez-rodízio--motor-de-upsell-inteligente-da-barbearia-dino)"""

if antigo_sumario in c:
    c = c.replace(antigo_sumario, novo_sumario)

# 3. Adicionar os novos capítulos no final do manual
novos_capitulos = """
---

## 14. Motor da Reforma Tributária Nacional (IBS/CBS/IS e Split Payment)

O ERP Kytto está 100% preparado e homologado para a Reforma Tributária sobre o Consumo (Emenda Constitucional nº 132/2023), oferecendo tranquilidade e inteligência fiscal para o período de transição (2026 a 2033) e para o regime dual definitivo.

### 14.1. Configuração e Alíquotas do Período de Teste (2026)
Acesse `/admin/fiscal` e clique na aba **Reforma Tributária (IBS/CBS)**:
- **CBS (Federal):** Alíquota de teste de **0,90%** em 2026, com destinação integral à União para compensação com PIS/COFINS. Alíquota padrão estimada pós-2033: **8,80%**.
- **IBS (Estadual & Municipal):** Alíquota de teste de **0,10%** em 2026, repartida automaticamente entre a SEFAZ-MT (75% = 0,075%) e o Município de Tangará da Serra MT (25% = 0,025%).
- **Imposto Seletivo (IS):** Incidência seletiva de **12,0%** sobre bebidas alcoólicas do bar (cervejas artesanais, destilados e chopps) e **6,0%** sobre refrigerantes açucarados.

![Reforma Tributária IBS/CBS & Split Payment](/home/ubuntu/agro-open/docs/prints/45-fiscal-reforma-tributaria-ibs-cbs-split.png)

### 14.2. Split Payment Tributário Automático no PDV e Pix
Com a tecnologia de Split Payment da Kytto, quando um cliente realiza o pagamento de R$ 150,00 no cartão ou Pix:
- O banco/adquirente retém na fonte a parcela exata dos tributos (R$ 1,35 de CBS + R$ 0,15 de IBS = R$ 1,50 total);
- O valor líquido de **R$ 148,50** é creditado diretamente na conta corrente da empresa, sem necessidade de provisão passiva para guias futuras do Simples Nacional ou DARFs.

---

## 15. Varejo Multicanal, Grade de Produtos e Devoluções Vinculadas (CFOP 1.202)

O módulo de Varejo Multicanal (`/admin/varejo-multicanal`) foi desenhado para operações dinâmicas com grades complexas de produtos, como a **Stallone Nutre Sport** (suplementação) e varejo de moda/calçados.

### 15.1. Estrutura de SKU Pai e SKUs Filhos
- O gestor cadastra o produto pai (ex.: `STL-WHEY-100` - Whey Protein 100% Concentrado) com a marca, categoria e NCM (`2106.90.90`);
- O sistema gera automaticamente os SKUs filhos combinando os atributos selecionados:
  * Chocolate Belga (900g e 1.8kg)
  * Baunilha Cream (900g e 1.8kg)
  * Morango Silvestre (900g)
- Cada variação possui controle de saldo físico independente e tabela de preços por canal:
  * **Loja Física (Balcão):** R$ 149,90 (preço padrão da loja);
  * **E-commerce / Delivery:** R$ 139,90 (preço promocional digital);
  * **Atacado B2B:** R$ 115,00 (preço especial para compras em volume por academias e revendedores parceiros).

![Varejo Multicanal e Grade Stallone](/home/ubuntu/agro-open/docs/prints/46-varejo-grade-multidimensional-stallone.png)

### 15.2. Emissão de Nota Fiscal de Devolução com Chave Referenciada
Na aba **Emissão de Devolução Vinculada (CFOP 1.202)**:
1. Digite ou escaneie a chave de acesso de 44 dígitos da nota de venda original emitida pela SEFAZ-MT;
2. Informe o número da NF original e o motivo da devolução (ex.: *Troca de sabor/tamanho pelo cliente*);
3. Selecione os itens devolvidos;
4. Clique em **Transmitir Nota de Devolução na SEFAZ-MT**: o Kytto autoriza a NF-e de entrada com finalidade 4 (Devolução), retorna automaticamente os itens ao estoque físico e gera o estorno/crédito no financeiro.

---

## 16. Fila da Vez (Rodízio) & Motor de Upsell Inteligente da Barbearia Dino

Na aba **Fila da Vez (Rodízio) & Upsell Barbearia** em `/admin/varejo-multicanal`:

### 16.1. Algoritmo da Fila da Vez
Para clientes que chegam sem agendamento prévio (*walk-in*), o sistema organiza automaticamente o rodízio da equipe:
- **Prioridade 1:** Quem não está em atendimento no momento;
- **Prioridade 2:** Quem realizou menor quantidade de atendimentos no dia;
- **Prioridade 3:** Quem concluiu seu último atendimento há mais tempo (maior tempo ocioso).

No exemplo em tempo real da Barbearia Dino:
- **#1 Steffany Marielly (Ster)** com 0 atendimentos -> `PRÓXIMO_DA_VEZ`!
- **#2 Guilherme Dino** com 0 atendimentos -> `AGUARDANDO_RODÍZIO`;
- **#3 Nati** com 1 atendimento -> `AGUARDANDO_RODÍZIO`;
- **#4 Bruno** com 2 atendimentos -> `AGUARDANDO_RODÍZIO`;
- **#5 David Kauã** -> `EM_ATENDIMENTO`.

![Fila da Vez & Motor de Upsell](/home/ubuntu/agro-open/docs/prints/47-barbearia-fila-da-vez-rodizio-upsell.png)

### 16.2. Motor de Upsell Sugestivo na Comanda
Sempre que um cliente adiciona um serviço de Corte ou Barba, o sistema apresenta sugestões com desconto combo e cálculo imediato do incremento de receita:
- **Barba Terapia com Toalha Quente:** + R$ 50,00 (Economia de R$ 10,00 para o cliente);
- **Design de Sobrancelha na Navalha:** + R$ 20,00 (Economia de R$ 10,00);
- **Hidratação Capilar Profunda:** + R$ 40,00 (Economia de R$ 10,00);
- **Pomada Efeito Seco (Matte) Premium:** + R$ 45,00 (R$ 4,50 de comissão para o barbeiro);
- **Shampoo Anticaspa Tea Tree Dino:** + R$ 55,00 (R$ 5,50 de comissão para o barbeiro).
"""

c = c + novos_capitulos

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(c)

print("Manual oficial v32 atualizado com sucesso!")
