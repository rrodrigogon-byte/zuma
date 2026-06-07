const pptx = require("pptxgenjs");
const p = new pptx();
p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
p.author = "Agro Open / UISA";
p.title = "Agro Open de Tênis 2026 — Apresentação a Fornecedores e Patrocinadores";

const C = {
  deep:"0E2E1C", deep2:"0B2415", green:"5FB335", lime:"7FCB3B", lime2:"A8E25A",
  cream:"F3F5EE", gold:"C7A24C", goldL:"E7CE8A", muted:"9DBE86", panel:"123A23",
  ink:"0E2E1C", inkSoft:"3D4A36", cardLight:"FFFFFF", lineLight:"D6DDCB"
};
const HEAD="Arial Black", BODY="Arial";
const A = "../identidade/";
const W=13.3, H=7.5;

function footer(s, n, dark=true){
  const col = dark? C.muted : "6B7861";
  s.addText("AGRO OPEN · 4ª EDIÇÃO · 07–13 SET 2026 · TANGARÁ DA SERRA/MT",
    {x:0.6,y:7.04,w:9.5,h:0.3,fontFace:BODY,fontSize:8,color:col,charSpacing:1,align:"left"});
  s.addText(`${n} / 15`,{x:11.8,y:7.04,w:0.9,h:0.3,fontFace:BODY,fontSize:8,color:col,align:"right"});
}
function logoMark(s,dark=true){
  s.addImage({path:A+"ball.png",x:0.6,y:0.42,w:0.42,h:0.42});
  s.addText([{text:"AGRO ",options:{color:dark?C.cream:C.ink}},{text:"OPEN",options:{color:C.green}}],
    {x:1.08,y:0.4,w:3,h:0.45,fontFace:HEAD,fontSize:15,bold:true,valign:"middle",charSpacing:1});
}
function kicker(s,txt,x,y,col){ s.addText(txt,{x,y,w:8,h:0.3,fontFace:BODY,fontSize:12,bold:true,color:col||C.lime,charSpacing:4}); }
const shadow=()=>({type:"outer",color:"000000",blur:7,offset:3,angle:135,opacity:0.18});

