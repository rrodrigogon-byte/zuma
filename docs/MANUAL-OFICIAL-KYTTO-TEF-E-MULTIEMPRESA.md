# MANUAL OPERACIONAL E ADMINISTRATIVO
# ERP KYTTO ENTERPRISE & TEF MULTI-MAQUININHAS
**Guia Oficial de Operação de Balcão, Parametrização TEF, Conciliação Bancária OFX, Gestão Fiscal SEFAZ-MT e Governança Multi-Tenant**

---

**Empresa Referência:** DINO BARBEARIA LTDA (CNPJ 50.073.355/0002-60 · IM 30297 · Tangará da Serra / MT)  
**Plataforma Homologada:** Kytto Cloud & On-Premise Enterprise  
**Versão do Documento:** 3.0 (Edição Homologada de Produção - Cancelamento Coordenado de Comandas & Isenção de Bebidas 0%)  
**Data:** Novembro de 2026  
**Ambiente Oficial:** `https://kytto.com.br`  

---

## SUMÁRIO GERAL

1. **Visão Geral e Arquitetura da Solução Kytto**
2. **Módulo TEF Multi-Maquininhas & Pinpads Homologados**
3. **Parametrização e Provisionamento de Terminais de Balcão**
4. **Matriz de Taxas MDR e Projeção do Líquido por Adquirente**
5. **Operação de Balcão e Fechamento de Comandas via TEF**
6. **Cancelamento, Estorno e Tratamento de Contingência Offline**
7. **Conciliação Bancária Inteligente e Cruzamento com Extratos OFX**
8. **Catálogo Oficial de Bancos Brasileiros Homologados**
9. **Módulo Fiscal: NFC-e SEFAZ-MT, NF-e 55 e Pacote Contábil ZIP**
10. **Governança e Isolamento Estrito Multi-Tenant**
11. **Copilot Kytto Advisor, Agente T-Rex e Barramento de Eventos**
12. **Resolução de Problemas, Códigos de Resposta TEF e Boas Práticas**
13. **Boletos Bancários Registrados Híbridos com Pix Dinâmico (FEBRABAN)**
14. **Simulador e Apuração de ICMS-ST para Mato Grosso (RICMS-MT)**
15. **Manifestação do Destinatário (MD-e) e Entrada de Notas com Custo Médio**
16. **SPED Fiscal EFD Completo (Blocos 0, B, C, D, E, H, K, 1 e 9) e Pré-PVA**
17. **Central de Delivery Multicanal, Despacho de Motoboys e Régua WhatsApp**
18. **Auditoria de CMV Teórico vs Real e Apontamento de Desperdício**
19. **Monitor KDS (Kitchen Display System) e Gestão Visual de Produção**
20. **Tabela Oficial de Zonas de Frete de Tangará da Serra MT**
21. **Impressão Térmica de Comandas (ESC/POS 80mm) e Acerto de Motoboys**
22. **Lei do Salão Parceiro (Lei 13.352/2016) e EFD-Reinf (Evento R-4010)**
23. **Auditoria Preventiva DIMP vs Fiscal e Eliminação de Malha Fina SEFAZ**
24. **Supply Chain, Cotação de Fornecedores RFQ e Comparativo CIF vs FOB**
25. **Conferência Cega 3-Way Matching (PO x MD-e x Estoque Físico)**
26. **Procedimento de Cancelamento e Estorno Coordenado de Comandas Finalizadas no Caixa**
27. **Regras Oficiais de Comissionamento: Bebidas & Bar (0%) vs. Cosméticos de Revenda (10%)**

---

## 1. VISÃO GERAL E ARQUITETURA DA SOLUÇÃO KYTTO

O **Kytto ERP Enterprise** é um ecossistema corporativo completo de gestão comercial, financeira, fiscal e operacional, concebido para atender negócios com alta demanda de balcão (barbearias, salões de beleza, varejo, bares e prestadores de serviços) tanto no modelo **SaaS em Nuvem** quanto em **Instalações Soberanas On-Premise** (locais via Docker Compose).

Diferente dos sistemas tradicionais de mercado (TOTVS, Linx, Trinks, Avec) que cobram percentuais sobre o faturamento ou obrigam a contratação de gateways proprietários de alto custo, o Kytto introduz a **Liberdade de Adquirente**, permitindo que o empresário conecte diretamente as máquinas de cartão da sua preferência (Stone, PagBank, Vero/Sicredi, Cielo, Rede, Getnet, SafraPay), negociando as melhores taxas MDR do mercado.

