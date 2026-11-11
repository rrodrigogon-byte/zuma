/**
 * Rotas da API de Auditoria DIMP vs Documentos Fiscais (Isoladas por Empresa)
 */
import { Router } from 'express';
import { executarAuditoriaDimpFiscal, regularizarPendenciasDimp, ADQUIRENTES_DIMP } from '../core/auditoria-dimp-fiscal.js';
import { query as consultar } from '../db-pg.js';

export function createDimpRoutes({ auth, obterEmpresaId }) {
  const router = Router();
  if (typeof auth === 'function') {
    router.use(auth);
  }

  router.get('/adquirentes', (_req, res) => {
    return res.json({
      sucesso: true,
      adquirentes: Object.values(ADQUIRENTES_DIMP),
    });
  });

  router.get('/auditar', async (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      if (!empresaId) {
        return res.status(403).json({ sucesso: false, erro: 'Empresa ativa não identificada na sessão.' });
      }
      const agora = new Date();
      const mes = String(req.query.mes || (agora.getMonth() + 1)).padStart(2, '0');
      const ano = String(req.query.ano || agora.getFullYear());
      const competenciaPrefix = `${ano}-${mes}`;

      const transacoesMeiosPagamento = [];
      const documentosFiscais = [];
      const vendasSemDocumento = [];

      // 1. Buscar lançamentos financeiros eletrônicos reais da empresa na competência
      try {
        const finRes = await consultar(
          `SELECT id, descricao, valor, forma_pagamento, data_competencia, status
             FROM fin_lancamentos
            WHERE empresa_id = $1
              AND tipo = 'receita'
              AND status IN ('pago', 'baixado', 'conciliado', 'confirmado')
              AND TO_CHAR(data_competencia, 'YYYY-MM') = $2
            ORDER BY data_competencia DESC`,
          [empresaId, competenciaPrefix]
        );
        for (const r of finRes.rows || []) {
          const fp = String(r.forma_pagamento || '').toLowerCase();
          if (fp.includes('dinheiro') || fp.includes('especie')) continue;
          const tipo = fp.includes('pix')
            ? 'PIX_DINAMICO'
            : (fp.includes('debito') ? 'CARTAO_DEBITO' : 'CARTAO_CREDITO');
          const adquirente = fp.includes('pix') ? 'SICREDI' : (fp.includes('stone') ? 'STONE' : 'SICREDI');
          transacoesMeiosPagamento.push({
            id: String(r.id),
            data: r.data_competencia ? new Date(r.data_competencia).toISOString().slice(0, 10) : `${competenciaPrefix}-01`,
            adquirente,
            tipo,
            valor: Number(r.valor || 0),
            nsu: `FIN-${String(r.id).slice(0, 8).toUpperCase()}`,
            descricao: r.descricao || 'Recebimento eletrônico',
          });
        }
      } catch (_e) { /* tabela opcional */ }

      // 2. Buscar documentos fiscais emitidos pela empresa na competência
      try {
        const docsRes = await consultar(
          `SELECT id, modelo, numero, serie, chave_acesso, valor_total, status, emitido_em, ambiente
             FROM fis_documentos
            WHERE empresa_id = $1
              AND status IN ('autorizada', 'emitida', 'autorizado')
              AND TO_CHAR(COALESCE(emitido_em, criado_em), 'YYYY-MM') = $2
            ORDER BY COALESCE(emitido_em, criado_em) DESC`,
          [empresaId, competenciaPrefix]
        );
        for (const d of docsRes.rows || []) {
          documentosFiscais.push({
            id: d.id,
            numero: d.numero,
            modelo: String(d.modelo || '65'),
            tipo: String(d.modelo) === '55' ? 'NF-e' : (String(d.modelo) === '65' ? 'NFC-e' : 'NFS-e DPS'),
            data: d.emitido_em ? new Date(d.emitido_em).toISOString().slice(0, 10) : `${competenciaPrefix}-01`,
            valorTotal: Number(d.valor_total || 0),
            chaveAcesso: d.chave_acesso || '',
            ambiente: d.ambiente || 2,
          });
        }
      } catch (_e) { /* tabela opcional */ }

      // 3. Identificar vendas eletrônicas sem documento fiscal correspondente
      const totalDocs = documentosFiscais.reduce((s, d) => s + Number(d.valorTotal || 0), 0);
      let acumuladoPag = 0;
      for (const pag of transacoesMeiosPagamento) {
        acumuladoPag += pag.valor;
        if (acumuladoPag > totalDocs + 0.01 && vendasSemDocumento.length < 15) {
          vendasSemDocumento.push({
            idVenda: pag.id,
            data: pag.data,
            meioPagamento: pag.tipo,
            adquirente: pag.adquirente,
            nsu: pag.nsu,
            valorFaltante: Number(pag.valor.toFixed(2)),
            cliente: 'Consumidor Final',
            itensSugeridos: [{ descricao: pag.descricao || 'Operação comercial do período', valor: Number(pag.valor.toFixed(2)) }],
          });
        }
      }

      const auditoria = executarAuditoriaDimpFiscal({
        empresaId,
        mes,
        ano,
        transacoesMeiosPagamento,
        documentosFiscais,
        vendasSemDocumento,
      });
      return res.json(auditoria);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Regularização assistida individual em homologação (Emissão em lote bloqueada)
  router.post('/regularizar-lote', (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      if (!empresaId) {
        return res.status(403).json({ sucesso: false, erro: 'Empresa ativa não identificada na sessão.' });
      }
      const itensRegularizar = req.body.itens || [];

      if (!req.body.confirmacaoManualExplicita) {
        return res.status(403).json({
          sucesso: false,
          erro: 'Emissão em lote desativada por política de segurança fiscal (SEFAZ-MT). Confirme individualmente o item em homologação.',
        });
      }

      if (itensRegularizar.length !== 1) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Diretriz de Governança Fiscal: é permitido validar apenas 1 documento por confirmação individual.',
        });
      }

      const resultado = regularizarPendenciasDimp({
        empresaId,
        itensRegularizar,
        tpAmb: 2,
      });
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
