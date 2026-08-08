/**
 * KYTTO Clube — Plataforma de Gestão Integrada
 * server-erp.js — Servidor principal com TODOS os módulos integrados
 *
 * Versão: 3.0.0
 * Módulos: Loja de Moda, Oficina, Agropecuária/Petshop, Barbearia,
 *          Varejo Geral, Compras, Fiscal, BI, CRM, Supermercado, PDV
 *
 * Para iniciar: node server-erp.js
 * Para produção: NODE_ENV=production node server-erp.js
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import { db, save, hydrate, flush } from './db.js';
import { CATALOGO_BEBIDAS_KYTTO, RESUMO_CATALOGO_BEBIDAS } from './catalogo-bebidas.js';
import { CATALOGO_ESPETINHOS_KYTTO, RESUMO_CATALOGO_ESPETINHOS } from './catalogo-espetinhos.js';
import * as fiscalKytto from './fiscal-kytto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const PROD = process.env.NODE_ENV === 'production';

// ============================================================================
// MIDDLEWARES GLOBAIS
// ============================================================================

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // React SPA precisa de scripts inline
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: PROD
    ? [process.env.FRONTEND_URL, /\.kytto\.com\.br$/].filter(Boolean)
    : '*',
  credentials: true
}));

// Rate limit global: 300 req/min por IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Aguarde um momento.' }
}));

// Rate limit específico para auth: 10 tentativas/min
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { erro: 'Muitas tentativas de login. Aguarde 1 minuto.' }
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Em produção, servir o build React antes das rotas. As chamadas /api/*
// continuam sendo resolvidas pelos módulos registrados abaixo.
if (PROD) {
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true,
    setHeaders: (res, filePath) => {
      // O HTML e o worker determinam qual versão do frontend será carregada.
      // Não podem permanecer em cache após um deploy.
      if (/\/(index\.html|sw\.js|manifest\.json|manifest\.webmanifest)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      }
    }
  }));
}

// Log de requisições em desenvolvimento
if (!PROD) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================================
// AUTENTICAÇÃO E USUÁRIOS
// ============================================================================

// Armazenamento em memória (em produção, usar banco de dados)
const usuarios = new Map();

// Usuário admin padrão (será criado na inicialização)
const ADMIN_TEMP_PASSWORD = 'SetPoint@2026Temp';
const ADMIN_EMAIL = 'admin@setpoint-ultra.local';

// Função auxiliar para hash simples (em produção, usar bcrypt)
function hashPassword(pwd) {
  return Buffer.from(pwd).toString('base64');
}

function verificarPassword(pwd, hash) {
  return hashPassword(pwd) === hash;
}

// Criar usuário admin na inicialização
function criarAdminPadrao() {
  if (!usuarios.has(ADMIN_EMAIL)) {
    usuarios.set(ADMIN_EMAIL, {
      email: ADMIN_EMAIL,
      nome: 'Administrador',
      senha: hashPassword(ADMIN_TEMP_PASSWORD),
      tipo: 'admin',
      criado: new Date(),
      ativo: true
    });
    console.log(`✅ Usuário admin criado: ${ADMIN_EMAIL}`);
    console.log(`🔐 Senha temporária: ${ADMIN_TEMP_PASSWORD}`);
  }
}

// Rota: Login Admin (Painel)
app.post('/api/admin/login', authLimiter, (req, res) => {
  try {
    const { user, pass, senha } = req.body || {};
    const senhaInformada = pass || senha;

    if (!user || !senhaInformada) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const usuario = usuarios.get(String(user).trim().toLowerCase());

    if (!usuario || !verificarPassword(senhaInformada, usuario.senha)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    
    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Usuário desativado' });
    }
    
    const token = Buffer.from(`${user}:${Date.now()}`).toString('base64');
    
    res.json({
      token,
      user: { email: usuario.email, nome: usuario.nome, role: usuario.role || 'admin' },
      role: usuario.role || 'admin'
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Rota: Login Atleta
app.post('/api/auth/login', authLimiter, (req, res) => {
  try {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }
    
    const usuario = usuarios.get(email);
    
    if (!usuario || !verificarPassword(senha, usuario.senha)) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }
    
    if (!usuario.ativo) {
      return res.status(403).json({ erro: 'Usuário desativado' });
    }
    
    // Gerar token simples (em produção, usar JWT)
    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    
    res.json({
      token,
      user: {
        email: usuario.email,
        nome: usuario.nome,
        role: 'atleta'
      }
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

// Rota: Cadastro Atleta
app.post('/api/auth/registro', authLimiter, (req, res) => {
  try {
    const { email, nome, senha } = req.body;
    
    if (!email || !nome || !senha) {
      return res.status(400).json({ erro: 'Email, nome e senha são obrigatórios' });
    }
    
    if (senha !== senhaConfirm) {
      return res.status(400).json({ erro: 'Senhas não conferem' });
    }
    
    if (senha.length < 8) {
      return res.status(400).json({ erro: 'Senha deve ter no mínimo 8 caracteres' });
    }
    
    if (usuarios.has(email)) {
      return res.status(409).json({ erro: 'Email já cadastrado' });
    }
    
    // Validar se é um email de rota conhecida
    if (!email.includes('@')) {
      return res.status(400).json({ erro: 'Email inválido' });
    }
    
    usuarios.set(email, {
      email,
      nome,
      senha: hashPassword(senha),
      tipo: 'usuario',
      criado: new Date(),
      ativo: true
    });
    
    res.status(201).json({
      sucesso: true,
      mensagem: 'Conta criada com sucesso',
      usuario: { email, nome, tipo: 'usuario' }
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar conta' });
  }
});

// Rota: Recuperação de Senha
app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ erro: 'Email é obrigatório' });
    }
    
    const usuario = usuarios.get(email);
    
    if (!usuario) {
      // Não revelar se o email existe (segurança)
      return res.json({
        sucesso: true,
        mensagem: 'Se o email existe, um link de recuperação foi enviado'
      });
    }
    
    // Gerar token de recuperação
    const tokenRecuperacao = Buffer.from(`${email}:${Date.now()}:recover`).toString('base64');
    usuario.tokenRecuperacao = tokenRecuperacao;
    usuario.expiracaoRecuperacao = Date.now() + (3600 * 1000); // 1 hora
    
    res.json({
      sucesso: true,
      mensagem: 'Link de recuperação enviado para o email',
      // Em produção, enviar por email. Para teste:
      _debug: PROD ? undefined : { token: tokenRecuperacao }
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao processar recuperação' });
  }
});

// Rota: Redefinir Senha
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, novaSenha, novasenhaConfirm } = req.body;
    
    if (!token || !novaSenha) {
      return res.status(400).json({ erro: 'Token e nova senha são obrigatórios' });
    }
    
    if (novaSenha !== novasenhaConfirm) {
      return res.status(400).json({ erro: 'Senhas não conferem' });
    }
    
    if (novaSenha.length < 8) {
      return res.status(400).json({ erro: 'Senha deve ter no mínimo 8 caracteres' });
    }
    
    // Procurar usuário com este token
    let usuarioEncontrado = null;
    for (const [email, usuario] of usuarios.entries()) {
      if (usuario.tokenRecuperacao === token && usuario.expiracaoRecuperacao > Date.now()) {
        usuarioEncontrado = usuario;
        break;
      }
    }
    
    if (!usuarioEncontrado) {
      return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
    
    usuarioEncontrado.senha = hashPassword(novaSenha);
    usuarioEncontrado.tokenRecuperacao = null;
    usuarioEncontrado.expiracaoRecuperacao = null;
    
    res.json({
      sucesso: true,
      mensagem: 'Senha alterada com sucesso'
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao redefinir senha' });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    versao: '3.0.0',
    timestamp: new Date().toISOString(),
    modulos: [
      'loja-moda', 'oficina', 'agropecuaria', 'barbearia',
      'varejo', 'compras', 'fiscal', 'bi', 'crm',
      'supermercado', 'pdv', 'bar', 'estoque', 'financeiro'
    ]
  });
});

app.get('/', (req, res) => {
  res.json({
    nome: 'KYTTO Clube — Plataforma de Gestão Integrada',
    versao: '3.0.0',
    status: 'operacional',
    segmentos: {
      esportivo: 'Quadras, Torneios, Ranking, App do Atleta',
      varejo: 'PDV, NFC-e, Estoque, Compras, Crediário',
      servicos: 'Barbearia, Oficina, Petshop, Agropecuária',
      alimentacao: 'Bar, Restaurante, KDS, Comanda',
      gestao: 'BI, DRE, CRM, Financeiro, Multi-Tenant'
    }
  });
});

// ============================================================================
// IMPORTAÇÃO E REGISTRO DE MÓDULOS
// ============================================================================

async function registrarModulos() {
  const modulos = [
    // ── MÓDULOS ESPORTIVOS ──────────────────────────────────────────────────
    { prefixo: '/api/v1/reservas',      arquivo: './modules/reservas/routes.js',      nome: 'Reservas de Quadras' },
    { prefixo: '/api/v1/torneios',      arquivo: './modules/torneios/routes.js',      nome: 'Torneios' },
    { prefixo: '/api/v1/ranking',       arquivo: './modules/ranking/routes.js',       nome: 'Ranking' },
    { prefixo: '/api/v1/clube',         arquivo: './modules/clube/routes.js',         nome: 'Clube/Atletas' },

    // ── MÓDULOS PDV E FISCAL ────────────────────────────────────────────────
    { prefixo: '/api/v1/pdv',           arquivo: './modules/pdv/routes.js',           nome: 'PDV' },
    { prefixo: '/api/v1/caixa',         arquivo: './modules/caixa/routes.js',         nome: 'Caixa' },
    // Fiscal é montado diretamente abaixo: a produção usa db.json persistido no GCS,
    // enquanto o módulo legado pressupõe PostgreSQL.
    { prefixo: '/api/v1/pagamentos',    arquivo: './modules/pagamentos-multi/routes.js', nome: 'Pagamentos Multi-Adquirente' },

    // ── MÓDULOS ALIMENTAÇÃO ─────────────────────────────────────────────────
    { prefixo: '/api/v1/bar',           arquivo: './modules/bar/routes.js',           nome: 'Bar/Comanda' },
    { prefixo: '/api/v1/restaurante',   arquivo: './modules/restaurante/routes.js',   nome: 'Restaurante/KDS' },

    // ── MÓDULOS COMERCIAIS ──────────────────────────────────────────────────
    { prefixo: '/api/v1/supermercado',  arquivo: './modules/supermercado/routes.js',  nome: 'Supermercado' },
    { prefixo: '/api/v1/loja-moda',     arquivo: './modules/loja-moda/routes.js',     nome: 'Loja de Moda' },
    { prefixo: '/api/v1/varejo',        arquivo: './modules/varejo/routes.js',        nome: 'Varejo Geral' },
    { prefixo: '/api/v1/compras',       arquivo: './modules/compras/routes.js',       nome: 'Compras/Fornecedores' },

    // ── MÓDULOS DE SERVIÇOS ─────────────────────────────────────────────────
    { prefixo: '/api/v1/barbearia',     arquivo: './modules/barbearia/routes.js',     nome: 'Barbearia/Salão' },
    { prefixo: '/api/v1/oficina',       arquivo: './modules/oficina/routes.js',       nome: 'Oficina Mecânica' },
    { prefixo: '/api/v1/agropecuaria',  arquivo: './modules/agropecuaria/routes.js',  nome: 'Agropecuária/Petshop' },

    // ── MÓDULOS TRANSVERSAIS ────────────────────────────────────────────────
    { prefixo: '/api/v1/estoque',       arquivo: './modules/estoque/routes.js',       nome: 'Estoque' },
    { prefixo: '/api/v1/financeiro',    arquivo: './modules/financeiro/routes.js',    nome: 'Financeiro' },
    { prefixo: '/api/v1/clientes',      arquivo: './modules/clientes/routes.js',      nome: 'Clientes/CRM' },
    { prefixo: '/api/v1/crm',           arquivo: './modules/crm/routes.js',           nome: 'CRM Avançado' },
    { prefixo: '/api/v1/catalogo',      arquivo: './modules/catalogo/routes.js',      nome: 'Catálogo de Produtos' },
    { prefixo: '/api/v1/bi',            arquivo: './modules/bi/routes.js',            nome: 'BI/Relatórios' },
    { prefixo: '/api/v1/billing',       arquivo: './modules/billing/routes.js',       nome: 'Billing SaaS' },
  ];

  let registrados = 0;
  let falhas = 0;

  for (const modulo of modulos) {
    try {
      const { default: router } = await import(modulo.arquivo);
      app.use(modulo.prefixo, router);
      console.log(`  ✅ ${modulo.nome} → ${modulo.prefixo}`);
      registrados++;
    } catch (err) {
      // Módulo ainda não implementado — registra aviso mas não derruba o servidor
      console.warn(`  ⚠️  ${modulo.nome} → ${modulo.prefixo} (não disponível: ${err.message})`);
      falhas++;
    }
  }

  console.log(`\n📦 Módulos: ${registrados} ativos, ${falhas} pendentes de implementação\n`);
}

// ============================================================================
// ROTAS PÚBLICAS (sem autenticação)
// ============================================================================

try {
  const { default: agendamentoPublico } = await import('./modules/barbearia/routes-publico.js');
  app.use('/api/publico/agendamento', agendamentoPublico);
  console.log('  ✅ Agendamento Online Público → /api/publico/agendamento/:slug');
} catch (err) {
  console.warn('  ⚠️  Agendamento Online Público não disponível:', err.message);
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

async function iniciar() {
  // Carrega o estado persistente antes de expor qualquer endpoint mutável.
  await hydrate();
  console.log('\n' + '═'.repeat(65));
  console.log('  🚀 KYTTO Clube — Plataforma de Gestão Integrada v3.0.0');
  console.log('═'.repeat(65));
  console.log('\n📦 Registrando módulos...\n');

  // Criar usuário admin padrão
  criarAdminPadrao();
  await registrarModulos();

  // Rota: Info
  app.get('/api/info', (req, res) => {
    res.json({
      versao: '3.0.0',
      nome: 'KYTTO Clube',
      ambiente: PROD ? 'produção' : 'desenvolvimento'
    });
  });

  // Rota: Dashboard
  app.get('/api/admin/dashboard', (req, res) => {
    res.json({
      // Faturamento: array de dias com total (para o gráfico de barras)
      faturamento: [
        { data: '01/08', total: 0 },
        { data: '02/08', total: 0 },
        { data: '03/08', total: 0 },
        { data: '04/08', total: 0 },
        { data: '05/08', total: 0 },
        { data: '06/08', total: 0 },
        { data: '07/08', total: 0 }
      ],
      // Pagamentos por meio (para o gráfico de pizza)
      pagamentos_meio: {
        credito: 0,
        debito: 0,
        dinheiro: 0
      },
      // Próximos jogos/partidas
      proximos_jogos: [],
      // Alertas do sistema
      alertas: [],
      // Indicadores principais (KPIs)
      indicadores: {
        inscricoes: 0,
        atletas: 0,
        inscritos: 0,
        receita: 0,
        faturamentoBar: 0,
        fatLoja: 0,
        fatInsc: 0,
        mesasOcupadas: 0,
        totalMesas: 0,
        comandasAbertas: 0
      },
      // Pendências
      pendencias: {
        inscPend: 0,
        pagPend: 0,
        faturasAbertas: 0,
        placaresNaoConf: 0,
        reservasHoje: 0
      }
    });
  });

  // ── CATÁLOGO / CARDÁPIO ──────────────────────────────────────────────────
  // O token emitido no login é usado para proteger a administração do catálogo.
  // A rota de leitura do PDV entrega apenas itens liberados para venda.
  function usuarioDoToken(req) {
    const header = String(req.headers.authorization || '');
    if (!header.startsWith('Bearer ')) return null;
    try {
      const decoded = Buffer.from(header.slice(7), 'base64').toString('utf8');
      const email = decoded.split(':')[0]?.trim().toLowerCase();
      return email ? usuarios.get(email) || null : null;
    } catch {
      return null;
    }
  }

  function requerEditorCatalogo(req, res, next) {
    const usuario = usuarioDoToken(req);
    if (!usuario || usuario.tipo !== 'admin') {
      return res.status(401).json({ erro: 'Autenticação administrativa necessária' });
    }
    req.usuario = usuario;
    next();
  }

  // ── FISCAL / CERTIFICADOS A1 ──────────────────────────────────────────────
  // Usa a mesma autenticação administrativa do catálogo e mantém certificados
  // cifrados em objeto dedicado do GCS. Nunca retorna senha, CSC ou arquivo A1.
  const fiscalTenantId = (req) => `conta-${req.usuario?.email || 'principal'}`;
  const fiscalResposta = (config) => fiscalKytto.limparDadosSensiveis(config);

  app.get('/api/v1/fiscal/config', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, config: fiscalResposta(fiscalKytto.obterConfiguracaoFiscal(fiscalTenantId(req))) });
  });

  app.post('/api/v1/fiscal/config', requerEditorCatalogo, (req, res) => {
    try {
      const config = fiscalKytto.salvarConfiguracaoFiscal(fiscalTenantId(req), req.body || {});
      res.json({ ok: true, config: fiscalResposta(config), mensagem: 'Configuração fiscal salva.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/v1/fiscal/certificados', requerEditorCatalogo, async (req, res) => {
    try {
      res.json({ ok: true, certificados: await fiscalKytto.listarCertificados(fiscalTenantId(req)) });
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  });

  app.post('/api/v1/fiscal/certificado', requerEditorCatalogo, async (req, res) => {
    try {
      const config = await fiscalKytto.importarCertificadoA1(fiscalTenantId(req), {
        arquivoBase64: req.body?.pfx_base64 || req.body?.arquivoBase64,
        senha: req.body?.senha,
        nomeArquivo: req.body?.nomeArquivo || req.body?.nome_arquivo || 'certificado-a1.p12',
      });
      res.status(201).json({ ok: true, config: fiscalResposta(config), mensagem: 'Certificado A1 validado, cifrado e associado à empresa.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/v1/fiscal/certificados/:id/ativar', requerEditorCatalogo, (req, res) => {
    try {
      const config = fiscalKytto.ativarCertificado(fiscalTenantId(req), req.params.id);
      res.json({ ok: true, config: fiscalResposta(config), mensagem: 'Certificado ativo atualizado.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/v1/fiscal/documentos', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, documentos: fiscalKytto.listarDocumentos(fiscalTenantId(req)) });
  });

  // Este endpoint valida prontidão, reserva numeração e registra a solicitação.
  // O envio à SEFAZ permanece bloqueado até que os requisitos cadastrais e as
  // regras fiscais por produto estejam completos, evitando emissão inválida.
  app.post('/api/v1/fiscal/nfce/preflight', requerEditorCatalogo, (req, res) => {
    try {
      const documento = fiscalKytto.registrarPreflightEmissao(fiscalTenantId(req), req.body || {});
      res.status(201).json({ ok: true, documento, mensagem: 'NFC-e preparada para autorização após a validação fiscal.' });
    } catch (error) {
      res.status(422).json({ erro: error.message });
    }
  });

  function cardapioPersistido() {
    const estado = db();
    if (!Array.isArray(estado.cardapio)) estado.cardapio = [];
    return estado.cardapio;
  }

  // Cada produto de cardápio tem uma ficha de estoque independente. O saldo
  // inicial é sempre zero e o histórico registra a origem de cada alteração.
  function estoquePersistido() {
    const estado = db();
    if (!estado.estoque || typeof estado.estoque !== 'object' || Array.isArray(estado.estoque)) estado.estoque = {};
    return estado.estoque;
  }

  function fichaEstoque(produto) {
    return {
      id: produto.id,
      produtoId: produto.id,
      nome: produto.nome,
      cat: produto.cat || 'Sem categoria',
      subcategoria: produto.subcategoria || '',
      unidade: produto.unidade || 'UN',
      ativo: true,
      qtd: 0,
      min: 0,
      custo: 0,
      historico: [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
  }

  function sincronizarEstoqueCardapio({ registrarHistorico = false } = {}) {
    const estoque = estoquePersistido();
    const itens = cardapioPersistido();
    const idsAtivos = new Set(itens.map(item => item.id));
    let criados = 0, atualizados = 0, arquivados = 0;
    for (const produto of itens) {
      const atual = estoque[produto.id];
      if (!atual) {
        estoque[produto.id] = fichaEstoque(produto);
        criados++;
      } else {
        const mudou = atual.nome !== produto.nome || atual.cat !== produto.cat || atual.unidade !== produto.unidade || atual.ativo !== true;
        Object.assign(atual, {
          produtoId: produto.id, nome: produto.nome, cat: produto.cat || 'Sem categoria',
          subcategoria: produto.subcategoria || '', unidade: produto.unidade || 'UN', ativo: true,
          atualizadoEm: new Date().toISOString(),
        });
        if (mudou) atualizados++;
      }
    }
    for (const ficha of Object.values(estoque)) {
      if (!idsAtivos.has(ficha.produtoId) && ficha.ativo !== false) {
        ficha.ativo = false;
        ficha.atualizadoEm = new Date().toISOString();
        if (registrarHistorico) ficha.historico ||= [];
        arquivados++;
      }
    }
    return { criados, atualizados, arquivados, total: Object.values(estoque).filter(item => item.ativo !== false).length };
  }

  function listarEstoqueCardapio() {
    const resumo = sincronizarEstoqueCardapio();
    if (resumo.criados || resumo.atualizados || resumo.arquivados) save();
    return Object.values(estoquePersistido())
      .filter(item => item.ativo !== false)
      .sort((a, b) => String(a.cat).localeCompare(String(b.cat), 'pt-BR') || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }

  function normalizarProduto(payload = {}) {
    const texto = (valor, tamanho = 160) => String(valor || '').trim().slice(0, tamanho);
    const numero = (valor) => {
      const n = Number(String(valor ?? '').replace(',', '.'));
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    return {
      nome: texto(payload.nome),
      marca: texto(payload.marca),
      tipo: texto(payload.tipo),
      embalagem: texto(payload.embalagem),
      volumeMl: payload.volumeMl == null || payload.volumeMl === '' ? null : Math.max(0, Math.floor(Number(payload.volumeMl) || 0)),
      cat: texto(payload.cat) || 'Bebidas',
      subcategoria: texto(payload.subcategoria) || 'Bebidas',
      setor: ['bar', 'cozinha', 'chapa'].includes(payload.setor) ? payload.setor : 'bar',
      emoji: texto(payload.emoji, 12),
      preco: numero(payload.preco),
      unidade: texto(payload.unidade, 12) || 'UN',
      cozinha: Boolean(payload.cozinha),
      indisponivel: Boolean(payload.indisponivel),
      precoPendente: Boolean(payload.precoPendente),
      semAlcool: Boolean(payload.semAlcool),
      fiscal: payload.fiscal && typeof payload.fiscal === 'object' ? payload.fiscal : undefined,
    };
  }

  app.get('/api/cardapio', (req, res) => {
    const itens = cardapioPersistido().filter((item) => !item.indisponivel);
    res.json(itens);
  });

  app.get('/api/admin/cardapio', requerEditorCatalogo, (req, res) => {
    res.json(cardapioPersistido());
  });

  app.get('/api/admin/estoque', requerEditorCatalogo, (req, res) => {
    res.json({ estoque: listarEstoqueCardapio() });
  });

  app.post('/api/admin/estoque/sincronizar-cardapio', requerEditorCatalogo, (req, res) => {
    const resumo = sincronizarEstoqueCardapio();
    save();
    res.json({ ok: true, ...resumo, mensagem: 'Estoque sincronizado com o cardápio.' });
  });

  app.post('/api/admin/estoque/entrada', requerEditorCatalogo, (req, res) => {
    const produtoId = String(req.body?.produtoId || '');
    const qtd = Number(req.body?.qtd);
    const custo = req.body?.custo === undefined || req.body?.custo === '' ? null : Number(req.body.custo);
    const ficha = estoquePersistido()[produtoId];
    if (!ficha || ficha.ativo === false) return res.status(404).json({ erro: 'Produto de estoque não encontrado.' });
    if (!Number.isFinite(qtd) || qtd <= 0) return res.status(400).json({ erro: 'Quantidade de entrada inválida.' });
    if (custo !== null && (!Number.isFinite(custo) || custo < 0)) return res.status(400).json({ erro: 'Custo unitário inválido.' });
    ficha.qtd = Number(ficha.qtd || 0) + qtd;
    if (custo !== null) ficha.custo = custo;
    ficha.historico ||= [];
    ficha.historico.push({ tipo: 'entrada', qtd, custo: custo ?? ficha.custo ?? 0, ts: new Date().toISOString(), origem: 'administracao' });
    ficha.historico = ficha.historico.slice(-100);
    ficha.atualizadoEm = new Date().toISOString();
    save();
    res.json({ ok: true, item: ficha });
  });

  app.post('/api/admin/estoque/ajuste', requerEditorCatalogo, (req, res) => {
    const produtoId = String(req.body?.produtoId || '');
    const ficha = estoquePersistido()[produtoId];
    if (!ficha || ficha.ativo === false) return res.status(404).json({ erro: 'Produto de estoque não encontrado.' });
    const agora = new Date().toISOString();
    let alterado = false;
    if (req.body?.min !== undefined) {
      const min = Number(req.body.min);
      if (!Number.isFinite(min) || min < 0) return res.status(400).json({ erro: 'Estoque mínimo inválido.' });
      ficha.min = Math.floor(min);
      alterado = true;
    }
    if (req.body?.qtd !== undefined) {
      const qtd = Number(req.body.qtd);
      if (!Number.isFinite(qtd) || qtd < 0) return res.status(400).json({ erro: 'Quantidade inventariada inválida.' });
      const anterior = Number(ficha.qtd || 0);
      ficha.qtd = qtd;
      ficha.historico ||= [];
      ficha.historico.push({ tipo: 'inventario', qtd: Math.abs(qtd - anterior), saldoAnterior: anterior, saldoFinal: qtd, ts: agora, origem: 'administracao' });
      ficha.historico = ficha.historico.slice(-100);
      alterado = true;
    }
    if (!alterado) return res.status(400).json({ erro: 'Informe uma quantidade ou um estoque mínimo.' });
    ficha.atualizadoEm = agora;
    save();
    res.json({ ok: true, item: ficha });
  });

  app.get('/api/admin/estoque/inventario', requerEditorCatalogo, (req, res) => {
    const itens = listarEstoqueCardapio();
    res.json({ ok: true, geradoEm: new Date().toISOString(), itens: itens.map(({ id, nome, cat, unidade, qtd, min }) => ({ id, nome, cat, unidade, qtd, min })) });
  });

  app.get('/api/admin/cardapio/catalogo-bebidas', requerEditorCatalogo, (req, res) => {
    const cadastrados = cardapioPersistido().filter((item) => item.catalogoSeed === 'kytto-bebidas-v1').length;
    res.json({ ...RESUMO_CATALOGO_BEBIDAS, cadastrados, versao: 'kytto-bebidas-v1' });
  });

  app.post('/api/admin/cardapio/catalogo-bebidas', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido();
    const existentes = new Set(itens.map((item) => `${item.marca}|${item.tipo}|${item.embalagem}`.toLowerCase()));
    const agora = new Date().toISOString();
    const adicionados = [];

    for (const produtoBase of CATALOGO_BEBIDAS_KYTTO) {
      const produto = normalizarProduto(produtoBase);
      const chave = `${produto.marca}|${produto.tipo}|${produto.embalagem}`.toLowerCase();
      if (existentes.has(chave)) continue;
      const id = `beb-${Date.now().toString(36)}-${String(itens.length + adicionados.length + 1).padStart(3, '0')}`;
      adicionados.push({
        ...produto,
        id,
        ordem: itens.length + adicionados.length + 1,
        catalogoSeed: 'kytto-bebidas-v1',
        criadoEm: agora,
        atualizadoEm: agora,
      });
      existentes.add(chave);
    }

    if (adicionados.length) {
      itens.push(...adicionados);
      sincronizarEstoqueCardapio();
      save();
    }
    res.status(201).json({ ok: true, adicionados: adicionados.length, total: itens.length, versao: 'kytto-bebidas-v1' });
  });

  app.get('/api/admin/cardapio/catalogo-espetinhos', requerEditorCatalogo, (req, res) => {
    const cadastrados = cardapioPersistido().filter((item) => item.catalogoSeed === 'kytto-espetinhos-v1').length;
    res.json({ ...RESUMO_CATALOGO_ESPETINHOS, cadastrados, versao: 'kytto-espetinhos-v1' });
  });

  app.post('/api/admin/cardapio/catalogo-espetinhos', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido();
    const existentes = new Set(itens.map((item) => String(item.nome || '').toLocaleLowerCase('pt-BR')));
    const agora = new Date().toISOString();
    const adicionados = [];
    for (const produtoBase of CATALOGO_ESPETINHOS_KYTTO) {
      const produto = normalizarProduto(produtoBase);
      const chave = produto.nome.toLocaleLowerCase('pt-BR');
      if (existentes.has(chave)) continue;
      adicionados.push({ ...produto, id: `esp-${Date.now().toString(36)}-${String(itens.length + adicionados.length + 1).padStart(3, '0')}`, ordem: itens.length + adicionados.length + 1, catalogoSeed: 'kytto-espetinhos-v1', criadoEm: agora, atualizadoEm: agora });
      existentes.add(chave);
    }
    if (adicionados.length) {
      itens.push(...adicionados);
      sincronizarEstoqueCardapio();
      save();
    }
    res.status(201).json({ ok: true, adicionados: adicionados.length, total: itens.length, versao: 'kytto-espetinhos-v1' });
  });

  app.post('/api/admin/cardapio', requerEditorCatalogo, (req, res) => {
    const produto = normalizarProduto(req.body);
    if (!produto.nome || produto.preco === null) {
      return res.status(400).json({ erro: 'Nome e preço válido são obrigatórios' });
    }
    const itens = cardapioPersistido();
    const agora = new Date().toISOString();
    const novo = { ...produto, id: `prd-${Date.now().toString(36)}-${itens.length + 1}`, ordem: itens.length + 1, criadoEm: agora, atualizadoEm: agora };
    itens.push(novo);
    sincronizarEstoqueCardapio();
    save();
    res.status(201).json({ ok: true, item: novo });
  });

  app.patch('/api/admin/cardapio/:id', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido();
    const item = itens.find((produto) => produto.id === req.params.id);
    if (!item) return res.status(404).json({ erro: 'Produto não encontrado' });
    const atualizado = normalizarProduto({ ...item, ...req.body });
    if (!atualizado.nome || atualizado.preco === null) {
      return res.status(400).json({ erro: 'Nome e preço válido são obrigatórios' });
    }
    Object.assign(item, atualizado, { atualizadoEm: new Date().toISOString() });
    sincronizarEstoqueCardapio();
    save();
    res.json({ ok: true, item });
  });

  app.delete('/api/admin/cardapio/:id', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido();
    const indice = itens.findIndex((produto) => produto.id === req.params.id);
    if (indice < 0) return res.status(404).json({ erro: 'Produto não encontrado' });
    const [removido] = itens.splice(indice, 1);
    sincronizarEstoqueCardapio({ registrarHistorico: true });
    save();
    res.json({ ok: true, removido: { id: removido.id, nome: removido.nome } });
  });

  // Rota: Notícias
  app.get('/api/noticias', (req, res) => {
    res.json([]);
  });

  // Rota: Mesas
  app.get('/api/mesas', (req, res) => {
    res.json({
      fisicas: [],
      virtuais: []
    });
  });

  // ============================================================================
  // MIDDLEWARE DE FALLBACK PARA ROTAS DE API NÃO IMPLEMENTADAS
  // ============================================================================
  // Retorna dados estruturados vazios para qualquer rota /api/* não definida
  // Isso permite que o frontend carregue sem erros enquanto as APIs são implementadas

  app.all('/api/*', (req, res) => {
    const path = req.path;
    
    // Padrões de resposta por tipo de endpoint
    if (path.includes('/login')) {
      return res.status(401).json({ erro: 'Não autenticado' });
    }
    if (path.includes('/dashboard') || path.includes('/resumo')) {
      return res.json({ total: 0, dados: [], graficos: {} });
    }
    if (path.includes('/list') || path.includes('?')) {
      return res.json([]);
    }
    if (path.includes('/config')) {
      return res.json({});
    }
    if (path.includes('/status')) {
      return res.json({ status: 'ok' });
    }
    
    // Resposta genérica para outras rotas
    res.json([]);
  });

  // ============================================================================
  // TRATAMENTO DE ERROS (DENTRO DE iniciar() APÓS TODAS AS ROTAS)
  // ============================================================================

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ erro: 'Rota não encontrada', caminho: req.path });
    }
    // SPA fallback: a página-base não pode reutilizar o bundle de um deploy anterior.
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error('[ERRO]', err?.message || err);
    if (res.headersSent) return next(err);
    res.status(err?.status || 500).json({
      erro: PROD ? 'Erro interno do servidor' : (err?.message || 'Erro interno'),
      codigo: err?.code
    });
  });

  app.listen(PORT, () => {
    console.log('═'.repeat(65));
    console.log(`  ✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`  🌍 Ambiente: ${PROD ? 'PRODUÇÃO' : 'Desenvolvimento'}`);
    console.log(`  📋 Health: http://localhost:${PORT}/health`);
    console.log('═'.repeat(65) + '\n');
  });
}

process.on('unhandledRejection', (e) => console.error('[UnhandledRejection]', e?.message || e));
process.on('uncaughtException', (e) => console.error('[UncaughtException]', e?.message || e));

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    console.log(`\n⚠️  ${sig} recebido — persistindo alterações antes de encerrar...`);
    try { await flush(); } catch (err) { console.error('Falha ao persistir no encerramento:', err?.message || err); }
    process.exit(0);
  });
}

iniciar();

export default app;
