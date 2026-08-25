# Kytto Commerce — Arquitetura completa para clientes

## Objetivo

O objetivo é transformar o ecossistema Kytto/SetPoint em uma plataforma comercial multiempresa, capaz de entregar a cada cliente uma operação própria de comércio digital e presencial. A solução deverá oferecer vitrine pública, catálogo, carrinho, checkout, pagamentos, pedidos, estoque, logística, relacionamento, relatórios e um backoffice completo, com isolamento por empresa e por unidade.

A definição de “completo” adotada neste documento não significa apenas disponibilizar uma página de produtos. Cada cliente deverá conseguir cadastrar e editar itens, categorias, variações, imagens, preços, promoções, estoque, usuários, permissões, pedidos, clientes, formas de entrega, cupons e configurações da própria loja, sem acesso aos dados de outras empresas.

## Diagnóstico do sistema atual

O repositório `agro-open` já possui uma base operacional ampla. O frontend contém uma vitrine em `web/src/pages/public/Loja.jsx`, com filtro de categorias, carrinho em memória, checkout básico e geração de informação PIX. O backend possui rotas públicas de loja e pedidos, rotas administrativas de produtos, estoque, compras, pagamentos, clientes e relatórios, além de módulos específicos para restaurante, supermercado, varejo, reservas, PDV e emissão fiscal.

Há, porém, uma diferença entre essa base operacional e um produto comercial multiempresa pronto para clientes. O servidor principal ainda importa `app/db.js`, cujo armazenamento é um arquivo JSON local com replicação opcional para Google Cloud Storage. O próprio módulo registra que o filesystem do contêiner é efêmero e que o modo GCS exige uma única instância para evitar conflitos de escrita. Esse modelo não é adequado como fonte de verdade de um e-commerce multiempresa com concorrência, checkout, estoque reservado, webhooks e pedidos simultâneos.

O projeto também contém adaptadores PostgreSQL em `app/core/database.js` e `app/db-pg.js`, com suporte a pool, transações e filtros por `empresa_id` e `loja_id`. A arquitetura recomendada é aproveitar essa base e migrar o domínio comercial para PostgreSQL, sem apagar de imediato os módulos legados do SetPoint. A migração deve ser incremental, com leitura compatível e auditoria de cada operação.

## Decisão arquitetural

A plataforma será composta por cinco camadas. A primeira é o **storefront público**, responsável pela experiência de compra responsiva, páginas de categoria e produto, busca, filtros, carrinho, checkout e acompanhamento do pedido. A segunda é o **Commerce Core**, responsável por catálogo, preços, estoque, clientes, pedidos, pagamentos, entrega e regras de negócio. A terceira é o **backoffice multiempresa**, usado pelos clientes para administrar a operação. A quarta é a camada de **integrações**, com gateways de pagamento, frete, notificações, fiscal e webhooks. A quinta é a camada de **governança**, com autenticação, RBAC, isolamento por tenant, auditoria, idempotência, observabilidade e backups.

O núcleo comercial deverá usar PostgreSQL como fonte de verdade. O JSON existente poderá continuar sendo lido pelos módulos antigos durante a transição, mas não deverá receber novos pedidos, pagamentos ou movimentações de estoque depois que o Commerce Core entrar em produção. Toda operação crítica deverá ser transacional, especialmente reserva/baixa de estoque, criação de pedido, confirmação de pagamento, cancelamento e estorno.

Para clientes que já operam em Shopify, poderá ser habilitado um adaptador headless. A Storefront API da Shopify oferece primitives para produtos, coleções, carrinho, preços contextuais, busca e planos de venda, enquanto o admin da Shopify permanece responsável pelo backoffice de catálogo, preço, inventário e metafields [1]. O Headless Channel permite criar storefronts distintos e rotacionar credenciais [2]. Entretanto, para o cenário principal da Kytto — vários clientes usando o SetPoint com regras próprias, estoque operacional, PDV, fiscal e permissões por empresa — o Commerce Core próprio em PostgreSQL será a base de referência; Shopify será uma integração opcional, não uma dependência obrigatória.

## Modelo multiempresa

A unidade de isolamento será o `tenant`, representado por uma empresa cliente. Cada tenant poderá ter uma ou várias lojas, canais e locais de estoque. O domínio público, o tema, o catálogo, os preços, os usuários, os pedidos e os relatórios deverão sempre ser resolvidos por `tenant_id` e, quando aplicável, por `loja_id`.

