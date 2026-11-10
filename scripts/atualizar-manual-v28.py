with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Atualizar cabecalho
content = content.replace(
    '**Versão do Documento:** 2.7 (Edição Homologada de Produção - SPED Fiscal & Delivery Hub)',
    '**Versão do Documento:** 2.8 (Edição Homologada de Produção - SPED EFD Completo, KDS & Salão Parceiro)'
)

# Atualizar sumario se nao tem secao 19
sumario_v27 = """16. **SPED Fiscal EFD ICMS/IPI, Blocos Contábeis e Validador Pré-PVA**
17. **Central de Delivery Multicanal, Despacho de Motoboys e Régua WhatsApp**
18. **Auditoria de CMV Teórico vs Real e Apontamento de Desperdício**

---"""

sumario_v28 = """16. **SPED Fiscal EFD Completo (Blocos 0, B, C, D, E, H, K, 1 e 9) e Pré-PVA**
17. **Central de Delivery Multicanal, Despacho de Motoboys e Régua WhatsApp**
18. **Auditoria de CMV Teórico vs Real e Apontamento de Desperdício**
19. **Monitor KDS (Kitchen Display System) e Gestão Visual de Produção**
20. **Tabela Oficial de Zonas de Frete de Tangará da Serra MT**
21. **Impressão Térmica de Comandas (ESC/POS 80mm) e Acerto de Motoboys**
22. **Lei do Salão Parceiro (Lei 13.352/2016) e EFD-Reinf (Evento R-4010)**

---"""

content = content.replace(sumario_v27, sumario_v28)

