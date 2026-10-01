// ============================================================================
// AGENDA ÚNICA DA BARBEARIA PARA A IA DO WHATSAPP
//
// A IA lia e gravava nas tabelas PostgreSQL `agendamentos`/`servicos`/`usuarios`,
// enquanto o admin, o link público e os lembretes usam a agenda da barbearia
// (barbearia-erp-kytto.js). Resultado: horário marcado pela IA não aparecia no
// admin e podia colidir com outro cliente.
//
// Este módulo escolhe a fonte pela empresa: se a empresa tem equipe ativa na
// agenda da barbearia, a IA usa ESSA agenda (mesma regra de conflito,
// calendário, jornada e lembretes). Empresas sem agenda da barbearia continuam
// no caminho PostgreSQL antigo, sem mudança.
// ============================================================================

import { createHash, randomBytes } from 'node:crypto';
import { db as pgDb } from './database.js';
import { db as legacyDb } from '../db.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import { vincularClienteAoAtendimento } from '../dino-clientes-vinculo.js';
import * as clientesKytto from '../clientes-contas-kytto.js';
import { phoneMatchKey } from './whatsapp-phone.js';
import { cancelPendingAppointmentNotifications, queueAppointmentNotifications, queueWaitlistNotifications } from './barbershop-appointment-notifications.js';
import * as captacao from '../dino-captacao-kytto.js';
import {
  createScheduledAppointment as pgCreate,
  listSchedulingAvailability as pgAvailability,
  listSchedulingProfessionals as pgProfessionals,
  listSchedulingServices as pgServices,
  SchedulingError,
} from './barbershop-scheduling.js';
import {
  listWhatsappCustomerAppointments as pgCustomerAppointments,
  rescheduleWhatsappAppointment as pgReschedule,
  cancelWhatsappAppointment as pgCancel,
} from './whatsapp-ai-crm.js';

export { SchedulingError };

const ATIVOS = new Set(['agendado', 'confirmado']);

function limpo(valor, limite = 160) {
  return String(valor ?? '').trim().slice(0, limite);
}

/** Chave da empresa na agenda da barbearia (o mesmo UUID do Commerce). */
function chaveEmpresa(scope = {}) {
  return limpo(scope.legacyEmpresaId || scope.empresaId, 120);
}

function temEquipeNaAgendaDaBarbearia(scope) {
  const estado = legacyDb().barbearias?.[chaveEmpresa(scope)];
  return Object.values(estado?.profissionais || {}).some((item) => item && item.ativo !== false);
}

const fonteCache = new Map();

/**
 * Fonte da agenda da IA para a empresa:
 * - BARBEARIA_AGENDA_FONTE=barbearia|postgres força a fonte (operação);
 * - com equipe na agenda da barbearia e SEM agendamentos futuros no PostgreSQL,
 *   usa a agenda da barbearia (a do admin e do link público);
 * - se ainda há agendamentos futuros no PostgreSQL, continua nele até acabarem,
 *   para não esconder horários já marcados nem permitir dupla reserva.
 */
export async function agendaSource(scope = {}) {
  const forcada = String(process.env.BARBEARIA_AGENDA_FONTE || '').trim().toLowerCase();
  if (forcada === 'barbearia' || forcada === 'postgres') return forcada;
  if (!temEquipeNaAgendaDaBarbearia(scope)) return 'postgres';
  const chave = chaveEmpresa(scope);
  const emCache = fonteCache.get(chave);
  if (emCache && emCache.expira > Date.now()) return emCache.fonte;
  let fonte = 'barbearia';
  try {
    const futuros = await pgDb.queryRead(
      `SELECT 1 FROM agendamentos
        WHERE empresa_id = $1 AND data_agendamento >= CURRENT_TIMESTAMP
          AND status NOT IN ('cancelado', 'nao_compareceu', 'concluido')
        LIMIT 1`,
      [chave],
    );
    if (futuros.rows?.[0]) fonte = 'postgres';
  } catch (_) {
    // Sem PostgreSQL (ou empresa fora do Commerce): só existe a agenda da barbearia.
  }
  fonteCache.set(chave, { fonte, expira: Date.now() + 60 * 1000 });
  return fonte;
}

export function limparCacheFonteAgenda() {
  fonteCache.clear();
}

