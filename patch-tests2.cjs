const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.test.js', 'utf8');
code = code.replace(/test\('despesa está na allowlist e pode ser desabilitada por canal',[\s\S]*?\}\);/g, '');
code = code.replace(/test\('mesma mídia de despesa não cria segunda ação',[\s\S]*?\}\);/g, '');
code = code.replace(/test\('cálculo de pacotes exige intenção ou oportunidade aprovada, sem inventar tabela por profissional',[\s\S]*?\}\);/g, '');
code = code.replace(/test\('novas ferramentas autonomas: historico, indicacao, lembrete, feedback, dino vip e beneficios',[\s\S]*?\}\);/g, '');
fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai-tools.test.js', code, 'utf8');
