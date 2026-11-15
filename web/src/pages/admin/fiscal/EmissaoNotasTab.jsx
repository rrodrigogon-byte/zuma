import { useEffect, useState, useMemo } from 'react'
import { api } from '../../../lib/api'
import { money, dateTime, formatCnpj } from '../dino/format'
import { Badge } from '../customer360/shared'

const PRODUTOS_PRESET_STALLONE = [
  { codigo: 'WHEY-PRO-900', nome: '100% Pure Whey Pro 900g Baunilha', preco: 189.90, ncm: '21069090', unidade: 'UN' },
  { codigo: 'CREAT-CREA-300', nome: 'Creatina Creapure 300g Micronizada', preco: 115.00, ncm: '21069090', unidade: 'UN' },
  { codigo: 'PRE-C4-300', nome: 'Pre-Workout C4 Ultimate Beta-Alanina 300g', preco: 145.00, ncm: '21069090', unidade: 'UN' },
  { codigo: 'ISO-HYDRO-900', nome: 'Iso Hydro Whey 900g Chocolate Belga', preco: 260.00, ncm: '21069090', unidade: 'UN' },
  { codigo: 'BCAA-211-240', nome: 'BCAA 2:1:1 240 Cápsulas Concentrado', preco: 95.00, ncm: '21069090', unidade: 'UN' },
  { codigo: 'PASTA-AMEND-1K', nome: 'Pasta de Amendoim Integral 1kg Crocante', preco: 38.00, ncm: '20081100', unidade: 'POT' },
]

