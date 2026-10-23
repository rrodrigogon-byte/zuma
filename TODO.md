# Cérebro IA Dino — acompanhamento

**Branch atual:** `feat/dino-grafo-completo-20261023`
**Base de produção:** `fix/kytto-comandas-pdv-20260808` (`4aee66b4`)
**Última revisão:** 23/10/2026

## Base já incorporada à produção

- [x] **Grafo executivo e fontes múltiplas.** PR #385 trouxe métricas explicáveis de clientes, agenda, financeiro/caixa, Commerce, estoque e oportunidades, IA sob demanda agregada, isolamento por loja e memória administrativa limitada à unidade.
- [x] **BI e relatórios interativos.** A base atual incorpora o read-model consolidado, histórico financeiro Avec, período e comparação, detalhes por dimensão, visualizações acessíveis, exportação/impressão e IA gerencial somente por clique e com métricas agregadas.
- [x] **Integridade dos indicadores.** A experiência existente evita dupla contagem, não infere ocupação, demografia, avaliações ou atribuição profissional ausentes, e informa cobertura/fonte.
- [x] **Grafo ego e base operacional preservados.** `customerEgo` continua com autorização, token opaco, mascaramento e limites. Outbox/worker, cobrança, reservas, estoque, agenda, waitlist, fidelidade, NPS, integração e projeção seguem na base de produção.

## Evolução do grafo — esta solicitação

- [x] **Rede tipada e derivada de relações reais.** Inclui unidade, hubs, KPIs e entidades observadas (clientes anônimos/opacos, produtos, serviços, profissionais, pedidos, operação, financeiro/caixa, estoque e oportunidades). Arestas consolidam eventos com fonte, janela e qualidade. Raiz, hubs e KPIs são preservados no limite; eventos observados têm prioridade sobre agrupamentos estruturais; omissões observadas/estruturais têm contagens separadas. Ocorrências não são unidades vendidas e conexões não são inferidas.
- [x] **Privacidade e cobertura.** A rede executiva não retorna nomes/telefones/IDs brutos nem texto livre; usa rótulos anônimos, tokens scoped por empresa+unidade e categorias de interesse. Desconhecido não vira zero ou risco inventado. O estoque Commerce só é conhecido com cobertura completa variante×localização; revenda sem movimento/saldo comprovado permanece desconhecida.
- [x] **Janelas explícitas.** Métricas executivas respeitam 30/90 dias; relações datadas usam 365 dias; sem data têm estado separado. Recebíveis vencidos são posição atual e estoque é snapshot com timestamp real. Ledger não é lucro, capturado não é líquido de estorno e demandas não são volume ou probabilidade calibrada.
- [x] **Explorador acessível.** A aba possui pesquisa, filtro por área, SVG responsivo, zoom, seleção, destaque de vizinhos, detalhes de evidência/proveniência/cobertura e alternativa tabular acessível.
- [x] **Troca de escopo e período.** A mudança de empresa/unidade/período limpa dados antigos e descarta respostas atrasadas. Navegação vinda do BI preserva `tab`, `dias` e `origem=bi` via query parameters.
- [x] **Limites de automação por loja.** Scheduler, guards, logs, cotas, cooldown e reservas de marketing foram ajustados para empresa+unidade. Opt-out explícito `SAIR` permanece global. Skips terminam o registro de domínio e resultados de envio ambíguos não geram retry inseguro. O grafo não dispara mensagens.
- [x] **Migration 085 aprovada pelo usuário.** Acrescenta `loja_id` a `ai_automation_log`, mantém históricos sem vínculo como NULL (sem backfill), cria índices de idempotência por unidade e FK composta com índice UNIQUE de suporte. 053 já estava ocupado. Registrada no runner/checksum; ainda não aplicada a banco.
- [x] **Audiência CRM fail-closed até haver afinidade.** Sem vínculo verificável cliente–unidade, listagem de audiência, preview, confirmação/envio e alteração administrativa de consentimento retornam HTTP 409 antes de ler clientes; rascunhos podem ser criados, mas não geram envios. O comando de opt-out explícito `SAIR` permanece global. Isso cumpre o isolamento agora; reativar campanhas requer modelo explícito de afinidade cliente–loja, preenchimento auditado e UI/fluxo de gerenciamento em mudança própria.

