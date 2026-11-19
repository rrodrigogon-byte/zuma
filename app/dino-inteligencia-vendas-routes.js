/**
 * Rotas da API de Inteligência Comercial, Vender Mais com IA,
 * Gestão de Configurações Multi-Empresa e Registro de Dinheiro na Mesa
 */
import {
  calcularBuracosAgendaDino,
  executarBloqueioBuraco,
  executarEncaixeRapidoBuraco,
  obterHojeCuiaba,
} from './core/dino-buracos-agenda-engine.js';
import {
  buildInteligenciaVendas,
  obterConfigEmpresa,
  salvarConfigEmpresa,
  registrarConversaoVenda,
  obterConversoesVenda,
} from './dino-inteligencia-vendas.js';

export function registerInteligenciaVendasRoutes(app, {
  db,
  legacyEmpresaId,
  legacyLojaId,
  auth,
  requireStaff,
  isAdminGlobal,
  isGuilhermeUser,
  isSilvesterUser,
  obterEmpresasAutorizadasDoUsuario,
}) {
  const extrairEmpresaId = (req) => {
    return String(
      req.query.empresaId ||
      req.headers['x-empresa-id'] ||
      req.user?.empresaId ||
      (legacyEmpresaId ? legacyEmpresaId(req) : '') ||
      ''
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


  // 7. Buracos na Agenda (Vagas Ociosas Futuras) - Exclusivo de HOJE para FRENTE
  const handlerGetBuracos = async (req, res) => {
    try {
      const empresaId = extrairEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      const estado = db().barbearias?.[empresaId] || {};
      const diasAFrente = Math.max(1, Number(req.query?.dias || 10));
      const barbeiro = String(req.query?.barbeiro || '').trim();

      const dadosIntel = await buildInteligenciaVendas(db(), { empresaId, lojaId: extrairLojaId(req) });
      const buracos = dadosIntel.oportunidades?.vagasOciosasSemana || dadosIntel.vagasOciosasSemana || [];

      res.json({
        ok: true,
        sucesso: true,
        empresaId,
        hoje: obterHojeCuiaba(),
        totalBuracos: buracos.length,
        buracos,
      });
    } catch (error) {
      console.error('[buracos-agenda] Erro ao listar:', error);
      res.status(500).json({ error: error.message || 'Erro ao listar vagas ociosas.' });
    }
  };

  // 8. Ação: Bloquear slot ocioso
  const handlerBloquearBuraco = async (req, res) => {
    try {
      const empresaId = extrairEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      const { profissionalId, data, horario, motivo } = req.body || {};
      const resultado = executarBloqueioBuraco(empresaId, { profissionalId, data, horario, motivo });
      res.json(resultado);
    } catch (error) {
      console.error('[buracos-agenda] Erro ao bloquear:', error);
      res.status(400).json({ error: error.message || 'Erro ao bloquear horário na agenda.' });
    }
  };

  // 9. Ação: Fazer Encaixe Rápido
  const handlerEncaixeBuraco = async (req, res) => {
    try {
      const empresaId = extrairEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      const { profissionalId, data, horario, clienteNome, clienteTelefone, servicoId, valor } = req.body || {};
      const resultado = executarEncaixeRapidoBuraco(empresaId, {
        profissionalId,
        data,
        horario,
        clienteNome,
        clienteTelefone,
        servicoId,
        valor,
      });
      res.json(resultado);
    } catch (error) {
      console.error('[buracos-agenda] Erro no encaixe:', error);
      res.status(400).json({ error: error.message || 'Erro ao realizar encaixe na agenda.' });
    }
  };

  // Rotas de Buracos na Agenda
  app.get('/api/admin/dino/buracos-agenda', handlerGetBuracos);
  app.post('/api/admin/dino/buracos-agenda/bloquear', handlerBloquearBuraco);
  app.post('/api/admin/dino/buracos-agenda/encaixe', handlerEncaixeBuraco);
  app.post('/api/admin/dino/buracos-agenda/disparar-whatsapp', handlerDisparar);

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

  // 7. Lista de empresas autorizadas para o seletor da Inteligência de Vendas
  const CANONICAS = [
    { id: 'dino', nome: 'Barbearia Dino', icone: '💈', segmento: 'Barbearia & Salão Masculino' },
    { id: 'stallone', nome: 'Stallone Nutre Sport', icone: '💪', segmento: 'Suplementos, Fitness & Saúde' },
    { id: 'agroopen', nome: 'Agro Open Insumos', icone: '🌱', segmento: 'Agronegócio, Pecuária & Insumos' },
    { id: 'supermercado', nome: 'Supermercado Kytto', icone: '🛒', segmento: 'Alimentos, Bebidas & Atacarejo' },
  ];

  const handlerEmpresasAutorizadas = (req, res) => {
    try {
      const user = req.user;
      const ident = String(user?.email || user?.username || user?.login || '').toLowerCase().trim();
      const ehAdmin = Boolean(
        (isAdminGlobal && isAdminGlobal(user)) ||
        user?.platformAdmin === true ||
        user?.mainAdmin === true ||
        user?.role === 'admin' ||
        ident.includes('rodrigo.goncalves') ||
        ident.includes('rrodrigogon') ||
        ident === 'admin'
      );
      let permitidas = CANONICAS;
      if (!ehAdmin) {
        if (isGuilhermeUser && isGuilhermeUser(user)) {
          permitidas = CANONICAS.filter(c => c.id === 'dino');
        } else if (isSilvesterUser && isSilvesterUser(user)) {
          permitidas = CANONICAS.filter(c => c.id === 'stallone' || c.id === 'agroopen');
        } else if (obterEmpresasAutorizadasDoUsuario) {
          const ids = (obterEmpresasAutorizadasDoUsuario(user) || []).map(x => String(x).toLowerCase());
          if (ids.length) {
            permitidas = CANONICAS.filter(c => ids.includes(c.id));
          }
        }
      }
      res.json({
        ok: true,
        ehAdminPlataforma: ehAdmin,
        empresas: permitidas.length ? permitidas : [CANONICAS[0]],
      });
    } catch (e) {
      res.json({ ok: true, ehAdminPlataforma: true, empresas: CANONICAS });
    }
  };

  app.get('/api/admin/inteligencia-vendas/empresas-autorizadas', handlerEmpresasAutorizadas);
  app.get('/api/admin/barbearia/inteligencia-vendas/empresas-autorizadas', handlerEmpresasAutorizadas);
}
