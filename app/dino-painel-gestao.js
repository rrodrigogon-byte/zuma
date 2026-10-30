// ============================================================================
// PAINEL DE GESTÃO DA BARBEARIA — meta do dia, realizado, projeção pela agenda,
// produção por categoria, ranking e detalhe por profissional, e o comparativo
// entre dois períodos. Somente leitura sobre a mesma apuração do Desempenho da
// equipe (comanda paga/em conta, atendimento com recebimento verificado, revenda
// paga e histórico Avec), para os números baterem entre as telas.
// A única gravação é a meta diária definida pelo gestor (salvarMetasPainel).
// ============================================================================

import { linhasCanonicasDoPeriodo } from './dino-equipe-desempenho.js';
import { serviceGroup } from './core/service-groups.js';

const TIME_ZONE = 'America/Cuiaba';
const DIA_MS = 86_400_000;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const PENDENTES = new Set(['agendado', 'confirmado', 'em_atendimento']);
const FORA_DA_AGENDA = new Set(['cancelado', 'nao_compareceu', 'bloqueio', 'falhou']);
const TOLERANCIA_ATRASO_MIN = 10;
const MAX_DIAS_COMPARATIVO = 93;

const FMT_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const FMT_HORA = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const lista = (valor) => (Array.isArray(valor) ? valor : valor && typeof valor === 'object' ? Object.values(valor) : []);
const texto = (valor) => String(valor ?? '').trim();
const num = (valor) => (Number.isFinite(Number(valor)) ? Number(valor) : 0);
const dinheiro = (valor) => Number(num(valor).toFixed(2));
const pct = (parte, total) => (total > 0 ? Number(((parte / total) * 100).toFixed(1)) : null);
const normalizar = (valor) => texto(valor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

export class PainelGestaoError extends Error {
  constructor(mensagem, code = 'PAINEL_INVALIDO', status = 400) {
    super(mensagem);
    this.code = code;
    this.status = status;
  }
}

export function diaLocal(ms = Date.now()) {
  return FMT_DIA.format(new Date(ms));
}

function minutosLocais(valor) {
  const data = new Date(valor || '');
  if (Number.isNaN(data.valueOf())) return null;
  const [h, m] = FMT_HORA.format(data).split(':').map(Number);
  return h * 60 + m;
}

function minutosDaHora(hora) {
  const [h, m] = texto(hora).split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
}

function horaTexto(minutos) {
  if (!Number.isFinite(minutos)) return '';
  const total = Math.max(0, Math.round(minutos));
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function inicioDoAgendamento(item) {
  const hora = minutosDaHora(item?.horaLocal);
  if (Number.isFinite(hora)) return hora;
  return minutosLocais(item?.dataHora);
}

function diaDaSemana(data) {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

function somarDias(data, dias) {
  return new Date(new Date(`${data}T12:00:00Z`).valueOf() + dias * DIA_MS).toISOString().slice(0, 10);
}

function validarData(valor, nome = 'data') {
  const data = texto(valor);
  if (!DATA_RE.test(data) || new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) !== data) {
    throw new PainelGestaoError(`Informe a ${nome} no formato AAAA-MM-DD.`, 'PERIODO_INVALIDO');
  }
  return data;
}

// ── Categorias de produção ────────────────────────────────────────────────────
// Produtos ficam à parte; serviços de estética, química, SPA, unhas etc. são
// "Serviços extras" (o que se oferece além do corte e da barba).
export const CATEGORIAS = ['Cabelo', 'Barba', 'Cabelo e barba', 'Serviços extras', 'Club', 'Outros serviços', 'Produtos'];

// Categorias que não dizem o que o serviço é (cadastro genérico ou importado).
const CATEGORIAS_GENERICAS = new Set(['', 'geral', 'historico avec', 'especial', 'outros', 'servicos', 'servico', 'nao classificado', 'sem categoria']);
const CATEGORIA_POR_NOME = new Map([
  ['cabelo', 'Cabelo'], ['cortes', 'Cabelo'], ['corte', 'Cabelo'],
  ['barba', 'Barba'], ['barbas', 'Barba'],
  ['cabelo e barba', 'Cabelo e barba'], ['combos', 'Cabelo e barba'], ['combo', 'Cabelo e barba'],
  ['club', 'Club'], ['clube', 'Club'],
]);

function categoriaPeloNome(nome) {
  const textoNome = normalizar(nome);
  if (/\b(club|clube)\b/.test(textoNome)) return 'Club';
  if (serviceGroup({ nome, categoria: '' }) === 'extras') return 'Serviços extras';
  const corte = /\b(corte|cabelo|pezinho|acabamento|degrade|social|tesoura|maquina)\b/.test(textoNome);
  const barba = /\b(barba|barbear|barboterapia)\b/.test(textoNome);
  if (corte && barba) return 'Cabelo e barba';
  if (corte) return 'Cabelo';
  if (barba) return 'Barba';
  return null;
}

function categoriaPeloCadastro(valor) {
  const categoria = normalizar(valor);
  if (CATEGORIAS_GENERICAS.has(categoria)) return null;
  if (CATEGORIA_POR_NOME.has(categoria)) return CATEGORIA_POR_NOME.get(categoria);
  const corte = /\b(cabelo|corte|cortes)\b/.test(categoria);
  const barba = /\bbarba\b/.test(categoria);
  if (corte && barba) return 'Cabelo e barba';
  if (corte) return 'Cabelo';
  if (barba) return 'Barba';
  // Estética, SPA, química, tintura, sobrancelha, depilação, unhas, prótese, consultoria…
  return 'Serviços extras';
}

// Ordem: Club pelo nome; extras pelo nome (hidratação, selagem…); a categoria da própria
// linha (frente de atuação do Avec); a categoria do cadastro do Kytto; por fim o nome.
// Categoria genérica ("Geral", "Histórico Avec") nunca decide sozinha.
export function categoriaDoServico(servico = {}, nomeLinha = '', grupoLinha = '') {
  const nome = texto(nomeLinha || servico?.nome);
  const textoNome = normalizar(nome);
  if (/\b(club|clube)\b/.test(textoNome) || /\b(club|clube)\b/.test(normalizar(servico?.categoria))) return 'Club';
  if (serviceGroup({ nome, categoria: '' }) === 'extras') return 'Serviços extras';
  return categoriaPeloCadastro(grupoLinha)
    || categoriaPeloCadastro(servico?.categoria)
    || categoriaPeloNome(nome)
    || 'Outros serviços';
}

// ── Metas diárias definidas pelo gestor ──────────────────────────────────────
function estadoMetas(root, empresaId) {
  root.painelGestaoKytto ||= { empresas: {} };
  root.painelGestaoKytto.empresas ||= {};
  return root.painelGestaoKytto.empresas[String(empresaId)] || null;
}

export function obterMetasPainel(root, empresaId) {
  const atual = estadoMetas(root, empresaId) || {};
  const individuais = {};
  for (const [id, valor] of Object.entries(atual.individuais || {})) if (num(valor) > 0) individuais[id] = dinheiro(valor);
  return {
    metaEquipe: num(atual.metaEquipe) > 0 ? dinheiro(atual.metaEquipe) : null,
    individuais,
    atualizadoEm: atual.atualizadoEm || null,
    atualizadoPor: atual.atualizadoPor || null,
  };
}

function valorDeMeta(valor, campo) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  const direto = Number(valor);
  const final = Number.isFinite(direto) ? direto : numero;
  if (!Number.isFinite(final) || final < 0 || final > 10_000_000) throw new PainelGestaoError(`Meta inválida: ${campo}.`, 'META_INVALIDA');
  return final > 0 ? dinheiro(final) : null;
}

export function salvarMetasPainel(root, empresaId, dados = {}, { profissionaisValidos = null, usuario = '' } = {}) {
  root.painelGestaoKytto ||= { empresas: {} };
  root.painelGestaoKytto.empresas ||= {};
  const anterior = obterMetasPainel(root, empresaId);
  const proximo = { metaEquipe: anterior.metaEquipe, individuais: { ...anterior.individuais } };
  const equipe = valorDeMeta(dados.metaEquipe, 'meta da equipe');
  if (equipe !== undefined) proximo.metaEquipe = equipe;
  if (dados.individuais && typeof dados.individuais === 'object') {
    for (const [id, valor] of Object.entries(dados.individuais)) {
      const chave = texto(id).slice(0, 120);
      if (!chave) continue;
      if (profissionaisValidos && !profissionaisValidos.has(chave)) throw new PainelGestaoError('Profissional não encontrado na empresa.', 'PROFISSIONAL_NAO_ENCONTRADO', 404);
      const meta = valorDeMeta(valor, 'meta individual');
      if (meta === null || meta === undefined) delete proximo.individuais[chave];
      else proximo.individuais[chave] = meta;
    }
  }
  root.painelGestaoKytto.empresas[String(empresaId)] = {
    ...proximo,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: texto(usuario).slice(0, 120),
  };
  return obterMetasPainel(root, empresaId);
}

function calendarioDaLoja(snapshot) {
  const configuracao = snapshot.strict.configuracao || {};
  const daLoja = configuracao.lojas?.[snapshot.lojaId] || {};
  const calendario = { ...configuracao, ...daLoja };
  const abertura = minutosDaHora(calendario.horarioAbertura);
  const fechamento = minutosDaHora(calendario.horarioFechamento);
  return {
    abertura: Number.isFinite(abertura) ? abertura : 8 * 60,
    fechamento: Number.isFinite(fechamento) && fechamento > abertura ? fechamento : 20 * 60,
    intervalo: Math.max(5, num(calendario.intervaloMinutos) || 15),
    dias: Array.isArray(calendario.diasFuncionamento) ? calendario.diasFuncionamento.map(Number) : [1, 2, 3, 4, 5, 6],
    feriados: new Set(Array.isArray(calendario.feriados) ? calendario.feriados : []),
  };
}

function trabalhaNoDia(profissional, calendario, data) {
  const semana = diaDaSemana(data);
  if (calendario.feriados.has(data) || !calendario.dias.includes(semana)) return false;
  const dias = Array.isArray(profissional?.diasTrabalho) && profissional.diasTrabalho.length ? profissional.diasTrabalho.map(Number) : calendario.dias;
  return dias.includes(semana);
}

function jornadaDoProfissional(profissional, calendario) {
  const inicio = minutosDaHora(profissional?.horarioInicio);
  const fim = minutosDaHora(profissional?.horarioFim);
  const de = Math.max(calendario.abertura, Number.isFinite(inicio) ? inicio : calendario.abertura);
  const ate = Math.min(calendario.fechamento, Number.isFinite(fim) ? fim : calendario.fechamento);
  return ate > de ? { de, ate } : { de: calendario.abertura, ate: calendario.fechamento };
}

function diasUteisNoMes(calendario, profissional, data) {
  const [ano, mes] = data.split('-').map(Number);
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let dias = 0;
  for (let d = 1; d <= total; d += 1) {
    const dia = `${data.slice(0, 7)}-${String(d).padStart(2, '0')}`;
    if (profissional ? trabalhaNoDia(profissional, calendario, dia) : (calendario.dias.includes(diaDaSemana(dia)) && !calendario.feriados.has(dia))) dias += 1;
  }
  return dias;
}

// Meta individual do dia: a meta diária do painel; sem ela, a meta mensal da
// Projeção (Ocupação e metas) dividida pelos dias de trabalho do mês.
function metaIndividualDoDia(root, empresaId, profissional, calendario, data, metasPainel) {
  const id = texto(profissional?.id);
  if (metasPainel.individuais[id]) return { valor: metasPainel.individuais[id], origem: 'meta_diaria' };
  const mensal = num(root?.barbeariaCaptacao?.[String(empresaId)]?.metasProfissionais?.[data.slice(0, 7)]?.[id]?.receita);
  if (mensal > 0) {
    const dias = diasUteisNoMes(calendario, profissional, data);
    if (dias > 0) return { valor: dinheiro(mensal / dias), origem: 'meta_mensal', metaMensal: dinheiro(mensal), diasNoMes: dias };
  }
  return { valor: null, origem: null };
}

function metaDaEquipeDoDia(root, empresaId, calendario, data, metasPainel, individuaisDoDia) {
  if (metasPainel.metaEquipe) return { valor: metasPainel.metaEquipe, origem: 'meta_diaria' };
  const somaIndividuais = individuaisDoDia.reduce((soma, item) => soma + num(item), 0);
  if (somaIndividuais > 0) return { valor: dinheiro(somaIndividuais), origem: 'soma_individuais' };
  const mensal = num(root?.metasKytto?.empresas?.[String(empresaId)]?.receita);
  if (mensal > 0) {
    const dias = diasUteisNoMes(calendario, null, data);
    if (dias > 0) return { valor: dinheiro(mensal / dias), origem: 'meta_mensal_empresa', metaMensal: dinheiro(mensal), diasNoMes: dias };
  }
  return { valor: null, origem: null };
}

// ── Linhas do período (mesma apuração do Desempenho) ─────────────────────────
function linhasDoPeriodo(root, { empresaId, lojaId, inicio, fim }) {
  const ctx = linhasCanonicasDoPeriodo(root, { empresaId, lojaId, inicio, fim });
  const { snapshot, current } = ctx;
  const servicosPorId = new Map(snapshot.raw.servicos.map((item) => [texto(item.id), item]));
  const comandasPorId = new Map(Object.values(snapshot.strict.comandas || {}).map((item) => [texto(item.id), item]));
  const profissionais = Object.values(snapshot.strict.profissionais || {});
  const idsEquipe = new Set(profissionais.map((item) => texto(item.id)));
  const linhas = [];
  for (const row of current.serviceRows) {
    const servico = servicosPorId.get(texto(row.serviceId)) || {};
    const comanda = comandasPorId.get(texto(row.id));
    const momento = row.timestamp || comanda?.fechadaEm || null;
    linhas.push({
      tipo: 'servico',
      origem: row.kind,
      id: texto(row.id),
      agendamentoId: row.kind === 'agendamento' ? texto(row.id) : texto(comanda?.agendamentoId),
      comandaId: comanda ? texto(comanda.id) : '',
      data: row.date,
      minuto: momento ? minutosLocais(momento) : null,
      profissionalId: idsEquipe.has(texto(row.professionalId)) ? texto(row.professionalId) : '',
      nome: row.name || servico.nome || 'Serviço',
      categoria: categoriaDoServico(servico, row.name, row.group),
      quantidade: num(row.quantity),
      valor: dinheiro(row.revenue),
      cliente: row.client || '',
    });
  }
  for (const row of current.unattributedHistoricalRows || []) {
    const servico = servicosPorId.get(texto(row.serviceId)) || {};
    linhas.push({ tipo: 'servico', origem: row.kind, id: texto(row.id), agendamentoId: '', comandaId: '', data: row.date, minuto: null, profissionalId: '', nome: row.name, categoria: categoriaDoServico(servico, row.name, row.group), quantidade: num(row.quantity), valor: dinheiro(row.revenue), cliente: row.client || '' });
  }
  for (const row of current.productRows) {
    linhas.push({
      tipo: 'produto',
      origem: row.kind,
      id: texto(row.id),
      agendamentoId: '',
      comandaId: comandasPorId.has(texto(row.id)) ? texto(row.id) : '',
      data: row.date,
      minuto: row.timestamp ? minutosLocais(row.timestamp) : null,
      profissionalId: idsEquipe.has(texto(row.professionalId)) ? texto(row.professionalId) : '',
      nome: row.name || 'Produto',
      categoria: 'Produtos',
      quantidade: num(row.quantity),
      valor: dinheiro(row.revenue),
      cliente: row.client || '',
    });
  }
  return { ctx, snapshot, current, linhas, profissionais, servicosPorId, comandasPorId };
}

function agruparCategorias(linhas) {
  const mapa = new Map();
  for (const linha of linhas) {
    const atual = mapa.get(linha.categoria) || { categoria: linha.categoria, valor: 0, quantidade: 0 };
    atual.valor += linha.valor;
    atual.quantidade += linha.quantidade;
    mapa.set(linha.categoria, atual);
  }
  const total = [...mapa.values()].reduce((soma, item) => soma + item.valor, 0);
  return [...mapa.values()]
    .map((item) => ({ ...item, valor: dinheiro(item.valor), quantidade: dinheiro(item.quantidade), participacao: pct(item.valor, total) }))
    .sort((a, b) => CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria));
}

