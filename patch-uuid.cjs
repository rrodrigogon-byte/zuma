const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const oldUuid = `function ensureUuid(value, field, { allowAny = false } = {}) {
  const normalized = cleanText(value, 60);
  if (!normalized) return allowAny ? null : '';
  if (!UUID_REGEX.test(normalized)) {
    if (allowAny) return null; // Resiliência: o modelo às vezes injeta o nome no ID; no caso de agendamentos, o null instrui o backend a aceitar a falha e consultar todos.
    throw new WhatsappAiToolError(\`\${field} inválido (você deve usar o UUID exato fornecido por listar_servicos ou listar_profissionais)\`, 'INVALID_ID');
  }
  return normalized;
}`;

const newUuid = `function ensureUuid(value, field, { allowAny = false } = {}) {
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

code = code.replace(oldUuid, newUuid);

// Wait, I should also check toolAvailability because it does `if (!sId || (!pId && args.professionalId ...))` and imports barbershop-scheduling.js dynamically!
// If `ensureUuid` returns string, `sId` and `pId` will be ok. 
// BUT the fallback imports barbershop-scheduling.js which is WRONG for Kytto. Let me fix the fallback too.

const oldAvailCheck = `  if (!sId || (!pId && args.professionalId && args.professionalId !== 'qualquer' && args.professionalId !== 'indiferente')) {
     const { listSchedulingServices, listSchedulingProfessionals } = await import('./barbershop-scheduling.js');`;

const newAvailCheck = `  if (!sId || (!pId && args.professionalId && args.professionalId !== 'qualquer' && args.professionalId !== 'indiferente')) {
     const { listServices, listProfessionals } = await import('./barbershop-agenda.js');
     const listSchedulingServices = listServices;
     const listSchedulingProfessionals = listProfessionals;`;

code = code.replace(oldAvailCheck, newAvailCheck);

fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
