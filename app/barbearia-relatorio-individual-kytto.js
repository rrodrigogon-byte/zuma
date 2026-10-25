// KYTTO — Relatórios Individuais de Produtividade, Metas, Comissões e Bonificações.
//
// Suporta:
// 1. Faturamento bruto total separado (serviços vs produtos vs pacotes) com comissões independentes;
// 2. Relatório de serviços por categoria (cortes, barbas, procedimentos);
// 3. Relatório de pacotes e planos (atendimentos, assinaturas ativas, rateio do pote);
// 4. Relatório de serviços extras (hidratações, sobrancelhas, pigmentações, selagens, etc.) com clientes que fizeram;
// 5. Relatório de produtos com quantidades, faturamento e comissão separada;
// 6. Evolução de metas e bonificações progressivas em tempo real (faixas, bônus, quanto falta);
// 7. Filtros ágeis por dia, semana, quinzena, mês ou personalizado, para profissional individual ou equipe inteira.

import * as barbearia from './barbearia-erp-kytto.js';
import * as repassesKytto from './barbearia-repasses-kytto.js';
import * as captacao from './dino-captacao-kytto.js';

const dinheiro = (v) => Number((Number(v) || 0).toFixed(2));
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);

const TIME_ZONE = process.env.KYTTO_TIMEZONE || 'America/Cuiaba';
const FORMATADOR_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export function hojeOperacional(data = new Date()) {
  return FORMATADOR_DIA.format(data instanceof Date ? data : new Date(data));
}

/**
 * Calcula início e fim para os períodos rápidos da barbearia:
 * 'dia' (hoje), 'semana' (segunda a domingo), 'quinzena' (1 a 15 ou 16 ao fim do mês), 'mes' (1 ao fim do mês).
 */
export function resolverPeriodo(tipo = 'mes', { inicio: customInicio = '', fim: customFim = '', dataReferencia = new Date() } = {}) {
  const refStr = hojeOperacional(dataReferencia);
  const [anoStr, mesStr, diaStr] = refStr.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);

  const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const ultimoDiaFormatado = `${anoStr}-${mesStr}-${String(ultimoDiaMes).padStart(2, '0')}`;
  const primeiroDiaFormatado = `${anoStr}-${mesStr}-01`;

  if (tipo === 'custom' && customInicio && customFim) {
    const ini = String(customInicio).slice(0, 10);
    const end = String(customFim).slice(0, 10);
    return { tipo: 'custom', inicio: ini, fim: end, label: `Período ${ini.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}` };
  }

  if (tipo === 'dia' || tipo === 'hoje') {
    return { tipo: 'dia', inicio: refStr, fim: refStr, label: `Hoje (${refStr.split('-').reverse().join('/')})` };
  }

  if (tipo === 'semana') {
    const d = new Date(`${refStr}T12:00:00Z`);
    const diaSemana = d.getUTCDay(); // 0 = Domingo, 1 = Segunda ...
    const diffParaSegunda = (diaSemana + 6) % 7; // Segunda vira 0
    const seg = new Date(d.getTime() - diffParaSegunda * 86400000);
    const dom = new Date(seg.getTime() + 6 * 86400000);
    const segStr = FORMATADOR_DIA.format(seg);
    const domStr = FORMATADOR_DIA.format(dom);
    return { tipo: 'semana', inicio: segStr, fim: domStr, label: `Esta Semana (${segStr.split('-').reverse().join('/')} a ${domStr.split('-').reverse().join('/')})` };
  }

  if (tipo === 'quinzena') {
    if (dia <= 15) {
      const fimQuinzena = `${anoStr}-${mesStr}-15`;
      return { tipo: 'quinzena', quinzenaNumero: 1, inicio: primeiroDiaFormatado, fim: fimQuinzena, label: `1ª Quinzena (${primeiroDiaFormatado.split('-').reverse().join('/')} a 15/${mesStr}/${anoStr})` };
    } else {
      const inicioQuinzena = `${anoStr}-${mesStr}-16`;
      return { tipo: 'quinzena', quinzenaNumero: 2, inicio: inicioQuinzena, fim: ultimoDiaFormatado, label: `2ª Quinzena (16/${mesStr}/${anoStr} a ${ultimoDiaFormatado.split('-').reverse().join('/')})` };
    }
  }

  // Padrão: 'mes'
  return { tipo: 'mes', inicio: primeiroDiaFormatado, fim: ultimoDiaFormatado, label: `Mês de ${mesStr}/${anoStr}` };
}

