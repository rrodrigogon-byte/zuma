import fs from 'fs';

const serverFile = '/tmp/repo/app/server.js';
let content = fs.readFileSync(serverFile, 'utf8');

const markerStart = '// [kytto-concreto] Rotas públicas de impressão e visualização de documentos oficiais';
const markerEnd = '  // [kytto-pizzaria-delivery] Rotas movidas para escopo global do server (disponíveis com ou sem Commerce Core)';

const startIndex = content.indexOf(markerStart);
const endIndex = content.indexOf(markerEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found!');
  process.exit(1);
}

const concreteBlock = content.substring(startIndex, endIndex);

// Remove concrete block from its current location
content = content.substring(0, startIndex) + content.substring(endIndex);

// Target insertion point: right before `// Commerce Core PostgreSQL fica opt-in`
const insertTarget = '// Commerce Core PostgreSQL fica opt-in';
const insertIndex = content.indexOf(insertTarget);

if (insertIndex === -1) {
  console.error('Insert target not found!');
  process.exit(1);
}

content = content.substring(0, insertIndex) + concreteBlock + '\n' + content.substring(insertIndex);

fs.writeFileSync(serverFile, content, 'utf8');
console.log('Successfully moved concrete routes to global server scope!');
