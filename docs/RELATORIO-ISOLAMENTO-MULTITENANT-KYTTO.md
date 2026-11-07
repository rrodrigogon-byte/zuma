# Relatório Executivo de Homologação: Isolamento Estrito Multi-Tenant & Regras de Acesso por Usuário no ERP Kytto

**Data:** 07 de Novembro de 2026  
**Ambiente:** Produção (`https://kytto.com.br` e `https://setpoint.kytto.com.br`)  
**Serviço Cloud:** Render Web Service (`srv-d8iudokm0tmc73c07iog`)  
**Status do Deploy:** Ativo / Live (`dep-dbnhpbverlec73amtqrg`)  
**Branches:** `fix/kytto-comandas-pdv-20260808` e `main` (commit `92382fab`)  
**Responsável Técnico:** Equipe de Engenharia e Arquitetura de Software Kytto  

---

## 1. Sumário Executivo

Atendendo à diretriz de segurança corporativa, governança de dados e controle de acesso por perfil no ERP Kytto:

1. **Admin Global (`rodrigo.goncalves@uisa.com.br`, `rrodrigogon@gmail.com` e `admin`):**
   - Acesso irrestrito a todas as empresas cadastradas no ecossistema (todas as 6 empresas ativas);
   - Capacidade de filtrar qualquer empresa individualmente no painel executivo;
   - Acesso exclusivo à Consolidação Holding (`/admin/consolidacao-grupo`), DRE unificado e governança de tenants.

2. **Guilherme (`guicunha136@gmail.com`, `dino`, `guilherme`):**
   - Acesso exclusivo e isolado à **Barbearia Dino** (`d0d0ac01-8e50-4b61-8c79-de4aaa916da6`);
   - Bloqueio imediato (`403 FORBIDDEN / ACCESS_DENIED`) para qualquer tentativa de acesso aos dados de Stallone, Agro Open ou outras empresas;
   - Menus de Consolidação Holding e criação global de empresas totalmente ocultados e bloqueados no backend.

3. **Silvester (`silvester_natal@hotmail.com`, `silvester`, `stallone`):**
   - Acesso restrito e exclusivo às suas empresas sob gestão: **Stallone Nutre Sport** (`31f70c83-9172-40c2-945f-9e793b5048be` e unidades associadas) e **AGRO OPEN TTC** (`2e041110-db20-4fd1-8278-12bd3dead008`);
   - Permissão para alternar e filtrar livremente entre Stallone e Agro Open;
   - Bloqueio absoluto (`403 FORBIDDEN / ACCESS_DENIED`) para visualização de qualquer dado da Barbearia Dino ou da Consolidação Holding Kytto.

---

## 2. Matriz de Autorização por Perfil de Usuário

| Usuário / Login | Papel / Escopo | Barbearia Dino | Stallone Nutre Sport | AGRO OPEN TTC | Consolidação Holding |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Rodrigo Gonçalves** (`rodrigo.goncalves` / `rrodrigogon` / `admin`) | **Admin Global da Plataforma** | ✅ Permitido | ✅ Permitido | ✅ Permitido | ✅ Permitido (`200 OK`) |
| **Guilherme** (`dino` / `guicunha136@gmail.com`) | **Inquilino Dino Barbearia** | ✅ **Exclusivo (1 empresa)** | ❌ Bloqueado (`403`) | ❌ Bloqueado (`403`) | ❌ Bloqueado (`403`) |
| **Silvester** (`silvester` / `stallone` / `silvester_natal@hotmail.com`) | **Gestor Stallone & Agro Open** | ❌ Bloqueado (`403`) | ✅ **Permitido** | ✅ **Permitido** | ❌ Bloqueado (`403`) |

---

## 3. Arquitetura de Blindagem Implementada

### 3.1. Backend: Serviço de Empresas (`app/modules/empresas/servico.js`)
- Adicionado o parâmetro de filtragem por lista de inquilinos `empresaIdFiltro` na função `listarEmpresas`.
- Suporte a consultas com múltiplos IDs (`WHERE id = ANY($1::uuid[])`), permitindo que gestores multi-unidade como Silvester recebam exatamente e exclusivamente suas empresas autorizadas (Stallone e Agro Open).

### 3.2. Controle de Acesso e Rotas (`app/modules/empresas/rotas.js`)
- **Bloqueio de Consolidação e Diagnóstico Holding:** Rotas `/consolidacao-grupo` e `/diagnostico-holding` agora exigem `isPlatformAdmin(req.user)`. Requisições de inquilinos individuais ou gestores de marcas como Dino e Silvester são rejeitadas com `HTTP 403 Forbidden` (`HOLDING_ADMIN_REQUIRED`).
- **Bloqueio de Criação e Exclusão Global:** Rotas `POST /` e `DELETE /:id` restritas exclusivamente ao Superadmin da Plataforma (`PLATFORM_ADMIN_REQUIRED`).
- **Proteção de Propriedade de Tenant:** Rotas pontuais `GET /:id`, `PATCH /:id` e `PUT /:id` executam `verificarAcessoEmpresa`, que valida se o `empresaId` requisitado faz parte da lista de empresas autorizadas do usuário. Tentativas de acessar empresas alheias retornam `HTTP 403 Forbidden` (`ACCESS_DENIED`).

