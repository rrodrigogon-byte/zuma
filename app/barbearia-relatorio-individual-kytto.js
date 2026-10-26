
// Cache em memória de alta performance para relatórios individuais e equipe (TTL: 30s)
const _cacheRelatorios = new Map();
const TTL_CACHE_RELATORIOS_MS = 30_000;
// KYTTO — Relatórios Individuais de Produtividade, Metas, Comissões e Bonificações.
//
// Suporta:
// 1. Faturamento bruto total separado (serviços vs produtos vs pacotes) com comissões independentes;
// 2. Relatório de serviços por categoria com categorização inteligente de procedimentos (Cabelo, Barba, Combos, Prótese, Extras);
// 3. Separação contábil clara entre atendimentos avulsos pagos e atendimentos cobertos por Clube / Pacote;
// 4. Relatório de pacotes e planos (atendimentos, assinaturas ativas, rateio do pote);
// 5. Relatório de serviços extras (hidratações, sobrancelhas, pigmentações, selagens, etc.) com clientes que fizeram;
// 6. Relatório de produtos com quantidades, faturamento e comissão separada;
// 7. Evolução de metas e bonificações progressivas em tempo real (faixas, bônus, quanto falta);
// 8. Filtros ágeis por todo o histórico, mês, quinzena, semana, dia ou personalizado;
// 9. Integração completa: dados operacionais ao vivo do Kytto + histórico completo do banco (Avec/legado).

import * as barbearia from './barbearia-erp-kytto.js';
import * as repassesKytto from './barbearia-repasses-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import { normalizarNomeProfissional, profissionalKyttoDoAvec } from './dino-vinculos-avec.js';

const dinheiro = (v) => Number((Number(v) || 0).toFixed(2));
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);

const TIME_ZONE = process.env.KYTTO_TIMEZONE || 'America/Cuiaba';
const FORMATADOR_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export function hojeOperacional(data = new Date()) {
  return FORMATADOR_DIA.format(data instanceof Date ? data : new Date(data));
}

/**
 * Calcula início e fim para os períodos rápidos da barbearia:
 * 'tudo' (todo o histórico), 'dia' (hoje), 'semana' (segunda a domingo), 'quinzena' (1 a 15 ou 16 ao fim do mês), 'mes' (1 ao fim do mês).
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

  if (tipo === 'tudo' || tipo === 'historico' || tipo === 'completo' || tipo === 'total') {
    return { tipo: 'tudo', inicio: '1900-01-01', fim: '2099-12-31', label: 'Todo o Histórico Completo' };
  }

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
  if (tipo === 'mesAnterior' || tipo === 'mes_anterior') {
    const dAnt = new Date(ano, mes - 2, 1);
    const anoAnt = dAnt.getFullYear();
    const mesAnt = String(dAnt.getMonth() + 1).padStart(2, '0');
    const ultDiaAnt = new Date(anoAnt, dAnt.getMonth() + 1, 0).getDate();
    const deStr = `${anoAnt}-${mesAnt}-01`;
    const ateStr = `${anoAnt}-${mesAnt}-${String(ultDiaAnt).padStart(2, '0')}`;
    return { tipo: 'mesAnterior', inicio: deStr, fim: ateStr, label: `Mês Anterior (${mesAnt}/${anoAnt})` };
  }
  if (tipo === 'ano' || tipo === 'esteAno') {
    return { tipo: 'ano', inicio: `${anoStr}-01-01`, fim: `${anoStr}-12-31`, label: `Ano de ${anoStr}` };
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

export function ehProduto(nomeItem = '', frenteAtuacao = '') {
  const frente = String(frenteAtuacao || '').toLowerCase();
  if (frente.includes('revenda') || frente.includes('produto')) return true;
  const n = String(nomeItem || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ['pomada', 'oleo', 'óleo', 'shampoo', 'condicionador', 'tonico', 'tônico', 'cera', 'balm', 'gel', 'creme', 'minoxidil', 'pasta', 'loção', 'locao', 'spray', 'pente', 'escova de madeira'].some((p) => n.includes(p));
}

const CATEGORIAS_GENERICAS = new Set([
  'geral', 'padrao', 'padrão', 'outros', 'historico avec', 'histórico avec',
  'historico', 'avec', 'sem categoria', 'diversos', 'sem_categoria', ''
]);

export function categorizarServico(servicoNome = '', categoriaCadastrada = '') {
  const cat = String(categoriaCadastrada || '').trim();
  const catNorm = cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nome = String(servicoNome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // 1. Prótese Capilar
  if (nome.includes('protese') || catNorm.includes('protese')) {
    return 'Prótese Capilar';
  }

  // 2. Combos (Corte + Barba)
  const temCorte = nome.includes('corte') || nome.includes('cabelo') || nome.includes('fade') || nome.includes('degrade') || nome.includes('navalhad') || nome.includes('pezinho') || nome.includes('acabamento') || nome.includes('infantil') || nome.includes('social') || nome.includes('maquina');
  const temBarba = nome.includes('barba') || nome.includes('barboterapia') || nome.includes('bigode') || nome.includes('cavanhaque');
  if (temCorte && temBarba) {
    return 'Combos (Cabelo + Barba)';
  }

  // 3. Extras e Procedimentos Especiais
  if (ehServicoExtra(servicoNome, categoriaCadastrada)) {
    return 'Procedimentos & Extras';
  }

  // 4. Se a categoria cadastrada for específica (não genérica), aproveita ela
  if (cat && !CATEGORIAS_GENERICAS.has(catNorm)) {
    if (catNorm.includes('cabelo') || catNorm.includes('corte')) return 'Cabelo & Cortes';
    if (catNorm.includes('barba')) return 'Barba & Modelagem';
    return cat;
  }

  // 5. Cabelo isolado
  if (temCorte) {
    return 'Cabelo & Cortes';
  }

  // 6. Barba isolada
  if (temBarba) {
    return 'Barba & Modelagem';
  }

  return 'Outros Procedimentos';
}

/**
 * Encontra o profissional correspondente no cadastro do Kytto, resolvendo vínculos do histórico Avec,
 * nome social, alias (ex.: Naty -> Natani) ou primeiro nome único.
 */
