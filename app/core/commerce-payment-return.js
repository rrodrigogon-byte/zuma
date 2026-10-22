// O /links da InfinitePay documenta apenas a URL. Na volta do checkout, o
// slug chega pela primeira vez. Só a tentativa única ainda pendente e gerada
// por /links para o MESMO pedido/tenant pode ser candidata ao payment_check.
// A consulta oficial ao provedor decide se houve pagamento; este SELECT não
// autoriza nenhuma transição financeira.
export const publicInfinitepayPaymentLookupSql = `
  SELECT p.id
    FROM commerce_payments p
   WHERE p.empresa_id = $1 AND p.order_id = $2 AND p.provider = 'infinitepay'
     AND (p.provider_payment_id = $3 OR
          (p.provider_payment_id IS NULL AND p.status = 'pending' AND p.payment_account_id IS NOT NULL
           AND p.metadata->'checkout'->>'orderNsu' = $5
           AND (p.metadata->'checkout'->>'url' LIKE 'https://checkout.infinitepay.io/%'
             OR p.metadata->'checkout'->>'url' LIKE 'https://checkout.infinitepay.com.br/%')
           AND (p.metadata->'checkout'->>'slug' = $4 OR p.metadata->'checkout'->>'slug' IS NULL)))
   LIMIT 2`;

export const infinitepayWebhookUnboundOwnerSql = `
  SELECT p.id AS payment_id, p.empresa_id, p.payment_account_id, p.amount, p.method,
         p.provider_payment_id, o.public_code AS order_code, o.storefront_id,
         s.loja_id, a.secret_ref, a.public_config
    FROM commerce_payments p
    JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
    JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id AND s.status = 'active'
    JOIN commerce_payment_accounts a ON a.empresa_id = p.empresa_id AND a.id = p.payment_account_id
      AND a.storefront_id = o.storefront_id AND a.ativo = true AND a.ambiente = 'production'
   WHERE p.provider = 'infinitepay' AND p.provider_payment_id IS NULL
     AND (o.public_code = $1 OR o.id::text = $1)
     AND p.status = 'pending' AND p.payment_account_id IS NOT NULL
     AND p.metadata->'checkout'->>'orderNsu' = o.public_code
     AND (p.metadata->'checkout'->>'url' LIKE 'https://checkout.infinitepay.io/%'
       OR p.metadata->'checkout'->>'url' LIKE 'https://checkout.infinitepay.com.br/%')
     AND (p.metadata->'checkout'->>'slug' = $2 OR p.metadata->'checkout'->>'slug' IS NULL)
   LIMIT 2`;

// Se já houver um pagamento vinculado ao mesmo pedido, um webhook de outra
// transação precisa ser verificado pela conta correta e registrado para revisão,
// mas jamais pode substituir o provider_payment_id já capturado.
export const infinitepayWebhookDuplicateOwnerSql = `
  SELECT p.id AS payment_id, p.empresa_id, p.payment_account_id, p.amount, p.method,
         p.provider_payment_id, o.public_code AS order_code, o.storefront_id,
         s.loja_id, a.secret_ref, a.public_config,
         true AS possible_duplicate
    FROM commerce_payments p
    JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
    JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id AND s.status = 'active'
    JOIN commerce_payment_accounts a ON a.empresa_id = p.empresa_id AND a.id = p.payment_account_id
      AND a.storefront_id = o.storefront_id AND a.ativo = true AND a.ambiente = 'production'
   WHERE p.provider = 'infinitepay' AND p.provider_payment_id IS NOT NULL
     AND p.provider_payment_id <> $2 AND p.status IN ('pending','authorized','captured')
     AND o.public_code = $1 AND p.payment_account_id IS NOT NULL
   LIMIT 2`;
