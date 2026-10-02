# Proteção dos dados do banco JSON

A agenda, os clientes, as comandas, o clube, as cobranças e o cashback da barbearia ficam num único arquivo JSON no disco do servidor (`DB_PATH=/var/data/db.json` no Render). Este documento descreve como esses dados são protegidos e como recuperá-los.

## O que roda sozinho

| Proteção | Como funciona |
|---|---|
| Gravação segura | Cada gravação escreve num arquivo temporário e troca o arquivo de uma vez (rename atômico). O conteúdo é forçado para o disco (fsync) no máximo a cada 30 s. O JSON é compacto, sem indentação. |
| Cópia `.bak` | A última versão íntegra é copiada para `db.json.bak` no máximo a cada 5 minutos. Se o arquivo principal sumir ou corromper, o boot usa a `.bak`. |
| Cópia fora do disco | A cada hora, o arquivo inteiro vai comprimido para o PostgreSQL gerenciado (tabela `kytto_json_snapshots`). A primeira cópia de cada dia é a **diária**. Se nada mudou desde a última, a cópia de hora em hora é pulada. |
| Restauração testada | Logo após guardar, a cópia é lida de volta e descomprimida, e o hash SHA-256 é comparado com o do original. Só então ela recebe `verificado_em`. Uma cópia que não confere é apagada. |
| Retenção | 24 cópias de hora em hora (1 dia), 35 diárias (5 semanas) e 20 manuais, dentro de uma cota de espaço de 300 MB (variável `PROTECAO_COPIAS_MAX_MB`). Quando a cota estoura, saem primeiro as cópias horárias mais antigas, depois as manuais e por fim as diárias; a cópia mais recente sempre fica. A cota protege o disco do PostgreSQL, que é o mesmo do Commerce. |
| Cópias locais | Todo dia às 03h, `db-AAAA-MM-DD.bak.json.gz` (comprimida) no mesmo disco, apagada após 7 dias. A cópia é pulada se não houver espaço livre de pelo menos 4 vezes o tamanho do banco. |
| Instância única | O banco JSON aceita um único processo gravando. A instância que obtém a trava no PostgreSQL é a líder e é a única que roda as rotinas automáticas e as cópias. Uma segunda instância fica sem rotinas, e o health check acusa `outra_instancia_ativa`. O `render.yaml` fixa `numInstances: 1`. |

A tabela é criada pela migration `060_kytto_json_snapshots.sql`, aplicada automaticamente no deploy (`preDeployCommand`).

## Monitoramento

- `GET /health` continua respondendo 200 enquanto o serviço está no ar e inclui `persistencia: "ok" | "degradada"`. Uma cópia atrasada não derruba o serviço.
- `GET /health/persistencia` responde **503** quando a persistência está degradada, com a lista de problemas:
  - `sem_copia_externa`
  - `copia_externa_atrasada` (mais de 26 h sem cópia)
  - `falha_copia_externa`
  - `falha_gravacao_local`
  - `outra_instancia_ativa`
- Cadastre `https://dino.kytto.com.br/health/persistencia` num monitor externo (UptimeRobot, Better Stack ou similar) com alerta por e-mail ou WhatsApp.
- `GET /api/admin/platform/protecao-dados` (só a administração da plataforma) mostra o estado completo:
  - última cópia, tamanhos e erros;
  - métricas de gravação (duração, gravações lentas, tamanho do arquivo);
  - as últimas cópias guardadas.

## Cópia manual

Antes de uma mudança arriscada (importação de clientes, migração), gere uma cópia manual:

```
POST /api/admin/platform/protecao-dados/copia
```

## Restaurar com o servidor no ar

1. Consulte as cópias em `GET /api/admin/platform/protecao-dados` e escolha o `id`.
2. Envie a restauração com a frase de confirmação:

   ```
   POST /api/admin/platform/protecao-dados/restaurar
   {"id": "123", "confirmacao": "RESTAURAR 123"}
   ```

3. Antes de trocar os dados, o sistema guarda uma cópia manual do estado atual e devolve o id dela em `copiaDoEstadoAnterior`. Para desfazer, restaure esse id.
4. A restauração fica registrada na auditoria.

Atenção: tudo o que foi gravado depois da cópia escolhida (agendamentos, comandas, pagamentos) volta ao estado da cópia. Avise a equipe e confira o caixa do dia.

## Recuperação de desastre (servidor não sobe ou disco perdido)

1. No shell do serviço, ou numa máquina com acesso ao `DATABASE_URL`, liste as cópias:

   ```
   node app/scripts/restaurar-copia-json.js --listar
   ```

2. Extraia a cópia escolhida para um arquivo novo. O script confere o hash e nunca sobrescreve o banco em uso:

   ```
   node app/scripts/restaurar-copia-json.js --id 123 --saida /var/data/restauracao-123.json
   ```

3. Com o serviço parado, renomeie o arquivo atual para guardá-lo e coloque a restauração no lugar de `/var/data/db.json`. Depois suba o serviço.

## Teste de restauração mensal

Uma vez por mês, extraia a última cópia diária com o script (passo 2 acima) num ambiente de teste e confira:
- quantidade de agendamentos;
- clientes;
- comandas do último dia.

A conferência automática do hash roda a cada cópia; este teste mensal confere o conteúdo de negócio.

## Limites conhecidos

- O banco JSON continua sendo um arquivo único. A solução definitiva é levar agenda, comandas e cobranças para o PostgreSQL. Até lá, não escale o serviço horizontalmente: aumente o plano.
- As cópias ficam no mesmo PostgreSQL do Commerce. O backup do próprio PostgreSQL é feito pelo Render, conforme o plano do banco.
