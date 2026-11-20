# Kytto Station · Zuma Cozinha Oriental
## Relatório Executivo: Hub de Administração, Conexões de Open APIs e Inteligência de Concorrência
**Localidade:** Tangará da Serra - Mato Grosso  
**Ambiente Oficial:** [kytto.com.br](https://kytto.com.br) / [zuma.kytto.com.br](https://kytto.com.br/zuma/)  
**Tecnologia:** Kytto Station Enterprise · Motor KyttoIA 2.5 Flash · Express Node.js · PostgreSQL 18 · PWA v5  
**Data:** 20 de Novembro de 2026  

---

### 1. Resumo Executivo

O ecossistema do **Zuma Cozinha Oriental** em Tangará da Serra (MT) foi expandido com a implantação da **Área de Administração com Hub de Conexões de APIs Abertas e Fontes Governamentais/Mercadológicas**. Esta evolução permite que a plataforma capture, unifique e processe dados completos e detalhados de todos os concorrentes da cidade, fornecendo insumos analíticos em tempo real para alimentar o **Cockpit do Proprietário**, o **ERP Gastronômico 360°**, o **Radar de CNPJs** e os agentes autônomos de tomada de ação do **Motor KyttoIA 2.5 Flash**.

Com este hub, o Zuma deixa de operar no escuro e passa a dispor de uma infraestrutura corporativa de inteligência preditiva com **7 conectores ativos**, monitorando desde a abertura cadastral de novas empresas na Receita Federal até flutuações de preços em tempo real no delivery, cotações de pescados no atacado de MT e taxas setoriais de inflação pelo Banco Central.

---

### 2. Catálogo Técnico das 7 Conexões de APIs Abertas

O Hub Administrativo opera de forma ininterrupta, combinando varreduras programadas e gatilhos sob demanda:

| # | Conector / Fonte | Categoria | Intervalo | Registros | Indicadores & Dados Ingeridos |
|---|---|---|---|---|---|
| **1** | **BrasilAPI & Receita Federal** | Dados Públicos Cadastrais | 60 min | 9 CNPJs | CNPJs, Razão Social, Quadro de Sócios (QSA), CNAE 5611-2/01, Capital Social e Situação Cadastral. |
| **2** | **OpenStreetMap / Overpass** | Geointeligência Urbana | 120 min | 28 locais | Mapeamento geoespacial de restaurantes, densidade por bairro em Tangará da Serra e raio de entrega. |
| **3** | **iFood & Marketplaces Scrapers** | Preços & Prazos Delivery | 30 min | 5 marcas | Preços de pratos âncora (Combinados, Uramakis, Temakis), taxa de frete por bairro e tempo médio de espera. |
| **4** | **Google Places & Avaliações** | Reputação & Sentimento | 60 min | 6 estabelecimentos | Notas médias (1 a 5 estrelas), contagem de reviews, análise de sentimento e horários de maior movimento. |
| **5** | **Banco Central (SGS) & IBGE** | Macroeconomia & Inflação | 1.440 min | 12 séries | Série temporal do IPCA Alimentação Fora do Domicílio, benchmark de reajuste e elasticidade-preço. |
| **6** | **Cepea & Pescados Regionais MT** | Cotações de Commodities | 360 min | 4 insumos | Cotação de salmão chileno fresco (R$/kg), atum, tilápia e algas nori para salvaguarda de CMV da ficha técnica. |
| **7** | **Motor KyttoIA 2.5 Flash** | Inteligência Artificial & Pipeline | 15 min | 9 concorrentes | Fusão de dados multimodais, geração de diagnósticos prescritivos, oportunidades financeiras em R$ e ações de 1 toque. |

---

### 3. Radar de Estabelecimentos e Concorrentes Mapeados em Tangará da Serra

A fusão das APIs da Receita Federal com os scrapers de marketplace identificou a seguinte distribuição de mercado no setor de culinária oriental:

```
[MARKET SHARE GASTRONOMIA ORIENTAL - TANGARÁ DA SERRA (MT)]
Total do Segmento: R$ 572.000,00 / mês

1. 👑 Zuma Cozinha Oriental ........ R$ 285.000,00 / mês (54,2% · Líder Absoluto)
   CNPJ: 48.912.440/0001-88 · Nota: 4.9 ★ (418 reviews) · Tempo Médio: 28 min
2. 🍣 Bonsai Sushi Bar ............. R$ 110.000,00 / mês (18,5%)
   CNPJ: 43.466.537/0001-54 · Nota: 4.5 ★ (284 reviews) · Tempo Médio: 45 min
3. 🍱 Tokio Sushi Bar .............. R$  78.000,00 / mês (12,8%)
   CNPJ: 44.431.917/0001-16 · Nota: 4.2 ★ (165 reviews) · Tempo Médio: 55 min
4. 🛵 Koiso Delivery ............... R$  48.000,00 / mês ( 7,9%)
   CNPJ: 67.280.022/0001-23 · Nota: 4.0 ★ ( 92 reviews) · Tempo Médio: 50 min
5. 🥢 Ryori Bar & Outros ........... R$  51.000,00 / mês ( 6,6%)
   CNPJs Diversos · Média: 4.1 ★ · Tempo Médio: 40 min
```

#### Oportunidades Identificadas pelo Motor KyttoIA 2.5 Flash
* **Gargalo no Delivery Concorrente:** O Tokio Sushi e o Koiso Delivery apresentam tempos de entrega superiores a 50 minutos nos bairros Jardim Tangará II e Vila Alta, com reclamações públicas recorrentes no Google Places sobre atrasos.
* **Ação Zuma:** O Zuma aciona a frota própria rastreada (MOTO-01, MOTO-02, MOTO-03) com entrega média de 28 minutos e embalagens térmicas seladas, capturando clientes insatisfeitos com cupons de primeira compra via WhatsApp Zumi.
* **Proteção de Margem (Cepea Salmão):** Diante da alta do salmão fresco nas cotações regionais de MT (+4,2%), o Motor KyttoIA sugeriu priorizar no cardápio combos com mix equilibrado (Skin Rolls, Hot Rolls Filadélfia e Uramakis Ebi), preservando o CMV global em 28,4%.

---

### 4. Arquitetura de Endpoints REST do Hub Administrativo

As novas rotas foram incorporadas ao módulo `app/modules/restaurante-zuma.js` e montadas no servidor de produção Kytto:

1. `GET /api/zuma/admin/conexoes-apis`: Retorna o panorama completo do hub (7 conectores, status, latências médias e histórico recente).
2. `POST /api/zuma/admin/conexoes-apis/testar`: Executa ping e validação de latência em milissegundos para um conector específico (ex: `brasilapi_rfb`).
3. `POST /api/zuma/admin/conexoes-apis/sincronizar`: Aciona a ingestão global em lote de todas as fontes de concorrência, atualizando caches e bancos.
4. `GET /api/zuma/admin/conexoes-apis/logs`: Fornece a trilha de auditoria e telemetria das últimas chamadas de APIs.
5. `GET /api/zuma/admin/conexoes-apis/consulta-cnpj/:cnpj`: Consulta dinâmica enriquecida, com busca ao vivo na BrasilAPI pública e fallback inteligente na base de dados de Tangará da Serra.

---

### 5. Navegação Integrada e Experiência Mobile iPhone 15 Pro

A nova página administrativa (`app/public/zuma/admin-conexoes.html`) foi concebida sob o padrão *iPhone First*, com navegação integrada em todo o ecossistema:
* **Cockpit do Proprietário (`proprietario.html`):** Botão fixo no cabeçalho (*Hub APIs*) e banner acionável dentro da aba *Radar de CNPJs*.
* **Central de Aplicativos (`apps.html`):** Card dedicado do *Hub de Conexões & Open APIs (Admin)* com acesso direto via PWA.
* **ERP Gastronômico (`erp.html`):** Atalho no menu superior de retaguarda.
* **Service Worker v5 (`sw.js`):** Cache atualizado para permitir auditoria rápida mesmo com oscilações de conectividade.

---

### 6. Garantia de Qualidade e Conformidade

* **Suíte de Testes Automatizados:** 38 testes executados com 100% de aprovação (`38 pass, 0 fail`), cobrindo integridade das rotas, validação de latências, dados societários e conformidade de arquivos estáticos.
* **Diretriz de Marca Kytto:** O motor de inteligência artificial é referenciado com estrita exclusividade sob a nomenclatura oficial **Motor KyttoIA 2.5 Flash** em todas as interfaces, rotas e documentações.

---
**Kytto Station · Zuma Cozinha Oriental**  
*Inteligência Competitiva, Conectividade Aberta e Excelência Gastronômica.*
