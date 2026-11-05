import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ErroDominio, exigirUuid, exigirTexto } from '../acesso/banco.js';
import * as jsonStore from '../../cadastros-mestres-kytto.js';
import { barramentoA2 } from '../a2/eventos.js';
import { db as getDb, save as saveDb } from '../../db.js';

const CAMPOS_TEXTO = {
  nome: { max: 255, obrigatorio: true },
  razao_social: { max: 255, obrigatorio: true },
  inscricao_estadual: { max: 30 },
  inscricao_municipal: { max: 30 },
  telefone: { max: 30 },
  email: { max: 255 },
  website: { max: 255 },
  endereco_logradouro: { max: 255 },
  endereco_numero: { max: 30 },
  endereco_complemento: { max: 255 },
  endereco_bairro: { max: 100 },
  endereco_cidade: { max: 100 },
  endereco_estado: { max: 2 },
  endereco_cep: { max: 9 },
  tipo_negocio: { max: 50 },
};

const somenteDigitos = (v) => String(v ?? '').replace(/\D/g, '');

function normalizarCnpj(valor) {
  const d = somenteDigitos(valor);
  if (d && d.length !== 14) {
    throw new ErroDominio('VALIDATION_ERROR', 'CNPJ deve ter exatamente 14 dígitos numéricos.');
  }
  return d || null;
}

function formatarCnpj(cnpj) {
  const d = somenteDigitos(cnpj);
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }
  return cnpj || '';
}

function formatarCep(cep) {
  const d = somenteDigitos(cep);
  if (d.length === 8) {
    return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
  }
  return cep || '';
}

function empresaDto(row, totalLojas = 1) {
  if (!row) return null;
  const cnpjLimpo = somenteDigitos(row.cnpj);
  return {
    id: row.id,
    nome: row.nome || '',
    nomeFantasia: row.nome || '',
    razaoSocial: row.razao_social || row.nome || '',
    cnpj: formatarCnpj(cnpjLimpo),
    cnpjNormalizado: cnpjLimpo,
    inscricaoEstadual: row.inscricao_estadual || '',
    inscricaoMunicipal: row.inscricao_municipal || '',
    tipoNegocio: row.tipo_negocio || 'outro',
    telefone: row.telefone || '',
    email: row.email || '',
    website: row.website || '',
    enderecoLogradouro: row.endereco_logradouro || '',
    enderecoNumero: row.endereco_numero || '',
    enderecoComplemento: row.endereco_complemento || '',
    enderecoBairro: row.endereco_bairro || '',
    enderecoCidade: row.endereco_cidade || '',
    enderecoEstado: row.endereco_estado || '',
    enderecoCep: formatarCep(row.endereco_cep || ''),
    endereco: [
      row.endereco_logradouro,
      row.endereco_numero ? `nº ${row.endereco_numero}` : '',
      row.endereco_complemento,
      row.endereco_bairro,
      row.endereco_cidade ? `${row.endereco_cidade}/${row.endereco_estado || ''}` : '',
      row.endereco_cep ? `CEP ${formatarCep(row.endereco_cep)}` : ''
    ].filter(Boolean).join(', ') || 'Endereço não cadastrado',
    ativa: row.ativa !== false,
    permitirEstoqueNegativo: row.permitir_estoque_negativo !== false,
    totalLojas: Number(totalLojas || 0),
    criadoEm: row.data_criacao || row.criadaEm || null,
    atualizadoEm: row.data_atualizacao || row.atualizadaEm || null,
  };
}

/**
 * Lista todas as empresas cadastradas no sistema.
 */
