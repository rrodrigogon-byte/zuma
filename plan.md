# Plano — Grafo de negócios interativo e BI da Barbearia Dino

## Contexto e escopo

A produção `fix/kytto-comandas-pdv-20260808` na revisão `6548c218` já contém o Cérebro executivo, o BI/relatórios interativos e histórico financeiro Avec. Esta solicitação parte dessa base para elevar o grafo de um resumo de nós fixos a um explorador de relações de negócio. Não cria aplicação paralela nem substitui as visões BI existentes.

O BI existente fornece read-model consolidado, histórico financeiro Avec identificado, período customizado e comparação equivalente, detalhes por dimensão, gráficos/tabelas acessíveis, exportação e impressão. A análise gerencial permanece sob clique explícito, autorização e orçamento, recebendo somente métricas agregadas. A experiência não infere ocupação sem capacidade comparável, demografia, avaliações nem atribuição profissional ausentes.

A referência indicada é [CasaNossa — plataforma/grafo](https://nossacasa.kytto.com.br/plataforma/grafo). A rota pública retornou shell/login e não foi possível observar grafo autenticado; tampouco foi encontrado código CasaNossa reutilizável. A solução é própria, inspirada no objetivo de explorar relações, sem alegação de cópia pixel a pixel nem invenção de funcionalidades da referência fechada.

A branch de trabalho é `feat/dino-grafo-completo-20261023`, alvo `fix/kytto-comandas-pdv-20260808`. A base avançou de `cb141271` para `6548c218` enquanto o PR draft #399 estava aberto; o rebase e a reconciliação dos arquivos compartilhados devem terminar antes de atualizar o PR. Não haverá merge, deploy, mudança de configuração nem aplicação de migration sem autorização posterior.

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

As consultas de audiência de campanhas CRM (`queryAudience`/`listCampaignAudience`) ainda usam empresa sem `loja_id`, pois o cadastro não comprova afinidade por unidade. Não foram alteradas sem decisão explícita do usuário; a pergunta pendente é falhar fechado, manter audiência compartilhada como exceção ou criar vínculo de afinidade separado. Não confundir essa superfície existente com o grafo executivo, que permanece estritamente escopado.

## Entrega e validação

O PR draft #399 foi criado em `https://github.com/rrodrigogon-byte/agro-open/pull/399`; a base avançou depois e o PR precisa de atualização por rebase. Após resolver conflitos em `CerebroIA.jsx`, `TODO.md` e `plan.md`, repetir testes focados, `npm run build`, `git diff --check` e testes disponíveis. O suite Node anterior teve apenas oito casos PostgreSQL real bloqueados por ausência de `initdb`; isso não prova execução real de DDL. Não houve acesso/escrita em banco e a migration 085 não foi executada. Não fazer merge/deploy nem alterar produção; a produção continua na entrega anterior do PR #385 até autorização posterior.
