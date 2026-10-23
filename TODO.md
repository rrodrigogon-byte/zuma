# Cérebro IA Dino — acompanhamento

**Branch atual:** `feat/dino-grafo-completo-20261023`
**Base de produção:** `fix/kytto-comandas-pdv-20260808` (`6548c218`)
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
- [ ] **Audiência de campanhas CRM — decisão pendente.** `queryAudience` e `listCampaignAudience` ainda consultam clientes por empresa, não por `loja_id`, porque não há afinidade de unidade comprovável no cadastro. O comportamento foi mantido sem decisão explícita. Pendente escolher: falhar fechado sem afinidade; manter audiência compartilhada como exceção existente; ou criar vínculo de afinidade em outra mudança de schema.

## Referência e limite conhecidos

- [CasaNossa — plataforma/grafo](https://nossacasa.kytto.com.br/plataforma/grafo): a rota pública retornou shell/login; nenhum grafo/controle autenticado pôde ser observado e não foi encontrado código CasaNossa reutilizável. A solução é própria, inspirada no objetivo de explorar relações, sem alegação de cópia.

## Validação e entrega protegida

- A branch foi rebased sobre a base de produção atual `6548c218`; a reconciliação de `CerebroIA.jsx` manteve query params do BI (`tab`, `dias`, `origem=bi`) e os filtros/limpeza do grafo por loja/período.
- Validação nessa base: **217/217** testes focados aprovados, `npm run build` aprovado, sintaxe JS e `git diff --check` limpos. A suíte Node integral registrou **1.746 aprovados**, **8 falhas ambientais** por `PostgreSQL 16 local ausente: initdb` e **85 skipped**; nenhum banco foi alterado.
- Reauditorias independentes aprovaram o hardening de marketing e a estrutura estática da FK composta; não houve execução de DDL em PostgreSQL real. A criação do índice pode exigir scan/lock ao aplicar a migration.
- PR draft [#399](https://github.com/rrodrigogon-byte/agro-open/pull/399) foi atualizado com `--force-with-lease` e o GitHub reporta `CLEAN/MERGEABLE`; nenhum check GitHub foi reportado. Aguardam decisão sobre audiência CRM, revisão e eventual teste DDL real em PostgreSQL. Não fazer merge, deploy, alterar Render/WhatsApp nem aplicar migration sem autorização posterior. A produção continua com a entrega anterior do PR #385.
