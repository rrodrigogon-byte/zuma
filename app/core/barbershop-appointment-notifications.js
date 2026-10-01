import { isWhatsappOptOutText, phoneMatchKey } from './whatsapp-phone.js';
import { createHash } from 'node:crypto';
import { db as legacyDb } from '../db.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import * as clientes from '../clientes-contas-kytto.js';
import { db } from './database.js';
import { enviarMensagem } from './whatsapp.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENTOS = new Set(['criado', 'remarcado', 'cancelado', 'lembrete']);

function limpo(valor, limite = 500) { return String(valor ?? '').trim().replace(/\u0000/g, '').slice(0, limite); }
function normalizarTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  const telefone = digitos.startsWith('55') ? digitos : (digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos);
  return telefone.length >= 12 && telefone.length <= 13 ? telefone : '';
}
function sha(valor) { return createHash('sha256').update(String(valor || '')).digest('hex').slice(0, 20); }
function uuidOuVazio(valor) { const texto = limpo(valor, 60); return UUID.test(texto) ? texto : ''; }
function dataValida(valor) { const data = new Date(valor); return Number.isNaN(data.valueOf()) ? null : data; }
function formatarQuando(agendamento) {
  const dataLocal = limpo(agendamento?.dataAgenda, 10);
  const horaLocal = limpo(agendamento?.horaLocal, 5);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataLocal) && /^\d{2}:\d{2}$/.test(horaLocal)) {
    const [ano, mes, dia] = dataLocal.split('-');
    return `${dia}/${mes}/${ano}, às ${horaLocal}`;
  }
  const data = dataValida(agendamento?.dataHora);
  return data ? data.toLocaleString('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }) : 'horário a confirmar';
}

function clienteElegivel(legacyEmpresaId, agendamento) {
  if (!agendamento?.clienteId) return { eligible: false, reason: 'customer_not_registered' };
  const cliente = clientes.obterCliente(String(legacyEmpresaId), String(agendamento.clienteId));
  if (!cliente || cliente.padrao) return { eligible: false, reason: 'customer_not_found' };
  if (cliente.consentimentos?.whatsapp?.atendimento?.concedido !== true) return { eligible: false, reason: 'service_consent_required' };
  const telefone = normalizarTelefone(cliente.telefone);
  if (!telefone) return { eligible: false, reason: 'phone_unavailable' };
  return { eligible: true, cliente, telefone };
}

async function canalAtivo(trx, empresaId, lojaId, canalId = '') {
  const parametros = [empresaId, lojaId];
  const filtro = canalId ? 'AND id=$3' : '';
  if (canalId) parametros.push(canalId);
  const resultado = await trx.query(
    `SELECT id,empresa_id,loja_id,nome,api_base_url,configuracao
       FROM canais_integracao
      WHERE empresa_id=$1 AND loja_id=$2 AND provedor='whatsapp' AND status='ativo' ${filtro}
      ORDER BY data_atualizacao DESC LIMIT 1`,
    parametros,
  );
  return resultado.rows[0] || null;
}

function referencia(agendamento, evento) {
  return `${limpo(agendamento.id, 100)}:${evento}:${sha(`${agendamento.dataHora}|${agendamento.status}`)}`;
}

function tarefaPayload({ legacyEmpresaId, agendamento, evento }) {
  return {
    version: 'barbershop-appointment-v1',
    legacyEmpresaId: limpo(legacyEmpresaId, 120),
    appointmentId: limpo(agendamento.id, 120),
    customerId: limpo(agendamento.clienteId, 120),
    eventType: evento,
    scheduleFingerprint: sha(`${agendamento.dataHora}|${agendamento.profissionalId}|${agendamento.servicoId}`),
  };
}

