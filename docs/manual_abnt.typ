
#set document(
  title: "Manual Técnico e Operacional de Agendamento Online por Profissional",
  author: ("Rodrigo Gonçalves", "Equipe de Engenharia Kytto"),
  date: auto,
)

// Configurações de Página ABNT (NBR 14724)
#set page(
  paper: "a4",
  margin: (top: 3.0cm, left: 3.0cm, bottom: 2.0cm, right: 2.0cm),
  header: context {
    let p = counter(page).get().first()
    let intro = query(heading.where(level: 1)).find(h => h.body == [Introdução e Objetivos do Sistema])
    if intro != none {
      let p_intro = counter(page).at(intro.location()).first()
      if p >= p_intro {
        align(right)[#text(font: "Liberation Sans", size: 10pt)[#p]]
      }
    }
  }
)

#set text(
  font: "Liberation Sans",
  size: 12pt,
  lang: "pt",
  region: "BR"
)

#set par(
  justify: true,
  leading: 0.85em, // Espaçamento 1.5 padrão ABNT
  first-line-indent: 1.25cm
)

#set heading(numbering: "1.1")

// Estilização de Seções ABNT
#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  v(1.5em)
  block(text(size: 13pt, weight: "bold")[
    #if it.numbering != none {
      counter(heading).display()
      h(0.5em)
    }
    #upper(it.body)
  ])
  v(1.0em)
}

#show heading.where(level: 2): it => {
  v(1.3em)
  block(text(size: 12pt, weight: "bold")[
    #if it.numbering != none {
      counter(heading).display()
      h(0.5em)
    }
    #it.body
  ])
  v(0.8em)
}

#show heading.where(level: 3): it => {
  v(1.1em)
  block(text(size: 12pt, style: "italic", weight: "bold")[
    #if it.numbering != none {
      counter(heading).display()
      h(0.5em)
    }
    #it.body
  ])
  v(0.6em)
}

// Estilo de Figuras e Tabelas ABNT
#set figure.caption(separator: [ – ])
#show figure.where(kind: image): it => {
  set align(center)
  block(spacing: 1.5em)[
    #text(size: 10pt, weight: "bold")[#it.caption]
    #v(0.4em)
    #it.body
  ]
}

#show figure.where(kind: table): it => {
  set align(center)
  block(spacing: 1.5em)[
    #text(size: 10pt, weight: "bold")[#it.caption]
    #v(0.4em)
    #it.body
  ]
}

// Customização de Outline para padrão ABNT
#show outline.entry.where(level: 1): it => {
  v(0.4em)
  text(weight: "bold")[#it]
}

// =============================================================================
// ELEMENTOS PRÉ-TEXTUAIS (CONFORME ABNT NBR 14724)
// =============================================================================

// -----------------------------------------------------------------------------
// 1. CAPA
// -----------------------------------------------------------------------------
#place(top + center, dy: 0cm)[
  #image("manual-assets/kytto_logo.png", width: 4.8cm)
  #v(0.8em)
  #text(size: 12pt, weight: "bold")[KYTTO TECNOLOGIA E SISTEMAS S.A.]\
  #text(size: 10pt)[DIVISÃO DE ENGENHARIA DE PRODUTO E OPERAÇÕES EM NUVEM]\
  #text(size: 10pt)[UNIDADE DE NEGÓCIOS DE BARBEARIA & BELEZA]
]

#v(7.5cm)

#align(center)[
  #text(size: 13pt, weight: "bold")[RODRIGO GONÇALVES]\
  #text(size: 11pt)[EQUIPE DE ENGENHARIA & PRODUTO KYTTO]
]

#v(2.5cm)

#align(center)[
  #text(size: 15pt, weight: "bold")[MANUAL TÉCNICO E OPERACIONAL DO ERP E AGENDAMENTO KYTTO]\
  #v(0.5em)
  #text(size: 12pt, style: "italic")[Catálogo Inteligente, Modo Barbeiro, Gestão de Caixa Padrão AVEC, Reabertura com Correções e Relatório Oficial de Fechamento]
]

#v(1fr)

#align(center)[
  #text(size: 11pt, weight: "bold")[TANGARÁ DA SERRA – MT]\
  #text(size: 11pt)[2026]
]

#pagebreak()

// -----------------------------------------------------------------------------
// 2. FOLHA DE ROSTO
// -----------------------------------------------------------------------------
#align(center)[
  #text(size: 12pt, weight: "bold")[RODRIGO GONÇALVES]\
  #text(size: 11pt)[COLABORADORES: ENGENHARIA & OPERAÇÕES KYTTO]
]

#v(4.5cm)

#align(center)[
  #text(size: 14pt, weight: "bold")[MANUAL TÉCNICO E OPERACIONAL DE AGENDAMENTO ONLINE POR PROFISSIONAL]\
  #v(0.5em)
  #text(size: 11pt, style: "italic")[Catálogo Inteligente por Profissional, Blindagem de Privacidade da Agenda e Vínculo Automático por CPF com a Base Ativa]
]

#v(2.0cm)

#align(right)[
  #block(width: 9.0cm)[
    #set par(first-line-indent: 0cm, leading: 0.6em, justify: true)
    #text(size: 10pt)[
      Manual técnico-operacional e de governança sistêmica desenvolvido para padronizar os processos de agendamento online, divulgação multicanal, proteção à privacidade da agenda (LGPD) e integração cadastral no ecossistema de barbearias Kytto, com aplicação piloto homologada na Dino Barbearia & Perfumaria.
      \ \
      *Instituição:* Kytto Tecnologia e Sistemas S.A.\
      *Gestor Responsável:* Rodrigo Gonçalves\
      *Área de Aplicação:* Soluções de Automação Comercial e SaaS
    ]
  ]
]

#v(1fr)

#align(center)[
  #text(size: 11pt, weight: "bold")[TANGARÁ DA SERRA – MT]\
  #text(size: 11pt)[2026]
]

#pagebreak()

// -----------------------------------------------------------------------------
// 3. FICHA DE CONTROLE DE VERSÕES E APROVAÇÃO TÉCNICA
// -----------------------------------------------------------------------------
#v(1.0cm)
#align(center)[#text(size: 12pt, weight: "bold")[CONTROLE DE VERSÕES E HOMOLOGAÇÃO TÉCNICA]]
#v(1.0em)

#set par(first-line-indent: 0cm)

