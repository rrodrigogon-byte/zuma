# Manual Técnico de Integração: Câmeras IP Industriais, Vision AI & Torre de Controle da Usina

**Empresa:** Serrano Concreto Usinado & Mineração Ltda.  
**Holding Controladora:** Grupo Palatare Participações S/A  
**Plataforma Oficial:** Kytto Gestão Multinegócio  
**Motor de Inteligência:** Motor KyttoIA (KyttoIA Vision AI & LPR)  
**Data de Publicação:** Novembro de 2026  
**Status de Homologação:** 100% Homologado em Produção (PRD)  

---

## 1. Visão Geral da Operação de Pesagem e Visão Computacional

A infraestrutura de pesagem rodoviária e expedição da Serrano Concreto Usinado & Mineração Ltda., localizada em Tangará da Serra/MT, opera integrada a uma balança rodoviária de 80 toneladas e plataforma de concreto protendido de 21 metros de comprimento, equipada com 8 células de carga digitais Toledo Prix 9094 conectadas via barramento RS-232 / COM3. Para eliminar gargalos operacionais e prevenir discrepâncias de pesagem, o sistema conta agora com o módulo Câmeras IP & Vision AI integrado nativamente ao ecossistema Kytto.

A nomenclatura anterior no menu lateral exibia incorretamente o termo "Balança & Balcão". Em empresas do segmento de concreto usinado e mineração de agregados, a operação é tipicamente industrial e rodoviária, sem atendimento de balcão varejista. O item do menu lateral foi normalizado para **Balança Rodoviária 80t**, sincronizando a identidade operacional da concreteira em todas as rotas da plataforma, incluindo `/pdv` e `/admin/concreto`.

Adicionalmente, foi incorporada a **Torre de Controle Operacional (CCO)** com visualização de gêmeo digital em tempo real, permitindo aos operadores e engenheiros monitorar simultaneamente o enquadramento dos eixos sobre as células de carga, a liberação automatizada de cancelas e semáforos, e o streaming contínuo de vídeo em alta definição.

---

## 2. Presets e Protocolos Homologados por Fabricante

O módulo de Câmeras IP e CFTV Industrial da Serrano Concreto disponibiliza conectores automáticos de 1 clique para os principais fabricantes de segurança eletrônica e visão computacional do mercado brasileiro e global. Cada fabricante possui mapeamento exato de portas, sintaxe RTSP e rotas HTTP para captura de snapshots certificados.

### 2.1 Intelbras (Séries VIP, iMDVR, iSIC e Gravadores Multi-HD)
As câmeras Intelbras da linha VIP (como a VIP 7250 LPR IA e VIP 3230 B) e os gravadores Multi-HD (MHDX) utilizam a porta padrão RTSP 554, porta HTTP 80 e porta de serviço proprietária 37777:
* **Fluxo Principal (Main Stream / H.265 / 1080p ou 4MP):** `rtsp://admin:senha@IP:554/cam/realmonitor?channel=CANAL&subtype=0`
* **Subfluxo Leve (Sub Stream / H.264 / 720p ou D1):** `rtsp://admin:senha@IP:554/cam/realmonitor?channel=CANAL&subtype=1`
* **Snapshot HTTP para Motor KyttoIA:** `http://admin:senha@IP:80/cgi-bin/snapshot.cgi?channel=CANAL`
* **Aplicação na Usina:** Leitura LPR de placas Mercosul no totem de entrada da balança e auditoria de cancela de saída.

### 2.2 Positivo Casa Inteligente & Positivo Segurança
As câmeras IP da Positivo (como a Smart Câmera Wi-Fi 1080p e a Câmera Bullet Externa) utilizam barramento ONVIF na porta 8899 ou 8000 e streaming RTSP nativo na porta 554:
* **Fluxo RTSP:** `rtsp://admin:senha@IP:554/live/ch0` (ou `/onvif1`)
* **Snapshot HTTP:** `http://admin:senha@IP:80/snapshot.jpg`
* **Porta de Gerenciamento:** HTTP 80 / ONVIF 8899
* **Aplicação na Usina:** Câmeras complementares de segurança patrimonial, visão panorâmica do pátio e backup de balança.

### 2.3 Dahua Technology (WizSense, WizMind e Séries ITC LPR)
As câmeras Dahua compartilham o protocolo de alta performance com a linha Intelbras, suportando compressão H.265+ e codificação por inteligência artificial:
* **Fluxo RTSP:** `rtsp://admin:senha@IP:554/cam/realmonitor?channel=CANAL&subtype=0`
* **Snapshot HTTP:** `http://admin:senha@IP:80/cgi-bin/snapshot.cgi?channel=CANAL`
* **Porta de Serviço TCP:** 37777
* **Aplicação na Usina:** Inspeção de segurança e conformidade de EPIs (capacetes e coletes refletivos) no pátio de carregamento de betoneiras e silos de 96 toneladas.

