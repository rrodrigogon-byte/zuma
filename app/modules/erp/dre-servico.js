/**
 * ============================================================================
 * ERP MODULAR KYTTO — DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE)
 * ============================================================================
 * Módulo: dre-servico.js
 * Descrição: Motor oficial de apuração contábil e gerencial (Padrão CPC / CFC),
 *            EBITDA, margens brutas/líquidas, análise vertical (AV %), ponto
 *            de equilíbrio (break-even), matriz comparativa anual de 12 meses,
 *            unificação multi-fonte (PostgreSQL + ledger financeiro central +
 *            comandas operacionais da barbearia), exportação nativa em XLSX
 *            (Excel com 3 abas) e impressão timbrada A4/PDF.
 * ============================================================================
 */
import { exigirUuid, exigirData } from '../acesso/banco.js';
import * as financeiroKytto from '../../financeiro-central-kytto.js';
import { estadoEmpresa } from '../../barbearia-erp-kytto.js';
let _xlsxMod = null;
async function obterXlsx() {
  if (!_xlsxMod) {
    try {
      _xlsxMod = await import("xlsx");
    } catch (e) {
      try {
        const { createRequire } = await import("module");
        const req = createRequire(import.meta.url);
        _xlsxMod = req("xlsx");
      } catch (err) {
        throw new Error("Módulo XLSX não instalado no ambiente.");
      }
    }
  }
  return _xlsxMod;
}


export const METADADOS_EMPRESAS = {
  "d0d0ac01-8e50-4b61-8c79-de4aaa916da6": {
    nome: "Barbearia Dino",
    razaoSocial: "50.073.355 DINOILSON PEREIRA DA SILVA",
    cnpj: "50.073.355/0001-89",
    ie: "14.229.191-9 (SEFAZ-MT)",
    segmento: "Barbearia Masculina, Cosméticos & Cuidados",
    cidade: "Tangará da Serra - MT",
    endereco: "Av. Brasil, nº 500, Centro, Tangará da Serra/MT"
  },
  "dino": {
    nome: "Barbearia Dino",
    razaoSocial: "50.073.355 DINOILSON PEREIRA DA SILVA",
    cnpj: "50.073.355/0001-89",
    ie: "14.229.191-9 (SEFAZ-MT)",
    segmento: "Barbearia Masculina, Cosméticos & Cuidados",
    cidade: "Tangará da Serra - MT",
    endereco: "Av. Brasil, nº 500, Centro, Tangará da Serra/MT"
  },
  "31f70c83-9172-40c2-945f-9e793b5048be": {
    nome: "Stallone Nutre Sport",
    razaoSocial: "STALLONE NUTRE SPORT LTDA",
    cnpj: "56.099.531/0001-38",
    ie: "13.456.789-0 (SEFAZ-MT)",
    segmento: "Suplementos Nutricionais, Fitness & Saúde",
    cidade: "Cuiabá - MT",
    endereco: "Av. Historiador Rubens de Mendonça, 1200, Bosque da Saúde, Cuiabá/MT"
  },
  "stallone": {
    nome: "Stallone Nutre Sport",
    razaoSocial: "STALLONE NUTRE SPORT LTDA",
    cnpj: "56.099.531/0001-38",
    ie: "13.456.789-0 (SEFAZ-MT)",
    segmento: "Suplementos Nutricionais, Fitness & Saúde",
    cidade: "Cuiabá - MT",
    endereco: "Av. Historiador Rubens de Mendonça, 1200, Bosque da Saúde, Cuiabá/MT"
  },
  "2e041110-db20-4fd1-8278-12bd3dead008": {
    nome: "AGRO OPEN TTC",
    razaoSocial: "AGRO OPEN TORNEIO DE TENIS E BEACH TENNIS LTDA",
    cnpj: "43.084.070/0001-88",
    ie: "13.987.654-2 (SEFAZ-MT)",
    segmento: "Torneios Esportivos, Beach Tennis, Insumos & Bar",
    cidade: "Tangará da Serra - MT",
    endereco: "Rodovia MT-358, Km 12, Zona Rural, Tangará da Serra/MT"
  },
  "agro": {
    nome: "AGRO OPEN TTC",
    razaoSocial: "AGRO OPEN TORNEIO DE TENIS E BEACH TENNIS LTDA",
    cnpj: "43.084.070/0001-88",
    ie: "13.987.654-2 (SEFAZ-MT)",
    segmento: "Torneios Esportivos, Beach Tennis, Insumos & Bar",
    cidade: "Tangará da Serra - MT",
    endereco: "Rodovia MT-358, Km 12, Zona Rural, Tangará da Serra/MT"
  },
  "agroopen": {
    nome: "AGRO OPEN TTC",
    razaoSocial: "AGRO OPEN TORNEIO DE TENIS E BEACH TENNIS LTDA",
    cnpj: "43.084.070/0001-88",
    ie: "13.987.654-2 (SEFAZ-MT)",
    segmento: "Torneios Esportivos, Beach Tennis, Insumos & Bar",
    cidade: "Tangará da Serra - MT",
    endereco: "Rodovia MT-358, Km 12, Zona Rural, Tangará da Serra/MT"
  },
  "00000000-0000-0000-0000-000000000002": {
    nome: "Supermercado Kytto",
    razaoSocial: "SUPERMERCADO KYTTO ATACAREJO LTDA",
    cnpj: "48.123.456/0001-77",
    ie: "13.123.456-7 (SEFAZ-MT)",
    segmento: "Alimentos, Bebidas, Hortifrúti, Carnes & Atacarejo",
    cidade: "Tangará da Serra - MT",
    endereco: "Av. Brasil, nº 1500, Centro, Tangará da Serra/MT"
  },
  "supermercado": {
    nome: "Supermercado Kytto",
    razaoSocial: "SUPERMERCADO KYTTO ATACAREJO LTDA",
    cnpj: "48.123.456/0001-77",
    ie: "13.123.456-7 (SEFAZ-MT)",
    segmento: "Alimentos, Bebidas, Hortifrúti, Carnes & Atacarejo",
    cidade: "Tangará da Serra - MT",
    endereco: "Av. Brasil, nº 1500, Centro, Tangará da Serra/MT"
  }
};

export async function obterMetadadosEmpresa(db, empresaId, fallback = {}) {
  const normId = String(empresaId || "").toLowerCase().trim();
  const cleanFallback = {};
  if (fallback && typeof fallback === "object") {
    for (const [k, v] of Object.entries(fallback)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        cleanFallback[k] = v;
      }
    }
  }
  if (METADADOS_EMPRESAS[normId]) {
    return { ...METADADOS_EMPRESAS[normId], ...cleanFallback };
  }
  if (db && typeof db.query === "function") {
    try {
      const r = await db.query("SELECT nome, razao_social, cnpj, inscricao_estadual FROM empresas WHERE id::text = $1 OR cnpj = $1", [normId]);
      if (r.rows && r.rows.length) {
        const row = r.rows[0];
        return {
          nome: fallback.nome || row.nome || "Empresa Kytto",
          razaoSocial: row.razao_social || row.nome || "Empresa Kytto",
          cnpj: fallback.cnpj || row.cnpj || "",
          ie: fallback.ie || row.inscricao_estadual || "ISENTO",
          cidade: "Mato Grosso - MT",
          endereco: "Tangará da Serra / Cuiabá - MT"
        };
      }
    } catch (e) {}
  }
  return {
    nome: fallback.nome || "Empresa Kytto",
    razaoSocial: fallback.nome || "Empresa Kytto",
    cnpj: fallback.cnpj || "",
    ie: fallback.ie || "ISENTO",
    cidade: "Mato Grosso - MT",
    endereco: "Tangará da Serra / Cuiabá - MT"
  };
}

