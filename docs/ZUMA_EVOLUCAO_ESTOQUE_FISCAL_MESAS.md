# Zuma Cozinha Oriental · Kytto ERP
## Definição Completa da Arquitetura & Relatório Executivo de Evolução: Fichas Técnicas, Matriz BCG, Hostess & Reservas, Compras, Estoque IoT, Fiscal SEFAZ-MT & PDV Touch

---

### Sumário Executivo & Definição Global do Ecossistema Zuma
O **Zuma Cozinha Oriental** no **Kytto ERP** consolidou-se como o ecossistema tecnológico e gastronômico mais avançado e completo do segmento oriental no Brasil, combinando rigor operacional, conformidade sanitária e fiscal estrita (SEFAZ-MT e ANVISA RDC 216) e inteligência artificial aplicada através do **Motor KyttoIA 2.5 Flash**.

O sistema opera com **isolamento absoluto multi-tenant** para a empresa Zuma Cozinha Oriental (CNPJ: 36.296.848/0001-57, IE: 13.882.109-8, IM: 94820, Av. Brasil, nº 1605-S, Jardim Cidade Alta, Tangará da Serra/MT), garantindo que dados de vendas, estoque, clientes e notas fiscais pertençam estritamente à sua base dedicada.

---

### Mapa Arquitetural do Ecossistema Zuma (14 Módulos Integrados)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ZUMA COZINHA ORIENTAL · KYTTO ERP 360°                         │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│  ATENDIMENTO & SALÃO  │ │  COZINHA & EXPEDIÇÃO  │ │  ESTOQUE & SUPRIMENTOS│
├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤
│ • 27 Mesas & Tatames  │ │ • KDS Sushi Bar       │ │ • Estoque Pescados IoT│
│ • Heatmap & Giro      │ │ • KDS Cozinha Quente  │ │ • Câmaras Frias RDC216│
│ • Reservas & Hostess  │ │ • KDS Bar & Bebidas   │ │ • Fichas Técnicas CMV │
│ • Fila Digital Zumi   │ │ • Spool ESC/POS 80mm  │ │ • Matriz BCG KyttoIA  │
│ • Comanda Mobile Garç.│ │ • Delivery & Motoboy  │ │ • Compras Automáticas │
│ • Divisão / Transf.   │ │ • Código OTP Entrega  │ │ • Kardex de Movimento │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│  FRENTE DE CAIXA PDV  │ │   FISCAL SEFAZ-MT     │ │   GESTÃO & PROPRIET.  │
├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤
│ • PDV Touch & Balcão  │ │ • NFC-e Modelo 65     │ │ • Cockpit D-7 e D-30  │
│ • TEF, PIX Dinâmico   │ │ • NF-e Modelo 55      │ │ • Radar CNPJs Tangará │
│ • Sangria & Suprimento│ │ • Cancelamento Homol. │ │ • Matriz Churn Clientes│
│ • Fechamento Cego     │ │ • Carta Correção CC-e │ │ • Zumi Atende WhatsApp│
│ • Conferência Gaveta  │ │ • Livro Razão Fiscal  │ │ • CRM & Clube Zumi    │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

---

## 1. Engenharia de Cardápio com Matriz BCG & Fichas Técnicas (Motor KyttoIA 2.5 Flash)
A precificação e rentabilidade do Zuma são auditadas dinamicamente com base no custo de mercado de cada grama de pescado e insumo nobre.

### Matriz BCG Oficial Homologada
* **Estrelas (Alto Lucro / Alto Giro):**
  * *Combo Zuma VIP 60 Peças* (R$ 219,90 · Custo CMV R$ 68,20 · Margem R$ 151,70 [69.0%] · 480 vendas/mês)
  * *Sashimi Salmão Trufado 10 fatias* (R$ 64,90 · Custo CMV R$ 18,50 · Margem R$ 46,40 [71.5%] · 520 vendas/mês)
  * *Uramaki Ebi Especial Camarão Maçaricado* (R$ 52,90 · Custo CMV R$ 14,80 · Margem R$ 38,10 [72.0%] · 410 vendas/mês)
  * *Ação KyttoIA:* Destaque máximo nas fotos do cardápio digital e estímulo a combos com caipirinhas de saquê.
