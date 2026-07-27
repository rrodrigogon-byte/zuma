/**
 * ============================================================================
 * SERVER PRINCIPAL - ERP MODULAR V2
 * ============================================================================
 * Arquivo: server-v2.js
 * Descrição: Express server com todas as rotas integradas
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
import lojasRoutes from './routes/lojas.js';
import pdvOfflineRoutes from './routes/pdv-offline.js';
import fiscalRoutes from './routes/fiscal.js';
import supermercadoRoutes from './routes/supermercado.js';
import omnichannelRoutes from './routes/omnichannel.js';
import analyticsRoutes from './routes/analytics.js';

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

// Body parser. Para webhooks, preserva o corpo original exclusivamente para
// validação criptográfica de assinatura antes de qualquer processamento.
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buffer) => {
    if (req.originalUrl?.includes('/omnichannel/webhooks/')) {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
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
      lojas: '/lojas',
      pdv_offline: '/pdv-offline',
      fiscal: '/fiscal',
      supermercado: '/supermercado',
      omnichannel: '/omnichannel',
      analytics: '/analytics'
    }
  });
});

// Rotas de autenticação
app.use('/auth', authRoutes);

// Rotas de estoque
app.use('/estoque', estoqueRoutes);

// Rotas de vendas
app.use('/vendas', vendasRoutes);

// Rotas de pagamentos
app.use('/pagamentos', pagamentosRoutes);

// Rotas de NFC-e
app.use('/nfce', nfceRoutes);

// Rotas de caixa
app.use('/caixa', caixaRoutes);

// Rotas de lojas e auditoria multiloja
app.use('/lojas', lojasRoutes);

// PDV offline, terminais e periféricos
app.use('/pdv-offline', pdvOfflineRoutes);

// Fiscal nacional, operação comercial e pedidos omnichannel
app.use('/fiscal', fiscalRoutes);
app.use('/supermercado', supermercadoRoutes);
app.use('/omnichannel', omnichannelRoutes);
app.use('/analytics', analyticsRoutes);

// Aliases com prefixo /api preservam a compatibilidade com o frontend Vite
// existente, que faz chamadas relativas a /api/*.
app.use('/api/auth', authRoutes);
app.use('/api/estoque', estoqueRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/pagamentos', pagamentosRoutes);
app.use('/api/nfce', nfceRoutes);
app.use('/api/caixa', caixaRoutes);
app.use('/api/lojas', lojasRoutes);
app.use('/api/pdv-offline', pdvOfflineRoutes);
app.use('/api/fiscal', fiscalRoutes);
app.use('/api/supermercado', supermercadoRoutes);
app.use('/api/omnichannel', omnichannelRoutes);
app.use('/api/analytics', analyticsRoutes);
// Compatibilidade explícita para os painéis administrativos legados.
app.use('/api/admin', analyticsRoutes);
// Compatibilidade da vitrine pública existente: /api/loja/pedido e
// /api/loja/pedido/:codigo são rotas públicas, enquanto o restante continua
// protegido dentro de /api/omnichannel.
app.use('/api', omnichannelRoutes);

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
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 ERP Modular Brasil v2.0.0`);
      console.log(`📍 Servidor rodando em http://localhost:${PORT}`);
      console.log(`🔐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`${'='.repeat(60)}\n`);

      console.log('📚 Endpoints disponíveis:');
      console.log('  • POST   /auth/login');
      console.log('  • POST   /auth/logout');
      console.log('  • GET    /estoque/produtos');
      console.log('  • POST   /estoque/entrada');
      console.log('  • POST   /estoque/saida');
      console.log('  • POST   /vendas/criar');
      console.log('  • POST   /vendas/:id/adicionar-item');
      console.log('  • POST   /vendas/:id/fechar');
      console.log('  • POST   /pagamentos/processar');
      console.log('  • POST   /nfce/emitir');
      console.log('  • POST   /caixa/abrir');
      console.log('  • POST   /caixa/sangria');
      console.log('  • POST   /caixa/:id/fechar');
      console.log('  • GET    /lojas');
      console.log('  • POST   /lojas');
      console.log('  • POST   /pdv-offline/sincronizar');
      console.log('  • POST   /pdv-offline/terminal/heartbeat');
      console.log('  • POST   /fiscal/documento');
      console.log('  • GET    /supermercado/produtos');
      console.log('  • POST   /supermercado/transferencias');
      console.log('  • GET    /omnichannel/pedidos');
      console.log('  • GET    /analytics/resumo');
      console.log('  • POST   /omnichannel/webhooks/:codigoPublico\n');
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
