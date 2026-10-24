// ============================================================================
// Ponte comanda da barbearia ⇄ loja virtual (Commerce)
// Busca produtos da loja da unidade (preço e estoque vigentes) para lançar na
// comanda, e baixa o estoque da loja quando a comanda é faturada.
// Leitura e baixa usam o contexto Commerce verificado (empresa, loja e
// permissão); nada aqui confia em preço ou estoque vindos do navegador.
// ============================================================================

import { db } from './database.js';
import { adjustInventory, CommerceError, withCommerceTransaction } from './commerce-core.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function precoEfetivo(row) {
  const preco = Number(row.preco || 0);
  const promo = Number(row.preco_promocional || 0);
  return promo > 0 && (preco <= 0 || promo < preco) ? promo : preco;
}

export function linhaParaItemLoja(row) {
  const nome = [row.produto, row.variante && row.variante !== row.produto ? row.variante : ''].filter(Boolean).join(' · ');
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    locationId: row.location_id || null,
    nome,
    sku: row.sku || '',
    barcode: row.barcode || '',
    categoria: row.categoria || 'Loja',
    preco: Number(precoEfetivo(row).toFixed(2)),
    precoCheio: Number(Number(row.preco || 0).toFixed(2)),
    disponivel: Number(row.disponivel_local || 0),
    disponivelTotal: Number(row.disponivel_total || 0),
    imagem: row.imagem || null,
  };
}

export const SQL_PRODUTOS_LOJA = `
  SELECT v.id AS variant_id, p.id AS product_id, p.nome AS produto, v.nome AS variante, v.sku, v.barcode,
         c.nome AS categoria, price.preco, price.preco_promocional,
         stock.location_id, COALESCE(stock.disponivel, 0) AS disponivel_local,
         COALESCE(total.disponivel, 0) AS disponivel_total,
         (SELECT m.public_url FROM commerce_product_media m
           WHERE m.empresa_id = p.empresa_id AND m.product_id = p.id
           ORDER BY m.ordem ASC, m.criado_em ASC LIMIT 1) AS imagem
    FROM commerce_product_variants v
    JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
    LEFT JOIN commerce_categories c ON c.empresa_id = p.empresa_id AND c.id = p.category_id
    LEFT JOIN LATERAL (
      SELECT pr.preco, pr.preco_promocional
        FROM commerce_variant_prices pr
        JOIN commerce_product_channels ch
          ON ch.empresa_id = pr.empresa_id AND ch.price_list_id = pr.price_list_id AND ch.product_id = p.id
        JOIN commerce_storefronts s
          ON s.empresa_id = ch.empresa_id AND s.id = ch.storefront_id
         AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)
       WHERE pr.empresa_id = v.empresa_id AND pr.variant_id = v.id
         AND pr.vigencia_inicio <= CURRENT_TIMESTAMP
         AND (pr.vigencia_fim IS NULL OR pr.vigencia_fim > CURRENT_TIMESTAMP)
       ORDER BY pr.vigencia_inicio DESC LIMIT 1
    ) price ON true
    LEFT JOIN LATERAL (
      SELECT il.location_id, il.disponivel
        FROM commerce_inventory_levels il
        JOIN commerce_inventory_locations l
          ON l.empresa_id = il.empresa_id AND l.id = il.location_id AND l.ativo = true
         AND ($2::uuid IS NULL OR l.loja_id = $2 OR l.loja_id IS NULL)
       WHERE il.empresa_id = v.empresa_id AND il.variant_id = v.id
       ORDER BY il.disponivel DESC, il.location_id ASC LIMIT 1
    ) stock ON true
    LEFT JOIN LATERAL (
      SELECT SUM(il.disponivel) AS disponivel
        FROM commerce_inventory_levels il
        JOIN commerce_inventory_locations l
          ON l.empresa_id = il.empresa_id AND l.id = il.location_id AND l.ativo = true
         AND ($2::uuid IS NULL OR l.loja_id = $2 OR l.loja_id IS NULL)
       WHERE il.empresa_id = v.empresa_id AND il.variant_id = v.id
    ) total ON true
   WHERE v.empresa_id = $1 AND v.ativo = true AND p.status = 'active'
     AND ($3::uuid IS NULL OR v.id = $3)
     AND ($4::text = '' OR p.nome ILIKE $5 OR v.nome ILIKE $5 OR v.sku ILIKE $5 OR v.barcode = $4)
   ORDER BY (COALESCE(total.disponivel, 0) > 0) DESC, p.nome ASC, v.sku ASC
   LIMIT $6`;

function escaparLike(valor) {
  return String(valor).replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Produtos da loja da unidade para a busca da comanda (nome, SKU ou código de barras). */
export async function buscarProdutosLoja(context, { q = '', limite = 20, variantId = null } = {}, database = db) {
  if (!context?.empresaId) throw new CommerceError('contexto da loja ausente', 'PERMISSION_DENIED');
  const termo = String(q || '').trim().slice(0, 80);
  if (variantId && !UUID.test(String(variantId))) throw new CommerceError('produto da loja inválido', 'INVALID_ID');
  const lim = Math.max(1, Math.min(50, Math.floor(Number(limite) || 20)));
  const result = await database.query(SQL_PRODUTOS_LOJA, [
    context.empresaId, context.lojaId || null, variantId || null, termo, `%${escaparLike(termo)}%`, lim,
  ]);
  return result.rows.map(linhaParaItemLoja);
}

/** Um produto da loja, conferido no servidor, pronto para entrar na comanda. */
export async function obterProdutoLoja(context, variantId, database = db) {
  const [item] = await buscarProdutosLoja(context, { variantId, limite: 1 }, database);
  if (!item) throw new CommerceError('produto não encontrado na loja desta unidade', 'VARIANT_NOT_FOUND');
  return { ...item, verificadoPeloServidor: true };
}

/** Baixa idempotente do estoque da loja para um item faturado na comanda. */
export async function baixarEstoqueLoja(context, { variantId, locationId, quantidade, chave, observacao = '' }, transacao = withCommerceTransaction) {
  if (!UUID.test(String(variantId || '')) || !UUID.test(String(locationId || ''))) throw new CommerceError('produto ou local de estoque da loja inválido', 'INVALID_ID');
  const q = Math.floor(Number(quantidade));
  if (!Number.isInteger(q) || q < 1) throw new CommerceError('quantidade inválida', 'INVALID_INVENTORY_DELTA');
  return transacao((trx) => adjustInventory(trx, context, {
    locationId, variantId, delta: -q, tipo: 'saida', idempotencyKey: String(chave).slice(0, 180), observacao: String(observacao).slice(0, 500),
  }));
}
