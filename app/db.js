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

// O banco legado pode conter dezenas de milhares de registros históricos. Ler o arquivo
// inteiro com readFileSync + JSON.parse cria simultaneamente Buffer/string, objeto
// parcialmente analisado e objeto final. Em uma instância Render de 512 MiB isso pode
// derrubar o processo antes de abrir a porta HTTP. O parser abaixo lê somente o objeto
// raiz em blocos e materializa uma propriedade por vez; o contrato do db() permanece
// síncrono para os módulos legados.
function parseJsonObjectStreaming(arquivo) {
  const fd = fs.openSync(arquivo, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const estado = {};
  let posicao = 0;
  let fase = 'inicio';
  let chaveRaw = [];
  let chaveAtual = null;
  let chaveEscape = false;
  let valorTipo = null;
  let valorProfundidade = 0;
  let valorString = false;
  let valorEscape = false;
  let valorIniciado = false;
  let segmentoInicio = -1;
  let segmentosValor = [];

  const erro = (mensagem) => { throw new SyntaxError(`${mensagem} em ${arquivo}`); };
  const anexarSegmento = (fim, chunk) => {
    if (segmentoInicio >= 0 && fim > segmentoInicio) segmentosValor.push(Buffer.from(chunk.subarray(segmentoInicio, fim)));
    segmentoInicio = -1;
  };
  const finalizarValor = (fim, chunk) => {
    anexarSegmento(fim, chunk);
    try {
      estado[chaveAtual] = JSON.parse(Buffer.concat(segmentosValor).toString('utf8'));
    } catch (error) {
      throw new SyntaxError(`Valor inválido para ${chaveAtual}: ${error.message}`);
    }
    segmentosValor = [];
    chaveAtual = null;
    valorTipo = null;
    valorProfundidade = 0;
    valorString = false;
    valorEscape = false;
    valorIniciado = false;
  };

  try {
    while (true) {
      const lidos = fs.readSync(fd, buffer, 0, buffer.length, posicao);
      if (!lidos) break;
      posicao += lidos;
      for (let indice = 0; indice < lidos;) {
        const byte = buffer[indice];
        if (fase === 'inicio') {
          if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) { indice += 1; continue; }
          if (byte !== 0x7b) erro('JSON persistente não começa com objeto');
          fase = 'chaveOuFim'; indice += 1; continue;
        }
        if (fase === 'chaveOuFim') {
          if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x2c) { indice += 1; continue; }
          if (byte === 0x7d) { fase = 'fim'; indice += 1; continue; }
          if (byte !== 0x22) erro('chave JSON esperada');
          chaveRaw = [byte]; chaveEscape = false; fase = 'chave'; indice += 1; continue;
        }
        if (fase === 'chave') {
          chaveRaw.push(byte);
          if (chaveEscape) chaveEscape = false;
          else if (byte === 0x5c) chaveEscape = true;
          else if (byte === 0x22) {
            try { chaveAtual = JSON.parse(Buffer.from(chaveRaw).toString('utf8')); }
            catch (error) { throw new SyntaxError(`Chave JSON inválida: ${error.message}`); }
            fase = 'doisPontos';
          }
          indice += 1; continue;
        }
        if (fase === 'doisPontos') {
          if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) { indice += 1; continue; }
          if (byte !== 0x3a) erro('dois-pontos esperado após chave');
          fase = 'antesDoValor'; indice += 1; continue;
        }
        if (fase === 'antesDoValor') {
          if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) { indice += 1; continue; }
          valorIniciado = true; segmentoInicio = indice;
          if (byte === 0x7b || byte === 0x5b) { valorTipo = 'complexo'; valorProfundidade = 0; }
          else if (byte === 0x22) { valorTipo = 'string'; valorString = false; }
          else valorTipo = 'primitivo';
          fase = 'valor'; continue;
        }
        if (fase === 'valor') {
          if (valorIniciado && segmentoInicio < 0) segmentoInicio = indice;
          if (valorTipo === 'primitivo') {
            if (byte === 0x2c || byte === 0x7d) {
              finalizarValor(indice, buffer); fase = 'depoisDoValor'; continue;
            }
            indice += 1; continue;
          }
          if (valorString) {
            if (valorEscape) valorEscape = false;
            else if (byte === 0x5c) valorEscape = true;
            else if (byte === 0x22) {
              if (valorTipo === 'string') {
                finalizarValor(indice + 1, buffer); fase = 'depoisDoValor'; indice += 1; continue;
              }
              valorString = false;
            }
            indice += 1; continue;
          }
          if (valorEscape) valorEscape = false;
          else if (byte === 0x5c) valorEscape = true;
          else if (byte === 0x22) valorString = true;
          else if (byte === 0x7b || byte === 0x5b) valorProfundidade += 1;
          else if (byte === 0x7d || byte === 0x5d) {
            valorProfundidade -= 1;
            if (valorProfundidade === 0) {
              finalizarValor(indice + 1, buffer); fase = 'depoisDoValor'; indice += 1; continue;
            }
          }
          indice += 1; continue;
        }
        if (fase === 'depoisDoValor') {
          if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) { indice += 1; continue; }
          if (byte === 0x2c) { fase = 'chaveOuFim'; indice += 1; continue; }
          if (byte === 0x7d) { fase = 'fim'; indice += 1; continue; }
          erro('separador JSON esperado após valor');
        }
        if (fase === 'fim') {
          if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) { indice += 1; continue; }
          erro('conteúdo após o fim do objeto JSON');
        }
      }
      if (fase === 'valor' && segmentoInicio >= 0) anexarSegmento(lidos, buffer);
    }
    if (fase !== 'fim') erro('JSON persistente truncado');
    return estado;
  } finally {
    fs.closeSync(fd);
  }
}

