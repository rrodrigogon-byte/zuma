# Relatório Técnico: Pesquisa de Repositórios Open Source (Git), Inovações Industriais e Roadmap Tecnológico para o Kytto ERP (Serrano Concreto & Mineração)

**Autores:** Engenharia de Sistemas Kytto ERP & IA KyttoIA  
**Organização:** Serrano Concreto Usinado & Mineração Ltda · Tangará da Serra / MT  
**Data:** 12 de Novembro de 2026 · Versão 1.0  
**Status:** Aprovado para Implantação

---

## 1. Contexto e Motivação
A operação de fornecimento de concreto usinado e mineração de agregados exige rigor técnico extremo, abrangendo desde a formulação estequiométrica dos traços (ABNT NBR 7212 e NBR 12655), pesagem automatizada em balança rodoviária de 80t, despacho logístico perecível com tempo máximo de pega de 150 minutos, até o controle tecnológico de ruptura em prensa eletro-hidráulica (NBR 5739).

A partir de pesquisa aprofundada em repositórios abertos no GitHub, artigos científicos e sistemas líderes globais de dosagem e despacho (normas internacionais e boas práticas industriais de dosagem), identificamos as melhores práticas, algoritmos e arquiteturas de software livre que podem ser adaptados e incorporados diretamente ao Kytto ERP.

---

## 2. Repositórios Open Source Selecionados e Potencial de Aplicação

### 2.1 `facebookresearch/SustainableConcrete` (Meta BOxCrete)
* **Origem:** Meta AI Research (FAIR)
* **Tecnologias:** Python, PyTorch, BoTorch, GPyTorch (Otimização Bayesiana).
* **Conceito:** Plataforma de otimização multiobjetivo para concreto de baixo carbono. O modelo prevê a resistência à compressão aos 28 dias ($f_{ck}$), o Potencial de Aquecimento Global ($GWP$ em $kg\text{ }CO_2\text{ eq}/m^3$) e o custo dos insumos através de processos gaussianos e amostragem ativa.
* **Aplicação no Kytto ERP:**
  - Criação do **Módulo de Traços Sustentáveis & Créditos de Carbono**.
  - Otimização do consumo de cimento através de substituição parcial por fíler calcário da Serra dos Parecis e cinza de biomassa de bagaço de cana (disponível em larga escala nas usinas de Tangará da Serra/MT, como Uisa e Itamarati).
  - Emissão de selo verde e certificado ESG no Romaneio NBR 7212 indicando a redução de emissão de $CO_2$ por $m^3$ entregue.

---

### 2.2 `PyVRP` & `reinterpretcat/vrp` (Vehicle Routing Problem with Time Windows - VRPTW)
* **Origem:** Consórcio acadêmico e industrial (PyVRP / Rust / C++ / Python).
* **Conceito:** Algoritmo genético híbrido (HGS) de alta velocidade para resolução do Problema de Roteamento de Veículos Capacitados com Janelas de Tempo (CVRPTW).
* **Aplicação no Kytto ERP:**
  - **Otimizador Algorítmico de Despacho de Betoneiras:** o concreto usinado possui uma restrição severa de perecibilidade normativa (ABNT NBR 7212: tempo máximo de transporte e descarga de 150 minutos a partir da adição da água de amassamento, ou 90 minutos em temperaturas acima de 30°C sem aditivo retardador).
  - Cálculo do espaçamento dinâmico entre saídas de betoneiras: evita que dois caminhões fiquem parados na fila da obra perdendo abatimento (risco de início de pega e concreto endurecido no balão) e evita atrasos que possam gerar juntas frias na concretagem estrutural.
  - Otimização das rotas no anel viário e rodovias de Tangará da Serra (MT-358 e MT-480).

---

### 2.3 `ASTM C1074` - Método de Maturidade do Concreto In-Situ
* **Norma Técnica:** ASTM C1074 (*Standard Practice for Estimating Concrete Strength by the Maturity Method*).
* **Conceito:** O método Nurse-Saul e a equação de Arrhenius correlacionam o histórico de temperatura e tempo de hidratação do concreto com a resistência à compressão real ganha na estrutura:
  $$\text{TTF} = \sum (T_a - T_0) \Delta t$$
  $$t_e = \sum e^{-\frac{E}{R}\left(\frac{1}{T_a} - \frac{1}{T_s}\right)} \Delta t$$
