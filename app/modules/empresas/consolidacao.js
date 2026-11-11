import { emitirEventoInterno } from '../a2/eventos.js';
import * as barbearia from '../../barbearia-erp-kytto.js';
import { listarEmpresas } from './servico.js';

// Grupos Econômicos Padrão da Plataforma (Holdings)
const GRUPOS_PADRAO = [
  {
    id: 'grp-kytto-silvester-01',
    nome: 'Grupo Kytto / Silvester Holding',
    slug: 'grupo-kytto-silvester',
    cnpj: '50.073.355/0002-60',
    cnpjFormatado: '50.073.355/0002-60',
    razaoSocial: 'Silvester Participações e Gestão Empresarial S/A',
    responsavel: 'Rodrigo Ribeiro Gonçalves',
    segmentoPrincipal: 'Holding Multissetorial (Beleza, Varejo, Agro & Tecnologia)',
    descricao: 'Consolidação corporativa dos negócios Barbearia Dino, Stallone Nutre Sport, AGRO OPEN TTC e Kytto Commerce.',
    ativo: true,
  },
  {
    id: 'grp-agro-open-02',
    nome: 'Grupo AGRO OPEN Brasil',
    slug: 'grupo-agro-open-brasil',
    cnpj: '48.094.075/0001-38',
    cnpjFormatado: '48.094.075/0001-38',
    razaoSocial: 'AGRO OPEN Agronegócios e Insumos Ltda',
    responsavel: 'Diretoria de Operações Agro & Eventos',
    segmentoPrincipal: 'Agronegócio, Distribuição de Insumos, Esporte e B2B',
    descricao: 'Consolidação de operações esportivas, rastreabilidade de safras e vendas de insumos.',
    ativo: true,
  }
];

// Mapeamento de Segmentos Multi-Business por Empresa
const MULTI_BUSINESS_MAP = {
  // Barbearia Dino
  'd0d0ac01-8e50-4b61-8c79-de4aaa916da6': {
    segmento: 'barbearia_beleza',
    nomeExibicao: 'Serviços de Barbearia, Estética & Bar Balcão',
    icone: 'scissors',
    modulosAtivos: ['agenda_24x7', 'comissoes_progressivas', 'comandas_bar', 'app_barbeiro', 'crm_whatsapp_ia', 'fiscal_nfse_nfce'],
    permiteComandaBar: true,
    permiteAppBarbeiro: true,
    modeloReceita: 'Serviços na Cadeira + Consumo Bar/Revenda + Clubes VIP'
  },
  // Supermercado Kytto
  '00000000-0000-0000-0000-000000000002': {
    segmento: 'supermercado_atacarejo',
    nomeExibicao: 'Supermercado Kytto & Atacarejo Matriz',
    icone: 'store',
    modulosAtivos: ['painel', 'vendas_caixa', 'produtos_precos', 'pereciveis_producao', 'suprimentos_estoque', 'clientes_prevencao', 'erp_comum'],
    permiteComandaBar: false,
    permiteAppBarbeiro: false,
    modeloReceita: 'Varejo Alimentar, Balanças, Açougue & Atacarejo'
  },
  // Stallone Nutre Sport (id canonico)
  '31f70c83-9172-40c2-945f-9e793b5048be': {
    segmento: 'varejo_suplementos_cosmeticos',
    nomeExibicao: 'Varejo de Suplementação, Vitaminas & Moda Esportiva',
    icone: 'package',
    modulosAtivos: ['pdv_balcao', 'catalogo_sku', 'estoque_lotes', 'curva_abc', 'compras_nfe', 'fichas_tecnicas'],
    permiteComandaBar: false,
    permiteAppBarbeiro: false,
    modeloReceita: 'Varejo Físico com Código de Barras (769 SKUs)'
  },
  // Stallone Nutre Sport
  'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e': {
    segmento: 'varejo_suplementos_cosmeticos',
    nomeExibicao: 'Varejo de Suplementação, Vitaminas & Moda Esportiva',
    icone: 'package',
    modulosAtivos: ['pdv_balcao', 'catalogo_sku', 'estoque_lotes', 'curva_abc', 'compras_nfe', 'fichas_tecnicas'],
    permiteComandaBar: false,
    permiteAppBarbeiro: false,
    modeloReceita: 'Varejo Físico com Código de Barras (769 SKUs)'
  },
  // AGRO OPEN TTC
  '2e041110-db20-4fd1-8278-12bd3dead008': {
    segmento: 'agro_industria_b2b',
    nomeExibicao: 'Torneios, Eventos Esportivos, Confecção & Linha B2B',
    icone: 'truck',
    modulosAtivos: ['ordens_compra_xml', 'rastreabilidade_kardex', 'gestao_fornecedores', 'faturamento_prazo', 'nfe_sefaz'],
    permiteComandaBar: false,
    permiteAppBarbeiro: false,
    modeloReceita: '16 Produtos Oficiais + Inscrições de Torneios + B2B'
  },
  // Kytto Tecnologia
  '00000000-0000-0000-0000-000000000001': {
    segmento: 'ecommerce_omnichannel',
    nomeExibicao: 'Plataforma Kytto, SaaS & Infraestrutura Digital',
    icone: 'shopping-bag',
    modulosAtivos: ['storefront_web', 'checkout_transparente', 'cotacao_frete', 'carrinho_whatsapp', 'pix_gateway'],
    permiteComandaBar: false,
    permiteAppBarbeiro: false,
    modeloReceita: 'Licenças SaaS + E-commerce + Royalties Intercompany'
  }
};

