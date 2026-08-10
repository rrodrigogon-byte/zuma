# Validação visual do PWA isolado

- **Data:** 2026-08-09 (America/Cuiaba)
- **URL testada:** `http://127.0.0.1:3128/login`
- **Estado observado:** a página ficou em branco, com título legado de Agro Open/SetPoint. Não houve elementos interativos renderizados.
- **Hipótese inicial:** o service worker/cache do navegador pode estar entregando um `index.html` legado ou os assets atuais não estão sendo servidos pela instância isolada.
- **Próximo diagnóstico:** inspecionar o HTML entregue, cabeçalhos/asset URLs e console antes de considerar a validação PWA concluída.

A validação com `NODE_ENV=production` e `PUBLIC_DIR=web/dist` retornou os cabeçalhos esperados de proteção e `Cache-Control: no-store` para o HTML. Ainda assim, o navegador exibiu página em branco e manteve o título legado, sem registrar erro no console. Como o HTML entregue referencia os assets atuais, a próxima verificação será no conteúdo do bundle e na resposta HTTP dos assets para isolar se a falha está no HTML compilado, em runtime ou no comportamento do navegador automatizado.

Após corrigir o fallback SPA para respeitar `PUBLIC_DIR`, a rota `/login` passou a entregar o build atual e renderizou a tela Kytto corretamente. A autenticação foi preenchida com uma conta de bootstrap exclusiva do ambiente isolado; o próximo passo é confirmar o redirecionamento, o menu administrativo e o registro ativo do service worker.

O smoke test autenticado foi concluído no ambiente equivalente à produção. A tela de login redirecionou para `/admin`, mostrou o menu administrativo completo da identidade Kytto e carregou os módulos recentes, incluindo Mesas, Reservas & Fila, KDS & Impressão, Perdas & Inventário, Fichas Técnicas, Adicionais & Combos e fiscal. A inspeção no navegador confirmou um service worker ativo, controlador da página e registrado no escopo da origem de teste.

### Produção — 10/08/2026 02:06 UTC

A revisão `setpoint-ultra-00080-lv2` foi promovida para 100% do tráfego. Os endpoints `/health` nas URLs oficial e `setpoint.kytto.com.br` responderam HTTP 200 com os módulos operacionais ativos. A validação visual autenticada carregou o dashboard e o menu administrativo completo. A inspeção do navegador confirmou o bundle atual `index-C9ESDXxg.js` e um service worker controlador ativo na origem de produção.
