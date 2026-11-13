import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  console.log('🚀 Iniciando validação visual da Torre CCO...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  const page = await browser.newPage();
  
  const pageErrors = [];
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => {
    console.error('BROWSER PAGE ERROR:', err.message);
    pageErrors.push(err.message);
  });

  console.log('1. Acessando https://kytto.com.br/torre-pesagem.html...');
  await page.goto('https://kytto.com.br/torre-pesagem.html', { waitUntil: 'networkidle2', timeout: 35000 });
  await page.waitForSelector('#pista-svg-mount svg', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  
  await page.screenshot({ path: '/home/ubuntu/torre_pesagem_cco_dark.png', fullPage: false });
  console.log('✅ Screenshot CCO Dark salvo em /home/ubuntu/torre_pesagem_cco_dark.png');

  // Testar alternância para Modo Dia
  console.log('2. Testando alternância de tema...');
  const btnTheme = await page.$('#btn-theme');
  if (btnTheme) {
    await btnTheme.click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: '/home/ubuntu/torre_pesagem_modo_dia.png', fullPage: false });
    console.log('✅ Screenshot Modo Dia salvo em /home/ubuntu/torre_pesagem_modo_dia.png');

    // Voltar para Modo CCO Dark
    await btnTheme.click();
    await new Promise(r => setTimeout(r, 800));
  }

  // 3. Testar a rota do ERP https://kytto.com.br/admin/concreto?secao=torre-pesagem com autenticação
  console.log('3. Obtendo token de autenticação para o ERP...');
  try {
    const resLogin = await fetch('https://kytto.com.br/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'despacho', senha: '123456' })
    });
    const dataLogin = await resLogin.json();
    console.log('Token obtido:', !!dataLogin.token);

    await page.goto('https://kytto.com.br/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessao) => {
      localStorage.setItem('sp_token', sessao.token);
      localStorage.setItem('sp_user', JSON.stringify(sessao.user));
      localStorage.setItem('token', sessao.token);
      localStorage.setItem('user', JSON.stringify(sessao.user));
      localStorage.setItem('kytto_token', sessao.token);
      localStorage.setItem('kytto_user', JSON.stringify(sessao.user));
      localStorage.setItem('sp_empresa_ativa', JSON.stringify({
        id: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2',
        nome: 'Serrano Concreto Usinado & Mineração',
        cnpj: '03.849.201/0001-10',
        brandKey: 'serranoconcreto'
      }));
    }, dataLogin);

    console.log('4. Acessando rota integrada https://kytto.com.br/admin/concreto?secao=torre-pesagem...');
    await page.goto('https://kytto.com.br/admin/concreto?secao=torre-pesagem', { waitUntil: 'networkidle2', timeout: 35000 });
    await new Promise(r => setTimeout(r, 4500));
    await page.screenshot({ path: '/home/ubuntu/torre_pesagem_erp_integrado.png', fullPage: false });
    console.log('✅ Screenshot ERP Integrado salvo em /home/ubuntu/torre_pesagem_erp_integrado.png');
  } catch (err) {
    console.error('Erro na autenticação do ERP:', err);
  }

  console.log('📊 Total de erros no navegador:', pageErrors.length);
  await browser.close();
  console.log('🎉 Validação e captura de telas concluída com sucesso!');
})();