export async function listarEmpresas(db, { incluirInativas = false } = {}) {
  let empresas = [];

  try {
    const sql = `
      SELECT e.id::text, e.nome, e.razao_social, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
             e.tipo_negocio, e.endereco_logradouro, e.endereco_numero, e.endereco_complemento,
             e.endereco_bairro, e.endereco_cidade, e.endereco_estado, e.endereco_cep,
             e.telefone, e.email, e.website, e.ativa, e.data_criacao, e.data_atualizacao,
             COUNT(l.id)::int AS total_lojas
        FROM empresas e
        LEFT JOIN lojas l ON l.empresa_id = e.id AND l.ativa = true
       WHERE ${incluirInativas ? '1=1' : 'e.ativa = true'}
       GROUP BY e.id, e.nome, e.razao_social, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
                e.tipo_negocio, e.endereco_logradouro, e.endereco_numero, e.endereco_complemento,
                e.endereco_bairro, e.endereco_cidade, e.endereco_estado, e.endereco_cep,
                e.telefone, e.email, e.website, e.ativa, e.data_criacao, e.data_atualizacao
       ORDER BY e.nome ASC
    `;
    const res = await db.query(sql);
    empresas = (res.rows || []).map((r) => empresaDto(r, r.total_lojas));
  } catch (err) {
    console.warn('[empresas] Consulta no PostgreSQL indisponível ou falhou, usando Datastore JSON:', err.message);
  }

  // Sincroniza / merge com empresas do Datastore JSON
  try {
    const empresasJson = jsonStore.listarEmpresas({ incluirInativas });
    for (const ej of empresasJson) {
      const jaExiste = empresas.find((e) => e.id === ej.id || (e.cnpjNormalizado && e.cnpjNormalizado === somenteDigitos(ej.cnpj)));
      if (!jaExiste) {
        empresas.push({
          id: ej.id,
          nome: ej.nomeFantasia || ej.nome,
          nomeFantasia: ej.nomeFantasia || ej.nome,
          razaoSocial: ej.nome || ej.nomeFantasia,
          cnpj: formatarCnpj(ej.cnpj),
          cnpjNormalizado: somenteDigitos(ej.cnpj),
          inscricaoEstadual: ej.inscricaoEstadual || '',
          inscricaoMunicipal: ej.inscricaoMunicipal || '',
          tipoNegocio: ej.tipoNegocio || 'outro',
          telefone: ej.telefone || '',
          email: ej.email || '',
          website: ej.website || '',
          endereco: ej.endereco || '',
          ativa: ej.ativa !== false,
          permitirEstoqueNegativo: ej.permitirEstoqueNegativo !== false,
          totalLojas: 1,
          criadoEm: ej.criadaEm,
          atualizadoEm: ej.atualizadaEm,
        });
      }
    }
  } catch (e) {
    console.warn('[empresas] Falha no merge com Datastore JSON:', e.message);
  }

  return empresas;
}

/**
 * Obtém os detalhes completos de uma empresa por ID.
 */
export async function obterEmpresaPorId(db, empresaId) {
  const idStr = String(empresaId || '').trim();
  if (!idStr) throw new ErroDominio('VALIDATION_ERROR', 'ID da empresa é obrigatório');

  try {
    const res = await db.query(
      `SELECT e.id::text, e.nome, e.razao_social, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
              e.tipo_negocio, e.endereco_logradouro, e.endereco_numero, e.endereco_complemento,
              e.endereco_bairro, e.endereco_cidade, e.endereco_estado, e.endereco_cep,
              e.telefone, e.email, e.website, e.ativa, e.data_criacao, e.data_atualizacao,
              COUNT(l.id)::int AS total_lojas
         FROM empresas e
         LEFT JOIN lojas l ON l.empresa_id = e.id AND l.ativa = true
        WHERE e.id::text = $1
        GROUP BY e.id, e.nome, e.razao_social, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
                 e.tipo_negocio, e.endereco_logradouro, e.endereco_numero, e.endereco_complemento,
                 e.endereco_bairro, e.endereco_cidade, e.endereco_estado, e.endereco_cep,
                 e.telefone, e.email, e.website, e.ativa, e.data_criacao, e.data_atualizacao`,
      [idStr]
    );
    if (res.rows[0]) return empresaDto(res.rows[0], res.rows[0].total_lojas);
  } catch (err) {
    console.warn('[empresas] Falha ao consultar empresa no PG:', err.message);
  }

  // Fallback Datastore JSON
  const ej = jsonStore.obterEmpresa(idStr);
  if (ej) {
    return {
      id: ej.id,
      nome: ej.nomeFantasia || ej.nome,
      nomeFantasia: ej.nomeFantasia || ej.nome,
      razaoSocial: ej.nome || ej.nomeFantasia,
      cnpj: formatarCnpj(ej.cnpj),
      cnpjNormalizado: somenteDigitos(ej.cnpj),
      inscricaoEstadual: ej.inscricaoEstadual || '',
      inscricaoMunicipal: ej.inscricaoMunicipal || '',
      tipoNegocio: ej.tipoNegocio || 'outro',
      telefone: ej.telefone || '',
      email: ej.email || '',
      website: ej.website || '',
      endereco: ej.endereco || '',
      ativa: ej.ativa !== false,
      permitirEstoqueNegativo: ej.permitirEstoqueNegativo !== false,
      totalLojas: 1,
      criadoEm: ej.criadaEm,
      atualizadoEm: ej.atualizadaEm,
    };
  }

  throw new ErroDominio('NOT_FOUND', 'Empresa não encontrada', 404);
}

