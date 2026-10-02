// Proteção do banco JSON legado (agenda, clientes, comandas, clube e cobranças da
// barbearia ficam num único arquivo no disco do servidor).
//
// 1. Cópia fora do disco: a cada hora, o arquivo inteiro vai comprimido para o
//    PostgreSQL gerenciado (tabela kytto_json_snapshots, migration 060). Logo após
//    gravar, a cópia é lida de volta, descomprimida, interpretada como JSON e o
//    hash é conferido: toda cópia guardada é uma restauração testada.
// 2. Retenção: 24 cópias de hora em hora, 35 diárias e 20 manuais, dentro de uma
//    cota de espaço (PROTECAO_COPIAS_MAX_MB, padrão 300 MB) para não encher o
//    disco do PostgreSQL, que é o mesmo do Commerce.
// 3. Instância única: o banco JSON só aceita um processo gravando. A instância que
//    obtém a trava (advisory lock do PostgreSQL) é a "líder" e é a única que roda
//    as rotinas automáticas que gravam no JSON. Outra instância fica sem rotinas e
//    o health check acusa a situação.
// 4. Cópias locais diárias comprimidas (db-AAAA-MM-DD.bak.json.gz), 7 dias, só se
//    houver espaço livre no disco.
//
// Nunca registra conteúdo do banco em log: só tamanhos, hashes e horários.
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { createHash } from 'crypto';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export const CHAVE_TRAVA_LIDER = 825410733;
export const RETENCAO = { horario: 24, diario: 35, manual: 20 };
const LIMITE_GZIP_BYTES = 64 * 1024 * 1024;
const RETENCAO_BAK_LOCAL_DIAS = 7;

export function postgresConfigurado(env = process.env) {
  return Boolean(env.DATABASE_URL || env.POSTGRES_URL || (env.DB_HOST && env.DB_USER && env.DB_PASSWORD && env.DB_NAME));
}

export function diaLocal(ms = Date.now(), timeZone = process.env.KYTTO_TIMEZONE || 'America/Cuiaba') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function mensagemErro(error) { return String(error?.code || error?.message || error || 'erro').slice(0, 160); }

export function cotaCopiasBytes(env = process.env) {
  const mb = Number.parseInt(env.PROTECAO_COPIAS_MAX_MB ?? '', 10);
  return (Number.isFinite(mb) && mb > 0 ? mb : 300) * 1024 * 1024;
}

