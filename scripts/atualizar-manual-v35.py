with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('Versão 3.4 —', 'Versão 3.5 —')
c = c.replace('Versão 3.4 (Novembro/2026)', 'Versão 3.5 (Novembro/2026)')
c = c.replace('49 evidências', '51 evidências')

secao_manual_v35 = """

---

## 35. OPERAÇÃO DA EQUIPE: PERMANÊNCIA DO BARBEIRO BRUNO E LANÇAMENTO DE COMANDAS

### 35.1 Visão da Agenda e Seleção de Barbeiros na Tela
A Agenda Operacional (`/admin/barbearia-erp?area=operacao&tab=Agenda`) permite à recepção e aos gerentes filtrar visualmente quais profissionais devem ter seus horários exibidos no calendário diário ou semanal:
1. No topo da tela, o componente **Barbeiros na Agenda** exibe os avatares de todos os profissionais ativos: **Bruno**, **Bruno Mendes**, **Dino**, **Ester**, **Jhenyffer Andrade** e **Nati**;
2. Ao clicar no botão **Filtrar exibição**, o operador pode marcar ou desmarcar profissionais individualmente; o sistema preserva no navegador a preferência sem alterar o cadastro oficial;
3. O barbeiro **Bruno Mendes Pedroso** possui status ativo definitivo e blindagem contra inativações automáticas.

![Print 50 — Agenda da Barbearia Dino com Bruno Mendes Ativo](/home/ubuntu/agro-open/docs/prints/50-barbearia-agenda-bruno-mendes-ativo.png)

### 35.2 Abertura de Comanda e Lançamento de Itens por Profissional
Ao abrir uma comanda de atendimento ou lançar procedimentos de pacotes/clubes:
1. Selecione o cliente cadastrado ou clique em **Cliente Balcão**;
2. Defina o **Profissional Responsável** selecionando **Bruno**;
3. No carrinho de itens, cada procedimento ou serviço avulso pode ter seu profissional associado independentemente, permitindo que diferentes profissionais prestem atendimento na mesma comanda (ex: corte com Bruno e barba com Dino);
4. O motor Kytto reconhece tanto o ID quanto o nome do profissional, garantindo validação imediata e comissionamento sem erros.

![Print 51 — Comanda de Atendimento com Bruno Selecionado com Sucesso](/home/ubuntu/agro-open/docs/prints/51-barbearia-comanda-procedimento-bruno-sucesso.png)
"""

c = c + secao_manual_v35

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(c)

print('MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md atualizado para v3.5!')
