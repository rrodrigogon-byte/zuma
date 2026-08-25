# Domínio e publicação do Kytto

## Endereço canônico

O endereço canônico atual da aplicação é:

```text
https://setpoint.kytto.com.br
```

A rota `/` entrega a página institucional pública e `/admin` entrega o painel protegido. Usuários autenticados também podem abrir `/`; o botão principal da Home leva cada perfil ao painel correspondente.

## Apex e www

O domínio raiz e o `www` precisam estar associados à mesma arquitetura que atende `setpoint.kytto.com.br`. O redirecionamento implementado no servidor usa `308` para enviar:

```text
https://kytto.com.br/*      → https://setpoint.kytto.com.br/*
https://www.kytto.com.br/* → https://setpoint.kytto.com.br/*
```

Esse redirecionamento só funciona depois que o DNS e o certificado TLS dos dois hosts estiverem válidos. Se o TLS for encerrado antes de chegar ao Cloud Run, a aplicação não consegue executar o redirecionamento.

## Verificação no Google Cloud

A equipe responsável pelo projeto deve descobrir qual arquitetura atende o subdomínio funcional e consultar os registros oficiais emitidos para o domínio. Não devem ser usados IPs adivinhados ou copiados de outro projeto.

Para Cloud Run Domain Mapping, consultar:

```bash
gcloud beta run domain-mappings describe \
  --domain setpoint.kytto.com.br \
  --region southamerica-east1
```

Para o serviço, conferir o endpoint e a revisão:

```bash
gcloud run services describe setpoint-ultra \
  --region southamerica-east1 \
  --format='yaml(status.url,status.traffic,metadata.name,spec.template.spec.containers[0].image)'
```

Se o projeto usar Load Balancer global, conferir o frontend HTTPS, o certificado gerenciado, o mapa de URL e o backend que encaminha para o Cloud Run. O apex e o `www` devem apontar para o frontend do load balancer, e não diretamente para um destino antigo.

## Validação externa

Após a alteração de DNS e do certificado, executar:

```bash
curl -I https://kytto.com.br/
curl -I https://www.kytto.com.br/
curl -I https://setpoint.kytto.com.br/
curl -I https://setpoint.kytto.com.br/admin
curl -sS https://setpoint.kytto.com.br/health
```

Critérios mínimos: o certificado deve ser validado sem `-k`; a raiz deve responder com HTML ou redirecionamento `308`; `/health` deve retornar `200`; `/admin` deve continuar entregando a SPA e mantendo a proteção de autenticação.

## Deploy

O Cloud Build deve publicar a imagem e validar o endpoint técnico do serviço antes de promover o tráfego. A variável `PUBLIC_APP_URL` deve permanecer definida como `https://setpoint.kytto.com.br` até que o endereço canônico seja alterado de forma planejada.
