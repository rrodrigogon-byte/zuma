import { isWhatsappOptOutText, phoneMatchKey } from './whatsapp-phone.js';
import { createHash } from 'node:crypto';
import { db as legacyDb, save as legacySave } from '../db.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import * as clientes from '../clientes-contas-kytto.js';
import { db } from './database.js';
import { enviarMensagem } from './whatsapp.js';
import { notificarEquipe } from '../dino-push-equipe.js';
import { personaAppointmentMessage, quandoCurto, resolvePersona } from './whatsapp-ai-persona.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENTOS = new Set(['criado', 'remarcado', 'cancelado', 'lembrete']);
// Aviso de vaga para a lista de espera: reaproveita a mesma fila e o mesmo tipo de
// tarefa (notificar_agendamento), sem nova tabela nem migração.
const EVENTO_VAGA = 'vaga';
// Pedido de avaliação (NPS) depois do atendimento concluído: mesma fila e tipo.
const EVENTO_AVALIACAO = 'avaliacao';
// Cobrança do clube (link de pagamento ou Pix copia e cola): mesma fila.
const EVENTO_COBRANCA = 'cobranca';

const DOMINIOS_OFICIAIS_DINO = new Set([
  'https://dino.kytto.com.br',
  'https://dinobarbearia.com.br',
  'https://www.dinobarbearia.com.br',
]);

function urlPublicaBase(slug) {
  // Render hospeda vários tenants. O domínio Dino nunca pode ser usado por
  // uma outra barbearia que possua slug próprio. Para outros tenants, só
  // habilitar convites quando houver configuração validada de domínio por empresa.
  if (slug !== 'dino') return '';
  // DINO_PUBLIC_URL escolhe o domínio próprio da barbearia (ex.: https://dinobarbearia.com.br)
  // quando o DNS dele já estiver no ar; sem ela, segue o endereço público atual.
  const base = limpo(process.env.DINO_PUBLIC_URL || process.env.PUBLIC_BASE_URL || process.env.SERVER_URL || process.env.PUBLIC_APP_URL, 300).replace(/\/+$/, '');
  // Em PRD a pesquisa da Dino só pode apontar para um domínio oficial da Dino.
  if (process.env.NODE_ENV === 'production' && !DOMINIOS_OFICIAIS_DINO.has(base)) return '';
  return /^https:\/\//.test(base) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) ? base : '';
}

export function linkAvaliacao(legacyEmpresaId, agendamento = {}) {
  const slug = limpo(barbearia.obterConfiguracao(legacyEmpresaId)?.slugPublico, 80);
  const base = urlPublicaBase(slug);
  const codigo = limpo(agendamento.codigoConfirmacao, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!base || !slug || codigo.length < 6) return '';
  return `${base}/avaliar/${encodeURIComponent(slug)}`;
}

function jaAvaliado(legacyEmpresaId, agendamentoId) {
  return Boolean(legacyDb().barbeariaCaptacao?.[legacyEmpresaId]?.avaliacoes?.[agendamentoId]);
}

function limpo(valor, limite = 500) { return String(valor ?? '').trim().replace(/\u0000/g, '').slice(0, limite); }
function normalizarTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  const telefone = digitos.startsWith('55') ? digitos : (digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos);
  return telefone.length >= 12 && telefone.length <= 13 ? telefone : '';
}
function sha(valor) { return createHash('sha256').update(String(valor || '')).digest('hex').slice(0, 20); }
function uuidOuVazio(valor) { const texto = limpo(valor, 60); return UUID.test(texto) ? texto : ''; }
function dataValida(valor) { const data = new Date(valor); return Number.isNaN(data.valueOf()) ? null : data; }
/**
 * Quem acabou de marcar/remarcar (há menos de 6 h) um horário que acontece nas
 * próximas 30 h já recebeu a confirmação com o código: o lembrete logo em seguida
 * seria uma segunda mensagem repetida. Nesse caso não há lembrete.
 */