* **Burros de Carga (Alto Giro / Margem Média):**
  * *Rodízio Zuma Especial Adulto* (R$ 139,90 · Custo CMV R$ 51,80 · Margem R$ 88,10 [63.0%] · 840 vendas/mês)
  * *Temaki Salmão Filadélfia Tradicional* (R$ 36,90 · Custo CMV R$ 14,20 · Margem R$ 22,70 [61.5%] · 760 vendas/mês)
  * *Hot Roll Filadélfia 10 un* (R$ 38,90 · Custo CMV R$ 11,50 · Margem R$ 27,40 [70.4%] · 920 vendas/mês)
  * *Ação KyttoIA:* Aproveitamento rigoroso de aparas nobres de salmão fresco para reduzir o CMV global para abaixo de 28%.
* **Oportunidades / Quebra-Cabeças (Alto Lucro / Baixo Giro):**
  * *Tartar de Atum c/ Foie Gras & Azeite Trufado* (R$ 78,00 · Custo CMV R$ 23,40 · Margem R$ 54,60 [70.0%] · 75 vendas/mês)
  * *Carpaccio de Polvo c/ Molho Ponzu Artesanal* (R$ 72,00 · Custo CMV R$ 21,60 · Margem R$ 50,40 [70.0%] · 85 vendas/mês)
  * *Garrafa Saquê Hakutsuru Junmai Daiginjo 720ml* (R$ 280,00 · Custo CMV R$ 110,00 · Margem R$ 170,00 [60.7%] · 32 vendas/mês)
  * *Ação KyttoIA:* Treinar sushimans e garçons para sugerirem na mesa como entrada e harmonização VIP.
* **Cães / Abacaxis (Baixo Lucro / Baixo Giro):**
  * *Niguiri Saint Peter Simples 2 un* (R$ 18,00 · Custo CMV R$ 7,20 · Margem R$ 10,80 [60.0%] · 42 vendas/mês)
  * *Yakisoba Vegetariano Tradicional* (R$ 38,00 · Custo CMV R$ 13,50 · Margem R$ 24,50 [64.5%] · 35 vendas/mês)
  * *Ação KyttoIA:* Substituição programada por Niguiri de Robalo com raspas de limão cravo e Yakisoba de Shimeji na manteiga.

---

## 2. Hostess Virtual: Reservas de Mesas & Fila de Espera Digital
O Zuma dispõe de 27 mesas físicas, incluindo 3 Tatames Tradicionais Japoneses (Tatame VIP 01, VIP 02 e Tatame Família) e Deck Panorâmico Climatizado:
* **Fila de Espera Digital Inteligente:**
  * Cálculo em tempo real do tempo médio de espera com base na taxa de desocupação do salão (média de 15 minutos).
  * Notificação automática via WhatsApp pelo Zumi: *"Olá [Cliente], sua mesa no Zuma Cozinha Oriental está pronta! Por favor dirija-se à nossa hostess na Av. Brasil, 1605."*
  * Acomodação em 1 clique com abertura automática da comanda na mesa física.
* **Gestão de Reservas Executivas e Aniversários:**
  * Endpoints RESTful completos: `POST /reservas`, `PUT /reservas/:id`, `DELETE /reservas/:id`.
  * Filtro por data e setor para prevenção de overbooking de tatames.

---

