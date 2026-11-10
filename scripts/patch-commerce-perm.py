with open('app/core/commerce-routes.js', 'r', encoding='utf-8') as f:
    c = f.read()

antigo = '''  if (
    req.user?.platformAdmin === true ||
    req.user?.role === 'admin' ||
    req.user?.role === 'administrador' ||
    req.user?.role === 'organizador' ||
    req.user?.role === 'gerente' ||
    req.user?.mainAdmin === true ||
    isLegacyGlobalAdmin(req.user)
  ) {
    const context = await adminContext(req);
    context.corporateAccess = true;
    context.capabilities = context.capabilities instanceof Set ? context.capabilities : new Set(context.capabilities || []);
    context.capabilities.add(permission);
    return context;
  }'''

novo = '''  const isOperador = req.user?.role === 'operador' || req.user?.perfil === 'operador';
  const urlPath = String(req.originalUrl || req.url || '').split('?')[0];
  const isWhatsappSessionRoute = urlPath.startsWith('/api/admin/commerce/whatsapp-ai');

  if (
    req.user?.platformAdmin === true ||
    req.user?.role === 'admin' ||
    req.user?.role === 'administrador' ||
    req.user?.role === 'organizador' ||
    req.user?.role === 'gerente' ||
    req.user?.mainAdmin === true ||
    isLegacyGlobalAdmin(req.user) ||
    (isOperador && isWhatsappSessionRoute)
  ) {
    const context = await adminContext(req);
    context.corporateAccess = true;
    context.capabilities = context.capabilities instanceof Set ? context.capabilities : new Set(context.capabilities || []);
    context.capabilities.add(permission);
    return context;
  }'''

if antigo in c:
    c = c.replace(antigo, novo)
    print('requirePermission atualizado com sucesso!')
else:
    print('Aviso: antigo não encontrado')

with open('app/core/commerce-routes.js', 'w', encoding='utf-8') as f:
    f.write(c)