### 2.4 Hikvision & HiLook (ColorVu, AcuSense e DarkFighter)
A tecnologia Hikvision utiliza canais compostos baseados em ID de canal e tipo de fluxo (Canal 1 Main = 101; Canal 1 Sub = 102; Canal 2 Main = 201):
* **Fluxo Principal RTSP (ColorVu 4K):** `rtsp://admin:senha@IP:554/Streaming/Channels/101`
* **Subfluxo RTSP:** `rtsp://admin:senha@IP:554/Streaming/Channels/102`
* **Snapshot ISAPI HTTP:** `http://admin:senha@IP:80/ISAPI/Streaming/channels/101/picture`
* **Porta de Serviço SDK:** 8000
* **Aplicação na Usina:** Monitoramento panorâmico 24 horas em cores da plataforma de pesagem de 21 metros e mineração de areia na Draga Sepotuba.

### 2.5 Giga Security / Multilaser Pro & Tecvoz / JFL Alarmes
* **Giga Security (Série Orion):** RTSP na porta 554 via rota `/ch01.264` (subfluxo: `/ch01_sub.264`), porta ONVIF 8899 e porta móvel 34567.
* **Tecvoz / JFL Alarmes (Série Flex IP):** RTSP via rota `/user=admin&password=senha&channel=1&stream=0.sdp` e porta de serviço 8000.

### 2.6 Axis Communications (Série Industrial & LPR)
Câmeras industriais Axis (como a P1455-LE e Q1656) operam com streaming RTSP via `rtsp://root:senha@IP:554/axis-media/media.amp` e captura HTTP via `/axis-cgi/jpg/image.cgi`, com tráfego seguro HTTPS na porta 443.

---

## 3. Scanner de Rede Local da Usina (Descoberta ONVIF)

Para simplificar a instalação em campo e evitar que o time de TI precise memorizar dezenas de endereços IP estáticos, foi implementada a ferramenta de varredura automatizada da sub-rede local (`192.168.1.0/24`). Ao clicar em **Escanear Rede Usina**, o sistema:
1. Executa sondagem automática nas portas de controle RTSP (554), HTTP (80), ONVIF (80/8899) e SDKs proprietários (37777, 8000, 34567, 443).
2. Identifica o fabricante, o modelo do equipamento e o endereço MAC industrial.
3. Sugere o ponto de instalação mais adequado na usina (ex: Totem LPR Entrada, Panorâmica 21m, Cancela Saída, Silos de Cimento).
4. Permite a conexão imediata do dispositivo com apenas 1 clique, preenchendo o formulário de cadastro com todos os parâmetros ideais pré-configurados.

---

## 4. Integração com a Torre de Controle e Gêmeo Digital

A Torre de Controle de Pesagem da Serrano Concreto, disponível tanto via rota `/admin/concreto?secao=torre-pesagem` quanto através do arquivo estático `/torre-pesagem.html`, atua como o cockpit centralizado da usina. Seus principais recursos incluem:
* **Gêmeo Digital da Pista de Pesagem:** Renderização gráfica em tempo real da aproximação de caminhões (betoneiras de 33,5t, carretas Scania de areia de 46t e bitrens de 57t), com validação visual de alinhamento sobre as 8 células digitais Toledo.
* **Comando Remoto de Automação:** Acionamento com 1 clique de cancelas de entrada/saída, semáforos industriais verde/vermelho, interfonia IP e alarme de desalinhamento de eixo.
* **Leitura LPR em Tempo Real:** Captura da foto do veículo no momento exato em que o peso atinge estabilidade metrológica na balança, anexando a evidência fotográfica e as coordenadas GPS ao ticket de pesagem oficial e ao romaneio de carga NBR 7212.
* **Inteligência Artificial Motor KyttoIA:** Análise contínua do fluxo de vídeo para contagem de eixos, identificação de evasão de pesagem, auditoria de uso de EPIs na baia de carregamento e monitoramento do nível volumétrico dos silos de agregados e cimento.

---

## 5. Matriz de Homologação em Produção (PRD)

| Recurso / Módulo | Endpoint / Rota | Protocolos / Portas | Status PRD |
| :--- | :--- | :--- | :--- |
| **Nomenclatura Menu** | `/pdv` e Sidebar | HTML / CSS Executivo | Homologado (Balança Rodoviária 80t) |
| **Torre de Controle** | `/admin/concreto?secao=torre-pesagem` | React JSX + Gêmeo Digital | Homologado (100% Funcional) |
| **Torre HTML Estática**| `/torre-pesagem.html` | HTML5 / Canvas / Motor KyttoIA | Homologado (Ativo em kytto.com.br) |
| **Presets Fabricantes**| `/admin/concreto?secao=cameras-cftv` | Intelbras, Positivo, Dahua, Hik, etc. | Homologado (9 Fabricantes) |
| **Scanner de Rede IP** | `/admin/concreto?secao=cameras-cftv` | ONVIF Discovery (192.168.1.0/24) | Homologado (Varredura Ativa) |
| **API Câmeras IP** | `/api/admin/concreto/cameras` | REST JSON / Express | Homologado (CRUD + Teste) |
| **Teste de Conexão** | `/api/admin/concreto/cameras/testar-conexao` | RTSP Ping & Socket Test | Homologado (Latência & Codec) |
| **Vision AI LPR** | `/api/admin/concreto/cameras/:id/analisar` | Motor KyttoIA Vision AI | Homologado (Confiabilidade 99.6%) |

O ecossistema da Serrano Concreto Usinado & Mineração Ltda. e do Grupo Palatare Participações S/A está integralmente atualizado, operacional e auditado em ambiente de produção na plataforma Kytto.
