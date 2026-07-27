import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

const PERIODOS = Object.freeze({
  hoje: 1,
  semana: 7,
  mes: 30,
  trimestre: 90,
  semestre: 180,
  ano: 365,
});

function numero(valor, padrao = 0) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : padrao;
}

function percentual(atual, anterior) {
  const base = numero(anterior);
  if (base === 0) return atual > 0 ? 100 : 0;
  return Number((((numero(atual) - base) / Math.abs(base)) * 100).toFixed(2));
}

function dataIso(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function intervaloAnalitico(query) {
  const inicioInformado = dataIso(query.inicio);
  const fimInformado = dataIso(query.fim);

  if ((query.inicio && !inicioInformado) || (query.fim && !fimInformado)) {
    throw new Error('Datas devem usar o formato AAAA-MM-DD');
  }

  let fim = fimInformado || new Date();
  fim = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate() + 1));

  let inicio;
  if (inicioInformado) {
    inicio = inicioInformado;
  } else {
    const dias = PERIODOS[query.periodo] || PERIODOS.mes;
    inicio = new Date(fim);
    inicio.setUTCDate(inicio.getUTCDate() - dias);
  }

  const duracaoMs = fim.getTime() - inicio.getTime();
  const maximoMs = 366 * 24 * 60 * 60 * 1000;
  if (duracaoMs <= 0 || duracaoMs > maximoMs) {
    throw new Error('O período deve ter entre 1 e 366 dias');
  }

  const anteriorFim = new Date(inicio);
  const anteriorInicio = new Date(inicio.getTime() - duracaoMs);
  return { inicio, fim, anteriorInicio, anteriorFim, dias: Math.ceil(duracaoMs / 86400000) };
}

function normalizarSerie(rows) {
  return rows.map((linha) => ({
    data: linha.data instanceof Date
      ? linha.data.toISOString().slice(0, 10)
      : String(linha.data).slice(0, 10),
    faturamento: numero(linha.faturamento),
    vendas: numero(linha.vendas),
  }));
}

function calcularPrevisao(serie, horizonte) {
  const valores = serie.map((ponto) => numero(ponto.faturamento));
  const janela = valores.slice(-Math.min(14, valores.length));
  if (janela.length === 0) return [];

  // Média móvel ponderada: dados mais recentes têm maior peso. Esta previsão é
  // deliberadamente determinística, auditável e só usa o histórico real da loja.
  const pesos = janela.map((_, indice) => indice + 1);
  const somaPesos = pesos.reduce((total, peso) => total + peso, 0);
  const mediaPonderada = janela.reduce((total, valor, indice) => total + (valor * pesos[indice]), 0) / somaPesos;
  const primeiro = janela[0];
  const ultimo = janela[janela.length - 1];
  const tendenciaDiaria = janela.length > 1 ? (ultimo - primeiro) / (janela.length - 1) : 0;
  const dataBase = new Date(`${serie[serie.length - 1].data}T00:00:00.000Z`);

  return Array.from({ length: horizonte }, (_, indice) => {
    const data = new Date(dataBase);
    data.setUTCDate(data.getUTCDate() + indice + 1);
    const estimativa = Math.max(0, mediaPonderada + (tendenciaDiaria * (indice + 1)));
    return {
      data: data.toISOString().slice(0, 10),
      faturamento_previsto: Number(estimativa.toFixed(2)),
    };
  });
}

