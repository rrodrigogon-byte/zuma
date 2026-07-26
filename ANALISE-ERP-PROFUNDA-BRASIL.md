# Análise Profunda: Transformação do Agro-Open em ERP Brasileiro Modular

**Versão:** 2.0 - Análise Realista e Verificável  
**Data:** 26 de julho de 2026  
**Escopo:** Bares, Restaurantes, Clubes, Lojas e Comércio em Geral  
**Objetivo:** Definir roadmap para ERP completo com fiscal nacional, estoque e pagamentos por máquinas físicas

---

## 1. Estado Atual do Agro-Open

### 1.1 O que Realmente Existe

O repositório `agro-open` é uma **plataforma de gestão de eventos desportivos** (Agro Open de Tênis), não um ERP. A análise do código revela:

| Componente | Status | Linhas | Observação |
|-----------|--------|--------|-----------|
| **Backend** | Funcional | ~2.100 | Express.js, JSON em arquivo, sem PostgreSQL |
| **Frontend** | Funcional | ~50.000 | React, Vite, painel administrativo |
| **Banco de Dados** | JSON local | - | `db.json`, sem schema SQL |
| **NFC-e** | Simulado | ~400 | Apenas estrutura, sem integração real |
| **Pagamentos** | Simulado | ~300 | Pix simulado, sem Stone/Cielo |
| **Módulos Criados** | Estrutura | - | Pastas vazias: bar/, loja/, barbearia/, etc |
| **Testes** | Scaffold | ~359 | Apenas template, sem cobertura real |

### 1.2 Arquivos Reais vs. Criados

**Arquivos reais (funcionais):**
- `server.js` — Express com rotas de eventos, ligase, ranking
- `db.js` — Persistência em JSON
- `nfce.js` — Simulador de NFC-e
- `pagamentos.js` — Simulador de Pix
- `email.js`, `whatsapp.js` — Integrações básicas

**Arquivos criados (vazios/templates):**
- `app/adapters/` — Não integrado ao server.js
- `app/core/` — Não integrado ao server.js
- `app/modules/` — Pastas vazias, sem rotas
- `app/migrations/` — Schema SQL não executado

**Conclusão:** A publicação anterior adicionou **estrutura de projeto**, não código funcional integrado.

---

## 2. Requisitos Regulatórios Brasileiros

### 2.1 Fiscal

| Requisito | Escopo | Complexidade | Dependência |
|-----------|--------|--------------|-------------|
| **NFC-e** | Bares, Restaurantes, Lojas | Alta | Certificado A1, CSC, SEFAZ estadual |
| **NF-e** | Entrada de estoque, devolução | Alta | Certificado A1, CSC, SEFAZ |
| **Contingência Offline** | Todos | Média | Buffer local, reprocessamento 24-30h |
| **DANFE** | Impressão de recibos | Média | Biblioteca de PDF |
| **Cancelamento** | Todos | Média | Justificativa, sequência |
| **Auditoria Fiscal** | Todos | Alta | Log imutável, hash de sequência |

### 2.2 Pagamentos

| Requisito | Escopo | Complexidade | Dependência |
|-----------|--------|--------------|-------------|
| **TEF** | Máquinas físicas | Alta | Protocolo TEF, máquinas suportadas |
| **Cartão Crédito** | Stone, Cielo, PagBank | Alta | API, tokenização, PCI-DSS |
| **Cartão Débito** | Stone, Cielo | Alta | TEF ou API |
| **Pix** | Stone, PagBank, Mercado Pago | Média | Chave Pix, QR dinâmico |
| **Dinheiro** | Todos | Baixa | Sangria, suprimento |
| **Reconciliação** | Todos | Alta | Extrato, conciliação automática |
| **PCI-DSS** | Todos | Alta | Criptografia, tokenização, auditoria |

### 2.3 Estoque

| Requisito | Escopo | Complexidade | Dependência |
|-----------|--------|--------------|-------------|
| **Entrada** | Todos | Média | NF-e, lote, validade |
| **Saída** | Todos | Média | Validação de saldo, FIFO/LIFO |
| **Ajuste** | Todos | Média | Motivo, auditoria |
| **Inventário Cíclico** | Todos | Alta | Contagem, divergências, finalização |
| **Fichas Técnicas** | Bar, Restaurante | Alta | Receitas, custos, rendimento |
| **Rastreabilidade** | Todos | Alta | Lote, validade, origem, destino |

---

## 3. Lacunas Críticas por Segmento

### 3.1 BAR

**O que Falta:**
- Comanda eletrônica integrada (não existe em server.js)
- Divisão de conta por cliente
- Kitchen Display System (KDS) real
- Integração com NFC-e automática
- Controle de bebidas por dose (fichas técnicas)
- Impressora de cozinha/bar
- Histórico de vendas por garçom

