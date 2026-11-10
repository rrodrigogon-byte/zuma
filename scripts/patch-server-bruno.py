with open('app/server.js', 'r', encoding='utf-8') as f:
    c = f.read()

antigo = """  // Provisionamento de Ster (Operadora / Atendente da Dino Barbearia)"""

novo = """  // Provisionamento de Bruno Mendes (Barbeiro Profissional da Dino Barbearia)
  const temBruno = (d.usuarios || []).some(u => norm(u.username) === 'bruno' || norm(u.email).includes('bruno@'));
  if (!temBruno) {
    d.usuarios.push({
      id: 'usr-dino-bruno-profissional-01',
      nome: 'Bruno Mendes Pedroso',
      username: 'bruno',
      apelido: 'Bruno',
      email: 'bruno@barbeariadino.com.br',
      emailAlternativo: 'brunomendes@barbeariadino.com.br',
      senhaHash: bcrypt.hashSync('123456', 10),
      role: 'profissional',
      perfil: 'profissional',
      especialidade: 'Barbeiro Especialista (Corte, Barba e Procedimentos)',
      empresaId: DINO_COMMERCE_EMPRESA_ID,
      lojaId: DINO_COMMERCE_LOJA_ID,
      ativo: true,
      criadoEm: new Date().toISOString()
    });
    save();
  } else {
    const uBruno = d.usuarios.find(u => norm(u.username) === 'bruno' || norm(u.email).includes('bruno@'));
    if (uBruno) {
      uBruno.role = 'profissional';
      uBruno.perfil = 'profissional';
      uBruno.empresaId = DINO_COMMERCE_EMPRESA_ID;
      uBruno.lojaId = DINO_COMMERCE_LOJA_ID;
      uBruno.senhaHash = bcrypt.hashSync('123456', 10);
      uBruno.ativo = true;
      save();
    }
  }

  // Provisionamento de Ster (Operadora / Atendente da Dino Barbearia)"""

if antigo in c:
    c = c.replace(antigo, novo)
    with open('app/server.js', 'w', encoding='utf-8') as f:
        f.write(c)
    print('server.js atualizado com usuário Bruno!')
else:
    print('Aviso: ponto de inserção não encontrado em server.js')
