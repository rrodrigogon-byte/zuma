/**
 * Motor de regras de acesso (Item 1.5 da especificação Kytto Clube & Academia).
 *
 * Função pura: recebe o contexto já carregado do banco e devolve a decisão.
 * Não acessa banco, rede nem relógio — o "agora" vem no contexto, para ser testável
 * e para dar o mesmo resultado no servidor e no agente local.
 *
 * Ordem fixa: a primeira regra que bloqueia vence.
 */

const CODIGOS = Object.freeze({
  BLOQUEIO_MANUAL: 'bloqueio_manual',
  CONTRATO_PENDENTE: 'contrato_pendente',
  INADIMPLENTE: 'inadimplente',
  FORA_DO_HORARIO: 'fora_do_horario',
  LIMITE_ATINGIDO: 'limite_atingido',
  SEM_RESERVA: 'sem_reserva',
  UNIDADE_NAO_PERMITIDA: 'unidade_nao_permitida',
  JA_DENTRO: 'ja_dentro',
  SEM_PLANO: 'sem_plano',
  LIBERADO: 'liberado',
  PARCEIRO: 'parceiro',
});

// Ação automática que o Kytto dispara junto com o bloqueio (WhatsApp / painel).
const ACOES = Object.freeze({
  AVISAR_RECEPCAO: 'avisar_recepcao',
  REENVIAR_CONTRATO: 'reenviar_contrato',
  ENVIAR_LINK_PAGAMENTO: 'enviar_link_pagamento',
  OFERECER_UPGRADE: 'oferecer_upgrade',
  OFERECER_DIARIA: 'oferecer_diaria',
  MOSTRAR_VAGAS: 'mostrar_vagas',
  REGISTRAR_PRESENCA: 'registrar_presenca',
  VALIDAR_PARCEIRO: 'validar_parceiro',
});

const PADROES = Object.freeze({
  toleranciaDias: 5,
  prazoContratoDias: 7,
  antiDuplaEntradaMin: 90,
  janelaReservaAntesMin: 30,
  janelaReservaDepoisMin: 10,
});

const DIA_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

/**
 * Converte um Date para dia da semana (0=domingo) e minutos do dia no fuso informado.
 * Usa Intl para não depender do fuso do servidor (Render roda em UTC).
 */
function relogioLocal(agora, fuso) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso || 'America/Cuiaba',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const get = (t) => partes.find((p) => p.type === t).value;
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    diaSemana: dias[get('weekday')],
    minutos: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function hhmmParaMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

function dentroDeAlgumaJanela(janelas, minutos) {
  // janela "22:00-02:00" atravessa a meia-noite
  return janelas.some(({ inicio, fim }) => {
    const i = hhmmParaMin(inicio);
    const f = hhmmParaMin(fim);
    return i <= f ? minutos >= i && minutos < f : minutos >= i || minutos < f;
  });
}

function formatarJanelas(janelas) {
  return janelas
    .map(({ inicio, fim }) => `${inicio.replace(/:00$/, 'h')} às ${fim.replace(/:00$/, 'h')}`)
    .join(' e ');
}

function bloquear(codigo, mensagem, acao, extra = {}) {
  return { liberado: false, codigo, mensagem, acao, ...extra };
}

/**
 * @param {object} ctx
 * @param {Date}   ctx.agora
 * @param {string} [ctx.fuso]               ex.: 'America/Cuiaba'
 * @param {string} ctx.unidadeId            unidade do equipamento
 * @param {object} ctx.pessoa               { id, nome, bloqueada, motivoBloqueio }
 * @param {object|null} ctx.matricula       { pagoAte: Date, plano: {...} } ou null
 * @param {object|null} ctx.contrato        { status: 'aceito'|'enviado'|..., enviadoEm: Date }
 * @param {Date[]} ctx.acessosRecentes      entradas liberadas anteriores (ordem qualquer)
 * @param {object[]} ctx.reservas           [{ inicio: Date, fim: Date, status }]
 * @param {object} [ctx.config]             sobrescreve PADROES
 * @param {object|null} [ctx.passeParceiro] check-in Wellhub/TotalPass válido { checkinId, plataforma, expiraEm } (item 2)
 *
 * plano: {
 *   unidades?: string[]                 vazio/ausente = todas
 *   horarios?: { [diaSemana]: [{inicio:'06:00', fim:'12:00'}] }  ausente = livre
 *   limitePorDia?: number, limitePorSemana?: number
 *   exigeReserva?: boolean
 *   toleranciaDias?: number
 * }
 */
