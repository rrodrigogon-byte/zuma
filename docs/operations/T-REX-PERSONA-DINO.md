# T-Rex: persona do atendente da Dino no WhatsApp

O atendente de IA da Barbearia Dino passa a falar como o **T-Rex**, o mascote da casa: mensagens curtas, jeito de recepção, figurinhas e lembretes na mesma voz. A persona muda **como** o atendente fala, nunca **o que** ele pode fazer: ferramentas, confirmação por SIM, consentimentos, travas de segurança, egress e handoff continuam exatamente iguais.

## O que muda para o cliente

| Situação | Antes | Com o T-Rex |
| --- | --- | --- |
| Primeiro contato | Aviso de privacidade longo + "Oi! Sou a assistente virtual da Barbearia Dino…" | "E aí, boa tarde! Aqui é o T-Rex, da Barbearia Dino. Uso esta conversa só pra te atender e chamo a equipe quando você quiser. Quer marcar um horário ou ver algum perfume?" |
| Horários | "1) terça 06/10 às 12:00; 2) terça 06/10 às 12:30; 3) …" | "terça 06/10 às 12h, 12h30 ou 13h. Qual prefere?" |
| Preços | Lista colada numa linha só, com R$ 40,00 | "Barba Completa R$ 40, Corte Masculino R$ 45 e Pedicure R$ 50." |
| Resumo para confirmar | "Resumo para confirmar: …" | "Confere aí: …" (mesmo resumo exato e a mesma dica de SIM/NÃO) |
| Agendamento feito | "Agendamento confirmado: Corte Masculino com Bruno em 06/10/2026 às 12:00. Código …. Se precisar…" | "Tá marcado! Corte Masculino com Bruno, ter 6/10 às 12h. Código …" + figurinha "agendado" |
| "vc é robô?", "é humana?", "to falando com um atendente?" | Ia para o modelo ou para a equipe ("humano" disparava handoff) | Resposta fixa e verdadeira: "Sou o assistente digital da Barbearia Dino. Quer que eu chame a equipe ou sigo com você?" A conversa continua. Pedido de pessoa, dado sensível e injeção continuam sendo tratados antes |
| Lembrete de 24 h | "Olá, João Silva. Lembrete do seu agendamento amanhã, 10/10/2026, às 09:00. Serviço: … Profissional: …" | "Opa, João! Passando pra lembrar: amanhã, sáb 10/10 às 9h, Corte Masculino com Bruno. Responda CONFIRMO, REMARCAR ou CANCELO." |
| Toque de retomada | "Oi, Paulo! Ficou faltando só sua confirmação: … Se preferir outro horário ou produto, é só me dizer." | "Opa, Paulo! Só falta você confirmar: …" |
| Handoff, opt-out, erros | "Encaminhei sua conversa para a equipe humana da …" | "Beleza, passei pra equipe da Barbearia Dino. Já te respondem aqui." |

Conversas inteiras, antes e depois, saem do simulador (seção Testes).

## Como funciona

| Peça | Arquivo | O que faz |
| --- | --- | --- |
| Persona | `app/core/whatsapp-ai-persona.js` | Configuração por canal, bloco do prompt (identidade, regras de escrita, personalidade, situações difíceis, figurinhas), saudação, apresentação, "vc é robô?", textos fixos, confirmação curta, lembrete e toque na voz do T-Rex |
| Estilo | `app/core/whatsapp-ai-style.js` | Aplicado em código depois do modelo: tira markdown e listas, transforma enumeração em frase, "12:00" → "12h", "R$ 45,00" → "R$ 45", remove frases de robô ("Fico à disposição", "Prezado", "Infelizmente"), prioriza até 2 mensagens com alvo de 120 caracteres, preservando conteúdo operacional mais longo; no envio, divide o conteúdo salvo em bolhas (até 4) |
| Figurinhas | `app/core/whatsapp-figurinhas.js` + `app/assets/trex/figurinhas/*.webp` | 9 figurinhas WebP 512×512 (< 100 KB). Envio depois do texto, no máximo 1 por dia e por cliente, nunca com a conversa na equipe. Passa pelas mesmas travas de egress do texto |
| Atendente | `app/core/whatsapp-ai.js` | Liga tudo: prompt com persona, textos fixos, ferramenta `enviar_figurinha`, estilo, envio em bolhas com progresso salvo (`metadados.bolhasEnviadas`), configuração `PATCH /api/admin/commerce/whatsapp-ai/persona` com auditoria |
| Lembretes | `app/core/barbershop-appointment-notifications.js` | Lembrete de 24 h, remarcação e cancelamento na voz do T-Rex quando o canal tem persona |
| Retomada | `app/core/whatsapp-ai-followup.js` | Toque de conversa parada na voz do T-Rex |
| Painel | `web/src/pages/admin/BarbeariaERP.jsx` | Cartão "Persona do atendente" em Integrações: nome, quando diz que é assistente, mensagens curtas, figurinhas, prévia das 9 figurinhas |

