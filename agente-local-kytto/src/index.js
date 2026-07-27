import crypto from 'crypto';
import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { abrirGaveta, criarDriverBalanca, imprimir } from './drivers.js';
import { FilaOfflineDuravel } from './fila-offline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(__dirname, '..');
const arquivoConfig = process.env.KYTTO_AGENT_CONFIG || path.join(raiz, 'config.json');
const diretorioDiagnostico = process.env.KYTTO_AGENT_DIAGNOSTICO || path.join(raiz, 'diagnostico');
const arquivoFilaOffline = process.env.KYTTO_AGENT_FILA_OFFLINE || path.join(raiz, 'dados', 'fila-offline.json');
const VERSAO = '1.0.0';

let config;
let processandoFila = false;
let ultimaSincronizacao = null;
let ultimosEventos = [];
let filaOffline;

function registrarEvento(tipo, severidade = 'info', dados = {}) {
  const evento = { tipo_evento: tipo, severidade, dados, ocorrido_em: new Date().toISOString() };
  ultimosEventos = [evento, ...ultimosEventos].slice(0, 100);
  const prefixo = `[${evento.ocorrido_em}] [${severidade.toUpperCase()}] ${tipo}`;
  console.log(prefixo, JSON.stringify(dados));
  return evento;
}

async function carregarConfig() {
  const bruto = await fs.readFile(arquivoConfig, 'utf8');
  const dados = JSON.parse(bruto);
  if (!dados.servidor_url?.startsWith('https://') && !dados.servidor_url?.startsWith('http://localhost')) {
    throw new Error('servidor_url precisa usar HTTPS em produção');
  }
  if (!dados.terminal_id || !dados.token_terminal) throw new Error('terminal_id e token_terminal são obrigatórios');
  return {
    porta_local: 9357,
    host_local: '127.0.0.1',
    intervalo_fila_ms: 2500,
    intervalo_heartbeat_ms: 30000,
    dispositivos: [],
    ...dados,
  };
}

function cabecalhos() {
  return {
    'Content-Type': 'application/json',
    'X-Terminal-Id': config.terminal_id,
    'X-Terminal-Token': config.token_terminal,
    'User-Agent': `KyttoAgenteLocal/${VERSAO}`,
  };
}

async function requisitarApi(caminho, opcoes = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(opcoes.timeout_ms || 15000));
  try {
    const resposta = await fetch(`${config.servidor_url.replace(/\/$/, '')}${caminho}`, {
      ...opcoes,
      headers: { ...cabecalhos(), ...(opcoes.headers || {}) },
      signal: controller.signal,
    });
    const texto = resposta.status === 204 ? '' : await resposta.text();
    const corpo = texto ? JSON.parse(texto) : null;
    if (!resposta.ok && resposta.status !== 204) throw new Error(corpo?.erro || corpo?.error || `Servidor respondeu ${resposta.status}`);
    return { status: resposta.status, corpo };
  } finally {
    clearTimeout(timeout);
  }
}

function dispositivoPorId(id) {
  return config.dispositivos.find((dispositivo) => dispositivo.id === id) || null;
}

async function executarTrabalho(trabalho) {
  const dispositivo = dispositivoPorId(trabalho.dispositivo_id) || { configuracoes: { modo: 'diagnostico' } };
  if (trabalho.tipo_documento === 'outro' && trabalho.conteudo?.acao === 'abrir_gaveta') {
    return abrirGaveta({ dispositivo, diretorioDiagnostico });
  }
  return imprimir({ dispositivo, conteudo: trabalho.conteudo, diretorioDiagnostico });
}

