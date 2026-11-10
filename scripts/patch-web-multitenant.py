#!/usr/bin/env python3

# 1. Patch em web/src/lib/auth.jsx
with open('web/src/lib/auth.jsx', 'r', encoding='utf8') as f:
    auth_content = f.read()

auth_old = "  const isPlatformAdmin = user?.platformAdmin === true"
auth_new = """  const userIdent = String(user?.email || user?.username || user?.login || '').trim().toLowerCase()
  const isPlatformAdmin = user?.platformAdmin === true && (
    userIdent.includes('rodrigo.goncalves') || userIdent.includes('rrodrigogon') || userIdent === 'admin'
  )"""

if auth_old in auth_content:
    auth_content = auth_content.replace(auth_old, auth_new, 1)
    with open('web/src/lib/auth.jsx', 'w', encoding='utf8') as f:
        f.write(auth_content)
    print("web/src/lib/auth.jsx atualizado com sucesso!")
else:
    print("AVISO: auth_old não encontrado exatamente em auth.jsx")

# 2. Patch em web/src/pages/admin/Empresas.jsx
with open('web/src/pages/admin/Empresas.jsx', 'r', encoding='utf8') as f:
    emp_content = f.read()

emp_old = """            <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#12283F' }}>
              {isPlatformAdmin ? 'Gestão de Empresas & Multiempresa' : (empresaAtiva?.nome || 'Minha Empresa')}
            </h1>
          </div>
          <div style={{ marginTop: 6, color: 'var(--muted, #64748b)', fontSize: 13 }}>
            {isPlatformAdmin
              ? 'Cadastro completo e autônomo com inteligência artificial, isolamento contábil, fiscal e operacional.'
              : 'Dados cadastrais, fiscais e operacionais exclusivos da sua unidade no ERP Kytto.'}"""

emp_new = """            <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#12283F' }}>
              {isPlatformAdmin
                ? 'Gestão de Empresas & Multiempresa'
                : (empresas.length > 1 ? 'Minhas Empresas Autorizadas' : (empresaAtiva?.nome || 'Minha Empresa'))}
            </h1>
          </div>
          <div style={{ marginTop: 6, color: 'var(--muted, #64748b)', fontSize: 13 }}>
            {isPlatformAdmin
              ? 'Painel corporativo e gestão global da holding Kytto (Acesso Exclusivo: Rodrigo Gonçalves / rrodrigogon).'
              : (empresas.length > 1
                  ? 'Empresas autorizadas sob sua gestão (Stallone & Agro Open). Alterne e opere entre elas com isolamento total.'
                  : 'Dados cadastrais, fiscais e operacionais exclusivos da sua barbearia no ERP Kytto.')}"""

if emp_old in emp_content:
    emp_content = emp_content.replace(emp_old, emp_new, 1)
    with open('web/src/pages/admin/Empresas.jsx', 'w', encoding='utf8') as f:
        f.write(emp_content)
    print("web/src/pages/admin/Empresas.jsx atualizado com sucesso!")
else:
    print("AVISO: emp_old não encontrado exatamente em Empresas.jsx")
