// ============================================================================
// RESUMO DIÁRIO DO DINO NO WHATSAPP
//
// Todo dia, no horário escolhido (padrão 21:00 de Cuiabá), o dono recebe no
// WhatsApp o fechamento do dia: atendimentos, faturamento, o que a IA fechou
// sozinha, conversas que ainda esperam a equipe e como está a agenda de amanhã.
//
// Fontes (nada inventado):
//   - agenda da barbearia (mesmo store do ERP): atendimentos do dia, concluídos,
//     faltas, cancelados, valor atendido, agendamentos criados pela IA hoje
//     (origem 'whatsapp_ia') e a agenda de amanhã;
//   - PostgreSQL do atendente: conversas atendidas hoje, ações concluídas pela IA
//     (agendamento, remarcação, cancelamento, pedido) e a fila da equipe.
//   Se o PostgreSQL estiver fora, o resumo sai só com a agenda (nunca deixa de sair).
//
// Envio idempotente: a tabela dino_resumo_diario_envios (migration 062) guarda
// (empresa, dia). Reinício do servidor ou dois processos não mandam duas vezes.
// Falha de envio é tentada de novo até 3 vezes no mesmo dia.
//
// Variáveis:
//   DINO_RESUMO_DIARIO=on            liga o envio automático (padrão: desligado)
//   DINO_RESUMO_TELEFONES=5565…      quem recebe (vírgula para mais de um)
//   DINO_RESUMO_HORA=21:00           horário de Cuiabá
//   DINO_RESUMO_EMPRESA_ID           empresa (padrão: CHATBOT_BACKEND_EMPRESA_ID)
//   DINO_RESUMO_LOJA_ID              loja (padrão: a loja do canal WhatsApp ativo)
// ============================================================================

import { db } from './database.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import { enviarMensagem } from './whatsapp.js';
import { motivoLegivel } from './whatsapp-handoff-labels.js';

export { motivoLegivel };

const TZ = () => process.env.KYTTO_TIMEZONE || 'America/Cuiaba';
const MAX_TENTATIVAS = 3;

export function diaLocal(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function horaLocal(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ(), hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
}

function proximoDia(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1, 12)).toISOString().slice(0, 10);
}

function dinheiro(valor) {
  return Math.round(Number(valor || 0) * 100) / 100;
}

