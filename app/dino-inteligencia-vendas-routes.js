/**
 * Rotas da API de Inteligência Comercial, Vender Mais com IA,
 * Gestão de Configurações Multi-Empresa e Registro de Dinheiro na Mesa
 * com Isolamento Estrito de Acesso por Usuário:
 * - Admin Global (Rodrigo Gonçalves / rrodrigogon / admin): Proprietário do Sistema, acesso a todas as empresas.
 * - Guilherme (guilherme / guicunha / dino / gui): Gestor Barbearia Dino, acesso exclusivo à Barbearia Dino.
 * - Silvester (silvester / silvestre / stallone): Gestor Stallone & Agro Open, acesso exclusivo a Stallone e Agro Open.
 * - Demais usuários: acesso restrito exclusivamente à empresa vinculada.
 */
import {
  buildInteligenciaVendas,
  obterConfigEmpresa,
  salvarConfigEmpresa,
  registrarConversaoVenda,
  obterConversoesVenda,
} from './dino-inteligencia-vendas.js';

export const EMPRESAS_CANONICAS_INTELIGENCIA = [
  { id: 'dino', nome: 'Barbearia Dino', icone: '💈', segmento: 'Barbearia & Salão Masculino' },
  { id: 'stallone', nome: 'Stallone Nutre Sport', icone: '💪', segmento: 'Suplementos, Fitness & Saúde' },
  { id: 'agroopen', nome: 'Agro Open Insumos', icone: '🌱', segmento: 'Agronegócio, Pecuária & Insumos' },
  { id: 'supermercado', nome: 'Supermercado Kytto', icone: '🛒', segmento: 'Alimentos, Bebidas & Atacarejo' },
];

