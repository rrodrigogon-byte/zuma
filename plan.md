# Plano — Grafo de negócios interativo e BI da Barbearia Dino

## Contexto e escopo

A produção `fix/kytto-comandas-pdv-20260808` na revisão `4aee66b4` já contém o Cérebro executivo, o BI/relatórios interativos, histórico financeiro Avec e o escopo dedicado do host Dino. Esta solicitação parte dessa base para elevar o grafo de um resumo de nós fixos a um explorador de relações de negócio. Não cria aplicação paralela nem substitui as visões BI existentes.

O BI existente fornece read-model consolidado, histórico financeiro Avec identificado, período customizado e comparação equivalente, detalhes por dimensão, gráficos/tabelas acessíveis, exportação e impressão. A análise gerencial permanece sob clique explícito, autorização e orçamento, recebendo somente métricas agregadas. A experiência não infere ocupação sem capacidade comparável, demografia, avaliações nem atribuição profissional ausentes.

A referência indicada é [CasaNossa — plataforma/grafo](https://nossacasa.kytto.com.br/plataforma/grafo). A rota pública retornou shell/login e não foi possível observar grafo autenticado; tampouco foi encontrado código CasaNossa reutilizável. A solução é própria, inspirada no objetivo de explorar relações, sem alegação de cópia pixel a pixel nem invenção de funcionalidades da referência fechada.

A branch de trabalho é `feat/dino-grafo-completo-20261023`, alvo `fix/kytto-comandas-pdv-20260808`. Foi rebaseada sobre `4aee66b4`; a reconciliação preservou os novos links de BI e as mudanças do grafo. O PR draft #399 está aberto para promoção pelo fluxo protegido; o GitHub reportou `CLEAN/MERGEABLE` antes das alterações locais de fail-closed CRM. O usuário autorizou agora deploy completo em produção, sujeito aos checks finais e ao merge por PR.

## Arquitetura e dados

- `app/dino-grafo.js` permanece a fonte de verdade das relações operacionais (`INDICOU`, `COMPROU`, `AGENDOU`, `ATENDIDO_POR`, `PERGUNTOU` e `INTERESSE`) e do grafo ego individual, com consentimentos, autorização, token opaco e mascaramento.
- `app/dino-grafo-rede.js` transforma relações e agregados já carregados em rede executiva tipada, com fontes, qualidade, janelas, limites e nós/arestas determinísticos.
- `app/dino-grafo-executivo.js` calcula indicadores/sinais. `app/ai-brain-data.js` e `app/ai-brain-routes.js` carregam apenas dados autorizados e escopados por empresa+unidade; a IA continua explícita, sob demanda e agregada.
- `web/src/pages/admin/dino/BusinessNetworkGraph.jsx` e `businessNetworkLayout.js` compõem o explorador SVG acessível, sem biblioteca de visualização nova. `CerebroIA.jsx` integra filtros, details, ego graph e navegação do BI (`tab`, `dias`, `origem=bi`).
- `app/barbearia-erp-kytto.js` acrescenta metadado analítico `estoqueInformado`, sem alterar o saldo operacional do PDV: quantidade explícita/movimento torna saldo conhecido; default legado `0` sem prova de movimento permanece desconhecido.
- A migration `085_ai_automation_log_store_scope.sql`, aprovada pelo usuário para limitar logs/cotas por unidade (053 já existe), adiciona `loja_id` nullable a `ai_automation_log`, preserva histórico sem backfill, cria idempotência por empresa+loja e FK composta apoiada por índice UNIQUE. Está registrada no runner e no checksum, porém não foi aplicada a banco.

## Modelo do grafo e semântica

A rede inclui unidade, hubs de clientes/operação/financeiro/Commerce/estoque/oportunidades, KPIs e entidades observadas: clientes anonimizados, produtos, serviços, profissionais, estados de pedidos e sinais financeiros/caixa. Valores monetários são BRL; taxas informam denominador; saldo de ledger não é lucro; valor capturado não é líquido de estornos; demanda observada não é volume vendido nem previsão calibrada. Sem custo conhecido não há margem.

Arestas partem de relações existentes e evidência agregada, não de ligações inferidas. Eventos repetidos consolidam peso/ocorrências, nunca unidades vendidas. Links estruturais conectam hubs e entidades para contexto, têm natureza explicitamente diferente de evento, não recebem peso de venda e não são tratados como evidência observada. Sob limite, unidade/raiz, hubs e KPIs são preservados antes de entidades; eventos observados têm prioridade sobre links estruturais. O resumo apresenta contagens de relações observadas e estruturais omitidas.

KPIs executivos de agenda, financeiro, pagamentos e pedidos usam períodos disponíveis (30/90 dias). Relações datadas usam janela móvel explícita de 365 dias; eventos sem data têm janela/qualidade própria e não viram ocorrências temporais. Recebíveis vencidos são uma posição atual na data de consulta. Estoque é snapshot atual; saldos Commerce exigem cobertura completa de variantes×localizações ativas, e timestamp usa `commerce_inventory_levels.atualizado_em` quando presente, nunca um `now` sintético. Ausência, dado inválido ou cobertura limitada continuam desconhecidos, não zero/verde.

A API executiva não retorna nome/telefone/ID bruto de cliente, pedido, Commerce/ERP nem texto de conversa/interesse. Clientes são rótulos anônimos com token opaco scoped por empresa+unidade; abrir o ego graph permanece submetido à autorização/consentimento existentes. O rótulo central usa “Unidade ativa” salvo contexto autorizado.

## Direção visual e interação

A interface é inteligência operacional orientada por relações dentro do shell administrativo Dino, não um clone presumido da CasaNossa. Usa tokens do produto, legenda, canvas SVG responsivo, zoom/enquadramento, pesquisa, filtro de área/tipo, seleção de nó/aresta, realce de vizinhos e painel com peso, fontes, janela e qualidade. A alternativa tabular é acessível por teclado e adequada a telas estreitas. Cor de risco só representa risco observado; fonte desconhecida usa marcador neutro. Movimento fica restrito a foco/seleção curta, sem simulação contínua.

O filtro global atua em rede, KPIs, sinais e fontes. Ao trocar empresa/unidade/período, seleção e dados anteriores são limpos e respostas fora de ordem são descartadas. Navegação pelo BI mantém o contexto de aba/período em query parameters.

## Restrições de segurança e pendências

Preservar `reports.read`, UUID/empresa/unidade ativa, vínculo legado canônico e filtros Commerce/Kytto. Sem unidade válida, falhar fechado, sem consulta tenant-wide. A IA recebe métricas agregadas e janelas explícitas; não aciona envio, alteração de pedido/estoque ou automação. Scheduler, logs, cotas, cooldown e reservas de marketing são scoped por unidade; `SAIR` permanece opt-out global. O runtime de memória/conversa do WhatsApp permanece fora do escopo.

O schema atual não comprova afinidade cliente–loja para campanhas CRM. Portanto, `queryAudience`, `listCampaignAudience`, preview, confirmação/envio e alteração administrativa de consentimento falham fechados com HTTP 409 antes de ler clientes; rascunhos continuam permitidos. O opt-out explícito `SAIR` permanece global. A reativação segura exige modelo explícito de afinidade cliente–loja, backfill auditado e gerenciamento, a ser entregue como mudança separada; não se presume afinidade a partir de telefone nem de customerId.

## Entrega e validação

O PR #399 permanece o fluxo de promoção para `fix/kytto-comandas-pdv-20260808`. Após rebase em `4aee66b4`, o upstream que fixa o escopo Dino por host foi preservado. Com a barreira CRM, 219 testes focados passaram, `npm run build` passou e sintaxe/diff passaram. A suíte Node integral teve 1.751 aprovados, oito falhas exclusivamente por `initdb`/PostgreSQL 16 local ausente e 85 skipped. A reauditoria read-only confirmou que campanha falha antes de ler audiência; replay idempotente de campanha já executada retorna apenas status/contagem escopados e não gera novo envio. O preDeploy Render observado em 23/10/2026 concluiu com 67 migrations existentes, 0 novas e corte de dados explicitamente pulado. Este PR acrescenta 085, ainda não aplicada nem validada em PostgreSQL real; o próximo preDeploy deve confirmar 68 migrations e sucesso antes do start. A branch está em processo de promoção autorizado pelo usuário, mas nenhum deploy novo deve ser declarado até Render terminar Live e health responder.