function detalheExtras(linhas) {
  const mapa = new Map();
  for (const linha of linhas.filter((item) => item.tipo === 'servico' && item.categoria === 'Serviços extras')) {
    const chave = normalizar(linha.nome);
    const atual = mapa.get(chave) || { servico: linha.nome, quantidade: 0, valor: 0 };
    atual.quantidade += linha.quantidade;
    atual.valor += linha.valor;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].map((item) => ({ ...item, quantidade: dinheiro(item.quantidade), valor: dinheiro(item.valor) })).sort((a, b) => b.valor - a.valor || b.quantidade - a.quantidade);
}

function atendimentosConcluidos(agendamentos, linhas) {
  const concluidos = new Set(agendamentos.filter((item) => item.status === 'concluido').map((item) => texto(item.id)));
  // Comanda paga sem agendamento (atendimento de balcão) também é um atendimento.
  const balcao = new Set(linhas.filter((item) => item.tipo === 'servico' && item.origem !== 'historico_avec' && item.comandaId && !item.agendamentoId).map((item) => item.comandaId));
  // No histórico Avec, um atendimento é o cliente com o profissional naquele dia.
  const avec = new Set(linhas.filter((item) => item.origem === 'historico_avec').map((item) => `${item.data}|${normalizar(item.cliente)}|${item.profissionalId}`));
  return concluidos.size + balcao.size + avec.size;
}

