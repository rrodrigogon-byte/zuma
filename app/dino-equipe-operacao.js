import { createHash } from 'node:crypto';
import { ehGestao, profissionalDoUsuario, ModoBarbeiroError } from './dino-modo-barbeiro.js';
const falha = (message, code, status = 400) => { throw new ModoBarbeiroError(message, code, status); };
function profissional(erp, ctx) {
  const todos = erp.listarProfissionais(ctx.empresaId).filter(p => p.ativo !== false);
  const eu = profissionalDoUsuario(todos, ctx.usuario);
  const p = ehGestao(ctx.usuario) ? todos.find(p => p.id === (ctx.profissionalId || eu?.id)) : eu;
  if (!p) falha('Escolha um profissional ativo vinculado ao login.', 'PROFISSIONAL_NAO_VINCULADO', 403);
  if (!ehGestao(ctx.usuario) && ctx.profissionalId && ctx.profissionalId !== p.id) falha('Você só pode operar sua própria agenda.', 'PROFISSIONAL_FORA_ESCOPO', 403);
  return p;
}
export function servicoDaEquipe(s, profissionalId) {
  return s.ativo !== false && (!s.profissionaisIds?.length || s.profissionaisIds.includes(profissionalId));
}
export function catalogoEquipe(erp, ctx, agendamentoId = '') {
  const p = profissional(erp, ctx);
  let comanda = null;
  if (agendamentoId) {
    const a = erp.listarAgendamentos(ctx.empresaId, { lojaId: ctx.lojaId, profissionalId: p.id }).find(a => a.id === agendamentoId && String(a.lojaId || '') === String(ctx.lojaId || ''));
    if (!a) falha('Atendimento fora do escopo do profissional.', 'AGENDAMENTO_FORA_ESCOPO', 403);
    const c = erp.listarComandasBarbearia(ctx.empresaId, { lojaId: ctx.lojaId }).find(c => c.agendamentoId === agendamentoId && c.profissionalId === p.id && String(c.lojaId || '') === String(ctx.lojaId || '') && c.status !== 'cancelada');
    if (c) comanda = { id: c.id, status: c.status, total: c.total, itens: c.itens.map(i => ({ nome: i.nome, quantidade: i.quantidade, subtotal: i.subtotal })) };
  }
  return { profissional: { id: p.id, nome: p.nome }, comanda,
    servicos: erp.listarServicos(ctx.empresaId).filter(s => servicoDaEquipe(s, p.id)).map(s => ({ id: s.id, nome: s.nome, preco: s.preco, duracaoMinutos: s.duracaoMinutos })),
    produtos: erp.listarProdutosRevenda(ctx.empresaId).filter(p => p.ativo !== false && Number(p.estoqueAtual) > 0 && Number(p.precoVenda) > 0).map(p => ({ id: p.id, nome: p.nome, preco: p.precoVenda, estoque: p.estoqueAtual })),
  };
}
export function agendaPeriodoEquipe(erp, ctx, de, ate) {
  const valido = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;
  if (!valido(de) || !valido(ate) || ate < de || (Date.parse(ate) - Date.parse(de)) / 86400000 > 61) falha('Escolha até 62 dias válidos.', 'PERIODO_INVALIDO');
  const p = profissional(erp, ctx);
  const servicos = new Map(erp.listarServicos(ctx.empresaId).map(s => [s.id, s]));
  return { de, ate, profissional: { id: p.id, nome: p.nome }, itens: erp.listarAgendamentos(ctx.empresaId, { de, ate, lojaId: ctx.lojaId, profissionalId: p.id }).map(a => ({ id: a.id, dataAgenda: a.dataAgenda, dataHora: a.dataHora, horaLocal: a.horaLocal, clienteNome: a.clienteNome, servicoNome: servicos.get(a.servicoId)?.nome || 'Serviço', status: a.status })) };
}
export function lancarComandaEquipe(erp, ctx, body, chave, vincularCliente) {
  const p = profissional(erp, ctx);
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(chave || '')) falha('Identificador da operação é obrigatório.', 'IDEMPOTENCIA_OBRIGATORIA');
  if (!Array.isArray(body.itens) || !body.itens.length || body.itens.length > 50) falha('Escolha de 1 a 50 itens.', 'ITENS_INVALIDOS');
  const itens = body.itens.map(i => {
    if (!['servico', 'produto'].includes(i.tipo) || !Number.isInteger(i.quantidade) || i.quantidade < 1 || i.quantidade > 99) falha('Item ou quantidade inválida.', 'ITEM_INVALIDO');
    return { tipo: i.tipo, ...(i.tipo === 'servico' ? { servicoId: String(i.servicoId || '') } : { produtoId: String(i.produtoId || '') }), quantidade: i.quantidade, profissionalId: p.id };
  });
  const agendamentoId = String(body.agendamentoId || '');
  const dados = { profissionalId: p.id, lojaId: ctx.lojaId || '', agendamentoId, itens, clienteNome: String(body.clienteNome || '').trim().slice(0,160), clienteTelefone: String(body.clienteTelefone || '').replace(/\D/g,'') };
  if (dados.clienteTelefone && (dados.clienteTelefone.length < 10 || dados.clienteTelefone.length > 15)) falha('Informe um telefone com DDD válido.', 'TELEFONE_INVALIDO');
  const hash = createHash('sha256').update(JSON.stringify(dados)).digest('hex');
  const escopo = createHash('sha256').update(JSON.stringify([ctx.empresaId, p.id, ctx.lojaId || ''])).digest('hex');
  const chaveEscopo = `equipe:${escopo}:${chave}`;
  const comandas = erp.listarComandasBarbearia(ctx.empresaId, { lojaId: ctx.lojaId }).filter(c => c.profissionalId === p.id && String(c.lojaId || '') === String(ctx.lojaId || ''));
  const repetida = comandas.find(c => c.chaveIdempotencia === chaveEscopo || c.lancamentosEquipe?.some(o => o.chave === chaveEscopo));
  if (repetida) {
    const anterior = repetida.lancamentosEquipe?.find(o => o.chave === chaveEscopo);
    if (!anterior || anterior.hash !== hash) falha('Essa operação já foi usada com outros itens. Confira a comanda antes de iniciar outra.', 'IDEMPOTENCIA_CONFLITO', 409);
    return { ...repetida, idempotente: true };
  }
  let agendamento;
  if (agendamentoId) {
    agendamento = erp.listarAgendamentos(ctx.empresaId, { profissionalId: p.id, lojaId: ctx.lojaId }).find(a => a.id === agendamentoId && String(a.lojaId || '') === String(ctx.lojaId || ''));
    if (!agendamento || ['cancelado','nao_compareceu'].includes(agendamento.status)) falha('Atendimento não disponível para este profissional e unidade.', 'AGENDAMENTO_FORA_ESCOPO', 403);
    dados.clienteId = agendamento.clienteId;
    dados.clienteNome = agendamento.clienteNome || dados.clienteNome;
    dados.clienteTelefone = agendamento.clienteTelefone || dados.clienteTelefone;
  } else if (!dados.clienteNome) falha('Informe o nome do cliente.', 'CLIENTE_OBRIGATORIO');
  const existente = agendamentoId && comandas.find(c => c.agendamentoId === agendamentoId && c.status !== 'cancelada');
  if (existente && !['aberta','aguardando_pagamento'].includes(existente.status)) falha('A comanda desse atendimento já foi fechada. Consulte o caixa.', 'COMANDA_FECHADA', 409);
  const servicos = new Map(erp.listarServicos(ctx.empresaId).map(s => [s.id,s]));
  const produtos = new Map(erp.listarProdutosRevenda(ctx.empresaId).map(s => [s.id,s]));
  const quantidades = new Map();
  for (const i of [...(existente?.itens || []), ...itens]) if (i.tipo === 'produto') quantidades.set(i.produtoId, (quantidades.get(i.produtoId) || 0) + i.quantidade);
  for (const i of itens) {
    const s = i.tipo === 'servico' ? servicos.get(i.servicoId) : produtos.get(i.produtoId);
    if (!s || s.ativo === false || (i.tipo === 'servico' && !servicoDaEquipe(s,p.id))) falha('Item indisponível para este profissional.', 'ITEM_INDISPONIVEL');
    if (!(Number(i.tipo === 'servico' ? s.preco : s.precoVenda) > 0)) falha('Item sem preço válido.', 'PRECO_INVALIDO');
    if (i.tipo === 'produto' && quantidades.get(i.produtoId) > Number(s.estoqueAtual)) falha(`Estoque insuficiente para ${s.nome}.`, 'ESTOQUE_INSUFICIENTE', 409);
  }
  const operacao = { chave: chaveEscopo, hash };
  if (existente) return erp.adicionarItensComandaBarbearia(ctx.empresaId, existente.id, itens, operacao);
  const cliente = vincularCliente ? vincularCliente(dados) : dados;
  return erp.criarComandaBarbearia(ctx.empresaId, { ...cliente, ...dados, clienteId: cliente.clienteId || dados.clienteId, usuario: ctx.usuario.email || ctx.usuario.id || '', chaveIdempotencia: chaveEscopo, lancamentosEquipe: [operacao], observacoes: 'Lançamento no app da equipe; pagamento pendente no caixa.' });
}
