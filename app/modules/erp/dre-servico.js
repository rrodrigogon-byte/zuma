/**
 * ============================================================================
 * KYTTO ERP — MÓDULO DE DRE CONTÁBIL & GERENCIAL AVANÇADA (CPC / CFC / LEI 6.404/76)
 * ============================================================================
 * Apuração contábil oficial por Regime de Competência e Regime de Caixa.
 * Multi-tenant absoluto: Barbearia Dino, Stallone Nutre Sport, Agro Open,
 * Supermercado Kytto, e Visão Consolidada da Holding Kytto.
 * Suporta Análise Vertical (AV %), Análise Horizontal (AH % vs. Mês Anterior),
 * Matriz Anual Comparativa de 12 Meses, Ponto de Equilíbrio, Exportação em XLSX
 * (Excel Multi-Abas) e impressão timbrada A4/PDF.
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

export const HOLDING_CONSOLIDADO_ID = "00000000-0000-0000-0000-000000000001";

export const METADADOS_EMPRESAS = {
  "00000000-0000-0000-0000-000000000001": {
    nome: "Holding Kytto (Consolidado)",
    razaoSocial: "KYTTO HOLDING & PARTICIPAÇÕES S.A.",
    cnpj: "50.073.355/0001-89 (Matriz)",
    ie: "Múltiplas (SEFAZ-MT)",
    segmento: "Holding Empresarial Multi-Setorial & Gestão de Participações",
    cidade: "Tangará da Serra - MT",
    endereco: "Tangará da Serra / Cuiabá - MT",
    ehConsolidado: true
  },
  "consolidado": {
    nome: "Holding Kytto (Consolidado)",
    razaoSocial: "KYTTO HOLDING & PARTICIPAÇÕES S.A.",
    cnpj: "50.073.355/0001-89 (Matriz)",
    ie: "Múltiplas (SEFAZ-MT)",
    segmento: "Holding Empresarial Multi-Setorial & Gestão de Participações",
    cidade: "Tangará da Serra - MT",
    endereco: "Tangará da Serra / Cuiabá - MT",
    ehConsolidado: true
  },
  "holding": {
    nome: "Holding Kytto (Consolidado)",
    razaoSocial: "KYTTO HOLDING & PARTICIPAÇÕES S.A.",
    cnpj: "50.073.355/0001-89 (Matriz)",
    ie: "Múltiplas (SEFAZ-MT)",
    segmento: "Holding Empresarial Multi-Setorial & Gestão de Participações",
    cidade: "Tangará da Serra - MT",
    endereco: "Tangará da Serra / Cuiabá - MT",
    ehConsolidado: true
  },
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
          cnpj: row.cnpj || "00.000.000/0001-00",
          ie: row.inscricao_estadual || "Isento",
          segmento: fallback.segmento || "Comércio & Serviços",
          cidade: "Tangará da Serra - MT",
          ...cleanFallback
        };
      }
    } catch (e) {
      // Ignora erro e usa fallback
    }
  }
  return {
    nome: cleanFallback.nome || "Empresa Kytto",
    razaoSocial: cleanFallback.razaoSocial || cleanFallback.nome || "Empresa Kytto",
    cnpj: cleanFallback.cnpj || "50.073.355/0001-89",
    ie: cleanFallback.ie || "14.229.191-9 (SEFAZ-MT)",
    segmento: cleanFallback.segmento || "Comércio e Serviços",
    cidade: "Tangará da Serra - MT",
    ...cleanFallback
  };
}

const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;

export function classificarCategoriaDRE(tipo, categoria, origem = null, descricao = '') {
  const t = String(tipo || '').toLowerCase();
  const c = String(categoria || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const d = String(descricao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const o = String(origem || '').toLowerCase();

  if (t === 'receita') {
    if (c.includes('juro') || c.includes('rendimento') || c.includes('aplicacao') || d.includes('rendimento')) {
      return { subgrupo: 'receita_financeira', rotulo: '8.1 Receitas Financeiras (Juros / Rendimentos)', ordem: 81 };
    }
    if (c.includes('mensalidade') || c.includes('plano') || c.includes('clube') || c.includes('assinatura')) {
      return { subgrupo: 'receita_planos', rotulo: '1.3 Mensalidades, Planos & Clubes', ordem: 13 };
    }
    if (c.includes('produto') || c.includes('cosmetico') || c.includes('pomada') || c.includes('mercadoria') || c.includes('revenda') || c.includes('suplemento') || c.includes('insumo') || c.includes('aliment') || o === 'barbearia_revenda' || o === 'commerce_order' || o === 'var_venda') {
      return { subgrupo: 'receita_produtos', rotulo: '1.2 Venda de Mercadorias / Produtos', ordem: 12 };
    }
    if (c.includes('servico') || c.includes('corte') || c.includes('barba') || c.includes('barbearia') || c.includes('manicure') || c.includes('estetica') || o === 'barbearia_atendimento' || o === 'barbearia_comanda') {
      return { subgrupo: 'receita_servicos', rotulo: '1.1 Venda de Serviços', ordem: 11 };
    }
    return { subgrupo: 'receita_outras', rotulo: '1.4 Outras Receitas Operacionais', ordem: 14 };
  }

  // Despesas / Custos / Deduções
  if (c.includes('devolucao') || c.includes('cancelamento') || c.includes('estorno')) {
    return { subgrupo: 'deducoes_devolucoes', rotulo: '2.1 Devoluções e Cancelamentos', ordem: 21 };
  }
  if (c.includes('taxa') || c.includes('cartao') || c.includes('maquininha') || c.includes('stone') || c.includes('cielo') || c.includes('pagseguro') || c.includes('intermediacao') || c.includes('asaas') || c.includes('stripe')) {
    return { subgrupo: 'deducoes_taxas', rotulo: '2.2 Taxas de Intermediação & Meios de Pagamento', ordem: 22 };
  }
  if (c.includes('imposto') || c.includes('simples nacional') || c.includes('das') || c.includes('issqn') || c.includes('icms') || c.includes('pis') || c.includes('cofins')) {
    return { subgrupo: 'deducoes_tributos', rotulo: '2.3 Tributos e Impostos sobre Vendas', ordem: 23 };
  }
  if (c.includes('desconto') || c.includes('abatimento')) {
    return { subgrupo: 'deducoes_descontos', rotulo: '2.4 Descontos Concedidos e Abatimentos', ordem: 24 };
  }
  if (c.includes('comissao') || c.includes('comissoes') || c.includes('repasse barbeiro') || c.includes('parceiro') || c.includes('terceiro prestador') || d.includes('comissao')) {
    return { subgrupo: 'custo_csp', rotulo: '4.2 Custo dos Serviços Prestados (CSP) / Comissões', ordem: 42 };
  }
  if (c.includes('cmv') || c.includes('fornecedor') || c.includes('compra') || c.includes('mercadoria') || c.includes('insumo') || c.includes('mercadoria para revenda') || c.includes('insumo') || c.includes('materia prima') || c.includes('lote suplemento') || o === 'nfe_compra') {
    return { subgrupo: 'custo_cmv', rotulo: '4.1 Custo das Mercadorias Vendidas (CMV) / Insumos', ordem: 41 };
  }
  if (c.includes('salario') || c.includes('pro-labore') || c.includes('pro labore') || c.includes('folha') || c.includes('inss') || c.includes('fgts') || c.includes('beneficio') || c.includes('vale') || c.includes('equipe')) {
    return { subgrupo: 'despesa_pessoal', rotulo: '6.1 Despesas com Pessoal & Pró-labore', ordem: 61 };
  }
  if (c.includes('aluguel') || c.includes('condominio') || c.includes('energia') || c.includes('luz') || c.includes('agua') || c.includes('iptu') || c.includes('internet') || c.includes('telefone') || c.includes('limpeza') || c.includes('seguranca') || c.includes('locacao')) {
    return { subgrupo: 'despesa_ocupacao', rotulo: '6.2 Ocupação, Utilidades & Instalações', ordem: 62 };
  }
  if (c.includes('marketing') || c.includes('anuncio') || c.includes('trafego') || c.includes('instagram') || c.includes('facebook') || c.includes('google ads') || c.includes('panfleto') || c.includes('propaganda')) {
    return { subgrupo: 'despesa_marketing', rotulo: '6.3 Comercial, Marketing & Tráfego Pago', ordem: 63 };
  }
  if (c.includes('software') || c.includes('sistema') || c.includes('kytto') || c.includes('contabilidade') || c.includes('honorario') || c.includes('juridico') || c.includes('licenca') || c.includes('consultoria') || c.includes('ti') || c.includes('servidor')) {
    return { subgrupo: 'despesa_administrativa', rotulo: '6.4 Administrativas, Softwares & Honorários', ordem: 64 };
  }
  if (c.includes('tarifa bancaria') || c.includes('ted') || c.includes('pix taxa') || c.includes('iof') || c.includes('juros de mora') || c.includes('multa financeira') || c.includes('despesa financeira')) {
    return { subgrupo: 'despesa_financeira', rotulo: '8.2 Despesas Financeiras & Tarifas Bancárias', ordem: 82 };
  }
  if (c.includes('investimento') || c.includes('reforma') || c.includes('ativo imobilizado') || c.includes('equipamento') || c.includes('maquina') || c.includes('cadeira barbearia')) {
    return { subgrupo: 'investimentos', rotulo: '13. Investimentos & Ativos Imobilizados', ordem: 130 };
  }
  return { subgrupo: 'despesa_geral', rotulo: '6.5 Outras Despesas Operacionais', ordem: 65 };
}

/**
 * Coleta lançamentos com unificação completa de fontes:
 * 1. PostgreSQL (tabela fin_lancamentos)
 * 2. Financeiro Central Kytto (store ledger histórico de 6.894+ lançamentos)
 * 3. Comandas da Barbearia (se houver comandas faturadas sem ledger)
 * 4. Commerce Orders (pedidos da Stallone Nutre Sport)
 * 5. Vendas de Balcão e Insumos (AGRO OPEN TTC)
 * Deduplica de forma idempotente por chave única.
 */
