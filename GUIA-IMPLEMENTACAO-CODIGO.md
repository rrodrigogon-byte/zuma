# SetPoint · Guia de Implementação com Exemplos de Código

**Documento preparado por:** Manus AI  
**Data:** 26 de julho de 2026  
**Versão:** 1.0

---

## 1. Migração JSON → PostgreSQL

### 1.1 Nova Interface `db.js`

```javascript
// app/db.js — interface abstrata com PostgreSQL
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:pass@localhost/setpoint',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Manter compatibilidade com interface anterior
let _cache = {};

export function db() {
  return _cache;
}

export async function load() {
  try {
    // Carregar dados críticos em cache para operações frequentes
    const res = await pool.query('SELECT * FROM mesas');
    _cache.mesas = res.rows;
    console.log('✓ Banco carregado');
  } catch (e) {
    console.error('Erro ao carregar banco:', e);
    throw e;
  }
}

export async function save() {
  // Com PostgreSQL, não precisa de save explícito (ACID)
  console.log('✓ Dados persistidos (PostgreSQL)');
}

export async function nextId(tabela) {
  const res = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id, 1, 10) AS INTEGER)), 0) + 1 as next_id FROM ${tabela}`
  );
  return res.rows[0].next_id;
}

// Queries específicas
export async function query(sql, params = []) {
  return pool.query(sql, params);
}

export async function queryOne(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows[0];
}

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function close() {
  await pool.end();
}
```

### 1.2 Schema SQL Inicial

```sql
-- Criar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mesas
CREATE TABLE mesas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero INT UNIQUE NOT NULL,
  capacidade INT NOT NULL,
  status VARCHAR(20) DEFAULT 'livre', -- livre, ocupada, reservada
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comandas
CREATE TABLE comandas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mesa_id UUID NOT NULL REFERENCES mesas(id),
  numero_sequencial INT NOT NULL,
  status VARCHAR(20) DEFAULT 'aberta', -- aberta, fechada, cancelada
  abertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fechamento TIMESTAMP,
  garcom_id UUID,
  total DECIMAL(10,2) DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mesa_id, numero_sequencial)
);

-- Itens da Comanda
CREATE TABLE itens_comanda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id UUID NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL,
  quantidade DECIMAL(10,2) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario - desconto) STORED,
  adicionado_por UUID,
  adicionado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removido_em TIMESTAMP
);

-- Bebidas
CREATE TABLE bebidas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  unidade_medida VARCHAR(20), -- ml, dose, litro
  estoque_atual DECIMAL(10,2) DEFAULT 0,
  estoque_minimo DECIMAL(10,2) DEFAULT 0,
  preco_custo DECIMAL(10,2),
  preco_venda DECIMAL(10,2),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Receitas de Drink
CREATE TABLE receitas_drink (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ingredientes JSONB, -- [{bebida_id, quantidade, unidade}, ...]
  modo_preparo TEXT,
  custo_total DECIMAL(10,2),
  preco_venda DECIMAL(10,2),
  margem_percentual DECIMAL(5,2) GENERATED ALWAYS AS 
    CASE WHEN preco_venda > 0 THEN ((preco_venda - custo_total) / preco_venda * 100) ELSE 0 END STORED,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Movimentações de Estoque
CREATE TABLE movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bebida_id UUID NOT NULL REFERENCES bebidas(id),
  tipo VARCHAR(20), -- entrada, saida, ajuste
  quantidade DECIMAL(10,2) NOT NULL,
  motivo TEXT,
  usuario_id UUID,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pagamentos
CREATE TABLE pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id UUID NOT NULL REFERENCES comandas(id),
  valor DECIMAL(10,2) NOT NULL,
  metodo VARCHAR(20) NOT NULL, -- pix, dinheiro, cartao, tef
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, autorizado, recusado, reembolsado
  gateway_id VARCHAR(255),
  gateway_resposta JSONB,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NFC-e
CREATE TABLE nfce_emissoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id UUID NOT NULL REFERENCES comandas(id),
  numero INT NOT NULL,
  serie INT NOT NULL,
  chave_acesso VARCHAR(44),
  protocolo VARCHAR(255),
  status VARCHAR(20), -- autorizada, rejeitada, contingencia, cancelada
  xml_url VARCHAR(500),
  danfe_url VARCHAR(500),
  emitido_em TIMESTAMP,
  cancelado_em TIMESTAMP,
  motivo_cancelamento TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(numero, serie)
);

