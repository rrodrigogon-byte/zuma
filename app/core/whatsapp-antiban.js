/**
 * Core: Proteção Antiban & Cadência Humanizada para WhatsApp
 * SetPoint Ultra / Kytto — Barbearia Dino
 *
 * Pilares de Proteção contra Bloqueio e Banimento pela Meta:
 * 1. Spintax e Hash Uniqueness: Nenhuma mensagem sai com texto ou hash idênticos.
 * 2. Cadência Humanizada com Jitter: Intervalo aleatório de 18s a 45s entre contatos distintos.
 * 3. Cooldown de Lote: Pausa de respiro de 2 a 4 minutos a cada 10-15 envios.
 * 4. Aquecimento de Chip (Warm-up): Tetos progressivos diários para chips novos e reconectados.
 * 5. Opt-Out Explícito e Obrigatório: Rodapé claro ("Para não receber, responda SAIR") e bloqueio imediato.
 * 6. Janela Segura de Horário: Disparos ativos somente das 09h00 às 19h30, seg a sáb.
 * 7. Simulação de Digitação Humana: Composing proporcional ao tamanho do texto.
 */

import { db, save } from '../db.js';
import { isWhatsappOptOutText } from './whatsapp-phone.js';
import { verificarStatusBarbeiroDino } from './barbershop-agenda.js';

// Fuso horário operacional da Barbearia Dino (Cuiabá / MT)
export const TIMEZONE_PADRAO = 'America/Cuiaba';

// Estágios de aquecimento de chip e cotas diárias recomendadas
export const ESTAGIOS_AQUECIMENTO = {
  novo: {
    nome: 'Aquecimento Inicial (Dias 1 a 3)',
    limiteDiario: 30,
    intervaloMinSec: 25,
    intervaloMaxSec: 55,
    cooldownACada: 8,
    cooldownPausaSec: 240, // 4 minutos
  },
  intermediario: {
    nome: 'Aquecimento Intermediário (Dias 4 a 7)',
    limiteDiario: 60,
    intervaloMinSec: 20,
    intervaloMaxSec: 45,
    cooldownACada: 12,
    cooldownPausaSec: 180, // 3 minutos
  },
  estabilizado: {
    nome: 'Estabilizado (Dias 8 a 14)',
    limiteDiario: 120,
    intervaloMinSec: 15,
    intervaloMaxSec: 35,
    cooldownACada: 15,
    cooldownPausaSec: 120, // 2 minutos
  },
  maduro: {
    nome: 'Maduro (> 14 dias)',
    limiteDiario: 200,
    intervaloMinSec: 12,
    intervaloMaxSec: 30,
    cooldownACada: 20,
    cooldownPausaSec: 90,
  },
};

/**
 * Resolve Spintax aninhado no formato: {Olá|Oi|Opa|E aí}
 * Garante que cada mensagem gerada tenha variações textuais únicas,
 * eliminando a assinatura de hash idêntica de spam nos filtros da Meta.
 */
export function processarSpintax(texto = '', rng = Math.random) {
  if (typeof texto !== 'string' || !texto.includes('{')) {
    return String(texto || '');
  }

  let resultado = texto;
  const regex = /\{([^{}]+)\}/g;

  while (regex.test(resultado)) {
    resultado = resultado.replace(regex, (_, opcoes) => {
      const lista = opcoes.split('|');
      const idx = Math.floor(rng() * lista.length);
      return lista[idx] !== undefined ? lista[idx] : lista[0];
    });
  }

  return resultado;
}

/**
 * Resolve o barbeiro, o slug do link de agendamento online e o tom de voz da mensagem.
 * Permite direcionar para o barbeiro habitual de cada cliente (dinâmico),
 * para a equipe geral da barbearia (neutro) ou para um barbeiro específico.
 */