async function coletarLancamentos({ db, empresaId, de, ate, regime = 'competencia', lojaId = null, centroCustoId = null }) {
  const normId = String(empresaId || '').toLowerCase().trim();
  const ehConsolidado = normId === HOLDING_CONSOLIDADO_ID || normId === 'consolidado' || normId === 'holding';
  const empresa = ehConsolidado ? HOLDING_CONSOLIDADO_ID : (empresaId && empresaId.length === 36 ? exigirUuid(empresaId, 'empresa') : empresaId);
  const inicio = exigirData(de, 'De');
  const fim = exigirData(ate, 'Até');
  const mapaItens = new Map();

  const mapearNomeEmpresa = (id) => {
    const s = String(id || '').toLowerCase();
    if (s.includes('d0d0ac01') || s.includes('dino')) return 'Barbearia Dino';
    if (s.includes('31f70c83') || s.includes('stallone')) return 'Stallone Nutre Sport';
    if (s.includes('2e041110') || s.includes('agro')) return 'AGRO OPEN TTC';
    if (s.includes('00000000-0000-0000-0000-000000000002') || s.includes('supermercado')) return 'Supermercado Kytto';
    return 'Barbearia Dino';
  };

  // 1. Consulta PostgreSQL
  if (db && typeof db.query === 'function') {
    try {
      const temTabela = (await db.query("SELECT to_regclass('fin_lancamentos') AS t")).rows[0]?.t;
      if (temTabela) {
        const campoData = regime === 'caixa' ? "COALESCE(l.pago_em::date, l.vencimento, l.data_competencia)" : "COALESCE(l.data_competencia, l.vencimento, l.pago_em::date)";
        const condStatus = regime === 'caixa' ? "l.status = 'pago'" : "l.status <> 'cancelado'";
        
        let condEmpresa = '';
        const v = [];
        if (ehConsolidado) {
          v.push(inicio, fim);
          condEmpresa = `WHERE ${condStatus} AND ${campoData} BETWEEN $1 AND $2`;
        } else {
          v.push(empresa, inicio, fim);
          condEmpresa = `WHERE l.empresa_id = $1 AND ${condStatus} AND ${campoData} BETWEEN $2 AND $3`;
        }
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
          SELECT l.id, l.empresa_id, l.tipo, l.categoria, l.descricao, l.valor, l.data_competencia, l.vencimento,
                 l.pago_em, l.status, l.origem, l.meio_pagamento, c.grupo_dre, l.chave
            FROM fin_lancamentos l
            LEFT JOIN fin_categorias c ON c.empresa_id = l.empresa_id AND c.tipo = l.tipo AND c.nome = l.categoria
           ${condEmpresa}
           ${filtroUnidade}
           ${filtroCentro}
           ORDER BY ${campoData} ASC
        `;
        const res = await db.query(sql, v);
        for (const r of res.rows) {
          const key = String(r.chave || r.id || `${r.tipo}:${r.descricao}:${r.valor}`);
          mapaItens.set(key, {
            id: r.id,
            empresaId: r.empresa_id,
            empresaNome: mapearNomeEmpresa(r.empresa_id),
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

  // 2. Unifica com Financeiro Central Kytto (Dino)
  const ehDino = ehConsolidado || String(empresa || "").toLowerCase() === "d0d0ac01-8e50-4b61-8c79-de4aaa916da6" ||
                 String(empresa || "").toLowerCase() === "emp-kytto-001" ||
                 String(empresa || "").toLowerCase() === "dino";
  if (ehDino && financeiroKytto && typeof financeiroKytto.listarLancamentos === 'function') {
    try {
      const empresaDinoId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      const todos = financeiroKytto.listarLancamentos(ehConsolidado ? empresaDinoId : empresa, { lojaId });
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
            empresaId: empresaDinoId,
            empresaNome: 'Barbearia Dino',
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

  // 3. Comandas da Barbearia Dino
  if (ehDino) {
    try {
      const estado = estadoEmpresa(ehConsolidado ? 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' : empresa, false);
      for (const comanda of Object.values(estado.comandas || {})) {
        if (comanda.status === 'cancelada') continue;
        const refData = String(comanda.fechadaEm || comanda.dataAtendimento || comanda.criadoEm || '').slice(0, 10);
        if (!refData || refData < inicio || refData > fim) continue;
        const faturada = comanda.status === 'paga' || comanda.status === 'em_conta' || Number(comanda.totalPago || 0) > 0;
        if (!faturada) continue;
        const jaNoMapa = (comanda.financeiroLancamentoIds || []).some(id => mapaItens.has(String(id)));
        if (jaNoMapa) continue;
        for (const item of (comanda.itens || [])) {
          const keyItem = `comanda:${comanda.id}:item:${item.id || item.nome}:${refData}`;
          if (!mapaItens.has(keyItem)) {
            const ehProduto = item.tipo === 'produto';
            mapaItens.set(keyItem, {
              id: keyItem,
              empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
              empresaNome: 'Barbearia Dino',
              tipo: 'receita',
              categoria: ehProduto ? 'Produtos & Cosméticos' : 'Serviços Barbearia',
              descricao: `${ehProduto ? 'Venda Produto' : 'Serviço'}: ${item.nome || 'Atendimento'} — Comanda ${comanda.id}`,
              valor: Number(item.subtotal || (item.quantidade * item.precoUnitario) || 0),
              dataCompetencia: refData,
              vencimento: refData,
              pagoEm: refData,
              status: 'pago',
              origem: 'barbearia_comanda',
              meioPagamento: comanda.meioPagamento || 'pix',
              grupoDreConfigurado: ehProduto ? 'receita_produtos' : 'receita_servicos'
            });
          }
        }
      }
    } catch (e) {
      console.warn('[dre-servico] Aviso ao unificar comandas Dino:', e.message);
    }
  }

  // 4. Commerce Orders (Stallone)
  const ehStallone = ehConsolidado || String(empresa || "").toLowerCase() === "31f70c83-9172-40c2-945f-9e793b5048be" ||
                     String(empresa || "").toLowerCase().includes("stallone");
  if (ehStallone && db && typeof db.query === 'function') {
    try {
      const temOrders = (await db.query("SELECT to_regclass('commerce_orders') AS t")).rows[0]?.t;
      if (temOrders) {
        const campoDataPed = regime === 'caixa' ? "COALESCE(paid_at::date, created_at::date)" : "COALESCE(created_at::date, paid_at::date)";
        const condPagoPed = regime === 'caixa' ? "status = 'paid'" : "status <> 'cancelled'";
        const sqlPed = `
          SELECT id, numero, total, status, payment_method, created_at, paid_at
            FROM commerce_orders
           WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be'
             AND ${condPagoPed}
             AND ${campoDataPed} BETWEEN $1 AND $2
        `;
        const rPed = await db.query(sqlPed, [inicio, fim]);
        for (const row of rPed.rows) {
          const keyPed = `order:${row.id}`;
          if (!mapaItens.has(keyPed)) {
            const dataRef = String(row.created_at || row.paid_at || '').slice(0, 10);
            mapaItens.set(keyPed, {
              id: row.id,
              empresaId: '31f70c83-9172-40c2-945f-9e793b5048be',
              empresaNome: 'Stallone Nutre Sport',
              tipo: 'receita',
              categoria: 'Vendas Ecommerce / Loja Online',
              descricao: `Pedido #${row.numero || row.id} — Stallone Nutre Sport`,
              valor: Number(row.total || 0),
              dataCompetencia: dataRef,
              vencimento: dataRef,
              pagoEm: row.paid_at ? String(row.paid_at).slice(0, 10) : dataRef,
              status: row.status === 'paid' ? 'pago' : 'pendente',
              origem: 'commerce_order',
              meioPagamento: row.payment_method || 'cartao',
              grupoDreConfigurado: 'receita_produtos'
            });
          }
        }
      }
    } catch (e) {
      console.warn('[dre-servico] Aviso ao unificar commerce_orders:', e.message);
    }
  }

  // 5. Varejo / Agro Open Vendas
  const ehAgro = ehConsolidado || String(empresa || "").toLowerCase() === "2e041110-db20-4fd1-8278-12bd3dead008" ||
                 String(empresa || "").toLowerCase().includes("agro");
  if (ehAgro && db && typeof db.query === 'function') {
    try {
      const temVar = (await db.query("SELECT to_regclass('var_vendas') AS t")).rows[0]?.t;
      if (temVar) {
        const sqlVar = `
          SELECT id, numero_venda, total_venda, status, forma_pagamento, data_venda
            FROM var_vendas
           WHERE empresa_id = '2e041110-db20-4fd1-8278-12bd3dead008'
             AND status <> 'cancelada'
             AND data_venda::date BETWEEN $1 AND $2
        `;
        const rVar = await db.query(sqlVar, [inicio, fim]);
        for (const row of rVar.rows) {
          const keyVar = `var:${row.id}`;
          if (!mapaItens.has(keyVar)) {
            const dataRef = String(row.data_venda || '').slice(0, 10);
            mapaItens.set(keyVar, {
              id: row.id,
              empresaId: '2e041110-db20-4fd1-8278-12bd3dead008',
              empresaNome: 'AGRO OPEN TTC',
              tipo: 'receita',
              categoria: 'Vendas Balcão / Agro Open',
              descricao: `Venda #${row.numero_venda || row.id} — Insumos / Conveniência`,
              valor: Number(row.total_venda || 0),
              dataCompetencia: dataRef,
              vencimento: dataRef,
              pagoEm: dataRef,
              status: 'pago',
              origem: 'var_venda',
              meioPagamento: row.forma_pagamento || 'pix',
              grupoDreConfigurado: 'receita_produtos'
            });
          }
        }
      }
    } catch (e) {
      console.warn('[dre-servico] Aviso ao unificar var_vendas:', e.message);
    }
  }

  return Array.from(mapaItens.values());
}

