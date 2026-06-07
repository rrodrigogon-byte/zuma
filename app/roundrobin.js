// Motor round-robin (todos contra todos) — método do círculo (berger).
// Gera rodadas equilibradas e calcula a tabela de classificação.

export function gerarRoundRobin(nomes){
  const players = nomes.map(s=>String(s).trim()).filter(Boolean);
  if(players.length < 3) throw new Error('round-robin requer ao menos 3 atletas');
  const arr = players.slice();
  const bye = (arr.length % 2 !== 0);
  if(bye) arr.push('__BYE__'); // folga
  const n = arr.length;
  const rondas = n - 1, metade = n / 2;
  const idx = arr.map((_,i)=>i);
  const rounds = [];
  for(let r=0;r<rondas;r++){
    const jogos = [];
    for(let i=0;i<metade;i++){
      const a = arr[idx[i]], b = arr[idx[n-1-i]];
      if(a!=='__BYE__' && b!=='__BYE__') jogos.push({ a, b, placar:null, tipo:null, vencedor:null });
    }
    rounds.push(jogos);
    // rotaciona mantendo o primeiro fixo
    idx.splice(1,0, idx.pop());
  }
  return { tipo:'roundrobin', players, rounds, criadoEm:new Date().toISOString() };
}

// Classificação: 1 ponto por vitória; desempate por saldo de sets e confronto direto simples.
export function tabelaRoundRobin(rr){
  const stats = {};
  rr.players.forEach(p=> stats[p] = { nome:p, j:0, v:0, d:0, setsPro:0, setsContra:0, pontos:0 });
  rr.rounds.forEach(jogos=> jogos.forEach(g=>{
    if(!g.vencedor) return;
    const A=stats[g.a], B=stats[g.b]; if(!A||!B) return;
    A.j++; B.j++;
    // contabiliza sets a partir do placar "6-4 6-3"
    let sa=0, sb=0;
    if(g.placar && g.tipo==='normal'){
      g.placar.split(' ').forEach(s=>{ const [x,y]=s.split('-').map(Number); if(x>y) sa++; else sb++; });
    } else { // WO/abandono: 1 set ao vencedor
      if(g.vencedor===g.a) sa=1; else sb=1;
    }
    A.setsPro+=sa; A.setsContra+=sb; B.setsPro+=sb; B.setsContra+=sa;
    if(g.vencedor===g.a){ A.v++; B.d++; A.pontos++; } else { B.v++; A.d++; B.pontos++; }
  }));
  return Object.values(stats).sort((x,y)=>
    y.pontos-x.pontos || (y.setsPro-y.setsContra)-(x.setsPro-x.setsContra) || y.v-x.v || x.nome.localeCompare(y.nome)
  ).map((p,i)=>({ pos:i+1, ...p, saldo:p.setsPro-p.setsContra }));
}