/**
 * Cria uma nova empresa com dados completos, loja matriz e administrador opcional.
 */
export async function criarEmpresa(db, dados = {}, usuarioOperador = null) {
  const nomeFantasia = exigirTexto(dados.nome || dados.nomeFantasia, 'Nome Fantasia', { min: 2, max: 255 });
  const razaoSocial = exigirTexto(dados.razaoSocial || dados.razao_social || nomeFantasia, 'Razão Social', { min: 2, max: 255 });
  const cnpjNormalizadoDoc = normalizarCnpj(dados.cnpj);

  const novoId = crypto.randomUUID();
  const tipoNegocio = ['barbearia', 'loja', 'bar', 'esporte', 'supermercado', 'restaurante', 'clube', 'outro'].includes(dados.tipoNegocio)
    ? dados.tipoNegocio
    : 'outro';

  const ie = dados.inscricaoEstadual || dados.inscricao_estadual ? String(dados.inscricaoEstadual || dados.inscricao_estadual).trim().slice(0, 30) : null;
  const im = dados.inscricaoMunicipal || dados.inscricao_municipal ? String(dados.inscricaoMunicipal || dados.inscricao_municipal).trim().slice(0, 30) : null;
  const tel = dados.telefone ? String(dados.telefone).trim().slice(0, 30) : null;
  const email = dados.email ? String(dados.email).trim().toLowerCase().slice(0, 255) : null;
  const website = dados.website ? String(dados.website).trim().slice(0, 255) : null;

  const logradouro = dados.enderecoLogradouro || dados.endereco_logradouro ? String(dados.enderecoLogradouro || dados.endereco_logradouro).trim().slice(0, 255) : null;
  const numero = dados.enderecoNumero || dados.endereco_numero ? String(dados.enderecoNumero || dados.endereco_numero).trim().slice(0, 30) : null;
  const complemento = dados.enderecoComplemento || dados.endereco_complemento ? String(dados.enderecoComplemento || dados.endereco_complemento).trim().slice(0, 255) : null;
  const bairro = dados.enderecoBairro || dados.endereco_bairro ? String(dados.enderecoBairro || dados.endereco_bairro).trim().slice(0, 100) : null;
  const cidade = dados.enderecoCidade || dados.endereco_cidade ? String(dados.enderecoCidade || dados.endereco_cidade).trim().slice(0, 100) : null;
  const estado = dados.enderecoEstado || dados.endereco_estado ? String(dados.enderecoEstado || dados.endereco_estado).trim().toUpperCase().slice(0, 2) : null;
  const cep = dados.enderecoCep || dados.endereco_cep ? somenteDigitos(dados.enderecoCep || dados.endereco_cep).slice(0, 8) : null;

  let registroCriado = null;

  // 1. Inserir no PostgreSQL
  try {
    const res = await db.query(
      `INSERT INTO empresas (
        id, nome, razao_social, cnpj, inscricao_estadual, inscricao_municipal, tipo_negocio,
        endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro,
        endereco_cidade, endereco_estado, endereco_cep, telefone, email, website, ativa
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true
      ) RETURNING *`,
      [
        novoId, nomeFantasia, razaoSocial, cnpjNormalizadoDoc || '00000000000000',
        ie, im, tipoNegocio, logradouro, numero, complemento, bairro, cidade, estado, cep,
        tel, email, website
      ]
    );
    registroCriado = res.rows[0];

    // Criar unidade Matriz por padrão se não existir
    if (dados.criarLojaMatriz !== false) {
      const lojaId = crypto.randomUUID();
      const codigoMatriz = `${nomeFantasia.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'EMP'}-MATRIZ`;
      await db.query(
        `INSERT INTO lojas (
          id, empresa_id, codigo, nome, cnpj, inscricao_estadual, inscricao_municipal,
          telefone, email, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, ativa
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true
        ) ON CONFLICT (empresa_id, codigo) DO NOTHING`,
        [
          lojaId, novoId, codigoMatriz, `${nomeFantasia} · Matriz`, cnpjNormalizadoDoc,
          ie, im, tel, email, logradouro, numero, bairro, cidade, estado, cep
        ]
      );
    }
  } catch (err) {
    console.warn('[empresas] Não foi possível persistir no PostgreSQL, salvando no Datastore JSON:', err.message);
  }

  // 2. Persistir no Datastore JSON Kytto para compatibilidade com todos os módulos
  try {
    const estadoJson = getDb();
    estadoJson.cadastrosMestresKytto ||= {};
    estadoJson.cadastrosMestresKytto.empresas ||= {};
    estadoJson.cadastrosMestresKytto.empresas[novoId] = {
      id: novoId,
      nome: razaoSocial,
      nomeFantasia,
      cnpj: formatarCnpj(cnpjNormalizadoDoc),
      cnpjNormalizado: cnpjNormalizadoDoc,
      inscricaoEstadual: ie || '',
      inscricaoMunicipal: im || '',
      tipoNegocio,
      endereco: [logradouro, numero, complemento, bairro, cidade ? `${cidade}/${estado}` : '', cep ? `CEP ${cep}` : ''].filter(Boolean).join(', '),
      telefone: tel || '',
      email: email || '',
      website: website || '',
      ativa: true,
      permitirEstoqueNegativo: dados.permitirEstoqueNegativo !== false,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    };
    saveDb();
  } catch (e) {
    console.warn('[empresas] Erro ao salvar no Datastore JSON:', e.message);
  }

  // 3. Criar Administrador Inicial se fornecido
  if (dados.administrador?.email && dados.administrador?.senhaInicial) {
    const admNome = String(dados.administrador.nome || 'Administrador').trim();
    const admEmail = String(dados.administrador.email).trim().toLowerCase();
    const admSenha = String(dados.administrador.senhaInicial).trim();
    if (admSenha.length >= 6) {
      const senhaHash = bcrypt.hashSync(admSenha, 10);
      try {
        const userId = crypto.randomUUID();
        await db.query(
          `INSERT INTO usuarios (id, empresa_id, nome, email, senha_hash, role, ativo)
           VALUES ($1, $2, $3, $4, $5, 'admin', true)
           ON CONFLICT (empresa_id, email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, ativo = true`,
          [userId, novoId, admNome, admEmail, senhaHash]
        );
      } catch (e) {
        console.warn('[empresas] Erro ao cadastrar administrador inicial no PG:', e.message);
      }
    }
  }

  const dto = registroCriado
    ? empresaDto(registroCriado, 1)
    : {
        id: novoId,
        nome: nomeFantasia,
        nomeFantasia,
        razaoSocial,
        cnpj: formatarCnpj(cnpjNormalizadoDoc),
        cnpjNormalizado: cnpjNormalizadoDoc,
        inscricaoEstadual: ie || '',
        inscricaoMunicipal: im || '',
        tipoNegocio,
        telefone: tel || '',
        email: email || '',
        website: website || '',
        ativa: true,
        permitirEstoqueNegativo: dados.permitirEstoqueNegativo !== false,
        totalLojas: 1,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };

  // Dispara evento interno de sincronização multiempresa
  try {
    barramentoA2?.emit('cadastro_atualizado', {
      empresaId: novoId,
      tipo: 'empresas',
      acao: 'inserir',
      id: novoId,
      payload: dto
    });
  } catch {}

  return dto;
}

