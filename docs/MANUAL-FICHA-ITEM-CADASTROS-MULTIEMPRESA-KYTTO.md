# Manual Operacional: Ficha do Item, Classificação Fiscal Fiel & Saneamento Multiempresa

**Kytto ERP • Barbearia Dino • AGRO OPEN TTC • Stallone Nutre Sport**  
*Data de Homologação:* Novembro de 2026 • *Versão:* 3.4.0 Multiempresa

---

## 1. Visão Geral do Módulo de Cadastros e Itens

O **Kytto ERP** adota o conceito de **Catálogo Único Omnichannel**, no qual cada item (seja ele um produto de revenda, serviço de bancada, plano de assinatura ou insumo de consumo interno) possui uma identidade cadastral centralizada, auditável e vinculada a um SKU exclusivo.

Este manual descreve a operação da **Ficha Técnica do Item** com suas 5 abas especializadas, os critérios de classificação fiscal fiel para o Simples Nacional nos estados de atuação (com destaque para Mato Grosso e São Paulo), a auditoria preventiva de cadastros incompletos e os procedimentos de saneamento do catálogo de demonstração.

![Auditoria de Cadastros Incompletos](/home/ubuntu/agro-open/docs/prints-ficha-item/01_auditoria_cadastros_incompletos.png)

---

## 2. A Ficha Técnica do Item (As 5 Abas Oficiais)

Ao clicar no botão `🔍 Ficha` na listagem de produtos ou no catálogo geral, o sistema abre o modal executivo estruturado em cinco pilares fundamentais:

### 2.1 Aba 1 — Dados Gerais & EAN
Responsável pelo registro da identidade comercial do item:
- **Tipo Obrigatório:** `produto` (mercadoria para revenda/bar), `servico` (procedimento na cadeira), `plano` (pacote/clube VIP) ou `insumo` (uso interno de bancada, não vendável).
- **Nome do Item:** Descrição comercial completa padronizada.
- **SKU:** Código alfanumérico interno único por empresa.
- **Marca e Categoria:** Agrupamento para relatórios gerenciais e relatórios de giro.
- **Unidade Comercial:** `UN`, `KG`, `L`, `CX`, `PC` ou `DOSE`.
- **Código de Barras / GTIN / EAN:** Código numérico de 8, 12, 13 ou 14 dígitos validado pelo algoritmo de dígito verificador GS1 Brasil, permitindo bipagem imediata em leitores ópticos no PDV.

![Ficha do Item - Aba Geral](/home/ubuntu/agro-open/docs/prints-ficha-item/02_ficha_item_aba_geral.png)

---

### 2.2 Aba 2 — Regras Fiscais (NCM, CEST, CFOP e ISS)
Garante a conformidade fiscal com a SEFAZ-MT (NFC-e/NF-e) e com a Sefin Nacional (NFS-e):
- **NCM (Nomenclatura Comum do Mercosul):** 8 dígitos numéricos oficiais da Tabela TIPI da Receita Federal.
- **CEST (Código Especificador da ST):** Código de 7 dígitos obrigatório para produtos sujeitos ao regime de Substituição Tributária (CSOSN 500) conforme o Convênio ICMS 142/2018 (ex.: `20.020.00` para cosméticos e perfumaria; `03.013.00` para bebidas energéticas).
- **Origem da Mercadoria:** Código de 0 a 8 (ex.: `0` para nacional; `1` ou `2` para estrangeira).
- **CFOP Padrão:** `5.405` (venda de mercadoria com ICMS retido por ST) ou `5.102` (venda de mercadoria tributada integralmente).
- **CSOSN:** `500` (ICMS cobrado anteriormente por ST) ou `102` (tributada pelo Simples sem permissão de crédito).
- **PIS / COFINS:** Código `49` (outras operações de saída) ou `04` (alíquota zero monofásica).
- **Para Serviços de Barbearia:** Código de Tributação Nacional (`cTribNac 060101` — Cabelereiro/Barbearia/Estética) e Alíquota de ISS fixada conforme a legislação municipal.

