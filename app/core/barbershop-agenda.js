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
import { notificarEquipe } from '../dino-push-equipe.js';
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

function chaveUnidade(scope = {}) {
  return limpo(scope.lojaId, 120);
}

function exigirEscopoOperacional(scope = {}, input = {}, exigirServico = false) {
  const empresa = chaveEmpresa(scope);
  const loja = chaveUnidade(scope);
  const servico = limpo(input.serviceId ?? input.servicoId, 120);
  if (!empresa || !loja || (exigirServico && !servico)) {
    throw new SchedulingError('empresaId, lojaId e servicoId são obrigatórios para a operação da agenda', 'AGENDA_SCOPE_REQUIRED');
  }
  return { empresa, loja, servico };
}

function duracaoDoServico(empresa, servicoId) {
  return Number(barbearia.listarServicos(empresa, { incluirInativos: true }).find((item) => item.id === String(servicoId))?.duracaoMinutos || 30);
}

function temEquipeNaAgendaDaBarbearia(scope) {
  const estado = legacyDb().barbearias?.[chaveEmpresa(scope)];
  return Object.values(estado?.profissionais || {}).some((item) => item && item.ativo !== false);
}

const fonteCache = new Map();

function haReservaJsonNaUnidade(scope) {
  const unidade = chaveUnidade(scope);
  return barbearia.listarAgendamentos(chaveEmpresa(scope), {}).some(item => {
    if (String(item.lojaId || '') !== unidade || ['cancelado', 'nao_compareceu', 'concluido'].includes(item.status)) return false;
    const inicio = new Date(item.dataHora).valueOf();
    const duracao = Math.max(1, Number(item.duracaoMinutos) || 30) * 60000;
    return !Number.isFinite(inicio) || inicio + duracao >= Date.now();
  });
}

function conferirFontePgSemConflito(scope) {
  if (haReservaJsonNaUnidade(scope)) throw new SchedulingError('as fontes da agenda exigem conciliação nesta unidade; nenhum horário foi criado', 'AGENDA_SOURCE_CONFLICT');
}

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
  const empresa = chaveEmpresa(scope);
  const unidade = chaveUnidade(scope);
  if (!empresa || !unidade || !temEquipeNaAgendaDaBarbearia(scope)) return 'postgres';
  const chave = `${empresa}:${unidade}`;
  const emCache = fonteCache.get(chave);
  if (emCache && emCache.expira > Date.now()) {
    if (emCache.fonte === 'postgres') conferirFontePgSemConflito(scope);
    return emCache.fonte;
  }
  let fonte = 'barbearia';
  try {
    const futuros = await pgDb.queryRead(
      `SELECT 1 FROM agendamentos
        WHERE empresa_id = $1 AND loja_id = $2 AND data_agendamento >= CURRENT_TIMESTAMP
          AND status NOT IN ('cancelado', 'nao_compareceu', 'concluido')
        LIMIT 1`,
      [empresa, unidade],
    );
    if (!Array.isArray(futuros?.rows)) throw new SchedulingError('leitura da fonte incompleta', 'AGENDA_SOURCE_UNVERIFIABLE');
    // Uma leitura não pode mover/cancelar reservas entre motores. Enquanto houver
    // reserva futura PG nesta unidade, preserve o PG. Conciliação é uma operação
    // explícita separada; não há migração automática por este resolver.
    if (futuros.rows[0]) {
      conferirFontePgSemConflito(scope);
      fonte = 'postgres';
    }
  } catch (erro) {
    if (erro instanceof SchedulingError) throw erro;
    throw new SchedulingError('não foi possível verificar a fonte da agenda', 'AGENDA_SOURCE_UNVERIFIABLE');
  }
  fonteCache.set(chave, { fonte, expira: Date.now() + 60 * 1000 });
  return fonte;
}

