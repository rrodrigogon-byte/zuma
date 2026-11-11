with open('app/server.js', 'r', encoding='utf-8') as f:
    srv = f.read()

imp = "import { createOficinaAdminRouter } from './routes/oficina-routes.js';"
add_imp = imp + "\nimport { createAgroRouter, createAgropecuariaRouter, createCteMdfeRouter, createImplantacaoRouter } from './routes/pilares-nota-100-routes.js';"
if 'pilares-nota-100-routes.js' not in srv and imp in srv:
    srv = srv.replace(imp, add_imp, 1)

old_set = "'varejo-multicanal', 'oficina'"
new_set = "'varejo-multicanal', 'oficina', 'agro', 'agropecuaria', 'cte-mdfe', 'implantacao'"
if "'cte-mdfe'" not in srv and old_set in srv:
    srv = srv.replace(old_set, new_set, 1)

mount_target = "  app.use('/api/v1/oficina', auth, requireStaff, createOficinaAdminRouter());"
mount_add = mount_target + """
  const resolverEmpresaPilares = (req) => {
    if (isAdminGlobal(req.user)) {
      return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
    }
    return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
  };
  const agroRouter = createAgroRouter({ obterEmpresaId: resolverEmpresaPilares });
  app.use('/api/agro', auth, requireStaff, agroRouter);
  app.use('/api/admin/agro', auth, requireStaff, agroRouter);

  const agropecuariaRouter = createAgropecuariaRouter({ obterEmpresaId: resolverEmpresaPilares });
  app.use('/api/v1/agropecuaria', auth, requireStaff, agropecuariaRouter);
  app.use('/api/admin/agropecuaria', auth, requireStaff, agropecuariaRouter);

  const cteMdfeRouter = createCteMdfeRouter({ obterEmpresaId: resolverEmpresaPilares });
  app.use('/api/cte-mdfe', auth, requireStaff, cteMdfeRouter);
  app.use('/api/admin/cte-mdfe', auth, requireStaff, cteMdfeRouter);

  const implantacaoRouter = createImplantacaoRouter({ db: clubeDb, obterEmpresaId: resolverEmpresaPilares });
  app.use('/api/admin/implantacao', auth, requireStaff, implantacaoRouter);"""

if '/api/admin/cte-mdfe' not in srv and mount_target in srv:
    srv = srv.replace(mount_target, mount_add, 1)

with open('app/server.js', 'w', encoding='utf-8') as f:
    f.write(srv)
print('app/server.js atualizado com Agro, Agropecuaria, CTe/MDFe e Implantacao!')

with open('web/src/pages/admin/fiscal/Fiscal.jsx', 'r', encoding='utf-8') as f:
    fis = f.read()

if 'CteMdfeTab' not in fis:
    fis = fis.replace("import ReformaTributariaTab from './ReformaTributariaTab'", "import ReformaTributariaTab from './ReformaTributariaTab'\nimport CteMdfeTab from './CteMdfeTab'")
    fis = fis.replace("  ['reforma_tributaria', 'Reforma Tributária (IBS/CBS)']", "  ['reforma_tributaria', 'Reforma Tributária (IBS/CBS)'],\n  ['cte_mdfe', 'CT-e (57) & MDF-e (58)']")
    fis = fis.replace("{aba === 'reforma_tributaria' && <ReformaTributariaTab toast={toast} />}", "{aba === 'reforma_tributaria' && <ReformaTributariaTab toast={toast} />}\n    {aba === 'cte_mdfe' && <CteMdfeTab toast={toast} />}")
    with open('web/src/pages/admin/fiscal/Fiscal.jsx', 'w', encoding='utf-8') as f:
        f.write(fis)
    print('Fiscal.jsx atualizado com aba CteMdfeTab!')
