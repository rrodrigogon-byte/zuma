import crypto from 'node:crypto';
export function credentialVersion(hash) {
  return typeof hash === 'string' && hash ? crypto.createHash('sha256').update(hash).digest('hex') : null;
}
export function credentialSessionValid(claims, version, changedAt) {
  if (claims?.credentialVersion) return claims.credentialVersion === version;
  return !changedAt || Number(claims?.iat) * 1000 > new Date(changedAt).getTime();
}
