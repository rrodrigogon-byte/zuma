with open('app/core/whatsapp-ai.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """    const agendamentos = barbearia.listarAgendamentos(empresaId, { telefone });
    if (Array.isArray(agendamentos)) {
      for (const ag of agendamentos) {
        if (ag.clienteNome) {
          nomeLimpo = cleanCustomerDisplayName(ag.clienteNome);
          if (nomeLimpo) return nomeLimpo;
        }
      }
    }"""

replacement = """    const agendamentos = barbearia.listarAgendamentos(empresaId, { telefone });
    if (Array.isArray(agendamentos)) {
      const telDigitos = String(telefone || '').replace(/\\D/g, '');
      for (const ag of agendamentos) {
        const agTel = String(ag.clienteTelefone || '').replace(/\\D/g, '');
        if (ag.clienteNome && agTel && (agTel.slice(-8) === telDigitos.slice(-8) || agTel === telDigitos)) {
          nomeLimpo = cleanCustomerDisplayName(ag.clienteNome);
          if (nomeLimpo) return nomeLimpo;
        }
      }
    }"""

if target in c:
    c = c.replace(target, replacement, 1)
    with open('app/core/whatsapp-ai.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('resolverNomeCliente com conferencia de telefone atualizado com sucesso!')
else:
    print('target nao encontrado!')