async function inserirTarefa(trx, { empresaId, lojaId, canalId, legacyEmpresaId, agendamento, evento, executarEm }) {
  const ref = referencia(agendamento, evento);
  const resultado = await trx.query(
    `INSERT INTO tarefas_integracao_canais
       (empresa_id,loja_id,canal_id,tipo,referencia_externa,payload,status,proxima_tentativa_em)
     VALUES ($1,$2,$3,'notificar_agendamento',$4,$5::jsonb,'pendente',$6)
     ON CONFLICT (empresa_id,tipo,referencia_externa) WHERE tipo='notificar_agendamento' DO NOTHING
     RETURNING id`,
    [empresaId, lojaId, canalId, ref, JSON.stringify(tarefaPayload({ legacyEmpresaId, agendamento, evento })), executarEm],
  );
  return Number(resultado.rowCount || 0);
}

export async function queueAppointmentNotifications(contexto = {}, agendamento = {}, eventoRecebido = 'criado') {
  const empresaId = uuidOuVazio(contexto.empresaId);
  const lojaId = uuidOuVazio(contexto.lojaId);
  const legacyEmpresaId = limpo(contexto.legacyEmpresaId || contexto.empresaId, 120);
  const evento = limpo(eventoRecebido, 30).toLowerCase();
  if (!empresaId || !lojaId) return { queued: 0, skipped: true, reason: 'commerce_scope_unavailable' };
  if (agendamento?.lojaId && String(agendamento.lojaId) !== lojaId) return { queued: 0, skipped: true, reason: 'store_scope_mismatch' };
  if (!EVENTOS.has(evento) || !agendamento?.id) return { queued: 0, skipped: true, reason: 'appointment_event_invalid' };
  const elegibilidade = clienteElegivel(legacyEmpresaId, agendamento);
  if (!elegibilidade.eligible) return { queued: 0, skipped: true, reason: elegibilidade.reason };
  const dataHora = dataValida(agendamento.dataHora);
  if (!dataHora && evento !== 'cancelado') return { queued: 0, skipped: true, reason: 'schedule_invalid' };
  return db.transaction(async (trx) => {
    const canal = await canalAtivo(trx, empresaId, lojaId);
    if (!canal) return { queued: 0, skipped: true, reason: 'whatsapp_channel_inactive' };
    if (evento === 'remarcado' || evento === 'cancelado') {
      await trx.query(
        `UPDATE tarefas_integracao_canais
            SET status='cancelada',proxima_tentativa_em=NULL,data_atualizacao=CURRENT_TIMESTAMP
          WHERE empresa_id=$1 AND loja_id=$2 AND tipo='notificar_agendamento'
            AND payload->>'legacyEmpresaId'=$3             AND payload->>'appointmentId'=$4
            AND payload->>'eventType' IN ('criado','remarcado','lembrete') AND status IN ('pendente','falha')`,
        [empresaId, lojaId, legacyEmpresaId, String(agendamento.id)],
      );
    }
    let queued = 0;
    if (evento !== 'lembrete') queued += await inserirTarefa(trx, { empresaId, lojaId, canalId: canal.id, legacyEmpresaId, agendamento, evento, executarEm: new Date() });
    if (evento !== 'cancelado' && !['cancelado', 'concluido', 'nao_compareceu'].includes(String(agendamento.status))) {
      const lembreteAlvo = dataHora.valueOf() - 24 * 60 * 60 * 1000;
      if (lembreteAlvo >= Date.now() - 60 * 60 * 1000) {
        queued += await inserirTarefa(trx, { empresaId, lojaId, canalId: canal.id, legacyEmpresaId, agendamento, evento: 'lembrete', executarEm: new Date(Math.max(Date.now(), lembreteAlvo)) });
      }
    }
    return { queued, skipped: false };
  });
}

export async function enqueueDueAppointmentReminders() {
  const raiz = legacyDb();
  let queued = 0;
  for (const [legacyEmpresaId, estado] of Object.entries(raiz.barbearias || {})) {
    for (const agendamento of Object.values(estado?.agendamentos || {})) {
      const dataHora = dataValida(agendamento?.dataHora);
      if (!dataHora || dataHora.valueOf() < Date.now() + 23 * 60 * 60 * 1000 || dataHora.valueOf() > Date.now() + 36 * 60 * 60 * 1000) continue;
      if (['cancelado', 'concluido', 'nao_compareceu'].includes(String(agendamento.status))) continue;
      const resultado = await queueAppointmentNotifications({ empresaId: legacyEmpresaId, lojaId: agendamento.lojaId, legacyEmpresaId }, agendamento, 'lembrete').catch(() => null);
      queued += Number(resultado?.queued || 0);
    }
  }
  return queued;
}

