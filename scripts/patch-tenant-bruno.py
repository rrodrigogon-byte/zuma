with open('app/tenant-provisioning.js', 'r', encoding='utf-8') as f:
    c = f.read()

antigo = """    usuarios: [
      { username: 'dino', email: 'dino@barbeariadino.com.br', emailAlt: 'guicunha136@gmail.com', nome: 'Guilherme Cunha Martins', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { username: 'natani', email: 'natani@barbeariadino.com.br', emailAlt: 'nati@barbeariadino.com.br', nome: 'Natani Minanis Dobler', role: 'profissional', pgRole: 'barbeiro' },"""

novo = """    usuarios: [
      { username: 'bruno', email: 'bruno@barbeariadino.com.br', emailAlt: 'brunomendes@barbeariadino.com.br', nome: 'Bruno Mendes Pedroso', role: 'profissional', pgRole: 'barbeiro' },
      { username: 'dino', email: 'dino@barbeariadino.com.br', emailAlt: 'guicunha136@gmail.com', nome: 'Guilherme Cunha Martins', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { username: 'natani', email: 'natani@barbeariadino.com.br', emailAlt: 'nati@barbeariadino.com.br', nome: 'Natani Minanis Dobler', role: 'profissional', pgRole: 'barbeiro' },"""

if antigo in c:
    c = c.replace(antigo, novo)
    with open('app/tenant-provisioning.js', 'w', encoding='utf-8') as f:
        f.write(c)
    print('tenant-provisioning.js atualizado com sucesso!')
else:
    print('Aviso: trecho não encontrado em tenant-provisioning.js')
