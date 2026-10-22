// Banco simples em arquivo JSON (sem dependências nativas, deploy fácil).
// Em produção pode-se trocar por SQLite/Postgres mantendo a mesma interface.
//
// PERSISTÊNCIA NO CLOUD RUN: o filesystem do contêiner é efêmero — o db.json é
// perdido a cada deploy/scale-to-zero. Para durabilidade, replicamos o arquivo
// para um bucket do Google Cloud Storage quando GCS_BUCKET está definido:
//   - hydrate(): baixa o db.json do GCS no boot (antes de servir requisições);
//   - save():   após gravar localmente, agenda upload (debounced) para o GCS.
// Sem GCS_BUCKET o comportamento é idêntico ao anterior (local/Render com disco).
// IMPORTANTE: com GCS, o serviço DEVE rodar com max-instances=1 (escrita única);
// múltiplas instâncias gravando o mesmo objeto causariam last-write-wins.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertDurableLegacyJson } from './core/legacy-json-boot-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
assertDurableLegacyJson();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');

const GCS_BUCKET = process.env.GCS_BUCKET || '';
const GCS_OBJECT = process.env.GCS_OBJECT || 'db.json';

// Avaliações são escritas no JSON legado. No Render, não aceitar respostas
// em PRD se DB_PATH apontar ao filesystem efêmero (ou se o disco não estiver
// efetivamente montado). Uma confirmação falsa perderia a resposta no deploy.
export function armazenamentoAvaliacaoDuravel({ ambiente = process.env.NODE_ENV, arquivo = DB_PATH, montagens } = {}) {
  if (ambiente !== 'production') return true;
  if (!path.resolve(arquivo).startsWith('/var/data/')) return false;
  try {
    const info = montagens ?? fs.readFileSync('/proc/self/mountinfo', 'utf8');
    return info.split('\n').some((linha) => linha.split(' ')[4] === '/var/data');
  } catch { return false; }
}

const DEFAULT = { admins: [], usuarios: [], inscricoes: [], chaves: {}, ranking: { players: {}, arquivados: {} }, campeoes: {}, torneios: [], assinaturas: [], ingressos: [], comandas: [], reservas: [], patrocinadores: [], estoque: {},
  ligas: {}, professores: [], aulas: [], loja: [], vendasLoja: [], cupons: [], passwordResets: [],
  elo: { players: {} }, gruposEventos: {}, suicos: {}, duplas: {}, socios: [], campanhas: [], pagamentos: [], auditoria: [], agenda: [], cardapio: [], contatos: [], config: {}, partidas_avulsas: [], reservasLoja: [], vendasLoja: [], pedidosLoja: [], tefTransacoes: [], notasFiscais: [], nfceEventos: [], seq: 1 };

function ensureDir(){ fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); }

export function load(){
  ensureDir();
  if(!fs.existsSync(DB_PATH)){
    // Sem o arquivo principal, tenta a última cópia íntegra antes de começar vazio:
    // um processo interrompido entre gravações nunca deve virar "banco zerado".
    const bak = DB_PATH + '.bak';
    if(fs.existsSync(bak)){
      try {
        const d = { ...structuredClone(DEFAULT), ...JSON.parse(fs.readFileSync(bak,'utf8')) };
        console.error('DB principal ausente: recuperado da cópia .bak');
        return d;
      } catch(e){ console.error('DB principal ausente e .bak ilegível:', e.message); }
    }
    return structuredClone(DEFAULT);
  }
  try { return { ...structuredClone(DEFAULT), ...JSON.parse(fs.readFileSync(DB_PATH,'utf8')) }; }
  catch(e){
    console.error('DB corrompido:', e.message);
    // Antes de recriar do zero (perda total), tenta o backup .bak da última gravação boa.
    try {
      const bak = DB_PATH + '.bak';
      if(fs.existsSync(bak)){
        const d = { ...structuredClone(DEFAULT), ...JSON.parse(fs.readFileSync(bak,'utf8')) };
        console.error('DB recuperado do backup .bak');
        return d;
      }
    } catch(e2){ console.error('backup .bak também ilegível:', e2.message); }
    return structuredClone(DEFAULT);
  }
}

let _cache = load();
export function db(){ return _cache; }

// ── Replicação para Google Cloud Storage (durabilidade no Cloud Run) ──────────
// Dependência (@google-cloud/storage) carregada sob demanda: só é importada quando
// GCS_BUCKET está definido, então local/testes não precisam dela instalada.
let _hydrated = !GCS_BUCKET;   // sem GCS já está "hidratado" (nada a baixar)
let _bucket = null;
let _uploadTimer = null;
let _uploading = false, _dirtyDuringUpload = false;