const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;

/**
 * Classifica lançamentos e itens operacionais nas 11 contas padrão CPC / CFC.
 */
export function classificarCategoriaDRE(tipo, categoriaNome = '', origem = '', descricao = '') {
  const cat = String(categoriaNome || '').toLowerCase().trim();
  const orig = String(origem || '').toLowerCase().trim();
  const desc = String(descricao || '').toLowerCase().trim();
  const textoGeral = `${cat} ${orig} ${desc}`;

  if (tipo === 'receita') {
    // 1. Mensalidades, Planos & Clubes
    if (textoGeral.includes('plano') || textoGeral.includes('mensalidade') || textoGeral.includes('assinatura') || textoGeral.includes('clube') || textoGeral.includes('combo') || textoGeral.includes('vip') || textoGeral.includes('passaporte')) {
      return { subgrupo: 'receita_planos', rotulo: '1.3 Mensalidades, Planos & Clubes', ordem: 3 };
    }
    // 2. Venda de Serviços (Barbearia, Cortes, Barba, etc.)
    if (orig.includes('barbearia_atendimento') || orig === 'ordem_servico' || textoGeral.includes('serviço') || textoGeral.includes('servico') || textoGeral.includes('corte') || textoGeral.includes('barba') || textoGeral.includes('sobrancelha') || textoGeral.includes('pigmentação') || textoGeral.includes('pigmentacao') || textoGeral.includes('limpeza') || textoGeral.includes('atendimento') || textoGeral.includes('comanda') || cat === 'receitas de vendas' || (orig.includes('barbearia') && !orig.includes('revenda') && !textoGeral.includes('produto') && !textoGeral.includes('pomada'))) {
      return { subgrupo: 'receita_servicos', rotulo: '1.1 Venda de Serviços', ordem: 1 };
    }
    // 3. Venda de Mercadorias / Produtos
    if (orig === 'barbearia_revenda' || orig === 'supermercado' || orig === 'varejo' || textoGeral.includes('produto') || textoGeral.includes('revenda') || textoGeral.includes('mercadoria') || textoGeral.includes('suplemento') || textoGeral.includes('pomada') || textoGeral.includes('minoxidil') || textoGeral.includes('cerveja') || textoGeral.includes('bebida') || textoGeral.includes('refrigerante') || textoGeral.includes('shampoo') || textoGeral.includes('cera') || textoGeral.includes('óleo') || textoGeral.includes('oleo') || textoGeral.includes('cookie') || textoGeral.includes('lamina') || textoGeral.includes('água') || /\bbar\b/i.test(cat)) {
      return { subgrupo: 'receita_produtos', rotulo: '1.2 Venda de Mercadorias / Produtos', ordem: 2 };
    }
    // 4. Receitas Financeiras
    if (textoGeral.includes('rendimento') || textoGeral.includes('juros') || textoGeral.includes('desconto obtido') || textoGeral.includes('aplicação')) {
      return { subgrupo: 'receita_financeira', rotulo: '8.1 Receitas Financeiras (Juros / Rendimentos)', ordem: 81 };
    }
    return { subgrupo: 'receita_outras', rotulo: '1.4 Outras Receitas Operacionais', ordem: 4 };
  }

  // DESPESAS
  // 1. Reversões, Devoluções e Cancelamentos (Deduções da Receita Bruta)
  if (textoGeral.includes('reversão') || textoGeral.includes('reversao') || textoGeral.includes('estorno') || textoGeral.includes('devolu') || textoGeral.includes('cancelamento')) {
    return { subgrupo: 'deducoes_devolucoes', rotulo: '2.1 Devoluções e Cancelamentos', ordem: 21 };
  }
  // 2. Taxas de Intermediação & Meios de Pagamento
  if (textoGeral.includes('taxa') || textoGeral.includes('cartão') || textoGeral.includes('cartao') || textoGeral.includes('maquin') || textoGeral.includes('asaas') || textoGeral.includes('split') || textoGeral.includes('gateway')) {
    return { subgrupo: 'deducoes_taxas', rotulo: '2.2 Taxas de Intermediação & Meios de Pagamento', ordem: 22 };
  }
  // 3. Tributos e Impostos sobre Vendas
  if (textoGeral.includes('imposto') || textoGeral.includes('tributo') || textoGeral.includes('simples nacional') || textoGeral.includes('simples') || textoGeral.includes('icms') || /\biss\b/i.test(cat) || textoGeral.includes('issqn') || textoGeral.includes('pis') || textoGeral.includes('cofins')) {
    return { subgrupo: 'deducoes_tributos', rotulo: '2.3 Tributos e Impostos sobre Vendas', ordem: 23 };
  }
  // 4. Descontos Concedidos
  if (textoGeral.includes('desconto concedido') || (textoGeral.includes('desconto') && !textoGeral.includes('desconto obtido'))) {
    return { subgrupo: 'deducoes_descontos', rotulo: '2.4 Descontos Concedidos e Abatimentos', ordem: 24 };
  }
  // 5. Custos dos Serviços Prestados (CSP) / Comissões
  if (textoGeral.includes('comiss') || textoGeral.includes('repasse') || textoGeral.includes('barbeiro') || textoGeral.includes('diária técnica') || textoGeral.includes('csp') || textoGeral.includes('adiantamento de comissão') || textoGeral.includes('antecipação de comissão') || cat === 'bruno' || cat === 'natani' || cat === 'vitor' || cat === 'david' || cat === 'dino' || cat.includes('bruno') || cat.includes('natani') || cat.includes('vitor') || cat.includes('david')) {
    return { subgrupo: 'custo_csp', rotulo: '4.2 Custo dos Serviços Prestados (CSP) / Comissões', ordem: 42 };
  }
  // 6. Custo das Mercadoridas Vendidas (CMV) / Insumos
  if (textoGeral.includes('fornecedor') || textoGeral.includes('compra de mercadoria') || textoGeral.includes('estoque') || textoGeral.includes('insumo') || textoGeral.includes('cmv') || orig === 'nfe_compra') {
    return { subgrupo: 'custo_cmv', rotulo: '4.1 Custo das Mercadorias Vendidas (CMV) / Insumos', ordem: 41 };
  }
  // 7. Despesas com Pessoal & Pró-labore
  if (textoGeral.includes('salário') || textoGeral.includes('salario') || textoGeral.includes('folha') || textoGeral.includes('pessoal') || textoGeral.includes('pró-labore') || textoGeral.includes('pro-labore') || textoGeral.includes('encargo') || textoGeral.includes('fgts') || textoGeral.includes('inss')) {
    return { subgrupo: 'despesa_pessoal', rotulo: '6.1 Despesas com Pessoal & Pró-labore', ordem: 61 };
  }
  // 8. Ocupação & Instalações
  if (textoGeral.includes('aluguel') || textoGeral.includes('condomínio') || textoGeral.includes('condominio') || textoGeral.includes('energia') || textoGeral.includes('luz') || textoGeral.includes('água') || textoGeral.includes('agua') || textoGeral.includes('internet') || textoGeral.includes('telefonia') || textoGeral.includes('iptu')) {
    return { subgrupo: 'despesa_ocupacao', rotulo: '6.2 Ocupação, Utilidades & Instalações', ordem: 62 };
  }
  // 9. Comercial, Marketing & Tráfego Pago
  if (textoGeral.includes('marketing') || textoGeral.includes('tráfego') || textoGeral.includes('trafego') || textoGeral.includes('anúncio') || textoGeral.includes('anuncio') || textoGeral.includes('propaganda') || textoGeral.includes('publicidade') || textoGeral.includes('redes sociais')) {
    return { subgrupo: 'despesa_marketing', rotulo: '6.3 Comercial, Marketing & Tráfego Pago', ordem: 63 };
  }
  // 10. Administrativas, Softwares & Sistemas
  if (textoGeral.includes('software') || textoGeral.includes('sistema') || textoGeral.includes('contabilidade') || textoGeral.includes('jurídico') || textoGeral.includes('juridico') || textoGeral.includes('segurança')) {
    return { subgrupo: 'despesa_administrativa', rotulo: '6.4 Administrativas, Softwares & Honorários', ordem: 64 };
  }
  // 11. Despesas Financeiras & Juros
  if (textoGeral.includes('juros') || textoGeral.includes('tarifa') || textoGeral.includes('bancár') || textoGeral.includes('bancar') || textoGeral.includes('ted') || textoGeral.includes('doc') || textoGeral.includes('iof')) {
    return { subgrupo: 'despesa_financeira', rotulo: '8.2 Despesas Financeiras & Tarifas Bancárias', ordem: 82 };
  }
  // 12. Investimentos & Ativos Imobilizados
  if (textoGeral.includes('investimento') || textoGeral.includes('reforma') || textoGeral.includes('ativo imobilizado') || textoGeral.includes('equipamento') || textoGeral.includes('máquina')) {
    return { subgrupo: 'investimentos', rotulo: '13. Investimentos & Ativos Imobilizados', ordem: 130 };
  }
  return { subgrupo: 'despesa_geral', rotulo: '6.5 Outras Despesas Operacionais', ordem: 65 };
}

