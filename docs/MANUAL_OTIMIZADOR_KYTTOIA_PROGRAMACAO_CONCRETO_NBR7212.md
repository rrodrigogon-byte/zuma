# MANUAL TÉCNICO & OPERACIONAL: MOTOR KYTTOIA DE OTIMIZAÇÃO DE ESCALA, PREDIÇÃO DE SLUMP LOSS E PREVENÇÃO DE GARGALOS

**Serrano Concreto Usinado**  
*Módulo de Programação & Operação de Concreto Usinado*  
*Localização da Central: Rodovia MT-358, Km 06, Tangará da Serra/MT*  
*Ambiente Oficial de Produção: `https://kytto.com.br/admin/concreto?secao=operacao-programacao`*  
*Versão da KyttoIA: Motor KyttoIA 2.5 Flash Industrial (Kytto Logística & Automação)*  
*Data de Homologação: 13 de Novembro de 2026*  

---

## 1. Sumário Executivo & Diretriz Tecnológica KyttoIA

A operação diária de uma concreteira de alto desempenho exige precisão matemática, controle tecnológico estrito sobre o estado fresco do concreto e sincronismo absoluto entre a central dosadora (Central Convicta 80 m³/h), a balança rodoviária de 80 toneladas e a frota de caminhões betoneiras 6x4 e bombas de concreto.

O **Motor KyttoIA** integra algoritmos de otimização combinatória para roteirização e escalonamento de veículos com janelas de tempo perecíveis (*VRPTW - Vehicle Routing Problem with Time Windows*), alinhado a modelos preditivos de *Machine Learning* e física de materiais baseados na perda de abatimento (*Slump Loss*) e na taxa de evaporação superficial da água de hidratação.

Toda a infraestrutura do sistema foi concebida sob rigorosa conformidade com o arcabouço normativo brasileiro da **ABNT** e padrões internacionais de engenharia civil (**ACI - American Concrete Institute**).

```
               ┌───────────────────────────────────────────────────────────┐
               │           MOTOR KYTTOIA 2.5 FLASH LOGÍSTICO               │
               │   • Algoritmo de Carrossel de Betoneiras                  │
               │   • Modelo Preditivo de Slump Loss (Ravina-Soroka ML)     │
               │   • Cálculo de Evaporação ACI 305R & Fissuração Plástica  │
               └───────────────┬───────────────────────────┬───────────────┘
                               │                           │
              ▼────────────────┴─────────▼       ▼─────────┴────────────────▼
     Normas ABNT Regulamentadoras                 Ecossistema Aberto GitHub & MCP
     • ABNT NBR 7212:2012 / 2024                  • Google OR-Tools (VRPTW)
     • ABNT NBR 8953:2015                         • Meta BOxCrete (Bayesian Concrete)
     • ABNT NBR 12655:2022                        • Project OSRM (Roteamento 32t)
     • ACI 305R-20 / NBR 14931:2023               • MCPs: Open-Meteo, OR-Tools, OSRM
```

---

## 2. Normas Técnicas e Padrões Regulamentadores de Mercado

### 2.1 ABNT NBR 7212:2012 / 2024 — Concreto dosado em central: Preparo, fornecimento e controle
A NBR 7212 estabelece as regras de ouro para o transporte e entrega do concreto fresco:
1. **Tempo Máximo de Transporte e Descarga**:
   - **Sem aditivo retardador**: Máximo de **90 minutos** contados desde o primeiro contato da água com o cimento e agregados até o final da descarga na obra.
   - **Com aditivo plastificante retardador de pega (NBR 11768 Tipo PR)**: Limite estendido para até **150 minutos**, desde que comprovada a manutenção do abatimento e trabalhabilidade.
2. **Velocidade de Rotação do Balão da Betoneira**:
   - **Mistura / Homogeneização inicial**: 12 a 18 rpm (mínimo de 70 rotações antes da saída do pátio).
   - **Transporte em trânsito**: 2 a 6 rpm (agitação lenta obrigatória; proibido desligar o giro do balão para evitar segregação granulométrica).
   - **Descarga na obra**: 10 a 14 rpm em sentido reverso.
