import { CommerceError } from './commerce-error.js';
export function mergePublicPolicies(config = {}, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CommerceError('políticas inválidas', 'PUBLIC_POLICIES_INVALID');
  const policies = { ...config.public?.policies };
  for (const key of ['privacyUrl', 'returnsUrl', 'shippingUrl', 'termsUrl']) {
    if (!Object.hasOwn(input, key)) continue;
    const value = String(input[key] || '').trim();
    if (!value) { policies[key] = null; continue; }
    let url;
    try { url = new URL(value); } catch (_) { throw new CommerceError('informe um link HTTPS válido para as políticas', 'PUBLIC_POLICIES_URL_INVALID'); }
    if (url.protocol !== 'https:' || url.username || url.password || value.length > 600) throw new CommerceError('informe um link HTTPS válido para as políticas', 'PUBLIC_POLICIES_URL_INVALID');
    policies[key] = url.href;
  }
  return { ...config, public: { ...config.public, policies } };
}
