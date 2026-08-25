# Brief de redesenho da Home Kytto

## Objetivo

Substituir a experiência atual, que ainda apresenta o torneio Agro Open, por uma Home institucional da Kytto. A página deve explicar em poucos segundos que a Kytto é uma techco de IA aplicada e uma plataforma de soluções para operações reais, e deve encaminhar cada visitante para a solução mais relevante.

## Mensagem central

**Enquanto o mercado testa IA, a Kytto já opera com ela.**

A Kytto reúne software, dados, automação e inteligência artificial para fazer negócios subirem. O texto deve privilegiar clareza comercial e prova de execução, evitando jargão de investidor e números financeiros do deck.

## Arquitetura de página

1. Header público com logo, âncoras “Plataforma”, “Soluções”, “Como entregamos” e CTA “Explorar soluções”.
2. Hero escuro com a mensagem central, apoio curto e dois CTAs: conhecer soluções e abrir o ambiente principal.
3. Faixa de confiança com quatro ideias: IA em produção, operação real, dados conectados e pessoas no centro.
4. Seção “Uma plataforma, várias frentes” explicando que o ecossistema combina produtos especialistas e uma camada de IA aplicada.
5. Grid de quatro soluções prioritárias fornecidas pelo usuário: GemOps, LakeX, Setpoint e Nossa Gente AI. Cada cartão apresenta o papel da solução, benefício principal e link externo.
6. Seção “IA que age” com três capacidades: agentes autônomos, visão computacional e copilotos sobre dados reais.
7. Seção “Da operação para o resultado” com fluxo visual simples: conectar → observar → decidir → executar.
8. CTA final “Faça o seu negócio subir” com acesso a soluções e ao painel Setpoint.
9. Footer com marca, navegação e links externos.

## Soluções e destinos

| Solução | Papel editorial | Link |
|---|---|---|
| GemOps | Operações e CSC inteligente, automação, compras, viagens e aprovações | https://gemops-digital-108835006988.us-central1.run.app/app |
| LakeX | Indústria, gêmeos digitais, observabilidade e decisão em tempo real | https://lakex.uisa.com.br |
| Setpoint | Operação e gestão, com acesso ao ambiente de produção | https://setpoint.kytto.com.br/admin |
| Nossa Gente AI | Pessoas, performance, inteligência e apoio à gestão | https://ai-nossagente-web-nedqnqyahq-rj.a.run.app/login |

## Direção visual

A direção deve adaptar o deck: fundo azul-marinho profundo em hero e CTA, creme suave para as áreas de conteúdo, laranja Kytto para ação e destaque, cartões brancos com sombras muito leves e linhas finas. O hero usa grafismos angulares construídos com CSS, sem depender de imagem externa. A tipografia aproveita as fontes Work Sans/Outfit já carregadas no sistema, com títulos compactos, forte contraste e microtítulos em caixa alta.

O layout deve ter bastante respiro, bordas de 18–28px, microinterações inferiores a 300ms, foco visível e comportamento mobile-first. Links de produto abrem em nova aba com `rel="noreferrer"`. A Home pública deve continuar isolada do Layout administrativo por meio de `Layout marketing` e não deve alterar as rotas `/admin`.

## Critérios de aceite

A Home em `/` e `/?locale=pt-BR` deve apresentar Kytto, não Agro Open; os quatro cards precisam abrir os destinos corretos; o CTA de acesso deve continuar contextual para usuários autenticados; a página deve funcionar em telas móveis e desktop; o build Vite deve passar; e `/admin` deve continuar sendo uma rota protegida e inalterada.


## Validação visual local

O preview local em `http://localhost:4173/?locale=pt-BR` renderizou a nova Home com hero azul-marinho, navegação institucional, grafismo orbital, faixa laranja de pilares, cartões das quatro soluções, seção de capacidades e CTA final. O conteúdo antigo do Agro Open não aparece mais. A rota pública entrega título `Kytto | Sistemas inteligentes para negócios` e os quatro links externos corretos. O primeiro build foi bloqueado apenas porque `lucide-react` não estava declarado; a dependência foi adicionada ao `web/package.json` e o build seguinte passou.


## Validação de rotas

