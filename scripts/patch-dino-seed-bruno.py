with open('app/dino-equipe-seed.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Adicionar Bruno Mendes Pedroso em PROFISSIONAIS_DINO_OFICIAIS
antigo_equipe = '''export const PROFISSIONAIS_DINO_OFICIAIS = [
  {
    username: \'dino\','''

novo_equipe = '''export const PROFISSIONAIS_DINO_OFICIAIS = [
  {
    username: 'bruno',
    nome: 'Bruno Mendes Pedroso',
    apelido: 'Bruno',
    email: 'bruno@barbeariadino.com.br',
    emailAlternativo: 'brunomendes@barbeariadino.com.br',
    senhaPadrao: '123456',
    especialidade: 'Barbeiro Especialista (Corte, Barba e Procedimentos)',
    role: 'profissional',
    comissaoServicos: 40,
    comissaoProdutos: 10,
    faixasComissaoServico: [
      { metaFaturamento: 15000, bonusPercentual: 5, descricao: 'Meta 1: R$ 15.000 (40% + 5% = 45%)' },
      { metaFaturamento: 20000, bonusPercentual: 7, descricao: 'Meta 2: R$ 20.000 (40% + 7% = 47%)' },
      { metaFaturamento: 26000, bonusPercentual: 10, descricao: 'Meta 3: Acima de R$ 26.000 (40% + 10% = 50%)' },
    ],
    faixasComissaoProduto: [
      { metaFaturamento: 1000, bonusPercentual: 2, descricao: 'Meta 1 Produtos: R$ 1.000 (+2% = 12%)' },
      { metaFaturamento: 2500, bonusPercentual: 5, descricao: 'Meta 2 Produtos: R$ 2.500 (+5% = 15%)' },
    ],
    telefone: '(65) 99999-0002',
    atendimento24x7: false,
    horarioInicioPadrao: '08:00',
    horarioFimPadrao: '20:00',
    diasTrabalhoPadrao: [1, 2, 3, 4, 5, 6],
  },
  {
    username: 'dino','''

c = c.replace(antigo_equipe, novo_equipe)

# 2. Corrigir lista de desligados: Bruno Mendes NÃO é desligado! Somente Bruno Rafael!
antigo_desligados = """export const PROFISSIONAIS_DINO_DESLIGADOS = [
  'bruno', 'bruno mendes pedroso',
  'david', 'david kauã araújo moraes', 'david kaua',
  'amanda', 'amanda gabrielly santos da silva', 'amanda gabrielly',
  'joao', 'joão victor domingos ruedel', 'joao victor',
  'vinycius lopes rodrigues', 'vitor muriel silva boy'
];"""

novo_desligados = """export const PROFISSIONAIS_DINO_DESLIGADOS = [
  'bruno rafael',
  'david', 'david kauã araújo moraes', 'david kaua',
  'amanda', 'amanda gabrielly santos da silva', 'amanda gabrielly',
  'joao', 'joão victor domingos ruedel', 'joao victor',
  'vinycius lopes rodrigues', 'vitor muriel silva boy',
  'gustavo', 'lucas', 'danilo', 'pedrinho'
];"""

c = c.replace(antigo_desligados, novo_desligados)

# 3. Na rotina de seed, garantir reativação explícita de Bruno Mendes
antigo_reativar = """      // 1. Garantir que ex-profissionais desligados permaneçam inativos
      for (const p of profissionaisAtuais) {"""

novo_reativar = """      // 1. Reativar Bruno Mendes Pedroso se tiver sido inativado indevidamente
      for (const p of profissionaisAtuais) {
        const pNome = String(p.nome || '').trim().toLowerCase();
        const pApelido = String(p.apelido || '').trim().toLowerCase();
        if ((pNome.includes('bruno') || pApelido === 'bruno') && !pNome.includes('bruno rafael')) {
          if (p.ativo === false || p.removidoEm) {
            barbeariaErpKytto.atualizarProfissional(empId, p.id, {
              ativo: true,
              removidoEm: null,
              excluido: false,
              nome: p.nome || 'Bruno Mendes Pedroso',
              apelido: 'Bruno',
              especialidade: p.especialidade || 'Barbeiro Especialista (Corte, Barba e Procedimentos)',
              percentualComissao: p.percentualComissao ?? 40,
              percentualComissaoProduto: p.percentualComissaoProduto ?? 10
            });
            console.log(`[dino-equipe-seed] Bruno Mendes reativado com sucesso: ${p.nome} (${p.id})`);
          }
        }
      }

      // 2. Garantir que ex-profissionais desligados permaneçam inativos
      for (const p of profissionaisAtuais) {
        const pNome = String(p.nome || '').trim().toLowerCase();
        if (pNome.includes('bruno') && !pNome.includes('bruno rafael')) continue;"""

c = c.replace(antigo_reativar, novo_reativar)

with open('app/dino-equipe-seed.js', 'w', encoding='utf-8') as f:
    f.write(c)

print('app/dino-equipe-seed.js atualizado com sucesso!')
