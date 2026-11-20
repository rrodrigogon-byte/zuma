// ==========================================================================
// KYTTO — GESTÃO DE CARTEIRA E FLUXO DE RELACIONAMENTO DE CLIENTES POR BARBEIRO
// Permite que cada profissional (Dino, Nat, Bruno, David, etc.) tenha a sua própria
// carteira de clientes, acompanhe o retorno, visitas, serviços favoritos e ative
// relacionamentos diretamente via WhatsApp.
// ==========================================================================
import { db, save } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import { normalizarTelefoneBR } from './barbearia-cliente-unificacao.js';

const EQUIVALENCIAS_DINO = new Set([
  'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  'emp-kytto-001',
  'dino',
]);

function empresasEquivalentes(empresaId) {
  const idReal = typeof empresaId === 'function' ? empresaId() : empresaId;
  const chave = String(idReal || '');
  if (EQUIVALENCIAS_DINO.has(chave)) {
    return Array.from(EQUIVALENCIAS_DINO);
  }
  return [chave];
}

function dataAtualIso() {
  return new Date().toISOString().slice(0, 10);
}

function calcularDiasDiferenca(dataIso, hojeIso = dataAtualIso()) {
  if (!dataIso) return 999;
  const d1 = new Date(`${dataIso.slice(0, 10)}T12:00:00Z`).valueOf();
  const d2 = new Date(`${hojeIso.slice(0, 10)}T12:00:00Z`).valueOf();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 999;
  return Math.max(0, Math.floor((d2 - d1) / 86400000));
}

function classificarStatusRetorno(dias) {
  if (dias <= 15) return 'em_dia';
  if (dias <= 30) return 'ideal_retorno';
  if (dias <= 60) return 'atrasado';
  return 'sumido';
}

// Cache em memória de alta performance para evitar travamento de CPU e timeouts 502
const CACHE_CARTEIRAS = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos

export function invalidarCacheCarteira(empresaId) {
  if (!empresaId) {
    CACHE_CARTEIRAS.clear();
    return;
  }
  const empresas = empresasEquivalentes(empresaId);
  for (const emp of empresas) {
    for (const key of Array.from(CACHE_CARTEIRAS.keys())) {
      if (key.startsWith(emp)) {
        CACHE_CARTEIRAS.delete(key);
      }
    }
  }
}

/**
 * Mapeia todos os clientes e infere/atribui o barbeiro titular de cada um
 * com base na escolha explícita ou no histórico de atendimentos mais frequente.
 */
