const fs = require('fs');
const path = require('path');

// Restaurar backup limpo
const filePath = path.resolve(__dirname, '../web/public/torre-pesagem.html');
const backupPath = path.resolve(__dirname, '../web/public/torre-pesagem.html.bak');
let content = fs.readFileSync(backupPath, 'utf8');

// 1. Atualizar modulos de SCALES
content = content.replace(
  /'BAL-01':\{id:'BAL-01',nome:'Balança Usina',site:'usina',modelo:'Toledo Prix 9094',cap:80000,comp:21,e:10,local:'Portaria da usina · MT-358 km 08',ipem:\{ultima:'14\/04\/2026',vence:'14\/04\/2027',cert:'IPEM-MT 042\/2026',dias:153\},interna:\{data:'03\/11\/2026',padrao:'Caminhão-padrão 30.000 kg',erro:-10\},modulos:3\}/,
  `'BAL-01':{id:'BAL-01',nome:'Balança Usina',site:'usina',modelo:'Toledo Prix 9094',cap:80000,comp:21,e:10,local:'Portaria da usina · MT-358 km 08',ipem:{ultima:'14/04/2026',vence:'14/04/2027',cert:'IPEM-MT 042/2026',dias:153},interna:{data:'03/11/2026',padrao:'Caminhão-padrão 30.000 kg',erro:-10},modulos:4}`
);

// 2. Adicionar estilos CSS específicos da Pista e Fullscreen antes de </style>
const cssPista = `
/* ===== Pista de Pesagem Interativa & Tela Cheia ===== */
.pista-hero-card {
  border-color: var(--line);
  background: var(--panel);
  overflow: hidden;
  transition: all .2s ease;
  margin-bottom: 14px;
}
.pista-wrap {
  background: #0D0F11;
  border-radius: 0 0 var(--r) var(--r);
  padding: 12px 14px 14px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pista-svg-container {
  width: 100%;
  max-width: 1480px;
  position: relative;
  user-select: none;
}
.pista-svg-container svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
}
.interactive-hover {
  cursor: pointer;
  transition: filter .15s ease, transform .15s ease;
}
.interactive-hover:hover {
  filter: brightness(1.28) drop-shadow(0 0 6px rgba(255,112,0,0.5));
}
.celula-btn {
  cursor: pointer;
  transition: all .15s ease;
}
.celula-btn:hover circle:nth-child(2) {
  stroke: #FFA24C;
  stroke-width: 3.5;
  filter: drop-shadow(0 0 8px #FF7000);
}
.celula-btn:hover text {
  fill: #FFA24C;
  font-weight: 700;
}
.fs-floating-pill {
  position: fixed;
  top: 14px;
  right: 20px;
  background: rgba(21, 24, 27, 0.95);
  backdrop-filter: blur(10px);
  border: 1.5px solid #FF7000;
  color: #FF9445;
  padding: 8px 18px;
  border-radius: 999px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  z-index: 999999;
  box-shadow: 0 6px 24px rgba(0,0,0,0.6);
  display: none;
  align-items: center;
  gap: 8px;
  transition: all .2s ease;
}
.fs-floating-pill:hover {
  background: #FF7000;
  color: #16181B;
  transform: translateY(-1px);
  box-shadow: 0 8px 28px rgba(255,112,0,0.4);
}
body.is-fullscreen .fs-floating-pill {
  display: inline-flex;
}
body.is-fullscreen .topbar {
  padding-right: 220px;
}
body.is-fullscreen .view {
  max-width: 100%;
  padding: 12px 18px 30px;
}
`;

content = content.replace('</style>', `${cssPista}\n</style>`);

// 3. Adicionar botão de Tela Cheia na Topbar (ao lado do Copiloto)
const btnFsTopbar = `<button class="btn sm" type="button" data-act="fullscreen" id="btn-fs-topbar" title="Visualizar todo o monitor em tela cheia (F11)"><svg class="i" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg><span class="fs-text">Tela cheia</span></button>`;
content = content.replace(
  '<button class="ai-btn" type="button" data-act="copilot" id="ai-open">',
  `${btnFsTopbar}\n    <button class="ai-btn" type="button" data-act="copilot" id="ai-open">`
);

// 4. Injetar botão flutuante de Tela Cheia no corpo HTML
content = content.replace(
  '<div id="overlay"></div>',
  `<div id="overlay"></div>\n<div id="fs-floating-pill" class="fs-floating-pill" data-act="fullscreen"><svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M18 6L6 18M6 6l12 12"/></svg> Sair da Tela Cheia (Esc)</div>`
);

