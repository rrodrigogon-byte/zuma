// Contrato digital com aceite eletrônico (item 3 da especificação Kytto Clube & Academia).
//
// Base: MP 2.200-2/2001 art. 10 §2º (aceite entre particulares sem ICP-Brasil, se o meio for aceito
// pelas partes — por isso o modelo deve conter a cláusula de aceite eletrônico) e Lei 14.063/2020
// (assinatura avançada: liga o signatário ao documento, usa dado sob controle exclusivo dele —
// o código de 6 dígitos recebido no WhatsApp dele — e detecta alteração posterior — SHA-256).
// CDC art. 54 §4º: cláusulas que limitam direitos ficam em destaque e são marcadas uma a uma.
//
// Garantias (cada uma tem teste que reproduz o ataque):
// - o código é guardado como HMAC com segredo do servidor (CLUBE_CONTRATO_SECRET): quem lê o banco
//   ou a API de evidências não consegue recuperá-lo por força bruta;
// - tentativas erradas contam na mesma transação travada (limite 5 por código), com teto total
//   de 10 códigos e 15 erros por contrato;
// - a cadeia de evidências é escrita com trava por contrato e não bifurca (índices únicos);
// - a verificação pública recalcula o hash do conteúdo, o hash do comprovante e a cadeia inteira.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ErroDominio, transacao, exigirUuid, exigirTexto, inteiroOpcional } from '../acesso/banco.js';

const sha256 = (texto) => createHash('sha256').update(String(texto)).digest('hex');
const CODIGO_VALIDADE_MS = 10 * 60 * 1000;
const CODIGO_MAX_TENTATIVAS = 5;
const CODIGOS_MAX_POR_CONTRATO = 10;
const ERROS_MAX_POR_CONTRATO = 15;
const LINK_REAPROVEITA_MS = 6 * 60 * 60 * 1000;
const DIA_MS = 86400000;

