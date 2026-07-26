/**
 * Schema do WatermelonDB
 * SetPoint Ultra - Banco de dados offline
 */

import { appSchema, tableSchema } from '@watermelondb/core';

export const schema = appSchema({
  version: 1,
  tables: [
    // ========================================================================
    // COMANDA
    // ========================================================================
    tableSchema({
      name: 'comandas',
      columns: [
        { name: 'numero_comanda', type: 'string', isIndexed: true },
        { name: 'mesa_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'total_bruto', type: 'number' },
        { name: 'total_desconto', type: 'number' },
        { name: 'total_liquido', type: 'number' },
        { name: 'data_abertura', type: 'number' },
        { name: 'data_fechamento', type: 'number' },
        { name: 'sincronizado', type: 'boolean', isIndexed: true },
        { name: 'server_id', type: 'string', isIndexed: true },
      ],
    }),

    // ========================================================================
    // ITENS DE COMANDA
    // ========================================================================
    tableSchema({
      name: 'itens_comanda',
      columns: [
        { name: 'comanda_id', type: 'string', isIndexed: true },
        { name: 'produto_id', type: 'string', isIndexed: true },
        { name: 'quantidade', type: 'number' },
        { name: 'valor_unitario', type: 'number' },
        { name: 'valor_total', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'observacoes', type: 'string' },
        { name: 'sincronizado', type: 'boolean', isIndexed: true },
        { name: 'server_id', type: 'string', isIndexed: true },
      ],
    }),

    // ========================================================================
    // PRODUTOS
    // ========================================================================
    tableSchema({
      name: 'produtos',
      columns: [
        { name: 'sku', type: 'string', isIndexed: true },
        { name: 'nome', type: 'string', isIndexed: true },
        { name: 'descricao', type: 'string' },
        { name: 'categoria_id', type: 'string', isIndexed: true },
        { name: 'valor_venda', type: 'number' },
        { name: 'estoque_atual', type: 'number' },
        { name: 'ativo', type: 'boolean', isIndexed: true },
        { name: 'imagem_url', type: 'string' },
        { name: 'sincronizado', type: 'boolean', isIndexed: true },
        { name: 'server_id', type: 'string', isIndexed: true },
      ],
    }),

    // ========================================================================
    // CATEGORIAS
    // ========================================================================
    tableSchema({
      name: 'categorias',
      columns: [
        { name: 'nome', type: 'string', isIndexed: true },
        { name: 'descricao', type: 'string' },
        { name: 'ativo', type: 'boolean', isIndexed: true },
        { name: 'server_id', type: 'string', isIndexed: true },
      ],
    }),

    // ========================================================================
    // MESAS
    // ========================================================================
    tableSchema({
      name: 'mesas',
      columns: [
        { name: 'numero_mesa', type: 'number', isIndexed: true },
        { name: 'capacidade', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'localizacao', type: 'string' },
        { name: 'ativo', type: 'boolean', isIndexed: true },
        { name: 'server_id', type: 'string', isIndexed: true },
      ],
    }),

    // ========================================================================
    // PAGAMENTOS
    // ========================================================================
    tableSchema({
      name: 'pagamentos',
      columns: [
        { name: 'comanda_id', type: 'string', isIndexed: true },
        { name: 'tipo_pagamento', type: 'string', isIndexed: true },
        { name: 'valor', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'id_transacao', type: 'string', isIndexed: true },
        { name: 'data_pagamento', type: 'number' },
        { name: 'sincronizado', type: 'boolean', isIndexed: true },
        { name: 'server_id', type: 'string', isIndexed: true },
      ],
    }),

    // ========================================================================
    // FILA DE SINCRONIZAÇÃO
    // ========================================================================
    tableSchema({
      name: 'fila_sincronizacao',
      columns: [
        { name: 'tipo_operacao', type: 'string' },
        { name: 'tabela', type: 'string', isIndexed: true },
        { name: 'registro_id', type: 'string', isIndexed: true },
        { name: 'dados', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'tentativas', type: 'number' },
        { name: 'data_criacao', type: 'number' },
        { name: 'data_sincronizacao', type: 'number' },
      ],
    }),
  ],
});

export default schema;
