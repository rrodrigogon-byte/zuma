# Agente Local Kytto

O **Agente Local Kytto** conecta um terminal da loja à fila de impressão e aos periféricos homologados sem expor impressoras, gavetas ou balanças diretamente à internet. Ele roda **na própria máquina da loja**, comunica-se com o servidor somente por HTTPS e mantém uma API limitada ao endereço `127.0.0.1`.

> O agente não deve ser exposto na rede local ou na internet. A configuração padrão já o restringe ao loopback.

## Recursos disponíveis

| Recurso | Situação | Observação |
|---|---:|---|
| Fila de impressão | Disponível | Reserva atômica, confirmação e tentativas controladas. |
| Impressora térmica em rede | Disponível | Protocolo TCP/RAW, normalmente porta `9100`, com comandos ESC/POS. |
| Gaveta de dinheiro | Disponível | Pulso ESC/POS pela impressora configurada ou modo de diagnóstico. |
| Leitor de código de barras | Compatível | Leitores em modo teclado não precisam de driver adicional. |
| Balança | Contrato disponível | O adaptador físico é específico do fabricante; há modo simulado para homologação. |
| Pinpad/TEF | Preservado | Continua usando o contrato local já existente da aplicação. |

## Provisionamento

1. No painel administrativo, cadastre uma loja e crie o terminal em **PDV Offline e Periféricos**.
2. Guarde o token exibido ao provisionar o terminal. Ele é mostrado somente uma vez. Em caso de perda, gere uma nova credencial no painel.
3. Copie `config.example.json` para `config.json` no diretório do agente e preencha `servidor_url`, `terminal_id`, `token_terminal` e os dispositivos cadastrados.
4. Instale Node.js 20 ou superior na máquina do caixa.
5. Execute:

```bash
cd agente-local-kytto
npm run check
npm start
```

6. Valide a instalação em `http://127.0.0.1:9357/health` a partir da própria máquina.

## Operação e segurança

| Prática | Obrigatoriedade |
|---|---:|
| Usar HTTPS no endereço do Kytto | Obrigatória em produção. |
| Executar o agente como usuário restrito do sistema operacional | Recomendado. |
| Manter `config.json` fora do Git | Obrigatória. |
| Expor a porta 9357 na rede | Proibido. |
| Rotacionar token ao trocar computador ou operador técnico | Obrigatório. |
| Usar modo `diagnostico` antes de apontar para impressora real | Recomendado. |

## Diagnóstico

Quando um dispositivo usa `"modo": "diagnostico"`, os trabalhos são gravados na pasta `diagnostico/`. Isso permite validar a formatação, a ordem e o reprocessamento da fila antes da ativação física.

Os eventos de falha, impressão e heartbeat são enviados ao servidor em lotes pequenos. Se a conexão cair, o agente não tenta reenviar uma confirmação de impressão indefinidamente sem controle: o servidor mantém a contagem de tentativas e exige novo processamento da fila.

## Adaptação de drivers

A integração de balanças USB/serial e pinpads depende do fabricante, do modelo e das bibliotecas certificadas. Para preservar segurança fiscal e a garantia do equipamento, integre apenas SDKs ou adaptadores homologados no arquivo `src/drivers.js`. Não execute comandos fornecidos pelo navegador, pelo servidor ou por textos de impressão.
