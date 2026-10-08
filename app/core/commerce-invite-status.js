// Diagnóstico administrativo: nunca devolve chaves, tokens ou erros brutos do provedor.
export function operationalInviteReadiness(env = process.env, mailActive = false) {
  const coreEnabled = env.COMMERCE_CORE_ENABLED === '1';
  const enabled = env.OPERATIONAL_INVITES_ENABLED === '1';
  const mailConfigured = mailActive === true && Boolean(String(env.EMAIL_FROM || '').trim());
  const code = !coreEnabled || !enabled ? 'INVITES_DISABLED' : !mailConfigured ? 'MAIL_NOT_CONFIGURED' : null;
  return { ready: code === null, coreEnabled, enabled, mailConfigured, code };
}

const ERRORS = Object.freeze({
  OPERATIONAL_EMAIL_RESERVED: [409, 'IDENTITY_ALREADY_EXISTS', 'E-mail já cadastrado ou com convite pendente. Consulte os acessos e convites antes de reenviar.'],
  OPERATIONAL_INVITE_SEND_FAILED: [503, 'INVITE_DELIVERY_UNCERTAIN', 'Envio não confirmado. Confira o provedor antes de enviar outro convite.'],
  MAIL_REJECTED: [503, 'MAIL_REJECTED', 'O provedor recusou o e-mail. Verifique a chave Resend e o remetente verificado em EMAIL_FROM.'],
  MAIL_UNCERTAIN: [503, 'INVITE_DELIVERY_UNCERTAIN', 'O provedor não confirmou o envio. Confira o Resend antes de enviar outro convite.'],
  MAIL_NOT_CONFIGURED: [503, 'MAIL_NOT_CONFIGURED', 'Configure RESEND_API_KEY e EMAIL_FROM com um remetente verificado no Render. Nenhuma conta foi criada.'],
  TENANT_NOT_ACTIVE: [404, 'TENANT_NOT_FOUND', 'Empresa não encontrada ou inativa.'],
  OPERATIONAL_ROLE_NOT_CONFIGURED: [503, 'OPERATIONAL_ROLE_NOT_CONFIGURED', 'O papel operacional não está configurado. Verifique as migrações Commerce.'],
  INVALID_EMAIL: [400, 'INVALID_INVITE', 'Informe um e-mail válido.'],
  INVALID_NAME: [400, 'INVALID_INVITE', 'Informe um nome válido.'],
  INVALID_ID: [400, 'INVALID_INVITE', 'Selecione uma empresa válida.'],
});

export function operationalInviteHttpError(error) {
  const [status, code, message] = ERRORS[error?.code] || [503, 'INVITE_UNAVAILABLE', 'Convite indisponível. Verifique o canal e o histórico antes de tentar novamente.'];
  return { status, body: { error: message, code } };
}

export async function listOperationalInvites(database, empresaId) {
  const result = await database.queryRead(
    `SELECT id, nome, email_norm AS email, status, expira_em AS expires_at,
            enviado_em, usado_em, criado_em
       FROM commerce_operational_invites
      WHERE empresa_id = $1
      ORDER BY criado_em DESC, id DESC LIMIT 100`,
    [empresaId],
  );
  return { items: result.rows };
}
