import fs from 'fs';

// 1. Atualizar index.html
const indexPath = '/home/ubuntu/agro-open-live/app/public/zuma/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Adicionar botão login no header
const cartBtnMarker = `        <!-- Cart Button -->
        <button onclick="toggleCartDrawer(true)" 
                class="relative bg-zuma-surface hover:bg-zuma-surfaceLight border border-zuma-border p-2.5 rounded-xl text-white transition-all flex items-center justify-center">`;

const loginBtnHeader = `        <!-- Botão Entrar / Login Operacional -->
        <a href="login.html" title="Acesso &amp; Login Operacional Zuma"
           class="bg-zuma-surface hover:bg-zuma-surfaceLight border border-zuma-border p-2 rounded-xl text-white transition-all flex items-center justify-center text-xs font-bold space-x-1">
          <span>👤</span><span class="hidden sm:inline">Entrar</span>
        </a>
${cartBtnMarker}`;

if (!indexHtml.includes('href="login.html"')) {
  indexHtml = indexHtml.replace(cartBtnMarker, loginBtnHeader);
  console.log('✅ Botão Login adicionado no header de index.html');
}

// Adicionar Barra Inferior iOS em index.html
const bottomBarIndex = `
  <!-- ================= BARRA INFERIOR IOS (IPHONE FIRST) ================= -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-zuma-surface/95 backdrop-blur-md border-t border-zuma-border py-2 px-3 flex justify-around items-center z-40" style="padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px))">
    <button onclick="switchTab('cardapio')" class="flex flex-col items-center text-zuma-salmon font-bold text-[10px]">
      <span class="text-lg">🍣</span><span>Cardápio</span>
    </button>
    <button onclick="switchTab('ia-orcamento')" class="flex flex-col items-center text-zuma-muted hover:text-white font-bold text-[10px]">
      <span class="text-lg">🤖</span><span>Zumi IA</span>
    </button>
    <button onclick="switchTab('indique-ganhe')" class="flex flex-col items-center text-zuma-muted hover:text-white font-bold text-[10px]">
      <span class="text-lg">🎁</span><span>Indique</span>
    </button>
    <button onclick="toggleCartDrawer(true)" class="flex flex-col items-center text-zuma-muted hover:text-white font-bold text-[10px] relative">
      <span class="text-lg">🛍️</span><span>Carrinho</span>
      <span id="cart-badge-bottom" class="absolute -top-1 right-2 bg-zuma-crimson text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">0</span>
    </button>
    <a href="login.html" class="flex flex-col items-center text-zuma-muted hover:text-white font-bold text-[10px]">
      <span class="text-lg">👤</span><span>Entrar</span>
    </a>
  </nav>
`;

if (!indexHtml.includes('id="cart-badge-bottom"')) {
  indexHtml = indexHtml.replace('</body>', bottomBarIndex + '\n</body>');
  console.log('✅ Barra inferior iOS inserida em index.html');
}

// Atualizar sincronização do badge do carrinho com a barra inferior
const badgeSyncMarker = "document.getElementById('cart-badge').textContent = totalItens;";
const badgeSyncNew = `document.getElementById('cart-badge').textContent = totalItens;
      const bBottom = document.getElementById('cart-badge-bottom');
      if (bBottom) bBottom.textContent = totalItens;`;

if (!indexHtml.includes('cart-badge-bottom')) {
  indexHtml = indexHtml.replace(badgeSyncMarker, badgeSyncNew);
}

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('🎉 index.html atualizado!');

// 2. Atualizar operacao.html
const opPath = '/home/ubuntu/agro-open-live/app/public/zuma/operacao.html';
let opHtml = fs.readFileSync(opPath, 'utf8');

// Adicionar botão login na topbar de operacao.html
const opQuickMarker = `<a href="pilot.html" target="_blank" class="hidden md:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 transition-all">
          <span>🚀</span><span>Zuma Pilot IA</span>
        </a>`;

const opLoginBtn = `${opQuickMarker}
        <a href="login.html" title="Trocar de Usuário / Login" class="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-bold text-zinc-300 hover:text-white transition-all">
          <span>👤</span><span>Login</span>
        </a>`;

if (!opHtml.includes('href="login.html"')) {
  opHtml = opHtml.replace(opQuickMarker, opLoginBtn);
  console.log('✅ Botão Login adicionado em operacao.html');
}

fs.writeFileSync(opPath, opHtml, 'utf8');
console.log('🎉 operacao.html atualizado!');