-- Auditoria
CREATE TABLE auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID,
  acao VARCHAR(100),
  tabela VARCHAR(100),
  registro_id UUID,
  dados_antes JSONB,
  dados_depois JSONB,
  ip_address INET,
  user_agent TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_comandas_mesa_id ON comandas(mesa_id);
CREATE INDEX idx_comandas_status ON comandas(status);
CREATE INDEX idx_itens_comanda_id ON itens_comanda(comanda_id);
CREATE INDEX idx_pagamentos_comanda_id ON pagamentos(comanda_id);
CREATE INDEX idx_nfce_comanda_id ON nfce_emissoes(comanda_id);
CREATE INDEX idx_auditoria_criado_em ON auditoria(criado_em);
```

---

## 2. Rotas de Comanda Eletrônica

### 2.1 Abrir/Fechar Comanda

```javascript
// app/server.js — adicionar rotas

// Abrir comanda
app.post('/api/mesas/:mesaId/comandas', authMiddleware, async (req, res) => {
  try {
    const { mesaId } = req.params;
    const { garcomId } = req.body;

    // Verificar se mesa existe
    const mesa = await db().queryOne('SELECT * FROM mesas WHERE id = $1', [mesaId]);
    if (!mesa) return res.status(404).json({ erro: 'Mesa não encontrada' });

    // Criar comanda
    const result = await db().query(
      `INSERT INTO comandas (mesa_id, numero_sequencial, garcom_id, status)
       VALUES ($1, (SELECT COALESCE(MAX(numero_sequencial), 0) + 1 FROM comandas WHERE mesa_id = $1), $2, 'aberta')
       RETURNING *`,
      [mesaId, garcomId]
    );

    const comanda = result.rows[0];

    // Atualizar status da mesa
    await db().query('UPDATE mesas SET status = $1, atualizado_em = NOW() WHERE id = $2', ['ocupada', mesaId]);

    // Auditoria
    await registrarAuditoria(req, 'criar', 'comandas', comanda.id, null, comanda);

    // Broadcast via SSE
    sseBroadcast('comanda:aberta', { mesaId, comanda });

    res.json({ sucesso: true, comanda });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

// Fechar comanda
app.post('/api/comandas/:id/fechar', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { pagamentos } = req.body; // [{metodo, valor}, ...]

    const comanda = await db().queryOne('SELECT * FROM comandas WHERE id = $1', [id]);
    if (!comanda) return res.status(404).json({ erro: 'Comanda não encontrada' });
    if (comanda.status !== 'aberta') return res.status(400).json({ erro: 'Comanda não está aberta' });

    // Usar transação para garantir consistência
    await db().transaction(async (client) => {
      // Registrar pagamentos
      for (const pag of pagamentos) {
        await client.query(
          `INSERT INTO pagamentos (comanda_id, valor, metodo, status)
           VALUES ($1, $2, $3, 'autorizado')`,
          [id, pag.valor, pag.metodo]
        );
      }

      // Fechar comanda
      const total = pagamentos.reduce((sum, p) => sum + p.valor, 0);
      await client.query(
        `UPDATE comandas SET status = 'fechada', fechamento = NOW(), total = $1, atualizado_em = NOW()
         WHERE id = $2`,
        [total, id]
      );

      // Liberar mesa
      await client.query(
        `UPDATE mesas SET status = 'livre', atualizado_em = NOW() WHERE id = $1`,
        [comanda.mesa_id]
      );
    });

    // Auditoria
    await registrarAuditoria(req, 'fechar', 'comandas', id, { status: 'aberta' }, { status: 'fechada' });

    // Broadcast
    sseBroadcast('comanda:fechada', { mesaId: comanda.mesa_id, comandaId: id });

    res.json({ sucesso: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

// Adicionar item à comanda
app.post('/api/comandas/:id/itens', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { produtoId, quantidade, precoUnitario } = req.body;

    const result = await db().query(
      `INSERT INTO itens_comanda (comanda_id, produto_id, quantidade, preco_unitario, adicionado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, produtoId, quantidade, precoUnitario, req.user.id]
    );

    const item = result.rows[0];

    // Atualizar total da comanda
    const total = await db().queryOne(
      `SELECT SUM(subtotal) as total FROM itens_comanda WHERE comanda_id = $1 AND removido_em IS NULL`,
      [id]
    );
    await db().query('UPDATE comandas SET total = $1, atualizado_em = NOW() WHERE id = $2', [total.total || 0, id]);

    // Auditoria
    await registrarAuditoria(req, 'adicionar_item', 'itens_comanda', item.id, null, item);

    // Broadcast
    sseBroadcast('comanda:item_adicionado', { comandaId: id, item });

    res.json({ sucesso: true, item });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

// Remover item da comanda
app.delete('/api/comandas/:id/itens/:itemId', authMiddleware, async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const item = await db().queryOne('SELECT * FROM itens_comanda WHERE id = $1', [itemId]);
    if (!item) return res.status(404).json({ erro: 'Item não encontrado' });

    // Soft delete (marcar como removido)
    await db().query('UPDATE itens_comanda SET removido_em = NOW() WHERE id = $1', [itemId]);

    // Recalcular total
    const total = await db().queryOne(
      `SELECT SUM(subtotal) as total FROM itens_comanda WHERE comanda_id = $1 AND removido_em IS NULL`,
      [id]
    );
    await db().query('UPDATE comandas SET total = $1, atualizado_em = NOW() WHERE id = $2', [total.total || 0, id]);

    // Auditoria
    await registrarAuditoria(req, 'remover_item', 'itens_comanda', itemId, item, null);

    // Broadcast
    sseBroadcast('comanda:item_removido', { comandaId: id, itemId });

    res.json({ sucesso: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});
```

### 2.2 Divisão de Conta

```javascript
// Calcular divisão de conta
app.get('/api/comandas/:id/divisao', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, pessoas } = req.query; // tipo: 'igual', 'por_item', 'customizado'

    const itens = await db().query(
      `SELECT * FROM itens_comanda WHERE comanda_id = $1 AND removido_em IS NULL ORDER BY adicionado_em`,
      [id]
    );

    const comanda = await db().queryOne('SELECT * FROM comandas WHERE id = $1', [id]);

    let divisao = [];

    if (tipo === 'igual') {
      const numPessoas = parseInt(pessoas) || 1;
      const valorPorPessoa = comanda.total / numPessoas;
      for (let i = 0; i < numPessoas; i++) {
        divisao.push({
          pessoa: i + 1,
          valor: valorPorPessoa,
          itens: []
        });
      }
    } else if (tipo === 'por_item') {
      // Cada pessoa paga por seus itens
      const pessoasArray = JSON.parse(pessoas || '[]');
      for (const pessoa of pessoasArray) {
        const valor = itens.rows
          .filter(item => pessoa.itens.includes(item.id))
          .reduce((sum, item) => sum + item.subtotal, 0);
        divisao.push({
          pessoa: pessoa.nome,
          valor,
          itens: pessoa.itens
        });
      }
    }

    res.json({ sucesso: true, divisao, total: comanda.total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});
```

---

## 3. Integração NFC-e com Contingência Offline

### 3.1 Emissão com Buffer

```javascript
// app/nfce-buffer.js — gerenciar fila de emissão

import { emitir as emitirNfce } from './nfce.js';

export class BufferNfce {
  constructor(db) {
    this.db = db;
    this.fila = [];
    this.processando = false;
  }

  async adicionarFila(nota) {
    // Salvar na fila (banco)
    const result = await this.db.query(
      `INSERT INTO nfce_buffer (comanda_id, numero, serie, itens, status, tentativas)
       VALUES ($1, $2, $3, $4, 'pendente', 0)
       RETURNING *`,
      [nota.comandaId, nota.numero, nota.serie, JSON.stringify(nota.itens)]
    );
    return result.rows[0];
  }

  async procesarFila() {
    if (this.processando) return;
    this.processando = true;

    try {
      // Buscar notas pendentes
      const notas = await this.db.query(
        `SELECT * FROM nfce_buffer WHERE status = 'pendente' AND tentativas < 3 ORDER BY criado_em LIMIT 10`
      );

      for (const nota of notas.rows) {
        try {
          const resultado = await emitirNfce({
            numero: nota.numero,
            serie: nota.serie,
            itens: JSON.parse(nota.itens),
            comandaId: nota.comanda_id
          });

          if (resultado.status === 'autorizada') {
            // Salvar NFC-e autorizada
            await this.db.query(
              `INSERT INTO nfce_emissoes (comanda_id, numero, serie, chave_acesso, protocolo, status)
               VALUES ($1, $2, $3, $4, $5, 'autorizada')`,
              [nota.comanda_id, nota.numero, nota.serie, resultado.chaveAcesso, resultado.protocolo]
            );

            // Remover da fila
            await this.db.query('DELETE FROM nfce_buffer WHERE id = $1', [nota.id]);
          } else if (resultado.status === 'contingencia') {
            // Manter na fila, incrementar tentativas
            await this.db.query(
              `UPDATE nfce_buffer SET tentativas = tentativas + 1, ultima_tentativa = NOW() WHERE id = $1`,
              [nota.id]
            );
          } else {
            // Rejeitada — marcar como erro
            await this.db.query(
              `UPDATE nfce_buffer SET status = 'rejeitada', motivo = $1 WHERE id = $2`,
              [resultado.motivoRejeicao, nota.id]
            );
          }
        } catch (e) {
          console.error('Erro ao processar NFC-e:', e);
          await this.db.query(
            `UPDATE nfce_buffer SET tentativas = tentativas + 1 WHERE id = $1`,
            [nota.id]
          );
        }
      }
    } finally {
      this.processando = false;
    }
  }

  // Iniciar processamento periódico (a cada 30s)
  iniciarProcessamento() {
    setInterval(() => this.procesarFila(), 30000);
  }
}
```

### 3.2 Rota de Emissão com Contingência

```javascript
// app/server.js — rota de emissão NFC-e

app.post('/api/nfce/emitir', authMiddleware, async (req, res) => {
  try {
    const { comandaId } = req.body;

    const comanda = await db().queryOne('SELECT * FROM comandas WHERE id = $1', [comandaId]);
    if (!comanda) return res.status(404).json({ erro: 'Comanda não encontrada' });

    // Buscar itens
    const itens = await db().query(
      `SELECT * FROM itens_comanda WHERE comanda_id = $1 AND removido_em IS NULL`,
      [comandaId]
    );

    // Preparar nota
    const nota = {
      comandaId,
      numero: await db().nextId('nfce_emissoes'),
      serie: 1,
      itens: itens.rows.map(i => ({
        nome: i.descricao,
        quantidade: i.quantidade,
        valor: i.preco_unitario
      })),
      valorTotal: comanda.total,
      ambiente: process.env.NFCE_AMBIENTE || 'homologacao'
    };

    // Tentar emitir
    const resultado = await emitirNfce(nota);

    if (resultado.status === 'autorizada') {
      // Salvar NFC-e
      await db().query(
        `INSERT INTO nfce_emissoes (comanda_id, numero, serie, chave_acesso, protocolo, status, emitido_em)
         VALUES ($1, $2, $3, $4, $5, 'autorizada', NOW())`,
        [comandaId, nota.numero, nota.serie, resultado.chaveAcesso, resultado.protocolo]
      );

      res.json({ sucesso: true, nfce: resultado });
    } else if (resultado.status === 'contingencia') {
      // Adicionar à fila
      const buffer = new BufferNfce(db());
      await buffer.adicionarFila(nota);

      res.json({
        sucesso: true,
        modo: 'contingencia',
        mensagem: 'NFC-e será emitida quando conexão for restaurada',
        nfce: resultado
      });
    } else {
      res.status(400).json({ erro: resultado.motivoRejeicao });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});
```

---

## 4. Integração Stone/Cielo (TEF)

### 4.1 Adapter de Pagamento

```javascript
// app/payment-gateway.js — abstração de gateways

export class PaymentGateway {
  constructor(tipo) {
    this.tipo = tipo;
  }

  async autorizar(valor, descricao) {
    switch (this.tipo) {
      case 'stone':
        return this.autorizarStone(valor, descricao);
      case 'cielo':
        return this.autorizarCielo(valor, descricao);
      case 'pagbank':
        return this.autorizarPagBank(valor, descricao);
      default:
        throw new Error('Gateway desconhecido');
    }
  }

  async autorizarStone(valor, descricao) {
    const stoneKey = process.env.STONE_API_KEY;
    if (!stoneKey) throw new Error('Stone não configurado');

    try {
      const response = await fetch('https://api.stone.com.br/v1/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stoneKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(valor * 100), // centavos
          payment_method: 'debit_card',
          description: descricao,
          customer: { name: 'Bar' }
        })
      });

      if (!response.ok) {
        throw new Error(`Stone: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        gateway: 'stone',
        status: data.status === 'approved' ? 'autorizado' : 'recusado',
        transactionId: data.id,
        resposta: data
      };
    } catch (e) {
      return {
        gateway: 'stone',
        status: 'erro',
        erro: e.message
      };
    }
  }

  async autorizarCielo(valor, descricao) {
    // Implementar similar a Stone
    // Usar Cielo SDK ou API
  }

  async autorizarPagBank(valor, descricao) {
    // Implementar similar a Stone
  }

  async reembolsar(transactionId) {
    // Reembolsar transação
  }
}
```

### 4.2 Rota de Pagamento

```javascript
// app/server.js — rota de checkout

app.post('/api/pagamentos/checkout', authMiddleware, async (req, res) => {
  try {
    const { comandaId, metodo, valor } = req.body;

    const comanda = await db().queryOne('SELECT * FROM comandas WHERE id = $1', [comandaId]);
    if (!comanda) return res.status(404).json({ erro: 'Comanda não encontrada' });

    let resultado;

    if (metodo === 'pix') {
      // Pix dinâmico via Mercado Pago
      const pix = await criarPix({ valor, descricao: `Comanda ${comanda.numero_sequencial}` });
      resultado = {
        metodo: 'pix',
        status: 'pendente',
        copiaECola: pix.copiaECola,
        qrCode: await gerarQRCode(pix.copiaECola)
      };
    } else if (metodo === 'tef') {
      // TEF (Stone/Cielo)
      const gateway = new PaymentGateway(process.env.PAYMENT_GATEWAY || 'stone');
      resultado = await gateway.autorizar(valor, `Comanda ${comanda.numero_sequencial}`);
    } else if (metodo === 'dinheiro') {
      resultado = {
        metodo: 'dinheiro',
        status: 'pendente_confirmacao'
      };
    }

    // Salvar pagamento
    const pagResult = await db().query(
      `INSERT INTO pagamentos (comanda_id, valor, metodo, status, gateway_resposta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [comandaId, valor, metodo, resultado.status, JSON.stringify(resultado)]
    );

    // Broadcast
    sseBroadcast('pagamento:iniciado', { comandaId, pagamento: pagResult.rows[0] });

    res.json({ sucesso: true, pagamento: pagResult.rows[0], resultado });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});
```

---

## 5. Controle de Estoque por Dose

### 5.1 Modelo de Bebida e Receita

```javascript
// app/server.js — rotas de estoque

// Criar bebida
app.post('/api/bebidas', authMiddleware, async (req, res) => {
  try {
    const { nome, categoria, unidadeMedida, estoque, precoCusto, precoVenda } = req.body;

    const result = await db().query(
      `INSERT INTO bebidas (nome, categoria, unidade_medida, estoque_atual, preco_custo, preco_venda)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nome, categoria, unidadeMedida, estoque, precoCusto, precoVenda]
    );

    res.json({ sucesso: true, bebida: result.rows[0] });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Criar receita de drink
app.post('/api/receitas-drink', authMiddleware, async (req, res) => {
  try {
    const { nome, ingredientes, precoVenda } = req.body;
    // ingredientes: [{bebidasId, quantidade, unidade}, ...]

    // Calcular custo total
    let custoTotal = 0;
    for (const ing of ingredientes) {
      const bebida = await db().queryOne('SELECT preco_custo FROM bebidas WHERE id = $1', [ing.bebidasId]);
      if (bebida) {
        custoTotal += bebida.preco_custo * ing.quantidade;
      }
    }

    const result = await db().query(
      `INSERT INTO receitas_drink (nome, ingredientes, custo_total, preco_venda)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nome, JSON.stringify(ingredientes), custoTotal, precoVenda]
    );

    res.json({ sucesso: true, receita: result.rows[0] });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Registrar movimentação de estoque
app.post('/api/bebidas/:id/movimentacao', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, quantidade, motivo } = req.body; // tipo: entrada, saida, ajuste

    const bebida = await db().queryOne('SELECT * FROM bebidas WHERE id = $1', [id]);
    if (!bebida) return res.status(404).json({ erro: 'Bebida não encontrada' });

    // Calcular novo estoque
    let novoEstoque = bebida.estoque_atual;
    if (tipo === 'entrada') novoEstoque += quantidade;
    else if (tipo === 'saida') novoEstoque -= quantidade;
    else if (tipo === 'ajuste') novoEstoque = quantidade;

    // Atualizar estoque
    await db().query('UPDATE bebidas SET estoque_atual = $1, atualizado_em = NOW() WHERE id = $2', [novoEstoque, id]);

    // Registrar movimentação
    const result = await db().query(
      `INSERT INTO movimentacoes_estoque (bebida_id, tipo, quantidade, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, tipo, quantidade, motivo, req.user.id]
    );

    // Verificar alerta de estoque baixo
    if (novoEstoque <= bebida.estoque_minimo) {
      sseBroadcast('estoque:alerta', { bebida: bebida.nome, estoque: novoEstoque });
    }

    res.json({ sucesso: true, movimentacao: result.rows[0] });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});
```

---

## 6. App Mobile (React Native + Expo)

### 6.1 Setup Inicial

```bash
# Criar projeto Expo
npx create-expo-app@latest setpoint-garcom
cd setpoint-garcom

# Instalar dependências
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install axios zustand watemelondb
npm install expo-sqlite expo-background-fetch expo-task-manager
```

### 6.2 Store Offline (Zustand + WatermelonDB)

```javascript
// app-mobile/store/comandaStore.js

import { create } from 'zustand';
import { database } from '../db/watermelon';

export const useComandaStore = create((set, get) => ({
  comandas: [],
  mesas: [],
  sincronizando: false,

  // Carregar dados locais
  carregarLocais: async () => {
    const comandasDb = await database.get('comandas').query().fetch();
    const mesasDb = await database.get('mesas').query().fetch();
    set({ comandas: comandasDb, mesas: mesasDb });
  },

  // Adicionar item à comanda (local)
  adicionarItem: async (comandaId, produto) => {
    const comanda = get().comandas.find(c => c.id === comandaId);
    if (!comanda) return;

    const novoItem = {
      id: Math.random().toString(36).substr(2, 9),
      comandaId,
      produtoId: produto.id,
      quantidade: 1,
      precoUnitario: produto.preco,
      sincronizado: false
    };

    // Salvar no banco local
    await database.get('itens_comanda').create(novoItem);

    set({
      comandas: get().comandas.map(c =>
        c.id === comandaId
          ? { ...c, itens: [...c.itens, novoItem] }
          : c
      )
    });
  },

  // Sincronizar com servidor
  sincronizar: async (apiUrl, token) => {
    set({ sincronizando: true });
    try {
      const comandas = get().comandas;
      const naoSincronizadas = comandas.filter(c => !c.sincronizado);

      for (const comanda of naoSincronizadas) {
        const response = await fetch(`${apiUrl}/api/comandas`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(comanda)
        });

        if (response.ok) {
          // Marcar como sincronizada
          await database.get('comandas').find(comanda.id).update(c => {
            c.sincronizado = true;
          });
        }
      }

      // Recarregar dados do servidor
      const res = await fetch(`${apiUrl}/api/comandas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dados = await res.json();
      set({ comandas: dados });
    } finally {
      set({ sincronizando: false });
    }
  }
}));
```

### 6.3 Tela de Mesas

```javascript
// app-mobile/screens/MesasScreen.jsx

import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useComandaStore } from '../store/comandaStore';

export default function MesasScreen({ navigation }) {
  const { mesas, carregarLocais } = useComandaStore();

  useEffect(() => {
    carregarLocais();
  }, []);

  const renderMesa = ({ item }) => (
    <TouchableOpacity
      style={[styles.mesa, { backgroundColor: item.status === 'ocupada' ? '#ff6b6b' : '#51cf66' }]}
      onPress={() => navigation.navigate('Comanda', { mesaId: item.id })}
    >
      <Text style={styles.mesaNumero}>Mesa {item.numero}</Text>
      <Text style={styles.mesaStatus}>{item.status}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mesas}
        renderItem={renderMesa}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#f5f5f5' },
  row: { justifyContent: 'space-between', marginBottom: 10 },
  mesa: { width: '31%', aspectRatio: 1, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mesaNumero: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  mesaStatus: { fontSize: 12, color: 'white', marginTop: 5 }
});
```

---

## 7. Testes Automatizados

### 7.1 Testes de Comanda

```javascript
// app/test-comanda.js

import { test } from 'node:test';
import assert from 'node:assert';
import { app } from './server.js';

test('Abrir comanda', async (t) => {
  const res = await fetch('http://localhost:3000/api/mesas/mesa-1/comandas', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ garcomId: 'garcom-1' })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(data.comanda.id);
});

test('Adicionar item à comanda', async (t) => {
  // Criar comanda primeiro
  const comandaRes = await fetch('http://localhost:3000/api/mesas/mesa-1/comandas', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ garcomId: 'garcom-1' })
  });
  const comanda = (await comandaRes.json()).comanda;

  // Adicionar item
  const itemRes = await fetch(`http://localhost:3000/api/comandas/${comanda.id}/itens`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      produtoId: 'produto-1',
      quantidade: 2,
      precoUnitario: 25.00
    })
  });

  assert.strictEqual(itemRes.status, 200);
  const item = (await itemRes.json()).item;
  assert.strictEqual(item.quantidade, 2);
  assert.strictEqual(item.subtotal, 50.00);
});
```

---

## 8. Checklist de Implementação

- [ ] Fase 0: PostgreSQL migrado
- [ ] Fase 0: CI/CD configurado
- [ ] Fase 1: NFC-e emitindo em homologação
- [ ] Fase 1: Contingência offline testada
- [ ] Fase 2: Comanda abrir/fechar
- [ ] Fase 2: Divisão de conta
- [ ] Fase 2: Impressão de comanda
- [ ] Fase 3: Stone/Cielo integrados
- [ ] Fase 3: Pix dinâmico
- [ ] Fase 4: Estoque por dose
- [ ] Fase 4: Ficha técnica de drink
- [ ] Fase 5: App mobile iOS
- [ ] Fase 5: App mobile Android
- [ ] Fase 5: Sincronização offline

---

**Próximas ações:** Iniciar Fase 0 com migração PostgreSQL.