async function consultarResumo({ empresaId, lojaId, intervalo }) {
  const parametros = [
    empresaId,
    lojaId,
    intervalo.inicio.toISOString(),
    intervalo.fim.toISOString(),
    intervalo.anteriorInicio.toISOString(),
    intervalo.anteriorFim.toISOString(),
  ];

  const [vendasResumo, serieVendas, produtos, estoque, pedidos, fiscal] = await Promise.all([
    dbPg.query(
      `SELECT
        COUNT(*) FILTER (WHERE data_venda >= $3 AND data_venda < $4) AS vendas_atual,
        COALESCE(SUM(valor_liquido) FILTER (WHERE data_venda >= $3 AND data_venda < $4), 0) AS faturamento_atual,
        COALESCE(SUM(valor_desconto) FILTER (WHERE data_venda >= $3 AND data_venda < $4), 0) AS descontos_atual,
        COALESCE(AVG(valor_liquido) FILTER (WHERE data_venda >= $3 AND data_venda < $4), 0) AS ticket_medio_atual,
        COUNT(*) FILTER (WHERE data_venda >= $5 AND data_venda < $6) AS vendas_anterior,
        COALESCE(SUM(valor_liquido) FILTER (WHERE data_venda >= $5 AND data_venda < $6), 0) AS faturamento_anterior,
        COALESCE(SUM(valor_desconto) FILTER (WHERE data_venda >= $5 AND data_venda < $6), 0) AS descontos_anterior,
        COALESCE(AVG(valor_liquido) FILTER (WHERE data_venda >= $5 AND data_venda < $6), 0) AS ticket_medio_anterior
       FROM vendas
       WHERE empresa_id = $1
         AND loja_id = $2
         AND status = 'fechada'
         AND data_venda >= $5
         AND data_venda < $4`,
      parametros,
    ),
    dbPg.query(
      `WITH dias AS (
         SELECT generate_series($3::timestamptz::date, ($4::timestamptz::date - INTERVAL '1 day'), INTERVAL '1 day')::date AS data
       ), agregadas AS (
         SELECT DATE(v.data_venda) AS data,
                COUNT(*) AS vendas,
                COALESCE(SUM(v.valor_liquido), 0) AS faturamento
           FROM vendas v
          WHERE v.empresa_id = $1
            AND v.loja_id = $2
            AND v.status = 'fechada'
            AND v.data_venda >= $3
            AND v.data_venda < $4
          GROUP BY DATE(v.data_venda)
       )
       SELECT d.data, COALESCE(a.vendas, 0) AS vendas, COALESCE(a.faturamento, 0) AS faturamento
         FROM dias d
         LEFT JOIN agregadas a ON a.data = d.data
        ORDER BY d.data`,
      parametros.slice(0, 4),
    ),
    dbPg.query(
      `SELECT p.id, p.nome,
              COALESCE(SUM(iv.quantidade), 0) AS quantidade,
              COALESCE(SUM(iv.valor_total), 0) AS faturamento,
              COALESCE(SUM((iv.quantidade * iv.valor_unitario) - (iv.quantidade * p.preco_custo) - COALESCE(iv.desconto_item, 0)), 0) AS margem_bruta
         FROM itens_venda iv
         JOIN vendas v ON v.id = iv.venda_id
         JOIN produtos p ON p.id = iv.produto_id
        WHERE v.empresa_id = $1
          AND v.loja_id = $2
          AND v.status = 'fechada'
          AND v.data_venda >= $3
          AND v.data_venda < $4
        GROUP BY p.id, p.nome
        ORDER BY faturamento DESC
        LIMIT 10`,
      parametros.slice(0, 4),
    ),
    dbPg.query(
      `WITH saldo AS (
         SELECT p.id,
                p.nome,
                COALESCE(SUM(e.quantidade), 0) AS quantidade,
                COALESCE(pp.estoque_minimo, p.estoque_minimo, 0) AS minimo,
                COALESCE(pp.ponto_reposicao, pp.estoque_minimo, p.estoque_minimo, 0) AS ponto_reposicao
           FROM produtos p
           LEFT JOIN estoque e
             ON e.produto_id = p.id
            AND e.empresa_id = $1
            AND e.loja_id = $2
           LEFT JOIN precos_produto_loja pp
             ON pp.produto_id = p.id
            AND pp.empresa_id = $1
            AND pp.loja_id = $2
          WHERE p.empresa_id = $1
            AND p.ativo = true
          GROUP BY p.id, p.nome, pp.estoque_minimo, pp.ponto_reposicao, p.estoque_minimo
       )
       SELECT COUNT(*) FILTER (WHERE quantidade <= 0) AS sem_estoque,
              COUNT(*) FILTER (WHERE quantidade > 0 AND quantidade <= minimo) AS estoque_critico,
              COUNT(*) FILTER (WHERE quantidade > minimo AND quantidade <= ponto_reposicao) AS reposicao,
              COALESCE(json_agg(json_build_object('produto_id', id, 'nome', nome, 'quantidade', quantidade, 'minimo', minimo)
                ORDER BY quantidade ASC) FILTER (WHERE quantidade <= minimo), '[]'::json) AS itens_criticos
         FROM saldo`,
      parametros.slice(0, 2),
    ),
    dbPg.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('novo', 'confirmado', 'em_preparo', 'pronto')) AS pedidos_abertos,
         COUNT(*) FILTER (WHERE status = 'em_preparo') AS em_preparo,
         COUNT(*) FILTER (WHERE status IN ('cancelado', 'rejeitado', 'falha') AND recebido_em >= $3 AND recebido_em < $4) AS cancelados_periodo,
         COALESCE(AVG(EXTRACT(EPOCH FROM (concluido_em - recebido_em)) / 60)
           FILTER (WHERE status = 'concluido' AND concluido_em IS NOT NULL AND recebido_em >= $3 AND recebido_em < $4), 0) AS tempo_medio_conclusao_min
       FROM pedidos_omnichannel
      WHERE empresa_id = $1 AND loja_id = $2`,
      parametros.slice(0, 4),
    ),
    dbPg.query(
      `SELECT
         COUNT(*) FILTER (WHERE status_fiscal = 'contingencia') AS documentos_contingencia,
         COUNT(*) FILTER (WHERE status_fiscal IN ('denegado', 'erro')) AS documentos_com_erro
       FROM documentos_fiscais
      WHERE empresa_id = $1 AND loja_id = $2`,
      parametros.slice(0, 2),
    ),
  ]);

  const atual = vendasResumo.rows[0] || {};
  const serie = normalizarSerie(serieVendas.rows);
  const itensCriticos = estoque.rows[0]?.itens_criticos || [];
  const margemBruta = produtos.rows.reduce((total, item) => total + numero(item.margem_bruta), 0);
  const faturamentoAtual = numero(atual.faturamento_atual);

  const alertas = [];
  const estoqueResumo = estoque.rows[0] || {};
  const pedidosResumo = pedidos.rows[0] || {};
  const fiscalResumo = fiscal.rows[0] || {};
  if (numero(estoqueResumo.sem_estoque) > 0) {
    alertas.push({ severidade: 'critica', categoria: 'estoque', mensagem: `${numero(estoqueResumo.sem_estoque)} produto(s) sem saldo na loja.`, acao: 'Revise a reposição ou transfira estoque.' });
  }
  if (numero(estoqueResumo.estoque_critico) > 0) {
    alertas.push({ severidade: 'alta', categoria: 'estoque', mensagem: `${numero(estoqueResumo.estoque_critico)} produto(s) no estoque mínimo.`, acao: 'Priorize compras ou transferências.' });
  }
  if (numero(pedidosResumo.pedidos_abertos) > 0) {
    alertas.push({ severidade: 'media', categoria: 'pedidos', mensagem: `${numero(pedidosResumo.pedidos_abertos)} pedido(s) aguardam atendimento.`, acao: 'Atualize o status operacional na central de pedidos.' });
  }
  if (numero(fiscalResumo.documentos_contingencia) > 0 || numero(fiscalResumo.documentos_com_erro) > 0) {
    alertas.push({ severidade: 'alta', categoria: 'fiscal', mensagem: `${numero(fiscalResumo.documentos_contingencia)} documento(s) em contingência e ${numero(fiscalResumo.documentos_com_erro)} com erro fiscal.`, acao: 'Verifique a fila fiscal e reprocese documentos pendentes.' });
  }

  return {
    periodo: {
      inicio: intervalo.inicio.toISOString().slice(0, 10),
      fim: new Date(intervalo.fim.getTime() - 86400000).toISOString().slice(0, 10),
      dias: intervalo.dias,
    },
    operacao: {
      faturamento: faturamentoAtual,
      faturamentoPeriodoAnterior: numero(atual.faturamento_anterior),
      variacaoFaturamentoPercentual: percentual(atual.faturamento_atual, atual.faturamento_anterior),
      ticketMedio: numero(atual.ticket_medio_atual),
      ticketMedioPeriodoAnterior: numero(atual.ticket_medio_anterior),
      variacaoTicketMedioPercentual: percentual(atual.ticket_medio_atual, atual.ticket_medio_anterior),
      numeroVendas: numero(atual.vendas_atual),
      numeroVendasPeriodoAnterior: numero(atual.vendas_anterior),
      descontos: numero(atual.descontos_atual),
      margemBruta: Number(margemBruta.toFixed(2)),
      margemBrutaPercentual: faturamentoAtual > 0 ? Number(((margemBruta / faturamentoAtual) * 100).toFixed(2)) : 0,
      faturamentoSerie: serie,
      despesasSerie: [],
      distribuicao: produtos.rows.map((produto) => ({ nome: produto.nome, valor: numero(produto.faturamento) })),
      topProdutos: produtos.rows.map((produto) => ({
        id: produto.id,
        nome: produto.nome,
        quantidade: numero(produto.quantidade),
        faturamento: numero(produto.faturamento),
        margemBruta: numero(produto.margem_bruta),
      })),
    },
    estoque: {
      semEstoque: numero(estoqueResumo.sem_estoque),
      estoqueCritico: numero(estoqueResumo.estoque_critico),
      emReposicao: numero(estoqueResumo.reposicao),
      itensCriticos,
    },
    pedidos: {
      abertos: numero(pedidosResumo.pedidos_abertos),
      emPreparo: numero(pedidosResumo.em_preparo),
      canceladosPeriodo: numero(pedidosResumo.cancelados_periodo),
      tempoMedioConclusaoMinutos: Number(numero(pedidosResumo.tempo_medio_conclusao_min).toFixed(1)),
    },
    fiscal: {
      documentosContingencia: numero(fiscalResumo.documentos_contingencia),
      documentosComErro: numero(fiscalResumo.documentos_com_erro),
    },
    previsao: {
      metodo: 'media_movel_ponderada_com_tendencia_linear',
      observacao: 'Previsão calculada exclusivamente a partir do histórico fechado da loja; não substitui validação gerencial.',
      proximosSeteDias: calcularPrevisao(serie, 7),
      demandaProdutos: produtos.rows
        .map((produto) => {
          const quantidade = numero(produto.quantidade);
          const mediaDiaria = quantidade / Math.max(1, intervalo.dias);
          return {
            produto_id: produto.id,
            nome: produto.nome,
            quantidade_periodo: Number(quantidade.toFixed(3)),
            media_diaria: Number(mediaDiaria.toFixed(3)),
            demanda_prevista_7_dias: Number((mediaDiaria * 7).toFixed(3)),
          };
        })
        .filter((produto) => produto.quantidade_periodo > 0)
        .sort((a, b) => b.demanda_prevista_7_dias - a.demanda_prevista_7_dias)
        .slice(0, 10),
    },
    alertas,
  };
}

async function responderResumo(req, res) {
  try {
    const empresaId = req.empresaId || req.usuario?.empresa_id;
    const lojaId = req.lojaId || req.usuario?.loja_id;
    if (!empresaId || !lojaId) throw new Error('Contexto de empresa e loja é obrigatório');

    const intervalo = intervaloAnalitico(req.query);
    const resumo = await consultarResumo({ empresaId, lojaId, intervalo });
    res.json({
      geradoEm: new Date().toISOString(),
      escopo: { empresa_id: empresaId, loja_id: lojaId },
      ...resumo,
    });
  } catch (erro) {
    res.status(400).json({ erro: erro.message || 'Não foi possível gerar os indicadores' });
  }
}

router.get('/resumo', autenticar, autorizar('admin', 'gerente', 'caixa'), responderResumo);
router.get('/forecast', autenticar, autorizar('admin', 'gerente'), responderResumo);
router.get('/alertas', autenticar, autorizar('admin', 'gerente', 'caixa'), responderResumo);

// Adaptadores de compatibilidade para painéis administrativos já existentes.
router.get('/bi', autenticar, autorizar('admin', 'gerente', 'caixa'), responderResumo);
router.get('/dashboard', autenticar, autorizar('admin', 'gerente', 'caixa'), responderResumo);

export default router;