export function resolverDadosBarbeiroCampanha({
  comQuemAgendar = 'habitual',
  profissionalFixo = '',
  vozRemetente = 'institucional',
  cliente = {},
  empresaSlug = 'dino',
} = {}) {
  const modo = ['habitual', 'equipe', 'especifico'].includes(comQuemAgendar) ? comQuemAgendar : 'habitual';
  const voz = ['institucional', 'pessoal'].includes(vozRemetente) ? vozRemetente : 'institucional';
  const slugEmpresa = empresaSlug || 'dino';

  const mapaBarbeiros = {
    dino: { slug: 'dino', apelido: 'Dino', artigo: 'o', genero: 'm' },
    bruno: { slug: 'bruno', apelido: 'Bruno', artigo: 'o', genero: 'm' },
    nati: { slug: 'nati', apelido: 'Nati', artigo: 'a', genero: 'f' },
  };

  function normalizarSlug(str) {
    if (!str) return '';
    const s = String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (s.includes('nati') || s.includes('naty') || s.includes('natani') || s.includes('dobler')) return 'nati';
    if (s.includes('bruno') || s.includes('mendes')) return 'bruno';
    if (s.includes('dino') || s.includes('guilherme')) return 'dino';
    return '';
  }

  // 1. Modo Equipe da Barbearia (Geral / Neutro)
  if (modo === 'equipe') {
    return {
      modo: 'equipe',
      barbeiroSlug: '',
      nomeExibicao: '{a nossa equipe de especialistas|a equipe da Barbearia Dino|um dos nossos profissionais}',
      comigoOuComProfissional: '{com a nossa equipe de especialistas|com a equipe da Barbearia Dino|com um dos nossos profissionais}',
      linkAgendamento: `https://kytto.com.br/agendar/${slugEmpresa}`,
      vozEfetiva: 'institucional',
      saudacaoVoz: '{Aqui é da Barbearia Dino! 💈|Uma mensagem rápida aqui da Barbearia Dino! 💈}',
      ehPessoal: false,
    };
  }

  // 2. Modo Específico (campanha de um barbeiro específico)
  if (modo === 'especifico') {
    const slug = normalizarSlug(profissionalFixo) || 'dino';
    const b = mapaBarbeiros[slug] || { slug, apelido: profissionalFixo || 'Dino', artigo: 'o', genero: 'm' };
    const nomeComArtigo = `${b.artigo} ${b.apelido}`;
    const link = `https://kytto.com.br/agendar/${slugEmpresa}/${b.slug}`;

    if (voz === 'pessoal') {
      return {
        modo: 'especifico',
        barbeiroSlug: b.slug,
        nomeExibicao: b.apelido,
        comigoOuComProfissional: 'comigo',
        linkAgendamento: link,
        vozEfetiva: 'pessoal',
        saudacaoVoz: `{Aqui é ${nomeComArtigo} da Barbearia Dino! 💈|Aqui é ${nomeComArtigo} falando da Barbearia Dino! 💈}`,
        ehPessoal: true,
      };
    }

    return {
      modo: 'especifico',
      barbeiroSlug: b.slug,
      nomeExibicao: nomeComArtigo,
      comigoOuComProfissional: `com ${nomeComArtigo}`,
      linkAgendamento: link,
      vozEfetiva: 'institucional',
      saudacaoVoz: '{Aqui é da Barbearia Dino! 💈|Passando aqui da Barbearia Dino! 💈}',
      ehPessoal: false,
    };
  }

  // 3. Modo Habitual (dinâmico por cliente)
  const profOrig = cliente.profissionalPreferido || cliente.profissional || '';
  const statusProf = verificarStatusBarbeiroDino(profOrig);
  const slugHabitual = normalizarSlug(profOrig || statusProf.nomeExibicao);

  if (statusProf.ativo && slugHabitual && mapaBarbeiros[slugHabitual]) {
    const b = mapaBarbeiros[slugHabitual];
    const nomeComArtigo = `${b.artigo} ${b.apelido}`;
    const link = `https://kytto.com.br/agendar/${slugEmpresa}/${b.slug}`;

    if (voz === 'pessoal') {
      return {
        modo: 'habitual',
        barbeiroSlug: b.slug,
        nomeExibicao: b.apelido,
        comigoOuComProfissional: 'comigo',
        linkAgendamento: link,
        vozEfetiva: 'pessoal',
        saudacaoVoz: `{Aqui é ${nomeComArtigo} da Barbearia Dino! 💈|${nomeComArtigo} da Barbearia Dino passando por aqui! 💈}`,
        ehPessoal: true,
      };
    }

    return {
      modo: 'habitual',
      barbeiroSlug: b.slug,
      nomeExibicao: nomeComArtigo,
      comigoOuComProfissional: `com ${nomeComArtigo}`,
      linkAgendamento: link,
      vozEfetiva: 'institucional',
      saudacaoVoz: '{Aqui é da Barbearia Dino! 💈|Passando para dar um alô da Barbearia Dino! 💈}',
      ehPessoal: false,
    };
  }

  // Caso o cliente não tenha preferência ou o barbeiro habitual tenha saído (ex-barbeiro)
  return {
    modo: 'habitual',
    barbeiroSlug: '',
    nomeExibicao: '{um dos nossos barbeiros especialistas|a nossa equipe da Barbearia Dino|um dos nossos profissionais (como o Bruno ou a Nati)}',
    comigoOuComProfissional: '{com um dos nossos barbeiros especialistas|com a equipe da Barbearia Dino|com um dos nossos profissionais (como o Bruno ou a Nati)}',
    linkAgendamento: `https://kytto.com.br/agendar/${slugEmpresa}`,
    vozEfetiva: 'institucional',
    saudacaoVoz: '{Aqui é da Barbearia Dino! 💈|Uma mensagem rápida aqui da Barbearia Dino! 💈}',
    ehPessoal: false,
  };
}

 /**
  * Gera mensagem humanizada com variação de Spintax e rodapé de opt-out.
  */
 export function gerarMensagemHumanizadaDino({
   template = '',
   cliente = {},
   profissional = '',
   modelo = '',
   link = '',
   incluirOptOut = true,
   rng = Math.random,
   comQuemAgendar = 'habitual',
   profissionalFixo = '',
   vozRemetente = 'institucional',
   incluirLinkAgendamento = true,
   empresaSlug = 'dino',
 }) {
   const dadosBarbeiro = resolverDadosBarbeiroCampanha({
     comQuemAgendar,
     profissionalFixo,
     vozRemetente,
     cliente: { ...cliente, profissionalPreferido: profissional || cliente.profissionalPreferido },
     empresaSlug,
   });

   const nomeCompleto = String(cliente.nome || 'Cliente').trim();
   const primeiroNome = nomeCompleto.split(' ')[0] || 'Cliente';
   const linkEfetivo = link || dadosBarbeiro.linkAgendamento;
 
   // Se nenhum template foi fornecido, usamos um gerador padrão com rico Spintax
   let baseTemplate = template;
   if (!baseTemplate) {
     const saudacaoAbertura = '{Olá|Oi|Opa|E aí} {Nome}! {Tudo bem?|Como vai?|Tudo certo por aí?}';
     const identificacaoRemetente = dadosBarbeiro.saudacaoVoz;
     const faltaTexto = '{Sentimos sua falta por aqui!|Notamos que faz um tempinho que você não vem dar aquele trato no visual com a gente.|Faz alguns dias que você não renova o corte conosco.}';
 
     let corpoModelo = '';
     if (modelo === 'essencial') {
       corpoModelo = '{Estruturamos nosso atendimento com a opção Essencial — com valores super acessíveis para manter o estilo em dia com máxima praticidade.|Estamos com o corte Essencial por um valor bem acessível, perfeito para renovar o visual no dia a dia com a qualidade de sempre.}';
     } else if (modelo === 'premium') {
       corpoModelo = '{Preparamos uma experiência completa no atendimento Premium, com todo o conforto, cerveja gelada e o padrão de excelência que você merece.|Queremos te convidar para o atendimento Premium, com corte impecável, barboterapia e o cuidado VIP de sempre.}';
     } else if (modelo === 'club') {
       corpoModelo = '{Estamos com novidades especiais para retorno dos clientes Club, com condições imperdíveis para você manter o visual sempre alinhado com a melhor economia.|Preparamos uma condição exclusiva de retorno do Club para você voltar a aproveitar cortes ilimitados com o melhor custo-benefício.}';
     } else {
       corpoModelo = '{Estamos com a agenda aberta e horários excelentes para esta semana.|Que tal aproveitar esses dias para dar aquele talento no corte e na barba?}';
     }
 
     const perguntaAgendamento = dadosBarbeiro.ehPessoal
       ? '{Podemos reservar um horário comigo essa semana?|Que tal marcar seu corte ou barba comigo nesses próximos dias?|Bora dar aquele trato no visual comigo essa semana?}'
       : `{Podemos reservar um horário especial ${dadosBarbeiro.comigoOuComProfissional} essa semana?|Que tal marcar seu horário ${dadosBarbeiro.comigoOuComProfissional} para esses próximos dias?|Gostaria de garantir seu horário ${dadosBarbeiro.comigoOuComProfissional} essa semana?}`;
 
     let blocoLink = '';
     if (incluirLinkAgendamento) {
       blocoLink = '\n\n{Você pode escolher seu serviço e horário livre direto pelo link abaixo:\n{Link Agendamento}|Agende direto pelo link com total praticidade:\n{Link Agendamento}|Para agendar sozinho direto pelo link:\n{Link Agendamento}}' +
         '\n\n{Ou se preferir, pode me responder por aqui com o dia que fica melhor pra você!|Ou se preferir, é só me responder aqui que eu vejo um horário bom pra você!}';
     } else {
       blocoLink = '\n\n{Me avisa por aqui qual dia e período fica melhor pra você!|É só me responder aqui que já vejo um horário excelente pra você!}';
     }
 
     baseTemplate = `${saudacaoAbertura}\n\n${identificacaoRemetente}\n${faltaTexto}\n\n${corpoModelo}\n\n${perguntaAgendamento}${blocoLink}`;
   }
 
   // Substitui variáveis conhecidas
   let textoFinal = baseTemplate
     .replace(/\{Nome do Cliente\}|\{Nome\}/g, primeiroNome)
     .replace(/\{Nome Completo\}/g, nomeCompleto)
     .replace(/\{Profissional\}/g, dadosBarbeiro.nomeExibicao)
     .replace(/\{Ultima Visita\}/g, cliente.ultimaVisita ? new Date(cliente.ultimaVisita).toLocaleDateString('pt-BR') : 'recente')
     .replace(/\{Dias Sem Vir\}/g, String(cliente.diasSemVir || ''))
     .replace(/\{Link Agendamento\}/g, linkEfetivo);
 
   // Aplica o motor de Spintax para que a mensagem gerada seja única
   textoFinal = processarSpintax(textoFinal, rng).trim();
 
   // Se o link foi solicitado mas o template customizado não contém o link gerado, adiciona no final
   if (incluirLinkAgendamento && !textoFinal.includes(linkEfetivo) && !textoFinal.includes('http')) {
     const ctaLink = processarSpintax(
       `\n\n{Agende online direto pelo link:\n${linkEfetivo}|Você também pode agendar direto pelo link:\n${linkEfetivo}}`,
       rng
     );
     textoFinal += ctaLink;
   }
 
  // Adiciona rodapé amigável de Opt-Out (diretriz obrigatória da Meta)
  if (incluirOptOut && !textoFinal.toUpperCase().includes('PARAR') && !textoFinal.toUpperCase().includes('SAIR')) {
    const optOutRodape = processarSpintax(
      '\n\n_{Caso prefira não receber nossos lembretes, responda SAIR ou PARAR.|Para não receber mensagens, responda SAIR ou PARAR.|Se não quiser mais receber avisos, responda SAIR ou PARAR.}_',
      rng
    );
    textoFinal += optOutRodape;
  }
 
   return textoFinal;
 }