export function mapearCarteiras(empresaId, { lojaId = null, force = false } = {}) {
  const idReal = typeof empresaId === 'function' ? empresaId() : empresaId;
  const chave = String(idReal || '');
  const cacheKey = `${chave}::${lojaId || 'todas'}`;
  const agora = Date.now();
  const cached = CACHE_CARTEIRAS.get(cacheKey);
  if (!force && cached && (agora - cached.timestamp < CACHE_TTL_MS)) {
    return cached.dados;
  }

  const empresas = empresasEquivalentes(empresaId);
  const root = db();

  // Cache de normalização telefônica local para evitar regex repetitivo em loops grandes
  const telNormCache = new Map();
  const getNormTel = (tel) => {
    if (!tel) return '';
    const key = String(tel);
    let val = telNormCache.get(key);
    if (val !== undefined) return val;
    val = normalizarTelefoneBR(key);
    telNormCache.set(key, val);
    return val;
  };

  // 1. Carrega lista unificada de profissionais ativos
  const profissionaisMap = new Map();
  for (const emp of empresas) {
    try {
      const profs = barbeariaErpKytto.listarProfissionais(emp, { incluirInativos: false });
      for (const p of profs) {
        if (!profissionaisMap.has(p.id)) {
          profissionaisMap.set(p.id, {
            id: p.id,
            nome: p.nome,
            apelido: p.apelido || p.nome.split(' ')[0],
            especialidade: p.especialidade || '',
            fotoUrl: p.fotoUrl || '',
          });
        }
      }
    } catch {}
  }

  // 2. Coleta atendimentos e comandas para calcular histórico por cliente e profissional
  // Mapa de cliente -> { [profId]: { atendimentos, ultimaData, ultimoServico, totalGasto, servicos, datasSet } }
  const relacaoClienteProf = new Map();

  for (const emp of empresas) {
    // Agendamentos - Leitura direta sem clonagem pesada
    try {
      const agendamentosObj = root.barbearias?.[emp]?.agendamentos || {};
      for (const ag of Object.values(agendamentosObj)) {
        if (!ag || ag.status === 'cancelado') continue;
        if (lojaId && ag.lojaId && ag.lojaId !== lojaId) continue;
        const cliId = ag.clienteId || ag.clienteTelefone || ag.clienteNome;
        const cliTelNorm = getNormTel(ag.clienteTelefone);
        const profId = ag.profissionalId;
        if (!cliId || !profId) continue;

        if (!relacaoClienteProf.has(cliId)) relacaoClienteProf.set(cliId, {});
        const cliProf = relacaoClienteProf.get(cliId);
        cliProf[profId] ||= { atendimentos: 0, ultimaData: '', ultimoServico: '', totalGasto: 0, servicos: {}, datasSet: new Set() };
        const pAg = cliProf[profId];

        const dataAg = String(ag.dataAgenda || ag.dataHora || '').slice(0, 10);
        pAg.atendimentos += 1;
        pAg.totalGasto += Number(ag.valor || 0);
        if (dataAg) pAg.datasSet.add(dataAg);

        if (ag.servicoNome) {
          pAg.servicos[ag.servicoNome] = (pAg.servicos[ag.servicoNome] || 0) + 1;
        }

        if (!pAg.ultimaData || dataAg >= pAg.ultimaData) {
          pAg.ultimaData = dataAg;
          pAg.ultimoServico = ag.servicoNome || pAg.ultimoServico;
        }
        if (cliTelNorm && cliTelNorm !== cliId) {
          relacaoClienteProf.set(cliTelNorm, cliProf);
        }
      }
    } catch {}

    // Comandas - Leitura direta sem overhead de cópia profunda
    try {
      const comandasObj = root.barbearias?.[emp]?.comandas || {};
      for (const cmd of Object.values(comandasObj)) {
        if (!cmd || cmd.status === 'cancelada') continue;
        if (lojaId && cmd.lojaId && cmd.lojaId !== lojaId) continue;
        const cliId = cmd.clienteId || cmd.clienteTelefone || cmd.clienteNome;
        const cliTelNorm = getNormTel(cmd.clienteTelefone);
        const profId = cmd.profissionalId;
        if (!cliId || !profId) continue;

        if (!relacaoClienteProf.has(cliId)) relacaoClienteProf.set(cliId, {});
        const cliProf = relacaoClienteProf.get(cliId);
        cliProf[profId] ||= { atendimentos: 0, ultimaData: '', ultimoServico: '', totalGasto: 0, servicos: {}, datasSet: new Set() };
        const pCmd = cliProf[profId];

        const dataCmd = String(cmd.fechadaEm || cmd.atualizadoEm || cmd.criadoEm || '').slice(0, 10);
        pCmd.totalGasto += Number(cmd.total || 0);
        if (dataCmd) pCmd.datasSet.add(dataCmd);

        for (const it of cmd.itens || []) {
          const itemProfId = it.profissionalId || profId;
          if (it.tipo === 'servico' && it.nome) {
            cliProf[itemProfId] ||= { atendimentos: 0, ultimaData: '', ultimoServico: '', totalGasto: 0, servicos: {}, datasSet: new Set() };
            const pItem = cliProf[itemProfId];
            pItem.servicos[it.nome] = (pItem.servicos[it.nome] || 0) + 1;
            if (dataCmd) pItem.datasSet.add(dataCmd);
            if (!pItem.ultimaData || dataCmd >= pItem.ultimaData) {
              pItem.ultimaData = dataCmd;
              pItem.ultimoServico = it.nome;
            }
          }
        }
        if (cliTelNorm && cliTelNorm !== cliId) {
          relacaoClienteProf.set(cliTelNorm, cliProf);
        }
      }
    } catch {}

    // Histórico de serviços importados
    try {
      const hist = Object.values(root.barbearias?.[emp]?.historicoAtendimentos || {});
      for (const h of hist) {
        if (!h) continue;
        const cliId = h.clienteId || h.clienteTelefone || h.clienteNome;
        const cliTelNorm = getNormTel(h.clienteTelefone);
        const profId = h.profissionalId;
        if (!cliId || !profId) continue;

        if (!relacaoClienteProf.has(cliId)) relacaoClienteProf.set(cliId, {});
        const cliProf = relacaoClienteProf.get(cliId);
        cliProf[profId] ||= { atendimentos: 0, ultimaData: '', ultimoServico: '', totalGasto: 0, servicos: {}, datasSet: new Set() };
        const pHist = cliProf[profId];

        const dataH = String(h.dataAgenda || '').slice(0, 10);
        pHist.atendimentos += 1;
        pHist.totalGasto += Number(h.total || h.valor || 0);
        if (dataH) pHist.datasSet.add(dataH);

        if (h.servicoNome) {
          pHist.servicos[h.servicoNome] = (pHist.servicos[h.servicoNome] || 0) + 1;
        }

        if (!pHist.ultimaData || dataH >= pHist.ultimaData) {
          pHist.ultimaData = dataH;
          pHist.ultimoServico = h.servicoNome || pHist.ultimoServico;
        }
        if (cliTelNorm && cliTelNorm !== cliId) {
          relacaoClienteProf.set(cliTelNorm, cliProf);
        }
      }
    } catch {}
  }

  // 3. Carrega clientes do cadastro com deduplicação por telefone
  const clientesMap = new Map();
  for (const emp of empresas) {
    const cliStore = root.clientesKytto?.empresas?.[emp]?.clientes || {};
    for (const cli of Object.values(cliStore)) {
      if (!cli || cli.status === 'deletado' || cli.status === 'mesclado') continue;
      const telNorm = getNormTel(cli.telefone);
      const chaveAgrupamento = telNorm || cli.id;
      if (!clientesMap.has(chaveAgrupamento)) {
        clientesMap.set(chaveAgrupamento, { ...cli, telefone: telNorm || cli.telefone, idsAgrupados: [cli.id] });
      } else {
        const existente = clientesMap.get(chaveAgrupamento);
        existente.idsAgrupados ||= [existente.id];
        if (!existente.idsAgrupados.includes(cli.id)) existente.idsAgrupados.push(cli.id);
        const cliNomeOk = cli.nome && !cli.nome.startsWith('Cliente Avec') && !cli.nome.startsWith('Cel:');
        const exNomeOk = existente.nome && !existente.nome.startsWith('Cliente Avec') && !existente.nome.startsWith('Cel:');
        if (cliNomeOk && !exNomeOk) {
          clientesMap.set(chaveAgrupamento, { ...cli, telefone: telNorm || cli.telefone, idsAgrupados: existente.idsAgrupados });
        } else if (!existente.email && cli.email) {
          existente.email = cli.email;
        }
      }
    }
  }

  const hoje = dataAtualIso();
  const carteiraCompleta = [];

  for (const [cliId, cli] of clientesMap.entries()) {
    // Identifica o histórico deste cliente
    const telNorm = getNormTel(cli.telefone);
    let historicoProfissionais = relacaoClienteProf.get(cliId) ||
      (telNorm && relacaoClienteProf.get(telNorm)) ||
      relacaoClienteProf.get(cli.telefone) ||
      relacaoClienteProf.get(cli.nome) || {};

    if (cli.idsAgrupados && cli.idsAgrupados.length > 1) {
      const histMesclado = { ...historicoProfissionais };
      for (const outroId of cli.idsAgrupados) {
        const hOutro = relacaoClienteProf.get(outroId);
        if (hOutro) {
          for (const [pId, dados] of Object.entries(hOutro)) {
            if (!histMesclado[pId]) {
              histMesclado[pId] = {
                ...dados,
                servicos: { ...(dados.servicos || {}) },
                datasSet: new Set(dados.datasSet || []),
              };
            } else {
              histMesclado[pId].atendimentos += dados.atendimentos;
              histMesclado[pId].totalGasto += dados.totalGasto;
              if (dados.datasSet) {
                histMesclado[pId].datasSet ||= new Set();
                for (const d of dados.datasSet) {
                  histMesclado[pId].datasSet.add(d);
                }
              }
              if (!histMesclado[pId].ultimaData || (dados.ultimaData && dados.ultimaData > histMesclado[pId].ultimaData)) {
                histMesclado[pId].ultimaData = dados.ultimaData;
                histMesclado[pId].ultimoServico = dados.ultimoServico || histMesclado[pId].ultimoServico;
              }
            }
          }
        }
      }
      historicoProfissionais = histMesclado;
    }

    // Determina o barbeiro titular:
    // 1º: Vínculo explícito no cadastro (barbeiroId ou preferencias.barbeiroId)
    // 2º: Profissional com mais atendimentos com o cliente
    let titularId = cli.barbeiroId || cli.profissionalId || cli.preferencias?.barbeiroId || null;
    let titularNome = cli.barbeiroNome || cli.profissionalNome || cli.preferencias?.barbeiroNome || null;
    let titularFonte = titularId ? 'manual' : 'inferido';

    if (!titularId) {
      let maiorQtd = 0;
      for (const [pId, dados] of Object.entries(historicoProfissionais)) {
        if (dados.atendimentos > maiorQtd) {
          maiorQtd = dados.atendimentos;
          titularId = pId;
        }
      }
    }

    if (titularId && !titularNome) {
      titularNome = profissionaisMap.get(titularId)?.nome || 'Profissional';
    }

    // Métricas do cliente com o barbeiro titular
    const metricasTitular = (titularId && historicoProfissionais[titularId]) || {
      atendimentos: 0,
      ultimaData: '',
      ultimoServico: '',
      totalGasto: 0,
      servicos: {},
      datasSet: new Set(),
    };

    // Serviço favorito com o barbeiro
    let servicoFavorito = metricasTitular.ultimoServico || 'Corte Masculino';
    let maiorFrequenciaServico = 0;
    for (const [srv, count] of Object.entries(metricasTitular.servicos || {})) {
      if (count > maiorFrequenciaServico) {
        maiorFrequenciaServico = count;
        servicoFavorito = srv;
      }
    }

    // Última data geral e com o barbeiro
    let ultimaDataGeral = '';
    for (const dados of Object.values(historicoProfissionais)) {
      if (dados.ultimaData && (!ultimaDataGeral || dados.ultimaData > ultimaDataGeral)) {
        ultimaDataGeral = dados.ultimaData;
      }
    }

    const ultimaVisita = metricasTitular.ultimaData || ultimaDataGeral || cli.atualizadoEm?.slice(0, 10) || cli.criadoEm?.slice(0, 10) || '';
    const diasSemRetorno = calcularDiasDiferenca(ultimaVisita, hoje);
    const statusRetorno = classificarStatusRetorno(diasSemRetorno);
    const isVip = (metricasTitular.totalGasto >= 250 || metricasTitular.atendimentos >= 4);
    const ticketMedioCliente = metricasTitular.atendimentos > 0
      ? Math.round((metricasTitular.totalGasto / metricasTitular.atendimentos) * 100) / 100
      : 0;

    // Ciclo médio individual de retorno em dias com este barbeiro
    let cicloMedioDias = 0;
    const datasArr = metricasTitular.datasSet ? Array.from(metricasTitular.datasSet).filter(Boolean).sort() : [];
    if (datasArr.length >= 2) {
      let somaIntervalos = 0;
      let countIntervalos = 0;
      for (let i = 1; i < datasArr.length; i++) {
        const diff = calcularDiasDiferenca(datasArr[i - 1], datasArr[i]);
        if (diff >= 3 && diff <= 180) {
          somaIntervalos += diff;
          countIntervalos += 1;
        }
      }
      if (countIntervalos > 0) {
        cicloMedioDias = Math.round(somaIntervalos / countIntervalos);
      }
    }

    carteiraCompleta.push({
      clienteId: cli.id,
      nome: cli.nome,
      telefone: cli.telefone || '',
      email: cli.email || '',
      aniversario: cli.aniversario || '',
      observacao: cli.observacao || '',
      barbeiroId: titularId,
      barbeiroNome: titularNome,
      barbeiroApelido: titularId && profissionaisMap.get(titularId) ? profissionaisMap.get(titularId).apelido : (titularNome ? titularNome.split(' ')[0] : 'Barbeiro'),
      barbeiroFonte: titularFonte,
      totalAtendimentosComBarbeiro: metricasTitular.atendimentos,
      totalGastoComBarbeiro: Math.round(metricasTitular.totalGasto * 100) / 100,
      isVip,
      ticketMedioCliente,
      ultimaVisita,
      diasSemRetorno,
      statusRetorno,
      servicoFavorito,
      cicloMedioDias,
      criadoEm: cli.criadoEm,
    });
  }

  const resultado = {
    carteiraCompleta,
    profissionais: Array.from(profissionaisMap.values()),
  };

  CACHE_CARTEIRAS.set(cacheKey, {
    timestamp: Date.now(),
    dados: resultado,
  });

  return resultado;
}