function valorPrevisto(agendamento, servicosPorId) {
  if (agendamento.usarPlano === true || texto(agendamento.assinaturaId)) return 0;
  const valor = num(agendamento.valor) || num(servicosPorId.get(texto(agendamento.servicoId))?.preco);
  return dinheiro(valor);
}

function proximoHorarioLivre(profissional, agendamentos, calendario, aPartirDe) {
  const jornada = jornadaDoProfissional(profissional, calendario);
  const passo = calendario.intervalo;
  const duracaoMinima = Math.max(30, passo);
  const ocupados = agendamentos
    .filter((item) => texto(item.profissionalId) === texto(profissional.id) && !FORA_DA_AGENDA.has(item.status))
    .map((item) => { const inicio = inicioDoAgendamento(item); return Number.isFinite(inicio) ? [inicio, inicio + Math.max(5, num(item.duracaoMinutos) || 30)] : null; })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);
  let cursor = Math.max(jornada.de, Math.ceil(aPartirDe / passo) * passo);
  let livresMinutos = 0;
  let primeiro = null;
  for (let minuto = cursor; minuto + duracaoMinima <= jornada.ate; minuto += passo) {
    const conflito = ocupados.some(([de, ate]) => minuto < ate && de < minuto + duracaoMinima);
    if (!conflito) {
      if (primeiro === null) primeiro = minuto;
    }
  }
  // Minutos livres de verdade (sem sobreposição), da hora de referência ao fim da jornada.
  for (let minuto = cursor; minuto < jornada.ate; minuto += 5) {
    if (!ocupados.some(([de, ate]) => minuto >= de && minuto < ate)) livresMinutos += 5;
  }
  return { primeiro: primeiro === null ? null : horaTexto(primeiro), livresMinutos };
}

