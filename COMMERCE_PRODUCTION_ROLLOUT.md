# Rollout de produção — Commerce Core multiempresa

## Objetivo

O Commerce Core fica opt-in no runtime. O caminho legado continua disponível quando `COMMERCE_CORE_ENABLED=0`. Para ativar o checkout multiempresa, o serviço precisa iniciar `server.js`, possuir conexão PostgreSQL gerenciada e aplicar as migrations antes de atender o tráfego público.

## Pré-requisitos

O ambiente deve ter `gcloud`, `curl`, Node.js, npm e acesso ao projeto GCP. O Cloud Run precisa possuir uma das conexões abaixo, sem que qualquer segredo seja colocado neste documento:

| Forma | Variáveis obrigatórias |
| --- | --- |
| URL gerenciada | `DATABASE_URL` ou `POSTGRES_URL` |
| Cloud SQL por host/socket | `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` e opcionalmente `DB_PORT`/`DB_SSL` |

A flag `COMMERCE_CORE_ENABLED=1` não deve ser ligada antes de validar a conexão e o banco. O `entrypoint.sh` encerra o processo caso essa flag esteja ativa sem PostgreSQL configurado.

## Ativação recomendada

A partir de uma cópia da branch Commerce integrada, habilite o serviço com confirmação explícita:

```bash
export GCP_PROJECT_ID="SEU_PROJETO"
export CLOUD_RUN_REGION="us-central1"
export CLOUD_RUN_SERVICE="kytto-erp"
CONFIRM_COMMERCE_CLOUD_RUN=I_UNDERSTAND_CLOUD_RUN ./scripts/enable-commerce-cloud-run.sh
```

A atualização altera somente `COMMERCE_CORE_ENABLED` e `COMMERCE_SCHEMA_ON_BOOT`. O comando usa `gcloud run services update --update-env-vars`, preservando escala, recursos, banco e secrets existentes. Se o serviço ainda não tiver a imagem do commit integrado, primeiro execute o pipeline do `cloudbuild.yaml` na branch `fix/kytto-comandas-pdv-20260808`.

O próprio entrypoint aplica o schema de maneira idempotente quando `COMMERCE_SCHEMA_ON_BOOT=1`, utilizando advisory lock. As migrations `040`, `041` e `042` serão aplicadas na ordem oficial; a `042` cria os métodos iniciais do storefront Dino informado no prompt.

## Alternativa manual para migrations

Caso a política da operação não permita migration no boot, execute a partir de um ambiente com acesso ao mesmo banco:

```bash
CONFIRM_COMMERCE_ACTIVATION=I_UNDERSTAND_PRODUCTION \
  SKIP_NPM_INSTALL=1 \
  ./scripts/activate-commerce.sh
```

O script não continua sem a confirmação literal. Com `COMMERCE_BASE_URL` e `DINO_BASE_URL`, também testa `/health` e `/api/public/storefront/dino/context`.

## Pós-ativação

No Admin, abra `/admin/ecommerce` e selecione a loja Dino. Em Entrega, revise os valores iniciais de motoboy, tabela regional, expressa e frete grátis. Eles são parâmetros de partida e devem refletir a política comercial real antes da divulgação.

Na aba Clientes, crie uma conta ativa de crediário para cada cliente aprovado. O checkout só apresenta “Marcar na conta” após identificar um cliente com conta ativa, valida limite disponível no servidor e grava o lançamento com vencimento.

Por último, validar uma compra de teste com um produto não crítico: selecionar Entrega, consultar CEP, conferir endereço e frete, criar o pedido, verificar o total e confirmar o fulfillment. Repetir com Retirada para assegurar que o fluxo existente continua funcionando.

## Rollback operacional

Se for necessário voltar ao caminho legado sem remover código, defina `COMMERCE_CORE_ENABLED=0` no serviço e publique uma nova revisão. Não apague as migrations aplicadas; o executor mantém controle por arquivo e checksum.
