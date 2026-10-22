# Manual completo — Projeção inteligente de faturamento Dino

## 1. Finalidade

A **Projeção inteligente de faturamento** transforma os dados que já são registrados na operação Dino em uma visão antecipada do resultado. Em vez de consultar separadamente agenda, vendas, metas e profissionais, o gestor recebe uma estimativa explicável do fechamento do mês e dos cinco meses seguintes, com cenários, evidências, alertas e ações sugeridas.

O recurso foi feito para apoiar a gestão diária. Ele responde perguntas como: “no ritmo atual, onde a equipe deve fechar o mês?”, “quanto da projeção já está garantido por horários na agenda?”, “qual profissional está abaixo da própria meta?”, “a queda está ligada ao histórico, à agenda ou a cancelamentos?” e “qual é a próxima ação que vale a pena priorizar?”.

A previsão não altera dados, não cria agenda, não envia WhatsApp, não cria cobranças e não cobra automaticamente nenhum profissional. Ela é uma leitura gerencial e deve ser usada junto do conhecimento do gestor sobre férias, feriados, campanhas, mudanças de preço e outros acontecimentos que ainda não estejam registrados no sistema.

## 2. Acesso e permissões

No painel administrativo, abra **Barbearia & Salão → Gestão → Projeção inteligente**. A página usa a empresa e a unidade já selecionadas na sessão. Não existe escolha de empresa no formulário da projeção; esse desenho impede que alguém consulte dados de um tenant diferente por meio do navegador.

Como a tela apresenta faturamento, metas e resultado individual, ela é uma leitura reservada à gestão da empresa. Perfis operacionais sem permissão de leitura gerencial recebem bloqueio do servidor. O mesmo controle se aplica à rota usada pela tela.

Ao trocar a unidade no contexto do ERP, a projeção é recalculada para aquela unidade. Atendimentos e vendas vinculados a outra unidade não entram no total filtrado. Quando não houver unidade selecionada, o resultado representa a empresa ativa como um todo.

## 3. Fontes de dados

A projeção não utiliza valores fictícios. Cada parte é formada pelas seguintes fontes.

| Componente | O que entra | O que não entra |
| --- | --- | --- |
| Serviços realizados | Atendimentos concluídos até a data de corte, usando o valor recebido ou o valor do serviço registrado. | Cancelamentos, faltas e atendimentos cobertos por sessão de plano como venda avulsa. |
| Revenda realizada | Vendas de produtos de revenda com status **pago**, usando o pagamento confirmado. | Vendas aguardando pagamento, canceladas ou sem confirmação financeira. |
| Agenda futura | Atendimentos com status agendado, confirmado ou em atendimento, posteriores à data de corte e dentro da competência. | Cancelados, faltas, uso de plano como venda avulsa e o mesmo horário contado duas vezes. |
| Metas | Metas mensais de receita e atendimentos definidas por profissional. A meta de equipe é a soma das metas individuais. | Metas inexistentes ou valores não configurados. |
| Histórico | Até seis meses anteriores à competência analisada, com serviços concluídos e revenda paga. | Dados futuros, lançamentos de outra empresa/unidade e registros sem receita válida. |

A fonte é sempre o dado operacional interno. O cálculo não depende de uma ferramenta externa e não requer que uma chave de IA esteja disponível para mostrar números financeiros.

## 4. Conceitos exibidos

### Realizado

É o valor efetivamente registrado até a data de corte do painel. O card separa serviços concluídos de revenda paga. O realizado não inclui valor apenas previsto, agendado ou pendente de pagamento.

### Agenda futura

É a soma dos atendimentos ainda futuros dentro do mês, desde que estejam em situação operacional válida. Ela é exibida porque já há uma intenção de receita, mas não é tratada como recebimento garantido. Quando o mês é atual, o valor da agenda é usado uma única vez na previsão.

### Projeção de fechamento

