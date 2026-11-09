/**
 * Rotas da API de Inteligência Comercial, Vender Mais com IA,
 * Gestão de Configurações Multi-Empresa e Registro de Dinheiro na Mesa
 */
import {
  buildInteligenciaVendas,
  obterConfigEmpresa,
  salvarConfigEmpresa,
  registrarConversaoVenda,
  obterConversoesVenda,
} from './dino-inteligencia-vendas.js';

export function registerInteligenciaVendasRoutes(app, { db, legacyEmpresaId, legacyLojaId }) {
  const extrairEmpresaId = (req) => {
    return String(
      req.query.empresaId ||
      req.headers['x-empresa-id'] ||
      req.user?.empresaId ||
      (legacyEmpresaId ? legacyEmpresaId(req) : '') ||
      'dino'
    ).trim();
  };

  const extrairLojaId = (req) => {
    return String(
      req.query.lojaId ||
      req.headers['x-loja-id'] ||
      req.user?.lojaId ||
      (legacyLojaId ? legacyLojaId(req) : '') ||
      ''
    ).trim();
  };

  // 1. Diagnóstico completo e oportunidades de vendas
  const handlerGet = async (req, res) => {
    try {
      const empresaId = extrairEmpresaId(req);
      const lojaId = extrairLojaId(req);
      const dados = await buildInteligenciaVendas(db(), { empresaId, lojaId });
      res.json(dados);
    } catch (error) {
      console.error('[inteligencia-vendas] Erro ao processar:', error);
      res.status(500).json({ error: error.message || 'Erro ao gerar inteligência de vendas.' });
    }
  };

  // 2. Consulta de configurações da empresa
  const handlerGetConfig = async (req, res) => {
    try {
      const empresaId = extrairEmpresaId(req);
      const config = obterConfigEmpresa(db(), empresaId);
      res.json({ ok: true, empresaId, config });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao consultar configurações.' });
    }
  };

  // 3. Atualização de configurações da empresa
  const handlerPostConfig = async (req, res) => {
    try {
      const empresaId = extrairEmpresaId(req);
      const novaConfig = req.body || {};
      const configSalva = salvarConfigEmpresa(db(), empresaId, novaConfig);
      res.json({
        ok: true,
        sucesso: true,
        empresaId,
        config: configSalva,
        mensagem: 'Configurações de vendas e políticas Meta atualizadas com sucesso!',
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao salvar configurações.' });
    }
  };

  // 4. Registro de conversão (Dinheiro trazido para a mesa)
  const handlerRegistrarConversao = async (req, res) => {
    try {
      const empresaId = extrairEmpresaId(req);
      const dadosConversao = req.body || {};
      if (!dadosConversao.valor && !dadosConversao.clienteNome) {
        return res.status(400).json({ error: 'Dados de conversão inválidos (valor ou cliente).' });
      }
      const registro = registrarConversaoVenda(db(), empresaId, dadosConversao);
      res.json({
        ok: true,
        sucesso: true,
        registro,
        mensagem: `Sucesso! R$ ${Number(registro.valor || 0).toFixed(2)} registrados no caixa da ${empresaId}!`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao registrar conversão.' });
    }
  };

  // 5. Histórico de conversões
  const handlerGetConversoes = async (req, res) => {
    try {
      const empresaId = extrairEmpresaId(req);
      const conversoes = obterConversoesVenda(db(), empresaId);
      res.json({ ok: true, empresaId, conversoes });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao consultar conversões.' });
    }
  };

  // 6. Registro de disparo de ação no WhatsApp
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
  app.get('/api/admin/inteligencia-vendas/config', handlerGetConfig);
  app.post('/api/admin/inteligencia-vendas/config', handlerPostConfig);
  app.post('/api/admin/inteligencia-vendas/registrar-conversao', handlerRegistrarConversao);
  app.get('/api/admin/inteligencia-vendas/conversoes', handlerGetConversoes);
  app.post('/api/admin/inteligencia-vendas/disparar-acao', handlerDisparar);

  app.get('/api/admin/vender-mais', handlerGet);
  app.post('/api/admin/vender-mais/disparar-acao', handlerDisparar);

  // Rota de compatibilidade barbearia
  app.get('/api/admin/barbearia/inteligencia-vendas', handlerGet);
  app.get('/api/admin/barbearia/inteligencia-vendas/config', handlerGetConfig);
  app.post('/api/admin/barbearia/inteligencia-vendas/config', handlerPostConfig);
  app.post('/api/admin/barbearia/inteligencia-vendas/registrar-conversao', handlerRegistrarConversao);
  app.post('/api/admin/barbearia/inteligencia-vendas/disparar-acao', handlerDisparar);
}
