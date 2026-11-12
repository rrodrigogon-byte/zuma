const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  await page.goto('http://localhost:5173/admin/barbearia-erp?area=gestao&tab=Painel+de+gestão', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  console.log("ERRORS:", errors);
  await page.screenshot({ path: '/home/ubuntu/upload/dashboard-debug.png' });
  
  await browser.close();
})();
