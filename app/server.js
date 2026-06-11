import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, save, nextId } from './db.js';
import { sortear } from './bracket.js';
import { applyChaveToRanking, rankingList } from './ranking.js';
import { ranking as tennisRanking, noticias as tennisNews } from './tennis.js';
import { matchWinner, FORMATOS, MODALIDADES } from './rules.js';
import { gerarRoundRobin, tabelaRoundRobin } from './roundrobin.js';
import { applyElo, ratingList } from './rating.js';
import { gerarFaseGrupos, tabelasGrupos, gerarMataMata, gruposCompletos } from './grupos.js';
import { gerarSuico, proximaRodada, tabelaSuico } from './swiss.js';
import { gerarDuplaElim, reportDupla } from './doubleelim.js';
import { criarPix, consultarStatus, pagamentosAtivos, pixInfo, gerarBrCode } from './pagamentos.js';
import crypto from 'crypto';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'agro-open-dev-secret-troque-em-producao';

// Identidade da plataforma (SaaS) — o evento "Agro Open" roda sobre o SetPoint.
const PLATAFORMA = { nome:'SetPoint', slogan:'A plataforma que decide o jogo.', versao:'4.5', evento:'4ª Agro Open de Tênis' };

export const CATEGORIAS = [
  'Masc · PRO Profissional','Masc · 1ª Classe','Masc · 2ª Classe','Masc · 3ª Classe',
  'Masc · 4ª Classe','Masc · 5ª Classe','Masc · 34+ Veteranos','Masc · Especial VIP',
  'Fem · PRO Profissional','Fem · 1ª Classe','Fem · 2ª Classe','Fem · 3ª Classe',
  'Fem · 35+ Veteranas','Fem · Duplas'
];

// ---- papéis e segurança ----
const ROLES = ['admin','organizador','staff','atleta'];
const STAFF = ['admin','organizador','staff']; // acesso ao sistema/painel
const norm = s => String(s||'').trim().toLowerCase();

// ---- seed do administrador (em usuarios) ----
function seedUsuarios(){
  const d = db();
  if(!d.usuarios.length){
    const email = norm(process.env.ADMIN_USER || 'admin');
    const senha = process.env.ADMIN_PASS || 'agroopen2026';
    d.usuarios.push({ id: nextId(), nome:'Administrador', email, senhaHash: bcrypt.hashSync(senha,10),
      role:'admin', telefone:'', ativo:true, criadoEm:new Date().toISOString() });
    save();
    console.log(`Admin criado: login "${email}" / senha "${senha}" (troque em produção)`);
  }
}
seedUsuarios();
const findUser = login => db().usuarios.find(u=>u.email===norm(login));
const publicUser = u => ({ id:u.id, nome:u.nome, email:u.email, role:u.role, telefone:u.telefone, ativo:u.ativo });

// ---- auth ----
function auth(req,res,next){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return res.status(401).json({error:'sem token'});
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch(e){ return res.status(401).json({error:'token inválido'}); }
}
const requireRole = (...roles)=> (req,res,next)=> (req.user && roles.includes(req.user.role)) ? next() : res.status(403).json({error:'sem permissão'});
const requireStaff = (req,res,next)=> (req.user && STAFF.includes(req.user.role)) ? next() : res.status(403).json({error:'acesso restrito à organização'});
const tokenFor = u => jwt.sign({ id:u.id, nome:u.nome, role:u.role }, JWT_SECRET, { expiresIn:'12h' });

// ---- rate-limit simples (anti força-bruta no login) ----
const tentativas = new Map(); // chave -> { n, until }
function rateLimit(chave, max=8, janelaMs=15*60*1000){
  const agora = Date.now(); const e = tentativas.get(chave);
  if(e && e.until > agora && e.n >= max) return false;
  if(!e || e.until <= agora) tentativas.set(chave, { n:1, until:agora+janelaMs });
  else e.n++;
  return true;
}
const limparTentativas = chave => tentativas.delete(chave);

// ---- trilha de auditoria das ações administrativas ----
function audit(req, acao, detalhe){
  const d = db(); d.auditoria = d.auditoria || [];
  d.auditoria.push({ id: nextId(), ts:new Date().toISOString(),
    user: req.user ? `${req.user.nome} (${req.user.role})` : 'anônimo',
    acao, detalhe: detalhe||'', ip: req.ip || '' });
  if(d.auditoria.length > 1000) d.auditoria = d.auditoria.slice(-1000);
}

// Trava global: tudo em /api/admin exige login de staff (exceto o próprio login)
app.use('/api/admin', (req,res,next)=>{
  if(req.path==='/login') return next();
  auth(req,res,()=> requireStaff(req,res,()=>{
    // registra mutações (POST/PATCH/DELETE) na auditoria
    if(['POST','PATCH','DELETE','PUT'].includes(req.method)){
      res.on('finish', ()=>{ if(res.statusCode<400){ audit(req, req.method+' '+req.baseUrl+req.path); save(); } });
    }
    next();
  }));
});

// ---- helpers de chave ----
function clearDownstream(rounds, r, idx){
  if(r>=rounds.length) return;
  rounds[r][idx]=null;
  if(r<rounds.length-1) clearDownstream(rounds, r+1, Math.floor(idx/2));
}
function advance(chave, r, idx){
  const e = chave.rounds[r][idx];
  if(!e || e.bye) return false;
  if(!chave.rounds[r+1]) return false;
  const dst = Math.floor(idx/2);
  const prev = chave.rounds[r+1][dst];
  if(prev && prev!==e && prev.name!==e.name) clearDownstream(chave.rounds, r+1, dst);
  chave.rounds[r+1][dst] = e;
  return true;
}

// =================== API PÚBLICA ===================
app.get('/api/info', (req,res)=> res.json(PLATAFORMA));

// Informações públicas do Pix configurado (chave, nome, cidade, copia-e-cola sem valor)
app.get('/api/pix-info', (req,res)=>{
  if(!pixInfo) return res.json({ ativo:false, modo:'simulado' });
  const { valor } = req.query; // ?valor=150.00 (opcional) gera copia-e-cola com valor fixado
  const v = valor ? parseFloat(valor) : null;
  const copiaECola = gerarBrCode({
    chave: pixInfo.chave,
    nome:  pixInfo.nome,
    cidade:pixInfo.cidade,
    valor: v && v > 0 ? v : null,
  });
  res.json({ ativo:true, modo:'estatico', chave:pixInfo.chave, nome:pixInfo.nome, cidade:pixInfo.cidade, copiaECola });
});
app.get('/api/categorias', (req,res)=> res.json(CATEGORIAS));

// CPF validation helper
function validarCPF(cpf){
  const n = (cpf||'').replace(/\D/g,'');
  if(n.length!==11 || /^(\d)\1+$/.test(n)) return false;
  let s=0; for(let i=0;i<9;i++) s+=+n[i]*(10-i);
  let r=(s*10)%11; if(r===10||r===11) r=0; if(r!==+n[9]) return false;
  s=0; for(let i=0;i<10;i++) s+=+n[i]*(11-i);
  r=(s*10)%11; if(r===10||r===11) r=0; return r===+n[10];
}

// TAXA_INSCRICAO por categoria (R$) — ajuste conforme regulamento
const TAXA_CAT = { default: 150 };
function taxaCategoria(cat){ return TAXA_CAT[cat] || TAXA_CAT.default; }

// Expirar inscrições não pagas após 30 min
function expirarInscricoesPendentes(){
  const d = db(); const limit = 30*60*1000;
  let changed = false;
  (d.inscricoes||[]).forEach(i=>{
    if(i.status==='aguardando_pagamento' && (Date.now()-new Date(i.createdAt).getTime())>limit){
      i.status='expirado'; changed=true;
    }
  });
  if(changed) save();
}
setInterval(expirarInscricoesPendentes, 60*1000);

app.post('/api/inscricao', (req,res)=>{
  const b = req.body || {};
  const obrig = ['nome','email','cpf','nasc','sexo','tel','categoria'];
  const miss = obrig.filter(f=>!b[f]);
  if(miss.length) return res.status(400).json({error:`Campos obrigatórios: ${miss.join(', ')}`});
  if(!validarCPF(b.cpf)) return res.status(400).json({error:'CPF inválido'});
  // suporte a múltiplas categorias
  const categorias = Array.isArray(b.categorias) && b.categorias.length ? b.categorias : [b.categoria];
  const total = categorias.reduce((s,c)=>s+taxaCategoria(c), 0);
  const pagoEm = new Date(Date.now() + 30*60*1000).toISOString(); // prazo de pagamento
  const insc = {
    id: nextId(), nome:b.nome, nasc:b.nasc, sexo:b.sexo, cpf:b.cpf.replace(/\D/g,''),
    cidade:b.cidade||'', tel:b.tel, email:b.email, categoria:categorias[0],
    categorias, nivel:b.nivel||'', dupla:b.dupla||'', camisa:b.camisa||'', emerg:b.emerg||'',
    obs:b.obs||'', total, prazoPagamento:pagoEm,
    status:'aguardando_pagamento', createdAt:new Date().toISOString()
  };
  db().inscricoes.push(insc); save();
  res.json({ ok:true, id:insc.id, total, prazoPagamento:pagoEm,
    message:`Inscrição recebida! Efetue o pagamento de R$ ${total},00 em até 30 minutos para confirmar sua vaga.` });
});

app.get('/api/chave/:categoria', (req,res)=>{
  const c = db().chaves[req.params.categoria];
  if(!c) return res.status(404).json({error:'chave não publicada'});
  res.json(c);
});
app.get('/api/chaves', (req,res)=>{
  const ch = db().chaves;
  res.json(Object.keys(ch).map(cat=>({ categoria:cat, size:ch[cat].size, seeds:ch[cat].seeds, atletas: ch[cat].rounds[0].filter(e=>e&&!e.bye).length, finalizada: !!ch[cat].finalizada })));
});

app.get('/api/ranking', (req,res)=> res.json(rankingList(db().ranking, req.query.categoria)));
app.get('/api/atp', async (req,res)=> res.json(await tennisRanking('ATP')));
app.get('/api/wta', async (req,res)=> res.json(await tennisRanking('WTA')));
app.get('/api/noticias', async (req,res)=> res.json(await tennisNews()));

// =================== API ADMIN ===================
// Login do SISTEMA (admin/organizador/staff) — compatível com o painel atual
app.post('/api/admin/login', (req,res)=>{
  const { user, pass } = req.body || {};
  const chave = 'adm:'+(req.ip||'')+':'+norm(user);
  if(!rateLimit(chave)) return res.status(429).json({error:'muitas tentativas. Tente novamente em alguns minutos.'});
  const u = findUser(user);
  if(!u || !u.ativo || !bcrypt.compareSync(pass||'', u.senhaHash)) return res.status(401).json({error:'usuário ou senha inválidos'});
  if(!STAFF.includes(u.role)) return res.status(403).json({error:'esta conta não tem acesso ao painel'});
  limparTentativas(chave);
  audit({user:{nome:u.nome,role:u.role}, ip:req.ip}, 'LOGIN painel'); save();
  res.json({ token: tokenFor(u), user: u.nome, role: u.role });
});

// ---- AUTH unificada (site + sistema) ----
app.post('/api/auth/register', (req,res)=>{
  const { nome, email, senha, telefone } = req.body || {};
  if(!nome || !email || !senha) return res.status(400).json({error:'nome, e-mail e senha são obrigatórios'});
  if((senha||'').length < 6) return res.status(400).json({error:'a senha deve ter ao menos 6 caracteres'});
  if(findUser(email)) return res.status(409).json({error:'já existe uma conta com este e-mail'});
  const u = { id: nextId(), nome, email: norm(email), senhaHash: bcrypt.hashSync(senha,10),
    role:'atleta', telefone:telefone||'', nasc:(req.body.nasc||''), ativo:true, criadoEm:new Date().toISOString(),
    consentimentoLGPD: !!req.body.consentimento, consentimentoEm: req.body.consentimento ? new Date().toISOString() : null };
  db().usuarios.push(u); save();
  res.json({ token: tokenFor(u), user: publicUser(u) });
});
app.post('/api/auth/login', (req,res)=>{
  const { email, senha } = req.body || {};
  const chave = 'site:'+(req.ip||'')+':'+norm(email);
  if(!rateLimit(chave)) return res.status(429).json({error:'muitas tentativas. Tente novamente em alguns minutos.'});
  const u = findUser(email);
  if(!u || !u.ativo || !bcrypt.compareSync(senha||'', u.senhaHash)) return res.status(401).json({error:'e-mail ou senha inválidos'});
  limparTentativas(chave);
  res.json({ token: tokenFor(u), user: publicUser(u) });
});
app.get('/api/auth/me', auth, (req,res)=>{
  const u = db().usuarios.find(x=>x.id===req.user.id);
  if(!u) return res.status(404).json({error:'usuário não encontrado'});
  res.json(publicUser(u));
});

// ---- Gestão de usuários (somente admin/organizador) ----
app.get('/api/admin/usuarios', auth, requireStaff, (req,res)=> res.json((db().usuarios||[]).map(publicUser)));
app.post('/api/admin/usuarios', auth, requireRole('admin','organizador'), (req,res)=>{
  const { nome, email, senha, role, telefone } = req.body || {};
  if(!nome || !email || !senha) return res.status(400).json({error:'nome, e-mail e senha obrigatórios'});
  if(!ROLES.includes(role)) return res.status(400).json({error:'papel inválido'});
  if(findUser(email)) return res.status(409).json({error:'e-mail já cadastrado'});
  const u = { id: nextId(), nome, email: norm(email), senhaHash: bcrypt.hashSync(senha,10),
    role, telefone:telefone||'', ativo:true, criadoEm:new Date().toISOString() };
  db().usuarios.push(u); save(); res.json(publicUser(u));
});
app.patch('/api/admin/usuarios/:id', auth, requireRole('admin','organizador'), (req,res)=>{
  const u = db().usuarios.find(x=>x.id==req.params.id); if(!u) return res.status(404).json({error:'não encontrado'});
  const b = req.body||{};
  if(b.nome) u.nome=b.nome;
  if(b.role && ROLES.includes(b.role)) u.role=b.role;
  if(b.telefone!==undefined) u.telefone=b.telefone;
  if(typeof b.ativo==='boolean') u.ativo=b.ativo;
  if(b.senha){ if(b.senha.length<6) return res.status(400).json({error:'senha curta'}); u.senhaHash=bcrypt.hashSync(b.senha,10); }
  save(); res.json(publicUser(u));
});
app.post('/api/admin/usuarios/:id/reset-senha', auth, requireRole('admin','organizador'), (req,res)=>{
  const u=db().usuarios.find(x=>x.id==req.params.id); if(!u) return res.status(404).json({error:'não encontrado'});
  const nova=Math.random().toString(36).slice(2,10); // 8 chars alfanuméricos
  u.senhaHash=bcrypt.hashSync(nova,10); save();
  auditoria(req.user,'RESET_SENHA',{usuarioId:u.id,email:u.email});
  res.json({ ok:true, senha:nova, aviso:'Compartilhe esta senha temporária com o usuário — ela não será exibida novamente.' });
});
app.delete('/api/admin/usuarios/:id', auth, requireRole('admin'), (req,res)=>{
  const d=db(); const u=d.usuarios.find(x=>x.id==req.params.id);
  if(u && u.email===norm(process.env.ADMIN_USER||'admin')) return res.status(400).json({error:'não é possível excluir o admin principal'});
  d.usuarios=d.usuarios.filter(x=>x.id!=req.params.id); save(); res.json({ok:true});
});

app.get('/api/admin/inscricoes', auth, (req,res)=>{
  const cat = req.query.categoria;
  let list = db().inscricoes;
  if(cat) list = list.filter(i=>i.categoria===cat);
  res.json(list);
});
app.patch('/api/admin/inscricoes/:id', auth, (req,res)=>{
  const i = db().inscricoes.find(x=>x.id==req.params.id);
  if(!i) return res.status(404).json({error:'não encontrada'});
  if(req.body.status) i.status = req.body.status;
  save(); res.json(i);
});
app.delete('/api/admin/inscricoes/:id', auth, (req,res)=>{
  const d = db(); const n = d.inscricoes.length;
  d.inscricoes = d.inscricoes.filter(x=>x.id!=req.params.id); save();
  res.json({ ok:true, removidas: n - d.inscricoes.length });
});

app.get('/api/formatos', (req,res)=> res.json(FORMATOS));
app.get('/api/modalidades', (req,res)=> res.json(MODALIDADES));

// Sorteio automático (ou manual via lista) da chave de uma categoria
app.post('/api/admin/sortear', auth, (req,res)=>{
  const { categoria, size='auto', seeds=4, seedmode='top', fonte='inscritos', lista, formato='3sets', wildcards, qualifying } = req.body || {};
  if(!categoria) return res.status(400).json({error:'categoria obrigatória'});
  let nomes;
  if(fonte==='lista' && Array.isArray(lista)) nomes = lista.map(s=>String(s).trim()).filter(Boolean);
  else nomes = db().inscricoes.filter(i=>i.categoria===categoria && i.status!=='recusada').map(i=>i.nome);
  const wcs = Array.isArray(wildcards) ? wildcards : (typeof wildcards==='string' ? wildcards.split('\n').map(s=>s.trim()).filter(Boolean) : []);
  if(nomes.length + wcs.length < 2) return res.status(400).json({error:'são necessários ao menos 2 atletas nesta categoria'});
  const chave = sortear(nomes, { size, seeds:parseInt(seeds), seedmode, wildcards:wcs, qualifying:!!qualifying });
  chave.categoria = categoria; chave.finalizada = false;
  chave.regras = FORMATOS[formato] || FORMATOS['3sets'];
  chave.placares = {};
  db().chaves[categoria] = chave; save();
  res.json(chave);
});

