# Relatório Executivo de Homologação em Produção: NBR 5739, Sorteios Kytto & Hub Delivery Multicanal

**Data:** 13 de Novembro de 2026  
**Ambiente:** Produção (PRD) — [https://kytto.com.br](https://kytto.com.br) e [https://setpoint.kytto.com.br](https://setpoint.kytto.com.br)  
**Web Service:** Render `setpoint` (`srv-d8iudokm0tmc73c07iog`)  
**Branch de Produção:** `fix/kytto-comandas-pdv-20260808`  
**Últimos Deploys Homologados:** `dep-dbrkd3pchj1c73cfa9s0` (Live) | `dep-dbrgqau1egvs73fqrn8g` (Live)

---

## 1. Sumário Executivo

Este documento consolida a evolução tecnológica e a homologação funcional em produção das plataformas integradas do ecossistema Kytto:
1. **Serrano Concreto Usinado & Mineração:** Painel tecnológico do laboratório com gráficos comparativos de resistência à compressão dos corpos de prova (NBR 5739) por traço, curvas de evolução aos 1, 3, 7, 14 e 28 dias e índice de conformidade estatística NBR 12655.
2. **Barbearia Dino & Loja de Perfumaria:** Simulação de agendamento online completo com vitrine de upsell de perfumaria (Pomada Modeladora Matte Dino R$ 45,00) e geração automática de bilhetes da sorte.
3. **Módulo de Sorteios & Campanhas Premiadas Kytto:** Apuração matemática e auditável ao vivo na roleta com criptografia SHA-256 (RFC 7518), emissão de certificado oficial A4 e visualização pública de bilhetes.
4. **Palatare Forneria Artesanal (Pizzaria & Restaurante):** Homologação de ponta a ponta do Hub Delivery Multicanal, integrando recepção de pedidos iFood/Keeta, spooler de impressão térmica 80mm ESC/POS, despacho de motoboys e emissão de NFC-e autorizada na SEFAZ Mato Grosso.

---

## 2. Serrano Concreto: Gráficos Comparativos NBR 5739 por Traço

### 2.1. Funcionalidades Implantadas
- **Endpoint Analítico:** `GET /api/admin/concreto/laboratorio/resistencia-por-traco`, fornecendo séries temporais de rompimentos, resistências médias por idade (1d, 3d, 7d, 14d e 28d), fck de projeto e índices de conformidade.
- **Gráficos Comparativos:** Componente `ConcretoGraficosResistenciaNBR5739.jsx` com barras comparativas fck vs resistências reais, curvas dinâmicas de ganho de resistência e indicadores ESG de economia de cimento por m³.
- **Traços Monitorados:**
  - **TR-25-PISO (fck 25 MPa):** Média 28d de 28.4 MPa (+13.6% de margem de segurança).
  - **TR-30-ESTR (fck 30 MPa):** Média 28d de 34.2 MPa (+14.0% de margem de segurança).
  - **TR-35-BOMB (fck 35 MPa):** Média 28d de 38.8 MPa (+10.9% de margem de segurança).
  - **TR-40-ESPEC (fck 40 MPa):** Média 28d de 43.5 MPa (+8.8% de margem de segurança).

### 2.2. Acesso em Produção
- **URL Direta:** `https://kytto.com.br/admin/concreto?secao=producao-laboratorio` (aba *Gráficos Comparativos NBR 5739 Por Traço*).

---

## 3. Barbearia Dino: Agendamento com Upsell de Perfumaria & Sorteios

### 3.1. Fluxo de Agendamento Online
- **Serviço Selecionado:** Barba Premium (R$ 60,00) com a profissional Nati.
- **Data e Horário:** 14/11/2026 às 14:30.
- **Upsell Integrado:** Inclusão no checkout da *Pomada Modeladora Efeito Matte Dino* (R$ 45,00).
- **Total do Atendimento:** R$ 105,00.
- **Bilhetes da Sorte Gerados:** 2 números da sorte automáticos (Regra: R$ 50,00 por bilhete, pontuação dobrada para cosméticos e produtos da loja).

### 3.2. Apuração Auditável na Roleta ao Vivo
- **Campanha Ativa:** *Black Friday Premiada Barbearia & Loja Dino 2026* (`srt-camp-mwdox0e8-6a6fe94d`).
- **Prêmio:** Kit Barba Lenhador + Perfume Importado Dino VIP (R$ 480,00).
- **Bilhete Sorteado na Roleta:** `#918452`
- **Ganhador:** Carlos Eduardo Silva (Telefone: `65999056008`).
- **Semente Criptográfica Auditável:** `090be4df16cb03fe...e65a6b0c22822a10` (SHA-256 imutável).
- **Consulta Pública:** Acessível em `https://kytto.com.br/sorteios/dino` pelo WhatsApp do cliente.

---

## 4. Palatare Pizzaria: Hub Delivery Multicanal, ESC/POS & NFC-e SEFAZ-MT

### 4.1. Recepção Multicanal e Simulação de Pedidos
- **Pedido iFood Simulado:** Código `#IF-9454` (ID `deliv-ifood-9454`).
- **Cliente:** Rodrigo Ribeiro Gonçalves — Av. Tancredo Neves, 1200, Sala Executiva 01, Centro, Tangará da Serra/MT.
- **Comanda:** Pizza Grande 2 Sabores (Filé Mignon ao Gorgonzola / Quatro Queijos Nobres) + Borda Catupiry + Coca-Cola Zero 2L.
- **Valores:** Subtotal R$ 110,00 | Taxa Entrega R$ 6,00 | Total Bruto R$ 116,00 | Comissão Canal - R$ 26,68 | Repasse Líquido R$ 89,32.

### 4.2. Impressão Térmica 80mm ESC/POS
- **Comanda de Cozinha & Forno:** Formatação em 48 colunas monospaçadas com separadores visuais, discriminação de sabores, ponto da massa (fermentação 48h) e comandos ESC/POS prontos para envio a impressoras térmicas (Epson, Bematech, Elgin).
- **Cupom de Entrega:** Endereço completo em Tangará da Serra com identificador do motoboy da frota própria (`Alisson Mendes - Moto 01`).

### 4.3. Emissão de NFC-e Homologada na SEFAZ-MT
- **Chave de Acesso Oficial (44 Dígitos):** `51261131002650000108650010009597511886378057`
- **Protocolo de Autorização:** `15126590734297`
- **Status:** AUTORIZADA EM PRODUÇÃO SEFAZ-MT.
- **QR Code:** Link direto de consulta pública da SEFAZ Mato Grosso.
- **Integração KDS:** Transição do status para `preparando_forno` sincronizada com os marketplaces.

---

## 5. Matriz de Endpoints e URLs Homologadas

| Módulo | Tipo | Rota / URL de Acesso | Status em PRD |
| :--- | :--- | :--- | :--- |
| **Pizzaria Suite** | Admin | `https://kytto.com.br/admin/pizzaria?tab=hub_delivery` | 200 OK (Live) |
| **Serrano Concreto** | Admin | `https://kytto.com.br/admin/concreto?secao=producao-laboratorio` | 200 OK (Live) |
| **Sorteios Roleta** | Admin | `https://kytto.com.br/admin/sorteios` | 200 OK (Live) |
| **Sorteios Consulta**| Público | `https://kytto.com.br/sorteios/dino` | 200 OK (Live) |
| **Agendamento Online**| Público | `https://kytto.com.br/agendar/dino` | 200 OK (Live) |
| **API NFC-e Fiscal** | API POST | `/api/admin/palatare/pedidos/:id/emitir-nfce` | 200 OK (Live) |
| **API Térmica 80mm**| API POST | `/api/admin/palatare/pedidos/:id/imprimir-cozinha` | 200 OK (Live) |
| **API Motoboy** | API POST | `/api/admin/palatare/pedidos/:id/imprimir-motoboy` | 200 OK (Live) |
| **API NBR 5739** | API GET | `/api/admin/concreto/laboratorio/resistencia-por-traco` | 200 OK (Live) |
