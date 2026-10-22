# Operação Dino — Auditoria técnica e backlog da próxima etapa

## 1. Escopo e conclusão executiva

Este relatório consolida os cinco resultados auditados: **Cobranças e assinaturas**, **NPS e fidelização**, **Lista de espera e retorno previsto**, **Agenda, ocupação e comissões** e **Atendimento, revenda e compras**.

**Conclusão:** o núcleo funcional está implementado e exercitável, mas a operação ainda está **parcialmente implementada e não deve ser declarada pronta para produção multiloja**. Os maiores riscos são vazamento entre unidades, efeitos financeiros não reconciliados, entradas fiscais sem validação/atomicidade suficiente, retorno público InfinitePay quebrado, métricas que tratam concluído como pago e ausência de alguns fluxos de reversão/recuperação.

A projeção de faturamento (commit `97c8ed80` e arquivos da branch `feat/dino-projecao-faturamento-ia-20261022`) é evidência de código/teste na branch, **não de deploy, publicação ou habilitação em produção**.

### Critério de prioridade

- **P0:** risco de perda financeira, fraude, vazamento entre tenants/unidades, erro fiscal ou quebra do caminho principal de pagamento.
- **P1:** risco operacional relevante, inconsistência/reprocessamento ou falha de entrega que pode deixar o negócio sem controle.
- **P2:** melhoria de operação, observabilidade, UX, cobertura e qualidade após os bloqueadores.

## 2. O que já está implementado

| Bloco | Capacidades comprovadas | Limite da evidência |
|---|---|---|
| Cobranças e assinaturas | Configuração desligada por padrão; validação de Pix; sinal Pix/InfinitePay; idempotência; confirmação de pagamento; clube com tentativas/pausa/reativação; cashback FIFO; vale-presente; painel e proteção de sessão/gestão. | O retorno público InfinitePay perde `slug`; dinheiro e rotinas não têm escopo de unidade; falhas financeiras são silenciosas; painel não recupera cobrança pendente; publicação não verificada. |
| NPS e fidelização | NPS pós-atendimento com janela, idempotência e recorte por unidade; convite com revalidações de consentimento; endpoint público; indicação com código estável e tentativa de crédito dos dois lados. | Existem dois livros de fidelidade sem ponte demonstrada; não há reconciliação de pendências; conclusão depende de caminho HTTP específico; fila/worker PostgreSQL não foi validado em execução real. |
| Lista de espera e retorno | Persistência, expiração, limite, consentimento/SAIR, avisos idempotentes, revalidação no worker, retorno por mediana e sugestão de horário, painel administrativo. | Seleção não exige serviço/unidade em todos os pontos; admin/remarcação não fecham ou reabrem a vaga corretamente; broadcast não tem hold/aceite; retornos misturam histórico de lojas. |
| Agenda, ocupação e comissões | Motor de agenda, conflitos, bloqueios, calendário por unidade, recebimento idempotente, ledger, comissões, vales, repasse, estorno e painel de ocupação/metas. | Extratos/repasses não recebem `lojaId`; POST administrativo pode omitir `horaLocal`; metas usam concluído sem recebimento como receita; idempotência admin e política para legado sem unidade faltam. |
| Atendimento, revenda e compras | Comandas com pagamentos parciais/mistos no domínio, baixa de estoque e financeiro; revenda; compras e recebimento parcial no domínio; prévia de NF-e; reposição/ABC; painéis operacionais. | Escopo de loja inconsistente; NF-e sem validações fiscais demonstradas e sem rollback abrangente; não há devolução/estorno de venda paga; revenda não integra claramente caixa; UI expõe apenas parte do domínio. |

## 3. Backlog priorizado por bloco

### B1 — Cobranças e assinaturas

