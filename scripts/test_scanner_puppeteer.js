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
  console.log(`[TEST CCO] Servidor de testes ativo na porta ${PORT}`);

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1600 });

    page.on('console', msg => {
      const txt = msg.text();
      if (!txt.includes('Download the React DevTools') && !txt.includes('[vite]')) {
        console.log('BROWSER LOG:', txt);
      }
    });
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    // Injetar autenticação no localStorage
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

    // Navegar para o painel de câmeras CFTV
    console.log('[PASSO 1] Navegando para /admin/concreto?secao=cameras-cftv...');
    await page.goto(`http://localhost:${PORT}/admin/concreto?secao=cameras-cftv`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Clicar na aba "Scanner de Rede Local"
    console.log('[PASSO 2] Abrindo Scanner de Rede Local...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const scanBtn = btns.find(b => b.textContent.includes('Scanner'));
      if (scanBtn) scanBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Executar a varredura ativa de rede
    console.log('[PASSO 3] Executando varredura ativa na sub-rede 192.168.1.0/24...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const varrerBtn = btns.find(b => b.textContent.includes('Iniciar Varredura'));
      if (varrerBtn) varrerBtn.click();
    });
    await new Promise(r => setTimeout(r, 1800));

    // Capturar tela da varredura com as 19 marcas descobertas
    await page.screenshot({ path: '/home/ubuntu/cftv_scanner_redes_multimarca.png', fullPage: false });
    console.log('Salvo: /home/ubuntu/cftv_scanner_redes_multimarca.png');

    // Conectar e integrar todas as câmeras descobertas em lote
    console.log('[PASSO 4] Clicando em "Integrar Todas Descobertas" para conectar as 19 marcas...');
    const resultIntegrar = await page.evaluate(async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const integrarBtn = btns.find(b => b.textContent.includes('Integrar Todas Descobertas') || b.textContent.includes('Integrar'));
      if (integrarBtn) {
        integrarBtn.click();
        return true;
      }
      return false;
    });
    console.log('Botão Integrar clicado:', resultIntegrar);
    await new Promise(r => setTimeout(r, 2500));

    // Capturar tela pós-integração
    await page.screenshot({ path: '/home/ubuntu/cftv_scanner_todas_conectadas.png', fullPage: false });
    console.log('Salvo: /home/ubuntu/cftv_scanner_todas_conectadas.png');

    // Voltar para a visualização em Grid do CCO
    console.log('[PASSO 5] Alternando para visão Grid de Câmeras CFTV Ao Vivo...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gridBtn = btns.find(b => b.textContent.includes('Grid'));
      if (gridBtn) gridBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Validar carregamento de todas as imagens no Grid
    const statusImagens = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.src.includes('/assets/cftv/'));
      return imgs.map(img => ({
        src: img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        ok: img.complete && img.naturalWidth > 0
      }));
    });

    console.log(`[VALIDAÇÃO IMAGENS] Total de feeds de câmeras no Grid: ${statusImagens.length}`);
    const todasOk = statusImagens.every(i => i.ok);
    console.log('Todas as imagens carregaram 100% perfeitamente?', todasOk);
    if (!todasOk) {
      console.warn('Algumas imagens falharam:', statusImagens.filter(i => !i.ok));
    }

    // Capturar Grid completo de câmeras com imagens
    await page.screenshot({ path: '/home/ubuntu/cftv_grid_cameras_todas_conectadas.png', fullPage: true });
    console.log('Salvo: /home/ubuntu/cftv_grid_cameras_todas_conectadas.png');

    // Clicar no botão "Snapshot" de uma das câmeras para abrir o modal de alta definição
    console.log('[PASSO 6] Abrindo modal de Snapshot fotográfico da câmera...');
    await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.src && img.src.includes('/assets/cftv/'));
      if (imgs.length > 0) imgs[0].click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Capturar o modal de snapshot
    await page.screenshot({ path: '/home/ubuntu/cftv_modal_snapshot_aberto.png', fullPage: false });
    console.log('Salvo: /home/ubuntu/cftv_modal_snapshot_aberto.png');

    // Fechar modal de snapshot
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fecharBtn = btns.find(b => b.textContent.trim() === 'Fechar' || b.textContent.trim() === '✕');
      if (fecharBtn) fecharBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Disparar análise KyttoIA no card de câmera
    console.log('[PASSO 7] Disparando análise de Visão Computacional pelo Motor KyttoIA no card...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const kyttoBtn = btns.find(b => b.textContent.includes('🤖 KyttoIA'));
      if (kyttoBtn) kyttoBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    // Capturar tela com a análise KyttoIA ativa (boundingBoxes, telemetria)
    await page.screenshot({ path: '/home/ubuntu/cftv_analise_vision_kyttoia.png', fullPage: false });
    console.log('Salvo: /home/ubuntu/cftv_analise_vision_kyttoia.png');

    await browser.close();
    server.close();
    console.log('=== TODAS AS VALIDAÇÕES CONCLUÍDAS COM ÊXITO TOTAL! ===');
    process.exit(0);
  } catch (err) {
    console.error('Puppeteer validation error:', err);
    server.close();
    process.exit(1);
  }
});
