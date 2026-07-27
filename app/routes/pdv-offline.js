/**
 * ============================================================================
 * PDV OFFLINE-FIRST E PERIFÉRICOS — KYTTO ERP
 * ============================================================================
 * O agente local autentica-se por token de terminal. Operações administrativas
 * usam JWT e RBAC da empresa. Nenhum segredo de agente é retornado novamente
 * após o provisionamento ou a rotação do token.
 */

import crypto from 'crypto';
import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIPOS_DISPOSITIVO = new Set(['impressora_termica', 'leitor_codigo_barras', 'balanca', 'gaveta', 'pinpad', 'display_cliente', 'outro']);
const TIPOS_DOCUMENTO = new Set(['comanda', 'pedido_cozinha', 'recibo', 'fechamento_caixa', 'etiqueta', 'relatorio', 'outro']);
const TIPOS_EVENTO_SYNC = new Set(['venda_offline', 'movimento_caixa', 'impressao', 'atualizacao_catalogo', 'outro']);
const TIPOS_FORMA_PAGAMENTO = new Set(['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'cheque', 'vale', 'boleto']);

function normalizarTipoFormaPagamento(valor) {
  const tipo = String(valor || '').trim().toLowerCase();
  const aliases = { tef: 'cartao_credito', cartao: 'cartao_credito', carteira: 'vale' };
  return aliases[tipo] || tipo;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function gerarTokenTerminal() {
  return `kytto_term_${crypto.randomBytes(32).toString('base64url')}`;
}

function idValido(valor) {
  return typeof valor === 'string' && UUID_RE.test(valor);
}

function valorMonetario(valor, campo) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) throw new Error(`${campo} inválido`);
  return Number(numero.toFixed(2));
}

function normalizarQuantidade(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) throw new Error('Quantidade inválida');
  return Number(numero.toFixed(3));
}

function erroDeValidacao(res, mensagem) {
  return res.status(400).json({ erro: mensagem, codigo: 'DADOS_INVALIDOS' });
}