### Garantias mantidas

- O conteúdo salvo no banco é o texto inteiro. A dica de confirmação ("Responda SIM para confirmar ou NÃO para desistir.") e a pergunta de personalização continuam no último texto do atendente, então a confirmação natural ("pode marcar", 👍) e o "sim"/"não" curto da autorização seguem funcionando.
- O resumo de ação continua vindo do sistema, não do modelo; só o prefixo mudou ("Confere aí:").
- Ofertas e combos continuam passando por `propor_oportunidade`.
- Reenvio da mesma tarefa gera o mesmo texto (as variações são escolhidas pelo id da mensagem) e não repete bolhas já aceitas.
- Pergunta direta sobre robô, IA ou pessoa recebe sempre a verdade; o estilo só remove a oração "sou a assistente virtual" (nunca o resto da frase) quando ninguém na rajada perguntou isso.
- A apresentação mantém a finalidade do tratamento e o caminho para a equipe ("Uso esta conversa só pra te atender e chamo a equipe quando você quiser."). A pergunta de autorização de personalização continua separada e revogável.
- A figurinha "promocao" nunca é escolhida pelo modelo; "perfume-novo" só com indicação pedida pelo cliente ou oportunidade liberada pelo gate; nada comercial para quem respondeu SAIR.
- Valores e códigos nunca são partidos ("R$ 1.234,50", "AG-12.345"); o estilo é linear (sem regex com retrocesso) e, se falhar, devolve o texto validado.
- As bolhas da primeira tentativa ficam salvas (`metadados.bolhasTexto`); a retomada após falha usa exatamente as mesmas.

## Ligar em produção

1. Merge desta branch na de produção (sem migration nova: a persona fica em `canais_integracao.configuracao.persona`).
2. Painel → Barbearia → Integrações → **Persona do atendente** → confere nome "T-Rex" → **Salvar persona**. Alternativa sem painel: `WHATSAPP_AI_PERSONA=trex` no Render (o canal salvo no painel tem prioridade; "Usar a persona neste canal" desmarcado desliga mesmo com a variável).
3. Render:

| Variável | Valor | Efeito |
| --- | --- | --- |
| `WHATSAPP_AI_PERSONA` | `trex` (opcional) | Liga a persona onde o canal não tem configuração própria, só para a empresa dona |
| `WHATSAPP_AI_PERSONA_EMPRESA_ID` | id da empresa (opcional) | Empresa dona da variável acima; padrão `CHATBOT_BACKEND_EMPRESA_ID`. Sem nenhuma das duas, a variável não liga nada |
| `WHATSAPP_SIMULATE_TYPING` | `true` | Backend mostra "digitando…" antes de cada bolha |
| `WHATSAPP_AI_BUBBLE_DELAY_MS` | `900` (padrão) | Pausa entre bolhas, proporcional ao tamanho (máx. 2,5 s); `0` desliga |
| `CHATBOT_BACKEND_STICKER_PATH` | `/send-media` (quando o backend tiver) | Liga o envio de figurinhas pelo backend próprio |

4. Piloto com `WHATSAPP_POLL_MODE=pilot` e os números de teste, como no checklist do atendente; depois `on`.

### Figurinhas no backend próprio (pendência do backend NossaGente)

O `/send` do `chatbot-backend-nestjs` só aceita texto. Sem `CHATBOT_BACKEND_STICKER_PATH`, a figurinha é pulada e registrada em `metadados.figurinhaResultado`; o texto sai normal. Contrato esperado da rota nova:

```
POST {CHATBOT_BACKEND_URL}/api/v1/whats-app/send-media
X-API-KEY: …
{ "instanceName": "dino", "chat_id": "5565…@c.us",
  "sticker": { "mimetype": "image/webp", "base64": "<webp>" } }
→ 200 { "success": true, "messageId": "…" }
```

Na Evolution a figurinha sai por `/message/sendSticker/{instance}` só com `WHATSAPP_AI_STICKERS_EVOLUTION=on` (e o canal com a chave da própria empresa).

