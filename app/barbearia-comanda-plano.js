// ============================================================================
// Plano do cliente na comanda da barbearia
// Ao lançar um serviço para quem tem plano ativo, em dia e com sessão, o item
// entra coberto (preço de tabela registrado, valor zero na conta). O uso só é
// gravado na assinatura quando a comanda é faturada ou fechada pelo plano,
// com chave idempotente, e nunca duas vezes para o mesmo atendimento.
// ============================================================================

import * as barbearia from './barbearia-erp-kytto.js';
import * as captacao from './dino-captacao-kytto.js';

const texto = (valor, limite = 160) => String(valor ?? '').trim().slice(0, limite);


const MOTIVOS = {
  aguardando_pagamento: 'plano sem pagamento confirmado',
  inadimplente: 'plano com pagamento em atraso',
  pausada: 'plano pausado',
  aguardando_inicio:'pacote ainda não iniciado',
  encerrada:'validade do contrato encerrada',
};

/** Planos ativos do cliente com o saldo de sessões já descontando comandas em aberto. */
export function coberturasDoCliente(empresaId, clienteId, opcoes = {}) {
  if (!clienteId) return [];
  const servicos = new Map(barbearia.listarServicos(empresaId, { incluirInativos: true }).map((item) => [item.id, item.nome]));
  return barbearia.listarAssinaturas(empresaId)
    .filter((item) => item.clienteId === String(clienteId) && ['ativa', 'pausada'].includes(item.status))
    .map((assinatura) => {
      const resumo = captacao.resumoAssinatura(empresaId, assinatura.id, opcoes);
      if (!resumo) return null;
      const reservadas = captacao.reservasAssinatura(empresaId,assinatura.id,resumo,opcoes);
      const restantes = Math.max(0, resumo.sessoesRestantes - reservadas);
      const situacao = assinatura.status === 'pausada' ? 'pausada' : resumo.situacaoPagamento;
      const isPacote = resumo.plano?.categoriaPlano === 'pacote' || (resumo.plano?.nome || '').toLowerCase().includes('pacote');
      const utilizavel = assinatura.status === 'ativa' && (situacao === 'em_dia' || isPacote) && restantes > 0;
      const servicosIds = resumo.plano?.servicosIds || [];
      return {
        assinaturaId: assinatura.id,
        planoId: resumo.plano?.id || assinatura.planoId,
        planoNome: resumo.plano?.nome || 'Plano',
        servicosIds,
        servicosNomes: servicosIds.map((id) => servicos.get(id)).filter(Boolean),
        todosOsServicos: servicosIds.length === 0,
        sessoesNoCiclo: resumo.limiteNoCiclo,
        sessoesUsadas: resumo.usosNoCiclo,
        sessoesReservadas: reservadas,
        sessoesRestantes: restantes,
        cicloFim: resumo.ciclo?.fim || null,
        situacaoPagamento: situacao,
        pagoAte: resumo.pagoAte,
        utilizavel,
        motivo: utilizavel ? null : (MOTIVOS[situacao] || (restantes <= 0 ? 'sessões do ciclo esgotadas' : 'plano indisponível')),
        profissionalId: assinatura.profissionalId || resumo.plano?.profissionalId || null,
        profissionalNome: assinatura.profissionalNome || resumo.plano?.profissionalNome || null,
        profissionaisIds: resumo.plano?.profissionaisIds || [],
        ehVip: Boolean(resumo.plano?.ehVip || assinatura.ehVip),
        tipoProfissional: resumo.plano?.tipoProfissional || (resumo.plano?.profissionalId ? 'especifico' : 'todos'),
      };
    })
    .filter(Boolean);
}

function cobre(cobertura, servicoId, profissionalId = null) {
  const servicoOk = cobertura.todosOsServicos || cobertura.servicosIds.includes(String(servicoId));
  if (!servicoOk) return false;
  if (profissionalId) {
    const profId = String(profissionalId);
    if (cobertura.profissionalId && String(cobertura.profissionalId) !== profId) return false;
    if (cobertura.profissionaisIds?.length && !cobertura.profissionaisIds.includes(profId)) return false;
  }
  return true;
}

/** Remove do corpo campos que só o servidor pode preencher. */
export function limparItensRecebidos(itens = []) {
  return (Array.isArray(itens) ? itens : [itens]).map((item) => {
    const { coberturaPlano: _c, itemLoja: _l, ...resto } = item || {};
    return resto;
  });
}

/**
 * Aplica o plano aos serviços da entrada. Serviço com quantidade maior que o
 * saldo vira uma linha por sessão coberta e uma linha avulsa com o restante.
 */
