// Cobrança da mensalidade do Clube, por empresa.
// Hoje: Pix com a chave da própria academia (BR Code EMV com valor e txid), página pública com QR
// e copia e cola, e baixa confirmada pela recepção. O dinheiro nunca passa por conta do Kytto.
// A baixa vai sempre por `registrarPagamento` (registrarPagamentoClube), idempotente pelo id da
// cobrança: libera a catraca, estende o "pago até" e soma a receita recuperada da régua.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { gerarBrCode } from '../../pagamentos.js';
import { ErroDominio, exigirUuid, transacao } from '../acesso/banco.js';

export const PROVEDORES = ['pix_manual'];
const sha256 = (t) => createHash('sha256').update(String(t)).digest('hex');
const reais = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

/** Campos do BR Code: só ASCII maiúsculo (o tamanho do TLV conta caracteres). */
function asciiPix(texto, max) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max);
}

/** Chave Pix: CPF, CNPJ, e-mail, celular (+55…) ou chave aleatória. */
export function normalizarChavePix(chave) {
  const c = String(chave || '').trim();
  const d = c.replace(/\D/g, '');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase();
  if (/^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@]{2,}$/.test(c) && c.length <= 77) return c.toLowerCase();
  if (/^\+55\d{10,11}$/.test(c.replace(/[\s()-]/g, ''))) return c.replace(/[\s()-]/g, '');
  if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(c) && d.length === 11) return d;
  if (/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(c) && d.length === 14) return d;
  throw new ErroDominio('VALIDATION_ERROR', 'Chave Pix inválida (CPF, CNPJ, e-mail, celular com +55 ou chave aleatória)');
}

const visaoConfig = (r) => ({
  provedor: r?.provedor || 'pix_manual',
  ativo: r?.ativo === true,
  pixChave: r?.pix_chave || '',
  pixNome: r?.pix_nome || '',
  pixCidade: r?.pix_cidade || '',
  validadeHoras: r?.validade_horas || 72,
});

export async function obterConfig(db, empresaId) {
  const r = await db.query('SELECT * FROM clube_cobranca_config WHERE empresa_id = $1', [exigirUuid(empresaId, 'empresa')]);
  return visaoConfig(r.rows[0]);
}

export async function salvarConfig(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const atual = await obterConfig(db, empresa);
  const provedor = dados.provedor ?? atual.provedor;
  if (!PROVEDORES.includes(provedor)) throw new ErroDominio('VALIDATION_ERROR', 'provedor de cobrança inválido');
  const ativo = dados.ativo === undefined ? atual.ativo : dados.ativo === true;
  const chave = dados.pixChave !== undefined ? (dados.pixChave ? normalizarChavePix(dados.pixChave) : '') : atual.pixChave;
  const nome = dados.pixNome !== undefined ? asciiPix(dados.pixNome, 25) : atual.pixNome;
  const cidade = dados.pixCidade !== undefined ? asciiPix(dados.pixCidade, 15) : atual.pixCidade;
  const validade = dados.validadeHoras === undefined ? atual.validadeHoras : Number(dados.validadeHoras);
  if (!Number.isInteger(validade) || validade < 1 || validade > 720) throw new ErroDominio('VALIDATION_ERROR', 'validade de 1 a 720 horas');
  if (ativo && provedor === 'pix_manual' && !(chave && nome && cidade)) {
    throw new ErroDominio('VALIDATION_ERROR', 'Para ligar a cobrança por Pix, informe chave, nome do recebedor e cidade');
  }
  await db.query(
    `INSERT INTO clube_cobranca_config (empresa_id, provedor, ativo, pix_chave, pix_nome, pix_cidade, validade_horas, atualizado_em)
     VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), $7, CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id) DO UPDATE SET provedor = EXCLUDED.provedor, ativo = EXCLUDED.ativo, pix_chave = EXCLUDED.pix_chave,
       pix_nome = EXCLUDED.pix_nome, pix_cidade = EXCLUDED.pix_cidade, validade_horas = EXCLUDED.validade_horas, atualizado_em = CURRENT_TIMESTAMP`,
    [empresa, provedor, ativo, chave, nome, cidade, validade],
  );
  return obterConfig(db, empresa);
}

const TIPOS = ['mensalidade', 'acordo', 'avulsa'];
const base = (urlPublica) => String(urlPublica || '').replace(/\/$/, '');

/**
 * Cria a cobrança e devolve o link público (/clube/pagar/<token>).
 * Parcelado: grava TODAS as parcelas; a 1ª sai agora e as seguintes ganham link e vão para o
 * WhatsApp do aluno a cada 30 dias (rotina enviarParcelasDevidas).
 */