// Código dos módulos da pista interativa, SVG, drawers e fullscreen
const PISTA_MODULE_CODE = `
/* =====================================================================
   ESTADO INTERATIVO DA PISTA DE PESAGEM (GÊMEO DIGITAL AO VIVO)
   ===================================================================== */
const TRACK_HW = {
  cancelaIn: 'fechada', // 'aberta' | 'fechada'
  cancelaOut: 'fechada',
  semaforoIn: 'vermelho', // 'verde' | 'vermelho'
  semaforoOut: 'vermelho',
  simulacaoOscilacao: false,
  offsetCelula: {}
};

function toggleFullscreen() {
  const doc = document;
  const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
  if (!isFs) {
    const el = doc.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } else {
    if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
    else if (doc.msExitFullscreen) doc.msExitFullscreen();
  }
}

document.addEventListener('fullscreenchange', () => {
  const isFs = Boolean(document.fullscreenElement);
  document.body.classList.toggle('is-fullscreen', isFs);
  document.querySelectorAll('.fs-text').forEach(el => {
    el.textContent = isFs ? 'Sair da tela cheia' : 'Tela cheia';
  });
});
document.addEventListener('webkitfullscreenchange', () => {
  const isFs = Boolean(document.webkitFullscreenElement);
  document.body.classList.toggle('is-fullscreen', isFs);
  document.querySelectorAll('.fs-text').forEach(el => {
    el.textContent = isFs ? 'Sair da tela cheia' : 'Tela cheia';
  });
});

function buildPistaSvg(t, w, sc, stable, f, fase) {
  const isTruck = Boolean(t && w > 0);
  const placa = t ? t.placa : 'OBX-7E44';
  const prefixo = (t && t.prefixo) || (t && t.cfg && t.cfg.includes('betoneira') ? 'BT-01' : 'BT-01');
  const cancelaInAberta = TRACK_HW.cancelaIn === 'aberta';
  const cancelaOutAberta = TRACK_HW.cancelaOut === 'aberta';
  const semInVerde = TRACK_HW.semaforoIn === 'verde';
  const semOutVerde = TRACK_HW.semaforoOut === 'verde';

  // Cálculos metrológicos de carga das 8 células inteligentes
  const baseTon = isTruck ? (w / 1000) : 0;
  let c1, c2, c3, c4, c5, c6, c7, c8;
  if (isTruck) {
    c1 = (baseTon * 0.008).toFixed(1).replace('.', ',');
    c2 = (baseTon * 0.297).toFixed(1).replace('.', ',');
    c3 = (baseTon * 0.195).toFixed(1).replace('.', ',');
    c4 = (baseTon * 0.008).toFixed(1).replace('.', ',');
    c5 = (baseTon * 0.008).toFixed(1).replace('.', ',');
    c6 = (baseTon * 0.289).toFixed(1).replace('.', ',');
    c7 = (baseTon * 0.195).toFixed(1).replace('.', ',');
    c8 = (baseTon * 0.008).toFixed(1).replace('.', ',');
  } else {
    c1 = c2 = c3 = c4 = c5 = c6 = c7 = c8 = '0,0';
  }

  return \`
  <svg viewBox="0 0 1200 380" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0D0F11; font-family: 'Inter', -apple-system, sans-serif; user-select: none;">
    <defs>
      <!-- Padrão zebrado de segurança para bordas da plataforma -->
      <pattern id="zebra-hazard" width="22" height="22" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="22" stroke="#FFB800" stroke-width="11" />
        <line x1="11" y1="0" x2="11" y2="22" stroke="#121518" stroke-width="11" />
      </pattern>

      <!-- Padrão zebrado para cancelas -->
      <pattern id="zebra-cancela" width="14" height="14" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="14" stroke="#FF7000" stroke-width="7" />
        <line x1="7" y1="0" x2="7" y2="14" stroke="#FFFFFF" stroke-width="7" />
      </pattern>

      <radialGradient id="grad-cell-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FF7000" stop-opacity="1" />
        <stop offset="60%" stop-color="#FF7000" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#FF7000" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Fundo Asfáltico da Pista -->
    <rect x="0" y="0" width="1200" height="380" fill="#0D0F11" />

    <!-- Faixas amarelas tracejadas centrais na aproximação e saída -->
    <line x1="30" y1="190" x2="170" y2="190" stroke="#EAB308" stroke-width="3" stroke-dasharray="16 12" opacity="0.65" />
    <line x1="1030" y1="190" x2="1170" y2="190" stroke="#EAB308" stroke-width="3" stroke-dasharray="16 12" opacity="0.65" />

    <!-- Linhas guias horizontais delimitadoras da pista -->
    <line x1="0" y1="120" x2="180" y2="120" stroke="#24292F" stroke-width="2" stroke-dasharray="8 6" />
    <line x1="0" y1="260" x2="180" y2="260" stroke="#24292F" stroke-width="2" stroke-dasharray="8 6" />
    <line x1="1020" y1="120" x2="1200" y2="120" stroke="#24292F" stroke-width="2" stroke-dasharray="8 6" />
    <line x1="1020" y1="260" x2="1200" y2="260" stroke="#24292F" stroke-width="2" stroke-dasharray="8 6" />

    <!-- SETA E TEXTO ENTRADA (ESQUERDA) -->
    <g transform="translate(80, 190)" opacity="0.8">
      <path d="M-15 0 L15 0 M5 -8 L15 0 L5 8" stroke="#6B7280" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <text x="0" y="28" fill="#6B7280" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="700" letter-spacing="0.12em" text-anchor="middle">ENTRADA</text>
    </g>

    <!-- SETA E TEXTO SAÍDA (DIREITA) -->
    <g transform="translate(1120, 190)" opacity="0.8">
      <path d="M-15 0 L15 0 M5 -8 L15 0 L5 8" stroke="#6B7280" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <text x="0" y="28" fill="#6B7280" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="700" letter-spacing="0.12em" text-anchor="middle">SAÍDA</text>
    </g>

    <!-- TOTEM LPR (CANTO SUPERIOR ESQUERDO) -->
    <g class="interactive-hover" data-pista-action="totem-lpr">
      <text x="135" y="88" fill="#80868C" font-family="'IBM Plex Mono', monospace" font-size="10.5" font-weight="600" text-anchor="middle">TOTEM LPR</text>
      <!-- Gabinete -->
      <rect x="116" y="98" width="38" height="48" rx="8" fill="#15202B" stroke="#2B4360" stroke-width="2" />
      <!-- Lente com luz ciano -->
      <circle cx="135" cy="118" r="8.5" fill="#0A0F14" stroke="#38BDF8" stroke-width="2" />
      <circle cx="135" cy="118" r="3.5" fill="#38BDF8" />
      <circle cx="135" cy="136" r="2.5" fill="#3DBE74" />
      <!-- Feixe Laser / Vision AI apontando para o caminhão -->
      <polygon points="154,116 250,146 250,234 154,130" fill="rgba(56, 189, 248, 0.08)" stroke="rgba(56, 189, 248, 0.28)" stroke-width="1" stroke-dasharray="3 3" />
    </g>

    <!-- SEMÁFORO DE ENTRADA -->
    <g class="interactive-hover" data-pista-action="semaforo-in">
      <rect x="175" y="274" width="18" height="42" rx="5" fill="#0D1115" stroke="#2A2F34" stroke-width="1.8" />
      <!-- Luz Vermelha -->
      <circle cx="184" cy="285" r="5.5" fill="\${semInVerde ? '#2A1816' : '#EF5B52'}" \${semInVerde ? '' : 'style="filter: drop-shadow(0 0 6px #EF5B52);"'} />
      <!-- Luz Verde -->
      <circle cx="184" cy="304" r="5.5" fill="\${semInVerde ? '#3DBE74' : '#13281E'}" \${semInVerde ? 'style="filter: drop-shadow(0 0 6px #3DBE74);"' : 'stroke="#1E3A2B" stroke-width="1"'} />
    </g>

    <!-- CANCELA DE ENTRADA -->
    <g class="interactive-hover" data-pista-action="cancela-in">
      <!-- Base mecânica -->
      <rect x="\${cancelaInAberta ? 198 : 202}" y="108" width="14" height="20" rx="3" fill="#2A2F34" stroke="#4A525A" stroke-width="1.5" />
      <!-- Braço da cancela -->
      \${cancelaInAberta ? \`
        <g transform="translate(205, 120) rotate(-75)">
          <rect x="0" y="-3" width="115" height="6" rx="3" fill="url(#zebra-cancela)" stroke="#15181B" stroke-width="1" />
        </g>
        <rect x="175" y="100" width="50" height="18" rx="4" fill="rgba(61,190,116,0.2)" stroke="#3DBE74" stroke-width="1" />
        <text x="200" y="113" fill="#3DBE74" font-family="'IBM Plex Mono', monospace" font-size="9" font-weight="700" text-anchor="middle">ABERTA</text>
      \` : \`
        <rect x="206" y="128" width="6" height="128" rx="3" fill="url(#zebra-cancela)" stroke="#15181B" stroke-width="1" />
      \`}
    </g>

    <!-- PLATAFORMA DE PESAGEM METÁLICA (21 METROS · 4 MÓDULOS) -->
    <g id="plataforma-pesagem">
      <!-- Base fosso da Balança -->
      <rect x="218" y="126" width="804" height="128" rx="4" fill="#121517" stroke="#24292E" stroke-width="2" />

      <!-- 4 Módulos de Aço de 200px cada -->
      <rect x="220" y="128" width="198" height="124" fill="#1C2126" stroke="#2A313A" stroke-width="1" />
      <text x="319" y="195" fill="#333A44" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="700" letter-spacing="0.12em" text-anchor="middle">MÓDULO 1</text>

      <rect x="420" y="128" width="198" height="124" fill="#1C2126" stroke="#2A313A" stroke-width="1" />
      <text x="519" y="195" fill="#333A44" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="700" letter-spacing="0.12em" text-anchor="middle">MÓDULO 2</text>

      <rect x="620" y="128" width="198" height="124" fill="#1C2126" stroke="#2A313A" stroke-width="1" />
      <text x="719" y="195" fill="#333A44" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="700" letter-spacing="0.12em" text-anchor="middle">MÓDULO 3</text>

      <rect x="820" y="128" width="198" height="124" fill="#1C2126" stroke="#2A313A" stroke-width="1" />
      <text x="919" y="195" fill="#333A44" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="700" letter-spacing="0.12em" text-anchor="middle">MÓDULO 4</text>

      <!-- Juntas de dilatação verticais entre módulos -->
      <line x1="419" y1="128" x2="419" y2="252" stroke="#3DBE74" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.45" />
      <line x1="619" y1="128" x2="619" y2="252" stroke="#3DBE74" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.45" />
      <line x1="819" y1="128" x2="819" y2="252" stroke="#3DBE74" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.45" />

      <!-- Bordas de Segurança Zebradas Amarelas/Pretas (Superior e Inferior) -->
      <rect x="220" y="120" width="800" height="12" fill="url(#zebra-hazard)" stroke="#15181B" stroke-width="1" />
      <rect x="220" y="248" width="800" height="12" fill="url(#zebra-hazard)" stroke="#15181B" stroke-width="1" />

      <!-- Cantoneiras guias de entrada e saída -->
      <line x1="220" y1="116" x2="220" y2="264" stroke="#FFB800" stroke-width="3" stroke-linecap="round" />
      <line x1="1020" y1="116" x2="1020" y2="264" stroke="#FFB800" stroke-width="3" stroke-linecap="round" />
    </g>

    <!-- 8 CÉLULAS DE CARGA INTELIGENTES (C1 A C8) -->
    <!-- C1 -->
    <g class="celula-btn" data-pista-action="celula" data-celula="1" data-peso="\${c1}" transform="translate(290, 150)">
      <text x="0" y="-18" fill="#ECEAE6" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="600" text-anchor="middle">C1 · \${c1} t</text>
      <circle cx="0" cy="0" r="11" fill="#121517" stroke="#3A4047" stroke-width="2" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#FF7000" stroke-width="2.5" />
      <circle cx="0" cy="0" r="3" fill="#FF7000" style="filter: drop-shadow(0 0 3px #FF7000);" />
    </g>

    <!-- C2 -->
    <g class="celula-btn" data-pista-action="celula" data-celula="2" data-peso="\${c2}" transform="translate(520, 150)">
      <text x="0" y="-18" fill="#ECEAE6" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="600" text-anchor="middle">C2 · \${c2} t</text>
      <circle cx="0" cy="0" r="11" fill="#121517" stroke="#3A4047" stroke-width="2" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#FF7000" stroke-width="2.5" />
      <circle cx="0" cy="0" r="3" fill="#FF7000" style="filter: drop-shadow(0 0 4px #FF7000);" />
    </g>

    <!-- C3 -->
    <g class="celula-btn" data-pista-action="celula" data-celula="3" data-peso="\${c3}" transform="translate(720, 150)">
      <text x="0" y="-18" fill="#ECEAE6" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="600" text-anchor="middle">C3 · \${c3} t</text>
      <circle cx="0" cy="0" r="11" fill="#121517" stroke="#3A4047" stroke-width="2" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#FF7000" stroke-width="2.5" />
      <circle cx="0" cy="0" r="3" fill="#FF7000" style="filter: drop-shadow(0 0 4px #FF7000);" />
    </g>

    <!-- C4 -->
    <g class="celula-btn" data-pista-action="celula" data-celula="4" data-peso="\${c4}" transform="translate(950, 150)">
      <text x="0" y="-18" fill="#ECEAE6" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="600" text-anchor="middle">C4 · \${c4} t</text>
      <circle cx="0" cy="0" r="11" fill="#121517" stroke="#3A4047" stroke-width="2" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#FF7000" stroke-width="2.5" />
      <circle cx="0" cy="0" r="3" fill="#FF7000" style="filter: drop-shadow(0 0 3px #FF7000);" />
    </g>

    <!-- C5 -->
    <g class="celula-btn" data-pista-action="celula" data-celula="5" data-peso="\${c5}" transform="translate(290, 230)">
      <circle cx="0" cy="0" r="11" fill="#121517" stroke="#3A4047" stroke-width="2" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#FF7000" stroke-width="2.5" />
      <circle cx="0" cy="0" r="3" fill="#FF7000" style="filter: drop-shadow(0 0 3px #FF7000);" />
      <text x="0" y="27" fill="#ECEAE6" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="600" text-anchor="middle">C5 · \${c5} t</text>
    </g>

    <!-- C6 -->
    <g class="celula-btn" data-pista-action="celula" data-celula="6" data-peso="\${c6}" transform="translate(520, 230)">
      <circle cx="0" cy="0" r="11" fill="#121517" stroke="#3A4047" stroke-width="2" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#FF7000" stroke-width="2.5" />
      <circle cx="0" cy="0" r="3" fill="#FF7000" style="filter: drop-shadow(0 0 4px #FF7000);" />
      <text x="0" y="27" fill="#ECEAE6" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="600" text-anchor="middle">C6 · \${c6} t</text>
    </g>

    <!-- C7 -->
    <g class="celula-btn" data-pista-action="celula" data-celula="7" data-peso="\${c7}" transform="translate(720, 230)">
      <circle cx="0" cy="0" r="11" fill="#121517" stroke="#3A4047" stroke-width="2" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#FF7000" stroke-width="2.5" />
      <circle cx="0" cy="0" r="3" fill="#FF7000" style="filter: drop-shadow(0 0 4px #FF7000);" />
      <text x="0" y="27" fill="#ECEAE6" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="600" text-anchor="middle">C7 · \${c7} t</text>
    </g>

    <!-- C8 -->
    <g class="celula-btn" data-pista-action="celula" data-celula="8" data-peso="\${c8}" transform="translate(950, 230)">
      <circle cx="0" cy="0" r="11" fill="#121517" stroke="#3A4047" stroke-width="2" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#FF7000" stroke-width="2.5" />
      <circle cx="0" cy="0" r="3" fill="#FF7000" style="filter: drop-shadow(0 0 3px #FF7000);" />
      <text x="0" y="27" fill="#ECEAE6" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="600" text-anchor="middle">C8 · \${c8} t</text>
    </g>

    <!-- CAMINHÃO BETONEIRA (TOP-DOWN VIEW) -->
    \${isTruck ? \`
      <g class="interactive-hover" data-pista-action="caminhao" style="filter: drop-shadow(0 6px 16px rgba(0,0,0,0.7));">
        <!-- PNEUS E EIXOS -->
        <rect x="725" y="150" width="28" height="11" rx="3" fill="#16181B" stroke="#3A4047" stroke-width="1.5" />
        <rect x="725" y="225" width="28" height="11" rx="3" fill="#16181B" stroke="#3A4047" stroke-width="1.5" />

        <rect x="515" y="148" width="28" height="12" rx="3" fill="#16181B" stroke="#3A4047" stroke-width="1.5" />
        <rect x="515" y="226" width="28" height="12" rx="3" fill="#16181B" stroke="#3A4047" stroke-width="1.5" />

        <rect x="555" y="148" width="28" height="12" rx="3" fill="#16181B" stroke="#3A4047" stroke-width="1.5" />
        <rect x="555" y="226" width="28" height="12" rx="3" fill="#16181B" stroke="#3A4047" stroke-width="1.5" />

        <!-- Cota de largura entre rodas: 2,4 m -->
        <line x1="688" y1="162" x2="688" y2="224" stroke="#6B7280" stroke-width="1.5" stroke-dasharray="2 2" />
        <line x1="684" y1="162" x2="692" y2="162" stroke="#6B7280" stroke-width="1.5" />
        <line x1="684" y1="224" x2="692" y2="224" stroke="#6B7280" stroke-width="1.5" />
        <text x="683" y="197" fill="#9CA3AF" font-family="'IBM Plex Mono', monospace" font-size="10.5" font-weight="600" text-anchor="end">2,4</text>

        <!-- BALÃO DA BETONEIRA -->
        <ellipse cx="472" cy="190" rx="8" ry="12" fill="#4B5563" stroke="#374151" stroke-width="1.5" />
        <path d="M480 162 Q610 152 690 168 L690 212 Q610 228 480 218 C458 214 458 166 480 162 Z" fill="#E5E7EB" stroke="#9CA3AF" stroke-width="2" />

        <!-- Helicoides laranjas -->
        <path d="M510 164 Q525 190 510 216" fill="none" stroke="#FF7000" stroke-width="4.5" stroke-linecap="round" />
        <path d="M555 160 Q575 190 555 220" fill="none" stroke="#FF7000" stroke-width="4.5" stroke-linecap="round" />
        <path d="M610 158 Q630 190 610 222" fill="none" stroke="#FF7000" stroke-width="4.5" stroke-linecap="round" />

        <!-- Placa e Prefixo -->
        <text x="600" y="194" fill="#111827" font-family="'IBM Plex Mono', monospace" font-size="11.5" font-weight="800" letter-spacing="0.06em" text-anchor="middle">\${placa} · \${prefixo}</text>

        <!-- CABINE BRANCA -->
        <rect x="695" y="160" width="86" height="66" rx="8" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="2" />
        <path d="M755 168 C772 168 777 175 777 193 C777 211 772 218 755 218 Z" fill="#1F2937" stroke="#374151" stroke-width="1.5" />
        <rect x="705" y="174" width="36" height="38" rx="4" fill="#F3F4F6" stroke="#E5E7EB" stroke-width="1" />
        <rect x="738" y="152" width="12" height="5" rx="1.5" fill="#1F2937" />
        <rect x="738" y="229" width="12" height="5" rx="1.5" fill="#1F2937" />
      </g>
    \` : \`
      <!-- Plataforma Livre -->
      <g opacity="0.35">
        <text x="620" y="195" fill="#6B7280" font-family="'IBM Plex Mono', monospace" font-size="13" font-weight="600" letter-spacing="0.08em" text-anchor="middle">● PLATAFORMA LIVRE · AGUARDANDO PRÓXIMO VEÍCULO ●</text>
      </g>
    \`}

    <!-- EQUIPAMENTOS DE SAÍDA (DIREITA) -->
    <!-- CANCELA DE SAÍDA -->
    <g class="interactive-hover" data-pista-action="cancela-out">
      <rect x="\${cancelaOutAberta ? 1024 : 1028}" y="108" width="14" height="20" rx="3" fill="#2A2F34" stroke="#4A525A" stroke-width="1.5" />
      \${cancelaOutAberta ? \`
        <g transform="translate(1035, 120) rotate(-75)">
          <rect x="0" y="-3" width="115" height="6" rx="3" fill="url(#zebra-cancela)" stroke="#15181B" stroke-width="1" />
        </g>
        <rect x="1005" y="100" width="50" height="18" rx="4" fill="rgba(61,190,116,0.2)" stroke="#3DBE74" stroke-width="1" />
        <text x="1030" y="113" fill="#3DBE74" font-family="'IBM Plex Mono', monospace" font-size="9" font-weight="700" text-anchor="middle">ABERTA</text>
      \` : \`
        <rect x="1032" y="128" width="6" height="128" rx="3" fill="url(#zebra-cancela)" stroke="#15181B" stroke-width="1" />
      \`}
    </g>

    <!-- SEMÁFORO DE SAÍDA -->
    <g class="interactive-hover" data-pista-action="semaforo-out">
      <rect x="1085" y="274" width="18" height="42" rx="5" fill="#0D1115" stroke="#2A2F34" stroke-width="1.8" />
      <circle cx="1094" cy="285" r="5.5" fill="\${semOutVerde ? '#2A1816' : '#EF5B52'}" \${semOutVerde ? '' : 'style="filter: drop-shadow(0 0 6px #EF5B52);"'} />
      <circle cx="1094" cy="304" r="5.5" fill="\${semOutVerde ? '#3DBE74' : '#13281E'}" \${semOutVerde ? 'style="filter: drop-shadow(0 0 6px #3DBE74);"' : 'stroke="#1E3A2B" stroke-width="1"'} />
    </g>

    <!-- TOTEM MOTORISTA -->
    <g class="interactive-hover" data-pista-action="totem-motorista">
      <rect x="1130" y="285" width="32" height="44" rx="6" fill="#1C2228" stroke="#3A434D" stroke-width="2" />
      <rect x="1136" y="293" width="20" height="18" rx="3" fill="#FF7000" style="filter: drop-shadow(0 0 4px #FF7000);" />
      <circle cx="1146" cy="319" r="3" fill="#3DBE74" />
      <text x="1146" y="350" fill="#80868C" font-family="'IBM Plex Mono', monospace" font-size="10" font-weight="600" text-anchor="middle">TOTEM MOTORISTA</text>
    </g>

    <!-- RÉGUA METROLÓGICA (21,0 M · 80 T) -->
    <g id="escala-metrologica" opacity="0.65">
      <line x1="220" y1="326" x2="1020" y2="326" stroke="#4B5563" stroke-width="1.5" />
      <line x1="220" y1="319" x2="220" y2="333" stroke="#4B5563" stroke-width="1.5" />
      <line x1="1020" y1="319" x2="1020" y2="333" stroke="#4B5563" stroke-width="1.5" />
      <text x="620" y="330" fill="#9CA3AF" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="600" text-anchor="middle">21,0 m · 80 t</text>
    </g>
  </svg>
  \`;
}

function openCelulaDrawer(num, pesoTon) {
  const mod = Math.ceil(num / 2);
  const lado = num <= 4 ? 'Norte (Superior)' : 'Sul (Inferior)';
  const pesoKg = Math.round(parseFloat(pesoTon.replace(',', '.')) * 1000);
  const sinalMv = (pesoKg > 0 ? (pesoKg / 10000 * 2.0).toFixed(3) : '0.000');
  
  openDrawer(\`
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px">
      <div>
        <h3 style="display:flex;align-items:center;gap:8px;font-size:16px;text-transform:uppercase">
          <span>⚖️</span> Diagnóstico Metrológico · Célula C\${num}
        </h3>
        <small class="muted">\${S.bal} (Toledo Prix 9094) · Módulo \${mod} · Lado \${lado}</small>
      </div>
      <button class="btn sm" type="button" data-act="close">✕</button>
    </div>
    
    <div style="margin:14px 0;display:flex;gap:8px;align-items:center">
      <span class="pill p-ok">● Sinal Estável · 100% Calibrada</span>
      <span class="tag">Classe III INMETRO</span>
    </div>

    <div class="dossier" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      <div class="kv"><span class="lbl">Peso Medido na Célula</span><b>\${fmt(pesoKg)} kg (\${pesoTon} t)</b></div>
      <div class="kv"><span class="lbl">Excentricidade NBR</span><b>±0.01% (Em conformidade)</b></div>
      <div class="kv"><span class="lbl">Sinal Analógico</span><b>\${sinalMv} mV/V (Nominal 2.0 mV/V)</b></div>
      <div class="kv"><span class="lbl">Tensão de Excitação</span><b>10.00 VDC Estabilizada</b></div>
      <div class="kv"><span class="lbl">Impedância de Entrada</span><b>350,2 Ω (Nominal 350 Ω)</b></div>
      <div class="kv"><span class="lbl">Temperatura Operacional</span><b>28,4 °C (Faixa -10°C a +40°C)</b></div>
      <div class="kv"><span class="lbl">IPEM-MT Calibração</span><b>Certificado 042/2026 Vigente</b></div>
      <div class="kv"><span class="lbl">Próxima Verificação</span><b>14/04/2027 (Anual)</b></div>
    </div>

    <div class="card" style="margin-top:14px;background:var(--panel-2);border-color:var(--line)">
      <div class="card-b" style="display:grid;gap:8px">
        <span class="lbl">Ações de Manutenção e Calibração</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm" type="button" data-cmd="Zero ajustado na Célula C\${num}">Ajustar Zero da Célula</button>
          <button class="btn sm" type="button" data-cmd="Calibração de sensibilidade conferida C\${num}">Conferir Ganho mV/V</button>
          <button class="btn sm okb" type="button" data-cmd="Laudo de telemetria emitido para C\${num}">Emitir Laudo IPEM</button>
        </div>
      </div>
    </div>
  \`);
}

function openVeiculoConcretoDrawer(t, w, sc) {
  const placa = t ? t.placa : 'OBX-7E44';
  const prefixo = (t && t.prefixo) || 'BT-01';
  const motorista = (t && t.motorista) || 'Valdir Oliveira';
  const cliente = (t && t.parceiro) || 'Construtora MT Horizon LTDA';
  const obra = (t && t.obra) || 'Residencial Tangará Ville - Laje Bloco B';
  const tara = 12810;
  const brutoEst = 32010;
  const liqEst = 19200;

  openDrawer(\`
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px">
      <div>
        <h3 style="display:flex;align-items:center;gap:8px;font-size:16px;text-transform:uppercase">
          <span>🚛</span> Ficha da Carga · Betoneira \${prefixo} (\${placa})
        </h3>
        <small class="muted">Expedição de Concreto Usinado · NBR 7212 / NBR 5739</small>
      </div>
      <button class="btn sm" type="button" data-act="close">✕</button>
    </div>

    <div style="margin:14px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span class="pill p-brand">1ª Pesagem · Tara Registrada</span>
      <span class="plate">\${placa}</span>
      <span class="tag">8x4 · 4 eixos</span>
      <span class="tag" style="color:#3DBE74;border-color:#3DBE74">Peso Estável</span>
    </div>

    <div class="dossier" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      <div class="kv"><span class="lbl">Veículo & Modelo</span><b>VW Constellation 26.280 8x4 (Betoneira)</b></div>
      <div class="kv"><span class="lbl">Motorista</span><b>\${esc(motorista)}<br><small class="muted">CNH E regular · Toxicológico ok</small></b></div>
      <div class="kv"><span class="lbl">Tara Registrada</span><b>\${fmt(tara)} kg (Conferida na \${sc.id})</b></div>
      <div class="kv"><span class="lbl">PBT Máximo Lei da Balança</span><b>\${fmt(brutoEst)} kg (Limite 29,0 t + 5% tol)</b></div>
      <div class="kv"><span class="lbl">Volume do Balão</span><b>8,0 m³ de Concreto Usinado</b></div>
      <div class="kv"><span class="lbl">Densidade Estimada</span><b>2,40 t/m³ (Líquido: \${fmt(liqEst)} kg)</b></div>
      <div class="kv"><span class="lbl">Especificação Tecnológica</span><b>Estrutural FCK 30 MPa · Brita 1</b></div>
      <div class="kv"><span class="lbl">Slump Test (Abatimento)</span><b>12 ± 2 cm (NBR NM 67)</b></div>
      <div class="kv"><span class="lbl">Cliente</span><b>\${esc(cliente)}</b></div>
      <div class="kv"><span class="lbl">Obra de Aplicação</span><b>\${esc(obra)}</b></div>
      <div class="kv"><span class="lbl">Destino Imediato</span><b>Central Dosadora · Baia 2 de Carregamento</b></div>
      <div class="kv"><span class="lbl">Controle Tecnológico</span><b>Moldagem 6 Corpos de Prova (NBR 5738)</b></div>
    </div>

    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn sm pri" type="button" data-cmd="Ticket de Tara \${fmt(tara)} kg emitido para \${placa}">Emitir Ticket de Tara</button>
      <button class="btn sm" type="button" data-cmd="Cancela de saída liberada para \${placa}">Liberar para Central</button>
      <button class="btn sm" type="button" data-ask="Explique o perfil de pesagem da betoneira \${placa} e se a tara de \${fmt(tara)} kg confere com a média histórica.">Copiloto IA</button>
    </div>
  \`);
}

function openTotemLprDrawer(t, sc) {
  const placa = t ? t.placa : 'OBX-7E44';
  openDrawer(\`
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px">
      <div>
        <h3 style="display:flex;align-items:center;gap:8px;font-size:16px;text-transform:uppercase">
          <span>📹</span> Totem LPR Entrada · Câmera Vision AI
        </h3>
        <small class="muted">Intelbras VIP 7250 LPR IA (IP 192.168.1.120) · Stream 4K RTSP</small>
      </div>
      <button class="btn sm" type="button" data-act="close">✕</button>
    </div>

    <div style="margin:14px 0;display:flex;gap:8px;align-items:center">
      <span class="pill p-ok">● Reconhecimento OCR: 99.8%</span>
      <span class="tag">Semáforo Entrada Vinculado</span>
    </div>

    <div style="background:#050709;border:1px solid var(--line);border-radius:6px;padding:16px;text-align:center;position:relative">
      <div style="display:inline-block;border:2px solid #38BDF8;padding:8px 18px;border-radius:4px;background:rgba(56,189,248,0.1)">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:800;letter-spacing:0.12em;color:#FFF">\${placa}</span>
        <div style="font-size:10px;color:#38BDF8;margin-top:2px">PLACA MERCOSUL DETECTADA (CONF. 0.998)</div>
      </div>
      <div style="position:absolute;bottom:8px;right:10px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#80868C">
        CAM-01 · 1920x1080 · 30 FPS · H.265
      </div>
    </div>

    <div class="dossier" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px">
      <div class="kv"><span class="lbl">Tipo Detectado por IA</span><b>Caminhão Betoneira 8x4 (4 eixos)</b></div>
      <div class="kv"><span class="lbl">Status da Janela</span><b>Agendado nº 4128 (Conforme)</b></div>
      <div class="kv"><span class="lbl">Alinhamento na Pista</span><b>Centralizado na Balança 80t</b></div>
      <div class="kv"><span class="lbl">Velocidade de Passagem</span><b>3,8 km/h (Dentro do limite 5 km/h)</b></div>
    </div>

    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn sm pri" type="button" data-cmd="Placa \${placa} confirmada manualmente via OCR">Validar Leitura</button>
      <button class="btn sm" type="button" data-cmd="Nova captura OCR disparada">Recapturar OCR</button>
    </div>
  \`);
}

function openTotemMotoristaDrawer(t, w, sc) {
  const placa = t ? t.placa : 'OBX-7E44';
  const pesoKg = w > 0 ? w : 12810;
  openDrawer(\`
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px">
      <div>
        <h3 style="display:flex;align-items:center;gap:8px;font-size:16px;text-transform:uppercase">
          <span>🗣️</span> Totem de Atendimento ao Motorista
        </h3>
        <small class="muted">Interfone IP Touchscreen & Impressora Térmica 80mm · Saída \${sc.id}</small>
      </div>
      <button class="btn sm" type="button" data-act="close">✕</button>
    </div>

    <div style="margin:14px 0;display:flex;gap:8px;align-items:center">
      <span class="pill p-brand">Display Ativo · Comunicação Direta</span>
      <span class="tag">Viva-Voz KyttoIA CCO</span>
    </div>

    <div style="background:#1C242C;border:2px solid #FF7000;border-radius:8px;padding:16px;text-align:center">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#FF9445;text-transform:uppercase">MENSAGEM EM EXIBIÇÃO NO VISOR:</div>
      <div style="font-size:18px;font-weight:700;color:#FFF;margin-top:6px;line-height:1.3">
        "TARA REGISTRADA: \${fmt(pesoKg)} KG.<br>SIGA PARA A BAIA 2 DE CARREGAMENTO."
      </div>
    </div>

    <div style="margin-top:14px;display:grid;gap:8px">
      <label class="lbl">Falar no Interfone do Totem</label>
      <div style="display:flex;gap:6px">
        <input type="text" id="totem-audio-msg" value="Motorista da betoneira \${placa}, primeira pesagem conferida. Siga para o carregamento." style="flex:1;background:var(--panel-2);border:1px solid var(--line);padding:7px 10px;border-radius:6px;color:#FFF;font-size:12px;">
        <button class="btn sm pri" type="button" onclick="const m=document.getElementById('totem-audio-msg').value;if(m){log('info','Mensagem no totem',m);toast('Áudio transmitido no totem: '+m);}">Transmitir Voz</button>
      </div>
    </div>

    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn sm" type="button" data-cmd="Impressão de ticket térmico acionada no Totem">Imprimir Ticket Físico</button>
      <button class="btn sm" type="button" data-cmd="Comprovante de pesagem enviado via WhatsApp">Enviar via WhatsApp</button>
      <button class="btn sm okb" type="button" data-cmd="Cancela de saída aberta pelo Totem">Abrir Cancela Saída</button>
    </div>
  \`);
}
`;

