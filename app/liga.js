/**
 * liga.js — Motor de Liga de Ranking por Temporada
 * Sistema estilo "Meu Ranking": inscrição aberta → sorteio de rodadas → resultados → pontuação acumulada
 *
 * Estrutura de uma Liga (salva em db().ligas[id]):
 * {
 *   id, nome, temporada, categoria, formato ('simples'|'duplas'|'misto'),
 *   status: 'inscricoes' | 'em_andamento' | 'encerrada',
 *   rodadaAtual: 0..n,
 *   config: { maxRodadas, minJogos, pontosVitoria, pontosDerrota, pontosWO, walkover, bye },
 *   inscricoes: [{ id, nome, email, tel, status:'ativo'|'desistiu', inscritoEm }],
 *   rodadas: [
 *     {
 *       numero, status:'pendente'|'em_andamento'|'encerrada', geradaEm,
 *       jogos: [{ id, a, b, placar, vencedor, tipo:'normal'|'wo'|'bye', registradoEm }]
 *     }
 *   ],
 *   tabela: [{ nome, pts, v, d, wo, bye, jogos, aproveitamento }] — recalculada a cada resultado
 * }
 */

// ─── Algoritmo de sorteio round-robin (todos contra todos) ─────────────────
// Usa "circle algorithm" para distribuir jogos de forma equilibrada por rodada
export function gerarRodadasRoundRobin(jogadores) {
  const n = jogadores.length;
  const lista = [...jogadores];
  // Se ímpar, adiciona BYE
  if (n % 2 !== 0) lista.push('__BYE__');
  const total = lista.length;
  const numRodadas = total - 1;
  const rodadas = [];

  for (let r = 0; r < numRodadas; r++) {
    const jogos = [];
    for (let i = 0; i < total / 2; i++) {
      const a = lista[i];
      const b = lista[total - 1 - i];
      if (a !== '__BYE__' && b !== '__BYE__') {
        jogos.push({ id: r * 100 + i, a, b, placar: null, vencedor: null, tipo: 'pendente' });
      } else {
        const real = a === '__BYE__' ? b : a;
        jogos.push({ id: r * 100 + i, a: real, b: '__BYE__', placar: 'BYE', vencedor: real, tipo: 'bye' });
      }
    }
    rodadas.push({ numero: r + 1, status: 'pendente', geradaEm: null, jogos });
    // Rotaciona: fixa [0], rotaciona o resto
    const pivô = lista[1];
    for (let i = 1; i < total - 1; i++) lista[i] = lista[i + 1];
    lista[total - 1] = pivô;
  }
  return rodadas;
}

// ─── Sorteio com embaralhamento antes do round-robin ──────────────────────
export function sortearLiga(inscricoes, config = {}) {
  const ativos = inscricoes.filter(i => i.status === 'ativo').map(i => i.nome);
  if (ativos.length < 2) throw new Error('São necessários ao menos 2 participantes ativos');

  // Embaralha
  const embaralhados = [...ativos].sort(() => Math.random() - 0.5);

  const rodadas = gerarRodadasRoundRobin(embaralhados);
  return rodadas;
}

// ─── Sorteio de rodada única (para ligas longas — próxima rodada por pontos) ─
// Usa sistema suíço: agrupa jogadores com pontuação similar, sorteia pares
export function sortearProximaRodada(liga) {
  const tabela = calcularTabela(liga);
  const ativos = tabela.filter(p => {
    const insc = liga.inscricoes.find(i => i.nome === p.nome);
    return insc && insc.status === 'ativo';
  });

  if (ativos.length < 2) throw new Error('Não há jogadores suficientes para gerar uma nova rodada');

  // Ordena por pontos decrescente para emparelhar similares
  ativos.sort((a, b) => b.pts - a.pts);

  const jogos = [];
  const usados = new Set();
  let id = 0;

  // Evita rematches recentes se possível
  const historico = new Set();
  for (const rd of liga.rodadas) {
    for (const j of rd.jogos) {
      if (j.tipo !== 'bye') historico.add([j.a, j.b].sort().join('|'));
    }
  }

  // Greedy pairing
  for (let i = 0; i < ativos.length; i++) {
    if (usados.has(ativos[i].nome)) continue;
    let parceiro = null;
    // Tenta achar alguém não usado e sem rematch recente
    for (let j = i + 1; j < ativos.length; j++) {
      if (usados.has(ativos[j].nome)) continue;
      const par = [ativos[i].nome, ativos[j].nome].sort().join('|');
      if (!historico.has(par)) { parceiro = ativos[j]; break; }
    }
    // Se não achou sem rematch, pega o próximo disponível
    if (!parceiro) {
      for (let j = i + 1; j < ativos.length; j++) {
        if (!usados.has(ativos[j].nome)) { parceiro = ativos[j]; break; }
      }
    }

    if (parceiro) {
      jogos.push({ id: id++, a: ativos[i].nome, b: parceiro.nome, placar: null, vencedor: null, tipo: 'pendente' });
      usados.add(ativos[i].nome);
      usados.add(parceiro.nome);
    } else {
      // BYE
      jogos.push({ id: id++, a: ativos[i].nome, b: '__BYE__', placar: 'BYE', vencedor: ativos[i].nome, tipo: 'bye' });
      usados.add(ativos[i].nome);
    }
  }

  const numero = liga.rodadas.length + 1;
  return { numero, status: 'pendente', geradaEm: new Date().toISOString(), jogos };
}

