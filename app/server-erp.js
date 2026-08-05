/**
 * SetPoint Ultra — ERP Modular Brasil
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
    ? [process.env.FRONTEND_URL, /\.setpointultra\.com\.br$/].filter(Boolean)
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
    etag: true
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
    const { user, pass } = req.body;
    
    if (!user || !pass) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    const usuario = usuarios.get(user);
    
    if (!usuario || !verificarPassword(pass, usuario.senha)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    
    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Usuário desativado' });
    }
    
    const token = Buffer.from(`${user}:${Date.now()}`).toString('base64');
    
    res.json({
      token,
      user: usuario.nome,
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
    nome: 'SetPoint Ultra — ERP Modular Brasil',
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
    { prefixo: '/api/v1/fiscal',        arquivo: './modules/fiscal/routes.js',        nome: 'Fiscal (NFC-e/NF-e/NF-Se)' },
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
// TRATAMENTO DE ERROS
// ============================================================================

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ erro: 'Rota não encontrada', caminho: req.path });
  }
  // SPA fallback
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

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

async function iniciar() {
  console.log('\n' + '═'.repeat(65));
  console.log('  🚀 SetPoint Ultra — ERP Modular Brasil v3.0.0');
  console.log('═'.repeat(65));
  console.log('\n📦 Registrando módulos...\n');

  // Criar usuário admin padrão
  criarAdminPadrao();
  await registrarModulos();

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
  process.on(sig, () => {
    console.log(`\n⚠️  ${sig} recebido — encerrando graciosamente...`);
    process.exit(0);
  });
}

iniciar();

export default app;
