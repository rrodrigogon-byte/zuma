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
import * as clientesKytto from './clientes-contas-kytto.js';
import * as fiscalKytto from './fiscal-kytto.js';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import * as cadastrosMestres from './cadastros-mestres-kytto.js';
import { pagamentosPix } from './pagamentos-pix-kytto.js';

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
  const espelho = {
    ...usuario,
    senha: usuario.senhaHash || usuario.senha || '',
    tipo: (usuario.roles || [usuario.role || usuario.tipo || 'operador']).includes('admin') ? 'admin' : (usuario.tipo || 'operador'),
    role: usuario.role || (usuario.roles || [])[0] || 'operador',
    ativo: usuario.ativo !== false,
  };
  usuarios.set(String(espelho.email).toLowerCase(), espelho);
  return espelho;
}

// Cria a empresa operacional e a conta administradora padrão apenas na primeira
// inicialização. Nenhuma senha é escrita em log.
function criarAdminPadrao() {
  cadastrosMestres.garantirEmpresaPadrao();
  let usuario = cadastrosMestres.obterUsuarioPorEmail(ADMIN_EMAIL);
  if (!usuario) {
    usuario = cadastrosMestres.criarUsuario(cadastrosMestres.EMPRESA_PADRAO_ID, {
      nome: 'Administrador', email: ADMIN_EMAIL, roles: ['admin', 'gerente-financeiro'],
      platformAdmin: true, senhaHash: hashPassword(ADMIN_TEMP_PASSWORD),
    });
    usuario.empresasAcessiveis = [cadastrosMestres.EMPRESA_PADRAO_ID];
    cadastrosMestres.atualizarUsuario(cadastrosMestres.EMPRESA_PADRAO_ID, usuario.id, { senhaHash: usuario.senhaHash });
    console.log(`✅ Administrador padrão associado à empresa ${cadastrosMestres.EMPRESA_PADRAO_ID}`);
  }
  // Atualiza instalações que já haviam criado o administrador antes da inclusão
  // explícita do papel de administrador da plataforma.
  if (usuario && usuario.platformAdmin !== true && usuario.id && usuario.empresaId) {
    usuario = cadastrosMestres.atualizarUsuario(usuario.empresaId, usuario.id, { platformAdmin: true });
  }
  usuario.empresasAcessiveis ||= [usuario.empresaId || cadastrosMestres.EMPRESA_PADRAO_ID];
  return espelharUsuarioEmMemoria(usuario);
}