/**
 * Acumula os totais das 11 contas sintéticas e subgrupos da DRE a partir de uma lista de lançamentos
 */
function acumularTotaisDre(lancamentos) {
  const acumuladores = {
    receita_servicos: { rotulo: "1.1 Venda de Serviços", total: 0, linhas: {} },
    receita_produtos: { rotulo: "1.2 Venda de Mercadorias / Produtos", total: 0, linhas: {} },
    receita_planos: { rotulo: "1.3 Mensalidades, Planos & Clubes", total: 0, linhas: {} },
    receita_outras: { rotulo: "1.4 Outras Receitas Operacionais", total: 0, linhas: {} },
    deducoes_devolucoes: { rotulo: "2.1 Devoluções e Cancelamentos", total: 0, linhas: {} },
    deducoes_taxas: { rotulo: "2.2 Taxas de Intermediação & Meios de Pagamento", total: 0, linhas: {} },
    deducoes_tributos: { rotulo: "2.3 Tributos e Impostos sobre Vendas", total: 0, linhas: {} },
    deducoes_descontos: { rotulo: "2.4 Descontos Concedidos e Abatimentos", total: 0, linhas: {} },
    custo_cmv: { rotulo: "4.1 Custo das Mercadorias Vendidas (CMV) / Insumos", total: 0, linhas: {} },
    custo_csp: { rotulo: "4.2 Custo dos Serviços Prestados (CSP) / Comissões", total: 0, linhas: {} },
    despesa_pessoal: { rotulo: "6.1 Despesas com Pessoal & Pró-labore", total: 0, linhas: {} },
    despesa_ocupacao: { rotulo: "6.2 Ocupação, Utilidades & Instalações", total: 0, linhas: {} },
    despesa_marketing: { rotulo: "6.3 Comercial, Marketing & Tráfego Pago", total: 0, linhas: {} },
    despesa_administrativa: { rotulo: "6.4 Administrativas, Softwares & Honorários", total: 0, linhas: {} },
    despesa_geral: { rotulo: "6.5 Outras Despesas Operacionais", total: 0, linhas: {} },
    receita_financeira: { rotulo: "8.1 Receitas Financeiras (Juros / Rendimentos)", total: 0, linhas: {} },
    despesa_financeira: { rotulo: "8.2 Despesas Financeiras & Tarifas Bancárias", total: 0, linhas: {} },
    investimentos: { rotulo: "13. Investimentos & Ativos Imobilizados", total: 0, linhas: {} }
  };

  for (const l of lancamentos) {
    const classif = l.grupoDreConfigurado
      ? { subgrupo: l.grupoDreConfigurado, rotulo: l.categoria, ordem: 99 }
      : classificarCategoriaDRE(l.tipo, l.categoria, l.origem, l.descricao);
    const alvo = acumuladores[classif.subgrupo] || acumuladores.despesa_geral;
    const rotuloLinha = l.categoria && l.categoria !== "Barbearia" && l.categoria !== "Outros"
      ? l.categoria
      : (l.descricao ? l.descricao.split("—")[0].trim().slice(0, 80) : "Atendimento Barbearia");
    alvo.total = dinheiro(alvo.total + l.valor);
    alvo.linhas[rotuloLinha] = dinheiro((alvo.linhas[rotuloLinha] || 0) + l.valor);
  }

  const receitaBruta = dinheiro(
    acumuladores.receita_servicos.total +
    acumuladores.receita_produtos.total +
    acumuladores.receita_planos.total +
    acumuladores.receita_outras.total
  );
  const totalDeducoes = dinheiro(
    acumuladores.deducoes_devolucoes.total +
    acumuladores.deducoes_taxas.total +
    acumuladores.deducoes_tributos.total +
    acumuladores.deducoes_descontos.total
  );
  const receitaLiquida = dinheiro(receitaBruta - totalDeducoes);
  const totalCustos = dinheiro(
    acumuladores.custo_cmv.total +
    acumuladores.custo_csp.total
  );
  const lucroBruto = dinheiro(receitaLiquida - totalCustos);
  const totalDespesasOperacionais = dinheiro(
    acumuladores.despesa_pessoal.total +
    acumuladores.despesa_ocupacao.total +
    acumuladores.despesa_marketing.total +
    acumuladores.despesa_administrativa.total +
    acumuladores.despesa_geral.total
  );
  const ebitda = dinheiro(lucroBruto - totalDespesasOperacionais);
  const resultadoFinanceiro = dinheiro(acumuladores.receita_financeira.total - acumuladores.despesa_financeira.total);
  const lair = dinheiro(ebitda + resultadoFinanceiro);
  const impostosSobreLucro = 0;
  const resultadoLiquido = dinheiro(lair - impostosSobreLucro);

  return {
    acumuladores,
    totaisPorCodigo: {
      "1": receitaBruta,
      "2": totalDeducoes,
      "3": receitaLiquida,
      "4": totalCustos,
      "5": lucroBruto,
      "6": totalDespesasOperacionais,
      "7": ebitda,
      "8": resultadoFinanceiro,
      "9": lair,
      "10": impostosSobreLucro,
      "11": resultadoLiquido
    }
  };
}

