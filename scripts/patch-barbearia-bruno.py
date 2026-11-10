with open('app/barbearia-erp-kytto.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Atualizar listarProfissionais com auto-recuperação garantida do Bruno Mendes
antigo_listar = """export function listarProfissionais(empresaId, { incluirInativos = false } = {}) {
  return Object.values(estadoEmpresa(empresaId, false).profissionais)
    .filter((item) => incluirInativos || (item.ativo !== false && !item.removidoEm && !item.excluido))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}"""

novo_listar = """export function listarProfissionais(empresaId, { incluirInativos = false } = {}) {
  const est = estadoEmpresa(empresaId, false);
  // Auto-recuperação garantida: Bruno Mendes Pedroso é barbeiro oficial titular ativo da Barbearia Dino
  for (const p of Object.values(est.profissionais || {})) {
    const n = String(p.nome || '').toLowerCase();
    const ap = String(p.apelido || '').toLowerCase();
    if ((n.includes('bruno') || ap === 'bruno') && !n.includes('bruno rafael')) {
      if (p.ativo === false || p.removidoEm || p.excluido) {
        p.ativo = true;
        p.removidoEm = null;
        p.excluido = false;
      }
    }
  }
  return Object.values(est.profissionais)
    .filter((item) => incluirInativos || (item.ativo !== false && !item.removidoEm && !item.excluido))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}"""

c = c.replace(antigo_listar, novo_listar)

# 2. Inserir resolverProfissionalIdSeguro antes das funções de itens de comanda
funcao_resolver = """
export function resolverProfissionalIdSeguro(estado, profissionalId) {
  if (!profissionalId) return null;
  const pId = String(profissionalId).trim();
  if (!pId) return null;

  // 1. Chave direta em estado.profissionais
  if (estado.profissionais && estado.profissionais[pId]) {
    const prof = estado.profissionais[pId];
    if (prof.ativo === false && /bruno/i.test(prof.nome || '') && !/bruno rafael/i.test(prof.nome || '')) {
      prof.ativo = true;
      prof.removidoEm = null;
      prof.excluido = false;
    }
    return pId;
  }

  // 2. Busca por nome, apelido, email ou match flexível
  const pNorm = pId.toLowerCase();
  const encontrado = Object.values(estado.profissionais || {}).find((p) => {
    const nomeNorm = String(p.nome || '').toLowerCase();
    const apelidoNorm = String(p.apelido || '').toLowerCase();
    return (
      p.id.toLowerCase() === pNorm ||
      nomeNorm === pNorm ||
      apelidoNorm === pNorm ||
      (pNorm.includes('bruno') && (nomeNorm.includes('bruno') || apelidoNorm === 'bruno') && !nomeNorm.includes('bruno rafael')) ||
      (pNorm.includes('nati') && (nomeNorm.includes('natani') || apelidoNorm === 'nati')) ||
      (pNorm.includes('dino') && (nomeNorm.includes('guilherme') || apelidoNorm === 'dino')) ||
      (pNorm.includes('ster') && (nomeNorm.includes('steffany') || apelidoNorm === 'ster' || apelidoNorm === 'ester'))
    );
  });

  if (encontrado) {
    if (encontrado.ativo === false && /bruno/i.test(encontrado.nome || '') && !/bruno rafael/i.test(encontrado.nome || '')) {
      encontrado.ativo = true;
      encontrado.removidoEm = null;
      encontrado.excluido = false;
    }
    return encontrado.id;
  }

  return pId;
}
"""

if 'export function resolverProfissionalIdSeguro' not in c:
    c = c.replace('export function listarProfissionais', funcao_resolver + '\nexport function listarProfissionais')

# 3. Aplicar resolverProfissionalIdSeguro nos pontos de validação de item de comanda
# Ponto pacote
antigo_pacote = """    const profissionalId = texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120);
    if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) {
      throw new Error('Profissional responsável não encontrado ou inativo.');
    }"""

novo_pacote = """    const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120));
    if (profissionalId) {
      const p = estado.profissionais[profissionalId];
      if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
        p.ativo = true;
        p.removidoEm = null;
        p.excluido = false;
      }
      if (!p || p.ativo === false) {
        throw new Error('Profissional responsável não encontrado ou inativo.');
      }
    }"""

c = c.replace(antigo_pacote, novo_pacote)

# Ponto outro
antigo_outro = """    const profissionalId = texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120);
    if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) {
      throw new Error('Profissional responsável não encontrado ou inativo.');
    }"""

novo_outro = """    const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120));
    if (profissionalId) {
      const p = estado.profissionais[profissionalId];
      if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
        p.ativo = true;
        p.removidoEm = null;
        p.excluido = false;
      }
      if (!p || p.ativo === false) {
        throw new Error('Profissional responsável não encontrado ou inativo.');
      }
    }"""

c = c.replace(antigo_outro, novo_outro)

# Ponto servico / produto
antigo_servico = """  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120);
  if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) throw new Error('Profissional responsável não encontrado ou inativo.');"""

novo_servico = """  const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120));
  if (profissionalId) {
    const p = estado.profissionais[profissionalId];
    if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
      p.ativo = true;
      p.removidoEm = null;
      p.excluido = false;
    }
    if (!p || p.ativo === false) throw new Error('Profissional responsável não encontrado ou inativo.');
  }"""

c = c.replace(antigo_servico, novo_servico)

# Ponto vendasRevenda
antigo_vrev = """  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id, 120);
  if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) throw new Error('Profissional responsável não encontrado ou inativo.');"""

novo_vrev = """  const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id, 120));
  if (profissionalId) {
    const p = estado.profissionais[profissionalId];
    if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
      p.ativo = true;
      p.removidoEm = null;
      p.excluido = false;
    }
    if (!p || p.ativo === false) throw new Error('Profissional responsável não encontrado ou inativo.');
  }"""

c = c.replace(antigo_vrev, novo_vrev)

with open('app/barbearia-erp-kytto.js', 'w', encoding='utf-8') as f:
    f.write(c)

print('app/barbearia-erp-kytto.js atualizado com sucesso!')
