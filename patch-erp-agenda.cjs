const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', 'utf8');

const oldAgendaPeriodo = `<BarbeariaAgendaPeriodo
          profissionais={atendentesAtivos}
          servicos={servicos}
          profissionalId={profissionalFiltro}
          onProfissionalChange={setProfissionalFiltro}
          onOpenAppointment={(item) => setModal({ tipo: 'detalheAgenda', agendamento: item })}`;

const newAgendaPeriodo = `<BarbeariaAgendaPeriodo
          profissionais={atendentesAtivos}
          servicos={servicos}
          profissionalId={profissionalFiltro}
          onProfissionalChange={setProfissionalFiltro}
          onConferirComanda={conferirComandaDoAtendimento}
          onOpenAppointment={(item) => setModal({ tipo: 'detalheAgenda', agendamento: item })}`;

const oldAtendimentoBoard = `<BarbeariaAtendimentoBoard
          dataSelecionada={dataSelecionada}
          onDateChange={(novaData) => setDataSelecionada(novaData)}
          agendamentos={agendamentos}
          profissionais={profissionais}
          servicos={servicos}
          produtosRevenda={produtosRevenda}
          comandas={comandas}
          onStatusChange={mudarStatusAtendimento}
          onOpenAppointment={(item) => setModal({ tipo: 'detalheAgenda', agendamento: item })}
          onOpenComanda={abrirComanda}`;

const newAtendimentoBoard = `<BarbeariaAtendimentoBoard
          dataSelecionada={dataSelecionada}
          onDateChange={(novaData) => setDataSelecionada(novaData)}
          agendamentos={agendamentos}
          profissionais={profissionais}
          servicos={servicos}
          produtosRevenda={produtosRevenda}
          comandas={comandas}
          onStatusChange={mudarStatusAtendimento}
          onConferirComanda={conferirComandaDoAtendimento}
          onOpenAppointment={(item) => setModal({ tipo: 'detalheAgenda', agendamento: item })}
          onOpenComanda={abrirComanda}`;

code = code.replace(oldAgendaPeriodo, newAgendaPeriodo);
code = code.replace(oldAtendimentoBoard, newAtendimentoBoard);

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', code, 'utf8');
console.log('Patched BarbeariaERP.jsx to pass onConferirComanda');
