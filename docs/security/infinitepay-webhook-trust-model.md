# InfinitePay Checkout — modelo de confiança do webhook

Consulta à documentação oficial em 26 de setembro de 2026:

- <https://www.infinitepay.io/checkout-documentacao>
- <https://www.infinitepay.io/checkout>

O contrato público documenta `webhook_url`, payload do evento, reenvio após HTTP 400 e a consulta autoritativa `POST https://api.checkout.infinitepay.io/payment_check` com `handle`, `order_nsu`, `transaction_nsu` e `slug`.

A documentação pública consultada **não documenta assinatura HMAC, segredo de webhook ou header verificável** para esse Checkout Integrado. Portanto:

- `signature_valid=true` não pode significar HMAC verificado para InfinitePay;
- callback e redirect são apenas gatilhos não autoritativos;
- pagamento e pedido só podem avançar após `payment_check` retornar `paid=true` e após validar `order_nsu`, `transaction_nsu`, `slug`, valor e captura contra o registro persistido;
- identificadores recebidos não devem ser persistidos antes dessa validação autoritativa;
- eventos duplicados devem permanecer idempotentes.

Se a InfinitePay publicar posteriormente um mecanismo de assinatura verificável, ele deve ser implementado em mudança separada, com teste de assinatura inválida e rotação de segredo.
