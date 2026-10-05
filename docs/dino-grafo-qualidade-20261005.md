# Dino: qualidade do grafo e homologação

O grafo anterior considerava pedidos ainda aguardando pagamento como compras, unificava cadastros pelo telefone, agrupava produtos apenas pelo nome e ocultava falhas de carregamento. Esta entrega corrige essas regras sem alterar pedidos, clientes, consentimentos persistidos ou configurações de envio.

## Mudanças

- Compras Commerce: somente paid, processing, ready, shipped, ready_for_pickup, delivered, picked_up e completed. Exclui pedidos parcialmente reembolsados enquanto não houver cálculo do valor líquido. Deduplica pelo ID de pedido.
- Produtos usam IDs com origem local/Commerce. Históricos antigos sem ID só se associam por nome quando o catálogo contém uma correspondência única. Itens cujo nome começa por Homologação são excluídos de compras e ofertas; não são apagados.
- Cadastros locais distintos e identidades Commerce distintas com o mesmo telefone permanecem separados. Sem vínculo comprovado entre Commerce e cadastro local, o telefone compartilhado fica pendente e não gera automação. Fatos por telefone não são atribuídos a identidades ambíguas. Não há ferramenta de conciliação de identidades nesta entrega.
- Titulares anonimizados não entram no cálculo e seus históricos não recriam o cliente por telefone. A revalidação de envio recusa anonimização, duplicidade no cadastro local e indisponibilidade desse cadastro.
- Loja selecionada: pedidos, estoque e fatos respeitam a loja. Fatos exigem conversa de origem dessa loja. Registros legados sem loja explícita e estoque local sem vínculo de loja ficam fora da visão por loja. A visão da empresa mantém o legado.
- Preço promocional vigente e custo vêm da mesma variante disponível. Exige tabela de preço vinculada a canal publicado e storefront ativo. Sem custo conhecido, a margem não soma pontos.
- Fontes indisponíveis e limites de leitura são visíveis e bloqueiam novas propostas automáticas nesta leitura. Isso não altera o consentimento gravado nem cancela automaticamente tarefas antigas já enfileiradas.
- Grafo individual não retorna arestas com nós ausentes. A tela avisa quando truncado (40 nós/60 relações), permite explorar clientes sem oferta (primeiros 200), informa a amostra das métricas e distingue coocorrência no histórico de compra no mesmo pedido.

## Validação executada

50 testes direcionados: grafo, carregamento, rotas/permissões, automações, observabilidade do aprendizado, roteamento de IA e consultas SQL em PostgreSQL embarcado (PGlite). As consultas foram executadas em esquema reduzido de tabelas relevantes, com duas lojas, variante sem preço, preço promocional, pedidos pendentes e fatos de lojas diferentes. JSX transformado com esbuild e diff verificado.

Comando sem PostgreSQL embarcado (o teste SQL fica explicitamente ignorado):

```sh
node --test app/dino-grafo.test.js app/ai-brain-data.test.js app/ai-brain-data.sql.test.js app/ai-brain-graph-routes.test.js app/core/ai-automations.test.js app/core/ai-learning-observability.test.js app/core/ai-router.test.js
```

Para executar também o teste SQL, instale `@electric-sql/pglite` em diretório temporário e defina `AI_GRAPH_PGLITE_MODULE` com o caminho absoluto de `dist/index.js` antes do mesmo comando. Nenhuma dependência de produção foi adicionada.

Não foi executada a suíte completa do monorepo nem o build completo da aplicação web. Uma tentativa de rodar a suíte abrangente de memória foi interrompida por módulos do atendimento ausentes no checkout parcial; não conta como validação aprovada. A validação visual no navegador e o banco com todas as migrations de produção dependem da homologação após deploy.

## Homologação / Manus

1. Aplicar o PR sobre `fix/kytto-comandas-pdv-20260808`; não há migration nova. Fazer build completo do backend/frontend e publicar em homologação.
2. Na empresa Dino, abrir Cérebro IA → Grafo e ofertas. Confirmar fontes carregadas, clientes sem oferta acessíveis e pedidos pendentes/homologação fora de COMPROU.
3. Selecionar duas lojas e conferir pedidos, estoque e fatos contra dados de origem. Cadastros antigos sem loja e canais sem tabela de preço podem reduzir a cobertura; corrigir os vínculos na origem, sem atribuí-los automaticamente.
4. Conferir cadastro duplicado e anonimizado com dados de teste: nenhum envio deve ser proposto. Testar indisponibilidade de uma fonte e verificar aviso/bloqueio. Não disparar mensagens reais nesta homologação.
5. Confirmar corte de nós do desenho, rótulos e seleção de cliente em desktop e celular. Validar que nome/telefone completo não aparecem nas URLs/tokens.
6. Registrar SHA servido, resultados e evidências antes de promover para produção. Reverter o commit se houver regressão; não há migração de dados para desfazer.

As integrações sociais inspiradas no ViralGran continuam fora desta etapa, conforme prioridade do grafo. Credenciais de provedores e avaliação por IA independente não foram configuradas ou simuladas.