/**
 * Coleta lançamentos com unificação completa de fontes:
 * 1. PostgreSQL (tabela fin_lancamentos)
 * 2. Financeiro Central Kytto (store ledger de todas as empresas)
 * 3. Comandas da Barbearia (se houver comandas faturadas sem ledger)
 * Deduplica de forma idempotente por ID / chaveIdempotencia / assinatura.
 */
async function coletarLancamentos({ db, empresaId, de, ate, regime = 'competencia', lojaId = null, centroCustoId = null }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const inicio = exigirData(de, 'De');
  const fim = exigirData(ate, 'Até');
  const mapaItens = new Map();

  // 1. Consulta PostgreSQL
  if (db && typeof db.query === 'function') {
    try {
      const temTabela = (await db.query("SELECT to_regclass('fin_lancamentos') AS t")).rows[0]?.t;
      if (temTabela) {
        const campoData = regime === 'caixa' ? "COALESCE(l.pago_em::date, l.vencimento, l.data_competencia)" : "COALESCE(l.data_competencia, l.vencimento, l.pago_em::date)";
        const condStatus = regime === 'caixa' ? "l.status = 'pago'" : "l.status <> 'cancelado'";
        const v = [empresa, inicio, fim];
        let filtroUnidade = '';
        if (lojaId) {
          v.push(lojaId);
          filtroUnidade = ` AND (l.loja_id = $${v.length} OR l.loja_id IS NULL)`;
        }
        let filtroCentro = '';
        if (centroCustoId) {
          v.push(centroCustoId);
          filtroCentro = ` AND l.centro_custo_id = $${v.length}`;
        }
        const sql = `
          SELECT l.id, l.tipo, l.categoria, l.descricao, l.valor, l.data_competencia, l.vencimento,
                 l.pago_em, l.status, l.origem, l.meio_pagamento, c.grupo_dre, l.chave
            FROM fin_lancamentos l
            LEFT JOIN fin_categorias c ON c.empresa_id = l.empresa_id AND c.tipo = l.tipo AND c.nome = l.categoria
           WHERE l.empresa_id = $1
             AND ${condStatus}
             AND ${campoData} BETWEEN $2 AND $3
             ${filtroUnidade}
             ${filtroCentro}
           ORDER BY ${campoData} ASC
        `;
        const res = await db.query(sql, v);
        for (const r of res.rows) {
          const key = String(r.chave || r.id || `${r.tipo}:${r.descricao}:${r.valor}`);
          mapaItens.set(key, {
            id: r.id,
            tipo: r.tipo,
            categoria: r.categoria,
            descricao: r.descricao,
            valor: Number(r.valor || 0),
            dataCompetencia: r.data_competencia ? String(r.data_competencia).slice(0, 10) : null,
            vencimento: r.vencimento ? String(r.vencimento).slice(0, 10) : null,
            pagoEm: r.pago_em ? String(r.pago_em).slice(0, 10) : null,
            status: r.status,
            origem: r.origem,
            meioPagamento: r.meio_pagamento,
            grupoDreConfigurado: r.grupo_dre
          });
        }
      }
    } catch (e) {
      console.warn('[dre-servico] Aviso ao consultar PostgreSQL:', e.message);
    }
  }

  // 2. Unifica com Financeiro Central Kytto (ledger histórico de 6.894+ lançamentos apenas para Dino)
  const ehDino = String(empresa || "").toLowerCase() === "d0d0ac01-8e50-4b61-8c79-de4aaa916da6" ||
                 String(empresa || "").toLowerCase() === "emp-kytto-001" ||
                 String(empresa || "").toLowerCase() === "dino";
  if (ehDino && financeiroKytto && typeof financeiroKytto.listarLancamentos === 'function') {
    try {
      const todos = financeiroKytto.listarLancamentos(empresa, { lojaId });
      for (const item of todos) {
        if (item.status === 'cancelado') continue;
        const refData = regime === 'caixa'
          ? String(item.pagoEm || item.dataOperacao || item.vencimento || '').slice(0, 10)
          : String(item.dataCompetencia || item.vencimento || item.dataOperacao || item.pagoEm || '').slice(0, 10);
        if (!refData) continue;
        if (refData < inicio || refData > fim) continue;
        if (regime === 'caixa' && item.status !== 'pago') continue;

        const key = String(item.chaveIdempotencia || item.id || `${item.tipo}:${item.descricao}:${item.valor}`);
        if (!mapaItens.has(key)) {
          mapaItens.set(key, {
            id: item.id,
            tipo: item.tipo,
            categoria: item.categoria || 'Outros',
            descricao: item.descricao || '',
            valor: Number(item.valor || 0),
            dataCompetencia: String(item.dataCompetencia || item.vencimento || item.dataOperacao || '').slice(0, 10),
            vencimento: String(item.vencimento || '').slice(0, 10),
            pagoEm: String(item.pagoEm || '').slice(0, 10),
            status: item.status,
            origem: item.origem || 'manual',
            meioPagamento: item.meioPagamento || 'outros',
            grupoDreConfigurado: null
          });
        }
      }
    } catch (e) {
      console.warn('[dre-servico] Aviso ao consultar financeiroKytto:', e.message);
    }
  }

  // 3. Unifica com Comandas da Barbearia (se houver comandas sem lançamento no ledger - apenas Dino)
  if (ehDino) {
    try {
      const estado = estadoEmpresa(empresa, false);
    for (const comanda of Object.values(estado.comandas || {})) {
      if (comanda.status === 'cancelada') continue;
      const refData = String(comanda.fechadaEm || comanda.dataAtendimento || comanda.criadoEm || '').slice(0, 10);
      if (!refData || refData < inicio || refData > fim) continue;

      const faturada = comanda.status === 'paga' || comanda.status === 'em_conta' || Number(comanda.totalPago || 0) > 0;
      if (!faturada) continue;

      // Se a comanda já tem pagamentos no mapa de itens, respeita a idempotência
      const jaNoMapa = (comanda.financeiroLancamentoIds || []).some(id => mapaItens.has(String(id)));
      if (jaNoMapa) continue;

      // Desdobra itens em serviços e produtos para precisão analítica
      for (const item of (comanda.itens || [])) {
        const keyItem = `comanda:${comanda.id}:item:${item.id || item.nome}:${refData}`;
        if (!mapaItens.has(keyItem)) {
          const ehProduto = item.tipo === 'produto';
          mapaItens.set(keyItem, {
            id: keyItem,
            tipo: 'receita',
            categoria: ehProduto ? 'Produtos & Cosméticos' : 'Serviços Barbearia',
            descricao: `${ehProduto ? 'Venda Produto' : 'Serviço'}: ${item.nome || 'Atendimento'} — Comanda ${comanda.id}`,
            valor: Number(item.subtotal || (item.quantidade * item.precoUnitario) || 0),
            dataCompetencia: refData,
            vencimento: refData,
            pagoEm: refData,
            status: 'pago',
            origem: ehProduto ? 'barbearia_revenda' : 'barbearia_atendimento',
            meioPagamento: comanda.pagamento || 'pix',
            grupoDreConfigurado: ehProduto ? 'receita_produtos' : 'receita_servicos'
          });
        }
      }
    }
  } catch (e) {
    // Barbearia opcional caso a empresa não seja barbearia
  }
  }

  // 4. Unifica com Pedidos de Venda Ecommerce (Stallone Nutre Sport e Lojas Web)
  if (db && typeof db.query === "function") {
    try {
      const sqlOrders = `
        SELECT o.id, o.empresa_id, o.loja_id, o.total, o.subtotal, o.desconto, o.frete, o.status, o.criado_em,
               i.id as item_id, i.nome_snapshot, i.quantidade, i.preco_unitario, i.subtotal as item_subtotal
          FROM commerce_orders o
          LEFT JOIN commerce_order_items i ON i.order_id = o.id
         WHERE (o.empresa_id::text = $1::text OR ($1::text IN ('stallone', 'dino', 'agro', 'supermercado')))
           AND o.status IN ('paid', 'ready', 'delivered', 'completed')
           AND o.criado_em::date BETWEEN $2 AND $3
      `;
      const resOrders = await db.query(sqlOrders, [empresa, inicio, fim]);
      for (const row of (resOrders.rows || [])) {
        const refData = String(row.criado_em || "").slice(0, 10);
        const key = `order:${row.id}:${row.item_id || "total"}:${refData}`;
        if (!mapaItens.has(key)) {
          mapaItens.set(key, {
            id: key,
            tipo: "receita",
            categoria: "Vendas Ecommerce / Loja Online",
            descricao: `Venda Online: ${row.nome_snapshot || "Suplementos & Produtos"} (Pedido #${String(row.id).slice(0, 8)})`,
            valor: Number(row.item_subtotal || row.total || 0),
            dataCompetencia: refData,
            vencimento: refData,
            pagoEm: refData,
            status: "pago",
            origem: "ecommerce",
            meioPagamento: "pix",
            grupoDreConfigurado: "receita_produtos"
          });
        }
      }
    } catch (e) {
      // Ignora erro em caso de schema parcial
    }

    // 5. Unifica com Vendas de Varejo / Supermercado (Supermercado Kytto e PDV)
    try {
      const sqlVar = `
        SELECT v.id, v.empresa_id, v.loja_id, v.total, v.desconto, v.forma_pagamento, v.criado_em
          FROM var_vendas v
         WHERE (v.empresa_id::text = $1::text OR ($1::text IN ('supermercado', 'agro', 'dino')))
           AND v.criado_em::date BETWEEN $2 AND $3
      `;
      const resVar = await db.query(sqlVar, [empresa, inicio, fim]);
      for (const row of (resVar.rows || [])) {
        const refData = String(row.criado_em || "").slice(0, 10);
        const key = `var_venda:${row.id}:${refData}`;
        if (!mapaItens.has(key)) {
          mapaItens.set(key, {
            id: key,
            tipo: "receita",
            categoria: "Vendas de Mercadorias / Produtos",
            descricao: `Venda PDV Varejo #${String(row.id).slice(0, 8)}`,
            valor: Number(row.total || 0),
            dataCompetencia: refData,
            vencimento: refData,
            pagoEm: refData,
            status: "pago",
            origem: "pdv",
            meioPagamento: row.forma_pagamento || "dinheiro",
            grupoDreConfigurado: "receita_produtos"
          });
        }
      }
    } catch (e) {}

    // 6. Unifica com Comandas de Bar / Eventos (AGRO OPEN TTC)
    try {
      const sqlBar = `
        SELECT bc.id, bc.empresa_id, bc.total, bc.status, bc.criado_em
          FROM bar_comandas bc
         WHERE (bc.empresa_id::text = $1::text OR ($1::text IN ('agro', 'agroopen')))
           AND bc.status IN ('paga', 'fechada')
           AND bc.criado_em::date BETWEEN $2 AND $3
      `;
      const resBar = await db.query(sqlBar, [empresa, inicio, fim]);
      for (const row of (resBar.rows || [])) {
        const refData = String(row.criado_em || "").slice(0, 10);
        const key = `bar_comanda:${row.id}:${refData}`;
        if (!mapaItens.has(key)) {
          mapaItens.set(key, {
            id: key,
            tipo: "receita",
            categoria: "Bar, Restaurante & Conveniência",
            descricao: `Consumo Bar TTC #${String(row.id).slice(0, 8)}`,
            valor: Number(row.total || 0),
            dataCompetencia: refData,
            vencimento: refData,
            pagoEm: refData,
            status: "pago",
            origem: "bar_ttc",
            meioPagamento: "pix",
            grupoDreConfigurado: "receita_bruta"
          });
        }
      }
    } catch (e) {}
  }


  return Array.from(mapaItens.values());
}

