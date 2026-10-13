import { isStalloneHost, STALLONE_ORIGIN } from './stallone-page-meta.js';

export function stalloneDiscovery(host, pathname) {
  if (!isStalloneHost(host)) return null;
  if (pathname === '/favicon.svg') return { redirect: '/brand/stallone-mark.svg' };
  if (pathname === '/robots.txt') return {
    type: 'text/plain',
    body: `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /checkout/\nDisallow: /pedido/\n\nSitemap: ${STALLONE_ORIGIN}/sitemap.xml\n`,
  };
  if (pathname === '/sitemap.xml') return {
    type: 'application/xml',
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${STALLONE_ORIGIN}/ecommerce/stallone</loc></url></urlset>\n`,
  };
  return null;
}
