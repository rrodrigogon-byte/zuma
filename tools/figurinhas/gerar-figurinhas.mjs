// Gera as figurinhas do T-Rex (WebP 512x512, fundo transparente, contorno branco
// "recortado") a partir do MESMO SVG do componente do canvas (TRex.dc.html).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// playwright e sharp NÃO são dependências do app: instale só para gerar
// (npm i --no-save playwright sharp @fontsource/sora) ou aponte NODE_PATH.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const here = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(here, 'trex-template.svg'), 'utf8');
const svgTemplate = src.slice(src.indexOf('<svg'), src.indexOf('</svg>') + 6);
const out = process.env.FIGURINHAS_OUT || path.join(here, '..', '..', 'web', 'public', 'figurinhas');
fs.mkdirSync(out, { recursive: true });

function vals(mood) {
  const base = { eye: 'open', look: 'front', brow: 'normal', mouth: 'grin', arm: 'rest', item: '', blush: false, hair: true, hat: false, sweat: false, thought: false, sparkle: false, confetti: false, speed: false };
  const map = {
    neutro: {}, ola: { arm: 'up', mouth: 'laugh', brow: 'raised', sparkle: true },
    agendado: { arm: 'up', item: 'calendar' }, lembrete: { arm: 'up', item: 'clock', mouth: 'o', brow: 'raised' },
    confirmado: { arm: 'up', item: 'check', eye: 'closed', mouth: 'laugh' }, chegando: { brow: 'determined', speed: true, sweat: true },
    valeu: { arm: 'up', item: 'heart', eye: 'closed', blush: true }, cheiroso: { arm: 'up', item: 'perfume', eye: 'closed', mouth: 'smirk', sparkle: true, blush: true },
    parabens: { arm: 'up', eye: 'closed', mouth: 'laugh', hat: true, hair: false, confetti: true }, corte: { arm: 'up', item: 'scissors', brow: 'determined', mouth: 'smirk' },
    pensando: { look: 'up', brow: 'raised', mouth: 'flat', thought: true }, desculpa: { brow: 'worried', mouth: 'wavy', sweat: true, eye: 'wide' },
    promo: { arm: 'up', item: 'tag', eye: 'heart', mouth: 'laugh', sparkle: true },
  };
  const m = { ...base, ...(map[mood] || {}) };
  const on = (x) => (x ? 'inline' : 'none');
  const brows = { normal: 'M176 76 Q190 70 204 76', raised: 'M176 70 Q190 62 204 70', determined: 'M176 74 L204 81', worried: 'M176 81 L204 73' };
  const up = m.look === 'up';
  return {
    armUp: on(m.arm === 'up'), armRest: on(m.arm !== 'up'), pocketScissors: on(m.item !== 'scissors'),
    hair: on(m.hair), hat: on(m.hat), blush: m.blush ? '0.55' : '0',
    eyeOpen: on(m.eye === 'open'), eyeWide: on(m.eye === 'wide'), eyeClosed: on(m.eye === 'closed'), eyeHeart: on(m.eye === 'heart'),
    pupilX: up ? 193 : 194, pupilY: up ? 88 : 96, shineX: up ? 196 : 197, shineY: up ? 85 : 92,
    brow: brows[m.brow] || brows.normal,
    mouthGrin: on(m.mouth === 'grin'), mouthLaugh: on(m.mouth === 'laugh'), mouthO: on(m.mouth === 'o'),
    mouthFlat: on(m.mouth === 'flat'), mouthWavy: on(m.mouth === 'wavy'), mouthSmirk: on(m.mouth === 'smirk'),
    sweat: on(m.sweat), thought: on(m.thought), sparkle: on(m.sparkle), confetti: on(m.confetti), speed: on(m.speed),
    itScissors: on(m.item === 'scissors'), itPerfume: on(m.item === 'perfume'), itCalendar: on(m.item === 'calendar'),
    itClock: on(m.item === 'clock'), itCheck: on(m.item === 'check'), itHeart: on(m.item === 'heart'), itTag: on(m.item === 'tag'),
  };
}

