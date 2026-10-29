const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/modules/compras/routes.js', 'utf8');

const importadorImport = "import { sincronizarDFeSefaz } from '../fiscal/dist-dfe.js';\n";
if (!code.includes('sincronizarDFeSefaz')) {
  code = code.replace("import express from 'express';", "import express from 'express';\n" + importadorImport);
}

const newRoute = `
router.post('/sincronizar-sefaz', requirePermission('compras:edit'), async (req, res) => {
  try {
    const result = await sincronizarDFeSefaz(req.tenantId, req.user.id);
    res.json({ sucesso: true, result });
  } catch (e) {
    res.status(400).json({ sucesso: false, erro: e.message });
  }
});
`;

if (!code.includes('/sincronizar-sefaz')) {
  code = code.replace("// ── PEDIDOS DE COMPRA ─────────────────────────────────────────────────────────", newRoute + "\n// ── PEDIDOS DE COMPRA ─────────────────────────────────────────────────────────");
  fs.writeFileSync('/home/ubuntu/agro-open/app/modules/compras/routes.js', code);
  console.log('Rotas de compras atualizadas.');
}
