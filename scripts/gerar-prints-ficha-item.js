import puppeteer from 'puppeteer';
import path from 'path';

async function main() {
  console.log('Iniciando Puppeteer para gerar capturas em alta resolução da Ficha do Item e Cadastros Incompletos...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 2 });

  const pastaSaida = '/home/ubuntu/agro-open/docs/prints-ficha-item';

  const cssBase = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0b1120; color: #f8fafc; padding: 24px; min-height: 100vh; }
    .header-card { background: linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%); border: 1px solid rgba(2, 132, 199, 0.3); border-radius: 16px; padding: 22px 28px; margin-bottom: 20px; }
    .kicker { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; }
    .title-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .title { font-size: 26px; font-weight: 800; color: #fff; }
    .sub { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .btn { padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff; }
    .btn-primary { background: #0284c7; border-color: #0284c7; color: #fff; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35); }
    .btn-warning { background: #f59e0b; border-color: #f59e0b; color: #000; font-weight: 800; }
    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px; margin-bottom: 16px; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-box { background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; width: 100%; max-width: 880px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .tabs-bar { display: flex; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin: 18px 0; }
    .tab-btn { padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 800; border: none; background: transparent; color: #94a3b8; cursor: pointer; }
    .tab-btn.active { background: #0284c7; color: #fff; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3); }
    .form-grid { display: grid; gap: 14px; }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .form-group { display: grid; gap: 4px; }
    .label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; }
    .input { padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: #1e293b; color: #fff; font-size: 13px; width: 100%; }
    .badge-pill { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; }
  `;

  // 1. Auditoria de Cadastros Incompletos
  console.log('Gerando Print 1: Auditoria de Cadastros Incompletos...');
  await page.setContent(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><style>${cssBase}</style></head><body>
      <div class="modal-overlay">
        <div class="modal-box">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">
            <div>
              <span class="kicker">KYTTO AUTO FISCAL • AUDITORIA PREVENTIVA</span>
              <h2 style="font-size:20px; font-weight:800; color:#fff; margin-top:2px;">Auditoria de Cadastros Incompletos & Conformidade Fiscal</h2>
            </div>
            <button class="btn" style="padding:6px 12px;">✕ Fechar</button>
          </div>

          <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; margin:20px 0;">
            <div style="background:rgba(239, 68, 68, 0.12); border:2px solid #ef4444; border-radius:12px; padding:14px; text-align:center;">
              <div style="font-size:11px; font-weight:800; color:#ef4444;">SEM NCM</div>
              <div style="font-size:24px; font-weight:900; color:#fff; margin-top:4px;">0</div>
              <div style="font-size:10px; color:#94a3b8; margin-top:2px;">100% Saneado</div>
            </div>
            <div style="background:rgba(245, 158, 11, 0.12); border:1px solid rgba(245, 158, 11, 0.3); border-radius:12px; padding:14px; text-align:center;">
              <div style="font-size:11px; font-weight:800; color:#f59e0b;">SEM CUSTO (R$ 0)</div>
              <div style="font-size:24px; font-weight:900; color:#fff; margin-top:4px;">0</div>
              <div style="font-size:10px; color:#94a3b8; margin-top:2px;">DRE Confiável</div>
            </div>
            <div style="background:rgba(2, 132, 199, 0.12); border:1px solid rgba(2, 132, 199, 0.3); border-radius:12px; padding:14px; text-align:center;">
              <div style="font-size:11px; font-weight:800; color:#38bdf8;">SEM EAN / BARRAS</div>
              <div style="font-size:24px; font-weight:900; color:#fff; margin-top:4px;">0</div>
              <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Bipagem PDV OK</div>
            </div>
            <div style="background:rgba(100, 116, 139, 0.12); border:1px solid rgba(100, 116, 139, 0.3); border-radius:12px; padding:14px; text-align:center;">
              <div style="font-size:11px; font-weight:800; color:#94a3b8;">SEM TIPO</div>
              <div style="font-size:24px; font-weight:900; color:#fff; margin-top:4px;">0</div>
              <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Classificado</div>
            </div>
            <div style="background:rgba(168, 85, 247, 0.12); border:1px solid rgba(168, 85, 247, 0.3); border-radius:12px; padding:14px; text-align:center;">
              <div style="font-size:11px; font-weight:800; color:#c084fc;">DUPLICADOS</div>
              <div style="font-size:24px; font-weight:900; color:#fff; margin-top:4px;">0</div>
              <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Catálogo Único</div>
            </div>
          </div>

          <div style="background:#1e293b; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; text-align:center;">
            <div style="font-size:36px; margin-bottom:8px;">✅</div>
            <h3 style="font-size:16px; font-weight:800; color:#10b981;">Catálogo e Estoque 100% Homologados e Conformes!</h3>
            <p style="font-size:13px; color:#94a3b8; margin-top:6px; max-width:600px; margin-left:auto; margin-right:auto;">
              Todos os produtos ativos possuem NCM oficial vinculado, custos médios apurados, código de barras para PDV e regras fiscais do Simples Nacional validadas contra a SEFAZ-MT e Sefin Nacional.
            </p>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:18px;">
            <button class="btn btn-primary">Concluir Auditoria</button>
          </div>
        </div>
      </div>
    </body></html>
  `);
  await page.screenshot({ path: path.join(pastaSaida, '01_auditoria_cadastros_incompletos.png') });

  // 2. Ficha do Item — Aba Geral
  console.log('Gerando Print 2: Ficha do Item (Aba Geral)...');
  await page.setContent(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><style>${cssBase}</style></head><body>
      <div class="modal-overlay">
        <div class="modal-box">
          <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:14px 18px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
            <div>
              <span class="kicker">SKU: POM-001 • ID: itm-dino-001</span>
              <h2 style="font-size:18px; font-weight:800; color:#fff; margin-top:2px;">Pomada Modeladora Efeito Matte 120g</h2>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11px; font-weight:800; color:#94a3b8;">TIPO:</span>
              <span style="background:#0284c7; color:#fff; padding:4px 10px; border-radius:8px; font-size:12px; font-weight:800;">📦 Produto (Revenda)</span>
            </div>
          </div>

          <div class="tabs-bar">
            <button class="tab-btn active">1. Dados Gerais & EAN</button>
            <button class="tab-btn">2. Regras Fiscais (NCM/CEST)</button>
            <button class="tab-btn">3. Estoque, Custos & Margem</button>
            <button class="tab-btn">4. Canais de Venda</button>
            <button class="tab-btn">5. Histórico & Auditoria</button>
          </div>

          <div class="form-grid">
            <div class="form-row-2">
              <div class="form-group">
                <label class="label">Nome Completo do Item *</label>
                <input class="input" value="Pomada Modeladora Efeito Matte 120g" />
              </div>
              <div class="form-group">
                <label class="label">SKU / Código Interno *</label>
                <input class="input" value="POM-001" style="font-weight:700; color:#38bdf8;" />
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label class="label">Categoria</label>
                <input class="input" value="Finalizadores e Pomadas" />
              </div>
              <div class="form-group">
                <label class="label">Marca / Linha</label>
                <input class="input" value="Dino Barber Signature" />
              </div>
              <div class="form-group">
                <label class="label">Unidade Comercial</label>
                <input class="input" value="UN — Unidade" />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="label">Código de Barras / GTIN / EAN</label>
                <input class="input" value="7898956241012" style="letter-spacing:1px; font-weight:700;" />
                <span style="font-size:10px; color:#94a3b8;">Validado com dígito verificador GS1 Brasil</span>
              </div>
              <div class="form-group">
                <label class="label">Conteúdo Líquido</label>
                <input class="input" value="Pote 120g com tampa rosqueável" />
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
            <button class="btn">Cancelar</button>
            <button class="btn btn-primary">💾 Salvar Ficha do Item</button>
          </div>
        </div>
      </div>
    </body></html>
  `);
  await page.screenshot({ path: path.join(pastaSaida, '02_ficha_item_aba_geral.png') });

  // 3. Ficha do Item — Aba Fiscal
  console.log('Gerando Print 3: Ficha do Item (Aba Fiscal)...');
  await page.setContent(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><style>${cssBase}</style></head><body>
      <div class="modal-overlay">
        <div class="modal-box">
          <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:14px 18px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
            <div>
              <span class="kicker">SKU: POM-001 • DADOS FISCAIS</span>
              <h2 style="font-size:18px; font-weight:800; color:#fff; margin-top:2px;">Pomada Modeladora Efeito Matte 120g</h2>
            </div>
            <span style="background:rgba(16, 185, 129, 0.15); border:1px solid #10b981; color:#10b981; padding:4px 10px; border-radius:8px; font-size:11px; font-weight:800;">
              ✓ NFC-e / NF-e Pronta
            </span>
          </div>

          <div class="tabs-bar">
            <button class="tab-btn">1. Dados Gerais & EAN</button>
            <button class="tab-btn active">2. Regras Fiscais (NCM/CEST)</button>
            <button class="tab-btn">3. Estoque, Custos & Margem</button>
            <button class="tab-btn">4. Canais de Venda</button>
            <button class="tab-btn">5. Histórico & Auditoria</button>
          </div>

          <div class="form-grid">
            <div style="background:rgba(2, 132, 199, 0.1); border:1px solid rgba(2, 132, 199, 0.3); border-radius:10px; padding:12px 16px; font-size:12px;">
              <strong>Classificação SEFAZ-MT / Simples Nacional:</strong> Cosméticos e preparações capilares enquadram-se na NCM 3305.90.00 com Substituição Tributária (CEST 20.020.00) e CSOSN 500.
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label class="label">NCM (8 Dígitos) *</label>
                <input class="input" value="3305.90.00" style="font-weight:800; color:#38bdf8;" />
                <span style="font-size:10px; color:#10b981;">✓ NCM Oficial da TIPI/Receita Federal</span>
              </div>
              <div class="form-group">
                <label class="label">CEST (Substituição Tributária)</label>
                <input class="input" value="20.020.00" style="font-weight:700;" />
                <span style="font-size:10px; color:#94a3b8;">Convênio ICMS 142/2018</span>
              </div>
              <div class="form-group">
                <label class="label">Origem da Mercadoria</label>
                <input class="input" value="0 — Nacional" />
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label class="label">CFOP Padrão</label>
                <input class="input" value="5405 — Venda c/ ST Retido Anteriormente" />
              </div>
              <div class="form-group">
                <label class="label">CSOSN (Simples Nacional)</label>
                <input class="input" value="500 — ICMS cobrado por ST" />
              </div>
              <div class="form-group">
                <label class="label">CST PIS / COFINS</label>
                <input class="input" value="49 — Outras Operações de Saída" />
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
            <button class="btn">Cancelar</button>
            <button class="btn btn-primary">💾 Salvar Ficha do Item</button>
          </div>
        </div>
      </div>
    </body></html>
  `);
  await page.screenshot({ path: path.join(pastaSaida, '03_ficha_item_aba_fiscal.png') });

  // 4. Ficha do Item — Aba Estoque e Custos
  console.log('Gerando Print 4: Ficha do Item (Aba Estoque e Custos)...');
  await page.setContent(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><style>${cssBase}</style></head><body>
      <div class="modal-overlay">
        <div class="modal-box">
          <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:14px 18px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
            <div>
              <span class="kicker">SKU: POM-001 • ESTOQUE & DRE</span>
              <h2 style="font-size:18px; font-weight:800; color:#fff; margin-top:2px;">Pomada Modeladora Efeito Matte 120g</h2>
            </div>
            <span style="background:rgba(16, 185, 129, 0.15); border:1px solid #10b981; color:#10b981; padding:4px 10px; border-radius:8px; font-size:11px; font-weight:800;">
              Saldo: 42 UN
            </span>
          </div>

          <div class="tabs-bar">
            <button class="tab-btn">1. Dados Gerais & EAN</button>
            <button class="tab-btn">2. Regras Fiscais (NCM/CEST)</button>
            <button class="tab-btn active">3. Estoque, Custos & Margem</button>
            <button class="tab-btn">4. Canais de Venda</button>
            <button class="tab-btn">5. Histórico & Auditoria</button>
          </div>

          <div class="form-grid">
            <div class="form-row-3">
              <div class="form-group">
                <label class="label">Saldo Físico em Prateleira</label>
                <input class="input" value="42 UN" style="font-weight:900; font-size:16px; color:#fff;" />
              </div>
              <div class="form-group">
                <label class="label">Ponto de Reposição (Mínimo)</label>
                <input class="input" value="10 UN" style="font-weight:700;" />
              </div>
              <div class="form-group">
                <label class="label">Trava Venda Sem Estoque</label>
                <input class="input" value="Bloquear no Caixa / Comanda (Padrão)" style="color:#ef4444; font-weight:700;" />
              </div>
            </div>

            <div style="background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:18px; display:grid; grid-template-columns:repeat(4, 1fr); gap:14px; margin-top:4px;">
              <div>
                <label class="label">Último Custo de Compra</label>
                <div style="font-size:20px; font-weight:800; color:#fff; margin-top:4px;">R$ 22,00</div>
                <div style="font-size:11px; color:#94a3b8;">NF-e 1234 (05/11)</div>
              </div>
              <div>
                <label class="label">Custo Médio Ponderado</label>
                <div style="font-size:20px; font-weight:800; color:#38bdf8; margin-top:4px;">R$ 24,50</div>
                <div style="font-size:11px; color:#94a3b8;">Base para DRE e CMV</div>
              </div>
              <div>
                <label class="label">Preço de Venda Balcão</label>
                <div style="font-size:20px; font-weight:800; color:#10b981; margin-top:4px;">R$ 65,00</div>
                <div style="font-size:11px; color:#94a3b8;">Tabela Oficial Barbearia</div>
              </div>
              <div>
                <label class="label">Margem Bruta Unitária</label>
                <div style="font-size:22px; font-weight:900; color:#10b981; margin-top:4px;">62.3%</div>
                <div style="font-size:11px; color:#94a3b8;">Lucro: R$ 40,50 / un</div>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
            <button class="btn">Cancelar</button>
            <button class="btn btn-primary">💾 Salvar Ficha do Item</button>
          </div>
        </div>
      </div>
    </body></html>
  `);
  await page.screenshot({ path: path.join(pastaSaida, '04_ficha_item_aba_estoque_custo.png') });

  // 5. Catálogo Oficial AGRO OPEN TTC Classificado
  console.log('Gerando Print 5: Catálogo Oficial AGRO OPEN TTC Classificado...');
  await page.setContent(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><style>${cssBase}</style></head><body>
      <div class="header-card">
        <span class="kicker">KYTTO COMMERCE CORE • CATÁLOGO & FISCAL MULTIEMPRESA</span>
        <div class="title-row">
          <div>
            <h1 class="title">AGRO OPEN TTC — Catálogo Oficial Classificado (16 Itens)</h1>
            <p class="sub">CNPJ 48.094.075/0001-38 • Simples Nacional • Enquadramento NCM Fiel à Planilha Oficial</p>
          </div>
          <span style="background:#10b981; color:#fff; padding:6px 14px; border-radius:999px; font-size:12px; font-weight:800;">
            ✓ 16/16 Classificados (100%)
          </span>
        </div>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#0f172a; border-bottom:1px solid rgba(255,255,255,0.1);">
              <th style="padding:12px 14px; text-align:left; color:#94a3b8;">SKU</th>
              <th style="padding:12px 14px; text-align:left; color:#94a3b8;">DESCRIÇÃO OFICIAL DO PRODUTO</th>
              <th style="padding:12px 14px; text-align:left; color:#94a3b8;">NCM OFICIAL</th>
              <th style="padding:12px 14px; text-align:left; color:#94a3b8;">CFOP / CSOSN</th>
              <th style="padding:12px 14px; text-align:left; color:#94a3b8;">PIS / COFINS</th>
              <th style="padding:12px 14px; text-align:center; color:#94a3b8;">STATUS FISCAL</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-001</td><td style="padding:10px 14px; font-weight:700;">Camiseta Oficial Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6109.10.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-002</td><td style="padding:10px 14px; font-weight:700;">Boné Oficial Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6505.00.90</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-003</td><td style="padding:10px 14px; font-weight:700;">Camiseta Premium Monograma AO</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6109.10.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-004</td><td style="padding:10px 14px; font-weight:700;">Boné Premium Monograma AO</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6505.00.90</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-005</td><td style="padding:10px 14px; font-weight:700;">Meias Esportivas Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6115.95.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-006</td><td style="padding:10px 14px; font-weight:700;">Sacola Tote Bag Oficial</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">4202.92.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-007</td><td style="padding:10px 14px; font-weight:700;">Garrafa Squeeze 750ml</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">3924.10.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-008</td><td style="padding:10px 14px; font-weight:700;">Toalhinha de Tênis 50×90cm</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6302.60.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-009</td><td style="padding:10px 14px; font-weight:700;">Pulseira de Identificação</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">3926.90.90</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-010</td><td style="padding:10px 14px; font-weight:700;">Munhequeira Oficial (Par)</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6117.80.10</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-011</td><td style="padding:10px 14px; font-weight:700;">Bandana Headband Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6117.10.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-012</td><td style="padding:10px 14px; font-weight:700;">Grip / Overgrip Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">9506.59.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-013</td><td style="padding:10px 14px; font-weight:700;">Mochila Esportiva Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">4202.92.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-014</td><td style="padding:10px 14px; font-weight:700;">Raqueteira Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">4202.92.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-015</td><td style="padding:10px 14px; font-weight:700;">Toalha Grande Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6302.60.00</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
            <tr><td style="padding:10px 14px; font-weight:800; color:#38bdf8;">AOT-016</td><td style="padding:10px 14px; font-weight:700;">Viseira Agro Open</td><td style="padding:10px 14px; font-family:monospace; color:#10b981;">6505.00.90</td><td style="padding:10px 14px;">5102 / 102</td><td style="padding:10px 14px;">49 / 49</td><td style="text-align:center;"><span class="badge-pill" style="background:rgba(16,185,129,0.15); color:#10b981;">Conforme</span></td></tr>
          </tbody>
        </table>
      </div>
    </body></html>
  `);
  await page.screenshot({ path: path.join(pastaSaida, '05_catalogo_agro_open_classificado.png') });

  await browser.close();
  console.log('Todas as capturas de tela foram geradas com sucesso!');
}

main().catch(console.error);