A rota local `/admin` redirecionou corretamente para `/login`, confirmando que a guarda de autenticação permanece ativa. A Home local em `/?locale=pt-BR` renderizou o novo conteúdo institucional, com título `Kytto | Sistemas inteligentes para negócios`, hero, quatro cards de solução, links de CTA, seção de capacidades e footer. O conteúdo antigo do torneio não aparece no novo bundle.


## Estado pós-merge em produção

O PR #18 foi mesclado no branch `fix/kytto-comandas-pdv-20260808` com o commit `fef52b39dd9a64dc1f68206bba5e4cb11039af7d`. A validação externa após 90 segundos ainda encontrou a Home antiga do Agro Open em `https://kytto.com.br/?locale=pt-BR`, com ETag `W/\"a9d-1a03a334268\"`, embora o host estivesse saudável no Render e `/admin` retornasse HTTP 200. Isso indica que o Render ainda não disparou/concluiu o deploy do commit mesclado ou está conectado a outra branch.

Os destinos externos testados no ambiente de validação foram: GemOps HTTP 200; Setpoint `/admin` HTTP 200; Nossa Gente AI `/login` HTTP 200; LakeX em `https://lakex.uisa.com.br` não resolveu DNS publicamente durante o teste e precisa ser confirmado/corrigido antes de apresentar esse link como destino público garantido.


## Publicação no Render

O serviço `setpoint` foi alterado de `main` para `fix/kytto-comandas-pdv-20260808`, conforme autorizado. O Render iniciou o deploy `dep-da6vnk2fngtc73br7j9g` usando o commit `fef52b39dd9a64dc1f68206bba5e4cb11039af7d`. O build terminou com sucesso (`vite build`, 1.921 módulos transformados), e a revisão avançou para o deploy, aguardando apenas o healthcheck interno em `kytto.com.br:10000/api/info`.


## Deploy live concluído

O Render publicou com sucesso o commit `fef52b39dd9a64dc1f68206bba5e4cb11039af7d` na branch `fix/kytto-comandas-pdv-20260808`. O build Vite passou, o servidor iniciou em `http://localhost:10000`, o healthcheck interno foi aprovado e o Render marcou a revisão como **live** em 25/08/2026 às 20:33. O serviço informa `https://kytto.com.br` como URL primária.


## Validação pós-publicação

O Render marcou o deploy como live e o domínio público respondeu HTTP 200, mas a validação de navegador em `https://kytto.com.br/?locale=pt-BR` ainda mostrou o título antigo `4ª Agro Open de Tênis 2026 | SetPoint — Tangará Tênis Clube` e uma tela sem conteúdo montado. O HTML inicial também ainda continha marcadores do Agro Open, enquanto o serviço `setpoint` estava live no commit novo. Isso indica cache/HTML estático antigo ou incompatibilidade de assets/runtime no caminho público, e exige uma correção adicional antes de considerar o redesenho entregue.


## Causa técnica da Home antiga/tela branca

A validação externa mostrou que o deploy novo está live, mas `https://kytto.com.br/?locale=pt-BR` continua entregando um HTML com título e metadados do Agro Open, além dos bundles `/assets/index-BPqCqGCI.js` e `/assets/index-CUce7jsh.css`. Esses assets respondem HTTP 200, porém o navegador segue sem montar conteúdo. O `service-worker.js` também está sendo servido com `cache-control: public, max-age=0` pelo Render/Cloudflare e seu conteúdo retornado é o HTML antigo, indicando que o servidor está tratando o service worker como fallback SPA. A causa provável é o `server.js` do Render apontar para um diretório/artefato estático antigo ou servir fallback para arquivos públicos que não existem na revisão nova; é necessário comparar o diretório estático usado pelo servidor com `web/dist` e corrigir a entrega de assets antes de considerar a publicação concluída.


## Configuração live encontrada

Após o deploy, o serviço Render está corretamente conectado à branch `fix/kytto-comandas-pdv-20260808`. Entretanto, a configuração live de **Build Command** ainda é `cd web && npm install --include=dev && npm run build && cd ../app && npm install`, sem a etapa necessária de limpar/copiar `web/dist` para `app/public`. Como `app/server.js` publica somente `app/public`, esse é o ponto exato que mantém o HTML legado em produção.
