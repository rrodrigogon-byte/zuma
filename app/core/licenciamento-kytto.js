/**
 * Módulo de Licenciamento Criptográfico & Gestão de Instâncias Multi-Business
 * Suporte a arquitetura híbrida: SaaS (Nuvem Gerenciada) e On-Premise (Private Cloud / Bare Metal)
 * 
 * Kytto ERP - Arquitetura Multi-Tenant & Multi-Business
 */

import crypto from 'crypto';
import { db, save } from '../db.js';

// Chave mestra interna para assinatura de licenças Kytto Sovereign
const KYTTO_LICENSE_SECRET = process.env.KYTTO_LICENSE_SECRET || process.env.JWT_SECRET || 'kytto-enterprise-sovereign-license-secret-2026';
const DEPLOYMENT_MODE = process.env.KYTTO_DEPLOYMENT_MODE || process.env.DEPLOYMENT_MODE || 'saas'; // 'saas' ou 'on-premise'

export const PLANOS_CATALOGO = {
  starter: {
    id: 'starter',
    nome: 'Kytto Starter',
    descricao: 'Ideal para lojas individuais e barbearias de até 3 profissionais',
    limites: {
      maxInstanciasWhatsapp: 1,
      maxLojasUnidades: 1,
      maxTerminaisPdv: 2,
      maxUsuariosAtivos: 5,
      maxAiTokensMes: 500000
    },
    modulos: ['pdv_comandas', 'agenda', 'fiscal_basico', 'waha_gateway']
  },
  professional: {
    id: 'professional',
    nome: 'Kytto Professional',
    descricao: 'Completo para empresas em crescimento, com DRE Gerencial, CRM e IA T-Rex',
    limites: {
      maxInstanciasWhatsapp: 3,
      maxLojasUnidades: 3,
      maxTerminaisPdv: 5,
      maxUsuariosAtivos: 20,
      maxAiTokensMes: 2500000
    },
    modulos: ['pdv_comandas', 'agenda', 'fiscal_completo', 'dre_financeiro', 'crm_360', 'ia_atendente', 'estoque_fichas', 'waha_gateway']
  },
  enterprise: {
    id: 'enterprise',
    nome: 'Kytto Enterprise Multi-Business',
    descricao: 'Para redes, franquias e holdings com consolidação multiempresa, IA Advisor e integrações',
    limites: {
      maxInstanciasWhatsapp: 10,
      maxLojasUnidades: 15,
      maxTerminaisPdv: 20,
      maxUsuariosAtivos: 100,
      maxAiTokensMes: 10000000
    },
    modulos: ['pdv_comandas', 'agenda', 'fiscal_completo', 'dre_financeiro', 'crm_360', 'ia_atendente', 'ia_advisor', 'estoque_fichas', 'omnichannel', 'event_bus', 'waha_gateway', 'holding_consolidacao']
  },
  on_premise_sovereign: {
    id: 'on_premise_sovereign',
    nome: 'Kytto Sovereign On-Premise',
    descricao: 'Instalação local auto-hospedada em datacenter do cliente, conformidade total LGPD e offline-first',
    limites: {
      maxInstanciasWhatsapp: 50,
      maxLojasUnidades: 50,
      maxTerminaisPdv: 100,
      maxUsuariosAtivos: 500,
      maxAiTokensMes: 50000000
    },
    modulos: ['pdv_comandas', 'agenda', 'fiscal_completo', 'dre_financeiro', 'crm_360', 'ia_atendente', 'ia_advisor', 'estoque_fichas', 'omnichannel', 'event_bus', 'waha_gateway', 'holding_consolidacao', 'backup_local']
  }
};

/**
 * Assina digitalmente um payload de licença gerando uma chave portátil.
 */