| ID | Prioridade | Entrega acionável | Dependências | Aceite mínimo |
|---|---:|---|---|---|
| COB-01 | P0 | Corrigir o retorno público InfinitePay para preservar/validar `slug` ou derivá-lo de forma segura antes de `confirmarPelaInfinitePay`. | Contrato da rota pública e adapter fake/real de teste. | Retorno com pagamento pendente, capturado, valor/método divergente, slug inválido e replay produz estados idempotentes; nenhum horário confirmado com payload inválido. |
| COB-02 | P1 | Aplicar `lojaId` estrito a configuração, cobrança, carteira, índice, painel, confirmação, geração de mensalidade e cashback; decidir explicitamente se algo é corporativo. | Política única de unidade; eventual migração de registros sem unidade. | Duas lojas da mesma empresa não conseguem listar, configurar, confirmar ou gerar cobranças uma da outra; relatórios e cashback permanecem isolados. |
| COB-03 | P1 | Tornar confirmação/efeitos/financeiro reconciliáveis: `registrarReceita` deve retornar erro rastreável, anexar lançamento à cobrança e deixar pendência/retry quando efeito ou financeiro falhar. | Ledger central, chave idempotente e estado de reconciliação. | Falha de lançamento não deixa cobrança silenciosamente paga; retry é idempotente e não duplica receita/efeito. |
| COB-04 | P1 | Fazer configuração transacional: validar provedor antes de substituir configuração e impedir `opcoes.provedor` não autorizado em chamadas internas. | Contrato de configuração e persistência utilizada pelo motor. | Resposta 409 não altera configuração observável; provedor inválido é rejeitado antes de qualquer mutação. |
| COB-05 | P1 | Corrigir fechamento com vale/cashback para desfazer somente débitos criados pela tentativa atual; versionar/recalcular sinal após remarcação ou mudança de serviço/preço. | Identificador da tentativa e vínculo sinal-agendamento/versão. | Replay após débito persistido não devolve saldo; alteração de agenda exige nova cobrança ou revisão quando o valor muda. |
| COB-06 | P1/P2 | Governar webhook e confirmação Pix manual: rate limit/deduplicação, auditoria com valor/NSU/comprovante/motivo e autorização explícita de leituras financeiras. | Política de papéis e mecanismo compartilhado de limite. | Replays e spam são limitados; confirmação manual registra evidência e operador; staff sem papel permitido recebe 403. |
| COB-07 | P2 | Evoluir painel para recuperação da cobrança: copiar Pix, abrir checkout, reenviar aviso, exibir order/NSU/tentativas/revisão/cancelamento e ledger; corrigir métricas para `pagoEm`. | Estados de revisão e dados de pagamento. | Recepção recupera um pagamento pendente; indicadores de 30 dias usam pagamento, não criação. |

### B2 — NPS e fidelização

| ID | Prioridade | Entrega acionável | Dependências | Aceite mínimo |
|---|---:|---|---|---|
| FID-01 | P0 | Definir fonte única de saldo e migrar/reconciliar `db.canaisKytto` com o ledger avançado por empresa/unidade, ou adaptar o painel avançado para ler a fonte escolhida. | Decisão de escopo corporativo/unidade; migração idempotente. | Uma indicação creditada aparece no saldo canônico, pode ser resgatada/expirada e não é duplicada após migração/reexecução. |
| FID-02 | P1 | Criar outbox/job de reconciliação para `aguardandoFidelidade` e convites NPS não enfileirados, com retry, auditoria e alerta. | PostgreSQL/worker operacional e status de entrega. | Programa/canal indisponível no momento da conclusão gera pendência recuperável; reprocessamento idempotente credita/enfileira uma vez. |
| FID-03 | P1 | Corrigir duplicidade de indicação por status da reserva e exigir cliente indicado válido antes de marcar recompensa; registrar exceção quando anonimizado/ausente. | Estados de agendamento e política de anonimização. | Cancelado/não compareceu pode ser reindicado conforme regra; cliente ausente não deixa indicação como recompensada sem crédito válido. |
| FID-04 | P1 | Centralizar a transição para concluído ou criar reconciliação para que finance, indicação, plano e NPS sejam executados para HTTP, ERP e chamadas internas. | Serviço único de conclusão ou job de varredura. | Cada origem de conclusão produz efeitos uma vez; replay não duplica convite, pontos, consumo ou financeiro. |
| FID-05 | P1/P2 | Substituir rate limit em `Map` por limite compartilhado por IP/tenant/código e contar também entradas inválidas relevantes sem bloquear indiscriminadamente uma rede. | Armazenamento distribuído e métricas de abuso. | Reinício/múltiplos processos preservam o limite; excesso retorna 429 e não enumera dados. |
| FID-06 | P2 | Criar operação de detratores e visão detalhada de indicações, com acesso mínimo, responsável/prazo/resolução, filtros e exportação auditada. | Política de PII/contato e auditoria. | Nota detratora pode ser atribuída e encerrada; contato só aparece para papel autorizado. |

### B3 — Lista de espera e retorno previsto

