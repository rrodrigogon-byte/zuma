# Kytto Clube & Academia

O módulo serve academias, clubes e estúdios. Cada empresa tem os próprios dados no PostgreSQL do Commerce Core (`empresa_id` em todas as tabelas). Nada fica global.

O que o módulo faz:
- catraca Control iD na nuvem;
- contrato digital com aceite pelo WhatsApp;
- grade de aulas com lista de espera;
- régua de retenção pela IA;
- Wellhub e TotalPass;
- cobrança por Pix na conta da própria academia.

Só liga com `COMMERCE_CORE_ENABLED=1`. Sem isso, nenhuma rota do Clube é montada.

## Onde fica

| O quê | Caminho |
|---|---|
| Menu no Kytto | Grupo **Clube & Academia** → `/admin/clube/<seção>`. Abre o painel do módulo embutido, com o menu do Kytto. |
| Painel avulso (tablet da recepção) | `/clube/painel` |
| APIs do painel | `/api/admin/clube/{acesso,contratos,aulas,retencao,parceiros,cobrancas}` |
| Catraca Control iD | `/api/acesso/controlid/<segredo>/…` |
| Wellhub / TotalPass | `/api/integracoes/<plataforma>/…` |
| Páginas do aluno | `/contrato/<token>` (aceite), `/clube/passe/<token>` (QR de entrada), `/clube/pagar/<token>` (Pix) |

**Permissões nas APIs do painel:**
- leitura exige `customers.read` no Commerce;
- alteração exige `customers.write`;
- a empresa é sempre a ativa (`X-Empresa-Id`) e nunca vem do corpo da requisição.

**Menu:** o módulo `clube` entra em `TENANT_ADMIN_MODULES`. Quando a empresa tem lista de módulos, o menu aparece só se `clube` estiver nela.

## Ligar numa academia

1. Ajustes → Planos: crie os planos com mensalidade, fidelidade e tolerância.
2. Ajustes → Catracas: cadastre o aparelho e cole a URL (mostrada uma única vez) em servidor online e em servidor Push, no modo **Online Pro**. Depois toque em "Enviar todos os alunos".
3. Cobranças: ligue o Pix com a chave, o nome e a cidade da academia. A partir daí, a régua, a IA e a recepção mandam o link `/clube/pagar/...`. A recepção dá baixa quando o Pix cai. A baixa estende o "pago até" e libera a catraca na hora.
4. Contratos: crie o modelo e envie. O aluno aceita com o código que chega no WhatsApp. No aceite, ele pode autorizar novidades (é opcional).
5. Aulas: crie as turmas. A grade das próximas 2 semanas é gerada sozinha.
6. Retenção: escolha a base legal das novidades e campanhas, o tom, os horários e o limite diário. Antes de ligar, confira na prévia quem receberia hoje.
7. Parceiros: conecte o Gym ID do Wellhub ou a place key do TotalPass e cadastre a URL do webhook no portal da plataforma.

## IA do WhatsApp

As 18 ferramentas `clube_*` entram pela extensão em `app/core/whatsapp-ai-extensoes.js`. Elas aparecem só para empresas com plano de acesso ativo ou turma ativa. Barbearias e lojas não as veem.

**Identificação do aluno:**
- O aluno é achado pelo telefone da conversa, comparado com `commerce_customers.telefone_normalizado`.
- Número desconhecido pode consultar vagas e registrar interesse. Nesse caso, vira cadastro no Commerce.

**A cada mensagem recebida:**
- a régua pausa para aquele aluno;
- "parar" grava o opt-out.

## LGPD

**Base legal das novidades e campanhas:**
- O padrão é **consentimento**: só recebe quem autorizou.
- A autorização pode vir do aceite do contrato, da recepção ou da conversa. A evidência é guardada.
- A academia pode escolher **legítimo interesse**. Nesse caso, ela deve ter registrado a avaliação (LIA).

**Opt-out:**
- Toda mensagem de novidade termina com "responda PARAR".
- O opt-out global do WhatsApp da empresa também é respeitado.

**Cobrança e vencimento:** são informativos e saem para todos.

## Trazer os sócios do TTC

Em Ajustes → "Trazer sócios do TTC", só o administrador da plataforma:
1. Toque em "Ver prévia". Nada é gravado.
2. Toque em "Importar agora".

O que é importado:
- Os sócios saem de `db().socios`, com as faturas, as `mensalidades` e os planos.
- Cada sócio vai para a empresa ativa: cadastro no Commerce (reaproveita o telefone e o e-mail já cadastrados), plano e matrícula com o "pago até" calculado pelas faturas pagas.
- O de-para fica em `clube_importacoes`. Rodar de novo não duplica nada e só estende o "pago até".

A prévia lista quem está sem telefone. Esses sócios não recebem WhatsApp nem o código do contrato.

## Variáveis (Render)

| Variável | Para quê |
|---|---|
| `CLUBE_CONTRATO_SECRET` | HMAC do código de aceite (32+). Sem ela, o pedido de código responde 503. |
| `CLUBE_PARCEIROS_SECRET` | Cifra as credenciais Wellhub/TotalPass e o HMAC do CPF (32+). |
| `CLUBE_QR_SECRET` | QR dinâmico e passe por link (32+). |
| `PUBLIC_BASE_URL` | Links absolutos: contrato, passe, Pix, webhook. |
| `CLUBE_ROTINAS=1` | Liga lista de espera, lembretes, faltas, régua, congelamentos e validações de parceiro. |
| `WELLHUB_API_TOKEN`, `WELLHUB_WEBHOOK_SECRET`, `TOTALPASS_PARTNER_API_KEY` | Credenciais de parceiro do Kytto, quando liberadas. |

Nenhuma variável `WHATSAPP_*` ou `CHATBOT_BACKEND_*` foi criada ou alterada. O envio usa o canal WhatsApp de cliente da própria empresa (Evolution).

## Testes

```bash
npm run test:node        # inclui app/core/clube-*.test.js; os .pg são pulados sem banco
CLUBE_PG_TEST_URL=postgres://postgres@localhost:5432/clube_test npm run test:clube-pg   # só localhost e banco *_test
```

## Crescimento

- **Gateways:** o campo `provedor` de `clube_cobranca_config` aceita novos gateways por empresa (InfinitePay, Mercado Pago) sem mudar a régua nem a IA. Toda baixa passa por `registrarPagamentoClube`, que é idempotente pelo id do pagamento.
- **Outras origens de importação:** uma planilha ou outro sistema só precisa gerar a lista no formato de `lerSociosTtc` e chamar `importarAlunos` com outra `origem`.
- **Outros módulos na IA:** qualquer módulo novo pode registrar ferramentas na IA com `registrarExtensaoWhatsappAi`, sem tocar no núcleo.
- **Rotinas:** as rotinas usam trava no banco. Hoje o serviço roda com `numInstances: 1`. O cache de "extensão ativa" (5 min) fica por processo.
