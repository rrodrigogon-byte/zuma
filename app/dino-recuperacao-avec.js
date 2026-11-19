// Inteligência Estratégica de Churn e Recuperação de Clientes (Avec & Novo ERP)
// Consolida histórico do Avec (22.485 serviços) + comandas/agendamentos atuais Kytto
// Permite filtrar clientes por coortes de ausência (ex: ativo Jan-Ago, sumiu Set-Out)
// Classifica em modelos de retorno: Essencial (mais acessível), Premium (VIP) e Reativação Club.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { verificarStatusBarbeiroDino } from './core/barbershop-agenda.js';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVEC_DATA_FILE = path.join(__dirname, 'migrations', 'data', 'avec-dino-20261022', 'historico-servicos-completo.jsonl');
const DINO_CANONICAL_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

export function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function digits(str) {
  return String(str || '').replace(/\D/g, '');
}

/**
 * Normaliza telefone para formato brasileiro canônico com DDD (ex: 65996946939).
 * Remove DDI 55 caso presente e preenche DDD 65 se vier sem DDD.
 */
export function normalizarTelefoneBR(telefone) {
  if (!telefone) return '';
  let limpo = digits(telefone);
  if ((limpo.length === 12 || limpo.length === 13) && limpo.startsWith('55')) {
    limpo = limpo.slice(2);
  }
  // Se veio apenas com 8 ou 9 dígitos locais sem DDD, assume DDD 65 (Cuiabá - Dino Barbearia)
  if (limpo.length === 9) {
    limpo = '65' + limpo;
  } else if (limpo.length === 8) {
    limpo = '659' + limpo;
  }
  return limpo;
}

export function formatPhone(phone) {
  const d = normalizarTelefoneBR(phone) || digits(phone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone || '';
}

/**
 * Higieniza o nome do cliente removendo sufixos legados entre parênteses
 * como "(Club Combo - Asaas Dia 04)", "( Bruno )", "( Kenidy )", "(Club)"
 * e extrai rótulos de plano / assinatura e barbeiro como metadados estruturados.
 */
export function sanitizarNomeCliente(nomeBruto) {
  if (!nomeBruto) return { nomeLimpo: '', tags: [], planoDetectado: '', barbeiroAnotado: '' };
  const raw = String(nomeBruto).trim();
  const tags = [];
  let planoDetectado = '';
  let barbeiroAnotado = '';

  const regexParenteses = /\(([^)]+)\)/g;
  let match;
  while ((match = regexParenteses.exec(raw)) !== null) {
    const conteudo = match[1].trim();
    if (conteudo) {
      tags.push(conteudo);
      const cLower = conteudo.toLowerCase();
      if (
        cLower.includes('club') ||
        cLower.includes('combo') ||
        cLower.includes('asaas') ||
        cLower.includes('plano') ||
        cLower.includes('assinatura') ||
        cLower.includes('mensal') ||
        cLower.includes('vip') ||
        cLower.includes('pacote')
      ) {
        planoDetectado = conteudo;
      } else if (['bruno', 'nati', 'dino', 'kenidy', 'rafael', 'douglas', 'pedro'].some((b) => cLower.includes(b))) {
        barbeiroAnotado = conteudo;
      }
    }
  }

  // Remove os parênteses e espaços redundantes para obter o nome limpo e elegante
  let nomeLimpo = raw.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (!nomeLimpo) nomeLimpo = raw;

  return { nomeLimpo, tags, planoDetectado, barbeiroAnotado };
}

/**
 * Escolhe a melhor versão do nome entre o histórico e o dado recente do ERP/Agenda:
 * Prefere nomes sem parênteses, mais completos ou com sobrenome.
 */
export function escolherMelhorNome(atual, novo) {
  if (!atual) return novo || '';
  if (!novo) return atual || '';

  const { nomeLimpo: aLimpo } = sanitizarNomeCliente(atual);
  const { nomeLimpo: nLimpo } = sanitizarNomeCliente(novo);

  if (!aLimpo) return nLimpo || novo;
  if (!nLimpo) return aLimpo || atual;

  // Evita nomes genéricos
  const aGenerico = aLimpo.toLowerCase().startsWith('cliente avec') || aLimpo.toLowerCase().startsWith('cel:');
  const nGenerico = nLimpo.toLowerCase().startsWith('cliente avec') || nLimpo.toLowerCase().startsWith('cel:');
  if (aGenerico && !nGenerico) return nLimpo;
  if (!aGenerico && nGenerico) return aLimpo;

  const aPalavras = aLimpo.split(' ').filter((p) => p.length > 1).length;
  const nPalavras = nLimpo.split(' ').filter((p) => p.length > 1).length;

  if (nPalavras > aPalavras) return nLimpo;
  if (nPalavras === aPalavras && nLimpo.length > aLimpo.length) return nLimpo;
  return aLimpo;
}