export default function EmissaoNotasTab({ toast }) {
  const [notas, setNotas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [metricas, setMetricas] = useState(null)
  const [modalNovaNota, setModalNovaNota] = useState(false)
  const [modalDanfe, setModalDanfe] = useState(null)
  const [modalCancelar, setModalCancelar] = useState(null)
  const [justificativa, setJustificativa] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [statusSefaz, setStatusSefaz] = useState(null)

  // Formulário de Nova Emissão
  const [modelo, setModelo] = useState('65') // 65 = NFC-e, 55 = NF-e
  const [cpfCliente, setCpfCliente] = useState('')
  const [nomeCliente, setNomeCliente] = useState('')
  const [formaPgto, setFormaPgto] = useState('pix')
  const [itensCarrinho, setItensCarrinho] = useState([
    { ...PRODUTOS_PRESET_STALLONE[0], quantidade: 1 }
  ])

  const carregarNotas = async () => {
    setCarregando(true)
    try {
      const res = await api.get('/api/admin/fiscal-avancado/notas-emitidas')
      if (res?.sucesso) {
        setNotas(res.notas || [])
        setMetricas(res.metricas || null)
      }
    } catch (err) {
      toast(err.message || 'Erro ao carregar notas fiscais', 'error')
    } finally {
      setCarregando(false)
    }
  }

  const checarSefaz = async () => {
    try {
      const res = await api.get('/api/admin/fiscal-avancado/status-sefaz')
      setStatusSefaz(res)
    } catch {
      setStatusSefaz({ status: 'DESCONHECIDO', mensagem: 'Sem resposta da SEFAZ-MT' })
    }
  }

  useEffect(() => {
    carregarNotas()
    checarSefaz()
  }, [])

  const totalCarrinho = useMemo(() => {
    return itensCarrinho.reduce((acc, it) => acc + (Number(it.quantidade || 1) * Number(it.preco || 0)), 0)
  }, [itensCarrinho])

  const adicionarItem = (preset) => {
    setItensCarrinho(prev => {
      const idx = prev.findIndex(i => i.codigo === preset.codigo)
      if (idx >= 0) {
        const novo = [...prev]
        novo[idx] = { ...novo[idx], quantidade: novo[idx].quantidade + 1 }
        return novo
      }
      return [...prev, { ...preset, quantidade: 1 }]
    })
  }

  const alterarQtd = (idx, delta) => {
    setItensCarrinho(prev => {
      const novo = [...prev]
      const novaQtd = (novo[idx].quantidade || 1) + delta
      if (novaQtd <= 0) {
        return novo.filter((_, i) => i !== idx)
      }
      novo[idx] = { ...novo[idx], quantidade: novaQtd }
      return novo
    })
  }

  const emitirNota = async (contingencia = false) => {
    if (!itensCarrinho.length) {
      toast('Adicione ao menos um produto para emitir a nota fiscal.', 'error')
      return
    }

    setEnviando(true)
    try {
      const payload = {
        modelo,
        destinatario: cpfCliente.trim() ? {
          cpf: cpfCliente.trim(),
          nome: nomeCliente.trim() || (modelo === '55' ? 'Cliente E-commerce' : 'Consumidor Final')
        } : null,
        itens: itensCarrinho.map(it => ({
          codigo: it.codigo,
          nome: it.nome,
          descricao: it.nome,
          quantidade: it.quantidade,
          preco_unitario: it.preco,
          valorUnitario: it.preco,
          ncm: it.ncm || '21069090',
          unidade: it.unidade || 'UN'
        })),
        total: totalCarrinho,
        forma_pagamento: formaPgto,
        origem: modelo === '65' ? 'pdv_balcao' : 'ecommerce_faturamento'
      }

      const endpoint = contingencia
        ? '/api/admin/fiscal-avancado/contingencia'
        : '/api/admin/fiscal-avancado/emitir-nota'

      const res = await api.post(endpoint, payload)
      if (res?.sucesso) {
        toast(res.mensagem || 'Nota emitida com sucesso!', 'success')
        setModalNovaNota(false)
        setCpfCliente('')
        setNomeCliente('')
        setItensCarrinho([{ ...PRODUTOS_PRESET_STALLONE[0], quantidade: 1 }])
        carregarNotas()
        if (res.nota) {
          setModalDanfe(res.nota)
        }
      }
    } catch (err) {
      toast(err.message || 'Erro ao emitir nota fiscal', 'error')
    } finally {
      setEnviando(false)
    }
  }

  const confirmarCancelamento = async () => {
    if (!justificativa || justificativa.trim().length < 15) {
      toast('A justificativa deve ter no mínimo 15 caracteres conforme exigência da SEFAZ.', 'error')
      return
    }

    setEnviando(true)
    try {
      const res = await api.post('/api/admin/fiscal-avancado/cancelar-nota', {
        idOuChave: modalCancelar.id || modalCancelar.chaveAcesso,
        justificativa: justificativa.trim()
      })
      if (res?.sucesso) {
        toast(res.mensagem || 'Nota cancelada com sucesso junto à SEFAZ-MT!', 'success')
        setModalCancelar(null)
        setJustificativa('')
        carregarNotas()
      }
    } catch (err) {
      toast(err.message || 'Erro ao cancelar nota fiscal', 'error')
    } finally {
      setEnviando(false)
    }
  }

  const abrirDanfeNovaAba = (nota) => {
    window.open(`/api/admin/fiscal-avancado/danfe/${nota.id || nota.chaveAcesso}?print=1`, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner de Contexto Operacional Oficial */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid #334155',
        borderRadius: 14,
        padding: '20px 24px',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🧾</span>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>Emissão Fiscal Oficial — NFC-e (65) & NF-e (55)</h2>
            <span style={{
              background: '#059669',
              color: '#fff',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800
            }}>
              ● SEFAZ-MT ONLINE
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Emitente: <strong>STALLONE NUTRE SPORT LTDA</strong> · CNPJ: <strong>56.099.531/0001-38</strong> · IE: <strong>13.456.789-0</strong> · Tangará da Serra/MT · Simples Nacional (CRT 1)
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="c360-btn ghost"
            onClick={carregarNotas}
            disabled={carregando}
            style={{ color: '#fff', borderColor: '#475569' }}
          >
            🔄 Atualizar
          </button>
          <button
            type="button"
            className="c360-btn primary"
            onClick={() => setModalNovaNota(true)}
            style={{ background: '#2563eb', color: '#fff', fontWeight: 800, padding: '8px 18px' }}
          >
            ⚡ Nova Emissão de Nota
          </button>
        </div>
      </div>

      {/* Cards de Métricas Consolidadas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Total Faturado em Notas</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
            {money(metricas?.totalFaturado || 0)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Volume fiscal acumulado</div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Notas Autorizadas</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
            {metricas?.qtdAutorizadas || 0}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Autorizações SEFAZ-MT regulares</div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Em Contingência</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
            {metricas?.qtdContingencia || 0}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Offline (prazo 24h para envio)</div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Notas Canceladas</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#ef4444', marginTop: 4 }}>
            {metricas?.qtdCanceladas || 0}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Cancelamentos homologados</div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Ticket Médio Fiscal</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#a855f7', marginTop: 4 }}>
            {money(metricas?.ticketMedio || 0)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Média por documento emitido</div>
        </div>
      </div>

      {/* Tabela de Notas Fiscais Emitidas */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>Histórico de Documentos Fiscais Emitidos</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>NFC-e de balcão e NF-e de faturamento com DANFE, chave SEFAZ e download do XML oficial</p>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Total listado: <strong>{notas.length} notas</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '12px 16px' }}>Doc / Modelo</th>
                <th style={{ padding: '12px 16px' }}>Emissão</th>
                <th style={{ padding: '12px 16px' }}>Destinatário</th>
                <th style={{ padding: '12px 16px' }}>Valor Total</th>
                <th style={{ padding: '12px 16px' }}>Pagamento</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Chave de Acesso & Protocolo</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                    Carregando notas fiscais da Stallone Nutre Sport...
                  </td>
                </tr>
              ) : notas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                    Nenhuma nota fiscal emitida ainda. Clique em "Nova Emissão de Nota" acima.
                  </td>
                </tr>
              ) : (
                notas.map((n) => (
                  <tr key={n.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          background: n.modelo === '55' ? '#7c3aed' : '#2563eb',
                          color: '#fff',
                          fontSize: 10,
                          padding: '2px 5px',
                          borderRadius: 4,
                          fontWeight: 900
                        }}>
                          {n.modelo === '55' ? 'NF-e 55' : 'NFC-e 65'}
                        </span>
                        <span>Nº {n.numero}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Série {n.serie} · {n.origem}</div>
                    </td>

                    <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                      {dateTime(n.dataEmissao || n.criadoEm)}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#fff' }}>{n.destinatario?.nome || 'Consumidor Final'}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        {n.destinatario?.cpf ? `CPF: ${n.destinatario.cpf}` : 'Não Identificado'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', fontWeight: 900, color: '#10b981', fontSize: 13 }}>
                      {money(n.total)}
                    </td>

                    <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: 11, color: '#cbd5e1' }}>
                      {n.forma_pagamento || 'Dinheiro'}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {n.status === 'autorizada' ? (
                        <Badge variant="success">Autorizada SEFAZ</Badge>
                      ) : n.status === 'contingencia' ? (
                        <Badge variant="warning">Contingência Offline</Badge>
                      ) : (
                        <Badge variant="danger">Cancelada</Badge>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: 10, fontFamily: 'monospace' }}>
                      <div style={{ color: '#38bdf8', letterSpacing: 0.5 }}>
                        {n.chaveAcesso?.slice(0, 22)}...
                      </div>
                      <div style={{ color: '#64748b' }}>Prot: {n.protocolo}</div>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="c360-btn ghost small"
                          title="Visualizar e Imprimir DANFE"
                          onClick={() => setModalDanfe(n)}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                        >
                          🖨️ DANFE
                        </button>

                        <a
                          href={`/api/admin/fiscal-avancado/xml/${n.id || n.chaveAcesso}`}
                          download
                          className="c360-btn ghost small"
                          title="Download do XML Oficial"
                          style={{ padding: '4px 8px', fontSize: 11, textDecoration: 'none', color: '#38bdf8' }}
                        >
                          📥 XML
                        </a>

                        {n.status !== 'cancelada' && (
                          <button
                            type="button"
                            className="c360-btn ghost small"
                            title="Cancelar Nota Fiscal"
                            onClick={() => setModalCancelar(n)}
                            style={{ padding: '4px 8px', fontSize: 11, color: '#ef4444', borderColor: '#ef4444' }}
                          >
                            ❌
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NOVA EMISSÃO FISCAL */}
      {modalNovaNota && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', padding: 24, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: 14, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>⚡ Nova Emissão Fiscal — Stallone Nutre Sport</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Emita cupom fiscal NFC-e (65) ou nota fiscal eletrônica NF-e (55) com autorização SEFAZ-MT</p>
              </div>
              <button
                type="button"
                onClick={() => setModalNovaNota(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Seleção do Modelo Fiscal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setModelo('65')}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: `2px solid ${modelo === '65' ? '#2563eb' : '#334155'}`,
                  background: modelo === '65' ? 'rgba(37, 99, 235, 0.15)' : '#0f172a',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14, color: '#38bdf8' }}>NFC-e (Modelo 65)</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Cupom fiscal de consumidor para venda balcão e PDV</div>
              </button>

              <button
                type="button"
                onClick={() => setModelo('55')}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: `2px solid ${modelo === '55' ? '#7c3aed' : '#334155'}`,
                  background: modelo === '55' ? 'rgba(124, 58, 237, 0.15)' : '#0f172a',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14, color: '#c084fc' }}>NF-e (Modelo 55)</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Nota fiscal completa para e-commerce e faturamento</div>
              </button>
            </div>

            {/* Dados do Cliente */}
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#cbd5e1', marginBottom: 8 }}>Identificação do Destinatário (Opcional na NFC-e):</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>CPF / CNPJ</label>
                  <input
                    type="text"
                    className="c360-input"
                    placeholder="000.000.000-00"
                    value={cpfCliente}
                    onChange={(e) => setCpfCliente(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Nome do Cliente</label>
                  <input
                    type="text"
                    className="c360-input"
                    placeholder="Nome completo ou razão social"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Forma de Pagamento</label>
                  <select
                    className="c360-input"
                    value={formaPgto}
                    onChange={(e) => setFormaPgto(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="pix">PIX Instantâneo</option>
                    <option value="cartao_debito">Cartão de Débito TEF</option>
                    <option value="cartao_credito">Cartão de Crédito TEF</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="boleto">Boleto Bancário</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Presets Rápidos de Produtos Stallone */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#cbd5e1', marginBottom: 8 }}>Adicionar Produtos do Catálogo Stallone:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PRODUTOS_PRESET_STALLONE.map(p => (
                  <button
                    key={p.codigo}
                    type="button"
                    onClick={() => adicionarItem(p)}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: '6px 12px',
                      color: '#fff',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span>+ {p.nome}</span>
                    <strong style={{ color: '#10b981' }}>{money(p.preco)}</strong>
                  </button>
                ))}
              </div>
            </div>

            {/* Itens da Nota */}
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#cbd5e1', marginBottom: 8 }}>Itens a Emitir:</div>
              {itensCarrinho.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Nenhum item selecionado.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itensCarrinho.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{it.nome}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Cód: {it.codigo} · NCM: {it.ncm} · Unit: {money(it.preco)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" onClick={() => alterarQtd(idx, -1)} style={{ width: 24, height: 24, background: '#334155', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>-</button>
                          <span style={{ fontWeight: 800, fontSize: 12, minWidth: 20, textAlign: 'center' }}>{it.quantidade}</span>
                          <button type="button" onClick={() => alterarQtd(idx, 1)} style={{ width: 24, height: 24, background: '#334155', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>+</button>
                        </div>
                        <div style={{ fontWeight: 900, color: '#10b981', minWidth: 80, textAlign: 'right' }}>
                          {money(it.quantidade * it.preco)}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px dashed #334155' }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>VALOR TOTAL DA NOTA:</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>{money(totalCarrinho)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Ações de Emissão */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                className="c360-btn ghost"
                onClick={() => emitirNota(true)}
                disabled={enviando || !itensCarrinho.length}
                style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
              >
                ⚠️ Emitir em Contingência Offline
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="c360-btn ghost"
                  onClick={() => setModalNovaNota(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="c360-btn primary"
                  onClick={() => emitirNota(false)}
                  disabled={enviando || !itensCarrinho.length}
                  style={{ background: '#10b981', color: '#fff', fontWeight: 900, padding: '10px 24px' }}
                >
                  {enviando ? 'Transmitindo SEFAZ...' : '🚀 Transmitir & Autorizar na SEFAZ-MT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ESPELHO DANFE IMPRIMÍVEL */}
      {modalDanfe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#fff', color: '#111', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>Visualização DANFE NFC-e SEFAZ</h4>
              <button
                type="button"
                onClick={() => setModalDanfe(null)}
                style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Espelho Térmico 80mm */}
            <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.3, border: '1px dashed #999', padding: 14, borderRadius: 8, background: '#fafafa' }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>STALLONE NUTRE SPORT LTDA</div>
              <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>
                CNPJ 56.099.531/0001-38 · IE 13.456.789-0<br/>
                Av. Brasil, 1420 - Centro · Tangará da Serra/MT<br/>
                DANFE NFC-e — NOTA FISCAL CONSUMIDOR ELETRÔNICA
              </div>
              <div style={{ borderBottom: '1px dashed #999', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>NFC-e Nº {modalDanfe.numero} · Série {modalDanfe.serie}</span>
                <span>{dateTime(modalDanfe.dataEmissao || modalDanfe.criadoEm)}</span>
              </div>
              <div style={{ fontSize: 10, marginTop: 2 }}>
                Destinatário: {modalDanfe.destinatario?.cpf ? `CPF: ${modalDanfe.destinatario.cpf}` : 'Consumidor Não Identificado'}
              </div>

              <div style={{ borderBottom: '1px dashed #999', margin: '8px 0' }} />
              <div style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 4 }}>ITENS VENDIDOS:</div>
              {(modalDanfe.itens || []).map((it, idx) => (
                <div key={idx} style={{ marginBottom: 4 }}>
                  <div style={{ fontWeight: 600 }}>{idx + 1}. {it.nome || it.descricao}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
                    <span>{it.quantidade} UN × {money(it.preco_unitario || it.preco)}</span>
                    <strong style={{ color: '#000' }}>{money(it.quantidade * (it.preco_unitario || it.preco))}</strong>
                  </div>
                </div>
              ))}

              <div style={{ borderBottom: '1px dashed #999', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 'bold' }}>
                <span>TOTAL R$:</span>
                <span>{money(modalDanfe.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                <span>Forma de Pagamento:</span>
                <span style={{ textTransform: 'uppercase' }}>{modalDanfe.forma_pagamento || 'PIX'}</span>
              </div>

              <div style={{ borderBottom: '1px dashed #999', margin: '8px 0' }} />
              <div style={{ textAlign: 'center', fontSize: 9 }}>
                Protocolo de Autorização: <strong>{modalDanfe.protocolo}</strong><br/>
                Chave de Acesso:<br/>
                <span style={{ letterSpacing: 0.5, wordBreak: 'break-all' }}>{modalDanfe.chaveAcesso}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(modalDanfe.qrCodeUrl || '')}`}
                  alt="QR Code SEFAZ"
                  style={{ width: 110, height: 110 }}
                />
              </div>

              <div style={{ textAlign: 'center', fontSize: 9, color: '#666' }}>
                Consulte pela Chave de Acesso em:<br/>
                www.sefaz.mt.gov.br/nfce/consultanfce
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="c360-btn primary"
                onClick={() => abrirDanfeNovaAba(modalDanfe)}
                style={{ flex: 1, background: '#0f172a', color: '#fff', fontWeight: 900 }}
              >
                🖨️ Abrir Impressão Térmica (80mm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAMENTO SEFAZ */}
      {modalCancelar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24, color: '#fff' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#ef4444' }}>
              ⚠️ Cancelamento de Documento Fiscal (SEFAZ-MT)
            </h3>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#cbd5e1' }}>
              Cancelamento da {modalCancelar.modelo === '55' ? 'NF-e' : 'NFC-e'} nº <strong>{modalCancelar.numero}</strong> (Série {modalCancelar.serie}).
            </p>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                Justificativa Obrigatória (Mínimo de 15 caracteres):
              </label>
              <textarea
                className="c360-input"
                rows={3}
                placeholder="Exemplo: Cancelamento solicitado pelo consumidor devido a troca de mercadoria."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 10, color: justificativa.length >= 15 ? '#10b981' : '#f59e0b', marginTop: 4 }}>
                {justificativa.length}/15 caracteres mínimos exigidos pela SEFAZ.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="c360-btn ghost"
                onClick={() => setModalCancelar(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="c360-btn primary"
                disabled={enviando || justificativa.trim().length < 15}
                onClick={confirmarCancelamento}
                style={{ background: '#ef4444', color: '#fff', fontWeight: 900 }}
              >
                {enviando ? 'Cancelando...' : 'Confirmar Cancelamento SEFAZ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
