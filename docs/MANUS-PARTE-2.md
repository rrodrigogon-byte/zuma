# Kytto: Parte 2 do plano de correção (para o Manus)

Este documento é o briefing completo da Parte 2. A Parte 1 (os itens P0) foi feita pelo Claude no PR "Correções P0". Ela tira do menu as telas sem backend, conserta Torneios e KDS, cria o painel do clube e corrige os indicadores. **Comece só depois que esse PR estiver mergeado** e crie as branches a partir da produção atualizada.

Origem: análise de 18/10/2026 ("Kytto: comparativo com concorrentes, teste do sistema e o que falta implantar"). Nela, 30 das 68 telas do TTC chamavam APIs inexistentes em produção, e só 9 dos 35 módulos de `app/modules` rodavam no `server.js`.

---

## 1. Regras obrigatórias (leia `AGENTS.md` antes de tudo)

- **Produção:** a produção é a branch `fix/kytto-comandas-pdv-20260808`, publicada pelo serviço `setpoint` no Render com auto-deploy. Todo merge vai ao ar em cerca de 2 minutos.
- **Branches e PRs:**
  - Crie branch a partir de `origin/fix/kytto-comandas-pdv-20260808`, nunca de `main`.
  - Abra PR com `--base fix/kytto-comandas-pdv-20260808`.
  - Nunca faça push direto na produção.
  - Faça um PR por item (ou por grupo pequeno e coeso). Nada de PR gigante.
  - **O merge é decisão do Rodrigo.** Abra o PR como rascunho e peça a aprovação dele.
- **Proibido:**
  - mexer em branch, build, pre-deploy, start, health check ou auto-deploy do Render;
  - reativar o Blueprint;
  - editar o `render.yaml`;
  - fazer bump de `DEPLOY_TS` ou commit vazio;
  - alterar variáveis `WHATSAPP_*` ou `CHATBOT_BACKEND_*`.
- **Idioma:** tudo em português do Brasil: código novo (nomes de funções de domínio), comentários, textos de tela, mensagens de erro, commits e PRs.
- **Antes de cada PR, rode:**
  - `npm run test:node` (hoje só falham os 8 testes "PG real" que recusam rodar como root, e essa é a linha de base);
  - `npm run test:menu-clube`;
  - `CLUBE_PG_TEST_URL=postgres://...localhost.../x_test npm run test:clube-pg`;
  - `(cd web && npm run build)`.
- **Banco JSON:** o banco JSON (`app/db.js`) aceita um único processo. Não escale instâncias.
- **Nunca suba o `server-v2.js` inteiro.** Leve os módulos um a um para o `server.js`, com testes. O `server-v2` tem outra arquitetura (Redis, Bull, outro auth) e não roda no Render.

## 2. Padrão de arquitetura multiempresa (copie o do módulo Clube)

O módulo Clube (`app/modules/clube`, `acesso`, `aulas`, `quadras`, `contratos`, `cobrancas`, `retencao`, `parceiros`) é a referência.

- **Banco:**
  - PostgreSQL do Commerce Core, pelo pool existente (`getCommercePool`).
  - Veja o adaptador `clubeDb` em `app/server.js`. Ele usa o pool direto, não registra valores em log, e o commit/rollback devolve a conexão uma vez só.
  - Toda tabela tem `empresa_id UUID NOT NULL` e toda consulta filtra por ele.
  - Para FK entre tabelas da mesma empresa, use FK composta `(empresa_id, id)`.
- **Empresa e permissão:**
  - A empresa vem só de `requireCommercePermission(req, permissao)`, com `X-Empresa-Id` validado contra `commerce_memberships`. Siga a função `empresaDoClube` e a `permissaoDoClube`.
  - Leitura pede `customers.read` (ou o equivalente do módulo).
  - Configuração pede `settings.write`.
  - Dinheiro pede `payments.read` ou `payments.write`.
  - Nunca aceite `empresaId` vindo do corpo da requisição.
- **Rotas:** monte sob `/api/admin/<modulo>` e inclua o módulo em `TENANT_ADMIN_MODULES` no `server.js`.
- **Migrations:**
  - Numere a partir de `081_...sql`. A 080 é a das quadras.
  - Só migrations aditivas.
  - Registre no array de `app/migrations/run-commerce-schema-migrations.js` e o sha256 em `app/migrations/checksums.json`.
  - O pre-deploy do Render aplica sozinho.