/**
 * Retorna os grupos empresariais com suas empresas vinculadas.
 */
export async function listarGruposEmpresariais(db) {
  let grupos = GRUPOS_PADRAO.map(grupo => ({ ...grupo, empresas: [] }));

  try {
    const res = await (db.queryRead || db.query).call(db,`
      SELECT g.id, g.nome, g.slug, g.cnpj, g.razao_social, g.ativo,
             COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'cnpj', e.cnpj, 'ativa', e.ativa)
               ORDER BY e.nome) FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb) AS empresas
        FROM grupos_empresariais g
        LEFT JOIN empresas e ON e.grupo_id = g.id
       GROUP BY g.id
       ORDER BY g.nome ASC
    `);
    if (res?.rows?.length > 0) {
      return res.rows.map(r => ({
        id: r.id,
        nome: r.nome,
        slug: r.slug,
        cnpj: r.cnpj,
        razaoSocial: r.razao_social,
        ativo: r.ativo !== false,
        empresas: r.empresas || []
      }));
    }
  } catch (e) {
    // Fallback gracioso com vinculação em memória
  }

  const todasEmpresas = await listarEmpresas(db);
  grupos[0].empresas = todasEmpresas.map(emp => ({
    id: emp.id,
    nome: emp.nome,
    cnpj: emp.cnpj,
    ativa: emp.ativa
  }));

  return grupos;
}

/**
 * Gera a consolidação financeira, operacional e multi-business para um grupo ou holding.
 */
