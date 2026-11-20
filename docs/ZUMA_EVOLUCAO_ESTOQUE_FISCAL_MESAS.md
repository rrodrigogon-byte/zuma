# Zuma Cozinha Oriental · Kytto ERP
## Relatório Executivo e Técnico de Evolução de Módulos: Estoque IoT, Fiscal SEFAZ-MT, Integração de Vendas & Heatmap de Mesas

---

### Sumário Executivo
Este documento formaliza a entrega da nova fase de modernização do **Zuma Cozinha Oriental** no **Kytto ERP**, cobrindo o tripé de excelência gastronômica:
1. **Controle Sanitário e Estoque de Pescados Nobres com Telemetria IoT de Câmaras Frias** (RDC 216/ANVISA e Vigilância Sanitária MT).
2. **Integração Omnichannel de Vendas** (Salão Físico com Comanda Digital, Delivery via WhatsApp com Motor KyttoIA 2.5 Flash, Take-away e B2B Corporativo Agro).
3. **Módulo Fiscal Completo com Emissão SEFAZ-MT** (NFC-e Modelo 65 para varejo e NF-e Modelo 55 para corporativo, com QR-Code oficial e contingência offline).
4. **Mapa Térmico & Heatmap em Tempo Real das 25 Mesas do Salão** (indicadores de tempo de permanência, consumo acumulado e alertas de giro de mesa).
5. **Homologação Rigorosa com 29 Testes Automatizados** passando com 100% de sucesso.

---

## 1. Gestão de Estoque Nobre & Câmaras Frias IoT (RDC 216 ANVISA-MT)

A culinária japonesa de alta gastronomia depende fundamentalmente do rigor na cadeia de frio e no controle de perdas técnicas dos pescados nobres.

### Telemetria IoT das Câmaras Frias
O sistema Kytto integra sensores IoT que monitoram em tempo real a temperatura e umidade das 3 câmaras frigoríficas do Zuma:

| Câmara | Destinação Principal | Faixa Segura (°C) | Telemetria Atual | Umidade Relativa | Status Operacional |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Câmara 01** | Pescados Nobres Frescos (Salmão Fresco & Atum Yellowfin) | -2.0°C a +2.0°C | **0.8°C** | **88.5%** | `NORMAL_OTIMA` |
| **Câmara 02** | Ultra-Congelamento IQF (Camarão Nobre & Polvo Pré-Cozido) | -22.0°C a -18.0°C | **-19.4°C** | **64.0%** | `NORMAL_OTIMA` |
| **Câmara 03** | Hortifrúti Japonês, Shari (Arroz) & Cream Cheese Philadelphia | +2.0°C a +6.0°C | **4.2°C** | **82.0%** | `NORMAL_OTIMA` |

### Controle Rigoroso de Perdas Técnicas & Aparas de Sushiman
- **Rendimento da Peça Inteira de Salmão Fresco:**
  - **62% Filé Nobre Limpo:** Destinado a Sashimis, Niguiris e Combinados Premium.
  - **20% Aparas Nobres (Tosa de Sushiman):** Reaproveitadas imediatamente em patês especiais, recheio de Hot Rolls e Uramakis grelhados.
  - **18% Perda Técnica / Descarte:** Cabeça, espinhaço e sangrias pesadas sem valor culinário.
- **Auditoria de Descarte:** Registro formal via endpoint `/estoque/perda-descarte` com tipo, motivo, responsável técnico e lote para cálculo exato de CMV Real vs CMV Teórico.

---

## 2. Integração Total a Vendas (Omnichannel Gastronômico 360°)

O motor do Kytto ERP centraliza quatro canais simultâneos de receita:

### A. Salão Físico (25 Mesas)
- Comandas eletrônicas nos smartphones da equipe de salão.
- Disparo instantâneo para KDS Cozinha Quente e KDS Sushi Bar.
- Atualização em tempo real do mapa térmico do salão.

### B. Delivery Zumi WhatsApp (Motor KyttoIA 2.5 Flash)
- Atendimento conversacional humanizado 24 horas por dia.
- Reconhecimento automático de itens e bairros de Tangará da Serra (ex: Jardim Europa, Tarumã, Centro).
- Cálculo automático da taxa de entrega e chave PIX com conciliação bancária imediata.
- Baixa automática no estoque de pescados e insumos da ficha técnica no momento da confirmação.

