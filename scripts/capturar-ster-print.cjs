const puppeteer = require('puppeteer');
const path = require('path');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'ster', senha: '123456' })
  });
  const { token, user, role, sessao } = await loginRes.json();
  console.log('Login Ster OK:', user?.nome, '| Role:', role);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1050 });

    await page.evaluateOnNewDocument((tk, usr, sess) => {
      localStorage.setItem('token', tk);
      localStorage.setItem('sp_token', tk);
      localStorage.setItem('sp_site_token', tk);
      localStorage.setItem('sp_cookie_consent', 'all');
      localStorage.setItem('sp_user', JSON.stringify({
        ...usr,
        role: 'operador',
        roles: ['operador'],
        perfil: 'operador',
        empresaId: sess.empresaId,
        lojaId: sess.lojaId
      }));
      localStorage.setItem('sp_empresa_ativa', JSON.stringify({
        id: sess.empresaId,
        nome: 'Barbearia Dino'
      }));
      localStorage.setItem('sp_empresas_acessiveis', JSON.stringify(sess.empresas_acessiveis || [{
        id: sess.empresaId,
        nome: 'Barbearia Dino'
      }]));
    }, token, user, sessao);

    await page.goto('https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Agenda', { waitUntil: 'networkidle2' });
    await delay(3500);

    await page.screenshot({
      path: path.join(__dirname, '../docs/prints/44-operador-atendente-ster-sessao-dino.png'),
      fullPage: false
    });
    console.log('Print 44 da Agenda da Ster capturado com sucesso!');
  } finally {
    await browser.close();
  }
})();
