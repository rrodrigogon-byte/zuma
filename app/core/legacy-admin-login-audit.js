const INSERT_LOGIN_AUDIT = `
  INSERT INTO commerce_audit_logs
    (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
  VALUES ($1, $2, NULL, 'legacy_admin_login', NULL, 'success', $3::jsonb)
`;

export async function registrarAuditoriaLoginLegado(database, {
  empresaId,
  lojaId = null,
  legacyUserId,
  role,
} = {}) {
  if (!empresaId) return { recorded: false, reason: 'missing_company' };
  if (!database || typeof database.query !== 'function') {
    throw new TypeError('Adaptador PostgreSQL indisponível para auditoria de login.');
  }

  const metadata = {
    legacyUserId: String(legacyUserId ?? ''),
    role: String(role ?? ''),
    source: 'legacy_admin_login',
  };
  const result = await database.query(INSERT_LOGIN_AUDIT, [
    empresaId,
    lojaId || null,
    JSON.stringify(metadata),
  ]);
  return { recorded: Number(result?.rowCount ?? 1) > 0, reason: null };
}