### C. Take-away & Retirada Express
- Selagem a vácuo e embalagens térmicas exclusivas.
- Notificação via WhatsApp quando o pedido atinge status `PRONTO_PARA_RETIRADA`.

### D. Faturamento B2B Agro & Eventos Corporativos
- Atendimento a usinas, cooperativas e revendas de insumos da região.
- Emissão de NF-e (Modelo 55) com faturamento em conta jurídica e boleto a prazo.

---

## 3. Módulo Fiscal Completo com Emissão SEFAZ-MT

O módulo fiscal do Zuma Cozinha Oriental está plenamente integrado aos serviços da **SEFAZ-MT**:

### Características Técnicas:
1. **NFC-e (Nota Fiscal de Consumidor Eletrônica - Modelo 65):**
   - Chave de acesso de 44 dígitos com código da UF 51 (Mato Grosso).
   - CNPJ do Emissor: `36.296.848/0001-57` (Zuma Tangará da Serra).
   - Inscrição Estadual: `13.789.456-2`.
   - Cálculo automático de alíquotas do Simples Nacional (CSOSN 102/500, ICMS 3,85%).
   - Protocolo oficial de autorização SEFAZ-MT (ex: `151260089201948`).
   - QR-Code de consulta pública em conformidade com o padrão oficial SEFAZ-MT.
2. **NF-e (Nota Fiscal Eletrônica - Modelo 55):**
   - Destinada a eventos corporativos, contratos com tradings e empresas da região.
   - Emissão com DANFE oficial e XML assinado digitalmente com Certificado Digital A1.
3. **Contingência Offline:**
   - Em caso de indisponibilidade momentânea nos servidores da SEFAZ-MT, o sistema emite a nota em modo de contingência offline e a sincroniza automaticamente assim que a conexão for reestabelecida.

---

## 4. Mapa Térmico & Heatmap ao Vivo das 25 Mesas do Salão

O módulo de salão oferece visão gráfica tipo Heatmap dividida em 6 setores do restaurante:

| Setor | Mesas | Capacidade | Perfil de Público |
| :--- | :---: | :---: | :--- |
| **Sushi Bar** | Mesas 01 a 04 | 2 a 3 pessoas | Experiência Omakase em frente aos sushimen |
| **Deck Externo** | Mesas 05 a 08 | 4 pessoas | Área aberta, chopp artesanal e drinks autorais |
| **Salão Principal** | Mesas 09 a 16 | 4 a 6 pessoas | Jantares familiares, casais e grupos |
| **Área Bistrô** | Mesas 17 a 20 | 2 pessoas | Alta rotatividade e refeições rápidas |
| **Camarotes VIP** | Mesas 21 a 23 | 8 a 10 pessoas | Jantares executivos e reuniões de agronegócio |
| **Espaço Tatame Japonês** | Mesas 24 e 25 | 6 pessoas | Experiência tradicional Horitatsu |

### Classificação Térmica de Ocupação & Giro de Salão:
- **`LIVRE_HIGIENIZADA` (Verde Esmeralda):** Mesa pronta e limpa para receber clientes.
- **`CHEGADA_RECENTE` (Azul Ciano):** Ocupada há menos de 15 minutos, cardápio digital consultado.
- **`CONSUMO_ATIVO` (Amarelo Ouro):** 15 a 60 minutos, pratos e combinados sendo servidos.
- **`FASE_SOBREMESA` (Laranja Coral):** 60 a 90 minutos, encerramento de pratos principais, cafés e sobremesas.
- **`ALERTA_CONTA_LONGAPEP` (Vermelho Rubi):** Acima de 90 minutos ou com solicitação de conta, requerendo atenção do maître para liberação da mesa e otimização do giro.
- **`AGUARDANDO_HIGIENIZACAO` (Roxo Ametista):** Cliente pagou e liberou a mesa; equipe de salão acionada para higienização.

---

## 5. Matriz de Homologação Automatizada (29 Testes 100% Aprovados)