export function load(){
  ensureDir();
  if(!fs.existsSync(DB_PATH)){
    // Sem o arquivo principal, tenta a última cópia íntegra antes de começar vazio:
    // um processo interrompido entre gravações nunca deve virar "banco zerado".
    const bak = DB_PATH + '.bak';
    if(fs.existsSync(bak)){
      try {
        const d = { ...structuredClone(DEFAULT), ...parseJsonObjectStreaming(bak) };
        console.error('DB principal ausente: recuperado da cópia .bak');
        return d;
      } catch(e){ console.error('DB principal ausente e .bak ilegível:', e.message); }
    }
    return structuredClone(DEFAULT);
  }
  try { return { ...structuredClone(DEFAULT), ...parseJsonObjectStreaming(DB_PATH) }; }
  catch(e){
    console.error('DB corrompido:', e.message);
    // Antes de recriar do zero (perda total), tenta o backup .bak da última gravação boa.
    try {
      const bak = DB_PATH + '.bak';
      if(fs.existsSync(bak)){
        const d = { ...structuredClone(DEFAULT), ...parseJsonObjectStreaming(bak) };
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
  try { gravarPendenteAgora(); } catch(e){ console.error('[DB] falha ao gravar pendente no flush:', e?.message || e); }
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
const TAMANHO_BLOCO_JSON = 1024 * 1024;
const _metricas = { gravacoes: 0, alteracoes: 0, gravacoesAgrupadas: 0, ultimaGravacaoEm: null, ultimaDuracaoMs: 0, maiorDuracaoMs: 0, tamanhoBytes: 0, ultimoErro: null, ultimoErroEm: null, gravacoesLentas: 0, ultimoBakEm: 0 };

// JSON.stringify(_cache) cria uma string do tamanho inteiro do banco antes de o
// primeiro byte chegar ao disco. Com o histórico Avec importado isso duplicava
// dezenas de megabytes no heap e fazia o processo ultrapassar o limite de memória
// do serviço. A escrita abaixo percorre só os contêineres grandes (mapas/listas com
// muitos nós) e serializa cada registro pequeno com o JSON.stringify nativo — cerca
// de 3x mais rápido que visitar campo a campo em JS — mantendo poucos blocos em
// memória e a mesma saída byte a byte do JSON compacto.
const NOS_REGISTRO_PEQUENO = 3000;
const _temProprio = Object.prototype.hasOwnProperty;
function cabeEmRegistroPequeno(item, orcamento = NOS_REGISTRO_PEQUENO) {
  let restante = orcamento;
  const pilha = [item];
  while (pilha.length) {
    const atual = pilha.pop();
    if (--restante < 0) return false;
    if (atual && typeof atual === 'object') {
      if (Array.isArray(atual)) { for (let i = 0; i < atual.length; i++) pilha.push(atual[i]); }
      else for (const chave in atual) if (_temProprio.call(atual, chave)) pilha.push(atual[chave]);
    }
  }
  return true;
}

function escreverJsonEmFluxo(fd, valor) {
  let partes = [];
  let tamanhoBloco = 0;
  let tamanhoBytes = 0;
  const ancestrais = new WeakSet();
  const descarregar = () => {
    if (!partes.length) return;
    tamanhoBytes += fs.writeSync(fd, partes.join(''), null, 'utf8');
    partes = [];
    tamanhoBloco = 0;
  };
  const anexar = (texto) => {
    if (!texto) return;
    partes.push(texto);
    tamanhoBloco += texto.length;
    if (tamanhoBloco >= TAMANHO_BLOCO_JSON) descarregar();
  };
  const ignorado = (item) => item === undefined || typeof item === 'function' || typeof item === 'symbol';
  const visitar = (item, dentroDeArray = false) => {
    if (item === null || typeof item !== 'object' || typeof item.toJSON === 'function' || cabeEmRegistroPequeno(item)) {
      const texto = JSON.stringify(item);
      anexar(texto === undefined ? (dentroDeArray ? 'null' : '') : texto);
      return;
    }
    if (ancestrais.has(item)) throw new TypeError('Converting circular structure to JSON');
    ancestrais.add(item);
    try {
      if (Array.isArray(item)) {
        anexar('[');
        for (let indice = 0; indice < item.length; indice += 1) {
          if (indice) anexar(',');
          if (ignorado(item[indice])) anexar('null'); else visitar(item[indice], true);
        }
        anexar(']');
      } else {
        anexar('{');
        let primeiro = true;
        for (const chave of Object.keys(item)) {
          const valorChave = item[chave];
          if (ignorado(valorChave)) continue;
          if (typeof valorChave === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
          if (!primeiro) anexar(',');
          primeiro = false;
          anexar(JSON.stringify(chave));
          anexar(':');
          visitar(valorChave);
        }
        anexar('}');
      }
    } finally { ancestrais.delete(item); }
  };
  visitar(valor);
  descarregar();
  return tamanhoBytes;
}

function escreverArquivo(arquivo, valor){
  const fd = fs.openSync(arquivo, 'w');
  try {
    const tamanhoBytes = escreverJsonEmFluxo(fd, valor);
    const agora = Date.now();
    if(agora - _ultimoFsync >= FSYNC_INTERVALO_MS){ fs.fsyncSync(fd); _ultimoFsync = agora; }
    return tamanhoBytes;
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

// Agrupamento de gravações: cada save() reescreve o banco inteiro. Em produção, várias
// chamadas na mesma requisição (ou em rajada) viram UMA gravação logo em seguida
// (até DB_SAVE_COALESCE_MS). Falha de disco fica pendente e é relançada no próximo
// save(), para a requisição seguinte não confirmar algo que não foi gravado; SIGTERM,
// saída do processo e leituras do arquivo (caminhoBanco) gravam o pendente antes.
const _agruparEnv = process.env.DB_SAVE_COALESCE;
const AGRUPAR_GRAVACOES = _agruparEnv ? _agruparEnv === '1' : process.env.NODE_ENV === 'production';
const _janelaEnv = Number.parseInt(process.env.DB_SAVE_COALESCE_MS ?? '', 10);
const JANELA_AGRUPAMENTO_MS = Number.isFinite(_janelaEnv) && _janelaEnv >= 0 ? _janelaEnv : 40;
let _gravacaoPendente = null;
let _erroGravacaoPendente = null;

export function save(){
  _metricas.alteracoes += 1;
  if(!AGRUPAR_GRAVACOES) return gravarAgora();
  if(_erroGravacaoPendente){
    // A última gravação adiada falhou: tenta já e propaga o erro ao chamador.
    _erroGravacaoPendente = null;
    if(_gravacaoPendente){ clearTimeout(_gravacaoPendente); _gravacaoPendente = null; }
    return gravarAgora();
  }
  if(_gravacaoPendente){ _metricas.gravacoesAgrupadas += 1; return; }
  _gravacaoPendente = setTimeout(() => {
    _gravacaoPendente = null;
    try { gravarAgora(); } catch(e){ _erroGravacaoPendente = e; }
  }, JANELA_AGRUPAMENTO_MS);
}

// Grava imediatamente o que estiver pendente (usado antes de ler o arquivo e no encerramento).
export function gravarPendenteAgora(){
  if(!_gravacaoPendente && !_erroGravacaoPendente) return false;
  if(_gravacaoPendente){ clearTimeout(_gravacaoPendente); _gravacaoPendente = null; }
  _erroGravacaoPendente = null;
  gravarAgora();
  return true;
}
if(AGRUPAR_GRAVACOES) process.on('exit', () => { try { gravarPendenteAgora(); } catch(e){ console.error('[DB] falha ao gravar pendente na saída:', e?.message || e); } });

function gravarAgora(){
  const inicio = Date.now();
  try {
    ensureDir();
    const tmp = `${DB_PATH}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    const tamanhoBytes = escreverArquivo(tmp, _cache);
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
    _metricas.tamanhoBytes = tamanhoBytes;
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
    gravacoes: _metricas.gravacoes, alteracoes: _metricas.alteracoes, gravacoesAgrupadas: _metricas.gravacoesAgrupadas, gravacaoPendente: Boolean(_gravacaoPendente), agrupamento: AGRUPAR_GRAVACOES, ultimaGravacaoEm: _metricas.ultimaGravacaoEm, ultimaDuracaoMs: _metricas.ultimaDuracaoMs,
    maiorDuracaoMs: _metricas.maiorDuracaoMs, gravacoesLentas: _metricas.gravacoesLentas, tamanhoBytes: _metricas.tamanhoBytes,
    ultimoErro: _metricas.ultimoErro, ultimoErroEm: _metricas.ultimoErroEm, replicacaoGcs: Boolean(GCS_BUCKET) };
}

// Quem vai ler o arquivo (backup/exportação) recebe a versão já com o pendente gravado.
export function caminhoBanco(){ gravarPendenteAgora(); return DB_PATH; }

// Restauração: troca o estado em memória por uma cópia já conferida e grava.
// Usada só pela rota de restauração da administração da plataforma, que antes
// guarda uma cópia do estado atual (a restauração pode ser desfeita).
export function substituirBanco(estado){
  if(!estado || typeof estado !== 'object' || Array.isArray(estado)) throw new Error('estado inválido para restauração');
  const anterior = _cache;
  _cache = { ...structuredClone(DEFAULT), ...estado };
  try { save(); gravarPendenteAgora(); }
  catch(e){ _cache = anterior; throw e; }  // memória e disco nunca divergem
  return _cache;
}

export function nextId({ persist = true } = {}){
  const id = _cache.seq++;
  if(persist) save();
  return id;
}

export function reset(){ _cache = structuredClone(DEFAULT); save(); }