export function decidirAcesso(ctx) {
  const decisao = decidirPeloPlano(ctx);
  // Item 2: check-in válido do Wellhub/TotalPass libera quem não tem plano (ou cujo plano bloqueou),
  // mas nunca passa por cima de bloqueio manual nem da anti-dupla entrada.
  const passe = ctx.passeParceiro;
  const unidadeDoPasseOk = !passe?.unidadeId || !ctx.unidadeId || passe.unidadeId === ctx.unidadeId;
  if (!decisao.liberado && passe && unidadeDoPasseOk && new Date(passe.expiraEm) > ctx.agora
      && decisao.codigo !== CODIGOS.BLOQUEIO_MANUAL && decisao.codigo !== CODIGOS.JA_DENTRO) {
    const cfg = { ...PADROES, ...(ctx.config || {}) };
    const ultimo = (ctx.acessosRecentes || []).map((d) => new Date(d)).filter((d) => d <= ctx.agora).sort((a, b) => b - a)[0];
    if (ultimo && ctx.agora - ultimo < cfg.antiDuplaEntradaMin * MIN_MS) {
      return bloquear(CODIGOS.JA_DENTRO, 'Entrada já registrada', null);
    }
    const nome = primeiroNome(ctx.pessoa?.nome);
    return {
      liberado: true,
      codigo: CODIGOS.PARCEIRO,
      mensagem: nome ? `Bom treino, ${nome}!` : 'Bom treino!',
      acao: ACOES.VALIDAR_PARCEIRO,
      checkinId: passe.checkinId,
      plataforma: passe.plataforma,
    };
  }
  return decisao;
}

function decidirPeloPlano(ctx) {
  const cfg = { ...PADROES, ...(ctx.config || {}) };
  const agora = ctx.agora;
  const pessoa = ctx.pessoa || {};
  const nome = primeiroNome(pessoa.nome);
  const plano = (ctx.matricula && ctx.matricula.plano) || null;

  // 1. Bloqueio manual
  if (pessoa.bloqueada) {
    return bloquear(CODIGOS.BLOQUEIO_MANUAL, 'Procure a recepção', ACOES.AVISAR_RECEPCAO, {
      motivoInterno: pessoa.motivoBloqueio || null,
    });
  }

  if (!ctx.matricula || !plano) {
    return bloquear(CODIGOS.SEM_PLANO, 'Sem plano ativo. Fale com a recepção', ACOES.AVISAR_RECEPCAO);
  }

  // 2. Contrato não aceito após o prazo
  const contrato = ctx.contrato;
  if (contrato && contrato.status !== 'aceito' && contrato.enviadoEm) {
    // prazo do próprio contrato (configurável por modelo); sem ele, o padrão de 7 dias
    const prazo = contrato.prazoAceiteEm
      ? new Date(contrato.prazoAceiteEm)
      : new Date(new Date(contrato.enviadoEm).getTime() + cfg.prazoContratoDias * DIA_MS);
    if (agora >= prazo) {
      return bloquear(
        CODIGOS.CONTRATO_PENDENTE,
        'Aceite seu contrato no WhatsApp',
        ACOES.REENVIAR_CONTRATO,
      );
    }
  }

  // 3. Mensalidade vencida além da tolerância
  const tolerancia = plano.toleranciaDias ?? cfg.toleranciaDias;
  const pagoAte = new Date(ctx.matricula.pagoAte);
  // Atraso conta por dia iniciado: 1 segundo após o fim do dia pago já é 1 dia de atraso.
  const diasAtraso = agora > pagoAte ? Math.ceil((agora - pagoAte) / DIA_MS) : 0;
  if (diasAtraso > tolerancia) {
    return bloquear(CODIGOS.INADIMPLENTE, 'Mensalidade em aberto', ACOES.ENVIAR_LINK_PAGAMENTO, {
      diasAtraso,
    });
  }

  // 4. Fora do horário do plano
  const { diaSemana, minutos } = relogioLocal(agora, ctx.fuso);
  if (plano.horarios) {
    const janelasHoje = plano.horarios[diaSemana] || [];
    if (!dentroDeAlgumaJanela(janelasHoje, minutos)) {
      const msg = janelasHoje.length
        ? `Seu plano libera das ${formatarJanelas(janelasHoje)}`
        : 'Seu plano não libera acesso hoje';
      return bloquear(CODIGOS.FORA_DO_HORARIO, msg, ACOES.OFERECER_UPGRADE);
    }
  }

  // 5. Limite de acessos por dia / semana
  const acessos = (ctx.acessosRecentes || []).map((d) => new Date(d));
  const hojeChave = chaveDia(agora, ctx.fuso);
  if (plano.limitePorDia != null) {
    const hoje = acessos.filter((d) => chaveDia(d, ctx.fuso) === hojeChave).length;
    if (hoje >= plano.limitePorDia) {
      return bloquear(CODIGOS.LIMITE_ATINGIDO, 'Limite do plano atingido hoje', ACOES.OFERECER_DIARIA);
    }
  }
  if (plano.limitePorSemana != null) {
    const seteDias = acessos.filter((d) => agora - d < 7 * DIA_MS && d <= agora).length;
    if (seteDias >= plano.limitePorSemana) {
      return bloquear(CODIGOS.LIMITE_ATINGIDO, 'Limite semanal do plano atingido', ACOES.OFERECER_DIARIA);
    }
  }

  // 6. Exige reserva
  if (plano.exigeReserva) {
    const antes = cfg.janelaReservaAntesMin * MIN_MS;
    const depois = cfg.janelaReservaDepoisMin * MIN_MS;
    const temReserva = (ctx.reservas || []).some((r) => {
      if (r.status && r.status !== 'reservada') return false;
      const inicio = new Date(r.inicio).getTime();
      return agora.getTime() >= inicio - antes && agora.getTime() <= inicio + depois;
    });
    if (!temReserva) {
      return bloquear(CODIGOS.SEM_RESERVA, 'Reserve sua aula pelo WhatsApp', ACOES.MOSTRAR_VAGAS);
    }
  }

  // 7. Unidade não permitida
  // só vale quando a decisão é de um aparelho de unidade conhecida (consulta da IA não informa unidade)
  if (ctx.unidadeId && Array.isArray(plano.unidades) && plano.unidades.length && !plano.unidades.includes(ctx.unidadeId)) {
    return bloquear(CODIGOS.UNIDADE_NAO_PERMITIDA, 'Plano não vale nesta unidade', null);
  }

  // 8. Anti-dupla entrada
  const ultimo = acessos.filter((d) => d <= agora).sort((a, b) => b - a)[0];
  if (ultimo && agora - ultimo < cfg.antiDuplaEntradaMin * MIN_MS) {
    return bloquear(CODIGOS.JA_DENTRO, 'Entrada já registrada', null);
  }

  return {
    liberado: true,
    codigo: CODIGOS.LIBERADO,
    mensagem: nome ? `Bom treino, ${nome}!` : 'Bom treino!',
    acao: ACOES.REGISTRAR_PRESENCA,
    diasAtraso,
  };
}