/**
 * Atualiza todos os dados cadastrais e fiscais de uma empresa.
 */
export async function atualizarEmpresa(db, empresaId, dados = {}) {
  const idStr = String(empresaId || '').trim();
  if (!idStr) throw new ErroDominio('VALIDATION_ERROR', 'ID da empresa é obrigatório');

  const camposAtualizar = {};
  if (dados.nome !== undefined || dados.nomeFantasia !== undefined) {
    camposAtualizar.nome = String(dados.nomeFantasia || dados.nome).trim().slice(0, 255);
  }
  if (dados.razaoSocial !== undefined || dados.razao_social !== undefined) {
    camposAtualizar.razao_social = String(dados.razaoSocial || dados.razao_social).trim().slice(0, 255);
  }
  if (dados.cnpj !== undefined) {
    camposAtualizar.cnpj = normalizarCnpj(dados.cnpj);
  }
  if (dados.inscricaoEstadual !== undefined || dados.inscricao_estadual !== undefined) {
    camposAtualizar.inscricao_estadual = String(dados.inscricaoEstadual || dados.inscricao_estadual || '').trim().slice(0, 30) || null;
  }
  if (dados.inscricaoMunicipal !== undefined || dados.inscricao_municipal !== undefined) {
    camposAtualizar.inscricao_municipal = String(dados.inscricaoMunicipal || dados.inscricao_municipal || '').trim().slice(0, 30) || null;
  }
  if (dados.tipoNegocio !== undefined || dados.tipo_negocio !== undefined) {
    camposAtualizar.tipo_negocio = String(dados.tipoNegocio || dados.tipo_negocio || 'outro').trim().slice(0, 50);
  }
  if (dados.telefone !== undefined) camposAtualizar.telefone = String(dados.telefone || '').trim().slice(0, 30) || null;
  if (dados.email !== undefined) camposAtualizar.email = String(dados.email || '').trim().toLowerCase().slice(0, 255) || null;
  if (dados.website !== undefined) camposAtualizar.website = String(dados.website || '').trim().slice(0, 255) || null;

  if (dados.enderecoLogradouro !== undefined || dados.endereco_logradouro !== undefined) {
    camposAtualizar.endereco_logradouro = String(dados.enderecoLogradouro || dados.endereco_logradouro || '').trim().slice(0, 255) || null;
  }
  if (dados.enderecoNumero !== undefined || dados.endereco_numero !== undefined) {
    camposAtualizar.endereco_numero = String(dados.enderecoNumero || dados.endereco_numero || '').trim().slice(0, 30) || null;
  }
  if (dados.enderecoComplemento !== undefined || dados.endereco_complemento !== undefined) {
    camposAtualizar.endereco_complemento = String(dados.enderecoComplemento || dados.endereco_complemento || '').trim().slice(0, 255) || null;
  }
  if (dados.enderecoBairro !== undefined || dados.endereco_bairro !== undefined) {
    camposAtualizar.endereco_bairro = String(dados.enderecoBairro || dados.endereco_bairro || '').trim().slice(0, 100) || null;
  }
  if (dados.enderecoCidade !== undefined || dados.endereco_cidade !== undefined) {
    camposAtualizar.endereco_cidade = String(dados.enderecoCidade || dados.endereco_cidade || '').trim().slice(0, 100) || null;
  }
  if (dados.enderecoEstado !== undefined || dados.endereco_estado !== undefined) {
    camposAtualizar.endereco_estado = String(dados.enderecoEstado || dados.endereco_estado || '').trim().toUpperCase().slice(0, 2) || null;
  }
  if (dados.enderecoCep !== undefined || dados.endereco_cep !== undefined) {
    camposAtualizar.endereco_cep = somenteDigitos(dados.enderecoCep || dados.endereco_cep).slice(0, 8) || null;
  }
  if (dados.ativa !== undefined) camposAtualizar.ativa = Boolean(dados.ativa);

  let atualizadoPG = null;

  // 1. Atualizar no PostgreSQL
  try {
    const sets = [];
    const vals = [idStr];
    let idx = 2;
    for (const [col, val] of Object.entries(camposAtualizar)) {
      sets.push(`${col} = $${idx}`);
      vals.push(val);
      idx++;
    }
    sets.push(`data_atualizacao = CURRENT_TIMESTAMP`);

    const sql = `UPDATE empresas SET ${sets.join(', ')} WHERE id::text = $1 RETURNING *`;
    const res = await db.query(sql, vals);
    if (res.rows[0]) atualizadoPG = res.rows[0];
  } catch (err) {
    console.warn('[empresas] Não foi possível atualizar no PostgreSQL:', err.message);
  }

  // 2. Atualizar no Datastore JSON
  try {
    const estadoJson = getDb();
    if (estadoJson.cadastrosMestresKytto?.empresas?.[idStr]) {
      const emp = estadoJson.cadastrosMestresKytto.empresas[idStr];
      if (camposAtualizar.nome) emp.nomeFantasia = camposAtualizar.nome;
      if (camposAtualizar.razao_social) emp.nome = camposAtualizar.razao_social;
      if (camposAtualizar.cnpj) {
        emp.cnpj = formatarCnpj(camposAtualizar.cnpj);
        emp.cnpjNormalizado = camposAtualizar.cnpj;
      }
      if (camposAtualizar.inscricao_estadual !== undefined) emp.inscricaoEstadual = camposAtualizar.inscricao_estadual || '';
      if (camposAtualizar.inscricao_municipal !== undefined) emp.inscricaoMunicipal = camposAtualizar.inscricao_municipal || '';
      if (camposAtualizar.telefone !== undefined) emp.telefone = camposAtualizar.telefone || '';
      if (camposAtualizar.email !== undefined) emp.email = camposAtualizar.email || '';
      if (camposAtualizar.website !== undefined) emp.website = camposAtualizar.website || '';
      if (camposAtualizar.ativa !== undefined) emp.ativa = camposAtualizar.ativa;
      if (dados.permitirEstoqueNegativo !== undefined) emp.permitirEstoqueNegativo = Boolean(dados.permitirEstoqueNegativo);
      emp.atualizadaEm = new Date().toISOString();
      saveDb();
    }
  } catch (e) {
    console.warn('[empresas] Erro ao sincronizar Datastore JSON:', e.message);
  }

  const dto = atualizadoPG ? empresaDto(atualizadoPG) : await obterEmpresaPorId(db, idStr);

  try {
    barramentoA2?.emit('cadastro_atualizado', {
      empresaId: idStr,
      tipo: 'empresas',
      acao: 'atualizar',
      id: idStr,
      payload: dto
    });
  } catch {}

  return dto;
}