/** JSON com chaves ordenadas (o JSONB do PostgreSQL não preserva a ordem original). */
export function jsonCanonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor).filter((k) => valor[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${jsonCanonico(valor[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor ?? null);
}

/** Remove undefined e funções, como o JSONB fará ao gravar (o hash precisa bater depois). */
const normalizarJson = (v) => JSON.parse(JSON.stringify(v ?? {}));

function segredoDoCodigo() {
  const s = process.env.CLUBE_CONTRATO_SECRET || '';
  if (s.length < 32) {
    throw new ErroDominio('CONTRATO_SEGREDO_AUSENTE', 'Aceite digital indisponível: configure CLUBE_CONTRATO_SECRET (32+ caracteres).', 503);
  }
  return s;
}
const hmacCodigo = (contratoId, codigo) => createHmac('sha256', segredoDoCodigo()).update(`${contratoId}:${String(codigo).trim()}`).digest('hex');

/* ------------------------------------------------------------------ */
/* Modelo                                                              */
/* ------------------------------------------------------------------ */

const VAR_RE = /\{\{\s*([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*)\s*\}\}/g;

/** Lista as variáveis usadas no texto (ex.: aluno.nome, plano.valor). */
export function variaveisDoModelo(corpo) {
  return [...new Set([...String(corpo).matchAll(VAR_RE)].map((m) => m[1]))];
}

/** Substitui {{a.b}} pelos valores; variável ausente é erro (contrato nunca sai com lacuna). */
export function renderizar(corpo, variaveis = {}) {
  const faltando = [];
  const texto = String(corpo).replace(VAR_RE, (_, caminho) => {
    const valor = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), variaveis);
    if (valor === undefined || valor === null || valor === '') { faltando.push(caminho); return ''; }
    return String(valor);
  });
  if (faltando.length) {
    throw new ErroDominio('VARIAVEIS_FALTANDO', `Preencha: ${[...new Set(faltando)].join(', ')}`);
  }
  return texto;
}

function normalizarDestaques(lista) {
  if (!Array.isArray(lista)) throw new ErroDominio('VALIDATION_ERROR', 'clausulasDestaque deve ser uma lista');
  const ids = new Set();
  return lista.map((c, i) => {
    const id = String(c?.id || `c${i + 1}`).trim().slice(0, 40);
    if (ids.has(id)) throw new ErroDominio('VALIDATION_ERROR', `cláusula de destaque repetida: ${id}`);
    ids.add(id);
    return {
      id,
      titulo: exigirTexto(c?.titulo, 'título da cláusula', { max: 120 }),
      texto: exigirTexto(c?.texto, 'texto da cláusula', { max: 1200 }),
    };
  });
}

/** Cria a versão 1 ou, se o código já existe, a próxima versão (as anteriores ficam inativas). */
export async function salvarModelo(db, empresaId, dados = {}, autor = null) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const codigo = exigirTexto(dados.codigo, 'codigo', { max: 60 }).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const titulo = exigirTexto(dados.titulo, 'titulo', { max: 160 });
  const corpo = exigirTexto(dados.corpo, 'corpo', { min: 50, max: 60000 });
  if (!/aceite eletr[oô]nico|assinatura eletr[oô]nica/i.test(corpo)) {
    throw new ErroDominio(
      'CLAUSULA_ACEITE_OBRIGATORIA',
      'O modelo precisa de uma cláusula em que as partes aceitam o aceite/assinatura eletrônica (MP 2.200-2, art. 10 §2º).',
    );
  }
  const destaques = normalizarDestaques(dados.clausulasDestaque || []);
  const prazo = inteiroOpcional(dados.prazoAceiteDias, 'prazoAceiteDias', { min: 1, max: 60 }) ?? 7;
  return transacao(db, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`clube-contrato-modelo:${empresa}:${codigo}`]);
    const atual = await q('SELECT COALESCE(MAX(versao), 0) AS v FROM clube_contrato_modelos WHERE empresa_id = $1 AND codigo = $2', [empresa, codigo]);
    const versao = Number(atual.rows[0].v) + 1;
    await q('UPDATE clube_contrato_modelos SET ativo = false WHERE empresa_id = $1 AND codigo = $2', [empresa, codigo]);
    const r = await q(
      `INSERT INTO clube_contrato_modelos (empresa_id, codigo, versao, titulo, corpo, clausulas_destaque, prazo_aceite_dias, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [empresa, codigo, versao, titulo, corpo, JSON.stringify(destaques), prazo, autor],
    );
    return modeloPublico(r.rows[0]);
  });
}

function modeloPublico(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    versao: row.versao,
    titulo: row.titulo,
    corpo: row.corpo,
    clausulasDestaque: row.clausulas_destaque,
    prazoAceiteDias: row.prazo_aceite_dias,
    variaveis: variaveisDoModelo(row.corpo),
    ativo: row.ativo,
    criadoEm: row.criado_em,
  };
}

export async function listarModelos(db, empresaId) {
  const r = await db.query(
    'SELECT * FROM clube_contrato_modelos WHERE empresa_id = $1 AND ativo ORDER BY codigo',
    [exigirUuid(empresaId, 'empresa')],
  );
  return r.rows.map(modeloPublico);
}

/* ------------------------------------------------------------------ */
/* Evidências encadeadas                                               */
/* ------------------------------------------------------------------ */

const payloadDoEvento = ({ contratoId, tipo, dados, ip, userAgent, ocorridoEm, anterior }) => jsonCanonico({
  contratoId, tipo, dados, ip: ip ?? null, userAgent: userAgent ?? null, ocorridoEm, anterior: anterior ?? null,
});

/**
 * Grava um elo da cadeia. A trava por contrato (advisory lock da transação) serializa gravações
 * simultâneas; os índices únicos do banco recusam qualquer bifurcação que escape disso.
 */
async function registrarEvidencia(q, { contratoId, empresaId, tipo, dados = {}, ip = null, userAgent = null }) {
  await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`clube-contrato:${contratoId}`]);
  const ultimo = await q('SELECT hash FROM clube_contrato_eventos WHERE contrato_id = $1 ORDER BY id DESC LIMIT 1', [contratoId]);
  const anterior = ultimo.rows[0]?.hash || null;
  const ocorridoEm = new Date().toISOString();
  const dadosNorm = normalizarJson(dados);
  const ua = userAgent ? String(userAgent).slice(0, 300) : null;
  const ipCurto = ip ? String(ip).slice(0, 64) : null;
  const hash = sha256(payloadDoEvento({ contratoId, tipo, dados: dadosNorm, ip: ipCurto, userAgent: ua, ocorridoEm, anterior }));
  await q(
    `INSERT INTO clube_contrato_eventos (contrato_id, empresa_id, tipo, dados, ip, user_agent, ocorrido_em, hash_anterior, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [contratoId, empresaId, tipo, JSON.stringify(dadosNorm), ipCurto, ua, ocorridoEm, anterior, hash],
  );
  return { hash, anterior };
}

/** Confere a cadeia: cada hash bate com o conteúdo do evento e aponta para o anterior. */
export async function verificarCadeia(db, contratoId) {
  const r = await db.query('SELECT * FROM clube_contrato_eventos WHERE contrato_id = $1 ORDER BY id', [contratoId]);
  let anterior = null;
  for (const e of r.rows) {
    const esperado = sha256(payloadDoEvento({
      contratoId: e.contrato_id, tipo: e.tipo, dados: e.dados, ip: e.ip, userAgent: e.user_agent,
      ocorridoEm: new Date(e.ocorrido_em).toISOString(), anterior,
    }));
    if (e.hash_anterior !== anterior || esperado !== e.hash) return { integra: false, eventoId: Number(e.id), eventos: r.rows.length };
    anterior = e.hash;
  }
  return { integra: true, eventos: r.rows.length, ultimo: anterior };
}

/* ------------------------------------------------------------------ */
/* Geração e envio                                                     */
/* ------------------------------------------------------------------ */

/** Formato público (para terceiros verificarem): SHA-256 de jsonCanonico({ conteudo, destaques }). */
export function hashDoConteudo(conteudo, destaques) {
  return sha256(jsonCanonico({ conteudo, destaques }));
}

/**
 * Gera o contrato a partir do modelo ativo e devolve o token do link de aceite (uma única vez).
 * Os dados de aluno e signatário vêm SEMPRE do cadastro; o operador não pode sobrescrevê-los.
 */
export async function gerarContrato(db, empresaId, dados = {}, { agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const customerId = exigirUuid(dados.customerId, 'cliente');
  const signatarioId = dados.signatarioCustomerId ? exigirUuid(dados.signatarioCustomerId, 'responsável') : customerId;
  const tipo = dados.tipo || 'matricula';
  if (!['matricula', 'aditivo', 'cancelamento'].includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'tipo inválido');

  return transacao(db, async (q) => {
    const modelo = dados.modeloId
      ? await q('SELECT * FROM clube_contrato_modelos WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(dados.modeloId, 'modelo')])
      : await q('SELECT * FROM clube_contrato_modelos WHERE empresa_id = $1 AND codigo = $2 AND ativo', [empresa, String(dados.modeloCodigo || '')]);
    const m = modelo.rows[0];
    if (!m) throw new ErroDominio('NOT_FOUND', 'Modelo de contrato não encontrado', 404);

    const pessoas = await q(
      'SELECT id, nome, telefone, email FROM commerce_customers WHERE empresa_id = $1 AND id = ANY($2::uuid[])',
      [empresa, [customerId, signatarioId]],
    );
    const aluno = pessoas.rows.find((p) => p.id === customerId);
    const signatario = pessoas.rows.find((p) => p.id === signatarioId);
    if (!aluno || !signatario) throw new ErroDominio('NOT_FOUND', 'Cliente não encontrado nesta empresa', 404);
    if (!signatario.telefone) throw new ErroDominio('TELEFONE_OBRIGATORIO', 'O signatário precisa de telefone para receber o código no WhatsApp');

    const doOperador = { ...(dados.variaveis || {}) };
    delete doOperador.aluno; delete doOperador.signatario;
    const variaveis = {
      ...doOperador,
      data: { emissao: agora.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' }), ...(doOperador.data || {}) },
      // por último: identidade das partes vem do cadastro, nunca do texto livre do operador
      aluno: { nome: aluno.nome, telefone: aluno.telefone, email: aluno.email },
      signatario: { nome: signatario.nome, telefone: signatario.telefone },
    };
    const conteudo = renderizar(m.corpo, variaveis);
    const destaques = m.clausulas_destaque.map((c) => ({ ...c, texto: renderizar(c.texto, variaveis) }));
    const hashConteudo = hashDoConteudo(conteudo, destaques);
    const token = randomBytes(24).toString('base64url');
    const prazo = new Date(agora.getTime() + m.prazo_aceite_dias * DIA_MS);

    const r = await q(
      `INSERT INTO clube_contratos (empresa_id, customer_id, signatario_customer_id, modelo_id, matricula_id, tipo, titulo,
                              conteudo, clausulas_destaque, hash_conteudo, token_hash, prazo_aceite_em, enviado_em, link_renovado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13) RETURNING id`,
      [empresa, customerId, signatarioId, m.id, dados.matriculaId ? exigirUuid(dados.matriculaId, 'matrícula') : null, tipo,
        m.titulo, conteudo, JSON.stringify(destaques), hashConteudo, sha256(token), prazo, agora],
    );
    const contratoId = r.rows[0].id;
    await registrarEvidencia(q, {
      contratoId, empresaId: empresa, tipo: 'gerado',
      dados: { modelo: m.codigo, versao: m.versao, hashConteudo, signatario: signatario.nome },
    });
    return {
      contratoId,
      token,
      hashConteudo,
      prazoAceiteEm: prazo,
      signatario: { customerId: signatarioId, nome: signatario.nome, telefone: signatario.telefone },
      titulo: m.titulo,
      destaques,
    };
  });
}

/** Mensagem curta de envio para o WhatsApp (resumo + link). */
export function mensagemDeEnvio({ nome, titulo, link, destaques = [] }) {
  const primeiro = String(nome || '').split(' ')[0];
  const resumo = destaques.slice(0, 4).map((d) => `• ${d.titulo}`).join('\n');
  return [
    `Oi, ${primeiro}! Seu ${titulo.toLowerCase()} está pronto.`,
    resumo ? `Pontos importantes:\n${resumo}` : null,
    `Leia e aceite aqui (leva menos de 1 minuto): ${link}`,
  ].filter(Boolean).join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Página pública de aceite                                            */
/* ------------------------------------------------------------------ */

const COLUNAS_PUBLICAS = `c.id, c.empresa_id, c.customer_id, c.signatario_customer_id, c.matricula_id, c.titulo, c.conteudo,
  c.clausulas_destaque, c.hash_conteudo, c.status, c.prazo_aceite_em, c.aceito_em, c.hash_evidencias,
  c.codigo_hash, c.codigo_expira_em, c.codigo_tentativas, c.codigos_emitidos, c.erros_codigo_total`;

async function contratoPorToken(q, token, { travar = false } = {}) {
  if (!token || String(token).length < 20) throw new ErroDominio('NOT_FOUND', 'Link inválido', 404);
  const r = await q(
    `SELECT ${COLUNAS_PUBLICAS}, s.nome AS signatario_nome, s.telefone AS signatario_telefone, a.nome AS aluno_nome
       FROM clube_contratos c
       JOIN commerce_customers s ON s.empresa_id = c.empresa_id AND s.id = c.signatario_customer_id
       JOIN commerce_customers a ON a.empresa_id = c.empresa_id AND a.id = c.customer_id
      WHERE c.token_hash = $1 ${travar ? 'FOR UPDATE OF c' : ''}`,
    [sha256(token)],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Link inválido', 404);
  return r.rows[0];
}

const mascararTelefone = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 4 ? `(**) *****-${d.slice(-4)}` : '***';
};

const bloqueado = (c) => c.codigos_emitidos >= CODIGOS_MAX_POR_CONTRATO || c.erros_codigo_total >= ERROS_MAX_POR_CONTRATO;

function exigirAberto(c, agora) {
  if (c.status !== 'enviado') throw new ErroDominio('CONTRATO_ENCERRADO', 'Este contrato não está mais aguardando aceite', 409);
  if (new Date(c.prazo_aceite_em) < agora) throw new ErroDominio('CONTRATO_EXPIRADO', 'O prazo deste link acabou. Peça um novo link à academia.', 410);
  if (bloqueado(c)) throw new ErroDominio('CONTRATO_BLOQUEADO', 'Por segurança, o aceite deste contrato foi bloqueado. Fale com a academia.', 423);
}

export async function abrirContrato(db, token, { ip, userAgent } = {}) {
  return transacao(db, async (q) => {
    const c = await contratoPorToken(q, token);
    if (c.status === 'enviado') {
      await registrarEvidencia(q, { contratoId: c.id, empresaId: c.empresa_id, tipo: 'aberto', ip, userAgent });
    }
    return {
      titulo: c.titulo,
      status: c.status,
      aluno: c.aluno_nome,
      signatario: c.signatario_nome,
      telefoneCodigo: mascararTelefone(c.signatario_telefone),
      clausulasDestaque: c.clausulas_destaque,
      conteudo: c.conteudo,
      hashConteudo: c.hash_conteudo,
      prazoAceiteEm: c.prazo_aceite_em,
      aceitoEm: c.aceito_em,
      hashEvidencias: c.hash_evidencias,
      bloqueado: bloqueado(c),
    };
  });
}

/**
 * Gera um código de 6 dígitos e devolve-o para o chamador enviar pelo WhatsApp do signatário.
 * No banco fica só o HMAC. Limites: 1 por minuto, 10 por contrato.
 */
export async function solicitarCodigo(db, token, { ip, userAgent, agora = new Date() } = {}) {
  const segredo = segredoDoCodigo(); // falha cedo, antes de gerar qualquer código
  return transacao(db, async (q) => {
    const c = await contratoPorToken(q, token, { travar: true });
    exigirAberto(c, agora);
    if (c.codigo_expira_em && new Date(c.codigo_expira_em).getTime() - CODIGO_VALIDADE_MS + 60000 > agora.getTime()) {
      throw new ErroDominio('AGUARDE', 'Aguarde 1 minuto para pedir outro código', 429);
    }
    const codigo = String(randomInt(0, 1000000)).padStart(6, '0');
    await q(
      `UPDATE clube_contratos SET codigo_hash = $2, codigo_expira_em = $3, codigo_tentativas = 0, codigos_emitidos = codigos_emitidos + 1
       WHERE id = $1`,
      [c.id, createHmac('sha256', segredo).update(`${c.id}:${codigo}`).digest('hex'), new Date(agora.getTime() + CODIGO_VALIDADE_MS)],
    );
    await registrarEvidencia(q, {
      contratoId: c.id, empresaId: c.empresa_id, tipo: 'codigo_enviado',
      dados: { canal: 'whatsapp', destino: mascararTelefone(c.signatario_telefone), numero: c.codigos_emitidos + 1 }, ip, userAgent,
    });
    return {
      codigo,
      contratoId: c.id,
      empresaId: c.empresa_id,
      signatarioCustomerId: c.signatario_customer_id,
      telefone: c.signatario_telefone,
      mensagem: `Seu código para aceitar o contrato é ${codigo}. Ele vale por 10 minutos. Não compartilhe com ninguém, nem com a academia.`,
    };
  });
}

/**
 * Aceite: exige todas as cláusulas de destaque marcadas e o código correto.
 * A tentativa errada conta NA MESMA transação travada (requisições paralelas não furam o limite).
 */
export async function aceitarContrato(db, token, { codigo, clausulasMarcadas = [], ip, userAgent, geo = null, agora = new Date() } = {}) {
  segredoDoCodigo();
  const resultado = await transacao(db, async (q) => {
    const c = await contratoPorToken(q, token, { travar: true });
    exigirAberto(c, agora);

    const exigidas = c.clausulas_destaque.map((d) => d.id);
    const marcadas = new Set((Array.isArray(clausulasMarcadas) ? clausulasMarcadas : []).map(String));
    if (exigidas.some((id) => !marcadas.has(id))) {
      throw new ErroDominio('CLAUSULAS_PENDENTES', 'Marque que leu cada ponto em destaque antes de aceitar');
    }
    if (!c.codigo_hash || !c.codigo_expira_em || new Date(c.codigo_expira_em) < agora) {
      throw new ErroDominio('CODIGO_EXPIRADO', 'Código expirado. Peça um novo código.');
    }
    if (c.codigo_tentativas >= CODIGO_MAX_TENTATIVAS) {
      throw new ErroDominio('CODIGO_BLOQUEADO', 'Muitas tentativas. Peça um novo código.', 429);
    }
    const certo = /^\d{6}$/.test(String(codigo || '').trim())
      && timingSafeEqual(Buffer.from(c.codigo_hash), Buffer.from(hmacCodigo(c.id, codigo)));
    if (!certo) {
      const u = await q(
        `UPDATE clube_contratos SET codigo_tentativas = codigo_tentativas + 1, erros_codigo_total = erros_codigo_total + 1
          WHERE id = $1 RETURNING erros_codigo_total`,
        [c.id],
      );
      await registrarEvidencia(q, { contratoId: c.id, empresaId: c.empresa_id, tipo: 'codigo_invalido', ip, userAgent });
      if (u.rows[0].erros_codigo_total >= ERROS_MAX_POR_CONTRATO) {
        await registrarEvidencia(q, { contratoId: c.id, empresaId: c.empresa_id, tipo: 'bloqueado', dados: { motivo: 'excesso de códigos incorretos' } });
      }
      return { invalido: true }; // confirma a contagem antes de responder o erro
    }

    for (const id of exigidas) {
      await registrarEvidencia(q, { contratoId: c.id, empresaId: c.empresa_id, tipo: 'clausula_marcada', dados: { clausula: id }, ip, userAgent });
    }
    const cadeiaAntes = await q('SELECT hash FROM clube_contrato_eventos WHERE contrato_id = $1 ORDER BY id DESC LIMIT 1', [c.id]);
    const aceitoEm = agora.toISOString();
    const evidencias = normalizarJson({
      contratoId: c.id,
      hashConteudo: c.hash_conteudo,
      signatario: { nome: c.signatario_nome, telefone: mascararTelefone(c.signatario_telefone) },
      aluno: c.aluno_nome,
      metodo: 'codigo_whatsapp_6_digitos',
      clausulasMarcadas: exigidas,
      ip: ip || null,
      userAgent: userAgent || null,
      geo: geo || null,
      aceitoEm,
      ultimoElo: cadeiaAntes.rows[0]?.hash || null, // amarra o comprovante à cadeia
    });
    const hashEvidencias = sha256(jsonCanonico(evidencias));
    await registrarEvidencia(q, { contratoId: c.id, empresaId: c.empresa_id, tipo: 'aceito', dados: { evidencias, hashEvidencias }, ip, userAgent });
    await q(
      `UPDATE clube_contratos SET status = 'aceito', aceito_em = $2, hash_evidencias = $3, codigo_hash = NULL, codigo_expira_em = NULL
       WHERE id = $1`,
      [c.id, aceitoEm, hashEvidencias],
    );
    return {
      aceito: true,
      contratoId: c.id,
      empresaId: c.empresa_id,
      customerId: c.customer_id,
      signatarioCustomerId: c.signatario_customer_id,
      signatarioTelefone: c.signatario_telefone,
      matriculaId: c.matricula_id,
      hashEvidencias,
      aceitoEm,
    };
  });
  if (resultado.invalido) throw new ErroDominio('CODIGO_INVALIDO', 'Código incorreto');
  return resultado;
}

/**
 * Verificação pública pelo hash do comprovante. Recalcula tudo a partir do que está gravado:
 * conteúdo → hash_conteudo, evidências do aceite → hash_evidencias, e a cadeia inteira.
 */
export async function verificarPorHash(db, hash) {
  const h = String(hash || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) throw new ErroDominio('VALIDATION_ERROR', 'Hash inválido');
  const r = await db.query(
    `SELECT c.id, c.titulo, c.status, c.aceito_em, c.conteudo, c.clausulas_destaque, c.hash_conteudo, c.hash_evidencias,
            s.nome AS signatario
       FROM clube_contratos c JOIN commerce_customers s ON s.empresa_id = c.empresa_id AND s.id = c.signatario_customer_id
      WHERE c.hash_evidencias = $1`,
    [h],
  );
  const c = r.rows[0];
  if (!c) return { valido: false };
  const cadeia = await verificarCadeia(db, c.id);
  const aceite = await db.query("SELECT dados, hash_anterior FROM clube_contrato_eventos WHERE contrato_id = $1 AND tipo = 'aceito' ORDER BY id LIMIT 1", [c.id]);
  const ev = aceite.rows[0]?.dados?.evidencias || null;
  const checagens = {
    conteudo: hashDoConteudo(c.conteudo, c.clausulas_destaque) === c.hash_conteudo,
    comprovante: Boolean(ev) && sha256(jsonCanonico(ev)) === c.hash_evidencias && aceite.rows[0].dados.hashEvidencias === c.hash_evidencias,
    vinculo: Boolean(ev) && ev.hashConteudo === c.hash_conteudo && ev.contratoId === c.id && ev.ultimoElo === aceite.rows[0].hash_anterior,
    cadeia: cadeia.integra,
    status: c.status === 'aceito',
  };
  const nome = String(c.signatario || '').split(' ');
  return {
    valido: Object.values(checagens).every(Boolean),
    checagens,
    titulo: c.titulo,
    status: c.status,
    aceitoEm: c.aceito_em,
    signatario: `${nome[0]} ${nome.length > 1 ? `${nome.at(-1)[0]}.` : ''}`.trim(),
    hashConteudo: c.hash_conteudo,
    hashEvidencias: c.hash_evidencias,
    eventos: cadeia.eventos,
  };
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

export async function listarContratos(db, empresaId, { status = '', customerId = null } = {}) {
  const r = await db.query(
    `SELECT c.id, c.titulo, c.tipo, c.status, c.enviado_em, c.prazo_aceite_em, c.aceito_em, c.lembretes_enviados,
            c.customer_id, a.nome AS aluno
       FROM clube_contratos c JOIN commerce_customers a ON a.empresa_id = c.empresa_id AND a.id = c.customer_id
      WHERE c.empresa_id = $1 AND ($2 = '' OR c.status = $2) AND ($3::uuid IS NULL OR c.customer_id = $3)
      ORDER BY c.enviado_em DESC LIMIT 200`,
    [exigirUuid(empresaId, 'empresa'), status, customerId ? exigirUuid(customerId, 'cliente') : null],
  );
  return r.rows.map((x) => ({
    id: x.id, titulo: x.titulo, tipo: x.tipo, status: x.status, aluno: x.aluno, customerId: x.customer_id,
    enviadoEm: x.enviado_em, prazoAceiteEm: x.prazo_aceite_em, aceitoEm: x.aceito_em, lembretes: x.lembretes_enviados,
  }));
}

/** Evidências para o painel e o comprovante. Nunca inclui token, código ou seus hashes. */
export async function evidenciasDoContrato(db, empresaId, contratoId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const id = exigirUuid(contratoId, 'contrato');
  const c = await db.query(
    `SELECT c.id, c.titulo, c.tipo, c.status, c.conteudo, c.clausulas_destaque, c.hash_conteudo, c.hash_evidencias,
            c.enviado_em, c.prazo_aceite_em, c.aceito_em, c.cancelado_em, c.codigos_emitidos, c.erros_codigo_total,
            a.nome AS aluno, s.nome AS signatario
       FROM clube_contratos c
       JOIN commerce_customers a ON a.empresa_id = c.empresa_id AND a.id = c.customer_id
       JOIN commerce_customers s ON s.empresa_id = c.empresa_id AND s.id = c.signatario_customer_id
      WHERE c.empresa_id = $1 AND c.id = $2`,
    [empresa, id],
  );
  if (!c.rows[0]) throw new ErroDominio('NOT_FOUND', 'Contrato não encontrado', 404);
  const ev = await db.query(
    'SELECT tipo, dados, ip, user_agent, ocorrido_em, hash FROM clube_contrato_eventos WHERE empresa_id = $1 AND contrato_id = $2 ORDER BY id',
    [empresa, id],
  );
  return { contrato: c.rows[0], eventos: ev.rows, cadeia: await verificarCadeia(db, id) };
}

export async function cancelarContrato(db, empresaId, contratoId, motivo, operador) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const texto = exigirTexto(motivo, 'motivo', { min: 3, max: 240 });
  return transacao(db, async (q) => {
    const r = await q("UPDATE clube_contratos SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND status = 'enviado' RETURNING id", [empresa, exigirUuid(contratoId, 'contrato')]);
    if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Contrato pendente não encontrado', 404);
    await registrarEvidencia(q, { contratoId: r.rows[0].id, empresaId: empresa, tipo: 'cancelado', dados: { motivo: texto, operador } });
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Integrações                                                         */
/* ------------------------------------------------------------------ */

/** Gancho para o motor de acesso (item 1): contrato de matrícula mais recente. */
export async function contratoParaAcesso(q, { empresaId, customerId }) {
  const r = await q(
    `SELECT status, enviado_em, prazo_aceite_em FROM clube_contratos
      WHERE empresa_id = $1 AND customer_id = $2 AND tipo = 'matricula' AND status <> 'cancelado'
      ORDER BY enviado_em DESC LIMIT 1`,
    [empresaId, customerId],
  );
  const c = r.rows[0];
  return c ? { status: c.status, enviadoEm: new Date(c.enviado_em), prazoAceiteEm: new Date(c.prazo_aceite_em) } : null;
}

/**
 * Novo link para contrato pendente (o anterior deixa de funcionar).
 * Se o link foi renovado há menos de 6 h, não troca (a pessoa pode estar usando-o agora):
 * devolve `reaproveitado: true` e o chamador só lembra de usar o link já enviado.
 */
export async function novoLinkDeAceite(db, empresaId, { contratoId = null, customerId = null, forcar = false, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const colunas = 'c.id, c.titulo, c.clausulas_destaque, c.signatario_customer_id, c.link_renovado_em';
    const r = contratoId
      ? await q(`SELECT ${colunas} FROM clube_contratos c WHERE c.empresa_id = $1 AND c.id = $2 AND c.status = 'enviado' FOR UPDATE`, [empresa, exigirUuid(contratoId, 'contrato')])
      : await q(`SELECT ${colunas} FROM clube_contratos c WHERE c.empresa_id = $1 AND c.customer_id = $2 AND c.tipo = 'matricula' AND c.status = 'enviado' ORDER BY c.enviado_em DESC LIMIT 1 FOR UPDATE`, [empresa, exigirUuid(customerId, 'cliente')]);
    const c = r.rows[0];
    if (!c) throw new ErroDominio('NOT_FOUND', 'Nenhum contrato pendente', 404);
    const s = await q('SELECT nome, telefone FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresa, c.signatario_customer_id]);
    const signatario = { customerId: c.signatario_customer_id, ...s.rows[0] };
    if (!forcar && c.link_renovado_em && agora - new Date(c.link_renovado_em) < LINK_REAPROVEITA_MS) {
      return { contratoId: c.id, reaproveitado: true, titulo: c.titulo, signatario };
    }
    const token = randomBytes(24).toString('base64url');
    // novo prazo de aceite a partir do reenvio (o anterior pode ter vencido)
    await q(
      "UPDATE clube_contratos SET token_hash = $2, link_renovado_em = $3, prazo_aceite_em = GREATEST(prazo_aceite_em, $3::timestamptz + interval '7 days') WHERE id = $1",
      [c.id, sha256(token), agora],
    );
    await registrarEvidencia(q, { contratoId: c.id, empresaId: empresa, tipo: 'enviado', dados: { motivo: 'novo link' } });
    return { contratoId: c.id, token, reaproveitado: false, titulo: c.titulo, destaques: c.clausulas_destaque, signatario };
  });
}

/** Lembretes de aceite no dia 1 e no dia 3 (item 3.4), só para contratos dentro do prazo. */
export async function lembretesDevidos(db, { agora = new Date() } = {}) {
  const r = await db.query(
    `SELECT c.id, c.empresa_id, c.signatario_customer_id, c.titulo, s.nome, s.telefone
       FROM clube_contratos c JOIN commerce_customers s ON s.empresa_id = c.empresa_id AND s.id = c.signatario_customer_id
      WHERE c.status = 'enviado' AND c.prazo_aceite_em > $1
        AND (
          (c.lembretes_enviados = 0 AND c.enviado_em <= $1::timestamptz - interval '1 day')
          OR (c.lembretes_enviados = 1 AND c.enviado_em <= $1::timestamptz - interval '3 days')
        )
      ORDER BY c.enviado_em LIMIT 500`,
    [agora],
  );
  return r.rows.map((x) => ({
    contratoId: x.id,
    empresaId: x.empresa_id,
    customerId: x.signatario_customer_id,
    telefone: x.telefone,
    mensagem: `Oi, ${String(x.nome).split(' ')[0]}! Falta só aceitar seu ${x.titulo.toLowerCase()}. É rápido e pelo link que enviamos. Se precisar, responda aqui que eu reenvio.`,
  }));
}

export async function marcarLembreteEnviado(db, empresaId, contratoId) {
  await transacao(db, async (q) => {
    const r = await q(
      'UPDATE clube_contratos SET lembretes_enviados = lembretes_enviados + 1, ultimo_lembrete_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING lembretes_enviados',
      [empresaId, contratoId],
    );
    if (r.rows[0]) {
      await registrarEvidencia(q, { contratoId, empresaId, tipo: 'lembrete', dados: { numero: r.rows[0].lembretes_enviados } });
    }
  });
}

/** Comprovante imprimível (o navegador salva em PDF). */
export function comprovanteHtml(evid, { urlVerificacao } = {}) {
  const c = evid.contrato;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fmt = (d) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  const linhas = evid.eventos.map((e) => `<tr><td>${esc(fmt(e.ocorrido_em))}</td><td>${esc(e.tipo)}</td><td>${esc(e.ip || '')}</td><td class="h">${esc(e.hash.slice(0, 16))}…</td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(c.titulo)} — comprovante</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:780px;margin:32px auto;padding:0 16px;color:#111}
pre{white-space:pre-wrap;font:inherit}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:12px}
td,th{border-bottom:1px solid #ddd;padding:4px;text-align:left}.h{font-family:monospace}.box{border:1px solid #999;padding:12px;margin:24px 0}</style></head><body>
<h1>${esc(c.titulo)}</h1>
<pre>${esc(c.conteudo)}</pre>
<h2>Pontos em destaque aceitos</h2><ul>${c.clausulas_destaque.map((d) => `<li><b>${esc(d.titulo)}</b>: ${esc(d.texto)}</li>`).join('')}</ul>
<div class="box"><h2>Página de evidências</h2>
<p>Aluno: ${esc(c.aluno)}<br>Signatário: ${esc(c.signatario)}<br>Status: ${esc(c.status)}<br>
Aceito em: ${c.aceito_em ? esc(fmt(c.aceito_em)) : '—'}<br>
Método: código de 6 dígitos enviado ao WhatsApp do signatário</p>
<p>SHA-256 do conteúdo: <span class="h">${esc(c.hash_conteudo)}</span><br>
SHA-256 do comprovante: <span class="h">${esc(c.hash_evidencias || '—')}</span><br>
Cadeia de evidências: ${evid.cadeia.integra ? 'íntegra' : 'ALTERADA'} (${evid.eventos.length} registros)</p>
${urlVerificacao && c.hash_evidencias ? `<p>Verifique em: ${esc(`${urlVerificacao}/${c.hash_evidencias}`)}</p>` : ''}
<table><tr><th>Data/hora</th><th>Evento</th><th>IP</th><th>Hash</th></tr>${linhas}</table></div>
<p style="font-size:12px;color:#555">Para imprimir ou salvar em PDF, use Ctrl+P (Cmd+P no Mac).</p>
</body></html>`;
}