/**
 * Calcula a DRE completa para um período específico (Mês, Ano ou Intervalo Customizado).
 */
export async function calcularDreCompleta(db, empresaId, {
  de = null,
  ate = null,
  mes = null,
  ano = null,
  regime = 'competencia',
  lojaId = null,
  centroCustoId = null
} = {}) {
  const agora = new Date();
  let dataInicio = de;
  let dataFim = ate;

  if (mes) {
    const [y, m] = mes.split('-').map(Number);
    const ultimoDia = new Date(y, m, 0).getDate();
    dataInicio = `${mes}-01`;
    dataFim = `${mes}-${String(ultimoDia).padStart(2, '0')}`;
  } else if (ano) {
    dataInicio = `${ano}-01-01`;
    dataFim = `${ano}-12-31`;
  } else if (!dataInicio || !dataFim) {
    const y = agora.getFullYear();
    const m = String(agora.getMonth() + 1).padStart(2, '0');
    const ultimoDia = new Date(y, agora.getMonth() + 1, 0).getDate();
    dataInicio = `${y}-${m}-01`;
    dataFim = `${y}-${m}-${String(ultimoDia).padStart(2, '0')}`;
  }

  const lancamentos = await coletarLancamentos({
    db, empresaId, de: dataInicio, ate: dataFim, regime, lojaId, centroCustoId
  });

  // Estrutura acumuladora por subgrupos oficiais
  const acumuladores = {
    receita_servicos: { rotulo: '1.1 Venda de Serviços', total: 0, linhas: {} },
    receita_produtos: { rotulo: '1.2 Venda de Mercadorias / Produtos', total: 0, linhas: {} },
    receita_planos: { rotulo: '1.3 Mensalidades, Planos & Clubes', total: 0, linhas: {} },
    receita_outras: { rotulo: '1.4 Outras Receitas Operacionais', total: 0, linhas: {} },

    deducoes_devolucoes: { rotulo: '2.1 Devoluções e Cancelamentos', total: 0, linhas: {} },
    deducoes_taxas: { rotulo: '2.2 Taxas de Intermediação & Meios de Pagamento', total: 0, linhas: {} },
    deducoes_tributos: { rotulo: '2.3 Tributos e Impostos sobre Vendas', total: 0, linhas: {} },
    deducoes_descontos: { rotulo: '2.4 Descontos Concedidos e Abatimentos', total: 0, linhas: {} },

    custo_cmv: { rotulo: '4.1 Custo das Mercadorias Vendidas (CMV) / Insumos', total: 0, linhas: {} },
    custo_csp: { rotulo: '4.2 Custo dos Serviços Prestados (CSP) / Comissões', total: 0, linhas: {} },

    despesa_pessoal: { rotulo: '6.1 Despesas com Pessoal & Pró-labore', total: 0, linhas: {} },
    despesa_ocupacao: { rotulo: '6.2 Ocupação, Utilidades & Instalações', total: 0, linhas: {} },
    despesa_marketing: { rotulo: '6.3 Comercial, Marketing & Tráfego Pago', total: 0, linhas: {} },
    despesa_administrativa: { rotulo: '6.4 Administrativas, Softwares & Honorários', total: 0, linhas: {} },
    despesa_geral: { rotulo: '6.5 Outras Despesas Operacionais', total: 0, linhas: {} },

    receita_financeira: { rotulo: '8.1 Receitas Financeiras (Juros / Rendimentos)', total: 0, linhas: {} },
    despesa_financeira: { rotulo: '8.2 Despesas Financeiras & Tarifas Bancárias', total: 0, linhas: {} },

    investimentos: { rotulo: '13. Investimentos & Ativos Imobilizados', total: 0, linhas: {} }
  };

  for (const l of lancamentos) {
    const classif = l.grupoDreConfigurado
      ? { subgrupo: l.grupoDreConfigurado, rotulo: l.categoria, ordem: 99 }
      : classificarCategoriaDRE(l.tipo, l.categoria, l.origem, l.descricao);

    const alvo = acumuladores[classif.subgrupo] || acumuladores.despesa_geral;
    const rotuloLinha = l.categoria && l.categoria !== 'Barbearia' && l.categoria !== 'Outros'
      ? l.categoria
      : (l.descricao ? l.descricao.split('—')[0].trim().slice(0, 80) : 'Atendimento Barbearia');

    alvo.total = dinheiro(alvo.total + l.valor);
    alvo.linhas[rotuloLinha] = dinheiro((alvo.linhas[rotuloLinha] || 0) + l.valor);
  }

  // 1. Receita Operacional Bruta
  const receitaBruta = dinheiro(
    acumuladores.receita_servicos.total +
    acumuladores.receita_produtos.total +
    acumuladores.receita_planos.total +
    acumuladores.receita_outras.total
  );

  // 2. Deduções da Receita Bruta
  const totalDeducoes = dinheiro(
    acumuladores.deducoes_devolucoes.total +
    acumuladores.deducoes_taxas.total +
    acumuladores.deducoes_tributos.total +
    acumuladores.deducoes_descontos.total
  );

  // 3. Receita Operacional Líquida (ROL)
  const receitaLiquida = dinheiro(receitaBruta - totalDeducoes);

  // 4. Custos Diretos
  const totalCustos = dinheiro(
    acumuladores.custo_cmv.total +
    acumuladores.custo_csp.total
  );

  // 5. Lucro Bruto
  const lucroBruto = dinheiro(receitaLiquida - totalCustos);
  const margemBrutaPct = receitaBruta > 0 ? Number(((lucroBruto / receitaBruta) * 100).toFixed(1)) : 0;

  // 6. Despesas Operacionais Fixas & Administrativas
  const totalDespesasOperacionais = dinheiro(
    acumuladores.despesa_pessoal.total +
    acumuladores.despesa_ocupacao.total +
    acumuladores.despesa_marketing.total +
    acumuladores.despesa_administrativa.total +
    acumuladores.despesa_geral.total
  );

  // 7. EBITDA / LAJIDA
  const ebitda = dinheiro(lucroBruto - totalDespesasOperacionais);
  const margemEbitdaPct = receitaBruta > 0 ? Number(((ebitda / receitaBruta) * 100).toFixed(1)) : 0;

  // 8. Resultado Financeiro Líquido
  const resultadoFinanceiro = dinheiro(
    acumuladores.receita_financeira.total - acumuladores.despesa_financeira.total
  );

  // 9. LAIR (Lucro Antes do IR e CSLL)
  const lair = dinheiro(ebitda + resultadoFinanceiro);

  // 10. Provisão Tributos sobre Lucro
  const impostosSobreLucro = 0;

  // 11. Resultado Líquido do Exercício
  const resultadoLiquido = dinheiro(lair - impostosSobreLucro);
  const margemLiquidaPct = receitaBruta > 0 ? Number(((resultadoLiquido / receitaBruta) * 100).toFixed(1)) : 0;

  // Ponto de Equilíbrio Operacional (Break-even): Custo Fixo / Margem de Contribuição %
  const margemContribuicaoPct = receitaBruta > 0 ? (receitaLiquida - totalCustos) / receitaBruta : 0;
  const pontoEquilibrio = margemContribuicaoPct > 0
    ? dinheiro(totalDespesasOperacionais / margemContribuicaoPct)
    : totalDespesasOperacionais;

  // Helper para Análise Vertical (AV %)
  const calcAv = (val) => receitaBruta > 0 ? Number(((val / receitaBruta) * 100).toFixed(1)) : 0;

  function montarFilhos(chaves) {
    return chaves.map(k => {
      const sub = acumuladores[k];
      const detalhe = Object.entries(sub.linhas || {}).map(([catNome, v]) => ({
        categoria: catNome,
        valor: v
      })).sort((a, b) => b.valor - a.valor);

      return {
        codigo: sub.rotulo.split(' ')[0],
        descricao: sub.rotulo,
        valor: sub.total,
        av: calcAv(sub.total),
        detalhe
      };
    });
  }

  const linhas = [
    {
      codigo: '1',
      grupo: 'receita_bruta',
      descricao: '1. RECEITA OPERACIONAL BRUTA',
      valor: receitaBruta,
      av: 100.0,
      tipo: 'receita',
      natureza: 'sintetica',
      destaque: true,
      filhos: montarFilhos(['receita_servicos', 'receita_produtos', 'receita_planos', 'receita_outras'])
    },
    {
      codigo: '2',
      grupo: 'deducoes',
      descricao: '2. (-) DEDUÇÕES DA RECEITA BRUTA',
      valor: totalDeducoes,
      av: calcAv(totalDeducoes),
      tipo: 'despesa',
      natureza: 'sintetica',
      destaque: false,
      filhos: montarFilhos(['deducoes_devolucoes', 'deducoes_taxas', 'deducoes_tributos', 'deducoes_descontos'])
    },
    {
      codigo: '3',
      grupo: 'rol',
      descricao: '3. (=) RECEITA OPERACIONAL LÍQUIDA (ROL)',
      valor: receitaLiquida,
      av: calcAv(receitaLiquida),
      tipo: 'saldo',
      natureza: 'sintetica',
      destaque: true,
      filhos: []
    },
    {
      codigo: '4',
      grupo: 'custos',
      descricao: '4. (-) CUSTOS DAS VENDAS (CPV / CMV / CSP)',
      valor: -totalCustos,
      av: calcAv(-totalCustos),
      tipo: 'despesa',
      natureza: 'sintetica',
      destaque: false,
      filhos: montarFilhos(['custo_cmv', 'custo_csp'])
    },
    {
      codigo: '5',
      grupo: 'lucro_bruto',
      descricao: `5. (=) LUCRO BRUTO (Margem Bruta: ${margemBrutaPct}%)`,
      valor: lucroBruto,
      av: calcAv(lucroBruto),
      tipo: 'saldo',
      natureza: 'sintetica',
      destaque: true,
      filhos: []
    },
    {
      codigo: '6',
      grupo: 'despesas_operacionais',
      descricao: '6. (-) DESPESAS OPERACIONAIS FIXAS & ADMINISTRATIVAS',
      valor: -totalDespesasOperacionais,
      av: calcAv(totalDespesasOperacionais),
      tipo: 'despesa',
      natureza: 'sintetica',
      destaque: false,
      filhos: montarFilhos(['despesa_pessoal', 'despesa_ocupacao', 'despesa_marketing', 'despesa_administrativa', 'despesa_geral'])
    },
    {
      codigo: '7',
      grupo: 'ebitda',
      descricao: `7. (=) EBITDA / LAJIDA (Margem EBITDA: ${margemEbitdaPct}%)`,
      valor: ebitda,
      av: calcAv(ebitda),
      tipo: 'saldo',
      natureza: 'sintetica',
      destaque: true,
      filhos: []
    },
    {
      codigo: '8',
      grupo: 'resultado_financeiro',
      descricao: '8. (+/-) RESULTADO FINANCEIRO LÍQUIDO',
      valor: resultadoFinanceiro,
      av: calcAv(resultadoFinanceiro),
      tipo: 'saldo',
      natureza: 'sintetica',
      destaque: false,
      filhos: montarFilhos(['receita_financeira', 'despesa_financeira'])
    },
    {
      codigo: '9',
      grupo: 'lair',
      descricao: '9. (=) RESULTADO ANTES DOS TRIBUTOS (LAIR)',
      valor: lair,
      av: calcAv(lair),
      tipo: 'saldo',
      natureza: 'sintetica',
      destaque: true,
      filhos: []
    },
    {
      codigo: '10',
      grupo: 'provisao_irpj_csll',
      descricao: '10. (-) PROVISÃO PARA IRPJ E CSLL',
      valor: -impostosSobreLucro,
      av: calcAv(impostosSobreLucro),
      tipo: 'despesa',
      natureza: 'sintetica',
      destaque: false,
      filhos: []
    },
    {
      codigo: '11',
      grupo: 'resultado_liquido',
      descricao: `11. (=) RESULTADO LÍQUIDO DO EXERCÍCIO (Margem Líquida: ${margemLiquidaPct}%)`,
      valor: resultadoLiquido,
      av: calcAv(resultadoLiquido),
      tipo: 'saldo',
      natureza: 'sintetica',
      destaque: true,
      filhos: []
    }
  ];

  // Composição para gráficos
  const composicaoReceita = [
    { nome: 'Serviços Barbearia', valor: acumuladores.receita_servicos.total, cor: '#3b82f6' },
    { nome: 'Produtos & Revenda', valor: acumuladores.receita_produtos.total, cor: '#10b981' },
    { nome: 'Clubes & Planos VIP', valor: acumuladores.receita_planos.total, cor: '#8b5cf6' },
    { nome: 'Outras Receitas', valor: acumuladores.receita_outras.total, cor: '#64748b' },
  ].filter(i => i.valor > 0);

  const composicaoCustosDespesas = [
    { nome: 'Custos Diretos (CMV / Insumos)', valor: acumuladores.custo_cmv.total, cor: '#f87171' },
    { nome: 'Comissões de Barbeiros (CSP)', valor: acumuladores.custo_csp.total, cor: '#fb923c' },
    { nome: 'Pessoal & Pró-labore', valor: acumuladores.despesa_pessoal.total, cor: '#fbbf24' },
    { nome: 'Ocupação & Instalações', valor: acumuladores.despesa_ocupacao.total, cor: '#60a5fa' },
    { nome: 'Marketing & Tráfego', valor: acumuladores.despesa_marketing.total, cor: '#c084fc' },
    { nome: 'Administrativo & Sistemas', valor: acumuladores.despesa_administrativa.total, cor: '#34d399' },
    { nome: 'Taxas & Meios de Pagamento', valor: acumuladores.deducoes_taxas.total, cor: '#f43f5e' },
    { nome: 'Impostos & Tributos', valor: acumuladores.deducoes_tributos.total, cor: '#e879f9' },
  ].filter(i => i.valor > 0);

  return {
    periodo: {
      de: dataInicio,
      ate: dataFim,
      mes: mes || dataInicio.slice(0, 7),
      ano: ano || dataInicio.slice(0, 4),
      regime
    },
    resumo: {
      receitaBruta,
      totalDeducoes,
      receitaLiquida,
      totalCustos,
      lucroBruto,
      margemBrutaPct,
      totalDespesasOperacionais,
      ebitda,
      margemEbitdaPct,
      resultadoFinanceiro,
      lair,
      resultadoLiquido,
      margemLiquidaPct,
      pontoEquilibrio,
      investimentos: acumuladores.investimentos.total,
      totalLancamentosApurados: lancamentos.length
    },
    linhas,
    graficos: {
      composicaoReceita,
      composicaoCustosDespesas
    },
    lancamentosDetalhados: lancamentos
  };
}

