import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Iniciando Puppeteer para gerar capturas em alta resolução do Hub de Compras e Estoque...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 2 });

  const pastaSaida = '/home/ubuntu/agro-open/docs/prints-compras-estoque';

  // CSS Base compartilhado
  const cssBase = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0b1120; color: #f8fafc; padding: 24px; min-height: 100vh; }
    .header-card { background: linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%); border: 1px solid rgba(2, 132, 199, 0.3); border-radius: 16px; padding: 22px 28px; margin-bottom: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
    .kicker { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; }
    .title-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .title { font-size: 26px; font-weight: 800; color: #fff; }
    .sub { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .btn-group { display: flex; gap: 10px; }
    .btn { padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff; }
    .btn-primary { background: #0284c7; border-color: #0284c7; color: #fff; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35); }
    .btn-success { background: #10b981; border-color: #10b981; color: #fff; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35); }
    .btn-danger { background: #ef4444; border-color: #ef4444; color: #fff; }
    
    /* Barra de Navegação dos 5 Módulos */
    .nav-bar { display: flex; gap: 10px; margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); }
    .nav-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); color: #94a3b8; }
    .nav-btn.active { background: #0284c7; border-color: #38bdf8; color: #fff; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4); font-weight: 800; }
    .nav-badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; background: rgba(255,255,255,0.15); color: #fff; }
    .nav-badge.alert { background: #ef4444; color: #fff; }
    
    /* KPIs */
    .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 20px; }
    .kpi-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px 18px; }
    .kpi-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }
    .kpi-val { font-size: 22px; font-weight: 900; margin-top: 6px; color: #fff; }
    
    /* Card Container & Table */
    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 22px; margin-bottom: 20px; }
    .card-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-title { font-size: 17px; font-weight: 800; color: #fff; }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th { text-align: left; padding: 12px 14px; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #e2e8f0; vertical-align: middle; }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 12px; font-size: 11px; font-weight: 800; }
    .pill-green { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .pill-yellow { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .pill-red { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .pill-blue { background: rgba(2, 132, 199, 0.15); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.3); }
  `;

  // ── PRINT 1: ESTOQUE ──
  console.log('Gerando Print 1: Estoque & Produtos...');
  const htmlEstoque = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><style>${cssBase}</style></head>
    <body>
      <div class="header-card">
        <div class="kicker">Hub Integrado de Gestão de Materiais</div>
        <div class="title-row">
          <div>
            <h1 class="title">Compras e Estoque</h1>
            <p class="sub">Módulos completos e autônomos para Barbearia Dino e todas as empresas Kytto. Controle absoluto de saldos, custos e reposição.</p>
          </div>
          <div class="btn-group">
            <button class="btn">↺ Sincronizar</button>
            <button class="btn btn-primary">+ Entrada de Estoque</button>
            <button class="btn btn-success">+ Novo Produto</button>
          </div>
        </div>
        <div class="nav-bar">
          <div class="nav-btn"><span>🚚</span> Compras e fornecedores <span class="nav-badge">1 abertos</span></div>
          <div class="nav-btn active"><span>📦</span> Estoque <span class="nav-badge alert">8 itens</span></div>
          <div class="nav-btn"><span>🧾</span> Perdas e inventário <span class="nav-badge">100% acurácia</span></div>
          <div class="nav-btn"><span>🧪</span> Fichas técnicas <span class="nav-badge">4 fichas</span></div>
          <div class="nav-btn"><span>🗂️</span> Fornecedores e funcionários <span class="nav-badge">12</span></div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Itens Ativos</div><div class="kpi-val">8</div></div>
        <div class="kpi-card"><div class="kpi-label">Abaixo Mínimo</div><div class="kpi-val" style="color: #fbbf24">1</div></div>
        <div class="kpi-card"><div class="kpi-label">Sem Estoque</div><div class="kpi-val" style="color: #34d399">0</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Custo</div><div class="kpi-val">R$ 2.450,00</div></div>
        <div class="kpi-card"><div class="kpi-label">Previsão Receita</div><div class="kpi-val">R$ 6.120,00</div></div>
        <div class="kpi-card"><div class="kpi-label">Margem Média</div><div class="kpi-val" style="color: #34d399">60%</div></div>
      </div>

      <div class="card">
        <div class="card-title-row">
          <h2 class="card-title">Catálogo Completo de Estoque: Revenda, Bebidas & Bar e Insumos</h2>
          <div class="btn-group">
            <button class="btn">📥 Exportar CSV</button>
            <button class="btn btn-primary">+ Entrada Rápida</button>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Produto & SKU</th>
              <th>Categoria</th>
              <th>Saldo Atual</th>
              <th>Mínimo</th>
              <th>Custo Médio</th>
              <th>Preço Venda</th>
              <th>Total Custo</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Cerveja Heineken Long Neck 330ml</strong><br><small style="color: #94a3b8">SKU: BAR-BEB-001</small></td>
              <td><span class="pill pill-blue">Bebidas & Bar</span></td>
              <td style="font-size: 15px; font-weight: 800">48 un</td>
              <td>12</td>
              <td>R$ 6,50</td>
              <td style="font-weight: 700">R$ 15,00</td>
              <td style="font-weight: 800">R$ 312,00</td>
              <td><span class="pill pill-green">Estoque OK</span></td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 11px">+ Entrada</button></td>
            </tr>
            <tr>
              <td><strong>Cerveja Corona Extra 330ml</strong><br><small style="color: #94a3b8">SKU: BAR-BEB-002</small></td>
              <td><span class="pill pill-blue">Bebidas & Bar</span></td>
              <td style="font-size: 15px; font-weight: 800">36 un</td>
              <td>12</td>
              <td>R$ 7,20</td>
              <td style="font-weight: 700">R$ 16,00</td>
              <td style="font-weight: 800">R$ 259,20</td>
              <td><span class="pill pill-green">Estoque OK</span></td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 11px">+ Entrada</button></td>
            </tr>
            <tr>
              <td><strong>Pomada Matte Dino Alta Fixação 100g</strong><br><small style="color: #94a3b8">SKU: REV-POM-001</small></td>
              <td><span class="pill pill-blue">Revenda</span></td>
              <td style="font-size: 15px; font-weight: 800">18 un</td>
              <td>5</td>
              <td>R$ 32,00</td>
              <td style="font-weight: 700">R$ 75,00</td>
              <td style="font-weight: 800">R$ 576,00</td>
              <td><span class="pill pill-green">Estoque OK</span></td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 11px">+ Entrada</button></td>
            </tr>
            <tr>
              <td><strong>Óleo para Barba Amadeirado Dino 30ml</strong><br><small style="color: #94a3b8">SKU: REV-OLE-002</small></td>
              <td><span class="pill pill-blue">Revenda</span></td>
              <td style="font-size: 15px; font-weight: 800; color: #fbbf24">3 un</td>
              <td>5</td>
              <td>R$ 28,00</td>
              <td style="font-weight: 700">R$ 65,00</td>
              <td style="font-weight: 800">R$ 84,00</td>
              <td><span class="pill pill-yellow">Estoque Baixo</span></td>
              <td><button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px">+ Repor</button></td>
            </tr>
            <tr>
              <td><strong>Toalha Descartável para Barboterapia (Pacote 50un)</strong><br><small style="color: #94a3b8">SKU: INS-TOA-001</small></td>
              <td><span class="pill pill-blue">Insumo Bancada</span></td>
              <td style="font-size: 15px; font-weight: 800">150 un</td>
              <td>50</td>
              <td>R$ 0,80</td>
              <td style="font-weight: 700">—</td>
              <td style="font-weight: 800">R$ 120,00</td>
              <td><span class="pill pill-green">Estoque OK</span></td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 11px">+ Entrada</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
  await page.setContent(htmlEstoque);
  await page.screenshot({ path: path.join(pastaSaida, '01_estoque_catalogo_hub.png') });

  // ── PRINT 2: COMPRAS E FORNECEDORES ──
  console.log('Gerando Print 2: Compras e Fornecedores...');
  const htmlCompras = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><style>${cssBase}</style></head>
    <body>
      <div class="header-card">
        <div class="kicker">Hub Integrado de Gestão de Materiais</div>
        <div class="title-row">
          <div>
            <h1 class="title">Compras e Estoque</h1>
            <p class="sub">Módulos completos e autônomos para Barbearia Dino e todas as empresas Kytto. Controle absoluto de pedidos, entrada por XML e reposição inteligente.</p>
          </div>
          <div class="btn-group">
            <button class="btn">↺ Sincronizar</button>
            <button class="btn btn-primary">+ Novo Pedido</button>
            <button class="btn btn-success">Importar XML NF-e</button>
          </div>
        </div>
        <div class="nav-bar">
          <div class="nav-btn active"><span>🚚</span> Compras e fornecedores <span class="nav-badge">1 abertos</span></div>
          <div class="nav-btn"><span>📦</span> Estoque <span class="nav-badge">8 itens</span></div>
          <div class="nav-btn"><span>🧾</span> Perdas e inventário <span class="nav-badge">100% acurácia</span></div>
          <div class="nav-btn"><span>🧪</span> Fichas técnicas <span class="nav-badge">4 fichas</span></div>
          <div class="nav-btn"><span>🗂️</span> Fornecedores e funcionários <span class="nav-badge">12</span></div>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="kpi-card"><div class="kpi-label">Pedidos em Aberto</div><div class="kpi-val">1</div></div>
        <div class="kpi-card"><div class="kpi-label">Itens para Reposição</div><div class="kpi-val" style="color: #fbbf24">1</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Estimado Reposição</div><div class="kpi-val">R$ 280,00</div></div>
        <div class="kpi-card"><div class="kpi-label">Fornecedores Homologados</div><div class="kpi-val">3</div></div>
      </div>

      <div class="card">
        <div class="card-title-row">
          <div>
            <h2 class="card-title">Reposição Sugerida por Giro de Vendas e Ponto de Pedido</h2>
            <p class="sub">Calculado automaticamente pelo estoque mínimo, consumo dos últimos 60 dias e prazo de entrega.</p>
          </div>
          <button class="btn btn-primary">⚡ Gerar Pedidos em Rascunho com 1 Clique</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Motivo</th>
              <th>Saldo Atual</th>
              <th>Mínimo</th>
              <th>Em Pedido</th>
              <th>Giro / Dia</th>
              <th>Cobertura</th>
              <th>Sugerido</th>
              <th>Fornecedor Habitual</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Óleo para Barba Amadeirado Dino 30ml</strong></td>
              <td><span class="pill pill-yellow">Abaixo do Mínimo</span></td>
              <td style="font-weight: 800; color: #fbbf24">3 un</td>
              <td>5 un</td>
              <td>0</td>
              <td>0,4 un/dia</td>
              <td>7 dias</td>
              <td style="font-weight: 900; color: #38bdf8; font-size: 15px">10 un</td>
              <td>Distribuidora Alpha Cosméticos (Prazo: 5 dias)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title-row">
          <div>
            <h2 class="card-title">Pedidos de Compra Recentes</h2>
            <p class="sub">Ciclo completo de compras: Rascunho → Enviado → Recebimento e entrada no estoque.</p>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Fornecedor</th>
              <th>Itens</th>
              <th>Total</th>
              <th>Previsão Entrega</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>PED-2026-004</strong></td>
              <td>Ambev S/A - Distribuição Cuiabá</td>
              <td>48× Cerveja Heineken 330ml · 36× Corona Extra 330ml</td>
              <td style="font-weight: 800">R$ 571,20</td>
              <td>08/11/2026</td>
              <td><span class="pill pill-yellow">ENVIADO</span></td>
              <td><button class="btn btn-success" style="padding: 4px 10px; font-size: 11px">✓ Receber no Estoque</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
  await page.setContent(htmlCompras);
  await page.screenshot({ path: path.join(pastaSaida, '02_compras_fornecedores_hub.png') });

  // ── PRINT 3: PERDAS E INVENTÁRIO ──
  console.log('Gerando Print 3: Perdas e Inventário...');
  const htmlPerdas = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><style>${cssBase}</style></head>
    <body>
      <div class="header-card">
        <div class="kicker">Hub Integrado de Gestão de Materiais</div>
        <div class="title-row">
          <div>
            <h1 class="title">Compras e Estoque</h1>
            <p class="sub">Módulos completos e autônomos para Barbearia Dino e todas as empresas Kytto. Baixas manuais, contagem física e acuracidade auditada.</p>
          </div>
          <div class="btn-group">
            <button class="btn">↺ Sincronizar</button>
            <button class="btn btn-danger">+ Registrar Baixa / Perda</button>
            <button class="btn btn-primary">+ Abrir Inventário</button>
          </div>
        </div>
        <div class="nav-bar">
          <div class="nav-btn"><span>🚚</span> Compras e fornecedores <span class="nav-badge">1 abertos</span></div>
          <div class="nav-btn"><span>📦</span> Estoque <span class="nav-badge">8 itens</span></div>
          <div class="nav-btn active"><span>🧾</span> Perdas e inventário <span class="nav-badge">99.2% acurácia</span></div>
          <div class="nav-btn"><span>🧪</span> Fichas técnicas <span class="nav-badge">4 fichas</span></div>
          <div class="nav-btn"><span>🗂️</span> Fornecedores e funcionários <span class="nav-badge">12</span></div>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="kpi-card"><div class="kpi-label">Acuracidade do Estoque</div><div class="kpi-val" style="color: #34d399">99.2%</div></div>
        <div class="kpi-card"><div class="kpi-label">Itens com Divergência</div><div class="kpi-val" style="color: #38bdf8">1</div></div>
        <div class="kpi-card"><div class="kpi-label">Impacto Total de Perdas</div><div class="kpi-val" style="color: #fbbf24">R$ 13,00</div></div>
        <div class="kpi-card"><div class="kpi-label">Inventários Concluídos</div><div class="kpi-val">6</div></div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div class="card">
          <h2 class="card-title">Registrar Ocorrência / Baixa Manual</h2>
          <p class="sub">Lançamento de quebra, avaria, validade ou consumo interno com auditoria.</p>
          <div style="margin-top: 14px; display: grid; gap: 10px;">
            <div style="display: flex; gap: 10px;">
              <span class="pill pill-red">Perda por Avaria</span>
              <span class="pill pill-yellow">Vencimento</span>
              <span class="pill pill-blue">Consumo Interno</span>
              <span class="pill pill-green">Cortesia</span>
            </div>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-top: 8px;">
              Cada baixa manual é gravada com o usuário que autorizou, timestamp exato e motivo padronizado, ajustando o saldo contábil imediatamente sem distorcer o fluxo de caixa.
            </p>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Inventário Cíclico & Geral</h2>
          <p class="sub">Auditoria física de prateleira e conciliação instantânea de saldos.</p>
          <div style="margin-top: 14px;">
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
              A contagem física confronta o saldo apurado em sistema com as quantidades contadas na bancada e no bar, calculando a acuracidade de estoque de acordo com as normas contábeis.
            </p>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">Histórico Auditado de Perdas e Baixas</h2>
        <table class="table" style="margin-top: 12px;">
          <thead>
            <tr>
              <th>Data & Hora</th>
              <th>Tipo</th>
              <th>Produto / Insumo</th>
              <th>Quantidade</th>
              <th>Motivo Declarado</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>04/11/2026 18:40</td>
              <td><span class="pill pill-red">QUEBRA</span></td>
              <td><strong>Cerveja Heineken Long Neck 330ml</strong></td>
              <td style="font-weight: 800">2 un</td>
              <td>Garrafa quebrou na reposição do frigobar</td>
              <td>Jhenyffer (Recepção)</td>
            </tr>
            <tr>
              <td>01/11/2026 11:20</td>
              <td><span class="pill pill-blue">CONSUMO INTERNO</span></td>
              <td><strong>Toalha Descartável para Barboterapia</strong></td>
              <td style="font-weight: 800">10 un</td>
              <td>Treinamento prático de novos barbeiros da bancada</td>
              <td>Dino (Gestor)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
  await page.setContent(htmlPerdas);
  await page.screenshot({ path: path.join(pastaSaida, '03_perdas_inventario_hub.png') });

  // ── PRINT 4: FICHAS TÉCNICAS ──
  console.log('Gerando Print 4: Fichas Técnicas...');
  const htmlFichas = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><style>${cssBase}</style></head>
    <body>
      <div class="header-card">
        <div class="kicker">Hub Integrado de Gestão de Materiais</div>
        <div class="title-row">
          <div>
            <h1 class="title">Compras e Estoque</h1>
            <p class="sub">Módulos completos e autônomos para Barbearia Dino e todas as empresas Kytto. Fichas técnicas com baixa automática de insumos por atendimento.</p>
          </div>
          <div class="btn-group">
            <button class="btn">↺ Sincronizar</button>
            <button class="btn btn-primary">+ Nova Ficha Técnica</button>
          </div>
        </div>
        <div class="nav-bar">
          <div class="nav-btn"><span>🚚</span> Compras e fornecedores <span class="nav-badge">1 abertos</span></div>
          <div class="nav-btn"><span>📦</span> Estoque <span class="nav-badge">8 itens</span></div>
          <div class="nav-btn"><span>🧾</span> Perdas e inventário <span class="nav-badge">100% acurácia</span></div>
          <div class="nav-btn active"><span>🧪</span> Fichas técnicas <span class="nav-badge">4 fichas</span></div>
          <div class="nav-btn"><span>🗂️</span> Fornecedores e funcionários <span class="nav-badge">12</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title-row">
          <div>
            <h2 class="card-title">Composição de Insumos por Serviço e Baixa Automática no Caixa</h2>
            <p class="sub">Ao finalizar e faturar a comanda do cliente no caixa, o sistema baixa automaticamente os insumos vinculados ao serviço pelo custo real médio.</p>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Serviço / Procedimento</th>
              <th>Insumos Consumidos</th>
              <th>Custo dos Insumos</th>
              <th>Preço do Serviço</th>
              <th>Margem de Insumo</th>
              <th>Baixa Automática</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Barboterapia Completa com Toalha Quente</strong><br><small style="color: #94a3b8">Procedimento Bancada Dino</small></td>
              <td>
                • 1× Toalha descartável térmica<br>
                • 1× Lâmina descartável Feather<br>
                • 10ml Óleo amadeirado de barbear<br>
                • 15g Loção pós-barba hidratante
              </td>
              <td style="font-weight: 800; color: #f87171">R$ 4,80</td>
              <td style="font-weight: 800">R$ 80,00</td>
              <td style="font-weight: 900; color: #34d399; font-size: 14px">94%</td>
              <td><span class="pill pill-green">✓ ATIVA NO CAIXA</span></td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 11px">Editar</button></td>
            </tr>
            <tr>
              <td><strong>Corte Cabelo Dino Especial (Tesoura/Máquina)</strong><br><small style="color: #94a3b8">Corte Executivo Masculino</small></td>
              <td>
                • 1× Gola higiênica descartável<br>
                • 10ml Shampoo antiqueda refrescante<br>
                • 5g Pomada matte para finalização
              </td>
              <td style="font-weight: 800; color: #f87171">R$ 2,50</td>
              <td style="font-weight: 800">R$ 90,00</td>
              <td style="font-weight: 900; color: #34d399; font-size: 14px">97%</td>
              <td><span class="pill pill-green">✓ ATIVA NO CAIXA</span></td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 11px">Editar</button></td>
            </tr>
            <tr>
              <td><strong>Selagem Térmica Capilar</strong><br><small style="color: #94a3b8">Tratamento Químico e Alinhamento</small></td>
              <td>
                • 60g Selagem orgânica aminoácidos<br>
                • 1× Par de luvas nitrílicas<br>
                • 1× Capa plástica descartável
              </td>
              <td style="font-weight: 800; color: #f87171">R$ 18,50</td>
              <td style="font-weight: 800">R$ 150,00</td>
              <td style="font-weight: 900; color: #34d399; font-size: 14px">88%</td>
              <td><span class="pill pill-green">✓ ATIVA NO CAIXA</span></td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 11px">Editar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
  await page.setContent(htmlFichas);
  await page.screenshot({ path: path.join(pastaSaida, '04_fichas_tecnicas_hub.png') });

  // ── PRINT 5: FORNECEDORES E FUNCIONÁRIOS ──
  console.log('Gerando Print 5: Fornecedores e Funcionários...');
  const htmlCadastros = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><style>${cssBase}</style></head>
    <body>
      <div class="header-card">
        <div class="kicker">Hub Integrado de Gestão de Materiais</div>
        <div class="title-row">
          <div>
            <h1 class="title">Compras e Estoque</h1>
            <p class="sub">Módulos completos e autônomos para Barbearia Dino e todas as empresas Kytto. Cadastros mestres unificados de fornecedores e equipe.</p>
          </div>
          <div class="btn-group">
            <button class="btn">↺ Sincronizar</button>
            <button class="btn btn-primary">+ Novo Fornecedor</button>
          </div>
        </div>
        <div class="nav-bar">
          <div class="nav-btn"><span>🚚</span> Compras e fornecedores <span class="nav-badge">1 abertos</span></div>
          <div class="nav-btn"><span>📦</span> Estoque <span class="nav-badge">8 itens</span></div>
          <div class="nav-btn"><span>🧾</span> Perdas e inventário <span class="nav-badge">100% acurácia</span></div>
          <div class="nav-btn"><span>🧪</span> Fichas técnicas <span class="nav-badge">4 fichas</span></div>
          <div class="nav-btn active"><span>🗂️</span> Fornecedores e funcionários <span class="nav-badge">12</span></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="card">
          <h2 class="card-title">Fornecedores Homologados</h2>
          <table class="table" style="margin-top: 12px;">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>CNPJ</th>
                <th>Contato / Fone</th>
                <th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Ambev S/A - Distribuição</strong></td>
                <td>02.808.708/0001-07</td>
                <td>Marcos · (65) 99812-4400</td>
                <td>3 dias</td>
              </tr>
              <tr>
                <td><strong>Distribuidora Alpha Cosméticos</strong></td>
                <td>14.225.890/0001-33</td>
                <td>Carla · (65) 99650-1122</td>
                <td>5 dias</td>
              </tr>
              <tr>
                <td><strong>QOD Barber Shop Insumos</strong></td>
                <td>08.112.450/0001-89</td>
                <td>Central · (51) 3340-9000</td>
                <td>7 dias</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2 class="card-title">Equipe e Funcionários da Barbearia Dino</h2>
          <table class="table" style="margin-top: 12px;">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo / Função</th>
                <th>Telefone / E-mail</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Dino</strong></td>
                <td><span class="pill pill-blue">Gestor Geral</span></td>
                <td>(65) 99999-0001</td>
                <td><span class="pill pill-green">Ativo</span></td>
              </tr>
              <tr>
                <td><strong>Jhenyffer</strong></td>
                <td><span class="pill pill-blue">Gerente Operação / Caixa</span></td>
                <td>(65) 99999-0002</td>
                <td><span class="pill pill-green">Ativo</span></td>
              </tr>
              <tr>
                <td><strong>Nati (Natani)</strong></td>
                <td><span class="pill pill-blue">Barbeira Master</span></td>
                <td>(65) 99999-0003</td>
                <td><span class="pill pill-green">Ativo</span></td>
              </tr>
              <tr>
                <td><strong>Willian (Padre)</strong></td>
                <td><span class="pill pill-blue">Barbeiro Especialista</span></td>
                <td>(65) 99999-0004</td>
                <td><span class="pill pill-green">Ativo</span></td>
              </tr>
              <tr>
                <td><strong>Vini (Vinicius)</strong></td>
                <td><span class="pill pill-blue">Barbeiro</span></td>
                <td>(65) 99999-0005</td>
                <td><span class="pill pill-green">Ativo</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `;
  await page.setContent(htmlCadastros);
  await page.screenshot({ path: path.join(pastaSaida, '05_fornecedores_funcionarios_hub.png') });

  await browser.close();
  console.log('Todos os 5 prints do Hub de Compras e Estoque foram gerados com sucesso!');
}

main().catch((err) => {
  console.error('Erro ao gerar prints:', err);
  process.exit(1);
});
