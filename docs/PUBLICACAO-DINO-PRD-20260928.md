# Prompt para o Manus: subir o Dino em produção

Você vai publicar em produção um pacote de código que já está pronto e testado. **Não escreva nem altere código.** Seu trabalho é abrir as PRs, conferir, mesclar na ordem, acompanhar o deploy e validar.

## Onde
- Repositório: `rrodrigogon-byte/agro-open`
- Branch de produção: `fix/kytto-comandas-pdv-20260808` (em `ef74e241` em 29/09 às 6h47; nada das últimas entregas está no ar)
- Serviço: Render **setpoint**, com deploy automático dessa branch, servindo `dino.kytto.com.br`.
  - Se o Render mostrar outro serviço ou outra branch, **pare e avise**.
  - Não use `setpoint-ultra` nem `main`.

## Regras
1. Mescle cada etapa **só depois de o Rodrigo escrever "publicar"**. Abrir PR e rodar testes pode ser feito antes.
2. Nunca escreva em log, chat, PR ou arquivo: senhas, tokens, `DB_PASS`, `JWT_SECRET`, chaves de API, segredos de webhook.
3. Não faça force-push na branch de produção. Não mexa em banco, produtos, preços, estoque ou pedidos. A única exceção é o pedido de teste do item 11 da validação.
4. Se qualquer passo falhar: pare, faça "Revert" do merge daquela etapa pelo GitHub e avise o Rodrigo com o trecho do log, sem segredos.

## Antes de começar
Confirme com o Rodrigo, sem pedir valores, estas três coisas:
- ele trocou as três senhas que a PR #105 deixou no histórico do Git;
- `JWT_SECRET` e `ADMIN_PASS` estão definidos no Render;
- `NODE_ENV` está exatamente `production`;
- `PLATFORM_ADMIN_EMAILS` contém o e-mail com que ele entra no painel. A partir desta versão, conta ligada a uma empresa só vê os módulos da empresa; sem o e-mail nessa lista, ele perderia inscrições, financeiro do evento e a administração da plataforma.

## Etapa 1: contas (vai primeiro)
1. Use a PR **#179** (`hotfix/seguranca-contas-20260928` → `fix/kytto-comandas-pdv-20260808`). Ela deve ter exatamente 5 arquivos.
2. Rode os testes:
   ```
   cd app && npm install && node --test --test-concurrency=1 server-contas-seguranca.test.js server-barbearia-runtime.test.js test.js
   cd ../web && npm install && npm run build
   ```
   Tudo deve passar.
3. Com "publicar": mescle e espere o Render ficar "Live". Depois valide:
   - `GET https://dino.kytto.com.br/api/info` responde 200;
   - `POST /api/auth/esqueci-senha` com `{"email":"qa-inexistente@example.invalid"}` responde 200 com a mensagem "peça ao administrador da sua empresa…";
   - o Rodrigo continua conseguindo entrar no painel.

## Etapa 2: tudo o mais
1. Use a PR **#180** (`integ/dino-20260928` → `fix/kytto-comandas-pdv-20260808`).
   - Ela já contém as PRs #171 a #178, inclusive a sua versão `release/commerce-dino-20260928` (#178), que foi unida a ela em 29/09.
   - **Não mescle #171 a #178 separadamente**: a #180 é a única versão a subir.
   - Onde as duas versões tratavam o mesmo problema, ficou a regra mais rígida: pagamento que chega depois de falha, cancelamento ou expiração vira "estorno necessário", sem reabrir o pedido; reserva vencida cancela o pedido pela sua varredura com lease; criar pedido exige chave de idempotência.
   - Confira que o diff não tem `.env`, `db.json`, dumps ou arquivos `zz-claude-*`.
   - Depois do merge, feche as PRs #171 a #178 com o comentário "incorporada via #180".
2. Rode os testes:
   ```
   cd app && npm install && node --test --test-concurrency=1 *.test.js core/*.test.js migrations/*.test.js
   cd ../web && npm install && npm run test:commerce && npm run build
   ```
   Esperado: servidor com 544 testes passando e 0 falhas (32 pulados por dependerem de banco); `test:commerce` com 99 passando e 0 falhas; build sem erro.
   Se tiver um PostgreSQL **descartável**, rode também `core/*.pg.test.js` com `DATABASE_URL`, `COMMERCE_CHECKOUT_TEST_DATABASE_URL`, `COMMERCE_IDENTITY_TEST_DATABASE_URL` e `COMMERCE_PRODUCT_ADMIN_TEST_DATABASE_URL` apontando para ele, e `COMMERCE_CHECKOUT_HARDENING_TEST_DATABASE_URL` apontando por socket para o banco `commerce_checkout_hardening_test`, e `SERVER_SCOPE_TEST_DATABASE_URL` também para ele. Esperado: 31 passam, 0 falhas.
