# Referência funcional — indicadores e relatórios Dino

**Origem:** prints e vídeo enviados pelo responsável em 23/10/2026, observados somente como referência de interface e requisitos funcionais. Os anexos permanecem em `/home/ubuntu/upload/` e não serão versionados no repositório.

## Padrões solicitados

- Filtro explícito por período (início e fim), atalhos e comparação com a janela anterior equivalente.
- Indicadores financeiros: valor bruto/faturamento, ticket médio, despesas, resultado e composição por serviços, produtos e canais.
- Série diária de faturamento e rankings por serviços, produtos, profissionais e formas de pagamento.
- Indicadores operacionais: quantidade de comandas, atendimentos, reservas por dia, taxa de comparecimento, cancelamentos e faltas; o uso de ocupação depende de capacidade/jornada cadastrada, portanto não deve ser inferido quando não houver base.
- Indicadores de clientes: atendidos, recorrência/retorno, melhores clientes, cadastros por bairro, sexo, faixa etária, origem de aquisição e avaliações — somente quando os respectivos campos estiverem presentes e sem expor PII em agregados.
- Relatório por profissional: faturamento, itens, comandas, ticket médio, gráfico comparativo e tabela exportável; os valores individuais devem ficar sob controle de permissão e pedidos de e-commerce não podem ser atribuídos a um profissional sem vínculo comprovado.
- Interações: filtros, drill-down por cartões/rankings, exportação CSV, impressão/PDF e análise por IA sob demanda com dados agregados.

## Critérios de adaptação Dino

1. Usar dados reais no escopo estrito empresa + unidade; nunca preencher com dados simulados.
2. Somar as fontes já consolidadas pela Dino (operação, histórico financeiro Avec e Commerce) sem recontar a mesma venda.
3. Diferenciar valores operacionais, financeiros históricos e e-commerce na interface e nos metadados de cobertura.
4. Manter histórico Avec auditável e identificado; nenhuma consulta, exportação ou insight agrega dados pessoais desnecessários.
5. IA é consultiva, sob ação explícita, e recebe apenas totais/variações/rankings agregados; não executa lançamentos nem comunica clientes.
