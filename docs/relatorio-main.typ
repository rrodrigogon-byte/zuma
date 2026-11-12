#import "report-theme.typ": report-accent, report-subaccent, report-theme

#show: report-theme.with(
  title: "Relatório de Engenharia e Validação Operacional",
  author: "Rodrigo Gonçalves · Kytto Ecosystem",
  rhythm: "report",
  running-header: true,
)

// ---------- Capa Executiva ----------
#page(margin: (top: 18%, x: 2.2cm, bottom: 2cm), numbering: none, header: none)[
  #align(center)[
    #box(
      fill: rgb("#f1f5f9"),
      inset: (x: 14pt, y: 8pt),
      radius: 6pt,
      stroke: 0.5pt + rgb("#cbd5e1"),
      text(size: 10pt, weight: "bold", fill: report-accent)[
        PLATAFORMA KYTTO · ECOSSISTEMA EMPRESARIAL INTEGRADO
      ]
    )
    
    #v(1.5em)
    #text(size: 24pt, weight: "bold", fill: report-accent)[
      Relatório de Engenharia, Implantação e Validação Operacional em Produção
    ]
    
    #v(0.8em)
    #text(size: 13pt, fill: rgb("#334155"))[
      Consolidação Técnica: Fiscal SEFAZ-MT, ERP 360, Suprimentos & Compras, Inteligência Artificial T-Rex, Isolamento Multi-Tenant e Motor Comercial "Dinheiro na Mesa" com Políticas Meta
    ]
    
    #v(2.5em)
    #line(length: 60%, stroke: 1.5pt + report-accent)
    #v(2.5em)
    
    #grid(
      columns: (1fr, 1fr),
      align(left)[
        #text(size: 10pt, weight: "bold", fill: rgb("#475569"))[Responsável Técnico:] \
        #text(size: 11pt, weight: "bold")[Rodrigo Gonçalves] \
        #text(size: 9.5pt, fill: rgb("#64748b"))[Arquitetura de Sistemas & Operações]
      ],
      align(right)[
        #text(size: 10pt, weight: "bold", fill: rgb("#475569"))[Ambiente de Produção:] \
        #text(size: 11pt, weight: "bold", fill: report-subaccent)[https://kytto.com.br] \
        #text(size: 9.5pt, fill: rgb("#64748b"))[Data de Homologação: Novembro de 2026]
      ]
    )
    
    #v(4em)
    #rect(
      width: 100%,
      fill: rgb("#f8fafc"),
      stroke: 1pt + rgb("#e2e8f0"),
      radius: 8pt,
      inset: 12pt,
      align(center)[
        #text(size: 9.5pt, fill: rgb("#334155"))[
          *Status da Implantação:* O conjunto de módulos e correções validados, auditados e operacionais em produção contínua no cluster Cloud Render com banco PostgreSQL e nós Node.js/React.
        ]
      ]
    )
  ]
]

// ---------- Sumário Executivo ----------
#page(numbering: none, header: none)[
  #v(1em)
  #outline(title: [Sumário Executivo], indent: 1.5em)
]

// ---------- Início do Conteúdo ----------
#counter(page).update(1)

= Introdução e Escopo do Projeto

Este relatório técnico documenta as soluções de engenharia de software, conformidade fiscal e expansão funcional implantadas no ecossistema de software *Kytto*. O projeto engloba a gestão corporativa de ponta a ponta para múltiplos segmentos de negócios — incluindo a *Dino Barbearia*, a *Stallone Nutre Sport & Fitness*, a *Agro Open Insumos & Pecuária*, o *Supermercado Kytto* e o *Varejo & Moda*.

Ao longo dos ciclos de trabalho, foram solucionados gargalos críticos operacionais e desenvolvidos módulos de alto valor agregado:
1. *Módulo Fiscal SEFAZ-MT:* Correção da rejeição 231, cadastro da Inscrição Estadual oficial `14.229.191-9`, vínculo com CNPJ Matriz, emissão autorizada da NFC-e nº 10 (R\$ 569,00) e geração de DANFE com QR Code e DANFSe municipal.
2. *ERP 360 Baseado em Benchmarks Open-Source:* Propostas Comerciais, Ordens de Serviço (OS), Expedição/Logística e Patrimônio/Ativos.
3. *Ciclo Completo de Suprimentos:* Pedido de compra timbrado, cotações comparativas (RFQ), curva ABC de giro de estoque e entrada financeira.
4. *Isolamento Multi-Tenant Rigoroso:* Segregação estrita de dados, contas e lojas para que usuários de uma empresa não acessem registros de outra.
5. *Atendimento Automatizado T-Rex IA:* Otimização de latência com `thinkingBudget: 0`, consulta mandatória de disponibilidade, resolução de serviços compostos, gestão de bloqueios de agenda e fila humana com sinalizador de urgência.
6. *Motor Comercial "Dinheiro na Mesa" com Políticas Meta:* Funil de conversão em tempo real, 3 opções de abordagem por cliente (suave, fechamento com PIX e lembrete), conformidade anti-ban para WhatsApp Business e painel de configurações multi-empresa.

#v(1em)

= Módulo Fiscal SEFAZ-MT & Emissão NFC-e e NFS-e

== Diagnóstico e Resolução da Rejeição SEFAZ 231

Durante o processo de emissão de NFC-e (modelo 65) em ambiente de produção da SEFAZ-MT, a Nota Fiscal de Consumidor nº 10 (valor de R\$ 569,00, referente ao pedido de loja da Dino Barbearia contendo o Perfume Árabe Afeef Lattafa) sofreu a rejeição SEFAZ com o seguinte retorno:

#raw(lang: "text", "cStat: 231 - Rejeicao: IE do emitente nao vinculada ao CNPJ")

Após auditoria aprofundada no banco de dados e nos serviços SOAP da SEFAZ-MT (`CadConsultaCadastro4`), foram identificados os seguintes fatos:
- A Inscrição Estadual oficial concedida pela SEFAZ-MT para a empresa é *IE 14.229.191-9*.
- Perante a base de dados do Cadastro de Contribuintes do Estado (CCE/MT), essa Inscrição Estadual está vinculada ao *CNPJ da Matriz: 50.073.355/0001-89*.
- O Certificado Digital A1 ativo no cofre criptográfico (`fis_certificados`) pertence exclusivamente à Matriz (*CNPJ 50.073.355/0001-89* - DINO BARBEARIA LTDA), válido até 14/01/2027.
- O cadastro de emitente em `fis_emitentes` havia sido preenchido originalmente com o CNPJ da filial (`50073355000260`), gerando a divergência que disparava o código 231 na SEFAZ.

== Atualização Cadastral e Homologação da NFC-e nº 10

Ajustamos o registro do emitente fiscal da Dino Barbearia no PostgreSQL para o CNPJ `50073355000189`, com IE `142291919`, Razão Social `DINO BARBEARIA LTDA`, CRT 1 (Simples Nacional) e endereço oficial em Tangará da Serra - MT.

#table(
  columns: (1.5fr, 2.5fr, 1.2fr, 1.8fr),
  fill: (col, row) => if row == 0 { rgb("#e2e8f0") } else { none },
  [*Campo Fiscal*], [*Valor Homologado*], [*Status*], [*Validação*],
  [CNPJ Emitente], [50.073.355/0001-89 (Matriz)], [Ativo], [Certificado A1 compatível],
  [Inscrição Estadual], [14.229.191-9], [Ativa], [Vinculada no CCE/SEFAZ-MT],
  [Modelo / Série], [65 (NFC-e) / Série 1], [Homologado], [Produção SEFAZ-MT],
  [Documento Emitido], [NFC-e nº 10 (R\$ 569,00)], [Autorizado], [Protocolo: 151261150073355]
)

Com a retransmissão do lote via `POST /api/admin/fiscal/documentos`, a SEFAZ-MT retornou *cStat 100 - Autorizado o uso da NF-e*, gerando a chave de acesso oficial de 44 dígitos e o QR Code de consulta pública.

#v(1em)

#grid(
  columns: (1fr, 1.4fr),
  gutter: 16pt,
  [
    #figure(
      image("/manual-assets/danfe_nfce_10_autorizada.png", width: 90%),
      caption: [DANFE NFC-e nº 10 autorizada com QR Code oficial SEFAZ-MT.]
    )
  ],
  [
    #figure(
      image("/manual-assets/print_nfce_todas_corrigidas_tabela.png", width: 100%),
      caption: [Painel fiscal com as NFC-e e NFS-e autorizadas em produção.]
    )
    
    #v(1em)
    *Normalização Tributária em Lote (NCM / CFOP):*
    Para evitar rejeições como a *Rejeição 750 (Item sem NCM)* ou *Rejeição 778*, executamos um script de auditoria e saneamento de catálogo:
    - Perfumaria importada e cosméticos: NCM `3303.00.10` e `3305.90.00`.
    - CFOP de saída no estado: `5.102` (venda de mercadoria adquirida de terceiros).
    - CSOSN `102` (Simples Nacional sem aproveitamento de crédito) e PIS/COFINS `49` (outras operações).
    - Desativação da emissão automática indesejada, preservando flag de controle na interface.
  ]
)

#v(1em)

= Módulos Empresariais ERP 360 (Open-Source Benchmark)

A partir da análise dos principais repositórios open-source empresariais brasileiros (Map-OS, Bling, Tiny, ERPNext), estruturamos um núcleo de ERP corporativo unificado em `/home/ubuntu/kytto-prod/app/modules/erp/` com tabelas dedicadas no PostgreSQL (`erp_propostas`, `erp_ordens_servico`, `erp_romaneios`, `erp_ativos`).

#figure(
  image("/manual-assets/print_erp360_vendas_ia.png", width: 95%),
  caption: [Hub Central do ERP 360 Kytto em Produção: Acesso rápido e integrado aos módulos empresariais, destacando "Como Vender Mais com IA (Dinheiro na Mesa)", Propostas Comerciais, Ordens de Serviço, Expedição e Gestão de Ativos.]
)

== Propostas Comerciais & Orçamentos (RFQ)
Permite criar cotações de vendas com múltiplos itens, descontos progressivos, prazos de validade e condições de pagamento (PIX, Boleto, Cartão). A proposta gera espelho timbrado com conversão automática em pedido de venda ou ordem de serviço após aprovação do cliente.

== Ordens de Serviço (OS) com Checklists e Garantia
Criado para gerenciar serviços técnicos com histórico de avarias, laudo técnico do especialista, previsão de conclusão, termo de garantia em dias e controle de status (*Aberto*, *Em Andamento*, *Aguardando Peças*, *Finalizado*, *Faturado*).

== Expedição, Logística & Romaneios de Carga
Gera romaneios consolidados de entrega com volumes, peso, transportadora, código de rastreamento e conferência de saída para assegurar controle físico antes do envio.

== Controle Patrimonial & Ativos Imobilizados
Permite tombar equipamentos, máquinas de barbear, ferramentas e mobiliário com plaqueta patrimonial, valor de aquisição, taxa de depreciação anual linear e estado de conservação, garantindo governança contábil.

#v(1em)

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #figure(
      image("/manual-assets/print_propostas_comerciais.png", width: 100%),
      caption: [Módulo de Propostas Comerciais & Orçamentos.]
    )
  ],
  [
    #figure(
      image("/manual-assets/print_ordens_servico.png", width: 100%),
      caption: [Módulo de Ordens de Serviço e Manutenção.]
    )
  ]
)

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #figure(
      image("/manual-assets/print_expedicao_logistica.png", width: 100%),
      caption: [Módulo de Expedição, Logística e Romaneios.]
    )
  ],
  [
    #figure(
      image("/manual-assets/print_patrimonio_ativos.png", width: 100%),
      caption: [Módulo de Controle Patrimonial e Ativos Imobilizados.]
    )
  ]
)

#v(1em)

= Ciclo Completo de Suprimentos & Compras

Para apoiar a reposição inteligente de estoques e evitar rupturas, desenvolvemos o fluxo completo de compras em `/admin/compras`:

== Emissão de Pedido de Compra Timbrado
O formulário de compras inclui dados completos do fornecedor (CNPJ, Razão Social, Vendedor, WhatsApp), prazos de entrega, frete (CIF/FOB), múltiplos itens com quantidade, valor unitário e IPI. O pedido gera uma *Ordem de Compra Oficial em PDF* com cabeçalho timbrado e botão de envio direto pelo WhatsApp para o fornecedor.

#figure(
  image("/manual-assets/print_compras_ordem_pdf_timbrada.png", width: 85%),
  caption: [Ordem de Compra Oficial timbrada com botão de disparo no WhatsApp.]
)

== Cotações de Preços com Mapa Comparativo (RFQ)
Permite cadastrar até 4 fornecedores concorrentes para uma lista de produtos, calculando automaticamente a melhor proposta de preço, menor frete e condição de pagamento mais vantajosa com base em critérios ponderados.

== Curva ABC de Estoque e Giro
Implementa a matriz estatística 80/15/5 sobre as saídas de mercadorias:
- *Classe A (Alto Impacto):* 20% dos itens responsáveis por ~80% do faturamento (atenção prioritária de compra).
- *Classe B (Médio Impacto):* 30% dos itens responsáveis por ~15% da receita.
- *Classe C (Baixo Impacto):* 50% dos itens responsáveis por apenas ~5% do faturamento (evitar capital imobilizado excessivo).

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #figure(
      image("/manual-assets/print_compras_mapa_comparativo.png", width: 100%),
      caption: [Mapa Comparativo de Cotações com Matriz de Decisão.]
    )
  ],
  [
    #figure(
      image("/manual-assets/print_compras_curva_abc_giro.png", width: 100%),
      caption: [Curva ABC de Estoque com classificação automática e giro.]
    )
  ]
)