/**
 * Calcula cadência humanizada com jitter (variação aleatória).
 * Impede que múltiplos disparos saiam em intervalos idênticos ou menores que 15s.
 */
export function calcularCadenciaHumanizada({
  minSec = 18,
  maxSec = 42,
  rng = Math.random,
} = {}) {
  const min = Math.max(10, Number(minSec) || 18);
  const max = Math.max(min + 2, Number(maxSec) || 42);
  const segundos = min + rng() * (max - min);
  return Math.round(segundos * 1000);
}

/**
 * Verifica se atingiu a cota de um lote para realizar pausa de respiro (cooldown).
 */
export function verificarCooldownLote(
  contadorNoLote = 0,
  {
    aCada = 12,
    pausaMinSec = 120,
    pausaMaxSec = 240,
    rng = Math.random,
  } = {}
) {
  if (contadorNoLote > 0 && contadorNoLote % aCada === 0) {
    const min = Math.max(60, Number(pausaMinSec) || 120);
    const max = Math.max(min + 10, Number(pausaMaxSec) || 240);
    const segundos = min + rng() * (max - min);
    return {
      necessario: true,
      pausaMs: Math.round(segundos * 1000),
      pausaSegundos: Math.round(segundos),
    };
  }
  return { necessario: false, pausaMs: 0, pausaSegundos: 0 };
}