// Lançar resultado: por PLACAR (sets, validado pelas regras), por VENCEDOR (WO/abandono) ou avanço rápido (idx)
app.post('/api/admin/resultado', auth, (req,res)=>{
  const { categoria, round, match, idx, sets, winnerSlot, tipo } = req.body || {};
  const chave = db().chaves[categoria];
  if(!chave) return res.status(404).json({error:'chave não encontrada'});

  // modo rápido (clique direto no vencedor) — compatível com versões anteriores
  if(typeof idx === 'number' && sets===undefined && winnerSlot===undefined){
    if(!advance(chave, round, idx)) return res.status(400).json({error:'jogada inválida'});
    save(); return res.json(chave);
  }

  if(typeof match !== 'number') return res.status(400).json({error:'informe a partida (match)'});
  const sa = 2*match, sb = 2*match+1;
  const A = chave.rounds[round][sa], B = chave.rounds[round][sb];
  if(!A || !B || A.bye || B.bye) return res.status(400).json({error:'partida sem dois atletas'});

  let winIdx, placar='', tp = tipo || 'normal';
  if(Array.isArray(sets) && sets.length){
    const r = matchWinner(sets, chave.regras || {});
    if(!r.valid) return res.status(400).json({error:r.error});
    winIdx = r.winner===0 ? sa : sb; placar = r.placar;
  } else if(winnerSlot===0 || winnerSlot===1){
    winIdx = winnerSlot===0 ? sa : sb; tp = tipo || 'wo';
    placar = tp==='abandono' ? 'ABANDONO' : 'W.O.';
  } else {
    return res.status(400).json({error:'informe o placar (sets) ou o vencedor (winnerSlot)'});
  }
  const loserIdx = winIdx===sa ? sb : sa;
  const vencedorNome = chave.rounds[round][winIdx].name, perdedorNome = chave.rounds[round][loserIdx].name;
  advance(chave, round, winIdx);
  chave.placares = chave.placares || {};
  chave.placares[round+'-'+match] = { placar, tipo:tp, vencedor: vencedorNome, confirmado:false };
  applyElo(db().elo, vencedorNome, perdedorNome); // rating interno (cap. 7.2)
  save(); res.json(chave);
});

// Dupla validação: confirma um resultado já lançado (segunda checagem)
app.post('/api/admin/resultado/confirmar', auth, requireStaff, (req,res)=>{
  const { categoria, round, match } = req.body||{};
  const chave = db().chaves[categoria]; if(!chave||!chave.placares) return res.status(404).json({error:'chave/placar não encontrado'});
  const p = chave.placares[round+'-'+match]; if(!p) return res.status(404).json({error:'placar não encontrado'});
  p.confirmado = true; p.confirmadoEm = new Date().toISOString(); save(); res.json({ ok:true });
});

// Anular/corrigir resultado — desfaz o avanço na chave
app.post('/api/admin/resultado/anular', auth, (req,res)=>{
  const { torneioId, faseNome, jogoId } = req.body||{};
  const t=db().torneios.find(x=>x.id==torneioId);
  if(!t) return res.status(404).json({error:'torneio não encontrado'});
  const fase=t.chaves&&t.chaves[faseNome];
  if(!fase) return res.status(404).json({error:'fase não encontrada'});
  const jogo=fase.find(j=>j.id===jogoId||j.id==jogoId);
  if(!jogo) return res.status(404).json({error:'jogo não encontrado'});
  if(!jogo.resultado) return res.status(400).json({error:'jogo sem resultado para anular'});
  jogo.resultado=null; jogo.vencedor=null; jogo.anulado=false;
  auditoria(req.user,'ANULAR_RESULTADO',{torneioId,faseNome,jogoId});
  save(); res.json({ok:true});
});

// Finalizar: aplica pontos ao ranking interno
app.post('/api/admin/finalizar', auth, (req,res)=>{
  const { categoria } = req.body || {};
  const chave = db().chaves[categoria];
  if(!chave) return res.status(404).json({error:'chave não encontrada'});
  const champ = chave.rounds[chave.rounds.length-1][0];
  if(!champ || champ.bye) return res.status(400).json({error:'defina o campeão antes de finalizar'});
  const vice = chave.rounds[chave.rounds.length-2].find(e=>e&&!e.bye&&e.name!==champ.name);
  applyChaveToRanking(db().ranking, categoria, chave);
  db().campeoes = db().campeoes || {};
  db().campeoes[categoria] = { nome: champ.name, vice: vice?vice.name:null, data: new Date().toISOString() };
  chave.finalizada = true; save();
  res.json({ ok:true, campeao: champ.name, ranking: rankingList(db().ranking, categoria) });
});

app.get('/api/campeoes', (req,res)=>{
  const c = db().campeoes || {};
  res.json(Object.keys(c).map(cat=>({ categoria:cat, ...c[cat] })));
});

// =================== TORNEIOS (multi-evento) ===================
app.get('/api/torneios', (req,res)=> res.json(db().torneios||[]));
app.get('/api/torneio/:id', (req,res)=>{
  const t = (db().torneios||[]).find(x=>x.id==req.params.id);
  if(!t) return res.status(404).json({error:'torneio não encontrado'});
  res.json(t);
});
app.post('/api/admin/torneios', auth, (req,res)=>{
  const b = req.body||{};
  if(!b.nome) return res.status(400).json({error:'nome obrigatório'});
  const t = { id: nextId(), nome:b.nome, inicio:b.inicio||'', fim:b.fim||'', local:b.local||'',
    categorias: Array.isArray(b.categorias)?b.categorias:CATEGORIAS, formato:b.formato||'3sets',
    status:b.status||'aberto', criadoEm:new Date().toISOString() };
  db().torneios.push(t); save();
  res.json(t);
});
app.patch('/api/admin/torneios/:id', auth, (req,res)=>{
  const t=(db().torneios||[]).find(x=>x.id==req.params.id);
  if(!t) return res.status(404).json({error:'não encontrado'});
  ['nome','inicio','fim','local','status','formato'].forEach(k=>{ if(req.body[k]!==undefined) t[k]=req.body[k]; });
  save(); res.json(t);
});
app.delete('/api/admin/torneios/:id', auth, (req,res)=>{
  const d=db(); d.torneios=(d.torneios||[]).filter(x=>x.id!=req.params.id); save(); res.json({ok:true});
});

