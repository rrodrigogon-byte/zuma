import puppeteer from 'puppeteer';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { criarRotasConcreto } from '../app/modules/concreto/rotas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
app.use(express.json());

const MOCK_USER = {
  id: 'user-serrano-cco',
  username: 'serrano',
  email: 'cco@serranoconcreto.com.br',
  nome: 'Operador CCO Serrano',
  cargo: 'admin',
  platformAdmin: true,
  empresaId: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2'
};

const MOCK_EMPRESA = {
  id: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2',
  nome: 'Serrano Concreto Usinado',
  razaoSocial: 'SERRANO CONCRETO E ARTEFATOS DE CIMENTO LTDA',
  cnpj: '51.499.928/0001-01',
  brandKey: 'serranoconcreto',
  tipoNegocio: 'concreto'
};

const MOCK_LOJA = {
  id: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da0',
  nome: 'Usina Matriz Distrito Industrial',
  empresaId: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2'
};

app.use((req, res, next) => {
  req.user = MOCK_USER;
  next();
});

app.post('/api/admin/login', (req, res) => {
  res.json({ ok: true, token: 'test-valid-jwt-cco-2026', user: MOCK_USER });
});

app.get('/api/admin/commerce-session', (req, res) => {
  res.json({ lojas_acessiveis: [MOCK_LOJA], empresas_acessiveis: [MOCK_EMPRESA] });
});

app.get('/api/admin/minhas-permissoes', (req, res) => {
  res.json({ aplicavel: false, permissoes: [] });
});

app.get('/api/me', (req, res) => res.json({ ok: true, user: MOCK_USER }));
app.get('/api/auth/me', (req, res) => res.json({ ok: true, user: MOCK_USER }));
app.get('/api/empresas/ativas', (req, res) => res.json({ ok: true, empresas: [MOCK_EMPRESA] }));

app.use('/api/admin/concreto', criarRotasConcreto());
app.use(express.static(path.join(rootDir, 'app/public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'app/public/index.html'));
});

const PORT = 4599;
const server = app.listen(PORT, async () => {
  console.log(`[BALANCA CAPTURE 11] Servidor rodando na porta ${PORT}`);

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 2400 });

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((user, emp, loja) => {
      localStorage.setItem('sp_token', 'test-valid-jwt-cco-2026');
      localStorage.setItem('sp_user', JSON.stringify(user));
      localStorage.setItem('sp_empresa_ativa', JSON.stringify(emp));
      localStorage.setItem('sp_empresas_acessiveis', JSON.stringify([emp]));
      localStorage.setItem('sp_loja_ativa', JSON.stringify(loja));
      localStorage.setItem('sp_lojas_acessiveis', JSON.stringify([loja]));
      localStorage.setItem('empresa_ativa_id', emp.id);
      localStorage.setItem('token', 'test-valid-jwt-cco-2026');
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('sp_cookie_consent', 'all');
      localStorage.setItem('lgpd_cookie_consent', 'accepted');
    }, MOCK_USER, MOCK_EMPRESA, MOCK_LOJA);

    console.log('Navegando para Balança Rodoviária Torre...');
    await page.goto(`http://localhost:${PORT}/admin/concreto?secao=torre-pesagem`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Clicar na aba "Pesagem LIVE"
    console.log('Clicando na aba Pesagem LIVE...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const pesagemBtn = btns.find(b => b.textContent.includes('Pesagem'));
      if (pesagemBtn) pesagemBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Dentro do iframe da Torre Serrano, clicar em "Todos os 11 Canais"
    const iframeHandle = await page.$('iframe');
    if (iframeHandle) {
      const frame = await iframeHandle.contentFrame();
      if (frame) {
        console.log('Clicando no botão Todos os 11 Canais dentro do frame...');
        await frame.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn11 = btns.find(b => b.textContent.includes('Todos os 11 Canais'));
          if (btn11) btn11.click();
        });
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    await page.screenshot({
      path: '/home/ubuntu/balanca_80t_cockpit_11_canais_grid.png',
      fullPage: false
    });
    console.log('Screenshot salvo com sucesso em /home/ubuntu/balanca_80t_cockpit_11_canais_grid.png');

    await browser.close();
  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
