# Importação Avec → Barbearia Dino

## Objetivo

Este lote migra para o tenant da Barbearia Dino os dados normalizados coletados da unidade Avec SalãoVIP `102577`, preservando a origem, o identificador de carga e os hashes para auditoria. O runner é idempotente: a chave `avec-dino-20261022-v1` impede uma segunda aplicação do mesmo lote.

## Escopo preparado

| Entidade | Origem validada | Tratamento no Dino |
|---|---:|---|
| Cadastro Avec | 4.403 linhas | 4.397 registros importáveis; 6 linhas sem nome ficam no relatório de exceções |
| Clientes identificados no histórico | 1.634 identidades | Criados como clientes históricos, sem fusão automática com cadastros existentes |
| Serviços de catálogo | 35 | Catálogo operacional importado com preço, duração e categoria |
| Nomes de serviços históricos adicionais | 34 aliases | Criados inativos, apenas para reconciliação; não aparecem para agendamento |
| Profissionais inferidos do cadastro/agenda | 5 | Criados ativos, sem inventar comissão ou jornada financeira |
| Profissionais observados no histórico | 22 | Criados inativos como referência histórica |
| Produtos/estoque | 32 | Catálogo importado ou reconciliado; saldo operacional definido em 10 |
| Histórico detalhado de serviços | 22.485 linhas | Gravado em `historicoAtendimentos`, somente histórico, sem agenda e sem financeiro |
| Cabeçalhos de comandas | 15.468 linhas | Gravados em `historicoComandas`, somente reconciliação; não são comandas de PDV |

## Limitação importante da fonte

A coleta do Avec trouxe o relatório detalhado de serviços e os cabeçalhos das comandas, mas não trouxe itemização completa de cada comanda nem forma de pagamento reconciliável para todo o período. Por segurança, a importação não transforma valores de relatório em vendas operacionais. O lote cria zero:

- comandas operacionais;
- pagamentos;
- contas a receber;
- lançamentos financeiros;
- comissão ou pontos;
- agenda retroativa;
- baixa de estoque por venda histórica.

Os valores e os cabeçalhos são preservados em histórico com `sourceSystem: "avec"`, `sourceKey`, `sourceHash` e `statusImportacao: "cabecalho_sem_itemizacao_pagamento"`. Isso permite uma segunda etapa de reconciliação caso sejam obtidos os detalhes individuais das comandas.

## Segurança do runner

O arquivo `app/migrations/run-avec-dino-import.js`:

1. confere o `DATA-MANIFEST.json`, hashes SHA-256, tamanho e contagem de cada arquivo;
2. exige `AVEC_DINO_IMPORT_CONFIRM=PRD_AVEC_DINO_IMPORT_20261022_V1` para aplicar;
3. interrompe se o tenant alvo não existir;
   - se o ID legado histórico não estiver presente, resolve apenas um único registro com `slugPublico/slugAgendamento = dino` ou nome público de Barbearia Dino;
   - também usa `configuracao.lojaPublicaId` somente quando o ID de loja legado padrão não existir;
   - se houver zero ou mais de um candidato, interrompe sem gravar;
4. cria snapshot gzip do `db.json` antes da primeira alteração;
5. executa todas as alterações em memória e só chama `save()` depois de todas as validações;
6. restaura o snapshot em memória quando há erro;
7. grava relatório do lote em `root.importacoesAvec["avec-dino-20261022-v1"]`;
8. retorna `alreadyApplied` em reexecução do mesmo lote;
9. mantém o saldo original dos produtos em `sourceEstoqueOriginal` e o saldo operacional aprovado em `estoqueAtual: 10`;
10. expõe os cabeçalhos por `GET /api/admin/barbearia/historico-comandas`, marcados como somente histórico e sem financeiro criado.

## Execução local

No diretório `app`:

```bash
DB_PATH=/tmp/dino-import.json NODE_ENV=test npm run --silent avec:import:dry-run
```

A aplicação exige uma confirmação explícita:

```bash
AVEC_DINO_IMPORT_CONFIRM=PRD_AVEC_DINO_IMPORT_20261022_V1 \
AVEC_DINO_IMPORT_EMPRESA_ID=emp-kytto-001 \
AVEC_DINO_IMPORT_LOJA_ID=dino-web-estoque \
npm run avec:import:apply
```

O script também está ligado ao `commerce:schema:apply`, mas fica inerte quando a variável de confirmação não está presente.

## Critérios de aceite pós-aplicação

- `root.importacoesAvec["avec-dino-20261022-v1"].status === "applied"`;
- `after.historicoServicos === 22485`;
- `after.historicoComandas === 15468`;
- todos os 32 produtos do lote têm `estoqueAtual === 10`;
- `financialSafety.operationalOrdersCreated === 0`;
- `financialSafety.paymentsCreated === 0`;
- `financialSafety.receivablesCreated === 0`;
- `financialSafety.financialEntriesCreated === 0`;
- a segunda execução retorna `alreadyApplied: true`;
- o endpoint histórico continua respondendo sem incluir esses registros em vendas ou caixa.

## Pendência para uma migração financeira completa

Para importar vendas, pagamentos e recebimentos como operações financeiras reais, ainda é necessário obter do Avec uma exportação itemizada por comanda, contendo pelo menos: identificador estável da comanda, cliente, data de fechamento, itens/serviços, profissional, descontos, forma de pagamento, valor recebido e status de estorno/cancelamento. Essa etapa deve ser executada como novo lote, com reconciliação por chave idempotente e aprovação separada; não deve reutilizar cabeçalhos sem itemização.