![Ficha do Item - Aba Fiscal](/home/ubuntu/agro-open/docs/prints-ficha-item/03_ficha_item_aba_fiscal.png)

---

### 2.3 Aba 3 — Estoque, Custos & Margem Bruta
Centraliza a gestão financeira e o controle físico do inventário:
- **Saldo Atual:** Quantidade física disponível em prateleira.
- **Estoque Mínimo:** Ponto de reposição calculado pelo giro médio.
- **Bloqueio de Venda Sem Estoque:** Configuração que impede comandas ou vendas no PDV caso o saldo esteja zerado, evitando furos no estoque.
- **Custo Médio Ponderado (CMP):** Atualizado automaticamente a cada entrada por XML de NF-e, servindo de base para o DRE e apuração do Custo das Mercadorias Vendidas (CMV).
- **Preço de Venda Praticado:** Valor final cobrado do cliente.
- **Margem Bruta Unitária (%):** Calculada em tempo real pela fórmula:
  $$\text{Margem Bruta (\%)} = \left(\frac{\text{Preço de Venda} - \text{Custo Médio}}{\text{Preço de Venda}}\right) \times 100$$

![Ficha do Item - Aba Estoque e Custos](/home/ubuntu/agro-open/docs/prints-ficha-item/04_ficha_item_aba_estoque_custo.png)

---

### 2.4 Aba 4 — Canais de Venda (Omnichannel)
Permite configurar em quais frentes de negócio o produto pode ser comercializado:
- **Barbearia Dino (Comandas & Bar Balcão):** Habilita para consumo rápido e inclusão em comandas de atendimento.
- **Loja Virtual & E-commerce:** Habilita visibilidade e venda na vitrine online.
- **PDV Varejo:** Habilita venda direta no caixa e busca por leitor laser.

---

### 2.5 Aba 5 — Histórico & Auditoria (Kardex)
Registra todas as movimentações de entradas por compras, saídas em comandas, acertos de inventário e perdas operacionais, garantindo rastreabilidade contábil completa.

---

## 3. Catálogo Oficial AGRO OPEN TTC Classificado (16 Itens)

A empresa **AGRO OPEN TTC** (CNPJ `48.094.075/0001-38`), enquadrada no Simples Nacional em Mato Grosso, teve seu portfólio oficial de 16 produtos 100% parametrizado e vinculado às NCMs da Tabela TIPI e regras fiscais sem Substituição Tributária em MT:

| SKU | Descrição do Produto | NCM | CFOP | CSOSN | PIS/COFINS | Origem |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **AOT-001** | Camiseta Oficial Agro Open | `6109.10.00` | 5102 | 102 | 49 | 0 |
| **AOT-002** | Boné Oficial Agro Open | `6505.00.90` | 5102 | 102 | 49 | 0 |
| **AOT-003** | Camiseta Premium Monograma AO | `6109.10.00` | 5102 | 102 | 49 | 0 |
| **AOT-004** | Boné Premium Monograma AO | `6505.00.90` | 5102 | 102 | 49 | 0 |
| **AOT-005** | Meias Esportivas Agro Open | `6115.95.00` | 5102 | 102 | 49 | 0 |
| **AOT-006** | Sacola Tote Bag Oficial | `4202.92.00` | 5102 | 102 | 49 | 0 |
| **AOT-007** | Garrafa Squeeze 750ml | `3924.10.00` | 5102 | 102 | 49 | 0 |
| **AOT-008** | Toalhinha de Tênis 50×90cm | `6302.60.00` | 5102 | 102 | 49 | 0 |
| **AOT-009** | Pulseira de Identificação | `3926.90.90` | 5102 | 102 | 49 | 0 |
| **AOT-010** | Munhequeira Oficial (Par) | `6117.80.10` | 5102 | 102 | 49 | 0 |
| **AOT-011** | Bandana Headband Agro Open | `6117.10.00` | 5102 | 102 | 49 | 0 |
| **AOT-012** | Grip / Overgrip Agro Open | `9506.59.00` | 5102 | 102 | 49 | 0 |
| **AOT-013** | Mochila Esportiva Agro Open | `4202.92.00` | 5102 | 102 | 49 | 0 |
| **AOT-014** | Raqueteira Agro Open | `4202.92.00` | 5102 | 102 | 49 | 0 |
| **AOT-015** | Toalha Grande Agro Open | `6302.60.00` | 5102 | 102 | 49 | 0 |
| **AOT-016** | Viseira Agro Open | `6505.00.90` | 5102 | 102 | 49 | 0 |