function chaveNome(valor) {
  return limpo(valor, 160).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Acha o equivalente na agenda da barbearia pelo nome (exato, depois primeiro nome). */
function porNome(itens, nome) {
  const alvo = chaveNome(nome);
  if (!alvo) return null;
  const exato = itens.filter((item) => chaveNome(item.nome) === alvo);
  if (exato.length === 1) return exato[0];
  const primeiro = alvo.split(' ')[0];
  const parcial = itens.filter((item) => chaveNome(item.nome).split(' ')[0] === primeiro);
  return parcial.length === 1 ? parcial[0] : null;
}

/**
 * Move para a agenda da barbearia os agendamentos futuros que a IA gravou no
 * PostgreSQL. Idempotente: cada linha vira um agendamento com código derivado do
 * id original e a linha antiga sai da agenda PostgreSQL (status cancelado, com nota).
 * Linha cujo serviço/profissional não tem equivalente único fica pendente.
 */
export async function migrarAgendaPostgresParaBarbearia(scope = {}, { query = pgDb.query.bind(pgDb), queryRead = pgDb.queryRead.bind(pgDb) } = {}) {
  const empresa = chaveEmpresa(scope);
  const unidade = chaveUnidade(scope);
  if (!empresa || !unidade) throw new SchedulingError('empresa e unidade são obrigatórias para migrar a agenda', 'AGENDA_SCOPE_REQUIRED');
  const linhas = await queryRead(
    `SELECT a.id, a.empresa_id, a.loja_id, a.cliente_nome, a.cliente_telefone, a.observacoes,
            l.id AS loja_meta_id, l.empresa_id AS loja_empresa_id,
            to_char(a.data_agendamento, 'YYYY-MM-DD') AS dia, to_char(a.data_agendamento, 'HH24:MI') AS hora,
            s.nome AS servico_nome, s.empresa_id AS servico_empresa_id, s.loja_id AS servico_loja_id,
            u.nome_completo AS profissional_nome, u.empresa_id AS profissional_empresa_id,
            ul.loja_id AS profissional_loja_id
       FROM agendamentos a
       LEFT JOIN lojas l ON l.id = a.loja_id AND l.empresa_id = a.empresa_id
       LEFT JOIN servicos s ON s.id = a.servico_id AND s.empresa_id = a.empresa_id AND s.loja_id = a.loja_id
       LEFT JOIN usuarios u ON u.id = a.usuario_profissional_id AND u.empresa_id = a.empresa_id
       LEFT JOIN usuarios_lojas ul ON ul.usuario_id = u.id AND ul.loja_id = a.loja_id AND ul.ativo = true
      WHERE a.empresa_id = $1 AND a.loja_id = $2 AND a.data_agendamento >= CURRENT_TIMESTAMP
        AND a.status NOT IN ('cancelado', 'nao_compareceu', 'concluido')
      ORDER BY a.data_agendamento ASC LIMIT 200`,
    [empresa, unidade],
  );
  if (!Array.isArray(linhas?.rows)) throw new SchedulingError('leitura da agenda incompleta', 'AGENDA_SOURCE_UNVERIFIABLE');
  const servicos = barbearia.listarServicos(empresa);
  const profissionais = barbearia.listarProfissionais(empresa).filter((item) => item.ativo !== false);
  const resultado = { migrados: 0, pendentes: 0, motivos: [] };
  for (const linha of linhas.rows || []) {
    if (String(linha.empresa_id || '') !== empresa || String(linha.loja_id || '') !== unidade) {
      resultado.pendentes += 1;
      resultado.motivos.push('linha_fora_do_escopo');
      continue;
    }
    if (String(linha.loja_meta_id || '') !== unidade || String(linha.loja_empresa_id || '') !== empresa) {
      resultado.pendentes += 1;
      resultado.motivos.push('metadado_unidade_invalido');
      continue;
    }
    if (linha.servico_nome && (String(linha.servico_empresa_id || '') !== empresa || String(linha.servico_loja_id || '') !== unidade)) {
      resultado.pendentes += 1;
      resultado.motivos.push('metadado_servico_invalido');
      continue;
    }
    if (linha.profissional_nome && (String(linha.profissional_empresa_id || '') !== empresa || String(linha.profissional_loja_id || '') !== unidade)) {
      resultado.pendentes += 1;
      resultado.motivos.push('metadado_profissional_invalido');
      continue;
    }
    const servico = porNome(servicos, linha.servico_nome);
    const profissional = porNome(profissionais, linha.profissional_nome);
    if (!servico || !profissional) { resultado.pendentes += 1; resultado.motivos.push(!servico ? 'servico_sem_equivalente' : 'profissional_sem_equivalente'); continue; }
    try {
      const actionId = `migracao-pg:${linha.id}`;
      const codigo = createHash('sha256').update(`whatsapp-ia:${empresa}:${actionId}`).digest('hex').slice(0, 8).toUpperCase();
      // Repetição só é segura se a reserva JSON for da mesma unidade e tiver o
      // mesmo payload. Um código existente em outra unidade é conflito.
      const jaMigrado = barbearia.listarAgendamentos(empresa, {}).find((item) => item.codigoConfirmacao === codigo);
      const notas = limpo(linha.observacoes, 500);
      const replayValido = jaMigrado
        && String(jaMigrado.lojaId || '') === unidade
        && phoneMatchKey(jaMigrado.clienteTelefone) === phoneMatchKey(linha.cliente_telefone)
        && jaMigrado.dataAgenda === linha.dia
        && jaMigrado.horaLocal === linha.hora
        && jaMigrado.servicoId === servico.id
        && jaMigrado.profissionalId === profissional.id
        && limpo(jaMigrado.clienteNome, 160) === limpo(linha.cliente_nome, 160)
        && limpo(jaMigrado.observacoes, 600) === limpo(notas, 600);
      if (jaMigrado && !replayValido) {
        resultado.pendentes += 1;
        resultado.motivos.push('replay_divergente');
        continue;
      }
      const criado = replayValido ? respostaAgendamento(empresa, jaMigrado) : criarNaAgendaDaBarbearia({ ...scope }, {
        date: linha.dia, time: linha.hora, serviceId: servico.id, professionalId: profissional.id,
        customerName: linha.cliente_nome, customerPhone: linha.cliente_telefone,
        notes: notas, actionId,
      });
      const atualizado = await query(
        `UPDATE agendamentos SET status = 'cancelado',
                observacoes = LEFT(CONCAT_WS(' ', observacoes, $2::text), 1000)
          WHERE id = $1 AND empresa_id = $3 AND loja_id = $4
            AND data_agendamento >= CURRENT_TIMESTAMP
            AND status NOT IN ('cancelado', 'nao_compareceu', 'concluido')
          RETURNING id`,
        [linha.id, `[migrado para a agenda da barbearia: ${criado.codigo || criado.id}]`, empresa, unidade],
      );
      if (atualizado?.rowCount !== 1 || String(atualizado.rows?.[0]?.id || '') !== String(linha.id)) {
        resultado.pendentes += 1;
        resultado.motivos.push('atualizacao_pg_sem_correspondencia');
        continue;
      }
      resultado.migrados += 1;
    } catch (erro) {
      resultado.pendentes += 1;
      resultado.motivos.push(limpo(erro?.code || 'falha_migracao', 60));
    }
  }
  if (resultado.migrados) fonteCache.delete(`${empresa}:${unidade}`);
  return resultado;
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
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') return pgServices(scope);
  const empresa = chaveEmpresa(scope);
  const nomes = new Map(barbearia.listarProfissionais(empresa).map((item) => [item.id, item.nome]));
  return barbearia.listarServicos(empresa)
    .filter((item) => item.ativo !== false && item.permiteAgendamentoOnline !== false)
    .map((item) => ({
      id: item.id,
      nome: item.nome,
      descricao: item.descricao || '',
      categoria: item.categoria || 'Geral',
      duracaoMinutos: Number(item.duracaoMinutos || 30),
      preco: Number(item.preco || 0),
      // A IA deve dizer "a partir de" ou "sob consulta" em vez de prometer valor fechado.
      tipoPreco: item.tipoPreco || 'fixo',
      precoTexto: barbearia.rotuloPrecoServico(item),
      // Quem faz: a IA só oferece estes profissionais para o serviço.
      profissionais: Array.isArray(item.profissionaisIds) && item.profissionaisIds.length
        ? item.profissionaisIds.map((id) => nomes.get(id)).filter(Boolean)
        : 'qualquer profissional',
    }));
}

export async function listProfessionals(scope) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') return pgProfessionals(scope);
  return barbearia.listarProfissionais(chaveEmpresa(scope))
    .filter((item) => item.ativo !== false)
    .map((item) => ({ id: item.id, nome: item.nome, especialidade: item.especialidade || '' }));
}

