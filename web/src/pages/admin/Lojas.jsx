import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 11px',
  border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-2)',
  color: 'var(--cream)', fontSize: 13,
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function emptyForm() {
  return {
    codigo: '', nome: '', nome_fantasia: '', cnpj: '', telefone: '', email: '',
    endereco_cidade: '', endereco_estado: '', timezone: 'America/Sao_Paulo',
  }
}

export default function Lojas() {
  const { lojaAtiva, trocarLoja, atualizarContextoLojas } = useAuth()
  const { toast } = useToast()
  const [lojas, setLojas] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [auditoria, setAuditoria] = useState(null)
  const [checkingId, setCheckingId] = useState(null)

  const lojasAtivas = useMemo(() => lojas.filter((loja) => loja.ativa !== false), [lojas])

  async function carregar() {
    setLoading(true)
    try {
      const dados = await api.get('/api/lojas?incluir_inativas=true')
      const lista = dados.lojas || []
      setLojas(lista)
      const ativa = lista.find((loja) => loja.id === dados.loja_ativa_id) || lista.find((loja) => loja.id === lojaAtiva?.id) || lista[0]
      atualizarContextoLojas({ loja: ativa, lojas_acessiveis: lista.filter((loja) => loja.ativa !== false) })
    } catch (error) {
      toast(error.message || 'Não foi possível carregar as lojas', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function atualizarCampo(campo, valor) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
  }

  async function criarLoja(event) {
    event.preventDefault()
    if (!form.codigo.trim() || !form.nome.trim()) {
      toast('Informe o código e o nome da loja.', 'error')
      return
    }
    setSaving(true)
    try {
      const dados = Object.fromEntries(Object.entries(form).map(([chave, valor]) => [chave, typeof valor === 'string' ? valor.trim() : valor]).filter(([, valor]) => valor !== ''))
      const resposta = await api.post('/api/lojas', dados)
      toast(`Unidade ${resposta.loja.nome} criada com sucesso.`, 'success')
      setForm(emptyForm())
      await carregar()
    } catch (error) {
      toast(error.message || 'Não foi possível criar a loja', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function alternarStatus(loja) {
    try {
      const resposta = await api.patch(`/api/lojas/${loja.id}`, { ativa: !loja.ativa })
      setLojas((anteriores) => anteriores.map((item) => item.id === loja.id ? resposta.loja : item))
      toast(resposta.loja.ativa ? 'Loja reativada.' : 'Loja desativada.', 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível atualizar a loja', 'error')
    }
  }

  async function verificarAuditoria(loja) {
    setCheckingId(loja.id)
    try {
      const resposta = await api.get(`/api/lojas/${loja.id}/auditoria/verificar`)
      setAuditoria({ loja, verificacao: resposta.verificacao, sucesso: resposta.sucesso })
      toast(resposta.sucesso ? 'Cadeia de auditoria íntegra.' : 'Foi identificada uma inconsistência na auditoria.', resposta.sucesso ? 'success' : 'error')
    } catch (error) {
      toast(error.message || 'Não foi possível verificar a auditoria', 'error')
    } finally {
      setCheckingId(null)
    }
  }

  return (
    <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 24px 48px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: 'var(--green)', fontSize: 12, fontWeight: 900, letterSpacing: '1px', margin: '0 0 5px', textTransform: 'uppercase' }}>Fundação multiloja</p>
          <h1 style={{ color: 'var(--cream)', fontSize: 28, margin: 0 }}>Unidades operacionais</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', maxWidth: 700 }}>Cadastre filiais, alterne o contexto ativo e valide a trilha de auditoria encadeada da empresa.</p>
        </div>
        {lojaAtiva && (
          <div style={{ padding: '10px 13px', border: '1px solid rgba(255,107,44,.35)', background: 'rgba(255,107,44,.09)', borderRadius: 9, color: 'var(--cream)', fontSize: 13 }}>
            Operando em: <strong>{lojaAtiva.nome || lojaAtiva.nome_fantasia}</strong>
          </div>
        )}
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, .65fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 16, color: 'var(--cream)', margin: 0 }}>Lojas cadastradas</h2>
              <small style={{ color: 'var(--muted)' }}>{lojasAtivas.length} unidade(s) ativa(s)</small>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={carregar} disabled={loading}>Atualizar</button>
          </div>
          {loading ? (
            <div style={{ padding: 28, color: 'var(--muted)' }}>Carregando unidades…</div>
          ) : lojas.length === 0 ? (
            <div style={{ padding: 28, color: 'var(--muted)' }}>Nenhuma unidade encontrada.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                <thead>
                  <tr style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.55px' }}>
                    {['Unidade', 'Localização', 'Status', 'Ações'].map((cabecalho) => <th key={cabecalho} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>{cabecalho}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {lojas.map((loja) => (
                    <tr key={loja.id} style={{ borderBottom: '1px solid var(--line)', color: 'var(--cream)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <strong style={{ display: 'block', fontSize: 13 }}>{loja.nome}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: 11 }}>{loja.codigo}{loja.nome_fantasia ? ` · ${loja.nome_fantasia}` : ''}</span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: 12 }}>{[loja.endereco_cidade, loja.endereco_estado].filter(Boolean).join(' / ') || 'Não informado'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 7px', borderRadius: 999, color: loja.ativa ? '#FF9B72' : '#e7a1a1', background: loja.ativa ? 'rgba(255,107,44,.14)' : 'rgba(224,92,92,.12)' }}>{loja.ativa ? 'ATIVA' : 'INATIVA'}</span>
                        {lojaAtiva?.id === loja.id && <span style={{ display: 'block', marginTop: 5, color: 'var(--gold)', fontSize: 10, fontWeight: 800 }}>EM USO</span>}
                      </td>
                      <td style={{ padding: '14px 16px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {loja.ativa && lojaAtiva?.id !== loja.id && <button className="btn btn-primary btn-sm" onClick={() => trocarLoja(loja.id)}>Usar</button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => verificarAuditoria(loja)} disabled={checkingId === loja.id}>{checkingId === loja.id ? 'Verificando…' : 'Auditar'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => alternarStatus(loja)}>{loja.ativa ? 'Desativar' : 'Reativar'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form onSubmit={criarLoja} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 18 }}>
          <h2 style={{ fontSize: 16, color: 'var(--cream)', margin: '0 0 16px' }}>Nova unidade</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Código da loja *"><input value={form.codigo} onChange={(e) => atualizarCampo('codigo', e.target.value.toUpperCase())} placeholder="EX.: FILIAL-CENTRO" style={inputStyle} required /></Field>
            <Field label="Nome *"><input value={form.nome} onChange={(e) => atualizarCampo('nome', e.target.value)} placeholder="Nome operacional" style={inputStyle} required /></Field>
            <Field label="Nome fantasia"><input value={form.nome_fantasia} onChange={(e) => atualizarCampo('nome_fantasia', e.target.value)} style={inputStyle} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
              <Field label="Cidade"><input value={form.endereco_cidade} onChange={(e) => atualizarCampo('endereco_cidade', e.target.value)} style={inputStyle} /></Field>
              <Field label="UF"><input maxLength="2" value={form.endereco_estado} onChange={(e) => atualizarCampo('endereco_estado', e.target.value.toUpperCase())} style={inputStyle} /></Field>
            </div>
            <Field label="Telefone"><input value={form.telefone} onChange={(e) => atualizarCampo('telefone', e.target.value)} style={inputStyle} /></Field>
            <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => atualizarCampo('email', e.target.value)} style={inputStyle} /></Field>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={saving}>{saving ? 'Criando unidade…' : 'Criar unidade'}</button>
        </form>
      </section>

      {auditoria && (
        <section style={{ marginTop: 20, background: auditoria.sucesso ? 'rgba(255,107,44,.09)' : 'rgba(224,92,92,.10)', border: `1px solid ${auditoria.sucesso ? 'rgba(255,107,44,.34)' : 'rgba(224,92,92,.35)'}`, borderRadius: 11, padding: '14px 16px', color: 'var(--cream)' }}>
          <strong>Auditoria — {auditoria.loja.nome}</strong>
          <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 13 }}>{auditoria.verificacao?.motivo || (auditoria.sucesso ? 'Cadeia de auditoria íntegra.' : 'A cadeia possui inconsistências.')}</p>
        </section>
      )}
    </main>
  )
}
