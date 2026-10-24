// Vínculo da equipe da Dino entre o Avec e o Kytto (uma empresa, uma equipe).
//
// Fonte: cadastro de profissionais do Avec (Configurações › Profissionais), em
// 24/10/2026. No Avec, o "nome social" é o nome usado no Kytto e o "nome conforme
// documento" é o que aparece no histórico importado. Com este vínculo, o histórico
// Avec de cada pessoa é lido junto com o cadastro dela no Kytto, sem copiar dados.
const VINCULOS_DINO = Object.freeze({
  'guilherme cunha martins': 'Dino',
  'bruno mendes pedroso': 'Bruno',
  'david kaua araujo moraes': 'David',
  'natani minanis dobler': 'Natani',
  'steffany marielly de oliveira': 'Ester',
  'joao victor domingos ruedel': 'João',
  'jhenyffer andrade': 'Jhenyffer',
  'amanda gabrielly santos da silva': 'Amanda',
});

export function normalizarNomeProfissional(valor) {
  return String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Nome do cadastro do Kytto para um nome do histórico Avec (ou null). */
export function nomeKyttoDoAvec(nomeAvec) {
  return VINCULOS_DINO[normalizarNomeProfissional(nomeAvec)] || null;
}

/** Profissional do Kytto (não histórico) correspondente ao nome do Avec, se o vínculo existir. */
export function profissionalKyttoDoAvec(nomeAvec, profissionais = []) {
  const alvo = nomeKyttoDoAvec(nomeAvec);
  if (!alvo) return null;
  const candidatos = profissionais.filter((p) => !String(p.id || '').startsWith('prof-avec-hist-') && normalizarNomeProfissional(p.nome) === normalizarNomeProfissional(alvo));
  return candidatos.length === 1 ? candidatos[0] : null;
}
