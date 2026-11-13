const fs = require('fs');
let code = fs.readFileSync('web/src/components/Sidebar.jsx', 'utf8');

code = code.replace(
  "{ to: '/admin/barbearia-erp?area=gestao&tab=Desempenho+da+equipe', icon: '↗', label: 'Desempenho da equipe' },",
  "{ to: '/admin/barbearia-erp?area=gestao&tab=Painel+de+gestão', icon: '↗', label: 'Painel de gestão' },\n      { to: '/admin/barbearia-erp?area=gestao&tab=Desempenho+da+equipe', icon: '↗', label: 'Desempenho da equipe' },"
);

fs.writeFileSync('web/src/components/Sidebar.jsx', code);
