const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAtendimentoBoard.jsx', 'utf8');

code = code.replace(`  onOpenAppointment,
  onOpenComanda,`, `  onConferirComanda,
  onOpenAppointment,
  onOpenComanda,`);

code = code.replace(`          onClick={() => {
            if (acaoPrincipal) {
              onStatusChange?.(agendamento, acaoPrincipal.key)
            } else {
              onClick()
            }
          }}`, `          onClick={() => {
            if (acaoPrincipal) {
              onStatusChange?.(agendamento, acaoPrincipal.key)
            } else if (agendamento.status === 'em_atendimento' || agendamento.status === 'concluido') {
              onConferirComanda?.(agendamento)
            } else {
              onClick()
            }
          }}`);

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAtendimentoBoard.jsx', code, 'utf8');
console.log('Patched BarbeariaAtendimentoBoard.jsx');