3. **Proibição Absoluta de Adição Indevida de Água ("Água de Quebra")**:
   - É terminantemente proibido acrescentar água na obra após a saída da central, sob pena de perda imediata da garantia de fck e aumento inaceitável da relação água/cimento (a/c).
   - Qualquer ajuste de trabalhabilidade na obra deve ser efetuado exclusivamente com aditivo superplastificante dosado pelo laboratorista ou motorista treinado.

### 2.2 ABNT NBR 8953:2015 — Concreto para fins estruturais: Classificação
Classifica as classes de resistência e consistência:
- **Classes de Resistência**: C20, C25, C30 (lajes e vigas convencionais), C35 (pilares e pisos industriais), C40 e C50 (estruturas especiais de alta solicitação).
- **Classes de Abatimento (NBR NM 67)**:
  - **S10**: 10 a 40 mm (concreto seco / extrusado).
  - **S50**: 50 a 90 mm (concreto convencional não bombeável).
  - **S100**: 100 a 150 mm (concreto bombeável padrão para edifícios).
  - **S160**: 160 a 210 mm (concreto super-bombeável para mastros longos e peças densamente armadas).

### 2.3 ACI 305R-20 & ABNT NBR 14931:2023 — Concretagem em Clima Quente & Junta Fria
Em regiões como Tangará da Serra/MT, com temperaturas frequentes acima de 32°C e baixa umidade relativa:
- **Fórmula de Menzel / ACI 305R** para taxa de evaporação superficial de água ($E$ em kg/m²/h):
  $$E = 5 \times \left[(T_c + 18)^{2.5} - \frac{UR}{100}(T_a + 18)^{2.5}\right] \times (V + 4) \times 10^{-6}$$
- **Critério de Risco de Fissuração por Retração Plástica**:
  - $E < 0.5 \text{ kg/m²/h}$: Risco Baixo. Cura úmida convencional.
  - $0.5 \le E \le 1.0 \text{ kg/m²/h}$: Risco Moderado. Proteção contra ventos e aspersão rápida.
  - $E > 1.0 \text{ kg/m²/h}$: **Risco Crítico**. Exige aplicação imediata de cura química por película impermeabilizante ou lona plástica estanque logo após o sarrafeamento.
- **Prevenção de Junta Fria Estrutural (NBR 14931)**:
  - O intervalo de tempo entre betoneiras sucessivas para a mesma peça estrutural não pode ultrapassar a janela de início de pega do concreto lançado. Caso excedido, ocorre descontinuidade mecânica e delaminação estrutural.

---

## 3. Arquitetura do Modelo de Machine Learning & Slump Loss

O motor de IA da KyttoIA utiliza um modelo paramétrico calibrado contra ensaios reais de laboratório em Tangará da Serra com cimentos CP II-F e CP IV, ponderando:
1. **Temperatura Ambiente e do Concreto ($T$)**: O calor acelera exponencialmente a taxa de hidratação do cimento portland ($\sim (T/20)^{1.35}$).
2. **Tempo de Trânsito ($t$)**: Degradação progressiva da pasta lubrificante e quebra de agregados finos por fricção mecânica do balão.
3. **Tipo de Aditivo Químico**:
   - *Sem aditivo*: perda de slump acelerada em até 0.08 cm/min.
   - *Plastificante convencional (NBR 11768 Tipo P)*: redução de 40% na perda.
   - *Plastificante Retardador (TecFlow R)*: redução de 75% na perda e retardo de pega de 60 min.
   - *Superplastificante Policarboxilato (TecFlow Max)*: redução de 85% na perda e manutenção da fluidez por 90 min.
4. **Predição de Bombeabilidade**:
   - $Slump \ge 12 \text{ cm}$: Bombeabilidade ótima para bomba lança (Schwing 32m) e estacionária (Putzmeister BSA 1409).
   - $10 \le Slump < 12 \text{ cm}$: Limítrofe. Recomendada adição corretiva de superplastificante.
   - $Slump < 10 \text{ cm}$: **Inviável**. Risco severo de entupimento da tubulação e sobrepressão hidráulica.

---

