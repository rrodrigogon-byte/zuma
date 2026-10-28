const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/dino-metas-gamificacao.js', 'utf8');

const oldEhExtra = `        const ehExtra = /extra|adicional|sobrancelha|pigmenta|spa|massagem|barboterapia|hidrata/i.test(ag.servicoNome || '');
        if (ehExtra) {
          stats[profId].dia.servicosExtras += 1;
          stats[profId].dia.servicosExtrasLista.push({ nome: ag.servicoNome || 'Serviço Extra (Agendado)', valor: valorAg });
          stats[profId].semana.servicosExtras += 1;
        }`;

const newEhExtra = `        let servicoNomeAtual = ag.servicoNome || '';
        if (!servicoNomeAtual && ag.servicoId) {
          try {
            const estadoSrv = require('./barbearia-erp-kytto.js').estadoEmpresa(emp, false);
            if (estadoSrv.servicos && estadoSrv.servicos[ag.servicoId]) {
              servicoNomeAtual = estadoSrv.servicos[ag.servicoId].nome || '';
            }
          } catch (err) {}
        }
        const ehExtra = /extra|adicional|sobrancelha|pigmenta|spa|massagem|barboterapia|hidrata/i.test(servicoNomeAtual || '');
        if (ehExtra) {
          stats[profId].dia.servicosExtras += 1;
          stats[profId].dia.servicosExtrasLista.push({ nome: servicoNomeAtual || 'Serviço Extra (Agendado)', valor: valorAg });
          stats[profId].semana.servicosExtras += 1;
        }`;

code = code.replace(oldEhExtra, newEhExtra);
fs.writeFileSync('/home/ubuntu/agro-open/app/dino-metas-gamificacao.js', code, 'utf8');
console.log('Patched servicoNome');