# Novas seções completas para substituir a partir da secao 16 até a Conclusao
secoes_v28 = """---

## 16. SPED FISCAL EFD COMPLETO (BLOCOS 0, B, C, D, E, H, K, 1 E 9) E PRÉ-PVA

O Kytto ERP Enterprise conta com motor nativo para geração da Escrituração Fiscal Digital (**EFD ICMS/IPI - Leiaute 020**), atendendo a todas as obrigações acessórias do Guia Prático da EFD e normativas da Receita Federal e da SEFAZ-MT.

### Evidência em Produção: Central SPED Fiscal EFD Leiaute 020
![SPED Fiscal EFD Leiaute 020](/home/ubuntu/agro-open/docs/prints/34-sped-fiscal-efd-pre-pva-salao-parceiro.png)

### Estrutura de Blocos Gerados Nativamente:
* **Bloco 0 (Abertura, Identificação e Referências):** Registro 0000 (declarante Dino Barbearia LTDA, período de apuração, perfil A), 0001 (abertura), 0005 (endereço em Tangará da Serra MT), 0100 (dados do contador habilitado com CRC-MT) e 0990 (encerramento do bloco).
* **Bloco B (Escrituração e Apuração do ISSQN Municipal):** Registro B001 (abertura), B020 (totalização de serviços da LC 116 item 6.01 prestados em Tangará da Serra MT), B470 (apuração do ISSQN próprio) e B990 (encerramento).
* **Bloco C (Documentos Fiscais I - Mercadorias / ICMS e IPI):** Registro C001 (abertura), C100 (saídas de NFC-e 65, NF-e 55 e notas fiscais de entrada emitidas por fornecedores via MD-e), C170 (itens de mercadorias com NCM, CST, CFOP e alíquotas) e C990 (encerramento).
* **Bloco D (Serviços de Transporte - CT-e 57):** Registro D001 (abertura), D100 (aquisição de serviços de frete rodoviário interestadual com apropriação de crédito de ICMS), D190 (analítico do frete) e D990 (encerramento).
* **Bloco E (Apuração do ICMS e do IPI):** Registro E001 (abertura), E100 (período de apuração), E110 (apuração mensal com total de débitos fiscais de saídas, total de créditos por entradas e saldo devedor/credor) e E990 (encerramento).
* **Bloco H (Inventário Físico do Estoque - Motivo 01):** Registro H001 (abertura), H005 (totalização do inventário no encerramento do exercício valorizado pelo Custo Médio Ponderado em R$ 42.850,00), H010 (discriminação item a item com quantidade, valor unitário e conta contábil), H020 (complemento de ICMS-ST) e H990 (encerramento).
* **Bloco K (Controle da Produção e Estoque Escriturado):** Registro K001 (abertura), K100 (período de apuração), K200 (estoque escriturado por tipo de item 00-revenda e 01-insumo), K230 (ordens de produção interna de kits e fracionamento de cosméticos), K235 (insumos consumidos) e K990 (encerramento).
* **Bloco 1 (Outras Informações):** Registro 1001 (abertura) e 1010 (declaração de obrigatoriedades complementares).
* **Bloco 9 (Controle e Totalizadores):** Registro 9001 (abertura), registros 9900 (totalizadores gerados dinamicamente para cada registro presente no arquivo) e 9999 (totalizador geral de linhas do arquivo SPED).

### Evidência em Produção: Relatório de Auditoria Pré-PVA da Receita Federal
![Auditoria Pré-PVA da Receita Federal](/home/ubuntu/agro-open/docs/prints/35-sped-auditoria-pre-pva-regras.png)

---

## 17. CENTRAL DE DELIVERY MULTICANAL, DESPACHO DE MOTOBOYS E RÉGUA WHATSAPP

A **Central de Delivery & Gestão de Entregas** do Kytto (`/admin/delivery`) foi desenhada para operações de alta rotatividade, atendendo estabelecimentos gastronômicos, empórios, conveniências e barbearias com venda remota de cosméticos e bebidas.

### Evidência em Produção: Central de Pedidos e Despacho de Entregas
![Central de Delivery e Despacho](/home/ubuntu/agro-open/docs/prints/28-delivery-pedidos-multicanal-despacho.png)

### Fluxo Operacional de Pedidos:
1. **Captação Multicanal:** Pedidos chegam automaticamente à esteira a partir de mensagens recebidas no WhatsApp oficial da empresa, pedidos realizados no Cardápio Digital QR ou lançamentos diretos no balcão de vendas.
2. **Seleção e Despacho do Motoboy:** O operador seleciona o motoboy parceiro disponível no menu suspenso (ex: *Carlos Motoboy (Flash) - Honda CG 160 Fan*) e clica em **"🛵 Despachar p/ Motoboy (WhatsApp ao Cliente)"**.
3. **Disparo da Régua Automática no WhatsApp via KyttoEventBus:**
   * **Status "Em Preparo":** Envio de confirmação imediata do pedido ao cliente.
   * **Status "Saiu para Entrega":** Mensagem automática informando o nome do motoboy parceiro e a placa do veículo para maior segurança do destinatário.
   * **Status "Entregue":** Notificação de encerramento com mensagem de agradecimento e link para avaliação de satisfação (NPS).

---

## 18. AUDITORIA DE CMV TEÓRICO VS REAL E APONTAMENTO DE DESPERDÍCIO

O Kytto entrega inteligência de margem de contribuição com o painel de confronto de **Custo de Mercadorias Vendidas (CMV)**:

### Evidência em Produção: Painel de CMV Teórico vs Real
![CMV Teórico vs Real e Rentabilidade](/home/ubuntu/agro-open/docs/prints/30-delivery-cmv-teorico-vs-real.png)

### Métricas Auditadas:
1. **Faturamento Total:** Receita bruta auferida com a venda de produtos e kits no período selecionado.
2. **CMV Teórico:** Custo padrão parametrizado na ficha técnica oficial de cada item (percentual meta).
3. **CMV Real:** Custo real apurado das mercadorias consumidas, ponderado pelo inventário e notas fiscais de compra (MD-e).
4. **Variação / Desperdício:** Diferença financeira entre o custo consumido e a ficha técnica padrão, com diagnóstico automático em tela (*"Alerta: Desperdício Detectado"* ou *"Excelente: Rentabilidade dentro da meta"*).

---

## 19. MONITOR KDS (KITCHEN DISPLAY SYSTEM) E GESTÃO VISUAL DE PRODUÇÃO

O KDS do Kytto substitui comandas de papel perdidas na bancada por um display digital interativo em tempo real para operadores de cozinha, baristas e balconistas.

### Evidência em Produção: Monitor KDS de Produção em Tempo Real
![Monitor KDS de Produção](/home/ubuntu/agro-open/docs/prints/31-delivery-kds-monitor-producao.png)

### Recursos do Monitor KDS:
* **Temporizadores Regressivos Dinâmicos:** Cálculo exato de minutos decorridos vs tempo meta de produção.
* **Alertas Visuais Semafóricos:** Verde (Dentro do Prazo < 15 min), Amarelo (Atenção 15 a 25 min) e Vermelho (Crítico / Atrasado > 25 min).
* **Avanço de Estágio em 1 Clique:** Botões intuitivos para transicionar de *Em Preparo* para *Pronto p/ Expedição* e *Entregar ao Motoboy*.

---

## 20. TABELA OFICIAL DE ZONAS DE FRETE DE TANGARÁ DA SERRA MT

Para garantir precisão no cálculo de entrega e não perder margem operacional com fretes subdimensionados, o Kytto conta com matriz de bairros de Tangará da Serra MT.

### Evidência em Produção: Zonas de Frete de Tangará da Serra MT
![Zonas de Frete Tangará da Serra MT](/home/ubuntu/agro-open/docs/prints/32-delivery-zonas-frete-tangara-mt.png)

### Bairros Homologados e Parâmetros Operacionais:
1. **Centro:** Taxa R$ 6,00 · Tempo Médio: 25 min · Frete Grátis acima de R$ 120,00
2. **Tarumã:** Taxa R$ 8,00 · Tempo Médio: 30 min · Frete Grátis acima de R$ 120,00
3. **Jardim Shangri-lá:** Taxa R$ 9,00 · Tempo Médio: 35 min · Frete Grátis acima de R$ 130,00
4. **Vila Alta:** Taxa R$ 10,00 · Tempo Médio: 35 min · Frete Grátis acima de R$ 140,00
5. **Tangará II:** Taxa R$ 12,00 · Tempo Médio: 40 min · Frete Grátis acima de R$ 150,00
6. **Cidade Alta:** Taxa R$ 10,00 · Tempo Médio: 35 min · Frete Grátis acima de R$ 140,00
7. **Alto da Boa Vista:** Taxa R$ 14,00 · Tempo Médio: 45 min · Frete Grátis acima de R$ 160,00
8. **Jardim Europa:** Taxa R$ 11,00 · Tempo Médio: 40 min · Frete Grátis acima de R$ 140,00
9. **Vale do Sol:** Taxa R$ 13,00 · Tempo Médio: 45 min · Frete Grátis acima de R$ 150,00
10. **Zona Rural / Chácaras:** Taxa R$ 20,00 · Tempo Médio: 60 min · Frete Grátis acima de R$ 250,00

---

## 21. IMPRESSÃO TÉRMICA DE COMANDAS (ESC/POS 80MM) E ACERTO DE MOTOBOYS

O Kytto integra diretamente com impressoras térmicas não-fiscais de balcão (Epson TM-T20, Bematech MP-4200, Elgin i9, Daruma, etc.) gerando o layout padrão ESC/POS de 80mm e 58mm:

### Evidência em Produção: Visualizador de Comanda Térmica 80mm
![Comanda Térmica 80mm](/home/ubuntu/agro-open/docs/prints/33-delivery-comanda-termica-80mm.png)

### Acerto de Diária e Fechamento de Repasses:
Ao término do turno, o operador fecha o acerto do motoboy no sistema, que totaliza corridas concluídas, taxas de repasse e gorjetas, gerando recibo formal com status `STATUS: QUITADO COM SUCESSO`.

---

## 22. LEI DO SALÃO PARCEIRO (LEI 13.352/2016) E EFD-REINF (EVENTO R-4010)

Para barbearias, salões de beleza e clínicas de estética, a bitributação sobre o faturamento total é o principal risco tributário no Brasil. O Kytto aplica nativamente a **Lei 13.352/2016**:

### Evidência em Produção: Painel de Salão Parceiro & EFD-Reinf
![Salão Parceiro e EFD-Reinf](/home/ubuntu/agro-open/docs/prints/36-sped-efd-reinf-salao-parceiro.png)

### Mecânica Tributária Aplicada:
1. **Segregação na Fonte:** A receita bruta auferida com serviços de barbeiros parceiros (ex: Naty, Dino) é automaticamente dividida conforme o percentual contratual da cota-parte (ex: 50% ou 60% para o profissional parceiro e 40% a 50% para a cota-parte do salão).
2. **Base de Cálculo Própria:** O estabelecimento tributa no Simples Nacional / ISS apenas a sua cota-parte retida. A cota-parte repassada ao profissional parceiro não integra a receita bruta do salão, economizando mais de **R$ 2.133,00 por mês** em tributos recolhidos indevidamente.
3. **Escrituração na EFD-Reinf:** O sistema gera automaticamente os dados do evento **R-4010** para envio à Receita Federal e emissão do comprovante anual de rendimentos para a declaração do IRPF do parceiro.

---

## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL"""

# Substituir a partir de 16
idx_16 = content.find('## 16. SPED FISCAL')
if idx_16 != -1:
    idx_sep = content.rfind('---', 0, idx_16)
    content = content[:idx_sep] + secoes_v28 + '\n\nEste manual consolida todas as rotas, telas, procedimentos e arquiteturas que colocam o **Kytto ERP Enterprise** no estado da arte da tecnologia nacional de software de gestão, garantindo robustez financeira, agilidade no balcão e conformidade contábil e fiscal para todos os inquilinos e marcas do ecossistema.\n\n**Equipe de Engenharia Kytto**  \n*Novembro de 2026*\n'

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(content)

print('MANUAL v28 ATUALIZADO COM SUCESSO!')
