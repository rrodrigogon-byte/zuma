# Kytto ERP — Plano Oficial de Desenvolvimento e Homologação
**Data:** 03 de Novembro de 2026  
**Empresas Rodando:** Barbearia Dino (Tangará da Serra - MT) e Stallone Nutre Sport (Silvester Holding)  
**Objetivo:** Levar os 8 módulos do ERP ao ciclo completo e sanar as 10 correções urgentes de produção sem quebras ou perda de funcionalidades existentes.

---

## 1. Status das 10 Correções Urgentes de Produção

1. **Relatórios (`Sparkles is not defined`):**
   - **Causa:** Componentes usavam `<Sparkles />` sem importar de `lucide-react`.
   - **Status:** ✅ Resolvido em `RelatoriosDinoIndex.jsx` e `GestaoSalaoAvancada.jsx`.

2. **Retorno de Clientes (`Edit2 is not defined`):**
   - **Causa:** `<Edit2 />` utilizado sem import em `RelatorioRetornoProfissional.jsx`.
   - **Status:** ✅ Resolvido em `RelatorioRetornoProfissional.jsx`.

3. **Dados Fictícios em Clientes Atendidos (`/admin/relatorios/dino/clientes-atendidos`):**
   - **Causa:** Tela continha mock fixo com João Pedro e Carlos Silva (telefones 9999-xxxx).
   - **Status:** ✅ Resolvido: Integrado à rota `/api/admin/barbearia/clientes-360` trazendo clientes reais da base consolidada da Dino com histórico e LTV.

4. **Clube Vazio (`/admin/clube`):**
   - **Causa:** Rota `/admin/clube` sem redirecionamento para submódulo.
   - **Status:** ✅ Resolvido: Adicionado redirecionamento para `/admin/clube/recepcao` e `:secao` com `ClubeAcademia`.

5. **Commerce Core (`erro interno do Commerce Core`):**
   - **Causa:** Módulos como `cupons` e `omnichannel` bloqueados com `TENANT_USE_SCOPED_MODULE` por não estarem em `TENANT_ADMIN_MODULES`.
   - **Status:** ✅ Resolvido: Inclusão de `cupons`, `omnichannel`, `pdv`, `dino-captacao`, `clientes-360` e `relatorios` em `TENANT_ADMIN_MODULES`.

6. **PDV Offline (`Serviço temporariamente indisponível` e sem terminais):**
   - **Causa:** Ausência de terminal provisionado para a matriz da Dino.
   - **Status:** ✅ Resolvido: Auto-provisionamento do terminal `CX-01` (`Caixa Principal - Bancada`) na primeira listagem de terminais.

7. **Omnichannel & Fidelidade Avançada (`Não foi possível carregar`):**
   - **Causa:** Roteador `app/routes/omnichannel.js` não estava montado em `app/server.js` e incompatibilidade de chaves no JWT de login.
   - **Status:** ✅ Resolvido: Montadas rotas `/api/omnichannel` e `/api/admin/omnichannel` e compatibilizado `auth.js`.

8. **Cérebro do Atendente (`Sem acesso ao banco da loja`):**
   - **Status:** ✅ Validadas rotas `/api/admin/barbearia/cerebro-ia`, `/grafo` e `/executivo` respondendo 200 OK com 54 fatos ativos e IA Gemini configurada.

9. **Fiscal (SEFAZ-MT / Emitente e Certificado):**
   - **Status:** ✅ Rotas `/api/admin/fiscal/documentos` e `/api/admin/fiscal/contingencias` ativas. Preparada infraestrutura para configuração do emitente DINO BARBEARIA LTDA (Tangará da Serra - MT, código IBGE 5107958).

10. **Teste de Fumaça Automático Pós-Deploy:**
    - **Status:** ✅ Criado `app/smoke-test-admin.js` validando saúde e resposta de todas as rotas críticas a cada entrega.

---

## 2. Mapa dos 8 Módulos do ERP para o Ciclo Completo

1. **Fiscal (NFC-e 65, NF-e 55, NFS-e e SPED):**
   - Transmissão SEFAZ-MT com fila assíncrona.
   - Contingência offline (tpEmis 9) com transmissão em até 24h.
   - Motor de regras tributárias por produto (CST, CFOP, ICMS-ST MT, IBPT).
   - NFS-e para Tangará da Serra (serviços da barbearia).

2. **PDV, Caixa e Contingência:**
   - Terminais provisionados por loja (`CX-01`).
   - Fila local no navegador (IndexedDB) com sincronização idempotente.
   - Periféricos (impressora térmica, gaveta, balança).

3. **Estoque e Compras:**
   - Custo médio ponderado por depósito.
   - Rastreamento por lote e validade (essencial para granel na Stallone).
   - Entrada de estoque via importação de XML de compra.

4. **Financeiro e Conciliação:**
   - DRE gerencial e fluxo de caixa realizado vs projetado.
   - Conciliação bancária por OFX e extrato bancário.
   - Comissões de profissionais integradas ao contas a pagar.

5. **Cadastros Mestres Únicos:**
   - Produto único com variações e tabela de preços por canal.
   - Pessoa única (Cliente, Fornecedor, Funcionário) com papéis múltiplos.

6. **Vendas, CRM e Omnichannel:**
   - Pedido único integrado entre loja física, web e WhatsApp.
   - Fidelidade unificada e cupons.

7. **Relatórios e BI:**
   - Sem dados fictícios; exportação em CSV e PDF de todos os relatórios operacionais.

8. **Verticais do Núcleo:**
   - Barbearia (Dino): Agenda, comanda, comissões, NFS-e e produtos de bancada.
   - Suplementos (Stallone): Balança, granel, validade e NFC-e.