### Arquitetura de Comunicação em Malha Fechada

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRENTE DE CAIXA / BALCÃO                        │
│   Comanda Aberta ──> Seleção do Serviço/Produto ──> Envio ao Pinpad    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    PROTOCOLO TEF DEDICADO KYTTO                        │
│   Comunicação Direta via USB/Serial, TCP/IP Local ou Wi-Fi Cloud POS   │
│   (Stone Smart P2 · Moderninha Pro 2 · Vero POS · Gertec PPC930)      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│         RAZÃO CONTÁBIL          │   │      FISCAL SEFAZ-MT / SEFIN     │
│ Baixa com taxa MDR abatida      │   │ Emissão da NFC-e (Mod. 65) ou    │
│ Projeção do Líquido D+1 ou D+30 │   │ NF-e (Mod. 55) com grupo <card>  │
└─────────────────────────────────┘   └──────────────────────────────────┘
                         │                     │
                         └──────────┬──────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CONCILIAÇÃO BANCÁRIA AUTOMÁTICA                      │
│   Importação do Extrato OFX do Banco (Sicredi, Itaú, BB, Nubank, etc)  │
│   Cruzamento por NSU, Código de Autorização, Lote e Data de Crédito    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MÓDULO TEF MULTI-MAQUININHAS & PINPADS HOMOLOGADOS

O módulo TEF do Kytto foi desenvolvido para operar diretamente com os equipamentos físicos instalados no balcão de atendimento, sem telas intermediárias ou digitação manual de valores nas maquininhas.

### Adquirentes e Protocolos Suportados

| Adquirente | Protocolo Homologado | Modelos de Terminais | Conexão Suportada |
| :--- | :--- | :--- | :--- |
| **Stone / Ton** | Stone Connect / SiTef | Stone Smart P2, Ton T3 Pro, Gertec PPC930 | USB Serial, TCP/IP, Wi-Fi |
| **PagBank (PagSeguro)** | PlugPag / Prototec | Moderninha Pro 2, Smart 2, PAX S300 | Bluetooth, Wi-Fi Cloud, USB |
| **Vero (Sicredi Cartões)** | Vero TEF / SiTef | Vero Smart, Sicredi POS, Gertec PPC930 | TCP/IP Local, USB Serial |
| **Cielo** | Cielo LIO / SiTef | Cielo LIO V2, Flash, Ingenico Lane 3000 | TCP/IP, Wi-Fi Cloud |
| **Rede (Itaú)** | Rede TEF / SiTef | Maquininha Smart Rede, Gertec PPC920 | USB Serial, TCP/IP Local |
| **Getnet (Santander)** | Getnet TEF / SiTef | Getnet Smart, Clássica, PAX D200 | TCP/IP, Wi-Fi |
| **SafraPay** | SafraPay Connect | SafraPay Smart, Pro, Gertec PPC930 | TCP/IP Local, Wi-Fi |
| **Mercado Pago** | Point API / Webhook | Point Smart 2, Point Pro 2 | Nuvem / Wi-Fi |

---

## 3. PARAMETRIZAÇÃO E PROVISIONAMENTO DE TERMINAIS DE BALCÃO

Para acessar o painel de parametrização TEF:
1. Acesse o menu lateral e clique em **Financeiro** (`/admin/financeiro`).
2. Clique na aba **🏦 Conciliação Bancária OFX**.
3. Selecione a sub-aba **⚙️ Parametrização TEF & Terminais**.

### Identificação do Estabelecimento
O sistema carrega os dados cadastrais da empresa selecionada:
* **Razão Social:** DINO BARBEARIA LTDA
* **CNPJ Oficial:** `50.073.355/0002-60`
* **Inscrição Municipal:** `30297` (Tangará da Serra / MT)
* **Adquirente Padrão do Caixa:** Escolha a adquirente que será selecionada por padrão nas vendas (ex: Stone / Ton).

### Evidência em Produção: Terminais Provisionados e Teste de Ping
![Parametrização TEF e Terminais](/home/ubuntu/agro-open/docs/prints/21-tef-parametrizacao-dino-terminais.png)