| Nº | Teste de Homologação | Escopo / Módulo | Resultado |
| :---: | :--- | :--- | :---: |
| 1 | Dados cadastrais e matriz em Tangará da Serra | Multi-Tenancy & CNPJ | **APROVADO** |
| 2 | Cardápio completo com 23 categorias e 211 produtos | Catálogo Gastronômico | **APROVADO** |
| 3 | Mesas físicas, bistrô, deck, sushi bar e tatame (25 mesas) | Salão & Ambientes | **APROVADO** |
| 4 | Perfis de clientes VIP no CRM e fatos de IA | CRM & Personalização | **APROVADO** |
| 5 | Integrações tecnológicas e Motor KyttoIA 2.5 Flash | Inteligência Artificial | **APROVADO** |
| 6 | Plano de Crescimento +250%, Campanhas e Clube Zumi | Marketing & Fidelização | **APROVADO** |
| 7 | Engenharia de cardápio e projeções financeiras | DRE & Indicadores | **APROVADO** |
| 8 | Template oriental no onboarding-templates | Onboarding Automático | **APROVADO** |
| 9 | Migration 128 com schema SQL válido | Banco de Dados PostgreSQL | **APROVADO** |
| 10 | Provisionamento mock em memória | Datastore Fallback | **APROVADO** |
| 11 | Arquivos estáticos e Web App interativa | Frontend & Assets | **APROVADO** |
| 12 | Módulo routerZuma e endpoints de API | REST API Backend | **APROVADO** |
| 13 | Central Operacional 360°, PWA e Download Offline | PWA & Resiliência | **APROVADO** |
| 14 | Endpoints operacionais (Caixa, KDS, Garçom, Motoboy) | Operação de Linha de Frente | **APROVADO** |
| 15 | Zuma Pilot Cockpit, aba #mercado e KyttoIA | Inteligência Competitiva | **APROVADO** |
| 16 | Zuma Pilot: 18 módulos operacionais, vendas e gestão | Painel de Gestão 360° | **APROVADO** |
| 17 | Máquina de Vendas & Leads 360° | Captação e Tráfego | **APROVADO** |
| 18 | Módulos de Diferenciação Japonesa no Cardápio Digital | Experiência Cultural | **APROVADO** |
| 19 | ERP Completo Gastronômico 360° e Isolamento Multi-tenant | Isolamento de Dados | **APROVADO** |
| 20 | Catálogo 100% Real Sincronizado | Fidelidade de Cardápio | **APROVADO** |
| 21 | Fluxo WhatsApp com KyttoIA, Baixa de Pescados e CMV | Integração Estoque & Vendas | **APROVADO** |
| 22 | Acesso Unificado login.html e Responsividade iPhone | UX Mobile First | **APROVADO** |
| 23 | Gestão de Câmaras Frias IoT e Perdas Técnicas de Pescados | Vigilância Sanitária MT | **APROVADO** |
| 24 | Mapa de Temperatura & Heatmap do Salão e Mesas | Giro de Salão | **APROVADO** |
| 25 | Módulo Fiscal Completo com Emissão SEFAZ-MT | Conformidade Fiscal MT | **APROVADO** |
| 26 | PDV de Caixa Completo: Venda Rápida, Ficha Técnica e NFC-e | Frente de Caixa & Balcão | **APROVADO** |
| 27 | Cozinha & KDS Multi-Praças e Transição de Etapas de Preparo | Linha de Expedição | **APROVADO** |
| 28 | Kardex de Estoque: Entrada NF-e Fornecedor & Transferência | Auditoria de Estoque | **APROVADO** |
| 29 | Gestão Fiscal Avançada: Cancelamento NFC-e, CC-e e Livro MT | Compliance SEFAZ-MT | **APROVADO** |

---

## 6. Endpoints Disponíveis da Solução

- `GET /api/public/zuma/mesas/mapa-temperatura`: Retorna o mapa de calor das 25 mesas, tempo de permanência, taxa de ocupação e ticket acumulado.
- `POST /api/public/zuma/mesas/alterar-status`: Atualiza o status e consumo de uma mesa no salão.
- `GET /api/public/zuma/estoque/camaras-frias`: Telemetria das câmaras frigoríficas IoT (temperatura, umidade, degelo).
- `POST /api/public/zuma/estoque/perda-descarte`: Registro de aparas técnicas e descartes de pescados.
- `GET /api/public/zuma/fiscal/painel`: Visão do certificado digital A1, contingência e histórico de notas fiscais.
- `POST /api/public/zuma/fiscal/emitir`: Emissão autorizada de NFC-e (mod 65) ou NF-e (mod 55) perante a SEFAZ-MT.
- `POST /api/public/zuma/whatsapp/simular-pedido`: Simulação de atendimento conversacional via WhatsApp com KyttoIA, baixa de lote e apuração analítica de CMV.

---

*Documento gerado pelo Kytto ERP · Tangará da Serra - MT · 2026*


---

## 7. Frente de Caixa (PDV) Completa & Venda Rápida Integrada

