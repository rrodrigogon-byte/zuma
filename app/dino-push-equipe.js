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
// - O conteúdo vai cifrado de ponta a ponta (padrão Web Push): primeiro nome do
//   cliente, horário e serviço. Nada de telefone.
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
const EVENTOS = new Set(['criado', 'remarcado', 'cancelado']);

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
    return url.protocol === 'https:' && !url.port && HOSTS_PUSH.some((re) => re.test(url.hostname));
  } catch { return false; }
}

function idAssinatura(endpoint) { return createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32); }
function estado() { db().pushEquipe ||= {}; return db().pushEquipe; }

export function validarAssinatura(sub) {
  const endpoint = String(sub?.endpoint || '');
  const p256dh = String(sub?.keys?.p256dh || '');
  const auth = String(sub?.keys?.auth || '');
  if (!endpointPermitido(endpoint)) throw new PushError('Endereço de notificação não aceito.', 'PUSH_ENDPOINT_INVALIDO');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) throw new PushError('Chaves de notificação inválidas.', 'PUSH_CHAVES_INVALIDAS');
  return { endpoint: endpoint.slice(0, 600), keys: { p256dh, auth } };
}

export function assinar({ empresaId, lojaId = '', usuario = {}, profissionalId = '', todos = false, assinatura }) {
  if (!pushConfigurado()) throw new PushError('Notificações não configuradas no servidor.', 'PUSH_DESLIGADO', 409);
  const sub = validarAssinatura(assinatura);
  const id = idAssinatura(sub.endpoint);
  const lista = estado();
  const agora = new Date().toISOString();
  lista[id] = {
    id, empresaId: String(empresaId), lojaId: String(lojaId || ''),
    usuarioId: String(usuario.id ?? ''), usuarioEmail: String(usuario.email || '').toLowerCase().slice(0, 160),
    profissionalId: String(profissionalId || ''), todos: Boolean(todos),
    assinatura: sub, criadoEm: lista[id]?.criadoEm || agora, atualizadoEm: agora,
  };
  // Limita aparelhos por usuário: remove os mais antigos.
  const doUsuario = Object.values(lista).filter((a) => a.empresaId === String(empresaId) && a.usuarioId === String(usuario.id ?? ''))
    .sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
  for (const antiga of doUsuario.slice(LIMITE_POR_USUARIO)) delete lista[antiga.id];
  save();
  return { id, profissionalId: lista[id].profissionalId, todos: lista[id].todos };
}

export function cancelar({ empresaId, usuario = {}, endpoint }) {
  const id = idAssinatura(endpoint);
  const atual = estado()[id];
  if (atual && atual.empresaId === String(empresaId) && atual.usuarioId === String(usuario.id ?? '')) {
    delete estado()[id];
    save();
    return true;
  }
  return false;
}

export function situacao({ empresaId, usuario = {}, endpoint = '' }) {
  const atual = endpoint ? estado()[idAssinatura(endpoint)] : null;
  const minha = atual && atual.empresaId === String(empresaId) && atual.usuarioId === String(usuario.id ?? '') ? atual : null;
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
  const primeiroNome = String(agendamento.clienteNome || 'Cliente').trim().split(/\s+/)[0].slice(0, 30);
  const quando = horaLocal(agendamento.dataHora);
  const titulos = { criado: 'Novo agendamento', remarcado: 'Agendamento remarcado', cancelado: 'Agendamento cancelado' };
  const dia = String(agendamento.dataAgenda || '').slice(0, 10);
  return {
    titulo: titulos[evento] || 'Agenda atualizada',
    corpo: `${primeiroNome}${quando ? ` · ${quando}` : ''}${servicoNome ? ` · ${servicoNome}` : ''}`,
    url: `/barbeiro${slug ? `/${encodeURIComponent(slug)}` : ''}${dia ? `?data=${dia}` : ''}`,
    tag: `agenda-${agendamento.id}`,
  };
}

// Envia para o profissional do agendamento e para a gestão que pediu "todos".
// Nunca lança: falha de push não pode atrapalhar o agendamento.
export async function notificarEquipe(empresaId, agendamento = {}, evento, { servicoNome = '', enviar = (sub, payload, opcoes) => webpush.sendNotification(sub, payload, opcoes) } = {}) {
  try {
    if (!EVENTOS.has(evento) || !agendamento?.id || !pushConfigurado()) return { enviados: 0 };
    const lista = estado();
    // O vínculo é conferido no envio: e-mail trocado ou profissional desativado
    // deixa de receber os avisos daquele profissional.
    const profissionalAtual = new Map(barbearia.listarProfissionais(empresaId)
      .filter((p) => p.email).map((p) => [String(p.email).trim().toLowerCase(), p.id]));
    const alvos = Object.values(lista).filter((a) => a.empresaId === String(empresaId)
      && (!a.lojaId || !agendamento.lojaId || a.lojaId === String(agendamento.lojaId))
      && (a.todos || (agendamento.profissionalId && profissionalAtual.get(a.usuarioEmail) === String(agendamento.profissionalId))));
    if (!alvos.length) return { enviados: 0 };
    const payload = JSON.stringify(montarMensagem(agendamento, evento, servicoNome, slugPublicoDaEmpresa(empresaId)));
    let enviados = 0; let removidos = 0;
    await Promise.all(alvos.map(async (alvo) => {
      try {
        await enviar(alvo.assinatura, payload, { TTL: 6 * 3600, urgency: evento === 'cancelado' || evento === 'criado' ? 'high' : 'normal' });
        enviados += 1;
      } catch (error) {
        if ([404, 410].includes(Number(error?.statusCode))) { delete lista[alvo.id]; removidos += 1; }
        else console.warn('[Push equipe] falha no envio:', Number(error?.statusCode) || error?.code || 'erro');
      }
    }));
    if (removidos) save();
    return { enviados, removidos };
  } catch (error) {
    console.warn('[Push equipe] indisponível:', error?.code || error?.message || 'erro');
    return { enviados: 0 };
  }
}

// Notificação de teste só para o aparelho que pediu.
export async function enviarTeste({ empresaId, usuario = {}, endpoint }, { enviar = (sub, payload, opcoes) => webpush.sendNotification(sub, payload, opcoes) } = {}) {
  if (!pushConfigurado()) throw new PushError('Notificações não configuradas no servidor.', 'PUSH_DESLIGADO', 409);
  const atual = estado()[idAssinatura(endpoint)];
  if (!atual || atual.empresaId !== String(empresaId) || atual.usuarioId !== String(usuario.id ?? '')) throw new PushError('Ative as notificações neste aparelho primeiro.', 'PUSH_NAO_ASSINADO', 409);
  const slug = slugPublicoDaEmpresa(empresaId);
  const payload = JSON.stringify({ titulo: 'Notificações ligadas', corpo: 'Você vai receber aqui os avisos da sua agenda.', url: slug ? `/barbeiro/${encodeURIComponent(slug)}` : '/barbeiro', tag: 'teste' });
  try { await enviar(atual.assinatura, payload, { TTL: 600, urgency: 'normal' }); return { enviados: 1 }; }
  catch (error) {
    if ([404, 410].includes(Number(error?.statusCode))) { delete estado()[atual.id]; save(); }
    throw new PushError('O aparelho não recebeu a notificação. Desative e ative de novo.', 'PUSH_FALHOU', 502);
  }
}