function traduzirErro(erro) {
  if (erro instanceof SchedulingError) return erro;
  const mensagem = limpo(erro?.message, 240) || 'não foi possível concluir';
  const indisponivel = /indispon|conflito|fora do funcionamento|não funciona|não trabalha|feriado|jornada/i.test(mensagem);
  return new SchedulingError(mensagem, indisponivel ? 'SLOT_UNAVAILABLE' : 'SCHEDULING_ERROR');
}

function dataLocalValida(valor) {
  const data = limpo(valor, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new SchedulingError('data inválida', 'INVALID_DATE');
  return data;
}

export async function listServices(scope) {
  if (await agendaSource(scope) === 'postgres') return pgServices(scope);
  return barbearia.listarServicos(chaveEmpresa(scope))
    .filter((item) => item.ativo !== false && item.permiteAgendamentoOnline !== false)
    .map((item) => ({ id: item.id, nome: item.nome, descricao: item.descricao || '', duracaoMinutos: Number(item.duracaoMinutos || 30), preco: Number(item.preco || 0) }));
}

export async function listProfessionals(scope) {
  if (await agendaSource(scope) === 'postgres') return pgProfessionals(scope);
  return barbearia.listarProfissionais(chaveEmpresa(scope))
    .filter((item) => item.ativo !== false)
    .map((item) => ({ id: item.id, nome: item.nome, especialidade: item.especialidade || '' }));
}

export async function availability(scope, input = {}) {
  if (await agendaSource(scope) === 'postgres') return pgAvailability(scope, input);
  const empresa = chaveEmpresa(scope);
  const date = dataLocalValida(input.date);
  const servico = barbearia.listarServicos(empresa).find((item) => item.id === limpo(input.serviceId, 100));
  if (!servico) throw new SchedulingError('serviço não encontrado', 'SERVICE_NOT_FOUND');
  const professionalId = limpo(input.professionalId, 100) || 'qualquer';
  const profissional = professionalId === 'qualquer' ? null : barbearia.listarProfissionais(empresa).find((item) => item.id === professionalId);
  if (professionalId !== 'qualquer' && !profissional) throw new SchedulingError('profissional não encontrado', 'PROFESSIONAL_NOT_FOUND');
  let horarios = [];
  try {
    horarios = barbearia.listarHorariosDisponiveis(empresa, { data: date, servicoId: servico.id, profissionalId: professionalId, lojaId: scope.lojaId });
  } catch (erro) {
    throw traduzirErro(erro);
  }
  return {
    date,
    service: { id: servico.id, nome: servico.nome, duracaoMinutos: Number(servico.duracaoMinutos || 30), preco: Number(servico.preco || 0) },
    professional: profissional ? { id: profissional.id, nome: profissional.nome } : { id: 'qualquer', nome: 'qualquer profissional disponível' },
    slots: horarios.filter((item) => item.disponivel).map((item) => item.horario),
  };
}

// Notificação fora da transação da IA: não segura a conexão do PostgreSQL e
// não depende do commit da ação.
// A conversa do WhatsApp já confirma a ação para o cliente (com o código). Aqui
// só fica o lembrete da véspera: sem uma segunda mensagem "agendamento
// registrado/remarcado/cancelado" logo depois da confirmação. O lembrete antigo
// de horário remarcado ou cancelado é cancelado na fila (e, de todo modo, seria
// descartado no envio pela conferência da agenda).
function notificarDepois(contexto, agendamento, evento) {
  setImmediate(async () => {
    if (evento === 'remarcado' || evento === 'cancelado') await cancelPendingAppointmentNotifications(contexto, agendamento.id).catch(() => null);
    if (evento !== 'cancelado') await queueAppointmentNotifications(contexto, agendamento, 'lembrete').catch(() => null);
  });
}

function respostaAgendamento(empresa, agendamento) {
  const servico = barbearia.listarServicos(empresa, { incluirInativos: true }).find((item) => item.id === agendamento.servicoId);
  const profissional = barbearia.listarProfissionais(empresa, { incluirInativos: true }).find((item) => item.id === agendamento.profissionalId);
  return {
    id: agendamento.id,
    codigo: agendamento.codigoConfirmacao,
    status: agendamento.status,
    dataHora: agendamento.dataHora,
    dataAgenda: agendamento.dataAgenda,
    horaLocal: agendamento.horaLocal,
    servico: servico?.nome || 'Serviço',
    profissional: profissional?.nome || 'Profissional da equipe',
    duracaoMinutos: agendamento.duracaoMinutos,
    valor: Number(agendamento.valor || 0),
    cliente: agendamento.clienteNome,
  };
}

export async function createAppointment(trx, scope, input = {}) {
  if (await agendaSource(scope) === 'postgres') return pgCreate(trx, scope, input);
  const empresa = chaveEmpresa(scope);
  try {
    const livre = barbearia.resolverProfissionalDisponivel(empresa, {
      data: dataLocalValida(input.date),
      horario: limpo(input.time, 5),
      servicoId: limpo(input.serviceId, 100),
      profissionalId: limpo(input.professionalId, 100) || 'qualquer',
      lojaId: scope.lojaId,
    });
    // Idempotência: a mesma ação confirmada (actionId) gera sempre o mesmo
    // código; se a confirmação for repetida após uma falha, devolve o existente.
    const codigo = input.actionId
      ? createHash('sha256').update(`whatsapp-ia:${empresa}:${input.actionId}`).digest('hex').slice(0, 8).toUpperCase()
      : randomBytes(4).toString('hex').toUpperCase();
    const existente = barbearia.listarAgendamentos(empresa, {}).find((item) => item.codigoConfirmacao === codigo && phoneMatchKey(item.clienteTelefone) === phoneMatchKey(input.customerPhone));
    if (existente) return respostaAgendamento(empresa, existente);
    const futurosDoTelefone = agendamentosDoTelefone(empresa, input.customerPhone).filter((item) => ATIVOS.has(item.status));
    const limite = Math.max(1, Number.parseInt(process.env.AGENDAMENTO_PUBLICO_MAX_POR_TELEFONE || '2', 10));
    if (futurosDoTelefone.length >= limite) throw new SchedulingError('este telefone já tem horários marcados; remarque ou cancele um deles antes', 'PHONE_LIMIT');
    const vinculo = vincularClienteAoAtendimento(empresa, { clienteNome: input.customerName, clienteTelefone: input.customerPhone }, { origem: 'whatsapp_ia' });
    // O cliente iniciou a conversa no WhatsApp para marcar: os avisos do próprio
    // agendamento fazem parte do atendimento pedido (nunca reativa quem revogou).
    captacao.registrarConsentimentoAtendimento(empresa, vinculo.clienteId, 'conversa_whatsapp_iniciada_pelo_cliente');
    const agendamento = barbearia.criarAgendamento(empresa, {
      clienteId: vinculo.clienteId || undefined,
      clienteNome: limpo(input.customerName, 160),
      clienteTelefone: limpo(input.customerPhone, 30),
      profissionalId: livre.profissional.id,
      servicoId: limpo(input.serviceId, 100),
      dataHora: livre.dataHora,
      dataAgenda: livre.dataAgenda,
      horaLocal: livre.horaLocal,
      lojaId: scope.lojaId,
      observacoes: limpo(input.notes, 600),
      origem: 'whatsapp_ia',
      status: 'agendado',
      codigoConfirmacao: codigo,
    });
    captacao.marcarListaEsperaAgendada(empresa, { telefone: agendamento.clienteTelefone, data: agendamento.dataAgenda });
    notificarDepois({ empresaId: scope.empresaId, lojaId: scope.lojaId, legacyEmpresaId: empresa }, agendamento, 'criado');
    return respostaAgendamento(empresa, agendamento);
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

function agendamentosDoTelefone(empresa, phone, { includePast = false } = {}) {
  const chave = phoneMatchKey(phone);
  if (!chave) return [];
  const agora = Date.now();
  return barbearia.listarAgendamentos(empresa, {})
    .filter((item) => phoneMatchKey(item.clienteTelefone) === chave)
    .filter((item) => !['cancelado', 'nao_compareceu'].includes(item.status))
    .filter((item) => includePast || new Date(item.dataHora).valueOf() >= agora);
}

export async function listCustomerAppointments(scope, { includePast = false, limit = 8 } = {}) {
  if (await agendaSource(scope) === 'postgres') return pgCustomerAppointments(scope, { includePast, limit });
  const empresa = chaveEmpresa(scope);
  const servicos = new Map(barbearia.listarServicos(empresa, { incluirInativos: true }).map((item) => [item.id, item]));
  const profissionais = new Map(barbearia.listarProfissionais(empresa, { incluirInativos: true }).map((item) => [item.id, item]));
  return agendamentosDoTelefone(empresa, scope.phone, { includePast })
    .slice(0, Math.min(20, Math.max(1, Number(limit) || 8)))
    .map((item) => ({
      id: item.id,
      dataHora: item.dataHora,
      dataAgenda: item.dataAgenda,
      horaLocal: item.horaLocal,
      status: item.status,
      duracaoMinutos: Number(item.duracaoMinutos || 30),
      valor: Number(item.valor || 0),
      observacoes: item.observacoes || '',
      servico: { id: item.servicoId, nome: servicos.get(item.servicoId)?.nome || 'Serviço' },
      profissional: { id: item.profissionalId, nome: profissionais.get(item.profissionalId)?.nome || 'Profissional da equipe' },
    }));
}

function agendamentoDoContato(empresa, phone, appointmentId) {
  const agendamento = agendamentosDoTelefone(empresa, phone, { includePast: true }).find((item) => item.id === limpo(appointmentId, 120));
  if (!agendamento) throw new SchedulingError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');
  if (!ATIVOS.has(agendamento.status)) throw new SchedulingError('este agendamento já não está ativo', 'APPOINTMENT_NOT_ACTIVE');
  return agendamento;
}

export async function rescheduleAppointment(trx, scope, input = {}) {
  if (await agendaSource(scope) === 'postgres') return pgReschedule(trx, scope, input);
  const empresa = chaveEmpresa(scope);
  try {
    const atual = agendamentoDoContato(empresa, scope.phone, input.appointmentId);
    const livre = barbearia.resolverProfissionalDisponivel(empresa, {
      data: dataLocalValida(input.date),
      horario: limpo(input.time, 5),
      servicoId: atual.servicoId,
      profissionalId: atual.profissionalId || 'qualquer',
      lojaId: atual.lojaId || scope.lojaId,
    });
    const atualizado = barbearia.atualizarAgendamento(empresa, atual.id, {
      dataHora: livre.dataHora,
      dataAgenda: livre.dataAgenda,
      horaLocal: livre.horaLocal,
      profissionalId: livre.profissional.id,
      origem: 'whatsapp_ia',
    });
    notificarDepois({ empresaId: scope.empresaId, lojaId: scope.lojaId, legacyEmpresaId: empresa }, atualizado, 'remarcado');
    return { ...respostaAgendamento(empresa, atualizado), profissional: livre.profissional.nome };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

export async function cancelAppointment(trx, scope, appointmentId) {
  if (await agendaSource(scope) === 'postgres') return pgCancel(trx, scope, appointmentId);
  const empresa = chaveEmpresa(scope);
  try {
    const atual = agendamentoDoContato(empresa, scope.phone, appointmentId);
    const cancelado = barbearia.alterarStatusAgendamento(empresa, atual.id, 'cancelado', { observacoes: `${atual.observacoes ? `${atual.observacoes} · ` : ''}Cancelado pelo cliente no WhatsApp` });
    const contexto = { empresaId: scope.empresaId, lojaId: scope.lojaId, legacyEmpresaId: empresa };
    notificarDepois(contexto, cancelado, 'cancelado');
    const candidatos = captacao.candidatosParaVaga(empresa, atual);
    setImmediate(() => { avisarListaEspera(contexto, cancelado, candidatos).catch(() => null); });
    return { ...respostaAgendamento(empresa, cancelado), listaEsperaCandidatos: candidatos.length };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/**
 * Enfileira o aviso de vaga para a lista de espera e só então registra quem foi
 * avisado (sem fila/canal, ninguém fica marcado como avisado).
 */
export async function avisarListaEspera(contexto, agendamentoLiberado, candidatos) {
  if (!candidatos?.length) return { queued: 0, skipped: true, reason: 'no_candidates' };
  const fila = await queueWaitlistNotifications(contexto, agendamentoLiberado, candidatos);
  if (fila?.queuedIds?.length) captacao.marcarAvisados(contexto.legacyEmpresaId || contexto.empresaId, agendamentoLiberado, fila.queuedIds);
  return fila;
}
