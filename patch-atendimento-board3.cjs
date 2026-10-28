const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAtendimentoBoard.jsx', 'utf8');

code = code.replace(/onOpenAppointment && onOpenAppointment\(item\)/g, "(item.status === 'em_atendimento' || item.status === 'concluido' ? onConferirComanda?.(item) : onOpenAppointment?.(item))");

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAtendimentoBoard.jsx', code, 'utf8');
console.log('Patched BarbeariaAtendimentoBoard.jsx onClick');
