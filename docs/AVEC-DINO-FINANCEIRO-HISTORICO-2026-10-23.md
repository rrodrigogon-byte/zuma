# Lote financeiro histórico Avec → Barbearia Dino

**Status:** implementação pronta para PR e aplicação única controlada em PRD

## Escopo

Este lote adiciona ao importador Avec o arquivo versionado `financeiro-entradas-saidas-full-2026-10-22.jsonl`, coletado em modo somente leitura no extrato **Entradas e Saídas** do Avec SalãoVIP, unidade `102577`. Cada linha é identificada pelo `itemid` de origem e recebe chave idempotente `avec-import-financeiro-20261022:<itemid>`.

Os registros são gravados no livro financeiro da empresa `emp-kytto-001`, loja `dino-web-estoque`, com origem `avec-import-financeiro-20261022`, metadados de fonte, hash da linha, data, categoria, situação e meio de pagamento normalizado. O painel Financeiro os apresenta como **Histórico Avec**.

## Reconciliação da fonte

| Classe | Linhas | Valor absoluto |
|---|---:|---:|
| Receitas pagas | 6.405 | R$ 1.148.494,38 |
| Despesas pagas | 390 | R$ 614.507,86 |
| Despesas pendentes/atrasadas | 71 | R$ 48.076,63 |
| **Total** | **6.866** | — |

Os valores acima preservam o sinal econômico na origem: receitas positivas viram `tipo=receita`; despesas negativas viram `tipo=despesa` com valor absoluto no campo financeiro. Situação `Pago` vira `pago`; demais situações capturadas viram `pendente`.

## Salvaguardas

- O lote financeiro é distinto do lote cadastral/histórico já aplicado: `runKey=avec-dino-20261022-finance-v1`.
- A aplicação requer temporariamente `AVEC_DINO_IMPORT_CONFIRM=PRD_AVEC_DINO_IMPORT_20261022_FINANCE_V1` e é desligada após o boot que retornar sucesso.
- Não são criadas novas comandas, vendas operacionais, objetos de pagamento ou contas a receber a partir destas linhas.
- O livro financeiro recebe os lançamentos históricos para consulta, fluxo de caixa e reconciliação, mas cada lançamento carrega a observação de que não representa nova venda operacional.
- O lucro operacional estimado exclui despesas com `metadata.historicoAvec=true`; o bloco financeiro e os relatórios continuam refletindo o extrato importado.
- Conflito na mesma chave com hash de fonte diferente interrompe a aplicação sem salvar uma carga divergente.
- Replay do mesmo lote retorna `alreadyApplied` e não duplica IDs.

## Evidências técnicas

- `node --test app/migrations/run-avec-dino-import.test.js`: aplicação em banco temporário, 6.866 lançamentos e replay idempotente aprovado.
- `node --test app/dino-dashboard.test.js app/dino-bi.test.js app/financeiro-central-kytto.test.js`: testes focados do painel, BI e livro financeiro aprovados após a separação histórica.
- `npm run build` em `web`: build Vite aprovado; permanece apenas o warning preexistente de import estático/dinâmico de `EmImplantacao.jsx`.
- O manifesto `app/migrations/data/avec-dino-20261022/DATA-MANIFEST.json` valida tamanho, SHA-256 e contagem do novo JSONL.

## Aplicação controlada em PRD

Após merge da PR contra `fix/kytto-comandas-pdv-20260808`, a aplicação deve ocorrer pelo boot único do serviço Render, preservando a instância única e o escopo Dino. Validar no log o relatório do `runKey`, os totais acima, `paymentsCreated=0` e `financialEntriesCreated=6866`; depois remover a variável de confirmação. A confirmação final deve incluir a leitura do Financeiro Dino, sem PII desnecessária, e o health público `200`.
