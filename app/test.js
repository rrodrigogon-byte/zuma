// Testes automatizados dos motores do SetPoint. Rode: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validSet, validSetPontos, matchWinner, FORMATOS, MODALIDADES } from './rules.js';
import { sortear, nextPow2, seedOrder } from './bracket.js';
import { gerarRoundRobin, tabelaRoundRobin } from './roundrobin.js';
import { gerarSuico, proximaRodada, tabelaSuico } from './swiss.js';
import { gerarDuplaElim, reportDupla } from './doubleelim.js';
import { applyElo, ratingList } from './rating.js';
import { gerarFaseGrupos, gerarMataMata, gruposCompletos } from './grupos.js';

test('regras de tênis: sets válidos e inválidos', () => {
  assert.equal(validSet(6,4), true);
  assert.equal(validSet(7,5), true);
  assert.equal(validSet(7,6), true);
  assert.equal(validSet(6,5), false);
  assert.equal(validSet(8,6), false);
  assert.equal(validSet(6,6), false);
});

test('regras por pontos: vôlei de praia (21, decisivo 15)', () => {
  assert.equal(validSetPontos(21,19,{to:21}), true);
  assert.equal(validSetPontos(21,20,{to:21}), false);
  assert.equal(validSetPontos(15,13,{to:15}), true);
  const r = matchWinner([[21,19],[18,21],[15,12]], FORMATOS['volei_praia']);
  assert.equal(r.valid, true); assert.equal(r.winner, 0);
  const bad = matchWinner([[21,19],[18,21],[15,14]], FORMATOS['volei_praia']);
  assert.equal(bad.valid, false);
});

test('matchWinner melhor de 3 e 5', () => {
  assert.equal(matchWinner([[6,4],[6,3]], FORMATOS['3sets']).winner, 0);
  assert.equal(matchWinner([[4,6],[6,3],[7,5]], FORMATOS['3sets']).winner, 0);
  assert.equal(matchWinner([[6,4]], FORMATOS['3sets']).valid, false);
});

test('8 modalidades configuradas', () => {
  assert.equal(Object.keys(MODALIDADES).length, 8);
});

test('bracket: potência de 2 e ordem de cabeças', () => {
  assert.equal(nextPow2(5), 8);
  assert.equal(nextPow2(16), 16);
  assert.deepEqual(seedOrder(4), [1,4,2,3]); // 1 enfrenta 4, 2 enfrenta 3
});

test('sorteio: sem bye x bye e tamanho correto', () => {
  for(const n of [5,6,7,11,20]){
    const nomes = Array.from({length:n},(_,i)=>'P'+(i+1));
    const ch = sortear(nomes, {seeds:4});
    assert.equal(ch.size, nextPow2(n));
    for(let i=0;i<ch.rounds[0].length;i+=2){
      const a=ch.rounds[0][i], b=ch.rounds[0][i+1];
      assert.ok(!(a&&a.bye&&b&&b.bye), `bye x bye em n=${n}`);
    }
  }
});

test('sorteio: wild card marcado e qualifying', () => {
  const ch = sortear(['A','B','C','D'], {seeds:0, wildcards:['WC'], qualifying:true});
  assert.equal(ch.qualifying, true);
  assert.ok(ch.rounds[0].some(e=>e&&e.wc&&e.name==='WC'));
});

test('round-robin: nº de jogos = C(n,2)', () => {
  const rr = gerarRoundRobin(['A','B','C','D','E']);
  assert.equal(rr.rounds.flat().length, 10);
  rr.rounds[0][0].vencedor = rr.rounds[0][0].a; rr.rounds[0][0].placar='6-1 6-1'; rr.rounds[0][0].tipo='normal';
  assert.equal(tabelaRoundRobin(rr)[0].pontos, 1);
});

test('suíço: bye automático e próxima rodada', () => {
  const s = gerarSuico(['A','B','C','D','E']);
  assert.equal(s.rounds.length, 1);
  s.rounds[0].forEach(j=>{ if(j.tipo!=='bye'){ j.vencedor=j.a; j.tipo='normal'; j.placar='6-2 6-2'; }});
  proximaRodada(s);
  assert.equal(s.rounds.length, 2);
});

test('eliminatória dupla: campeão em chave cheia e com byes', () => {
  for(const n of [4,8,6,5]){
    const nomes = Array.from({length:n},(_,i)=>'J'+(i+1));
    const s = gerarDuplaElim(nomes,{seeds:0});
    let guard=0;
    while(!s.campeao && guard++<300){
      let did=false;
      for(const id of s.order){ const m=s.matches[id]; if(!m.winner&&m.a&&m.b&&!m.a.bye&&!m.b.bye){ reportDupla(s,id,'a','6-3 6-3','normal'); did=true; } }
      if(!did) break;
    }
    assert.ok(s.campeao, `sem campeão em n=${n}`);
  }
});

test('eliminatória dupla: reset da grande final', () => {
  const s = gerarDuplaElim(['1','2','3','4'],{seeds:0});
  let guard=0;
  while((!s.matches['GF'].a || !s.matches['GF'].b) && guard++<30){
    for(const id of s.order){ const m=s.matches[id]; if(id!=='GF'&&!m.winner&&m.a&&m.b&&!m.a.bye&&!m.b.bye){ reportDupla(s,id,'a','6-2 6-2','normal'); } }
  }
  reportDupla(s,'GF','b','6-4 6-4','normal');
  assert.ok(s.matches['GF2'], 'GF2 não criado');
  reportDupla(s,'GF2','a','7-5 6-4','normal');
  assert.ok(s.campeao);
});

test('rating Elo: vencedor sobe, perdedor cai', () => {
  const e = { players:{} };
  applyElo(e,'A','B');
  const l = ratingList(e);
  assert.ok(l.find(p=>p.nome==='A').elo > 1500);
  assert.ok(l.find(p=>p.nome==='B').elo < 1500);
});

test('grupos + mata-mata: gera knockout dos classificados', () => {
  const ev = gerarFaseGrupos(['A','B','C','D','E','F','G','H'],{numGrupos:2,classificamPorGrupo:2,regras:FORMATOS['3sets']});
  ev.grupos.forEach(g=>g.rr.rounds.flat().forEach(j=>{ j.vencedor=j.a; j.placar='6-0 6-0'; j.tipo='normal'; }));
  assert.equal(gruposCompletos(ev), true);
  gerarMataMata(ev);
  assert.equal(ev.knockout.rounds[0].filter(x=>x&&!x.bye).length, 4);
});
