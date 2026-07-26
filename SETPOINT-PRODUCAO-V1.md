# SetPoint v1 - Estado Atual em Produção

**URL:** https://setpoint-186726132534.us-central1.run.app/app  
**Data:** 26 de julho de 2026  
**Status:** ✅ Operacional

## Funcionalidades Atuais

### Comanda Digital
- ✅ Interface de abertura de comanda
- ✅ Campos: Nome, WhatsApp/Telefone, Mesa/Localização
- ✅ Botão "Nova Comanda" e "Já tenho comanda"
- ✅ Design responsivo com tema verde (Agro Open)

### Observações
- Sistema está rodando em produção no GCP Cloud Run
- Interface simples e funcional para evento (Agro Open de Tênis)
- Pronto para ser expandido com módulos

## Próximos Passos para Evolução

1. **Migrar para arquitetura multi-tenant modular**
2. **Implementar Core compartilhado** (auth, RBAC, tenant middleware)
3. **Adicionar módulos** (BAR, LOJA, BARBEARIA, etc)
4. **Integrar NFC-e nacional** com contingência offline
5. **Integrar pagamentos** (Stone, Cielo, PagBank, Pix)
6. **Implementar comanda eletrônica** com divisão de conta
7. **Criar app mobile** offline com sincronização

## Arquitetura Proposta

```
Versão 1 (Atual)        →    Versão 2 (Modular)
┌─────────────────┐          ┌──────────────────────────┐
│ Comanda Digital │          │ SetPoint Ultra (SaaS)    │
│ (Evento)        │          │ ┌──────────────────────┐ │
│                 │          │ │ CORE (Obrigatório)   │ │
│ - Simples       │    →     │ ├──────────────────────┤ │
│ - Funcional     │          │ │ Módulos Independentes│ │
│ - Monolítico    │          │ │ - BAR                │ │
└─────────────────┘          │ │ - LOJA               │ │
                             │ │ - BARBEARIA          │ │
                             │ │ - SUPERMERCADO       │ │
                             │ │ - CLUBE              │ │
                             │ └──────────────────────┘ │
                             └──────────────────────────┘
```

## Tecnologias Atuais

- Frontend: React (simples)
- Backend: Node.js/Express (básico)
- Banco: Provavelmente JSON ou SQLite
- Hosting: GCP Cloud Run

## Tecnologias Propostas para v2

- Frontend: React 18 + Vite + TailwindCSS
- Backend: Node.js + Express (modular)
- Banco: PostgreSQL multi-tenant
- Cache: Redis
- Mobile: React Native + Expo
- Offline: WatermelonDB
- Hosting: GCP Cloud Run (mantém)
- CI/CD: Cloud Build (mantém)

## Estratégia de Migração

1. **Manter v1 em produção** durante desenvolvimento
2. **Criar v2 em branch separada** (staging)
3. **Testar com cliente piloto** (bar real)
4. **Migrar dados** de v1 para v2
5. **Deploy de v2** com zero downtime
6. **Suporte paralelo** durante transição

---

**Próximo:** Iniciar implementação do Core da v2