- **Concorrência:** use `pg_advisory_xact_lock` (por recurso) ou `SELECT ... FOR UPDATE` dentro de transação. Os exemplos estão em `quadras/servico.js` e `aulas/servico.js`.
- **Erros:** use `ErroDominio` e `responderErro` de `app/modules/acesso/banco.js`. Nunca devolva `error.detail` do PostgreSQL, porque pode conter dado pessoal.
- **Testes:**
  - Os testes de PostgreSQL ficam em `app/core/*.pg.test.js`, com a fixture `app/core/fixtures/clube-pg.js`. Cada teste roda num schema próprio e só aceita localhost e banco `*_test`.
  - Cubra sempre: isolamento entre empresas (outra empresa recebe 404), concorrência e permissões.
  - Para rotas do `server.js`, siga `app/server-legado-evento.test.js`, que sobe o servidor real com `DB_PATH` temporário.
- **Front:**
  - Quando um módulo for ao ar, **remova a rota de `EM_IMPLANTACAO`** em `web/src/lib/disponibilidade.js`.
  - Quando um módulo do evento virar multiempresa, remova a rota de `GLOBAIS_DO_EVENTO`.
  - O menu e o aviso "Em implantação" se ajustam sozinhos.
  - O teste `web/src/lib/disponibilidade.test.js` precisa continuar verde.
- **LGPD:**
  - Guarde só o necessário.
  - Credenciais (certificado A1, tokens de gateway) cifradas por empresa. Veja como `parceiros` cifra com `CLUBE_PARCEIROS_SECRET`.
  - Mensagem de marketing respeita o "PARAR" e o opt-out global.

## 3. Definição de pronto (vale para todo PR)

1. As telas do item abrem em produção sem nenhuma resposta 4xx/5xx da API e sem erro de JavaScript, testadas com o TTC, a Dino e a Stallone ativos. Use um navegador com as gravações bloqueadas para navegar e um usuário de teste para gravar.
2. Um usuário de empresa (não administrador da plataforma) só vê e só altera dados da própria empresa. Há teste automatizado disso.
3. Foram removidas as rotas correspondentes de `EM_IMPLANTACAO` e `GLOBAIS_DO_EVENTO`.
4. A migration é aditiva, está registrada no runner e tem checksum.
5. Os testes novos estão verdes e a linha de base não piorou. O build do front passa.
6. A descrição do PR, em português, diz:
   - o que entra;
   - o que não muda;
   - variáveis novas do Render, se houver (o Rodrigo cadastra com "Save only");
   - como validar depois do deploy.

---

## 4. Itens da Parte 2, em ordem

Esforço: M = 1 a 3 semanas, G = mais de 3 semanas. A ordem importa: a Onda A destrava quase tudo do bar e do varejo.

### Onda A: módulos do evento para multiempresa (P1, G)

**A1. Bar, PDV, comandas, mesas, cardápio, KDS, estoque e caixa por empresa**
- **Hoje:**
  - Rotas legadas no `server.js` sobre `db().comandas`, `db().cardapio`, `db().mesas` e outras do JSON global do evento. Usuário de empresa recebe 403.
  - Há código mais novo em `app/server-erp.js` (comandas por empresa, `kds-avancado-kytto.js`) e em `app/modules/{bar,pdv,estoque,caixa,restaurante}`, fora de produção.
- **Fazer:**
  - Tabelas PG por empresa: produtos do cardápio com setor (bar, cozinha, chapa), mesas, comandas, itens de comanda com status de produção, movimentos de estoque com **estoque por dose**, caixa (abertura, sangria, fechamento) e fila de impressão.
  - Rotas sob `/api/admin/bar/*` (ou nome equivalente), com o mesmo contrato que as telas `PDV.jsx`, `GarcomView.jsx`, `KDS.jsx`, `Mesas.jsx`, `Cardapio.jsx` e `Estoque.jsx` já usam. Se o contrato mudar, ajuste as telas.
  - **Migração dos dados do evento** para a empresa AGRO OPEN TTC (`2e041110-db20-4fd1-8278-12bd3dead008`):
    - script idempotente com prévia e aplicação, igual a `app/modules/clube/importar-legado.js`;
    - só para o administrador da plataforma;
    - de-para numa tabela de importações.
  - Durante a transição, o PDV do evento não pode parar: a escolha da fonte é por empresa, sem quebrar o usuário legado.
- **Aceite:**
  - O TTC opera o bar com um usuário da própria empresa.
  - Uma segunda empresa de teste tem cardápio e comandas próprios e não vê os do TTC.
  - O KDS mostra só os itens da empresa e atualiza o status com transição válida.
  - Estoque por dose: vender uma dose baixa a fração da garrafa.

**A2. Financeiro, contas a receber, fechamento diário e cadastros (clientes, fornecedores, funcionários)**
- **Hoje:** as telas `ContasReceber.jsx`, `FechamentoDiario.jsx`, `CadastrosMestres.jsx` e `ClientesContas.jsx` dão 404 (estão em `EM_IMPLANTACAO`).
- **Fazer:**
  - Reaproveitar `financeiro-central-kytto.js`, que já está em produção para a Dino, e os módulos `financeiro`, `clientes` e `caixa`.
  - Fornecedores e funcionários por empresa.