/**
 * Inativa logicamente uma empresa com auditoria e segurança.
 */
export async function excluirOuInativarEmpresa(db, empresaId) {
  const idStr = String(empresaId || '').trim();
  if (!idStr) throw new ErroDominio('VALIDATION_ERROR', 'ID da empresa é obrigatório');

  // Trava de segurança: impedir exclusão da Barbearia Dino canônica
  if (idStr === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6') {
    throw new ErroDominio('VALIDATION_ERROR', 'A empresa principal Barbearia Dino é o núcleo da operação e não pode ser excluída.');
  }

  try {
    await db.query(`UPDATE empresas SET ativa = false, data_atualizacao = CURRENT_TIMESTAMP WHERE id::text = $1`, [idStr]);
  } catch (err) {
    console.warn('[empresas] Falha ao inativar no PG:', err.message);
  }

  try {
    const estadoJson = getDb();
    if (estadoJson.cadastrosMestresKytto?.empresas?.[idStr]) {
      estadoJson.cadastrosMestresKytto.empresas[idStr].ativa = false;
      estadoJson.cadastrosMestresKytto.empresas[idStr].atualizadaEm = new Date().toISOString();
      saveDb();
    }
  } catch (e) {
    console.warn('[empresas] Erro ao inativar no JSON:', e.message);
  }

  try {
    barramentoA2?.emit('cadastro_atualizado', {
      empresaId: idStr,
      tipo: 'empresas',
      acao: 'excluir',
      id: idStr
    });
  } catch {}

  return { sucesso: true, id: idStr, inativada: true };
}