#table(
  columns: (3.0cm, 3.5cm, 4.0cm, 4.5cm),
  stroke: 0.5pt + luma(120),
  fill: (col, row) => if row == 0 { rgb("f0f2f5") } else { none },
  align: (center + horizon, left + horizon, left + horizon, left + horizon),
  [#text(weight: "bold", size: 10pt)[Versão]],
  [#text(weight: "bold", size: 10pt)[Data]],
  [#text(weight: "bold", size: 10pt)[Responsável]],
  [#text(weight: "bold", size: 10pt)[Descrição da Alteração]],

  [1.0.0], [02/08/2026], [Engenharia Kytto], [Lançamento inicial do módulo de agendamento online público.],
  [2.0.0], [30/10/2026], [Rodrigo Gonçalves], [Implantação do link direto e responsivo por barbeiro.],
  [2.1.0], [02/11/2026], [Rodrigo Gonçalves], [Blindagem de privacidade (Livre/Ocupado) e validação de CPF.],
  [2.2.0], [02/11/2026], [Engenharia Kytto], [Correção de importação dinâmica e tolerância a falhas (Vite/Render).],
  [2.3.0], [03/11/2026], [Rodrigo Gonçalves], [Catálogo Inteligente: filtragem estrita de serviços por profissional.],
  [2.4.0], [03/11/2026], [Rodrigo Gonçalves], [Homologação de produção final e emissão do manual ABNT.]
)

#v(2.0em)

#table(
  columns: (4.0cm, 5.5cm, 5.5cm),
  stroke: 0.5pt + luma(120),
  fill: (col, row) => if row == 0 { rgb("f0f2f5") } else { none },
  align: (center + horizon, left + horizon, left + horizon),
  [#text(weight: "bold", size: 10pt)[Instância]],
  [#text(weight: "bold", size: 10pt)[Nome do Responsável]],
  [#text(weight: "bold", size: 10pt)[Assinatura / Parecer]],

  [Elaboração], [Rodrigo Gonçalves], [Aprovado para Publicação e Uso Operacional],
  [Revisão Técnica], [Equipe de Arquitetura Kytto], [Conforme Padrões Arquiteturais e LGPD],
  [Homologação], [Gestão Dino Barbearia & Salão], [Validado em Ambiente Real de Atendimento]
)

#v(1fr)

#align(center)[
  #text(size: 9pt, style: "italic")[Documento registrado e controlado eletronicamente pela Kytto Tecnologia e Sistemas S.A. Proibida a alteração sem autorização prévia da Engenharia de Software.]
]

#pagebreak()

// -----------------------------------------------------------------------------
// 4. LISTA DE ILUSTRAÇÕES (FIGURAS)
// -----------------------------------------------------------------------------
#v(1.0cm)
#align(center)[#text(size: 13pt, weight: "bold")[LISTA DE ILUSTRAÇÕES]]
#v(1.5em)

#outline(
  title: none,
  target: figure.where(kind: image),
  indent: auto
)

#v(3.0em)

// -----------------------------------------------------------------------------
// 5. LISTA DE TABELAS
// -----------------------------------------------------------------------------
#align(center)[#text(size: 13pt, weight: "bold")[LISTA DE TABELAS]]
#v(1.5em)

#outline(
  title: none,
  target: figure.where(kind: table),
  indent: auto
)

#v(3.0em)

// -----------------------------------------------------------------------------
// 6. LISTA DE ABREVIATURAS E SIGLAS
// -----------------------------------------------------------------------------
#align(center)[#text(size: 13pt, weight: "bold")[LISTA DE ABREVIATURAS E SIGLAS]]
#v(1.5em)

#set par(first-line-indent: 0cm, leading: 0.8em)

#grid(
  columns: (3.0cm, 1fr),
  gutter: 0.8em,
  [*ABNT*], [Associação Brasileira de Normas Técnicas],
  [*API*], [Application Programming Interface (Interface de Programação de Aplicação)],
  [*CDN*], [Content Delivery Network (Rede de Distribuição de Conteúdo)],
  [*CPF*], [Cadastro de Pessoas Físicas (Receita Federal do Brasil)],
  [*CRM*], [Customer Relationship Management (Gestão do Relacionamento com o Cliente)],
  [*DDD*], [Discagem Direta a Distância],
  [*ERP*], [Enterprise Resource Planning (Planejamento de Recursos Empresariais)],
  [*LGPD*], [Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018)],
  [*PR*], [Pull Request (Solicitação de Mesclagem de Código em Repositório)],
  [*PWA*], [Progressive Web App (Aplicativo Web Progressivo)],
  [*QR Code*], [Quick Response Code (Código de Resposta Rápida)],
  [*REST*], [Representational State Transfer (Transferência de Estado Representacional)],
  [*SaaS*], [Software as a Service (Software como Serviço)],
  [*SPA*], [Single Page Application (Aplicação de Página Única)],
  [*URL*], [Uniform Resource Locator (Localizador Uniforme de Recursos)]
)

#pagebreak()

// -----------------------------------------------------------------------------
// 7. SUMÁRIO (CONFORME ABNT NBR 6027)
// -----------------------------------------------------------------------------
#v(1.0cm)
#align(center)[#text(size: 13pt, weight: "bold")[SUMÁRIO]]
#v(1.5em)

#outline(
  title: none,
  indent: auto,
  depth: 2
)

#pagebreak()

// =============================================================================
// ELEMENTOS TEXTUAIS
// =============================================================================
#set par(first-line-indent: 1.25cm, leading: 0.85em, justify: true)

= Introdução e Objetivos do Sistema

== Contextualização e Cenário Operacional

O mercado de estética e cuidados masculinos, especialmente o segmento de barbearias conceituadas, passou por uma transformação estrutural orientada pela digitalização dos hábitos de consumo. Historicamente, os agendamentos concentravam-se em canais informais, como ligações telefônicas ou trocas fragmentadas de mensagens via WhatsApp, processo que gerava atrito de comunicação, riscos de marcação dupla (sobreposição de horários), lapsos de registro financeiro e perda considerável de tempo produtivo dos profissionais.

Com o advento das redes sociais visuais — primordialmente o Instagram —, o barbeiro consolidou-se como uma autoridade individual de estilo e um polo autônomo de atração de demanda. No entanto, os sistemas convencionais de agendamento em massa impunham um fluxo genérico: o cliente precisava navegar por um catálogo corporativo impessoal, selecionar o estabelecimento e, somente em etapas posteriores, tentar localizar o seu barbeiro de preferência.

A Kytto Tecnologia e Sistemas S.A. identificou que a experiência de agendamento deve operar de forma invertida e personalizada: cada profissional deve ser detentor de um link canônico direto e responsivo. Ao acessar tal canal, o cliente deve interagir imediatamente com o portfólio de serviços executados especificamente por aquele profissional, selecionando datas e horários em uma interface de alta fidelidade visual, com absoluta garantia de sigilo de sua privacidade e sem conflitos de competência técnica entre os membros da equipe.

