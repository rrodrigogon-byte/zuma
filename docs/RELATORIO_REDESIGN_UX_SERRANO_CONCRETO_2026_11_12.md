# Relatório Executivo de Engenharia & UX
## Redesign Oficial do Módulo Serrano Concreto Usinado & Mineração

---

**Plataforma:** Kytto ERP & Commerce Multi-Tenant  
**Módulo:** Concreto Usinado, Mineração & Controle Tecnológico  
**Tenant Oficial:** Serrano Concreto Usinado & Mineração Ltda (Tangará da Serra / MT)  
**CNPJ Matriz:** 51.499.928/0001-01 · **CNPJ Usinado:** 53.798.485/0001-77 · **RNTRC ANTT:** 056256077  
**Responsável Técnica (RT):** Engª Karin Prestes (CREA-MT 027300)  
**Data da Implantação:** 12 de Novembro de 2026  
**Documento Base:** Proposta de Redesign UX (`SerranoConcreto·RedesignUX.html`)  

---

## 1. Diagnóstico do Estado Anterior vs. Solução Implantada

| Aspecto Analisado | Diagnóstico Anterior (Problema) | Redesign Implantado (Solução Oficial) |
| :--- | :--- | :--- |
| **Contraste WCAG 2.1** | Números em amarelo (`#F59E0B`, 2,15:1), ciano (2,14:1) e verde (2,54:1) sobre branco. Reprovados para sol de obra e monitor de balança. | **Carbono Industrial (`#16181B`, 17:1)** para todos os valores numéricos e textos. **Laranja Serrano (`#FF7000`, 6,4:1)** com texto carbono nos botões primários. |
| **Navegação & Abas** | 11 abas horizontais amontoadas com emojis que transbordavam para fora da tela. | **Menu lateral escuro agrupado em 5 áreas de trabalho do fluxo físico da usina**: Operação, Produção, Suprimentos, Comercial e Empresa. Ícones vetoriais de traço único (SVG) e badges de contagem em tempo real. |
| **Monitoramento da Frota** | Sem visão temporal gráfica; operador não sabia qual betoneira estava em rota ou ociosa. | **Escala da Frota / Gantt Industrial (07h às 17h)** com 11 colunas horárias, barra de status por veículo e marcador dinâmico em vermelho **"Agora"**. |
| **Prazo de Pega NBR 7212** | Inexistência de alerta visível de perda de slump e início de pega (máximo 150 min pós-adição de água). | **Medidor de Pega NBR 7212 por Viagem** em barra visual com 3 faixas normativas: Verde (< 90 min), Âmbar (90–120 min) e Vermelho (> 120 min até 150 min). |
| **Tabela de Cargas** | Cartões verticais longos que exigiam rolagem infinita do despachante. | **Tabela compacta tabular** de 1 linha por carga com ordenação tabular e gaveta expansível para exibir as viagens individuais com 1 clique. |
| **Tipografia Industrial** | Fontes genéricas em negrito excessivo (137 ocorrências de peso 700/800/900). | Tipografia hierárquica oficial: **Barlow Condensed** para títulos/KPIs, **Inter** para leitura e **IBM Plex Mono** com alinhamento tabular para dados técnicos, FCK e horários. |
| **Ambiente de Trabalho** | Apenas tema fixo sem suporte a monitor de controle. | **Seletor de Tema**: Modo Claro (pátio/escritório) e **Sala de Controle da Usina (Dark Mode)** de alto contraste. |

---

## 2. Paleta de Cores & Design Tokens Oficiais

A paleta foi padronizada a partir da identidade da marca Serrano Concreto (`@serrano_concreto`):

