
/* ===================================================================
   CONFIG — edite tudo aqui. O site se atualiza sozinho.
   =================================================================== */
const CONFIG = {
  contato: { whatsapp: "5565996364113", email: "silvester_natal@hotmail.com", pessoa: "Silvester Natal" },
  stats: [
    {n:400, prefix:"R$", suffix:"K+", label:"Em premiação"},
    {n:3500, sep:true, suffix:"+", label:"Público na semana"},
    {n:100, suffix:"K+", label:"Alcance digital"},
    {n:20, suffix:"+", label:"Inserções de mídia"}
  ],
  heroMeta: [
    {k:"Data", v:"07 — 13 SET 2026"},
    {k:"Local", v:"Tangará Tênis Clube · MT"},
    {k:"Categorias", v:"13 chaves · M & F"}
  ],
  tenistas: {
    confirmados: [
      {nome:"João Meneses", papel:"★ Ouro Pan-Americano", star:true},
      {nome:"Guilherme Clezar", papel:"Ex-ATP · confirmado"},
      {nome:"Gilbert", papel:"Presença confirmada"},
      {nome:"Christian Oliveira", papel:"Presença confirmada"},
      {nome:"Paulo Saraiva", papel:"Presença confirmada"},
      {nome:"Marvim", papel:"Presença confirmada"},
      {nome:"Kauê Noatto", papel:"Presença confirmada"}
    ],
    nota:"Presenças confirmadas. Demais nomes do circuito nacional em definição — line-up sujeito a confirmação contratual de cada atleta."
  },
  programacao: [
    {d:"07",dow:"SEG",ev:"Abertura",ds:"Coquetel e apresentação aos patrocinadores."},
    {d:"08",dow:"TER",ev:"Classificação",ds:"Primeira rodada · todas as categorias."},
    {d:"09",dow:"QUA",ev:"Oitavas",ds:"Disputa intensiva · ativações de marca."},
    {d:"10",dow:"QUI",ev:"Quartas",ds:"Eliminatórias · cobertura de mídia."},
    {d:"11",dow:"SEX",ev:"Semis + Jantar VIP",ds:"Networking exclusivo com patrocinadores.",hl:true},
    {d:"12",dow:"SÁB",ev:"Finais + Leilão",ds:"Decisões e leilão beneficente Florescer.",hl:true},
    {d:"13",dow:"DOM",ev:"Grandes Finais",ds:"Premiação e encerramento · R$400 mil.",hl:true}
  ],
  galeria: [
    {img:"img/cena-quadra.svg", label:"Quadra de saibro"},
    {img:"img/cena-arquibancada.svg", label:"Arquibancada lotada"},
    {img:"img/cena-jantar.svg", label:"Jantar VIP"},
    {img:"img/cena-ativacao.svg", label:"Ativações de marca"},
    {img:"img/cena-premiacao.svg", label:"Premiação · R$400 mil"},
    {img:"img/cena-beach.svg", label:"Beach tennis"}
  ],
  ingressos: [
    {ico:"🎾", titulo:"Inscrição de Atleta", preco:"Por categoria", sub:"", desc:"Dispute uma das 13 categorias (masculino e feminino, todos os níveis). Vagas limitadas por chave.", cta:"Quero me inscrever", interesse:"Inscrição de atleta"},
    {ico:"🍽️", titulo:"Mesa do Leilão", preco:"R$ 7.000", sub:"/ mesa", desc:"Jantar de gala open food, 6 convidados, experiência VIP e participação no leilão beneficente Florescer (12/09).", cta:"Reservar mesa", interesse:"Mesa do Leilão Florescer", feat:true},
    {ico:"⭐", titulo:"Convite VIP / Camarote", preco:"Sob consulta", sub:"", desc:"Acesso à área VIP durante a semana, Jantar VIP de sexta (11/09) e networking com a elite do agro.", cta:"Quero um convite", interesse:"Convite VIP / Camarote"}
  ],
  cotas: [
    {tier:"MASTER · NAMING RIGHTS", price:"R$75K", qt:'1 cota · "Agro Open by sua marca"', desc:"Naming rights da quadra principal, máxima exposição, stand premium 6×4m, 12 lugares no Jantar VIP e menções ilimitadas.", master:true, cta:"Quero a cota Master"},
    {tier:"DIAMANTE", price:"R$50K", qt:"4 cotas · quadras alternativas", desc:"Nome de quadra alternativa, logo premium no backdrop, stand 4×3m, 6 lugares no Jantar VIP e 10 posts oficiais.", cta:"Falar com a comissão"},
    {tier:"OURO", price:"R$25K", qt:"10 cotas · apoiador", desc:"Presença no backdrop e materiais oficiais, ativações de marca, stand 3×2m, 2 lugares no Jantar VIP e 4 posts oficiais.", cta:"Falar com a comissão"}
  ],
  patrocinadores: { master:1, diamante:4, ouro:10 },
  convidadas: ["Atacadão Dia&Dia","Amaggi","Jalles Machado","Bom Futuro","Sicredi","Sicoob","COFCO","Minerva","Banco Pátria","Copersucar","Barralcool","ALD","Eldorado Celulose","Veracel","CMAA","Coopercitrus","Alta Mogiana","Atos Sementes","Sementes J. Bassos","Queiroz Galvão","Bigmaster","Zilor","Atvos","Leo Madeiras","Sephora","Grupo Ser Educacional","Estácio","Porto do Açu","Energisa","Heineken"],
  hub: ["BP Bioenergy","Cerradinho Bio","Copersucar","Coruripe","Dori Alimentos","Eldorado Brasil","Fischer","Granol","Jacto","Jalles","Minerva Foods","Ouro Fino","Pedra Agroindustrial","Santa Helena","São Martinho","SLC Agrícola","Tereos","UISA","Usina Batatais","Usina Lins","Zilor"]
};

