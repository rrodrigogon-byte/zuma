import puppeteer from 'puppeteer';

async function captureAudit() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000/torre-pesagem.html?embed=1&tab=torre', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Open modal
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('TrackIt Geofence')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));

  // Click Auditar Ciclo Geofence em Tempo Real
  const modalButtons = await page.$$('button');
  for (const b of modalButtons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Auditar Ciclo Geofence')) {
      await b.click();
      console.log('Clicked Auditar Ciclo Geofence');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  const shot = '/home/ubuntu/torre-modal-auditado.png';
  await page.screenshot({ path: shot, fullPage: false });
  console.log('Saved:', shot);

  await browser.close();
}

captureAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
