const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/dino-metas-gamificacao.js', 'utf8');

const oldAg = `      const dataAg = ag.data;
      const noDia = dataAg === dataIso || dataAg === dataIsoCuiaba(new Date().toISOString());`;

const newAg = `      const dataAg = ag.data || ag.dataAgenda || (ag.dataHora ? String(ag.dataHora).slice(0, 10) : '');
      let dataAgCuiaba = '';
      try { dataAgCuiaba = ag.dataHora ? dataIsoCuiaba(ag.dataHora) : ''; } catch {}
      const noDia = dataAg === dataIso || dataAg === dataIsoCuiaba(new Date().toISOString()) || dataAgCuiaba === dataIso;`;

code = code.replace(oldAg, newAg);
fs.writeFileSync('/home/ubuntu/agro-open/app/dino-metas-gamificacao.js', code, 'utf8');
console.log('Patched Gamificacao');
