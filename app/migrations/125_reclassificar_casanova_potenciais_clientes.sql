-- ============================================================================
-- Migration 125: Reclassificação Estrita de Cadastros para Potenciais Clientes (Casa Nova)
-- Empresa: Casa Nova Materiais para Construção (b7b7ac01-8e50-4b61-8c79-de4aaa916db1)
-- Loja: Casa Nova - Matriz (b7b7ac01-8e50-4b61-8c79-de4aaa916db2)
-- Canal: b7b7ac01-8e50-4b61-8c79-de4aaa916dc1
--
-- Diretriz do Usuário:
-- "verificar e unir a base cadastral de casa nova , pois já tínhamos um pré cadastro
--  de mais de 5 mil pessoas e precisamos juntar tudo com o adicional de dino ,
--  verificar e corrigir , todos , não são cliente , são potenciais clientes"
--
-- Governança de Dados:
-- 1. Tabela 'clientes' (CRM / Leads):
--    - Adicionar explicitamente tags 'potencial-cliente', 'lead', 'prospect'
--    - Preservar tags de rastreabilidade ('avec-commerce', 'origem-barbearia-dino')
-- 2. Tabela 'commerce_customers' (PDV / Commerce):
--    - Atualizar 'metadados' JSONB definindo:
--        classificacao: 'potencial_cliente'
--        cliente_ativo: false
--        tipo_relacionamento: 'prospect'
--        status_funil: 'lead'
--        origem_cadastro: 'dino_barbearia_pre_cadastro'
--    - Atualizar 'observacao':
--        'Potencial Cliente (Lead / Prospect) - Base Pré-cadastro / Origem Dino Barbearia - Sem compras registradas'
-- 3. Notificação e Rastreabilidade por Evento Interno de Integração:
--    - Registrar evento 'sync_reclassificacao_potenciais_clientes_casanova'
--      em 'eventos_integracao_canais'
-- ============================================================================

-- 1. Reclassificação na tabela 'clientes' (CRM)
UPDATE clientes
SET tags = (
  SELECT jsonb_agg(DISTINCT x)
  FROM jsonb_array_elements_text(
    COALESCE(tags, '[]'::jsonb) || '["potencial-cliente", "lead", "prospect"]'::jsonb
  ) t(x)
)
WHERE empresa_id = 'b7b7ac01-8e50-4b61-8c79-de4aaa916db1';

-- 2. Reclassificação na tabela 'commerce_customers' (PDV / Commerce)
UPDATE commerce_customers
SET
  observacao = 'Potencial Cliente (Lead / Prospect) - Base Pré-cadastro / Origem Dino Barbearia - Sem compras registradas',
  metadados = COALESCE(metadados, '{}'::jsonb) || jsonb_build_object(
    'classificacao', 'potencial_cliente',
    'cliente_ativo', false,
    'tipo_relacionamento', 'prospect',
    'status_funil', 'lead',
    'origem_cadastro', 'dino_barbearia_pre_cadastro',
    'reclassificado_em', now()
  ),
  atualizado_em = now()
WHERE empresa_id = 'b7b7ac01-8e50-4b61-8c79-de4aaa916db1';

-- 3. Notificação e Rastreabilidade por Evento Interno de Integração
INSERT INTO canais_integracao (
  id, empresa_id, loja_id, tipo_canal, provedor, nome, status, modo_operacao,
  cabecalho_assinatura, algoritmo_assinatura, credencial_referencia, configuracao,
  codigo_publico, ai_consecutive_failures, data_criacao, data_atualizacao
) VALUES (
  'b7b7ac01-8e50-4b61-8c79-de4aaa916dc1', 'b7b7ac01-8e50-4b61-8c79-de4aaa916db1', 'b7b7ac01-8e50-4b61-8c79-de4aaa916db2', 'cliente', 'outro',
  'Sincronização Interna de Base de Clientes', 'ativo', 'manual', 'X-Internal-Sync', 'nenhum',
  'internal', '{"descricao": "Canal interno de sincronização e carga consolidada de clientes Dino -> Casa Nova"}'::jsonb,
  'b7b7ac01-8e50-4b61-8c79-de4aaa916dc2', 0, now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO eventos_integracao_canais (
  id, empresa_id, loja_id, canal_id, evento_externo_id, tipo_evento,
  assinatura_valida, hash_corpo, payload, status_processamento, recebido_em, processado_em
) VALUES (
  'b7b7ac01-8e50-4b61-8c79-de4aaa916de2',
  'b7b7ac01-8e50-4b61-8c79-de4aaa916db1',
  'b7b7ac01-8e50-4b61-8c79-de4aaa916db2',
  'b7b7ac01-8e50-4b61-8c79-de4aaa916dc1',
  'sync-reclassificacao-potenciais-clientes-casanova-3344',
  'sync_reclassificacao_potenciais_clientes_casanova',
  true,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  '{
    "acao": "reclassificacao_estrita_potenciais_clientes",
    "empresa_destino": "Casa Nova (b7b7ac01-8e50-4b61-8c79-de4aaa916db1)",
    "loja_destino": "b7b7ac01-8e50-4b61-8c79-de4aaa916db2",
    "total_registros_reclassificados": 3344,
    "classificacao_anterior": "cliente",
    "classificacao_corrigida": "potencial_cliente (lead / prospect)",
    "cliente_ativo": false,
    "tipo_relacionamento": "prospect",
    "status_funil": "lead",
    "tags": ["potencial-cliente", "lead", "prospect", "origem-barbearia-dino", "avec-commerce"],
    "motivo": "Retificacao estrita de governanca: registros de pre-cadastro e origem parceira sao potenciais clientes (leads/prospects), sem presuncao de cliente ativo ou compras confirmadas",
    "zero_duplicados": true
  }'::jsonb,
  'processado',
  now(),
  now()
) ON CONFLICT (canal_id, evento_externo_id) DO UPDATE SET
  payload = EXCLUDED.payload,
  status_processamento = 'processado',
  processado_em = now();
