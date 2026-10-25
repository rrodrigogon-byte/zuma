// ============================================================================
// CENTRAL DINO — METAS DIÁRIAS, SEMANAIS E ROLETA DE PREMIAÇÕES
// Permite ao gestor cadastrar e alterar autonomamente metas de serviços extras,
// produtos e desafios semanais, identificando automaticamente quando o
// profissional ganha direito a girar a roleta, registrando o prêmio e a entrega.
// ============================================================================

import { db, save } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';

const TIME_ZONE = 'America/Cuiaba';

// Configuração padrão da roleta e metas
export const CONFIG_PADRAO = {
  metasDiarias: {
    servicosExtrasAtivo: true,
    servicosExtrasQtd: 6, // 6 serviços extras = 1 giro
    servicosExtrasGiros: 1,
    produtosAtivo: true,
    produtosQtd: 2, // 2 unidades de produtos vendidas = 1 giro (meta diária por QUANTIDADE)
    produtosValor: 0,
    produtosGiros: 1,
    faturamentoAtivo: false,
    faturamentoValor: 500,
    faturamentoGiros: 1,
  },
  metasSemanais: {
    ativo: true,
    tituloDesafio: 'Desafio Semanal de Vendas',
    descricaoDesafio: 'Venda de produtos e serviços adicionais para impulsionar o ticket médio',
    produtosValor: 500, // R$ 500 de produtos na semana
    produtosQtd: 10, // 10 unidades de produtos
    faturamentoValor: 2500, // R$ 2.500 de faturamento
    servicosQtd: 35, // 35 serviços
    premiacaoDesafio: 'R$ 100 no Pix + 2 Giros na Roleta',
    girosDesafio: 2,
  },
  premiosRoleta: [
    { id: 'p1', nome: 'R$ 50 no Pix', cor: '#10b981', icone: '🎁', ativo: true, peso: 15 },
    { id: 'p2', nome: 'Vale Hambúrguer / Almoço', cor: '#f59e0b', icone: '🍔', ativo: true, peso: 20 },
    { id: 'p3', nome: 'Folga Meio Período', cor: '#6366f1', icone: '💈', ativo: true, peso: 10 },
    { id: 'p4', nome: 'Pomada / Produto Grátis', cor: '#ec4899', icone: '🧴', ativo: true, peso: 25 },
    { id: 'p5', nome: 'R$ 20 no Pix', cor: '#14b8a6', icone: '💵', ativo: true, peso: 25 },
    { id: 'p6', nome: 'Café da Manhã Especial', cor: '#8b5cf6', icone: '☕', ativo: true, peso: 20 },
    { id: 'p7', nome: 'R$ 100 no Pix', cor: '#f43f5e', icone: '🎟️', ativo: true, peso: 5 },
    { id: 'p8', nome: 'Vale 1 Café / Parabéns', cor: '#06b6d4', icone: '👏', ativo: true, peso: 30 },
  ],
};

function estadoGamificacao(empresaId) {
  const root = db();
  root.dinoGamificacao ||= { empresas: {} };
  root.dinoGamificacao.empresas ||= {};
  const chave = String(empresaId);
  root.dinoGamificacao.empresas[chave] ||= {
    config: JSON.parse(JSON.stringify(CONFIG_PADRAO)),
    giros: {}, // { [giroId]: { ... } }
    historicoMetas: {}, // { [data_profId]: { ... } }
  };
  return root.dinoGamificacao.empresas[chave];
}

/** Obter configuração atual de metas e roleta */
export function obterConfiguracao(empresaId) {
  const estado = estadoGamificacao(empresaId);
  const cfg = estado.config || {};
  return {
    metasDiarias: { ...CONFIG_PADRAO.metasDiarias, ...(cfg.metasDiarias || {}) },
    metasSemanais: { ...CONFIG_PADRAO.metasSemanais, ...(cfg.metasSemanais || {}) },
    premiosRoleta: Array.isArray(cfg.premiosRoleta) && cfg.premiosRoleta.length > 0
      ? cfg.premiosRoleta
      : CONFIG_PADRAO.premiosRoleta,
    atualizadoEm: cfg.atualizadoEm || null,
    atualizadoPor: cfg.atualizadoPor || null,
  };
}

