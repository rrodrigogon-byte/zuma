# Plano — Grafo executivo da Barbearia Dino

## Objetivo e escopo

Ampliar **Cérebro do atendente → Grafo e ofertas**, que já existe no SetPoint/Kytto, para cruzar sinais de cliente e Commerce com indicadores operacionais, financeiros e de estoque. Manter a visualização de relações por cliente e as ofertas atuais, acrescentando uma visão geral com riscos e oportunidades explicáveis, período e origem dos dados.

A referência fornecida, https://nossacasa.kytto.com.br/plataforma/grafo, abre somente a tela de login; portanto, o plano reutiliza a estrutura e o estilo já existentes no Cérebro IA, sem presumir detalhes da tela autenticada que não puderam ser vistos.

## Estrutura do projeto

- **`app/`** é o backend Node/Express, os serviços do Kytto, consultas do Commerce, regras de domínio e testes Node. A extensão se concentra no carregador `ai-brain-data.js`, nos cálculos puros de `dino-grafo.js` e de um novo módulo de insights executivos; `ai-brain-routes.js` continuará sendo a API administrativa protegida.
- **`web/`** contém a aplicação administrativa React/Vite. A interface será ampliada em `src/pages/admin/dino/CerebroIA.jsx`, aproveitando os componentes e o estilo presentes em `dino-admin.css`/`customer360.css`; não será criado um frontend paralelo.
- **Raiz do repositório** mantém instruções de produção, scripts e documentação operacional (`AGENTS.md`, `package.json`, `TODO.md`). A entrega seguirá a branch de produção e não mudará `render.yaml`, configuração do Render ou integrações externas.

## Fonte e tratamento dos dados

- **Operação e agenda:** reutilizar o resolvedor canônico para a empresa/unidade ativa, em modo estrito por unidade. O legado só será associado quando os IDs da empresa e loja do token assinado coincidirem exatamente com o escopo Commerce autorizado. Sem esse vínculo, nunca ler JSON; somente consultar PostgreSQL com predicado exato de empresa+loja e marcar cobertura parcial. Se o ambiente exigir JSON sem vínculo comprovado, marcar indisponível. Com vínculo, decidir por evidência da unidade: agenda JSON, PostgreSQL, indisponível quando nenhuma fonte é comprovável ou conflito quando ambas têm reservas futuras; nunca somar as duas. Exibir agendamentos, conclusões, cancelamentos e faltas. Grafo e automações exigem unidade ativa; sem ela não consultar nem enfileirar dados tenant-wide. Ocupação fica fora desta entrega: o cálculo legado usa somente JSON, enquanto a agenda pode estar no PostgreSQL; não inferir capacidade sem fonte canônica. Histórico importado não será contado como operação atual.
- **Financeiro da Barbearia:** ler o ledger central Kytto e fechamentos de caixa somente com empresa/loja explícitas e vínculo assinado coincidente entre IDs Kytto e Commerce. Se o vínculo da unidade ativa não existir, apresentar a fonte como indisponível, sem remover o filtro e consultar a empresa inteira. Destacar, com valores e período, receitas pendentes vencidas, diferenças de fechamento não nulas e variações de receita/despesa quando houver histórico e cobertura suficientes. Não usar endpoints legados sem escopo validado nem tratar comissão estimada como repasse pago.
- **Estoque:** combinar catálogo, saldo disponível e estoque mínimo por local ativo no Commerce com a revenda local já lida pelo grafo. Alertas de baixo estoque serão associados à venda observada somente quando houver fonte e vínculo assinado de loja comprovado. Itens locais sem unidade ficam fora do agregado por loja e tornam a cobertura parcial, em vez de serem presumidos como pertencentes à unidade ativa.
- **Commerce e oportunidades:** reaproveitar pedidos, catálogo, preço/custo vigente e saldos disponíveis já carregados pelo grafo; contar como pedidos confirmados somente os estados já aceitos pelo grafo e manter os demais estados separados. A contagem de reembolsos será pelo estado do pedido; não inferir valor nem liquidação do estorno. Estoque local de revenda só será associado quando a loja legada corresponder exatamente à unidade ativa autorizada. Separar data do pedido de data da captura financeira. Recomendações comerciais continuarão heurísticas, não probabilidades calibradas nem garantia de margem.
- **Identidade e qualidade:** preservar tokens opacos, mascaramento de telefone, consentimentos, bloqueio por anonimização e estados `ok`/`limitado`/`indisponível`. Não juntar cadastros só por nome ou por um telefone ambíguo. Os endpoints administrativos de memória também exigirão unidade ativa: resumos serão filtrados por `ai_conversation_summaries.loja_id`, fatos somente quando vinculados a um resumo da mesma unidade, referências de cliente precisam pertencer ao grafo/pedidos dessa unidade, e alteração/exclusão afetará apenas conteúdo atribuível à loja. Memória de origem não identificada não será exposta nem alterada por uma chamada unitária. Cada sinal terá explicação, janela, fonte e indicação de cobertura; falta de fonte não será apresentada como ausência de risco.

