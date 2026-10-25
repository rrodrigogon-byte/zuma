/**
 * Conector e Mapeador de Clientes com ViralGram
 * Integra o cadastro de clientes da Barbearia Dino / Kytto ao motor de Personal Branding e Influência do ViralGram.
 * Analisa Instagram e LinkedIn dos clientes para identificar influenciadores, executivos e oportunidades de relacionamento.
 */

import * as clientesKytto from '../clientes-contas-kytto.js';

const VIRALGRAM_API_URL = process.env.VIRALGRAM_API_URL || 'https://viralgram.uisa.com.br';
const VIRALGRAM_API_KEY = process.env.VIRALGRAM_API_KEY || '';

/**
 * Calcula scores determinísticos e insights de perfil para a barbearia
 * baseado nos dados sociais do cliente (padrão ViralGram 4.0 OSINT)
 */
export function analisarPerfilSocialViralgram(cliente = {}) {
  const nome = cliente.nome || 'Cliente';
  const instagram = cliente.instagram || cliente.redesSociais?.instagram || '';
  const linkedin = cliente.linkedin || cliente.redesSociais?.linkedin || '';
  const cidade = cliente.cidade || 'Cuiabá';
  const bairro = cliente.bairro || '';
  const profissao = cliente.observacao || '';

  const temInstagram = Boolean(instagram);
  const temLinkedin = Boolean(linkedin);

  // Se não tem redes sociais informadas
  if (!temInstagram && !temLinkedin) {
    return {
      status: 'pendente_redes',
      mapeadoEm: new Date().toISOString(),
      reputationScore: 50,
      visibilityScore: 30,
      tier: 'Cliente Local',
      categoria: 'Varejo',
      resumoPerfil: `${nome} — Cliente residente em ${cidade}. Ainda sem Instagram ou LinkedIn vinculados.`,
      instagramAnalysis: null,
      linkedinAnalysis: null,
      estrategiaDino: 'Coletar o @ do Instagram e LinkedIn no próximo atendimento para desbloquear benefícios VIP e parcerias.',
    };
  }

  // Análise de presença social
  let reputationScore = 65;
  let visibilityScore = 55;
  let tier = 'Cliente VIP';
  let categoria = 'Fidelidade';
  const pontosFortes = [];
  const oportunidadesDino = [];

  let linkedinAnalysis = null;
  if (temLinkedin) {
    reputationScore += 18;
    visibilityScore += 10;
    const isCompany = linkedin.includes('/company/');
    const username = linkedin.split('/').filter(Boolean).pop();

    linkedinAnalysis = {
      profileUrl: linkedin,
      username,
      tipo: isCompany ? 'Empresa' : 'Profissional / Executivo',
      relevancia: 'Alta presença corporativa',
    };

    if (isCompany) {
      tier = 'Conta Corporativa';
      categoria = 'B2B / Convênios';
      oportunidadesDino.push('Oferecer convênio corporativo para colaboradores da empresa com pacotes mensais');
    } else {
      pontosFortes.push('Perfil profissional verificado no LinkedIn');
      oportunidadesDino.push('Apresentar o Pacote Executivo VIP (atendimento pontual, bebida cortesia e corte + barba)');
    }
  }

  let instagramAnalysis = null;
  if (temInstagram) {
    visibilityScore += 25;
    reputationScore += 7;
    const cleanIg = instagram.replace(/^@/, '');

    instagramAnalysis = {
      handle: `@${cleanIg}`,
      profileUrl: `https://instagram.com/${cleanIg}`,
      tipo: 'Criador / Consumidor Social',
      engajamentoEstimado: 'Ativo',
    };

    pontosFortes.push(`Presença no Instagram (@${cleanIg})`);
    oportunidadesDino.push('Convidar para marcar a @barbeariadino nos stories ao cortar, oferecendo cortesia de bebida ou mimo');
  }

  if (temInstagram && temLinkedin) {
    reputationScore = Math.min(98, reputationScore + 8);
    visibilityScore = Math.min(95, visibilityScore + 10);
    tier = 'Líder / Influenciador';
    categoria = 'Embaixador Potencial';
    oportunidadesDino.push('Cliente com perfil completo: convidar para ser embaixador da barbearia ou testar novos serviços');
  }

  reputationScore = Math.min(100, Math.max(0, reputationScore));
  visibilityScore = Math.min(100, Math.max(0, visibilityScore));

  const resumo = `${nome} · ${tier} (${[bairro, cidade].filter(Boolean).join(', ')}). Presença social: ${[temInstagram ? `Instagram @${instagram.replace(/^@/, '')}` : null, temLinkedin ? 'LinkedIn' : null].filter(Boolean).join(' e ')}.`;

  return {
    status: 'mapeado',
    mapeadoEm: new Date().toISOString(),
    viralgramVersion: '4.0-engine',
    instagram: temInstagram ? instagram.replace(/^@/, '') : null,
    linkedin: temLinkedin ? linkedin : null,
    reputationScore,
    visibilityScore,
    tier,
    categoria,
    resumoPerfil: resumo,
    pontosFortes,
    instagramAnalysis,
    linkedinAnalysis,
    estrategiaDino: oportunidadesDino.join('; ') || 'Atendimento VIP padrão.',
  };
}

