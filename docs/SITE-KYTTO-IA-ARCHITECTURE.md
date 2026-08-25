# Arquitetura editorial do site Kytto — IA e soluções

## Referências confirmadas

O repositório oficial do AIJur é `rrodrigogon-byte/AIJur-lakex`: https://github.com/rrodrigogon-byte/AIJur-lakex. O endereço público do produto ainda precisa ser confirmado no próprio projeto ou pelo responsável antes de ser publicado como CTA externo.

A Home Kytto já tem uma navegação pública própria na rota `/`, enquanto as rotas administrativas permanecem protegidas sob `/admin`. O SetPoint possui módulos identificados no código para Supermercado, Barbearia, Barbearia & Salão, Loja de Moda, Restaurante/Bar, Varejo e outros contextos multinegócio. Essas capacidades serão apresentadas como soluções setoriais da plataforma, não como produtos independentes sem relação.

## Mapa proposto

| Página | Rota | Objetivo |
|---|---|---|
| IA aplicada | `/ia` | Explicar a tese Kytto: IA conectada a dados, contexto e execução |
| Agentes autônomos | `/ia/agentes` | Mostrar automação, copilotos, RPA e agentes que executam processos |
| Dados e decisões | `/ia/dados` | Mostrar observabilidade, governança, indicadores e decisões acionáveis |
| Visão computacional | `/ia/visao-computacional` | Mostrar como eventos físicos viram dados operacionais |
| AIJur | `/ia/aijur` | Apresentar inteligência aplicada ao jurídico, compliance e risco; link público pendente de confirmação |
| Soluções por setor | `/solucoes` | Organizar SetPoint por barbearias, mercados, lojas, restaurantes, bares, varejo e operações multinegócio |

## Navegação dos produtos já confirmados

- GemOps: https://gemops-digital-108835006988.us-central1.run.app/app
- LakeX: https://lakex.com.br
- SetPoint: https://setpoint.kytto.com.br/admin
- Nossa Gente AI: https://ai-nossagente-web-nedqnqyahq-rj.a.run.app/login
- AIJur: endereço público ainda não confirmado.


## AIJur — proposta confirmada no repositório

O AIJur é descrito no repositório como um SaaS jurídico brasileiro. A arquitetura inclui gestão multi-tenant, RBAC, módulos de clientes, assuntos, auditoria, documentos, prazos e tarefas, além de validação jurídica, proteção de dados e um núcleo de IA. A comunicação institucional deve posicionar o produto como inteligência jurídica aplicada, com automação e governança, sem prometer aconselhamento jurídico autônomo.

O repositório não revelou um hostname público confiável para o AIJur. Por isso, a subpágina deve apresentar o produto com CTA de contato ou rota interna `/ia/aijur` até que o endereço de produção seja confirmado pelo responsável.


## Validação local inicial

O build Vite passou após a implementação. A rota `/ia` renderizou o cabeçalho institucional, a narrativa “Inteligência que entra em campo”, os CTAs e os blocos de pilares. A rota `/solucoes` renderizou o posicionamento “Uma plataforma. Muitos negócios.”, os setores Barbearias & salões, Mercados, Lojas & varejo, Restaurantes, Bares & eventos, Operações multinegócio, Escritórios jurídicos e Centros de serviço, além dos links GemOps, LakeX, SetPoint, Nossa Gente AI e AIJur.


A rota `/ia/aijur` renderizou corretamente o posicionamento de inteligência jurídica aplicada, com módulos de documentos/evidências, prazos/assuntos e governança, além do aviso de que a IA apoia profissionais e não substitui responsabilidade jurídica humana. A rota `/ia/agentes` renderizou o conteúdo de copilotos, fluxos que se movem, controle de autonomia e o ciclo observar → entender → propor/executar → aprender.


A rota `/ia/dados` renderizou a narrativa de contexto, observabilidade e governança, com CTAs para IA e soluções. A rota `/admin` no preview continuou protegida e redirecionou para `/login`, confirmando que as novas rotas públicas não atravessaram a guarda administrativa.


## Deploy das subpáginas

O PR #21 foi integrado ao branch de produção e o Render concluiu o deploy automático com o commit `23ab17a`, em aproximadamente 32 segundos. A publicação ocorreu no serviço `setpoint`, conectado ao branch `fix/kytto-comandas-pdv-20260808`.


## Verificação ao vivo — investigação adicional

As rotas públicas retornaram HTTP 200 após o deploy `23ab17a`, mas a tentativa de navegação do navegador para `/ia?locale=pt-BR` exibiu inicialmente `Carregando…` e depois caiu para `about:blank`. Será necessário verificar o HTML, o manifest e os chunks lazy publicados para garantir que a nova página não está sendo servida apenas como shell sem os assets correspondentes.


## Validação em produção

Após o deploy automático do Render, as rotas `/ia`, `/ia/agentes`, `/ia/dados`, `/ia/aijur` e `/solucoes` retornaram HTTP 200 e foram montadas pelo Chromium headless com seus títulos e conteúdos específicos. Os destinos GemOps, LakeX, SetPoint e Nossa Gente AI também retornaram HTTP 200. A rota `/admin` permanece protegida e redireciona para `/login` quando não autenticada.
