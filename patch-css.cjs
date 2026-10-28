const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAgendaPeriodo.css', 'utf8');

code = code.replace(`.dino-cal-event-card[data-status="em_atendimento"] {
  border-left-color: #f59e0b;
  background: color-mix(in srgb, #f59e0b 8%, var(--card));
}`, `.dino-cal-event-card[data-status="em_atendimento"] {
  border-left-color: #8b5cf6;
  background: color-mix(in srgb, #8b5cf6 6%, var(--card));
}`);

code = code.replace(`.dino-cal-event-card[data-status="agendado"] {
  border-left-color: #8b5cf6;
  background: color-mix(in srgb, #8b5cf6 6%, var(--card));
}`, `.dino-cal-event-card[data-status="agendado"] {
  border-left-color: #3b82f6;
  background: color-mix(in srgb, #3b82f6 6%, var(--card));
}`);

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAgendaPeriodo.css', code, 'utf8');
console.log('Patched BarbeariaAgendaPeriodo.css');
