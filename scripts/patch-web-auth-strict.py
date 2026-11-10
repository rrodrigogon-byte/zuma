with open('web/src/lib/auth.jsx', 'r', encoding='utf8') as f:
    code = f.read()

filter_func = """function filtrarEmpresasPorUsuario(empresas, user) {
  const lista = Array.isArray(empresas) ? empresas : []
  if (!user) return lista

  const ident = String(user.email || user.username || user.login || '').trim().toLowerCase()
  const isPlatformAdmin = user.platformAdmin === true && (
    ident.includes('rodrigo.goncalves') || ident.includes('rrodrigogon') || ident === 'admin'
  )
  if (isPlatformAdmin) return lista

  const isSilvester = ident.includes('silvest') || ident.includes('stallone')
  if (isSilvester) {
    const stalloneOnly = lista.filter((e) => {
      const nome = String(e.nome || e.razaoSocial || '').toLowerCase()
      const id = String(e.id || '').toLowerCase()
      return nome.includes('stallone') || nome.includes('agro open') ||
             id === '31f70c83-9172-40c2-945f-9e793b5048be' || id === 'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e' ||
             id === '2e041110-db20-4fd1-8278-12bd3dead008'
    })
    return stalloneOnly.length > 0 ? stalloneOnly : [
      { id: '31f70c83-9172-40c2-945f-9e793b5048be', nome: 'Stallone Nutre Sport', cnpj: '56.099.531/0001-38', brandKey: 'stallone', tipoNegocio: 'loja', ativa: true },
      { id: '2e041110-db20-4fd1-8278-12bd3dead008', nome: 'AGRO OPEN TTC', cnpj: '43.084.070/0001-88', brandKey: 'agroopen', tipoNegocio: 'bar', ativa: true }
    ]
  }

  const isDino = ident.includes('dino') || ident.includes('guicunha') ||
    ['bruno', 'natani', 'nati', 'ester', 'david', 'joao', 'amanda', 'jhenyffer'].includes(String(user.username || '').toLowerCase())
  if (isDino) {
    const dinoOnly = lista.filter((e) => {
      const nome = String(e.nome || e.razaoSocial || '').toLowerCase()
      const id = String(e.id || '').toLowerCase()
      return nome.includes('dino') || id === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || id === 'emp-kytto-001'
    })
    return dinoOnly.length > 0 ? dinoOnly : [DINO_COMPANY]
  }

  if (user.empresaId) {
    const doUsuario = lista.filter((e) => String(e.id || '').toLowerCase() === String(user.empresaId).toLowerCase())
    if (doUsuario.length > 0) return doUsuario
  }

  return lista
}
"""

if 'function filtrarEmpresasPorUsuario' not in code:
    code = code.replace("function empresasComFallbackDino", filter_func + "\nfunction empresasComFallbackDino")

# Atualizar readEmpresasAcessiveisInicial
old_read_init = """function readEmpresasAcessiveisInicial() {
  return empresasComFallbackDino(readStorage('sp_empresas_acessiveis', []))
}"""

new_read_init = """function readEmpresasAcessiveisInicial() {
  const user = readStorage('sp_user')
  const base = empresasComFallbackDino(readStorage('sp_empresas_acessiveis', []))
  return filtrarEmpresasPorUsuario(base, user)
}"""

code = code.replace(old_read_init, new_read_init)

# Atualizar atualizarContextoLojas
old_atualizar = """    const empresasAtualizadas = Array.isArray(empresas) ? empresasComFallbackDino(empresas) : null"""
new_atualizar = """    const empresasAtualizadas = Array.isArray(empresas) ? filtrarEmpresasPorUsuario(empresasComFallbackDino(empresas), user) : null"""

code = code.replace(old_atualizar, new_atualizar)

# Atualizar empresasAcessiveis fornecido no contexto
old_return = """      empresaAtiva,
      empresasAcessiveis,"""

new_return = """      empresaAtiva,
      empresasAcessiveis: filtrarEmpresasPorUsuario(empresasAcessiveis, user),"""

code = code.replace(old_return, new_return)

with open('web/src/lib/auth.jsx', 'w', encoding='utf8') as f:
    f.write(code)

print("web/src/lib/auth.jsx atualizado com sucesso!")
