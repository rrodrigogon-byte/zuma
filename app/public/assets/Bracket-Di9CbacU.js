import{r as p,e as y,d as x,j as e,f as N}from"./index-D0-OxW7X.js";function b(a,i){return i?Math.round(a/i*100):0}function w({rodadas:a}){return!a||a.length===0?e.jsx("p",{className:"empty-msg",children:"Sem jogos ainda."}):e.jsx("div",{className:"bracket-scroll",children:e.jsx("div",{className:"bracket-columns",style:{display:"flex",gap:"0",alignItems:"flex-start"},children:a.map((i,o)=>e.jsxs("div",{className:"bracket-round",style:{minWidth:200},children:[e.jsx("div",{className:"bracket-round-title",children:i.nome}),e.jsx("div",{className:"bracket-matches",style:{display:"flex",flexDirection:"column",gap:`${Math.pow(2,o)*8}px`,paddingTop:`${Math.pow(2,o)*4}px`},children:i.jogos.map((n,t)=>e.jsx(F,{jogo:n},t))})]},o))})})}function F({jogo:a}){a.placar1!=null||a.placar2!=null;const i=!!a.vencedor;return e.jsxs("div",{className:`bracket-match ${i?"bracket-match--done":""}`,children:[e.jsx(j,{nome:a.p1||"A definir",placar:a.placar1,vencedor:i&&a.vencedor===a.p1,bye:!a.p1}),e.jsx("div",{className:"bracket-divider"}),e.jsx(j,{nome:a.p2||"A definir",placar:a.placar2,vencedor:i&&a.vencedor===a.p2,bye:!a.p2}),(a.data||a.quadra)&&e.jsxs("div",{className:"bracket-match-meta",children:[a.data&&e.jsx("span",{children:N(a.data)}),a.quadra&&e.jsxs("span",{children:["Q",a.quadra]})]})]})}function j({nome:a,placar:i,vencedor:o,bye:n}){return e.jsxs("div",{className:`bracket-player ${o?"bracket-player--winner":""} ${n?"bracket-player--bye":""}`,children:[e.jsx("span",{className:"bracket-player-nome",children:a}),i!=null&&e.jsx("span",{className:"bracket-player-placar",children:i})]})}function z({data:a}){if(!a)return null;const{grupos:i,jogos:o}=a;return e.jsxs("div",{className:"grupos-wrap",children:[e.jsx("div",{className:"grupos-tabelas",children:(i||[]).map((n,t)=>e.jsxs("div",{className:"grupo-card",children:[e.jsx("h3",{className:"grupo-nome",children:n.nome}),e.jsxs("table",{className:"admin-table grupo-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"#"}),e.jsx("th",{children:"Atleta"}),e.jsx("th",{title:"Vitórias",children:"V"}),e.jsx("th",{title:"Derrotas",children:"D"}),e.jsx("th",{title:"Sets",children:"Sets"}),e.jsx("th",{children:"Pts"})]})}),e.jsx("tbody",{children:(n.tabela||[]).map((l,s)=>e.jsxs("tr",{className:s<2?"grupo-row--classifica":"",children:[e.jsx("td",{children:s+1}),e.jsx("td",{children:l.atleta}),e.jsx("td",{children:l.v??0}),e.jsx("td",{children:l.d??0}),e.jsx("td",{children:l.sets??"—"}),e.jsx("td",{children:e.jsx("strong",{children:l.pontos??0})})]},s))})]})]},t))}),o&&o.length>0&&e.jsxs("div",{className:"grupos-jogos",children:[e.jsx("h3",{children:"Próximos Jogos"}),e.jsx("div",{className:"jogos-lista",children:o.filter(n=>!n.vencedor).slice(0,20).map((n,t)=>e.jsxs("div",{className:"jogo-item",children:[e.jsx("span",{className:"jogo-hora",children:n.hora||"—"}),e.jsxs("span",{className:"jogo-confronto",children:[n.p1," vs ",n.p2]}),n.quadra&&e.jsxs("span",{className:"jogo-quadra",children:["Q",n.quadra]})]},t))})]})]})}function S({data:a,tipo:i}){if(!a)return null;const o=a.tabela||[],n=a.rodadas||[];return e.jsxs("div",{className:"tabela-wrap",children:[o.length>0&&e.jsxs("table",{className:"admin-table tabela-classificacao",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"#"}),e.jsx("th",{children:"Atleta"}),e.jsx("th",{children:"PJ"}),e.jsx("th",{children:"V"}),e.jsx("th",{children:"D"}),e.jsx("th",{children:"Pts"})]})}),e.jsx("tbody",{children:o.map((t,l)=>e.jsxs("tr",{children:[e.jsx("td",{children:l+1}),e.jsx("td",{children:t.atleta||t.nome||"—"}),e.jsx("td",{children:t.pj??(t.v??0)+(t.d??0)}),e.jsx("td",{children:t.v??0}),e.jsx("td",{children:t.d??0}),e.jsx("td",{children:e.jsx("strong",{children:t.pontos??t.pts??0})})]},l))})]}),n.length>0&&e.jsxs("div",{className:"rodadas-lista",children:[e.jsx("h3",{children:"Rodadas"}),n.map((t,l)=>e.jsxs("div",{className:"rodada-bloco",children:[e.jsx("h4",{className:"rodada-nome",children:t.nome||`Rodada ${l+1}`}),e.jsx("div",{className:"jogos-lista",children:(t.jogos||[]).map((s,c)=>e.jsxs("div",{className:`jogo-item ${s.vencedor?"jogo-item--done":""}`,children:[e.jsx("span",{className:`jogo-p ${s.vencedor===s.p1?"winner":""}`,children:s.p1}),s.placar1!=null&&e.jsxs("span",{className:"jogo-placar",children:[s.placar1," × ",s.placar2]}),e.jsx("span",{className:"jogo-vs",children:s.placar1==null?"vs":""}),e.jsx("span",{className:`jogo-p ${s.vencedor===s.p2?"winner":""}`,children:s.p2})]},c))})]},l))]})]})}function $(){const[a,i]=p.useState([]),[o,n]=p.useState(""),[t,l]=p.useState(null),[s,c]=p.useState(null),[k,m]=p.useState(!1),{toast:B}=y();p.useEffect(()=>{x.get("/api/categorias").then(r=>{var g,u;const h=Array.isArray(r)?r:r.categorias||[];i(h),h.length>0&&n(((g=h[0])==null?void 0:g.slug)||((u=h[0])==null?void 0:u.id)||h[0])}).catch(()=>{})},[]),p.useEffect(()=>{o&&(m(!0),l(null),c(null),x.get(`/api/bracket/${o}`).then(r=>{c(r.formato||"eliminatoria"),l(r),m(!1)}).catch(()=>{x.get(`/api/grupos/${o}`).then(r=>{c("grupos"),l(r),m(!1)}).catch(()=>{x.get(`/api/suico/${o}`).then(r=>{c("swiss"),l(r),m(!1)}).catch(()=>{x.get(`/api/liga/${o}`).then(r=>{c("roundrobin"),l(r),m(!1)}).catch(()=>{m(!1)})})})}))},[o]);const d=(()=>{if(!t)return null;if(s==="eliminatoria"||s==="dupla_eliminacao"){const r=(t.rodadas||[]).flatMap(g=>g.jogos||[]);return{done:r.filter(g=>g.vencedor).length,total:r.length}}return null})(),v=r=>typeof r=="object"?r.nome||r.slug||r.id:r,f=r=>typeof r=="object"?r.slug||r.id:r;return e.jsxs("div",{className:"page-bracket",children:[e.jsxs("div",{className:"bracket-header",children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:12,marginBottom:8,flexWrap:"wrap"},children:[e.jsx("h1",{className:"bracket-titulo",style:{margin:0},children:"🏆 Chaves do Torneio"}),t&&e.jsx("span",{style:{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:"#FF6B2C18",color:"#FF6B2C",border:"1px solid #FF6B2C40"},children:s==="eliminatoria"?"Eliminatória":s==="grupos"?"Fase de Grupos":s==="swiss"?"Suíço":s==="roundrobin"?"Round Robin":s==="dupla_eliminacao"?"Dupla Eliminação":s})]}),e.jsx("p",{style:{color:"#5A6570",margin:"0 0 16px",fontSize:"0.9rem"},children:"Selecione uma categoria para ver os confrontos"}),a.length>0&&e.jsx("div",{className:"bracket-cat-selector",children:a.map(r=>e.jsxs("button",{className:`cat-btn ${o===f(r)?"cat-btn--active":""}`,onClick:()=>n(f(r)),children:[v(r),r.inscritos>0&&e.jsx("span",{style:{marginLeft:5,fontSize:10,opacity:.75},children:r.inscritos})]},f(r)))}),d&&e.jsxs("div",{className:"bracket-progresso",children:[e.jsx("div",{className:"progresso-bar",children:e.jsx("div",{className:"progresso-fill",style:{width:`${b(d.done,d.total)}%`}})}),e.jsxs("span",{className:"progresso-label",children:[d.done,"/",d.total," jogos concluídos (",b(d.done,d.total),"%)"]})]})]}),k?e.jsx("p",{className:"loading-msg",children:"Carregando chave…"}):t?e.jsxs("div",{className:"bracket-content",children:[(s==="eliminatoria"||s==="dupla_eliminacao")&&e.jsx(w,{rodadas:t.rodadas||[]}),s==="grupos"&&e.jsx(z,{data:t}),(s==="swiss"||s==="roundrobin")&&e.jsx(S,{data:t,tipo:s})]}):e.jsxs("div",{style:{textAlign:"center",padding:"48px 24px"},children:[e.jsx("div",{style:{fontSize:"3rem",marginBottom:12},children:"🎾"}),e.jsx("p",{style:{color:"#5A6570",fontSize:"1rem",fontWeight:600},children:"Chave ainda não gerada para esta categoria."}),e.jsx("p",{style:{color:"#8AA9C0",fontSize:"0.85rem"},children:"Aguarde o sorteio oficial ou escolha outra categoria acima."})]}),e.jsx("style",{children:`
        .page-bracket { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }

        .bracket-header { margin-bottom: 1.5rem; }
        .bracket-titulo { font-size: 1.5rem; font-weight: 700; color: #12283F; margin-bottom: 1rem; }

        .bracket-cat-selector { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; }
        .cat-btn {
          padding: .4rem .9rem; border-radius: 20px; border: 1.5px solid #FF6B2C;
          background: #fff; color: #FF6B2C; font-weight: 600; cursor: pointer; font-size: .85rem;
          transition: all .15s;
        }
        .cat-btn:hover { background: #FFF9F5; }
        .cat-btn--active { background: #FF6B2C; color: #fff; }

        .bracket-progresso { display: flex; align-items: center; gap: .75rem; margin-top: .5rem; }
        .progresso-bar { flex: 1; max-width: 300px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .progresso-fill { height: 100%; background: #FF6B2C; border-radius: 4px; transition: width .3s; }
        .progresso-label { font-size: .8rem; color: #6b7280; }

        /* Bracket */
        .bracket-scroll { overflow-x: auto; padding-bottom: 1rem; }
        .bracket-columns { min-width: max-content; }
        .bracket-round { padding: 0 .5rem; }
        .bracket-round-title {
          text-align: center; font-size: .75rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: #6b7280; margin-bottom: .75rem; padding: .3rem .5rem;
          background: #f9fafb; border-radius: 6px;
        }

        .bracket-match {
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 8px;
          overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06);
          min-width: 180px;
        }
        .bracket-match--done { border-color: #FFF9F5; }
        .bracket-match-meta {
          display: flex; gap: .5rem; padding: .2rem .5rem; background: #f9fafb;
          font-size: .7rem; color: #9ca3af; border-top: 1px solid #f3f4f6;
        }

        .bracket-divider { height: 1px; background: #e5e7eb; }

        .bracket-player {
          display: flex; justify-content: space-between; align-items: center;
          padding: .45rem .6rem; gap: .5rem;
          transition: background .1s;
        }
        .bracket-player--winner { background: #FFF9F5; }
        .bracket-player--bye { opacity: .45; }
        .bracket-player-nome {
          font-size: .82rem; font-weight: 500; color: #111; flex: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .bracket-player--winner .bracket-player-nome { color: #2D6F9E; font-weight: 700; }
        .bracket-player-placar {
          font-size: .82rem; font-weight: 700; color: #374151;
          background: #f3f4f6; border-radius: 4px; padding: .1rem .35rem; min-width: 24px;
          text-align: center;
        }
        .bracket-player--winner .bracket-player-placar { background: #FFF9F5; color: #2D6F9E; }

        /* Grupos */
        .grupos-wrap { display: flex; flex-direction: column; gap: 2rem; }
        .grupos-tabelas { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
        .grupo-card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
        .grupo-nome {
          background: #12283F; color: #fff; padding: .6rem 1rem;
          font-size: .9rem; font-weight: 700; margin: 0;
        }
        .grupo-table { margin: 0; }
        .grupo-table th, .grupo-table td { padding: .4rem .6rem; font-size: .82rem; }
        .grupo-row--classifica td:first-child::after { content: ' ✓'; color: #FF6B2C; }

        .grupos-jogos h3 { font-size: 1rem; font-weight: 700; margin-bottom: .75rem; }

        /* Tabela */
        .tabela-wrap { display: flex; flex-direction: column; gap: 2rem; }
        .tabela-classificacao { max-width: 600px; }

        /* Jogos lista */
        .jogos-lista { display: flex; flex-direction: column; gap: .4rem; }
        .jogo-item {
          display: flex; align-items: center; gap: .75rem; padding: .5rem .75rem;
          background: #f9fafb; border-radius: 8px; font-size: .85rem;
        }
        .jogo-item--done { opacity: .6; }
        .jogo-hora { color: #6b7280; min-width: 40px; font-size: .8rem; }
        .jogo-confronto { flex: 1; font-weight: 500; }
        .jogo-quadra { color: #9ca3af; font-size: .78rem; }
        .jogo-p { flex: 1; }
        .jogo-p.winner { font-weight: 700; color: #2D6F9E; }
        .jogo-placar { font-weight: 700; font-size: .9rem; color: #374151; }
        .jogo-vs { color: #9ca3af; font-size: .75rem; }

        .rodada-bloco { margin-bottom: 1.5rem; }
        .rodada-nome { font-size: .9rem; font-weight: 700; color: #12283F; margin-bottom: .5rem; }

        @media (max-width: 640px) {
          .page-bracket { padding: 1rem; }
          .bracket-round { min-width: 160px; padding: 0 .25rem; }
          .bracket-player-nome { font-size: .78rem; }
        }
      `})]})}export{$ as default};
