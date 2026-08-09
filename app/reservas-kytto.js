import { db } from './db.js';

const FUSO = 'America/Cuiaba';
const agora = () => new Date().toISOString();
const texto = (valor, limite = 240) => String(valor ?? '').trim().slice(0, limite);
const inteiro = (valor, minimo, maximo) => { const numero = Math.floor(Number(valor)); if (!Number.isFinite(numero) || numero < minimo || numero > maximo) throw new Error(`Informe um valor entre ${minimo} e ${maximo}.`); return numero; };
const ativos = new Set(['confirmada', 'chegou', 'em_atendimento']);
const serializar = item => ({ ...item, notificacoes: [...(item.notificacoes || [])] });
function store(empresaId) {
  const estado = db(); estado.reservasKytto ||= { empresas: {} }; estado.reservasKytto.empresas ||= {};
  const chave = String(empresaId || 'emp-kytto-001');
  estado.reservasKytto.empresas[chave] ||= { reservas: {}, fila: {}, sequenciaReserva: 0, sequenciaFila: 0, configuracao: { duracaoPadraoMinutos: 120, avisoMinutosAntes: 15, fuso: FUSO } };
  const atual = estado.reservasKytto.empresas[chave]; atual.reservas ||= {}; atual.fila ||= {}; atual.configuracao ||= { duracaoPadraoMinutos: 120, avisoMinutosAntes: 15, fuso: FUSO };
  return atual;
}
function dataCuiaba(valor) {
  const bruto = texto(valor, 40); if (!bruto) throw new Error('Informe a data e o horário da reserva.');
  const normalizado = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(bruto) ? `${bruto}:00-04:00` : bruto;
  const data = new Date(normalizado); if (Number.isNaN(data.valueOf())) throw new Error('Data e horário inválidos.'); return data;
}
function intervalo(reserva) { const inicio = new Date(reserva.inicioEm); const fim = new Date(inicio.valueOf() + Number(reserva.duracaoMinutos || 120) * 60000); return { inicio, fim }; }
function sobrepoe(a, b) { return a.inicio < b.fim && b.inicio < a.fim; }
function validarConflito(empresaId, mesaNum, inicioEm, duracaoMinutos, ignorarId = null) {
  if (!mesaNum) return [];
  const candidato = { inicio: new Date(inicioEm), fim: new Date(new Date(inicioEm).valueOf() + duracaoMinutos * 60000) };
  return Object.values(store(empresaId).reservas).filter(reserva => reserva.id !== ignorarId && ativos.has(reserva.status) && Number(reserva.mesaNum) === Number(mesaNum) && sobrepoe(candidato, intervalo(reserva)));
}
export function configuracaoReservas(empresaId) { return { ...store(empresaId).configuracao, fuso: FUSO }; }
export function atualizarConfiguracaoReservas(empresaId, dados = {}) {
  const config = store(empresaId).configuracao;
  if (dados.duracaoPadraoMinutos !== undefined) config.duracaoPadraoMinutos = inteiro(dados.duracaoPadraoMinutos, 15, 720);
  if (dados.avisoMinutosAntes !== undefined) config.avisoMinutosAntes = inteiro(dados.avisoMinutosAntes, 0, 1440);
  config.fuso = FUSO; config.atualizadoEm = agora(); return configuracaoReservas(empresaId);
}
export function criarReserva(empresaId, dados = {}, usuario = '') {
  const atual = store(empresaId); const inicio = dataCuiaba(dados.inicioEm ?? dados.dataHora ?? dados.data_hora); const pessoas = inteiro(dados.pessoas ?? dados.numeroPessoas ?? 1, 1, 100); const mesaNum = dados.mesaNum === null || dados.mesaNum === '' || dados.mesaNum === undefined ? null : inteiro(dados.mesaNum, 1, 9999); const duracaoMinutos = dados.duracaoMinutos === undefined ? Number(atual.configuracao.duracaoPadraoMinutos || 120) : inteiro(dados.duracaoMinutos, 15, 720);
  const clienteNome = texto(dados.clienteNome ?? dados.nome, 120); if (!clienteNome) throw new Error('Informe o nome do cliente.');
  const conflitos = validarConflito(empresaId, mesaNum, inicio.toISOString(), duracaoMinutos); if (conflitos.length) throw new Error(`A mesa ${mesaNum} já possui reserva ativa neste horário.`);
  atual.sequenciaReserva += 1; const reserva = { id: `res-${Date.now().toString(36)}-${atual.sequenciaReserva}`, empresaId: String(empresaId), codigo: `R${String(atual.sequenciaReserva).padStart(5, '0')}`, mesaNum, clienteId: texto(dados.clienteId, 100) || null, clienteNome, telefone: texto(dados.telefone, 30), pessoas, inicioEm: inicio.toISOString(), duracaoMinutos, status: 'confirmada', observacao: texto(dados.observacao, 500), criadoPor: texto(usuario, 120) || null, criadoEm: agora(), atualizadoEm: agora(), notificacoes: [] };
  atual.reservas[reserva.id] = reserva; return serializar(reserva);
}
export function listarReservas(empresaId, filtros = {}) {
  const status = texto(filtros.status, 50); const de = filtros.de ? dataCuiaba(`${String(filtros.de).slice(0, 10)}T00:00`).valueOf() : null; const ate = filtros.ate ? dataCuiaba(`${String(filtros.ate).slice(0, 10)}T23:59`).valueOf() : null;
  return Object.values(store(empresaId).reservas).filter(item => !status || item.status === status).filter(item => !de || new Date(item.inicioEm).valueOf() >= de).filter(item => !ate || new Date(item.inicioEm).valueOf() <= ate).sort((a, b) => String(a.inicioEm).localeCompare(String(b.inicioEm))).map(serializar);
}
export function obterReserva(empresaId, id) { const reserva = store(empresaId).reservas[String(id)]; return reserva?.empresaId === String(empresaId) ? serializar(reserva) : null; }
export function atualizarReserva(empresaId, id, dados = {}, usuario = '') {
  const atual = store(empresaId); const reserva = atual.reservas[String(id)]; if (!reserva || reserva.empresaId !== String(empresaId)) return null; if (!['confirmada', 'chegou'].includes(reserva.status)) throw new Error('Só reservas confirmadas ou em chegada podem ser alteradas.');
  const inicio = dados.inicioEm === undefined ? new Date(reserva.inicioEm) : dataCuiaba(dados.inicioEm); const mesaNum = dados.mesaNum === undefined ? reserva.mesaNum : (dados.mesaNum === null || dados.mesaNum === '' ? null : inteiro(dados.mesaNum, 1, 9999)); const duracao = dados.duracaoMinutos === undefined ? reserva.duracaoMinutos : inteiro(dados.duracaoMinutos, 15, 720); const conflitos = validarConflito(empresaId, mesaNum, inicio.toISOString(), duracao, reserva.id); if (conflitos.length) throw new Error(`A mesa ${mesaNum} já possui reserva ativa neste horário.`);
  Object.assign(reserva, { mesaNum, inicioEm: inicio.toISOString(), duracaoMinutos: duracao, clienteNome: dados.clienteNome === undefined ? reserva.clienteNome : texto(dados.clienteNome, 120), telefone: dados.telefone === undefined ? reserva.telefone : texto(dados.telefone, 30), pessoas: dados.pessoas === undefined ? reserva.pessoas : inteiro(dados.pessoas, 1, 100), observacao: dados.observacao === undefined ? reserva.observacao : texto(dados.observacao, 500), atualizadoEm: agora(), atualizadoPor: texto(usuario, 120) || null }); return serializar(reserva);
}
export function alterarStatusReserva(empresaId, id, status, usuario = '') {
  const reserva = store(empresaId).reservas[String(id)]; if (!reserva || reserva.empresaId !== String(empresaId)) return null; const permitido = ['confirmada', 'chegou', 'em_atendimento', 'cumprida', 'no_show', 'cancelada']; if (!permitido.includes(status)) throw new Error('Status de reserva inválido.');
  const transicoes = { confirmada: ['chegou', 'no_show', 'cancelada'], chegou: ['em_atendimento', 'cancelada'], em_atendimento: ['cumprida'], cumprida: [], no_show: [], cancelada: [] }; if (!transicoes[reserva.status].includes(status)) throw new Error(`Não é possível mudar a reserva de ${reserva.status} para ${status}.`);
  reserva.status = status; reserva.atualizadoEm = agora(); reserva.atualizadoPor = texto(usuario, 120) || null; reserva[`${status}Em`] = reserva.atualizadoEm; return serializar(reserva);
}
export function adicionarFila(empresaId, dados = {}, usuario = '') {
  const atual = store(empresaId); const clienteNome = texto(dados.clienteNome ?? dados.nome, 120); if (!clienteNome) throw new Error('Informe o nome do cliente para a fila.'); atual.sequenciaFila += 1; const item = { id: `fila-${Date.now().toString(36)}-${atual.sequenciaFila}`, empresaId: String(empresaId), senha: String(atual.sequenciaFila).padStart(3, '0'), clienteId: texto(dados.clienteId, 100) || null, clienteNome, telefone: texto(dados.telefone, 30), pessoas: inteiro(dados.pessoas ?? 1, 1, 100), observacao: texto(dados.observacao, 500), status: 'aguardando', criadoPor: texto(usuario, 120) || null, criadoEm: agora(), atualizadoEm: agora(), previsaoMinutos: dados.previsaoMinutos === undefined ? null : inteiro(dados.previsaoMinutos, 0, 720), notificacoes: [] }; atual.fila[item.id] = item; return serializar(item);
}
export function listarFila(empresaId, filtros = {}) { const incluirFinalizados = filtros.incluirFinalizados === true; return Object.values(store(empresaId).fila).filter(item => incluirFinalizados || ['aguardando', 'chamado'].includes(item.status)).sort((a,b) => String(a.criadoEm).localeCompare(String(b.criadoEm))).map(serializar); }
export function chamarFila(empresaId, id, mesaNum, usuario = '') { const item = store(empresaId).fila[String(id)]; if (!item || item.empresaId !== String(empresaId)) return null; if (item.status !== 'aguardando') throw new Error('A senha não está aguardando mesa.'); item.status = 'chamado'; item.mesaNum = inteiro(mesaNum, 1, 9999); item.chamadoEm = agora(); item.chamadoPor = texto(usuario, 120) || null; item.atualizadoEm = agora(); item.notificacoes.push({ tipo: 'manual', status: 'pendente_configuracao', mensagem: `Mesa ${item.mesaNum} disponível para ${item.clienteNome}.`, criadoEm: item.atualizadoEm }); return serializar(item); }
export function finalizarFila(empresaId, id, status, usuario = '') { const item = store(empresaId).fila[String(id)]; if (!item || item.empresaId !== String(empresaId)) return null; if (!['atendido', 'cancelado', 'ausente'].includes(status)) throw new Error('Status de fila inválido.'); item.status = status; item.finalizadoEm = agora(); item.finalizadoPor = texto(usuario, 120) || null; item.atualizadoEm = item.finalizadoEm; return serializar(item); }
export function ocupacaoPrevista(empresaId, data) {
  const dia = String(data || new Date().toLocaleDateString('en-CA', { timeZone: FUSO })).slice(0, 10); const reservas = listarReservas(empresaId, { de: dia, ate: dia }); const porMesa = {}; for (const reserva of reservas.filter(item => ativos.has(item.status) && item.mesaNum)) { (porMesa[reserva.mesaNum] ||= []).push({ inicioEm: reserva.inicioEm, fimEm: intervalo(reserva).fim.toISOString(), pessoas: reserva.pessoas, reservaId: reserva.id, status: reserva.status }); }
  Object.values(porMesa).forEach(lista => lista.sort((a,b) => String(a.inicioEm).localeCompare(String(b.inicioEm)))); const total = reservas.length; const noShows = reservas.filter(item => item.status === 'no_show').length; return { data: dia, fuso: FUSO, porMesa, totalReservas: total, confirmadas: reservas.filter(item => ativos.has(item.status)).length, noShows, taxaNoShow: total ? Number((noShows / total * 100).toFixed(2)) : 0, pessoasPrevistas: reservas.filter(item => ativos.has(item.status)).reduce((soma,item) => soma + Number(item.pessoas || 0), 0) };
}
export default { configuracaoReservas, atualizarConfiguracaoReservas, criarReserva, listarReservas, obterReserva, atualizarReserva, alterarStatusReserva, adicionarFila, listarFila, chamarFila, finalizarFila, ocupacaoPrevista };