export function encontrarProfissionalCorrespondente(nome, profissionais = []) {
  if (!nome || !profissionais.length) return null;
  const porVinculo = profissionalKyttoDoAvec(nome, profissionais);
  if (porVinculo) return porVinculo;

  const norm = normalizarNomeProfissional(nome);
  const porNomeExato = profissionais.find((p) => normalizarNomeProfissional(p.nome) === norm);
  if (porNomeExato) return porNomeExato;

  if (norm === 'naty' || norm.startsWith('naty ') || norm.includes('natani') || norm.includes('dobler')) {
    const natani = profissionais.find((p) => normalizarNomeProfissional(p.nome).startsWith('natan') || normalizarNomeProfissional(p.nome) === 'naty');
    if (natani) return natani;
  }

  const primeiro = norm.split(' ')[0];
  if (primeiro.length >= 3) {
    const candidatos = profissionais.filter((p) => normalizarNomeProfissional(p.nome).split(' ')[0] === primeiro);
    if (candidatos.length === 1) return candidatos[0];
  }

  return null;
}

/**
 * Gera o relatório individual completo do profissional para o período especificado,
 * integrando a operação ao vivo do Kytto com todo o histórico persistido do banco (Avec).
 */
export function relatorioIndividualProfissional(empresaId, profissionalId, opcoes = {}) {
  const profId = String(profissionalId || '');
  const periodo = resolverPeriodo(opcoes.periodo || 'mes', opcoes);
  const { inicio, fim } = periodo;

  // Cache check para navegação instantânea
  const cacheKey = `rel_ind:${empresaId}:${profId}:${opcoes.lojaId || ''}:${periodo.tipo}:${inicio}:${fim}`;
  const cached = _cacheRelatorios.get(cacheKey);
  const agoraMs = Date.now();
  if (cached && agoraMs - cached.ts < TTL_CACHE_RELATORIOS_MS) {
    return { ...cached.data };
  }

  const profissionais = barbearia.listarProfissionais(empresaId, { incluirInativos: true });
  const prof = profissionais.find((p) => p.id === profId);
  if (!prof) {
    throw new Error(`Profissional com ID "${profId}" não encontrado.`);
  }

  // 1. DADOS AO VIVO DO KYTTO (Comandas e Agendamentos concluidos)
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
  };

  const chavesAoVivo = new Set(linhaProf.linhas.map((l) => `${l.data}|${l.cliente}|${l.descricao}`));

  // 2. HISTÓRICO COMPLETO DA BASE (AVEC / IMPORTADO / LEGADO)
  const linhasHistorico = [];
  try {
    const historicoAtendimentos = barbearia.listarHistoricoAtendimentos(empresaId, {});
    for (const item of historicoAtendimentos) {
      const dataAgenda = String(item.dataAgenda || item.dataHora || '').slice(0, 10);
      if (inicio && dataAgenda < inicio) continue;
      if (fim && dataAgenda > fim) continue;
      if (opcoes.lojaId && item.lojaId && String(item.lojaId) !== String(opcoes.lojaId)) continue;

      // Verifica se o registro pertence a este profissional
      const corresp = item.profissionalId === prof.id
        ? prof
        : encontrarProfissionalCorrespondente(item.profissionalNome || item.nome, profissionais);

      if (corresp?.id !== prof.id) continue;

      const valorBruto = dinheiro(item.total ?? item.valor ?? 0);
      const descItem = item.servicoNome || item.descricao || 'Atendimento';
      const clienteNome = item.clienteNome || 'Cliente Eventual';

      // Evita duplicidade se o mesmo atendimento já estiver na comanda ao vivo
      if (chavesAoVivo.has(`${dataAgenda}|${clienteNome}|${descItem}`)) continue;

      const isProd = ehProduto(descItem, item.frenteAtuacao);
      const isClub = valorBruto <= 0 || repassesKytto.ehAtendimentoClubAvec(item, valorBruto);

      linhasHistorico.push({
        tipo: isProd ? 'produto' : 'servico',
        data: dataAgenda,
        origemTipo: 'historico_avec',
        origemId: item.id || item.numeroComanda || '',
        cliente: clienteNome,
        descricao: descItem,
        servicoId: item.servicoId || null,
        quantidade: Number(item.quantidade || 1),
        bruto: valorBruto,
        taxa: 0,
        material: 0,
        base: valorBruto,
        percentual: isProd ? Number(prof.percentualComissaoProduto || 10) : Number(prof.percentualComissao || 40),
        comissao: dinheiro(valorBruto * (isProd ? Number(prof.percentualComissaoProduto || 10) : Number(prof.percentualComissao || 40)) / 100),
        club: isClub,
      });
    }
  } catch (e) {
    console.warn('[RelatorioIndividual] Aviso ao carregar histórico Avec:', e.message);
  }

  // Consolidação de todas as linhas de produção (ao vivo + histórico completo)
  const todasAsLinhas = [...(linhaProf.linhas || []), ...linhasHistorico];
  todasAsLinhas.sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const linhasServicos = todasAsLinhas.filter((l) => l.tipo === 'servico');
  const linhasProdutos = todasAsLinhas.filter((l) => l.tipo === 'produto');

  const brutoServicos = dinheiro(linhasServicos.reduce((s, l) => s + Number(l.bruto || 0), 0));
  const brutoProdutos = dinheiro(linhasProdutos.reduce((s, l) => s + Number(l.bruto || 0), 0));

  // 3. PACOTES E PLANOS (POTE)
  let brutoPlanos = 0;
  let atendimentosPeloPlano = [];
  try {
    const pote = repassesKytto.poteDosPlanos(empresaId, { inicio, fim, lojaId: opcoes.lojaId });
    const detalheProf = pote.porProfissional.get(prof.id);
    if (detalheProf) {
      brutoPlanos = dinheiro(detalheProf.valor);
      atendimentosPeloPlano = detalheProf.detalhes || [];
    }
  } catch (e) {
    brutoPlanos = 0;
  }

  // Atendimentos do Clube no período (inclui linhas marcadas como Club e atendimentos com valor 0)
  const atendimentosClubLinhas = linhasServicos.filter((l) => l.club === true || Number(l.bruto || 0) === 0);

  // 4. EVOLUÇÃO DE METAS E BONIFICAÇÕES EM TEMPO REAL
  const metasServico = barbearia.calcularFaixaBonificacao(
    brutoServicos,
    prof.percentualComissao,
    prof.faixasComissaoServico
  );

  const metasProduto = barbearia.calcularFaixaBonificacao(
    brutoProdutos,
    prof.percentualComissaoProduto,
    prof.faixasComissaoProduto
  );

  // Recalcula comissões efetivas aplicando os bônus conquistados por metas
  const comissaoServicos = dinheiro(brutoServicos * metasServico.percentualEfetivo / 100);
  const comissaoProdutos = dinheiro(brutoProdutos * metasProduto.percentualEfetivo / 100);
  const comissaoPlanos = brutoPlanos;

  const faturamentoBrutoTotal = dinheiro(brutoServicos + brutoProdutos + brutoPlanos);
  const comissaoTotal = dinheiro(comissaoServicos + comissaoProdutos + comissaoPlanos);

  const bonusServicosValor = dinheiro(brutoServicos * metasServico.bonusPercentual / 100);
  const bonusProdutosValor = dinheiro(brutoProdutos * metasProduto.bonusPercentual / 100);

  // Vales abertos e repasse líquido
  let totalVales = 0;
  try {
    const valesAbertos = repassesKytto.listarVales(empresaId, { profissionalId: prof.id, status: 'aberto', lojaId: opcoes.lojaId });
    totalVales = dinheiro(valesAbertos.reduce((s, v) => s + v.valor, 0));
  } catch {
    totalVales = 0;
  }

  // 5. RELATÓRIO DE SERVIÇOS POR CATEGORIA (RECONCILIAÇÃO INTELIGENTE)
  const servicosCatalogo = barbearia.listarServicos(empresaId, { incluirInativos: true });
  const mapaServicosCatalogo = new Map(servicosCatalogo.map((s) => [s.id, s]));

  const categoriasMap = new Map();
  for (const item of linhasServicos) {
    const servicoCadastrado = item.servicoId ? mapaServicosCatalogo.get(item.servicoId) : null;
    const cat = categorizarServico(item.descricao, servicoCadastrado?.categoria);
    const dadosCat = categoriasMap.get(cat) || {
      categoria: cat,
      quantidadeTotal: 0,
      quantidadePaga: 0,
      quantidadeClube: 0,
      faturamento: 0,
      itens: new Map(),
    };

    const qtd = Number(item.quantidade || 1);
    const valor = Number(item.bruto || 0);
    const ehClube = item.club === true || valor === 0;

    dadosCat.quantidadeTotal += qtd;
    if (ehClube) {
      dadosCat.quantidadeClube += qtd;
    } else {
      dadosCat.quantidadePaga += qtd;
      dadosCat.faturamento = dinheiro(dadosCat.faturamento + valor);
    }

    const nomeServico = item.descricao;
    const dadoItem = dadosCat.itens.get(nomeServico) || {
      nome: nomeServico,
      quantidadeTotal: 0,
      quantidadePaga: 0,
      quantidadeClube: 0,
      faturamento: 0,
    };
    dadoItem.quantidadeTotal += qtd;
    if (ehClube) {
      dadoItem.quantidadeClube += qtd;
    } else {
      dadoItem.quantidadePaga += qtd;
      dadoItem.faturamento = dinheiro(dadoItem.faturamento + valor);
    }
    dadosCat.itens.set(nomeServico, dadoItem);

    categoriasMap.set(cat, dadosCat);
  }

  const relatorioServicosPorCategoria = Array.from(categoriasMap.values()).map((cat) => ({
    categoria: cat.categoria,
    quantidade: cat.quantidadeTotal,
    quantidadeTotal: cat.quantidadeTotal,
    quantidadePaga: cat.quantidadePaga,
    quantidadeClube: cat.quantidadeClube,
    faturamento: cat.faturamento,
    ticketMedio: cat.quantidadePaga > 0 ? dinheiro(cat.faturamento / cat.quantidadePaga) : 0,
    itens: Array.from(cat.itens.values()).map((it) => ({
      nome: it.nome,
      quantidade: it.quantidadeTotal,
      quantidadeTotal: it.quantidadeTotal,
      quantidadePaga: it.quantidadePaga,
      quantidadeClube: it.quantidadeClube,
      faturamento: it.faturamento,
      ticketMedio: it.quantidadePaga > 0 ? dinheiro(it.faturamento / it.quantidadePaga) : 0,
    })).sort((a, b) => b.faturamento - a.faturamento || b.quantidadeTotal - a.quantidadeTotal),
  })).sort((a, b) => b.faturamento - a.faturamento || b.quantidadeTotal - a.quantidadeTotal);

  // 6. RELATÓRIO DE SERVIÇOS EXTRAS COM CLIENTES NOMINAIS
  const itensExtrasNominais = [];
  const resumoExtrasMap = new Map();
  for (const item of linhasServicos) {
    const servicoCadastrado = item.servicoId ? mapaServicosCatalogo.get(item.servicoId) : null;
    if (ehServicoExtra(item.descricao, servicoCadastrado?.categoria)) {
      itensExtrasNominais.push({
        data: item.data,
        cliente: item.cliente || 'Cliente',
        servico: item.descricao,
        valor: item.bruto,
        comissao: item.comissao,
        comandaId: item.origemId || null,
        club: item.club || false,
      });

      const res = resumoExtrasMap.get(item.descricao) || { nome: item.descricao, quantidade: 0, faturamento: 0 };
      res.quantidade += Number(item.quantidade || 1);
      res.faturamento = dinheiro(res.faturamento + Number(item.bruto || 0));
      resumoExtrasMap.set(item.descricao, res);
    }
  }

  const relatorioServicosExtras = {
    quantidadeTotal: itensExtrasNominais.length,
    faturamentoTotal: dinheiro(itensExtrasNominais.reduce((s, it) => s + it.valor, 0)),
    resumo: Array.from(resumoExtrasMap.values()).sort((a, b) => b.faturamento - a.faturamento),
    clientesAtendidos: itensExtrasNominais,
  };

  // 7. RELATÓRIO DE PRODUTOS VENDIDOS COM COMISSÃO SEPARADA
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

  // Planos e assinaturas da unidade
  const planosCatalogo = barbearia.listarPlanos(empresaId, { incluirInativos: true });
  const assinaturasEmpresa = barbearia.listarAssinaturas(empresaId);

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
      totalAtendimentosAvulsos: linhasServicos.filter((l) => Number(l.bruto || 0) > 0 && !l.club).length,
      totalAtendimentosClube: atendimentosClubLinhas.length,
      totalVendasProdutos: linhasProdutos.length,
      ticketMedioServicos: linhasServicos.filter((l) => Number(l.bruto || 0) > 0).length > 0
        ? dinheiro(brutoServicos / linhasServicos.filter((l) => Number(l.bruto || 0) > 0).length)
        : 0,
    },
    metasEvolucao: {
      servicos: metasServico,
      produtos: metasProduto,
    },
    servicosPorCategoria: relatorioServicosPorCategoria,
    pacotesEPlanos: {
      totalAtendimentosClube: atendimentosClubLinhas.length,
      atendimentosPeloPlano,
      totalValorPote: brutoPlanos,
      planosAtivosNaEmpresa: planosCatalogo.filter((p) => p.ativo !== false).map((p) => ({ id: p.id, nome: p.nome, precoMensal: p.precoMensal, percentualPote: p.percentualPote })),
      assinaturasAtivasTotal: assinaturasEmpresa.filter((a) => a.status === 'ativa').length,
      linhasClube: atendimentosClubLinhas.slice(0, 500).map((l) => ({
        data: l.data,
        cliente: l.cliente,
        servico: l.descricao,
        valorOriginal: l.bruto,
      })),
    },
    servicosExtras: relatorioServicosExtras,
    produtos: relatorioProdutos,
    extratoLinhas: todasAsLinhas,
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
    totalAtendimentosClube: relatorios.reduce((s, r) => s + (r.faturamento.totalAtendimentosClube || 0), 0),
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
