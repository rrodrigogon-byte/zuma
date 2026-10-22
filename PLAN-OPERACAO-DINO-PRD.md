# Plano de Implementação — Operação Dino completa e release PRD

**Branch de trabalho:** `feat/dino-operacao-completa-20261022`  
**Base obrigatória de produção:** `origin/fix/kytto-comandas-pdv-20260808`  
**Estado de início:** sprint de isolamento multiloja, fidelidade e lista de espera já incorporado nesta branch; ainda não publicado.

## Objetivo

Concluir a Operação Dino com controles de integridade financeira, isolamento multiloja, agenda, fidelidade, lista de espera, revenda, compras e projeção de faturamento. A entrega deve ser segura para PRD: sem vazamento entre lojas, sem confirmação financeira sem reconciliação, sem entrada fiscal parcial e sem comunicação enganosa sobre previsões.

## Decisões aprovadas

1. Todo dado operacional e financeiro é escopado por **empresa + loja**: agenda, waitlist, cobrança, carteira, fidelidade, estoque, compras, NF-e, caixa, revenda, comissão, vale e repasse. Exceções corporativas precisam ser explicitamente marcadas e não podem vazar em uma sessão de loja.
2. Registros legados sem `lojaId` não participam de uma sessão de loja; ficam bloqueados ou em quarentena reconciliável e auditada.
3. O **ledger Commerce/PostgreSQL** é a fonte canônica de fidelidade. Novos créditos passam pelo fluxo canônico; o legado só é reconciliado de modo explícito, por loja de destino e idempotente.
4. O retorno InfinitePay aceita exclusivamente o `invoice_slug` persistido na cobrança. Ausência, divergência, timeout ou divergência de valor/método/NSU jamais confirma pagamento ou agenda.
5. Entrada de NF-e em PRD exige artefato válido e autorizado. Até haver dados fiscais reais de homologação, entradas que não passem a validação permanecem bloqueadas ou pendentes — nunca simuladas como autorizadas.
6. A previsão é **previsão bruta de receita**, não caixa nem margem; permanece desligada por feature flag até que rota, fonte de recebimento, permissões e artefato estejam comprovados em PRD.

## Arquitetura e estrutura

- `app/barbearia-erp-kytto.js`: agenda, comandas, revenda, estoque e regras de domínio.
- `app/dino-cobranca-kytto.js`, `app/modules/cobrancas/`, `app/modules/clube/`: cobrança, sinais, Clube, efeitos e reconciliação financeira.
- `app/financeiro-central-kytto.js`, `app/caixa-diario-kytto.js`, `app/barbearia-repasses-kytto.js`: ledger, caixa, comissão, vale e repasse.
- `app/dino-captacao-kytto.js`, `app/core/barbershop-*`: fidelidade legada, NPS, retornos, lista de espera e outbox.
- `app/core/loyalty-advanced.js`: ledger canônico de fidelidade e reconciliação.
- `app/barbearia-compras-kytto.js`: compras e entrada fiscal.
- `app/server.js` e `app/modules/barbearia/routes-publico.js`: autorização, contratos HTTP e rotas públicas.
- `app/migrations/`: mudanças exclusivamente incrementais de schema e chaves de auditoria/reconciliação.
- `web/src/pages/admin/`: painéis administrativos Dino; seguirá o padrão visual existente, sem uma nova linguagem visual.

## Etapas de implementação

### 1. Fundação multiloja e migração compatível

Tornar `lojaId` obrigatório em leituras e mutações operacionais. Propagar a unidade para ledger, caixa, cobrança, estoque, compras, repasses, fidelidade, lista de espera e jobs. Criar migrações aditivas e rotinas de diagnóstico/quarentena para registros legados sem loja, sem mutar dados antigos de forma destrutiva.

### 2. Agenda e receita canônica

