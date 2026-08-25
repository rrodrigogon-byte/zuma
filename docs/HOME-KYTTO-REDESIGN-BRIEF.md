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
