// Somente apresentação: não altera cadastro, vínculo ou histórico financeiro.
export function nomeClienteValido(nome) {
  const n = String(nome || '').trim();
  return n.length >= 2 && /\p{L}/u.test(n) && !/^(cliente|cliente sem nome|cliente não informado|nome não informado|cliente eventual|consumidor final|balcão|contato(?:\s.*)?|cliente whatsapp(?:\s.*)?)$/iu.test(n);
}
function telefoneCanonico(valor) {
  const n = String(valor || '').replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) return `55${n}`;
  return n.length >= 12 && n.length <= 15 ? n : '';
}
export function identificarCliente(registro, clientes, empresaId) {
  const elegiveis = clientes.filter(c => String(c.empresaId) === String(empresaId) && c.status !== 'deletado' && !c.anonimizadoEm && !c.padrao);
  const vinculado = elegiveis.find(c => c.id === registro.clienteId);
  const telefone = telefoneCanonico(registro.clienteTelefone);
  // ID tem precedência. Telefone só resolve quando há exatamente um cadastro.
  const encontrados = !registro.clienteId && telefone ? elegiveis.filter(c => telefoneCanonico(c.telefone) === telefone) : [];
  const cliente = vinculado || (encontrados.length === 1 ? encontrados[0] : null);
  const nome = nomeClienteValido(registro.clienteNome) ? registro.clienteNome.trim() : nomeClienteValido(cliente?.nome) ? cliente.nome.trim() : '';
  return { ...registro, clienteNome: nome || 'Nome não informado', clienteNomePendente: !nome,
    clienteNomeOrigem: nome ? (nomeClienteValido(registro.clienteNome) ? 'atendimento' : 'crm') : 'pendente',
    clienteCrmId: cliente?.id || '', clienteTelefone: registro.clienteTelefone || cliente?.telefone || '' };
}