function mensagem(snapshot, agendamento, cliente, evento) {
  const servico = snapshot.servicos.find((item) => item.id === agendamento.servicoId)?.nome || 'atendimento';
  const profissional = snapshot.profissionais.find((item) => item.id === agendamento.profissionalId)?.nome || 'profissional da equipe';
  const quando = formatarQuando(agendamento);
  const cabecalho = `Olá, ${limpo(cliente.nome, 80)}.`;
  const rodape = 'Esta é uma mensagem de atendimento. Para não receber estes avisos, responda SAIR.';
  if (evento === 'cancelado') return `${cabecalho} Seu agendamento na ${limpo(snapshot.configuracao.nomePublico || 'barbearia', 120)} foi cancelado. Se precisar, entre em contato para escolher outro horário. ${rodape}`;
  if (evento === 'remarcado') return `${cabecalho} Seu agendamento foi remarcado para ${quando}. Serviço: ${servico}. Profissional: ${profissional}. ${rodape}`;
  if (evento === 'lembrete') return `${cabecalho} Lembrete do seu agendamento amanhã, ${quando}. Serviço: ${servico}. Profissional: ${profissional}. ${rodape}`;
  return `${cabecalho} Seu agendamento foi registrado para ${quando}. Serviço: ${servico}. Profissional: ${profissional}. ${rodape}`;
}

function appointmentDeliveryError(message, code, retryable = false) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

