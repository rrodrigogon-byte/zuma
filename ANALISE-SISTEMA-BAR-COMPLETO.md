# SetPoint · Evolução para Gestão Completa de Bar
## Análise Técnica e Roadmap de Implementação

**Documento preparado por:** Manus AI  
**Data:** 26 de julho de 2026  
**Versão:** 1.0  
**Status:** Pronto para implementação

---

## 1. Sumário Executivo

O projeto **SetPoint** é atualmente uma plataforma de gestão esportiva (torneios de tênis) com capacidades avançadas de PDV, comanda eletrônica e pagamentos. O objetivo desta evolução é transformá-lo em um **sistema completo de gestão de bar** com foco em:

1. **NFC-e homologada** para Mato Grosso com emissão em contingência offline
2. **Comanda eletrônica robusta** com divisão de conta e fechamento por mesa
3. **Integração de pagamento** (Stone/Cielo/PagBank) + Pix dinâmico
4. **Controle de estoque** por dose e ficha técnica de drinks
5. **App mobile offline** para garçom com sincronização

O projeto já possui **80% da infraestrutura necessária**: arquitetura modular, autenticação JWT, SSE para realtime, integração com Pix/Mercado Pago, NFC-e em modo simulado, e frontend React moderno. A evolução requer consolidação, hardening e novas integrações.

---

## 2. Estado Atual da Plataforma

### 2.1 Arquitetura Existente

| Componente | Tecnologia | Status | Observações |
|---|---|---|---|
| **Backend** | Node.js 18+ / Express | ✅ Produção | ~5.8k linhas, ESM, sem TypeScript |
| **Frontend** | React 18 + Vite 5 | ✅ Produção | SPA compilada para `app/public` |
| **Banco de dados** | JSON (trocável por Postgres) | ✅ Funcional | Interface abstrata em `db.js` |
| **Autenticação** | JWT + bcrypt | ✅ Implementado | RBAC (admin/organizador/staff/atleta) |
| **Realtime** | Server-Sent Events (SSE) | ✅ Funcional | Broadcast para KDS, mesas, portaria |
| **Pagamentos** | Pix estático + Mercado Pago | ✅ Implementado | Modo simulado para dev |
| **NFC-e** | Focus NFe / PlugNotas | ⚠️ Simulado | Pronto para integração real |
| **Comunicação** | E-mail + WhatsApp | ⚠️ Simulado | Resend + Evolution/Z-API |
| **Deploy** | Docker + GCP Cloud Run | ✅ Configurado | Render.yaml + cloudbuild.yaml |

### 2.2 Capacidades Já Implementadas

**Módulos de negócio:**
- Torneios com 6 formatos (eliminatória, dupla, grupos, round-robin, suíço, double elimination)
- 8 modalidades esportivas
- Ranking interno + rating Elo + ATP/WTA
- Inscrições com QR + portaria
- **PDV com comanda eletrônica** (mesas, cozinha, caixa)
- Estoque de produtos
- Carteira & fidelidade
- CRM e comunicação em massa
- Auditoria e LGPD

**Recursos técnicos:**
- Rate-limit e proteção contra abuso
- Headers de segurança (X-Content-Type-Options, X-Frame-Options, etc.)
- CORS configurável
- Backup automático do banco (`.bak`)
- Escrita atômica no JSON
- Testes automatizados (13/13 verdes)

### 2.3 Limitações Atuais

| Limitação | Impacto | Solução Proposta |
|---|---|---|
| NFC-e apenas simulada | Não emite nota fiscal real | Integrar com provedor real (Focus/PlugNotas) |
| Pagamento via maquininha apenas simulado | Sem integração Stone/Cielo/PagBank | Implementar TEF (Transferência Eletrônica de Fundos) |
| Controle de estoque genérico | Não rastreia doses/ml | Criar modelo de estoque por unidade de medida |
| Sem app mobile | Garçom usa web no celular | Desenvolver PWA + Expo React Native |
| Sem sincronização offline | Perde dados sem internet | Implementar IndexedDB + Service Worker |
| Banco JSON não escala | Limitado a single-node | Migrar para PostgreSQL (já planejado) |
| Sem divisão de conta | Paga um, todos pagam igual | Implementar split de pagamento por item |
| Sem ficha técnica de drink | Sem rastreamento de custo | Criar módulo de receitas e composição |

---

## 3. Requisitos Funcionais para Sistema de Bar

### 3.1 NFC-e Homologada (Mato Grosso)

