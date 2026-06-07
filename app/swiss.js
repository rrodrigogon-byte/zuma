// Sistema suíço (cap. 4.1) — emparelhamento por desempenho, sem eliminação.
// Cada rodada cruza jogadores de pontuação parecida, evitando revanches.

export function gerarSuico(nomes){
  const players = nomes.map(s=>String(s).trim()).filter(Boolean);
  if(players.length < 4) throw new Error('sistema suíço requer ao menos 4 atletas');
  const state = { tipo:'suico', players, rounds:[], confrontos:[], criadoEm:new Date().toISOString() };
  proximaRodada(state); // gera a 1ª rodada
  return state;
}

// pontos de cada jogador (1 por vitória) considerando as rodadas já lançadas
export function pontos(state){
  const p = {}; state.players.forEach(n=>p[n]=0);
  state.rounds.forEach(rod=>rod.forEach(j=>{ if(j.vencedor && p[j.vencedor]!==undefined) p[j.vencedor]++; }));
  return p;
}

function jaJogaram(state, a, b){
  return state.confrontos.includes(a+'|'+b) || state.confrontos.includes(b+'|'+a);
}

// Gera a próxima rodada (exige que a rodada anterior esteja completa).
export function proximaRodada(state){
  if(state.rounds.length){
    const ultima = state.rounds[state.rounds.length-1];
    if(!ultima.every(j=>j.vencedor || j.bye)) throw new Error('conclua a rodada atual antes de gerar a próxima');
  }
  const p = pontos(state);
  // ordena por pontos (desc); embaralha leve dentro do mesmo grupo de pontos na 1ª rodada
  let ordem = [...state.players];
  if(state.rounds.length===0){ for(let i=ordem.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ordem[i],ordem[j]]=[ordem[j],ordem[i]]; } }
  else ordem.sort((a,b)=> p[b]-p[a]);
  const livres = [...ordem];
  let bye = null;
  if(livres.length % 2 !== 0){
    // o último colocado que ainda não teve bye recebe o bye
    for(let i=livres.length-1;i>=0;i--){ if(!state.byes || !state.byes.includes(livres[i])){ bye=livres[i]; break; } }
    if(!bye) bye=livres[livres.length-1];
    livres.splice(livres.indexOf(bye),1);
  }
  const jogos = [];
  while(livres.length){
    const a = livres.shift();
    let idx = livres.findIndex(b=>!jaJogaram(state,a,b));
    if(idx<0) idx = 0; // se todos já se enfrentaram, aceita revanche
    const b = livres.splice(idx,1)[0];
    state.confrontos.push(a+'|'+b);
    jogos.push({ a, b, placar:null, tipo:null, vencedor:null });
  }
  if(bye){ jogos.push({ a:bye, b:null, placar:'BYE', tipo:'bye', vencedor:bye }); state.byes=(state.byes||[]).concat(bye); }
  state.rounds.push(jogos);
  return state;
}

export function tabelaSuico(state){
  const p = pontos(state);
  const stats = {}; state.players.forEach(n=> stats[n]={ nome:n, pontos:p[n], j:0, v:0, d:0 });
  state.rounds.forEach(rod=>rod.forEach(j=>{
    if(j.tipo==='bye'){ stats[j.a].j++; return; }
    if(!j.vencedor) return;
    stats[j.a].j++; stats[j.b].j++;
    if(j.vencedor===j.a){ stats[j.a].v++; stats[j.b].d++; } else { stats[j.b].v++; stats[j.a].d++; }
  }));
  return Object.values(stats).sort((x,y)=> y.pontos-x.pontos || y.v-x.v || x.nome.localeCompare(y.nome))
    .map((s,i)=>({ pos:i+1, ...s }));
}
