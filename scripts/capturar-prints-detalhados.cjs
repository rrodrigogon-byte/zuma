const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DIR_PRINTS = path.join(__dirname, '..', 'docs', 'prints');
if (!fs.existsSync(DIR_PRINTS)) {
  fs.mkdirSync(DIR_PRINTS, { recursive: true });
}

async function capturarPrintsDetalhados() {
  console.log('[Puppeteer] Iniciando captura detalhada em produção...');
  
  // 1. Login como Dino
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const authData = await loginRes.json();
  const usuario = authData.user || authData.usuario;
  const sessao = authData.sessao || {};

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1.5 }
  });

  const page = await browser.newPage();

  await page.evaluateOnNewDocument((token, user, sess) => {
    localStorage.setItem('sp_token', token);
    localStorage.setItem('sp_user', JSON.stringify(user));
    if (sess.empresa) localStorage.setItem('sp_empresa_ativa', JSON.stringify(sess.empresa));
    if (sess.empresas_acessiveis) localStorage.setItem('sp_empresas_acessiveis', JSON.stringify(sess.empresas_acessiveis));
    if (sess.loja) localStorage.setItem('sp_loja_ativa', JSON.stringify(sess.loja));
    if (sess.lojas_acessiveis) localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(sess.lojas_acessiveis));
  }, authData.token, usuario, sessao);

  // 1. AGENDA NO MODO DIÁRIO COM MINI CALENDÁRIO POP-UP
  console.log('[Puppeteer] 1. Acessando Agenda Diária...');
  await page.goto('https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Agenda', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });
  await new Promise((r) => setTimeout(r, 3500));

  // Clica no botão "Diário" no topo para alternar da visualização semanal para a diária com colunas por barbeiro
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const btnDiario = btns.find((b) => b.innerText.trim() === 'Diário' || b.innerText.includes('Diário'));
    if (btnDiario) btnDiario.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Clica no botão ▼ para abrir o mini calendário mensal pop-up
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btnPopup = btns.find((b) => b.innerText.includes('▼') || b.title?.includes('mini calendário') || b.title?.includes('calendário'));
    if (btnPopup) btnPopup.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  const p1 = path.join(DIR_PRINTS, '01-agenda-diaria-mini-calendario-popup.png');
  await page.screenshot({ path: p1, fullPage: false });
  console.log('[Puppeteer] Salvo 01:', p1);

  // 2. METAS E COMISSÕES DA NATY (TAB Metas e comissões)
  console.log('[Puppeteer] 2. Acessando Metas e comissões da Naty...');
  await page.goto('https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+e+comiss%C3%B5es', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });
  await new Promise((r) => setTimeout(r, 3500));

  // Clica no chip da Natani Minanis Dobler
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const chipNaty = btns.find((b) => b.innerText.includes('Natani') || b.innerText.includes('Naty'));
    if (chipNaty) chipNaty.click();
  });
  await new Promise((r) => setTimeout(r, 2500));

  const p2 = path.join(DIR_PRINTS, '03-metas-comissoes-naty-detalhado.png');
  await page.screenshot({ path: p2, fullPage: false });
  console.log('[Puppeteer] Salvo 02:', p2);

  // 3. ADMIN GLOBAL COM MODAL DE ONBOARDING DE NOVAS EMPRESAS
  console.log('[Puppeteer] 3. Acessando Admin Global...');
  const loginAdminRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'admin', senha: '123' })
  });
  const authAdmin = await loginAdminRes.json();
  if (authAdmin.token) {
    const adminPage = await browser.newPage();
    const adminUser = authAdmin.user || authAdmin.usuario;
    const adminSess = authAdmin.sessao || {};
    await adminPage.evaluateOnNewDocument((token, user, sess) => {
      localStorage.setItem('sp_token', token);
      localStorage.setItem('sp_user', JSON.stringify(user));
      if (sess.empresa) localStorage.setItem('sp_empresa_ativa', JSON.stringify(sess.empresa));
      if (sess.empresas_acessiveis) localStorage.setItem('sp_empresas_acessiveis', JSON.stringify(sess.empresas_acessiveis));
      if (sess.loja) localStorage.setItem('sp_loja_ativa', JSON.stringify(sess.loja));
      if (sess.lojas_acessiveis) localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(sess.lojas_acessiveis));
    }, authAdmin.token, adminUser, adminSess);

    await adminPage.goto('https://kytto.com.br/admin/empresas', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });
    await new Promise((r) => setTimeout(r, 3500));

    // Clica em "Nova Empresa"
    await adminPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btnNova = btns.find((b) => b.innerText.includes('Nova Empresa') || b.innerText.includes('Criar'));
      if (btnNova) btnNova.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const p3 = path.join(DIR_PRINTS, '06-admin-global-onboarding-modal.png');
    await adminPage.screenshot({ path: p3, fullPage: false });
    console.log('[Puppeteer] Salvo 03:', p3);
    await adminPage.close();
  }

  await browser.close();
  console.log('[Puppeteer] Finalizado com sucesso!');
}

capturarPrintsDetalhados().catch((err) => {
  console.error('[Puppeteer] Erro:', err);
  process.exit(1);
});
