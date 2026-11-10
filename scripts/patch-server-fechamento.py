#!/usr/bin/env python3

with open('app/server.js', 'r', encoding='utf8') as f:
    code = f.read()

old_block = """app.get('/api/admin/fechamento-diario/empresas', auth, requireStaff, (req, res) => {
  try {
    res.json({ ok: true, empresas: listarEmpresasParaFechamento() });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get(['/api/admin/fechamento-diario', '/api/admin/fechamento-diario/conciliacao', '/api/admin/barbearia/operacao/fechamento-conciliacao'], auth, requireStaff, (req, res) => {
  try {
    const empresaSolicitada = String(req.query?.empresaId || req.headers['x-empresa-id'] || '').trim();
    const empresaId = empresaSolicitada || legacyEmpresaId(req);
    const lojaId = req.query?.lojaId || legacyLojaId(req);
    const resultado = obterFechamentoDiarioEConciliacao(empresaId, req.query?.data, { lojaId });
    res.json({
      ok: true,
      ...resultado,
      fechamentos: resultado.historicoFechamentos,
    });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post(['/api/admin/fechamento-diario', '/api/admin/fechamento-diario/executar', '/api/admin/barbearia/operacao/fechamento-integrado'], auth, requireStaff, async (req, res) => {
  try {
    if (req.body?.confirmado !== true) return res.status(400).json({ error: 'A confirmação explícita do fechamento diário é obrigatória.' });
    const empresaSolicitada = String(req.body?.empresaId || req.headers['x-empresa-id'] || '').trim();
    const empresaId = empresaSolicitada || legacyEmpresaId(req);"""

new_block = """app.get('/api/admin/fechamento-diario/empresas', auth, requireStaff, (req, res) => {
  try {
    const empresasTodas = listarEmpresasParaFechamento();
    if (isAdminGlobal(req.user)) {
      return res.json({ ok: true, empresas: empresasTodas });
    }
    const autorizadas = obterEmpresasAutorizadasDoUsuario(req.user).map(id => String(id).toLowerCase().trim());
    const filtradas = empresasTodas.filter(e => autorizadas.includes(String(e.id).toLowerCase().trim()));
    res.json({ ok: true, empresas: filtradas });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get(['/api/admin/fechamento-diario', '/api/admin/fechamento-diario/conciliacao', '/api/admin/barbearia/operacao/fechamento-conciliacao'], auth, requireStaff, (req, res) => {
  try {
    const empresaSolicitada = String(req.query?.empresaId || req.headers['x-empresa-id'] || '').trim();
    const empresaId = empresaSolicitada || legacyEmpresaId(req);
    if (!isAdminGlobal(req.user)) {
      const autorizadas = obterEmpresasAutorizadasDoUsuario(req.user).map(id => String(id).toLowerCase().trim());
      if (empresaId && !autorizadas.includes(String(empresaId).toLowerCase().trim())) {
        return res.status(403).json({ error: 'Acesso negado: você não tem permissão para visualizar o fechamento diário desta empresa.', code: 'ACCESS_DENIED' });
      }
    }
    const lojaId = req.query?.lojaId || legacyLojaId(req);
    const resultado = obterFechamentoDiarioEConciliacao(empresaId, req.query?.data, { lojaId });
    if (!isAdminGlobal(req.user) && Array.isArray(resultado.empresas)) {
      const autorizadas = obterEmpresasAutorizadasDoUsuario(req.user).map(id => String(id).toLowerCase().trim());
      resultado.empresas = resultado.empresas.filter(e => autorizadas.includes(String(e.id).toLowerCase().trim()));
    }
    res.json({
      ok: true,
      ...resultado,
      fechamentos: resultado.historicoFechamentos,
    });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post(['/api/admin/fechamento-diario', '/api/admin/fechamento-diario/executar', '/api/admin/barbearia/operacao/fechamento-integrado'], auth, requireStaff, async (req, res) => {
  try {
    if (req.body?.confirmado !== true) return res.status(400).json({ error: 'A confirmação explícita do fechamento diário é obrigatória.' });
    const empresaSolicitada = String(req.body?.empresaId || req.headers['x-empresa-id'] || '').trim();
    const empresaId = empresaSolicitada || legacyEmpresaId(req);
    if (!isAdminGlobal(req.user)) {
      const autorizadas = obterEmpresasAutorizadasDoUsuario(req.user).map(id => String(id).toLowerCase().trim());
      if (empresaId && !autorizadas.includes(String(empresaId).toLowerCase().trim())) {
        return res.status(403).json({ error: 'Acesso negado: você não tem permissão para alterar o fechamento desta empresa.', code: 'ACCESS_DENIED' });
      }
    }"""

if old_block in code:
    code = code.replace(old_block, new_block, 1)
    with open('app/server.js', 'w', encoding='utf8') as f:
        f.write(code)
    print("app/server.js blindado no fechamento diario!")
else:
    print("ERRO: old_block nao encontrado")
