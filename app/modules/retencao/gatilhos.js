// Motor puro da régua de retenção (item 4.1 e 4.2): recebe a "foto" de cada aluno e devolve os
// gatilhos que se aplicam hoje, com prioridade e a chave do episódio (o mesmo episódio nunca é
// disparado duas vezes). Sem banco e sem relógio próprio: tudo entra por parâmetro e é testável.

export const GATILHOS = {
  inadimplente:       { prioridade: 100, marketing: false, padrao: { passos: [1, 3, 7, 15] } },
  vencimento:         { prioridade: 90,  marketing: false, padrao: { passos: [5, 1] } },
  aniversario:        { prioridade: 80,  marketing: true,  padrao: {} },
  faltante_serio:     { prioridade: 75,  marketing: true,  padrao: { dias: 15 } },
  risco_cancelar:     { prioridade: 70,  marketing: true,  padrao: { queda: 0.5, minimoAnterior: 4 } },
  renovacao:          { prioridade: 65,  marketing: true,  padrao: { passos: [30, 10] } },
  faltante_leve:      { prioridade: 60,  marketing: true,  padrao: { dias: 7 } },
  prospect:           { prioridade: 55,  marketing: true,  padrao: { passos: [1, 3, 7] } },
  parceiro_frequente: { prioridade: 50,  marketing: true,  padrao: { checkins: 8 } },
  pos_aula:           { prioridade: 45,  marketing: true,  padrao: { dias: 7 } },
  ex_aluno:           { prioridade: 40,  marketing: true,  padrao: { passos: [30, 60, 90] } },
};

const DIA = 86400000;

