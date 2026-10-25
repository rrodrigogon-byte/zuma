import crypto from 'node:crypto';
export function credentialVersion(hash, changedAt) {
  if (typeof hash !== 'string' || !hash) return null;
  const value = changedAt ? `${hash}\0${new Date(changedAt).toISOString()}` : hash;
  return crypto.createHash('sha256').update(value).digest('hex');
}
export function credentialSessionValid(claims, version, changedAt) {
  if (claims?.credentialVersion) return claims.credentialVersion === version;
  return !changedAt || Number(claims?.iat) * 1000 > new Date(changedAt).getTime();
}
