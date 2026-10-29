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

// Outros nomes pelos quais a mesma pessoa aparece no cadastro do Kytto (apelido ou
// nome completo digitado depois). O vínculo continua valendo se o cadastro for
// renomeado, por exemplo "Natani" para "Nati" ou "João" para o nome completo.
const APELIDOS_KYTTO = Object.freeze({
  'guilherme cunha martins': ['Guilherme', 'Guilherme Cunha Martins'],
  'natani minanis dobler': ['Nati', 'Naty', 'Natani Minanis Dobler'],
  'steffany marielly de oliveira': ['Steffany', 'Steffany Marielly de Oliveira'],
  'joao victor domingos ruedel': ['João Victor', 'João Victor Domingos Ruedel'],
  'david kaua araujo moraes': ['David Kauã', 'David Kaua Araujo Moraes'],
  'bruno mendes pedroso': ['Bruno Mendes', 'Bruno Mendes Pedroso'],
  'jhenyffer andrade': ['Jhenyffer Andrade'],
  'amanda gabrielly santos da silva': ['Amanda Gabrielly', 'Amanda Gabrielly Santos da Silva'],
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
  const chave = normalizarNomeProfissional(nomeAvec);
  const alvo = VINCULOS_DINO[chave];
  if (!alvo) return null;
  const elegiveis = profissionais.filter((p) => !String(p.id || '').startsWith('prof-avec-hist-'));
  const unico = (lista) => (lista.length === 1 ? lista[0] : null);
  // 1º pelo nome social; só se ninguém tiver esse nome, pelos apelidos e nome completo.
  const pelaPrincipal = elegiveis.filter((p) => normalizarNomeProfissional(p.nome) === normalizarNomeProfissional(alvo));
  if (pelaPrincipal.length) return unico(pelaPrincipal);
  const aceitos = new Set((APELIDOS_KYTTO[chave] || []).map(normalizarNomeProfissional));
  return unico(elegiveis.filter((p) => aceitos.has(normalizarNomeProfissional(p.nome)) || aceitos.has(normalizarNomeProfissional(p.apelido))));
}
