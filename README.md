# 🍣 Zuma Cozinha Oriental — ERP & Cockpit Gastronômico 360°

![Version](https://img.shields.io/badge/version-2.5.0-red.svg)
![Segmento](https://img.shields.io/badge/segmento-Culinária%20Japonesa%20%26%20Rodízio-gold.svg)
![Local](https://img.shields.io/badge/local-Tangará%20da%20Serra--MT-green.svg)
![Barramento](https://img.shields.io/badge/barramento-A2%20Síncrono%20Ativo-emerald.svg)
![Testes](https://img.shields.io/badge/testes-19%2F19%20Aprovados%20(100%25)-brightgreen.svg)

O repositório **Zuma** é a suíte tecnológica completa e standalone do restaurante **Zuma Cozinha Oriental LTDA** (Tangará da Serra - MT), construída utilizando como base o robusto ecossistema de ERP corporativo do **agro-open / Kytto**.

A plataforma une a mais moderna engenharia gastronômica de culinária oriental a um ERP de classe empresarial com motor fiscal próprio, inteligência artificial preditiva, central multiestação e CRM conversacional.

---

## 🏢 Identificação e Dados Canônicos da Empresa

* **Razão Social:** Zuma Cozinha Oriental LTDA
* **Nome Fantasia:** Zuma Cozinha Oriental
* **CNPJ:** `36.296.848/0001-57`
* **Inscrição Estadual:** `13.882.109-8` | **Inscrição Municipal:** `94820`
* **Localização:** Tangará da Serra - Mato Grosso (MT)
* **ID Canônico no Ecossistema:** `c3c3ac01-8e50-4b61-8c79-de4aaa916da3`
* **Instagram Oficial:** [@zuma_orientaltga](https://www.instagram.com/zuma_orientaltga/)

---

## 🌟 As 3 Aplicações Principais do Zuma

O sistema oferece três experiências web integradas com sincronização em tempo real:

### 1. 📱 Cardápio Digital PWA & Autoatendimento (`/zuma`)
* **URL:** `https://kytto.com.br/zuma/` (ou `/zuma/index.html`)
* **Experiência do Cliente:** PWA instalável offline-first com tempo de resposta de 0,1s.
* **211 Itens Reais em 23 Categorias:** Sincronizado 100% com `https://zumacozinhaoriental.com.br/loja/pedidos`, incluindo 116 fotos reais oficiais de alta resolução hospedadas no CDN da Liga dos Pedidos (`cdnimages.ligafiles.com.br` e `alloydeliveryimages.ligafiles.com.br`), capas webp panorâmicas para todas as 23 categorias e grupos de complementos reais.
* **Construtor Dinâmico de Barcas 360°:** O cliente monta barcas personalizadas peça por peça visualizando valor e foto.
* **Sommelier de Saquês & Harmonização:** Sugestão de bebidas guiada por ocasião e preferência de paladar.
* **Rodízio Tangará:** Rodízio tradicional a R$ 99,90/pessoa (segunda a sábado).
* **Integração Instagram & Cupons:** Cupom oficial `INSTAZUMA` (R$ 15,00 OFF no primeiro pedido).

### 2. 🚀 Cockpit Executivo Zuma Pilot 360° (`/zuma/pilot.html`)
* **URL:** `https://kytto.com.br/zuma/pilot.html`
* **18 Módulos de Gestão, Inteligência e Vendas:**
  1. **#operacao:** Acesso direto às 4 estações operacionais.
  2. **#cockpit:** Métricas financeiras, ticket médio e volume de rodízios.
  3. **#zumi:** Mascote Zumi (assistente virtual de IA KyttoIA 2.5 Flash).
  4. **#campanhas:** Gestão de anúncios para Instagram e tráfego pago geolocalizado.
  5. **#leads:** Funil de aquisição de clientes e captação de contatos.
  6. **#clientes:** CRM gastronômico com histórico de pedidos e preferências.
  7. **#horarios:** Controle de escala e turnos do Sushi Bar e Salão.
  8. **#clube:** Clube Zumi de Fidelidade e Recompra com níveis de pontuação.
  9. **#trafego:** Análise de ROI de tráfego pago no Meta Ads e Google Ads.
  10. **#indicacao:** Motor viral de indicação "Indique um Amigo e Ganhe R$ 15".
  11. **#b2b:** Convênios corporativos com empresas do agronegócio de Tangará da Serra (Amaggi, SLC, John Deere, etc.).
  12. **#recuperador:** Recuperador de carrinhos abandonados com disparo automático de WhatsApp.
  13. **#mercado:** Inteligência Competitiva KyttoIA com benchmarking dos concorrentes locais (Sansei, Sushi Ya, Matsuri) e estratégia de desintermediação do iFood.
  14. **#engenharia:** Matriz BCG completa dos 211 SKUs (Estrelas, Vacas Leiteiras, Cavalos de Corrida e Abacaxis).
  15. **#rfm:** Segmentação da base de clientes em Campeões, Fiéis, Em Risco e Inativos.
  16. **#clima:** Estação meteorológica com gatilhos automáticos para dias de chuva e frio.
  17. **#omnichannel:** Central de canais integrados (Salão, Delivery, Takeaway, WhatsApp).
  18. **#financeiro & #estoque:** DRE Gerencial, Break-Even e Ficha Técnica de Rendimento do Salmão.

### 3. 🍱 Central Operacional Unificada (`/zuma/operacao.html`)
* **URL:** `https://kytto.com.br/zuma/operacao.html`
* **4 Estações Operacionais Sincronizadas:**
  1. **Caixa / PDV:** Fechamento de comandas, emissão fiscal de cupom NFC-e, TEF integrado e PIX instantâneo.
  2. **KDS Sushi Bar & Cozinha:** Painel de produção com setorização de praças (`sushi_bar`, `cozinha`, `bar`) e contador de tempo limite.
  3. **App Garçom / Salão:** Gestão das 27 mesas físicas (Salão Principal, Deck Externo, Área Bistrô e Balcão Sushi Bar).
  4. **App Motoboy / Delivery:** Roteirização de entregas por bairros de Tangará da Serra com status em tempo real.

---

## 🏛️ Núcleo ERP Base (Herança do agro-open / Kytto)

O repositório Zuma incorpora todo o poder do ERP multinegócio Kytto:

* **Motor Fiscal SEFAZ-MT:** Emissão de NFC-e (Mod 65) e NF-e de entrada/saída (Mod 55), com assinatura digital A1, contingência offline e Barramento A2 Síncrono.
* **Módulo Financeiro e Contábil:** Plano de contas, razão analítico, conciliação bancária, contas a pagar/receber e DRE contábil/gerencial.
* **Controle de Estoque e Suprimentos:** Fichas técnicas, inventário por pesagem, perda operacional e cotações RFQ.
* **Atendimento Humanizado via WhatsApp:** Motor conversacional Akira (alimentado por KyttoIA 2.5 Flash / Gemini) com atendimento 24h, agendamento de reservas e envio de cardápio.

---

## 📁 Estrutura de Arquivos Principais

```
zuma/
├── app/
│   ├── modules/
│   │   └── restaurante-zuma.js          # Router Express e regras de negócio do Zuma
│   ├── public/
│   │   ├── zuma/
│   │   │   ├── index.html               # Cardápio Digital PWA do cliente
│   │   │   ├── pilot.html               # Cockpit Zuma Pilot 360° (18 módulos)
│   │   │   ├── operacao.html            # Central Operacional (PDV, KDS, Garçom, Motoboy)
│   │   │   ├── cardapio-real-zuma.json  # Catálogo integral de 211 produtos e 23 categorias
│   │   │   ├── sw.js                    # Service Worker PWA offline-first
│   │   │   └── manifest.json            # Manifesto do Web App
│   ├── migrations/
│   │   └── 128_zuma_cozinha_oriental_completo.sql # Migration SQL idempotente
│   ├── zuma-cozinha-oriental-seed.js    # Seed de produtos, mesas, clientes VIP e combos
│   ├── zuma-cozinha-oriental.test.js    # Suíte com 18 testes automatizados
│   ├── server.js                        # Servidor Express principal
│   └── tenant-provisioning.js           # Provisionamento de usuários e tenants
├── web/
│   ├── src/
│   │   ├── pages/admin/
│   │   │   └── ZumaSuite.jsx            # Painel nativo React da Suíte Zuma
│   │   ├── components/
│   │   │   ├── Sidebar.jsx              # Menu lateral com navegação oficial Zuma
│   │   │   └── EmpresaSwitcher.jsx      # Seletor canônico com Zuma prioritário
│   │   └── lib/
│   │       └── brand.js                 # Detecção de contexto de marca Zuma
│   └── package.json                     # Frontend Vite + React 18
├── package.json                         # Dependências do backend Node.js
└── README.md                            # Documentação oficial do projeto
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* Node.js v20+ ou v22+
* PostgreSQL 15+ (opcional para persistência completa, ou modo mock em memória)

### Instalação de Dependências
```bash
# 1. Dependências do Backend
npm install

# 2. Dependências do Frontend
npm --prefix web install
```

### Compilação do Frontend
```bash
npm --prefix web run build
```

### Executar Testes Automatizados
```bash
npm run test:zuma
```
*Saída esperada: 19 testes aprovados (100% pass).*

### Sincronização Automatizada do Catálogo Real
O repositório inclui a ferramenta de extração e sincronização direta com a loja oficial:
```bash
python3 scripts/sync_zuma_catalog.py
```
Ela atualiza simultaneamente:
1. `app/public/zuma/cardapio-real-zuma.json`
2. `app/zuma-cozinha-oriental-seed.js`
3. `app/public/zuma/index.html` (catálogo offline e PWA)

### Inicialização do Servidor
```bash
npm start
```
O servidor estará rodando em `http://localhost:3000`.

---

## 🔌 Principais Endpoints da API

* `GET /api/zuma/cardapio` — Retorna as 23 categorias e os 211 produtos do cardápio oficial.
* `GET /api/zuma/operacional/completo` — Retorna dados operacionais síncronos (mesas, pedidos, comandas).
* `POST /api/zuma/caixa/fechar-venda` — Fechamento de venda no PDV com emissão fiscal.
* `POST /api/zuma/kds/atualizar-item` — Atualização de status de preparo pelo Sushiman no KDS.
* `POST /api/zuma/garcom/lancar-pedido` — Lançamento de novos itens em comandas de mesas físicas.
* `POST /api/zuma/delivery/despachar` — Despacho e associação de motoboys para entregas.

---

## 📜 Licença e Propriedade

Desenvolvido para **Zuma Cozinha Oriental LTDA** integrado à infraestrutura do ecossistema **Kytto**.
Todos os direitos reservados.