/* ===================== RENDER ===================== */
const $ = (s,el=document)=>el.querySelector(s);
const el = (html)=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstChild;};

// hero meta
$('#h-meta').innerHTML = CONFIG.heroMeta.map(m=>`<div class="m"><div class="k">${m.k}</div><div class="v">${m.v}</div></div>`).join('');
// strip stats
$('#strip').innerHTML = CONFIG.stats.map(s=>`<div class="cell"><div class="n" data-count="${s.n}" ${s.prefix?`data-prefix="${s.prefix}"`:''} ${s.suffix?`data-suffix="${s.suffix}"`:''} ${s.sep?'data-sep="1"':''}>0</div><div class="l">${s.label}</div></div>`).join('');
// players
$('#players').innerHTML = CONFIG.tenistas.confirmados.map(p=>`<div class="pc reveal ${p.star?'star':''}"><div class="bg"></div><h4>${p.nome}</h4><div class="r">${p.papel}</div></div>`).join('');
$('#players-note').textContent = CONFIG.tenistas.nota;
// days
$('#days').innerHTML = CONFIG.programacao.map(d=>`<div class="day reveal ${d.hl?'hl':''}"><div class="num">${d.d}</div><div class="dow">${d.dow}</div><div class="ev">${d.ev}</div><div class="ds">${d.ds}</div></div>`).join('');
// gallery
$('#gallery').innerHTML = CONFIG.galeria.map(g=>`<div class="gtile reveal" data-l="${g.label}" style="background-image:url(${g.img})"></div>`).join('');
// tickets
$('#tickets').innerHTML = CONFIG.ingressos.map(t=>`<div class="tcard reveal ${t.feat?'feat':''}"><div class="ico">${t.ico}</div><h3>${t.titulo}</h3><div class="price">${t.preco} <small>${t.sub||''}</small></div><p>${t.desc}</p><a class="btn ${t.feat?'gold':''} js-wa" data-int="${t.interesse}">${t.cta} →</a></div>`).join('');
// cotas
$('#cotas').innerHTML = CONFIG.cotas.map(c=>`<div class="cota reveal ${c.master?'master':''}">${c.master?'<div class="ribbon">EXCLUSIVA</div>':''}<div class="tier">${c.tier}</div><div class="price">${c.price}</div><div class="qt">${c.qt}</div><p>${c.desc}</p><a class="btn ${c.master?'':'ghost'} js-wa" data-int="Patrocínio (cotas)" style="margin-top:22px">${c.cta}</a></div>`).join('');
// sponsor wall
const slots = (n,cls='')=>Array.from({length:n}).map(()=>`<a class="slot ${cls} js-wa" data-int="Patrocínio (cotas)">${cls==='master'?'SUA MARCA AQUI · "AGRO OPEN BY ___"':'DISPONÍVEL'}</a>`).join('');
$('#wall').innerHTML = `
  <div class="tierrow master reveal"><div class="tierhead"><b>MASTER · NAMING RIGHTS</b><span class="ln"></span><span class="pr">R$ 75K · 1 cota exclusiva</span></div><div class="slots">${slots(CONFIG.patrocinadores.master,'master')}</div></div>
  <div class="tierrow reveal"><div class="tierhead"><b>DIAMANTE</b><span class="ln"></span><span class="pr">R$ 50K · ${CONFIG.patrocinadores.diamante} cotas</span></div><div class="slots">${slots(CONFIG.patrocinadores.diamante)}</div></div>
  <div class="tierrow reveal"><div class="tierhead"><b>OURO</b><span class="ln"></span><span class="pr">R$ 25K · ${CONFIG.patrocinadores.ouro} cotas</span></div><div class="slots">${slots(CONFIG.patrocinadores.ouro)}</div></div>`;
