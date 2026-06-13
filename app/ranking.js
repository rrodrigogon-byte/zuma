// Motor de ranking — estilo meuranking.com
// Suporta: pontos por fase de torneio + partidas avulsas/desafios + movement tracking + temporadas
export const POINTS = {
  champion:1000, finalist:600, semi:360, quarter:180,
  r16:90, r32:45, r64:20, participation:5
};

// Pontos para partidas avulsas/desafios (ranking contínuo estilo meuranking)
export const POINTS_PARTIDA = {
  vitoria_superior:  15,  // venceu alguém melhor ranqueado (+15)
  vitoria_igual:     10,  // venceu alguém na mesma faixa (+10)
  vitoria_inferior:   6,  // venceu alguém pior ranqueado (+6)
  derrota_superior:   3,  // perdeu para alguém melhor (não perde pontos, ganha 3)
  derrota_igual:      1,  // perdeu para alguém na mesma faixa (+1)
  derrota_inferior:   0,  // perdeu para alguém pior (sem pontos)
};

// ─── Tournament bracket ───────────────────────────────────────────────────────

export function pointsFromChave(chave){
  const rounds = chave.rounds;
  const totalRounds = rounds.length - 1;
  const reached = {};
  const played = new Set();
  rounds[0].forEach(e=>{ if(e && !e.bye){ played.add(e.name); reached[e.name]=0; } });
  for(let r=1;r<rounds.length;r++){
    rounds[r].forEach(e=>{ if(e && !e.bye){ reached[e.name]=Math.max(reached[e.name]??0, r); } });
  }
  const out = {};
  for(const name of played){
    const rr = reached[name];
    out[name] = roundPoints(rr, totalRounds);
  }
  return out;
}

function roundPoints(rr, totalRounds){
  if(rr >= totalRounds) return POINTS.champion;
  const fromEnd = totalRounds - rr;
  switch(fromEnd){
    case 1: return POINTS.finalist;
    case 2: return POINTS.semi;
    case 3: return POINTS.quarter;
    case 4: return POINTS.r16;
    case 5: return POINTS.r32;
    case 6: return POINTS.r64;
    default: return POINTS.participation;
  }
}

export function recordsFromChave(chave){
  const rounds = chave.rounds;
  const rec = {};
  const ensure = n => rec[n] || (rec[n]={w:0,l:0});
  for(let r=0;r<rounds.length-1;r++){
    for(let m=0;m<rounds[r].length;m+=2){
      const a=rounds[r][m], b=rounds[r][m+1], w=rounds[r+1] && rounds[r+1][Math.floor(m/2)];
      if(!w || w.bye) continue;
      const aReal=a&&!a.bye, bReal=b&&!b.bye;
      if(aReal && bReal){
        ensure(w.name).w++;
        const loser = (w.name===a.name)? b : a;
        ensure(loser.name).l++;
      }
    }
  }
  return rec;
}

export function applyChaveToRanking(ranking, categoria, chave){
  const pts = pointsFromChave(chave);
  const rec = recordsFromChave(chave);
  const temporada = chave.temporada || new Date().getFullYear().toString();
  _ensureRanking(ranking);

  for(const name of Object.keys(pts)){
    const key = (categoria+'|'+name).toLowerCase();
    const p = ranking.players[key] || (ranking.players[key]={
      nome:name, categoria, pontos:0, vitorias:0, derrotas:0,
      torneios:0, partidas_avulsas:0, temporada,
      historico:[], posAnterior:null
    });
    _snapshotPos(ranking, key);  // guarda posição atual antes de alterar
    p.pontos           += pts[name];
    p.vitorias         += (rec[name]?.w||0);
    p.derrotas         += (rec[name]?.l||0);
    p.torneios         += 1;
    p.temporada        = temporada;
    // Registrar evento no histórico do atleta
    p.historico = p.historico || [];
    p.historico.push({
      tipo: 'torneio',
      pontos: pts[name],
      descricao: chave.nome || 'Torneio',
      data: new Date().toISOString(),
      temporada
    });
  }
  _recalcMovimento(ranking);
  return ranking;
}

// ─── Partidas avulsas / Desafios (ranking contínuo) ──────────────────────────

