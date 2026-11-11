/**
 * ============================================================================
 * KYTTO ERP — ESPECIFICAÇÃO OPENAPI 3.1 & SERVIDOR MCP SOMENTE LEITURA
 * ============================================================================
 * - GET  /api/openapi.json : Especificação OpenAPI 3.1.0 da API Kytto ERP
 * - GET  /api/mcp/tools    : Catálogo das ferramentas MCP somente leitura
 * - POST /api/mcp          : Servidor MCP (JSON-RPC 2.0 / Tool Invocation)
 *                            estritamente isolado pelo empresaId do token.
 */

import { Router } from 'express';
import { query as consultar } from '../db-pg.js';

export const OPENAPI_31_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Kytto ERP Multi-Tenant API & MCP Server',
    version: '2.6.0',
    description:
      'API oficial do Kytto ERP (Barbearia, Varejo, Supermercado, E-commerce, Fiscal SEFAZ-MT e Financeiro/DRE CPC 26). Todas as rotas autenticadas operam sob isolamento multi-tenant estrito pela empresa vinculada ao token.',
    contact: {
      name: 'Engenharia Kytto',
      url: 'https://kytto.com.br',
    },
  },
  servers: [
    {
      url: 'https://kytto.com.br',
      description: 'Produção Kytto ERP (Tangará da Serra/MT — America/Cuiaba)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT emitido no login com escopo de empresa e unidade.',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Saúde da plataforma e do canal ativo de WhatsApp',
        security: [],
        responses: {
          200: {
            description: 'Estado operacional da API, banco de dados e canal WhatsApp (Meta Cloud API / Evolution).',
          },
        },
      },
    },
    '/api/admin/barbearia/ia-agendamentos-resumo': {
      get: {
        summary: 'Visão auditável ia_agendamentos_resumo (T-Rex & Agenda)',
        parameters: [
          { name: 'de', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'ate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: {
            description: 'Números reais de agendamentos criados, confirmados, concluídos, cancelados por motivo e vagas recuperadas.',
          },
        },
      },
    },
    '/api/admin/erp/dre': {
      get: {
        summary: 'DRE Contábil (Lei 6.404/76 / CPC 26) e Gerencial por empresa',
        parameters: [
          { name: 'ano', in: 'query', schema: { type: 'integer', example: 2026 } },
          { name: 'mes', in: 'query', schema: { type: 'integer', example: 11 } },
          { name: 'regime', in: 'query', schema: { type: 'string', enum: ['competencia', 'caixa'] } },
        ],
        responses: {
          200: { description: 'Demonstração do Resultado do Exercício com AV% e AH%.' },
          403: { description: 'Acesso negado a empresa fora do escopo autorizado.' },
        },
      },
    },
    '/api/admin/supermercado/atacarejo-faixas': {
      get: {
        summary: 'Regras de preço de atacarejo por faixa de quantidade',
        responses: { 200: { description: 'Lista de faixas ativas da empresa.' } },
      },
    },
    '/api/admin/supermercado/promocoes-avancadas': {
      get: {
        summary: 'Campanhas e promoções comerciais ativas',
        responses: { 200: { description: 'Lista de promoções ativas da empresa.' } },
      },
    },
    '/api/admin/supermercado/rupturas/tempo-real': {
      get: {
        summary: 'Monitoramento em tempo real de rupturas de gôndola e estoque',
        responses: { 200: { description: 'Indicadores e alertas de ruptura da empresa.' } },
      },
    },
    '/api/admin/supermercado/sugestao-compras': {
      get: {
        summary: 'Sugestão de reposição de estoque baseada no giro real (ROP/LEC)',
        responses: { 200: { description: 'Itens abaixo do ponto de pedido e quantidade sugerida.' } },
      },
    },
    '/api/admin/supermercado/wms/enderecos': {
      get: {
        summary: 'Endereçamento logístico WMS da empresa',
        responses: { 200: { description: 'Endereços de armazenagem e picking.' } },
      },
    },
    '/api/mcp': {
      post: {
        summary: 'Servidor MCP Somente Leitura do Kytto (agenda, vendas, estoque, financeiro)',
        responses: {
          200: { description: 'Resposta JSON-RPC 2.0 / MCP isolada pela empresa do token.' },
          403: { description: 'Token inválido ou tentativa de leitura cruzada entre empresas.' },
        },
      },
    },
  },
};