export function criarProtecaoDados({ getPool, caminhoBanco, estadoGravacao = () => ({}), agora = () => Date.now(), env = process.env, log = console } = {}) {
  const cotaBytes = cotaCopiasBytes(env);
  const estado = {
    destino: postgresConfigurado(env) ? 'postgres' : 'nenhum',
    lider: postgresConfigurado(env) ? null : true,
    liderDesde: null,
    outraInstanciaDetectadaEm: null,
    ultimaCopiaEm: null,
    ultimaCopiaId: null,
    ultimaCopiaTipo: null,
    ultimaCopiaBytes: 0,
    ultimaCopiaBytesGzip: 0,
    ultimaCopiaVerificada: false,
    ultimoErro: null,
    ultimoErroEm: null,
    copiasPuladasSemMudanca: 0,
    bakLocaisRemovidos: 0,
  };
  const iniciadoEm = agora();
  let clienteTrava = null;
  let ultimoHash = null;
  let rodando = false;

  function registrarErro(contexto, error) {
    estado.ultimoErro = `${contexto}: ${mensagemErro(error)}`;
    estado.ultimoErroEm = new Date(agora()).toISOString();
    log.error(`[Proteção de dados] ${estado.ultimoErro}`);
  }

  // ── Instância única ────────────────────────────────────────────────────────
  async function disputarLideranca() {
    if (!postgresConfigurado(env)) { estado.lider = true; return true; }
    if (clienteTrava) return true;
    let cliente = null;
    try {
      cliente = await getPool().connect();
      const { rows } = await cliente.query('SELECT pg_try_advisory_lock($1) AS ok', [CHAVE_TRAVA_LIDER]);
      if (rows[0]?.ok) {
        clienteTrava = cliente;
        // Se a conexão cair, a trava é liberada pelo PostgreSQL: disputa de novo.
        cliente.on('error', (error) => {
          registrarErro('conexão da trava de instância única', error);
          try { cliente.release(true); } catch {}
          // Perder a conexão não prova que outra instância assumiu: mantém o estado e a
          // próxima disputa decide (falso só quando o PostgreSQL negar a trava).
          if (clienteTrava === cliente) clienteTrava = null;
        });
        if (!estado.lider) log.log('[Proteção de dados] esta instância é a líder: rotinas automáticas e cópias ligadas.');
        estado.lider = true;
        estado.liderDesde = estado.liderDesde || new Date(agora()).toISOString();
        return true;
      }
      cliente.release();
      if (estado.lider !== false) log.error('[Proteção de dados] OUTRA INSTÂNCIA está ativa com o mesmo banco. O banco JSON aceita uma única instância: mantenha 1 instância no Render. Rotinas automáticas desligadas nesta.');
      estado.lider = false;
      estado.outraInstanciaDetectadaEm = new Date(agora()).toISOString();
      return false;
    } catch (error) {
      if (cliente) { try { cliente.release(true); } catch {} }
      registrarErro('trava de instância única', error);
      // Sem conseguir falar com o PostgreSQL, mantém o estado anterior. No boot
      // (estado desconhecido), assume líder: com 1 instância é o comportamento antigo.
      if (estado.lider === null) estado.lider = true;
      return estado.lider;
    }
  }

  function souLider() { return estado.lider === true; }

  // Roda uma rotina periódica só na instância líder.
  function rotinaDoLider(nome, intervaloMs, fn, { imediata = false } = {}) {
    const executar = async () => {
      if (!souLider()) return;
      try { await fn(); } catch (error) { log.warn(`[Rotina ${nome}] ${mensagemErro(error)}`); }
    };
    if (imediata) setTimeout(executar, 0).unref?.();
    const timer = setInterval(executar, intervaloMs);
    timer.unref?.();
    return timer;
  }

  // ── Cópia para o PostgreSQL ───────────────────────────────────────────────
  async function criarCopia({ tipo = 'horario', forcar = false } = {}) {
    if (!['horario', 'diario', 'manual'].includes(tipo)) throw new Error('tipo de cópia inválido');
    if (estado.destino !== 'postgres') return { ok: false, motivo: 'postgres_nao_configurado' };
    if (!souLider()) return { ok: false, motivo: 'instancia_nao_lider' };
    const arquivo = caminhoBanco();
    if (!fs.existsSync(arquivo)) return { ok: false, motivo: 'banco_inexistente' };
    // O arquivo é trocado por rename atômico e sempre vem de JSON.stringify: a leitura
    // pega uma versão completa. Confere só as bordas (sem um JSON.parse que dobraria a
    // memória com arquivo grande).
    const original = await fs.promises.readFile(arquivo);
    if (original.length < 2 || original[0] !== 0x7b || original[original.length - 1] !== 0x7d) throw new Error('arquivo do banco incompleto');
    const hash = sha256(original);
    if (!forcar && tipo === 'horario' && hash === ultimoHash) {
      estado.copiasPuladasSemMudanca += 1;
      return { ok: true, pulada: true, motivo: 'sem_mudanca' };
    }
    const comprimido = await gzip(original, { level: 6 });
    if (comprimido.length > LIMITE_GZIP_BYTES || comprimido.length > cotaBytes / 4) throw new Error(`cópia comprimida de ${comprimido.length} bytes acima do limite`);
    const pool = getPool();
    const dia = diaLocal(agora());
    const origem = String(env.RENDER_INSTANCE_ID || os.hostname() || '').slice(0, 80);
    const { rows } = await pool.query(
      `INSERT INTO kytto_json_snapshots (tipo, dia_local, bytes_original, bytes_gzip, sha256, origem, conteudo)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7) RETURNING id, criado_em`,
      [tipo, dia, original.length, comprimido.length, hash, origem, comprimido],
    );
    const id = rows[0].id;
    // Restauração conferida: lê de volta, descomprime e compara o hash com o original
    // (que veio de JSON.stringify). Cópia que não confere é apagada.
    try {
      const lido = await pool.query('SELECT conteudo FROM kytto_json_snapshots WHERE id = $1', [id]);
      const restaurado = await gunzip(lido.rows[0].conteudo);
      if (sha256(restaurado) !== hash) throw new Error(`cópia ${id} não confere com o original`);
      await pool.query('UPDATE kytto_json_snapshots SET verificado_em = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    } catch (error) {
      await pool.query('DELETE FROM kytto_json_snapshots WHERE id = $1 AND verificado_em IS NULL', [id]).catch(() => {});
      throw error;
    }
    ultimoHash = hash;
    Object.assign(estado, {
      ultimaCopiaEm: new Date(agora()).toISOString(), ultimaCopiaId: String(id), ultimaCopiaTipo: tipo,
      ultimaCopiaBytes: original.length, ultimaCopiaBytesGzip: comprimido.length, ultimaCopiaVerificada: true,
      ultimoErro: null, ultimoErroEm: null,
    });
    await aplicarRetencao();
    return { ok: true, id: String(id), tipo, bytes: original.length, bytesGzip: comprimido.length, verificada: true };
  }

  async function aplicarRetencao() {
    const pool = getPool();
    await pool.query('DELETE FROM kytto_json_snapshots WHERE verificado_em IS NULL AND criado_em < CURRENT_TIMESTAMP - INTERVAL \'1 hour\'');
    for (const [tipo, manter] of Object.entries(RETENCAO)) {
      await pool.query(
        `DELETE FROM kytto_json_snapshots WHERE tipo = $1 AND id NOT IN (
           SELECT id FROM kytto_json_snapshots WHERE tipo = $1 ORDER BY criado_em DESC, id DESC LIMIT $2)`,
        [tipo, manter],
      );
    }
    // Cota de espaço: remove as mais antigas (horárias, depois manuais, depois
    // diárias) até caber, sempre preservando a cópia mais recente.
    const { rows } = await pool.query(
      `SELECT id, bytes_gzip FROM kytto_json_snapshots
        ORDER BY CASE tipo WHEN 'horario' THEN 0 WHEN 'manual' THEN 1 ELSE 2 END, criado_em ASC, id ASC`,
    );
    let total = rows.reduce((soma, linha) => soma + Number(linha.bytes_gzip), 0);
    const maisRecente = await pool.query('SELECT id FROM kytto_json_snapshots ORDER BY criado_em DESC, id DESC LIMIT 1');
    const preservar = String(maisRecente.rows[0]?.id || '');
    const remover = [];
    for (const linha of rows) {
      if (total <= cotaBytes) break;
      if (String(linha.id) === preservar) continue;
      remover.push(String(linha.id));
      total -= Number(linha.bytes_gzip);
    }
    if (remover.length) await pool.query('DELETE FROM kytto_json_snapshots WHERE id = ANY($1::bigint[])', [remover]);
    estado.espacoUsadoBytes = total;
  }

  // Ciclo de hora em hora: a primeira cópia de cada dia (horário local) é a diária.
  async function ciclo() {
    if (rodando) return { ok: false, motivo: 'em_andamento' };
    rodando = true;
    try {
      await disputarLideranca();
      if (!souLider() || estado.destino !== 'postgres') return { ok: false, motivo: souLider() ? 'postgres_nao_configurado' : 'instancia_nao_lider' };
      const { rows } = await getPool().query(
        "SELECT 1 FROM kytto_json_snapshots WHERE tipo = 'diario' AND dia_local = $1::date AND verificado_em IS NOT NULL LIMIT 1",
        [diaLocal(agora())],
      );
      return await criarCopia({ tipo: rows.length ? 'horario' : 'diario' });
    } catch (error) {
      registrarErro('cópia do banco para o PostgreSQL', error);
      return { ok: false, motivo: 'erro' };
    } finally { rodando = false; }
  }

  async function listarCopias({ limite = 30 } = {}) {
    if (estado.destino !== 'postgres') return [];
    const { rows } = await getPool().query(
      `SELECT id, criado_em, tipo, dia_local, bytes_original, bytes_gzip, sha256, verificado_em
         FROM kytto_json_snapshots ORDER BY criado_em DESC, id DESC LIMIT $1`,
      [Math.min(200, Math.max(1, Number(limite) || 30))],
    );
    return rows.map((linha) => ({ ...linha, id: String(linha.id), sha256: String(linha.sha256).slice(0, 12) }));
  }

  // Lê uma cópia e devolve o JSON restaurado (Buffer), já conferido pelo hash.
  async function lerCopia(id) {
    const { rows } = await getPool().query('SELECT conteudo, sha256 FROM kytto_json_snapshots WHERE id = $1', [String(id)]);
    if (!rows.length) throw new Error('cópia não encontrada');
    const restaurado = await gunzip(rows[0].conteudo);
    if (sha256(restaurado) !== rows[0].sha256) throw new Error('cópia corrompida: hash não confere');
    return restaurado;
  }

  // ── Cópias locais diárias ─────────────────────────────────────────────────
  function espacoLivreBytes(pasta) {
    try { const st = fs.statfsSync(pasta); return Number(st.bavail) * Number(st.bsize); } catch { return Infinity; }
  }

  async function copiaLocalDiaria() {
    const arquivo = caminhoBanco();
    if (!souLider() || !fs.existsSync(arquivo)) return null;
    limparCopiasLocais();
    const destino = arquivo.replace(/\.json$/, '') + '-' + diaLocal(agora()) + '.bak.json.gz';
    try {
      const original = await fs.promises.readFile(arquivo);
      // Reserva espaço para a gravação normal (principal + temporário + .bak).
      if (espacoLivreBytes(path.dirname(arquivo)) < original.length * 4) {
        registrarErro('cópia local diária', new Error('espaço livre insuficiente no disco; cópia local pulada'));
        return null;
      }
      const tmp = destino + '.tmp';
      await fs.promises.writeFile(tmp, await gzip(original, { level: 6 }));
      await fs.promises.rename(tmp, destino);
    } catch (error) { registrarErro('cópia local diária', error); return null; }
    return path.basename(destino);
  }

  function limparCopiasLocais() {
    const arquivo = caminhoBanco();
    const pasta = path.dirname(arquivo);
    const base = path.basename(arquivo).replace(/\.json$/, '');
    const padrao = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{4}-\\d{2}-\\d{2})\\.bak\\.json(\\.gz)?$`);
    const limite = diaLocal(agora() - RETENCAO_BAK_LOCAL_DIAS * 86400000);
    let removidos = 0;
    try {
      for (const nome of fs.readdirSync(pasta)) {
        const m = nome.match(padrao);
        if (m && m[1] < limite) { fs.unlinkSync(path.join(pasta, nome)); removidos += 1; }
      }
    } catch (error) { registrarErro('limpeza das cópias locais', error); }
    estado.bakLocaisRemovidos += removidos;
    return removidos;
  }

  // ── Estado para o health check e o painel ─────────────────────────────────
  function situacao() {
    const gravacao = estadoGravacao() || {};
    const problemas = [];
    if (gravacao.ultimoErro) problemas.push('falha_gravacao_local');
    if (estado.lider === false) problemas.push('outra_instancia_ativa');
    if (estado.destino === 'nenhum') problemas.push('sem_copia_externa');
    if (estado.destino === 'postgres') {
      // A diária nunca é pulada: sem cópia em 26 h (ou 2 h após o boot), está atrasada.
      const referencia = estado.ultimaCopiaEm ? Date.parse(estado.ultimaCopiaEm) : iniciadoEm - 24 * 3600000;
      if (souLider() && agora() - referencia > 26 * 3600000) problemas.push('copia_externa_atrasada');
      if (estado.ultimoErro) problemas.push('falha_copia_externa');
    }
    return { status: problemas.length ? 'degradada' : 'ok', problemas, instancia: { lider: estado.lider, liderDesde: estado.liderDesde, outraInstanciaDetectadaEm: estado.outraInstanciaDetectadaEm },
      copiaExterna: { destino: estado.destino, ultimaCopiaEm: estado.ultimaCopiaEm, ultimaCopiaId: estado.ultimaCopiaId, ultimaCopiaTipo: estado.ultimaCopiaTipo,
        ultimaCopiaBytes: estado.ultimaCopiaBytes, ultimaCopiaBytesGzip: estado.ultimaCopiaBytesGzip, verificada: estado.ultimaCopiaVerificada,
        copiasPuladasSemMudanca: estado.copiasPuladasSemMudanca, retencao: RETENCAO, cotaBytes, espacoUsadoBytes: estado.espacoUsadoBytes ?? null, ultimoErro: estado.ultimoErro, ultimoErroEm: estado.ultimoErroEm },
      gravacaoLocal: gravacao, copiasLocais: { retencaoDias: RETENCAO_BAK_LOCAL_DIAS, removidas: estado.bakLocaisRemovidos } };
  }

  // ── Agenda ────────────────────────────────────────────────────────────────
  function iniciar({ intervaloCopiaMs = 60 * 60 * 1000, intervaloTravaMs = 60 * 1000 } = {}) {
    disputarLideranca().then(() => ciclo()).catch((error) => registrarErro('início', error));
    const trava = setInterval(() => { disputarLideranca().catch(() => {}); }, intervaloTravaMs);
    trava.unref?.();
    const copia = setInterval(() => { ciclo().catch(() => {}); }, intervaloCopiaMs);
    copia.unref?.();
    // Cópia local diária às 03h (horário do servidor), como antes, agora com retenção.
    const proxima = new Date(agora()); proxima.setHours(3, 0, 0, 0);
    if (proxima.getTime() <= agora()) proxima.setDate(proxima.getDate() + 1);
    const local = setTimeout(function tick() {
      copiaLocalDiaria().catch(() => {});
      setTimeout(tick, 24 * 60 * 60 * 1000).unref?.();
    }, Math.max(0, proxima.getTime() - agora()));
    local.unref?.();
    return { parar() { clearInterval(trava); clearInterval(copia); clearTimeout(local); } };
  }

  async function encerrar() {
    if (clienteTrava) {
      try { await clienteTrava.query('SELECT pg_advisory_unlock($1)', [CHAVE_TRAVA_LIDER]); } catch {}
      try { clienteTrava.release(); } catch {}
      clienteTrava = null;
    }
  }

  return { disputarLideranca, souLider, rotinaDoLider, criarCopia, ciclo, listarCopias, lerCopia, copiaLocalDiaria, limparCopiasLocais, situacao, iniciar, encerrar };
}