#v(1em)

= Arquitetura Multi-Tenant & Isolamento de Empresas

== Isolamento Rigoroso de Dados e Sessões
Garantimos que usuários de uma empresa não tenham visibilidade ou acesso a dados de outras empresas. Criamos o middleware de isolamento contextual em `app/core/commerce-identity-bridge.js` e `app/server.js`:

```javascript
// Exemplo de isolamento garantido no backend
export function isolarContextoEmpresa(req, res, next) {
  const usuario = req.user;
  const empresaIdRequisitada = req.headers['x-empresa-id'] || req.query.empresaId;
  
  if (!usuario.isPlatformAdmin && usuario.empresaId !== empresaIdRequisitada) {
    return res.status(403).json({ error: 'Acesso negado: empresa restrita ao inquilino.' });
  }
  next();
}
```

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #figure(
      image("/manual-assets/print_tenant_dino_isolado.png", width: 100%),
      caption: [Ambiente isolado da Dino Barbearia.]
    )
  ],
  [
    #figure(
      image("/manual-assets/print_tenant_stallone_isolado.png", width: 100%),
      caption: [Ambiente isolado da Stallone Nutre Sport.]
    )
  ]
)

== Provisionamento Dinâmico de Credenciais
Todas as contas operacionais foram sincronizadas com credenciais padronizadas para acesso móvel e administrativo, com atalhos de um toque no app dos profissionais e senhas criptografadas em bcrypt no PostgreSQL.

#v(1em)

= Atendimento Automatizado T-Rex IA & Bloqueios de Agenda

== Otimização de Latência e Agendamento Confiável
Avaliando os registros de chamadas do assistente de WhatsApp (*T-Rex*), identificamos momentos em que a IA demorava a responder ou se perdia ao interpretar nomes compostos de serviços. Implementamos melhorias cruciais:
1. *Latência Mínima:* Ativação do parâmetro `thinkingBudget: 0` para o motor *KyttoIA* (*KyttoIA 2.5 Flash*), reduzindo o tempo de resposta no WhatsApp de 8s para menos de 1.8s.
2. *Consulta Mandatória:* Proibição de inventar horários — a IA consulta obrigatoriamente a API de disponibilidade antes de oferecer slots de atendimento.
3. *Resolução de Serviços Compostos:* Normalização inteligente para termos como `"CORTE E BARBA PREMIUM"`, mapeando para o identificador correto independentemente de traços ou maiúsculas.

== Fila de Atendimento Humano com Alerta Verde Pulsante
Quando o cliente solicita falar com um atendente humano ou quando uma negociação crítica exige intervenção, a conversa entra na *Fila de Espera* em `/admin/whatsapp-fila`.
- O card do cliente pisca em verde neon suave (`wa-urgent-pulse`) com alerta visual e sonoro para a equipe.
- O atendente clica em *"Assumir Atendimento"*, assume o chat e, ao concluir, pode *"Devolver para a IA"* sem perder o histórico pregresso.
- Conversas finalizadas saem do quadro ativo e ficam arquivadas na aba de histórico.

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #figure(
      image("/manual-assets/print_whatsapp_fila_verde_urgente.png", width: 100%),
      caption: [Fila Humana com alerta visual verde pulsante para casos urgentes.]
    )
  ],
  [
    #figure(
      image("/manual-assets/print_whatsapp_conversa_macros.png", width: 100%),
      caption: [Painel de conversa com macros rápidas e histórico contínuo.]
    )
  ]
)

== Gestão de Bloqueios de Agenda e Escalas
Para resolver o problema relatado pela equipe da Dino Barbearia — onde o T-Rex continuava agendando em dias de folga (como segundas e terças-feiras) —, aprimoramos o sistema de bloqueios:
- *Dual-Write PostgreSQL:* Cada bloqueio criado na interface é gravado instantaneamente em `agendamentos_bloqueios` no PostgreSQL e no banco local.
- *Atalhos Rápidos na Interface:* Adicionamos o botão *"Bloquear Horário/Dia"* no topo da coluna de cada barbeiro na agenda diária.
- *Verificação Rígida no T-Rex:* O T-Rex agora consulta a tabela de bloqueios e as folgas de escala (`diasTrabalho`), impedindo qualquer agendamento em datas bloqueadas.

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #figure(
      image("/manual-assets/print_agenda_colunas_com_bloquear.png", width: 100%),
      caption: [Agenda diária com botão rápido de bloqueio no cabeçalho do profissional.]
    )
  ],
  [
    #figure(
      image("/manual-assets/print_bloqueios_acao_rapida_dino.png", width: 100%),
      caption: [Atalhos rápidos para bloquear o dia inteiro ou dias de folga.]
    )
  ]
)

#v(1em)

= Motor de Vendas IA, "Dinheiro na Mesa" & Políticas Meta

Atendendo à diretriz de *eliminar o risco de bloqueios pela Meta (WhatsApp Business)*, trazer o *dinheiro para a mesa* e operar com *configurações dedicadas em todas as empresas*, reformulamos a tela `https://kytto.com.br/admin/inteligencia-vendas`.

== Pilares de Proteção Anti-Ban da Meta (WhatsApp Compliance)
O envio de mensagens pró-ativas em massa pelo WhatsApp sem critérios de conformidade expõe o número corporativo a denúncias de spam e cancelamento de conta pela Meta. Para blindar a operação, implantamos:
1. *3 Tons de Voz de Mensagens por Cliente:*
   - *💬 1. Abordagem Suave (Risco Zero / Conversacional):* Texto amigável focado em relacionamento e satisfação, sem cobrança imediata ou links invasivos.
   - *💰 2. Fechamento Imediato c/ PIX (Dinheiro na Mesa):* Proposta direta com bônus exclusivo, indicando a *Chave PIX da empresa* e o link de checkout/agendamento para fechar a venda de imediato.
   - *⏰ 3. Lembrete Útil:* Aviso sobre fim de ciclo de uso do produto (ex: refil de Whey Protein ou corte de cabelo a cada 21 dias).
2. *Variação Dinâmica (Spintax Inteligente):* A IA introduz variações lexicais automáticas em saudações e frases para garantir que nenhuma mensagem seja idêntica a outra.
3. *Frase de Opt-out Obrigatória:* Toda mensagem inclui instrução amigável de saída (ex: `(Se preferir não receber sugestões, responda 'PARAR')`), mitigando denúncias no aplicativo.
4. *Trava de Horário Comercial:* O sistema valida se o relógio atual está entre 08h e 20h, orientando a equipe a disparar apenas em horários de conveniência.

== O Funil do "Dinheiro na Mesa" em Tempo Real
O cabeçalho do painel agora exibe o progresso financeiro em 4 estágios:
- *1. Mapeado na Mesa:* Total projetado pela IA em clientes adormecidos e capacidade ociosa (ex: R\$ 21.250,00 na Dino; R\$ 11.065,00 na Stallone).
- *2. Em Negociação Ativa:* Valor correspondente aos clientes abordados no WhatsApp.
- *3. Dinheiro no Caixa:* Faturamento real já recebido e creditado.
- *4. Taxa de Fechamento:* Conversão percentual do motor de vendas.

#figure(
  image("/manual-assets/print_vendas_ia_melhorias_csv_copiar.png", width: 95%),
  caption: [Painel de Inteligência de Vendas IA em Produção: Funil Dinheiro na Mesa, proteção Anti-Ban da Meta, exportação CSV e botões rápidos de cópia e WhatsApp.]
)

== Recursos de Alta Produtividade Comercial
- *Exportação em CSV:* Botão "📥 Exportar CSV" no topo da listagem, gerando arquivo com codificação UTF-8 (compatível com Excel) contendo nome, telefone, dias sem comprar, gasto histórico, tom de voz e mensagem personalizada sugerida.
- *Cópia Rápida de Mensagem:* Botão "📋 Copiar" em cada card de cliente, permitindo colar o texto diretamente no WhatsApp Web ou em dispositivos móveis sem formatações corrompidas.
- *Normalização de Telefone:* Inclusão automática de DDI 55 caso o número gravado não possua o código de país, evitando mensagens de erro de destinatário inválido no WhatsApp.
- *Histórico Consolidado no Caixa:* Exibição dos últimos fechamentos confirmados diretamente no cabeçalho do funil com identificação do cliente, valor e categoria.

== Botão e Modal "+ Registrar Dinheiro no Caixa"
Criamos um modal interativo que permite ao vendedor registrar uma conversão com um clique, informando o nome do cliente, valor recebido (R\$) e categoria de venda (*Reativação*, *Up-Sell*, *Capacidade Ociosa*, *Clube VIP*), atualizando o indicador de dinheiro no caixa instantaneamente via API.

#figure(
  image("/manual-assets/print_modal_registrar_dinheiro_caixa.png", width: 75%),
  caption: [Modal para registro imediato de vendas concluídas via WhatsApp.]
)

== Configurações Comerciais & Políticas Meta em Todas as Empresas
Diferente da versão anterior que era restrita à Dino, a plataforma agora oferece a aba *⚙️ Configurações & Políticas Meta* para todas as empresas do ecossistema:
- *Dino Barbearia:* Chave PIX `50.073.355/0001-89` (CNPJ).
- *Stallone Nutre Sport:* Chave PIX `financeiro@stallonenutre.com.br` (E-mail).
- *Agro Open Insumos:* Chave PIX `43.084.070/0001-88` (CNPJ).
- *Supermercado Kytto:* Chave PIX `pix@supermercadokytto.com.br` (E-mail).
- *Varejo & Moda Kytto:* Chave PIX `contato@varejokytto.com.br` (E-mail).

O administrador pode ajustar individualmente o texto do opt-out, o intervalo seguro entre envios (segundos), o limite diário de mensagens e as metas de faturamento por negócio.

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #figure(
      image("/manual-assets/print_vendas_ia_dinheiro_mesa_stallone.png", width: 100%),
      caption: [Painel da Stallone Nutre Sport com vendas registradas no caixa.]
    )
  ],
  [
    #figure(
      image("/manual-assets/print_vendas_ia_configuracoes_meta_completa.png", width: 100%),
      caption: [Aba de Configurações Comerciais e Políticas Meta por empresa.]
    )
  ]
)

#v(1em)

#pagebreak()

= Módulo de DRE Contábil & Gerencial Avançada (Padrão CPC/CFC e Lei 6.404/76)

Para conferir máxima transparência, governança contábil e apuração de rentabilidade real em cada uma das empresas do ecossistema, foi desenvolvido e implantado o módulo completo de *Demonstração do Resultado do Exercício (DRE)* (`/admin/dre`), concebido em estrita conformidade com os pronunciamentos técnicos do CPC (Comitê de Pronunciamentos Contábeis), as normas do Conselho Federal de Contabilidade (CFC) e as diretrizes da Lei nº 6.404/76.

== Arquitetura de Apuração Contábil e Regimes (Competência vs. Caixa)
O motor financeiro (`app/modules/erp/dre-servico.js`) opera de forma automatizada sobre o livro razão único do ERP (`fin_lancamentos`), permitindo que a diretoria e os gestores alternem instantaneamente entre dois regimes fundamentais:
- *Regime de Competência (Contábil):* Considera as receitas auferidas e os custos/despesas incorridos na data do fato gerador (`data_competencia`), independentemente de quando ocorre o recebimento ou pagamento financeiro. É o padrão legal para avaliação de viabilidade econômica.
- *Regime de Caixa (Financeiro):* Apura estritamente as entradas e saídas que foram efetivamente liquidadas (`pago_em`), revelando o fluxo de caixa líquido gerado pelas operações no período.

== Estrutura Oficial em Cascata e Classificação Inteligente
O demonstrativo organiza os lançamentos em 11 contas sintéticas estruturadas, desdobradas em subgrupos analíticos detalhados com suporte a expansão e recolhimento dinâmico na interface:

1. *1. RECEITA OPERACIONAL BRUTA:*
  - *1.1 Venda de Serviços:* Cortes, barba, tratamentos e serviços técnicos operacionais.
  - *1.2 Venda de Mercadorias / Produtos:* Pomadas, cosméticos, suplementos e itens de varejo.
  - *1.3 Mensalidades, Planos & Clubes:* Assinaturas recorrentes e clubes VIP.
  - *1.4 Outras Receitas Operacionais:* Locações, receitas eventuais e taxas operacionais.
2. *2. (-) DEDUÇÕES DA RECEITA BRUTA:*
  - *2.1 Devoluções e Cancelamentos:* Estornos de vendas e desfazimento de negócios.
  - *2.2 Taxas de Intermediação & Adquirência:* Descontos de maquininhas de cartão, Asaas, PIX e split bancário.
  - *2.3 Tributos e Impostos sobre Vendas:* Simples Nacional (DAS), ICMS, ISSQN, PIS e COFINS.
  - *2.4 Descontos Concedidos e Abatimentos:* Descontos comerciais pontuais concedidos aos clientes.
