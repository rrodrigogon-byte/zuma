with open('app/core/kytto-event-bus.js', 'r', encoding='utf8') as f:
    c = f.read()

topicos = """
export const TOPICOS_KYTTO = Object.freeze({
  CADASTRO_SINCRONIZADO: 'cadastro.colaborador_sincronizado',
  FOLHA_ATUALIZADA: 'folha.pagamento_atualizada',
  COMANDA_PAGA: 'barbearia.comanda_paga',
  NOTIFICACAO_ENVIADA: 'whatsapp.notificacao_enviada',
  ENTREGA_ATUALIZADA: 'delivery.entrega_atualizada',
  DOCUMENTO_EMITIDO: 'fiscal.documento_emitido'
});
"""

if 'TOPICOS_KYTTO' not in c:
    c = topicos + '\n' + c
    with open('app/core/kytto-event-bus.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('TOPICOS_KYTTO exportado com sucesso!')
else:
    print('TOPICOS_KYTTO já existe')
