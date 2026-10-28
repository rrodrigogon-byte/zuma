const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/App.jsx', 'utf8');

const importStr = "const GestaoSalaoAvancada = lazy(() => import('./pages/admin/relatorios/dino/GestaoSalaoAvancada'));\n";
const routeStr = "          <Route path=\"/admin/relatorios/dino/gestao-avancada\" element={<Layout><GestaoSalaoAvancada /></Layout>} />\n";

if (!code.includes("GestaoSalaoAvancada")) {
  code = code.replace("const RelatoriosDinoIndex =", importStr + "const RelatoriosDinoIndex =");
  code = code.replace("<Route path=\"/admin/relatorios/dino\" element={<Layout><RelatoriosDinoIndex /></Layout>} />", "<Route path=\"/admin/relatorios/dino\" element={<Layout><RelatoriosDinoIndex /></Layout>} />\n" + routeStr);
  fs.writeFileSync('/home/ubuntu/agro-open/web/src/App.jsx', code, 'utf8');
  console.log('App.jsx patched successfully');
}
