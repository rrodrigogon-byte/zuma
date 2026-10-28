const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const oldPrep = `async function toolPrepareAppointment(context, args = {}) {
  const scope = contextScope(context);
  const serviceId = ensureUuid(args.serviceId, 'serviceId', { allowAny: true });
  const professionalId = ensureUuid(args.professionalId, 'professionalId', { allowAny: true });
  if (!serviceId || (!professionalId && args.professionalId && args.professionalId !== 'qualquer' && args.professionalId !== 'indiferente')) {
     const { listSchedulingServices, listSchedulingProfessionals } = await import('./barbershop-scheduling.js');`;

const newPrep = `async function toolPrepareAppointment(context, args = {}) {
  const scope = contextScope(context);
  const serviceId = ensureUuid(args.serviceId, 'serviceId', { allowAny: true });
  const professionalId = ensureUuid(args.professionalId, 'professionalId', { allowAny: true });
  
  let serviceExists = true;
  let professionalExists = true;
  if (serviceId) {
    const { listServices, listProfessionals } = await import('./barbershop-agenda.js');
    const servicos = await listServices(scope);
    if (!servicos.find(s => s.id === serviceId)) serviceExists = false;
    
    if (professionalId && professionalId !== 'qualquer' && professionalId !== 'indiferente') {
      const profissionais = await listProfessionals(scope);
      if (!profissionais.find(p => p.id === professionalId)) professionalExists = false;
    }
  }

  if (!serviceId || !serviceExists || !professionalExists || (!professionalId && args.professionalId && args.professionalId !== 'qualquer' && args.professionalId !== 'indiferente')) {
     const { listServices, listProfessionals } = await import('./barbershop-agenda.js');
     const listSchedulingServices = listServices;
     const listSchedulingProfessionals = listProfessionals;`;

code = code.replace(oldPrep, newPrep);
fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
console.log('Patched prep');