export const MCP_READONLY_TOOLS = [
  {
    name: 'agenda',
    description: 'Lista horários, agendamentos do dia e ocupação por profissional da empresa autenticada (somente leitura).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data no formato YYYY-MM-DD (padrão: hoje em America/Cuiaba)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'vendas',
    description: 'Retorna o resumo de vendas e receitas do dia, semana e mês da empresa autenticada (somente leitura).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        competencia: { type: 'string', description: 'Competência YYYY-MM opcional (padrão: mês atual)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'estoque',
    description: 'Lista produtos abaixo do estoque mínimo e sugestão de compra da empresa autenticada (somente leitura).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        limite: { type: 'integer', default: 25, description: 'Quantidade máxima de itens retornados' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'financeiro',
    description: 'Retorna saldo de caixa, contas a receber e contas a pagar vencendo nos próximos 7 dias da empresa autenticada (somente leitura).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
];

function hojeCuiabaIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day}`;
}

export function createOpenApiAndMcpRouter({ auth, obterEmpresaIdToken, barbearia } = {}) {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(OPENAPI_31_SPEC);
  });

  router.get('/mcp/tools', auth, (req, res) => {
    const empresaId = obterEmpresaIdToken ? obterEmpresaIdToken(req) : req.empresaId;
    if (!empresaId) {
      return res.status(403).json({ erro: 'Token sem empresa vinculada.', codigo: 'MCP_TENANT_REQUIRED' });
    }
    res.json({
      protocolVersion: '2025-03-26',
      serverInfo: { name: 'kytto-erp-mcp-readonly', version: '1.0.0' },
      empresaId,
      readOnly: true,
      tools: MCP_READONLY_TOOLS,
    });
  });

  async function executarFerramentaMcp(empresaId, name, args = {}) {
    if (!empresaId) throw new Error('Empresa não identificada no token.');

    if (name === 'agenda') {
      const data = String(args.data || hojeCuiabaIso()).slice(0, 10);
      const agendamentos = barbearia?.listarAgendamentos
        ? barbearia.listarAgendamentos(empresaId, { data })
        : [];
      const profissionais = barbearia?.listarProfissionais
        ? barbearia.listarProfissionais(empresaId, { incluirInativos: false })
        : [];
      const porProfissional = profissionais.map((p) => {
        const doProf = agendamentos.filter((a) => a.profissionalId === p.id && a.status !== 'cancelado');
        return {
          profissionalId: p.id,
          nome: p.nome,
          agendamentosAtivos: doProf.length,
          concluidos: doProf.filter((a) => a.status === 'concluido').length,
        };
      });
      return {
        empresaId,
        data,
        somenteLeitura: true,
        totalAgendamentosDia: agendamentos.filter((a) => a.status !== 'cancelado').length,
        canceladosDia: agendamentos.filter((a) => a.status === 'cancelado').length,
        ocupacaoPorProfissional: porProfissional,
        agendamentos: agendamentos.slice(0, 50).map((a) => ({
          id: a.id,
          horaInicio: a.horaInicio || String(a.dataHora || '').slice(11, 16),
          horaFim: a.horaFim || '',
          status: a.status,
          profissionalNome: a.profissionalNome,
          clienteNome: a.clienteNome,
          servicos: a.servicoNome || a.servicosNomes || '',
          valorTotal: a.valor ?? a.valorTotal ?? 0,
        })),
      };
    }

    if (name === 'vendas') {
      const hoje = hojeCuiabaIso();
      const competencia = String(args.competencia || hoje.slice(0, 7)).slice(0, 7);
      let vendasDia = 0;
      let vendasSemana = 0;
      let vendasMes = 0;
      let qtdLancamentosMes = 0;
      try {
        const finRes = await consultar(
          `SELECT
             COALESCE(SUM(CASE WHEN data_competencia = $2::date THEN valor ELSE 0 END), 0)::numeric(14,2) AS dia,
             COALESCE(SUM(CASE WHEN data_competencia >= ($2::date - INTERVAL '7 days') AND data_competencia <= $2::date THEN valor ELSE 0 END), 0)::numeric(14,2) AS semana,
             COALESCE(SUM(CASE WHEN TO_CHAR(data_competencia, 'YYYY-MM') = $3 THEN valor ELSE 0 END), 0)::numeric(14,2) AS mes,
             COUNT(*) FILTER (WHERE TO_CHAR(data_competencia, 'YYYY-MM') = $3)::int AS qtd_mes
           FROM fin_lancamentos
           WHERE empresa_id = $1
             AND tipo = 'receita'
             AND status != 'cancelado'`,
          [empresaId, hoje, competencia]
        );
        const r = finRes.rows?.[0] || {};
        vendasDia = Number(r.dia || 0);
        vendasSemana = Number(r.semana || 0);
        vendasMes = Number(r.mes || 0);
        qtdLancamentosMes = Number(r.qtd_mes || 0);
      } catch (_e) { /* fallback para comandas da empresa se aplicável */ }

      if (vendasMes === 0 && barbearia?.listarComandasBarbearia) {
        const comandasPagas = barbearia.listarComandasBarbearia(empresaId, { status: 'fechada' }) || [];
        for (const c of comandasPagas) {
          const dt = String(c.fechadaEm || c.abertaEm || '').slice(0, 10);
          const v = Number(c.total || 0);
          if (dt === hoje) vendasDia += v;
          if (dt.startsWith(competencia)) {
            vendasMes += v;
            qtdLancamentosMes += 1;
          }
        }
      }

      return {
        empresaId,
        competencia,
        dataReferencia: hoje,
        somenteLeitura: true,
        resumo: {
          hoje: Number(vendasDia.toFixed(2)),
          ultimos7Dias: Number(vendasSemana.toFixed(2)),
          mesAtual: Number(vendasMes.toFixed(2)),
          quantidadeOperacoesMes: qtdLancamentosMes,
        },
      };
    }

    if (name === 'estoque') {
      const limite = Math.min(100, Math.max(1, Number(args.limite || 25)));
      const itensAbaixoMinimo = [];
      try {
        const estRes = await consultar(
          `SELECT id, sku, nome, unidade, COALESCE(saldo_atual, 0) AS saldo_atual,
                  COALESCE(estoque_minimo, 0) AS estoque_minimo, COALESCE(custo_medio, 0) AS custo_medio
             FROM est_itens
            WHERE empresa_id = $1
              AND ativo = true
              AND COALESCE(saldo_atual, 0) <= COALESCE(estoque_minimo, 0)
            ORDER BY (COALESCE(estoque_minimo, 0) - COALESCE(saldo_atual, 0)) DESC
            LIMIT $2`,
          [empresaId, limite]
        );
        for (const row of estRes.rows || []) {
          const atual = Number(row.saldo_atual || 0);
          const min = Number(row.estoque_minimo || 0);
          const sugerido = Math.max(1, (min * 2) - atual);
          itensAbaixoMinimo.push({
            id: row.id,
            sku: row.sku,
            nome: row.nome,
            unidade: row.unidade || 'UN',
            saldoAtual: atual,
            estoqueMinimo: min,
            quantidadeSugeridaCompra: Number(sugerido.toFixed(2)),
            custoUnitarioEstimado: Number(row.custo_medio || 0),
          });
        }
      } catch (_e) { /* tabela opcional */ }

      return {
        empresaId,
        somenteLeitura: true,
        totalItensAbaixoMinimo: itensAbaixoMinimo.length,
        itens: itensAbaixoMinimo,
      };
    }

    if (name === 'financeiro') {
      const hoje = hojeCuiabaIso();
      let saldoCaixaRealizado = 0;
      let receber7Dias = 0;
      let pagar7Dias = 0;
      const titulosVencendo = [];
      try {
        const resFin = await consultar(
          `SELECT
             COALESCE(SUM(CASE WHEN tipo = 'receita' AND status IN ('pago','baixado','conciliado') THEN valor
                               WHEN tipo = 'despesa' AND status IN ('pago','baixado','conciliado') THEN -valor
                               ELSE 0 END), 0)::numeric(14,2) AS saldo_realizado,
             COALESCE(SUM(CASE WHEN tipo = 'receita' AND status = 'pendente'
                                AND data_vencimento BETWEEN $2::date AND ($2::date + INTERVAL '7 days')
                               THEN valor ELSE 0 END), 0)::numeric(14,2) AS receber_7d,
             COALESCE(SUM(CASE WHEN tipo = 'despesa' AND status = 'pendente'
                                AND data_vencimento BETWEEN $2::date AND ($2::date + INTERVAL '7 days')
                               THEN valor ELSE 0 END), 0)::numeric(14,2) AS pagar_7d
           FROM fin_lancamentos
           WHERE empresa_id = $1
             AND status != 'cancelado'`,
          [empresaId, hoje]
        );
        const r = resFin.rows?.[0] || {};
        saldoCaixaRealizado = Number(r.saldo_realizado || 0);
        receber7Dias = Number(r.receber_7d || 0);
        pagar7Dias = Number(r.pagar_7d || 0);

        const titRes = await consultar(
          `SELECT id, tipo, descricao, valor, data_vencimento, status
             FROM fin_lancamentos
            WHERE empresa_id = $1
              AND status = 'pendente'
              AND data_vencimento BETWEEN $2::date AND ($2::date + INTERVAL '7 days')
            ORDER BY data_vencimento ASC
            LIMIT 25`,
          [empresaId, hoje]
        );
        for (const t of titRes.rows || []) {
          titulosVencendo.push({
            id: t.id,
            tipo: t.tipo,
            descricao: t.descricao,
            valor: Number(t.valor || 0),
            vencimento: t.data_vencimento ? new Date(t.data_vencimento).toISOString().slice(0, 10) : hoje,
            status: t.status,
          });
        }
      } catch (_e) { /* tabela opcional */ }

      return {
        empresaId,
        dataReferencia: hoje,
        somenteLeitura: true,
        saldoCaixaRealizado,
        contasAReceberProximos7Dias: receber7Dias,
        contasAPagarProximos7Dias: pagar7Dias,
        titulosVencendo7Dias: titulosVencendo,
      };
    }

    throw new Error(`Ferramenta MCP desconhecida ou não permitida: ${name}`);
  }

  router.post('/mcp', auth, async (req, res) => {
    try {
      const empresaId = obterEmpresaIdToken ? obterEmpresaIdToken(req) : req.empresaId;
      if (!empresaId) {
        return res.status(403).json({
          jsonrpc: '2.0',
          id: req.body?.id ?? null,
          error: { code: -32001, message: 'Token sem empresa ativa vinculada.' },
        });
      }

      // Bloqueia tentativa de sobrescrever empresaId nos argumentos da tool
      const requestedArgEmpresa = req.body?.params?.arguments?.empresaId || req.body?.arguments?.empresaId;
      if (requestedArgEmpresa && String(requestedArgEmpresa) !== String(empresaId)) {
        return res.status(403).json({
          jsonrpc: '2.0',
          id: req.body?.id ?? null,
          error: { code: -32003, message: 'Acesso negado: a chave MCP está vinculada exclusivamente à empresa do token.' },
        });
      }

      const method = req.body?.method || 'tools/call';
      const rpcId = req.body?.id ?? 1;

      if (method === 'initialize') {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'kytto-erp-mcp-readonly', version: '1.0.0' },
          },
        });
      }

      if (method === 'tools/list') {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: { tools: MCP_READONLY_TOOLS },
        });
      }

      if (method === 'tools/call') {
        const toolName = req.body?.params?.name || req.body?.tool || req.body?.name;
        const toolArgs = req.body?.params?.arguments || req.body?.arguments || {};
        const dados = await executarFerramentaMcp(empresaId, toolName, toolArgs);
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            content: [{ type: 'text', text: JSON.stringify(dados, null, 2) }],
            structuredContent: dados,
            isError: false,
          },
        });
      }

      return res.status(400).json({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32601, message: `Método MCP não suportado: ${method}` },
      });
    } catch (err) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: req.body?.id ?? null,
        error: { code: -32000, message: err.message },
      });
    }
  });

  return router;
}
