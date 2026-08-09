const CHAVE = 'kytto_operacao_offline_v1'
const EVENTO = 'kytto:offline-queue'
const caminhoSuportado = caminho => /^\/api\/comanda\/[^/]+\/adicionar$/.test(String(caminho || ''))
const gerarId = () => `op-${Date.now().toString(36)}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
const ler = () => { try { const fila = JSON.parse(localStorage.getItem(CHAVE) || '[]'); return Array.isArray(fila) ? fila : [] } catch { return [] } }
const salvar = fila => { localStorage.setItem(CHAVE, JSON.stringify(fila.slice(-100))); window.dispatchEvent(new CustomEvent(EVENTO, { detail: resumoFilaOffline() })) }
export const resumoFilaOffline = () => { const fila = ler(); return { pendentes: fila.filter(item => item.status === 'pendente').length, rejeitados: fila.filter(item => item.status === 'rejeitado').length, itens: fila } }
export const deveEnfileirarOffline = (caminho, opcoes = {}) => String(opcoes.method || 'GET').toUpperCase() === 'POST' && caminhoSuportado(caminho)
export function prepararOperacao(caminho, opcoes = {}) { if (!deveEnfileirarOffline(caminho, opcoes)) return opcoes; const headers = { ...(opcoes.headers || {}) }; headers['Idempotency-Key'] ||= gerarId(); return { ...opcoes, headers } }
export function enfileirarOperacao(caminho, opcoes = {}) { const chave = opcoes.headers?.['Idempotency-Key'] || gerarId(); const fila = ler(); const existente = fila.find(item => item.chave === chave); if (!existente) fila.push({ id: gerarId(), chave, caminho, metodo: String(opcoes.method || 'POST').toUpperCase(), corpo: typeof opcoes.body === 'string' ? opcoes.body : JSON.stringify(opcoes.body || {}), criadoEm: new Date().toISOString(), tentativas: 0, status: 'pendente' }); salvar(fila); return { ok:true, offlineQueued:true, idempotencyKey:chave, mensagem:'Lançamento salvo no dispositivo e será sincronizado automaticamente.' } }
export async function sincronizarFila(fetchAutenticado) { if (!navigator.onLine) return resumoFilaOffline(); const fila = ler(); for (const item of fila.filter(atual => atual.status === 'pendente')) { try { const resposta = await fetchAutenticado(item.caminho, { method:item.metodo, body:item.corpo, headers:{ 'Idempotency-Key':item.chave, 'X-Offline-Replay':'1' } }); if (!resposta.ok) { const dados = await resposta.json().catch(() => ({})); item.status = 'rejeitado'; item.erro = dados.erro || dados.error || `Erro ${resposta.status}`; item.atualizadoEm = new Date().toISOString(); continue } item.status = 'sincronizado'; item.sincronizadoEm = new Date().toISOString() } catch { item.tentativas = Number(item.tentativas || 0) + 1; item.atualizadoEm = new Date().toISOString(); break } }
  salvar(fila.filter(item => item.status !== 'sincronizado')); return resumoFilaOffline()
}
export function limparRejeitados() { salvar(ler().filter(item => item.status !== 'rejeitado')) }
export { EVENTO }