// Substituir V.pesagem
const novoVPesagem = `
/* =====================================================================
   PESAGEM AUTÔNOMA
   ===================================================================== */
V.pesagem={
  render(){
    const sc=SCALES[S.bal];
    return \`<div class="vh"><div><h1>Pesagem autônoma</h1><p>\${sc.modelo} · \${sc.cap/1000} t · plataforma \${sc.comp} m em \${sc.modulos} módulos · e=\${sc.e} kg · \${sc.local}</p></div>
      <div class="act"><div class="seg" role="group" aria-label="Balança">\${Object.values(SCALES).map(s=>\`<button type="button" data-bal="\${s.id}" aria-pressed="\${S.bal===s.id}">\${s.id} · \${s.nome}</button>\`).join('')}</div>
      <label class="sw"><input type="checkbox" id="auto-sw" \${RULES.autoAprovar?'checked':''}>Modo autônomo</label></div></div>
    \${replayBanner()}

    <!-- CARD PRINCIPAL: PISTA INTERATIVA EM GÊMEO DIGITAL (PROPORÇÃO MONITOR) -->
    <div class="card pista-hero-card" id="p-runway-card">
      <div class="card-h">
        <h3 id="pista-title" style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:13px;letter-spacing:0.04em;text-transform:uppercase">
          <span>PISTA \${sc.id} · \${sc.comp} M · \${sc.modulos} MÓDULOS · \${sc.modulos * 2} CÉLULAS</span>
        </h3>
        <div class="r" style="display:flex;align-items:center;gap:12px">
          <span id="pista-status-badge" style="display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:11.5px;color:#FF9445">
            <span class="dot pulse brand"></span> Peso estável · validando
          </span>
          <span class="muted">|</span>
          <span class="muted" style="font-size:11.5px">clique nas cancelas, semáforos e células</span>
          <button class="btn sm" type="button" data-act="fullscreen" id="btn-fs-pista" style="border-color:var(--brand);color:var(--brand-ink)" title="Visualizar pista ocupando 100% do monitor">
            <svg class="i" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            <span class="fs-text">Tela cheia</span>
          </button>
        </div>
      </div>
      <div class="pista-wrap">
        <div class="pista-svg-container" id="pista-svg-mount"></div>
      </div>
    </div>

    <!-- CÂMERAS CFTV E GRIDS OPERACIONAIS -->
    <div class="cams" id="p-cams"></div>
    <div class="grid g-2">
      <div style="display:grid;gap:14px;align-content:start;min-width:0">
        <div id="p-ind"></div>
        <div class="card"><div class="card-b" style="display:grid;gap:14px"><div class="pipe" id="p-pipe"></div><div id="p-axles"></div></div></div>
        <div class="card"><div class="card-h"><h3>Exceções</h3><div class="r"><span class="muted" style="font-size:11.5px">só o que a automação não pode decidir</span></div></div><div id="p-exc"></div></div>
      </div>
      <div style="display:grid;gap:14px;align-content:start;min-width:0">
        <div class="card"><div class="card-h"><h3>Veículo na balança</h3><div class="r" id="p-tag"></div></div><div class="card-b" style="display:grid;gap:12px"><div id="p-dossier"></div><div class="checks" id="p-checks"></div></div></div>
        <div class="grid g-2" style="gap:14px">
          <div class="card"><div class="card-h"><h3>WhatsApp do motorista</h3></div><div class="card-b" id="p-phone"></div></div>
          <div style="display:grid;gap:14px;align-content:start">
            <div class="card"><div class="card-h"><h3>Comandos</h3></div><div class="card-b" style="display:grid;gap:8px">
              <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" type="button" data-cmd="Cancela de entrada aberta">\${ic('gate')}Abrir entrada</button><button class="btn sm" type="button" data-cmd="Cancela de saída aberta">\${ic('gate')}Abrir saída</button><button class="btn sm" type="button" data-cmd="Zero manual">Zerar</button></div>
              <label class="lbl" for="totem-msg">Falar no totem</label><div style="display:flex;gap:6px"><input type="text" id="totem-msg" value="Motorista, avance meio metro para a frente, por favor."><button class="btn sm" type="button" data-act="speak" aria-label="Falar no totem">\${ic('spk')}</button></div>
              <small class="muted" id="tts-note">Usa a síntese de voz KyttoIA CCO.</small></div></div>
            <div class="card"><div class="card-h"><h3>Leitura por foto (IA)</h3></div><div class="card-b" style="display:grid;gap:8px">
              <small class="dim">Envie a foto de um caminhão. A IA lê a placa, conta os eixos e confere no cadastro.</small>
              <label class="btn sm" style="cursor:pointer">\${ic('cam')}Escolher foto<input type="file" id="ocr-file" accept="image/jpeg,image/png,image/webp" hidden></label><div id="ocr-out"></div></div></div>
          </div>
        </div>
        <div class="card"><div class="card-h"><h3>Próximos nesta balança</h3></div><div id="p-next"></div></div>
      </div>
    </div>\`;
  },
  live(){
    const T=VT(); const sc=SCALES[S.bal]; const t=onScale(S.bal,T); const st=t?stateAt(t,T):null;
    const f=st?st.f:0, fase=st?st.fase:0; const ps=t?pipeState(t,fase,f,T):null;
    const w=t?Math.round(weightAt(t,fase,f)/sc.e)*sc.e:0; const stable=t&&f>=0.62&&f<0.95&&!(t.anom&&t.anom.k==='pessoa'&&fase===2);
    const ts=(T*60)%60; const clk=\`\${hm(T)}:\${String(Math.floor(ts)).padStart(2,'0')}\`;

    // Atualiza a Pista Interativa SVG em Tempo Real
    const mount = $('#pista-svg-mount');
    if (mount) {
      mount.innerHTML = buildPistaSvg(t, w, sc, stable, f, fase);
    }

    // Status da Pista
    const badge = $('#pista-status-badge');
    if (badge) {
      if (t && stable) {
        badge.innerHTML = '<span class="dot pulse brand"></span> Peso estável · validando';
        badge.style.color = '#FF9445';
      } else if (t && !stable && w > 0) {
        badge.innerHTML = '<span class="dot pulse warn"></span> Em movimento · posicionando';
        badge.style.color = '#E0A33A';
      } else if (w === 0) {
        badge.innerHTML = '<span class="dot ok"></span> Pista livre · zero conferido';
        badge.style.color = '#3DBE74';
      }
    }

    // Câmeras CFTV
    $('#p-cams').innerHTML=[['LPR-1 · frontal',camFront(t,f,T),t&&f>=0.16?\`OCR \${t.placa}\`:''],['CAM-2 · lateral · eixos',camSide(t,f),t&&f>=0.2?\`\${CONFIGS[t.cfg].eixos} eixos · \${CONFIGS[t.cfg].nome}\`:''],['CAM-3 · superior · posição',camTop(t,f,ps),'']]
      .map(([n,svg,o])=>\`<div class="cam">\${svg}<div class="ov"><span>\${n} · \${S.bal}</span><span><span class="rec">●</span> \${clk}</span></div>\${o?\`<div class="ocr">\${o}</div>\`:''}</div>\`).join('');

    $('#p-ind').innerHTML=\`<div class="ind" aria-live="off"><div class="ind-top"><span class="ann \${stable?'on okc':''}">ESTÁVEL</span><span class="ann \${t&&!stable&&w>0?'on':''}">MOVIMENTO</span><span class="ann \${w===0?'on':''}">&gt;0&lt; ZERO</span><span class="ann \${ps&&ps.pos?'on bad':''}">POSIÇÃO</span><span class="ann \${t&&t.anom&&t.anom.k==='pessoa'&&fase===2&&f>.6?'on bad':''}">OSCILAÇÃO</span><span style="margin-left:auto">\${sc.modelo.toUpperCase()} · \${sc.id}</span></div>
      <div class="readout"><span>\${fmt(w)}</span><small>kg</small></div>
      <div class="ind-foot"><span>Pesagem: <b>\${t?(fase===1?'1ª · ':'2ª · ')+(fase===1?(loadsHere(t.op)?'tara':'bruto'):(loadsHere(t.op)?'bruto':'tara')):'—'}</b></span><span>1ª registrada: <b>\${t&&fase===2?kg(loadsHere(t.op)?t.tara:t.bruto):'—'}</b></span><span>Indicador: <b>RS-232 · online</b></span></div></div>\`;

    const names=fase===1?STG1:STG2;
    $('#p-pipe').innerHTML=(t?names:STG2).map((n,i)=>{let c='';if(t){if(ps.stop&&i===5)c='stop';else if(ps.stop&&i>5)c='';else if(i<ps.idx)c='done';else if(i===ps.idx)c='cur';}return \`<div class="\${c}">\${ps&&ps.stop&&i===5?'Exceção → operador':ps&&ps.pos&&i===3?'Reposicionar':n}</div>\`;}).join('');

    $('#p-axles').innerHTML=t&&f>=0.4?\`<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span class="lbl">Carga por grupo de eixos · estimativa pelos \${sc.modulos} módulos</span><span class="lbl">limite · <span style="color:var(--crit)">tolerância \${fmt(RULES.tolEixo,1)}%</span></span></div><div class="axles">\${axleLoads(t,w).map(a=>{const max=a.lim*1.3;const r=a.w/max;const over=a.w>a.lim*(1+RULES.tolEixo/100);return \`<div class="ax"><span>\${a.nome}</span><div class="bar"><i class="\${over?'crit':a.w>a.lim?'warn':'n'}" style="width:\${clamp(r*100,0,100)}%"></i><span class="lim" style="left:\${a.lim/max*100}%"></span><span class="tol" style="left:\${a.lim*(1+RULES.tolEixo/100)/max*100}%"></span></div><span class="num v" style="text-align:right">\${kg(a.w)} / \${fmt(a.lim/1000,1)} t</span></div>\`;}).join('')}</div>\`:\`<div class="muted" style="font-size:12px">A carga por eixo aparece quando o veículo estiver posicionado.</div>\`;

    // Dossiê
    if(t){
      const v=veh(t.placa); const exp=expected(t);
      $('#p-tag').innerHTML=\`<span class="pill \${fase===1?'p-info':'p-brand'}">\${fase===1?'1ª':'2ª'} pesagem</span>\`;
      $('#p-dossier').innerHTML=\`<div class="dossier">\${[['Placa',\`<span class="plate">\${t.placa}</span>\`],['Configuração',CONFIGS[t.cfg].nome],['Motorista',esc(t.motorista)+'<br><span class="muted" style="font-weight:400;font-size:11.5px">CNH regular</span>'],['Operação',OPS[t.op]],['Material',MATS[t.mat].nome],[t.op==='recebimento'?'Fornecedor':'Cliente',esc(t.parceiro)],[t.docTipo,esc(t.doc)],['Líquido esperado',\`<span class="num">\${kg(exp)}</span>\`]].map(([l,b])=>\`<div class="kv"><span class="lbl">\${l}</span><b>\${b}</b></div>\`).join('')}</div>\`;
      let ch=[];
      if(fase===1){const ok=f>=0.26;
        ch.push({sev:!ok?'':t.anom&&t.anom.k==='placa'?'warn':'ok',t:'Identidade',d:ok?(t.anom&&t.anom.k==='placa'?\`Placa lida \${t.placa}; agendamento \${t.anom.agendada}. Cadastro do veículo existe.\`:\`Placa lida = agendamento \${hm(t.arr)} · \${t.canal}\`):'lendo placa…',v:ok?(t.anom&&t.anom.k==='placa'?'confirmar':'ok'):''});
        ch.push({sev:ok?'ok':'',t:'Cadastro e motorista',d:ok?\`\${CONFIGS[t.cfg].nome} · tara \${v.taraDias} dias · CNH válida\`:'aguardando identificação',v:''});
        if(loadsHere(t.op)){const done=f>=0.74;const dt=(t.tara-v.tara)/v.tara*100;ch.push({sev:!done?'':Math.abs(dt)>RULES.tolTara?'crit':'ok',t:'Tara vs histórico',d:done?\`Medida \${kg(t.tara)} · média de 30 pesagens \${kg(v.tara)}\`:'aguardando peso estável',v:done?pct(dt):''});}
        else ch.push({sev:f>=0.74?'ok':'',t:'Bruto registrado',d:f>=0.74?\`\${kg(t.bruto)} · NF \${fmt(t.nf)} vinculada\`:'aguardando peso estável',v:''});
      } else ch=f>=0.74?evaluate(t):[{sev:'',t:'Validações',d:'Rodam quando o peso estabilizar: Lei da Balança, eixos, documento, densidade e tara.',v:''}];
      $('#p-checks').innerHTML=ch.map(c=>\`<div class="chk \${c.sev}"><span class="ic">\${c.sev==='ok'?'✓':c.sev?'!':'…'}</span><div><b>\${c.t}</b><small>\${c.d}</small></div><span class="num">\${c.v}</span></div>\`).join('');
      $('#p-phone').innerHTML=phone(t,T);
    } else {
      const nx=nextAt(S.bal,T)[0]||queueAt(S.bal,T)[0]; const q=queueAt(S.bal,T);
      $('#p-tag').innerHTML='<span class="pill">pista livre</span>';
      $('#p-dossier').innerHTML=\`<p class="dim">Plataforma vazia, zero conferido.\${q.length?\` \${q[0].placa} entra em instantes.\`:nx?\` Próximo: <span class="plate">\${nx.placa}</span> chega às \${hm(nx.arr)}.\`:''}</p>\`;
      $('#p-checks').innerHTML=''; $('#p-phone').innerHTML=nx?phone(nx,T):'<div class="empty">Sem conversa ativa.</div>';
    }
    const exc=openExceptions(T);
    if(changed('pexc',exc.map(t=>t.id).join(',')+live())) $('#p-exc').innerHTML=exc.length?\`<div class="feed" style="max-height:none">\${exc.map(t=>excItem(t,T,false)).join('')}</div>\`:'<div class="empty">Nenhuma exceção. As pesagens estão sendo aprovadas automaticamente.</div>';
    const nxt=[...queueAt(S.bal,T),...nextAt(S.bal,T).slice(0,4)];
    const yard=yardAt(S.bal,T);
    $('#p-next').innerHTML=\`<div class="tbl-wrap"><table><thead><tr><th>Placa</th><th>Etapa</th><th>Operação</th><th>Horário</th><th class="r">Espera</th></tr></thead><tbody>\${[...yard.map(x=>[x,'No pátio · volta para 2ª',hm(x.p2)]),...nxt.map(x=>[x,T>=x.arr?'Na fila':'Agendado',hm(x.arr)])].slice(0,8).map(([x,e,h])=>\`<tr class="click" data-locate="\${x.id}"><td><span class="plate">\${x.placa}</span></td><td>\${e}</td><td>\${OPS[x.op]}</td><td class="num">\${h}</td><td class="num r">\${T>=x.arr&&T<x.p1?dur(T-x.arr):'—'}</td></tr>\`).join('')||'<tr><td colspan="5" class="muted">Sem veículos previstos.</td></tr>'}</tbody></table></div>\`;
  }
};
`;

