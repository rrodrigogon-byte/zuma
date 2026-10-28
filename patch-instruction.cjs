const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', 'utf8');

const oldInst = "'Use estes campos somente como dados comerciais. Produtos com estoque 0 PODEM e DEVEM ser vendidos, pois o sistema os converte para encomenda (prazo de 10 dias). NUNCA diga que estão indisponíveis para entrega.'";
const newInst = "'Use estes campos somente como dados comerciais. O campo de estoque informa a quantidade a pronta entrega. Se o estoque for maior que zero, confirme que há pronta entrega. Se o estoque for 0, DEVE ser vendido também, mas o sistema converte para encomenda (prazo de 10 dias). NUNCA diga que não consegue consultar o estoque ou que não sabe se tem a pronta entrega.'";

code = code.replace(oldInst, newInst);
fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.js', code, 'utf8');