export function lembreteRedundante(agendamento = {}, dataHora = dataValida(agendamento.dataHora), agora = Date.now()) {
  if (!dataHora) return false;
  const mexidoEm = new Date(agendamento.atualizadoEm || agendamento.criadoEm || 0).valueOf();
  if (!Number.isFinite(mexidoEm) || !mexidoEm) return false;
  return agora - mexidoEm < 6 * 60 * 60 * 1000 && dataHora.valueOf() - agora < 30 * 60 * 60 * 1000;
}

/** "hoje" / "amanhã" / "no sábado" conforme o dia local de Cuiabá no momento do envio. */
export function quandoRelativo(agendamento = {}, agora = new Date()) {
  const dia = limpo(agendamento.dataAgenda, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return 'em breve';
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(agora);
  const amanha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(agora.valueOf() + 86400000));
  if (dia === hoje) return 'hoje';
  if (dia === amanha) return 'amanhã';
  const semana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][new Date(`${dia}T12:00:00Z`).getUTCDay()];
  return `${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}`;
}

function formatarQuando(agendamento) {
  const dataLocal = limpo(agendamento?.dataAgenda, 10);
  const horaLocal = limpo(agendamento?.horaLocal, 5);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataLocal) && /^\d{2}:\d{2}$/.test(horaLocal)) {
    const [ano, mes, dia] = dataLocal.split('-');
    return `${dia}/${mes}/${ano}, às ${horaLocal}`;
  }
  const data = dataValida(agendamento?.dataHora);
  return data ? data.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', dateStyle: 'short', timeStyle: 'short' }) : 'horário a confirmar';
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

function telefoneDaPesquisaConfere(agendamento, telefone) {
  // O formulário pede o telefone da reserva: não enviar uma pesquisa a outro
  // número se o telefone do cliente mudou depois do atendimento.
  return Boolean(phoneMatchKey(agendamento.clienteTelefone))
    && phoneMatchKey(telefone) === phoneMatchKey(agendamento.clienteTelefone);
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
  // Aviso no celular do profissional (push do app do barbeiro): independe do
  // consentimento do cliente e do WhatsApp, e nunca atrasa nem derruba o fluxo.
  if (['criado', 'remarcado', 'cancelado'].includes(evento) && agendamento?.id) {
    const servicoNome = agendamento.servicoNome
      || barbearia.listarServicos(legacyEmpresaId, { incluirInativos: true }).find((s) => s.id === agendamento.servicoId)?.nome || '';
    setImmediate(() => { notificarEquipe(legacyEmpresaId, agendamento, evento, { servicoNome }).catch(() => null); });
  }
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
      if (lembreteAlvo >= Date.now() - 60 * 60 * 1000 && !lembreteRedundante(agendamento, dataHora)) {
        queued += await inserirTarefa(trx, { empresaId, lojaId, canalId: canal.id, legacyEmpresaId, agendamento, evento: 'lembrete', executarEm: new Date(Math.max(Date.now(), lembreteAlvo)) });
      }
    }
    return { queued, skipped: false };
  });
}

/**
 * Enfileira o aviso "abriu um horário" para quem está na lista de espera do dia.
 * Só para quem marcou o consentimento de WhatsApp ao entrar na lista.
 */
