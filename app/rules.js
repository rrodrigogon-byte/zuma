// Motor de regras multimodal — validação de placar e definição do vencedor.
// Famílias: "tenis" (game/set/tie-break: tênis, beach tennis, pádel) e
// "pontos" (set por pontos com 2 de diferença: futevôlei, squash, vôlei de praia, tênis de mesa, pickleball).

// ---- família TÊNIS ----
// Set válido: 6 com 2 de diferença (6-0..6-4), 7-5 ou 7-6 (tie-break).
// matchTb=true valida um match tie-break (super tie-break): >=10 pontos com 2 de diferença.
export function validSet(a, b, { matchTb = false } = {}){
  a = Number(a); b = Number(b);
  if(!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  const hi = Math.max(a,b), lo = Math.min(a,b);
  if(a === b) return false;
  if(matchTb) return hi >= 10 && (hi - lo) >= 2;
  if(hi === 6 && lo <= 4) return true;
  if(hi === 7 && (lo === 5 || lo === 6)) return true;
  return false;
}

// ---- família PONTOS ----
// Set válido por pontos: alcançar "to" com diferença "diff"; "cap" encerra no limite (sem exigir diferença).
export function validSetPontos(a, b, { to = 11, diff = 2, cap = null } = {}){
  a = Number(a); b = Number(b);
  if(!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  if(a === b) return false;
  const hi = Math.max(a,b), lo = Math.min(a,b);
  if(cap && hi === cap && hi > lo) return true;
  return hi >= to && (hi - lo) >= diff;
}

// Define o vencedor a partir dos sets. sets: [[a,b], ...] (a = pontos/games do jogador A).
// regras tênis:  { tipo:'tenis', bestOf:3|5, matchTiebreak:bool }
// regras pontos: { tipo:'pontos', bestOf:3|5|7, to, diff, cap?, toDecide? }
export function matchWinner(sets, regras = {}){
  const tipo = regras.tipo === 'pontos' ? 'pontos' : 'tenis';
  const bestOf = [3,5,7].includes(regras.bestOf) ? regras.bestOf : 3;
  const need = Math.ceil(bestOf/2);
  if(!Array.isArray(sets) || !sets.length) return { valid:false, error:'informe ao menos um set' };
  let wA = 0, wB = 0;
  for(let i=0;i<sets.length;i++){
    const a = Number(sets[i][0]), b = Number(sets[i][1]);
    const isDeciding = (wA === need-1 && wB === need-1);
    let ok;
    if(tipo === 'pontos'){
      const to = (isDeciding && regras.toDecide) ? regras.toDecide : (regras.to || 11);
      ok = validSetPontos(a, b, { to, diff: regras.diff || 2, cap: regras.cap || null });
    } else {
      ok = validSet(a, b, { matchTb: !!regras.matchTiebreak && isDeciding });
    }
    if(!ok) return { valid:false, error:`Set ${i+1} inválido (${sets[i][0]}-${sets[i][1]})` };
    if(a > b) wA++; else wB++;
    if(wA === need || wB === need){
      return { valid:true, winner: wA === need ? 0 : 1, setsA:wA, setsB:wB,
               placar: sets.map(s=>`${s[0]}-${s[1]}`).join(' '), complete:true };
    }
  }
  return { valid:false, error:'sets insuficientes para definir o vencedor' };
}

// ---- formatos (compatível com versões anteriores: chaves '3sets', '3sets_mtb', '5sets') ----
export const FORMATOS = {
  // Tênis
  '3sets':     { tipo:'tenis', bestOf:3, matchTiebreak:false, label:'Tênis · melhor de 3 sets' },
  '3sets_mtb': { tipo:'tenis', bestOf:3, matchTiebreak:true,  label:'Tênis · 2 sets + match tie-break' },
  '5sets':     { tipo:'tenis', bestOf:5, matchTiebreak:false, label:'Tênis · melhor de 5 sets' },
  // Beach tennis / pádel (set a 6 + tie-break, decisivo em match tie-break)
  'beach_mtb': { tipo:'tenis', bestOf:3, matchTiebreak:true,  label:'Beach/Pádel · 2 sets + match tie-break (10)' },
  // Pontos
  'volei_praia': { tipo:'pontos', bestOf:3, to:21, toDecide:15, diff:2, label:'Vôlei de praia · sets a 21, decisivo a 15' },
  'futevolei':   { tipo:'pontos', bestOf:3, to:18, diff:2,       label:'Futevôlei · sets a 18 (melhor de 3)' },
  'squash':      { tipo:'pontos', bestOf:5, to:11, diff:2,       label:'Squash · PAR a 11 (melhor de 5)' },
  'tenis_mesa5': { tipo:'pontos', bestOf:5, to:11, diff:2,       label:'Tênis de mesa · a 11 (melhor de 5)' },
  'tenis_mesa7': { tipo:'pontos', bestOf:7, to:11, diff:2,       label:'Tênis de mesa · a 11 (melhor de 7)' },
  'pickleball':  { tipo:'pontos', bestOf:3, to:11, diff:2,       label:'Pickleball · a 11 (melhor de 3)' }
};

// ---- modalidades (cap. 6.2): formatos sugeridos por esporte ----
export const MODALIDADES = {
  tenis:       { nome:'Tênis',           familia:'tenis',  formatos:['3sets','3sets_mtb','5sets'] },
  beach_tennis:{ nome:'Beach Tennis',    familia:'tenis',  formatos:['beach_mtb','3sets'] },
  padel:       { nome:'Pádel',           familia:'tenis',  formatos:['beach_mtb','3sets'] },
  futevolei:   { nome:'Futevôlei',       familia:'pontos', formatos:['futevolei'] },
  squash:      { nome:'Squash',          familia:'pontos', formatos:['squash'] },
  volei_praia: { nome:'Vôlei de praia',  familia:'pontos', formatos:['volei_praia'] },
  tenis_mesa:  { nome:'Tênis de mesa',   familia:'pontos', formatos:['tenis_mesa5','tenis_mesa7'] },
  pickleball:  { nome:'Pickleball',      familia:'pontos', formatos:['pickleball'] }
};
