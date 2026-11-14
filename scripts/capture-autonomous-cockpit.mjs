import puppeteer from 'puppeteer';
import path from 'path';

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  console.log('Capturing Torre de Pesagem Cockpit (tab=pesagem)...');
  await page.goto('http://localhost:3000/torre-pesagem.html?embed=1&tab=pesagem', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const shot1 = '/tmp/repo/torre-pesagem-autonoma.png';
  await page.screenshot({ path: shot1, fullPage: false });
  console.log('Saved:', shot1);

  console.log('Capturing Torre de Pesagem Cockpit (tab=torre)...');
  await page.goto('http://localhost:3000/torre-pesagem.html?embed=1&tab=torre', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const shot2 = '/tmp/repo/torre-pesagem-gemeo-digital.png';
  await page.screenshot({ path: shot2, fullPage: false });
  console.log('Saved:', shot2);

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