export async function availability(scope, input = {}) {
  exigirEscopoOperacional(scope, input, true);
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
    // Aviso no celular do profissional (app do barbeiro) também para ações feitas pela IA.
    const legado = contexto.legacyEmpresaId || contexto.empresaId;
    const servicoNome = agendamento.servicoNome || barbearia.listarServicos(legado, { incluirInativos: true }).find((s) => s.id === agendamento.servicoId)?.nome || '';
    await notificarEquipe(legado, agendamento, evento, { servicoNome }).catch(() => null);
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
    slotFingerprint: agendamento.slotFingerprint || captacao.fingerprintSlot({ empresaId: empresa, ...agendamento }),
  };
}

export async function createAppointment(trx, scope, input = {}) {
  exigirEscopoOperacional(scope, input, true);
  if (await agendaSource(scope) === 'postgres') return pgCreate(trx, scope, input);
  return criarNaAgendaDaBarbearia(scope, input);
}

function criarNaAgendaDaBarbearia(scope, input = {}) {
  const empresa = chaveEmpresa(scope);
  // Idempotência precisa preceder a resolução do slot: numa repetição depois de
  // uma resposta perdida, o próprio atendimento já ocupa o horário e não pode
  // ser confundido com um novo conflito.
  const codigo = input.actionId
    ? createHash('sha256').update(`whatsapp-ia:${empresa}:${input.actionId}`).digest('hex').slice(0, 8).toUpperCase()
    : randomBytes(4).toString('hex').toUpperCase();
  const existente = input.actionId
    ? barbearia.listarAgendamentos(empresa, {}).find((item) => item.codigoConfirmacao === codigo)
    : null;
  if (existente) {
    const profissionalSolicitado = limpo(input.professionalId, 100) || 'qualquer';
    const mesmoPedido = String(existente.lojaId || '') === String(scope.lojaId || '')
      && phoneMatchKey(existente.clienteTelefone) === phoneMatchKey(input.customerPhone)
      && existente.dataAgenda === dataLocalValida(input.date)
      && existente.horaLocal === limpo(input.time, 5)
      && existente.servicoId === limpo(input.serviceId, 100)
      && (profissionalSolicitado === 'qualquer' || existente.profissionalId === profissionalSolicitado)
      && limpo(existente.clienteNome, 160) === limpo(input.customerName, 160)
      && limpo(existente.observacoes, 600) === limpo(input.notes, 600);
    if (!mesmoPedido) throw new SchedulingError('a confirmação já foi usada em outro contexto; revise a ação antes de confirmar novamente', 'IDEMPOTENCY_CONFLICT');
    return respostaAgendamento(empresa, existente);
  }
  try {
    const livre = barbearia.resolverProfissionalDisponivel(empresa, {
      data: dataLocalValida(input.date),
      horario: limpo(input.time, 5),
      servicoId: limpo(input.serviceId, 100),
      profissionalId: limpo(input.professionalId, 100) || 'qualquer',
      lojaId: scope.lojaId,
    });
    // Limite por VISITA (dia + pessoa), não por serviço: no WhatsApp o mesmo número marca
    // para a família ("eu e o Pedro") e vários serviços na mesma ida (barba + manicure).
    const futurosDoTelefone = agendamentosDoTelefone(empresa, input.customerPhone, { lojaId: scope.lojaId }).filter((item) => ATIVOS.has(item.status));
    const visitas = new Set(futurosDoTelefone.map((item) => `${item.dataAgenda}|${limpo(item.clienteNome, 160).toLowerCase()}`));
    const estaVisita = `${dataLocalValida(input.date)}|${limpo(input.customerName, 160).toLowerCase()}`;
    const limite = Math.max(1, Number.parseInt(process.env.WHATSAPP_AGENDAMENTO_MAX_VISITAS_POR_TELEFONE || process.env.AGENDAMENTO_PUBLICO_MAX_POR_TELEFONE || '4', 10));
    const servicosNaVisita = futurosDoTelefone.filter((item) => `${item.dataAgenda}|${limpo(item.clienteNome, 160).toLowerCase()}` === estaVisita).length;
    if ((!visitas.has(estaVisita) && visitas.size >= limite) || servicosNaVisita >= 4) throw new SchedulingError('este telefone já tem horários marcados; remarque ou cancele um deles antes', 'PHONE_LIMIT');
    const mesmoServico = futurosDoTelefone.some((item) => `${item.dataAgenda}|${limpo(item.clienteNome, 160).toLowerCase()}` === estaVisita && item.servicoId === limpo(input.serviceId, 100));
    if (mesmoServico) throw new SchedulingError('este cliente já tem este serviço marcado neste dia', 'ALREADY_BOOKED');
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
    agendamento.slotFingerprint = captacao.fingerprintSlot({ empresaId: empresa, ...agendamento });
    captacao.marcarListaEsperaAgendada(empresa, {
      telefone: agendamento.clienteTelefone,
      data: agendamento.dataAgenda,
      lojaId: agendamento.lojaId,
      servicoId: agendamento.servicoId,
      profissionalId: agendamento.profissionalId,
      dataHora: agendamento.dataHora,
      horaLocal: agendamento.horaLocal,
      duracaoMinutos: agendamento.duracaoMinutos,
      slotFingerprint: agendamento.slotFingerprint,
      agendamentoId: agendamento.id,
    });
    notificarDepois({ empresaId: scope.empresaId, lojaId: scope.lojaId, legacyEmpresaId: empresa }, agendamento, 'criado');
    return respostaAgendamento(empresa, agendamento);
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

function agendamentosDoTelefone(empresa, phone, { includePast = false, lojaId } = {}) {
  const chave = phoneMatchKey(phone);
  const unidade = limpo(lojaId, 120);
  if (!chave || !unidade) return [];
  const agora = Date.now();
  return barbearia.listarAgendamentos(empresa, {})
    .filter((item) => String(item.lojaId || '') === unidade)
    .filter((item) => phoneMatchKey(item.clienteTelefone) === chave)
    .filter((item) => !['cancelado', 'nao_compareceu'].includes(item.status))
    .filter((item) => includePast || new Date(item.dataHora).valueOf() >= agora);
}

function horarioLocalLegivel(dataHora) {
  const data = new Date(dataHora || '');
  if (Number.isNaN(data.valueOf())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(data).replace(',', ' às');
}

export async function listCustomerAppointments(scope, { includePast = false, limit = 8 } = {}) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') return pgCustomerAppointments(scope, { includePast, limit });
  const empresa = chaveEmpresa(scope);
  const servicos = new Map(barbearia.listarServicos(empresa, { incluirInativos: true }).map((item) => [item.id, item]));
  const profissionais = new Map(barbearia.listarProfissionais(empresa, { incluirInativos: true }).map((item) => [item.id, item]));
  return agendamentosDoTelefone(empresa, scope.phone, { includePast, lojaId: scope.lojaId })
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
      cliente: item.clienteNome || '',
      // Remarcação feita pela equipe (balcão/admin): a IA explica em vez de contradizer o cliente.
      remarcacaoAnterior: Array.isArray(item.historicoRemarcacoes) && item.historicoRemarcacoes[0]
        ? { de: horarioLocalLegivel(item.historicoRemarcacoes[0].antes?.dataHora), origem: item.historicoRemarcacoes[0].origem || 'admin', feitaPelaEquipe: !['whatsapp_ia', 'cliente_site'].includes(item.historicoRemarcacoes[0].origem) }
        : null,
      servico: { id: item.servicoId, nome: servicos.get(item.servicoId)?.nome || 'Serviço' },
      profissional: { id: item.profissionalId, nome: profissionais.get(item.profissionalId)?.nome || 'Profissional da equipe' },
    }));
}

