// Notificações push do app do barbeiro (Android e iPhone com o app instalado).
import { api } from './api'
import { ehIos, rodandoComoApp } from '../components/pwa/InstalarApp'

export function suportePush() {
  if (typeof window === 'undefined') return { ok: false, motivo: 'indisponivel' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // No iPhone, notificações só funcionam com o app instalado na Tela de Início (iOS 16.4+).
    return { ok: false, motivo: ehIos() && !rodandoComoApp() ? 'instalar_ios' : 'navegador' }
  }
  if (Notification.permission === 'denied') return { ok: false, motivo: 'bloqueado' }
  return { ok: true }
}

function chaveParaBytes(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const bruto = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)))
}

async function assinaturaAtual() {
  const registro = await navigator.serviceWorker.ready
  return registro.pushManager.getSubscription()
}

export async function situacaoPush() {
  const suporte = suportePush()
  if (!suporte.ok) return { ...suporte, ativo: false }
  const atual = await assinaturaAtual().catch(() => null)
  const servidor = await api.post('/api/admin/barbearia/push/situacao', { endpoint: atual?.endpoint || '' })
  if (!servidor.configurado) return { ok: false, motivo: 'servidor', ativo: false }
  return { ok: true, ativo: Boolean(atual && servidor.assinado), todos: Boolean(servidor.todos), chavePublica: servidor.chavePublica }
}

// Precisa ser chamada a partir de um toque do usuário (exigência do iOS).
export async function ativarPush({ chavePublica, todos = false }) {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Permissão de notificação não concedida. Libere nas configurações do aparelho.')
  const registro = await navigator.serviceWorker.ready
  let assinatura = await registro.pushManager.getSubscription()
  if (!assinatura) assinatura = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) })
  await api.post('/api/admin/barbearia/push/assinar', { assinatura: assinatura.toJSON(), todos })
  return true
}

export async function desativarPush() {
  const atual = await assinaturaAtual().catch(() => null)
  if (!atual) return true
  await api.post('/api/admin/barbearia/push/cancelar', { endpoint: atual.endpoint }).catch(() => null)
  await atual.unsubscribe().catch(() => null)
  return true
}

export async function testarPush() {
  const atual = await assinaturaAtual()
  return api.post('/api/admin/barbearia/push/teste', { endpoint: atual?.endpoint || '' })
}

// Ao sair da conta: desliga os avisos deste aparelho no servidor (com a sessão que
// ainda vale) e no navegador. Sem sessão (expirada), só cancela no navegador.
export async function encerrarPushDoAparelho({ token = '', empresaId = '', lojaId = '' } = {}) {
  try {
    if (!('serviceWorker' in navigator)) return
    const registro = await navigator.serviceWorker.getRegistration()
    const atual = await registro?.pushManager?.getSubscription()
    if (!atual) return
    if (token) {
      await fetch('/api/admin/barbearia/push/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(empresaId ? { 'X-Empresa-Id': empresaId } : {}), ...(lojaId ? { 'X-Loja-Id': lojaId } : {}) },
        body: JSON.stringify({ endpoint: atual.endpoint }),
      }).catch(() => null)
    }
    await atual.unsubscribe().catch(() => null)
  } catch { /* sem suporte a push: nada a desligar */ }
}
