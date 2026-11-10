# -*- coding: utf-8 -*-
with open('app/server.js', 'r', encoding='utf-8') as f:
    c = f.read()

antigo_seed = """  // Provisionamento de Silvester Natal (Stallone e Agro Open)
  const temSilvester = (d.usuarios || []).some(u => norm(u.email).includes('silvester') || norm(u.username) === 'silvester');
  if (!temSilvester) {
    d.usuarios.push({
      id: 'usr-silvester-01',
      nome: 'Silvester Natal',
      username: 'silvester',
      email: 'silvester_natal@hotmail.com',
      senhaHash: bcrypt.hashSync('123456', 10),
      role: 'organizador',
      empresaId: EMPRESA_STALLONE_ID,
      ativo: true,
      criadoEm: new Date().toISOString()
    });
    save();
  }
}"""

novo_seed = """  // Provisionamento de Silvester Natal (Stallone e Agro Open)
  const temSilvester = (d.usuarios || []).some(u => norm(u.email).includes('silvester') || norm(u.username) === 'silvester');
  if (!temSilvester) {
    d.usuarios.push({
      id: 'usr-silvester-01',
      nome: 'Silvester Natal',
      username: 'silvester',
      email: 'silvester_natal@hotmail.com',
      senhaHash: bcrypt.hashSync('123456', 10),
      role: 'organizador',
      empresaId: EMPRESA_STALLONE_ID,
      ativo: true,
      criadoEm: new Date().toISOString()
    });
    save();
  }
  // Provisionamento de Ster (Operadora / Atendente da Dino Barbearia)
  const temSter = (d.usuarios || []).some(u => norm(u.username) === 'ster' || norm(u.email).includes('ster@') || norm(u.username) === 'ester');
  if (!temSter) {
    d.usuarios.push({
      id: 'usr-dino-ster-operador-01',
      nome: 'Steffany Marielly de Oliveira (Ster)',
      username: 'ster',
      apelido: 'Ster',
      email: 'ster@barbeariadino.com.br',
      emailAlternativo: 'ester@barbeariadino.com.br',
      senhaHash: bcrypt.hashSync('123456', 10),
      role: 'operador',
      perfil: 'operador',
      especialidade: 'Atendente & Operadora de Balcão (Recepção, Agenda e Caixa)',
      empresaId: DINO_COMMERCE_EMPRESA_ID,
      lojaId: DINO_COMMERCE_LOJA_ID,
      ativo: true,
      criadoEm: new Date().toISOString()
    });
    save();
  } else {
    const uSter = d.usuarios.find(u => norm(u.username) === 'ster' || norm(u.email).includes('ster@') || norm(u.username) === 'ester');
    if (uSter) {
      uSter.role = 'operador';
      uSter.perfil = 'operador';
      uSter.empresaId = DINO_COMMERCE_EMPRESA_ID;
      uSter.lojaId = DINO_COMMERCE_LOJA_ID;
      uSter.senhaHash = bcrypt.hashSync('123456', 10);
      uSter.ativo = true;
      save();
    }
  }
}"""

antigo_find = "else if (['ester', 'steffany', 'steffany marielly'].includes(n)) alias = 'ester';"
novo_find = "else if (['ster', 'ester', 'steffany', 'steffany marielly', 'ster atendente', 'ester atendente'].includes(n)) alias = 'ster';"

if antigo_seed in c:
    c = c.replace(antigo_seed, novo_seed)
    print("Seed substituído com sucesso!")
else:
    print("antigo_seed não encontrado!")

if antigo_find in c:
    c = c.replace(antigo_find, novo_find)
    print("findUser substituído com sucesso!")
else:
    print("antigo_find não encontrado!")

with open('app/server.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("app/server.js salvo!")