export function gerarChaveLicenca(dados) {
  const payload = {
    empresaId: dados.empresaId,
    clienteNome: dados.clienteNome || 'Cliente Licenciado Kytto',
    cnpj: dados.cnpj || '',
    tipoDeploy: dados.tipoDeploy || (DEPLOYMENT_MODE === 'on-premise' ? 'on_premise' : 'saas'),
    plano: dados.plano || 'professional',
    limites: dados.limites || PLANOS_CATALOGO[dados.plano]?.limites || PLANOS_CATALOGO.professional.limites,
    modulos: dados.modulos || PLANOS_CATALOGO[dados.plano]?.modulos || PLANOS_CATALOGO.professional.modulos,
    validoAte: dados.validoAte || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    hardwareFingerprint: dados.hardwareFingerprint || null,
    emitidoEm: new Date().toISOString(),
    emissor: 'Kytto Global Authority'
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', KYTTO_LICENSE_SECRET).update(payloadB64).digest('hex');
  const chave = `KYTTO-LIC.${payloadB64}.${hmac.slice(0, 32)}`;
  return { chave, payload };
}

/**
 * Valida a integridade, assinatura e validade temporal de uma chave de licença.
 */
export function verificarChaveLicenca(chave) {
  if (!chave || typeof chave !== 'string' || !chave.startsWith('KYTTO-LIC.')) {
    return { valido: false, motivo: 'Formato de chave inválido. Deve iniciar com KYTTO-LIC.' };
  }

  const partes = chave.split('.');
  if (partes.length !== 3) {
    return { valido: false, motivo: 'Chave corrompida ou incompleta.' };
  }

  const [, payloadB64, hashAssinatura] = partes;
  let payload;
  try {
    const raw = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(raw);
  } catch (err) {
    return { valido: false, motivo: 'Payload de licença ilegível ou inválido.' };
  }

  const hmacEsperado = crypto.createHmac('sha256', KYTTO_LICENSE_SECRET).update(payloadB64).digest('hex').slice(0, 32);
  if (hmacEsperado !== hashAssinatura) {
    return { valido: false, motivo: 'Assinatura digital inválida. Chave adulterada.' };
  }

  const agora = Date.now();
  const expira = new Date(payload.validoAte).getTime();
  if (isNaN(expira) || agora > expira) {
    return { valido: false, motivo: `Licença expirada em ${payload.validoAte}.`, payload, expirada: true };
  }

  return { valido: true, payload };
}

/**
 * Retorna o repositório persistente de licenciamento no banco Kytto.
 */
function getStore() {
  const store = db();
  if (!store.kyttoLicenciamento) {
    store.kyttoLicenciamento = {
      modoDeploy: DEPLOYMENT_MODE,
      licencasPorEmpresa: {},
      instanciasRegistradas: {}
    };
  }
  return store.kyttoLicenciamento;
}

/**
 * Obtém os dados e status da licença para uma empresa específica.
 */
export function obterStatusLicenca(empresaId) {
  const store = getStore();
  const registro = store.licencasPorEmpresa[empresaId];

  // Caso não tenha licença customizada registrada, gera plano padrão do ambiente
  if (!registro) {
    const planoPadrao = DEPLOYMENT_MODE === 'on-premise' ? 'on_premise_sovereign' : 'professional';
    const configPlano = PLANOS_CATALOGO[planoPadrao];
    return {
      empresaId,
      modoDeploy: DEPLOYMENT_MODE,
      plano: configPlano.id,
      planoNome: configPlano.nome,
      status: 'ativo_padrao',
      limites: configPlano.limites,
      modulosAtivos: configPlano.modulos,
      validoAte: '2028-12-31T23:59:59.000Z',
      diasRestantes: 780,
      origem: 'padrao_sistema'
    };
  }

  const validacao = verificarChaveLicenca(registro.chave);
  const diasRestantes = registro.payload?.validoAte 
    ? Math.max(0, Math.ceil((new Date(registro.payload.validoAte).getTime() - Date.now()) / (24 * 3600 * 1000)))
    : 365;

  return {
    empresaId,
    modoDeploy: registro.payload?.tipoDeploy || DEPLOYMENT_MODE,
    plano: registro.payload?.plano || 'professional',
    planoNome: PLANOS_CATALOGO[registro.payload?.plano]?.nome || 'Personalizado',
    status: validacao.valido ? 'ativa' : (validacao.expirada ? 'expirada' : 'invalida'),
    motivo: validacao.motivo || null,
    limites: registro.payload?.limites || PLANOS_CATALOGO.professional.limites,
    modulosAtivos: registro.payload?.modulos || PLANOS_CATALOGO.professional.modulos,
    validoAte: registro.payload?.validoAte,
    diasRestantes,
    clienteNome: registro.payload?.clienteNome,
    cnpj: registro.payload?.cnpj,
    chaveMascarada: registro.chave ? `${registro.chave.slice(0, 16)}...${registro.chave.slice(-8)}` : null,
    origem: 'chave_licenciada'
  };
}

/**
 * Registra ou ativa uma nova chave de licença para uma empresa.
 */
export function ativarChaveLicenca(empresaId, chave) {
  const validacao = verificarChaveLicenca(chave);
  if (!validacao.valido) {
    throw new Error(`Falha na validação da licença: ${validacao.motivo}`);
  }

  const store = getStore();
  store.licencasPorEmpresa[empresaId] = {
    chave,
    payload: validacao.payload,
    ativadoEm: new Date().toISOString()
  };
  save();

  return obterStatusLicenca(empresaId);
}

/**
 * Consulta e lista todas as instâncias em uso para uma empresa (WhatsApp, Lojas, PDVs, Usuários).
 */
export function obterUsoInstancias(empresaId) {
  const store = db();
  const licenca = obterStatusLicenca(empresaId);

  // Instâncias de WhatsApp
  const conexoesWpp = store.whatsappConexaoKytto?.empresas?.[empresaId] || {};
  const instanciasWpp = Object.values(conexoesWpp).map(c => ({
    id: c.instance || c.id || 'wpp-1',
    tipo: 'whatsapp',
    finalidade: c.finalidade || 'atendimento',
    status: c.status || 'conectado',
    telefone: c.phone || 'Configurado'
  }));

  // Lojas / Unidades
  const lojas = store.lojas?.filter(l => l.empresaId === empresaId || l.empresa_id === empresaId) || [];
  const instanciasLojas = lojas.map(l => ({
    id: l.id,
    tipo: 'loja_unidade',
    nome: l.nome || 'Unidade Principal',
    status: l.ativo !== false ? 'ativa' : 'inativa'
  }));

  // Usuários do tenant
  const usuarios = store.usuarios?.filter(u => u.empresaId === empresaId || u.empresa_id === empresaId) || [];
  
  // Terminais de PDV
  const pdvs = store.pdvTerminais?.filter(p => p.empresaId === empresaId) || [];

  return {
    empresaId,
    licenca: {
      plano: licenca.plano,
      planoNome: licenca.planoNome,
      modoDeploy: licenca.modoDeploy
    },
    cotas: {
      whatsapp: {
        usado: Math.max(1, instanciasWpp.length),
        limite: licenca.limites?.maxInstanciasWhatsapp || 3,
        disponivel: Math.max(0, (licenca.limites?.maxInstanciasWhatsapp || 3) - Math.max(1, instanciasWpp.length))
      },
      lojas: {
        usado: Math.max(1, instanciasLojas.length),
        limite: licenca.limites?.maxLojasUnidades || 3,
        disponivel: Math.max(0, (licenca.limites?.maxLojasUnidades || 3) - Math.max(1, instanciasLojas.length))
      },
      pdv: {
        usado: Math.max(1, pdvs.length),
        limite: licenca.limites?.maxTerminaisPdv || 5,
        disponivel: Math.max(0, (licenca.limites?.maxTerminaisPdv || 5) - Math.max(1, pdvs.length))
      },
      usuarios: {
        usado: Math.max(1, usuarios.length),
        limite: licenca.limites?.maxUsuariosAtivos || 20,
        disponivel: Math.max(0, (licenca.limites?.maxUsuariosAtivos || 20) - Math.max(1, usuarios.length))
      }
    },
    instancias: [
      ...instanciasWpp,
      ...instanciasLojas
    ]
  };
}
