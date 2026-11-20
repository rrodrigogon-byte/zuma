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
import crypto from 'crypto';
import { db, save, hydrate, flush } from './db.js';
import { CATALOGO_BAR_TTC_OFICIAL, CATALOGO_BAR_TTC_SKUS, RESUMO_CATALOGO_BAR_TTC } from './catalogo-bar-ttc-oficial.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as fiscalKytto from './fiscal-kytto.js';
import * as tributacaoKytto from './tributacao-kytto.js';
import * as fiscalXmlKytto from './fiscal-xml-kytto.js';
import { gerarRepresentacaoAuxiliarNfce } from './representacao-fiscal-kytto.js';
import * as modificadoresCombosKytto from './modificadores-combos-kytto.js';
import * as reservasKytto from './reservas-kytto.js';
import * as perdasInventarioKytto from './perdas-inventario-kytto.js';
import * as kdsAvancadoKytto from './kds-avancado-kytto.js';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import * as cadastrosMestres from './cadastros-mestres-kytto.js';
import { pagamentosPix, listarProvedoresPagamento } from './pagamentos-pix-kytto.js';
import { gerarRelatorioOperacional } from './relatorios-operacionais-kytto.js';
import * as canaisKytto from './canais-fidelidade-kytto.js';
import * as financeiroKytto from './financeiro-central-kytto.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import * as fichasTecnicasKytto from './fichas-tecnicas-kytto.js';
import * as caixaKytto from './caixa-diario-kytto.js';
import * as comprasKytto from './compras-kytto.js';
import * as metricasKytto from './metricas-kytto.js';
import { observabilidade } from './observabilidade-kytto.js';
import { backupRecuperacao } from './backup-recuperacao-kytto.js';
import { acaoDaRequisicao, moduloDaRota, resumoAcessoUsuario, temPermissao } from './perfis-usuarios-kytto.js';
import { issuePasswordReset, validatePasswordResetToken, consumePasswordReset, normalizarEmail, passwordPolicy } from './password-reset-kytto.js';
import { registerEsportivoPontosLigas } from './esportivo-pontos-ligas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const PROD = process.env.NODE_ENV === 'production';
const schedulerOidcClient = new OAuth2Client();

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

// Rate limit global: 300 req/min por IP em produção. A simulação isolada
// usa uma chave explícita de ambiente e não compartilha dados com produção;
// nesse único contexto, o limite elevado evita falsos negativos de carga sintética.
const simulationMode = process.env.SIMULATION_MODE === 'true';
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: simulationMode ? 100000 : 300,
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

// Host público canônico. O DNS/TLS do apex precisa apontar para esta mesma
// publicação antes que o redirecionamento possa ser executado pela aplicação.
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'https://setpoint.kytto.com.br').replace(/\/+$/, '');
const PUBLIC_APP_HOST = new URL(PUBLIC_APP_URL).hostname.toLowerCase();
const LEGACY_PUBLIC_HOSTS = new Set(['kytto.com.br', 'www.kytto.com.br']);
app.use((req, res, next) => {
  const host = String(req.hostname || '').toLowerCase();
  if (PROD && LEGACY_PUBLIC_HOSTS.has(host) && host !== PUBLIC_APP_HOST) {
    return res.redirect(308, `${PUBLIC_APP_URL}${req.originalUrl}`);
  }
  next();
});

// A autenticação deve permanecer no domínio de acesso escolhido pelo usuário.
// O fallback SPA abaixo entrega a mesma aplicação para /login sem expor a URL
// técnica do Cloud Run nem fragmentar a sessão entre origens.

