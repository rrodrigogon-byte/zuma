/**
 * Rotas Fiscais Avançadas: Cálculo de ICMS-ST (MT) e Manifestação do Destinatário (MD-e)
 */

import { Router } from 'express';
import { calcularIcmsStMt, calcularMvaAjustada, ALIQUOTAS_MT } from '../core/tributacao-icms-st-mt.js';
import { manifestarNota, listarNotasDestinadas, processarEntradaMercadoria, EVENTOS_MDE } from '../core/manifestacao-destinatario-mde.js';

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
  router.get('/mde/notas-destinadas', (req, res) => {
    const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
    const notas = listarNotasDestinadas(empresaId);
    return res.json({
      sucesso: true,
      total: notas.length,
      notas,
    });
  });

  // Registra manifestação de uma NF-e
  router.post('/mde/manifestar', (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const evento = manifestarNota({
        ...req.body,
        empresaId,
        usuario: req.user?.username || req.user?.email || 'operador',
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

  return router;
}
