# Referências de Integração de Delivery — Kytto ERP

> Consulta realizada em 27 de julho de 2026. Estas referências são usadas exclusivamente para orientar a arquitetura de integração; credenciais, homologação e ativação junto aos parceiros continuam obrigatórias antes de qualquer operação real.

| Provedor | Constatações verificadas | Implicação para o Kytto ERP | Fonte oficial |
|---|---|---|---|
| iFood | O webhook é servidor-a-servidor, indicado para aplicações centralizadas; pode entregar o mesmo evento mais de uma vez e não garante ordem. Há uma única URL por aplicação. | O receptor deve validar assinatura, registrar `evento_externo_id` com unicidade, aceitar eventos fora de ordem e processá-los de modo idempotente. | [Webhook overview](https://developer.ifood.com.br/en-US/docs/guides/modules/events/webhook-overview) |
| iFood | O iFood pode retentar eventos por até 15 minutos; recomenda polling como contingência para indisponibilidade prolongada. | O módulo mantém um log de eventos e uma fila de reconciliação, sem depender exclusivamente do recebimento em tempo real. | [Webhook overview](https://developer.ifood.com.br/en-US/docs/guides/modules/events/webhook-overview) |
| iFood | O fluxo de pedidos suporta recebimento de evento, obtenção dos detalhes, confirmação, início de preparo, despacho/pronto para retirada e cancelamento. | O estado interno normalizado separa o pedido recebido das ações externas, permitindo adaptação por provedor. | [Order API workflow](https://developer.ifood.com.br/en-US/docs/guides/modules/order/workflow) |
| Uber Eats | A API Marketplace possui webhooks de pedido, cancelamento e alterações de loja. A API pode exigir aprovação escrita. | O conector Uber permanece desabilitado até que a credencial e a aprovação de acesso sejam configuradas pela empresa. | [Uber Eats Webhooks](https://developer.uber.com/docs/eats/guides/webhooks) |
| Uber Eats | A assinatura chega no cabeçalho `X-Uber-Signature` como HMAC-SHA256 do corpo, com o segredo do cliente. O pedido deve ser aceito ou negado em até 11,5 minutos. | O receptor preserva o corpo bruto para validação em tempo constante e desacopla o recebimento do webhook do processamento do pedido. | [Uber Eats Webhooks](https://developer.uber.com/docs/eats/guides/webhooks) |

## Decisões de segurança

1. Segredos de webhook não são enviados de volta pela API e devem ser armazenados cifrados.
2. Nenhuma integração é ativada por padrão; cada canal exige configuração administrativa e teste de assinatura.
3. Eventos externos são imutáveis, idempotentes e auditados antes da criação ou atualização do pedido operacional.
4. Ações externas são registradas em fila própria; o sistema nunca confirma, cancela ou despacha um pedido sem uma ação explícita autorizada.
5. A implementação usa contratos configuráveis por canal para não assumir esquemas de assinatura não documentados ou alterados pelos provedores.