/* ---------- 1. COVER ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep2};
  s.addShape(p.shapes.RECTANGLE,{x:0,y:0,w:W,h:0.16,fill:{color:C.lime}});
  // court lines
  for(let i=1;i<5;i++) s.addShape(p.shapes.LINE,{x:0,y:i*1.45,w:W,h:0,line:{color:C.green,width:0.5,transparency:90}});
  s.addImage({path:A+"ball.png",x:9.7,y:3.7,w:3.4,h:3.4,transparency:8});
  s.addImage({path:A+"logo-ao-monograma.png",x:0.85,y:1.05,w:2.0,h:2.0});
  s.addText("4ª EDIÇÃO · 2026",{x:0.9,y:3.25,w:6,h:0.4,fontFace:BODY,fontSize:14,bold:true,color:C.lime,charSpacing:4});
  s.addText([{text:"AGRO ",options:{color:C.cream}},{text:"OPEN",options:{color:C.lime}}],
    {x:0.85,y:3.6,w:9,h:1.4,fontFace:HEAD,fontSize:80,bold:true});
  s.addText("DE TÊNIS",{x:0.92,y:4.95,w:9,h:0.6,fontFace:BODY,fontSize:26,bold:true,color:C.cream,charSpacing:12});
  s.addText("Onde o esporte encontra o agronegócio.",{x:0.92,y:5.55,w:8,h:0.4,fontFace:BODY,fontSize:16,italic:true,color:C.muted});
  s.addText("APRESENTAÇÃO A FORNECEDORES E PATROCINADORES",
    {x:0.92,y:6.25,w:9,h:0.4,fontFace:BODY,fontSize:12,bold:true,color:C.gold,charSpacing:3});
  s.addText([{text:"07–13 SET 2026   ·   ",options:{color:C.lime,bold:true}},{text:"Tangará Tênis Clube · Tangará da Serra/MT",options:{color:C.cream}}],
    {x:0.92,y:6.62,w:11,h:0.4,fontFace:BODY,fontSize:13});
}

/* ---------- 2. O EVENTO ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep};
  logoMark(s); footer(s,2);
  kicker(s,"01 · O EVENTO",0.6,1.2);
  s.addText([{text:"O maior torneio de tênis do ",options:{color:C.cream}},{text:"Centro-Oeste",options:{color:C.lime}},{text:".",options:{color:C.cream}}],
    {x:0.6,y:1.5,w:12,h:1,fontFace:HEAD,fontSize:38,bold:true});
  s.addText("Uma plataforma premium que conecta atletas de alto nível, lideranças do campo e marcas do agro em uma semana de competição, networking e impacto social — com mais de R$400 mil em premiação.",
    {x:0.6,y:2.55,w:12,h:0.9,fontFace:BODY,fontSize:15,color:C.muted,lineSpacingMultiple:1.2});
  const pil=[
    ["ESPORTE PREMIUM","Tênis é o esporte da decisão: concentra executivos, produtores e líderes — exatamente a audiência que o agro quer atingir."],
    ["REBRANDING OPEN","Nova marca no padrão dos grandes Opens internacionais (US Open, Australian Open). Identidade premium pronta para mídia."],
    ["CONEXÕES B2B","7 dias de imersão com decisores. Networking de alto calibre entre patrocinadores, produtores, cooperativas, tradings e bancos."]
  ];
  pil.forEach((c,i)=>{
    const x=0.6+i*4.05;
    s.addShape(p.shapes.ROUNDED_RECTANGLE,{x,y:3.75,w:3.75,h:2.85,fill:{color:C.panel},line:{color:C.green,width:1,transparency:60},rectRadius:0.1,shadow:shadow()});
    s.addText(`0${i+1}`,{x:x+0.3,y:3.95,w:2,h:0.6,fontFace:HEAD,fontSize:30,bold:true,color:C.lime});
    s.addText(c[0],{x:x+0.3,y:4.6,w:3.15,h:0.4,fontFace:HEAD,fontSize:15,bold:true,color:C.cream});
    s.addText(c[1],{x:x+0.3,y:5.05,w:3.2,h:1.5,fontFace:BODY,fontSize:12.5,color:C.muted,lineSpacingMultiple:1.15,valign:"top"});
  });
}

/* ---------- 3. NÚMEROS ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep2};
  logoMark(s); footer(s,3);
  kicker(s,"02 · O EVENTO EM NÚMEROS",0.6,1.2);
  s.addText("Escala que entrega retorno.",{x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:38,bold:true,color:C.cream});
  const stats=[
    ["R$400K+","PREMIAÇÃO","Maior bolsa do Centro-Oeste",true],
    ["150+","ATLETAS","Tenistas em 13 categorias",false],
    ["3.500+","PÚBLICO","Pessoas durante a semana",false],
    ["100K+","ALCANCE DIGITAL","Impressões em redes e mídia",false],
    ["20+","INSERÇÕES DE MÍDIA","Veículos regionais e nacionais",false],
    ["13","CATEGORIAS","Masculino e feminino · todos os níveis",false]
  ];
  stats.forEach((st,i)=>{
    const col=i%3, row=Math.floor(i/3);
    const x=0.6+col*4.05, y=2.55+row*2.1;
    s.addShape(p.shapes.ROUNDED_RECTANGLE,{x,y,w:3.75,h:1.9,fill:{color:st[3]?C.green:C.panel},line:{color:C.green,width:1,transparency:50},rectRadius:0.08,shadow:shadow()});
    s.addText(st[1],{x:x+0.3,y:y+0.22,w:3.2,h:0.3,fontFace:BODY,fontSize:11,bold:true,color:st[3]?C.deep2:C.lime,charSpacing:2});
    s.addText(st[0],{x:x+0.28,y:y+0.5,w:3.2,h:0.8,fontFace:HEAD,fontSize:40,bold:true,color:st[3]?C.deep2:C.lime});
    s.addText(st[2],{x:x+0.3,y:y+1.4,w:3.2,h:0.4,fontFace:BODY,fontSize:11.5,color:st[3]?C.deep2:C.muted});
  });
}

/* ---------- 4. DA COPA AO OPEN ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep};
  logoMark(s); footer(s,4);
  kicker(s,"03 · HISTÓRICO",0.6,1.2);
  s.addText([{text:"Da Copa ",options:{color:C.cream}},{text:"ao Open",options:{color:C.lime}},{text:".",options:{color:C.cream}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:38,bold:true});
  s.addText("Quatro edições de consolidação e um reposicionamento internacional.",{x:0.6,y:2.45,w:12,h:0.4,fontFace:BODY,fontSize:14,color:C.muted});
  s.addShape(p.shapes.LINE,{x:1.1,y:3.5,w:11,h:0,line:{color:C.green,width:1.5,transparency:30}});
  const tl=[
    ["2023","1ª · Copa Agro","Estreia local. Prova de conceito conectando tênis ao agro."],
    ["2024","2ª · Crescimento","Dobra de participação. Primeiros patrocinadores B2B."],
    ["2025","3ª · Consolidação","Referência regional. 120+ atletas e cobertura de mídia."],
    ["2026","4ª · AGRO OPEN","Rebranding internacional. Audiência B2B premium.",true]
  ];
  tl.forEach((t,i)=>{
    const x=0.7+i*3.0;
    if(t[3]){ s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:x-0.2,y:3.68,w:2.95,h:2.7,fill:{color:C.panel},line:{color:C.lime,width:1.3},rectRadius:0.08,shadow:shadow()}); }
    s.addShape(p.shapes.OVAL,{x:x+1.0,y:3.32,w:0.36,h:0.36,fill:{color:t[3]?C.lime:C.green}});
    s.addText(t[0],{x,y:3.82,w:2.7,h:0.6,fontFace:HEAD,fontSize:34,bold:true,color:t[3]?C.lime:C.cream});
    s.addText(t[1],{x,y:4.47,w:2.7,h:0.35,fontFace:BODY,fontSize:13,bold:true,color:C.lime});
    s.addText(t[2],{x,y:4.87,w:2.6,h:1.4,fontFace:BODY,fontSize:12,color:C.muted,valign:"top",lineSpacingMultiple:1.15});
  });
}

/* ---------- 5. SEDE & PÚBLICO ---------- */
{
  const s=p.addSlide(); s.background={color:C.cream};
  logoMark(s,false); footer(s,5,false);
  kicker(s,"04 · SEDE & PÚBLICO",0.6,1.2,C.green);
  s.addText([{text:"Tangará da Serra: o agro ",options:{color:C.ink}},{text:"joga em casa",options:{color:C.green}},{text:".",options:{color:C.ink}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:34,bold:true});
  s.addText("No coração do maior polo do agronegócio do Brasil. Mato Grosso é #1 nacional do agro — da cana-de-açúcar à soja, ao algodão, ao milho e à pecuária. Cidade próspera, classe A/B aquecida e decisores B2B em alta concentração.",
    {x:0.6,y:2.5,w:7.0,h:1.0,fontFace:BODY,fontSize:14,color:C.inkSoft,lineSpacingMultiple:1.2,valign:"top"});
  const pub=[["PRODUTORES RURAIS","Médio e grande porte"],["EXECUTIVOS DO AGRO","Diretores e C-levels"],
    ["DECISORES B2B","Assinam por máquinas e crédito"],["FAMÍLIAS PREMIUM","Consumo de alto valor"]];
  pub.forEach((c,i)=>{
    const x=0.6+(i%2)*3.45, y=3.7+Math.floor(i/2)*1.35;
    s.addShape(p.shapes.RECTANGLE,{x,y,w:3.25,h:1.15,fill:{color:C.cardLight},line:{color:C.lineLight,width:1},shadow:shadow()});
    s.addShape(p.shapes.RECTANGLE,{x,y,w:0.09,h:1.15,fill:{color:C.green}});
    s.addText(c[0],{x:x+0.28,y:y+0.22,w:2.9,h:0.4,fontFace:HEAD,fontSize:14,bold:true,color:C.ink});
    s.addText(c[1],{x:x+0.28,y:y+0.62,w:2.9,h:0.4,fontFace:BODY,fontSize:12,color:C.inkSoft});
  });
  // side panel MT
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:8.1,y:2.5,w:4.6,h:3.95,fill:{color:C.deep},rectRadius:0.1,shadow:shadow()});
  s.addText("MT",{x:8.1,y:2.9,w:4.6,h:1.6,fontFace:HEAD,fontSize:96,bold:true,color:C.lime,align:"center"});
  s.addText("ESTADO DE MATO GROSSO",{x:8.1,y:4.55,w:4.6,h:0.3,fontFace:BODY,fontSize:12,bold:true,color:C.muted,align:"center",charSpacing:2});
  s.addText("Cana-de-açúcar · Soja · Algodão · Milho · Pecuária",{x:8.1,y:4.9,w:4.6,h:0.4,fontFace:BODY,fontSize:12.5,color:C.cream,align:"center"});
  s.addText("#1 do Brasil no agronegócio",{x:8.1,y:5.55,w:4.6,h:0.5,fontFace:HEAD,fontSize:16,bold:true,color:C.lime,align:"center"});
}

