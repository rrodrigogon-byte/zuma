import express from 'express';
import puppeteer from 'puppeteer';
import { routerZuma } from '../app/modules/restaurante-zuma.js';

const app = express();
app.use(express.json());
app.use('/api/public/zuma', routerZuma);
app.use('/zuma', express.static('/home/ubuntu/agro-open-live/app/public/zuma'));

const server = app.listen(3335, async () => {
  console.log('Servidor de teste na porta 3335...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

  // 1. Login no iPhone
  await page.goto('http://localhost:3335/zuma/login.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/home/ubuntu/iphone-login.png' });
  console.log('Salvo: /home/ubuntu/iphone-login.png');

  // 2. Pilot atualizado no iPhone (com dropdown e bottom bar)
  await page.goto('http://localhost:3335/zuma/pilot.html#cockpit', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/home/ubuntu/iphone-pilot-updated.png' });
  console.log('Salvo: /home/ubuntu/iphone-pilot-updated.png');

  await browser.close();
  server.close();
  process.exit(0);
});
