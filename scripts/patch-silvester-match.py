#!/usr/bin/env python3

# 1. Patch em app/server.js
with open('app/server.js', 'r', encoding='utf8') as f:
    s = f.read()

old_fn = """const isSilvesterUser = (user) => {
  if (!user) return false;
  if (isAdminGlobal(user)) return false;
  const em = norm(user.email || user.username || user.login || user.nome || user.id || '');
  return em.includes('silvester') || em.includes('silvestre');
};

const isGuilhermeUser = (user) => {
  if (!user) return false;
  if (isAdminGlobal(user)) return false;
  const em = norm(user.email || user.username || user.login || user.nome || user.id || '');
  return em.includes('guilherme') || em.includes('guicunha') || em.includes('dino') || em === 'gui';
};"""

new_fn = """const isSilvesterUser = (user) => {
  if (!user) return false;
  if (isAdminGlobal(user)) return false;
  const em = (
    norm(user.email) + ' ' +
    norm(user.emailAlternativo) + ' ' +
    norm(user.username) + ' ' +
    norm(user.login) + ' ' +
    norm(user.nome) + ' ' +
    norm(user.id)
  );
  return em.includes('silvester') || em.includes('silvestre') || em.includes('stallone');
};

const isGuilhermeUser = (user) => {
  if (!user) return false;
  if (isAdminGlobal(user)) return false;
  const em = (
    norm(user.email) + ' ' +
    norm(user.emailAlternativo) + ' ' +
    norm(user.username) + ' ' +
    norm(user.login) + ' ' +
    norm(user.nome) + ' ' +
    norm(user.id)
  );
  return em.includes('guilherme') || em.includes('guicunha') || em.includes('dino') || em.includes('gui');
};"""

if old_fn in s:
    s = s.replace(old_fn, new_fn, 1)
    print("isSilvesterUser e isGuilhermeUser atualizados em app/server.js!")
else:
    print("AVISO: old_fn não encontrado exatamente em app/server.js")

# Inserir username em tokenFor
old_token_for = "const tokenFor = u => jwt.sign({ id:u.id, nome:u.nome, email:u.email, role:u.role,"
new_token_for = "const tokenFor = u => jwt.sign({ id:u.id, nome:u.nome, email:u.email, username:u.username, role:u.role,"

if old_token_for in s:
    s = s.replace(old_token_for, new_token_for, 1)
    print("username adicionado ao payload do token em app/server.js!")

with open('app/server.js', 'w', encoding='utf8') as f:
    f.write(s)

# 2. Patch em app/modules/empresas/rotas.js
with open('app/modules/empresas/rotas.js', 'r', encoding='utf8') as f:
    r = f.read()

r_old = """      const em = String(req.user?.email || req.user?.username || '').toLowerCase();
      if (em.includes('silvester') || em.includes('silvestre')) {"""

r_new = """      const em = (
        String(req.user?.email || '') + ' ' +
        String(req.user?.emailAlternativo || '') + ' ' +
        String(req.user?.username || '') + ' ' +
        String(req.user?.nome || '') + ' ' +
        String(req.user?.id || '')
      ).toLowerCase();
      if (em.includes('silvester') || em.includes('silvestre') || em.includes('stallone')) {"""

r = r.replace(r_old, r_new)

with open('app/modules/empresas/rotas.js', 'w', encoding='utf8') as f:
    f.write(r)
print("app/modules/empresas/rotas.js atualizado com sucesso!")

# 3. Patch em app/tenant-provisioning.js
with open('app/tenant-provisioning.js', 'r', encoding='utf8') as f:
    tp = f.read()

agro_old = """  agroopen: {
    empresaId: '2e041110-db20-4fd1-8278-12bd3dead008',
    lojaId: '17b057ab-a13f-4fee-ae42-bc70578ec756',
    nome: 'AGRO OPEN TTC',
    slug: 'agroopen',
    roleIdOwner: 'b125e523-957d-4d12-a881-56b958ecec45',
    roleIdStaff: '10a80e2f-6f9f-4c54-8a28-7bb6c317c3d2',
    usuarios: [
      { username: 'agroopen', email: 'cauarafa7@gmail.com', nome: 'Cauã Rafa', role: 'admin', pgRole: 'admin', isOwner: true },
      { username: 'teste_diag', email: 'teste_diag@test.com', nome: 'Operador Agro Open', role: 'operador', pgRole: 'operador' },"""

agro_new = """  agroopen: {
    empresaId: '2e041110-db20-4fd1-8278-12bd3dead008',
    lojaId: '17b057ab-a13f-4fee-ae42-bc70578ec756',
    nome: 'AGRO OPEN TTC',
    slug: 'agroopen',
    roleIdOwner: 'b125e523-957d-4d12-a881-56b958ecec45',
    roleIdStaff: '10a80e2f-6f9f-4c54-8a28-7bb6c317c3d2',
    usuarios: [
      { username: 'agroopen', email: 'cauarafa7@gmail.com', nome: 'Cauã Rafa', role: 'admin', pgRole: 'admin', isOwner: true },
      { username: 'silvester_agro', email: 'silvester_natal@hotmail.com', nome: 'Silvester Natal', role: 'organizador', pgRole: 'gerente', isOwner: true },
      { username: 'teste_diag', email: 'teste_diag@test.com', nome: 'Operador Agro Open', role: 'operador', pgRole: 'operador' },"""

if agro_old in tp:
    tp = tp.replace(agro_old, agro_new, 1)
    with open('app/tenant-provisioning.js', 'w', encoding='utf8') as f:
        f.write(tp)
    print("Silvester adicionado aos usuários de Agro Open em tenant-provisioning.js!")
else:
    print("AVISO: agro_old não encontrado exatamente")
