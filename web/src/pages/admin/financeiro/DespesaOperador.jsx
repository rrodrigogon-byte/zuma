import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { useToast } from '../../../hooks/useToast'
import { lojasDaEmpresa } from '../../../lib/context-selection'
import '../customer360.css'
import '../dino/dino-admin.css'

const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const VAZIO = () => ({ descricao: '', categoria: '', valor: '', vencimento: hojeLocal(), pago: true })

// Financeiro do operador: só lançar despesa. Saldo, contas e relatórios são da administração
// (o servidor não entrega esses números a quem não tem reports.read).
export default function DespesaOperador() {
  const { empresaAtiva, lojaAtiva, lojasAcessiveis } = useAuth()
  const { toast } = useToast()
  const lojas = lojasDaEmpresa(lojasAcessiveis, empresaAtiva?.id)
  const [categorias, setCategorias] = useState([])
  const [form, setForm] = useState(VAZIO)
  const [lojaId, setLojaId] = useState(lojaAtiva?.id || (lojas.length === 1 ? lojas[0].id : ''))
  const [enviando, setEnviando] = useState(false)
  const [ultimas, setUltimas] = useState([])
  useEffect(() => { api.get('/api/admin/razao/categorias').then((c) => setCategorias(c?.despesa || [])).catch(() => setCategorias([])) }, [empresaAtiva?.id])
  async function salvar(e) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    try {
      const corpo = { tipo: 'despesa', descricao: form.descricao, categoria: form.categoria || 'Outras despesas', valor: form.valor, vencimento: form.vencimento, status: form.pago ? 'pago' : 'pendente', lojaId: lojaId || null }
      const r = await api.post('/api/admin/razao/lancamentos', corpo)
      toast('Despesa lançada.', 'success')
      setUltimas((atual) => [{ id: r?.lancamentos?.[0]?.id || r?.id || Date.now(), ...corpo }, ...atual].slice(0, 5))
      setForm(VAZIO())
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  return <section className="dadm-page" aria-labelledby="despesa-operador">
    <header className="dadm-head"><div><div className="dadm-eyebrow">{empresaAtiva?.nome || 'Empresa'}</div><h1 id="despesa-operador">Lançar despesa</h1>
      <p>Seu perfil é de operador: aqui você lança as despesas do dia. Saldo, contas e relatórios ficam com a administração.</p></div></header>
    <form className="dadm-card" onSubmit={salvar} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <label className="c360-field">Descrição<input className="c360-input" required minLength={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: gelo, material de limpeza" /></label>
      <label className="c360-field">Categoria<select className="c360-input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}><option value="">Outras despesas</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="c360-field">Valor (R$)<input className="c360-input" required inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>
      <label className="c360-field">Data<input className="c360-input" type="date" required value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></label>
      {lojas.length > 1 && <label className="c360-field">Unidade<select className="c360-input" required value={lojaId} onChange={(e) => setLojaId(e.target.value)}><option value="">Escolha</option>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-start' }}><input type="checkbox" style={{ width: 18, height: 18, flex: '0 0 auto' }} checked={form.pago} onChange={(e) => setForm({ ...form, pago: e.target.checked })} /> Já foi paga</label>
      <div className="dadm-actions"><button type="submit" className="c360-btn primary" disabled={enviando}>{enviando ? 'Lançando…' : 'Lançar despesa'}</button></div>
    </form>
    {ultimas.length > 0 && <section className="dadm-card"><h2>Lançadas agora</h2><ul>{ultimas.map((u) => <li key={u.id}>{u.descricao} · {u.categoria}</li>)}</ul></section>}
  </section>
}
