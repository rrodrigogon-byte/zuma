
const $=(s)=>document.querySelector(s);
const ROUND_NAMES=["1ª Rodada","Oitavas","Quartas","Semifinal","Final","Campeão"];
let state=null; // {size, seeds, rounds:[[entry|null]...], categoria}

const SAMPLE=["João Meneses","Guilherme Clezar","Gilbert","Christian Oliveira","Paulo Saraiva","Marvim","Kauê Noatto","Rafael Costa","Bruno Almeida","Pedro Henrique","Lucas Martins","Felipe Souza","André Lima","Thiago Rocha","Gustavo Dias","Marcelo Nunes","Ricardo Alves","Diego Fernandes","Vitor Gomes","Eduardo Pires"];

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function nextPow2(n){let p=2;while(p<n)p*=2;return Math.max(2,p);}
// ordem oficial de posicionamento dos cabeças de chave
function seedOrder(n){let arr=[1,2];while(arr.length<n){const s=arr.length*2+1,nx=[];for(const x of arr){nx.push(x);nx.push(s-x);}arr=nx;}return arr;}

function readPlayers(){return $('#players').value.split('\n').map(s=>s.trim()).filter(Boolean);}
function updateCount(){const n=readPlayers().length;$('#count').textContent=n+' atleta'+(n===1?'':'s');}

function buildDraw(players,N,S){
  const order=seedOrder(N);
  const slot=new Array(N).fill(undefined);
  for(let r=1;r<=S && r<=players.length;r++){slot[order.indexOf(r)]={name:players[r-1],seed:r};}
  let byes=N-players.length;
  // byes para os melhores cabeças
  for(let r=1;r<=S && byes>0;r++){const i=order.indexOf(r),p=i^1;if(slot[p]===undefined){slot[p]={bye:true};byes--;}}
  let open=[];for(let i=0;i<N;i++)if(slot[i]===undefined)open.push(i);
  shuffle(open);
  // byes restantes em slots cujo par já tem jogador (evita bye x bye)
  for(let k=0;k<open.length&&byes>0;k++){const i=open[k],p=i^1;if(slot[p]&&!slot[p].bye){slot[i]={bye:true};open.splice(k,1);k--;byes--;}}
  while(byes>0&&open.length){slot[open.pop()]={bye:true};byes--;}
  const nonseed=shuffle(players.slice(S));
  for(const i of open){slot[i]=nonseed.length?{name:nonseed.pop()}:{bye:true};}
  return slot;
}

function makeRounds(slot){
  const rounds=[slot];
  let size=slot.length;
  while(size>1){size/=2;rounds.push(new Array(size).fill(null));}
  resolveByes(rounds);
  return rounds;
}
// auto-avança byes e partidas já decididas por bye em cadeia
function resolveByes(rounds){
  for(let r=0;r<rounds.length-1;r++){
    for(let m=0;m<rounds[r].length;m+=2){
      const a=rounds[r][m],b=rounds[r][m+1],dst=Math.floor(m/2);
      if(rounds[r+1][dst]) continue;
      const aReal=a&&!a.bye, bReal=b&&!b.bye;
      if(aReal&&b&&b.bye){rounds[r+1][dst]=a;}
      else if(bReal&&a&&a.bye){rounds[r+1][dst]=b;}
    }
  }
}

function advance(r,idx){
  if(!state)return;
  const entry=state.rounds[r][idx];
  if(!entry||entry.bye)return;
  const dst=Math.floor(idx/2);
  // limpa caminho anterior se mudou o vencedor
  const prev=state.rounds[r+1] && state.rounds[r+1][dst];
  if(prev && prev!==entry){ clearDownstream(r+1,dst); }
  if(!state.rounds[r+1])return;
  state.rounds[r+1][dst]=entry;
  render();
}
function clearDownstream(r,idx){
  if(r>=state.rounds.length)return;
  state.rounds[r][idx]=null;
  if(r<state.rounds.length-1) clearDownstream(r+1,Math.floor(idx/2));
}

function entryName(e){return !e?'—':e.bye?'BYE':e.name;}