| ID | Prioridade | Entrega acionável | Dependências | Aceite mínimo |
|---|---:|---|---|---|
| LST-01 | P0/P1 | Centralizar seleção de candidatos exigindo empresa, `lojaId`, serviço, profissional/período e status; repetir validação no worker. | Política de correspondência serviço/unidade. | Vaga de Barba não avisa Corte; vaga da Loja A não avisa espera da Loja B; worker rejeita tarefa incompatível. |
| LST-02 | P1 | Fechar entrada de espera de modo idempotente quando o agendamento nasce no público, admin ou WhatsApp; usar chave composta por loja/serviço quando aplicável. | Evento/serviço único de criação de agendamento. | Agendamento administrativo remove a espera correta; esperas legítimas de lojas/serviços distintos permanecem. |
| LST-03 | P1 | Emitir evento de vaga também em remarcação e criar deduplicação por appointment/slot. | Contrato de remarcação e fila. | O horário antigo liberado gera candidatos; uma mesma vaga não dispara avisos duplicados. |
| LST-04 | P1 | Substituir broadcast sem reserva por aceite/booking com TTL ou hold transacional, se confirmado no desenho do produto. | Reserva atômica de slot e link de agendamento. | Primeiro aceite reserva atomicamente; demais ofertas expiram/atualizam sem confirmar dois clientes no mesmo slot. |
| LST-05 | P1 | Filtrar retornos históricos/futuros por unidade e depois segmentar intervalo por serviço; validar `dias` entre 1 e limite operacional. | Política de amostra mínima e parâmetros de rota. | Visitas de outra loja não alteram atraso/sugestão; dias negativo ou excessivo retorna erro controlado. |
| LST-06 | P2 | Validar profissional/disponibilidade no domínio, criar máquina de transição com motivo/actor/auditoria e completar filtros/ações da UI. | Matriz de papéis e contrato de interface. | API rejeita profissional inválido/horário livre não compatível; alterações de status deixam trilha. |

### B4 — Agenda, ocupação e comissões

| ID | Prioridade | Entrega acionável | Dependências | Aceite mínimo |
|---|---:|---|---|---|
| AGE-01 | P0 | Propagar `lojaId` estrito para extrato, vales, repasses, pote e estorno; definir tratamento/migração de registros legados sem unidade. | Política de tenant/unidade e migração. | Gerente da Loja A não visualiza nem paga comissão da Loja B; pagamento sem unidade é bloqueado ou explicitamente segregado. |
| AGE-02 | P0 | Tornar `horaLocal` obrigatório/derivável e validar janela no domínio, independentemente do cliente, em POST/PATCH admin. | Contrato de timezone Cuiabá e jornada da unidade/profissional. | Fora da abertura, jornada, feriado ou timezone é rejeitado mesmo com `horaLocal` omitido pelo frontend. |
| AGE-03 | P0 | Separar minutos ocupados de receita recebida: metas, ocupação e projeção usam lançamento/recebimento verificado; concluído sem pagamento vira pendência explícita. | Fonte canônica de ledger/comanda. | Concluir sem receber mantém ocupação, mas não aumenta receita/meta/projeção nem comissão paga. |
| AGE-04 | P1 | Adicionar idempotência ao POST/PATCH administrativo da agenda com `Idempotency-Key`/`actionId`, payload normalizado e conflito de chave detectado. | Persistência de chaves e contrato de retry. | Duplo clique/retry não cria duplicata; mesma chave com payload diferente é rejeitada. |
| AGE-05 | P1 | Alinhar matriz de papéis para leitura e mutação de comissão/vale/repasse, permitindo conferência do gerente sem abrir administração indevida. | Matriz de autorização revisada. | Casos admin/organizador/gerente/equipe retornam 200/403 conforme matriz documentada. |
| AGE-06 | P2 | Cobrir UI crítica, pendências de caixa, estorno e concorrência/PostgreSQL; estabilizar fixtures e serialização de DB. | Ambiente de integração e isolamento de `DB_PATH`. | Testes de componente e contratos cobrem submit, erro, unidade, pagamento parcial, vale, repasse e estorno. |

### B5 — Atendimento, revenda e compras