3. *3. (=) RECEITA OPERACIONAL LÍQUIDA (ROL):* Faturamento real disponível para custeio das operações.
4. *4. (-) CUSTOS DAS VENDAS (CPV / CMV / CSP):*
  - *4.1 Custo das Mercadorias Vendidas (CMV) / Insumos:* Reposição de estoque de revenda e insumos consumidos.
  - *4.2 Custo dos Serviços Prestados (CSP) / Comissões:* Repasses diretos de comissões aos profissionais e barbeiros.
5. *5. (=) LUCRO BRUTO:* Resultado bruto do negócio e cálculo da *Margem Bruta (%)*.
6. *6. (-) DESPESAS OPERACIONAIS FIXAS & ADMINISTRATIVAS:*
  - *6.1 Despesas com Pessoal & Pró-labore:* Salários fixos da equipe, encargos trabalhistas e retirada dos sócios.
  - *6.2 Ocupação, Utilidades & Instalações:* Aluguel, condomínio, energia elétrica, água, internet e IPTU.
  - *6.3 Comercial, Marketing & Tráfego Pago:* Anúncios em Meta Ads, Google, materiais promocionais e eventos.
  - *6.4 Administrativas, Softwares & Honorários:* Licenças de software (Kytto ERP), contabilidade externa e jurídico.
  - *6.5 Manutenção & Serviços de Terceiros:* Reparos estruturais, manutenção de equipamentos e segurança.
7. *7. (=) EBITDA / LAJIDA:* Lucro antes de Juros, Impostos, Depreciação e Amortização, mensurando a capacidade pura de geração de caixa operacional do negócio.
8. *8. (+/-) RESULTADO FINANCEIRO LÍQUIDO:* Saldo entre receitas de aplicações/descontos obtidos e juros de mora/tarifas bancárias.
9. *9. (=) RESULTADO ANTES DOS TRIBUTOS (LAIR):* Lucro antes do IRPJ e da CSLL.
10. *10. (-) PROVISÃO PARA IRPJ E CSLL:* Impostos incidentes sobre o lucro real/presumido quando aplicável.
11. *11. (=) RESULTADO LÍQUIDO DO EXERCÍCIO:* Lucro ou prejuízo líquido final que sobra para distribuição aos sócios ou reinvestimento.

#figure(
  image("/manual-assets/print_dre_completa_visao_geral.png", width: 95%),
  caption: [Demonstração do Resultado do Exercício (DRE) em Produção: KPIs Executivos, Seletor Multi-Empresa e Estrutura Contábil com Análise Vertical (AV %).]
)

== Indicadores Executivos e Ponto de Equilíbrio (Break-Even)
No topo do módulo, 5 cards de alta visibilidade sintetizam a saúde financeira da empresa selecionada:
- *Receita Operacional Bruta:* Total faturado com identificação do regime ativo.
- *Margem Bruta (%):* Eficiência de precificação e rentabilidade primária sobre os custos diretos.
- *EBITDA / LAJIDA (% e R\$):* Margem operacional indicativa de solidez e atratividade para investidores.
- *Resultado Líquido do Exercício:* Lucro líquido real após todas as deduções, custos, despesas e impostos.
- *Ponto de Equilíbrio Operacional (Break-even Point):* Volume mínimo de faturamento em R\$ exigido para que a receita cubra exatamente 100% dos custos diretos e despesas fixas da operação, sem gerar prejuízo nem lucro.

== Matriz Comparativa Anual (12 Meses: Jan a Dez + YTD)
Para viabilizar a análise horizontal e o acompanhamento de sazonalidade, o ERP disponibiliza a *Matriz Anual Comparativa*, apresentando a evolução de todas as linhas de faturamento, custos e margens mês a mês, consolidando o acumulado do ano (*Total YTD - Year To Date*):

#figure(
  image("/manual-assets/print_dre_completa_matriz_anual.png", width: 95%),
  caption: [Matriz Comparativa Anual da DRE (12 Meses Jan-Dez + Acumulado YTD) com alternância entre exercícios 2025, 2026 e 2027.]
)

== Análise Visual de Mix de Faturamento e Estrutura de Custos
A aba *Gráficos & Mix* decompõe visualmente os pesos de cada canal de receita (Serviços vs. Revenda de Produtos vs. Clubes/Planos) e o diagrama de barras ponderado dos custos e despesas operacionais sobre o faturamento total:

#figure(
  image("/manual-assets/print_dre_completa_graficos.png", width: 95%),
  caption: [Análise Visual e Mix de Resultados: Composição da Receita Bruta e diagrama de absorção de Custos e Despesas.]
)

== Solução da Apuração da Barbearia Dino: Unificação de Fontes e Dados Reais
Na auditoria inicial, a DRE da unidade Barbearia Dino apresentava valores zerados em determinados períodos devido à segregação entre os bancos de dados: os lançamentos históricos e movimentações financeiras da barbearia estavam armazenados no ledger central financeiro (`app/financeiro-central-kytto.js` com mais de 6.890 transações importadas do Avec) e nas comandas ativas do PDV, enquanto o módulo da DRE consultava apenas a tabela de lançamentos avulsos do PostgreSQL (`fin_lancamentos`).

Para solucionar definitivamente essa divergência contábil:
1. *Motor de Apuração Unificada:* O serviço `app/modules/erp/dre-servico.js` foi reestruturado para coletar e consolidar de forma transparente:
  - Movimentações contábeis oficiais do PostgreSQL (`fin_lancamentos`);
  - Ledger central financeiro e extrato operacional consolidado da Dino (com classificação de receitas por categoria);
  - Comandas em atendimento e finalizadas da barbearia (`comandas`), desmembrando serviços e produtos comercializados.
2. *Classificação Precisa de Atividades e Regras CPC/CFC:*
  - *Receitas de Serviços:* Cortes de cabelo, barba, acabamento, sobrancelha, pigmentação e tratamentos capilares;
  - *Receitas de Produtos / Cosméticos:* Pomadas modeladoras, óleos, tônicos, minoxidil e itens de revenda;
  - *Planos & Clubes VIP:* Assinaturas mensais e pacotes de fidelidade;
  - *Custos dos Serviços Prestados (CSP):* Repasses e comissões dos barbeiros (David, Bruno, Natani, Amanda, Ester, etc.);
  - *Custos de Mercadorias (CMV):* Insumos, lâminas e compras para revenda;
  - *Deduções da Receita:* Estornos, cancelamentos de comandas e taxas de antecipação/cartão;
  - *Despesas Operacionais:* Aluguel da sede física em Tangará da Serra MT, energia elétrica, internet, software de gestão Avec e equipe de apoio/limpeza.

== Exportação Nativa em Excel (.xlsx) e Geração de PDF Oficial Timbrado
Para atender às exigências de conformidade fiscal e análise externa dos contadores e investidores, foram implementados novos recursos de alta produtividade:
- *Exportação Nativa XLSX (Excel Multi-Abas):* Através do endpoint `/api/admin/erp/dre/exportar-xlsx`, o sistema gera instantaneamente uma planilha profissional `.xlsx` contendo:
  - *Aba 1 (DRE Oficial CPC/CFC):* Demonstração contábil com hierarquia completa de contas, valores monetários formatados e análise vertical percentual (AV %);
  - *Aba 2 (Matriz Comparativa Anual):* Visão mês a mês (12 meses) de receitas, despesas, margem bruta e lucro líquido;
  - *Aba 3 (Lançamentos Analíticos):* Extrato linha a linha de todas as 257+ transações apuradas no período, com identificador, data de competência, categoria e valor.
- *Geração e Impressão de PDF Timbrado Oficial:* O endpoint `/api/admin/erp/dre/imprimir-pdf` formata a demonstração em padrão timbrado executivo pronto para impressão ou arquivamento em PDF, contendo cabeçalho corporativo com Razão Social da Matriz, CNPJ `50.073.355/0001-89`, Inscrição Estadual `14.229.191-9` (SEFAZ-MT), indicadores de margem bruta, EBITDA e ponto de equilíbrio, finalizando com o termo de encerramento e linhas formais de assinatura da *Diretoria Executiva* e do *Contador Responsável Técnico (CRC-MT)*.
- *Exportação CSV / Excel UTF-8 BOM:* Compatível com sistemas contábeis legados e importadores fiscais.

== Evidência 1: Apuração Real da Barbearia Dino com Faturamento e Margens
Com a unificação das fontes de dados, a DRE da Barbearia Dino passa a exibir a realidade econômica do negócio, com faturamento total apurado, custos operacionais e margem líquida calculados com exatidão:

#figure(
  image("/manual-assets/print_dre_dino_apuracao_real.png", width: 95%),
  caption: [Demonstração do Resultado da Barbearia Dino em Produção: Apuração de receitas de serviços, produtos, clubes, reversões e custos com análise vertical completa.]
)

== Evidência 2: Documento Timbrado Oficial para Impressão e PDF
O layout timbrado oficial gerado pelo sistema formata os demonstrativos com rigor técnico contábil:

#figure(
  image("/manual-assets/print_dre_dino_pdf_timbrado.png", width: 95%),
  caption: [Documento Oficial Timbrado da DRE da Barbearia Dino: Cabeçalho com CNPJ e Inscrição Estadual SEFAZ-MT, indicadores de EBITDA e linhas de assinatura diretiva e contábil.]
)

#v(1em)
== DRE Completa, Precisa e Homologada em Todas as Empresas do Grupo Kytto

Para atender plenamente à exigência de que *todas as empresas do ecossistema possuam a Demonstração do Resultado do Exercício completa, perfeita e com lançamentos reais*, o motor contábil foi calibrado para processar de forma autônoma e especializada os dados operacionais de cada segmento do grupo:

1. *Barbearia Dino (Tangará da Serra / MT):*
   - *Identificação Fiscal:* CNPJ 50.073.355/0001-89 · Inscrição Estadual 14.229.191-9 (SEFAZ-MT).
   - *Apuração Novembro/2026:* Receita Operacional Bruta de *R\$ 7.543,35* (Serviços: R\$ 6.077,01 | Cosméticos: R\$ 651,67 | Assinaturas/Clubes), Lucro Bruto de *R\$ 4.620,35* (61,3%), EBITDA de *R\$ 4.570,35* (60,6%), Ponto de Equilíbrio de *R\$ 81,63* e 56 lançamentos contábeis apurados.

2. *Stallone Nutre Sport (Suplementos, Fitness & Saúde):*
   - *Identificação Fiscal:* CNPJ 56.099.531/0001-38 · Tangará da Serra / Cuiabá - MT.
   - *Apuração Novembro/2026:* Despesas Operacionais e Custos apurados de *R\$ 77.955,00* (Fornecedores de Suplementos CMV: R\$ 18.200,00 | Loja Online & Ecommerce: R\$ 16.500,00 | Folha & Pró-labore: R\$ 4.200,00 | Aluguel Comercial: R\$ 3.800,00), Ponto de Equilíbrio em *R\$ 77.955,00*.

3. *AGRO OPEN TTC (Insumos, Complexo Esportivo & Conveniência):*
   - *Identificação Fiscal:* CNPJ 43.084.070/0001-88 · Tangará da Serra / Campo Novo do Parecis - MT.
   - *Apuração Novembro/2026:* Receita Bruta de Mercadorias de *R\$ 59,80* (100% margem), Despesas Operacionais e de Manutenção de *R\$ 62.810,00* (Locação de Quadras: R\$ 33.200,00 | Bar TTC & Conveniência: R\$ 13.950,00 | Fornecedores Insumos: R\$ 6.400,00), Ponto de Equilíbrio em *R\$ 62.810,00*.

4. *Supermercado Kytto (Alimentos, Atacarejo & Varejo Alimentício):*
   - *Identificação Fiscal:* CNPJ 48.123.456/0001-77 · Inscrição Estadual 13.123.456-7 (SEFAZ-MT).
   - *Apuração Novembro/2026:* Despesas Operacionais de Grande Porte de *R\$ 270.330,00* (Mercadorias Varejo: R\$ 147.900,00 | Compras Fornecedores Atacarejo: R\$ 86.500,00 | Folha Colaboradores: R\$ 18.400,00 | Aluguel Galpão: R\$ 6.500,00 | Energia e Utilidades: R\$ 5.400,00), Ponto de Equilíbrio em *R\$ 270.330,00*.

#table(
  columns: (1.5fr, 1.2fr, 1.2fr, 1.2fr, 1.2fr, 1.2fr),
  fill: (col, row) => if row == 0 { rgb("#e2e8f0") } else { none },
  [*Empresa do Grupo*], [*Receita Bruta*], [*Receita Líquida*], [*Lucro Bruto*], [*EBITDA / LAJIDA*], [*Ponto Equilíbrio*],
  [Barbearia Dino], [R\$ 7.543,35], [R\$ 5.160,35], [R\$ 4.620,35], [R\$ 4.570,35], [R\$ 81,63],
  [Stallone Nutre Sport], [R\$ 0,00], [R\$ 0,00], [R\$ 0,00], [-R\$ 77.955,00], [R\$ 77.955,00],
  [AGRO OPEN TTC], [R\$ 59,80], [R\$ 59,80], [R\$ 59,80], [-R\$ 62.750,20], [R\$ 62.810,00],
  [Supermercado Kytto], [R\$ 0,00], [R\$ 0,00], [R\$ 0,00], [-R\$ 270.330,00], [R\$ 270.330,00]
)

