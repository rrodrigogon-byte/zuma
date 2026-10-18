/**
 * Tradutor do protocolo Control iD (modo Pro + Push) para o motor de regras do Kytto.
 * Item 1.2 da especificação. Referências:
 *  - https://www.controlid.com.br/docs/access-api-pt/modos-de-operacao/eventos-de-identificacao-online/
 *  - https://www.controlid.com.br/docs/access-api-pt/modo-push/introducao-ao-push/
 *
 * Este arquivo não conhece Express nem banco: recebe dependências por parâmetro
 * (carregarContexto, registrarEvento, fila) para poder ser testado e reaproveitado.
 */

import { decidirAcesso, validadeOffline } from './regras.js';

// Códigos de "event" da resposta (tabela "Mensagem de Retorno" da Control iD)
export const EVENTO = Object.freeze({
  EQUIPAMENTO_INVALIDO: 1,
  PARAMETROS_INVALIDOS: 2,
  NAO_IDENTIFICADO: 3,
  ACESSO_NEGADO: 6,
  ACESSO_CONCEDIDO: 7,
});

const SENTIDOS = new Set(['clockwise', 'anticlockwise', 'both']);

/** O visor da catraca tem pouco espaço: corta sem quebrar palavra. */
export function mensagemVisor(texto, max = 48) {
  const t = String(texto || '').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  const ultimoEspaco = corte.lastIndexOf(' ');
  return `${(ultimoEspaco > 20 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`;
}

/** Aceita corpo x-www-form-urlencoded já parseado (strings) e normaliza tipos. */
export function lerIdentificacao(body = {}) {
  const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  return {
    deviceId: body.device_id != null ? String(body.device_id) : null,
    userId: num(body.user_id),
    evento: num(body.event),
    portalId: num(body.portal_id),
    time: num(body.time),
    uuid: body.uuid || null,
    cardValue: body.card_value || null,
    qrcodeValue: body.qrcode_value || null,
    duress: num(body.duress) === 1,
  };
}

export function respostaConcedida({ userId, nome, portalId, mensagem, sentido = 'clockwise', modelo = 'catraca' }) {
  if (!SENTIDOS.has(sentido)) throw new Error(`sentido inválido: ${sentido}`);
  const actions =
    modelo === 'catraca'
      ? [{ action: 'catra', parameters: `allow=${sentido}` }]
      : [{ action: 'door', parameters: 'door=1' }];
  return {
    result: {
      event: EVENTO.ACESSO_CONCEDIDO,
      user_id: userId,
      user_name: nome || '',
      user_image: false,
      portal_id: portalId ?? 1,
      actions,
      message: mensagemVisor(mensagem),
    },
  };
}

export function respostaNegada({ userId, nome, portalId, mensagem, evento = EVENTO.ACESSO_NEGADO }) {
  return {
    result: {
      event: evento,
      user_id: userId ?? 0,
      user_name: nome || '',
      user_image: false,
      portal_id: portalId ?? 1,
      actions: [],
      message: mensagemVisor(mensagem),
    },
  };
}

/**
 * Trata POST /new_user_identified.fcgi.
 *
 * deps.buscarDispositivo(deviceId) -> { id, empresaId, unidadeId, fuso, modelo, sentidoEntrada } | null
 * deps.carregarContexto({ empresaId, userIdEquipamento }) -> contexto do motor sem agora/unidade, ou null
 * deps.registrarEvento(evento) -> Promise (não pode derrubar a liberação se falhar)
 * deps.dispararAcao({ acao, pessoaId, empresaId, codigo }) -> Promise (WhatsApp, painel)
 * deps.agora() -> Date
 */
