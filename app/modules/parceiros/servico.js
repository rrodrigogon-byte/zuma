// Wellhub e TotalPass (item 2 da especificação Kytto Clube & Academia).
// Fluxo: check-in no app da plataforma → webhook → cadastro automático na 1ª visita → passe de
// entrada (facial já cadastrada ou link com QR) → catraca libera → validação na plataforma só de
// quem passou → nova tentativa por 15 min → pendência de retroativo já preenchida.
import { createHash, randomBytes } from 'node:crypto';
import { ErroDominio, transacao, exigirUuid, exigirTexto } from '../acesso/banco.js';
import * as acesso from '../acesso/repositorio.js';
import { gerarQrDinamico } from '../acesso/qr.js';
import { ADAPTADORES, cifrar, decifrar, hmacDocumento } from './adaptadores.js';
import { resolveCommerceCustomer, normalizeBrazilianPhone, normalizeCustomerEmail } from '../../core/commerce-customer-identity.js';

const sha256 = (t) => createHash('sha256').update(String(t)).digest('hex');
const MIN_MS = 60000;
const JANELA_VALIDACAO_MS = 15 * MIN_MS;
export const PLATAFORMAS = ['wellhub', 'totalpass'];
const NOME_PLATAFORMA = { wellhub: 'Wellhub', totalpass: 'TotalPass' };

const WEBHOOK_RATE_LIMIT = 60;
const WEBHOOK_WINDOW_MS = 60 * 1000;

function webhookQueryForTransaction(transaction) {
  if (typeof transaction === 'function') return transaction;
  if (transaction && typeof transaction.query === 'function') return transaction.query.bind(transaction);
  throw new ErroDominio('WEBHOOK_GATE_UNAVAILABLE', 'Controle de webhook indisponível', 503);
}

/**
 * Executa a operação na API moderna `db.transaction`; a ponte legada só é usada
 * enquanto a ligação do servidor ainda expõe beginTransaction/queryInTransaction.
 * Em ambos os casos não existe estado de processo para o rate limit.
 */
function transacaoWebhook(db, fn) {
  if (typeof db?.transaction === 'function') {
    return db.transaction(async (transaction) => fn(webhookQueryForTransaction(transaction)));
  }
  if (typeof db?.beginTransaction === 'function') return transacao(db, fn);
  throw new ErroDominio('WEBHOOK_GATE_UNAVAILABLE', 'Controle de webhook indisponível', 503);
}

function codigoErroWebhook(error) {
  const codigo = String(error?.code || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80);
  return codigo || 'WEBHOOK_PROCESSING_FAILED';
}

function textoWebhook(valor, campo, limite = 180) {
  const texto = String(valor ?? '').trim();
  if (!texto || texto.length > limite) throw new ErroDominio('PAYLOAD_INVALIDO', `${campo} inválido`, 400);
  return texto;
}

/**
 * Gate atômico de webhooks. Só grava hash, identificadores e escopo em
 * dino_webhook_events; nunca recebe nem persiste o corpo da requisição.
 *
 * O retorno do gate possui `complete({ status, error })`, usado pela rota para
 * fechar a evidência como processed/failed depois do efeito de negócio.
 */