function agendamentoDoContato(empresa, phone, appointmentId, lojaId) {
  const agendamento = agendamentosDoTelefone(empresa, phone, { includePast: true, lojaId }).find((item) => item.id === limpo(appointmentId, 120));
  if (!agendamento) throw new SchedulingError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');
  if (!ATIVOS.has(agendamento.status)) throw new SchedulingError('este agendamento já não está ativo', 'APPOINTMENT_NOT_ACTIVE');
  return agendamento;
}

/**
 * Cliente confirma presença (ex.: respondendo ao lembrete da véspera).
 * Só no horário do próprio telefone e ainda ativo; idempotente.
 */
export async function confirmAttendance(scope, appointmentId) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') throw new SchedulingError('confirmação de presença disponível apenas na agenda da barbearia', 'NOT_BARBERSHOP_AGENDA');
  const empresa = chaveEmpresa(scope);
  const agendamento = agendamentoDoContato(empresa, scope.phone, appointmentId, scope.lojaId);
  if (new Date(agendamento.dataHora).valueOf() < Date.now() - 30 * 60 * 1000) throw new SchedulingError('este horário já passou', 'APPOINTMENT_PAST');
  const atualizado = agendamento.status === 'confirmado'
    ? agendamento
    : barbearia.alterarStatusAgendamento(empresa, agendamento.id, 'confirmado', { lojaId: scope.lojaId, observacoes: limpo(`${agendamento.observacoes || ''} · Presença confirmada pelo cliente no WhatsApp`.replace(/^ · /, ''), 600) });
  if (!atualizado) throw new SchedulingError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');
  return { ...respostaAgendamento(empresa, atualizado), jaEstavaConfirmado: agendamento.status === 'confirmado' };
}

