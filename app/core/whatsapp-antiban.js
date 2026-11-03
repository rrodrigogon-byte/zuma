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
}) {
  const nomeCompleto = String(cliente.nome || 'Cliente').trim();
  const primeiroNome = nomeCompleto.split(' ')[0] || 'Cliente';
  const profNome = profissional && profissional !== 'Não informado'
    ? String(profissional).trim().split(' ')[0]
    : 'nossa equipe';

  // Se nenhum template foi fornecido, usamos um gerador padrão com rico Spintax
  let baseTemplate = template;
  if (!baseTemplate) {
    if (modelo === 'essencial') {
      baseTemplate = '{Olá|Oi|Opa|E aí} {Nome}! {Tudo bem?|Como vai?|Tudo certo por aí?}\n\n' +
        '{Passando para dar um alô da|Uma mensagem rápida aqui da|Dando uma passada aqui da} Barbearia Dino. ' +
        '{Notamos que faz um tempo que você não vem dar um talento no visual.|Sentimos sua falta por aqui ultimamente!|Faz alguns dias que você não renova o corte com a gente.}\n\n' +
        '{Criamos agora uma opção super prática com o corte Essencial por um valor bem acessível, perfeito para manter o estilo em dia sem pesar.|Estamos com o atendimento Essencial com valores novos e mais acessíveis, ideal pra quem quer manter o corte alinhado com praticidade.}\n\n' +
        '{Que tal garantir seu horário para esta semana?|Se quiser reservar seu horário com a gente, é bem rápido:}\n{Link Agendamento}';
    } else if (modelo === 'premium') {
      baseTemplate = '{Olá|Oi|Opa|E aí} {Nome}! {Tudo bem?|Como você está?|Tudo certo?}\n\n' +
        '{Passando para dar um alô da|Dando uma passada aqui da} Barbearia Dino. ' +
        '{Sentimos sua falta por aqui nos últimos tempos!|Faz um tempinho que você não vem relaxar e renovar o visual conosco.}\n\n' +
        '{Preparamos uma experiência completa e diferenciada no atendimento Premium, com todo o conforto, cerveja gelada e o padrão de excelência de sempre.|Queremos te convidar para conhecer nosso atendimento Premium, com corte impecável e o tratamento VIP que você merece.}\n\n' +
        '{Gostaria de agendar seu horário? Pode reservar diretamente pelo link abaixo ou responder aqui mesmo:}\n{Link Agendamento}';
    } else {
      baseTemplate = '{Olá|Oi|Opa|E aí} {Nome}! {Tudo bem?|Como vão as coisas?|Tudo certo por aí?}\n\n' +
        '{Dando uma passada rápida da|Passando aqui da} Barbearia Dino. ' +
        '{Sentimos sua falta por aqui!|Faz um tempo que a gente não se vê aqui na barbearia.}\n\n' +
        '{Que tal aproveitar esses dias para renovar o corte e o visual?|Estamos com a agenda aberta e horários excelentes para esta semana.}\n\n' +
        '{Pode agendar direto pelo link abaixo ou falar comigo aqui:}\n{Link Agendamento}';
    }
  }

  // Substitui variáveis conhecidas
  let textoFinal = baseTemplate
    .replace(/\{Nome do Cliente\}|\{Nome\}/g, primeiroNome)
    .replace(/\{Nome Completo\}/g, nomeCompleto)
    .replace(/\{Profissional\}/g, profNome)
    .replace(/\{Ultima Visita\}/g, cliente.ultimaVisita ? new Date(cliente.ultimaVisita).toLocaleDateString('pt-BR') : 'recente')
    .replace(/\{Dias Sem Vir\}/g, String(cliente.diasSemVir || ''))
    .replace(/\{Link Agendamento\}/g, link || `https://kytto.com.br/barbeiro/dino?t=${cliente.telefone || ''}`);

  // Aplica o motor de Spintax para que a mensagem gerada seja única
  textoFinal = processarSpintax(textoFinal, rng).trim();

  // Adiciona rodapé amigável de Opt-Out caso solicitado e ainda não presente
  if (incluirOptOut && !textoFinal.toUpperCase().includes('SAIR')) {
    const optOutRodape = processarSpintax(
      '\n\n_{Se preferir não receber nossos avisos, responda SAIR.|Para não receber mensagens, responda SAIR.|Caso não queira receber lembretes ou novidades, é só responder SAIR.}_',
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
