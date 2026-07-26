/**
 * ============================================================================
 * ROTAS DE NFC-e - ERP MODULAR
 * ============================================================================
 * Arquivo: routes/nfce.js
 * Descrição: Emissão, contingência, cancelamento de NFC-e
 * ============================================================================
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

/**
 * POST /nfce/emitir
 * Emitir NFC-e para uma venda
 */
router.post('/emitir', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  try {
    const { venda_id, natureza_operacao = '5102' } = req.body;

    if (!venda_id) {
      return res.status(400).json({ erro: 'Venda é obrigatória' });
    }

    // Validar venda
    const venda = await dbPg.findById('vendas', venda_id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status !== 'paga') {
      return res.status(400).json({ erro: 'Venda deve estar paga para emitir NFC-e' });
    }

    // Buscar itens da venda
    const itensResult = await dbPg.query(
      `SELECT iv.*, p.codigo_interno, p.nome FROM itens_venda iv
       JOIN produtos p ON iv.produto_id = p.id
       WHERE iv.venda_id = $1`,
      [venda_id]
    );

    if (itensResult.rows.length === 0) {
      return res.status(400).json({ erro: 'Venda sem itens' });
    }

    // Buscar empresa
    const empresa = await dbPg.findById('empresas', req.empresaId);
    if (!empresa) {
      return res.status(404).json({ erro: 'Empresa não encontrada' });
    }

    // Registrar NFC-e em transação
    const client = await dbPg.beginTransaction();
    try {
      // Gerar número sequencial
      const nfceResult = await dbPg.queryInTransaction(
        client,
        `SELECT COALESCE(MAX(numero_nfce), 0) + 1 as proximo FROM nfces 
         WHERE empresa_id = $1`,
        [req.empresaId]
      );

      const numeroNfce = nfceResult.rows[0].proximo;

      // Montar XML da NFC-e (simulado)
      const xmlNfce = montarXmlNfce({
        empresa,
        venda,
        itens: itensResult.rows,
        numero: numeroNfce,
        natureza_operacao
      });

      // Registrar NFC-e
      const nfceInsertResult = await dbPg.queryInTransaction(
        client,
        `INSERT INTO nfces 
         (empresa_id, venda_id, numero_nfce, xml, status, usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.empresaId, venda_id, numeroNfce, xmlNfce, 'emitida', req.usuario.usuario_id]
      );

      const nfce = nfceInsertResult.rows[0];

      // Simular envio para SEFAZ (em produção, usar Focus NFe ou PlugNotas)
      const protocoloSefaz = 'PROTO-' + Date.now();
      const chaveNfce = gerarChaveNfce(empresa.cnpj, numeroNfce);

      // Atualizar NFC-e com protocolo
      await dbPg.queryInTransaction(
        client,
        `UPDATE nfces SET protocolo_sefaz = $1, chave_nfce = $2, status = $3 WHERE id = $4`,
        [protocoloSefaz, chaveNfce, 'autorizada', nfce.id]
      );

      // Atualizar venda
      await dbPg.queryInTransaction(
        client,
        `UPDATE vendas SET nfce_id = $1, status = $2 WHERE id = $3`,
        [nfce.id, 'nfce_emitida', venda_id]
      );

      // Registrar auditoria
      await dbPg.registrarAuditoria({
        empresa_id: req.empresaId,
        usuario_id: req.usuario.usuario_id,
        tabela: 'nfces',
        operacao: 'INSERT',
        registro_id: nfce.id,
        dados_novo: { numero: numeroNfce, protocolo: protocoloSefaz },
        ip_address: req.ip
      });

      await dbPg.commit(client);

      res.status(201).json({
        sucesso: true,
        nfce: {
          id: nfce.id,
          numero: numeroNfce,
          chave: chaveNfce,
          protocolo: protocoloSefaz,
          status: 'autorizada'
        },
        mensagem: 'NFC-e emitida com sucesso'
      });
    } catch (error) {
      await dbPg.rollback(client);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao emitir NFC-e:', error);
    res.status(500).json({ erro: 'Erro ao emitir NFC-e' });
  }
});

/**
 * POST /nfce/:id/cancelar
 * Cancelar NFC-e
 */
router.post('/:id/cancelar', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { justificativa } = req.body;

    if (!justificativa) {
      return res.status(400).json({ erro: 'Justificativa é obrigatória' });
    }

    const nfce = await dbPg.findById('nfces', req.params.id, req.empresaId);
    if (!nfce) {
      return res.status(404).json({ erro: 'NFC-e não encontrada' });
    }

    if (nfce.status !== 'autorizada') {
      return res.status(400).json({ erro: 'Apenas NFC-e autorizada pode ser cancelada' });
    }

    // Atualizar NFC-e
    const nfceAtualizada = await dbPg.update('nfces', req.params.id, {
      status: 'cancelada',
      justificativa_cancelamento: justificativa
    }, req.empresaId);

    // Atualizar venda
    const venda = await dbPg.findById('vendas', nfce.venda_id, req.empresaId);
    if (venda) {
      await dbPg.update('vendas', nfce.venda_id, {
        status: 'cancelada'
      }, req.empresaId);
    }

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'nfces',
      operacao: 'UPDATE',
      registro_id: req.params.id,
      dados_novo: { status: 'cancelada', justificativa },
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      nfce: nfceAtualizada,
      mensagem: 'NFC-e cancelada'
    });
  } catch (error) {
    console.error('Erro ao cancelar NFC-e:', error);
    res.status(500).json({ erro: 'Erro ao cancelar NFC-e' });
  }
});

/**
 * GET /nfce/:id
 * Obter detalhes da NFC-e
 */
router.get('/:id', autenticar, async (req, res) => {
  try {
    const nfce = await dbPg.findById('nfces', req.params.id, req.empresaId);
    if (!nfce) {
      return res.status(404).json({ erro: 'NFC-e não encontrada' });
    }

    res.json({
      sucesso: true,
      nfce
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar NFC-e' });
  }
});

/**
 * GET /nfce/venda/:venda_id
 * Buscar NFC-e de uma venda
 */
router.get('/venda/:venda_id', autenticar, async (req, res) => {
  try {
    const result = await dbPg.query(
      `SELECT * FROM nfces WHERE empresa_id = $1 AND venda_id = $2`,
      [req.empresaId, req.params.venda_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'NFC-e não encontrada para esta venda' });
    }

    res.json({
      sucesso: true,
      nfce: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar NFC-e' });
  }
});

/**
 * GET /nfce/relatorio
 * Relatório de NFC-e emitidas
 */
router.get('/relatorio', autenticar, async (req, res) => {
  try {
    const { data_inicio, data_fim, status } = req.query;

    let sql = `
      SELECT 
        COUNT(id) as total,
        COUNT(CASE WHEN status = 'autorizada' THEN 1 END) as autorizadas,
        COUNT(CASE WHEN status = 'cancelada' THEN 1 END) as canceladas,
        SUM(CASE WHEN status = 'autorizada' THEN 1 ELSE 0 END) as valor_total
      FROM nfces
      WHERE empresa_id = $1
    `;
    const params = [req.empresaId];
    let paramIndex = 2;

    if (data_inicio) {
      sql += ` AND data_emissao >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      sql += ` AND data_emissao <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const result = await dbPg.query(sql, params);

    res.json({
      sucesso: true,
      relatorio: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

/**
 * Funções auxiliares
 */

function montarXmlNfce(dados) {
  const { empresa, venda, itens, numero, natureza_operacao } = dados;
  
  // Simulação de XML (em produção, usar biblioteca XML)
  return `<?xml version="1.0"?>
<NFe>
  <infNFe Id="NFe${numero}">
    <ide>
      <cUF>28</cUF>
      <CNPJ>${empresa.cnpj}</CNPJ>
      <assinaturaQRCode></assinaturaQRCode>
      <nNF>${numero}</nNF>
      <natOp>${natureza_operacao}</natOp>
      <dhEmi>${new Date().toISOString()}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <indPres>1</indPres>
      <indIntermed>0</indIntermed>
    </ide>
    <emit>
      <CNPJ>${empresa.cnpj}</CNPJ>
      <xNome>${empresa.razao_social}</xNome>
      <IE>${empresa.inscricao_estadual || ''}</IE>
      <IM></IM>
      <IEST></IEST>
    </emit>
    <dest/>
    <det>
      ${itens.map((item, idx) => `
      <det nItem="${idx + 1}">
        <prod>
          <code>${item.codigo_interno}</code>
          <xProd>${item.nome}</xProd>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>${item.quantidade}</qCom>
          <vUnCom>${item.valor_unitario}</vUnCom>
          <vProd>${item.valor_total}</vProd>
          <vItem12741>0</vItem12741>
          <indTot>1</indTot>
        </prod>
      </det>
      `).join('')}
    </det>
    <total>
      <ICMSTot>
        <vBC>0</vBC>
        <vICMS>0</vICMS>
        <vICMSDeson>0</vICMSDeson>
        <vFCP>0</vFCP>
        <vBCST>0</vBCST>
        <vST>0</vST>
        <vFCPST>0</vFCPST>
        <vFCPSTRet>0</vFCPSTRet>
        <vProd>${venda.valor_liquido}</vProd>
        <vFrete>0</vFrete>
        <vSeg>0</vSeg>
        <vDesc>${venda.valor_desconto || 0}</vDesc>
        <vII>0</vII>
        <vIPI>0</vIPI>
        <vIPIDevol>0</vIPIDevol>
        <vPIS>0</vPIS>
        <vCOFINS>0</vCOFINS>
        <vOutro>0</vOutro>
        <vNF>${venda.valor_liquido}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${venda.valor_liquido}</vPag>
      </detPag>
    </pag>
  </infNFe>
</NFe>`;
}

function gerarChaveNfce(cnpj, numero) {
  const uf = '28'; // MT
  const ano = new Date().getFullYear().toString().slice(-2);
  const mes = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(numero).padStart(8, '0');
  const tipo = '65'; // NFC-e
  const serie = '1';
  
  return `${uf}${ano}${mes}${cnpj}${tipo}${serie}${seq}`;
}

export default router;
