import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtDate, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY_TRANSACTION = { valor: '', metodo: 'pix', descricao: '', referencia: '' }
const EMPTY_TERMINAL = { nome: '', tipo: 'mercado_pago_point', ambiente: 'homologacao', terminal: '', loja: '', chavePublica: '', chavePrivada: '', webhookSecret: '' }
const EMPTY_MP = { publicKey: '', accessToken: '', webhookSecret: '', userId: '' }

const statusColor = (status) => ({ aprovado: '#16806b', pendente: '#c47a00', recusado: '#b23a48', cancelado: '#6b7280' }[status] || '#6b7280')

function Kpi({ label, value, color = '#FF6B2C', detail }) {
  return <div className="card" style={{ flex: 1, minWidth: 168, borderLeft: `4px solid ${color}`, padding: '15px 17px' }}>
    <div style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: '.06em', fontWeight: 800 }}>{label}</div>
    <div style={{ color, fontWeight: 850, fontSize: 22, marginTop: 5 }}>{value}</div>
    {detail && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>{detail}</div>}
  </div>
}

function Field({ label, children, wide = false }) {
  return <label style={{ display: 'grid', gap: 6, gridColumn: wide ? '1 / -1' : undefined }}>
    <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800, letterSpacing: '.05em' }}>{label}</span>
    {children}
  </label>
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--text)' }

