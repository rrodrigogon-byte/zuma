import {
  EMITENTE_STALLONE,
  emitirNotaFiscalStallone,
  listarNotasFiscaisStallone,
  gerarDanfeHtmlStallone,
  gerarXmlStallone,
  cancelarNotaFiscalStallone,
  consultarStatusSefazMt
} from "../core/emissao-fiscal-stallone.js";
import { Router } from "express";
import {
  STALLONE_EMPRESA_ID,
  listarPlanosStalloneClub,
  criarAssinaturaStalloneClub,
  processarCobrancaCicloAssinatura,
  consultarAssinaturaPorCpf,
  listarTodasAssinaturasAsync,
  obterResumoMetricasClube,
  pausarAssinatura,
  reativarAssinatura,
  cancelarAssinatura,
  despacharBoxAssinatura,
  gerarExtratoCashback,
  gerarMensagemWhatsAppBoxPronto,
  exportarAssinaturasCsv,
} from "../core/stallone-club-assinaturas.js";

export function createStalloneClubRoutes() {
  const router = Router();

  // Catálogo público de planos da Box Mensal Stallone
  router.get("/planos", (_req, res) => {
    return res.json({
      sucesso: true,
      planos: listarPlanosStalloneClub()
    });
  });

  // Métricas executivas do Clube de Assinaturas (MRR, ARR, contagem, cashback)
  router.get(["/metricas", "/admin/metricas"], async (req, res) => {
    try {
      const empresaId = req.query.empresaId || req.headers["x-empresa-id"] || STALLONE_EMPRESA_ID;
      const metricas = await obterResumoMetricasClube(empresaId);
      return res.json({
        sucesso: true,
        metricas
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Adesão pública / e-commerce / balcão
  router.post(["/assinar", "/adesao"], (req, res) => {
    try {
      const dados = req.body || {};
      const resultado = criarAssinaturaStalloneClub({
        ...dados,
        empresaId: dados.empresaId || STALLONE_EMPRESA_ID
      });
      return res.status(201).json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Consulta por CPF
  router.get("/assinatura/:cpf", (req, res) => {
    try {
      const { cpf } = req.params;
      const empresaId = req.query.empresaId || STALLONE_EMPRESA_ID;
      const assinatura = consultarAssinaturaPorCpf(empresaId, cpf);
      if (!assinatura) {
        return res.status(404).json({ sucesso: false, erro: "Nenhuma assinatura localizada para este CPF." });
      }
      return res.json({ sucesso: true, assinatura });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: listagem de assinaturas sincronizada (PostgreSQL + Memória)
  router.get(["/assinaturas", "/admin/assinaturas"], async (req, res) => {
    try {
      const empresaId = req.query.empresaId || req.headers["x-empresa-id"] || STALLONE_EMPRESA_ID;
      const assinaturas = await listarTodasAssinaturasAsync(empresaId);
      return res.json({
        sucesso: true,
        total: assinaturas.length,
        assinaturas
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: processar ciclo de cobrança (TEF / PIX / Recorrente)
  router.post(["/assinaturas/:id/processar-ciclo", "/admin/assinaturas/:id/processar-ciclo"], (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const resultado = processarCobrancaCicloAssinatura(empresaId, id);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: pausar assinatura
  router.post(["/assinaturas/:id/pausar", "/admin/assinaturas/:id/pausar"], (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const motivo = req.body?.motivo;
      const resultado = pausarAssinatura(empresaId, id, motivo);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: reativar assinatura
  router.post(["/assinaturas/:id/reativar", "/admin/assinaturas/:id/reativar"], (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const resultado = reativarAssinatura(empresaId, id);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: cancelar assinatura
  router.post(["/assinaturas/:id/cancelar", "/admin/assinaturas/:id/cancelar"], (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const motivo = req.body?.motivo;
      const resultado = cancelarAssinatura(empresaId, id, motivo);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: despachar Box Mensal de suplementos
  router.post(["/assinaturas/:id/despachar", "/admin/assinaturas/:id/despachar"], async (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      await listarTodasAssinaturasAsync(empresaId);
      const resultado = despacharBoxAssinatura(empresaId, id, req.body || {});
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: extrato detalhado de Cashback do cliente
  router.get(["/assinaturas/:id/extrato-cashback", "/admin/assinaturas/:id/extrato-cashback"], async (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.query.empresaId || STALLONE_EMPRESA_ID;
      await listarTodasAssinaturasAsync(empresaId);
      const resultado = gerarExtratoCashback(empresaId, id);
      return res.json(resultado);
    } catch (err) {
      return res.status(404).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: gerar mensagem WhatsApp com Box Pronto
  router.get(["/assinaturas/:id/notificar-whatsapp", "/admin/assinaturas/:id/notificar-whatsapp"], async (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.query.empresaId || STALLONE_EMPRESA_ID;
      await listarTodasAssinaturasAsync(empresaId);
      const resultado = gerarMensagemWhatsAppBoxPronto(empresaId, id);
      return res.json(resultado);
    } catch (err) {
      return res.status(404).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: exportação de assinaturas em CSV
  router.get(["/assinaturas/exportar-csv", "/admin/assinaturas/exportar-csv"], async (req, res) => {
    try {
      const empresaId = req.query.empresaId || STALLONE_EMPRESA_ID;
      const resultado = await exportarAssinaturasCsv(empresaId);
      if (req.query.download === 'true' || req.query.formato === 'csv') {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${resultado.nomeArquivo}"`);
        return res.send(resultado.conteudoCsv);
      }
      return res.json(resultado);
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  
  // --- Módulo Fiscal Exclusivo Stallone Nutre Sport (NFC-e / NF-e) ---
  router.get("/fiscal/status-sefaz", (_req, res) => {
    return res.json(consultarStatusSefazMt());
  });

  router.get("/fiscal/emitente", (_req, res) => {
    return res.json({ sucesso: true, emitente: EMITENTE_STALLONE });
  });

  router.post(["/fiscal/emitir", "/fiscal/emitir-nfce"], async (req, res) => {
    try {
      const dados = req.body || {};
      const nota = await emitirNotaFiscalStallone({
        ...dados,
        modelo: dados.modelo || '65',
        empresaId: STALLONE_EMPRESA_ID,
        usuario: req.user?.nome || req.user?.email || 'Operador Stallone'
      });
      return res.status(201).json({
        sucesso: true,
        mensagem: `NFC-e nº ${nota.numero} autorizada com sucesso na SEFAZ-MT`,
        nfce: {
          id: nota.id,
          numero: nota.numero,
          serie: nota.serie,
          chaveAcesso: nota.chaveAcesso,
          protocolo: nota.protocolo,
          qrCodeUrl: nota.qrCodeUrl,
          danfeUrl: `/api/admin/fiscal-avancado/danfe/${nota.id}`,
          xmlUrl: `/api/admin/fiscal-avancado/xml/${nota.id}`,
          status: nota.status,
          dataEmissao: nota.dataEmissao,
          total: nota.total
        },
        nota
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  router.post("/fiscal/emitir-nfe", async (req, res) => {
    try {
      const dados = req.body || {};
      const nota = await emitirNotaFiscalStallone({
        ...dados,
        modelo: '55',
        empresaId: STALLONE_EMPRESA_ID,
        usuario: req.user?.nome || req.user?.email || 'Faturamento Stallone'
      });
      return res.status(201).json({
        sucesso: true,
        mensagem: `NF-e modelo 55 nº ${nota.numero} autorizada com sucesso na SEFAZ-MT`,
        nfe: {
          id: nota.id,
          numero: nota.numero,
          serie: nota.serie,
          chaveAcesso: nota.chaveAcesso,
          protocolo: nota.protocolo,
          danfeUrl: `/api/admin/fiscal-avancado/danfe/${nota.id}`,
          xmlUrl: `/api/admin/fiscal-avancado/xml/${nota.id}`,
          status: nota.status,
          dataEmissao: nota.dataEmissao,
          total: nota.total
        },
        nota
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  router.get("/fiscal/notas", (req, res) => {
    try {
      const { modelo, status, limit } = req.query;
      return res.json(listarNotasFiscaisStallone({ modelo, status, limit: Number(limit) || 50 }));
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  router.get("/fiscal/danfe/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const autoPrint = req.query?.print === '1' || req.query?.print === 'true';
      const html = await gerarDanfeHtmlStallone(id, { autoPrint });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (err) {
      return res.status(404).send(`<p style="color:red">${err.message}</p>`);
    }
  });

  router.get("/fiscal/xml/:id", (req, res) => {
    try {
      const { id } = req.params;
      const xml = gerarXmlStallone(id);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="nota-stallone-${id}.xml"`);
      return res.send(xml);
    } catch (err) {
      return res.status(404).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