### 3.3. Injeção de Contexto no Servidor (`app/server.js`)
- Configuração de funções centrais de autorização: `isAdminGlobal`, `isSilvesterUser`, `isGuilhermeUser` e `obterEmpresasAutorizadasDoUsuario`.
- Na inicialização de sessão `commerceSessionFor`, o objeto de sessão restringe as `empresas_acessiveis` estritamente de acordo com a autorização de cada perfil.

### 3.4. Sincronização de Equipes (`app/tenant-provisioning.js`)
- Silvester Natal devidamente configurado e provisionado nas instâncias de Stallone Nutre Sport e AGRO OPEN TTC, garantindo acesso com a senha padrão de equipe `123456`.
- Guilherme Cunha Martins provisionado exclusivamente na Barbearia Dino.

### 3.5. Frontend: Sidebar, Telas e Proteção Visual (`web/src/lib/auth.jsx` e `web/src/pages/admin/Empresas.jsx`)
- A flag `isPlatformAdmin` foi restrita exclusivamente aos administradores globais (`rodrigo.goncalves` e `rrodrigogon`).
- Menus e cabeçalhos adaptam-se dinamicamente: para Guilherme exibe "Minha Barbearia", para Silvester exibe "Minhas Empresas Autorizadas (Stallone & Agro Open)" e para Rodrigo Gonçalves exibe a visão global corporativa da holding.

---

## 4. Validação Automatizada em Produção

Após deploy no Render (`status: live`), foram executadas validações automatizadas com script direto contra o ambiente real de produção (`https://kytto.com.br`):

```bash
=== VALIDAÇÃO DAS REGRAS MULTI-TENANT EM PRODUÇÃO ===

1. TESTANDO USUÁRIO GUILHERME (DINO):
✔ Login realizado com sucesso como Dino (Guilherme Cunha Martins)
✔ Empresas na sessão: Barbearia Dino
✔ Listar empresas para Dino: 1 empresa retornada
   - Barbearia Dino (d0d0ac01-8e50-4b61-8c79-de4aaa916da6) - CNPJ: 50.073.355/0002-60
✔ ISOLAMENTO DINO CONFIRMADO: Guilherme visualiza APENAS Barbearia Dino!
✔ Tentativa de Dino acessar Stallone: Status 403 (Esperado 403)
✔ Tentativa de Dino acessar Consolidação Holding: Status 403 (Esperado 403)

2. TESTANDO USUÁRIO SILVESTER:
✔ Login realizado com sucesso como Silvester (Silvester Natal)
✔ Empresas na sessão: Stallone Nutre Sport, AGRO OPEN TTC
✔ Listar empresas para Silvester: Stallone e Agro Open
   - AGRO OPEN TTC (2e041110-db20-4fd1-8278-12bd3dead008) - CNPJ: 43.084.070/0001-88
   - Stallone Nutre Sport (31f70c83-9172-40c2-945f-9e793b5048be) - CNPJ: 56.099.531/0001-38
✔ ISOLAMENTO SILVESTER CONFIRMADO: Visualiza Stallone e Agro Open, com ZERO ACESSO à Dino!
✔ Silvester filtrando Stallone: 1 empresa retornada (Stallone Nutre Sport)
✔ Silvester filtrando Agro Open: 1 empresa retornada (AGRO OPEN TTC)
✔ Tentativa de Silvester acessar Barbearia Dino: Status 403 (Esperado 403)
✔ Tentativa de Silvester acessar Consolidação Holding: Status 403 (Esperado 403)

3. TESTANDO ADMIN GLOBAL:
✔ Login realizado com sucesso como Admin Global (Administrador)
✔ Admin Global visualiza TODAS as empresas: 6 empresas cadastradas
✔ Admin filtrando Dino: 1 empresa retornada
✔ Admin acessando Consolidação Holding: Status 200 (Esperado 200 OK)

=== TESTE DE FUMAÇA DO ERP (app/smoke-test-admin.js) ===
🚀 SUCESSO TOTAL: TODAS AS 35 ROTAS DOS 8 MÓDULOS RESPONDERAM 100% OK!
```

---

## 5. Conclusão

O isolamento multi-tenant do ERP Kytto está **100% operante e homologado em produção**. Os dados da Barbearia Dino, da Stallone Nutre Sport e da AGRO OPEN TTC estão estritamente segregados, garantindo total privacidade, conformidade contábil e segurança aos negócios.
