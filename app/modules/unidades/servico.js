// Unidades (lojas/filiais) de uma empresa, no PostgreSQL de produção (tabela `lojas`, migração 003).
// Substitui o app/routes/lojas.js do server-v2, que usava outro login. Toda consulta é presa à
// empresa vinda do requireCommercePermission; nada vem do corpo da requisição.
import { ErroDominio, exigirUuid, exigirTexto, transacao } from '../acesso/banco.js';

const CAMPOS_TEXTO = {
  nome: { max: 255, obrigatorio: true },
  nome_fantasia: { max: 255 },
  telefone: { max: 20 },
  email: { max: 255 },
  endereco_logradouro: { max: 255 },
  endereco_numero: { max: 20 },
  endereco_complemento: { max: 255 },
  endereco_bairro: { max: 100 },
  endereco_cidade: { max: 100 },
  inscricao_estadual: { max: 20 },
  inscricao_municipal: { max: 20 },
  timezone: { max: 64 },
};

const COLUNAS = `id, empresa_id AS "empresaId", codigo, nome, nome_fantasia, cnpj, inscricao_estadual,
  inscricao_municipal, telefone, email, endereco_logradouro, endereco_numero, endereco_complemento,
  endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, timezone, ativa,
  data_criacao AS "criadoEm", data_atualizacao AS "atualizadoEm"`;

const somenteDigitos = (v) => String(v ?? '').replace(/\D/g, '');

function limparDados(entrada = {}, { criando = false } = {}) {
  const dados = {};
  if (criando || entrada.codigo !== undefined) {
    const codigo = exigirTexto(entrada.codigo, 'Código', { min: 1, max: 30 });
    if (!/^[A-Za-z0-9_-]+$/.test(codigo)) throw new ErroDominio('VALIDATION_ERROR', 'Código aceita só letras, números, hífen e sublinhado');
    dados.codigo = codigo.toUpperCase();
  }
  for (const [campo, regra] of Object.entries(CAMPOS_TEXTO)) {
    if (entrada[campo] === undefined) {
      if (criando && regra.obrigatorio) exigirTexto('', campo === 'nome' ? 'Nome' : campo);
      continue;
    }
    const texto = String(entrada[campo] ?? '').trim();
    if (regra.obrigatorio) dados[campo] = exigirTexto(texto, 'Nome', { min: 2, max: regra.max });
    else {
      if (texto.length > regra.max) throw new ErroDominio('VALIDATION_ERROR', `${campo} deve ter até ${regra.max} caracteres`);
      dados[campo] = texto || null;
    }
  }
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) throw new ErroDominio('VALIDATION_ERROR', 'E-mail inválido');
  if (entrada.cnpj !== undefined) {
    const cnpj = somenteDigitos(entrada.cnpj);
    if (cnpj && cnpj.length !== 14) throw new ErroDominio('VALIDATION_ERROR', 'CNPJ deve ter 14 dígitos');
    dados.cnpj = cnpj || null;
  }
  if (entrada.endereco_cep !== undefined) {
    const cep = somenteDigitos(entrada.endereco_cep);
    if (cep && cep.length !== 8) throw new ErroDominio('VALIDATION_ERROR', 'CEP deve ter 8 dígitos');
    dados.endereco_cep = cep || null;
  }
  if (entrada.endereco_estado !== undefined) {
    const uf = String(entrada.endereco_estado ?? '').trim().toUpperCase();
    if (uf && !/^[A-Z]{2}$/.test(uf)) throw new ErroDominio('VALIDATION_ERROR', 'UF deve ter 2 letras');
    dados.endereco_estado = uf || null;
  }
  if (entrada.ativa !== undefined) {
    if (typeof entrada.ativa !== 'boolean') throw new ErroDominio('VALIDATION_ERROR', 'ativa deve ser verdadeiro ou falso');
    dados.ativa = entrada.ativa;
  }
  if (dados.timezone === null) delete dados.timezone;
  if (dados.timezone) {
    try { new Intl.DateTimeFormat('pt-BR', { timeZone: dados.timezone }); } catch { throw new ErroDominio('VALIDATION_ERROR', 'Fuso horário inválido (ex.: America/Cuiaba)'); }
  }
  return dados;
}

// `lojaRestrita`: quando a permissão da pessoa vale só para uma unidade, tudo fica preso a ela.
function exigirAlcance(lojaRestrita, id) {
  if (lojaRestrita && String(lojaRestrita) !== String(id)) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
}

