#!/usr/bin/env python3

with open('app/server.js', 'r', encoding='utf8') as f:
    content = f.read()

# 1. Definições de papéis e regras estritas
block_roles_old = """const PLATFORM_ADMIN_EMAILS = new Set((process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(norm).filter(Boolean));
const isPlatformAdminUser = user => Boolean(user?.pgOperational !== true && (user?.pgAccount === true ? user?.pgPlatformAdmin === true && user?.platformAdmin === true : user?.platformAdmin === true || PLATFORM_ADMIN_EMAILS.has(norm(user?.email))));
// E-mails de administração (plataforma e admin principal) não podem ser cadastrados por
// registro público nem por administrador de empresa: o e-mail sozinho daria acesso global.
const isReservedEmail = email => PLATFORM_ADMIN_EMAILS.has(norm(email)) || norm(email) === norm(process.env.ADMIN_USER || 'admin');"""

block_roles_new = """const PLATFORM_ADMIN_EMAILS = new Set((process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(norm).filter(Boolean));

// ============================================================================
// REGRAS ESTRITAS DE ISOLAMENTO MULTIEMPRESA & GOVERNANÇA DA HOLDING KYTTO
// - Admin Global: Apenas rodrigo.goncalves e rrodrigogon podem filtrar e ver TODAS as empresas.
// - Guilherme: Deve visualizar APENAS a Barbearia Dino.
// - Silvester: Deve visualizar APENAS Stallone e Agro Open.
// ============================================================================
const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const EMPRESA_STALLONE_ID = '31f70c83-9172-40c2-945f-9e793b5048be';
const EMPRESA_AGRO_OPEN_ID = '2e041110-db20-4fd1-8278-12bd3dead008';

const isAdminGlobal = (user) => {
  if (!user) return false;
  const em = norm(user.email || user.username || user.login || user.id || '');
  return em.includes('rodrigo.goncalves') || em.includes('rrodrigogon') || em === norm(process.env.ADMIN_USER || 'admin');
};

const isSilvesterUser = (user) => {
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
};

const obterEmpresasAutorizadasDoUsuario = (user) => {
  if (!user) return [];
  if (isAdminGlobal(user)) {
    return null; // Admin Global: sem restrição, vê e filtra todas as empresas
  }
  if (isSilvesterUser(user)) {
    // Silvester: APENAS Stallone e Agro Open
    return [
      EMPRESA_STALLONE_ID,
      EMPRESA_AGRO_OPEN_ID,
      'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e',
      'e0e0ac01-8e50-4b61-8c79-de4aaa916da7',
      'emp-agro-open'
    ];
  }
  if (isGuilhermeUser(user)) {
    // Guilherme: APENAS Barbearia Dino
    return [
      EMPRESA_DINO_ID,
      'dino'
    ];
  }
  if (user?.empresaId) {
    return [String(user.empresaId).trim()];
  }
  return [];
};

const isPlatformAdminUser = user => Boolean(user?.pgOperational !== true && isAdminGlobal(user));
const isMainAdminUser = user => Boolean(user?.pgOperational !== true && isAdminGlobal(user));
const isReservedEmail = email => norm(email).includes('rodrigo.goncalves') || norm(email).includes('rrodrigogon') || norm(email) === norm(process.env.ADMIN_USER || 'admin');"""

if block_roles_old in content:
    content = content.replace(block_roles_old, block_roles_new, 1)
    print("Regras estritas de multiempresa inseridas com sucesso!")
else:
    print("ERRO: block_roles_old não encontrado")

# 2. Atualizar seedUsuarios para provisionar Silvester
seed_old = """    console.log(`Admin criado: login "${email}"${process.env.ADMIN_PASS ? ' (senha de ADMIN_PASS)' : PROD ? ' com senha aleatória; defina ADMIN_PASS e ADMIN_PASS_RESET=1' : ' com a senha padrão de desenvolvimento'}`);
  }
}"""

