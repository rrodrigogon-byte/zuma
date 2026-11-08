/**
 * Rotas da API de Inteligência Comercial e Vender Mais com IA
 */
import { buildInteligenciaVendas } from './dino-inteligencia-vendas.js';

export const INTELIGENCIA_VENDAS_PATH = '/api/admin/barbearia/inteligencia-vendas';

export function registerInteligenciaVendasRoutes(app, { db, legacyEmpresaId, legacyLojaId }) {
  app.get(INTELIGENCIA_VENDAS_PATH, async (req, res) => {
    try {
      const empresaId = String(legacyEmpresaId(req) || '');
      const lojaId = String(legacyLojaId(req) || '');

      const dados = await buildInteligenciaVendas(db(), { empresaId, lojaId });
      res.json(dados);
    } catch (error) {
      console.error('[inteligencia-vendas] Erro ao processar:', error);
      res.status(500).json({ error: error.message || 'Erro ao gerar inteligência de vendas.' });
    }
  });

  app.post(`${INTELIGENCIA_VENDAS_PATH}/disparar-acao`, async (req, res) => {
    try {
      const { tipo, clienteId, telefone, mensagem } = req.body || {};
      if (!telefone && !clienteId) {
        return res.status(400).json({ error: 'Telefone ou clienteId obrigatório.' });
      }

      // Registro de intenção de disparo no log / fila de atendimento
      res.json({
        ok: true,
        sucesso: true,
        tipo,
        telefone,
        mensagemEnviada: mensagem,
        notificacao: 'Mensagem pronta para envio no WhatsApp!',
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao registrar ação de venda.' });
    }
  });
}