function compararSegredos(esperado, recebido) {
  const a = Buffer.from(esperado || '', 'utf8');
  const b = Buffer.from(recebido || '', 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function autenticarTerminal(req, res, next) {
  try {
    const terminalId = req.get('x-terminal-id');
    const token = req.get('x-terminal-token') || req.get('authorization')?.replace(/^Terminal\s+/i, '');
    if (!idValido(terminalId) || !token) {
      return res.status(401).json({ erro: 'Credencial de terminal ausente', codigo: 'TERMINAL_NAO_AUTENTICADO' });
    }

    const resultado = await dbPg.query(
      `SELECT t.*, l.ativa AS loja_ativa
       FROM terminais_pdv t
       JOIN lojas l ON l.id = t.loja_id
       WHERE t.id = $1 AND t.ativo = true`,
      [terminalId]
    );
    const terminal = resultado.rows[0];
    if (!terminal || !terminal.loja_ativa || !compararSegredos(terminal.token_hash, tokenHash(token))) {
      return res.status(401).json({ erro: 'Terminal inválido ou desativado', codigo: 'TERMINAL_NAO_AUTENTICADO' });
    }

    req.terminal = terminal;
    req.empresaId = terminal.empresa_id;
    req.lojaId = terminal.loja_id;
    next();
  } catch (error) {
    console.error('Erro ao autenticar terminal:', error);
    res.status(500).json({ erro: 'Erro ao validar terminal' });
  }
}

async function obterTerminalDaEmpresa(empresaId, terminalId) {
  const resultado = await dbPg.query(
    `SELECT * FROM terminais_pdv WHERE id = $1 AND empresa_id = $2`,
    [terminalId, empresaId]
  );
  return resultado.rows[0] || null;
}

async function validarLojaDaEmpresa(empresaId, lojaId) {
  const resultado = await dbPg.query(
    `SELECT id FROM lojas WHERE id = $1 AND empresa_id = $2 AND ativa = true`,
    [lojaId, empresaId]
  );
  return resultado.rows.length > 0;
}

async function registrarEventoHardware({ empresaId, lojaId, terminalId = null, dispositivoId = null, tipoEvento, severidade = 'info', dados = {} }) {
  await dbPg.query(
    `INSERT INTO eventos_hardware (empresa_id, loja_id, terminal_id, dispositivo_id, tipo_evento, severidade, dados)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [empresaId, lojaId, terminalId, dispositivoId, tipoEvento, severidade, JSON.stringify(dados)]
  );
}

async function criarConflito(client, { empresaId, lojaId, terminalId, eventoId, tipo, dadosCliente, dadosServidor }) {
  await dbPg.queryInTransaction(
    client,
    `INSERT INTO conflitos_sincronizacao_pdv
      (empresa_id, loja_id, terminal_id, evento_id, tipo_conflito, dados_cliente, dados_servidor)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [empresaId, lojaId, terminalId, eventoId, tipo, JSON.stringify(dadosCliente || {}), JSON.stringify(dadosServidor || {})]
  );
}

/**
 * Aplica uma venda capturada offline. A venda usa um UUID externo e um vínculo
 * terminal+UUID para que uma retransmissão após queda de conexão seja segura.
 */
async function aplicarVendaOffline({ terminal, eventoId, payload }) {
  if (!idValido(payload.id_externo)) throw new Error('id_externo da venda é obrigatório e deve ser UUID');
  if (!idValido(payload.usuario_vendedor_id)) throw new Error('usuario_vendedor_id é obrigatório e deve ser UUID');
  if (!Array.isArray(payload.itens) || payload.itens.length === 0) throw new Error('Venda offline precisa conter ao menos um item');
  if (!Array.isArray(payload.pagamentos) || payload.pagamentos.length === 0) throw new Error('Venda offline precisa conter ao menos um pagamento');

  const client = await dbPg.beginTransaction();
  try {
    const usuario = await dbPg.queryInTransaction(
      client,
      `SELECT id FROM usuarios WHERE id = $1 AND empresa_id = $2 AND ativo = true`,
      [payload.usuario_vendedor_id, terminal.empresa_id]
    );
    if (usuario.rows.length === 0) throw new Error('Operador da venda não pertence à empresa ou está inativo');

    const existente = await dbPg.queryInTransaction(
      client,
      `SELECT id, numero_venda, status, valor_liquido
       FROM vendas WHERE terminal_id = $1 AND id_externo = $2`,
      [terminal.id, payload.id_externo]
    );
    if (existente.rows[0]) {
      await dbPg.commit(client);
      return { venda: existente.rows[0], conflitos: [], repetida: true };
    }

    const itens = payload.itens.map((item) => ({
      produto_id: item.produto_id,
      quantidade: normalizarQuantidade(item.quantidade),
      valor_unitario: valorMonetario(item.valor_unitario, 'Valor unitário'),
      desconto_item: valorMonetario(item.desconto_item || 0, 'Desconto do item'),
      lote: item.lote || null,
      observacoes: item.observacoes || null,
    }));
    if (itens.some((item) => !idValido(item.produto_id))) throw new Error('Produto inválido na venda offline');

    const pagamentos = payload.pagamentos.map((pagamento) => ({
      forma_pagamento_id: idValido(pagamento.forma_pagamento_id) ? pagamento.forma_pagamento_id : null,
      tipo: normalizarTipoFormaPagamento(pagamento.tipo || pagamento.forma_pagamento_tipo),
      valor: valorMonetario(pagamento.valor, 'Valor do pagamento'),
      referencia_externa: pagamento.referencia_externa || null,
      observacoes: pagamento.observacoes || null,
      status: ['pendente', 'aprovado', 'recusado', 'cancelado', 'reembolsado'].includes(pagamento.status) ? pagamento.status : 'aprovado',
    }));
    if (pagamentos.some((pagamento) => !pagamento.forma_pagamento_id && !TIPOS_FORMA_PAGAMENTO.has(pagamento.tipo))) {
      throw new Error('Forma de pagamento inválida');
    }

    const valorBruto = Number(itens.reduce((soma, item) => soma + item.quantidade * item.valor_unitario, 0).toFixed(2));
    const valorDesconto = Number(itens.reduce((soma, item) => soma + item.desconto_item, 0).toFixed(2));
    const valorLiquido = Number((valorBruto - valorDesconto + valorMonetario(payload.valor_acrescimo || 0, 'Acréscimo')).toFixed(2));
    const totalPagamentos = Number(pagamentos.filter((pagamento) => pagamento.status === 'aprovado').reduce((soma, pagamento) => soma + pagamento.valor, 0).toFixed(2));
    if (Math.abs(totalPagamentos - valorLiquido) > 0.01) throw new Error('Pagamentos não conferem com o total da venda offline');

    const numeroVenda = `OFF-${terminal.codigo}-${payload.id_externo.slice(0, 8).toUpperCase()}`;
    const vendaInserida = await dbPg.queryInTransaction(
      client,
      `INSERT INTO vendas
       (empresa_id, loja_id, terminal_id, id_externo, numero_venda, usuario_vendedor_id, tipo_venda, status, valor_bruto, valor_desconto, valor_acrescimo, valor_liquido, observacoes, data_venda)
       VALUES ($1, $2, $3, $4, $5, $6, 'pdv', 'fechada', $7, $8, $9, $10, $11, COALESCE($12::timestamptz, CURRENT_TIMESTAMP))
       RETURNING id, numero_venda, status, valor_liquido`,
      [
        terminal.empresa_id, terminal.loja_id, terminal.id, payload.id_externo, numeroVenda,
        payload.usuario_vendedor_id, valorBruto, valorDesconto, payload.valor_acrescimo || 0,
        valorLiquido, payload.observacoes || 'Venda sincronizada de operação offline', payload.ocorreu_em || null,
      ]
    );
    const venda = vendaInserida.rows[0];
    const conflitos = [];

    for (const item of itens) {
      const produto = await dbPg.queryInTransaction(
        client,
        `SELECT id, nome, ativo FROM produtos WHERE id = $1 AND empresa_id = $2 FOR SHARE`,
        [item.produto_id, terminal.empresa_id]
      );
      if (produto.rows.length === 0 || !produto.rows[0].ativo) throw new Error('Produto não encontrado ou inativo na sincronização offline');

      await dbPg.queryInTransaction(
        client,
        `INSERT INTO itens_venda (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_item, lote, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [venda.id, item.produto_id, item.quantidade, item.valor_unitario, item.quantidade * item.valor_unitario - item.desconto_item, item.desconto_item, item.lote, item.observacoes]
      );

      const estoque = await dbPg.queryInTransaction(
        client,
        `SELECT id, quantidade FROM estoque
         WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3
         ORDER BY data_atualizacao DESC NULLS LAST LIMIT 1 FOR UPDATE`,
        [terminal.empresa_id, terminal.loja_id, item.produto_id]
      );
      const quantidadeAnterior = Number(estoque.rows[0]?.quantidade || 0);
      const quantidadePosterior = Number((quantidadeAnterior - item.quantidade).toFixed(3));
      if (estoque.rows[0]) {
        await dbPg.queryInTransaction(client, `UPDATE estoque SET quantidade = $1, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $2`, [quantidadePosterior, estoque.rows[0].id]);
      } else {
        await dbPg.queryInTransaction(client, `INSERT INTO estoque (empresa_id, loja_id, produto_id, quantidade) VALUES ($1, $2, $3, $4)`, [terminal.empresa_id, terminal.loja_id, item.produto_id, quantidadePosterior]);
      }
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO movimentacoes_estoque (empresa_id, loja_id, produto_id, tipo, quantidade, motivo, usuario_id)
         VALUES ($1, $2, $3, 'saida', $4, $5, $6)`,
        [terminal.empresa_id, terminal.loja_id, item.produto_id, -item.quantidade, `Venda offline ${numeroVenda}`, payload.usuario_vendedor_id]
      );
      if (quantidadePosterior < 0) {
        const conflito = { tipo: 'estoque_negativo_offline', produto_id: item.produto_id, produto_nome: produto.rows[0].nome, quantidade_anterior: quantidadeAnterior, quantidade_vendida: item.quantidade, quantidade_resultante: quantidadePosterior };
        conflitos.push(conflito);
        await criarConflito(client, {
          empresaId: terminal.empresa_id, lojaId: terminal.loja_id, terminalId: terminal.id, eventoId,
          tipo: conflito.tipo, dadosCliente: { item }, dadosServidor: conflito,
        });
      }
    }

    for (const pagamento of pagamentos) {
      const forma = pagamento.forma_pagamento_id
        ? await dbPg.queryInTransaction(
          client,
          `SELECT id FROM formas_pagamento WHERE id = $1 AND empresa_id = $2 AND ativa = true`,
          [pagamento.forma_pagamento_id, terminal.empresa_id]
        )
        : await dbPg.queryInTransaction(
          client,
          `SELECT id FROM formas_pagamento
           WHERE empresa_id = $1 AND tipo = $2 AND ativa = true
           ORDER BY nome ASC LIMIT 1`,
          [terminal.empresa_id, pagamento.tipo]
        );
      if (forma.rows.length === 0) throw new Error('Forma de pagamento não encontrada ou inativa');
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO pagamentos (empresa_id, loja_id, venda_id, forma_pagamento_id, valor, status, referencia_externa, usuario_id, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [terminal.empresa_id, terminal.loja_id, venda.id, forma.rows[0].id, pagamento.valor, pagamento.status, pagamento.referencia_externa, payload.usuario_vendedor_id, pagamento.observacoes]
      );
    }

    await dbPg.commit(client);
    return { venda, conflitos, repetida: false };
  } catch (error) {
    await dbPg.rollback(client);
    throw error;
  }
}

/** GET /pdv-offline/terminais — Terminais da empresa atual. */
router.get('/terminais', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `SELECT t.*, l.nome AS loja_nome,
        (SELECT COUNT(*)::int FROM dispositivos_perifericos d WHERE d.terminal_id = t.id AND d.ativo = true) AS total_dispositivos
       FROM terminais_pdv t JOIN lojas l ON l.id = t.loja_id
       WHERE t.empresa_id = $1
       ORDER BY l.nome, t.nome`,
      [req.empresaId]
    );
    res.json({ sucesso: true, terminais: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar terminais:', error);
    res.status(500).json({ erro: 'Erro ao listar terminais' });
  }
});

/** POST /pdv-offline/terminais — Provisiona um terminal e entrega token uma única vez. */
router.post('/terminais', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const { loja_id, codigo, nome, identificador_dispositivo = null, modo_offline_habilitado = true, configuracoes = {} } = req.body;
    if (!idValido(loja_id) || !codigo?.trim() || !nome?.trim()) return erroDeValidacao(res, 'loja_id, código e nome são obrigatórios');
    if (!(await validarLojaDaEmpresa(req.empresaId, loja_id))) return res.status(404).json({ erro: 'Loja não encontrada ou inativa' });
    if (!/^[A-Za-z0-9_-]{2,60}$/.test(codigo)) return erroDeValidacao(res, 'Código de terminal inválido');

    const token = gerarTokenTerminal();
    const resultado = await dbPg.query(
      `INSERT INTO terminais_pdv (empresa_id, loja_id, codigo, nome, identificador_dispositivo, token_hash, modo_offline_habilitado, configuracoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING *`,
      [req.empresaId, loja_id, codigo.trim().toUpperCase(), nome.trim(), identificador_dispositivo || null, tokenHash(token), Boolean(modo_offline_habilitado), JSON.stringify(configuracoes || {})]
    );
    await dbPg.registrarAuditoria({ empresa_id: req.empresaId, loja_id, usuario_id: req.usuario.usuario_id, tabela: 'terminais_pdv', operacao: 'INSERT', registro_id: resultado.rows[0].id, dados_novo: { codigo, nome } });
    res.status(201).json({ sucesso: true, terminal: resultado.rows[0], token_provisionamento: token, aviso: 'Armazene o token agora; ele não será exibido novamente.' });
  } catch (error) {
    console.error('Erro ao provisionar terminal:', error);
    if (error.code === '23505') return res.status(409).json({ erro: 'Código ou identificador de terminal já utilizado' });
    res.status(500).json({ erro: 'Erro ao provisionar terminal' });
  }
});