seed_new = """    console.log(`Admin criado: login "${email}"${process.env.ADMIN_PASS ? ' (senha de ADMIN_PASS)' : PROD ? ' com senha aleatória; defina ADMIN_PASS e ADMIN_PASS_RESET=1' : ' com a senha padrão de desenvolvimento'}`);
  }
  // Provisionamento de Silvester Natal (Stallone e Agro Open)
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

if seed_old in content:
    content = content.replace(seed_old, seed_new, 1)
    print("seedUsuarios atualizado para Silvester com sucesso!")
else:
    print("AVISO: seed_old não encontrado exatamente")

# 3. Atualizar commerceSessionFor para isolar Silvester e Guilherme
commerce_session_old = """    // Administradores globais e gestores autorizados recebem todas as empresas ativas da plataforma
    if (isPlatformAdminUser(user) || isMainAdminUser(user) || user.role === 'admin' || user.role === 'administrador') {"""

commerce_session_new = """    // 1. Admin Global (rodrigo.goncalves e rrodrigogon): todas as empresas ativas da plataforma
    if (isAdminGlobal(user)) {"""

if commerce_session_old in content:
    content = content.replace(commerce_session_old, commerce_session_new, 1)
    print("commerceSessionFor atualizado para Admin Global com sucesso!")
else:
    print("AVISO: commerce_session_old não encontrado exatamente")

# Adicionar blocos de Silvester e Guilherme dentro de commerceSessionFor logo após o return de Admin Global
pos_return_admin = content.find("lojaId: loja?.id || null,\n      };\n    }")
if pos_return_admin != -1:
    bloco_inquilinos = """
    // 2. Silvester: APENAS Stallone e Agro Open
    if (isSilvesterUser(user)) {
      const empresasSilvester = [
        { id: '31f70c83-9172-40c2-945f-9e793b5048be', nome: 'Stallone Nutre Sport', cnpj: '56.099.531/0001-38', brandKey: 'stallone', tipoNegocio: 'loja', ativa: true },
        { id: '2e041110-db20-4fd1-8278-12bd3dead008', nome: 'AGRO OPEN TTC', cnpj: '43.084.070/0001-88', brandKey: 'agroopen', tipoNegocio: 'bar', ativa: true }
      ];
      const resLojas = await commerceDb.query(
        `SELECT l.id::text, l.empresa_id::text, l.codigo, l.nome, l.ativa
           FROM lojas l
          WHERE l.ativa = true AND l.empresa_id IN ('31f70c83-9172-40c2-945f-9e793b5048be', '2e041110-db20-4fd1-8278-12bd3dead008')
          ORDER BY l.nome ASC`
      ).catch(() => ({ rows: [] }));
      const lojas = (resLojas.rows || []).map(r => ({ id: r.id, empresaId: r.empresa_id, codigo: r.codigo || '', nome: r.nome || r.id, ativa: r.ativa !== false }));
      const empresaAtivaId = user.empresaId || empresasSilvester[0].id;
      const empresa = empresasSilvester.find(e => e.id === empresaAtivaId) || empresasSilvester[0];
      const loja = lojas.find(l => l.empresaId === empresa?.id) || lojas[0] || null;
      return {
        empresas_acessiveis: empresasSilvester,
        empresa,
        empresaId: empresa?.id || null,
        lojas_acessiveis: lojas,
        loja,
        lojaId: loja?.id || null,
      };
    }

    // 3. Guilherme: APENAS Barbearia Dino
    if (isGuilhermeUser(user)) {
      const empresasDino = [
        { id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', nome: 'Barbearia Dino', cnpj: '50.073.355/0002-60', brandKey: 'dino', tipoNegocio: 'barbearia', ativa: true }
      ];
      const resLojas = await commerceDb.query(
        `SELECT l.id::text, l.empresa_id::text, l.codigo, l.nome, l.ativa
           FROM lojas l
          WHERE l.ativa = true AND l.empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
          ORDER BY l.nome ASC`
      ).catch(() => ({ rows: [] }));
      const lojas = (resLojas.rows || []).map(r => ({ id: r.id, empresaId: r.empresa_id, codigo: r.codigo || '', nome: r.nome || r.id, ativa: r.ativa !== false }));
      const empresa = empresasDino[0];
      const loja = lojas[0] || null;
      return {
        empresas_acessiveis: empresasDino,
        empresa,
        empresaId: empresa?.id || null,
        lojas_acessiveis: lojas,
        loja,
        lojaId: loja?.id || null,
      };
    }"""
    insert_at = pos_return_admin + len("lojaId: loja?.id || null,\n      };\n    }")
    content = content[:insert_at] + bloco_inquilinos + content[insert_at:]
    print("Blocos específicos de Silvester e Guilherme adicionados a commerceSessionFor!")

# 4. Atualizar injeção de empresasRouter
router_old = """  const empresasRouter = createEmpresasAdminRouter({
    db: clubeDb,
    isPlatformAdmin: (user) => isPlatformAdminUser(user) || isMainAdminUser(user),
    obterEmpresaIdDoUsuario: (req) => {
      if (isPlatformAdminUser(req.user) || isMainAdminUser(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : null;
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || null);
    }
  });"""

router_new = """  const empresasRouter = createEmpresasAdminRouter({
    db: clubeDb,
    isPlatformAdmin: (user) => isAdminGlobal(user),
    obterEmpresasAutorizadas: (user) => obterEmpresasAutorizadasDoUsuario(user),
    obterEmpresaIdDoUsuario: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : null;
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || null);
    }
  });"""

if router_old in content:
    content = content.replace(router_old, router_new, 1)
    print("empresasRouter atualizado com obterEmpresasAutorizadas com sucesso!")
else:
    print("AVISO: router_old não encontrado exatamente")

with open('app/server.js', 'w', encoding='utf8') as f:
    f.write(content)
print("app/server.js gravado com sucesso!")