export async function criarCobranca(db, { empresaId, customerId, valor, parcelas = 1, descricao = 'Mensalidade', origem = 'regua', tipo = null, agora = new Date() }, { urlPublica = '' } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const cfg = await obterConfig(db, empresa);
  if (!cfg.ativo) throw new ErroDominio('PAGAMENTO_INDISPONIVEL', 'Cobrança online não está ligada nesta academia.', 503);
  const n = Number(parcelas);
  if (!Number.isInteger(n) || n < 1 || n > 24) throw new ErroDominio('VALIDATION_ERROR', 'parcelas de 1 a 24');
  const total = Math.round(Number(valor) * 100) / 100;
  if (!Number.isFinite(total) || total < 1 || total > 100000) throw new ErroDominio('VALIDATION_ERROR', 'valor da cobrança inválido');
  const valorParcela = Math.floor((total / n) * 100) / 100;
  if (valorParcela < 1) throw new ErroDominio('VALIDATION_ERROR', 'parcela mínima de R$ 1,00');
  if (!['regua', 'ia', 'recepcao', 'acordo'].includes(origem)) throw new ErroDominio('VALIDATION_ERROR', 'origem inválida');
  const t = tipo || (n > 1 || origem === 'acordo' ? 'acordo' : 'mensalidade');
  if (!TIPOS.includes(t)) throw new ErroDominio('VALIDATION_ERROR', 'tipo de cobrança inválido');
  const existe = await db.query('SELECT 1 FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresa, cliente]);
  if (!existe.rows[0]) throw new ErroDominio('NOT_FOUND', 'Aluno não encontrado nesta academia', 404);

  const token = randomBytes(24).toString('base64url');
  const grupo = n > 1 ? randomUUID() : null;
  const desc0 = String(descricao || 'Mensalidade').trim().slice(0, 100);
  let primeira = null;
  await transacao(db, async (q) => {
    for (let k = 1; k <= n; k += 1) {
      // a última parcela leva os centavos que sobraram da divisão
      const v = k === n ? Math.round((total - valorParcela * (n - 1)) * 100) / 100 : valorParcela;
      const txid = `KC${randomBytes(9).toString('hex').toUpperCase()}`.slice(0, 25);
      const enviar = new Date(agora.getTime() + (k - 1) * 30 * 86400000);
      const expira = new Date(enviar.getTime() + cfg.validadeHoras * 3600000);
      const r = await q(
        `INSERT INTO clube_cobrancas (empresa_id, customer_id, valor, tipo, grupo_id, parcela, parcelas, descricao, provedor, token_hash, enviar_em, enviado_em,
                                      txid, pix_copia_cola, origem, criado_em, expira_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
        [empresa, cliente, v, t, grupo, k, n, `${desc0}${n > 1 ? ` (parcela ${k}/${n})` : ''}`, cfg.provedor,
          k === 1 ? sha256(token) : null, enviar, k === 1 ? agora : null, txid,
          gerarBrCode({ chave: cfg.pixChave, nome: cfg.pixNome, cidade: cfg.pixCidade, valor: v, txid }), origem, agora, expira],
      );
      if (k === 1) primeira = { id: r.rows[0].id, valor: v, expira };
    }
  });
  return { id: primeira.id, link: `${base(urlPublica)}/clube/pagar/${token}`, valor: primeira.valor, valorFormatado: reais(primeira.valor), expiraEm: primeira.expira.toISOString(), parcelas: n };
}

/** O link ainda leva a uma cobrança pendente e dentro da validade (com folga de 1 h)? */
export async function linkAindaValido(db, link, { agora = new Date() } = {}) {
  const token = String(link || '').split('/').pop();
  if (!/^[\w-]{20,64}$/.test(token)) return false;
  const r = await db.query(
    "SELECT 1 FROM clube_cobrancas WHERE token_hash = $1 AND status = 'pendente' AND expira_em > $2::timestamptz + interval '1 hour'",
    [sha256(token), agora],
  );
  return Boolean(r.rows[0]);
}

/**
 * Parcelas seguintes de um acordo: quando chega a vez, ganham link e vão para o WhatsApp.
 * Trava por linha (SKIP LOCKED): duas instâncias nunca mandam a mesma parcela.
 */
export async function enviarParcelasDevidas(db, { enviarWhatsapp, urlPublica = '', agora = new Date(), limite = 200 } = {}) {
  if (!enviarWhatsapp || !base(urlPublica)) return { enviadas: 0 };
  const lote = await transacao(db, async (q) => {
    const r = await q(
      `SELECT c.id, c.empresa_id, c.customer_id, c.valor, c.descricao, cu.nome, cu.telefone
         FROM clube_cobrancas c JOIN commerce_customers cu ON cu.empresa_id = c.empresa_id AND cu.id = c.customer_id
        WHERE c.status = 'pendente' AND c.token_hash IS NULL AND c.enviar_em <= $1
        ORDER BY c.enviar_em LIMIT $2 FOR UPDATE OF c SKIP LOCKED`,
      [agora, limite],
    );
    const saida = [];
    for (const c of r.rows) {
      const token = randomBytes(24).toString('base64url');
      await q('UPDATE clube_cobrancas SET token_hash = $2, enviado_em = $3 WHERE id = $1', [c.id, sha256(token), agora]);
      saida.push({ ...c, link: `${base(urlPublica)}/clube/pagar/${token}` });
    }
    return saida;
  });
  let enviadas = 0;
  for (const c of lote) {
    if (!c.telefone) continue;
    const nome = String(c.nome || '').split(' ')[0];
    const texto = `${nome ? `Oi, ${nome}! ` : ''}Chegou a ${c.descricao.replace(/^.*\((parcela [^)]+)\)$/, '$1')} do seu acordo: ${reais(c.valor)}. Pix: ${c.link}`;
    try { await enviarWhatsapp({ empresaId: c.empresa_id, customerId: c.customer_id, telefone: c.telefone, texto, tipo: 'cobranca' }); enviadas += 1; } catch { /* link fica no painel */ }
  }
  return { enviadas, agendadas: lote.length };
}

/** A recepção registrou o pagamento direto na matrícula: as mensalidades em aberto deixam de valer. */
export async function cancelarMensalidadesPendentes(db, empresaId, customerId, { agora = new Date() } = {}) {
  const r = await db.query(
    `UPDATE clube_cobrancas SET status = 'cancelada', cancelado_em = $3, cancelado_por = 'pago_na_recepcao'
      WHERE empresa_id = $1 AND customer_id = $2 AND status = 'pendente' AND tipo = 'mensalidade' RETURNING id`,
    [exigirUuid(empresaId, 'empresa'), exigirUuid(customerId, 'cliente'), agora],
  );
  return r.rows.length;
}

/** Dados da página pública (sem login): só o necessário para pagar. */
export async function cobrancaPorToken(db, token, { agora = new Date() } = {}) {
  const t = String(token || '');
  if (!/^[\w-]{20,64}$/.test(t)) throw new ErroDominio('NOT_FOUND', 'Cobrança não encontrada', 404);
  const r = await db.query(
    `SELECT c.id, c.valor, c.descricao, c.status, c.expira_em, c.pix_copia_cola, cfg.pix_nome
       FROM clube_cobrancas c LEFT JOIN clube_cobranca_config cfg ON cfg.empresa_id = c.empresa_id
      WHERE c.token_hash = $1`,
    [sha256(t)],
  );
  const c = r.rows[0];
  if (!c) throw new ErroDominio('NOT_FOUND', 'Cobrança não encontrada', 404);
  const vencida = c.status === 'pendente' && new Date(c.expira_em) < agora;
  const status = vencida ? 'vencida' : c.status;
  return {
    status,
    valor: Number(c.valor),
    valorFormatado: reais(c.valor),
    descricao: c.descricao,
    recebedor: c.pix_nome || '',
    expiraEm: new Date(c.expira_em).toISOString(),
    pixCopiaCola: status === 'pendente' ? c.pix_copia_cola : null,
  };
}

export async function listarCobrancas(db, empresaId, { status = '', limite = 100 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (status && !['pendente', 'paga', 'cancelada'].includes(status)) throw new ErroDominio('VALIDATION_ERROR', 'status inválido');
  const lim = Math.min(500, Math.max(1, Number(limite) || 100));
  const r = await db.query(
    `SELECT c.id, c.customer_id, cu.nome, cu.telefone, c.valor, c.tipo, c.parcela, c.parcelas, c.descricao, c.status, c.origem, c.txid,
            c.criado_em, c.expira_em, c.enviar_em, (c.token_hash IS NULL) AS agendada, c.pago_em, c.confirmado_por, c.cancelado_em
       FROM clube_cobrancas c JOIN commerce_customers cu ON cu.empresa_id = c.empresa_id AND cu.id = c.customer_id
      WHERE c.empresa_id = $1 AND ($2 = '' OR c.status = $2)
      ORDER BY c.criado_em DESC LIMIT $3`,
    [empresa, status, lim],
  );
  return r.rows.map((c) => ({
    id: c.id, customerId: c.customer_id, nome: c.nome, telefone: c.telefone, valor: Number(c.valor), tipo: c.tipo, parcela: c.parcela, parcelas: c.parcelas,
    agendada: c.agendada, enviarEm: c.enviar_em,
    descricao: c.descricao, status: c.status, origem: c.origem, txid: c.txid, criadoEm: c.criado_em, expiraEm: c.expira_em,
    pagoEm: c.pago_em, confirmadoPor: c.confirmado_por, canceladoEm: c.cancelado_em,
  }));
}

/**
 * A recepção confirma que o Pix caiu na conta da academia (confere o txid no extrato).
 * Vale também para cobrança vencida: o dinheiro entrou. Idempotente.
 */
export async function confirmarCobranca(db, empresaId, cobrancaId, { operador, registrarPagamento, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const id = exigirUuid(cobrancaId, 'cobrança');
  if (typeof registrarPagamento !== 'function') throw new Error('registrarPagamento é obrigatório');
  const quem = String(operador || '').trim().slice(0, 120);
  if (!quem) throw new ErroDominio('VALIDATION_ERROR', 'operador obrigatório');
  const c = await transacao(db, async (q) => {
    const r = await q('SELECT * FROM clube_cobrancas WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, id]);
    const row = r.rows[0];
    if (!row) throw new ErroDominio('NOT_FOUND', 'Cobrança não encontrada', 404);
    if (row.status === 'cancelada') throw new ErroDominio('COBRANCA_CANCELADA', 'Cobrança cancelada (pode já ter sido paga na recepção). Confira a matrícula do aluno antes de lançar de novo.', 409);
    if (row.status === 'pendente') {
      await q("UPDATE clube_cobrancas SET status = 'paga', pago_em = $3, confirmado_por = $4 WHERE empresa_id = $1 AND id = $2", [empresa, id, agora, quem]);
    }
    return row;
  });
  // fora da transação: registrarPagamento tem a própria idempotência por pagamentoId
  const efeito = await registrarPagamento({ empresaId: empresa, customerId: c.customer_id, pagamentoId: `clube-cobranca:${c.id}`, valor: Number(c.valor), estender: c.tipo !== 'avulsa', agora });
  return { id: c.id, status: 'paga', repetida: c.status === 'paga', efeito };
}

export async function cancelarCobranca(db, empresaId, cobrancaId, { operador, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const id = exigirUuid(cobrancaId, 'cobrança');
  const r = await db.query(
    `UPDATE clube_cobrancas SET status = 'cancelada', cancelado_em = $3, cancelado_por = $4
      WHERE empresa_id = $1 AND id = $2 AND status = 'pendente' RETURNING id`,
    [empresa, id, agora, String(operador || 'equipe').slice(0, 120)],
  );
  if (!r.rows[0]) {
    const existe = await db.query('SELECT status FROM clube_cobrancas WHERE empresa_id = $1 AND id = $2', [empresa, id]);
    if (!existe.rows[0]) throw new ErroDominio('NOT_FOUND', 'Cobrança não encontrada', 404);
    throw new ErroDominio('COBRANCA_NAO_PENDENTE', `Cobrança ${existe.rows[0].status} não pode ser cancelada`, 409);
  }
  return { id, status: 'cancelada' };
}

/**
 * Função no formato que a régua e a IA esperam (gerarLinkPagamento): devolve só o link.
 * Sem cobrança ligada na academia ou sem PUBLIC_BASE_URL (link relativo não abre no WhatsApp),
 * devolve null: a régua manda a mensagem sem link e a IA indica a recepção.
 * `gerar.valido(link)` diz se um link guardado ainda pode ser reenviado.
 */
export function criarGeradorDeLink(db, { urlPublica = '' } = {}) {
  const gerar = async ({ empresaId, customerId, valor, parcelas = 1, descricao, origem = 'regua', tipo = null }) => {
    if (!valor || !base(urlPublica)) return null;
    try {
      const r = await criarCobranca(db, { empresaId, customerId, valor, parcelas, descricao, origem, tipo }, { urlPublica });
      return r.link;
    } catch (error) {
      if (error?.code === 'PAGAMENTO_INDISPONIVEL') return null;
      throw error;
    }
  };
  gerar.valido = (link) => linkAindaValido(db, link);
  return gerar;
}

/** Mesmo gerador, marcando a origem (preserva `valido`). */
export function comOrigem(gerar, origem) {
  if (!gerar) return gerar;
  const f = (d) => gerar({ ...d, origem: d.origem || origem });
  if (gerar.valido) f.valido = gerar.valido;
  return f;
}