// marquees
const chips = (arr)=>arr.map(b=>`<span class="chip"${b==='UISA'?' style="border-color:var(--lime);color:var(--lime)"':''}>${b}</span>`).join('');
$('#mq-inv-1').innerHTML = chips(CONFIG.convidadas)+chips(CONFIG.convidadas);
$('#mq-inv-2').innerHTML = chips([...CONFIG.convidadas].reverse())+chips([...CONFIG.convidadas].reverse());
$('#mq-hub').innerHTML = chips(CONFIG.hub)+chips(CONFIG.hub);
// contact display
$('#c-phone').textContent = '+'+CONFIG.contato.whatsapp.replace(/^55/,'55 ');
$('#c-email').textContent = CONFIG.contato.email;

/* ===================== INTERAÇÕES ===================== */
// reveal
const io=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(x=>io.observe(x));
// count up
const fmt=(n,sep)=>sep?n.toLocaleString('pt-BR'):String(n);
const cio=new IntersectionObserver((es)=>es.forEach(e=>{
  if(!e.isIntersecting)return;cio.unobserve(e.target);
  const x=e.target,end=+x.dataset.count,pre=x.dataset.prefix||'',suf=x.dataset.suffix||'',sep=x.dataset.sep;
  let t0=null;const step=t=>{if(!t0)t0=t;const p=Math.min((t-t0)/1300,1),e2=1-Math.pow(1-p,3);x.textContent=pre+fmt(Math.round(end*e2),sep)+suf;if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step);
}),{threshold:.6});
document.querySelectorAll('[data-count]').forEach(c=>cio.observe(c));
// nav + progress + totop
const nav=$('#nav'),prog=$('#progress'),totop=$('#totop');
addEventListener('scroll',()=>{
  const sc=scrollY,h=document.documentElement.scrollHeight-innerHeight;
  nav.classList.toggle('scrolled',sc>20);
  prog.style.width=(sc/h*100)+'%';
  totop.classList.toggle('show',sc>700);
});
totop.onclick=()=>scrollTo({top:0,behavior:'smooth'});
// active nav link
const navIds=[...document.querySelectorAll('#navlinks a')].map(a=>a.getAttribute('href').slice(1));
const sio=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){document.querySelectorAll('#navlinks a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id))}}),{rootMargin:'-45% 0px -50% 0px'});
navIds.forEach(id=>{const s=document.getElementById(id);if(s)sio.observe(s)});
// mobile nav
const mob=$('#mobnav');
$('#burger').onclick=()=>mob.classList.add('open');
$('#mobclose').onclick=()=>mob.classList.remove('open');
mob.querySelectorAll('a').forEach(a=>a.onclick=()=>mob.classList.remove('open'));
// toast
const toast=$('#toast');
const showToast=(m)=>{toast.textContent=m;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)};
// whatsapp prefilled (cards/slots)
function waMessage(interesse,extra=''){
  const t=`Olá! Tenho interesse em *${interesse}* na 4ª Agro Open de Tênis.${extra}`;
  return `https://wa.me/${CONFIG.contato.whatsapp}?text=${encodeURIComponent(t)}`;
}
document.addEventListener('click',e=>{
  const a=e.target.closest('.js-wa');
  if(!a)return;
  e.preventDefault();
  showToast('Abrindo o WhatsApp…');
  window.open(waMessage(a.dataset.int||'a 4ª Agro Open'),'_blank');
});
// contact form
function buildMsg(){
  const v=id=>$('#'+id).value.trim();
  return `Olá! Contato pela página da 4ª Agro Open.%0A`+
    `*Nome:* ${v('f-nome')||'-'}%0A*Empresa:* ${v('f-empresa')||'-'}%0A`+
    `*E-mail:* ${v('f-email')||'-'}%0A*Telefone:* ${v('f-tel')||'-'}%0A`+
    `*Interesse:* ${$('#f-interesse').value}%0A*Mensagem:* ${v('f-msg')||'-'}`;
}
$('#send-wa').onclick=()=>{
  if(!$('#f-nome').value.trim()){$('#f-nome').focus();return showToast('Informe seu nome')}
  showToast('Abrindo o WhatsApp…');
  window.open(`https://wa.me/${CONFIG.contato.whatsapp}?text=${buildMsg()}`,'_blank');
};
$('#send-mail').onclick=()=>{
  if(!$('#f-nome').value.trim()){$('#f-nome').focus();return showToast('Informe seu nome')}
  const sub=encodeURIComponent('Contato 4ª Agro Open · '+$('#f-interesse').value);
  const body=buildMsg().replace(/%0A/g,'%0D%0A');
  location.href=`mailto:${CONFIG.contato.email}?subject=${sub}&body=${body}`;
};