/** PATCH /pdv-offline/terminais/:id — Atualiza metadados, sem expor token. */
router.patch('/terminais/:id', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const terminal = await obterTerminalDaEmpresa(req.empresaId, req.params.id);
    if (!terminal) return res.status(404).json({ erro: 'Terminal não encontrado' });
    if (req.usuario.role !== 'admin' && !req.lojasAcessiveis.some((loja) => loja.id === terminal.loja_id)) return res.status(403).json({ erro: 'Sem acesso à loja do terminal' });
    const camposPermitidos = ['nome', 'identificador_dispositivo', 'modo_offline_habilitado', 'ativo', 'configuracoes'];
    const dados = Object.fromEntries(Object.entries(req.body || {}).filter(([campo, valor]) => camposPermitidos.includes(campo) && valor !== undefined));
    if (Object.keys(dados).length === 0) return erroDeValidacao(res, 'Nenhum campo permitido foi informado');
    const campos = Object.keys(dados);
    const valores = campos.map((campo) => campo === 'configuracoes' ? JSON.stringify(dados[campo]) : dados[campo]);
    const set = campos.map((campo, indice) => `${campo} = $${indice + 1}${campo === 'configuracoes' ? '::jsonb' : ''}`).join(', ');
    valores.push(terminal.id, req.empresaId);
    const atualizado = await dbPg.query(`UPDATE terminais_pdv SET ${set}, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $${campos.length + 1} AND empresa_id = $${campos.length + 2} RETURNING *`, valores);
    res.json({ sucesso: true, terminal: atualizado.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar terminal:', error);
    res.status(500).json({ erro: 'Erro ao atualizar terminal' });
  }
});

