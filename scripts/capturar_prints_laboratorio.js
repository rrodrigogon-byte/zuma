import puppeteer from 'puppeteer';

async function capturarPrintsLaboratorio() {
  console.log('Iniciando captura de telas detalhadas do Laboratório Tecnológico em PRD...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  // 1. Obter token de autenticação via API
  console.log('Autenticando via API...');
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'despacho', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const serranoEmpresa = {
    id: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2',
    nome: 'Serrano Concreto Usinado',
    razaoSocial: 'SERRANO CONCRETO USINADO & MINERAÇÃO LTDA',
    cnpj: '53.798.485/0001-77',
    brandKey: 'concreto',
    tipoNegocio: 'concreto',
    grupoId: 'grp-serrano-palatare-03',
    grupoNome: 'Grupo Palatare',
    ativa: true
  };

  // 2. Injetar credenciais no localStorage
  await page.goto('https://kytto.com.br/login', { waitUntil: 'networkidle2' });
  await page.evaluate((tok, usr, emp) => {
    localStorage.setItem('sp_token', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('sp_user', JSON.stringify(usr));
    localStorage.setItem('empresa_ativa', JSON.stringify(emp));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify(emp));
    localStorage.setItem('empresaAtivaId', emp.id);
  }, token, loginData.user || loginData.usuario, serranoEmpresa);

  // 3. Acessar a tela de Laboratório
  console.log('Navegando para /admin/concreto?secao=producao-laboratorio...');
  await page.goto('https://kytto.com.br/admin/concreto?secao=producao-laboratorio', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Fechar banner de cookies
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btnCookie = btns.find(b => b.textContent && b.textContent.includes('Aceitar todos'));
    if (btnCookie) btnCookie.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // 4. Capturar Topo + Shewhart & CUSUM
  console.log('Capturando Shewhart & CUSUM...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/35_concreto_laboratorio_shewhart_cusum.png' });

  // 4b. Scroll down para pegar cartas de controle completas
  await page.evaluate(() => window.scrollBy(0, 320));
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/35b_concreto_laboratorio_cartas_shewhart_cusum_detalhe.png' });

  // 5. Clicar na sub-aba Traços Sustentáveis (Meta BOxCrete)
  console.log('Clicando na sub-aba Traços Sustentáveis...');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const btns = Array.from(document.querySelectorAll('button'));
    const btnSust = btns.find(b => b.textContent && b.textContent.includes('Traços Sustentáveis'));
    if (btnSust) btnSust.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/36_concreto_laboratorio_tracos_sustentaveis_esg.png' });

  // 6. Clicar na sub-aba Maturidade In-Situ ASTM C1074
  console.log('Clicando na sub-aba Maturidade ASTM C1074...');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const btns = Array.from(document.querySelectorAll('button'));
    const btnMat = btns.find(b => b.textContent && b.textContent.includes('Maturidade In-Situ'));
    if (btnMat) btnMat.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/37_concreto_laboratorio_maturidade_astm_c1074.png' });

  // 7. Clicar no botão para abrir o Modal de Laudo Oficial NBR 12655
  console.log('Abrindo Modal de Laudo Oficial NBR 12655...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btnLaudo = btns.find(b => b.textContent && b.textContent.includes('Laudo ABNT NBR 12655'));
    if (btnLaudo) btnLaudo.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/38_concreto_laboratorio_modal_laudo_a4.png' });

  await browser.close();
  console.log('Todas as capturas atualizadas e salvas com sucesso!');
}

capturarPrintsLaboratorio().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