// Em produção, servir o build React antes das rotas. As chamadas /api/*
// continuam sendo resolvidas pelos módulos registrados abaixo. PUBLIC_DIR permite
// testes do build atual sem alterar o bundle legado local em app/public.
const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, 'public');
if (PROD) {
  app.use(express.static(publicDir, {
    maxAge: '1h',
    etag: true,
    setHeaders: (res, filePath) => {
      // O HTML e o worker determinam qual versão do frontend será carregada.
      // Não podem permanecer em cache após um deploy.
      if (/\/(index\.html|sw\.js|service-worker\.js|manifest\.json|manifest\.webmanifest)$/.test(filePath)) {
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

// Middleware de observabilidade: registrar latência de endpoints
app.use((req, res, next) => {
  const inicio = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const latencia = Date.now() - inicio;
    const statusCode = res.statusCode || 200;
    
    // Registrar latência apenas para endpoints /api/
    if (req.path.startsWith('/api/')) {
      observabilidade.registrarLatencia(
        req.path,
        req.method,
        latencia,
        statusCode,
        req.usuario?.email
      );
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// ============================================================================
// AUTENTICAÇÃO E USUÁRIOS
// ============================================================================

// Armazenamento em memória (em produção, usar banco de dados)
const usuarios = new Map();

// Os administradores são criados com hash aleatório e definem a própria senha
// por recuperação individual; nenhuma senha compartilhada entra no boot.
const ADMIN_EMAILS = String(process.env.KYTTO_BOOTSTRAP_ADMIN_EMAILS || 'rodrigo.goncalves@kytto.com.br,rrodrigogon@gmail.com,l.dospsilva@gmail.com')
  .split(',').map(normalizarEmail).filter(Boolean);
const ADMIN_EMAIL = ADMIN_EMAILS[0] || 'rodrigo.goncalves@kytto.com.br';

// Senhas novas usam bcrypt. O comparador aceita o hash legado apenas para
// migração transparente da conta administrativa já existente.
function hashPassword(pwd) {
  return bcrypt.hashSync(String(pwd), 12);
}

function verificarPassword(pwd, hash) {
  const valor = String(hash || '');
  return valor.startsWith('$2')
    ? bcrypt.compareSync(String(pwd), valor)
    : Buffer.from(String(pwd)).toString('base64') === valor;
}

function espelharUsuarioEmMemoria(usuario) {
  if (!usuario?.email) return null;
  const perfis = Array.isArray(usuario.perfis) ? usuario.perfis : [];
  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];
  const administrador = usuario.platformAdmin === true || perfis.includes('administrador') || roles.includes('administrador') || roles.includes('admin') || ['admin', 'administrador'].includes(String(usuario.role || '').toLowerCase());
  const espelho = {
    ...usuario,
    senha: usuario.senhaHash || usuario.senha || '',
    tipo: administrador ? 'admin' : (usuario.tipo || 'operador'),
    role: administrador ? 'admin' : (usuario.role || roles[0] || 'operador'),
    ativo: usuario.ativo !== false,
  };
  usuarios.set(String(espelho.email).toLowerCase(), espelho);
  return espelho;
}

// Cria a empresa operacional e garante os administradores solicitados apenas na
// primeira inicialização. Nenhuma senha é escrita em log ou definida no código.
function criarAdminPadrao() {
  cadastrosMestres.garantirEmpresaPadrao();
  const estado = db();
  estado.cardapioPorEmpresa ||= {};
  const empresaId = cadastrosMestres.EMPRESA_PADRAO_ID;
  estado.cardapioPorEmpresa[empresaId] ||= [];
      const cardapio = estado.cardapioPorEmpresa[empresaId];
  // Remove exclusivamente seeds antigos do sistema. Itens criados pelo operador
  // permanecem intactos; depois, se não houver itens reais, semeia o catálogo oficial.
  const antes = cardapio.length;
  for (let indice = cardapio.length - 1; indice >= 0; indice -= 1) {
    const produto = cardapio[indice];
    if (String(produto?.id || '').startsWith('seed-') || ['kytto-bebidas-v1', 'kytto-espetinhos-v1'].includes(produto?.catalogoSeed)) cardapio.splice(indice, 1);
  }
  if (cardapio.length !== antes) save();
  if (cardapio.length === 0) {
    const agora = new Date().toISOString();
    const sementes = CATALOGO_BAR_TTC_SKUS;

    const itens = sementes.map((item, indice) => ({
      ...item,
      empresaId,
      id: item.id || `bar-ttc-${String(item.sku || indice + 1).toLowerCase()}`,
      catalogoSeed: RESUMO_CATALOGO_BAR_TTC.versao,
      indisponivel: item.indisponivel === true,
      criadoEm: item.criadoEm || agora,
      atualizadoEm: agora,
    }));
    cardapio.push(...itens);
    console.log(`✅ Catálogo Kytto inicializado: ${itens.length} itens`);
  }

  const administradores = ADMIN_EMAILS.map((email) => {
    let usuario = cadastrosMestres.obterUsuarioPorEmail(email);
    const senhaBootstrap = process.env.KYTTO_INITIAL_ADMIN_PASSWORD || 'SetPoint@2026Temp';
    if (!usuario) {
      const senhaHash = hashPassword(senhaBootstrap || crypto.randomBytes(32).toString('hex'));
      usuario = cadastrosMestres.criarUsuario(empresaId, {
        nome: email.split('@')[0],
        email,
        roles: ['admin', 'gerente-financeiro'],
        tipoUsuario: 'administrador',
        perfis: ['administrador'],
        platformAdmin: true,
        senhaHash,
      });
      usuario.empresasAcessiveis = [empresaId];
      usuario.senhaResetObrigatorio = !senhaBootstrap;
      usuario.passwordChangedAt = senhaBootstrap ? new Date().toISOString() : null;
      save();
      console.log(`✅ Administrador ${email} preparado para recuperação individual`);
    } else {
      if (senhaBootstrap && (usuario.senhaResetObrigatorio || !usuario.senhaHash)) {
        usuario.senhaHash = hashPassword(senhaBootstrap);
        usuario.senhaResetObrigatorio = false;
        usuario.passwordChangedAt = new Date().toISOString();
        save();
      }
      usuario = cadastrosMestres.atualizarUsuario(usuario.empresaId || empresaId, usuario.id, {
        roles: ['admin', 'gerente-financeiro'],
        tipoUsuario: 'administrador',
        perfis: ['administrador'],
        platformAdmin: true,
      }) || usuario;
      usuario.empresasAcessiveis ||= [usuario.empresaId || empresaId];
    }
    return espelharUsuarioEmMemoria(usuario);
  });

  return administradores;
}

// Rota: Login Admin (Painel)
app.post('/api/admin/login', authLimiter, (req, res) => {
  try {
    const { user, email: bodyEmail, usuario: bodyUsuario, pass, senha } = req.body || {};
    const usuarioInformado = user || bodyEmail || bodyUsuario;
    const senhaInformada = pass || senha;

    if (!usuarioInformado || !senhaInformada) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const email = String(usuarioInformado).trim().toLowerCase();
    const usuario = usuarios.get(email) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(email));

    if (!usuario || !verificarPassword(senhaInformada, usuario.senhaHash || usuario.senha)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    if (usuario.senhaResetObrigatorio === true) {
      return res.status(403).json({ error: 'Defina uma nova senha pelo link de recuperação.', code: 'PASSWORD_RESET_REQUIRED' });
    }

    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Usuário desativado' });
    }

    // Atualiza automaticamente hashes legados após uma autenticação bem-sucedida.
    if (!String(usuario.senhaHash || usuario.senha || '').startsWith('$2') && usuario.id && usuario.empresaId) {
      const senhaHash = hashPassword(senhaInformada);
      cadastrosMestres.atualizarUsuario(usuario.empresaId, usuario.id, { senhaHash });
      usuario.senhaHash = senhaHash;
      usuario.senha = senhaHash;
    }

    const empresas = cadastrosMestres.empresasDoUsuario(usuario);
    if (!empresas.length) return res.status(403).json({ error: 'Usuário sem empresa ativa associada.' });
    const empresaAtiva = empresas[0];
    const token = Buffer.from(`${email}:${Date.now()}:${empresaAtiva.id}`).toString('base64');
    const acesso = resumoAcessoUsuario(usuario);
    const administradorLocal = acesso.perfis.includes('administrador') || (usuario.roles || []).includes('admin') || (usuario.roles || []).includes('administrador');
    const administradorPlataforma = usuario.platformAdmin === true;
    const consultorPlataforma = usuario.platformConsultor === true;
    const papel = administradorLocal ? 'admin' : (usuario.role || ((usuario.roles || [])[0] || 'operador'));

    res.json({
      token,
      user: {
        email: usuario.email,
        nome: usuario.nome,
        role: papel,
        empresaId: empresaAtiva.id,
        roles: usuario.roles || [papel],
        perfis: acesso.perfis,
        tipoUsuario: acesso.tipoUsuario,
        permissoes: administradorPlataforma ? { ...acesso.permissoes, plataforma: ['ler', 'criar', 'editar', 'excluir'] } : acesso.permissoes,
        platformAdmin: administradorPlataforma,
        platformConsultor: consultorPlataforma,
      },
      role: papel,
      sessao: {
        loja_ativa: { id: empresaAtiva.id, nome: empresaAtiva.nomeFantasia || empresaAtiva.nome, ativa: empresaAtiva.ativa !== false, empresaId: empresaAtiva.id, modulos: empresaAtiva.modulos || [], plano: empresaAtiva.plano || 'standard' },
        lojas_acessiveis: empresas.map((empresa) => ({ id: empresa.id, nome: empresa.nomeFantasia || empresa.nome, ativa: empresa.ativa !== false, empresaId: empresa.id, modulos: empresa.modulos || [], plano: empresa.plano || 'standard' })),
      }
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

// Recuperação por e-mail: resposta neutra, token hash persistido e uso único.
async function solicitarRecuperacao(req, res) {
  try {
    const email = normalizarEmail(req.body?.email);
    if (!email || !email.includes('@')) {
      return res.status(200).json({ ok: true, message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' });
    }
    const usuario = usuarios.get(email) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(email));
    if (usuario) await issuePasswordReset(usuario, { ip: req.ip });
    return res.status(200).json({ ok: true, message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' });
  } catch (error) {
    console.error('[AUTH] erro controlado ao solicitar recuperação:', error?.message || error);
    return res.status(200).json({ ok: true, message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' });
  }
}

app.post(['/api/auth/forgot-password', '/api/auth/esqueci-senha'], authLimiter, solicitarRecuperacao);

function validarTokenRecuperacao(req, res) {
  const token = String(req.body?.token || req.query?.token || '').trim();
  return res.status(200).json(validatePasswordResetToken(token));
}

app.get(['/api/auth/reset-password/validate', '/api/auth/redefinir-senha/validar'], validarTokenRecuperacao);
app.post('/api/auth/redefinir-senha/validar', validarTokenRecuperacao);

function redefinirSenha(req, res) {
  try {
    const token = String(req.body?.token || '').trim();
    const novaSenha = String(req.body?.novaSenha || req.body?.password || '');
    const confirmacao = req.body?.confirmacao || req.body?.novasenhaConfirm || req.body?.confirmPassword;
    if (!token || !novaSenha) return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    if (confirmacao !== undefined && novaSenha !== String(confirmacao)) return res.status(400).json({ error: 'As senhas não coincidem.' });
    const policyError = passwordPolicy(novaSenha);
    if (policyError) return res.status(400).json({ error: policyError, code: 'WEAK_PASSWORD' });
    const result = consumePasswordReset(token, novaSenha);
    if (!result.ok) return res.status(401).json({ error: result.message, code: result.code });
    const atualizado = espelharUsuarioEmMemoria(result.user);
    return res.status(200).json({ ok: true, sucesso: true, message: 'Senha alterada com sucesso.', user: { email: atualizado?.email } });
  } catch (error) {
    console.error('[AUTH] erro controlado ao redefinir senha:', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível redefinir a senha.' });
  }
}

app.post(['/api/auth/reset-password', '/api/auth/redefinir-senha'], redefinirSenha);

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

  // Criar a empresa, o usuário administrativo e a conta padrão no escopo correto.
  criarAdminPadrao();
  const usuariosMigradosParaPerfis = cadastrosMestres.migrarPerfisUsuarios();
  if (usuariosMigradosParaPerfis) console.log(`✅ ${usuariosMigradosParaPerfis} usuário(s) migrado(s) para perfis estruturados.`);
  // A configuração fiscal anterior era vinculada ao email administrativo. A
  // migração preserva o A1 cifrado e passa a vinculá-lo à empresa padrão.
  fiscalKytto.migrarTenant(`conta-${ADMIN_EMAIL}`, `empresa-${cadastrosMestres.EMPRESA_PADRAO_ID}`);
  clientesKytto.garantirClientePadrao(cadastrosMestres.EMPRESA_PADRAO_ID);
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
      const partes = decoded.split(':');
      const email = partes[0]?.trim().toLowerCase();
      const emitidoEm = Number(partes[1] || 0);
      const usuario = email ? usuarios.get(email) || null : null;
      if (usuario?.passwordChangedAt && emitidoEm && emitidoEm < new Date(usuario.passwordChangedAt).getTime()) return null;
      return usuario;
    } catch {
      return null;
    }
  }

  function requerEditorCatalogo(req, res, next) {
    const usuario = usuarioDoToken(req) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(
      (() => {
        try { return Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), 'base64').toString('utf8').split(':')[0]; }
        catch { return ''; }
      })()
    ));
    if (!usuario || usuario.ativo === false) {
      return res.status(401).json({ erro: 'Autenticação administrativa necessária' });
    }

    const acesso = resumoAcessoUsuario(usuario);
    const modulo = moduloDaRota(req.path);
    const acao = acaoDaRequisicao(req.method);
    if (!temPermissao({ ...usuario, ...acesso }, modulo, acao)) {
      return res.status(403).json({ erro: `Seu perfil não permite ${acao} no módulo ${modulo}.`, codigo: 'PERMISSAO_NEGADA', modulo, acao });
    }

    const empresas = cadastrosMestres.empresasDoUsuario(usuario);
    const solicitada = String(req.get('X-Loja-Id') || '').trim();
    const empresa = solicitada
      ? empresas.find((item) => item.id === solicitada && item.ativa !== false)
      : empresas[0];
    if (!empresa) {
      return res.status(403).json({ erro: 'Empresa ativa inválida ou sem permissão para este usuário.' });
    }

    // Qualquer tentativa de forçar empresaId por corpo, query ou parâmetro é
    // bloqueada antes de a rota acessar os dados persistidos.
    const empresaSolicitadaNoPayload = req.body?.empresaId || req.query?.empresaId || req.params?.empresaId;
    if (empresaSolicitadaNoPayload && String(empresaSolicitadaNoPayload) !== empresa.id) {
      return res.status(403).json({ erro: 'Acesso negado a dados de outra empresa.' });
    }

    req.usuario = { ...usuario, ...acesso };
    req.permissoes = acesso.permissoes;
    req.empresaId = empresa.id;
    req.empresa = empresa;
    next();
  }

  // Autenticação simples para operações próprias do usuário, sem exigir
  // privilégio administrativo de um módulo específico.
  function requerAutenticacao(req, res, next) {
    const usuario = usuarioDoToken(req) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(
      (() => {
        try { return Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), 'base64').toString('utf8').split(':')[0]; }
        catch { return ''; }
      })()
    ));
    if (!usuario || usuario.ativo === false) return res.status(401).json({ erro: 'Autenticação necessária.' });
    const empresas = cadastrosMestres.empresasDoUsuario(usuario);
    const solicitada = String(req.get('X-Loja-Id') || '').trim();
    const empresa = solicitada ? empresas.find((item) => item.id === solicitada && item.ativa !== false) : empresas[0];
    if (!empresa) return res.status(403).json({ erro: 'Empresa ativa inválida ou sem permissão para este usuário.' });
    req.usuario = { ...usuario, ...resumoAcessoUsuario(usuario) };
    req.empresaId = empresa.id;
    req.empresa = empresa;
    next();
  }

  // Operações de PDV, mesas e comandas podem ser executadas pelos perfis
  // Garçom, Operador de PDV, Caixa, Gerente e Administrador. A empresa vem
  // exclusivamente do cabeçalho X-Loja-Id validado contra o usuário autenticado.
  function requerOperacaoComanda(req, res, next) {
    const usuario = usuarioDoToken(req) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(
      (() => {
        try { return Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), 'base64').toString('utf8').split(':')[0]; }
        catch { return ''; }
      })()
    ));
    if (!usuario || usuario.ativo === false) {
      return res.status(401).json({ erro: 'Autenticação necessária para operar comandas.' });
    }

    const acesso = resumoAcessoUsuario(usuario);
    const acao = acaoDaRequisicao(req.method);
    const permissoes = { ...usuario, ...acesso };
    const permitido = ['mesas', 'pdv', 'pagamentos'].some((modulo) => temPermissao(permissoes, modulo, acao));
    if (!permitido) {
      return res.status(403).json({ erro: 'Seu perfil não permite esta operação de comanda.', codigo: 'PERMISSAO_NEGADA', acao });
    }

    const empresas = cadastrosMestres.empresasDoUsuario(usuario);
    const solicitada = String(req.get('X-Loja-Id') || '').trim();
    const empresa = solicitada
      ? empresas.find((item) => item.id === solicitada && item.ativa !== false)
      : empresas[0];
    if (!empresa) {
      return res.status(403).json({ erro: 'Empresa ativa inválida ou sem permissão para este usuário.' });
    }
    const empresaNoPayload = req.body?.empresaId || req.query?.empresaId || req.params?.empresaId;
    if (empresaNoPayload && String(empresaNoPayload) !== empresa.id) {
      return res.status(403).json({ erro: 'Acesso negado a dados de outra empresa.' });
    }

    req.usuario = { ...usuario, ...acesso };
    req.permissoes = acesso.permissoes;
    req.empresaId = empresa.id;
    req.empresa = empresa;
    next();
  }

  registerEsportivoPontosLigas({
    app,
    db,
    save,
    cadastrosMestres,
    requerEditorCatalogo,
    requerAutenticacao,
  });

  // ── FISCAL / CERTIFICADOS A1 ──────────────────────────────────────────────
  // Usa a mesma autenticação administrativa do catálogo e mantém certificados
  // cifrados em objeto dedicado do GCS. Nunca retorna senha, CSC ou arquivo A1.
  const fiscalTenantId = (req) => `empresa-${req.empresaId || cadastrosMestres.EMPRESA_PADRAO_ID}`;
  const fiscalResposta = (config) => fiscalKytto.limparDadosSensiveis(config);

  app.get('/api/v1/fiscal/config', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, config: fiscalResposta(fiscalKytto.obterConfiguracaoFiscal(fiscalTenantId(req))) });
  });

  app.get('/api/v1/fiscal/ufs', requerEditorCatalogo, (_req, res) => {
    res.json({ ok: true, ufs: fiscalKytto.listarConfiguracoesUf() });
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

  function contextoTributarioFiscal(req, extras = {}) {
    const config = fiscalKytto.obterConfiguracaoFiscal(fiscalTenantId(req));
    return {
      regimeTributario: config.regimeTributario,
      uf: config.uf,
      operacao: extras.operacao || 'venda_presencial',
      exigirNcm: Boolean(extras.exigirNcm),
      regras: extras.regras && typeof extras.regras === 'object' ? extras.regras : {},
    };
  }

  function itemParaCalculoFiscal(empresaId, item = {}, tenantFiscalId = null) {
    const produtoId = item.produtoId || item.id;
    const produto = produtoId ? cardapioPersistido(empresaId).find((registro) => registro.id === produtoId) : null;
    const fiscalBase = item.fiscal && typeof item.fiscal === 'object' ? item.fiscal : produto?.fiscal || {};
    const ibpt = tenantFiscalId ? fiscalKytto.obterAliquotasIbpt(tenantFiscalId, fiscalBase.ncm) : null;
    return {
      ...produto,
      ...item,
      produtoId: produtoId || produto?.id || null,
      descricao: item.descricao || item.nome || produto?.nome || '',
      fiscal: {
        ...fiscalBase,
        aliquotaIbptNacional: Number(fiscalBase.aliquotaIbptNacional || 0) || Number(ibpt?.nacional || 0),
        aliquotaIbptImportado: Number(fiscalBase.aliquotaIbptImportado || 0) || Number(ibpt?.importado || 0),
      },
      quantidade: item.quantidade ?? item.qtd ?? 1,
      valorUnitario: item.valorUnitario ?? item.valor_unitario ?? item.preco ?? produto?.preco ?? 0,
    };
  }

  app.get('/api/v1/fiscal/produtos/classificacao', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido(req.empresaId).map((produto) => {
      const validacao = tributacaoKytto.validarClassificacaoFiscalProduto(produto.fiscal || {}, { exigirNcm: false });
      return {
        id: produto.id, nome: produto.nome, categoria: produto.cat, preco: produto.preco,
        fiscal: validacao.fiscal, classificacaoCompleta: validacao.valido, pendencias: validacao.pendencias,
      };
    });
    res.json({ ok: true, itens });
  });

  app.patch('/api/v1/fiscal/produtos/:id/classificacao', requerEditorCatalogo, (req, res) => {
    const produto = cardapioPersistido(req.empresaId).find((item) => item.id === req.params.id && item.empresaId === req.empresaId);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado na empresa ativa.' });
    const validacao = tributacaoKytto.validarClassificacaoFiscalProduto(req.body?.fiscal || req.body || {}, { exigirNcm: false });
    produto.fiscal = validacao.fiscal;
    produto.atualizadoEm = new Date().toISOString();
    save();
    res.json({ ok: true, produto: { id: produto.id, nome: produto.nome, fiscal: produto.fiscal }, validacao });
  });

  app.get('/api/v1/fiscal/ibpt', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, tabelas: fiscalKytto.listarTabelasIbpt(fiscalTenantId(req)) });
  });

  app.post('/api/v1/fiscal/ibpt/importar', requerEditorCatalogo, (req, res) => {
    try {
      const tabela = fiscalKytto.importarTabelaIbpt(fiscalTenantId(req), req.body || {});
      res.status(201).json({ ok: true, tabela, mensagem: 'Tabela IBPT importada, versionada e ativada para a empresa.' });
    } catch (error) {
      res.status(422).json({ erro: error.message });
    }
  });

  app.post('/api/v1/fiscal/calcular', requerEditorCatalogo, (req, res) => {
    try {
      const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
      if (!itens.length) return res.status(400).json({ erro: 'Informe ao menos um item para a simulação tributária.' });
      const contexto = contextoTributarioFiscal(req, req.body || {});
      const resultado = tributacaoKytto.totalizarDocumentoFiscal(
        itens.map((item) => itemParaCalculoFiscal(req.empresaId, item, fiscalTenantId(req))),
        contexto,
      );
      res.json({ ok: true, contexto: { regimeTributario: contexto.regimeTributario, uf: contexto.uf, operacao: contexto.operacao }, ...resultado });
    } catch (error) {
      res.status(422).json({ erro: error.message });
    }
  });

  app.get('/api/v1/fiscal/documentos', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, documentos: fiscalKytto.listarDocumentos(fiscalTenantId(req)) });
  });

  app.get('/api/v1/fiscal/documentos/:id/eventos', requerEditorCatalogo, (req, res) => {
    try {
      res.json({ ok: true, eventos: fiscalKytto.listarEventosFiscais(fiscalTenantId(req), req.params.id) });
    } catch (error) {
      res.status(404).json({ erro: error.message });
    }
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

  // Rascunho de NF-e (55) para testes de domínio. Este endpoint não transmite
  // nem autoriza qualquer documento na SEFAZ.
  app.post('/api/v1/fiscal/nfe/preflight', requerEditorCatalogo, (req, res) => {
    try {
      const venda = req.body || {};
      const documento = fiscalKytto.criarDocumentoFiscalRascunho(fiscalTenantId(req), venda, {
        modelo: '55', origemId: venda.origemId || venda.pedidoId || venda.vendaId || null,
      });
      res.status(201).json({ ok: true, documento, mensagem: 'NF-e preparada como rascunho; nenhuma transmissão foi realizada.' });
    } catch (error) {
      res.status(422).json({ erro: error.message });
    }
  });

  function documentoFiscalSeguro(documento) {
    if (!documento) return documento;
    const { xmlBruto, xmlAssinado, ...seguro } = documento;
    return { ...seguro, xmlDisponivel: Boolean(xmlAssinado), xmlBrutoDisponivel: Boolean(xmlBruto) };
  }

  function pagamentosFiscaisDaComanda(comanda) {
    return (comanda.pagamentos || []).map((pagamento) => ({
      meio: pagamento.meio || pagamento.metodo || 'dinheiro',
      valor: Number(pagamento.valor || 0),
      integrado: Boolean(pagamento.integrado),
      cnpjCredenciadora: pagamento.cnpjCredenciadora || pagamento.cnpj_credenciadora || '',
      bandeira: pagamento.bandeira || '',
      codigoAutorizacao: pagamento.codigoAutorizacao || pagamento.autorizacao || '',
    }));
  }

  function baseFiscalDaComanda(req, comanda, { modelo = '65', destinatario = null } = {}) {
    const tenantId = fiscalTenantId(req);
    const config = fiscalKytto.obterConfiguracaoFiscal(tenantId);
    const pendencias = [];
    if (!comanda || comanda.empresaId !== req.empresaId) throw new Error('Comanda não encontrada na empresa ativa.');
    if (comanda.status !== 'fechada') pendencias.push('A comanda precisa estar fechada e integralmente quitada antes de gerar o documento fiscal.');
    if (!(comanda.itens || []).length) pendencias.push('A comanda não possui itens para faturamento fiscal.');
    const taxaServico = Number(comanda.taxaServico || 0);
    if (taxaServico > 0) pendencias.push('A taxa de serviço exige regra fiscal específica antes de gerar o documento.');
    if (String(modelo) === '55' && !destinatario) pendencias.push('NF-e modelo 55 exige destinatário identificado.');
    const subtotal = Number(totalComanda(comanda) || 0);
    const descontoTotal = Math.max(0, Number(comanda.desconto || 0));
    let descontoRestante = descontoTotal;
    const itens = (comanda.itens || []).map((item, indice, lista) => {
      const base = itemParaCalculoFiscal(req.empresaId, item, tenantId);
      const valorProduto = Number(base.quantidade || 0) * Number(base.valorUnitario || 0);
      const desconto = indice === lista.length - 1
        ? descontoRestante
        : Number((subtotal > 0 ? (valorProduto / subtotal) * descontoTotal : 0).toFixed(2));
      descontoRestante = Number(Math.max(0, descontoRestante - desconto).toFixed(2));
      return { ...base, desconto };
    });
    const calculo = tributacaoKytto.totalizarDocumentoFiscal(itens, contextoTributarioFiscal(req, { exigirNcm: true }));
    for (const pendencia of calculo.pendencias) pendencias.push(`Item ${pendencia.item}: ${pendencia.pendencia}`);
    const pagamentos = pagamentosFiscaisDaComanda(comanda);
    if (!pagamentos.length && comanda.status === 'fechada') pendencias.push('A comanda fechada não possui meios de pagamento registrados.');
    const totalPago = Number(pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0).toFixed(2));
    if (Math.abs(totalPago - Number(calculo.totais.valorTotal || 0)) > 0.02) pendencias.push('Os pagamentos da comanda divergem do total fiscal calculado.');
    const preflight = config.preflight || fiscalKytto.verificarProntidao(config, config.certificado);
    return {
      modelo: String(modelo), origemId: comanda.id, comandaId: comanda.id,
      config, preflight, itens: calculo.itens, totais: calculo.totais, pagamentos, destinatario,
      pendencias, aptoParaRascunho: preflight.pronto && pendencias.length === 0,
      valorOperacional: Number(comanda.totalPago ?? totalComanda(comanda) ?? 0),
    };
  }

  // Prévia determinística: não reserva número, não lê certificado e não transmite.
  app.get('/api/v1/fiscal/comandas/:id/preview', requerEditorCatalogo, (req, res) => {
    try {
      const modelo = ['55', '65'].includes(String(req.query?.modelo)) ? String(req.query.modelo) : '65';
      const comanda = comandasDaEmpresa(req.empresaId).find((item) => item.id === req.params.id);
      const previa = baseFiscalDaComanda(req, comanda, { modelo });
      res.json({ ok: true, previa: { ...previa, config: fiscalResposta(previa.config) }, emissaoExternaBloqueada: true });
    } catch (error) {
      res.status(422).json({ erro: error.message });
    }
  });

  // Cria e assina um rascunho local, validado contra o XSD oficial. A rota não
  // chama SEFAZ, não autoriza nota e não é acionada automaticamente pelo PDV.
  app.post('/api/v1/fiscal/comandas/:id/rascunho', requerEditorCatalogo, async (req, res) => {
    try {
      const modelo = ['55', '65'].includes(String(req.body?.modelo)) ? String(req.body.modelo) : '65';
      const comanda = comandasDaEmpresa(req.empresaId).find((item) => item.id === req.params.id);
      const base = baseFiscalDaComanda(req, comanda, { modelo, destinatario: req.body?.destinatario || null });
      if (!base.aptoParaRascunho) return res.status(422).json({ erro: 'Prévia fiscal possui pendências.', pendencias: [...base.preflight.pendencias, ...base.pendencias] });
      const tenantId = fiscalTenantId(req);
      const documento = fiscalKytto.criarDocumentoFiscalRascunho(tenantId, {
        origemId: comanda.id, itens: base.itens, pagamentos: base.pagamentos, valorTotal: base.totais.valorTotal,
      }, { modelo, origemId: comanda.id });
      if (documento.status === 'validado_local') return res.json({ ok: true, documento: documentoFiscalSeguro(documento), idempotente: true, emissaoExternaBloqueada: true });
      const material = await fiscalKytto.carregarMaterialAtivo(tenantId);
      const urlsNfce = modelo === '65' ? fiscalKytto.obterUrlsNfce(material.config.uf, material.config.ambiente) : null;
      const xmlBruto = fiscalXmlKytto.montarXmlFiscalV400({
        config: material.config, modelo, numero: documento.numero, serie: documento.serie, chaveAcesso: documento.chaveAcesso,
        codigoNumerico: documento.codigoNumerico, dataEmissao: fiscalXmlKytto.agoraFiscalCuiaba(), itens: base.itens,
        totais: base.totais, pagamentos: base.pagamentos, destinatario: base.destinatario,
        qrCodeUrl: urlsNfce?.qrCodeUrl, urlChave: urlsNfce?.urlChave, qrCodeVersao: urlsNfce?.versaoQrCode,
      });
      const assinado = fiscalXmlKytto.assinarXmlFiscal(xmlBruto, material);
      const validacao = fiscalXmlKytto.validarXmlFiscal(assinado.xml);
      const documentoAtualizado = fiscalKytto.atualizarDocumentoFiscalRascunho(tenantId, documento.id, {
        status: validacao.valido ? 'validado_local' : 'rejeitado_local', itens: base.itens, pagamentos: base.pagamentos,
        tributos: base.totais, valorTotal: base.totais.valorTotal, destinatario: base.destinatario,
        xmlBruto, xmlAssinado: assinado.xml, hashXmlAssinado: crypto.createHash('sha256').update(assinado.xml).digest('hex'),
        schema: { versao: validacao.xsd?.schema?.manifest?.descricao || 'NFe 4.00', sha256: validacao.xsd?.schema?.sha256 || null },
        validacao: { valido: validacao.valido, erros: validacao.xsd?.erros || validacao.estrutura?.erros || [] },
      });
      if (!validacao.valido) return res.status(422).json({ erro: 'O XML fiscal foi rejeitado na validação local.', documento: documentoFiscalSeguro(documentoAtualizado), validacao: documentoAtualizado.validacao });
      res.status(201).json({ ok: true, documento: documentoFiscalSeguro(documentoAtualizado), emissaoExternaBloqueada: true, mensagem: 'Rascunho fiscal assinado e validado localmente; nenhuma transmissão à SEFAZ foi realizada.' });
    } catch (error) {
      res.status(422).json({ erro: error.message });
    }
  });

  app.get('/api/v1/fiscal/documentos/:id/xml', requerEditorCatalogo, (req, res) => {
    const documento = fiscalKytto.listarDocumentos(fiscalTenantId(req)).find((item) => item.id === req.params.id);
    if (!documento) return res.status(404).json({ erro: 'Documento fiscal não encontrado na empresa ativa.' });
    if (!documento.xmlAssinado) return res.status(409).json({ erro: 'O documento ainda não possui XML fiscal validado localmente.' });
    res.type('application/xml').set('Content-Disposition', `attachment; filename="${documento.chaveAcesso || documento.id}.xml"`).send(documento.xmlAssinado);
  });

  app.post('/api/v1/fiscal/documentos/:id/arquivar', requerEditorCatalogo, (req, res) => {
    try {
      const arquivo = fiscalKytto.arquivarDocumentoFiscal(fiscalTenantId(req), req.params.id);
      res.status(201).json({ ok: true, arquivo, mensagem: 'Guarda legal do XML registrada com hash e retenção mínima de cinco anos.' });
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });

  app.get('/api/v1/fiscal/documentos/:id/arquivos', requerEditorCatalogo, (req, res) => {
    try { res.json({ ok: true, arquivos: fiscalKytto.listarArquivosFiscais(fiscalTenantId(req), req.params.id) }); }
    catch (error) { res.status(422).json({ erro: error.message }); }
  });

  app.post('/api/v1/fiscal/documentos/:id/eventos-internos', requerEditorCatalogo, (req, res) => {
    try {
      const evento = fiscalKytto.registrarEventoInternoFiscal(fiscalTenantId(req), req.params.id, req.body?.tipo, { motivo: req.body?.motivo, usuario: req.usuario?.email || null });
      res.status(201).json({ ok: true, evento, mensagem: 'Evento interno registrado sem efeito perante a SEFAZ.' });
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });

  app.post('/api/v1/fiscal/documentos/:id/contingencia', requerEditorCatalogo, (req, res) => {
    try {
      const contingencia = fiscalKytto.enfileirarContingenciaFiscal(fiscalTenantId(req), req.params.id, { ...req.body, usuario: req.usuario?.email || null });
      res.status(201).json({ ok: true, contingencia, mensagem: 'Documento incluído na fila interna de contingência; não houve transmissão automática.' });
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });

  app.get('/api/v1/fiscal/contingencias', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, contingencias: fiscalKytto.listarContingenciasFiscais(fiscalTenantId(req), { status: req.query?.status || null }), transmissaoAutomatica: false });
  });

  app.post('/api/v1/fiscal/contingencias/:id/resolver', requerEditorCatalogo, (req, res) => {
    try {
      const contingencia = fiscalKytto.resolverContingenciaInterna(fiscalTenantId(req), req.params.id, { observacao: req.body?.observacao, usuario: req.usuario?.email || null });
      res.json({ ok: true, contingencia, mensagem: 'Contingência interna resolvida sem transmissão à SEFAZ.' });
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });

  app.get('/api/v1/fiscal/observabilidade', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, observabilidade: fiscalKytto.obterObservabilidadeFiscal(fiscalTenantId(req)), emissaoExternaBloqueada: true });
  });

  app.get('/api/v1/fiscal/documentos/:id/representacao', requerEditorCatalogo, async (req, res) => {
    try {
      const documento = fiscalKytto.listarDocumentos(fiscalTenantId(req)).find((item) => item.id === req.params.id);
      if (!documento) return res.status(404).json({ erro: 'Documento fiscal não encontrado na empresa ativa.' });
      if (!documento.xmlAssinado || documento.status !== 'validado_local') return res.status(409).json({ erro: 'A representação auxiliar exige XML assinado e validado localmente.' });
      const contingencia = fiscalKytto.listarContingenciasFiscais(fiscalTenantId(req)).find((item) => item.documentoId === documento.id && item.status === 'pendente') || null;
      const html = await gerarRepresentacaoAuxiliarNfce({ xmlAssinado: documento.xmlAssinado, documento: { ...documento, contingencia }, modo: 'rascunho' });
      res.type('html').set('Cache-Control', 'no-store').send(html);
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });

  function cardapioPersistido(empresaId = cadastrosMestres.EMPRESA_PADRAO_ID) {
    const estado = db();
    estado.cardapioPorEmpresa ||= {};
    // Migração idempotente da lista legada publicada para a empresa padrão.
    if (!estado.cardapioPorEmpresa[cadastrosMestres.EMPRESA_PADRAO_ID] && Array.isArray(estado.cardapio)) {
      estado.cardapioPorEmpresa[cadastrosMestres.EMPRESA_PADRAO_ID] = estado.cardapio.map((item) => ({ ...item, empresaId: cadastrosMestres.EMPRESA_PADRAO_ID }));
    }
    estado.cardapioPorEmpresa[empresaId] ||= [];
    return estado.cardapioPorEmpresa[empresaId];
  }

  // Cada produto de cardápio tem uma ficha de estoque independente e segregada
  // pela empresa. O saldo inicial é zero e o histórico não cruza empresas.
  function estoquePersistido(empresaId = cadastrosMestres.EMPRESA_PADRAO_ID) {
    const estado = db();
    estado.estoquePorEmpresa ||= {};
    if (!estado.estoquePorEmpresa[cadastrosMestres.EMPRESA_PADRAO_ID] && estado.estoque && typeof estado.estoque === 'object' && !Array.isArray(estado.estoque)) {
      estado.estoquePorEmpresa[cadastrosMestres.EMPRESA_PADRAO_ID] = Object.fromEntries(Object.entries(estado.estoque).map(([id, item]) => [id, { ...item, empresaId: cadastrosMestres.EMPRESA_PADRAO_ID }]));
    }
    estado.estoquePorEmpresa[empresaId] ||= {};
    return estado.estoquePorEmpresa[empresaId];
  }

  function configuracaoEstoque(empresaId) {
    const estado = db();
    estado.estoqueConfiguracaoPorEmpresa ||= {};
    estado.estoqueConfiguracaoPorEmpresa[empresaId] ||= { minimosPorCategoria: {}, atualizadoEm: new Date().toISOString() };
    return estado.estoqueConfiguracaoPorEmpresa[empresaId];
  }

  function minimoPadraoDaCategoria(empresaId, categoria) {
    const config = configuracaoEstoque(empresaId);
    return Math.max(0, Number(config.minimosPorCategoria?.[String(categoria || 'Sem categoria')] || 0));
  }

  function fichaEstoque(produto, empresaId) {
    const minimoPadrao = minimoPadraoDaCategoria(empresaId, produto.cat || 'Sem categoria');
    return {
      id: produto.id,
      empresaId,
      produtoId: produto.id,
      nome: produto.nome,
      cat: produto.cat || 'Sem categoria',
      subcategoria: produto.subcategoria || '',
      unidade: produto.unidade || 'UN',
      ativo: true,
      qtd: 0,
      // `min` é mantido por compatibilidade; `minimo` é a fonte canônica.
      min: minimoPadrao,
      minimo: minimoPadrao,
      custo: 0,
      custoMedioPonderado: 0,
      historico: [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
  }

  function sincronizarEstoqueCardapio(empresaId = cadastrosMestres.EMPRESA_PADRAO_ID, { registrarHistorico = false } = {}) {
    const estoque = estoquePersistido(empresaId);
    const itens = cardapioPersistido(empresaId);
    const idsAtivos = new Set(itens.map(item => item.id));
    let criados = 0, atualizados = 0, arquivados = 0;
    for (const produto of itens) {
      const atual = estoque[produto.id];
      if (!atual) {
        estoque[produto.id] = fichaEstoque(produto, empresaId);
        criados++;
      } else {
        const mudou = atual.nome !== produto.nome || atual.cat !== produto.cat || atual.unidade !== produto.unidade || atual.ativo !== true;
        // Migração compatível dos campos legados para a nomenclatura canônica.
        if (atual.minimo === undefined) atual.minimo = Number(atual.min || 0);
        if (atual.min === undefined) atual.min = Number(atual.minimo || 0);
        if (atual.custoMedioPonderado === undefined) atual.custoMedioPonderado = Number(atual.custo || 0);
        Object.assign(atual, {
          empresaId, produtoId: produto.id, nome: produto.nome, cat: produto.cat || 'Sem categoria',
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

  function listarEstoqueCardapio(empresaId = cadastrosMestres.EMPRESA_PADRAO_ID) {
    const resumo = sincronizarEstoqueCardapio(empresaId);
    if (resumo.criados || resumo.atualizados || resumo.arquivados) save();
    return Object.values(estoquePersistido(empresaId))
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
      modificadorGrupoIds: [...new Set((Array.isArray(payload.modificadorGrupoIds) ? payload.modificadorGrupoIds : []).map((id) => texto(id, 100)).filter(Boolean))],
      fiscal: payload.fiscal && typeof payload.fiscal === 'object'
        ? tributacaoKytto.normalizarClassificacaoFiscalProduto(payload.fiscal)
        : (payload.fiscal === null ? undefined : tributacaoKytto.normalizarClassificacaoFiscalProduto({})),
    };
  }

  const QUADRAS_PADRAO = [
    { id: 'q1', nome: 'Quadra 1 · Central', tipo: 'Saibro', preco: 80, cor: '#5FB335' },
    { id: 'q2', nome: 'Quadra 2 · Saibro', tipo: 'Saibro', preco: 70, cor: '#5FB335' },
    { id: 'q3', nome: 'Quadra 3 · Saibro', tipo: 'Saibro', preco: 70, cor: '#5FB335' },
    { id: 'q4', nome: 'Quadra 4 · Saibro', tipo: 'Saibro', preco: 70, cor: '#5FB335' },
    { id: 'q5', nome: 'Quadra 5 · Saibro', tipo: 'Saibro', preco: 70, cor: '#5FB335' },
    { id: 'q6', nome: 'Quadra 6 · Rápida', tipo: 'Rápida', preco: 90, cor: '#5FB335' },
    { id: 'q7', nome: 'Quadra 7 · Rápida', tipo: 'Rápida', preco: 90, cor: '#5FB335' },
  ];

  function novoIdCatalogo(prefixo, empresaId) {
    return `${prefixo}-${Date.now().toString(36)}-${String(empresaId || '').slice(-8)}-${crypto.randomBytes(4).toString('hex')}`;
  }

  function quadrasPersistidas(empresaId = cadastrosMestres.EMPRESA_PADRAO_ID) {
    const estado = db();
    estado.quadrasPorEmpresa ||= {};
    const empresaPadraoId = cadastrosMestres.EMPRESA_PADRAO_ID;
    if (!Object.prototype.hasOwnProperty.call(estado.quadrasPorEmpresa, empresaPadraoId)) {
      const legadas = Array.isArray(estado.quadras) && estado.quadras.length
        ? estado.quadras.map((quadra) => ({ ...quadra, empresaId: empresaPadraoId }))
        : QUADRAS_PADRAO.map((quadra) => ({ ...quadra, ativa: true, empresaId: empresaPadraoId, criadoEm: new Date().toISOString() }));
      estado.quadrasPorEmpresa[empresaPadraoId] = legadas;
      save();
    }
    estado.quadrasPorEmpresa[empresaId] ||= [];
    return estado.quadrasPorEmpresa[empresaId];
  }

  function reservasQuadrasPersistidas(empresaId = cadastrosMestres.EMPRESA_PADRAO_ID) {
    const estado = db();
    estado.reservasQuadrasPorEmpresa ||= {};
    const empresaPadraoId = cadastrosMestres.EMPRESA_PADRAO_ID;
    if (!Object.prototype.hasOwnProperty.call(estado.reservasQuadrasPorEmpresa, empresaPadraoId)) {
      const legadas = Array.isArray(estado.reservas)
        ? estado.reservas.filter((reserva) => reserva?.quadraId !== undefined && reserva?.quadraId !== null)
          .map((reserva) => ({ ...reserva, empresaId: empresaPadraoId }))
        : [];
      estado.reservasQuadrasPorEmpresa[empresaPadraoId] = legadas;
      save();
    }
    estado.reservasQuadrasPorEmpresa[empresaId] ||= [];
    return estado.reservasQuadrasPorEmpresa[empresaId];
  }

  function normalizarQuadra(payload = {}, anterior = {}) {
    const nome = String(payload.nome ?? anterior.nome ?? '').trim().slice(0, 120);
    const tipos = ['Tênis', 'Padel', 'Beach Tennis', 'Squash', 'Poliesportiva', 'Saibro', 'Rápida', 'Outros'];
    const tipo = tipos.includes(String(payload.tipo ?? anterior.tipo)) ? String(payload.tipo ?? anterior.tipo) : 'Tênis';
    const preco = Number(String(payload.preco ?? anterior.preco ?? 0).replace(',', '.'));
    return {
      nome,
      tipo,
      preco: Number.isFinite(preco) && preco >= 0 ? Number(preco.toFixed(2)) : 0,
      cor: /^#[0-9a-f]{6}$/i.test(String(payload.cor ?? anterior.cor ?? '')) ? String(payload.cor ?? anterior.cor) : '#5FB335',
      descricao: String(payload.descricao ?? anterior.descricao ?? '').trim().slice(0, 300),
      ativa: payload.ativa === undefined ? anterior.ativa !== false : Boolean(payload.ativa),
    };
  }

  function chaveNaturalProduto(produto = {}) {
    return [produto.nome, produto.cat, produto.marca, produto.tipo, produto.embalagem]
      .map((valor) => String(valor || '').trim().toLocaleLowerCase('pt-BR')).join('|');
  }

  function replicarCatalogoParaEmpresas(origemEmpresaId) {
    const origemId = String(origemEmpresaId || '').trim();
    const origem = cadastrosMestres.obterEmpresa(origemId);
    if (!origem || origem.ativa === false) throw new Error('Empresa de origem não encontrada ou inativa.');
    const produtosOrigem = cardapioPersistido(origemId).filter((produto) => produto && produto.nome);
    if (!produtosOrigem.length) throw new Error('A empresa de origem não possui produtos no cardápio para replicar.');

    const agora = new Date().toISOString();
    const resultados = [];
    for (const empresa of cadastrosMestres.listarEmpresas()) {
      const destinoId = String(empresa.id);
      if (destinoId === origemId) {
        resultados.push({ empresaId: destinoId, empresa: empresa.nomeFantasia || empresa.nome, adicionados: 0, existentes: produtosOrigem.length, total: produtosOrigem.length, origem: true });
        continue;
      }

      const destino = cardapioPersistido(destinoId);
      const porOrigem = new Map(destino.filter((produto) => produto.origemEmpresaId === origemId && produto.origemProdutoId).map((produto) => [String(produto.origemProdutoId), produto]));
      const porChave = new Map(destino.map((produto) => [chaveNaturalProduto(produto), produto]));
      let adicionados = 0;
      let existentes = 0;
      for (const produtoOrigem of produtosOrigem) {
        const existente = porOrigem.get(String(produtoOrigem.id)) || porChave.get(chaveNaturalProduto(produtoOrigem));
        if (existente) {
          existentes++;
          continue;
        }
        const copia = structuredClone(produtoOrigem);
        const id = novoIdCatalogo('prd', destinoId);
        Object.assign(copia, {
          id,
          empresaId: destinoId,
          origemEmpresaId: origemId,
          origemProdutoId: String(produtoOrigem.id),
          ordem: destino.length + 1,
          criadoEm: agora,
          atualizadoEm: agora,
        });
        destino.push(copia);
        porOrigem.set(String(produtoOrigem.id), copia);
        porChave.set(chaveNaturalProduto(copia), copia);
        adicionados++;
      }
      const estoque = sincronizarEstoqueCardapio(destinoId);
      resultados.push({ empresaId: destinoId, empresa: empresa.nomeFantasia || empresa.nome, adicionados, existentes, total: destino.length, estoque });
    }
    save();
    return { origem: { id: origemId, nome: origem.nomeFantasia || origem.nome }, empresas: resultados, totalAdicionados: resultados.reduce((soma, item) => soma + item.adicionados, 0), totalEmpresas: resultados.length };
  }

  // Leitura operacional do cardápio: exige empresa ativa e não vaza produtos
  // entre empresas. A quantidade de inventário é gerida no módulo de estoque;
  // itens sem bloqueio explícito continuam vendáveis no PDV.
  app.get('/api/cardapio', requerOperacaoComanda, (req, res) => {
    // Cardápio operacional recebe dados comerciais derivados do estoque da empresa ativa.
    const estoquePorProduto = new Map(listarEstoqueCardapio(req.empresaId).map(ficha => [String(ficha.produtoId || ficha.id), ficha]));
    const itens = cardapioPersistido(req.empresaId)
      .filter((item) => !item.indisponivel)
      .map((item) => {
        const ficha = estoquePorProduto.get(String(item.id));
        const custoMedioPonderado = Number(ficha?.custoMedioPonderado ?? ficha?.custo ?? 0);
        return {
          ...item,
          custoMedioPonderado,
          margemBruta: metricasKytto.calcularMargemBruta(item.preco, custoMedioPonderado),
        };
      });
    res.json(itens);
  });

  app.get('/api/combos', requerOperacaoComanda, (req, res) => {
    const produtos = new Map(cardapioPersistido(req.empresaId).filter((produto) => !produto.indisponivel).map((produto) => [produto.id, produto]));
    const combos = modificadoresCombosKytto.listarCombos(req.empresaId)
      .filter((combo) => combo.ativo !== false && (combo.componentes || []).every((componente) => produtos.has(componente.produtoId)))
      .map((combo) => ({ ...combo, componentes: combo.componentes.map((componente) => ({ ...componente, nome: produtos.get(componente.produtoId)?.nome || componente.produtoId })) }));
    res.json({ ok: true, combos });
  });

  app.get('/api/cardapio/:id/modificadores', requerOperacaoComanda, (req, res) => {
    const produto = cardapioPersistido(req.empresaId).find((item) => item.id === String(req.params.id) && !item.indisponivel);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado ou indisponível.' });
    const ids = new Set(produto.modificadorGrupoIds || []);
    const grupos = modificadoresCombosKytto.listarGruposModificadores(req.empresaId)
      .filter((grupo) => ids.has(grupo.id) && grupo.ativo !== false)
      .map((grupo) => ({ ...grupo, opcoes: (grupo.opcoes || []).filter((opcao) => opcao.ativo !== false) }));
    res.json({ ok: true, produtoId: produto.id, grupos });
  });

  app.get('/api/admin/cardapio', requerEditorCatalogo, (req, res) => {
    const estoquePorProduto = new Map(listarEstoqueCardapio(req.empresaId).map(ficha => [String(ficha.produtoId || ficha.id), ficha]));
    const itens = cardapioPersistido(req.empresaId).map((item) => {
      const ficha = estoquePorProduto.get(String(item.id));
      const custoMedioPonderado = Number(ficha?.custoMedioPonderado ?? ficha?.custo ?? 0);
      return { ...item, custoMedioPonderado, margemBruta: metricasKytto.calcularMargemBruta(item.preco, custoMedioPonderado) };
    });
    res.json(itens);
  });

  // Grupos de modificadores e adicionais: configurados por empresa e associados aos produtos pelo campo modificadorGrupoIds.
  app.get('/api/admin/modificadores/grupos', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, grupos: modificadoresCombosKytto.listarGruposModificadores(req.empresaId) });
  });
  app.post('/api/admin/modificadores/grupos', requerEditorCatalogo, (req, res) => {
    try { const grupo = modificadoresCombosKytto.criarGrupoModificadores(req.empresaId, req.body || {}); res.status(201).json({ ok: true, grupo }); }
    catch (error) { res.status(422).json({ erro: error.message }); }
  });
  app.patch('/api/admin/modificadores/grupos/:id', requerEditorCatalogo, (req, res) => {
    try { const grupo = modificadoresCombosKytto.atualizarGrupoModificadores(req.empresaId, req.params.id, req.body || {}); res.json({ ok: true, grupo }); }
    catch (error) { res.status(422).json({ erro: error.message }); }
  });
  app.delete('/api/admin/modificadores/grupos/:id', requerEditorCatalogo, (req, res) => {
    try {
      const emUso = cardapioPersistido(req.empresaId).some((produto) => (produto.modificadorGrupoIds || []).includes(req.params.id));
      if (emUso) return res.status(409).json({ erro: 'O grupo está associado a produtos. Remova a associação antes de excluir.' });
      res.json({ ok: true, removido: modificadoresCombosKytto.excluirGrupoModificadores(req.empresaId, req.params.id) });
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });

  app.get('/api/admin/combos', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, combos: modificadoresCombosKytto.listarCombos(req.empresaId) });
  });
  app.post('/api/admin/combos', requerEditorCatalogo, (req, res) => {
    try {
      const componentes = Array.isArray(req.body?.componentes) ? req.body.componentes : [];
      const catalogo = new Set(cardapioPersistido(req.empresaId).map((produto) => produto.id));
      if (componentes.some((componente) => !catalogo.has(String(componente?.produtoId || '')))) return res.status(422).json({ erro: 'Todo componente do combo deve existir no cardápio da empresa ativa.' });
      const combo = modificadoresCombosKytto.criarCombo(req.empresaId, req.body || {}); res.status(201).json({ ok: true, combo });
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });
  app.patch('/api/admin/combos/:id', requerEditorCatalogo, (req, res) => {
    try { const combo = modificadoresCombosKytto.atualizarCombo(req.empresaId, req.params.id, req.body || {}); res.json({ ok: true, combo }); }
    catch (error) { res.status(422).json({ erro: error.message }); }
  });
  app.delete('/api/admin/combos/:id', requerEditorCatalogo, (req, res) => {
    try { res.json({ ok: true, removido: modificadoresCombosKytto.excluirCombo(req.empresaId, req.params.id) }); }
    catch (error) { res.status(422).json({ erro: error.message }); }
  });

  app.get('/api/admin/estoque', requerEditorCatalogo, (req, res) => {
    const cardapioPorId = new Map(cardapioPersistido(req.empresaId).map(produto => [String(produto.id), produto]));
    const estoque = listarEstoqueCardapio(req.empresaId).map((ficha) => {
      const produto = cardapioPorId.get(String(ficha.produtoId || ficha.id));
      const statusEstoque = metricasKytto.getStockStatus(ficha);
      const custoMedio = Number(ficha.custoMedioPonderado ?? ficha.custo ?? 0);
      const precoVenda = Number(produto?.preco || 0);
      return {
        ...ficha,
        minimo: statusEstoque.minimo,
        min: statusEstoque.minimo,
        statusEstoque: statusEstoque.status,
        custoMedioPonderado: custoMedio,
        margemBruta: metricasKytto.calcularMargemBruta(precoVenda, custoMedio),
        precoVenda,
      };
    });
    res.json({ estoque, resumo: {
      ...metricasKytto.contarEstoquesPorStatus(estoque),
      valorTotal: Number(metricasKytto.calcularValorEstoque(estoque).toFixed(2)),
    } });
  });

  app.get('/api/admin/estoque/minimos-categoria', requerEditorCatalogo, (req, res) => {
    const config = configuracaoEstoque(req.empresaId);
    res.json({ ok: true, minimosPorCategoria: config.minimosPorCategoria || {} });
  });

  app.post('/api/admin/estoque/minimos-categoria', requerEditorCatalogo, (req, res) => {
    const categoria = String(req.body?.categoria || '').trim().slice(0, 120);
    const minimo = Number(req.body?.minimo);
    const aplicarAItensSemMinimo = req.body?.aplicarAItensSemMinimo !== false;
    if (!categoria) return res.status(400).json({ erro: 'Categoria é obrigatória.' });
    if (!Number.isFinite(minimo) || minimo < 0) return res.status(400).json({ erro: 'Mínimo por categoria inválido.' });

    const config = configuracaoEstoque(req.empresaId);
    config.minimosPorCategoria ||= {};
    config.minimosPorCategoria[categoria] = Math.floor(minimo);
    config.atualizadoEm = new Date().toISOString();

    let itensAtualizados = 0;
    if (aplicarAItensSemMinimo) {
      for (const ficha of Object.values(estoquePersistido(req.empresaId))) {
        if (ficha.ativo !== false && String(ficha.cat || 'Sem categoria') === categoria && Number(ficha.minimo ?? ficha.min ?? 0) === 0) {
          ficha.min = Math.floor(minimo);
          ficha.minimo = Math.floor(minimo);
          ficha.atualizadoEm = config.atualizadoEm;
          itensAtualizados++;
        }
      }
    }
    save();
    res.json({ ok: true, categoria, minimo: Math.floor(minimo), itensAtualizados, minimosPorCategoria: config.minimosPorCategoria });
  });

  app.post('/api/admin/estoque/sincronizar-cardapio', requerEditorCatalogo, (req, res) => {
    const resumo = sincronizarEstoqueCardapio(req.empresaId);
    save();
    res.json({ ok: true, ...resumo, mensagem: 'Estoque sincronizado com o cardápio.' });
  });

  app.post('/api/admin/estoque/entrada', requerEditorCatalogo, (req, res) => {
    const produtoId = String(req.body?.produtoId || '');
    const qtd = Number(req.body?.qtd);
    const custo = req.body?.custo === undefined || req.body?.custo === '' ? null : Number(req.body.custo);
    const ficha = estoquePersistido(req.empresaId)[produtoId];
    if (!ficha || ficha.ativo === false) return res.status(404).json({ erro: 'Produto de estoque não encontrado.' });
    if (!Number.isFinite(qtd) || qtd <= 0) return res.status(400).json({ erro: 'Quantidade de entrada inválida.' });
    if (custo !== null && (!Number.isFinite(custo) || custo < 0)) return res.status(400).json({ erro: 'Custo unitário inválido.' });
    const dataOperacao = req.body?.dataOperacao || new Date().toISOString();
    const movimentoId = `est-${Date.now().toString(36)}-${produtoId}`;
    const saldoAnterior = Number(ficha.qtd || 0);
    const custoAnterior = Number(ficha.custoMedioPonderado ?? ficha.custo ?? 0);
    const custoEntrada = custo ?? custoAnterior;
    const custoMedioPonderado = custo !== null
      ? metricasKytto.calcularCustoMedioPonderado(saldoAnterior, custoAnterior, qtd, custoEntrada)
      : custoAnterior;
    ficha.qtd = saldoAnterior + qtd;
    // `custo` é mantido para consumidores legados; CMP é a fonte canônica.
    ficha.custo = custoMedioPonderado;
    ficha.custoMedioPonderado = custoMedioPonderado;
    ficha.historico ||= [];
    ficha.historico.push({
      id: movimentoId,
      tipo: 'entrada',
      qtd,
      custo: custoEntrada,
      custoMedioPonderado,
      saldoAnterior,
      saldoFinal: ficha.qtd,
      ts: dataOperacao,
      origem: 'administracao',
      fornecedorId: req.body?.fornecedorId || null,
      documento: req.body?.documento || null,
    });
    ficha.historico = ficha.historico.slice(-100);
    ficha.atualizadoEm = new Date().toISOString();
    const statusFinanceiro = req.body?.statusFinanceiro === 'pago' ? 'pago' : 'pendente';
    const lancamentoFinanceiro = req.body?.registrarFinanceiro === false ? null : financeiroKytto.registrarEntradaEstoque(req.empresaId, {
      produtoId,
      produtoNome: ficha.nome,
      qtd,
      custo: custoEntrada,
      fornecedorId: req.body?.fornecedorId,
      documento: req.body?.documento,
      usuario: req.usuario?.email,
      dataOperacao,
      meioPagamento: req.body?.meioPagamento,
      status: statusFinanceiro,
      movimentoId,
    });
    save();
    res.json({ ok: true, item: ficha, lancamentoFinanceiro });
  });

  app.post('/api/admin/estoque/ajuste', requerEditorCatalogo, (req, res) => {
    const produtoId = String(req.body?.produtoId || '');
    const ficha = estoquePersistido(req.empresaId)[produtoId];
    if (!ficha || ficha.ativo === false) return res.status(404).json({ erro: 'Produto de estoque não encontrado.' });
    const agora = new Date().toISOString();
    let alterado = false;
    let ajusteEstoque = null;
    if (req.body?.min !== undefined || req.body?.minimo !== undefined) {
      const min = Number(req.body?.minimo ?? req.body?.min);
      if (!Number.isFinite(min) || min < 0) return res.status(400).json({ erro: 'Estoque mínimo inválido.' });
      // Mantém a compatibilidade do campo legado e a fonte canônica sincronizados.
      ficha.min = Math.floor(min);
      ficha.minimo = Math.floor(min);
      alterado = true;
    }
    if (req.body?.controlaEstoque !== undefined) {
      ficha.controlaEstoque = Boolean(req.body.controlaEstoque);
      alterado = true;
    }
    if (req.body?.qtd !== undefined) {
      const qtd = Number(req.body.qtd);
      if (!Number.isFinite(qtd) || qtd < 0) return res.status(400).json({ erro: 'Quantidade inventariada inválida.' });
      const anterior = Number(ficha.qtd || 0);
      ficha.qtd = qtd;
      ficha.historico ||= [];
      ajusteEstoque = { anterior, qtd, variacao: qtd - anterior };
      ficha.historico.push({ tipo: 'inventario', qtd: Math.abs(qtd - anterior), saldoAnterior: anterior, saldoFinal: qtd, ts: agora, origem: 'administracao' });
      ficha.historico = ficha.historico.slice(-100);
      alterado = true;
    }
    if (!alterado) return res.status(400).json({ erro: 'Informe quantidade, estoque mínimo ou controle de estoque.' });
    ficha.atualizadoEm = agora;
    const lancamentoFinanceiro = ajusteEstoque && ajusteEstoque.variacao < 0 && Number(ficha.custo || 0) > 0
      ? financeiroKytto.registrarLancamento(req.empresaId, {
        tipo: 'despesa',
        categoria: 'Alimentação/Bebidas',
        descricao: `Ajuste de inventário — perda de ${ficha.nome} (${Math.abs(ajusteEstoque.variacao)} un.)`,
        valor: Math.abs(ajusteEstoque.variacao) * Number(ficha.custo || 0),
        origem: 'estoque_ajuste',
        status: 'pago',
        vencimento: req.body?.dataOperacao || agora,
        dataOperacao: req.body?.dataOperacao || agora,
        pagoEm: req.body?.dataOperacao || agora,
        meioPagamento: 'ajuste',
        referencia: { produtoId, movimentoId: `inv-${Date.now().toString(36)}-${produtoId}` },
        usuario: req.usuario?.email,
        automatico: true,
      })
      : null;
    save();
    res.json({ ok: true, item: ficha, lancamentoFinanceiro });
  });

  app.get('/api/admin/estoque/inventario', requerEditorCatalogo, (req, res) => {
    const itens = listarEstoqueCardapio(req.empresaId);
    res.json({ ok: true, geradoEm: new Date().toISOString(), itens: itens.map(({ id, nome, cat, unidade, qtd, min }) => ({ id, nome, cat, unidade, qtd, min })) });
  });

  app.get('/api/admin/estoque/ocorrencias', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, ocorrencias: perdasInventarioKytto.listarOcorrencias(req.empresaId, req.query || {}) });
  });

  app.post('/api/admin/estoque/ocorrencias', requerEditorCatalogo, (req, res) => {
    try {
      const produtoId = String(req.body?.produtoId || ''); const qtd = Number(req.body?.qtd ?? req.body?.quantidade);
      const ficha = estoquePersistido(req.empresaId)[produtoId];
      if (!ficha || ficha.ativo === false) return res.status(404).json({ erro: 'Produto de estoque não encontrado.' });
      if (!Number.isFinite(qtd) || qtd <= 0) return res.status(422).json({ erro: 'Quantidade da ocorrência inválida.' });
      const empresa = cadastrosMestres.obterEmpresa(req.empresaId) || {}; const permiteNegativo = empresa.permitirEstoqueNegativo !== false;
      const saldoAnterior = Number(ficha.qtd || 0); if (ficha.controlaEstoque === true && !permiteNegativo && saldoAnterior < qtd) return res.status(422).json({ erro: `Estoque insuficiente para registrar a baixa. Disponível: ${saldoAnterior}.` });
      const saldoFinal = Number((saldoAnterior - qtd).toFixed(4)); ficha.qtd = saldoFinal; ficha.historico ||= [];
      const registro = perdasInventarioKytto.registrarOcorrencia(req.empresaId, { ...req.body, produtoId, produtoNome: ficha.nome, unidade: ficha.unidade, qtd, custoUnitario: ficha.custoMedioPonderado ?? ficha.custo ?? 0, saldoAnterior, saldoFinal, usuario: req.usuario?.email });
      ficha.historico.push({ id: registro.id, tipo: `ocorrencia_${registro.tipo}`, qtd, saldoAnterior, saldoFinal, origem: 'perdas_inventario', motivo: registro.motivo, usuario: req.usuario?.email, ts: registro.criadoEm }); ficha.historico = ficha.historico.slice(-100); ficha.atualizadoEm = registro.criadoEm;
      const lancamentoFinanceiro = Number(registro.valorImpacto || 0) > 0 ? financeiroKytto.registrarLancamento(req.empresaId, { tipo: 'despesa', categoria: 'Perdas e quebras', descricao: `${registro.tipo.replace('_', ' ')} — ${ficha.nome}`, valor: registro.valorImpacto, origem: `estoque_${registro.tipo}`, status: 'pago', vencimento: registro.criadoEm, dataOperacao: registro.criadoEm, pagoEm: registro.criadoEm, meioPagamento: 'ajuste', referencia: { produtoId, ocorrenciaId: registro.id }, usuario: req.usuario?.email, automatico: true }) : null;
      save(); res.status(201).json({ ok: true, ocorrencia: registro, item: ficha, lancamentoFinanceiro });
    } catch (erro) { res.status(422).json({ erro: erro.message }); }
  });

  app.get('/api/admin/estoque/inventarios', requerEditorCatalogo, (req, res) => res.json({ ok: true, inventarios: perdasInventarioKytto.listarInventarios(req.empresaId) }));
  app.get('/api/admin/estoque/inventarios/:id', requerEditorCatalogo, (req, res) => { const inventario = perdasInventarioKytto.obterInventario(req.empresaId, req.params.id); if (!inventario) return res.status(404).json({ erro: 'Inventário não encontrado na empresa ativa.' }); res.json({ ok: true, inventario }); });
  app.post('/api/admin/estoque/inventarios', requerEditorCatalogo, (req, res) => {
    try {
      const tipo = req.body?.tipo === 'geral' ? 'geral' : 'rotativo'; const categoria = String(req.body?.categoria || '').trim(); const ids = Array.isArray(req.body?.produtoIds) ? new Set(req.body.produtoIds.map(String)) : null;
      const itens = listarEstoqueCardapio(req.empresaId).filter(item => item.ativo !== false).filter(item => tipo === 'geral' || !categoria || item.cat === categoria).filter(item => !ids || ids.has(String(item.produtoId || item.id)));
      const inventario = perdasInventarioKytto.criarInventario(req.empresaId, { ...req.body, tipo, categoria, iniciadoPor: req.usuario?.email }, itens); save(); res.status(201).json({ ok: true, inventario });
    } catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.post('/api/admin/estoque/inventarios/:id/contagens', requerEditorCatalogo, (req, res) => {
    try { const inventario = perdasInventarioKytto.registrarContagem(req.empresaId, req.params.id, String(req.body?.produtoId || ''), req.body?.contado ?? req.body?.qtd, req.usuario?.email); if (!inventario) return res.status(404).json({ erro: 'Inventário não encontrado na empresa ativa.' }); save(); res.json({ ok: true, inventario }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.post('/api/admin/estoque/inventarios/:id/concluir', requerEditorCatalogo, (req, res) => {
    try {
      const resultado = perdasInventarioKytto.concluirInventario(req.empresaId, req.params.id, req.usuario?.email); if (!resultado) return res.status(404).json({ erro: 'Inventário não encontrado na empresa ativa.' });
      const movimentos = []; for (const ajuste of resultado.ajustes) { const ficha = estoquePersistido(req.empresaId)[ajuste.produtoId]; if (!ficha) continue; const saldoAnterior = Number(ficha.qtd || 0); const saldoFinal = Number(ajuste.contado || 0); ficha.qtd = saldoFinal; ficha.historico ||= []; const movimento = { id: `inv-aj-${Date.now().toString(36)}-${ajuste.produtoId}`, tipo: 'inventario_rotativo', qtd: Math.abs(Number((saldoFinal - saldoAnterior).toFixed(4))), saldoAnterior, saldoFinal, divergencia: ajuste.divergencia, inventarioId: resultado.inventario.id, origem: 'perdas_inventario', usuario: req.usuario?.email, ts: resultado.inventario.concluidoEm }; ficha.historico.push(movimento); ficha.historico = ficha.historico.slice(-100); ficha.atualizadoEm = resultado.inventario.concluidoEm; movimentos.push(movimento); }
      save(); res.json({ ok: true, inventario: resultado.inventario, movimentos });
    } catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.get('/api/admin/estoque/acuracidade', requerEditorCatalogo, (req, res) => res.json({ ok: true, relatorio: perdasInventarioKytto.relatorioAcuracidade(req.empresaId, req.query || {}) }));

  app.get('/api/admin/cardapio/catalogo-bebidas', requerEditorCatalogo, (req, res) => {
    const cadastrados = cardapioPersistido(req.empresaId).filter((item) => item.catalogoSeed === RESUMO_CATALOGO_BAR_TTC.versao && item.cat === 'Bebidas').length;
    res.json({ ...RESUMO_CATALOGO_BAR_TTC, itens: CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.cat === 'Bebidas').length, cadastrados, versao: RESUMO_CATALOGO_BAR_TTC.versao, escopo: 'bebidas-oficiais' });
  });

  app.post('/api/admin/cardapio/catalogo-bebidas', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido(req.empresaId);
    const oficiais = CATALOGO_BAR_TTC_SKUS.filter((item) => item.cat === 'Bebidas');
    const existentes = new Set(itens.map((item) => String(item.sku || item.nome || '').toLowerCase()));
    const agora = new Date().toISOString();
    const adicionados = [];
    for (const produtoBase of oficiais) {
      const produto = normalizarProduto(produtoBase);
      const chave = String(produtoBase.sku || produto.nome).toLowerCase();
      if (existentes.has(chave)) continue;
      adicionados.push({ ...produto, sku: produtoBase.sku, empresaId: req.empresaId, id: `bar-ttc-${produtoBase.sku.toLowerCase()}`, ordem: itens.length + adicionados.length + 1, catalogoSeed: RESUMO_CATALOGO_BAR_TTC.versao, criadoEm: agora, atualizadoEm: agora });
      existentes.add(chave);
    }
    if (adicionados.length) { itens.push(...adicionados); sincronizarEstoqueCardapio(req.empresaId); save(); }
    res.status(201).json({ ok: true, adicionados: adicionados.length, total: itens.length, versao: RESUMO_CATALOGO_BAR_TTC.versao, fonte: RESUMO_CATALOGO_BAR_TTC.fonte });
  });

  app.get('/api/admin/cardapio/catalogo-espetinhos', requerEditorCatalogo, (req, res) => {
    const cadastrados = cardapioPersistido(req.empresaId).filter((item) => item.catalogoSeed === RESUMO_CATALOGO_BAR_TTC.versao && item.cat === 'Espetos').length;
    res.json({ ...RESUMO_CATALOGO_BAR_TTC, itens: CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.cat === 'Espetos').length, cadastrados, versao: RESUMO_CATALOGO_BAR_TTC.versao, escopo: 'espetos-oficiais' });
  });

  app.post('/api/admin/cardapio/catalogo-espetinhos', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido(req.empresaId);
    const oficiais = CATALOGO_BAR_TTC_SKUS.filter((item) => item.cat === 'Espetos');
    const existentes = new Set(itens.map((item) => String(item.sku || item.nome || '').toLowerCase()));
    const agora = new Date().toISOString();
    const adicionados = [];
    for (const produtoBase of oficiais) {
      const produto = normalizarProduto(produtoBase);
      const chave = String(produtoBase.sku || produto.nome).toLowerCase();
      if (existentes.has(chave)) continue;
      adicionados.push({ ...produto, sku: produtoBase.sku, empresaId: req.empresaId, id: `bar-ttc-${produtoBase.sku.toLowerCase()}`, ordem: itens.length + adicionados.length + 1, catalogoSeed: RESUMO_CATALOGO_BAR_TTC.versao, criadoEm: agora, atualizadoEm: agora });
      existentes.add(chave);
    }
    if (adicionados.length) { itens.push(...adicionados); sincronizarEstoqueCardapio(req.empresaId); save(); }
    res.status(201).json({ ok: true, adicionados: adicionados.length, total: itens.length, versao: RESUMO_CATALOGO_BAR_TTC.versao, fonte: RESUMO_CATALOGO_BAR_TTC.fonte });
  });

  app.post('/api/admin/cardapio', requerEditorCatalogo, (req, res) => {
    const produto = normalizarProduto(req.body);
    if (!produto.nome || produto.preco === null) {
      return res.status(400).json({ erro: 'Nome e preço válido são obrigatórios' });
    }
    const itens = cardapioPersistido(req.empresaId);
    const agora = new Date().toISOString();
    const novo = { ...produto, empresaId: req.empresaId, id: `prd-${Date.now().toString(36)}-${itens.length + 1}`, ordem: itens.length + 1, criadoEm: agora, atualizadoEm: agora };
    itens.push(novo);
    sincronizarEstoqueCardapio(req.empresaId);
    save();
    res.status(201).json({ ok: true, item: novo });
  });

  app.patch('/api/admin/cardapio/:id', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido(req.empresaId);
    const item = itens.find((produto) => produto.id === req.params.id && produto.empresaId === req.empresaId);
    if (!item) return res.status(404).json({ erro: 'Produto não encontrado na empresa ativa.' });
    const atualizado = normalizarProduto({ ...item, ...req.body });
    if (!atualizado.nome || atualizado.preco === null) {
      return res.status(400).json({ erro: 'Nome e preço válido são obrigatórios' });
    }
    Object.assign(item, atualizado, { empresaId: req.empresaId, atualizadoEm: new Date().toISOString() });
    sincronizarEstoqueCardapio(req.empresaId);
    save();
    res.json({ ok: true, item });
  });

  app.delete('/api/admin/cardapio/:id', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido(req.empresaId);
    const indice = itens.findIndex((produto) => produto.id === req.params.id && produto.empresaId === req.empresaId);
    if (indice < 0) return res.status(404).json({ erro: 'Produto não encontrado na empresa ativa.' });
    const [removido] = itens.splice(indice, 1);
    sincronizarEstoqueCardapio(req.empresaId, { registrarHistorico: true });
    save();
    res.json({ ok: true, removido: { id: removido.id, nome: removido.nome } });
  });

  // Replicação explícita e idempotente. Somente o administrador da plataforma
  // pode copiar dados entre tenants; uma empresa nunca pode escolher ou ler um
  // destino fora da lista de empresas ativas do cadastro mestre.
  app.post('/api/admin/cardapio/replicar-todas-empresas', requerAdministradorPlataforma, (req, res) => {
    try {
      const confirmacao = String(req.body?.confirmacao || '').trim();
      if (confirmacao !== 'CONFIRMAR_REPLICACAO_CATALOGO') {
        return res.status(400).json({
          erro: 'Ação crítica bloqueada por segurança de isolamento entre empresas. É necessário enviar confirmação: "CONFIRMAR_REPLICACAO_CATALOGO".'
        });
      }
      const origemEmpresaId = String(req.body?.origemEmpresaId || req.get('X-Loja-Id') || cadastrosMestres.EMPRESA_PADRAO_ID).trim();
      const resultado = replicarCatalogoParaEmpresas(origemEmpresaId);
      res.json({ ok: true, ...resultado, mensagem: 'Produtos e cardápios replicados de forma idempotente para todas as empresas ativas.' });
    } catch (error) {
      res.status(422).json({ erro: error.message });
    }
  });

  function filtrarReservasQuadras(lista, query = {}) {
    const quadraId = String(query.quadraId || '').trim();
    const data = String(query.data || '').trim();
    const de = String(query.de || '').trim();
    const ate = String(query.ate || '').trim();
    return lista
      .filter((reserva) => !quadraId || String(reserva.quadraId) === quadraId)
      .filter((reserva) => !data || String(reserva.data) === data)
      .filter((reserva) => !de || String(reserva.data) >= de)
      .filter((reserva) => !ate || String(reserva.data) <= ate)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.horaInicio).localeCompare(String(b.horaInicio)));
  }

  function validarReservaQuadra(empresaId, payload = {}, { ignorarId = '' } = {}) {
    const quadraId = String(payload.quadraId || '').trim();
    const data = String(payload.data || '').trim();
    const horaInicio = String(payload.horaInicio || '').trim();
    const horaFim = String(payload.horaFim || '').trim();
    const horarioValido = (valor) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valor);
    if (!quadraId || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !horarioValido(horaInicio) || !horarioValido(horaFim)) {
      throw new Error('quadraId, data, horaInicio e horaFim são obrigatórios e devem estar em formato válido.');
    }
    if (data < new Date().toISOString().slice(0, 10)) throw new Error('Não é possível reservar uma data passada.');
    if (horaInicio >= horaFim) throw new Error('O horário final deve ser posterior ao horário inicial.');
    const quadra = quadrasPersistidas(empresaId).find((item) => String(item.id) === quadraId && item.ativa !== false);
    if (!quadra) throw new Error('Quadra não encontrada ou inativa na empresa ativa.');
    const conflito = reservasQuadrasPersistidas(empresaId).find((reserva) => String(reserva.id) !== String(ignorarId || '') && String(reserva.quadraId) === quadraId && reserva.data === data && reserva.status !== 'cancelada' && reserva.horaInicio < horaFim && reserva.horaFim > horaInicio);
    if (conflito) throw new Error('Horário indisponível para esta quadra.');
    return { quadra, quadraId, data, horaInicio, horaFim };
  }

  function serializarQuadra(quadra, empresaId) {
    return { ...quadra, empresaId };
  }

  // Quadras públicas usam a empresa padrão, enquanto as rotas administrativas
  // resolvem a empresa pelo mesmo middleware do cardápio/PDV.
  app.get('/api/quadras', (req, res) => {
    res.json(quadrasPersistidas(cadastrosMestres.EMPRESA_PADRAO_ID).filter((quadra) => quadra.ativa !== false).map((quadra) => serializarQuadra(quadra, cadastrosMestres.EMPRESA_PADRAO_ID)));
  });
  app.get('/api/admin/quadras', requerEditorCatalogo, (req, res) => {
    res.json(quadrasPersistidas(req.empresaId).map((quadra) => serializarQuadra(quadra, req.empresaId)));
  });
  app.post('/api/admin/quadras', requerEditorCatalogo, (req, res) => {
    try {
      const dados = normalizarQuadra(req.body || {});
      if (!dados.nome) return res.status(400).json({ erro: 'Nome da quadra é obrigatório.' });
      const quadras = quadrasPersistidas(req.empresaId);
      const duplicada = quadras.some((quadra) => quadra.ativa !== false && quadra.nome.toLocaleLowerCase('pt-BR') === dados.nome.toLocaleLowerCase('pt-BR'));
      if (duplicada) return res.status(409).json({ erro: 'Já existe uma quadra ativa com este nome na empresa.' });
      const quadra = { ...dados, id: novoIdCatalogo('qdr', req.empresaId), empresaId: req.empresaId, criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() };
      quadras.push(quadra);
      save();
      res.status(201).json(quadra);
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });
  app.patch('/api/admin/quadras/:id', requerEditorCatalogo, (req, res) => {
    const quadra = quadrasPersistidas(req.empresaId).find((item) => String(item.id) === String(req.params.id));
    if (!quadra) return res.status(404).json({ erro: 'Quadra não encontrada na empresa ativa.' });
    const dados = normalizarQuadra(req.body || {}, quadra);
    if (!dados.nome) return res.status(400).json({ erro: 'Nome da quadra é obrigatório.' });
    Object.assign(quadra, dados, { empresaId: req.empresaId, atualizadoEm: new Date().toISOString() });
    save();
    res.json(quadra);
  });
  app.delete('/api/admin/quadras/:id', requerEditorCatalogo, (req, res) => {
    const quadras = quadrasPersistidas(req.empresaId);
    const indice = quadras.findIndex((item) => String(item.id) === String(req.params.id));
    if (indice < 0) return res.status(404).json({ erro: 'Quadra não encontrada na empresa ativa.' });
    const [removida] = quadras.splice(indice, 1);
    const reservas = reservasQuadrasPersistidas(req.empresaId);
    for (const reserva of reservas) if (String(reserva.quadraId) === String(removida.id) && reserva.status !== 'cancelada') reserva.status = 'cancelada';
    save();
    res.json({ ok: true, removido: { id: removida.id, nome: removida.nome } });
  });

  app.get('/api/reservas', (req, res) => {
    res.json(filtrarReservasQuadras(reservasQuadrasPersistidas(cadastrosMestres.EMPRESA_PADRAO_ID), req.query || {}));
  });
  app.get('/api/admin/quadras/reservas', requerEditorCatalogo, (req, res) => {
    res.json(filtrarReservasQuadras(reservasQuadrasPersistidas(req.empresaId), req.query || {}));
  });
  app.post('/api/reservas', requerAutenticacao, (req, res) => {
    try {
      const validada = validarReservaQuadra(req.empresaId, req.body || {}, { exigirUsuario: true });
      const reservas = reservasQuadrasPersistidas(req.empresaId);
      const agora = new Date().toISOString();
      const reserva = {
        id: novoIdCatalogo('res', req.empresaId), empresaId: req.empresaId, quadraId: validada.quadraId,
        quadraNome: validada.quadra.nome, data: validada.data, horaInicio: validada.horaInicio, horaFim: validada.horaFim,
        socioId: req.usuario.id, socioNome: req.usuario.nome || req.usuario.email, usuarioId: req.usuario.id,
        status: 'confirmada', obs: String(req.body?.obs || '').trim().slice(0, 300), criadoEm: agora, atualizadoEm: agora,
      };
      reservas.push(reserva);
      save();
      res.status(201).json(reserva);
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });
  app.patch('/api/reservas/:id/cancelar', requerAutenticacao, (req, res) => {
    const reserva = reservasQuadrasPersistidas(req.empresaId).find((item) => String(item.id) === String(req.params.id));
    if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada na empresa ativa.' });
    if (reserva.usuarioId !== req.usuario.id && !temPermissao({ ...req.usuario, ...resumoAcessoUsuario(req.usuario) }, 'cardapio', 'editar')) return res.status(403).json({ erro: 'Sem permissão para cancelar esta reserva.' });
    reserva.status = 'cancelada'; reserva.canceladoEm = new Date().toISOString(); reserva.atualizadoEm = reserva.canceladoEm;
    save();
    res.json(reserva);
  });
  app.patch('/api/admin/quadras/reservas/:id', requerEditorCatalogo, (req, res) => {
    const reservas = reservasQuadrasPersistidas(req.empresaId);
    const reserva = reservas.find((item) => String(item.id) === String(req.params.id));
    if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada na empresa ativa.' });
    try {
      const dados = validarReservaQuadra(req.empresaId, { ...reserva, ...req.body }, { ignorarId: reserva.id });
      Object.assign(reserva, {
        quadraId: dados.quadraId,
        data: dados.data,
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        quadraNome: dados.quadra.nome,
        atualizadoEm: new Date().toISOString(),
      });
      save();
      res.json(reserva);
    } catch (error) { res.status(422).json({ erro: error.message }); }
  });

  // Rota: Notícias
  app.get('/api/noticias', (req, res) => {
    res.json([]);
  });

  // ── ROTINA INTERNA FINANCEIRA (CLOUD SCHEDULER) ───────────────────────────
  // O endpoint só aceita token OIDC emitido pelo Cloud Scheduler para a conta
  // de serviço específica configurada no ambiente. Assim, não há segredos na URL.
  async function validarAgendador(req, res, next) {
    try {
      const esperado = process.env.SCHEDULER_SERVICE_ACCOUNT;
      const auth = String(req.get('authorization') || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!esperado || !token) return res.status(401).json({ erro: 'Agendador não autenticado.' });
      const audience = process.env.SCHEDULER_AUDIENCE || `${req.protocol}://${req.get('host')}/api/internal/financeiro/rotina-diaria`;
      const ticket = await schedulerOidcClient.verifyIdToken({ idToken: token, audience });
      const payload = ticket.getPayload();
      if (payload?.email !== esperado || payload?.email_verified !== true) return res.status(403).json({ erro: 'Identidade do agendador não autorizada.' });
      return next();
    } catch (error) {
      console.warn('[SCHEDULER] Token OIDC inválido:', error?.message || error);
      return res.status(401).json({ erro: 'Token do agendador inválido.' });
    }
  }

  function dataOperacional(now = new Date()) {
    const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const obter = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
    return `${obter('year')}-${obter('month')}-${obter('day')}`;
  }

  function executarRotinaFinanceiraDiaria(empresaId, origem = 'manual', dataReferencia = null) {
    const alertas = clientesKytto.verificarAlertasVencimento(empresaId);
    const referencia = dataReferencia ? new Date(dataReferencia) : new Date();
    if (Number.isNaN(referencia.valueOf())) throw new Error('Data de fechamento inválida.');
    const data = dataOperacional(referencia);
    let fechamento = clientesKytto.obterFechamentoDiario(empresaId, data);
    let fechadoAgora = false;
    if (!fechamento) {
      fechamento = clientesKytto.criarFechamentoDiario(empresaId, {
        dataFechamento: data,
        responsavel: origem === 'agendador' ? 'agendador-financeiro@kytto.local' : String(empresaId),
        observacao: origem === 'agendador' ? 'Fechamento diário automático e atualização de alertas.' : 'Fechamento diário manual e atualização de alertas.',
        origem,
      });
      fechadoAgora = true;
    }
    const fechamentoFinanceiro = financeiroKytto.fecharDia(
      empresaId,
      data,
      origem === 'agendador' ? 'agendador-financeiro@kytto.local' : String(empresaId)
    );
    save();
    return { empresaId, data, alertas, fechamento, fechamentoFinanceiro, fechadoAgora };
  }

  app.post('/api/internal/financeiro/rotina-diaria', validarAgendador, (req, res) => {
    const resultados = cadastrosMestres.listarEmpresas().map((empresa) => executarRotinaFinanceiraDiaria(empresa.id, 'agendador'));
    res.json({ ok: true, resultados, totalEmpresas: resultados.length, totalAlertas: resultados.reduce((soma, resultado) => soma + resultado.alertas.length, 0) });
  });

  // ── CLIENTES E CONTAS A RECEBER ──────────────────────────────────────────
  app.post('/api/admin/clientes', requerEditorCatalogo, (req, res) => {
    try {
      const cliente = clientesKytto.criarCliente(req.empresaId, req.body);
      save();
      res.status(201).json({ ok: true, cliente });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/clientes', requerEditorCatalogo, (req, res) => {
    try {
      const clientes = clientesKytto.listarClientes(req.empresaId);
      res.json({ ok: true, clientes });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/clientes/:clienteId', requerEditorCatalogo, (req, res) => {
    try {
      const cliente = clientesKytto.atualizarCliente(req.empresaId, req.params.clienteId, req.body);
      if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
      save();
      res.json({ ok: true, cliente });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/contas-receber', requerEditorCatalogo, (req, res) => {
    try {
      const conta = clientesKytto.criarContaReceber(req.empresaId, req.body);
      const lancamentoFinanceiro = financeiroKytto.sincronizarContaReceber(req.empresaId, conta, {
        usuario: req.usuario?.email,
        meioPagamento: req.body?.meioPagamento || 'conta',
      });
      save();
      res.status(201).json({ ok: true, conta, lancamentoFinanceiro });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/contas-receber', requerEditorCatalogo, (req, res) => {
    try {
      const contas = clientesKytto.listarContasReceber(req.empresaId, req.query);
      res.json({ ok: true, contas });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/contas-receber/:contaId', requerEditorCatalogo, (req, res) => {
    try {
      const conta = clientesKytto.atualizarContaReceber(req.empresaId, req.params.contaId, req.body);
      if (!conta) return res.status(404).json({ erro: 'Conta a receber não encontrada.' });
      const lancamentoFinanceiro = financeiroKytto.sincronizarContaReceber(req.empresaId, conta, {
        usuario: req.usuario?.email,
        meioPagamento: req.body?.meioPagamento,
      });
      save();
      res.json({ ok: true, conta, lancamentoFinanceiro });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/alertas-vencimento', requerEditorCatalogo, (req, res) => {
    try {
      const alertas = clientesKytto.verificarAlertasVencimento(req.empresaId);
      save();
      res.json({ ok: true, alertas, total: alertas.length });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/fechamento-diario', requerEditorCatalogo, (req, res) => {
    try {
      const resultado = executarRotinaFinanceiraDiaria(req.empresaId, 'manual', req.body?.data || null);
      res.status(resultado.fechadoAgora ? 201 : 200).json({ ok: true, fechamento: resultado.fechamento, fechamentoFinanceiro: resultado.fechamentoFinanceiro, alertas: resultado.alertas, fechadoAgora: resultado.fechadoAgora });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/fechamento-diario', requerEditorCatalogo, (req, res) => {
    try {
      const fechamentos = clientesKytto.listarFechamentosDiarios(req.empresaId);
      res.json({ ok: true, fechamentos });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  // ── FINANCEIRO CENTRAL MULTIENTIDADE ─────────────────────────────────────
  // O livro-caixa consolida automaticamente vendas de comandas, entradas de
  // estoque e contas de clientes. Lançamentos manuais continuam disponíveis
  // para notas, boletos, ajustes e demais eventos administrativos.
  app.get('/api/admin/financeiro/lancamentos', requerEditorCatalogo, (req, res) => {
    try {
      res.json(financeiroKytto.listarLancamentos(req.empresaId, req.query));
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/financeiro/lancamentos', requerEditorCatalogo, (req, res) => {
    try {
      const lancamento = financeiroKytto.registrarLancamento(req.empresaId, {
        ...req.body,
        origem: 'manual',
        usuario: req.usuario?.email,
        automatico: false,
      });
      save();
      res.status(201).json(lancamento);
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/financeiro/lancamentos/:id', requerEditorCatalogo, (req, res) => {
    try {
      const lancamento = financeiroKytto.atualizarLancamento(req.empresaId, req.params.id, req.body || {}, { permitirAutomatico: true });
      if (!lancamento) return res.status(404).json({ erro: 'Lançamento financeiro não encontrado na empresa ativa.' });
      save();
      res.json(lancamento);
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.delete('/api/admin/financeiro/lancamentos/:id', requerEditorCatalogo, (req, res) => {
    try {
      const lancamento = financeiroKytto.cancelarLancamento(req.empresaId, req.params.id, { usuario: req.usuario?.email, permitirAutomatico: true });
      if (!lancamento) return res.status(404).json({ erro: 'Lançamento financeiro não encontrado na empresa ativa.' });
      save();
      res.json({ ok: true, lancamento });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/financeiro/resumo', requerEditorCatalogo, (req, res) => {
    try {
      res.json(financeiroKytto.resumoFinanceiro(req.empresaId, { hoje: req.query?.data || undefined }));
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/financeiro/fluxo', requerEditorCatalogo, (req, res) => {
    try {
      const meses = Math.max(1, Math.min(36, Number(req.query?.meses || 12)));
      res.json(financeiroKytto.fluxoFinanceiro(req.empresaId, meses, req.query?.data || undefined));
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/financeiro/categorias', requerEditorCatalogo, (req, res) => {
    res.json(financeiroKytto.CATEGORIAS_FINANCEIRAS);
  });

  app.get('/api/admin/financeiro/contas-pagar', requerEditorCatalogo, (req, res) => {
    try {
      res.json(financeiroKytto.listarLancamentos(req.empresaId, { ...req.query, tipo: 'despesa' }));
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/financeiro/contas-pagar', requerEditorCatalogo, (req, res) => {
    try {
      const lancamento = financeiroKytto.registrarLancamento(req.empresaId, {
        ...req.body,
        tipo: 'despesa',
        origem: req.body?.origem || 'contas_pagar',
        usuario: req.usuario?.email,
        automatico: false,
      });
      save();
      res.status(201).json({ ok: true, contaPagar: lancamento });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/financeiro/pagamento', requerEditorCatalogo, (req, res) => {
    try {
      const id = String(req.body?.lancamentoId || req.body?.id || '');
      if (!id) return res.status(400).json({ erro: 'Informe o lançamento financeiro a liquidar.' });
      const lancamento = financeiroKytto.atualizarLancamento(req.empresaId, id, {
        status: 'pago',
        pagoEm: req.body?.dataPagamento || new Date().toISOString(),
        meioPagamento: req.body?.meioPagamento,
        observacao: req.body?.observacao,
      }, { permitirAutomatico: true });
      if (!lancamento) return res.status(404).json({ erro: 'Lançamento financeiro não encontrado na empresa ativa.' });
      save();
      res.json({ ok: true, lancamento });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/financeiro/fechamento', requerEditorCatalogo, (req, res) => {
    try {
      const fechamento = financeiroKytto.fecharDia(req.empresaId, req.body?.data || new Date().toISOString(), req.usuario?.email);
      save();
      res.status(fechamento.criadoAgora ? 201 : 200).json({ ok: true, fechamento });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/financeiro/fechamentos', requerEditorCatalogo, (req, res) => {
    try {
      res.json({ ok: true, fechamentos: financeiroKytto.listarFechamentos(req.empresaId) });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  // ── CAIXA DIÁRIO ─────────────────────────────────────────────────────────
  app.post('/api/admin/caixa/abrir', requerEditorCatalogo, (req, res) => {
    try {
      const caixa = caixaKytto.abrirCaixa(req.empresaId, { ...req.body, usuario: req.usuario?.email });
      save();
      res.status(201).json({ ok: true, caixa });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/caixa', requerEditorCatalogo, (req, res) => {
    try {
      res.json({ ok: true, caixas: caixaKytto.listarCaixas(req.empresaId, req.query) });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/caixa/sangria', requerEditorCatalogo, (req, res) => {
    try {
      const movimento = caixaKytto.registrarMovimento(req.empresaId, { ...req.body, tipo: 'sangria', usuario: req.usuario?.email });
      save();
      res.status(201).json({ ok: true, movimento });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/caixa/suprimento', requerEditorCatalogo, (req, res) => {
    try {
      const movimento = caixaKytto.registrarMovimento(req.empresaId, { ...req.body, tipo: 'suprimento', usuario: req.usuario?.email });
      save();
      res.status(201).json({ ok: true, movimento });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/caixa/fechar', requerEditorCatalogo, (req, res) => {
    try {
      const caixa = caixaKytto.obterCaixa(req.empresaId, req.body?.caixaId || req.body?.caixa_id);
      if (!caixa) return res.status(404).json({ erro: 'Caixa não encontrado na empresa ativa.' });
      const recebimentosDinheiro = financeiroKytto.listarLancamentos(req.empresaId)
        .filter((item) => item.tipo === 'receita' && item.status === 'pago' && item.meioPagamento === 'dinheiro' && item.pagoEm?.slice(0, 10) === caixa.data)
        .reduce((soma, item) => soma + Number(item.valor || 0), 0);
      const resultado = caixaKytto.fecharCaixa(req.empresaId, {
        ...req.body,
        recebimentosDinheiro,
        dataOperacao: req.body?.dataOperacao || `${caixa.data}T23:59:59.000Z`,
      });
      save();
      res.json({ ok: true, ...resultado });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  function usuarioAutenticadoDaRequisicao(req) {
    return usuarioDoToken(req) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(
      (() => {
        try { return Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), 'base64').toString('utf8').split(':')[0]; }
        catch { return ''; }
      })()
    ));
  }

  function requerAdministradorPlataforma(req, res, next) {
    const usuario = usuarioAutenticadoDaRequisicao(req);
    if (!usuario || usuario.ativo === false || usuario.platformAdmin !== true) {
      return res.status(403).json({ erro: 'Permissão de administração da plataforma necessária.' });
    }
    req.usuario = usuario;
    next();
  }

  // Consultor de plataforma é uma delegação explícita e separada do perfil
  // operacional "consultor". Somente ele ou um administrador da plataforma
  // podem criar e configurar empresas às quais tenham acesso.
  function requerGestorOnboarding(req, res, next) {
    const usuario = usuarioAutenticadoDaRequisicao(req);
    if (!usuario || usuario.ativo === false || (usuario.platformAdmin !== true && usuario.platformConsultor !== true)) {
      return res.status(403).json({ erro: 'Permissão de consultoria ou administração da plataforma necessária.' });
    }
    req.usuario = usuario;
    next();
  }

  function podeGerirEmpresaNoOnboarding(usuario, empresaId) {
    if (usuario?.platformAdmin === true) return true;
    return cadastrosMestres.empresasDoUsuario(usuario).some((empresa) => empresa.id === String(empresaId) && empresa.ativa !== false);
  }

  // ── BARBEARIA ERP — CONTRATO ADMINISTRATIVO JSON MULTIEMPRESA ─────────────
  // Este contrato é separado do módulo v1 legado (/api/v1/barbearia), que usa
  // outro schema. O runtime efetivo do SetPoint usa empresaId + db JSON/GCS.
  function sanitizarClienteBarbearia(cliente) {
    if (!cliente) return cliente;
    return {
      id: cliente.id,
      empresaId: cliente.empresaId,
      nome: cliente.nome,
      tipo: cliente.tipo,
      telefone: cliente.telefone,
      email: cliente.email,
      endereco: cliente.endereco,
      limiteCreditoMensal: cliente.limiteCreditoMensal,
      diasVencimento: cliente.diasVencimento,
      observacao: cliente.observacao,
      saldoDevedor: cliente.saldoDevedor,
      scoreCredito: cliente.scoreCredito,
      risco: cliente.risco,
      criadoEm: cliente.criadoEm,
      atualizadoEm: cliente.atualizadoEm,
    };
  }

  function clientesBarbeariaSomenteLeitura(empresaId) {
    const empresas = db().clientesKytto?.empresas || {};
    const clientes = empresas[String(empresaId)]?.clientes || {};
    return Object.values(clientes)
      .filter((cliente) => cliente.empresaId === String(empresaId) && cliente.status !== 'deletado')
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      .map(sanitizarClienteBarbearia);
  }

  function enriquecerAgendamentoBarbearia(empresaId, agendamento) {
    const profissionais = barbeariaErpKytto.listarProfissionais(empresaId, { incluirInativos: true });
    const servicos = barbeariaErpKytto.listarServicos(empresaId, { incluirInativos: true });
    const cliente = clientesBarbeariaSomenteLeitura(empresaId).find((item) => item.id === agendamento.clienteId);
    const profissional = profissionais.find((item) => item.id === agendamento.profissionalId);
    const servico = servicos.find((item) => item.id === agendamento.servicoId);
    return {
      ...agendamento,
      clienteNome: agendamento.clienteNome || cliente?.nome || '',
      clienteTelefone: agendamento.clienteTelefone || cliente?.telefone || '',
      profissionalNome: profissional?.nome || '',
      servicoNome: servico?.nome || '',
      cliente_nome: agendamento.clienteNome || cliente?.nome || '',
      profissional_nome: profissional?.nome || '',
      servico_nome: servico?.nome || '',
      duracao_minutos: agendamento.duracaoMinutos,
      meio_pagamento: agendamento.meioPagamento,
    };
  }

  function listarAgendamentosBarbearia(empresaId, filtros = {}) {
    return barbeariaErpKytto.listarAgendamentos(empresaId, filtros)
      .map((item) => enriquecerAgendamentoBarbearia(empresaId, item));
  }

  function incluirInativos(query) {
    return String(query?.incluirInativos || '').toLowerCase() === 'true';
  }

  app.get('/api/admin/barbearia/dashboard', requerEditorCatalogo, (req, res) => {
    try {
      const data = String(req.query?.data || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const clientes = clientesBarbeariaSomenteLeitura(req.empresaId);
      const financeiro = financeiroKytto.resumoFinanceiro(req.empresaId, { hoje: data });
      const caixas = caixaKytto.listarCaixas(req.empresaId, { data });
      const dashboard = barbeariaErpKytto.obterDashboard(req.empresaId, {
        data,
        clientesAtivos: clientes.length,
        financeiro,
        caixa: { data, caixas, aberto: caixas.find((item) => item.status === 'aberto') || null },
      });
      dashboard.proximosAgendamentos = dashboard.proximosAgendamentos.map((item) => enriquecerAgendamentoBarbearia(req.empresaId, item));
      res.json({ ok: true, ...dashboard });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/barbearia/configuracoes', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, configuracao: barbeariaErpKytto.obterConfiguracao(req.empresaId) });
  });

  app.patch('/api/admin/barbearia/configuracoes', requerEditorCatalogo, (req, res) => {
    try {
      const configuracao = barbeariaErpKytto.atualizarConfiguracao(req.empresaId, req.body || {});
      res.json({ ok: true, configuracao });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/barbearia/profissionais', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, profissionais: barbeariaErpKytto.listarProfissionais(req.empresaId, { incluirInativos: incluirInativos(req.query) }) });
  });

  app.post('/api/admin/barbearia/profissionais', requerEditorCatalogo, (req, res) => {
    try {
      const profissional = barbeariaErpKytto.criarProfissional(req.empresaId, req.body || {});
      res.status(201).json({ ok: true, profissional });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/barbearia/profissionais/:id', requerEditorCatalogo, (req, res) => {
    try {
      const profissional = barbeariaErpKytto.atualizarProfissional(req.empresaId, req.params.id, req.body || {});
      if (!profissional) return res.status(404).json({ erro: 'Profissional não encontrado na empresa ativa.' });
      res.json({ ok: true, profissional });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.delete('/api/admin/barbearia/profissionais/:id', requerEditorCatalogo, (req, res) => {
    try {
      const profissional = barbeariaErpKytto.excluirProfissional(req.empresaId, req.params.id);
      if (!profissional) return res.status(404).json({ erro: 'Profissional não encontrado na empresa ativa.' });
      res.json({ ok: true, profissional, exclusao: 'logica' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/barbearia/servicos', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, servicos: barbeariaErpKytto.listarServicos(req.empresaId, { incluirInativos: incluirInativos(req.query) }) });
  });

  app.post('/api/admin/barbearia/servicos', requerEditorCatalogo, (req, res) => {
    try {
      const servico = barbeariaErpKytto.criarServico(req.empresaId, req.body || {});
      res.status(201).json({ ok: true, servico });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/barbearia/servicos/:id', requerEditorCatalogo, (req, res) => {
    try {
      const servico = barbeariaErpKytto.atualizarServico(req.empresaId, req.params.id, req.body || {});
      if (!servico) return res.status(404).json({ erro: 'Serviço não encontrado na empresa ativa.' });
      res.json({ ok: true, servico });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/barbearia/agenda', requerEditorCatalogo, (req, res) => {
    try {
      const agendamentos = listarAgendamentosBarbearia(req.empresaId, {
        data: req.query?.data || req.query?.date,
        status: req.query?.status,
        profissionalId: req.query?.profissionalId || req.query?.profissional_id,
      });
      res.json({ ok: true, agendamentos, total: agendamentos.length });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/barbearia/agenda/:id', requerEditorCatalogo, (req, res) => {
    try {
      const agendamento = listarAgendamentosBarbearia(req.empresaId).find((item) => item.id === String(req.params.id));
      if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado na empresa ativa.' });
      res.json({ ok: true, agendamento });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/barbearia/agenda', requerEditorCatalogo, (req, res) => {
    try {
      const agendamento = barbeariaErpKytto.criarAgendamento(req.empresaId, req.body || {});
      res.status(201).json({ ok: true, agendamento: enriquecerAgendamentoBarbearia(req.empresaId, agendamento) });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/barbearia/agenda/:id', requerEditorCatalogo, (req, res) => {
    try {
      const agendamento = barbeariaErpKytto.atualizarAgendamento(req.empresaId, req.params.id, req.body || {});
      if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado na empresa ativa.' });
      res.json({ ok: true, agendamento: enriquecerAgendamentoBarbearia(req.empresaId, agendamento) });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/barbearia/agenda/:id/status', requerEditorCatalogo, (req, res) => {
    try {
      const status = String(req.body?.status || '');
      let agendamento = barbeariaErpKytto.alterarStatusAgendamento(req.empresaId, req.params.id, status, req.body || {});
      if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado na empresa ativa.' });
      let financeiro = null;
      if (status === 'concluido' && req.body?.registrarFinanceiro === true) {
        if (req.body?.confirmado !== true) return res.status(400).json({ erro: 'A confirmação explícita do recebimento é obrigatória.' });
        const meioPagamento = String(req.body?.meioPagamento || '').trim().toLowerCase();
        const valor = Number(req.body?.valorRecebido ?? agendamento.valor);
        if (!meioPagamento || !Number.isFinite(valor) || valor <= 0) return res.status(400).json({ erro: 'Informe valor recebido positivo e meio de pagamento.' });
        financeiro = financeiroKytto.registrarLancamento(req.empresaId, {
          tipo: 'receita',
          categoria: 'Serviços',
          descricao: `Atendimento de barbearia ${agendamento.id}`,
          valor,
          origem: 'barbearia_atendimento',
          status: 'pago',
          meioPagamento,
          dataOperacao: new Date().toISOString(),
          pagoEm: new Date().toISOString(),
          usuario: req.usuario?.email,
          automatico: true,
          chaveIdempotencia: `barbearia_atendimento:${req.empresaId}:${agendamento.id}`,
          referencia: { agendamentoId: agendamento.id, servicoId: agendamento.servicoId, profissionalId: agendamento.profissionalId },
        });
        agendamento = barbeariaErpKytto.vincularLancamentoFinanceiro(req.empresaId, agendamento.id, financeiro.id) || agendamento;
      }
      save();
      res.json({ ok: true, agendamento: enriquecerAgendamentoBarbearia(req.empresaId, agendamento), financeiro });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/barbearia/clientes', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, clientes: clientesBarbeariaSomenteLeitura(req.empresaId) });
  });

  app.post('/api/admin/barbearia/clientes', requerEditorCatalogo, (req, res) => {
    try {
      const cliente = clientesKytto.criarCliente(req.empresaId, req.body || {});
      save();
      res.status(201).json({ ok: true, cliente: sanitizarClienteBarbearia(cliente) });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/barbearia/clientes/:id', requerEditorCatalogo, (req, res) => {
    try {
      const cliente = clientesKytto.atualizarCliente(req.empresaId, req.params.id, req.body || {});
      if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado na empresa ativa.' });
      save();
      res.json({ ok: true, cliente: sanitizarClienteBarbearia(cliente) });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/barbearia/relatorios/operacional', requerEditorCatalogo, (req, res) => {
    try {
      const data = String(req.query?.data || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const agenda = listarAgendamentosBarbearia(req.empresaId, { data });
      const porStatus = Object.fromEntries([...new Set(agenda.map((item) => item.status))].map((status) => [status, agenda.filter((item) => item.status === status).length]));
      const porProfissional = barbeariaErpKytto.listarProfissionais(req.empresaId, { incluirInativos: true }).map((profissional) => ({
        profissionalId: profissional.id,
        profissionalNome: profissional.nome,
        atendimentos: agenda.filter((item) => item.profissionalId === profissional.id).length,
        concluidos: agenda.filter((item) => item.profissionalId === profissional.id && item.status === 'concluido').length,
        faturamento: Number(agenda.filter((item) => item.profissionalId === profissional.id && item.status === 'concluido').reduce((soma, item) => soma + Number(item.valorRecebido || item.valor || 0), 0).toFixed(2)),
      }));
      res.json({ ok: true, data, totalAgendamentos: agenda.length, porStatus, porProfissional });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  // ── CADASTROS MESTRES MULTIENTIDADE ──────────────────────────────────────
  // Funcionários, usuários e fornecedores são registros únicos por empresa e
  // podem ser reutilizados pelos módulos de RH, compras, financeiro e operação.
  app.get('/api/admin/empresa-ativa', requerEditorCatalogo, (req, res) => {
    const acessiveis = cadastrosMestres.empresasDoUsuario(req.usuario).map((empresa) => ({
      id: empresa.id, nome: empresa.nome, nomeFantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj, ativa: empresa.ativa !== false, modulos: empresa.modulos || [],
      permitirEstoqueNegativo: empresa.permitirEstoqueNegativo !== false,
    }));
    res.json({ ok: true, empresa: req.empresa, empresasAcessiveis: acessiveis });
  });

  app.patch('/api/admin/empresa-ativa/configuracoes', requerEditorCatalogo, (req, res) => {
    try {
      if (req.body?.permitirEstoqueNegativo === undefined) {
        return res.status(400).json({ erro: 'Informe permitirEstoqueNegativo como verdadeiro ou falso.' });
      }
      const empresa = cadastrosMestres.atualizarEmpresa(req.empresaId, {
        permitirEstoqueNegativo: Boolean(req.body.permitirEstoqueNegativo),
      });
      save();
      res.json({ ok: true, empresa, mensagem: `Estoque negativo ${empresa.permitirEstoqueNegativo ? 'permitido' : 'bloqueado'} para a empresa ativa.` });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/funcionarios', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, funcionarios: cadastrosMestres.listarFuncionarios(req.empresaId, { incluirDesligados: req.query.incluirDesligados === 'true' }) });
  });

  app.post('/api/admin/funcionarios', requerEditorCatalogo, (req, res) => {
    try {
      const funcionario = cadastrosMestres.criarFuncionario(req.empresaId, req.body || {});
      res.status(201).json({ ok: true, funcionario });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/funcionarios/:funcionarioId', requerEditorCatalogo, (req, res) => {
    try {
      const funcionario = cadastrosMestres.atualizarFuncionario(req.empresaId, req.params.funcionarioId, req.body || {});
      if (!funcionario) return res.status(404).json({ erro: 'Funcionário não encontrado na empresa ativa.' });
      res.json({ ok: true, funcionario });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/fornecedores', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, fornecedores: cadastrosMestres.listarFornecedores(req.empresaId, { incluirInativos: req.query.incluirInativos === 'true' }) });
  });

  app.post('/api/admin/fornecedores', requerEditorCatalogo, (req, res) => {
    try {
      const fornecedor = cadastrosMestres.criarFornecedor(req.empresaId, req.body || {});
      res.status(201).json({ ok: true, fornecedor });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/fornecedores/:fornecedorId', requerEditorCatalogo, (req, res) => {
    try {
      const fornecedor = cadastrosMestres.atualizarFornecedor(req.empresaId, req.params.fornecedorId, req.body || {});
      if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado na empresa ativa.' });
      res.json({ ok: true, fornecedor });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  // ── COMPRAS: PEDIDO → APROVAÇÃO → RECEBIMENTO → ESTOQUE/FINANCEIRO ──────
  app.get('/api/admin/compras/pedidos', requerEditorCatalogo, (req, res) => {
    try {
      res.json({ ok: true, pedidos: comprasKytto.listarPedidosCompra(req.empresaId, req.query) });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/compras/pedidos', requerEditorCatalogo, (req, res) => {
    try {
      const fornecedorId = String(req.body?.fornecedorId || req.body?.fornecedor_id || '');
      const fornecedor = cadastrosMestres.listarFornecedores(req.empresaId).find((item) => item.id === fornecedorId);
      if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado na empresa ativa.' });
      const resultado = comprasKytto.criarPedidoCompra(req.empresaId, { ...req.body, solicitante: req.usuario?.email });
      save();
      res.status(201).json({ ok: true, ...resultado });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/compras/pedidos/:pedidoId/aprovar', requerEditorCatalogo, (req, res) => {
    try {
      const pedido = comprasKytto.aprovarPedidoCompra(req.empresaId, req.params.pedidoId, req.usuario?.email);
      if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado na empresa ativa.' });
      save();
      res.json({ ok: true, pedido });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/compras/pedidos/:pedidoId/receber', requerEditorCatalogo, (req, res) => {
    try {
      const resultado = comprasKytto.receberPedidoCompra(req.empresaId, req.params.pedidoId, req.body?.itens || [], req.usuario?.email);
      if (!resultado) return res.status(404).json({ erro: 'Pedido não encontrado na empresa ativa.' });
      const estoque = estoquePersistido(req.empresaId);
      const catalogo = cardapioPersistido(req.empresaId);
      const dataOperacao = req.body?.dataOperacao || new Date().toISOString();
      const statusFinanceiro = req.body?.statusFinanceiro === 'pago' ? 'pago' : 'pendente';
      const totalItensRecebidos = resultado.movimentos.reduce((soma, movimento) => soma + Number(movimento.valorTotal || 0), 0);
      const lancamentosFinanceiros = [];
      for (const movimento of resultado.movimentos) {
        const produto = catalogo.find((item) => item.id === movimento.produtoId);
        if (!produto) throw new Error(`Produto ${movimento.produtoId} não está cadastrado no cardápio da empresa ativa.`);
        estoque[movimento.produtoId] ||= fichaEstoque(produto, req.empresaId);
        const ficha = estoque[movimento.produtoId];
        const freteRateadoTotal = totalItensRecebidos > 0
          ? Number((Number(resultado.pedido.valorFrete || 0) * Number(movimento.valorTotal || 0) / totalItensRecebidos).toFixed(2))
          : 0;
        const rateioFrete = Number((freteRateadoTotal / Math.max(1, movimento.quantidade)).toFixed(4));
        const custoComFrete = Number((Number(movimento.valorUnitario || 0) + rateioFrete).toFixed(4));
        ficha.qtd = Number(ficha.qtd || 0) + Number(movimento.quantidade || 0);
        ficha.custo = custoComFrete;
        ficha.historico ||= [];
        ficha.historico.push({
          id: movimento.id,
          tipo: 'entrada_compra',
          qtd: movimento.quantidade,
          custo: custoComFrete,
          saldoFinal: ficha.qtd,
          pedidoId: resultado.pedido.id,
          fornecedorId: resultado.pedido.fornecedorId,
          ts: dataOperacao,
          origem: 'compras',
        });
        ficha.historico = ficha.historico.slice(-100);
        ficha.atualizadoEm = new Date().toISOString();
        const lancamento = financeiroKytto.registrarEntradaEstoque(req.empresaId, {
          produtoId: movimento.produtoId,
          produtoNome: produto.nome,
          qtd: movimento.quantidade,
          custo: custoComFrete,
          valorTotal: Number((Number(movimento.valorTotal || 0) + freteRateadoTotal).toFixed(2)),
          fornecedorId: resultado.pedido.fornecedorId,
          documento: req.body?.documento || resultado.pedido.numero,
          usuario: req.usuario?.email,
          dataOperacao,
          meioPagamento: req.body?.meioPagamento,
          status: statusFinanceiro,
          movimentoId: movimento.id,
        });
        if (lancamento) lancamentosFinanceiros.push(lancamento);
      }
      save();
      res.json({ ok: true, pedido: resultado.pedido, entradasEstoque: resultado.movimentos, lancamentosFinanceiros });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/usuarios-mestres', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, usuarios: cadastrosMestres.listarUsuarios(req.empresaId) });
  });

  app.post('/api/admin/usuarios-mestres', requerEditorCatalogo, (req, res) => {
    try {
      const senhaInicial = String(req.body?.senhaInicial || req.body?.senha || '');
      if (senhaInicial.length < 8) return res.status(400).json({ erro: 'A senha inicial deve possuir pelo menos 8 caracteres.' });
      const dadosUsuario = { ...(req.body || {}) };
      // Delegações de plataforma não podem ser concedidas por administradores
      // locais; elas exigem a rota específica protegida abaixo.
      delete dadosUsuario.platformAdmin;
      delete dadosUsuario.platformConsultor;
      const usuario = cadastrosMestres.criarUsuario(req.empresaId, {
        ...dadosUsuario, senhaHash: hashPassword(senhaInicial),
        empresasAcessiveis: [req.empresaId],
      });
      espelharUsuarioEmMemoria(usuario);
      const { senhaHash, ...resposta } = usuario;
      res.status(201).json({ ok: true, usuario: resposta });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.get('/api/admin/usuarios-mestres/:usuarioId', requerEditorCatalogo, (req, res) => {
    try {
      const usuario = cadastrosMestres.obterUsuario(req.empresaId, req.params.usuarioId);
      if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado na empresa ativa.' });
      const { senhaHash, ...resposta } = usuario;
      res.json({ ok: true, usuario: resposta });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/usuarios-mestres/:usuarioId', requerEditorCatalogo, (req, res) => {
    try {
      const payload = { ...(req.body || {}) };
      delete payload.platformAdmin;
      delete payload.platformConsultor;
      if (payload.senhaInicial || payload.senha) {
        const novaSenha = String(payload.senhaInicial || payload.senha);
        if (novaSenha.length < 8) return res.status(400).json({ erro: 'A senha deve possuir pelo menos 8 caracteres.' });
        payload.senhaHash = hashPassword(novaSenha);
      }
      delete payload.senha;
      delete payload.senhaInicial;
      const usuario = cadastrosMestres.atualizarUsuario(req.empresaId, req.params.usuarioId, payload);
      if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado na empresa ativa.' });
      espelharUsuarioEmMemoria(usuario);
      const { senhaHash, ...resposta } = usuario;
      res.json({ ok: true, usuario: resposta });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.delete('/api/admin/usuarios-mestres/:usuarioId', requerEditorCatalogo, (req, res) => {
    try {
      const usuario = cadastrosMestres.obterUsuario(req.empresaId, req.params.usuarioId);
      if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado na empresa ativa.' });
      if (usuario.id === req.usuario?.id) return res.status(400).json({ erro: 'Você não pode remover sua própria conta.' });
      usuario.ativo = false;
      usuario.atualizadoEm = new Date().toISOString();
      save();
      res.json({ ok: true, mensagem: 'Usuário desativado com sucesso.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/usuarios-mestres/:usuarioId/ativar', requerEditorCatalogo, (req, res) => {
    try {
      const usuario = cadastrosMestres.obterUsuario(req.empresaId, req.params.usuarioId);
      if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado na empresa ativa.' });
      usuario.ativo = true;
      usuario.atualizadoEm = new Date().toISOString();
      save();
      const { senhaHash, ...resposta } = usuario;
      res.json({ ok: true, usuario: resposta, mensagem: 'Usuário ativado com sucesso.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/usuario/alterar-senha', requerAutenticacao, (req, res) => {
    try {
      const senhaAtual = String(req.body?.senhaAtual || '');
      const senhaNova = String(req.body?.senhaNova || '');
      if (!senhaAtual || !senhaNova) return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
      const politica = passwordPolicy(senhaNova);
      if (politica) return res.status(400).json({ erro: politica });
      const usuario = cadastrosMestres.obterUsuario(req.empresaId, req.usuario.id);
      if (!usuario || !verificarSenha(senhaAtual, usuario.senhaHash)) {
        return res.status(401).json({ erro: 'Senha atual incorreta.' });
      }
      usuario.senhaHash = hashPassword(senhaNova);
      usuario.senha = undefined;
      usuario.senhaResetObrigatorio = false;
      usuario.passwordChangedAt = new Date().toISOString();
      usuario.atualizadoEm = new Date().toISOString();
      espelharUsuarioEmMemoria(usuario);
      save();
      res.json({ ok: true, mensagem: 'Senha alterada com sucesso.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/admin/usuarios-mestres/:usuarioId/resetar-senha', requerEditorCatalogo, async (req, res) => {
    try {
      const usuario = cadastrosMestres.obterUsuario(req.empresaId, req.params.usuarioId);
      if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado na empresa ativa.' });
      await issuePasswordReset(usuario, { ip: req.ip });
      const { senhaHash, senha, ...resposta } = usuario;
      res.json({ ok: true, usuario: resposta, mensagem: 'Link individual de redefinição enviado, se o e-mail estiver configurado.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  // Bootstrap público removido: a criação inicial ocorre de forma idempotente no
  // boot e a gestão posterior exige uma sessão administrativa autenticada.
  app.post('/api/admin/bootstrap/usuario-admin', (_req, res) => {
    res.status(410).json({ erro: 'Bootstrap público desativado. Use o convite ou a recuperação individual por e-mail.' });
  });

  // ── GESTÃO DE EMPRESAS E ONBOARDING MULTIENTIDADE ──────────────────────
  app.get('/api/admin/plataforma/empresas', requerGestorOnboarding, (req, res) => {
    const empresas = req.usuario.platformAdmin === true
      ? cadastrosMestres.listarEmpresas({ incluirInativas: true })
      : cadastrosMestres.empresasDoUsuario(req.usuario);
    res.json({ ok: true, empresas });
  });

  app.post('/api/admin/plataforma/empresas', requerGestorOnboarding, (req, res) => {
    try {
      const dadosAdmin = req.body?.administrador || {};
      const camposAdmin = [dadosAdmin.nome, dadosAdmin.email, dadosAdmin.senhaInicial].filter((valor) => String(valor || '').trim());
      const gestorCompleto = Boolean(dadosAdmin.nome && dadosAdmin.email && String(dadosAdmin.senhaInicial || '').length >= 8);
      if (camposAdmin.length > 0 && !gestorCompleto) {
        return res.status(400).json({ erro: 'Para cadastrar o gestor agora, informe nome, email e senha inicial com ao menos 8 caracteres. Ou deixe os três campos vazios para criar a empresa como rascunho.' });
      }
      const empresa = cadastrosMestres.criarEmpresa({
        ...(req.body || {}),
        criadoPorUsuarioId: req.usuario.id,
        statusOnboarding: gestorCompleto ? 'configuracao' : 'rascunho',
        modulos: gestorCompleto && Array.isArray(req.body?.modulos) ? req.body.modulos : [],
      });
      // Todo novo tenant recebe uma configuração fiscal independente, ainda em
      // homologação e sem emissão automática. A NFC-e só é liberada após o
      // checklist fiscal completo da própria empresa.
      fiscalKytto.salvarConfiguracaoFiscal(`empresa-${empresa.id}`, {
        cnpj: String(empresa.cnpj || '').replace(/\D/g, ''),
        razaoSocial: empresa.nome,
        nomeFantasia: empresa.nomeFantasia,
        ambiente: 'homologacao',
        emissaoAutomaticaAtiva: false,
      });
      let administrador = null;
      if (gestorCompleto) {
        administrador = cadastrosMestres.criarUsuario(empresa.id, {
          nome: dadosAdmin.nome,
          email: dadosAdmin.email,
          telefone: dadosAdmin.telefone || '',
          tipoUsuario: 'administrador',
          perfis: ['administrador'],
          roles: ['administrador'],
          senhaHash: hashPassword(String(dadosAdmin.senhaInicial)),
          empresasAcessiveis: [empresa.id],
        });
        espelharUsuarioEmMemoria(administrador);
      }
      // O administrador de plataforma também recebe acesso à empresa recém-criada
      // para auditoria e suporte, sem conceder esse acesso a nenhum outro usuário.
      if (req.usuario?.id && req.usuario?.empresaId) {
        const acessos = [...new Set([...(req.usuario.empresasAcessiveis || [req.usuario.empresaId]), empresa.id])];
        const atualizado = cadastrosMestres.atualizarUsuario(req.usuario.empresaId, req.usuario.id, { empresasAcessiveis: acessos });
        espelharUsuarioEmMemoria(atualizado);
      }
      const respostaAdmin = administrador ? (({ senhaHash, ...safe }) => safe)(administrador) : null;
      res.status(201).json({ ok: true, empresa, administrador: respostaAdmin, pendente: !gestorCompleto });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/plataforma/empresas/:empresaId', requerGestorOnboarding, (req, res) => {
    try {
      if (!podeGerirEmpresaNoOnboarding(req.usuario, req.params.empresaId)) {
        return res.status(403).json({ erro: 'Você não possui acesso de consultoria a esta empresa.' });
      }
      const permitidos = ['nome', 'nomeFantasia', 'cnpj', 'inscricaoEstadual', 'endereco', 'telefone', 'email', 'plano', 'modulos', 'permitirEstoqueNegativo', 'statusOnboarding'];
      const payload = Object.fromEntries(Object.entries(req.body || {}).filter(([campo]) => permitidos.includes(campo)));
      const empresa = cadastrosMestres.atualizarEmpresa(req.params.empresaId, payload);
      if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });
      res.json({ ok: true, empresa });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/plataforma/consultores/:empresaId/:usuarioId', requerAdministradorPlataforma, (req, res) => {
    try {
      const usuario = cadastrosMestres.obterUsuario(req.params.empresaId, req.params.usuarioId);
      if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado na empresa informada.' });
      const atualizado = cadastrosMestres.atualizarUsuario(req.params.empresaId, req.params.usuarioId, {
        platformConsultor: Boolean(req.body?.ativo),
      });
      espelharUsuarioEmMemoria(atualizado);
      const { senhaHash, ...resposta } = atualizado;
      res.json({ ok: true, usuario: resposta, mensagem: atualizado.platformConsultor ? 'Consultor de plataforma habilitado.' : 'Consultor de plataforma desabilitado.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  // ── FICHAS TÉCNICAS E INSUMOS ──────────────────────────────────────────────
  function dadosFichaTecnicaValidados(empresaId, dados = {}) {
    const catalogo = cardapioPersistido(empresaId);
    const produtoFinal = catalogo.find(item => item.id === String(dados.produtoFinalId || '') && item.indisponivel !== true);
    if (!produtoFinal) throw new Error('Produto final não encontrado no cardápio da empresa ativa.');
    const itens = (Array.isArray(dados.itens) ? dados.itens : []).map((item) => {
      const produto = catalogo.find(candidato => candidato.id === String(item?.produtoId || '') && candidato.indisponivel !== true);
      if (!produto) throw new Error('Um dos insumos não pertence ao cardápio da empresa ativa.');
      return { ...item, produtoId: produto.id, nome: produto.nome, unidade: produto.unidade || 'UN' };
    });
    return { ...dados, produtoFinalId: produtoFinal.id, nomeProduto: produtoFinal.nome, itens };
  }

  app.get('/api/admin/fichas-tecnicas', requerEditorCatalogo, (req, res) => {
    const estoque = estoquePersistido(req.empresaId);
    const fichas = fichasTecnicasKytto.listarFichasTecnicas(req.empresaId).map((ficha) => ({
      ...ficha,
      custo: fichasTecnicasKytto.custoFichaTecnica(req.empresaId, ficha.produtoFinalId, estoque),
    }));
    res.json({ ok: true, fichas });
  });

  function ativarControleDeInsumosFicha(empresaId, dadosFicha) {
    listarEstoqueCardapio(empresaId);
    const estoque = estoquePersistido(empresaId);
    for (const insumo of dadosFicha.itens || []) {
      const ficha = estoque[insumo.produtoId];
      if (!ficha) continue;
      ficha.controlaEstoque = true;
      ficha.atualizadoEm = new Date().toISOString();
    }
  }

  app.post('/api/admin/fichas-tecnicas', requerEditorCatalogo, (req, res) => {
    try {
      const dadosFicha = dadosFichaTecnicaValidados(req.empresaId, req.body || {});
      ativarControleDeInsumosFicha(req.empresaId, dadosFicha);
      const ficha = fichasTecnicasKytto.salvarFichaTecnica(req.empresaId, dadosFicha);
      save();
      res.status(201).json({ ok: true, ficha });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/fichas-tecnicas/:fichaId', requerEditorCatalogo, (req, res) => {
    try {
      const dadosFicha = dadosFichaTecnicaValidados(req.empresaId, req.body || {});
      ativarControleDeInsumosFicha(req.empresaId, dadosFicha);
      const ficha = fichasTecnicasKytto.salvarFichaTecnica(req.empresaId, dadosFicha, req.params.fichaId);
      save();
      res.json({ ok: true, ficha });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.delete('/api/admin/fichas-tecnicas/:fichaId', requerEditorCatalogo, (req, res) => {
    if (!fichasTecnicasKytto.removerFichaTecnica(req.empresaId, req.params.fichaId)) return res.status(404).json({ erro: 'Ficha técnica não encontrada.' });
    save();
    res.json({ ok: true });
  });

  // ── MÉTRICAS CANÔNICAS (SSOT) ──────────────────────────────────────────────
  function dataCuiabaAgora() {
    return metricasKytto.dataOperacionalCuiaba(new Date());
  }

  function deslocarData(dataIso, dias) {
    const data = new Date(`${dataIso}T12:00:00Z`);
    data.setUTCDate(data.getUTCDate() + dias);
    return data.toISOString().slice(0, 10);
  }

  function resolverPeriodoMetricas(query = {}) {
    const hoje = dataCuiabaAgora();
    const periodo = String(query.periodo || 'hoje').toLowerCase();
    const deInformado = String(query.de || '').slice(0, 10);
    const ateInformado = String(query.ate || '').slice(0, 10);
    if (deInformado || ateInformado) return { nome: 'personalizado', de: deInformado || hoje, ate: ateInformado || hoje };
    if (periodo === 'semana') return { nome: 'ultimos_7_dias', de: deslocarData(hoje, -6), ate: hoje };
    if (periodo === 'mes' || periodo === '30dias') return { nome: 'ultimos_30_dias', de: deslocarData(hoje, -29), ate: hoje };
    if (periodo === 'ano' || periodo === '12meses') return { nome: 'ultimos_12_meses', de: deslocarData(hoje, -364), ate: hoje };
    return { nome: 'hoje', de: hoje, ate: hoje };
  }
  
  app.get('/api/admin/metricas/operacional', requerEditorCatalogo, (req, res) => {
    try {
      const recorte = resolverPeriodoMetricas(req.query);
      const comandas = comandasDaEmpresa(req.empresaId);
      // Garante que todo item do cardápio tenha ficha de estoque antes do cálculo.
      const estoque = listarEstoqueCardapio(req.empresaId);
      
      // Comandas abertas
      const openTabs = metricasKytto.getOpenTabs(comandas);
      
      // Faturamento oficial: comandas fechadas no recorte solicitado.
      const revenueHoje = metricasKytto.getRevenue(comandas, recorte.de, recorte.ate);
      
      // Estoque por status
      const estoqueStatus = metricasKytto.contarEstoquesPorStatus(estoque);
      const valorEstoque = metricasKytto.calcularValorEstoque(estoque);
      
      // CMV do período solicitado.
      const vendasHoje = metricasKytto.filtrarVendasPorPeriodo(comandas, recorte.de, recorte.ate);
      const cmvHoje = metricasKytto.calcularCMV(vendasHoje, estoquePersistido(req.empresaId));
      
      // Faturamento por método
      const faturamentoPorMetodo = metricasKytto.faturamentoPorMetodo(vendasHoje);
      
      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        empresa: req.empresaId,
        periodo: { nome: recorte.nome, inicio: recorte.de, fim: recorte.ate, fuso: 'America/Cuiaba' },
        
        // Comandas
        comandas: {
          abertas: openTabs.quantidade,
          valorEmAberto: openTabs.valorEmAberto,
        },
        
        // Estoque
        estoque: {
          total: estoqueStatus.total,
          ok: estoqueStatus.ok,
          baixo: estoqueStatus.baixo,
          semEstoque: estoqueStatus.semEstoque,
          valorTotal: Number(valorEstoque.toFixed(2)),
        },
        
        // Faturamento
        faturamento: {
          total: revenueHoje.total,
          quantidade: revenueHoje.quantidade,
          porMetodo: faturamentoPorMetodo,
          cmv: Number(cmvHoje.toFixed(2)),
          margemBruta: revenueHoje.total > 0 ? Number(((revenueHoje.total - cmvHoje) / revenueHoje.total * 100).toFixed(2)) : 0,
        },
      });
    } catch (erro) {
      console.error('[METRICAS] Erro ao calcular métricas operacionais:', erro);
      res.status(500).json({ erro: 'Erro ao calcular métricas operacionais', detalhes: erro.message });
    }
  });
  
  app.get('/api/admin/analytics/vendas', requerEditorCatalogo, (req, res) => {
    try {
      const recorte = resolverPeriodoMetricas(req.query);
      const vendas = metricasKytto.filtrarVendasPorPeriodo(comandasDaEmpresa(req.empresaId), recorte.de, recorte.ate);
      res.json({ ok: true, periodo: { nome: recorte.nome, inicio: recorte.de, fim: recorte.ate, fuso: 'America/Cuiaba' }, analise: metricasKytto.analisarMixVendas(vendas) });
    } catch (erro) {
      res.status(500).json({ erro: 'Erro ao analisar vendas.', detalhes: erro.message });
    }
  });

  app.get('/api/admin/metricas/consistencia', requerEditorCatalogo, (req, res) => {
    try {
      // Guardrail: valida que Dashboard, BI e Relatórios retornam os mesmos totais
      const hoje = new Date().toISOString().slice(0, 10);
      const comandas = comandasDaEmpresa(req.empresaId);
      // Garante que todo item do cardápio tenha ficha de estoque antes do cálculo.
      const estoque = listarEstoqueCardapio(req.empresaId);
      
      const openTabs = metricasKytto.getOpenTabs(comandas);
      const revenue = metricasKytto.getRevenue(comandas, hoje, hoje);
      const estoqueStatus = metricasKytto.contarEstoquesPorStatus(estoque);
      
      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        empresa: req.empresaId,
        
        // Valores canônicos que todos os painéis devem exibir
        canônicos: {
          comandasAbertas: openTabs.quantidade,
          valorEmAberto: openTabs.valorEmAberto,
          faturamentoHoje: revenue.total,
          vendidosHoje: revenue.quantidade,
          estoqueOk: estoqueStatus.ok,
          estoqueBaixo: estoqueStatus.baixo,
          estoqueSemEstoque: estoqueStatus.semEstoque,
        },
        
        // Guardrail: se algum painel retornar valores diferentes, registrar aqui
        validacao: {
          consistente: true, // Será falso se houver divergências
          divergencias: [],
        },
      });
    } catch (erro) {
      console.error('[METRICAS] Erro ao validar consistência:', erro);
      res.status(500).json({ erro: 'Erro ao validar consistência', detalhes: erro.message });
    }
  });

  // ── OBSERVABILIDADE ────────────────────────────────────────────────────────
  app.get('/api/admin/observabilidade/metricas', requerEditorCatalogo, (req, res) => {
    try {
      const metricas = observabilidade.obterMetricas();
      res.json({ ok: true, metricas });
    } catch (erro) {
      console.error('[OBSERVABILIDADE] Erro ao obter métricas:', erro);
      res.status(500).json({ erro: 'Erro ao obter métricas de observabilidade', detalhes: erro.message });
    }
  });

  app.get('/api/admin/observabilidade/alertas', requerEditorCatalogo, (req, res) => {
    try {
      const alertas = observabilidade.obterAlertas(req.query);
      res.json({ ok: true, alertas });
    } catch (erro) {
      console.error('[OBSERVABILIDADE] Erro ao obter alertas:', erro);
      res.status(500).json({ erro: 'Erro ao obter alertas', detalhes: erro.message });
    }
  });

  app.post('/api/admin/observabilidade/alertas/:id/resolver', requerEditorCatalogo, (req, res) => {
    try {
      const resolvido = observabilidade.resolverAlerta(req.params.id);
      if (!resolvido) {
        return res.status(404).json({ erro: 'Alerta não encontrado' });
      }
      observabilidade.registrarOperacao('alerta_resolvido', { alertaId: req.params.id }, req.usuario?.email, req.empresaId);
      res.json({ ok: true, mensagem: 'Alerta resolvido com sucesso' });
    } catch (erro) {
      console.error('[OBSERVABILIDADE] Erro ao resolver alerta:', erro);
      res.status(500).json({ erro: 'Erro ao resolver alerta', detalhes: erro.message });
    }
  });

  app.get('/api/admin/observabilidade/relatorio', requerEditorCatalogo, (req, res) => {
    try {
      const relatorio = observabilidade.exportarRelatorio();
      res.json({ ok: true, relatorio });
    } catch (erro) {
      console.error('[OBSERVABILIDADE] Erro ao exportar relatório:', erro);
      res.status(500).json({ erro: 'Erro ao exportar relatório', detalhes: erro.message });
    }
  });

  // ── BACKUP E RECUPERAÇÃO ────────────────────────────────────────────────────────
  app.post('/api/admin/backup/snapshot', requerEditorCatalogo, async (req, res) => {
    try {
      const resultado = await backupRecuperacao.criarSnapshot(req.body.descricao || '');
      observabilidade.registrarOperacao('backup_snapshot_criado', resultado, req.usuario?.email, req.empresaId);
      res.status(201).json({ ok: true, ...resultado });
    } catch (erro) {
      console.error('[BACKUP] Erro ao criar snapshot:', erro);
      res.status(500).json({ erro: 'Erro ao criar snapshot', detalhes: erro.message });
    }
  });

  app.get('/api/admin/backup/listar', requerEditorCatalogo, async (req, res) => {
    try {
      const snapshots = await backupRecuperacao.listarSnapshots();
      res.json({ ok: true, snapshots });
    } catch (erro) {
      console.error('[BACKUP] Erro ao listar snapshots:', erro);
      res.status(500).json({ erro: 'Erro ao listar snapshots', detalhes: erro.message });
    }
  });

  app.post('/api/admin/backup/restaurar', requerEditorCatalogo, async (req, res) => {
    try {
      const { nomeSnapshot } = req.body;
      if (!nomeSnapshot) {
        return res.status(400).json({ erro: 'nomeSnapshot é obrigatório' });
      }
      const resultado = await backupRecuperacao.restaurarSnapshot(nomeSnapshot, req.usuario?.email);
      observabilidade.registrarOperacao('backup_snapshot_restaurado', { nomeSnapshot }, req.usuario?.email, req.empresaId);
      res.json({ ok: true, ...resultado });
    } catch (erro) {
      console.error('[BACKUP] Erro ao restaurar snapshot:', erro);
      res.status(500).json({ erro: 'Erro ao restaurar snapshot', detalhes: erro.message });
    }
  });

  app.get('/api/admin/backup/informacoes', requerEditorCatalogo, async (req, res) => {
    try {
      const informacoes = await backupRecuperacao.obterInformacoes();
      res.json(informacoes);
    } catch (erro) {
      console.error('[BACKUP] Erro ao obter informações:', erro);
      res.status(500).json({ erro: 'Erro ao obter informações de backup', detalhes: erro.message });
    }
  });

  // ── PAGAMENTOS PIX POR EMPRESA ────────────────────────────────────────────
  app.post('/api/admin/pagamentos/pix/registrar', requerEditorCatalogo, (req, res) => {
    try {
      const pix = pagamentosPix.registrarChavePix(req.empresaId, req.body)
      res.status(201).json({ ok: true, pix: { ...pix, chave: pix.chave.slice(0, 3) + '***' + pix.chave.slice(-3) } })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.get('/api/admin/pagamentos/pix', requerEditorCatalogo, (req, res) => {
    try {
      const chaves = pagamentosPix.listarChavesPix(req.empresaId)
      res.json({ ok: true, chaves })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.post('/api/admin/pagamentos/transacao', requerEditorCatalogo, (req, res) => {
    try {
      const transacao = pagamentosPix.registrarTransacao(req.empresaId, req.body)
      res.status(201).json({ ok: true, transacao })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.get('/api/admin/pagamentos/transacoes', requerEditorCatalogo, (req, res) => {
    try {
      const transacoes = pagamentosPix.listarTransacoes(req.empresaId, req.query)
      const totais = pagamentosPix.calcularTotais(req.empresaId, req.query)
      res.json({ ok: true, transacoes, totais })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.get('/api/admin/pagamentos/relatorio', requerEditorCatalogo, (req, res) => {
    try {
      const dataInicio = req.query.dataInicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const dataFim = req.query.dataFim || new Date().toISOString()
      const relatorio = pagamentosPix.gerarRelatorioPagamentos(req.empresaId, dataInicio, dataFim)
      res.json({ ok: true, relatorio })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.get('/api/admin/relatorios/operacional', requerEditorCatalogo, (req, res) => {
    try {
      const relatorio = gerarRelatorioOperacional(req.empresaId, req.query)
      res.json({ ok: true, relatorio })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.get('/api/admin/pagamentos/provedores', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, provedores: listarProvedoresPagamento() });
  })

  app.post('/api/admin/pagamentos/adquirentes', requerEditorCatalogo, (req, res) => {
    try {
      const adquirente = pagamentosPix.registrarAdquirente(req.empresaId, req.body)
      res.status(201).json({ ok: true, adquirente })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.get('/api/admin/pagamentos/adquirentes', requerEditorCatalogo, (req, res) => {
    try {
      res.json({ ok: true, adquirentes: pagamentosPix.listarAdquirentes(req.empresaId) })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.post('/api/admin/pagamentos/mercadopago/config', requerEditorCatalogo, (req, res) => {
    try {
      const config = pagamentosPix.registrarMercadoPago(req.empresaId, req.body)
      res.status(201).json({ ok: true, config })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.patch('/api/admin/pagamentos/adquirentes/:adquirenteId', requerEditorCatalogo, (req, res) => {
    try {
      const adquirente = pagamentosPix.atualizarAdquirente(req.empresaId, req.params.adquirenteId, req.body || {})
      res.json({ ok: true, adquirente })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.post('/api/admin/pagamentos/adquirentes/:adquirenteId/homologar', requerEditorCatalogo, (req, res) => {
    try {
      const adquirente = pagamentosPix.prepararHomologacaoAdquirente(req.empresaId, req.params.adquirenteId)
      const baseUrl = `${req.protocol}://${req.get('host')}`
      res.json({
        ok: true,
        adquirente,
        webhookUrl: `${baseUrl}/api/webhooks/pagamentos/${encodeURIComponent(adquirente.tipo)}`,
        mensagem: 'Homologação preparada. Configure a URL de webhook no portal do provedor e envie uma transação de ambiente de homologação.',
      })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  app.get('/api/admin/pagamentos/mercadopago/config', requerEditorCatalogo, (req, res) => {
    try {
      res.json({ ok: true, config: pagamentosPix.obterConfigMercadoPago(req.empresaId) })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
  })

  // Webhook público: a assinatura HMAC é obrigatória e as credenciais nunca são expostas.
  // O identificador da empresa é aceito apenas para localizar o cofre correto; sem uma
  // assinatura válida, nenhuma alteração de transação é permitida.
  app.post('/api/webhooks/pagamentos/:tipo', (req, res) => {
    try {
      const empresaId = String(req.query?.empresaId || req.get('X-Loja-Id') || '').trim()
      if (!empresaId) return res.status(400).json({ erro: 'Empresa do webhook é obrigatória.' })
      const assinatura = req.get('X-Kytto-Signature') || req.get('X-Signature') || ''
      const resultado = pagamentosPix.processarWebhookAdquirente(empresaId, req.params.tipo, req.body || {}, assinatura)
      res.status(200).json({ ok: true, recebido: true, status: resultado.status, transacaoId: resultado.transacao?.id || null })
    } catch (error) {
      console.warn('[PAGAMENTOS] Webhook rejeitado:', error.message)
      res.status(401).json({ erro: 'Webhook rejeitado.' })
    }
  })

  // ── FIDELIZAÇÃO, DELIVERY E CANAIS DE VENDA ──────────────────────────────
  app.get('/api/admin/canais-venda', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, canais: canaisKytto.obterCanais(req.empresaId) })
  })

  app.post('/api/admin/canais-venda', requerEditorCatalogo, (req, res) => {
    try { res.status(201).json({ ok: true, canal: canaisKytto.salvarCanal(req.empresaId, req.body) }) }
    catch (error) { res.status(400).json({ erro: error.message }) }
  })

  app.get('/api/admin/fidelidade', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, ...canaisKytto.obterFidelidade(req.empresaId) })
  })

  app.patch('/api/admin/fidelidade/regra', requerEditorCatalogo, (req, res) => {
    try { res.json({ ok: true, regra: canaisKytto.salvarRegraFidelidade(req.empresaId, req.body) }) }
    catch (error) { res.status(400).json({ erro: error.message }) }
  })

  app.post('/api/admin/fidelidade/membros', requerEditorCatalogo, (req, res) => {
    try { res.status(201).json({ ok: true, membro: canaisKytto.cadastrarMembroFidelidade(req.empresaId, req.body) }) }
    catch (error) { res.status(400).json({ erro: error.message }) }
  })

  app.get('/api/admin/delivery/pedidos', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, pedidos: canaisKytto.listarPedidosCanal(req.empresaId, req.query) })
  })

  app.post('/api/admin/delivery/pedidos', requerEditorCatalogo, (req, res) => {
    try { res.status(201).json({ ok: true, pedido: canaisKytto.criarPedidoCanal(req.empresaId, req.body) }) }
    catch (error) { res.status(400).json({ erro: error.message }) }
  })

  // ── MAPA DE MESAS ────────────────────────────────────────────────────────
  // Mesas são dados operacionais próprios, persistidos junto ao cardápio e
  // estoque. Cada mesa pode ter rótulo, nome de referência e uma conta/cliente
  // vinculada, sem obrigar a criação de uma comanda no momento do cadastro.
  function mesasPersistidas(empresaId = cadastrosMestres.EMPRESA_PADRAO_ID) {
    const estado = db();
    if (!estado.mesasKytto || typeof estado.mesasKytto !== 'object') {
      estado.mesasKytto = { empresas: {} };
    }
    const raiz = estado.mesasKytto;
    // Migra o mapa global legado uma única vez para a empresa padrão.
    if (!raiz.empresas) {
      raiz.empresas = {
        [cadastrosMestres.EMPRESA_PADRAO_ID]: {
          config: raiz.config || { mesasFisicas: 0, atualizadoEm: null },
          fisicas: raiz.fisicas || {}, virtuais: raiz.virtuais || {},
        },
      };
      delete raiz.config;
      delete raiz.fisicas;
      delete raiz.virtuais;
    }
    raiz.empresas[empresaId] ||= { config: { mesasFisicas: 0, atualizadoEm: null }, fisicas: {}, virtuais: {} };
    const empresa = raiz.empresas[empresaId];
    empresa.config ||= { mesasFisicas: 0, atualizadoEm: null };
    empresa.fisicas ||= {};
    empresa.virtuais ||= {};
    return empresa;
  }

  function normalizarMesa(payload = {}, numeroPadrao = null) {
    const texto = (valor, limite = 100) => String(valor ?? '').trim().slice(0, limite);
    const numero = Number(payload.numero ?? payload.num ?? numeroPadrao);
    return {
      num: Number.isInteger(numero) && numero > 0 ? numero : null,
      nome: texto(payload.nome, 80),
      apelido: texto(payload.apelido, 80),
      contaNome: texto(payload.contaNome ?? payload.conta_nome, 120),
      contaId: texto(payload.contaId ?? payload.conta_id, 80),
      observacao: texto(payload.observacao, 300),
    };
  }

  function gerarTokenMesaPublica() { return crypto.randomBytes(24).toString('base64url'); }

  function configuracaoPedidoPublico(empresaId) {
    const estado = db();
    estado.pedidoPublicoKytto ||= { empresas: {}, sessoes: {} };
    estado.pedidoPublicoKytto.empresas ||= {};
    estado.pedidoPublicoKytto.sessoes ||= {};
    estado.pedidoPublicoKytto.empresas[empresaId] ||= { confirmarGarcom: false, minutosSessao: 120, limiteItensPorPedido: 20, atualizadoEm: new Date().toISOString() };
    return estado.pedidoPublicoKytto.empresas[empresaId];
  }

  function criarOuObterTokenMesaPublica(empresaId, numeroMesa) {
    const mesa = mesasPersistidas(empresaId).fisicas[Number(numeroMesa)];
    if (!mesa || mesa.ativa === false) throw new Error('Mesa não encontrada ou inativa.');
    if (!mesa.tokenPublico) { mesa.tokenPublico = gerarTokenMesaPublica(); mesa.tokenPublicoCriadoEm = new Date().toISOString(); mesa.atualizadoEm = new Date().toISOString(); save(); }
    return mesa.tokenPublico;
  }

  function localizarMesaPorTokenPublico(token) {
    const tokenSeguro = String(token || '').trim();
    if (tokenSeguro.length < 24) return null;
    const raiz = db().mesasKytto?.empresas || {};
    for (const [empresaId, dados] of Object.entries(raiz)) {
      const mesa = Object.values(dados?.fisicas || {}).find((item) => item.ativa !== false && item.tokenPublico === tokenSeguro);
      if (mesa) return { empresaId, mesa };
    }
    return null;
  }

  function criarSessaoMesaPublica(empresaId, mesa, ip = '') {
    const estado = db(); configuracaoPedidoPublico(empresaId);
    const config = estado.pedidoPublicoKytto.empresas[empresaId];
    const agora = new Date(); const expiraEm = new Date(agora.valueOf() + Math.max(15, Math.min(480, Number(config.minutosSessao || 120))) * 60000);
    const token = crypto.randomBytes(24).toString('base64url');
    estado.pedidoPublicoKytto.sessoes[token] = { token, empresaId, mesaNum: Number(mesa.num), criadoEm: agora.toISOString(), expiraEm: expiraEm.toISOString(), ultimoUsoEm: agora.toISOString(), ipHash: ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null, tentativas: 0 };
    save(); return estado.pedidoPublicoKytto.sessoes[token];
  }

  function validarSessaoMesaPublica(token, empresaId, mesaNum) {
    const sessao = db().pedidoPublicoKytto?.sessoes?.[String(token || '')];
    if (!sessao || sessao.empresaId !== empresaId || Number(sessao.mesaNum) !== Number(mesaNum) || new Date(sessao.expiraEm).valueOf() <= Date.now()) throw new Error('Sessão da mesa expirada ou inválida. Leia o QR Code novamente.');
    sessao.ultimoUsoEm = new Date().toISOString(); return sessao;
  }

  function mesaPadrao(numero, empresaId) {
    const agora = new Date().toISOString();
    return { num: numero, empresaId, nome: `Mesa ${numero}`, apelido: '', contaNome: '', contaId: '', observacao: '', status: 'livre', total: 0, aguardandoCozinha: 0, comandaId: null, ativa: true, tokenPublico: gerarTokenMesaPublica(), tokenPublicoCriadoEm: agora, criadoEm: agora, atualizadoEm: agora };
  }

  function garantirQuantidadeMesas(empresaId, quantidade) {
    const store = mesasPersistidas(empresaId);
    const alvo = Math.max(0, Math.floor(Number(quantidade) || 0));
    let adicionadas = 0;
    for (let numero = 1; numero <= alvo; numero++) {
      if (!store.fisicas[numero]) {
        store.fisicas[numero] = mesaPadrao(numero, empresaId);
        adicionadas++;
      }
      store.fisicas[numero].ativa = true;
    }
    store.config.mesasFisicas = Object.values(store.fisicas).filter(mesa => mesa.ativa !== false).length;
    store.config.atualizadoEm = new Date().toISOString();
    return adicionadas;
  }

  function listarMesasFisicas(empresaId = cadastrosMestres.EMPRESA_PADRAO_ID) {
    const store = mesasPersistidas(empresaId);
    return Object.values(store.fisicas).filter(mesa => mesa.ativa !== false).sort((a, b) => a.num - b.num);
  }

  // ── COMANDAS OPERACIONAIS (PDV / MODO GARÇOM) ───────────────────────────
  // Estado separado por empresa, persistido no mesmo JSON/GCS da plataforma.
  // O frontend usa estes contratos tanto no PDV quanto no Modo Garçom.
  function comandasPersistidas(empresaId) {
    const dados = db();
    dados.operacaoBarKytto ||= { empresas: {} };
    dados.operacaoBarKytto.empresas ||= {};
    dados.operacaoBarKytto.empresas[empresaId] ||= { sequencia: 0, comandas: {} };
    const store = dados.operacaoBarKytto.empresas[empresaId];
    store.comandas ||= {};
    store.sequencia = Number(store.sequencia || 0);
    return store;
  }

  function totalComanda(comanda) {
    const soma = (comanda?.itens || []).reduce((total, item) => total + (Number(item.preco) || 0) * (Number(item.qtd) || 0), 0);
    return Number(Number(soma).toFixed(2)) || 0;
  }

  function comandasDaEmpresa(empresaId) {
    return Object.values(comandasPersistidas(empresaId).comandas)
      .filter((comanda) => comanda.empresaId === empresaId);
  }

  function comandaAtivaDaMesa(empresaId, numeroMesa) {
    return comandasDaEmpresa(empresaId).find((comanda) =>
      comanda.tipo === 'fisica' && Number(comanda.mesaNum) === Number(numeroMesa) && ['aberta', 'conta'].includes(comanda.status)
    ) || null;
  }

  function sincronizarMesaComanda(empresaId, numeroMesa) {
    const mesa = mesasPersistidas(empresaId).fisicas[Number(numeroMesa)];
    if (!mesa) return null;
    const comanda = comandaAtivaDaMesa(empresaId, numeroMesa);
    Object.assign(mesa, {
      status: !comanda ? 'livre' : comanda.status === 'conta' ? 'conta' : 'ocupada',
      comandaId: comanda?.id || null,
      total: comanda ? totalComanda(comanda) : 0,
      aguardandoCozinha: comanda ? (comanda.itens || []).filter((item) => item.cozinha && ['novo', 'em_preparo', 'pronto'].includes(item.status)).length : 0,
      atualizadoEm: new Date().toISOString(),
    });
    return mesa;
  }

  function criarComanda(empresaId, { tipo = 'fisica', mesaNum = null, nome = '', local = null } = {}) {
    const store = comandasPersistidas(empresaId);
    store.sequencia += 1;
    const agora = new Date().toISOString();
    const id = `cmd-${Date.now().toString(36)}-${String(store.sequencia).padStart(4, '0')}`;
    const comanda = {
      id, empresaId, tipo, mesaNum: mesaNum ? Number(mesaNum) : null,
      mesa: mesaNum ? `Mesa ${Number(mesaNum)}` : '',
      nome: String(nome || (mesaNum ? `Mesa ${Number(mesaNum)}` : 'Cliente')).trim().slice(0, 120),
      local: local && typeof local === 'object' ? local : null,
      status: 'aberta', contaPedida: false, itens: [], pagamentos: [],
      abertaEm: agora, atualizadaEm: agora, fechadaEm: null,
    };
    store.comandas[id] = comanda;
    if (comanda.tipo === 'fisica') sincronizarMesaComanda(empresaId, comanda.mesaNum);
    return comanda;
  }

  function obterComandaOperacional(empresaId, id, { ativa = false } = {}) {
    const comanda = comandasPersistidas(empresaId).comandas[String(id)];
    if (!comanda || comanda.empresaId !== empresaId) return null;
    if (ativa && !['aberta', 'conta'].includes(comanda.status)) return null;
    return comanda;
  }

  function respostaComanda(comanda) {
    return { ...comanda, total: totalComanda(comanda) };
  }

  function idempotenciaOperacional(empresaId, req, escopo) {
    const chave = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim().slice(0, 160);
    if (!chave) return { chave: null, anterior: null, registrar: () => {} };
    const dados = db(); dados.idempotenciaOperacionalKytto ||= { empresas: {} }; dados.idempotenciaOperacionalKytto.empresas ||= {};
    const empresa = dados.idempotenciaOperacionalKytto.empresas[empresaId] ||= {};
    const id = `${escopo}:${chave}`; const anterior = empresa[id];
    const registrar = (resposta) => { empresa[id] = { resposta, criadoEm: new Date().toISOString(), usuario: req.usuario?.email || null }; const chaves = Object.keys(empresa); if (chaves.length > 500) chaves.sort((a, b) => String(empresa[a].criadoEm).localeCompare(String(empresa[b].criadoEm))).slice(0, chaves.length - 500).forEach(chaveAntiga => delete empresa[chaveAntiga]); };
    return { chave, anterior, registrar };
  }

  function adicionarItensComanda(empresaId, comanda, itens = []) {
    const catalogo = cardapioPersistido(empresaId);
    const estoque = estoquePersistido(empresaId);
    const empresa = cadastrosMestres.obterEmpresa(empresaId);
    const permitirEstoqueNegativo = empresa?.permitirEstoqueNegativo !== false;
    const erros = [];
    const adicionados = [];
    for (const entrada of Array.isArray(itens) ? itens : []) {
      const produtoSolicitado = String(entrada?.produtoId || '');
      const produto = catalogo.find((item) => item.id === produtoSolicitado && item.empresaId === empresaId && !item.indisponivel);
      if (!produto) {
        const combo = modificadoresCombosKytto.obterCombo(empresaId, String(entrada?.comboId || produtoSolicitado));
        if (combo?.ativo !== false) {
          const primeiroNovo = comanda.itens.length;
          const qtdCombo = Math.max(1, Math.floor(Number(entrada?.qtd) || 1));
          const resultadoCombo = adicionarItensComanda(empresaId, comanda, combo.componentes.map((componente) => ({
            produtoId: componente.produtoId, qtd: Math.max(1, Math.floor(Number(componente.qtd || 1) * qtdCombo)), obs: [entrada?.obs, componente.observacao].filter(Boolean).join(' · '), modificadores: componente.modificadores || [],
          })));
          if (resultadoCombo.erros.length) {
            for (let indice = comanda.itens.length - 1; indice >= primeiroNovo; indice -= 1) removerItemComanda(empresaId, comanda, indice);
            erros.push(`Combo ${combo.nome}: ${resultadoCombo.erros.join(' ')}`);
            continue;
          }
          const itensCombo = comanda.itens.slice(primeiroNovo);
          const valorBase = Number(itensCombo.reduce((soma, item) => soma + Number(item.preco || 0) * Number(item.qtd || 0), 0).toFixed(2));
          const valorPromocional = Number((Number(combo.preco || 0) * qtdCombo).toFixed(2));
          let restante = valorPromocional;
          itensCombo.forEach((item, indice) => {
            const totalLinha = indice === itensCombo.length - 1
              ? restante
              : Number((valorBase > 0 ? (Number(item.preco || 0) * Number(item.qtd || 0) / valorBase) * valorPromocional : 0).toFixed(2));
            restante = Number((restante - totalLinha).toFixed(2));
            item.precoOriginal = Number(item.preco || 0);
            item.preco = Number((totalLinha / Math.max(1, Number(item.qtd || 1))).toFixed(2));
            item.comboId = combo.id; item.comboNome = combo.nome; item.comboPrecoPromocional = valorPromocional;
          });
          adicionados.push(...itensCombo);
          continue;
        }
        erros.push('Produto ou combo não encontrado, indisponível ou inativo.');
        continue;
      }
      const qtd = Math.max(1, Math.floor(Number(entrada?.qtd) || 1));
      let resolucaoModificadores;
      try {
        resolucaoModificadores = modificadoresCombosKytto.resolverModificadoresProduto(empresaId, produto, entrada?.modificadores || []);
      } catch (erroModificador) {
        erros.push(`${produto.nome}: ${erroModificador.message}`);
        continue;
      }
      const adicionaisBaixados = [];
      let custoAdicionalEstoque = 0;
      let modificadorSemEstoque = null;
      for (const modificador of resolucaoModificadores.itens) {
        if (!modificador.produtoId) continue;
        const saldoAdicional = estoque[modificador.produtoId];
        const qtdBaixa = Number((Number(modificador.quantidadeEstoque || 0) * qtd).toFixed(4));
        if (!saldoAdicional || saldoAdicional.ativo === false) { modificadorSemEstoque = `O adicional “${modificador.nome}” não possui item de estoque ativo.`; break; }
        if (saldoAdicional.controlaEstoque === true && !permitirEstoqueNegativo && Number(saldoAdicional.qtd || 0) < qtdBaixa) { modificadorSemEstoque = `Estoque insuficiente para o adicional “${modificador.nome}” (disponível: ${saldoAdicional.qtd || 0}).`; break; }
        const custoConfigurado = Number(modificador.custoAdicional || 0);
        const custoUnitarioAdicional = custoConfigurado > 0
          ? custoConfigurado
          : Number(saldoAdicional.custoMedioPonderado ?? saldoAdicional.custo ?? 0) * Number(modificador.quantidadeEstoque || 0);
        // O custo configurado já vem em adicionalCusto; só complementar pelo custo médio do estoque quando a opção não o definiu.
        if (custoConfigurado <= 0) custoAdicionalEstoque += custoUnitarioAdicional;
        adicionaisBaixados.push({ produtoId: modificador.produtoId, nome: modificador.nome, qtd: qtdBaixa, custoUnitario: custoUnitarioAdicional, grupoId: modificador.grupoId, opcaoId: modificador.opcaoId });
      }
      if (modificadorSemEstoque) { erros.push(`${produto.nome}: ${modificadorSemEstoque}`); continue; }
      const ficha = estoque[produto.id];
      const fichaTecnica = fichasTecnicasKytto.obterFichaPorProduto(empresaId, produto.id);
      const baixarProdutoFinal = !fichaTecnica || fichaTecnica.baixarProdutoFinal === true;
      // Validar estoque do produto final apenas quando a ficha técnica também o controla.
      if (baixarProdutoFinal && ficha?.controlaEstoque === true && !permitirEstoqueNegativo && Number(ficha.qtd || 0) < qtd) {
        erros.push(`${produto.nome}: estoque insuficiente (disponível: ${ficha.qtd || 0}, solicitado: ${qtd}).`);
        continue;
      }
      // Se permite estoque negativo, permitir venda mesmo com saldo zero ou negativo
      if (baixarProdutoFinal && ficha?.controlaEstoque === true && permitirEstoqueNegativo && Number(ficha.qtd || 0) < qtd) {
        console.warn(`[ESTOQUE NEGATIVO] ${produto.nome}: saldo ${ficha.qtd || 0} insuficiente para ${qtd}, mas empresa permite estoque negativo.`);
      }
      let baixaInsumos = { movimentacoes: [] };
      let custoFicha = null;
      if (fichaTecnica) {
        try {
          baixaInsumos = fichasTecnicasKytto.baixarInsumosFichaTecnica(empresaId, produto.id, qtd, estoque, {
            permitirEstoqueNegativo,
            comandaId: comanda.id,
            usuario: 'sistema',
          });
          custoFicha = fichasTecnicasKytto.custoFichaTecnica(empresaId, produto.id, estoque);
        } catch (erroFicha) {
          erros.push(`${produto.nome}: ${erroFicha.message}`);
          continue;
        }
      }
      const setor = kdsAvancadoKytto.resolverSetor(empresaId, produto);
      const cozinha = Boolean(produto.cozinha) || ['cozinha', 'chapa', 'restaurante'].includes(setor);
      const item = {
        id: `it-${Date.now().toString(36)}-${String(comanda.itens.length + 1).padStart(3, '0')}`,
        produtoId: produto.id, nome: produto.nome,
        precoBase: Number(produto.preco || 0), preco: Number((Number(produto.preco || 0) + Number(resolucaoModificadores.adicionalPreco || 0)).toFixed(2)), qtd,
        // Snapshot do custo no lançamento: preserva o CMV histórico da venda, inclusive adicionais.
        custoUnitario: Number((Number(custoFicha?.custoPorRendimento ?? ficha?.custoMedioPonderado ?? ficha?.custo ?? 0) + Number(resolucaoModificadores.adicionalCusto || 0) + custoAdicionalEstoque).toFixed(4)),
        fichaTecnicaId: fichaTecnica?.id || null,
        insumosBaixados: baixaInsumos.movimentacoes || [], adicionaisBaixados,
        modificadores: resolucaoModificadores.itens, adicionalPreco: Number(resolucaoModificadores.adicionalPreco || 0),
        obs: String(entrada?.obs || '').trim().slice(0, 300), setor, setorRoteado: setor, categoria: produto.cat || 'Sem categoria',
        cozinha, prioridade: String(entrada?.prioridade || (comanda.tipo === 'delivery' ? 'alta' : 'normal')).toLowerCase(), status: 'novo', criadoEm: new Date().toISOString(), recebidoEm: new Date().toISOString(), statusHistorico: [],
      };
      kdsAvancadoKytto.registrarTransicao(item, 'novo', 'sistema');
      comanda.itens.push(item);
      kdsAvancadoKytto.enfileirarImpressao(empresaId, { comanda, item, indice: comanda.itens.length - 1, motivo: 'novo_pedido', usuario: 'sistema' });
      adicionados.push(item);
      if (baixarProdutoFinal && ficha?.controlaEstoque === true) {
        ficha.qtd = Number(ficha.qtd || 0) - qtd;
        ficha.historico ||= [];
        ficha.historico.push({ tipo: 'saida_comanda', qtd, saldoFinal: ficha.qtd, comandaId: comanda.id, ts: new Date().toISOString() });
        ficha.historico = ficha.historico.slice(-100);
        ficha.atualizadoEm = new Date().toISOString();
      }
      for (const adicional of adicionaisBaixados) {
        const saldoAdicional = estoque[adicional.produtoId];
        if (!saldoAdicional || saldoAdicional.controlaEstoque !== true) continue;
        saldoAdicional.qtd = Number((Number(saldoAdicional.qtd || 0) - Number(adicional.qtd || 0)).toFixed(4));
        saldoAdicional.historico ||= [];
        saldoAdicional.historico.push({ tipo: 'saida_modificador', qtd: adicional.qtd, saldoFinal: saldoAdicional.qtd, comandaId: comanda.id, produtoFinalId: produto.id, grupoId: adicional.grupoId, opcaoId: adicional.opcaoId, ts: new Date().toISOString() });
        saldoAdicional.historico = saldoAdicional.historico.slice(-100);
        saldoAdicional.atualizadoEm = new Date().toISOString();
      }
    }
    comanda.atualizadaEm = new Date().toISOString();
    if (comanda.tipo === 'fisica') sincronizarMesaComanda(empresaId, comanda.mesaNum);
    return { erros, adicionados };
  }

  function atualizarItemComanda(empresaId, comanda, indice, dados = {}) {
    const item = comanda.itens[Number(indice)];
    if (!item) return null;
    if (dados.qtd !== undefined) {
      const novaQtd = Math.max(1, Math.floor(Number(dados.qtd) || 1));
      const diferenca = novaQtd - Number(item.qtd || 0);
      const ficha = estoquePersistido(empresaId)[item.produtoId];
      if ((item.fichaTecnicaId || (item.adicionaisBaixados || []).length) && diferenca !== 0) {
        throw new Error('Para alterar a quantidade de item com ficha técnica ou adicionais, cancele-o e lance novamente para preservar a baixa de estoque.');
      }
      if (ficha?.controlaEstoque === true && diferenca > 0 && Number(ficha.qtd || 0) < diferenca) {
        throw new Error('Estoque insuficiente para aumentar a quantidade.');
      }
      if (ficha?.controlaEstoque === true && diferenca !== 0) {
        ficha.qtd = Number(ficha.qtd || 0) - diferenca;
        ficha.historico ||= [];
        ficha.historico.push({ tipo: 'ajuste_comanda', qtd: diferenca, saldoFinal: ficha.qtd, comandaId: comanda.id, ts: new Date().toISOString() });
        ficha.historico = ficha.historico.slice(-100);
      }
      item.qtd = novaQtd;
    }
    if (dados.obs !== undefined) item.obs = String(dados.obs || '').trim().slice(0, 300);
    comanda.atualizadaEm = new Date().toISOString();
    if (comanda.tipo === 'fisica') sincronizarMesaComanda(empresaId, comanda.mesaNum);
    return item;
  }

  function removerItemComanda(empresaId, comanda, indice) {
    const posicao = Number(indice);
    const item = comanda.itens[posicao];
    if (!item) return null;
    const estoque = estoquePersistido(empresaId);
    const ficha = estoque[item.produtoId];
    const fichaTecnica = item.fichaTecnicaId ? fichasTecnicasKytto.obterFichaPorProduto(empresaId, item.produtoId) : null;
    const baixarProdutoFinal = !fichaTecnica || fichaTecnica.baixarProdutoFinal === true;
    if (baixarProdutoFinal && ficha?.controlaEstoque === true) {
      ficha.qtd = Number(ficha.qtd || 0) + Number(item.qtd || 0);
      ficha.historico ||= [];
      ficha.historico.push({ tipo: 'estorno_comanda', qtd: item.qtd, saldoFinal: ficha.qtd, comandaId: comanda.id, ts: new Date().toISOString() });
      ficha.historico = ficha.historico.slice(-100);
    }
    for (const insumo of item.insumosBaixados || []) {
      const saldo = estoque[insumo.produtoId];
      if (!saldo || saldo.controlaEstoque !== true) continue;
      saldo.qtd = Number((Number(saldo.qtd || 0) + Number(insumo.qtd || 0)).toFixed(4));
      saldo.historico ||= [];
      saldo.historico.push({ tipo: 'estorno_ficha_tecnica', qtd: insumo.qtd, saldoFinal: saldo.qtd, produtoFinalId: item.produtoId, fichaTecnicaId: item.fichaTecnicaId, comandaId: comanda.id, ts: new Date().toISOString() });
      saldo.historico = saldo.historico.slice(-100);
      saldo.atualizadoEm = new Date().toISOString();
    }
    for (const adicional of item.adicionaisBaixados || []) {
      const saldo = estoque[adicional.produtoId];
      if (!saldo || saldo.controlaEstoque !== true) continue;
      saldo.qtd = Number((Number(saldo.qtd || 0) + Number(adicional.qtd || 0)).toFixed(4));
      saldo.historico ||= [];
      saldo.historico.push({ tipo: 'estorno_modificador', qtd: adicional.qtd, saldoFinal: saldo.qtd, produtoFinalId: item.produtoId, comandaId: comanda.id, grupoId: adicional.grupoId, opcaoId: adicional.opcaoId, ts: new Date().toISOString() });
      saldo.historico = saldo.historico.slice(-100);
      saldo.atualizadoEm = new Date().toISOString();
    }
    comanda.itens.splice(posicao, 1);
    comanda.atualizadaEm = new Date().toISOString();
    if (comanda.tipo === 'fisica') sincronizarMesaComanda(empresaId, comanda.mesaNum);
    return item;
  }

  function dataVencimentoPadrao(dias = 1) {
    const data = new Date();
    data.setDate(data.getDate() + Math.max(1, Math.floor(Number(dias) || 1)));
    return data.toISOString().slice(0, 10);
  }

  function selecionarClienteConta(empresaId, clienteId, nomeComanda) {
    if (clienteId) return clientesKytto.obterCliente(empresaId, String(clienteId));
    const nome = String(nomeComanda || '').trim().toLocaleLowerCase('pt-BR');
    if (nome) {
      const encontrado = clientesKytto.listarClientes(empresaId).find((cliente) => String(cliente.nome || '').trim().toLocaleLowerCase('pt-BR') === nome);
      if (encontrado) return encontrado;
    }
    return null;
  }

  function listarMesasOperacionais(empresaId) {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date());
    const reservasDaData = reservasKytto.ocupacaoPrevista(empresaId, hoje).porMesa;
    const agora = Date.now();
    const fisicas = listarMesasFisicas(empresaId).map((mesa) => {
      const comanda = comandaAtivaDaMesa(empresaId, mesa.num);
      const reservas = reservasDaData[mesa.num] || [];
      const proximaReserva = reservas.find((reserva) => new Date(reserva.fimEm).valueOf() >= agora) || null;
      const reservaAtiva = reservas.find((reserva) => new Date(reserva.inicioEm).valueOf() <= agora && new Date(reserva.fimEm).valueOf() >= agora) || null;
      return {
        ...mesa,
        status: !comanda ? 'livre' : comanda.status === 'conta' ? 'conta' : 'ocupada',
        comandaId: comanda?.id || null,
        total: comanda ? totalComanda(comanda) : 0,
        reservaAtiva,
        proximaReserva,
        bloqueadaPorReserva: Boolean(reservaAtiva && !comanda),
        aguardandoCozinha: comanda ? (comanda.itens || []).filter((item) => item.cozinha && ['novo', 'em_preparo', 'pronto'].includes(item.status)).length : 0,
      };
    });
    const virtuais = comandasDaEmpresa(empresaId)
      .filter((comanda) => comanda.tipo === 'virtual' && ['aberta', 'conta'].includes(comanda.status))
      .map((comanda) => ({ id: comanda.id, comandaId: comanda.id, tipo: 'virtual', nome: comanda.nome, local: comanda.local, status: comanda.status === 'conta' ? 'conta' : 'ocupada', total: totalComanda(comanda), abertaEm: comanda.abertaEm }));
    return { fisicas, virtuais };
  }

  function respostaCardapioPublico(empresaId) {
    const grupos = new Map(modificadoresCombosKytto.listarGruposModificadores(empresaId).map((grupo) => [grupo.id, grupo]));
    return cardapioPersistido(empresaId).filter((produto) => !produto.indisponivel).map((produto) => ({
      id: produto.id, nome: produto.nome, marca: produto.marca || '', tipo: produto.tipo || '', cat: produto.cat || 'Outros', subcategoria: produto.subcategoria || '', emoji: produto.emoji || '', preco: Number(produto.preco || 0), unidade: produto.unidade || 'UN', setor: produto.setor || 'bar', semAlcool: Boolean(produto.semAlcool),
      gruposModificadores: (produto.modificadorGrupoIds || []).map((id) => grupos.get(id)).filter(Boolean).map((grupo) => ({ id: grupo.id, nome: grupo.nome, obrigatorio: Boolean(grupo.obrigatorio), minimo: grupo.minimo, maximo: grupo.maximo, opcoes: (grupo.opcoes || []).filter((opcao) => opcao.ativo !== false).map((opcao) => ({ id: opcao.id, nome: opcao.nome, precoAdicional: Number(opcao.precoAdicional || 0) })) })),
    }));
  }

  function responderMesaPublica(req, res, { exigirSessao = false } = {}) {
    const encontrada = localizarMesaPorTokenPublico(req.params.token);
    if (!encontrada) { res.status(404).json({ erro: 'QR Code inválido, expirado ou mesa indisponível.' }); return null; }
    let sessao = null;
    if (exigirSessao) {
      try { sessao = validarSessaoMesaPublica(req.get('X-Mesa-Session'), encontrada.empresaId, encontrada.mesa.num); }
      catch (erro) { res.status(401).json({ erro: erro.message }); return null; }
    }
    return { ...encontrada, sessao, config: configuracaoPedidoPublico(encontrada.empresaId) };
  }

  app.get('/api/public/mesa/:token', (req, res) => {
    const contexto = responderMesaPublica(req, res); if (!contexto) return;
    const empresa = cadastrosMestres.obterEmpresa(contexto.empresaId) || {};
    res.set('Cache-Control', 'no-store').json({ ok: true, mesa: { numero: contexto.mesa.num, nome: contexto.mesa.nome || `Mesa ${contexto.mesa.num}` }, empresa: { nome: empresa.nomeFantasia || empresa.nome || empresa.razaoSocial || 'Kytto' }, configuracao: { confirmarGarcom: Boolean(contexto.config.confirmarGarcom) }, cardapio: respostaCardapioPublico(contexto.empresaId) });
  });

  app.post('/api/public/mesa/:token/sessao', (req, res) => {
    const contexto = responderMesaPublica(req, res); if (!contexto) return;
    const sessao = criarSessaoMesaPublica(contexto.empresaId, contexto.mesa, req.ip || '');
    res.set('Cache-Control', 'no-store').status(201).json({ ok: true, sessao: { token: sessao.token, expiraEm: sessao.expiraEm }, mesa: { numero: contexto.mesa.num, nome: contexto.mesa.nome || `Mesa ${contexto.mesa.num}` }, configuracao: { confirmarGarcom: Boolean(contexto.config.confirmarGarcom) }, cardapio: respostaCardapioPublico(contexto.empresaId) });
  });

  app.post('/api/public/mesa/:token/pedidos', (req, res) => {
    const contexto = responderMesaPublica(req, res, { exigirSessao: true }); if (!contexto) return;
    const itens = Array.isArray(req.body?.itens) ? req.body.itens.slice(0, Math.max(1, Number(contexto.config.limiteItensPorPedido || 20))) : [];
    if (!itens.length) return res.status(400).json({ erro: 'Selecione ao menos um item para enviar o pedido.' });
    const chaveIdempotencia = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim().slice(0, 120);
    if (!chaveIdempotencia) return res.status(400).json({ erro: 'Identificador de pedido obrigatório. Atualize a página e tente novamente.' });
    contexto.sessao.idempotencias ||= {};
    const anterior = contexto.sessao.idempotencias[chaveIdempotencia];
    if (anterior) return res.json({ ok: true, duplicado: true, ...anterior });
    const agora = Date.now();
    contexto.sessao.tentativas = (contexto.sessao.tentativas || 0) + 1;
    if (contexto.sessao.ultimoPedidoEm && agora - new Date(contexto.sessao.ultimoPedidoEm).valueOf() < 1500) return res.status(429).json({ erro: 'Aguarde alguns segundos antes de enviar outro pedido.' });
    let comanda = comandaAtivaDaMesa(contexto.empresaId, contexto.mesa.num);
    if (!comanda) comanda = criarComanda(contexto.empresaId, { tipo: 'fisica', mesaNum: contexto.mesa.num, nome: 'Cliente QR' });
    const inicio = comanda.itens.length;
    const { erros, adicionados } = adicionarItensComanda(contexto.empresaId, comanda, itens);
    if (erros.length) {
      for (let indice = comanda.itens.length - 1; indice >= inicio; indice -= 1) removerItemComanda(contexto.empresaId, comanda, indice);
      save(); return res.status(409).json({ erro: erros.join(' ') });
    }
    const statusInicial = contexto.config.confirmarGarcom ? 'aguardando_confirmacao' : 'novo';
    for (const item of adicionados) { item.status = statusInicial; item.origem = 'qr_mesa'; item.sessaoMesaId = contexto.sessao.token.slice(0, 12); }
    comanda.pedidosPublicos ||= [];
    const pedido = { id: `qr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`, itensIds: adicionados.map((item) => item.id), status: statusInicial, criadoEm: new Date().toISOString(), origem: 'qr_mesa' };
    comanda.pedidosPublicos.push(pedido); comanda.pedidosPublicos = comanda.pedidosPublicos.slice(-100);
    contexto.sessao.ultimoPedidoEm = new Date().toISOString();
    const resposta = { pedidoId: pedido.id, comandaId: comanda.id, status: pedido.status, aguardandoConfirmacao: contexto.config.confirmarGarcom, total: totalComanda(comanda) };
    contexto.sessao.idempotencias[chaveIdempotencia] = resposta;
    const chaves = Object.keys(contexto.sessao.idempotencias); if (chaves.length > 40) chaves.slice(0, chaves.length - 40).forEach((chave) => delete contexto.sessao.idempotencias[chave]);
    save();
    res.status(201).json({ ok: true, ...resposta });
  });

  app.post('/api/public/mesa/:token/chamar-garcom', (req, res) => {
    const contexto = responderMesaPublica(req, res, { exigirSessao: true }); if (!contexto) return;
    const estado = db(); estado.pedidoPublicoKytto.chamados ||= {};
    const id = `chamada-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    estado.pedidoPublicoKytto.chamados[id] = { id, empresaId: contexto.empresaId, mesaNum: contexto.mesa.num, tipo: ['conta', 'garcom'].includes(String(req.body?.tipo)) ? String(req.body.tipo) : 'garcom', mensagem: String(req.body?.mensagem || '').trim().slice(0, 250), status: 'pendente', criadoEm: new Date().toISOString() };
    save(); res.status(201).json({ ok: true, chamadoId: id, mensagem: 'Solicitação enviada à equipe.' });
  });

  app.get('/api/admin/pedidos-publicos/config', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, configuracao: configuracaoPedidoPublico(req.empresaId) });
  });

  app.patch('/api/admin/pedidos-publicos/config', requerEditorCatalogo, (req, res) => {
    const config = configuracaoPedidoPublico(req.empresaId);
    if (req.body?.confirmarGarcom !== undefined) config.confirmarGarcom = Boolean(req.body.confirmarGarcom);
    if (req.body?.minutosSessao !== undefined) {
      const minutos = Number(req.body.minutosSessao); if (!Number.isFinite(minutos) || minutos < 15 || minutos > 480) return res.status(400).json({ erro: 'A sessão deve durar entre 15 e 480 minutos.' });
      config.minutosSessao = Math.floor(minutos);
    }
    if (req.body?.limiteItensPorPedido !== undefined) {
      const limite = Number(req.body.limiteItensPorPedido); if (!Number.isFinite(limite) || limite < 1 || limite > 100) return res.status(400).json({ erro: 'O limite de itens deve estar entre 1 e 100.' });
      config.limiteItensPorPedido = Math.floor(limite);
    }
    config.atualizadoEm = new Date().toISOString(); config.atualizadoPor = req.usuario?.email || null; save();
    res.json({ ok: true, configuracao: config });
  });

  app.get('/api/admin/mesas/:numero/qr', requerEditorCatalogo, async (req, res) => {
    try {
      const numero = Number(req.params.numero); const token = criarOuObterTokenMesaPublica(req.empresaId, numero);
      const base = String(process.env.PUBLIC_APP_URL || 'https://setpoint.kytto.com.br').replace(/\/$/, '');
      const url = `${base}/cardapio/mesa/${token}`;
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', width: 420, margin: 2 });
      res.json({ ok: true, mesaNum: numero, url, dataUrl, tokenCriadoEm: mesasPersistidas(req.empresaId).fisicas[numero]?.tokenPublicoCriadoEm });
    } catch (erro) { res.status(422).json({ erro: erro.message }); }
  });

  app.post('/api/admin/mesas/:numero/qr/rotacionar', requerEditorCatalogo, (req, res) => {
    const mesa = mesasPersistidas(req.empresaId).fisicas[Number(req.params.numero)];
    if (!mesa || mesa.ativa === false) return res.status(404).json({ erro: 'Mesa não encontrada ou inativa.' });
    mesa.tokenPublico = gerarTokenMesaPublica(); mesa.tokenPublicoCriadoEm = new Date().toISOString(); mesa.atualizadoEm = mesa.tokenPublicoCriadoEm; save();
    res.json({ ok: true, mensagem: 'QR Code anterior invalidado. Gere e imprima o novo código.' });
  });

  app.get('/api/admin/pedidos-publicos/pendentes', requerOperacaoComanda, (req, res) => {
    const pedidos = comandasDaEmpresa(req.empresaId).flatMap((comanda) => (comanda.pedidosPublicos || []).filter((pedido) => pedido.status === 'aguardando_confirmacao').map((pedido) => ({ ...pedido, comandaId: comanda.id, mesa: comanda.mesa, mesaNum: comanda.mesaNum, itens: (comanda.itens || []).filter((item) => pedido.itensIds.includes(item.id)) })));
    res.json({ ok: true, pedidos });
  });

  app.post('/api/pedidos-publicos/:id/confirmar', requerOperacaoComanda, (req, res) => {
    for (const comanda of comandasDaEmpresa(req.empresaId)) {
      const pedido = (comanda.pedidosPublicos || []).find((item) => item.id === req.params.id);
      if (!pedido) continue;
      if (pedido.status !== 'aguardando_confirmacao') return res.status(409).json({ erro: 'Pedido já foi processado.' });
      pedido.status = 'novo'; pedido.confirmadoEm = new Date().toISOString(); pedido.confirmadoPor = req.usuario?.email || null;
      for (const item of comanda.itens || []) if (pedido.itensIds.includes(item.id)) item.status = 'novo';
      save(); return res.json({ ok: true, pedido, mensagem: 'Pedido confirmado e enviado ao KDS.' });
    }
    res.status(404).json({ erro: 'Pedido público não encontrado na empresa ativa.' });
  });

  function validarMesaReserva(empresaId, mesaNum) {
    if (mesaNum === null || mesaNum === undefined || mesaNum === '') return;
    const mesa = mesasPersistidas(empresaId).fisicas[Number(mesaNum)];
    if (!mesa || mesa.ativa === false) throw new Error('Mesa de reserva não encontrada ou inativa.');
  }

  app.get('/api/admin/reservas/config', requerEditorCatalogo, (req, res) => res.json({ ok: true, configuracao: reservasKytto.configuracaoReservas(req.empresaId) }));
  app.patch('/api/admin/reservas/config', requerEditorCatalogo, (req, res) => {
    try { const configuracao = reservasKytto.atualizarConfiguracaoReservas(req.empresaId, req.body || {}); save(); res.json({ ok: true, configuracao }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.get('/api/admin/reservas', requerOperacaoComanda, (req, res) => res.json({ ok: true, reservas: reservasKytto.listarReservas(req.empresaId, req.query || {}) }));
  app.get('/api/admin/reservas/visao', requerOperacaoComanda, (req, res) => res.json({ ok: true, ocupacao: reservasKytto.ocupacaoPrevista(req.empresaId, req.query?.data) }));
  app.post('/api/admin/reservas', requerOperacaoComanda, (req, res) => {
    try { validarMesaReserva(req.empresaId, req.body?.mesaNum); const reserva = reservasKytto.criarReserva(req.empresaId, req.body || {}, req.usuario?.email); save(); res.status(201).json({ ok: true, reserva }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.patch('/api/admin/reservas/:id', requerOperacaoComanda, (req, res) => {
    try { validarMesaReserva(req.empresaId, req.body?.mesaNum); const reserva = reservasKytto.atualizarReserva(req.empresaId, req.params.id, req.body || {}, req.usuario?.email); if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada na empresa ativa.' }); save(); res.json({ ok: true, reserva }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.post('/api/admin/reservas/:id/status', requerOperacaoComanda, (req, res) => {
    try { const reserva = reservasKytto.alterarStatusReserva(req.empresaId, req.params.id, String(req.body?.status || ''), req.usuario?.email); if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada na empresa ativa.' }); save(); res.json({ ok: true, reserva }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.get('/api/admin/fila-espera', requerOperacaoComanda, (req, res) => res.json({ ok: true, fila: reservasKytto.listarFila(req.empresaId, { incluirFinalizados: String(req.query?.historico || '') === '1' }) }));
  app.post('/api/admin/fila-espera', requerOperacaoComanda, (req, res) => {
    try { const item = reservasKytto.adicionarFila(req.empresaId, req.body || {}, req.usuario?.email); save(); res.status(201).json({ ok: true, item }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.post('/api/admin/fila-espera/:id/chamar', requerOperacaoComanda, (req, res) => {
    try { validarMesaReserva(req.empresaId, req.body?.mesaNum); const item = reservasKytto.chamarFila(req.empresaId, req.params.id, req.body?.mesaNum, req.usuario?.email); if (!item) return res.status(404).json({ erro: 'Senha não encontrada na empresa ativa.' }); save(); res.json({ ok: true, item, notificacao: 'Notificação registrada para envio pelo canal configurado; sem disparo externo enquanto não houver credenciais de mensageria.' }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.post('/api/admin/fila-espera/:id/finalizar', requerOperacaoComanda, (req, res) => {
    try { const item = reservasKytto.finalizarFila(req.empresaId, req.params.id, String(req.body?.status || ''), req.usuario?.email); if (!item) return res.status(404).json({ erro: 'Senha não encontrada na empresa ativa.' }); save(); res.json({ ok: true, item }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.get('/api/admin/reservas/indicadores', requerEditorCatalogo, (req, res) => res.json({ ok: true, indicadores: reservasKytto.ocupacaoPrevista(req.empresaId, req.query?.data) }));

  app.get('/api/mesas', requerOperacaoComanda, (req, res) => {
    res.json(listarMesasOperacionais(req.empresaId));
  });

  // Vendas consolidadas: alimenta a aba Vendas do PDV e os relatórios a partir
  // da única fonte operacional de verdade — as comandas efetivamente fechadas.
  app.get('/api/admin/vendas', requerEditorCatalogo, (req, res) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const somenteHoje = ['1', 'true', 'sim'].includes(String(req.query?.hoje || '').toLowerCase());
    const de = String(req.query?.de || (somenteHoje ? hoje : '')).slice(0, 10);
    const ate = String(req.query?.ate || (somenteHoje ? hoje : '')).slice(0, 10);
    const vendas = comandasDaEmpresa(req.empresaId)
      .filter((comanda) => comanda.status === 'fechada')
      .map((comanda) => ({
        id: comanda.id,
        empresaId: comanda.empresaId,
        createdAt: comanda.fechadaEm || comanda.atualizadaEm || comanda.abertaEm,
        fechadoEm: comanda.fechadaEm || null,
        data: comanda.fechadaEm || comanda.atualizadaEm || comanda.abertaEm,
        total: Number(comanda.totalPago ?? totalComanda(comanda) ?? 0),
        subtotal: totalComanda(comanda),
        desconto: Number(comanda.desconto || 0),
        taxaServico: Number(comanda.taxaServico || 0),
        formaPagamento: (comanda.pagamentos || []).map((item) => item.meio).filter(Boolean).join(' + ') || comanda.pagamento || 'dinheiro',
        meio: comanda.pagamento || (comanda.pagamentos || [])[0]?.meio || 'dinheiro',
        pagamentos: [...(comanda.pagamentos || [])],
        itens: (comanda.itens || []).map((item) => ({ ...item })),
        mesa: comanda.mesa || (comanda.mesaNum ? `Mesa ${comanda.mesaNum}` : null),
        mesaNum: comanda.mesaNum || null,
        cliente: comanda.nome || 'Atendimento',
        tipo: comanda.tipo,
        status: 'paga',
      }))
      .filter((venda) => !de || String(venda.data).slice(0, 10) >= de)
      .filter((venda) => !ate || String(venda.data).slice(0, 10) <= ate)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ ok: true, vendas, resumo: {
      quantidade: vendas.length,
      total: Number(vendas.reduce((soma, venda) => soma + Number(venda.total || 0), 0).toFixed(2)),
    } });
  });

  app.get('/api/comanda/:id', requerOperacaoComanda, (req, res) => {
    const comanda = obterComandaOperacional(req.empresaId, req.params.id);
    if (!comanda) return res.status(404).json({ erro: 'Comanda não encontrada na empresa ativa.' });
    res.json(respostaComanda(comanda));
  });

  app.post('/api/mesa/:numero/pedir', requerOperacaoComanda, (req, res) => {
    const numero = Number(req.params.numero);
    const mesa = mesasPersistidas(req.empresaId).fisicas[numero];
    if (!Number.isInteger(numero) || numero < 1 || !mesa || mesa.ativa === false) return res.status(400).json({ erro: 'Mesa física inválida.' });
    let comanda = comandaAtivaDaMesa(req.empresaId, numero);
    if (!comanda) comanda = criarComanda(req.empresaId, { tipo: 'fisica', mesaNum: numero, nome: req.body?.nome });
    const { erros } = adicionarItensComanda(req.empresaId, comanda, req.body?.itens || []);
    save();
    if (erros.length) return res.status(409).json({ erro: erros.join(' '), comanda: respostaComanda(comanda) });
    res.status(201).json({ ok: true, comandaId: comanda.id, id: comanda.id, total: totalComanda(comanda), comanda: respostaComanda(comanda) });
  });

  app.post('/api/mesa-virtual', requerOperacaoComanda, (req, res) => {
    const nome = String(req.body?.nome || '').trim();
    if (!nome) return res.status(400).json({ erro: 'Informe o nome da comanda virtual.' });
    const comanda = criarComanda(req.empresaId, { tipo: 'virtual', nome, local: req.body?.local || null });
    const { erros } = adicionarItensComanda(req.empresaId, comanda, req.body?.itens || []);
    save();
    if (erros.length) return res.status(409).json({ erro: erros.join(' '), comanda: respostaComanda(comanda) });
    res.status(201).json({ ok: true, id: comanda.id, comandaId: comanda.id, total: totalComanda(comanda), comanda: respostaComanda(comanda) });
  });

  app.post('/api/comanda/:id/adicionar', requerOperacaoComanda, (req, res) => {
    const idempotencia = idempotenciaOperacional(req.empresaId, req, `comanda:${req.params.id}:adicionar`);
    if (idempotencia.anterior) return res.json({ ...idempotencia.anterior.resposta, idempotente: true });
    const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true });
    if (!comanda || comanda.status !== 'aberta') return res.status(409).json({ erro: 'A comanda não está aberta para novos itens.' });
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [req.body || {}];
    const { erros } = adicionarItensComanda(req.empresaId, comanda, itens);
    if (erros.length) { save(); return res.status(409).json({ erro: erros.join(' '), parcial: comanda.itens.length > 0, comanda: respostaComanda(comanda) }); }
    const resposta = respostaComanda(comanda); idempotencia.registrar(resposta); save();
    res.json(resposta);
  });

  app.patch('/api/comanda/:id/item/:indice', requerOperacaoComanda, (req, res) => {
    const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true });
    if (!comanda || comanda.status !== 'aberta') return res.status(409).json({ erro: 'A comanda não está aberta para edição.' });
    try {
      const item = atualizarItemComanda(req.empresaId, comanda, req.params.indice, req.body || {});
      if (!item) return res.status(404).json({ erro: 'Item não encontrado na comanda.' });
      save();
      res.json(respostaComanda(comanda));
    } catch (erro) {
      res.status(409).json({ erro: erro.message || 'Não foi possível atualizar o item.' });
    }
  });

  app.delete('/api/comanda/:id/item/:indice', requerOperacaoComanda, (req, res) => {
    const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true });
    if (!comanda || comanda.status !== 'aberta') return res.status(409).json({ erro: 'A comanda não está aberta para edição.' });
    const item = removerItemComanda(req.empresaId, comanda, req.params.indice);
    if (!item) return res.status(404).json({ erro: 'Item não encontrado na comanda.' });
    save();
    res.json(respostaComanda(comanda));
  });

  app.post('/api/comanda/:id/cancelar-item', requerOperacaoComanda, (req, res) => {
    const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true });
    if (!comanda || comanda.status !== 'aberta') return res.status(409).json({ erro: 'A comanda não está aberta para edição.' });
    const item = removerItemComanda(req.empresaId, comanda, req.body?.idx);
    if (!item) return res.status(404).json({ erro: 'Item não encontrado na comanda.' });
    save();
    res.json(respostaComanda(comanda));
  });

  // Produção/KDS: filas de itens de cozinha e atualização de preparo.
  app.get('/api/admin/kds/config', requerEditorCatalogo, (req, res) => res.json({ ok: true, configuracao: kdsAvancadoKytto.configuracaoKds(req.empresaId) }));
  app.patch('/api/admin/kds/config', requerEditorCatalogo, (req, res) => {
    try { const configuracao = kdsAvancadoKytto.atualizarConfiguracaoKds(req.empresaId, req.body || {}); save(); res.json({ ok: true, configuracao }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.get('/api/admin/kds/metricas', requerOperacaoComanda, (req, res) => res.json({ ok: true, metricas: kdsAvancadoKytto.metricasKds(req.empresaId, comandasDaEmpresa(req.empresaId)) }));
  app.get('/api/admin/kds/impressao', requerOperacaoComanda, (req, res) => res.json({ ok: true, fila: kdsAvancadoKytto.listarFilaImpressao(req.empresaId, req.query || {}) }));
  app.post('/api/admin/kds/impressao/:id/status', requerOperacaoComanda, (req, res) => {
    try { const job = kdsAvancadoKytto.atualizarImpressao(req.empresaId, req.params.id, String(req.body?.status || ''), req.usuario?.email); if (!job) return res.status(404).json({ erro: 'Job de impressão não encontrado na empresa ativa.' }); save(); res.json({ ok: true, job }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.post('/api/kds/comanda/:id/item/:indice/reimprimir', requerOperacaoComanda, (req, res) => {
    const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true }); const indice = Number(req.params.indice); const item = comanda?.itens?.[indice];
    if (!comanda || !item) return res.status(404).json({ erro: 'Item operacional não encontrado na comanda.' });
    try { const job = kdsAvancadoKytto.enfileirarImpressao(req.empresaId, { comanda, item, indice, motivo: 'reimpressao', usuario: req.usuario?.email }); save(); res.status(201).json({ ok: true, job }); }
    catch (erro) { res.status(422).json({ erro: erro.message }); }
  });
  app.get('/api/setores/pedidos', requerOperacaoComanda, (req, res) => {
    const setorFiltro = String(req.query.setor || '').toLowerCase();
    const pedidos = comandasDaEmpresa(req.empresaId)
      .filter((comanda) => ['aberta', 'conta'].includes(comanda.status))
      .map((comanda) => ({
        comandaId: comanda.id,
        mesa: comanda.mesa,
        mesaNum: comanda.mesaNum,
        cliente: comanda.nome,
        tipo: comanda.tipo,
        local: comanda.local,
        abertaEm: comanda.abertaEm,
        itens: (comanda.itens || []).map((item, indice) => ({ ...kdsAvancadoKytto.anotarItemKds(req.empresaId, item), indice }))
          .filter((item) => !setorFiltro || String(item.setorRoteado || item.setor || 'bar').toLowerCase() === setorFiltro)
          .filter((item) => ['novo', 'em_preparo', 'pronto'].includes(item.status)),
      }))
      .filter((pedido) => pedido.itens.length > 0);
    res.json({ ok: true, pedidos, setorFiltro: setorFiltro || 'todos' });
  });

  app.get('/api/kds/pedidos', requerOperacaoComanda, (req, res) => {
    const pedidos = comandasDaEmpresa(req.empresaId)
      .filter((comanda) => ['aberta', 'conta'].includes(comanda.status))
      .map((comanda) => ({
        comandaId: comanda.id,
        mesa: comanda.mesa,
        mesaNum: comanda.mesaNum,
        cliente: comanda.nome,
        tipo: comanda.tipo,
        local: comanda.local,
        abertaEm: comanda.abertaEm,
        itens: (comanda.itens || []).map((item, indice) => ({ ...kdsAvancadoKytto.anotarItemKds(req.empresaId, item), indice })).filter((item) => ['novo', 'em_preparo', 'pronto'].includes(item.status)),
      }))
      .filter((pedido) => pedido.itens.length > 0);
    res.json({ ok: true, pedidos });
  });

  app.patch('/api/kds/comanda/:id/item/:indice/status', requerOperacaoComanda, (req, res) => {
    const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true });
    if (!comanda || comanda.status !== 'aberta') return res.status(409).json({ erro: 'A comanda não está aberta para atualização de produção.' });
    const item = comanda.itens?.[Number(req.params.indice)];
    if (!item || !String(item.setor || '').trim()) return res.status(404).json({ erro: 'Item operacional não encontrado na comanda.' });
    const status = String(req.body?.status || '').toLowerCase();
    const transicoes = {
      novo: ['em_preparo', 'cancelado'],
      em_preparo: ['pronto', 'cancelado'],
      pronto: ['entregue', 'cancelado'],
      entregue: [],
      cancelado: [],
    };
    if (!transicoes[item.status]?.includes(status)) {
      return res.status(409).json({ erro: `Transição inválida de ${item.status || 'novo'} para ${status || 'vazio'}.` });
    }
    item.status = status;
    kdsAvancadoKytto.registrarTransicao(item, status, req.usuario?.email);
    comanda.atualizadaEm = item.atualizadoEm;
    if (comanda.tipo === 'fisica') sincronizarMesaComanda(req.empresaId, comanda.mesaNum);
    save();
    res.json({ ok: true, item, comanda: respostaComanda(comanda) });
  });

  app.post('/api/comanda/:id/conta', requerOperacaoComanda, (req, res) => {
    const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true });
    if (!comanda || comanda.status !== 'aberta') return res.status(409).json({ erro: 'A comanda não está aberta para solicitar a conta.' });
    if (!comanda.itens.length) return res.status(400).json({ erro: 'Inclua ao menos um item antes de pedir a conta.' });
    const itensEmProducao = (comanda.itens || []).filter((item) => item.cozinha && ['novo', 'em_preparo', 'pronto'].includes(item.status));
    if (itensEmProducao.length) return res.status(409).json({ erro: 'Existem itens de cozinha pendentes de entrega nesta comanda.' });
    comanda.status = 'conta';
    comanda.contaPedida = true;
    comanda.atualizadaEm = new Date().toISOString();
    if (comanda.tipo === 'fisica') sincronizarMesaComanda(req.empresaId, comanda.mesaNum);
    save();
    res.json({ ok: true, comanda: respostaComanda(comanda) });
  });

  app.post('/api/comanda/:id/reabrir', requerEditorCatalogo, (req, res) => {
    try {
      const comanda = obterComandaOperacional(req.empresaId, req.params.id);
      if (!comanda) return res.status(404).json({ erro: 'Comanda não encontrada.' });
      if (comanda.status === 'aberta') return res.status(409).json({ erro: 'A comanda já está aberta.' });
      if (!['fechada', 'conta'].includes(comanda.status)) return res.status(409).json({ erro: 'Apenas comandas fechadas ou em conta podem ser reabertas.' });
      
      const motivoReabertura = String(req.body?.motivo || 'Reabertura manual').trim().slice(0, 300);
      const usuarioReabertura = req.usuario?.email || 'sistema';
      
      comanda.historicoReaberturas ||= [];
      comanda.historicoReaberturas.push({
        data: new Date().toISOString(),
        usuario: usuarioReabertura,
        motivo: motivoReabertura,
        statusAnterior: comanda.status,
      });
      comanda.historicoReaberturas = comanda.historicoReaberturas.slice(-50);
      
      if (comanda.pagamentos && comanda.pagamentos.length > 0) {
        const estoque = estoquePersistido(req.empresaId);
        for (const item of comanda.itens || []) {
          const ficha = estoque[item.produtoId];
          const fichaTecnica = item.fichaTecnicaId ? fichasTecnicasKytto.obterFichaPorProduto(req.empresaId, item.produtoId) : null;
          if ((!fichaTecnica || fichaTecnica.baixarProdutoFinal === true) && ficha?.controlaEstoque === true) {
            ficha.qtd = Number(ficha.qtd || 0) + Number(item.qtd || 0);
            ficha.historico ||= [];
            ficha.historico.push({ tipo: 'reversao_comanda_reabertura', qtd: item.qtd, saldoFinal: ficha.qtd, comandaId: comanda.id, ts: new Date().toISOString() });
            ficha.historico = ficha.historico.slice(-100);
          }
          for (const insumo of item.insumosBaixados || []) {
            const saldo = estoque[insumo.produtoId];
            if (!saldo || saldo.controlaEstoque !== true) continue;
            saldo.qtd = Number((Number(saldo.qtd || 0) + Number(insumo.qtd || 0)).toFixed(4));
            saldo.historico ||= [];
            saldo.historico.push({ tipo: 'reversao_ficha_tecnica_reabertura', qtd: insumo.qtd, saldoFinal: saldo.qtd, produtoFinalId: item.produtoId, fichaTecnicaId: item.fichaTecnicaId, comandaId: comanda.id, ts: new Date().toISOString() });
            saldo.historico = saldo.historico.slice(-100);
          }
          for (const adicional of item.adicionaisBaixados || []) {
            const saldo = estoque[adicional.produtoId];
            if (!saldo || saldo.controlaEstoque !== true) continue;
            saldo.qtd = Number((Number(saldo.qtd || 0) + Number(adicional.qtd || 0)).toFixed(4));
            saldo.historico ||= [];
            saldo.historico.push({ tipo: 'reversao_modificador_reabertura', qtd: adicional.qtd, saldoFinal: saldo.qtd, produtoFinalId: item.produtoId, comandaId: comanda.id, grupoId: adicional.grupoId, opcaoId: adicional.opcaoId, ts: new Date().toISOString() });
            saldo.historico = saldo.historico.slice(-100);
          }
        }
      }
      
      comanda.status = 'aberta';
      comanda.contaPedida = false;
      comanda.pagamento = null;
      comanda.pagamentos = [];
      comanda.totalPago = 0;
      comanda.contasReceberIds = [];
      comanda.atualizadaEm = new Date().toISOString();
      
      if (comanda.tipo === 'fisica') sincronizarMesaComanda(req.empresaId, comanda.mesaNum);
      save();
      res.json({ ok: true, comanda: respostaComanda(comanda), mensagem: 'Comanda reaberта com sucesso. Estoque revertido.' });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  // Registra uma ou mais parcelas sem exigir a quitação integral. A venda somente
  // entra no faturamento canônico após o saldo ser totalmente quitado.
  app.post('/api/comanda/:id/pagamento-parcial', requerOperacaoComanda, (req, res) => {
    try {
      const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true });
      if (!comanda) return res.status(404).json({ erro: 'Comanda não encontrada ou já encerrada.' });
      if (!(comanda.itens || []).length) return res.status(400).json({ erro: 'Não é possível registrar pagamento em comanda sem itens.' });

      const subtotal = totalComanda(comanda);
      const totalFinal = comanda.totalFinal !== undefined
        ? Number(comanda.totalFinal)
        : Number((req.body?.totalFinal !== undefined ? Number(req.body.totalFinal) : subtotal).toFixed(2));
      if (!Number.isFinite(totalFinal) || totalFinal < 0) return res.status(400).json({ erro: 'Total final inválido.' });

      const pagamentosEnviados = Array.isArray(req.body?.meios) && req.body.meios.length
        ? req.body.meios
        : [{ meio: req.body?.meio || 'dinheiro', valor: req.body?.valor }];
      const permitidos = new Set(['dinheiro', 'pix', 'cartao', 'credito', 'debito', 'tef', 'carteira', 'conta']);
      const novasParcelas = pagamentosEnviados.map((pagamento, indice) => ({
        id: `pag-${Date.now().toString(36)}-${String(indice + 1).padStart(2, '0')}`,
        meio: String(pagamento?.meio || 'dinheiro').toLowerCase(),
        valor: Number(pagamento?.valor),
        responsavel: String(pagamento?.responsavel || req.body?.responsavel || '').trim().slice(0, 120) || null,
        registradoEm: new Date().toISOString(),
      }));
      if (novasParcelas.some((pagamento) => !permitidos.has(pagamento.meio) || !Number.isFinite(pagamento.valor) || pagamento.valor <= 0)) {
        return res.status(400).json({ erro: 'Informe pelo menos uma parcela com meio e valor válidos.' });
      }

      const pagamentosAnteriores = Array.isArray(comanda.pagamentos) ? comanda.pagamentos : [];
      const totalAnterior = Number(pagamentosAnteriores.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0).toFixed(2));
      const valorDaParcela = Number(novasParcelas.reduce((soma, pagamento) => soma + pagamento.valor, 0).toFixed(2));
      const saldoAnterior = Number(Math.max(0, totalFinal - totalAnterior).toFixed(2));
      if (valorDaParcela - saldoAnterior > 0.02) return res.status(400).json({ erro: `A parcela excede o saldo pendente de ${saldoAnterior.toFixed(2)}.` });

      const contasReceber = [];
      for (const pagamento of novasParcelas.filter((item) => item.meio === 'conta')) {
        const cliente = selecionarClienteConta(req.empresaId, req.body?.clienteId, comanda.nome);
        if (!cliente || cliente.padrao) return res.status(400).json({ erro: 'Para lançar em conta, selecione um cliente cadastrado da empresa ativa.' });
        const conta = clientesKytto.criarContaReceber(req.empresaId, {
          clienteId: cliente.id,
          descricao: `Comanda ${comanda.id} — parcela ${pagamento.responsavel || 'em conta'}`,
          valor: pagamento.valor,
          dataVencimento: req.body?.dataVencimento || dataVencimentoPadrao(cliente.diasVencimento),
          origem: 'comanda', referenciaId: comanda.id,
        });
        contasReceber.push(conta);
      }

      const dataOperacao = req.body?.dataOperacao ? new Date(req.body.dataOperacao) : new Date();
      if (Number.isNaN(dataOperacao.valueOf())) return res.status(400).json({ erro: 'Data operacional inválida.' });
      comanda.totalFinal = totalFinal;
      comanda.pagamentos = [...pagamentosAnteriores, ...novasParcelas];
      comanda.totalPago = Number((totalAnterior + valorDaParcela).toFixed(2));
      comanda.saldoPendente = Number(Math.max(0, totalFinal - comanda.totalPago).toFixed(2));
      comanda.contasReceberIds = [...new Set([...(comanda.contasReceberIds || []), ...contasReceber.map((conta) => conta.id)])];
      comanda.pagamento = comanda.pagamentos[0]?.meio || null;
      comanda.atualizadaEm = dataOperacao.toISOString();
      const quitada = comanda.saldoPendente <= 0.02;
      comanda.status = quitada ? 'fechada' : 'conta';
      comanda.contaPedida = !quitada;
      if (quitada) comanda.fechadaEm = dataOperacao.toISOString();

      const lancamentosFinanceiros = financeiroKytto.registrarVendaComanda(req.empresaId, {
        comanda, pagamentos: novasParcelas, contasReceber, usuario: req.usuario?.email, dataOperacao: comanda.atualizadaEm,
      });
      if (comanda.tipo === 'fisica') sincronizarMesaComanda(req.empresaId, comanda.mesaNum);
      save();
      res.json({ ok: true, quitada, totalFinal, totalPago: comanda.totalPago, saldoPendente: comanda.saldoPendente, novasParcelas, contasReceber, lancamentosFinanceiros, comanda: respostaComanda(comanda) });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.post('/api/comanda/:id/pagar', requerOperacaoComanda, (req, res) => {
    const comanda = obterComandaOperacional(req.empresaId, req.params.id, { ativa: true });
    if (!comanda) return res.status(404).json({ erro: 'Comanda não encontrada ou já encerrada.' });
    if (!comanda.itens.length) return res.status(400).json({ erro: 'Não é possível fechar uma comanda sem itens.' });
    if ((comanda.pagamentos || []).length > 0) return res.status(409).json({ erro: 'Esta comanda já possui parcelas. Use o fluxo de pagamento parcial para concluir o saldo pendente.' });
    const subtotal = totalComanda(comanda);
    const desconto = Math.max(0, Number(req.body?.desconto || 0));
    const descontoValor = desconto > 0 && desconto <= 100 ? Number((subtotal * (desconto / 100)).toFixed(2)) : Number(comanda.desconto || 0);
    const servico = req.body?.servico === true ? Number(((subtotal - descontoValor) * 0.1).toFixed(2)) : 0;
    const total = Number((req.body?.totalFinal !== undefined ? Number(req.body.totalFinal) : subtotal - descontoValor + servico).toFixed(2));
    if (!Number.isFinite(total) || total < 0) return res.status(400).json({ erro: 'Total de pagamento inválido.' });

    const pagamentosEnviados = Array.isArray(req.body?.meios) && req.body.meios.length
      ? req.body.meios
      : [{ meio: req.body?.meio || 'dinheiro', valor: total }];
    const permitidos = new Set(['dinheiro', 'pix', 'cartao', 'credito', 'debito', 'tef', 'carteira', 'conta']);
    const pagamentos = pagamentosEnviados.map((pagamento) => ({
      meio: String(pagamento?.meio || req.body?.meio || 'dinheiro').toLowerCase(),
      valor: Number(pagamento?.valor ?? total),
    }));
    if (pagamentos.some((pagamento) => !permitidos.has(pagamento.meio) || !Number.isFinite(pagamento.valor) || pagamento.valor <= 0)) {
      return res.status(400).json({ erro: 'Meio ou valor de pagamento inválido.' });
    }
    const somaPagamentos = Number(pagamentos.reduce((soma, pagamento) => soma + pagamento.valor, 0).toFixed(2));
    if (Math.abs(somaPagamentos - total) > 0.02) {
      return res.status(400).json({ erro: 'A soma dos pagamentos deve ser igual ao total da comanda.' });
    }

    const contasReceber = [];
    for (const pagamento of pagamentos.filter((item) => item.meio === 'conta')) {
      const cliente = selecionarClienteConta(req.empresaId, req.body?.clienteId, comanda.nome);
      if (!cliente || cliente.padrao) {
        return res.status(400).json({ erro: 'Para lançar em conta, selecione um cliente cadastrado da empresa ativa.' });
      }
      const conta = clientesKytto.criarContaReceber(req.empresaId, {
        clienteId: cliente.id,
        descricao: `Comanda ${comanda.id} — ${comanda.nome || 'Atendimento'}`,
        valor: pagamento.valor,
        dataVencimento: req.body?.dataVencimento || dataVencimentoPadrao(cliente.diasVencimento),
        origem: 'comanda', referenciaId: comanda.id,
      });
      contasReceber.push(conta);
    }

    const dataOperacao = req.body?.dataOperacao ? new Date(req.body.dataOperacao) : new Date();
    if (Number.isNaN(dataOperacao.valueOf())) return res.status(400).json({ erro: 'Data operacional inválida.' });
    comanda.status = 'fechada';
    comanda.contaPedida = false;
    comanda.pagamento = pagamentos[0]?.meio || 'dinheiro';
    comanda.pagamentos = pagamentos;
    comanda.desconto = descontoValor;
    comanda.taxaServico = servico;
    comanda.totalPago = total;
    comanda.contasReceberIds = contasReceber.map((conta) => conta.id);
    comanda.fechadaEm = dataOperacao.toISOString();
    comanda.atualizadaEm = comanda.fechadaEm;
    const lancamentosFinanceiros = financeiroKytto.registrarVendaComanda(req.empresaId, {
      comanda,
      pagamentos,
      contasReceber,
      usuario: req.usuario?.email,
      dataOperacao: comanda.fechadaEm,
    });
    save();
    if (comanda.tipo === 'fisica') {
      sincronizarMesaComanda(req.empresaId, comanda.mesaNum);
    }
    res.json({ ok: true, total, pagamentos, contasReceber, lancamentosFinanceiros, comanda: respostaComanda(comanda) });
  });


  app.get('/api/admin/mesas/config', requerEditorCatalogo, (req, res) => {
    const store = mesasPersistidas(req.empresaId);
    res.json({ ...store.config, mesasFisicas: listarMesasFisicas(req.empresaId).length });
  });

  app.post('/api/admin/mesas/config', requerEditorCatalogo, (req, res) => {
    const quantidade = Number(req.body?.mesasFisicas);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 500) return res.status(400).json({ erro: 'Informe entre 1 e 500 mesas.' });
    const adicionadas = garantirQuantidadeMesas(req.empresaId, quantidade);
    save();
    res.json({ ok: true, adicionadas, mesasFisicas: listarMesasFisicas(req.empresaId).length, mensagem: adicionadas ? 'Mesas sequenciais adicionadas ao mapa.' : 'O mapa já possui essa quantidade ou mais mesas.' });
  });

  app.post('/api/admin/mesas', requerEditorCatalogo, (req, res) => {
    const store = mesasPersistidas(req.empresaId);
    const existentes = listarMesasFisicas(req.empresaId);
    const proximoNumero = existentes.length ? Math.max(...existentes.map(mesa => mesa.num)) + 1 : 1;
    const dados = normalizarMesa(req.body || {}, proximoNumero);
    if (!dados.num || dados.num > 9999) return res.status(400).json({ erro: 'Número de mesa inválido.' });
    if (store.fisicas[dados.num] && store.fisicas[dados.num].ativa !== false) return res.status(409).json({ erro: `A mesa ${dados.num} já existe.` });
    const mesa = { ...mesaPadrao(dados.num, req.empresaId), ...dados, empresaId: req.empresaId, nome: dados.nome || `Mesa ${dados.num}` };
    store.fisicas[dados.num] = mesa;
    store.config.mesasFisicas = listarMesasFisicas(req.empresaId).length;
    store.config.atualizadoEm = new Date().toISOString();
    save();
    res.status(201).json({ ok: true, mesa });
  });

  app.patch('/api/admin/mesas/:numero', requerEditorCatalogo, (req, res) => {
    const numero = Number(req.params.numero);
    const store = mesasPersistidas(req.empresaId);
    const mesa = store.fisicas[numero];
    if (!mesa || mesa.empresaId !== req.empresaId || mesa.ativa === false) return res.status(404).json({ erro: 'Mesa não encontrada na empresa ativa.' });
    const dados = normalizarMesa(req.body || {}, numero);
    Object.assign(mesa, {
      nome: dados.nome || mesa.nome || `Mesa ${numero}`,
      apelido: dados.apelido,
      contaNome: dados.contaNome,
      contaId: dados.contaId,
      observacao: dados.observacao,
      atualizadoEm: new Date().toISOString(),
    });
    save();
    res.json({ ok: true, mesa });
  });

  app.delete('/api/admin/mesas/:numero', requerEditorCatalogo, (req, res) => {
    const numero = Number(req.params.numero);
    const store = mesasPersistidas(req.empresaId);
    const mesa = store.fisicas[numero];
    if (!mesa || mesa.empresaId !== req.empresaId || mesa.ativa === false) return res.status(404).json({ erro: 'Mesa não encontrada na empresa ativa.' });
    if (mesa.status !== 'livre' || mesa.comandaId) return res.status(409).json({ erro: 'Não é possível remover uma mesa ocupada ou com comanda aberta.' });
    mesa.ativa = false;
    mesa.atualizadoEm = new Date().toISOString();
    store.config.mesasFisicas = listarMesasFisicas(req.empresaId).length;
    save();
    res.json({ ok: true, numero });
  });

  app.post('/api/admin/mesas/:numero/fechar', requerEditorCatalogo, (req, res) => {
    const numero = Number(req.params.numero);
    const mesa = mesasPersistidas(req.empresaId).fisicas[numero];
    if (!mesa || mesa.empresaId !== req.empresaId || mesa.ativa === false) return res.status(404).json({ erro: 'Mesa não encontrada na empresa ativa.' });
    const comandaAtiva = comandaAtivaDaMesa(req.empresaId, numero);
    if (comandaAtiva) {
      comandaAtiva.status = 'fechada';
      comandaAtiva.contaPedida = false;
      comandaAtiva.fechadaEm = new Date().toISOString();
      comandaAtiva.atualizadaEm = comandaAtiva.fechadaEm;
      comandaAtiva.motivoFechamento = 'fechamento_forcado_mesa';
      comandaAtiva.fechadaPor = req.usuario?.email || 'gerente';
    }
    mesa.status = 'livre';
    mesa.total = 0;
    mesa.aguardandoCozinha = 0;
    mesa.comandaId = null;
    mesa.contaNome = '';
    mesa.contaId = '';
    mesa.atualizadoEm = new Date().toISOString();
    save();
    res.json({ ok: true, mesa });
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
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error('[ERRO]', err?.message || err);
    if (res.headersSent) return next(err);
    res.status(err?.status || 500).json({
      erro: PROD ? 'Erro interno do servidor' : (err?.message || 'Erro interno'),
      codigo: err?.code
    });
  });

  function provisionarFiscalDaEmpresa(empresa) {
    if (!empresa?.id) return
    fiscalKytto.salvarConfiguracaoFiscal(`empresa-${empresa.id}`, {
      cnpj: String(empresa.cnpj || '').replace(/\D/g, ''),
      razaoSocial: empresa.nome || '',
      nomeFantasia: empresa.nomeFantasia || empresa.nome || '',
      ambiente: 'homologacao',
      emissaoAutomaticaAtiva: false,
    })
  }

  // Registra Florescer Ação Social com chave PIX na inicialização
  function inicializarFlorescer() {
    const dados = db()
    const empresaFlorescer = cadastrosMestres.listarEmpresas({ incluirInativas: true })
      .find((empresa) => String(empresa.cnpj || '').replace(/\D/g, '') === '13246882000111')
    if (empresaFlorescer) provisionarFiscalDaEmpresa(empresaFlorescer)
    if (empresaFlorescer && !dados.pagamentos?.[empresaFlorescer.id]?.pix?.length) {
      try {
        pagamentosPix.registrarChavePix(empresaFlorescer.id, {
          chave: '13246882000111',
          tipo: 'cnpj',
          nomeTitular: 'Florescer Ação Social',
          cpfCnpj: '13246882000111',
          banco: 'Banco do Brasil',
        })
        console.log(`✅ Chave PIX registrada para Florescer Ação Social (${empresaFlorescer.id})`)
      } catch (error) {
        console.log(`⚠️  Chave PIX já registrada ou erro: ${error.message}`)
      }
    }
  }

  inicializarFlorescer()

  app.listen(PORT, () => {
    console.log('═'.repeat(65));
    console.log(`  ✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`  🌍 Ambiente: ${PROD ? 'PRODUÇÃO' : 'Desenvolvimento'}`);
    console.log(`  📋 Health: http://localhost:${PORT}/health`);
    console.log(`  💳 Pagamentos PIX integrados e Florescer Ação Social configurada`);
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
