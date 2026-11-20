import fs from 'fs';

const pilotPath = '/home/ubuntu/agro-open-live/app/public/zuma/pilot.html';
let html = fs.readFileSync(pilotPath, 'utf8');

// 1. Inserir estilos específicos de iOS / iPhone
const cssToInsert = `
/* Suporte e Estilos iOS / iPhone First */
.mobile-controls { display: none; }
.ios-bottom-bar { display: none; }

@media (max-width: 760px) {
  nav > div { display: none !important; }
  .side {
    padding: 8px 12px !important;
    gap: 8px !important;
  }
  .mobile-controls {
    display: flex !important;
    align-items: center;
  }
  .mobile-controls select {
    background: var(--surface2);
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
    outline: none;
    cursor: pointer;
    -webkit-appearance: menulist;
  }
  .ios-bottom-bar {
    display: flex !important;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--surface);
    border-top: 1px solid var(--line);
    padding: 6px 8px calc(8px + env(safe-area-inset-bottom, 0px));
    justify-content: space-around;
    z-index: 99;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 -4px 16px rgba(0,0,0,0.06);
  }
  .ios-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--muted);
    text-decoration: none;
    font-size: 10px;
    font-weight: 700;
    gap: 2px;
    min-width: 55px;
    padding: 2px 4px;
    border-radius: 8px;
    transition: all .15s ease;
  }
  .ios-tab span { font-size: 18px; line-height: 1; }
  .ios-tab.active, .ios-tab.on { color: var(--salmon) !important; font-weight: 800; }
  main {
    padding-bottom: calc(90px + env(safe-area-inset-bottom, 0px)) !important;
  }
}
`;

if (!html.includes('.ios-bottom-bar')) {
  html = html.replace('</style>', cssToInsert + '\n</style>');
  console.log('✅ CSS iOS / iPhone inserido');
}

// 2. Inserir Seletor Dropdown no Header Mobile
const mobileSelectorHtml = `    <div class="mobile-controls">
      <select id="mobileModuleSelect" onchange="location.hash = this.value" aria-label="Navegar entre módulos">
        <optgroup label="Operação &amp; Vendas">
          <option value="#cockpit">⚡ Cockpit Geral</option>
          <option value="#zumi">💬 Zumi Atende (IA)</option>
          <option value="#campanhas">📢 Campanhas</option>
          <option value="#leads">🎯 Captação de Leads</option>
          <option value="#clientes">👥 Clientes CRM</option>
          <option value="#horarios">⏰ Horários Vazios</option>
          <option value="#clube">👑 Clube Zumi</option>
        </optgroup>
        <optgroup label="🚀 Máquina de Vendas &amp; Leads">
          <option value="#trafego">📈 Anúncios &amp; Tráfego IA</option>
          <option value="#indicacao">🎁 Indique e Ganhe Viral</option>
          <option value="#b2b">🌾 Zuma Agro B2B</option>
          <option value="#recuperacao">🛒 Recuperador de Vendas</option>
        </optgroup>
        <optgroup label="Inteligência &amp; Gestão 360°">
          <option value="#mercado">📊 Mercado &amp; IA 360°</option>
          <option value="#engenharia">🍣 Engenharia Cardápio</option>
          <option value="#rfm">👥 Simulador Clientes RFM</option>
          <option value="#clima">🌦️ Clima Tangará</option>
          <option value="#omnichannel">🔄 Hub Omnichannel</option>
          <option value="#financeiro">💰 DRE &amp; Financeiro</option>
          <option value="#estoque">🐟 Estoque Pescados</option>
        </optgroup>
      </select>
    </div>`;

const brandMarker = '<div class="brand">';
if (!html.includes('id="mobileModuleSelect"')) {
  html = html.replace(brandMarker, mobileSelectorHtml + '\n    ' + brandMarker);
  console.log('✅ Seletor mobile inserido');
}

// 3. Inserir link para Login no menu lateral desktop
const loginLinkMarker = '<a href="operacao.html"';
const loginLinkHtml = `<a href="login.html" style="background:#10b98120;color:var(--nori);font-weight:700"><span class="dot" style="background:var(--nori)"></span>👤 Acesso &amp; Login Unificado</a>
      <a href="operacao.html"`;

if (!html.includes('href="login.html"')) {
  html = html.replace(loginLinkMarker, loginLinkHtml);
  console.log('✅ Link para login.html adicionado na barra lateral');
}

// 4. Inserir iOS Bottom Bar antes de </body>
const bottomBarHtml = `
  <!-- ================= BARRA INFERIOR IOS (IPHONE FIRST) ================= -->
  <nav class="ios-bottom-bar" id="iosBottomBar">
    <a href="#cockpit" class="ios-tab" data-tab="cockpit"><span>⚡</span><small>Cockpit</small></a>
    <a href="#zumi" class="ios-tab" data-tab="zumi"><span>💬</span><small>Zumi IA</small></a>
    <a href="#trafego" class="ios-tab" data-tab="trafego"><span>🚀</span><small>Vendas</small></a>
    <a href="#mercado" class="ios-tab" data-tab="mercado"><span>📈</span><small>Gestão</small></a>
    <a href="operacao.html" class="ios-tab"><span>🏪</span><small>Central 360</small></a>
    <a href="login.html" class="ios-tab"><span>👤</span><small>Login</small></a>
  </nav>
`;

if (!html.includes('id="iosBottomBar"')) {
  html = html.replace('</body>', bottomBarHtml + '\n</body>');
  console.log('✅ Barra inferior iOS inserida');
}

// 5. Atualizar função route() para sincronizar o select e a bottom bar
const routeSyncCode = `  const sel = document.getElementById("mobileModuleSelect");
  if (sel) sel.value = "#" + v;
  document.querySelectorAll(".ios-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === v);
  });`;

if (!html.includes('mobileModuleSelect.value')) {
  html = html.replace('window.scrollTo(0, 0);', routeSyncCode + '\n  window.scrollTo(0, 0);');
  console.log('✅ Sincronização mobile inserida em route()');
}

fs.writeFileSync(pilotPath, html, 'utf8');
console.log('🎉 pilot.html atualizado com suporte iPhone!');