// ── Painel do dia ─────────────────────────────────────────────────────────────
export function buildPainelGestao(root, { empresaId, lojaId, data, agoraMs = Date.now() } = {}) {
  const hoje = diaLocal(agoraMs);
  const dia = data ? validarData(data) : hoje;
  const ehHoje = dia === hoje;
  const futuro = dia > hoje;
  const minutoAgora = ehHoje ? minutosLocais(agoraMs) : futuro ? -1 : 24 * 60;
  const { snapshot, linhas, profissionais, servicosPorId, current } = linhasDoPeriodo(root, { empresaId, lojaId, inicio: dia, fim: dia });
  const calendario = calendarioDaLoja(snapshot);
  const metasPainel = obterMetasPainel(root, empresaId);
  const agendamentos = lista(snapshot.strict.agendamentos).filter((item) => texto(item.dataAgenda || '').slice(0, 10) === dia || (!item.dataAgenda && item.dataHora && diaLocal(new Date(item.dataHora).valueOf()) === dia));
  const historicoFinanceiro = num(current.historicalFinance?.revenue);
  const operacional = linhas.filter((item) => item.origem !== 'historico_avec');
  const realizadoOperacional = dinheiro(operacional.reduce((soma, item) => soma + item.valor, 0));
  // Dias do Avec: o extrato pago é o realizado; as linhas Avec só distribuem por profissional.
  const realizado = dinheiro(realizadoOperacional + historicoFinanceiro);
  const linhasAnaliticas = historicoFinanceiro > 0 ? linhas : operacional;
  const servicosValor = dinheiro(linhasAnaliticas.filter((item) => item.tipo === 'servico').reduce((soma, item) => soma + item.valor, 0));
  const produtosValor = dinheiro(linhasAnaliticas.filter((item) => item.tipo === 'produto').reduce((soma, item) => soma + item.valor, 0));

  const pendentes = agendamentos.filter((item) => PENDENTES.has(item.status));
  // Dia que já passou não tem agenda "restante"; hoje, ignora o que venceu há mais de 2 h.
  const restantes = dia < hoje ? [] : pendentes.filter((item) => { const inicio = inicioDoAgendamento(item); return futuro || !ehHoje || !Number.isFinite(inicio) || inicio + Math.max(5, num(item.duracaoMinutos) || 30) >= minutoAgora - 120; });
  const agendaRestante = dinheiro(restantes.reduce((soma, item) => soma + valorPrevisto(item, servicosPorId), 0));

  // Curva do dia: realizado acumulado pela hora de início dos serviços e, a partir de
  // agora, a projeção somando os agendamentos que ainda vão acontecer.
  const minutosComHora = operacional.map((item) => item.minuto).filter(Number.isFinite);
  const minutosAgenda = agendamentos.map(inicioDoAgendamento).filter(Number.isFinite);
  const horaInicial = Math.floor(Math.min(calendario.abertura, ...minutosComHora, ...minutosAgenda) / 60);
  const horaFinal = Math.max(horaInicial + 1, Math.ceil(Math.max(calendario.fechamento, ...minutosComHora.map((m) => m + 1)) / 60));
  const realizadoAte = (minuto) => operacional.reduce((soma, item) => soma + (Number.isFinite(item.minuto) && item.minuto < minuto ? item.valor : 0), 0);
  const previstoAte = (minuto) => restantes.reduce((soma, item) => {
    const inicio = inicioDoAgendamento(item);
    return soma + ((Number.isFinite(inicio) ? Math.max(inicio, ehHoje ? minutoAgora : -1) : horaFinal * 60 - 1) < minuto ? valorPrevisto(item, servicosPorId) : 0);
  }, 0);
  const curva = [];
  for (let hora = horaInicial; hora <= horaFinal; hora += 1) {
    const minuto = hora * 60;
    const ponto = { hora: `${String(hora).padStart(2, '0')}h`, minuto };
    if (!futuro && (!ehHoje || minuto <= minutoAgora)) ponto.realizado = dinheiro(realizadoAte(minuto));
    if ((ehHoje && minuto > minutoAgora) || futuro) ponto.projecao = dinheiro(realizado + previstoAte(minuto));
    curva.push(ponto);
  }
  if (ehHoje) {
    // Ponto "agora": todo o realizado do dia, inclusive o que não tem horário.
    const agora = { hora: horaTexto(minutoAgora), minuto: minutoAgora, realizado: realizado, projecao: realizado, agora: true };
    const posicao = curva.findIndex((ponto) => ponto.minuto > minutoAgora);
    curva.splice(posicao === -1 ? curva.length : posicao, 0, agora);
  } else if (!futuro && curva.length) {
    curva[curva.length - 1].realizado = realizado;
  }
  if ((ehHoje || futuro) && curva.length) curva[curva.length - 1].projecao = dinheiro(realizado + agendaRestante);

  const categorias = agruparCategorias(linhasAnaliticas);
  const extras = detalheExtras(linhasAnaliticas);

  // Profissionais: quem trabalha no dia, tem agenda ou produziu.
  const comMovimento = new Set([...linhas.map((item) => item.profissionalId), ...agendamentos.map((item) => texto(item.profissionalId))].filter(Boolean));
  const equipe = profissionais.filter((item) => comMovimento.has(texto(item.id)) || (item.ativo !== false && trabalhaNoDia(item, calendario, dia)));
  const minutoReferencia = ehHoje ? minutoAgora : calendario.abertura;
  const linhasPorProf = new Map();
  for (const linha of linhasAnaliticas) {
    const chave = linha.profissionalId || '';
    if (!linhasPorProf.has(chave)) linhasPorProf.set(chave, []);
    linhasPorProf.get(chave).push(linha);
  }
  const metasIndividuais = [];
  const ranking = equipe.map((profissional) => {
    const id = texto(profissional.id);
    const proprias = linhasPorProf.get(id) || [];
    const agendaPropria = agendamentos.filter((item) => texto(item.profissionalId) === id).sort((a, b) => (inicioDoAgendamento(a) ?? 0) - (inicioDoAgendamento(b) ?? 0));
    const total = dinheiro(proprias.reduce((soma, item) => soma + item.valor, 0));
    const servicos = dinheiro(proprias.filter((item) => item.tipo === 'servico').reduce((soma, item) => soma + item.valor, 0));
    const produtos = dinheiro(proprias.filter((item) => item.tipo === 'produto').reduce((soma, item) => soma + item.valor, 0));
    const extrasProprios = detalheExtras(proprias);
    const meta = metaIndividualDoDia(root, empresaId, profissional, calendario, dia, metasPainel);
    if (meta.valor) metasIndividuais.push(meta.valor);
    const concluidos = agendaPropria.filter((item) => item.status === 'concluido');
    const pendentesProprios = agendaPropria.filter((item) => PENDENTES.has(item.status));
    const atrasos = ehHoje ? pendentesProprios
      .filter((item) => ['agendado', 'confirmado'].includes(item.status))
      .map((item) => ({ item, inicio: inicioDoAgendamento(item) }))
      .filter(({ inicio }) => Number.isFinite(inicio) && minutoAgora - inicio > TOLERANCIA_ATRASO_MIN)
      .map(({ item, inicio }) => ({ agendamentoId: texto(item.id), horario: horaTexto(inicio), minutos: Math.round(minutoAgora - inicio), cliente: texto(item.clienteNome) })) : [];
    const proximos = dia < hoje ? [] : pendentesProprios.filter((item) => { const inicio = inicioDoAgendamento(item); return !ehHoje || !Number.isFinite(inicio) || inicio >= minutoAgora - TOLERANCIA_ATRASO_MIN || item.status === 'em_atendimento'; });
    const cancelamentos = agendaPropria.filter((item) => item.status === 'cancelado').map((item) => ({ agendamentoId: texto(item.id), horario: horaTexto(inicioDoAgendamento(item)), cliente: texto(item.clienteNome) }));
    const faltas = agendaPropria.filter((item) => item.status === 'nao_compareceu').map((item) => ({ agendamentoId: texto(item.id), horario: horaTexto(inicioDoAgendamento(item)), cliente: texto(item.clienteNome) }));
    const livre = futuro || ehHoje ? proximoHorarioLivre(profissional, agendamentos, calendario, futuro ? calendario.abertura : minutoReferencia) : { primeiro: null, livresMinutos: 0 };
    const trabalhaHoje = trabalhaNoDia(profissional, calendario, dia) && profissional.ativo !== false;
    const refComissao = current.commissions.porProfissional.find(p => p.profissionalId === id) || {};

    return {
      profissionalId: id,
      nome: texto(profissional.apelido || profissional.nome) || 'Profissional',
      nomeCompleto: texto(profissional.nome),
      metasServico: refComissao.metasServico || null,
      metasProduto: refComissao.metasProduto || null,
      total,
      servicos,
      produtos,
      extrasValor: dinheiro(extrasProprios.reduce((soma, item) => soma + item.valor, 0)),
      extrasQuantidade: dinheiro(extrasProprios.reduce((soma, item) => soma + item.quantidade, 0)),
      produtosQuantidade: dinheiro(proprias.filter((item) => item.tipo === 'produto').reduce((soma, item) => soma + item.quantidade, 0)),
      meta: meta.valor,
      metaOrigem: meta.origem,
      metaMensal: meta.metaMensal || null,
      percentualMeta: meta.valor ? pct(total, meta.valor) : null,
      categorias: agruparCategorias(proprias),
      extras: extrasProprios,
      agenda: {
        concluidos: concluidos.length,
        proximos: proximos.length,
        cancelamentos: cancelamentos.length,
        faltas: faltas.length,
        atrasos,
        pontualidade: !ehHoje ? null : atrasos.length ? 'atraso' : 'em_dia',
        listaCancelamentos: cancelamentos,
        listaFaltas: faltas,
        proximosHorarios: proximos.slice(0, 6).map((item) => ({ agendamentoId: texto(item.id), horario: horaTexto(inicioDoAgendamento(item)), cliente: texto(item.clienteNome), servico: texto(servicosPorId.get(texto(item.servicoId))?.nome), status: item.status, valorPrevisto: valorPrevisto(item, servicosPorId) })),
        valorPrevisto: dinheiro(proximos.reduce((soma, item) => soma + valorPrevisto(item, servicosPorId), 0)),
      },
      horarioLivre: trabalhaHoje ? livre.primeiro : null,
      minutosLivres: trabalhaHoje ? livre.livresMinutos : 0,
      trabalhaHoje,
    };
  }).sort((a, b) => b.total - a.total || (b.percentualMeta ?? -1) - (a.percentualMeta ?? -1) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const semProfissional = dinheiro((linhasPorProf.get('') || []).reduce((soma, item) => soma + item.valor, 0));

  const metaEquipe = metaDaEquipeDoDia(root, empresaId, calendario, dia, metasPainel, metasIndividuais);
  const meta = metaEquipe.valor;
  const falta = meta ? dinheiro(Math.max(0, meta - realizado)) : null;
  const gap = meta ? dinheiro(Math.max(0, meta - realizado - agendaRestante)) : null;
  const atendimentos = atendimentosConcluidos(agendamentos, linhas);
  const ticketMedio = atendimentos ? dinheiro(servicosValor / atendimentos) : null;
  const minutosLivresEquipe = ranking.reduce((soma, item) => soma + item.minutosLivres, 0);

  const alertas = [];
  for (const prof of ranking) {
    for (const item of prof.agenda.listaCancelamentos) alertas.push({ tipo: 'cancelamento', profissionalId: prof.profissionalId, profissional: prof.nome, horario: item.horario, texto: `1 cancelamento${item.horario ? ` às ${item.horario}` : ''}` });
    for (const item of prof.agenda.listaFaltas) alertas.push({ tipo: 'falta', profissionalId: prof.profissionalId, profissional: prof.nome, horario: item.horario, texto: `cliente não compareceu${item.horario ? ` às ${item.horario}` : ''}` });
    for (const item of prof.agenda.atrasos) alertas.push({ tipo: 'atraso', profissionalId: prof.profissionalId, profissional: prof.nome, horario: item.horario, texto: `atraso de ${item.minutos} min (agendado às ${item.horario})` });
  }
  alertas.sort((a, b) => a.horario.localeCompare(b.horario));

  const pacotes = pacotesVendidos(root, empresaId, dia);
  const acoes = [];
  if (meta && gap > 0) {
    const atendimentosNecessarios = ticketMedio ? Math.ceil(gap / ticketMedio) : null;
    acoes.push({ id: 'preencher', titulo: 'Preencher horários', descricao: minutosLivresEquipe ? `${Math.floor(minutosLivresEquipe / 30)} horários de 30 min livres na equipe${atendimentosNecessarios ? `; ${atendimentosNecessarios} atendimento(s) no ticket médio cobrem o gap` : ''}.` : 'A agenda está cheia; use a lista de espera para encaixes.' });
    acoes.push({ id: 'extras', titulo: 'Oferecer extras', descricao: extras.length ? `Hoje saíram ${extras.reduce((s, e) => s + e.quantidade, 0)} extra(s). Ofereça hidratação, sobrancelha ou selagem a quem está na cadeira.` : 'Nenhum extra vendido ainda hoje. Ofereça hidratação, sobrancelha ou selagem a quem está na cadeira.' });
    acoes.push({ id: 'produtos', titulo: 'Sugerir produtos', descricao: produtosValor ? `Produtos somam ${produtosValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} hoje. Indique pomada e finalizadores no fechamento.` : 'Nenhum produto vendido ainda hoje. Indique pomada e finalizadores no fechamento.' });
  }

  return {
    ok: true,
    readOnly: true,
    data: dia,
    ehHoje,
    geradoEm: new Date(agoraMs).toISOString(),
    horaAtual: ehHoje ? horaTexto(minutoAgora) : null,
    escopo: { empresaId, lojaId },
    calendario: { abertura: horaTexto(calendario.abertura), fechamento: horaTexto(calendario.fechamento) },
    kpis: {
      meta,
      metaOrigem: metaEquipe.origem,
      metaMensal: metaEquipe.metaMensal || null,
      realizado,
      realizadoOperacional,
      historicoAvec: dinheiro(historicoFinanceiro),
      servicos: servicosValor,
      produtos: produtosValor,
      falta,
      percentualMeta: meta ? pct(realizado, meta) : null,
      percentualFalta: meta ? pct(falta, meta) : null,
      atendimentosConcluidos: atendimentos,
      ticketMedio,
      agendaRestante,
      atendimentosPrevistos: restantes.length,
      projecaoFechamento: dinheiro(realizado + agendaRestante),
      gapEstimado: gap,
      semProfissional,
    },
    curva,
    categorias,
    extras,
    pacotes,
    ranking,
    alertas,
    acoes,
    metas: metasPainel,
    definicoes: [
      'Realizado: comandas pagas ou em conta, atendimentos concluídos com recebimento verificado e vendas de revenda pagas no dia (fuso de Cuiabá). É a mesma apuração do Desempenho da equipe.',
      'Projeção: o realizado mais o valor dos agendamentos do dia que ainda não foram concluídos. Atendimentos cobertos por plano não somam (a receita do plano é a mensalidade).',
      'Pacotes vendidos ficam fora do realizado para não contar duas vezes: o valor do pacote é a mensalidade, e o uso não gera receita nova.',
      'Meta do dia: a meta diária definida neste painel; sem ela, a meta mensal (Ocupação e metas) dividida pelos dias de trabalho do mês.',
      'Pontualidade: agendamento ainda não iniciado mais de 10 minutos depois do horário marcado.',
      'Horário disponível: primeiro intervalo livre de 30 minutos na jornada do profissional, pela agenda do Kytto.',
    ],
  };
}

// Pagamentos de pacotes/planos registrados no dia (ficam fora do realizado).
function pacotesVendidos(root, empresaId, dia) {
  const assinaturas = root?.barbeariaCaptacao?.[String(empresaId)]?.assinaturas || {};
  let quantidade = 0;
  let valor = 0;
  const itens = [];
  for (const [assinaturaId, controle] of Object.entries(assinaturas)) {
    for (const pagamento of controle?.pagamentos || []) {
      const quando = new Date(pagamento.registradoEm || 0).valueOf();
      if (!Number.isFinite(quando) || quando <= 0 || diaLocal(quando) !== dia) continue;
      quantidade += 1;
      valor += num(pagamento.valor);
      itens.push({ assinaturaId, valor: dinheiro(pagamento.valor), meio: texto(pagamento.meio) });
    }
  }
  return { quantidade, valor: dinheiro(valor), itens: itens.slice(0, 20) };
}

// ── Comparativo de períodos ───────────────────────────────────────────────────
export const NAO_DETALHADO_AVEC = 'Não detalhado no Avec';
export const ID_NAO_DETALHADO = '__nao_detalhado_avec__';

function diaDoLancamento(valor) {
  const bruto = texto(valor);
  if (DATA_RE.test(bruto)) return bruto;
  const ms = new Date(bruto).valueOf();
  return Number.isFinite(ms) ? diaLocal(ms) : '';
}

// Recebimentos pagos do extrato do Avec, por dia (é o realizado oficial até a virada).
function extratoAvecPorDia(snapshot, inicio, fim) {
  const porDia = new Map();
  for (const item of snapshot.financial || []) {
    const avec = item?.metadata?.historicoAvec === true || String(item?.origem || '').startsWith('avec-import-financeiro');
    if (!avec || item.tipo !== 'receita' || item.status !== 'pago') continue;
    const dia = diaDoLancamento(item.pagoEm || item.dataOperacao);
    if (!dia || dia < inicio || dia > fim) continue;
    porDia.set(dia, (porDia.get(dia) || 0) + num(item.valor));
  }
  return porDia;
}

function resumoDoPeriodo(root, { empresaId, lojaId, inicio, fim, profissionalId = '' }) {
  const { snapshot, linhas, profissionais } = linhasDoPeriodo(root, { empresaId, lojaId, inicio, fim });
  const calendario = calendarioDaLoja(snapshot);
  const filtro = (item) => !profissionalId || item.profissionalId === profissionalId;
  const extratoPorDia = extratoAvecPorDia(snapshot, inicio, fim);
  const historicoFinanceiro = dinheiro([...extratoPorDia.values()].reduce((soma, valor) => soma + valor, 0));
  const operacionais = linhas.filter((item) => item.origem !== 'historico_avec');
  const avec = linhas.filter((item) => item.origem === 'historico_avec');
  const atribuidoAvec = dinheiro(avec.reduce((soma, item) => soma + item.valor, 0));
  // O extrato pago do Avec inclui o que o relatório de serviços não detalha (mensalidade do
  // clube, pacotes, produtos, vale-presente). Essa diferença entra como linha própria, para
  // categorias, profissionais e curva fecharem com o faturamento.
  const naoDetalhado = dinheiro(Math.max(0, historicoFinanceiro - atribuidoAvec));
  const agendamentos = lista(snapshot.strict.agendamentos).filter((item) => { const d = texto(item.dataAgenda || '').slice(0, 10) || (item.dataHora ? diaLocal(new Date(item.dataHora).valueOf()) : ''); return d >= inicio && d <= fim; });
  const agendaFiltrada = agendamentos.filter((item) => !profissionalId || texto(item.profissionalId) === profissionalId);
  const linhasFiltradas = linhas.filter(filtro);
  const somaOperacional = dinheiro(operacionais.reduce((soma, item) => soma + item.valor, 0));
  const faturamento = profissionalId
    ? dinheiro(linhasFiltradas.reduce((soma, item) => soma + item.valor, 0))
    : dinheiro(somaOperacional + Math.max(historicoFinanceiro, atribuidoAvec));
  const atendimentos = atendimentosConcluidos(agendaFiltrada, linhasFiltradas);
  const servicos = dinheiro(linhasFiltradas.filter((item) => item.tipo === 'servico').reduce((soma, item) => soma + item.valor, 0));
  const clientes = new Set(linhasFiltradas.map((item) => normalizar(item.cliente)).filter(Boolean)).size;
  const dias = Math.round((new Date(`${fim}T12:00:00Z`) - new Date(`${inicio}T12:00:00Z`)) / DIA_MS) + 1;

  // Curva acumulada: dia com extrato do Avec usa o extrato; os demais, a operação do Kytto.
  const porDia = new Map();
  for (const linha of linhasFiltradas) {
    if (!profissionalId && linha.origem === 'historico_avec' && extratoPorDia.has(linha.data)) continue;
    porDia.set(linha.data, (porDia.get(linha.data) || 0) + linha.valor);
  }
  if (!profissionalId) for (const [dia, valor] of extratoPorDia) porDia.set(dia, (porDia.get(dia) || 0) + valor);
  const serie = [];
  let acumulado = 0;
  for (let i = 0; i < dias; i += 1) {
    acumulado += porDia.get(somarDias(inicio, i)) || 0;
    serie.push({ dia: i + 1, data: somarDias(inicio, i), acumulado: dinheiro(acumulado) });
  }

  // Ocupação: minutos agendados sobre a jornada. Sem nenhum agendamento no período (agenda
  // do Avec não importada), fica "sem dado" em vez de 0%.
  const ocupacaoDe = (equipe, agenda) => {
    if (!agenda.length) return null;
    let capacidade = 0;
    let ocupados = 0;
    for (const prof of equipe) {
      const jornada = jornadaDoProfissional(prof, calendario);
      for (let i = 0; i < dias; i += 1) if (prof.ativo !== false && trabalhaNoDia(prof, calendario, somarDias(inicio, i))) capacidade += jornada.ate - jornada.de;
      ocupados += agenda.filter((item) => texto(item.profissionalId) === texto(prof.id) && !FORA_DA_AGENDA.has(item.status)).reduce((soma, item) => soma + Math.max(5, num(item.duracaoMinutos) || 30), 0);
    }
    return capacidade > 0 ? Number(Math.min(100, (ocupados / capacidade) * 100).toFixed(1)) : null;
  };
  const porProfissional = profissionais.map((prof) => {
    const id = texto(prof.id);
    const proprias = linhas.filter((item) => item.profissionalId === id);
    const agendaPropria = agendamentos.filter((item) => texto(item.profissionalId) === id);
    return {
      profissionalId: id,
      nome: texto(prof.apelido || prof.nome) || 'Profissional',
      ativo: prof.ativo !== false,
      faturamento: dinheiro(proprias.reduce((soma, item) => soma + item.valor, 0)),
      atendimentos: atendimentosConcluidos(agendaPropria, proprias),
      servicos: dinheiro(proprias.filter((item) => item.tipo === 'servico').reduce((soma, item) => soma + item.valor, 0)),
      produtos: dinheiro(proprias.filter((item) => item.tipo === 'produto').reduce((soma, item) => soma + item.valor, 0)),
      extras: dinheiro(proprias.filter((item) => item.categoria === 'Serviços extras').reduce((soma, item) => soma + item.valor, 0)),
      clientes: new Set(proprias.map((item) => normalizar(item.cliente)).filter(Boolean)).size,
      ocupacao: ocupacaoDe([prof], agendaPropria),
    };
  });
  // Valor das linhas sem profissional da equipe + o que o Avec não detalha.
  const semProfissional = dinheiro(linhas.filter((item) => !item.profissionalId).reduce((soma, item) => soma + item.valor, 0));
  if (!profissionalId && (naoDetalhado > 0 || semProfissional > 0)) {
    porProfissional.push({ profissionalId: ID_NAO_DETALHADO, nome: 'Não atribuído a profissional', ativo: true, sintetico: true, faturamento: dinheiro(naoDetalhado + semProfissional), atendimentos: 0, servicos: semProfissional, produtos: 0, extras: 0, clientes: 0, ocupacao: null });
  }
  const categorias = agruparCategorias(linhasFiltradas);
  if (!profissionalId && naoDetalhado > 0) {
    categorias.push({ categoria: NAO_DETALHADO_AVEC, valor: naoDetalhado, quantidade: 0, participacao: null });
    const total = categorias.reduce((soma, item) => soma + item.valor, 0);
    for (const item of categorias) item.participacao = pct(item.valor, total);
  }
  const usaAvec = avec.length > 0 || historicoFinanceiro > 0;
  const produtosValor = dinheiro(linhasFiltradas.filter((item) => item.tipo === 'produto').reduce((soma, item) => soma + item.valor, 0));
  return {
    inicio,
    fim,
    dias,
    faturamento,
    atendimentos,
    clientes,
    ticketMedio: atendimentos ? dinheiro(servicos / atendimentos) : null,
    ocupacao: profissionalId ? ocupacaoDe(profissionais.filter((item) => texto(item.id) === profissionalId), agendaFiltrada) : ocupacaoDe(profissionais, agendamentos),
    // No histórico do Avec as vendas de produto não vêm detalhadas: sem dado em vez de zero.
    produtos: usaAvec && !operacionais.length && produtosValor === 0 ? null : produtosValor,
    extras: dinheiro(linhasFiltradas.filter((item) => item.categoria === 'Serviços extras').reduce((soma, item) => soma + item.valor, 0)),
    naoDetalhado: profissionalId ? 0 : naoDetalhado,
    extratoAvec: historicoFinanceiro,
    categorias,
    serie,
    porProfissional,
    fonte: usaAvec ? (operacionais.length ? 'avec_e_kytto' : 'avec') : 'kytto',
  };
}

function variacao(a, b) {
  if (a === null || b === null || a === undefined || b === undefined) return null;
  if (!b) return null;
  return Number((((a - b) / b) * 100).toFixed(1));
}

export function buildComparativo(root, { empresaId, lojaId, inicioA, fimA, inicioB, fimB, profissionalId = '' } = {}) {
  const a = { inicio: validarData(inicioA, 'data inicial do período A'), fim: validarData(fimA, 'data final do período A') };
  const b = { inicio: validarData(inicioB, 'data inicial do período B'), fim: validarData(fimB, 'data final do período B') };
  for (const periodo of [a, b]) {
    if (periodo.fim < periodo.inicio) throw new PainelGestaoError('O início do período deve ser antes do fim.', 'PERIODO_INVALIDO');
    const dias = Math.round((new Date(`${periodo.fim}T12:00:00Z`) - new Date(`${periodo.inicio}T12:00:00Z`)) / DIA_MS) + 1;
    if (dias > MAX_DIAS_COMPARATIVO) throw new PainelGestaoError(`Cada período pode ter no máximo ${MAX_DIAS_COMPARATIVO} dias.`, 'PERIODO_INVALIDO');
  }
  const prof = texto(profissionalId).slice(0, 120);
  const A = resumoDoPeriodo(root, { empresaId, lojaId, ...a, profissionalId: prof });
  const B = resumoDoPeriodo(root, { empresaId, lojaId, ...b, profissionalId: prof });
  if (prof && !A.porProfissional.some((item) => item.profissionalId === prof)) throw new PainelGestaoError('Profissional não encontrado.', 'PROFISSIONAL_NAO_ENCONTRADO', 404);
  const categorias = [...new Set([...A.categorias, ...B.categorias].map((item) => item.categoria))]
    .sort((x, y) => (CATEGORIAS.indexOf(x) < 0 ? 99 : CATEGORIAS.indexOf(x)) - (CATEGORIAS.indexOf(y) < 0 ? 99 : CATEGORIAS.indexOf(y)))
    .map((categoria) => {
      const va = A.categorias.find((item) => item.categoria === categoria)?.valor || 0;
      const vb = B.categorias.find((item) => item.categoria === categoria)?.valor || 0;
      return { categoria, a: va, b: vb, variacao: variacao(va, vb) };
    });
  // Inclui quem só aparece no período B (ex.: profissional que saiu) e a linha "não atribuído".
  for (const item of B.porProfissional) if (!A.porProfissional.some((outro) => outro.profissionalId === item.profissionalId)) A.porProfissional.push({ ...item, faturamento: 0, atendimentos: 0, servicos: 0, produtos: 0, extras: 0, clientes: 0, ocupacao: null });
  const profissionais = A.porProfissional.map((item) => {
    const anterior = B.porProfissional.find((outro) => outro.profissionalId === item.profissionalId) || {};
    return {
      profissionalId: item.profissionalId,
      nome: item.nome,
      ativo: item.ativo,
      a: item,
      sintetico: item.sintetico === true,
      b: { faturamento: anterior.faturamento || 0, atendimentos: anterior.atendimentos || 0, produtos: anterior.produtos || 0, extras: anterior.extras || 0, servicos: anterior.servicos || 0, clientes: anterior.clientes || 0, ocupacao: anterior.ocupacao ?? null },
      variacao: variacao(item.faturamento, anterior.faturamento || 0),
    };
  }).filter((item) => item.a.faturamento > 0 || item.b.faturamento > 0 || item.a.atendimentos > 0 || item.b.atendimentos > 0)
    .sort((x, y) => Number(x.sintetico === true) - Number(y.sintetico === true) || y.a.faturamento - x.a.faturamento || y.b.faturamento - x.b.faturamento);
  const mudancas = [];
  const comparar = (rotulo, va, vb) => { const v = variacao(va, vb); if (v !== null && Math.abs(v) >= 5) mudancas.push({ rotulo, variacao: v }); };
  comparar('Faturamento', A.faturamento, B.faturamento);
  comparar('Atendimentos', A.atendimentos, B.atendimentos);
  comparar('Ticket médio', A.ticketMedio, B.ticketMedio);
  comparar('Produtos', A.produtos, B.produtos);
  comparar('Extras', A.extras, B.extras);
  const subiram = mudancas.filter((item) => item.variacao > 0).map((item) => item.rotulo.toLowerCase());
  const cairam = mudancas.filter((item) => item.variacao < 0).map((item) => item.rotulo.toLowerCase());
  const leitura = [
    subiram.length ? `Cresceram: ${subiram.join(', ')}.` : '',
    cairam.length ? `Caíram: ${cairam.join(', ')}.` : '',
  ].filter(Boolean).join(' ') || 'Sem mudança relevante (menos de 5%) entre os períodos.';
  return {
    ok: true,
    readOnly: true,
    profissionalId: prof || null,
    a: A,
    b: B,
    kpis: {
      faturamento: { a: A.faturamento, b: B.faturamento, variacao: variacao(A.faturamento, B.faturamento), diferenca: dinheiro(A.faturamento - B.faturamento) },
      atendimentos: { a: A.atendimentos, b: B.atendimentos, variacao: variacao(A.atendimentos, B.atendimentos), diferenca: A.atendimentos - B.atendimentos },
      ticketMedio: { a: A.ticketMedio, b: B.ticketMedio, variacao: variacao(A.ticketMedio, B.ticketMedio), diferenca: A.ticketMedio !== null && B.ticketMedio !== null ? dinheiro(A.ticketMedio - B.ticketMedio) : null },
      ocupacao: { a: A.ocupacao, b: B.ocupacao, diferencaPontos: A.ocupacao !== null && B.ocupacao !== null ? Number((A.ocupacao - B.ocupacao).toFixed(1)) : null },
      clientes: { a: A.clientes, b: B.clientes, variacao: variacao(A.clientes, B.clientes), diferenca: A.clientes - B.clientes },
      extras: { a: A.extras, b: B.extras, variacao: variacao(A.extras, B.extras), diferenca: dinheiro(A.extras - B.extras) },
      produtos: { a: A.produtos, b: B.produtos, variacao: variacao(A.produtos, B.produtos), diferenca: A.produtos !== null && B.produtos !== null ? dinheiro(A.produtos - B.produtos) : null },
      naoDetalhado: { a: A.naoDetalhado, b: B.naoDetalhado },
    },
    categorias,
    profissionais,
    leitura,
    definicoes: [
      'Mesma apuração do Desempenho da equipe. Em dias anteriores à virada para o Kytto (até 22/10/2026), o total vem do extrato pago do Avec e as categorias e profissionais vêm dos serviços do histórico Avec.',
      'Atendimentos: agendamentos concluídos, comandas pagas sem agendamento e, no histórico Avec, cada cliente atendido por profissional no dia.',
      'Ocupação: minutos agendados (sem cancelamentos e faltas) sobre a jornada dos dias de trabalho. Período sem agenda registrada (antes da virada do Avec) aparece como "sem dado".',
      '"Não detalhado no Avec": diferença entre o extrato pago do Avec e o relatório de serviços (mensalidade do clube, pacotes, produtos e vale-presente). Entra no total, nas categorias e em "Não atribuído a profissional", para tudo fechar com o faturamento.',
      'Categorias: a frente de atuação do Avec ou a categoria do cadastro; "Geral" e "Histórico Avec" não contam como categoria e o serviço é classificado pelo nome.',
    ],
  };
}
