import { ErroDominio, exigirData, exigirTexto, exigirUuid } from '../acesso/banco.js';

const id = (valor, campo = 'id') => exigirUuid(valor, campo);
const numero = (valor, campo, { min = 0, max = 999999999 } = {}) => {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return n;
};
const inteiro = (valor, campo, { min = 0, max = 999999 } = {}) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return n;
};
const dataOpcional = (valor, campo) => valor === undefined || valor === null || valor === '' ? null : exigirData(valor, campo);
const json = (valor, padrao = {}) => valor && typeof valor === 'object' ? JSON.stringify(valor) : JSON.stringify(padrao);

function clienteDto(row) {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo || 'pf',
    cpfCnpj: row.documento_mascarado || '',
    email: row.email || '',
    telefone: row.telefone || '',
    endereco: row.endereco || '',
    limiteCreditoMensal: Number(row.limite_credito_mensal || 0),
    diasVencimento: Number(row.dias_vencimento || 30),
    observacao: row.observacao || '',
    saldoDevedor: Number(row.saldo_devedor || 0),
    scoreCredito: Number(row.score_credito ?? 100),
    risco: row.risco || 'baixo',
    padrao: Boolean(row.padrao),
    status: row.bloqueado ? 'bloqueado' : 'ativo',
  };
}

export async function listarClientes(db, empresaId) {
  const empresa = id(empresaId, 'empresa');
  const result = await db.query(`
    SELECT c.*, COALESCE(SUM(CASE WHEN cr.data_pagamento IS NULL THEN cr.valor ELSE 0 END), 0) AS saldo_devedor,
           CASE WHEN COALESCE(SUM(CASE WHEN cr.data_pagamento IS NULL THEN cr.valor ELSE 0 END), 0) = 0 THEN 100
                WHEN COALESCE(SUM(CASE WHEN cr.data_pagamento IS NULL THEN cr.valor ELSE 0 END), 0) <= c.limite_credito_mensal THEN 70 ELSE 35 END AS score_credito,
           CASE WHEN COALESCE(SUM(CASE WHEN cr.data_pagamento IS NULL THEN cr.valor ELSE 0 END), 0) = 0 THEN 'baixo'
                WHEN COALESCE(SUM(CASE WHEN cr.data_pagamento IS NULL THEN cr.valor ELSE 0 END), 0) <= c.limite_credito_mensal THEN 'medio' ELSE 'alto' END AS risco,
           COALESCE((c.metadados->>'padrao')::boolean, false) AS padrao
      FROM commerce_customers c
      LEFT JOIN a2_contas_receber cr ON cr.empresa_id = c.empresa_id AND cr.cliente_id = c.id
     WHERE c.empresa_id = $1 AND c.bloqueado = false
     GROUP BY c.id
     ORDER BY lower(c.nome)`, [empresa]);
  return result.rows.map(clienteDto);
}

async function clienteExiste(db, empresaId, clienteId) {
  const result = await db.query('SELECT id FROM commerce_customers WHERE empresa_id = $1 AND id = $2 AND bloqueado = false LIMIT 1', [id(empresaId, 'empresa'), id(clienteId, 'cliente')]);
  if (!result.rows[0]) throw new ErroDominio('CUSTOMER_NOT_FOUND', 'Cliente não encontrado', 404);
  return result.rows[0].id;
}

export async function salvarCliente(db, empresaId, corpo = {}, clienteId = null) {
  const empresa = id(empresaId, 'empresa');
  const nome = exigirTexto(corpo.nome, 'nome', { max: 240 });
  const tipo = ['pf', 'pj'].includes(String(corpo.tipo || 'pf')) ? String(corpo.tipo || 'pf') : (() => { throw new ErroDominio('VALIDATION_ERROR', 'tipo de cliente inválido'); })();
  const email = corpo.email ? exigirTexto(corpo.email, 'email', { max: 320 }) : null;
  const telefone = corpo.telefone ? exigirTexto(corpo.telefone, 'telefone', { max: 30 }) : null;
  const documento = corpo.cpfCnpj ? exigirTexto(corpo.cpfCnpj, 'cpfCnpj', { max: 40 }) : null;
  const limite = numero(corpo.limiteCreditoMensal ?? 0, 'limiteCreditoMensal');
  const dias = inteiro(corpo.diasVencimento ?? 30, 'diasVencimento', { min: 1, max: 365 });
  const endereco = corpo.endereco ? exigirTexto(corpo.endereco, 'endereco', { max: 500 }) : null;
  const observacao = corpo.observacao ? exigirTexto(corpo.observacao, 'observacao', { max: 2000 }) : null;
  if (clienteId) {
    const result = await db.query(`UPDATE commerce_customers SET nome=$1, email=$2, telefone=$3, documento_mascarado=$4, tipo=$5, endereco=$6, limite_credito_mensal=$7, dias_vencimento=$8, observacao=$9, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$10 AND id=$11 AND bloqueado=false RETURNING *`, [nome, email, telefone, documento, tipo, endereco, limite, dias, observacao, empresa, id(clienteId, 'cliente')]);
    if (!result.rows[0]) throw new ErroDominio('CUSTOMER_NOT_FOUND', 'Cliente não encontrado', 404);
    return clienteDto(result.rows[0]);
  }
  const result = await db.query(`INSERT INTO commerce_customers (empresa_id, nome, email, telefone, documento_mascarado, tipo, endereco, limite_credito_mensal, dias_vencimento, observacao, consentimentos, metadados) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'{}'::jsonb,'{}'::jsonb) RETURNING *`, [empresa, nome, email, telefone, documento, tipo, endereco, limite, dias, observacao]);
  return clienteDto(result.rows[0]);
}

