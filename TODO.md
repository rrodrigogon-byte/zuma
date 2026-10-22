# Grafo executivo Dino — acompanhamento da entrega

**Branch:** `feat/dino-grafo-executivo-20261022`

**Base:** `fix/kytto-comandas-pdv-20260808` (`a83754aa`)
**Última revisão:** 22/10/2026

## Resultados desta entrega

- [x] **Mapa integrado sem substituir o grafo atual.** Manter Cérebro do atendente → Grafo e ofertas, suas ligações por cliente e as próximas ofertas; acrescentar uma visão geral que cruze clientes/Commerce com operação, finanças e estoque, permitindo examinar riscos, desvios e oportunidades com período e motivo observável. Grafo e rotas de automação exigem unidade ativa; sem unidade não consultam nem enfileiram dados tenant-wide.
- [x] **Sinais operacionais e financeiros rastreáveis.** Exibir volume/status de agenda, conclusões, cancelamentos e faltas; decidir a fonte pelo resolvedor canônico em modo estrito por unidade e evidência local, sem somar JSON com PostgreSQL. Sem vínculo legado assinado coincidente, nunca consultar JSON; somente usar PostgreSQL filtrado por empresa+loja com cobertura parcial. Se o ambiente exigir JSON e o vínculo faltar, indicar indisponibilidade. Não contar histórico importado como operação atual. Ocupação fica fora desta entrega porque a medição disponível só lê JSON, enquanto a fonte canônica pode ser PostgreSQL. A visão executiva exige empresa e unidade ativa autorizadas; sem unidade não consulta dados tenant-wide. Mostrar receitas pendentes vencidas, diferenças de fechamento de caixa e variações de receita/despesa somente com empresa e loja identificadas, janela e cobertura suficientes. Financeiro/Caixa legados só são lidos quando os IDs de empresa e loja do token assinado coincidem com os do Commerce; sem isso ficam indisponíveis em vez de consultar a empresa inteira. Não tratar comissão estimada como repasse pago.
- [x] **Estoque e oportunidades comerciais conectados.** Cruzar apenas estados de pedidos confirmados aceitos pelo grafo, produtos publicados, preço/custo vigente e saldo mínimo/disponível por local ativo com vendas e serviços observados. Estoque local de revenda só entra quando a unidade ativa estiver vinculada por IDs coincidentes e validados; itens sem loja são excluídos e deixam a cobertura parcial, sem incluir estoque de outra unidade. Sem vínculo, a fonte fica indisponível. Associar venda/cliente apenas quando a identidade for verificável. Contagem de reembolsos representa somente o status do pedido, sem inferir o valor ou a liquidação do estorno. Explicar cada oportunidade; não prometer margem, disponibilidade futura nem probabilidade calibrada.
- [x] **Análise por IA sob demanda e minimizada.** Oferecer ação explícita que use o fluxo `previsao_gerencial` já existente apenas com indicadores agregados, sem nome, telefone, ID de cliente ou texto de conversa; respeitar o teto diário da empresa e manter sinais determinísticos disponíveis quando a IA estiver indisponível ou sem orçamento. A chamada registra somente metadados de uso/custo no log existente, sem persistir prompt, resposta ou dados pessoais. A memória empresa/telefone usada pelo assistente WhatsApp durante o atendimento permanece como comportamento existente e não é redefinida pelo painel.
- [x] **Privacidade, escopo e leitura segura.** Restringir dados à empresa/unidade autorizada; exigir igualdade exata dos IDs de empresa/loja antes de ler legado e UUID válido; o próprio loader também bloqueia consulta Commerce sem empresa+unidade. Se a unidade estiver ausente, não permitir leitura Kytto/Commerce tenant-wide; o scheduler usa o escopo da loja ativa do canal e pula/loga vínculo ausente ou inválido. Memória administrativa do Customer 360 exige unidade ativa: resumos são filtrados por `loja_id`, fatos só aparecem/mudam quando a fonte é resumo da mesma loja, e o esquecimento cancela apenas sessões/fila/resumos/fatos atribuíveis a essa unidade; identidade sem fonte de loja não é exposta nem alterada nessa operação. A memória empresa/telefone do runtime WhatsApp permanece inalterada e fora do escopo da tela. Manter identidade ambígua separada, consentimento/anonimização, telefone mascarado e estados de qualidade `ok`/`limitado`/`indisponível`. Não gravar dados de negócio, alterar pedidos/estoque, unir identidades, disparar mensagens nem executar automações a partir desta análise executiva.
- [x] **Interface coerente com Kytto.** Ampliar a aba existente com mapa/resumo executivo da unidade ativa, filtros de período/área, origem/cobertura dos sinais e acesso ao grafo de um cliente, reutilizando os padrões visuais existentes. Ao trocar empresa/unidade, limpar e recarregar todos os dados da tela para não exibir o escopo anterior; não criar aplicação paralela, migração ou dependência nova.
- [ ] **Entrega protegida.** Manter o trabalho em branch derivada de `fix/kytto-comandas-pdv-20260808`; validar e abrir PR com a mesma base. Não fazer merge, deploy, alterar Render/WhatsApp nem promover automaticamente a produção.

