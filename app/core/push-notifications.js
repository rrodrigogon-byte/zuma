/**
 * Core: Push Notifications — SetPoint Ultra
 * Expo Push Notifications + alertas internos no banco
 * Documentação: https://docs.expo.dev/push-notifications/overview/
 */
import { getDb } from './db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Registrar token de push de um dispositivo
 */
export async function registrarTokenPush(tenantId, userId, expoPushToken, plataforma) {
  const db = getDb();
  await db.query(`
    INSERT INTO push_tokens (tenant_id, usuario_id, token, plataforma, ativo)
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (usuario_id, token) DO UPDATE SET ativo = true, atualizado_em = NOW()`,
    [tenantId, userId, expoPushToken, plataforma]
  );
  return { ok: true };
}

/**
 * Enviar push notification para um usuário específico
 */
export async function enviarPushParaUsuario(userId, titulo, corpo, dados = {}) {
  const db = getDb();
  const { rows: tokens } = await db.query(
    `SELECT token FROM push_tokens WHERE usuario_id = $1 AND ativo = true`,
    [userId]
  );
  if (tokens.length === 0) return { enviados: 0 };
  return enviarPushBatch(tokens.map(t => t.token), titulo, corpo, dados);
}

/**
 * Enviar push notification para todos os usuários de um tenant
 */
export async function enviarPushParaTenant(tenantId, titulo, corpo, dados = {}) {
  const db = getDb();
  const { rows: tokens } = await db.query(
    `SELECT pt.token FROM push_tokens pt
     JOIN usuarios u ON u.id = pt.usuario_id
     WHERE u.tenant_id = $1 AND pt.ativo = true`,
    [tenantId]
  );
  if (tokens.length === 0) return { enviados: 0 };
  return enviarPushBatch(tokens.map(t => t.token), titulo, corpo, dados);
}

/**
 * Envio em lote para múltiplos tokens (máx 100 por requisição)
 */
async function enviarPushBatch(tokens, titulo, corpo, dados = {}) {
  const mensagens = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: titulo,
    body: corpo,
    data: dados,
    badge: 1,
    priority: 'high',
    channelId: dados.canal || 'default',
  }));

  // Dividir em chunks de 100
  const chunks = [];
  for (let i = 0; i < mensagens.length; i += 100) chunks.push(mensagens.slice(i, i + 100));

  let totalEnviados = 0;
  for (const chunk of chunks) {
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
        body: JSON.stringify(chunk),
      });
      if (resp.ok) totalEnviados += chunk.length;
    } catch (e) {
      console.error('[Push] Erro ao enviar batch:', e.message);
    }
  }
  return { enviados: totalEnviados };
}

/**
 * Criar alerta interno no banco (visível no painel web e mobile)
 */