// Classificação de categorias e detecção de procedimentos extras
const PALAVRAS_EXTRAS = [
  'hidrat', 'sobrancelha', 'pigmenta', 'selagem', 'botox', 'luzes', 'platinado',
  'limpeza de pele', 'relaxamento', 'alisamento', 'terapia capilar', 'ozonio',
  'depila', 'escova', 'tonaliza', 'tintura', 'colora', 'descolora', 'massagem',
  'peeling', 'vapor', 'alinhamento'
];

export function ehServicoExtra(servicoNome = '', categoria = '') {
  const nomeNorm = String(servicoNome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const catNorm = String(categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (['procedimentos', 'química', 'quimica', 'extras', 'tratamentos', 'estética', 'estetica'].some((c) => catNorm.includes(c))) {
    return true;
  }
  return PALAVRAS_EXTRAS.some((palavra) => nomeNorm.includes(palavra));
}

export function categorizarServico(servicoNome = '', categoriaCadastrada = '') {
  const cat = String(categoriaCadastrada || '').trim();
  if (cat && cat !== 'Geral' && cat !== 'Padrão' && cat !== 'Outros') return cat;

  if (ehServicoExtra(servicoNome, categoriaCadastrada)) {
    return 'Procedimentos & Extras';
  }
  const nome = String(servicoNome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (nome.includes('barba') || nome.includes('barboterapia') || nome.includes('bigode') || nome.includes('cavanhaque')) {
    return 'Barba & Modelagem';
  }
  if (nome.includes('corte') || nome.includes('cabelo') || nome.includes('fade') || nome.includes('degrade') || nome.includes('tesoura') || nome.includes('maquina') || nome.includes('pezinho') || nome.includes('acabamento') || nome.includes('infantil')) {
    return 'Cabelo & Cortes';
  }
  return 'Outros Procedimentos';
}

/**
 * Gera o relatório individual completo do profissional para o período especificado.
 */
export function relatorioIndividualProfissional(empresaId, profissionalId, opcoes = {}) {
  const profId = String(profissionalId || '');
  const profissionais = barbearia.listarProfissionais(empresaId, { incluirInativos: true });
  const prof = profissionais.find((p) => p.id === profId);
  if (!prof) {
    throw new Error(`Profissional com ID "${profId}" não encontrado.`);
  }

  const periodo = resolverPeriodo(opcoes.periodo || 'mes', opcoes);
  const { inicio, fim } = periodo;

  // Comissões com detalhamento e aplicação automática de bonificações de metas
  const comissoesResultado = barbearia.obterComissoes(empresaId, {
    inicio,
    fim,
    detalhar: true,
    profissionalId: prof.id,
    lojaId: opcoes.lojaId || '',
    strictUnit: Boolean(opcoes.lojaId),
  });

  const linhaProf = (comissoesResultado.porProfissional || []).find((p) => p.profissionalId === prof.id) || {
    linhas: [],
    bruto: 0,
    brutoServicos: 0,
    brutoProdutos: 0,
    taxas: 0,
    materiais: 0,
    comissaoServicos: 0,
    comissaoProdutos: 0,
    repasse: 0,
    atendimentos: 0,
    vendasProdutos: 0,
    metasServico: barbearia.calcularFaixaBonificacao(0, prof.percentualComissao, prof.faixasComissaoServico),
    metasProduto: barbearia.calcularFaixaBonificacao(0, prof.percentualComissaoProduto, prof.faixasComissaoProduto),
  };

  // Pote dos planos
  const poteInfo = repassesKytto.poteDosPlanos(empresaId, { inicio, fim, lojaId: opcoes.lojaId || '' });
  const poteProf = poteInfo.porProfissional.get(prof.id) || { valor: 0, detalhes: [] };

  // Vales abertos e repasses
  const valesAbertos = repassesKytto.listarVales(empresaId, { profissionalId: prof.id, status: 'aberto', lojaId: opcoes.lojaId || '' });
  const totalVales = dinheiro(valesAbertos.reduce((soma, v) => soma + Number(v.valor || 0), 0));

  // Separar linhas de serviços e produtos
  const linhasServicos = (linhaProf.linhas || []).filter((l) => l.tipo === 'servico');
  const linhasProdutos = (linhaProf.linhas || []).filter((l) => l.tipo === 'produto');

  // 1. FATURAMENTO TOTAL BRUTO & COMISSÕES SEPARADAS
  const brutoServicos = dinheiro(linhaProf.brutoServicos);
  const brutoProdutos = dinheiro(linhaProf.brutoProdutos);
  const brutoPlanos = dinheiro(poteProf.valor);
  const faturamentoBrutoTotal = dinheiro(brutoServicos + brutoProdutos + brutoPlanos);

  const comissaoServicos = dinheiro(linhaProf.comissaoServicos);
  const comissaoProdutos = dinheiro(linhaProf.comissaoProdutos);
  const comissaoPlanos = dinheiro(poteProf.valor);
  const comissaoTotal = dinheiro(comissaoServicos + comissaoProdutos + comissaoPlanos);

  // Diferença do bônus (quanto o bônus gerou a mais para o profissional)
  const metasServico = linhaProf.metasServico || barbearia.calcularFaixaBonificacao(brutoServicos, prof.percentualComissao, prof.faixasComissaoServico);
  const metasProduto = linhaProf.metasProduto || barbearia.calcularFaixaBonificacao(brutoProdutos, prof.percentualComissaoProduto, prof.faixasComissaoProduto);

  const baseCalculoServicos = dinheiro(Math.max(0, brutoServicos - Number(linhaProf.taxas || 0) - Number(linhaProf.materiais || 0)));
  const baseCalculoProdutos = dinheiro(Math.max(0, brutoProdutos - Number(linhaProf.taxas || 0)));

  const bonusServicosValor = metasServico.bonusPercentual > 0 ? dinheiro(baseCalculoServicos * metasServico.bonusPercentual / 100) : 0;
  const bonusProdutosValor = metasProduto.bonusPercentual > 0 ? dinheiro(baseCalculoProdutos * metasProduto.bonusPercentual / 100) : 0;

  // 2. RELATÓRIO DE SERVIÇOS AGRUPADO POR CATEGORIA
  const mapaCategorias = new Map();
  for (const item of linhasServicos) {
    const cat = categorizarServico(item.descricao, item.categoria);
    const grupo = mapaCategorias.get(cat) || { categoria: cat, quantidade: 0, faturamento: 0, itens: new Map() };
    grupo.quantidade += Number(item.quantidade || 1);
    grupo.faturamento = dinheiro(grupo.faturamento + Number(item.bruto || 0));

    const itemNome = item.descricao || 'Serviço';
    const sub = grupo.itens.get(itemNome) || { nome: itemNome, quantidade: 0, faturamento: 0 };
    sub.quantidade += Number(item.quantidade || 1);
    sub.faturamento = dinheiro(sub.faturamento + Number(item.bruto || 0));
    grupo.itens.set(itemNome, sub);

    mapaCategorias.set(cat, grupo);
  }

  const relatorioServicosPorCategoria = Array.from(mapaCategorias.values())
    .map((g) => ({
      categoria: g.categoria,
      quantidade: g.quantidade,
      faturamento: g.faturamento,
      ticketMedio: g.quantidade > 0 ? dinheiro(g.faturamento / g.quantidade) : 0,
      itens: Array.from(g.itens.values())
        .map((it) => ({ ...it, ticketMedio: it.quantidade > 0 ? dinheiro(it.faturamento / it.quantidade) : 0 }))
        .sort((a, b) => b.faturamento - a.faturamento),
    }))
    .sort((a, b) => b.faturamento - a.faturamento);

  // 3. RELATÓRIO DE PACOTES E PLANOS
  // Coleta assinaturas ativas na empresa e usos pelo plano no período
  const planosCatalogo = barbearia.listarPlanos(empresaId, { incluirInativos: true });
  const assinaturasEmpresa = barbearia.listarAssinaturas(empresaId);

  const atendimentosPeloPlano = [];
  for (const det of poteProf.detalhes || []) {
    atendimentosPeloPlano.push({
      planoId: det.planoId,
      planoNome: det.plano,
      pontos: det.pontos,
      usos: det.usos,
      valorFixo: det.valorFixo,
      valorTotal: det.valor,
    });
  }

  // 4. RELATÓRIO DE SERVIÇOS EXTRAS COM CLIENTES NOMINAIS
  const listaServicosExtras = [];
  const resumoExtras = new Map();
  for (const item of linhasServicos) {
    if (ehServicoExtra(item.descricao, item.categoria)) {
      listaServicosExtras.push({
        data: item.data,
        servico: item.descricao,
        cliente: item.cliente || 'Cliente avulso',
        comandaId: item.origemId || '',
        valor: item.bruto,
        comissao: item.comissao,
      });

      const ex = resumoExtras.get(item.descricao) || { nome: item.descricao, quantidade: 0, faturamento: 0 };
      ex.quantidade += Number(item.quantidade || 1);
      ex.faturamento = dinheiro(ex.faturamento + Number(item.bruto || 0));
      resumoExtras.set(item.descricao, ex);
    }
  }

  const relatorioServicosExtras = {
    quantidadeTotal: listaServicosExtras.length,
    faturamentoTotal: dinheiro(listaServicosExtras.reduce((s, it) => s + it.valor, 0)),
    resumo: Array.from(resumoExtras.values()).sort((a, b) => b.faturamento - a.faturamento),
    clientesAtendidos: listaServicosExtras.sort((a, b) => String(b.data).localeCompare(String(a.data))),
  };

  // 5. RELATÓRIO DE PRODUTOS VENDIDOS COM COMISSÃO SEPARADA
  const mapaProdutos = new Map();
  for (const linha of linhasProdutos) {
    const itens = Array.isArray(linha.itens) && linha.itens.length > 0
      ? linha.itens
      : [{ nome: linha.descricao.replace(/^\d+×\s*/, ''), quantidade: linha.quantidade || 1, subtotal: linha.bruto }];

    for (const item of itens) {
      const nome = item.nome || linha.descricao || 'Produto';
      const qtd = Number(item.quantidade || 1);
      const subtotal = Number(item.subtotal || linha.bruto || 0);
      const prod = mapaProdutos.get(nome) || { nome, quantidade: 0, faturamentoBruto: 0, comissaoTotal: 0, clientes: new Set() };
      prod.quantidade += qtd;
      prod.faturamentoBruto = dinheiro(prod.faturamentoBruto + subtotal);
      prod.comissaoTotal = dinheiro(prod.comissaoTotal + (subtotal * metasProduto.percentualEfetivo / 100));
      if (linha.cliente) prod.clientes.add(linha.cliente);
      mapaProdutos.set(nome, prod);
    }
  }

  const relatorioProdutos = {
    unidadesVendidas: linhasProdutos.reduce((s, it) => s + Number(it.quantidade || 1), 0),
    faturamentoBruto: brutoProdutos,
    percentualComissaoBase: Number(prof.percentualComissaoProduto || 0),
    percentualEfetivo: metasProduto.percentualEfetivo,
    bonusPercentual: metasProduto.bonusPercentual,
    comissaoTotal: comissaoProdutos,
    bonusValor: bonusProdutosValor,
    itens: Array.from(mapaProdutos.values()).map((p) => ({
      nome: p.nome,
      quantidade: p.quantidade,
      faturamentoBruto: p.faturamentoBruto,
      valorUnitarioMedio: p.quantidade > 0 ? dinheiro(p.faturamentoBruto / p.quantidade) : 0,
      comissaoTotal: p.comissaoTotal,
      clientes: Array.from(p.clientes).sort(),
    })).sort((a, b) => b.faturamentoBruto - a.faturamentoBruto),
  };

  // Resumo Geral Consolidado
  return {
    profissional: {
      id: prof.id,
      nome: prof.nome,
      especialidade: prof.especialidade || 'Barbeiro',
      tipo: prof.tipo || 'parceiro',
      fotoUrl: prof.fotoUrl || '',
      percentualComissaoServico: Number(prof.percentualComissao || 0),
      percentualComissaoProduto: Number(prof.percentualComissaoProduto || 0),
      faixasComissaoServico: prof.faixasComissaoServico || [],
      faixasComissaoProduto: prof.faixasComissaoProduto || [],
      descontaTaxaMaquininha: prof.descontaTaxaMaquininha !== false,
      descontaMaterial: Boolean(prof.descontaMaterial),
    },
    periodo,
    faturamento: {
      brutoTotal: faturamentoBrutoTotal,
      brutoServicos,
      brutoProdutos,
      brutoPlanos,
      taxas: dinheiro(linhaProf.taxas),
      materiais: dinheiro(linhaProf.materiais),
      comissaoServicos,
      comissaoProdutos,
      comissaoPlanos,
      comissaoTotal,
      bonusServicosValor,
      bonusProdutosValor,
      bonusTotalValor: dinheiro(bonusServicosValor + bonusProdutosValor),
      valesAbertos: totalVales,
      repasseLiquido: dinheiro(Math.max(0, comissaoTotal - totalVales)),
      totalAtendimentos: linhasServicos.length,
      totalVendasProdutos: linhasProdutos.length,
      ticketMedioServicos: linhasServicos.length > 0 ? dinheiro(brutoServicos / linhasServicos.length) : 0,
    },
    metasEvolucao: {
      servicos: metasServico,
      produtos: metasProduto,
    },
    servicosPorCategoria: relatorioServicosPorCategoria,
    pacotesEPlanos: {
      atendimentosPeloPlano,
      totalValorPote: brutoPlanos,
      planosAtivosNaEmpresa: planosCatalogo.filter((p) => p.ativo !== false).map((p) => ({ id: p.id, nome: p.nome, precoMensal: p.precoMensal, percentualPote: p.percentualPote })),
      assinaturasAtivasTotal: assinaturasEmpresa.filter((a) => a.status === 'ativa').length,
    },
    servicosExtras: relatorioServicosExtras,
    produtos: relatorioProdutos,
    extratoLinhas: linhaProf.linhas || [],
  };
}

/**
 * Panorama geral de toda a equipe para o período: metas, faturamento e ranking.
 */
export function relatorioEquipeMetasComissoes(empresaId, opcoes = {}) {
  const profissionais = barbearia.listarProfissionais(empresaId, { incluirInativos: false });
  const periodo = resolverPeriodo(opcoes.periodo || 'mes', opcoes);

  const relatorios = profissionais.map((p) => {
    try {
      return relatorioIndividualProfissional(empresaId, p.id, { ...opcoes, periodo: periodo.tipo, inicio: periodo.inicio, fim: periodo.fim });
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Ordena pelo faturamento bruto total descrescente
  relatorios.sort((a, b) => b.faturamento.brutoTotal - a.faturamento.brutoTotal);

  const totaisGerais = {
    faturamentoBrutoTotal: dinheiro(relatorios.reduce((s, r) => s + r.faturamento.brutoTotal, 0)),
    faturamentoServicos: dinheiro(relatorios.reduce((s, r) => s + r.faturamento.brutoServicos, 0)),
    faturamentoProdutos: dinheiro(relatorios.reduce((s, r) => s + r.faturamento.brutoProdutos, 0)),
    comissaoTotalGeral: dinheiro(relatorios.reduce((s, r) => s + r.faturamento.comissaoTotal, 0)),
    bonusTotalGeral: dinheiro(relatorios.reduce((s, r) => s + r.faturamento.bonusTotalValor, 0)),
    totalAtendimentos: relatorios.reduce((s, r) => s + r.faturamento.totalAtendimentos, 0),
    totalProdutosVendidos: relatorios.reduce((s, r) => s + r.faturamento.totalVendasProdutos, 0),
  };

  return {
    periodo,
    totaisGerais,
    equipe: relatorios.map((r, index) => ({
      posicao: index + 1,
      profissional: r.profissional,
      faturamento: r.faturamento,
      metasEvolucao: r.metasEvolucao,
    })),
  };
}