### Passo a Passo para Provisionar um Novo Pinpad
Ao clicar no botão azul **+ Provisionar Novo Pinpad**, um modal interativo é exibido:
1. **Nome de Identificação:** Defina um apelido claro para a equipe (ex: *Pinpad Caixa 02 / Balcão Extra*).
2. **Adquirente:** Selecione a credenciadora correspondente (ex: *Stone, PagBank, Sicredi Vero, Cielo*).
3. **Modelo do Equipamento:** Escolha entre os modelos homologados (Gertec PPC930, PAX, Ingenico, Moderninha Pro).
4. **Número de Série (Serial):** Informe o número gravado atrás da maquininha para rastreabilidade fiscal.
5. **Localização / Setor:** Identifique o ponto físico (ex: *Balcão Central, Bar & Atendimento, Sala Vip*).
6. **Tipo de Conexão:**
   * *USB / Serial + TCP:* Ideal para pinpads conectados diretamente no computador do caixa.
   * *Wi-Fi / Cloud POS:* Para maquininhas sem fio que recebem comandos via rede sem fio.
   * *TCP / IP Local:* Para pinpads de rede com IP fixo no roteador local.
7. **IP / Porta ou Canal:** Preencha o endereço de comunicação (ex: `192.168.1.150:4000`).
8. Clique em **Provisionar Pinpad**.

### Evidência em Produção: Modal de Provisionamento de Pinpad
![Modal Provisionar Novo Pinpad](/home/ubuntu/agro-open/docs/prints/23-tef-modal-provisionar-pinpad.png)

---

## 4. MATRIZ DE TAXAS MDR E PROJEÇÃO DO LÍQUIDO

O ERP Kytto conta com uma **Matriz de Taxas MDR Dinâmica**. Cada adquirente cadastrada possui campos editáveis para as taxas negociadas pelo lojista.

### Tabela de Taxas Homologada para a Barbearia Dino

| Adquirente / Maquininha | Débito % | Crédito à Vista % | Crédito 2x a 6x % | Crédito 7x a 12x % | Pix no TEF % | Prazo Débito | Prazo Crédito |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Stone / Ton** | 1.15% | 2.19% | 2.99% | 3.69% | 0.00% | D+1 | D+30 |
| **PagBank / PagSeguro** | 1.25% | 2.39% | 3.19% | 3.99% | 0.00% | D+0 (Na hora) | D+30 |
| **Cielo** | 1.29% | 2.49% | 3.29% | 3.99% | 0.59% | D+1 | D+30 |
| **Rede (Itaú)** | 1.19% | 2.29% | 3.09% | 3.79% | 0.49% | D+1 | D+30 |
| **Getnet (Santander)** | 1.29% | 2.39% | 3.19% | 3.89% | 0.55% | D+1 | D+30 |

### Evidência em Produção: Matriz de Taxas MDR Negociadas
![Matriz de Taxas MDR](/home/ubuntu/agro-open/docs/prints/22-tef-matriz-taxas-mdr-negociadas.png)

---

## 5. OPERAÇÃO DE BALCÃO E FECHAMENTO DE COMANDAS VIA TEF

A operação de recebimento é projetada para ser rápida e à prova de falhas:

1. **Abertura da Comanda:** O operador seleciona o cliente ou agendamento na agenda visual ou no painel de comandas.
2. **Conferência dos Itens:** Serviços executados e produtos consumidos no bar são listados e consolidados.
3. **Recebimento via TEF:**
   * No campo *Meio de Pagamento*, escolha **TEF / Cartão no Pinpad**.
   * O sistema seleciona automaticamente o *Pinpad Balcão Principal*.
   * Escolha a modalidade (*Débito*, *Crédito à Vista* ou *Crédito Parcelado*).
   * Clique em **Enviar para a Maquininha**.
4. **Interação com o Cliente no Pinpad:**
   * O valor exato da comanda aparece no visor do terminal físico.
   * O cliente aproxima ou insere o cartão e digita a senha pessoal.
5. **Retorno Automático ao ERP:**
   * Em menos de 2 segundos, o terminal retorna o status de **AUTORIZADO**.
   * O Kytto captura o **NSU**, o **Código de Autorização** e a **Bandeira do Cartão**.
   * A comanda é finalizada, baixando os produtos do estoque e gerando a previsão de crédito líquido no razão financeiro.
