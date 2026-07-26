# 📚 DOCUMENTAÇÃO TÉCNICA DETALHADA - KYTTO ERP

**Versão:** 1.0  
**Data:** Julho 2024  
**Autor:** Manus AI  
**Status:** Produção

---

## 📑 Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Módulos Setoriais](#módulos-setoriais)
3. [Módulos Transversais](#módulos-transversais)
4. [Adaptadores de Integração](#adaptadores-de-integração)
5. [Modelo de Dados](#modelo-de-dados)
6. [Fluxos de Operação](#fluxos-de-operação)
7. [Limites e Pendências](#limites-e-pendências)
8. [Guia de Operação](#guia-de-operação)

---

## 🏗️ Visão Geral da Arquitetura

### Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Backend** | Node.js + Express | 18+ |
| **Banco de Dados** | PostgreSQL | 15+ |
| **Cache** | Redis | 7+ |
| **Fila** | Bull | 4+ |
| **Autenticação** | JWT | - |
| **Containerização** | Docker | 24+ |
| **Orquestração** | Kubernetes/GCP Cloud Run | - |

### Estrutura de Diretórios

```
app/
├── core/
│   ├── auth.js (Autenticação JWT + RBAC)
│   ├── tenant.js (Multi-tenant middleware)
│   ├── database.js (Pool PostgreSQL)
│   └── security.js (PCI-DSS, LGPD, criptografia)
├── adapters/
│   ├── nfce/ (NFC-e Focus + PlugNotas)
│   └── payment/ (Stone, Cielo, PagBank, TEF, Pix)
├── modules/
│   ├── bar/ (Comanda, KDS, divisão)
│   ├── restaurante/ (Mesas, delivery)
│   ├── loja/ (PDV, comissões)
│   ├── barbearia/ (Agendamentos, serviços)
│   ├── clube/ (Membros, eventos, mensalidades)
│   ├── supermercado/ (Autoatendimento, pesagem)
│   ├── pdv/ (PDV genérico)
│   ├── estoque/ (Entrada, saída, inventário)
│   ├── clientes/ (Gestão de clientes)
│   ├── pagamentos/ (Processamento de pagamentos)
│   ├── financeiro/ (DRE, balanço, fluxo de caixa)
│   ├── billing/ (Faturamento SaaS)
│   └── relatorios/ (Dashboard BI)
├── routes/
│   ├── auth.js
│   ├── estoque.js
│   ├── vendas.js
│   ├── pagamentos.js
│   ├── nfce.js
│   └── caixa.js
├── migrations/
│   ├── 001_erp_foundation.sql (Schema PostgreSQL)
│   └── migrate-json-to-pg.js (Migração de dados)
├── tests/
│   └── api.test.js (Jest + Supertest)
├── docs/
│   └── openapi.json (Documentação Swagger)
├── db-pg.js (Interface PostgreSQL)
├── config.js (Configuração central)
├── server-v2.js (Express principal)
└── server-v2-updated.js (Versão atualizada)
```

---

## 🎯 Módulos Setoriais

### 1. BAR

**Arquivo:** `app/modules/bar/`

**Responsabilidade:** Gestão completa de bar com comanda eletrônica, Kitchen Display System (KDS) e divisão de conta.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `bar.js` | Orquestração geral | - |
| `comanda.js` | Comanda eletrônica | `abrirComanda()`, `fecharComanda()`, `cancelarComanda()`, `listarComandas()` |
| `divisao.js` | Divisão de conta | `dividirConta()`, `adicionarItemDivisao()`, `removerItemDivisao()` |
| `kds.js` | Kitchen Display System | `enviarParaKDS()`, `atualizarStatusItem()`, `marcarPronto()`, `marcarServido()` |

**Rotas:**

```
POST   /bar/comanda/abrir              # Abrir comanda
POST   /bar/comanda/:id/fechar         # Fechar comanda
POST   /bar/comanda/:id/cancelar       # Cancelar comanda
POST   /bar/comanda/:id/item           # Adicionar item
DELETE /bar/comanda/:id/item/:item_id  # Remover item
POST   /bar/comanda/:id/divisao        # Dividir conta
GET    /bar/comandas                   # Listar comandas
GET    /bar/kds                        # Ver KDS em tempo real
```

**Fluxo de Operação:**

1. Garçom abre comanda para mesa
2. Adiciona itens (bebidas, comidas)
3. Sistema envia para KDS (cozinha/bar)
4. KDS marca itens como "pronto"
5. Garçom marca como "servido"
6. Fechamento: divisão de conta se necessário
7. Pagamento processado

**Dependências:**

- `modules/pagamentos` (processamento de pagamento)
- `modules/estoque` (validação de estoque)
- `adapters/payment/*` (múltiplas adquirentes)

**Limitações Atuais:**

- ⚠️ KDS é simulado (não integrado com impressora física)
- ⚠️ Divisão de conta não suporta múltiplas formas de pagamento por divisão
- ⚠️ Sem integração com sistema de chamada de garçom

**Pendências:**

- [ ] Integração com impressora de comanda
- [ ] Integração com sistema de chamada
- [ ] Suporte a comanda com múltiplas mesas

---

### 2. RESTAURANTE

**Arquivo:** `app/modules/restaurante/`

**Responsabilidade:** Gestão de restaurante com mesas, delivery e controle de pedidos.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `restaurante.js` | Orquestração | `ocuparMesa()`, `liberarMesa()`, `criarPedidoDelivery()`, `atualizarStatusPedido()` |

**Rotas:**

```
POST   /restaurante/mesa/:id/ocupar    # Ocupar mesa
POST   /restaurante/mesa/:id/liberar   # Liberar mesa
POST   /restaurante/delivery           # Criar pedido delivery
PUT    /restaurante/pedido/:id/status  # Atualizar status
GET    /restaurante/mesas              # Listar mesas
GET    /restaurante/delivery           # Listar pedidos delivery
```

**Fluxo de Operação:**

1. Garçom ocupa mesa
2. Cria comanda (integrado com BAR)
3. Opcionalmente: cria pedido de delivery
4. Atualiza status: preparando → pronto → entregue
5. Libera mesa

**Dependências:**

- `modules/bar` (comanda)
- `modules/pagamentos` (pagamento delivery)
- `modules/estoque` (validação de estoque)

**Limitações Atuais:**

- ⚠️ Sem integração com apps de delivery (iFood, Uber Eats)
- ⚠️ Sem rastreamento de tempo de preparo
- ⚠️ Sem integração com sistema de entrega

**Pendências:**

- [ ] Integração com iFood/Uber Eats
- [ ] Rastreamento de tempo de preparo
- [ ] Notificação ao cliente (SMS/WhatsApp)

---

### 3. LOJA

**Arquivo:** `app/modules/loja/`

**Responsabilidade:** Gestão de loja com PDV, vendas e comissões automáticas.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `pdv.js` | PDV genérico | `criarVenda()`, `adicionarItem()`, `fecharVenda()` |
| `loja.js` | Orquestração | `cancelarVenda()`, `devolverProduto()` |
| `vendedor.js` | Comissões | `calcularComissao()`, `pagarComissao()`, `relatorioVendedor()` |

**Rotas:**

```
POST   /loja/venda                     # Criar venda
POST   /loja/venda/:id/item            # Adicionar item
POST   /loja/venda/:id/fechar          # Fechar venda
POST   /loja/venda/:id/cancelar        # Cancelar venda
POST   /loja/venda/:id/devolucao       # Processar devolução
GET    /loja/vendas                    # Listar vendas
GET    /loja/vendedor/:id/comissao     # Comissão do vendedor
```

**Fluxo de Operação:**

1. Vendedor cria venda
2. Adiciona produtos (com validação de estoque)
3. Aplica desconto/acréscimo
4. Fecha venda (gera NFC-e)
5. Processa pagamento
6. Sistema calcula comissão automaticamente

**Dependências:**

- `modules/estoque` (validação e saída de estoque)
- `modules/pagamentos` (processamento de pagamento)
- `modules/nfce` (emissão de NFC-e)
- `modules/clientes` (validação de crédito)

**Limitações Atuais:**

- ⚠️ Comissão é fixa (não suporta escalonamento)
- ⚠️ Sem integração com sistema de consignação
- ⚠️ Sem suporte a múltiplos centros de distribuição

**Pendências:**

- [ ] Comissão com escalonamento por volume
- [ ] Integração com sistema de consignação
- [ ] Suporte a múltiplos centros de distribuição

---

### 4. BARBEARIA

**Arquivo:** `app/modules/barbearia/`

**Responsabilidade:** Gestão de barbearia com agendamentos, serviços e faturamento.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `barbearia.js` | Orquestração | `criarAgendamento()`, `confirmarAgendamento()`, `iniciarAtendimento()` |
| `agendamento.js` | Agendamentos | `cancelarAgendamento()`, `listarAgendamentos()`, `agendaDoBarb eiro()` |
| `servico.js` | Serviços | `criarServico()`, `atualizarServico()`, `listarServicos()` |

**Rotas:**

```
POST   /barbearia/agendamento          # Criar agendamento
PUT    /barbearia/agendamento/:id      # Atualizar agendamento
POST   /barbearia/agendamento/:id/confirmar  # Confirmar
POST   /barbearia/agendamento/:id/iniciar    # Iniciar atendimento
POST   /barbearia/agendamento/:id/finalizar  # Finalizar
DELETE /barbearia/agendamento/:id      # Cancelar
GET    /barbearia/agenda/:barbeiro_id  # Agenda do barbeiro
GET    /barbearia/servicos             # Listar serviços
```

**Fluxo de Operação:**

1. Cliente agenda atendimento
2. Sistema confirma disponibilidade do barbeiro
3. Barbeiro inicia atendimento
4. Finaliza atendimento
5. Sistema gera venda e NFC-e
6. Processa pagamento

**Dependências:**

- `modules/pagamentos` (processamento de pagamento)
- `modules/nfce` (emissão de NFC-e)
- `modules/clientes` (gestão de clientes)

**Limitações Atuais:**

- ⚠️ Sem integração com sistema de avaliação de clientes
- ⚠️ Sem notificação automática de agendamento
- ⚠️ Sem suporte a pacotes/planos de fidelização

**Pendências:**

- [ ] Sistema de avaliação de clientes
- [ ] Notificação automática (SMS/WhatsApp)
- [ ] Pacotes de fidelização

---

### 5. CLUBE

**Arquivo:** `app/modules/clube/`

**Responsabilidade:** Gestão de clube com membros, eventos, mensalidades e reservas.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `clube.js` | Orquestração | `criarMembro()`, `atualizarMembro()`, `criarEvento()`, `inscreverEvento()` |

**Rotas:**

```
POST   /clube/membro                   # Criar membro
PUT    /clube/membro/:id               # Atualizar membro
POST   /clube/membro/:id/mensalidade   # Registrar mensalidade
GET    /clube/membros                  # Listar membros
POST   /clube/evento                   # Criar evento
POST   /clube/evento/:id/inscrever     # Inscrever em evento
GET    /clube/eventos                  # Listar eventos
POST   /clube/reserva                  # Criar reserva de espaço
```

**Fluxo de Operação:**

1. Membro se cadastra no clube
2. Paga mensalidade (automática ou manual)
3. Acessa eventos
4. Inscreve-se em eventos
5. Reserva espaço (salão, quadra, etc.)

**Dependências:**

- `modules/pagamentos` (cobrança de mensalidade)
- `modules/clientes` (gestão de membros)
- `modules/financeiro` (fluxo de caixa)

**Limitações Atuais:**

- ⚠️ Sem integração com app mobile para membros
- ⚠️ Sem sistema de pontos/benefícios
- ⚠️ Sem integração com sistema de acesso (catracas)

**Pendências:**

- [ ] App mobile para membros
- [ ] Sistema de pontos e benefícios
- [ ] Integração com catracas/controle de acesso

---

### 6. SUPERMERCADO

**Arquivo:** `app/modules/supermercado/`

**Responsabilidade:** Gestão de supermercado com autoatendimento, pesagem e cupons.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `supermercado.js` | Orquestração | `criarCupomAutoatendimento()`, `pesarProduto()`, `aplicarCupom()` |

**Rotas:**

```
POST   /supermercado/cupom             # Criar cupom autoatendimento
POST   /supermercado/cupom/:id/pesar   # Pesar produto
POST   /supermercado/cupom/:id/cupom   # Aplicar cupom de desconto
GET    /supermercado/cupons            # Listar cupons
```

**Fluxo de Operação:**

1. Cliente inicia compra no autoatendimento
2. Escaneia produtos
3. Pesa produtos a granel
4. Aplica cupons de desconto
5. Finaliza compra e paga

**Dependências:**

- `modules/estoque` (validação de estoque)
- `modules/pagamentos` (processamento de pagamento)
- `modules/nfce` (emissão de NFC-e)

**Limitações Atuais:**

- ⚠️ Sem integração com balança eletrônica
- ⚠️ Sem sistema de antifraude
- ⚠️ Sem integração com programa de fidelização

**Pendências:**

- [ ] Integração com balança eletrônica
- [ ] Sistema de antifraude (detecção de roubo)
- [ ] Programa de fidelização

---

## 🔄 Módulos Transversais

### 1. PDV (Point of Sale)

**Arquivo:** `app/modules/pdv/`

**Responsabilidade:** PDV genérico para múltiplos segmentos.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `pdv.js` | PDV genérico | `criarVenda()`, `adicionarItem()`, `fecharVenda()`, `cancelarVenda()` |
| `caixa.js` | Gestão de caixa | `abrirCaixa()`, `fecharCaixa()`, `sangria()`, `suprimento()` |

**Rotas:**

```
POST   /pdv/caixa/abrir                # Abrir caixa
POST   /pdv/caixa/fechar               # Fechar caixa
POST   /pdv/caixa/sangria              # Sangria (retirada)
POST   /pdv/caixa/suprimento           # Suprimento (adição)
POST   /pdv/venda                      # Criar venda
POST   /pdv/venda/:id/fechar           # Fechar venda
GET    /pdv/vendas                     # Listar vendas
```

**Fluxo de Operação:**

1. Operador abre caixa (com saldo inicial)
2. Realiza vendas
3. Processa pagamentos
4. Realiza sangrias/suprimentos conforme necessário
5. Fecha caixa (com resumo de vendas)

**Dependências:**

- `modules/pagamentos` (processamento de pagamento)
- `modules/estoque` (validação de estoque)
- `modules/nfce` (emissão de NFC-e)

**Limitações Atuais:**

- ⚠️ Sem integração com impressora de cupom
- ⚠️ Sem suporte a múltiplos operadores simultâneos
- ⚠️ Sem sistema de permissões por operador

**Pendências:**

- [ ] Integração com impressora de cupom
- [ ] Controle de permissões por operador
- [ ] Suporte a múltiplos caixas simultâneos

---

### 2. ESTOQUE

**Arquivo:** `app/modules/estoque/`

**Responsabilidade:** Gestão completa de estoque com FIFO, lotes e validade.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `estoque-avancado.js` | Entrada/saída | `entradaPorNFe()`, `entradaManual()`, `saida()`, `ajuste()` |
| `movimentacao.js` | Rastreamento | `listarMovimentacoes()`, `detalheMovimentacao()` |
| `inventario.js` | Contagem cíclica | `iniciarInventario()`, `registrarContagem()`, `finalizarInventario()` |
| `receita.js` | Fichas técnicas | `criarReceita()`, `atualizarReceita()`, `calcularCusto()` |

**Rotas:**

```
POST   /estoque/entrada/nfe            # Entrada via NF-e
POST   /estoque/entrada/manual         # Entrada manual
POST   /estoque/saida                  # Saída de estoque
POST   /estoque/ajuste                 # Ajuste de estoque
GET    /estoque/produtos               # Listar produtos com estoque
GET    /estoque/movimentacoes          # Listar movimentações
POST   /estoque/inventario/iniciar     # Iniciar inventário cíclico
POST   /estoque/inventario/contagem    # Registrar contagem
POST   /estoque/inventario/finalizar   # Finalizar inventário
POST   /estoque/receita                # Criar receita (drink/prato)
GET    /estoque/receitas               # Listar receitas
```

**Fluxo de Operação:**

1. Entrada de estoque (NF-e ou manual)
2. Sistema registra lote e validade
3. Saída usa método FIFO
4. Rastreamento completo de movimentações
5. Inventário cíclico com divergências
6. Alertas de produtos vencidos

**Dependências:**

- `modules/nfce` (validação de NF-e)
- `modules/clientes` (fornecedores)
- `modules/financeiro` (custo de estoque)

**Limitações Atuais:**

- ⚠️ Sem integração com código de barras
- ⚠️ Sem sistema de previsão de demanda
- ⚠️ Sem alertas de estoque mínimo/máximo

**Pendências:**

- [ ] Integração com leitor de código de barras
- [ ] Previsão de demanda com ML
- [ ] Alertas automáticos de estoque

---

### 3. CLIENTES

**Arquivo:** `app/modules/clientes/`

**Responsabilidade:** Gestão de clientes com limites de crédito e scoring.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `clientes.js` | Gestão | `criarCliente()`, `atualizarCliente()`, `verificarCredito()`, `calcularScoring()` |

**Rotas:**

```
POST   /clientes                       # Criar cliente
PUT    /clientes/:id                   # Atualizar cliente
GET    /clientes/:id                   # Detalhes do cliente
GET    /clientes/:id/credito           # Verificar crédito disponível
GET    /clientes/:id/scoring           # Score de crédito
POST   /clientes/:id/suspender         # Suspender cliente
```

**Fluxo de Operação:**

1. Cadastro de cliente (PF ou PJ)
2. Sistema calcula scoring de crédito
3. Define limite de crédito
4. Monitora pagamentos
5. Atualiza scoring dinamicamente
6. Suspende se necessário

**Dependências:**

- `modules/financeiro` (histórico de pagamentos)
- `modules/vendas` (histórico de vendas)

**Limitações Atuais:**

- ⚠️ Scoring é simplificado (não integrado com bureaus)
- ⚠️ Sem integração com CPF/CNPJ validation
- ⚠️ Sem sistema de cobrança automática

**Pendências:**

- [ ] Integração com bureaus de crédito
- [ ] Validação de CPF/CNPJ
- [ ] Sistema de cobrança automática

---

### 4. PAGAMENTOS

**Arquivo:** `app/modules/pagamentos/`

**Responsabilidade:** Processamento de pagamentos com múltiplas adquirentes.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `pagamentos.js` | Orquestração | `processar()`, `reembolsar()`, `reconciliar()`, `listar()` |

**Rotas:**

```
POST   /pagamentos/processar           # Processar pagamento
POST   /pagamentos/:id/reembolsar      # Reembolsar
GET    /pagamentos                     # Listar pagamentos
POST   /pagamentos/reconciliar         # Reconciliar com adquirente
```

**Fluxo de Operação:**

1. Sistema recebe requisição de pagamento
2. Seleciona adquirente (Stone, Cielo, PagBank)
3. Processa transação
4. Registra resultado
5. Atualiza caixa/fluxo de caixa
6. Reconcilia com adquirente

**Dependências:**

- `adapters/payment/*` (adaptadores de adquirentes)
- `modules/financeiro` (fluxo de caixa)

**Limitações Atuais:**

- ⚠️ Sem suporte a parcelamento automático
- ⚠️ Sem integração com antifraude
- ⚠️ Sem suporte a múltiplas moedas

**Pendências:**

- [ ] Parcelamento automático
- [ ] Integração com antifraude
- [ ] Suporte a múltiplas moedas

---

### 5. FINANCEIRO

**Arquivo:** `app/modules/financeiro/`

**Responsabilidade:** Gestão financeira com DRE, balanço e indicadores.

**Controllers:**

| Controller | Responsabilidade | Métodos |
|-----------|------------------|---------|
| `fluxo-pagamento.js` | Fluxo de caixa | `contasAReceber()`, `contasAPagar()`, `receber()`, `pagar()` |
| `relatorios-financeiros.js` | Relatórios | `dre()`, `balanco()`, `indicadores()`, `fluxoCaixa()` |

**Rotas:**

```
GET    /financeiro/contas-receber      # Contas a receber
GET    /financeiro/contas-pagar        # Contas a pagar
POST   /financeiro/receber             # Registrar recebimento
POST   /financeiro/pagar               # Registrar pagamento
GET    /financeiro/dre                 # DRE (Demonstração de Resultado)
GET    /financeiro/balanco             # Balanço patrimonial
GET    /financeiro/indicadores         # Indicadores financeiros
GET    /financeiro/fluxo-caixa         # Fluxo de caixa
```

**Fluxo de Operação:**

1. Vendas geram contas a receber
2. Compras geram contas a pagar
3. Recebimentos/pagamentos atualizam fluxo
4. Relatórios consolidam dados
5. Indicadores calculados automaticamente

**Dependências:**

- `modules/vendas` (receitas)
- `modules/estoque` (custos)
- `modules/pagamentos` (movimentações)

**Limitações Atuais:**

- ⚠️ Sem integração com contabilidade (ERP externo)
- ⚠️ Sem suporte a múltiplas moedas
- ⚠️ Sem análise preditiva

**Pendências:**

- [ ] Integração com software contábil
- [ ] Suporte a múltiplas moedas
- [ ] Análise preditiva com ML

---

## 🔌 Adaptadores de Integração

### 1. NFC-e (Nota Fiscal de Consumidor Eletrônica)

**Arquivo:** `app/adapters/nfce/`

**Responsabilidade:** Emissão de NFC-e para todas as UFs brasileiras.

**Adaptadores:**

| Adaptador | Responsabilidade | Status |
|-----------|------------------|--------|
| `focus/index.js` | Focus NFe (principal) | ✅ Implementado |
| `manager.js` | Gerenciador com fallback | ✅ Implementado |
| `plugnotas.js` | PlugNotas (fallback) | ✅ Implementado |

**Funcionalidades:**

- ✅ Emissão de NFC-e (modelo 65)
- ✅ Suporte a 27 UFs
- ✅ Contingência offline com reprocessamento
- ✅ Cancelamento de NFC-e
- ✅ Consulta de status
- ✅ Fallback automático (Focus → PlugNotas)

**Rotas:**

```
POST   /nfce/emitir                    # Emitir NFC-e
POST   /nfce/:id/cancelar              # Cancelar NFC-e
GET    /nfce/:id/status                # Consultar status
GET    /nfce/contingencia              # Ver buffer de contingência
```

**Fluxo de Operação:**

1. Sistema recebe dados da venda
2. Monta XML da NFC-e
3. Envia para Focus NFe
4. Se falhar, tenta PlugNotas
5. Se offline, armazena em buffer
6. Reprocessa automaticamente quando online

**Dependências:**

- Certificado digital A1 (CNPJ)
- CSC da SEFAZ
- Credenciais Focus NFe

**Limitações Atuais:**

- ⚠️ Sem suporte a NF-e (modelo 55) - apenas NFC-e
- ⚠️ Sem integração com SEFAZ estaduais (usa SVRS)
- ⚠️ Sem suporte a cupom fiscal (modelo 2D)

**Pendências:**

- [ ] Suporte a NF-e (modelo 55)
- [ ] Integração com SEFAZ estaduais
- [ ] Suporte a cupom fiscal

---

### 2. Pagamentos

**Arquivo:** `app/adapters/payment/`

**Responsabilidade:** Integração com múltiplas adquirentes e formas de pagamento.

**Adaptadores:**

| Adaptador | Responsabilidade | Status |
|-----------|------------------|--------|
| `stone.js` | Stone (cartão, débito, Pix) | ✅ Implementado |
| `cielo.js` | Cielo (cartão, débito) | ✅ Implementado |
| `pagbank.js` | PagBank (Pix, cartão) | ✅ Implementado |
| `tef.js` | TEF (máquinas físicas) | ✅ Implementado |
| `pix.js` | Pix dinâmico (QR Code) | ✅ Implementado |
| `manager.js` | Gerenciador com fallback | ✅ Implementado |

**Funcionalidades:**

- ✅ Cartão de crédito (com parcelamento)
- ✅ Cartão de débito
- ✅ Pix (QR Code dinâmico)
- ✅ TEF (máquinas Gertec, Ingenico, Verifone)
- ✅ Dinheiro (com cálculo de troco)
- ✅ Reembolso
- ✅ Reconciliação

**Rotas:**

```
POST   /pagamentos/processar           # Processar pagamento
POST   /pagamentos/:id/reembolsar      # Reembolsar
GET    /pagamentos                     # Listar pagamentos
POST   /pagamentos/reconciliar         # Reconciliar
```

**Fluxo de Operação:**

1. Sistema recebe requisição de pagamento
2. Seleciona adquirente baseado em preferência/disponibilidade
3. Processa transação
4. Registra resultado
5. Se falhar, tenta próxima adquirente
6. Atualiza caixa/fluxo de caixa

**Dependências:**

- Credenciais Stone
- Credenciais Cielo
- Credenciais PagBank
- Máquina TEF (opcional)

**Limitações Atuais:**

- ⚠️ Sem suporte a parcelamento automático
- ⚠️ Sem integração com antifraude
- ⚠️ Sem suporte a múltiplas moedas

**Pendências:**

- [ ] Parcelamento automático
- [ ] Integração com antifraude
- [ ] Suporte a múltiplas moedas

---

## 💾 Modelo de Dados

### Tabelas Principais

**Empresas:**

```sql
CREATE TABLE empresas (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  ie VARCHAR(20),
  csc VARCHAR(28),
  certificado_a1 BYTEA,
  ativa BOOLEAN DEFAULT true,
  criada_em TIMESTAMP DEFAULT NOW()
);
```

**Usuários:**

```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- admin, gerente, vendedor, garcom, barbeiro, caixa, cliente
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

**Produtos:**

```sql
CREATE TABLE produtos (
  id UUID PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  sku VARCHAR(50) UNIQUE,
  preco_custo DECIMAL(10,2),
  preco_venda DECIMAL(10,2) NOT NULL,
  categoria_id UUID REFERENCES categorias(id),
  estoque_atual INT DEFAULT 0,
  estoque_minimo INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

**Vendas:**

```sql
CREATE TABLE vendas (
  id UUID PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id),
  cliente_id UUID REFERENCES clientes(id),
  data_venda TIMESTAMP DEFAULT NOW(),
  total DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(10,2) DEFAULT 0,
  acrescimo DECIMAL(10,2) DEFAULT 0,
  nfce_id UUID,
  status VARCHAR(50) DEFAULT 'aberta', -- aberta, fechada, cancelada
  criada_em TIMESTAMP DEFAULT NOW()
);
```

**Movimentações de Estoque:**

```sql
CREATE TABLE movimentacoes_estoque (
  id UUID PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id),
  produto_id UUID REFERENCES produtos(id),
  tipo VARCHAR(50) NOT NULL, -- entrada, saida, ajuste, devolucao
  quantidade INT NOT NULL,
  lote VARCHAR(50),
  validade DATE,
  motivo TEXT,
  criada_em TIMESTAMP DEFAULT NOW()
);
```

**Pagamentos:**

```sql
CREATE TABLE pagamentos (
  id UUID PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id),
  venda_id UUID REFERENCES vendas(id),
  forma_pagamento VARCHAR(50) NOT NULL, -- dinheiro, cartao_credito, cartao_debito, pix, tef
  valor DECIMAL(10,2) NOT NULL,
  adquirente VARCHAR(50), -- stone, cielo, pagbank
  nsu VARCHAR(50),
  autorizacao VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, aprovado, recusado, reembolsado
  criado_em TIMESTAMP DEFAULT NOW()
);
```

**NFC-e:**

```sql
CREATE TABLE nfce (
  id UUID PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id),
  venda_id UUID REFERENCES vendas(id),
  numero INT NOT NULL,
  serie INT NOT NULL,
  chave_acesso VARCHAR(44) UNIQUE,
  protocolo VARCHAR(50),
  xml BYTEA,
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, autorizado, cancelado, contingencia
  criada_em TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 Fluxos de Operação

### Fluxo de Venda Completo

```
1. PDV: Criar venda
   ↓
2. PDV: Adicionar itens (com validação de estoque)
   ↓
3. ESTOQUE: Reservar quantidade
   ↓
4. PDV: Aplicar desconto/acréscimo
   ↓
5. CLIENTES: Verificar crédito disponível
   ↓
6. PDV: Fechar venda
   ↓
7. PAGAMENTOS: Processar pagamento
   ↓
8. NFC-e: Emitir NFC-e
   ↓
9. ESTOQUE: Baixar estoque (FIFO)
   ↓
10. FINANCEIRO: Registrar receita
    ↓
11. CLIENTES: Atualizar scoring
```

### Fluxo de Comanda (Bar/Restaurante)

```
1. BAR: Abrir comanda
   ↓
2. BAR: Adicionar itens (com validação de estoque)
   ↓
3. KDS: Enviar para cozinha/bar
   ↓
4. KDS: Marcar itens como "pronto"
   ↓
5. BAR: Marcar itens como "servido"
   ↓
6. BAR: Divisão de conta (se necessário)
   ↓
7. PAGAMENTOS: Processar pagamento
   ↓
8. NFC-e: Emitir NFC-e
   ↓
9. ESTOQUE: Baixar estoque
   ↓
10. FINANCEIRO: Registrar receita
```

### Fluxo de Estoque

```
1. ESTOQUE: Entrada (NF-e ou manual)
   ↓
2. ESTOQUE: Registrar lote e validade
   ↓
3. ESTOQUE: Atualizar saldo
   ↓
4. FINANCEIRO: Registrar custo
   ↓
5. [Saída via FIFO]
   ↓
6. ESTOQUE: Baixar estoque
   ↓
7. FINANCEIRO: Atualizar custo de venda
```

---

## ⚠️ Limites e Pendências

### Por Módulo

| Módulo | Limitações | Pendências | Prioridade |
|--------|-----------|-----------|-----------|
| **BAR** | KDS simulado | Impressora, chamada | Alta |
| **RESTAURANTE** | Sem delivery externo | iFood/Uber Eats | Média |
| **LOJA** | Comissão fixa | Escalonamento | Baixa |
| **BARBEARIA** | Sem avaliação | Fidelização | Média |
| **CLUBE** | Sem app mobile | App + acesso | Alta |
| **SUPERMERCADO** | Sem balança | Antifraude | Média |
| **ESTOQUE** | Sem código de barras | Previsão ML | Média |
| **CLIENTES** | Scoring simples | Bureau de crédito | Baixa |
| **PAGAMENTOS** | Sem parcelamento | Antifraude | Alta |
| **NFC-e** | Apenas modelo 65 | Modelo 55, SEFAZ | Alta |
| **FINANCEIRO** | Sem contabilidade | ERP externo | Média |

---

## 🚀 Guia de Operação

### Inicialização

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.production

# 3. Iniciar banco de dados
docker-compose up -d postgres redis

# 4. Executar migrações
npm run migrate

# 5. Iniciar servidor
npm run dev
```

### Testes

```bash
# Executar testes
npm test

# Com cobertura
npm run test:coverage

# Teste de carga
npm run test:load
```

### Monitoramento

```bash
# Logs em tempo real
npm run logs

# Métricas
npm run metrics

# Health check
curl http://localhost:8080/health
```

---

## 📞 Suporte

- **Documentação:** https://kytto.com.br/docs
- **Email:** support@kytto.com.br
- **WhatsApp:** +55 (XX) XXXXX-XXXX

---

**Kytto ERP © 2024 - Todos os direitos reservados**

**Versão:** 1.0  
**Última atualização:** Julho 2024  
**Status:** Produção