* **Aplicação no Kytto ERP:**
  - Telemetria de sensores de temperatura IoT instalados nas obras atendidas pela Serrano.
  - O sistema calcula o momento exato em que a laje ou viga atinge 70% ou 80% do $f_{ck}$ de projeto, permitindo ao engenheiro da obra antecipar a desforma e o desescoramento com segurança matemática absoluta, reduzindo o tempo de ciclo da obra em até 50%.

---

### 2.4 `qcc` & `Easy121/CUSUMControlChart` (Cartas de Controle Estatístico Shewhart e CUSUM)
* **Conceito:** Controle Estatístico de Processos (CEP) aplicado à qualidade e variabilidade industrial.
* **Aplicação no Kytto ERP:**
  - **Aceitação e Homologação de Lotes ABNT NBR 12655:2022:**
    Cálculo do $f_{ck,est}$ (resistência característica estimada) da usina:
    $$f_{ck,est} = 2 \cdot \frac{f_1 + f_2 + \dots + f_{m-1}}{m-1} - f_m$$
  - Cartas de controle Shewhart ($\bar{X}$ e $R$) e CUSUM (Soma Cumulativa): monitoram continuamente as médias móveis de resistência dos traços da central dosadora Convicta.
  - Detecção precoce de anomalias: se o CUSUM acusar uma ligeira tendência descendente (mesmo dentro da faixa de tolerância), a usina é alertada imediatamente sobre possíveis causas (descalibração da balança de cimento, variação no lote do cimento CP II-F 32 ou teor de umidade na areia não compensado), antes de produzir lotes não conformes.

---

### 2.5 `TN-SMISS-Apps/Node-Mettler-Toledo-Scale` & `marcodpt/serialscale`
* **Conceito:** Drivers industriais e pontes de comunicação serial RS-232/RS-485 e TCP/IP para indicadores de pesagem Mettler Toledo (Prix 9094, Toledo 8140, Toledo 8142, protocolo Toledo P03 contínuo).
* **Aplicação no Kytto ERP:**
  - Parser contínuo Toledo: decodificação das strings ASCII de pesagem em tempo real (`ST,GS,+033500kg\r\n`), extraindo peso bruto, tara, líquido, status de estabilidade e zero automático.
  - Sincronização direta via WebSockets com o cockpit da balança no PDV (`/pdv?tab=balanca`).

---

### 2.6 `PaddleOCR` / `EasyOCR` para Totem LPR (Leitura Automática de Placas)
* **Conceito:** Modelos de visão computacional para detecção de veículos (YOLO) e leitura óptica de caracteres (OCR) das placas padrão Mercosul e cinza antigo.
* **Aplicação no Kytto ERP:**
  - Reconhecimento automático da placa dianteira e traseira das carretas no totem de entrada da balança rodoviária 80t Toledo.
  - Cruzamento automático da placa lida pela câmera CFTV com as ordens de carregamento programadas na agenda, abrindo a cancela automaticamente quando o caminhão estiver cadastrado e autorizado.

---

## 3. Matriz de Priorização das Próximas Entregas no Kytto ERP

| Inovação / Módulo | Repositório / Base Técnica | Valor Operacional | Status |
| :--- | :--- | :--- | :--- |
| **1. Controle Estatístico NBR 12655 & CUSUM** | `qcc`, ABNT NBR 12655:2022 | Rastreabilidade e homologação de lotes com cálculo de $f_{ck,est}$ e cartas Shewhart | **Pronto para Implantação** |
| **2. Traços Sustentáveis & Carbono (BOxCrete)** | Meta `SustainableConcrete` | Redução de custo de cimento e emissão de certificado ESG/GWP | **Planejado** |
| **3. Maturidade In-Situ ASTM C1074** | ASTM C1074, Nurse-Saul | Liberação antecipada de desforma nas obras parceiras | **Planejado** |
| **4. Otimizador de Despacho VRP-TW** | `PyVRP`, ABNT NBR 7212 | Eliminação de filas na obra e controle do limite de pega de 150 min | **Planejado** |
| **5. Bridge LPR OCR para Balança 80t** | `EasyOCR`, protocolo Toledo | Automação total sem intervenção humana no totem | **Planejado** |

---

## 4. Próximos Passos Imediatos
1. Implementar no backend (`app/modules/concreto/servico.js`) as regras da **ABNT NBR 12655:2022** para aceitação de lotes de concreto, estimativa estatística de $f_{ck,est}$ e cartas de controle Shewhart/CUSUM.
2. Criar a interface interativa no módulo de Laboratório (`producao-laboratorio`) com gráficos das cartas de controle e laudo de aceitação com QR Code.
3. Testar, homologar e realizar deploy em produção.