async function processarFila() {
  if (processandoFila) return;
  processandoFila = true;
  try {
    const resposta = await requisitarApi('/api/pdv-offline/terminal/fila-impressao', { method: 'GET', timeout_ms: 12000 });
    if (resposta.status === 204 || !resposta.corpo?.trabalho) return;
    const trabalho = resposta.corpo.trabalho;
    try {
      const resultado = await executarTrabalho(trabalho);
      await requisitarApi(`/api/pdv-offline/terminal/fila-impressao/${trabalho.id}/resultado`, {
        method: 'POST', body: JSON.stringify({ sucesso: true }),
      });
      registrarEvento('impressao_concluida', 'info', { trabalho_id: trabalho.id, resultado });
    } catch (erro) {
      await requisitarApi(`/api/pdv-offline/terminal/fila-impressao/${trabalho.id}/resultado`, {
        method: 'POST', body: JSON.stringify({ sucesso: false, erro: erro.message }),
      }).catch((confirmacaoErro) => registrarEvento('confirmacao_impressao_falhou', 'erro', { trabalho_id: trabalho.id, erro: confirmacaoErro.message }));
      registrarEvento('impressao_falhou', 'erro', { trabalho_id: trabalho.id, erro: erro.message });
    }
  } catch (erro) {
    registrarEvento('consulta_fila_falhou', 'aviso', { erro: erro.message });
  } finally {
    processandoFila = false;
  }
}

async function heartbeat() {
  try {
    const dispositivos = config.dispositivos.map((dispositivo) => ({ id: dispositivo.id, status: dispositivo.ativo === false ? 'offline' : 'online' }));
    await requisitarApi('/api/pdv-offline/terminal/heartbeat', {
      method: 'POST', body: JSON.stringify({ versao_agente: VERSAO, dispositivos }),
    });
    ultimaSincronizacao = new Date().toISOString();
  } catch (erro) {
    registrarEvento('heartbeat_falhou', 'aviso', { erro: erro.message });
  }
}

async function enviarEventosPendentes() {
  const lote = ultimosEventos.slice(0, 20);
  if (lote.length === 0) return;
  try {
    await requisitarApi('/api/pdv-offline/terminal/eventos', { method: 'POST', body: JSON.stringify({ eventos: lote }) });
    ultimosEventos = ultimosEventos.slice(lote.length);
  } catch (erro) {
    // Mantém o buffer local para a próxima tentativa, limitado a 100 eventos.
    console.warn('Não foi possível enviar telemetria:', erro.message);
  }
}

async function sincronizarEventosOffline() {
  if (!filaOffline) return;
  const eventos = await filaOffline.pendentes(100);
  if (eventos.length === 0) return;
  try {
    const resposta = await requisitarApi('/api/pdv-offline/sincronizar', {
      method: 'POST',
      body: JSON.stringify({
        lote_cliente_id: crypto.randomUUID(),
        versao_cliente: `agente-local-${VERSAO}`,
        eventos,
      }),
      timeout_ms: 30000,
    });
    await filaOffline.registrarResultado(resposta.corpo?.eventos || []);
    registrarEvento('sincronizacao_offline_concluida', 'info', { enviados: eventos.length });
  } catch (erro) {
    registrarEvento('sincronizacao_offline_falhou', 'aviso', { enviados: eventos.length, erro: erro.message });
  }
}

function responderJson(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(dados));
}