export async function criarAlertaInterno(tenantId, dados) {
  const db = getDb();
  const { tipo, titulo, mensagem, usuario_id, link, prioridade = 'normal' } = dados;
  const { rows: [alerta] } = await db.query(`
    INSERT INTO alertas_internos (tenant_id, usuario_id, tipo, titulo, mensagem, link, prioridade)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [tenantId, usuario_id || null, tipo, titulo, mensagem, link || null, prioridade]
  );
  return alerta;
}

/**
 * Disparar alerta de estoque baixo
 */
export async function alertarEstoqueBaixo(tenantId, produto) {
  const db = getDb();
  await criarAlertaInterno(tenantId, {
    tipo: 'estoque',
    titulo: `⚠️ Estoque crítico: ${produto.nome}`,
    mensagem: `Restam apenas ${produto.estoque_atual} unidades de "${produto.nome}". Mínimo configurado: ${produto.estoque_minimo}.`,
    link: `/admin/estoque?produto=${produto.id}`,
    prioridade: produto.estoque_atual === 0 ? 'alta' : 'normal',
  });
  // Push para admins do tenant
  const { rows: admins } = await db.query(
    `SELECT id FROM usuarios WHERE tenant_id = $1 AND perfil IN ('admin', 'gerente')`, [tenantId]
  );
  for (const admin of admins) {
    await enviarPushParaUsuario(admin.id,
      `📦 Estoque crítico`,
      `${produto.nome}: ${produto.estoque_atual} unidades restantes`,
      { tipo: 'estoque', produto_id: produto.id, canal: 'estoque' }
    );
  }
}

/**
 * Disparar alerta de lote vencendo
 */
export async function alertarLoteVencendo(tenantId, lote) {
  const diasRestantes = Math.ceil((new Date(lote.validade) - new Date()) / (1000 * 60 * 60 * 24));
  await criarAlertaInterno(tenantId, {
    tipo: 'vencimento',
    titulo: `🗓️ Lote vencendo em ${diasRestantes} dias`,
    mensagem: `Lote ${lote.codigo} de "${lote.produto_nome}" vence em ${new Date(lote.validade).toLocaleDateString('pt-BR')}. Quantidade: ${lote.quantidade}.`,
    link: `/admin/supermercado?aba=lotes`,
    prioridade: diasRestantes <= 3 ? 'alta' : 'normal',
  });
}

/**
 * Disparar alerta de parcela de crediário vencendo
 */
export async function alertarParcelaVencendo(tenantId, parcela) {
  await criarAlertaInterno(tenantId, {
    tipo: 'crediario',
    titulo: `💳 Parcela vencendo: ${parcela.cliente_nome}`,
    mensagem: `Parcela ${parcela.numero}/${parcela.total_parcelas} de ${parcela.cliente_nome} vence em ${new Date(parcela.vencimento).toLocaleDateString('pt-BR')} — ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcela.valor)}.`,
    link: `/admin/crediario?conta=${parcela.conta_id}`,
    prioridade: 'normal',
  });
}

/**
 * Disparar alerta de novo agendamento
 */
export async function alertarNovoAgendamento(tenantId, agendamento) {
  const db = getDb();
  // Notificar o profissional responsável
  if (agendamento.profissional_usuario_id) {
    await enviarPushParaUsuario(
      agendamento.profissional_usuario_id,
      `📅 Novo agendamento`,
      `${agendamento.cliente_nome} agendou ${agendamento.servico_nome} para ${agendamento.hora}`,
      { tipo: 'agendamento', agendamento_id: agendamento.id, canal: 'agendamentos' }
    );
  }
  await criarAlertaInterno(tenantId, {
    tipo: 'agendamento',
    titulo: `📅 Novo agendamento: ${agendamento.cliente_nome}`,
    mensagem: `${agendamento.servico_nome} com ${agendamento.profissional_nome} às ${agendamento.hora} do dia ${new Date(agendamento.data).toLocaleDateString('pt-BR')}.`,
    link: `/admin/barbearia-erp`,
  });
}

/**
 * Job: verificar e disparar alertas automáticos (executar via cron a cada hora)
 */
export async function verificarAlertasAutomaticos(tenantId) {
  const db = getDb();
  const alertasDisparados = [];

  // 1. Estoque baixo
  const { rows: estoqueBaixo } = await db.query(`
    SELECT p.id, p.nome, p.estoque_atual, p.estoque_minimo
    FROM produtos p
    WHERE p.tenant_id = $1 AND p.estoque_atual <= p.estoque_minimo AND p.estoque_minimo > 0
      AND NOT EXISTS (
        SELECT 1 FROM alertas_internos a
        WHERE a.tenant_id = $1 AND a.tipo = 'estoque'
          AND a.link LIKE '%produto=' || p.id::text
          AND a.criado_em > NOW() - INTERVAL '12 hours'
      )`, [tenantId]
  );
  for (const p of estoqueBaixo) {
    await alertarEstoqueBaixo(tenantId, p);
    alertasDisparados.push({ tipo: 'estoque', produto: p.nome });
  }

  // 2. Lotes vencendo em até 7 dias
  const { rows: lotesVencendo } = await db.query(`
    SELECT l.id, l.codigo, l.validade, l.quantidade, p.nome as produto_nome
    FROM lotes_produtos l
    JOIN produtos p ON p.id = l.produto_id
    WHERE l.tenant_id = $1 AND l.validade BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      AND l.quantidade > 0
      AND NOT EXISTS (
        SELECT 1 FROM alertas_internos a
        WHERE a.tenant_id = $1 AND a.tipo = 'vencimento'
          AND a.criado_em > NOW() - INTERVAL '24 hours'
      )`, [tenantId]
  );
  for (const l of lotesVencendo) {
    await alertarLoteVencendo(tenantId, l);
    alertasDisparados.push({ tipo: 'vencimento', lote: l.codigo });
  }

  // 3. Parcelas vencendo em 2 dias
  const { rows: parcelasVencendo } = await db.query(`
    SELECT p.id, p.numero, p.vencimento, p.valor, p.conta_id, c.total_parcelas,
      cl.nome as cliente_nome
    FROM parcelas_crediario p
    JOIN contas_crediario c ON c.id = p.conta_id
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE c.tenant_id = $1 AND p.status = 'aberta'
      AND p.vencimento BETWEEN NOW() AND NOW() + INTERVAL '2 days'
      AND NOT EXISTS (
        SELECT 1 FROM alertas_internos a
        WHERE a.tenant_id = $1 AND a.tipo = 'crediario'
          AND a.link LIKE '%conta=' || p.conta_id::text
          AND a.criado_em > NOW() - INTERVAL '24 hours'
      )`, [tenantId]
  );
  for (const p of parcelasVencendo) {
    await alertarParcelaVencendo(tenantId, p);
    alertasDisparados.push({ tipo: 'crediario', cliente: p.cliente_nome });
  }

  return { alertas_disparados: alertasDisparados.length, detalhes: alertasDisparados };
}
