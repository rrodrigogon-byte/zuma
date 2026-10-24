// Histórico completo do cliente da barbearia (ficha 360): consumo item a item,
// família e gostos, dicas para o atendimento e sugestões de venda.
//
// Tudo aqui é determinístico e explicado: cada sugestão diz de onde veio
// (histórico, periodicidade, plano, aniversário ou o que outros clientes
// levam). Nenhuma sugestão envia mensagem ou cria venda sozinha. Funções puras,
// sem acesso a banco, para serem testadas sem servidor.

const DIA_MS = 86400000;
const FUSO_PADRAO = 'America/Cuiaba';
const FATURADAS = new Set(['paga', 'em_conta']);
const RELACAO = {
  esposa: 'Esposa', marido: 'Marido', conjuge: 'Cônjuge', namorada: 'Namorada', namorado: 'Namorado',
  filho: 'Filho', filha: 'Filha', enteado: 'Enteado', enteada: 'Enteada', pai: 'Pai', mae: 'Mãe',
  irmao: 'Irmão', irma: 'Irmã', outro: 'Familiar',
};
const FILHOS = new Set(['filho', 'filha', 'enteado', 'enteada']);

const dinheiro = (valor) => Math.round((Number(valor) || 0) * 100) / 100;
const texto = (valor) => String(valor ?? '').trim();

/** Data local (AAAA-MM-DD) no fuso da unidade. */
export function diaLocal(data = new Date(), fuso = FUSO_PADRAO) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const diasEntre = (diaA, diaB) => Math.round((Date.parse(`${diaB}T00:00:00Z`) - Date.parse(`${diaA}T00:00:00Z`)) / DIA_MS);

/** Próximo aniversário a partir de hoje (dias até, data e idade que fará, se o ano for conhecido). */
export function proximoAniversario({ dataNascimento = '', aniversario = '' } = {}, hoje) {
  const mmdd = texto(aniversario) || (texto(dataNascimento).length === 10 ? texto(dataNascimento).slice(5) : '');
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return null;
  const ano = Number(hoje.slice(0, 4));
  let alvo = `${ano}-${mmdd}`;
  // 29/02 em ano não bissexto: comemora em 28/02.
  if (mmdd === '02-29' && new Date(Date.UTC(ano, 1, 29)).getUTCMonth() !== 1) alvo = `${ano}-02-28`;
  let dias = diasEntre(hoje, alvo);
  let anoAlvo = ano;
  if (dias < 0) {
    anoAlvo = ano + 1;
    alvo = mmdd === '02-29' && new Date(Date.UTC(anoAlvo, 1, 29)).getUTCMonth() !== 1 ? `${anoAlvo}-02-28` : `${anoAlvo}-${mmdd}`;
    dias = diasEntre(hoje, alvo);
  }
  const nascimentoAno = texto(dataNascimento).length === 10 ? Number(dataNascimento.slice(0, 4)) : null;
  return { data: alvo, dias, idade: nascimentoAno ? anoAlvo - nascimentoAno : null };
}

function quandoComanda(comanda) {
  return comanda.fechadaEm || comanda.atualizadoEm || comanda.criadoEm || '';
}

function chaveItem(item) {
  if (item.tipo === 'servico') return `servico:${item.servicoId || item.nome}`;
  if (item.tipo === 'loja') return `loja:${item.lojaVarianteId || item.nome}`;
  return `produto:${item.produtoId || item.nome}`;
}

/** Linhas de consumo do cliente: comandas faturadas e vendas de balcão pagas. */
export function linhasDeConsumo({ comandas = [], vendas = [], profissionais = [] } = {}) {
  const nomeProf = new Map(profissionais.map((p) => [String(p.id), p.nome]));
  const linhas = [];
  for (const comanda of comandas) {
    if (!FATURADAS.has(comanda.status)) continue;
    const em = quandoComanda(comanda);
    for (const item of comanda.itens || []) {
      const coberto = Boolean(item.coberturaPlano);
      linhas.push({
        em, origem: 'comanda', origemId: comanda.id, tipo: item.tipo || 'servico', chave: chaveItem(item), nome: item.nome || 'Item',
        quantidade: Number(item.quantidade || item.qtd || 1), valor: dinheiro(item.subtotal ?? Number(item.precoUnitario || 0) * Number(item.quantidade || 1)),
        abatidoPlano: coberto ? dinheiro(item.coberturaPlano.valorAbatido) : 0, plano: coberto ? item.coberturaPlano.planoNome || '' : '',
        profissional: nomeProf.get(String(item.profissionalId || comanda.profissionalId || '')) || '',
      });
    }
  }
  for (const venda of vendas) {
    if (venda.status !== 'pago') continue;
    for (const item of venda.itens || []) {
      linhas.push({
        em: venda.atualizadoEm || venda.criadoEm || '', origem: 'balcao', origemId: venda.id, tipo: 'produto', chave: chaveItem({ ...item, tipo: 'produto' }), nome: item.nome || 'Produto',
        quantidade: Number(item.quantidade || 1), valor: dinheiro(item.subtotal ?? Number(item.precoUnitario || 0) * Number(item.quantidade || 1)),
        abatidoPlano: 0, plano: '', profissional: nomeProf.get(String(venda.profissionalId || '')) || '',
      });
    }
  }
  return linhas.sort((a, b) => String(b.em).localeCompare(String(a.em)));
}