/**
 * Consulta clientes da carteira filtrando por profissional e critérios de retorno.
 */
export function listarCarteiraClientes(empresaId, {
  profissionalId = '',
  lojaId = null,
  busca = '',
  filtroRetorno = 'todos',
  limite = 200,
  force = false,
} = {}) {
  const { carteiraCompleta, profissionais } = mapearCarteiras(empresaId, { lojaId, force });

  let lista = carteiraCompleta;

  // Filtro por profissional
  if (profissionalId) {
    const profIdStr = String(profissionalId).trim().toLowerCase();
    lista = lista.filter((c) => {
      if (!c.barbeiroId) return false;
      const bId = String(c.barbeiroId).toLowerCase();
      const bNome = String(c.barbeiroNome || '').toLowerCase();
      const bApelido = String(c.barbeiroApelido || '').toLowerCase();
      return bId === profIdStr || bNome.includes(profIdStr) || bApelido === profIdStr;
    });
  }

  // Filtro por busca de texto
  if (busca && busca.trim()) {
    const q = busca.trim().toLowerCase();
    lista = lista.filter((c) =>
      c.nome.toLowerCase().includes(q) ||
      c.telefone.includes(q) ||
      (c.barbeiroNome && c.barbeiroNome.toLowerCase().includes(q))
    );
  }

  // Filtro por status de retorno
  if (filtroRetorno && filtroRetorno !== 'todos') {
    if (filtroRetorno === 'vip') {
      lista = lista.filter((c) => c.isVip);
    } else {
      lista = lista.filter((c) => c.statusRetorno === filtroRetorno);
    }
  }

  // Ordena por maior relevância: hora de voltar e atrasados no topo
  const pesoStatus = { ideal_retorno: 1, atrasado: 2, sumido: 3, em_dia: 4 };
  lista.sort((a, b) => {
    const pA = pesoStatus[a.statusRetorno] || 5;
    const pB = pesoStatus[b.statusRetorno] || 5;
    if (pA !== pB) return pA - pB;
    return a.diasSemRetorno - b.diasSemRetorno;
  });

  return {
    clientes: lista.slice(0, limite),
    total: lista.length,
    profissionais,
  };
}

