with open('app/barbearia-erp-kytto.js', 'r', encoding='utf8') as f:
    c = f.read()

target = "  agendamento.status = atual.status;"
replacement = """  const STATUS_VALIDOS = ['agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu'];
  agendamento.status = (dados.status && STATUS_VALIDOS.includes(dados.status)) ? dados.status : atual.status;"""

assert target in c, "target não encontrado em barbearia-erp-kytto.js!"
c = c.replace(target, replacement, 1)

with open('app/barbearia-erp-kytto.js', 'w', encoding='utf8') as f:
    f.write(c)

print("barbearia-erp-kytto.js atualizado com suporte a status em atualizarAgendamento!")