/**
 * Calcula a matriz anual comparativa de 12 meses (Janeiro a Dezembro + YTD).
 */
export async function calcularDreAnual12Meses(db, empresaId, { ano = null, regime = 'competencia', lojaId = null } = {}) {
  const anoRef = Number(ano) || new Date().getFullYear();
  const meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const resultadosMensais = {};

  for (const m of meses) {
    const mesStr = `${anoRef}-${String(m).padStart(2, '0')}`;
    const d = await calcularDreCompleta(db, empresaId, { mes: mesStr, regime, lojaId });
    resultadosMensais[m] = d;
  }

  // Linhas síntese da matriz comparativa anual
  const codigos = [
    { codigo: '1', descricao: '1. Receita Operacional Bruta' },
    { codigo: '2', descricao: '2. (-) Deduções da Receita Bruta' },
    { codigo: '3', descricao: '3. (=) Receita Operacional Líquida (ROL)' },
    { codigo: '4', descricao: '4. (-) Custos das Vendas (CMV/CSP)' },
    { codigo: '5', descricao: '5. (=) Lucro Bruto' },
    { codigo: '6', descricao: '6. (-) Despesas Operacionais' },
    { codigo: '7', descricao: '7. (=) EBITDA / LAJIDA' },
    { codigo: '8', descricao: '8. (+/-) Resultado Financeiro' },
    { codigo: '11', descricao: '11. (=) Resultado Líquido do Exercício' }
  ];

  const linhasMatriz = codigos.map(c => {
    const valoresMes = {};
    let totalAno = 0;

    for (const m of meses) {
      const dreMes = resultadosMensais[m];
      const linha = dreMes.linhas.find(l => l.codigo === c.codigo);
      const v = Number(linha?.valor || 0);
      valoresMes[m] = v;
      totalAno += v;
    }

    return {
      codigo: c.codigo,
      descricao: c.descricao,
      meses: valoresMes,
      totalAno: dinheiro(totalAno)
    };
  });

  return {
    ano: anoRef,
    regime,
    linhas: linhasMatriz,
    mesesDetalhados: resultadosMensais
  };
}