/**
 * Retorna resumo numérico de todas as carteiras para visualização executiva e comparativa.
 */
export function resumoCarteirasProfissionais(empresaId, { lojaId = null, force = false } = {}) {
  const { carteiraCompleta, profissionais } = mapearCarteiras(empresaId, { lojaId, force });

  const mapaResumo = new Map();
  for (const prof of profissionais) {
    mapaResumo.set(prof.id, {
      profissionalId: prof.id,
      profissionalNome: prof.nome,
      profissionalApelido: prof.apelido,
      especialidade: prof.especialidade,
      totalClientes: 0,
      emDia: 0,
      idealRetorno: 0,
      atrasados: 0,
      sumidos: 0,
      faturamentoTotal: 0,
      totalVip: 0,
      taxaRetencao: 100,
      ticketMedio: 0,
      potencialRecuperacao: 0,
      cicloMedioRetornoDias: 25,
      _ciclos: [],
    });
  }

  let semBarbeiroDefinido = 0;

  for (const item of carteiraCompleta) {
    if (item.barbeiroId && mapaResumo.has(item.barbeiroId)) {
      const r = mapaResumo.get(item.barbeiroId);
      r.totalClientes += 1;
      if (item.statusRetorno === 'em_dia') r.emDia += 1;
      else if (item.statusRetorno === 'ideal_retorno') r.idealRetorno += 1;
      else if (item.statusRetorno === 'atrasado') r.atrasados += 1;
      else if (item.statusRetorno === 'sumido') r.sumidos += 1;
      if (item.isVip) r.totalVip += 1;
      if (item.cicloMedioDias > 0) r._ciclos.push(item.cicloMedioDias);
      r.faturamentoTotal += item.totalGastoComBarbeiro;
    } else {
      semBarbeiroDefinido += 1;
    }
  }

  for (const r of mapaResumo.values()) {
    r.faturamentoTotal = Math.round(r.faturamentoTotal * 100) / 100;
    r.taxaRetencao = r.totalClientes > 0
      ? Math.round(((r.emDia + r.idealRetorno) / r.totalClientes) * 100)
      : 0;
    r.ticketMedio = r.totalClientes > 0
      ? Math.round((r.faturamentoTotal / r.totalClientes) * 100) / 100
      : 0;
    r.potencialRecuperacao = Math.round(
      (r.atrasados + r.sumidos) * (r.ticketMedio > 0 ? r.ticketMedio : 60)
    );
    r.cicloMedioRetornoDias = r._ciclos.length > 0
      ? Math.round(r._ciclos.reduce((a, b) => a + b, 0) / r._ciclos.length)
      : 25;
    delete r._ciclos;
  }

  const carteiras = Array.from(mapaResumo.values()).sort((a, b) => b.totalClientes - a.totalClientes);
  const totalGeralClientes = carteiraCompleta.length;
  const faturamentoTotalGeral = Math.round(carteiras.reduce((acc, c) => acc + (c.faturamentoTotal || 0), 0) * 100) / 100;
  const emDiaGeral = carteiras.reduce((acc, c) => acc + (c.emDia || 0), 0);
  const idealRetornoGeral = carteiras.reduce((acc, c) => acc + (c.idealRetorno || 0), 0);
  const atrasadosGeral = carteiras.reduce((acc, c) => acc + (c.atrasados || 0), 0);
  const sumidosGeral = carteiras.reduce((acc, c) => acc + (c.sumidos || 0), 0);
  const vipsGeral = carteiras.reduce((acc, c) => acc + (c.totalVip || 0), 0);
  const taxaRetencaoGeral = totalGeralClientes > 0
    ? Math.round(((emDiaGeral + idealRetornoGeral) / totalGeralClientes) * 100)
    : 0;
  const ticketMedioGeral = totalGeralClientes > 0
    ? Math.round((faturamentoTotalGeral / totalGeralClientes) * 100) / 100
    : 0;
  const potencialRecuperacaoGeral = Math.round(
    (atrasadosGeral + sumidosGeral) * (ticketMedioGeral > 0 ? ticketMedioGeral : 60)
  );
  const todosCiclos = carteiraCompleta.map((c) => c.cicloMedioDias).filter((d) => d > 0);
  const cicloMedioRetornoGeral = todosCiclos.length > 0
    ? Math.round(todosCiclos.reduce((a, b) => a + b, 0) / todosCiclos.length)
    : 25;

  return {
    carteiras,
    totalGeralClientes,
    faturamentoTotalGeral,
    emDiaGeral,
    idealRetornoGeral,
    atrasadosGeral,
    sumidosGeral,
    vipsGeral,
    taxaRetencaoGeral,
    ticketMedioGeral,
    potencialRecuperacaoGeral,
    cicloMedioRetornoGeral,
    semBarbeiroDefinido,
    atualizadoEm: new Date().toISOString(),
  };
}