## Testes

```bash
# unidade: persona, estilo, integração (prompt, auditoria, lembrete, toque, figurinhas)
node --test app/core/whatsapp-ai-persona.test.js app/core/whatsapp-ai-style.test.js app/core/whatsapp-trex.test.js

# simulador de ponta a ponta (PostgreSQL descartável com o schema aplicado)
WHATSAPP_SIM_PG_URL=postgres://…/dino_sim node --test app/core/whatsapp-ai-cenarios.pg.test.js            # 43 cenários, voz padrão
WHATSAPP_AI_PERSONA=trex WHATSAPP_AI_BUBBLE_DELAY_MS=0 \
WHATSAPP_SIM_PG_URL=postgres://…/dino_sim node --test app/core/whatsapp-ai-cenarios.pg.test.js            # 43 + 5 cenários do T-Rex
```

No modo T-Rex o simulador roda os mesmos 43 cenários (as travas têm de dar o mesmo resultado), verifica em cada bolha que não há markdown nem frase de robô, e acrescenta:

- **43** "vc é robô?" recebe a verdade e o agendamento segue de onde parou, sem handoff;
- **44** "quero falar com uma pessoa" continua indo para a equipe;
- **45** primeira resposta curta, sem "assistente virtual", até 4 bolhas;
- **46** figurinha "agendado" depois do horário confirmado, no máximo 1 por dia;
- **47** reclamação vai para a equipe e não leva figurinha;
- **48** "é robô? quero falar com uma pessoa", "é robô? + cartão" e "vc é IA? + injeção": as travas vêm antes da resposta de robô;
- **49** "isso é automatizado?" com resumo pendente devolve o resumo e o "sim" seguinte confirma; "quanto custa o corte na máquina?" não vira pergunta de robô.

A mudança passou por revisão adversarial independente (14 achados, todos corrigidos e reverificados; os casos viraram testes em `whatsapp-ai-style.test.js` e `whatsapp-ai-persona.test.js`).

Resultado nesta branch: suíte node 953 testes (900 ok, 0 falhas, demais pulados por exigirem PostgreSQL), simulador 43/43 na voz padrão e 50/50 com o T-Rex, ensaio geral com dados reais da Dino 9/9 nos dois modos.

## Do manual para o código

O manual do T-Rex descreve 24 ferramentas conceituais. A plataforma já tinha a maioria com outros nomes; esta é a correspondência:

| Manual | Ferramenta real |
| --- | --- |
| buscar_cliente / salvar_preferencia | `consultar_perfil_cliente`, `captar_cliente` (+ memória do cérebro com consentimento) |
| consultar_agenda | `sugerir_proximos_horarios`, `consultar_disponibilidade` |
| criar / remarcar / cancelar agendamento | `preparar_agendamento`, `preparar_remarcacao`, `preparar_cancelamento` + confirmação por SIM |
| listar_agendamentos_cliente | `consultar_meus_agendamentos` |
| confirmar_agendamento | `confirmar_presenca` |
| avisar_barbeiro (atraso) | `avisar_atraso` |
| entrar_fila_espera | `entrar_lista_espera` |
| listar_planos | `listar_planos`, `consultar_meu_plano`, `avaliar_clube` |
| buscar_produto | `buscar_produtos`, `sugerir_produto_pos_servico` |
| criar_pedido | `preparar_pedido` (retirada) + confirmação por SIM |
| status_pedido | `consultar_status_pedido` |
| consultar_fidelidade | `consultar_meu_cashback` |
| registrar_consentimento | `atualizar_consentimento_marketing` + SAIR determinístico |
| abrir_chamado / transferir_humano | `solicitar_humano` (fila da recepção) |
| enviar_figurinha | `enviar_figurinha` (nova, só com persona) |
| calcular_frete / gerar_link_pagamento | fora do WhatsApp por decisão de segurança: pagamento segue o checkout da loja (InfinitePay) |


## Integração com produção (05/10/2026)

A persona preserva links de pagamento, cartões de produtos e registro no CRM. Links não passam por reescrita de estilo nem são quebrados em bolhas. Resumos, códigos e URLs podem exceder o alvo de 120 caracteres: dados operacionais não são truncados. A persona usa um único fluxo de figurinhas por resposta; o fluxo anterior permanece para canais sem persona. O ambiente só ativa a persona quando a empresa é explicitamente conhecida e coincide com a dona configurada.