/** Salvar configuração de metas e roleta pelo gestor */
export function salvarConfiguracao(empresaId, dados = {}, usuario = '') {
  const estado = estadoGamificacao(empresaId);
  const atual = obterConfiguracao(empresaId);

  const metasDiarias = {
    ...atual.metasDiarias,
    servicosExtrasAtivo: dados.metasDiarias?.servicosExtrasAtivo !== false,
    servicosExtrasQtd: Math.max(1, Number(dados.metasDiarias?.servicosExtrasQtd || 6)),
    servicosExtrasGiros: Math.max(1, Number(dados.metasDiarias?.servicosExtrasGiros || 1)),
    produtosAtivo: dados.metasDiarias?.produtosAtivo !== false,
    produtosQtd: Math.max(0, Number(dados.metasDiarias?.produtosQtd ?? 2)),
    produtosValor: Math.max(0, Number(dados.metasDiarias?.produtosValor ?? 0)),
    produtosGiros: Math.max(1, Number(dados.metasDiarias?.produtosGiros || 1)),
    faturamentoAtivo: Boolean(dados.metasDiarias?.faturamentoAtivo),
    faturamentoValor: Math.max(0, Number(dados.metasDiarias?.faturamentoValor || 500)),
    faturamentoGiros: Math.max(1, Number(dados.metasDiarias?.faturamentoGiros || 1)),
  };

  const metasSemanais = {
    ...atual.metasSemanais,
    ativo: dados.metasSemanais?.ativo !== false,
    tituloDesafio: String(dados.metasSemanais?.tituloDesafio || 'Desafio da Semana').trim().slice(0, 100),
    descricaoDesafio: String(dados.metasSemanais?.descricaoDesafio || '').trim().slice(0, 300),
    produtosValor: Math.max(0, Number(dados.metasSemanais?.produtosValor || 500)),
    produtosQtd: Math.max(0, Number(dados.metasSemanais?.produtosQtd || 10)),
    faturamentoValor: Math.max(0, Number(dados.metasSemanais?.faturamentoValor || 2500)),
    servicosQtd: Math.max(0, Number(dados.metasSemanais?.servicosQtd || 35)),
    premiacaoDesafio: String(dados.metasSemanais?.premiacaoDesafio || 'Premiação Especial').trim().slice(0, 150),
    girosDesafio: Math.max(0, Number(dados.metasSemanais?.girosDesafio || 2)),
  };

  let premiosRoleta = atual.premiosRoleta;
  if (Array.isArray(dados.premiosRoleta) && dados.premiosRoleta.length > 0) {
    premiosRoleta = dados.premiosRoleta.map((p, idx) => ({
      id: String(p.id || `p_${idx + 1}`),
      nome: String(p.nome || 'Prêmio').trim().slice(0, 60),
      cor: String(p.cor || '#10b981').trim().slice(0, 20),
      icone: String(p.icone || '🎁').trim().slice(0, 10),
      ativo: p.ativo !== false,
      peso: Math.max(1, Number(p.peso || 10)),
    })).filter((p) => p.nome.length > 0);
  }

  estado.config = {
    metasDiarias,
    metasSemanais,
    premiosRoleta,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: String(usuario || '').slice(0, 120),
  };

  save();
  return obterConfiguracao(empresaId);
}