async function gcsBucket(){
  if(_bucket) return _bucket;
  const { Storage } = await import('@google-cloud/storage');
  _bucket = new Storage().bucket(GCS_BUCKET);
  return _bucket;
}

// Baixa o db.json do GCS (se existir) por cima do arquivo local e recarrega o
// cache. Chamar UMA vez no boot, antes do app.listen. Tolerante a falha: em erro
// segue com o estado local (o primeiro save() recria o objeto no bucket).
export async function hydrate(){
  if(!GCS_BUCKET){ _hydrated = true; return false; }
  // Falha ao ler o estado durável não pode liberar uploads: o estado local (vazio ou de
  // seed) sobrescreveria o bucket no primeiro save(). Tenta de novo e, se continuar
  // falhando, interrompe o boot para a plataforma manter a versão anterior no ar.
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await hydrateOnce();
      if (result !== null) return result;
    } catch (e) {
      lastError = e;
      console.error(`Falha ao hidratar do GCS (tentativa ${attempt}/3):`, e.message);
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }
  if (lastError) {
    console.error('Estado durável indisponível: uploads para o GCS ficam desligados e o boot é interrompido.');
    throw Object.assign(new Error('GCS_HYDRATE_FAILED'), { cause: lastError });
  }
  _hydrated = true;
  return false;
}

async function hydrateOnce(){
  {
    const file = (await gcsBucket()).file(GCS_OBJECT);
    const [exists] = await file.exists();
    if(exists){
      ensureDir();
      await file.download({ destination: DB_PATH });
      _cache = load();
      _hydrated = true;
      console.log(`DB hidratado de gs://${GCS_BUCKET}/${GCS_OBJECT}`);
      return true;
    }
    console.log(`GCS gs://${GCS_BUCKET}/${GCS_OBJECT} ainda não existe — será criado no primeiro save()`);
  }
  _hydrated = true;   // libera uploads dos próximos save()
  return false;
}

function scheduleUpload(){
  if(!GCS_BUCKET || !_hydrated || _uploadTimer) return;
  // debounce: agrupa rajadas de save() (ex.: nextId()+save()) num único upload.
  _uploadTimer = setTimeout(runUpload, 1500);
}

async function runUpload(){
  _uploadTimer = null;
  if(_uploading){ _dirtyDuringUpload = true; return; }
  _uploading = true;
  try {
    await (await gcsBucket()).upload(DB_PATH, { destination: GCS_OBJECT, resumable:false, metadata:{ cacheControl:'no-store' } });
  } catch(e){
    console.error('Falha ao subir DB para o GCS (re-tenta no próximo save):', e.message);
    _dirtyDuringUpload = true;
  } finally {
    _uploading = false;
    if(_dirtyDuringUpload){ _dirtyDuringUpload = false; scheduleUpload(); }
  }
}

// Flush imediato — chamar no encerramento (SIGTERM) para não perder o último save.
export async function flush(){
  if(!GCS_BUCKET) return;
  if(_uploadTimer){ clearTimeout(_uploadTimer); _uploadTimer = null; }
  await runUpload();
}

// ── Gravação local ────────────────────────────────────────────────────────────
// Escrita atômica: grava num temporário (com fsync periódico) e troca pelo arquivo
// principal com rename (atômico no mesmo filesystem). O JSON é
// compacto (sem indentação): o arquivo fica menor e a serialização mais rápida.
// O backup da última versão íntegra é renovado no máximo a cada 5 minutos. Hard
// links preservam o snapshot anterior sem copiar o arquivo inteiro; em filesystems
// que não os suportam, usa-se uma cópia temporária com rename atômico.
const _bakIntervalo = Number.parseInt(process.env.DB_BAK_INTERVAL_MS ?? '', 10);
const BAK_INTERVALO_MS = Number.isFinite(_bakIntervalo) && _bakIntervalo >= 0 ? _bakIntervalo : 5 * 60 * 1000;
// fsync é caro com arquivo grande e várias gravações por requisição: força o disco no
// máximo a cada 30 s (o conteúdo já está no cache do sistema; só uma queda do host
// perderia a janela). Um processo que morre não perde nada: o rename já aconteceu.
const FSYNC_INTERVALO_MS = 30 * 1000;
let _ultimoFsync = 0;
let _avisoFallbackBackup = false;
const GRAVACAO_LENTA_MS = 250;
const _metricas = { gravacoes: 0, ultimaGravacaoEm: null, ultimaDuracaoMs: 0, maiorDuracaoMs: 0, tamanhoBytes: 0, ultimoErro: null, ultimoErroEm: null, gravacoesLentas: 0, ultimoBakEm: 0 };