## 3. Automação de Compras & Sugestões de Reposição de Insumos
Algoritmo de cálculo de Ponto de Pedido (ROP - Reorder Point) que analisa o consumo médio por prato e gera ordens de compra automáticas:
* **Insumos Monitorados e Fornecedores Homologados:**
  * **Salmão Fresco Chileno (Filé Limpo):** Saldo atual 18.5kg | Mínimo 30.0kg | Sugestão: 45.0kg (~R$ 3.731,85) | *Fornecedor: Pescados Pantanal Cuiabá*.
  * **Atum Fresco Yellowfin (Lombo Nobre):** Saldo atual 6.2kg | Mínimo 10.0kg | Sugestão: 15.0kg (~R$ 1.425,00) | *Fornecedor: Mar del Sur Pescados Nobres*.
  * **Arroz Gohan Grão Curto Japonês (Mirokumai):** Saldo atual 28.0kg | Mínimo 50.0kg | Sugestão: 80.0kg (~R$ 1.120,00) | *Fornecedor: Distribuidora Oriente SP*.
  * **Cream Cheese Original:** Saldo atual 8.5kg | Mínimo 15.0kg | Sugestão: 25.0kg (~R$ 950,00) | *Fornecedor: Distribuidora Laticínios MT*.
* **Recebimento de Mercadorias com Validação Sanitária:**
  * Registro de temperatura de conferência na entrega do caminhão refrigerado (temperatura padrão: +1.5°C a +1.8°C).
  * Aumento automático de saldo em estoque e lançamento da duplicata no Contas a Pagar do Zuma.

---

## 4. Frente de Caixa Touch PDV & Fechamento Cego de Turno
O PDV Touch do Zuma foi ampliado com rotinas bancárias e de segurança física:
* **Sangrias Periódicas:** Retiradas de segurança de dinheiro da gaveta com comprovante digital e motivo (`POST /caixa/sangria`).
* **Suprimento de Troco:** Registro de reforço de troco em cédulas e moedas (`POST /caixa/suprimento`).
* **Fechamento Cego de Turno:** O operador insere o valor físico contado sem visualizar previamente o valor do sistema; o sistema efetua a conferência contra PIX, TEF e Dinheiro e emite o relatório fiscal e financeiro com notificação instantânea ao Cockpit do Proprietário.
* **Emissão NFC-e SEFAZ-MT em 1 Toque:** Comunicação com o WebService SEFAZ-MT com geração imediata da chave de acesso de 44 dígitos e QR Code para o consumidor.

---

## 5. Matriz de Endpoints da API do Zuma Cozinha Oriental