/** Último dia em que o aluno "esteve": último acesso, início, ou o dia seguinte ao fim do último congelamento. */
function ultimaPresenca(f) {
  return [f.ultimoAcesso, f.matricula?.inicio, f.fimUltimoCongelamento].filter(Boolean).sort().at(-1) || null;
}
/** Diferença em dias entre duas datas AAAA-MM-DD (b - a). */
export function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA);
}
export function somarDias(data, n) {
  return new Date(Date.parse(`${data}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
}

/**
 * Passo atual de uma escada (ex.: 1, 3, 7, 15 dias de atraso). Cada passo vale até o próximo;
 * o último vale por `janelaUltimo` dias. Assim, se o disparo foi barrado pela cadência num dia,
 * ainda pode sair no dia seguinte, mas nunca dois passos de uma vez.
 */
export function passoCrescente(dias, passos, janelaUltimo = 5) {
  const ord = [...passos].sort((a, b) => a - b);
  for (let i = ord.length - 1; i >= 0; i -= 1) {
    const limite = i === ord.length - 1 ? ord[i] + janelaUltimo : ord[i + 1];
    if (dias >= ord[i] && dias < limite) return ord[i];
  }
  return null;
}

/** Passo de contagem regressiva (ex.: faltam 30 e 10 dias): passo vale de N até o próximo menor. */
export function passoRegressivo(faltam, passos) {
  const ord = [...passos].sort((a, b) => b - a);
  for (let i = 0; i < ord.length; i += 1) {
    const piso = i + 1 < ord.length ? ord[i + 1] : -1;
    if (faltam <= ord[i] && faltam > piso) return ord[i];
  }
  return null;
}

/**
 * @param {object} f foto do aluno (montada pelo serviço):
 *   hoje 'AAAA-MM-DD' (no fuso da academia), matricula { id, status, pagoAte, inicio, fimFidelidade, canceladaEm },
 *   ultimoAcesso 'AAAA-MM-DD'|null, acessos4 (últimas 4 semanas), acessosAnt4 (4 semanas anteriores),
 *   dataNascimento 'AAAA-MM-DD'|null, prospect { id, criadoEm }|null, checkinsParceiroMes, promessaAte,
 *   temMatriculaAtiva (para ex-aluno)
 * @param {object} reguas { [gatilho]: { ativo, parametros } } (ausente = ativo com padrão)
 * @returns {Array<{ gatilho, chave, prioridade, marketing, dados }>} do mais para o menos prioritário
 */
export function avaliarGatilhos(f, reguas = {}) {
  const out = [];
  const ligado = (g) => reguas[g]?.ativo !== false;
  const p = (g) => ({ ...GATILHOS[g].padrao, ...(reguas[g]?.parametros || {}) });
  const add = (gatilho, chave, dados = {}) => {
    if (!ligado(gatilho)) return;
    out.push({ gatilho, chave: `${gatilho}:${chave}`, prioridade: GATILHOS[gatilho].prioridade, marketing: GATILHOS[gatilho].marketing, dados });
  };
  const { hoje } = f;
  const m = f.matricula;
  const ativa = m && m.status === 'ativa';

  if (ativa) {
    const atraso = diasEntre(m.pagoAte, hoje);
    if (atraso > 0) {
      const passo = passoCrescente(atraso, p('inadimplente').passos);
      if (passo && !(f.promessaAte && f.promessaAte >= hoje)) add('inadimplente', `${m.pagoAte}:${passo}`, { dias: atraso });
    } else {
      // vence no dia seguinte ao último dia pago
      const faltam = diasEntre(hoje, somarDias(m.pagoAte, 1));
      const passos = p('vencimento').passos;
      if (passos.includes(faltam)) add('vencimento', `${m.pagoAte}:${faltam}`, { dias: faltam });
    }

    // ausência só conta onde a catraca já registra acessos (academia sem catraca ou recém-instalada
    // não tem como saber quem sumiu) e nunca pelo período congelado
    if (f.empresaTemAcessos !== false) {
      const referencia = ultimaPresenca(f);
      const ausente = referencia ? diasEntre(referencia, hoje) : 0;
      if (ausente >= p('faltante_serio').dias) add('faltante_serio', referencia, { dias: ausente });
      else if (ausente >= p('faltante_leve').dias) add('faltante_leve', referencia, { dias: ausente });
    }

    const r = p('risco_cancelar');
    if (f.empresaTemAcessos !== false && f.acessosAnt4 >= r.minimoAnterior && f.acessos4 <= f.acessosAnt4 * (1 - r.queda)) {
      add('risco_cancelar', hoje.slice(0, 7), { antes: f.acessosAnt4, agora: f.acessos4 });
    }

    if (m.fimFidelidade) {
      const faltam = diasEntre(hoje, m.fimFidelidade);
      const passo = faltam >= 0 ? passoRegressivo(faltam, p('renovacao').passos) : null;
      if (passo) add('renovacao', `${m.fimFidelidade}:${passo}`, { dias: faltam });
    }

    // pesquisa da 1ª semana: só para quem se matriculou depois que a régua foi ligada
    if (m.inicio && (!f.ativadaEm || m.inicio >= f.ativadaEm)) {
      const desde = diasEntre(m.inicio, hoje);
      const d = p('pos_aula').dias;
      if (desde >= d && desde <= d + 7) add('pos_aula', m.id, {});
    }
  }

  if (f.dataNascimento && f.dataNascimento.slice(5) === hoje.slice(5) && (ativa || f.prospect)) {
    add('aniversario', hoje.slice(0, 4), {});
  }

  // interessado de origem "parceiro" (Wellhub/TotalPass) só recebe o gatilho de parceiro frequente
  if (f.prospect && f.prospect.origem !== 'parceiro' && !f.temMatriculaAtiva) {
    const desde = diasEntre(f.prospect.criadoEm, hoje);
    const passo = passoCrescente(desde, p('prospect').passos, 3);
    if (passo) add('prospect', `${f.prospect.id}:${passo}`, {});
  }

  if (m && m.status === 'cancelada' && m.canceladaEm && !f.temMatriculaAtiva) {
    const desde = diasEntre(m.canceladaEm, hoje);
    const passo = passoCrescente(desde, p('ex_aluno').passos, 10);
    if (passo) add('ex_aluno', `${m.id}:${passo}`, {});
  }

  if (!f.temMatriculaAtiva && (f.checkinsParceiroMes || 0) >= p('parceiro_frequente').checkins) {
    add('parceiro_frequente', hoje.slice(0, 7), { dias: f.checkinsParceiroMes });
  }

  return out.sort((a, b) => b.prioridade - a.prioridade);
}

/**
 * Regras de cadência (item 4.2). Devolve o motivo do bloqueio ou null se pode enviar.
 * @param {object} c { horaLocal, diaSemana (0=domingo), ultimoDisparoEm, ultimaRespostaEm, optoutEm, agora, enviadosHoje }
 * @param {object} cfg config da academia
 * @param {{ marketing: boolean }} candidato
 */
export function bloqueioDeCadencia(c, cfg, candidato) {
  if (c.horaLocal < cfg.horaInicio || c.horaLocal >= cfg.horaFim) return 'fora_do_horario';
  if (c.diaSemana === 0 && !cfg.enviaDomingo) return 'domingo';
  if (c.enviadosHoje >= cfg.limiteDiario) return 'limite_diario';
  if (candidato.marketing && c.optoutEm) return 'optout';
  const agora = c.agora.getTime();
  if (c.ultimaRespostaEm && agora - new Date(c.ultimaRespostaEm).getTime() < cfg.pausaRespostaDias * DIA) return 'em_conversa';
  if (c.ultimoDisparoEm && agora - new Date(c.ultimoDisparoEm).getTime() < cfg.intervaloDias * DIA) return 'cadencia';
  return null;
}

/**
 * Risco de saída de 0 a 100 (item 4.4: "alunos em risco hoje, ordenados por chance de sair").
 * Pontuação simples e explicável: cada fator aparece no painel com o peso que somou.
 */
export function calcularRisco(f) {
  const fatores = [];
  const somar = (pontos, fator) => { if (pontos > 0) fatores.push({ fator, pontos: Math.round(pontos) }); };
  const m = f.matricula;
  const referencia = f.empresaTemAcessos === false ? null : ultimaPresenca(f);
  if (referencia) {
    const dias = diasEntre(referencia, f.hoje);
    if (dias > 3) somar(Math.min(35, (dias - 3) * (35 / 27)), `${dias} dias sem treinar`);
  }
  if (f.empresaTemAcessos !== false && f.acessosAnt4 > 0 && f.acessos4 < f.acessosAnt4) {
    const queda = (f.acessosAnt4 - f.acessos4) / f.acessosAnt4;
    somar(queda * 25, `frequência caiu ${Math.round(queda * 100)}%`);
  }
  if (m?.pagoAte) {
    const atraso = diasEntre(m.pagoAte, f.hoje);
    if (atraso > 0) somar(Math.min(20, 6 + atraso * 2), `${atraso} dia(s) de atraso`);
  }
  if (f.ultimaNota !== null && f.ultimaNota !== undefined && f.ultimaNota <= 6) somar(10, `nota ${f.ultimaNota} na pesquisa`);
  if (m?.fimFidelidade) {
    const faltam = diasEntre(f.hoje, m.fimFidelidade);
    if (faltam >= 0 && faltam <= 30) somar(10, `plano termina em ${faltam} dias`);
  }
  if (f.ocorrenciaAberta) somar(5, 'ocorrência aberta');
  const risco = Math.min(100, fatores.reduce((s, x) => s + x.pontos, 0));
  return { risco, fatores: fatores.sort((a, b) => b.pontos - a.pontos) };
}

/** Pedido para parar as mensagens de marketing (item 4.2). Curto e sem ambiguidade com "cancelar o plano". */
const OPTOUT = [
  /^\s*(parar|pare|para|stop|sair|chega)\s*[.!]*\s*$/i,
  /n[aã]o\s+quero\s+(mais\s+)?(receber|mensage(m|ns)|essas?\s+mensage(m|ns))/i,
  /(parem|pare|para|parar)\s+de\s+(me\s+)?(mandar|enviar)/i,
  /n[aã]o\s+(me\s+)?(mande|envie)m?\s+mais/i,
  /(descadastr|remov[ae]r?\s+(meu\s+)?(n[uú]mero|contato))/i,
];
export function ehOptOut(texto) {
  const t = String(texto || '').slice(0, 300);
  return OPTOUT.some((r) => r.test(t));
}

/** Intenção de cancelar o plano: sempre vai para humano quando houver conflito (item 4.7). */
export function pedeCancelamento(texto) {
  return /(cancelar|cancelamento|encerrar|rescindir|trancar)\s+(o\s+|meu\s+|a\s+|minha\s+|da\s+|do\s+|de\s+|minha\s+)?(plano|matr[ií]cula|contrato|academia)/i.test(String(texto || ''));
}
