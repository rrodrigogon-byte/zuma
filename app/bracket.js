// Motor de chaveamento estilo Grand Slam (cabeças de chave + byes)
export function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function nextPow2(n){let p=2;while(p<n)p*=2;return Math.max(2,p);}

// ordem oficial de posicionamento dos cabeças (1, N, ... ) no padrão ITF
export function seedOrder(n){let arr=[1,2];while(arr.length<n){const s=arr.length*2+1,nx=[];for(const x of arr){nx.push(x);nx.push(s-x);}arr=nx;}return arr;}

// Gera a 1ª rodada: cabeças nas posições oficiais, byes para os melhores ranqueados,
// garantindo 1 atleta real por confronto (nunca bye x bye quando possível).
export function buildDraw(players, N, S){
  const order = seedOrder(N);
  const slot = new Array(N).fill(undefined);
  for(let r=1;r<=S && r<=players.length;r++) slot[order.indexOf(r)] = { name: players[r-1], seed: r };
  const M = N/2;
  const nonseed = shuffle(players.slice(S));
  const matchReal = i => (slot[2*i]&&!slot[2*i].bye) || (slot[2*i+1]&&!slot[2*i+1].bye);
  const openSlot  = i => slot[2*i]===undefined ? 2*i : (slot[2*i+1]===undefined ? 2*i+1 : -1);
  const seedOfMatch = i => { const a=slot[2*i], b=slot[2*i+1]; return (a&&a.seed)||(b&&b.seed)||Infinity; };
  for(let i=0;i<M;i++){ if(!matchReal(i) && nonseed.length){ slot[openSlot(i)] = { name: nonseed.pop() }; } }
  const byes = N - players.length;
  const opens = [];
  for(let i=0;i<M;i++){ const s=openSlot(i); if(s>=0) opens.push({slot:s, seed:seedOfMatch(i)}); }
  opens.sort((a,b)=>a.seed-b.seed);
  for(let k=0;k<opens.length;k++){ slot[opens[k].slot] = (k<byes) ? {bye:true} : (nonseed.length ? {name:nonseed.pop()} : {bye:true}); }
  return slot;
}

export function makeRounds(slot){
  const rounds=[slot]; let size=slot.length;
  while(size>1){ size/=2; rounds.push(new Array(size).fill(null)); }
  resolveByes(rounds);
  return rounds;
}

// auto-avança byes
export function resolveByes(rounds){
  for(let r=0;r<rounds.length-1;r++){
    for(let m=0;m<rounds[r].length;m+=2){
      const a=rounds[r][m], b=rounds[r][m+1], dst=Math.floor(m/2);
      if(rounds[r+1][dst]) continue;
      if(a&&!a.bye && b&&b.bye) rounds[r+1][dst]=a;
      else if(b&&!b.bye && a&&a.bye) rounds[r+1][dst]=b;
    }
  }
}

// Sorteia uma chave completa a partir de uma lista de nomes
// opts.wildcards: nomes que entram como convidados (marcados wc); opts.qualifying: marca a chave como qualificatório
export function sortear(players, opts={}){
  let list = players.filter(Boolean);
  const wildcards = (opts.wildcards||[]).map(s=>String(s).trim()).filter(Boolean);
  wildcards.forEach(w=>{ if(!list.includes(w)) list.push(w); });
  let S = opts.seeds ?? 4;
  if(opts.seedmode === 'random' && S>0){
    const seeds = shuffle([...list]).slice(0,S);
    const rest = list.filter(p=>!seeds.includes(p));
    list = [...seeds, ...rest];
  }
  let N = opts.size && opts.size!=='auto' ? parseInt(opts.size) : nextPow2(list.length);
  if(N < list.length) N = nextPow2(list.length);
  S = Math.min(S, list.length, N/2);
  const slot = buildDraw(list, N, S);
  const rounds = makeRounds(slot);
  if(wildcards.length) rounds[0].forEach(e=>{ if(e && !e.bye && wildcards.includes(e.name)) e.wc = true; });
  return { size:N, seeds:S, rounds, qualifying: !!opts.qualifying, createdAt: new Date().toISOString() };
}
