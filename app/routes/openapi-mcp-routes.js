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
import {
  PALATARE_CARDAPIO_INICIAL,
  PALATARE_CONFIG_MONTADOR,
  PALATARE_KDS_FILA,
  PALATARE_RODIZIO_CONFIG,
  PALATARE_CLIENTES_CRM,
  PALATARE_DELIVERY_ZONAS,
} from '../palatare-pizzaria-seed.js';
import {
  CONCRETO_CARGAS_INICIAIS,
  CONCRETO_CATALOGO_INICIAL,
} from '../concreto-usina-seed.js';
import { obterConsolidacaoGrupo } from '../modules/empresas/consolidacao.js';

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
          { name: 'origem', in: 'query', schema: { type: 'string', enum: ['whatsapp_ia'] }, description: 'Restringe a visão à origem WhatsApp IA.' },
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
  {
    name: 'palatare_cardapio',
    description: 'Consulta o cardápio completo da Palatare Pizzaria (pizzas tradicionais, especiais, calzones, bordas, massas, bebidas).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        categoria: { type: 'string', description: 'Categoria opcional para filtro (ex: pizza, calzone, massa, sobremesa, bebida)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'palatare_montador',
    description: 'Calcula e valida a composição de uma pizza fracionada (1/1, 1/2, 1/3, 1/4) aplicando regra da maior fração, bordas e adicionais.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        tamanho: { type: 'string', description: 'brotinho, media, grande ou familia' },
        sabores: { type: 'array', items: { type: 'string' }, description: 'Nomes ou IDs dos sabores' },
        borda: { type: 'string', description: 'Nome da borda recheada opcional' },
        massa: { type: 'string', description: 'Tipo de massa opcional' },
      },
      required: ['tamanho', 'sabores'],
      additionalProperties: false,
    },
  },
  {
    name: 'palatare_kds',
    description: 'Consulta o estado em tempo real da linha de produção do forno a lenha a 400°C (bancada, forno, corte e rota).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'palatare_rodizio',
    description: 'Consulta as mesas ativas de rodízio no salão, semáforo atual (verde/amarelo/vermelho), fatias servidas e pré-conta.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        mesa: { type: 'string', description: 'Número da mesa opcional (ex: "2", "5")' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'palatare_crm_cliente',
    description: 'Retorna o DNA gastronômico de clientes de Tangará da Serra (sabores favoritos, borda preferida, restrições e classificação RFV/LTV).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Nome, telefone ou sabor procurado' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'palatare_delivery',
    description: 'Consulta zonas de entrega, taxas de motoboy e tempo estimado para bairros de Tangará da Serra/MT.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        bairro: { type: 'string', description: 'Nome do bairro em Tangará da Serra' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'palatare_delivery_marketplaces',
    description: 'Consulta o status do Hub de Delivery Multicanal da Pizzaria (iFood Brasil, Keeta Meituan, WhatsApp Kytto e Open Delivery Abrasel), métricas de faturamento e comparativo de taxas de comissão.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'palatare_delivery_pedidos',
    description: 'Lista e filtra pedidos em tempo real da Pizzaria recebidos via iFood, Keeta e WhatsApp, com detalhes de montagem das pizzas (fracionamento, bordas, massas) e status da entrega.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        canal: { type: 'string', description: 'Filtro por canal: todos, ifood, keeta, whatsapp_proprio' },
        status: { type: 'string', description: 'Filtro por status: todos, novo, preparando_forno, pronto_expedicao, despachado' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'palatare_delivery_simular',
    description: 'Injeta um pedido simulado de marketplace (iFood ou Keeta) na linha de produção da pizzaria para homologação e testes da equipe.',
    readOnlyHint: false,
    inputSchema: {
      type: 'object',
      properties: {
        canal: { type: 'string', description: 'Canal a simular: ifood, keeta ou whatsapp_proprio' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_cargas',
    description: 'Consulta a programação de cargas de concreto usinado, status das betoneiras, bombas lança e traços FCK.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_dosagem',
    description: 'Calculadora de dosagem de traços de concreto por m³ (cimento, areia, brita, água/cimento, slump NBR 7212).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        fck: { type: 'integer', description: 'FCK desejado em MPa (20, 25, 30, 35 ou 40)' },
        volumeM3: { type: 'number', description: 'Volume total em metros cúbicos (m³)' },
      },
      required: ['fck', 'volumeM3'],
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_ensaios',
    description: 'Consulta o controle tecnológico de concreto usinado: lotes de corpos de prova (CP), slump test e laudos NBR 5739.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        lote: { type: 'string', description: 'Número do lote do CP (ex: CP-2026-088)' }
      },
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_lista_tecnica',
    description: 'Consulta as Listas Técnicas (BOM / Fichas Técnicas de Traços) de fabricação de concreto FCK 15 a 45 MPa com consumos e custos de insumos.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        fck: { type: 'integer', description: 'FCK específico para filtrar (15, 20, 25, 30, 35, 40 ou 45)' }
      },
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_compras',
    description: 'Consulta pedidos de compras de matérias-primas (cimento a granel, britas, aditivos, diesel) e cotações de fornecedores.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_custos',
    description: 'Calculadora industrial de custos e precificação: decompõe CPV de insumos, usinagem da central Convicta, frete e margem de contribuição.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        fck: { type: 'integer', description: 'FCK desejado em MPa' },
        volumeM3: { type: 'number', description: 'Volume total em m³' },
        distanciaKm: { type: 'number', description: 'Distância da obra em km a partir da usina' },
        tipoBomba: { type: 'string', description: 'Tipo de bombeamento (calha ou bomba lança)' }
      },
      required: ['fck', 'volumeM3'],
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_ordens_producao',
    description: 'Consulta ordens de fabricação de concreto (OPs) e consumo real da balança de células de carga.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_silos',
    description: 'Consulta níveis de estoque industrial: Silo Convicta 96t (cimento), Silo 60t e pátios da Serrano Mineração.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_mineracao',
    description: 'Consulta operações da Serrano Mineração: dragas nos rios Sepotuba e Formoso, pátios de areia lavada, romaneios de balança e royalties CFEM.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_romaneio',
    description: 'Consulta o Romaneio de Carga NBR 7212 com ticket de pesagem da balança rodoviária 80t e assinatura digital do cliente na entrega.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        cargaId: { type: 'string', description: 'ID ou número da carga (ex: 1001 ou crg-1001)' }
      },
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_balanca',
    description: 'Consulta tickets de pesagem da balança rodoviária 80t Toledo da usina e mineração (pesagem bruta, tara, líquido e assinatura).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'string', description: 'ID ou número do ticket de pesagem' }
      },
      additionalProperties: false,
    },
  },
  {
    name: 'concreto_medicoes',
    description: 'Consulta medições periódicas de concretagem por construtora/obra (faturamento quinzenal/mensal e retenções técnicas).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nome da construtora ou obra' }
      },
      additionalProperties: false,
    },
  },
  {
    name: 'holding_consolidacao',
    description: 'Relatório executivo consolidado da holding Grupo Serrano & Palatare (concreto usinado + pizzaria gourmet).',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        periodo: { type: 'string', description: 'mes_atual ou ano_atual' },
      },
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

    // ==========================================
    // EXTENSÃO GASTRONÔMICA: PALATARE PIZZARIA
    // ==========================================
    if (name === 'palatare_cardapio') {
      const cat = String(args.categoria || '').toLowerCase().trim();
      let itens = PALATARE_CARDAPIO_INICIAL || [];
      if (cat) {
        itens = itens.filter(i => String(i.categoria || '').toLowerCase().includes(cat) || String(i.nome || '').toLowerCase().includes(cat));
      }
      return {
        empresa: 'Palatare Pizzaria & Restaurante',
        cidade: 'Tangará da Serra/MT',
        totalItens: itens.length,
        categoriaFiltro: cat || 'todas',
        itens: itens.map(i => ({
          id: i.id,
          nome: i.nome,
          categoria: i.categoria,
          preco: i.preco,
          descricao: i.descricao,
          destaque: i.destaque || false
        }))
      };
    }

    if (name === 'palatare_montador') {
      const tamanhoKey = String(args.tamanho || 'grande').toLowerCase();
      const tamanhoObj = (PALATARE_CONFIG_MONTADOR?.tamanhos || []).find(t => t.id === tamanhoKey) || PALATARE_CONFIG_MONTADOR?.tamanhos?.[2];
      const saboresInput = Array.isArray(args.sabores) ? args.sabores : [args.sabores || 'Pizza Filé Mignon ao Gorgonzola'];
      
      const cardapio = PALATARE_CARDAPIO_INICIAL || [];
      const saboresResolvidos = saboresInput.map(sInput => {
        const item = cardapio.find(c => c.id === sInput || c.nome.toLowerCase().includes(String(sInput).toLowerCase())) || cardapio[0];
        return item;
      });

      // Regra da Maior Fração
      const precos = saboresResolvidos.map(s => Number(s.preco || 0));
      const maiorPreco = Math.max(...precos, Number(tamanhoObj?.precoBase || 76));

      // Borda e Massa
      let valorBorda = 0;
      let bordaNome = args.borda || 'Tradicional';
      if (args.borda) {
        const bObj = (PALATARE_CONFIG_MONTADOR?.bordas || []).find(b => b.nome.toLowerCase().includes(String(args.borda).toLowerCase()));
        if (bObj) {
          valorBorda = Number(bObj.preco || 0);
          bordaNome = bObj.nome;
        }
      }

      const valorTotal = maiorPreco + valorBorda;

      return {
        tamanho: tamanhoObj?.nome,
        fatias: tamanhoObj?.fatias,
        diametro: tamanhoObj?.diametro,
        fracoes: saboresResolvidos.map((s, idx) => ({
          fracao: `1/${saboresResolvidos.length}`,
          sabor: s.nome,
          precoCatalogo: s.preco
        })),
        regraPrecificacao: 'Cobrança pela Maior Fração',
        precoBaseSabor: maiorPreco,
        borda: { nome: bordaNome, adicional: valorBorda },
        massa: args.massa || 'Napolitana Fermentação Natural 48h (Levain)',
        valorTotalPizza: Number(valorTotal.toFixed(2))
      };
    }

    if (name === 'palatare_kds') {
      return {
        empresa: 'Palatare Pizzaria & Restaurante',
        fornoTemperaturaAtual: '410°C (Forno a Lenha de Reflorestamento)',
        tempoMedioCoccao: '4 minutos',
        filaAoVivo: PALATARE_KDS_FILA || [],
        resumoPracas: {
          bancadaMontagem: (PALATARE_KDS_FILA || []).filter(p => p.status === 'bancada').length,
          fornoLenha: (PALATARE_KDS_FILA || []).filter(p => p.status === 'forno').length,
          corteFinalizacao: (PALATARE_KDS_FILA || []).filter(p => p.status === 'corte').length,
          emRota: (PALATARE_KDS_FILA || []).filter(p => p.status === 'rota').length,
        }
      };
    }

    if (name === 'palatare_rodizio') {
      const mesas = PALATARE_RODIZIO_CONFIG?.mesasEmRodizioHoje || [];
      if (args.mesa) {
        const m = mesas.find(x => String(x.mesa) === String(args.mesa));
        return m || { aviso: `Mesa ${args.mesa} não encontrada no rodízio.` };
      }
      return {
        empresa: 'Palatare Pizzaria & Restaurante',
        diasOficiais: PALATARE_RODIZIO_CONFIG?.diasOficiais,
        precoAdulto: PALATARE_RODIZIO_CONFIG?.precoAdulto,
        precoCrianca: PALATARE_RODIZIO_CONFIG?.precoCrianca,
        mesasEmRodizio: mesas,
        totalAdultosSalão: mesas.reduce((acc, m) => acc + (m.adultos || 0), 0),
        totalFatiasServidas: mesas.reduce((acc, m) => acc + (m.fatiasServidas || 0), 0),
      };
    }

    if (name === 'palatare_crm_cliente') {
      const busca = String(args.busca || '').toLowerCase().trim();
      let clientes = PALATARE_CLIENTES_CRM || [];
      if (busca) {
        clientes = clientes.filter(c => 
          c.nome.toLowerCase().includes(busca) || 
          c.telefone.includes(busca) || 
          c.bairro.toLowerCase().includes(busca) ||
          (c.saboresFavoritos || []).some(s => s.toLowerCase().includes(busca))
        );
      }
      return {
        totalEncontrados: clientes.length,
        clientes: clientes.map(c => ({
          id: c.id,
          nome: c.nome,
          profissao: c.profissao,
          bairro: c.bairro,
          canal: c.canal,
          classificacaoRfv: c.classificacaoRfv,
          aniversario: c.aniversario,
          saboresFavoritos: c.saboresFavoritos,
          bordaFavorita: c.bordaFavorita,
          massaFavorita: c.massaFavorita,
          restricoes: c.restricoes,
          totalPedidos: c.totalPedidos,
          ltvTotal: c.ltvTotal,
          ticketMedio: c.ticketMedio,
          diasDesdeUltimoPedido: c.diasDesdeUltimoPedido
        }))
      };
    }

    if (name === 'palatare_delivery') {
      const zonas = PALATARE_DELIVERY_ZONAS || [];
      const bairro = String(args.bairro || '').toLowerCase().trim();
      if (bairro) {
        const z = zonas.find(x => x.bairro.toLowerCase().includes(bairro));
        return z || { aviso: `Bairro '${args.bairro}' sob consulta direta da central (Tangará da Serra).`, taxaEstimada: 12.00, tempoEstimado: '30-40 min' };
      }
      return {
        cidade: 'Tangará da Serra/MT',
        totalZonas: zonas.length,
        zonas
      };
    }
    if (name === 'palatare_delivery_marketplaces') {
      const { obterConfiguracaoCanais, obterRelatorioConciliacaoCanais } = await import('../modules/pizzaria/delivery-marketplaces.js');
      const cfg = obterConfiguracaoCanais();
      const conc = obterRelatorioConciliacaoCanais();
      return {
        empresa: 'Palatare Pizzaria & Restaurante',
        hub: 'Kytto Multi-Channel Delivery Hub',
        canais: cfg.canais,
        conciliacaoTaxas: conc
      };
    }
    if (name === 'palatare_delivery_pedidos') {
      const { listarPedidosMulticanal } = await import('../modules/pizzaria/delivery-marketplaces.js');
      const res = listarPedidosMulticanal(undefined, args);
      return res;
    }
    if (name === 'palatare_delivery_simular') {
      const { simularPedidoMarketplace } = await import('../modules/pizzaria/delivery-marketplaces.js');
      const res = simularPedidoMarketplace(undefined, args.canal || 'ifood');
      return res;
    }

    // ==========================================
    // EXTENSÃO INDUSTRIAL: SERRANO CONCRETO
    // ==========================================
    if (name === 'concreto_cargas') {
      const { obterDadosConcreto } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const dados = typeof obterDadosConcreto === 'function' ? await obterDadosConcreto() : {};
      return {
        empresa: 'Serrano Concreto Usinado',
        usinaCapacidade: '80 m³/h (Central Dosadora Automatizada)',
        cargasProgramadasHoje: dados.cargas || CONCRETO_CARGAS_INICIAIS || [],
        catalogoTracos: dados.catalogo || CONCRETO_CATALOGO_INICIAL || [],
        frota: dados.frota || []
      };
    }

    if (name === 'concreto_ensaios') {
      const { obterDadosConcreto } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const dados = typeof obterDadosConcreto === 'function' ? await obterDadosConcreto() : {};
      const lote = String(args.lote || '').trim().toUpperCase();
      const ensaios = dados.ensaios || [];
      if (lote) {
        const e = ensaios.find(x => x.lote.toUpperCase() === lote || x.id.toUpperCase() === lote);
        return e || { aviso: "Lote " + lote + " nao localizado no laboratorio.", ensaiosDisponiveis: ensaios.map(x => x.lote) };
      }
      return {
        laboratorio: 'Laboratório Tecnológico Serrano Concreto',
        responsavelTecnica: 'Engª Karin Prestes (CREA-MT 027300)',
        totalEnsaios: ensaios.length,
        ensaios
      };
    }

    if (name === 'concreto_lista_tecnica') {
      const { gerarListaTecnicaBOM } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const listas = typeof gerarListaTecnicaBOM === 'function' ? gerarListaTecnicaBOM() : [];
      const fck = Number(args.fck);
      if (fck) {
        const item = listas.find(l => l.fck === fck);
        return item || { aviso: 'Traço FCK ' + fck + ' não localizado.', disponiveis: listas.map(l => l.fck) };
      }
      return {
        empresa: 'Serrano Concreto Usinado & Mineração',
        normas: 'ABNT NBR 7212 / NBR 8953 / NBR 6118',
        totalListasTecnicas: listas.length,
        listasTecnicas: listas
      };
    }

    if (name === 'concreto_compras') {
      const { listarComprasInsumos } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const resCompras = typeof listarComprasInsumos === 'function' ? await listarComprasInsumos() : { compras: [] };
      return {
        empresa: 'Serrano Concreto & Mineração',
        fornecedoresHomologados: ['Votorantim Cimentos (Nobres/MT)', 'Cimento Itambé', 'Pedreira Parecis', 'Vedacit / MC-Bauchemie', 'Petrobras'],
        pedidosCompra: resCompras.compras || [],
        insumosCatalogo: resCompras.insumosCatalogo || []
      };
    }

    if (name === 'concreto_custos') {
      const { calcularCustoConcretoAvancado } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const resCustos = typeof calcularCustoConcretoAvancado === 'function' ? calcularCustoConcretoAvancado(args) : {};
      return {
        empresa: 'Serrano Concreto Usinado',
        simulacaoIndustrial: resCustos
      };
    }

    if (name === 'concreto_ordens_producao') {
      const { listarOrdensProducao } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const resOP = typeof listarOrdensProducao === 'function' ? await listarOrdensProducao() : { ordens: [] };
      return {
        empresa: 'Serrano Concreto Usinado',
        centralDosadora: 'Central Automatizada Convicta Silo 96t',
        ordensProducao: resOP.ordens || []
      };
    }

    if (name === 'concreto_silos') {
      const { obterDadosConcreto } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const dados = typeof obterDadosConcreto === 'function' ? await obterDadosConcreto() : {};
      return {
        unidade: 'Serrano Concreto & Mineração Tangará da Serra/MT',
        silosEstoque: dados.silos || [],
        siloPrincipal: 'Silo Convicta Vertical 96 Toneladas',
        mineracaoPropria: 'Serrano Mineração (Areia Média e Grossa de Rio)'
      };
    }
    if (name === 'concreto_mineracao') {
      const { listarMineracao } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const resMin = typeof listarMineracao === 'function' ? await listarMineracao() : {};
      return {
        unidade: 'Serrano Mineração · Dragagem & Pátio de Agregados',
        localizacao: 'Tangará da Serra / MT (Rios Sepotuba e Formoso)',
        ...resMin
      };
    }
    if (name === 'concreto_romaneio') {
      const { obterRomaneioCompleto } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const cargaId = args?.cargaId || '1001';
      const res = typeof obterRomaneioCompleto === 'function' ? await obterRomaneioCompleto(cargaId) : {};
      return {
        empresa: 'Serrano Concreto Usinado & Mineração Ltda',
        norma: 'ABNT NBR 7212 / NBR 8953',
        romaneio: res.carga || {}
      };
    }
    if (name === 'concreto_balanca') {
      const { inicializarDatastoreConcreto } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const data = typeof inicializarDatastoreConcreto === 'function' ? inicializarDatastoreConcreto() : {};
      const tickets = data.concreto_tickets_balanca || [];
      return {
        empresa: 'Serrano Concreto & Mineração',
        balanca: 'Balança Rodoviária 80t Toledo (MT-358)',
        totalTickets: tickets.length,
        tickets
      };
    }
    if (name === 'concreto_medicoes') {
      const { listarMedicoesObras } = await import('../modules/concreto/servico.js').catch(() => ({}));
      const resMed = typeof listarMedicoesObras === 'function' ? await listarMedicoesObras() : { medicoes: [] };
      return {
        empresa: 'Serrano Concreto Usinado',
        medicoesObras: resMed.medicoes || []
      };
    }

    if (name === 'concreto_dosagem') {
      const fck = Number(args.fck || 25);
      const volumeM3 = Number(args.volumeM3 || 8);
      // Traço médio NBR 7212 (Cimento, Areia, Brita 1, Água)
      const tracosFck = {
        20: { cimentoKgM3: 300, areiaKgM3: 720, britaKgM3: 1050, aguaLitrosM3: 180, ac: 0.60 },
        25: { cimentoKgM3: 350, areiaKgM3: 680, britaKgM3: 1040, aguaLitrosM3: 175, ac: 0.50 },
        30: { cimentoKgM3: 400, areiaKgM3: 650, britaKgM3: 1020, aguaLitrosM3: 170, ac: 0.42 },
        35: { cimentoKgM3: 440, areiaKgM3: 620, britaKgM3: 1010, aguaLitrosM3: 165, ac: 0.38 },
        40: { cimentoKgM3: 480, areiaKgM3: 590, britaKgM3: 1000, aguaLitrosM3: 160, ac: 0.33 }
      };
      const tra = tracosFck[fck] || tracosFck[25];
      return {
        fck: `${fck} MPa`,
        volumeTotal: `${volumeM3} m³`,
        normaTecnica: 'ABNT NBR 7212 / NBR 8953 / NBR 5738',
        dosagemPorM3: tra,
        materiaPrimaTotalCarga: {
          cimentoKg: Math.round(tra.cimentoKgM3 * volumeM3),
          areiaMediaKg: Math.round(tra.areiaKgM3 * volumeM3),
          brita1Kg: Math.round(tra.britaKgM3 * volumeM3),
          aguaLitros: Math.round(tra.aguaLitrosM3 * volumeM3),
          aditivoPlastificanteLitros: Number((volumeM3 * 2.5).toFixed(1))
        },
        betoneirasRecomendadas: Math.ceil(volumeM3 / 8)
      };
    }

    // ==========================================
    // EXTENSÃO HOLDING: GRUPO SERRANO & PALATARE
    // ==========================================
    if (name === 'holding_consolidacao') {
      const periodo = args.periodo || 'mes_atual';
      const consolidado = await obterConsolidacaoGrupo({}, { grupoId: 'grp-serrano-palatare-03', periodo });
      return {
        holding: 'Serrano & Palatare Participações S/A',
        grupoId: 'grp-serrano-palatare-03',
        periodo,
        dadosConsolidados: consolidado
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
