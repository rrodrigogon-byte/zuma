const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAtendimentoBoard.jsx', 'utf8');

const oldExport = `export default function BarbeariaAtendimentoBoard({
  dataSelecionada,
  onDateChange,
  agendamentos = [],
  profissionais = [],
  servicos = [],
  produtosRevenda = [],
  comandas = [],
  onStatusChange,
  onOpenAppointment,
  onOpenComanda,
}) {`;

const newExport = `export default function BarbeariaAtendimentoBoard({
  dataSelecionada,
  onDateChange,
  agendamentos = [],
  profissionais = [],
  servicos = [],
  produtosRevenda = [],
  comandas = [],
  onStatusChange,
  onConferirComanda,
  onOpenAppointment,
  onOpenComanda,
}) {`;

const oldClick = `          onClick={() => {
            if (acaoPrincipal) {
              onStatusChange?.(agendamento, acaoPrincipal.key)
            } else {
              onClick()
            }
          }}`;

const newClick = `          onClick={() => {
            if (acaoPrincipal) {
              onStatusChange?.(agendamento, acaoPrincipal.key)
            } else if (agendamento.status === 'em_atendimento' || agendamento.status === 'concluido') {
              onConferirComanda?.(agendamento)
            } else {
              onClick()
            }
          }}`;

code = code.replace(oldExport, newExport);
code = code.replace(oldClick, newClick);

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAtendimentoBoard.jsx', code, 'utf8');
console.log('Patched BarbeariaAtendimentoBoard.jsx');