/**
 * Vincula ou altera o barbeiro responsável pela carteira de um cliente.
 */
export function vincularClienteBarbeiro(empresaId, clienteId, { profissionalId, profissionalNome, usuario = '' } = {}) {
  const empresas = empresasEquivalentes(empresaId);
  const root = db();

  let clienteEncontrado = null;
  let empresaOndeEsta = null;

  for (const emp of empresas) {
    const cli = root.clientesKytto?.empresas?.[emp]?.clientes?.[clienteId];
    if (cli) {
      clienteEncontrado = cli;
      empresaOndeEsta = emp;
      break;
    }
  }

  if (!clienteEncontrado) {
    throw new Error('Cliente não encontrado.');
  }

  clienteEncontrado.barbeiroId = profissionalId || '';
  clienteEncontrado.barbeiroNome = profissionalNome || '';
  clienteEncontrado.preferencias ||= {};
  clienteEncontrado.preferencias.barbeiroId = profissionalId || '';
  clienteEncontrado.preferencias.barbeiroNome = profissionalNome || '';
  clienteEncontrado.atualizadoEm = new Date().toISOString();
  clienteEncontrado.atualizadoPor = String(usuario || '').slice(0, 120);

  save();
  invalidarCacheCarteira(empresaId);
  return { ...clienteEncontrado };
}

