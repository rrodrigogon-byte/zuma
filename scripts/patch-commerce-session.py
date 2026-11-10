import re

with open('app/server.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """    const identities = await commerceDb.queryRead(
      `SELECT id FROM usuarios WHERE lower(btrim(email)) = $1 AND ativo = true LIMIT 2`,
      [norm(user.email)],
    );"""

replacement = """    // Administradores globais e gestores autorizados recebem todas as empresas ativas da plataforma
    if (isPlatformAdminUser(user) || isMainAdminUser(user) || user.role === 'admin' || user.role === 'administrador') {
      const resEmpresas = await commerceDb.query(
        `SELECT e.id::text, e.nome, e.razao_social, e.cnpj, e.tipo_negocio, e.ativa,
                COALESCE((SELECT a.brand_key FROM commerce_storefront_aliases a
                  WHERE a.empresa_id = e.id AND a.ativo = true
                  ORDER BY a.criado_em ASC LIMIT 1),
                  CASE 
                    WHEN e.id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' THEN 'dino'
                    WHEN e.id = '31f70c83-9172-40c2-945f-9e793b5048be' THEN 'stallone'
                    ELSE 'default'
                  END
                ) AS brand_key
           FROM empresas e
          WHERE e.ativa = true
          ORDER BY e.nome ASC`
      );
      const resLojas = await commerceDb.query(
        `SELECT l.id::text, l.empresa_id::text, l.codigo, l.nome, l.ativa
           FROM lojas l
           JOIN empresas e ON e.id = l.empresa_id AND e.ativa = true
          WHERE l.ativa = true
          ORDER BY l.nome ASC`
      );
      const empresas = (resEmpresas.rows || []).map(r => ({
        id: r.id,
        nome: r.nome,
        razaoSocial: r.razao_social,
        cnpj: r.cnpj,
        brandKey: r.brand_key || 'default',
        tipoNegocio: r.tipo_negocio || 'outro',
        ativa: r.ativa !== false
      }));
      const lojas = (resLojas.rows || []).map(r => ({
        id: r.id,
        empresaId: r.empresa_id,
        codigo: r.codigo || '',
        nome: r.nome || r.id,
        ativa: r.ativa !== false
      }));
      const empresaAtivaId = user.empresaId || (empresas.find(e => e.id === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6')?.id) || empresas[0]?.id || null;
      const empresa = empresas.find(e => e.id === empresaAtivaId) || empresas[0] || null;
      const loja = lojas.find(l => l.empresaId === empresa?.id) || lojas[0] || null;

      return {
        empresas_acessiveis: empresas,
        empresa,
        empresaId: empresa?.id || null,
        lojas_acessiveis: lojas,
        loja,
        lojaId: loja?.id || null,
      };
    }

    const identities = await commerceDb.queryRead(
      `SELECT id FROM usuarios WHERE lower(btrim(email)) = $1 AND ativo = true LIMIT 2`,
      [norm(user.email)],
    );"""

if target in c:
    c = c.replace(target, replacement, 1)
    with open('app/server.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('commerceSessionFor atualizado com sucesso!')
else:
    print('Target identities não encontrado em server.js')