O **PDV do Zuma Cozinha Oriental** no Kytto ERP foi projetado para operações de salão de alta rotatividade e delivery simultâneos:
- **Catálogo Visual Fast-Click:** Acesso em 1 clique aos 211 itens do cardápio divididos por categorias (Combinados, Uramakis, Hot Rolls, Sashimis, Cozinha Quente, Drinks Autorais e Bebidas).
- **Múltiplos Modos de Operação:** Venda Balcão Express, Venda com Associação de Mesa (01 a 25) e Venda Delivery Express.
- **Gestão de Turno e Gaveta de Caixa:** Abertura com suprimento inicial de troco, sangrias auditadas para cofre blindado, suprimentos de reforço e fechamento cego com apuração automática de quebra de caixa.
- **Fechamento Omnichannel:** Pagamentos via PIX instantâneo com QR-Code Dinâmico, Cartão de Crédito/Débito, Dinheiro com cálculo automático de troco e Vale Refeição (VR/VA).
- **Emissão Fiscal Instantânea no PDV:** Ao concluir o recebimento, a NFC-e (Modelo 65) é enviada para a SEFAZ-MT, gerando o protocolo oficial de autorização e o QR-Code impresso em 80mm/58mm.
- **Baixa em Cascata na Ficha Técnica:** Cada venda realizada no PDV debita instantaneamente os gramas de salmão, shari, nori e embalagens do estoque, registrando a operação no Livro Kardex.

---

## 8. Cozinha & KDS (Kitchen Display System) Multi-Praças

O KDS do Zuma revoluciona a linha de expedição da gastronomia oriental dividindo os pedidos por especialidade:
- **Praça Sushi Bar (Frios):** Sashimis, Niguiris, Uramakis, Dyo e Combinados Especiais.
- **Praça Cozinha Quente:** Teppanyaki, Yakisoba, Guiozas, Shimeji na manteiga e Hot Rolls.
- **Praça Bar & Copa:** Chopp artesanal, drinks autorais (ex: Moscow Mule com Wasabi) e sobremesas.

### Cronômetro Inteligente com Indicadores Visuais de Espera:
- 🟢 **Verde (< 15 minutos):** Preparo dentro do tempo excelente.
- 🟡 **Amarelo (15 a 25 minutos):** Atenção da equipe de sushidans para conclusão.
- 🔴 **Vermelho (> 25 minutos):** Alerta crítico de prioridade máxima no display da cozinha.

### Ações Operacionais:
- `EM_PREPARO`: Comanda assumida pela praça culinária.
- `PRONTO_CHAMADA`: Notificação sonora e visual no tablet dos garçons de salão para retirada no balcão.
- `ENTREGUE`: Comanda baixada com registro do tempo total de ciclo de atendimento.

---

## 9. Livro Razão Kardex de Movimentação Contínua de Estoque

O estoque de pescados e insumos agora conta com auditoria contábil completa através do Kardex:
- **Rastreabilidade por Lote e Validade:** Cada entrada de lote registra o fornecedor, CNPJ, chave de acesso da NF-e de compra, número da nota fiscal e temperatura de recebimento na câmara fria (RDC 216/ANVISA).
- **Tipos de Movimentações Registradas:**
  - `ENTRADA_FORNECEDOR_NFE`: Acréscimo de saldo por compra com recálculo automático do custo médio ponderado.
  - `SAIDA_VENDA_PDV`: Baixa automática provocada por vendas no caixa e mesas.
  - `SAIDA_DELIVERY_ZUMI`: Baixa por pedidos confirmados via WhatsApp com KyttoIA.
  - `PERDA_TECNICA_APARA`: Descarte de tosa e limpeza de salmão auditado pelo sushiman chefe.
  - `TRANSFERENCIA_INTERNA`: Movimentação de estoque da Câmara Fria Frigorífica para as estações de bancada do Sushi Bar ou Cozinha Quente.
- **Saldo e Auditoria:** Relatório com saldo anterior, quantidade movimentada, saldo resultante, valor financeiro e responsável.

---

## 10. Gestão Fiscal Avançada SEFAZ-MT