/** POST /pdv-offline/terminais/:id/rotacionar-token — invalida credenciais anteriores. */
router.post('/terminais/:id/rotacionar-token', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const terminal = await obterTerminalDaEmpresa(req.empresaId, req.params.id);
    if (!terminal) return res.status(404).json({ erro: 'Terminal não encontrado' });
    const token = gerarTokenTerminal();
    await dbPg.query(`UPDATE terminais_pdv SET token_hash = $1, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $2`, [tokenHash(token), terminal.id]);
    await dbPg.registrarAuditoria({ empresa_id: req.empresaId, loja_id: terminal.loja_id, usuario_id: req.usuario.usuario_id, tabela: 'terminais_pdv', operacao: 'ROTATE_TOKEN', registro_id: terminal.id, dados_novo: { motivo: 'Rotação manual de credencial' } });
    res.json({ sucesso: true, token_provisionamento: token, aviso: 'A credencial anterior foi revogada.' });
  } catch (error) {
    console.error('Erro ao rotacionar token:', error);
    res.status(500).json({ erro: 'Erro ao rotacionar credencial do terminal' });
  }
});

/** GET /pdv-offline/dispositivos — Lista periféricos da loja atual. */
router.get('/dispositivos', autenticar, autorizar('admin', 'gerente', 'caixa', 'operador'), async (req, res) => {
  try {
    const lojaId = req.query.loja_id || req.lojaId;
    if (!idValido(lojaId) || !req.lojasAcessiveis.some((loja) => loja.id === lojaId)) return res.status(403).json({ erro: 'Sem acesso à loja solicitada' });
    const resultado = await dbPg.query(
      `SELECT d.*, t.codigo AS terminal_codigo, t.nome AS terminal_nome
       FROM dispositivos_perifericos d
       LEFT JOIN terminais_pdv t ON t.id = d.terminal_id
       WHERE d.empresa_id = $1 AND d.loja_id = $2
       ORDER BY d.tipo, d.nome`,
      [req.empresaId, lojaId]
    );
    res.json({ sucesso: true, dispositivos: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar dispositivos:', error);
    res.status(500).json({ erro: 'Erro ao listar dispositivos' });
  }
});

/** POST /pdv-offline/dispositivos — Cadastra periférico associado a terminal. */
router.post('/dispositivos', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { loja_id = req.lojaId, terminal_id = null, tipo, nome, fabricante = null, modelo = null, endereco_conexao = null, configuracoes = {} } = req.body;
    if (!idValido(loja_id) || !TIPOS_DISPOSITIVO.has(tipo) || !nome?.trim()) return erroDeValidacao(res, 'Loja, tipo de dispositivo e nome são obrigatórios');
    if (!req.lojasAcessiveis.some((loja) => loja.id === loja_id)) return res.status(403).json({ erro: 'Sem acesso à loja solicitada' });
    if (terminal_id) {
      const terminal = await obterTerminalDaEmpresa(req.empresaId, terminal_id);
      if (!terminal || terminal.loja_id !== loja_id) return erroDeValidacao(res, 'Terminal não pertence à loja informada');
    }
    const resultado = await dbPg.query(
      `INSERT INTO dispositivos_perifericos (empresa_id, loja_id, terminal_id, tipo, nome, fabricante, modelo, endereco_conexao, configuracoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) RETURNING *`,
      [req.empresaId, loja_id, terminal_id, tipo, nome.trim(), fabricante, modelo, endereco_conexao, JSON.stringify(configuracoes || {})]
    );
    res.status(201).json({ sucesso: true, dispositivo: resultado.rows[0] });
  } catch (error) {
    console.error('Erro ao cadastrar dispositivo:', error);
    res.status(500).json({ erro: 'Erro ao cadastrar dispositivo' });
  }
});