| ID | Prioridade | Entrega acionável | Dependências | Aceite mínimo |
|---|---:|---|---|---|
| ATV-01 | P0 | Aplicar política única de loja a listagens legadas, produtos, estoque, vendas e comissões; rejeitar vazamento por registros sem `lojaId` sob sessão multiloja. | Política AGE-01 compartilhada e migração/flag para legado. | A sessão de uma loja não lista nem vende estoque/venda de outra; exceções sem unidade são auditadas ou bloqueadas. |
| ATV-02 | P0 | Endurecer NF-e com validação de assinatura/autorização demonstrável, CNPJ destinatário, emitente e vínculo; exigir papel de gestão e tornar entrada multi-item transacional ou compensável. | Integração/artefatos fiscais disponíveis e mecanismo de transação. | XML não autorizado/destinatário divergente não entra; falha no item N não deixa itens 1..N-1 sem reconciliação. |
| ATV-03 | P0 | Implementar devolução/estorno/cancelamento de revenda e comanda paga, revertendo estoque, ledger, caixa, comissão e fidelidade com auditoria. | Modelo de reversão e chaves idempotentes. | Correção/reembolso é uma operação rastreável; replay não duplica estorno nem saldo. |
| ATV-04 | P1 | Integrar revenda ao caixa diário (`caixaId` ou seleção estrita por unidade) e expor pagamentos mistos/profissional por item na UI. | Contrato de caixa e comanda. | Venda paga aparece no fechamento por meio; rateio de meios não perde valor nem duplica recebimento. |
| ATV-05 | P1 | Expor recebimento parcial de compras, divergência, edição/arquivamento de produto/serviço e histórico de movimentos. | Endpoints PATCH/movimentos existentes e autorização. | Painel permite receber quantidades parciais e continuar; alteração deixa histórico e respeita estoque. |
| ATV-06 | P1 | Definir preço final auditado para “sob consulta”, reserva/baixa concorrente de estoque e bloqueio de alterações abaixo do já pago. | Política comercial e lock/reserva de estoque. | Item sem preço final não fecha; duas vendas não consomem saldo único; comanda parcialmente paga não reduz total sem reconciliação. |
| ATV-07 | P2 | Rotular projeção como previsão bruta (não caixa/margem) e validar artefato, feature flag, permissões e publicação antes de anunciá-la. | Gate de deploy e dados de produção. | Só é comunicada como disponível após evidência de artefato/ambiente publicado. |

## 4. Primeiro sprint de implementação (máximo de 8 itens)

O primeiro sprint deve ser orientado a **bloqueadores de segurança financeira, unidade e caminho principal de pagamento**, não a melhorias cosméticas. Os oito itens são:

1. **COB-01 — Corrigir retorno público InfinitePay**, incluindo testes de payload pendente/capturado, divergência, slug inválido e replay.
2. **AGE-01 + ATV-01 + COB-02 — Instituir escopo estrito de `lojaId` nos fluxos financeiros e operacionais críticos**, começando por cobranças, extrato/repasse/vales, vendas/listagens legadas e testes cross-store.
3. **AGE-02 — Fechar bypass de horário da agenda administrativa**, derivando/validando `horaLocal` no servidor e cobrindo abertura, jornada, feriado e timezone.
4. **AGE-03 — Separar receita recebida de atendimento concluído**, corrigindo ocupação, metas, projeção e comissão para não contar valor sem ledger.
5. **ATV-02 — Endurecer NF-e e entrada de compras**, com validações fiscais disponíveis, autorização de gestão e rollback/compensação multi-item.
6. **FID-01 — Escolher e consolidar o ledger canônico de fidelidade**, com migração/reconciliação idempotente e teste de crédito, saldo, resgate/expiração.
7. **LST-01 — Corrigir correspondência de lista de espera**, exigindo serviço e unidade na seleção e no worker, com testes de unidade/serviço cruzados.
8. **COB-03 + COB-05 — Tornar fechamento financeiro e compensações idempotentes/reconciliáveis**, cobrindo falha de lançamento, retry e repetição após débito de vale/cashback já persistido.

### Saída esperada do sprint

- Nenhum caso conhecido de confirmação InfinitePay quebrada por ausência de `slug`.
- Nenhum teste de vazamento cross-store nos fluxos incluídos pode falhar.
- Nenhuma receita de meta/projeção deve nascer somente de status concluído sem recebimento.
- Entrada fiscal inválida ou parcialmente falha não pode deixar estoque/financeiro sem estado reconciliável.
- Pontos e efeitos de cobrança têm fonte/estado único, erro observável e retry seguro.
- Candidatos da lista não recebem oferta de outra unidade ou serviço.

## 5. Dependências e ordem técnica

