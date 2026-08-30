-- Remapeia o storefront público existente para a empresa real da loja.
-- A operação é deliberadamente conservadora: mantém o mesmo empresa_id para
-- preservar pedidos, pagamentos, estoque e memberships; apenas corrige os
-- dados cadastrais do tenant que já possui o domínio verificado.
DO $$
DECLARE
  domain_empresa_id UUID;
  domain_storefront_id UUID;
  domain_loja_id UUID;
  target_empresa_id UUID;
BEGIN
  SELECT s.empresa_id, s.id, s.loja_id
    INTO domain_empresa_id, domain_storefront_id, domain_loja_id
    FROM commerce_store_domains d
    JOIN commerce_storefronts s
      ON s.empresa_id = d.empresa_id AND s.id = d.storefront_id
   WHERE lower(d.dominio) = 'loja.kytto.com.br'
   ORDER BY d.verificado_em DESC NULLS LAST, d.criado_em ASC
   LIMIT 1;

  IF domain_empresa_id IS NULL THEN
    RAISE NOTICE 'Domínio loja.kytto.com.br ainda não possui storefront; nenhuma alteração cadastral foi feita.';
    RETURN;
  END IF;

  SELECT id
    INTO target_empresa_id
    FROM empresas
   WHERE cnpj = '43084070000188'
   LIMIT 1;

  IF target_empresa_id IS NOT NULL AND target_empresa_id <> domain_empresa_id THEN
    RAISE EXCEPTION 'A empresa AGRO OPEN TTC já existe em outro tenant (%); remapeamento cruzado bloqueado para preservar isolamento.', target_empresa_id;
  END IF;

  UPDATE empresas
     SET nome = 'AGRO OPEN TTC',
         cnpj = '43084070000188',
         razao_social = 'AGRO OPEN TTC',
         website = COALESCE(NULLIF(website, ''), 'https://loja.kytto.com.br'),
         ativa = true,
         data_atualizacao = CURRENT_TIMESTAMP
   WHERE id = domain_empresa_id;

  IF domain_loja_id IS NOT NULL THEN
    UPDATE lojas
       SET nome = 'Loja Web - AGRO OPEN TTC',
           nome_fantasia = 'AGRO OPEN TTC',
           data_atualizacao = CURRENT_TIMESTAMP
     WHERE empresa_id = domain_empresa_id AND id = domain_loja_id;
  END IF;

  UPDATE commerce_storefronts
     SET nome = 'Loja Web - AGRO OPEN TTC',
         configuracoes = COALESCE(configuracoes, '{}'::jsonb) || jsonb_build_object(
           'empresaNome', 'AGRO OPEN TTC',
           'cnpj', '43084070000188',
           'publicDomain', 'loja.kytto.com.br'
         ),
         atualizado_em = CURRENT_TIMESTAMP
   WHERE empresa_id = domain_empresa_id AND id = domain_storefront_id;

  UPDATE commerce_store_domains
     SET principal = true
   WHERE empresa_id = domain_empresa_id AND storefront_id = domain_storefront_id AND lower(dominio) = 'loja.kytto.com.br';

  RAISE NOTICE 'Tenant %, storefront % e unidade % vinculados aos dados AGRO OPEN TTC.', domain_empresa_id, domain_storefront_id, domain_loja_id;
END $$;
