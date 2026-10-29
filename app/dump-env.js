import { legacyEmpresaIdFromCommerce } from './core/legacy-commerce-scope.js';
function legacyEmpresaId(req) {
  const requested = String(req.headers['x-empresa-id'] || '').trim();
  const signed = String(req.user?.empresaId || '').trim();
  if (req.barbeariaContext?.empresaId) return legacyEmpresaIdFromCommerce(req.barbeariaContext.empresaId);
  if (signed) return legacyEmpresaIdFromCommerce(signed);
  if (requested) return legacyEmpresaIdFromCommerce(requested); // bypassed auth check for testing
  return 'principal';
}
export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      const e = legacyEmpresaId(req);
      res.json({ ok: true, e });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