É o cenário base. No mês em curso, ele combina o realizado, a agenda futura e o ritmo obtido no histórico para a parcela ainda não coberta pela agenda. Nos meses futuros, ele usa a série histórica e a tendência recente, respeitando a agenda já conhecida quando ela for maior que a estimativa histórica de serviços.

### Cenários conservador, base e favorável

O cenário base é a leitura central. Os cenários conservador e favorável formam uma faixa derivada da oscilação observada nos meses anteriores. Quanto mais irregular for o histórico, maior tende a ser a faixa. Eles não são metas alternativas nem promessas; servem para discutir risco e oportunidade.

### Meta da equipe

A meta da equipe é a soma das metas de receita registradas para os profissionais no mês selecionado. Se não houver meta, a tela mostra **Não definida** e evita classificar a equipe como acima ou abaixo do ritmo.

### Qualidade da previsão

A qualidade não avalia a equipe; ela avalia a base de dados usada pelo cálculo.

| Nível | Significado | Recomenda-se |
| --- | --- | --- |
| Alta | Há pelo menos cinco meses com faturamento registrado para comparação. | Usar cenários e tendência como apoio regular de planejamento. |
| Média | Há pelo menos três meses de referência, mas a série ainda pode variar. | Acompanhar semanalmente e confirmar se fatores operacionais explicam as oscilações. |
| Baixa | Há somente um ou dois meses com dados de receita. | Registrar atendimentos e pagamentos com consistência antes de tomar decisões de médio prazo. |
| Histórico insuficiente | Não há mês concluído com receita registrada. | Usar a agenda e as metas como ponto inicial; não tratar a estimativa como tendência. |

## 5. Como a estimativa é formada

### 5.1 Mês atual

Para a competência atual, a fórmula conceitual é:

```text
projeção de serviços = serviços realizados
                      + maior valor entre (agenda futura, ritmo histórico do período restante)

projeção de revenda = revenda paga realizada
                    + ritmo histórico de revenda para o período restante

projeção total = projeção de serviços + projeção de revenda
```

A regra do “maior valor” evita somar a agenda ao ritmo como se ambos fossem receitas distintas. Se o ritmo histórico já pressupõe volume semelhante ao que está reservado, a agenda funciona como piso conhecido; se a agenda é maior, ela passa a ser a melhor evidência para o restante do mês.

### 5.2 Meses futuros

Para os próximos cinco meses, o sistema usa a média ponderada dos meses com receita registrada e a tendência observada entre eles. Meses mais recentes têm peso maior. A tendência é moderada para reduzir reações exageradas a um único mês atípico. O mês em andamento não é tratado como mês fechado quando se calcula uma competência futura, evitando que um resultado parcial reduza ou infle artificialmente a série histórica.

Em serviços, uma agenda futura já existente é respeitada como piso. Em revenda, só entram como realizado vendas que já estejam pagas; não há previsão de “produto reservado” sem venda confirmada.

### 5.3 Limites do cálculo

O algoritmo não conhece, por conta própria, acontecimentos ainda não registrados: fechamento temporário, férias, novos profissionais, mudança de preço, reforma, campanha de mídia, sazonalidade anual, alteração de horário ou uma grande venda corporativa. Quando um desses fatores existir, o gestor deve interpretar os cenários com cautela e manter metas e cadastros atualizados.

## 6. Leitura do gráfico e da tabela de seis meses

O gráfico mostra a faixa de cenários e a linha do cenário base. A tabela abaixo dele detalha, para cada competência:

- previsão de serviços;
- previsão de revenda;
- cenário conservador;
- cenário base;
- cenário favorável; e
- meta, quando estiver configurada para aquele mês.

O mês marcado como **Em curso** ainda está aberto. Nele, “Realizado” não deve ser comparado diretamente com o total do mês sem considerar a data de corte. A leitura adequada é comparar a projeção base e a agenda futura com a meta, observando também a qualidade da previsão.

