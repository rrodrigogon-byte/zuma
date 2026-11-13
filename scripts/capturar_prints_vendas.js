import puppeteer from 'puppeteer';

async function capturar() {
  console.log('1. Obtendo token de despacho...');
  const resLogin = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'despacho', senha: '123456' })
  });
  const dataLogin = await resLogin.json();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  await page.goto('https://kytto.com.br/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((sessao) => {
    localStorage.setItem('sp_token', sessao.token);
    localStorage.setItem('sp_user', JSON.stringify(sessao.user));
    localStorage.setItem('token', sessao.token);
    localStorage.setItem('user', JSON.stringify(sessao.user));
    localStorage.setItem('kytto_token', sessao.token);
    localStorage.setItem('kytto_user', JSON.stringify(sessao.user));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2',
      nome: 'Serrano Concreto Usinado & Mineração',
      cnpj: '03.849.201/0001-10',
      brandKey: 'serranoconcreto'
    }));
  }, dataLogin);

  console.log('2. Navegando para https://kytto.com.br/admin/concreto?tab=vendas...');
  await page.goto('https://kytto.com.br/admin/concreto?tab=vendas', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4500));

  console.log('3. Capturando Print 29: Aba Vendas & Faturamento com KPIs e Tabela de Notas...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/29_concreto_vendas_faturamento_nfe.png', fullPage: false });

  console.log('4. Clicando no botão + Emitir Nota Fiscal & Venda...');
  const botoes = await page.$$('button');
  for (const b of botoes) {
    const txt = await page.evaluate(el => el.textContent, b);
    if (txt && txt.includes('+ Emitir Nota Fiscal & Venda')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  console.log('5. Capturando Print 30: Modal de Emissão de Nota Fiscal com Auto-Captura de Balança...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/30_concreto_modal_emitir_nota_balanca.png', fullPage: false });

  console.log('6. Clicando no botão de fechar modal...');
  const btnFechar = await page.$('.serrano-modal-card button');
  if (btnFechar) await btnFechar.click();
  await new Promise(r => setTimeout(r, 1000));

  console.log('7. Clicando no primeiro botão de DANFE na tabela...');
  const btnDanfe = await page.$('button[title="Visualizar DANFE A4 Timbrado"]');
  if (btnDanfe) {
    await btnDanfe.click();
    await new Promise(r => setTimeout(r, 3000));
    console.log('8. Capturando Print 31: Modal do DANFE A4 Timbrado...');
    await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/31_concreto_modal_danfe_a4_oficial.png', fullPage: false });
  }

  await browser.close();
  console.log('Capturas de Vendas concluídas com sucesso!');
}

capturar().catch(console.error);