== Objetivos Estratégicos

O presente manual técnico e operacional estabelece a arquitetura, as regras de negócio e os padrões de operação homologados para a funcionalidade de Agendamento Online por Barbeiro, tendo como metas estratégicas:

1. *Autonomia Comercial do Profissional:* Prover a cada barbeiro ferramentas modernas de captação (links curtos, QR Codes de bancada e roteiros para Instagram/WhatsApp), elevando o faturamento médio por cadeira;
2. *Eliminação de Conflitos de Catálogo (Catálogo Inteligente):* Garantir que nenhum cliente consiga visualizar ou agendar procedimentos que o profissional escolhido não realiza (ex.: serviços exclusivos do fundador ou de esteticistas);
3. *Blindagem de Privacidade da Agenda:* Cumprir rigorosamente a Lei Geral de Proteção de Dados (LGPD - Lei Federal nº 13.709/2018), assegurando que terceiros visualizem unicamente a condição binária de disponibilidade (*Livre* ou *Ocupado*), suprimindo nomes, telefones ou histórico de clientes;
4. *Integridade e Deduplicação Cadastral:* Validar matematicamente o CPF dos clientes na entrada do agendamento, unificando prontuários e evitando cadastros duplicados no banco de dados ativo do ERP Kytto.

== Escopo de Aplicação e Usuários-Alvo

As diretrizes contidas neste documento aplicam-se a todos os estabelecimentos integrados ao Kytto ERP Barbearia, com validação de campo executada na unidade matriz da *Dino Barbearia & Perfumaria* (Tangará da Serra – MT). São usuários-alvo deste manual:

- *Barbeiros e Profissionais Parceiros:* Responsáveis pela divulgação ativa de seus respectivos links em suas redes sociais e pelo gerenciamento de sua rotina através do Modo Barbeiro;
- *Recepcionistas, Atendentes e Gerentes de Unidade:* Responsáveis pela supervisão da grade operacional diária, encaixes e conferência de comandas;
- *Diretores e Administradores de Unidades:* Responsáveis pela análise dos indicadores de conversão, recorrência e crescimento da base de clientes ativos.

= Arquitetura Técnica e Segurança da Informação

== Visão Geral da Arquitetura em Nuvem

A solução Kytto de Agendamento Online foi desenvolvida sobre uma arquitetura moderna e escalável de microsserviços em nuvem, composta pelas seguintes camadas estruturais:

1. *Front-End Responsivo (SPA):* Desenvolvido em React 19 com compilação otimizada via Vite. A interface é totalmente adaptável para dispositivos móveis (smartphones iOS e Android), tablets e desktops, operando como uma aplicação de carregamento rápido;
2. *Camada de API RESTful e Motor de Regras:* Servidor Node.js (Express) com suporte a módulos assíncronos e concorrência distribuída. Responsável pela validação de disponibilidade de horários, bloqueios de concorrência e geração de tokens de autoatendimento;
3. *Persistência de Dados Relacional:* Banco de dados PostgreSQL com modelagem transacional ACID, mantendo tabelas normalizadas para empresas, lojas, profissionais, serviços, clientes, agendamentos e movimentações de caixa.

== Segurança e Resiliência de Deploy

Para assegurar disponibilidade ininterrupta (uptime superior a 99,9%) e mitigar falhas durante ciclos contínuos de deploy em produção, foram implementadas as seguintes salvaguardas:

- *Preservação de Assets Estáticos:* O pipeline de compilação da plataforma (`render.yaml`) preserva os artefatos compilados das versões anteriores (`app/public/assets`), evitando que clientes com abas abertas em seus navegadores recebam erros de módulo ausente (*stale chunks*) após novos deploys;
- *Camada de Auto-Recuperação (Error Boundary):* O componente raiz da aplicação possui monitoramento de exceções dinâmicas de importação. Caso o navegador do cliente requisite um módulo defasado, o sistema executa um recarregamento automático e transparente, sem exigir ação manual;
- *Criptografia em Trânsito:* Todo o tráfego é autenticado e cifrado sob o protocolo TLS 1.3 (HTTPS), garantindo sigilo ponta a ponta na transmissão dos dados cadastrais do cliente.

= Catálogo Inteligente e Filtragem por Profissional

== Princípio da Exclusividade do Portfólio

Em um ambiente de barbearia moderna e multifuncional, os profissionais possuem especialidades e atribuições distintas. Determinados procedimentos requerem formação específica (ex.: próteses capilares, micropigmentação ou estética feminina), enquanto outros serviços tradicionais são de domínio exclusivo do fundador ou de barbeiros específicos.

A falha sistêmica corrigida na versão 2.3.0 do sistema Kytto consistia na exibição indiferenciada de todos os serviços da casa para qualquer barbeiro selecionado. Quando o cliente escolhia um serviço indevido na agenda de outro profissional, o fluxo travava na tela seguinte com a mensagem de bloqueio `"Este profissional não realiza este serviço."`.

O *Catálogo Inteligente Kytto* resolve essa fricção na origem: ao selecionar um profissional, o sistema realiza uma varredura bidirecional entre o cadastro do profissional e o atributo `profissionaisIds` de cada serviço, renderizando estritamente os itens compatíveis.

#v(0.8em)
#figure(
  caption: [Catálogo Exclusivo por Barbeiro – Interface Homologada da Profissional Nati],
  [
    #image("manual-assets/passo1_servicos_nati.png", width: 72%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Registros de Homologação em Produção (Kytto / Dino Barbearia, 2026).]
  ]
)
#v(0.8em)

Como demonstrado na Figura 1, ao acessar a rota oficial da barbeira Nati, o sistema estampa o título clarificador *"Serviços de Nati (15)"*, contendo apenas os 15 procedimentos que ela executa. Todos os demais serviços estranhos à sua atuação (como a Barba do Dino ou serviços do João) foram automaticamente excluídos da visão do cliente.

== Mapeamento e Matriz de Serviços por Profissional

A Tabela 1 detalha a matriz homologada de serviços por profissional na unidade piloto (Dino Barbearia & Perfumaria), demonstrando a segmentação rigorosa aplicada pela inteligência de catálogo do Kytto:

