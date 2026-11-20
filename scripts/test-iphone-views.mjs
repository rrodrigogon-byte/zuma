import express from 'express';
import puppeteer from 'puppeteer';
import { routerZuma } from '../app/modules/restaurante-zuma.js';

const app = express();
app.use(express.json());
app.use('/api/public/zuma', routerZuma);
app.use('/zuma', express.static('/home/ubuntu/agro-open-live/app/public/zuma'));

const server = app.listen(3334, async () => {
  console.log('Servidor mobile na porta 3334...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // Emular iPhone 15 Pro (393 x 852, scale 3)
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

  // 1. Storefront iPhone
  await page.goto('http://localhost:3334/zuma/index.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/home/ubuntu/iphone-storefront.png' });
  console.log('Salvo: /home/ubuntu/iphone-storefront.png');

  // 2. Operação 360 iPhone
  await page.goto('http://localhost:3334/zuma/operacao.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/home/ubuntu/iphone-operacao.png' });
  console.log('Salvo: /home/ubuntu/iphone-operacao.png');

  // 3. Zuma Pilot iPhone
  await page.goto('http://localhost:3334/zuma/pilot.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/home/ubuntu/iphone-pilot.png' });
  console.log('Salvo: /home/ubuntu/iphone-pilot.png');

  await browser.close();
  server.close();
  process.exit(0);
});