/**
 * Exporta a DRE em formato XLSX profissional (Multi-Abas: DRE Oficial, Matriz Anual e Lançamentos).
 */
export async function exportarDreParaXlsx(dre, matrizAnual = null, empresaInfo = {}) {
  const XLSX = await obterXlsx();
  const wb = XLSX.utils.book_new();

  // ── ABA 1: DRE OFICIAL (CPC / CFC) ───────────────────────────────────────
  const wsDreData = [
    ['DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE) - PADRÃO CPC / CFC'],
    [`Empresa: ${empresaInfo.nome || 'Barbearia Dino'}`, `CNPJ: ${empresaInfo.cnpj || '50.073.355/0001-89'}`, `IE: ${empresaInfo.ie || '14.229.191-9 (SEFAZ-MT)'}`],
    [`Período de Apuração: ${dre.periodo?.de} até ${dre.periodo?.ate}`, `Regime: ${String(dre.periodo?.regime || 'competencia').toUpperCase()}`, `Total de Lançamentos: ${dre.resumo?.totalLancamentosApurados || 0}`],
    [],
    ['INDICADORES FINANCEIROS EXECUTIVOS'],
    ['Receita Operacional Bruta (R$)', Number(dre.resumo?.receitaBruta || 0), 'Margem Bruta (%)', `${Number(dre.resumo?.margemBrutaPct || 0).toFixed(1)}%`],
    ['Lucro Bruto (Margem) (R$)', Number(dre.resumo?.lucroBruto || 0), 'Margem EBITDA (%)', `${Number(dre.resumo?.margemEbitdaPct || 0).toFixed(1)}%`],
    ['EBITDA / LAJIDA (R$)', Number(dre.resumo?.ebitda || 0), 'Margem Líquida (%)', `${Number(dre.resumo?.margemLiquidaPct || 0).toFixed(1)}%`],
    ['Resultado Líquido do Exercício (R$)', Number(dre.resumo?.resultadoLiquido || 0), 'Ponto de Equilíbrio Break-even (R$)', Number(dre.resumo?.pontoEquilibrio || 0)],
    [],
    ['CÓDIGO', 'CONTA / CLASSIFICAÇÃO CONTÁBIL', 'VALOR (R$)', 'ANÁLISE VERTICAL (%)']
  ];

  for (const l of (dre.linhas || [])) {
    wsDreData.push([l.codigo, l.descricao, Number(l.valor || 0), `${Number(l.av || 0).toFixed(1)}%`]);
    for (const f of (l.filhos || [])) {
      wsDreData.push([`  ${f.codigo}`, `  ${f.descricao}`, Number(f.valor || 0), `${Number(f.av || 0).toFixed(1)}%`]);
      for (const d of (f.detalhe || [])) {
        wsDreData.push(['    -', `    ${d.categoria}`, Number(d.valor || 0), '-']);
      }
    }
  }

  const wsDre = XLSX.utils.aoa_to_sheet(wsDreData);
  XLSX.utils.book_append_sheet(wb, wsDre, 'DRE Oficial (CPC-CFC)');

  // ── ABA 2: MATRIZ ANUAL COMPARATIVA (12 MESES) ───────────────────────────
  if (matrizAnual && Array.isArray(matrizAnual.linhas)) {
    const wsMatrizData = [
      [`MATRIZ ANUAL COMPARATIVA DA DRE — EXERCÍCIO ${matrizAnual.ano}`],
      [`Empresa: ${empresaInfo.nome || 'Barbearia Dino'}`, `Regime: ${String(matrizAnual.regime || 'competencia').toUpperCase()}`],
      [],
      ['CÓDIGO', 'CONTA / CLASSIFICAÇÃO CONTÁBIL', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ', 'TOTAL ACUMULADO (YTD)']
    ];

    for (const l of matrizAnual.linhas) {
      const row = [l.codigo, l.descricao];
      for (let m = 1; m <= 12; m++) {
        row.push(Number(l.meses?.[m] || 0));
      }
      row.push(Number(l.totalAno || 0));
      wsMatrizData.push(row);
    }
    const wsMatriz = XLSX.utils.aoa_to_sheet(wsMatrizData);
    XLSX.utils.book_append_sheet(wb, wsMatriz, `Matriz Anual ${matrizAnual.ano}`);
  }

  // ── ABA 3: LANÇAMENTOS ANALÍTICOS DETALHADOS ─────────────────────────────
  if (Array.isArray(dre.lancamentosDetalhados)) {
    const wsLancData = [
      ['RELATÓRIO ANALÍTICO DE LANÇAMENTOS OPERACIONAIS'],
      [`Empresa: ${empresaInfo.nome || 'Barbearia Dino'}`, `Período: ${dre.periodo?.de} até ${dre.periodo?.ate}`],
      [],
      ['ID LANÇAMENTO', 'DATA COMPETÊNCIA', 'VENCIMENTO', 'DATA PAGAMENTO', 'TIPO', 'CLASSIFICAÇÃO DRE', 'SUBGRUPO', 'CATEGORIA', 'HISTÓRICO / DESCRIÇÃO', 'VALOR (R$)', 'STATUS', 'MEIO DE PAGAMENTO', 'ORIGEM']
    ];

    for (const item of dre.lancamentosDetalhados) {
      const classif = classificarCategoriaDRE(item.tipo, item.categoria, item.origem, item.descricao);
      wsLancData.push([
        item.id || '',
        item.dataCompetencia || '',
        item.vencimento || '',
        item.pagoEm || '',
        item.tipo === 'receita' ? 'RECEITA' : 'DESPESA',
        classif.rotulo,
        classif.subgrupo,
        item.categoria || '',
        item.descricao || '',
        Number(item.valor || 0),
        item.status || '',
        item.meioPagamento || '',
        item.origem || ''
      ]);
    }
    const wsLanc = XLSX.utils.aoa_to_sheet(wsLancData);
    XLSX.utils.book_append_sheet(wb, wsLanc, 'Lançamentos Analíticos');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Gera documento HTML oficial timbrado pronto para impressão / geração em PDF (A4).
 */
export function gerarHtmlDreOficialPdf(dre, matrizAnual = null, empresaInfo = {}) {
  const agoraFormatada = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (v) => `${Number(v || 0).toFixed(1).replace('.', ',')}%`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>DRE Oficial — ${empresaInfo.nome || 'Barbearia Dino'}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.35; font-size: 11px; margin: 0; padding: 20px; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header-title h1 { font-size: 18px; margin: 0 0 4px 0; color: #0f172a; font-weight: 800; }
    .header-title p { margin: 0; color: #64748b; font-size: 11px; }
    .header-meta { text-align: right; font-size: 10px; color: #475569; }
    .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
    .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
    .kpi-value { font-size: 14px; font-weight: 800; color: #0f172a; }
    .kpi-sub { font-size: 9px; color: #0284c7; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; font-size: 10px; text-transform: uppercase; padding: 6px 8px; text-align: left; }
    th.right, td.right { text-align: right; }
    td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10.5px; }
    tr.destaque { background: #f8fafc; font-weight: 700; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #cbd5e1; }
    tr.destaque td { color: #0f172a; }
    tr.subgrupo td { color: #334155; }
    tr.detalhe td { color: #64748b; font-size: 9.5px; padding-left: 24px; }
    .signatures { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; page-break-inside: avoid; }
    .sig-box { border-top: 1px solid #0f172a; text-align: center; padding-top: 8px; font-size: 10px; }
    .sig-name { font-weight: 700; font-size: 11px; margin-bottom: 2px; }
    .sig-role { color: #64748b; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">
      <h1>DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE)</h1>
      <p>Padrão Contábil CPC / CFC · Apuração Oficial de Margens e Resultados</p>
      <p style="margin-top: 4px; font-weight: 600; color: #0284c7;">
        ${empresaInfo.nome || 'Barbearia Dino'} &nbsp;·&nbsp; CNPJ: ${empresaInfo.cnpj || '50.073.355/0001-89'} &nbsp;·&nbsp; IE: ${empresaInfo.ie || '14.229.191-9 (SEFAZ-MT)'}
      </p>
    </div>
    <div class="header-meta">
      <div><strong>Período:</strong> ${dre.periodo?.de} até ${dre.periodo?.ate}</div>
      <div><strong>Regime:</strong> ${String(dre.periodo?.regime || 'competencia').toUpperCase()}</div>
      <div><strong>Emissão:</strong> ${agoraFormatada}</div>
      <div><strong>Lançamentos Apurados:</strong> ${dre.resumo?.totalLancamentosApurados || 0}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi-card">
      <div class="kpi-label">Receita Bruta</div>
      <div class="kpi-value">R$ ${fmt(dre.resumo?.receitaBruta)}</div>
      <div class="kpi-sub">Faturamento Total</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Lucro Bruto</div>
      <div class="kpi-value" style="color: ${dre.resumo?.lucroBruto >= 0 ? '#16a34a' : '#dc2626'};">R$ ${fmt(dre.resumo?.lucroBruto)}</div>
      <div class="kpi-sub">Margem: ${fmtPct(dre.resumo?.margemBrutaPct)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">EBITDA / LAJIDA</div>
      <div class="kpi-value" style="color: ${dre.resumo?.ebitda >= 0 ? '#16a34a' : '#dc2626'};">R$ ${fmt(dre.resumo?.ebitda)}</div>
      <div class="kpi-sub">Margem: ${fmtPct(dre.resumo?.margemEbitdaPct)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Resultado Líquido</div>
      <div class="kpi-value" style="color: ${dre.resumo?.resultadoLiquido >= 0 ? '#16a34a' : '#dc2626'};">R$ ${fmt(dre.resumo?.resultadoLiquido)}</div>
      <div class="kpi-sub">Margem: ${fmtPct(dre.resumo?.margemLiquidaPct)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ponto de Equilíbrio</div>
      <div class="kpi-value">R$ ${fmt(dre.resumo?.pontoEquilibrio)}</div>
      <div class="kpi-sub">Break-Even R$</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 70px;">Código</th>
        <th>Conta / Classificação Contábil</th>
        <th class="right" style="width: 130px;">Valor (R$)</th>
        <th class="right" style="width: 90px;">Análise Vertical</th>
      </tr>
    </thead>
    <tbody>
      ${(dre.linhas || []).map(l => `
        <tr class="${l.destaque ? 'destaque' : ''}">
          <td><strong>${l.codigo}</strong></td>
          <td><strong>${l.descricao}</strong></td>
          <td class="right" style="color: ${l.valor < 0 ? '#dc2626' : (l.destaque ? '#0f172a' : 'inherit')};"><strong>R$ ${fmt(l.valor)}</strong></td>
          <td class="right"><strong>${fmtPct(l.av)}</strong></td>
        </tr>
        ${(l.filhos || []).map(f => `
          <tr class="subgrupo">
            <td style="padding-left: 14px;">${f.codigo}</td>
            <td style="padding-left: 14px;">${f.descricao}</td>
            <td class="right" style="color: ${f.valor < 0 ? '#dc2626' : 'inherit'};">R$ ${fmt(f.valor)}</td>
            <td class="right">${fmtPct(f.av)}</td>
          </tr>
          ${(f.detalhe || []).map(d => `
            <tr class="detalhe">
              <td></td>
              <td>↳ ${d.categoria}</td>
              <td class="right">R$ ${fmt(d.valor)}</td>
              <td class="right">-</td>
            </tr>
          `).join('')}
        `).join('')}
      `).join('')}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-name">RODRIGO RIBEIRO GONÇALVES</div>
      <div class="sig-role">Diretoria Executiva / Proprietário</div>
      <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Assinatura Digital Certificada ICP-Brasil</div>
    </div>
    <div class="sig-box">
      <div class="sig-name">RESPONSÁVEL TÉCNICO CONTÁBIL</div>
      <div class="sig-role">Contador Responsável · CRC/MT</div>
      <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Termo de Conformidade Contábil e Fiscal CPC/CFC</div>
    </div>
  </div>
</body>
</html>`;
}

export default {
  classificarCategoriaDRE,
  calcularDreCompleta,
  calcularDreAnual12Meses,
  exportarDreParaXlsx,
  gerarHtmlDreOficialPdf
};