**Esforço Estimado:** 120h

### 3.2 RESTAURANTE

**O que Falta:**
- Comanda com mesas
- Divisão de conta
- KDS integrado
- Cardápio digital
- Delivery (integração)
- Reservas
- Histórico de clientes

**Esforço Estimado:** 150h

### 3.3 LOJA

**O que Falta:**
- PDV funcional (não existe)
- Múltiplos caixas
- Comissões de vendedor
- Promoções e descontos
- Cupom fiscal (NFC-e)
- Integração com máquinas de cartão
- Relatório de vendas por caixa

**Esforço Estimado:** 100h

### 3.4 BARBEARIA

**O que Falta:**
- Agendamentos (não existe)
- Fila de espera
- Histórico de clientes
- Serviços e preços
- Comissão de barbeiro
- Integração com WhatsApp para confirmação
- Relatório de ocupação

**Esforço Estimado:** 80h

### 3.5 CLUBE

**O que Falta:**
- Gestão de membros
- Mensalidades e cobranças
- Eventos e reservas
- Controle de acesso
- Histórico de consumo
- Relatório de receita

**Esforço Estimado:** 90h

### 3.6 SUPERMERCADO

**O que Falta:**
- Autoatendimento (self-checkout)
- Pesagem de produtos
- Promoções por departamento
- Gestão de fornecedores
- Controle de validade
- Integração com máquinas de cartão

**Esforço Estimado:** 110h

---

## 4. Arquitetura-Alvo Modular

### 4.1 Camadas

```
┌─────────────────────────────────────────┐
│         Frontend (React + Vite)         │
│  (Admin, PDV, KDS, App Mobile Offline)  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│    API Gateway (Express + Auth JWT)     │
│  (Rate Limit, CORS, Logging, Audit)     │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         Core (Compartilhado)            │
│  ├─ Auth (JWT, RBAC, Multi-tenant)      │
│  ├─ Fiscal (NFC-e, NF-e, Contingência)  │
│  ├─ Pagamentos (TEF, Cartão, Pix)       │
│  ├─ Estoque (Entrada, Saída, Ajuste)    │
│  ├─ Auditoria (Log imutável)            │
│  └─ Segurança (PCI-DSS, LGPD, Crypt)    │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      Módulos por Segmento               │
│  ├─ Bar (Comanda, KDS, Bebidas)         │
│  ├─ Restaurante (Comanda, Delivery)     │
│  ├─ Loja (PDV, Comissões)               │
│  ├─ Barbearia (Agendamentos)            │
│  ├─ Clube (Membros, Eventos)            │
│  └─ Supermercado (Autoatendimento)      │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│   Infraestrutura                        │
│  ├─ PostgreSQL (30+ tabelas)            │
│  ├─ Redis (Cache, Fila)                 │
│  ├─ Elasticsearch (Busca)               │
│  ├─ GCP Cloud Run (Deploy)              │
│  ├─ GCS (Armazenamento)                 │
│  └─ Cloud Scheduler (Jobs)              │
└─────────────────────────────────────────┘
```

### 4.2 Fluxo de Venda (Exemplo: Bar)

```
1. Garçom abre comanda (offline-first)
   └─ WatermelonDB local
   
2. Adiciona itens (bebidas, comida)
   └─ Valida estoque local
   
3. Cliente solicita conta
   └─ Calcula total, descontos, taxas
   
4. Processa pagamento
   ├─ Tenta TEF (máquina física)
   ├─ Se falhar, tenta Pix (QR dinâmico)
   ├─ Se falhar, tenta cartão (Stone/Cielo)
   └─ Se falhar, registra como débito
   
5. Emite NFC-e
   ├─ Tenta Focus NFe (online)
   ├─ Se falhar, entra em contingência
   └─ Imprime recibo
   
6. Sincroniza com servidor
   ├─ Envia comanda, pagamento, NFC-e
   ├─ Atualiza estoque
   └─ Registra auditoria
```

---

## 5. Backlog Priorizado (MVP + Fases)

### Fase 0: Fundação (Semana 1-2)

| ID | Tarefa | Esforço | Bloqueador |
|----|--------|---------|-----------|
| 0.1 | Migrar DB JSON → PostgreSQL | 40h | Nenhum |
| 0.2 | Implementar multi-tenant real | 30h | 0.1 |
| 0.3 | Integrar PostgreSQL no server.js | 20h | 0.1 |
| 0.4 | Criar schema SQL com 30+ tabelas | 30h | 0.1 |
| 0.5 | Implementar auditoria fiscal (log imutável) | 25h | 0.1 |

**Total:** 145h | **Risco:** Médio | **Critério de Aceite:** PostgreSQL rodando, todas as tabelas criadas, auditoria funcionando

### Fase 1: Fiscal Nacional (Semana 3-4)

