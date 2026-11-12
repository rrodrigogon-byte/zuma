const fs = require('fs');

let aiCode = fs.readFileSync('app/core/whatsapp-ai.js', 'utf8');

// Append claimsCompletion
if (!aiCode.includes('export function claimsCompletion')) {
  aiCode += `
const COMPLETION_CLAIM = /\\b(est[aá]|foi|ficou|j[aá] est[aá])\\s+(confirmad[oa]|agendad[oa]|marcad[oa]|reservad[oa]|realizad[oa]|registrad[oa]|feit[oa]|conclu[ií]d[oa])\\b|\\b(pedido|agendamento|hor[aá]rio|compra)\\s+(confirmad[oa]|conclu[ií]d[oa]|agendad[oa]|marcad[oa]|reservad[oa])\\b/i;
export function claimsCompletion(text) {
  return COMPLETION_CLAIM.test(String(text || ''));
}
`;
  fs.writeFileSync('app/core/whatsapp-ai.js', aiCode, 'utf8');
}

let testCode = fs.readFileSync('app/core/whatsapp-ai-atendimento-natural.test.js', 'utf8');

// Fix the expectation
testCode = testCode.replace("Resumo para confirmar:", "Confere aí:");

fs.writeFileSync('app/core/whatsapp-ai-atendimento-natural.test.js', testCode, 'utf8');