export function registerInteligenciaVendasRoutes(app, {
  db,
  legacyEmpresaId,
  legacyLojaId,
  auth,
  requireStaff,
  isAdminGlobal = () => false,
  isGuilhermeUser = () => false,
  isSilvesterUser = () => false,
  obterEmpresasAutorizadasDoUsuario = () => null
} = {}) {

  // Middleware opcional de autenticação se fornecido
  const mwAuth = auth || ((req, res, next) => next());
  const mwStaff = requireStaff || ((req, res, next) => next());

  // Mapeamento canônico de slugs e UUIDs
  const normalizarSlugEmpresa = (raw = '') => {
    const s = String(raw || '').toLowerCase().trim();
    if (s.includes('dino') || s === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || s === 'emp-kytto-001') return 'dino';
    if (s.includes('stallone') || s === '31f70c83-9172-40c2-945f-9e793b5048be' || s === 'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e') return 'stallone';
    if (s.includes('agro') || s === '2e041110-db20-4fd1-8278-12bd3dead008' || s === 'emp-agro-open') return 'agroopen';
    if (s.includes('supermercado') || s.includes('varejo')) return 'supermercado';
    if (s.includes('palatare') || s === 'c1c1ac01-8e50-4b61-8c79-de4aaa916da9') return 'palatare';
    if (s.includes('concreto')) return 'concreto';
    return s || 'dino';
  };

  /**
   * Determina a lista de slugs de empresas que o usuário pode acessar
   */
  const obterSlugsAutorizadosParaUsuario = (user) => {
    if (!user) return ['dino'];
    if (isAdminGlobal(user)) {
      return ['dino', 'stallone', 'agroopen', 'supermercado', 'palatare', 'concreto'];
    }
    if (isGuilhermeUser(user)) {
      return ['dino'];
    }
    if (isSilvesterUser(user)) {
      return ['stallone', 'agroopen'];
    }

    if (typeof obterEmpresasAutorizadasDoUsuario === 'function') {
      const lista = obterEmpresasAutorizadasDoUsuario(user);
      if (Array.isArray(lista) && lista.length > 0) {
        return lista.map(normalizarSlugEmpresa);
      }
    }

    const empId = user.empresaId ? normalizarSlugEmpresa(user.empresaId) : 'dino';
    return [empId];
  };

  const extrairEmpresaIdValida = (req) => {
    const solicitada = String(
      req.query.empresaId ||
      req.query.empresa ||
      req.headers['x-empresa-id'] ||
      req.body?.empresaId ||
      (legacyEmpresaId ? legacyEmpresaId(req) : '') ||
      ''
    ).trim();

    const slugSolicitado = normalizarSlugEmpresa(solicitada);
    const slugsPermitidos = obterSlugsAutorizadosParaUsuario(req.user);

    // Se o usuário for Admin Global, respeita o que ele pediu
    if (isAdminGlobal(req.user)) {
      return slugSolicitado || 'dino';
    }

    // Se a empresa solicitada for permitida para este usuário, usa ela
    if (slugsPermitidos.includes(slugSolicitado)) {
      return slugSolicitado;
    }

    // Se o usuário tentou acessar uma empresa que não tem permissão, força a primeira autorizada
    return slugsPermitidos[0] || 'dino';
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

  /**
   * Middleware de guarda: se o usuário tentar forçar uma empresa para a qual não tem permissão,
   * bloqueia com 403 Forbidden para manter auditoria e compliance estrito.
   */
  const middlewareGuardaEmpresa = (req, res, next) => {
    const user = req.user;
    if (!user || isAdminGlobal(user)) {
      return next();
    }

    const solicitadaRaw = String(
      req.query.empresaId ||
      req.query.empresa ||
      req.headers['x-empresa-id'] ||
      req.body?.empresaId ||
      ''
    ).trim();

    if (solicitadaRaw) {
      const slugSolicitado = normalizarSlugEmpresa(solicitadaRaw);
      const slugsPermitidos = obterSlugsAutorizadosParaUsuario(user);

      if (!slugsPermitidos.includes(slugSolicitado)) {
        if (isGuilhermeUser(user)) {
          return res.status(403).json({
            error: 'Acesso negado: seu usuário tem permissão exclusiva para gerenciar a Barbearia Dino.',
            code: 'TENANT_FORBIDDEN',
            empresaPermitida: 'dino',
          });
        }
        if (isSilvesterUser(user)) {
          return res.status(403).json({
            error: 'Acesso negado: seu usuário tem permissão exclusiva para Stallone Nutre Sport e Agro Open.',
            code: 'TENANT_FORBIDDEN',
            empresasPermitidas: ['stallone', 'agroopen'],
          });
        }
        return res.status(403).json({
          error: `Acesso negado para a empresa solicitada (${slugSolicitado}).`,
          code: 'TENANT_FORBIDDEN',
          empresasPermitidas: slugsPermitidos,
        });
      }
    }

    next();
  };

  // 1. Diagnóstico completo e oportunidades de vendas
  const handlerGet = async (req, res) => {
    try {
      const empresaId = extrairEmpresaIdValida(req);
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
      const empresaId = extrairEmpresaIdValida(req);
      const config = obterConfigEmpresa(db(), empresaId);
      res.json({ ok: true, empresaId, config });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao consultar configurações.' });
    }
  };

  // 3. Atualização de configurações da empresa
  const handlerPostConfig = async (req, res) => {
    try {
      const empresaId = extrairEmpresaIdValida(req);
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
      const empresaId = extrairEmpresaIdValida(req);
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
      const empresaId = extrairEmpresaIdValida(req);
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

  // 7. Lista autorizada de empresas para o usuário logado
  const handlerGetEmpresasAutorizadas = (req, res) => {
    const user = req.user;
    const ehAdmin = Boolean(isAdminGlobal(user));
    const slugs = obterSlugsAutorizadosParaUsuario(user);

    const todas = [
      { id: 'dino', nome: 'Barbearia Dino', icone: '💈', segmento: 'Barbearia & Salão Masculino' },
      { id: 'stallone', nome: 'Stallone Nutre Sport', icone: '💪', segmento: 'Suplementos, Fitness & Saúde' },
      { id: 'agroopen', nome: 'Agro Open Insumos', icone: '🌱', segmento: 'Agronegócio, Pecuária & Insumos' },
      { id: 'supermercado', nome: 'Supermercado Kytto', icone: '🛒', segmento: 'Alimentos, Bebidas & Atacarejo' },
    ];

    const filtradas = ehAdmin ? todas : todas.filter((item) => slugs.includes(item.id));

    let perfilDescricao = 'Usuário do Sistema';
    if (ehAdmin) {
      perfilDescricao = 'Proprietário Kytto Holding (Acesso Global a Todas as Empresas)';
    } else if (isGuilhermeUser(user)) {
      perfilDescricao = 'Gestor Barbearia Dino (Acesso Exclusivo à Unidade Dino)';
    } else if (isSilvesterUser(user)) {
      perfilDescricao = 'Gestor Stallone Nutre Sport & Agro Open';
    }

    res.json({
      ok: true,
      ehAdminPlataforma: ehAdmin,
      usuario: user?.email || user?.nome || user?.username || 'Usuário',
      perfilDescricao,
      empresas: filtradas,
      total: filtradas.length,
    });
  };

  // Rotas canônicas universais
  app.get('/api/admin/inteligencia-vendas/empresas-autorizadas', mwAuth, mwStaff, handlerGetEmpresasAutorizadas);
  app.get('/api/admin/inteligencia-vendas', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerGet);
  app.get('/api/admin/inteligencia-vendas/config', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerGetConfig);
  app.post('/api/admin/inteligencia-vendas/config', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerPostConfig);
  app.post('/api/admin/inteligencia-vendas/registrar-conversao', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerRegistrarConversao);
  app.get('/api/admin/inteligencia-vendas/conversoes', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerGetConversoes);
  app.post('/api/admin/inteligencia-vendas/disparar-acao', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerDisparar);

  app.get('/api/admin/vender-mais', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerGet);
  app.post('/api/admin/vender-mais/disparar-acao', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerDisparar);

  // Rota de compatibilidade barbearia
  app.get('/api/admin/barbearia/inteligencia-vendas/empresas-autorizadas', mwAuth, mwStaff, handlerGetEmpresasAutorizadas);
  app.get('/api/admin/barbearia/inteligencia-vendas', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerGet);
  app.get('/api/admin/barbearia/inteligencia-vendas/config', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerGetConfig);
  app.post('/api/admin/barbearia/inteligencia-vendas/config', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerPostConfig);
  app.post('/api/admin/barbearia/inteligencia-vendas/registrar-conversao', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerRegistrarConversao);
  app.post('/api/admin/barbearia/inteligencia-vendas/disparar-acao', mwAuth, mwStaff, middlewareGuardaEmpresa, handlerDisparar);
}