/** Resumo do consumo: totais por tipo, últimos 12 meses mês a mês e itens mais consumidos. */
export function resumoConsumo(linhas, { hoje, fuso = FUSO_PADRAO, comandasAbertas = 0 } = {}) {
  const porTipo = { servico: 0, produto: 0, loja: 0 };
  let abatido = 0;
  const visitas = new Set();
  const meses = [];
  const [anoHoje, mesHoje] = hoje.split('-').map(Number);
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(anoHoje, mesHoje - 1 - i, 1));
    meses.push({ mes: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, valor: 0, abatido: 0 });
  }
  const porMes = new Map(meses.map((m) => [m.mes, m]));
  const itens = new Map();
  for (const linha of linhas) {
    porTipo[linha.tipo in porTipo ? linha.tipo : 'produto'] += linha.valor;
    abatido += linha.abatidoPlano;
    visitas.add(`${linha.origem}:${linha.origemId}`);
    const mes = porMes.get(diaLocal(linha.em, fuso).slice(0, 7));
    if (mes) { mes.valor = dinheiro(mes.valor + linha.valor); mes.abatido = dinheiro(mes.abatido + linha.abatidoPlano); }
    const atual = itens.get(linha.chave) || { chave: linha.chave, nome: linha.nome, tipo: linha.tipo, vezes: 0, quantidade: 0, valor: 0, abatidoPlano: 0, ultimaEm: linha.em };
    atual.vezes += 1; atual.quantidade += linha.quantidade; atual.valor = dinheiro(atual.valor + linha.valor); atual.abatidoPlano = dinheiro(atual.abatidoPlano + linha.abatidoPlano);
    if (String(linha.em) > String(atual.ultimaEm)) atual.ultimaEm = linha.em;
    itens.set(linha.chave, atual);
  }
  const total = dinheiro(porTipo.servico + porTipo.produto + porTipo.loja);
  const doze = dinheiro(meses.reduce((s, m) => s + m.valor, 0));
  return {
    total, abatidoPlano: dinheiro(abatido), compras: visitas.size,
    ticketMedio: visitas.size ? dinheiro(total / visitas.size) : 0,
    ultimos12Meses: doze, mediaMensal12: dinheiro(doze / 12),
    porTipo: { servicos: dinheiro(porTipo.servico), revenda: dinheiro(porTipo.produto), lojaDino: dinheiro(porTipo.loja) },
    meses, comandasAbertas,
    maisConsumidos: [...itens.values()].sort((a, b) => b.vezes - a.vezes || b.valor - a.valor).slice(0, 10),
  };
}

/** O que costuma sair junto com cada item, olhando as comandas faturadas da unidade (sem dados pessoais). */
export function coOcorrencias(comandasEmpresa = [], { desdeDia = '', fuso = FUSO_PADRAO } = {}) {
  const contagem = new Map(); // chave -> { total, junto: Map(chave -> {n, nome, tipo, ref}) }
  for (const comanda of comandasEmpresa) {
    if (!FATURADAS.has(comanda.status)) continue;
    if (desdeDia && diaLocal(quandoComanda(comanda), fuso) < desdeDia) continue;
    const itens = new Map();
    for (const item of comanda.itens || []) itens.set(chaveItem(item), item);
    for (const [chave] of itens) {
      const registro = contagem.get(chave) || { total: 0, junto: new Map() };
      registro.total += 1;
      for (const [outra, item] of itens) {
        if (outra === chave) continue;
        const j = registro.junto.get(outra) || { n: 0, nome: item.nome, tipo: item.tipo || 'servico', servicoId: item.servicoId || null, produtoId: item.produtoId || null, lojaVarianteId: item.lojaVarianteId || null };
        j.n += 1;
        registro.junto.set(outra, j);
      }
      contagem.set(chave, registro);
    }
  }
  return contagem;
}

