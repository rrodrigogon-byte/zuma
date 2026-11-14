import puppeteer from 'puppeteer';

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  console.log('1. Capturing Torre Gêmeo Digital com barra Super-Autonomia...');
  await page.goto('http://localhost:3000/torre-pesagem.html?embed=1&tab=torre', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const shot1 = '/home/ubuntu/torre-gemeo-super-autonomia.png';
  await page.screenshot({ path: shot1, fullPage: false });
  console.log('Saved:', shot1);

  console.log('2. Clicando no botão TrackIt Geofence para abrir o modal...');
  // Click on the first button of the Super-Autonomia bar
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('TrackIt Geofence')) {
      await b.click();
      console.log('Clicked TrackIt Geofence button');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  const shot2 = '/home/ubuntu/torre-modal-super-autonomia.png';
  await page.screenshot({ path: shot2, fullPage: false });
  console.log('Saved:', shot2);

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
