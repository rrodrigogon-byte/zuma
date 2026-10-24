// PDV offline por empresa (migração 095).
//
// - terminal: credencial própria (kytto_term_…); só o SHA-256 fica no banco; rotacionar invalida a anterior;
// - sincronizar: lote ordenado de eventos, idempotente por terminal (evento e venda externa);
// - venda offline vira comanda PAGA do bar com o preço cobrado no caixa (desconto em reais na
//   comanda, para a soma dos itens bater com o total e a nota fechar); o estoque do bar vai no
//   máximo a zero (a venda já aconteceu; a falta vira aviso) e os pagamentos levam a data da venda;
//   assim o razão, a ficha técnica e o fiscal seguem sozinhos;
// - conflitos: preço diferente do cadastro e estoque insuficiente (venda aplicada, só aviso);
//   produto inexistente/inativo, dia já fechado no Financeiro e venda recusada na validação
//   (venda NÃO aplicada até a gerência decidir);
// - o estoque do bar é por empresa (bar_produtos não tem unidade); no razão a venda entra com a
//   unidade do terminal (fontes.js acha pela comanda), então o dia fechado vale da empresa ou dela.
import { FUSO_PADRAO, hojeNoFuso } from '../razao/servico.js';
import crypto from 'node:crypto';
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';

