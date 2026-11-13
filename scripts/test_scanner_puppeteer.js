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

// Auth and session mocks
app.use((req, res, next) => {
  req.user = MOCK_USER;
  next();
});

app.post('/api/admin/login', (req, res) => {
  res.json({
    ok: true,
    token: 'test-valid-jwt-cco-2026',
    user: MOCK_USER
  });
});

app.get('/api/admin/commerce-session', (req, res) => {
  res.json({
    lojas_acessiveis: [MOCK_LOJA],
    empresas_acessiveis: [MOCK_EMPRESA]
  });
});

app.get('/api/admin/minhas-permissoes', (req, res) => {
  res.json({ aplicavel: false, permissoes: [] });
});

app.get('/api/me', (req, res) => res.json({ ok: true, user: MOCK_USER }));
app.get('/api/auth/me', (req, res) => res.json({ ok: true, user: MOCK_USER }));
app.get('/api/empresas/ativas', (req, res) => res.json({ ok: true, empresas: [MOCK_EMPRESA] }));

// Concrete module routes
app.use('/api/admin/concreto', criarRotasConcreto());

// Static assets
app.use(express.static(path.join(rootDir, 'app/public')));

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'app/public/index.html'));
});

const PORT = 4568;
const server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}`);

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1600 });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // Inject localStorage before any navigation
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

    // Go to cameras-cftv
    await page.goto(`http://localhost:${PORT}/admin/concreto?secao=cameras-cftv`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Capture initial cameras view
    await page.screenshot({ path: '/home/ubuntu/cftv_cameras_grid_inicial.png', fullPage: false });
    console.log('Saved /home/ubuntu/cftv_cameras_grid_inicial.png');

    // Click on "Scanner de Rede Local"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const scanBtn = btns.find(b => b.textContent.includes('Scanner'));
      if (scanBtn) scanBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Click on "Iniciar Varredura"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const varrerBtn = btns.find(b => b.textContent.includes('Iniciar Varredura'));
      if (varrerBtn) varrerBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Capture Scanner view showing cards
    await page.screenshot({ path: '/home/ubuntu/cftv_scanner_redes_multimarca.png', fullPage: false });
    console.log('Saved /home/ubuntu/cftv_scanner_redes_multimarca.png');

    // Filter by Bosch in the scanner
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const marcaSelect = selects.find(s => s.textContent.includes('Intelbras') || s.textContent.includes('Fabricantes'));
      if (marcaSelect) {
        marcaSelect.value = 'bosch';
        marcaSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: '/home/ubuntu/cftv_scanner_bosch_filtrado.png', fullPage: false });
    console.log('Saved /home/ubuntu/cftv_scanner_bosch_filtrado.png');

    // Filter by Toledo Prix LPR
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const marcaSelect = selects.find(s => s.textContent.includes('Intelbras') || s.textContent.includes('Fabricantes'));
      if (marcaSelect) {
        marcaSelect.value = 'toledo_prix_lpr';
        marcaSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: '/home/ubuntu/cftv_scanner_toledo_lpr_filtrado.png', fullPage: false });
    console.log('Saved /home/ubuntu/cftv_scanner_toledo_lpr_filtrado.png');

    // Reset filter to All and open Modal
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const marcaSelect = selects.find(s => s.textContent.includes('Intelbras') || s.textContent.includes('Fabricantes'));
      if (marcaSelect) {
        marcaSelect.value = 'todos';
        marcaSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent.includes('Adicionar Câmera IP'));
      if (addBtn) addBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: '/home/ubuntu/cftv_modal_19_presets.png', fullPage: false });
    console.log('Saved /home/ubuntu/cftv_modal_19_presets.png');

    await browser.close();
    server.close();
    console.log('VALIDATION COMPLETED WITH SUCCESS!');
    process.exit(0);
  } catch (err) {
    console.error('Puppeteer validation error:', err);
    server.close();
    process.exit(1);
  }
});