/** Converte data para YYYY-MM-DD no fuso de Cuiabá */
export function dataIsoCuiaba(data = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Calcula limites da semana (segunda a domingo) para uma data de referência */
export function janelaSemana(dataRef = new Date()) {
  const d = dataRef instanceof Date ? new Date(dataRef) : new Date(dataRef);
  const diaSemana = d.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
  const distSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  
  const segunda = new Date(d);
  segunda.setDate(d.getDate() + distSegunda);
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  return {
    inicioIso: dataIsoCuiaba(segunda),
    fimIso: dataIsoCuiaba(domingo),
    rotulo: `${dataIsoCuiaba(segunda).slice(8, 10)}/${dataIsoCuiaba(segunda).slice(5, 7)} a ${dataIsoCuiaba(domingo).slice(8, 10)}/${dataIsoCuiaba(domingo).slice(5, 7)}`,
  };
}

/**
 * Identifica e consolida o desempenho operacional de cada profissional
 * em um dia ou período a partir das comandas, atendimentos e vendas de revenda.
 */
export function apurarDesempenhoEquipe(empresaId, { dataIso = dataIsoCuiaba(), inicioSemanaIso, fimSemanaIso, lojaId = null } = {}) {
  const equivalentes = [String(empresaId)];
  if (empresaId === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6') equivalentes.push('emp-kytto-001', 'dino');

  const semana = inicioSemanaIso && fimSemanaIso ? { inicioIso: inicioSemanaIso, fimIso: fimSemanaIso } : janelaSemana(dataIso);

  // Busca lista unificada de profissionais
  const profissionaisMap = new Map();
  for (const emp of equivalentes) {
    try {
      const profs = barbeariaErpKytto.listarProfissionais(emp, { incluirInativos: false });
      for (const p of profs) {
        if (!profissionaisMap.has(p.id)) profissionaisMap.set(p.id, p);
      }
    } catch {}
  }

  // Estrutura de acumulação por profissional
  const stats = {};
  for (const [id, prof] of profissionaisMap.entries()) {
    stats[id] = {
      profissionalId: id,
      nome: prof.nome,
      apelido: prof.apelido || prof.nome.split(' ')[0],
      ativo: prof.ativo !== false,
      // Desempenho Diário
      dia: {
        dataIso,
        servicosTotal: 0,
        servicosExtras: 0,
        servicosExtrasLista: [],
        faturamentoServicos: 0,
        produtosValor: 0,
        produtosQtd: 0,
        produtosLista: [],
        faturamentoTotal: 0,
        comandasAtendidas: 0,
      },
      // Desempenho Semanal
      semana: {
        inicioIso: semana.inicioIso,
        fimIso: semana.fimIso,
        servicosTotal: 0,
        servicosExtras: 0,
        faturamentoServicos: 0,
        produtosValor: 0,
        produtosQtd: 0,
        faturamentoTotal: 0,
        comandasAtendidas: 0,
      },
    };
  }

  // Varre comandas
  for (const emp of equivalentes) {
    let comandas = [];
    try {
      comandas = barbeariaErpKytto.listarComandasBarbearia(emp, { lojaId });
    } catch {}

    for (const cmd of comandas) {
      if (cmd.status === 'cancelada') continue;
      const dataCmd = (cmd.fechadaEm || cmd.atualizadoEm || cmd.criadoEm || '').slice(0, 10);
      if (!dataCmd) continue;

      const noDia = dataCmd === dataIso;
      const naSemana = dataCmd >= semana.inicioIso && dataCmd <= semana.fimIso;
      if (!noDia && !naSemana) continue;

      // Serviços e produtos da comanda
      const itensServico = (cmd.itens || []).filter((it) => it.tipo === 'servico');
      const itensProduto = (cmd.itens || []).filter((it) => it.tipo === 'produto');

      // Se há mais de 1 serviço na comanda, do 2º em diante é extra
      // OU se item.extra === true OU categoria/nome indica adicional
      itensServico.forEach((item, index) => {
        const profId = item.profissionalId || cmd.profissionalId;
        if (!profId || !stats[profId]) return;

        const ehExtra = Boolean(
          item.extra === true ||
          item.ehExtra === true ||
          index > 0 || // serviço adicional na mesma comanda!
          /extra|adicional|sobrancelha|pigmenta|spa|massagem|barboterapia|hidrata/i.test(item.nome || '')
        );

        const valor = Number(item.subtotal || item.valor || 0);

        if (noDia) {
          stats[profId].dia.servicosTotal += 1;
          stats[profId].dia.faturamentoServicos += valor;
          stats[profId].dia.faturamentoTotal += valor;
          if (ehExtra) {
            stats[profId].dia.servicosExtras += 1;
            stats[profId].dia.servicosExtrasLista.push({
              nome: item.nome,
              valor,
              comandaId: cmd.id,
              clienteNome: cmd.clienteNome,
            });
          }
        }

        if (naSemana) {
          stats[profId].semana.servicosTotal += 1;
          stats[profId].semana.faturamentoServicos += valor;
          stats[profId].semana.faturamentoTotal += valor;
          if (ehExtra) stats[profId].semana.servicosExtras += 1;
        }
      });

      // Produtos na comanda
      for (const prod of itensProduto) {
        const profId = prod.profissionalId || cmd.profissionalId;
        if (!profId || !stats[profId]) continue;

        const qtd = Math.max(1, Number(prod.quantidade || 1));
        const valor = Number(prod.subtotal || prod.valor || 0);

        if (noDia) {
          stats[profId].dia.produtosQtd += qtd;
          stats[profId].dia.produtosValor += valor;
          stats[profId].dia.faturamentoTotal += valor;
          stats[profId].dia.produtosLista.push({
            nome: prod.nome,
            quantidade: qtd,
            valor,
            clienteNome: cmd.clienteNome,
          });
        }

        if (naSemana) {
          stats[profId].semana.produtosQtd += qtd;
          stats[profId].semana.produtosValor += valor;
          stats[profId].semana.faturamentoTotal += valor;
        }
      }

      if (cmd.profissionalId && stats[cmd.profissionalId]) {
        if (noDia) stats[cmd.profissionalId].dia.comandasAtendidas += 1;
        if (naSemana) stats[cmd.profissionalId].semana.comandasAtendidas += 1;
      }
    }

    // Varre vendas diretas de revenda
    let vendasRevenda = [];
    try {
      vendasRevenda = barbeariaErpKytto.listarVendasRevenda(emp, { lojaId });
    } catch {}

    for (const venda of vendasRevenda) {
      if (venda.status === 'cancelado') continue;
      const dataVenda = (venda.criadoEm || '').slice(0, 10);
      if (!dataVenda) continue;

      const profId = venda.profissionalId;
      if (!profId || !stats[profId]) continue;

      const noDia = dataVenda === dataIso;
      const naSemana = dataVenda >= semana.inicioIso && dataVenda <= semana.fimIso;
      if (!noDia && !naSemana) continue;

      const valor = Number(venda.total || 0);
      const qtdItens = (venda.itens || []).reduce((acc, it) => acc + Math.max(1, Number(it.quantidade || 1)), 0);

      if (noDia) {
        stats[profId].dia.produtosValor += valor;
        stats[profId].dia.produtosQtd += qtdItens;
        stats[profId].dia.faturamentoTotal += valor;
      }
      if (naSemana) {
        stats[profId].semana.produtosValor += valor;
        stats[profId].semana.produtosQtd += qtdItens;
        stats[profId].semana.faturamentoTotal += valor;
      }
    }
  }

  // Arredonda valores
  for (const st of Object.values(stats)) {
    st.dia.faturamentoServicos = Number(st.dia.faturamentoServicos.toFixed(2));
    st.dia.produtosValor = Number(st.dia.produtosValor.toFixed(2));
    st.dia.faturamentoTotal = Number(st.dia.faturamentoTotal.toFixed(2));

    st.semana.faturamentoServicos = Number(st.semana.faturamentoServicos.toFixed(2));
    st.semana.produtosValor = Number(st.semana.produtosValor.toFixed(2));
    st.semana.faturamentoTotal = Number(st.semana.faturamentoTotal.toFixed(2));
  }

  return {
    dataIso,
    semana,
    profissionais: Object.values(stats),
  };
}

/**
 * Avalia as metas e gera/sincroniza automaticamente os direitos a giro da roleta
 * para os profissionais que atingiram as marcas.
 */
export function avaliarMetasESincronizarGiros(empresaId, { dataIso = dataIsoCuiaba(), lojaId = null } = {}) {
  const estado = estadoGamificacao(empresaId);
  const config = obterConfiguracao(empresaId);
  const apuracao = apurarDesempenhoEquipe(empresaId, { dataIso, lojaId });

  const girosExistentes = Object.values(estado.giros || {});

  const hoje = dataIso;
  const semanaChave = apuracao.semana.inicioIso;

  for (const prof of apuracao.profissionais) {
    const profId = prof.profissionalId;
    const nome = prof.nome;

    // 1. Meta Diária de Serviços Extras
    if (config.metasDiarias.servicosExtrasAtivo && config.metasDiarias.servicosExtrasQtd > 0) {
      const bateuExtras = prof.dia.servicosExtras >= config.metasDiarias.servicosExtrasQtd;
      prof.dia.metaExtrasAtingida = bateuExtras;
      prof.dia.metaExtrasAlvo = config.metasDiarias.servicosExtrasQtd;
      prof.dia.metaExtrasProgresso = Math.min(100, Math.round((prof.dia.servicosExtras / config.metasDiarias.servicosExtrasQtd) * 100));

      if (bateuExtras) {
        const chaveUnica = `meta_diaria_extras:${profId}:${hoje}`;
        const jaExiste = girosExistentes.find((g) => g.chaveUnica === chaveUnica);
        if (!jaExiste) {
          const giroId = `giro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          estado.giros[giroId] = {
            id: giroId,
            chaveUnica,
            empresaId,
            profissionalId: profId,
            profissionalNome: nome,
            dataReferencia: hoje,
            tipoOrigem: 'meta_diaria_extras',
            motivo: `Meta diária de serviços extras batida: ${prof.dia.servicosExtras}/${config.metasDiarias.servicosExtrasQtd} extras realizados`,
            quantidadeGiros: config.metasDiarias.servicosExtrasGiros || 1,
            status: 'pendente_giro',
            criadoEm: new Date().toISOString(),
            premioGanho: null,
            giradoEm: null,
            entregueEm: null,
            entreguePor: null,
          };
        }
      }
    }

    // 2. Meta Diária de Produtos (por QUANTIDADE de unidades)
    if (config.metasDiarias.produtosAtivo) {
      const alvoQtd = Number(config.metasDiarias.produtosQtd ?? (config.metasDiarias.produtosValor > 0 ? 0 : 2));
      const alvoValor = Number(config.metasDiarias.produtosValor || 0);
      const usaQtd = alvoQtd > 0 || alvoValor <= 0;
      const alvo = usaQtd ? (alvoQtd || 2) : alvoValor;
      const atual = usaQtd ? (prof.dia.produtosQtd || 0) : (prof.dia.produtosValor || 0);
      const bateuProdutos = alvo > 0 && atual >= alvo;

      prof.dia.metaProdutosAtingida = bateuProdutos;
      prof.dia.metaProdutosAlvo = alvo;
      prof.dia.metaProdutosTipo = usaQtd ? 'quantidade' : 'valor';
      prof.dia.metaProdutosProgresso = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0;

      if (bateuProdutos) {
        const chaveUnica = `meta_diaria_produtos:${profId}:${hoje}`;
        const jaExiste = girosExistentes.find((g) => g.chaveUnica === chaveUnica);
        if (!jaExiste) {
          const giroId = `giro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          estado.giros[giroId] = {
            id: giroId,
            chaveUnica,
            empresaId,
            profissionalId: profId,
            profissionalNome: nome,
            dataReferencia: hoje,
            tipoOrigem: 'meta_diaria_produtos',
            motivo: usaQtd
              ? `Meta diária de produtos batida: ${prof.dia.produtosQtd}/${alvo} produtos vendidos (${Number(prof.dia.produtosValor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
              : `Meta diária de produtos batida: R$ ${prof.dia.produtosValor.toFixed(2)} vendidos (alvo: R$ ${alvo.toFixed(2)})`,
            quantidadeGiros: config.metasDiarias.produtosGiros || 1,
            status: 'pendente_giro',
            criadoEm: new Date().toISOString(),
            premioGanho: null,
            giradoEm: null,
            entregueEm: null,
            entreguePor: null,
          };
        }
      }
    }

    // 3. Meta Semanal de Produtos / Desafio
    if (config.metasSemanais.ativo) {
      const bateuSemanalProd = (config.metasSemanais.produtosValor > 0 && prof.semana.produtosValor >= config.metasSemanais.produtosValor) ||
                               (config.metasSemanais.produtosQtd > 0 && prof.semana.produtosQtd >= config.metasSemanais.produtosQtd);
      const bateuSemanalFat = config.metasSemanais.faturamentoValor > 0 && prof.semana.faturamentoTotal >= config.metasSemanais.faturamentoValor;
      const bateuDesafio = bateuSemanalProd || bateuSemanalFat;

      prof.semana.metaProdutosAtingida = bateuSemanalProd;
      prof.semana.metaDesafioAtingida = bateuDesafio;
      prof.semana.metaProdutosAlvo = config.metasSemanais.produtosValor;
      prof.semana.progressoProdutos = config.metasSemanais.produtosValor > 0
        ? Math.min(100, Math.round((prof.semana.produtosValor / config.metasSemanais.produtosValor) * 100))
        : 0;

      if (bateuDesafio && config.metasSemanais.girosDesafio > 0) {
        const chaveUnica = `meta_semanal_desafio:${profId}:${semanaChave}`;
        const jaExiste = girosExistentes.find((g) => g.chaveUnica === chaveUnica);
        if (!jaExiste) {
          const giroId = `giro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          estado.giros[giroId] = {
            id: giroId,
            chaveUnica,
            empresaId,
            profissionalId: profId,
            profissionalNome: nome,
            dataReferencia: semanaChave,
            tipoOrigem: 'meta_semanal',
            motivo: `Desafio Semanal atingido (${config.metasSemanais.tituloDesafio}): R$ ${prof.semana.produtosValor.toFixed(2)} em produtos / R$ ${prof.semana.faturamentoTotal.toFixed(2)} total`,
            quantidadeGiros: config.metasSemanais.girosDesafio || 2,
            status: 'pendente_giro',
            criadoEm: new Date().toISOString(),
            premioGanho: null,
            giradoEm: null,
            entregueEm: null,
            entreguePor: null,
          };
        }
      }
    }

    // Associa giros deste profissional para a visualização
    const girosDoProf = Object.values(estado.giros || {}).filter((g) => g.profissionalId === profId);
    prof.girosPendentes = girosDoProf.filter((g) => g.status === 'pendente_giro');
    prof.girosAguardandoEntrega = girosDoProf.filter((g) => g.status === 'girado' && !g.entregueEm);
    prof.girosEntregues = girosDoProf.filter((g) => g.status === 'entregue' || Boolean(g.entregueEm));
  }

  save();

  return {
    config,
    apuracao,
    semana: apuracao.semana,
    profissionais: apuracao.profissionais,
    resumoGiros: {
      totalPendentesGiro: Object.values(estado.giros || {}).filter((g) => g.status === 'pendente_giro').length,
      totalAguardandoEntrega: Object.values(estado.giros || {}).filter((g) => g.status === 'girado' && !g.entregueEm).length,
      totalEntregues: Object.values(estado.giros || {}).filter((g) => g.status === 'entregue' || Boolean(g.entregueEm)).length,
    },
  };
}

/**
 * Registra a execução de um giro de roleta para um profissional
 */
export function executarGiro(empresaId, { giroId, premioNome = '', premioId = '', usuario = '' } = {}) {
  const estado = estadoGamificacao(empresaId);
  const config = obterConfiguracao(empresaId);

  let giro = estado.giros[String(giroId)];

  // Se não foi passado um giroId existente, cria um avulso concedido pelo gestor
  if (!giro) {
    throw new Error('Registro de giro não encontrado.');
  }

  // Determina o prêmio (sorteado automaticamente se não foi especificado manualmente)
  let premioFinal = premioNome;
  if (!premioFinal) {
    const premiosAtivos = (config.premiosRoleta || []).filter((p) => p.ativo !== false);
    if (premiosAtivos.length > 0) {
      // Sorteio ponderado pelo peso
      const pesoTotal = premiosAtivos.reduce((s, p) => s + (Number(p.peso) || 10), 0);
      let rand = Math.random() * pesoTotal;
      let selecionado = premiosAtivos[0];
      for (const p of premiosAtivos) {
        rand -= Number(p.peso) || 10;
        if (rand <= 0) {
          selecionado = p;
          break;
        }
      }
      premioFinal = selecionado.nome;
    } else {
      premioFinal = 'Prêmio Surpresa';
    }
  }

  giro.premioGanho = premioFinal;
  giro.premioId = premioId || null;
  giro.status = 'girado';
  giro.giradoEm = new Date().toISOString();
  giro.giradoPor = String(usuario || '').slice(0, 120);

  save();
  return giro;
}

/**
 * Concede um giro bônus diretamente pelo gestor (por mérito, desafio relâmpago, etc.)
 */
export function concederGiroBonus(empresaId, { profissionalId, profissionalNome = '', motivo = 'Giro Bônus do Gestor', usuario = '' } = {}) {
  const estado = estadoGamificacao(empresaId);
  if (!profissionalId) throw new Error('Profissional é obrigatório.');

  const giroId = `giro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const giro = {
    id: giroId,
    chaveUnica: `bonus:${profissionalId}:${Date.now()}`,
    empresaId,
    profissionalId,
    profissionalNome: profissionalNome || 'Profissional',
    dataReferencia: dataIsoCuiaba(),
    tipoOrigem: 'avulso_gestor',
    motivo: String(motivo || 'Bônus concedido pelo gestor').slice(0, 160),
    quantidadeGiros: 1,
    status: 'pendente_giro',
    criadoEm: new Date().toISOString(),
    concedidoPor: String(usuario || '').slice(0, 120),
    premioGanho: null,
    giradoEm: null,
    entregueEm: null,
    entreguePor: null,
  };

  estado.giros[giroId] = giro;
  save();
  return giro;
}

/**
 * Confirma a entrega ou pagamento do prêmio sorteado na roleta
 */
export function confirmarEntregaPremio(empresaId, giroId, { entreguePor = '', observacao = '' } = {}) {
  const estado = estadoGamificacao(empresaId);
  const giro = estado.giros[String(giroId)];
  if (!giro) throw new Error('Giro não encontrado.');

  giro.status = 'entregue';
  giro.entregueEm = new Date().toISOString();
  giro.entreguePor = String(entreguePor || '').slice(0, 120);
  if (observacao) giro.observacaoEntrega = String(observacao).slice(0, 200);

  save();
  return giro;
}

/**
 * Lista o histórico completo de giros e premiações com filtros
 */
export function listarHistoricoGiros(empresaId, { profissionalId = null, status = null, dataInicio = null, dataFim = null } = {}) {
  const estado = estadoGamificacao(empresaId);
  let lista = Object.values(estado.giros || {});

  if (profissionalId) {
    lista = lista.filter((g) => g.profissionalId === String(profissionalId));
  }

  if (status) {
    if (status === 'pendente_giro') lista = lista.filter((g) => g.status === 'pendente_giro');
    else if (status === 'aguardando_entrega') lista = lista.filter((g) => g.status === 'girado' && !g.entregueEm);
    else if (status === 'entregue') lista = lista.filter((g) => g.status === 'entregue' || Boolean(g.entregueEm));
  }

  if (dataInicio) {
    lista = lista.filter((g) => (g.dataReferencia || g.criadoEm.slice(0, 10)) >= dataInicio);
  }
  if (dataFim) {
    lista = lista.filter((g) => (g.dataReferencia || g.criadoEm.slice(0, 10)) <= dataFim);
  }

  // Ordena decrescente por criadoEm
  return lista.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}
