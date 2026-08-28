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

O storefront `/ecommerce` e o backoffice `/admin/ecommerce` usam uma camada de seleção Core→legado. Quando `COMMERCE_CORE_ENABLED=1` e a sessão possui empresa/loja com membership PostgreSQL, o backoffice consome catálogo, categorias, preços, saldo, pedidos e clientes do Core; quando o namespace Core responde 404, preserva a operação legada. O modo exibido na interface deixa explícito `Core PostgreSQL` ou `Catálogo legado`.

A migration `020_commerce_legacy_import.sql` cria `commerce_legacy_imports`, uma tabela de correspondência por tenant, entidade e chave legada. O script `app/migrations/import-legacy-commerce.js` faz dry-run por padrão, exige `--apply`, `COMMERCE_IMPORT_CONFIRM=IMPORT_LEGACY_TO_COMMERCE`, `DATABASE_URL`/`POSTGRES_URL`/`DB_HOST` e os IDs explícitos de empresa, storefront e local de estoque. Produtos, variantes, preços, publicação, mídia, saldo inicial, clientes e pedidos históricos são importados com hash, retry idempotente e status de pagamento preservado; senhas, cartões, secrets e aprovações de pagamento nunca são migrados.

As migrations `021_commerce_promotions_permissions.sql` e `022_commerce_order_promotions.sql` acrescentam permissões granulares, campanhas, códigos de cupom e vínculo transacional entre pedido e desconto. O checkout Core aceita `promotionCode`, valida o período, limites e tipo no servidor e atualiza o total dentro da mesma transação; o modo legado não recebe desconto implícito.

A ponte `app/core/commerce-identity-bridge.js` resolve o usuário autenticado por e-mail no PostgreSQL e valida a membership, empresa e loja antes de qualquer operação administrativa. Headers de empresa/loja são somente seleção solicitada e nunca substituem a validação server-side. O backoffice já expõe catálogo, categorias, estoque, pedidos, promoções/cupons e relatórios no modo Core, com o badge de origem `Core PostgreSQL` ou `Catálogo legado`.

Enquanto o Core estiver desligado, `/api/admin/commerce/*` responde `404 COMMERCE_CORE_DISABLED` antes do middleware administrativo legado, permitindo fallback determinístico em vez de mascarar a ausência do módulo como erro de autenticação. O storefront e o backoffice continuam funcionando, mas só devem ser apresentados aos clientes como Commerce Core operacional depois que o rollout PostgreSQL, a migração auditada e os adapters de pagamento/logística forem homologados.

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


## Adapter Mercado Pago e condição de ativação

Foi criado `app/core/mercadopago-adapter.js` como adapter opt-in. Ele suporta inicialmente Pix por meio do endpoint de pagamentos, envia `X-Idempotency-Key`, retorna os dados de QR/copia-e-cola quando o provedor responder e valida webhooks com `x-signature`, `x-request-id` e `data.id`. O adapter somente é registrado quando `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` existem no secret manager; sem essas variáveis, o erro permanece `PAYMENT_PROVIDER_NOT_CONFIGURED` e nenhuma chamada externa é realizada.

A ativação real ainda exige uma conta de vendedor, uma aplicação Mercado Pago, credenciais de teste/produção, chave Pix quando aplicável, URL HTTPS de webhook e teste de compra. O sistema não grava token, cartão ou segredo no repositório e não considera um pedido pago pela criação do checkout: a confirmação depende do webhook assinado e da consulta do recurso no provedor.

### Referências oficiais

[1] [Mercado Pago — Envio de pagamentos Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix). A documentação descreve o endpoint `/v1/payments`, `payment_method_id: pix`, dados de pagador e o header obrigatório `X-Idempotency-Key`.

[2] [Mercado Pago — Webhooks](https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks). A documentação descreve `x-signature`, `x-request-id`, `data.id`, validação HMAC, HTTPS e respostas 200/201.

[3] [Mercado Pago — Possíveis erros da API](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/integration-errors). A documentação lista erros de credenciais, idempotência, propriedades, rate limit e conflitos de estado.

