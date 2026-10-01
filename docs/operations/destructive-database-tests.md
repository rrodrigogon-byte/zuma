# Checks destrutivos de banco — somente ambiente descartável

Estes checks existem para validar migrations e concorrência em um PostgreSQL local/CI que possa ser recriado. **Nunca** apontar o comando para produção, réplica de produção ou banco com dados reais.

## Travas obrigatórias

O runner `app/scripts/run-destructive-database-checks.sh`:

1. aborta quando `NODE_ENV=production`;
2. exige `DATABASE_URL` explícita;
3. exige o opt-in exato `ALLOW_DESTRUCTIVE_DB_TESTS=I_UNDERSTAND_THIS_RECREATES_A_DISPOSABLE_DATABASE`;
4. não é chamado pelo boot do servidor, pelo deploy ou por rotas HTTP.

## Execução segura

Use um banco PostgreSQL recém-criado e descartável:

```bash
NODE_ENV=test \
DATABASE_URL='postgresql://.../setpoint_disposable_test' \
ALLOW_DESTRUCTIVE_DB_TESTS=I_UNDERSTAND_THIS_RECREATES_A_DISPOSABLE_DATABASE \
bash app/scripts/run-destructive-database-checks.sh
```

Antes da execução, confirme que o nome/host pertencem ao ambiente local ou CI. Depois, descarte o banco. Em produção, qualquer reset administrativo é bloqueado no servidor por `DESTRUCTIVE_OPERATION_DISABLED_IN_PRODUCTION`.
