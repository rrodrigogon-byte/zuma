with open('app/barbearia-erp-kytto.js', 'r', encoding='utf-8') as f:
    c = f.read()

antigo_excluir = """export function excluirProfissional(empresaId, profissionalId) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.profissionais[String(profissionalId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const agora = dataAtual();
  Object.assign(atual, { ativo: false, removidoEm: atual.removidoEm || agora, atualizadoEm: agora });
  save();
  return { ...atual };
}"""

novo_excluir = """// Lista de profissionais protegidos da Dino Barbearia (imunes a exclusão acidental)
export const PROFISSIONAIS_PROTEGIDOS_DINO = ['dino', 'bruno', 'bruno mendes', 'bruno mendes pedroso', 'nati', 'ester'];

export function isProfissionalProtegido(nome = '', apelido = '') {
  const n = String(nome || '').trim().toLowerCase();
  const a = String(apelido || '').trim().toLowerCase();
  return PROFISSIONAIS_PROTEGIDOS_DINO.some(prot => n.includes(prot) || a === prot);
}

export function excluirProfissional(empresaId, profissionalId, { forcar = false } = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.profissionais[String(profissionalId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;

  // Trava de segurança: impede exclusão acidental de profissionais titulares oficiais
  if (isProfissionalProtegido(atual.nome, atual.apelido) && !forcar) {
    throw new Error(`O profissional titular ${atual.nome} é protegido e essencial para a operação da Dino Barbearia. Ação bloqueada.`);
  }

  const agora = dataAtual();
  Object.assign(atual, { ativo: false, removidoEm: atual.removidoEm || agora, atualizadoEm: agora });
  save();
  return { ...atual };
}"""

assert antigo_excluir in c, 'Trecho antigo de excluirProfissional nao encontrado'
c = c.replace(antigo_excluir, novo_excluir, 1)

with open('app/barbearia-erp-kytto.js', 'w', encoding='utf-8') as f:
    f.write(c)

print('app/barbearia-erp-kytto.js atualizado com trava de proteção!')