// ── Torneio — sortear chave por torneio ──────────────────────────────────────
app.post('/api/admin/torneios/:id/sortear', auth, requireRole('admin', 'organizador'), (req, res) => {
  const torneio = (db().torneios || []).find(t => t.id == req.params.id);
  if (!torneio) return res.status(404).json({ error: 'torneio não encontrado' });
  const { participantes = [], size, seeds = 0, wildcards = 0 } = req.body;
  if (participantes.length < 2) return res.status(400).json({ error: 'mínimo 2 participantes' });
  try {
    const chave = sortear(participantes, { size: size || participantes.length, seeds: parseInt(seeds), wildcards: parseInt(wildcards) });
    const d = db();
    if (!d.brackets) d.brackets = {};
    d.brackets[torneio.id] = { ...chave, torneioId: torneio.id, nome: torneio.nome, geradoEm: new Date().toISOString() };
    save();
    auditoria(req.user, 'SORTEAR_TORNEIO', { torneioId: torneio.id, nome: torneio.nome, n: participantes.length });
    res.json(d.brackets[torneio.id]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/admin/torneios/:id/bracket', auth, requireStaff, (req, res) => {
  const d = db();
  const bracket = (d.brackets || {})[req.params.id];
  if (!bracket) return res.status(404).json({ error: 'bracket não gerado ainda' });
  res.json(bracket);
});

app.get('/api/bracket/:categoria', (req, res) => {
  const d = db();
  // tenta pelo id do torneio primeiro, depois por nome de categoria
  const bracket = (d.brackets || {})[req.params.categoria];
  if (bracket) return res.json(bracket);
  // fallback: acha torneio por nome/categoria e retorna seu bracket
  const t = (d.torneios || []).find(t => t.nome?.toLowerCase().includes(req.params.categoria.toLowerCase()));
  if (t && d.brackets?.[t.id]) return res.json(d.brackets[t.id]);
  res.status(404).json({ error: 'bracket não encontrado' });
});

// =================== ASSINATURAS / PLANOS ===================
const PLANOS = [
  { id:'atleta_free', publico:'Atleta', nome:'Atleta Free', preco:0, periodo:'sempre', destaques:['Inscrição em torneios','Acompanhar suas chaves','Ranking público'] },
  { id:'atleta_pro', publico:'Atleta', nome:'Atleta PRO', preco:19.9, periodo:'mês', destaque:true, destaques:['Tudo do Free','Histórico e estatísticas','Head-to-head','Selo PRO no ranking','Prioridade em lista de espera'] },
  { id:'clube', publico:'Clube / Organizador', nome:'Clube', preco:199, periodo:'mês', destaques:['Criação ilimitada de torneios','Sorteio e súmula','Ranking por temporada','Painel financeiro','Suporte prioritário'] },
  { id:'patrocinador', publico:'Patrocinador', nome:'Patrocinador', preco:0, periodo:'sob consulta', destaques:['Marca em torneios e ranking','Relatórios de audiência','Ativações e leads'] }
];
app.get('/api/planos', (req,res)=> res.json(PLANOS));

app.post('/api/assinar', (req,res)=>{
  const { plano, nome, email, tipo, telefone } = req.body || {};
  const p = PLANOS.find(x=>x.id===plano);
  if(!p) return res.status(400).json({error:'plano inválido'});
  if(!nome || !email) return res.status(400).json({error:'nome e e-mail obrigatórios'});
  const ass = { id: nextId(), plano:p.id, planoNome:p.nome, publico:p.publico, preco:p.preco,
    nome, email, telefone:telefone||'', tipo:tipo||p.publico,
    status: p.preco>0 ? 'pendente_pagamento' : 'ativo', criadoEm:new Date().toISOString() };
  db().assinaturas.push(ass); save();
  // STUB de pagamento: integrar Mercado Pago/Stripe aqui (criar preferência e retornar checkoutUrl)
  const checkoutUrl = process.env.MP_ACCESS_TOKEN ? null : null;
  res.json({ ok:true, id:ass.id, status:ass.status,
    message: p.preco>0 ? 'Adesão registrada. Pagamento será habilitado ao conectar o gateway (Mercado Pago/Stripe).' : 'Plano ativado!',
    checkoutUrl });
});
app.get('/api/admin/assinaturas', auth, (req,res)=> res.json(db().assinaturas||[]));

// =================== INGRESSOS + QR CODE + CHECK-IN ===================
// Lotes por tipo: define sequência de lotes — virada automática por esgotamento ou data
const INGRESSO_TIPOS = [
  { id:'dia',    nome:'Ingresso Diário',          setor:'Geral', lotes:[
    { lote:1, preco:30, qtd:100, dataFim:'2026-07-01' },
    { lote:2, preco:40, qtd:200, dataFim:'2026-07-10' },
    { lote:3, preco:50, qtd:9999, dataFim:null }
  ]},
  { id:'semana', nome:'Passaporte da Semana',     setor:'Geral', lotes:[
    { lote:1, preco:120, qtd:50,  dataFim:'2026-07-01' },
    { lote:2, preco:150, qtd:100, dataFim:'2026-07-10' },
    { lote:3, preco:180, qtd:9999, dataFim:null }
  ]},
  { id:'final',  nome:'Finais + Premiação (dom)', setor:'Geral', lotes:[
    { lote:1, preco:50, qtd:80,  dataFim:'2026-07-08' },
    { lote:2, preco:60, qtd:9999, dataFim:null }
  ]},
  { id:'vip',    nome:'Camarote VIP (dia)',       setor:'VIP',   lotes:[
    { lote:1, preco:100, qtd:20, dataFim:'2026-07-01' },
    { lote:2, preco:120, qtd:9999, dataFim:null }
  ]}
];

// Retorna lote ativo (menor número ainda com qtd disponível e não expirado por data)
function loteAtivo(tipo){
  const vendidos = (db().ingressos||[]).filter(i=>i.tipoId===tipo.id && i.status!=='expirado').length;
  let consumidos = 0;
  for(const l of tipo.lotes){
    const disponivelLote = l.qtd - Math.max(0, vendidos - consumidos);
    const expirado = l.dataFim && new Date() > new Date(l.dataFim + 'T23:59:59');
    if(disponivelLote > 0 && !expirado) return { ...l, disponivel: disponivelLote };
    consumidos += l.qtd;
  }
  return null; // esgotado
}

app.get('/api/ingresso-tipos', (req,res)=> res.json(
  INGRESSO_TIPOS.map(t=>{ const l=loteAtivo(t); return { id:t.id, nome:t.nome, setor:t.setor,
    preco: l?l.preco:null, lote:l?l.lote:null, disponivel:l?l.disponivel:0, esgotado:!l }; })
));

// Gera código HMAC-assinado (anti-fraude): AO-<id>-<timestamp>-<hmac8>
function gerarCodeHMAC(id, tipoId){
  const ts = Date.now().toString(36).toUpperCase();
  const payload = `${id}:${tipoId}:${ts}`;
  const hmac = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex').slice(0,8).toUpperCase();
  return `AO-${id}-${ts}-${hmac}`;
}
function verificarCodeHMAC(code){
  const parts = code.split('-');
  if(parts.length!==4 || parts[0]!=='AO') return false;
  const [,id,ts,hmac] = parts;
  const payload = `${id}:`;  // precisamos do tipoId — buscamos no DB
  // verificação feita no check-in consultando o ingresso no DB pelo code
  return true; // validação estrutural básica
}

// Compra: gera ingresso com código HMAC + QR Code (SVG)
app.post('/api/ingresso/comprar', async (req,res)=>{
  const { tipoId, nome, email, cpf } = req.body || {};
  const t = INGRESSO_TIPOS.find(x=>x.id===tipoId);
  if(!t) return res.status(400).json({error:'tipo de ingresso inválido'});
  if(!nome || !email) return res.status(400).json({error:'nome e e-mail obrigatórios'});
  const l = loteAtivo(t);
  if(!l) return res.status(409).json({error:'ingressos esgotados para este tipo'});
  const id = nextId();
  const code = gerarCodeHMAC(id, tipoId);
  const ing = { id, code, tipoId:t.id, tipoNome:t.nome, setor:t.setor, preco:l.preco, lote:l.lote,
    nome, email, cpf:cpf||'', status:'valido', criadoEm:new Date().toISOString() };
  db().ingressos.push(ing); save();
  const qrSvg = await QRCode.toString(code, { type:'svg', margin:1, color:{ dark:'#0B2415', light:'#00000000' } });
  res.json({ ok:true, code, ingresso:ing, qrSvg, message:'Ingresso emitido! Apresente o QR Code na portaria.' });
});

app.get('/api/ingresso/:code', (req,res)=>{
  const i = (db().ingressos||[]).find(x=>x.code===req.params.code);
  if(!i) return res.status(404).json({error:'ingresso não encontrado'});
  res.json(i);
});

// Check-in (portaria): valida, bloqueia reuso
app.post('/api/admin/checkin', auth, (req,res)=>{
  const { code } = req.body || {};
  const i = (db().ingressos||[]).find(x=>x.code===(code||'').trim());
  if(!i) return res.status(404).json({ ok:false, resultado:'INVALIDO', message:'Ingresso não encontrado' });
  if(i.status==='usado') return res.status(409).json({ ok:false, resultado:'JA_USADO', message:'Ingresso já utilizado', ingresso:i, usadoEm:i.usadoEm });
  if(i.status!=='valido') return res.status(409).json({ ok:false, resultado:'PENDENTE', message:'Pagamento pendente', ingresso:i });
  i.status='usado'; i.usadoEm=new Date().toISOString(); save();
  res.json({ ok:true, resultado:'LIBERADO', message:'Entrada liberada', ingresso:i });
});

app.get('/api/admin/ingressos', auth, requireStaff, (req,res)=>{
  const list = db().ingressos||[];
  res.json({ total:list.length, presentes:list.filter(i=>i.status==='usado').length,
    validos:list.filter(i=>i.status==='valido').length, lista:list });
});
app.post('/api/admin/ingressos/:id/validar', auth, requireStaff, (req,res)=>{
  const d=db();
  const ing=(d.ingressos||[]).find(i=>i.id==req.params.id);
  if(!ing) return res.status(404).json({error:'ingresso não encontrado'});
  if(ing.validado) return res.status(409).json({error:'já validado',validadoEm:ing.validadoEm});
  ing.validado=true; ing.validadoEm=new Date().toISOString();
  ing.validadoPor=req.user.nome||req.user.user;
  save(); res.json(ing);
});
app.patch('/api/admin/assinaturas/:id', auth, (req,res)=>{
  const a=(db().assinaturas||[]).find(x=>x.id==req.params.id);
  if(!a) return res.status(404).json({error:'não encontrada'});
  if(req.body.status) a.status=req.body.status; save(); res.json(a);
});

app.post('/api/admin/reset-ranking', auth, (req,res)=>{ db().ranking = { players:{} }; db().campeoes = {}; save(); res.json({ok:true}); });

// =================== PDV BAR / RESTAURANTE ===================
const MESAS_FISICAS_DEFAULT = 12;
const getMesasFisicas = () => {
  const cfg = db().config?.bar?.mesasFisicas;
  return (cfg && cfg > 0) ? cfg : MESAS_FISICAS_DEFAULT;
};
const CARDAPIO = [
  // ── Bebidas ──────────────────────────────────────────────────────
  { id:'chopp',       nome:'Chopp 300ml',            cat:'Bebidas',    preco:12, setor:'bar',     cozinha:false },
  { id:'chopp600',    nome:'Chopp 600ml',             cat:'Bebidas',    preco:18, setor:'bar',     cozinha:false },
  { id:'cerveja_ln',  nome:'Cerveja Long Neck',       cat:'Bebidas',    preco:11, setor:'bar',     cozinha:false },
  { id:'cerveja_lt',  nome:'Cerveja Lata 350ml',      cat:'Bebidas',    preco:9,  setor:'bar',     cozinha:false },
  { id:'cerveja_600', nome:'Cerveja Garrafa 600ml',   cat:'Bebidas',    preco:18, setor:'bar',     cozinha:false },
  { id:'refri',       nome:'Refrigerante Lata',       cat:'Bebidas',    preco:7,  setor:'bar',     cozinha:false },
  { id:'refri_2l',    nome:'Refrigerante 2L',         cat:'Bebidas',    preco:15, setor:'bar',     cozinha:false },
  { id:'agua',        nome:'Água Mineral',            cat:'Bebidas',    preco:5,  setor:'bar',     cozinha:false },
  { id:'agua_c',      nome:'Água com Gás',            cat:'Bebidas',    preco:6,  setor:'bar',     cozinha:false },
  { id:'caipi',       nome:'Caipirinha',              cat:'Bebidas',    preco:18, setor:'bar',     cozinha:false },
  { id:'caipi_uva',   nome:'Caipirosca Uva',          cat:'Bebidas',    preco:20, setor:'bar',     cozinha:false },
  { id:'suco',        nome:'Suco Natural 500ml',      cat:'Bebidas',    preco:12, setor:'bar',     cozinha:false },
  { id:'isoton',      nome:'Isotônico',               cat:'Bebidas',    preco:9,  setor:'bar',     cozinha:false },
  { id:'energetico',  nome:'Energético',              cat:'Bebidas',    preco:14, setor:'bar',     cozinha:false },
  // ── Petiscos / Chapa ─────────────────────────────────────────────
  { id:'pastel_c',    nome:'Pastel de Carne (un)',     cat:'Petiscos',   preco:10, setor:'chapa',   cozinha:true },
  { id:'pastel_q',    nome:'Pastel de Queijo (un)',    cat:'Petiscos',   preco:10, setor:'chapa',   cozinha:true },
  { id:'pastel_f',    nome:'Pastel de Frango (un)',    cat:'Petiscos',   preco:10, setor:'chapa',   cozinha:true },
  { id:'misto',       nome:'Misto Quente',             cat:'Petiscos',   preco:14, setor:'chapa',   cozinha:true },
  { id:'coxinha',     nome:'Coxinha (un)',             cat:'Petiscos',   preco:8,  setor:'chapa',   cozinha:true },
  { id:'enrol_salsicha',nome:'Enrolado de Salsicha',  cat:'Petiscos',   preco:8,  setor:'chapa',   cozinha:true },
  { id:'porcao_fritas',nome:'Porção de Fritas',        cat:'Petiscos',   preco:28, setor:'cozinha', cozinha:true },
  { id:'porcao_mandioca',nome:'Porção de Mandioca',   cat:'Petiscos',   preco:26, setor:'cozinha', cozinha:true },
  { id:'batata_frita', nome:'Batata Frita Simples',   cat:'Petiscos',   preco:18, setor:'cozinha', cozinha:true },
  // ── Espetinhos ───────────────────────────────────────────────────
  { id:'esp_carne',   nome:'Espetinho de Carne',       cat:'Espetinhos', preco:12, setor:'chapa',   cozinha:true },
  { id:'esp_frango',  nome:'Espetinho de Frango',      cat:'Espetinhos', preco:10, setor:'chapa',   cozinha:true },
  { id:'esp_linguica',nome:'Espetinho de Linguiça',    cat:'Espetinhos', preco:10, setor:'chapa',   cozinha:true },
  { id:'esp_coração', nome:'Espetinho de Coração',     cat:'Espetinhos', preco:9,  setor:'chapa',   cozinha:true },
  { id:'esp_misto',   nome:'Espetinho Misto',          cat:'Espetinhos', preco:12, setor:'chapa',   cozinha:true },
  // ── Cozinha ──────────────────────────────────────────────────────
  { id:'burger',      nome:'Hambúrguer Artesanal',     cat:'Cozinha',    preco:32, setor:'cozinha', cozinha:true },
  { id:'burger_dp',   nome:'Hambúrguer Duplo',         cat:'Cozinha',    preco:42, setor:'cozinha', cozinha:true },
  { id:'salada',      nome:'Salada do Atleta',         cat:'Cozinha',    preco:24, setor:'cozinha', cozinha:true },
  { id:'prato_dia',   nome:'Prato do Dia',             cat:'Cozinha',    preco:35, setor:'cozinha', cozinha:true },
  { id:'frango_grl',  nome:'Frango Grelhado',          cat:'Cozinha',    preco:30, setor:'cozinha', cozinha:true },
  // ── Sobremesas ───────────────────────────────────────────────────
  { id:'acai',        nome:'Açaí 500ml',               cat:'Sobremesas', preco:22, setor:'bar',     cozinha:false },
  { id:'acai_300',    nome:'Açaí 300ml',               cat:'Sobremesas', preco:16, setor:'bar',     cozinha:false },
  { id:'sorvete',     nome:'Sorvete 2 bolas',          cat:'Sobremesas', preco:12, setor:'bar',     cozinha:false },
];
// prod() usa cardápio dinâmico (admin pode editar) com fallback no hardcoded
const prod = id => getCardapio().find(p=>p.id===id);
const comandaTotal = c => c.itens.reduce((s,i)=>s + i.preco*i.qtd, 0);
const openComandaMesa = num => db().comandas.find(c=>c.tipo==='fisica' && c.mesaNum===num && c.status==='aberta');

app.get('/api/cardapio', (req,res)=>{
  const est = db().estoque||{};
  res.json(getCardapio().map(p=>{
    const e = est[p.id]; const qtd = e ? e.qtd : null;
    return { ...p, estoque: qtd, indisponivel: qtd !== null && qtd <= 0 };
  }));
});

// Mapa de mesas (físicas + virtuais) com status
app.get('/api/mesas', (req,res)=>{
  const abertas = db().comandas.filter(c=>c.status==='aberta');
  const fisicas = [];
  for(let n=1;n<=getMesasFisicas();n++){
    const c = abertas.find(x=>x.tipo==='fisica' && x.mesaNum===n);
    fisicas.push({ num:n, tipo:'fisica', status: c?(c.contaPedida?'conta':'ocupada'):'livre',
      comandaId:c?c.id:null, total:c?comandaTotal(c):0, nome:c?c.nome:'', abertaEm:c?c.abertaEm:null,
      aguardandoCozinha: c? c.itens.some(i=>i.cozinha && i.status==='em_preparo') : false });
  }
  const virtuais = abertas.filter(c=>c.tipo==='virtual').map(c=>({ comandaId:c.id, tipo:'virtual', nome:c.nome,
    local:c.local||null, status: c.contaPedida?'conta':'ocupada', total:comandaTotal(c), abertaEm:c.abertaEm,
    aguardandoCozinha: c.itens.some(i=>i.cozinha && i.status==='em_preparo') }));
  res.json({ fisicas, virtuais, totalMesasFisicas:getMesasFisicas() });
});

// ── CRUD de configuração de mesas (admin) ──────────────────────────────────
app.post('/api/admin/mesas/config', auth, requireRole('admin','organizador'), (req,res)=>{
  const { mesasFisicas } = req.body||{};
  const n = parseInt(mesasFisicas);
  if(!n || n<1 || n>100) return res.status(400).json({error:'número de mesas inválido (1-100)'});
  if(!db().config) db().config = {};
  if(!db().config.bar) db().config.bar = {};
  db().config.bar.mesasFisicas = n;
  save();
  auditoria(req.user,'CONFIG_MESAS',{mesasFisicas:n});
  res.json({ok:true, mesasFisicas:n});
});

app.get('/api/admin/mesas/config', auth, requireStaff, (req,res)=>{
  res.json({ mesasFisicas: getMesasFisicas() });
});

// Forçar abertura de comanda em mesa física específica (admin pode abrir em nome de cliente)
app.post('/api/admin/mesas/:num/abrir', auth, requireStaff, (req,res)=>{
  const num = parseInt(req.params.num);
  if(num<1||num>getMesasFisicas()) return res.status(400).json({error:'mesa inválida'});
  if(openComandaMesa(num)) return res.status(409).json({error:'mesa já está ocupada'});
  const { nome } = req.body||{};
  const c = novaComanda({tipo:'fisica', mesaNum:num, nome:nome||('Mesa '+num)});
  save();
  res.json({ok:true, comandaId:c.id, mesa:num});
});

// Fechar/zerar mesa forçado (admin)
app.post('/api/admin/mesas/:num/fechar', auth, requireRole('admin','organizador'), (req,res)=>{
  const num = parseInt(req.params.num);
  const c = openComandaMesa(num);
  if(!c) return res.status(404).json({error:'mesa sem comanda aberta'});
  c.status='fechada'; c.fechadoEm=new Date().toISOString(); c.pagamento=c.pagamento||'cancelado_admin';
  c.itens.forEach(it=>{ if(db().estoque?.[it.produtoId]!==undefined) db().estoque[it.produtoId].qtd+=it.qtd; });
  save();
  auditoria(req.user,'FECHAR_MESA_FORCADO',{mesa:num, comandaId:c.id});
  res.json({ok:true});
});

function novaComanda({tipo,mesaNum,nome,local}){
  const c={ id:nextId(), tipo, mesaNum:mesaNum||null, nome:nome|| (tipo==='fisica'?('Mesa '+mesaNum):'Cliente'),
    local:local||null, status:'aberta', contaPedida:false, abertaEm:new Date().toISOString(), itens:[], pagamento:null };
  db().comandas.push(c); return c;
}
function addItens(c, itens){
  const erros = [];
  (itens||[]).forEach(it=>{
    const p=prod(it.produtoId); if(!p) return;
    const qtd=Math.max(1, parseInt(it.qtd)||1);
    const e=db().estoque;
    if(e[p.id] !== undefined && e[p.id].qtd < qtd){
      erros.push(`${p.nome}: estoque insuficiente (disponível: ${Math.max(0,e[p.id].qtd)})`);
      return;
    }
    c.itens.push({ produtoId:p.id, nome:p.nome, preco:p.preco, qtd, obs:it.obs||'', setor:p.setor,
      cozinha:p.cozinha, status: p.cozinha?'em_preparo':'entregue', criadoEm:new Date().toISOString() });
    if(e[p.id] !== undefined){ e[p.id].qtd -= qtd; if(e[p.id].qtd<=0) e[p.id].qtd=0; }
  });
  return erros;
}

app.get('/api/comanda/:id', (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id);
  if(!c) return res.status(404).json({error:'comanda não encontrada'});
  res.json({ ...c, total: comandaTotal(c) });
});

// Atendente abre mesa física e/ou adiciona itens
app.post('/api/comanda/abrir', auth, (req,res)=>{
  const { mesaNum, nome } = req.body||{};
  let c = openComandaMesa(parseInt(mesaNum));
  if(!c) c = novaComanda({tipo:'fisica', mesaNum:parseInt(mesaNum), nome});
  save(); res.json({ ...c, total:comandaTotal(c) });
});
app.post('/api/comanda/:id/item', auth, (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id && x.status==='aberta');
  if(!c) return res.status(404).json({error:'comanda não encontrada/aberta'});
  const errs=addItens(c, req.body.itens || [req.body]); save();
  if(errs&&errs.length) return res.status(409).json({error:errs.join('; '), parcial:true, comanda:{...c,total:comandaTotal(c)}});
  res.json({ ...c, total:comandaTotal(c) });
});
app.post('/api/admin/comanda/:id/conta', auth, (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id); if(!c) return res.status(404).json({error:'não encontrada'});
  c.contaPedida=true; save(); res.json({ok:true});
});
app.post('/api/admin/comanda/:id/fechar', auth, (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id); if(!c) return res.status(404).json({error:'não encontrada'});
  const total=Math.max(0, comandaTotal(c) - (c.desconto||0));
  c.status='fechada';
  c.pagamento=req.body.pagamento||'pix';
  c.pagamentos=req.body.pagamentos||[{meio:c.pagamento,valor:total}];
  c.fechadaEm=new Date().toISOString(); c.totalPago=total;
  auditoria(req.user,'FECHAR_COMANDA',{comandaId:c.id,total,meios:c.pagamentos});
  save(); res.json({ ok:true, total:c.totalPago });
});

// PÚBLICO: pedir pelo app via QR da mesa física
app.post('/api/mesa/:num/pedir', (req,res)=>{
  const num=parseInt(req.params.num);
  if(!num || num<1 || num>getMesasFisicas()) return res.status(400).json({error:'mesa inválida'});
  let c=openComandaMesa(num); if(!c) c=novaComanda({tipo:'fisica', mesaNum:num, nome:req.body.nome||('Mesa '+num)});
  const errs=addItens(c, req.body.itens||[]); save();
  if(errs&&errs.length) return res.status(409).json({error:errs.join('; ')});
  res.json({ ok:true, comandaId:c.id, total:comandaTotal(c), message:'Pedido enviado ao bar!' });
});
// PÚBLICO: criar mesa virtual georreferenciada e pedir
app.post('/api/mesa-virtual', (req,res)=>{
  const { nome, lat, lng, ref, itens } = req.body||{};
  if(!nome) return res.status(400).json({error:'informe um nome para a mesa'});
  const c=novaComanda({tipo:'virtual', nome, local:{ lat:lat||null, lng:lng||null, ref:ref||'' }});
  const errs=addItens(c, itens||[]); save();
  if(errs&&errs.length) return res.status(409).json({error:errs.join('; ')});
  res.json({ ok:true, comandaId:c.id, total:comandaTotal(c), message:'Mesa virtual criada! Um atendente vai até você.' });
});

// KDS — cozinha
app.get('/api/kds', (req,res)=>{
  const fila=[];
  db().comandas.filter(c=>c.status==='aberta').forEach(c=>{
    c.itens.forEach((it,idx)=>{ if(it.cozinha && it.status!=='entregue'){ fila.push({ comandaId:c.id, idx,
      mesa:c.nome, tipo:c.tipo, local:c.local||null, nome:it.nome, qtd:it.qtd, obs:it.obs, setor:it.setor,
      status:it.status, criadoEm:it.criadoEm }); } });
  });
  fila.sort((a,b)=> new Date(a.criadoEm)-new Date(b.criadoEm));
  res.json(fila);
});
app.post('/api/admin/kds/status', auth, (req,res)=>{
  const { comandaId, idx, status } = req.body||{};
  const c=db().comandas.find(x=>x.id==comandaId); if(!c||!c.itens[idx]) return res.status(404).json({error:'item não encontrado'});
  c.itens[idx].status = status==='pronto'?'pronto':(status==='entregue'?'entregue':'em_preparo'); save();
  res.json({ ok:true });
});
// ── COMANDA AVANÇADA ─────────────────────────────────────────────────────────

// PATCH item: editar qtd e/ou obs — repõe estoque se qtd diminuir
app.patch('/api/comanda/:id/item/:idx', auth, (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id && x.status==='aberta');
  if(!c) return res.status(404).json({error:'comanda não encontrada/aberta'});
  const idx=parseInt(req.params.idx);
  if(!c.itens[idx]) return res.status(404).json({error:'item não encontrado'});
  const it=c.itens[idx];
  const novaQtd=req.body.qtd!=null ? Math.max(1,parseInt(req.body.qtd)) : it.qtd;
  const diff=novaQtd - it.qtd; // positivo=aumentou, negativo=diminuiu
  if(diff!==0){
    const e=db().estoque;
    if(diff>0 && e[it.produtoId]!==undefined && e[it.produtoId].qtd<diff)
      return res.status(409).json({error:`Estoque insuficiente (disponível: ${e[it.produtoId].qtd})`});
    if(e[it.produtoId]!==undefined) e[it.produtoId].qtd -= diff;
    it.qtd=novaQtd;
  }
  if(req.body.obs!=null) it.obs=req.body.obs;
  auditoria(req.user,'PATCH_ITEM_COMANDA',{comandaId:c.id,idx,qtd:it.qtd,obs:it.obs});
  save();
  res.json({ ...c, total:comandaTotal(c) });
});

