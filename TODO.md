# Operação Dino — backlog e gate de release PRD

**Branch:** `feat/dino-operacao-completa-20261022`
**Base:** `fix/kytto-comandas-pdv-20260808`
**Última revisão:** 22/10/2026

## Entregas implementadas nesta branch

- [x] **Fundação operacional 083.** Migration incremental, checksum e runner com lock/reexecução para outbox, efeitos, reversões, reservas, waitlist, NPS, quarentena e webhooks.
- [x] **Escopo multiloja.** Agenda, cobrança, ledger, caixa, comissões, repasses, fidelidade, lista de espera, estoque, compras, NF-e, revenda e comandas passaram a respeitar empresa + unidade; legado sem `lojaId` fica fora da sessão de loja ou em diagnóstico/quarentena.
- [x] **Agenda e receita comprovada.** `dataHora`/`horaLocal` são coerentes com `America/Cuiaba`, calendário e jornada; ocupação não vira receita sem recebimento financeiro verificado; replays de recebimento são idempotentes.
- [x] **Cobrança e retorno de pagamento.** InfinitePay valida exclusivamente o `invoice_slug` persistido, com proteção contra divergência, duplicidade, timeout e confirmação forjada; efeitos pendentes têm rastreabilidade para reconciliação.
- [x] **Outbox e worker operacional.** Lease, retry, backoff, dead-letter, idempotência, auditoria e métricas foram implementados com testes determinísticos.
- [x] **Estorno coordenado.** Comanda e revenda pagas usam reversão append-only, autorizada e idempotente, coordenando financeiro, caixa, estoque, comissão, fidelidade e auditoria.
- [x] **Reserva de estoque.** Hold, commit, release, expiração e cancelamento evitam dupla baixa e concorrência entre comanda, revenda e compras.
- [x] **Lista de espera.** Fingerprint de vaga, escopo por loja/serviço/profissional, hold/aceite com TTL e expiração segura; reabertura e cancelamento não atravessam unidades.
- [x] **Fidelidade e NPS canônicos.** Ledger Commerce/PostgreSQL, reconciliação idempotente do legado, NPS canônico opt-in, pendências e processamento pelo worker.
- [x] **Proteções de integração.** Rate limit compartilhado, deduplicação, assinatura/owner de webhook, observabilidade e testes de parceiros/retornos.
- [x] **Projeção inteligente.** Motor por loja usando receita paga, serviços, revenda, histórico, ritmo, capacidade, metas e profissionais; horizonte de até seis meses, cenários, fatores e recomendações.
- [x] **Painel e documentação.** Aba “Projeção inteligente” integrada ao ERP, com estados de carregamento/erro/sem histórico, ranking por profissional e manual em Markdown e PDF com identidade Kytto e capturas.

## Evidências executadas

- **Gate focado dos bloqueios:** 137 testes, 137 aprovados.
- **Suíte Node ampla:** 1.696 testes descobertos; 1.603 aprovados. As 8 falhas são hooks de PostgreSQL real que encerram com `PostgreSQL 16 local ausente: initdb`; não são falhas funcionais do código JSON/HTTP.
- **Projeção e runtime de captação:** 27 testes, 27 aprovados.
- **Build web Vite:** aprovado; apenas aviso existente de importação dinâmica/estática de `EmImplantacao.jsx`.
- **Sintaxe e whitespace:** `git diff --check` e `node --check` dos arquivos JavaScript alterados aprovados.
- **Lint:** não executável neste checkout porque o repositório não contém configuração ESLint; registrar configuração ou rodar o lint no pipeline oficial antes do merge.

## Bloqueios obrigatórios antes do GO em PRD

- [ ] Executar as 8 suítes PostgreSQL reais em ambiente autorizado com PostgreSQL 16, aplicar migration 083, validar rollback/reexecução, concorrência, locks e worker.
- [ ] Homologar InfinitePay, NF-e/Sefaz, WhatsApp e integrações de parceiros com credenciais de homologação e evidências de payload/assinatura/idempotência.
- [ ] Completar revisão dos painéis operacionais de pendências, NPS/detratores, waitlist, compras, reservas e estornos; garantir que cada tela respeite loja e papel.
- [ ] Atualizar a PR #369, aguardar checks e aprovação, fazer merge somente contra `fix/kytto-comandas-pdv-20260808`.
- [ ] Após o deploy Live, executar smoke de `/api/info`, `/health`, login, escopo entre lojas, agenda, cobrança, projeção, outbox/worker, flags e logs; se houver regressão, desabilitar as flags novas e reverter a PR.

## Política de publicação

O deploy PRD não deve ser feito enquanto o gate PostgreSQL real, a homologação das integrações externas e a revisão dos painéis não estiverem evidenciados. O recurso de projeção permanece acessível apenas à gestão autenticada da unidade e deve ser habilitado/validado por tenant conforme a política de release; seus valores são previsão bruta de receita, não caixa nem margem.
