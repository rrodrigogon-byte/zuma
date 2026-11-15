/**
 * Rotas Fiscais Avançadas: Cálculo de ICMS-ST (MT), Manifestação do Destinatário (MD-e)
 * e Emissão de Documentos Fiscais Eletrônicos (NFC-e 65 e NF-e 55) — Kytto ERP
 */

import { Router } from 'express';
import { calcularIcmsStMt, calcularMvaAjustada, ALIQUOTAS_MT } from '../core/tributacao-icms-st-mt.js';
import {
  manifestarNota,
  manifestarNotaAsync,
  listarNotasDestinadas,
  listarNotasDestinadasAsync,
  processarEntradaMercadoria,
  manifestarNotasEmLote,
  gerarLivroRegistroEntradas,
  EVENTOS_MDE,
} from '../core/manifestacao-destinatario-mde.js';
import {
  EMITENTE_STALLONE,
  emitirNotaFiscalStallone,
  listarNotasFiscaisStallone,
  obterNotaFiscalPorIdOuChave,
  gerarDanfeHtmlStallone,
  gerarXmlStallone,
  cancelarNotaFiscalStallone,
  consultarStatusSefazMt,
} from '../core/emissao-fiscal-stallone.js';

export function createFiscalAvancadoRouter({ auth, obterEmpresaId }) {
  const router = Router();

  if (typeof auth === 'function') {
    router.use(auth);
  }

  // --- ICMS-ST (Mato Grosso) ---

  // Retorna tabela de parâmetros tributários do MT
  router.get('/icms-st/parametros', (req, res) => {
    return res.json({
      sucesso: true,
      aliquotasMt: ALIQUOTAS_MT,
      regras: [
        'ICMS Interno MT: 17% padrão ou 20% majorado para produtos supérfluos.',
        'MVA Ajustada obrigatória para compras interestaduais conf. Convênio ICMS 142/2018.',
        'Adicional de FCP (Fundo de Combate à Pobreza) de até 2% incidente sobre a Base ST.',
      ],
    });
  });

  // Calcula ICMS-ST de um item ou lista de itens
  router.post('/icms-st/calcular', (req, res) => {
    try {
      const resultado = calcularIcmsStMt(req.body);
      return res.json({
        sucesso: true,
        resultado,
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // --- Manifestação do Destinatário (MD-e) ---

  // Eventos permitidos
  router.get('/mde/eventos-suportados', (req, res) => {
    return res.json({
      sucesso: true,
      eventos: Object.values(EVENTOS_MDE),
    });
  });

  // Lista notas destinadas contra o CNPJ da empresa
  router.get('/mde/notas-destinadas', async (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const notas = await listarNotasDestinadasAsync(empresaId);
      return res.json({
        sucesso: true,
        total: notas.length,
        notas,
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Registra manifestação de uma NF-e e alimenta automaticamente o ERP ao confirmar
  router.post('/mde/manifestar', async (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const evento = await manifestarNotaAsync({
        ...req.body,
        empresaId,
        usuario: req.user?.username || req.user?.email || req.body?.usuario || 'Silvester Natal (Stallone)',
      });
      return res.status(201).json({
        sucesso: true,
        mensagem: `Manifestação registrada com sucesso: ${evento.descricaoEvento}`,
        evento,
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Processa entrada de estoque com Custo Médio Ponderado
  router.post('/mde/entrada-estoque', (req, res) => {
    try {
      const entrada = processarEntradaMercadoria(req.body);
      return res.json({
        sucesso: true,
        mensagem: 'Entrada de estoque processada com recálculo do custo médio ponderado.',
        dados: entrada,
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Manifestação de notas fiscais em lote (Ciência ou Confirmação em massa)
  router.post('/mde/manifestar-lote', async (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const resultado = await manifestarNotasEmLote({
        ...req.body,
        empresaId,
        usuario: req.user?.username || req.user?.email || req.body?.usuario || 'Gestor Fiscal Stallone',
      });
      return res.json({
        sucesso: true,
        mensagem: `${resultado.sucessos} nota(s) manifestada(s) com sucesso em lote.`,
        ...resultado,
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Livro Registro de Entradas (Consolidação Fiscal e Exportação CSV)
  router.get('/mde/livro-entradas', async (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const { dataInicio, dataFim, formato } = req.query;
      const resultado = await gerarLivroRegistroEntradas({
        empresaId,
        dataInicio,
        dataFim,
      });
      if (formato === 'csv' || req.query?.download === 'true') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="livro_registro_entradas_stallone.csv"');
        return res.send(resultado.conteudoCsv);
      }
      return res.json({
        sucesso: true,
        ...resultado,
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // --- Emissão de Documentos Fiscais (NFC-e Modelo 65 & NF-e Modelo 55) ---

  // Dados do emitente fiscal oficial (Stallone Nutre Sport)
  router.get('/emitente', (_req, res) => {
    return res.json({
      sucesso: true,
      emitente: EMITENTE_STALLONE,
    });
  });

  // Monitor de status do serviço da SEFAZ-MT
  router.get('/status-sefaz', (_req, res) => {
    return res.json(consultarStatusSefazMt());
  });

  // Emissão direta de NFC-e (65) ou NF-e (55)
  router.post('/emitir-nota', async (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const dados = req.body || {};
      const usuario = req.user?.nome || req.user?.username || req.user?.email || 'Gestor Fiscal Stallone';
      const nota = await emitirNotaFiscalStallone({
        ...dados,
        empresaId: dados.empresaId || empresaId,
        usuario,
      });
      return res.status(201).json({
        sucesso: true,
        mensagem: `${nota.modelo === '55' ? 'NF-e' : 'NFC-e'} nº ${nota.numero} autorizada com sucesso na SEFAZ-MT`,
        nota: {
          ...nota,
          danfeUrl: `/api/admin/fiscal-avancado/danfe/${nota.id}`,
          xmlUrl: `/api/admin/fiscal-avancado/xml/${nota.id}`,
        },
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Listagem de notas fiscais emitidas com métricas
  router.get('/notas-emitidas', (req, res) => {
    try {
      const { modelo, status, limit } = req.query;
      const resultado = listarNotasFiscaisStallone({ modelo, status, limit: Number(limit) || 50 });
      return res.json(resultado);
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // DANFE em HTML para impressão térmica (80mm) ou tela
  router.get('/danfe/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const autoPrint = req.query?.print === '1' || req.query?.print === 'true';
      const html = await gerarDanfeHtmlStallone(id, { autoPrint });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(html);
    } catch (err) {
      return res.status(404).send(`<div style="font-family:sans-serif;padding:20px;color:red;"><h3>Erro ao gerar DANFE</h3><p>${err.message}</p></div>`);
    }
  });

  // Download do XML assinado/autorizado
  router.get('/xml/:id', (req, res) => {
    try {
      const { id } = req.params;
      const xml = gerarXmlStallone(id);
      const nota = obterNotaFiscalPorIdOuChave(id);
      const nomeArquivo = `${nota?.modelo === '55' ? 'nfe' : 'nfce'}-${nota?.serie || '1'}-${nota?.numero || id}.xml`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      return res.send(xml);
    } catch (err) {
      return res.status(404).json({ sucesso: false, erro: err.message });
    }
  });

  // Cancelamento de nota fiscal junto à SEFAZ-MT
  router.post('/cancelar-nota', (req, res) => {
    try {
      const { idOuChave, justificativa } = req.body || {};
      const usuario = req.user?.nome || req.user?.username || req.user?.email || 'Gestor Fiscal Stallone';
      const resultado = cancelarNotaFiscalStallone({ idOuChave, justificativa, usuario });
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Emissão em contingência offline (quando a SEFAZ estiver instável)
  router.post('/contingencia', async (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const dados = req.body || {};
      const usuario = req.user?.nome || req.user?.username || req.user?.email || 'Gestor Fiscal Stallone';
      const nota = await emitirNotaFiscalStallone({
        ...dados,
        empresaId: dados.empresaId || empresaId,
        contingencia: true,
        justificativa: dados.justificativa || 'EMISSAO EM CONTINGENCIA OFFLINE - INDISPONIBILIDADE SEFAZ MT',
        usuario,
      });
      return res.status(201).json({
        sucesso: true,
        mensagem: `NFC-e nº ${nota.numero} emitida em Contingência Offline. Transmitir em até 24h.`,
        nota: {
          ...nota,
          danfeUrl: `/api/admin/fiscal-avancado/danfe/${nota.id}`,
          xmlUrl: `/api/admin/fiscal-avancado/xml/${nota.id}`,
        },
      });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
