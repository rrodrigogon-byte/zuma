# Manual Operacional e Executivo — Hub de Compras e Estoque
## Sistema Barbearia Dino & ERP Kytto Multiempresa

---

### Sumário Executivo
Este manual oficial estabelece o guia de operação e arquitetura funcional do **Hub Integrado de Compras e Estoque** da **Barbearia Dino** e da plataforma **ERP Kytto**, homologado para produção.

O módulo atende de forma autônoma e completa os 5 pilares essenciais da gestão de materiais e suprimentos, integrando o catálogo de produtos de revenda, bebidas de bar e insumos de bancada diretamente à rotina diária de agendamentos, comandas e caixa:

1. **📦 Estoque**: Gestão unificada de saldos, custo médio ponderado, preço de venda, margem projetada, ponto de pedido e alertas de ruptura.
2. **🚚 Compras e Fornecedores**: Ciclo completo de pedidos de compra (Rascunho → Enviado → Recebimento no estoque), reposição algorítmica por giro em 1 clique e entrada automatizada por XML de NF-e.
3. **🧾 Perdas e Inventário**: Registro auditado de avarias, validade, quebras e consumo interno com baixa instantânea no saldo; abertura de inventário físico com contagem cega, conciliação e apuração da taxa de acuracidade contábil (%).
4. **🧪 Fichas Técnicas**: Composição técnica de insumos por procedimento (corte, barba, barboterapia, selagem, químicas) com baixa automática de estoque na finalização de comandas no caixa.
5. **🗂️ Fornecedores e Funcionários**: Cadastros mestres unificados com prazos comerciais, CNPJ, dados de contato e vinculação com a equipe responsável.

---

### 1. Módulo 1: Estoque & Catálogo Unificado
A visão de **Estoque** centraliza todo o portfólio físico da barbearia em três categorias bem definidas:
- **Produtos de Revenda**: Pomadas matte, óleos de barba, tônicos, ceras, perfumes e cosméticos masculinos para venda direta ao cliente final com comissão ao profissional.
- **Bebidas & Consumo de Bar**: Cervejas artesanais e tradicionais (Heineken, Corona, Budweiser), refrigerantes, energéticos e águas para consumo durante o atendimento ou avulso na recepção.
- **Insumos Internos de Bancada**: Lâminas descartáveis, toalhas térmicas descartáveis, capas, golas higiênicas, xampus e químicas.

![Visão Geral do Estoque no Hub Kytto](/home/ubuntu/agro-open/docs/prints-compras-estoque/01_estoque_catalogo_hub.png)

#### Indicadores em Tempo Real (KPIs):
- **Itens Ativos**: Quantidade total de SKUs cadastrados e operacionais.
- **Abaixo do Mínimo**: Quantidade de produtos cujo saldo atual atingiu ou rompeu o estoque de segurança.
- **Sem Estoque (Ruptura)**: Itens com saldo zero que demandam compra emergencial para evitar perda de faturamento.
- **Valor Investido (Custo)**: Montante financeiro total imobilizado em estoque calculado pelo custo médio ponderado.
- **Previsão de Receita**: Faturamento bruto projetado com a venda total dos itens no preço de tabela.
- **Margem Média Projetada**: Percentual médio de lucratividade bruta sobre os itens em prateleira.

#### Ações Disponíveis na Tela:
- **+ Entrada Rápida / Lote**: Lançamento ágil de entrada de mercadoria com definição de quantidade e custo unitário.
- **+ Novo Produto**: Formulário completo para cadastrar produtos com código de barras/SKU, categoria, preço de venda, custo, estoque mínimo e comissão de revenda.
- **📥 Exportar CSV**: Download imediato da planilha com todas as métricas para conciliação contábil e auditoria.

---

### 2. Módulo 2: Compras e Fornecedores
O módulo de **Compras** elimina planilhas paralelas e automatiza o processo de suprimentos da barbearia.

![Painel de Compras e Reposição Sugerida](/home/ubuntu/agro-open/docs/prints-compras-estoque/02_compras_fornecedores_hub.png)

#### Fluxo Operacional de Compras:
1. **Reposição Sugerida por Giro**: O algoritmo do Kytto analisa o consumo diário médio dos últimos 60 dias, cruza com o saldo atual e o prazo de entrega do fornecedor parceiro. Se o item estiver abaixo do ponto de pedido, calcula a quantidade exata a comprar.
2. **Geração em 1 Clique**: Ao clicar em **"⚡ Gerar Pedidos em Rascunho"**, o sistema agrupa os itens por fornecedor homologado e monta os pedidos automaticamente.
3. **Controle de Status do Pedido**:
   - `RASCUNHO`: Pedido montado para conferência de preços e quantidades.
   - `ENVIADO`: Pedido formalizado e transmitido ao fornecedor (com data de previsão de entrega).
   - `RECEBIDO`: Conferência física no balcão. Ao clicar em **"✓ Receber no Estoque"**, o sistema credita as quantidades no saldo dos produtos e recalcula o custo médio ponderado de forma automática e auditada.
4. **Entrada Automatizada por XML de NF-e**: Importação do arquivo XML emitido pelo fornecedor com conciliação automática por código de barras (EAN), código interno e razão social, com proteção estrita contra duplicidade de notas.

