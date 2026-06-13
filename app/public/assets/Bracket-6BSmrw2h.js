import{r as p,b as y,c as x,j as e,d as N}from"./index-BGyL64Sj.js";function u(a,l){return l?Math.round(a/l*100):0}function w({rodadas:a}){return!a||a.length===0?e.jsx("p",{className:"empty-msg",children:"Sem jogos ainda."}):e.jsx("div",{className:"bracket-scroll",children:e.jsx("div",{className:"bracket-columns",style:{display:"flex",gap:"0",alignItems:"flex-start"},children:a.map((l,n)=>e.jsxs("div",{className:"bracket-round",style:{minWidth:200},children:[e.jsx("div",{className:"bracket-round-title",children:l.nome}),e.jsx("div",{className:"bracket-matches",style:{display:"flex",flexDirection:"column",gap:`${Math.pow(2,n)*8}px`,paddingTop:`${Math.pow(2,n)*4}px`},children:l.jogos.map((o,s)=>e.jsx(z,{jogo:o},s))})]},n))})})}function z({jogo:a}){a.placar1!=null||a.placar2!=null;const l=!!a.vencedor;return e.jsxs("div",{className:`bracket-match ${l?"bracket-match--done":""}`,children:[e.jsx(j,{nome:a.p1||"A definir",placar:a.placar1,vencedor:l&&a.vencedor===a.p1,bye:!a.p1}),e.jsx("div",{className:"bracket-divider"}),e.jsx(j,{nome:a.p2||"A definir",placar:a.placar2,vencedor:l&&a.vencedor===a.p2,bye:!a.p2}),(a.data||a.quadra)&&e.jsxs("div",{className:"bracket-match-meta",children:[a.data&&e.jsx("span",{children:N(a.data)}),a.quadra&&e.jsxs("span",{children:["Q",a.quadra]})]})]})}function j({nome:a,placar:l,vencedor:n,bye:o}){return e.jsxs("div",{className:`bracket-player ${n?"bracket-player--winner":""} ${o?"bracket-player--bye":""}`,children:[e.jsx("span",{className:"bracket-player-nome",children:a}),l!=null&&e.jsx("span",{className:"bracket-player-placar",children:l})]})}function $({data:a}){if(!a)return null;const{grupos:l,jogos:n}=a;return e.jsxs("div",{className:"grupos-wrap",children:[e.jsx("div",{className:"grupos-tabelas",children:(l||[]).map((o,s)=>e.jsxs("div",{className:"grupo-card",children:[e.jsx("h3",{className:"grupo-nome",children:o.nome}),e.jsxs("table",{className:"admin-table grupo-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"#"}),e.jsx("th",{children:"Atleta"}),e.jsx("th",{title:"Vitórias",children:"V"}),e.jsx("th",{title:"Derrotas",children:"D"}),e.jsx("th",{title:"Sets",children:"Sets"}),e.jsx("th",{children:"Pts"})]})}),e.jsx("tbody",{children:(o.tabela||[]).map((i,t)=>e.jsxs("tr",{className:t<2?"grupo-row--classifica":"",children:[e.jsx("td",{children:t+1}),e.jsx("td",{children:i.atleta}),e.jsx("td",{children:i.v??0}),e.jsx("td",{children:i.d??0}),e.jsx("td",{children:i.sets??"—"}),e.jsx("td",{children:e.jsx("strong",{children:i.pontos??0})})]},t))})]})]},s))}),n&&n.length>0&&e.jsxs("div",{className:"grupos-jogos",children:[e.jsx("h3",{children:"Próximos Jogos"}),e.jsx("div",{className:"jogos-lista",children:n.filter(o=>!o.vencedor).slice(0,20).map((o,s)=>e.jsxs("div",{className:"jogo-item",children:[e.jsx("span",{className:"jogo-hora",children:o.hora||"—"}),e.jsxs("span",{className:"jogo-confronto",children:[o.p1," vs ",o.p2]}),o.quadra&&e.jsxs("span",{className:"jogo-quadra",children:["Q",o.quadra]})]},s))})]})]})}function B({data:a,tipo:l}){if(!a)return null;const n=a.tabela||[],o=a.rodadas||[];return e.jsxs("div",{className:"tabela-wrap",children:[n.length>0&&e.jsxs("table",{className:"admin-table tabela-classificacao",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"#"}),e.jsx("th",{children:"Atleta"}),e.jsx("th",{children:"PJ"}),e.jsx("th",{children:"V"}),e.jsx("th",{children:"D"}),e.jsx("th",{children:"Pts"})]})}),e.jsx("tbody",{children:n.map((s,i)=>e.jsxs("tr",{children:[e.jsx("td",{children:i+1}),e.jsx("td",{children:s.atleta||s.nome||"—"}),e.jsx("td",{children:s.pj??(s.v??0)+(s.d??0)}),e.jsx("td",{children:s.v??0}),e.jsx("td",{children:s.d??0}),e.jsx("td",{children:e.jsx("strong",{children:s.pontos??s.pts??0})})]},i))})]}),o.length>0&&e.jsxs("div",{className:"rodadas-lista",children:[e.jsx("h3",{children:"Rodadas"}),o.map((s,i)=>e.jsxs("div",{className:"rodada-bloco",children:[e.jsx("h4",{className:"rodada-nome",children:s.nome||`Rodada ${i+1}`}),e.jsx("div",{className:"jogos-lista",children:(s.jogos||[]).map((t,c)=>e.jsxs("div",{className:`jogo-item ${t.vencedor?"jogo-item--done":""}`,children:[e.jsx("span",{className:`jogo-p ${t.vencedor===t.p1?"winner":""}`,children:t.p1}),t.placar1!=null&&e.jsxs("span",{className:"jogo-placar",children:[t.placar1," × ",t.placar2]}),e.jsx("span",{className:"jogo-vs",children:t.placar1==null?"vs":""}),e.jsx("span",{className:`jogo-p ${t.vencedor===t.p2?"winner":""}`,children:t.p2})]},c))})]},i))]})]})}function S(){const[a,l]=p.useState([]),[n,o]=p.useState(""),[s,i]=p.useState(null),[t,c]=p.useState(null),[k,m]=p.useState(!1);y(),p.useEffect(()=>{x.get("/api/categorias").then(r=>{var g,b;const h=Array.isArray(r)?r:r.categorias||[];l(h),h.length>0&&o(((g=h[0])==null?void 0:g.slug)||((b=h[0])==null?void 0:b.id)||h[0])}).catch(()=>{})},[]),p.useEffect(()=>{n&&(m(!0),i(null),c(null),x.get(`/api/bracket/${n}`).then(r=>{c(r.formato||"eliminatoria"),i(r),m(!1)}).catch(()=>{x.get(`/api/grupos/${n}`).then(r=>{c("grupos"),i(r),m(!1)}).catch(()=>{x.get(`/api/suico/${n}`).then(r=>{c("swiss"),i(r),m(!1)}).catch(()=>{x.get(`/api/liga/${n}`).then(r=>{c("roundrobin"),i(r),m(!1)}).catch(()=>{m(!1)})})})}))},[n]);const d=(()=>{if(!s)return null;if(t==="eliminatoria"||t==="dupla_eliminacao"){const r=(s.rodadas||[]).flatMap(g=>g.jogos||[]);return{done:r.filter(g=>g.vencedor).length,total:r.length}}return null})(),v=r=>typeof r=="object"?r.nome||r.slug||r.id:r,f=r=>typeof r=="object"?r.slug||r.id:r;return e.jsxs("div",{className:"page-bracket",children:[e.jsxs("div",{className:"bracket-header",children:[e.jsx("h1",{className:"bracket-titulo",children:"Chaves do Torneio"}),a.length>0&&e.jsx("div",{className:"bracket-cat-selector",children:a.map(r=>e.jsx("button",{className:`cat-btn ${n===f(r)?"cat-btn--active":""}`,onClick:()=>o(f(r)),children:v(r)},f(r)))}),d&&e.jsxs("div",{className:"bracket-progresso",children:[e.jsx("div",{className:"progresso-bar",children:e.jsx("div",{className:"progresso-fill",style:{width:`${u(d.done,d.total)}%`}})}),e.jsxs("span",{className:"progresso-label",children:[d.done,"/",d.total," jogos concluídos (",u(d.done,d.total),"%)"]})]})]}),k?e.jsx("p",{className:"loading-msg",children:"Carregando chave…"}):s?e.jsxs("div",{className:"bracket-content",children:[(t==="eliminatoria"||t==="dupla_eliminacao")&&e.jsx(w,{rodadas:s.rodadas||[]}),t==="grupos"&&e.jsx($,{data:s}),(t==="swiss"||t==="roundrobin")&&e.jsx(B,{data:s,tipo:t})]}):e.jsx("p",{className:"empty-msg",children:"Chave ainda não gerada para esta categoria."}),e.jsx("style",{children:`
        .page-bracket { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }

        .bracket-header { margin-bottom: 1.5rem; }
        .bracket-titulo { font-size: 1.5rem; font-weight: 700; color: #0E2E1C; margin-bottom: 1rem; }

        .bracket-cat-selector { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; }
        .cat-btn {
          padding: .4rem .9rem; border-radius: 20px; border: 1.5px solid #5FB335;
          background: #fff; color: #5FB335; font-weight: 600; cursor: pointer; font-size: .85rem;
          transition: all .15s;
        }
        .cat-btn:hover { background: #f0fae8; }
        .cat-btn--active { background: #5FB335; color: #fff; }

        .bracket-progresso { display: flex; align-items: center; gap: .75rem; margin-top: .5rem; }
        .progresso-bar { flex: 1; max-width: 300px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .progresso-fill { height: 100%; background: #5FB335; border-radius: 4px; transition: width .3s; }
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
        .bracket-match--done { border-color: #d1fae5; }
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
        .bracket-player--winner { background: #f0fdf4; }
        .bracket-player--bye { opacity: .45; }
        .bracket-player-nome {
          font-size: .82rem; font-weight: 500; color: #111; flex: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .bracket-player--winner .bracket-player-nome { color: #16a34a; font-weight: 700; }
        .bracket-player-placar {
          font-size: .82rem; font-weight: 700; color: #374151;
          background: #f3f4f6; border-radius: 4px; padding: .1rem .35rem; min-width: 24px;
          text-align: center;
        }
        .bracket-player--winner .bracket-player-placar { background: #dcfce7; color: #16a34a; }

        /* Grupos */
        .grupos-wrap { display: flex; flex-direction: column; gap: 2rem; }
        .grupos-tabelas { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
        .grupo-card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
        .grupo-nome {
          background: #0E2E1C; color: #fff; padding: .6rem 1rem;
          font-size: .9rem; font-weight: 700; margin: 0;
        }
        .grupo-table { margin: 0; }
        .grupo-table th, .grupo-table td { padding: .4rem .6rem; font-size: .82rem; }
        .grupo-row--classifica td:first-child::after { content: ' ✓'; color: #5FB335; }

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
        .jogo-p.winner { font-weight: 700; color: #16a34a; }
        .jogo-placar { font-weight: 700; font-size: .9rem; color: #374151; }
        .jogo-vs { color: #9ca3af; font-size: .75rem; }

        .rodada-bloco { margin-bottom: 1.5rem; }
        .rodada-nome { font-size: .9rem; font-weight: 700; color: #0E2E1C; margin-bottom: .5rem; }

        @media (max-width: 640px) {
          .page-bracket { padding: 1rem; }
          .bracket-round { min-width: 160px; padding: 0 .25rem; }
          .bracket-player-nome { font-size: .78rem; }
        }
      `})]})}export{S as default};
