/**
 * Billing & Assinaturas SaaS — KYTTO Clube
 * Gestão de planos, cobranças, tenant onboarding e métricas SaaS
 * Rota: /admin/billing
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtData } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const T = {
  bg: '#0f1117', surface: '#1a1d27', card: '#22263a',
  green: '#FF6B2C', muted: '#8a8fa8', cream: '#e8e6df',
  line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff', purple: '#9b59b6',
}

const PLANOS = [
  {
    id: 'starter', nome: 'Starter', preco: 99, cor: T.blue,
    desc: 'Para barbearias e salões pequenos',
    modulos: ['PDV Básico', 'Agendamento Online', 'Controle de Caixa', 'App Mobile', 'Suporte por e-mail'],
    limite_usuarios: 3, limite_produtos: 500,
  },
  {
    id: 'profissional', nome: 'Profissional', preco: 199, cor: T.green,
    desc: 'Para lojas e comércios em crescimento',
    modulos: ['Tudo do Starter', 'NFC-e / NF-e', 'Estoque Avançado', 'Crediário Próprio', 'WhatsApp Automático', 'BI & Relatórios', 'Suporte prioritário'],
    limite_usuarios: 10, limite_produtos: 5000, destaque: true,
  },
  {
    id: 'enterprise', nome: 'Enterprise', preco: 299, cor: T.purple,
    desc: 'Para supermercados e redes',
    modulos: ['Tudo do Profissional', 'Multi-lojas', 'Balança Integrada', 'SPED Fiscal', 'API Pública', 'Onboarding dedicado', 'SLA 99.9%'],
    limite_usuarios: 999, limite_produtos: 999999,
  },
  {
    id: 'arena', nome: 'Arena Sports', preco: 249, cor: T.yellow,
    desc: 'Para arenas esportivas e clubes',
    modulos: ['Tudo do Profissional', 'Gestão de Quadras', 'Torneios & Rankings', 'App do Atleta', 'Catracas IoT', 'Luzes Automáticas'],
    limite_usuarios: 20, limite_produtos: 2000,
  },
]

const ABAS = ['Visão Geral', 'Tenants', 'Planos', 'Cobranças', 'Métricas SaaS']

export default function Billing() {
  const { toast } = useToast()
  const [aba, setAba] = useState(0)
  const [tenants, setTenants] = useState([])
  const [cobrancas, setCobrancas] = useState([])
  const [metricas, setMetricas] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modalNovo, setModalNovo] = useState(false)
  const [formTenant, setFormTenant] = useState({ nome: '', cnpj: '', email: '', telefone: '', plano_id: 'profissional', segmento: 'varejo' })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [t, c, m] = await Promise.all([
        api.get('/api/v1/billing/tenants'),
        api.get('/api/v1/billing/cobrancas'),
        api.get('/api/v1/billing/metricas'),
      ])
      setTenants(Array.isArray(t) ? t : [])
      setCobrancas(Array.isArray(c) ? c : [])
      setMetricas(m)
    } catch { } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const criarTenant = async () => {
    if (!formTenant.nome || !formTenant.email || !formTenant.cnpj) return toast('Preencha todos os campos', 'error')
    try {
      await api.post('/api/v1/billing/tenants', formTenant)
      toast('Tenant criado! E-mail de boas-vindas enviado.', 'success')
      setModalNovo(false)
      setFormTenant({ nome: '', cnpj: '', email: '', telefone: '', plano_id: 'profissional', segmento: 'varejo' })
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  const planoSel = PLANOS.find(p => p.id === formTenant.plano_id)

  return (
    <div style={{ padding: '20px 24px', color: T.cream }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>💼 Billing & Assinaturas</h1>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Gestão de tenants, planos e receita recorrente (MRR)</div>
        </div>
        <button onClick={() => setModalNovo(true)} style={{ padding: '9px 18px', background: T.green, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}>
          + Novo Tenant
        </button>
      </div>

      {/* KPIs SaaS */}
      {metricas && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'MRR', valor: fmtR(metricas.mrr), cor: T.green, icon: '💰' },
            { label: 'ARR', valor: fmtR(metricas.arr), cor: T.green, icon: '📈' },
            { label: 'Tenants Ativos', valor: metricas.tenants_ativos, cor: T.blue, icon: '🏢' },
            { label: 'Churn Rate', valor: `${metricas.churn_rate?.toFixed(1) || 0}%`, cor: T.red, icon: '📉' },
            { label: 'LTV Médio', valor: fmtR(metricas.ltv_medio), cor: T.yellow, icon: '⭐' },
          ].map((k, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</span>
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

      {/* ── Aba 0: Visão Geral ─────────────────────────────────────────── */}
      {aba === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>📊 Distribuição por Plano</div>
            {PLANOS.map(p => {
              const count = tenants.filter(t => t.plano_id === p.id).length
              const pct = tenants.length > 0 ? (count / tenants.length * 100).toFixed(0) : 0
              return (
                <div key={p.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 700 }}>{p.nome}</span>
                    <span style={{ color: T.muted }}>{count} tenants · {pct}%</span>
                  </div>
                  <div style={{ height: 8, background: T.surface, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: p.cor, borderRadius: 4, transition: 'width .3s' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>🕐 Últimas Ativações</div>
            {tenants.slice(0, 6).map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{t.nome}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{t.plano_id} · {t.segmento}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: T.green, fontWeight: 700 }}>{fmtR(PLANOS.find(p => p.id === t.plano_id)?.preco || 0)}/mês</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{t.criado_em ? new Date(t.criado_em).toLocaleDateString('pt-BR') : '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Aba 1: Tenants ─────────────────────────────────────────────── */}
      {aba === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tenants.map(t => {
            const plano = PLANOS.find(p => p.id === t.plano_id)
            return (
              <div key={t.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t.nome}</div>
                  <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{t.cnpj} · {t.email}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: `${plano?.cor || T.muted}22`, color: plano?.cor || T.muted, fontSize: 10, fontWeight: 700 }}>
                      {plano?.nome || t.plano_id}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: `${t.status === 'ativo' ? T.green : T.red}22`, color: t.status === 'ativo' ? T.green : T.red, fontSize: 10, fontWeight: 700 }}>
                      {t.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: 16, color: T.green }}>{fmtR(plano?.preco || 0)}<span style={{ fontSize: 11, color: T.muted }}>/mês</span></div>
                  <div style={{ color: T.muted, fontSize: 11, marginTop: 4 }}>Desde {t.criado_em ? new Date(t.criado_em).toLocaleDateString('pt-BR') : '—'}</div>
                </div>
              </div>
            )
          })}
          {tenants.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>Nenhum tenant cadastrado</div>}
        </div>
      )}

      {/* ── Aba 2: Planos ──────────────────────────────────────────────── */}
      {aba === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {PLANOS.map(p => (
            <div key={p.id} style={{ background: T.card, border: `2px solid ${p.destaque ? p.cor : T.line}`, borderRadius: 16, padding: 24, position: 'relative' }}>
              {p.destaque && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: p.cor, color: '#fff', padding: '3px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>MAIS POPULAR</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: p.cor }}>{p.nome}</div>
                  <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{p.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: T.cream }}>R$ {p.preco}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>/mês</div>
                </div>
              </div>
              <div style={{ marginBottom: 16, fontSize: 12, color: T.muted }}>
                Até {p.limite_usuarios === 999 ? 'ilimitados' : p.limite_usuarios} usuários · {p.limite_produtos === 999999 ? 'Produtos ilimitados' : `${p.limite_produtos.toLocaleString()} produtos`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {p.modulos.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: p.cor, fontWeight: 900 }}>✓</span>
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Aba 3: Cobranças ───────────────────────────────────────────── */}
      {aba === 3 && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line}` }}>
                {['Tenant', 'Plano', 'Valor', 'Vencimento', 'Status', 'Ação'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: T.muted, fontWeight: 700, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cobrancas.map((c, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
                  <td style={{ padding: '12px', fontWeight: 700 }}>{c.tenant_nome}</td>
                  <td style={{ padding: '12px', color: T.muted }}>{c.plano_id}</td>
                  <td style={{ padding: '12px', fontWeight: 800, color: T.green }}>{fmtR(c.valor)}</td>
                  <td style={{ padding: '12px', color: T.muted }}>{c.vencimento ? new Date(c.vencimento).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: c.status === 'pago' ? `${T.green}22` : c.status === 'vencido' ? `${T.red}22` : `${T.yellow}22`,
                      color: c.status === 'pago' ? T.green : c.status === 'vencido' ? T.red : T.yellow,
                    }}>
                      {c.status === 'pago' ? '✓ Pago' : c.status === 'vencido' ? '⚠ Vencido' : '⏳ Pendente'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {c.status !== 'pago' && (
                      <button style={{ padding: '4px 10px', background: T.green, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        Cobrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cobrancas.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>Nenhuma cobrança registrada</div>}
        </div>
      )}

      {/* ── Aba 4: Métricas SaaS ───────────────────────────────────────── */}
      {aba === 4 && metricas && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[
            { titulo: '💰 Receita Recorrente', items: [{ l: 'MRR (Mensal)', v: fmtR(metricas.mrr) }, { l: 'ARR (Anual)', v: fmtR(metricas.arr) }, { l: 'Crescimento MoM', v: `${metricas.crescimento_mom?.toFixed(1) || 0}%` }] },
            { titulo: '👥 Clientes', items: [{ l: 'Tenants Ativos', v: metricas.tenants_ativos }, { l: 'Novos (30 dias)', v: metricas.novos_30d }, { l: 'Churn Rate', v: `${metricas.churn_rate?.toFixed(1) || 0}%` }] },
            { titulo: '⭐ Valor do Cliente', items: [{ l: 'ARPU (Receita/Tenant)', v: fmtR(metricas.arpu) }, { l: 'LTV Médio', v: fmtR(metricas.ltv_medio) }, { l: 'CAC Estimado', v: fmtR(metricas.cac) }] },
            { titulo: '📊 Saúde do Negócio', items: [{ l: 'LTV/CAC Ratio', v: `${metricas.ltv_cac_ratio?.toFixed(1) || 0}x` }, { l: 'Payback Period', v: `${metricas.payback_meses || 0} meses` }, { l: 'NPS Score', v: metricas.nps || '—' }] },
          ].map((bloco, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>{bloco.titulo}</div>
              {bloco.items.map((item, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
                  <span style={{ color: T.muted }}>{item.l}</span>
                  <span style={{ fontWeight: 800 }}>{item.v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Novo Tenant ─────────────────────────────────────────── */}
      {modalNovo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 28, width: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>🏢 Novo Tenant / Cliente</div>
              <button onClick={() => setModalNovo(false)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Nome da Empresa *', key: 'nome', placeholder: 'Ex: Barbearia do João' },
                { label: 'CNPJ *', key: 'cnpj', placeholder: '00.000.000/0001-00' },
                { label: 'E-mail *', key: 'email', placeholder: 'contato@empresa.com' },
                { label: 'Telefone', key: 'telefone', placeholder: '(65) 99999-9999' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 5 }}>{f.label}</label>
                  <input
                    value={formTenant[f.key]}
                    onChange={e => setFormTenant(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '9px 12px', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>

            {/* Seleção de plano */}
            <div style={{ marginTop: 20 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 10 }}>PLANO *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {PLANOS.map(p => (
                  <button key={p.id} onClick={() => setFormTenant(prev => ({ ...prev, plano_id: p.id }))} style={{
                    padding: '12px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: `2px solid ${formTenant.plano_id === p.id ? p.cor : T.line}`,
                    background: formTenant.plano_id === p.id ? `${p.cor}22` : T.surface,
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: formTenant.plano_id === p.id ? p.cor : T.cream }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>R$ {p.preco}/mês</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Segmento */}
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 8 }}>SEGMENTO</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['varejo', 'barbearia', 'loja-moda', 'supermercado', 'oficina', 'agropecuaria', 'arena'].map(s => (
                  <button key={s} onClick={() => setFormTenant(p => ({ ...p, segmento: s }))} style={{
                    padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: formTenant.segmento === s ? T.green : T.surface,
                    color: formTenant.segmento === s ? '#fff' : T.muted,
                  }}>{s}</button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {planoSel && (
              <div style={{ marginTop: 20, background: T.surface, borderRadius: 10, padding: 16, border: `1px solid ${planoSel.cor}` }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: planoSel.cor, marginBottom: 8 }}>Resumo do Plano Selecionado</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: T.muted }}>Plano: </span><strong>{planoSel.nome}</strong></div>
                  <div><span style={{ color: T.muted }}>Valor: </span><strong style={{ color: T.green }}>R$ {planoSel.preco}/mês</strong></div>
                  <div><span style={{ color: T.muted }}>Usuários: </span><strong>{planoSel.limite_usuarios === 999 ? 'Ilimitado' : planoSel.limite_usuarios}</strong></div>
                  <div><span style={{ color: T.muted }}>Produtos: </span><strong>{planoSel.limite_produtos === 999999 ? 'Ilimitado' : planoSel.limite_produtos.toLocaleString()}</strong></div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalNovo(false)} style={{ padding: '10px 20px', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.muted, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={criarTenant} style={{ padding: '10px 24px', background: T.green, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                Criar Tenant & Enviar Acesso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
