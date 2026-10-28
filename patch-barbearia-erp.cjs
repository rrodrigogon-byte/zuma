const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/barbearia-erp-kytto.js', 'utf8');

const oldAtendimentos = `
    .map((item) => {
      const lancamento = recebido(item);
      return lancamento ? { ...item, valorRecebido: Number(lancamento.valor), meioPagamento: lancamento.meioPagamento, origemTipo: 'agendamento', origemId: item.id, dataRef: item.dataAgenda || diaOperacional(item.dataHora), nomeItem: item.servicoNome || '', quantidade: 1 } : null;
    }).filter(Boolean);`;

const newAtendimentos = `
    .map((item) => {
      const lancamento = recebido(item);
      // Inclui todos os serviços concluídos, mesmo se não tiver lançamento no ledger ainda.
      const valor = lancamento ? Number(lancamento.valor) : Number(item.servicoPreco || item.valor || 0);
      const meioPagamento = lancamento ? lancamento.meioPagamento : 'nao_informado';
      return { ...item, valorRecebido: valor, meioPagamento, origemTipo: 'agendamento', origemId: item.id, dataRef: item.dataAgenda || diaOperacional(item.dataHora), nomeItem: item.servicoNome || '', quantidade: 1 };
    }).filter(Boolean);`;

code = code.replace(oldAtendimentos, newAtendimentos);
fs.writeFileSync('/home/ubuntu/agro-open/app/barbearia-erp-kytto.js', code, 'utf8');
console.log('Patched barbearia-erp-kytto.js');
