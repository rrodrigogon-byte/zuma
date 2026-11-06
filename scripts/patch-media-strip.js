import fs from 'node:fs';

// 1. Atualizar whatsapp-ai-intents.js
let intentsCode = fs.readFileSync('app/core/whatsapp-ai-intents.js', 'utf8');

const antigoNormalize = `function normalize(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(.)\\1{2,}/g, '$1$1') // "simmmm" -> "simm"
    .trim();
}`;

const novoNormalize = `export function stripMediaPrefix(text) {
  return String(text ?? '')
    .replace(/^\\[(?:áudio|audio|mensagem de voz|foto|imagem|documento)(?:\\s+transcrit[oa]|\\s+enviad[oa])?\\]\\s*/i, '')
    .trim();
}

function normalize(text) {
  return stripMediaPrefix(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(.)\\1{2,}/g, '$1$1') // "simmmm" -> "simm"
    .trim();
}`;

if (intentsCode.includes(antigoNormalize)) {
  intentsCode = intentsCode.replace(antigoNormalize, novoNormalize);
  fs.writeFileSync('app/core/whatsapp-ai-intents.js', intentsCode, 'utf8');
  console.log('whatsapp-ai-intents.js atualizado com sucesso!');
} else {
  console.log('AVISO: antigoNormalize não encontrado exatamente em whatsapp-ai-intents.js');
}

// 2. Atualizar whatsapp-ai.js
let aiCode = fs.readFileSync('app/core/whatsapp-ai.js', 'utf8');

const antigoPresence = `export function presenceConfirmIntent(text) {
  const raw = String(text ?? '').trim();`;

const novoPresence = `export function presenceConfirmIntent(text) {
  const raw = String(text ?? '')
    .replace(/^\\[(?:áudio|audio|mensagem de voz|foto|imagem|documento)(?:\\s+transcrit[oa]|\\s+enviad[oa])?\\]\\s*/i, '')
    .trim();`;

if (aiCode.includes(antigoPresence)) {
  aiCode = aiCode.replace(antigoPresence, novoPresence);
  fs.writeFileSync('app/core/whatsapp-ai.js', aiCode, 'utf8');
  console.log('whatsapp-ai.js atualizado com sucesso!');
} else {
  console.log('AVISO: antigoPresence não encontrado exatamente em whatsapp-ai.js');
}
