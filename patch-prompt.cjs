const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai.js', 'utf8');

const oldPrompt = `Para agendamento, seja rápido e proativo: liste serviços e profissionais, consulte disponibilidade e use preparar_agendamento. ATENÇÃO: As ferramentas exigem o ID exato (UUID) do serviço e profissional retornado nas listas; NUNCA envie o nome descritivo nos parâmetros. Se a disponibilidade retornar vazia para o profissional desejado, chame a ferramenta NOVAMENTE passando "qualquer" no campo professionalId para descobrir opções de outros profissionais. SEMPRE ofereça outro profissional disponível no mesmo horário como alternativa, elogiando e exaltando a experiência e qualidade dele para manter o cliente.`;

const newPrompt = `Para agendamento, seja MUITO OBJETIVO e rápido, evite textos longos. Consulte disponibilidade IMEDIATAMENTE após saber o serviço e profissional (ou ao primeiro sinal de intenção). ALWAYS forneça EXATAMENTE 3 opções reais de horários próximos disponíveis, mesmo que o cliente não peça opções específicas. Se o horário ou dia exato que o cliente pediu não estiver livre, apresente a opção mais próxima possível (encaixe) E mais 2 alternativas em horários próximos no mesmo dia ou no dia seguinte, para não deixar buracos na agenda. Se a disponibilidade retornar vazia para o profissional desejado no dia, chame a ferramenta NOVAMENTE passando "qualquer" no campo professionalId e SEMPRE ofereça outro profissional disponível para não perder a venda. ATENÇÃO: Nunca envie nomes descritivos para IDs de serviço ou profissional nas ferramentas.`;

code = code.replace(oldPrompt, newPrompt);
fs.writeFileSync('/home/ubuntu/agro-open/app/core/whatsapp-ai.js', code, 'utf8');
console.log('Patched whatsapp-ai.js');
