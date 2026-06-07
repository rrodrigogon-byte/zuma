// Rating interno estilo Elo (cap. 7.2) — atualizado a cada partida com vencedor definido.
const BASE = 1500, K = 32;

function ensure(store, nome){
  store.players = store.players || {};
  if(!store.players[nome]) store.players[nome] = { nome, elo: BASE, jogos: 0, v: 0, d: 0 };
  return store.players[nome];
}

// Aplica um resultado (vencedor x perdedor) ao rating.
export function applyElo(store, vencedor, perdedor){
  if(!vencedor || !perdedor || vencedor === perdedor) return;
  const A = ensure(store, vencedor), B = ensure(store, perdedor);
  const eA = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400));
  const eB = 1 - eA;
  A.elo = Math.round(A.elo + K * (1 - eA));
  B.elo = Math.round(B.elo + K * (0 - eB));
  A.jogos++; B.jogos++; A.v++; B.d++;
}

export function ratingList(store){
  const ps = Object.values((store && store.players) || {});
  return ps.sort((a,b)=> b.elo - a.elo || b.v - a.v || a.nome.localeCompare(b.nome))
    .map((p,i)=>({ pos:i+1, ...p, aproveitamento: p.jogos ? Math.round(100*p.v/p.jogos) : 0 }));
}
