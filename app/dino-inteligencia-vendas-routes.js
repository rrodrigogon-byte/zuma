/**
 * Rotas da API de Inteligência Comercial e Vender Mais com IA
 * Suporta todas as empresas: Dino Barbearia, Stallone, Agro Open, etc.
 */
import { buildInteligenciaVendas } from './dino-inteligencia-vendas.js';

export function registerInteligenciaVendasRoutes(app, { db, legacyEmpresaId, legacyLojaId }) {
  const handlerGet = async (req, res) => {
    try {
      const empresaId = String(
        req.headers['x-empresa-id'] ||
        req.query.empresaId ||
        req.user?.empresaId ||
        (legacyEmpresaId ? legacyEmpresaId(req) : '') ||
        'dino'
      ).trim();

      const lojaId = String(
        req.headers['x-loja-id'] ||
        req.query.lojaId ||
        req.user?.lojaId ||
        (legacyLojaId ? legacyLojaId(req) : '') ||
        ''
      ).trim();

      const dados = await buildInteligenciaVendas(db(), { empresaId, lojaId });
      res.json(dados);
    } catch (error) {
      console.error('[inteligencia-vendas] Erro ao processar:', error);
      res.status(500).json({ error: error.message || 'Erro ao gerar inteligência de vendas.' });
    }
  };

  const handlerDisparar = async (req, res) => {
    try {
      const { tipo, clienteId, telefone, mensagem } = req.body || {};
      if (!telefone && !clienteId) {
        return res.status(400).json({ error: 'Telefone ou clienteId obrigatório.' });
      }
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
  };

  // Rotas canônicas universais
  app.get('/api/admin/inteligencia-vendas', handlerGet);
  app.post('/api/admin/inteligencia-vendas/disparar-acao', handlerDisparar);

  app.get('/api/admin/vender-mais', handlerGet);
  app.post('/api/admin/vender-mais/disparar-acao', handlerDisparar);

  // Rota de compatibilidade barbearia
  app.get('/api/admin/barbearia/inteligencia-vendas', handlerGet);
  app.post('/api/admin/barbearia/inteligencia-vendas/disparar-acao', handlerDisparar);
}
