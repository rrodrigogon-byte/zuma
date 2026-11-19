import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import { routerZuma } from '../app/modules/restaurante-zuma.js';

const app = express();
app.use(express.json());
app.use('/api/public/zuma', routerZuma);
app.use('/zuma', express.static('/home/ubuntu/agro-open-live/app/public/zuma'));

const server = app.listen(3333, async () => {
  console.log('Servidor de teste rodando na porta 3333...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const modules = [
    { name: 'trafego', url: 'http://localhost:3333/zuma/pilot.html#trafego', out: '/home/ubuntu/zuma-pilot-trafego.png' },
    { name: 'indicacao', url: 'http://localhost:3333/zuma/pilot.html#indicacao', out: '/home/ubuntu/zuma-pilot-indicacao.png' },
    { name: 'b2b', url: 'http://localhost:3333/zuma/pilot.html#b2b', out: '/home/ubuntu/zuma-pilot-b2b.png' },
    { name: 'recuperacao', url: 'http://localhost:3333/zuma/pilot.html#recuperacao', out: '/home/ubuntu/zuma-pilot-recuperacao.png' }
  ];

  for (const m of modules) {
    console.log(`Capturando ${m.name}...`);
    await page.goto(m.url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: m.out, fullPage: false });
    console.log(`Salvo: ${m.out}`);
  }

  // Capturar também a aba indique-ganhe do index.html
  console.log('Capturando index.html aba indique-ganhe...');
  await page.goto('http://localhost:3333/zuma/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('indique-ganhe');
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/home/ubuntu/zuma-store-indique-ganhe.png', fullPage: false });
  console.log('Salvo: /home/ubuntu/zuma-store-indique-ganhe.png');

  await browser.close();
  server.close();
  console.log('Capturas concluídas com sucesso!');
  process.exit(0);
});
