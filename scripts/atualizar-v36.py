import openpyxl

# 1. Atualizar Relatório
with open('docs/RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md', 'r', encoding='utf-8') as f:
    r = f.read()

r = r.replace('Versão do Relatório:** v35', 'Versão do Relatório:** v36')

secao_v36 = """

---

## 36. DETALHAMENTO DA PREVENÇÃO DEFINITIVA E ARQUITETURA ANTI-SUMIÇO DE PROFISSIONAIS

### 36.1 Visão Sistêmica da Causa Raiz
A instabilidade relatada pelos usuários decorria de uma conjunção entre o frontend e o backend:
1. **Frontend (Filtro no LocalStorage):** A Agenda mantinha no `localStorage` (`dino_agenda_profissionais_visiveis`) uma lista estática de IDs selecionados. Quando o Bruno foi reativado com ID oficial, o navegador da recepcionista não o adicionava à lista salva, mantendo o filtro em `(3/4)` ou `(4/5)` e ocultando o Bruno da visualização diária;
2. **Backend (Casamento Inexato de IDs e Seed de Inativos):** Na abertura da comanda (`criarComandaBarbearia`), a validação de profissional exigia correspondência exata de chave `estado.profissionais[id]`. Se a requisição enviasse `"Bruno"` (o apelido) ou se o seed anterior tivesse inativado o registro por confusão com o ex-barbeiro desligado Bruno Rafael, a validação rejeitava com a mensagem *"Profissional responsável não encontrado ou inativo"*;
3. **Exclusão Acidental sem Trava:** A função `excluirProfissional` permitia a inativação de qualquer cadastro sem confirmação de criticidade.

### 36.2 Mecanismos de Blindagem Permanente Implementados
Para erradicar definitivamente qualquer recorrência, implementamos quatro travas arquiteturais interdependentes:
1. **Auto-Reconciliação e Auto-Cura de Visibilidade no Frontend (`BarbeariaAgendaPeriodo.jsx`):**
   - O `useEffect` da agenda agora realiza uma reconciliação dinâmica de conjuntos (`Set`): sempre que a lista de profissionais ativos carrega, qualquer profissional ativo oficial que não esteja no `localStorage` é **automaticamente incorporado** como visível;
   - Registros de ex-profissionais desligados são simultaneamente expurgados do `localStorage`, impedindo que preferências antigas ocultem colaboradores em atividade.
2. **Trava de Proteção de Titulares Oficiais (`app/barbearia-erp-kytto.js`):**
   - Implementada a lista `PROFISSIONAIS_PROTEGIDOS_DINO = ['dino', 'bruno', 'bruno mendes', 'bruno mendes pedroso', 'nati', 'ester', 'ster', 'steffany', 'jhenyffer']`;
   - A função `excluirProfissional` agora possui uma trava de segurança mandatória: qualquer tentativa de desativar um desses profissionais sem a flag explícita `forcar: true` é **bloqueada na raiz com exceção de segurança**.
3. **Resolução Resiliente e Auto-Recuperação em Comandas (`resolverProfissionalIdSeguro`):**
   - Integrada tanto em `criarComandaBarbearia` quanto em `adicionarItensComandaBarbearia`: aceita UUID técnico, ID curto, nome completo ou apelido (`"Bruno"`), resolvendo a chave canônica correta;
   - Se o registro do Bruno tiver sido inativado por qualquer inconsistência externa, o motor executa **auto-cura instantânea** (`p.ativo = true`, `p.removidoEm = null`, `p.excluido = false`) antes de salvar o item da comanda, garantindo sucesso na transação com HTTP 201.
4. **Isolamento Estrito entre Barbeiro Titular e Ex-Colaborador Desligado (`app/dino-equipe-seed.js`):**
   - A lista de ex-profissionais foi ajustada para conter exclusivamente `'bruno rafael'`, blindando o barbeiro ativo Bruno Mendes Pedroso contra qualquer rotina de sincronização de ex-funcionários.
"""

r = r + secao_v36
with open('docs/RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md', 'w', encoding='utf-8') as f:
    f.write(r)

# 2. Atualizar Manual
with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    m = f.read()

m = m.replace('Versão 3.5 —', 'Versão 3.6 —')
m = m.replace('Versão 3.5 (Novembro/2026)', 'Versão 3.6 (Novembro/2026)')

secao_manual_v36 = """

---

## 36. PREVENÇÃO DEFINITIVA CONTRA SUMIÇO DE PROFISSIONAIS E TRAVAMENTO DE COMANDAS

### 36.1 Por que o profissional não sai mais da agenda?
1. **Auto-Reconciliação da Tela:** A agenda do Kytto ERP monitora os profissionais contratados e em atividade. Mesmo que a recepcionista tenha usado o filtro de exibição no passado, o sistema detecta a presença de profissionais ativos e garante que eles estejam marcados por padrão;
2. **Proteção contra Exclusão Involuntária:** Os barbeiros oficiais titulares (Dino, Bruno Mendes, Nati, Ester/Ster, Jhenyffer) são cadastrados como profissionais protegidos. O sistema impede que cliques acidentais no painel administrativo desativem esses colaboradores;
3. **Validação Inteligente em Comandas:** Ao abrir uma comanda de atendimento ou lançar procedimentos de pacotes/clubes, o operador pode selecionar o barbeiro normalmente. O sistema amarra o profissional e confirma o lançamento sem erros.
"""

m = m + secao_manual_v36
with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(m)

# 3. Gerar Planilha v36
wb = openpyxl.load_workbook('docs/Kytto_e_Plataforma_vs_Mercado_v35.xlsx')
wb.save('docs/Kytto_e_Plataforma_vs_Mercado_v36.xlsx')
wb.save('/home/ubuntu/upload/Kytto_e_Plataforma_vs_Mercado_v36.xlsx')

print('Documentos e planilha atualizados para versao v36 com sucesso!')
