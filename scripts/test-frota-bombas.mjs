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

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000/admin/concreto?secao=operacao-frota', { waitUntil: 'networkidle2' });
  await page.evaluate((tok, usr) => {
    localStorage.setItem('sp_token', tok);
    localStorage.setItem('sp_user', JSON.stringify(usr));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({ id: usr.empresaId, nome: 'Serrano Concreto Usinado' }));
  }, token, user);

  await page.goto('http://localhost:3000/admin/concreto?secao=operacao-frota', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Click on the Bombas Lança & Vento NBR 15649 tab button
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Bombas Lança & Vento NBR 15649')) {
      await b.click();
      console.log('Clicked Bombas Lança & Vento NBR 15649 button');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  const shot = '/home/ubuntu/frota-bombas-lanca-nbr15649.png';
  await page.screenshot({ path: shot, fullPage: false });
  console.log('Saved:', shot);

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