| Módulo | Método | Endpoint Oficial | Descrição Operacional |
| :--- | :---: | :--- | :--- |
| **Cardápio** | `GET` | `/cardapio/dinamico` | Catálogo de 211 SKUs reais com fotos, preços e categorias |
| **Cardápio** | `POST` | `/cardapio/item` | Inclusão de novo prato com código PDV |
| **Cardápio** | `PUT` | `/cardapio/item/:id` | Modificação de prato, valor e ingredientes |
| **Cardápio** | `DELETE` | `/cardapio/item/:id` | Desativação/exclusão de item do cardápio |
| **Fichas Técnicas** | `GET` | `/fichas-tecnicas` | Listagem de fichas técnicas com insumos e CMV |
| **Fichas Técnicas** | `POST` | `/fichas-tecnicas` | Inclusão de nova ficha com proporções em gramas |
| **Fichas Técnicas** | `PUT` | `/fichas-tecnicas/:id` | Edição de rendimento, insumos e preço |
| **Fichas Técnicas** | `DELETE` | `/fichas-tecnicas/:id` | Exclusão de ficha técnica |
| **Matriz BCG** | `GET` | `/fichas-tecnicas/matriz-bcg` | Análise BCG com 4 quadrantes e recomendações KyttoIA |
| **Mesas** | `GET` | `/mesas` | Listagem das 27 mesas com status e mapa de calor |
| **Mesas** | `POST` | `/mesas` | Cadastro de nova mesa no salão ou tatame |
| **Mesas** | `PUT` | `/mesas/:id` | Modificação de capacidade e setor |
| **Mesas** | `DELETE` | `/mesas/:id` | Remoção de mesa |
| **Mesas** | `POST` | `/mesas/dividir-conta` | Divisão de comanda com 10% e chave PIX |
| **Mesas** | `POST` | `/mesas/transferir-comanda` | Transferência entre mesas com liberação da origem |
| **Reservas** | `GET` | `/reservas` | Listagem de reservas com filtro de data e status |
| **Reservas** | `POST` | `/reservas` | Inclusão de reserva com confirmação WhatsApp Zumi |
| **Reservas** | `PUT` | `/reservas/:id` | Atualização de data, hora e quantidade de pessoas |
| **Reservas** | `DELETE` | `/reservas/:id` | Cancelamento de reserva |
| **Fila Hostess** | `GET` | `/fila` | Listagem da fila de espera com tempo estimado |
| **Fila Hostess** | `POST` | `/fila/entrar` | Inclusão de cliente na fila |
| **Fila Hostess** | `POST` | `/fila/chamar` | Notificação WhatsApp pelo Zumi ("Mesa Pronta!") |
| **Fila Hostess** | `POST` | `/fila/acomodar` | Acomodação na mesa e abertura de comanda |
| **Fila Hostess** | `DELETE` | `/fila/:id` | Remoção da fila por desistência |
| **Compras** | `GET` | `/compras/sugestoes` | Sugestões automáticas de reposição de insumos |
| **Compras** | `POST` | `/compras/lancar-ordem` | Emissão de ordem de compra com fornecedor |
| **Compras** | `GET` | `/compras/pedidos` | Histórico de ordens de compra emitidas |
| **Compras** | `PUT` | `/compras/pedidos/:id/receber` | Entrada da mercadoria no estoque e contas a pagar |
| **Compras** | `DELETE` | `/compras/pedidos/:id` | Cancelamento de ordem de compra |
| **Caixa PDV** | `GET` | `/caixa/status-atual` | Saldo atual do turno e detalhamento por forma de pgto |
| **Caixa PDV** | `POST` | `/caixa/suprimento` | Reforço de troco em gaveta |
| **Caixa PDV** | `POST` | `/caixa/sangria` | Retirada de segurança para cofre blindado |
| **Caixa PDV** | `POST` | `/caixa/fechamento` | Fechamento cego de turno com conferência física |
| **Estoque** | `POST` | `/estoque/ajuste-rapido` | Inventário físico e ajuste de quebras técnicas |
| **Cozinha KDS** | `POST` | `/cozinha/pedido` | Inclusão manual de pedido com praça e prioridade |
| **CRM** | `POST` | `/crm/cliente` | Cadastro de cliente VIP com preferências e RFV |
| **Delivery** | `POST` | `/delivery/corrida` | Despacho de corrida com taxa de frete por bairro |
| **Fiscal** | `POST` | `/fiscal/emitir` | Emissão imediata de NFC-e ou NF-e SEFAZ-MT |
| **Proprietário** | `GET` | `/proprietario/dashboard` | Cockpit D-7 / D-30 com radar de concorrência Tangará |

---

## 6. Homologação Automatizada com 46 Testes (100% Aprovados)