/**
 * Instante do fim (23:59:59) de uma data AAAA-MM-DD no fuso informado.
 * Ex.: '2026-11-01' em America/Cuiaba -> 2026-11-02T03:59:59Z.
 */
export function fimDoDiaNoFuso(dataISO, fuso = 'America/Cuiaba') {
  return instanteNoFuso(dataISO, '23:59:59', fuso);
}

/** Instante UTC de uma data + hora local no fuso (ex.: '2026-10-21', '18:30', 'America/Cuiaba'). */
export function instanteNoFuso(dataISO, hora, fuso = 'America/Cuiaba') {
  const h = String(hora).length === 5 ? `${hora}:00` : String(hora).slice(0, 8);
  const base = Date.parse(`${String(dataISO).slice(0, 10)}T${h}Z`);
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(base));
  const v = (t) => Number(partes.find((p) => p.type === t).value);
  const comoLocal = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return new Date(base - (comoLocal - base));
}

function chaveDia(data, fuso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso || 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

/**
 * Validade a gravar no equipamento (begin_time/end_time, em segundos Unix) para que,
 * sem internet, quem está vencido continue barrado. Item 1.2 "regra que torna o offline seguro".
 */
export function validadeOffline(matricula, config = {}) {
  if (!matricula || !matricula.pagoAte) return { begin_time: 0, end_time: 1 };
  const tolerancia = matricula.plano?.toleranciaDias ?? config.toleranciaDias ?? PADROES.toleranciaDias;
  // Mesmo corte do motor online: fim do último dia de tolerância.
  const fim = new Date(matricula.pagoAte).getTime() + tolerancia * DIA_MS;
  return { begin_time: 0, end_time: Math.floor(fim / 1000) };
}

export { CODIGOS, ACOES, PADROES, relogioLocal };
