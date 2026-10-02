# Deploy do Kytto ERP v2.1.0 no Google Cloud Run

## Pré-requisitos

- Google Cloud SDK instalado (`gcloud` CLI)
- Acesso ao projeto GCP: `avd-uisa-sistema-vision`
- Docker instalado (opcional, para build local)
- Credenciais GCP configuradas

## Build e Push da Imagem Docker

### Opção 1: Build Local + Push para Artifact Registry

```bash
# Configurar o GCP
gcloud config set project avd-uisa-sistema-vision
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build da imagem
docker build -t us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0 .

# Push para Artifact Registry
docker push us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0
```

### Opção 2: Cloud Build (Recomendado)

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0
```

## Deploy no Cloud Run

```bash
gcloud run deploy kytto-erp \
  --image us-central1-docker.pkg.dev/avd-uisa-sistema-vision/kytto-erp/app:v2.1.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,DB_HOST=<cloudsql-ip>,DB_PORT=5432,DB_NAME=kytto_erp,DB_USER=kytto_user,DB_PASSWORD=<senha>" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 1
```

## Variáveis de Ambiente Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NODE_ENV` | Ambiente | `production` |
| `PORT` | Porta (Cloud Run) | `8080` |
| `DB_HOST` | Host do PostgreSQL | `10.0.0.2` |
| `DB_PORT` | Porta do PostgreSQL | `5432` |
| `DB_NAME` | Nome do banco | `kytto_erp` |
| `DB_USER` | Usuário do banco | `kytto_user` |
| `DB_PASSWORD` | Senha do banco | `<senha-segura>` |
| `JWT_SECRET` | Chave JWT | `<chave-aleatória>` |
| `CORS_ORIGIN` | CORS permitido | `https://kytto.example.com` |

## Migrações de Banco de Dados

Após o deploy, execute as migrações SQL 017 e 018:

```bash
# Conectar ao Cloud SQL
gcloud sql connect kytto-db --user=postgres

# Executar as migrações
\i app/migrations/017_barbearia_evolucao.sql
\i app/migrations/018_supermercado_evolucao.sql
```

## Verificação de Saúde

```bash
# Verificar status do serviço
gcloud run services describe kytto-erp --region us-central1

# Testar endpoint de saúde
curl https://kytto-erp-<hash>.us-central1.run.app/health
```

## Rollback (se necessário)

```bash
# Listar revisões
gcloud run revisions list --service kytto-erp --region us-central1

# Fazer rollback para revisão anterior
gcloud run services update-traffic kytto-erp \
  --to-revisions <revision-id>=100 \
  --region us-central1
```

## Monitoramento

- **Logs**: `gcloud run logs read kytto-erp --region us-central1 --limit 100`
- **Métricas**: Cloud Console → Cloud Run → kytto-erp → Métricas
- **Alertas**: Cloud Console → Monitoring → Policies

## Suporte

Para problemas, consulte:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [GitHub Repository](https://github.com/rrodrigogon-byte/agro-open)