const TIPOS_DISPOSITIVO = new Set(['impressora_termica', 'leitor_codigo_barras', 'balanca', 'gaveta', 'pinpad', 'display_cliente', 'outro']);
const TIPOS_EVENTO = new Set(['venda_offline', 'movimento_caixa', 'impressao', 'atualizacao_catalogo', 'outro']);
// meio do PDV → meio do bar (bar_comanda_pagamentos)
const MEIOS = { dinheiro: 'dinheiro', cartao_credito: 'cartao', cartao_debito: 'cartao_debito', cartao: 'cartao', tef: 'tef', vale: 'carteira', carteira: 'carteira' };
const MEIOS_COM_NSU = new Set(['cartao', 'cartao_debito', 'tef']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ATRASO_MS = 30 * 24 * 3600 * 1000;

const textoOpcional = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;
export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const novoToken = () => `kytto_term_${crypto.randomBytes(32).toString('base64url')}`;

/** Um "db" preso à transação aberta (consultas de leitura também passam por ela). */
function naTransacao(q) {
  return { query: q, queryRead: q, beginTransaction: async () => null, queryInTransaction: (_c, t, v) => q(t, v), commit: async () => {}, rollback: async () => {} };
}

// ── terminais e periféricos ──────────────────────────────────────────────────
function terminalDto(r) {
  return { id: r.id, loja_id: r.loja_id, codigo: r.codigo, nome: r.nome, identificador_dispositivo: r.identificador_dispositivo || null, modo_offline_habilitado: r.modo_offline_habilitado, ativo: r.ativo, versao_agente: r.versao_agente || null, ultimo_heartbeat_em: r.ultimo_heartbeat_em, ultima_sincronizacao_em: r.ultima_sincronizacao_em, total_dispositivos: Number(r.total_dispositivos || 0), loja_nome: r.loja_nome || null };
}

export async function listarTerminais(db, empresaId, { lojaId = null } = {}) {
  const r = await db.query(
    `SELECT t.*, l.nome AS loja_nome, (SELECT COUNT(*) FROM pdv_dispositivos d WHERE d.empresa_id = t.empresa_id AND d.terminal_id = t.id AND d.ativo) AS total_dispositivos
       FROM pdv_terminais t LEFT JOIN lojas l ON l.id = t.loja_id AND l.empresa_id = t.empresa_id
      WHERE t.empresa_id = $1 AND ($2::uuid IS NULL OR t.loja_id = $2::uuid) ORDER BY t.codigo`, [exigirUuid(empresaId, 'empresa'), lojaId]);
  return r.rows.map(terminalDto);
}

async function exigirLoja(q, empresa, loja) {
  const r = await q('SELECT id FROM lojas WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(loja, 'unidade')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
  return r.rows[0].id;
}

/** Cria o terminal e devolve o token UMA vez (não há como recuperá-lo depois, só rotacionar). */
export async function criarTerminal(db, empresaId, dados = {}, { lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = await exigirLoja((t, v) => db.query(t, v), empresa, lojaRestrita || dados.loja_id);
  if (lojaRestrita && dados.loja_id && dados.loja_id !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
  const codigo = exigirTexto(String(dados.codigo || '').toUpperCase(), 'Código', { min: 2, max: 60 });
  if (!/^[A-Z0-9._-]+$/.test(codigo)) throw new ErroDominio('VALIDATION_ERROR', 'Código aceita letras, números, ponto, hífen e sublinhado');
  const token = novoToken();
  try {
    const r = await db.query(
      `INSERT INTO pdv_terminais (empresa_id, loja_id, codigo, nome, identificador_dispositivo, token_hash, modo_offline_habilitado) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [empresa, loja, codigo, exigirTexto(dados.nome, 'Nome', { min: 2, max: 120 }), textoOpcional(dados.identificador_dispositivo, 160), hashToken(token), dados.modo_offline_habilitado !== false]);
    return { terminal: terminalDto(r.rows[0]), token_provisionamento: token };
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('CONFLICT', 'Já existe um terminal com este código', 409);
    throw error;
  }
}

export async function atualizarTerminal(db, empresaId, id, dados = {}, { lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(
    `UPDATE pdv_terminais SET nome = COALESCE($3, nome), ativo = COALESCE($4, ativo), modo_offline_habilitado = COALESCE($5, modo_offline_habilitado)
      WHERE empresa_id = $1 AND id = $2 AND ($6::uuid IS NULL OR loja_id = $6::uuid) RETURNING *`,
    [empresa, exigirUuid(id, 'terminal'), textoOpcional(dados.nome, 120), typeof dados.ativo === 'boolean' ? dados.ativo : null, typeof dados.modo_offline_habilitado === 'boolean' ? dados.modo_offline_habilitado : null, lojaRestrita]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Terminal não encontrado', 404);
  return terminalDto(r.rows[0]);
}

export async function rotacionarToken(db, empresaId, id, { lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const token = novoToken();
  const r = await db.query('UPDATE pdv_terminais SET token_hash = $3 WHERE empresa_id = $1 AND id = $2 AND ($4::uuid IS NULL OR loja_id = $4::uuid) RETURNING *', [empresa, exigirUuid(id, 'terminal'), hashToken(token), lojaRestrita]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Terminal não encontrado', 404);
  return { terminal: terminalDto(r.rows[0]), token_provisionamento: token };
}

function dispositivoDto(r) {
  return { id: r.id, loja_id: r.loja_id, terminal_id: r.terminal_id || null, terminal_codigo: r.terminal_codigo || null, tipo: r.tipo, nome: r.nome, fabricante: r.fabricante || null, modelo: r.modelo || null, endereco_conexao: r.endereco_conexao || null, configuracoes: r.configuracoes || {}, ativo: r.ativo, ultimo_status: r.ultimo_status, ultimo_status_em: r.ultimo_status_em };
}

export async function listarDispositivos(db, empresaId, { lojaId = null } = {}) {
  const r = await db.query(
    `SELECT d.*, t.codigo AS terminal_codigo FROM pdv_dispositivos d LEFT JOIN pdv_terminais t ON t.empresa_id = d.empresa_id AND t.id = d.terminal_id
      WHERE d.empresa_id = $1 AND ($2::uuid IS NULL OR d.loja_id = $2::uuid) ORDER BY d.tipo, d.nome`, [exigirUuid(empresaId, 'empresa'), lojaId]);
  return r.rows.map(dispositivoDto);
}

export async function criarDispositivo(db, empresaId, dados = {}, { lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (lojaRestrita && dados.loja_id && dados.loja_id !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
  const loja = await exigirLoja((t, v) => db.query(t, v), empresa, lojaRestrita || dados.loja_id);
  if (!TIPOS_DISPOSITIVO.has(dados.tipo)) throw new ErroDominio('VALIDATION_ERROR', 'Tipo de periférico inválido');
  const terminal = dados.terminal_id ? exigirUuid(dados.terminal_id, 'terminal') : null;
  if (terminal && !(await db.query('SELECT 1 FROM pdv_terminais WHERE empresa_id = $1 AND id = $2 AND loja_id = $3', [empresa, terminal, loja])).rows[0]) throw new ErroDominio('NOT_FOUND', 'Terminal não encontrado nesta unidade', 404);
  const cfg = dados.configuracoes && typeof dados.configuracoes === 'object' ? dados.configuracoes : {};
  const configuracoes = { modo: cfg.modo === 'rede' ? 'rede' : 'diagnostico', ...(cfg.host ? { host: String(cfg.host).slice(0, 120) } : {}), ...(Number(cfg.porta) > 0 && Number(cfg.porta) < 65536 ? { porta: Number(cfg.porta) } : {}) };
  const r = await db.query(
    'INSERT INTO pdv_dispositivos (empresa_id, loja_id, terminal_id, tipo, nome, fabricante, modelo, endereco_conexao, configuracoes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [empresa, loja, terminal, dados.tipo, exigirTexto(dados.nome, 'Nome', { min: 2, max: 120 }), textoOpcional(dados.fabricante, 80), textoOpcional(dados.modelo, 80), textoOpcional(dados.endereco_conexao, 160), JSON.stringify(configuracoes)]);
  return dispositivoDto(r.rows[0]);
}

// ── autenticação do terminal ─────────────────────────────────────────────────
export async function autenticarTerminal(db, terminalId, token) {
  if (!UUID_RE.test(String(terminalId || '')) || !token) throw new ErroDominio('TERMINAL_NAO_AUTENTICADO', 'Credencial de terminal ausente', 401);
  // empresa e unidade precisam estar ativas (a coluna é "ativa" em lojas e "ativo" em empresas; lê as duas formas)
  const r = await db.query(
    `SELECT t.* FROM pdv_terminais t
       JOIN empresas e ON e.id = t.empresa_id
       JOIN lojas l ON l.id = t.loja_id AND l.empresa_id = t.empresa_id
      WHERE t.id = $1 AND t.ativo = true
        AND COALESCE((to_jsonb(e)->>'ativo')::boolean, (to_jsonb(e)->>'ativa')::boolean, true)
        AND COALESCE((to_jsonb(l)->>'ativa')::boolean, (to_jsonb(l)->>'ativo')::boolean, true)`, [terminalId]);
  const t = r.rows[0];
  const a = Buffer.from(t?.token_hash || '0'.repeat(64)); const b = Buffer.from(hashToken(token));
  if (!t || a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new ErroDominio('TERMINAL_NAO_AUTENTICADO', 'Terminal inválido ou desativado', 401);
  return t;
}

export async function heartbeat(db, terminal, { versao_agente = null, dispositivos = [] } = {}) {
  await db.query('UPDATE pdv_terminais SET ultimo_heartbeat_em = CURRENT_TIMESTAMP, versao_agente = COALESCE($2, versao_agente) WHERE id = $1', [terminal.id, textoOpcional(versao_agente, 40)]);
  for (const d of Array.isArray(dispositivos) ? dispositivos.slice(0, 50) : []) {
    if (!UUID_RE.test(String(d?.id || ''))) continue;
    const status = ['online', 'offline', 'erro'].includes(d.status) ? d.status : 'desconhecido';
    await db.query('UPDATE pdv_dispositivos SET ultimo_status = $3, ultimo_status_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND loja_id = $4 AND (terminal_id IS NULL OR terminal_id = $5)', [terminal.empresa_id, d.id, status, terminal.loja_id, terminal.id]);
  }
  return { sucesso: true, servidor_em: new Date().toISOString(), modo_offline_habilitado: terminal.modo_offline_habilitado };
}

// ── sincronização ────────────────────────────────────────────────────────────
/** Data da venda: no futuro (> 5 min) ou com mais de 30 dias é recusada (não troca por "agora" calado). */
function instanteDaVenda(valor, agora) {
  if (!valor) return agora;
  const d = new Date(valor);
  if (Number.isNaN(d.valueOf())) throw new ErroDominio('VALIDATION_ERROR', 'Data da venda offline inválida');
  if (d > new Date(agora.valueOf() + 5 * 60 * 1000)) throw new ErroDominio('VALIDATION_ERROR', 'Data da venda offline no futuro: confira o relógio do caixa');
  if (agora - d > MAX_ATRASO_MS) throw new ErroDominio('VALIDATION_ERROR', 'Venda offline com mais de 30 dias: lance pela gerência');
  return d;
}

const tresCasas = (n) => Math.abs(Math.round(n * 1000) / 1000 - n) < 1e-9;

/** Dia da venda já fechado no Financeiro, da empresa toda ou da unidade do terminal (a venda entra no razão com ela)? */
async function diaFechado(q, empresa, lojaId, quando, fuso) {
  if (!(await q("SELECT to_regclass('fin_fechamentos') AS t")).rows[0]?.t) return null;
  const dia = hojeNoFuso(quando, fuso);
  const r = await q('SELECT 1 FROM fin_fechamentos WHERE empresa_id = $1 AND data = $2::date AND (loja_id IS NULL OR loja_id = $3::uuid) LIMIT 1', [empresa, dia, lojaId || null]);
  return r.rows[0] ? dia : null;
}

/**
 * Aplica a venda dentro da transação `q`. Devolve { aplicado, comandaId, conflitos[] }.
 * Conflito bloqueante (produto inexistente/inativo) não aplica nada.
 */
async function aplicarVenda(q, terminal, payload, { agora, fuso = FUSO_PADRAO, lancarHojeSeFechado = false }) {
  const empresa = terminal.empresa_id;
  if (!UUID_RE.test(String(payload.id_externo || ''))) throw new ErroDominio('VALIDATION_ERROR', 'id_externo da venda é obrigatório (UUID)');
  const ja = (await q("SELECT comanda_id FROM pdv_eventos WHERE terminal_id = $1 AND id_externo = $2 AND status = 'processado'", [terminal.id, payload.id_externo])).rows[0];
  if (ja) return { aplicado: true, repetida: true, comandaId: ja.comanda_id, conflitos: [] };
  const itens = (Array.isArray(payload.itens) ? payload.itens : []).map((i) => ({
    produtoId: String(i.produto_id || ''), quantidade: Number(i.quantidade), valorUnitario: dinheiro(i.valor_unitario), desconto: dinheiro(i.desconto_item || 0), observacoes: textoOpcional(i.observacoes, 300),
  }));
  if (!itens.length || itens.some((i) => !UUID_RE.test(i.produtoId) || !(i.quantidade > 0) || !tresCasas(i.quantidade) || i.quantidade > 100000 || i.valorUnitario < 0 || i.desconto < 0 || i.desconto > i.quantidade * i.valorUnitario)) throw new ErroDominio('VALIDATION_ERROR', 'Item inválido na venda offline');
  const pagamentos = (Array.isArray(payload.pagamentos) ? payload.pagamentos : []).filter((p) => (p.status || 'aprovado') === 'aprovado').map((p) => ({ tipo: String(p.tipo || '').toLowerCase(), valor: dinheiro(p.valor), referencia: textoOpcional(p.referencia_externa, 180) }));
  if (!pagamentos.length) throw new ErroDominio('VALIDATION_ERROR', 'Venda offline sem pagamento aprovado');
  if (pagamentos.some((p) => p.tipo === 'pix')) throw new ErroDominio('VALIDATION_ERROR', 'Pix exige confirmação online: não entra por venda offline');
  if (pagamentos.some((p) => !MEIOS[p.tipo] || !(p.valor > 0))) throw new ErroDominio('VALIDATION_ERROR', 'Forma de pagamento inválida na venda offline');
  if (pagamentos.some((p) => MEIOS_COM_NSU.has(MEIOS[p.tipo]) && !p.referencia)) throw new ErroDominio('VALIDATION_ERROR', 'Cartão/TEF offline exige NSU/referência do TEF');
  const acrescimo = dinheiro(payload.valor_acrescimo || 0);
  if (acrescimo < 0) throw new ErroDominio('VALIDATION_ERROR', 'Acréscimo inválido');
  // bruto por linha em centavos (quantidade fracionada: kg/litro)
  const bruto = dinheiro(itens.reduce((s, i) => s + dinheiro(i.quantidade * i.valorUnitario), 0));
  const desconto = dinheiro(itens.reduce((s, i) => s + i.desconto, 0));
  const total = dinheiro(bruto - desconto + acrescimo);
  if (Math.abs(dinheiro(pagamentos.reduce((s, p) => s + p.valor, 0)) - total) > 0.01) throw new ErroDominio('VALIDATION_ERROR', 'Pagamentos não conferem com o total da venda offline');

  const produtos = new Map((await q('SELECT * FROM bar_produtos WHERE empresa_id = $1 AND id = ANY($2::uuid[]) FOR UPDATE', [empresa, itens.map((i) => i.produtoId)])).rows.map((p) => [p.id, p]));
  const conflitos = [];
  for (const i of itens) {
    const p = produtos.get(i.produtoId);
    if (!p || p.ativo === false) conflitos.push({ tipo: 'produto_inexistente', bloqueante: true, cliente: { produto_id: i.produtoId }, servidor: { encontrado: Boolean(p), ativo: p?.ativo ?? null } });
    else {
      if (Math.abs(Number(p.preco) - i.valorUnitario) > 0.004) conflitos.push({ tipo: 'preco_divergente', bloqueante: false, cliente: { produto_id: i.produtoId, valor_unitario: i.valorUnitario }, servidor: { preco: Number(p.preco), nome: p.nome } });
      const consumo = i.quantidade * Number(p.fator_estoque || 1);
      // a venda já aconteceu: o estoque do bar vai a zero (não fica negativo) e a diferença vira aviso para conferir
      if (Number(p.estoque_atual) < consumo - 1e-6) conflitos.push({ tipo: 'estoque_insuficiente', bloqueante: false, cliente: { produto_id: i.produtoId, quantidade: i.quantidade }, servidor: { estoque_atual: Number(p.estoque_atual), nome: p.nome } });
    }
  }
  let quando = instanteDaVenda(payload.ocorreu_em, agora);
  const fechado = await diaFechado(q, empresa, terminal.loja_id, quando, fuso);
  if (fechado) {
    // gerência aceitou lançar hoje (o caixa daquele dia já foi conferido e fechado)
    if (lancarHojeSeFechado && !(await diaFechado(q, empresa, terminal.loja_id, agora, fuso))) quando = agora;
    else conflitos.push({ tipo: 'dia_fechado', bloqueante: true, cliente: { ocorreu_em: payload.ocorreu_em || null, total }, servidor: { dia_fechado: fechado } });
  }
  if (conflitos.some((c) => c.bloqueante)) return { aplicado: false, conflitos };

  const comanda = (await q("INSERT INTO bar_comandas (empresa_id, nome, operador_id) VALUES ($1, $2, $3) RETURNING *", [empresa, `PDV ${terminal.codigo} · ${payload.id_externo.slice(0, 8)}`.slice(0, 120), textoOpcional(payload.usuario_vendedor_id, 180)])).rows[0];
  for (const i of itens) {
    const p = produtos.get(i.produtoId);
    const consumo = Number((i.quantidade * Number(p.fator_estoque || 1)).toFixed(6));
    // o item guarda o preço cobrado por unidade; o desconto vai para a comanda (desconto_valor)
    await q("INSERT INTO bar_comanda_itens (empresa_id, comanda_id, produto_id, quantidade, valor_unitario, consumo_estoque, observacoes, status, criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,'servido',$8)",
      [empresa, comanda.id, p.id, i.quantidade, i.valorUnitario, consumo, i.observacoes, quando]);
    // baixa até zero; o movimento registra só o que saiu de fato (a falta já virou aviso)
    const saldoAntes = Number(p.estoque_atual);
    const efetivo = Number(Math.min(consumo, Math.max(saldoAntes, 0)).toFixed(6));
    p.estoque_atual = Number(Math.max(saldoAntes - consumo, 0).toFixed(6));
    if (efetivo > 0) {
      await q('UPDATE bar_produtos SET estoque_atual = $1, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $2 AND id = $3', [p.estoque_atual, empresa, p.id]);
      await q("INSERT INTO bar_estoque_movimentos (empresa_id, produto_id, tipo, quantidade, saldo_apos, origem, referencia_id, criado_por) VALUES ($1,$2,'saida',$3,$4,'pdv_offline',$5,$6)",
        [empresa, p.id, efetivo, p.estoque_atual, comanda.id, `terminal ${terminal.codigo}`]);
    }
  }
  for (const pg of pagamentos) {
    await q('INSERT INTO bar_comanda_pagamentos (empresa_id, comanda_id, meio, valor, referencia, criado_em) VALUES ($1,$2,$3,$4,$5,$6)', [empresa, comanda.id, MEIOS[pg.tipo], pg.valor, pg.referencia, quando]);
  }
  // total = soma dos itens (como no bar); valor_final = o que foi pago (− desconto + acréscimo)
  await q(`UPDATE bar_comandas SET status = 'paga', total = $7, valor_final = $3, desconto_valor = $8, incluir_servico = false, desconto_percentual = 0, meio_pagamento = $4,
             pagamentos = (SELECT COALESCE(jsonb_agg(jsonb_build_object('meio', meio, 'valor', valor, 'referencia', referencia) ORDER BY criado_em), '[]'::jsonb) FROM bar_comanda_pagamentos WHERE empresa_id = $1 AND comanda_id = $2),
             cpf_nota = $5, fechada_em = $6, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`,
  [empresa, comanda.id, total, MEIOS[pagamentos[0].tipo], textoOpcional(String(payload.cpf || '').replace(/\D/g, ''), 14), quando, bruto, desconto]);
  return { aplicado: true, comandaId: comanda.id, total, conflitos };
}

async function registrarConflitos(q, terminal, eventoId, conflitos) {
  for (const c of conflitos) {
    await q('INSERT INTO pdv_conflitos (empresa_id, loja_id, terminal_id, evento_id, tipo_conflito, bloqueante, dados_cliente, dados_servidor) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [terminal.empresa_id, terminal.loja_id, terminal.id, eventoId, c.tipo, c.bloqueante, JSON.stringify(c.cliente || {}), JSON.stringify(c.servidor || {})]);
  }
}

/** Processa um evento já gravado (status pendente/conflito/falha) dentro de uma transação. */
async function processarEvento(db, terminal, eventoDb, { agora, fuso }) {
  return transacao(db, async (q) => {
    const ev = (await q('SELECT * FROM pdv_eventos WHERE id = $1 FOR UPDATE', [eventoDb.id])).rows[0];
    // outro envio do mesmo evento já decidiu (processou, segurou em conflito ou a gerência descartou)
    if (['processado', 'conflito', 'descartado'].includes(ev.status)) return { status: ev.status, resultado: ev.resultado, repetido: true };
    if (ev.tipo !== 'venda_offline') {
      const resultado = { recebido: true };
      await q("UPDATE pdv_eventos SET status = 'processado', resultado = $2, processado_em = CURRENT_TIMESTAMP WHERE id = $1", [ev.id, JSON.stringify(resultado)]);
      return { status: 'processado', resultado };
    }
    const venda = await aplicarVenda(q, terminal, ev.payload || {}, { agora, fuso });
    const status = venda.aplicado ? 'processado' : 'conflito';
    const resultado = { aplicado: venda.aplicado, comanda_id: venda.comandaId || null, total: venda.total ?? null, repetida: Boolean(venda.repetida), conflitos: venda.conflitos.map((c) => c.tipo) };
    await q('UPDATE pdv_eventos SET status = $2, resultado = $3, comanda_id = $4, id_externo = $5, processado_em = CURRENT_TIMESTAMP WHERE id = $1',
      [ev.id, status, JSON.stringify(resultado), venda.repetida ? null : (venda.comandaId || null), venda.aplicado && !venda.repetida ? ev.payload.id_externo : null]);
    // venda segurada: só os bloqueios (os avisos de preço/estoque nascem quando ela for aplicada)
    if (!venda.repetida) await registrarConflitos(q, terminal, ev.id, venda.aplicado ? venda.conflitos : venda.conflitos.filter((c) => c.bloqueante));
    return { status: venda.conflitos.length ? 'conflito' : 'processado', resultado };
  });
}

export async function sincronizar(db, terminal, { lote_cliente_id, versao_cliente = null, eventos } = {}, { agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  if (!terminal.modo_offline_habilitado) throw new ErroDominio('OFFLINE_DESABILITADO', 'Sincronização offline desligada para este terminal', 403);
  if (!UUID_RE.test(String(lote_cliente_id || '')) || !Array.isArray(eventos) || !eventos.length || eventos.length > 200) throw new ErroDominio('VALIDATION_ERROR', 'Lote UUID e entre 1 e 200 eventos são obrigatórios');
  if (eventos.some((e) => !UUID_RE.test(String(e?.id || '')) || !Number.isInteger(e.sequencia) || !TIPOS_EVENTO.has(e.tipo))) throw new ErroDominio('VALIDATION_ERROR', 'Há evento com id, sequência ou tipo inválido');
  const anterior = (await db.query('SELECT * FROM pdv_lotes WHERE terminal_id = $1 AND lote_cliente_id = $2', [terminal.id, lote_cliente_id])).rows[0];
  if (anterior?.status === 'processado') {
    const r = await db.query('SELECT evento_cliente_id AS id, sequencia, status, resultado FROM pdv_eventos WHERE lote_id = $1 ORDER BY sequencia', [anterior.id]);
    return { sucesso: true, repetido: true, lote: anterior, eventos: r.rows.map((x) => ({ ...x, sequencia: Number(x.sequencia) })) };
  }
  const lote = anterior || (await db.query(
    `INSERT INTO pdv_lotes (empresa_id, terminal_id, lote_cliente_id, versao_cliente, total_eventos) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (terminal_id, lote_cliente_id) DO UPDATE SET versao_cliente = EXCLUDED.versao_cliente RETURNING *`,
    [terminal.empresa_id, terminal.id, lote_cliente_id, textoOpcional(versao_cliente, 40), eventos.length])).rows[0];
  const resultados = []; let processados = 0; let conflitos = 0;
  for (const e of [...eventos].sort((a, b) => a.sequencia - b.sequencia)) {
    await db.query(
      `INSERT INTO pdv_eventos (empresa_id, terminal_id, lote_id, evento_cliente_id, sequencia, tipo, payload, criado_no_cliente_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (terminal_id, evento_cliente_id) DO NOTHING`,
      [terminal.empresa_id, terminal.id, lote.id, e.id, e.sequencia, e.tipo, JSON.stringify(e.payload || {}), e.criado_em && !Number.isNaN(new Date(e.criado_em).valueOf()) ? new Date(e.criado_em) : null]);
    const ev = (await db.query('SELECT * FROM pdv_eventos WHERE terminal_id = $1 AND evento_cliente_id = $2', [terminal.id, e.id])).rows[0];
    if (['processado', 'conflito', 'descartado'].includes(ev.status)) {
      resultados.push({ id: e.id, sequencia: e.sequencia, status: ev.status, resultado: ev.resultado, repetido: true });
      processados += 1; if (ev.status === 'conflito') conflitos += 1;
      continue;
    }
    try {
      const r = await processarEvento(db, terminal, ev, { agora, fuso });
      resultados.push({ id: e.id, sequencia: e.sequencia, ...r });
      processados += 1; if (r.status === 'conflito') conflitos += 1;
    } catch (error) {
      const resultado = { erro: error instanceof ErroDominio ? error.message : 'Erro ao processar evento' };
      if (!(error instanceof ErroDominio)) console.error('[pdv-offline] evento', String(error?.message || error).slice(0, 200));
      const marcado = await db.query("UPDATE pdv_eventos SET status = 'falha', resultado = $2, processado_em = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('pendente', 'falha') RETURNING id", [ev.id, JSON.stringify(resultado)]);
      // venda recusada na validação (total, Pix, NSU, data…) aparece para a gerência; não aplica nada
      if (marcado.rows[0] && e.tipo === 'venda_offline' && error instanceof ErroDominio && error.status < 500) {
        await db.query(
          `INSERT INTO pdv_conflitos (empresa_id, loja_id, terminal_id, evento_id, tipo_conflito, bloqueante, dados_cliente, dados_servidor)
           SELECT $1,$2,$3,$4,'venda_rejeitada',false,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM pdv_conflitos WHERE evento_id = $4 AND tipo_conflito = 'venda_rejeitada' AND status = 'pendente')`,
          [terminal.empresa_id, terminal.loja_id, terminal.id, ev.id, JSON.stringify({ id_externo: e.payload?.id_externo || null, ocorreu_em: e.payload?.ocorreu_em || null }), JSON.stringify({ erro: resultado.erro })]);
      }
      resultados.push({ id: e.id, sequencia: e.sequencia, status: 'falha', resultado });
    }
  }
  const statusLote = resultados.some((r) => r.status === 'falha') ? (processados === 0 ? 'falha' : 'parcial') : 'processado';
  const loteFinal = (await db.query('UPDATE pdv_lotes SET status = $2, eventos_processados = $3, eventos_com_conflito = $4, processado_em = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [lote.id, statusLote, processados, conflitos])).rows[0];
  await db.query('UPDATE pdv_terminais SET ultima_sincronizacao_em = CURRENT_TIMESTAMP, ultimo_heartbeat_em = CURRENT_TIMESTAMP WHERE id = $1', [terminal.id]);
  return { sucesso: statusLote !== 'falha', lote: loteFinal, eventos: resultados };
}

// ── conflitos ────────────────────────────────────────────────────────────────
export async function listarConflitos(db, empresaId, { lojaId = null, todos = false } = {}) {
  const r = await db.query(
    `SELECT c.*, t.codigo AS terminal_codigo, t.nome AS terminal_nome FROM pdv_conflitos c JOIN pdv_terminais t ON t.empresa_id = c.empresa_id AND t.id = c.terminal_id
      WHERE c.empresa_id = $1 AND ($2::uuid IS NULL OR c.loja_id = $2::uuid) AND ($3::boolean OR c.status = 'pendente') ORDER BY c.data_criacao DESC LIMIT 300`,
    [exigirUuid(empresaId, 'empresa'), lojaId, todos]);
  return r.rows.map((c) => ({ id: c.id, tipo_conflito: c.tipo_conflito, bloqueante: c.bloqueante, dados_cliente: c.dados_cliente, dados_servidor: c.dados_servidor, status: c.status, resolucao: c.resolucao || null, terminal_codigo: c.terminal_codigo, terminal_nome: c.terminal_nome, data_criacao: c.data_criacao }));
}

/**
 * Resolve. Conflito bloqueante + aceito_cliente: tenta aplicar a venda de novo (o produto pode ter
 * sido cadastrado/reativado). Bloqueante + descartado/aceito_servidor: a venda não entra.
 */
export async function resolverConflito(db, empresaId, id, resolucao, { usuario = null, lojaRestrita = null, agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!['aceito_cliente', 'aceito_servidor', 'descartado'].includes(resolucao)) throw new ErroDominio('VALIDATION_ERROR', 'resolução inválida');
  return transacao(db, async (q) => {
    const c = (await q('SELECT * FROM pdv_conflitos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'conflito')])).rows[0];
    if (!c || (lojaRestrita && c.loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Conflito não encontrado', 404);
    if (c.status === 'resolvido') return { id: c.id, status: c.status, resolucao: c.resolucao };
    // aviso (preço, estoque, venda recusada): só registra que a gerência viu
    if (!c.bloqueante && resolucao !== 'aceito_servidor') throw new ErroDominio('VALIDATION_ERROR', 'Aviso só pode ser marcado como ciente', 422);
    let venda = null;
    if (c.bloqueante) {
      const ev = (await q('SELECT * FROM pdv_eventos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, c.evento_id])).rows[0];
      if (resolucao === 'aceito_cliente') {
        if (ev.status !== 'conflito') throw new ErroDominio('CONFLICT', 'Esta venda já foi decidida (processada ou descartada)', 409);
        const terminal = (await q('SELECT * FROM pdv_terminais WHERE empresa_id = $1 AND id = $2', [empresa, c.terminal_id])).rows[0];
        venda = await aplicarVenda(q, terminal, ev.payload || {}, { agora, fuso, lancarHojeSeFechado: true });
        if (!venda.aplicado) throw new ErroDominio('AINDA_EM_CONFLITO', 'A venda continua em conflito (produto inexistente/inativo ou dia fechado): resolva a causa e tente de novo', 409);
        await q("UPDATE pdv_eventos SET status = 'processado', comanda_id = $2, id_externo = $3, resultado = $4, processado_em = CURRENT_TIMESTAMP WHERE id = $1",
          [ev.id, venda.comandaId || null, venda.repetida ? null : ev.payload.id_externo, JSON.stringify({ aplicado: true, comanda_id: venda.comandaId, total: venda.total ?? null, resolvido: true })]);
        await q("UPDATE pdv_conflitos SET status = 'resolvido', resolucao = 'aceito_cliente', resolvido_por = $3, resolvido_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND evento_id = $2 AND bloqueante AND status = 'pendente'", [empresa, ev.id, textoOpcional(usuario, 180)]);
        // avisos novos desta aplicação (preço, estoque) ficam para a gerência ver
        await registrarConflitos(q, terminal, ev.id, venda.conflitos.filter((x) => !x.bloqueante));
      } else {
        // venda não entra: todos os bloqueios do evento ficam resolvidos com a mesma decisão
        await q("UPDATE pdv_eventos SET status = 'descartado', processado_em = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'conflito'", [ev.id]);
        await q("UPDATE pdv_conflitos SET status = 'resolvido', resolucao = $3, resolvido_por = $4, resolvido_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND evento_id = $2 AND bloqueante AND status = 'pendente'", [empresa, ev.id, resolucao, textoOpcional(usuario, 180)]);
      }
    }
    await q("UPDATE pdv_conflitos SET status = 'resolvido', resolucao = $3, resolvido_por = $4, resolvido_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2", [empresa, c.id, resolucao, textoOpcional(usuario, 180)]);
    return { id: c.id, status: 'resolvido', resolucao, comandaId: venda?.comandaId || null };
  });
}

export { naTransacao };

// ── fila de impressão do agente local ────────────────────────────────────────
const TIPOS_IMPRESSAO = new Set(['cupom', 'comanda', 'teste', 'outro']);
// trabalho entregue e sem resposta volta para a fila depois disto (agente caiu no meio)
const ENTREGA_EXPIRA_MIN = 5;

function conteudoDeImpressao(c = {}) {
  const linha = (l) => (typeof l === 'string' ? l.slice(0, 120) : { ...(l?.esquerda !== undefined ? { esquerda: String(l.esquerda).slice(0, 80) } : {}), ...(l?.direita !== undefined ? { direita: String(l.direita).slice(0, 40) } : {}), ...(l?.texto ? { texto: String(l.texto).slice(0, 120), alinhamento: ['esquerda', 'centro', 'direita'].includes(l.alinhamento) ? l.alinhamento : 'esquerda' } : {}) });
  const linhas = (Array.isArray(c.linhas) ? c.linhas : []).slice(0, 200).map(linha);
  return { ...(c.titulo ? { titulo: String(c.titulo).slice(0, 60) } : {}), ...(c.subtitulo ? { subtitulo: String(c.subtitulo).slice(0, 60) } : {}), linhas, ...(c.total ? { total: String(c.total).slice(0, 60) } : {}), ...(c.rodape ? { rodape: String(c.rodape).slice(0, 120) } : {}), ...(c.acao === 'abrir_gaveta' ? { acao: 'abrir_gaveta' } : {}) };
}

/** Põe um trabalho na fila da unidade (opcionalmente de um terminal e de um periférico). */
export async function enfileirarImpressao(db, empresaId, dados = {}, { usuario = null, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (lojaRestrita && dados.loja_id && dados.loja_id !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
  const loja = await exigirLoja((t, v) => db.query(t, v), empresa, lojaRestrita || dados.loja_id);
  const tipo = TIPOS_IMPRESSAO.has(dados.tipo_documento) ? dados.tipo_documento : 'cupom';
  const terminal = dados.terminal_id ? exigirUuid(dados.terminal_id, 'terminal') : null;
  const dispositivo = dados.dispositivo_id ? exigirUuid(dados.dispositivo_id, 'periférico') : null;
  if (terminal && !(await db.query('SELECT 1 FROM pdv_terminais WHERE empresa_id = $1 AND id = $2 AND loja_id = $3', [empresa, terminal, loja])).rows[0]) throw new ErroDominio('NOT_FOUND', 'Terminal não encontrado nesta unidade', 404);
  if (dispositivo && !(await db.query('SELECT 1 FROM pdv_dispositivos WHERE empresa_id = $1 AND id = $2 AND loja_id = $3', [empresa, dispositivo, loja])).rows[0]) throw new ErroDominio('NOT_FOUND', 'Periférico não encontrado nesta unidade', 404);
  const conteudo = tipo === 'teste'
    ? { titulo: 'Teste de impressão', subtitulo: new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' }), linhas: ['Se você lê isto, a impressora está ligada', 'ao terminal do Kytto.'], rodape: 'Kytto' }
    : conteudoDeImpressao(dados.conteudo);
  if (tipo !== 'teste' && !conteudo.linhas.length && !conteudo.titulo && !conteudo.acao) throw new ErroDominio('VALIDATION_ERROR', 'Nada para imprimir');
  const r = await db.query(
    'INSERT INTO pdv_impressoes (empresa_id, loja_id, terminal_id, dispositivo_id, tipo_documento, conteudo, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, status, criado_em',
    [empresa, loja, terminal, dispositivo, tipo, JSON.stringify(conteudo), textoOpcional(usuario, 180)]);
  return r.rows[0];
}

/** Próximo trabalho do terminal (dele ou da unidade sem terminal). null = fila vazia. */
export async function proximoTrabalho(db, terminal) {
  const r = await db.query(
    `UPDATE pdv_impressoes SET status = 'entregue', entregue_em = CURRENT_TIMESTAMP, tentativas = tentativas + 1, terminal_id = COALESCE(terminal_id, $3)
      WHERE id = (SELECT id FROM pdv_impressoes
                   WHERE empresa_id = $1 AND loja_id = $2 AND (terminal_id IS NULL OR terminal_id = $3) AND tentativas < 5
                     AND (status = 'pendente' OR (status = 'entregue' AND entregue_em < CURRENT_TIMESTAMP - make_interval(mins => $4)))
                   ORDER BY criado_em FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id, dispositivo_id, tipo_documento, conteudo`,
    [terminal.empresa_id, terminal.loja_id, terminal.id, ENTREGA_EXPIRA_MIN]);
  const t = r.rows[0];
  return t ? { id: t.id, dispositivo_id: t.dispositivo_id, tipo_documento: t.tipo_documento === 'teste' ? 'cupom' : t.tipo_documento, conteudo: t.conteudo } : null;
}

export async function resultadoDoTrabalho(db, terminal, id, { sucesso, erro } = {}) {
  if (!UUID_RE.test(String(id || ''))) throw new ErroDominio('VALIDATION_ERROR', 'Trabalho inválido');
  const r = await db.query(
    `UPDATE pdv_impressoes SET status = $4, erro = $5, concluido_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 AND terminal_id = $3 AND status = 'entregue' RETURNING id, status`,
    [terminal.empresa_id, id, terminal.id, sucesso === true ? 'impresso' : 'erro', sucesso === true ? null : textoOpcional(erro, 300) || 'Falha sem detalhe']);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Trabalho não encontrado para este terminal', 404);
  return r.rows[0];
}

export async function listarImpressoes(db, empresaId, { lojaId = null, limite = 50 } = {}) {
  const r = await db.query(
    `SELECT i.id, i.loja_id, i.tipo_documento, i.status, i.erro, i.tentativas, i.criado_em, i.concluido_em, t.codigo AS terminal_codigo, d.nome AS dispositivo_nome
       FROM pdv_impressoes i LEFT JOIN pdv_terminais t ON t.empresa_id = i.empresa_id AND t.id = i.terminal_id
       LEFT JOIN pdv_dispositivos d ON d.empresa_id = i.empresa_id AND d.id = i.dispositivo_id
      WHERE i.empresa_id = $1 AND ($2::uuid IS NULL OR i.loja_id = $2::uuid) ORDER BY i.criado_em DESC LIMIT $3`,
    [exigirUuid(empresaId, 'empresa'), lojaId, Math.min(Math.max(Number(limite) || 50, 1), 200)]);
  return r.rows;
}

/** Eventos técnicos do agente (telemetria): até 100 por envio. */
export async function registrarEventosDoAgente(db, terminal, eventos = []) {
  const lista = (Array.isArray(eventos) ? eventos : []).slice(0, 100).filter((e) => e && typeof e === 'object');
  for (const e of lista) {
    const quando = e.ocorrido_em && !Number.isNaN(new Date(e.ocorrido_em).valueOf()) ? new Date(e.ocorrido_em) : null;
    const dados = JSON.stringify(e.dados && typeof e.dados === 'object' ? e.dados : {}).slice(0, 4000);
    await db.query('INSERT INTO pdv_eventos_agente (empresa_id, terminal_id, tipo_evento, severidade, dados, ocorrido_em) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
      [terminal.empresa_id, terminal.id, String(e.tipo_evento || e.tipo || 'evento').slice(0, 60), ['info', 'aviso', 'erro'].includes(e.severidade) ? e.severidade : 'info', dados.endsWith('}') ? dados : '{}', quando]);
  }
  return { sucesso: true, gravados: lista.length };
}

export async function listarEventosDoAgente(db, empresaId, { terminalId, limite = 100 } = {}) {
  const r = await db.query('SELECT tipo_evento, severidade, dados, ocorrido_em, recebido_em FROM pdv_eventos_agente WHERE empresa_id = $1 AND terminal_id = $2 ORDER BY recebido_em DESC LIMIT $3',
    [exigirUuid(empresaId, 'empresa'), exigirUuid(terminalId, 'terminal'), Math.min(Math.max(Number(limite) || 100, 1), 300)]);
  return r.rows;
}
