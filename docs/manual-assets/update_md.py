with open('/home/ubuntu/MANUAL_AGENDAMENTO_BARBEIROS_KYTTO.md', 'r', encoding='utf-8') as f:
    text = f.read()

nova_secao_md = """
---

## 7. Gestão de Caixa Padrão AVEC e Procedimento de Reabertura para Correções

Para atender às necessidades diárias de conciliação e garantir paridade total com o sistema legado AVEC, a Kytto disponibilizou o módulo analítico de fechamento de caixa com conferência vertical por forma de pagamento e detalhamento por bandeiras de cartão.

### 7.1 Conferência Consolidada de Caixa
O painel exibe:
- **Metadados:** Operador responsável, e-mail institucional, horário exato de abertura e de fechamento, data e responsável pela última alteração, valor inicial em dinheiro e cheque.
- **Sangrias e Suprimentos:** Relação de saídas e entradas avulsas de numerário registradas no turno.
- **Tabela de Formas de Pagamento:** Valores sistêmicos e divergências apuradas para Dinheiro, Cartão Crédito (com abertura detalhada por bandeira: MasterCard, Visa, ELO), Cartão Débito (MasterCard, Visa), Pix, Total Faturado, Créditos Utilizados e Dívidas/Em Conta.

![Painel de Conferência de Caixa Padrão AVEC com Botão Reabrir](/home/ubuntu/manual-assets/print_caixa_conferencia_avec.png)

### 7.2 Drilldown Interativo de Comandas por Meio de Pagamento
Ao clicar em qualquer linha da tabela de pagamentos (ex.: *Cartão Débito* ou sub-bandeira *MasterCard*), abre-se a listagem com todas as comandas, clientes atendidos e valores unitários.

![Drilldown de Comandas por Meio de Pagamento](/home/ubuntu/manual-assets/print_caixa_drilldown_comandas.png)

### 7.3 Passo a Passo: Reabertura de Caixa e Correção de Lançamentos
Quando um cliente paga no Cartão de Crédito ou PIX e o operador lança por engano no Cartão de Débito (ou vice-versa), siga este procedimento:

1. **Acessar o Caixa Fechado:** No painel de *Caixa e Fechamento* ou no *Relatório de Caixas Fechados*, selecione o caixa desejado.
2. **Clicar em "🔓 Reabrir Caixa":** Localizado no rodapé do painel de conferência.
3. **Informar o Motivo:** Descreva sucintamente a razão da reabertura (ex.: *"Cliente pagou no débito e foi lançado como crédito"*). O caixa retornará ao status **Aberto**.
4. **Corrigir a Comanda:** Abra o drilldown da forma de pagamento, localize a comanda e clique em **✏️ Corrigir**. Selecione a forma correta e a bandeira do cartão, clicando em **Salvar Alteração**.
5. **Reconciliação Automática:** Os totais faturados e os saldos são recalculados instantaneamente sem necessidade de intervenção contábil manual.
6. **Fechar o Caixa:** Concluídas as correções, clique em **Fechar Caixa**, informe o valor físico contado em dinheiro e finalize o turno com segurança.

---

## 8. Relatório Oficial Impresso de Fechamento de Caixa

A qualquer momento, o operador ou a gerência pode emitir o comprovante formal de prestação de contas físicas clicando no botão **🖨️ Imprimir Relatório**.

O relatório apresenta layout otimizado para impressoras térmicas e padrão A4/PDF:
1. **Cabeçalho Institucional:** Identificação do estabelecimento e timestamp da impressão.
2. **Dados do Turno:** Responsável, horários e fundo inicial.
3. **Resumo por Meios:** Total em caixa agrupado por forma de pagamento e bandeiras.
4. **Detalhamento Analítico:** Lista linha por linha contendo *Forma de Pagamento | Comanda / Cliente | Valor Pago*.

![Relatório Oficial Impresso de Fechamento de Caixa](/home/ubuntu/manual-assets/print_caixa_relatorio_fechamento_oficial.png)
"""

target = "*Documento gerado pelo Kytto"
assert target in text, 'target footer not found'
text = text.replace(target, nova_secao_md + "\n" + target)

with open('/home/ubuntu/MANUAL_AGENDAMENTO_BARBEIROS_KYTTO.md', 'w', encoding='utf-8') as f:
    f.write(text)

print('MANUAL_AGENDAMENTO_BARBEIROS_KYTTO.md updated!')