## 7. Fatores que influenciam a projeção

A seção **O que está influenciando a projeção** lista apenas fatores com uma evidência numérica. Exemplos:

| Fator | Evidência mostrada | Interpretação recomendada |
| --- | --- | --- |
| Risco de meta | Diferença entre projeção e meta. | A equipe precisa aumentar produção, ticket, agenda ou rever a meta; abra a comparação individual antes de cobrar. |
| Crescimento ou queda | Variação percentual entre os dois últimos meses com receita. | Investigue se é efeito de agenda, ticket, mix de serviços, revenda, faltas ou algum evento de calendário. |
| Receita já reservada | Número de atendimentos futuros e respectivo valor. | É uma boa base para o restante do mês, mas ainda requer comparecimento e conclusão. |
| Agenda ainda pouco coberta | A projeção depende mais do ritmo histórico do que de horários futuros. | Priorize retorno previsto, lista de espera e confirmação de agenda. |
| Faltas ou cancelamentos | Quantidade de registros inválidos no mês. | Revise confirmação, política de cancelamento e reposição de vagas. |
| Profissionais fora do ritmo | Quantidade de pessoas abaixo da meta individual. | Analise capacidade, ticket, agenda e meta de cada pessoa; evite usar o indicador isoladamente. |

O painel não afirma que um fator é a causa definitiva de uma queda. Ele informa a evidência observada para que a gestão faça a investigação correta.

## 8. Ações recomendadas e atalhos

As ações são sugestões operacionais. O botão de cada ação apenas navega para a área correspondente do ERP; ele não executa qualquer ação sem a confirmação do gestor.

| Ação sugerida | Onde o botão leva | Uso indicado |
| --- | --- | --- |
| Revisar produção adicional por profissional | Ocupação e metas | Avaliar meta, ticket, horas e atendimentos necessários para cada profissional. |
| Ocupar horários disponíveis | Retorno previsto | Acionar clientes que já têm histórico e estão na janela de retorno. |
| Confirmar agenda e acionar lista de espera | Lista de espera | Reduzir ociosidade em caso de cancelamentos ou faltas. |
| Acompanhar metas individuais | Ocupação e metas | Comparar o ritmo de cada profissional antes de definir cobrança ou apoio. |
| Concluir e registrar recebimentos | Atendimento | Melhorar a qualidade dos dados ao finalizar corretamente atendimento e venda. |

## 9. Comparativo por profissional

A tabela por profissional ajuda a transformar a meta de equipe em acompanhamento objetivo. Ela mostra:

- **Realizado:** receita de serviços concluídos pelo profissional na competência.
- **Agenda futura:** valor dos horários futuros atribuídos a ele.
- **Projeção:** estimativa individual, combinando realizado, agenda e próprio histórico.
- **Meta:** meta mensal registrada para o profissional.
- **Ticket:** receita média dos atendimentos concluídos; na ausência deles, usa a agenda futura disponível como referência operacional.
- **Ocupação:** minutos de registros válidos no mês em relação à jornada disponível configurada.
- **Tendência:** crescimento, queda ou estabilidade do histórico individual disponível.

A comparação não deve ser usada como único critério de remuneração ou medida disciplinar. Ela indica onde o gestor deve conversar, oferecer apoio, revisar horários, trabalhar retorno ou ajustar meta à capacidade real.

Para criar ou editar as metas, use o botão **Editar metas** ou navegue até **Gestão → Ocupação e metas**. A meta precisa ser configurada por competência e por profissional para que os indicadores “No ritmo” ou “Acelerar” façam sentido.

## 10. Rotina de gestão sugerida

### Todos os dias

Abra a projeção do mês atual, confira a data de corte e veja o valor que já está na agenda futura. Se houver alerta de agenda pouco coberta, priorize retornos previstos e lista de espera. Confirme que os atendimentos concluídos e as vendas de revenda foram finalizados corretamente.

### Uma vez por semana

