const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAgendaPeriodo.jsx', 'utf8');

const oldExport = `export default function BarbeariaAgendaPeriodo({
  profissionais = [],
  servicos = [],
  profissionalId = '',
  onProfissionalChange,
  onOpenAppointment,
  onPickSlot,
  refreshKey,
  dataSelecionada,
  onDateChange,
  statusFiltro = '',
}) {`;

const newExport = `export default function BarbeariaAgendaPeriodo({
  profissionais = [],
  servicos = [],
  profissionalId = '',
  onProfissionalChange,
  onConferirComanda,
  onOpenAppointment,
  onPickSlot,
  refreshKey,
  dataSelecionada,
  onDateChange,
  statusFiltro = '',
}) {`;

const oldClick = `onClick={() => item.isBloqueio ? null : onOpenAppointment?.(item)}`;
const newClick = `onClick={() => item.isBloqueio ? null : (item.status === 'em_atendimento' || item.status === 'concluido' ? onConferirComanda?.(item) : onOpenAppointment?.(item))}`;

code = code.replace(oldExport, newExport);
code = code.split(oldClick).join(newClick);

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaAgendaPeriodo.jsx', code, 'utf8');
console.log('Patched BarbeariaAgendaPeriodo.jsx');