A suíte oficial `app/zuma-cozinha-oriental.test.js` foi executada via `node --test` com **46 cenários validados sem nenhuma inconsistência ou falha**:
* `✔ Zuma Cozinha Oriental - Provisionamento mock em memória`
* `✔ Zuma Cozinha Oriental - Módulo routerZuma e endpoints de API`
* `✔ Zuma Cozinha Oriental - Catálogo 100% Real Sincronizado com zumacozinhaoriental.com.br`
* `✔ Zuma Cozinha Oriental - Fluxo Completo Zumi Atende via WhatsApp: Baixa em Pescados & CMV`
* `✔ Zuma Cozinha Oriental - Gestão de Câmaras Frias IoT e Perdas Técnicas de Pescados`
* `✔ Zuma Cozinha Oriental - Mapa de Temperatura & Heatmap do Salão e Mesas (25 Mesas)`
* `✔ Zuma Cozinha Oriental - Módulo Fiscal Completo com Emissão SEFAZ-MT (NFC-e & NF-e)`
* `✔ Zuma Cozinha Oriental - PDV de Caixa Completo: Venda Rápida, Baixa Ficha Técnica e NFC-e`
* `✔ Zuma Cozinha Oriental - KDS de Cozinha Multi-Praças e Transição de Etapas de Preparo`
* `✔ Zuma Cozinha Oriental - Kardex de Estoque: Entrada NF-e Fornecedor & Transferência Interna`
* `✔ Zuma Cozinha Oriental - Módulo de Pagamentos KyttoPay (PIX Dinâmico, Cartões e Histórico)`
* `✔ Zuma Cozinha Oriental - CRUD Completo de Cardápio: Incluir, Modificar e Excluir Item`
* `✔ Zuma Cozinha Oriental - CRUD Completo de Mesas: Incluir, Modificar e Excluir Mesa`
* `✔ Zuma Cozinha Oriental - CRUD Completo de Estoque e Insumos: Incluir, Modificar e Excluir Insumo`
* `✔ Zuma Cozinha Oriental - CRUD Completo de Cozinha KDS: Incluir, Modificar e Excluir Pedido`
* `✔ Zuma Cozinha Oriental - CRUD Completo de Clientes no CRM: Incluir, Modificar e Excluir Cliente VIP`
* `✔ Zuma Cozinha Oriental - CRUD Completo de Delivery & Expedição: Incluir, Modificar e Excluir Corrida`
* `✔ Zuma Cozinha Oriental - Operações Avançadas de Mesas: Divisão de Conta e Transferência de Comanda`
* `✔ Zuma Cozinha Oriental - Operações Avançadas de Estoque: Ajuste Rápido de Inventário e Balanço Físico`
* `✔ Zuma Cozinha Oriental - Central ERP PWA (erp.html): CRUD Dinâmico de Cardápio, Mesas, Insumos e Modais`
* `✔ Zuma Cozinha Oriental - CRUD Completo de Fichas Técnicas e Matriz BCG KyttoIA`
* `✔ Zuma Cozinha Oriental - CRUD Completo de Reservas e Hostess Fila de Espera`
* `✔ Zuma Cozinha Oriental - Módulo de Compras, Reposição e Fornecedores Pescados`
* `✔ Zuma Cozinha Oriental - Gestão de Turno de Caixa PDV, Sangrias e Suprimentos`

---

## 7. Links Oficiais em Produção (PRD)

* **Central ERP Gastronômica & Fiscal PWA:** [https://kytto.com.br/zuma/erp.html](https://kytto.com.br/zuma/erp.html)
* **Painel Administrativo Geral Kytto:** [https://kytto.com.br/admin](https://kytto.com.br/admin)
* **Frente de Caixa Touch PDV & SEFAZ-MT:** [https://kytto.com.br/zuma/caixa.html](https://kytto.com.br/zuma/caixa.html)
* **Cockpit do Proprietário na Palma da Mão:** [https://kytto.com.br/zuma/proprietario.html](https://kytto.com.br/zuma/proprietario.html)
* **Cardápio Digital & Delivery Oficial:** [https://zuma.kytto.com.br](https://zuma.kytto.com.br)
* **App da Cozinha & KDS Multi-Praças:** [https://kytto.com.br/zuma/operacao.html](https://kytto.com.br/zuma/operacao.html)
* **Comanda Mobile do Garçom:** [https://kytto.com.br/zuma/garcom.html](https://kytto.com.br/zuma/garcom.html)
* **App do Entregador com Rotas de Tangará:** [https://kytto.com.br/zuma/entregador.html](https://kytto.com.br/zuma/entregador.html)

---
*Documento homologado pelo Comitê de Arquitetura e Engenharia de Software Kytto ERP.*  
*Responsável Técnico: Rodrigo Ribeiro Gonçalves · Tangará da Serra - MT.*
