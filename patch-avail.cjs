const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const oldAvail = `async function toolAvailability(context, args = {}) {
  const scope = contextScope(context);
  const sId = ensureUuid(args.serviceId, 'serviceId', { allowAny: true });
  const pId = ensureUuid(args.professionalId, 'professionalId', { allowAny: true });
  if (!sId || (!pId && args.professionalId && args.professionalId !== 'qualquer' && args.professionalId !== 'indiferente')) {`;

const newAvail = `async function toolAvailability(context, args = {}) {
  const scope = contextScope(context);
  const sId = ensureUuid(args.serviceId, 'serviceId', { allowAny: true });
  const pId = ensureUuid(args.professionalId, 'professionalId', { allowAny: true });
  
  // No Kytto os IDs podem ser strings genéricas, então precisamos verificar se o ID fornecido realmente existe
  // Caso contrário, forçamos o !sId para que ele retorne a lista de serviços correta para a IA tentar de novo
  let serviceExists = true;
  let professionalExists = true;
  if (sId) {
    const { listServices, listProfessionals } = await import('./barbershop-agenda.js');
    const servicos = await listServices(scope);
    if (!servicos.find(s => s.id === sId)) serviceExists = false;
    
    if (pId && pId !== 'qualquer' && pId !== 'indiferente') {
      const profissionais = await listProfessionals(scope);
      if (!profissionais.find(p => p.id === pId)) professionalExists = false;
    }
  }

  if (!sId || !serviceExists || !professionalExists || (!pId && args.professionalId && args.professionalId !== 'qualquer' && args.professionalId !== 'indiferente')) {`;

code = code.replace(oldAvail, newAvail);
fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
console.log('Patched avail');
