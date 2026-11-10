with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Atualizar cabecalho
content = content.replace(
    '**Versão do Documento:** 2.8 (Edição Homologada de Produção - SPED EFD Completo, KDS & Salão Parceiro)',
    '**Versão do Documento:** 2.9 (Edição Homologada de Produção - DIMP Preventivo, Supply Chain RFQ & 3-Way Matching)'
)

# Atualizar sumario
sumario_v28 = """21. **Impressão Térmica de Comandas (ESC/POS 80mm) e Acerto de Motoboys**
22. **Lei do Salão Parceiro (Lei 13.352/2016) e EFD-Reinf (Evento R-4010)**

---"""

sumario_v29 = """21. **Impressão Térmica de Comandas (ESC/POS 80mm) e Acerto de Motoboys**
22. **Lei do Salão Parceiro (Lei 13.352/2016) e EFD-Reinf (Evento R-4010)**
23. **Auditoria Preventiva DIMP vs Fiscal e Eliminação de Malha Fina SEFAZ**
24. **Supply Chain, Cotação de Fornecedores RFQ e Comparativo CIF vs FOB**
25. **Conferência Cega 3-Way Matching (PO x MD-e x Estoque Físico)**

---"""

content = content.replace(sumario_v28, sumario_v29)

novas_secoes_v29 = """---

## 23. AUDITORIA PREVENTIVA DIMP VS FISCAL E ELIMINAÇÃO DE MALHA FINA SEFAZ

Toda operação comercial que aceita pagamentos em cartões de crédito, débito e Pix está sujeita ao cruzamento automático da **DIMP (Declaração de Informações sobre Meios de Pagamento)** com os documentos fiscais emitidos (NFC-e, NF-e e NFS-e). 

A SEFAZ-MT e a Receita Federal autuam contribuintes quando o faturamento eletrônico informado pelas credenciadoras supera o valor das notas fiscais emitidas.

### Evidência em Produção: Painel de Auditoria DIMP vs Fiscal
![Auditoria Preventiva DIMP vs Fiscal](/home/ubuntu/agro-open/docs/prints/37-fiscal-auditoria-dimp-malha-fina.png)

### Recursos de Governança Preventiva:
1. **Confronto Eletrônico Instantâneo:** Totaliza recebimentos nas credenciadoras cadastradas (**Cielo, Stone, Sicredi, PagBank, Rede**) e confronta com o total de notas fiscais autorizadas no período.
2. **Índice de Cobertura Fiscal:** Percentual da receita eletrônica com lastro documental emitido.
3. **Indicador Semafórico de Risco:** 
   * **ALTO:** Diferença não faturada superior a R$ 5.000,00 com risco iminente de intimação fiscal;
   * **MÉDIO:** Pequenas divergências diárias a ajustar;
   * **ZERO:** 100% de cobertura fiscal garantida.
4. **Regularização em Lote em 1 Clique:** Emissão automática das notas pendentes gerando NFC-e ou NFS-e com chave de acesso e protocolo SEFAZ, zerando o passivo fiscal.

### Evidência em Produção: Regularização Concluída com Risco Zero
![Regularização Fiscal DIMP com Risco Zero](/home/ubuntu/agro-open/docs/prints/40-fiscal-dimp-regularizacao-lote-sucesso.png)

---

## 24. SUPPLY CHAIN, COTAÇÃO DE FORNECEDORES RFQ E COMPARATIVO CIF VS FOB

O módulo de **Supply Chain & Compras Corporativas** (`/admin/supply-chain`) profissionaliza o processo de aquisição de insumos e produtos de revenda:

### Evidência em Produção: Cotações RFQ & Comparativo Comercial
![Supply Chain Cotações RFQ](/home/ubuntu/agro-open/docs/prints/38-supply-chain-cotacoes-rfq-comparativo.png)

### Etapas do Fluxo de Compras:
1. **Requisição de Reposição (RFQ):** Agrupamento automático de itens que atingiram o Ponto de Pedido no estoque ou solicitação manual do encarregado de compras.
2. **Quadro Comparativo de Fornecedores:** Confronto lado a lado de propostas com identificação automática do **Menor Preço**, modalidade de frete (**CIF incluso vs FOB com frete pago**), prazos de entrega (*lead time*) e condições de pagamento (Boleto 30/60 dias vs Pix com desconto).
3. **Aprovação e Geração do Pedido de Compra (PO):** Com 1 clique em **"✓ Aprovar & Gerar Pedido"**, o sistema formaliza a Ordem de Compra oficial e notifica o fornecedor.

---

## 25. CONFERÊNCIA CEGA 3-WAY MATCHING (PO X MD-E X ESTOQUE FÍSICO)

Para blindar o caixa contra cobranças indevidas de fornecedores e erros de faturamento, o Kytto executa a conferência cega **3-Way Matching**:

### Evidência em Produção: Painel de Conferência 3-Way Matching
![Conferência Cega 3-Way Matching](/home/ubuntu/agro-open/docs/prints/39-supply-chain-3way-matching-conferencia.png)

### Validação dos Três Pilares:
1. **Pilar 1 (Pedido de Compra PO):** Preço unitário e quantidades negociadas e autorizadas pela diretoria.
2. **Pilar 2 (Nota Fiscal do Fornecedor):** XML da NF-e modelo 55 capturado diretamente da SEFAZ pelo módulo de **Manifestação do Destinatário (MD-e)**.
3. **Pilar 3 (Estoque Físico Recebido):** Quantidades e lotes descarregados fisicamente na expedição.
4. **Recálculo do Custo Médio Ponderado:** Com a aprovação sem divergência, o sistema recalcula automaticamente o custo contábil unitário de cada mercadoria no estoque da unidade.

---

## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL"""

# Substituir a conclusao
idx_fim = content.find('## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL')
if idx_fim != -1:
    idx_sep = content.rfind('---', 0, idx_fim)
    content = content[:idx_sep] + novas_secoes_v29 + '\n\nEste manual consolida todas as rotas, telas, procedimentos e arquiteturas que colocam o **Kytto ERP Enterprise** no estado da arte da tecnologia nacional de software de gestão, garantindo robustez financeira, agilidade no balcão e conformidade contábil e fiscal para todos os inquilinos e marcas do ecossistema.\n\n**Equipe de Engenharia Kytto**  \n*Novembro de 2026*\n'

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(content)

print('MANUAL v29 ATUALIZADO COM SUCESSO!')
