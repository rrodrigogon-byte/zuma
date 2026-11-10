#!/usr/bin/env python3
import re

# 1. Atualizar app/modules/empresas/servico.js
servico_path = 'app/modules/empresas/servico.js'
with open(servico_path, 'r', encoding='utf8') as f:
    servico = f.read()

# Substituir a assinatura e corpo de listarEmpresas para suportar empresaIdFiltro
novo_listar = '''/**
 * Lista todas as empresas cadastradas no sistema, com suporte a filtro estrito de tenant.
 */
export async function listarEmpresas(db, { incluirInativas = false, empresaIdFiltro = null } = {}) {
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
}'''

servico = re.sub(r'/\*\*\s*\*\s*Lista todas as empresas cadastradas no sistema\.\s*\*/\s*export async function listarEmpresas\(db, \{ incluirInativas = false \} = \{\}\) \{[\s\S]*?return empresas;\s*\}', novo_listar, servico)

with open(servico_path, 'w', encoding='utf8') as f:
    f.write(servico)
print("app/modules/empresas/servico.js atualizado com sucesso!")
