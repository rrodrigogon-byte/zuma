with open('app/barbearia-erp-kytto.js', 'r', encoding='utf8') as f:
    c = f.read()

target = "const antes = { dataHora: atual.dataHora, dataAgenda: atual.dataAgenda, profissionalId: atual.profissionalId, servicoId: atual.servicoId };"
replacement = "const antes = { dataHora: atual.dataHora, dataAgenda: atual.dataAgenda, horaLocal: atual.horaLocal, profissionalId: atual.profissionalId, servicoId: atual.servicoId };"

assert target in c, "target não encontrado em barbearia-erp-kytto.js!"
c = c.replace(target, replacement, 1)

with open('app/barbearia-erp-kytto.js', 'w', encoding='utf8') as f:
    f.write(c)

print("barbearia-erp-kytto.js atualizado com horaLocal em antes!")