const SERVICOS_EXTRAS_SET = new Set([
  'hidratacao', 'hidratacao capilar', 'sobrancelha', 'design de sobrancelha',
  'massagem', 'massagem relaxante na cadeira', 'spa', 'manicure e pedicure',
  'selagem', 'pigmentacao', 'limpeza de pele', 'depilacao nariz', 'depilacao orelha'
]);

// Cache em memória consolidado (TTL 30 segundos com auto-invalidação)
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
  if (!force && cacheConsolidado && (now - cacheTimestamp < 30000)) {
    return cacheConsolidado;
  }

  // Fallback de auto-hidratação caso não sejam passados agendamentos e comandas
  let agRecentes = Array.isArray(agendamentosRecentes) ? [...agendamentosRecentes] : [];
  let cmdRecentes = Array.isArray(comandasRecentes) ? [...comandasRecentes] : [];

  if (agRecentes.length === 0 || cmdRecentes.length === 0) {
    try {
      const raiz = typeof db === 'function' ? db() : null;
      if (raiz?.barbearias) {
        const estadoDino = raiz.barbearias[DINO_CANONICAL_EMPRESA_ID] || raiz.barbearias['dino'] || {};
        if (agRecentes.length === 0 && estadoDino.agendamentos) {
          agRecentes = Object.values(estadoDino.agendamentos);
        }
        if (cmdRecentes.length === 0 && estadoDino.comandas) {
          cmdRecentes = Object.values(estadoDino.comandas);
        }
      }
    } catch (_) {}
  }

  const clientsMap = new Map();

  // Helper para obter ou criar cliente no Map garantindo unificação por telefone normalizado
  function obterOuCriarCliente(telNorm, nomeBruto, dadosIniciais = {}) {
    const { nomeLimpo, planoDetectado, tags } = sanitizarNomeCliente(nomeBruto);
    const key = telNorm && telNorm.length >= 8 ? `tel:${telNorm}` : `nome:${normalize(nomeLimpo || nomeBruto)}`;

    let client = clientsMap.get(key);
    // Tenta encontrar por variações
    if (!client && telNorm && telNorm.length >= 8) {
      client = clientsMap.get(`tel:${telNorm.slice(-8)}`);
      if (client) {
        // Atualiza a chave para o formato completo
        clientsMap.set(key, client);
      }
    }
    if (!client && nomeLimpo) {
      client = clientsMap.get(`nome:${normalize(nomeLimpo)}`);
      if (client && telNorm) {
        clientsMap.set(key, client);
      }
    }

    if (!client) {
      client = {
        key,
        nome: nomeLimpo || nomeBruto || 'Cliente',
        nomeOriginal: nomeBruto,
        telefone: telNorm,
        telefoneNorm: telNorm,
        telefoneFormatado: formatPhone(telNorm),
        cpf: dadosIniciais.cpf || '',
        totalVisitas: 0,
        totalGasto: 0,
        primeiraVisita: '9999-99-99',
        ultimaVisita: '0000-00-00',
        profissionais: {},
        servicos: {},
        tevePacote: Boolean(planoDetectado || dadosIniciais.pacote),
        planoClub: planoDetectado || '',
        servicosExtras: new Set(),
        datasVisitas: [],
        mesesAtivo: new Set(),
        historicoItens: [],
        tags: new Set(tags),
        veioHoje: false,
        temAgendamentoHoje: false,
        temAgendamentoFuturo: false,
        telefonesSecundarios: new Set(),
      };
      clientsMap.set(key, client);
    } else {
      client.nome = escolherMelhorNome(client.nome, nomeLimpo);
      if (telNorm) {
        if (!client.telefone) {
          client.telefone = telNorm;
          client.telefoneNorm = telNorm;
          client.telefoneFormatado = formatPhone(telNorm);
        } else if (client.telefone !== telNorm) {
          client.telefonesSecundarios.add(telNorm);
        }
      }
      if (dadosIniciais.cpf && !client.cpf) client.cpf = dadosIniciais.cpf;
      if (planoDetectado) {
        client.tevePacote = true;
        client.planoClub = planoDetectado;
      }
      for (const t of tags) client.tags.add(t);
    }

    return client;
  }

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

      const nomeBruto = (row.cliente || '').trim();
      if (!nomeBruto) continue;

      const telNorm = normalizarTelefoneBR(row.celular || row.telefone || '');
      const client = obterOuCriarCliente(telNorm, nomeBruto, { cpf: row.cpf, pacote: Boolean(row.pacote) });

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
  for (const cmd of cmdRecentes) {
    const nomeBruto = (cmd.clienteNome || '').trim();
    const telNorm = normalizarTelefoneBR(cmd.clienteTelefone || '');
    if (!nomeBruto && !telNorm) continue;

    const client = obterOuCriarCliente(telNorm, nomeBruto, { cpf: cmd.clienteCpf });

    const dataIso = String(cmd.dataComandaIso || cmd.dataComandaOriginal || cmd.criadoEm || '').slice(0, 10);
    if (dataIso) {
      if (dataIso < client.primeiraVisita) client.primeiraVisita = dataIso;
      if (dataIso >= client.ultimaVisita) client.ultimaVisita = dataIso;
      client.datasVisitas.push(dataIso);
      client.mesesAtivo.add(dataIso.slice(0, 7));

      if (dataIso === dataReferencia) {
        client.veioHoje = true;
        client.temAgendamentoHoje = true;
      }
    }

    const valor = Number(cmd.total || 0);
    client.totalVisitas += 1;
    client.totalGasto += valor;

    const prof = (cmd.profissionalNome || 'Equipe Dino').trim();
    client.profissionais[prof] = (client.profissionais[prof] || 0) + 1;

    client.historicoItens.push({
      data: dataIso,
      servico: 'Atendimento Kytto (Comanda)',
      profissional: prof,
      valor,
      comanda: cmd.numeroComanda || cmd.id || '',
      pacote: false,
      origem: 'kytto_comanda',
    });
  }

  // 3. Mesclar com agendamentos recentes do ERP Kytto (Agenda Viva em Tempo Real)
  for (const ag of agRecentes) {
    if (!ag || ag.status === 'cancelado') continue;

    const nomeBruto = String(ag.clienteNome || ag.nome || '').trim();
    const telNorm = normalizarTelefoneBR(ag.clienteTelefone || ag.telefone || '');
    if (!nomeBruto && !telNorm) continue;

    const client = obterOuCriarCliente(telNorm, nomeBruto, { cpf: ag.clienteCpf || ag.cpf });

    const dataIso = String(ag.dataAgenda || ag.dataHora || ag.criadoEm || '').slice(0, 10);
    const hora = String(ag.horario || ag.hora || '').slice(0, 5);
    const valor = Number(ag.valor || ag.preco || 0);
    const prof = (ag.barbeiroNome || ag.profissionalNome || ag.barbeiro || 'Equipe Dino').trim();
    const serv = (ag.servicoNome || ag.servico || 'Corte e Estilo').trim();

    if (dataIso) {
      if (dataIso < client.primeiraVisita) client.primeiraVisita = dataIso;
      if (dataIso >= client.ultimaVisita) {
        client.ultimaVisita = dataIso;
      }
      client.datasVisitas.push(dataIso);
      client.mesesAtivo.add(dataIso.slice(0, 7));

      if (dataIso === dataReferencia) {
        client.veioHoje = true;
        client.temAgendamentoHoje = true;
      } else if (dataIso > dataReferencia) {
        client.temAgendamentoFuturo = true;
      }
    }

    // Contabiliza visita e gasto caso concluído ou realizado hoje/passado
    if (ag.status === 'concluido' || ag.status === 'em_atendimento' || dataIso <= dataReferencia) {
      client.totalVisitas += 1;
      client.totalGasto += valor;
    }

    client.profissionais[prof] = (client.profissionais[prof] || 0) + 1;
    client.servicos[serv] = (client.servicos[serv] || 0) + 1;

    client.historicoItens.push({
      data: dataIso,
      horario: hora,
      servico: serv,
      profissional: prof,
      valor,
      agendamentoId: ag.id || '',
      origem: 'kytto_agenda',
      status: ag.status || 'confirmado',
    });
  }

  // 4. Processar métricas, segmentação e mensagens
  const hojeMs = new Date(dataReferencia).getTime();
  const consolidados = [];

  for (const c of clientsMap.values()) {
    c.ticketMedio = c.totalVisitas > 0 ? Number((c.totalGasto / c.totalVisitas).toFixed(2)) : 0;
    c.totalGasto = Number(c.totalGasto.toFixed(2));

    const ultMs = new Date(c.ultimaVisita).getTime();
    const diffDias = Math.max(0, Math.floor((hojeMs - ultMs) / (1000 * 60 * 60 * 24)));

    // Se o cliente esteve hoje na barbearia, possui agendamento confirmado hoje ou no futuro:
    // diasSemVir é estritamente 0 e o status é ATIVO, blindado contra alarme falso de churn!
    if (c.veioHoje || c.temAgendamentoHoje || c.temAgendamentoFuturo || c.ultimaVisita >= dataReferencia) {
      c.diasSemVir = 0;
      c.statusRecuperacao = 'ativo';
      c.emChurn = false;
    } else {
      c.diasSemVir = diffDias;
      // Faixas de recência / churn
      if (diffDias <= 30) c.statusRecuperacao = 'ativo';
      else if (diffDias <= 60) c.statusRecuperacao = 'atencao_30_60';
      else if (diffDias <= 90) c.statusRecuperacao = 'alerta_60_90';
      else if (diffDias <= 180) c.statusRecuperacao = 'churn_90_180';
      else c.statusRecuperacao = 'perdido_180_mais';
      c.emChurn = diffDias > 21;
    }

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
    c.tagsLista = Array.from(c.tags || []);
    c.historicoItens.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    // Mensagem humanizada para WhatsApp
    const primeiroNome = c.nome.split(' ')[0] || 'Cliente';
    const statusProf = verificarStatusBarbeiroDino(c.profissionalPreferido);
    c.barbeiroAtivo = statusProf.ativo;
    c.barbeiroSaiu = statusProf.exBarbeiro || false;
    c.barbeiroNomeExibicao = statusProf.nomeExibicao;

    if (c.modeloRecomendado === 'essencial') {
      if (statusProf.ativo) {
        c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! 💈\n\nSentimos sua falta por aqui! Notamos que faz um tempinho que você não vem dar aquele trato no visual com a gente.\n\nEstamos com novidades: estruturamos nosso atendimento com o novo Modelo Essencial — um corte com a mesma qualidade e cuidado de sempre, mas numa condição super acessível para o seu dia a dia!\n\nPodemos reservar um horário especial com ${statusProf.nomeExibicao} para você essa semana? Me avisa aqui qual dia e período fica melhor pra você!`;
      } else {
        c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! 💈\n\nSentimos sua falta por aqui! Notamos que faz um tempinho que você não vem dar aquele talento no visual com a gente.\n\nEstamos com novidades: estruturamos nosso atendimento com o novo Modelo Essencial e novos barbeiros de ponta na equipe — um corte com a mesma qualidade de sempre, mas numa condição super acessível para o seu dia a dia!\n\nGostaria que eu reservasse um horário com o Bruno, com a Nati ou com outro especialista da nossa equipe para você essa semana? Me avisa aqui qual dia e período fica melhor!`;
      }
    } else if (c.modeloRecomendado === 'premium') {
      if (statusProf.ativo) {
        c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! ✂️\n\nPassando para lembrar que já faz um tempo desde seu último atendimento aqui com a gente. Como você preza por uma experiência completa de cuidado e estilo, gostaríamos de te convidar para conhecer nosso Atendimento Premium com exclusividade e serviços completos.\n\nQue tal garantir seu horário com ${statusProf.nomeExibicao} para essa semana? Responda aqui para reservarmos a sua cadeira preferida!`;
      } else {
        c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! ✂️\n\nPassando para lembrar que já faz um tempo desde seu último atendimento aqui com a gente. Como você preza por uma experiência completa de cuidado e estilo, gostaríamos de te convidar para conhecer nosso Atendimento Premium com exclusividade e serviços completos.\n\nNossa equipe de especialistas sênior (incluindo o Dino, o Bruno e a Nati) está pronta para te receber com todo o conforto.\n\nQue tal garantir seu horário para essa semana? Responda aqui para reservarmos a sua cadeira preferida!`;
      }
    } else {
      if (statusProf.ativo) {
        c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! 🦁\n\nEstamos entrando em contato porque você era um dos nossos clientes especiais do Club e sentimos sua falta na barbearia!\n\nLançamos condições imperdíveis de renovação e retorno para você manter o visual sempre alinhado com a melhor economia.\n\nQuer que eu verifique os horários disponíveis com ${statusProf.nomeExibicao} para você essa semana?`;
      } else {
        c.mensagemWhatsapp = `Olá ${primeiroNome}, tudo bem? Aqui é da Barbearia Dino! 🦁\n\nEstamos entrando em contato porque você era um dos nossos clientes especiais do Club e sentimos muito sua falta por aqui!\n\nLançamos condições imperdíveis de renovação e retorno para você manter o visual sempre alinhado com a melhor economia.\n\nEstamos com uma nova equipe incrível de especialistas (como o Bruno, a Nati e o time completo do Dino) prontos para manter o padrão de excelência no seu estilo!\n\nQuer que eu verifique os horários disponíveis com um dos nossos barbeiros para você essa semana?`;
      }
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
  const itens = filtrados.slice((pag - 1) * lim, pag * lim).map((c) => {
    const { historicoItens, datasVisitas, mesesAtivo, ...sanitized } = c;
    return sanitized;
  });

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
