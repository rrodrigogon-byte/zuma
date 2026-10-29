// Vigia de memória do processo.
//
// No Render (plano starter, 512 MB) o V8 não sabe do limite do contêiner: calcula o
// teto do heap pela memória da máquina (~2 GB ou mais) e só faz a coleta completa
// quando chega perto desse teto. Antes disso o contêiner passa de 512 MB e é morto
// (OOM), o que derruba a produção por 1 a 2 minutos. O teto do heap só muda com
// --max-old-space-size na linha de comando, e o comando de início do serviço não
// deve ser trocado (AGENTS.md). Então esta vigia liga a coleta manual do V8 e a
// dispara quando a memória residente passa de uma fração do limite, com intervalo
// mínimo entre coletas. Não toca em dados: só libera o que já é lixo.
import fs from 'node:fs';
import v8 from 'node:v8';
import vm from 'node:vm';

const MB = 1024 * 1024;
const numeroEnv = (nome, padrao) => {
  const valor = Number.parseFloat(process.env[nome] ?? '');
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
};

// Limite real do contêiner (cgroup v2 ou v1). Quando o plano do Render muda (ex.: 512 MB
// para 2 GB), a vigia acompanha sozinha, sem ficar forçando coleta abaixo de um teto antigo.
export function limiteDoConteinerMb(leitor = (caminho) => fs.readFileSync(caminho, 'utf8')) {
  for (const caminho of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const bruto = String(leitor(caminho)).trim();
      if (!/^\d+$/.test(bruto)) continue;
      const mb = Number(bruto) / MB;
      // Valores gigantes significam "sem limite" no cgroup v1.
      if (mb >= 64 && mb < 1024 * 1024) return Math.round(mb);
    } catch { /* sem cgroup: segue para o próximo */ }
  }
  return 0;
}

function limitePadraoMb() {
  const doConteiner = limiteDoConteinerMb();
  if (doConteiner) return doConteiner;
  return process.env.RENDER || process.env.NODE_ENV === 'production' ? 512 : 0;
}

const estado = {
  ativa: false,
  limiteMb: 0,
  gatilhoMb: 0,
  coletas: 0,
  ultimaColetaEm: null,
  ultimaColetaMs: 0,
  maiorRssMb: 0,
  vivoMb: 0,
  motivoInativa: null,
};

function obterColetor() {
  if (typeof globalThis.gc === 'function') return globalThis.gc;
  try {
    v8.setFlagsFromString('--expose-gc');
    const coletor = vm.runInNewContext('gc');
    return typeof coletor === 'function' ? coletor : null;
  } catch {
    return null;
  }
}

export function iniciarVigiaMemoria({
  limiteMb = numeroEnv('KYTTO_MEMORIA_LIMITE_MB', limitePadraoMb()),
  fracao = numeroEnv('KYTTO_MEMORIA_GATILHO', 0.62),
  intervaloMs = 1000,
  minimoEntreColetasMs = 2000,
} = {}) {
  if (estado.ativa) return estado;
  if (process.env.KYTTO_MEMORIA_VIGIA === '0') { estado.motivoInativa = 'desligada'; return estado; }
  if (!limiteMb) { estado.motivoInativa = 'sem_limite'; return estado; }
  const tetoHeapMb = v8.getHeapStatistics().heap_size_limit / MB;
  // Com --max-old-space-size compatível com o contêiner o próprio V8 já coleta a tempo.
  if (tetoHeapMb <= limiteMb * 0.85) { estado.motivoInativa = 'heap_ja_limitado'; return estado; }
  const coletar = obterColetor();
  if (!coletar) { estado.motivoInativa = 'coleta_indisponivel'; return estado; }

  estado.ativa = true;
  estado.limiteMb = limiteMb;
  estado.gatilhoMb = Math.round(limiteMb * fracao);
  const emergenciaMb = limiteMb * 0.82;
  let vivoMb = 0; // heap que sobreviveu à última coleta (dados de verdade, como o banco em memória)
  let proximaPermitida = 0;
  const passo = () => {
    const rssMb = process.memoryUsage.rss() / MB;
    if (rssMb > estado.maiorRssMb) estado.maiorRssMb = Math.round(rssMb);
    const agora = Date.now();
    if (rssMb < estado.gatilhoMb || agora < proximaPermitida) return;
    // Acima do gatilho, só coleta se o heap cresceu (lixo acumulado) desde a última coleta,
    // ou se a memória chegou perto do limite do contêiner.
    const heapMb = process.memoryUsage().heapUsed / MB;
    const cresceu = heapMb - vivoMb > Math.max(24, vivoMb * 0.12);
    if (!cresceu && rssMb < emergenciaMb) return;
    const inicio = performance.now();
    try { coletar(); } catch { return; }
    const duracao = performance.now() - inicio;
    estado.ultimaColetaMs = Math.round(duracao);
    estado.coletas += 1;
    estado.ultimaColetaEm = new Date(agora).toISOString();
    vivoMb = process.memoryUsage().heapUsed / MB;
    estado.vivoMb = Math.round(vivoMb);
    // Coleta cara (heap vivo grande) espaça a próxima para não pesar nas requisições.
    proximaPermitida = agora + Math.max(minimoEntreColetasMs, duracao * 20);
  };
  const relogio = setInterval(passo, intervaloMs);
  relogio.unref?.();
  return estado;
}

/** Números do processo para o diagnóstico (sem dados de clientes). */
export function situacaoMemoria() {
  const uso = process.memoryUsage();
  return {
    rssMb: Math.round(uso.rss / MB),
    heapUsadoMb: Math.round(uso.heapUsed / MB),
    heapTotalMb: Math.round(uso.heapTotal / MB),
    externoMb: Math.round((uso.external + (uso.arrayBuffers || 0)) / MB),
    tetoHeapMb: Math.round(v8.getHeapStatistics().heap_size_limit / MB),
    vigia: { ...estado },
    ativoHaSegundos: Math.round(process.uptime()),
  };
}

iniciarVigiaMemoria();
