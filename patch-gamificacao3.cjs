const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/dino-metas-gamificacao.js', 'utf8');

const oldRev = `const rawVenda = venda.criadoEm || '';
      if (!rawVenda) continue;
      const dataVenda = rawVenda.slice(0, 10);
      let dataVendaCuiaba = '';
      try { dataVendaCuiaba = dataIsoCuiaba(rawVenda); } catch {}`;

const newRev = `const rawVenda = venda.criadoEm || '';
      if (!rawVenda) continue;
      const dataVenda = rawVenda.slice(0, 10);
      let dataVendaCuiaba = '';
      try { dataVendaCuiaba = dataIsoCuiaba(rawVenda); } catch {}
      // Ajuste para vendas legadas
      const dataRef = venda.dataRef || '';
      if (dataRef && dataRef === dataIso) dataVendaCuiaba = dataIso;`;

code = code.replace(oldRev, newRev);
fs.writeFileSync('/home/ubuntu/agro-open/app/dino-metas-gamificacao.js', code, 'utf8');
console.log('Patched vendasRevenda');