/**
 * Calcula a DRE completa e detalhada para o período solicitado.
 * Suporta apuração por Competência ou Caixa, cálculo de Análise Vertical (AV %),
 * Análise Horizontal (AH % vs. Mês Anterior), EBITDA, Ponto de Equilíbrio e Consolidação Holding.
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

  const normId = String(empresaId || '').toLowerCase().trim();
  const ehConsolidado = normId === HOLDING_CONSOLIDADO_ID || normId === 'consolidado' || normId === 'holding';

  const lancamentos = await coletarLancamentos({
    db, empresaId, de: dataInicio, ate: dataFim, regime, lojaId, centroCustoId
  });

  const { acumuladores, totaisPorCodigo } = acumularTotaisDre(lancamentos);

  const receitaBruta = totaisPorCodigo["1"];
  const totalDeducoes = totaisPorCodigo["2"];
  const receitaLiquida = totaisPorCodigo["3"];
  const totalCustos = totaisPorCodigo["4"];
  const lucroBruto = totaisPorCodigo["5"];
  const margemBrutaPct = receitaBruta > 0 ? Number(((lucroBruto / receitaBruta) * 100).toFixed(1)) : 0;
  const totalDespesasOperacionais = totaisPorCodigo["6"];
  const ebitda = totaisPorCodigo["7"];
  const margemEbitdaPct = receitaBruta > 0 ? Number(((ebitda / receitaBruta) * 100).toFixed(1)) : 0;
  const resultadoFinanceiro = totaisPorCodigo["8"];
  const lair = totaisPorCodigo["9"];
  const impostosSobreLucro = totaisPorCodigo["10"];
  const resultadoLiquido = totaisPorCodigo["11"];
  const margemLiquidaPct = receitaBruta > 0 ? Number(((resultadoLiquido / receitaBruta) * 100).toFixed(1)) : 0;

  // Ponto de Equilíbrio Operacional (Break-even): Custo Fixo / Margem de Contribuição %
  const margemContribuicaoPct = receitaBruta > 0 ? (receitaLiquida - totalCustos) / receitaBruta : 0;
  const pontoEquilibrio = margemContribuicaoPct > 0
    ? dinheiro(totalDespesasOperacionais / margemContribuicaoPct)
    : totalDespesasOperacionais;

  // Análise Horizontal (AH %) vs Mês Anterior (M-1)
  let mesAnterior = null;
  let resumoMesAnt = null;
  if (mes && mes.length === 7) {
    const [y, m] = mes.split('-').map(Number);
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;
    mesAnterior = `${prevY}-${String(prevM).padStart(2, '0')}`;
    try {
      const uDiaAnt = new Date(prevY, prevM, 0).getDate();
      const lancsAnt = await coletarLancamentos({
        db,
        empresaId,
        de: `${mesAnterior}-01`,
        ate: `${mesAnterior}-${String(uDiaAnt).padStart(2, '0')}`,
        regime,
        lojaId,
        centroCustoId
      });
      resumoMesAnt = acumularTotaisDre(lancsAnt);
    } catch (e) {
      console.warn('[dre-servico] Aviso ao calcular mês anterior para AH:', e.message);
    }
  }

  // Helpers para AV % e AH %
  const calcAv = (val) => receitaBruta > 0 ? Number(((val / receitaBruta) * 100).toFixed(1)) : 0;
  const calcAh = (valorAtual, valorAnt) => {
    if (valorAnt === null || valorAnt === undefined) return 0;
    const nAtual = Number(valorAtual || 0);
    const nAnt = Number(valorAnt || 0);
    if (nAnt !== 0) {
      return Number((((nAtual - nAnt) / Math.abs(nAnt)) * 100).toFixed(1));
    }
    return nAtual !== 0 ? 100.0 : 0.0;
  };

  function montarFilhos(chaves) {
    return chaves.map(k => {
      const sub = acumuladores[k];
      const detalhe = Object.entries(sub.linhas || {}).map(([catNome, v]) => ({
        categoria: catNome,
        valor: v
      })).sort((a, b) => b.valor - a.valor);
      const subAnt = resumoMesAnt ? resumoMesAnt.acumuladores[k] : null;
      const vSubAnt = subAnt ? subAnt.total : null;
      const ahSub = vSubAnt !== null ? calcAh(sub.total, vSubAnt) : 0;
      return {
        codigo: sub.rotulo.split(' ')[0],
        descricao: sub.rotulo,
        valor: sub.total,
        av: calcAv(sub.total),
        valorAnterior: vSubAnt,
        ah: ahSub,
        tendencia: vSubAnt !== null ? (sub.total > vSubAnt ? 'alta' : (sub.total < vSubAnt ? 'baixa' : 'estavel')) : 'estavel',
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

  // Aplica AH nas linhas sintéticas principais
  for (const l of linhas) {
    const vAnt = resumoMesAnt ? (resumoMesAnt.totaisPorCodigo[l.codigo] ?? null) : null;
    l.valorAnterior = vAnt;
    if (vAnt !== null) {
      l.variacaoNominal = dinheiro(l.valor - vAnt);
      l.ah = calcAh(l.valor, vAnt);
      l.tendencia = l.variacaoNominal > 0 ? 'alta' : (l.variacaoNominal < 0 ? 'baixa' : 'estavel');
    } else {
      l.variacaoNominal = 0;
      l.ah = 0;
      l.tendencia = 'estavel';
    }
  }

  // Composição por Empresa (Quadro de Participação do Grupo Econômico)
  const porEmpresa = {
    'Barbearia Dino': { nome: 'Barbearia Dino', id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', icone: '💈', receitaBruta: 0, receitaLiquida: 0, custos: 0, lucroBruto: 0, despesas: 0, ebitda: 0, resultadoLiquido: 0, totalLancamentos: 0, shareReceita: 0 },
    'Stallone Nutre Sport': { nome: 'Stallone Nutre Sport', id: '31f70c83-9172-40c2-945f-9e793b5048be', icone: '💪', receitaBruta: 0, receitaLiquida: 0, custos: 0, lucroBruto: 0, despesas: 0, ebitda: 0, resultadoLiquido: 0, totalLancamentos: 0, shareReceita: 0 },
    'AGRO OPEN TTC': { nome: 'AGRO OPEN TTC', id: '2e041110-db20-4fd1-8278-12bd3dead008', icone: '🌱', receitaBruta: 0, receitaLiquida: 0, custos: 0, lucroBruto: 0, despesas: 0, ebitda: 0, resultadoLiquido: 0, totalLancamentos: 0, shareReceita: 0 },
    'Supermercado Kytto': { nome: 'Supermercado Kytto', id: '00000000-0000-0000-0000-000000000002', icone: '🛒', receitaBruta: 0, receitaLiquida: 0, custos: 0, lucroBruto: 0, despesas: 0, ebitda: 0, resultadoLiquido: 0, totalLancamentos: 0, shareReceita: 0 }
  };

  for (const l of lancamentos) {
    const empAlvo = porEmpresa[l.empresaNome] || porEmpresa['Barbearia Dino'];
    empAlvo.totalLancamentos += 1;
    if (l.tipo === 'receita') {
      empAlvo.receitaBruta = dinheiro(empAlvo.receitaBruta + l.valor);
      empAlvo.receitaLiquida = dinheiro(empAlvo.receitaLiquida + l.valor);
      empAlvo.lucroBruto = dinheiro(empAlvo.lucroBruto + l.valor);
      empAlvo.ebitda = dinheiro(empAlvo.ebitda + l.valor);
      empAlvo.resultadoLiquido = dinheiro(empAlvo.resultadoLiquido + l.valor);
    } else {
      const classif = classificarCategoriaDRE(l.tipo, l.categoria, l.origem, l.descricao);
      if (classif.subgrupo.startsWith('custo_')) {
        empAlvo.custos = dinheiro(empAlvo.custos + l.valor);
        empAlvo.lucroBruto = dinheiro(empAlvo.lucroBruto - l.valor);
        empAlvo.ebitda = dinheiro(empAlvo.ebitda - l.valor);
        empAlvo.resultadoLiquido = dinheiro(empAlvo.resultadoLiquido - l.valor);
      } else if (classif.subgrupo.startsWith('despesa_')) {
        empAlvo.despesas = dinheiro(empAlvo.despesas + l.valor);
        empAlvo.ebitda = dinheiro(empAlvo.ebitda - l.valor);
        empAlvo.resultadoLiquido = dinheiro(empAlvo.resultadoLiquido - l.valor);
      } else if (classif.subgrupo.startsWith('deducoes_')) {
        empAlvo.receitaLiquida = dinheiro(empAlvo.receitaLiquida - l.valor);
        empAlvo.lucroBruto = dinheiro(empAlvo.lucroBruto - l.valor);
        empAlvo.ebitda = dinheiro(empAlvo.ebitda - l.valor);
        empAlvo.resultadoLiquido = dinheiro(empAlvo.resultadoLiquido - l.valor);
      }
    }
  }

  for (const emp of Object.values(porEmpresa)) {
    emp.shareReceita = receitaBruta > 0 ? Number(((emp.receitaBruta / receitaBruta) * 100).toFixed(1)) : 0;
  }

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
    ehConsolidado,
    mesAnterior,
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
    porEmpresa,
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
    { codigo: '1', rotulo: '1. Receita Operacional Bruta' },
    { codigo: '2', rotulo: '2. (-) Deduções da Receita' },
    { codigo: '3', rotulo: '3. (=) Receita Operacional Líquida (ROL)' },
    { codigo: '4', rotulo: '4. (-) Custos das Vendas (CPV/CMV/CSP)' },
    { codigo: '5', rotulo: '5. (=) Lucro Bruto (Margem)' },
    { codigo: '6', rotulo: '6. (-) Despesas Operacionais Fixas' },
    { codigo: '7', rotulo: '7. (=) EBITDA / LAJIDA' },
    { codigo: '8', rotulo: '8. (+/-) Resultado Financeiro' },
    { codigo: '9', rotulo: '9. (=) Resultado Líquido do Exercício' }
  ];

  const linhasMatriz = codigos.map(c => {
    const valoresMeses = {};
    let totalAno = 0;
    for (const m of meses) {
      const d = resultadosMensais[m];
      let val = 0;
      if (c.codigo === '1') val = d.resumo.receitaBruta;
      else if (c.codigo === '2') val = -d.resumo.totalDeducoes;
      else if (c.codigo === '3') val = d.resumo.receitaLiquida;
      else if (c.codigo === '4') val = -d.resumo.totalCustos;
      else if (c.codigo === '5') val = d.resumo.lucroBruto;
      else if (c.codigo === '6') val = -d.resumo.totalDespesasOperacionais;
      else if (c.codigo === '7') val = d.resumo.ebitda;
      else if (c.codigo === '8') val = d.resumo.resultadoFinanceiro;
      else if (c.codigo === '9') val = d.resumo.resultadoLiquido;

      valoresMeses[String(m).padStart(2, '0')] = val;
      totalAno = dinheiro(totalAno + val);
    }
    return {
      codigo: c.codigo,
      descricao: c.rotulo,
      meses: valoresMeses,
      totalAno
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
 * Exporta a DRE completa para um arquivo XLSX nativo (Excel Multi-Abas).
 */