---

### 3. Módulo 3: Perdas e Inventário Físico
O módulo de **Perdas e Inventário** assegura que o estoque físico de prateleira e bancada reflita com fidelidade absoluta o saldo registrado no sistema.

![Módulo de Perdas e Inventário Físico](/home/ubuntu/agro-open/docs/prints-compras-estoque/03_perdas_inventario_hub.png)

#### Baixas Manuais Auditadas:
Para registrar baixas que não correspondem a vendas comerciais no caixa:
- **Perda / Avaria Física**: Frascos quebrados, embalagens danificadas ou defeitos de fábrica.
- **Vencimento**: Cosméticos ou bebidas que atingiram a data limite de validade.
- **Consumo Interno**: Produtos retirados para uso exclusivo da bancada, testes técnicos ou higienização.
- **Cortesia / Bonificação**: Bebidas ou produtos oferecidos a clientes VIP sem cobrança na comanda.

Toda ocorrência exige a identificação do motivo, quantidade e usuário autenticado, mantendo trilha de auditoria completa.

#### Inventário Físico e Acuracidade (%):
1. **Abertura do Inventário**: Pode ser geral (toda a loja) ou rotativo (apenas uma categoria, ex.: Bebidas).
2. **Contagem Cega / Conferência**: O conferente conta os itens fisicamente e digita os valores apurados na coluna "Contagem Física".
3. **Cálculo da Divergência**: O sistema aponta imediatamente diferenças positivas (sobras) ou negativas (faltas).
4. **Conclusão e Ajuste**: Ao confirmar o fechamento, o Kytto atualiza todos os saldos no banco de dados e calcula a **Taxa de Acuracidade Geral (%)**.

---

### 4. Módulo 4: Fichas Técnicas (Baixa Automática no Caixa)
As **Fichas Técnicas** resolvem o maior gargalo operacional de barbearias e salões: saber o custo real de cada procedimento e dar baixa nos insumos consumidos sem depender de anotações manuais.

![Fichas Técnicas e Baixa Automática](/home/ubuntu/agro-open/docs/prints-compras-estoque/04_fichas_tecnicas_hub.png)

#### Funcionamento Integrado:
- Cada serviço (ex.: *Barboterapia*, *Corte Dino Especial*, *Selagem Térmica*) possui sua ficha técnica associada.
- A ficha discrimina cada insumo utilizado e sua dosagem (ex.: 1 lâmina descartável, 1 toalha térmica, 10ml de óleo amadeirado, 15g de loção).
- O sistema calcula o **Custo Total de Insumos** e a **Margem de Contribuição Líquida** sobre o preço de venda do serviço.
- **Baixa Automática**: No momento exato em que a comanda do cliente é recebida e faturada no caixa (seja em dinheiro, cartão ou Pix), o motor do ERP realiza a baixa automática dos insumos vinculados no estoque, com controle de concorrência e idempotência.

---

### 5. Módulo 5: Cadastros Mestres de Fornecedores e Funcionários
Unificação dos registros cadastrais da operação para compras, atendimento e permissões de acesso.

![Cadastros Mestres de Fornecedores e Equipe](/home/ubuntu/agro-open/docs/prints-compras-estoque/05_fornecedores_funcionarios_hub.png)

- **Fornecedores Homologados**: Registro de distribuidores parceiros com CNPJ, contatos comerciais, canais de pedidos, prazos médios de entrega e condições de pagamento (ex.: Ambev, Distribuidora Alpha Cosméticos, QOD Barber Shop).
- **Equipe Dino**: Cadastro unificado de barbeiros, recepcionistas e administradores, integrado com comissões progressivas, horários da bancada e acessos do aplicativo móvel.

---

### 6. Como Acessar no Sistema Kytto

O Hub de Compras e Estoque pode ser acessado de duas maneiras na plataforma:

1. **Pelo ERP Barbearia Dino**:
   - Acesse o link oficial: `https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Estoque+de+revenda`
   - O Hub é carregado diretamente na tela com os 5 botões de navegação rápida no topo (🚚 Compras e fornecedores, 📦 Estoque, 🧾 Perdas e inventário, 🧪 Fichas técnicas, 🗂️ Fornecedores e funcionários).
   - Ao clicar em qualquer aba na barra de navegação, a tela alterna de forma instantânea sem necessidade de recarregar a página.

2. **Pelo Menu Lateral da Plataforma (Sidebar)**:
   - Abra o menu lateral esquerdo.
   - Localize o grupo **"Compras e estoque"**.
   - Os 5 módulos estão disponíveis individualmente para acesso direto:
     * 🚚 **Compras e fornecedores** (`/admin/compras`)
     * 📦 **Estoque** (`/admin/estoque`)
     * 🧾 **Perdas e inventário** (`/admin/perdas-inventario`)
     * 🧪 **Fichas técnicas** (`/admin/fichas-tecnicas`)
     * 🗂️ **Fornecedores e funcionários** (`/admin/cadastros-mestres`)

---

*Documento homologado em 05 de novembro de 2026 para a Barbearia Dino e plataforma ERP Kytto.*