* `--serrano-orange: #FF7000`: Botões primários, itens ativos e barras de veículos em rota.
* `--serrano-orange-text: #B34700`: Texto em destaque sobre fundo claro (relação WCAG 5,5:1).
* `--carbon: #16181B`: Texto principal, barra lateral e rótulos sobre fundo laranja (WCAG 6,4:1).
* `--concrete-bg: #F6F5F3`: Fundo com tom de concreto levemente aquecido.
* `--surface: #FFFFFF` / `--surface-2: #EFEDEA`: Superfícies de cartões e tabelas.
* `--joint: #E2DFDA`: Bordas e juntas estruturais.
* **Status Semânticos de Pega e Conformidade:**
  * No Prazo (< 90 min): `#1A7A43` / bg `#E5F3EA` (5,3:1).
  * Atenção (90–120 min): `#9A6412` / bg `#FBF0DC` (5,0:1).
  * Crítico (> 120 min / Limite NBR 7212): `#C8322B` / bg `#FBE7E5` (5,3:1).
  * Informação: `#2B6CB0` / bg `#E6EFF9` (5,4:1).

---

## 3. Mapeamento das 5 Áreas de Trabalho da Usina

### Área 1: Operação
* **Despacho ao Vivo:** Linha do tempo Gantt da frota (07h às 17h) e tabela de cargas de hoje expansível.
* **Programação de Cargas:** Agendamento prévio com seleção de obra, FCK, volume e bomba.
* **Frota & Telemetria:** Gestão das 5 betoneiras (BT-01 a BT-05) e dos 2 caminhões bomba lança (BL-01 32m e BL-02 36m), motoristas e horímetro.

### Área 2: Produção
* **Central Dosadora NBR 7212:** Simulador automatizado de pesagem para FCK 15 a 45 MPa, com ajuste interativo de umidade da areia (0 a 10%) e compensação automática no hidrômetro de água.
* **Ordens de Produção:** Acompanhamento do status de dosagem e pesagem de cada batelada.
* **Laboratório & CPs (NBR 5738/5739):** Registro de rompimento axial de corpos de prova aos 7, 14 e 28 dias e emissão de laudo tecnológico assinado pela RT Engª Karin Prestes.

### Área 3: Suprimentos
* **Mineração & Silos 96t:** Visão vertical dos Silos Convicta 96t (Cimento CP II-F e CP V-ARI) e baias de agregados da Serrano Mineração (Areia lavada do Rio Sepotuba, Brita 0, Brita 1 e Pó de pedra).
* **Compras:** Controle de pedidos de agregados, cimento a granel e aditivos químicos.

### Área 4: Comercial
* **Orçamentos & Propostas:** Geração de propostas comerciais de concretagem com cálculo de m³ e taxa de bombeamento, com botão de envio WhatsApp oficial em 1 clique.
* **Custos & Preços:** Catálogo de traços normatizados e tabela de preços por FCK.

### Área 5: Empresa
* **Holding Serrano & Palatare:** Consolidação corporativa das empresas do grupo.
* **Dados Fiscais & Integrações:** Consulta rápida a CNPJs, Inscrição Estadual SEFAZ-MT, RNTRC ANTT e status de sincronismo do barramento fiscal.

---

## 4. Testes & Homologação Automatizada

A suíte completa de testes automatizados do módulo de concreto foi executada e homologada com 100% de aprovação:

* `✔ Empresa 2 (Serrano Concreto): CNPJ oficial e formato válido`
* `✔ Empresa 1 (Palatare Pizzaria): Gastronomia isolada`
* `✔ Catálogo e traços de Concreto Usinado contêm FCK 20 a 40 MPa`
* `✔ Frota de Betoneiras e Bombas devidamente cadastrada`
* `✔ Provisionamento local e criação de entidades no datastore`
* `✔ 1. Obter dados completos de concreto e mineração`
* `✔ 2. Calculadora de dosagem NBR 7212 com correção de umidade da areia`
* `✔ 3. Criar nova carga com FCK 30 e abatimento nos silos`
* `✔ 4. Atualizar status e telemetria de viagem com hora parada`
* `✔ 5. Laboratório tecnológico: romper corpo de prova aos 7 e 28 dias`
* `✔ 6. Criar proposta comercial com cálculo de bombeamento`
* `✔ 7. Telemetria e frota: atualizar status de betoneiras e bombas`
* `✔ 8. Estoque industrial: movimentar insumo no Silo Convicta 96t`

---

*Homologado para implantação imediata na branch de produção da plataforma Kytto.*