function familiaParaFicha(cliente, hoje, maskPhone) {
  return (cliente.familia || []).map((membro) => {
    const aniversario = proximoAniversario(membro, hoje);
    return {
      id: membro.id, relacao: membro.relacao, relacaoNome: RELACAO[membro.relacao] || 'Familiar', nome: membro.nome,
      ehFilho: FILHOS.has(membro.relacao), aniversario: membro.aniversario || '', proximoAniversario: aniversario,
      // Telefone de familiar é dado de terceiro: na ficha só aparece mascarado.
      telefone: membro.telefone ? maskPhone(membro.telefone) : '', clienteId: membro.clienteId || null, observacao: membro.observacao || '',
    };
  }).sort((a, b) => (a.proximoAniversario?.dias ?? 999) - (b.proximoAniversario?.dias ?? 999));
}

function preferenciasParaFicha(cliente, profissionais) {
  const pref = cliente.preferencias || {};
  const preferido = profissionais.find((p) => String(p.id) === String(pref.profissionalPreferidoId || ''));
  return {
    corte: pref.corte || '', barba: pref.barba || '', bebida: pref.bebida || '', perfumes: pref.perfumes || '', produtos: pref.produtos || '',
    horario: pref.horario || '', atendimento: pref.atendimento || '', observacoes: pref.observacoes || '', tags: pref.tags || [],
    profissionalPreferido: preferido ? { id: preferido.id, nome: preferido.nome } : null,
  };
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const quandoDias = (dias) => (dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`);

/**
 * Monta a seção de histórico da ficha. `cliente` é o cadastro local (quando há um só);
 * `perfil360` é o que a ficha já calcula (indicadores, próximos, assistente de atendimento).
 */
export function montarHistoricoCliente({
  cliente = null, comandas = [], vendas = [], comandasEmpresa = [], profissionais = [], produtos = [], planosAtivos = [],
  coberturas = [], perfil360 = {}, agora = new Date(), fuso = FUSO_PADRAO, maskPhone = (v) => v,
} = {}) {
  const hoje = diaLocal(agora, fuso);
  const linhas = linhasDeConsumo({ comandas, vendas, profissionais });
  const consumo = resumoConsumo(linhas, { hoje, fuso, comandasAbertas: comandas.filter((c) => !FATURADAS.has(c.status) && c.status !== 'cancelada').length });
  const familia = cliente ? familiaParaFicha(cliente, hoje, maskPhone) : [];
  const preferencias = cliente ? preferenciasParaFicha(cliente, profissionais) : null;
  const redes = cliente?.redesSociais || {};
  const kpis = perfil360.indicadores || {};
  const marketingWhatsapp = cliente?.consentimentos?.whatsapp?.marketing?.concedido === true;
  const sugestoes = [];
  const dicas = [];
  const add = (s) => sugestoes.push({ prioridade: 2, ...s });

  // ── dicas para o atendimento (gostos do cliente) ──
  if (preferencias) {
    if (preferencias.profissionalPreferido) dicas.push({ id: 'pref-prof', titulo: `Prefere ser atendido por ${preferencias.profissionalPreferido.nome}` });
    if (preferencias.corte) dicas.push({ id: 'pref-corte', titulo: `Corte: ${preferencias.corte}` });
    if (preferencias.barba) dicas.push({ id: 'pref-barba', titulo: `Barba: ${preferencias.barba}` });
    if (preferencias.bebida) dicas.push({ id: 'pref-bebida', titulo: `Ofereça ${preferencias.bebida} ao chegar` });
    if (preferencias.atendimento) dicas.push({ id: 'pref-atend', titulo: `Atendimento: ${preferencias.atendimento}` });
    if (preferencias.horario) dicas.push({ id: 'pref-horario', titulo: `Melhor horário: ${preferencias.horario}` });
  }
  const proximo = (perfil360.proximos || [])[0];
  if (proximo && preferencias?.profissionalPreferido && proximo.profissional && proximo.profissional !== preferencias.profissionalPreferido.nome) {
    dicas.push({ id: 'prof-diferente', titulo: `O próximo horário está com ${proximo.profissional}, mas ele prefere ${preferencias.profissionalPreferido.nome}` });
  }

  // ── retorno ──
  const semVir = Number(kpis.diasSemAtividade);
  const ciclo = Number(kpis.retornoMedioDias);
  if (!proximo && Number.isFinite(semVir) && ciclo > 0 && semVir > Math.round(ciclo * 1.2)) {
    add({ id: 'retorno', categoria: 'retorno', prioridade: 1, titulo: 'Convidar para voltar', detalhe: `Está há ${semVir} dias sem vir; costuma voltar a cada ${ciclo} dias.`, acao: 'agendar' });
  }

  // ── plano ──
  for (const cob of coberturas) {
    if (!cob.utilizavel && cob.situacaoPagamento && cob.situacaoPagamento !== 'em_dia') {
      add({ id: `plano-pag-${cob.assinaturaId}`, categoria: 'atencao', prioridade: 1, titulo: `${cob.planoNome}: pagamento pendente`, detalhe: `O plano não abate serviços enquanto o ciclo não for pago (${cob.motivo || cob.situacaoPagamento}).` });
    } else if (cob.utilizavel && cob.sessoesRestantes > 0 && cob.cicloFim) {
      const faltam = diasEntre(hoje, diaLocal(cob.cicloFim, fuso));
      if (faltam >= 0 && faltam <= 10) add({ id: `plano-uso-${cob.assinaturaId}`, categoria: 'plano', prioridade: 1, titulo: `Usar ${plural(cob.sessoesRestantes, 'sessão', 'sessões')} do ${cob.planoNome}`, detalhe: `O ciclo termina ${quandoDias(faltam)}; sessões não usadas não acumulam.`, acao: 'agendar' });
    }
  }
  if (!coberturas.length && planosAtivos.length) {
    // Quanto ele gastou nos últimos 90 dias com serviços que cada plano cobre.
    const desde = diaLocal(new Date(Date.parse(`${hoje}T12:00:00Z`) - 90 * DIA_MS), 'UTC');
    let melhor = null;
    for (const plano of planosAtivos) {
      const ids = new Set((plano.servicosIds || []).map(String));
      const gasto = linhas.filter((l) => l.tipo === 'servico' && diaLocal(l.em, fuso) >= desde && (ids.size === 0 || ids.has(l.chave.slice('servico:'.length))))
        .reduce((s, l) => s + l.valor, 0);
      const mensal = dinheiro(gasto / 3);
      const precoMensal = dinheiro(Number(plano.preco || 0) / ({ trimestral: 3, anual: 12 }[plano.ciclo] || 1));
      if (precoMensal > 0 && mensal >= precoMensal * 0.8 && (!melhor || mensal - precoMensal > melhor.economia)) melhor = { plano, mensal, precoMensal, economia: dinheiro(mensal - precoMensal) };
    }
    if (melhor) {
      add({
        id: `plano-oferta-${melhor.plano.id}`, categoria: 'plano', prioridade: 1, titulo: `Oferecer o ${melhor.plano.nome}`,
        detalhe: melhor.economia > 0
          ? `Gastou em média R$ ${melhor.mensal.toFixed(2).replace('.', ',')}/mês nos últimos 90 dias com serviços do plano, que custa R$ ${melhor.precoMensal.toFixed(2).replace('.', ',')}/mês: economia de R$ ${melhor.economia.toFixed(2).replace('.', ',')}/mês.`
          : `Gasta perto do valor do plano (R$ ${melhor.precoMensal.toFixed(2).replace('.', ',')}/mês) com serviços que ele cobre; o plano garante a frequência.`,
      });
    }
  }

  // ── periodicidade e recompra (assistente já existente) ──
  const assistente = perfil360.barbearia?.assistenteAtendimento;
  if (assistente?.disponivel) {
    for (const s of assistente.servicosParaOferecer || []) add({ id: `serv-${s.nome}`, categoria: 'venda', titulo: `Oferecer ${s.nome}`, detalhe: `Último há ${s.diasDesdeUltima} dias; a periodicidade recomendada é de ${s.intervaloDias} dias.` });
    for (const p of assistente.oportunidadesProdutos || []) add({ id: `recompra-${p.nome}`, categoria: 'venda', titulo: `Repor ${p.nome}`, detalhe: `Comprou há ${p.diasDesdeUltima} dias; costuma durar ${p.intervaloDias} dias. Há estoque.` });
  }

  // ── o que outros clientes levam junto ──
  const jaConsumiu = new Set(linhas.map((l) => l.chave));
  const principais = consumo.maisConsumidos.filter((i) => i.tipo === 'servico').slice(0, 2);
  if (principais.length) {
    const desde = diaLocal(new Date(Date.parse(`${hoje}T12:00:00Z`) - 180 * DIA_MS), 'UTC');
    const coo = coOcorrencias(comandasEmpresa, { desdeDia: desde, fuso });
    const emEstoque = new Map(produtos.filter((p) => p.ativo !== false).map((p) => [String(p.id), Number(p.estoqueAtual || 0)]));
    const candidatos = new Map();
    for (const base of principais) {
      const reg = coo.get(base.chave);
      if (!reg || reg.total < 5) continue; // amostra mínima para não sugerir por acaso
      for (const [chave, j] of reg.junto) {
        if (jaConsumiu.has(chave)) continue;
        if (j.tipo === 'produto' && !(emEstoque.get(String(j.produtoId)) > 0)) continue;
        const taxa = j.n / reg.total;
        if (taxa < 0.15) continue;
        const atual = candidatos.get(chave);
        if (!atual || taxa > atual.taxa) candidatos.set(chave, { chave, nome: j.nome, tipo: j.tipo, taxa, base: base.nome, n: j.n, total: reg.total });
      }
    }
    for (const c of [...candidatos.values()].sort((a, b) => b.taxa - a.taxa).slice(0, 4)) {
      add({ id: `coo-${c.chave}`, categoria: 'venda', titulo: `${c.tipo === 'servico' ? 'Oferecer' : 'Apresentar'} ${c.nome}`, detalhe: `${Math.round(c.taxa * 100)}% de quem faz ${c.base} também ${c.tipo === 'servico' ? 'faz' : 'leva'} (${c.n} de ${c.total} comandas em 6 meses). Ele ainda não ${c.tipo === 'servico' ? 'fez' : 'levou'}.` });
    }
  }

  // ── aniversários ──
  const aniversarioCliente = cliente ? proximoAniversario(cliente, hoje) : null;
  if (aniversarioCliente && aniversarioCliente.dias <= 30) {
    add({ id: 'aniv-cliente', categoria: 'relacionamento', prioridade: aniversarioCliente.dias <= 7 ? 1 : 2, titulo: `Aniversário do cliente ${quandoDias(aniversarioCliente.dias)}`, detalhe: `${aniversarioCliente.idade ? `Faz ${aniversarioCliente.idade} anos. ` : ''}Bom momento para um mimo ou condição especial no próximo atendimento.` });
  }
  for (const membro of familia) {
    const a = membro.proximoAniversario;
    if (!a || a.dias > 30) continue;
    const quem = `${membro.nome} (${membro.relacaoNome.toLowerCase()})`;
    const detalhe = membro.ehFilho
      ? `${a.idade ? `Faz ${a.idade} anos. ` : ''}Sugira agendar o corte dele(a) junto com o do pai.`
      : `Sugira um presente${preferencias?.perfumes ? ` — ele gosta de perfumes ${preferencias.perfumes.toLowerCase()}; veja na Loja Dino` : ' da Loja Dino (perfumes e kits)'}.`;
    add({ id: `aniv-${membro.id}`, categoria: 'relacionamento', prioridade: a.dias <= 7 ? 1 : 2, titulo: `Aniversário de ${quem} ${quandoDias(a.dias)}`, detalhe });
  }

  // ── loja online e financeiro ──
  if (Number(kpis.carrinhosAbertos) > 0) add({ id: 'carrinho', categoria: 'venda', titulo: 'Carrinho aberto na loja online', detalhe: `${plural(Number(kpis.carrinhosAbertos), 'carrinho', 'carrinhos')} sem finalizar. Pergunte se quer levar no balcão.` });
  if (Number(kpis.aReceber) > 0) add({ id: 'receber', categoria: 'atencao', prioridade: 1, titulo: 'Valor em aberto na conta', detalhe: `R$ ${Number(kpis.aReceber).toFixed(2).replace('.', ',')} a receber. Confira antes de lançar nova compra na conta.` });

  sugestoes.sort((a, b) => a.prioridade - b.prioridade);
  return {
    geradoEm: new Date(agora).toISOString(),
    consumo,
    linhas: linhas.slice(0, 300),
    familia,
    familiaConsentimento: cliente?.familiaConsentimento || null,
    preferencias,
    redesSociais: { instagram: redes.instagram || '', linkedin: redes.linkedin || '' },
    aniversario: aniversarioCliente,
    planos: coberturas.map((c) => ({ assinaturaId: c.assinaturaId, planoNome: c.planoNome, servicosNomes: c.servicosNomes || [], todosOsServicos: Boolean(c.todosOsServicos), sessoesNoCiclo: c.sessoesNoCiclo, sessoesUsadas: c.sessoesUsadas, sessoesRestantes: c.sessoesRestantes, cicloFim: c.cicloFim || null, utilizavel: c.utilizavel, situacaoPagamento: c.situacaoPagamento, motivo: c.motivo || null })),
    dicas,
    sugestoes,
    contatoMarketing: { whatsapp: marketingWhatsapp },
  };
}
