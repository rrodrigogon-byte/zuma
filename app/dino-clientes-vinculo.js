// ============================================================================
// VÍNCULO AUTOMÁTICO DE CLIENTE — agenda, comanda e agendamento online
// Um atendimento com nome + telefone válido passa a apontar para um cadastro
// de cliente da empresa: reaproveita o cadastro com o mesmo telefone ou cria
// um novo. Sem isso a agenda gira "sem cliente" e o Customer 360, a
// fidelidade e o CRM não enxergam quem frequenta a barbearia.
// ============================================================================

import * as clientesKytto from './clientes-contas-kytto.js';

const BALCAO = /^(cliente\s+)?balc[aã]o$|^avulso$|^consumidor( final)?$/i;

export function telefoneChave(valor) {
  let digits = String(valor || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return '';
  // DDD + número; celulares antigos sem o 9 casam com os novos.
  const ddd = digits.slice(0, 2);
  const numero = digits.slice(2);
  return `${ddd}${numero.length === 9 ? numero.slice(1) : numero}`;
}

function ativo(cliente) {
  return cliente && cliente.status !== 'deletado' && !cliente.anonimizadoEm && !cliente.padrao;
}

export function encontrarClientePorTelefone(empresaId, telefone) {
  const chave = telefoneChave(telefone);
  if (!chave) return null;
  const clientes = Object.values(clientesKytto.clientesPersistidos(empresaId).clientes || {});
  return clientes.find((cliente) => ativo(cliente) && telefoneChave(cliente.telefone) === chave) || null;
}

/**
 * Garante `clienteId` nos dados de um atendimento.
 * - com clienteId existente: nada muda;
 * - com telefone válido: usa o cadastro do mesmo telefone ou cria um novo;
 * - sem telefone, ou nome de balcão/avulso: segue sem cadastro (comportamento antigo).
 * Nunca lança: falha de cadastro não pode impedir o atendimento.
 */
export function vincularClienteAoAtendimento(empresaId, dados = {}, { origem = 'agenda', usuario = '' } = {}) {
  const clienteId = String(dados.clienteId ?? dados.cliente_id ?? '').trim();
  if (clienteId) return { dados, clienteId, criado: false, vinculado: false };
  const nome = String(dados.clienteNome ?? dados.cliente_nome ?? '').trim();
  const telefone = String(dados.clienteTelefone ?? dados.cliente_telefone ?? '').trim();
  if (dados.cadastrarCliente === false || !nome || BALCAO.test(nome) || !telefoneChave(telefone)) {
    return { dados, clienteId: '', criado: false, vinculado: false };
  }
  try {
    const existente = encontrarClientePorTelefone(empresaId, telefone);
    if (existente) {
      return { dados: { ...dados, clienteId: existente.id }, clienteId: existente.id, criado: false, vinculado: true };
    }
    const cliente = clientesKytto.criarCliente(empresaId, {
      nome,
      telefone,
      email: dados.clienteEmail || dados.cliente_email || '',
      observacao: `Cadastro automático (${origem})${usuario ? ` por ${usuario}` : ''}.`,
    });
    cliente.origemCadastro = origem;
    return { dados: { ...dados, clienteId: cliente.id }, clienteId: cliente.id, criado: true, vinculado: true };
  } catch {
    return { dados, clienteId: '', criado: false, vinculado: false };
  }
}
