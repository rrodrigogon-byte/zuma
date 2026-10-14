// Notificações push para a equipe (app do barbeiro instalado no celular).
//
// Avisa o profissional quando entra, muda ou cai um agendamento dele. Funciona no
// Android (Chrome) e no iPhone com o app instalado na Tela de Início (iOS 16.4+).
//
// Segurança:
// - Desligado sem as chaves VAPID (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e
//   VAPID_SUBJECT); a chave privada fica só no ambiente do servidor.
// - O servidor faz POST no endpoint da assinatura: só aceita endpoints HTTPS dos
//   serviços de push conhecidos (evita usar o servidor para chamar endereços internos).
// - O conteúdo cifrado usa somente título e corpo genéricos, sem dados do cliente.
// - Assinatura expirada (404/410) é apagada.
import { createHash } from 'crypto';
import webpush from 'web-push';
import { db, save } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';

const HOSTS_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^push\.api\.chrome\.google\.com$/,
];
const LIMITE_POR_USUARIO = 6;
const LIMITE_ENDPOINT = 600;
const LIMITE_ENVIO_CACHE = 4096;
const EVENTOS = new Set(['criado', 'remarcado', 'cancelado']);
const eventosEmAndamento = new Set();

export class PushError extends Error {
  constructor(message, code, status = 400) { super(message); this.code = code; this.status = status; }
}

let configurado = null;
export function pushConfigurado(env = process.env) {
  const publica = String(env.VAPID_PUBLIC_KEY || '').trim();
  const privada = String(env.VAPID_PRIVATE_KEY || '').trim();
  const assunto = String(env.VAPID_SUBJECT || '').trim();
  if (!publica || !privada || !/^(mailto:|https:\/\/)/.test(assunto)) return false;
  if (configurado !== publica) {
    try { webpush.setVapidDetails(assunto, publica, privada); configurado = publica; }
    catch { return false; }
  }
  return true;
}

export function chavePublica(env = process.env) {
  return pushConfigurado(env) ? String(env.VAPID_PUBLIC_KEY).trim() : '';
}

export function endpointPermitido(endpoint) {
  try {
    const url = new URL(String(endpoint || ''));
    // A lista de hosts evita SSRF para IPs/rede local; credenciais, fragmentos,
    // portas e endpoints sem caminho são rejeitados antes do web-push.
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.hash
      && url.pathname.length > 1 && HOSTS_PUSH.some((re) => re.test(url.hostname));
  } catch { return false; }
}

function idAssinatura(endpoint, { empresaId = '', lojaId = '', usuarioId = '' } = {}) {
  // O mesmo aparelho pode trocar de empresa/unidade/conta. O registro é
  // contextual para que cancelar A nunca apague B.
  return createHash('sha256').update(JSON.stringify({ endpoint: String(endpoint), empresaId: String(empresaId), lojaId: String(lojaId || ''), usuarioId: String(usuarioId ?? '') })).digest('hex').slice(0, 32);
}
function estado() { db().pushEquipe ||= {}; return db().pushEquipe; }
function envios() { db().pushEquipeEnvios ||= {}; return db().pushEquipeEnvios; }
function mesmoContexto(item, { empresaId, lojaId = '', usuarioId } = {}) {
  return item?.empresaId === String(empresaId)
    && item?.lojaId === String(lojaId || '')
    && item?.usuarioId === String(usuarioId ?? '');
}
function registrosDoEndpoint(endpoint, contexto) {
  return Object.values(estado()).filter((item) => item?.assinatura?.endpoint === String(endpoint) && mesmoContexto(item, contexto));
}
function contextoCompleto({ empresaId, lojaId, usuario = {} } = {}) {
  return Boolean(String(empresaId ?? '').trim() && String(lojaId ?? '').trim() && String(usuario.id ?? '').trim());
}
function auditarPush(acao, { empresaId, lojaId = '', usuario = {}, id = '', evento = '' } = {}) {
  const d = db(); d.auditoria ||= [];
  d.auditoria.push({ id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: new Date().toISOString(),
    user: usuario?.email ? `${String(usuario.email).slice(0, 160)} (${String(usuario.id ?? '').slice(0, 80)})` : 'sistema',
    acao, detalhe: JSON.stringify({ assinaturaId: String(id).slice(0, 64), evento: String(evento).slice(0, 30), lojaId: String(lojaId || '').slice(0, 120) }), empresaId: String(empresaId || '').slice(0, 120) });
  if (d.auditoria.length > 1000) d.auditoria = d.auditoria.slice(-1000);
}