## Referência e limite conhecidos

- [CasaNossa — plataforma/grafo](https://nossacasa.kytto.com.br/plataforma/grafo): a rota pública retornou shell/login; nenhum grafo/controle autenticado pôde ser observado e não foi encontrado código CasaNossa reutilizável. A solução é própria, inspirada no objetivo de explorar relações, sem alegação de cópia.

## Validação e entrega protegida

- A branch foi rebased sobre a produção atual `4aee66b4`; a reconciliação de `CerebroIA.jsx` manteve query params do BI (`tab`, `dias`, `origem=bi`) e os filtros/limpeza do grafo por loja/período. O upstream adicionou escopo por host Dino e foi preservado.
- Validação final da barreira CRM na base `4aee66b4`: **219/219** testes focados passaram, `npm run build` passou, sintaxe Node e `git diff --check` passaram. A suíte Node integral registrou **1.751 aprovados**, **8 falhas ambientais** em testes PostgreSQL real por `initdb` ausente e **85 skipped**; nenhum banco foi alterado.
- Reauditoria read-only confirmou que audiência, preview, envio normal e consentimento falham antes de ler clientes; replay idempotente de campanha já não-rascunho retorna somente status/contagem scoped sem consultar audiência nem criar novo envio. `SAIR` continua global. Não houve execução real de DDL 085; o índice pode fazer scan/aguardar locks no preDeploy.
- PR draft [#399](https://github.com/rrodrigogon-byte/agro-open/pull/399) segue no fluxo obrigatório para a branch de produção. Antes das mudanças locais, GitHub reportou `CLEAN/MERGEABLE` e nenhum check; atualizar head e validar estado depois do commit. O usuário autorizou deploy completo; ainda não houve merge nem novo deploy. O preDeploy atual tem evidência de cutover pulado, mas o novo deploy e a aplicação de 085 precisam ser confirmados no Render antes de declarar sucesso.


## Melhoria de UX e links dos indicadores — 23/10/2026

- [x] Adicionada uma faixa de acesso rápido no Dashboard Dino com links visíveis para BI/Relatórios, Agenda, Clientes, Serviços, Revenda/Estoque, Planos, Equipe e Commerce.
- [x] Reorganizado o grid dos seis KPIs para três colunas em desktop, duas em tablet e uma em celular, mantendo período, tendência, valor e texto de ação.
- [x] Cada KPI principal abre seu detalhe coerente: faturamento, resultado e ticket em Relatórios; clientes em Clientes; agendamentos em Agenda; conversão no BI com cobertura explícita quando o tracking estiver indisponível.
- [x] Adicionado acesso aos detalhes nos cards de contas a receber, estoque baixo separado por Revenda/Commerce, MRR e Histórico Avec.
- [x] Adicionadas ações aos painéis de faturamento diário, pagamentos, categorias, produtos/serviços, funil, horários, canais, agenda e atividade.
- [x] Adicionados links nos itens e no rodapé do Mix estratégico para serviços, produtos, planos e relatório consolidado. Valores não classificados continuam fora das fatias; planos fora de escopo agora exibem “Cobertura indisponível”, não receita zero.
- [x] Preservada navegação atual do ERP, query strings do BI, exportação CSV e acessibilidade por teclado. Os deep-links de Relatórios carregam o mesmo intervalo `de`/`até` do indicador; o BI busca o mix também em recortes personalizados.
- [x] Executados build web, testes Node focados/contrato e teste de exportação do BI. A suíte Node integral teve somente oito falhas ambientais conhecidas em PostgreSQL real por `initdb` ausente; PR pendente de criação contra `fix/kytto-comandas-pdv-20260808`.
