# SetPoint Ultra — ERP & SaaS Platform

![Version](https://img.shields.io/badge/version-3.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-v22.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-v18.2.0-blue.svg)

O **SetPoint Ultra** (antigo Agro-Open / Kytto ERP) é uma plataforma SaaS modular enterprise-grade construída para revolucionar a gestão de negócios no Brasil. Originalmente focado em clubes esportivos e arenas, o sistema evoluiu para um ERP completo, capaz de atender diversos segmentos de varejo e serviços.

## 🚀 Segmentos Atendidos

O sistema possui uma arquitetura multi-tenant onde cada empresa ativa apenas os módulos que precisa:

- **🏪 Supermercado:** Balança, lotes, validade, promoções (Leve X Pague Y), ficha técnica de desossa.
- **👗 Loja de Moda:** Matriz de grade (Cor×Tamanho), crediário próprio (fórmula Price), condicional (malinha).
- **✂️ Barbearia / Salão:** Agendamento online, rateio automático de comissões, assinaturas recorrentes.
- **🔧 Oficina Mecânica:** OS digital, checklist com foto, aprovação via WhatsApp, controle de garantia.
- **🐾 Agropecuária / Petshop:** Receituário agronômico/veterinário, prontuário, fracionamento.
- **🎾 Arenas Esportivas:** Reservas de quadras, gestão de torneios, catracas IoT, iluminação automática.

## 🏗️ Arquitetura Técnica

O projeto é dividido em 3 camadas principais (Monorepo):

1. **`/app` (Backend Node.js)**
   - API RESTful modular (25+ módulos independentes).
   - Motor Fiscal Próprio: Geração e assinatura de XML (A1), envio direto SEFAZ-MT, DANFE em PDF.
   - Core WhatsApp: Integração com Evolution API para disparos automáticos.
   - Push Notifications: Integração com Expo Push para alertas mobile.
   - Banco de Dados: PostgreSQL 16 com schema isolado por tenant (Row-Level Security).

2. **`/web` (Frontend React + Vite)**
   - Dashboard Administrativo (SPA) e PDV Unificado.
   - Telas de BI, Relatórios Fiscais (SPED/Sintegra), Crediário e Billing.
   - Páginas públicas (Agendamento Online, Checkout).

3. **`/mobile` (App Expo / React Native)**
   - App do Atleta / Cliente Final (reservas, pagamentos, histórico).
   - App do Gestor (PDV Mobile, aprovação de OS, dashboard).
   - Suporte offline-first com sincronização assíncrona.

## ⚙️ Como Executar Localmente

### 1. Pré-requisitos
- Node.js 22+
- PostgreSQL 16+
- Conta no GCP (opcional, para deploy)

### 2. Configuração do Banco de Dados
```bash
# Iniciar PostgreSQL e criar banco/usuário
sudo -u postgres psql -c "CREATE USER setpoint WITH PASSWORD 'setpoint2026' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE setpoint_ultra OWNER setpoint;"

# Executar migrations
cd app/migrations
./run_migrations.sh localhost 5432 setpoint setpoint2026 setpoint_ultra
```

### 3. Rodando o Backend (API)
```bash
cd app
npm install
cp .env.example .env.development
# Preencha o .env.development com suas credenciais locais
npm run dev
```

### 4. Rodando o Frontend (Web)
```bash
cd web
npm install
npm run dev
```

### 5. Rodando o App Mobile (Expo)
```bash
cd mobile
npm install
npx expo start
```

## 🧪 Testes Automatizados

O projeto utiliza **Vitest** para garantir a integridade dos cálculos críticos:

```bash
cd app
npm run test
# ou npx vitest run --reporter=verbose
```
*Cobertura atual:* Motor Fiscal (Chave NFC-e, ICMS, PIS/COFINS), PDV (Troco, Promoções), Barbearia (Rateio) e Crediário (Fórmula Price).

## ☁️ Deploy no Google Cloud Platform (GCP)

O repositório já contém a infraestrutura como código (IaC) pronta para o GCP.

1. **Cloud SQL:** Instância PostgreSQL 16 (`southamerica-east1`).
2. **Cloud Run:** Container Docker multi-stage (definido em `Dockerfile`).
3. **Cloud Build:** Pipeline CI/CD automatizado (definido em `cloudbuild.yaml`).

Para fazer o deploy manual:
```bash
gcloud builds submit --config cloudbuild.yaml .
```

## 📜 Licença

Desenvolvido pela equipe SetPoint Ultra. Uso restrito e confidencial.