| Entidade | Responsabilidade | Isolamento mínimo |
|---|---|---|
| `tenants` | Empresa cliente, status, plano, dados fiscais e configurações globais | `tenant_id` |
| `stores` | Unidade, canal, endereço, horário e domínio | `tenant_id`, `store_id` |
| `store_domains` | Domínios e subdomínios públicos | `tenant_id`, domínio único |
| `memberships` | Relação entre usuário, empresa, loja e funções | `tenant_id`, `store_id` |
| `products` | Produto base, descrição, status, SEO e fiscal | `tenant_id` |
| `product_variants` | SKU, código de barras, atributos, peso e preço-base | `tenant_id`, `product_id` |
| `inventory_locations` | Loja, depósito, cozinha, balcão ou ponto de retirada | `tenant_id`, `store_id` |
| `inventory_levels` | Saldo disponível, reservado, comprometido e mínimo | `tenant_id`, `location_id`, `variant_id` |
| `customers` | Comprador, consentimentos e histórico da empresa | `tenant_id` |
| `carts` | Carrinho persistente por sessão ou cliente | `tenant_id`, `store_id` |
| `orders` | Pedido, status, totais, endereço e origem | `tenant_id`, `store_id` |
| `payments` | Tentativas, autorização, captura, estorno e webhook | `tenant_id`, `order_id` |
| `fulfillments` | Separação, entrega, retirada, rastreio e ocorrências | `tenant_id`, `order_id` |
| `audit_logs` | Quem fez o quê, quando, de onde e antes/depois | `tenant_id`, usuário |

O backend não deverá aceitar `tenant_id` arbitrário enviado pelo navegador. O tenant efetivo deverá vir da sessão autenticada, do domínio da loja ou de uma relação de membership validada no servidor. Toda query administrativa deverá incluir filtros de empresa e loja derivados do contexto autenticado.

## Funções administrativas

O backoffice deverá implementar RBAC com permissões granulares. As funções iniciais serão `platform_owner`, `tenant_owner`, `store_admin`, `catalog_manager`, `inventory_manager`, `order_operator`, `finance`, `support` e `customer`. A função não será suficiente sozinha: cada permissão deverá ser avaliada junto com o tenant e, quando necessário, com a loja ou local de estoque.

| Área | Capacidades obrigatórias |
|---|---|
| Cadastro de itens | Criar, editar, duplicar, arquivar, importar, exportar e publicar produtos |
| Catálogo | Categorias, coleções, atributos, variações, kits, combos, complementos e disponibilidade por canal |
| Imagens e mídia | Upload seguro, ordenação, alt text, otimização e associação por variação |
| Preços | Preço de venda, custo, preço promocional, listas B2B, vigência e arredondamento |
| Estoque | Saldos por local, entradas, saídas, transferências, inventário, perdas, reservas e alertas |
| Pedidos | Fila operacional, detalhes, alteração de status, cancelamento, devolução, troca, impressão e nota |
| Clientes | Cadastro, endereços, consentimentos, histórico, segmentos e bloqueios antifraude |
| Marketing | Cupons, promoções, regras por categoria, campanhas, banners e códigos de indicação |
| Entrega | Retirada, delivery, faixas de CEP, taxa, prazo, transportadora, rastreio e ocorrências |
| Financeiro | Pagamentos, conciliação, estornos, taxas, repasses e exportação |
| Usuários | Convites, papéis, escopos por loja, MFA, sessão, bloqueio e auditoria |
| Relatórios | Vendas, ticket médio, margem, ruptura, conversão, pedidos, pagamentos e clientes |
| Configurações | Identidade, domínio, horário, impostos, checkout, integrações, notificações e política comercial |

## Ciclo do pedido

O fluxo de pedido será orientado por máquina de estados e eventos idempotentes. Um pedido não deverá ser considerado vendido apenas porque o checkout foi iniciado. O estoque deve ser reservado durante a janela definida pela loja e liberado quando o pagamento expirar, falhar ou o pedido for cancelado.

`draft` → `pending_payment` → `paid` → `processing` → `ready` → `shipped` ou `ready_for_pickup` → `delivered`/`picked_up` → `completed`

Estados de exceção, como `payment_failed`, `cancelled`, `refunded`, `partially_refunded`, `returned` e `fraud_review`, deverão ser auditáveis e não poderão alterar o histórico anterior. Webhooks deverão ser idempotentes por `provider_event_id`, e cada mudança de estado deverá registrar ator, origem, data, payload resumido e correlação da operação.

## Pagamentos e integrações

O core será implementado por adapters, para que o cliente possa escolher o provedor permitido para sua operação. O primeiro adapter brasileiro deverá suportar Pix e cartão por um gateway com webhooks, idempotência e consulta de status. Stripe e Mercado Pago aparecem no repositório como dependências ou rotas administrativas, mas o lançamento comercial exige credenciais reais, conta homologada, URLs de webhook, política de estorno e testes em ambiente separado.

