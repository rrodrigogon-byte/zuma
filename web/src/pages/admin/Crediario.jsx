/**
 * Crediário Próprio — SetPoint Ultra
 * Gestão de contas a prazo, carnê, régua de cobrança e inadimplência
 * Rota: /admin/crediario
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtData } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const T = {
  bg: '#0f1117', surface: '#1a1d27', card: '#22263a',
  green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df',
  line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff',
}

const STATUS_COR = { aberta: T.blue, quitada: T.green, renegociada: T.yellow, cancelada: T.muted }
const STATUS_LABEL = { aberta: 'Aberta', quitada: 'Quitada', renegociada: 'Renegociada', cancelada: 'Cancelada' }

const ABAS = ['Contas', 'Inadimplência', 'Régua de Cobrança', 'Resumo']

export default function Crediario() {
  const { toast } = useToast()
  const [aba, setAba] = useState(0)
  const [contas, setContas] = useState([])
  const [inadimplentes, setInadimplentes] = useState([])
  const [resumo, setResumo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modalNova, setModalNova] = useState(false)
  const [modalCarne, setModalCarne] = useState(null)
  const [modalReneg, setModalReneg] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('')

  const [form, setForm] = useState({
    cliente_id: '', cliente_nome: '', valor_total: '',
    entrada: '0', num_parcelas: '3', dia_vencimento: '10',
    taxa_juros_mensal: '0', descricao: '',
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [c, i, r] = await Promise.all([
        api.get(`/api/v1/crediario/contas${filtroStatus ? `?status=${filtroStatus}` : ''}`),
        api.get('/api/v1/crediario/inadimplencia'),
        api.get('/api/v1/crediario/resumo'),
      ])
      setContas(Array.isArray(c) ? c : [])
      setInadimplentes(Array.isArray(i) ? i : [])
      setResumo(r)
    } catch { } finally { setLoading(false) }
  }, [filtroStatus])

  useEffect(() => { carregar() }, [carregar])

  // Calcular preview do carnê
  const previewParcelas = () => {
    const vf = parseFloat(form.valor_total || 0) - parseFloat(form.entrada || 0)
    const n = parseInt(form.num_parcelas || 1)
    const i = parseFloat(form.taxa_juros_mensal || 0) / 100
    if (vf <= 0 || n < 1) return []
    let vp
    if (i > 0) {
      vp = vf * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
    } else {
      vp = vf / n
    }
    return Array.from({ length: n }, (_, k) => {
      const d = new Date()
      d.setMonth(d.getMonth() + k + 1)
      d.setDate(parseInt(form.dia_vencimento || 10))
      return { num: k + 1, valor: vp, venc: d.toLocaleDateString('pt-BR') }
    })
  }

  const criarConta = async () => {
    if (!form.cliente_id || !form.valor_total || !form.descricao) {
      return toast('Preencha todos os campos obrigatórios', 'error')
    }
    try {
      await api.post('/api/v1/crediario/contas', form)
      toast('Conta criada com sucesso!', 'success')
      setModalNova(false)
      setForm({ cliente_id: '', cliente_nome: '', valor_total: '', entrada: '0', num_parcelas: '3', dia_vencimento: '10', taxa_juros_mensal: '0', descricao: '' })
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  const executarRegua = async () => {
    try {
      setLoading(true)
      const r = await api.post('/api/v1/crediario/regua-cobranca', {})
      toast(`Régua executada: ${r.vencendo} avisos de vencimento, ${r.vencidas} cobranças de atraso`, 'success')
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const atualizarJuros = async () => {
    try {
      const r = await api.post('/api/v1/crediario/atualizar-juros', {})
      toast(`${r.atualizadas} parcelas atualizadas com juros e multa`, 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  const parcelas = previewParcelas()

  return (
    <div style={{ padding: '20px 24px', color: T.cream }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>💳 Crediário Próprio</h1>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Gestão de contas a prazo, carnê e cobrança</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={atualizarJuros} style={{ padding: '8px 14px', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.yellow, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            ⚡ Atualizar Juros
          </button>
          <button onClick={() => setModalNova(true)} style={{ padding: '8px 16px', background: T.green, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            + Nova Conta
          </button>
        </div>
      </div>

      {/* KPIs */}
      {resumo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Carteira Ativa', valor: fmtR(resumo.carteira_ativa), cor: T.blue, icon: '📋' },
            { label: 'A Receber', valor: fmtR(resumo.a_receber), cor: T.green, icon: '💰' },
            { label: 'Inadimplente', valor: fmtR(resumo.inadimplente), cor: T.red, icon: '⚠️' },
            { label: 'Contas Abertas', valor: resumo.contas_abertas, cor: T.yellow, icon: '📄' },
          ].map((k, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</span>
                <span style={{ fontSize: 18 }}>{k.icon}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: k.cor }}>{k.valor}</div>
            </div>
          ))}
        </div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${T.line}` }}>
        {ABAS.map((a, i) => (
          <button key={i} onClick={() => setAba(i)} style={{
            padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            color: aba === i ? T.green : T.muted,
            borderBottom: aba === i ? `2px solid ${T.green}` : '2px solid transparent',
          }}>{a}</button>
        ))}
      </div>

      {/* ── Aba 0: Contas ─────────────────────────────────────────────────── */}
      {aba === 0 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['', 'aberta', 'quitada', 'renegociada'].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: filtroStatus === s ? T.green : T.surface,
                color: filtroStatus === s ? '#fff' : T.muted,
              }}>
                {s === '' ? 'Todas' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contas.map(c => (
              <div key={c.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{c.cliente_nome}</div>
                    <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{c.descricao}</div>
                    <div style={{ color: T.muted, fontSize: 11, marginTop: 4 }}>
                      {c.parcelas_pagas}/{c.total_parcelas} parcelas pagas · Vence dia {c.dia_vencimento}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: T.green }}>{fmtR(c.saldo_devedor || 0)}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>saldo devedor</div>
                    <div style={{ marginTop: 6, padding: '3px 10px', borderRadius: 20, background: `${STATUS_COR[c.status]}22`, color: STATUS_COR[c.status], fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                      {STATUS_LABEL[c.status]}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setModalCarne(c)} style={{ padding: '6px 12px', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    🧾 Ver Carnê
                  </button>
                  {c.status === 'aberta' && (
                    <button onClick={() => setModalReneg(c)} style={{ padding: '6px 12px', background: T.surface, border: `1px solid ${T.yellow}`, borderRadius: 8, color: T.yellow, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      🔄 Renegociar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!loading && contas.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>Nenhuma conta encontrada</div>
            )}
          </div>
        </div>
      )}

      {/* ── Aba 1: Inadimplência ──────────────────────────────────────────── */}
      {aba === 1 && (
        <div>
          <div style={{ background: T.card, border: `1px solid ${T.red}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: T.red }}>⚠️ Clientes Inadimplentes</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.line}` }}>
                  {['Cliente', 'Telefone', 'Parcelas Vencidas', 'Total Vencido', 'Maior Atraso', 'Ação'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: T.muted, fontWeight: 700, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inadimplentes.map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{c.nome}</td>
                    <td style={{ padding: '10px 12px', color: T.muted }}>{c.telefone}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{c.parcelas_vencidas}</td>
                    <td style={{ padding: '10px 12px', color: T.red, fontWeight: 800 }}>{fmtR(c.total_vencido)}</td>
                    <td style={{ padding: '10px 12px', color: T.red }}>{c.max_dias_atraso} dias</td>
                    <td style={{ padding: '10px 12px' }}>
                      <a href={`https://wa.me/55${c.telefone?.replace(/\D/g, '')}?text=Olá ${c.nome}, você possui parcelas em atraso.`}
                        target="_blank" rel="noreferrer"
                        style={{ padding: '4px 10px', background: '#25d366', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Aba 2: Régua de Cobrança ──────────────────────────────────────── */}
      {aba === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🤖 Régua de Cobrança Automática</div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Envio automático de WhatsApp por estágio de atraso</div>
            {[
              { dias: -2, label: 'Lembrete (2 dias antes)', msg: 'Sua parcela vence em 2 dias', cor: T.blue },
              { dias: 1, label: 'Vencida (1 dia)', msg: 'Sua parcela venceu ontem', cor: T.yellow },
              { dias: 3, label: 'Atraso (3 dias)', msg: 'Parcela em atraso + juros', cor: T.yellow },
              { dias: 7, label: 'Atraso (7 dias)', msg: 'Regularize para evitar negativação', cor: T.red },
              { dias: 15, label: 'Atraso (15 dias)', msg: 'Proposta de renegociação', cor: T.red },
              { dias: 30, label: 'Atraso (30 dias)', msg: 'Último aviso antes de negativar', cor: T.red },
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${T.line}` }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${e.cor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {e.dias < 0 ? '🔔' : e.dias <= 3 ? '⚠️' : '🚨'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: e.cor }}>{e.label}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{e.msg}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green }} />
              </div>
            ))}
            <button onClick={executarRegua} disabled={loading} style={{
              width: '100%', marginTop: 20, padding: '12px', background: T.green, border: 'none',
              borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 800,
            }}>
              {loading ? 'Executando...' : '▶ Executar Régua Agora'}
            </button>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>⚙️ Configurações de Cobrança</div>
            {[
              { label: 'Multa por atraso', valor: '2%' },
              { label: 'Mora diária', valor: '0,1% ao dia' },
              { label: 'Dias para negativação', valor: '90 dias' },
              { label: 'Intervalo mínimo entre cobranças', valor: '3 dias' },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
                <span style={{ color: T.muted }}>{c.label}</span>
                <span style={{ fontWeight: 700 }}>{c.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Aba 3: Resumo ─────────────────────────────────────────────────── */}
      {aba === 3 && resumo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>📊 Resumo do Crediário</div>
            {[
              { label: 'Contas Abertas', valor: resumo.contas_abertas, fmt: v => v },
              { label: 'Contas Quitadas', valor: resumo.contas_quitadas, fmt: v => v },
              { label: 'Carteira Ativa', valor: resumo.carteira_ativa, fmt: fmtR },
              { label: 'Total a Receber', valor: resumo.a_receber, fmt: fmtR },
              { label: 'Total Inadimplente', valor: resumo.inadimplente, fmt: fmtR },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
                <span style={{ color: T.muted }}>{item.label}</span>
                <span style={{ fontWeight: 800 }}>{item.fmt(item.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: Nova Conta ─────────────────────────────────────────────── */}
      {modalNova && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 28, width: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>💳 Nova Conta a Prazo</div>
              <button onClick={() => setModalNova(false)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'ID do Cliente *', key: 'cliente_id', placeholder: 'UUID do cliente' },
                { label: 'Nome do Cliente', key: 'cliente_nome', placeholder: 'Para exibição' },
                { label: 'Descrição *', key: 'descricao', placeholder: 'Ex: Compra de roupas' },
                { label: 'Valor Total (R$) *', key: 'valor_total', type: 'number', placeholder: '0,00' },
                { label: 'Entrada (R$)', key: 'entrada', type: 'number', placeholder: '0,00' },
                { label: 'Nº de Parcelas', key: 'num_parcelas', type: 'number', placeholder: '3' },
                { label: 'Dia de Vencimento', key: 'dia_vencimento', type: 'number', placeholder: '10' },
                { label: 'Taxa de Juros Mensal (%)', key: 'taxa_juros_mensal', type: 'number', placeholder: '0' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 5 }}>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '9px 12px', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>

            {/* Preview do carnê */}
            {parcelas.length > 0 && (
              <div style={{ marginTop: 20, background: T.surface, borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>🧾 Preview do Carnê</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {parcelas.map(p => (
                    <div key={p.num} style={{ background: T.card, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: T.muted }}>Parcela {p.num}/{parcelas.length}</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: T.green, margin: '4px 0' }}>{fmtR(p.valor)}</div>
                      <div style={{ fontSize: 10, color: T.muted }}>{p.venc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalNova(false)} style={{ padding: '10px 20px', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.muted, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={criarConta} style={{ padding: '10px 24px', background: T.green, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                Criar Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Carnê ──────────────────────────────────────────────────── */}
      {modalCarne && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 28, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>🧾 Carnê — {modalCarne.cliente_nome}</div>
              <button onClick={() => setModalCarne(null)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>
              {modalCarne.descricao} · {modalCarne.num_parcelas}x · Vence dia {modalCarne.dia_vencimento}
            </div>
            <ModalCarneConteudo contaId={modalCarne.id} />
          </div>
        </div>
      )}
    </div>
  )
}

function ModalCarneConteudo({ contaId }) {
  const { toast } = useToast()
  const [carne, setCarne] = useState(null)

  useEffect(() => {
    api.get(`/api/v1/crediario/contas/${contaId}/carne`).then(setCarne).catch(() => { })
  }, [contaId])

  if (!carne) return <div style={{ textAlign: 'center', color: '#8a8fa8', padding: 20 }}>Carregando...</div>

  const pagarParcela = async (parcelaId) => {
    const valor = prompt('Valor pago (R$):')
    if (!valor) return
    try {
      await api.post(`/api/v1/crediario/parcelas/${parcelaId}/pagar`, {
        valor_pago: parseFloat(valor.replace(',', '.')),
        forma_pagamento: 'dinheiro',
      })
      toast('Pagamento registrado!', 'success')
      const atualizado = await api.get(`/api/v1/crediario/contas/${contaId}/carne`)
      setCarne(atualizado)
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(carne.parcelas || []).map(p => {
        const vencida = new Date(p.data_vencimento) < new Date() && p.status === 'aberta'
        return (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            background: '#1a1d27', borderRadius: 10,
            borderLeft: `3px solid ${p.status === 'paga' ? '#5fb335' : vencida ? '#e05c5c' : '#4a9eff'}`,
          }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.status === 'paga' ? '#5fb33533' : '#22263a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
              {p.numero}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtR(p.valor_atualizado || p.valor)}</div>
              <div style={{ fontSize: 11, color: '#8a8fa8' }}>Vence: {new Date(p.data_vencimento + 'T12:00').toLocaleDateString('pt-BR')}</div>
            </div>
            {p.status === 'paga' ? (
              <span style={{ fontSize: 11, color: '#5fb335', fontWeight: 700 }}>✓ Pago</span>
            ) : (
              <button onClick={() => pagarParcela(p.id)} style={{ padding: '5px 12px', background: '#5fb335', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                Pagar
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