export function aplicarPlanoAosItens(empresaId, arg2 = {}, arg3 = {}) {
  let clienteId, itens, comandaId, agendamentoId, opcoes;
  if (typeof arg2 === 'string') {
    clienteId = arg2;
    itens = Array.isArray(arg3) ? arg3 : (arg3.itens || []);
    comandaId = arg3.comandaId || '';
    agendamentoId = arg3.agendamentoId || '';
    opcoes = Array.isArray(arg3) ? {} : arg3;
  } else {
    clienteId = arg2.clienteId;
    itens = arg2.itens || [];
    comandaId = arg2.comandaId || '';
    agendamentoId = arg2.agendamentoId || '';
    opcoes = arg3;
  }
  const entrada = limparItensRecebidos(itens);
  const avisos = [];
  if (!clienteId) return { itens: entrada, cobertos: 0, avisos };
  const coberturas = coberturasDoCliente(empresaId, clienteId, {...opcoes,ignorarAgendamentoId:agendamentoId});
  if (!coberturas.length) return { itens: entrada, cobertos: 0, avisos };
  const saldo = new Map(coberturas.map((c) => [c.assinaturaId, c.utilizavel ? c.sessoesRestantes : 0]));
  const saida = [];
  let cobertos = 0;
  for (const item of entrada) {
    const tipo = String(item.tipo || (item.servicoId ? 'servico' : 'produto')).toLowerCase();
    if (tipo !== 'servico' || item.usarPlano === false) { saida.push(item); continue; }
    const servicoId = String(item.servicoId || item.itemId || '');
    const itemProfId = item.profissionalId || null;
    const candidatas = coberturas.filter((c) => cobre(c, servicoId, itemProfId));
    if (!candidatas.length) { saida.push(item); continue; }
    let restante = Math.max(1, Math.round(Number(item.quantidade || 1)));
    for (const cobertura of candidatas) {
      while (restante > 0 && (saldo.get(cobertura.assinaturaId) || 0) > 0) {
        saida.push({ ...item, quantidade: 1, coberturaPlano: { verificadoPeloServidor: true, assinaturaId: cobertura.assinaturaId, planoId: cobertura.planoId, planoNome: cobertura.planoNome } });
        saldo.set(cobertura.assinaturaId, saldo.get(cobertura.assinaturaId) - 1);
        restante -= 1;
        cobertos += 1;
      }
    }
    if (restante > 0) {
      saida.push({ ...item, quantidade: restante });
      const motivo = candidatas.map((c) => (c.utilizavel ? null : `${c.planoNome}: ${c.motivo}`)).filter(Boolean)[0];
      avisos.push(motivo ? `Lançado avulso — ${motivo}.` : 'Lançado avulso — o plano não tem mais sessões neste ciclo.');
    }
  }
  return { itens: saida, cobertos, avisos, comandaId: texto(comandaId, 120) || null };
}

/** Antes de receber ou fechar: o plano ainda cobre o que foi lançado como coberto? */
export function validarCoberturasDaComanda(empresaId, comanda, opcoes = {}) {
  const itens = (comanda?.itens || []).filter((item) => item.coberturaPlano && !item.coberturaPlano.usoId);
  if (!itens.length) return true;
  const coberturas = new Map(coberturasDoCliente(empresaId, comanda.clienteId, { ...opcoes, ignorarComandaId: comanda.id, ignorarAgendamentoId:comanda.agendamentoId }).map((c) => [c.assinaturaId, c]));
  const porAssinatura = new Map();
  for (const item of itens) porAssinatura.set(item.coberturaPlano.assinaturaId, [...(porAssinatura.get(item.coberturaPlano.assinaturaId) || []), item]);
  for (const [assinaturaId, lista] of porAssinatura) {
    const cobertura = coberturas.get(assinaturaId);
    const nome = lista[0].coberturaPlano.planoNome || 'Plano';
    if (!cobertura) throw Object.assign(new Error(`O ${nome} não está mais ativo para este cliente. Remova o item coberto e lance como avulso.`), { code: 'PLANO_INDISPONIVEL' });
    const isPacote = cobertura.categoriaPlano === 'pacote' || (cobertura.planoNome || '').toLowerCase().includes('pacote');
    if (cobertura.situacaoPagamento !== 'em_dia' && !isPacote) throw Object.assign(new Error(`O ${nome} está com ${MOTIVOS[cobertura.situacaoPagamento] || 'pendência'}. Remova o item coberto e lance como avulso, ou regularize o plano.`), { code: 'PLANO_INDISPONIVEL' });
    if (cobertura.sessoesRestantes < lista.length) throw Object.assign(new Error(`O ${nome} tem ${cobertura.sessoesRestantes} sessão(ões) disponível(is) e a comanda usa ${lista.length}. Remova um item coberto e lance como avulso.`), { code: 'PLANO_SEM_SESSAO' });
  }
  return true;
}

/**
 * Comanda faturada (paga, em conta ou fechada pelo plano): grava o uso de cada
 * item coberto. Idempotente: a chave é o agendamento (quando o serviço é o do
 * agendamento, a mesma chave da conclusão na agenda) ou comanda + item.
 */
export function consumirPlanosDaComanda(empresaId, comanda, opcoes = {}) {
  if (!comanda || !['paga', 'em_conta'].includes(comanda.status)) return [];
  const servicoAgendado = comanda.agendamentoId ? barbearia.servicoDoAgendamento(empresaId, comanda.agendamentoId) : null;
  let chaveAgendaUsada = false;
  const resultados = [];
  for (const item of comanda.itens || []) {
    if (!item.coberturaPlano || item.coberturaPlano.usoId) continue;
    let chave = `comanda:${comanda.id}:${item.id}`;
    if (servicoAgendado && !chaveAgendaUsada && item.servicoId === servicoAgendado) { chave = comanda.agendamentoId; chaveAgendaUsada = true; }
    try {
      captacao.registrarUsoAssinatura(empresaId, item.coberturaPlano.assinaturaId, {
        servicoId: item.servicoId, agendamentoId: chave,
        profissionalId: item.profissionalId || comanda.profissionalId || null, comandaId: comanda.id,
      }, opcoes);
      const uso = captacao.movimentosAssinatura(empresaId, item.coberturaPlano.assinaturaId).usos.find((u) => u.agendamentoId === chave);
      barbearia.registrarUsoPlanoNoItemComanda(empresaId, comanda.id, item.id, { usoId: uso?.id || chave });
      resultados.push({ itemId: item.id, ok: true, usoId: uso?.id || chave });
    } catch (error) {
      barbearia.registrarUsoPlanoNoItemComanda(empresaId, comanda.id, item.id, { erro: error.message });
      resultados.push({ itemId: item.id, ok: false, erro: error.message });
    }
  }
  return resultados;
}