6. **Impressão do Comprovante:** O sistema oferece a opção de impressão imediata da Via do Cliente e Via do Estabelecimento, além do envio automático do comprovante digital via WhatsApp.

---

## 6. CANCELAMENTO, ESTORNO E CONTINGÊNCIA OFFLINE

### Estorno no Balcão
Caso ocorra desistência ou erro de digitação:
1. No painel de Comandas Finalizadas ou na aba *Extrato TEF*, localize a transação.
2. Clique no botão **Estornar Transação TEF**.
3. O comando de estorno é enviado ao pinpad com o NSU original.
4. O cliente aproxima o mesmo cartão para confirmação do estorno pela adquirente.
5. O ERP emite o comprovante de estorno e cancela os lançamentos financeiros correspondentes.

### Contingência Offline de Maquininha
Caso a internet sofra oscilação momentânea:
* As máquinas sem fio (GPRS / 4G) continuam operando normalmente de forma autônoma.
* O operador pode fechar a comanda selecionando a opção *Cartão Manual (Contingência)* informando o NSU impresso na filipeta de papel.
* Assim que a rede for restabelecida, o ERP sincroniza a transação com a conciliação bancária automaticamente.

---

## 7. CONCILIAÇÃO BANCÁRIA INTELIGENTE E EXTRATOS OFX

O Kytto cruza diariamente os valores brutos recebidos nas comandas, desconta as taxas MDR cadastradas e audita se o banco creditou o valor líquido correto na conta bancária da empresa.

### Evidência em Produção: Painel de Conciliação Bancária OFX
![Conciliação Bancária OFX](/home/ubuntu/agro-open/docs/prints/17-financeiro-conciliacao-bancaria-ofx.png)

### Fluxo de Conciliação em 3 Passos:
1. **Upload do Arquivo OFX:** Baixe o extrato no Internet Banking do seu banco (ex: Sicredi, Itaú, Nubank) e arraste para o Kytto.
2. **Reconhecimento de Repasses de Cartão:** O sistema identifica automaticamente as linhas de crédito com descrições como `LIQ STONE`, `REDE CART`, `CIELO VENDAS`, `PAGSEGURO CRED`.
3. **Casamento Automático (Match 100%):** O algoritmo correlaciona o lote de transações do dia com o crédito bancário, alertando caso a adquirente tenha cobrado taxas acima do negociado.

---

## 8. CATÁLOGO OFICIAL DE BANCOS BRASILEIROS HOMOLOGADOS

O ERP Kytto possui integração e reconhecimento nativo de extratos para mais de 15 instituições financeiras brasileiras:

| Código | Instituição Financeira | Suporte a Extrato | Formato de Integração |
| :---: | :--- | :---: | :--- |
| **748** | **Banco Sicredi** | OFX / CNAB 240 / Pix API | Homologado com repasses Stone/Vero |
| **756** | **Banco Sicoob** | OFX / CNAB 240 / Pix API | Homologado com repasses Sipag/Stone |
| **341** | **Itaú Unibanco** | OFX / CNAB 400 / Pix API | Homologado com repasses Rede/Stone |
| **237** | **Banco Bradesco** | OFX / CNAB 400 / Pix API | Homologado com repasses Cielo/Rede |
| **033** | **Banco Santander** | OFX / CNAB 240 / Pix API | Homologado com repasses Getnet/Stone |
| **001** | **Banco do Brasil** | OFX / CNAB 240 / Pix API | Homologado com repasses Cielo/BB |
| **104** | **Caixa Econômica** | OFX / CNAB 240 | Homologado com repasses Caixa/Cielo |
| **260** | **Nu Pagamentos (Nubank)** | OFX / Extrato Digital / Pix | Homologado com Nu Pay / Stone |
| **077** | **Banco Inter** | OFX / API PJ / Pix | Homologado com Inter Pag / Granito |
| **208** | **BTG Pactual Empresas** | OFX / API Empresas | Homologado com repasses corporativos |
| **336** | **C6 Bank** | OFX / Pix API | Homologado com C6 Pay |
| **422** | **Banco Safra** | OFX / CNAB 240 | Homologado com SafraPay |

---

## 9. MÓDULO FISCAL: NFC-E SEFAZ-MT, NF-E 55 E PACOTE CONTÁBIL ZIP

