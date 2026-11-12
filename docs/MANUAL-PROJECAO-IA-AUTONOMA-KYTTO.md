<p align="center"><img src="../web/public/brand/kytto-horizontal.svg" width="240" alt="Kytto"></p>

# Manual complementar — Projeção de faturamento com IA autônoma Kytto

**Módulo:** Operação Dino / Projeção de faturamento
**Público:** proprietário, gestor de unidade, gerente e equipe de implantação
**Versão do contrato:** 1.0.0
**Data:** 22/10/2026

> Este manual complementa o manual visual da Projeção de Faturamento Kytto. A camada de IA não substitui o cálculo financeiro do ERP: ela interpreta fatos já registrados, explica riscos e organiza ações para a gestão.

## 1. O que foi entregue

A tela de Projeção de faturamento passa a reunir quatro camadas em um só lugar:

1. **Projeção numérica auditável:** serviços recebidos, revenda paga, agenda futura, histórico, cenários conservador/base/favorável e metas.
2. **Análise gerencial por IA:** resumo executivo, tendência, causas observáveis, limitações e recomendações em português do Brasil.
3. **Alertas operacionais:** risco de meta, queda recente, agenda insuficiente, perdas/cancelamentos, revenda e profissionais abaixo do ritmo.
4. **Simulador:** variação hipotética de atendimentos, ticket médio, revenda e ocupação, sem salvar ou alterar qualquer dado operacional.

A IA usa o roteador existente do Kytto, com cadeia configurável de provedores. A rota padrão é KyttoIA (KyttoIA 2.5 Flash), seguida pelos fallbacks configurados para OpenAI e Claude. A aplicação registra provedor, modelo, latência, status e custo estimado no histórico do roteador quando o banco de observabilidade estiver disponível.

## 2. Como acessar

1. Entre em `https://kytto.com.br/admin` com um perfil de gestão.
2. Selecione a empresa e a unidade operacional correta.
3. Abra o módulo **Barbearia ERP** e a aba **Projeção de faturamento**.
4. Escolha a competência no campo **Competência**. O padrão é o mês atual.
5. Aguarde o cálculo da projeção e a análise gerencial.
6. Use **Atualizar análise** somente quando houver novos lançamentos relevantes ou quando quiser forçar uma nova interpretação. A leitura é armazenada por até seis horas para evitar chamadas repetidas ao provedor.

O servidor sempre deriva empresa e unidade da sessão e dos cabeçalhos autorizados. Não é possível trocar a unidade informando outro identificador no corpo da requisição.

## 3. Como interpretar o resumo executivo

O card **Analista gerencial com IA** mostra o estado da leitura:

- **IA atualizada:** a resposta estruturada foi produzida por um provedor configurado e validada pelo servidor.
- **Leitura local segura:** o provedor não respondeu, não está configurado ou o limite diário foi atingido. O painel continua funcionando com uma explicação determinística baseada nos mesmos indicadores.
- **Em análise:** há uma geração ou atualização em andamento.

A frase de resumo deve ser lida junto com os KPIs de realizado, projeção, meta e qualidade da previsão. A IA não deve ser interpretada como garantia de faturamento. Ela identifica ritmo, risco e oportunidade com os dados disponíveis até a data de corte.

## 4. Indicadores que alimentam a análise

O motor numérico usa somente fontes que o sistema consegue vincular à empresa e à unidade:

- serviços concluídos com recebimento financeiro verificado;
- vendas de revenda com status pago e valor recebido;
- atendimentos futuros confirmados na agenda;
- série histórica recente, sem tratar o mês corrente parcial como mês fechado;
- metas de receita e atendimentos por profissional;
- capacidade, minutos agendados, ocupação e ticket médio;
- cancelamentos, faltas e registros inválidos da agenda;
- classificação de qualidade do histórico: alta, média, baixa ou insuficiente.

Atendimentos cobertos por plano não são contados como receita avulsa novamente. Sinais, recebimentos parciais e valores não confirmados não devem ser interpretados como faturamento realizado.

## 5. Alertas

Os alertas são gerados a partir dos fatores determinísticos e persistidos por empresa, unidade, competência e chave do alerta. Isso evita duplicidade quando a tela é atualizada ou quando o worker repete uma tarefa.

