// Motor de ranking interno — estilo "Meu Ranking" (pontos por fase + estatísticas)
// Pontuação por fase alcançada (ajustável). Campeão recebe o topo.
export const POINTS = { champion:1000, finalist:600, semi:360, quarter:180, r16:90, r32:45, r64:20, participation:5 };

// Calcula pontos de cada atleta a partir de uma chave finalizada (rounds com vencedores)
export function pointsFromChave(chave){
  const rounds = chave.rounds;
  const totalRounds = rounds.length - 1; // exclui coluna "campeão"
  const reached = {}; // nome -> índice da rodada mais avançada que ele JOGOU/venceu
  const played = new Set();

  // todo atleta real da 1ª rodada participou
  rounds[0].forEach(e=>{ if(e && !e.bye){ played.add(e.name); reached[e.name]=0; } });
  // para cada rodada com vencedores definidos, marca avanço
  for(let r=1;r<rounds.length;r++){
    rounds[r].forEach(e=>{ if(e && !e.bye){ reached[e.name]=Math.max(reached[e.name]??0, r); } });
  }
  // mapeia rodada alcançada -> pontos
  const out = {};
  for(const name of played){
    const rr = reached[name]; // 0..totalRounds
    out[name] = roundPoints(rr, totalRounds);
  }
  return out;
}

// rr = índice da última rodada onde o atleta aparece (0=1ªrodada... totalRounds=campeão)
function roundPoints(rr, totalRounds){
  // campeão = venceu a final => aparece na coluna campeão (rr === totalRounds)
  if(rr >= totalRounds) return POINTS.champion;
  const fromEnd = totalRounds - rr; // 1 = perdeu na final, 2 = perdeu na semi...
  switch(fromEnd){
    case 1: return POINTS.finalist;
    case 2: return POINTS.semi;
    case 3: return POINTS.quarter;
    case 4: return POINTS.r16;
    case 5: return POINTS.r32;
    case 6: return POINTS.r64;
    default: return POINTS.participation;
  }
}

// Conta vitórias/derrotas de cada atleta na chave
export function recordsFromChave(chave){
  const rounds = chave.rounds;
  const rec = {}; // nome -> {w,l}
  const ensure = n => rec[n] || (rec[n]={w:0,l:0});
  for(let r=0;r<rounds.length-1;r++){
    for(let m=0;m<rounds[r].length;m+=2){
      const a=rounds[r][m], b=rounds[r][m+1], w=rounds[r+1] && rounds[r+1][Math.floor(m/2)];
      if(!w || w.bye) continue;
      const aReal=a&&!a.bye, bReal=b&&!b.bye;
      if(aReal && bReal){
        ensure(w.name).w++;
        const loser = (w.name===a.name)? b : a;
        ensure(loser.name).l++;
      }
    }
  }
  return rec;
}

// Aplica os resultados de uma chave ao ranking acumulado
export function applyChaveToRanking(ranking, categoria, chave){
  const pts = pointsFromChave(chave);
  const rec = recordsFromChave(chave);
  ranking.players = ranking.players || {};
  for(const name of Object.keys(pts)){
    const key = (categoria+'|'+name).toLowerCase();
    const p = ranking.players[key] || (ranking.players[key]={ nome:name, categoria, pontos:0, vitorias:0, derrotas:0, torneios:0 });
    p.pontos += pts[name];
    p.vitorias += (rec[name]?.w||0);
    p.derrotas += (rec[name]?.l||0);
    p.torneios += 1;
  }
  return ranking;
}

// Lista ordenada (posição, nome, pontos, V/D, aproveitamento)
export function rankingList(ranking, categoria){
  let arr = Object.values(ranking.players||{});
  if(categoria && categoria!=='todas') arr = arr.filter(p=>p.categoria===categoria);
  arr.sort((a,b)=> b.pontos-a.pontos || b.vitorias-a.vitorias);
  return arr.map((p,i)=>({
    pos:i+1, nome:p.nome, categoria:p.categoria, pontos:p.pontos,
    vitorias:p.vitorias, derrotas:p.derrotas, torneios:p.torneios,
    aproveitamento: (p.vitorias+p.derrotas)? Math.round(100*p.vitorias/(p.vitorias+p.derrotas)) : 0
  }));
}
