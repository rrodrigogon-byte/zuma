#!/usr/bin/env python3

with open('app/modules/empresas/servico.js', 'r', encoding='utf8') as f:
    content = f.read()

# 1. Adicionar Stallone com UUID 31f70c83-9172-40c2-945f-9e793b5048be em EMPRESAS_CANONICAS_PADRAO se não tiver
if '31f70c83-9172-40c2-945f-9e793b5048be' not in content:
    old_stallone = """  {
    id: 'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e',
    nome: 'Stallone Nutre Sport',"""
    new_stallone = """  {
    id: '31f70c83-9172-40c2-945f-9e793b5048be',
    nome: 'Stallone Nutre Sport',
    nomeFantasia: 'Stallone Nutre Sport',
    razaoSocial: 'STALLONE NUTRE SPORT LTDA',
    cnpj: '56.099.531/0001-38',
    cnpjNormalizado: '56099531000138',
    inscricaoEstadual: '13.456.789-0',
    inscricaoMunicipal: '124500',
    tipoNegocio: 'loja',
    telefone: '(65) 3624-7890',
    email: 'financeiro@stallonenutresport.com.br',
    enderecoCidade: 'Cuiabá',
    enderecoEstado: 'MT',
    endereco: 'Av. Historiador Rubens de Mendonça, 1200, Bosque da Saúde, Cuiabá/MT',
    ativa: true,
    permitirEstoqueNegativo: true,
    totalLojas: 1
  },
  {
    id: 'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e',
    nome: 'Stallone Nutre Sport',"""
    content = content.replace(old_stallone, new_stallone, 1)

# 2. Atualizar listarEmpresas para suportar empresaIdFiltro como Array ou String
listar_old = """export async function listarEmpresas(db, { incluirInativas = false, empresaIdFiltro = null } = {}) {
  let empresas = [];
  const filtroId = empresaIdFiltro ? String(empresaIdFiltro).trim() : null;

  try {
    let sql = `
      SELECT e.id::text, e.nome, e.razao_social, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
             e.tipo_negocio, e.endereco_logradouro, e.endereco_numero, e.endereco_complemento,
             e.endereco_bairro, e.endereco_cidade, e.endereco_estado, e.endereco_cep,
             e.telefone, e.email, e.website, e.ativa, e.data_criacao, e.data_atualizacao,
             COUNT(l.id)::int AS total_lojas
        FROM empresas e
        LEFT JOIN lojas l ON l.empresa_id = e.id AND l.ativa = true
       WHERE ${incluirInativas ? '1=1' : 'e.ativa = true'}
    `;
    const params = [];
    if (filtroId) {
      params.push(filtroId);
      sql += ` AND (e.id::text = $1 OR e.id::text ILIKE $1)`;
    }
    sql += `
       GROUP BY e.id, e.nome, e.razao_social, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
                e.tipo_negocio, e.endereco_logradouro, e.endereco_numero, e.endereco_complemento,
                e.endereco_bairro, e.endereco_cidade, e.endereco_estado, e.endereco_cep,
                e.telefone, e.email, e.website, e.ativa, e.data_criacao, e.data_atualizacao
       ORDER BY e.nome ASC
    `;
    const res = await db.query(sql, params);
    empresas = (res.rows || []).map((r) => empresaDto(r, r.total_lojas));
  } catch (err) {
    console.warn('[empresas] Consulta no PostgreSQL indisponível ou falhou, usando Datastore JSON:', err.message);
  }

  // Sincroniza / merge com empresas do Datastore JSON
  try {
    const empresasJson = jsonStore.listarEmpresas({ incluirInativas });
    for (const ej of empresasJson) {
      if (filtroId && ej.id !== filtroId && ej.id !== 'dino' && filtroId !== 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6') continue;
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

  // Garante a presença canônica das empresas (respeitando o filtro de tenant!)
  for (const empCanonica of EMPRESAS_CANONICAS_PADRAO) {
    if (filtroId && empCanonica.id !== filtroId) continue;
    const jaTem = empresas.find(e => e.id === empCanonica.id || e.cnpjNormalizado === empCanonica.cnpjNormalizado);
    if (!jaTem) {
      empresas.push({ ...empCanonica });
    }
  }

  if (filtroId) {
    empresas = empresas.filter(e => e.id === filtroId || (filtroId === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' && e.id === 'dino'));
  }

  return empresas;
}"""