/**
 * Gera mensagem humanizada para envio via WhatsApp do próprio profissional.
 */
export function gerarMensagemWhatsappRetorno({
  clienteNome = '',
  barbeiroApelido = 'Barbeiro',
  servicoFavorito = 'corte',
  diasSemRetorno = 0,
  linkAgendamento = 'https://kytto.com.br/clube-vip',
} = {}) {
  const primeiroNome = String(clienteNome).trim().split(/\s+/)[0] || 'amigo';
  const tempoTexto = diasSemRetorno > 0 ? `já faz ${diasSemRetorno} dias do seu último ${servicoFavorito}` : 'já está na hora de renovar seu visual';

  return `Fala ${primeiroNome}, tudo bem? Aqui é o ${barbeiroApelido} da Barbearia Dino! 💈\n\nVi aqui que ${tempoTexto}. Vamos dar aquele talento no visual essa semana?\n\nJá separei sua cadeira! Pode me avisar por aqui ou escolher o melhor horário direto no link: ${linkAgendamento}`;
}

/**
 * Gera exportação CSV formatada para planilhas da carteira de clientes.
 */
export function exportarCarteiraCsv(empresaId, options = {}) {
  const { clientes } = listarCarteiraClientes(empresaId, { ...options, limite: 5000 });
  const colunas = [
    'Nome do Cliente',
    'Telefone',
    'Barbeiro Titular',
    'Tipo de Vinculo',
    'Cliente VIP',
    'Ultima Visita',
    'Dias Sem Retorno',
    'Status de Retorno',
    'Servico Favorito',
    'Visitas com Barbeiro',
    'Total Gasto com Barbeiro (R$)',
    'Ticket Medio (R$)',
    'Ciclo Medio Retorno (dias)',
  ];
  const linhas = [colunas.join(';')];
  for (const c of clientes) {
    const statusLabel = {
      em_dia: 'Em Dia (<= 15d)',
      ideal_retorno: 'Hora de Voltar (16-30d)',
      atrasado: 'Em Atraso (31-60d)',
      sumido: 'Sumido (> 60d)',
    }[c.statusRetorno] || c.statusRetorno;

    linhas.push([
      `"${String(c.nome || '').replace(/"/g, '""')}"`,
      c.telefone || '',
      `"${String(c.barbeiroNome || 'Sem barbeiro').replace(/"/g, '""')}"`,
      c.barbeiroFonte === 'manual' ? 'Fixado' : 'Habitual',
      c.isVip ? 'Sim' : 'Não',
      c.ultimaVisita || '',
      c.diasSemRetorno || 0,
      statusLabel,
      `"${String(c.servicoFavorito || '').replace(/"/g, '""')}"`,
      c.totalAtendimentosComBarbeiro || 0,
      (c.totalGastoComBarbeiro || 0).toFixed(2).replace('.', ','),
      (c.ticketMedioCliente || 0).toFixed(2).replace('.', ','),
      c.cicloMedioDias > 0 ? c.cicloMedioDias : 'N/D',
    ].join(';'));
  }
  return '\uFEFF' + linhas.join('\r\n');
}
