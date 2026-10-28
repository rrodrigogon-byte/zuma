const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const oldRequest = `  const request = {
    storefrontId: storefront.id,
    shippingMethodId: method.rows[0].id,
    items,
    customer: { nome: cleanText(args.customerName || scope.customerName, 100), telefone: scope.phone },
    note: 'Pedido preparado pelo atendimento WhatsApp.',
  };`;

const newRequest = `  const request = {
    storefrontId: storefront.id,
    shippingMethodId: method.rows[0].id,
    items,
    customer: { 
      nome: cleanText(args.customerName || scope.customerName, 100), 
      telefone: scope.phone,
      documentoMascarado: cleanText(args.customerDocument, 20) || undefined
    },
    note: 'Pedido preparado pelo atendimento WhatsApp.',
  };`;

code = code.replace(oldRequest, newRequest);
fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
console.log('Patched');
