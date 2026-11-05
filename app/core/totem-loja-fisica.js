/**
 * Módulo de Gestão de Totens e Autoatendimento em Lojas Físicas - Kytto Commerce
 * Suporta múltiplos totens por unidade física, modos de operação (self-checkout de produtos,
 * check-in de atendimento/senhas, e híbrido), emissão de senhas e pedidos de autoatendimento.
 */

import { db, save } from '../db.js';
import crypto from 'node:crypto';

export const MODOS_TOTEM = {
  HIBRIDO: 'hibrido', // Produtos + Serviços/Fila + Clube VIP
  EXPRESSO_PRODUTOS: 'expresso_produtos', // Apenas self-checkout de produtos e bebidas
  RECEPCAO_SENHAS: 'recepcao_senhas', // Check-in de agendamento e retirada de senhas
};

export const STATUS_SENHA = {
  AGUARDANDO: 'aguardando',
  CHAMADA: 'chamada',
  EM_ATENDIMENTO: 'em_atendimento',
  CONCLUIDA: 'concluida',
  CANCELADA: 'cancelada',
};

function normalizarBaseTotem() {
  const d = db();
  if (!d.totensLojaFisica) {
    d.totensLojaFisica = {
      totens: [],
      senhas: [],
      pedidosTotem: [],
    };
    save();
  }
  if (!d.totensLojaFisica.totens) d.totensLojaFisica.totens = [];
  if (!d.totensLojaFisica.senhas) d.totensLojaFisica.senhas = [];
  if (!d.totensLojaFisica.pedidosTotem) d.totensLojaFisica.pedidosTotem = [];
  return d.totensLojaFisica;
}

/**
 * Lista totens configurados para uma unidade ou empresa
 */
export function listarTotens({ empresaId, lojaId } = {}) {
  const base = normalizarBaseTotem();
  return base.totens.filter(t => {
    if (empresaId && t.empresaId && t.empresaId !== empresaId) return false;
    if (lojaId && t.lojaId && t.lojaId !== lojaId) return false;
    return true;
  });
}

/**
 * Cria ou atualiza a configuração de um totem
 */
export function salvarTotem({
  id = null,
  empresaId,
  lojaId,
  nome,
  slug,
  modo = MODOS_TOTEM.HIBRIDO,
  timeoutSegundos = 45,
  pinGerente = '1234',
  permitirPix = true,
  permitirCartao = true,
  permitirBalcao = true,
  solicitarTelefone = true,
  solicitarCpf = false,
  mensagemBoasVindas = 'Toque na tela para iniciar seu atendimento',
  ativo = true,
} = {}) {
  if (!nome) throw new Error('Nome do totem é obrigatório');
  const base = normalizarBaseTotem();
  const totemId = id || `totem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const slugCalculado = slug || (nome.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));

  const index = base.totens.findIndex(t => t.id === totemId);
  const dados = {
    id: totemId,
    empresaId: empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: lojaId || 'matriz',
    nome,
    slug: slugCalculado,
    modo,
    timeoutSegundos: Number(timeoutSegundos) || 45,
    pinGerente: String(pinGerente || '1234'),
    permitirPix: Boolean(permitirPix),
    permitirCartao: Boolean(permitirCartao),
    permitirBalcao: Boolean(permitirBalcao),
    solicitarTelefone: Boolean(solicitarTelefone),
    solicitarCpf: Boolean(solicitarCpf),
    mensagemBoasVindas,
    ativo: Boolean(ativo),
    atualizadoEm: new Date().toISOString(),
  };

  if (index >= 0) {
    base.totens[index] = { ...base.totens[index], ...dados };
  } else {
    dados.criadoEm = new Date().toISOString();
    base.totens.push(dados);
  }
  save();
  return dados;
}

/**
 * Emite uma nova senha de atendimento físico pelo totem
 */
export function emitirSenhaTotem({
  totemId,
  empresaId,
  lojaId,
  tipo = 'atendimento', // 'atendimento', 'rapido', 'prioritario', 'retirada'
  clienteNome = 'Cliente',
  clienteTelefone = '',
  servicoDesejado = null,
  profissionalDesejado = null,
  agendamentoId = null,
} = {}) {
  const base = normalizarBaseTotem();
  const hoje = new Date().toISOString().slice(0, 10);
  
  // Contagem sequencial do dia
  const senhasHoje = base.senhas.filter(s => s.criadoEm?.startsWith(hoje));
  const sequencial = (senhasHoje.length + 1).toString().padStart(3, '0');
  const prefixo = tipo === 'prioritario' ? 'P' : (tipo === 'retirada' ? 'R' : 'A');
  const codigo = `${prefixo}-${sequencial}`;

  const senha = {
    id: `senha_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    codigo,
    totemId: totemId || 'totem_default',
    empresaId: empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: lojaId || 'matriz',
    tipo,
    clienteNome: clienteNome.trim() || 'Cliente Presencial',
    clienteTelefone: clienteTelefone.replace(/\D/g, ''),
    servicoDesejado,
    profissionalDesejado,
    agendamentoId,
    status: STATUS_SENHA.AGUARDANDO,
    criadoEm: new Date().toISOString(),
    chamadaEm: null,
    atendidaEm: null,
  };

  base.senhas.push(senha);
  save();
  return senha;
}