#v(0.8em)
#figure(
  caption: [Matriz de Correspondência entre Profissionais e Serviços Habilitados],
  [
    #table(
      columns: (5.0cm, 3.0cm, 3.0cm, 4.0cm),
      stroke: 0.5pt + luma(120),
      fill: (col, row) => if row == 0 { rgb("f0f2f5") } else { none },
      align: (left + horizon, center + horizon, center + horizon, left + horizon),
      [#text(weight: "bold", size: 9pt)[Profissional]],
      [#text(weight: "bold", size: 9pt)[Serviços Habilitados]],
      [#text(weight: "bold", size: 9pt)[Duração Média]],
      [#text(weight: "bold", size: 9pt)[Exemplos de Serviços Exclusivos]],

      [Natani Minanis (Nati)], [15 serviços], [10 a 60 min], [Corte e Barba Premium, Selagem, Visagismo, Terapias Capilares],
      [Bruno Mendes], [15 serviços], [10 a 60 min], [Corte e Barba Premium, Selagem, Visagismo, Terapias Capilares],
      [Dino (Fundador)], [16 serviços], [10 a 90 min], [Barba com Dino, Corte com Dino, Prótese Capilar Exclusiva],
      [João Victor], [14 serviços], [10 a 60 min], [Corte do João, Barba do João, Terapias Masculinas],
      [Ester Oliveira], [8 serviços], [15 a 60 min], [Manicure, Pedicure, Limpeza de Pele, Dermaplaning, Sobrancelha]
    )
    #v(0.3em)
    #text(size: 9pt)[Fonte: Banco de Dados Transacional Kytto (Novembro/2026).]
  ]
)
#v(0.8em)

#figure(
  caption: [Catálogo Exclusivo por Barbeiro – Interface do Profissional Bruno],
  [
    #image("manual-assets/passo1_servicos_bruno.png", width: 72%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Registros de Homologação em Produção (Kytto / Dino Barbearia, 2026).]
  ]
)

== Tratamento de Incompatibilidades e Auto-Recuperação

Caso o cliente inicie sua navegação na página principal da barbearia (`/agendar/dino`), selecione um serviço restrito (ex.: *"Prótese Capilar"*) e em seguida tente escolher um barbeiro que não executa o serviço, o sistema atua de forma preventiva através de dois mecanismos:

1. *Filtragem no Passo 2 (Com quem prefere?):* A grade de barbeiros exibe unicamente os profissionais que realizam o serviço selecionado no Passo 1. No caso da Prótese Capilar, somente o perfil do Dino é apresentado;
2. *Botão de Desbloqueio e Redirecionamento:* Se por qualquer motivo de sincronização assíncrona houver disparidade na chamada de horários, a tela apresenta de forma proativa o botão `"← Escolher outro serviço para este profissional"`, limpando o estado inconsistente e permitindo que o cliente prossiga instantaneamente, sem bloqueios de tela.

= Disponibilidade da Agenda e Blindagem de Privacidade (LGPD)

== Conformidade Estrita com a Lei Federal nº 13.709/2018

A Lei Geral de Proteção de Dados Pessoais (LGPD) estabelece no Brasil regras fundamentais de privacidade, vedando a exposição desnecessária de informações de clientes sem o devido consentimento. No segmento de serviços e beleza, softwares obsoletos frequentemente cometem infrações gravíssimas ao exibir nomes de clientes, telefones ou procedimentos nas grades de horário abertas ao público.

O motor do Kytto adota o princípio de *Privacy by Design* e *Privacy by Default*: o endpoint público da API (`/api/publico/agendamento/:slug/horarios`) higieniza integralmente a resposta em nível de backend, removendo quaisquer referências a identificadores (`id`), nomes (`clienteNome`), documentos (`clienteCpf`), telefones (`clienteTelefone`) ou anotações internas.

== Lógica Binária de Horários: Livre vs. Ocupado

Na interface do cliente, a visualização dos horários obedece rigorosamente ao padrão binário:

- *Horário Livre (Disponível):* Apresentado com botão ativo e destacado (em cor azul/índigo), indicando ao cliente que aquele intervalo pode ser reservado de imediato com 1 clique;
- *Horário Ocupado (Indisponível):* Apresentado em tom cinza apagado, com bloqueio funcional de clique (`disabled`), informando unicamente o rótulo *"Ocupado"*.

#v(0.8em)
#figure(
  caption: [Grade de Horários Disponíveis com Blindagem Binária de Privacidade (Livre/Ocupado)],
  [
    #image("manual-assets/passo2_horarios_privacidade.png", width: 72%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Registros de Homologação em Produção (Kytto / Dino Barbearia, 2026).]
  ]
)
#v(0.8em)

Como se observa na Figura 3, a tela informa de forma cristalina a alternância entre slots disponíveis e compromissos existentes na unidade, mantendo absoluta confidencialidade em relação à identidade dos demais frequentadores da casa.

== Navegação Temporal: Carrossel de 14 Dias e Seletor Contínuo

Para maximizar a conversão de agendamentos no ambiente mobile, o sistema fornece dois modos simultâneos de seleção de datas:

1. *Carrossel Horizontal de Acesso Rápido:* Exibe os próximos 14 dias em botões ergonômicos na parte superior (*Hoje*, *Amanhã*, *SEX*, *SÁB* etc.). Com um simples toque, a grade de horários é recalculada em tempo real;
2. *Calendário Completo (Datepicker Nativo):* Permite a seleção de qualquer data futura contida dentro da janela operacional de reservas (configurada em até 60 dias pela gestão).

= Validação Cadastral e Integração por CPF com a Base Ativa

== Validação Algorítmica Oficial de CPF

Diferente de formulários convencionais que apenas conferem o número de dígitos digitados, o Kytto implementa o algoritmo aritmético oficial dos *dois dígitos verificadores da Receita Federal do Brasil (Módulo 11)*:

1. O sistema remove qualquer caractere não numérico;
2. Rejeita automaticamente sequências fraudulentas de dígitos repetidos (ex.: `111.111.111-11`);
3. Executa a multiplicação ponderada dos 9 primeiros dígitos e calcula o primeiro verificador;
4. Executa a multiplicação dos 10 primeiros dígitos e calcula o segundo verificador;
5. Caso qualquer cálculo divirja, o sistema sinaliza o erro em vermelho antes do envio da requisição ao servidor.

Esta validação garante que a base de clientes do estabelecimento mantenha-se estritamente saneada e compatível com as obrigações fiscais da empresa (emissão de NFS-e de serviços).

#v(0.8em)
#figure(
  caption: [Formulário de Cadastro com Validação de CPF e Normalização de WhatsApp],
  [
    #image("manual-assets/passo3_cadastro_cpf.png", width: 72%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Registros de Homologação em Produção (Kytto / Dino Barbearia, 2026).]
  ]
)
#v(0.8em)

== Formatação e Máscara Dinâmica de Telefonia Celular (WhatsApp)

