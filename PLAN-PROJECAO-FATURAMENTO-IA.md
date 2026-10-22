# Plano de implementação — Projeção de faturamento inteligente para Dino

## Contexto e objetivo

As empresas Dino de barbearia e salão precisam deixar de acompanhar apenas o passado. O painel deve projetar o fechamento do mês atual e dos seis meses seguintes a partir do histórico operacional real, das agendas futuras, dos serviços, das vendas de revenda, da capacidade dos profissionais e das metas configuradas. O resultado deve explicar os fatores observados, sinalizar riscos e apontar ações práticas para a equipe, sem apresentar estimativas como fatos garantidos.

A produção é o serviço Render `setpoint`, cuja base é `fix/kytto-comandas-pdv-20260808`. A implementação será feita em ramificação própria e entregue por PR para essa base; nenhuma alteração direta será feita na configuração de deploy, na branch de produção ou nas credenciais de canais.

## Decisões de produto

### Previsão explicável, com dados reais

A primeira versão usa um motor preditivo determinístico e auditável, que é mais adequado para dados financeiros operacionais do que uma resposta generativa não verificável. Ele combina:

1. receita de serviços concluídos e recebidos no período;
2. venda de produtos de revenda efetivamente paga/finalizada;
3. valor já reservado na agenda futura do mês, sem contar atendimentos cobertos por assinatura como receita avulsa;
4. média recente ponderada, tendência mensal e comportamento por dia útil para a parcela ainda não realizada;
5. capacidade disponível por profissional e por unidade;
6. metas mensais por profissional e o total da equipe.

A camada de “IA” será a interpretação estruturada desses indicadores: causas observáveis, nível de confiança, risco/oportunidade e ações priorizadas. A versão inicial não exigirá uma nova chave ou serviço externo. Se o provedor de IA já existente na instalação estiver configurado, ele poderá futuramente transformar o resumo estruturado em linguagem mais natural, mas nunca será a fonte dos números nem bloqueará o painel.

### Sem dupla contagem

A previsão distinguirá serviços, revenda e total. Serviços serão obtidos dos atendimentos concluídos, excluindo cancelados, faltas e utilizações de plano como receita avulsa. Produtos serão obtidos apenas de vendas de revenda com situação paga/finalizada. Dados importados de histórico continuarão fora do cálculo financeiro quando não representarem um lançamento recebido.

### Escopo, segurança e transparência

Toda consulta será delimitada no servidor por `empresaId` e, quando selecionada, por `lojaId`, usando o escopo já resolvido pela autenticação. O navegador não enviará empresa, usuário ou papel no corpo da requisição. O resultado deixará explícitos data de corte, intervalo histórico, meses com dados, método aplicado e confiança. Sem base suficiente, a interface mostrará “histórico insuficiente”, não uma projeção artificial.

## Comportamentos entregues

### Visão mensal e horizonte de seis meses

- Mostrar realizado, previsão de fechamento, meta, diferença para a meta, percentagem atingida e ritmo necessário no mês atual.
- Separar receita de serviços, revenda e total.
- Projetar o mês atual com agenda já reservada mais o ritmo observado; os meses futuros usarão a série histórica e tendência, sem fingir que há receita realizada.
- Exibir uma série dos seis meses seguintes com cenário conservador, base e favorável, além de nível de confiança.
- Preservar a projeção mensal por profissional e comparar realizado, previsão, meta, ocupação, ticket, atendimentos e capacidade.

### Diagnóstico e recomendações

- Detectar tendências de queda/crescimento, buracos de agenda, ocupação baixa ou acima da capacidade, variação de ticket, cancelamentos/faltas e distância para meta.
- Explicar cada alerta com evidência numérica e não com causalidade inventada.
- Sugerir ações que levem para rotinas já existentes: chamar retornos previstos, trabalhar lista de espera, ocupar horários, acompanhar profissional, revisar mix de serviços ou ajustar metas.
- Priorizar alertas por impacto e distinguir risco, oportunidade e falta de dados.

### Experiência no painel

A entrega será integrada à Barbearia & Salão, na área de Gestão, com a nova aba **Projeção inteligente**. A identidade visual continuará a do painel Dino: cards escuros, tipografia e tokens existentes, grids fluidos e tabelas roláveis. A tela terá:

- cabeçalho com competência, horizonte, atualização e qualidade dos dados;
- resumo do mês atual e cenários;
- gráfico SVG responsivo para os seis meses;
- painel de fatores e ações; e
- ranking comparativo dos profissionais com metas editáveis no fluxo atual.

O painel deve funcionar em desktop e mobile, ter carregamento, erro, vazio e ausência de meta explícitos, além de não usar dados simulados como fallback.

## Arquitetura e arquivos

| Área | Arquivo(s) | Responsabilidade |
| --- | --- | --- |
| Motor de previsão | `app/dino-captacao-kytto.js` | Normalizar fatos operacionais, calcular série histórica, projeções, cenários, qualidade, drivers, recomendações e ranking profissional. |
| API protegida | `app/server.js` | Expor leitura em `/api/admin/barbearia/captacao/projecao-faturamento`, dentro das proteções de empresa/unidade e de leitura gerencial existentes. |
| Testes de domínio/API | `app/dino-captacao-kytto.test.js`, `app/server-captacao-runtime.test.js` | Validar fontes, isolamento, mês atual/futuro, horizonte, ausência de histórico e contrato HTTP. |
| Painel React | `web/src/pages/admin/dino/CaptacaoPanels.jsx` | Inserir a visualização de projeção, gráfico, alertas, ações e ranking sem duplicar a fonte de dados. |
| Navegação | `web/src/pages/admin/BarbeariaERP.jsx` | Criar a aba de Gestão e montar o painel novo. |
| Manual operacional | `docs/MANUAL-PROJECAO-FATURAMENTO-IA-DINO.md` | Documentar objetivo, conceitos, fontes, uso, leitura dos alertas, limites e perguntas frequentes. |

## Modelo de previsão

1. **Fatos observados:** agregação diária e mensal de serviços concluídos e revenda recebida, com filtros de empresa/unidade e status válidos.
2. **Mês atual:** `realizado + agenda futura qualificada + ritmo projetado para a capacidade/tempo ainda disponível`, sem somar o mesmo horário duas vezes.
3. **Meses futuros:** média ponderada dos meses concluídos recentes, ajustada pela tendência e limitada pela capacidade conhecida; cenários conservador/base/favorável derivam da volatilidade histórica.
4. **Qualidade:** quantidade de meses, dias observados, dispersão e presença de fontes determinam o nível de confiança e as mensagens de insuficiência.
5. **Explicabilidade:** cada driver traz métrica, comparação e impacto aproximado. Recomendações só são apresentadas quando sua evidência existe.

## Critérios de integridade

- Fatos de uma empresa ou unidade jamais aparecem para outra.
- Cancelamentos, não comparecimentos, agendamentos sem recebimento e histórico importado não entram indevidamente no faturamento realizado.
- Atendimento coberto por plano não conta como venda avulsa.
- Os resultados sempre indicam a data de corte e a confiança; projeção não é promessa de faturamento.
- Sem dados suficientes, o sistema não gera número fictício.
- A previsão não cria agendamentos, vendas, mensagens, metas ou ações automáticas.
