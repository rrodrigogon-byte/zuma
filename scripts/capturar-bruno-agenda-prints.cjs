const puppeteer = require('puppeteer');
const path = require('path');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  console.log('--- CAPTURANDO PRINTS REAIS EM PRODUÇÃO: BRUNO NA AGENDA E COMANDA ---');

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

  // 1. Navegar para a Agenda da Barbearia
  console.log('Navegando para a Agenda da Barbearia...');
  await page.goto('https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Agenda', { waitUntil: 'networkidle2' });
  await delay(4000);

  // Clicar no botão 'Filtrar exibição' para abrir o popover
  console.log('Abrindo popover de Filtrar exibição...');
  const clicouFiltro = await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btnFiltro = botoes.find(b => b.innerText.includes('Filtrar exibição') || b.innerText.includes('VISÍVEIS'));
    if (btnFiltro) {
      btnFiltro.click();
      return true;
    }
    return false;
  });
  console.log('Clicou no botão de filtro:', clicouFiltro);
  await delay(1500);

  const print50Path = path.resolve(__dirname, '../docs/prints/50-barbearia-agenda-bruno-mendes-ativo.png');
  await page.screenshot({ path: print50Path, fullPage: false });
  console.log('Print 50 salvo com sucesso:', print50Path);

  // 2. Navegar para a tela de Comandas e abrir o modal de nova comanda
  console.log('Navegando para comandas para capturar print 51...');
  await page.goto('https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Comandas', { waitUntil: 'networkidle2' });
  await delay(4000);

  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btnNova = botoes.find(b => b.innerText.includes('Nova Comanda') || b.innerText.includes('+ Nova') || b.innerText.includes('Abrir Comanda'));
    if (btnNova) btnNova.click();
  });
  await delay(2000);

  // Buscar cliente ou clicar em Cliente Balcão e selecionar aba Pacote
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btnBalcao = botoes.find(b => b.innerText.includes('Cliente Balcão'));
    if (btnBalcao) btnBalcao.click();

    const btnAbaPacote = botoes.find(b => b.innerText.includes('Pacotes') || b.innerText.includes('Pacote'));
    if (btnAbaPacote) btnAbaPacote.click();
  });
  await delay(1500);

  // Clicar no primeiro item de pacote da lista
  await page.evaluate(() => {
    const resultados = Array.from(document.querySelectorAll('.cn-resultado, button[class*="resultado"]'));
    if (resultados.length > 0) {
      resultados[0].click();
    }
  });
  await delay(1500);

  const print51Path = path.resolve(__dirname, '../docs/prints/51-barbearia-comanda-procedimento-bruno-sucesso.png');
  await page.screenshot({ path: print51Path, fullPage: false });
  console.log('Print 51 salvo com sucesso:', print51Path);

  await browser.close();
  console.log('Concluído com sucesso!');
})();