function contaDto(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    mesaNumero: Number(row.mesa_numero || 0),
    descricao: row.descricao,
    valor: Number(row.valor),
    dataVencimento: row.data_vencimento,
    dataPagamento: row.data_pagamento,
    observacao: row.observacao || '',
    status: row.data_pagamento ? 'paga' : row.status,
  };
}

const contasSql = `SELECT cr.*, CASE WHEN cr.data_pagamento IS NOT NULL THEN 'paga' WHEN cr.data_vencimento < CURRENT_DATE THEN 'atrasada' ELSE 'pendente' END AS status FROM a2_contas_receber cr WHERE cr.empresa_id = $1`;

export async function listarContas(db, empresaId) {
  const result = await db.query(`${contasSql} ORDER BY cr.data_vencimento ASC, cr.criado_em DESC`, [id(empresaId, 'empresa')]);
  return result.rows.map(contaDto);
}

export async function criarConta(db, empresaId, corpo = {}, operador = null) {
  const empresa = id(empresaId, 'empresa');
  const cliente = await clienteExiste(db, empresa, corpo.clienteId);
  const descricao = exigirTexto(corpo.descricao, 'descricao', { max: 240 });
  const valor = numero(corpo.valor, 'valor', { min: 0.01 });
  const vencimento = exigirData(String(corpo.dataVencimento || '').slice(0, 10), 'dataVencimento');
  const mesa = inteiro(corpo.mesaNumero || 0, 'mesaNumero', { max: 9999 });
  const observacao = corpo.observacao ? exigirTexto(corpo.observacao, 'observacao', { max: 2000 }) : null;
  const criadoPor = operador && /^[0-9a-f-]{36}$/i.test(String(operador)) ? operador : null;
  const result = await db.query(`INSERT INTO a2_contas_receber (empresa_id, cliente_id, mesa_numero, descricao, valor, data_vencimento, observacao, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *, 'pendente' AS status`, [empresa, cliente, mesa, descricao, valor, vencimento, observacao, criadoPor]);
  return contaDto(result.rows[0]);
}

export async function baixarConta(db, empresaId, contaId, dataPagamento = new Date()) {
  const result = await db.query(`UPDATE a2_contas_receber SET data_pagamento=COALESCE(data_pagamento,$1), atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$2 AND id=$3 RETURNING *, CASE WHEN data_pagamento IS NOT NULL THEN 'paga' ELSE 'pendente' END AS status`, [dataPagamento, id(empresaId, 'empresa'), id(contaId, 'conta')]);
  if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'Conta a receber não encontrada', 404);
  return contaDto(result.rows[0]);
}

export async function listarAlertas(db, empresaId) {
  const result = await db.query(`SELECT id AS conta_id, cliente_id, valor, CASE WHEN data_vencimento < CURRENT_DATE THEN 'atrasada' ELSE 'vencimento_proximo' END AS tipo, GREATEST(CURRENT_DATE - data_vencimento, 0) AS dias_atraso, GREATEST(data_vencimento - CURRENT_DATE, 0) AS dias_ate_venc, CASE WHEN data_vencimento < CURRENT_DATE - 7 THEN 'critica' ELSE 'atencao' END AS severidade FROM a2_contas_receber WHERE empresa_id=$1 AND data_pagamento IS NULL AND data_vencimento <= CURRENT_DATE + 7 ORDER BY data_vencimento`, [id(empresaId, 'empresa')]);
  return result.rows.map((row) => ({ contaId: row.conta_id, clienteId: row.cliente_id, valor: Number(row.valor), tipo: row.tipo, diasAtraso: Number(row.dias_atraso), diasAteVenc: Number(row.dias_ate_venc), severidade: row.severidade }));
}