[4] [Render — Criar e conectar Postgres](https://render.com/docs/postgresql-creating-connecting). A documentação descreve URLs internas/externas, região do banco e conexão por secret manager.


## Incremento operacional pós-Core — agosto de 2026

O Commerce Core agora possui uma camada administrativa tenant-aware para clientes e endereços. O backoffice pode criar e editar clientes, bloquear contas, listar endereços, definir endereço padrão e remover endereços, sempre com whitelist de campos, validação de email/CEP/UF e auditoria. Documentos pessoais continuam restritos a valores já mascarados; o serviço não recebe ou persiste documento em claro.

A operação de fulfillment foi conectada ao backoffice. Cada loja pode cadastrar métodos de retirada, delivery, transportadora, digital ou serviço, criar um fulfillment pendente para um pedido e avançar o fulfillment somente por transições válidas. Ocorrências são registradas na operação e não há cotação, rastreio ou transportadora fictícios.

A publicação por canal ganhou gestão de domínios com verificação DNS TXT. O domínio é criado como pendente com um desafio exclusivo, exibido apenas para o usuário autenticado com permissão `catalog.publish`. O servidor consulta o TXT antes de preencher `verificado_em`; domínio não verificado não resolve storefront público e não pode ser definido como principal. A migration `023_commerce_domain_verification.sql` adiciona o token de desafio com checksum no executor oficial.

Esses recursos permanecem sujeitos ao mesmo rollout seguro: catálogo público só é exposto após empresa, storefront, preço, domínio e política de publicação serem revisados; pagamentos continuam condicionados à homologação do provedor; logística externa exige contrato, regras e credenciais próprias.


O checkout Core também passou a persistir `shipping_method_id` no pedido por meio da migration `024_commerce_order_shipping.sql`. O método é validado contra o storefront, empresa e status ativo antes da criação; a escolha entra no hash de idempotência. O endpoint público `/api/storefront/shipping-methods` retorna somente métodos ativos do storefront resolvido por domínio verificado. O valor de frete continua calculado apenas por regra server-side homologada e permanece zero até a política comercial ser configurada.


### Camada administrativa de pagamentos e rollout controlado

A operação financeira do Commerce OS foi expandida com endpoints tenant-aware para listar provedores, cadastrar e atualizar contas por storefront, consultar transações mascaradas e iniciar uma tentativa administrativa de Pix. O contrato público de provedores expõe somente código, nome, métodos, existência do adapter e estado de registro; referências de secret, tokens, dados de cartão e valores de webhook nunca são devolvidos ao navegador.

Cada conta exige uma referência no formato `env:VARIAVEL`, storefront ativo, ambiente explícito (`sandbox` ou `production`) e permanece inativa por padrão. A ativação só é aceita quando o adapter está registrado e as referências exigidas estão presentes no secret manager do processo. Para Mercado Pago, isso inclui a referência do access token e a referência do segredo HMAC do webhook. O backoffice apresenta `Aguardando configuração` quando essas condições não são satisfeitas e não oferece uma cobrança simulada.

A tentativa de pagamento exige `accountId` explícito, verifica empresa, loja, pedido, storefront, ambiente, provedor e conta ativa na mesma transação curta e persiste `payment_account_id` por meio da migration `026_commerce_payment_account_link.sql`. A chave de idempotência é específica para cada tentativa; uma tentativa pendente por pedido bloqueia uma segunda cobrança concorrente. O status do pedido só avança para pago depois de webhook validado e consulta ao provedor, nunca apenas pela criação do checkout.

O endpoint público de webhook é montado em `/api/webhooks/:provider/payments` (por exemplo, `/api/webhooks/mercadopago/payments`). A empresa e a conta são resolvidas a partir do `provider_payment_id` armazenado antes da validação HMAC, evitando confiar em tenant enviado pelo payload. Eventos são deduplicados por `(provider, provider_event_id)`, o valor recebido é comparado ao valor persistido e somente estados reconhecidos alteram pagamento, reservas e pedido. A migration 026 é aplicada pelo executor canônico com lock, checksum e comportamento idempotente; pagamentos históricos sem conta vinculada permanecem compatíveis, mas não podem ser usados para iniciar novas cobranças.

A aba **Pagamentos** do backoffice mostra contas ativas, transações persistidas, estados capturados e provedores registrados. Sem credenciais reais no Render, Mercado Pago permanece indisponível, o registro fica inativo e a ação Pix não é exibida como pronta. A homologação exige decisão operacional separada: escolher a conta merchant, inserir os secrets diretamente no secret manager, cadastrar a URL HTTPS no painel do provedor, executar compra sandbox, validar assinatura/idempotência/reconciliação e somente então aprovar eventual ativação de produção.


### Checkout estruturado, cotação por CEP e expedição real

O checkout público do storefront Core agora separa identificação do cliente, endereço de entrega, seleção de método, cotação e pagamento. O CEP é consultado server-side pelo endpoint `GET /api/storefront/shipping/address/:cep`, que usa o ViaCEP apenas para localizar e preencher logradouro, bairro, cidade e UF; o ViaCEP não é tratado como fonte de preço ou prazo de frete. A entrega exige endereço estruturado, CEP válido, número, bairro, cidade, UF e CPF/CNPJ do destinatário. O endereço final é persistido no pedido como snapshot transacional para preservar o que foi informado no momento da compra.

Para delivery ou transportadora, o cliente chama `POST /api/storefront/shipping/quotes` com o método publicado e as variantes/quantidades do carrinho. O servidor valida catálogo publicado, peso, largura, altura, comprimento, preço, empresa, storefront, conta logística e origem. A chamada externa de cotação ocorre fora da transação curta de persistência; a resposta é armazenada com hash do carrinho/CEP, opções públicas, snapshot do provedor e expiração de 15 minutos. O pedido só aceita a cotação e opção correspondentes ao carrinho, método e CEP atuais. O total server-side é `subtotal + frete + impostos - desconto`, sem aceitar preço ou frete calculado pelo navegador.

A primeira implementação operacional é o adapter do Melhor Envio, mantendo o registry provider-neutral para futura inclusão de Frenet ou outro transportador. A conta é vinculada ao storefront e ao ambiente (`sandbox` ou `production`), exige referências `env:ME_ACCESS_TOKEN` e `env:ME_WEBHOOK_SECRET`, origem completa para expedição e permanece inativa por padrão. O checkout só publica cotação quando existe adapter registrado, conta ativa, origem e secrets realmente presentes no processo. Sem essas condições, a vitrine preserva a retirada configurada e exibe a indisponibilidade de cotação, nunca um valor fictício.

A operação administrativa utiliza `POST /api/admin/commerce/shipping/accounts`, `PATCH /api/admin/commerce/shipping/accounts/:id`, `POST /api/admin/commerce/fulfillments/:id/label` e `POST /api/admin/commerce/fulfillments/:id/track`. Uma etiqueta só pode ser gerada para fulfillment da mesma empresa/storefront, com cotação selecionada, pedido pago ou em processamento, conta pronta, origem fiscal completa e política explícita de nota fiscal ou declaração de conteúdo. A operação de etiqueta grava uma chave idempotente, marca o fulfillment como `processing`, chama o provedor fora da transação e finaliza com `provider_shipment_id`, transportadora, URL privada da etiqueta e tracking. Falhas ficam auditadas e podem ser retentadas sem permitir duas operações concorrentes para o mesmo fulfillment.

O Melhor Envio monta o envio usando os dados da cotação, remetente, destinatário, produtos e volumes. A compra consome o fluxo real da conta do provedor — carrinho, checkout, geração e impressão — e pode depender de saldo disponível na carteira da conta. Por essa razão, o botão do backoffice apresenta confirmação explícita e não é executado automaticamente após o pagamento. A chave de NF ou a política de declaração de conteúdo deve ser definida antes da expedição; o Kytto não cria documento fiscal fictício nem marca uma etiqueta como paga localmente.

O webhook público é `POST /api/webhooks/melhorenvio/shipping`. A associação é resolvida pelo `provider_shipment_id` persistido no fulfillment, antes de aceitar o evento. O corpo bruto é validado com HMAC-SHA256 no cabeçalho `X-ME-Signature`, usando o secret do aplicativo; eventos são deduplicados por empresa, provider e identificador do evento. Eventos `order.posted`, `order.delivered`, `order.cancelled` e demais estados suportados atualizam tracking e ocorrência; a máquina de estados do fulfillment só avança quando a transição é permitida. O cliente acompanha o status, transportadora, código e URL de rastreio pelo endpoint público do pedido, sem receber segredos ou identificadores internos de conta.

| Etapa | Endpoint/ação | Fonte de verdade | Condição de disponibilidade |
|---|---|---|---|
| Consulta de CEP | `GET /api/storefront/shipping/address/:cep` | ViaCEP, somente dados postais | CEP válido e serviço respondendo |
| Cotação | `POST /api/storefront/shipping/quotes` | Melhor Envio via adapter | Conta ativa, secrets, origem, dimensões e estoque/catálogo válidos |
| Criação do pedido | `POST /api/storefront/orders` | PostgreSQL Commerce Core | Carrinho, método e cotação ainda válidos; endereço completo em delivery |
| Pagamento | `GET /payment-methods` e `POST /orders/:publicCode/payments` | Adapter Mercado Pago ou futuro provider | Conta merchant ativa e homologada; nenhuma aprovação local |
| Etiqueta | `POST /api/admin/commerce/fulfillments/:id/label` | Melhor Envio | Pedido pago, cotação selecionada, origem/destino e política fiscal válidos |
| Tracking | Webhook `POST /api/webhooks/melhorenvio/shipping` ou sync administrativo | Melhor Envio | Etiqueta gerada pelo mesmo aplicativo que possui o webhook |

A migration `027_commerce_shipping_quotes.sql` sustenta contas, cotações, snapshots, vínculo pedido-cotação, conta/quote no fulfillment, operação idempotente de etiqueta e webhooks logísticos. O executor canônico já inclui a migration com lock e checksum. Nenhuma conta Melhor Envio, secret, etiqueta, cobrança ou mudança de DNS é criada automaticamente pela aplicação.

As propriedades do Melhor Envio descritas acima seguem a [documentação de cálculo de fretes][1], a [documentação de inserção e compra de fretes][2] e a [documentação oficial de Webhooks][3]. A consulta de endereço usa a [API pública do ViaCEP][4].

#### Referências

[1]: https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos "Melhor Envio — cálculo de fretes por produtos"
[2]: https://docs.melhorenvio.com.br/reference/inserir-fretes-no-carrinho "Melhor Envio — inserir fretes no carrinho"
[3]: https://docs.melhorenvio.com.br/docs/webhooks "Melhor Envio — Webhooks"
[4]: https://viacep.com.br/ "ViaCEP — API de consulta de CEP"

## Incremento de robustez operacional

A camada pública agora aplica limites por IP às consultas de CEP, cotações, criação de pedido, início de pagamento e acompanhamento público, reduzindo abuso e enumeração sem afetar webhooks assinados. Cada resposta recebe `X-Request-Id`; pedidos públicos usam o identificador gerado pelo servidor para auditoria, em vez de aceitar correlation id arbitrário do navegador.

O endereço de entrega valida matematicamente CPF/CNPJ antes de cotar ou criar pedido. A origem do remetente precisa conter documento válido para emissão de etiqueta; uma conta pode estar pronta para cotação sem ser considerada pronta para expedição fiscal. Delivery e transportadora são tratados como modos de entrega equivalentes no storefront, e o método publicado aceita de forma consistente `shippingAccountId` ou o alias legado `accountId`.

O backoffice dispõe de reconciliação manual do status de pagamento. A consulta ocorre no adapter real do gateway, exige o vínculo persistido da conta, confere `provider_payment_id` e valor, usa timeout de 12 segundos e só aplica transições permitidas. Respostas atrasadas não rebaixam pagamentos capturados ou estornados. A reconciliação é auditada sem armazenar payload bruto ou credenciais.

Fulfillment só pode ser criado depois da confirmação de pagamento e a cotação usada deve pertencer ao mesmo pedido, storefront e empresa. A geração de etiqueta continua fora da transação longa, com chave operacional e proteção contra concorrência; falha, sucesso, tracking e webhook permanecem identificáveis para recuperação operacional.

## Incremento de governança e administração do backoffice
A rota administrativa de auditoria agora aceita paginação limitada, filtros seguros de entidade e ação e aplica o escopo de loja quando a membership estiver vinculada a uma loja. O retorno informa total e `hasMore`, enquanto o backoffice apresenta busca, correlation id e dados saneados pelo servidor; referências de segredo não são exibidas.

O catálogo ganhou cadastro rápido de categorias com categoria pai, descrição e ordem, reutilizando a operação transacional do Commerce Core e atualizando os seletores do produto. A área de clientes passou a permitir editar endereços existentes, além de criar e remover, mantendo a auditoria e as validações do Core.


## Evolução de administração de catálogo e Correios

O Commerce OS agora expõe operações tenant-aware para edição de categorias, criação/edição/arquivamento de variantes e gestão de múltiplas mídias por produto. Cada variante pode manter SKU, barcode, atributos, peso, dimensões, status e histórico de preço; as mídias possuem URL, chave, texto alternativo, ordem e associação opcional à variante. As operações são transacionais e registradas na auditoria.

A integração dos Correios foi adicionada ao contrato provider-neutral de logística. O adapter usa o token server-side e os endpoints oficiais de preço e prazo por serviço para cotar origem, destino, peso, dimensões, valor declarado e serviços adicionais. O rastreamento é consultado pela API autenticada de objetos e seus eventos são normalizados para a máquina de estados do fulfillment.

A emissão de etiqueta/pré-postagem dos Correios permanece bloqueada até validar a API 36 e o schema autorizado no CWS da conta contratada. O sistema não cria pré-postagem com payload especulativo, não compra postagem e não exibe uma etiqueta inexistente. A conta só fica pronta para cotação quando possuir token, origem e códigos de serviço; o backoffice informa separadamente que a expedição depende da validação oficial.


## Escala das listas administrativas

As listagens administrativas de produtos, pedidos e clientes passaram a aceitar `limit` e `offset` com limites server-side, retornando total e `hasMore`. Pedidos e clientes aceitam busca textual limitada por código, nome e e-mail; a aplicação nunca monta SQL com coluna recebida do navegador. O filtro de empresa e, quando aplicável, de loja continua sendo derivado da membership autenticada.

O Commerce OS também oferece busca local nas filas de pedidos e clientes para reduzir tempo operacional sem mudar o contrato legado. A paginação é deliberadamente limitada e auditável; uma etapa posterior poderá acrescentar carregamento incremental e exportação assíncrona para tenants com volume maior, sem remover a proteção atual contra consultas ilimitadas.


## Evolução da operação administrativa

As filas administrativas de produtos, pedidos e clientes agora retornam paginação server-side limitada, contagem total e indicação de continuação. Os pedidos podem ser filtrados por código público, cliente ou e-mail; clientes podem ser filtrados por nome, e-mail ou telefone. O backoffice mantém busca local para resposta imediata e não expõe dados fiscais completos.

A listagem de pedidos também carrega os itens snapshot, quantidades, preços, subtotal, frete, método/cotação associados e status de pagamento persistido. Isso permite que a operação prepare e audite um pedido sem reconstruir seus dados a partir do catálogo atual, preservando a consistência histórica do checkout.


## Índices de escala administrativa

A migration `028_commerce_admin_indexes.sql` adiciona índices idempotentes iniciados por `empresa_id` para produtos, pedidos, clientes, itens e mídias. Pedidos também possuem índice por storefront e data de criação. Esses índices suportam paginação e detalhamento do backoffice sem remover as predicates tenant-aware nem introduzir extensões opcionais no PostgreSQL.


## Painel de saúde operacional

O endpoint administrativo `/api/admin/commerce/operations/health` retorna somente contagens agregadas e o instante de geração para o tenant e, quando aplicável, a loja da membership. Ele reúne pagamentos por status, fulfillments por status e webhooks de pagamento/logística por status; não retorna payloads, referências de segredo, tokens ou identificadores de gateway. A visão geral do Commerce OS transforma essas contagens em atalhos para as filas de pedidos, pagamentos, entrega e auditoria.

A listagem administrativa de pagamentos agora aceita busca limitada por código público, cliente ou identificador externo persistido, filtro de status e paginação com total. O identificador externo continua sendo exibido apenas na área administrativa autorizada e não é retornado no acompanhamento público.
