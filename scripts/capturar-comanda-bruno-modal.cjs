const puppeteer = require('puppeteer');
const path = require('path');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  console.log('--- CAPTURANDO PRINT 51: MODAL DE COMANDA COM PROCEDIMENTO PACOTE E BRUNO ---');

  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.evaluateOnNewDocument((tk) => {
    localStorage.setItem('token', tk);
    localStorage.setItem('sp_token', tk);
    localStorage.setItem('sp_site_token', tk);
    localStorage.setItem('sp_cookie_consent', 'all');
    localStorage.setItem('sp_user', JSON.stringify({
      username: 'dino',
      user: 'dino',
      nome: 'Guilherme Cunha Martins (Dino)',
      role: 'admin',
      roles: ['admin', 'organizador'],
      empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
    }));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      nome: 'Barbearia Dino'
    }));
  }, token);

  // Navegar para Atendimento
  await page.goto('https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Atendimento', { waitUntil: 'networkidle2' });
  await delay(3500);

  // Clicar em 'Atender agora' ou botão de nova comanda
  console.log('Abrindo comanda...');
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btnAtender = botoes.find(b => b.innerText.includes('Atender agora') || b.innerText.includes('Nova comanda') || b.innerText.includes('+ Criar / Lançar'));
    if (btnAtender) btnAtender.click();
  });
  await delay(2000);

  // Se abriu dropdown de Criar/Lançar, clica em Nova comanda
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button, a'));
    const btnComanda = botoes.find(b => b.innerText.includes('Nova comanda') || b.innerText.includes('Comanda'));
    if (btnComanda) btnComanda.click();
  });
  await delay(2000);

  // Clicar no botão 'Cliente Balcão'
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btnBalcao = botoes.find(b => b.innerText.includes('Cliente Balcão'));
    if (btnBalcao) btnBalcao.click();
  });
  await delay(1000);

  // Digitar 'proce' na busca de itens
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const inputBusca = inputs.find(i => i.placeholder && i.placeholder.includes('Buscar'));
    if (inputBusca) {
      inputBusca.value = 'proce';
      inputBusca.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await delay(1500);

  // Clicar no primeiro resultado
  await page.evaluate(() => {
    const resultados = Array.from(document.querySelectorAll('.cn-resultado, button[class*="resultado"]'));
    if (resultados.length > 0) {
      resultados[0].click();
    }
  });
  await delay(1500);

  // Selecionar o Bruno no select do item
  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    for (const sel of selects) {
      const opcoes = Array.from(sel.options);
      const optBruno = opcoes.find(o => o.text.includes('Bruno'));
      if (optBruno) {
        sel.value = optBruno.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
  await delay(1500);

  const print51Path = path.resolve(__dirname, '../docs/prints/51-barbearia-comanda-procedimento-bruno-sucesso.png');
  await page.screenshot({ path: print51Path, fullPage: false });
  console.log('Print 51 capturado com sucesso:', print51Path);

  await browser.close();
})();
