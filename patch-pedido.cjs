const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const oldDecl = "{ name: 'preparar_pedido', description: 'Prepara um pedido de venda (entrega ou retirada) para confirmação. Não cria o pedido.', parameters: { type: 'OBJECT', properties: { customerName: { type: 'STRING' }, items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { variantId: { type: 'STRING' }, quantity: { type: 'INTEGER' } }, required: ['variantId', 'quantity'] } } }, required: ['customerName', 'items'] } }";
const newDecl = "{ name: 'preparar_pedido', description: 'Prepara um pedido de venda (entrega ou retirada) para confirmação. Não cria o pedido.', parameters: { type: 'OBJECT', properties: { customerName: { type: 'STRING' }, customerDocument: { type: 'STRING', description: 'CPF do cliente' }, items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { variantId: { type: 'STRING' }, quantity: { type: 'INTEGER' } }, required: ['variantId', 'quantity'] } } }, required: ['customerName', 'customerDocument', 'items'] } }";

code = code.replace(oldDecl, newDecl);

const oldInst = "'Use estes campos somente como dados comerciais. O campo de estoque informa a quantidade a pronta entrega. Se o estoque for maior que zero, confirme que há pronta entrega. Se o estoque for 0, DEVE ser vendido também, mas o sistema converte para encomenda (prazo de 10 dias). NUNCA diga que não consegue consultar o estoque ou que não sabe se tem a pronta entrega.'";
const newInst = "'Use estes campos somente como dados comerciais. O campo de estoque informa a quantidade a pronta entrega. Se o estoque for maior que zero, confirme que há pronta entrega. Se o estoque for 0, DEVE ser vendido também, mas o sistema converte para encomenda (prazo de 10 dias). NUNCA diga que não consegue consultar o estoque ou que não sabe se tem a pronta entrega. Para agilizar o atendimento, na etapa de vender um produto, já peça ativamente o nome e CPF do cliente para preparar o pedido.'";

code = code.replace(oldInst, newInst);

fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
console.log('Patched');