**Requisitos funcionais:**
- Emissão de NFC-e (modelo 65) com validação de regras fiscais MT
- Suporte a contingência offline: buffer local + reprocessamento quando online
- Cancelamento de NFC-e dentro do prazo legal (30 minutos)
- Geração de DANFE (Documento Auxiliar da NFC-e) para impressão
- Rastreamento de série/número de NFC-e
- Integração com SEFAZ-MT via provedor (Focus NFe recomendado)

**Requisitos não-funcionais:**
- Latência de emissão < 3s em condições normais
- Suporte a até 100 NFC-e/hora em contingência
- Backup de XML em armazenamento seguro (GCS)
- Auditoria completa de emissões (quem, quando, motivo)

**Dados necessários:**
- Certificado digital A1 (CNPJ do estabelecimento)
- CSC (Código de Segurança da Contribuinte) da SEFAZ-MT
- Credenciais do provedor (Focus NFe)
- Série e sequência de NFC-e

### 3.2 Comanda Eletrônica com Divisão de Conta

**Requisitos funcionais:**
- Criar/fechar comanda por mesa (identificada por número ou QR)
- Adicionar itens à comanda (bebidas, alimentos, serviços)
- Modificar quantidade/preço de itens (ajustes de garçom)
- Divisão de conta: por pessoa, por item, ou customizada
- Histórico de movimentações (quem adicionou, quando)
- Impressão de comanda (cozinha, cliente)
- Fechamento com múltiplos pagamentos (Pix + dinheiro, por exemplo)

**Requisitos não-funcionais:**
- Suporte a 50+ mesas simultâneas
- Atualização em tempo real (SSE)
- Sincronização offline no app do garçom

**Dados necessários:**
- Mapeamento de mesas (layout do bar)
- Cardápio com preços
- Histórico de transações por mesa

### 3.3 Integração de Pagamento (Stone/Cielo/PagBank)

**Requisitos funcionais:**
- Suporte a múltiplas maquininhas (Stone, Cielo, PagBank)
- Pagamento via TEF (Transferência Eletrônica de Fundos)
- Pix dinâmico com QR por transação
- Dinheiro (manual)
- Parcelamento (se suportado pela maquininha)
- Reembolso/cancelamento de transação
- Reconciliação automática com extrato

**Requisitos não-funcionais:**
- Latência de autorização < 5s
- Suporte offline com fila de reprocessamento
- PCI-DSS compliance (não armazenar dados de cartão)

**Dados necessários:**
- Credenciais de cada gateway (API key, merchant ID)
- Configuração de taxa por meio de pagamento

### 3.4 Controle de Estoque por Dose

**Requisitos funcionais:**
- Cadastro de bebidas com unidade de medida (ml, dose, litro)
- Ficha técnica de drink: ingredientes, quantidades, custo, preço
- Rastreamento de estoque em tempo real
- Alerta de estoque baixo
- Histórico de movimentações (entrada, saída, ajuste)
- Cálculo automático de custo de venda
- Relatório de margem por bebida

**Requisitos não-funcionais:**
- Suporte a receitas com até 10 ingredientes
- Cálculo de custo em < 100ms
- Auditoria de ajustes manuais

**Dados necessários:**
- Cadastro de bebidas (nome, categoria, unidade)
- Receitas (ingredientes, proporções)
- Movimentações de estoque

### 3.5 App Mobile de Garçom (Offline)

**Requisitos funcionais:**
- Visualizar mesas e suas comandas
- Adicionar/remover itens da comanda
- Sincronização automática quando online
- Modo offline: buffer local com IndexedDB
- Notificações de pedidos prontos (KDS)
- Histórico de comandas do dia

**Requisitos não-funcionais:**
- Funcionalidade completa offline
- Sincronização < 2s quando online
- Suporte a iOS e Android (React Native / Expo)
- Tamanho do app < 50MB

**Dados necessários:**
- Cardápio (sincronizado)
- Mesas (layout)
- Histórico de comandas

---

## 4. Arquitetura Técnica Proposta