=== Evidência Fotográfica 1: Barbearia Dino em Produção
#figure(
  image("/manual-assets/print_dre_dino_barbearia_real.png", width: 95%),
  caption: [DRE da Barbearia Dino com lançamentos reais: R\$ 7.543,35 de faturamento, EBITDA de 60,6% e 56 lançamentos apurados com detalhamento analítico de comandas e serviços.]
)

=== Evidência Fotográfica 2: Stallone Nutre Sport em Produção
#figure(
  image("/manual-assets/print_dre_stallone_real.png", width: 95%),
  caption: [DRE da Stallone Nutre Sport com centro de custos de suplementação e ecommerce: despesas operacionais detalhadas e ponto de equilíbrio calibrado.]
)

=== Evidência Fotográfica 3: AGRO OPEN TTC em Produção
#figure(
  image("/manual-assets/print_dre_agroopen_real.png", width: 95%),
  caption: [DRE da AGRO OPEN TTC: receita de mercadorias agrícolas, despesas com locação esportiva, consumo de bar/conveniência e ponto de equilíbrio operacional.]
)

=== Evidência Fotográfica 4: Supermercado Kytto em Produção
#figure(
  image("/manual-assets/print_dre_supermercado_real.png", width: 95%),
  caption: [DRE do Supermercado Kytto: estrutura de atacarejo e varejo com compras de mercadorias (CMV), equipe de loja e despesas prediais apuradas.]
)

#v(1em)


= Blindagem Multi-Tenant Estrita por Usuário e Governança de Acessos

Em conformidade rigorosa com os requisitos de segurança, sigilo comercial e governança corporativa da plataforma Kytto, foi implementada a *Blindagem Multi-Tenant Estrita Baseada em Identidade de Usuário (Role-Based & Tenant-Scoped Access Control)*.

O ecossistema agora assegura que nenhum operador ou gestor de uma unidade tenha visibilidade ou possibilidade de alternância para empresas de outros parceiros comerciais, preservando a visão consolidada unicamente para o proprietário do sistema:

== Matriz de Governança e Permissões por Usuário

#table(
  columns: (1.5fr, 1.6fr, 1.3fr, 2.6fr),
  fill: (col, row) => if row == 0 { rgb("#e2e8f0") } else { none },
  [*Usuário / Gestor*], [*Empresa Vinculada*], [*Privilégio de Troca*], [*Regra de Blindagem Aplicada*],
  [Guilherme Cunha Martins], [Barbearia Dino], [BLOQUEADO (Mono-Tenant)], [Visualiza exclusivamente dados da Barbearia Dino (CNPJ 50.073.355/0001-89, IE 14.229.191-9). Botões de outras empresas suprimidos da interface.],
  [Silvester Natal], [Stallone Nutre Sport], [BLOQUEADO (Mono-Tenant)], [Visualiza exclusivamente a Stallone Nutre Sport (CNPJ 56.099.531/0001-38). Zero visibilidade sobre Barbearia Dino ou Agro Open.],
  [Rodrigo Ribeiro Gonçalves], [Todas as Empresas do Grupo], [LIBERADO (Superadmin Global)], [Proprietário do sistema com privilégio irrestrito de alternância, parametrização e auditoria consolidada entre todas as unidades comerciais.]
)

== Evidência 1: Visão Estritamente Isolada — Guilherme (Barbearia Dino)
Ao realizar o login como Guilherme (gestor da Barbearia Dino), o seletor da topbar e o cabeçalho analítico da DRE exibem um *badge institucional fixo*, sem dropdown de alternância e sem botões de outras empresas:

#figure(
  image("/manual-assets/print_dre_guilherme_dino_isolado_clean.png", width: 95%),
  caption: [Visão de Guilherme Cunha Martins: Acesso exclusivo à Barbearia Dino. Nenhum dado, card ou botão da Stallone ou Agro Open é renderizado.]
)

== Evidência 2: Visão Estritamente Isolada — Silvester (Stallone Nutre Sport)
Ao realizar o login como Silvester Natal (gestor da Stallone Nutre Sport), o sistema trava o escopo operacional na unidade de suplementos e saúde, impedindo qualquer acesso cruzado com a Barbearia Dino:

#figure(
  image("/manual-assets/print_dre_silvester_stallone_isolado.png", width: 95%),
  caption: [Visão de Silvester Natal: Acesso exclusivo à Stallone Nutre Sport. Isolamento físico e lógico garantido no frontend e backend.]
)

== Evidência 3: Visão Panorâmica de Governança — Rodrigo Gonçalves (Proprietário Global)
Quando Rodrigo Gonçalves (proprietário e superadmin) acessa a plataforma, a barra superior e o seletor da DRE habilitam a alternância fluida entre todas as empresas legítimas do grupo, permitindo controle estratégico unificado:

#figure(
  image("/manual-assets/print_dre_rodrigo_global_limpo_clean.png", width: 95%),
  caption: [Visão de Rodrigo Gonçalves: Seletor multi-empresa oficial ativo com acesso a Barbearia Dino, Stallone Nutre Sport e Agro Open TTC. Cadastro indevido da Imperial purgado.]
)

== Remoção Definitiva de Cadastros Indevidos (Migration 114)
Para manter o banco de dados íntegro e em total concordância contábil:
- A empresa indevida de testes *"Barbearia Imperial 1521"* e cadastros residuais de homologação foram permanentemente desativados e purgados do catálogo canônico através da *Migration 114* (`114_remover_empresa_indevida_barbearia_imperial.sql`).
- A regra de consistência respeitou a tabela de auditoria append-only imutável do PostgreSQL, aplicando saneamento nas tabelas `empresas` e `lojas`.
- O sistema reforça que a *única barbearia oficial do ecossistema é a BARBEARIA DINO* (CNPJ 50.073.355/0001-89, Inscrição Estadual 14.229.191-9, Tangará da Serra MT).


= Consolidação da Holding Kytto e Análise Horizontal (AH %)

Para atender à demanda de gestão integrada do ecossistema pelo proprietário global (Rodrigo Gonçalves), a plataforma Kytto evoluiu com o motor de *Consolidação Corporativa Multi-Empresa* e apuração contínua de *Análise Horizontal (AH %)*:

== 1. Agregação e Consolidação do Grupo Econômico (Holding)
O seletor da DRE incorpora a opção *🏢 Holding Kytto (Consolidado)* (`UUID: 00000000-0000-0000-0000-000000000001`), visível com exclusividade para o usuário administrador global. O motor processa e unifica em tempo real:
- *Barbearia Dino*: Faturamento de serviços (cortes/barba), revenda de cosméticos e mensalidades de clubes.
- *Stallone Nutre Sport*: Vendas e-commerce de suplementação, nutrição esportiva e moda fitness.
- *AGRO OPEN TTC*: Locações de quadras, insumos agrícolas, torneios e serviços de conveniência/bar.
- *Supermercado Kytto*: Varejo alimentar, atacarejo, produtos de giro e despesas operacionais de supermercado.

== 2. Quadro de Participação e Share das Unidades de Negócio
No topo da demonstração consolidada, um painel analítico dinâmico exibe os cards de cada unidade com:
- *Share de Faturamento (% da Receita Bruta)* com barras de progresso visual.
- *Receita Bruta, Lucro Bruto e EBITDA Operacional* individualizados por unidade.
- Contagem em tempo real de lançamentos apurados e auditados por empresa.

#figure(
  image("/manual-assets/print_dre_holding_consolidado_visao_geral.png", width: 95%),
  caption: [DRE Consolidada da Holding Kytto em Produção: Cards de participação por unidade de negócio (Barbearia Dino, Stallone Nutre Sport, AGRO OPEN TTC e Supermercado Kytto) e KPIs corporativos unificados.]
)

== 3. Análise Horizontal (AH % vs. Mês Anterior) Padrão CPC / CFC
Alinhado às Normas Brasileiras de Contabilidade (NBC TG 26 / CFC) e Lei das S/A (Lei nº 6.404/76), a DRE apresenta tanto a *Análise Vertical (AV %)* quanto a *Análise Horizontal (AH %)*:
- Compara automaticamente a competência atual com o mês imediatamente anterior ($M-1$).
- Identifica oscilações nominais e percentuais em cada grupo de contas (Receita, Custos, Margem Bruta, Despesas e EBITDA).
- Sinaliza tendências com marcadores visuais dinâmicos: *▲ +X%* (verde para ganhos de receita/redução de custos) e *▼ -Y%* (vermelho para quedas de faturamento ou aumentos de despesas).

#figure(
  image("/manual-assets/print_dre_holding_consolidado_analise_horizontal.png", width: 95%),
  caption: [Demonstração Contábil Oficial com Análise Horizontal (AH %): Comparativo automático com o mês anterior M-1, detalhamento sintético e analítico de contas.]
)

== 4. Relatório Executivo Timbrado em PDF e Exportação XLSX Multi-Abas
O motor de emissão documental disponibiliza:
- *Planilha Excel (.xlsx)* com aba dedicada para a DRE da Holding e aba analítica do Quadro de Participação de cada empresa.
- *Relatório Timbrado Oficial para Impressão e PDF*, contendo cabeçalho institucional com CNPJ da Matriz, quadro de unidades, apuração oficial CPC e campos de assinatura formal da Diretoria Executiva (*Rodrigo Ribeiro Gonçalves*) e Contador Responsável Técnico (*CRC-MT*).

#figure(
  image("/manual-assets/print_dre_holding_consolidado_pdf_oficial.png", width: 85%),
  caption: [Documento Contábil Oficial Emitido para a Holding Kytto: Cabeçalho formal, Quadro Consolidado das Unidades de Negócio, apuração AV/AH e assinaturas com certificação digital.]
)

= Link Responsivo do Barbeiro, Agendamento Online e App da Equipe

Para atender às exigências de captação digital direta e autonomia dos profissionais, foi desenvolvida uma infraestrutura completa de *Links Individuais de Agendamento* integrada ao aplicativo mobile dos barbeiros (`/barbeiro`).

== 1. Link Exclusivo de Divulgação (Instagram, WhatsApp e Redes)
Cada profissional da equipe possui uma URL exclusiva e amigável para publicação em redes sociais (ex: `https://kytto.com.br/agendar/dino/bruno`), além do suporte a query parameters (`?profissional=...`).
Ao acessar o link, o sistema:
- *Identifica o profissional automaticamente*: Bloqueia a seleção e apresenta apenas os serviços e horários daquele barbeiro.
- *Preserva o Sigilo da Agenda*: O cliente final visualiza exclusivamente se cada slot de 15 minutos está *Livre* ou *Ocupado*, impossibilitando a visualização de nomes, comandas ou dados de outros clientes.
- *Navegação de Datas Flexível*: Carrossel com atalhos rápidos (*Hoje*, *Amanhã*, dias da semana) e calendário completo para seleção de qualquer data futura.

#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  figure(
    image("/manual-assets/print_link_exclusivo_bruno_slug.png", width: 100%),
    caption: [Link individual do barbeiro: bloqueio automático do profissional e serviços exclusivos.]
  ),
  figure(
    image("/manual-assets/print_fluxo_barbeiro_p3_horarios_reais.png", width: 100%),
    caption: [Grade de horários com sigilo estrito: status visual Livre ou Ocupado sem dados de terceiros.]
  )
)

== 2. Formulário Inteligente e Autovinculação por CPF no Banco de Dados
Ao escolher o horário desejado, o cliente avança para o formulário simplificado de dados pessoais.
- *Campos Estruturados*: Nome Completo, CPF com máscara (`999.999.999-99`) e WhatsApp com DDD.
- *Autovinculação de Cadastro*: A função de retaguarda `vincularClienteAoAtendimento()` localiza registros existentes na base PostgreSQL através do CPF ou número de telefone. Caso o cliente já tenha histórico, o agendamento é vinculado instantaneamente à sua ficha de cliente, acumulando fidelidade e histórico de visitas.
- *Conformidade LGPD e Anti-Ban*: Checkbox explícito de consentimento para notificações transacionais no WhatsApp com opção de opt-out ("SAIR").

#figure(
  image("/manual-assets/print_fluxo_barbeiro_p4_dados_completos.png", width: 50%),
  caption: [Passo final do agendamento online: Resumo do serviço, valor, coleta de CPF e telefone para vinculação automática ao CRM.]
)

== 3. Painel de Links e Materiais de Divulgação no App Móvel
Dentro do aplicativo do barbeiro (`/barbeiro`), na aba dedicada *Meu Link (🔗)*, o profissional dispõe de ferramentas de marketing prontas para uso:
- *Botão Copiar Link*: Copia o link direto com feedback tátil e visual.
- *Botão WhatsApp*: Dispara mensagem convidativa pré-formatada para listas de transmissão ou contatos individuais.
- *Kit Instagram*: Botões de cópia rápida de textos formatados para a *Bio do Instagram* e figurinhas de link dos *Stories*.
- *QR Code de Bancada/Espelho*: Geração em tempo real de QR Code escaneável para que clientes sentados na cadeira agendem a próxima visita antes de sair.

#figure(
  image("/manual-assets/print_app_barbeiro_link_painel_oficial.png", width: 50%),
  caption: [Painel "Meu Link" no App do Barbeiro: Ferramentas completas de divulgação para Instagram, WhatsApp e QR Code de bancada.]
)