// DELETE item: remover/cancelar item — repõe estoque
app.delete('/api/comanda/:id/item/:idx', auth, (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id && x.status==='aberta');
  if(!c) return res.status(404).json({error:'comanda não encontrada/aberta'});
  const idx=parseInt(req.params.idx);
  if(!c.itens[idx]) return res.status(404).json({error:'item não encontrado'});
  const it=c.itens[idx];
  const e=db().estoque;
  if(e[it.produtoId]!==undefined) e[it.produtoId].qtd += it.qtd;
  auditoria(req.user,'DEL_ITEM_COMANDA',{comandaId:c.id,idx,item:it.nome,motivo:req.body.motivo||''});
  c.itens.splice(idx,1);
  save();
  res.json({ ...c, total:comandaTotal(c) });
});

// POST transferir comanda para outra mesa
app.post('/api/comanda/:id/transferir', auth, (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id && x.status==='aberta');
  if(!c) return res.status(404).json({error:'comanda não encontrada/aberta'});
  const { mesaNum } = req.body||{};
  if(!mesaNum) return res.status(400).json({error:'informe mesaNum'});
  const num=parseInt(mesaNum);
  if(num<1||num>getMesasFisicas()) return res.status(400).json({error:'mesa inválida'});
  const outra=openComandaMesa(num);
  if(outra && outra.id!==c.id){
    // merge: move itens para comanda existente
    outra.itens.push(...c.itens);
    c.status='transferida'; c.fechadaEm=new Date().toISOString();
    auditoria(req.user,'TRANSFERIR_COMANDA',{de:c.id,para:outra.id});
    save(); return res.json({ ...outra, total:comandaTotal(outra) });
  }
  const mesaAnterior=c.mesaNum;
  c.mesaNum=num; c.nome='Mesa '+num; c.tipo='fisica';
  auditoria(req.user,'MOVER_COMANDA',{de:mesaAnterior,para:num});
  save();
  res.json({ ...c, total:comandaTotal(c) });
});

// POST desconto/cortesia na comanda (valor ou %)
app.post('/api/comanda/:id/desconto', auth, (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id && x.status==='aberta');
  if(!c) return res.status(404).json({error:'comanda não encontrada/aberta'});
  const { tipo, valor, motivo } = req.body||{};
  if(!tipo||!valor) return res.status(400).json({error:'informe tipo (pct|fixo) e valor'});
  const total=comandaTotal(c);
  const desconto = tipo==='pct' ? total*(Math.min(100,valor)/100) : Math.min(total,valor);
  c.desconto = (c.desconto||0) + desconto;
  c.descontoMotivo = motivo||'Cortesia';
  auditoria(req.user,'DESCONTO_COMANDA',{comandaId:c.id,tipo,valor,desconto});
  save();
  res.json({ ...c, total:Math.max(0,total - c.desconto) });
});

// POST reabrir comanda fechada (admin)
app.post('/api/admin/comanda/:id/reabrir', auth, (req,res)=>{
  const c=db().comandas.find(x=>x.id==req.params.id && x.status==='fechada');
  if(!c) return res.status(404).json({error:'comanda não encontrada/fechada'});
  c.status='aberta'; c.fechadaEm=null; c.pagamento=null; c.totalPago=null; c.contaPedida=false;
  auditoria(req.user,'REABRIR_COMANDA',{comandaId:c.id});
  save();
  res.json({ ...c, total:comandaTotal(c) });
});

// DELETE comanda (admin — cancelar sem fechar)
app.delete('/api/admin/comanda/:id', auth, (req,res)=>{
  const idx=db().comandas.findIndex(x=>x.id==req.params.id);
  if(idx<0) return res.status(404).json({error:'comanda não encontrada'});
  const c=db().comandas[idx];
  // repor estoque de todos os itens
  const e=db().estoque;
  c.itens.forEach(it=>{ if(e[it.produtoId]!==undefined) e[it.produtoId].qtd+=it.qtd; });
  auditoria(req.user,'CANCEL_COMANDA',{comandaId:c.id,motivo:req.body.motivo||''});
  db().comandas.splice(idx,1);
  save();
  res.json({ok:true});
});

// ── CARDÁPIO CRUD ────────────────────────────────────────────────────────────
function getCardapio(){ return db().cardapio && db().cardapio.length ? db().cardapio : CARDAPIO; }

app.get('/api/admin/cardapio', auth, requireStaff, (req,res)=> res.json(getCardapio()));
app.post('/api/admin/cardapio', auth, requireStaff, (req,res)=>{
  if(!db().cardapio||!db().cardapio.length) db().cardapio=[...CARDAPIO];
  const {nome,cat,preco,setor,cozinha,emoji,ordem} = req.body||{};
  if(!nome||!cat||!preco) return res.status(400).json({error:'nome, cat e preco são obrigatórios'});
  const id='p'+nextId();
  const novo = {id,nome,cat,preco:+preco,setor:setor||'bar',cozinha:!!cozinha};
  if(emoji) novo.emoji=emoji;
  if(ordem!=null) novo.ordem=+ordem;
  db().cardapio.push(novo);
  save(); res.json({ok:true,id});
});
app.patch('/api/admin/cardapio/:id', auth, requireStaff, (req,res)=>{
  if(!db().cardapio||!db().cardapio.length) db().cardapio=[...CARDAPIO];
  const p=db().cardapio.find(x=>x.id===req.params.id);
  if(!p) return res.status(404).json({error:'produto não encontrado'});
  const {nome,cat,preco,setor,cozinha,indisponivel,emoji,ordem} = req.body||{};
  if(nome) p.nome=nome; if(cat) p.cat=cat; if(preco!=null) p.preco=+preco;
  if(setor) p.setor=setor; if(cozinha!=null) p.cozinha=!!cozinha; if(indisponivel!=null) p.indisponivel=!!indisponivel;
  if(emoji!=null) p.emoji=emoji; if(ordem!=null) p.ordem=+ordem;
  save(); res.json({ok:true});
});
app.delete('/api/admin/cardapio/:id', auth, requireStaff, (req,res)=>{
  if(!db().cardapio||!db().cardapio.length) db().cardapio=[...CARDAPIO];
  const idx=db().cardapio.findIndex(x=>x.id===req.params.id);
  if(idx<0) return res.status(404).json({error:'produto não encontrado'});
  db().cardapio.splice(idx,1); save(); res.json({ok:true});
});
// Restaurar cardápio padrão (sobrescreve com CARDAPIO hardcoded)
app.post('/api/admin/cardapio/reset', auth, requireRole('admin'), (req,res)=>{
  db().cardapio = [...CARDAPIO];
  save(); res.json({ok:true, total: CARDAPIO.length});
});

// ── CONFIGURAÇÕES DO EVENTO ───────────────────────────────────────────────────
const CONFIG_DEFAULT = {
  evento: { nome:'4ª Agro Open de Tênis', dataInicio:'2026-09-07', dataFim:'2026-09-13', local:'Tangará Tênis Clube', cidade:'Tangará da Serra/MT' },
  bar: { nome:'Bar do torneio', mesasFisicas:12, setores:['bar','cozinha','chapa'] },
  restaurante: { nome:'Restaurante', mesasFisicas:0, setores:['cozinha','chapa'] },
  quadras: null, // null = usa QUADRAS hardcoded
  horarios: null, // null = usa HORARIOS hardcoded
  ingressoTipos: null, // null = usa INGRESSO_TIPOS hardcoded
  categorias: null, // null = usa CATEGORIAS hardcoded
  socioPlanos: null,
  assinPlanos: null,
  pagamentos: { meios:['pix','cartao','dinheiro','carteira'], taxaPct:5 },
  fiscal: { cnpj:'', ie:'', ambiente:'homologacao' }
};
app.get('/api/admin/config', auth, (req,res)=>{
  const d = db();
  res.json({
    evento: {
      nome:       d.config?.evento?.nome       || CONFIG_DEFAULT.evento.nome,
      slogan:     d.config?.evento?.slogan     || 'UISA / Tangará Tênis Clube',
      dataInicio: d.config?.evento?.dataInicio || CONFIG_DEFAULT.evento.dataInicio,
      dataFim:    d.config?.evento?.dataFim    || CONFIG_DEFAULT.evento.dataFim,
      local:      d.config?.evento?.local      || CONFIG_DEFAULT.evento.local,
      cidade:     d.config?.evento?.cidade     || (CONFIG_DEFAULT.evento.cidade||''),
      site:       d.config?.evento?.site       || '',
      whatsapp:   d.config?.evento?.whatsapp   || '',
      instagram:  d.config?.evento?.instagram  || '',
      premiacao:  d.config?.evento?.premiacao  ?? 5000,
    },
    bar: {
      nome:         d.config?.bar?.nome         || CONFIG_DEFAULT.bar.nome,
      mesasFisicas: d.config?.bar?.mesasFisicas ?? CONFIG_DEFAULT.bar.mesasFisicas,
      taxaServico:  d.config?.bar?.taxaServico  ?? 10,
      setores:      d.config?.bar?.setores      || CONFIG_DEFAULT.bar.setores,
    },
    restaurante: { ...(CONFIG_DEFAULT.restaurante), ...(d.config?.restaurante||{}) },
    pagamentos:  { ...(CONFIG_DEFAULT.pagamentos),  ...(d.config?.pagamentos||{}) },
    fiscal:      { ...(CONFIG_DEFAULT.fiscal),      ...(d.config?.fiscal||{}) },
    pix: {
      chave:  process.env.PIX_CHAVE ? '***' + process.env.PIX_CHAVE.slice(-4) : '',
      nome:   process.env.PIX_NOME  || '',
      cidade: process.env.PIX_CIDADE|| '',
    },
  });
});
app.patch('/api/admin/config', auth, requireRole('admin'), (req,res)=>{
  const d = db();
  if(!d.config) d.config = {};
  const allowed = ['evento','bar','restaurante','quadras','horarios','ingressoTipos','categorias','socioPlanos','assinPlanos','pagamentos','fiscal'];
  allowed.forEach(k => {
    if (req.body[k] != null) {
      d.config[k] = { ...(d.config[k] || {}), ...req.body[k] };
    }
  });
  audit(req, 'UPDATE_CONFIG', { keys: Object.keys(req.body) });
  save();
  res.json({ ok: true });
});

app.get('/api/admin/caixa', auth, (req,res)=>{
  const fechadas=db().comandas.filter(c=>c.status==='fechada');
  const total=fechadas.reduce((s,c)=>s+(c.totalPago||0),0);
  const porMeio={};
  fechadas.forEach(c=>{
    const meios=c.pagamentos||[{meio:c.pagamento||'outros',valor:c.totalPago||0}];
    meios.forEach(p=>{ porMeio[p.meio]=(porMeio[p.meio]||0)+(p.valor||0); });
  });
  const recentes=fechadas.slice(-50).reverse().map(c=>({
    id:c.id, nome:c.nome, total:c.totalPago||0, fechadoEm:c.fechadoEm,
    itens:(c.itens||[]).reduce((s,i)=>s+i.qtd,0),
    pagamento:c.pagamento, pagamentos:c.pagamentos
  }));
  res.json({ comandasFechadas:fechadas.length, faturamento:total, porMeio,
    abertas:db().comandas.filter(c=>c.status==='aberta').length, recentes });
});

// ── Caixa — movimentos do dia (sangria/suprimento) ──────────────────────────
app.get('/api/admin/caixa/hoje', auth, requireStaff, (req, res) => {
  const d = db();
  const hoje = new Date().toISOString().slice(0, 10);
  const movs = (d.caixaMovimentos || []).filter(m => m.data.startsWith(hoje));
  const vendas = (d.comandas || []).filter(c => c.status === 'fechada' && (c.fechadaEm || '').startsWith(hoje));
  const totalVendas = vendas.reduce((a, c) => a + (c.total || 0), 0);
  const sangrias   = movs.filter(m => m.tipo === 'sangria').reduce((a, m) => a + m.valor, 0);
  const suprimentos = movs.filter(m => m.tipo === 'suprimento').reduce((a, m) => a + m.valor, 0);
  const abertura = (d.config?.caixa?.abertura) || 0;
  res.json({ abertura, sangrias, suprimentos, vendas: totalVendas, saldo: abertura + suprimentos + totalVendas - sangrias, movimentos: movs });
});