/**
 * Valida se o momento atual está dentro da janela de horário humanizada e segura.
 * Segunda a Sábado: 09h00 às 19h30 (horário local).
 * Domingo: bloqueado para mensagens ativas não solicitadas.
 */
export function estaEmJanelaSeguraEnvio(
  dataAtual = new Date(),
  {
    timeZone = TIMEZONE_PADRAO,
    permitirDomingo = false,
    horaInicio = 9,
    horaFim = 19,
    minutoFim = 30,
  } = {}
) {
  try {
    const formatterDia = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
    const formatterHora = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hour12: false });
    
    const diaSemana = formatterDia.format(dataAtual).toLowerCase(); // 'sun', 'mon', ...
    if (diaSemana === 'sun' && !permitirDomingo) {
      return { ok: false, motivo: 'Envios ativos bloqueados aos domingos para evitar denúncias.' };
    }

    const partes = formatterHora.formatToParts(dataAtual);
    const hora = parseInt(partes.find((p) => p.type === 'hour')?.value || '0', 10);
    const minuto = parseInt(partes.find((p) => p.type === 'minute')?.value || '0', 10);
    const minutosTotais = hora * 60 + minuto;
    const minutosInicio = horaInicio * 60;
    const minutosLimite = horaFim * 60 + minutoFim;

    if (minutosTotais < minutosInicio) {
      return { ok: false, motivo: `Horário matinal muito cedo (${hora}h${minuto.toString().padStart(2, '0')}). Envios iniciam às ${horaInicio}h00.` };
    }
    if (minutosTotais > minutosLimite) {
      return { ok: false, motivo: `Horário noturno (${hora}h${minuto.toString().padStart(2, '0')}). Envios encerram às ${horaFim}h${minutoFim.toString().padStart(2, '0')} para evitar bloqueios.` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: true }; // Fallback permissivo se erro de timezone
  }
}