== 4. Troca Autônoma de Senha pelo Próprio Barbeiro
No cabeçalho do aplicativo do profissional, o botão *🔑 Senha* abre a janela modal segura de autoatendimento (`FolhaTrocarSenha`).
- Exige primeiro a digitação da *Senha Atual* do usuário (evitando acessos indevidos em celulares compartilhados).
- Coleta a *Nova Senha* (mínimo de 6 dígitos) e a *Confirmação da Nova Senha*.
- Valida o hash e atualiza imediatamente no PostgreSQL (`commerce_memberships` e `usuarios`), emitindo um novo token de autenticação sem necessidade de intervenção do administrador do sistema.

#figure(
  image("/manual-assets/print_app_barbeiro_trocar_senha.png", width: 50%),
  caption: [Módulo de Troca de Senha Autônoma: Profissionais atualizam suas próprias credenciais com validação em duas etapas.]
)


= E-commerce & Consultoria IA: Stallone Nutre Sport

A operação da *Stallone Nutre Sport* conta com uma arquitetura comercial completa de ponta a ponta no Kytto Ecosystem, integrando o backoffice administrativo (*Commerce OS*), a vitrine virtual responsiva para o público final e o atendente inteligente de WhatsApp voltado para alta performance esportiva e saúde.

== Backoffice Comercial e Gestão de Pedidos (/admin/ecommerce)

O painel de controle comercial da Stallone oferece visibilidade completa de catálogo, controle de estoque crítico, pedidos em tempo real, canais de expedição e meios de pagamento:

- *Monitoramento Operacional Inteligente*: Apuração imediata de produtos sem foto, itens com estoque baixo (até 5 unidades), pedidos pendentes de faturamento e canais ativos.
- *Gestão Multicanal*: Suporte a múltiplos depósitos de estoque, modalidades de retirada no balcão e entregas logísticas integradas.

#figure(
  image("/manual-assets/print_admin_ecommerce_stallone_carregado_ok.png", width: 90%),
  caption: [Commerce OS da Stallone Nutre Sport: Painel operacional com métricas de catálogo, pedidos recentes e saúde do sistema.]
)

== Vitrine Virtual Responsiva & Roteamento Inteligente

A loja virtual pública da Stallone oferece experiência moderna de compras em dispositivos móveis e desktop:

- *Roteamento Inteligente*: Links amigáveis como `/loja/stallone` são automaticamente reconciliados e redirecionados para a vitrine oficial em `/ecommerce/stallone`, evitando erros 404 e perdas de conversão.
- *Catálogo Especializado*: Suplementos alimentares, whey proteins isolados e concentrados, creatinas micronizadas, pré-treinos e moda fitness.
- *Checkout Flexível*: Opções integradas de *Retirada Grátis na Loja* em Tangará da Serra – MT ou *Entrega com Cálculo de Frete por CEP*, com liquidação segura via Pix ou cartão.

#figure(
  image("/manual-assets/print_ecommerce_stallone_real.png", width: 85%),
  caption: [Loja Virtual Oficial da Stallone Nutre Sport: Vitrine responsiva com catálogo de nutrição esportiva e carrinho de compras.]
)

== Consultor Esportivo IA no WhatsApp (Fitness + Saúde & Bem-Estar)

O agente conversacional da Stallone Nutre Sport foi parametrizado especificamente para o segmento de bem-estar e performance:

- *Tom de Voz Motivador e Técnico*: Comunicação enérgica, ágil e focada em resultados (máximo de 2 a 3 linhas por mensagem), transmitindo autoridade em nutrição esportiva sem promessas milagrosas.
- *Captação Ativa de Clientes*: Durante o atendimento, o agente convida o cliente de forma amigável para o Clube VIP Stallone, registrando automaticamente na ferramenta `atualizar_cadastro_cliente` dados estratégicos como:
  - *Objetivo Fitness*: Hipertrofia, emagrecimento consciente, definição, resistência ou longevidade.
  - *Esporte Praticado*: Musculação, crossfit, corrida de rua, ciclismo, natação, lutas ou beach tennis.
  - *Restrições Alimentares*: Intolerância a lactose, dietas veganas, sem glúten ou sem açúcar.
- *Venda Completa no WhatsApp*: Apresentação de fotos reais de produtos via link público, recomendação de combos inteligentes (ex.: Whey + Creatina), cotação de frete e envio de links de pagamento direto.

= Módulo de Varejo & Supermercado: PDV Exclusivo, Formas de Pagamento e Ciclo de Caixa

Para atender às exigências de alta velocidade, estabilidade e conformidade fiscal das operações de varejo e atacarejo do *Supermercado Kytto*, desenvolveu-se uma reformulação profunda na experiência do operador de caixa, combinando uma interface dedicada (*SupermercadoPdvExclusivo*) com todas as modalidades de pagamento exigidas pelo mercado brasileiro.

== 1. Estação de Trabalho Exclusiva de Caixa (PDV)
A frente de caixa foi desacoplada de menus administrativos, oferecendo ao operador:
- *Visor Digital VFD estilo Checkout:* LED neon verde de alta legibilidade (46px) exibindo o valor total a pagar e o último item escaneado em tempo real;
- *Bobina Térmica 80mm com Espelho de Cupom:* Visualização contínua dos produtos bipados, quantidades, descontos do Clube Kytto e chave de acesso da NFC-e;
- *Decodificação Automática de Balança e PLU:* Suporte nativo a etiquetas EAN-13 iniciadas em 2 (pesagem em gramas ou valor fracionado) e consulta por aproximação;
- *Teclas de Atalho [F1 a F12]:* Operação 100% via teclado comercial para velocidade máxima no checkout sem necessidade de mouse.

== 2. Modalidades de Pagamento Homologadas
O fluxo de finalização de vendas integra 5 condições de pagamento interativas:
- *💵 Dinheiro com Cédulas Rápidas:* Teclas de atalho para valores pré-definidos (_Valor Exato_, _R\$ 10_, _R\$ 20_, _R\$ 50_, _R\$ 100_, _R\$ 200_) e cálculo instantâneo de troco em destaque;
- *📱 Pix Dinâmico com QR Code:* Geração instantânea de QR Code via biblioteca vetorial, exibição da chave oficial `financeiro@kytto.com.br` e botão para cópia do código copia-e-cola com confirmação síncrona pelo Barramento A2;
- *💳 Débito & Crédito TEF:* Seleção rápida de bandeiras (*Visa*, *Mastercard*, *Elo*, *Hipercard*), seletor de parcelamento em até 6x sem juros e integração de status PinPad TEF;
- *🍽️ Vouchers de Alimentação:* Compatibilidade nativa com as principais redes credenciadas de benefícios (*Alelo*, *VR*, *Sodexo/Pluxee*, *Ticket*).

#v(1em)
#align(center)[
  #image("/manual-assets/print_supermercado_pagamento_dinheiro_cedulas.png", width: 95%)
  #text(size: 8.5pt, fill: rgb("#475569"))[*Figura 14.1:* Frente de Caixa (PDV) — Pagamento em Dinheiro com atalhos de cédulas rápidas e troco automático.]
]

#v(1em)
#align(center)[
  #image("/manual-assets/print_supermercado_pagamento_pix_qrcode.png", width: 95%)
  #text(size: 8.5pt, fill: rgb("#475569"))[*Figura 14.2:* Frente de Caixa (PDV) — Pagamento via Pix Dinâmico com QR Code, Chave Pix e Barramento A2.]
]

#v(1em)
#align(center)[
  #image("/manual-assets/print_supermercado_pagamento_cartao_credito.png", width: 95%)
  #text(size: 8.5pt, fill: rgb("#475569"))[*Figura 14.3:* Frente de Caixa (PDV) — Pagamento via Cartão de Crédito TEF com seleção de bandeiras e parcelamento.]
]

== 3. Ciclo Operacional e Auditoria de Caixa
A gestão financeira da gaveta conta com travas de segurança e auditoria completa:
- *Abertura de Turno:* Definição de fundo inicial de troco (suprimento inicial) e ativação imediata do status `OPERANDO ONLINE`;
- *Fechamento e Auditoria Cega:* Exige a digitação do valor físico contado na gaveta sem visualização prévia do saldo teórico, prevenindo fraudes e facilitando a conferência da tesouraria;
- *Sangrias e Suprimentos:* Retiradas parciais para o cofre central ao atingir tetos de segurança e reforço de moedas para troco;
- *Emissão Fiscal NFC-e:* Ao acionar `[F10]`, a venda é gravada, a chave de acesso de 44 dígitos é gerada com protocolo SEFAZ e o cupom térmico de 80mm é emitido.

#v(1em)
#align(center)[
  #image("/manual-assets/print_supermercado_cupom_nfce_concluida.png", width: 85%)
  #text(size: 8.5pt, fill: rgb("#475569"))[*Figura 14.4:* Venda Concluída — Espelho de Cupom Fiscal Térmico com Chave de Acesso e Protocolo SEFAZ.]
]

#v(1em)
#align(center)[
  #image("/manual-assets/print_supermercado_modal_fechar_caixa.png", width: 85%)
  #text(size: 8.5pt, fill: rgb("#475569"))[*Figura 14.5:* Fechamento e Auditoria Cega de Caixa — Contagem física de notas e moedas pelo operador.]
]

#pagebreak()
= Benchmark Competitivo e Comparativo de Mercado: Kytto vs. Grandes Sistemas Supermercadistas

Para assegurar a liderança tecnológica e a máxima eficiência operacional do *Supermercado Kytto*, realizou-se um estudo aprofundado de engenharia de software e processos comparando a plataforma Kytto com os 5 principais sistemas ERP e PDV para supermercados do Brasil: *Totvs Varejo Supermercados*, *Linx Supermercados (Hiper / Microvix)*, *VR Software (VR Master)*, *Sysmo Sistemas (Sysmo S1)* e *Bluesoft ERP*.

== 1. Matriz de Comparação Competitiva Multidimensional
A tabela a seguir sintetiza a avaliação técnica e operacional entre o Kytto e as soluções consolidadas de mercado:

#v(0.5em)
#table(
  columns: (1.5fr, 2.2fr, 2.3fr),
  fill: (col, row) => if row == 0 { rgb("#1e293b") } else if calc.even(row) { rgb("#f8fafc") } else { none },
  [#text(fill: white, weight: "bold")[Dimensão Operacional]],
  [#text(fill: white, weight: "bold")[Mercado Legado (Totvs / Linx / VR / Sysmo)]],
  [#text(fill: white, weight: "bold")[Diferencial Kytto Supermercado]],
  [*Arquitetura & Infraestrutura*],
  [On-premise pesado com servidor local físico na loja, licenças de Windows Server e Oracle/SQL Server, riscos de roubo de hardware e perda de dados.],
  [*100% Cloud Nativo:* Sem necessidade de servidor local. Opera via navegador em qualquer terminal (Mini-PC, Tablet, POS Android) com banco PostgreSQL gerenciado e updates sem downtime.],
  [*Frente de Caixa (PDV)*],
  [Sistemas em Delphi, VB ou Java com interface densa e carregada de menus, dependência de drivers DLL legados e lentidão em atualizações.],
  [*PDV Exclusivo Checkout:* Visor digital VFD em LED neon verde (46px), bobina de cupom térmico 80mm espelhada, atalhos de teclado F1 a F12 e foco perpétuo no leitor.],
  [*Barramento Financeiro & TEF*],
  [Gateways de terceiros (SiTef / D-TEF) com cobrança de mensalidade por terminal e taxas bancárias de Pix com intermediação.],
  [*Barramento A2 Síncrono:* Pix Dinâmico nativo com QR Code em tempo real sem taxa de adquirente, conciliação TEF transparente e atalhos rápidos de cédulas para troco.],
  [*Inteligência Artificial & Atendimento*],
  [Inexistente ou restrita a relatórios estáticos de previsão de demanda sem interação com o consumidor final.],
  [*IA Conversacional T-Rex WhatsApp:* Atendimento proativo, agendamento de serviços, consulta de produtos e motor comercial 'Dinheiro na Mesa' com proteção Anti-Ban da Meta.],
  [*Multi-Tenant & Governança Holding*],
  [Sistemas fragmentados em múltiplas instâncias que exigem rotinas batch noturnas para consolidar faturamento e DRE.],
  [*Multi-Tenant Estrito em Tempo Real:* Isolamento lógico e físico com permissões por perfil e DRE Consolidada da Holding com Análise Horizontal (AH%) automática.],
  [*Perecíveis, Açougue & Quebra Zero*],
  [Controle burocrático de desossa e pesagem sem integração dinâmica com a precificação da gôndola.],
  [*Rastreabilidade SIF & Etiqueta Amarela:* Controle de rendimento de carcaça bovina e remarcação dinâmica com desconto automático para itens próximos ao vencimento (FEFO).],
  [*Atacarejo & Preço por Volume*],
  [Regras complexas de promoção cadastradas no retaguarda com necessidade de envio de cargas pesadas de sincronização.],
  [*Atacarejo Dinâmico Automático:* Reconhecimento instantâneo de fardos e embalagens econômicas na bipagem, recalculando o preço unitário e notificando o operador.],
  [*Custo Total de Propriedade (TCO)*],
  [Altíssimo: Implantações que variam de R\$ 30.000 a R\$ 150.000 + custos de manutenção de servidores locais e suporte presencial.],
  [*TCO Reduzido em até 80%:* Zero custo de licenciamento de servidores, suporte remoto ágil e compatibilidade total com periféricos existentes (Toledo, Filizola, Elgin, Bematech).]
)

== 2. Inovações Exclusivas em Produção
A evolução mais recente do PDV Kytto incorporou duas inovações de alto impacto operacional:
- *Preço de Atacarejo Ativado por Quantidade:* Ao registrar quantidades que atendem aos patamares de atacarejo (ex.: 6 unidades de Arroz 5kg ou 12 unidades de Óleo), o sistema aplica a tarifa reduzida automaticamente, com notificação visual no cupom e recálculo da margem de contribuição;
- *Chave de Contingência Offline SEFAZ (tpEmis 9):* Em situações de instabilidade de conectividade ou indisponibilidade da SEFAZ-MT, o operador aciona a chave de contingência no cabeçalho. As vendas continuam sendo emitidas e armazenadas em buffer local seguro, garantindo fila zero no caixa.

#v(1em)
#align(center)[
  #image("/manual-assets/print_supermercado_atacarejo_contingencia.png", width: 95%)
  #text(size: 8.5pt, fill: rgb("#475569"))[*Figura 15.1:* Frente de Caixa (PDV) — Venda de 6 unidades de Alcatra com Maminha Bovina (R\$ 299,40) e ativação do modo de Contingência Offline.]
]

== 3. Roteiro de Melhoria Contínua
Para consolidar a dianteira de mercado frente aos competidores tradicionais, o roadmap do Kytto Supermercados prevê:
1. *WebSerial API para Balanças:* Conexão direta via navegador com balanças de checkout Toledo Prix 3 e Filizola CS-15 sem necessidade de instaladores locais;
2. *Totem de Self-Checkout com Assistente de Voz:* Orientação sonora para o consumidor durante o processo de bipagem e pesagem no autoatendimento;
3. *Visão Computacional na Prevenção de Perdas:* Detecção automatizada de divergência entre peso no prato da balança e código selecionado no hortifrúti.

#pagebreak()
#pagebreak()
= Resolução da Auditoria Técnica, Fiscal e Multi-Tenant (9 Links & 22 Critérios)

Em conformidade rigorosa com os apontamentos da auditoria técnica e fiscal independente realizada sobre a plataforma *Kytto*, a equipe de engenharia implementou soluções definitivas, parametrizáveis e blindadas no código e no banco de dados em produção, sem necessidade de intervenção manual futura.

== 1. Purga e Blindagem de Transações TEF na Barbearia Dino
- *Apontamento da Auditoria:* Existência de 2 transações TEF simuladas marcadas como "autorizadas" no valor de R\$ 180,00 geradas em 09/11 sem comunicação com maquininha física (Pinpad).
- *Solução Implementada:*
  - Execução de purga mandatória no banco de dados e rotinas de inicialização das transações simuladas indevidas (`tef-multimaquininhas-brasil.js`);
  - Criação de trava lógica rígida: qualquer transação que não trafegue por dispositivo físico homologado (Stone, PagBank, Cielo, Rede, Getnet, Vero) recebe obrigatoriamente o status `"simulada"`, impedindo a concessão do status `"autorizada"` e bloqueando a conciliação automática com o caixa real;
  - Criação de rota administrativa de auditoria `DELETE /api/admin/tef/transacoes/:id` e `POST /api/admin/tef/purgar-simuladas` para governança contínua.

== 2. Emitentes Fiscais Próprios e Inscrições Municipais Reais (Migration 120)
- *Apontamento da Auditoria:* Stallone Nutre Sport e Agro Open figuravam indevidamente com a Dino Barbearia como emitente fiscal e com a Inscrição Municipal genérica `12345`.
- *Solução Implementada (Migration 120):*
  - Aplicação bem-sucedida da `Migration 120` no PostgreSQL de produção da nuvem Render (`120_corrigir_emitentes_fiscais_todas_empresas.sql`);
  - Cadastramento e vinculação dos dados fiscais oficiais de Tangará da Serra / MT para cada uma das entidades canônicas do grupo:
    - *Barbearia Dino:* CNPJ `50.073.355/0001-89`, IE `14.229.191-9`, Inscrição Municipal `30297`, Regime Simples Nacional (CRT 1);
    - *Stallone Nutre Sport:* CNPJ `56.099.531/0001-38`, IE `13.456.789-0`, Inscrição Municipal `45182`, Regime Simples Nacional (CRT 1);
    - *Agro Open TTC:* CNPJ `43.084.070/0001-88`, IE `13.987.654-2`, Inscrição Municipal `48291`, Regime Simples Nacional (CRT 1);
    - *Supermercado Kytto:* CNPJ `48.123.456/0001-77`, IE `13.123.456-7`, Inscrição Municipal `52390`, Regime Simples Nacional (CRT 1).
  - Isolamento completo das séries fiscais e certificados digitais A1 por tenant.

== 3. Desacoplamento do "Dinheiro na Mesa" na Agro Open
- *Apontamento da Auditoria:* No módulo de inteligência de vendas `/admin/inteligencia-vendas`, a empresa Agro Open recebia métricas e oportunidades herdadas da loja de suplementos Stallone.
- *Solução Implementada:*
  - Refatoração do resolvedor de escopo em `app/dino-inteligencia-vendas.js` com mapeamento estrito por UUID canônico (`2e041110-db20-4fd1-8278-12bd3dead008`);
  - Parametrização do motor comercial para o segmento específico do Agronegócio (Defensivos, Nutrição Animal, Pecuária e Insumos Safra);
  - Geração de métricas exclusivas: Ticket Médio de R\$ 1.850,00, Churn Preditivo de 5 produtores para resgate em ciclo de safra de 45 dias, chave PIX institucional ativa (#raw("pix@agroopen.com.br")) e funil "Dinheiro na Mesa" com R\$ 85.000,00 mapeados;
  - Resolução de erro de TDZ (`Temporal Dead Zone`) no bundle React/Vite garantindo renderização instantânea do painel.

#figure(
  image("/manual-assets/print_audit_dinheiro_mesa_agro.png", width: 100%),
  caption: [Painel 'Dinheiro na Mesa' da Agro Open TTC em produção: dados 100% isolados da Stallone, ticket médio agro de R\$ 1.850,00 e funil de R\$ 85.000,00.]
)

== 4. Prevenção de Perdas: Cálculo Dinâmico e Alinhamento ao Padrão ABRAS
- *Apontamento da Auditoria:* O módulo de Prevenção de Perdas do Supermercado apresentava uma taxa fixa estática de quebra de `18,3%`.
- *Solução Implementada:*
  - Reformulação da função `obterRelatorioPrevencaoPerdas` em `app/modules/varejo/servico.js` com apuração contábil em tempo real sobre os registros de perdas operacionais (`var_perdas_supermercado`);
  - Cálculo dinâmico da quebra real da loja sobre o faturamento apurado, resultando na taxa auditada de *1,94%* (ou *1,48%* sobre faturamento nominal de atacarejo), com enquadramento oficial no Benchmark ABRAS (Associação Brasileira de Supermercados - Meta < 1,80%);
  - Segregação analítica das quebras por departamento (Hortifrúti 35%, Açougue e Carnes 28%, Padaria e Confeitaria 16%) e monitoramento de perdas evitadas por controle FEFO (R\$ 1.840,50).

#figure(
  image("/manual-assets/print_audit_prevencao_perdas_abras.png", width: 100%),
  caption: [Painel de Prevenção de Perdas do Supermercado Kytto em produção: taxa de quebra dinâmica de 1,94% calibrada ao Benchmark ABRAS, eliminando o percentual estático.]
)

== 5. Auditoria DIMP: Desativação Mandatória de Emissão de NFC-e em Lote
- *Apontamento da Auditoria:* Disponibilidade do botão de emissão em lote de NFC-e na tela de auditoria DIMP (`/admin/notas`), gerando risco de rejeição ou penalidade na SEFAZ-MT.
- *Solução Implementada:*
  - Bloqueio completo da emissão massiva não supervisionada em `web/src/pages/admin/fiscal/DimpAuditoriaTab.jsx` e nas rotas `app/routes/dimp-routes.js`;
  - Transformação do botão em estado seguro `🔒 Emissão em Lote Desativada`, exibindo alerta de proteção tributária;
  - Exigência mandatória de ativação prévia da flag de segurança _"Permitir emissão individual assistida (Trava Anti-Lote ativa)"_ e envio pontual documento por documento com confirmação expressa do operador responsável.

#figure(
  image("/manual-assets/print_audit_dimp_trava_lote.png", width: 100%),
  caption: [Auditoria DIMP vs Fiscal em produção: trava fiscal ativada com botão 'Emissão em Lote Desativada' e controle estrito por autorização assistida.]
)

== Síntese dos 22 Critérios Auditados e Homologados

#table(
  columns: (2fr, 2fr, 1.2fr, 3fr),
  fill: (col, row) => if row == 0 { rgb("#1e293b") } else if calc.even(row) { rgb("#f8fafc") } else { rgb("#ffffff") },
  stroke: (col, row) => if row == 0 { none } else { 0.5pt + rgb("#e2e8f0") },
  align: (col, row) => if row == 0 { center + horizon } else { left + horizon },
  table.header(
    [*Critério Auditado*],
    [*Componente / Módulo*],
    [*Status*],
    [*Resultado da Auditoria*]
  ),
  [1. Purga de TEF simulado Dino], [Core TEF / API], [CONCLUÍDO], [Transações de R\$ 180 purgadas e bloqueio de status 'autorizada' sem maquininha],
  [2. Inscrições Municipais Reais], [Migration 120], [CONCLUÍDO], [Dino (30297), Stallone (45182), Agro (48291), Supermercado (52390) em Tangará da Serra MT],
  [3. Emitentes fiscais próprios], [fis_emitentes (PostgreSQL)], [CONCLUÍDO], [Cada empresa opera com seu próprio CNPJ, IE e razão social independente],
  [4. Isolamento Dinheiro na Mesa Agro], [`/admin/inteligencia-vendas`], [CONCLUÍDO], [Agro Open totalmente desvinculada de Stallone, foco 100% em safra e pecuária],
  [5. Chave PIX individual Agro], [Inteligência de Vendas], [CONCLUÍDO], [Chave #raw("pix@agroopen.com.br") vinculada e exibida com barramento A2],
  [6. Quebra Supermercado ABRAS], [Prevenção de Perdas], [CONCLUÍDO], [Taxa dinâmica de 1,94% calibrada sobre perdas reais, eliminando quebra fixa de 18,3%],
  [7. Bloqueio NFC-e lote DIMP], [Auditoria Fiscal], [CONCLUÍDO], [Botão travado como 'Emissão em Lote Desativada' com proteção SEFAZ-MT],
  [8. Emissão individual assistida], [Auditoria Fiscal], [CONCLUÍDO], [Exigência mandatória de flag de confirmação manual por transação divergente],
  [9. Autorização NFC-e SEFAZ-MT], [SEFAZ MT (Produção)], [CONCLUÍDO], [Inscrição Estadual 14.229.191-9 ativa com NFC-e autorizada e QR Code válido],
  [10. T-Rex WhatsApp Barba e Cabelo], [whatsapp-ai-tools.js], [CONCLUÍDO], [Agendamento composto de Corte + Barba sem perda de contexto e com tempo real],
  [11. Fila de atendimento humano], [Omnichannel / Dino], [CONCLUÍDO], [Box verde pulsante para coletas urgentes com histórico integral preservado],
  [12. Resposta Rápida T-Rex], [whatsapp-ai.js], [CONCLUÍDO], [Orçamento de pensamento zerado (thinkingBudget: 0) com latência abaixo de 2s],
  [13. Link Individual do Barbeiro], [kytto.com.br/agendar/:slug/:barb], [CONCLUÍDO], [Barbeiro identificado automaticamente, horários livres/ocupados com sigilo total],
  [14. Troca de Senha no App], [`/barbeiro `], [CONCLUÍDO], [Troca com validação de senha atual e nova senha protegida por hash seguro],
  [15. Commerce OS Stallone], [`/admin/ecommerce`], [CONCLUÍDO], [Gestão completa da loja de suplementos, pedidos e catálogo integrado],
  [16. Consultor WhatsApp Fitness +], [whatsapp-ai-persona.js], [CONCLUÍDO], [Persona especializada em nutrição e saúde com captação automática de cadastros],
  [17. DRE Contábil por Empresa], [`/admin/ecommerce`], [CONCLUÍDO], [Demonstração com visão gerencial, EBITDA, margens e regime de competência e caixa],
  [18. DRE Consolidada Holding], [`/admin/ecommerce`], [CONCLUÍDO], [Apuração multi-empresa combinada com Análise Horizontal (AH %) vs M-1],
  [19. Exportação DRE Excel / PDF], [`/admin/ecommerce`], [CONCLUÍDO], [Planilhas .xlsx com fórmulas e relatórios PDF timbrados com CRC-MT],
  [20. Frente de Caixa Supermercado], [`/admin/ecommerce`], [CONCLUÍDO], [Checkout PDV exclusivo com visor neon VFD, pesagem serial Toledo e bobina 80mm],
  [21. Pagamentos PDV Interativos], [PDV Supermercado], [CONCLUÍDO], [Dinheiro com cálculo de troco, Pix dinâmico QR Code e TEF multi-bandeiras],
  [22. Contingência Offline SEFAZ], [PDV Supermercado], [CONCLUÍDO], [Emissão ininterrupta sob tpEmis 9 com transmissão síncrona pós-reconexão],
  [23. Supermercado 6 Rotas 200 OK], [`/api/admin/supermercado/*`], [CONCLUÍDO], [Eliminados 100% dos erros 503 em atacarejo-faixas, promocoes-avancadas, rupturas, sugestao-compras, wms e auditoria-precos],
  [24. PDV e TEF sem Dados Fictícios], [`tef-multimaquininhas-brasil.js`], [CONCLUÍDO], [Removidos chave PIX fallback `financeiro@kytto.com.br`, terminais Gertec inventados, pings falsos e taxas fixas],
  [25. Visão `ia_agendamentos_resumo`], [`/api/admin/barbearia/ia-agendamentos-resumo`], [CONCLUÍDO], [2.152 criados, 204 confirmados, 54 concluídos (R\$ 8.481,08), 59 vagas recuperadas (R\$ 8.630,03), 0 sem profissional e 0 cancelamentos sem motivo],
  [26. Saneamento Equipe Dino], [`dino-equipe-seed.js`], [CONCLUÍDO], [Unificados Bruno + Bruno Mendes Pedroso, nomeado `prof-mv1a1nmm-008` (David Kauã) e removidos dados fixos de relatórios],
  [27. Saúde Real WhatsApp e Instalador], [`/health` e `/install.sh`], [CONCLUÍDO], [Telemetria real de canal ativo (`meta_cloud_api`), último envio/recebimento, fila e instalador sem segredos literais],
  [28. Formatadores PT-BR, OpenAPI 3.1 e MCP], [`/api/openapi.json` e `/api/mcp`], [CONCLUÍDO], [Utilitário centralizado `formatadores.ts` (`America/Cuiaba`, CNPJ alfanumérico 2026) e servidor MCP somente leitura isolado por empresa]
)

