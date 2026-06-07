// Eliminatória dupla (cap. 4.1) — chave de vencedores (WB) + chave de perdedores (LB) + grande final com reset.
// Modelo: cada partida tem destino do vencedor (wTo) e do perdedor (lTo). Resultados propagam automaticamente.
import { nextPow2, seedOrder, buildDraw } from './bracket.js';

const ename = e => !e ? null : (e.bye ? {bye:true} : e);

export function gerarDuplaElim(nomes, opts={}){
  const list = nomes.map(s=>String(s).trim()).filter(Boolean);
  if(list.length < 4) throw new Error('eliminatória dupla requer ao menos 4 atletas');
  const N = nextPow2(list.length), k = Math.round(Math.log2(N));
  const S = Math.min(opts.seeds ?? 0, N/2);
  const slot = buildDraw(list, N, S);

  const matches = {}; const order = [];
  const id = (br,r,i)=>`${br}-${r}-${i}`;
  const add = (mid,obj)=>{ matches[mid] = { id:mid, a:null, b:null, winner:null, loser:null, placar:null, tipo:null, wTo:null, lTo:null, ...obj }; order.push(mid); };

  // ---- Winners Bracket ----
  for(let r=0;r<k;r++){
    const cnt = N/Math.pow(2,r+1);
    for(let i=0;i<cnt;i++){
      const a = r===0 ? ename(slot[2*i]) : null;
      const b = r===0 ? ename(slot[2*i+1]) : null;
      add(id('WB',r,i), { bracket:'WB', round:r, a, b });
    }
  }
  for(let r=0;r<k-1;r++){
    const cnt = N/Math.pow(2,r+1);
    for(let i=0;i<cnt;i++) matches[id('WB',r,i)].wTo = { id:id('WB',r+1,Math.floor(i/2)), slot:i%2===0?'a':'b' };
  }

  // ---- Losers Bracket ----
  const lbRounds = 2*k-2;
  const lbCount = j => N/Math.pow(2, Math.ceil(j/2)+1);
  for(let j=1;j<=lbRounds;j++){ const cnt=lbCount(j); for(let i=0;i<cnt;i++) add(id('LB',j,i), { bracket:'LB', round:j }); }

  // WB R0 losers -> LB1
  { const cnt=N/2; for(let i=0;i<cnt;i++) matches[id('WB',0,i)].lTo = { id:id('LB',1,Math.floor(i/2)), slot:i%2===0?'a':'b' }; }
  // WB Rm losers (m>=1) -> LB round 2m, slot b
  for(let m=1;m<k;m++){ const cnt=N/Math.pow(2,m+1); for(let i=0;i<cnt;i++) matches[id('WB',m,i)].lTo = { id:id('LB',2*m,i), slot:'b' }; }
  // LB links
  for(let j=1;j<lbRounds;j++){
    const cnt=lbCount(j);
    for(let i=0;i<cnt;i++){
      if(j%2===1){ // pairing round -> next (minor) round slot a, same index
        matches[id('LB',j,i)].wTo = { id:id('LB',j+1,i), slot:'a' };
      } else { // minor round -> next (pairing) round, halve
        matches[id('LB',j,i)].wTo = { id:id('LB',j+1,Math.floor(i/2)), slot:i%2===0?'a':'b' };
      }
    }
  }

  // ---- Grande Final ----
  add('GF', { bracket:'GF', round:0 });
  matches[id('WB',k-1,0)].wTo = { id:'GF', slot:'a' };       // campeão WB
  matches[id('LB',lbRounds,0)].wTo = { id:'GF', slot:'b' };  // campeão LB
  // GF reset (GF2) é criado dinamicamente se o lado da LB vencer a GF1.

  const struct = { tipo:'dupla', size:N, k, lbRounds, matches, order, campeao:null, criadoEm:new Date().toISOString() };
  autoResolveByes(struct);
  return struct;
}

function put(struct, dest, player){
  if(!dest) return;
  const m = struct.matches[dest.id]; if(!m) return;
  m[dest.slot] = player;
}

// Aplica o resultado de uma partida e propaga vencedor/perdedor.
export function reportDupla(struct, matchId, winnerSlot, placar, tipo){
  const m = struct.matches[matchId];
  if(!m) throw new Error('partida não encontrada');
  if(!m.a || !m.b || m.a.bye || m.b.bye) throw new Error('partida sem dois atletas');
  const win = winnerSlot==='a' || winnerSlot===0 ? m.a : m.b;
  const lose = win===m.a ? m.b : m.a;
  m.winner = win; m.loser = lose; m.placar = placar||''; m.tipo = tipo||'normal';
  if(m.id==='GF'){
    // se o lado da LB (b) venceu, força reset (GF2); senão, campeão.
    if(win===m.b && !struct.matches['GF2']){
      struct.matches['GF2'] = { id:'GF2', bracket:'GF', round:1, a:m.a, b:m.b, winner:null, loser:null, placar:null, tipo:null, wTo:null, lTo:null };
      struct.order.push('GF2');
    } else { struct.campeao = win.name; }
    return struct;
  }
  if(m.id==='GF2'){ struct.campeao = win.name; return struct; }
  put(struct, m.wTo, win);
  put(struct, m.lTo, lose.bye ? {bye:true} : lose); // perdedor cai na LB (ou marca BYE)
  autoResolveByes(struct);
  return struct;
}

// Avança automaticamente partidas em que um lado é BYE (incluindo a propagação do "perdedor BYE").
function autoResolveByes(struct){
  let changed = true;
  while(changed){
    changed = false;
    for(const mid of struct.order){
      const m = struct.matches[mid];
      if(m.winner || mid==='GF' || mid==='GF2') continue;
      const aB = m.a && m.a.bye, bB = m.b && m.b.bye;
      if(m.a && !aB && bB){ m.winner=m.a; m.loser=m.b; m.tipo='bye'; put(struct,m.wTo,m.a); put(struct,m.lTo,{bye:true}); changed=true; }
      else if(m.b && !bB && aB){ m.winner=m.b; m.loser=m.a; m.tipo='bye'; put(struct,m.wTo,m.b); put(struct,m.lTo,{bye:true}); changed=true; }
      else if(aB && bB){ m.winner={bye:true}; m.tipo='bye'; put(struct,m.wTo,{bye:true}); put(struct,m.lTo,{bye:true}); changed=true; }
    }
  }
}

export function nameOf(e){ return !e ? '—' : (e.bye ? 'BYE' : e.name); }
