# Stallone Nutre Sport — estado da loja e do sistema

> Atualizado em 10/10/2026. Loja: https://stallone.kytto.com.br · Painel: https://kytto.com.br/admin (empresa Stallone ativa).
> Empresa: E. P. DE SOUZA LTDA · CNPJ 56.099.531/0001-38 · grupo **Silvester Holding**.
> Branch de produção: `fix/kytto-comandas-pdv-20260808` (auto-deploy no Render `setpoint`). Ver [AGENTS.md](../AGENTS.md).

Legenda da matriz:
- **Implementado**: existe no código.
- **Configurado**: está ligado e com dados reais para a Stallone em produção.
- **Testado**: validado por teste automatizado (T) e/ou verificação na loja publicada (P).
- **Pendente**: o que falta e quem precisa agir.

## 1. O que esta entrega acrescenta

Esta entrega parte da PR #294 e reaproveita tudo o que ela já trazia: rebrand, tema, entrada pelo domínio e login direcionado ao painel do e-commerce. Sobre essa base, acrescenta:

| Item | Arquivos |
|---|---|
| Paleta aprovada (carvão #141416, vermelho #E32935, branco #F7F7F5, cinza #72727A), sem amarelo, sem sombra e sem swoosh | `web/src/theme.css`, `web/src/pages/public/commerce-stallone.css`, `web/public/brand/stallone-*.svg` (PR #294) |
| Logo horizontal para fundo escuro e para fundo claro, símbolo "S" e ícones PNG 192/512 | `web/public/brand/stallone-logo-transparent.svg`, `stallone-logo-light.svg`, `stallone-mark.svg`, `stallone-icon-192.png`, `stallone-icon-512.png` |
| Favicon, ícone de instalação e `theme-color` da Stallone trocados por marca; as outras marcas mantêm os do `index.html` | `web/src/lib/brand.js` (`BRAND_ICONS`, `applyBrand`) |
| Login no domínio da Stallone com o logo e o slogan da marca | `web/src/pages/Login.jsx` |
| Checkout com o logo da Stallone, na versão certa para tema claro ou escuro | `web/src/pages/public/CommerceCheckout.jsx`, `web/src/theme.css` |
| Slogan "Força para evoluir. Nutrição para ir além." na vitrine | `web/src/pages/public/Ecommerce.jsx` (PR #294) |
| Vitrine escura e painel claro por padrão, respeitando a escolha explícita do usuário | `web/src/lib/brand.js` (`brandThemeMode`, PR #294) |
| **Catálogo paginado**: 48 cards por vez com "Mostrar mais", em vez de montar os 768 de uma vez. Volta à primeira página quando busca, categoria, filtro ou ordenação mudam | `web/src/lib/storefront-catalog.js` (`paginateCatalog`), `Ecommerce.jsx`, `storefront-ux.css` |
| **Congelados e refrigerados só por retirada**, decidido no servidor. A cotação de frete recusa o carrinho com o código `SHIPPING_PICKUP_ONLY_ITEMS` (HTTP 422) e o checkout explica o motivo. A regra vale para categorias ou nomes com "congelado", "refrigerado", "resfriado" ou "perecível", em qualquer empresa | `app/core/commerce-pickup-rules.js`, `app/core/commerce-shipping.js`, `app/core/commerce-routes.js`, `web/src/lib/checkout-shipping.js` |
| Testes novos | `app/core/commerce-pickup-rules.test.js`, `web/src/lib/brand.test.js`, `web/src/lib/storefront-catalog.test.js` |

## 2. Matriz de funcionalidades

| Área | Implementado | Configurado | Testado | Pendente / responsável |
|---|---|---|---|---|
| Domínio próprio abrindo a loja | Sim (commit a32f2bd + PR #294) | Sim: DNS, TXT, certificado | P: abre `/ecommerce/stallone`; catálogo com 768 produtos; T: `brand.test.js` | — |
| Identidade visual | Sim | Sim, após o merge | T: brand; P: só depois do deploy | Fotos reais dos produtos (loja) |
| Busca por nome, SKU e categoria; ordenação; filtro "em estoque" | Sim (`filterCatalog`, `sortCatalog`) | Sim | T: `storefront-catalog.test.js` | — |
| Catálogo paginado | Sim | Sim, após o merge | T: `paginateCatalog` | — |
| Variantes (sabor, tamanho, peso) | Sim no Core (produto → variantes) | **Não**: cada item do TGA virou um produto com uma variante | — | Loja informar os agrupamentos (ex.: mesmo whey em 3 sabores) |
| Fotos e descrição | Sim (mídia, descrição curta e longa) | Parcial: 714 de 768 com referência de imagem; descrição verificada em amostra | P: catálogo e detalhe por SKU | Completar 54 imagens e revisar descrições com fontes autorizadas |
| Ingredientes, tabela nutricional, alérgenos | Campos livres no produto | Não | — | Somente com dados oficiais do rótulo (loja/fornecedor) |
| Carrinho persistente e separado por loja | Sim (chave `kytto_commerce_cart:<alias>` + sincronização com o servidor) | Sim | T: suíte de carrinho; P: chaves separadas para dino e stallone | — |
| Revalidação de preço, estoque e frete no servidor | Sim (pedido usa preço vigente, reserva com trava, cotação com hash) | Sim | T: `commerce-checkout*.test.js`, `commerce-shipping*.test.js` | — |
| Reserva e liberação de estoque | Sim (reserva com prazo do servidor, varredura de expiração) | Sim | T unitário; teste PG local depende de fixture (ver §4) | — |
| Concorrência pelo último item | Sim (`FOR UPDATE` na reserva) | Sim | T: `reserveInventory trava saldo…` (PG local) | — |
| Retirada na loja | Sim | Sim (Av. Brasil, 923S, seg–sex 8h–18h, sáb 8h–12h, preparo de 2 h) | P | Confirmar horários com a loja |
| Motoboy Tangará | Sim (tabela manual por CEP) | Sim (R$ 8 + R$ 5/zona, grátis acima de R$ 199) | — | Confirmar faixas de CEP e valores |
| "Entrega para todo o Brasil" | Tabela manual por UF | **Ativa**, mas sem transportadora, etiqueta ou rastreio | — | **Decisão da loja**: desativar até contratar Melhor Envio/Correios, ou manter com envio manual |
| Congelados só retirada | Sim (servidor) | Vale para a categoria "Sem glúten & Congelados" (27 itens) | T: `commerce-pickup-rules.test.js` | Se algum item dessa categoria não for congelado, mover para "Despensa saudável" |
| Pagamento online | Adaptadores InfinitePay e Mercado Pago, webhooks idempotentes, reconciliação, captura tardia | **Desligado**: `payment-methods` responde `available: false` | T: suítes de pagamento (mocks e PG) | **Loja escolher o provedor** e abrir a conta no CNPJ da Stallone. Credenciais entram só no Secret Manager/Render, nunca em chat |
| Estorno | Fluxo de estorno pelo provedor + reconciliação | Não (sem provedor) | T com mocks | Sandbox do provedor escolhido |
| Lotes e validade | Módulo legado existe; **não integrado** ao Commerce Core | Não | — | Ver §3.2 |
| Granel por peso livre | **Não**: hoje 1 unidade = porção de 100 g | 126 itens em porções de 100 g | — | Ver §3.1 (precisa de aprovação para migrar os dados) |
| Painel da Stallone | Menu de varejo próprio (PR #291), login cai em `/admin/ecommerce` (PR #294) | Sim | P | PDV de balcão de varejo (PRD §3) |
| Usuários e isolamento entre empresas | Sim (tenant por `empresa_id`, `X-Empresa-Id` validado) | Sim | T: `server-scope`, `commerce-identity` | Convidar a sócia-administradora |
| Políticas (privacidade, trocas, entrega, termos) | Campos `policies.*Url` no storefront | **Vazios** | P: todos `null` | Textos para aprovação jurídica da loja (§5) |
| SEO e compartilhamento | Título e descrição por página, `og:` (PR #268) | Usa nome e slogan | — | Imagem de compartilhamento com a marca |
| Fiscal (NFC-e/NF-e) | Integração fiscal existe para o legado | Não | — | Certificado A1, CSC e regime tributário (contador da loja) |
| Atendente de IA no WhatsApp (Turbo) | Sim (persona `stallone`, segmento suplementos) | Persona ativa; canal em rascunho | T: `whatsapp-ai-persona.test.js` | Publicar a revisão do chatbot com `stallone-1`; segredo `WHATSAPP_AI_WEBHOOK_SECRET_STALLONE` no Render; parear o QR |

## 3. Decisões que dependem da loja

### 3.1 Granel por peso livre

A proposta de granel por **peso livre na balança** precisa ser confirmada pela loja antes de alterar dados. O Commerce Core trabalha com quantidades inteiras: estoque, reserva, pedido e baixa. Hoje cada item a granel é uma "porção de 100 g", com preço ÷ 10 e estoque × 10. Isso não atende a peso livre.

Proposta sem quantidades fracionadas e sem erro de arredondamento:

1. A unidade de estoque e de venda do item a granel passa a ser **1 g**. O preço fica por grama, guardado com 4 casas decimais e sempre exibido "por 100 g" e "por kg".
2. Na vitrine, o cliente escolhe o peso em passos de 50 g (mínimo de 100 g). O carrinho mostra, por exemplo, "350 g — R$ 12,25".
3. No balcão, o PDV lê o peso da balança e lança os gramas exatos.
4. A baixa é em gramas inteiros, então não há arredondamento. Perdas e fracionamento entram como ajuste de estoque em gramas, com motivo.

Isso exige migrar os 126 itens de granel: SKU mantido, estoque em gramas, preço por grama. A migração mexe em dados de produção e **precisa de aprovação** antes de rodar. Até lá, o modelo de porções de 100 g continua no ar.

### 3.2 Lotes e validade

Existe um módulo legado de lotes, mas ele mantém um estoque paralelo. Para não ter dois estoques da mesma mercadoria, a fonte de verdade deve continuar sendo `commerce_inventory_levels` (Commerce Core), com uma tabela de lotes **filha** do nível de estoque:

- quantidade por lote e validade;
- reserva e baixa por FEFO (o que vence primeiro sai primeiro);
- bloqueio de lote vencido;
- alerta a 30 dias do vencimento;
- registro do lote na linha do pedido.

Isso é uma migração de schema com testes PG próprios. Fica para a próxima entrega, depois que a loja confirmar que controla validade por lote na entrada da mercadoria.

### 3.3 Pagamento

O provedor ainda não foi escolhido. O código já tem InfinitePay (mesmo adaptador da Dino) e Mercado Pago. Para ativar:

1. A loja abre a conta no CNPJ 56.099.531/0001-38.
2. O responsável técnico cadastra as credenciais **direto no Render/Secret Manager**, nunca em chat ou e-mail.
3. Os testes em sandbox cobrem: pago, recusado, expirado, notificação duplicada, confirmação tardia e estorno.
4. Só depois disso a conta muda para produção.

Sem um método de pagamento publicado, o checkout online deve bloquear a criação do pedido e preservar o carrinho. Retirada com pagamento na loja exige um método explicitamente configurado; não é uma opção presumida.

## 4. Testes desta entrega

| Execução | Resultado |
|---|---|
| `npm run test:node` (sem PostgreSQL) | 1159 testes: **1083 aprovados, 0 falhas**, 76 ignorados (exigem banco PG de teste) |
| `npm run test:node` com PostgreSQL 16 local, migrations 001–066 aplicadas do zero | 1124 aprovados, 23 ignorados, **12 falhas idênticas às da produção atual sem esta mudança** (base comparada no mesmo banco limpo). Todas são de fixture: os testes esperam um produto físico publicado com saldo, ou o Postgres na porta 5432 |
| `web`: `vite build` | OK |
| Migrations 001–066 em banco vazio | OK (49 arquivos) |

Não validado nesta entrega:
- compra de ponta a ponta com pagamento real (sem provedor);
- teste em celular físico (a verificação foi pelo navegador);
- pedidos reais (proibido sem autorização).

## 5. Pendências externas

| Pendência | Responsável | O que é preciso |
|---|---|---|
| Provedor de pagamento | Loja (Rodrigo/Eunice) | Escolher InfinitePay ou Mercado Pago e abrir a conta no CNPJ |
| Fotos e descrições | Loja | Fotos próprias ou autorizadas pelo fornecedor; descrição comercial |
| Variantes | Loja | Lista de produtos que são o mesmo item em sabores ou tamanhos diferentes |
| Políticas | Loja + jurídico | Texto de privacidade (LGPD), trocas (CDC art. 49, 7 dias para compra online), entrega e termos |
| Granel em gramas | Rodrigo | Aprovar a migração do §3.1 |
| Entrega nacional | Loja | Manter a tabela manual ou desativar até contratar transportadora |
| Fiscal | Contador da loja | Certificado A1, CSC da NFC-e, regime tributário |
| WhatsApp | Rodrigo | Publicar a revisão do chatbot com `stallone-1` (Cloud Run `dino-chatbot-backend`, projeto `uisagcp`); criar `WHATSAPP_AI_WEBHOOK_SECRET_STALLONE` no Render; parear o QR com (65) 99676-5768 |
| Preço do NOW Omega 3 | Loja | Confirmar (planilha: R$ 12.190,00) |

## 6. Publicação e recuperação

1. A PR entra na branch de produção por merge, com aprovação do Rodrigo. O Render publica sozinho em cerca de 2 minutos.
2. Esta entrega não tem migration de banco. A recuperação é revertendo o merge (`git revert -m 1 <merge>` em uma PR de reversão). A versão anterior volta no próximo deploy automático.
3. Depois do deploy, conferir:
   - `stallone.kytto.com.br` abre a vitrine escura com o logo e o slogan novos, 48 produtos e o botão "Mostrar mais";
   - a aba do navegador mostra o "S" vermelho;
   - o checkout mostra o logo;
   - um carrinho com item de "Sem glúten & Congelados" só oferece retirada;
   - o login em `stallone.kytto.com.br/login` mostra a marca;
   - `dino.kytto.com.br` continua igual (logo, cores, favicon e checkout da Dino).

## 7. Auditoria complementar — 10/10/2026

A auditoria pública verificou busca por SKU, detalhe de produto, carrinho e navegação ao checkout. O catálogo consultado continha 768 produtos, dos quais 714 tinham referência de imagem e 54 não tinham. As imagens usam carregamento sob demanda; isso não significa que estejam quebradas.

O endpoint público de pagamentos respondeu `available: false`, sem métodos. A PR #300 bloqueia envio nessa condição, apresenta aviso e conserva o carrinho. Também integra a identificação da Stallone com os logos e as alterações da PR #298.

Não foram criados pedidos ou pagamentos reais. Administração autenticada, emissão fiscal, lotes/validade, compra completa e integrações externas ainda precisam de validação específica. Os preços de produtos vendidos por caixa ou unidade precisam de conferência comercial; a auditoria não altera preços sem fonte confirmada.

## 8. Evolução do painel — 11/10/2026 (PR #300, ainda não publicada)

A entrega acrescenta uma Central de operação exclusiva da empresa Stallone, usando o catálogo, estoque e configurações do escopo carregado. Pendências de conta de pagamento de produção, imagem, descrição, saldo baixo, políticas, domínio e entrega manual recebem acesso direto à aba responsável. Falhas de consulta aparecem como dados indisponíveis. A central não substitui homologação de pagamento, fiscal ou logística.

A aba Lojas permite editar os quatro links de políticas com a permissão `settings.write`. O servidor trava o canal, preserva as demais configurações e sincroniza somente as políticas dos aliases da mesma empresa/vitrine em transação. Links precisam usar HTTPS e não podem conter credenciais. O conteúdo das páginas deve ser aprovado pela loja.

Configurações, relatórios operacionais e BI da empresa Stallone passam a abrir as abas correspondentes de Commerce. Compras, PDV, lotes/validade e emissão fiscal ainda precisam de integração/homologação própria; não foram declarados concluídos.

Metadados HTML da vitrine e do domínio próprio passam a usar título, descrição, canonical e imagem da marca. Login, admin e checkout no domínio dedicado recebem `noindex`; APIs, arquivos e outras marcas não são interceptados. A imagem de compartilhamento utiliza o ícone PNG existente da Stallone.

A primeira verificação do portal exigiu login. A sessão foi disponibilizada pelo usuário e a verificação autenticada foi concluída em 11/10/2026; veja a matriz abaixo. A prévia visual da Central continua sendo demonstrativa e não representa homologação das integrações. Nenhum preço, estoque, pedido, pagamento ou segredo foi alterado em produção.


## 9. Comparação autenticada — 11/10/2026

Empresa selecionada: Stallone Nutre Sport. Inspeção de leitura com acesso administrativo da plataforma; não prova o isolamento de um usuário com papel restrito nem o funcionamento transacional. Nenhum pedido, pagamento, mensagem, preço, saldo, permissão ou configuração de produção foi alterado.

| Área | Confirmado no portal / código | O que falta |
|---|---|---|
| Vitrine e domínio | stallone-web ativo; domínio principal verificado; 768 produtos publicados | Concluir conteúdo, políticas e testes em dispositivos reais |
| Catálogo | 54 produtos sem referência de foto; 7 descrições ausentes na auditoria pública | Fotos autorizadas, descrições, variantes, conferência comercial de preços |
| Estoque | 462 produtos com até 5 unidades; relatório monitora 769 SKUs e mínimos configurados em zero | Definir mínimos reais por SKU; validar lote, validade, FEFO e compras no Core. Produto e SKU não são a mesma contagem |
| Pedidos e clientes | Telas Core existentes, sem histórico de pedidos/clientes | Homologar ciclo completo, cancelamento, devolução e atendimento |
| Pagamentos | Zero contas ativas/prontas e zero transações; um adaptador pronto não equivale a conta configurada | Escolher provedor, configurar conta e provar cobrança/webhook/estorno |
| Entrega | Nacional manual, motoboy e retirada ativos; frete grátis acima de R$299 inativo; zero contas logísticas | Validar regras/CEPs/pesos, contratar provedor se necessário; testar etiqueta/rastreio |
| Promoções | Quatro templates padrão; nenhuma campanha cadastrada | Aprovar e cadastrar campanha, limites e validade; validar cupom |
| Fidelidade | Ativa: 1 ponto por R$1; níveis Bronze/Prata/Ouro; zero clientes com pontos, recompensas e resgates | Definir benefícios/recompensas e provar crédito único após pagamento e estorno |
| Relatórios | Pedidos, captura, expedição e satisfação disponíveis, todos sem histórico | Conferir após ciclo homologado; separar estoque mínimo de alerta até 5 unidades |
| Financeiro | Tela da empresa acessível, indicadores zerados | Validar conciliação Commerce; não pressupor integração automática pelo texto da tela |
| WhatsApp | Linha cadastrada stallone-1; sessão e identificação não confirmadas; IA em preparação | Integração por empresa (#302), configuração externa, pareamento e teste de entrada/saída |
| Cérebro IA | Existe; desligado na Stallone; checklist publicado usa agenda/identidade da Dino e instância global dino | Checklist e ativação próprios da Stallone; validar isolamento de instância e capacidades antes de ligar |
| Usuários | Três vínculos ativos, convite aceito, papéis e permissões visíveis | Testar com usuário restrito de loja e negação entre empresas; entrega de convites depende do provedor |
| Auditoria | Total de 2263 eventos; lista dos 100 recentes | Conferir novos eventos das alterações após publicação e paginação |
| Crédito/CRM/campanhas/pós-venda | Serviços Core existentes para crédito, consentimento, campanhas, carrinho abandonado e satisfação | Validar fluxos específicos da loja com histórico; evitar recriar módulos em bases paralelas |
| Compras, PDV e fiscal | Módulos no repositório usam contratos legados e/ou dependem de configuração própria | Integrar estoque/recebimento/caixa ao Core; homologar fiscal com contador, sem declarar pronto só pela existência do código |

### Correções complementares na PR #300 (não publicadas)

- `/admin` da Stallone abre o painel Commerce em vez do dashboard de tênis/bar.
- As duas rotas de atendimento da loja exibem os pedidos Core na Stallone, preservando a guarda de equipe; deixam de consultar a fila legada que apresentou `not found`.
- Painel Commerce é remontado por empresa selecionada, descartando estado da empresa anterior.
- Alerta de catálogo passa a dizer “até 5 unidades”, sem confundir com mínimo configurado.
- Financeiro Stallone deixa de prometer entradas automáticas de atendimentos/comandas.
- Link de ativação no WhatsApp vai ao cérebro da Stallone; a aba Ativação deixa de carregar/expor o checklist e os botões da Dino. Mostra caminhos para validar a linha e a loja, sem afirmar que o atendente está pronto. No servidor, as quatro ações de ativação da Dino (canal, política, agenda e vitrine) são bloqueadas para a empresa com alias/marca Stallone persistidos. Um teste comprova resposta 409 antes de qualquer alteração. A ativação específica da Stallone ainda precisa ser implementada e homologada; não é substituída por essa proteção.

### Ordem de conclusão

1. Publicar correções da PR #300, verificar deploy Live e repetir a inspeção autenticada.
2. Homologar conta de pagamento e ciclo pedido → webhook → estoque → separação → entrega → estorno.
3. Concluir conteúdo, políticas, variantes, mínimos e regras comerciais/logísticas.
4. Finalizar WhatsApp por empresa e ensaiar com números autorizados antes da liberação.
5. Homologar PDV, compras, lotes/validade/FEFO, fiscal e conciliação, reaproveitando o Core.
6. Ativar campanhas, recompensas e pós-venda com consentimento e indicadores reais.

Os totais são uma fotografia da sessão de 11/10/2026. Telas vazias confirmam ausência de histórico visível, não sucesso de ponta a ponta. O dashboard global inadequado não constitui, por si só, prova de vazamento de dados: a sessão utilizada possui administração da plataforma.
