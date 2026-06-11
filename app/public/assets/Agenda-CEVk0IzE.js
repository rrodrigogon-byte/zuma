import{r as d,b as _,j as a}from"./index-f-AFgqPt.js";import{b as M,a as w,c as T}from"./api-DgttTuq0.js";import{M as I}from"./Modal-BZBHT9j5.js";const D={data:"",hora:"",quadra:"",categoria:"",confronto:"",fase:"",torneioId:""},H={placar1:"",placar2:""},Y=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];function O(n){return n.reduce((l,t)=>{const r=t.data||"sem-data";return l[r]||(l[r]=[]),l[r].push(t),l},{})}function G(n){return[...new Set(n.map(t=>t.quadra).filter(Boolean))].sort()}function U(n){const l=[],t=new Date(n);t.setDate(t.getDate()-t.getDay());for(let r=0;r<7;r++){const h=new Date(t);h.setDate(t.getDate()+r),l.push(h.toISOString().slice(0,10))}return l}function K({jogo:n}){return n.vencedor?a.jsx("span",{className:"jogo-badge jogo-badge--done",children:"Concluído"}):null}function E({jogo:n,torneioNome:l,onEditPlacar:t,compact:r}){return a.jsxs("div",{className:`agenda-card ${n.vencedor?"agenda-card--done":""} ${r?"agenda-card--compact":""}`,children:[a.jsxs("div",{className:"agenda-card-header",children:[a.jsx("span",{className:"agenda-hora",children:n.hora||"—"}),!r&&a.jsxs("span",{className:"agenda-quadra",children:["Quadra ",n.quadra||"?"]}),a.jsx(K,{jogo:n})]}),a.jsx("div",{className:"agenda-confronto",children:n.confronto}),n.vencedor&&a.jsxs("div",{className:"agenda-placar",children:[n.placar1!=null?`${n.placar1} × ${n.placar2}`:""," ",a.jsxs("span",{className:"agenda-vencedor",children:["✓ ",n.vencedor]})]}),a.jsxs("div",{className:"agenda-meta",children:[n.categoria&&a.jsx("span",{className:"tag",children:n.categoria}),n.fase&&a.jsx("span",{className:"tag",children:n.fase}),l&&a.jsx("span",{className:"tag tag-torneio",children:l})]}),a.jsx("button",{className:"btn-sm btn-outline agenda-card-edit",onClick:()=>t(n),children:n.vencedor?"Corrigir":"Resultado"})]})}function X({jogos:n,torneioNome:l,onEditPlacar:t,anchor:r,onPrevWeek:h,onNextWeek:m}){const i=d.useMemo(()=>U(r),[r]),b=d.useMemo(()=>G(n),[n]),v=d.useMemo(()=>O(n),[n]),j=new Date().toISOString().slice(0,10);return a.jsxs("div",{className:"semana-wrap",children:[a.jsxs("div",{className:"semana-nav",children:[a.jsx("button",{className:"btn-sm btn-outline",onClick:h,children:"← Semana anterior"}),a.jsxs("span",{className:"semana-label",children:[T(i[0])," – ",T(i[6])]}),a.jsx("button",{className:"btn-sm btn-outline",onClick:m,children:"Próxima semana →"})]}),a.jsx("div",{className:"semana-grid-scroll",children:a.jsxs("table",{className:"semana-grid",children:[a.jsx("thead",{children:a.jsxs("tr",{children:[a.jsx("th",{className:"semana-quadra-col",children:"Quadra"}),i.map(o=>{const p=new Date(o+"T12:00:00");return a.jsxs("th",{className:`semana-dia-col ${o===j?"semana-dia-col--hoje":""}`,children:[a.jsx("span",{className:"semana-dia-nome",children:Y[p.getDay()]}),a.jsxs("span",{className:"semana-dia-num",children:[p.getDate(),"/",p.getMonth()+1]})]},o)})]})}),a.jsx("tbody",{children:b.length===0?a.jsx("tr",{children:a.jsx("td",{colSpan:8,className:"semana-empty",children:"Nenhum jogo nesta semana."})}):b.map(o=>a.jsxs("tr",{children:[a.jsxs("td",{className:"semana-quadra-label",children:["Q",o]}),i.map(p=>{const s=(v[p]||[]).filter(c=>c.quadra===o);return a.jsx("td",{className:`semana-cell ${p===j?"semana-cell--hoje":""}`,children:s.map(c=>a.jsx(E,{jogo:c,torneioNome:l(c.torneioId),onEditPlacar:t,compact:!0},c.id))},p)})]},o))})]})}),n.filter(o=>!o.quadra&&i.includes(o.data)).length>0&&a.jsxs("div",{className:"semana-sem-quadra",children:[a.jsx("h4",{children:"Sem quadra definida"}),a.jsx("div",{className:"agenda-cards",children:n.filter(o=>!o.quadra&&i.includes(o.data)).map(o=>a.jsx(E,{jogo:o,torneioNome:l(o.torneioId),onEditPlacar:t},o.id))})]})]})}function Z({jogos:n,torneioNome:l,onEditPlacar:t}){const r=d.useMemo(()=>O([...n].sort((m,i)=>(m.data+m.hora).localeCompare(i.data+i.hora))),[n]),h=Object.keys(r).sort();return h.length===0?a.jsx("p",{className:"empty-msg",children:"Nenhum jogo agendado."}):a.jsx("div",{className:"agenda-grupos",children:h.map(m=>a.jsxs("div",{className:"agenda-dia",children:[a.jsxs("h2",{className:"agenda-dia-titulo",children:[m==="sem-data"?"Data não definida":M(m),a.jsxs("span",{className:"agenda-dia-count",children:[r[m].length," jogo",r[m].length!==1?"s":""]})]}),a.jsx("div",{className:"agenda-cards",children:r[m].map(i=>a.jsx(E,{jogo:i,torneioNome:l(i.torneioId),onEditPlacar:t},i.id))})]},m))})}function sa(){const[n,l]=d.useState([]),[t,r]=d.useState([]),[h,m]=d.useState(!0),[i,b]=d.useState("lista"),[v,j]=d.useState(new Date().toISOString().slice(0,10)),[o,p]=d.useState(!1),[s,c]=d.useState(D),[z,q]=d.useState(!1),[g,N]=d.useState(null),[u,C]=d.useState(H),[R,A]=d.useState(!1),{toast:x}=_(),y=async()=>{m(!0);try{const[e,f]=await Promise.all([w("/api/admin/agenda"),w("/api/admin/torneios")]);l(Array.isArray(e)?e:[]),r(Array.isArray(f)?f:[])}catch{x("Erro ao carregar agenda","error")}finally{m(!1)}};d.useEffect(()=>{y()},[]);const $=async()=>{if(!s.data||!s.hora||!s.quadra||!s.confronto){x("Preencha data, hora, quadra e confronto","error");return}q(!0);try{await w("/api/admin/agenda",{method:"POST",body:s}),x("Jogo agendado"),p(!1),c(D),y()}catch(e){x(e.message||"Erro ao salvar","error")}finally{q(!1)}},Q=async e=>{if(confirm("Remover jogo da agenda?"))try{await w(`/api/admin/agenda/${e}`,{method:"DELETE"}),x("Jogo removido"),y()}catch(f){x(f.message||"Erro ao remover","error")}},P=e=>{N(e),C({placar1:e.placar1??"",placar2:e.placar2??""})},F=async()=>{if(u.placar1===""||u.placar2===""){x("Preencha os dois placares","error");return}const e=Number(u.placar1),f=Number(u.placar2);if(e===f){x("Placar não pode ser empate em tênis","error");return}const S=(g.confronto||"").split(/\s+vs\s+/i),W=e>f?S[0]||"P1":S[1]||"P2";A(!0);try{await w(`/api/admin/agenda/${g.id}`,{method:"PATCH",body:{placar1:e,placar2:f,vencedor:W}}),x("Resultado salvo"),N(null),y()}catch(V){x(V.message||"Erro ao salvar resultado","error")}finally{A(!1)}},J=e=>{var f;return((f=t.find(S=>String(S.id)===String(e)))==null?void 0:f.nome)||""},L=()=>{const e=new Date(v);e.setDate(e.getDate()-7),j(e.toISOString().slice(0,10))},B=()=>{const e=new Date(v);e.setDate(e.getDate()+7),j(e.toISOString().slice(0,10))},k=d.useMemo(()=>({total:n.length,concluidos:n.filter(e=>e.vencedor).length,pendentes:n.filter(e=>!e.vencedor).length}),[n]);return a.jsxs("div",{className:"page-agenda",children:[a.jsxs("div",{className:"page-header",children:[a.jsx("h1",{children:"Agenda"}),a.jsx("button",{className:"btn-primary",onClick:()=>{c(D),p(!0)},children:"+ Novo Jogo"})]}),!h&&n.length>0&&a.jsxs("div",{className:"agenda-stats",children:[a.jsxs("div",{className:"stat-pill",children:[k.total," total"]}),a.jsxs("div",{className:"stat-pill stat-pill--done",children:[k.concluidos," concluídos"]}),a.jsxs("div",{className:"stat-pill stat-pill--pend",children:[k.pendentes," pendentes"]})]}),!h&&n.length>0&&a.jsxs("div",{className:"vista-toggle",children:[a.jsx("button",{className:`vista-btn ${i==="lista"?"vista-btn--active":""}`,onClick:()=>b("lista"),children:"Lista"}),a.jsx("button",{className:`vista-btn ${i==="semana"?"vista-btn--active":""}`,onClick:()=>b("semana"),children:"Semana"})]}),h?a.jsx("p",{className:"loading-msg",children:"Carregando…"}):i==="semana"?a.jsx(X,{jogos:n,torneioNome:J,onEditPlacar:P,anchor:v,onPrevWeek:L,onNextWeek:B}):a.jsx(Z,{jogos:n,torneioNome:J,onEditPlacar:P}),a.jsxs(I,{open:o,onClose:()=>p(!1),title:"Novo Jogo",children:[a.jsxs("div",{className:"form-grid",children:[a.jsxs("label",{children:["Data *",a.jsx("input",{type:"date",value:s.data,onChange:e=>c({...s,data:e.target.value})})]}),a.jsxs("label",{children:["Hora *",a.jsx("input",{type:"time",value:s.hora,onChange:e=>c({...s,hora:e.target.value})})]}),a.jsxs("label",{children:["Quadra *",a.jsx("input",{value:s.quadra,onChange:e=>c({...s,quadra:e.target.value}),placeholder:"Ex: 1, 2, Central"})]}),a.jsxs("label",{children:["Confronto *",a.jsx("input",{value:s.confronto,onChange:e=>c({...s,confronto:e.target.value}),placeholder:"Ex: João Silva vs Pedro Lima"})]}),a.jsxs("label",{children:["Categoria",a.jsx("input",{value:s.categoria,onChange:e=>c({...s,categoria:e.target.value}),placeholder:"Ex: A, B, Masculino 45+"})]}),a.jsxs("label",{children:["Fase",a.jsx("input",{value:s.fase,onChange:e=>c({...s,fase:e.target.value}),placeholder:"Ex: Quartas, Semifinal, Final"})]}),a.jsxs("label",{children:["Torneio",a.jsxs("select",{value:s.torneioId,onChange:e=>c({...s,torneioId:e.target.value}),children:[a.jsx("option",{value:"",children:"— selecione —"}),t.map(e=>a.jsx("option",{value:e.id,children:e.nome},e.id))]})]})]}),a.jsxs("div",{className:"modal-footer",children:[a.jsx("button",{className:"btn-outline",onClick:()=>p(!1),children:"Cancelar"}),a.jsx("button",{className:"btn-primary",onClick:$,disabled:z,children:z?"Salvando…":"Agendar"})]})]}),a.jsx(I,{open:!!g,onClose:()=>N(null),title:"Registrar Resultado",children:g&&a.jsxs(a.Fragment,{children:[a.jsx("p",{className:"resultado-confronto",children:g.confronto}),g.data&&a.jsxs("p",{className:"resultado-meta",children:[M(g.data)," · ",g.hora," · Quadra ",g.quadra||"?"]}),a.jsxs("div",{className:"resultado-placares",children:[a.jsxs("div",{className:"resultado-lado",children:[a.jsx("label",{className:"resultado-nome",children:(g.confronto||"").split(/\s+vs\s+/i)[0]||"Jogador 1"}),a.jsx("input",{type:"number",min:"0",max:"99",className:"resultado-input",value:u.placar1,onChange:e=>C({...u,placar1:e.target.value}),placeholder:"0",autoFocus:!0})]}),a.jsx("span",{className:"resultado-sep",children:"×"}),a.jsxs("div",{className:"resultado-lado",children:[a.jsx("label",{className:"resultado-nome",children:(g.confronto||"").split(/\s+vs\s+/i)[1]||"Jogador 2"}),a.jsx("input",{type:"number",min:"0",max:"99",className:"resultado-input",value:u.placar2,onChange:e=>C({...u,placar2:e.target.value}),placeholder:"0"})]})]}),u.placar1!==""&&u.placar2!==""&&u.placar1!==u.placar2&&a.jsxs("p",{className:"resultado-preview",children:["Vencedor: ",a.jsx("strong",{children:Number(u.placar1)>Number(u.placar2)?(g.confronto||"").split(/\s+vs\s+/i)[0]:(g.confronto||"").split(/\s+vs\s+/i)[1]})]}),a.jsxs("div",{className:"modal-footer",children:[a.jsx("button",{className:"btn-outline",onClick:()=>N(null),children:"Cancelar"}),a.jsx("button",{className:"btn-danger btn-sm",onClick:()=>{Q(g.id),N(null)},style:{marginRight:"auto"},children:"Remover jogo"}),a.jsx("button",{className:"btn-primary",onClick:F,disabled:R,children:R?"Salvando…":"Salvar Resultado"})]})]})}),a.jsx("style",{children:`
        /* Stats */
        .agenda-stats { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .stat-pill {
          padding: .3rem .75rem; border-radius: 20px; font-size: .78rem; font-weight: 600;
          background: #f3f4f6; color: #374151;
        }
        .stat-pill--done { background: #dcfce7; color: #16a34a; }
        .stat-pill--pend { background: #fef3c7; color: #d97706; }

        /* Toggle vista */
        .vista-toggle { display: flex; gap: .25rem; margin-bottom: 1.25rem; background: #f3f4f6; border-radius: 8px; padding: .25rem; width: fit-content; }
        .vista-btn { padding: .35rem .9rem; border-radius: 6px; border: none; background: transparent; font-size: .85rem; font-weight: 600; cursor: pointer; color: #6b7280; transition: all .15s; }
        .vista-btn--active { background: #fff; color: #0E2E1C; box-shadow: 0 1px 3px rgba(0,0,0,.12); }

        /* Cards */
        .agenda-card {
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px;
          padding: .75rem; display: flex; flex-direction: column; gap: .35rem;
          transition: box-shadow .15s;
        }
        .agenda-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
        .agenda-card--done { border-color: #d1fae5; background: #fafffe; }
        .agenda-card--compact { padding: .5rem; font-size: .8rem; }

        .agenda-card-header { display: flex; align-items: center; gap: .5rem; }
        .agenda-hora { font-weight: 700; font-size: .88rem; color: #0E2E1C; }
        .agenda-quadra { color: #6b7280; font-size: .78rem; margin-left: auto; }
        .agenda-confronto { font-weight: 600; font-size: .9rem; }
        .agenda-placar { font-size: .82rem; color: #374151; }
        .agenda-vencedor { color: #16a34a; font-weight: 700; }
        .agenda-meta { display: flex; flex-wrap: wrap; gap: .3rem; }
        .agenda-card-edit { align-self: flex-start; margin-top: .15rem; }

        .jogo-badge { font-size: .68rem; padding: .15rem .4rem; border-radius: 4px; font-weight: 700; }
        .jogo-badge--done { background: #dcfce7; color: #16a34a; }

        /* Dias */
        .agenda-dia-titulo { font-size: 1rem; font-weight: 700; color: #0E2E1C; margin-bottom: .75rem; display: flex; align-items: center; gap: .5rem; }
        .agenda-dia-count { font-size: .75rem; font-weight: 500; color: #9ca3af; background: #f3f4f6; border-radius: 20px; padding: .1rem .5rem; }
        .agenda-dia { margin-bottom: 2rem; }
        .agenda-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: .75rem; }

        /* Semana */
        .semana-wrap { }
        .semana-nav { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .semana-label { font-size: .85rem; font-weight: 600; color: #374151; }
        .semana-grid-scroll { overflow-x: auto; }
        .semana-grid { width: 100%; border-collapse: collapse; min-width: 700px; }
        .semana-grid th, .semana-grid td { border: 1px solid #e5e7eb; padding: .35rem; vertical-align: top; }
        .semana-grid thead th { background: #f9fafb; text-align: center; }
        .semana-quadra-col { width: 60px; text-align: center !important; }
        .semana-dia-col { min-width: 120px; }
        .semana-dia-col--hoje { background: #f0fdf4 !important; }
        .semana-dia-nome { display: block; font-size: .72rem; font-weight: 700; text-transform: uppercase; color: #9ca3af; }
        .semana-dia-num { display: block; font-size: .9rem; font-weight: 700; color: #0E2E1C; }
        .semana-cell { vertical-align: top; min-height: 60px; }
        .semana-cell--hoje { background: #fafffe; }
        .semana-cell .agenda-card { margin-bottom: .25rem; }
        .semana-quadra-label { text-align: center; font-weight: 700; font-size: .82rem; color: #374151; background: #f9fafb; }
        .semana-empty { padding: 2rem; text-align: center; color: #9ca3af; font-size: .85rem; }
        .semana-sem-quadra { margin-top: 1.5rem; }
        .semana-sem-quadra h4 { font-size: .85rem; font-weight: 700; color: #9ca3af; margin-bottom: .75rem; }

        /* Resultado modal */
        .resultado-confronto { font-size: 1.05rem; font-weight: 700; text-align: center; margin-bottom: .25rem; }
        .resultado-meta { font-size: .78rem; color: #6b7280; text-align: center; margin-bottom: 1.25rem; }
        .resultado-placares { display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-bottom: 1rem; }
        .resultado-lado { display: flex; flex-direction: column; align-items: center; gap: .4rem; }
        .resultado-nome { font-size: .78rem; font-weight: 600; color: #374151; text-align: center; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .resultado-input {
          width: 72px; height: 60px; font-size: 2rem; font-weight: 800; text-align: center;
          border: 2px solid #d1d5db; border-radius: 10px; color: #0E2E1C;
        }
        .resultado-input:focus { border-color: #5FB335; outline: none; }
        .resultado-sep { font-size: 1.5rem; font-weight: 700; color: #9ca3af; }
        .resultado-preview { text-align: center; font-size: .88rem; color: #6b7280; margin-bottom: .5rem; }
        .resultado-preview strong { color: #16a34a; }

        /* Tags */
        .tag { background: #e5e7eb; border-radius: 4px; padding: .1rem .4rem; font-size: .72rem; color: #374151; }
        .tag-torneio { background: #dbeafe; color: #1d4ed8; }
      `})]})}export{sa as default};