export function applyPartidaToRanking(ranking, { vencedor, perdedor, categoria, placar, descricao, temporada }){
  _ensureRanking(ranking);
  const temp = temporada || new Date().getFullYear().toString();
  const kV = (categoria+'|'+vencedor).toLowerCase();
  const kP = (categoria+'|'+perdedor).toLowerCase();

  const pV = ranking.players[kV] || (ranking.players[kV]={
    nome:vencedor, categoria, pontos:0, vitorias:0, derrotas:0,
    torneios:0, partidas_avulsas:0, temporada:temp, historico:[], posAnterior:null
  });
  const pP = ranking.players[kP] || (ranking.players[kP]={
    nome:perdedor, categoria, pontos:0, vitorias:0, derrotas:0,
    torneios:0, partidas_avulsas:0, temporada:temp, historico:[], posAnterior:null
  });

  // Guarda posições antes de alterar
  _snapshotPos(ranking, kV);
  _snapshotPos(ranking, kP);

  // Calcula pontos baseado na diferença de posição
  const listaAtual = rankingList(ranking, categoria);
  const posV = listaAtual.findIndex(x=>x.nome===vencedor)+1 || 999;
  const posP = listaAtual.findIndex(x=>x.nome===perdedor)+1 || 999;
  const diff = posP - posV; // positivo = perdedor estava melhor

  let ptsVencedor, ptsPerdedor;
  if(diff > 2){          // perdedor estava significativamente acima
    ptsVencedor = POINTS_PARTIDA.vitoria_superior;
    ptsPerdedor = POINTS_PARTIDA.derrota_superior;
  } else if(diff < -2){  // perdedor estava abaixo
    ptsVencedor = POINTS_PARTIDA.vitoria_inferior;
    ptsPerdedor = POINTS_PARTIDA.derrota_inferior;
  } else {               // mesma faixa
    ptsVencedor = POINTS_PARTIDA.vitoria_igual;
    ptsPerdedor = POINTS_PARTIDA.derrota_igual;
  }

  const now = new Date().toISOString();
  pV.pontos += ptsVencedor; pV.vitorias++; pV.partidas_avulsas++;
  pP.pontos = Math.max(0, pP.pontos + ptsPerdedor); pP.derrotas++; pP.partidas_avulsas++;
  pV.temporada = temp; pP.temporada = temp;

  const desc = descricao || 'Partida avulsa';
  pV.historico = pV.historico||[]; pV.historico.push({ tipo:'partida', resultado:'vitoria', pontos:ptsVencedor, adversario:perdedor, placar, descricao:desc, data:now, temporada:temp });
  pP.historico = pP.historico||[]; pP.historico.push({ tipo:'partida', resultado:'derrota', pontos:ptsPerdedor, adversario:vencedor, placar, descricao:desc, data:now, temporada:temp });

  _recalcMovimento(ranking);
  return { ptsVencedor, ptsPerdedor };
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function _ensureRanking(ranking){
  ranking.players = ranking.players || {};
  ranking.snapshot = ranking.snapshot || {};
}

// Guarda a posição atual do atleta antes de alterar pontos
function _snapshotPos(ranking, key){
  const p = ranking.players[key];
  if(!p) return;
  // Calcula posição atual por comparação simples
  const arr = Object.values(ranking.players).filter(x=>x.categoria===p.categoria);
  arr.sort((a,b)=> b.pontos-a.pontos || b.vitorias-a.vitorias);
  const pos = arr.findIndex(x=>(x.categoria+'|'+x.nome).toLowerCase()===key)+1;
  if(pos > 0 && p.posAnterior == null) p.posAnterior = pos;
}

// Recalcula o campo `movimento` de cada atleta após mudança de pontos
function _recalcMovimento(ranking){
  const byCat = {};
  for(const [key, p] of Object.entries(ranking.players||{})){
    const cat = p.categoria;
    if(!byCat[cat]) byCat[cat] = [];
    byCat[cat].push({ key, ...p });
  }
  for(const arr of Object.values(byCat)){
    arr.sort((a,b)=> b.pontos-a.pontos || b.vitorias-a.vitorias);
    arr.forEach((p,i)=>{
      const player = ranking.players[p.key];
      const novaPos = i+1;
      if(player.posAnterior != null && player.posAnterior > 0){
        player.movimento = player.posAnterior - novaPos; // positivo = subiu
      } else {
        player.movimento = 0;
      }
      player.posAnterior = novaPos; // atualiza para próximo ciclo
    });
  }
}

// ─── Lista pública ────────────────────────────────────────────────────────────

export function rankingList(ranking, categoria, temporada){
  let arr = Object.values(ranking.players||{});
  if(categoria && categoria!=='todas') arr = arr.filter(p=>p.categoria===categoria);
  if(temporada && temporada!=='todas') arr = arr.filter(p=>p.temporada===temporada || !p.temporada);
  arr.sort((a,b)=> b.pontos-a.pontos || b.vitorias-a.vitorias);
  return arr.map((p,i)=>({
    pos:i+1,
    nome:p.nome,
    categoria:p.categoria,
    pontos:p.pontos,
    vitorias:p.vitorias,
    derrotas:p.derrotas,
    torneios:p.torneios||0,
    partidas_avulsas:p.partidas_avulsas||0,
    aproveitamento: (p.vitorias+p.derrotas)? Math.round(100*p.vitorias/(p.vitorias+p.derrotas)) : 0,
    movimento: p.movimento||0,            // positivo=subiu, negativo=desceu, 0=estável
    temporada: p.temporada||null,
    historico: (p.historico||[]).slice(-20), // últimas 20 entradas
  }));
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

// Retorna a lista de temporadas distintas no ranking
export function temporadasList(ranking){
  const set = new Set();
  for(const p of Object.values(ranking.players||{})){
    if(p.temporada) set.add(p.temporada);
  }
  return [...set].sort().reverse();
}

// Reset de uma temporada específica (arquiva e zera)
export function resetTemporada(ranking, temporada){
  ranking.arquivados = ranking.arquivados || {};
  if(!ranking.arquivados[temporada]) ranking.arquivados[temporada] = {};
  for(const [key,p] of Object.entries(ranking.players||{})){
    if(p.temporada===temporada){
      ranking.arquivados[temporada][key] = { ...p };
      delete ranking.players[key];
    }
  }
}