export function createWebhookGate(db) {
  return async function webhookGate({
    provider,
    providerAccountId,
    providerEventId,
    eventHash,
    empresaId = null,
    lojaId = null,
    agora = new Date(),
    production = false,
  } = {}) {
    const provedor = textoWebhook(provider, 'provider', 80).toLowerCase();
    const conta = textoWebhook(providerAccountId, 'provider account', 180);
    const evento = textoWebhook(providerEventId, 'provider event', 180);
    const hash = textoWebhook(eventHash, 'event hash', 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new ErroDominio('PAYLOAD_INVALIDO', 'hash de evento inválido', 400);
    if (production && !lojaId) throw new ErroDominio('WEBHOOK_SCOPE_REQUIRED', 'Escopo de unidade ausente', 503);
    const recebidoEm = agora instanceof Date && !Number.isNaN(agora.getTime()) ? agora : new Date();
    const chave = `dino-webhook:${provedor}:${conta}:${evento}`;
    const resultado = await transacaoWebhook(db, async (q) => {
      await q('SELECT pg_advisory_xact_lock(hashtext($1))', [chave]);

      // A consulta é deliberadamente sem o hash: o mesmo event id com outro
      // corpo precisa ser distinguido como conflito, não como um novo evento.
      const existente = await q(
        `SELECT id, event_hash, status FROM dino_webhook_events
          WHERE provider = $1 AND provider_account_id = $2 AND provider_event_id = $3
          ORDER BY recebido_em DESC LIMIT 1`,
        [provedor, conta, evento],
      );
      if (existente.rows[0]) {
        if (String(existente.rows[0].event_hash).toLowerCase() !== hash) {
          throw new ErroDominio('WEBHOOK_EVENT_CONFLICT', 'Evento de webhook divergente', 409);
        }
        return { duplicado: true, eventDbId: existente.rows[0].id };
      }

      const limite = await q(
        `SELECT COUNT(*)::int AS total FROM dino_webhook_events
          WHERE provider = $1 AND provider_account_id = $2
            AND recebido_em >= $3::timestamptz - INTERVAL '60 seconds'`,
        [provedor, conta, recebidoEm],
      );
      if (Number(limite.rows[0]?.total || 0) >= WEBHOOK_RATE_LIMIT) {
        throw Object.assign(new ErroDominio('WEBHOOK_RATE_LIMIT', 'Muitas solicitações de webhook', 429), { retryAfterSeconds: 60 });
      }

      const inserido = await q(
        `INSERT INTO dino_webhook_events
          (provider, provider_account_id, provider_event_id, event_hash, status, empresa_id, loja_id, recebido_em)
         VALUES ($1, $2, $3, $4, 'received', $5, $6, $7)
         RETURNING id`,
        [provedor, conta, evento, hash, empresaId || null, lojaId || null, recebidoEm],
      );
      return { duplicado: false, eventDbId: inserido.rows[0]?.id || null };
    });

    if (resultado.duplicado) return { ...resultado, duplicado: true };

    const complete = async ({ status = 'processed', error = null } = {}) => {
      const finalStatus = status === 'failed' ? 'failed' : 'processed';
      const saneado = finalStatus === 'failed' ? codigoErroWebhook(error) : null;
      await transacaoWebhook(db, async (q) => {
        const where = resultado.eventDbId
          ? 'id = $1'
          : 'provider = $1 AND provider_account_id = $2 AND provider_event_id = $3 AND event_hash = $4';
        const params = resultado.eventDbId
          ? [resultado.eventDbId, finalStatus, saneado]
          : [provedor, conta, evento, hash, finalStatus, saneado];
        const offset = resultado.eventDbId ? 2 : 5;
        await q(
          `UPDATE dino_webhook_events
              SET status = $${offset}, erro = $${offset + 1}, processado_em = CURRENT_TIMESTAMP
            WHERE ${where} AND status IN ('received', 'processing')`,
          params,
        );
      });
    };
    return { ...resultado, aceito: true, complete };
  };
}

// Alias no padrão de nomes do módulo e para facilitar injeção por testes.
export const criarWebhookGate = createWebhookGate;

/* ------------------------------------------------------------------ */
/* Contas da academia nas plataformas                                  */
/* ------------------------------------------------------------------ */

function contaPublica(c) {
  return {
    id: c.id, plataforma: c.plataforma, nome: c.nome, idExterno: c.id_externo, unidadeId: c.unidade_id, modo: c.modo,
    ambiente: c.ambiente, validadeMin: c.validade_min, ativo: c.ativo, temCredencial: Boolean(c.credencial_cifrada),
    verificada: c.verificada, verificadaEm: c.verificada_em, ultimoWebhookEm: c.ultimo_webhook_em, criadoEm: c.criado_em,
  };
}

function urlWebhook(urlPublica, plataforma, segredo) {
  return `${String(urlPublica || '').replace(/\/$/, '')}/api/integracoes/${plataforma}/webhook/${segredo}`;
}

function validarDadosConta(dados, { criando }) {
  const out = {};
  if (criando || dados.plataforma !== undefined) {
    if (!PLATAFORMAS.includes(dados.plataforma)) throw new ErroDominio('VALIDATION_ERROR', 'plataforma deve ser wellhub ou totalpass');
    out.plataforma = dados.plataforma;
  }
  if (criando || dados.nome !== undefined) out.nome = exigirTexto(dados.nome || NOME_PLATAFORMA[dados.plataforma], 'nome', { max: 120 });
  if (criando || dados.idExterno !== undefined) {
    out.idExterno = exigirTexto(dados.idExterno, dados.plataforma === 'wellhub' ? 'Gym ID' : 'código da unidade', { max: 80 });
    if (!/^[\w.-]+$/.test(out.idExterno)) throw new ErroDominio('VALIDATION_ERROR', 'identificador da unidade inválido');
  }
  if (dados.modo !== undefined) {
    if (!['catraca', 'sem_catraca'].includes(dados.modo)) throw new ErroDominio('VALIDATION_ERROR', 'modo deve ser catraca ou sem_catraca');
    out.modo = dados.modo;
  }
  if (dados.ambiente !== undefined) {
    if (!['sandbox', 'producao'].includes(dados.ambiente)) throw new ErroDominio('VALIDATION_ERROR', 'ambiente deve ser sandbox ou producao');
    out.ambiente = dados.ambiente;
  }
  if (dados.validadeMin !== undefined) {
    const n = Number(dados.validadeMin);
    if (!Number.isInteger(n) || n < 5 || n > 240) throw new ErroDominio('VALIDATION_ERROR', 'validadeMin entre 5 e 240');
    out.validadeMin = n;
  }
  if (dados.credencial !== undefined && dados.credencial !== null && dados.credencial !== '') {
    out.credencial = exigirTexto(dados.credencial, 'credencial', { min: 8, max: 400 });
  }
  if (dados.unidadeId !== undefined) out.unidadeId = dados.unidadeId ? exigirUuid(dados.unidadeId, 'unidade') : null;
  return out;
}

/** Cria a conta e devolve a URL do webhook com o segredo UMA vez (só o hash fica no banco). */
export async function criarConta(db, empresaId, dados = {}, { urlPublica = '' } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const d = validarDadosConta(dados, { criando: true });
  if (d.plataforma === 'totalpass' && !d.credencial) throw new ErroDominio('VALIDATION_ERROR', 'Cole a place_api_key da unidade TotalPass');
  const segredo = randomBytes(24).toString('base64url');
  try {
    const r = await db.query(
      `INSERT INTO clube_parceiro_contas (empresa_id, unidade_id, plataforma, nome, id_externo, credencial_cifrada, webhook_segredo_hash, modo, ambiente, validade_min)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [empresa, d.unidadeId || null, d.plataforma, d.nome, d.idExterno, d.credencial ? cifrar(d.credencial) : null, sha256(segredo),
        d.modo || 'catraca', d.ambiente || 'sandbox', d.validadeMin || 20],
    );
    return { conta: contaPublica(r.rows[0]), webhookUrl: urlWebhook(urlPublica, d.plataforma, segredo) };
  } catch (error) {
    // só a própria empresa colide aqui (a unicidade global vale apenas para contas verificadas,
    // e a mensagem não revela se outra academia usa o mesmo identificador)
    if (error.code === '23505') throw new ErroDominio('CONTA_EXISTE', 'Esta unidade já está conectada nesta academia.', 409);
    throw error;
  }
}

export async function listarContas(db, empresaId) {
  const r = await db.query('SELECT * FROM clube_parceiro_contas WHERE empresa_id = $1 ORDER BY plataforma, nome', [exigirUuid(empresaId, 'empresa')]);
  return r.rows.map(contaPublica);
}

export async function atualizarConta(db, empresaId, id, dados = {}) {
  const d = validarDadosConta(dados, { criando: false });
  const r = await db.query(
    `UPDATE clube_parceiro_contas SET nome = COALESCE($3, nome), modo = COALESCE($4, modo), ambiente = COALESCE($5, ambiente),
            validade_min = COALESCE($6, validade_min), credencial_cifrada = COALESCE($7, credencial_cifrada),
            ativo = COALESCE($8, ativo)
      WHERE empresa_id = $1 AND id = $2 RETURNING *`,
    [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'conta'), d.nome ?? null, d.modo ?? null, d.ambiente ?? null, d.validadeMin ?? null,
      d.credencial ? cifrar(d.credencial) : null, dados.ativo === undefined ? null : Boolean(dados.ativo)],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Conta não encontrada', 404);
  return contaPublica(r.rows[0]);
}

export async function girarSegredo(db, empresaId, id, { urlPublica = '' } = {}) {
  const segredo = randomBytes(24).toString('base64url');
  const r = await db.query(
    'UPDATE clube_parceiro_contas SET webhook_segredo_hash = $3 WHERE empresa_id = $1 AND id = $2 RETURNING plataforma',
    [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'conta'), sha256(segredo)],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Conta não encontrada', 404);
  return { webhookUrl: urlWebhook(urlPublica, r.rows[0].plataforma, segredo) };
}

export async function contaPorSegredo(db, plataforma, segredo) {
  if (!segredo || String(segredo).length < 20) return null;
  const r = await db.query('SELECT * FROM clube_parceiro_contas WHERE plataforma = $1 AND webhook_segredo_hash = $2 AND ativo', [plataforma, sha256(segredo)]);
  return r.rows[0] || null;
}

/** URL única do Wellhub: só contas com posse comprovada (verificadas). */
export async function contaPorIdExterno(db, plataforma, idExterno) {
  const r = await db.query('SELECT * FROM clube_parceiro_contas WHERE plataforma = $1 AND id_externo = $2 AND ativo AND verificada', [plataforma, String(idExterno)]);
  return r.rows[0] || null;
}

/**
 * 1º webhook válido na URL com segredo comprova a posse (só o dono cadastra a URL no portal da
 * plataforma). Se outra academia já verificou o mesmo identificador, esta conta fica sem verificar.
 */
export async function marcarVerificada(db, conta, agora = new Date()) {
  if (conta.verificada) return conta;
  try {
    const r = await db.query('UPDATE clube_parceiro_contas SET verificada = true, verificada_em = $2 WHERE id = $1 AND NOT verificada RETURNING *', [conta.id, agora]);
    return r.rows[0] || conta;
  } catch (error) {
    if (error.code === '23505') {
      const e = new ErroDominio('CONTA_EM_USO', 'Este identificador já está verificado em outra conta. Fale com o suporte do Kytto.', 409);
      throw e;
    }
    throw error;
  }
}

export async function salvarValor(db, empresaId, { plataforma, produto = '*', valor }) {
  if (!PLATAFORMAS.includes(plataforma)) throw new ErroDominio('VALIDATION_ERROR', 'plataforma inválida');
  const v = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(v) || v < 0 || v > 10000) throw new ErroDominio('VALIDATION_ERROR', 'valor inválido');
  const p = exigirTexto(produto || '*', 'produto', { max: 80 });
  await db.query(
    `INSERT INTO clube_parceiro_valores (empresa_id, plataforma, produto, valor) VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, plataforma, produto) DO UPDATE SET valor = EXCLUDED.valor`,
    [exigirUuid(empresaId, 'empresa'), plataforma, p, Math.round(v * 100) / 100],
  );
  return listarValores(db, empresaId);
}

export async function listarValores(db, empresaId) {
  const r = await db.query('SELECT plataforma, produto, valor::float AS valor FROM clube_parceiro_valores WHERE empresa_id = $1 ORDER BY plataforma, produto', [exigirUuid(empresaId, 'empresa')]);
  return r.rows;
}

/* ------------------------------------------------------------------ */
/* Pessoa: reconhecer ou cadastrar sozinho na 1ª visita                */
/* ------------------------------------------------------------------ */

/**
 * Reconhece a pessoa pelo id dela na plataforma ou pelo CPF (HMAC) já vinculado antes. Sem vínculo,
 * usa o resolvedor de clientes do Commerce (mesmo do e-commerce): reaproveita o cadastro com o mesmo
 * telefone/e-mail (índices únicos por empresa) ou cria um novo, com auditoria. O passe de entrada só
 * chega ao telefone do cadastro, então um telefone alheio no perfil do app não dá acesso a ninguém.
 * Trava por pessoa: dois webhooks simultâneos da mesma pessoa nova não criam dois vínculos.
 */
async function resolverPessoa(q, empresa, evento, criarCliente) {
  await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`clube-parceiro-pessoa:${empresa}:${evento.plataforma}:${evento.pessoaExterna}`]);
  const vinc = await q('SELECT customer_id FROM clube_parceiro_pessoas WHERE empresa_id = $1 AND plataforma = $2 AND id_externo = $3',
    [empresa, evento.plataforma, evento.pessoaExterna]);
  if (vinc.rows[0]) return { customerId: vinc.rows[0].customer_id, primeiraVisita: false };

  const doc = evento.documento ? hmacDocumento(evento.documento) : null;
  let customerId = null;
  if (doc) {
    const r = await q('SELECT customer_id FROM clube_parceiro_pessoas WHERE empresa_id = $1 AND documento_hmac = $2 LIMIT 1', [empresa, doc]);
    customerId = r.rows[0]?.customer_id || null;
  }
  let novo = false;
  if (!customerId) {
    const r = await criarCliente(q, { empresaId: empresa, nome: evento.nome, telefone: evento.telefone, email: evento.email });
    customerId = r.id;
    novo = r.criado;
  }
  await q(
    `INSERT INTO clube_parceiro_pessoas (empresa_id, customer_id, plataforma, id_externo, documento_hmac) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (empresa_id, plataforma, id_externo) DO NOTHING`,
    [empresa, customerId, evento.plataforma, evento.pessoaExterna, doc],
  );
  return { customerId, primeiraVisita: true, cadastroNovo: novo };
}

/**
 * Cliente pelo resolvedor do Commerce (reaproveita por telefone/e-mail, cria com auditoria).
 * Telefone ou e-mail fora do padrão não impedem o cadastro: entram só os dados válidos.
 */
export async function criarClientePadrao(q, { empresaId, nome, telefone, email, origem = 'clube_parceiro' }) {
  const trx = { query: (t, v) => q(t, v) };
  const contexto = { empresaId, identitySource: origem };
  const tentar = (dados) => resolveCommerceCustomer(trx, contexto, dados);
  const base = { nome: String(nome || 'Aluno parceiro').slice(0, 240) };
  let r;
  try {
    r = await tentar({ ...base, telefone: telefone || null, email: email || null });
  } catch (error) {
    if (error?.code === 'VALIDATION_ERROR') {
      // dado de contato inválido vindo do app: tenta só com o que for válido
      let tel = telefone; let mail = email;
      try { normalizeBrazilianPhone(tel); } catch { tel = null; }
      try { normalizeCustomerEmail(mail); } catch { mail = null; }
      r = await tentar({ ...base, telefone: tel || null, email: mail || null });
    } else if (error?.code === 'CONTACT_CONFLICT') {
      // telefone e e-mail apontam para cadastros diferentes: fica com o do telefone (é para onde vai o passe)
      r = await tentar({ ...base, telefone: telefone || null, email: null });
    } else throw error;
  }
  return { id: r.customer.id, criado: r.created };
}

/* ------------------------------------------------------------------ */
/* Passe de entrada por link (QR que muda a cada 30 s)                 */
/* ------------------------------------------------------------------ */

export async function criarPasse(db, { empresaId, customerId, origem, expiraEm }) {
  const token = randomBytes(24).toString('base64url');
  await db.query(
    'INSERT INTO clube_passes (empresa_id, customer_id, token_hash, origem, expira_em) VALUES ($1, $2, $3, $4, $5)',
    [empresaId, customerId, sha256(token), origem, expiraEm],
  );
  return { token, expiraEm };
}

/** QR atual de um passe (a página consulta a cada 20 s). Passe vencido = 410. */
export async function qrDoPasse(db, token, { qrSecret, agora = new Date() } = {}) {
  if (!/^[\w-]{20,64}$/.test(String(token || ''))) throw new ErroDominio('NOT_FOUND', 'Passe não encontrado', 404);
  if (!qrSecret) throw new ErroDominio('QR_DESATIVADO', 'QR de entrada não está ativo nesta academia.', 503);
  const r = await db.query(
    `SELECT p.expira_em, p.origem, c.nome, pe.user_id_equipamento FROM clube_passes p
       JOIN commerce_customers c ON c.empresa_id = p.empresa_id AND c.id = p.customer_id
       LEFT JOIN acesso_pessoas_equipamento pe ON pe.empresa_id = p.empresa_id AND pe.customer_id = p.customer_id
      WHERE p.token_hash = $1`,
    [sha256(token)],
  );
  const p = r.rows[0];
  if (!p) throw new ErroDominio('NOT_FOUND', 'Passe não encontrado', 404);
  if (new Date(p.expira_em) <= agora) throw new ErroDominio('PASSE_EXPIRADO', 'Este passe venceu. Faça um novo check-in no app.', 410);
  if (!p.user_id_equipamento) throw new ErroDominio('NOT_FOUND', 'Pessoa sem cadastro de acesso', 404);
  const qr = gerarQrDinamico(qrSecret, Number(p.user_id_equipamento), agora.getTime());
  return {
    qr: qr.valor, qrExpiraEm: qr.expiraEm, passeExpiraEm: new Date(p.expira_em),
    nome: String(p.nome || '').split(/\s+/)[0], origem: p.origem, plataforma: NOME_PLATAFORMA[p.origem] || null,
  };
}

/* ------------------------------------------------------------------ */
/* Check-in recebido                                                   */
/* ------------------------------------------------------------------ */

/**
 * Processa um check-in já autenticado (segredo da URL ou assinatura conferidos pela rota).
 * @param {object} deps { criarCliente, enviarWhatsapp, urlPublica, qrSecret, agora, fetch }
 */
export async function receberCheckin(db, conta, evento, deps = {}) {
  const agora = deps.agora || new Date();
  if (!evento || evento.invalido || evento.ignorar || !evento.idExterno || !evento.pessoaExterna) {
    throw new ErroDominio('PAYLOAD_INVALIDO', evento?.motivo || 'Check-in sem identificador', 400);
  }
  if (evento.contaExterna && String(evento.contaExterna) !== String(conta.id_externo)) {
    throw new ErroDominio('CONTA_DIVERGENTE', 'O check-in é de outra unidade.', 409);
  }
  const empresa = conta.empresa_id;
  const expiraEm = evento.expiraEm && evento.expiraEm > agora
    ? evento.expiraEm
    : new Date(Math.max(agora.getTime(), new Date(evento.recebidoEm || agora).getTime()) + conta.validade_min * MIN_MS);
  const criarCliente = deps.criarCliente || criarClientePadrao;

  const r = await transacao(db, async (q) => {
    const ins = await q(
      `INSERT INTO clube_parceiro_checkins (empresa_id, conta_id, plataforma, id_externo, pessoa_externa, produto, recebido_em, expira_em, validacao_cifrada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (conta_id, id_externo) DO NOTHING RETURNING id`,
      [empresa, conta.id, conta.plataforma, evento.idExterno, evento.pessoaExterna, evento.produto || '*', agora, expiraEm,
        evento.validacao ? cifrar(evento.validacao) : null],
    );
    if (!ins.rows[0]) {
      const ja = await q('SELECT id, customer_id FROM clube_parceiro_checkins WHERE conta_id = $1 AND id_externo = $2', [conta.id, evento.idExterno]);
      return { duplicado: true, checkinId: ja.rows[0].id, customerId: ja.rows[0].customer_id };
    }
    const checkinId = ins.rows[0].id;
    await q('UPDATE clube_parceiro_contas SET ultimo_webhook_em = $2 WHERE id = $1', [conta.id, agora]);
    let pessoa;
    try {
      await q('SAVEPOINT pessoa');
      pessoa = await resolverPessoa(q, empresa, evento, criarCliente);
      await q('RELEASE SAVEPOINT pessoa');
    } catch (error) {
      await q('ROLLBACK TO SAVEPOINT pessoa');
      await q("UPDATE clube_parceiro_checkins SET status = 'sem_cadastro', erro = $2 WHERE id = $1", [checkinId, String(error?.message || error).slice(0, 240)]);
      return { checkinId, semCadastro: true };
    }
    await acesso.garantirUserIdEquipamento(q, empresa, pessoa.customerId);
    const valor = await q(
      `SELECT valor FROM clube_parceiro_valores WHERE empresa_id = $1 AND plataforma = $2 AND produto IN ($3, '*')
        ORDER BY (produto = $3) DESC LIMIT 1`,
      [empresa, conta.plataforma, evento.produto || '*'],
    );
    await q('UPDATE clube_parceiro_checkins SET customer_id = $2, valor_esperado = $3 WHERE id = $1', [checkinId, pessoa.customerId, valor.rows[0]?.valor ?? null]);
    // sem plano próprio: entra como interessado de origem "parceiro" (só o gatilho "parceiro frequente"
    // fala com ele, e a academia pode desligar esse gatilho)
    if (pessoa.primeiraVisita && (await q("SELECT to_regclass('clube_prospects') IS NOT NULL AS ok")).rows[0].ok) {
      await q(
        `INSERT INTO clube_prospects (empresa_id, customer_id, origem, interesse)
         SELECT $1, $2, 'parceiro', $3 WHERE NOT EXISTS (
           SELECT 1 FROM acesso_matriculas WHERE empresa_id = $1 AND customer_id = $2 AND status IN ('ativa', 'congelada'))
         ON CONFLICT DO NOTHING`,
        [empresa, pessoa.customerId, conta.plataforma],
      );
    }
    return { checkinId, ...pessoa };
  });

  if (r.duplicado || r.semCadastro) return r;
  // a pessoa entra no aparelho com validade até o fim da janela (facial já cadastrada funciona offline)
  await acesso.sincronizarPessoa(db, empresa, r.customerId).catch(() => {});

  let passeUrl = null;
  if (deps.qrSecret) {
    const passe = await criarPasse(db, { empresaId: empresa, customerId: r.customerId, origem: conta.plataforma, expiraEm });
    passeUrl = `${String(deps.urlPublica || '').replace(/\/$/, '')}/clube/passe/${passe.token}`;
  }
  if (deps.enviarWhatsapp) {
    const c = await db.query('SELECT nome, telefone FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresa, r.customerId]);
    const face = await db.query("SELECT 1 FROM acesso_credenciais WHERE empresa_id = $1 AND customer_id = $2 AND tipo = 'face' AND ativo", [empresa, r.customerId]);
    if (c.rows[0]?.telefone) {
      const nome = String(c.rows[0].nome || '').split(/\s+/)[0];
      const hora = expiraEm.toLocaleTimeString('pt-BR', { timeZone: deps.fuso || 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });
      const plat = NOME_PLATAFORMA[conta.plataforma];
      let texto;
      if (face.rows[0]) texto = `Check-in ${plat} confirmado, ${nome}! É só passar na catraca. Bom treino!`;
      else if (passeUrl) {
        texto = `Oi, ${nome}! Seu check-in ${plat} foi confirmado. Para entrar, abra este link e mostre o QR na catraca: ${passeUrl} (vale até ${hora}).`;
        if (r.primeiraVisita) texto += ' Se quiser entrar direto pelo rosto nas próximas vezes, peça o cadastro facial na recepção.';
      } else texto = `Oi, ${nome}! Seu check-in ${plat} foi confirmado. Na recepção a liberação é imediata.`;
      Promise.resolve(deps.enviarWhatsapp({ empresaId: empresa, customerId: r.customerId, telefone: c.rows[0].telefone, texto })).catch(() => {});
    }
  }
  if (conta.modo === 'sem_catraca') {
    // academia sem catraca: valida ao receber (modo "attendance trigger")
    await db.query("UPDATE clube_parceiro_checkins SET status = 'validando', proxima_tentativa_em = $2 WHERE id = $1", [r.checkinId, agora]);
    r.validacao = await validarCheckin(db, r.checkinId, deps);
  }
  return { ...r, passeUrl, expiraEm };
}

/** Na passagem pela catraca (ação VALIDAR_PARCEIRO do motor de acesso). */
export async function naPassagem(db, { checkinId, em = new Date() }, deps = {}) {
  if (!checkinId) return null;
  const r = await db.query(
    `UPDATE clube_parceiro_checkins SET passou_catraca_em = COALESCE(passou_catraca_em, $2), status = 'validando', proxima_tentativa_em = $2
      WHERE id = $1 AND status = 'recebido' RETURNING id`,
    [exigirUuid(checkinId, 'check-in'), em],
  );
  if (!r.rows[0]) return { jaTratado: true };
  return validarCheckin(db, checkinId, { ...deps, agora: deps.agora || em });
}

/**
 * Chama a validação na plataforma com o check-in travado (duas chamadas paralelas nunca validam
 * duas vezes). Erro temporário: nova tentativa com espera crescente por até 15 min desde a
 * passagem; depois disso vira pendência de retroativo.
 */
export async function validarCheckin(db, checkinId, deps = {}) {
  const agora = deps.agora || new Date();
  // 1) reserva curta: marca a tentativa e empurra a próxima para frente (outra rotina não pega o mesmo
  //    check-in enquanto a chamada externa acontece; se o processo cair, a reserva expira em 2 min)
  const reserva = await db.query(
    `UPDATE clube_parceiro_checkins k SET tentativas = k.tentativas + 1, proxima_tentativa_em = $2::timestamptz + interval '2 minutes'
      FROM clube_parceiro_contas c
     WHERE k.id = $1 AND c.id = k.conta_id AND k.status IN ('validando', 'falhou')
       AND (k.proxima_tentativa_em IS NULL OR k.proxima_tentativa_em <= $2)
     RETURNING k.id, k.plataforma, k.pessoa_externa, k.validacao_cifrada, k.tentativas, k.passou_catraca_em, k.recebido_em,
               c.id_externo AS conta_externa, c.ambiente, c.credencial_cifrada, c.verificada`,
    [checkinId, agora],
  );
  const k = reserva.rows[0];
  if (!k) return { status: 'ignorado' };
  const gravar = (sql, valores) => db.query(`${sql} AND tentativas = $${valores.length + 1} AND status IN ('validando', 'falhou')`, [...valores, k.tentativas]);
  if (!k.verificada) {
    // conta sem posse comprovada nunca faz o Kytto validar em nome de uma unidade
    await gravar("UPDATE clube_parceiro_checkins SET status = 'retroativo', erro = 'conta da unidade ainda não verificada', proxima_tentativa_em = NULL WHERE id = $1", [k.id]);
    return { status: 'retroativo', erro: 'conta não verificada' };
  }
  let credencial = null; let url = null;
  try {
    credencial = k.credencial_cifrada ? decifrar(k.credencial_cifrada) : null;
    url = k.validacao_cifrada ? decifrar(k.validacao_cifrada) : null;
  } catch (error) {
    await gravar("UPDATE clube_parceiro_checkins SET status = 'retroativo', erro = $2, proxima_tentativa_em = NULL WHERE id = $1", [k.id, `credencial ilegível: ${String(error.message).slice(0, 180)}`]);
    return { status: 'retroativo' };
  }
  // 2) chamada externa fora de transação (não segura conexão nem trava de linha)
  const res = await ADAPTADORES[k.plataforma].validar({
    conta: { id_externo: k.conta_externa, ambiente: k.ambiente },
    checkin: { pessoa_externa: k.pessoa_externa, validacao_url: url },
    credencial,
    fetch: deps.fetch,
  });
  const resposta = res.resposta ? JSON.stringify(res.resposta) : null;
  // 3) grava o resultado só se ninguém mexeu no check-in desde a reserva
  if (res.resultado === 'validado') {
    await gravar("UPDATE clube_parceiro_checkins SET status = 'validado', validado_em = $2, resposta = $3, erro = NULL, proxima_tentativa_em = NULL WHERE id = $1", [k.id, agora, resposta]);
    return { status: 'validado' };
  }
  if (res.resultado === 'expirado' || res.resultado === 'negado') {
    const status = k.passou_catraca_em ? 'retroativo' : res.resultado;
    await gravar('UPDATE clube_parceiro_checkins SET status = $2, resposta = $3, erro = $4, proxima_tentativa_em = NULL WHERE id = $1', [k.id, status, resposta, res.erro]);
    return { status, erro: res.erro };
  }
  const base = k.passou_catraca_em || k.recebido_em;
  const espera = Math.min(5, 2 ** (k.tentativas - 1)) * MIN_MS;
  if (res.tentarDeNovo && agora.getTime() + espera - new Date(base).getTime() <= JANELA_VALIDACAO_MS) {
    const proxima = new Date(agora.getTime() + espera);
    await gravar("UPDATE clube_parceiro_checkins SET status = 'falhou', erro = $2, proxima_tentativa_em = $3, resposta = $4 WHERE id = $1", [k.id, res.erro, proxima, resposta]);
    return { status: 'falhou', erro: res.erro, proximaTentativaEm: proxima };
  }
  await gravar("UPDATE clube_parceiro_checkins SET status = 'retroativo', erro = $2, proxima_tentativa_em = NULL, resposta = $3 WHERE id = $1", [k.id, res.erro, resposta]);
  return { status: 'retroativo', erro: res.erro };
}

/** Rotina: novas tentativas devidas e check-ins não usados que venceram (saem do aparelho). */
export async function rotinaParceiros(db, deps = {}) {
  const agora = deps.agora || new Date();
  const devidos = await db.query(
    "SELECT id FROM clube_parceiro_checkins WHERE status IN ('validando', 'falhou') AND proxima_tentativa_em <= $1 ORDER BY proxima_tentativa_em LIMIT 50",
    [agora],
  );
  const resumo = { tentativas: 0, validados: 0, retroativos: 0, expirados: 0 };
  for (const { id } of devidos.rows) {
    const r = await validarCheckin(db, id, { ...deps, agora });
    resumo.tentativas += 1;
    if (r.status === 'validado') resumo.validados += 1;
    if (r.status === 'retroativo') resumo.retroativos += 1;
  }
  const venc = await db.query(
    `UPDATE clube_parceiro_checkins SET status = 'expirado'
      WHERE status = 'recebido' AND passou_catraca_em IS NULL AND expira_em < $1 RETURNING empresa_id, customer_id`,
    [agora],
  );
  resumo.expirados = venc.rowCount;
  const pessoas = new Set(venc.rows.filter((x) => x.customer_id).map((x) => `${x.empresa_id}|${x.customer_id}`));
  for (const p of pessoas) {
    const [e, c] = p.split('|');
    await acesso.sincronizarPessoa(db, e, c).catch(() => {});
  }
  return resumo;
}

/* ------------------------------------------------------------------ */
/* Ganchos para os outros itens                                        */
/* ------------------------------------------------------------------ */

/** Item 1: passe válido para o motor de acesso (extras.parceiro). */
export async function passeParaAcesso(q, { empresaId, customerId, agora }) {
  const temTabela = await q("SELECT to_regclass('clube_parceiro_checkins') IS NOT NULL AS ok");
  if (!temTabela.rows[0].ok) return null;
  const r = await q(
    `SELECT k.id, k.plataforma, k.expira_em, c.unidade_id FROM clube_parceiro_checkins k JOIN clube_parceiro_contas c ON c.id = k.conta_id
      WHERE k.empresa_id = $1 AND k.customer_id = $2 AND k.status IN ('recebido', 'validando', 'validado', 'falhou') AND k.expira_em > $3
      ORDER BY k.recebido_em DESC LIMIT 1`,
    [empresaId, customerId, agora],
  );
  const x = r.rows[0];
  // a unidade do check-in vai junto: o motor só aceita o passe na unidade que a plataforma vai pagar
  return x ? { checkinId: x.id, plataforma: x.plataforma, expiraEm: new Date(x.expira_em), unidadeId: x.unidade_id } : null;
}

/** Item 4 (gatilho "parceiro frequente"): check-ins válidos no mês por pessoa. */
export async function checkinsParceiroMes(db, empresaId, { agora = new Date(), fuso = 'America/Cuiaba' } = {}) {
  const r = await db.query(
    `SELECT customer_id, COUNT(*)::int AS n FROM clube_parceiro_checkins
      WHERE empresa_id = $1 AND customer_id IS NOT NULL AND status IN ('validado', 'retroativo')
        AND date_trunc('month', recebido_em AT TIME ZONE $3) = date_trunc('month', $2::timestamptz AT TIME ZONE $3)
      GROUP BY customer_id`,
    [empresaId, agora, fuso],
  );
  return new Map(r.rows.map((x) => [x.customer_id, x.n]));
}

/* ------------------------------------------------------------------ */
/* Painel: check-ins, retroativos, conciliação                         */
/* ------------------------------------------------------------------ */

export async function listarCheckins(db, empresaId, { status = '', plataforma = '', limite = 100 } = {}) {
  const r = await db.query(
    `SELECT k.id, k.plataforma, k.status, k.pessoa_externa, k.produto, k.recebido_em, k.expira_em, k.passou_catraca_em, k.validado_em,
            k.tentativas, k.erro, k.valor_esperado::float AS valor_esperado, c.nome, ct.nome AS conta
       FROM clube_parceiro_checkins k
       JOIN clube_parceiro_contas ct ON ct.id = k.conta_id
       LEFT JOIN commerce_customers c ON c.empresa_id = k.empresa_id AND c.id = k.customer_id
      WHERE k.empresa_id = $1 AND ($2 = '' OR k.status = $2) AND ($3 = '' OR k.plataforma = $3)
      ORDER BY k.recebido_em DESC LIMIT $4`,
    [exigirUuid(empresaId, 'empresa'), status, plataforma, Math.min(Math.max(Number(limite) || 100, 1), 500)],
  );
  return r.rows;
}

/** Prazo do retroativo no Wellhub: até o dia 2 do mês seguinte ao check-in. */
export function prazoRetroativo(recebidoEm, fuso = 'America/Cuiaba') {
  const [a, m] = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit' }).format(new Date(recebidoEm)).split('-').map(Number);
  return m === 12 ? `${a + 1}-01-02` : `${a}-${String(m + 1).padStart(2, '0')}-02`;
}

/** Pendências de retroativo com tudo que o portal da plataforma pede, já preenchido. */
export async function pendenciasRetroativo(db, empresaId, { fuso = 'America/Cuiaba' } = {}) {
  const r = await db.query(
    `SELECT k.id, k.plataforma, k.pessoa_externa, k.produto, k.recebido_em, k.passou_catraca_em, k.erro, c.nome, ct.id_externo AS unidade
       FROM clube_parceiro_checkins k JOIN clube_parceiro_contas ct ON ct.id = k.conta_id
       LEFT JOIN commerce_customers c ON c.empresa_id = k.empresa_id AND c.id = k.customer_id
      WHERE k.empresa_id = $1 AND k.status = 'retroativo' ORDER BY k.recebido_em`,
    [exigirUuid(empresaId, 'empresa')],
  );
  return r.rows.map((x) => ({
    id: x.id,
    plataforma: x.plataforma,
    nome: x.nome,
    idNaPlataforma: x.pessoa_externa,
    unidade: x.unidade,
    produto: x.produto,
    checkinEm: x.recebido_em,
    passouCatracaEm: x.passou_catraca_em,
    motivo: x.erro,
    prazo: x.plataforma === 'wellhub' ? prazoRetroativo(x.recebido_em, fuso) : null,
  }));
}

export async function resolverRetroativo(db, empresaId, id, { aprovado }) {
  const r = await db.query(
    `UPDATE clube_parceiro_checkins SET status = CASE WHEN $3 THEN 'validado' ELSE 'negado' END,
            validado_em = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE validado_em END
      WHERE empresa_id = $1 AND id = $2 AND status = 'retroativo' RETURNING id`,
    [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'check-in'), Boolean(aprovado)],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Pendência não encontrada', 404);
  return { resolvido: true };
}

/**
 * Importa o relatório de repasse da plataforma (linhas: { idNaPlataforma, data, valor }).
 * Chave de cruzamento: pessoa na plataforma + dia do check-in (1 check-in por dia por pessoa).
 */
export async function importarRepasse(db, empresaId, { plataforma, mes, linhas: entrada }) {
  let linhas = entrada;
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!PLATAFORMAS.includes(plataforma)) throw new ErroDominio('VALIDATION_ERROR', 'plataforma inválida');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes))) throw new ErroDominio('VALIDATION_ERROR', 'mes deve ser AAAA-MM');
  if (!Array.isArray(linhas) || !linhas.length || linhas.length > 20000) throw new ErroDominio('VALIDATION_ERROR', 'linhas: de 1 a 20.000');
  let importadas = 0;
  // duas visitas da mesma pessoa no mesmo dia somam (reimportar o mesmo relatório substitui, não duplica)
  const somadas = new Map();
  for (const [i, l] of linhas.entries()) {
    const pessoa = String(l.idNaPlataforma || '').trim();
    const data = String(l.data || '').slice(0, 10);
    const valor = Number(String(l.valor).replace(',', '.'));
    if (!pessoa || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !data.startsWith(mes) || !Number.isFinite(valor) || valor < 0) {
      throw new ErroDominio('VALIDATION_ERROR', `linha ${i + 1} inválida (idNaPlataforma, data AAAA-MM-DD do mês, valor)`);
    }
    const chave = `${pessoa}:${data}`;
    const ant = somadas.get(chave);
    somadas.set(chave, { idNaPlataforma: pessoa, data, valor: (ant?.valor || 0) + valor });
  }
  linhas = [...somadas.values()];
  await transacao(db, async (q) => {
    for (const [i, l] of linhas.entries()) {
      const pessoa = String(l.idNaPlataforma || '').trim();
      const data = String(l.data || '').slice(0, 10);
      const valor = Number(String(l.valor).replace(',', '.'));
      if (!pessoa || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !data.startsWith(mes) || !Number.isFinite(valor) || valor < 0) {
        throw new ErroDominio('VALIDATION_ERROR', `linha ${i + 1} inválida (idNaPlataforma, data AAAA-MM-DD do mês, valor)`);
      }
      const r = await q(
        `INSERT INTO clube_parceiro_repasses (empresa_id, plataforma, mes, id_externo, data, valor_pago) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (empresa_id, plataforma, mes, id_externo) DO UPDATE SET valor_pago = EXCLUDED.valor_pago, importado_em = CURRENT_TIMESTAMP`,
        [empresa, plataforma, mes, `${pessoa}:${data}`, data, Math.round(valor * 100) / 100],
      );
      importadas += r.rowCount;
    }
  });
  return { importadas };
}

/**
 * Conciliação do mês por plataforma: o que validamos × o que a plataforma pagou.
 * Divergências: validado e não pago, pago sem check-in validado, valor diferente do esperado,
 * retroativo pendente ou negado.
 */
export async function conciliacao(db, empresaId, { mes, fuso = 'America/Cuiaba' }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes))) throw new ErroDominio('VALIDATION_ERROR', 'mes deve ser AAAA-MM');
  const r = await db.query(
    `WITH nossos AS (
       SELECT k.plataforma, k.pessoa_externa || ':' || to_char(k.recebido_em AT TIME ZONE $3, 'YYYY-MM-DD') AS chave,
              k.status, k.valor_esperado, k.id, c.nome
         FROM clube_parceiro_checkins k LEFT JOIN commerce_customers c ON c.empresa_id = k.empresa_id AND c.id = k.customer_id
        WHERE k.empresa_id = $1 AND to_char(k.recebido_em AT TIME ZONE $3, 'YYYY-MM') = $2
          AND k.status IN ('validado', 'retroativo', 'negado')
     ), pagos AS (
       SELECT plataforma, id_externo AS chave, valor_pago FROM clube_parceiro_repasses WHERE empresa_id = $1 AND mes = $2
     )
     SELECT COALESCE(n.plataforma, p.plataforma) AS plataforma, COALESCE(n.chave, p.chave) AS chave, n.status, n.nome,
            n.valor_esperado::float AS esperado, p.valor_pago::float AS pago, n.id AS checkin_id
       FROM nossos n FULL OUTER JOIN pagos p ON p.plataforma = n.plataforma AND p.chave = n.chave`,
    [empresa, mes, fuso],
  );
  const porPlataforma = {};
  const divergencias = [];
  for (const x of r.rows) {
    const t = porPlataforma[x.plataforma] ||= { plataforma: x.plataforma, visitasValidadas: 0, visitasPagas: 0, receita: 0, esperado: 0, divergencias: 0 };
    if (x.status === 'validado') { t.visitasValidadas += 1; t.esperado += x.esperado || 0; }
    if (x.pago !== null) { t.visitasPagas += 1; t.receita += x.pago; }
    let tipo = null;
    if (x.status === 'validado' && x.pago === null) tipo = 'validado_nao_pago';
    else if (!x.status && x.pago !== null) tipo = 'pago_sem_checkin';
    else if (x.status === 'retroativo') tipo = x.pago !== null ? null : 'retroativo_pendente';
    else if (x.status === 'negado' && x.pago === null) tipo = 'retroativo_negado';
    else if (x.status === 'validado' && x.esperado !== null && x.pago !== null && Math.abs(x.esperado - x.pago) > 0.009) tipo = 'valor_diferente';
    if (tipo) {
      t.divergencias += 1;
      divergencias.push({ tipo, plataforma: x.plataforma, chave: x.chave, nome: x.nome || null, esperado: x.esperado, pago: x.pago, checkinId: x.checkin_id });
    }
  }
  const resumo = Object.values(porPlataforma).map((t) => ({
    ...t,
    receita: Math.round(t.receita * 100) / 100,
    esperado: Math.round(t.esperado * 100) / 100,
    mediaPorVisita: t.visitasPagas ? Math.round((t.receita / t.visitasPagas) * 100) / 100 : null,
  }));
  return { mes, resumo, divergencias };
}

/* ------------------------------------------------------------------ */
/* Reservas de aula vindas das plataformas (item 2.4)                  */
/* ------------------------------------------------------------------ */

/**
 * Reserva feita no app da plataforma entra na mesma turma, com selo da origem e dentro das vagas
 * reservadas para parceiros. `reservar` é o serviço de aulas (injetado para evitar dependência circular).
 */
export async function reservarPorParceiro(db, conta, evento, { reservar, criarCliente = criarClientePadrao, agora = new Date() }) {
  const pessoa = await transacao(db, (q) => resolverPessoa(q, conta.empresa_id, evento, criarCliente));
  const r = await reservar(db, conta.empresa_id, { ocorrenciaId: evento.ocorrenciaId, customerId: pessoa.customerId, origem: conta.plataforma, agora });
  return { ...r, customerId: pessoa.customerId };
}

/** Teste da configuração (botão "testar"): confere credenciais e alcance da API sem gravar nada. */
export async function testarConta(db, empresaId, id, deps = {}) {
  const r = await db.query('SELECT * FROM clube_parceiro_contas WHERE empresa_id = $1 AND id = $2', [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'conta')]);
  const c = r.rows[0];
  if (!c) throw new ErroDominio('NOT_FOUND', 'Conta não encontrada', 404);
  const passos = [];
  passos.push({ passo: 'conta ativa', ok: c.ativo });
  if (c.plataforma === 'wellhub') {
    passos.push({ passo: 'token de parceiro Kytto (WELLHUB_API_TOKEN)', ok: Boolean(process.env.WELLHUB_API_TOKEN) });
    passos.push({ passo: 'segredo de assinatura do webhook (WELLHUB_WEBHOOK_SECRET)', ok: Boolean(process.env.WELLHUB_WEBHOOK_SECRET) });
    if (process.env.WELLHUB_API_TOKEN) {
      // pessoa inexistente: resposta 4xx de "usuário" prova que autenticação e Gym ID foram aceitos
      const v = await ADAPTADORES.wellhub.validar({ conta: c, checkin: { pessoa_externa: '0000000000000' }, fetch: deps.fetch });
      const autorizado = v.resultado === 'validado' || (v.resultado === 'negado' && !/unauthori|forbidden|401|403|gym/i.test(v.erro || ''));
      passos.push({ passo: `API ${c.ambiente} alcançável e credenciais aceitas`, ok: autorizado, detalhe: v.erro || null });
    }
  } else {
    let cred = null;
    try { cred = c.credencial_cifrada ? decifrar(c.credencial_cifrada) : null; } catch { cred = null; }
    passos.push({ passo: 'place_api_key da unidade', ok: Boolean(cred) });
    passos.push({ passo: 'chave de parceiro Kytto (TOTALPASS_PARTNER_API_KEY)', ok: Boolean(process.env.TOTALPASS_PARTNER_API_KEY) });
  }
  passos.push({ passo: 'webhook já recebido alguma vez', ok: Boolean(c.ultimo_webhook_em), detalhe: c.ultimo_webhook_em || 'cadastre a URL do webhook no portal da plataforma' });
  return { plataforma: c.plataforma, ambiente: c.ambiente, pronto: passos.every((p) => p.ok), passos };
}
