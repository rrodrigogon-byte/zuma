# 📋 Guia de Integração - Operação Completa do Kytto ERP

**Versão:** 2.0  
**Data:** 26 de julho de 2026  
**Autor:** Manus AI  
**Empresa:** Kytto

---

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Novas APIs](#novas-apis)
4. [Novas Telas](#novas-telas)
5. [Migração de Banco de Dados](#migração-de-banco-de-dados)
6. [Integração no Servidor](#integração-no-servidor)
7. [Testes](#testes)
8. [Deploy](#deploy)

---

## 🎯 Visão Geral

Este documento descreve a integração de três novos módulos operacionais no Kytto ERP:

| Módulo | Descrição | Arquivos |
|--------|-----------|----------|
| **Caixa Diário** | Abertura, fechamento, sangria e suprimento de caixas | `caixa-diario.js`, `CaixaDiario.jsx` |
| **Catálogo Fiscal** | CRUD de produtos com NCM, CEST e tributação | `produto.js`, `Catalogo.jsx` |
| **Pipas/Barris** | Controle de pipas com leitura manual e dispositivos | `pipas.js`, `Pipas.jsx` |

---

## 🏗️ Arquitetura

### Backend

```
app/
├── modules/
│   ├── caixa/
│   │   └── controllers/
│   │       └── caixa-diario.js (7 endpoints)
│   ├── catalogo/
│   │   └── controllers/
│   │       └── produto.js (5 endpoints)
│   └── bar/
│       └── controllers/
│           └── pipas.js (7 endpoints)
├── routes/
│   ├── caixa-diario.js
│   ├── catalogo.js
│   └── bar/routes-pipas.js
└── migrations/
    └── 002_catalogo_fiscal_pipas.sql
```

### Frontend

```
web/src/pages/
├── CaixaDiario.jsx + CaixaDiario.css
├── Catalogo.jsx + Catalogo.css
└── Pipas.jsx + Pipas.css
```

---

## 🔌 Novas APIs

### Caixa Diário

| Método | Endpoint | Descrição | RBAC |
|--------|----------|-----------|------|
| POST | `/caixa-diario/abrir` | Abrir novo caixa | admin, gerente, caixa, operador |
| GET | `/caixa-diario/aberto` | Obter caixas abertos | admin, gerente, caixa, operador, vendedor, garcom |
| POST | `/caixa-diario/sangria` | Registrar sangria | admin, gerente, caixa |
| POST | `/caixa-diario/suprimento` | Registrar suprimento | admin, gerente, caixa |
| POST | `/caixa-diario/fechar` | Fechar caixa com resumo | admin, gerente |
| GET | `/caixa-diario/:caixa_id/movimentacoes` | Obter movimentações | admin, gerente, caixa, operador |
| GET | `/caixa-diario/relatorio/diario` | Relatório diário | admin, gerente |

**Exemplo de Requisição:**

```bash
# Abrir caixa
curl -X POST http://localhost:3000/caixa-diario/abrir \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "numero_caixa": 1,
    "valor_abertura": 100.00,
    "observacoes": "Caixa 1 - PDV Principal"
  }'

# Registrar sangria
curl -X POST http://localhost:3000/caixa-diario/sangria \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caixa_id": "uuid-do-caixa",
    "valor": 500.00,
    "descricao": "Retirada para banco"
  }'

# Fechar caixa
curl -X POST http://localhost:3000/caixa-diario/fechar \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caixa_id": "uuid-do-caixa",
    "valor_contado": 1250.50,
    "observacoes": "Fechamento sem divergências"
  }'
```

### Catálogo de Produtos

| Método | Endpoint | Descrição | RBAC |
|--------|----------|-----------|------|
| POST | `/catalogo/produtos` | Criar produto | admin, gerente, vendedor |
| GET | `/catalogo/produtos` | Listar produtos | admin, gerente, vendedor, garcom, caixa, operador |
| GET | `/catalogo/produtos/:produto_id` | Obter produto | admin, gerente, vendedor, garcom, caixa, operador |
| PUT | `/catalogo/produtos/:produto_id` | Atualizar produto | admin, gerente, vendedor |
| DELETE | `/catalogo/produtos/:produto_id` | Deletar produto (soft delete) | admin, gerente |

**Exemplo de Requisição:**

```bash
# Criar produto com NCM
curl -X POST http://localhost:3000/catalogo/produtos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_interno": "PROD-001",
    "codigo_barras": "1234567890123",
    "nome": "Cerveja Premium 600ml",
    "categoria_id": "uuid-categoria",
    "preco_custo": 2.50,
    "preco_venda": 5.99,
    "unidade_medida": "un",
    "ncm": "22021000",
    "cest": "2100100",
    "cst_icms": "00",
    "aliquota_icms": 7.00,
    "cst_pis": "01",
    "aliquota_pis": 1.65,
    "cst_cofins": "01",
    "aliquota_cofins": 7.60,
    "marca": "Brahma"
  }'
```

### Pipas e Barris

| Método | Endpoint | Descrição | RBAC |
|--------|----------|-----------|------|
| POST | `/bar/pipas` | Cadastrar pipa | admin, gerente, garcom |
| GET | `/bar/pipas` | Listar pipas | admin, gerente, garcom, operador, caixa |
| GET | `/bar/pipas/:pipa_id` | Obter pipa | admin, gerente, garcom, operador, caixa |
| POST | `/bar/pipas/:pipa_id/leitura` | Registrar leitura | admin, gerente, garcom, operador |
| GET | `/bar/pipas/:pipa_id/leituras` | Histórico de leituras | admin, gerente, garcom, operador |
| PUT | `/bar/pipas/:pipa_id/status` | Atualizar status | admin, gerente |
| POST | `/bar/pipas/dispositivo/registrar-leitura` | Integração com dispositivos | (sem autenticação JWT, apenas API key) |

**Exemplo de Requisição:**

```bash
# Cadastrar pipa
curl -X POST http://localhost:3000/bar/pipas \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "numero_pipa": "PIPA-001",
    "produto_id": "uuid-produto",
    "capacidade_litros": 50.00,
    "data_entrada": "2026-07-26"
  }'

# Registrar leitura
curl -X POST http://localhost:3000/bar/pipas/uuid-pipa/leitura \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nivel_litros": 35.50,
    "metodo_leitura": "manual",
    "observacoes": "Leitura manual realizada"
  }'

# Integração com dispositivo (sem JWT)
curl -X POST http://localhost:3000/bar/pipas/dispositivo/registrar-leitura \
  -H "Content-Type: application/json" \
  -d '{
    "numero_pipa": "PIPA-001",
    "nivel_litros": 35.50,
    "dispositivo_id": "SENSOR-001",
    "timestamp": "2026-07-26T14:30:00Z"
  }'
```

---

## 🎨 Novas Telas

### CaixaDiario.jsx

**Funcionalidades:**
- 5 abas: Abrir, Sangria, Suprimento, Fechar, Relatório
- Seleção visual de caixas abertos
- Resumo de fechamento com divergências
- Tabelas de movimentações
- Alertas animados

**Rotas:**
- `/operacao/caixa-diario`

### Catalogo.jsx

**Funcionalidades:**
- CRUD completo de produtos
- Busca e filtro por categoria
- Formulário com 5 seções (básica, preços, fiscal, tributação, CSOSN)
- Validações em tempo real
- Tabela com ações

**Rotas:**
- `/operacao/catalogo`

### Pipas.jsx

**Funcionalidades:**
- 4 abas: Lista, Cadastrar, Registrar Leitura, Histórico
- Grid de pipas com cards visuais
- Barra de progresso com cores
- Alertas automáticos (crítico/aviso)
- Suporte a múltiplos métodos de leitura

**Rotas:**
- `/operacao/pipas`

---

## 🗄️ Migração de Banco de Dados

### Executar Migração

```bash
# Conectar ao PostgreSQL
psql -h localhost -U postgres -d erp_modular

# Executar migração
\i app/migrations/002_catalogo_fiscal_pipas.sql

# Verificar tabelas criadas
\dt pipas
\dt leituras_pipa
\dt alertas_pipa
```

### Tabelas Criadas

| Tabela | Descrição | Colunas |
|--------|-----------|---------|
| `pipas` | Cadastro de pipas/barris | id, empresa_id, numero_pipa, produto_id, capacidade_litros, status, ... |
| `leituras_pipa` | Histórico de leituras | id, pipa_id, nivel_litros, metodo_leitura, dispositivo_id, consumo_estimado, ... |
| `alertas_pipa` | Alertas automáticos | id, pipa_id, tipo (CRITICO/AVISO/INFO), mensagem, data_alerta, ... |

### Campos Adicionados a `produtos`

```sql
ALTER TABLE produtos ADD COLUMN ncm VARCHAR(8);
ALTER TABLE produtos ADD COLUMN cest VARCHAR(7);
ALTER TABLE produtos ADD COLUMN cfop VARCHAR(4);
ALTER TABLE produtos ADD COLUMN cst_icms VARCHAR(2);
ALTER TABLE produtos ADD COLUMN aliquota_icms DECIMAL(5, 2);
ALTER TABLE produtos ADD COLUMN cst_pis VARCHAR(2);
ALTER TABLE produtos ADD COLUMN aliquota_pis DECIMAL(5, 2);
ALTER TABLE produtos ADD COLUMN cst_cofins VARCHAR(2);
ALTER TABLE produtos ADD COLUMN aliquota_cofins DECIMAL(5, 2);
ALTER TABLE produtos ADD COLUMN csosn VARCHAR(3);
ALTER TABLE produtos ADD COLUMN marca VARCHAR(100);
ALTER TABLE produtos ADD COLUMN fornecedor_id UUID;
```

---

## 🔗 Integração no Servidor

### 1. Atualizar `app/server-v2-updated.js`

```javascript
// Importar novas rotas
import caixaDiarioRoutes from './routes/caixa-diario.js';
import catalogoRoutes from './routes/catalogo.js';
import pipasRoutes from './modules/bar/routes-pipas.js';

// Montar rotas
app.use('/caixa-diario', caixaDiarioRoutes);
app.use('/catalogo', catalogoRoutes);
app.use('/bar/pipas', pipasRoutes);
```

### 2. Verificar Middleware

As rotas já incluem:
- `authMiddleware` — Autenticação JWT
- `tenantMiddleware` — Isolamento multi-tenant
- `requireRole()` — RBAC por função

### 3. Testar Servidor

```bash
# Iniciar servidor
npm start

# Verificar se rotas estão disponíveis
curl http://localhost:3000/health
```

---

## ✅ Testes

### Testes de API (Jest + Supertest)

```javascript
// app/tests/operacional.test.js
import request from 'supertest';
import app from '../server-v2-updated.js';

describe('Caixa Diário', () => {
  it('deve abrir um caixa', async () => {
    const response = await request(app)
      .post('/caixa-diario/abrir')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_caixa: 1,
        valor_abertura: 100.00
      });
    expect(response.status).toBe(201);
    expect(response.body.sucesso).toBe(true);
  });
});

describe('Catálogo', () => {
  it('deve criar um produto com NCM', async () => {
    const response = await request(app)
      .post('/catalogo/produtos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo_interno: 'PROD-001',
        nome: 'Cerveja',
        categoria_id: categoryId,
        preco_custo: 2.50,
        preco_venda: 5.99,
        ncm: '22021000'
      });
    expect(response.status).toBe(201);
    expect(response.body.produto.ncm).toBe('22021000');
  });
});

describe('Pipas', () => {
  it('deve cadastrar uma pipa', async () => {
    const response = await request(app)
      .post('/bar/pipas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_pipa: 'PIPA-001',
        produto_id: productId,
        capacidade_litros: 50.00
      });
    expect(response.status).toBe(201);
  });
});
```

### Executar Testes

```bash
npm test -- operacional.test.js
```

---

## 🚀 Deploy

### 1. Preparar Código

```bash
# Clonar repositório
git clone https://github.com/rrodrigogon-byte/agro-open.git
cd agro-open

# Instalar dependências
npm install

# Executar testes
npm test

# Build frontend
cd web && npm run build && cd ..
```

### 2. Deploy no GCP Cloud Run

```bash
# Configurar variáveis de ambiente
export DB_HOST=cloudsql-instance
export DB_PORT=5432
export DB_NAME=erp_modular
export DB_USER=postgres
export DB_PASSWORD=***
export JWT_SECRET=***
export NODE_ENV=production

# Build Docker
docker build -t kytto-erp:2.0 .

# Push para Google Container Registry
docker tag kytto-erp:2.0 gcr.io/avd-uisa-sistema-vision/kytto-erp:2.0
docker push gcr.io/avd-uisa-sistema-vision/kytto-erp:2.0

# Deploy no Cloud Run
gcloud run deploy kytto-erp \
  --image gcr.io/avd-uisa-sistema-vision/kytto-erp:2.0 \
  --platform managed \
  --region us-central1 \
  --set-env-vars DB_HOST=cloudsql-instance,DB_PORT=5432,DB_NAME=erp_modular \
  --allow-unauthenticated
```

### 3. Executar Migração em Produção

```bash
# Conectar ao Cloud SQL
gcloud sql connect erp-modular --user=postgres

# Executar migração
\i app/migrations/002_catalogo_fiscal_pipas.sql

# Verificar
SELECT COUNT(*) FROM pipas;
SELECT COUNT(*) FROM leituras_pipa;
```

### 4. Verificar Deploy

```bash
# Testar endpoint de saúde
curl https://kytto-erp-xxxxx.run.app/health

# Testar API de caixa
curl https://kytto-erp-xxxxx.run.app/caixa-diario/aberto \
  -H "Authorization: Bearer TOKEN"
```

---

## 📊 Monitoramento

### Logs

```bash
# Ver logs em tempo real
gcloud run logs read kytto-erp --limit 50 --follow

# Filtrar por erro
gcloud run logs read kytto-erp --limit 100 | grep ERROR
```

### Métricas

- **Requisições por segundo:** Cloud Run > Metrics
- **Latência:** Cloud Run > Metrics > Request latencies
- **Taxa de erro:** Cloud Run > Metrics > Error rate

---

## 🔧 Troubleshooting

| Problema | Solução |
|----------|---------|
| Erro 401 Unauthorized | Verificar JWT token e `Authorization` header |
| Erro 404 Not Found | Verificar se rotas estão montadas em `server-v2-updated.js` |
| Erro 500 Database | Verificar conexão PostgreSQL e variáveis de ambiente |
| Erro de Migração | Executar `\d pipas` para verificar se tabela existe |
| Leitura de Pipa não registra | Verificar se `pipa_id` é válido e pipa está ativa |

---

## 📚 Referências

- [Documentação Técnica Completa](./DOCUMENTACAO-TECNICA-MODULOS-KYTTO.md)
- [Resumo de Módulos](./KYTTO-ERP-RESUMO-FINAL.md)
- [Guia de Deploy GCP](./GUIA-DEPLOY-GCP.md)
- [OpenAPI/Swagger](./app/docs/openapi.json)

---

## ✨ Próximos Passos

1. **Telas de Relatórios:** Gráficos de vendas, estoque e pipas
2. **App Mobile:** Sincronização offline de caixa e pipas
3. **Integração com Dispositivos:** Balança, sensor ultrassônico, medidor de fluxo
4. **Automação:** Alertas por email/SMS quando pipa atinge nível crítico
5. **Analytics:** Dashboard com KPIs de caixa, produtos e consumo

---

**Desenvolvido com ❤️ por Manus AI para Kytto**