/** Cliente avisa atraso: anota no horário para a equipe ver na agenda (não move o horário). */
export async function noteDelay(scope, appointmentId, minutes) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') throw new SchedulingError('aviso de atraso disponível apenas na agenda da barbearia', 'NOT_BARBERSHOP_AGENDA');
  const empresa = chaveEmpresa(scope);
  const agendamento = agendamentoDoContato(empresa, scope.phone, appointmentId, scope.lojaId);
  const min = Math.round(Number(minutes));
  if (!Number.isFinite(min) || min < 1 || min > 120) throw new SchedulingError('informe o atraso em minutos (1 a 120)', 'INVALID_DELAY');
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const nota = `Cliente avisou atraso de ~${min} min às ${hora} (WhatsApp)`;
  const atualizado = barbearia.alterarStatusAgendamento(empresa, agendamento.id, agendamento.status, { lojaId: scope.lojaId, observacoes: limpo(`${agendamento.observacoes || ''} · ${nota}`.replace(/^ · /, ''), 600) });
  if (!atualizado) throw new SchedulingError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');
  return { ...respostaAgendamento(empresa, atualizado), atrasoMinutos: min };
}

export async function rescheduleAppointment(trx, scope, input = {}) {
  exigirEscopoOperacional(scope, input);
  if (await agendaSource(scope) === 'postgres') return pgReschedule(trx, scope, input);
  const empresa = chaveEmpresa(scope);
  try {
    const atual = agendamentoDoContato(empresa, scope.phone, input.appointmentId, scope.lojaId);
    const livre = barbearia.resolverProfissionalDisponivel(empresa, {
      data: dataLocalValida(input.date),
      horario: limpo(input.time, 5),
      servicoId: atual.servicoId,
      profissionalId: atual.profissionalId || 'qualquer',
      lojaId: scope.lojaId,
    });
    const atualizado = barbearia.atualizarAgendamento(empresa, atual.id, {
      lojaId: scope.lojaId,
      dataHora: livre.dataHora,
      dataAgenda: livre.dataAgenda,
      horaLocal: livre.horaLocal,
      profissionalId: livre.profissional.id,
      origem: 'whatsapp_ia',
    });
    atualizado.slotFingerprint = captacao.fingerprintSlot({ empresaId: empresa, ...atualizado, lojaId: scope.lojaId });
    // A remarcação muda a identidade do slot; o profissional escolhido permanece
    // sendo a preferência do agendamento original.
    captacao.marcarListaEsperaAgendada(empresa, {
      telefone: atualizado.clienteTelefone,
      data: atualizado.dataAgenda,
      lojaId: atualizado.lojaId,
      servicoId: atualizado.servicoId,
      profissionalId: atualizado.profissionalId,
      dataHora: atualizado.dataHora,
      horaLocal: atualizado.horaLocal,
      duracaoMinutos: atualizado.duracaoMinutos,
      slotFingerprint: atualizado.slotFingerprint,
      agendamentoId: atualizado.id,
    });
    notificarDepois({ empresaId: scope.empresaId, lojaId: scope.lojaId, legacyEmpresaId: empresa }, atualizado, 'remarcado');
    return { ...respostaAgendamento(empresa, atualizado), profissional: livre.profissional.nome };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

export async function cancelAppointment(trx, scope, appointmentId) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') return pgCancel(trx, scope, appointmentId);
  const empresa = chaveEmpresa(scope);
  try {
    const atual = agendamentoDoContato(empresa, scope.phone, appointmentId, scope.lojaId);
    const cancelado = barbearia.alterarStatusAgendamento(empresa, atual.id, 'cancelado', { lojaId: scope.lojaId, observacoes: `${atual.observacoes ? `${atual.observacoes} · ` : ''}Cancelado pelo cliente no WhatsApp` });
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
  return queueWaitlistNotifications(contexto, agendamentoLiberado, candidatos);
}