/**
 * Atualiza o status de uma senha (chamada no painel de TV ou atendimento)
 */
export function atualizarStatusSenha({ id, status, profissionalNome = null, guiche = 'Balcão 1' }) {
  const base = normalizarBaseTotem();
  const senha = base.senhas.find(s => s.id === id || s.codigo === id);
  if (!senha) throw new Error(`Senha ${id} não encontrada`);

  senha.status = status;
  if (status === STATUS_SENHA.CHAMADA) {
    senha.chamadaEm = new Date().toISOString();
    senha.profissionalAtendente = profissionalNome;
    senha.guiche = guiche;
  } else if (status === STATUS_SENHA.EM_ATENDIMENTO) {
    senha.atendidaEm = new Date().toISOString();
  }
  save();
  return senha;
}

/**
 * Retorna estado atual das senhas para o Painel de TV
 */
export function obterEstadoPainelTV({ empresaId, lojaId } = {}) {
  const base = normalizarBaseTotem();
  const hoje = new Date().toISOString().slice(0, 10);
  
  const senhasDoDia = base.senhas.filter(s => {
    if (!s.criadoEm?.startsWith(hoje)) return false;
    if (empresaId && s.empresaId !== empresaId) return false;
    if (lojaId && s.lojaId !== lojaId) return false;
    return true;
  });

  const ultimaChamada = senhasDoDia
    .filter(s => s.status === STATUS_SENHA.CHAMADA || s.status === STATUS_SENHA.EM_ATENDIMENTO)
    .sort((a, b) => (new Date(b.chamadaEm || b.criadoEm)) - (new Date(a.chamadaEm || a.criadoEm)))[0] || null;

  const historicoChamadas = senhasDoDia
    .filter(s => s.chamadaEm)
    .sort((a, b) => new Date(b.chamadaEm) - new Date(a.chamadaEm))
    .slice(0, 6);

  const filaAguardando = senhasDoDia
    .filter(s => s.status === STATUS_SENHA.AGUARDANDO)
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));

  return {
    ultimaChamada,
    historicoChamadas,
    filaAguardando,
    totalAguardando: filaAguardando.length,
    totalAtendidas: senhasDoDia.filter(s => s.status === STATUS_SENHA.CONCLUIDA).length,
    atualizadoEm: new Date().toISOString(),
  };
}

/**
 * Registra um pedido efetuado no Totem de Autoatendimento
 */
export function registrarPedidoTotem({
  totemId,
  empresaId,
  lojaId,
  itens = [],
  cliente = {},
  formaPagamento = 'pix',
  statusPagamento = 'pago',
  total = 0,
} = {}) {
  const base = normalizarBaseTotem();
  const codigo = `TOT-${Math.floor(1000 + Math.random() * 9000)}`;

  const pedido = {
    id: `ped_totem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    codigo,
    totemId: totemId || 'totem_default',
    empresaId: empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: lojaId || 'matriz',
    itens: Array.isArray(itens) ? itens : [],
    cliente: {
      nome: cliente.nome || 'Cliente Totem',
      telefone: cliente.telefone || '',
      cpf: cliente.cpf || '',
    },
    formaPagamento,
    statusPagamento,
    total: Number(total) || 0,
    criadoEm: new Date().toISOString(),
  };

  base.pedidosTotem.push(pedido);
  save();
  return pedido;
}