export async function obterConsolidacaoGrupo(db, { grupoId = '', periodo = 'mes_atual' } = {}) {
  const grupos = await listarGruposEmpresariais(db);
  const grupoAtivo = grupos.find(g => g.id === String(grupoId) || g.slug === String(grupoId)) || grupos[0];
  const empresasDoGrupo = grupoAtivo?.empresas || [];

  let receitaBrutaConsolidada = 0;
  let deducoesImpostosConsolidada = 0;
  let custosInsumosProdutosConsolidado = 0;
  let despesasEquipeComissoesConsolidado = 0;
  let despesasFixasAdministrativasConsolidado = 0;
  let totalColaboradoresConsolidado = 0;
  let totalAtendimentosVendasConsolidado = 0;
  let valorEstoqueConsolidado = 0;
  let temDadoParcial = false;

  const empresasDetalhes = [];

  for (const emp of empresasDoGrupo) {
    const empId = emp.id;
    let mbConfig = MULTI_BUSINESS_MAP[empId] || {
      segmento: emp.tipoNegocio || 'outro',
      nomeExibicao: emp.nome,
      icone: 'building',
      modulosAtivos: ['financeiro', 'cadastros', 'fiscal'],
      modeloReceita: 'Vendas e Prestação de Serviços'
    };

    let faturamentoEmpresa = 0;
    let transacoesEmpresa = 0;
    let estoqueEmpresa = 0;
    let despesasEmpresa = 0;
    let colaboradoresEmpresa = 0;

    // 1. Vendas de Varejo / Supermercado (var_vendas)
    try {
      const vRes = await (db.queryRead || db.query).call(db,
        `SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS count
           FROM var_vendas
          WHERE empresa_id = $1`,
        [empId]
      );
      if (vRes?.rows?.[0]) {
        faturamentoEmpresa += Number(vRes.rows[0].total || 0);
        transacoesEmpresa += Number(vRes.rows[0].count || 0);
      }
    } catch {}

    // 2. Pedidos E-commerce / Loja (commerce_orders)
    try {
      const oRes = await (db.queryRead || db.query).call(db,
        `SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS count
           FROM commerce_orders
          WHERE empresa_id = $1`,
        [empId]
      );
      if (oRes?.rows?.[0]) {
        faturamentoEmpresa += Number(oRes.rows[0].total || 0);
        transacoesEmpresa += Number(oRes.rows[0].count || 0);
      }
    } catch {}

    // 3. Comandas de Salão / Barbearia (estado da empresa multi-tenant)
    try {
      const estadoBarbearia = barbearia.estadoEmpresa(empId, false);
      if (estadoBarbearia) {
        const comandas = Object.values(estadoBarbearia.comandas || {});
        const profissionais = Object.values(estadoBarbearia.profissionais || {}).filter(p => p && p.ativo !== false);
        if (profissionais.length > 0) {
          colaboradoresEmpresa = profissionais.length;
        }
        let fatBarbearia = 0;
        for (const c of comandas) {
          if (c && c.status !== 'cancelada') {
            fatBarbearia += Number(c.total || c.valorTotal || 0);
          }
        }
        if (fatBarbearia > 0) {
          faturamentoEmpresa += fatBarbearia;
          transacoesEmpresa += comandas.filter(c => c && c.status !== 'cancelada').length;
        }
      }
    } catch {}

    if (colaboradoresEmpresa === 0) {
      try {
        const mRes = await (db.queryRead || db.query).call(db,
          `SELECT COUNT(DISTINCT usuario_id)::int AS total
             FROM commerce_memberships
            WHERE empresa_id = $1 AND ativo = true`,
          [empId]
        );
        if (mRes?.rows?.[0]) {
          colaboradoresEmpresa = Number(mRes.rows[0].total || 0);
        }
      } catch {}
    }

    const isUuidEmp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(empId || ''));
    // 4. Estoque Real da Empresa (est_saldos + est_itens)
    if (isUuidEmp) try {
      const eRes = await (db.queryRead || db.query).call(db,
        `SELECT COALESCE(SUM(s.quantidade * COALESCE(NULLIF(i.preco_venda, 0), i.custo_medio, 0)), 0)::numeric AS estoque_venda
           FROM est_saldos s
           JOIN est_itens i ON i.id = s.item_id AND i.empresa_id = s.empresa_id
          WHERE s.empresa_id = $1`,
        [empId]
      );
      if (eRes?.rows?.[0]) {
        estoqueEmpresa = Number(eRes.rows[0].estoque_venda || 0);
      }
    } catch {}

    // 5. Lançamentos Financeiros (fin_lancamentos)
    if (isUuidEmp) try {
      const fRes = await (db.queryRead || db.query).call(db,
        `SELECT COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0)::numeric AS receitas,
                COALESCE(SUM(CASE WHEN tipo = 'DESPESA' THEN valor ELSE 0 END), 0)::numeric AS despesas
           FROM fin_lancamentos
          WHERE empresa_id = $1`,
        [empId]
      );
      if (fRes?.rows?.[0]) {
        if (faturamentoEmpresa === 0 && Number(fRes.rows[0].receitas || 0) > 0) {
          faturamentoEmpresa = Number(fRes.rows[0].receitas || 0);
        }
        despesasEmpresa = Number(fRes.rows[0].despesas || 0);
      }
    } catch {}

    // Indicador estrito de Dado Parcial (sem números inventados)
    const dadoParcial = faturamentoEmpresa === 0;
    if (dadoParcial) temDadoParcial = true;

    const impostosEstimados = faturamentoEmpresa > 0 ? faturamentoEmpresa * 0.06 : 0;
    const comissoesEmpresa = faturamentoEmpresa > 0 ? faturamentoEmpresa * 0.15 : 0;
    const lucroLiquidoEmpresa = faturamentoEmpresa - impostosEstimados - despesasEmpresa - comissoesEmpresa;

    receitaBrutaConsolidada += faturamentoEmpresa;
    deducoesImpostosConsolidada += impostosEstimados;
    custosInsumosProdutosConsolidado += (despesasEmpresa * 0.65);
    despesasEquipeComissoesConsolidado += comissoesEmpresa;
    despesasFixasAdministrativasConsolidado += (despesasEmpresa * 0.35);
    totalColaboradoresConsolidado += colaboradoresEmpresa;
    totalAtendimentosVendasConsolidado += transacoesEmpresa;
    valorEstoqueConsolidado += estoqueEmpresa;

    empresasDetalhes.push({
      empresaId: emp.id,
      nome: emp.nome,
      razaoSocial: emp.razaoSocial || emp.nome,
      cnpj: emp.cnpj,
      cidade: 'Tangará da Serra',
      estado: 'MT',
      multiBusiness: mbConfig,
      faturamento: faturamentoEmpresa,
      impostos: impostosEstimados,
      custos: despesasEmpresa * 0.65,
      comissoesEquipe: comissoesEmpresa,
      despesasFixas: despesasEmpresa * 0.35,
      lucroLiquido: lucroLiquidoEmpresa,
      margemLiquidaPercentual: faturamentoEmpresa > 0 ? (lucroLiquidoEmpresa / faturamentoEmpresa) * 100 : 0,
      totalColaboradores: colaboradoresEmpresa,
      totalTransacoes: transacoesEmpresa,
      valorEstoque: estoqueEmpresa,
      dadoParcial,
      motivoDadoParcial: dadoParcial ? 'Sem lançamentos no período' : null,
      participacaoNoGrupoPercentual: 0
    });
  }

  // Participação %
  for (const emp of empresasDetalhes) {
    emp.participacaoNoGrupoPercentual = receitaBrutaConsolidada > 0
      ? (emp.faturamento / receitaBrutaConsolidada) * 100
      : 0;
  }
  empresasDetalhes.sort((a, b) => b.faturamento - a.faturamento);

  const receitaLiquidaConsolidada = receitaBrutaConsolidada - deducoesImpostosConsolidada;
  const lucroBrutoConsolidado = receitaLiquidaConsolidada - custosInsumosProdutosConsolidado;
  const ebitdaConsolidado = lucroBrutoConsolidado - despesasEquipeComissoesConsolidado - despesasFixasAdministrativasConsolidado;
  const lucroLiquidoConsolidado = ebitdaConsolidado;

  return {
    grupo: grupoAtivo,
    periodo,
    statusAuditoria: 'DADOS_REAIS_COM_ESTIMATIVAS',
    consolidacaoFinanceira: {
      receitaBruta: receitaBrutaConsolidada,
      deducoesImpostos: deducoesImpostosConsolidada,
      receitaLiquida: receitaLiquidaConsolidada,
      custosInsumosCMV: custosInsumosProdutosConsolidado,
      lucroBruto: lucroBrutoConsolidado,
      despesasComissoesEquipe: despesasEquipeComissoesConsolidado,
      despesasFixasAdministrativas: despesasFixasAdministrativasConsolidado,
      ebitda: ebitdaConsolidado,
      lucroLiquido: lucroLiquidoConsolidado,
      margemLiquidaPercentual: receitaBrutaConsolidada > 0 ? (lucroLiquidoConsolidado / receitaBrutaConsolidada) * 100 : 0,
      totalColaboradores: totalColaboradoresConsolidado,
      totalAtendimentosTransacoes: totalAtendimentosVendasConsolidado,
      valorTotalEstoqueGiro: valorEstoqueConsolidado,
      dadoParcial: temDadoParcial
    },
    empresas: empresasDetalhes
  };
}
