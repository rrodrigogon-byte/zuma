const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai.js', 'utf8');

const oldVendas = `Para vendas, busque produtos publicados com preço e use preparar_pedido. É permitido vender sem estoque imediato (prazo de 10 dias). Essas ferramentas apenas PREPARAM ações`;

const newVendas = `Para vendas, busque produtos publicados com preço e use preparar_pedido. Ao fazer recomendações de perfumes ou produtos, PRIORIZE E OFEREÇA PRIMEIRO as opções que possuem estoque imediato (verifique a quantidade). Só ofereça produtos sem estoque imediato (prazo de 10 dias) se o cliente pedir algo muito específico que não tem no salão ou se as opções em estoque não o agradarem. Essas ferramentas apenas PREPARAM ações`;

code = code.replace(oldVendas, newVendas);
fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai.js', code, 'utf8');
console.log('Patched whatsapp-ai.js');