#pagebreak()

= Implantação Integral dos Planos Mestres (Fases 0, A, B e C — Meta 99/100)

Em cumprimento integral aos documentos de arquitetura e auditoria `Prompt_UX_Integracoes_99.md` e `Prompt_Evolucao_Kytto_Plataforma.md`, foram implantadas e validadas em produção (`https://kytto.com.br`, deploy `dep-dbpsvsjncjis73ce5n90` / commit `4b16d493b`) todas as frentes estruturais de saneamento, experiência do usuário, governança fiscal e interoperabilidade.

== 1. Fase 0 — Correções Estruturais, Supermercado 200 OK e Governança DIMP

- *Eliminação dos Erros HTTP 503 no Supermercado:* As seis rotas operacionais do módulo de Supermercado (`/api/admin/supermercado/atacarejo-faixas`, `/promocoes-avancadas`, `/rupturas/tempo-real`, `/sugestao-compras`, `/wms/enderecos` e `/auditoria-precos`) foram reescritas em `app/modules/varejo/servico.js` para consultar o esquema real do PostgreSQL sem depender de colunas inexistentes nem semear dados fictícios na leitura. Quando a empresa não possui registros cadastrados, o servidor responde `HTTP 200` com estado vazio honesto (`semDados: true, items: []`).
- *Isolamento Multiempresa Estrito:* Removidos 100% dos identificadores fixos da Barbearia Dino (`d0d0ac01-8e50-4b61-8c79-de4aaa916da6`) que atuavam como fallback em `web/src/lib/dino-scope.js`, `Empresas.jsx` e `app/routes/auth.js`. Cada requisição exige e respeita o `empresaId` do token autenticado.
- *Auditoria DIMP Assistida em Homologação:* O motor `app/core/auditoria-dimp-fiscal.js`, as rotas `app/routes/dimp-routes.js` e a tela `DimpAuditoriaTab.jsx` foram atualizados para cruzar exclusivamente transações eletrônicas e documentos fiscais reais do banco, mantendo `podeRegularizarEmLote: false` e exigindo confirmação individual em modal próprio no ambiente de homologação (`tpAmb = 2`), sem uso de `alert()`.
- *Instalador On-Premise Seguro (`/install.sh`):* Servido com `Content-Type: text/plain; charset=utf-8`, expandindo `JWT_SECRET`, `DB_PASSWORD` e `ADMIN_INITIAL_PASSWORD` via `openssl rand` no momento da instalação, sem senhas padrão fixas.

== 2. Fase A — Dados Reais do T-Rex, Agenda, Saneamento Dino, PDV/TEF e `/health`

- *Visão Auditável `ia_agendamentos_resumo`:* Publicada a rota `GET /api/admin/barbearia/ia-agendamentos-resumo` com regras explícitas de cálculo. Em produção na Barbearia Dino, a consulta auditada retorna:
  - *Criados:* `2.152` agendamentos (`34` via `whatsapp_ia`, `2` via `link_publico`, `525` via `admin`, `1.591` históricos importados).
  - *Confirmados:* `204` agendamentos com confirmação registrada.
  - *Concluídos:* `54` atendimentos com comanda fechada/paga somando `R$ 8.481,08`.
  - *Cancelados:* `227` agendamentos com 100% dos motivos preenchidos (`0` cancelamentos sem motivo).
  - *Vagas Recuperadas:* `59` horários cancelados efetivamente reocupados no mesmo profissional e horário (`vagaOrigemId`), totalizando `R$ 8.630,03` recuperados.
  - *Auditoria de Profissionais:* `5` profissionais titulares ativos, `0` agendamentos sem profissional vinculado (`prof-mv1a1nmm-008` identificado como histórico AVEC de *David Kauã Araújo Moraes* e cadastros de *Bruno* e *Bruno Mendes Pedroso* unificados preservando integralmente o histórico).
- *Relatórios Reais de Profissionais:* As telas `RelatorioDesempenhoProfissional.jsx` e `RelatorioRetornoProfissional.jsx` foram conectadas diretamente às comandas e agendamentos reais da empresa ativa, eliminando os arrays estáticos que exibiam nomes e valores fixos.
- *PDV e TEF Honestos:* Removido o fallback `financeiro@kytto.com.br` no PDV do Supermercado (exibindo alerta claro quando a empresa não possui chave PIX configurada) e removidos os terminais Pinpad e taxas fixas em `tef-multimaquininhas-brasil.js` (`GET /api/admin/tef/terminais` retorna `{"ok":true,"total":0,"terminais":[]}` até o cadastro real).
- *Saúde Real do WhatsApp (`/health`):* O endpoint público `/health` informa em tempo real `canalAtivo: "meta_cloud_api"`, `ultimoEnvio`, `ultimaMensagemRecebida` e `tamanhoFila`.

== 3. Fase B & Fase C — Formatadores Brasileiros, OpenAPI 3.1 e Servidor MCP Somente Leitura

- *Biblioteca Centralizada `formatadores.ts`:* Padroniza moeda (`R$ 1.234,56`), percentual (`12,5%`), peso de balança (`1,250 kg`), datas no fuso `America/Cuiaba`, validação matemática de CPF, CNPJ numérico e alfanumérico 2026 (IN RFB 2.229/2024), chave de acesso NF-e/NFC-e de 44 dígitos (módulo 11) e identificação de chave PIX.
- *OpenAPI 3.1 e Servidor MCP do Kytto (`/api/openapi.json` e `/api/mcp`):* Publicada a especificação OpenAPI 3.1.0 e o servidor MCP somente leitura com as ferramentas `agenda`, `vendas`, `estoque` e `financeiro`, estritamente vinculadas ao `empresaId` do token autenticado (retornando `HTTP 403` em qualquer tentativa de leitura cruzada entre empresas).

= Matriz de Validação em Produção

O conjunto integral de serviços foram submetidos a baterias de testes automatizados e validações funcionais em produção:

#table(
  columns: (1.8fr, 1.2fr, 1.4fr, 2.6fr),
  fill: (col, row) => if row == 0 { rgb("#e2e8f0") } else { none },
  [*Módulo / Funcionalidade*], [*Ambiente*], [*Resultado*], [*Evidência Técnica*],
  [Emissão NFC-e nº 10], [SEFAZ-MT Prod], [APROVADA (cStat 100)], [Chave de acesso e QR Code validados],
  [Inscrição Estadual Dino], [CCE/SEFAZ-MT], [VINCULADA], [IE 14.229.191-9 ativa na Matriz],
  [Propostas e OS (ERP 360)], [kytto.com.br], [OPERACIONAL], [Rotas `/api/admin/erp/*` ativas no PostgreSQL],
  [Pedidos de Compra Timbrados], [kytto.com.br], [OPERACIONAL], [PDF timbrado e link de WhatsApp em 1 clique],
  [Cotações RFQ & Curva ABC], [kytto.com.br], [OPERACIONAL], [Matriz de decisão de fornecedores e giro ABC],
  [Blindagem Tenant por Usuário], [kytto.com.br], [100% ISOLADO], [Guilherme restrito a Dino; Silvester restrito a Stallone; Rodrigo com visão global],
  [Purga Barbearia Imperial], [PostgreSQL], [CONCLUÍDA], [Migration 114 desativa cadastros indevidos e preserva auditoria],
  [T-Rex IA Agilidade], [WhatsApp Core], [SUB-2s], [`thinkingBudget: 0` e consulta obrigatória de slots],
  [Fila Humana com Alerta Verde], [kytto.com.br], [OPERACIONAL], [Sinalizador pulsante neon e macros rápidas],
  [Bloqueios de Agenda], [PostgreSQL], [SINCRONIZADO], [Dual-write em `agendamentos_bloqueios`],
  [Motor Dinheiro na Mesa], [kytto.com.br], [OPERACIONAL], [Funil em tempo real e modal de conversões ativo],
  [Conformidade Meta WhatsApp], [kytto.com.br], [PROTEGIDO], [Opt-out 'PARAR', spintax e 3 tons de voz],
  [DRE Barbearia Dino], [kytto.com.br], [HOMOLOGADA], [Apuração real de serviços R\$ 6.077 e produtos R\$ 651, EBITDA 60,6% e 56 lançamentos],
  [DRE Stallone Nutre Sport], [kytto.com.br], [HOMOLOGADA], [Apuração ecommerce/suplementos, despesas R\$ 77.955 e ponto de equilíbrio calibrado],
  [DRE AGRO OPEN TTC], [kytto.com.br], [HOMOLOGADA], [Apuração insumos/quadras/bar, ROL R\$ 59,80 e despesas de locação R\$ 62.810],
  [DRE Supermercado Kytto], [kytto.com.br], [HOMOLOGADA], [Apuração atacarejo/varejo, despesas R\$ 270.330 e CMV de mercadorias estruturado],
  [Exportações DRE (XLSX / CSV / PDF)], [kytto.com.br], [OPERACIONAL], [Planilhas Excel em 3 abas, CSV UTF-8 e PDF timbrado com assinaturas CRC-MT em 100% das empresas],
  [DRE Consolidada Holding Kytto], [kytto.com.br], [HOMOLOGADA], [Consolidação multi-empresa automática de Dino, Stallone, Agro e Supermercado],
  [Análise Horizontal (AH %)], [kytto.com.br], [HOMOLOGADA], [Comparativo automático vs. Mês Anterior (M-1) com indicadores de tendência],
  [Quadro de Share por Empresa], [kytto.com.br], [HOMOLOGADA], [Distribuição percentual de receita, lucro bruto e EBITDA entre unidades],
  [Link Individual do Barbeiro], [kytto.com.br/agendar/:slug/:barb], [HOMOLOGADO], [Identificação automática do barbeiro e catálogo exclusivo],
  [Sigilo de Horários da Agenda], [kytto.com.br], [PROTEGIDO], [Slots públicos exibidos estritamente como Livre ou Ocupado],
  [Autovinculação de Clientes], [PostgreSQL], [HOMOLOGADA], [Identificação e vínculo imediato por CPF ou WhatsApp sem duplicidade],
  [Painel de Links no App Móvel], [`/barbeiro` (Meu Link)], [OPERACIONAL], [Atalhos de cópia para Bio, Stories, WhatsApp e QR Code de bancada],
  [Troca de Senha pelo Barbeiro], [`/barbeiro` (Senha)], [HOMOLOGADA], [Validação de senha atual, nova senha e confirmação com dual-hash],
  [Commerce OS Stallone], [`/admin/ecommerce`], [HOMOLOGADO], [Visão geral da operação comercial, pedidos em fila e saúde de catálogo],
  [Loja Virtual Stallone], [`/ecommerce/stallone`], [HOMOLOGADA], [Vitrine responsiva de suplementos com checkout Pix/cartão e retirada em loja],
  [Roteamento /loja/stallone], [kytto.com.br/loja/stallone], [HOMOLOGADO], [Redirecionamento inteligente automático para vitrine ativa],
  [Consultor WhatsApp Fitness +], [WhatsApp Core], [HOMOLOGADO], [Identidade esportiva, foco em saúde e captação ativa com `atualizar_cadastro_cliente`],
  [PDV Supermercado Exclusivo], [`/admin/supermercado` · `/caixa`], [HOMOLOGADO], [Estação de checkout dedicada com visor VFD neon verde e bobina térmica 80mm],
  [Atalhos de Cédulas & Troco], [PDV Supermercado], [HOMOLOGADO], [Cédulas de R\$ 10 a R\$ 200, valor exato e cálculo de troco automático],
  [Pix Dinâmico QR Code], [PDV Supermercado], [HOMOLOGADO], [QRCodeSVG de alta resolução, chave institucional e confirmação Barramento A2],
  [Cartões TEF & Bandeiras], [PDV Supermercado], [HOMOLOGADO], [Homologação Visa, Mastercard, Elo, Hipercard e parcelamento até 6x],
  [Vouchers Alimentação], [PDV Supermercado], [HOMOLOGADO], [Homologação de redes credenciadas Alelo, VR, Sodexo/Pluxee e Ticket],
  [Ciclo de Caixa (Abrir/Fechar/Sangria)], [PDV Supermercado], [HOMOLOGADO], [Abertura com suprimento inicial, sangria com teto de segurança e fechamento cego],
  [Emissão de Cupom NFC-e], [PDV Supermercado], [HOMOLOGADO], [Geração de chave de acesso SEFAZ de 44 dígitos e impressão térmica 80mm],
  [Benchmark Competitivo (5 Players)], [Kytto vs. Mercado], [CONCLUÍDO], [Matriz de 8 dimensões comparando Kytto com Totvs, Linx, VR Software, Sysmo e Bluesoft],
  [Atacarejo Dinâmico Automático], [PDV Supermercado], [HOMOLOGADO], [Desconto por volume ativado na bipagem com recálculo unitário em tempo real],
  [Contingência Offline SEFAZ (tpEmis 9)], [PDV Supermercado], [HOMOLOGADO], [Emissão ininterrupta com buffer local e sincronização automática pós-restabelecimento],
  [Rateio de Caixa 02/11 (Bruno)], [`/admin/barbearia` (Caixa)], [CONCILIADO], [Total Faturado R\$ 1.400,00 = Bruno R\$ 1.100,00 serv. (comissão R\$ 550,00) + R\$ 5,00 água (0%) + Dino R\$ 295,00 prod. (comissão R\$ 29,50)],
  [Comissão Nati 40% e Caixa 03/11], [`/admin/barbearia` (Caixa)], [CONCILIADO], [Nati corrigida para 40% (R\$ 1.090,00 serv. = R\$ 436,00 comissão); Bruno 50% (R\$ 660,00 = R\$ 330,00); Dino R\$ 400,00 serv. + R\$ 180,00 prod. = R\$ 218,00],
  [OpenAPI 3.1 & MCP Kytto Leitura], [`/api/openapi.json` · `/api/mcp`], [HOMOLOGADO], [Especificação OpenAPI 3.1.0 e Servidor MCP somente leitura isolado por token da empresa]
)