Nenhum segredo de gateway poderá ir para o frontend, para o Git ou para o log. O servidor deverá armazenar apenas referências seguras, usar variáveis protegidas ou secret manager e validar a assinatura de todo webhook. A aplicação não deverá armazenar número completo de cartão, CVV ou dados equivalentes.

As integrações de logística deverão seguir o mesmo contrato: cotar, criar etiqueta quando aplicável, acompanhar rastreio, registrar falha e permitir operação manual. Para restaurantes e negócios locais, a entrega poderá ser delivery próprio, retirada, mesa/comanda ou balcão; para varejo, poderão ser retirada e transportadora; para serviços e SaaS, o fulfillment poderá ser substituído por ativação de contrato ou agenda.

## Storefronts por segmento

O mesmo Commerce Core deverá suportar configurações por setor sem duplicar o domínio. Barbearias poderão vender serviços, produtos e reservas; mercados poderão trabalhar com peso, lote, validade e substituição; lojas poderão usar variações, kits, frete e devolução; restaurantes poderão usar complementos, observações, mesas, retirada e delivery; eventos poderão combinar ingressos, produtos e credenciais. Cada loja poderá habilitar apenas os módulos necessários, mas compartilhará catálogo, cliente, pedido, pagamento, estoque e auditoria coerentes.

## Contratos de API

As rotas públicas deverão resolver a loja por domínio ou identificador público e retornar apenas itens publicados no canal. As rotas administrativas deverão usar sessão autenticada e autorização por tenant. A primeira família de contratos será:

| Grupo | Exemplos |
|---|---|
| Público | `GET /api/storefront/context`, `GET /api/storefront/products`, `GET /api/storefront/categories` |
| Carrinho | `POST /api/storefront/carts`, `PATCH /api/storefront/carts/:id`, `POST /api/storefront/carts/:id/checkout` |
| Cliente | `POST /api/storefront/customers`, `GET /api/account/orders`, `PATCH /api/account/profile` |
| Pedido | `GET /api/orders/:id`, `POST /api/orders/:id/cancel`, `POST /api/orders/:id/return` |
| Admin catálogo | `GET/POST/PATCH/DELETE /api/admin/catalog/products` |
| Admin estoque | `GET/POST /api/admin/inventory/levels`, `/movements`, `/transfers`, `/counts` |
| Admin pedidos | `GET/PATCH /api/admin/orders`, `POST /api/admin/orders/:id/refund` |
| Admin configuração | `/api/admin/store`, `/domains`, `/shipping`, `/payments`, `/users` |
| Webhooks | `POST /api/webhooks/:provider/payments`, `/shipping`, `/commerce` |

Os contratos deverão validar payloads, paginação, ordenação e campos permitidos. Nenhuma rota deverá montar SQL a partir de nome de tabela ou coluna recebido do cliente sem whitelist. Operações críticas deverão receber uma chave de idempotência e retornar o mesmo resultado lógico quando repetidas.

## Implementação do foundation nesta etapa

A branch de trabalho agora contém a primeira camada executável do foundation, sem substituir silenciosamente o runtime legado. A migration `app/migrations/019_commerce_core.sql` cria o schema comercial transacional com contexto de empresa/loja, storefronts e domínios, catálogo com categorias/variações/mídia/canais, listas de preço, locais e saldos de estoque, reservas, clientes, carrinhos, pedidos, eventos, pagamentos, contas de provedor por referência de segredo, webhooks, fulfillment, promoções, idempotência, RBAC e auditoria. As foreign keys compostas mantêm `empresa_id` e o identificador de loja/entidade no mesmo tenant.

A camada `app/core/commerce-core.js` concentra a resolução de contexto, leitura de catálogo publicado, criação de pedido pendente de pagamento, reserva de estoque com `FOR UPDATE`, máquina de estados e eventos/auditoria. As rotas `app/core/commerce-routes.js` expõem contratos `/api/storefront/*` e `/api/admin/commerce/*`, mas só são montadas quando `COMMERCE_CORE_ENABLED=1`. Esse opt-in é deliberado: enquanto o Render não tiver `DATABASE_URL`, migrations aplicadas, memberships válidas, seed de storefront/domínio e checklist de migração, o servidor continua atendendo as rotas legadas de SetPoint e não tenta criar conexões PostgreSQL em produção.