O campo de telefone aplica máscara interativa à medida que o cliente digita:
- Até 10 dígitos: formatação padrão residencial/fixo `(00) 0000-0000`;
- 11 dígitos: formatação móvel nacional `(00) 00000-0000`.

Na camada de banco de dados, o número é armazenado de forma canônica com o prefixo internacional `55` e o DDD correspondente, permitindo o acionamento direto do robô inteligente de confirmações e lembretes via WhatsApp Kytto.

== Algoritmo de Deduplicação e Vinculação ao Cadastro Ativo

Ao receber a confirmação do agendamento, o módulo `dino-clientes-vinculo.js` executa a seguinte rotina de integridade referencial:

1. *Busca Primária por CPF:* O sistema pesquisa na tabela de clientes da empresa por correspondência exata do CPF normalizado;
2. *Busca Secundária por Telefone:* Caso não haja registro de CPF, busca por correspondência de WhatsApp/celular;
3. *Cenário A – Cliente já Existente:* O agendamento é vinculado ao `clienteId` já ativo no ERP. Caso a ficha antiga estivesse sem CPF, o sistema atualiza o cadastro com o CPF recém-validado;
4. *Cenário B – Cliente Novo:* É gerado um novo registro na base de clientes com Nome, CPF, WhatsApp, status `ativo` e etiqueta de rastreamento de origem `agendamento_online`.

= Aplicativo Móvel da Equipe (Modo Barbeiro)

== Acesso e Instalação como Web App Progressivo (PWA)

Cada profissional possui credencial individual para operar o seu painel móvel através do endereço:
#align(center)[`https://kytto.com.br/barbeiro`]

O sistema opera com tecnologia PWA, permitindo que o barbeiro adicione o ícone do aplicativo diretamente na tela inicial de seu celular (iOS ou Android) sem necessidade de download na App Store ou Google Play. O app funciona em tela cheia e mantém cache de sincronização mesmo em conexões lentas.

#v(0.8em)
#figure(
  caption: [Tela de Acesso ao Aplicativo Móvel da Equipe (PWA / Modo Barbeiro)],
  [
    #image("manual-assets/app_barbeiro_login.png", width: 68%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Registros de Homologação em Produção (Kytto / Dino Barbearia, 2026).]
  ]
)

== Painel "Meu Link" e Ferramentas de Captação Autônoma

Dentro do aplicativo móvel, o barbeiro dispõe da aba destacada *🔗 Meu Link* (localizada tanto na barra superior de atalhos quanto na navegação de rodapé), que centraliza seus recursos de atração de clientes:

- *Copiar Link:* Copia a URL canônica individual para a área de transferência com um único toque;
- *Enviar no WhatsApp:* Dispara uma mensagem personalizada pelo WhatsApp convidando o cliente a escolher o horário;
- *Textos de Alta Conversão para Redes Sociais:* Roteiros pré-redigidos para publicação imediata na Bio do perfil ou com a figurinha de link nos Stories do Instagram;
- *QR Code de Bancada e Espelho:* Exibição gráfica do QR Code com leitura de alta densidade.

#v(0.8em)
#figure(
  caption: [Painel "Meu Link": Divulgação com 1 Toque, QR Code de Bancada e Redes Sociais],
  [
    #image("manual-assets/painel_meu_link_barbeiro.png", width: 72%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Interface Homologada do Modo Barbeiro (Kytto, 2026).]
  ]
)

== Geração de QR Code e Textos Pré-Formatados para Redes Sociais

Os roteiros embutidos no painel do barbeiro foram formulados sob técnicas de persuasão direta e clareza de chamada para ação (CTA):

*Modelo de Texto para a Bio do Instagram:*
#block(fill: rgb("f8fafc"), stroke: 0.5pt + rgb("cbd5e1"), inset: 12pt, radius: 4pt)[
  #set par(first-line-indent: 0cm)
  ✂️ Agende seu corte ou barba direto comigo pelo link:\
  👉 https://kytto.com.br/agendar/dino/nati
]

*Modelo de Texto para Stories do Instagram (Sticker de Link):*
#block(fill: rgb("f8fafc"), stroke: 0.5pt + rgb("cbd5e1"), inset: 12pt, radius: 4pt)[
  #set par(first-line-indent: 0cm)
  🔥 Horários disponíveis para esta semana! Toque no link abaixo e garanta sua vaga:\
  👉 https://kytto.com.br/agendar/dino/nati
]

== Gestão de Credenciais e Autonomia: Troca de Senha no Aplicativo

Com o objetivo de conferir total autonomia aos profissionais e elevar a segurança dos acessos individuais, o aplicativo móvel disponibiliza a funcionalidade de *Troca de Senha Pessoal*. O recurso pode ser acionado de duas formas no aplicativo:
- Através do botão *🔑 Senha*, localizado diretamente no cabeçalho superior do aplicativo;
- Através da aba *⭐ Perfil*, no painel de Segurança da Conta.

O fluxo de alteração de senha segue um padrão de três etapas consecutivas de validação, mitigando riscos de acessos indevidos e erros de digitação:

1. *Senha Atual:* O profissional informa a sua credencial atual de acesso (por padrão de primeiro acesso, a senha corporativa da equipe), validada criptograficamente no backend;
2. *Nova Senha:* O profissional digita a nova combinação de segurança desejada, respeitando o critério técnico de complexidade mínima de 6 caracteres (com sinalizador visual em tempo real);
3. *Confirmação da Nova Senha:* O profissional redigita a nova senha exatamente igual, recebendo feedback visual imediato de conformidade antes da submissão;
4. *Alternador de Visibilidade:* Todos os três campos contam com botões individuais para exibir ou ocultar os caracteres (ícones de olho/cadeado), facilitando a conferência no celular;
5. *Atualização Instantânea da Sessão:* Após a validação com sucesso, o sistema emite um novo token seguro assinado (JWT) com atualização do registro de auditoria, garantindo que o profissional continue operando sua agenda sem necessidade de deslogar.

#v(0.8em)
#figure(
  caption: [Modal Interativo de Troca de Senha no Aplicativo do Barbeiro (/barbeiro)],
  [
    #image("manual-assets/card_trocar_senha.png", width: 70%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Interface Homologada de Segurança da Equipe (Kytto / Dino Barbearia, 2026).]
  ]
)

== Lançamento de Itens Adicionais e Serviços Extras na Comanda

Durante o atendimento presencial ou ao término do procedimento, cada profissional (a exemplo de Nati, Bruno, Dino, David, etc.) tem autonomia total para lançar itens adicionais e serviços extras na comanda do cliente diretamente pelo celular.

O fluxo de lançamento adicional no aplicativo móvel foi otimizado para conferir máxima agilidade e precisão:

