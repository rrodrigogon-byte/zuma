#!/usr/bin/env python3

with open('app/dino-equipe-seed.js', 'r', encoding='utf8') as f:
    code = f.read()

target = """        if (prof) {
          barbeariaErpKytto.atualizarProfissional(empId, prof.id, {
            ...dadosProf,
            nome: prof.nome || dadosProf.nome,
            ativo: true,
            removidoEm: null,
          });
        } else {"""

replacement = """        if (prof) {
          // Se o profissional foi inativado ou removido pelo gestor da barbearia,
          // RESPEITA a decisão e NÃO ressuscita! Mantém todo o histórico preservado.
          if (prof.ativo === false || prof.removidoEm) {
            continue;
          }
          barbeariaErpKytto.atualizarProfissional(empId, prof.id, {
            ...dadosProf,
            nome: prof.nome || dadosProf.nome,
            ativo: true,
            removidoEm: null,
          });
        } else {"""

if target in code:
    code = code.replace(target, replacement, 1)
    with open('app/dino-equipe-seed.js', 'w', encoding='utf8') as f:
        f.write(code)
    print("app/dino-equipe-seed.js corrigido com sucesso!")
else:
    print("target nao encontrado em app/dino-equipe-seed.js")
