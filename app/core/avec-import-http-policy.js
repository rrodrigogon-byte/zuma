export function avecGovernanceNoStore(req, res, next) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  if (path === '/api/admin/commerce/catalog/avec/governance/preview') res.set('Cache-Control', 'no-store');
  next();
}