/**
 * Normaliza número para armazenamento consistente
 */
export function normalizarTelefone(tel = '') {
  const digits = String(tel || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

/**
 * Obtém configuração de antiban persistida para a empresa/barbearia
 */
export function obterConfiguracaoAntiban(empresaId = 'dino') {
  const raiz = db();
  if (!raiz.whatsappAntiban) raiz.whatsappAntiban = {};
  if (!raiz.whatsappAntiban[empresaId]) {
    raiz.whatsappAntiban[empresaId] = {
      empresaId,
      estagio: 'intermediario', // default seguro para Dino
      limiteDiarioPersonalizado: null,
      optOutList: [],
      dataEnvios: new Date().toISOString().slice(0, 10),
      enviosHoje: 0,
      historicoEnvios: [],
      ativo: true,
    };
    try { save(); } catch {}
  }

  const cfg = raiz.whatsappAntiban[empresaId];
  const hoje = new Date().toISOString().slice(0, 10);

  // Reseta contador se virou o dia
  if (cfg.dataEnvios !== hoje) {
    cfg.dataEnvios = hoje;
    cfg.enviosHoje = 0;
    try { save(); } catch {}
  }

  const estagioDados = ESTAGIOS_AQUECIMENTO[cfg.estagio] || ESTAGIOS_AQUECIMENTO.intermediario;
  const limiteDiario = cfg.limiteDiarioPersonalizado || estagioDados.limiteDiario;

  return {
    ...cfg,
    estagioDados,
    limiteDiario,
    restantesHoje: Math.max(0, limiteDiario - (cfg.enviosHoje || 0)),
  };
}

/**
 * Registra pedido de Opt-Out de cliente (palavra SAIR ou recusa).
 * Impede sumariamente que o cliente receba qualquer campanha ativa futura.
 */
export function registrarOptOut(empresaId = 'dino', telefone = '', motivo = 'mensagem_cliente') {
  const telNormalizado = normalizarTelefone(telefone);
  if (!telNormalizado) return false;

  const raiz = db();
  if (!raiz.whatsappAntiban) raiz.whatsappAntiban = {};
  if (!raiz.whatsappAntiban[empresaId]) obterConfiguracaoAntiban(empresaId);

  const cfg = raiz.whatsappAntiban[empresaId];
  if (!Array.isArray(cfg.optOutList)) cfg.optOutList = [];

  const jaExiste = cfg.optOutList.find((item) => item.telefone === telNormalizado);
  if (!jaExiste) {
    cfg.optOutList.push({
      telefone: telNormalizado,
      data: new Date().toISOString(),
      motivo,
    });
    try { save(); } catch {}
    console.log(`[WhatsApp Antiban] Telefone ${telNormalizado} registrado na lista de Opt-Out.`);
  }

  return true;
}

/**
 * Verifica se um telefone está na lista de Opt-Out
 */
export function estaEmOptOut(empresaId = 'dino', telefone = '') {
  const telNormalizado = normalizarTelefone(telefone);
  if (!telNormalizado) return false;

  const cfg = obterConfiguracaoAntiban(empresaId);
  return (cfg.optOutList || []).some((item) => item.telefone === telNormalizado);
}

/**
 * Valida se pode enviar mensagem ativa para o telefone especificado.
 */
export function podeEnviarMensagemAtiva(empresaId = 'dino', telefone = '', options = {}) {
  const telNormalizado = normalizarTelefone(telefone);
  if (!telNormalizado || telNormalizado.length < 10) {
    return { ok: false, motivo: 'Número de telefone inválido.' };
  }

  // 1. Verifica Opt-Out
  if (estaEmOptOut(empresaId, telNormalizado)) {
    return { ok: false, motivo: 'Cliente solicitou SAIR (Opt-Out). Mensagens ativas bloqueadas.' };
  }

  // 2. Verifica Janela de Horário
  if (!options.ignorarJanelaHorario) {
    const janela = estaEmJanelaSeguraEnvio(options.agora || new Date());
    if (!janela.ok) return { ok: false, motivo: janela.motivo };
  }

  // 3. Verifica Cota Diária do Aquecimento do Chip
  const cfg = obterConfiguracaoAntiban(empresaId);
  if (!options.ignorarLimiteDiario && cfg.restantesHoje <= 0) {
    return {
      ok: false,
      motivo: `Cota diária de aquecimento atingida (${cfg.enviosHoje}/${cfg.limiteDiario} envios hoje). Aguarde amanhã para proteger o chip de banimento.`,
      limiteAtingido: true,
    };
  }

  return { ok: true, restantesHoje: cfg.restantesHoje };
}

/**
 * Registra o envio com sucesso, incrementando o contador diário
 */
export function registrarEnvioRealizado(empresaId = 'dino', telefone = '') {
  const telNormalizado = normalizarTelefone(telefone);
  const raiz = db();
  if (!raiz.whatsappAntiban) raiz.whatsappAntiban = {};
  if (!raiz.whatsappAntiban[empresaId]) obterConfiguracaoAntiban(empresaId);

  const cfg = raiz.whatsappAntiban[empresaId];
  cfg.enviosHoje = (cfg.enviosHoje || 0) + 1;
  cfg.ultimoEnvioEm = new Date().toISOString();

  try { save(); } catch {}
  return cfg.enviosHoje;
}

/**
 * Atualiza o estágio de aquecimento ou teto diário
 */
export function atualizarConfiguracaoAntiban(empresaId = 'dino', alteracoes = {}) {
  const raiz = db();
  if (!raiz.whatsappAntiban) raiz.whatsappAntiban = {};
  if (!raiz.whatsappAntiban[empresaId]) obterConfiguracaoAntiban(empresaId);

  const cfg = raiz.whatsappAntiban[empresaId];

  if (alteracoes.estagio && ESTAGIOS_AQUECIMENTO[alteracoes.estagio]) {
    cfg.estagio = alteracoes.estagio;
  }
  if (alteracoes.limiteDiarioPersonalizado !== undefined) {
    cfg.limiteDiarioPersonalizado = alteracoes.limiteDiarioPersonalizado === null
      ? null
      : Math.max(1, Number(alteracoes.limiteDiarioPersonalizado) || 1);
  }
  if (alteracoes.ativo !== undefined) {
    cfg.ativo = Boolean(alteracoes.ativo);
  }

  try { save(); } catch {}
  return obterConfiguracaoAntiban(empresaId);
}
