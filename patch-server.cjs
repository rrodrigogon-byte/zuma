const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/server.js', 'utf8');

const importTarget = "import { configuracaoResumo,";
const importInsert = "import { startDinoDailyConfirmationWorker } from './core/dino-confirmacao-diaria.js';\n";
code = code.replace(importTarget, importInsert + importTarget);

const startTarget = "startResumoDiarioWorker();";
const startInsert = "startResumoDiarioWorker();\n  startDinoDailyConfirmationWorker();";
code = code.replace(startTarget, startInsert);

fs.writeFileSync('/home/ubuntu/agro-open/app/server.js', code, 'utf8');
console.log('Patched server.js with Dino Daily Confirmation');
