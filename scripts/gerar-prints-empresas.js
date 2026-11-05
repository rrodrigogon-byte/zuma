import puppeteer from 'puppeteer';
import fs from 'node:fs';

const OUT_DIR = '/home/ubuntu/agro-open/docs/prints-empresas';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function main() {
  console.log('Iniciando Puppeteer para captura de telas de Empresas & IA...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // 1. Simular login e token no localStorage
  await page.goto('http://localhost:3001/admin/login', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('sp_token', 'demo-token-kytto-admin');
    localStorage.setItem('sp_user', JSON.stringify({
      id: 'usr-admin-principal',
      nome: 'Administrador Kytto',
      email: 'admin@kytto.com.br',
      role: 'admin',
      platformAdmin: true,
      isAdmin: true,
    }));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      nome: 'Barbearia Dino',
      nomeFantasia: 'Barbearia Dino',
      cnpj: '50.073.355/0002-60',
      tipoNegocio: 'barbearia',
    }));
  });

  // 2. Navegar para a tela de Empresas
  console.log('Navegando para /admin/empresas...');
  await page.goto('http://localhost:3001/admin/empresas', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: `${OUT_DIR}/01_gestao_empresas_visao_geral.png`, fullPage: false });
  console.log('Salvo: 01_gestao_empresas_visao_geral.png');

  // 3. Abrir modal + Nova Empresa
  console.log('Abrindo modal + Nova Empresa com IA...');
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btn = botoes.find(b => b.textContent.includes('Nova Empresa'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${OUT_DIR}/02_modal_nova_empresa.png`, fullPage: false });
  console.log('Salvo: 02_modal_nova_empresa.png');

  // Fechar modal
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btn = botoes.find(b => b.textContent.includes('Cancelar'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 4. Clicar em "Diagnóstico IA" no card
  console.log('Abrindo modal Diagnóstico IA...');
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btn = botoes.find(b => b.textContent.includes('Diagnóstico IA'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT_DIR}/03_diagnostico_ia_empresa.png`, fullPage: false });
  console.log('Salvo: 03_diagnostico_ia_empresa.png');

  // Fechar diagnóstico
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btn = botoes.find(b => b.textContent.includes('Fechar'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 5. Clicar em "Copilot Holding"
  console.log('Abrindo Copilot Holding...');
  await page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btn = botoes.find(b => b.textContent.includes('Copilot Holding'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${OUT_DIR}/04_copilot_holding_ia.png`, fullPage: false });
  console.log('Salvo: 04_copilot_holding_ia.png');

  await browser.close();
  console.log('Todas as capturas geradas com sucesso!');
}

main().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
