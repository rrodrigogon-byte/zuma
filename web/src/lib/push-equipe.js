// Web Push da equipe: autorização explícita, contexto capturado e cleanup serializado.
import { api } from './api'
import { ehIos, rodandoComoApp } from '../components/pwa/InstalarApp'
let cleanupEmCurso = Promise.resolve()
function contextoAtual() {
  const ler = key => { try { return localStorage.getItem(key) || '' } catch { return '' } }
  const campo = (key, field) => { try { return JSON.parse(ler(key))?.[field] || '' } catch { return '' } }
  const token = ler('sp_token'); const empresaId = campo('sp_empresa_ativa', 'id'); const lojaId = campo('sp_loja_ativa', 'id')
  const key = JSON.stringify([token, empresaId, lojaId, campo('sp_user', 'id'), campo('sp_user', 'email')])
  return { key, headers: { Authorization: token ? `Bearer ${token}` : '', 'X-Empresa-Id': empresaId, 'X-Loja-Id': lojaId } }
}
function conferirContexto(contexto, ativo = () => true) {
  if (!ativo() || contexto.key !== contextoAtual().key) throw Object.assign(new Error('Conta ou unidade mudou. Confira os avisos novamente.'), { code: 'PUSH_CONTEXTO_ALTERADO' })
}
export function suportePush() {
  if (typeof window === 'undefined') return { ok: false, motivo: 'indisponivel' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { ok: false, motivo: ehIos() && !rodandoComoApp() ? 'instalar_ios' : 'indisponivel' }
  if (Notification.permission === 'denied') return { ok: false, motivo: 'bloqueado' }
  return { ok: true, motivo: Notification.permission === 'default' ? 'permissao_pendente' : 'pronto' }
}
function chaveParaBytes(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  return Uint8Array.from([...atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))].map(c => c.charCodeAt(0)))
}
async function assinaturaAtual() { return (await navigator.serviceWorker.ready).pushManager.getSubscription() }
export async function situacaoPush({ ativo = () => true } = {}) {
  const contexto = contextoAtual(); const suporte = suportePush()
  if (!suporte.ok) return { ...suporte, ativo: false }
  await cleanupEmCurso; conferirContexto(contexto, ativo)
  const atual = await assinaturaAtual().catch(() => null); conferirContexto(contexto, ativo)
  const servidor = await api.post('/api/admin/barbearia/push/situacao', { endpoint: atual?.endpoint || '' }, { headers: contexto.headers })
  conferirContexto(contexto, ativo)
  if (!servidor.configurado || !servidor.chavePublica) return { ok: false, motivo: 'servidor', ativo: false, permission: Notification.permission }
  return { ok: true, ativo: Boolean(atual && servidor.assinado), todos: Boolean(servidor.todos), chavePublica: servidor.chavePublica, permission: Notification.permission, motivo: suporte.motivo }
}
// requestPermission ocorre ANTES de qualquer await para preservar o gesto no iOS.
export async function ativarPush({ chavePublica, todos = false, ativo = () => true }) {
  const contexto = contextoAtual()
  if (!chavePublica) throw Object.assign(new Error('Notificações ainda não estão configuradas no servidor.'), { code: 'PUSH_DESLIGADO' })
  const suporte = suportePush()
  if (!suporte.ok) throw Object.assign(new Error(suporte.motivo === 'instalar_ios' ? 'No iPhone, instale o app na Tela de Início e abra pelo ícone.' : 'Este aparelho ou navegador não oferece Web Push compatível.'), { code: 'PUSH_INDISPONIVEL' })
  conferirContexto(contexto, ativo)
  const permissao = await Notification.requestPermission(); conferirContexto(contexto, ativo)
  if (permissao !== 'granted') throw Object.assign(new Error(permissao === 'denied' ? 'Permissão recusada. Libere as notificações nas configurações do aparelho.' : 'Permissão não concedida.'), { code: permissao === 'denied' ? 'PUSH_BLOQUEADO' : 'PUSH_PERMISSAO_PENDENTE' })
  await cleanupEmCurso; conferirContexto(contexto, ativo)
  const registro = await navigator.serviceWorker.ready; conferirContexto(contexto, ativo)
  let assinatura = await registro.pushManager.getSubscription(); conferirContexto(contexto, ativo)
  if (!assinatura) assinatura = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) })
  conferirContexto(contexto, ativo)
  await api.post('/api/admin/barbearia/push/assinar', { assinatura: assinatura.toJSON(), todos }, { headers: contexto.headers })
  conferirContexto(contexto, ativo); return true
}
export async function desativarPush({ ativo = () => true } = {}) {
  const contexto = contextoAtual(); await cleanupEmCurso; conferirContexto(contexto, ativo)
  const atual = await assinaturaAtual().catch(() => null); conferirContexto(contexto, ativo)
  if (!atual) return true
  await api.post('/api/admin/barbearia/push/cancelar', { endpoint: atual.endpoint }, { headers: contexto.headers }).catch(() => null)
  await atual.unsubscribe().catch(() => null); conferirContexto(contexto, ativo); return true
}
export async function testarPush({ ativo = () => true } = {}) {
  const contexto = contextoAtual(); await cleanupEmCurso; conferirContexto(contexto, ativo)
  const atual = await assinaturaAtual(); conferirContexto(contexto, ativo)
  const resultado = await api.post('/api/admin/barbearia/push/teste', { endpoint: atual?.endpoint || '' }, { headers: contexto.headers })
  conferirContexto(contexto, ativo); return resultado
}
// Cada cleanup usa a sessão ANTIGA capturada. Ativação nova espera o cleanup terminar.
export function encerrarPushDoAparelho({ token = '', empresaId = '', lojaId = '' } = {}) {
  const limpar = async () => {
    try {
      if (!('serviceWorker' in navigator)) return
      const registro = await navigator.serviceWorker.getRegistration()
      const atual = await registro?.pushManager?.getSubscription()
      if (!atual) return
      if (token) {
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000)
        try { await fetch('/api/admin/barbearia/push/cancelar', {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Empresa-Id': empresaId, 'X-Loja-Id': lojaId },
          body: JSON.stringify({ endpoint: atual.endpoint }),
        }).catch(() => null) } finally { clearTimeout(timer) }
      }
      await atual.unsubscribe().catch(() => null)
    } catch { /* limpeza local não bloqueia a navegação */ }
  }
  cleanupEmCurso = cleanupEmCurso.then(limpar, limpar)
  return cleanupEmCurso
}