O Kytto emite e transmite documentos fiscais em estrita conformidade com a legislação tributária brasileira e estadual (SEFAZ-MT):

### Evidência em Produção: Painel Fiscal do Emitente Dino
![Painel Fiscal Emitente Dino](/home/ubuntu/agro-open/docs/prints/14-fiscal-emitente-dino-oficial.png)

### DANFE NFC-e Autorizada em Produção
Cada comanda paga pode emitir instantaneamente a NFC-e (modelo 65) autorizada diretamente nos servidores da SEFAZ Mato Grosso:

![DANFE NFC-e Autorizada SEFAZ-MT](/home/ubuntu/agro-open/docs/prints/15-danfe-nfce-autorizada-sefaz-mt.png)

### Pacote Contábil Mensal em ZIP
Na virada de cada mês, o contador da empresa pode acessar a rota `/api/admin/fiscal/contador/zip` ou clicar no botão **Baixar Pacote do Contador (ZIP)**, obtendo:
* Todos os XMLs de NFC-e e NF-e autorizados;
* Todos os XMLs de cancelamento e eventos fiscais;
* Relatório sintético em CSV com totais de faturamento e impostos destacados;
* DANFEs consolidados em PDF.

---

## 10. GOVERNANÇA E ISOLAMENTO ESTRITO MULTI-TENANT

O Kytto garante isolamento absoluto entre diferentes inquilinos e empresas da plataforma:

### Matriz de Perfis e Permissões

| Perfil de Usuário | Empresa Vinculada | Escopo de Visualização | Acesso a Holding e Outras Marcas |
| :--- | :--- | :--- | :---: |
| **Rodrigo Gonçalves** (`rrodrigogon`) | Superadmin Global | Todas as empresas (Dino, Stallone, Agro Open) | **Permitido (Visão Consolidada)** |
| **Guilherme Cunha** (`dino`) | Barbearia Dino | Única e exclusivamente Barbearia Dino | **Bloqueado (403 Forbidden)** |
| **Silvester Stallone** (`stallone`) | Stallone Nutre Sport | Única e exclusivamente Stallone & Agro Open | **Bloqueado para Barbearia Dino** |

### Evidência em Produção: Isolamento do Tenant Barbearia Dino
![Isolamento Multi-Tenant Barbearia Dino](/home/ubuntu/agro-open/docs/prints/05-empresas-isolamento-tenant-dino.png)

---

## 11. COPILOT KYTTO ADVISOR, AGENTE T-REX E AUTOMAÇÕES

### IA Advisor Executivo
O Copilot Executivo analisa as vendas e receitas diárias, prevê o fechamento mensal e simula cenários *what-if* para expansão de margem e faturamento:

![Kytto Advisor Forecast e Simulador](/home/ubuntu/agro-open/docs/prints/11-ia-advisor-forecast-simulador.png)

### Agente T-Rex de Atendimento WhatsApp
O agente inteligente atende clientes 24 horas por dia, realiza agendamentos na agenda visual, confirma horários e respeita a tabela oficial de serviços sem intervenção manual.

### Motor de Automações Corporativas
Dispara réguas de cobrança amigáveis, lembretes de retorno para clientes inativos há mais de 30 dias e briefings noturnos para a gestão:

![Catálogo Corporativo de Automações](/home/ubuntu/agro-open/docs/prints/08-automacoes-processos-corporativos.png)

---

## 12. RESOLUÇÃO DE PROBLEMAS E CÓDIGOS DE RESPOSTA TEF

### Códigos de Erro Mais Comuns no Pinpad

| Código TEF | Descrição do Terminal | Causa Provável | Ação Corretiva Recomendada |
| :---: | :--- | :--- | :--- |
| **00** | Transação Aprovada | Pagamento autorizado com sucesso | Concluir comanda e imprimir via |
| **05** | Não Autorizada | Saldo insuficiente ou recusa do banco emissor | Solicitar outro cartão ou meio de pagamento |
| **51** | Saldo Insuficiente | Limite do cartão excedido | Oferecer divisão em 2 cartões ou Pix |
| **78** | Cartão Bloqueado | Cartão novo não desbloqueado | Orientar cliente a desbloquear no app do banco |
| **TO** | Timeout de Comunicação | Cliente demorou a digitar a senha | Clicar em "Reenviar para a Maquininha" |
| **ERR-PING**| Falha de Conexão com Pinpad | Cabo USB solto ou IP alterado na rede | Verificar cabo USB e clicar em "Testar Ping" |

