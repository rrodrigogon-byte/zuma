import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { money, dateTime } from '../dino/format'
import { Badge } from '../customer360/shared'

export default function BoletosTab({ toast }) {
  const [boletos, setBoletos] = useState([])
  const [bancos, setBancos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [modalNovo, setModalNovo] = useState(false)
  const [emitindo, setEmitindo] = useState(false)

  const [form, setForm] = useState({
    banco: '748',
    valor: 250.00,
    vencimento: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    pagadorNome: 'Rodrigo Ribeiro Gonçalves',
    pagadorDocumento: '123.456.789-00',
    pagadorEndereco: 'Rua José Corsino, Centro, Tangará da Serra - MT',
    cooperativa: '0812',
    codigoBeneficiario: '50073',
    beneficiarioNome: 'DINO BARBEARIA LTDA',
    beneficiarioCnpj: '50.073.355/0002-60',
  })

  const carregarDados = async () => {
    setCarregando(true)
    try {
      const [resBancos, resBoletos] = await Promise.all([
        api.get('/api/admin/boletos/bancos'),
        api.get('/api/admin/boletos'),
      ])
      if (resBancos?.sucesso) setBancos(resBancos.bancos || [])
      if (resBoletos?.sucesso) setBoletos(resBoletos.boletos || [])
    } catch (err) {
      if (toast) toast('Erro ao carregar boletos: ' + err.message, 'danger')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const emitirBoleto = async (e) => {
    e.preventDefault()
    setEmitindo(true)
    try {
      const res = await api.post('/api/admin/boletos/emitir', form)
      if (res?.sucesso) {
        if (toast) toast('Boleto bancário híbrido emitido com sucesso!', 'success')
        setModalNovo(false)
        carregarDados()
      }
    } catch (err) {
      if (toast) toast(err.message || 'Erro ao emitir boleto', 'danger')
    } finally {
      setEmitindo(false)
    }
  }

  const copiarTexto = (texto, rotulo) => {
    navigator.clipboard.writeText(texto)
    if (toast) toast(`${rotulo} copiado para a área de transferência!`, 'success')
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
            🏦 Boletos Bancários Registrados & Pix Cobrança Híbrido
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>
            Emissão oficial para Sicredi, Sicoob, Itaú, Banco do Brasil e Bradesco com QR Code Pix integrado.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setModalNovo(true)}
            style={{ background: '#047857', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
          >
            + Emitir Novo Boleto Híbrido
          </button>
        </div>
      </div>

      <div className="dadm-card" style={{ background: '#fff', borderRadius: 8, border: '1px solid #cbd5e1', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '10px 12px' }}>Banco / Nosso Número</th>
              <th style={{ padding: '10px 12px' }}>Pagador</th>
              <th style={{ padding: '10px 12px' }}>Vencimento</th>
              <th style={{ padding: '10px 12px' }}>Valor</th>
              <th style={{ padding: '10px 12px' }}>Linha Digitável FEBRABAN</th>
              <th style={{ padding: '10px 12px' }}>Ações / Comprovante</th>
            </tr>
          </thead>
          <tbody>
            {boletos.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{b.bancoApelido} ({b.banco})</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Nosso Nº: {b.nossoNumero}</div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600 }}>{b.pagador.nome}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Doc: {b.pagador.documento}</div>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#b91c1c' }}>
                  {b.vencimento.split('-').reverse().join('/')}
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#047857' }}>
                  {b.valorFormatado}
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                  {b.linhaDigitavel}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <a
                      href={`/api/admin/boletos/${b.id}/html`} target="_blank" rel="noopener noreferrer"
                      style={{ background: '#0284c7', color: '#fff', padding: '4px 8px', borderRadius: 4, textDecoration: 'none', fontSize: 11, fontWeight: 700 }}
                    >
                      🖨️ Ver / Imprimir
                    </a>
                    <button
                      onClick={() => copiarTexto(b.linhaDigitavel, 'Código de barras')}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                    >
                      Linha
                    </button>
                    <button
                      onClick={() => copiarTexto(b.pixCopiaECola, 'Pix Copia e Cola')}
                      style={{ background: '#ecfdf5', border: '1px solid #86efac', color: '#065f46', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                    >
                      PIX
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Emissão de Boleto */}
      {modalNovo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 8, maxWidth: 540, width: '100%', padding: 20, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>
              Emitir Boleto Bancário Registrado com Pix Híbrido
            </h3>

            <form onSubmit={emitirBoleto}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Banco Emissor</label>
                  <select
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}
                  >
                    <option value="748">Sicredi (748)</option>
                    <option value="756">Sicoob (756)</option>
                    <option value="341">Itaú Unibanco (341)</option>
                    <option value="001">Banco do Brasil (001)</option>
                    <option value="237">Bradesco (237)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Valor do Documento (R$)</label>
                  <input
                    type="number" step="0.01" required
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    value={form.valor} onChange={e => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Data de Vencimento</label>
                  <input
                    type="date" required
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>CPF ou CNPJ do Pagador</label>
                  <input
                    type="text" required
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    value={form.pagadorDocumento} onChange={e => setForm({ ...form, pagadorDocumento: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Nome Completo do Pagador / Cliente</label>
                <input
                  type="text" required
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  value={form.pagadorNome} onChange={e => setForm({ ...form, pagadorNome: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Endereço do Pagador</label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  value={form.pagadorEndereco} onChange={e => setForm({ ...form, pagadorEndereco: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button" onClick={() => setModalNovo(false)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={emitindo}
                  style={{ background: '#047857', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                >
                  {emitindo ? 'Emitindo Boleto...' : '✓ Emitir Boleto com Pix'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
