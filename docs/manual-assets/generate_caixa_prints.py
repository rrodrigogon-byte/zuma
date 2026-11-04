import subprocess
import os

os.makedirs('/home/ubuntu/manual-assets', exist_ok=True)

# 1. HTML para o Painel de Conferência AVEC e Botão Reabrir
html_conferencia = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; margin: 0; padding: 24px; color: #1e293b; display: flex; justify-content: center; }
  .wrapper { width: 880px; background: #ffffff; border-radius: 14px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); overflow: hidden; border: 1px solid #cbd5e1; }
  .header { padding: 18px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; }
  .avatar-box { display: flex; gap: 16px; align-items: center; }
  .avatar { width: 56px; height: 56px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 26px; border: 2px solid #cbd5e1; color: #64748b; }
  .user-info h3 { margin: 0; font-size: 17px; color: #0f172a; }
  .user-info .email { font-size: 13px; color: #64748b; margin-top: 2px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 12px; color: #475569; margin-top: 8px; }
  .meta-grid strong { color: #1e293b; }
  .top-badge { background: #f1f5f9; color: #475569; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid #cbd5e1; }
  .mov-box { background: #f8fafc; padding: 12px 24px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; }
  .mov-box strong { color: #334155; }
  .table-box { padding: 18px 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #cbd5e1; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
  .sub-item td { padding: 6px 12px 6px 28px; color: #475569; font-size: 13px; }
  .total-row td { border-top: 2px solid #cbd5e1; font-weight: 800; font-size: 15px; background: #f8fafc; }
  .footer-bar { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .btn-reabrir { background: #dc2626; color: #ffffff; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(220,38,38,0.25); }
  .callout-tag { background: #fee2e2; border: 1px solid #fca5a5; color: #b91c1c; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="avatar-box">
      <div class="avatar">👤</div>
      <div class="user-info">
        <h3>Responsável: <span style="color:#2563eb">Dino</span></h3>
        <div class="email">E-mail: guicunha136@gmail.com</div>
        <div class="meta-grid">
          <div><strong>Abertura:</strong> 27/10/2026 17:23:34</div>
          <div><strong>Fechamento:</strong> 29/10/2026 09:55:49</div>
          <div><strong>Data modificação:</strong> 29/10/2026 09:55:51</div>
          <div><strong>Última modificação:</strong> Dino</div>
          <div><strong>Valor Inicial (Dinheiro):</strong> 0,00</div>
          <div><strong>Valor Inicial (Cheque):</strong> 0,00</div>
        </div>
      </div>
    </div>
    <div>
      <div class="top-badge">✓ Caixa Fechado</div>
    </div>
  </div>

  <div class="mov-box">
    <strong>Sangrias e Suprimentos:</strong> Nenhuma movimentação registrada
  </div>

  <div class="table-box">
    <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
      💡 Padrão Oficial AVEC com agrupamento de bandeiras e drilldown automático por clique.
    </div>
    <table>
      <thead>
        <tr>
          <th>Pagamentos</th>
          <th style="text-align:right">Sist.</th>
          <th style="text-align:right">Dif.</th>
        </tr>
      </thead>
      <tbody>
        <tr style="font-weight:600">
          <td>Dinheiro</td>
          <td style="text-align:right">0,00</td>
          <td style="text-align:right;color:#64748b">0,00</td>
        </tr>
        <tr style="font-weight:600">
          <td>Cartão Crédito (4)</td>
          <td style="text-align:right">360,00</td>
          <td style="text-align:right;color:#64748b">0,00</td>
        </tr>
        <tr class="sub-item">
          <td>— MasterCard (4)</td>
          <td style="text-align:right">360,00</td>
          <td style="text-align:right;color:#94a3b8">—</td>
        </tr>
        <tr style="font-weight:600; background:#f0fdf4">
          <td>Cartão Débito (5)</td>
          <td style="text-align:right; color:#15803d">1.378,00</td>
          <td style="text-align:right;color:#64748b">0,00</td>
        </tr>
        <tr class="sub-item" style="background:#f0fdf4">
          <td>— MasterCard (3)</td>
          <td style="text-align:right">1.246,00</td>
          <td style="text-align:right;color:#94a3b8">—</td>
        </tr>
        <tr class="sub-item" style="background:#f0fdf4">
          <td>— Visa (2)</td>
          <td style="text-align:right">132,00</td>
          <td style="text-align:right;color:#94a3b8">—</td>
        </tr>
        <tr style="color:#64748b">
          <td>Cheque</td>
          <td style="text-align:right">0,00</td>
          <td style="text-align:right">0,00</td>
        </tr>
        <tr style="color:#64748b">
          <td>Boleto</td>
          <td style="text-align:right">0,00</td>
          <td style="text-align:right">0,00</td>
        </tr>
        <tr style="font-weight:600">
          <td>Pix (3)</td>
          <td style="text-align:right">500,00</td>
          <td style="text-align:right;color:#64748b">0,00</td>
        </tr>
        <tr class="total-row">
          <td>TOTAL FATURADO</td>
          <td style="text-align:right; color:#2563eb">2.238,00</td>
          <td style="text-align:right;color:#64748b">0,00</td>
        </tr>
        <tr style="color:#64748b">
          <td>Crédito Utilizados</td>
          <td style="text-align:right">100,00</td>
          <td style="text-align:right">0,00</td>
        </tr>
        <tr style="color:#64748b">
          <td>Dívidas / Em Conta</td>
          <td style="text-align:right">-450,00</td>
          <td style="text-align:right">0,00</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer-bar">
    <div class="callout-tag">
      🔓 Para correções de comandas ou formas de pagamento, utilize a reabertura
    </div>
    <button class="btn-reabrir">
      🔓 Reabrir Caixa
    </button>
  </div>
</div>
</body>
</html>
"""

with open('/tmp/conferencia_avec.html', 'w', encoding='utf-8') as f:
    f.write(html_conferencia)

cmd1 = 'chromium --headless --no-sandbox --disable-gpu --window-size=940,780 --screenshot=/home/ubuntu/manual-assets/print_caixa_conferencia_avec.png /tmp/conferencia_avec.html'
subprocess.run(cmd1, shell=True, check=True)
print('print_caixa_conferencia_avec.png generated!')

# 2. HTML para o Drilldown de Comandas por Meio de Pagamento
html_drilldown = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; margin: 0; padding: 24px; color: #1e293b; display: flex; justify-content: center; }
  .modal { width: 680px; background: #ffffff; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden; border: 1px solid #cbd5e1; }
  .modal-header { background: #2563eb; color: #ffffff; padding: 18px 24px; }
  .modal-header h3 { margin: 0; font-size: 17px; font-weight: 800; }
  .modal-header .sub { font-size: 13px; opacity: 0.9; margin-top: 3px; }
  .modal-header .filter-tag { font-size: 15px; font-weight: 700; margin-top: 6px; }
  .modal-body { padding: 20px 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; }
  .total-tr td { border-top: 2px solid #cbd5e1; font-weight: 800; font-size: 15px; }
  .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .btn-cancelar { background: #e2e8f0; color: #334155; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; }
  .badge-bandeira { font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 4px; margin-left: 8px; font-weight: 600; }
  .btn-corrigir { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; color: #2563eb; }
</style>
</head>
<body>
<div class="modal">
  <div class="modal-header">
    <h3>Comandas do caixa responsável: Dino</h3>
    <div class="sub">Dia: 27</div>
    <div class="filter-tag">Por: Cartão Débito /</div>
  </div>
  <div class="modal-body">
    <table>
      <thead>
        <tr>
          <th>Título</th>
          <th style="text-align:right">Valor (R$)</th>
          <th style="text-align:center">Ação</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Comanda Nº648 - Avulso <span class="badge-bandeira">MasterCard</span></td>
          <td style="text-align:right">21,00</td>
          <td style="text-align:center"><button class="btn-corrigir">✏️ Corrigir</button></td>
        </tr>
        <tr>
          <td>Comanda Nº649 - Avulso <span class="badge-bandeira">MasterCard</span></td>
          <td style="text-align:right">7,00</td>
          <td style="text-align:center"><button class="btn-corrigir">✏️ Corrigir</button></td>
        </tr>
        <tr>
          <td>Comanda Nº662 - Lucas <span class="badge-bandeira">MasterCard</span></td>
          <td style="text-align:right">1.218,00</td>
          <td style="text-align:center"><button class="btn-corrigir">✏️ Corrigir</button></td>
        </tr>
        <tr>
          <td>Comanda Nº646 - Avulso <span class="badge-bandeira">Visa</span></td>
          <td style="text-align:right">12,00</td>
          <td style="text-align:center"><button class="btn-corrigir">✏️ Corrigir</button></td>
        </tr>
        <tr>
          <td>Comanda Nº652 - Luciomar C Lima <span class="badge-bandeira">Visa</span></td>
          <td style="text-align:right">120,00</td>
          <td style="text-align:center"><button class="btn-corrigir">✏️ Corrigir</button></td>
        </tr>
        <tr class="total-tr">
          <td>Total</td>
          <td style="text-align:right; color:#2563eb">1.378,00</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="modal-footer">
    <span style="font-size:12px; color:#64748b">Com caixa reaberto, é possível trocar meio de pagamento para crédito ou PIX.</span>
    <button class="btn-cancelar">Cancelar</button>
  </div>
</div>
</body>
</html>
"""

with open('/tmp/drilldown_comandas.html', 'w', encoding='utf-8') as f:
    f.write(html_drilldown)

cmd2 = 'chromium --headless --no-sandbox --disable-gpu --window-size=740,560 --screenshot=/home/ubuntu/manual-assets/print_caixa_drilldown_comandas.png /tmp/drilldown_comandas.html'
subprocess.run(cmd2, shell=True, check=True)
print('print_caixa_drilldown_comandas.png generated!')

# 3. HTML para o Relatório Oficial de Fechamento de Caixa
html_relatorio = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: "Courier New", Courier, monospace, Arial; background: #475569; margin: 0; padding: 24px; display: flex; justify-content: center; }
  .sheet { width: 720px; background: #ffffff; padding: 36px 44px; box-shadow: 0 15px 30px rgba(0,0,0,0.3); border: 1px solid #cbd5e1; }
  h2 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: .05em; }
  .print-meta { font-size: 11px; color: #555; margin-top: 4px; }
  h3 { margin: 14px 0 8px 0; font-size: 15px; text-transform: uppercase; }
  .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 12px; border-bottom: 1px solid #000; padding-bottom: 12px; margin-bottom: 14px; }
  .section-title { font-weight: bold; text-transform: uppercase; font-size: 12px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { padding: 4px 6px; text-align: left; border-bottom: 1px solid #000; }
  td { padding: 4px 6px; border-bottom: 1px dotted #ccc; }
  .total-row { border-top: 1px solid #000; font-weight: bold; }
</style>
</head>
<body>
<div class="sheet">
  <h2>Dino barbearia</h2>
  <div class="print-meta">Data da impressão: 03/11/2026 21:29:16</div>

  <h3>Relatório Caixa</h3>
  <div class="grid-info">
    <div><strong>Responsável:</strong> Dino</div>
    <div><strong>Abertura:</strong> 03/11/2026 16:58:53</div>
    <div><strong>E-mail:</strong> guicunha136@gmail.com</div>
    <div><strong>Fechamento:</strong> 03/11/2026 17:55:00</div>
    <div><strong>Valor Inicial (Dinheiro):</strong> 0,00</div>
    <div><strong>Data modificação:</strong> 03/11/2026 17:55:01</div>
    <div><strong>Valor Inicial (Cheque):</strong> 0,00</div>
    <div><strong>Última modificação:</strong> Dino</div>
  </div>

  <div style="margin-bottom: 14px; font-size: 12px;">
    <div class="section-title">Sangrias e Suprimentos</div>
    <div>Nenhuma movimentação</div>
  </div>

  <div style="margin-bottom: 18px;">
    <div class="section-title">Total em Caixa</div>
    <table>
      <tbody>
        <tr><td>Dinheiro</td><td style="text-align:right">0,00</td></tr>
        <tr><td style="padding-left:14px; color:#555">- Sangrias/Supr.</td><td style="text-align:right; color:#555">0,00</td></tr>
        <tr><td>Cartão Crédito</td><td style="text-align:right">1.277,00</td></tr>
        <tr><td style="padding-left:14px; color:#555">- ELO (1)</td><td style="text-align:right; color:#555">100,00</td></tr>
        <tr><td style="padding-left:14px; color:#555">- MasterCard (5)</td><td style="text-align:right; color:#555">997,00</td></tr>
        <tr><td style="padding-left:14px; color:#555">- Visa (1)</td><td style="text-align:right; color:#555">180,00</td></tr>
        <tr><td>Cartão Débito</td><td style="text-align:right">7,00</td></tr>
        <tr><td style="padding-left:14px; color:#555">- MasterCard (1)</td><td style="text-align:right; color:#555">7,00</td></tr>
        <tr><td>Pix (3)</td><td style="text-align:right">245,00</td></tr>
        <tr class="total-row"><td>TOTAL FATURADO</td><td style="text-align:right">1.529,00</td></tr>
        <tr><td>Crédito Utilizado (2)</td><td style="text-align:right">200,00</td></tr>
        <tr><td>Dívidas / Em Conta</td><td style="text-align:right">0,00</td></tr>
      </tbody>
    </table>
  </div>

  <div>
    <div class="section-title" style="border-bottom:1px solid #000; padding-bottom:4px;">Detalhamento de Comandas e Formas de Pagamento</div>
    <table>
      <thead>
        <tr>
          <th>Forma de Pagamento</th>
          <th>Comanda / Cliente</th>
          <th style="text-align:right">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Cartão Crédito ELO</td><td>Comanda Nº15 - Gabriela Souza da Silva</td><td style="text-align:right">100,00</td></tr>
        <tr><td>Cartão Crédito MasterCard</td><td>Comanda Nº11 - Guilherme Garru</td><td style="text-align:right">300,00</td></tr>
        <tr><td>Cartão Crédito MasterCard</td><td>Comanda Nº12 - Wallison</td><td style="text-align:right">80,00</td></tr>
        <tr><td>Cartão Crédito MasterCard</td><td>Comanda Nº13 - Tiago Ramos Lourenço de Carvalho</td><td style="text-align:right">157,00</td></tr>
        <tr><td>Cartão Crédito MasterCard</td><td>Comanda Nº14 - Alisson Dias</td><td style="text-align:right">120,00</td></tr>
        <tr><td>Cartão Crédito MasterCard</td><td>Comanda Nº18 - João Ricardo Jukoski</td><td style="text-align:right">340,00</td></tr>
        <tr><td>Cartão Crédito Visa</td><td>Comanda Nº19 - Bruno Zompero</td><td style="text-align:right">180,00</td></tr>
        <tr><td>Cartão Débito MasterCard</td><td>Comanda Nº8 - Avulso</td><td style="text-align:right">7,00</td></tr>
        <tr><td>Crédito Utilizado</td><td>Comanda Nº14 - Crédito do Cliente: Alisson Dias</td><td style="text-align:right">100,00</td></tr>
        <tr><td>Crédito Utilizado</td><td>Comanda Nº19 - Crédito do Cliente: Bruno Zompero</td><td style="text-align:right">100,00</td></tr>
        <tr><td>Pix</td><td>Comanda Nº10 - Frankei Manuel Lugão Cadenas</td><td style="text-align:right">80,00</td></tr>
        <tr><td>Pix</td><td>Comanda Nº17 - Marcos Willian</td><td style="text-align:right">5,00</td></tr>
        <tr><td>Pix</td><td>Comanda Nº9 - Miguel filho Andreia</td><td style="text-align:right">160,00</td></tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>
"""

with open('/tmp/relatorio_caixa_fechamento.html', 'w', encoding='utf-8') as f:
    f.write(html_relatorio)

cmd3 = 'chromium --headless --no-sandbox --disable-gpu --window-size=780,950 --screenshot=/home/ubuntu/manual-assets/print_caixa_relatorio_fechamento_oficial.png /tmp/relatorio_caixa_fechamento.html'
subprocess.run(cmd3, shell=True, check=True)
print('print_caixa_relatorio_fechamento_oficial.png generated!')