/** POST /pdv-offline/impressao — Enfileira impressão idempotente para agente local. */
router.post('/impressao', autenticar, autorizar('admin', 'gerente', 'caixa', 'operador', 'vendedor', 'garcom'), async (req, res) => {
  try {
    const { terminal_id = null, dispositivo_id = null, tipo_documento, conteudo, prioridade = 5, chave_idempotencia } = req.body;
    if (!TIPOS_DOCUMENTO.has(tipo_documento) || !conteudo || !idValido(chave_idempotencia)) return erroDeValidacao(res, 'Tipo, conteúdo e chave idempotente válidos são obrigatórios');
    if (terminal_id) {
      const terminal = await obterTerminalDaEmpresa(req.empresaId, terminal_id);
      if (!terminal || terminal.loja_id !== req.lojaId) return erroDeValidacao(res, 'Terminal não pertence à loja ativa');
    }
    if (dispositivo_id) {
      const dispositivo = await dbPg.query(`SELECT id FROM dispositivos_perifericos WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND ativo = true`, [dispositivo_id, req.empresaId, req.lojaId]);
      if (dispositivo.rows.length === 0) return erroDeValidacao(res, 'Dispositivo não pertence à loja ativa ou está inativo');
    }
    const resultado = await dbPg.query(
      `INSERT INTO fila_impressao_local (empresa_id, loja_id, terminal_id, dispositivo_id, tipo_documento, conteudo, prioridade, chave_idempotencia)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (empresa_id, chave_idempotencia) DO UPDATE SET chave_idempotencia = EXCLUDED.chave_idempotencia
       RETURNING *`,
      [req.empresaId, req.lojaId, terminal_id, dispositivo_id, tipo_documento, JSON.stringify(conteudo), Math.min(10, Math.max(1, Number(prioridade) || 5)), chave_idempotencia]
    );
    res.status(202).json({ sucesso: true, trabalho: resultado.rows[0] });
  } catch (error) {
    console.error('Erro ao enfileirar impressão:', error);
    res.status(500).json({ erro: 'Erro ao enfileirar impressão' });
  }
});

