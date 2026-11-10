# MANUAL OPERACIONAL E ADMINISTRATIVO
# ERP KYTTO ENTERPRISE & TEF MULTI-MAQUININHAS
**Guia Oficial de Operação de Balcão, Parametrização TEF, Conciliação Bancária OFX, Gestão Fiscal SEFAZ-MT e Governança Multi-Tenant**

---

**Empresa Referência:** DINO BARBEARIA LTDA (CNPJ 50.073.355/0002-60 · IM 30297 · Tangará da Serra / MT)  
**Plataforma Homologada:** Kytto Cloud & On-Premise Enterprise  
**Versão do Documento:** 2.5 (Edição Homologada de Produção)  
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

## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL

Este manual consolida todas as rotas, telas, procedimentos e arquiteturas que colocam o **Kytto ERP Enterprise** no estado da arte da tecnologia nacional de software de gestão, garantindo robustez financeira, agilidade no balcão e conformidade contábil e fiscal para todos os inquilinos e marcas do ecossistema.

**Equipe de Engenharia Kytto**  
*Novembro de 2026*