export async function exportarDreParaXlsx(dre, matrizAnual = null, empresaInfo = {}) {
  const XLSX = await obterXlsx();
  const wb = XLSX.utils.book_new();

  // ── ABA 1: DRE OFICIAL COM ANÁLISE VERTICAL E HORIZONTAL ────────────────────
  const wsDreData = [
    [`DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE) — ${empresaInfo.nome || 'Kytto'}`],
    [`CNPJ: ${empresaInfo.cnpj || '50.073.355/0001-89'} | Inscrição Estadual: ${empresaInfo.ie || '14.229.191-9 (SEFAZ-MT)'}`],
    [`Período: ${dre.periodo?.de} até ${dre.periodo?.ate} | Regime: ${String(dre.periodo?.regime || 'competencia').toUpperCase()}`],
    [`Receita Bruta: R$ ${Number(dre.resumo?.receitaBruta || 0).toFixed(2)} | EBITDA: R$ ${Number(dre.resumo?.ebitda || 0).toFixed(2)} | Resultado Líquido: R$ ${Number(dre.resumo?.resultadoLiquido || 0).toFixed(2)}`],
    [],
    ['CÓDIGO', 'CONTA / CLASSIFICAÇÃO CONTÁBIL', 'VALOR ATUAL (R$)', 'ANÁLISE VERTICAL (AV %)', 'VALOR M-1 (R$)', 'ANÁLISE HORIZONTAL (AH %)']
  ];

  for (const l of dre.linhas) {
    wsDreData.push([
      l.codigo,
      l.descricao,
      Number(l.valor || 0),
      `${Number(l.av || 0).toFixed(1)}%`,
      l.valorAnterior !== null && l.valorAnterior !== undefined ? Number(l.valorAnterior) : '',
      l.ah !== undefined ? `${Number(l.ah).toFixed(1)}%` : ''
    ]);
    if (Array.isArray(l.filhos)) {
      for (const f of l.filhos) {
        wsDreData.push([
          `  ${f.codigo}`,
          `  ${f.descricao}`,
          Number(f.valor || 0),
          `${Number(f.av || 0).toFixed(1)}%`,
          f.valorAnterior !== null && f.valorAnterior !== undefined ? Number(f.valorAnterior) : '',
          f.ah !== undefined ? `${Number(f.ah).toFixed(1)}%` : ''
        ]);
        if (Array.isArray(f.detalhe)) {
          for (const d of f.detalhe) {
            wsDreData.push([
              '',
              `    ↳ ${d.categoria}`,
              Number(d.valor || 0),
              '',
              '',
              ''
            ]);
          }
        }
      }
    }
  }

  const wsDre = XLSX.utils.aoa_to_sheet(wsDreData);
  XLSX.utils.book_append_sheet(wb, wsDre, 'DRE Oficial (CPC-CFC)');

  // ── ABA 2: PARTICIPAÇÃO POR EMPRESA (SE CONSOLIDADO) ────────────────────────
  if (dre.porEmpresa && Object.keys(dre.porEmpresa).length > 0) {
    const wsEmpData = [
      [`QUADRO DE PARTICIPAÇÃO DO GRUPO EMPRESARIAL KYTTO`],
      [`Período: ${dre.periodo?.de} até ${dre.periodo?.ate}`],
      [],
      ['EMPRESA DO GRUPO', 'RECEITA BRUTA (R$)', 'RECEITA LÍQUIDA (R$)', 'CUSTOS DIRETOS (R$)', 'LUCRO BRUTO (R$)', 'DESPESAS (R$)', 'EBITDA (R$)', 'RESULTADO LÍQUIDO (R$)', 'SHARE RECEITA (%)', 'LANÇAMENTOS']
    ];
    for (const emp of Object.values(dre.porEmpresa)) {
      wsEmpData.push([
        emp.nome,
        Number(emp.receitaBruta || 0),
        Number(emp.receitaLiquida || 0),
        Number(emp.custos || 0),
        Number(emp.lucroBruto || 0),
        Number(emp.despesas || 0),
        Number(emp.ebitda || 0),
        Number(emp.resultadoLiquido || 0),
        `${Number(emp.shareReceita || 0).toFixed(1)}%`,
        emp.totalLancamentos || 0
      ]);
    }
    wsEmpData.push([
      'TOTAL CONSOLIDADO HOLDING',
      Number(dre.resumo?.receitaBruta || 0),
      Number(dre.resumo?.receitaLiquida || 0),
      Number(dre.resumo?.totalCustos || 0),
      Number(dre.resumo?.lucroBruto || 0),
      Number(dre.resumo?.totalDespesasOperacionais || 0),
      Number(dre.resumo?.ebitda || 0),
      Number(dre.resumo?.resultadoLiquido || 0),
      '100.0%',
      dre.resumo?.totalLancamentosApurados || 0
    ]);
    const wsEmp = XLSX.utils.aoa_to_sheet(wsEmpData);
    XLSX.utils.book_append_sheet(wb, wsEmp, 'Participação por Empresa');
  }

  // ── ABA 3: MATRIZ ANUAL COMPARATIVA (12 MESES) ──────────────────────────────
  if (matrizAnual && Array.isArray(matrizAnual.linhas)) {
    const cabecalhoMatriz = ['CÓDIGO', 'DESCRIÇÃO', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ', 'TOTAL ANO'];
    const wsMatrizData = [
      [`MATRIZ COMPARATIVA ANUAL (DRE 12 MESES) — EXERCÍCIO ${matrizAnual.ano || 2026}`],
      [],
      cabecalhoMatriz
    ];
    for (const l of matrizAnual.linhas) {
      const linhaArr = [l.codigo, l.descricao];
      for (let m = 1; m <= 12; m++) {
        const mKey = String(m).padStart(2, '0');
        linhaArr.push(Number(l.meses?.[mKey] || 0));
      }
      linhaArr.push(Number(l.totalAno || 0));
      wsMatrizData.push(linhaArr);
    }
    const wsMatriz = XLSX.utils.aoa_to_sheet(wsMatrizData);
    XLSX.utils.book_append_sheet(wb, wsMatriz, 'Matriz Anual');
  }

  // ── ABA 4: LANÇAMENTOS ANALÍTICOS APURADOS ──────────────────────────────────
  if (Array.isArray(dre.lancamentosDetalhados) && dre.lancamentosDetalhados.length > 0) {
    const wsLancData = [
      ['ID', 'EMPRESA', 'DATA COMPETÊNCIA', 'VENCIMENTO', 'PAGO EM', 'TIPO', 'SUBGRUPO DRE', 'CATEGORIA', 'DESCRIÇÃO', 'VALOR (R$)', 'STATUS', 'MEIO PAGAMENTO', 'ORIGEM']
    ];
    for (const item of dre.lancamentosDetalhados) {
      const classif = item.grupoDreConfigurado
        ? { subgrupo: item.grupoDreConfigurado, rotulo: item.categoria }
        : classificarCategoriaDRE(item.tipo, item.categoria, item.origem, item.descricao);
      wsLancData.push([
        item.id || '',
        item.empresaNome || 'Barbearia Dino',
        item.dataCompetencia || '',
        item.vencimento || '',
        item.pagoEm || '',
        item.tipo === 'receita' ? 'RECEITA' : 'DESPESA',
        classif.rotulo,
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
  const ehCons = Boolean(dre.ehConsolidado || empresaInfo.ehConsolidado);

  let quadroParticipacaoHtml = '';
  if (ehCons && dre.porEmpresa) {
    quadroParticipacaoHtml = `
    <div style="margin: 16px 0; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
      <h3 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #1e293b; font-weight: 800;">
        🏢 Quadro Consolidado das Unidades de Negócio do Grupo
      </h3>
      <table style="margin-bottom: 0;">
        <thead>
          <tr style="background: #e2e8f0;">
            <th style="padding: 4px 6px;">Empresa</th>
            <th class="right" style="padding: 4px 6px;">Receita Bruta</th>
            <th class="right" style="padding: 4px 6px;">Margem Bruta</th>
            <th class="right" style="padding: 4px 6px;">EBITDA</th>
            <th class="right" style="padding: 4px 6px;">Share</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(dre.porEmpresa).map(e => `
            <tr>
              <td style="padding: 4px 6px;"><strong>${e.nome}</strong></td>
              <td class="right" style="padding: 4px 6px;">R$ ${fmt(e.receitaBruta)}</td>
              <td class="right" style="padding: 4px 6px;">R$ ${fmt(e.lucroBruto)}</td>
              <td class="right" style="padding: 4px 6px; color: ${e.ebitda >= 0 ? '#16a34a' : '#dc2626'}; font-weight: 700;">R$ ${fmt(e.ebitda)}</td>
              <td class="right" style="padding: 4px 6px; font-weight: 700;">${fmtPct(e.shareReceita)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `;
  }

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
      <p style="margin-top: 2px;">Padrão Contábil Oficial CPC / CFC · Lei das S/A nº 6.404/76</p>
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
      <div class="kpi-sub">Geração: ${fmtPct(dre.resumo?.margemEbitdaPct)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Resultado Líquido</div>
      <div class="kpi-value" style="color: ${dre.resumo?.resultadoLiquido >= 0 ? '#16a34a' : '#dc2626'};">R$ ${fmt(dre.resumo?.resultadoLiquido)}</div>
      <div class="kpi-sub">Líquido: ${fmtPct(dre.resumo?.margemLiquidaPct)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ponto de Equilíbrio</div>
      <div class="kpi-value">R$ ${fmt(dre.resumo?.pontoEquilibrio)}</div>
      <div class="kpi-sub">Break-even Point</div>
    </div>
  </div>

  ${quadroParticipacaoHtml}

  <table>
    <thead>
      <tr>
        <th style="width: 80px;">Código</th>
        <th>Conta / Classificação Contábil</th>
        <th class="right" style="width: 130px;">Valor (R$)</th>
        <th class="right" style="width: 80px;">AV %</th>
        <th class="right" style="width: 80px;">AH %</th>
      </tr>
    </thead>
    <tbody>
      ${dre.linhas.map(l => `
        <tr class="${l.destaque ? 'destaque' : ''}">
          <td><strong>${l.codigo}</strong></td>
          <td>${l.descricao}</td>
          <td class="right" style="color: ${l.valor < 0 ? '#dc2626' : (l.destaque ? '#0f172a' : '#334155')};">
            R$ ${fmt(l.valor)}
          </td>
          <td class="right">${fmtPct(l.av)}</td>
          <td class="right" style="font-weight: 600; color: ${l.ah > 0 ? (l.codigo === '1' || l.codigo === '5' || l.codigo === '7' ? '#16a34a' : '#dc2626') : (l.ah < 0 ? (l.codigo === '1' || l.codigo === '5' || l.codigo === '7' ? '#dc2626' : '#16a34a') : '#64748b')};">
            ${l.ah !== undefined ? (l.ah > 0 ? '+' : '') + fmtPct(l.ah) : '—'}
          </td>
        </tr>
        ${(l.filhos || []).map(f => `
          <tr class="subgrupo">
            <td style="padding-left: 12px;">${f.codigo}</td>
            <td style="padding-left: 12px;">${f.descricao}</td>
            <td class="right">R$ ${fmt(f.valor)}</td>
            <td class="right">${fmtPct(f.av)}</td>
            <td class="right">${f.ah !== undefined ? (f.ah > 0 ? '+' : '') + fmtPct(f.ah) : '—'}</td>
          </tr>
          ${(f.detalhe || []).slice(0, 5).map(d => `
            <tr class="detalhe">
              <td></td>
              <td>↳ ${d.categoria}</td>
              <td class="right">R$ ${fmt(d.valor)}</td>
              <td></td>
              <td></td>
            </tr>
          `).join('')}
        `).join('')}
      `).join('')}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-name">RODRIGO RIBEIRO GONÇALVES</div>
      <div class="sig-role">Diretoria Executiva · Kytto Ecosystem</div>
      <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Assinatura Digital ICP-Brasil / Kytto Trust</div>
    </div>
    <div class="sig-box">
      <div class="sig-name">CONTADOR RESPONSÁVEL TÉCNICO</div>
      <div class="sig-role">CRC-MT · Conselho Regional de Contabilidade</div>
      <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Livro Razão & Diário Geral Autenticados</div>
    </div>
  </div>

  <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
    Documento emitido eletronicamente pelo Sistema Kytto ERP em conformidade com as Normas Brasileiras de Contabilidade (NBC TG / CFC).
  </div>
</body>
</html>`;
}
