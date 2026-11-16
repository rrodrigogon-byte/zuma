import crypto from 'node:crypto';
/**
 * SEED E SINCRONIZAÇÃO AUTOMÁTICA DO CATÁLOGO DE SERVIÇOS & PERFUMARIA — BARBEARIA DINO
 * Garante que serviços (Corte, Barba, Combo) e produtos de revenda (Pomadas, Óleos, Perfumes)
 * estejam sempre disponíveis para comandas físicas, PDV balcão, agendamento e comissões.
 */

import { estadoEmpresa } from './barbearia-erp-kytto.js';
import { db as getDbRoot, save } from './db.js';


export function idParaUuid(id) {
  if (!id) return '00000000-0000-4000-8000-000000000000';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id))) {
    return String(id).toLowerCase();
  }
  const hash = crypto.createHash('md5').update(String(id)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export const DINO_EMPRESA_CANONICA = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

export const SERVICOS_DINO_OFICIAIS = [
  {
    id: 'srv-dino-corte-001',
    nome: 'Corte Masculino Dino',
    preco: 90.0,
    duracaoMin: 45,
    categoria: 'Cabelo',
    descricao: 'Corte tradicional ou degradê na tesoura e máquina, com lavagem e finalização com pomada matte.',
    comissaoPercentualPadrao: 40,
    ativo: true,
  },
  {
    id: 'srv-dino-barba-002',
    nome: 'Barba Terapia Tradicional & Navalha',
    preco: 60.0,
    duracaoMin: 30,
    categoria: 'Barba',
    descricao: 'Toalha quente com óleos essenciais, massagem facial, alinhamento na navalha e balm hidratante.',
    comissaoPercentualPadrao: 40,
    ativo: true,
  },
  {
    id: 'srv-dino-combo-003',
    nome: 'Combo Corte & Barba Premium',
    preco: 140.0,
    duracaoMin: 60,
    categoria: 'Combo',
    descricao: 'Experiência completa Dino: corte personalizado + barba terapia com toalha quente e desconto exclusivo.',
    comissaoPercentualPadrao: 40,
    ativo: true,
  },
  {
    id: 'srv-dino-camuflagem-004',
    nome: 'Camuflagem / Pigmentação de Barba ou Cabelo',
    preco: 50.0,
    duracaoMin: 30,
    categoria: 'Química',
    descricao: 'Correção sutil de falhas e disfarce de fios brancos com efeito natural e duradouro.',
    comissaoPercentualPadrao: 40,
    ativo: true,
  },
  {
    id: 'srv-dino-sobrancelha-005',
    nome: 'Sobrancelha na Pinça & Navalha',
    preco: 30.0,
    duracaoMin: 15,
    categoria: 'Estética',
    descricao: 'Design e alinhamento anatômico da sobrancelha masculina.',
    comissaoPercentualPadrao: 40,
    ativo: true,
  },
  {
    id: 'srv-dino-selagem-006',
    nome: 'Selagem Capilar Masculina',
    preco: 120.0,
    duracaoMin: 60,
    categoria: 'Química',
    descricao: 'Alinhamento dos fios, redução de volume e hidratação profunda dos cabelos.',
    comissaoPercentualPadrao: 40,
    ativo: true,
  },
  {
    id: 'srv-dino-hidratacao-007',
    nome: 'Tratamento Capilar & Hidratação de Barba',
    preco: 70.0,
    duracaoMin: 30,
    categoria: 'Tratamento',
    descricao: 'Nutrição profunda com máscara reconstrutora e vapor de ozônio.',
    comissaoPercentualPadrao: 40,
    ativo: true,
  },
  {
    id: 'srv-dino-penteado-008',
    nome: 'Penteado & Finalização com Pomada',
    preco: 40.0,
    duracaoMin: 20,
    categoria: 'Finalização',
    descricao: 'Lavagem com shampoo refrescante e penteado modelado com pomada efeito matte.',
    comissaoPercentualPadrao: 40,
    ativo: true,
  },
];

export const PRODUTOS_DINO_OFICIAIS = [
  {
    id: 'prod-dino-pomada-001',
    codigoInterno: 'POM-MATTE-150G',
    codigoBarras: '7898901234561',
    nome: 'Pomada Modeladora Efeito Matte Dino (150g)',
    precoVenda: 45.0,
    custoMedio: 18.0,
    estoqueMinimo: 10,
    estoqueAtual: 40,
    categoria: 'Modelador',
    comissaoPercentualVenda: 10,
    ativo: true,
  },
  {
    id: 'prod-dino-oleo-002',
    codigoInterno: 'OLEO-BARBA-30ML',
    codigoBarras: '7898901234562',
    nome: 'Óleo Hidratante para Barba Dino (30ml)',
    precoVenda: 38.0,
    custoMedio: 14.0,
    estoqueMinimo: 8,
    estoqueAtual: 30,
    categoria: 'Barba',
    comissaoPercentualVenda: 10,
    ativo: true,
  },
  {
    id: 'prod-dino-shampoo-003',
    codigoInterno: 'SHAMP-FORT-250ML',
    codigoBarras: '7898901234563',
    nome: 'Shampoo Anticaspa & Fortalecedor Dino (250ml)',
    precoVenda: 42.0,
    custoMedio: 16.0,
    estoqueMinimo: 8,
    estoqueAtual: 25,
    categoria: 'Cabelo',
    comissaoPercentualVenda: 10,
    ativo: true,
  },
  {
    id: 'prod-dino-balm-004',
    codigoInterno: 'BALM-BARBA-100G',
    codigoBarras: '7898901234564',
    nome: 'Balm Modelador de Barba Dino (100g)',
    precoVenda: 35.0,
    custoMedio: 12.0,
    estoqueMinimo: 10,
    estoqueAtual: 35,
    categoria: 'Barba',
    comissaoPercentualVenda: 10,
    ativo: true,
  },
  {
    id: 'prod-dino-perf-asad-005',
    codigoInterno: 'PERF-ASAD-10ML',
    codigoBarras: '7898901234565',
    nome: 'Perfume Árabe Asad Lattafa (Decant 10ml)',
    precoVenda: 75.0,
    custoMedio: 32.0,
    estoqueMinimo: 5,
    estoqueAtual: 20,
    categoria: 'Perfumaria',
    comissaoPercentualVenda: 10,
    ativo: true,
  },
  {
    id: 'prod-dino-perf-cdnim-006',
    codigoInterno: 'PERF-CDNIM-10ML',
    codigoBarras: '7898901234566',
    nome: 'Perfume Club de Nuit Intense Man (Decant 10ml)',
    precoVenda: 85.0,
    custoMedio: 36.0,
    estoqueMinimo: 5,
    estoqueAtual: 20,
    categoria: 'Perfumaria',
    comissaoPercentualVenda: 10,
    ativo: true,
  },
];

/**
 * Provisiona e atualiza o catálogo canônico da Barbearia Dino de forma idempotente
 */
export function provisionarCatalogoDino({
  empresaId = DINO_EMPRESA_CANONICA,
  commerceDb = null,
} = {}) {
  const estado = estadoEmpresa(empresaId);
  estado.servicos ||= {};
  estado.produtosRevenda ||= {};
  estado.profissionais ||= {};

  let servicosAtualizados = 0;
  let produtosAtualizados = 0;

  // 1. Sincronizar Serviços
  for (const srv of SERVICOS_DINO_OFICIAIS) {
    if (!estado.servicos[srv.id]) {
      estado.servicos[srv.id] = { ...srv, empresaId };
      servicosAtualizados++;
    } else {
      // Atualiza valores preservando histórico
      Object.assign(estado.servicos[srv.id], {
        empresaId,
        nome: srv.nome,
        preco: srv.preco,
        duracaoMin: srv.duracaoMin,
        categoria: srv.categoria,
        ativo: srv.ativo,
      });
    }
  }

  // 2. Sincronizar Produtos de Revenda / Estoque
  for (const prod of PRODUTOS_DINO_OFICIAIS) {
    if (!estado.produtosRevenda[prod.id]) {
      estado.produtosRevenda[prod.id] = { ...prod, empresaId };
      produtosAtualizados++;
    } else {
      // Atualiza preços e dados cadastrais sem zerar estoque se já alterado
      const atual = estado.produtosRevenda[prod.id];
      Object.assign(atual, {
        empresaId,
        nome: prod.nome,
        precoVenda: prod.precoVenda,
        custoMedio: prod.custoMedio,
        codigoInterno: prod.codigoInterno,
        codigoBarras: prod.codigoBarras,
        categoria: prod.categoria,
        ativo: prod.ativo,
        estoqueAtual: typeof atual.estoqueAtual === 'number' ? atual.estoqueAtual : prod.estoqueAtual,
      });
    }
  }

  // 3. Unificar Profissionais Duplicados (Natani -> Nati)
  for (const [id, prof] of Object.entries(estado.profissionais)) {
    const nomeNormalizado = String(prof?.nome || '').toLowerCase().trim();
    if (nomeNormalizado === 'natani' && id !== 'prof-mtj6b9fg-003') {
      prof.ativo = false;
      prof.observacao = 'Unificado com Nati (prof-mtj6b9fg-003)';
    }
    // Garante Nati ativa
    if (prof?.nome === 'Nati' || id === 'prof-mtj6b9fg-003') {
      prof.ativo = true;
      prof.nome = 'Nati';
    }
  }

  save();

  // 4. Sincronização opcional com PostgreSQL
  if (commerceDb && typeof commerceDb.query === 'function') {
    (async () => {
      try {
        // Obter uma categoria padrão para satisfazer a constraint not-null de categoria_id
        const catRes = await commerceDb.query(`SELECT id FROM categorias LIMIT 1`).catch(() => null);
        const catId = catRes?.rows?.[0]?.id || null;
        for (const p of PRODUTOS_DINO_OFICIAIS) {
          if (!catId) continue;
          await commerceDb.query(
            `INSERT INTO produtos (id, empresa_id, categoria_id, nome, preco_venda, preco_custo, codigo_interno, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             ON CONFLICT (id) DO UPDATE SET 
               nome = EXCLUDED.nome,
               preco_venda = EXCLUDED.preco_venda,
               preco_custo = EXCLUDED.preco_custo,
               ativo = true;`,
            [idParaUuid(p.id), empresaId, catId, p.nome, p.precoVenda, p.custoMedio, p.id || p.codigoInterno]
          ).catch(() => null);
        }
      } catch (e) {
        console.warn('[Catalogo Seed] Erro Postgres:', e.message);
      }
    })();
  }

  return {
    ok: true,
    totalServicos: Object.keys(estado.servicos).length,
    totalProdutos: Object.keys(estado.produtosRevenda).length,
    servicosAtualizados,
    produtosAtualizados,
  };
}
