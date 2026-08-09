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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');

const GCS_BUCKET = process.env.GCS_BUCKET || '';
const GCS_OBJECT = process.env.GCS_OBJECT || 'db.json';

const DEFAULT = { admins: [], usuarios: [], inscricoes: [], chaves: {}, ranking: { players: {}, arquivados: {} }, campeoes: {}, torneios: [], assinaturas: [], ingressos: [], comandas: [], reservas: [], patrocinadores: [], estoque: {},
  ligas: {}, professores: [], aulas: [], loja: [], vendasLoja: [], cupons: [],
  elo: { players: {} }, gruposEventos: {}, suicos: {}, duplas: {}, socios: [], campanhas: [], pagamentos: [], auditoria: [], agenda: [], cardapio: [], contatos: [], config: {}, partidas_avulsas: [], reservasLoja: [], vendasLoja: [], pedidosLoja: [], tefTransacoes: [], notasFiscais: [], nfceEventos: [], seq: 1 };

function ensureDir(){ fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); }

export function load(){
  ensureDir();
  if(!fs.existsSync(DB_PATH)) return structuredClone(DEFAULT);
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
  try {
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
  } catch(e){
    console.error('Falha ao hidratar do GCS (seguindo com estado local):', e.message);
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

export function save(){
  ensureDir();
  // Escrita atômica: grava em arquivo temporário e faz rename (atômico no mesmo
  // filesystem). Evita arquivo truncado/corrompido se o processo morrer no meio da
  // escrita (deploy/OOM). Mantém um .bak da última versão íntegra antes de sobrescrever.
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_cache, null, 2));
  try { if(fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, DB_PATH + '.bak'); } catch {}
  fs.renameSync(tmp, DB_PATH);
  scheduleUpload();
}

export function nextId(){ const id = _cache.seq++; save(); return id; }

export function reset(){ _cache = structuredClone(DEFAULT); save(); }
