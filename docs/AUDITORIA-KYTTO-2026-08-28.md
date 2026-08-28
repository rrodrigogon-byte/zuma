# Auditoria completa do Kytto — 28 de agosto de 2026

**Autor:** Manus AI
**Escopo:** servidor Node/Express efetivo, módulos legados, Commerce Core PostgreSQL, storefront, backoffice, pagamentos, TEF, logística, migrations, dependências e smoke HTTP local.

## Resumo executivo

A auditoria encontrou problemas reproduzíveis em fluxos legados de pagamento, segurança de operações internas, atualização em tempo real e sintaxe de quatro módulos. As correções foram aplicadas e publicadas na PR [#47](https://github.com/rrodrigogon-byte/agro-open/pull/47), no commit `98c3dc8`, sem alterar produção, secrets, banco remoto, DNS ou contas externas.

O estado verificado após as correções foi: **55 testes Node aprovados**, syntax check de todos os módulos JavaScript aprovado, build Vite aprovado, `npm audit --omit=dev` sem vulnerabilidades de produção, `git diff --check` aprovado e smoke HTTP local aprovado.

## Achados e correções

| Severidade | Achado reproduzido | Correção |
|---|---|---|
| Crítica | `/api/pagar` criava Pix simulado quando não havia provedor configurado. | O endpoint agora retorna `503 PAYMENT_PROVIDER_UNAVAILABLE`; o fallback simulado foi removido de `app/pagamentos.js`. |
| Crítica | `/api/pagamento/:id/confirmar` permitia aprovação manual pública. | A rota agora retorna `410 MANUAL_PAYMENT_CONFIRMATION_DISABLED`; aprovação local não é mais possível. |
| Alta | `/api/pagamento/webhook` aceitava assinatura inválida e apenas emitia aviso. | Exige Mercado Pago e segredo configurados, valida HMAC com comparação segura e retorna `401` para assinatura inválida. |
| Alta | `/api/kds` e `/api/events` eram acessíveis sem autenticação. | KDS e SSE exigem `auth` e `requireStaff`; o quadro de loja usa polling autenticado para não colocar JWT na URL. |
| Alta | A tela de configurações anunciava “modo simulado” e permitia forçá-lo. | O controle foi removido; a UI informa indisponibilidade ou configuração real e bloqueia TEF sem agente local. |
| Alta | O PDV gerava QR EMV local quando o backend não retornava QR do provedor e apresentava confirmação simulada. | QR/copia-e-cola somente são exibidos quando retornados pelo servidor/provedor; botão de simulação e fallback local foram removidos. |
| Alta | TEF sem agente local aprovava com NSU/autorização fictícios. | A função agora retorna `TEF_NOT_CONFIGURED` e exige agente real de maquininha. |
| Média | Reserva pública não tinha rate limit nem idempotência. | Foi adicionado `publicLimit(20)` e chave de idempotência para impedir baixa duplicada de estoque em retry. |
| Média | Adesão pública não tinha rate limit. | Foi adicionado `publicLimit(10)`. |
| Média | Quatro módulos legados tinham sequências literais de quebra de linha que falhavam no `node --check`. | As quebras foram normalizadas em barbearia, clientes, financeiro e supermercado. |
| Média | Dependência transitiva `uuid` permanecia vulnerável após atualização do Google Cloud Storage. | `@google-cloud/storage` foi atualizado para `8.0.1` e `uuid` fixado em `11.1.1` via override. |
| Alta | WhatsApp retornava `ok:true` mesmo sem Evolution API/Z-API configurada. | Agora retorna `WHATSAPP_NOT_CONFIGURED`, valida telefone, limita mensagem e aplica timeout de 10 segundos. |
| Média | BI apresentava métricas aleatórias de demonstração quando a API falhava. | O mock foi removido; a tela exibe indisponibilidade real e permite tentar novamente. |
| Média | Adesão paga criava assinatura pendente sem checkout real. | Planos pagos retornam `503 PAID_SUBSCRIPTION_CHECKOUT_UNAVAILABLE` antes de persistir registro. |
| Média | Transferência de item no atendimento anunciava sucesso simulado se a API falhava. | O fallback foi removido; o operador recebe erro real e a operação não é confirmada visualmente. |
| Média | Reserva pública podia duplicar baixa de estoque em retry. | Foi adicionado rate limit e idempotência por chave de reserva. |

## Validação realizada

A suíte completa terminou com 55 testes aprovados e nenhuma falha. O conjunto inclui testes Core, migrations, pagamentos, WhatsApp, adapters e contratos tenant-aware. O build Vite do storefront e do backoffice terminou com `✓ built`.

O smoke HTTP local com o Commerce Core desligado confirmou que `/api/info` continua em `200`, enquanto `/api/kds` e `/api/events` retornam `401` sem token; `/api/pagamentos/status` e `/api/pix-info` retornam `disponivel:false` e `modo:indisponivel`; `/api/pagar` retorna `503 PAYMENT_PROVIDER_UNAVAILABLE`; e a confirmação pública retorna `410 MANUAL_PAYMENT_CONFIRMATION_DISABLED`.

A auditoria de dependências do backend terminou com zero vulnerabilidades moderadas, altas ou críticas. A correção não executou chamadas a Mercado Pago, Correios, Melhor Envio, GCS ou PostgreSQL remoto.

## Riscos e pendências não mascarados

A PR #47 precisa ser revisada e mergeada antes de essas correções chegarem ao Render. A homologação de Mercado Pago, Correios e Melhor Envio ainda depende de contas externas, secrets inseridos diretamente no secret manager, origem logística, webhooks HTTPS e testes de sandbox. A emissão de etiqueta Correios continua conscientemente bloqueada até o contrato oficial de pré-postagem/CWS ser validado.

A suíte atual cobre contratos unitários e smoke HTTP, mas ainda deve receber E2E autenticado com browser em ambiente sandbox. A lista administrativa de pedidos, clientes e produtos agora possui paginação, porém fulfillments, estoque e outras áreas ainda podem receber carregamento incremental uniforme em uma rodada posterior. O módulo fiscal mantém uma mensagem de contingência de desenvolvimento explicitamente separada; isso não aprova pagamentos e deve permanecer isolado de produção. Também é necessário revisar a administração de planos pagos quando o checkout do gateway for implementado.

## Compatibilidade

Foram preservados o site institucional `kytto.com.br`, o storefront `loja.kytto.com.br`, `/admin`, `setpoint.kytto.com.br/admin`, a operação legada, o Commerce Core PostgreSQL, retirada na loja, o adapter Melhor Envio e os contratos públicos já publicados. A mudança de SSE para polling no quadro de atendimento reduz atualização instantânea, mas mantém consistência por chamadas autenticadas a cada oito segundos sem expor token.

## Correção residual do PDV: endpoint de combos

O erro reportado no anexo foi reproduzido como `GET /api/combos` com resposta `404 Not Found` no PDV. A causa foi uma divergência entre os runtimes: as rotas existiam somente em `server-erp.js`, enquanto o Render executa `cd app && node server.js`. O frontend capturava o 404 e substituía a resposta por lista vazia, deixando o PDV aparentemente carregado, mas sem combos.

A correção adicionou ao `server.js` as rotas de leitura de combos e modificadores e as rotas administrativas de grupos/combos, reutilizando `modificadores-combos-kytto.js`. O acesso exige autenticação de staff, os dados são separados por `empresaId`, componentes são validados contra o cardápio e falhas retornam códigos operacionais em vez de sucesso falso.

O smoke HTTP autenticado do runtime efetivo confirmou `/api/combos` em `200` com `{ ok: true, combos: [] }`, `/api/admin/modificadores/grupos` em `200` e tentativa de componente inexistente em `422 INVALID_COMBO_COMPONENT`, sem persistir dado. A correção ainda aguarda merge/deploy da PR para substituir o runtime publicado.
