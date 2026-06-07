// Fase de grupos + mata-mata (cap. 4.1).
// Distribui atletas em G grupos (round-robin em cada), classifica e gera o mata-mata dos qualificados.
import { gerarRoundRobin, tabelaRoundRobin } from './roundrobin.js';
import { sortear } from './bracket.js';

const LETRAS = 'ABCDEFGHIJKLMNOP';

// Distribuição serpentina (snake) para equilibrar os grupos por ordem de entrada/seed.
export function distribuirGrupos(nomes, numGrupos){
  const players = nomes.map(s=>String(s).trim()).filter(Boolean);
  if(players.length < numGrupos*2) throw new Error('atletas insuficientes para esse número de grupos');
  const grupos = Array.from({length:numGrupos}, ()=>[]);
  let dir = 1, g = 0;
  for(const p of players){
    grupos[g].push(p);
    if(dir===1){ if(g===numGrupos-1) dir=-1; else g++; }
    else { if(g===0) dir=1; else g--; }
  }
  return grupos;
}

export function gerarFaseGrupos(nomes, { numGrupos=2, classificamPorGrupo=2, regras }={}){
  const dist = distribuirGrupos(nomes, numGrupos);
  const grupos = dist.map((membros,i)=>{
    const rr = gerarRoundRobin(membros);
    rr.regras = regras;
    return { nome:'Grupo '+LETRAS[i], rr };
  });
  return { tipo:'grupos', numGrupos, classificamPorGrupo, grupos, knockout:null, regras, criadoEm:new Date().toISOString() };
}

export function tabelasGrupos(ev){
  return ev.grupos.map(g=>({ nome:g.nome, tabela: tabelaRoundRobin(g.rr) }));
}

// Todos os jogos dos grupos têm vencedor?
export function gruposCompletos(ev){
  return ev.grupos.every(g=> g.rr.rounds.flat().every(j=> j.vencedor));
}

// Gera o mata-mata cruzando os classificados (1ºA x 2ºB, 1ºB x 2ºA, ...).
export function gerarMataMata(ev){
  if(!gruposCompletos(ev)) throw new Error('conclua todos os jogos dos grupos antes de gerar o mata-mata');
  const tabs = tabelasGrupos(ev);
  const k = ev.classificamPorGrupo;
  // ordena qualificados em "serpentina cruzada": 1ºs primeiro, depois 2ºs invertidos
  const qualificados = [];
  for(let pos=0; pos<k; pos++){
    const linha = tabs.map(t=> t.tabela[pos] && t.tabela[pos].nome).filter(Boolean);
    if(pos % 2 === 1) linha.reverse();
    qualificados.push(...linha);
  }
  // monta a chave com os classificados (sem novos cabeças — já vêm ordenados por grupo)
  const chave = sortear(qualificados, { size:'auto', seeds:0 });
  chave.placares = {};
  ev.knockout = chave;
  return ev;
}