// Legenda curta, no estilo de figurinha; a mesma da cartela do canvas.
export const STICKERS = [
  ['ola', 'E aí!'], ['agendado', 'Agendado!'], ['lembrete', 'Amanhã, hein?'], ['confirmado', 'Confirmado'],
  ['chegando', 'Tô chegando'], ['valeu', 'Valeu!'], ['cheiroso', 'Cheirosão'], ['parabens', 'Parabéns!'],
  ['corte', 'Na régua'], ['pensando', 'Deixa eu ver…'], ['desculpa', 'Foi mal!'], ['promo', 'Promoção!'], ['neutro', ''],
];

function stickerSvg(mood, caption) {
  const v = vals(mood);
  let svg = svgTemplate
    .replace(/\{\{v\.(\w+)\}\}/g, (_, k) => String(v[k]))
    .replace(/\{\{label\}\}/g, 'T-Rex')
    .replace(/<svg[^>]*>/, '<g>')
    .replace(/<\/svg>$/, '</g>')
    .replace(/<ellipse cx="164" cy="302"[^>]*><\/ellipse>/, ''); // sem sombra no chão (fundo transparente)
  // Elementos com display="none" saem do desenho (e do contorno).
  const dino = svg;
  const hasCaption = Boolean(caption);
  const scale = hasCaption ? 1.32 : 1.5;
  const tx = (512 - 320 * scale) / 2;
  const ty = hasCaption ? 6 : (512 - 320 * scale) / 2;
  const capW = Math.max(200, caption.length * 27 + 64);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs>
<filter id="recorte" x="-10%" y="-10%" width="120%" height="120%">
<feMorphology in="SourceAlpha" operator="dilate" radius="9" result="d"/>
<feFlood flood-color="#FFFFFF"/><feComposite in2="d" operator="in" result="borda"/>
<feMorphology in="SourceAlpha" operator="dilate" radius="11" result="d2"/>
<feFlood flood-color="#000000" flood-opacity="0.18"/><feComposite in2="d2" operator="in" result="sombra"/>
<feOffset in="sombra" dy="4" result="sombra2"/>
<feMerge><feMergeNode in="sombra2"/><feMergeNode in="borda"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
<g filter="url(#recorte)">
<g transform="translate(${tx} ${ty}) scale(${scale})">${dino}</g>
${hasCaption ? `<g transform="rotate(-4 256 452)"><rect x="${256 - capW / 2}" y="414" width="${capW}" height="72" rx="20" fill="#4B57A6"/>
<text x="256" y="463" text-anchor="middle" font-family="Sora" font-weight="800" font-size="40" fill="#F5F3EE">${caption}</text></g>` : ''}
</g>
</svg>`;
}

const soraWoff2 = require.resolve('@fontsource/sora/files/sora-latin-800-normal.woff2');
const fontCss = `@font-face{font-family:'Sora';font-weight:800;src:url('file://${soraWoff2}') format('woff2');}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
const manifest = [];
for (const [mood, caption] of STICKERS) {
  const html = `<!doctype html><html><head><style>${fontCss} html,body{margin:0;background:transparent}</style></head><body>${stickerSvg(mood, caption)}</body></html>`;
  const tmp = path.join(out, `_render-${mood}.html`);
  fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
  fs.writeFileSync(path.join(out, `_trex-${mood}.png`), png);
  let quality = 90;
  let webp;
  do {
    webp = await sharp(png).webp({ quality, alphaQuality: 100, effort: 6 }).toBuffer();
    quality -= 8;
  } while (webp.length > 95 * 1024 && quality > 30);
  fs.writeFileSync(path.join(out, `trex-${mood}.webp`), webp);
  manifest.push({ mood, caption, file: `trex-${mood}.webp`, bytes: webp.length });
}
// Ícone da bandeja do pacote (96x96 PNG), exigido pelos apps de figurinhas.
await sharp(path.join(out, '_trex-ola.png')).resize(96, 96).png().toFile(path.join(out, 'tray.png'));
for (const f of fs.readdirSync(out)) if (f.startsWith('_')) fs.unlinkSync(path.join(out, f));
await browser.close();

console.log(manifest.map((m) => `${m.file} ${(m.bytes / 1024).toFixed(1)}KB`).join('\n'));