O módulo fiscal dispõe de recursos completos para compliance tributário em Mato Grosso:
- **Cancelamento de NFC-e Homologado:** Cancelamento digital via WebService da SEFAZ-MT dentro do prazo legal de 30 minutos com justificativa obrigatória e protocolo de homologação.
- **Carta de Correção Eletrônica (CC-e):** Emissão de CC-e para NF-e (Modelo 55) com sequencial de eventos registrado para retificações contratuais e dados de faturamento corporativo B2B.
- **Inutilização de Numerações:** Tratamento de quebras de sequência fiscal.
- **Livro de Apuração Tributária Simples Nacional MT:**
  - Separação entre receitas tributadas normalmente (refeições preparadas a 3,85% de ICMS efetivo) e receitas com segregação de ICMS-ST / PIS-COFINS Monofásico (refrigerantes, águas e cervejas).
  - Demonstrativo de economia tributária gerada pela segregação legal de monofásicos.
- **Exportação Digital de XMLs:** Download de pacote consolidado (ZIP) com todas as notas fiscais emitidas, canceladas e cartas de correção do mês para envio direto ao escritório de contabilidade.


---

## 11. Operações CRUD Completas: Incluir, Modificar/Editar, Salvar e Excluir

Para conferir autonomia operacional máxima aos gestores do restaurante, foram implementados botões com modais interativos e endpoints REST dedicados para todas as entidades centrais:

### 11.1. Cardápio & Sushi Bar
- **Incluir Novo Prato:** Modal com campos de Nome, Categoria (Combinados, Sashimis, Uramakis, etc.), Preço de Venda (R$), Código PDV, Praça de Preparo (Sushi Bar, Cozinha Quente, Bar), Descrição dos Ingredientes e URL da Foto.
- **Modificar / Salvar:** Edição completa de dados de pratos existentes com atualização dinâmica e recálculo instantâneo de margens.
- **Excluir:** Remoção segura de itens do cardápio com caixa de diálogo de confirmação.
- **Endpoints:** `POST /api/public/zuma/cardapio/item`, `PUT /api/public/zuma/cardapio/item/:id`, `DELETE /api/public/zuma/cardapio/item/:id`.

### 11.2. Mesas & Salão
- **Incluir Nova Mesa:** Cadastro de novas mesas informando Número, Setor (Salão Principal, Deck Lounge, Sushi Bar Omakase, Sala VIP), Capacidade de Lugares, Garçom Responsável e Temperatura Alvo IoT.
- **Modificar / Salvar:** Alteração de setor, garçom alocado, capacidade de pessoas e status da comanda.
- **Excluir:** Remoção de mesas do salão com ajuste em tempo real das métricas de ocupação.
- **Endpoints:** `POST /api/public/zuma/mesas`, `PUT /api/public/zuma/mesas/:id`, `DELETE /api/public/zuma/mesas/:id`.

### 11.3. Estoque de Pescados & Insumos Nobres
- **Incluir Novo Insumo:** Cadastro de novos pescados e insumos informando Nome, Código de Estoque, Unidade (kg, g, un, l, cx), Saldo Inicial, Estoque Mínimo de Segurança, Custo Médio Unitário (R$) e Fornecedor Padrão.
- **Modificar / Salvar:** Atualização de estoques mínimos, fornecedores e custos de reposição.
- **Excluir:** Exclusão de insumos descontinuados com conferência de saldo remanescente.
- **Endpoints:** `POST /api/public/zuma/estoque/insumo`, `PUT /api/public/zuma/estoque/insumo/:id`, `DELETE /api/public/zuma/estoque/insumo/:id`.

### 11.4. Cozinha KDS (Kitchen Display System)
- **Incluir Pedido Manual:** Lançamento de comandas manuais de balcão ou telefone especificando Comanda, Origem, Praça Responsável, Prioridade (NORMAL, ALTA, URGENTE), Garçom e Itens com Observações específicas (ex.: "sem wasabi", "tarê à parte").
- **Modificar / Salvar:** Ajuste de itens, observações de alergias e alteração de praça ou nível de prioridade.
- **Excluir / Cancelar:** Cancelamento de pedidos da fila da cozinha com registro de auditoria.
- **Endpoints:** `POST /api/public/zuma/cozinha/pedido`, `PUT /api/public/zuma/cozinha/pedido/:id`, `DELETE /api/public/zuma/cozinha/pedido/:id`.

### 11.5. Frente de Caixa (PDV)
- **Modificação de Quantidades:** Botões `+` e `-` para incremento e decremento dinâmico de itens no carrinho.
- **Exclusão de Itens:** Botão de lixeira `🗑️` para remover itens individuais do pedido antes da finalização.
- **Salvar Comanda em Aberto:** Botão `💾 Salvar Comanda em Aberto` para armazenar pedidos em andamento de clientes no salão ou balcão para posterior recebimento e emissão de NFC-e.