![Catálogo AGRO OPEN TTC Classificado](/home/ubuntu/agro-open/docs/prints-ficha-item/05_catalogo_agro_open_classificado.png)

---

## 4. Classificação por Grupos da Stallone Nutre Sport (769 Itens)

Para a **Stallone Nutre Sport** (CNPJ `14.829.301/0001-92`), foi implementado o motor de classificação em lote por grupos mercadológicos:

1. **Proteínas e Wheys (Whey Protein, Colágeno, Albumina):** NCM `2106.10.00` (Concentrados de proteínas e substâncias proteicas texturizadas).
2. **Suplementos em Cápsulas, Tabletes e Creatina:** NCM `2106.90.30` (Suplementos alimentares compostos).
3. **Pré-Treinos, Energéticos em Pó e Géis de Carboidrato:** NCM `2106.90.90` (Outras preparações alimentícias).
4. **Bebidas Energéticas e Isotônicos Prontos em Lata:** NCM `2202.99.00` com CEST `03.013.00`.
5. **Acessórios (Coqueteleiras e Squeezes):** NCM `3924.10.00` (Artefatos de uso doméstico de plástico).
6. **Pastas de Amendoim e Castanhas:** NCM `2008.11.00`.

---

## 5. Auditoria de Cadastros Incompletos & Saneamento do Catálogo Demo

### 5.1 Motor de Auditoria Preventiva
O sistema monitora continuamente a base de itens contra 5 regras de qualidade:
1. **Sem Tipo:** Identifica itens que não foram classificados como produto, serviço, plano ou insumo.
2. **Sem NCM:** Aponta mercadorias ativas sem NCM válido de 8 dígitos, prevenindo rejeições na SEFAZ.
3. **Sem Custo:** Detecta itens com custo de compra zerado que distorcem o DRE.
4. **Sem EAN:** Sinaliza produtos cadastrados sem código de barras para o PDV.
5. **Duplicados:** Detecta produtos cadastrados com nomes ou códigos coincidentes.

### 5.2 Ação "Arquivar Catálogo de Demonstração (Supermercado)"
Para a Barbearia Dino, o sistema disponibiliza o botão seguro `🧹 Arquivar Catálogo Demo`:
- **Itens Arquivados com Auditoria:** 28 itens de demonstração de supermercado (Açougue/Carnes, Hortifrúti, Mercearia, Padaria, Limpeza) e itens com descrição "Homologação".
- **Itens Preservados:** Todos os produtos oficiais de barbearia (pomadas, óleos, balms, shampoos, perfumes), bebidas de bar (Heineken, Spaten, refrigerantes) e serviços.
- **Segurança Contábil:** A operação executa inativação lógica (`ativo = false`), mantendo o histórico de vendas e registros fiscais intactos.

---

## 6. Conclusão e Homologação

Com a entrega da **Ficha Técnica do Item** em 5 abas, da **Auditoria de Cadastros Incompletos** e da classificação fiel das três empresas do ecossistema Kytto, o sistema atinge o mais alto patamar de conformidade contábil, velocidade operacional no PDV e governança tributária.
