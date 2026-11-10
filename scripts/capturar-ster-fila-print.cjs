const puppeteer = require('puppeteer');
const path = require('path');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('--- CAPTURANDO PRINT 49: FILA DO WHATSAPP DA STER COM sp_ KEYS ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  // 1. Obter token da Ster
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'ster', senha: '123456' })
  });
  const data = await loginRes.json();
  const token = data.token;
  const user = data.user;

  console.log('Login Ster OK! Token obtido:', Boolean(token));

  // Injetar autenticação antes de qualquer navegação
  await page.evaluateOnNewDocument((authData) => {
    const tk = authData.token;
    localStorage.setItem('token', tk);
    localStorage.setItem('sp_token', tk);
    localStorage.setItem('sp_site_token', tk);
    localStorage.setItem('sp_cookie_consent', 'all');
    localStorage.setItem('sp_user', JSON.stringify({
      username: 'ster',
      user: 'ster',
      id: 'usr-dino-ester',
      nome: 'Steffany Marielly de Oliveira (Ster)',
      email: 'ster@barbeariadino.com.br',
      role: 'operador',
      roles: ['operador'],
      empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8'
    }));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      nome: 'Dino Barbearia'
    }));
    localStorage.setItem('sp_loja_ativa', JSON.stringify({
      id: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8',
      nome: 'Matriz Tangará da Serra'
    }));
    localStorage.setItem('sp_empresas_acessiveis', JSON.stringify([{
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      nome: 'Dino Barbearia'
    }]));
    localStorage.setItem('sp_lojas_acessiveis', JSON.stringify([{
      id: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8',
      nome: 'Matriz Tangará da Serra'
    }]));
  }, { token, user });

  // Navegar para a Fila do WhatsApp (/admin/whatsapp-fila)
  console.log('Navegando para https://kytto.com.br/admin/whatsapp-fila...');
  await page.goto('https://kytto.com.br/admin/whatsapp-fila', { waitUntil: 'networkidle2', timeout: 35000 });
  await delay(4500);

  const printPath = path.join(__dirname, '../docs/prints/49-operador-ster-fila-whatsapp-atendimento.png');
  await page.screenshot({ path: printPath, fullPage: false });
  console.log('✓ Print 49 salvo com sucesso em:', printPath);

  await browser.close();
})();