function render(animate){
  const br=$('#bracket');br.innerHTML='';
  $('#empty').style.display='none';
  state.rounds.forEach((round,r)=>{
    const col=document.createElement('div');col.className='round';
    const h=document.createElement('div');h.className='rhead';h.textContent=ROUND_NAMES[r]||('Rodada '+(r+1));
    if(r<state.rounds.length-1) col.appendChild(h);
    if(r===state.rounds.length-1){ // coluna campeão
      const champ=round[0];
      const c=document.createElement('div');c.className='match show';c.style.alignSelf='center';
      c.innerHTML=`<div class="seat ${champ&&!champ.bye?'win':'empty'}"><span class="nm">${entryName(champ)}</span></div>`;
      const ch=document.createElement('div');ch.className='rhead';ch.textContent='Campeão';col.appendChild(ch);col.appendChild(c);br.appendChild(col);
      return;
    }
    for(let m=0;m<round.length;m+=2){
      const a=round[m],b=round[m+1];
      const winner=state.rounds[r+1]&&state.rounds[r+1][Math.floor(m/2)];
      const match=document.createElement('div');match.className='match';
      [[a,m],[b,m+1]].forEach(([e,idx])=>{
        const isWin=winner&&e&&e===winner;
        const cls=e?(e.bye?'bye':(isWin?'win':'')):'empty';
        const seat=document.createElement('div');seat.className='seat '+cls;
        seat.innerHTML=(e&&e.seed?`<span class="sd">${e.seed}</span>`:'')+`<span class="nm">${entryName(e)}</span>`;
        if(e&&!e.bye){seat.onclick=()=>advance(r,idx);}
        match.appendChild(seat);
      });
      col.appendChild(match);
    }
    br.appendChild(col);
  });
  // animação de revelação
  const matches=[...br.querySelectorAll('.match')];
  matches.forEach((mm,i)=>{ if(animate){setTimeout(()=>mm.classList.add('show'),i*45);} else mm.classList.add('show'); });
  // campeão
  const last=state.rounds[state.rounds.length-1][0];
  const champ=$('#champion');
  if(last&&!last.bye){$('#champ-name').textContent=last.name;champ.classList.add('show');}
  else champ.classList.remove('show');
  ['reset','save','print'].forEach(id=>$('#'+id).style.display='inline-flex');
  // meta
  const real=state.rounds[0].filter(e=>e&&!e.bye).length;
  const byes=state.rounds[0].filter(e=>e&&e.bye).length;
  $('#meta').innerHTML=`<span class="tag">${state.categoria}</span><span>Chave de <b>${state.size}</b></span><span><b>${real}</b> atletas</span><span><b>${state.seeds}</b> cabeças</span>${byes?`<span><b>${byes}</b> byes</span>`:''}`;
}

function doDraw(){
  let players=readPlayers();
  if(players.length<2){toast('Insira pelo menos 2 atletas');return;}
  let S=parseInt($('#seeds').value);
  if($('#seedmode').value==='random'&&S>0){ // sorteia quem são os cabeças
    const seeds=shuffle([...players]).slice(0,S);
    const rest=players.filter(p=>!seeds.includes(p));
    players=[...seeds,...rest];
  }
  let N=$('#size').value==='auto'?nextPow2(players.length):parseInt($('#size').value);
  if(N<players.length){toast('Chave menor que o nº de atletas — ajustando');N=nextPow2(players.length);}
  S=Math.min(S,players.length,N/2);
  const slot=buildDraw(players,N,S);
  state={size:N,seeds:S,categoria:$('#categoria').value,rounds:makeRounds(slot)};
  render(true);
  toast('Chaves sorteadas!');
  $('#bracket').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}

// eventos
$('#players').addEventListener('input',updateCount);
$('#sample').onclick=()=>{$('#players').value=SAMPLE.join('\n');updateCount();};
$('#clearTxt').onclick=()=>{$('#players').value='';updateCount();};
$('#draw').onclick=doDraw;
$('#reset').onclick=()=>{ // limpa vencedores, mantém sorteio
  if(!state)return; for(let r=1;r<state.rounds.length;r++)state.rounds[r].fill(null);
  resolveByes(state.rounds); render(); toast('Vencedores reiniciados');
};
$('#print').onclick=()=>window.print();
$('#save').onclick=()=>{try{localStorage.setItem('agroopen_sorteio',JSON.stringify(state));toast('Sorteio salvo neste navegador');}catch(e){toast('Não foi possível salvar');}};
// restaura se houver salvo
try{const s=localStorage.getItem('agroopen_sorteio');if(s){state=JSON.parse(s);render();}}catch(e){}
updateCount();
