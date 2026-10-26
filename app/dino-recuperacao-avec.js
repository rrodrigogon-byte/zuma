// Inteligência Estratégica de Churn e Recuperação de Clientes (Avec & Novo ERP)
// Consolida histórico do Avec (22.485 serviços) + comandas/agendamentos atuais Kytto
// Permite filtrar clientes por coortes de ausência (ex: ativo Jan-Ago, sumiu Set-Out)
// Classifica em modelos de retorno: Essencial (mais acessível), Premium (VIP) e Reativação Club.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVEC_DATA_FILE = path.join(__dirname, 'migrations', 'data', 'avec-dino-20261022', 'historico-servicos-completo.jsonl');

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function digits(str) {
  return String(str || '').replace(/\D/g, '');
}

function formatPhone(phone) {
  const d = digits(phone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone || '';
}

const SERVICOS_EXTRAS_SET = new Set([
  'hidratacao', 'hidratacao capilar', 'sobrancelha', 'design de sobrancelha',
  'massagem', 'massagem relaxante na cadeira', 'spa', 'manicure e pedicure',
  'selagem', 'pigmentacao', 'limpeza de pele', 'depilacao nariz', 'depilacao orelha'
]);

// Cache em memória consolidado (TTL 60 segundos)
let cacheConsolidado = null;
let cacheTimestamp = 0;

export function invalidarCacheRecuperacao() {
  cacheConsolidado = null;
  cacheTimestamp = 0;
}

/**
 * Lê e consolida toda a base histórica do Avec e mescla com comandas e agendamentos recentes
 */
export async function carregarBaseConsolidada({
  dataReferencia = new Date().toISOString().slice(0, 10),
  comandasRecentes = [],
  agendamentosRecentes = [],
  force = false,
} = {}) {
  const now = Date.now();
  if (!force && cacheConsolidado && (now - cacheTimestamp < 60000)) {
    return cacheConsolidado;
  }

  const clientsMap = new Map();

  // 1. Ler histórico do Avec do JSONL caso o arquivo exista
  if (fs.existsSync(AVEC_DATA_FILE)) {
    const fileStream = fs.createReadStream(AVEC_DATA_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }

      const nome = (row.cliente || '').trim();
      if (!nome) continue;

      const tel = digits(row.celular || row.telefone || '');
      const key = tel && tel.length >= 8 ? `tel:${tel.slice(-8)}` : `nome:${normalize(nome)}`;

      let client = clientsMap.get(key);
      if (!client) {
        client = {
          key,
          nome,
          telefone: tel,
          telefoneFormatado: formatPhone(tel),
          cpf: row.cpf || '',
          totalVisitas: 0,
          totalGasto: 0,
          primeiraVisita: '9999-99-99',
          ultimaVisita: '0000-00-00',
          profissionais: {},
          servicos: {},
          tevePacote: false,
          servicosExtras: new Set(),
          datasVisitas: [],
          mesesAtivo: new Set(),
          historicoItens: [],
        };
        clientsMap.set(key, client);
      }

      if (tel && !client.telefone) {
        client.telefone = tel;
        client.telefoneFormatado = formatPhone(tel);
      }
      if (nome.length > client.nome.length) client.nome = nome;
      if (row.cpf && !client.cpf) client.cpf = row.cpf;

      const dataIso = row.data_iso || '';
      if (dataIso) {
        if (dataIso < client.primeiraVisita) client.primeiraVisita = dataIso;
        if (dataIso > client.ultimaVisita) client.ultimaVisita = dataIso;
        client.datasVisitas.push(dataIso);
        if (row.mes) client.mesesAtivo.add(row.mes);
      }

      const valor = parseFloat(String(row.total || row.valor || '0').replace(/\./g, '').replace(',', '.')) || 0;
      client.totalVisitas += 1;
      client.totalGasto += valor;

      const prof = (row.profissional || 'Não informado').trim();
      client.profissionais[prof] = (client.profissionais[prof] || 0) + 1;

      const serv = (row.servico || 'Serviço').trim();
      client.servicos[serv] = (client.servicos[serv] || 0) + 1;

      const servNorm = normalize(serv);
      for (const extra of SERVICOS_EXTRAS_SET) {
        if (servNorm.includes(extra)) {
          client.servicosExtras.add(serv);
        }
      }

      if (row.pacote || servNorm.includes('club') || servNorm.includes('pacote')) {
        client.tevePacote = true;
      }

      client.historicoItens.push({
        data: dataIso,
        servico: serv,
        profissional: prof,
        valor,
        comanda: row.numero_comanda || '',
        pacote: Boolean(row.pacote),
        origem: 'avec',
      });
    }
  }

  // 2. Mesclar com comandas recentes do ERP Kytto
  for (const cmd of comandasRecentes) {
    const nome = (cmd.clienteNome || '').trim();
    const tel = digits(cmd.clienteTelefone || '');
    if (!nome && !tel) continue;
    const key = tel && tel.length >= 8 ? `tel:${tel.slice(-8)}` : `nome:${normalize(nome)}`;

    let client = clientsMap.get(key);
    if (!client) {
      client = {
        key,
        nome: nome || 'Cliente',
        telefone: tel,
        telefoneFormatado: formatPhone(tel),
        cpf: cmd.clienteCpf || '',
        totalVisitas: 0,
        totalGasto: 0,
        primeiraVisita: '9999-99-99',
        ultimaVisita: '0000-00-00',
        profissionais: {},
        servicos: {},
        tevePacote: false,
        servicosExtras: new Set(),
        datasVisitas: [],
        mesesAtivo: new Set(),
        historicoItens: [],
      };
      clientsMap.set(key, client);
    }

    const dataIso = String(cmd.dataComandaIso || cmd.dataComandaOriginal || cmd.criadoEm || '').slice(0, 10);
    if (dataIso) {
      if (dataIso < client.primeiraVisita) client.primeiraVisita = dataIso;
      if (dataIso > client.ultimaVisita) client.ultimaVisita = dataIso;
      client.datasVisitas.push(dataIso);
      client.mesesAtivo.add(dataIso.slice(0, 7));
    }

    const valor = Number(cmd.total || 0);
    client.totalVisitas += 1;
    client.totalGasto += valor;

    const prof = (cmd.profissionalNome || 'Equipe Dino').trim();
    client.profissionais[prof] = (client.profissionais[prof] || 0) + 1;

    client.historicoItens.push({
      data: dataIso,
      servico: 'Atendimento Kytto',
      profissional: prof,
      valor,
      comanda: cmd.numeroComanda || cmd.id || '',
      pacote: false,
      origem: 'kytto',
    });
  }

  // 3. Processar métricas, segmentação e mensagens
  const hojeMs = new Date(dataReferencia).getTime();
  const consolidados = [];

  for (const c of clientsMap.values()) {
    c.ticketMedio = c.totalVisitas > 0 ? Number((c.totalGasto / c.totalVisitas).toFixed(2)) : 0;
    c.totalGasto = Number(c.totalGasto.toFixed(2));

    const ultMs = new Date(c.ultimaVisita).getTime();
    const diffDias = Math.max(0, Math.floor((hojeMs - ultMs) / (1000 * 60 * 60 * 24)));
    c.diasSemVir = diffDias;

    // Faixas de recência / churn
    if (diffDias <= 30) c.statusRecuperacao = 'ativo';
    else if (diffDias <= 60) c.statusRecuperacao = 'atencao_30_60';
    else if (diffDias <= 90) c.statusRecuperacao = 'alerta_60_90';
    else if (diffDias <= 180) c.statusRecuperacao = 'churn_90_180';
    else c.statusRecuperacao = 'perdido_180_mais';

    // Profissional preferido
    const topProf = Object.entries(c.profissionais).sort((a, b) => b[1] - a[1])[0];
    c.profissionalPreferido = topProf ? topProf[0] : 'Não informado';
    c.profissionalPreferidoVisitas = topProf ? topProf[1] : 0;

    // Serviços habituais
    c.servicosHabituais = Object.entries(c.servicos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);

    // Sensibilidade a preço e modelo estratégico
    const temMuitosExtras = c.servicosExtras.size >= 2;
    const ticketAlto = c.ticketMedio >= 80;
    const ehDino = c.profissionalPreferido.toLowerCase().includes('dino');

    if (c.tevePacote) {
      c.modeloRecomendado = 'club';
      c.modeloRotulo = 'Reativar Club / Pacote';
      c.modeloTom = 'warning';
      c.modeloDescricao = 'Assinante de pacote no Avec que parou de renovar.';
    } else if (ticketAlto || temMuitosExtras || ehDino) {
      c.modeloRecomendado = 'premium';
      c.modeloRotulo = 'Ofertar Modelo Premium';
      c.modeloTom = 'purple';
      c.modeloDescricao = 'Consome serviços extras ou prefere atendimento VIP/sênior.';
    } else {
      c.modeloRecomendado = 'essencial';
      c.modeloRotulo = 'Ofertar Modelo Essencial';
      c.modeloTom = 'success';
      c.modeloDescricao = 'Sensível a preço; parou no reajuste; ofertar corte acessível com nova equipe.';
    }

    c.servicosExtrasLista = Array.from(c.servicosExtras);
    c.historicoItens.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    // Mensagem humanizada para WhatsApp
    const primeiroNome = c.nome.split(' ')[0] || 'Cliente';
    const profNome = c.profissionalPreferido && c.profissionalPreferido !== 'Não informado'
      ? c.profissionalPreferido.split(' ')[0]
      : 'nossa equipe';

    if (c.modeloRecomendado === 'essencial') {
      c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! 💈\n\nSentimos sua falta por aqui! Notamos que faz um tempinho que você não vem dar aquele trato no visual com a gente.\n\nEstamos com novidades: estruturamos nosso atendimento com o novo Modelo Essencial — um corte com a mesma qualidade e cuidado de sempre, mas numa condição super acessível para o seu dia a dia!\n\nPodemos reservar um horário especial para você essa semana? Me avisa aqui qual dia e período fica melhor pra você!`;
    } else if (c.modeloRecomendado === 'premium') {
      c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! ✂️\n\nPassando para lembrar que já faz um tempo desde seu último atendimento aqui com a gente. Como você preza por uma experiência completa de cuidado e estilo, gostaríamos de te convidar para conhecer nosso Atendimento Premium com exclusividade e serviços completos.\n\nQue tal garantir seu horário para essa semana? Responda aqui para reservarmos a sua cadeira preferida!`;
    } else {
      c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! 🦁\n\nEstamos entrando em contato porque você era um dos nossos clientes especiais do Club e sentimos sua falta na barbearia!\n\nLançamos condições imperdíveis de renovação e retorno para você manter o visual sempre alinhado com a melhor economia.\n\nQuer que eu verifique os horários disponíveis com ${profNome} para você essa semana?`;
    }

    consolidados.push(c);
  }

  cacheConsolidado = consolidados;
  cacheTimestamp = now;
  return consolidados;
}

/**
 * Consulta e filtra a base com paginação, filtros de coorte e métricas
 */
export function consultarClientesRecuperacao(todosClientes = [], filtros = {}) {
  const {
    busca = '',
    deAtivo = '',
    ateAtivo = '',
    deAusente = '',
    ateAusente = '',
    diasSemVir = 'todos',
    profissional = 'todos',
    modelo = 'todos',
    tipoPlano = 'todos',
    extras = 'todos',
    ordem = 'diasSemVir',
    pagina = 1,
    limite = 25,
  } = filtros;

  const buscaNorm = normalize(busca);
  const buscaDig = digits(busca);

  let filtrados = todosClientes.filter((c) => {
    // 1. Busca textual
    if (buscaNorm) {
      const matchNome = normalize(c.nome).includes(buscaNorm);
      const matchTel = buscaDig ? digits(c.telefone).includes(buscaDig) : false;
      if (!matchNome && !matchTel) return false;
    }

    // 2. Filtro de coorte: Ativo no período [deAtivo, ateAtivo]
    if (deAtivo || ateAtivo) {
      const de = deAtivo ? deAtivo.slice(0, 10) : '0000-00-00';
      const ate = ateAtivo ? ateAtivo.slice(0, 10) : '9999-99-99';
      const teveVisitaNoPeriodo = c.datasVisitas.some((d) => d >= de && d <= ate);
      if (!teveVisitaNoPeriodo) return false;
    }

    // 3. Filtro de coorte: Ausente no período [deAusente, ateAusente] (NÃO teve nenhuma visita)
    if (deAusente || ateAusente) {
      const de = deAusente ? deAusente.slice(0, 10) : '0000-00-00';
      const ate = ateAusente ? ateAusente.slice(0, 10) : '9999-99-99';
      const teveVisitaAusente = c.datasVisitas.some((d) => d >= de && d <= ate);
      if (teveVisitaAusente) return false; // Se veio no período ausente, descarta!
    }

    // 4. Dias sem vir
    if (diasSemVir === '30_60' && (c.diasSemVir < 30 || c.diasSemVir > 60)) return false;
    if (diasSemVir === '60_90' && (c.diasSemVir < 60 || c.diasSemVir > 90)) return false;
    if (diasSemVir === '90_180' && (c.diasSemVir < 90 || c.diasSemVir > 180)) return false;
    if (diasSemVir === '180_mais' && c.diasSemVir <= 180) return false;
    if (diasSemVir === 'ausentes' && c.diasSemVir < 30) return false;

    // 5. Profissional
    if (profissional && profissional !== 'todos') {
      const profNorm = normalize(profissional);
      if (!normalize(c.profissionalPreferido).includes(profNorm)) return false;
    }

    // 6. Modelo recomendado
    if (modelo && modelo !== 'todos' && c.modeloRecomendado !== modelo) {
      return false;
    }

    // 7. Tipo de Plano
    if (tipoPlano === 'pacote' && !c.tevePacote) return false;
    if (tipoPlano === 'avulso' && c.tevePacote) return false;

    // 8. Extras
    if (extras === 'com_extras' && c.servicosExtrasLista.length === 0) return false;
    if (extras === 'sem_extras' && c.servicosExtrasLista.length > 0) return false;

    return true;
  });

  // Ordenação
  filtrados.sort((a, b) => {
    if (ordem === 'diasSemVir') return b.diasSemVir - a.diasSemVir;
    if (ordem === 'valor') return b.totalGasto - a.totalGasto;
    if (ordem === 'visitas') return b.totalVisitas - a.totalVisitas;
    if (ordem === 'ticket') return b.ticketMedio - a.ticketMedio;
    if (ordem === 'recente') return b.ultimaVisita.localeCompare(a.ultimaVisita);
    if (ordem === 'nome') return a.nome.localeCompare(b.nome);
    return b.diasSemVir - a.diasSemVir;
  });

  // Estatísticas do filtro
  let somaPotencialRecuperavel = 0;
  const porModelo = { essencial: 0, premium: 0, club: 0 };
  const porFaixa = { atencao_30_60: 0, alerta_60_90: 0, churn_90_180: 0, perdido_180_mais: 0, ativo: 0 };
  const porProfissional = {};

  for (const c of filtrados) {
    // Estimativa de faturamento recuperável mensal (ticket médio daquele cliente)
    somaPotencialRecuperavel += c.ticketMedio;
    porModelo[c.modeloRecomendado] = (porModelo[c.modeloRecomendado] || 0) + 1;
    porFaixa[c.statusRecuperacao] = (porFaixa[c.statusRecuperacao] || 0) + 1;
    const prof = c.profissionalPreferido || 'Não informado';
    porProfissional[prof] = (porProfissional[prof] || 0) + 1;
  }

  const total = filtrados.length;
  const pag = Math.max(1, Number(pagina) || 1);
  const lim = Math.max(1, Math.min(200, Number(limite) || 25));
  const paginas = Math.ceil(total / lim) || 1;
  const itens = filtrados.slice((pag - 1) * lim, pag * lim);

  return {
    total,
    pagina: pag,
    paginas,
    limite: lim,
    itens,
    resumo: {
      totalAnalisados: todosClientes.length,
      totalNoFiltro: total,
      faturamentoPotencialRecuperavel: Number(somaPotencialRecuperavel.toFixed(2)),
      porModelo,
      porFaixa,
      porProfissional,
    },
  };
}

/**
 * Gera arquivo CSV completo formatado para Excel (UTF-8 com BOM)
 */
export function exportarCsvRecuperacao(clientes = []) {
  const headers = [
    'Nome do Cliente',
    'Telefone',
    'CPF',
    'Ultima Visita',
    'Dias Sem Vir',
    'Total Visitas',
    'Total Gasto (R$)',
    'Ticket Medio (R$)',
    'Profissional Preferido',
    'Servicos Habituais',
    'Teve Pacote / Club',
    'Servicos Extras',
    'Modelo Recomendado',
    'Status Recuperacao',
    'Mensagem Sugerida WhatsApp',
  ];

  const rows = clientes.map((c) => [
    `"${(c.nome || '').replace(/"/g, '""')}"`,
    `"${c.telefoneFormatado || c.telefone || ''}"`,
    `"${c.cpf || ''}"`,
    c.ultimaVisita || '',
    c.diasSemVir ?? '',
    c.totalVisitas || 0,
    (c.totalGasto || 0).toFixed(2),
    (c.ticketMedio || 0).toFixed(2),
    `"${(c.profissionalPreferido || '').replace(/"/g, '""')}"`,
    `"${(c.servicosHabituais || []).join(', ').replace(/"/g, '""')}"`,
    c.tevePacote ? 'Sim' : 'Não',
    `"${(c.servicosExtrasLista || []).join(', ').replace(/"/g, '""')}"`,
    `"${c.modeloRotulo || c.modeloRecomendado || ''}"`,
    c.statusRecuperacao || '',
    `"${(c.mensagemWhatsapp || '').replace(/"/g, '""')}"`,
  ]);

  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}