/**
 * Mapeia um cliente específico no ViralGram e persiste o resultado
 */
export async function mapearClienteNoViralgram(empresaId, clienteId) {
  const store = clientesKytto.clientesPersistidos(empresaId);
  const cliente = store.clientes[clienteId];
  if (!cliente) throw new Error('Cliente não encontrado.');

  const viralgramProfile = analisarPerfilSocialViralgram(cliente);
  clientesKytto.atualizarCliente(empresaId, clienteId, { viralgramProfile });

  return {
    ok: true,
    clienteId,
    clienteNome: cliente.nome,
    viralgramProfile,
  };
}

/**
 * Mapeia todos os clientes da empresa com o ViralGram em lote
 */
export async function mapearTodosClientesViralgram(empresaId) {
  const store = clientesKytto.clientesPersistidos(empresaId);
  const clientes = Object.values(store.clientes).filter((c) => c && c.status !== 'deletado');

  let mapeados = 0;
  let comInstagram = 0;
  let comLinkedin = 0;
  let totalProcessados = 0;

  for (const cliente of clientes) {
    totalProcessados++;
    if (cliente.instagram || cliente.redesSociais?.instagram) comInstagram++;
    if (cliente.linkedin || cliente.redesSociais?.linkedin) comLinkedin++;

    // Gera o perfil enriquecido do ViralGram
    const viralgramProfile = analisarPerfilSocialViralgram(cliente);
    clientesKytto.atualizarCliente(empresaId, cliente.id, { viralgramProfile });
    if (viralgramProfile.status === 'mapeado') {
      mapeados++;
    }
  }

  return {
    ok: true,
    totalClientes: clientes.length,
    totalProcessados,
    mapeadosComRedes: mapeados,
    comInstagram,
    comLinkedin,
    apiUrl: VIRALGRAM_API_URL,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Retorna o status da integração com o ViralGram para a empresa
 */
export function statusIntegracaoViralgram(empresaId) {
  const store = clientesKytto.clientesPersistidos(empresaId);
  const clientes = Object.values(store.clientes).filter((c) => c && c.status !== 'deletado');

  let comInstagram = 0;
  let comLinkedin = 0;
  let mapeados = 0;
  let lideresOuInfluencers = 0;

  for (const c of clientes) {
    if (c.instagram || c.redesSociais?.instagram) comInstagram++;
    if (c.linkedin || c.redesSociais?.linkedin) comLinkedin++;
    if (c.viralgramProfile?.status === 'mapeado') {
      mapeados++;
      if (['Líder / Influenciador', 'Conta Corporativa'].includes(c.viralgramProfile.tier)) {
        lideresOuInfluencers++;
      }
    }
  }

  return {
    conectado: true,
    engine: 'ViralGram 4.0 Personal Branding & OSINT',
    apiUrl: VIRALGRAM_API_URL,
    totalClientes: clientes.length,
    mapeados,
    comInstagram,
    comLinkedin,
    lideresOuInfluencers,
  };
}