function lerJson(req) {
  return new Promise((resolve, reject) => {
    let corpo = '';
    req.on('data', (parte) => {
      corpo += parte;
      if (corpo.length > 1024 * 1024) reject(new Error('Corpo excede 1 MB'));
    });
    req.on('end', () => {
      try { resolve(corpo ? JSON.parse(corpo) : {}); } catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function chaveApiLocalValida(req) {
  const origem = req.headers.origin;
  // O agente é acessível apenas no loopback. Sites HTTPS poderão chamá-lo em
  // ambiente homologado com autorização explícita por chave de instalação.
  return !origem || origem === config.origem_pdv_permitida;
}

async function tratarApiLocal(req, res) {
  if (req.headers.origin === config.origem_pdv_permitida) {
    res.setHeader('Access-Control-Allow-Origin', config.origem_pdv_permitida);
    res.setHeader('Vary', 'Origin');
  }
  if (!chaveApiLocalValida(req)) return responderJson(res, 403, { erro: 'Origem não autorizada no agente local' });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': config.origem_pdv_permitida || 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Kytto-Agent-Key',
      'Access-Control-Allow-Private-Network': 'true',
    });
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/health') {
    return responderJson(res, 200, {
      sucesso: true, versao: VERSAO, terminal_id: config.terminal_id,
      hostname: os.hostname(), ultima_sincronizacao: ultimaSincronizacao, processando_fila: processandoFila,
    });
  }
  if (req.method === 'POST' && req.url === '/print') {
    try {
      const corpo = await lerJson(req);
      const resultado = await imprimir({ dispositivo: dispositivoPorId(corpo.dispositivo_id) || {}, conteudo: corpo.conteudo || {}, diretorioDiagnostico });
      registrarEvento('impressao_local_manual', 'info', resultado);
      return responderJson(res, 202, { sucesso: true, resultado });
    } catch (erro) {
      return responderJson(res, 400, { erro: erro.message });
    }
  }
  if (req.method === 'POST' && req.url === '/drawer/open') {
    try {
      const corpo = await lerJson(req);
      const resultado = await abrirGaveta({ dispositivo: dispositivoPorId(corpo.dispositivo_id) || {}, diretorioDiagnostico });
      registrarEvento('gaveta_aberta', 'info', resultado);
      return responderJson(res, 202, { sucesso: true, resultado });
    } catch (erro) {
      return responderJson(res, 400, { erro: erro.message });
    }
  }
  if (req.method === 'POST' && req.url === '/offline/events') {
    try {
      const corpo = await lerJson(req);
      const eventos = Array.isArray(corpo.eventos) ? corpo.eventos : [];
      if (eventos.length === 0 || eventos.length > 100) throw new Error('Informe entre 1 e 100 eventos offline');
      if (eventos.some((evento) => !evento?.id || !Number.isInteger(evento.sequencia) || evento.tipo !== 'venda_offline')) {
        throw new Error('Evento offline inválido');
      }
      const eventosAceitos = await filaOffline.adicionar(eventos);
      registrarEvento('eventos_offline_recebidos', 'info', { quantidade: eventosAceitos.length });
      return responderJson(res, 202, { sucesso: true, eventos_aceitos: eventosAceitos });
    } catch (erro) {
      return responderJson(res, 400, { erro: erro.message });
    }
  }
  if (req.method === 'GET' && req.url === '/offline/status') {
    return responderJson(res, 200, { sucesso: true, ...(await filaOffline.resumo()) });
  }
  if (req.method === 'GET' && req.url === '/balance') {
    try {
      const dispositivo = config.dispositivos.find((item) => item.tipo === 'balanca');
      if (!dispositivo) throw new Error('Nenhuma balança configurada');
      const leitura = await criarDriverBalanca(dispositivo.configuracoes).lerPeso();
      return responderJson(res, 200, { sucesso: true, ...leitura });
    } catch (erro) {
      return responderJson(res, 503, { erro: erro.message });
    }
  }
  return responderJson(res, 404, { erro: 'Rota local não encontrada' });
}

async function iniciar() {
  config = await carregarConfig();
  filaOffline = new FilaOfflineDuravel(arquivoFilaOffline);
  await filaOffline.carregar();
  await fs.mkdir(diretorioDiagnostico, { recursive: true });
  const servidor = http.createServer((req, res) => {
    tratarApiLocal(req, res).catch((erro) => {
      registrarEvento('api_local_falhou', 'erro', { erro: erro.message });
      responderJson(res, 500, { erro: 'Erro interno do agente local' });
    });
  });
  servidor.listen(config.porta_local, config.host_local, () => {
    console.log(`Kytto Agente Local v${VERSAO} escutando em http://${config.host_local}:${config.porta_local}`);
    registrarEvento('agente_iniciado', 'info', { terminal_id: config.terminal_id });
  });

  await heartbeat();
  setInterval(heartbeat, Math.max(10000, Number(config.intervalo_heartbeat_ms)));
  setInterval(processarFila, Math.max(1000, Number(config.intervalo_fila_ms)));
  setInterval(enviarEventosPendentes, 10000);
  setInterval(sincronizarEventosOffline, 5000);
  processarFila();
  sincronizarEventosOffline();

  for (const sinal of ['SIGINT', 'SIGTERM']) {
    process.on(sinal, () => {
      console.log(`Recebido ${sinal}; encerrando agente local.`);
      servidor.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar o agente local:', erro.message);
  process.exit(1);
});
