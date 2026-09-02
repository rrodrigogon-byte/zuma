# Atendente humanizado da Barbearia Dino

## Objetivo

O atendente WhatsApp da Barbearia Dino opera dentro do núcleo atual do SetPoint e usa o mesmo tenant, loja, catálogo, estoque, clientes, agenda, campanhas e auditoria do ERP. Ele não mantém uma base paralela e não responde com preço, horário, profissional, estoque ou promoção inventados.

## Capacidades configuradas

| Capacidade | Comportamento |
| --- | --- |
| Atendimento humanizado | Português brasileiro, tom cordial e natural, uma pergunta por vez e transparência de que é assistente virtual na apresentação. |
| Captação de clientes | Cada mensagem recebida pode criar ou atualizar o lead em `clientes`, registrar consentimento de atendimento e gravar a interação no CRM. |
| Loja e vendas | Consulta somente produtos publicados, preço vigente e estoque disponível. Prepara pedido para retirada na unidade e exige `CONFIRMAR`. |
| Agenda | Lista serviços, profissionais e horários reais. Prepara agendamento, remarcação e cancelamento com confirmação explícita. |
| Promoções | Lista somente promoções vigentes. Marketing exige opt-in do cliente; cada envio individual exige preparação e `CONFIRMAR`. |
| Lembretes | Usa a fila governada de notificações já existente, sem disparador paralelo. |
| Handoff humano | Reclamações, exceções, reembolso, dados sensíveis, erro operacional ou pedido de pessoa interrompem a automação até a equipe liberar a sessão. |

## Fluxo de atendimento

1. O webhook Evolution recebe a mensagem e valida o canal, assinatura, empresa e loja.
2. O evento é gravado com idempotência e enfileirado para processamento assíncrono.
3. O contato é captado/atualizado no CRM por telefone e a interação é registrada.
4. O agente consulta ferramentas do sistema para responder sobre loja, catálogo, serviços, profissionais, agenda, pedidos, perfil e promoções.
5. Ações de gravação são apenas preparadas e ficam pendentes por até 30 minutos.
6. O atendente apresenta resumo verificável e aguarda `CONFIRMAR` ou `CANCELAR`.
7. A confirmação executa a transação determinística e responde com o código ou resultado real.
8. A operação fica auditada por empresa, loja, sessão, ação e cliente.

## Marketing e privacidade

Promoções não são enviadas por padrão. Para habilitar a capacidade no painel, a empresa deve marcar **Promoções** em Integrações. Mesmo habilitada, a IA exige consentimento explícito individual, registra evidência e respeita `SAIR`, `PARE`, `PARAR` e solicitações equivalentes de revogação.

A ativação da capacidade não expõe credenciais, tokens ou IDs internos. O canal continua limitado à empresa e à loja ativas; uma conversa da Dino não pode consultar clientes, pedidos, agenda ou campanhas de outro tenant.

## Configuração no painel

Acesse `/admin/barbearia-erp?area=integracoes&tab=Integrações`, selecione a empresa e loja **Barbearia Dino**, informe a instância Evolution e o nome do atendimento. Marque as capacidades desejadas, salve o canal em rascunho, execute o diagnóstico do Gemini, ative o atendente e sincronize o webhook.

As capacidades recomendadas para a Dino são:

- Tom humanizado;
- Captação de clientes;
- Loja e vendas;
- Agenda;
- Lembretes;
- Handoff humano.

A capacidade de promoções deve permanecer desligada até a política de consentimento e o conteúdo comercial da unidade serem revisados.

## Limitações intencionais

Pagamentos externos não são executados pelo WhatsApp. Pedidos são preparados para retirada e seguem o fluxo de pagamento definido pela operação. A IA também não confirma disponibilidade sem consulta ao sistema e não conclui agendamento, remarcação, cancelamento, pedido ou envio promocional sem confirmação do cliente.

## Validação técnica

A implementação foi validada com `node --check` nos módulos do atendente, CRM, worker e ferramentas; build React aprovado; testes de webhook, campanhas, carrinho, CRM e ferramentas aprovados; e regressão específica para bloquear promoções quando a capacidade não estiver habilitada.
