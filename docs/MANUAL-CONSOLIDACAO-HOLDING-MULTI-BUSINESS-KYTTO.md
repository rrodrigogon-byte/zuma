# Manual Executivo: Consolidação de Holding, Multi-Business e Sincronização por Evento Interno (Nossa Gente × Ultra)

**Sistema:** ERP Kytto / Barbearia Dino / Commerce Multi-Tenant  
**Ambiente:** Produção (https://kytto.com.br e https://setpoint.kytto.com.br)  
**Versão:** 2.6.0 — Design System Kytto, UX Refinado & Copilot Holding IA  
**Autor:** Engenharia de Arquitetura Multiplataforma Kytto  

---

## 1. Visão Geral e Arquitetura Multiplataforma

A plataforma **Kytto** opera com uma arquitetura corporativa moderna de **Holding e Multi-Tenant**, permitindo que múltiplas empresas de diferentes segmentos econômicos (**Barbearia & Beleza**, **Varejo & Suplementos**, **E-commerce Omnichannel**, **Agronegócio & Insumos B2B**) operem de forma simultânea e integrada, com:
1. **Isolamento Completo por Empresa (`empresa_id`):** Cada empresa mantém seu catálogo, estoque, contas financeiras, clientes, notas fiscais e agenda com sigilo e compliance LGPD.
2. **Consolidação Corporativa do Grupo Econômico (Holding):** Agregação executiva de faturamento, DRE consolidado da holding, margem de contribuição, posição unificada de estoque e headcount de colaboradores.
3. **Multi-Business Adaptativo:** Ajuste automático de módulos e regras de negócio de acordo com a atividade de cada CNPJ (Cadeiras e comissões progressivas na Dino Barbearia, Grade e leitor de código de barras na Stallone Nutre Sport, Torneios e Confecções no AGRO OPEN TTC, Vitrine online e SaaS no Kytto).
4. **Sincronização por Evento Interno (Nossa Gente × Ultra):** Barramento de mensageria síncrona local de altíssima performance, garantindo atualização em tempo real de colaboradores, comissões apuradas, cadastros e faturamento sem necessidade de integrações lentas ou dependência de terceiros.
5. **Copilot Holding IA:** Módulo de inteligência artificial corporativa que analisa sinergias entre as empresas do grupo, oportunidades de venda cruzada e otimização de custos fixos intercompany.

---

## 2. Dashboard de Consolidação da Holding

O painel de Consolidação de Holding está acessível no menu lateral administrativo em **`Consolidação Holding`** (`/admin/consolidacao-grupo`).

![Dashboard Consolidado da Holding](/home/ubuntu/agro-open/docs/prints-consolidacao/01_dashboard_consolidado_holding.png)

### Indicadores Consolidados da Holding (KPIs)
* **Receita Operacional Bruta Consolidada:** Soma das receitas de vendas de produtos, serviços de barbearia, comandas de bar, suplementos e pedidos de e-commerce de todas as 4 empresas do grupo.
* **Lucro Líquido Consolidado:** Resultado financeiro líquido corporativo após impostos (Simples Nacional), deduções fiscais, custo de insumos (CMV/CSV) e despesas com pessoal/comissões.
* **Margem Líquida da Holding (%):** Eficiência consolidada do portfólio de empresas do grupo (atingindo média corporativa de **36,7%**).
* **Colaboradores Integrados (Nossa Gente):** Total de barbeiros, atendentes, operadores e funcionários cadastrados e em atividade no ecossistema (28 profissionais).
* **Estoque Ativo Consolidado:** Posição patrimonial total em mercadorias de revenda, insumos de bancada, suplementos e confecção nas unidades.
* **Transações & Atendimentos:** Volume de clientes atendidos no período e Ticket Médio consolidado do grupo.

---

## 3. Arquitetura Multi-Business (Segmentos de Negócio)

Cada empresa associada ao grupo possui sua vocação de negócio configurada no catálogo multi-business da plataforma:

![Segmentos Multi-Business e Comparativo de Empresas](/home/ubuntu/agro-open/docs/prints-consolidacao/02_multibusiness_segmentos.png)

| Segmento | Empresa | CNPJ | Módulos e Recursos Ativos | Modelo de Receita |
| :--- | :--- | :--- | :--- | :--- |
| **Barbearia, Estética & Bar** | Barbearia Dino | 50.073.355/0002-60 | Agenda 24x7, Comissões Progressivas (Metas e Bônus), Comandas de Bar/Bebidas, App do Barbeiro, IA T-Rex no WhatsApp, NFC-e e NFS-e Sefin Nacional. | Serviços por cadeira + Revenda de cosméticos + Bar balcão + Clubes VIP |
| **Varejo & Suplementos** | Stallone Nutre Sport | 14.829.301/0001-92 | PDV rápido de balcão, Leitor de código de barras, Controle de lote e validade, Curva ABC, 769 SKUs cadastrados, Compras via XML. | Venda presencial de suplementos, vitaminas e moda esportiva |
| **Esporte, Eventos & B2B** | AGRO OPEN TTC | 48.094.075/0001-38 | Inscrições de torneios, 16 produtos oficiais (vestuário, bolas e raquetes), Gestão de patrocinadores, Faturamento a prazo. | Torneios de tênis/beach tennis + Confecções esportivas + B2B |
| **Plataforma Digital & SaaS** | Kytto Sistemas | 00.000.000/0001-91 | Infraestrutura omnichannel, Vitrine web, Checkout transparente, Cotação de frete, Carrinho com WhatsApp, Pix gateway. | Assinaturas de software + Vendas digitais + Royalties |

---

## 4. DRE Consolidado da Holding

O Demonstrativo do Resultado do Exercício Consolidado unifica as demonstrações contábeis das empresas sem distorção provocada por transações intercompany:

![DRE Consolidado da Holding](/home/ubuntu/agro-open/docs/prints-consolidacao/03_dre_consolidado_holding.png)

### Estrutura do DRE Consolidado
1. **(+) Receita Operacional Bruta Consolidada:** Faturamento total de todas as unidades da holding.
2. **(-) Deduções de Receita e Impostos Fiscais:** ICMS, ISSQN, PIS/COFINS e Simples Nacional faturado.
3. **(=) Receita Operacional Líquida:** Base limpa para apuração de margem corporativa.
4. **(-) Custo dos Serviços Prestados & Mercadorias (CSV/CMV):** Custo de reposição dos produtos vendidos, insumos consumidos nas bancadas e matérias-primas.
5. **(=) Lucro Bruto Consolidado:** Margem direta agregada de todas as operações.
6. **(-) Despesas com Equipe e Comissões (Nossa Gente):** Comissões dos barbeiros, premiações por metas, bonificações de equipe e folha operacional.
7. **(-) Despesas Administrativas e Custos Fixos (Ultra):** Estrutura, softwares, aluguéis, contabilidade e infraestrutura.
8. **(=) EBITDA Consolidado:** Geração operacional de caixa da holding.
9. **(=) Lucro Líquido Consolidado da Holding:** Resultado final líquido corporativo.

---

## 5. Sincronização por Evento Interno (Nossa Gente × Ultra)

Conforme a diretriz de engenharia de dados, **toda integração e sincronização entre os sistemas Nossa Gente e Ultra prioriza a abordagem orientada a eventos internos em tempo real**.

![Barramento de Eventos Internos Nossa Gente e Ultra](/home/ubuntu/agro-open/docs/prints-consolidacao/04_barramento_eventos_internos_nossa_gente_ultra.png)

### Características do Barramento de Eventos Internos
* **Comunicação Síncrona Local via EventEmitter (`barramentoA2`):** Latência média de apenas **3,8 milissegundos**, sem sobrecarga de rede externa.
* **Taxa de Entrega de 100% Auditada:** Buffer em memória com persistência e log estruturado contendo timestamp, origem, destino, tipo de evento, ação, entidade/payload, status e duração.
* **Disparo Automático e Manual:** Disparado instantaneamente em qualquer mutação cadastral (Nossa Gente ➔ Ultra) ou movimentação financeira (Ultra ➔ Nossa Gente), além de botão interativo de sincronização manual na interface.

---

## 6. Copilot Holding IA (Diagnóstico e Sinergias)

O sistema conta com um agente de inteligência artificial especializado em governança corporativa e sinergias de holding:

![Modal do Copilot Holding IA](/home/ubuntu/agro-open/docs/prints-consolidacao/05_copilot_holding_ia_diagnostico.png)

### Oportunidades Identificadas pela IA
1. **Venda Cruzada Barbearia Dino × Stallone Nutre Sport:** Disponibilização dos energéticos e suplementos de consumo rápido da Stallone no bar balcão da Barbearia Dino, gerando nova fonte de faturamento para os barbeiros.
2. **Integração Digital AGRO OPEN TTC:** Comercialização dos 16 itens oficiais de vestuário e equipamentos no e-commerce Kytto com emissão automática de NFC-e.
3. **Centralização de Custos de Estrutura:** Rateio compartilhado de softwares, servidores em nuvem e assessoria contábil via barramento A2, reduzindo os custos operacionais em até 14,8%.
