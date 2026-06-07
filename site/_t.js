function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function nextPow2(n){let p=2;while(p<n)p*=2;return Math.max(2,p);}
function seedOrder(n){let arr=[1,2];while(arr.length<n){const s=arr.length*2+1,nx=[];for(const x of arr){nx.push(x);nx.push(s-x);}arr=nx;}return arr;}
function buildDraw(players,N,S){const order=seedOrder(N);const slot=new Array(N).fill(undefined);
for(let r=1;r<=S&&r<=players.length;r++){slot[order.indexOf(r)]={name:players[r-1],seed:r};}
const M=N/2;const nonseed=shuffle(players.slice(S));
const matchReal=i=>(slot[2*i]&&!slot[2*i].bye)||(slot[2*i+1]&&!slot[2*i+1].bye);
const openSlot=i=> slot[2*i]===undefined?2*i:(slot[2*i+1]===undefined?2*i+1:-1);
const seedOfMatch=i=>{const a=slot[2*i],b=slot[2*i+1];return (a&&a.seed)||(b&&b.seed)||Infinity;};
for(let i=0;i<M;i++){if(!matchReal(i)&&nonseed.length){slot[openSlot(i)]={name:nonseed.pop()};}}
const byes=N-players.length;const opens=[];for(let i=0;i<M;i++){const s=openSlot(i);if(s>=0)opens.push({slot:s,seed:seedOfMatch(i)});}
opens.sort((a,b)=>a.seed-b.seed);
for(let k=0;k<opens.length;k++){slot[opens[k].slot]=(k<byes)?{bye:true}:(nonseed.length?{name:nonseed.pop()}:{bye:true});}
return slot;}
function test(P,S){var players=[];for(var i=0;i<P;i++)players.push('J'+(i+1));
var N=nextPow2(P);S=Math.min(S,N/2,P);var s=buildDraw(players,N,S);
var names=s.filter(function(e){return e&&!e.bye}).map(function(e){return e.name});
var byes=s.filter(function(e){return e&&e.bye}).length;
var undef=s.filter(function(e){return e===undefined}).length;
var uniq=new Set(names).size;var bb=0;for(var i2=0;i2<N;i2+=2){if(s[i2]&&s[i2].bye&&s[i2+1]&&s[i2+1].bye)bb++;}
// seed1 deve ter bye se houver byes
var seed1slot=-1;for(var z=0;z<N;z++)if(s[z]&&s[z].seed===1)seed1slot=z;
var seed1bye = seed1slot>=0 ? (s[seed1slot^1]&&s[seed1slot^1].bye):false;
var ok=(names.length===P&&uniq===P&&undef===0&&bb===0&&(byes===0||S===0||seed1bye));
console.log('P='+P+' S='+S+' N='+N+' | jog='+names.length+' unic='+uniq+' byes='+byes+' byeVsBye='+bb+' seed1temBye='+seed1bye+' => '+(ok?'OK':'FALHOU'));}
test(20,4);test(16,4);test(13,4);test(7,2);test(2,0);test(5,4);test(48,8);test(31,8);test(64,16);test(9,8);test(3,2);