export async function tratarIdentificacao(body, deps) {
  const req = lerIdentificacao(body);
  const agora = deps.agora ? deps.agora() : new Date();

  if (!req.deviceId) {
    return respostaNegada({ mensagem: 'Equipamento inválido', evento: EVENTO.PARAMETROS_INVALIDOS });
  }
  const dispositivo = await deps.buscarDispositivo(req.deviceId);
  if (!dispositivo) {
    return respostaNegada({ mensagem: 'Equipamento não pareado', evento: EVENTO.EQUIPAMENTO_INVALIDO });
  }

  // Equipamento identificou localmente mas não reconheceu (event 3) ou sem usuário
  if (!req.userId || req.evento === EVENTO.NAO_IDENTIFICADO) {
    await registrarSemFalhar(deps, {
      dispositivoId: dispositivo.id,
      empresaId: dispositivo.empresaId,
      pessoaId: null,
      decisao: 'negado',
      codigo: 'nao_identificado',
      origem: 'online',
      uuid: req.uuid,
      em: agora,
    });
    return respostaNegada({ portalId: req.portalId, mensagem: 'Não identificado', evento: EVENTO.NAO_IDENTIFICADO });
  }

  // Retentativa do aparelho (mesmo uuid, ex.: timeout de rede): repete a decisão já tomada.
  if (req.uuid && deps.decisaoAnterior) {
    const anterior = await deps.decisaoAnterior(req.uuid);
    if (anterior) {
      return anterior.liberado
        ? respostaConcedida({ userId: req.userId, portalId: req.portalId, mensagem: anterior.mensagem, sentido: dispositivo.sentidoEntrada || 'clockwise', modelo: dispositivo.modelo === 'porta' ? 'porta' : 'catraca' })
        : respostaNegada({ userId: req.userId, portalId: req.portalId, mensagem: anterior.mensagem });
    }
  }

  const contexto = await deps.carregarContexto({
    empresaId: dispositivo.empresaId,
    userIdEquipamento: req.userId,
  });
  if (!contexto) {
    return respostaNegada({ userId: req.userId, portalId: req.portalId, mensagem: 'Cadastro não encontrado' });
  }

  const decisao = decidirAcesso({
    ...contexto,
    agora,
    fuso: dispositivo.fuso,
    unidadeId: dispositivo.unidadeId,
  });

  const nome = contexto.pessoa?.nome || '';
  await registrarSemFalhar(deps, {
    dispositivoId: dispositivo.id,
    empresaId: dispositivo.empresaId,
    pessoaId: contexto.pessoa?.id ?? null,
    decisao: decisao.liberado ? 'liberado' : 'negado',
    codigo: decisao.codigo,
    mensagem: mensagemVisor(decisao.mensagem),
    origem: 'online',
    uuid: req.uuid,
    em: agora,
  });

  if (decisao.acao && deps.dispararAcao) {
    // Fora do caminho crítico: a catraca não espera WhatsApp.
    Promise.resolve()
      .then(() =>
        deps.dispararAcao({
          acao: decisao.acao,
          codigo: decisao.codigo,
          pessoaId: contexto.pessoa?.id,
          customerId: contexto.pessoa?.id,
          empresaId: dispositivo.empresaId,
          checkinId: decisao.checkinId || null,
          em: agora,
        }),
      )
      .catch(() => {});
  }

  if (decisao.liberado) {
    return respostaConcedida({
      userId: req.userId,
      nome,
      portalId: req.portalId,
      mensagem: decisao.mensagem,
      sentido: dispositivo.sentidoEntrada || 'clockwise',
      modelo: dispositivo.modelo === 'porta' ? 'porta' : 'catraca',
    });
  }
  return respostaNegada({ userId: req.userId, nome, portalId: req.portalId, mensagem: decisao.mensagem });
}

async function registrarSemFalhar(deps, evento) {
  if (!deps.registrarEvento) return;
  try {
    await deps.registrarEvento(evento);
  } catch (_) {
    // log já é responsabilidade do chamador; não bloqueia a decisão
  }
}

/* ------------------------------------------------------------------ */
/* Push: comandos que o Kytto entrega quando o equipamento chama /push */
/* ------------------------------------------------------------------ */

/**
 * Comando para criar/atualizar o aluno no equipamento com a validade offline.
 * userIdEquipamento é o id numérico usado no aparelho (mapeado em acesso_credenciais).
 */
export function comandoUpsertUsuario({ userIdEquipamento, nome, matricula, config }) {
  const { begin_time, end_time } = validadeOffline(matricula, config);
  return {
    verb: 'POST',
    endpoint: 'create_or_modify_objects',
    contentType: 'application/json',
    body: {
      object: 'users',
      values: [
        {
          id: userIdEquipamento,
          name: String(nome || '').slice(0, 64),
          registration: String(userIdEquipamento),
          begin_time,
          end_time,
        },
      ],
    },
  };
}

export function comandoRemoverUsuario({ userIdEquipamento }) {
  return {
    verb: 'POST',
    endpoint: 'destroy_objects',
    contentType: 'application/json',
    body: { object: 'users', where: { users: { id: userIdEquipamento } } },
  };
}

/** Abre a catraca/porta remotamente (liberação manual pela recepção). */
export function comandoAbrirCatraca({ sentido = 'clockwise', modelo = 'catraca' } = {}) {
  const actions = modelo === 'catraca'
    ? [{ action: 'catra', parameters: `allow=${SENTIDOS.has(sentido) ? sentido : 'clockwise'}` }]
    : [{ action: 'door', parameters: 'door=1' }];
  return { verb: 'POST', endpoint: 'execute_actions', contentType: 'application/json', body: { actions } };
}

export function comandoMensagemTela({ mensagem, timeoutMs = 5000 }) {
  return {
    verb: 'POST',
    endpoint: 'message_to_screen',
    contentType: 'application/json',
    body: { message: mensagemVisor(mensagem), timeout: timeoutMs },
  };
}

/**
 * Monta a resposta do GET /push a partir dos comandos pendentes.
 * Vazio -> corpo vazio. Um -> comando simples. Vários -> lote "transactions".
 */
export function montarRespostaPush(comandos) {
  if (!comandos || comandos.length === 0) return null;
  if (comandos.length === 1) return serializarComando(comandos[0]);
  return {
    transactions: comandos.map((c, i) => ({ transactionid: String(i + 1), ...serializarComando(c) })),
  };
}

function serializarComando(c) {
  const out = { verb: c.verb || 'POST', endpoint: c.endpoint, contentType: c.contentType || 'application/json' };
  if (c.body !== undefined) out.body = c.body;
  if (c.queryString) out.queryString = c.queryString;
  return out;
}

/**
 * Interpreta POST /result. Retorna lista { transactionid|null, sucesso, resposta|erro }.
 */
export function lerResultadoPush(body = {}) {
  const lote = body.transactions_results || body.transaction_results;
  if (Array.isArray(lote)) {
    return lote.map((r) => ({
      transactionid: r.transactionid != null ? Number(r.transactionid) : null,
      sucesso: r.success === true || r.success === 'true',
      resposta: r.response ?? null,
    }));
  }
  return [
    {
      transactionid: null,
      sucesso: body.error == null,
      resposta: body.response ?? null,
      erro: body.error ?? null,
    },
  ];
}

