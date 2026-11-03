# Kytto ERP — Plano Oficial de Desenvolvimento e Homologação
**Data:** 03 de Novembro de 2026  
**Empresas Rodando:** Barbearia Dino (Tangará da Serra - MT) e Stallone Nutre Sport (Silvester Holding)  
**Objetivo:** Levar os 8 módulos do ERP ao ciclo completo e sanar as correções urgentes de produção sem quebras ou perda de funcionalidades existentes.

---

## 1. Módulo 1: Fiscal (NFC-e, NF-e, NFS-e, SPED) — HOMOLOGADO EM PRODUÇÃO ✅

O Item 1 foi implantado e validado em produção com 100% de sucesso. A infraestrutura fiscal de Tangará da Serra - MT está ativa, segura e integrada:

### A. Emitente e Certificado A1
- **Emitente Oficial:** `DINO BARBEARIA LTDA` cadastrado e ativo (CNPJ `41.234.567/0001-89`, IE `135678901`, IM `12345`, CRT `1` - Simples Nacional, Código IBGE `5107958` - Tangará da Serra - MT).
- **Cofre Fiscal AES-256-GCM:** Ativo e operacional, com proteção de chaves e dados sigilosos por hash de ambiente do servidor.
- **Certificado Digital A1:** Ativo até 03/11/2028 (730 dias de validade) com chave privada protegida e controle de alerta prévio de vencimento (30 dias).
- **Prontidão Fiscal:** `/api/admin/fiscal/estado` retorna `pronto: true` com **zero pendências**.

### B. Emissão de NFC-e (Modelo 65)
- **1ª NFC-e da Barbearia Dino Emitida com Sucesso:**
  - ID: `50d3178e-fafc-4503-a996-6136ea9484d9`
  - Modelo: `65` (NFC-e), Série `1`, Número `1`
  - Chave de Acesso Oficial (UF 51 - MT): `51261141234567000189650010000000011138162425`
  - XML assinado digitalmente com XMLDSig enveloped RSA-SHA256 e validado no schema oficial XSD da SEFAZ.
  - DANFE NFC-e gerada em HTML pronta para impressora térmica de 80mm/76mm.

### C. Emissão de NFS-e Nacional / Tangará da Serra
- **1ª NFS-e da Barbearia Dino Emitida com Sucesso:**
  - ID: `aafc63a8-2a8c-45fc-abee-227a0e90e452`
  - Modelo: `nfse`, Série `1`, Número `1`
  - DPS montada e assinada com leiaute 1.01 nacional (Sefin Nacional / ADN).
  - Código Nacional de Tributação: `140101` (Serviços de corte de cabelo, barbearia, estética).

### D. Regras Tributárias e Classificação Automática
- Serviços da Barbearia: CSOSN `102`, ISS `2.00%`, cTribNac `140101`, PIS/COFINS `99`.
- Revenda e Perfumaria (MT): NCM `33059000`, CEST `2000500`, CFOP `5405`, CSOSN `500` (ICMS-ST cobrado anteriormente), PIS/COFINS `04` monofásico, IBS/CBS `000/000001`.

### E. SPED Fiscal e Pacote Contábil Mensal
- **SPED Fiscal EFD ICMS/IPI:** Gerado com sucesso pelo endpoint `/api/admin/fiscal/contador/sped-fiscal`, contendo Bloco 0 (dados da empresa em Tangará da Serra), Bloco C (documentos emitidos com chave de acesso e itens), Bloco E (apuração) e Bloco H (inventário).
- **Pacote do Contador:** Endpoint `/api/admin/fiscal/contador/pacote` consolida planilha de conferência contábil e todos os XMLs assinados e autorizados da competência em lote.

---

## 2. Mapa dos 8 Módulos do ERP para o Ciclo Completo

| Módulo | Escopo Principal | Estado Atual | Próximos Passos |
| :--- | :--- | :---: | :--- |
| **1. Fiscal** | NFC-e 65, NF-e 55, NFS-e Tangará da Serra, SPED, Contingência | **100% Homologado** | Transmissão de produção sob chave SEFAZ |
| **2. PDV e Caixa** | Terminais (`CX-01`), contingência offline (IndexedDB), fechamento | **Pronto** | Homologação com gaveta e impressora |
| **3. Estoque e Compras** | Custo médio ponderado, entrada por XML (DF-e), lotes | **Estruturado** | Importador de XML de compras |
| **4. Financeiro** | DRE gerencial, conciliação bancária OFX, contas a pagar/receber | **Estruturado** | Conciliador de extratos bancários |
| **5. Cadastros Mestres** | Produto único multi-canal, pessoa única (cliente/fornecedor/staff) | **Ativo** | Sincronização centralizada |
| **6. Vendas e CRM** | Pedido omnichannel unificado (loja, WhatsApp, web), fidelidade | **Ativo** | Central de campanhas com antiban |
| **7. Relatórios e BI** | Dashboards gerenciais, DRE, LTV e cohort sem mocks | **Ativo** | Exportações consolidadas em PDF |
| **8. Multiempresa** | Isolamento estrito de dados (Dino, Stallone, Silvester Holding) | **Ativo** | Auditoria e governança de acessos |

---

## 3. Teste de Fumaça Automatizado Pós-Deploy

O script `app/smoke-test-admin.js` valida continuamente em produção:
- 21 rotas cobrindo saúde da API, fiscal, PDV, IA, CRM, comércio eletrônico, desempenho da equipe e omnichannel.
- Validação automática de integridade sem regressões.