function brl(valor) {
  return `R$ ${dinheiro(valor).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function valorDoAtendimento(item) {
  return dinheiro(Math.max(Number(item.valor || 0), Number(item.valorRecebido || 0)));
}

function horaDoAgendamento(item) {
  if (/^\d{2}:\d{2}$/.test(String(item.horaLocal || ''))) return item.horaLocal;
  const ms = Date.parse(item.dataHora);
  return Number.isFinite(ms) ? horaLocal(ms) : '';
}

/** Números da agenda (store da barbearia). Puro e síncrono. */
export function numerosDaAgenda(empresaId, { dia, lojaId = '' } = {}) {
  const amanha = proximoDia(dia);
  const todos = barbearia.listarAgendamentos(empresaId, {})
    .filter((item) => !lojaId || !item.lojaId || item.lojaId === lojaId);
  const doDia = todos.filter((item) => (item.dataAgenda || String(item.dataHora).slice(0, 10)) === dia);
  const concluidos = doDia.filter((item) => item.status === 'concluido');
  const ia = todos.filter((item) => item.origem === 'whatsapp_ia' && item.criadoEm && diaLocal(Date.parse(item.criadoEm)) === dia && item.status !== 'cancelado');
  const deAmanha = todos
    .filter((item) => (item.dataAgenda || String(item.dataHora).slice(0, 10)) === amanha && !['cancelado', 'nao_compareceu'].includes(item.status))
    .sort((a, b) => String(horaDoAgendamento(a)).localeCompare(String(horaDoAgendamento(b))));
  return {
    dia,
    atendimentos: doDia.filter((item) => item.status !== 'cancelado').length,
    concluidos: concluidos.length,
    faltas: doDia.filter((item) => item.status === 'nao_compareceu').length,
    cancelados: doDia.filter((item) => item.status === 'cancelado').length,
    faturamento: dinheiro(concluidos.reduce((soma, item) => soma + valorDoAtendimento(item), 0)),
    ia: { agendamentos: ia.length, valorPrevisto: dinheiro(ia.reduce((soma, item) => soma + Number(item.valor || 0), 0)) },
    amanha: { dia: amanha, agendamentos: deAmanha.length, primeiro: deAmanha[0] ? horaDoAgendamento(deAmanha[0]) : '' },
  };
}

/** Números do atendente (PostgreSQL). Nunca lança: devolve null se indisponível. */
export async function numerosDoAtendente({ empresaId, lojaId, dia }, executor = db) {
  if (!/^[0-9a-f-]{36}$/i.test(String(empresaId || '')) || !/^[0-9a-f-]{36}$/i.test(String(lojaId || ''))) return null;
  try {
    const tz = TZ();
    const conversas = await executor.queryRead(
      `SELECT COUNT(*)::int AS total
         FROM whatsapp_ai_sessions
        WHERE empresa_id = $1 AND loja_id = $2
          AND (ultima_interacao_em AT TIME ZONE $4)::date = $3::date`,
      [empresaId, lojaId, dia, tz],
    );
    const acoes = await executor.queryRead(
      `SELECT tipo, COUNT(*)::int AS total,
              COALESCE(SUM(NULLIF(COALESCE(resposta->>'total', resposta->'order'->>'total', resposta->'pedido'->>'total'), '')::numeric), 0) AS valor
         FROM whatsapp_ai_actions
        WHERE empresa_id = $1 AND loja_id = $2 AND status = 'concluida'
          AND (concluido_em AT TIME ZONE $4)::date = $3::date
        GROUP BY tipo`,
      [empresaId, lojaId, dia, tz],
    );
    const fila = await executor.queryRead(
      `SELECT handoff_reason, COUNT(*)::int AS total
         FROM whatsapp_ai_sessions
        WHERE empresa_id = $1 AND loja_id = $2 AND status = 'humano'
        GROUP BY handoff_reason`,
      [empresaId, lojaId],
    );
    const porTipo = Object.fromEntries(acoes.rows.map((row) => [row.tipo, { total: Number(row.total || 0), valor: dinheiro(row.valor) }]));
    const filaPorMotivo = {};
    for (const row of fila.rows) {
      const rotulo = motivoLegivel(row.handoff_reason);
      filaPorMotivo[rotulo] = (filaPorMotivo[rotulo] || 0) + Number(row.total || 0);
    }
    return {
      conversas: Number(conversas.rows[0]?.total || 0),
      remarcacoes: porTipo.remarcacao?.total || 0,
      cancelamentos: porTipo.cancelamento?.total || 0,
      pedidos: porTipo.pedido?.total || 0,
      valorPedidos: porTipo.pedido?.valor || 0,
      filaEquipe: Object.values(filaPorMotivo).reduce((a, b) => a + b, 0),
      filaPorMotivo,
    };
  } catch (_) {
    return null;
  }
}

function dataCurta(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(a, m - 1, d, 12)));
  return `${semana} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Texto do WhatsApp (formatação nativa: *negrito*, sem tabela). */
export function textoDoResumo({ nomeLoja, agenda, atendente }) {
  const linhas = [`*Fechamento do dia · ${nomeLoja || 'Barbearia Dino'}*`, `${dataCurta(agenda.dia)}`, ''];
  linhas.push(`✂️ *${agenda.concluidos}* atendimento(s) concluído(s) de ${agenda.atendimentos} na agenda`);
  linhas.push(`💰 Valor atendido: *${brl(agenda.faturamento)}*`);
  if (agenda.faltas || agenda.cancelados) linhas.push(`⚠️ ${agenda.faltas} falta(s) · ${agenda.cancelados} cancelamento(s)`);
  linhas.push('');
  linhas.push('*Atendente IA no WhatsApp*');
  if (atendente) {
    linhas.push(`💬 ${atendente.conversas} conversa(s) atendida(s)`);
    linhas.push(`📅 ${agenda.ia.agendamentos} horário(s) marcado(s) sozinha${agenda.ia.valorPrevisto ? ` · ${brl(agenda.ia.valorPrevisto)} previstos` : ''}`);
    if (atendente.remarcacoes || atendente.cancelamentos) linhas.push(`🔁 ${atendente.remarcacoes} remarcação(ões) · ${atendente.cancelamentos} cancelamento(s)`);
    if (atendente.pedidos) linhas.push(`🛍️ ${atendente.pedidos} pedido(s) da loja${atendente.valorPedidos ? ` · ${brl(atendente.valorPedidos)}` : ''}`);
    if (atendente.filaEquipe) {
      const detalhe = Object.entries(atendente.filaPorMotivo).sort((a, b) => b[1] - a[1]).map(([motivo, n]) => `${n} ${motivo}`).join(', ');
      linhas.push(`🙋 *${atendente.filaEquipe}* conversa(s) com a equipe agora (${detalhe})`);
    } else {
      linhas.push('✅ Nenhuma conversa esperando a equipe');
    }
  } else {
    linhas.push(`📅 ${agenda.ia.agendamentos} horário(s) marcado(s) pela IA hoje`);
    linhas.push('(dados de conversas indisponíveis agora)');
  }
  linhas.push('');
  linhas.push(agenda.amanha.agendamentos
    ? `📆 Amanhã: *${agenda.amanha.agendamentos}* horário(s), o primeiro às ${agenda.amanha.primeiro}`
    : '📆 Amanhã: agenda ainda livre');
  return linhas.join('\n');
}

export async function montarResumoDiario({ empresaId, lojaId = '', dia = diaLocal(), nomeLoja } = {}, executor = db) {
  const agenda = numerosDaAgenda(empresaId, { dia, lojaId });
  const atendente = await numerosDoAtendente({ empresaId, lojaId, dia }, executor);
  let nome = nomeLoja;
  if (!nome) { try { nome = barbearia.obterConfiguracao(empresaId)?.nomePublico || ''; } catch (_) { nome = ''; } }
  return { agenda, atendente, texto: textoDoResumo({ nomeLoja: nome || 'Barbearia Dino', agenda, atendente }) };
}

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO E ENVIO
// ---------------------------------------------------------------------------

function telefonesDestino() {
  return String(process.env.DINO_RESUMO_TELEFONES || '')
    .split(',')
    .map((t) => t.replace(/\D/g, ''))
    .filter((t) => t.length >= 10 && t.length <= 13);
}

export function configuracaoResumo() {
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(process.env.DINO_RESUMO_HORA || '')) ? process.env.DINO_RESUMO_HORA : '21:00';
  const empresaId = String(process.env.DINO_RESUMO_EMPRESA_ID || process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim();
  return {
    ativo: String(process.env.DINO_RESUMO_DIARIO || '').trim().toLowerCase() === 'on',
    hora,
    empresaId,
    lojaId: String(process.env.DINO_RESUMO_LOJA_ID || '').trim(),
    telefones: telefonesDestino(),
  };
}

/** Configuração para o painel: telefones mascarados, nunca o número inteiro. */
export function configuracaoResumoPublica() {
  const cfg = configuracaoResumo();
  return { ativo: cfg.ativo, hora: cfg.hora, destinatarios: cfg.telefones.map((t) => `***${t.slice(-4)}`) };
}

/** Loja do canal WhatsApp ativo da empresa (usada quando a sessão está em "todas as lojas"). */
export async function lojaDoCanal(empresaId, executor = db) {
  if (!/^[0-9a-f-]{36}$/i.test(String(empresaId || ''))) return '';
  try {
    const r = await executor.queryRead(
      `SELECT loja_id FROM canais_integracao
        WHERE empresa_id = $1 AND provedor = 'whatsapp' AND status = 'ativo'
        ORDER BY data_atualizacao DESC NULLS LAST LIMIT 1`,
      [empresaId],
    );
    return r.rows[0]?.loja_id || '';
  } catch (_) { return ''; }
}

/** Envia o resumo para os telefones. Devolve { enviados, falhas }. */
export async function enviarResumo({ texto, telefones, instance, empresaId, lojaId, canalId }, enviar = enviarMensagem) {
  let enviados = 0;
  const falhas = [];
  for (const telefone of telefones) {
    const r = await enviar(instance ? { whatsapp_instance: instance, empresa_id: empresaId, loja_id: lojaId, canal_id: canalId } : {}, telefone, texto).catch((error) => ({ ok: false, error: String(error?.message || error) }));
    if (r?.ok) enviados += 1; else falhas.push(`***${telefone.slice(-4)}`);
  }
  return { enviados, falhas };
}

/**
 * Uma verificação do agendador: se já passou da hora e o dia ainda não foi
 * enviado (ou falhou com tentativas restantes), monta e envia. Idempotente.
 */
export async function tickResumoDiario({ agora = Date.now(), enviar = enviarMensagem, executor = db, forcar = false } = {}) {
  const cfg = configuracaoResumo();
  if (!forcar && !cfg.ativo) return { skipped: 'desligado' };
  if (!cfg.telefones.length) return { skipped: 'sem_destinatario' };
  if (!/^[0-9a-f-]{36}$/i.test(cfg.empresaId)) return { skipped: 'sem_empresa' };
  let instance = '';
  let canalId = '';
  let canalLojaId = '';
  if (String(process.env.WHATSAPP_PROVIDER || '').toLowerCase() === 'chatbot_backend' && String(process.env.CHATBOT_BACKEND_MODE || '').toLowerCase() === 'instancias') {
    if (cfg.empresaId !== String(process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim()) return { skipped: 'instance_scope_mismatch' };
    const expected = String(process.env.CHATBOT_BACKEND_INSTANCE || '').trim().toLowerCase();
    const canal = await executor.queryRead(`SELECT id, loja_id, configuracao->>'instance' AS instance FROM canais_integracao WHERE empresa_id=$1 AND provedor='whatsapp' AND status='ativo' ORDER BY data_atualizacao DESC LIMIT 1`, [cfg.empresaId]);
    instance = String(canal.rows[0]?.instance || '').toLowerCase();
    canalId = canal.rows[0]?.id || '';
    canalLojaId = canal.rows[0]?.loja_id || '';
    if (!instance || instance !== expected || !canalId || !canalLojaId || (cfg.lojaId && cfg.lojaId !== canalLojaId)) return { skipped: 'instance_scope_mismatch' };
  }
  if (!forcar && horaLocal(agora) < cfg.hora) return { skipped: 'antes_da_hora' };
  const dia = diaLocal(agora);
  const reserva = await executor.query(
    `INSERT INTO dino_resumo_diario_envios (empresa_id, dia, status, tentativas)
     VALUES ($1, $2::date, 'enviando', 1)
     ON CONFLICT (empresa_id, dia) DO UPDATE
       SET status = 'enviando', tentativas = dino_resumo_diario_envios.tentativas + 1, atualizado_em = CURRENT_TIMESTAMP
       WHERE dino_resumo_diario_envios.status = 'falha' AND dino_resumo_diario_envios.tentativas < $3
     RETURNING tentativas`,
    [cfg.empresaId, dia, MAX_TENTATIVAS],
  );
  if (!reserva.rows[0]) return { skipped: 'ja_enviado', dia };
  try {
    const lojaId = cfg.lojaId || canalLojaId || await lojaDoCanal(cfg.empresaId, executor);
    const resumo = await montarResumoDiario({ empresaId: cfg.empresaId, lojaId, dia }, executor);
    const resultado = await enviarResumo({ texto: resumo.texto, telefones: cfg.telefones, instance, empresaId: cfg.empresaId, lojaId, canalId }, enviar);
    const status = resultado.enviados > 0 ? 'enviado' : 'falha';
    await executor.query(
      `UPDATE dino_resumo_diario_envios
          SET status = $3::text, enviado_em = CASE WHEN $3::text = 'enviado' THEN CURRENT_TIMESTAMP ELSE enviado_em END,
              resumo = $4::jsonb, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND dia = $2::date`,
      [cfg.empresaId, dia, status, JSON.stringify({ agenda: resumo.agenda, atendente: resumo.atendente, enviados: resultado.enviados, falhas: resultado.falhas })],
    );
    return { dia, status, ...resultado };
  } catch (error) {
    await executor.query(
      `UPDATE dino_resumo_diario_envios SET status = 'falha', atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND dia = $2::date`,
      [cfg.empresaId, dia],
    ).catch(() => null);
    return { dia, status: 'falha', error: String(error?.message || error).slice(0, 200) };
  }
}

export function startResumoDiarioWorker() {
  const cfg = configuracaoResumo();
  if (!cfg.ativo) return null;
  if (!cfg.telefones.length || !/^[0-9a-f-]{36}$/i.test(cfg.empresaId)) {
    console.log('[Resumo diário] ligado, mas falta DINO_RESUMO_TELEFONES ou a empresa (DINO_RESUMO_EMPRESA_ID / CHATBOT_BACKEND_EMPRESA_ID)');
    return null;
  }
  const timer = setInterval(() => {
    tickResumoDiario()
      .then((r) => { if (r?.status) console.log(JSON.stringify({ worker: 'dino-resumo-diario', dia: r.dia, status: r.status, enviados: r.enviados || 0 })); })
      .catch((error) => console.warn('[Resumo diário]', String(error?.message || error).slice(0, 200)));
  }, 60 * 1000);
  timer.unref?.();
  console.log(`[Resumo diário] ativo: todo dia às ${cfg.hora} (${TZ()}) para ${cfg.telefones.length} destinatário(s)`);
  return timer;
}