/** POST /pdv-offline/terminal/heartbeat — Estado do agente local. */
router.post('/terminal/heartbeat', autenticarTerminal, async (req, res) => {
  try {
    const { versao_agente = null, dispositivos = [] } = req.body || {};
    await dbPg.query(`UPDATE terminais_pdv SET ultimo_heartbeat_em = CURRENT_TIMESTAMP, versao_agente = COALESCE($1, versao_agente), data_atualizacao = CURRENT_TIMESTAMP WHERE id = $2`, [versao_agente, req.terminal.id]);
    for (const estado of Array.isArray(dispositivos) ? dispositivos : []) {
      if (!idValido(estado.id)) continue;
      await dbPg.query(
        `UPDATE dispositivos_perifericos SET ultimo_status = $1, ultimo_status_em = CURRENT_TIMESTAMP, data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $2 AND terminal_id = $3`,
        [['online', 'offline', 'erro', 'desconhecido'].includes(estado.status) ? estado.status : 'desconhecido', estado.id, req.terminal.id]
      );
    }
    res.json({ sucesso: true, servidor_em: new Date().toISOString() });
  } catch (error) {
    console.error('Erro no heartbeat do terminal:', error);
    res.status(500).json({ erro: 'Erro ao registrar heartbeat' });
  }
});

/** GET /pdv-offline/terminal/fila-impressao — O agente reserva o próximo trabalho. */
router.get('/terminal/fila-impressao', autenticarTerminal, async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const proximo = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM fila_impressao_local
       WHERE empresa_id = $1 AND loja_id = $2
         AND (terminal_id IS NULL OR terminal_id = $3)
         AND status = 'pendente'
       ORDER BY prioridade DESC, data_criacao
       FOR UPDATE SKIP LOCKED LIMIT 1`,
      [req.empresaId, req.lojaId, req.terminal.id]
    );
    if (proximo.rows.length === 0) {
      await dbPg.commit(client);
      return res.status(204).send();
    }
    const trabalho = (await dbPg.queryInTransaction(
      client,
      `UPDATE fila_impressao_local SET status = 'em_processamento', tentativas = tentativas + 1, processado_em = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [proximo.rows[0].id]
    )).rows[0];
    await dbPg.commit(client);
    res.json({ sucesso: true, trabalho });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao reservar trabalho de impressão:', error);
    res.status(500).json({ erro: 'Erro ao consultar fila local' });
  }
});

/** POST /pdv-offline/terminal/fila-impressao/:id/resultado — Confirma impressão ou falha. */
router.post('/terminal/fila-impressao/:id/resultado', autenticarTerminal, async (req, res) => {
  try {
    const { sucesso, erro = null } = req.body || {};
    if (typeof sucesso !== 'boolean') return erroDeValidacao(res, 'O campo sucesso é obrigatório');
    const resultado = await dbPg.query(
      `UPDATE fila_impressao_local
       SET status = CASE WHEN $1 THEN 'concluido' WHEN tentativas >= max_tentativas THEN 'falha' ELSE 'pendente' END,
           concluido_em = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
           erro_ultima_tentativa = CASE WHEN $1 THEN NULL ELSE $2 END
       WHERE id = $3 AND empresa_id = $4 AND loja_id = $5 AND (terminal_id IS NULL OR terminal_id = $6)
         AND status = 'em_processamento'
       RETURNING *`,
      [sucesso, erro ? String(erro).slice(0, 2000) : null, req.params.id, req.empresaId, req.lojaId, req.terminal.id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ erro: 'Trabalho não encontrado ou não reservado por este terminal' });
    await registrarEventoHardware({ empresaId: req.empresaId, lojaId: req.lojaId, terminalId: req.terminal.id, dispositivoId: resultado.rows[0].dispositivo_id, tipoEvento: sucesso ? 'impressao_concluida' : 'impressao_falhou', severidade: sucesso ? 'info' : 'erro', dados: { trabalho_id: resultado.rows[0].id, erro } });
    res.json({ sucesso: true, trabalho: resultado.rows[0] });
  } catch (error) {
    console.error('Erro ao registrar resultado de impressão:', error);
    res.status(500).json({ erro: 'Erro ao registrar impressão' });
  }
});