### 4.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTES                                 │
├─────────────────────────────────────────────────────────────┤
│  Web (React)  │  Mobile (Expo)  │  Impressoras  │  Maquininha│
└────────┬──────────────────────────────────────────────┬──────┘
         │                                              │
    ┌────▼──────────────────────────────────────────────▼────┐
    │              API Express (Node.js)                     │
    │  ┌────────────────────────────────────────────────┐   │
    │  │  Rotas de Negócio                              │   │
    │  │  - Comanda (POST/PATCH/DELETE)                │   │
    │  │  - Pagamento (POST /checkout)                 │   │
    │  │  - NFC-e (POST /emitir)                       │   │
    │  │  - Estoque (GET/PATCH)                        │   │
    │  │  - Mesas (GET/POST)                           │   │
    │  └────────────────────────────────────────────────┘   │
    │  ┌────────────────────────────────────────────────┐   │
    │  │  Integrações Externas                          │   │
    │  │  - NFC-e (Focus NFe / PlugNotas)              │   │
    │  │  - Pagamento (Stone/Cielo/PagBank + Pix)     │   │
    │  │  - Comunicação (WhatsApp / E-mail)           │   │
    │  └────────────────────────────────────────────────┘   │
    │  ┌────────────────────────────────────────────────┐   │
    │  │  Realtime (SSE)                                │   │
    │  │  - Broadcast de eventos (comanda, pagamento)  │   │
    │  └────────────────────────────────────────────────┘   │
    └────┬──────────────────────────────────────────────┬────┘
         │                                              │
    ┌────▼──────────────────────┐  ┌─────────────────┐ │
    │  PostgreSQL (Produção)    │  │  GCS (Backups)  │ │
    │  - Comandas               │  │  - XML NFC-e    │ │
    │  - Estoque                │  │  - Logs         │ │
    │  - Pagamentos             │  └─────────────────┘ │
    │  - Auditoria              │                       │
    └───────────────────────────┘                       │
                                                        │
    ┌────────────────────────────────────────────────────┘
    │
    ▼
  Offline Buffer (IndexedDB)
  - Comandas pendentes
  - Pagamentos pendentes
```

### 4.2 Stack Tecnológico Recomendado

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Backend** | Node.js 18+ / Express | Já em produção, modular, SSE nativo |
| **Frontend Web** | React 18 + Vite 5 | Já em produção, performance |
| **Frontend Mobile** | React Native (Expo) | Compartilha código com web, offline-first |
| **Banco Principal** | PostgreSQL 15+ | Escalável, ACID, suporta JSON |
| **Cache/Realtime** | Redis (opcional) | Sessões, pub/sub para SSE |
| **Armazenamento** | GCP Cloud Storage | Backups, XML NFC-e, logs |
| **NFC-e** | Focus NFe (provedor) | Melhor suporte a MT, API estável |
| **Pagamento** | Stone SDK + Pix | Cobertura nacional, offline-ready |
| **Comunicação** | Resend (e-mail) + WhatsApp Cloud API | Transacional confiável |
| **Deploy** | GCP Cloud Run + Cloud SQL | Serverless, escalável, integrado |

### 4.3 Modelo de Dados Expandido

**Tabelas principais:**

```sql
-- Mesas e Comandas
CREATE TABLE mesas (
  id UUID PRIMARY KEY,
  numero INT UNIQUE,
  capacidade INT,
  status ENUM('livre', 'ocupada', 'reservada'),
  criado_em TIMESTAMP,
  atualizado_em TIMESTAMP
);

CREATE TABLE comandas (
  id UUID PRIMARY KEY,
  mesa_id UUID REFERENCES mesas,
  numero_sequencial INT,
  status ENUM('aberta', 'fechada', 'cancelada'),
  abertura TIMESTAMP,
  fechamento TIMESTAMP,
  garcom_id UUID,
  total DECIMAL(10,2),
  criado_em TIMESTAMP
);

CREATE TABLE itens_comanda (
  id UUID PRIMARY KEY,
  comanda_id UUID REFERENCES comandas,
  produto_id UUID REFERENCES produtos,
  quantidade DECIMAL(10,2),
  preco_unitario DECIMAL(10,2),
  desconto DECIMAL(10,2),
  subtotal DECIMAL(10,2),
  adicionado_por UUID,
  adicionado_em TIMESTAMP
);

-- Estoque
CREATE TABLE bebidas (
  id UUID PRIMARY KEY,
  nome VARCHAR(255),
  categoria VARCHAR(100),
  unidade_medida ENUM('ml', 'dose', 'litro'),
  estoque_atual DECIMAL(10,2),
  estoque_minimo DECIMAL(10,2),
  preco_custo DECIMAL(10,2),
  preco_venda DECIMAL(10,2),
  ativo BOOLEAN
);

CREATE TABLE receitas_drink (
  id UUID PRIMARY KEY,
  nome VARCHAR(255),
  descricao TEXT,
  ingredientes JSONB, -- [{bebida_id, quantidade, unidade}, ...]
  modo_preparo TEXT,
  custo_total DECIMAL(10,2),
  preco_venda DECIMAL(10,2),
  margem_percentual DECIMAL(5,2)
);