| Tipo | Exemplo | Conduta recomendada |
|---|---|---|
| Meta | Projeção abaixo da meta da equipe | Abrir o comparativo por profissional e avaliar a diferença necessária. |
| Risco | Queda recente de faturamento | Conferir atendimentos, ticket, recebimentos e revenda dos últimos meses. |
| Agenda | Pouca receita futura já reservada | Usar retornos previstos, lista de espera e confirmação de horários. |
| Revenda | Ritmo de revenda abaixo do histórico | Conferir estoque disponível, exposição, mix e abordagem comercial. |
| Capacidade | Capacidade ociosa ou saturada | Avaliar horários, jornada e distribuição de atendimentos. |
| Profissional | Profissional abaixo da meta individual | Comparar produção, agenda futura, ticket e ocupação antes de cobrar ação. |

O botão **Reconhecer** registra que o gestor viu o alerta. Reconhecer não resolve o problema nem muda os números. O alerta volta a ser ativo se uma nova análise identificar novamente o mesmo risco após resolução.

## 6. Causas e recomendações

As causas exibidas pela IA são explicações textuais ancoradas no campo de evidência do motor determinístico. A equipe deve conferir a evidência antes de tomar decisão. Recomendações são orientações humanas, como revisar metas, confirmar agenda, usar lista de espera ou verificar revenda.

A IA não pode:

- criar, cancelar ou remarcar um atendimento;
- cobrar um cliente ou enviar mensagem;
- alterar preço, meta, comissão, caixa ou lançamento financeiro;
- baixar, reservar ou estornar estoque;
- reconhecer um alerta em nome do gestor;
- escolher uma pessoa com base em informação sensível.

## 7. Simulador de cenários

O simulador responde à pergunta “o que aconteceria se o ritmo mudasse?”, sem salvar nada. Cada controle representa um multiplicador do ritmo atual:

- **Atendimentos:** volume concluído ou esperado;
- **Ticket médio:** valor médio por atendimento;
- **Revenda:** ritmo de vendas de produtos;
- **Ocupação:** aproveitamento da capacidade disponível.

O resultado mostra serviços, revenda, total e variação contra a base. O resultado é matemático e não deve ser tratado como previsão oficial até que os dados reais sejam registrados. Para transformar uma hipótese em plano, o gestor deve abrir a aba recomendada e executar as ações manualmente.

## 8. Visão por profissional

O comparativo permite acompanhar, por profissional:

- realizado e quantidade de atendimentos concluídos;
- agenda futura e atendimentos agendados;
- projeção individual e meta de receita;
- ticket médio;
- minutos agendados, capacidade e ocupação;
- tendência e meses de histórico;
- indicação **No ritmo** ou **Acelerar**.

A indicação **Acelerar** é um sinal de gestão, não avaliação disciplinar automática. Antes de cobrar resultado, verifique folgas, jornada, indisponibilidade, mix de serviços, agenda atribuída e qualidade dos registros.

## 9. Execução autônoma

A execução autônoma usa duas peças:

1. **Outbox durável:** a tarefa `forecast.ai.analyze` é gravada no PostgreSQL com chave idempotente, fingerprint e snapshot sanitizado.
2. **Worker operacional:** reivindica tarefas com lease, processa uma vez, conclui ou registra retry/dead-letter. Falha de provedor não cria sucesso falso.

O scheduler consulta unidades ativas e apenas enfileira snapshots novos. Ele não chama a IA diretamente e não bloqueia o boot do serviço. Em caso de indisponibilidade do provedor, o histórico fica com status `fallback` e o painel mantém a leitura local.

### Variáveis de ativação

```text
COMMERCE_CORE_ENABLED=1
DINO_OPERATIONAL_WORKER_ENABLED=1
DINO_FORECAST_AI_ENABLED=1
AI_MODEL_GEMINI_SMART=gemini-2.5-pro          # opcional; há default no roteador
DINO_FORECAST_AI_INTERVAL_MS=21600000         # opcional; mínimo de 15 minutos
DINO_FORECAST_AI_CAP_CENTS=...                # opcional; teto diário do roteador
```

A chave do provedor deve ser cadastrada exclusivamente no Secret Manager/ambiente protegido. Nunca coloque chave no banco, no snapshot, no front-end ou em mensagem de suporte.

## 10. Contrato técnico para integração

### Consultar projeção com IA

```http
GET /api/admin/barbearia/captacao/projecao-faturamento/inteligencia?mes=2026-10&horizonte=6
```