/** POST /pdv-offline/terminal/eventos — Telemetria de hardware do agente. */
router.post('/terminal/eventos', autenticarTerminal, async (req, res) => {
  try {
    const { eventos } = req.body || {};
    if (!Array.isArray(eventos) || eventos.length === 0 || eventos.length > 100) return erroDeValidacao(res, 'Informe entre 1 e 100 eventos');
    for (const evento of eventos) {
      await registrarEventoHardware({
        empresaId: req.empresaId, lojaId: req.lojaId, terminalId: req.terminal.id,
        dispositivoId: idValido(evento.dispositivo_id) ? evento.dispositivo_id : null,
        tipoEvento: String(evento.tipo_evento || 'evento_agente').slice(0, 60),
        severidade: ['debug', 'info', 'aviso', 'erro', 'critico'].includes(evento.severidade) ? evento.severidade : 'info',
        dados: evento.dados || {},
      });
    }
    res.status(202).json({ sucesso: true, recebidos: eventos.length });
  } catch (error) {
    console.error('Erro ao registrar eventos de hardware:', error);
    res.status(500).json({ erro: 'Erro ao registrar eventos do terminal' });
  }
});

/** POST /pdv-offline/sincronizar — Recebe lote ordenado de operações offline. */
router.post('/sincronizar', autenticarTerminal, async (req, res) => {
  try {
    const { lote_cliente_id, versao_cliente = null, eventos } = req.body || {};
    if (!idValido(lote_cliente_id) || !Array.isArray(eventos) || eventos.length === 0 || eventos.length > 200) return erroDeValidacao(res, 'Lote UUID e entre 1 e 200 eventos são obrigatórios');
    if (eventos.some((evento) => !idValido(evento.id) || !Number.isInteger(evento.sequencia) || !TIPOS_EVENTO_SYNC.has(evento.tipo))) return erroDeValidacao(res, 'Há evento com id, sequência ou tipo inválido');

    const loteAnterior = await dbPg.query(`SELECT * FROM lotes_sincronizacao_pdv WHERE terminal_id = $1 AND lote_cliente_id = $2`, [req.terminal.id, lote_cliente_id]);
    if (loteAnterior.rows[0]?.status === 'processado') {
      const resultados = await dbPg.query(`SELECT evento_cliente_id, sequencia_cliente, status, resultado FROM eventos_sincronizacao_pdv WHERE lote_id = $1 ORDER BY sequencia_cliente`, [loteAnterior.rows[0].id]);
      return res.json({ sucesso: true, repetido: true, lote: loteAnterior.rows[0], eventos: resultados.rows });
    }

    const lote = loteAnterior.rows[0] || (await dbPg.query(
      `INSERT INTO lotes_sincronizacao_pdv (empresa_id, loja_id, terminal_id, lote_cliente_id, versao_cliente, status, total_eventos)
       VALUES ($1, $2, $3, $4, $5, 'processando', $6) RETURNING *`,
      [req.empresaId, req.lojaId, req.terminal.id, lote_cliente_id, versao_cliente, eventos.length]
    )).rows[0];

    const resultados = [];
    let processados = 0;
    let conflitos = 0;
    for (const evento of [...eventos].sort((a, b) => a.sequencia - b.sequencia)) {
      let registro = await dbPg.query(
        `SELECT * FROM eventos_sincronizacao_pdv WHERE terminal_id = $1 AND evento_cliente_id = $2`,
        [req.terminal.id, evento.id]
      );
      if (registro.rows[0]?.status === 'processado') {
        resultados.push({ id: evento.id, sequencia: evento.sequencia, status: 'processado', resultado: registro.rows[0].resultado, repetido: true });
        processados++;
        continue;
      }
      if (!registro.rows[0]) {
        registro = await dbPg.query(
          `INSERT INTO eventos_sincronizacao_pdv (lote_id, empresa_id, loja_id, terminal_id, evento_cliente_id, sequencia_cliente, tipo, payload, criado_no_cliente_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz) RETURNING *`,
          [lote.id, req.empresaId, req.lojaId, req.terminal.id, evento.id, evento.sequencia, evento.tipo, JSON.stringify(evento.payload || {}), evento.criado_em || null]
        );
      }
      const eventoDb = registro.rows[0];
      try {
        let resultado = { recebido: true };
        let houveConflito = false;
        if (evento.tipo === 'venda_offline') {
          const aplicado = await aplicarVendaOffline({ terminal: req.terminal, eventoId: eventoDb.id, payload: evento.payload || {} });
          resultado = aplicado;
          houveConflito = aplicado.conflitos.length > 0;
        }
        const status = houveConflito ? 'conflito' : 'processado';
        await dbPg.query(`UPDATE eventos_sincronizacao_pdv SET status = $1, resultado = $2::jsonb, processado_em = CURRENT_TIMESTAMP WHERE id = $3`, [status, JSON.stringify(resultado), eventoDb.id]);
        resultados.push({ id: evento.id, sequencia: evento.sequencia, status, resultado });
        processados++;
        if (houveConflito) conflitos++;
      } catch (error) {
        const resultado = { erro: error.message || 'Erro ao processar evento' };
        await dbPg.query(`UPDATE eventos_sincronizacao_pdv SET status = 'falha', resultado = $1::jsonb, processado_em = CURRENT_TIMESTAMP WHERE id = $2`, [JSON.stringify(resultado), eventoDb.id]);
        resultados.push({ id: evento.id, sequencia: evento.sequencia, status: 'falha', resultado });
      }
    }

    const statusLote = resultados.some((resultado) => resultado.status === 'falha') ? (processados === 0 ? 'falha' : 'parcial') : 'processado';
    const loteAtualizado = (await dbPg.query(
      `UPDATE lotes_sincronizacao_pdv
       SET status = $1, eventos_processados = $2, eventos_com_conflito = $3, processado_em = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [statusLote, processados, conflitos, lote.id]
    )).rows[0];
    await dbPg.query(`UPDATE terminais_pdv SET ultima_sincronizacao_em = CURRENT_TIMESTAMP, ultimo_heartbeat_em = CURRENT_TIMESTAMP WHERE id = $1`, [req.terminal.id]);
    res.json({ sucesso: statusLote !== 'falha', lote: loteAtualizado, eventos: resultados });
  } catch (error) {
    console.error('Erro na sincronização offline:', error);
    res.status(500).json({ erro: 'Erro ao sincronizar PDV offline' });
  }
});

/** GET /pdv-offline/conflitos — Painel de conflitos de sincronização da loja ativa. */
router.get('/conflitos', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `SELECT c.*, t.codigo AS terminal_codigo, t.nome AS terminal_nome
       FROM conflitos_sincronizacao_pdv c
       JOIN terminais_pdv t ON t.id = c.terminal_id
       WHERE c.empresa_id = $1 AND c.loja_id = $2 AND c.resolucao = COALESCE($3, c.resolucao)
       ORDER BY c.data_criacao DESC LIMIT 200`,
      [req.empresaId, req.lojaId, req.query.resolucao || null]
    );
    res.json({ sucesso: true, conflitos: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar conflitos:', error);
    res.status(500).json({ erro: 'Erro ao listar conflitos' });
  }
});

/** PATCH /pdv-offline/conflitos/:id — Registra a decisão humana de reconciliação. */
router.patch('/conflitos/:id', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { resolucao } = req.body || {};
    if (!['aceito_cliente', 'aceito_servidor', 'mesclado', 'descartado'].includes(resolucao)) return erroDeValidacao(res, 'Resolução inválida');
    const atualizado = await dbPg.query(
      `UPDATE conflitos_sincronizacao_pdv
       SET resolucao = $1, resolvido_por = $2, resolvido_em = CURRENT_TIMESTAMP
       WHERE id = $3 AND empresa_id = $4 AND loja_id = $5 AND resolucao = 'pendente'
       RETURNING *`,
      [resolucao, req.usuario.usuario_id, req.params.id, req.empresaId, req.lojaId]
    );
    if (atualizado.rows.length === 0) return res.status(404).json({ erro: 'Conflito pendente não encontrado' });
    res.json({ sucesso: true, conflito: atualizado.rows[0] });
  } catch (error) {
    console.error('Erro ao resolver conflito:', error);
    res.status(500).json({ erro: 'Erro ao resolver conflito' });
  }
});

export default router;