A camada `app/core/payment-adapters.js` define o contrato para gateways sem registrar nenhum provedor fictício. A tentativa de pagamento exige chave de idempotência, conta ativa por loja e referência externa de segredo; a chamada ao provedor ocorre fora da transação SQL e a finalização ocorre em uma segunda transação curta. O router `/api/webhooks/:provider/payments` preserva o corpo bruto para assinatura, exige que o adapter valide o evento, rejeita divergência de valor, grava `provider_event_id` de forma única e só então atualiza pagamento, pedido e reservas. Até que um adapter real seja homologado, a API retorna `PAYMENT_PROVIDER_NOT_CONFIGURED` e não afirma que o pagamento foi concluído.

As consultas de `app/core/commerce-reports.js` entregam vendas, estoque e clientes filtrados pelo tenant e, quando aplicável, pela loja. Os endpoints `/api/admin/commerce/reports/sales`, `/inventory` e `/customers` usam `reports.read` e aceitam somente períodos ISO válidos. Relatórios financeiros, fiscais e de margem dependem de dados reais de preço de custo, conciliação e emissão fiscal; não devem ser preenchidos com números demonstrativos em ambientes de cliente.

No checkout público, `shippingAmount`, `discountAmount` e `taxAmount` enviados pelo navegador são deliberadamente ignorados. O pedido usa o subtotal dos preços vigentes do canal e deixa frete, promoções/cuponagem e impostos em zero até que regras server-side, cálculo de frete e integrações fiscais sejam implementados e homologados. Isso evita que o cliente altere o total por inspeção do frontend.

O storefront `/ecommerce` e o backoffice `/admin/ecommerce` validados nesta etapa são a superfície inicial de experiência e operação sobre as APIs legadas. Eles não devem ser apresentados aos clientes como o Commerce Core completo até que o rollout PostgreSQL substitua o fluxo JSON de pedidos/estoque e os adapters de pagamento/logística sejam homologados.

## Qualidade, segurança e operação

A plataforma deverá ter testes unitários para regras de preço, estoque e estados de pedido; testes de integração para cada adapter de pagamento; testes de autorização entre tenants; testes de webhook repetido; testes de carga para catálogo e checkout; e testes de recuperação para falha de gateway, banco, armazenamento e entrega.

O backoffice deverá registrar trilha de auditoria, exportação de dados do cliente, retenção configurável e mecanismos de exclusão ou anonimização compatíveis com a política da operação. Logs não poderão conter senha, token, cartão, documento completo ou payload de pagamento sem mascaramento. O serviço deverá ter métricas de erro, latência, conversão de checkout, pagamentos pendentes, ruptura e jobs de webhook.

A migração do JSON para PostgreSQL deverá ter backup, validação de contagem, checksum, modo de leitura dupla e rollback. O Cloud Run ou Render não deverá depender de filesystem local para o estado comercial. Imagens e documentos deverão usar object storage; o banco deverá armazenar metadados e chaves, não bytes grandes.

## Dependências para colocar pagamentos reais em produção

A implementação de código pode começar sem credenciais, mas a ativação comercial exige informações que não devem ser inventadas: gateway escolhido por cliente, conta de produção, credenciais de homologação, URLs de webhook, regras de parcelamento, política de frete, origem do estoque, política de troca, dados fiscais e definição de quem é o merchant of record. Esses dados serão configurados no backoffice ou em secret manager, nunca versionados.

## Entrega proposta

A sequência de produção será: primeiro, provisionar PostgreSQL gerenciado e aplicar a migration 019 em homologação; segundo, criar o tenant, lojas, storefront, domínio verificado, roles, memberships, price lists, canais e locais de estoque; terceiro, executar migração/dupla leitura do catálogo e validar contagens, checksums e rollback; quarto, ativar backoffice de catálogo, estoque, clientes e pedidos; quinto, ativar storefront multiempresa e contas; sexto, conectar checkout e adapters de pagamento; sétimo, integrar logística, notificações e relatórios; oitavo, executar testes de segurança, carga e recuperação; nono, ativar cada cliente com checklist e documentação.

A partir desta definição, a camada de foundation foi preparada, mas ainda depende de uma decisão externa de infraestrutura: qual PostgreSQL gerenciado será usado no Render e quais contas/credenciais de gateway e logística cada cliente terá. Só depois de aplicar a migration, popular o contexto de tenant e testar isolamento/transação será permitido ligar `COMMERCE_CORE_ENABLED=1`. Isso evita entregar aos clientes uma vitrine bonita com estoque, pagamento e isolamento de dados incompletos.

## Referências

[1]: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api "Shopify — Building with the Storefront API"
[2]: https://shopify.dev/docs/storefronts/headless/bring-your-own-stack "Shopify — Bring your own headless stack"
[3]: https://shopify.dev/docs/storefronts/headless/getting-started/build-options "Shopify — Options for building headless"