A resposta contém `projection` com os números determinísticos, `inteligencia` com status, fonte, fingerprint, resumo, causas, recomendações, alertas e metadados do provedor, além de `motor` com o estado da configuração.

### Forçar atualização assíncrona

```http
POST /api/admin/barbearia/captacao/projecao-faturamento/inteligencia/atualizar
Content-Type: application/json

{"mes":"2026-10","horizonte":6}
```

O retorno `202` indica nova tarefa enfileirada; `200` indica replay idempotente da mesma tarefa. A execução depende das flags do worker e da migration aplicada.

### Simular

```http
POST /api/admin/barbearia/captacao/projecao-faturamento/simular
Content-Type: application/json

{
  "mes":"2026-10",
  "horizonte":1,
  "fatores":{"atendimentos":1.10,"ticket":1.00,"revenda":1.20,"ocupacao":1.05}
}
```

### Alertas

```http
GET /api/admin/barbearia/captacao/projecao-faturamento/alertas?mes=2026-10
POST /api/admin/barbearia/captacao/projecao-faturamento/alertas/{id}/reconhecer
```

Todas as rotas exigem sessão autenticada e papel de gestão da unidade.

## 11. Migration e dados

A migration `084_dino_forecast_ai.sql` cria:

- `dino_forecast_ai_insights`: snapshot, análise, status, confiança, provedor, modelo, erro, fingerprint e validade;
- `dino_forecast_ai_alerts`: alertas ativos/reconhecidos/resolvidos, métricas e auditoria de reconhecimento;
- índices de consulta por empresa, unidade, competência e status;
- constraints de JSON, severidade, status e vínculo composto empresa-unidade;
- unicidade que impede duas análises ou dois alertas iguais no mesmo escopo.

Aplicar via runner oficial, nunca executando apenas parte do SQL:

```bash
cd app
node migrations/run-commerce-schema-migrations.js --dry-run
node migrations/run-commerce-schema-migrations.js
```

Em produção, o pre-deploy deve aplicar a migration com `COMMERCE_SCHEMA_REQUIRED=1` e a mesma conexão PostgreSQL do serviço.

## 12. Homologação

Use uma empresa e uma unidade de teste com dados anonimizados e execute:

1. projeção sem histórico;
2. projeção com um mês de dados;
3. projeção com seis meses e meta abaixo do ritmo;
4. queda de atendimentos e revenda;
5. profissional sem meta e profissional abaixo da meta;
6. agenda futura suficiente e insuficiente;
7. resposta válida do provedor;
8. provedor sem chave;
9. resposta JSON inválida ou timeout;
10. duas requisições simultâneas com o mesmo snapshot;
11. tentativa de consultar outra unidade;
12. reconhecimento duplicado do mesmo alerta;
13. retry, lease expirado e dead-letter do worker.

O aceite exige que os números da projeção permaneçam iguais com IA ligada ou desligada, que o fallback seja legível, que nenhuma chamada exponha dados pessoais e que nenhuma ação operacional seja executada sem confirmação humana.

## 13. Smoke pós-deploy

Depois da migration e do deploy:

```bash
curl -fsS https://kytto.com.br/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://kytto.com.br/login
```

Com sessão de gestão, validar a rota de inteligência, a atualização assíncrona, o simulador e os alertas. Consultar logs para confirmar `forecast.ai.analyze`, ausência de dead-letter inesperada e latência aceitável. Se o provedor estiver indisponível, o comportamento correto é `fallback`, não erro 500 nem projeção zerada.

## 14. Perguntas frequentes

**A IA pode afirmar que o fechamento será exatamente R$ 90 mil?**
Não. Ela pode dizer que a projeção determinística está em R$ 90 mil e explicar os fatos que levaram a esse valor. A previsão é uma estimativa.

**O que acontece se a KyttoIA cair?**
O roteador tenta os provedores configurados. Se nenhum responder, o sistema usa a leitura determinística local, registra a falha e mantém a tela funcional.

**A IA aprende sozinha com cada nova venda?**
O snapshot é recalculado com os novos dados e uma nova fingerprint gera nova análise. O modelo não altera os dados nem treina com informações pessoais da empresa.

**É preciso abrir o painel todos os dias?**
Não, quando as flags de worker e scheduler estão ativas. O scheduler enfileira snapshots novos por unidade e o worker processa em segundo plano.

**Como a gestão deve usar a recomendação?**
Como uma lista priorizada para conferência. O gestor verifica o indicador, decide a ação e executa no módulo correspondente.