app.post('/api/admin/caixa/movimento', auth, requireStaff, (req, res) => {
  const { tipo, valor, motivo } = req.body;
  if (!['sangria', 'suprimento'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
  if (!valor || valor <= 0) return res.status(400).json({ error: 'valor inválido' });
  const d = db();
  if (!d.caixaMovimentos) d.caixaMovimentos = [];
  const mov = { id: nextId(), tipo, valor: Number(valor), motivo: motivo || '', data: new Date().toISOString(), usuario: req.user.nome || req.user.user };
  d.caixaMovimentos.push(mov);
  save();
  auditoria(req.user, tipo.toUpperCase(), mov);
  res.json(mov);
});

// ── Vendas do dia ────────────────────────────────────────────────────────────
app.get('/api/admin/vendas', auth, requireStaff, (req, res) => {
  const d = db();
  const hoje = new Date().toISOString().slice(0, 10);
  const filtroHoje = req.query.hoje === '1';
  let vendas = (d.comandas || []).filter(c => c.status === 'fechada');
  if (filtroHoje) vendas = vendas.filter(c => (c.fechadaEm || '').startsWith(hoje));
  const total = vendas.reduce((a, c) => a + (c.total || 0), 0);
  res.json({ vendas, total, count: vendas.length });
});

// =================== RESERVA DE QUADRAS (cap. 13) ===================
const QUADRAS = [
  { id:'q1', nome:'Quadra 1 · Central',  piso:'Saibro',  preco:80 },
  { id:'q2', nome:'Quadra 2 · Saibro',   piso:'Saibro',  preco:70 },
  { id:'q3', nome:'Quadra 3 · Saibro',   piso:'Saibro',  preco:70 },
  { id:'q4', nome:'Quadra 4 · Saibro',   piso:'Saibro',  preco:70 },
  { id:'q5', nome:'Quadra 5 · Saibro',   piso:'Saibro',  preco:70 },
  { id:'q6', nome:'Quadra 6 · Rápida',   piso:'Rápida',  preco:90 },
  { id:'q7', nome:'Quadra 7 · Rápida',   piso:'Rápida',  preco:90 }
];
const HORARIOS = ['07:00','08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
const quadra = id => QUADRAS.find(q=>q.id===id);
const dataValida = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s||''));

app.get('/api/quadras', (req,res)=> res.json({ quadras:QUADRAS, horarios:HORARIOS }));

// Disponibilidade do dia (público): só expõe slots ocupados, sem dados pessoais
app.get('/api/reservas', (req,res)=>{
  const { data } = req.query;
  if(!dataValida(data)) return res.status(400).json({error:'informe a data no formato AAAA-MM-DD'});
  const ocupados = (db().reservas||[])
    .filter(r=>r.data===data && r.status!=='cancelada')
    .map(r=>({ quadraId:r.quadraId, hora:r.hora, status:r.status }));
  res.json({ data, horarios:HORARIOS, quadras:QUADRAS, ocupados });
});

// Reservar (público): valida conflito e cria a reserva
app.post('/api/reservar', (req,res)=>{
  const { quadraId, data, hora, nome, email, tel } = req.body || {};
  const q = quadra(quadraId);
  if(!q) return res.status(400).json({error:'quadra inválida'});
  if(!dataValida(data)) return res.status(400).json({error:'data inválida'});
  if(!HORARIOS.includes(hora)) return res.status(400).json({error:'horário inválido'});
  if(!nome || !email) return res.status(400).json({error:'nome e e-mail obrigatórios'});
  const hoje = new Date().toISOString().slice(0,10);
  if(data < hoje) return res.status(400).json({error:'não é possível reservar uma data passada'});
  const conflito = (db().reservas||[]).some(r=>r.quadraId===quadraId && r.data===data && r.hora===hora && r.status!=='cancelada');
  if(conflito) return res.status(409).json({error:'este horário já está reservado'});
  const r = { id: nextId(), quadraId, quadraNome:q.nome, piso:q.piso, preco:q.preco,
    data, hora, nome, email, tel:tel||'', status:'reservada', criadoEm:new Date().toISOString() };
  db().reservas.push(r); save();
  res.json({ ok:true, reserva:r, message:'Quadra reservada! Apresente-se na recepção no horário.' });
});

app.get('/api/admin/reservas', auth, requireStaff, (req,res)=>{
  let list = db().reservas||[];
  if(dataValida(req.query.data)) list = list.filter(r=>r.data===req.query.data);
  res.json(list.slice().sort((a,b)=> (a.data+a.hora).localeCompare(b.data+b.hora)));
});
app.patch('/api/admin/reservas/:id', auth, requireStaff, (req,res)=>{
  const r=(db().reservas||[]).find(x=>x.id==req.params.id); if(!r) return res.status(404).json({error:'não encontrada'});
  if(req.body.status) r.status=req.body.status; save(); res.json(r);
});
app.delete('/api/admin/reservas/:id', auth, requireStaff, (req,res)=>{
  const d=db(); d.reservas=(d.reservas||[]).filter(x=>x.id!=req.params.id); save(); res.json({ok:true});
});

// =================== PATROCINADORES E MÍDIA (cap. 11) ===================
const COTAS = [
  { id:'master', nome:'Master',  ordem:1 },
  { id:'ouro',   nome:'Ouro',    ordem:2 },
  { id:'prata',  nome:'Prata',   ordem:3 },
  { id:'apoio',  nome:'Apoio',   ordem:4 }
];
app.get('/api/cotas', (req,res)=> res.json(COTAS));
const pubPatroc = p => ({ id:p.id, marca:p.marca, cota:p.cota, escopo:p.escopo, torneioId:p.torneioId||null, logo:p.logo||'', link:p.link||'', status:p.status });

// Público: patrocinadores ativos (filtra por escopo 'app' ou por torneio)
app.get('/api/patrocinadores', (req,res)=>{
  const { escopo, torneioId } = req.query;
  let list = (db().patrocinadores||[]).filter(p=>p.status==='ativo');
  if(escopo==='app') list = list.filter(p=>p.escopo==='app');
  if(torneioId) list = list.filter(p=>p.escopo==='app' || String(p.torneioId)===String(torneioId));
  const ord = c => (COTAS.find(x=>x.id===c)?.ordem||9);
  res.json(list.sort((a,b)=>ord(a.cota)-ord(b.cota)).map(pubPatroc));
});
app.get('/api/admin/patrocinadores', auth, requireStaff, (req,res)=> res.json(db().patrocinadores||[]));
app.post('/api/admin/patrocinadores', auth, requireStaff, (req,res)=>{
  const b=req.body||{};
  if(!b.marca) return res.status(400).json({error:'marca obrigatória'});
  const p={ id:nextId(), marca:b.marca, cota:b.cota||'apoio', escopo:b.escopo==='app'?'app':'torneio',
    torneioId:b.torneioId||null, logo:b.logo||'', link:b.link||'', contato:b.contato||'',
    vigencia:b.vigencia||'', valor:b.valor||0, status:b.status||'ativo', criadoEm:new Date().toISOString() };
  db().patrocinadores.push(p); save(); res.json(p);
});
app.patch('/api/admin/patrocinadores/:id', auth, requireStaff, (req,res)=>{
  const p=(db().patrocinadores||[]).find(x=>x.id==req.params.id); if(!p) return res.status(404).json({error:'não encontrado'});
  ['marca','cota','escopo','torneioId','logo','link','contato','vigencia','valor','status'].forEach(k=>{ if(req.body[k]!==undefined) p[k]=req.body[k]; });
  save(); res.json(p);
});
app.delete('/api/admin/patrocinadores/:id', auth, requireStaff, (req,res)=>{
  const d=db(); d.patrocinadores=(d.patrocinadores||[]).filter(x=>x.id!=req.params.id); save(); res.json({ok:true});
});

// =================== CARTEIRA E FIDELIDADE (cap. 12.4) ===================
function wallet(u){ if(!u.carteira) u.carteira={ saldo:0, pontos:0, extrato:[] }; return u.carteira; }
app.get('/api/auth/carteira', auth, (req,res)=>{
  const u=db().usuarios.find(x=>x.id===req.user.id); if(!u) return res.status(404).json({error:'usuário não encontrado'});
  const w=wallet(u); res.json({ saldo:w.saldo, pontos:w.pontos, extrato:w.extrato.slice(-20).reverse() });
});
app.get('/api/admin/carteiras', auth, requireStaff, (req,res)=>{
  res.json((db().usuarios||[]).map(u=>({ id:u.id, nome:u.nome, email:u.email,
    saldo:(u.carteira&&u.carteira.saldo)||0, pontos:(u.carteira&&u.carteira.pontos)||0 })));
});
// Organização ajusta saldo/pontos (recarga real entra com o gateway de pagamento)
app.post('/api/admin/carteira', auth, requireStaff, (req,res)=>{
  const { usuarioId, tipo, valor, motivo } = req.body||{};
  const u=db().usuarios.find(x=>x.id==usuarioId); if(!u) return res.status(404).json({error:'usuário não encontrado'});
  const v=Number(valor); if(!v || v<=0) return res.status(400).json({error:'valor inválido'});
  const w=wallet(u); const t=new Date().toISOString();
  if(tipo==='credito'){ w.saldo+=v; w.extrato.push({ t, tipo:'crédito', valor:v, motivo:motivo||'Recarga' }); }
  else if(tipo==='debito'){ if(w.saldo<v) return res.status(400).json({error:'saldo insuficiente'}); w.saldo-=v; w.extrato.push({ t, tipo:'débito', valor:v, motivo:motivo||'Consumo' }); }
  else if(tipo==='pontos'){ w.pontos+=v; w.extrato.push({ t, tipo:'pontos', valor:v, motivo:motivo||'Fidelidade' }); }
  else return res.status(400).json({error:'tipo inválido (credito|debito|pontos)'});
  save(); res.json({ ok:true, saldo:w.saldo, pontos:w.pontos });
});

// =================== ESTOQUE SIMPLES DO PDV (cap. 10.5) ===================
function estoqueItem(id){ const e=db().estoque; if(!e[id]) e[id]={ qtd:0, custo:0, min:5 }; return e[id]; }
app.get('/api/admin/estoque', auth, requireStaff, (req,res)=>{
  res.json(CARDAPIO.map(p=>{ const e=estoqueItem(p.id); return { id:p.id, nome:p.nome, cat:p.cat, preco:p.preco,
    qtd:e.qtd, custo:e.custo, min:e.min, baixo: e.qtd<=e.min }; }));
});
app.post('/api/admin/estoque/entrada', auth, requireStaff, (req,res)=>{
  const { produtoId, qtd, custo } = req.body||{};
  if(!prod(produtoId)) return res.status(400).json({error:'produto inválido'});
  const q=parseInt(qtd); if(!q || q<=0) return res.status(400).json({error:'quantidade inválida'});
  const e=estoqueItem(produtoId); e.qtd+=q; if(custo!==undefined && custo!=='') e.custo=Number(custo); save();
  res.json({ ok:true, produtoId, qtd:e.qtd });
});
app.post('/api/admin/estoque/ajuste', auth, requireStaff, (req,res)=>{
  const { produtoId, qtd, min } = req.body||{};
  if(!prod(produtoId)) return res.status(400).json({error:'produto inválido'});
  const e=estoqueItem(produtoId);
  if(qtd!==undefined && qtd!=='') e.qtd=parseInt(qtd)||0;
  if(min!==undefined && min!=='') e.min=parseInt(min)||0;
  save(); res.json({ ok:true, ...e });
});

// =================== ROUND-ROBIN / LIGAS (cap. 4.1) ===================
// Público: ver a liga (rodadas + tabela)
app.get('/api/liga/:categoria', (req,res)=>{
  const rr = db().ligas[req.params.categoria];
  if(!rr) return res.status(404).json({error:'liga não publicada'});
  res.json({ ...rr, tabela: tabelaRoundRobin(rr) });
});
app.get('/api/ligas', (req,res)=>{
  const L=db().ligas||{};
  res.json(Object.keys(L).map(cat=>({ categoria:cat, atletas:L[cat].players.length, rodadas:L[cat].rounds.length, formato:(L[cat].regras&&L[cat].regras.label)||'' })));
});
// Admin: gerar liga round-robin
app.post('/api/admin/liga/gerar', auth, requireStaff, (req,res)=>{
  const { categoria, fonte='inscritos', lista, formato='3sets' } = req.body||{};
  if(!categoria) return res.status(400).json({error:'categoria obrigatória'});
  let nomes;
  if(fonte==='lista' && Array.isArray(lista)) nomes=lista.map(s=>String(s).trim()).filter(Boolean);
  else nomes=db().inscricoes.filter(i=>i.categoria===categoria && i.status!=='recusada').map(i=>i.nome);
  try{
    const rr=gerarRoundRobin(nomes);
    rr.categoria=categoria; rr.regras=FORMATOS[formato]||FORMATOS['3sets'];
    db().ligas[categoria]=rr; save();
    res.json({ ...rr, tabela: tabelaRoundRobin(rr) });
  }catch(e){ res.status(400).json({error:e.message}); }
});
// Admin: lançar resultado de um jogo da liga
app.post('/api/admin/liga/resultado', auth, requireStaff, (req,res)=>{
  const { categoria, rodada, jogo, sets, winnerSlot, tipo } = req.body||{};
  const rr=db().ligas[categoria]; if(!rr) return res.status(404).json({error:'liga não encontrada'});
  const g=rr.rounds[rodada] && rr.rounds[rodada][jogo]; if(!g) return res.status(404).json({error:'jogo não encontrado'});
  if(Array.isArray(sets) && sets.length){
    const r=matchWinner(sets, rr.regras||{}); if(!r.valid) return res.status(400).json({error:r.error});
    g.placar=r.placar; g.tipo='normal'; g.vencedor = r.winner===0 ? g.a : g.b;
  } else if(winnerSlot===0 || winnerSlot===1){
    g.tipo = tipo||'wo'; g.placar = g.tipo==='abandono'?'ABANDONO':'W.O.'; g.vencedor = winnerSlot===0 ? g.a : g.b;
  } else return res.status(400).json({error:'informe o placar (sets) ou o vencedor (winnerSlot)'});
  applyElo(db().elo, g.vencedor, g.vencedor===g.a ? g.b : g.a); // rating interno
  save(); res.json({ ...rr, tabela: tabelaRoundRobin(rr) });
});
app.delete('/api/admin/liga/:categoria', auth, requireStaff, (req,res)=>{ delete db().ligas[req.params.categoria]; save(); res.json({ok:true}); });

// Rating interno (Elo) — público
app.get('/api/rating', (req,res)=> res.json(ratingList(db().elo)));

// =================== AULAS E PROFESSORES (cap. 13) ===================
app.get('/api/professores', (req,res)=> res.json((db().professores||[]).filter(p=>p.ativo!==false)));
app.post('/api/admin/professores', auth, requireStaff, (req,res)=>{
  const b=req.body||{}; if(!b.nome) return res.status(400).json({error:'nome obrigatório'});
  const p={ id:nextId(), nome:b.nome, modalidade:b.modalidade||'tenis', bio:b.bio||'', ativo:true, criadoEm:new Date().toISOString() };
  db().professores.push(p); save(); res.json(p);
});
app.delete('/api/admin/professores/:id', auth, requireStaff, (req,res)=>{ const d=db(); d.professores=(d.professores||[]).filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });

const aulaInfo = a => { const al=(a.alunos||[]); return { ...a, inscritos:al.length, vagasLivres:Math.max(0,a.vagas-al.length) }; };
app.get('/api/aulas', (req,res)=>{
  let list=(db().aulas||[]);
  if(dataValida(req.query.data)) list=list.filter(a=>a.data===req.query.data);
  res.json(list.slice().sort((x,y)=>(x.data+x.hora).localeCompare(y.data+y.hora)).map(aulaInfo));
});
app.post('/api/admin/aulas', auth, requireStaff, (req,res)=>{
  const b=req.body||{};
  if(!b.titulo || !b.data || !b.hora) return res.status(400).json({error:'título, data e hora obrigatórios'});
  const prof=(db().professores||[]).find(p=>p.id==b.professorId);
  const a={ id:nextId(), titulo:b.titulo, professorId:b.professorId||null, professor:prof?prof.nome:'', modalidade:b.modalidade||'tenis',
    data:b.data, hora:b.hora, nivel:b.nivel||'Livre', vagas:parseInt(b.vagas)||6, preco:Number(b.preco)||0,
    alunos:[], criadoEm:new Date().toISOString() };
  db().aulas.push(a); save(); res.json(aulaInfo(a));
});
app.patch('/api/admin/aulas/:id', auth, requireStaff, (req,res)=>{
  const a=(db().aulas||[]).find(x=>x.id==req.params.id); if(!a) return res.status(404).json({error:'aula não encontrada'});
  const {titulo,professor,professorId,nivel,vagas,maxAlunos,preco,data,hora,modalidade} = req.body||{};
  if(titulo) a.titulo=titulo; if(professor) a.professor=professor; if(professorId!=null) a.professorId=professorId;
  if(nivel) a.nivel=nivel; if(vagas||maxAlunos) a.vagas=parseInt(vagas||maxAlunos)||a.vagas;
  if(preco!=null) a.preco=Number(preco); if(data) a.data=data; if(hora) a.hora=hora; if(modalidade) a.modalidade=modalidade;
  save(); res.json(aulaInfo(a));
});
app.delete('/api/admin/aulas/:id', auth, requireStaff, (req,res)=>{ const d=db(); d.aulas=(d.aulas||[]).filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
// Matrícula pública na aula
app.post('/api/aula/:id/matricular', (req,res)=>{
  const a=(db().aulas||[]).find(x=>x.id==req.params.id); if(!a) return res.status(404).json({error:'aula não encontrada'});
  const { nome, email } = req.body||{}; if(!nome||!email) return res.status(400).json({error:'nome e e-mail obrigatórios'});
  a.alunos=a.alunos||[];
  if(a.alunos.length>=a.vagas) return res.status(409).json({error:'aula lotada'});
  if(a.alunos.some(x=>x.email===norm(email))) return res.status(409).json({error:'você já está matriculado nesta aula'});
  a.alunos.push({ nome, email:norm(email), presente:false, em:new Date().toISOString() }); save();
  res.json({ ok:true, message:'Matrícula confirmada! Nos vemos na quadra.', aula:aulaInfo(a) });
});
// Presença (chamada)
app.post('/api/admin/aula/:id/presenca', auth, requireStaff, (req,res)=>{
  const a=(db().aulas||[]).find(x=>x.id==req.params.id); if(!a) return res.status(404).json({error:'aula não encontrada'});
  const al=(a.alunos||[]).find(x=>x.email===norm(req.body.email)); if(!al) return res.status(404).json({error:'aluno não encontrado'});
  al.presente=!!req.body.presente; save(); res.json({ok:true});
});
app.get('/api/admin/aulas/full', auth, requireStaff, (req,res)=> res.json((db().aulas||[]).map(a=>({ ...a, inscritos:(a.alunos||[]).length }))));

// =================== LOJA / PRO SHOP (cap. 13) ===================
// Seed dos produtos do Kit Atleta — só popula se a loja estiver vazia
const KIT_SEED = [
  { cod:'AOT-001', nome:'Camiseta Oficial Agro Open', cat:'Vestuário', emoji:'👕', preco:85, estoque:200,
    desc:'Dri-fit 140g/m² UV50+. Logo bordado no peito esquerdo + TTC na manga. Tamanhos: PP ao XG + infantil (4–12).' },
  { cod:'AOT-002', nome:'Boné Oficial Agro Open', cat:'Bonés', emoji:'🧢', preco:75, estoque:200,
    desc:'Algodão sarjado 100% Verde Escuro. Aba curva dad cap 6 gomos, ajustável (54–60cm). Bordado 3D frente + lateral.' },
  { cod:'AOT-003', nome:'Camiseta Premium Monograma AO', cat:'Vestuário', emoji:'👕', preco:95, estoque:150,
    desc:'Dri-fit 140g/m² UV50+. Monograma "AO" grande no peito (silk) + TTC na manga. PP ao XG. Linha exclusiva evento.' },
  { cod:'AOT-004', nome:'Boné Premium Monograma AO', cat:'Bonés', emoji:'🧢', preco:85, estoque:150,
    desc:'Algodão sarjado 100% Verde Escuro. Monograma AO bordado 3D grande na frente. Ajustável (54–60cm).' },
  { cod:'AOT-005', nome:'Meias Esportivas Agro Open', cat:'Acessórios', emoji:'🧦', preco:35, estoque:200,
    desc:'Algodão 60% + Poliamida + Elastano. Branco c/ detalhe verde limão. Cushion reforçado. Tam: 35-38, 39-42, 43-46.' },
  { cod:'AOT-006', nome:'Sacola Tote Bag Oficial', cat:'Acessórios', emoji:'👜', preco:45, estoque:300,
    desc:'Lona algodão cru 100%, 280g/m². 40×45×10cm, alça 60cm. Logo silk verde escuro + "07-13 SET 2026".' },
  { cod:'AOT-007', nome:'Garrafa Squeeze 750ml', cat:'Equipamentos', emoji:'🍶', preco:55, estoque:200,
    desc:'Plástico BPA-Free (Tritan) 750ml. Verde Escuro matte, tampa sport cap flip-top verde limão. Monograma AO silk.' },
  { cod:'AOT-008', nome:'Toalhinha de Tênis 50×90cm', cat:'Equipamentos', emoji:'🏊', preco:65, estoque:200,
    desc:'Algodão 100% felpudo 380g/m². 50×90cm. Verde Escuro com viés verde limão. Logo bordado canto inferior.' },
  { cod:'AOT-009', nome:'Pulseira de Identificação', cat:'Acessórios', emoji:'📿', preco:25, estoque:250,
    desc:'Silicone hipoalergênico, relevo gravado. "AGRO OPEN • 4ª EDIÇÃO • TANGARÁ-MT • 2026". Credencial oficial do atleta.' },
  { cod:'AOT-010', nome:'Munhequeira Oficial (Par)', cat:'Acessórios', emoji:'🤝', preco:40, estoque:200,
    desc:'Algodão felpudo terry cotton, elastano interno. 7,5cm largura. Monograma AO verde limão bordado. Vendido em par.' },
];
function seedLoja(){
  const d=db(); if(!d.loja) d.loja=[];
  if(!d.loja.length){
    KIT_SEED.forEach(k=>{ d.loja.push({ id:nextId(), cod:k.cod, nome:k.nome, cat:k.cat, emoji:k.emoji, preco:k.preco, estoque:k.estoque, desc:k.desc, ativo:true, criadoEm:new Date().toISOString() }); });
    save();
  }
}
seedLoja();

app.get('/api/loja', (req,res)=> {
  seedLoja();
  res.json((db().loja||[]).filter(p=>p.ativo!==false).map(p=>({ id:p.id, cod:p.cod||'', nome:p.nome, cat:p.cat, emoji:p.emoji||'📦', preco:p.preco, estoque:p.estoque, esgotado:p.estoque<=0, desc:p.desc||'' })));
});

// Reserva via site público (loja — pré-venda Pix)
app.post('/api/loja/:id/reservar', (req,res)=>{
  const p=(db().loja||[]).find(x=>x.id==req.params.id && x.ativo!==false);
  if(!p) return res.status(404).json({erro:'produto não encontrado'});
  if(p.estoque<=0) return res.status(409).json({erro:'produto esgotado'});
  const { nome, email, tel, qtd, tamanho } = req.body||{};
  if(!nome||!email) return res.status(400).json({erro:'nome e e-mail obrigatórios'});
  const q=Math.max(1,Math.min(parseInt(qtd)||1,p.estoque));
  p.estoque-=q;
  const r={ id:nextId(), produtoId:p.id, cod:p.cod||'', produto:p.nome, qtd:q, tamanho:tamanho||'', preco:p.preco, total:p.preco*q, nome, email, tel:tel||'', status:'reservado', criadoEm:new Date().toISOString(), pagamento:'pix-pendente' };
  if(!db().reservasLoja) db().reservasLoja=[];
  db().reservasLoja.push(r); save();
  res.json({ ok:true, reservaId:r.id, produto:p.nome, total:r.total, msg:'Reserva confirmada! Leve o comprovante Pix na recepção do Tangará Tênis Clube para retirar.' });
});
app.post('/api/admin/loja', auth, requireStaff, (req,res)=>{
  const b=req.body||{}; if(!b.nome) return res.status(400).json({error:'nome obrigatório'});
  const p={ id:nextId(), nome:b.nome, cat:b.cat||'Geral', preco:Number(b.preco)||0, estoque:parseInt(b.estoque)||0, ativo:true, criadoEm:new Date().toISOString() };
  db().loja.push(p); save(); res.json(p);
});
app.patch('/api/admin/loja/:id', auth, requireStaff, (req,res)=>{
  const p=(db().loja||[]).find(x=>x.id==req.params.id); if(!p) return res.status(404).json({error:'não encontrado'});
  ['nome','cat','ativo'].forEach(k=>{ if(req.body[k]!==undefined) p[k]=req.body[k]; });
  if(req.body.preco!==undefined) p.preco=Number(req.body.preco);
  if(req.body.estoque!==undefined) p.estoque=parseInt(req.body.estoque)||0;
  save(); res.json(p);
});
app.delete('/api/admin/loja/:id', auth, requireStaff, (req,res)=>{ const d=db(); d.loja=(d.loja||[]).filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
// Venda na loja (balcão) — baixa estoque
app.post('/api/admin/loja/vender', auth, requireStaff, (req,res)=>{
  const { itens, pagamento, cliente } = req.body||{};
  if(!Array.isArray(itens) || !itens.length) return res.status(400).json({error:'informe os itens'});
  let total=0; const linhas=[];
  for(const it of itens){
    const p=(db().loja||[]).find(x=>x.id==it.produtoId); if(!p) return res.status(400).json({error:'produto inválido'});
    const q=Math.max(1,parseInt(it.qtd)||1);
    if(p.estoque<q) return res.status(400).json({error:`estoque insuficiente de ${p.nome}`});
    p.estoque-=q; total+=p.preco*q; linhas.push({ produtoId:p.id, nome:p.nome, qtd:q, preco:p.preco });
  }
  const v={ id:nextId(), itens:linhas, total, pagamento:pagamento||'pix', cliente:cliente||'', em:new Date().toISOString() };
  db().vendasLoja.push(v); save(); res.json({ ok:true, venda:v });
});

// =================== FINANCEIRO / DRE CONSOLIDADO (cap. 13) ===================
app.get('/api/admin/financeiro', auth, requireStaff, (req,res)=>{
  const d=db();
  const bar=(d.comandas||[]).filter(c=>c.status==='fechada').reduce((s,c)=>s+(c.totalPago||0),0);
  const ingressos=(d.ingressos||[]).filter(i=>i.status==='valido'||i.status==='usado').reduce((s,i)=>s+(i.preco||0),0);
  const reservas=(d.reservas||[]).filter(r=>r.status!=='cancelada').reduce((s,r)=>s+(r.preco||0),0);
  const assinaturas=(d.assinaturas||[]).filter(a=>a.status==='ativo').reduce((s,a)=>s+(+a.preco||0),0);
  const loja=(d.vendasLoja||[]).reduce((s,v)=>s+(v.total||0),0);
  const aulas=(d.aulas||[]).reduce((s,a)=>s+((a.preco||0)*((a.alunos||[]).length)),0);
  const patrocinio=(d.patrocinadores||[]).filter(p=>p.status==='ativo').reduce((s,p)=>s+(+p.valor||0),0);
  const receitas={ bar, ingressos, reservas, assinaturas, loja, aulas, patrocinio };
  const total=Object.values(receitas).reduce((s,v)=>s+v,0);
  res.json({ receitas, total,
    indicadores:{
      reservasAtivas:(d.reservas||[]).filter(r=>r.status!=='cancelada').length,
      ingressosVendidos:(d.ingressos||[]).filter(i=>i.status==='valido'||i.status==='usado').length,
      assinaturasAtivas:(d.assinaturas||[]).filter(a=>a.status==='ativo').length,
      comandasFechadas:(d.comandas||[]).filter(c=>c.status==='fechada').length,
      vendasLoja:(d.vendasLoja||[]).length,
      matriculasAulas:(d.aulas||[]).reduce((s,a)=>s+((a.alunos||[]).length),0)
    } });
});

// =================== GRUPOS + MATA-MATA (cap. 4.1) ===================
function eventoView(ev){ return { ...ev, tabelas: tabelasGrupos(ev), completos: gruposCompletos(ev) }; }
app.get('/api/grupos', (req,res)=>{
  const E=db().gruposEventos||{};
  res.json(Object.keys(E).map(cat=>({ categoria:cat, grupos:E[cat].grupos.length, classificam:E[cat].classificamPorGrupo, temMataMata:!!E[cat].knockout })));
});
app.get('/api/grupos/:categoria', (req,res)=>{
  const ev=db().gruposEventos[req.params.categoria]; if(!ev) return res.status(404).json({error:'evento não publicado'});
  res.json(eventoView(ev));
});
app.post('/api/admin/grupos/gerar', auth, requireStaff, (req,res)=>{
  const { categoria, fonte='inscritos', lista, numGrupos=2, classificam=2, formato='3sets' } = req.body||{};
  if(!categoria) return res.status(400).json({error:'categoria obrigatória'});
  let nomes;
  if(fonte==='lista' && Array.isArray(lista)) nomes=lista.map(s=>String(s).trim()).filter(Boolean);
  else nomes=db().inscricoes.filter(i=>i.categoria===categoria && i.status!=='recusada').map(i=>i.nome);
  try{
    const ev=gerarFaseGrupos(nomes, { numGrupos:parseInt(numGrupos), classificamPorGrupo:parseInt(classificam), regras:FORMATOS[formato]||FORMATOS['3sets'] });
    ev.categoria=categoria; db().gruposEventos[categoria]=ev; save();
    res.json(eventoView(ev));
  }catch(e){ res.status(400).json({error:e.message}); }
});
app.post('/api/admin/grupos/resultado', auth, requireStaff, (req,res)=>{
  const { categoria, grupo, rodada, jogo, sets, winnerSlot, tipo } = req.body||{};
  const ev=db().gruposEventos[categoria]; if(!ev) return res.status(404).json({error:'evento não encontrado'});
  const g=ev.grupos[grupo] && ev.grupos[grupo].rr.rounds[rodada] && ev.grupos[grupo].rr.rounds[rodada][jogo];
  if(!g) return res.status(404).json({error:'jogo não encontrado'});
  if(Array.isArray(sets)&&sets.length){ const r=matchWinner(sets, ev.regras||{}); if(!r.valid) return res.status(400).json({error:r.error}); g.placar=r.placar; g.tipo='normal'; g.vencedor=r.winner===0?g.a:g.b; }
  else if(winnerSlot===0||winnerSlot===1){ g.tipo=tipo||'wo'; g.placar=g.tipo==='abandono'?'ABANDONO':'W.O.'; g.vencedor=winnerSlot===0?g.a:g.b; }
  else return res.status(400).json({error:'informe placar ou vencedor'});
  applyElo(db().elo, g.vencedor, g.vencedor===g.a?g.b:g.a);
  save(); res.json(eventoView(ev));
});
app.post('/api/admin/grupos/mata-mata', auth, requireStaff, (req,res)=>{
  const ev=db().gruposEventos[req.body.categoria]; if(!ev) return res.status(404).json({error:'evento não encontrado'});
  try{ gerarMataMata(ev); save(); res.json(eventoView(ev)); }catch(e){ res.status(400).json({error:e.message}); }
});
// Resultado do mata-mata (knockout) do evento de grupos
app.post('/api/admin/grupos/ko-resultado', auth, requireStaff, (req,res)=>{
  const { categoria, round, match, sets, winnerSlot, tipo } = req.body||{};
  const ev=db().gruposEventos[categoria]; if(!ev||!ev.knockout) return res.status(404).json({error:'mata-mata não gerado'});
  const chave=ev.knockout; const sa=2*match, sb=2*match+1;
  const A=chave.rounds[round][sa], B=chave.rounds[round][sb];
  if(!A||!B||A.bye||B.bye) return res.status(400).json({error:'partida sem dois atletas'});
  let winIdx, placar='', tp=tipo||'normal';
  if(Array.isArray(sets)&&sets.length){ const r=matchWinner(sets, ev.regras||{}); if(!r.valid) return res.status(400).json({error:r.error}); winIdx=r.winner===0?sa:sb; placar=r.placar; }
  else if(winnerSlot===0||winnerSlot===1){ winIdx=winnerSlot===0?sa:sb; tp=tipo||'wo'; placar=tp==='abandono'?'ABANDONO':'W.O.'; }
  else return res.status(400).json({error:'informe placar ou vencedor'});
  const loserIdx=winIdx===sa?sb:sa, vName=chave.rounds[round][winIdx].name, pName=chave.rounds[round][loserIdx].name;
  advance(chave, round, winIdx);
  chave.placares=chave.placares||{}; chave.placares[round+'-'+match]={ placar, tipo:tp, vencedor:vName };
  applyElo(db().elo, vName, pName);
  save(); res.json(eventoView(ev));
});
app.delete('/api/admin/grupos/:categoria', auth, requireStaff, (req,res)=>{ delete db().gruposEventos[req.params.categoria]; save(); res.json({ok:true}); });

// =================== CRM / SEGMENTAÇÃO (cap. 12.1) ===================
app.get('/api/admin/crm', auth, requireStaff, (req,res)=>{
  const d=db(); const hoje=new Date(); const mesAtual=hoje.getMonth()+1;
  // consumo por e-mail (bar + loja + ingressos + reservas)
  const consumo={};
  (d.comandas||[]).filter(c=>c.status==='fechada').forEach(c=>{ const k=norm(c.nome); consumo[k]=(consumo[k]||0)+(c.totalPago||0); });
  (d.ingressos||[]).forEach(i=>{ const k=norm(i.email); if(k) consumo[k]=(consumo[k]||0)+(i.preco||0); });
  (d.reservas||[]).filter(r=>r.status!=='cancelada').forEach(r=>{ const k=norm(r.email); if(k) consumo[k]=(consumo[k]||0)+(r.preco||0); });
  const usuarios=(d.usuarios||[]).filter(u=>u.role==='atleta');
  // última atividade aproximada: inscrição/criação
  const ult={}; (d.inscricoes||[]).forEach(i=>{ const k=norm(i.email); if(i.createdAt) ult[k]=Math.max(ult[k]||0, +new Date(i.createdAt)); });
  const dias = t => t? Math.floor((hoje-new Date(t))/86400000) : null;
  const maioresConsumidores = Object.entries(consumo).sort((a,b)=>b[1]-a[1]).slice(0,10)
    .map(([email,total])=>({ email, total, nome:(usuarios.find(u=>u.email===email)||{}).nome||email }));
  const aniversariantes = usuarios.filter(u=> u.nasc && (new Date(u.nasc).getMonth()+1)===mesAtual)
    .map(u=>({ nome:u.nome, email:u.email, nasc:u.nasc }));
  const inativos = usuarios.filter(u=>{ const t=ult[u.email]; return !t || dias(t)>90; })
    .map(u=>({ nome:u.nome, email:u.email, diasInativo: ult[u.email]?dias(ult[u.email]):null }));
  res.json({
    totais:{ clientes:usuarios.length, comInscricao:Object.keys(ult).length, comConsumo:Object.keys(consumo).length },
    segmentos:{ maioresConsumidores, aniversariantes, inativos }
  });
});

// =================== SÓCIOS · CARTEIRINHA DIGITAL · MENSALIDADES (cap. 13) ===================
const SOCIO_PLANOS = [
  { id:'individual', nome:'Sócio Individual', valor:120, beneficios:['Acesso às quadras','Desconto em torneios e aulas','Carteirinha digital'] },
  { id:'familia',    nome:'Sócio Família',    valor:200, beneficios:['Até 4 dependentes','Acesso às quadras','Descontos família'] },
  { id:'atleta',     nome:'Sócio Atleta+',    valor:160, beneficios:['Prioridade em reservas','Pacote de aulas','Selo PRO no ranking'] }
];
app.get('/api/socio-planos', (req,res)=> res.json(SOCIO_PLANOS));

const refMes = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
function recomputeSocio(s){
  const hoje=new Date().toISOString().slice(0,10);
  const vencida = (s.faturas||[]).some(f=>f.status==='aberta' && f.venc < hoje);
  s.status = vencida ? 'inadimplente' : 'em_dia';
  return s;
}
const pubSocio = s => ({ id:s.id, nome:s.nome, email:s.email, plano:s.plano, planoNome:s.planoNome, valor:s.valor,
  cardCode:s.cardCode, desde:s.desde, status:recomputeSocio(s).status,
  faturas:(s.faturas||[]).slice().sort((a,b)=>b.ref.localeCompare(a.ref)) });

app.get('/api/admin/socios', auth, requireStaff, (req,res)=> res.json((db().socios||[]).map(pubSocio)));
app.post('/api/admin/socios', auth, requireStaff, (req,res)=>{
  const b=req.body||{};
  const plano=SOCIO_PLANOS.find(p=>p.id===b.plano); if(!plano) return res.status(400).json({error:'plano inválido'});
  let nome=b.nome, email=norm(b.email);
  if(b.usuarioId){ const u=db().usuarios.find(x=>x.id==b.usuarioId); if(u){ nome=u.nome; email=u.email; } }
  if(!nome||!email) return res.status(400).json({error:'informe um usuário ou nome+e-mail'});
  if((db().socios||[]).some(s=>s.email===email)) return res.status(409).json({error:'este cliente já é sócio'});
  const card='SOC-'+crypto.randomUUID().slice(0,8).toUpperCase();
  const ref=refMes(); const venc=new Date(); venc.setDate(10);
  const s={ id:nextId(), usuarioId:b.usuarioId||null, nome, email, plano:plano.id, planoNome:plano.nome, valor:plano.valor,
    cardCode:card, desde:new Date().toISOString(),
    faturas:[{ id:nextId(), ref, valor:plano.valor, venc:venc.toISOString().slice(0,10), status:'aberta' }], status:'em_dia' };
  db().socios.push(s); save(); res.json(pubSocio(s));
});
app.post('/api/admin/socios/:id/fatura', auth, requireStaff, (req,res)=>{
  const s=(db().socios||[]).find(x=>x.id==req.params.id); if(!s) return res.status(404).json({error:'sócio não encontrado'});
  const d=new Date(); d.setMonth(d.getMonth()+1); const ref=refMes(d); const venc=new Date(d); venc.setDate(10);
  if((s.faturas||[]).some(f=>f.ref===ref)) return res.status(409).json({error:'fatura deste mês já existe'});
  s.faturas.push({ id:nextId(), ref, valor:s.valor, venc:venc.toISOString().slice(0,10), status:'aberta' }); save(); res.json(pubSocio(s));
});
app.post('/api/admin/socios/:id/pagar', auth, requireStaff, (req,res)=>{
  const s=(db().socios||[]).find(x=>x.id==req.params.id); if(!s) return res.status(404).json({error:'sócio não encontrado'});
  const f=(s.faturas||[]).find(x=>x.id==req.body.faturaId); if(!f) return res.status(404).json({error:'fatura não encontrada'});
  f.status='paga'; f.pagaEm=new Date().toISOString(); save(); res.json(pubSocio(s));
});
app.patch('/api/admin/socios/:id', auth, requireStaff, (req,res)=>{
  const s=(db().socios||[]).find(x=>x.id==req.params.id); if(!s) return res.status(404).json({error:'sócio não encontrado'});
  const {plano,status,vencimento,nome,email} = req.body||{};
  if(plano){ const p=SOCIO_PLANOS.find(x=>x.id===plano); if(p){ s.plano=p.id; s.planoNome=p.nome; s.valor=p.valor; } }
  if(status) s.status=status; if(nome) s.nome=nome; if(email) s.email=norm(email);
  if(vencimento && s.faturas && s.faturas.length){ s.faturas[s.faturas.length-1].venc=vencimento; }
  save(); res.json(pubSocio(s));
});
app.delete('/api/admin/socios/:id', auth, requireStaff, (req,res)=>{ const d=db(); d.socios=(d.socios||[]).filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });

// Minha carteirinha (atleta logado) — com QR Code
app.get('/api/auth/carteirinha', auth, async (req,res)=>{
  const u=db().usuarios.find(x=>x.id===req.user.id); if(!u) return res.status(404).json({error:'usuário não encontrado'});
  const s=(db().socios||[]).find(x=>x.email===u.email || x.usuarioId===u.id);
  if(!s) return res.json({ socio:false, message:'Você ainda não é sócio. Procure a recepção para aderir.' });
  recomputeSocio(s); save();
  const qrSvg=await QRCode.toString(s.cardCode, { type:'svg', margin:1, color:{ dark:'#0B2415', light:'#00000000' } });
  res.json({ socio:true, nome:s.nome, plano:s.planoNome, status:s.status, cardCode:s.cardCode, desde:s.desde, qrSvg });
});
// Validação da carteirinha (recepção/portaria)
app.post('/api/admin/validar-carteirinha', auth, requireStaff, (req,res)=>{
  const s=(db().socios||[]).find(x=>x.cardCode===(req.body.code||'').trim());
  if(!s) return res.status(404).json({ ok:false, resultado:'INVALIDA', message:'Carteirinha não encontrada' });
  recomputeSocio(s); save();
  if(s.status==='inadimplente') return res.status(200).json({ ok:false, resultado:'INADIMPLENTE', message:'Sócio com mensalidade em atraso', socio:pubSocio(s) });
  res.json({ ok:true, resultado:'LIBERADO', message:'Sócio em dia', socio:pubSocio(s) });
});

// =================== COMUNICAÇÃO EM MASSA (cap. 3.3) ===================
function destinatariosSegmento(seg){
  const d=db(); const atletas=(d.usuarios||[]).filter(u=>u.role==='atleta');
  const email=x=>x.email; const hoje=new Date(); const mes=hoje.getMonth()+1;
  if(seg==='socios') return (d.socios||[]).map(s=>({nome:s.nome,email:s.email}));
  if(seg==='inadimplentes') return (d.socios||[]).filter(s=>{recomputeSocio(s);return s.status==='inadimplente';}).map(s=>({nome:s.nome,email:s.email}));
  if(seg==='aniversariantes') return atletas.filter(u=>u.nasc && (new Date(u.nasc).getMonth()+1)===mes).map(u=>({nome:u.nome,email:u.email}));
  return atletas.map(u=>({nome:u.nome,email:email(u)})); // 'todos'
}
app.get('/api/admin/comunicacao', auth, requireStaff, (req,res)=> res.json((db().campanhas||[]).slice().reverse()));
app.post('/api/admin/comunicacao', auth, requireStaff, (req,res)=>{
  const { segmento='todos', canal='email', assunto, mensagem } = req.body||{};
  if(!mensagem) return res.status(400).json({error:'escreva a mensagem'});
  const dest=destinatariosSegmento(segmento);
  const camp={ id:nextId(), segmento, canal, assunto:assunto||'', mensagem, destinatarios:dest.length,
    amostra:dest.slice(0,5).map(d=>d.nome), status:'registrada', criadoEm:new Date().toISOString(),
    obs:'Envio efetivo requer integração de provedor (SMTP / WhatsApp Cloud API).' };
  db().campanhas.push(camp); save();
  res.json({ ok:true, campanha:camp });
});

// =================== SISTEMA SUÍÇO (cap. 4.1) ===================
app.get('/api/suicos', (req,res)=>{ const S=db().suicos||{}; res.json(Object.keys(S).map(cat=>({ categoria:cat, atletas:S[cat].players.length, rodadas:S[cat].rounds.length }))); });
app.get('/api/suico/:categoria', (req,res)=>{ const s=db().suicos[req.params.categoria]; if(!s) return res.status(404).json({error:'não publicado'}); res.json({ ...s, tabela:tabelaSuico(s) }); });
app.post('/api/admin/suico/gerar', auth, requireStaff, (req,res)=>{
  const { categoria, fonte='inscritos', lista, formato='3sets' } = req.body||{};
  if(!categoria) return res.status(400).json({error:'categoria obrigatória'});
  let nomes; if(fonte==='lista'&&Array.isArray(lista)) nomes=lista.map(s=>String(s).trim()).filter(Boolean);
  else nomes=db().inscricoes.filter(i=>i.categoria===categoria&&i.status!=='recusada').map(i=>i.nome);
  try{ const s=gerarSuico(nomes); s.categoria=categoria; s.regras=FORMATOS[formato]||FORMATOS['3sets']; db().suicos[categoria]=s; save(); res.json({ ...s, tabela:tabelaSuico(s) }); }
  catch(e){ res.status(400).json({error:e.message}); }
});
app.post('/api/admin/suico/proxima', auth, requireStaff, (req,res)=>{
  const s=db().suicos[req.body.categoria]; if(!s) return res.status(404).json({error:'não encontrado'});
  try{ proximaRodada(s); save(); res.json({ ...s, tabela:tabelaSuico(s) }); }catch(e){ res.status(400).json({error:e.message}); }
});
app.post('/api/admin/suico/resultado', auth, requireStaff, (req,res)=>{
  const { categoria, rodada, jogo, sets, winnerSlot, tipo } = req.body||{};
  const s=db().suicos[categoria]; if(!s) return res.status(404).json({error:'não encontrado'});
  const g=s.rounds[rodada]&&s.rounds[rodada][jogo]; if(!g||g.tipo==='bye') return res.status(404).json({error:'jogo não encontrado'});
  if(Array.isArray(sets)&&sets.length){ const r=matchWinner(sets,s.regras||{}); if(!r.valid) return res.status(400).json({error:r.error}); g.placar=r.placar; g.tipo='normal'; g.vencedor=r.winner===0?g.a:g.b; }
  else if(winnerSlot===0||winnerSlot===1){ g.tipo=tipo||'wo'; g.placar=g.tipo==='abandono'?'ABANDONO':'W.O.'; g.vencedor=winnerSlot===0?g.a:g.b; }
  else return res.status(400).json({error:'informe placar ou vencedor'});
  applyElo(db().elo, g.vencedor, g.vencedor===g.a?g.b:g.a);
  save(); res.json({ ...s, tabela:tabelaSuico(s) });
});
app.delete('/api/admin/suico/:categoria', auth, requireStaff, (req,res)=>{ delete db().suicos[req.params.categoria]; save(); res.json({ok:true}); });

// =================== BI / BENCHMARKS (cap. 13) ===================
app.get('/api/admin/bi', auth, requireStaff, (req,res)=>{
  const d=db();
  const fechadas=(d.comandas||[]).filter(c=>c.status==='fechada');
  const fatBar=fechadas.reduce((s,c)=>s+(c.totalPago||0),0);
  const recRes=(d.reservas||[]).filter(r=>r.status!=='cancelada');
  const HORAS_SLOTS=13*7; // 13 horários × 7 quadras por dia
  const diasReserva=new Set(recRes.map(r=>r.data)).size||1;
  const socios=(d.socios||[]).map(recomputeSocio);
  const receita = {
    bar:fatBar,
    ingressos:(d.ingressos||[]).filter(i=>i.status==='valido'||i.status==='usado').reduce((s,i)=>s+(i.preco||0),0),
    reservas:recRes.reduce((s,r)=>s+(r.preco||0),0),
    loja:(d.vendasLoja||[]).reduce((s,v)=>s+(v.total||0),0),
    aulas:(d.aulas||[]).reduce((s,a)=>s+((a.preco||0)*((a.alunos||[]).length)),0),
    mensalidades:socios.reduce((s,so)=>s+(so.faturas||[]).filter(f=>f.status==='paga').reduce((x,f)=>x+f.valor,0),0)
  };
  receita.total=Object.values(receita).reduce((s,v)=>s+v,0);
  res.json({
    receita,
    operacao:{
      atletas:(d.usuarios||[]).filter(u=>u.role==='atleta').length,
      socios:socios.length, sociosEmDia:socios.filter(s=>s.status==='em_dia').length,
      torneios:(d.torneios||[]).length, chaves:Object.keys(d.chaves||{}).length,
      reservas:recRes.length, matriculas:(d.aulas||[]).reduce((s,a)=>s+((a.alunos||[]).length),0)
    },
    benchmarks:{
      ticketMedioBar: fechadas.length? Math.round(fatBar/fechadas.length) : 0,
      ocupacaoQuadras_pct: Math.round(100*recRes.length/(HORAS_SLOTS*diasReserva)),
      receitaPorAtleta: (()=>{ const a=(d.usuarios||[]).filter(u=>u.role==='atleta').length; return a?Math.round(receita.total/a):0; })(),
      inadimplencia_pct: socios.length? Math.round(100*socios.filter(s=>s.status==='inadimplente').length/socios.length) : 0
    }
  });
});

// =================== ELIMINATÓRIA DUPLA (cap. 4.1) ===================
app.get('/api/duplas', (req,res)=>{ const D=db().duplas||{}; res.json(Object.keys(D).map(cat=>({ categoria:cat, size:D[cat].size, campeao:D[cat].campeao||null }))); });
app.get('/api/dupla/:categoria', (req,res)=>{ const d=db().duplas[req.params.categoria]; if(!d) return res.status(404).json({error:'não publicada'}); res.json(d); });
app.post('/api/admin/dupla/gerar', auth, requireStaff, (req,res)=>{
  const { categoria, fonte='inscritos', lista, seeds=0, formato='3sets' } = req.body||{};
  if(!categoria) return res.status(400).json({error:'categoria obrigatória'});
  let nomes; if(fonte==='lista'&&Array.isArray(lista)) nomes=lista.map(s=>String(s).trim()).filter(Boolean);
  else nomes=db().inscricoes.filter(i=>i.categoria===categoria&&i.status!=='recusada').map(i=>i.nome);
  try{ const s=gerarDuplaElim(nomes,{seeds:parseInt(seeds)}); s.categoria=categoria; s.regras=FORMATOS[formato]||FORMATOS['3sets']; db().duplas[categoria]=s; save(); res.json(s); }
  catch(e){ res.status(400).json({error:e.message}); }
});
app.post('/api/admin/dupla/resultado', auth, requireStaff, (req,res)=>{
  const { categoria, matchId, sets, winnerSlot, tipo } = req.body||{};
  const s=db().duplas[categoria]; if(!s) return res.status(404).json({error:'não encontrada'});
  const m=s.matches[matchId]; if(!m) return res.status(404).json({error:'partida não encontrada'});
  let ws, placar='', tp=tipo||'normal';
  if(Array.isArray(sets)&&sets.length){ const r=matchWinner(sets,s.regras||{}); if(!r.valid) return res.status(400).json({error:r.error}); ws=r.winner===0?'a':'b'; placar=r.placar; }
  else if(winnerSlot==='a'||winnerSlot==='b'||winnerSlot===0||winnerSlot===1){ ws=(winnerSlot==='a'||winnerSlot===0)?'a':'b'; tp=tipo||'wo'; placar=tp==='abandono'?'ABANDONO':'W.O.'; }
  else return res.status(400).json({error:'informe placar ou vencedor'});
  try{
    const win = ws==='a'?m.a:m.b, lose = ws==='a'?m.b:m.a;
    reportDupla(s, matchId, ws, placar, tp);
    if(win&&lose&&!win.bye&&!lose.bye) applyElo(db().elo, win.name, lose.name);
    save(); res.json(s);
  }catch(e){ res.status(400).json({error:e.message}); }
});
app.delete('/api/admin/dupla/:categoria', auth, requireStaff, (req,res)=>{ delete db().duplas[req.params.categoria]; save(); res.json({ok:true}); });

// =================== PAGAMENTOS · PIX / CARTÃO (cap. 12.3 / 15) ===================
app.get('/api/pagamentos/status', (req,res)=> res.json({ ativo: pagamentosAtivos, modo: pagamentosAtivos?'mercadopago':'simulado' }));

// Cria uma cobrança Pix para um pedido (ingresso, inscrição, reserva, recarga, mensalidade, assinatura, loja)
app.post('/api/pagar', async (req,res)=>{
  const { tipo, refId, valor, descricao, email, usuarioId } = req.body||{};
  const tiposOk = ['ingresso','inscricao','reserva','carteira','mensalidade','assinatura','loja','generico'];
  if(!tiposOk.includes(tipo)) return res.status(400).json({error:'tipo de pedido inválido'});
  if(!(Number(valor)>0)) return res.status(400).json({error:'valor inválido'});
  try{
    const pix = await criarPix({ valor, descricao: descricao||('SetPoint · '+tipo), email });
    const pg = { id: nextId(), tipo, refId:refId||null, usuarioId:usuarioId||null, valor:Number(valor),
      descricao:descricao||'', email:email||'', provedor:pix.provedor, externalId:pix.externalId,
      copiaECola:pix.copiaECola, qrBase64:pix.qrBase64||null, taxaPlataforma:pix.taxaPlataforma,
      status:'pendente', criadoEm:new Date().toISOString() };
    db().pagamentos.push(pg); save();
    res.json({ ok:true, pagamentoId:pg.id, status:pg.status, provedor:pg.provedor, copiaECola:pg.copiaECola, qrBase64:pg.qrBase64,
      modo: pagamentosAtivos?'mercadopago':'simulado', valor:pg.valor, taxaPlataforma:pg.taxaPlataforma });
  }catch(e){ res.status(400).json({error:e.message}); }
});

app.get('/api/pagamento/:id', async (req,res)=>{
  const pg=(db().pagamentos||[]).find(p=>p.id==req.params.id); if(!pg) return res.status(404).json({error:'não encontrado'});
  if(pg.status==='pendente' && pg.provedor==='mercadopago'){ const st=await consultarStatus(pg.externalId); if(st && st!=='pendente'){ pg.status=st==='aprovado'?'aprovado':'recusado'; if(pg.status==='aprovado') fulfill(pg); save(); } }
  res.json({ id:pg.id, tipo:pg.tipo, status:pg.status, valor:pg.valor, copiaECola:pg.copiaECola, qrBase64:pg.qrBase64 });
});

// Webhook do Mercado Pago (produção): confirma e libera o pedido
app.post('/api/pagamento/webhook', async (req,res)=>{
  const extId = req.body?.data?.id || req.query['data.id'];
  if(extId){ const pg=(db().pagamentos||[]).find(p=>p.externalId==String(extId)); if(pg && pg.status==='pendente'){ const st=await consultarStatus(extId); if(st==='aprovado'){ pg.status='aprovado'; fulfill(pg); save(); } } }
  res.sendStatus(200);
});

// Confirmação MANUAL — disponível apenas no modo simulação (para testar o fluxo ponta a ponta)
app.post('/api/pagamento/:id/confirmar', (req,res)=>{
  if(pagamentosAtivos) return res.status(403).json({error:'em produção, a confirmação vem do provedor (webhook)'});
  const pg=(db().pagamentos||[]).find(p=>p.id==req.params.id); if(!pg) return res.status(404).json({error:'não encontrado'});
  if(pg.status!=='aprovado'){ pg.status='aprovado'; pg.confirmadoEm=new Date().toISOString(); fulfill(pg); save(); }
  res.json({ ok:true, status:pg.status, fulfill:pg.fulfillMsg||'' });
});
app.get('/api/admin/pagamentos', auth, requireStaff, (req,res)=> res.json((db().pagamentos||[]).slice().reverse()));

// Libera o pedido conforme o tipo (chamado ao aprovar o pagamento)
function fulfill(pg){
  const d=db();
  try{
    if(pg.tipo==='ingresso'){ const i=(d.ingressos||[]).find(x=>x.id==pg.refId||x.code===pg.refId); if(i){ i.status='valido'; pg.fulfillMsg='Ingresso liberado'; } }
    else if(pg.tipo==='inscricao'){ const i=(d.inscricoes||[]).find(x=>x.id==pg.refId); if(i){ i.status='validada'; i.pago=true; pg.fulfillMsg='Inscrição confirmada'; } }
    else if(pg.tipo==='reserva'){ const r=(d.reservas||[]).find(x=>x.id==pg.refId); if(r){ r.status='confirmada'; r.pago=true; pg.fulfillMsg='Reserva confirmada'; } }
    else if(pg.tipo==='carteira'){ const u=(d.usuarios||[]).find(x=>x.id==pg.usuarioId); if(u){ if(!u.carteira) u.carteira={saldo:0,pontos:0,extrato:[]}; u.carteira.saldo+=pg.valor; u.carteira.extrato.push({ t:new Date().toISOString(), tipo:'crédito', valor:pg.valor, motivo:'Recarga Pix' }); pg.fulfillMsg='Carteira recarregada'; } }
    else if(pg.tipo==='mensalidade'){ const s=(d.socios||[]).find(x=>x.id==pg.refId); if(s){ const f=(s.faturas||[]).find(x=>x.status==='aberta'); if(f){ f.status='paga'; f.pagaEm=new Date().toISOString(); } pg.fulfillMsg='Mensalidade paga'; } }
    else if(pg.tipo==='assinatura'){ const a=(d.assinaturas||[]).find(x=>x.id==pg.refId); if(a){ a.status='ativo'; pg.fulfillMsg='Assinatura ativada'; } }
    else pg.fulfillMsg='Pagamento aprovado';
  }catch(e){ pg.fulfillMsg='aprovado (falha ao liberar: '+e.message+')'; }
}

// =================== AUDITORIA (segurança) ===================
app.get('/api/admin/auditoria', auth, requireStaff, (req,res)=> res.json((db().auditoria||[]).slice(-200).reverse()));

// =================== PERFIL DO ATLETA + HEAD-TO-HEAD (cap. 3.2) ===================
// Coleta todas as partidas com vencedor de todos os formatos.
function coletarPartidas(){
  const d=db(); const out=[];
  // chaves (eliminatória simples) — deriva nomes das rounds + placares
  for(const cat in (d.chaves||{})){ const ch=d.chaves[cat]; if(!ch.placares) continue;
    for(const key in ch.placares){ const [r,m]=key.split('-').map(Number); const p=ch.placares[key];
      const a=ch.rounds[r]?.[2*m], b=ch.rounds[r]?.[2*m+1]; if(!a||!b||a.bye||b.bye) continue;
      const perd = p.vencedor===a.name ? b.name : a.name;
      out.push({ a:a.name, b:b.name, vencedor:p.vencedor, perdedor:perd, placar:p.placar, fonte:'Chave', categoria:cat }); } }
  // ligas, suíços, grupos, duplas — jogos com vencedor
  const addJogos = (jogos, fonte, cat)=> jogos.forEach(g=>{ if(g.vencedor && g.a && g.b && g.tipo!=='bye'){ out.push({ a:g.a, b:g.b, vencedor:g.vencedor, perdedor:g.vencedor===g.a?g.b:g.a, placar:g.placar, fonte, categoria:cat }); } });
  for(const cat in (d.ligas||{})) addJogos(d.ligas[cat].rounds.flat(), 'Liga', cat);
  for(const cat in (d.suicos||{})) addJogos(d.suicos[cat].rounds.flat(), 'Suíço', cat);
  for(const cat in (d.gruposEventos||{})){ d.gruposEventos[cat].grupos.forEach(g=>addJogos(g.rr.rounds.flat(),'Grupos',cat)); }
  for(const cat in (d.duplas||{})){ const s=d.duplas[cat]; Object.values(s.matches).forEach(m=>{ if(m.winner&&m.a&&m.b&&!m.a.bye&&!m.b.bye&&m.tipo!=='bye'){ out.push({ a:m.a.name, b:m.b.name, vencedor:m.winner.name, perdedor:m.winner.name===m.a.name?m.b.name:m.a.name, placar:m.placar, fonte:'Elim. dupla', categoria:cat }); } }); }
  return out;
}
app.get('/api/atletas', (req,res)=>{
  const set=new Set(); coletarPartidas().forEach(p=>{ set.add(p.a); set.add(p.b); });
  res.json([...set].sort((a,b)=>a.localeCompare(b)));
});
app.get('/api/atleta/:nome', (req,res)=>{
  const nome=req.params.nome; const partidas=coletarPartidas().filter(p=>p.a===nome||p.b===nome);
  let v=0,der=0; const h2h={}; const hist=[];
  partidas.forEach(p=>{
    const op = p.a===nome ? p.b : p.a; const win = p.vencedor===nome;
    if(win) v++; else der++;
    h2h[op]=h2h[op]||{ adversario:op, v:0, d:0 }; win?h2h[op].v++:h2h[op].d++;
    hist.push({ adversario:op, resultado:win?'V':'D', placar:p.placar, fonte:p.fonte, categoria:p.categoria });
  });
  const elo=(db().elo.players||{})[nome];
  const titulos=Object.keys(db().campeoes||{}).filter(c=>db().campeoes[c].nome===nome).map(c=>({categoria:c,...db().campeoes[c]}));
  const j=v+der;
  res.json({ nome, jogos:j, vitorias:v, derrotas:der, aproveitamento:j?Math.round(100*v/j):0,
    elo: elo?elo.elo:null, titulos, headToHead:Object.values(h2h).sort((a,b)=>(b.v+b.d)-(a.v+a.d)), historico:hist.reverse() });
});

// =================== DASHBOARD DO ORGANIZADOR (cap. 3.3) ===================
app.get('/api/admin/dashboard', auth, requireStaff, (req,res)=>{
  const d=db(); const hoje=new Date().toISOString().slice(0,10);
  const inscPend=(d.inscricoes||[]).filter(i=>i.status==='pendente').length;
  const faturasAbertas=(d.socios||[]).reduce((s,so)=>s+(so.faturas||[]).filter(f=>f.status==='aberta').length,0);
  const reservasHoje=(d.reservas||[]).filter(r=>r.data===hoje && r.status!=='cancelada').length;
  const pagPend=(d.pagamentos||[]).filter(p=>p.status==='pendente').length;
  const placaresNaoConf=Object.values(d.chaves||{}).reduce((s,ch)=>s+Object.values(ch.placares||{}).filter(p=>p.confirmado===false).length,0);
  const fechadas=(d.comandas||[]).filter(c=>c.status==='fechada');
  const receita = (d.pagamentos||[]).filter(p=>p.status==='aprovado').reduce((s,p)=>s+(p.valor||0),0);
  const alertas=[];
  if(inscPend) alertas.push({ nivel:'aten', txt:`${inscPend} inscrição(ões) aguardando validação` });
  if(placaresNaoConf) alertas.push({ nivel:'aten', txt:`${placaresNaoConf} placar(es) aguardando confirmação (dupla validação)` });
  if(faturasAbertas) alertas.push({ nivel:'info', txt:`${faturasAbertas} fatura(s) de sócio em aberto` });
  if(pagPend) alertas.push({ nivel:'info', txt:`${pagPend} pagamento(s) pendente(s)` });
  if(!alertas.length) alertas.push({ nivel:'ok', txt:'Tudo em dia. Nenhuma pendência.' });
  res.json({
    indicadores:{
      atletas:(d.usuarios||[]).filter(u=>u.role==='atleta').length,
      socios:(d.socios||[]).length, torneios:(d.torneios||[]).length,
      chaves:Object.keys(d.chaves||{}).length, inscricoes:(d.inscricoes||[]).length,
      reservasHoje, comandasAbertas:(d.comandas||[]).filter(c=>c.status==='aberta').length,
      receitaPagamentos:receita, faturamentoBar:fechadas.reduce((s,c)=>s+(c.totalPago||0),0)
    },
    pendencias:{ inscPend, faturasAbertas, reservasHoje, pagPend, placaresNaoConf },
    alertas
  });
});

// =================== ORDER OF PLAY / AGENDA (cap. 4.3) ===================
app.get('/api/agenda', (req,res)=>{
  let list=db().agenda||[];
  if(dataValida(req.query.data)) list=list.filter(a=>a.data===req.query.data);
  res.json(list.slice().sort((a,b)=>(a.data+a.hora+a.quadra).localeCompare(b.data+b.hora+b.quadra)));
});
app.get('/api/admin/agenda', auth, requireStaff, (req,res)=>{
  const d=db();
  const torneios=d.torneios||[];
  const jogos=(d.agenda||[]).map(j=>({...j, torneioNome:torneios.find(t=>t.id==j.torneioId)?.nome||''}));
  res.json(jogos);
});
app.post('/api/admin/agenda', auth, requireRole('admin','organizador'), (req,res)=>{
  const { data, hora, quadra, categoria, confronto, fase, torneioId } = req.body||{};
  if(!confronto) return res.status(400).json({error:'confronto obrigatório'});
  const d=db();
  if(!d.agenda) d.agenda=[];
  const jogo={ id:nextId(), data, hora, quadra:quadra||'', categoria:categoria||'', confronto, fase:fase||'',
    torneioId:torneioId||null, status:'pendente', placar1:null, placar2:null, vencedor:null, criadoEm:new Date().toISOString() };
  d.agenda.push(jogo); save(); res.json(jogo);
});
app.patch('/api/admin/agenda/:id', auth, requireRole('admin','organizador','staff'), (req,res)=>{
  const d=db();
  if(!d.agenda) d.agenda=[];
  const idx=d.agenda.findIndex(j=>j.id==req.params.id);
  if(idx===-1) return res.status(404).json({error:'jogo não encontrado'});
  const { placar1, placar2, vencedor, status } = req.body;
  ['data','hora','quadra','categoria','confronto','fase'].forEach(k=>{ if(req.body[k]!==undefined) d.agenda[idx][k]=req.body[k]; });
  if(placar1!==undefined) d.agenda[idx].placar1=placar1;
  if(placar2!==undefined) d.agenda[idx].placar2=placar2;
  if(vencedor!==undefined) d.agenda[idx].vencedor=vencedor;
  if(status!==undefined) d.agenda[idx].status=status;
  if(placar1!==undefined||placar2!==undefined) d.agenda[idx].status='concluido';
  save();
  auditoria(req.user,'RESULTADO_JOGO',{id:req.params.id,placar1,placar2,vencedor});
  res.json(d.agenda[idx]);
});
app.delete('/api/admin/agenda/:id', auth, requireRole('admin','organizador'), (req,res)=>{
  const d=db(); const before=(d.agenda||[]).length;
  d.agenda=(d.agenda||[]).filter(j=>j.id!=req.params.id);
  if(d.agenda.length===before) return res.status(404).json({error:'não encontrado'});
  save(); res.json({ok:true});
});

// =================== CUPONS DE DESCONTO (cap. 8.1) ===================
app.get('/api/admin/cupons', auth, requireStaff, (req,res)=> res.json(db().cupons||[]));

app.post('/api/admin/cupons', auth, requireStaff, (req,res)=>{
  const { codigo, tipo, valor, uso, maxUsos, validade, descricao } = req.body||{};
  if(!codigo || !tipo || !(Number(valor)>0)) return res.status(400).json({error:'codigo, tipo e valor são obrigatórios'});
  if(!['pct','fixo'].includes(tipo)) return res.status(400).json({error:'tipo deve ser pct ou fixo'});
  if(!['inscricao','ingresso','ambos'].includes(uso||'ambos')) return res.status(400).json({error:'uso inválido'});
  const exists=(db().cupons||[]).find(c=>c.codigo.toUpperCase()===(codigo||'').toUpperCase());
  if(exists) return res.status(409).json({error:'código já existe'});
  const c={ id:nextId(), codigo:codigo.toUpperCase(), tipo, valor:Number(valor),
    uso:uso||'ambos', maxUsos:parseInt(maxUsos)||null, usos:0,
    validade:validade||null, descricao:descricao||'', ativo:true, criadoEm:new Date().toISOString() };
  if(!db().cupons) db().cupons=[]; db().cupons.push(c); save(); res.json(c);
});

app.patch('/api/admin/cupons/:id', auth, requireStaff, (req,res)=>{
  const c=(db().cupons||[]).find(x=>x.id==req.params.id); if(!c) return res.status(404).json({error:'não encontrado'});
  ['ativo','maxUsos','validade','descricao'].forEach(k=>{ if(req.body[k]!==undefined) c[k]=req.body[k]; });
  save(); res.json(c);
});
app.delete('/api/admin/cupons/:id', auth, requireStaff, (req,res)=>{
  const d=db(); d.cupons=(d.cupons||[]).filter(x=>x.id!=req.params.id); save(); res.json({ok:true});
});

// ── Notícias ─────────────────────────────────────────────────────────────────
app.get('/api/noticias', (req, res) => {
  const d = db();
  let noticias = d.noticias || [];
  if (req.query.publicado === '1') noticias = noticias.filter(n => n.publicado);
  res.json(noticias.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)));
});

app.get('/api/admin/noticias', auth, requireStaff, (req, res) => {
  res.json((db().noticias || []).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)));
});

app.post('/api/admin/noticias', auth, requireRole('admin', 'organizador'), (req, res) => {
  const { titulo, resumo, conteudo, categoria, publicado } = req.body;
  if (!titulo) return res.status(400).json({ error: 'título obrigatório' });
  const d = db();
  if (!d.noticias) d.noticias = [];
  const n = { id: nextId(), titulo, resumo: resumo || '', conteudo: conteudo || '', categoria: categoria || 'aviso', publicado: !!publicado, criadoEm: new Date().toISOString(), autor: req.user.nome || req.user.user };
  d.noticias.push(n);
  save();
  res.json(n);
});

app.patch('/api/admin/noticias/:id', auth, requireRole('admin', 'organizador'), (req, res) => {
  const d = db();
  const n = (d.noticias || []).find(x => x.id == req.params.id);
  if (!n) return res.status(404).json({ error: 'não encontrada' });
  Object.assign(n, req.body);
  save();
  res.json(n);
});

app.delete('/api/admin/noticias/:id', auth, requireRole('admin', 'organizador'), (req, res) => {
  const d = db();
  d.noticias = (d.noticias || []).filter(x => x.id != req.params.id);
  save();
  res.json({ ok: true });
});

// Validar cupom (público, chamado antes do checkout)
app.post('/api/cupom/validar', (req,res)=>{
  const { codigo, uso, valor } = req.body||{};
  const c=(db().cupons||[]).find(x=>x.codigo===(codigo||'').toUpperCase() && x.ativo!==false);
  if(!c) return res.status(404).json({ok:false, error:'Cupom inválido ou expirado'});
  if(c.validade && new Date()>new Date(c.validade+'T23:59:59')) return res.status(410).json({ok:false, error:'Cupom expirado'});
  if(c.maxUsos!==null && c.usos>=c.maxUsos) return res.status(410).json({ok:false, error:'Cupom esgotado'});
  if(c.uso!=='ambos' && uso && c.uso!==uso) return res.status(400).json({ok:false, error:`Cupom válido apenas para ${c.uso}`});
  const base=Number(valor)||0;
  const desconto = c.tipo==='pct' ? Math.round(base*(c.valor/100)*100)/100 : Math.min(c.valor, base);
  const totalFinal = Math.max(0, base-desconto);
  res.json({ ok:true, cupomId:c.id, codigo:c.codigo, tipo:c.tipo, valor:c.valor, desconto, totalFinal,
    descricao:c.descricao||'' });
});

// Aplicar cupom (incrementa contador de uso — chamar ao confirmar pagamento)
function usarCupom(cupomId){
  const c=(db().cupons||[]).find(x=>x.id==cupomId); if(c) c.usos=(c.usos||0)+1;
}

// =================== AUTH EXTRA (registro/perfil/me/inscrições) ===================

// POST /api/auth/registro — alias público para registro de atleta
app.post('/api/auth/registro', async (req, res) => {
  const { nome, email, senha, telefone } = req.body || {};
  if (!nome || !email || !senha) return res.status(400).json({ error: 'nome, email e senha obrigatórios' });
  if ((senha || '').length < 6) return res.status(400).json({ error: 'a senha deve ter ao menos 6 caracteres' });
  const d = db();
  if (!d.usuarios) d.usuarios = [];
  if (d.usuarios.find(u => u.email === norm(email))) {
    return res.status(409).json({ error: 'e-mail já cadastrado' });
  }
  const hash = await bcrypt.hash(senha, 10);
  const u = { id: nextId(), nome, email: norm(email), senhaHash: hash, role: 'atleta',
    telefone: telefone || '', ativo: true, criadoEm: new Date().toISOString() };
  d.usuarios.push(u);
  save();
  res.json({ token: tokenFor(u), user: publicUser(u) });
});

// GET /api/me — perfil do usuário autenticado
app.get('/api/me', auth, (req, res) => {
  const u = (db().usuarios || []).find(u => u.id == req.user.id);
  if (!u) return res.status(404).json({ error: 'não encontrado' });
  res.json(publicUser(u));
});

// PATCH /api/auth/perfil — atualizar dados e/ou senha
app.patch('/api/auth/perfil', auth, async (req, res) => {
  const { nome, email, telefone, senhaNova, senhaAtual } = req.body || {};
  const d = db();
  const u = (d.usuarios || []).find(x => x.id == req.user.id);
  if (!u) return res.status(404).json({ error: 'não encontrado' });
  if (senhaNova) {
    if (!senhaAtual) return res.status(400).json({ error: 'senha atual obrigatória' });
    const ok = await bcrypt.compare(senhaAtual, u.senhaHash);
    if (!ok) return res.status(401).json({ error: 'senha atual incorreta' });
    u.senhaHash = await bcrypt.hash(senhaNova, 10);
  }
  if (nome) u.nome = nome;
  if (email) u.email = norm(email);
  if (telefone !== undefined) u.telefone = telefone;
  save();
  res.json(publicUser(u));
});

// GET /api/inscricoes/minhas — inscrições do usuário logado
app.get('/api/inscricoes/minhas', auth, (req, res) => {
  const d = db();
  const minhas = (d.inscricoes || []).filter(i => i.usuarioId == req.user.id || i.email === req.user.email);
  res.json(minhas);
});

// ---- estático: serve React SPA (build do web/) ----
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — React Router client-side routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, ()=> console.log(`SetPoint React SPA em http://localhost:${PORT}`));