async function resumo(db, empresaId) {
  const result = await db.query(`SELECT COALESCE(SUM(valor),0) AS total_receber, COALESCE(SUM(valor) FILTER (WHERE data_pagamento IS NOT NULL AND data_pagamento::date = CURRENT_DATE),0) AS total_recebido, COALESCE(SUM(valor) FILTER (WHERE data_pagamento IS NULL AND data_vencimento >= CURRENT_DATE),0) AS total_pendente, COALESCE(SUM(valor) FILTER (WHERE data_pagamento IS NULL AND data_vencimento < CURRENT_DATE),0) AS total_atrasado FROM a2_contas_receber WHERE empresa_id=$1`, [id(empresaId, 'empresa')]);
  const alertas = await listarAlertas(db, empresaId);
  const row = result.rows[0] || {};
  return { totalReceber: Number(row.total_receber || 0), totalRecebido: Number(row.total_recebido || 0), totalPendente: Number(row.total_pendente || 0), totalAtrasado: Number(row.total_atrasado || 0), alertas: alertas.length };
}

export async function listarFechamentos(db, empresaId) {
  const result = await db.query('SELECT * FROM a2_fechamentos_diarios WHERE empresa_id=$1 ORDER BY data_fechamento DESC, criado_em DESC', [id(empresaId, 'empresa')]);
  return result.rows.map((row) => ({ id: row.id, dataFechamento: row.data_fechamento, totalReceber: Number(row.total_receber), totalRecebido: Number(row.total_recebido), totalPendente: Number(row.total_pendente), totalAtrasado: Number(row.total_atrasado), alertas: Number(row.alertas), responsavel: row.responsavel, observacao: row.observacao || '', criadoEm: row.criado_em }));
}