| ID | Tarefa | Esforço | Bloqueador |
|----|--------|---------|-----------|
| 1.1 | Integrar Focus NFe (real, não simulado) | 60h | 0.3 |
| 1.2 | Implementar contingência offline (24-30h) | 40h | 1.1 |
| 1.3 | Integrar PlugNotas como fallback | 30h | 1.1 |
| 1.4 | Suporte a NFC-e em 27 UFs | 20h | 1.1 |
| 1.5 | Cancelamento de NFC-e com justificativa | 15h | 1.1 |
| 1.6 | Impressão de DANFE e recibos | 25h | 1.1 |

**Total:** 190h | **Risco:** Alto | **Critério de Aceite:** NFC-e emitida em homologação, contingência testada, cancelamento funciona

### Fase 2: Pagamentos Multiadquirente (Semana 5-6)

| ID | Tarefa | Esforço | Bloqueador |
|----|--------|---------|-----------|
| 2.1 | Integrar Stone (cartão, débito, Pix) | 50h | 0.3 |
| 2.2 | Integrar Cielo (cartão, débito, TEF) | 50h | 0.3 |
| 2.3 | Integrar PagBank (Pix, cartão) | 40h | 0.3 |
| 2.4 | Implementar TEF (máquinas Gertec, Ingenico) | 60h | 0.3 |
| 2.5 | Fallback automático entre adquirentes | 30h | 2.1, 2.2, 2.3 |
| 2.6 | Reconciliação automática de extratos | 40h | 2.1, 2.2, 2.3 |
| 2.7 | PCI-DSS compliance (criptografia, tokenização) | 50h | 2.1, 2.2, 2.3 |

**Total:** 320h | **Risco:** Alto | **Critério de Aceite:** Todos os meios funcionam, fallback testado, reconciliação automática

### Fase 3: Estoque Completo (Semana 7-8)

| ID | Tarefa | Esforço | Bloqueador |
|----|--------|---------|-----------|
| 3.1 | Entrada de estoque (NF-e, lote, validade) | 40h | 0.1 |
| 3.2 | Saída de estoque (FIFO/LIFO, validação) | 30h | 3.1 |
| 3.3 | Ajuste de estoque (motivo, auditoria) | 20h | 3.1 |
| 3.4 | Inventário cíclico (contagem, divergências) | 50h | 3.1 |
| 3.5 | Fichas técnicas (receitas, custos, rendimento) | 40h | 3.1 |
| 3.6 | Rastreabilidade (lote, validade, origem) | 30h | 3.1 |
| 3.7 | Alerta de estoque crítico | 15h | 3.1 |

**Total:** 225h | **Risco:** Médio | **Critério de Aceite:** Entrada/saída funcionam, inventário cíclico testado, fichas técnicas criadas

### Fase 4: Módulos por Segmento (Semana 9-12)

| Módulo | Funcionalidades | Esforço | Bloqueador |
|--------|-----------------|---------|-----------|
| **BAR** | Comanda, KDS, divisão, bebidas | 120h | 1.1, 2.1, 3.1 |
| **RESTAURANTE** | Comanda, mesas, delivery, reservas | 150h | 1.1, 2.1, 3.1 |
| **LOJA** | PDV, múltiplos caixas, comissões | 100h | 1.1, 2.1, 3.1 |
| **BARBEARIA** | Agendamentos, fila, comissão | 80h | 1.1, 2.1 |
| **CLUBE** | Membros, mensalidades, eventos | 90h | 1.1, 2.1 |
| **SUPERMERCADO** | Autoatendimento, pesagem, promoções | 110h | 1.1, 2.1, 3.1 |

**Total:** 650h | **Risco:** Médio | **Critério de Aceite:** Cada módulo tem CRUD, integração com fiscal/pagamento/estoque

### Fase 5: App Mobile Offline (Semana 13-14)

| ID | Tarefa | Esforço | Bloqueador |
|----|--------|---------|-----------|
| 5.1 | Setup React Native + Expo | 20h | 0.3 |
| 5.2 | WatermelonDB para sincronização offline | 40h | 5.1 |
| 5.3 | App de garçom (comanda, pagamento) | 60h | 5.2, 2.1 |
| 5.4 | App de vendedor (PDV, estoque) | 50h | 5.2, 3.1 |
| 5.5 | Sincronização resiliente (retry, fila) | 40h | 5.2 |
| 5.6 | Build iOS + Android + publicação | 30h | 5.1 |

**Total:** 240h | **Risco:** Médio | **Critério de Aceite:** App funciona offline, sincroniza ao conectar, publicado em stores

### Fase 6: Testes e Homologação (Semana 15-16)