## IA, segurança e efeitos

As regras e os números do painel serão calculados no servidor com dados existentes. Um botão explícito **Analisar com IA** poderá enviar somente indicadores agregados, sem nomes, telefones, IDs de clientes ou texto de conversas, ao fluxo `previsao_gerencial` já existente. A análise será sob demanda, respeitará o teto diário de IA da empresa e será complementar: se a IA não estiver configurada, falhar ou atingir o limite, os sinais determinísticos continuarão disponíveis. Esta mudança não redefine a memória empresa/telefone já usada pelo assistente WhatsApp durante o atendimento; esse runtime permanece fora do escopo do painel.

O grafo executivo e sua análise são somente leitura: não alteram lançamentos, pedidos/estoque ou identidades, não disparam mensagens nem executam automações. As rotas existentes de memória do Customer 360 preservam suas ações autorizadas, agora limitadas à unidade ativa e aos resumos/fatos com fonte comprovável nessa unidade. Uma chamada de IA registra somente metadados de uso/custo no log já existente, sem persistir prompt, resposta ou dados pessoais. Não requer migração de banco nem nova dependência.

## Implementação na base existente

- `app/ai-brain-data.js`: carregar e identificar fontes financeiras, caixa e estoque com escopo de empresa/loja e limites explícitos.
- `app/dino-grafo.js`, novo módulo de insights e, se útil, `app/dino-bi.js`: produzir resumos, relações e sinais rastreáveis; preservar as ofertas e o grafo individual atuais.
- `app/ai-brain-routes.js`: expor os novos dados pela rota administrativa já protegida e adicionar a análise de IA somente sob solicitação, com orçamento e sanitização; exigir loja ativa nas rotas de grafo/automações e filtrar canais pela mesma empresa+loja.
- `app/core/ai-memory.js`: restringir leitura, busca, alteração de fatos e esquecimento administrativo aos resumos e fatos com fonte na loja ativa. O runtime WhatsApp `memoryForPrompt` continua empresa/telefone e não é alterado nesta entrega.
- `app/ai-brain-scheduler.js`: manter automações programadas no escopo da loja ativa do canal; carregar o legado somente com empresa/unidade coincidentes e pular/logar escopo inválido.
- `web/src/pages/admin/dino/CerebroIA.jsx` e `dino-admin.css`: acrescentar mapa/resumo executivo, filtros de período/área, alertas por fonte e uma entrada clara para abrir as ligações de um cliente; remontar/limpar a tela ao trocar empresa ou unidade para nunca manter indicadores do escopo anterior; manter o padrão visual atual.
- Testes existentes em `app/` e `web/` cobrirão o contrato dos dados, isolamento e comportamento de leitura segura.

## Git e entrega

Seguir `AGENTS.md`: partir de `origin/fix/kytto-comandas-pdv-20260808`, trabalhar em branch própria e, após validações, abrir PR com essa mesma branch como base. Não fazer merge, deploy nem alterar configurações do Render/WhatsApp. O serviço publica automaticamente depois de um merge na branch de produção, então qualquer promoção ficará para autorização explícita posterior.

A validação indicada pelo repositório inclui `npm run test:node` e build do frontend em `web/`. Nenhum acesso a banco ou serviço de produção será usado durante a implementação e os testes locais.
