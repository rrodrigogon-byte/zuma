# Plano — Projeção de faturamento com IA autônoma

## Objetivo

Evoluir a projeção determinística já publicada para uma camada avançada de inteligência gerencial. O sistema continuará calculando valores financeiros com regras auditáveis e usará IA somente para interpretar fatos, explicar riscos, sugerir ações e ordenar prioridades.

## Entregas de produto

1. Resumo executivo em português com situação atual, projeção, confiança e comparação com meta.
2. Explicação estruturada de causas observáveis: volume de atendimentos, ticket, revenda, agenda futura, ocupação, cancelamentos, profissionais e metas.
3. Alertas automáticos quando a projeção cair ou subir além dos limiares, quando a agenda cobrir pouco do restante, quando a revenda perder ritmo ou quando profissionais ficarem abaixo da meta.
4. Recomendações priorizadas por impacto estimado, esforço e módulo do ERP, sem executar cobrança, venda, alteração financeira ou agenda sem confirmação humana.
5. Simulação de cenários com parâmetros controlados: ocupação, ticket, atendimentos, revenda, faltas e metas.
6. Histórico de análises por empresa, unidade e competência, com fingerprint, provedor/modelo, versão de prompt, confiança e falhas.
7. Execução autônoma pelo outbox/worker, com retry, dead-letter, idempotência e fallback determinístico quando a IA estiver indisponível.
8. Painel com resumo, alertas, causas, ações, simulação e atualização manual.

## Arquitetura

- `app/dino-captacao-kytto.js` continua sendo a fonte do forecast numérico.
- `app/dino-projecao-ia.js` sanitiza o snapshot, chama `runAiTask('previsao_gerencial')`, valida JSON e persiste insight/alertas.
- `app/core/ai-router.js` acrescenta a tarefa `previsao_gerencial`, com Gemini smart como rota primária e fallbacks já existentes.
- `app/migrations/084_dino_forecast_ai.sql` cria histórico e alertas no PostgreSQL.
- `app/workers/dino-operational-worker.js` processa `forecast.ai.analyze` pelo outbox.
- `app/server.js` expõe endpoints autenticados e inclui o handler no worker.
- `web/src/pages/admin/dino/ProjecaoFaturamentoPanel.jsx` apresenta a leitura narrativa e simulações.

## Decisões de segurança

- Nenhum valor é inventado pelo modelo; cada afirmação numérica deve referenciar um fato do snapshot.
- Não são enviados telefones, nomes de clientes, credenciais ou dados pessoais ao provedor de IA.
- O modelo não possui ferramentas para mutar o ERP.
- Escopo empresa/unidade é resolvido pelo servidor e não pelo corpo livre do navegador.
- Alertas são idempotentes por escopo, competência, fingerprint e tipo.
- Falha de provedor não bloqueia a tela: o cálculo determinístico e uma explicação local segura permanecem disponíveis.
- A geração automática só roda quando a flag operacional e um provedor permitido estiverem habilitados; sem isso, a rota informa o estado e não faz chamada silenciosa.

## Seleção de modelo

A camada reutiliza o roteador de IA existente. O catálogo vivo consultado em 22/10/2026 informa que modelos Gemini disponíveis suportam JSON estruturado; o código de produção mantém o modelo configurável por ambiente (`AI_MODEL_GEMINI_SMART`) e usa `gemini:smart` por padrão, sem fixar um ID novo nem expor credenciais.
