/**
 * Configuração Central do SetPoint Ultra
 * Sistema SaaS Modular Multi-Tenant
 */

import dotenv from 'dotenv';
dotenv.config();

export const positiveInt = (value, fallback, minimum = 1) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
};

export const config = {
  // ============================================================================
  // AMBIENTE
  // ============================================================================
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // ============================================================================
  // SERVIDOR
  // ============================================================================
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    url: process.env.SERVER_URL || 'http://localhost:3000',
  },

  // ============================================================================
  // BANCO DE DADOS
  // ============================================================================
  database: {
    // PostgreSQL para dados multi-tenant
    postgres: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'setpoint_ultra',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true',
      max: positiveInt(process.env.PG_POOL_MAX, 6, 2),
      idleTimeoutMillis: positiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30000, 10000),
      connectionTimeoutMillis: positiveInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10000, 5000),
    },

    // Redis para cache e sessões
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    },
  },

  // ============================================================================
  // AUTENTICAÇÃO
  // ============================================================================
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      },
    },
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
  },

  // ============================================================================
  // NFC-E (NOTA FISCAL DE CONSUMIDOR ELETRÔNICA)
  // ============================================================================
  nfce: {
    provider: process.env.NFCE_PROVIDER || 'focus', // focus | plugnotas
    focus: {
      apiUrl: 'https://api.focusnfe.com.br/v2',
      apiKey: process.env.FOCUS_API_KEY,
    },
    plugnotas: {
      apiUrl: 'https://api.plugnotas.com.br',
      apiKey: process.env.PLUGNOTAS_API_KEY,
    },
    contingencia: {
      maxRetries: 5,
      retryIntervalSeconds: 30,
      maxOfflineHours: 24,
    },
  },

  // ============================================================================
  // PAGAMENTOS
  // ============================================================================
  payment: {
    // Stone
    stone: {
      apiUrl: process.env.STONE_API_URL || 'https://api.stone.com.br',
      apiKey: process.env.STONE_API_KEY,
      appId: process.env.STONE_APP_ID,
    },

    // Cielo
    cielo: {
      apiUrl: process.env.CIELO_API_URL || 'https://api.cieloecommerce.cielo.com.br',
      merchantId: process.env.CIELO_MERCHANT_ID,
      merchantKey: process.env.CIELO_MERCHANT_KEY,
    },

    // PagBank
    pagbank: {
      apiUrl: process.env.PAGBANK_API_URL || 'https://api.pagbank.com.br',
      token: process.env.PAGBANK_TOKEN,
    },

    // Mercado Pago
    mercadopago: {
      apiUrl: 'https://api.mercadopago.com',
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    },

    // Pix
    pix: {
      chavePixPrincipal: process.env.PIX_CHAVE_PRINCIPAL,
      chavePixSecundaria: process.env.PIX_CHAVE_SECUNDARIA,
      qrCodeExpireSeconds: 3600, // 1 hora
    },

    // Configurações gerais
    fees: {
      creditCard: 0.0299, // 2,99%
      debitCard: 0.0099, // 0,99%
      pix: 0.0099, // 0,99%
      fixedFee: 0.30, // R$ 0,30
    },
  },

  // ============================================================================
  // CLOUD STORAGE
  // ============================================================================
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'gcs', // gcs | s3 | local
    gcs: {
      projectId: process.env.GCP_PROJECT_ID || 'avd-uisa-sistema-vision',
      bucket: process.env.GCS_BUCKET || 'setpoint-ultra-storage',
      keyFile: process.env.GCS_KEY_FILE,
    },
    s3: {
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    local: {
      path: process.env.LOCAL_STORAGE_PATH || './storage',
    },
  },

  // ============================================================================
  // MÓDULOS
  // ============================================================================
  modules: {
    // Módulos disponíveis na plataforma
    available: [
      'core',      // Obrigatório
      'bar',       // Bar/Restaurante
      'loja',      // Loja/Varejo
      'barbearia', // Barbearia/Salão
      'supermercado', // Supermercado
      'clube',     // Clube/Associação
      'restaurante', // Restaurante
    ],

    // Preços dos módulos (em centavos)
    pricing: {
      core: 9900,        // R$ 99,00
      bar: 14900,        // R$ 149,00
      loja: 12900,       // R$ 129,00
      barbearia: 9900,   // R$ 99,00
      supermercado: 19900, // R$ 199,00
      clube: 14900,      // R$ 149,00
      restaurante: 17900, // R$ 179,00
    },

    // Configurações por módulo
    config: {
      bar: {
        maxMesas: 50,
        maxComandas: 1000,
        impressoraTipo: 'termica', // termica | jato
      },
      loja: {
        maxCaixas: 10,
        maxProdutos: 10000,
      },
      barbearia: {
        maxProfissionais: 20,
        maxAgendamentos: 500,
      },
      supermercado: {
        maxCaixosAutoatendimento: 20,
        maxProdutos: 50000,
      },
    },
  },

  // ============================================================================
  // FATURAMENTO E ASSINATURA
  // ============================================================================
  billing: {
    provider: process.env.BILLING_PROVIDER || 'stripe', // stripe | mercadopago
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    mercadopago: {
      accessToken: process.env.MERCADOPAGO_BILLING_TOKEN,
    },
    // Ciclo de faturamento
    billingCycle: 'monthly', // monthly | annual
    billingDayOfMonth: 1,
    // Tentativas de cobrança
    retryPolicy: {
      maxRetries: 3,
      retryIntervalDays: 3,
    },
  },

  // ============================================================================
  // EMAIL E NOTIFICAÇÕES
  // ============================================================================
  email: {
    provider: process.env.EMAIL_PROVIDER || 'sendgrid', // sendgrid | resend | smtp
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.EMAIL_FROM || 'noreply@setpoint.com.br',
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM || 'noreply@setpoint.com.br',
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      fromEmail: process.env.EMAIL_FROM || 'noreply@setpoint.com.br',
    },
  },

  // ============================================================================
  // SMS E WHATSAPP
  // ============================================================================
  messaging: {
    sms: {
      provider: process.env.SMS_PROVIDER || 'twilio', // twilio | aws-sns
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
      },
    },
    whatsapp: {
      provider: process.env.WHATSAPP_PROVIDER || 'evolution', // evolution | meta
      evolution: {
        apiUrl: process.env.EVOLUTION_API_URL,
        apiKey: process.env.EVOLUTION_API_KEY,
      },
      meta: {
        apiUrl: 'https://graph.instagram.com',
        accessToken: process.env.META_ACCESS_TOKEN,
        phoneNumberId: process.env.META_PHONE_NUMBER_ID,
      },
    },
  },

  // ============================================================================
  // LOGGING E MONITORAMENTO
  // ============================================================================
  logging: {
    level: process.env.LOG_LEVEL || 'info', // debug | info | warn | error
    format: process.env.LOG_FORMAT || 'json', // json | text
    provider: process.env.LOG_PROVIDER || 'gcp', // gcp | datadog | splunk | local
    gcp: {
      projectId: process.env.GCP_PROJECT_ID,
    },
  },

  // ============================================================================
  // SEGURANÇA
  // ============================================================================
  security: {
    // CORS
    cors: {
      origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
      credentials: true,
    },

    // Rate Limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      maxRequests: 100,
      keyGenerator: (req) => req.user?.id || req.ip,
    },

    // HTTPS
    https: {
      enabled: process.env.HTTPS_ENABLED === 'true',
      redirectHttp: process.env.HTTPS_REDIRECT_HTTP === 'true',
    },

    // Helmet (headers de segurança)
    helmet: {
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: true,
      dnsPrefetchControl: true,
      frameguard: true,
      hidePoweredBy: true,
      hsts: true,
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: true,
      xssFilter: true,
    },
  },

  // ============================================================================
  // COMPLIANCE E REGULAMENTAÇÃO
  // ============================================================================
  compliance: {
    // LGPD (Lei Geral de Proteção de Dados)
    lgpd: {
      enabled: true,
      dataRetentionDays: 365,
      anonymizeAfterDays: 730,
    },

    // PCI-DSS (Payment Card Industry Data Security Standard)
    pciDss: {
      enabled: true,
      encryptionAlgorithm: 'aes-256-gcm',
    },

    // NFC-e compliance
    nfceCompliance: {
      enabled: true,
      validateCertificate: true,
      validateCSC: true,
    },
  },

  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================
  features: {
    offlineMode: process.env.FEATURE_OFFLINE_MODE === 'true',
    mobileApp: process.env.FEATURE_MOBILE_APP === 'true',
    aiInsights: process.env.FEATURE_AI_INSIGHTS === 'true',
    whatsappAi: process.env.FEATURE_WHATSAPP_AI === 'true',
    advancedReporting: process.env.FEATURE_ADVANCED_REPORTING === 'true',
    apiMarketplace: process.env.FEATURE_API_MARKETPLACE === 'true',
    customModules: process.env.FEATURE_CUSTOM_MODULES === 'true',
  },

  // ============================================================================
  // INTEGRAÇÕES EXTERNAS
  // ============================================================================
  integrations: {
    // Google Cloud
    gcp: {
      projectId: process.env.GCP_PROJECT_ID || 'avd-uisa-sistema-vision',
      region: process.env.GCP_REGION || 'us-central1',
    },

    // Gemini AI
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
    },

    // ERP connectors
    erp: {
      totvs: {
        enabled: process.env.ERP_TOTVS_ENABLED === 'true',
        apiUrl: process.env.ERP_TOTVS_API_URL,
        apiKey: process.env.ERP_TOTVS_API_KEY,
      },
      sap: {
        enabled: process.env.ERP_SAP_ENABLED === 'true',
        apiUrl: process.env.ERP_SAP_API_URL,
        apiKey: process.env.ERP_SAP_API_KEY,
      },
    },
  },

  // ============================================================================
  // DESENVOLVIMENTO
  // ============================================================================
  development: {
    seedDatabase: process.env.SEED_DATABASE === 'true',
    mockPayments: process.env.MOCK_PAYMENTS === 'true',
    mockNfce: process.env.MOCK_NFCE === 'true',
    debugSQL: process.env.DEBUG_SQL === 'true',
  },
};

export default config;
