import puppeteer from 'puppeteer';
import path from 'path';

const OUTPUT_DIR = '/home/ubuntu/agro-open/docs/prints-barbeiro';
const BASE_URL = 'https://setpoint-tm5n.onrender.com';

async function capturar() {
  console.log('Iniciando Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 412,
    height: 890,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  console.log('1. Acessando tela de login do Barbeiro Dino...');
  await page.goto(`${BASE_URL}/barbeiro/dino`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 10000 });

  // Print 1: Tela de Login inicial
  console.log('Capturando Print 1: Tela de Login...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_login_app_barbeiro.png'), fullPage: false });

  // Toca no botão 'Bruno' para demonstrar o preenchimento automático
  console.log('Tocando no atalho do barbeiro Bruno...');
  const botoes = await page.$$('button');
  for (const b of botoes) {
    const texto = await page.evaluate(el => el.textContent, b);
    if (texto && texto.includes('Bruno')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 600));

  // Print 1B: Tela de Login com Bruno selecionado e senha 123456
  console.log('Capturando Print 1B: Tela de Login com Bruno selecionado...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01b_login_preenchido.png'), fullPage: false });

  // Clica em Entrar no App
  console.log('Clicando em Entrar no App...');
  const botaoEntrar = await page.$('button[type="submit"]');
  if (botaoEntrar) {
    await botaoEntrar.click();
  }

  // Aguarda autenticar e carregar a tela da agenda (header Olá, Bruno)
  console.log('Aguardando carregamento da agenda...');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Olá, Bruno') || document.body.innerText.includes('Agenda');
  }, { timeout: 20000 });

  await new Promise(r => setTimeout(r, 2000));

  // Print 2: Aba Agenda do Barbeiro
  console.log('Capturando Print 2: Agenda do Barbeiro...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_agenda_do_barbeiro.png'), fullPage: false });

  // Clica na aba Ganhos
  console.log('Navegando para a aba Ganhos...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav[aria-label="Abas do app"] button, button'));
    const btnGanhos = btns.find(b => b.textContent.includes('Ganhos'));
    if (btnGanhos) btnGanhos.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Print 3: Aba Ganhos e Comissões
  console.log('Capturando Print 3: Ganhos e Comissões...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03_ganhos_comissoes.png'), fullPage: false });

  // Clica na aba Metas
  console.log('Navegando para a aba Metas...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav[aria-label="Abas do app"] button, button'));
    const btnMetas = btns.find(b => b.textContent.includes('Metas'));
    if (btnMetas) btnMetas.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Print 4: Aba Metas & Gamificação
  console.log('Capturando Print 4: Metas e Bonificações...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04_metas_bonificacoes.png'), fullPage: false });

  // Clica na aba Meu Link
  console.log('Navegando para a aba Meu Link...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav[aria-label="Abas do app"] button, button'));
    const btnLink = btns.find(b => b.textContent.includes('Meu Link'));
    if (btnLink) btnLink.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Print 5: Aba Meu Link de Agendamento
  console.log('Capturando Print 5: Meu Link de Agendamento Online...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05_meu_link_agendamento.png'), fullPage: false });

  console.log('Todas as telas capturadas com sucesso!');
  await browser.close();
}

capturar().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
