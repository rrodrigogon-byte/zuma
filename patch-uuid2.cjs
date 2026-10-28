const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const oldUuid = `function ensureUuid(value, field, { allowAny = false } = {}) {
  const normalized = cleanText(value, 60);
  if (!normalized) return allowAny ? null : '';
  
  // Relaxing UUID check for services and professionals since Kytto uses arbitrary JSON ids
  if (['serviceId', 'professionalId'].includes(field)) return normalized;

  if (!UUID_REGEX.test(normalized)) {
    if (allowAny) return null; // Resiliência: o modelo às vezes injeta o nome no ID
    throw new WhatsappAiToolError(\`\${field} inválido (você deve usar o ID exato fornecido por listar_servicos ou listar_profissionais)\`, 'INVALID_ID');
  }
  return normalized;
}`;

const newUuid = `function ensureUuid(value, field, { allowAny = false } = {}) {
  const normalized = cleanText(value, 60);
  if (!normalized) return allowAny ? null : '';
  
  // Relaxing UUID check completely because Kytto uses string keys like 'emp-kytto-001', 'dino', 'svc-01'
  return normalized;
}`;

code = code.replace(oldUuid, newUuid);

fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
