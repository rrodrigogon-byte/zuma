# Status do SetPoint em Produção (GCP)

**Data:** 26 de julho de 2026  
**Verificação:** Manus AI  

## Informações de Produção

| Item | Valor |
|------|-------|
| **URL Pública** | https://smartpoint-api-prod-108835006988.us-central1.run.app |
| **Serviço** | smartpoint-api-prod |
| **Região** | us-central1 |
| **Plataforma** | Google Cloud Run |
| **Projeto GCP** | avd-uisa-sistema-vision |
| **Status Atual** | ⚠️ Erro 500 (Server Error) |

## Diagnóstico

O serviço está retornando erro 500 ao tentar acessar `/` e `/admin.html`. Possíveis causas:

1. **Banco de dados JSON indisponível** — o arquivo `db.json` pode estar corrompido ou inacessível
2. **Variáveis de ambiente faltando** — `JWT_SECRET`, `ADMIN_PASS` podem não estar configuradas
3. **Permissões de GCS** — se o banco está em Cloud Storage, permissões podem estar incorretas
4. **Logs do Cloud Run** — precisam ser verificados para diagnóstico exato

## Próximas Ações

### 1. Verificar Logs do Cloud Run
```bash
gcloud run services describe smartpoint-api-prod --region us-central1 --project avd-uisa-sistema-vision
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=smartpoint-api-prod" --limit 50 --format json
```

### 2. Verificar Variáveis de Ambiente
Acessar o console GCP → Cloud Run → smartpoint-api-prod → Editar e implantar nova revisão → verificar `ENVIRONMENT VARIABLES`

### 3. Verificar Armazenamento
- Se usando GCS: verificar permissões do bucket `agro-open-db`
- Se usando disco persistente: verificar se o volume está montado

### 4. Redeploy
Se necessário, fazer um novo deploy com:
```bash
gcloud run deploy setpoint \
  --image=gcr.io/avd-uisa-sistema-vision/agro-open:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars=NODE_ENV=production,JWT_SECRET=<valor>,ADMIN_PASS=<valor>
```

## Recomendação Imediata

**Não fazer alterações diretas em produção sem backup.** Recomenda-se:

1. Verificar os logs do Cloud Run para entender o erro exato
2. Se necessário, criar um ambiente de **staging** para testes
3. Depois de validar, fazer o deploy das evoluções (fiscal nacional, pagamentos, etc.)

---

**Status:** Aguardando diagnóstico dos logs do Cloud Run
