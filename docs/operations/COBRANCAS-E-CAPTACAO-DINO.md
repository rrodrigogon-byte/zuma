# Cobranças, cashback e captação da Dino

Tudo nasce desligado. As configurações ficam em **Gestão → Cobranças e cashback**, e só quem é da gestão da unidade pode alterá-las.

## Meio de cobrança

O sistema escolhe o meio de cobrança nesta ordem:

1. **InfinitePay**: é usada quando o Render tem a variável `INFINITEPAY_HANDLE` (a InfiniteTag, sem o `$`) **e** o id da empresa está em `INFINITEPAY_BARBEARIA_EMPRESAS`. Para a Dino, use `INFINITEPAY_BARBEARIA_EMPRESAS=d0d0ac01-8e50-4b61-8c79-de4aaa916da6`.
   - A InfiniteTag é de uma única conta. Por isso, uma empresa fora da lista nunca recebe nessa conta.
   - O cliente paga por um link, com Pix ou cartão.
   - A confirmação é automática. O sistema recebe o aviso em `/api/webhooks/infinitepay/barbearia` ou a volta do checkout e só então confere o pagamento na própria InfinitePay (`payment_check`), comparando número do pedido e valor.
   - É preciso ter `PUBLIC_BASE_URL=https://dino.kytto.com.br` para que o endereço de volta e o do aviso fiquem corretos.
2. **Pix da barbearia**: é usado quando não há InfinitePay e existe uma chave Pix cadastrada.
   - O cliente recebe o Pix copia e cola.
   - A equipe confere o extrato e confirma em **Pix recebido**. A confirmação registra quem confirmou.
3. **Nenhum**: o sistema recusa ligar o sinal e a mensalidade.

Cada pagamento confirmado vira uma receita paga no financeiro central, uma única vez.

## Sinal no agendamento online

- O valor pode ser um percentual do serviço ou um valor fixo, com um prazo para pagar (padrão 30 minutos).
- O horário fica reservado durante o prazo, mais 5 minutos de tolerância. Sem pagamento, o horário é liberado, o cliente é avisado (se autorizou o WhatsApp) e a lista de espera também.
- Se o horário for cancelado pelo cliente ou pela equipe, o sinal pendente é cancelado.
- Se o link de pagamento não puder ser gerado, o agendamento não fica preso: ele é cancelado e o cliente vê um aviso.
- O dinheiro que entra é sempre lançado no financeiro. Quando não dá para aplicar o efeito, a cobrança aparece em vermelho no painel com o motivo:
  - pago depois de o horário ser liberado;
  - pago depois de cancelado;
  - período do clube já pago no balcão (pagamento em dobro);
  - assinatura encerrada.

  Nesses casos, a equipe remarca o horário ou devolve o dinheiro.
- Com sinal pago, a tela de concluir o atendimento já desconta o valor do sinal. Se o sinal e o cashback cobrirem o serviço inteiro, o atendimento é concluído com R$ 0,00 recebido no dia.
- O agendamento feito pela atendente no WhatsApp não cobra sinal.

## Mensalidade do clube

- Uma vez por hora, o sistema gera a cobrança do próximo ciclo para cada assinatura ativa que vence em até N dias. O botão **Gerar cobranças do clube agora** faz o mesmo na hora.
- O link (ou o Pix) vai pelo WhatsApp só para quem autorizou mensagens de atendimento. SAIR cancela os avisos.
- A cobrança usa a mesma referência do pagamento registrado no balcão. Quando a equipe registra o pagamento no balcão, o link pendente do mesmo período é cancelado.
- Quem atrasa além da carência fica bloqueado no clube, como antes.

## Cashback

- É um percentual de 0 a 30% sobre o valor recebido no atendimento concluído, com validade de 7 a 365 dias.
- O crédito só é gerado quando o recebimento é lançado no financeiro. A base é o valor recebido, limitada ao preço do serviço.
- O uso acontece na tela de concluir o atendimento, no campo **Usar cashback**. Fica registrado na auditoria. Saldo insuficiente é recusado antes de concluir.
- O cliente vê o saldo em **Meu agendamento** no site e pelo WhatsApp ("qual meu cashback?").

## Captação por canal

Use um link por canal. Os links prontos estão em **Relacionamento → Origem dos clientes**.

| Canal | Link |
|---|---|
| Google (botão "Agendar" do Perfil da Empresa) | `https://dino.kytto.com.br/agendar/dino?canal=google` |
| Instagram (link da bio) | `https://dino.kytto.com.br/agendar/dino?canal=instagram` |
| QR code no balcão | `https://dino.kytto.com.br/agendar/dino?canal=qrcode` |

- O painel mostra, por canal, os agendamentos, os clientes novos, os concluídos, os cancelados e a receita.
- O link `/agendar/:slug` publica dados estruturados de barbearia com agendamento (schema.org `HairSalon` e `ReserveAction`), e o Google lê isso.
- O "Reserve with Google" com agendamento dentro do próprio Google exige parceria homologada. Até lá, o botão **Agendar** do Perfil da Empresa aponta para o link com `?canal=google`.

## Receita da IA

O painel **Gestão → Receita da IA** soma os atendimentos concluídos que vieram de três fontes:

- a atendente IA no WhatsApp;
- vagas aproveitadas pela lista de espera;
- indicações.

## Pontos de atenção

- **Cartão parcelado com juros na InfinitePay.** Se o valor confirmado vier com os juros, a conferência recusa por diferença de valor e a cobrança fica pendente. Confirme com a InfinitePay como o valor é informado antes de liberar o parcelamento com juros.
- **Painel de cobranças.** O painel e as configurações são restritos à gestão da unidade.
