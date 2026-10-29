import db from '../../core/database.js';
import * as svc from './service.js';

export async function processarNFAi(tenantId, usuarioId, fileBase64, mimeType, isXml) {
  let prompt = "Extraia as seguintes informações da Nota Fiscal e retorne EXATAMENTE e APENAS um JSON: {\"fornecedor\": {\"razao_social\": \"\", \"cnpj_cpf\": \"\"}, \"itens\": [{\"descricao\": \"\", \"quantidade\": 0, \"valor_unitario\": 0}]}. Sem markdown, sem comentários.";
  
  let parts = [{ text: prompt }];
  if (isXml) {
    const textData = Buffer.from(fileBase64, 'base64').toString('utf-8');
    parts.push({ text: "Conteúdo do XML da NF: " + textData });
  } else {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: fileBase64
      }
    });
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' }
    })
  });

  const rawRes = await response.json();
  if (rawRes.error) throw new Error(rawRes.error.message || 'Erro na API do Gemini');
  
  const content = rawRes.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Não foi possível extrair dados da imagem/arquivo.');

  let dados;
  try { dados = JSON.parse(content); } catch (e) { throw new Error('Falha ao processar o formato do arquivo da nota fiscal.'); }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    
    // 1. Achar ou criar fornecedor
    let fornecedorId;
    const cnpjNumeros = (dados.fornecedor?.cnpj_cpf || '').replace(/\D/g, '');
    if (cnpjNumeros) {
      const qForn = await client.query('SELECT id FROM compras_fornecedores WHERE tenant_id = $1 AND regexp_replace(cnpj_cpf, \'\\D\', \'\', \'g\') = $2 LIMIT 1', [tenantId, cnpjNumeros]);
      if (qForn.rows.length) fornecedorId = qForn.rows[0].id;
    }
    
    if (!fornecedorId && dados.fornecedor?.razao_social) {
      const fornNovo = await svc.criarFornecedor(tenantId, {
        razao_social: dados.fornecedor.razao_social,
        cnpj_cpf: dados.fornecedor.cnpj_cpf || '',
        nome_fantasia: dados.fornecedor.razao_social,
        telefone: '', email: '', prazo_pagamento_dias: 30
      });
      fornecedorId = fornNovo.id;
    }

    if (!fornecedorId) throw new Error('Fornecedor inválido ou não identificado na nota.');

    // 2. Montar pedido de compra
    const pedidoPayload = {
      fornecedor_id: fornecedorId,
      observacoes: 'Importação automática via IA',
      itens: []
    };

    // Para cada item, acha ou cria produto em produtos_catalogo
    for (const item of dados.itens) {
      if (!item.descricao || !item.quantidade) continue;
      
      let produtoId = null;
      const qProd = await client.query('SELECT id FROM produtos_catalogo WHERE tenant_id = $1 AND lower(nome) = $2 LIMIT 1', [tenantId, item.descricao.toLowerCase()]);
      
      if (qProd.rows.length) {
        produtoId = qProd.rows[0].id;
      } else {
        const prodInsert = await client.query(
          `INSERT INTO produtos_catalogo (tenant_id, nome, preco_venda, ativo, controla_estoque) 
           VALUES ($1, $2, $3, true, true) RETURNING id`,
          [tenantId, item.descricao, Number(item.valor_unitario || 0) * 1.5]
        );
        produtoId = prodInsert.rows[0].id;
      }

      pedidoPayload.itens.push({
        produto_id: produtoId,
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        unidade: 'UN',
        valor_unitario: Number(item.valor_unitario)
      });
    }

    if (!pedidoPayload.itens.length) throw new Error('Nenhum item válido encontrado na nota.');

    // 3. Criar Pedido
    const resPedido = await svc.criarPedidoCompra(tenantId, pedidoPayload, usuarioId);
    
    // 4. Aprovar Pedido
    await svc.aprovarPedidoCompra(resPedido.pedido.id, tenantId, usuarioId);

    // 5. Receber e entrar no estoque
    const qItens = await client.query('SELECT id, produto_id, quantidade FROM compras_pedido_itens WHERE pedido_id = $1', [resPedido.pedido.id]);
    const itensReceber = qItens.rows.map(row => ({
      item_id: row.id,
      produto_id: row.produto_id,
      quantidade_recebida: row.quantidade
    }));

    await svc.registrarRecebimento(resPedido.pedido.id, tenantId, itensReceber);
    
    await client.query('COMMIT');
    return { fornecedor: dados.fornecedor, itensImportados: pedidoPayload.itens.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