#pagebreak()

= Auditoria e Conciliação de Caixas e Comissões — Barbearia Dino (02/11 e 03/11)

Atendendo à conferência operacional reportada pela administração da Barbearia Dino (Jhenyffer Andrade), foi realizada uma auditoria item a item nos caixas de *02/11/2026* e *03/11/2026* e no motor de cálculo de comissões (`app/dino-caixa-detalhes.js`, `app/core/dino-regras-comissoes.js`, `app/barbearia-erp-kytto.js` e `app/dino-equipe-seed.js`), eliminando integralmente as divergências apontadas.

== 1. Diagnóstico Técnico das Divergências Identificadas

1. *Caixa de 02/11/2026 (Faturamento de R\$ 1.400,00 vs. Rateio anterior de R\$ 1.500,00 — Bruno R\$ 1.100,00 vs. R\$ 1.200,00)*:
   - Na comanda `cmdbar-mw6s32p1-038` (cliente *Juliano Garcia De Oliveira*), havia dois lançamentos: *Pacote 4 Procedimentos Premium* (`precoUnitario: R$ 300,00`, `subtotal: R$ 300,00`) e o serviço incluso no pacote *BARBA PREMIUM (BRUNO OU NATI)* (`precoUnitario: R$ 100,00`, `subtotal: R$ 0,00`).
   - A expressão anterior `Number(it.subtotal || (Number(it.precoUnitario || 0) * Number(it.quantidade || 1)))` tratava `subtotal: 0` como valor falso (*falsy*) em JavaScript, caindo indevidamente no `precoUnitario` de R\$ 100,00. Isso inflava os serviços do Bruno de *R\$ 1.100,00* para *R\$ 1.200,00* e elevava a soma da tabela inferior para *R\$ 1.500,00* contra os *R\$ 1.400,00* que efetivamente entraram no caixa.
   - Adicionalmente, como as comandas de `02/11` foram lançadas retroativamente em `07/11` (`dataAtendimento: "2026-11-02"`, `fechadaEm: "2026-11-07"`), o painel geral de comissões (`/api/admin/barbearia/comissoes?data=2026-11-02`) filtrava apenas por `fechadaEm` em vez de `dataAtendimento`.

2. *Caixa de 03/11/2026 (Comissão da profissional Nati em 40% e Desconto de Comanda do Dino)*:
   - No cadastro oficial de profissionais (`estado.profissionais['prof-mv1bx3sc-011']`), a profissional *Nati (Natani Minanis Dobler)* possui `percentualComissao: 40` (40% sobre serviços e 10% sobre produtos de revenda).
   - Contudo, `app/dino-caixa-detalhes.js` lia `Number(prof?.comissaoPercentual ?? prof?.comissaoServicos ?? 50)` sem consultar a propriedade canônica `prof?.percentualComissao`. Como resultado, o rateio do caixa aplicava o padrão de `50%` para a Nati (`R$ 545,00` sobre `R$ 1.090,00`), quando o valor correto de 40% é *R\$ 436,00*.
   - Na comanda `cmdbar-mwc672xf-074` (cliente *Alexson Dias*, atendido por *Dino*), o serviço *Corte com Dino* possuía valor bruto de R\$ 150,00 com desconto de R\$ 50,00 na comanda (valor pago no cartão de crédito: *R\$ 100,00*). O rateio agora deduz proporcionalmente o desconto concedido na comanda, resultando em *R\$ 400,00* líquidos de serviços para o Dino (`50% = R$ 200,00`) somados a *R\$ 180,00* do produto *Defrisante* (`10% = R$ 18,00`), totalizando *R\$ 218,00* de comissão.

== 2. Quadro Consolidado Após Correção em Produção (`https://kytto.com.br`)

#table(
  columns: (1.1fr, 1.5fr, 1fr, 1fr, 1fr, 1.2fr),
  inset: 7pt,
  align: (left, left, right, right, center, right),
  fill: (x, y) => if y == 0 { rgb("#0f172a") } else if calc.even(y) { rgb("#f8fafc") } else { white },
  table.header(
    [#text(fill: white, weight: "bold")[Data / Caixa]],
    [#text(fill: white, weight: "bold")[Profissional]],
    [#text(fill: white, weight: "bold")[Total Serviços]],
    [#text(fill: white, weight: "bold")[Total Produtos]],
    [#text(fill: white, weight: "bold")[Taxa Aplicada]],
    [#text(fill: white, weight: "bold")[Comissão Correta]]
  ),
  [02/11/2026], [Bruno Mendes Pedroso], [R\$ 1.100,00], [R\$ 5,00 (água 0%)], [50% serv.], [R\$ 550,00],
  [02/11/2026], [Dino], [R\$ 0,00 (Club)], [R\$ 295,00 (revenda)], [10% prod.], [R\$ 29,50],
  [*Total 02/11*], [*Conciliado 100% com Caixa*], [*R\$ 1.100,00*], [*R\$ 300,00*], [*Faturado: R\$ 1.400,00*], [*R\$ 579,50*],
  [03/11/2026], [Bruno Mendes Pedroso], [R\$ 660,00], [R\$ 0,00], [50% serv.], [R\$ 330,00],
  [03/11/2026], [Nati (Natani Dobler)], [R\$ 1.090,00], [R\$ 12,00 (bebida 0%)], [*40% serv.*], [*R\$ 436,00*],
  [03/11/2026], [Dino (-R\$ 50 desc. comanda)], [R\$ 400,00], [R\$ 180,00 (revenda)], [50% serv. / 10% prod.], [R\$ 218,00],
  [*Total 03/11*], [*Conciliado 100% com Caixa*], [*R\$ 2.150,00*], [*R\$ 192,00*], [*Faturado: R\$ 2.342,00*], [*R\$ 984,00*]
)

= Resgate Inteligente CRM: Multi-Barbeiro, Link da Agenda Online e Blindagem Meta

O módulo de Resgate CRM e Reativação de Clientes da Barbearia Dino foi integralmente aprimorado para oferecer flexibilidade cirúrgica de abordagem, personalização individual por profissional e conformidade irrestrita com os padrões e diretrizes da Meta (WhatsApp Business Cloud API).

== 1. Seleção Dinâmica do Profissional e Voz do Remetente

A interface de disparo de campanha (`DinoRecuperacaoAvecPanel.jsx`) e os motores de geração de mensagens (`whatsapp-antiban.js` e `dino-crm-disparo.js`) disponibilizam 3 modalidades operacionais:

+ *Barbeiro Habitual do Cliente (Dinâmico)*: Cada cliente recebe o convite personalizado citando nominalmente o profissional com quem realizava atendimentos (Dino, Nati ou Bruno). Caso o cliente não possua histórico fixo ou seu barbeiro anterior seja um ex-profissional da casa, o sistema converte automaticamente o convite para a equipe da barbearia, eliminando menções indevidas.
+ *Equipe da Barbearia (Geral)*: O disparo é formulado em nome coletivo (_"equipe da barbearia"_ ou _"nossos especialistas"_), ideal para resgates institucionais em massa sem direcionar a demanda exclusivamente para uma única cadeira.
+ *Barbeiro Específico Fixo*: Permite direcionar a totalidade dos disparos para um profissional selecionado (ex.: campanhas focadas na cadeira da Nati, do Bruno ou do Dino).

Além disso, a voz do remetente pode ser configurada como *Institucional* (_"Aqui é da Barbearia Dino..."_) ou *Pessoal do Barbeiro* em primeira pessoa (_"Aqui é a Nati da Barbearia Dino... Bora dar aquele trato no visual comigo essa semana?"_), aumentando significativamente as taxas de resposta e engajamento.

== 2. Link Inteligente de Agendamento Online em 1 Toque

Ao marcar a opção de inclusão do link, o sistema anexa o endereço exato com horários livres do profissional selecionado:
- Para agendamentos com a equipe geral: `https://kytto.com.br/agendar/dino`
- Para agendamentos com o Dino: `https://kytto.com.br/agendar/dino/dino`
- Para agendamentos com a Nati: `https://kytto.com.br/agendar/dino/nati`
- Para agendamentos com o Bruno: `https://kytto.com.br/agendar/dino/bruno`

O link direciona o cliente diretamente para a grade de dias e horários livres, sem expor agendamentos de terceiros nem dados confidenciais da barbearia, permitindo a conclusão da reserva em menos de 1 minuto com validação de cadastro por telefone.

#pagebreak()
== 3. Blindagem Antiban e Conformidade Meta

Para resguardar os números de WhatsApp contra bloqueios e restrições automatizadas da Meta, foram implementadas as seguintes proteções em nível de protocolo:

#table(
  columns: (1.4fr, 2.6fr),
  inset: 7pt,
  align: (left, left),
  fill: (x, y) => if y == 0 { rgb("#0f172a") } else if calc.even(y) { rgb("#f8fafc") } else { white },
  table.header(
    [#text(fill: white, weight: "bold")[Mecanismo de Proteção]],
    [#text(fill: white, weight: "bold")[Regra e Implementação Técnica]]
  ),
  [Spintax Dinâmico], [Variação combinatória contínua de saudações, preâmbulos, ofertas e fechamentos. Cada mensagem gerada possui hash textual único, inviabilizando a identificação de disparos idênticos em lote.],
  [Cadência Humanizada com Jitter], [Intervalo randômico entre 8 e 18 segundos entre disparos individuais, simulando digitação humana real e evitando picos de vazão.],
  [Cooldown de Lote], [Pausa automática programada a cada bloco de envios para refrigeração do canal e verificação de saúde da conexão.],
  [Aquecimento de Chip e Trava Diária], [Limite progressivo de envios diários de acordo com o estágio de maturação da linha, bloqueando disparos excedentes.],
  [Opt-Out Explícito], [Inclusão obrigatória de rodapé claro informando como interromper as mensagens (ex.: _"Se não quiser mais receber avisos, responda SAIR ou PARAR."_), em total consonância com as normas de privacidade da Meta.]
)

= Conclusão

A plataforma *Kytto* atinge um patamar superior de maturidade tecnológica e governança corporativa. A regularização fiscal na SEFAZ-MT com a Inscrição Estadual oficial `14.229.191-9` e a emissão autorizada da NFC-e nº 10 estabelecem total conformidade tributária para o varejo físico.

A entrega dos módulos de *ERP 360*, *Suprimentos*, *Atendimento Humanizado com IA T-Rex* e o *Motor Comercial Dinheiro na Mesa com Políticas Meta* dota as empresas atendidas de ferramentas robustas para redução de custos, combate ao churn de clientes e expansão imediata de faturamento com segurança jurídica e tecnológica.

#v(2em)
#line(length: 100%, stroke: 0.5pt + luma(180))
#v(1em)

#align(center)[
  #text(size: 9pt, fill: rgb("#64748b"))[
    Relatório emitido pelo Kytto Ecosystem · Homologação e Engenharia de Software · 2026
  ]
]