1. *Acesso Rápido ao Atendimento:* Na tela inicial do app, no card de atendimento ativo do cliente, o profissional toca no botão *+ Extra / Produto* (ou no botão flutuante *+ Venda*);
2. *Seleção do Catálogo Integrado:* O sistema carrega instantaneamente os serviços e produtos autorizados para aquela unidade, permitindo busca textual por nome (ex.: Limpeza de Pele, Sobrancelha, Barboterapia, Pomadas, etc.);
3. *Controle Dinâmico de Quantidade:* No carrinho da comanda, o profissional conta com botões interativos de incremento (*+*) e decremento (*−*), além de um campo numérico direto onde pode digitar a quantidade exata vendida (por exemplo: 6 sessões de Limpeza de Pele);
4. *Cálculo em Tempo Real de Subtotais:* O aplicativo calcula o valor unitário e o subtotal em tempo real (ex.: 6 × R\$ 60,00 = R\$ 360,00), exibindo o valor consolidado para conferência antes do envio;
5. *Contabilização Precisa nas Metas e Roleta:* O motor de gamificação do Kytto soma *todas as unidades individuais realizadas*:
  - Se a profissional executou 6 serviços extras em uma única comanda, o sistema credita integralmente *6 serviços extras* ao seu faturamento, ao contador diário de extras, ao ranking da equipe e ao acúmulo semanal do Desafio;
  - Ao atingir a meta diária (ex.: 6 ou 7 extras no dia), o sistema libera imediatamente um *Giro na Roleta de Prêmios Dino* para a profissional girar no próprio app;
6. *Transparência no Painel Administrativo:* No painel gerencial de Metas & Roleta (/admin/barbearia-erp?area=gamificacao), a gestão visualiza o detalhamento por profissional com coluna exclusiva de *Quantidade*, exibição do multiplicador (ex.: _6x de R\$ 60,00 cada_) e soma correta de todos os procedimentos realizados no dia.

Essa funcionalidade elimina retrabalho manual, evita discrepâncias de comissionamento e assegura que nenhuma venda adicional deixe de ser bonificada.

#v(0.8em)
#figure(
  caption: [Lançamento de Múltiplos Serviços Extras com Controle de Quantidade na Comanda Móvel (/barbeiro)],
  [
    #image("manual-assets/print_comanda_multiplos_extras.png", width: 68%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Interface Móvel Homologada de Comandas (Kytto / Dino Barbearia, 2026).]
  ]
)

#v(0.8em)
#figure(
  caption: [Apuração em Tempo Real de Metas Diárias com 6 Extras Computados (86%) e Histórico Detalhado],
  [
    #image("manual-assets/print_metas_extras_nati.png", width: 70%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Central de Metas e Gamificação do Profissional (Kytto / Dino Barbearia, 2026).]
  ]
)

#v(0.8em)
#figure(
  caption: [Painel Gerencial de Auditoria de Metas com Coluna de Quantidade e Detalhamento da Comanda],
  [
    #image("manual-assets/print_admin_detalhes_roleta_nati.png", width: 85%)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Painel Administrativo de Metas & Roleta (Kytto / Dino Barbearia, 2026).]
  ]
)


= Gestão de Caixa, Conferência Padrão AVEC e Procedimentos de Reabertura

== Arquitetura de Fechamento e Conferência de Caixa (Padrão AVEC)

Para garantir paridade funcional e superioridade operacional em relação ao sistema legado AVEC, a plataforma Kytto implementou o painel analítico de fechamento e conferência de caixa. Esse módulo consolida todas as movimentações financeiras da unidade no período selecionado, segregando com rigor contábil os valores em dinheiro, transações eletrônicas de cartão, recebimentos via PIX, créditos utilizados e movimentações em conta.

A interface apresenta o cabeçalho completo de auditoria da unidade, informando o profissional responsável pela operação, e-mail institucional, timestamp exato de abertura e de fechamento, data e responsável pela última modificação, além dos valores iniciais de abertura de numerário físico (dinheiro) e cheques custodiais.

No bloco central, a discriminação de formas de pagamento reproduz a visualização consolidada do padrão AVEC, segregando:
- *Dinheiro:* numerário apurado a partir do fundo de abertura, somado aos recebimentos de comandas e deduzido das sangrias líquidas;
- *Cartão de Crédito com Subagrupamento de Bandeiras:* discrimina o total faturado no crédito e desdobra automaticamente as transações pelas bandeiras autorizadas (MasterCard, Visa, ELO, Hipercard e American Express), exibindo a quantidade de transações entre parênteses;
- *Cartão de Débito com Subagrupamento de Bandeiras:* totaliza o débito eletrônico com abertura por bandeiras (MasterCard, Visa, etc.) e contagem de comprovantes emitidos;
- *Pix:* totalização de recebimentos instantâneos por QR Code dinâmico e estático com conciliação bancária;
- *Outros Meios Custodiais:* Cheque, Boleto, Transferência e Depósito com colunas de valor sistêmico e divergência contada;
- *TOTAL FATURADO:* somatório da receita operacional líquida auferida no período do caixa;
- *Créditos Utilizados e Dívidas (Em Conta):* apuração de abatimentos por pacotes/saldo pré-pago e controle de fiado/saldo devedor.

#figure(
  caption: [Painel de Conferência de Caixa Consolidado no Padrão AVEC com Botão de Reabertura],
  [
    #image("manual-assets/print_caixa_conferencia_avec.png", width: 14cm)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Painel de Operação e Caixa da Barbearia (Kytto / Dino Barbearia, 2026).]
  ]
)

== Drilldown Interativo de Comandas por Meio de Pagamento e Bandeira

Uma das principais inovações implementadas na versão 2026 é a interatividade direta sobre as linhas do relatório financeiro. Ao clicar sobre qualquer forma de pagamento ou sub-bandeira (por exemplo, _Cartão Débito_ ou _MasterCard_), o sistema dispara um modal flutuante de detalhamento analítico (_drilldown_).

Esse modal exibe a lista exata de todas as comandas que compõem aquele montante, trazendo o número da comanda, o nome do cliente atendido, a bandeira correspondente e o valor individual liquidado, totalizando no rodapé o valor exato conciliado com o extrato.

#figure(
  caption: [Detalhamento (Drilldown) de Comandas Vinculadas por Meio de Pagamento e Bandeira],
  [
    #image("manual-assets/print_caixa_drilldown_comandas.png", width: 13.5cm)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Modal de Drilldown de Comandas por Forma de Pagamento (Kytto / Dino Barbearia, 2026).]
  ]
)

== Procedimento Oficial de Reabertura de Caixa e Correção de Lançamentos