export async function listarUnidades(db, empresaId, { incluirInativas = false, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const valores = [empresa];
  let filtro = incluirInativas ? '' : ' AND ativa = true';
  if (lojaRestrita) { valores.push(exigirUuid(lojaRestrita, 'unidade')); filtro += ' AND id = $2'; }
  const r = await db.query(`SELECT ${COLUNAS} FROM lojas WHERE empresa_id = $1${filtro} ORDER BY ativa DESC, nome`, valores);
  return r.rows;
}

export async function obterUnidade(db, empresaId, id, { lojaRestrita = null } = {}) {
  exigirAlcance(lojaRestrita, id);
  const r = await db.query(`SELECT ${COLUNAS} FROM lojas WHERE empresa_id = $1 AND id = $2`, [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'unidade')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
  return r.rows[0];
}

export async function criarUnidade(db, empresaId, entrada = {}, { lojaRestrita = null } = {}) {
  if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', 'Criar unidade exige permissão na empresa toda', 403);
  const empresa = exigirUuid(empresaId, 'empresa');
  const dados = limparDados(entrada, { criando: true });
  const campos = Object.keys(dados);
  const valores = campos.map((campo) => dados[campo]);
  try {
    const r = await db.query(
      `INSERT INTO lojas (empresa_id, ${campos.join(', ')}) VALUES ($1, ${campos.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING ${COLUNAS}`,
      [empresa, ...valores],
    );
    return r.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('CONFLICT', 'Já existe uma unidade com este código nesta empresa', 409);
    throw error;
  }
}

// O que deixaria de funcionar se a unidade fosse desativada (cada tabela só se existir).
async function usosDaUnidade(q, empresa, unidade) {
  const existe = async (t) => Boolean((await q('SELECT to_regclass($1) AS t', [t])).rows[0]?.t);
  const consultas = [
    ['commerce_storefronts', 'loja online ativa', "SELECT 1 FROM commerce_storefronts WHERE empresa_id = $1 AND loja_id = $2 AND status = 'active' LIMIT 1"],
    ['pdv_terminais', 'terminal do PDV ativo', 'SELECT 1 FROM pdv_terminais WHERE empresa_id = $1 AND loja_id = $2 AND ativo LIMIT 1'],
    ['est_config', 'unidade do bar no estoque', 'SELECT 1 FROM est_config WHERE empresa_id = $1 AND loja_bar = $2 LIMIT 1'],
    ['fin_config', 'unidade padrão das receitas no Financeiro', 'SELECT 1 FROM fin_config WHERE empresa_id = $1 AND loja_padrao = $2 LIMIT 1'],
  ];
  const usos = [];
  for (const [tabela, nome, sql] of consultas) if (await existe(tabela) && (await q(sql, [empresa, unidade])).rows[0]) usos.push(nome);
  return usos;
}

export async function atualizarUnidade(db, empresaId, id, entrada = {}, { lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const unidade = exigirUuid(id, 'unidade');
  exigirAlcance(lojaRestrita, unidade);
  const dados = limparDados(entrada);
  delete dados.codigo; // o código identifica a unidade em integrações e não muda
  if (lojaRestrita && dados.ativa === false) throw new ErroDominio('PERMISSION_DENIED', 'Desativar unidade exige permissão na empresa toda', 403);
  const campos = Object.keys(dados);
  if (!campos.length) return obterUnidade(db, empresa, unidade);
  return transacao(db, async (q) => {
    // trava as unidades da empresa: duas desativações ao mesmo tempo não zeram as ativas
    const lojas = await q('SELECT id, ativa FROM lojas WHERE empresa_id = $1 ORDER BY id FOR UPDATE', [empresa]);
    if (!lojas.rows.some((l) => l.id === unidade)) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
    if (dados.ativa === false && !lojas.rows.some((l) => l.ativa && l.id !== unidade)) {
      throw new ErroDominio('LAST_STORE', 'A empresa precisa ter pelo menos uma unidade ativa', 409);
    }
    if (dados.ativa === false) {
      const emUso = await usosDaUnidade(q, empresa, unidade);
      if (emUso.length) throw new ErroDominio('STORE_IN_USE', `Esta unidade ainda é usada por: ${emUso.join(', ')}. Troque antes de desativar.`, 409);
    }
    const r = await q(
      `UPDATE lojas SET ${campos.map((campo, i) => `${campo} = $${i + 3}`).join(', ')}, data_atualizacao = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2 RETURNING ${COLUNAS}`,
      [empresa, unidade, ...campos.map((campo) => dados[campo])],
    );
    return r.rows[0];
  });
}

/** Confere a trilha de auditoria encadeada da empresa (função da migração 003). */
export async function verificarAuditoria(db, empresaId, id, { lojaRestrita = null } = {}) {
  const unidade = await obterUnidade(db, empresaId, id, { lojaRestrita });
  const r = await db.query('SELECT * FROM verificar_cadeia_auditoria($1::uuid)', [unidade.empresaId]);
  const verificacao = r.rows[0] || { valida: true, motivo: 'Cadeia sem eventos' };
  return { sucesso: verificacao.valida !== false, unidade, verificacao };
}