- **Aceite:** as quatro telas abrem sem 404 com o TTC, a Dino e a Stallone, e os dados ficam separados por empresa.

**A3. Torneios, inscrições, súmula, ranking, ligas, pontos, sócios e mensalidades legados por empresa**
- **Hoje:**
  - JSON global (`db().torneios`, `ligas`, `ranking`, `socios`).
  - A Parte 1 só fez a listagem voltar a funcionar para o administrador da plataforma.
- **Fazer:**
  - Tabelas PG por empresa, com os motores (`bracket.js`, `roundrobin.js`, `swiss.js`, `doubleelim.js`, `rating.js`, `liga.js`) reaproveitados como funções puras.
  - Migrar o "4ª Agro Open de Tênis" para a empresa TTC.
  - "Sócios" e "Mensalidades" antigos devem ser redirecionados para o Clube (`/admin/clube/alunos`, `/admin/clube/cobrancas`) ou removidos. O Clube já é a fonte da verdade.
- **Aceite:** um clube cria um torneio, faz o sorteio, lança a súmula e publica o ranking, e outro clube não vê nada disso.

### Onda B: fiscal (P1, G)

**B1. NFC-e e NF-e em produção**
- **Hoje:**
  - `app/modules/fiscal`, `app/core/fiscal-engine.js`, `danfe-generator.js` e `app/modules/sped` estão fora de produção.
  - O `app/nfce.js` (legado) está no ar, mas sem provedor configurado. A barbearia já emite NFS-e nacional (`barbearia-nfse-kytto.js`).
  - As telas Central Fiscal, Configuração de NF-e/NFC-e e Classificação fiscal dão 404.
- **Fazer:**
  - Montar as rotas `/api/v1/fiscal/*` que as telas usam: config, certificados, documentos, preview, XML, representação, IBPT e classificação.
  - Configuração por empresa: CNPJ, IE, regime, CSC, série e numeração.
  - Certificado A1 cifrado por empresa.
  - Provedor Focus NFe ou PlugNotas, com token por empresa.
  - Emissão automática no fechamento da comanda e da venda do PDV.
  - Contingência offline (tpEmis 9).
  - Cancelamento e inutilização.
- **Aceite:**
  - Uma NFC-e emitida em **homologação na SEFAZ-MT** com o TTC.
  - Cancelamento dentro do prazo.
  - XML e DANFE disponíveis.
  - Outra empresa não enxerga as notas.
- Livros fiscais e SPED (`RelatoriosFiscais.jsx`) podem ficar para um segundo PR.

### Onda C: dinheiro (P1/P2, M)

**C1. Baixa automática do Pix e cartão recorrente, com gateway por empresa (P1)**
- **Hoje:** o Clube gera Pix com a chave do clube e a recepção dá baixa à mão. O campo `provedor` já existe em `clube_cobrancas`, e `core/payment-adapters.js` e `mercadopago-adapter.js` estão em produção.
- **Fazer:**
  - Contas de gateway por empresa (Mercado Pago, InfinitePay, Asaas ou Efí), com credencial cifrada.
  - Pix com txid e webhook assinado que chama `registrarPagamentoClube`. Essa função já é idempotente pelo `pagamentoId` e libera a catraca.
  - Cartão recorrente (tokenização no gateway; nunca guardar número de cartão).
  - Retentativa de cobrança recusada.
  - Mesmo mecanismo para o clube de assinatura da barbearia.
- **Aceite:**
  - Um Pix pago no sandbox libera a catraca sozinho em menos de 1 minuto.
  - Um webhook repetido não estende o "pago até" duas vezes.
  - Uma assinatura de cartão cobra todo mês no sandbox.

**C2. Boleto, conciliação bancária (OFX) e DRE (P2)**
- Boleto pelo mesmo gateway.
- Importação de OFX com sugestão de conciliação.
- DRE mensal por empresa a partir dos lançamentos.

**C3. TEF e maquininha integrada (P2)**
- **Hoje:** o PDV está em modo simulado (sem `agenteUrl`).
- **Fazer:** integrar Stone (ou InfinitePay Tap, que a Stallone já usa) no PDV e na comanda.
- **Aceite:** um pagamento de teste aprovado fecha a comanda e gera o comprovante.

### Onda D: experiência do cliente (P1, M)