Na rotina operacional de um estabelecimento movimentado, é comum ocorrerem equívocos no momento do registro do pagamento na comanda — por exemplo, registrar um pagamento no *Cartão de Débito* quando o cliente efetuou o pagamento no *Cartão de Crédito* ou *PIX*.

No sistema Kytto, o caixa fechado é protegido contra alterações indevidas. No entanto, para corrigir distorções sem recorrer a cancelamentos destrutivos ou retrabalho contábil, foi disponibilizado o procedimento formal de *Reabertura de Caixa*:

+ *Identificação da Necessidade:* A recepção ou gerência localiza o caixa do dia no painel operacional ou no Relatório de Caixas Fechados.
+ *Acionamento do Botão Reabrir:* Ao final do card de conferência do caixa fechado, clica-se no botão vermelho destacado #strong[🔓 Reabrir Caixa].
+ *Justificativa e Confirmação:* Uma janela de confirmação solicita o motivo da reabertura (ex.: _"Cliente pagou no crédito e foi registrado como débito"_). Ao confirmar, o sistema altera o status do caixa de #text(fill: rgb("#64748b"))[*Fechado*] para #text(fill: rgb("#16a34a"))[*Aberto*] e grava um registro de auditoria imutável no histórico do banco de dados.
+ *Edição da Forma de Pagamento:* Com o caixa aberto, o operador clica na linha da forma de pagamento divergente no painel AVEC para abrir o drilldown, localiza a comanda desejada e aciona o botão #strong[✏️ Corrigir]. Seleciona-se o meio de pagamento correto (ex.: Cartão Crédito) e a bandeira (ex.: MasterCard ou ELO) e clica-se em *Salvar Alteração*.
+ *Conciliação Automática:* O sistema recalcula instantaneamente os totais por meio, reajusta as movimentações de dinheiro físico (se envolver numerário) e atualiza a comanda do cliente.
+ *Novo Fechamento do Caixa:* Após as devidas correções, o operador informa o valor físico contado e confirma o fechamento formal do caixa, registrando o encerramento do turno sem qualquer divergência pendente.

== Emissão e Estrutura do Relatório Oficial de Fechamento de Caixa

Para fins de prestação de contas físicas, conferência com a maquininha POS/TEF e envio à contabilidade, o sistema disponibiliza a emissão do *Relatório Oficial de Fechamento de Caixa*, acessível a qualquer momento por meio do botão #strong[🖨️ Imprimir Relatório].

O relatório segue o padrão documental exigido pelas redes de franquias e salões premium, apresentando:
+ *Cabeçalho Institucional:* Razão social (Dino barbearia), data e hora de impressão em precisão de segundos, e título do documento.
+ *Metadados Operacionais:* Nome e e-mail do operador responsável, horários de abertura e fechamento, fundo de abertura e dados da última modificação.
+ *Demonstrativo de Sangrias e Suprimentos:* Relação de saídas e entradas avulsas de numerário registradas no turno.
+ *Quadro Resumo de Total em Caixa:* Totalização por forma de pagamento e detalhamento vertical de cada bandeira de cartão transacionada, culminando no Total Faturado.
+ *Relação Analítica de Comandas e Clientes:* Tabela discriminando todas as comandas vinculadas ao caixa, contendo a Forma de Pagamento com a respectiva bandeira (ex.: _Cartão Crédito ELO_, _Cartão Crédito MasterCard_, _Cartão Débito MasterCard_, _Pix_, _Crédito Utilizado_), a descrição da comanda com o nome do cliente e o valor transacionado.

#figure(
  caption: [Relatório Oficial Impresso de Fechamento de Caixa e Conciliação Financeira],
  [
    #image("manual-assets/print_caixa_relatorio_fechamento_oficial.png", width: 13cm)
    #v(0.3em)
    #text(size: 9pt)[Fonte: Relatório Impresso de Fechamento de Caixa (Kytto / Dino Barbearia, 2026).]
  ]
)

= Diretrizes Operacionais de Marketing e Divulgação Multicanal

== Boas Práticas para o Instagram (Bio e Stories)

Para transformar o perfil social do barbeiro em um gerador recorrente de faturamento, a gestão deve assegurar a execução das seguintes rotinas diárias:

1. *Fixação Perpétua na Bio:* O link individual deve ocupar o campo oficial de "Site" ou "Links" do perfil do profissional no Instagram, acompanhado de chamada clara (ex.: *"Agende online 24h"*);
2. *Abertura de Agenda nos Stories da Manhã:* Diariamente, entre 08h e 09h, o barbeiro deve publicar um Story mostrando sua bancada ou trabalhos recentes, inserindo a figurinha de link com o texto de chamada atrativo;
3. *Destaques Fixos "Agende Aqui":* Manter um álbum de Stories fixados nos destaques do perfil, demonstrando em vídeo como é simples escolher o serviço e o horário pelo link.

== Comunicação Ativa via WhatsApp e Status

1. *Mensagem Automática no WhatsApp Business:* Configurar mensagem de saudação informando: *"Olá! Para consultar os horários vagos e agendar seu atendimento agora mesmo, toque no meu link direto: [Link]"*;
2. *Publicação no Status do WhatsApp:* Compartilhar o link 2 a 3 vezes por semana no Status, especialmente às quartas, quintas e sextas-feiras, períodos de maior procura para o final de semana.

== Pontos de Contato Físicos: Bancadas, Espelhos e Balcão

O momento mais propício para retenção do cliente é o término do atendimento. O barbeiro deve orientar o cliente a aproximar a câmera do celular no QR Code fixado no canto do espelho e já assegurar o agendamento do corte seguinte para dali a 15 ou 20 dias, garantindo taxa de retorno superior a 80%.

= Diretório Oficial de Links Canônicos de Agendamento

A Tabela 2 relaciona os endereços oficiais e homologados para publicação imediata pelas equipes da Dino Barbearia & Perfumaria e estabelecimentos parceiros:

#v(0.8em)
#figure(
  caption: [Diretório Oficial de Links Canônicos de Agendamento por Profissional],
  [
    #table(
      columns: (4.5cm, 3.5cm, 7.5cm),
      stroke: 0.5pt + luma(120),
      fill: (col, row) => if row == 0 { rgb("f0f2f5") } else { none },
      align: (left + horizon, left + horizon, left + horizon),
      [#text(weight: "bold", size: 9pt)[Nome do Profissional]],
      [#text(weight: "bold", size: 9pt)[Papel / Especialidade]],
      [#text(weight: "bold", size: 9pt)[URL Canônica de Agendamento Online]],

      [Natani Minanis (Nati)], [Barbeira Especialista], [https://kytto.com.br/agendar/dino/nati],
      [Bruno Mendes], [Barbeiro & Barba], [https://kytto.com.br/agendar/dino/bruno],
      [Dino (Fundador)], [Master Barber], [https://kytto.com.br/agendar/dino/dino],
      [Ester Oliveira], [Estética & Manicure], [https://kytto.com.br/agendar/dino/ester],
      [João Victor Domingos], [Barbeiro & Cortes], [https://kytto.com.br/agendar/dino/joao-victor-domingos-ruedel],
      [David Kauã], [Barbeiro], [https://kytto.com.br/agendar/dino/david],
      [Amanda Gabrielly], [Barbeira], [https://kytto.com.br/agendar/dino/amanda],
      [Equipe Completa (Geral)], [Página da Unidade], [https://kytto.com.br/agendar/dino]
    )
    #v(0.3em)
    #text(size: 9pt)[Fonte: Plataforma Kytto – Produção Oficial (Novembro/2026).]
  ]
)
#v(0.8em)

= Plano de Contingência, Suporte e Considerações Finais

== Procedimentos de Diagnóstico e Continuidade Operacional

Caso ocorra qualquer instabilidade na rede local do estabelecimento ou no dispositivo do cliente, aplicam-se os seguintes procedimentos:

1. *Indisponibilidade Temporária de Conexão no Celular:* O cliente pode acionar o autoatendimento ligando diretamente para o WhatsApp da barbearia, onde o atendente Kytto reserva o horário pelo ERP da recepção;
2. *Limpeza de Cache do Navegador:* Se o cliente relatar visualização de versões antigas, basta recarregar a página ou acessar em aba anônima;
3. *Auditoria de Agendamentos:* Todas as transações geram logs de auditoria no servidor PostgreSQL, permitindo reconstituição de histórico em caso de divergência.

== Canais de Escalonamento e Considerações Finais

O suporte técnico de 2º e 3º níveis é mantido pela equipe de engenharia da Kytto Tecnologia:
- *Canal de Suporte Operacional:* `contato@kytto.com.br` / Central Administrativa Kytto;
- *Gestão do Projeto:* Rodrigo Gonçalves;
- *Ambiente de Produção:* Monitorado 24 horas por telemetria em nuvem.

A implantação do Agendamento Online por Barbeiro com Catálogo Inteligente consolida um padrão de atendimento de excelência técnica e comercial, unindo inovação, respeito à privacidade dos clientes e autonomia para os profissionais da beleza.

#pagebreak()

// =============================================================================
// ELEMENTOS PÓS-TEXTUAIS
// =============================================================================

#align(center)[#text(size: 13pt, weight: "bold")[REFERÊNCIAS]]
#v(1.5em)

#set par(first-line-indent: 0cm, leading: 0.7em)

ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. *NBR 6023*: Informação e documentação – Referências – Elaboração. Rio de Janeiro: ABNT, 2018.
\ \
ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. *NBR 6024*: Informação e documentação – Numeração progressiva das seções de um documento escrito – Apresentação. Rio de Janeiro: ABNT, 2012.
\ \
ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. *NBR 6027*: Informação e documentação – Sumário – Apresentação. Rio de Janeiro: ABNT, 2012.
\ \
ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. *NBR 10719*: Informação e documentação – Relatório técnico e/ou científico – Apresentação. Rio de Janeiro: ABNT, 2015.
\ \
ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. *NBR 14724*: Informação e documentação – Trabalhos acadêmicos – Apresentação. Rio de Janeiro: ABNT, 2011.
\ \
BRASIL. *Lei nº 13.709, de 14 de agosto de 2018*. Lei Geral de Proteção de Dados Pessoais (LGPD). Brasília, DF: Presidência da República, 2018. Disponível em: http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm. Acesso em: 03 nov. 2026.
\ \
KYTTO TECNOLOGIA E SISTEMAS. *Documentação de Arquitetura e Engenharia de Software Kytto ERP*. Tangará da Serra: Kytto S.A., 2026.

#pagebreak()

#align(center)[#text(size: 13pt, weight: "bold")[ANEXO A – CHECK-LIST DE HOMOLOGAÇÃO OPERACIONAL DO BARBEIRO]]
#v(1.5em)

#set par(first-line-indent: 0cm)

#table(
  columns: (1.5cm, 10.5cm, 3.5cm),
  stroke: 0.5pt + luma(120),
  fill: (col, row) => if row == 0 { rgb("f0f2f5") } else { none },
  align: (center + horizon, left + horizon, center + horizon),
  [#text(weight: "bold", size: 10pt)[Item]],
  [#text(weight: "bold", size: 10pt)[Critério de Verificação Operacional]],
  [#text(weight: "bold", size: 10pt)[Status]],

  [1], [O link individual do barbeiro carrega com seu nome, foto e especialidade no cabeçalho.], [[ X ] Conforme],
  [2], [O catálogo de serviços exibe unicamente os serviços realizados por aquele barbeiro.], [[ X ] Conforme],
  [3], [Serviços exclusivos de outros barbeiros não aparecem na listagem do profissional.], [[ X ] Conforme],
  [4], [A grade de horários exibe estritamente o estado binário Livre ou Ocupado.], [[ X ] Conforme],
  [5], [Nenhum dado pessoal (nome ou telefone de outros clientes) é transmitido na API.], [[ X ] Conforme],
  [6], [O formulário exige preenchimento de nome completo, CPF e telefone WhatsApp com DDD.], [[ X ] Conforme],
  [7], [CPFs com dígitos verificadores matematicamente incorretos são bloqueados pelo sistema.], [[ X ] Conforme],
  [8], [Ao confirmar, o agendamento vincula-se ao cadastro existente do cliente na base Kytto.], [[ X ] Conforme],
  [9], [Clientes novos recebem cadastro ativo imediato com origem "agendamento_online".], [[ X ] Conforme],
  [10], [O aplicativo móvel da equipe (/barbeiro) permite copiar link e texto de divulgação.], [[ X ] Conforme],
  [11], [O QR Code de bancada gerado direciona para o link individual com leitura rápida.], [[ X ] Conforme]
)

#v(2.0em)

#align(center)[
  #text(size: 10pt, weight: "bold")[Termo de Homologação Conclusiva]\
  #v(0.5em)
  #text(size: 10pt)[Declaramos que todos os itens acima foram testados, validados e homologados em ambiente real de produção da Dino Barbearia & Perfumaria em 03 de novembro de 2026.]\
  #v(1.5em)
  #text(size: 10pt, weight: "bold")[Rodrigo Gonçalves & Equipe de Engenharia Kytto]
]