export async function criarFechamento(db, empresaId, observacao, responsavel) {
  const empresa = id(empresaId, 'empresa');
  const fin = await resumo(db, empresa);
  const nome = exigirTexto(responsavel || 'Sistema', 'responsavel', { max: 240 });
  const obs = observacao ? exigirTexto(observacao, 'observacao', { max: 2000 }) : null;
  const result = await db.query(`INSERT INTO a2_fechamentos_diarios (empresa_id, data_fechamento, total_receber, total_recebido, total_pendente, total_atrasado, alertas, responsavel, observacao) VALUES ($1,CURRENT_DATE,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [empresa, fin.totalReceber, fin.totalRecebido, fin.totalPendente, fin.totalAtrasado, fin.alertas, nome, obs]);
  return (await listarFechamentos(db, empresa)).find((item) => item.id === result.rows[0].id);
}

const TABELAS = {
  funcionarios: { tabela: 'a2_funcionarios', campos: ['nome', 'cpf', 'email', 'telefone', 'cargo', 'departamento', 'data_admissao', 'salario', 'status', 'observacao'] },
  fornecedores: { tabela: 'a2_fornecedores', campos: ['nome', 'cnpj', 'inscricao_estadual', 'email', 'telefone', 'endereco', 'condicao_pagamento', 'status', 'observacao'] },
};

function cadastroDto(tipo, row) {
  if (tipo === 'funcionarios') return { ...row, dataAdmissao: row.data_admissao, criadoEm: row.criado_em, atualizadoEm: row.atualizado_em };
  return { ...row, inscricaoEstadual: row.inscricao_estadual, condicaoPagamento: row.condicao_pagamento, criadoEm: row.criado_em, atualizadoEm: row.atualizado_em };
}

export async function listarCadastros(db, empresaId, tipo) {
  const cfg = TABELAS[tipo];
  if (!cfg) throw new ErroDominio('VALIDATION_ERROR', 'cadastro inválido');
  const result = await db.query(`SELECT * FROM ${cfg.tabela} WHERE empresa_id=$1 ORDER BY lower(nome)`, [id(empresaId, 'empresa')]);
  return result.rows.map((row) => cadastroDto(tipo, row));
}

export async function salvarCadastro(db, empresaId, tipo, corpo = {}, registroId = null) {
  const cfg = TABELAS[tipo];
  if (!cfg) throw new ErroDominio('VALIDATION_ERROR', 'cadastro inválido');
  const empresa = id(empresaId, 'empresa');
  const nome = exigirTexto(corpo.nome, 'nome', { max: 240 });
  const aliases = { dataAdmissao: 'data_admissao', condicaoPagamento: 'condicao_pagamento', inscricaoEstadual: 'inscricao_estadual' };
  const valores = cfg.campos.map((campo) => {
    const chave = Object.entries(aliases).find(([, v]) => v === campo)?.[0] || campo;
    if (campo === 'nome') return nome;
    if (campo === 'data_admissao') return dataOpcional(corpo[chave], chave);
    if (campo === 'salario') return corpo[chave] === '' || corpo[chave] == null ? null : numero(corpo[chave], chave);
    return corpo[chave] === undefined || corpo[chave] === '' ? null : String(corpo[chave]).slice(0, 2000);
  });
  if (registroId) {
    const sets = cfg.campos.map((campo, index) => `${campo}=$${index + 1}`).join(', ');
    const result = await db.query(`UPDATE ${cfg.tabela} SET ${sets}, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$${valores.length + 1} AND id=$${valores.length + 2} RETURNING *`, [...valores, empresa, id(registroId, 'registro')]);
    if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'Cadastro não encontrado', 404);
    return cadastroDto(tipo, result.rows[0]);
  }
  const result = await db.query(`INSERT INTO ${cfg.tabela} (empresa_id, ${cfg.campos.join(',')}) VALUES ($1, ${cfg.campos.map((_, index) => `$${index + 2}`).join(',')}) RETURNING *`, [empresa, ...valores]);
  return cadastroDto(tipo, result.rows[0]);
}

export async function listarUsuariosMestres(db, empresaId) {
  const result = await db.query('SELECT * FROM a2_usuarios_mestres WHERE empresa_id=$1 ORDER BY lower(nome)', [id(empresaId, 'empresa')]);
  return result.rows.map(usuarioMestreDto);
}

function usuarioMestreDto(row, perfis = null) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email || '',
    telefone: row.telefone || '',
    tipoUsuario: row.tipo_usuario || 'operador_pdv',
    perfis: perfis || (Array.isArray(row.perfis) ? row.perfis : []),
    senhaInicialConfigurada: Boolean(row.senha_inicial_configurada),
    senhaInicial: '',
    ativo: row.ativo !== false,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export async function salvarUsuarioMestre(db, empresaId, corpo = {}, registroId = null) {
  const empresa = id(empresaId, 'empresa');
  const nome = exigirTexto(corpo.nome, 'nome', { max: 240 });
  const email = corpo.email ? exigirTexto(corpo.email, 'email', { max: 320 }) : null;
  const telefone = corpo.telefone ? exigirTexto(corpo.telefone, 'telefone', { max: 30 }) : null;
  const tipo = exigirTexto(corpo.tipoUsuario || 'operador_pdv', 'tipoUsuario', { max: 40 });
  const perfis = Array.isArray(corpo.perfis) ? corpo.perfis.map((item) => exigirTexto(item, 'perfil', { max: 80 })) : [];
  if (!perfis.length) throw new ErroDominio('VALIDATION_ERROR', 'Selecione ao menos um perfil de acesso.');
  const ativo = corpo.ativo !== false;
  const temSenha = Boolean(corpo.senhaInicial);
  if (registroId) {
    const result = await db.query('UPDATE a2_usuarios_mestres SET nome=$1,email=$2,telefone=$3,tipo_usuario=$4,perfis=$5::jsonb,senha_inicial_configurada=senha_inicial_configurada OR $6,ativo=$7,atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$8 AND id=$9 RETURNING *', [nome, email, telefone, tipo, json(perfis, []), temSenha, ativo, empresa, id(registroId, 'registro')]);
    if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'Usuário mestre não encontrado', 404);
    return usuarioMestreDto(result.rows[0], perfis);
  }
  if (!temSenha || String(corpo.senhaInicial).length < 8) throw new ErroDominio('VALIDATION_ERROR', 'A senha inicial deve ter ao menos 8 caracteres.');
  const result = await db.query('INSERT INTO a2_usuarios_mestres (empresa_id,nome,email,telefone,tipo_usuario,perfis,senha_inicial_configurada,ativo) VALUES ($1,$2,$3,$4,$5,$6::jsonb,true,$7) RETURNING *', [empresa, nome, email, telefone, tipo, json(perfis, []), ativo]);
  return usuarioMestreDto(result.rows[0], perfis);
}

export async function obterEmpresa(db, empresaId) {
  const result = await db.query('SELECT id, nome, nome AS nome_fantasia, cnpj, tipo_negocio, ativa FROM empresas WHERE id=$1', [id(empresaId, 'empresa')]);
  if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'Empresa não encontrada', 404);
  const row = result.rows[0];
  return { id: row.id, nome: row.nome, nomeFantasia: row.nome_fantasia || row.nome, cnpj: row.cnpj || '', tipoNegocio: row.tipo_negocio || 'outro', ativa: row.ativa !== false };
}

export { clienteDto, contaDto, resumo };
