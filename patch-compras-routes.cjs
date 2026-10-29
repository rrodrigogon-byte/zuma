const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/modules/compras/routes.js', 'utf8');

const importadorImport = "import { processarNFAi } from './importador-nf.js';\nimport express from 'express';\n";
code = code.replace("import express from 'express';", importadorImport);

const newRoute = `
router.post('/importar-nf', express.json({ limit: '10mb' }), requirePermission('compras:edit'), async (req, res) => {
  try {
    const { base64, mimeType, isXml } = req.body;
    if (!base64) return res.status(400).json({ sucesso: false, erro: 'Arquivo não fornecido.' });
    
    const result = await processarNFAi(req.tenantId, req.user.id, base64, mimeType, isXml);
    res.json({ sucesso: true, result });
  } catch (e) {
    res.status(400).json({ sucesso: false, erro: e.message });
  }
});
`;

code = code.replace("// ── PEDIDOS DE COMPRA ─────────────────────────────────────────────────────────", newRoute + "\n// ── PEDIDOS DE COMPRA ─────────────────────────────────────────────────────────");

fs.writeFileSync('/home/ubuntu/agro-open/app/modules/compras/routes.js', code);
console.log('Rotas de compras atualizadas.');
