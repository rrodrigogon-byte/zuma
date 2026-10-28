const { listarComandasBarbearia } = require('./app/barbearia-erp-kytto.js');
const comandas = listarComandasBarbearia('d0d0ac01-8e50-4b61-8c79-de4aaa916da6');
console.log(comandas.length);
if(comandas.length > 0) console.log(JSON.stringify(comandas[0], null, 2));