## Evidências desta entrega

- Testes focados no commit-base atual: **138 aprovados, 0 falhas**; cobrem grafo, memória por unidade, referências de cliente, loader, agenda, estoque/revenda, scheduler e módulos da Barbearia Dino adicionados à base.
- Build do frontend `npm run build` em `web/`: **concluído com sucesso**.
- `node --check` nos módulos alterados e `git diff --check`: **concluídos sem erro**.
- Suíte Node ampla no commit-base atual: **1.761 testes, 1.668 aprovados, 8 falhas e 85 ignorados**. As 8 falhas são hooks `PG real` e retornam `PostgreSQL 16 local ausente: initdb`; o ambiente não dispõe do binário local necessário para esses testes. Não foram executados testes contra banco de produção.
- Nenhuma migration, configuração Render, variável de WhatsApp, publicação, merge ou deploy foi alterado nesta entrega.

## Entregas anteriores preservadas da base de produção

- [x] **Fundação operacional 083.** Migration incremental, checksum e runner com lock/reexecução para outbox, efeitos, reversões, reservas, waitlist, NPS, quarentena e webhooks.
- [x] **Escopo multiloja.** Agenda, cobrança, ledger, caixa, comissões, repasses, fidelidade, lista de espera, estoque, compras, NF-e, revenda e comandas respeitam empresa + unidade; legado sem `lojaId` fica fora da sessão de loja ou em diagnóstico/quarentena.
- [x] **Agenda e receita comprovada.** `dataHora`/`horaLocal` coerentes com `America/Cuiaba`, calendário e jornada; ocupação não vira receita sem recebimento financeiro verificado; replays de recebimento são idempotentes.
- [x] **Cobrança e retorno de pagamento.** InfinitePay valida exclusivamente o `invoice_slug` persistido, com proteção contra divergência, duplicidade, timeout e confirmação forjada; efeitos pendentes têm rastreabilidade para reconciliação.
- [x] **Outbox e worker operacional.** Lease, retry, backoff, dead-letter, idempotência, auditoria e métricas com testes determinísticos.
- [x] **Estorno coordenado e reserva de estoque.** Estornos são append-only e idempotentes; hold, commit, release, expiração e cancelamento evitam dupla baixa e concorrência.
- [x] **Lista de espera, fidelidade e NPS.** Escopo por loja, aceite com TTL, ledger canônico Commerce/PostgreSQL, NPS opt-in, pendências e processamento pelo worker.
- [x] **Proteções de integração e projeção inteligente.** Rate limit, deduplicação, assinatura/owner de webhook; motor de projeção por loja com receita paga, serviços, revenda, histórico, capacidade, metas e profissionais, horizonte até seis meses.

## Evidências históricas da base (não são validação desta entrega)

- Gate focado dos bloqueios: 137 testes aprovados.
- Suíte Node ampla: 1.696 testes descobertos, 1.603 aprovados; 8 falhas de hooks PostgreSQL real por ausência de `initdb`.
- Projeção/runtime de captação: 27 testes aprovados; build web Vite aprovado com aviso existente de importação dinâmica/estática.
- O registro anterior indicava lint indisponível naquele checkout por falta de configuração ESLint.
