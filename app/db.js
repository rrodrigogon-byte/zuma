// Banco simples em arquivo JSON (sem dependências nativas, deploy fácil).
// Em produção pode-se trocar por SQLite/Postgres mantendo a mesma interface.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');

const DEFAULT = { admins: [], usuarios: [], inscricoes: [], chaves: {}, ranking: { players: {} }, campeoes: {}, torneios: [], assinaturas: [], ingressos: [], comandas: [], reservas: [], patrocinadores: [], estoque: {},
  ligas: {}, professores: [], aulas: [], loja: [], vendasLoja: [], cupons: [],
  elo: { players: {} }, gruposEventos: {}, suicos: {}, duplas: {}, socios: [], campanhas: [], pagamentos: [], auditoria: [], agenda: [], seq: 1 };

function ensureDir(){ fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); }

export function load(){
  ensureDir();
  if(!fs.existsSync(DB_PATH)) return structuredClone(DEFAULT);
  try { return { ...structuredClone(DEFAULT), ...JSON.parse(fs.readFileSync(DB_PATH,'utf8')) }; }
  catch(e){ console.error('DB corrompido, recriando:', e.message); return structuredClone(DEFAULT); }
}

let _cache = load();
export function db(){ return _cache; }

export function save(){
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(_cache, null, 2));
}

export function nextId(){ const id = _cache.seq++; save(); return id; }

export function reset(){ _cache = structuredClone(DEFAULT); save(); }
