import puppeteer from 'puppeteer';
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'agro-open-dev-secret-troque-em-producao';
const user = {
  id: 'usr-rodrigo-superadmin-01',
  nome: 'Rodrigo Gonçalves',
  email: 'rrodrigogon@gmail.com',
  role: 'admin',
  platformAdmin: true,
  empresaId: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2'
};
const token = jwt.sign(user, secret);

const tabs = [
  'operacao-despacho',
  'torre-pesagem',
  'app-campo-assinatura',
  'operacao-programacao',
  'operacao-frota',
  'producao-central',
  'producao-op',
  'producao-laboratorio',
  'suprimentos-silos',
  'financeiro-usina',
  'vendas-faturamento',
  'comercial-propostas',
  'empresa-holding',
  'cameras-cftv'
];

async function runTests() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.message });
  });
  page.on('requestfailed', req => {
    errors.push({ type: 'requestfailed', url: req.url(), failure: req.failure()?.errorText });
  });

  // Pre-seed localStorage
  await page.goto('http://localhost:3000/torre-pesagem.html', { waitUntil: 'networkidle2' });
  await page.evaluate((tok, usr) => {
    localStorage.setItem('sp_token', tok);
    localStorage.setItem('sp_user', JSON.stringify(usr));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({ id: usr.empresaId, nome: 'Serrano Concreto Usinado' }));
  }, token, user);

  console.log('--- INICIANDO TESTE DE TODAS AS FUNCIONALIDADES ---');
  const results = [];

  for (const tab of tabs) {
    const tabErrors = [];
    const url = `http://localhost:3000/admin/concreto?secao=${tab}`;
    console.log(`Testando aba: ${tab} (${url})...`);

    const errListener = err => tabErrors.push(err.text);
    page.on('pageerror', errListener);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1200));

      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300));
      const hasContent = bodyText.length > 50;

      results.push({
        tab,
        status: tabErrors.length === 0 && hasContent ? 'PASS' : 'WARN',
        contentPreview: bodyText.replace(/\n+/g, ' ').substring(0, 100),
        errors: tabErrors
      });
    } catch (e) {
      results.push({ tab, status: 'FAIL', error: e.message });
    } finally {
      page.off('pageerror', errListener);
    }
  }

  // Also test Standalone Torre de Pesagem
  console.log('Testando Standalone Torre de Pesagem...');
  try {
    await page.goto('http://localhost:3000/torre-pesagem.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
    results.push({
      tab: 'standalone-torre-pesagem.html',
      status: bodyText.includes('TORRE') ? 'PASS' : 'WARN',
      contentPreview: bodyText.replace(/\n+/g, ' ').substring(0, 100)
    });
  } catch (e) {
    results.push({ tab: 'standalone-torre-pesagem.html', status: 'FAIL', error: e.message });
  }

  console.log('\n=== RESULTADOS DETALHADOS ===');
  console.table(results);

  await browser.close();
}

runTests().catch(err => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
