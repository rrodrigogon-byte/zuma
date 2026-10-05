# Figurinhas do T-Rex

Gera `web/public/figurinhas/trex-*.webp` (512x512, fundo transparente, contorno branco de recorte, legenda) e `tray.png` (96x96) a partir de `trex-template.svg`.

```bash
cd tools/figurinhas
npm i --no-save playwright sharp @fontsource/sora
npx playwright install chromium   # ou CHROMIUM_PATH=/caminho/do/chrome
node gerar-figurinhas.mjs
```

- Os humores, legendas e regras de expressão ficam em `gerar-figurinhas.mjs` (`vals()` e `STICKERS`), iguais ao componente do canvas de design.
- Cada arquivo sai abaixo de 95 KB (limite do WhatsApp: 100 KB).
- Depois de gerar, rode `node --test app/core/whatsapp-stickers.test.js`: o teste confere que cada figurinha do catálogo existe, é WebP e cabe no limite.
- Quando e como o atendente usa: `app/core/whatsapp-stickers.js` e `docs/operations/WHATSAPP-BACKEND-FIGURINHA.md`.