export async function queueWaitlistNotifications(contexto = {}, agendamentoLiberado = {}, candidatos = []) {
  const empresaId = uuidOuVazio(contexto.empresaId);
  const lojaId = uuidOuVazio(contexto.lojaId || agendamentoLiberado.lojaId);
  const legacyEmpresaId = limpo(contexto.legacyEmpresaId || contexto.empresaId, 120);
  const elegiveis = (candidatos || []).filter((item) => item?.consentimentoWhatsapp === true && normalizarTelefone(item.telefone));
  if (!empresaId || !lojaId) return { queued: 0, skipped: true, reason: 'commerce_scope_unavailable' };
  if (!agendamentoLiberado?.id || !elegiveis.length) return { queued: 0, skipped: true, reason: 'no_eligible_waitlist' };
  return db.transaction(async (trx) => {
    const canal = await canalAtivo(trx, empresaId, lojaId);
    if (!canal) return { queued: 0, skipped: true, reason: 'whatsapp_channel_inactive' };
    let queued = 0;
    const queuedIds = [];
    for (const candidato of elegiveis) {
      const resultado = await trx.query(
        `INSERT INTO tarefas_integracao_canais
           (empresa_id,loja_id,canal_id,tipo,referencia_externa,payload,status,proxima_tentativa_em)
         VALUES ($1,$2,$3,'notificar_agendamento',$4,$5::jsonb,'pendente',CURRENT_TIMESTAMP)
         ON CONFLICT (empresa_id,tipo,referencia_externa) WHERE tipo='notificar_agendamento' DO NOTHING
         RETURNING id`,
        [empresaId, lojaId, canal.id, `${limpo(agendamentoLiberado.id, 100)}:${EVENTO_VAGA}:${limpo(candidato.id, 60)}`, JSON.stringify({
          version: 'barbershop-appointment-v1',
          legacyEmpresaId,
          appointmentId: limpo(agendamentoLiberado.id, 120),
          waitlistId: limpo(candidato.id, 80),
          eventType: EVENTO_VAGA,
        })],
      );
      if (Number(resultado.rowCount || 0) > 0) {
        queued += 1;
        queuedIds.push(candidato.id);
      }
    }
    return { queued, queuedIds, skipped: false };
  });
}