export function validarAssinatura(sub) {
  const endpoint = String(sub?.endpoint || '');
  const p256dh = String(sub?.keys?.p256dh || '');
  const auth = String(sub?.keys?.auth || '');
  if (endpoint.length > LIMITE_ENDPOINT || !endpointPermitido(endpoint)) throw new PushError('Endereço de notificação não aceito.', 'PUSH_ENDPOINT_INVALIDO');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) throw new PushError('Chaves de notificação inválidas.', 'PUSH_CHAVES_INVALIDAS');
  return { endpoint: endpoint.slice(0, LIMITE_ENDPOINT), keys: { p256dh: p256dh.slice(0, 100), auth: auth.slice(0, 32) } };
}

export function assinar({ empresaId, lojaId = '', usuario = {}, profissionalId = '', todos = false, assinatura }) {
  if (!pushConfigurado()) throw new PushError('Notificações não configuradas no servidor.', 'PUSH_DESLIGADO', 409);
  if (!contextoCompleto({ empresaId, lojaId, usuario })) throw new PushError('Selecione uma empresa e unidade autorizadas antes de ativar os avisos.', 'PUSH_ESCOPO_INCOMPLETO', 403);
  const sub = validarAssinatura(assinatura);
  const id = idAssinatura(sub.endpoint, { empresaId, lojaId, usuarioId: usuario.id });
  const lista = estado();
  const agora = new Date().toISOString();
  // Limpa duplicatas criadas por versões anteriores, mas somente no mesmo
  // endpoint + empresa + unidade + ator. Outra conta/contexto fica intacta.
  for (const antiga of registrosDoEndpoint(sub.endpoint, { empresaId, lojaId, usuarioId: usuario.id })) {
    if (antiga.id !== id) delete lista[antiga.id];
  }
  lista[id] = {
    id, empresaId: String(empresaId), lojaId: String(lojaId || ''),
    usuarioId: String(usuario.id ?? ''), usuarioEmail: String(usuario.email || '').toLowerCase().slice(0, 160),
    profissionalId: String(profissionalId || ''), todos: Boolean(todos),
    assinatura: sub, criadoEm: lista[id]?.criadoEm || agora, atualizadoEm: agora,
  };
  // Limita aparelhos por usuário: remove os mais antigos.
  const doUsuario = Object.values(lista).filter((a) => a.empresaId === String(empresaId) && a.usuarioId === String(usuario.id ?? ''))
    // O aparelho que acabou de assinar fica sempre: com carimbos iguais (mesmo milissegundo)
    // a ordenação podia descartá-lo e a função quebrava ao ler lista[id].
    .sort((a, b) => (b.id === id) - (a.id === id) || String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
  for (const antiga of doUsuario.slice(LIMITE_POR_USUARIO)) delete lista[antiga.id];
  auditarPush('PUSH_ASSINATURA_ATIVADA', { empresaId, lojaId, usuario, id });
  save();
  return { id, profissionalId: lista[id].profissionalId, todos: lista[id].todos };
}

export function cancelar({ empresaId, lojaId = '', usuario = {}, endpoint }) {
  if (!contextoCompleto({ empresaId, lojaId, usuario })) return false;
  const id = idAssinatura(endpoint, { empresaId, lojaId, usuarioId: usuario.id });
  const lista = estado();
  const registros = [lista[id], ...registrosDoEndpoint(endpoint, { empresaId, lojaId, usuarioId: usuario.id })].filter(Boolean);
  if (registros.length) {
    for (const registro of registros) delete lista[registro.id];
    auditarPush('PUSH_ASSINATURA_DESATIVADA', { empresaId, lojaId, usuario, id });
    save();
    return true;
  }
  return false;
}

export function situacao({ empresaId, lojaId = '', usuario = {}, endpoint = '' }) {
  const completo = contextoCompleto({ empresaId, lojaId, usuario });
  const atual = completo && endpoint ? estado()[idAssinatura(endpoint, { empresaId, lojaId, usuarioId: usuario.id })] : null;
  const minha = atual && mesmoContexto(atual, { empresaId, lojaId, usuarioId: usuario.id })
    ? atual
    : (completo && endpoint ? registrosDoEndpoint(endpoint, { empresaId, lojaId, usuarioId: usuario.id })[0] : null);
  return { configurado: pushConfigurado(), chavePublica: chavePublica(), assinado: Boolean(minha), todos: Boolean(minha?.todos) };
}

// Endereço público da barbearia (para o link do aviso abrir o app certo).
export function slugPublicoDaEmpresa(empresaId) {
  const conf = db().barbearias?.[String(empresaId)]?.configuracao || {};
  const slug = String(conf.slugPublico || conf.slugAgendamento || '').trim().toLowerCase();
  if (slug) return slug;
  return String(empresaId) === 'emp-kytto-001' ? 'dino' : '';
}

function horaLocal(dataHora) {
  const d = new Date(dataHora);
  if (Number.isNaN(d.valueOf())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: process.env.KYTTO_TIMEZONE || 'America/Cuiaba', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(d);
}

export function montarMensagem(agendamento = {}, evento, servicoNome = '', slug = '') {
  const titulos = { criado: 'Novo agendamento', remarcado: 'Agendamento remarcado', cancelado: 'Agendamento cancelado' };
  return {
    // O payload não transporta cliente, telefone, serviço, data, URL ou evento.
    // O SW recebe somente texto genérico e abre a rota fixa do app.
    title: titulos[evento] || 'Agenda atualizada',
    body: 'Abra o app Dino Equipe para conferir a agenda.',
  };
}

// Envia para o profissional do agendamento e para a gestão que pediu "todos".
// Nunca lança: falha de push não pode atrapalhar o agendamento.
export async function notificarEquipe(empresaId, agendamento = {}, evento, { servicoNome = '', enviar = (sub, payload, opcoes) => webpush.sendNotification(sub, payload, opcoes) } = {}) {
  let eventoId = '';
  try {
    if (!EVENTOS.has(evento) || !agendamento?.id || !pushConfigurado()) return { enviados: 0 };
    // Eventos/assinaturas legados sem unidade ficam inelegíveis, sem apagar ou
    // inferir seus vínculos. O usuário deve optar por uma nova assinatura contextual.
    if (!String(empresaId ?? '').trim() || !String(agendamento.lojaId ?? '').trim()
      || (agendamento.empresaId && String(agendamento.empresaId) !== String(empresaId))) return { enviados: 0, motivo: 'PUSH_ESCOPO_INCOMPLETO' };
    const lista = estado();
    eventoId = createHash('sha256').update(JSON.stringify({ empresaId: String(empresaId), id: String(agendamento.id), evento, lojaId: String(agendamento.lojaId || ''), dataHora: String(agendamento.dataHora || ''), status: String(agendamento.status || ''), profissionalId: String(agendamento.profissionalId || ''), servicoId: String(agendamento.servicoId || '') })).digest('hex');
    if (eventosEmAndamento.has(eventoId)) return { enviados: 0, removidos: 0, duplicado: true };
    eventosEmAndamento.add(eventoId);
    // O vínculo é conferido no envio: e-mail trocado ou profissional desativado
    // deixa de receber os avisos daquele profissional.
    const profissionalAtual = new Map(barbearia.listarProfissionais(empresaId)
      .filter((p) => p.email).map((p) => [String(p.email).trim().toLowerCase(), p.id]));
    const alvos = Object.values(lista).filter((a) => a.empresaId === String(empresaId)
      && String(a.lojaId ?? '').trim() && a.lojaId === String(agendamento.lojaId)
      && (a.todos || (agendamento.profissionalId && profissionalAtual.get(a.usuarioEmail) === String(agendamento.profissionalId))));
    if (!alvos.length) { eventosEmAndamento.delete(eventoId); return { enviados: 0 }; }
    const payload = JSON.stringify(montarMensagem(agendamento, evento, servicoNome, slugPublicoDaEmpresa(empresaId)));
    const registroEnvios = envios();
    let enviados = 0; let removidos = 0;
    await Promise.all(alvos.map(async (alvo) => {
      try {
        const entregaId = createHash('sha256').update(`${eventoId}:${alvo.id}`).digest('hex');
        if (registroEnvios[entregaId]) return;
        await enviar(alvo.assinatura, payload, { TTL: 6 * 3600, urgency: evento === 'cancelado' || evento === 'criado' ? 'high' : 'normal' });
        registroEnvios[entregaId] = new Date().toISOString();
        enviados += 1;
      } catch (error) {
        if ([404, 410].includes(Number(error?.statusCode))) { delete lista[alvo.id]; removidos += 1; }
        else console.warn('[Push equipe] falha no envio:', Number(error?.statusCode) || error?.code || 'erro');
      }
    }));
    const chavesEnvio = Object.keys(registroEnvios);
    if (chavesEnvio.length > LIMITE_ENVIO_CACHE) {
      chavesEnvio.sort((a, b) => String(registroEnvios[a]).localeCompare(String(registroEnvios[b])));
      for (const chave of chavesEnvio.slice(0, chavesEnvio.length - LIMITE_ENVIO_CACHE)) delete registroEnvios[chave];
    }
    if (removidos || enviados) save();
    eventosEmAndamento.delete(eventoId);
    return { enviados, removidos };
  } catch (error) {
    eventosEmAndamento.delete(eventoId);
    console.warn('[Push equipe] indisponível:', error?.code || error?.message || 'erro');
    return { enviados: 0 };
  }
}

// Notificação de teste só para o aparelho que pediu.
export async function enviarTeste({ empresaId, lojaId = '', usuario = {}, endpoint }, { enviar = (sub, payload, opcoes) => webpush.sendNotification(sub, payload, opcoes) } = {}) {
  if (!pushConfigurado()) throw new PushError('Notificações não configuradas no servidor.', 'PUSH_DESLIGADO', 409);
  if (!contextoCompleto({ empresaId, lojaId, usuario })) throw new PushError('Selecione a empresa e unidade autorizadas antes do teste.', 'PUSH_ESCOPO_INCOMPLETO', 403);
  const atual = estado()[idAssinatura(endpoint, { empresaId, lojaId, usuarioId: usuario.id })];
  if (!atual || !mesmoContexto(atual, { empresaId, lojaId, usuarioId: usuario.id })) throw new PushError('Ative as notificações neste aparelho primeiro.', 'PUSH_NAO_ASSINADO', 409);
  const payload = JSON.stringify({ title: 'Notificações ligadas', body: 'Abra o app Dino Equipe para conferir a agenda.' });
  try { await enviar(atual.assinatura, payload, { TTL: 600, urgency: 'normal' }); return { enviados: 1 }; }
  catch (error) {
    if ([404, 410].includes(Number(error?.statusCode))) { delete estado()[atual.id]; save(); }
    throw new PushError('O aparelho não recebeu a notificação. Desative e ative de novo.', 'PUSH_FALHOU', 502);
  }
}
