const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const target = "}).filter(variant => variant.preco > 0 && variant.estoque > 0),";
const replacement = "}).filter(variant => variant.preco > 0),";

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
  console.log('Patched toolProducts successfully.');
} else {
  console.log('Target not found in toolProducts.');
}