async function processWaitlistTask(task, payload, legacyEmpresaId) {
  const entrada = (legacyDb().barbeariaCaptacao?.[legacyEmpresaId]?.listaEspera || {})[limpo(payload.waitlistId, 80)];
  if (!entrada || entrada.status !== 'aguardando' || entrada.consentimentoWhatsapp !== true) return { skipped: true, reason: 'waitlist_not_eligible' };
  const liberado = barbearia.listarAgendamentos(legacyEmpresaId, {}).find((item) => item.id === limpo(payload.appointmentId, 120));
  if (!liberado || !['cancelado', 'nao_compareceu'].includes(String(liberado.status))) return { skipped: true, reason: 'slot_not_free' };
  if (new Date(liberado.dataHora).valueOf() <= Date.now()) return { skipped: true, reason: 'slot_in_past' };
  // A vaga precisa caber no serviço que a pessoa pediu (duração, jornada, outros
  // agendamentos que entraram depois): confere na agenda real antes de avisar.
  let livre = false;
  try {
    livre = barbearia.listarHorariosDisponiveis(legacyEmpresaId, {
      data: liberado.dataAgenda,
      servicoId: entrada.servicoId,
      profissionalId: liberado.profissionalId || 'qualquer',
      lojaId: liberado.lojaId,
    }).some((item) => item.horario === liberado.horaLocal && item.disponivel);
  } catch (_) {
    livre = false;
  }
  if (!livre) return { skipped: true, reason: 'slot_taken' };
  const telefone = normalizarTelefone(entrada.telefone);
  if (!telefone) return { skipped: true, reason: 'phone_unavailable' };
  const channelResult = await db.query(
    `SELECT id,empresa_id,loja_id,nome,api_base_url,configuracao FROM canais_integracao
      WHERE id=$1 AND empresa_id=$2 AND loja_id=$3 AND provedor='whatsapp' AND status='ativo' LIMIT 1`,
    [task.canal_id, task.empresa_id, task.loja_id],
  );
  const canal = channelResult.rows[0];
  if (!canal) return { skipped: true, reason: 'whatsapp_channel_inactive' };
  const nome = limpo(barbearia.obterConfiguracao(legacyEmpresaId).nomePublico || 'barbearia', 120);
  const [ano, mes, dia] = String(liberado.dataAgenda || '').split('-');
  const texto = `Olá, ${limpo(entrada.nome, 80).split(' ')[0]}! Abriu um horário na ${nome} em ${dia}/${mes}/${ano} às ${limpo(liberado.horaLocal, 5)}, como você pediu na lista de espera. Responda por aqui para reservar. Para não receber estes avisos, responda SAIR.`;
  await db.query(
    `UPDATE tarefas_integracao_canais SET delivery_started_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando' AND lease_token = $2::uuid`,
    [task.id, task.lease_token],
  );
  const resultado = await enviarMensagem({
    whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
    whatsapp_api_key: process.env.EVOLUTION_API_KEY,
    whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
    empresa_id: task.empresa_id, loja_id: task.loja_id, canal_id: task.canal_id,
  }, telefone, texto);
  if (!resultado?.ok) {
    const unknown = resultado?.uncertain === true;
    if (!unknown) await db.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = NULL WHERE id = $1`, [task.id]);
    throw appointmentDeliveryError(unknown ? 'resultado do aviso incerto' : 'provedor recusou o aviso de vaga', unknown ? 'APPOINTMENT_DELIVERY_UNKNOWN' : 'APPOINTMENT_SEND_FAILED', !unknown && resultado?.retryable === true);
  }
  const providerMessageId = limpo(resultado?.data?.key?.id || resultado?.data?.id, 200) || null;
  await db.query(`UPDATE tarefas_integracao_canais SET provider_message_id = $2 WHERE id = $1`, [task.id, providerMessageId]);
  return { sent: true, appointmentId: liberado.id, eventType: EVENTO_VAGA, waitlistId: entrada.id, providerMessageId };
}

/** Cancela lembretes/avisos pendentes de um agendamento (remarcado ou cancelado pela conversa). */
export async function cancelPendingAppointmentNotifications(contexto = {}, agendamentoId = '') {
  const empresaId = uuidOuVazio(contexto.empresaId);
  const lojaId = uuidOuVazio(contexto.lojaId);
  const legacyEmpresaId = limpo(contexto.legacyEmpresaId || contexto.empresaId, 120);
  if (!empresaId || !lojaId || !agendamentoId) return { cancelled: 0, skipped: true };
  const resultado = await db.query(
    `UPDATE tarefas_integracao_canais
        SET status='cancelada',proxima_tentativa_em=NULL,data_atualizacao=CURRENT_TIMESTAMP
      WHERE empresa_id=$1 AND loja_id=$2 AND tipo='notificar_agendamento'
        AND payload->>'legacyEmpresaId'=$3 AND payload->>'appointmentId'=$4
        AND payload->>'eventType' IN ('criado','remarcado','lembrete') AND status IN ('pendente','falha')`,
    [empresaId, lojaId, legacyEmpresaId, limpo(agendamentoId, 120)],
  );
  return { cancelled: Number(resultado.rowCount || 0), skipped: false };
}

/** Enfileira o "como foi o atendimento?" com o link de avaliação, só com consentimento. */
export async function queueReviewRequest(contexto = {}, agendamento = {}) {
  const empresaId = uuidOuVazio(contexto.empresaId);
  const lojaId = uuidOuVazio(contexto.lojaId || agendamento.lojaId);
  const legacyEmpresaId = limpo(contexto.legacyEmpresaId || contexto.empresaId, 120);
  if (!empresaId || !lojaId) return { queued: 0, skipped: true, reason: 'commerce_scope_unavailable' };
  if (legacyEmpresaId !== empresaId) return { queued: 0, skipped: true, reason: 'tenant_scope_mismatch' };
  if (!agendamento?.lojaId || String(agendamento.lojaId) !== lojaId) return { queued: 0, skipped: true, reason: 'store_scope_mismatch' };
  if (!agendamento?.id || String(agendamento.status) !== 'concluido') return { queued: 0, skipped: true, reason: 'appointment_not_concluded' };
  const inicio = dataValida(agendamento.dataHora);
  if (!inicio || inicio.valueOf() > Date.now() + 5 * 60000 || Date.now() - inicio.valueOf() > 30 * 86400000) {
    return { queued: 0, skipped: true, reason: 'review_outside_window' };
  }
  if (!linkAvaliacao(legacyEmpresaId, agendamento)) return { queued: 0, skipped: true, reason: 'review_link_unavailable' };
  if (jaAvaliado(legacyEmpresaId, agendamento.id)) return { queued: 0, skipped: true, reason: 'already_reviewed' };
  const elegibilidade = clienteElegivel(legacyEmpresaId, agendamento);
  if (!elegibilidade.eligible) return { queued: 0, skipped: true, reason: elegibilidade.reason };
  if (!telefoneDaPesquisaConfere(agendamento, elegibilidade.telefone)) return { queued: 0, skipped: true, reason: 'appointment_phone_mismatch' };
  const minutos = Number(legacyDb().barbeariaCaptacao?.[legacyEmpresaId]?.configuracao?.pedirAvaliacaoAposMinutos ?? 0);
  const executarEm = new Date(Date.now() + Math.max(0, Math.min(2880, Number.isFinite(minutos) ? minutos : 0)) * 60000);
  return db.transaction(async (trx) => {
    const canal = await canalAtivo(trx, empresaId, lojaId);
    if (!canal) return { queued: 0, skipped: true, reason: 'whatsapp_channel_inactive' };
    const resultado = await trx.query(
      `INSERT INTO tarefas_integracao_canais
         (empresa_id,loja_id,canal_id,tipo,referencia_externa,payload,status,proxima_tentativa_em)
       VALUES ($1,$2,$3,'notificar_agendamento',$4,$5::jsonb,'pendente',$6)
       ON CONFLICT (empresa_id,tipo,referencia_externa) WHERE tipo='notificar_agendamento' DO NOTHING
       RETURNING id`,
      [empresaId, lojaId, canal.id, `${limpo(agendamento.id, 100)}:${EVENTO_AVALIACAO}`, JSON.stringify({
        version: 'barbershop-appointment-v1', legacyEmpresaId, appointmentId: limpo(agendamento.id, 120), customerId: limpo(agendamento.clienteId, 120), eventType: EVENTO_AVALIACAO,
      }), executarEm],
    );
    return { queued: Number(resultado.rowCount || 0), skipped: false, executarEm: executarEm.toISOString() };
  });
}

async function processReviewTask(task, payload, legacyEmpresaId) {
  if (legacyEmpresaId !== String(task.empresa_id || '')) return { skipped: true, reason: 'tenant_scope_mismatch' };
  const agendamento = barbearia.listarAgendamentos(legacyEmpresaId, {}).find((item) => item.id === limpo(payload.appointmentId, 120));
  if (!agendamento || String(agendamento.status) !== 'concluido') return { skipped: true, reason: 'appointment_not_concluded' };
  if (String(agendamento.lojaId || '') !== String(task.loja_id || '')) return { skipped: true, reason: 'store_scope_mismatch' };
  if (String(agendamento.clienteId || '') !== String(payload.customerId || '')) return { skipped: true, reason: 'customer_changed' };
  const inicio = dataValida(agendamento.dataHora);
  if (!inicio || inicio.valueOf() > Date.now() + 5 * 60000 || Date.now() - inicio.valueOf() > 30 * 86400000) return { skipped: true, reason: 'review_outside_window' };
  if (jaAvaliado(legacyEmpresaId, agendamento.id)) return { skipped: true, reason: 'already_reviewed' };
  const link = linkAvaliacao(legacyEmpresaId, agendamento);
  if (!link) return { skipped: true, reason: 'review_link_unavailable' };
  const elegibilidade = clienteElegivel(legacyEmpresaId, agendamento);
  if (!elegibilidade.eligible) return { skipped: true, reason: elegibilidade.reason };
  if (!telefoneDaPesquisaConfere(agendamento, elegibilidade.telefone)) return { skipped: true, reason: 'appointment_phone_mismatch' };
  const channelResult = await db.query(
    `SELECT id,empresa_id,loja_id,nome,api_base_url,configuracao FROM canais_integracao
      WHERE id=$1 AND empresa_id=$2 AND loja_id=$3 AND provedor='whatsapp' AND status='ativo' LIMIT 1`,
    [task.canal_id, task.empresa_id, task.loja_id],
  );
  const canal = channelResult.rows[0];
  if (!canal) return { skipped: true, reason: 'whatsapp_channel_inactive' };
  const nome = limpo(barbearia.obterConfiguracao(legacyEmpresaId).nomePublico || 'barbearia', 120);
  const codigo = limpo(agendamento.codigoConfirmacao, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const texto = `Olá, ${limpo(elegibilidade.cliente.nome, 80).split(' ')[0]}! Obrigado pela visita à ${nome}. Como foi seu atendimento? Leva 10 segundos: ${link} — código: ${codigo} (use o telefone da reserva). Para não receber estes avisos, responda SAIR.`;
  await db.query(
    `UPDATE tarefas_integracao_canais SET delivery_started_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando' AND lease_token = $2::uuid`,
    [task.id, task.lease_token],
  );
  const resultado = await enviarMensagem({
    whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
    whatsapp_api_key: process.env.EVOLUTION_API_KEY,
    whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
    empresa_id: task.empresa_id, loja_id: task.loja_id, canal_id: task.canal_id,
  }, elegibilidade.telefone, texto);
  if (!resultado?.ok) {
    const unknown = resultado?.uncertain === true;
    if (!unknown) await db.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = NULL WHERE id = $1`, [task.id]);
    throw appointmentDeliveryError(unknown ? 'resultado do pedido de avaliação incerto' : 'provedor recusou o pedido de avaliação', unknown ? 'APPOINTMENT_DELIVERY_UNKNOWN' : 'APPOINTMENT_SEND_FAILED', !unknown && resultado?.retryable === true);
  }
  const providerMessageId = limpo(resultado?.data?.key?.id || resultado?.data?.id, 200) || null;
  await db.query(`UPDATE tarefas_integracao_canais SET provider_message_id = $2 WHERE id = $1`, [task.id, providerMessageId]);
  return { sent: true, appointmentId: agendamento.id, eventType: EVENTO_AVALIACAO, providerMessageId };
}

function clienteComConsentimento(legacyEmpresaId, clienteId) {
  if (!clienteId) return { eligible: false, reason: 'customer_not_registered' };
  return clienteElegivel(legacyEmpresaId, { clienteId });
}

/** Enfileira o envio da cobrança do clube pelo WhatsApp (mensagem de serviço, com consentimento). */
export async function queueChargeNotification(contexto = {}, cobranca = {}) {
  const empresaId = uuidOuVazio(contexto.empresaId);
  const lojaId = uuidOuVazio(contexto.lojaId);
  const legacyEmpresaId = limpo(contexto.legacyEmpresaId || contexto.empresaId, 120);
  if (!empresaId || !lojaId) return { queued: 0, skipped: true, reason: 'commerce_scope_unavailable' };
  if (!cobranca?.id || cobranca.status !== 'pendente') return { queued: 0, skipped: true, reason: 'charge_not_pending' };
  const elegibilidade = clienteComConsentimento(legacyEmpresaId, cobranca.clienteId);
  if (!elegibilidade.eligible) return { queued: 0, skipped: true, reason: elegibilidade.reason };
  return db.transaction(async (trx) => {
    const canal = await canalAtivo(trx, empresaId, lojaId);
    if (!canal) return { queued: 0, skipped: true, reason: 'whatsapp_channel_inactive' };
    const resultado = await trx.query(
      `INSERT INTO tarefas_integracao_canais
         (empresa_id,loja_id,canal_id,tipo,referencia_externa,payload,status,proxima_tentativa_em)
       VALUES ($1,$2,$3,'notificar_agendamento',$4,$5::jsonb,'pendente',CURRENT_TIMESTAMP)
       ON CONFLICT (empresa_id,tipo,referencia_externa) WHERE tipo='notificar_agendamento' DO NOTHING
       RETURNING id`,
      [empresaId, lojaId, canal.id, `${limpo(cobranca.id, 100)}:${EVENTO_COBRANCA}`, JSON.stringify({
        version: 'barbershop-appointment-v1', legacyEmpresaId, appointmentId: limpo(cobranca.id, 120), chargeId: limpo(cobranca.id, 120), customerId: limpo(cobranca.clienteId, 120), eventType: EVENTO_COBRANCA,
      })],
    );
    return { queued: Number(resultado.rowCount || 0), skipped: false };
  });
}

async function processChargeTask(task, payload, legacyEmpresaId) {
  const cobranca = legacyDb().barbeariaCobranca?.[legacyEmpresaId]?.cobrancas?.[limpo(payload.chargeId, 120)];
  if (!cobranca || cobranca.status !== 'pendente') return { skipped: true, reason: 'charge_not_pending' };
  const elegibilidade = clienteComConsentimento(legacyEmpresaId, cobranca.clienteId);
  if (!elegibilidade.eligible) return { skipped: true, reason: elegibilidade.reason };
  const channelResult = await db.query(
    `SELECT id,empresa_id,loja_id,nome,api_base_url,configuracao FROM canais_integracao
      WHERE id=$1 AND empresa_id=$2 AND loja_id=$3 AND provedor='whatsapp' AND status='ativo' LIMIT 1`,
    [task.canal_id, task.empresa_id, task.loja_id],
  );
  const canal = channelResult.rows[0];
  if (!canal) return { skipped: true, reason: 'whatsapp_channel_inactive' };
  const nome = limpo(barbearia.obterConfiguracao(legacyEmpresaId).nomePublico || 'barbearia', 120);
  const valor = `R$ ${Number(cobranca.valor).toFixed(2).replace('.', ',')}`;
  const comoPagar = cobranca.url
    ? `Para pagar (Pix ou cartão): ${cobranca.url}`
    : `Pix copia e cola:\n${cobranca.pixCopiaECola}\nDepois de pagar, é só responder esta mensagem com o comprovante.`;
  const texto = `Olá, ${limpo(elegibilidade.cliente.nome, 80).split(' ')[0]}! A mensalidade do seu clube na ${nome} (${valor}) vence em breve. ${comoPagar}\nPara não receber estes avisos, responda SAIR.`;
  await db.query(
    `UPDATE tarefas_integracao_canais SET delivery_started_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando' AND lease_token = $2::uuid`,
    [task.id, task.lease_token],
  );
  const resultado = await enviarMensagem({
    whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
    whatsapp_api_key: process.env.EVOLUTION_API_KEY,
    whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
    empresa_id: task.empresa_id, loja_id: task.loja_id, canal_id: task.canal_id,
  }, elegibilidade.telefone, texto);
  if (!resultado?.ok) {
    const unknown = resultado?.uncertain === true;
    if (!unknown) await db.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = NULL WHERE id = $1`, [task.id]);
    throw appointmentDeliveryError(unknown ? 'resultado do aviso de cobrança incerto' : 'provedor recusou o aviso de cobrança', unknown ? 'APPOINTMENT_DELIVERY_UNKNOWN' : 'APPOINTMENT_SEND_FAILED', !unknown && resultado?.retryable === true);
  }
  const providerMessageId = limpo(resultado?.data?.key?.id || resultado?.data?.id, 200) || null;
  await db.query(`UPDATE tarefas_integracao_canais SET provider_message_id = $2 WHERE id = $1`, [task.id, providerMessageId]);
  return { sent: true, chargeId: cobranca.id, eventType: EVENTO_COBRANCA, providerMessageId };
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

export function mensagem(snapshot, agendamento, cliente, evento, persona = null) {
  const servico = snapshot.servicos.find((item) => item.id === agendamento.servicoId)?.nome || 'atendimento';
  const profissional = snapshot.profissionais.find((item) => item.id === agendamento.profissionalId)?.nome || 'profissional da equipe';
  if (persona) {
    // Mesma informação e os mesmos comandos (CONFIRMO, REMARCAR, CANCELO, SAIR), na voz curta da persona.
    return personaAppointmentMessage(persona, {
      evento, nome: cliente.nome, servico, profissional,
      quando: quandoCurto(agendamento), quandoRelativo: quandoRelativo(agendamento),
      loja: snapshot.configuracao?.nomePublico,
    });
  }
  const quando = formatarQuando(agendamento);
  const cabecalho = `Olá, ${limpo(cliente.nome, 80)}.`;
  const rodape = 'Esta é uma mensagem de atendimento. Para não receber estes avisos, responda SAIR.';
  if (evento === 'cancelado') return `${cabecalho} Seu agendamento na ${limpo(snapshot.configuracao.nomePublico || 'barbearia', 120)} foi cancelado. Se precisar, entre em contato para escolher outro horário. ${rodape}`;
  if (evento === 'remarcado') return `${cabecalho} Seu agendamento foi remarcado para ${quando}. Serviço: ${servico}. Profissional: ${profissional}. ${rodape}`;
  if (evento === 'lembrete') return `${cabecalho} Lembrete do seu agendamento ${quandoRelativo(agendamento)}, ${quando}. Serviço: ${servico}. Profissional: ${profissional}. Responda CONFIRMO, REMARCAR ou CANCELO. ${rodape}`;
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
  if (legacyEmpresaId && appointmentId && evento === EVENTO_VAGA) return processWaitlistTask(task, payload, legacyEmpresaId);
  if (legacyEmpresaId && appointmentId && evento === EVENTO_AVALIACAO) return processReviewTask(task, payload, legacyEmpresaId);
  if (legacyEmpresaId && payload.chargeId && evento === EVENTO_COBRANCA) return processChargeTask(task, payload, legacyEmpresaId);
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
    empresa_id: task.empresa_id, loja_id: task.loja_id, canal_id: task.canal_id,
  }, elegibilidade.telefone, mensagem(snapshot, agendamento, elegibilidade.cliente, evento, resolvePersona(canal.configuracao)));
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
  // Lista de espera: o SAIR também vale para os avisos de vaga.
  const raizCaptacao = legacyDb().barbeariaCaptacao?.[empresaId]?.listaEspera || {};
  const esperaIds = [];
  for (const item of Object.values(raizCaptacao)) {
    if (phoneMatchKey(item.telefone) === phoneMatchKey(telefone) && item.consentimentoWhatsapp === true) {
      item.consentimentoWhatsapp = false;
      item.atualizadoEm = new Date().toISOString();
      esperaIds.push(String(item.id));
    }
  }
  if (esperaIds.length) {
    legacySave();
    await db.query(
      `UPDATE tarefas_integracao_canais SET status='cancelada',proxima_tentativa_em=NULL,data_atualizacao=CURRENT_TIMESTAMP
        WHERE empresa_id=$1 AND loja_id=$2 AND tipo='notificar_agendamento'
          AND payload->>'eventType'='vaga' AND payload->>'waitlistId'=ANY($3::text[]) AND status IN ('pendente','falha')`,
      [empresaId, lojaId, esperaIds],
    );
  }
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
  return { optedOut: clientesEmpresa.length > 0 || esperaIds.length > 0, customers: clientesEmpresa.length, waitlist: esperaIds.length };
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

/** Aceite da API do provedor não comprova entrega/leitura no aparelho do cliente. */
export async function reviewNotificationMetrics(contexto = {}) {
  const empresaId = uuidOuVazio(contexto.empresaId);
  const lojaId = uuidOuVazio(contexto.lojaId);
  if (!empresaId) return null;
  if (contexto.lojaId && !lojaId) return null;
  const resultado = await db.query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('pendente','processando'))::int AS pendentes,
            COUNT(*) FILTER (WHERE status='concluida' AND COALESCE((resposta->>'sent')::boolean,false))::int AS aceitas_provedor,
            COUNT(*) FILTER (WHERE status='falha')::int AS falhas,
            COUNT(*) FILTER (WHERE status='cancelada')::int AS canceladas
       FROM tarefas_integracao_canais
      WHERE empresa_id=$1 AND ($2::uuid IS NULL OR loja_id=$2::uuid)
        AND tipo='notificar_agendamento' AND payload->>'eventType'='avaliacao'`,
    [empresaId, lojaId || null],
  );
  const canais = await db.query(
    `SELECT COUNT(*)::int AS ativos FROM canais_integracao
      WHERE empresa_id=$1 AND ($2::uuid IS NULL OR loja_id=$2::uuid)
        AND provedor='whatsapp' AND status='ativo'`,
    [empresaId, lojaId || null],
  );
  return { ...(resultado.rows[0] || { pendentes: 0, aceitas_provedor: 0, falhas: 0, canceladas: 0 }), canaisAtivos: Number(canais.rows[0]?.ativos || 0) };
}
