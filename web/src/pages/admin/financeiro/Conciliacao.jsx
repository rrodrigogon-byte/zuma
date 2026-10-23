import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { Badge, Dialog, Table } from '../customer360/shared'
import { money, shortDate } from '../dino/format'
const diaLocal = (v) => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' }) : '')

// Conciliação bancária: importa o extrato OFX do banco e casa cada linha com o razão. Pix ou
// boleto de cliente que casa com conta a receber pendente já dá a baixa.
const BASE = '/api/admin/razao/conciliacao'
const lerBase64 = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',').pop()); r.onerror = falha; r.readAsDataURL(file) })

export default function Conciliacao({ categorias, toast, onMudou }) {
  const [contas, setContas] = useState([])
  const [contaId, setContaId] = useState('')
  const [status, setStatus] = useState('pendente')
  const [linhas, setLinhas] = useState([])
  const [arquivo, setArquivo] = useState(null)
  const [contaImport, setContaImport] = useState('')
  const [chaveArquivo, setChaveArquivo] = useState(0)
  const trava = useRef(false)
  const [enviando, setEnviando] = useState(false)
  const [criando, setCriando] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ status }); if (contaId) qs.set('contaId', contaId)
      const [c, l] = await Promise.all([api.get(`${BASE}/contas`), api.get(`${BASE}/linhas?${qs}`)])
      setContas(c); setLinhas(l); setErro('')
    } catch (error) { setErro(error.message || 'Não foi possível carregar a conciliação.') }
  }, [contaId, status])
  useEffect(() => { carregar() }, [carregar])

  async function acao(fn, sucesso) {
    if (trava.current) return false
    trava.current = true; setEnviando(true)
    try { const r = await fn(); if (sucesso) toast(typeof sucesso === 'function' ? sucesso(r) : sucesso, 'success'); if (r?.avisoOrigem) toast(r.avisoOrigem, 'info'); carregar(); onMudou?.(); return true }
    catch (error) { toast(error.message, 'error'); return false } finally { trava.current = false; setEnviando(false) }
  }
  const importar = (e) => { e.preventDefault(); if (!arquivo) return; acao(async () => { const r = await api.post(`${BASE}/importar`, { arquivoBase64: await lerBase64(arquivo), nomeArquivo: arquivo.name, contaId: contaImport || null }); setArquivo(null); setChaveArquivo((k) => k + 1); return r }, (r) => [
    `${r.novas} linha(s) nova(s)`, r.lidas - r.novas > 0 ? `${r.lidas - r.novas} já importada(s)` : '', r.repetidasNoArquivo ? `${r.repetidasNoArquivo} repetida(s) no arquivo` : '', r.descartadas ? `${r.descartadas} descartada(s) por data/valor inválido` : '',
    r.sinalCorrigido ? `${r.sinalCorrigido} débito(s) sem sinal corrigido(s) — confira` : '', `${r.automatico?.conciliadas || 0} conciliada(s) sozinhas (${r.automatico?.baixas || 0} baixa(s))`, `${r.automatico?.paraConferir || 0} para conferir`,
  ].filter(Boolean).join('; ') + '.') }

  return <div style={{ display: 'grid', gap: 16 }}>
    <section className="dadm-card">
      <h2>Contas bancárias</h2>
      {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
      <Table caption="Contas bancárias" rows={contas} empty="Nenhuma conta ainda: importe um extrato OFX e a conta é criada pelo número que vem no arquivo." columns={[
        { key: 'n', label: 'Conta', render: (c) => <div><strong>{c.nome}</strong><div className="dadm-muted">{[c.banco && `banco ${c.banco}`, c.agencia && `ag. ${c.agencia}`, c.conta].filter(Boolean).join(' · ')}</div></div> },
        { key: 's', label: 'Saldo no banco', align: 'right', render: (c) => (c.saldoBanco == null ? '—' : <div>{money(c.saldoBanco)}<div className="dadm-muted">{c.extratoAte ? `em ${shortDate(c.extratoAte)}` : ''}</div></div>) },
        { key: 'p', label: 'Para conciliar', align: 'right', render: (c) => (c.pendentes ? <span className="dadm-neg">{c.pendentes} · {money(c.valorPendente)}</span> : <Badge tone="success">em dia</Badge>) },
      ]} />
      <form className="dadm-filters" onSubmit={importar}>
        <select className="c360-input" aria-label="Conta de destino do extrato" value={contaImport} onChange={(e) => setContaImport(e.target.value)}><option value="">Conta que vem no arquivo</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <input key={chaveArquivo} type="file" accept=".ofx,.OFX" aria-label="Extrato OFX" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
        <button type="submit" className="c360-btn primary" disabled={!arquivo || enviando}>Importar extrato</button>
        <button type="button" className="c360-btn ghost" disabled={enviando} onClick={() => acao(() => api.post(`${BASE}/automatico`, { contaId: contaId || null }), (r) => `${r.conciliadas} conciliada(s), ${r.paraConferir} para conferir.`)}>Conciliar automaticamente</button>
      </form>
    </section>
    <section className="dadm-card">
      <h2>Linhas do extrato</h2>
      <div className="dadm-filters"><select className="c360-input" aria-label="Filtrar por conta" value={contaId} onChange={(e) => setContaId(e.target.value)}><option value="">Todas as contas</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select><select className="c360-input" aria-label="Situação das linhas" value={status} onChange={(e) => setStatus(e.target.value)}><option value="pendente">Para conciliar</option><option value="conciliado">Conciliadas</option><option value="ignorado">Ignoradas</option></select></div>
      <Table caption="Linhas do extrato" rows={linhas} empty={status === 'pendente' ? 'Nada para conciliar.' : 'Nenhuma linha.'} columns={[
        { key: 'd', label: 'Data', render: (l) => shortDate(l.data) },
        { key: 't', label: 'No banco', render: (l) => <div><strong>{l.descricao || '—'}</strong>{l.documento && <div className="dadm-muted">doc. {l.documento}</div>}{l.sinalCorrigido && <div><Badge tone="warning">débito sem sinal no arquivo: confira</Badge></div>}</div> },
        { key: 'v', label: 'Valor', align: 'right', render: (l) => <span className={l.valor < 0 ? 'dadm-neg' : 'dadm-pos'}>{money(l.valor)}</span> },
        { key: 'a', label: status === 'pendente' ? 'Casa com' : 'Situação', render: (l) => (l.status !== 'pendente'
          ? <div className="dadm-actions"><Badge tone={l.status === 'conciliado' ? 'success' : 'muted'}>{l.status === 'conciliado' ? (l.regra === 'automatica' ? 'automática' : 'conciliada') : 'ignorada'}</Badge><button type="button" className="c360-btn ghost" disabled={enviando} onClick={() => acao(() => api.post(`${BASE}/linhas/${l.id}/desfazer`, {}), (r) => (r.lancamentoCancelado ? 'Linha voltou para conciliar e o lançamento criado dela foi cancelado.' : 'Linha voltou para conciliar. Baixa feita continua; para desfazer, estorne no Financeiro.'))}>Desfazer</button></div>
          : <div style={{ display: 'grid', gap: 4 }}>
            {(l.sugestoes || []).map((s) => <div key={s.lancamento.id} className="dadm-actions">
              <span>{s.lancamento.descricao} · {s.lancamento.status === 'pendente' ? `vence ${shortDate(s.lancamento.vencimento)}` : `pago ${shortDate(diaLocal(s.lancamento.pagoEm))}`}{s.casaNome ? ' · nome confere' : ''}</span>
              <button type="button" className="c360-btn ghost" disabled={enviando} onClick={() => acao(() => api.post(`${BASE}/linhas/${l.id}/conciliar`, { lancamentoId: s.lancamento.id }), (r) => (r.baixado ? 'Conciliada e baixada.' : 'Conciliada.'))}>{s.lancamento.status === 'pendente' ? 'Conciliar e baixar' : 'Conciliar'}</button>
            </div>)}
            <div className="dadm-actions">
              <button type="button" className="c360-btn ghost" disabled={enviando} onClick={() => setCriando({ linha: l, categoria: l.valor < 0 ? 'Juros e tarifas bancárias' : 'Outros', descricao: l.descricao })}>Lançar no Financeiro</button>
              <button type="button" className="c360-btn ghost" disabled={enviando} onClick={() => acao(() => api.post(`${BASE}/linhas/${l.id}/ignorar`, {}), 'Linha ignorada.')}>Ignorar</button>
            </div>
          </div>) },
      ]} />
    </section>
    <Dialog open={Boolean(criando)} title="Lançar a linha no Financeiro" labelId="conc-criar" onClose={() => setCriando(null)}
      onSubmit={() => acao(() => api.post(`${BASE}/linhas/${criando.linha.id}/criar-lancamento`, { categoria: criando.categoria, descricao: criando.descricao }), 'Lançado e conciliado.').then((ok) => ok && setCriando(null))}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setCriando(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando}>Lançar</button></>}>
      {criando && <div style={{ display: 'grid', gap: 10 }}>
        <p className="dadm-muted">{shortDate(criando.linha.data)} · {money(criando.linha.valor)} · já pago</p>
        <label className="c360-field">Descrição<input className="c360-input" required minLength={2} maxLength={240} value={criando.descricao} onChange={(e) => setCriando({ ...criando, descricao: e.target.value })} /></label>
        <label className="c360-field">Categoria<select className="c360-input" value={criando.categoria} onChange={(e) => setCriando({ ...criando, categoria: e.target.value })}>{[...new Set([...((criando.linha.valor < 0 ? categorias?.despesa : categorias?.receita) || []), criando.categoria])].map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>}
    </Dialog>
  </div>
}
