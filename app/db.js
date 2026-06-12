// Banco simples em arquivo JSON (sem dependências nativas, deploy fácil).
// Em produção pode-se trocar por SQLite/Postgres mantendo a mesma interface.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');

const DEFAULT = { admins: [], usuarios: [], inscricoes: [], chaves: {}, ranking: { players: {} }, campeoes: {}, torneios: [], assinaturas: [], ingressos: [], comandas: [], reservas: [], patrocinadores: [], estoque: {},
  ligas: {}, professores: [], aulas: [], loja: [], vendasLoja: [], cupons: [],
  elo: { players: {} }, gruposEventos: {}, suicos: {}, duplas: {}, socios: [], campanhas: [], pagamentos: [], auditoria: [], agenda: [], cardapio: [], contatos: [], config: {}, seq: 1 };

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

export function save(){
  ensureDir();
  // Escrita atômica: grava em arquivo temporário e faz rename (atômico no mesmo
  // filesystem). Evita arquivo truncado/corrompido se o processo morrer no meio da
  // escrita (deploy/OOM). Mantém um .bak da última versão íntegra antes de sobrescrever.
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_cache, null, 2));
  try { if(fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, DB_PATH + '.bak'); } catch {}
  fs.renameSync(tmp, DB_PATH);
}

export function nextId(){ const id = _cache.seq++; save(); return id; }

export function reset(){ _cache = structuredClone(DEFAULT); save(); }