export default function Pagamentos() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [pix, setPix] = useState([])
  const [adquirentes, setAdquirentes] = useState([])
  const [mercadoPago, setMercadoPago] = useState(null)
  const [transacoes, setTransacoes] = useState([])
  const [totais, setTotais] = useState({ total: 0, aprovado: 0, pendente: 0, porMetodo: {} })
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [transactionForm, setTransactionForm] = useState(EMPTY_TRANSACTION)
  const [terminalForm, setTerminalForm] = useState(EMPTY_TERMINAL)
  const [mpForm, setMpForm] = useState(EMPTY_MP)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [pixRes, terminaisRes, mpRes, transacoesRes] = await Promise.all([
        api.get('/api/admin/pagamentos/pix'),
        api.get('/api/admin/pagamentos/adquirentes'),
        api.get('/api/admin/pagamentos/mercadopago/config'),
        api.get('/api/admin/pagamentos/transacoes'),
      ])
      setPix(pixRes.chaves || [])
      setAdquirentes(terminaisRes.adquirentes || [])
      setMercadoPago(mpRes.config || null)
      setTransacoes(transacoesRes.transacoes || [])
      setTotais(transacoesRes.totais || { total: 0, aprovado: 0, pendente: 0, porMetodo: {} })
    } catch (error) {
      toast(error.message || 'Não foi possível carregar a central de pagamentos.', 'error')
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const criarTransacao = async () => {
    const valor = Number(String(transactionForm.valor).replace(',', '.'))
    if (!valor || valor <= 0) return toast('Informe um valor válido para a transação.', 'error')
    setSaving(true)
    try {
      await api.post('/api/admin/pagamentos/transacao', { ...transactionForm, valor, status: 'pendente' })
      toast('Transação registrada como pendente de confirmação do provedor.')
      setModal(null); setTransactionForm(EMPTY_TRANSACTION); carregar()
    } catch (error) { toast(error.message || 'Não foi possível registrar a transação.', 'error') }
    finally { setSaving(false) }
  }

  const salvarTerminal = async () => {
    if (!terminalForm.nome || !terminalForm.tipo) return toast('Informe o nome e o provedor do terminal.', 'error')
    setSaving(true)
    try {
      await api.post('/api/admin/pagamentos/adquirentes', terminalForm)
      toast('Terminal configurado. A credencial privada foi protegida no cofre de pagamentos.')
      setModal(null); setTerminalForm(EMPTY_TERMINAL); carregar()
    } catch (error) { toast(error.message || 'Não foi possível configurar o terminal.', 'error') }
    finally { setSaving(false) }
  }

  const homologarTerminal = async (terminal) => {
    setSaving(true)
    try {
      const resultado = await api.post(`/api/admin/pagamentos/adquirentes/${terminal.id}/homologar`, {})
      toast(`Homologação preparada para ${terminal.nome}. Configure o webhook: ${resultado.webhookUrl}`)
      carregar()
    } catch (error) { toast(error.message || 'Não foi possível preparar a homologação.', 'error') }
    finally { setSaving(false) }
  }

  const salvarMercadoPago = async () => {
    if (!mpForm.accessToken) return toast('Informe o Access Token do Mercado Pago.', 'error')
    setSaving(true)
    try {
      await api.post('/api/admin/pagamentos/mercadopago/config', mpForm)
      toast('Mercado Pago configurado com credenciais protegidas. A ativação real depende do webhook e dos terminais autorizados.')
      setModal(null); setMpForm(EMPTY_MP); carregar()
    } catch (error) { toast(error.message || 'Não foi possível salvar a configuração do Mercado Pago.', 'error') }
    finally { setSaving(false) }
  }

  const recentes = useMemo(() => transacoes.slice(0, 10), [transacoes])

  return <div className="page">
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' }}>
      <div>
        <h1 className="page-title" style={{ marginBottom: 5 }}>Pagamentos</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>PIX, terminais, Mercado Pago e conciliação pertencem exclusivamente à empresa ativa.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={carregar}>↺ Atualizar</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setModal('terminal')}>▣ Terminal</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setModal('mercadopago')}>MP Mercado Pago</button>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('transacao')}>+ Registrar transação</button>
      </div>
    </div>

    <div className="card" style={{ marginBottom: 18, padding: 14, background: 'rgba(255,107,44,.06)', borderColor: 'rgba(255,107,44,.25)' }}>
      <strong style={{ color: '#FF6B2C' }}>Prontidão de cobrança:</strong> a chave PIX é exibida somente mascarada. Credenciais de terminais e Mercado Pago ficam cifradas e nunca são devolvidas pela API. Para cobrança real, configure o provedor e o webhook autenticado.
    </div>

    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      <Kpi label="RECEBIDO" value={fmtR(totais.aprovado)} color="#16806b" detail="Transações aprovadas" />
      <Kpi label="PENDENTE" value={fmtR(totais.pendente)} color="#c47a00" detail="Aguardando provedor" />
      <Kpi label="PIX ATIVO" value={String(pix.length)} detail={pix.length ? 'Chave(s) configurada(s)' : 'Configure uma chave PIX'} />
      <Kpi label="TERMINAIS" value={String(adquirentes.length)} color="#12283F" detail="Máquinas/adquirentes" />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, marginBottom: 18 }}>
      <section className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#12283F' }}>PIX configurado</h2>
        {loading ? <p style={{ color: 'var(--muted)' }}>Carregando…</p> : pix.length === 0 ? <p style={{ color: 'var(--muted)' }}>Nenhuma chave PIX cadastrada para esta empresa.</p> : pix.map((chave) => <div key={chave.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
          <strong>{chave.nomeTitular || 'Titular não informado'}</strong><br /><span style={{ color: 'var(--muted)', fontSize: 12 }}>{chave.tipo?.toUpperCase()} · {chave.chave} · {chave.ativa ? 'Ativa' : 'Inativa'}</span>
        </div>)}
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#12283F' }}>Mercado Pago</h2>
        {mercadoPago ? <>
          <p style={{ margin: '0 0 8px', color: '#16806b', fontWeight: 750 }}>Configuração protegida</p>
          <div style={{ color: 'var(--muted)', fontSize: 12, display: 'grid', gap: 4 }}>
            <span>Token: {mercadoPago.accessTokenConfigurado ? 'configurado' : 'pendente'}</span>
            <span>Webhook: {mercadoPago.webhookConfigurado ? 'configurado' : 'pendente'}</span>
            <span>Usuário do provedor: {mercadoPago.userId || 'não informado'}</span>
          </div>
        </> : <p style={{ color: 'var(--muted)' }}>Ainda não configurado. Informe as credenciais de uma conta vendedora da empresa.</p>}
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#12283F' }}>Terminais e adquirentes</h2>
        {adquirentes.length === 0 ? <p style={{ color: 'var(--muted)' }}>Nenhum terminal configurado.</p> : adquirentes.map((terminal) => <div key={terminal.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
          <strong>{terminal.nome}</strong><br /><span style={{ color: 'var(--muted)', fontSize: 12 }}>{terminal.tipo} · {terminal.ambiente || 'homologacao'} · {terminal.terminal || 'Terminal não identificado'} · {terminal.credencialConfigurada ? 'Credencial protegida' : 'Sem credencial'} · {terminal.statusHomologacao || 'não iniciada'}</span><br />{terminal.credencialConfigurada && terminal.webhookConfigurado && terminal.statusHomologacao !== 'webhook_validado' && <button className="btn btn-ghost btn-sm" style={{ marginTop: 7 }} onClick={() => homologarTerminal(terminal)} disabled={saving}>Preparar homologação</button>}
        </div>)}
      </section>
    </div>

    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: '#12283F' }}>Transações recentes</h2><span style={{ color: 'var(--muted)', fontSize: 12 }}>{transacoes.length} registradas</span>
      </div>
      {recentes.length === 0 ? <p style={{ color: 'var(--muted)' }}>Nenhuma transação registrada nesta empresa.</p> : <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}>{['Data', 'Método', 'Descrição', 'Valor', 'Status'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 9, color: 'var(--muted)' }}>{h}</th>)}</tr></thead><tbody>{recentes.map((t) => <tr key={t.id} style={{ borderBottom: '1px solid var(--line)' }}><td style={{ padding: 9 }}>{fmtDate(t.criadaEm)}</td><td style={{ padding: 9, textTransform: 'capitalize' }}>{t.metodo}</td><td style={{ padding: 9 }}>{t.descricao || '—'}</td><td style={{ padding: 9, fontWeight: 750 }}>{fmtR(t.valor)}</td><td style={{ padding: 9 }}><span style={{ color: statusColor(t.status), fontWeight: 800 }}>{t.status}</span></td></tr>)}</tbody></table></div>}
    </section>

    {modal === 'transacao' && <Modal title="Registrar transação" onClose={() => setModal(null)} width={560}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Field label="Valor (R$)"><input autoFocus style={inputStyle} inputMode="decimal" value={transactionForm.valor} onChange={(e) => setTransactionForm({ ...transactionForm, valor: e.target.value })} /></Field><Field label="Método"><select style={inputStyle} value={transactionForm.metodo} onChange={(e) => setTransactionForm({ ...transactionForm, metodo: e.target.value })}><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="mercadopago">Mercado Pago</option></select></Field><Field label="Descrição" wide><input style={inputStyle} value={transactionForm.descricao} onChange={(e) => setTransactionForm({ ...transactionForm, descricao: e.target.value })} /></Field><Field label="Referência" wide><input style={inputStyle} value={transactionForm.referencia} onChange={(e) => setTransactionForm({ ...transactionForm, referencia: e.target.value })} /></Field></div><Actions onCancel={() => setModal(null)} onSave={criarTransacao} saving={saving} label="Registrar como pendente" /></Modal>}

    {modal === 'terminal' && <Modal title="Configurar terminal / adquirente" onClose={() => setModal(null)} width={620}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Field label="Nome do terminal *"><input style={inputStyle} value={terminalForm.nome} onChange={(e) => setTerminalForm({ ...terminalForm, nome: e.target.value })} /></Field><Field label="Provedor *"><select style={inputStyle} value={terminalForm.tipo} onChange={(e) => setTerminalForm({ ...terminalForm, tipo: e.target.value })}><option value="mercado_pago_point">Mercado Pago Point</option><option value="cielo">Cielo</option><option value="rede">Rede</option><option value="stone">Stone</option><option value="getnet">Getnet</option><option value="sicoob">Sicoob (PIX)</option><option value="sicredi">Sicredi (PIX)</option><option value="outro">Outro</option></select></Field><Field label="Ambiente"><select style={inputStyle} value={terminalForm.ambiente} onChange={(e) => setTerminalForm({ ...terminalForm, ambiente: e.target.value })}><option value="homologacao">Homologação</option><option value="producao">Produção</option></select></Field><Field label="Identificação do terminal"><input style={inputStyle} value={terminalForm.terminal} onChange={(e) => setTerminalForm({ ...terminalForm, terminal: e.target.value })} /></Field><Field label="Loja / estabelecimento"><input style={inputStyle} value={terminalForm.loja} onChange={(e) => setTerminalForm({ ...terminalForm, loja: e.target.value })} /></Field><Field label="Chave pública" wide><input style={inputStyle} value={terminalForm.chavePublica} onChange={(e) => setTerminalForm({ ...terminalForm, chavePublica: e.target.value })} /></Field><Field label="Credencial privada" wide><input type="password" style={inputStyle} value={terminalForm.chavePrivada} onChange={(e) => setTerminalForm({ ...terminalForm, chavePrivada: e.target.value })} /></Field><Field label="Segredo de assinatura do webhook" wide><input type="password" style={inputStyle} value={terminalForm.webhookSecret} onChange={(e) => setTerminalForm({ ...terminalForm, webhookSecret: e.target.value })} /></Field></div><p style={{ color: 'var(--muted)', fontSize: 12 }}>Credenciais e assinaturas de webhook são cifradas antes da persistência e não voltam a ser exibidas. Mantenha em homologação até validar uma transação do provedor.</p><Actions onCancel={() => setModal(null)} onSave={salvarTerminal} saving={saving} label="Salvar terminal" /></Modal>}

    {modal === 'mercadopago' && <Modal title="Configurar Mercado Pago" onClose={() => setModal(null)} width={620}><div style={{ display: 'grid', gap: 12 }}><Field label="Public Key"><input style={inputStyle} value={mpForm.publicKey} onChange={(e) => setMpForm({ ...mpForm, publicKey: e.target.value })} /></Field><Field label="Access Token *"><input type="password" style={inputStyle} value={mpForm.accessToken} onChange={(e) => setMpForm({ ...mpForm, accessToken: e.target.value })} /></Field><Field label="Assinatura secreta de webhook"><input type="password" style={inputStyle} value={mpForm.webhookSecret} onChange={(e) => setMpForm({ ...mpForm, webhookSecret: e.target.value })} /></Field><Field label="ID do usuário vendedor"><input style={inputStyle} value={mpForm.userId} onChange={(e) => setMpForm({ ...mpForm, userId: e.target.value })} /></Field></div><p style={{ color: 'var(--muted)', fontSize: 12 }}>Use credenciais produtivas somente após testar o webhook. O token e a assinatura serão cifrados em repouso.</p><Actions onCancel={() => setModal(null)} onSave={salvarMercadoPago} saving={saving} label="Salvar configuração protegida" /></Modal>}
  </div>
}

function Actions({ onCancel, onSave, saving, label }) { return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}><button className="btn btn-ghost" onClick={onCancel}>Cancelar</button><button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Salvando…' : label}</button></div> }
