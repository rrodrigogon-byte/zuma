const BASE = 'https://stallone.kytto.com.br';
export function stallonePageMeta(host, pathname) {
  const dedicated = /^(www\.)?stallone\.kytto\.com\.br$/i.test(String(host || '').replace(/\.$/, ''));
  const store = pathname === '/ecommerce/stallone' || pathname === '/ecommerce/stallone/' || dedicated && ['/', '/index.html'].includes(pathname);
  if (!store && !(dedicated && (pathname === '/login' || /^\/(admin|checkout|pedido)(\/|$)/.test(pathname)))) return null;
  return {
    titulo: store ? 'Stallone Nutre Sport | Loja online' : 'Stallone Nutre Sport | Acesso seguro',
    descricao: 'Suplementos, nutrição esportiva e alimentação saudável. Conheça a Stallone Nutre Sport em Tangará da Serra.',
    imagem: `${BASE}/brand/stallone-icon-512.png`,
    url: store ? `${BASE}/ecommerce/stallone` : '',
    indexar: store,
  };
}