**D1. App do cliente com a marca da empresa (PWA)**
- **Hoje:** existem páginas soltas: passe QR (`/clube/passe/<token>`), contrato (`/contrato/<token>`), Pix (`/clube/pagar/<token>`), agendamento (`/agendar/<slug>`) e loja. O `PortalCliente.jsx`, que tinha dados fictícios, foi removido na Parte 1.
- **Fazer:**
  - PWA instalável por empresa (manifest com nome, cor e ícone da empresa).
  - Login por WhatsApp com código.
  - Telas:
    - **clube:** minhas reservas de quadra e aulas (reservar e cancelar, usando `quadras/servico.js` e `aulas/servico.js` com `origem: 'app'`), passe QR, mensalidade com Pix e contratos;
    - **barbearia:** agendamentos, clube de assinatura, cashback;
    - **loja:** pedidos e crediário.
- **Aceite:**
  - Um sócio do TTC instala o app, reserva uma quadra e entra na catraca com o QR.
  - Um cliente da Dino agenda e vê o cashback.
  - Testado em iOS e Android.

**D2. Matrícula online com checkout e reserva de quadra paga**
- Página pública de planos do clube.
- Adesão com contrato e 1ª mensalidade (reaproveitar `clube/adesao.js`).
- Reserva de quadra para não sócio com pagamento antecipado por Pix, que libera o horário se não pagar em X minutos.

**D3. Barbearia: catálogo de serviços separado de profissional e Google Reserve**
- **Hoje:** os serviços estão como "Corte com Dino", "Corte com David" etc.
- **Fazer:**
  - Serviço único, com preço e duração por profissional.
  - Migração dos cadastros atuais da Dino, preservando o histórico.
  - Integração com o Reserve with Google.

### Onda E: plataforma (P1/P2, M)

**E1. Billing do próprio Kytto e cadastro self-service (P1)**
- **Hoje:** `Billing.jsx` está órfã e `/api/v1/billing/*` não existe em produção. `app/modules/billing` está fora.
- **Fazer:**
  - Planos (por vertical).
  - Teste grátis.
  - Cadastro da empresa pelo site, criando a empresa e o primeiro usuário.
  - Cobrança recorrente da assinatura e bloqueio suave por atraso.
  - Tela de métricas (MRR, churn) para a administração da plataforma.

**E2. API pública e webhooks (P2)**
- Tokens por empresa com escopos.
- Endpoints de leitura e escrita dos principais objetos.
- Webhooks de eventos (pedido pago, matrícula, reserva).

### Onda F: varejo, food service e academia (P1/P2)

- **F1. Cardápio QR na mesa (P1, M):** a tela `CardapioMesaPublico.jsx` já existe. Criar `/api/public/mesa/:token/{sessao,pedidos,chamar-garcom}` por empresa, com o pedido indo para o KDS (depende de A1).
- **F2. Marketplaces (P2, G):** iFood e 99Food para o bar (pedido entra como comanda de delivery). Mercado Livre e Shopee para o varejo (catálogo e estoque sincronizados, pedidos importados). As telas de canais e delivery (`CanaisFidelidade.jsx`) já estão prontas para `/api/admin/canais-venda` e `/api/admin/delivery/pedidos`.
- **F3. Balança e etiqueta, e módulo de supermercado (P2, G):** a Stallone vende granel por peso. Levar `app/modules/supermercado` e as rotas `/api/supermercado/*` para produção, por empresa: balança Toledo/Filizola por etiqueta EAN-13 de peso e preço, lotes, promoções e transferências.
- **F4. Compras com cotação (P2, M):** `/api/v1/compras/*` (fornecedores, pedidos, aprovação, cotações), por empresa.
- **F5. PDV offline (P2, G):** `app/routes/pdv-offline.js` e a tela `PDVOffline.jsx`. Exige fila local, sincronização com resolução de conflitos e NFC-e em contingência (depende de B1).
- **F6. Catraca de outras marcas e facial (P2, M):** hoje só há Control iD (`app/modules/acesso/controlid.js`). Adicionar Henry e Top Data no mesmo contrato de `acesso/rotas.js` e `regras.js` (o motor de decisão já é independente de marca).
- **F7. Treino e avaliação física (P2, G; só se academia virar foco):** fichas de treino no app (D1), avaliação física com histórico e prescrição assistida por IA.
- **F8. Homologar Wellhub e TotalPass (P2, pequeno):** as integrações estão prontas em `app/modules/parceiros`. Falta o sandbox de cada plataforma e a URL pública no firmware da Control iD.
- **F9. Verticais sem cliente hoje** (loja de moda, oficina, agropecuária, varejo geral): manter em `EM_IMPLANTACAO` até haver cliente. Não ligar sem demanda.

---

## 5. O que NÃO fazer

- Não reescrever o que já está em produção e testado: Clube, quadras, adesão, barbearia, e-commerce, IA do WhatsApp e NFS-e.
- Não ligar um módulo no `server.js` sem testes de isolamento entre empresas.
- Não usar o banco JSON global para dado novo.
- Não mudar as variáveis do WhatsApp nem o Render.
- Não fazer merge sem o OK do Rodrigo.