// Substituir o bloco antigo de V.pesagem
const regexPesagem = /V\.pesagem=\{[\s\S]*?^\};\nfunction phone/m;
content = content.replace(regexPesagem, `${PISTA_MODULE_CODE}\n${novoVPesagem}\nfunction phone`);

// Adicionar os handlers de clique da pista dentro do listener global
const clickHandling = `
  // Interações diretas na Pista de Pesagem
  const pistaEl = e.target.closest('[data-pista-action]');
  if (pistaEl) {
    const act = pistaEl.dataset.pistaAction;
    const T = VT();
    const sc = SCALES[S.bal];
    const t = onScale(S.bal, T);
    const st = t ? stateAt(t, T) : null;
    const f = st ? st.f : 0, fase = st ? st.fase : 0;
    const w = t ? Math.round(weightAt(t, fase, f) / sc.e) * sc.e : 0;

    if (act === 'cancela-in') {
      TRACK_HW.cancelaIn = TRACK_HW.cancelaIn === 'aberta' ? 'fechada' : 'aberta';
      if (TRACK_HW.cancelaIn === 'aberta') TRACK_HW.semaforoIn = 'verde';
      else TRACK_HW.semaforoIn = 'vermelho';
      log('warn', 'Cancela Entrada ' + TRACK_HW.cancelaIn, S.bal + ' acionamento manual');
      toast('Cancela de Entrada da ' + S.bal + ': ' + TRACK_HW.cancelaIn.toUpperCase() + '. Semáforo: ' + TRACK_HW.semaforoIn.toUpperCase());
      V.pesagem.live();
      return;
    }
    if (act === 'cancela-out') {
      TRACK_HW.cancelaOut = TRACK_HW.cancelaOut === 'aberta' ? 'fechada' : 'aberta';
      if (TRACK_HW.cancelaOut === 'aberta') TRACK_HW.semaforoOut = 'verde';
      else TRACK_HW.semaforoOut = 'vermelho';
      log('warn', 'Cancela Saída ' + TRACK_HW.cancelaOut, S.bal + ' acionamento manual');
      toast('Cancela de Saída da ' + S.bal + ': ' + TRACK_HW.cancelaOut.toUpperCase() + '. Semáforo: ' + TRACK_HW.semaforoOut.toUpperCase());
      V.pesagem.live();
      return;
    }
    if (act === 'semaforo-in') {
      TRACK_HW.semaforoIn = TRACK_HW.semaforoIn === 'verde' ? 'vermelho' : 'verde';
      toast('Semáforo de Entrada da ' + S.bal + ': ' + TRACK_HW.semaforoIn.toUpperCase());
      V.pesagem.live();
      return;
    }
    if (act === 'semaforo-out') {
      TRACK_HW.semaforoOut = TRACK_HW.semaforoOut === 'verde' ? 'vermelho' : 'verde';
      toast('Semáforo de Saída da ' + S.bal + ': ' + TRACK_HW.semaforoOut.toUpperCase());
      V.pesagem.live();
      return;
    }
    if (act === 'celula') {
      const num = parseInt(pistaEl.dataset.celula || '1');
      const peso = pistaEl.dataset.peso || '0,1';
      openCelulaDrawer(num, peso);
      return;
    }
    if (act === 'caminhao') {
      openVeiculoConcretoDrawer(t, w, sc);
      return;
    }
    if (act === 'totem-lpr') {
      openTotemLprDrawer(t, sc);
      return;
    }
    if (act === 'totem-motorista') {
      openTotemMotoristaDrawer(t, w, sc);
      return;
    }
  }

  const btnFs = e.target.closest('[data-act="fullscreen"]');
  if (btnFs) {
    toggleFullscreen();
    return;
  }
`;

content = content.replace(
  "document.addEventListener('click',e=>{",
  `document.addEventListener('click',e=>{\n${clickHandling}`
);

// Gravar no web e sincronizar no app
fs.writeFileSync(filePath, content, 'utf8');

const appFilePath = path.resolve(__dirname, '../app/public/torre-pesagem.html');
fs.writeFileSync(appFilePath, content, 'utf8');

console.log('Sucesso! torre-pesagem.html atualizado em web/public e app/public com sintaxe limpa.');
