# -*- coding: utf-8 -*-
with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    c = f.read()

# Atualizar versão no cabeçalho
c = c.replace('Versão do Documento:** 3.0 (Edição Definitiva Homologada de Produção — Catálogo Completo de 43 Telas e Evidências Reais)', 'Versão do Documento:** 3.1 (Edição Definitiva Homologada de Produção — Catálogo Completo de 44 Telas e Evidências Reais)')

# Atualizar sumário
sumario_antigo = """23. **Catálogo Integrado de Materiais, Estoque de Bebidas e Produtos de Revenda (Print 43)**
24. **Guia Operacional Passo a Passo para Gerentes e Recepção**
25. **Termo de Homologação e Conclusão**"""

sumario_novo = """23. **Catálogo Integrado de Materiais, Estoque de Bebidas e Produtos de Revenda (Print 43)**
24. **Perfil de Operador de Balcão e Atendimento da Barbearia Dino: Sessão da Ster (Print 44)**
25. **Guia Operacional Passo a Passo para Gerentes e Recepção**
26. **Termo de Homologação e Conclusão**"""

c = c.replace(sumario_antigo, sumario_novo)

# Adicionar seção 24 antes do guia operacional
secao_ster = """---

## 24. PERFIL DE OPERADOR DE BALCÃO E ATENDIMENTO DA BARBEARIA DINO: SESSÃO DA STER (PRINT 44)

Para atender à necessidade operacional da recepção e atendimento da Dino Barbearia, foi criado e homologado o perfil de **Operador de Balcão** para a colaboradora **Ster (Steffany Marielly de Oliveira)**:

### Evidência em Produção: Sessão Oficial de Atendente da Ster (Barbearia Dino)
![Painel do Operador - Sessão de Atendente da Ster](/home/ubuntu/agro-open/docs/prints/44-operador-atendente-ster-sessao-dino.png)

### Credenciais e Especificações de Acesso:
* **Usuário Oficial:** `ster` (compatível também com alias `ester`);
* **Senha Padrão Inicial:** `123456`;
* **Nome de Exibição:** Steffany Marielly de Oliveira (Ster);
* **Papel no Sistema:** `operador` (Selo cinza **OPERADOR** no cabeçalho superior);
* **Empresa Vinculada:** Barbearia Dino (`d0d0ac01-8e50-4b61-8c79-de4aaa916da6`);
* **Unidade / Loja:** Unidade Tangará da Serra MT (`ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8`);
* **Redirecionamento Automático no Login:** Ao efetuar login, o sistema redireciona a operadora diretamente para a **Agenda Operacional** (`/admin/barbearia-erp?area=operacao&tab=Agenda`).

### Escopo de Permissões da Operadora:
1. **Módulos Liberados para Atendimento:**
   * **Agenda:** Visualização diária e semanal de todos os barbeiros, criação de novos agendamentos e encaixes, alteração de status e bloqueio de horários;
   * **Atendimento / Comandas:** Abertura de comandas virtuais, lançamento de serviços, produtos e bebidas consumidas, e recebimento de pagamentos;
   * **Caixa e Fechamento:** Abertura do caixa do dia, registro de suprimentos, sangrias e conferência de fechamento cego de balcão;
   * **Clientes:** Consulta rápida por nome ou telefone e cadastro de novos clientes;
   * **Estoque de Revenda:** Consulta de saldos e preços de produtos e bebidas.
2. **Blindagem de Segurança e Isolamento Multi-Tenant:**
   * **Zero Vazamento de Marcas:** Acesso estritamente bloqueado a Stallone Nutre Sport, AGRO OPEN TTC e Supermercado Kytto;
   * **Sigilo Gerencial e Salarial:** Bloqueio nativo a relatórios confidenciais de DRE gerencial macro, comissões de outros profissionais, margens e configurações fiscais da diretoria.

---

## 25. GUIA OPERACIONAL PASSO A PASSO PARA GERENTES E RECEPÇÃO"""

c = c.replace('--- \n\n## 24. GUIA OPERACIONAL PASSO A PASSO PARA GERENTES E RECEPÇÃO', secao_ster)
c = c.replace('---\n\n## 24. GUIA OPERACIONAL PASSO A PASSO PARA GERENTES E RECEPÇÃO', secao_ster)

c = c.replace('## 25. TERMO DE HOMOLOGAÇÃO E CONCLUSÃO', '## 26. TERMO DE HOMOLOGAÇÃO E CONCLUSÃO')
c = c.replace('todas as **43 telas e funcionalidades**', 'todas as **44 telas e funcionalidades**')

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(c)

print("Manual v3.1 atualizado com sucesso com o Print 44 da Ster!")
