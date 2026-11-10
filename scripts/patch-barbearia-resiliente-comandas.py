with open('app/barbearia-erp-kytto.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Atualizar lista de protegidos
antigo_prot = "export const PROFISSIONAIS_PROTEGIDOS_DINO = ['dino', 'bruno', 'bruno mendes', 'bruno mendes pedroso', 'nati', 'ester'];"
novo_prot = "export const PROFISSIONAIS_PROTEGIDOS_DINO = ['dino', 'bruno', 'bruno mendes', 'bruno mendes pedroso', 'nati', 'ester', 'ster', 'steffany', 'jhenyffer'];"
assert antigo_prot in c, 'antigo_prot nao encontrado'
c = c.replace(antigo_prot, novo_prot, 1)

# 2. Atualizar criarComandaBarbearia para usar resolverProfissionalIdSeguro
antigo_criar = """  const lojaId = texto(dados.lojaId ?? dados.loja_id ?? agendamento?.lojaId, 120);
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id ?? agendamento?.profissionalId, 120);
  if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) throw new Error('Profissional responsável não encontrado ou inativo.');"""

novo_criar = """  const lojaId = texto(dados.lojaId ?? dados.loja_id ?? agendamento?.lojaId, 120);
  const profissionalIdBruto = texto(dados.profissionalId ?? dados.profissional_id ?? agendamento?.profissionalId, 120);
  const profissionalId = resolverProfissionalIdSeguro(empresaId, profissionalIdBruto);
  if (profissionalIdBruto && !profissionalId) throw new Error('Profissional responsável não encontrado ou inativo.');"""

assert antigo_criar in c, 'antigo_criar nao encontrado'
c = c.replace(antigo_criar, novo_criar, 1)

with open('app/barbearia-erp-kytto.js', 'w', encoding='utf-8') as f:
    f.write(c)

print('app/barbearia-erp-kytto.js atualizado com sucesso!')
