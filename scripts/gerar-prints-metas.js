import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Iniciando Puppeteer para gerar prints oficiais de Metas e Comissões...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  // 1. GERAÇÃO DO PRINT 1: MODAL DE CADASTRO DE METAS NO ERP DO GESTOR
  console.log('Gerando Print 1: Cadastro de Metas do Gestor no ERP Kytto...');
  await page.setViewport({ width: 1280, height: 950, deviceScaleFactor: 2 });

  const htmlAdminMetas = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>ERP Kytto - Barbearia Dino - Gestão de Metas e Comissões</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0f172a; color: #f8fafc; padding: 24px; min-height: 100vh; }
    .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 14px; }
    .badge { background: #2563eb; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .title { font-size: 22px; font-weight: 800; margin-top: 4px; display: flex; align-items: center; gap: 8px; }
    .subtitle { font-size: 13px; color: #94a3b8; }
    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px; }
    
    /* Backdrop & Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 99; }
    .modal-box { background: #1e293b; border: 1px solid #3b82f6; border-radius: 16px; width: 680px; max-width: 95%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6); overflow: hidden; }
    .modal-header { padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: flex-start; background: #0f172a; }
    .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 18px; max-height: 80vh; overflow-y: auto; }
    
    .section-box { background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; }
    .sec-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .sec-title { font-size: 14px; font-weight: 800; color: #fff; }
    .sec-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
    .base-input-group { display: flex; align-items: center; gap: 6px; background: #1e293b; padding: 6px 12px; border-radius: 8px; border: 1px solid #3b82f6; }
    .base-input-group span { font-size: 12px; font-weight: 700; color: #94a3b8; }
    .base-input-group strong { font-size: 15px; color: #fff; }
    
    .faixa-row { display: flex; align-items: center; justify-content: space-between; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; }
    .faixa-tag { font-size: 12px; font-weight: 800; color: #60a5fa; min-width: 70px; }
    .faixa-field { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #cbd5e1; }
    .faixa-val { background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 6px 10px; font-size: 13px; font-weight: 700; color: #fff; width: 110px; text-align: right; }
    .faixa-bonus { background: #0f172a; border: 1px solid #10b981; border-radius: 6px; padding: 6px 8px; font-size: 13px; font-weight: 800; color: #10b981; width: 65px; text-align: center; }
    .faixa-efetivo { font-size: 13px; font-weight: 900; color: #4ade80; background: rgba(34,197,94,0.12); padding: 5px 10px; border-radius: 6px; }
    
    .btn-add { background: transparent; border: 1px dashed #3b82f6; color: #60a5fa; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; width: 100%; text-align: center; margin-top: 6px; }
    
    .modal-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); background: #0f172a; display: flex; justify-content: flex-end; gap: 10px; }
    .btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
    .btn-save { background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; color: #fff; padding: 10px 22px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 14px rgba(37,99,235,0.4); }
  </style>
</head>
<body>
  <div class="topbar">
    <div>
      <span class="badge">ERP Barbearia Dino · Kytto</span>
      <h1 class="title">💈 Gestão > Metas e Comissões Individuais</h1>
      <p class="subtitle">Configuração do escalonamento de metas, bonificações progressivas e comissões por profissional.</p>
    </div>
    <div style="font-size: 13px; color: #94a3b8; text-align: right;">
      <div>Unidade: <strong>Barbearia Dino - Matriz</strong></div>
      <div>Fuso: <strong>Cuiabá (UTC-4)</strong> · Mês Ativo: <strong>Novembro/2026</strong></div>
    </div>
  </div>

  <div class="modal-backdrop">
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <span style="background: rgba(59,130,246,0.15); color: #60a5fa; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">Profissional Selecionada</span>
          <h2 style="font-size: 19px; font-weight: 900; color: #fff; margin-top: 4px;">Natani Minanis Dobler (Nati)</h2>
          <p style="font-size: 12px; color: #94a3b8;">Hair Stylist & Especialista em Visagismo e Química Capilar</p>
        </div>
        <button style="background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;">✕</button>
      </div>

      <div class="modal-body">
        <!-- SEÇÃO 1: METAS DE SERVIÇOS (CABELO, BARBA E EXTRAS) -->
        <div class="section-box" style="border-left: 4px solid #3b82f6;">
          <div class="sec-head">
            <div>
              <div class="sec-title">✂️ 1. Comissão e Metas de Serviços (Cabelo, Barba e Extras)</div>
              <div class="sec-sub">Comissão base de 40% que escala automaticamente conforme as metas são batidas:</div>
            </div>
            <div class="base-input-group">
              <span>Base Fixa:</span>
              <strong>40.0%</strong>
            </div>
          </div>

          <!-- FAIXA 1 -->
          <div class="faixa-row">
            <span class="faixa-tag">Meta 1:</span>
            <div class="faixa-field">
              <span>Faturamento:</span>
              <div class="faixa-val">R$ 15.000,00</div>
            </div>
            <div class="faixa-field">
              <span>Bônus:</span>
              <div class="faixa-bonus">+ 5.0%</div>
            </div>
            <div class="faixa-efetivo">= 45.0% Total</div>
          </div>

          <!-- FAIXA 2 -->
          <div class="faixa-row">
            <span class="faixa-tag">Meta 2:</span>
            <div class="faixa-field">
              <span>Faturamento:</span>
              <div class="faixa-val">R$ 20.000,00</div>
            </div>
            <div class="faixa-field">
              <span>Bônus:</span>
              <div class="faixa-bonus">+ 7.0%</div>
            </div>
            <div class="faixa-efetivo">= 47.0% Total</div>
          </div>

          <!-- FAIXA 3 -->
          <div class="faixa-row">
            <span class="faixa-tag">Meta 3:</span>
            <div class="faixa-field">
              <span>Faturamento:</span>
              <div class="faixa-val">R$ 26.000,00</div>
            </div>
            <div class="faixa-field">
              <span>Bônus:</span>
              <div class="faixa-bonus">+ 10.0%</div>
            </div>
            <div class="faixa-efetivo">= 50.0% Total</div>
          </div>

          <button class="btn-add">+ Adicionar Outra Faixa de Meta de Serviços</button>
        </div>

        <!-- SEÇÃO 2: METAS DE PRODUTOS (SEPARADAS) -->
        <div class="section-box" style="border-left: 4px solid #a855f7;">
          <div class="sec-head">
            <div>
              <div class="sec-title">🧴 2. Comissão e Metas de Produtos de Revenda (Separada)</div>
              <div class="sec-sub">Comissão exclusiva sobre venda de pomadas, óleos, balms e shampoos:</div>
            </div>
            <div class="base-input-group" style="border-color: #a855f7;">
              <span>Base Fixa:</span>
              <strong style="color: #c084fc;">10.0%</strong>
            </div>
          </div>

          <!-- FAIXA 1 PRODUTOS -->
          <div class="faixa-row">
            <span class="faixa-tag" style="color: #c084fc;">Meta 1 Prod:</span>
            <div class="faixa-field">
              <span>Vendas:</span>
              <div class="faixa-val">R$ 1.000,00</div>
            </div>
            <div class="faixa-field">
              <span>Bônus:</span>
              <div class="faixa-bonus" style="border-color: #c084fc; color: #c084fc;">+ 2.0%</div>
            </div>
            <div class="faixa-efetivo" style="color: #c084fc; background: rgba(192,132,252,0.12);">= 12.0% Total</div>
          </div>

          <!-- FAIXA 2 PRODUTOS -->
          <div class="faixa-row">
            <span class="faixa-tag" style="color: #c084fc;">Meta 2 Prod:</span>
            <div class="faixa-field">
              <span>Vendas:</span>
              <div class="faixa-val">R$ 2.500,00</div>
            </div>
            <div class="faixa-field">
              <span>Bônus:</span>
              <div class="faixa-bonus" style="border-color: #c084fc; color: #c084fc;">+ 5.0%</div>
            </div>
            <div class="faixa-efetivo" style="color: #c084fc; background: rgba(192,132,252,0.12);">= 15.0% Total</div>
          </div>

          <button class="btn-add" style="border-color: #a855f7; color: #c084fc;">+ Adicionar Faixa de Meta de Produtos</button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel">Cancelar</button>
        <button class="btn-save">💾 Salvar Metas e Comissões</button>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  await page.setContent(htmlAdminMetas);
  const pathPrint1 = '/home/ubuntu/agro-open/docs/prints-metas/01_admin_cadastro_metas_comissoes.png';
  await page.screenshot({ path: pathPrint1, fullPage: true });
  console.log(`Print 1 salvo com sucesso em: ${pathPrint1}`);

  // 2. GERAÇÃO DO PRINT 2: APP DO BARBEIRO NO CELULAR COM A RÉGUA DE METAS
  console.log('Gerando Print 2: App do Barbeiro com Régua de Metas no Celular...');
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2, isMobile: true });

  const htmlAppMetas = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>App do Barbeiro Dino - Minhas Metas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0E1014; color: #E8EAF2; padding: 16px; min-height: 100vh; }
    .card { background: #1C202B; border: 1px solid #2B3140; border-radius: 16px; padding: 14px; margin-bottom: 12px; }
    .header-box { background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); border: 1px solid #6366f1; border-radius: 16px; padding: 14px; margin-bottom: 12px; }
    .badge-top { font-size: 11px; font-weight: 800; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.06em; }
    .user-name { font-size: 20px; font-weight: 900; color: #fff; margin-top: 4px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 0; }
    .metric-card { background: rgba(255,255,255,0.06); padding: 8px 6px; border-radius: 10px; text-align: center; }
    .metric-title { font-size: 10px; color: #A4AABE; font-weight: 700; text-transform: uppercase; }
    .metric-val { font-size: 15px; font-weight: 900; color: #fff; margin-top: 2px; }
    
    .nav-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 10px; }
    .tab-btn { padding: 8px 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(15,23,42,0.6); color: #fff; font-size: 11px; font-weight: 800; text-align: center; }
    .tab-btn.active { background: #4f46e5; border-color: #818cf8; }
    
    /* Escalada de metas */
    .metas-box { background: linear-gradient(145deg, rgba(30,27,75,0.98) 0%, rgba(15,23,42,0.98) 100%); border: 1px solid #818cf8; border-radius: 16px; padding: 14px; margin-bottom: 12px; box-shadow: 0 8px 24px rgba(99,102,241,0.15); }
    .regua-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 12px 0; }
    .regua-card { border-radius: 10px; padding: 8px 4px; text-align: center; position: relative; }
    .regua-card.atingida { background: rgba(34,197,94,0.18); border: 2px solid #22c55e; }
    .regua-card.alvo { background: rgba(99,102,241,0.22); border: 2px solid #818cf8; }
    .regua-card.futura { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
    .tag-atingida { position: absolute; top: -7px; right: 4px; background: #22c55e; color: #000; font-size: 8px; font-weight: 900; padding: 1px 4px; border-radius: 4px; }
    .tag-alvo { position: absolute; top: -7px; right: 4px; background: #818cf8; color: #fff; font-size: 8px; font-weight: 900; padding: 1px 4px; border-radius: 4px; }
    
    .status-progresso-box { background: rgba(0,0,0,0.35); padding: 10px; border-radius: 10px; margin-top: 8px; }
    .bar-track { height: 8px; background: rgba(255,255,255,0.1); border-radius: 99px; overflow: hidden; margin: 6px 0; }
    .bar-fill { height: 100%; border-radius: 99px; }
  </style>
</head>
<body>
  <!-- HEADER DO BARBEIRO -->
  <div class="header-box">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div class="badge-top">🎯 Central de Metas & Comissões</div>
        <div class="user-name">Nati (Natani Dobler)</div>
      </div>
      <div style="background: #f59e0b; color: #000; font-weight: 900; font-size: 11px; padding: 4px 8px; border-radius: 12px;">
        🎡 2 Giros
      </div>
    </div>

    <div class="grid-3">
      <div class="metric-card">
        <div class="metric-title">Hoje</div>
        <div class="metric-val" style="color: #fff;">R$ 480,00</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Semana</div>
        <div class="metric-val" style="color: #fbbf24;">R$ 4.250,00</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Mês (Serviços)</div>
        <div class="metric-val" style="color: #38bdf8;">R$ 16.500,00</div>
      </div>
    </div>

    <div class="nav-tabs">
      <div class="tab-btn">⚡ Hoje</div>
      <div class="tab-btn active">📈 Meta Mês</div>
      <div class="tab-btn">🎡 Roleta</div>
      <div class="tab-btn">🏆 Ranking</div>
    </div>
  </div>

  <!-- RÉGUA DE METAS DE SERVIÇOS (CABELO, BARBA E EXTRAS) -->
  <div class="metas-box">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 10px; font-weight: 900; color: #a5b4fc; text-transform: uppercase;">🚀 Escalada de Metas do Mês</div>
        <div style="font-size: 16px; font-weight: 900; color: #fff; margin-top: 2px;">Cortes, Barba e Extras</div>
        <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">Base: <strong>40%</strong> · Comissão Atual: <strong style="color: #4ade80; font-size: 13px;">45%</strong></div>
      </div>
      <div style="background: rgba(74,222,128,0.15); border: 1px solid #4ade80; padding: 6px 10px; border-radius: 10px; text-align: right;">
        <div style="font-size: 10px; color: #4ade80; font-weight: 800;">🔥 +5% BÔNUS ATIVO</div>
        <div style="font-size: 14px; font-weight: 900; color: #fff;">45% no Bolso</div>
      </div>
    </div>

    <!-- RÉGUA VISUAL NA MESMA LINHA -->
    <div class="regua-grid">
      <!-- META 1: BATIDA -->
      <div class="regua-card atingida">
        <span class="tag-atingida">✓ BATIDA</span>
        <div style="font-size: 10px; font-weight: 800; color: #86efac;">Meta 1</div>
        <div style="font-size: 13px; font-weight: 900; color: #fff; margin-top: 2px;">R$ 15.000</div>
        <div style="font-size: 10px; font-weight: 800; color: #4ade80; margin-top: 2px;">+5% = 45%</div>
      </div>

      <!-- META 2: ALVO ATUAL -->
      <div class="regua-card alvo">
        <span class="tag-alvo">PRÓXIMA</span>
        <div style="font-size: 10px; font-weight: 800; color: #c7d2fe;">Meta 2</div>
        <div style="font-size: 13px; font-weight: 900; color: #fff; margin-top: 2px;">R$ 20.000</div>
        <div style="font-size: 10px; font-weight: 800; color: #fbbf24; margin-top: 2px;">+7% = 47%</div>
      </div>

      <!-- META 3: FUTURA -->
      <div class="regua-card futura">
        <div style="font-size: 10px; font-weight: 800; color: #94a3b8;">Meta 3</div>
        <div style="font-size: 13px; font-weight: 900; color: #fff; margin-top: 2px;">R$ 26.000</div>
        <div style="font-size: 10px; font-weight: 800; color: #cbd5e1; margin-top: 2px;">+10% = 50%</div>
      </div>
    </div>

    <!-- PROGRESSO E STATUS -->
    <div class="status-progresso-box">
      <div style="display: flex; justify-content: space-between; font-size: 11px;">
        <span>Faturado: <strong style="color: #38bdf8;">R$ 16.500,00</strong></span>
        <span style="color: #fbbf24; font-weight: 800;">Faltam R$ 3.500,00 para Meta 2 (+7%)</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: 30%; background: linear-gradient(90deg, #6366f1, #38bdf8);"></div>
      </div>
      <div style="font-size: 11px; color: #e2e8f0; margin-top: 4px; line-height: 1.4;">
        👏 <strong>Você atingiu a Meta 1 (45%)!</strong> Faltam apenas R$ 3.500,00 em serviços para sua comissão subir para <strong>47%</strong>!
      </div>
    </div>
  </div>

  <!-- RÉGUA DE PRODUTOS DE REVENDA (SEPARADA) -->
  <div class="metas-box" style="background: linear-gradient(145deg, rgba(88,28,135,0.95) 0%, rgba(15,23,42,0.98) 100%); border-color: #c084fc;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 10px; font-weight: 900; color: #e9d5ff; text-transform: uppercase;">🧴 Metas de Produtos de Revenda</div>
        <div style="font-size: 15px; font-weight: 900; color: #fff; margin-top: 2px;">Pomadas, Óleos, Shampoos e Balms</div>
        <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">Base: <strong>10%</strong> · Atual: <strong style="color: #c084fc;">10%</strong></div>
      </div>
      <div style="background: rgba(192,132,252,0.2); border: 1px solid #c084fc; padding: 6px 10px; border-radius: 10px; text-align: right;">
        <div style="font-size: 10px; color: #e9d5ff; font-weight: 800;">10% REPASSE</div>
        <div style="font-size: 13px; font-weight: 900; color: #fff;">R$ 68,00 comissão</div>
      </div>
    </div>

    <div class="regua-grid" style="grid-template-columns: repeat(2, 1fr);">
      <div class="regua-card alvo" style="border-color: #c084fc;">
        <span class="tag-alvo" style="background: #c084fc;">ALVO</span>
        <div style="font-size: 10px; font-weight: 800; color: #e9d5ff;">Meta 1 Prod</div>
        <div style="font-size: 13px; font-weight: 900; color: #fff; margin-top: 2px;">R$ 1.000</div>
        <div style="font-size: 10px; font-weight: 800; color: #fbcfe8; margin-top: 2px;">+2% = 12%</div>
      </div>
      <div class="regua-card futura">
        <div style="font-size: 10px; font-weight: 800; color: #94a3b8;">Meta 2 Prod</div>
        <div style="font-size: 13px; font-weight: 900; color: #fff; margin-top: 2px;">R$ 2.500</div>
        <div style="font-size: 10px; font-weight: 800; color: #cbd5e1; margin-top: 2px;">+5% = 15%</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  await page.setContent(htmlAppMetas);
  const pathPrint2 = '/home/ubuntu/agro-open/docs/prints-metas/02_app_barbeiro_regua_metas_mensais.png';
  await page.screenshot({ path: pathPrint2, fullPage: true });
  console.log(`Print 2 salvo com sucesso em: ${pathPrint2}`);

  await browser.close();
  console.log('Capturas concluídas com sucesso total!');
}

main().catch(err => {
  console.error('Erro ao gerar prints:', err);
  process.exit(1);
});