## 4. Otimização da Linha de Produção & Gargalos na Central Convicta

A Central Dosadora Convicta possui capacidade nominal de 80 m³/h, com ciclo real de batelada de 6 a 8 minutos por caminhão de 8 m³. Os principais gargalos prevenidos pela KyttoIA são:
1. **Conflito de Carregamento na Central**: Quando duas cargas exigem a mesma boca dosadora simultaneamente, a KyttoIA descola a saída do 2º caminhão em 10 a 12 minutos, eliminando filas de espera e evitando que o caminhão carregado fique retido no pátio aquecendo o concreto.
2. **Prevenção de Junta Fria via Escala em Carrossel**: Em concretagens de grande volume (ex: 24 m³ a 48 m³), o sistema aloca automaticamente as betoneiras (BT-01, BT-02, BT-03, BT-04, BT-05) com intervalo desfasado ideal de 20 a 30 minutos, garantindo que o caminhão subsequente chegue à obra exatamente quando a bomba lança finaliza a descarga da viagem anterior.
3. **Detecção Comercial de Sub-Carga**: Cargas com volume inferior a 4.0 m³ acionam alerta imediato para cobrança de taxa de frete fracionado (R$ 180,00) ou reagrupamento geográfico com obras vizinhas.

---

## 5. Ecossistema Aberto GitHub & MCP (Model Context Protocol)

O sistema KyttoIA foi desenhado para se comunicar nativamente com os padrões abertos da indústria de tecnologia e otimização:

| Repositório / Framework | Função Principal no Sistema |
| :--- | :--- |
| **Google OR-Tools** (`google/or-tools`) | Resolução matemática exata do problema de roteamento e sequenciamento de frotas com perecibilidade e janelas restritas de tempo. |
| **Meta BOxCrete** (`facebookresearch/SustainableConcrete`) | Otimização Bayesiana de traço de concreto para redução da pegada de carbono ($CO_2$) sem perda de fck aos 28 dias. |
| **Project-OSRM** (`Project-OSRM/osrm-backend`) | Motor de roteamento geográfico de alta velocidade baseado no OpenStreetMap com restrição de pontes e peso bruto total (32 toneladas). |
| **MCP `mcp-open-meteo`** | Servidor de contexto para injeção de telemetria climática em tempo real (temperatura horária, umidade relativa e velocidade do vento). |
| **MCP `mcp-or-tools-solver`** | Microserviço autônomo para compilar e resolver matrizes de despacho em tempo real. |
| **MCP `mcp-georouting-osrm`** | Cálculo dinâmico de tráfego pesado e distâncias reais até os canteiros de obras de Tangará da Serra. |

---

## 6. Guia Prático de Operação no ERP Serrano Concreto

1. Acesse o ERP em `https://kytto.com.br/admin/concreto?secao=operacao-programacao`.
2. Observe o **Card de Score Logístico KyttoIA** no topo da tela (exibindo pontuação de eficiência e status de conformidade NBR 7212).
3. Clique no botão de destaque **"🤖 Otimizador KyttoIA: Sugerir Escala"**.
4. No modal interativo:
   - **Aba 1 (Escala Otimizada)**: Visualize todas as viagens sugeridas, horários de saída/chegada/descarga e margens de tempo normativo. Clique em **"Aplicar Escala Otimizada na Programação"** para atualizar toda a grade instantaneamente.
   - **Aba 2 (Gargalos & Mitigação)**: Verifique alertas de junta fria, sub-carga e fila de central, com a ação corretiva prescrita pela IA.
   - **Aba 3 (Timeline Usina)**: Acompanhe a ocupação da boca da central Convicta minuto a minuto.
   - **Aba 4 (Predição Slump Loss ML)**: Ajuste os sliders de temperatura, tempo de viagem e tipo de aditivo para ver em tempo real o abatimento previsto na obra e a taxa de evaporação ACI 305R.
   - **Aba 5 (Normas NBR & GitHub)**: Consulte o guia normativo e as fontes de código aberto do ecossistema.

---
*Documento homologado pela Equipe de Engenharia e Tecnologia Kytto / Serrano Concreto Usinado.*
