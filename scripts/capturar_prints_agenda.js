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

  console.log('2. Navegando para https://kytto.com.br/admin/concreto?secao=operacao-programacao...');
  await page.goto('https://kytto.com.br/admin/concreto?secao=operacao-programacao', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4500));

  console.log('3. Capturando Print 32: Tela da Agenda de Concretagem e Gantt Interativo...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/32_concreto_agenda_programacao_interativa.png', fullPage: false });

  console.log('4. Clicando no botão Detalhes & Editar da primeira concretagem (#1001)...');
  const botoes = await page.$$('button');
  for (const b of botoes) {
    const txt = await page.evaluate(el => el.textContent, b);
    if (txt && txt.includes('Detalhes & Editar')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  console.log('5. Capturando Print 33: Modal de Detalhamento e Edição da Concretagem...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/33_concreto_modal_detalhamento_agenda_edicao.png', fullPage: false });

  console.log('6. Clicando na aba Betoneiras & Viagens no modal...');
  const abasModal = await page.$$('.serrano-modal-card button');
  for (const ab of abasModal) {
    const txt = await page.evaluate(el => el.textContent, ab);
    if (txt && txt.includes('Betoneiras & Viagens')) {
      await ab.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  console.log('7. Capturando Print 34: Aba de Escalação de Viagens e Betoneiras...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/34_concreto_modal_viagens_escala_betoneiras.png', fullPage: false });

  await browser.close();
  console.log('Capturas da Agenda concluídas com sucesso!');
}

capturar().catch(console.error);
