const fs = require('fs');
let code = fs.readFileSync('web/src/pages/admin/BarbeariaERP.jsx', 'utf8');

code = code.replace(
  '"Projeção inteligente",\n      "Ocupação e metas",',
  '"Projeção inteligente",\n      "Painel de gestão",\n      "Ocupação e metas",'
);

code = code.replace(
  'const DinoBusinessDashboard = lazy(() => import("./DinoBusinessDashboard"));',
  'const DinoBusinessDashboard = lazy(() => import("./DinoBusinessDashboard"));\nconst DinoDashboardKytto = lazy(() => import("./dino/DinoDashboardKytto"));'
);

code = code.replace(
  'if (tab === "Ocupação e metas") return <OcupacaoMetasPanel />;',
  'if (tab === "Painel de gestão")\n      return (\n        <Suspense\n          fallback={\n            <Card\n              style={{\n                padding: 40,\n                textAlign: "center",\n                color: "var(--muted)",\n              }}\n            >\n              Carregando painel de gestão…\n            </Card>\n          }\n        >\n          <DinoDashboardKytto />\n        </Suspense>\n      );\n\n    if (tab === "Ocupação e metas") return <OcupacaoMetasPanel />;'
);

fs.writeFileSync('web/src/pages/admin/BarbeariaERP.jsx', code);