/* ---------- 6. LINE-UP ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep};
  logoMark(s); footer(s,6);
  kicker(s,"05 · LINE-UP",0.6,1.2);
  s.addText([{text:"Grandes nomes ",options:{color:C.cream}},{text:"na quadra",options:{color:C.lime}},{text:".",options:{color:C.cream}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:36,bold:true});
  s.addText("PRESENÇAS CONFIRMADAS",{x:0.6,y:2.45,w:8,h:0.3,fontFace:BODY,fontSize:12,bold:true,color:C.lime,charSpacing:2});
  const conf=[
    ["João Meneses","Ouro Pan-Americano",true],
    ["Gilbert","Presença confirmada",false],
    ["Guilherme Clezar","Ex-ATP · confirmado",false],
    ["Christian Oliveira","Presença confirmada",false],
    ["Paulo Saraiva","Presença confirmada",false],
    ["Marvim","Presença confirmada",false],
    ["Kauê Noatto","Presença confirmada",false]
  ];
  conf.forEach((c,i)=>{
    const row=i<4?0:1, col=i<4?i:i-4;
    const x=0.6+col*3.05, y=2.78+row*1.55;
    s.addShape(p.shapes.ROUNDED_RECTANGLE,{x,y,w:2.8,h:1.35,fill:{color:c[2]?C.green:C.panel},line:{color:c[2]?C.lime:C.green,width:c[2]?1.6:1,transparency:c[2]?0:50},rectRadius:0.08,shadow:shadow()});
    s.addImage({path:A+"ball.png",x:x+2.12,y:y+0.12,w:0.5,h:0.5,transparency:c[2]?60:30});
    s.addText(c[0],{x:x+0.25,y:y+0.32,w:2.4,h:0.5,fontFace:HEAD,fontSize:18,bold:true,color:c[2]?C.deep2:C.cream});
    s.addText(c[1],{x:x+0.25,y:y+0.82,w:2.45,h:0.3,fontFace:BODY,fontSize:11,bold:c[2],color:c[2]?C.deep2:C.lime});
  });
  s.addText("E demais nomes do circuito nacional. Line-up sujeito a confirmação contratual de cada atleta.",
    {x:0.6,y:6.25,w:12,h:0.4,fontFace:BODY,fontSize:11,italic:true,color:C.muted});
}

/* ---------- 7. PROGRAMAÇÃO ---------- */
{
  const s=p.addSlide(); s.background={color:C.cream};
  logoMark(s,false); footer(s,7,false);
  kicker(s,"06 · PROGRAMAÇÃO",0.6,1.2,C.green);
  s.addText([{text:"7 dias de ",options:{color:C.ink}},{text:"alta performance",options:{color:C.green}},{text:".",options:{color:C.ink}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:34,bold:true});
  const days=[
    ["07","SEG","Abertura","Coquetel e apresentação aos patrocinadores",false],
    ["08","TER","Classificação","Primeira rodada · todas as categorias",false],
    ["09","QUA","Oitavas","Disputa intensiva · ativações de marca",false],
    ["10","QUI","Quartas","Eliminatórias · cobertura de mídia",false],
    ["11","SEX","Semis + Jantar VIP","Networking exclusivo",true],
    ["12","SÁB","Finais + Leilão","Decisões e leilão Florescer",true],
    ["13","DOM","Grandes Finais","Premiação · R$400 mil",true]
  ];
  const cw=1.72;
  days.forEach((d,i)=>{
    const x=0.6+i*1.72;
    s.addShape(p.shapes.ROUNDED_RECTANGLE,{x,y:2.7,w:cw-0.12,h:3.6,fill:{color:d[4]?C.green:C.cardLight},line:{color:d[4]?C.lime:C.lineLight,width:1},rectRadius:0.08,shadow:shadow()});
    s.addText(d[0],{x,y:2.9,w:cw-0.12,h:0.7,fontFace:HEAD,fontSize:32,bold:true,color:d[4]?C.deep2:C.green,align:"center"});
    s.addText(d[1],{x,y:3.6,w:cw-0.12,h:0.3,fontFace:BODY,fontSize:11,bold:true,color:d[4]?C.deep2:C.inkSoft,align:"center",charSpacing:2});
    s.addText(d[2],{x:x+0.06,y:4.1,w:cw-0.24,h:0.9,fontFace:HEAD,fontSize:11,bold:true,color:d[4]?C.deep2:C.ink,align:"center",valign:"top"});
    s.addText(d[3],{x:x+0.12,y:5.05,w:cw-0.36,h:1.1,fontFace:BODY,fontSize:10.5,color:d[4]?C.deep2:C.inkSoft,align:"center",valign:"top",lineSpacingMultiple:1.1});
  });
}

/* ---------- 8. F5 + UISA ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep2};
  logoMark(s); footer(s,8);
  kicker(s,"07 · PARALELO · MESMA SEMANA",0.6,1.2);
  s.addText([{text:"F5 — o poder do agro que ",options:{color:C.cream}},{text:"inova",options:{color:C.lime}},{text:".",options:{color:C.cream}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:34,bold:true});
  s.addText("No mesmo período, a UISA recebe o F5, um dos maiores eventos de inovação do Centro-Oeste. A UISA — uma das maiores biorrefinarias do mundo, que transforma cana-de-açúcar e biomassa em biocombustíveis, energia limpa, alimentos e fertilizantes — realiza o Agro Open e o Florescer na mesma semana.",
    {x:0.6,y:2.5,w:6.6,h:1.3,fontFace:BODY,fontSize:14,color:C.muted,lineSpacingMultiple:1.2,valign:"top"});
  const facts=[
    "2ª colocada nas 100 empresas mais inovadoras do Brasil no uso de TI (IT Fórum) — à frente de Bradesco, Dasa e Microsoft",
    "Pioneira no Brasil em Blockchain na produção de alimentos, com Google Cloud e IT Lean",
    "Listada no Prêmio Valor Inovação Brasil · referência em automação no agro"
  ];
  s.addText(facts.map((f,i)=>({text:f,options:{bullet:{code:"2022",indent:18},color:C.cream,breakLine:true,paraSpaceAfter:9}})),
    {x:0.6,y:3.95,w:6.7,h:2.2,fontFace:BODY,fontSize:12.5});
  // right panel
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:7.6,y:2.45,w:5.1,h:4.0,fill:{color:C.panel},line:{color:C.green,width:1,transparency:50},rectRadius:0.1,shadow:shadow()});
  s.addText("REALIZAÇÃO CONJUNTA",{x:7.9,y:2.7,w:4.5,h:0.3,fontFace:BODY,fontSize:12,bold:true,color:C.lime,charSpacing:2});
  s.addText([{text:"Tangará Tênis Clube ",options:{color:C.cream}},{text:"+ UISA",options:{color:C.lime}}],
    {x:7.9,y:3.0,w:4.5,h:0.6,fontFace:HEAD,fontSize:20,bold:true});
  s.addShape(p.shapes.RECTANGLE,{x:7.9,y:3.85,w:2.1,h:1.3,fill:{color:C.deep2},line:{color:C.green,width:1,transparency:60}});
  s.addText("#2",{x:7.9,y:3.95,w:2.1,h:0.7,fontFace:HEAD,fontSize:40,bold:true,color:C.lime,align:"center"});
  s.addText("100 mais inovadoras · IT Fórum",{x:7.95,y:4.62,w:2.0,h:0.5,fontFace:BODY,fontSize:10.5,color:C.muted,align:"center"});
  s.addShape(p.shapes.RECTANGLE,{x:10.2,y:3.85,w:2.2,h:1.3,fill:{color:C.deep2},line:{color:C.green,width:1,transparency:60}});
  s.addText("1ª",{x:10.2,y:3.95,w:2.2,h:0.7,fontFace:HEAD,fontSize:38,bold:true,color:C.cream,align:"center"});
  s.addText("Blockchain em alimentos no Brasil",{x:10.25,y:4.62,w:2.1,h:0.5,fontFace:BODY,fontSize:10.5,color:C.muted,align:"center"});
  s.addText("www.uisa.com.br",{x:7.9,y:5.55,w:4.5,h:0.4,fontFace:BODY,fontSize:13,bold:true,color:C.gold});
}

/* ---------- 9. LEILÃO FLORESCER ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep};
  logoMark(s); footer(s,9);
  kicker(s,"08 · IMPACTO SOCIAL · ESG",0.6,1.2,C.gold);
  s.addText([{text:"Leilão Beneficente ",options:{color:C.cream}},{text:"Florescer",options:{color:C.gold}},{text:".",options:{color:C.cream}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:36,bold:true});
  s.addText("Como UISA, pensamos sempre na sociedade e no ESG. O leilão (sábado, 12/09) reverte a renda ao Florescer Ação Social — iniciativa da própria UISA que apoia +5.000 famílias em Nova Olímpia, Denise e região, por meio da educação, cultura, esporte e geração de renda.",
    {x:0.6,y:2.5,w:7.0,h:1.5,fontFace:BODY,fontSize:13.5,color:C.muted,lineSpacingMultiple:1.22,valign:"top"});
  const li=["Mesas a R$ 7.000 · sistema open food","6 convidados por mesa","Florescer: uma das 100 Melhores ONGs do Brasil (2024)","100% da renda revertido ao Florescer Ação Social"];
  s.addText(li.map(f=>({text:f,options:{bullet:{code:"2022",indent:18},color:C.cream,breakLine:true,paraSpaceAfter:9}})),
    {x:0.6,y:4.1,w:7.0,h:2.0,fontFace:BODY,fontSize:13.5});
  // right gold cards
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:8.1,y:2.5,w:4.6,h:1.85,fill:{color:C.panel},line:{color:C.gold,width:1.2},rectRadius:0.1,shadow:shadow()});
  s.addText("5.000+",{x:8.1,y:2.7,w:4.6,h:0.9,fontFace:HEAD,fontSize:54,bold:true,color:C.lime,align:"center"});
  s.addText("famílias apoiadas pelo Florescer Ação Social · Nova Olímpia · Denise · região",{x:8.25,y:3.66,w:4.3,h:0.6,fontFace:BODY,fontSize:11.5,color:C.cream,align:"center",lineSpacingMultiple:1.05});
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:8.1,y:4.55,w:4.6,h:1.9,fill:{color:C.gold},rectRadius:0.1,shadow:shadow()});
  s.addText("MESA SOLIDÁRIA",{x:8.1,y:4.75,w:4.6,h:0.3,fontFace:BODY,fontSize:12,bold:true,color:C.deep2,align:"center",charSpacing:2});
  s.addText("R$ 7.000",{x:8.1,y:5.05,w:4.6,h:0.9,fontFace:HEAD,fontSize:48,bold:true,color:C.deep2,align:"center"});
  s.addText("Open food · 6 convidados",{x:8.1,y:5.95,w:4.6,h:0.4,fontFace:BODY,fontSize:13,bold:true,color:C.deep2,align:"center"});
}

/* ---------- 10. POR QUE PATROCINAR ---------- */
{
  const s=p.addSlide(); s.background={color:C.cream};
  logoMark(s,false); footer(s,10,false);
  kicker(s,"09 · PATROCÍNIO",0.6,1.2,C.green);
  s.addText([{text:"Por que ",options:{color:C.ink}},{text:"patrocinar",options:{color:C.green}},{text:".",options:{color:C.ink}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:34,bold:true});
  const r=[
    ["EXPOSIÇÃO PREMIUM","Marca em backdrop, quadras, uniformes e mídia espontânea por 7 dias."],
    ["PÚBLICO QUALIFICADO","Acesso direto a 3.500+ decisores classe A/B do agronegócio."],
    ["NETWORKING B2B","Jantar VIP e lounges para conexões com produtores e tomadores de decisão."],
    ["ATIVAÇÃO DE MARCA","Stand, test-drive, degustações e experiências físicas com o público."],
    ["GERAÇÃO DE LEADS","Captura de contatos via ativações, sorteios e canais digitais oficiais."],
    ["BRAND IMAGE","Associação a um evento premium, internacional e ligado à elite do agro."]
  ];
  r.forEach((c,i)=>{
    const x=0.6+(i%3)*4.05, y=2.55+Math.floor(i/3)*2.05;
    s.addShape(p.shapes.RECTANGLE,{x,y,w:3.75,h:1.85,fill:{color:C.cardLight},line:{color:C.lineLight,width:1},shadow:shadow()});
    s.addShape(p.shapes.RECTANGLE,{x,y,w:3.75,h:0.09,fill:{color:i%2?C.green:C.gold}});
    s.addText(`0${i+1}`,{x:x+0.28,y:y+0.22,w:1,h:0.4,fontFace:HEAD,fontSize:20,bold:true,color:C.green});
    s.addText(c[0],{x:x+0.95,y:y+0.25,w:2.7,h:0.4,fontFace:HEAD,fontSize:13.5,bold:true,color:C.ink,valign:"middle"});
    s.addText(c[1],{x:x+0.28,y:y+0.78,w:3.25,h:0.95,fontFace:BODY,fontSize:12,color:C.inkSoft,valign:"top",lineSpacingMultiple:1.15});
  });
}

/* ---------- 11. COTAS ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep2};
  logoMark(s); footer(s,11);
  kicker(s,"10 · COTAS DE PATROCÍNIO",0.6,1.2);
  s.addText([{text:"Três níveis de ",options:{color:C.cream}},{text:"associação",options:{color:C.lime}},{text:".",options:{color:C.cream}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:34,bold:true});
  const cot=[
    ["MASTER","R$ 75K","1 cota exclusiva","Naming rights da quadra principal · 'Agro Open by sua marca' · stand 6×4m · 12 lugares no Jantar VIP · menções ilimitadas.",true],
    ["DIAMANTE","R$ 50K","4 cotas","Nome de quadra alternativa · logo premium no backdrop · stand 4×3m · 6 lugares no Jantar VIP · 10 posts.",false],
    ["OURO","R$ 25K","10 cotas","Presença em backdrop e materiais oficiais · ativações de marca · stand 3×2m · 2 lugares no Jantar VIP · 4 posts.",false]
  ];
  cot.forEach((c,i)=>{
    const x=0.6+i*4.05;
    s.addShape(p.shapes.ROUNDED_RECTANGLE,{x,y:2.6,w:3.75,h:3.9,fill:{color:c[4]?C.panel:C.deep},line:{color:c[4]?C.lime:C.gold,width:c[4]?1.8:1},rectRadius:0.1,shadow:shadow()});
    if(c[4]) s.addText("EXCLUSIVA",{x:x+2.35,y:2.78,w:1.3,h:0.35,fontFace:BODY,fontSize:10,bold:true,color:C.deep2,align:"center",fill:{color:C.lime}});
    s.addText(c[0],{x:x+0.35,y:2.85,w:3,h:0.5,fontFace:HEAD,fontSize:24,bold:true,color:c[4]?C.lime:C.gold});
    s.addText(c[1],{x:x+0.32,y:3.45,w:3.1,h:0.8,fontFace:HEAD,fontSize:40,bold:true,color:C.cream});
    s.addText(c[2],{x:x+0.35,y:4.32,w:3,h:0.35,fontFace:BODY,fontSize:12,bold:true,color:C.muted});
    s.addShape(p.shapes.LINE,{x:x+0.35,y:4.78,w:3.05,h:0,line:{color:C.green,width:1,transparency:50}});
    s.addText(c[3],{x:x+0.35,y:4.9,w:3.1,h:1.5,fontFace:BODY,fontSize:12,color:C.cream,valign:"top",lineSpacingMultiple:1.2});
  });
  s.addText("Valores líquidos · contrapartidas customizáveis sob medida · cotas de leilão sob consulta.",
    {x:0.6,y:6.6,w:12,h:0.3,fontFace:BODY,fontSize:11,italic:true,color:C.muted});
}

/* ---------- 12. CONTRAPARTIDAS ---------- */
{
  const s=p.addSlide(); s.background={color:C.cream};
  logoMark(s,false); footer(s,12,false);
  kicker(s,"11 · CONTRAPARTIDAS",0.6,1.2,C.green);
  s.addText("O que cada marca recebe.",{x:0.6,y:1.5,w:12,h:0.8,fontFace:HEAD,fontSize:32,bold:true,color:C.ink});
  const hd=(t)=>({text:t,options:{fill:{color:C.deep},color:C.lime,bold:true,align:"center",fontFace:HEAD,fontSize:14}});
  const hd0={text:"CONTRAPARTIDA",options:{fill:{color:C.deep},color:C.cream,bold:true,fontFace:HEAD,fontSize:13}};
  const rowsRaw=[
    ["Naming rights da quadra principal","✓","—","—"],
    ["Nome em quadras alternativas","—","✓","—"],
    ["Logo no backdrop oficial","Destaque máx.","Premium","Padrão"],
    ["Logo em uniformes oficiais","✓","✓","✓"],
    ["Stand exclusivo no evento","6×4m","4×3m","3×2m"],
    ["Cortesias Jantar VIP","12 lugares","6 lugares","2 lugares"],
    ["Ativações de marca","✓","✓","✓"],
    ["Menções em redes oficiais","Ilimitadas","10 posts","4 posts"],
    ["Troféu com nome da marca","✓","✓","—"]
  ];
  const body=rowsRaw.map((r,ri)=>{
    const fillC = ri%2? "EAF0E1":"FFFFFF";
    return [
      {text:r[0],options:{fill:{color:fillC},color:C.ink,bold:true,fontFace:BODY,fontSize:12,align:"left"}},
      {text:r[1],options:{fill:{color:fillC},color:C.green,fontFace:BODY,fontSize:12,align:"center",bold:true}},
      {text:r[2],options:{fill:{color:fillC},color:C.inkSoft,fontFace:BODY,fontSize:12,align:"center"}},
      {text:r[3],options:{fill:{color:fillC},color:C.inkSoft,fontFace:BODY,fontSize:12,align:"center"}}
    ];
  });
  s.addTable([[hd0,hd("MASTER"),hd("DIAMANTE"),hd("OURO")],...body],
    {x:0.6,y:2.4,w:12.1,colW:[5.5,2.2,2.2,2.2],rowH:0.42,
     border:{type:"solid",pt:0.5,color:C.lineLight},valign:"middle",margin:[2,6,2,6]});
  s.addText("Contrapartidas customizáveis sob medida · consulte a comissão.",{x:0.6,y:6.75,w:12,h:0.3,fontFace:BODY,fontSize:11,italic:true,color:"6B7861"});
}

/* ---------- 13. ATIVAÇÕES ---------- */
{
  const s=p.addSlide(); s.background={color:C.cream};
  logoMark(s,false); footer(s,13,false);
  kicker(s,"12 · ATIVAÇÕES",0.6,1.2,C.green);
  s.addText([{text:"Ideias de ",options:{color:C.ink}},{text:"ativação",options:{color:C.green}},{text:".",options:{color:C.ink}}],
    {x:0.6,y:1.5,w:12,h:0.8,fontFace:HEAD,fontSize:34,bold:true});
  const a=[
    ["TEST DRIVE","Maquinários e veículos para experimentação ao vivo.","John Deere · Case IH"],
    ["DEGUSTAÇÃO","Produtos do agro, cafés e bebidas em lounges premium.","Bunge · Cargill · Heineken"],
    ["BRINDES CO-BRANDED","Bonés, garrafas e raquetes com co-assinatura.","Todas as cotas"],
    ["SORTEIOS","Geração de leads via QR code com prêmios de alto valor.","Sicredi · Sicoob"],
    ["CONTEÚDO SOCIAL","Reels com atletas e bastidores co-produzidos.","Bancos do agro"],
    ["LOUNGE PATROCINADO","Espaço branded — café, wi-fi e relacionamento VIP.","Banco Pátria · Energisa"]
  ];
  a.forEach((c,i)=>{
    const x=0.6+(i%3)*4.05, y=2.5+Math.floor(i/3)*2.1;
    s.addShape(p.shapes.RECTANGLE,{x,y,w:3.75,h:1.9,fill:{color:C.cardLight},line:{color:C.lineLight,width:1},shadow:shadow()});
    s.addShape(p.shapes.RECTANGLE,{x,y,w:3.75,h:0.09,fill:{color:i%2?C.gold:C.green}});
    s.addText(`0${i+1}`,{x:x+0.28,y:y+0.2,w:1,h:0.4,fontFace:HEAD,fontSize:18,bold:true,color:C.green});
    s.addText(c[0],{x:x+0.28,y:y+0.58,w:3.2,h:0.4,fontFace:HEAD,fontSize:14,bold:true,color:C.ink});
    s.addText(c[1],{x:x+0.28,y:y+0.98,w:3.25,h:0.6,fontFace:BODY,fontSize:11.5,color:C.inkSoft,valign:"top",lineSpacingMultiple:1.1});
    s.addText("IDEAL: "+c[2],{x:x+0.28,y:y+1.55,w:3.25,h:0.3,fontFace:BODY,fontSize:10,bold:true,color:C.green});
  });
}

/* ---------- 14. EXPERIÊNCIA DIGITAL ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep};
  logoMark(s); footer(s,14);
  kicker(s,"13 · EXPERIÊNCIA DIGITAL",0.6,1.2);
  s.addText([{text:"Um Open também ",options:{color:C.cream}},{text:"no digital",options:{color:C.lime}},{text:".",options:{color:C.cream}}],
    {x:0.6,y:1.5,w:12,h:0.9,fontFace:HEAD,fontSize:38,bold:true});
  s.addText("Plataforma própria para inscrições, chaveamento e relacionamento — a marca do patrocinador presente em cada ponto de contato digital.",
    {x:0.6,y:2.55,w:11.6,h:0.7,fontFace:BODY,fontSize:15,color:C.muted,lineSpacingMultiple:1.2});
  const dig=[
    ["SITE OFICIAL","Landing page premium com programação, line-up, números e vitrine de patrocinadores."],
    ["INSCRIÇÃO ONLINE","Formulário digital de atletas por categoria, enviado direto à organização."],
    ["SORTEIO DE CHAVES","Chaveamento online no padrão Grand Slam: cabeças de chave, byes e bracket interativo."],
    ["LEILÃO & INGRESSOS","Reserva de mesas e convites VIP com poucos cliques, via WhatsApp e e-mail."]
  ];
  dig.forEach((c,i)=>{
    const x=0.6+i*3.05;
    s.addShape(p.shapes.ROUNDED_RECTANGLE,{x,y:3.55,w:2.85,h:2.9,fill:{color:C.panel},line:{color:C.green,width:1,transparency:55},rectRadius:0.1,shadow:shadow()});
    s.addText(`0${i+1}`,{x:x+0.3,y:3.78,w:2,h:0.6,fontFace:HEAD,fontSize:30,bold:true,color:C.lime});
    s.addText(c[0],{x:x+0.3,y:4.46,w:2.35,h:0.5,fontFace:HEAD,fontSize:15.5,bold:true,color:C.cream});
    s.addText(c[1],{x:x+0.3,y:4.98,w:2.35,h:1.4,fontFace:BODY,fontSize:12.5,color:C.muted,valign:"top",lineSpacingMultiple:1.18});
  });
  s.addText("agroopen.com.br · inscrições, sorteio de chaves estilo Grand Slam e leilão online.",{x:0.6,y:6.62,w:12,h:0.3,fontFace:BODY,fontSize:11,italic:true,color:C.muted});
}

/* ---------- 15. MARCAS + CTA ---------- */
{
  const s=p.addSlide(); s.background={color:C.deep2};
  s.addShape(p.shapes.RECTANGLE,{x:0,y:0,w:W,h:0.16,fill:{color:C.lime}});
  logoMark(s); footer(s,15);
  kicker(s,"PRÓXIMO PASSO",0.6,1.15);
  s.addText([{text:"Seja parte da ",options:{color:C.cream}},{text:"4ª Agro Open",options:{color:C.lime}},{text:".",options:{color:C.cream}}],
    {x:0.6,y:1.3,w:8,h:0.8,fontFace:HEAD,fontSize:32,bold:true});
  // realização oficial (logos reais)
  s.addText("REALIZAÇÃO OFICIAL",{x:8.6,y:0.95,w:4.1,h:0.3,fontFace:BODY,fontSize:10,bold:true,color:C.muted,charSpacing:2,align:"right"});
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:9.75,y:1.28,w:1.2,h:0.82,fill:{color:"FFFFFF"},rectRadius:0.07});
  s.addImage({path:A+"logo-oficial-ao.png",x:9.96,y:1.33,w:0.72,h:0.72});
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:11.1,y:1.28,w:1.6,h:0.82,fill:{color:"FFFFFF"},rectRadius:0.07});
  s.addImage({path:A+"logo-oficial-ttc.png",x:11.42,y:1.43,w:0.95,h:0.52});
  // Coluna 1 - convidadas
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:0.6,y:2.25,w:6.0,h:3.2,fill:{color:C.deep},line:{color:C.green,width:1,transparency:55},rectRadius:0.08});
  s.addText("EMPRESAS CONVIDADAS",{x:0.85,y:2.45,w:5.5,h:0.3,fontFace:BODY,fontSize:12,bold:true,color:C.lime,charSpacing:2});
  const brands=["Atacadão Dia&Dia","Amaggi","Jalles Machado","Bom Futuro","Sicredi","Sicoob","COFCO","Minerva","Banco Pátria","Copersucar","Barralcool","ALD","Eldorado Celulose","Veracel","CMAA","Coopercitrus","Alta Mogiana","Atos Sementes","Sementes J. Bassos","Queiroz Galvão","Bigmaster","Zilor","Atvos","Leo Madeiras","Sephora","Grupo Ser","Estácio","Porto do Açu","Energisa","Heineken"];
  s.addText(brands.join("   ·   "),{x:0.85,y:2.85,w:5.5,h:2.45,fontFace:BODY,fontSize:12,color:C.cream,valign:"top",lineSpacingMultiple:1.25});
  // Coluna 2 - HUB UniAgro
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:6.8,y:2.25,w:5.9,h:3.2,fill:{color:C.panel},line:{color:C.lime,width:1.2},rectRadius:0.08});
  s.addText("MEMBROS DO HUB UNIAGRO",{x:7.05,y:2.45,w:5.4,h:0.3,fontFace:BODY,fontSize:12,bold:true,color:C.lime,charSpacing:2});
  s.addText("Parceiro institucional de inovação do agro — do qual a UISA é membro.",{x:7.05,y:2.75,w:5.4,h:0.3,fontFace:BODY,fontSize:10,italic:true,color:C.muted});
  const hub=["BP Bioenergy","Cerradinho Bio","Copersucar","Coruripe","Dori Alimentos","Eldorado Brasil","Fischer","Granol","Jacto","Jalles","Minerva Foods","Ouro Fino Saúde Animal","Pedra Agroindustrial","Ouro Fino Agrociência","Santa Helena","São Martinho","SLC Agrícola","Tereos","Uisa","Usina Batatais","Usina Lins","Zilor"];
  s.addText(hub.join("   ·   "),{x:7.05,y:3.15,w:5.4,h:2.15,fontFace:BODY,fontSize:11.5,color:C.cream,valign:"top",lineSpacingMultiple:1.22});
  // contact bar
  s.addShape(p.shapes.ROUNDED_RECTANGLE,{x:0.6,y:5.7,w:12.1,h:1.05,fill:{color:C.deep},line:{color:C.lime,width:1.2},rectRadius:0.1,shadow:shadow()});
  s.addText("Silvester Natal · Patrocínios Agro Open",{x:0.95,y:5.9,w:5,h:0.6,fontFace:HEAD,fontSize:15,bold:true,color:C.cream,valign:"middle"});
  s.addText([{text:"(65) 99636-4113",options:{color:C.lime,bold:true,breakLine:true}},{text:"silvester_natal@hotmail.com",options:{color:C.cream}}],
    {x:6.3,y:5.85,w:6,h:0.8,fontFace:BODY,fontSize:14,align:"right",valign:"middle"});
}

p.writeFile({fileName:"Agro-Open-2026-Fornecedores.pptx"}).then(f=>console.log("WROTE",f));
