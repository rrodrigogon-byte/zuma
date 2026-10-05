# Atendimento do e-commerce pelo WhatsApp

O atendente distingue produtos e compras online de serviços e agendamentos. Perguntas sobre pagamento não criam pedido nem cobrança e não exigem handoff por si só.

## Fonte de verdade

- `buscar_produtos`: catálogo publicado, preços e estoque da unidade.
- `consultar_pagamentos`: conta ativa e pronta em produção, mesmas regras de `GET /api/storefront/payment-methods`, domínio verificado no cadastro da vitrine.
- `publicPaymentMethods`: projeção compartilhada que nunca retorna credenciais, referências de segredos nem configuração livre. A elegibilidade de crediário continua sendo validada no checkout por pedido; não é uma oferta geral do atendente.
- Sem meio validado ou domínio verificado, não inventar pagamento/link. Parcelamento, juros, descontos e disponibilidade de entrega só podem ser prometidos quando confirmados pelo fluxo correspondente.
- Pagamento ocorre no checkout. Não pedir CPF, cartão ou códigos pelo WhatsApp. Não estender métodos online à barbearia presencial. Estornos, divergências e exceções financeiras seguem para a equipe.

## Implantação e validação

Sem variáveis novas, migração ou mudança de credenciais. Respeita a capacidade Loja e vendas.

Antes do PR: Node 938 testes, 885 passaram, 53 condicionais ignorados, zero falhas; Vitest 36 passaram; build web passou. Os testes PostgreSQL não foram executados por ausência de banco descartável disponível. Testes novos cobrem projeção segura, isolamento da unidade, consulta sem mutação, configuração indisponível, domínio inválido, capacidade desativada e crediário restrito.

Após aprovação e deploy, o dono deve testar do próprio celular:

1. Perguntar por um perfume e comparar preço/estoque com a vitrine.
2. Perguntar como pagar e solicitar link da loja; comparar meios com o checkout.
3. Perguntar parcelamento: não inventar condições; orientar a consultar a finalização.
4. Perguntar sobre pagar o corte presencial: não copiar os meios online automaticamente.
5. Pedir estorno: encaminhar à equipe.

Nenhuma mensagem de teste, pedido ou cobrança é criada por este PR. O teste real pós-deploy permanece pendente.