Compare a projeção base com a meta da equipe e verifique os profissionais fora do ritmo. Use o ticket, a ocupação e os atendimentos agendados para entender se o problema é volume, preço/mix, ausência de horários ou qualidade de registro. Escolha poucas ações prioritárias e registre o acompanhamento na rotina da equipe.

### No fechamento mensal

Compare o realizado final com a projeção feita ao longo do mês. Procure padrões: a agenda futura foi mais ou menos assertiva? Houve faltas extraordinárias? A revenda seguiu o comportamento histórico? Essa revisão ajuda a calibrar metas, cadastros de horários, política de confirmação e estratégias de retorno para o mês seguinte.

## 11. Boas práticas de cadastro

A projeção só pode ser tão confiável quanto os registros de origem. Para melhorar a qualidade:

1. finalize o atendimento quando ele realmente ocorrer;
2. registre o valor recebido ou mantenha o valor correto no serviço;
3. marque cancelamento e não comparecimento no status apropriado, em vez de deixar o atendimento como agendado;
4. finalize a venda de revenda somente após confirmação do pagamento;
5. mantenha a agenda, jornadas, feriados e dias de trabalho dos profissionais atualizados;
6. cadastre metas realistas por profissional para cada competência; e
7. selecione a empresa e a unidade corretas antes de operar ou consultar indicadores.

## 12. Privacidade, escopo e auditoria

A tela não expõe telefone ou dados pessoais de clientes. Os dados agregados chegam ao navegador já filtrados pela empresa e, quando aplicável, pela unidade ativa da sessão. O cálculo é feito no servidor, que recebe a identidade da empresa/unidade pela autenticação, e não por valores livres enviados pela tela.

A previsão não envia o histórico financeiro a um provedor externo para calcular os números. A instalação pode possuir serviços de IA para outros módulos, como atendimento, mas a integridade desta visão financeira não depende deles. Isso mantém o resultado disponível mesmo se um provedor de linguagem estiver indisponível.

## 13. Perguntas frequentes

### Por que minha projeção é zero ou aparece como histórico insuficiente?

Provavelmente não existem atendimentos concluídos ou revendas pagas nos meses de referência. Confirme se a operação está encerrando atendimentos e finalizando vendas. A agenda futura pode aparecer mesmo sem histórico, mas o painel não inventa uma tendência sem base.

### Por que uma venda aguardando pagamento não aumentou o faturamento?

Porque o painel considera revenda realizada somente quando a venda está marcada como paga. Isso evita apresentar faturamento que ainda não foi recebido.

### Um atendimento de plano aparece como serviço vendido?

Não como venda avulsa. Quando uma sessão é coberta pelo plano, ela não entra novamente como receita de serviço avulso, evitando dupla contagem. A receita recorrente deve ser tratada pelo fluxo financeiro próprio do plano.

### A projeção é uma meta automática?

Não. Meta é um objetivo configurado pelo gestor. Projeção é uma estimativa baseada no que está registrado. Uma meta pode ser maior, igual ou menor que a projeção.

### Por que dois profissionais com o mesmo valor realizado têm projeções diferentes?

Porque a previsão individual também considera agenda futura e histórico próprio. Um profissional pode ter mais horários reservados, ticket diferente ou série histórica distinta.

### A ferramenta cobra ou envia mensagem automaticamente para a equipe?

Não. As ações recomendadas apenas levam o gestor ao módulo adequado. Toda comunicação, agendamento, venda ou alteração de meta continua dependente da ação e confirmação humana nos fluxos apropriados.

## 14. Resumo de responsabilidade

A projeção inteligente é uma ferramenta de antecipação e priorização. O ERP calcula números com dados reais, mostra a qualidade da base, separa realizado de agenda e deixa claro o que influencia cada cenário. Cabe à gestão validar o contexto da operação, manter os registros corretos e usar os alertas como ponto de partida para uma conversa e uma ação proporcional.