| ID | Tarefa | Esforço | Bloqueador |
|----|--------|---------|-----------|
| 6.1 | Testes unitários (90%+ cobertura) | 80h | Todas as fases |
| 6.2 | Testes E2E (cenários críticos) | 60h | Todas as fases |
| 6.3 | Homologação fiscal (Focus NFe, SEFAZ) | 40h | 1.1 |
| 6.4 | Homologação pagamentos (Stone, Cielo) | 40h | 2.1, 2.2 |
| 6.5 | Teste de carga e performance | 40h | Todas as fases |
| 6.6 | Auditoria de segurança (PCI-DSS, LGPD) | 50h | Todas as fases |

**Total:** 310h | **Risco:** Alto | **Critério de Aceite:** 90%+ cobertura, homologação aprovada, performance OK

---

## 6. Estimativa Total

| Fase | Esforço | Duração | Equipe |
|------|---------|---------|--------|
| 0 | 145h | 2 sem | 2 devs |
| 1 | 190h | 2 sem | 2 devs |
| 2 | 320h | 2 sem | 3 devs |
| 3 | 225h | 2 sem | 2 devs |
| 4 | 650h | 4 sem | 3 devs |
| 5 | 240h | 2 sem | 2 devs |
| 6 | 310h | 2 sem | 2 devs |
| **TOTAL** | **2.080h** | **16 semanas** | **2-3 devs** |

**Custo Estimado (Brasil):** R$ 200.000 - 350.000 (16 semanas, 2-3 devs @ R$ 120-150/h)

---

## 7. Dependências Externas

### 7.1 Credenciais Necessárias

| Serviço | Necessário | Prazo | Custo |
|---------|-----------|-------|-------|
| **Certificado Digital A1** | Sim | 5-10 dias | R$ 200-400 |
| **CSC (SEFAZ)** | Sim | 1-2 dias | Gratuito |
| **Focus NFe** | Sim | 1 dia | R$ 0-100/mês |
| **Stone** | Sim | 3-5 dias | 2,99% + taxa |
| **Cielo** | Sim | 3-5 dias | 2,99% + taxa |
| **PagBank** | Sim | 1-2 dias | 2,49% + taxa |
| **GCP Project** | Sim | Imediato | Gratuito (crédito) |
| **PostgreSQL** | Sim | Imediato | Gratuito (Cloud SQL) |
| **Redis** | Sim | Imediato | Gratuito (Memorystore) |

### 7.2 Homologações

| Órgão | Tempo | Risco | Ação |
|------|-------|-------|------|
| **SEFAZ-MT** | 5-10 dias | Médio | Enviar para homologação em paralelo |
| **SEFAZ-SP** | 5-10 dias | Médio | Testar em ambiente de testes |
| **Stone** | 2-3 dias | Baixo | Testar em sandbox |
| **Cielo** | 2-3 dias | Baixo | Testar em sandbox |
| **PagBank** | 1-2 dias | Baixo | Testar em sandbox |

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|------|---------------|--------|-----------|
| **Atraso na homologação fiscal** | Alta | Alto | Iniciar homologação em paralelo, ter fallback |
| **Integração TEF complexa** | Média | Alto | Prototipo com máquina real na semana 1 |
| **Problemas de sincronização offline** | Média | Médio | Testes E2E desde a semana 5 |
| **Performance com múltiplos tenants** | Média | Médio | Teste de carga na semana 15 |
| **Segurança PCI-DSS não atendida** | Baixa | Alto | Auditoria externa na semana 16 |
| **Falta de documentação** | Média | Médio | Documentar enquanto desenvolve |

---

## 9. Próximos Passos Imediatos

1. **Semana 1:** Iniciar Fase 0 (PostgreSQL, multi-tenant)
2. **Semana 1:** Obter certificado A1 e CSC
3. **Semana 1:** Criar contas Focus NFe, Stone, Cielo, PagBank
4. **Semana 2:** Integrar PostgreSQL ao server.js (não criar novo projeto)
5. **Semana 3:** Iniciar Fase 1 (NFC-e real)
6. **Semana 3:** Enviar para homologação SEFAZ-MT

---

## 10. Conclusão

O **agro-open não é um ERP**, é uma plataforma de eventos. Para transformá-lo em um **ERP brasileiro modular** pronto para produção, é necessário:

1. **Refatoração completa** (PostgreSQL, multi-tenant, auditoria)
2. **Integração real** (fiscal, pagamentos, estoque)
3. **Módulos por segmento** (bar, restaurante, loja, barbearia, clube, supermercado)
4. **Homologação** (SEFAZ, adquirentes, segurança)
5. **Testes e validação** (90%+ cobertura, E2E, carga)

**Tempo total:** 16 semanas com 2-3 devs  
**Custo:** R$ 200.000 - 350.000  
**Risco:** Médio-Alto (dependências externas, homologações)

Este documento serve como **base para planejamento executivo e técnico** do projeto.
