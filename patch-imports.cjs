const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const oldSchedulingImport = `import {
  createScheduledAppointment,
  listSchedulingAvailability,
  listSchedulingProfessionals,
  listSchedulingServices,
  SchedulingError,
} from './barbershop-scheduling.js';`;

const newSchedulingImport = `import {
  createAppointment as createScheduledAppointment,
  availability as listSchedulingAvailability,
  listProfessionals as listSchedulingProfessionals,
  listServices as listSchedulingServices,
  SchedulingError,
} from './barbershop-agenda.js';`;

const oldCrmImport = `import {
  ensureWhatsappLead,
  getWhatsappLeadProfile,
  updateWhatsappMarketingConsent,
  listWhatsappCustomerAppointments,
  listActiveWhatsappPromotions,
  queueWhatsappPromotion,
  rescheduleWhatsappAppointment,
  cancelWhatsappAppointment,
} from './whatsapp-ai-crm.js';`;

const newCrmImport = `import {
  ensureWhatsappLead,
  getWhatsappLeadProfile,
  updateWhatsappMarketingConsent,
  listActiveWhatsappPromotions,
  queueWhatsappPromotion,
} from './whatsapp-ai-crm.js';
import {
  listCustomerAppointments as listWhatsappCustomerAppointments,
  rescheduleAppointment as rescheduleWhatsappAppointment,
  cancelAppointment as cancelWhatsappAppointment,
} from './barbershop-agenda.js';`;

code = code.replace(oldSchedulingImport, newSchedulingImport);
code = code.replace(oldCrmImport, newCrmImport);

fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
console.log('Patched whatsapp-ai-tools.js');
