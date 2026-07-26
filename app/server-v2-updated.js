/**
 * ============================================================================
 * SERVER PRINCIPAL - ERP MODULAR V2 (ATUALIZADO)
 * ============================================================================
 * Arquivo: server-v2-updated.js
 * Descrição: Express server com TODAS as rotas integradas
 * ============================================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import * as dbPg from './db-pg.js';

// Importar rotas
import authRoutes from './routes/auth.js';
import estoqueRoutes from './routes/estoque.js';
import vendasRoutes from './routes/vendas.js';
import pagamentosRoutes from './routes/pagamentos.js';
import nfceRoutes from './routes/nfce.js';
import caixaRoutes from './routes/caixa.js';
import pdvRoutes from './modules/pdv/routes.js';
import pagamentosModuloRoutes from './modules/pagamentos/routes.js';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * ============================================================================
 * MIDDLEWARES
 * ============================================================================
 */

// Segurança
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use(morgan('combined'));

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({
    erro: 'Erro interno do servidor',
    mensagem: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

/**
 * ============================================================================
 * ROTAS
 * ============================================================================
 */

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await dbPg.healthCheck();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbHealth
    });
  } catch (error) {
    res.status(503).json({
      status: 'erro',
      database: { status: 'erro', message: error.message }
    });
  }
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    nome: 'ERP Modular Brasil',
    versao: '2.0.0',
    status: 'operacional',
    endpoints: {
      autenticacao: '/auth',
      estoque: '/estoque',
      vendas: '/vendas',
      pagamentos: '/pagamentos',
      nfce: '/nfce',
      caixa: '/caixa',
      pdv: '/pdv',
      pagamentos_modulo: '/pagamentos-modulo'
    }
  });
});

// Rotas de autenticação
app.use('/auth', authRoutes);

// Rotas de estoque
app.use('/estoque', estoqueRoutes);

// Rotas de vendas
app.use('/vendas', vendasRoutes);

// Rotas de pagamentos (legacy)
app.use('/pagamentos-legacy', pagamentosRoutes);

// Rotas de NFC-e
app.use('/nfce', nfceRoutes);

// Rotas de caixa (legacy)
app.use('/caixa-legacy', caixaRoutes);

// Rotas de PDV (novo módulo)
app.use('/pdv', pdvRoutes);

// Rotas de pagamentos (novo módulo)
app.use('/pagamentos', pagamentosModuloRoutes);

/**
 * ============================================================================
 * TRATAMENTO DE ERROS 404
 * ============================================================================
 */

app.use((req, res) => {
  res.status(404).json({
    erro: 'Rota não encontrada',
    metodo: req.method,
    caminho: req.path
  });
});

/**
 * ============================================================================
 * INICIALIZAÇÃO DO SERVIDOR
 * ============================================================================
 */

async function iniciarServidor() {
  try {
    // Testar conexão com banco de dados
    console.log('🔌 Testando conexão com PostgreSQL...');
    const dbHealth = await dbPg.healthCheck();
    if (dbHealth.status === 'ok') {
      console.log('✅ Conexão com PostgreSQL estabelecida');
    } else {
      throw new Error('Falha ao conectar ao PostgreSQL');
    }

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🚀 ERP Modular Brasil v2.0.0 - FASE 4 (PDV + PAGAMENTOS)`);
      console.log(`📍 Servidor rodando em http://localhost:${PORT}`);
      console.log(`🔐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`${'='.repeat(70)}\n`);

      console.log('📚 ENDPOINTS DISPONÍVEIS:\n');
      
      console.log('🔐 AUTENTICAÇÃO:');
      console.log('  • POST   /auth/login');
      console.log('  • POST   /auth/logout');
      console.log('  • GET    /auth/me\n');

      console.log('📦 ESTOQUE:');
      console.log('  • GET    /estoque/produtos');
      console.log('  • POST   /estoque/entrada');
      console.log('  • POST   /estoque/saida');
      console.log('  • GET    /estoque/relatorio\n');

      console.log('💰 PDV (NOVO):');
      console.log('  • POST   /pdv/caixa/abrir');
      console.log('  • POST   /pdv/venda/criar');
      console.log('  • POST   /pdv/venda/:venda_id/item');
      console.log('  • POST   /pdv/venda/:venda_id/fechar');
      console.log('  • POST   /pdv/venda/:venda_id/cancelar');
      console.log('  • GET    /pdv/vendas');
      console.log('  • GET    /pdv/venda/:venda_id\n');

      console.log('💳 PAGAMENTOS (NOVO):');
      console.log('  • POST   /pagamentos/processar');
      console.log('  • POST   /pagamentos/:pagamento_id/reembolsar');
      console.log('  • GET    /pagamentos');
      console.log('  • POST   /pagamentos/reconciliar\n');

      console.log('📄 NFC-e:');
      console.log('  • POST   /nfce/emitir');
      console.log('  • POST   /nfce/:id/cancelar');
      console.log('  • GET    /nfce/:id');
      console.log('  • GET    /nfce/relatorio\n');

      console.log('💵 CAIXA (LEGACY):');
      console.log('  • POST   /caixa-legacy/abrir');
      console.log('  • POST   /caixa-legacy/sangria');
      console.log('  • POST   /caixa-legacy/:id/fechar\n');

      console.log(`${'='.repeat(70)}\n`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM recebido, encerrando...');
  await dbPg.closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT recebido, encerrando...');
  await dbPg.closePool();
  process.exit(0);
});

// Iniciar
iniciarServidor();

export default app;