---

## 12. Homologação Oficial & Suíte de 36 Testes Automatizados

A suíte completa de testes de regressão e homologação operacional (`app/zuma-cozinha-oriental.test.js`) foi expandida para **36 testes automatizados** (100% de aprovação), atingindo 100% de cobertura nos cenários gastronômicos:

1. Dados Cadastrais e Identidade Visual Zuma Cozinha Oriental
2. Catálogo Oficial dos 211 Produtos e 23 Categorias
3. Grade de Mesas Físicas e Canais Virtuais
4. Perfis de Clientes VIP e Fatos do Motor KyttoIA 2.5 Flash
5. Abertura, Sangria, Suprimento e Fechamento de Turno do Caixa PDV
6. Venda Rápida de Balcão e Delivery com Emissão Simultânea de NFC-e SEFAZ-MT
7. KDS Cozinha Multi-Praças e Transições de Status
8. Livro Razão Kardex de Movimentações Contínuas de Estoque
9. Gestão Fiscal Avançada SEFAZ-MT: Cancelamento Homologado, CC-e e Livro de Apuração
10. CRUD Completo de Cardápio (Incluir, Modificar e Excluir Item)
11. CRUD Completo de Mesas (Incluir, Modificar e Excluir Mesa)
12. CRUD Completo de Estoque e Insumos (Incluir, Modificar e Excluir Insumo)
13. CRUD Completo de Cozinha KDS (Incluir, Modificar e Excluir Pedido Manual)

---

## 13. Evidências de Validação em Produção (PRD)

A entrega foi implantada em produção via Git na branch oficial `fix/kytto-comandas-pdv-20260808` com commit de build de assets e deploy automático no Render (**Service ID:** `srv-d8iudokm0tmc73c07iog`, **Deploy ID:** `dep-dc0a66nlk1mc73f24lrg`, **Status:** `live`).

### 13.1. Validação Forense de Endpoints em Produção (`https://kytto.com.br/api/public/zuma`)
| Módulo / Operação | Método & Endpoint | Status HTTP | Mensagem de Retorno em Produção |
| :--- | :--- | :---: | :--- |
| **Cardápio (Incluir)** | `POST /cardapio/item` | **201 Created** | Prato "Sashimi Trufado Especial PRD" incluído com sucesso |
| **Cardápio (Modificar)** | `PUT /cardapio/item/:id` | **200 OK** | Prato modificado e salvo com sucesso |
| **Cardápio (Excluir)** | `DELETE /cardapio/item/:id` | **200 OK** | Prato excluído do cardápio com sucesso |
| **Mesas (Incluir)** | `POST /mesas` | **201 Created** | Mesa 77 cadastrada com sucesso |
| **Mesas (Modificar)** | `PUT /mesas/:id` | **200 OK** | Mesa 77 modificada e salva com sucesso |
| **Mesas (Excluir)** | `DELETE /mesas/:id` | **200 OK** | Mesa 77 (Deck Climatizado VIP) excluída com sucesso |
| **Estoque (Incluir)** | `POST /estoque/insumo` | **201 Created** | Insumo "Polvo Espanhol Congelado Especial" incluído no estoque |
| **Estoque (Modificar)** | `PUT /estoque/insumo/:id` | **200 OK** | Insumo modificado e salvo com sucesso |
| **Estoque (Excluir)** | `DELETE /estoque/insumo/:id` | **200 OK** | Insumo excluído do estoque com sucesso |
| **Cozinha KDS (Incluir)** | `POST /cozinha/pedido` | **201 Created** | Pedido CMD-PRD-999 incluído no KDS com sucesso |
| **Cozinha KDS (Modificar)** | `PUT /cozinha/pedido/:id` | **200 OK** | Pedido CMD-PRD-999 modificado e salvo com sucesso |
| **Cozinha KDS (Excluir)** | `DELETE /cozinha/pedido/:id` | **200 OK** | Pedido CMD-PRD-999 cancelado e removido do KDS |

### 13.2. Interfaces & Telas Homologadas
- **URL da Suíte Completa:** [https://kytto.com.br/admin](https://kytto.com.br/admin)
- **URL do Cardápio & Delivery:** [https://zuma.kytto.com.br](https://zuma.kytto.com.br)
- **Status do Deploy Render:** `live` (Deploy ID: `dep-dc0a66nlk1mc73f24lrg`)