Validar no domínio `dataHora` e `horaLocal` coerentes com `America/Cuiaba`, jornada, abertura, feriado, unidade e profissional em POST/PATCH. Separar ocupação de receita: somente recebimento/lançamento financeiro verificado pode alimentar metas, projeção, comissão, analytics e repasse; concluído sem recebimento é uma pendência explícita.

### 3. Cobrança segura e reconciliável

Persistir e validar o `invoice_slug` InfinitePay. Tornar configuração de provedor transacional e sem overrides internos não autorizados. Criar estados de efeito/financeiro, vínculo de lançamento, tentativa, erro, próximo retry e outbox idempotente. Versionar/revisar sinal quando serviço, preço ou data forem alterados.

### 4. Fidelidade, NPS e conclusão única

Consolidar o ledger canônico e criar reconciliação idempotente do legado. Centralizar efeitos da conclusão de atendimento (financeiro, plano, indicação, NPS e fidelidade) ou garantir worker reconciliador equivalente. Converter pendências de NPS e `aguardandoFidelidade` em trabalhos duráveis com lease, retry, dead-letter e auditoria.

### 5. Lista de espera e retorno confiáveis

Vincular entradas de espera a unidade, serviço, profissional e agendamento; usar fingerprint imutável de vaga. Reabrir/fechar a entrada correta em criação, cancelamento e remarcação. Implementar hold/aceite com TTL e transação idempotente antes de ofertas transacionais. Retornos usam somente histórico da mesma unidade e do mesmo serviço, com limite de dias validado.

### 6. Atendimento, estoque, compras e NF-e

Aplicar loja estrita em revenda, estoque, compras, reposição, ABC e NF-e. Validar NF-e autorizada (status fiscal, chave, CNPJ, emitente e vínculo) e processar múltiplos itens em transação ou com compensação rastreável. Integrar revenda ao caixa com meios mistos e profissional por item; criar reserva de estoque para pendências e bloquear redução de comanda abaixo de valor já faturado.

### 7. Reversões e controles administrativos

Criar estorno/devolução imutável e idempotente para venda e comanda pagas, revertendo coordenadamente estoque, ledger, caixa, comissão e fidelidade. Adicionar `Idempotency-Key`/`actionId` para agenda e matriz explícita de permissões/auditoria. Aplicar limite compartilhado, deduplicação e evidências completas a webhook e confirmação manual de cobrança.

### 8. Painéis e operação

Completar recuperação de cobrança (Pix, checkout, reenvio, tentativas, NSU, revisão e ledger), gestão de detratores, filtros/histórico de waitlist, recebimento parcial de compras, pendências/retry e reversões. Todas as telas reutilizam componentes e linguagem visual do painel Dino existente.

### 9. Projeção e feature flag

Integrar a projeção de faturamento usando somente receita paga e escopo por loja. Disponibilizar por flag desligada por padrão, permissão de gestão e rótulo de previsão bruta. Validar rota, bundle, cache e payload antes de habilitar por tenant.

### 10. Gate de release e publicação

Executar testes serializados com `DB_PATH` isolado, suíte de backend, build web, contratos HTTP, matriz cross-store e PostgreSQL/worker com ambiente real autorizado. A publicação ocorrerá exclusivamente por PR para `fix/kytto-comandas-pdv-20260808`; o merge dispara o auto-deploy do Render. Após deploy, validar `/api/info`, `/health`, build, permissões, feature flags, migrations e logs. Em falha, reverter a PR e desabilitar flags novas, nunca trocar a configuração do serviço nem forçar deploy.

## Condições para GO em produção

O release só é aprovado quando os P0/P1 de isolamento, recebimento, InfinitePay, NF-e, reversão, fidelidade, lista de espera e agenda estiverem implementados e aprovados nos testes determinísticos e de integração. Contratos que dependem de PostgreSQL, worker, InfinitePay ou dados fiscais reais não serão marcados como aprovados sem esses ambientes. Enquanto isso, os fluxos novos ficam protegidos por estado pendente ou feature flag desligada.
