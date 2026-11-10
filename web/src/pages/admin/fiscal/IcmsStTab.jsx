import { useState } from 'react'
import { api } from '../../../lib/api'
import { money } from '../dino/format'

export default function IcmsStTab({ toast }) {
  const [form, setForm] = useState({
    valorOperacao: 150.00,
    frete: 10.00,
    seguro: 0.00,
    outrasDespesas: 0.00,
    desconto: 0.00,
    ipi: 0.00,
    mva: 40.0,
    operacaoInterestadual: false,
    aliquotaInterestadual: 7.0,
    aliquotaInternaSt: 17.0,
    incideFcp: true,
    aliquotaFcp: 2.0,
    crt: '1',
    ncm: '33051000',
    cest: '2001900',
  })

  const [calculando, setCalculando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const calcular = async (e) => {
    if (e) e.preventDefault()
    setCalculando(true)
    try {
      const res = await api.post('/api/admin/fiscal-avancado/icms-st/calcular', form)
      if (res?.sucesso) {
        setResultado(res.resultado)
        if (toast) toast('Cálculo de ICMS-ST atualizado com sucesso!', 'success')
      }
    } catch (err) {
      if (toast) toast(err.message || 'Falha ao calcular ICMS-ST', 'danger')
    } finally {
      setCalculando(false)
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Formulário de Parâmetros */}
        <div className="dadm-card" style={{ background: '#fff', borderRadius: 8, padding: 18, border: '1px solid #cbd5e1' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
            ⚙️ Simulador Tributário de ICMS-ST (Mato Grosso)
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
            Apuração automática conforme Convênio ICMS 142/2018 e RICMS-MT.
          </p>

          <form onSubmit={calcular}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Valor da Mercadoria (R$)</label>
                <input
                  type="number" step="0.01" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  value={form.valorOperacao} onChange={e => setForm({ ...form, valorOperacao: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Frete / Seguro / Despesas (R$)</label>
                <input
                  type="number" step="0.01" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  value={form.frete} onChange={e => setForm({ ...form, frete: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>MVA Original (%)</label>
                <input
                  type="number" step="0.01" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  value={form.mva} onChange={e => setForm({ ...form, mva: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Alíquota Interna MT (%)</label>
                <select
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  value={form.aliquotaInternaSt} onChange={e => setForm({ ...form, aliquotaInternaSt: parseFloat(e.target.value) || 17 })}
                >
                  <option value={17}>17,00% (Padrão MT)</option>
                  <option value={20}>20,00% (Majorada - Bebidas/Supérfluos)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>NCM (8 dígitos)</label>
                <input
                  type="text" maxLength={8} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>CEST (7 dígitos)</label>
                <input
                  type="text" maxLength={7} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  value={form.cest} onChange={e => setForm({ ...form, cest: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={form.operacaoInterestadual}
                  onChange={e => setForm({ ...form, operacaoInterestadual: e.target.checked })}
                />
                <strong>Compra Interestadual</strong> (aplica MVA Ajustada conf. alíquota origem)
              </label>

              {form.operacaoInterestadual && (
                <div style={{ paddingLeft: 20 }}>
                  <label style={{ fontSize: 11, color: '#475569' }}>Alíquota Interestadual de Origem</label>
                  <select
                    style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                    value={form.aliquotaInterestadual} onChange={e => setForm({ ...form, aliquotaInterestadual: parseFloat(e.target.value) || 7 })}
                  >
                    <option value={7}>7,00% (Sul / Sudeste exceto ES)</option>
                    <option value={12}>12,00% (Norte / Nordeste / Centro-Oeste / ES)</option>
                    <option value={4}>4,00% (Importados CAMEX &gt; 40%)</option>
                  </select>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={form.incideFcp}
                  onChange={e => setForm({ ...form, incideFcp: e.target.checked })}
                />
                Incide FCP-MT (+2,00% Fundo de Combate à Pobreza)
              </label>
            </div>

            <button
              type="submit" disabled={calculando}
              style={{ width: '100%', background: '#047857', color: '#fff', border: 'none', padding: '10px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
            >
              {calculando ? 'Calculando...' : '📊 Calcular ICMS-ST'}
            </button>
          </form>
        </div>

        {/* Painel de Resultados & Memorial de Cálculo */}
        <div className="dadm-card" style={{ background: '#f8fafc', borderRadius: 8, padding: 18, border: '1px solid #cbd5e1' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
            📋 Memorial de Apuração Fiscal (Mato Grosso)
          </h2>

          {resultado ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Base de Cálculo ST</span>
                  <strong style={{ fontSize: 18, color: '#0f172a' }}>{money(resultado.icmsSt.baseCalculoSt)}</strong>
                  <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>MVA Aplicada: {resultado.icmsSt.mvaAplicada}%</div>
                </div>

                <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 6, border: '1px solid #a7f3d0' }}>
                  <span style={{ fontSize: 10, color: '#065f46', textTransform: 'uppercase', display: 'block' }}>ICMS-ST Líquido a Recolher</span>
                  <strong style={{ fontSize: 18, color: '#047857' }}>{money(resultado.icmsSt.valorIcmsStLiquido)}</strong>
                  <div style={{ fontSize: 11, color: '#065f46', marginTop: 2 }}>CFOP: {resultado.cfop} · CSOSN: {resultado.cstOuCsosn}</div>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', padding: 12, fontSize: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <span>Valor dos Produtos:</span>
                  <strong>{money(resultado.valoresBase.valorOperacao)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <span>Frete / Despesas:</span>
                  <strong>{money(resultado.valoresBase.frete)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <span>Débito Bruto ST ({resultado.icmsSt.aliquotaInternaSt}% + {resultado.icmsSt.aliquotaFcp}% FCP):</span>
                  <strong>{money(resultado.icmsSt.valorDebitoStTotal)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0', color: '#b91c1c' }}>
                  <span>(-) Crédito / ICMS Próprio Deduzido:</span>
                  <strong>{money(resultado.icmsSt.deducaoProprio)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  <span>Total Final do Item Faturado:</span>
                  <span style={{ color: '#047857' }}>{money(resultado.totalItemComSt)}</span>
                </div>
              </div>

              <div style={{ padding: 10, background: '#f1f5f9', borderRadius: 6, fontSize: 11, color: '#475569', lineHeight: 1.4 }}>
                <strong>Observação Fiscal:</strong> {resultado.observacaoFiscal}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧮</div>
              <div>Preencha os valores e clique em <strong>Calcular ICMS-ST</strong> para obter a apuração tributária de Mato Grosso.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
