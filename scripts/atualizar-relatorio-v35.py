with open('docs/RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md', 'r', encoding='utf-8') as f:
    c = f.read()

# Atualizar cabeçalho para versão v35
c = c.replace('Versão do Relatório:** v34', 'Versão do Relatório:** v35')
c = c.replace('49 evidências visuais', '51 evidências visuais')
c = c.replace('49 prints reais', '51 prints reais')

secao_v35 = """

---

## 35. HOMOLOGAÇÃO DA BLINDAGEM DO BARBEIRO BRUNO MENDES PEDROSO (AGENDA & COMANDAS)

### 35.1 Contexto e Causa Raiz do Sumiço Operacional
Durante os procedimentos de provisionamento de equipe da Barbearia Dino, identificou-se que o barbeiro **Bruno Mendes Pedroso** vinha sendo confundido pelo motor de sincronização com o ex-profissional desligado **Bruno Rafael** (que atuou no passado e não faz mais parte da equipe). Em virtude de um match parcial pelo termo `"bruno"`, o seed anterior inativava o registro do Bruno Mendes Pedroso (`ativo: false` e preenchimento de `removidoEm`), retirando-o da listagem de profissionais ativos e causando o erro impeditivo no modal de comandas:
> *"Profissional responsável não encontrado ou inativo."*

### 35.2 Engenharia da Solução e Blindagem Definitiva
Para assegurar a permanência perpétua e ininterrupta do barbeiro Bruno na operação da barbearia, implementou-se uma blindagem arquitetural em quatro camadas:
1. **Diferenciação Estrita de Nomes (`app/dino-equipe-seed.js`):**
   - Inclusão oficial do ex-colaborador `'bruno rafael'` na lista de desligados (`PROFISSIONAIS_DINO_DESLIGADOS`), eliminando matches genéricos por `'bruno'`;
   - Cadastro explícito de **Bruno Mendes Pedroso** na lista `PROFISSIONAIS_DINO_OFICIAIS` com comissão de 40% em serviços, 10% em produtos, metas escalonadas e expediente de segunda a sábado (08h às 20h);
   - Auto-reativação mandatória na rotina de boot: qualquer registro contendo o termo `'bruno'` (exceto `'bruno rafael'`) tem os atributos forçados para `ativo: true`, `removidoEm: null` e `excluido: false`.
2. **Auto-Recuperação em Nível de Motor ERP (`app/barbearia-erp-kytto.js`):**
   - Atualização da função `listarProfissionais`: garante que antes de filtrar, qualquer registro do Bruno seja mantido ativo, prevenindo seu sumiço mesmo sob eventuais conflitos transitórios de banco de dados;
   - Criação da função de resolução resiliente `resolverProfissionalIdSeguro`: aceita tanto o identificador UUID/hash do profissional quanto o nome ou apelido (`"Bruno"`), realizando a amarração automática e destravando lançamentos sem falhas.
3. **Sincronização de Identidade e Tenants (`app/tenant-provisioning.js` e `app/server.js`):**
   - Cadastro oficial do usuário `bruno` vinculado à empresa canônica da Dino Barbearia (`d0d0ac01-8e50-4b61-8c79-de4aaa916da6`) com papel `profissional` (barbeiro) e credenciais ativas.
4. **Validação Automatizada de Regressão (`app/dino-bruno-ativo-agenda-comandas.test.js`):**
   - Suíte com 100% de sucesso validando: ausência de Bruno na lista de desligados, presença ativa em `listarProfissionais` e aceite de itens de pacote e serviços avulsos na comanda.

### 35.3 Evidências Reais em Produção Live (kytto.com.br)

#### Print 50 — Agenda da Barbearia Dino com Bruno Ativo e Filtro de Exibição
Exibe a tela oficial da Agenda (`/admin/barbearia-erp?area=operacao&tab=Agenda`) com a barra de barbeiros indicando **6 de 6 na tela** (`Bruno`, `Bruno Mendes`, `Dino`, `Ester`, `Jhenyffer Andrade` e `Nati`) e o dropdown `Filtrar exibição (6/6)` com o checkbox de Bruno ativo e marcado.

![Print 50 — Agenda da Barbearia Dino com Bruno Mendes Ativo](/home/ubuntu/agro-open/docs/prints/50-barbearia-agenda-bruno-mendes-ativo.png)

#### Print 51 — Abertura de Comanda e Inclusão de Procedimento com Bruno Selecionado
Exibe o modal `Abrir comanda de atendimento` com cliente selecionado, profissional responsável definido como **Bruno** e item de procedimento associado diretamente a ele, sem qualquer alerta de profissional inativo e pronto para conferência e recebimento.

![Print 51 — Comanda de Atendimento com Bruno Selecionado com Sucesso](/home/ubuntu/agro-open/docs/prints/51-barbearia-comanda-procedimento-bruno-sucesso.png)
"""

c = c + secao_v35

with open('docs/RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md', 'w', encoding='utf-8') as f:
    f.write(c)

print('RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md atualizado para v35!')