---

---

## 13. EMISSÃO DE BOLETOS BANCÁRIOS REGISTRADOS COM PIX HÍBRIDO (FEBRABAN)

O ERP Kytto agora integra nativamente a emissão de boletos bancários registrados conforme as especificações da FEBRABAN para os bancos **Sicredi (748), Sicoob (756), Itaú (341), Banco do Brasil (001) e Bradesco (237)**.

### Evidência em Produção: Painel de Boletos Registrados
![Boletos Bancários Registrados Híbridos com Pix](/home/ubuntu/agro-open/docs/prints/24-fiscal-boletos-hibridos-pix.png)

### Guia Formatada com QR Code Pix Dinâmico e Código de Barras
Cada boleto gerado conta com chave Copia e Cola Pix e código de barras padrão FEBRABAN de 44 dígitos com linha digitável validada por Módulo 10 e Módulo 11:

![Guia de Boleto FEBRABAN Sicredi](/home/ubuntu/agro-open/docs/prints/27-visualizador-boleto-sicredi-pix-hibrido.png)

### Principais Recursos do Módulo de Boletos:
* **Geração Instantânea:** Emissão a partir de comandas, mensalidades de planos ou avulsa via tela administrativa.
* **Pix Dinâmico Integrado:** Permite liquidação imediata no caixa via Pix antes mesmo da compensação bancária noturna.
* **Cálculo de Juros e Multa:** Parametrização automática de 2% de multa e 1% de juros ao mês após o vencimento.

---

## 14. SIMULADOR E APURAÇÃO DE ICMS-ST PARA MATO GROSSO (RICMS-MT)

O Kytto disponibiliza para a contabilidade e gestão de compras um motor fiscal avançado para apuração de ICMS por Substituição Tributária (ICMS-ST) em Mato Grosso.

### Evidência em Produção: Memorial de Apuração de ICMS-ST MT
![Simulador e Memorial de Apuração de ICMS-ST MT](/home/ubuntu/agro-open/docs/prints/25-fiscal-icms-st-mato-grosso.png)

### Regras Fiscais Atendidas:
1. **MVA Ajustada:** Cálculo automático da Margem de Valor Agregado ajustada para operações interestaduais com alíquotas de 7%, 12% ou 4% (bens importados).
2. **Fundo de Combate à Pobreza (FCP-MT):** Adicional de 2,00% calculado e destacado separadamente.
3. **Simples Nacional vs Regime Normal:** Suporte completo aos códigos CSOSN (201, 202, 500) e CST (10, 30, 60, 70).

---

## 15. MANIFESTAÇÃO DO DESTINATÁRIO (MD-E) E ENTRADA DE NOTAS COM CUSTO MÉDIO

Para garantir a blindagem fiscal contra notas frias e manter o inventário 100% atualizado, o módulo MD-e conecta diretamente aos Web Services da SEFAZ.

### Evidência em Produção: Gestão de Notas Destinadas e Eventos SEFAZ
![Manifestação do Destinatário MD-e](/home/ubuntu/agro-open/docs/prints/26-fiscal-mde-manifestacao-destinatario.png)

### Eventos Homologados:
* **210210 - Ciência da Emissão:** Dá ciência do documento e libera o download do XML completo.
* **210200 - Confirmação da Operação:** Confirma a realização da operação e habilita a entrada automática no estoque.
* **210220 - Desconhecimento da Operação:** Informa que a empresa desconhece a transação, protegendo contra passivo fiscal indevido.
* **210240 - Operação não Realizada:** Rejeita formalmente notas onde as mercadorias não foram entregues ou foram devolvidas (exige justificativa mínima de 15 caracteres).
* **Recálculo do Custo Médio Ponderado:** Ao dar entrada no estoque, o sistema recalcula automaticamente o custo médio contábil unitário dos produtos.

---

---

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

## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL

Este manual consolida todas as rotas, telas, procedimentos e arquiteturas que colocam o **Kytto ERP Enterprise** no estado da arte da tecnologia nacional de software de gestão, garantindo robustez financeira, agilidade no balcão e conformidade contábil e fiscal para todos os inquilinos e marcas do ecossistema.

**Equipe de Engenharia Kytto**  
*Novembro de 2026*