3. No Render, **antes do merge**:
   - Confira que já existem: `COMMERCE_CORE_ENABLED=1`, `DATABASE_URL`, `PLATFORM_ADMIN_EMAILS`.
   - Peça ao Rodrigo para cadastrar os valores secretos, porque você não os vê: `WHATSAPP_PROVIDER=chatbot_backend`, `CHATBOT_BACKEND_URL`, `CHATBOT_BACKEND_KEY`, `CHATBOT_BACKEND_INSTANCE`, `WHATSAPP_AI_WEBHOOK_SECRET` (valor aleatório forte), `GEMINI_API_KEY` e, se quiser, `ANTHROPIC_API_KEY`.
   - Defina: `PUBLIC_BASE_URL=https://dino.kytto.com.br`, `FEATURE_WHATSAPP_AI=true`, `AI_AUTOMATION_SCHEDULER=false` (fica assim por 48 h) e `AI_LEARNING_SCHEDULER=true`.
   - Defina `CHATBOT_BACKEND_EMPRESA_ID` com o id da empresa Dino. Descubra com esta consulta **somente de leitura**: `SELECT empresa_id FROM commerce_storefront_aliases WHERE alias = 'dino' AND ativo = true;`. Sem ela, a instância de WhatsApp fica com a primeira empresa que abrir a tela de conexão.
   - Todas as outras variáveis novas já têm valor padrão; não precisa definir.
4. Com novo "publicar": mescle. No log do deploy confira:
   - as migrations `052_ai_brain_memory_learning.sql`, `053_commerce_phone_verification.sql` e `054_commerce_loyalty_expiry_marks.sql` foram aplicadas sem erro (as três só criam tabelas);
   - o serviço está "Live";
   - não aparece `Boot interrompido` nem `FATAL`.

   Se o runner acusar "checksum" de uma migration antiga, **pare**.

   Se o boot parar dizendo que não leu o estado do GCS, o Render mantém a versão anterior no ar. **Não contorne**: avise o Rodrigo.

## Validação em produção (etapa 2)
Anote passou/falhou em cada item:

| # | Teste | Esperado |
|---|---|---|
| 1 | `GET /api/info` | 200 |
| 2 | Abrir `https://dino.kytto.com.br` | Produtos com preço; esgotados no fim |
| 3 | Colocar 21 unidades de um produto no carrinho e finalizar | Recusa com "máximo de 20 unidades por produto" (não pode aparecer "erro interno") |
| 4 | Frete grátis no checkout | Aparece em reais, sem texto repetido |
| 5 | Painel → Cérebro do atendente | Abre na aba Ativação ("X de 17 itens prontos") |
| 6 | Com o Rodrigo: seguir os botões da Ativação e cadastrar o webhook no backend do NossaGente com a URL e o cabeçalho mostrados | Itens ficam verdes |
| 7 | O Rodrigo manda "oi" no WhatsApp da loja | Resposta em até 1 minuto |
| 8 | O Rodrigo manda "SAIR" | Resposta "Preferência registrada…" |
| 9 | Painel → Barbearia → Comissões do dia | Uma comanda com desconto aparece com a comissão sobre o valor com desconto |
| 10 | Agenda pública `/agendar/dino` | Abre e mostra horários |
| 11 | Só se o Rodrigo autorizar: 1 pedido real com o menor valor, pago por ele | Pedido fica "pago" em até 2 min; ao cancelar pelo painel, o estoque volta |
| 12 | Abrir o checkout e deixar um pedido sem pagar por mais de 30 min | O pedido é cancelado sozinho e o estoque volta |
| 13 | Rodrigo entra no painel com a conta dele | Continua vendo Inscrições e o financeiro do evento |
| 14 | Com o Rodrigo: entrar com a conta de um funcionário do Dino e abrir `/api/admin/inscricoes` | 403 "módulo global da plataforma" |
| 15 | Checkout de um pedido de cliente **sem** crediário | Não aparece "Marcar na conta" |

Consultas **somente de leitura** para acompanhar nas primeiras 24 h (nunca rode UPDATE ou DELETE):
```sql
SELECT COUNT(*) FROM commerce_inventory_reservations r JOIN commerce_orders o ON o.id = r.order_id
 WHERE r.status = 'pending' AND r.expira_em < now() - interval '10 minutes' AND o.status = 'pending_payment';  -- esperado 0
SELECT id, order_id, metadata->'lateCapture' FROM commerce_payments WHERE metadata #>> '{lateCapture,state}' = 'refund_required' ORDER BY atualizado_em DESC LIMIT 20; -- pago depois de cancelado/expirado ou pago duas vezes: estornar
SELECT provedor, COUNT(*), SUM(custo_centavos) FROM ai_router_runs WHERE criado_em::date = current_date GROUP BY provedor;    -- gasto de IA do dia
```

No log do Render, avise se aparecer qualquer um destes:
- `Falha ao expirar reservas` ou `Falha ao expirar reservas de alguns pedidos` (reservas vencem em 30 min);
- `SCOPE_UNAVAILABLE` (o painel não conseguiu confirmar a empresa do usuário no banco);
- `Falha ao expirar pontos`;
- `[WhatsApp AI] falha no ciclo` repetido mais de 3 vezes;
- HTTP 5xx em `/api/storefront/orders` ou `/api/webhooks/infinitepay/payments`.

## Para desligar sem reverter
- **Atendente de WhatsApp:** `FEATURE_WHATSAPP_AI=false` e `AI_AUTOMATION_SCHEDULER=false`.
- **Crediário na vitrine:** desative a conta de crediário do cliente no painel. Sem conta de crediário ativa, a opção "Marcar na conta" some sozinha.

## Relatório final para o Rodrigo
Mande:
- os links das PRs e dos merges;
- o horário do deploy de cada etapa;
- a tabela de validação preenchida;
- qualquer desvio deste roteiro e o motivo;
- a confirmação de que nenhuma senha, token ou chave foi exposta.