-- Pagamentos
CREATE TABLE pagamentos (
  id UUID PRIMARY KEY,
  comanda_id UUID REFERENCES comandas,
  valor DECIMAL(10,2),
  metodo ENUM('pix', 'dinheiro', 'cartao', 'tef'),
  status ENUM('pendente', 'autorizado', 'recusado', 'reembolsado'),
  gateway_id VARCHAR(255), -- ID externo (Stone, Cielo, etc)
  gateway_resposta JSONB,
  criado_em TIMESTAMP,
  atualizado_em TIMESTAMP
);

-- NFC-e
CREATE TABLE nfce_emissoes (
  id UUID PRIMARY KEY,
  comanda_id UUID REFERENCES comandas,
  numero INT,
  serie INT,
  chave_acesso VARCHAR(44),
  protocolo VARCHAR(255),
  status ENUM('autorizada', 'rejeitada', 'contingencia', 'cancelada'),
  xml_url VARCHAR(500),
  danfe_url VARCHAR(500),
  emitido_em TIMESTAMP,
  cancelado_em TIMESTAMP,
  motivo_cancelamento TEXT
);

-- Auditoria
CREATE TABLE auditoria (
  id UUID PRIMARY KEY,
  usuario_id UUID,
  acao VARCHAR(100),
  tabela VARCHAR(100),
  registro_id UUID,
  dados_antes JSONB,
  dados_depois JSONB,
  ip_address INET,
  user_agent TEXT,
  criado_em TIMESTAMP
);
```

### 4.4 APIs Principais

**Comanda:**
```
POST   /api/mesas/{id}/comandas          # Abrir comanda
GET    /api/comandas/{id}                # Detalhes
PATCH  /api/comandas/{id}                # Atualizar status
POST   /api/comandas/{id}/itens          # Adicionar item
DELETE /api/comandas/{id}/itens/{item}   # Remover item
POST   /api/comandas/{id}/fechar         # Fechar comanda
GET    /api/comandas/{id}/divisao        # Calcular divisão
```

**Pagamento:**
```
POST   /api/pagamentos/checkout          # Iniciar pagamento
GET    /api/pagamentos/{id}/status       # Status
POST   /api/pagamentos/{id}/reembolso    # Reembolsar
```

**NFC-e:**
```
POST   /api/nfce/emitir                  # Emitir NFC-e
GET    /api/nfce/{id}                    # Detalhes
POST   /api/nfce/{id}/cancelar           # Cancelar
GET    /api/nfce/{id}/danfe              # Download DANFE
```

**Estoque:**
```
GET    /api/bebidas                      # Listar
POST   /api/bebidas                      # Criar
PATCH  /api/bebidas/{id}                 # Atualizar
POST   /api/bebidas/{id}/movimentacao    # Entrada/saída
GET    /api/bebidas/{id}/historico       # Histórico
```

---

## 5. Roadmap de Implementação

### Fase 0: Preparação (1 semana)

**Objetivo:** Preparar infraestrutura e ambiente de desenvolvimento.

**Tarefas:**
1. Migrar banco de dados JSON → PostgreSQL (reescrever `db.js`)
2. Configurar GCP Cloud SQL (PostgreSQL 15)
3. Configurar GCP Cloud Storage para backups
4. Criar estrutura de testes (Jest + Supertest)
5. Documentar padrões de código e convenções
6. Setup de CI/CD (GitHub Actions)

**Entregas:**
- Repositório com CI/CD configurado
- Banco PostgreSQL em homologação
- Testes passando (13 existentes + 10 novos)

**Esforço:** 40h (1 dev)

---

### Fase 1: NFC-e Homologada (2 semanas)

**Objetivo:** Emissão de NFC-e real para Mato Grosso com suporte offline.

**Tarefas:**
1. Integrar SDK Focus NFe (produção)
2. Implementar contingência offline (buffer + reprocessamento)
3. Criar modelo `nfce_emissoes` no banco
4. Implementar cancelamento de NFC-e
5. Gerar DANFE para impressão
6. Testes com SEFAZ-MT (homologação)
7. Auditoria completa de emissões

**Entregas:**
- NFC-e emitida e autorizada pela SEFAZ-MT
- Contingência offline testada
- DANFE imprimível
- Documentação de setup (certificado A1, CSC)

**Esforço:** 80h (2 devs)

**Dependências:** Fase 0

---

### Fase 2: Comanda Eletrônica Avançada (2 semanas)

**Objetivo:** Sistema completo de comanda com divisão de conta.

**Tarefas:**
1. Criar modelo `comandas`, `itens_comanda`, `mesas`
2. Implementar CRUD de comandas (abrir/fechar/modificar)
3. Divisão de conta: por pessoa, por item, customizada
4. Histórico e auditoria de movimentações
5. Impressão de comanda (cozinha, cliente)
6. Integração com KDS (cozinha)
7. Testes de concorrência (50+ mesas)

**Entregas:**
- Comanda funcional com divisão
- Impressão de comanda
- Realtime atualizado (SSE)
- Testes de carga

**Esforço:** 80h (2 devs)

**Dependências:** Fase 0

---

### Fase 3: Integração de Pagamento (2 semanas)

**Objetivo:** Suporte a múltiplas maquininhas e Pix dinâmico.

**Tarefas:**
1. Integrar Stone SDK (TEF)
2. Integrar Cielo (TEF)
3. Integrar PagBank (API)
4. Implementar Pix dinâmico (QR por transação)
5. Suporte a dinheiro (manual)
6. Reembolso/cancelamento
7. Reconciliação com extrato
8. Testes com maquininhas reais

**Entregas:**
- Pagamento via Stone/Cielo/PagBank
- Pix dinâmico funcionando
- Reconciliação automática
- Documentação de setup

**Esforço:** 100h (2 devs)

**Dependências:** Fase 0, Fase 2

---

### Fase 4: Controle de Estoque (1.5 semanas)

**Objetivo:** Rastreamento de bebidas por dose com ficha técnica.

**Tarefas:**
1. Criar modelo `bebidas`, `receitas_drink`, `movimentacoes_estoque`
2. Cadastro de bebidas com unidade de medida
3. Ficha técnica de drink (ingredientes, custo)
4. Rastreamento em tempo real
5. Alerta de estoque baixo
6. Relatório de margem por bebida
7. Integração com comanda (cálculo automático de custo)

**Entregas:**
- Estoque rastreado por dose
- Ficha técnica de drink
- Relatório de margem
- Alertas funcionando

**Esforço:** 60h (1.5 devs)

**Dependências:** Fase 0, Fase 2

---

### Fase 5: App Mobile (3 semanas)

**Objetivo:** App offline-first para garçom (iOS + Android).

**Tarefas:**
1. Setup Expo + React Native
2. Compartilhar código com web (componentes, lógica)
3. Implementar IndexedDB local (WatermelonDB)
4. Sincronização automática (Replicache ou similar)
5. Modo offline completo
6. Notificações push (KDS)
7. Histórico de comandas
8. Testes em dispositivos reais

**Entregas:**
- App iOS + Android
- Funcionalidade offline completa
- Sincronização < 2s
- Testes de usabilidade

**Esforço:** 120h (2 devs)

**Dependências:** Fase 0, Fase 2

---

## 6. Timeline e Estimativas

| Fase | Duração | Esforço | Devs | Início | Fim |
|---|---|---|---|---|---|
| **Fase 0** | 1 semana | 40h | 1 | Semana 1 | Semana 1 |
| **Fase 1** | 2 semanas | 80h | 2 | Semana 2 | Semana 3 |
| **Fase 2** | 2 semanas | 80h | 2 | Semana 2 | Semana 3 |
| **Fase 3** | 2 semanas | 100h | 2 | Semana 4 | Semana 5 |
| **Fase 4** | 1.5 semanas | 60h | 1.5 | Semana 4 | Semana 5 |
| **Fase 5** | 3 semanas | 120h | 2 | Semana 6 | Semana 8 |
| **Total** | **8 semanas** | **480h** | **2-3 devs** | - | - |

**Observações:**
- Fases podem ser paralelas (1+2, 3+4 podem rodar juntas)
- Com 2 devs dedicados: 8 semanas até MVP completo
- Com 3 devs: 6 semanas
- Fase 5 (mobile) pode ser iniciada após Fase 2

---

## 7. Decisões Técnicas Críticas

### 7.1 Banco de Dados: PostgreSQL vs JSON

**Decisão:** Migrar para PostgreSQL em Fase 0.

**Justificativa:**
- JSON não suporta concorrência (lock de arquivo)
- PostgreSQL suporta JSONB (melhor dos dois mundos)
- Transações ACID são críticas para pagamentos
- Backup e recovery mais robustos
- Custo: GCP Cloud SQL free tier até 30GB

**Implementação:**
- Reescrever `db.js` com `pg` (node-postgres)
- Manter interface abstrata (sem quebra de código)
- Testes de migração de dados

### 7.2 NFC-e: Focus NFe vs PlugNotas

**Decisão:** Focus NFe como provedor principal.

**Justificativa:**
- Melhor suporte a contingência offline
- API mais estável
- Documentação completa
- Suporte a MT nativo
- Custo: R$ 0,50 por NFC-e (competitivo)

**Fallback:** PlugNotas (se Focus cair)

### 7.3 Pagamento: Stone vs Cielo vs PagBank

**Decisão:** Suportar todos os três (prioridade Stone).

**Justificativa:**
- Stone: melhor para comércio, Pix nativo, offline-ready
- Cielo: cobertura nacional, integração TEF
- PagBank: alternativa, Pix, sem maquininha
- Permitir que cliente escolha

**Implementação:**
- Adapter pattern (cada gateway é um módulo)
- Fallback automático se um cair
- Reconciliação com extrato

### 7.4 Offline: IndexedDB vs WatermelonDB vs Replicache

**Decisão:** WatermelonDB (mobile) + IndexedDB (web).

**Justificativa:**
- WatermelonDB: otimizado para React Native, sincronização automática
- IndexedDB: nativo no navegador, sem dependências
- Replicache: overkill para este caso (mais para CRDTs)

**Implementação:**
- Web: Service Worker + IndexedDB
- Mobile: WatermelonDB + background sync

### 7.5 Realtime: SSE vs WebSocket vs Polling

**Decisão:** Manter SSE (já implementado).

**Justificativa:**
- Já funciona em produção
- Suporta broadcast (KDS, mesas, portaria)
- Simples de manter
- Escalável com Redis Pub/Sub (opcional)

**Upgrade futuro:** WebSocket se volume crescer muito

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Certificado A1 não chega a tempo | Média | Alto | Começar processo imediatamente; usar homologação enquanto aguarda |
| SEFAZ-MT rejeita NFC-e | Baixa | Alto | Testar com Focus em homologação; ter suporte técnico Focus |
| Maquininha offline não funciona | Média | Médio | Testar com Stone em campo; ter fallback para Pix |
| Banco PostgreSQL cai | Baixa | Alto | Backup automático em GCS; RTO < 1h |
| App mobile não sincroniza | Média | Médio | Testes de sincronização desde Fase 5; ter fallback manual |
| Concorrência em 50+ mesas | Baixa | Médio | Testes de carga em Fase 2; usar connection pooling |

---

## 9. Estimativa de Custos (Mensal)

| Item | Opção | Custo |
|---|---|---|
| **GCP Cloud Run** | App containerizado | US$ 5–20 |
| **GCP Cloud SQL** | PostgreSQL 15 | US$ 10–50 |
| **GCP Cloud Storage** | Backups + XML | US$ 1–5 |
| **Focus NFe** | Emissão NFC-e | R$ 0,50 por nota |
| **Stone** | Maquininha + taxa | 2,99% por transação |
| **Pix** | Sem taxa | Grátis |
| **Resend** | E-mail transacional | US$ 0 (free tier: 3k/mês) |
| **WhatsApp API** | Mensagens | US$ 0,01 por mensagem |
| **Domínio** | .com.br | ~R$ 40/ano |
| **Certificado SSL** | HTTPS | Grátis (Let's Encrypt) |

**Total estimado:** US$ 20–100/mês (sem transações) + % de pagamentos

---

## 10. Próximos Passos Imediatos

1. **Semana 1:** Iniciar Fase 0 (PostgreSQL, CI/CD)
2. **Semana 2:** Iniciar Fase 1 (NFC-e) + Fase 2 (Comanda) em paralelo
3. **Semana 3:** Fase 1 em homologação SEFAZ-MT
4. **Semana 4:** Fase 3 (Pagamento) + Fase 4 (Estoque)
5. **Semana 6:** Fase 5 (Mobile) com base em Fase 2

**Critérios de sucesso:**
- ✅ NFC-e autorizada pela SEFAZ-MT
- ✅ Comanda com divisão funcionando
- ✅ Pagamento via Stone/Cielo/PagBank
- ✅ Estoque rastreado por dose
- ✅ App mobile offline-first

---

**Documento preparado por:** Manus AI  
**Revisão:** Pendente de aprovação  
**Próxima atualização:** Após Fase 0