listar_new = """export async function listarEmpresas(db, { incluirInativas = false, empresaIdFiltro = null } = {}) {
  let empresas = [];
  let listaFiltro = null;
  if (Array.isArray(empresaIdFiltro)) {
    listaFiltro = empresaIdFiltro.map(x => String(x).trim().toLowerCase()).filter(Boolean);
  } else if (empresaIdFiltro) {
    listaFiltro = [String(empresaIdFiltro).trim().toLowerCase()];
  }

  try {
    let sql = `
      SELECT e.id::text, e.nome, e.razao_social, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
             e.tipo_negocio, e.endereco_logradouro, e.endereco_numero, e.endereco_complemento,
             e.endereco_bairro, e.endereco_cidade, e.endereco_estado, e.endereco_cep,
             e.telefone, e.email, e.website, e.ativa, e.data_criacao, e.data_atualizacao,
             COUNT(l.id)::int AS total_lojas
        FROM empresas e
        LEFT JOIN lojas l ON l.empresa_id = e.id AND l.ativa = true
       WHERE ${incluirInativas ? '1=1' : 'e.ativa = true'}
    `;
    const params = [];
    if (listaFiltro && listaFiltro.length > 0) {
      params.push(listaFiltro);
      sql += ` AND lower(e.id::text) = ANY($1::text[])`;
    }
    sql += `
       GROUP BY e.id, e.nome, e.razao_social, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
                e.tipo_negocio, e.endereco_logradouro, e.endereco_numero, e.endereco_complemento,
                e.endereco_bairro, e.endereco_cidade, e.endereco_estado, e.endereco_cep,
                e.telefone, e.email, e.website, e.ativa, e.data_criacao, e.data_atualizacao
       ORDER BY e.nome ASC
    `;
    const res = await db.query(sql, params);
    empresas = (res.rows || []).map((r) => empresaDto(r, r.total_lojas));
  } catch (err) {
    console.warn('[empresas] Consulta no PostgreSQL indisponível ou falhou, usando Datastore JSON:', err.message);
  }

  // Sincroniza / merge com empresas do Datastore JSON
  try {
    const empresasJson = jsonStore.listarEmpresas({ incluirInativas });
    for (const ej of empresasJson) {
      const ejId = String(ej.id || '').toLowerCase();
      if (listaFiltro && listaFiltro.length > 0) {
        const permitido = listaFiltro.includes(ejId) ||
          (listaFiltro.includes('d0d0ac01-8e50-4b61-8c79-de4aaa916da6') && ejId === 'dino') ||
          (listaFiltro.includes('dino') && ejId === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
        if (!permitido) continue;
      }
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

  // Garante a presença canônica das empresas (respeitando o filtro de tenant!)
  for (const empCanonica of EMPRESAS_CANONICAS_PADRAO) {
    const canId = String(empCanonica.id || '').toLowerCase();
    if (listaFiltro && listaFiltro.length > 0) {
      const permitido = listaFiltro.includes(canId) ||
        (listaFiltro.includes('d0d0ac01-8e50-4b61-8c79-de4aaa916da6') && canId === 'dino') ||
        (listaFiltro.includes('dino') && canId === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
      if (!permitido) continue;
    }
    const jaTem = empresas.find(e => e.id === empCanonica.id || (e.cnpjNormalizado && e.cnpjNormalizado === empCanonica.cnpjNormalizado));
    if (!jaTem) {
      empresas.push({ ...empCanonica });
    }
  }

  // Filtro final rigoroso de isolamento multi-tenant
  if (listaFiltro && listaFiltro.length > 0) {
    empresas = empresas.filter(e => {
      const eid = String(e.id || '').trim().toLowerCase();
      if (listaFiltro.includes(eid)) return true;
      if (listaFiltro.includes('d0d0ac01-8e50-4b61-8c79-de4aaa916da6') && eid === 'dino') return true;
      if (listaFiltro.includes('dino') && eid === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6') return true;
      return false;
    });
  }

  return empresas;
}"""

if listar_old in content:
    content = content.replace(listar_old, listar_new, 1)
    with open('app/modules/empresas/servico.js', 'w', encoding='utf8') as f:
        f.write(content)
    print("app/modules/empresas/servico.js atualizado com sucesso!")
else:
    print("ERRO: Bloco listar_old não encontrado exatamente")
