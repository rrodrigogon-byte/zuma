const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DIR_PRINTS = path.join(__dirname, '..', 'docs', 'prints');
if (!fs.existsSync(DIR_PRINTS)) {
  fs.mkdirSync(DIR_PRINTS, { recursive: true });
}

async function capturarPrints() {
  console.log('[Puppeteer] Iniciando captura de evidências em produção...');
  
  // 1. Obter token e sessão via API para Dino
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const authData = await loginRes.json();
  if (!authData.token) {
    throw new Error('Falha no login da API: ' + JSON.stringify(authData));
  }
  const usuario = authData.user || authData.usuario;
  const sessao = authData.sessao || {};
  console.log('[Puppeteer] Login autenticado com sucesso! Usuário:', usuario?.nome);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1.5 }
  });

  const page = await browser.newPage();

  // Injetar credenciais no localStorage antes de cada navegação
  await page.evaluateOnNewDocument((token, user, sess) => {
    localStorage.setItem('sp_token', token);
    localStorage.setItem('sp_user', JSON.stringify(user));
    if (sess.empresa) localStorage.setItem('sp_empresa_ativa', JSON.stringify(sess.empresa));
    if (sess.empresas_acessiveis) localStorage.setItem('sp_empresas_acessiveis', JSON.stringify(sess.empresas_acessiveis));
    if (sess.loja) localStorage.setItem('sp_loja_ativa', JSON.stringify(sess.loja));
    if (sess.lojas_acessiveis) localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(sess.lojas_acessiveis));
  }, authData.token, usuario, sessao);

  // 1. AGENDA COM MINI CALENDÁRIO POP-UP ABERTO
  console.log('[Puppeteer] 1. Acessando Agenda com Mini Calendário Pop-up...');
  await page.goto('https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Agenda', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });
  await new Promise((r) => setTimeout(r, 4000));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => b.innerText.includes('▼') || b.title?.includes('calendário') || b.title?.includes('Hoje'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  const p1 = path.join(DIR_PRINTS, '01-agenda-mini-calendario-popup.png');
  await page.screenshot({ path: p1, fullPage: false });
  console.log('[Puppeteer] Salvo 01:', p1);

  // 2. LINHA DO TEMPO AO VIVO DA AGENDA
  console.log('[Puppeteer] 2. Capturando visão ao vivo da Agenda...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const fechar = btns.find((b) => b.innerText.includes('Fechar ✕') || b.innerText.includes('Ir para Hoje'));
    if (fechar) fechar.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  const p2 = path.join(DIR_PRINTS, '02-agenda-linha-ao-vivo.png');
  await page.screenshot({ path: p2, fullPage: false });
  console.log('[Puppeteer] Salvo 02:', p2);

  // 3. METAS & COMISSÕES COM BUSCA POR NATY
  console.log('[Puppeteer] 3. Acessando Painel de Metas & Comissões...');
  await page.goto('https://kytto.com.br/admin/barbearia-erp?area=gestao&tab=Metas+%26+Comiss%C3%B5es', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });
  await new Promise((r) => setTimeout(r, 4000));

  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="Pesquisar barbeiro"]');
    if (input) {
      input.value = 'Naty';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const chip = btns.find((b) => b.innerText.includes('Natani') || b.innerText.includes('Naty'));
    if (chip) chip.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  const p3 = path.join(DIR_PRINTS, '03-metas-comissoes-naty.png');
  await page.screenshot({ path: p3, fullPage: false });
  console.log('[Puppeteer] Salvo 03:', p3);

  // 4. FECHAMENTO DIÁRIO COM COMPROVANTE OFICIAL
  console.log('[Puppeteer] 4. Acessando Painel de Fechamento Diário Gestão...');
  await page.goto('https://kytto.com.br/admin/fechamento-diario', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });
  await new Promise((r) => setTimeout(r, 4000));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btnImp = btns.find((b) => b.innerText.includes('Imprimir Fechamento') || b.innerText.includes('Comprovante'));
    if (btnImp) btnImp.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  const p4 = path.join(DIR_PRINTS, '04-fechamento-diario-comprovante.png');
  await page.screenshot({ path: p4, fullPage: false });
  console.log('[Puppeteer] Salvo 04:', p4);

  // 5. ISOLAMENTO MULTI-TENANT (EMPRESAS - DINO)
  console.log('[Puppeteer] 5. Acessando Gestão de Empresas (Inquilino Dino)...');
  await page.goto('https://kytto.com.br/admin/empresas', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });
  await new Promise((r) => setTimeout(r, 4000));

  const p5 = path.join(DIR_PRINTS, '05-empresas-isolamento-tenant-dino.png');
  await page.screenshot({ path: p5, fullPage: false });
  console.log('[Puppeteer] Salvo 05:', p5);

  // 6. ADMIN GLOBAL - GESTÃO MULTIEMPRESA & ONBOARDING
  console.log('[Puppeteer] 6. Acessando como Admin Global (Rodrigo Gonçalves)...');
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
    await new Promise((r) => setTimeout(r, 4000));

    await adminPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btnNova = btns.find((b) => b.innerText.includes('Nova Empresa') || b.innerText.includes('Criar'));
      if (btnNova) btnNova.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const p6 = path.join(DIR_PRINTS, '06-admin-global-onboarding-templates.png');
    await adminPage.screenshot({ path: p6, fullPage: false });
    console.log('[Puppeteer] Salvo 06:', p6);
    await adminPage.close();
  }

  await browser.close();
  console.log('[Puppeteer] 🚀 Todos os prints foram capturados com sucesso!');
}

capturarPrints().catch((err) => {
  console.error('[Puppeteer] Erro:', err);
  process.exit(1);
});
