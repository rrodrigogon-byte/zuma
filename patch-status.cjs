const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', 'utf8');

const oldStatus = `const STATUS = {
  agendado: { label: 'Agendado', color: '#4a9eff' },
  confirmado: { label: 'Confirmado', color: '#8b5cf6' },
  aguardando_confirmacao: { label: 'Aguardando confirmação', color: '#e0b24b' },
  cancelado_falta_confirmacao: { label: 'Cancelado por falta de confirmação', color: '#e05c5c' },
  em_atendimento: { label: 'Em atendimento', color: '#f59e0b' },
  concluido: { label: 'Concluído', color: '#14b87a' },
  cancelado: { label: 'Cancelado', color: '#e05c5c' },
  nao_compareceu: { label: 'Não compareceu', color: '#888' },
  aguardando: { label: 'Aguardando', color: '#4a9eff' },
  chamado: { label: 'Chamado', color: '#f59e0b' },
  atendido: { label: 'Atendido', color: '#14b87a' },
  ausente: { label: 'Ausente', color: '#888' },
  configurado: { label: 'Configurado', color: '#14b87a' },
  pendente_configuracao: { label: 'Configuração pendente', color: '#f59e0b' },
  nao_verificado: { label: 'Conexão não verificada', color: '#f59e0b' },
  pendente_ativacao: { label: 'Pendente de ativação', color: '#f59e0b' },
  pausada: { label: 'Pausada', color: '#888' },
  expirada: { label: 'Expirada', color: '#e05c5c' },
  aberta: { label: 'Aberta', color: '#4a9eff' },
  aguardando_pagamento: { label: 'Aguardando pagamento', color: '#f59e0b' },`;

const newStatus = `const STATUS = {
  agendado: { label: 'Agendado', color: '#8b5cf6' },
  confirmado: { label: 'Confirmado', color: '#8b5cf6' },
  aguardando_confirmacao: { label: 'Aguardando confirmação', color: '#e0b24b' },
  cancelado_falta_confirmacao: { label: 'Cancelado por falta de confirmação', color: '#e05c5c' },
  em_atendimento: { label: 'Em atendimento', color: '#8b5cf6' },
  concluido: { label: 'Concluído', color: '#14b87a' },
  cancelado: { label: 'Cancelado', color: '#e05c5c' },
  nao_compareceu: { label: 'Não compareceu', color: '#888' },
  aguardando: { label: 'Aguardando', color: '#8b5cf6' },
  chamado: { label: 'Chamado', color: '#f59e0b' },
  atendido: { label: 'Atendido', color: '#14b87a' },
  ausente: { label: 'Ausente', color: '#888' },
  configurado: { label: 'Configurado', color: '#14b87a' },
  pendente_configuracao: { label: 'Configuração pendente', color: '#f59e0b' },
  nao_verificado: { label: 'Conexão não verificada', color: '#f59e0b' },
  pendente_ativacao: { label: 'Pendente de ativação', color: '#f59e0b' },
  pausada: { label: 'Pausada', color: '#888' },
  expirada: { label: 'Expirada', color: '#e05c5c' },
  aberta: { label: 'Aberta', color: '#8b5cf6' },
  aguardando_pagamento: { label: 'Aguardando pagamento', color: '#f59e0b' },`;

code = code.replace(oldStatus, newStatus);
fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', code, 'utf8');
console.log('Patched STATUS in BarbeariaERP.jsx');