export async function processAppointmentNotificationTask(task = {}) {
  const payload = task.payload || {};
  if (task.delivery_started_at) throw appointmentDeliveryError('resultado anterior da notificação incerto; revisão humana obrigatória', 'APPOINTMENT_DELIVERY_UNKNOWN', false);
  const legacyEmpresaId = limpo(payload.legacyEmpresaId, 120);
  const appointmentId = limpo(payload.appointmentId, 120);
  const evento = limpo(payload.eventType, 30).toLowerCase();
  if (!legacyEmpresaId || !appointmentId || !EVENTOS.has(evento)) return { skipped: true, reason: 'task_payload_invalid' };
  const snapshot = {
    configuracao: barbearia.obterConfiguracao(legacyEmpresaId),
    profissionais: barbearia.listarProfissionais(legacyEmpresaId, { incluirInativos: true }),
    servicos: barbearia.listarServicos(legacyEmpresaId, { incluirInativos: true }),
    agendamentos: barbearia.listarAgendamentos(legacyEmpresaId, {}),
  };
  const agendamento = snapshot.agendamentos.find((item) => item.id === appointmentId);
  if (!agendamento) return { skipped: true, reason: 'appointment_not_found' };
  if (String(agendamento.lojaId || '') !== String(task.loja_id || '')) return { skipped: true, reason: 'store_scope_mismatch' };
  if (evento !== 'cancelado' && ['cancelado', 'concluido', 'nao_compareceu'].includes(String(agendamento.status))) return { skipped: true, reason: 'appointment_not_eligible' };
  if (payload.scheduleFingerprint !== sha(`${agendamento.dataHora}|${agendamento.profissionalId}|${agendamento.servicoId}`)) return { skipped: true, reason: 'schedule_changed' };
  const elegibilidade = clienteElegivel(legacyEmpresaId, agendamento);
  if (!elegibilidade.eligible) return { skipped: true, reason: elegibilidade.reason };
  const channelResult = await db.query(
    `SELECT id,empresa_id,loja_id,nome,api_base_url,configuracao FROM canais_integracao
      WHERE id=$1 AND empresa_id=$2 AND loja_id=$3 AND provedor='whatsapp' AND status='ativo' LIMIT 1`,
    [task.canal_id, task.empresa_id, task.loja_id],
  );
  const canal = channelResult.rows[0];
  if (!canal) return { skipped: true, reason: 'whatsapp_channel_inactive' };
  await db.query(
    `UPDATE tarefas_integracao_canais SET delivery_started_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando' AND lease_token = $2::uuid`,
    [task.id, task.lease_token],
  );
  const resultado = await enviarMensagem({
    whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
    whatsapp_api_key: process.env.EVOLUTION_API_KEY,
    whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
  }, elegibilidade.telefone, mensagem(snapshot, agendamento, elegibilidade.cliente, evento));
  if (!resultado?.ok) {
    const unknown = resultado?.uncertain === true;
    if (!unknown) await db.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = NULL WHERE id = $1`, [task.id]);
    throw appointmentDeliveryError(unknown ? 'resultado da notificação incerto' : 'Evolution recusou a notificação de agenda', unknown ? 'APPOINTMENT_DELIVERY_UNKNOWN' : 'APPOINTMENT_SEND_FAILED', !unknown && resultado?.retryable === true);
  }
  const providerMessageId = limpo(resultado?.data?.key?.id || resultado?.data?.id, 200) || null;
  await db.query(`UPDATE tarefas_integracao_canais SET provider_message_id = $2 WHERE id = $1`, [task.id, providerMessageId]);
  return { sent: true, appointmentId, eventType: evento, providerMessageId };
}

export async function recordAppointmentNotificationOptOut(channel = {}, parsed = {}) {
  const comando = limpo(parsed.text, 80).toUpperCase().replace(/[.!?]+$/g, '').trim();
  const telefone = normalizarTelefone(parsed.phone || parsed.remoteJid);
  const empresaId = uuidOuVazio(channel.empresa_id);
  const lojaId = uuidOuVazio(channel.loja_id);
  if (!isWhatsappOptOutText(comando) || !telefone || !empresaId || !lojaId) return { optedOut: false };
  const clientesEmpresa = clientes.listarClientes(empresaId).filter((cliente) => phoneMatchKey(cliente.telefone) === phoneMatchKey(telefone) && cliente.consentimentos?.whatsapp?.atendimento?.concedido === true);
  for (const cliente of clientesEmpresa) clientes.atualizarConsentimentoCliente(empresaId, cliente.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: false, origem: 'whatsapp_opt_out', responsavel: 'cliente' });
  if (clientesEmpresa.length) {
    await db.query(
      `UPDATE tarefas_integracao_canais SET status='cancelada',proxima_tentativa_em=NULL,data_atualizacao=CURRENT_TIMESTAMP
        WHERE empresa_id=$1 AND loja_id=$2 AND tipo='notificar_agendamento'
          AND payload->>'customerId'=ANY($3::text[]) AND status IN ('pendente','falha')`,
      [empresaId, lojaId, clientesEmpresa.map((cliente) => String(cliente.id))],
    );
  }
  return { optedOut: clientesEmpresa.length > 0, customers: clientesEmpresa.length };
}

export async function appointmentNotificationMetrics(contexto = {}) {
  const empresaId = uuidOuVazio(contexto.empresaId);
  const lojaId = uuidOuVazio(contexto.lojaId);
  if (!empresaId || !lojaId) return { queued: 0, sent: 0, failed: 0, canceled: 0 };
  const resultado = await db.query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('pendente','processando'))::int AS queued,
            COUNT(*) FILTER (WHERE status='concluida' AND COALESCE((resposta->>'sent')::boolean,false))::int AS sent,
            COUNT(*) FILTER (WHERE status='falha')::int AS failed,
            COUNT(*) FILTER (WHERE status='cancelada')::int AS canceled
       FROM tarefas_integracao_canais WHERE empresa_id=$1 AND loja_id=$2 AND tipo='notificar_agendamento'`,
    [empresaId, lojaId],
  );
  return resultado.rows[0] || { queued: 0, sent: 0, failed: 0, canceled: 0 };
}
