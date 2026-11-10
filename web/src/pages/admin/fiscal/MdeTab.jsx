import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { money, dateTime } from '../dino/format'
import { Badge } from '../customer360/shared'

export default function MdeTab({ toast }) {
  const [notas, setNotas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [modalEvento, setModalEvento] = useState(null) // { nota, tipoEvento }
  const [justificativa, setJustificativa] = useState('')
  const [enviandoEvento, setEnviandoEvento] = useState(false)

  const carregarNotas = async () => {
    setCarregando(true)
    try {
      const res = await api.get('/api/admin/fiscal-avancado/mde/notas-destinadas')
      if (res?.sucesso) setNotas(res.notas || [])
    } catch (err) {
      if (toast) toast('Erro ao carregar notas destinadas: ' + err.message, 'danger')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarNotas()
  }, [])

  const abrirManifestacao = (nota, tipoEvento) => {
    setJustificativa('')
    setModalEvento({ nota, tipoEvento })
  }

  const confirmarManifestacao = async () => {
    if (!modalEvento) return
    setEnviandoEvento(true)
    try {
      const res = await api.post('/api/admin/fiscal-avancado/mde/manifestar', {
        chaveAcesso: modalEvento.nota.chaveAcesso,
        tipoEvento: modalEvento.tipoEvento,
        justificativa: justificativa.trim() || undefined,
      })

      if (res?.sucesso) {
        if (toast) toast(res.mensagem, 'success')
        setModalEvento(null)
        carregarNotas()
      }
    } catch (err) {
      if (toast) toast(err.message || 'Erro ao registrar evento na SEFAZ', 'danger')
    } finally {
      setEnviandoEvento(false)
    }
  }

  const darEntradaEstoque = async (nota) => {
    try {
      const res = await api.post('/api/admin/fiscal-avancado/mde/entrada-estoque', {
        estoqueAtualQtd: 15,
        custoAtualUnitario: 22.00,
        quantidadeEntrada: 30,
        custoEntradaUnitario: 26.50,
      })
      if (res?.sucesso) {
        if (toast) toast(`Entrada processada! Novo custo médio unitário: R$ ${res.dados.novoCustoMedioUnitario.toFixed(2)}`, 'success')
      }
    } catch (err) {
      if (toast) toast(err.message, 'danger')
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
            📥 Manifestação do Destinatário (MD-e) & Notas de Entrada
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>
            Consulte e manifeste notas fiscais emitidas por fornecedores contra o seu CNPJ.
          </p>
        </div>
        <button
          onClick={carregarNotas} disabled={carregando}
          style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
        >
          {carregando ? 'Sincronizando...' : '🔄 Sincronizar SEFAZ'}
        </button>
      </div>

      <div className="dadm-card" style={{ background: '#fff', borderRadius: 8, border: '1px solid #cbd5e1', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '10px 12px' }}>Emissão / Nota</th>
              <th style={{ padding: '10px 12px' }}>Fornecedor / Emitente</th>
              <th style={{ padding: '10px 12px' }}>Chave de Acesso</th>
              <th style={{ padding: '10px 12px' }}>Valor</th>
              <th style={{ padding: '10px 12px' }}>Manifestação</th>
              <th style={{ padding: '10px 12px' }}>Ações de Governança</th>
            </tr>
          </thead>
          <tbody>
            {notas.map((n) => (
              <tr key={n.chaveAcesso} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>NF-e {n.numero || '1234'} / {n.serie || '1'}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{dateTime(n.emitidaEm)}</div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600 }}>{n.emitente.razaoSocial}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>CNPJ: {n.emitente.cnpj} ({n.emitente.uf || 'MT'})</div>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10, color: '#334155' }}>
                  {n.chaveAcesso.slice(0, 10)}...{n.chaveAcesso.slice(-10)}
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#047857' }}>
                  {money(n.valorTotal)}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <Badge tone={n.statusEntrada === 'confirmada_apta_para_estoque' ? 'success' : 'info'}>
                    {n.statusManifestacao || 'Pendente'}
                  </Badge>
                  {n.ultimoEvento?.protocolo && (
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Prot: {n.ultimoEvento.protocolo}</div>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => abrirManifestacao(n, '210210')}
                      title="Ciência da Emissão (Libera download do XML completo)"
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                    >
                      👁️ Ciência
                    </button>
                    <button
                      onClick={() => abrirManifestacao(n, '210200')}
                      title="Confirmar Operação"
                      style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                    >
                      ✓ Confirmar
                    </button>
                    <button
                      onClick={() => abrirManifestacao(n, '210220')}
                      title="Desconhecer Operação"
                      style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                    >
                      ✕ Desconhecer
                    </button>
                    {n.statusEntrada === 'confirmada_apta_para_estoque' && (
                      <button
                        onClick={() => darEntradaEstoque(n)}
                        style={{ background: '#047857', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                      >
                        📦 Entrada Estoque
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Registro de Evento SEFAZ */}
      {modalEvento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 8, maxWidth: 480, width: '100%', padding: 20, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>
              Registrar Evento de Manifestação na SEFAZ
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              NF-e: <strong>{modalEvento.nota.chaveAcesso}</strong><br />
              Evento: <strong>Código {modalEvento.tipoEvento}</strong>
            </p>

            {modalEvento.tipoEvento === '210240' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Justificativa Obrigatória (Mínimo 15 caracteres):
                </label>
                <textarea
                  rows={3} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  placeholder="Exemplo: Mercadoria recebida com avaria grave e devolvida no ato da entrega..."
                  value={justificativa} onChange={e => setJustificativa(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button" onClick={() => setModalEvento(null)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="button" disabled={enviandoEvento} onClick={confirmarManifestacao}
                style={{ background: '#047857', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
              >
                {enviandoEvento ? 'Transmitindo à SEFAZ...' : '✓ Transmitir Evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
