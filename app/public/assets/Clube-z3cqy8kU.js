import{r as l,j as e,L as h}from"./index-B-eVhK9w.js";const m={deep:"#12283F",forest:"#12283F"},w=`
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@300;400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes float {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    33%      { transform: translateY(-12px) rotate(1deg); }
    66%      { transform: translateY(-6px) rotate(-1deg); }
  }
  @keyframes pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .7; transform: scale(0.97); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes gradShift {
    0%,100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
  }
  @keyframes rotateSlow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes counterUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes cardFlip {
    0%   { transform: perspective(800px) rotateY(0deg); }
    100% { transform: perspective(800px) rotateY(360deg); }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 20px rgba(255,107,44,0.3); }
    50%      { box-shadow: 0 0 50px rgba(255,107,44,0.7), 0 0 80px rgba(255,107,44,0.3); }
  }
  @keyframes scanLine {
    0%   { top: 0%; }
    100% { top: 100%; }
  }
  @keyframes borderGlow {
    0%,100% { border-color: rgba(255,107,44,0.3); }
    50%      { border-color: rgba(255,107,44,0.9); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-50px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(50px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes zoomBg {
    from { transform: scale(1.08); }
    to   { transform: scale(1); }
  }
  @keyframes ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .ttc-fade-up    { animation: fadeUp .8s ease both; }
  .ttc-fade-in    { animation: fadeIn .6s ease both; }
  .ttc-scale-in   { animation: scaleIn .6s ease both; }
  .ttc-float      { animation: float 5s ease-in-out infinite; }
  .ttc-pulse      { animation: pulse 2.5s ease-in-out infinite; }

  .ttc-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    transition: all .4s ease;
  }
  .ttc-nav.scrolled {
    background: rgba(7,26,14,0.97);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,107,44,0.15);
    box-shadow: 0 4px 30px rgba(0,0,0,0.5);
  }
  .ttc-nav-link {
    position: relative; color: rgba(255,255,255,0.8);
    font-size: 13px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; text-decoration: none;
    padding: 6px 0; transition: color .3s;
  }
  .ttc-nav-link::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0;
    height: 2px; background: #FF9B72;
    transform: scaleX(0); transform-origin: center;
    transition: transform .3s ease;
  }
  .ttc-nav-link:hover, .ttc-nav-link.active { color: #FF9B72; }
  .ttc-nav-link:hover::after, .ttc-nav-link.active::after { transform: scaleX(1); }

  .ttc-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, #FF9B72, #2D6F9E);
    color: #12283F; font-weight: 700; font-size: 14px;
    letter-spacing: .05em; text-transform: uppercase;
    padding: 14px 32px; border-radius: 50px;
    border: none; cursor: pointer; text-decoration: none;
    transition: all .3s ease;
    box-shadow: 0 4px 20px rgba(255,107,44,0.4);
  }
  .ttc-btn-primary:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 30px rgba(255,107,44,0.6);
    background: linear-gradient(135deg, #8AA9C0, #8AA9C0);
  }
  .ttc-btn-outline {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent;
    color: #fff; font-weight: 600; font-size: 14px;
    letter-spacing: .05em; text-transform: uppercase;
    padding: 13px 32px; border-radius: 50px;
    border: 2px solid rgba(255,255,255,0.4); cursor: pointer; text-decoration: none;
    transition: all .3s ease;
  }
  .ttc-btn-outline:hover {
    border-color: #FF9B72; color: #FF9B72;
    transform: translateY(-2px);
  }
  .ttc-btn-gold {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, #FF6B2C, #E8C87A);
    color: #12283F; font-weight: 700; font-size: 14px;
    letter-spacing: .05em; text-transform: uppercase;
    padding: 14px 32px; border-radius: 50px;
    border: none; cursor: pointer; text-decoration: none;
    transition: all .3s ease;
    box-shadow: 0 4px 20px rgba(255,107,44,0.4);
  }
  .ttc-btn-gold:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 30px rgba(255,107,44,0.6);
  }

  .ttc-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    backdrop-filter: blur(12px);
    transition: all .4s ease;
  }
  .ttc-card:hover {
    background: rgba(255,255,255,0.09);
    border-color: rgba(255,107,44,0.3);
    transform: translateY(-6px);
    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
  }

  .ticker-wrap {
    overflow: hidden; width: 100%;
    background: linear-gradient(90deg, #FF9B72, #2D6F9E, #FF6B2C, #FF9B72);
    padding: 10px 0;
  }
  .ticker-inner {
    display: flex; gap: 0;
    animation: ticker 30s linear infinite;
    width: max-content;
  }
  .ticker-item {
    white-space: nowrap; padding: 0 40px;
    font-size: 13px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: #12283F;
  }

  .gallery-item { overflow: hidden; border-radius: 16px; cursor: pointer; }
  .gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .6s ease; display: block; }
  .gallery-item:hover img { transform: scale(1.08); }

  .modal-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,0.92); backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: fadeIn .3s ease;
  }

  .carteirinha-card {
    background: linear-gradient(135deg, #12283F 0%, #12283F 50%, #12283F 100%);
    border: 2px solid rgba(255,107,44,0.4);
    border-radius: 24px;
    padding: 32px;
    position: relative;
    overflow: hidden;
    animation: glowPulse 3s ease-in-out infinite;
    max-width: 420px; width: 100%;
  }
  .carteirinha-card::before {
    content: ''; position: absolute; top: -50%; right: -30%;
    width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,107,44,0.12), transparent 70%);
    pointer-events: none;
  }
  .carteirinha-card::after {
    content: ''; position: absolute; inset: 0;
    border-radius: 24px;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(255,107,44,0.02) 2px, rgba(255,107,44,0.02) 4px
    );
    pointer-events: none;
  }
  .qr-container {
    background: #fff;
    border-radius: 12px;
    padding: 12px;
    display: inline-flex;
    animation: glowPulse 2s ease-in-out infinite;
  }
  .qr-scan-line {
    position: absolute; left: 12px; right: 12px; height: 2px;
    background: linear-gradient(90deg, transparent, #FF9B72, transparent);
    animation: scanLine 2s linear infinite;
    border-radius: 2px;
  }

  .visitor-widget {
    display: inline-flex; align-items: center; gap: 12px;
    background: rgba(255,107,44,0.1);
    border: 1px solid rgba(255,107,44,0.3);
    border-radius: 50px;
    padding: 10px 24px;
    backdrop-filter: blur(10px);
    transition: all .3s;
  }
  .visitor-widget:hover {
    background: rgba(255,107,44,0.18);
    border-color: rgba(255,107,44,0.6);
  }

  .estrutura-tab {
    padding: 10px 24px; border-radius: 50px;
    font-size: 13px; font-weight: 600; letter-spacing: .04em;
    cursor: pointer; transition: all .3s; border: 1.5px solid transparent;
    white-space: nowrap;
  }
  .estrutura-tab.active {
    background: linear-gradient(135deg, #FF9B72, #2D6F9E);
    color: #12283F; border-color: transparent;
    box-shadow: 0 4px 16px rgba(255,107,44,0.4);
  }
  .estrutura-tab:not(.active) {
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.7);
    border-color: rgba(255,255,255,0.1);
  }
  .estrutura-tab:not(.active):hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,107,44,0.3);
    color: #FF9B72;
  }

  .plano-card {
    border-radius: 24px; padding: 36px 28px;
    border: 1.5px solid rgba(255,255,255,0.1);
    position: relative; overflow: hidden;
    transition: all .4s ease;
  }
  .plano-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
  }
  .plano-card.destaque {
    border-color: rgba(255,107,44,0.5);
    box-shadow: 0 0 40px rgba(255,107,44,0.15);
  }

  .section-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255,107,44,0.12);
    border: 1px solid rgba(255,107,44,0.3);
    color: #FF9B72; font-size: 12px; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase;
    padding: 6px 18px; border-radius: 50px;
    margin-bottom: 20px;
  }

  .stat-number {
    font-family: 'Playfair Display', serif;
    font-size: clamp(40px, 6vw, 72px);
    font-weight: 900; line-height: 1;
    background: linear-gradient(135deg, #FF9B72, #FF6B2C);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .divider-gold {
    height: 3px; width: 60px;
    background: linear-gradient(90deg, #FF6B2C, #FF9B72);
    border-radius: 2px;
    margin: 16px auto;
  }

  @media (max-width: 768px) {
    .ttc-nav-desktop { display: none !important; }
    .ttc-mobile-menu { display: flex !important; }
  }
  @media (min-width: 769px) {
    .ttc-mobile-menu { display: none !important; }
  }

  html { scroll-behavior: smooth; }
  body { overflow-x: hidden; }

  .section-transition {
    opacity: 0; transform: translateY(40px);
    transition: opacity .8s ease, transform .8s ease;
  }
  .section-transition.visible {
    opacity: 1; transform: translateY(0);
  }
`;function F(t=.15){const i=l.useRef(null),[r,n]=l.useState(!1);return l.useEffect(()=>{const o=new IntersectionObserver(([c])=>{c.isIntersecting&&(n(!0),o.disconnect())},{threshold:t});return i.current&&o.observe(i.current),()=>o.disconnect()},[t]),[i,r]}function b(t,i=2e3,r=!1){const[n,o]=l.useState(0);return l.useEffect(()=>{if(!r||!t)return;const c=performance.now(),a=s=>{const p=Math.min((s-c)/i,1),g=1-Math.pow(1-p,3);o(Math.round(g*t)),p<1&&requestAnimationFrame(a)};requestAnimationFrame(a)},[t,i,r]),n}const y=[{id:"quem-somos",label:"O Clube"},{id:"estrutura",label:"Estrutura"},{id:"eventos",label:"Eventos"},{id:"carteirinha",label:"🪪 Carteirinha"},{id:"seja-socio",label:"Seja Sócio"},{id:"contato",label:"Contato"}],x=[{value:30,suffix:"+",label:"Anos de história",icon:"🏛️"},{value:5e3,suffix:"+",label:"Famílias associadas",icon:"👨‍👩‍👧‍👦"},{value:6,suffix:"",label:"Modalidades esportivas",icon:"🎾"},{value:4,suffix:"ª",label:"Edição Agro Open",icon:"🏆"}],j=[{nome:"Tênis",icon:"🎾",cor:"#FF9B72",desc:"8 quadras de saibro, academia e torneios nacionais",itens:["8 quadras saibro","Academia profissional","Ranking TTC","Torneios nacionais"]},{nome:"Natação",icon:"🏊",cor:"#4FC3F7",desc:"Piscina olímpica aquecida com treinos para todas as idades",itens:["Piscina olímpica","Água aquecida","Escolinha kids","Treinos adultos"]},{nome:"Padel",icon:"🏸",cor:"#FFB74D",desc:"Quadras de padel com iluminação LED e piso profissional",itens:["4 quadras padel","Iluminação LED","Aulas coletivas","Torneios mensais"]},{nome:"Futebol",icon:"⚽",cor:"#EF5350",desc:"Campo sintético com vestiários e arquibancada coberta",itens:["Campo sintético","Vestiários","Arquibancada","Escolinha futsal"]},{nome:"Musculação",icon:"💪",cor:"#AB47BC",desc:"Academia moderna com equipamentos de última geração",itens:["400m² equipados","Personal trainer","Avaliação física","Horários flexíveis"]},{nome:"Espaço Social",icon:"🥂",cor:"#FF6B2C",desc:"Restaurante, bar, salões para eventos e área gourmet",itens:["Restaurante","Bar & lounge","Salão de festas","Espaço gourmet"]}],B=[{titulo:"4ª Agro Open de Tênis",data:"2026",desc:"O maior torneio de tênis do Centro-Oeste. R$ 250.000+ em premiação, 250+ atletas profissionais e amadores de todo o Brasil.",tags:["14 categorias","R$ 250.000+","Inscrições abertas"],cor:"#FF9B72",icon:"🏆",destaque:!0},{titulo:"Campeonato Interno de Tênis",data:"Julho/2026",desc:"Torneio exclusivo para sócios. Todas as categorias com troféus, premiação especial e confraternização após as partidas.",tags:["Sócios","Todas as idades","Troféus"],cor:"#4FC3F7",icon:"🎾"},{titulo:"Copa Família TTC",data:"Agosto/2026",desc:"Torneio de duplas para famílias. Uma tarde de esporte, alegria e integração entre as famílias do clube.",tags:["Duplas","Família","Diversão"],cor:"#FFB74D",icon:"👨‍👩‍👧‍👦"},{titulo:"Grand Prix de Padel",data:"Setembro/2026",desc:"Torneio de padel com transmissão ao vivo. Categorias A, B e C com premiação para os finalistas.",tags:["Padel","Ao vivo","R$ 5.000"],cor:"#AB47BC",icon:"🏸"}],C=[{nome:"Individual",preco:"R$ 189",periodo:"/mês",cor:"linear-gradient(135deg, #12283F, #12283F)",itens:["1 pessoa","Acesso às quadras","Natação","Academia","Área social"],destaque:!1},{nome:"Familiar",preco:"R$ 349",periodo:"/mês",cor:"linear-gradient(135deg, #12283F, #12283F)",destaque:!0,badge:"⭐ Mais popular",itens:["Até 4 pessoas","Todos os benefícios","Eventos exclusivos","Prioridade inscrição","App Sócio"]},{nome:"VIP",preco:"R$ 699",periodo:"/mês",cor:"linear-gradient(135deg, #2a2000, #1a1400)",border:"1.5px solid rgba(255,107,44,0.5)",itens:["Família + hóspedes","Camarote torneios","Personal trainer","Nutricionista","Eventos premium","Transfer incluso"],destaque:!1,vip:!0}],T=Array.from({length:12},(t,i)=>`/ttc/galeria/foto${i+1}.jpg`),z=["Todos","Tênis","Eventos","Estrutura","Social"];function d({children:t,delay:i=0,style:r={}}){const[n,o]=F(.12);return e.jsx("div",{ref:n,className:"section-transition",style:{...r,...o?{opacity:1,transform:"translateY(0)",transitionDelay:`${i}ms`}:{}},children:t})}function I(){const t=["🏆 4ª Agro Open de Tênis","💰 R$ 250.000+ em Premiação","🎾 250+ Atletas Profissionais","🏛️ 30+ Anos de Tradição","👨‍👩‍👧‍👦 5.000+ Famílias Associadas","⭐ O Maior Clube do Centro-Oeste"],i=[...t,...t];return e.jsx("div",{className:"ticker-wrap",children:e.jsx("div",{className:"ticker-inner",children:i.map((r,n)=>e.jsxs("span",{className:"ticker-item",children:[r,"   •  "]},n))})})}function E({activeSection:t,onNav:i}){const[r,n]=l.useState(!1),[o,c]=l.useState(!1);return l.useEffect(()=>{const a=()=>n(window.scrollY>60);return window.addEventListener("scroll",a,{passive:!0}),()=>window.removeEventListener("scroll",a)},[]),e.jsxs("nav",{className:`ttc-nav${r?" scrolled":""}`,children:[e.jsxs("div",{style:{maxWidth:1200,margin:"0 auto",padding:"0 24px",height:70,display:"flex",alignItems:"center",justifyContent:"space-between"},children:[e.jsxs(h,{to:"/",style:{textDecoration:"none",display:"flex",alignItems:"center",gap:10},children:[e.jsx("div",{style:{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg, #FF9B72, #2D6F9E)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#12283F",boxShadow:"0 4px 16px rgba(255,107,44,0.4)"},children:"TTC"}),e.jsxs("div",{children:[e.jsx("div",{style:{color:"#fff",fontWeight:700,fontSize:15,letterSpacing:".04em",lineHeight:1.2},children:"Tênis & Touring"}),e.jsx("div",{style:{color:"#FF9B72",fontSize:10,fontWeight:600,letterSpacing:".12em",textTransform:"uppercase"},children:"Clube"})]})]}),e.jsx("div",{className:"ttc-nav-desktop",style:{display:"flex",gap:28,alignItems:"center"},children:y.map(a=>e.jsx("a",{href:`#${a.id}`,className:`ttc-nav-link${t===a.id?" active":""}`,onClick:s=>{s.preventDefault(),i(a.id)},children:a.label},a.id))}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:12},children:[e.jsx("a",{href:"#seja-socio",className:"ttc-btn-primary",style:{padding:"10px 22px",fontSize:13},children:"Seja Sócio"}),e.jsx("button",{className:"ttc-mobile-menu",onClick:()=>c(a=>!a),style:{background:"transparent",border:"none",color:"#fff",fontSize:24,cursor:"pointer",padding:4},children:o?"✕":"☰"})]})]}),o&&e.jsx("div",{style:{background:"rgba(7,26,14,0.98)",borderTop:"1px solid rgba(255,107,44,0.15)",padding:"16px 24px 24px"},children:y.map(a=>e.jsx("a",{href:`#${a.id}`,style:{display:"block",color:"rgba(255,255,255,0.85)",padding:"12px 0",fontSize:15,fontWeight:500,borderBottom:"1px solid rgba(255,255,255,0.07)",textDecoration:"none",transition:"color .2s"},onClick:s=>{s.preventDefault(),i(a.id),c(!1)},children:a.label},a.id))})]})}function W({visitantes:t,onNavCarteirinha:i}){const[r,n]=l.useState(0);return l.useEffect(()=>{const o=()=>n(window.scrollY);return window.addEventListener("scroll",o,{passive:!0}),()=>window.removeEventListener("scroll",o)},[]),e.jsxs("section",{style:{position:"relative",height:"100vh",minHeight:680,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"},children:[e.jsx("div",{style:{position:"absolute",inset:0,background:`
          radial-gradient(ellipse at 70% 40%, rgba(255,107,44,0.15) 0%, transparent 60%),
          radial-gradient(ellipse at 20% 80%, rgba(255,107,44,0.1) 0%, transparent 50%),
          linear-gradient(160deg, #12283F 0%, #12283F 40%, #12283F 100%)
        `,transform:`translateY(${r*.3}px)`,animation:"zoomBg 1.5s ease both"}}),e.jsx("div",{style:{position:"absolute",top:"15%",right:"8%",width:300,height:300,borderRadius:"50%",border:"1px solid rgba(255,107,44,0.12)",animation:"float 7s ease-in-out infinite",pointerEvents:"none"}}),e.jsx("div",{style:{position:"absolute",top:"25%",right:"12%",width:200,height:200,borderRadius:"50%",border:"1px solid rgba(255,107,44,0.18)",animation:"float 5s ease-in-out infinite reverse",pointerEvents:"none"}}),e.jsx("div",{style:{position:"absolute",bottom:"20%",left:"5%",width:180,height:180,borderRadius:"50%",border:"1px solid rgba(255,107,44,0.15)",animation:"float 6s ease-in-out infinite 1s",pointerEvents:"none"}}),e.jsx("div",{style:{position:"absolute",top:"50%",left:"50%",width:600,height:600,borderRadius:"50%",border:"1px solid rgba(255,107,44,0.04)",transform:"translate(-50%,-50%)",animation:"rotateSlow 40s linear infinite",pointerEvents:"none"}}),e.jsx("div",{className:"ttc-float",style:{position:"absolute",top:"18%",right:"18%",fontSize:64,opacity:.18,pointerEvents:"none"},children:"🎾"}),e.jsx("div",{className:"ttc-float",style:{position:"absolute",bottom:"25%",left:"12%",fontSize:40,opacity:.12,pointerEvents:"none",animationDelay:"2s"},children:"🏆"}),e.jsx("div",{className:"ttc-float",style:{position:"absolute",top:"60%",right:"6%",fontSize:32,opacity:.1,pointerEvents:"none",animationDelay:"1s"},children:"⭐"}),e.jsxs("div",{style:{position:"relative",zIndex:2,textAlign:"center",padding:"0 24px",maxWidth:900,margin:"0 auto"},children:[e.jsx(d,{children:e.jsxs("div",{className:"section-badge",style:{marginBottom:24},children:[e.jsx("span",{children:"🏛️"})," Fundado em 1994 · Cuiabá, MT"]})}),e.jsxs(d,{delay:100,children:[e.jsx("h1",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(44px, 7vw, 88px)",fontWeight:900,lineHeight:1.05,color:"#fff",marginBottom:8,letterSpacing:"-.02em"},children:"Tênis & Touring"}),e.jsx("h2",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(22px, 4vw, 44px)",fontWeight:700,background:"linear-gradient(135deg, #FF9B72 30%, #FF6B2C 70%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",marginBottom:28,letterSpacing:"-.01em"},children:"O Melhor Clube do Centro-Oeste"})]}),e.jsx(d,{delay:200,children:e.jsxs("p",{style:{color:"rgba(255,255,255,0.72)",fontSize:"clamp(16px, 2.5vw, 20px)",lineHeight:1.7,maxWidth:640,margin:"0 auto 40px",fontFamily:"Inter, sans-serif",fontWeight:300},children:["Mais de 30 anos unindo famílias em torno do esporte, lazer e convivência. Casa da 4ª Agro Open de Tênis — ",e.jsx("strong",{style:{color:"#FF9B72"},children:"R$ 250.000+"})," em premiação."]})}),e.jsx(d,{delay:300,children:e.jsxs("div",{style:{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:48},children:[e.jsx("a",{href:"#seja-socio",className:"ttc-btn-primary",style:{fontSize:15,padding:"16px 36px"},children:"🏅 Torne-se Sócio"}),e.jsx("a",{href:"#eventos",className:"ttc-btn-outline",style:{fontSize:15,padding:"16px 36px"},children:"🏆 Agro Open 2026"}),e.jsx("button",{onClick:i,className:"ttc-btn-gold",style:{fontSize:15,padding:"16px 36px"},children:"🪪 Minha Carteirinha"})]})}),t!==null&&e.jsx(d,{delay:400,children:e.jsx("div",{style:{display:"flex",justifyContent:"center"},children:e.jsxs("div",{className:"visitor-widget",children:[e.jsx("span",{style:{fontSize:18},children:"👁️"}),e.jsxs("div",{style:{textAlign:"left"},children:[e.jsx("div",{style:{color:"#FF9B72",fontSize:22,fontWeight:800,lineHeight:1,fontFamily:"Inter, sans-serif",letterSpacing:"-0.02em"},children:t.toLocaleString("pt-BR")}),e.jsx("div",{style:{color:"rgba(255,255,255,0.55)",fontSize:11,fontWeight:500,letterSpacing:".06em",textTransform:"uppercase"},children:"visitantes"})]})]})})})]}),e.jsxs("div",{style:{position:"absolute",bottom:32,left:"50%",transform:"translateX(-50%)",textAlign:"center"},className:"ttc-pulse",children:[e.jsx("div",{style:{color:"rgba(255,255,255,0.4)",fontSize:12,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8,fontFamily:"Inter, sans-serif"},children:"role para baixo"}),e.jsx("div",{style:{width:24,height:40,borderRadius:12,border:"2px solid rgba(255,255,255,0.25)",margin:"0 auto",display:"flex",justifyContent:"center",paddingTop:6},children:e.jsx("div",{style:{width:4,height:4,borderRadius:"50%",background:"#FF9B72",animation:"float 1.8s ease-in-out infinite"}})})]})]})}function A(){const[t,i]=F(.2),r=b(x[0].value,1800,i),n=b(x[1].value,2200,i),o=b(x[2].value,1200,i),c=b(x[3].value,800,i),a=[r,n,o,c];return e.jsx("div",{ref:t,style:{background:"linear-gradient(90deg, #12283F, #12283F, #12283F)",borderTop:"1px solid rgba(255,107,44,0.15)",borderBottom:"1px solid rgba(255,107,44,0.15)",padding:"60px 24px"},children:e.jsx("div",{style:{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:8},children:x.map((s,p)=>e.jsxs("div",{style:{textAlign:"center",padding:"20px 16px",borderRight:p<x.length-1?"1px solid rgba(255,255,255,0.07)":"none"},children:[e.jsx("div",{style:{fontSize:36,marginBottom:8},children:s.icon}),e.jsxs("div",{className:"stat-number",children:[a[p],s.suffix]}),e.jsx("div",{style:{color:"rgba(255,255,255,0.55)",fontSize:13,fontWeight:500,letterSpacing:".06em",textTransform:"uppercase",marginTop:8,fontFamily:"Inter, sans-serif"},children:s.label})]},p))})})}function D(){const t=[{ano:"1994",titulo:"Fundação",desc:"Clube fundado com foco no tênis e lazer familiar"},{ano:"2005",titulo:"Expansão",desc:"Abertura das quadras de padel e piscina olímpica"},{ano:"2015",titulo:"Modernização",desc:"Reforma geral com academia de última geração"},{ano:"2023",titulo:"Agro Open",desc:"1ª edição do maior torneio de tênis do Centro-Oeste"},{ano:"2026",titulo:"4ª Edição",desc:"R$ 250.000+ em premiação, 250+ atletas profissionais"}];return e.jsx("section",{id:"quem-somos",style:{background:m.deep,padding:"100px 24px"},children:e.jsxs("div",{style:{maxWidth:1200,margin:"0 auto"},children:[e.jsx(d,{children:e.jsxs("div",{style:{textAlign:"center",marginBottom:72},children:[e.jsx("div",{className:"section-badge",children:"🏛️ Nossa história"}),e.jsxs("h2",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(32px, 5vw, 56px)",fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:20},children:["Tradição que une",e.jsx("br",{}),e.jsx("span",{style:{color:"#FF9B72"},children:"gerações"})]}),e.jsx("div",{className:"divider-gold"})]})}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(340px, 1fr))",gap:60,alignItems:"start"},children:[e.jsx(d,{children:e.jsxs("div",{children:[e.jsxs("p",{style:{color:"rgba(255,255,255,0.75)",fontSize:17,lineHeight:1.85,fontFamily:"Inter, sans-serif",fontWeight:300,marginBottom:24},children:["O ",e.jsx("strong",{style:{color:"#FF9B72"},children:"Tênis & Touring Clube"})," é o maior e mais completo clube esportivo do Centro-Oeste brasileiro. Fundado em 1994, é referência em tênis, natação, padel e lazer familiar para milhares de cuiabanos."]}),e.jsx("p",{style:{color:"rgba(255,255,255,0.65)",fontSize:16,lineHeight:1.85,fontFamily:"Inter, sans-serif",fontWeight:300,marginBottom:36},children:"Nossa missão é oferecer o melhor ambiente para o desenvolvimento esportivo e o convívio saudável entre famílias, com estrutura de alto padrão e eventos de nível nacional."}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:36},children:[{icon:"🏆",text:"Maior torneio de tênis do Centro-Oeste"},{icon:"👨‍👩‍👧‍👦",text:"Espaço para toda a família"},{icon:"⭐",text:"Instrutores certificados"},{icon:"🌱",text:"Foco no desenvolvimento humano"}].map((i,r)=>e.jsxs("div",{style:{display:"flex",gap:12,alignItems:"flex-start",padding:16,background:"rgba(255,255,255,0.04)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)"},children:[e.jsx("span",{style:{fontSize:22,lineHeight:1},children:i.icon}),e.jsx("span",{style:{color:"rgba(255,255,255,0.7)",fontSize:13,lineHeight:1.5,fontFamily:"Inter, sans-serif"},children:i.text})]},r))}),e.jsx("a",{href:"#seja-socio",className:"ttc-btn-primary",children:"Associe-se agora →"})]})}),e.jsx(d,{delay:150,children:e.jsxs("div",{style:{position:"relative",paddingLeft:28},children:[e.jsx("div",{style:{position:"absolute",left:10,top:0,bottom:0,width:2,background:"linear-gradient(180deg, #FF9B72, #FF6B2C, rgba(255,255,255,0.1))"}}),t.map((i,r)=>e.jsxs("div",{style:{position:"relative",paddingBottom:r<t.length-1?36:0,paddingLeft:24},children:[e.jsx("div",{style:{position:"absolute",left:-22,top:4,width:14,height:14,borderRadius:"50%",background:r===t.length-1?"#FF6B2C":"#FF9B72",border:"2px solid #12283F",boxShadow:`0 0 10px ${r===t.length-1?"#FF6B2C":"#FF9B72"}`}}),e.jsx("div",{style:{fontSize:12,color:"#FF9B72",fontWeight:700,letterSpacing:".1em",fontFamily:"Inter, sans-serif",marginBottom:4},children:i.ano}),e.jsx("div",{style:{color:"#fff",fontWeight:700,fontSize:16,fontFamily:"Inter, sans-serif",marginBottom:4},children:i.titulo}),e.jsx("div",{style:{color:"rgba(255,255,255,0.55)",fontSize:14,fontFamily:"Inter, sans-serif",lineHeight:1.5},children:i.desc})]},r))]})})]})]})})}function R(){const[t,i]=l.useState(0),r=j[t];return e.jsx("section",{id:"estrutura",style:{background:"linear-gradient(160deg, #12283F, #12283F)",padding:"100px 24px"},children:e.jsxs("div",{style:{maxWidth:1200,margin:"0 auto"},children:[e.jsx(d,{children:e.jsxs("div",{style:{textAlign:"center",marginBottom:56},children:[e.jsx("div",{className:"section-badge",children:"🏗️ Infraestrutura"}),e.jsxs("h2",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(30px, 5vw, 52px)",fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:20},children:["Estrutura de ",e.jsx("span",{style:{color:"#FF9B72"},children:"alto padrão"})]}),e.jsx("div",{className:"divider-gold"}),e.jsx("p",{style:{color:"rgba(255,255,255,0.55)",fontSize:16,fontFamily:"Inter, sans-serif",marginTop:20},children:"6 modalidades, infraestrutura completa para toda a família"})]})}),e.jsx(d,{delay:100,children:e.jsx("div",{style:{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:48},children:j.map((n,o)=>e.jsxs("button",{className:`estrutura-tab${t===o?" active":""}`,onClick:()=>i(o),children:[n.icon," ",n.nome]},o))})}),e.jsx(d,{children:e.jsx("div",{style:{background:"rgba(255,255,255,0.04)",border:`1px solid ${r.cor}33`,borderRadius:28,padding:"clamp(28px, 4vw, 52px)",transition:"all .4s",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"},children:e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:40,alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:80,marginBottom:20,filter:"drop-shadow(0 8px 20px rgba(0,0,0,0.3))"},children:r.icon}),e.jsx("h3",{style:{fontFamily:"'Playfair Display', serif",fontSize:36,fontWeight:900,color:"#fff",marginBottom:16},children:r.nome}),e.jsx("p",{style:{color:"rgba(255,255,255,0.65)",fontSize:16,lineHeight:1.75,fontFamily:"Inter, sans-serif",marginBottom:28},children:r.desc}),e.jsx("a",{href:"#seja-socio",className:"ttc-btn-primary",style:{background:`linear-gradient(135deg, ${r.cor}, ${r.cor}cc)`},children:"Conhecer →"})]}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},children:r.itens.map((n,o)=>e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"14px 18px",background:"rgba(255,255,255,0.05)",borderRadius:14,border:`1px solid ${r.cor}22`},children:[e.jsx("div",{style:{width:8,height:8,borderRadius:"50%",background:r.cor,flexShrink:0,boxShadow:`0 0 8px ${r.cor}`}}),e.jsx("span",{style:{color:"rgba(255,255,255,0.8)",fontSize:14,fontFamily:"Inter, sans-serif",fontWeight:500},children:n})]},o))})]})})})]})})}function N(){return e.jsx("section",{id:"eventos",style:{background:m.deep,padding:"100px 24px"},children:e.jsxs("div",{style:{maxWidth:1200,margin:"0 auto"},children:[e.jsx(d,{children:e.jsxs("div",{style:{textAlign:"center",marginBottom:72},children:[e.jsx("div",{className:"section-badge",children:"📅 Agenda"}),e.jsxs("h2",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(30px, 5vw, 52px)",fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:20},children:["Eventos ",e.jsx("span",{style:{color:"#FF9B72"},children:"imperdíveis"})]}),e.jsx("div",{className:"divider-gold"})]})}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:24},children:B.map((t,i)=>e.jsx(d,{delay:i*80,children:e.jsxs("div",{style:{background:t.destaque?"linear-gradient(135deg, #12283F, #12283F)":"rgba(255,255,255,0.04)",border:t.destaque?"1.5px solid rgba(255,107,44,0.4)":"1px solid rgba(255,255,255,0.08)",borderRadius:24,padding:32,height:"100%",position:"relative",overflow:"hidden",transition:"all .4s",boxShadow:t.destaque?"0 20px 60px rgba(255,107,44,0.12)":"none",cursor:"default"},onMouseEnter:r=>{r.currentTarget.style.transform="translateY(-8px)",r.currentTarget.style.boxShadow="0 30px 70px rgba(0,0,0,0.4)"},onMouseLeave:r=>{r.currentTarget.style.transform="translateY(0)",r.currentTarget.style.boxShadow=t.destaque?"0 20px 60px rgba(255,107,44,0.12)":"none"},children:[t.destaque&&e.jsx("div",{style:{position:"absolute",top:18,right:18,background:"linear-gradient(135deg, #FF6B2C, #E8C87A)",color:"#12283F",fontSize:10,fontWeight:800,letterSpacing:".1em",padding:"4px 12px",borderRadius:50,textTransform:"uppercase"},children:"DESTAQUE"}),e.jsx("div",{style:{fontSize:44,marginBottom:16},children:t.icon}),e.jsx("div",{style:{color:t.cor,fontSize:12,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10,fontFamily:"Inter, sans-serif"},children:t.data}),e.jsx("h3",{style:{fontFamily:"'Playfair Display', serif",fontSize:22,fontWeight:700,color:"#fff",marginBottom:14,lineHeight:1.3},children:t.titulo}),e.jsx("p",{style:{color:"rgba(255,255,255,0.62)",fontSize:14,lineHeight:1.7,fontFamily:"Inter, sans-serif",marginBottom:20},children:t.desc}),e.jsx("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:t.tags.map((r,n)=>e.jsx("span",{style:{background:`${t.cor}1A`,border:`1px solid ${t.cor}40`,color:t.cor,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:50,letterSpacing:".06em"},children:r},n))})]})},i))})]})})}function P(){const[t,i]=l.useState("Todos"),[r,n]=l.useState(null),o=T.slice(0,9);return e.jsx("section",{id:"galeria",style:{background:"linear-gradient(160deg, #12283F, #12283F)",padding:"100px 24px"},children:e.jsxs("div",{style:{maxWidth:1200,margin:"0 auto"},children:[e.jsx(d,{children:e.jsxs("div",{style:{textAlign:"center",marginBottom:56},children:[e.jsx("div",{className:"section-badge",children:"📸 Galeria"}),e.jsxs("h2",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(30px, 5vw, 52px)",fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:20},children:["Momentos ",e.jsx("span",{style:{color:"#FF9B72"},children:"inesquecíveis"})]}),e.jsx("div",{className:"divider-gold"})]})}),e.jsx(d,{delay:100,children:e.jsx("div",{style:{display:"flex",gap:10,justifyContent:"center",marginBottom:40,flexWrap:"wrap"},children:z.map(c=>e.jsx("button",{onClick:()=>i(c),className:`estrutura-tab${t===c?" active":""}`,children:c},c))})}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:16},children:o.map((c,a)=>e.jsx(d,{delay:a*50,children:e.jsxs("div",{className:"gallery-item",onClick:()=>n(c),style:{height:a%3===1?280:220,position:"relative"},children:[e.jsx("img",{src:c,alt:`Foto ${a+1}`,loading:"lazy",onError:s=>{s.target.style.display="none",s.target.parentElement.style.background="rgba(255,255,255,0.05)"}}),e.jsx("div",{style:{position:"absolute",inset:0,background:"linear-gradient(0deg, rgba(7,26,14,0.7), transparent)",opacity:0,transition:"opacity .3s",borderRadius:16,display:"flex",alignItems:"flex-end",padding:16},onMouseEnter:s=>s.currentTarget.style.opacity=1,onMouseLeave:s=>s.currentTarget.style.opacity=0,children:e.jsx("span",{style:{color:"#fff",fontSize:13,fontFamily:"Inter, sans-serif",fontWeight:600},children:"Ver foto ↗"})})]})},a))}),r&&e.jsx("div",{className:"modal-overlay",onClick:()=>n(null),children:e.jsxs("div",{style:{position:"relative",maxWidth:900,width:"100%"},onClick:c=>c.stopPropagation(),children:[e.jsx("img",{src:r,alt:"Foto ampliada",style:{width:"100%",borderRadius:20,maxHeight:"80vh",objectFit:"contain"}}),e.jsx("button",{onClick:()=>n(null),style:{position:"absolute",top:-16,right:-16,width:40,height:40,borderRadius:"50%",background:"#FF9B72",border:"none",cursor:"pointer",fontSize:18,color:"#12283F",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"},children:"✕"})]})})]})})}function M(){const[t,i]=l.useState(null),[r,n]=l.useState(!1),[o,c]=l.useState(""),[a,s]=l.useState(!1),p=l.useRef(null),g=typeof window<"u"&&(localStorage.getItem("sp_token")||localStorage.getItem("sp_site_token"))||"",S=l.useCallback(async()=>{if(!g){c("Faça login para acessar sua carteirinha digital.");return}n(!0),c("");try{const f=await fetch("/api/auth/carteirinha",{headers:{Authorization:`Bearer ${g}`}}),v=await f.json();if(!f.ok)throw new Error(v.error||"Erro ao buscar carteirinha");i(v),s(!0)}catch(f){c(f.message||"Erro ao buscar carteirinha")}finally{n(!1)}},[g]),k=()=>{if(!p.current)return;const f=window.open("","_blank");f.document.write(`
      <html><head><title>Carteirinha TTC</title>
      <style>
        body { margin: 0; background: #12283F; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: Inter, sans-serif; }
        @media print { body { background: #12283F !important; } }
      </style>
      </head><body>${p.current.outerHTML}</body></html>
    `),f.document.close(),setTimeout(()=>{f.print()},500)},u={ativo:"#FF9B72",inadimplente:"#EF5350",suspenso:"#FFB74D",inativo:"#9E9E9E"};return e.jsxs("section",{id:"carteirinha",style:{background:m.deep,padding:"100px 24px"},children:[e.jsxs("div",{style:{maxWidth:900,margin:"0 auto"},children:[e.jsx(d,{children:e.jsxs("div",{style:{textAlign:"center",marginBottom:60},children:[e.jsx("div",{className:"section-badge",children:"🪪 Sócios"}),e.jsxs("h2",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(30px, 5vw, 52px)",fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:20},children:["Carteirinha ",e.jsx("span",{style:{color:"#FF9B72"},children:"Digital"})]}),e.jsx("div",{className:"divider-gold"}),e.jsx("p",{style:{color:"rgba(255,255,255,0.55)",fontSize:16,fontFamily:"Inter, sans-serif",marginTop:20,maxWidth:520,margin:"20px auto 0"},children:"Acesse sua carteirinha digital com QR Code para identificação no clube, torneios e eventos."})]})}),e.jsx(d,{delay:100,children:e.jsxs("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:24},children:[e.jsx("div",{style:{perspective:1e3,width:"100%",maxWidth:420},children:e.jsxs("div",{style:{background:"linear-gradient(135deg, #12283F 0%, #12283F 50%, #12283F 100%)",border:"1.5px solid rgba(255,107,44,0.3)",borderRadius:24,padding:32,position:"relative",overflow:"hidden",boxShadow:"0 30px 80px rgba(0,0,0,0.6), 0 0 30px rgba(255,107,44,0.1)",animation:"glowPulse 4s ease-in-out infinite"},children:[e.jsx("div",{style:{position:"absolute",inset:0,background:"radial-gradient(circle at 80% 20%, rgba(255,107,44,0.08), transparent 50%)",pointerEvents:"none"}}),e.jsx("div",{style:{position:"absolute",bottom:-30,left:-30,width:180,height:180,borderRadius:"50%",border:"1px solid rgba(255,107,44,0.1)",pointerEvents:"none"}}),e.jsxs("div",{style:{position:"relative",zIndex:2},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:11,color:"#FF9B72",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",fontFamily:"Inter, sans-serif"},children:"Tênis & Touring Clube"}),e.jsx("div",{style:{fontSize:22,color:"#fff",fontFamily:"'Playfair Display', serif",fontWeight:700,marginTop:4},children:"Carteirinha Sócio"})]}),e.jsx("div",{style:{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg, #FF9B72, #2D6F9E)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#12283F",fontFamily:"Inter, sans-serif",flexShrink:0},children:"TTC"})]}),e.jsxs("div",{style:{display:"flex",gap:20,alignItems:"center"},children:[e.jsx("div",{style:{width:88,height:88,background:"rgba(255,255,255,0.07)",borderRadius:12,border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},children:e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("div",{style:{fontSize:28},children:"▣"}),e.jsx("div",{style:{fontSize:9,color:"rgba(255,255,255,0.4)",fontFamily:"Inter, sans-serif",marginTop:4},children:"QR CODE"})]})}),e.jsxs("div",{style:{flex:1},children:[e.jsx("div",{style:{fontSize:13,color:"rgba(255,255,255,0.45)",fontFamily:"Inter, sans-serif",marginBottom:4},children:"Nome do sócio"}),e.jsx("div",{style:{fontSize:18,color:"#fff",fontFamily:"Inter, sans-serif",fontWeight:700,marginBottom:8},children:"João da Silva"}),e.jsx("div",{style:{fontSize:12,color:"#FF6B2C",fontFamily:"Inter, sans-serif",fontWeight:600,marginBottom:6},children:"Plano Familiar"}),e.jsxs("div",{style:{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,107,44,0.12)",border:"1px solid rgba(255,107,44,0.3)",borderRadius:50,padding:"3px 12px"},children:[e.jsx("div",{style:{width:7,height:7,borderRadius:"50%",background:"#FF9B72",animation:"pulse 2s infinite"}}),e.jsx("span",{style:{fontSize:11,color:"#FF9B72",fontFamily:"Inter, sans-serif",fontWeight:600},children:"ATIVO"})]})]})]}),e.jsxs("div",{style:{marginTop:24,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[e.jsx("div",{style:{fontSize:11,color:"rgba(255,255,255,0.35)",fontFamily:"Inter, sans-serif"},children:"Desde 2020 · #TTC0001"}),e.jsx("div",{style:{fontSize:18},children:"🎾"})]})]})]})}),e.jsxs("div",{style:{textAlign:"center"},children:[g?e.jsx("button",{onClick:S,disabled:r,className:"ttc-btn-primary",style:{fontSize:16,padding:"16px 40px"},children:r?"⏳ Carregando...":"🪪 Ver Minha Carteirinha"}):e.jsxs("div",{style:{marginBottom:20},children:[e.jsx("p",{style:{color:"rgba(255,255,255,0.6)",fontSize:15,fontFamily:"Inter, sans-serif",marginBottom:16},children:"Faça login para acessar sua carteirinha digital"}),e.jsx(h,{to:"/login",className:"ttc-btn-primary",children:"🔐 Fazer Login"})]}),o&&e.jsxs("div",{style:{marginTop:16,padding:"12px 24px",background:"rgba(239,83,80,0.12)",border:"1px solid rgba(239,83,80,0.3)",borderRadius:12,color:"#EF5350",fontSize:14,fontFamily:"Inter, sans-serif"},children:["⚠️ ",o]})]})]})})]}),a&&t&&e.jsx("div",{className:"modal-overlay",onClick:()=>s(!1),children:e.jsxs("div",{style:{maxWidth:520,width:"100%",padding:20},onClick:f=>f.stopPropagation(),children:[e.jsx("div",{ref:p,children:t.socio?e.jsx("div",{className:"carteirinha-card",children:e.jsxs("div",{style:{position:"relative",zIndex:2},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:11,color:"#FF9B72",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",fontFamily:"Inter, sans-serif"},children:"Tênis & Touring Clube"}),e.jsx("div",{style:{fontSize:24,color:"#fff",fontFamily:"'Playfair Display', serif",fontWeight:700,marginTop:4},children:"Carteirinha Oficial"})]}),e.jsx("div",{style:{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg, #FF9B72, #2D6F9E)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#12283F",fontFamily:"Inter, sans-serif",flexShrink:0},children:"TTC"})]}),e.jsxs("div",{style:{display:"flex",gap:24,alignItems:"center",marginBottom:24},children:[e.jsxs("div",{className:"qr-container",style:{position:"relative",flexShrink:0},children:[e.jsx("div",{className:"qr-scan-line"}),e.jsx("div",{dangerouslySetInnerHTML:{__html:t.qrSvg},style:{width:100,height:100,display:"block"}})]}),e.jsxs("div",{style:{flex:1},children:[e.jsx("div",{style:{fontSize:12,color:"rgba(255,255,255,0.45)",fontFamily:"Inter, sans-serif",marginBottom:2},children:"Sócio"}),e.jsx("div",{style:{fontSize:20,color:"#fff",fontFamily:"Inter, sans-serif",fontWeight:800,marginBottom:8,lineHeight:1.2},children:t.nome}),e.jsx("div",{style:{fontSize:13,color:"#FF6B2C",fontFamily:"Inter, sans-serif",fontWeight:600,marginBottom:10},children:t.plano}),e.jsxs("div",{style:{display:"inline-flex",alignItems:"center",gap:7,background:`${u[t.status]||"#FF9B72"}15`,border:`1px solid ${u[t.status]||"#FF9B72"}40`,borderRadius:50,padding:"4px 14px"},children:[e.jsx("div",{style:{width:7,height:7,borderRadius:"50%",background:u[t.status]||"#FF9B72",animation:"pulse 2s infinite"}}),e.jsx("span",{style:{fontSize:11,color:u[t.status]||"#FF9B72",fontFamily:"Inter, sans-serif",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"},children:t.status})]})]})]}),e.jsxs("div",{style:{paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:10,color:"rgba(255,255,255,0.35)",fontFamily:"Inter, sans-serif",letterSpacing:".04em",marginBottom:2},children:"CÓDIGO DO SÓCIO"}),e.jsx("div",{style:{fontSize:14,color:"rgba(255,255,255,0.7)",fontFamily:"monospace",fontWeight:700,letterSpacing:".1em"},children:t.cardCode})]}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:10,color:"rgba(255,255,255,0.35)",fontFamily:"Inter, sans-serif",letterSpacing:".04em",marginBottom:2},children:"MEMBRO DESDE"}),e.jsx("div",{style:{fontSize:13,color:"rgba(255,255,255,0.7)",fontFamily:"Inter, sans-serif",fontWeight:600},children:t.desde?new Date(t.desde).toLocaleDateString("pt-BR",{month:"short",year:"numeric"}):"—"})]}),e.jsx("div",{style:{fontSize:24},children:"🎾"})]})]})}):e.jsxs("div",{style:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:40,textAlign:"center"},children:[e.jsx("div",{style:{fontSize:56,marginBottom:20},children:"😕"}),e.jsx("h3",{style:{color:"#fff",fontFamily:"'Playfair Display', serif",fontSize:24,marginBottom:12},children:"Você ainda não é sócio"}),e.jsx("p",{style:{color:"rgba(255,255,255,0.55)",fontFamily:"Inter, sans-serif",fontSize:15,lineHeight:1.6,marginBottom:28},children:t.message}),e.jsx("a",{href:"#seja-socio",className:"ttc-btn-primary",onClick:()=>s(!1),children:"Quero ser sócio →"})]})}),e.jsxs("div",{style:{display:"flex",gap:12,marginTop:20,justifyContent:"center",flexWrap:"wrap"},children:[t.socio&&e.jsx("button",{onClick:k,className:"ttc-btn-primary",style:{fontSize:14,padding:"12px 28px"},children:"🖨️ Imprimir / Salvar PDF"}),e.jsx("button",{onClick:()=>s(!1),className:"ttc-btn-outline",style:{fontSize:14,padding:"12px 28px"},children:"Fechar"})]})]})})]})}function $(){return e.jsxs("section",{id:"seja-socio",style:{background:`linear-gradient(160deg, ${m.forest} 0%, ${m.deep} 100%)`,padding:"100px 24px",position:"relative",overflow:"hidden"},children:[e.jsx("div",{style:{position:"absolute",top:-100,right:-100,width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,107,44,0.06), transparent 70%)",pointerEvents:"none"}}),e.jsx("div",{style:{position:"absolute",bottom:-60,left:-60,width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,107,44,0.06), transparent 70%)",pointerEvents:"none"}}),e.jsxs("div",{style:{maxWidth:1200,margin:"0 auto",position:"relative",zIndex:2},children:[e.jsx(d,{children:e.jsxs("div",{style:{textAlign:"center",marginBottom:72},children:[e.jsx("div",{className:"section-badge",children:"🏅 Associação"}),e.jsxs("h2",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(32px, 5vw, 56px)",fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:20},children:["Faça parte do ",e.jsx("span",{style:{color:"#FF9B72"},children:"melhor clube"}),e.jsx("br",{}),"do Centro-Oeste"]}),e.jsx("div",{className:"divider-gold"}),e.jsx("p",{style:{color:"rgba(255,255,255,0.55)",fontSize:16,fontFamily:"Inter, sans-serif",marginTop:24,maxWidth:540,margin:"24px auto 0"},children:"Escolha o plano ideal para você e sua família"})]})}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:24,alignItems:"stretch"},children:C.map((t,i)=>e.jsx(d,{delay:i*100,children:e.jsxs("div",{className:`plano-card${t.destaque?" destaque":""}`,style:{background:t.cor,border:t.border||(t.destaque?"1.5px solid rgba(255,107,44,0.4)":"1px solid rgba(255,255,255,0.08)"),height:"100%"},children:[t.badge&&e.jsx("div",{style:{background:"linear-gradient(135deg, #FF9B72, #2D6F9E)",color:"#12283F",fontSize:11,fontWeight:800,letterSpacing:".08em",padding:"5px 16px",borderRadius:50,display:"inline-block",marginBottom:20,textTransform:"uppercase"},children:t.badge}),t.vip&&e.jsx("div",{style:{background:"linear-gradient(135deg, #FF6B2C, #E8C87A)",color:"#12283F",fontSize:11,fontWeight:800,letterSpacing:".08em",padding:"5px 16px",borderRadius:50,display:"inline-block",marginBottom:20,textTransform:"uppercase"},children:"👑 VIP Premium"}),e.jsx("div",{style:{fontFamily:"'Playfair Display', serif",fontSize:26,fontWeight:900,color:t.vip?"#FF6B2C":"#fff",marginBottom:8},children:t.nome}),e.jsxs("div",{style:{display:"flex",alignItems:"flex-end",gap:4,marginBottom:28},children:[e.jsx("span",{style:{fontFamily:"Inter, sans-serif",fontSize:42,fontWeight:900,color:t.vip?"#E8C87A":t.destaque?"#FF9B72":"#fff",lineHeight:1},children:t.preco}),e.jsx("span",{style:{color:"rgba(255,255,255,0.45)",fontSize:14,fontFamily:"Inter, sans-serif",marginBottom:6},children:t.periodo})]}),e.jsx("div",{style:{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:20,marginBottom:28},children:t.itens.map((r,n)=>e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"},children:[e.jsx("span",{style:{color:t.vip?"#FF6B2C":"#FF9B72",fontSize:14,flexShrink:0},children:"✓"}),e.jsx("span",{style:{color:"rgba(255,255,255,0.75)",fontSize:14,fontFamily:"Inter, sans-serif"},children:r})]},n))}),e.jsx("a",{href:`https://wa.me/5565999999999?text=Ol%C3%A1!%20Quero%20ser%20s%C3%B3cio%20do%20TTC%20-%20Plano%20${encodeURIComponent(t.nome)}`,target:"_blank",rel:"noopener noreferrer",className:t.vip?"ttc-btn-gold":"ttc-btn-primary",style:{width:"100%",justifyContent:"center",...t.vip?{}:t.destaque?{}:{background:"rgba(255,255,255,0.1)",color:"#fff",boxShadow:"none"}},children:t.vip?"👑 Assinar VIP":t.destaque?"⭐ Escolher Familiar":"Escolher Plano"})]})},i))}),e.jsx(d,{delay:300,children:e.jsxs("div",{style:{textAlign:"center",marginTop:48,padding:"28px",background:"rgba(255,107,44,0.06)",borderRadius:20,border:"1px solid rgba(255,107,44,0.15)",maxWidth:600,margin:"48px auto 0"},children:[e.jsx("p",{style:{color:"rgba(255,255,255,0.7)",fontSize:15,fontFamily:"Inter, sans-serif",lineHeight:1.7},children:"💬 Dúvidas? Fale com nossa equipe de associação via WhatsApp e encontre o plano perfeito para você."}),e.jsx("a",{href:"https://wa.me/5565999999999",target:"_blank",rel:"noopener noreferrer",className:"ttc-btn-primary",style:{marginTop:20,fontSize:15,padding:"14px 32px"},children:"📱 Falar no WhatsApp"})]})})]})]})}function q(){const t=[{icon:"📱",label:"WhatsApp",valor:"(65) 9 9999-9999",href:"https://wa.me/5565999999999",cor:"#2D6F9E"},{icon:"📞",label:"Secretaria",valor:"(65) 3333-3333",href:"tel:+556533333333",cor:"#4FC3F7"},{icon:"📧",label:"E-mail",valor:"contato@ttcuiaba.com.br",href:"mailto:contato@ttcuiaba.com.br",cor:"#FF9B72"},{icon:"📸",label:"Instagram",valor:"@ttcuiaba",href:"https://instagram.com/ttcuiaba",cor:"#E1306C"}];return e.jsx("section",{id:"contato",style:{background:m.deep,padding:"100px 24px 60px"},children:e.jsxs("div",{style:{maxWidth:1200,margin:"0 auto"},children:[e.jsx(d,{children:e.jsxs("div",{style:{textAlign:"center",marginBottom:72},children:[e.jsx("div",{className:"section-badge",children:"📍 Localização"}),e.jsxs("h2",{style:{fontFamily:"'Playfair Display', serif",fontSize:"clamp(30px, 5vw, 52px)",fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:20},children:["Venha nos ",e.jsx("span",{style:{color:"#FF9B72"},children:"visitar"})]}),e.jsx("div",{className:"divider-gold"})]})}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))",gap:48},children:[e.jsx(d,{children:e.jsxs("div",{children:[e.jsx("h3",{style:{fontFamily:"'Playfair Display', serif",fontSize:24,color:"#fff",marginBottom:28,fontWeight:700},children:"Fale conosco"}),e.jsx("div",{style:{display:"flex",flexDirection:"column",gap:14},children:t.map((i,r)=>e.jsxs("a",{href:i.href,target:"_blank",rel:"noopener noreferrer",style:{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",background:"rgba(255,255,255,0.04)",border:`1px solid ${i.cor}22`,borderRadius:16,textDecoration:"none",transition:"all .3s"},onMouseEnter:n=>{n.currentTarget.style.background=`${i.cor}12`,n.currentTarget.style.borderColor=`${i.cor}44`},onMouseLeave:n=>{n.currentTarget.style.background="rgba(255,255,255,0.04)",n.currentTarget.style.borderColor=`${i.cor}22`},children:[e.jsx("div",{style:{width:44,height:44,borderRadius:12,background:`${i.cor}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0},children:i.icon}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:11,color:i.cor,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",fontFamily:"Inter, sans-serif",marginBottom:2},children:i.label}),e.jsx("div",{style:{fontSize:15,color:"rgba(255,255,255,0.85)",fontFamily:"Inter, sans-serif",fontWeight:500},children:i.valor})]})]},r))}),e.jsxs("div",{style:{marginTop:32,padding:20,background:"rgba(255,255,255,0.03)",borderRadius:16,border:"1px solid rgba(255,255,255,0.07)"},children:[e.jsx("div",{style:{fontSize:12,color:"#FF9B72",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",fontFamily:"Inter, sans-serif",marginBottom:8},children:"📍 Endereço"}),e.jsxs("div",{style:{color:"rgba(255,255,255,0.75)",fontSize:15,fontFamily:"Inter, sans-serif",lineHeight:1.6},children:["Av. Miguel Sutil, 8.000",e.jsx("br",{}),"Jardim das Américas, Cuiabá - MT",e.jsx("br",{}),"CEP: 78070-000"]}),e.jsx("div",{style:{marginTop:12,fontSize:12,color:"rgba(255,255,255,0.4)",fontFamily:"Inter, sans-serif"},children:"🕐 Seg–Sex: 6h–22h · Sáb: 7h–20h · Dom: 8h–18h"})]})]})}),e.jsx(d,{delay:150,children:e.jsx("div",{style:{borderRadius:20,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)",height:420,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"},children:e.jsx("iframe",{src:"https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3843.6!2d-56.0!3d-15.6!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sCuiab%C3%A1%2C%20MT!5e0!3m2!1spt-BR!2sbr!4v1234567890",width:"100%",height:"100%",style:{border:0,display:"block",filter:"invert(90%) hue-rotate(170deg)"},allowFullScreen:!0,loading:"lazy",referrerPolicy:"no-referrer-when-downgrade",title:"Localização TTC"})})})]}),e.jsx(d,{delay:200,children:e.jsxs("div",{style:{marginTop:80,paddingTop:40,borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",gap:20},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontFamily:"'Playfair Display', serif",color:"#fff",fontSize:20,fontWeight:700,marginBottom:4},children:"Tênis & Touring Clube"}),e.jsx("div",{style:{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"Inter, sans-serif"},children:"© 2026 · Cuiabá, MT · Todos os direitos reservados"})]}),e.jsxs("div",{style:{display:"flex",gap:16},children:[e.jsx(h,{to:"/",style:{color:"rgba(255,255,255,0.5)",fontSize:13,fontFamily:"Inter, sans-serif",textDecoration:"none",transition:"color .2s"},onMouseEnter:i=>i.target.style.color="#FF9B72",onMouseLeave:i=>i.target.style.color="rgba(255,255,255,0.5)",children:"Home"}),e.jsx(h,{to:"/inscricoes",style:{color:"rgba(255,255,255,0.5)",fontSize:13,fontFamily:"Inter, sans-serif",textDecoration:"none",transition:"color .2s"},onMouseEnter:i=>i.target.style.color="#FF9B72",onMouseLeave:i=>i.target.style.color="rgba(255,255,255,0.5)",children:"Inscrições"}),e.jsx(h,{to:"/login",style:{color:"rgba(255,255,255,0.5)",fontSize:13,fontFamily:"Inter, sans-serif",textDecoration:"none",transition:"color .2s"},onMouseEnter:i=>i.target.style.color="#FF9B72",onMouseLeave:i=>i.target.style.color="rgba(255,255,255,0.5)",children:"Login"})]})]})})]})})}function L(){const[t,i]=l.useState(""),[r,n]=l.useState(null);l.useEffect(()=>{const a=document.createElement("style");return a.id="ttc-clube-css",a.textContent=w,document.head.appendChild(a),()=>{const s=document.getElementById("ttc-clube-css");s&&s.remove()}},[]),l.useEffect(()=>{fetch("/api/visitantes/ping",{method:"POST"}).then(a=>a.json()).then(a=>n(a.total)).catch(()=>{fetch("/api/visitantes").then(a=>a.json()).then(a=>n(a.total)).catch(()=>{})})},[]),l.useEffect(()=>{const a=y.map(p=>p.id),s=new IntersectionObserver(p=>{p.forEach(g=>{g.isIntersecting&&i(g.target.id)})},{threshold:.3,rootMargin:"-80px 0px -40% 0px"});return a.forEach(p=>{const g=document.getElementById(p);g&&s.observe(g)}),()=>s.disconnect()},[]);const o=l.useCallback(a=>{const s=document.getElementById(a);s&&s.scrollIntoView({behavior:"smooth",block:"start"})},[]),c=l.useCallback(()=>{o("carteirinha")},[o]);return e.jsxs("div",{style:{background:m.deep,minHeight:"100vh",fontFamily:"Inter, sans-serif",color:"#fff"},children:[e.jsx(E,{activeSection:t,onNav:o}),e.jsx(W,{visitantes:r,onNavCarteirinha:c}),e.jsx(I,{}),e.jsx(A,{}),e.jsx(D,{}),e.jsx(R,{}),e.jsx(N,{}),e.jsx(P,{}),e.jsx(M,{}),e.jsx($,{}),e.jsx(q,{})]})}export{L as default};
