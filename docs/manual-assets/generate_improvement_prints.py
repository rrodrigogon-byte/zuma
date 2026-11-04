import subprocess
import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs('/home/ubuntu/manual-assets', exist_ok=True)

# 1. HTML for Comanda with Quantity Controls
html_comanda = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    padding: 24px;
    background: #090d16;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    box-sizing: border-box;
  }
  .card {
    width: 480px;
    background: #111827;
    border: 1px solid #1f293d;
    border-radius: 20px;
    padding: 22px;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    color: #f8fafc;
    position: relative;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding-bottom: 12px;
  }
  .header h3 { margin: 0; font-size: 17px; font-weight: 700; }
  .close-badge {
    background: #1e293b;
    color: #94a3b8;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 12px;
  }
  .client-box {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 16px;
  }
  .client-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
  .client-name { font-size: 15px; font-weight: 700; color: #38bdf8; }
  .cart-title { font-size: 13px; font-weight: 800; margin-bottom: 10px; color: #e2e8f0; display: flex; justify-content: space-between; }
  
  .cart-item {
    background: #1e293b;
    border: 1.5px solid #3b82f6;
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
  }
  .item-info { flex: 1; }
  .item-name { font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
  .item-meta { font-size: 12px; color: #94a3b8; }
  .item-subtotal { color: #10b981; font-weight: 800; font-size: 14px; }
  .qty-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn-qty {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid #475569;
    background: #0f172a;
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .qty-input {
    width: 50px;
    height: 36px;
    border-radius: 10px;
    border: 2px solid #3b82f6;
    background: #090d16;
    color: #38bdf8;
    font-size: 16px;
    font-weight: 800;
    text-align: center;
  }
  .cart-item-normal {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 12px 14px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .total-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 16px;
  }
  .total-label { font-size: 13px; color: #94a3b8; }
  .total-val { font-size: 18px; font-weight: 800; color: #10b981; }
  .btn-save {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: #fff;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }
  .callout-tag {
    position: absolute;
    top: -12px;
    right: 16px;
    background: #2563eb;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h3>Lançamento em Comanda</h3>
        <span style="font-size:12px; color:#94a3b8;">Atendimento: Nati Minanis Dobler</span>
      </div>
      <span class="close-badge">Modo Barbeiro</span>
    </div>

    <div class="client-box">
      <div class="client-label">Cliente Selecionado</div>
      <div class="client-name">👤 Guilherme</div>
    </div>

    <div class="cart-title">
      <span>Itens na Comanda</span>
      <span style="color:#38bdf8;">7 procedimentos</span>
    </div>

    <!-- Normal item -->
    <div class="cart-item-normal">
      <div class="item-info">
        <div class="item-name">CORTE PREMIUM (BRUNO OU NATI)</div>
        <div class="item-meta">R$ 100,00 un · <span style="color:#10b981; font-weight:700;">R$ 100,00</span> (1x)</div>
      </div>
      <span style="font-size:11px; background:#334155; padding:3px 8px; border-radius:6px; color:#cbd5e1;">Padrão</span>
    </div>

    <!-- Highlighted Multi-extra item -->
    <div class="cart-item">
      <div class="callout-tag">★ NOVO: MÚLTIPLOS EXTRAS</div>
      <div class="item-info">
        <div class="item-name">Limpeza de Pele</div>
        <div class="item-meta">R$ 60,00 un · Subtotal: <span class="item-subtotal">R$ 360,00</span></div>
      </div>
      <div class="qty-controls">
        <div class="btn-qty">−</div>
        <div class="qty-input">6</div>
        <div class="btn-qty">+</div>
      </div>
    </div>

    <div class="total-bar">
      <div>
        <div class="total-label">Total da Comanda</div>
        <div style="font-size:11px; color:#64748b;">1 Corte + 6 Limpezas de Pele</div>
      </div>
      <div class="total-val">R$ 460,00</div>
    </div>

    <button class="btn-save">Salvar comanda para o caixa</button>
  </div>
</body>
</html>
"""

with open('/tmp/print_comanda.html', 'w') as f:
    f.write(html_comanda)

subprocess.run([
    'chromium', '--headless', '--no-sandbox', '--disable-gpu',
    '--window-size=580,720',
    '--screenshot=/home/ubuntu/manual-assets/print_comanda_multiplos_extras.png',
    '/tmp/print_comanda.html'
], check=True)
print("Print 1 (Comanda) generated successfully.")

# 2. HTML for Admin Dashboard Modal with Quantity Column
html_admin = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    padding: 24px;
    background: #090d16;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    box-sizing: border-box;
  }
  .modal {
    width: 780px;
    background: #111827;
    border: 1px solid #1f293d;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
    color: #f8fafc;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    border-bottom: 1px solid #1f293d;
    padding-bottom: 16px;
  }
  .title { font-size: 18px; font-weight: 700; color: #f8fafc; }
  .subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .badges { display: flex; gap: 8px; margin-top: 10px; }
  .badge-padrao { background: #1e293b; color: #94a3b8; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; }
  .badge-extra { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 13px;
  }
  th {
    text-align: left;
    padding: 10px 12px;
    background: #0f172a;
    color: #64748b;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11px;
    border-bottom: 1px solid #1f293d;
  }
  td {
    padding: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    color: #cbd5e1;
  }
  tr.highlight {
    background: rgba(59, 130, 246, 0.08);
    border-left: 3px solid #3b82f6;
  }
  .tag-padrao {
    background: #1e293b;
    color: #94a3b8;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
  }
  .tag-extra {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
  }
  .badge-qty {
    display: inline-block;
    padding: 3px 9px;
    background: #1e293b;
    border: 1.5px solid #3b82f6;
    color: #60a5fa;
    border-radius: 8px;
    font-weight: 800;
    font-size: 13px;
  }
  .footer-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    border: 1px solid #1e293d;
    border-radius: 12px;
    padding: 14px 18px;
    margin-top: 18px;
  }
</style>
</head>
<body>
  <div class="modal">
    <div class="header">
      <div>
        <div class="title">Detalhes da Produção — Nati</div>
        <div class="subtitle">Data: 03/11/2026 · Unidade Matriz Dino Barbearia</div>
        <div class="badges">
          <span class="badge-padrao">14 Procedimentos Padrão</span>
          <span class="badge-extra">★ 6 Serviços Extras Computados</span>
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Realizado</span>
        <div style="font-size: 20px; font-weight: 800; color: #f8fafc;">20 procedimentos</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Serviço / Procedimento</th>
          <th style="text-align: center;">Qtd</th>
          <th style="text-align: right;">Valor Total</th>
          <th style="text-align: center;">Classificação</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Alceu Tocchetto (Dino)</td>
          <td>CORTE PREMIUM (BRUNO OU NATI)</td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">R$ 100,00</td>
          <td style="text-align: center;"><span class="tag-padrao">Padrão</span></td>
        </tr>
        <tr>
          <td>Heitor Campos</td>
          <td>BARBA PREMIUM (BRUNO OU NATI)</td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">R$ 100,00</td>
          <td style="text-align: center;"><span class="tag-padrao">Padrão</span></td>
        </tr>
        <tr>
          <td>Joao Carlos Peterson</td>
          <td>CORTE E BARBA (BRUNO OU NATI)</td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">R$ 200,00</td>
          <td style="text-align: center;"><span class="tag-padrao">Padrão</span></td>
        </tr>
        <tr>
          <td>Guilherme</td>
          <td>CORTE PREMIUM (BRUNO OU NATI)</td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">R$ 100,00</td>
          <td style="text-align: center;"><span class="tag-padrao">Padrão</span></td>
        </tr>
        <!-- Highlighted Multi-extra row -->
        <tr class="highlight">
          <td><strong style="color:#f8fafc;">Guilherme</strong></td>
          <td>
            <strong style="color:#38bdf8;">Limpeza de Pele</strong>
            <div style="font-size: 11px; color: #94a3b8;">6x de R$ 60,00 cada</div>
          </td>
          <td style="text-align: center;"><span class="badge-qty">6</span></td>
          <td style="text-align: right;"><strong style="color:#10b981; font-size:14px;">R$ 360,00</strong></td>
          <td style="text-align: center;"><span class="tag-extra">Extra (6x)</span></td>
        </tr>
      </tbody>
    </table>

    <div class="footer-summary">
      <div style="font-size: 12px; color: #94a3b8;">
        Auditoria de Metas: Todas as 6 unidades de extra foram computadas na meta diária (6/7 - 86%) e no ranking semanal.
      </div>
      <div style="font-size: 15px; font-weight: 800; color: #10b981;">
        Subtotal Extras: R$ 360,00
      </div>
    </div>
  </div>
</body>
</html>
"""

with open('/tmp/print_admin.html', 'w') as f:
    f.write(html_admin)

subprocess.run([
    'chromium', '--headless', '--no-sandbox', '--disable-gpu',
    '--window-size=860,600',
    '--screenshot=/home/ubuntu/manual-assets/print_admin_detalhes_roleta_nati.png',
    '/tmp/print_admin.html'
], check=True)
print("Print 2 (Admin) generated successfully.")

# 3. Process Live Metas Screenshot and Add Highlighting
im_metas = Image.open('/home/ubuntu/screenshots/kytto_br_2026-11-04_00-11-09_7395.webp')
# Crop to the central card
w, h = im_metas.size
crop_box = (int(w * 0.15), 60, int(w * 0.85), int(h * 0.95))
im_cropped = im_metas.crop(crop_box)
im_cropped.save('/home/ubuntu/manual-assets/print_metas_extras_nati.png')
print("Print 3 (Metas) cropped and saved.")