1. **Política única de tenant/unidade:** decidir o que é por empresa e o que é por loja; definir tratamento de registros sem `lojaId` antes de aplicar filtros estritos.
2. **Fonte canônica financeira:** confirmar ledger/comanda como fonte de recebimento e padronizar chaves idempotentes, reversões e estados de reconciliação.
3. **Fonte canônica de fidelidade:** escolher ledger avançado ou legado, preparar migração idempotente e congelar publicação de novos créditos até a reconciliação.
4. **Contrato de agenda/timezone:** estabelecer `horaLocal`, jornada, feriados e loja ativa como regras de domínio, não apenas de UI.
5. **Infraestrutura de integração:** PostgreSQL/worker/canal WhatsApp disponíveis para validar outbox, retry e entrega; os testes atuais em ambiente sem PG não comprovam operação real.
6. **Fixtures isoladas:** isolar `GEMINI_API_KEY`/variáveis de runtime e `DB_PATH` para que o gate não dependa do ambiente nem sofra corrida de arquivos.
7. **Gate de publicação:** verificar artefato compilado, feature flag, rotas, permissões, migrações e ambiente alvo; presença na branch não basta.

## 6. Testes de aceite do próximo ciclo

- **InfinitePay:** retorno com `slug` preservado; mock de `payment_check` para pendente, capturado, valor/método divergente, timeout e replay; sem confirmação indevida.
- **Isolamento multiloja:** duas lojas da mesma empresa com cobranças, carteiras, comissões, repasses, vendas, agenda, lista e retornos; cada sessão só lê/muta a própria unidade.
- **Agenda:** POST/PATCH sem `horaLocal`, fora da abertura, fora da jornada, feriado e timezone; todos rejeitados de forma determinística.
- **Receita:** atendimento concluído sem recebimento, recebido depois, pagamento parcial e replay; ocupação permanece, receita/meta/comissão só refletem o ledger.
- **NF-e:** XML sem autorização/assinatura, CNPJ divergente, fornecedor divergente, falha no item intermediário e repetição; nenhum estado parcial não reconciliado.
- **Ledger de fidelidade:** crédito de indicação, cliente ausente/anonimizado, reprocessamento de `aguardandoFidelidade`, resgate/expiração e migração executada duas vezes.
- **Lista de espera:** serviço/unidade incompatíveis não entram na seleção nem passam no worker; admin, público e remarcação fecham/reabrem a entrada com idempotência.
- **Financeiro/retry:** falha de `registrarReceita`, falha de efeito, retry após status pago, uso prévio de cashback/vale; não duplicar lançamento nem devolver saldo indevidamente.
- **Autorização:** matriz negativa para equipe/gerente/admin nas leituras e mutações financeiras, com auditoria do operador autorizado.
- **Regressão de integração:** executar testes com PostgreSQL/worker quando aplicável, em fixtures isoladas; falha de ambiente deve ser separada de falha funcional.

## 7. Estado dos testes e bloqueios conhecidos

- `app/dino-cobranca-kytto.test.js` + `app/server-cobranca-runtime.test.js`: **13 passaram, 0 falharam**, mas a cobertura não inclui os cenários críticos listados e não prova publicação.
- `app/dino-captacao-kytto.test.js`: **24/24 passaram**; `app/server-captacao-runtime.test.js`: **1/1 passou**, porém com logs de `ECONNREFUSED` para PostgreSQL e sem entrega real do worker.
- `app/barbearia-erp-kytto.test.js`: **32/32 passaram**; `app/barbearia-repasses-kytto.test.js`: **4/4 passaram**; `app/dino-captacao-kytto.test.js`: **24/24 passaram** na execução isolada.
- `app/server-barbearia-runtime.test.js`: falhou porque o fixture esperava `ia.configurada=false`, mas `GEMINI_API_KEY` do ambiente fez o runtime retornar `true`; o fixture precisa isolar essa variável.
- Execução conjunta de testes legados apresentou `ENOENT` em `app/data/db.json.tmp` por concorrência de `DB_PATH`; não tratar como falha funcional isolada, mas corrigir antes do gate.
- Testes de contrato PostgreSQL/equivalência/concorrência estão explicitamente pulados em `barbershop-agenda-contract.test.js`.
- Não há cobertura de UI para os principais painéis; não há evidência de entrega real de WhatsApp/worker nem de deploy da projeção.

## 8. Decisão de release

**Não liberar como operação Dino pronta para produção multiloja neste estado.** Liberar apenas após o primeiro sprint atender os bloqueadores P0 selecionados, os testes cross-store/financeiros passarem em ambiente isolado e houver evidência separada de publicação. Os itens P2 de UX, exportação, grade e melhorias analíticas permanecem posteriores aos controles de integridade e reconciliação.