// Rota: Login Admin (Painel)
app.post('/api/admin/login', authLimiter, (req, res) => {
  try {
    const { user, pass, senha } = req.body || {};
    const senhaInformada = pass || senha;

    if (!user || !senhaInformada) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const email = String(user).trim().toLowerCase();
    const usuario = usuarios.get(email) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(email));

    if (!usuario || !verificarPassword(senhaInformada, usuario.senhaHash || usuario.senha)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
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
    const papel = usuario.role || ((usuario.roles || []).includes('admin') ? 'admin' : ((usuario.roles || [])[0] || 'operador'));

    res.json({
      token,
      user: { email: usuario.email, nome: usuario.nome, role: papel, empresaId: empresaAtiva.id, roles: usuario.roles || [papel], platformAdmin: usuario.platformAdmin === true },
      role: papel,
      sessao: {
        loja_ativa: { id: empresaAtiva.id, nome: empresaAtiva.nomeFantasia || empresaAtiva.nome, ativa: empresaAtiva.ativa !== false, empresaId: empresaAtiva.id },
        lojas_acessiveis: empresas.map((empresa) => ({ id: empresa.id, nome: empresa.nomeFantasia || empresa.nome, ativa: empresa.ativa !== false, empresaId: empresa.id })),
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

  // Criar a empresa, o usuário administrativo e a conta padrão no escopo correto.
  criarAdminPadrao();
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
      const email = decoded.split(':')[0]?.trim().toLowerCase();
      return email ? usuarios.get(email) || null : null;
    } catch {
      return null;
    }
  }

  function requerEditorCatalogo(req, res, next) {
    const usuario = usuarioDoToken(req) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(
      (() => {
        try { return Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\\s+/i, ''), 'base64').toString('utf8').split(':')[0]; }
        catch { return ''; }
      })()
    ));
    if (!usuario || usuario.ativo === false || (usuario.tipo !== 'admin' && !(usuario.roles || []).includes('admin'))) {
      return res.status(401).json({ erro: 'Autenticação administrativa necessária' });
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

    req.usuario = usuario;
    req.empresaId = empresa.id;
    req.empresa = empresa;
    next();
  }

  // ── FISCAL / CERTIFICADOS A1 ──────────────────────────────────────────────
  // Usa a mesma autenticação administrativa do catálogo e mantém certificados
  // cifrados em objeto dedicado do GCS. Nunca retorna senha, CSC ou arquivo A1.
  const fiscalTenantId = (req) => `empresa-${req.empresaId || cadastrosMestres.EMPRESA_PADRAO_ID}`;
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

  function fichaEstoque(produto, empresaId) {
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
      min: 0,
      custo: 0,
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
      fiscal: payload.fiscal && typeof payload.fiscal === 'object' ? payload.fiscal : undefined,
    };
  }

  app.get('/api/cardapio', (req, res) => {
    const itens = cardapioPersistido(cadastrosMestres.EMPRESA_PADRAO_ID).filter((item) => !item.indisponivel);
    res.json(itens);
  });

  app.get('/api/admin/cardapio', requerEditorCatalogo, (req, res) => {
    res.json(cardapioPersistido(req.empresaId));
  });

  app.get('/api/admin/estoque', requerEditorCatalogo, (req, res) => {
    res.json({ estoque: listarEstoqueCardapio(req.empresaId) });
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
    const ficha = estoquePersistido(req.empresaId)[produtoId];
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
    const itens = listarEstoqueCardapio(req.empresaId);
    res.json({ ok: true, geradoEm: new Date().toISOString(), itens: itens.map(({ id, nome, cat, unidade, qtd, min }) => ({ id, nome, cat, unidade, qtd, min })) });
  });

  app.get('/api/admin/cardapio/catalogo-bebidas', requerEditorCatalogo, (req, res) => {
    const cadastrados = cardapioPersistido(req.empresaId).filter((item) => item.catalogoSeed === 'kytto-bebidas-v1').length;
    res.json({ ...RESUMO_CATALOGO_BEBIDAS, cadastrados, versao: 'kytto-bebidas-v1' });
  });

  app.post('/api/admin/cardapio/catalogo-bebidas', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido(req.empresaId);
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
        empresaId: req.empresaId,
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
      sincronizarEstoqueCardapio(req.empresaId);
      save();
    }
    res.status(201).json({ ok: true, adicionados: adicionados.length, total: itens.length, versao: 'kytto-bebidas-v1' });
  });

  app.get('/api/admin/cardapio/catalogo-espetinhos', requerEditorCatalogo, (req, res) => {
    const cadastrados = cardapioPersistido(req.empresaId).filter((item) => item.catalogoSeed === 'kytto-espetinhos-v1').length;
    res.json({ ...RESUMO_CATALOGO_ESPETINHOS, cadastrados, versao: 'kytto-espetinhos-v1' });
  });

  app.post('/api/admin/cardapio/catalogo-espetinhos', requerEditorCatalogo, (req, res) => {
    const itens = cardapioPersistido(req.empresaId);
    const existentes = new Set(itens.map((item) => String(item.nome || '').toLocaleLowerCase('pt-BR')));
    const agora = new Date().toISOString();
    const adicionados = [];
    for (const produtoBase of CATALOGO_ESPETINHOS_KYTTO) {
      const produto = normalizarProduto(produtoBase);
      const chave = produto.nome.toLocaleLowerCase('pt-BR');
      if (existentes.has(chave)) continue;
      adicionados.push({ ...produto, empresaId: req.empresaId, id: `esp-${Date.now().toString(36)}-${String(itens.length + adicionados.length + 1).padStart(3, '0')}`, ordem: itens.length + adicionados.length + 1, catalogoSeed: 'kytto-espetinhos-v1', criadoEm: agora, atualizadoEm: agora });
      existentes.add(chave);
    }
    if (adicionados.length) {
      itens.push(...adicionados);
      sincronizarEstoqueCardapio(req.empresaId);
      save();
    }
    res.status(201).json({ ok: true, adicionados: adicionados.length, total: itens.length, versao: 'kytto-espetinhos-v1' });
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

  function executarRotinaFinanceiraDiaria(empresaId, origem = 'manual') {
    const alertas = clientesKytto.verificarAlertasVencimento(empresaId);
    const data = dataOperacional();
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
    save();
    return { empresaId, data, alertas, fechamento, fechadoAgora };
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
      save();
      res.status(201).json({ ok: true, conta });
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
      save();
      res.json({ ok: true, conta });
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
      const resultado = executarRotinaFinanceiraDiaria(req.empresaId, 'manual');
      res.status(resultado.fechadoAgora ? 201 : 200).json({ ok: true, fechamento: resultado.fechamento, alertas: resultado.alertas, fechadoAgora: resultado.fechadoAgora });
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

  function requerAdministradorPlataforma(req, res, next) {
    const usuario = usuarioDoToken(req) || espelharUsuarioEmMemoria(cadastrosMestres.obterUsuarioPorEmail(
      (() => {
        try { return Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\\s+/i, ''), 'base64').toString('utf8').split(':')[0]; }
        catch { return ''; }
      })()
    ));
    if (!usuario || usuario.ativo === false || usuario.platformAdmin !== true) {
      return res.status(403).json({ erro: 'Permissão de administração da plataforma necessária.' });
    }
    req.usuario = usuario;
    next();
  }

  // ── CADASTROS MESTRES MULTIENTIDADE ──────────────────────────────────────
  // Funcionários, usuários e fornecedores são registros únicos por empresa e
  // podem ser reutilizados pelos módulos de RH, compras, financeiro e operação.
  app.get('/api/admin/empresa-ativa', requerEditorCatalogo, (req, res) => {
    const acessiveis = cadastrosMestres.empresasDoUsuario(req.usuario).map((empresa) => ({
      id: empresa.id, nome: empresa.nome, nomeFantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj, ativa: empresa.ativa !== false, modulos: empresa.modulos || [],
    }));
    res.json({ ok: true, empresa: req.empresa, empresasAcessiveis: acessiveis });
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

  app.get('/api/admin/usuarios-mestres', requerEditorCatalogo, (req, res) => {
    res.json({ ok: true, usuarios: cadastrosMestres.listarUsuarios(req.empresaId) });
  });

  app.post('/api/admin/usuarios-mestres', requerEditorCatalogo, (req, res) => {
    try {
      const senhaInicial = String(req.body?.senhaInicial || req.body?.senha || '');
      if (senhaInicial.length < 8) return res.status(400).json({ erro: 'A senha inicial deve possuir pelo menos 8 caracteres.' });
      const usuario = cadastrosMestres.criarUsuario(req.empresaId, {
        ...req.body, senhaHash: hashPassword(senhaInicial),
        empresasAcessiveis: [req.empresaId],
      });
      espelharUsuarioEmMemoria(usuario);
      const { senhaHash, ...resposta } = usuario;
      res.status(201).json({ ok: true, usuario: resposta });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/usuarios-mestres/:usuarioId', requerEditorCatalogo, (req, res) => {
    try {
      const payload = { ...req.body };
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

  // ── GESTÃO DE EMPRESAS (SOMENTE ADMINISTRADOR DA PLATAFORMA) ────────────
  app.get('/api/admin/plataforma/empresas', requerAdministradorPlataforma, (req, res) => {
    res.json({ ok: true, empresas: cadastrosMestres.listarEmpresas({ incluirInativas: true }) });
  });

  app.post('/api/admin/plataforma/empresas', requerAdministradorPlataforma, (req, res) => {
    try {
      const empresa = cadastrosMestres.criarEmpresa(req.body || {});
      let administrador = null;
      const dadosAdmin = req.body?.administrador;
      if (dadosAdmin?.email || dadosAdmin?.nome || dadosAdmin?.senhaInicial) {
        const senhaInicial = String(dadosAdmin.senhaInicial || '');
        if (!dadosAdmin?.nome || !dadosAdmin?.email || senhaInicial.length < 8) {
          return res.status(400).json({ erro: 'Para criar o administrador da empresa, informe nome, email e senha inicial com ao menos 8 caracteres.' });
        }
        administrador = cadastrosMestres.criarUsuario(empresa.id, {
          nome: dadosAdmin.nome, email: dadosAdmin.email, telefone: dadosAdmin.telefone || '',
          roles: ['admin', 'gerente'], senhaHash: hashPassword(senhaInicial), empresasAcessiveis: [empresa.id],
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
      res.status(201).json({ ok: true, empresa, administrador: respostaAdmin });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  });

  app.patch('/api/admin/plataforma/empresas/:empresaId', requerAdministradorPlataforma, (req, res) => {
    try {
      const empresa = cadastrosMestres.atualizarEmpresa(req.params.empresaId, req.body || {});
      if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });
      res.json({ ok: true, empresa });
    } catch (error) {
      res.status(400).json({ erro: error.message });
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

  app.get('/api/admin/pagamentos/mercadopago/config', requerEditorCatalogo, (req, res) => {
    try {
      res.json({ ok: true, config: pagamentosPix.obterConfigMercadoPago(req.empresaId) })
    } catch (error) {
      res.status(400).json({ erro: error.message })
    }
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

  function mesaPadrao(numero, empresaId) {
    const agora = new Date().toISOString();
    return { num: numero, empresaId, nome: `Mesa ${numero}`, apelido: '', contaNome: '', contaId: '', observacao: '', status: 'livre', total: 0, aguardandoCozinha: 0, comandaId: null, ativa: true, criadoEm: agora, atualizadoEm: agora };
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

  app.get('/api/mesas', (req, res) => {
    const empresaId = cadastrosMestres.EMPRESA_PADRAO_ID;
    const store = mesasPersistidas(empresaId);
    res.json({ fisicas: listarMesasFisicas(empresaId), virtuais: Object.values(store.virtuais).filter(mesa => mesa.ativa !== false) });
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

  // Registra Florescer Ação Social com chave PIX na inicialização
  function inicializarFlorescer() {
    const dados = db()
    const empresaFlorescer = cadastrosMestres.listarEmpresas({ incluirInativas: true })
      .find((empresa) => String(empresa.cnpj || '').replace(/\D/g, '') === '13246882000111')
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