function escreverArquivo(arquivo, conteudo){
  const fd = fs.openSync(arquivo, 'w');
  try {
    fs.writeSync(fd, conteudo);
    const agora = Date.now();
    if(agora - _ultimoFsync >= FSYNC_INTERVALO_MS){ fs.fsyncSync(fd); _ultimoFsync = agora; }
  } finally { fs.closeSync(fd); }
}

function renovarBackup(){
  const backup = DB_PATH + '.bak';
  const temporario = backup + '.tmp';
  try {
    fs.rmSync(temporario, { force: true });
    try {
      fs.linkSync(DB_PATH, temporario);
      fs.renameSync(temporario, backup);
      return;
    } catch (linkError) {
      fs.rmSync(temporario, { force: true });
      if (!_avisoFallbackBackup) {
        console.warn('[DB] hard link indisponível para backup; usando cópia temporária.', linkError?.code || 'erro');
        _avisoFallbackBackup = true;
      }
    }
    fs.copyFileSync(DB_PATH, temporario);
    fs.renameSync(temporario, backup);
  } catch (error) {
    try { fs.rmSync(temporario, { force: true }); } catch {}
    throw error;
  }
}

export function save(){
  const inicio = Date.now();
  try {
    ensureDir();
    const conteudo = JSON.stringify(_cache);
    const tmp = DB_PATH + '.tmp';
    escreverArquivo(tmp, conteudo);
    if(inicio - _metricas.ultimoBakEm >= BAK_INTERVALO_MS && fs.existsSync(DB_PATH)){
      try { renovarBackup(); _metricas.ultimoBakEm = inicio; }
      catch(e){ console.error('[DB] falha ao renovar a cópia .bak:', e.message); }
    }
    fs.renameSync(tmp, DB_PATH);
    const duracao = Date.now() - inicio;
    _metricas.gravacoes += 1;
    _metricas.ultimaGravacaoEm = new Date().toISOString();
    _metricas.ultimaDuracaoMs = duracao;
    _metricas.maiorDuracaoMs = Math.max(_metricas.maiorDuracaoMs, duracao);
    _metricas.tamanhoBytes = Buffer.byteLength(conteudo);
    _metricas.ultimoErro = null;
    if(duracao >= GRAVACAO_LENTA_MS){
      _metricas.gravacoesLentas += 1;
      if(_metricas.gravacoesLentas % 20 === 1) console.warn(`[DB] gravação lenta: ${duracao} ms para ${(_metricas.tamanhoBytes / 1048576).toFixed(1)} MB`);
    }
  } catch(e){
    _metricas.ultimoErro = String(e?.code || e?.message || e).slice(0, 120);
    _metricas.ultimoErroEm = new Date().toISOString();
    console.error('[DB] falha ao gravar o banco local:', _metricas.ultimoErro);
    throw e;
  }
  scheduleUpload();
}

// Estado da gravação local para o health check e o painel (sem dados de clientes).
export function estadoGravacao(){
  return { arquivo: path.basename(DB_PATH), ...(_metricas.ultimoBakEm ? { ultimoBakEm: new Date(_metricas.ultimoBakEm).toISOString() } : {}),
    gravacoes: _metricas.gravacoes, ultimaGravacaoEm: _metricas.ultimaGravacaoEm, ultimaDuracaoMs: _metricas.ultimaDuracaoMs,
    maiorDuracaoMs: _metricas.maiorDuracaoMs, gravacoesLentas: _metricas.gravacoesLentas, tamanhoBytes: _metricas.tamanhoBytes,
    ultimoErro: _metricas.ultimoErro, ultimoErroEm: _metricas.ultimoErroEm, replicacaoGcs: Boolean(GCS_BUCKET) };
}

export function caminhoBanco(){ return DB_PATH; }

// Restauração: troca o estado em memória por uma cópia já conferida e grava.
// Usada só pela rota de restauração da administração da plataforma, que antes
// guarda uma cópia do estado atual (a restauração pode ser desfeita).
export function substituirBanco(estado){
  if(!estado || typeof estado !== 'object' || Array.isArray(estado)) throw new Error('estado inválido para restauração');
  const anterior = _cache;
  _cache = { ...structuredClone(DEFAULT), ...estado };
  try { save(); }
  catch(e){ _cache = anterior; throw e; }  // memória e disco nunca divergem
  return _cache;
}

export function nextId({ persist = true } = {}){
  const id = _cache.seq++;
  if(persist) save();
  return id;
}

export function reset(){ _cache = structuredClone(DEFAULT); save(); }