// ─── Cálculo da tabela de classificação ────────────────────────────────────
export function calcularTabela(liga) {
  const cfg = liga.config || {};
  const PTS_V   = cfg.pontosVitoria  ?? 3;
  const PTS_D   = cfg.pontosDerrota  ?? 1;
  const PTS_WO  = cfg.pontosWO       ?? 0;
  const PTS_BYE = cfg.pontosBye      ?? 2;

  const tabela = {};

  const garantir = nome => {
    if (!tabela[nome]) tabela[nome] = { nome, pts: 0, v: 0, d: 0, wo: 0, bye: 0, jogos: 0, aproveitamento: 0 };
    return tabela[nome];
  };

  // Garante que todos os inscritos aparecem mesmo sem jogos
  for (const insc of (liga.inscricoes || [])) {
    if (insc.status === 'ativo') garantir(insc.nome);
  }

  for (const rodada of (liga.rodadas || [])) {
    for (const jogo of (rodada.jogos || [])) {
      if (jogo.tipo === 'bye') {
        const p = garantir(jogo.a);
        p.pts += PTS_BYE; p.bye++; p.jogos++;
        continue;
      }
      if (!jogo.vencedor || jogo.tipo === 'pendente') continue;

      const pa = garantir(jogo.a);
      const pb = garantir(jogo.b);
      pa.jogos++; pb.jogos++;

      const isWO = jogo.tipo === 'wo' || jogo.tipo === 'walkover';

      if (jogo.vencedor === jogo.a) {
        pa.v++; pa.pts += isWO ? PTS_V : PTS_V;
        pb.d++; pb.pts += isWO ? PTS_WO : PTS_D;
        if (isWO) { pa.wo++; }
      } else {
        pb.v++; pb.pts += isWO ? PTS_V : PTS_V;
        pa.d++; pa.pts += isWO ? PTS_WO : PTS_D;
        if (isWO) { pb.wo++; }
      }
    }
  }

  const arr = Object.values(tabela);
  for (const p of arr) {
    const jogosReais = p.v + p.d;
    p.aproveitamento = jogosReais > 0 ? Math.round(100 * p.v / jogosReais) : 0;
  }

  // Critérios de desempate: pts → vitórias → aproveitamento → nome
  arr.sort((a, b) =>
    b.pts - a.pts ||
    b.v - a.v ||
    b.aproveitamento - a.aproveitamento ||
    a.nome.localeCompare(b.nome)
  );

  return arr.map((p, i) => ({ pos: i + 1, ...p }));
}

// ─── Aplicar resultado de um jogo ─────────────────────────────────────────
export function registrarResultado(liga, rodadaIdx, jogoId, { sets, vencedor, tipo }) {
  const rodada = liga.rodadas[rodadaIdx];
  if (!rodada) throw new Error('Rodada não encontrada');
  const jogo = rodada.jogos.find(j => j.id === jogoId);
  if (!jogo) throw new Error('Jogo não encontrado');
  if (jogo.tipo === 'bye') throw new Error('Jogo BYE não pode ter resultado lançado');

  if (vencedor) {
    if (vencedor !== jogo.a && vencedor !== jogo.b) throw new Error('Vencedor inválido');
    jogo.vencedor = vencedor;
    jogo.tipo = tipo || 'wo';
    jogo.placar = tipo === 'wo' ? 'W.O.' : tipo === 'abandono' ? 'ABD.' : '';
  } else if (Array.isArray(sets) && sets.length) {
    // placar no formato "6-4 7-5" ou array [{a,b}]
    let ptsA = 0, ptsB = 0;
    const partes = [];
    for (const s of sets) {
      const ga = Number(s.a ?? s[0] ?? 0);
      const gb = Number(s.b ?? s[1] ?? 0);
      if (ga > gb) ptsA++; else if (gb > ga) ptsB++;
      partes.push(`${ga}-${gb}`);
    }
    jogo.placar = partes.join(' ');
    jogo.vencedor = ptsA > ptsB ? jogo.a : jogo.b;
    jogo.tipo = 'normal';
  } else {
    throw new Error('Informe placar (sets) ou vencedor direto');
  }

  jogo.registradoEm = new Date().toISOString();

  // Verifica se rodada está encerrada
  const pendentes = rodada.jogos.filter(j => j.tipo === 'pendente' && j.b !== '__BYE__');
  if (pendentes.length === 0) rodada.status = 'encerrada';
  else rodada.status = 'em_andamento';

  return jogo;
}

// ─── Verificar se liga pode ser encerrada ──────────────────────────────────
export function podeFinalizar(liga) {
  const ultimaRodada = liga.rodadas[liga.rodadas.length - 1];
  if (!ultimaRodada) return false;
  return ultimaRodada.status === 'encerrada';
}
