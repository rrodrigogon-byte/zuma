import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'

const fmtR = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
const fmtData = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

const lerBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',').pop())
  reader.onerror = reject
  reader.readAsDataURL(file)
})

export default function ConciliacaoBancariaTab({ onAtualizarFinanceiro }) {
  const { toast } = useToast()
  const [contas, setContas] = useState([])
  const [contaSelecionada, setContaSelecionada] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('pendente') // 'pendente' | 'conciliado' | 'ignorado'
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [arquivoOfx, setArquivoOfx] = useState(null)
  const [enviandoImportacao, setEnviandoImportacao] = useState(false)
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [modalLancar, setModalLancar] = useState(null) // { linha, descricao, categoria }
  const [formNovaConta, setFormNovaConta] = useState({ nome: '', banco: 'Sicredi', agencia: '', conta: '' })
  const fileInputRef = useRef(null)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      const listaContas = await api.get('/api/admin/razao/conciliacao/contas').catch(() => [])
      setContas(Array.isArray(listaContas) ? listaContas : [])

      const qs = new URLSearchParams({ status: statusFiltro })
      if (contaSelecionada) qs.set('contaId', contaSelecionada)

      const listaLinhas = await api.get(`/api/admin/razao/conciliacao/linhas?${qs}`).catch(() => [])
      setLinhas(Array.isArray(listaLinhas) ? listaLinhas : [])
    } catch (err) {
      toast(err.message || 'Erro ao carregar conciliação bancária', true)
    } finally {
      setCarregando(false)
    }
  }, [contaSelecionada, statusFiltro, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Importar Extrato OFX
  async function handleImportarOfx(e) {
    e.preventDefault()
    if (!arquivoOfx) {
      toast('Selecione um arquivo de extrato bancário .OFX', true)
      return
    }
    setEnviandoImportacao(true)
    try {
      const base64 = await lerBase64(arquivoOfx)
      const res = await api.post('/api/admin/razao/conciliacao/importar', {
        arquivoBase64: base64,
        nomeArquivo: arquivoOfx.name,
        contaId: contaSelecionada || null
      })
      toast(`Extrato importado com sucesso! ${res.novas || 0} novas linhas registradas.`)
      setArquivoOfx(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      carregarDados()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Falha ao importar arquivo OFX', true)
    } finally {
      setEnviandoImportacao(false)
    }
  }

  // Conciliar Automaticamente com IA / Razão
  async function handleConciliarAutomatico() {
    setCarregando(true)
    try {
      const res = await api.post('/api/admin/razao/conciliacao/automatico', {
        contaId: contaSelecionada || null
      })
      toast(`Conciliação concluída: ${res.conciliadas || 0} lançamentos vinculados automaticamente!`)
      carregarDados()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Erro ao executar conciliação automática', true)
    } finally {
      setCarregando(false)
    }
  }

  // Conciliar Linha Manualmente com Lançamento Sugerido
  async function handleConciliarLinha(linhaId, lancamentoId) {
    try {
      const res = await api.post(`/api/admin/razao/conciliacao/linhas/${linhaId}/conciliar`, {
        lancamentoId
      })
      toast(res.baixado ? 'Linha conciliada e conta baixada com sucesso!' : 'Linha conciliada com sucesso!')
      carregarDados()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Erro ao conciliar linha', true)
    }
  }

  // Lançar Linha no Financeiro e Conciliar
  async function handleConfirmarLancamento(e) {
    e.preventDefault()
    if (!modalLancar) return
    try {
      await api.post(`/api/admin/razao/conciliacao/linhas/${modalLancar.linha.id}/criar-lancamento`, {
        descricao: modalLancar.descricao,
        categoria: modalLancar.categoria
      })
      toast('Lançamento financeiro criado e conciliado!')
      setModalLancar(null)
      carregarDados()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Erro ao criar lançamento da linha', true)
    }
  }

  // Ignorar Linha
  async function handleIgnorarLinha(linhaId) {
    try {
      await api.post(`/api/admin/razao/conciliacao/linhas/${linhaId}/ignorar`, {})
      toast('Linha ignorada da conciliação.')
      carregarDados()
    } catch (err) {
      toast(err.message || 'Erro ao ignorar linha', true)
    }
  }

  // Desfazer Conciliação
  async function handleDesfazer(linhaId) {
    try {
      await api.post(`/api/admin/razao/conciliacao/linhas/${linhaId}/desfazer`, {})
      toast('Conciliação desfeita! A linha voltou para o status pendente.')
      carregarDados()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Erro ao desfazer conciliação', true)
    }
  }

  // Salvar Nova Conta Bancária
  async function handleSalvarConta(e) {
    e.preventDefault()
    try {
      await api.post('/api/admin/razao/conciliacao/contas', formNovaConta)
      toast('Conta bancária cadastrada com sucesso!')
      setModalNovaConta(false)
      setFormNovaConta({ nome: '', banco: 'Sicredi', agencia: '', conta: '' })
      carregarDados()
    } catch (err) {
      toast(err.message || 'Erro ao cadastrar conta bancária', true)
    }
  }

  const pendentesCount = linhas.filter(l => l.status === 'pendente').length
  const totalLinhasValor = linhas.reduce((acc, l) => acc + Number(l.valor || 0), 0)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Top Banner de Resumo de Contas */}
      <div style={{
        background: 'var(--surface, #1e1d1a)',
        border: '1px solid var(--line, rgba(255,255,255,.08))',
        borderRadius: 14,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--green, #22c55e)' }}>
            🏦 Conciliação Bancária OFX & PIX
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0', color: 'var(--cream, #f8f6f0)' }}>
            Extrato Inteligente vs Razão Financeiro
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted, #94a3b8)' }}>
            Importe o extrato OFX do Sicredi, Sicoob, Itaú, Bradesco, Santander ou Nubank. O Kytto vincula as linhas, confere valores e dá baixa automática nas contas.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setModalNovaConta(true)}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              background: 'rgba(255,255,255,.06)',
              border: '1px solid var(--line, rgba(255,255,255,.12))',
              color: 'var(--cream, #f8f6f0)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            + Cadastrar Conta
          </button>
          <button
            type="button"
            onClick={handleConciliarAutomatico}
            disabled={carregando}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              background: 'var(--green, #22c55e)',
              border: 'none',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(34,197,94,.25)'
            }}
          >
            ⚡ Conciliar com IA / Razão
          </button>
        </div>
      </div>

      {/* Cards de Contas Cadastradas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {contas.length === 0 ? (
          <div style={{
            background: 'var(--surface, #1e1d1a)',
            border: '1px dashed var(--line, rgba(255,255,255,.15))',
            borderRadius: 12,
            padding: '18px 20px',
            color: 'var(--muted, #94a3b8)',
            fontSize: 13,
            gridColumn: '1 / -1'
          }}>
            Nenhuma conta cadastrada ainda. Ao importar o primeiro extrato OFX, o banco e a conta são identificados e provisionados automaticamente.
          </div>
        ) : (
          contas.map(c => (
            <div
              key={c.id}
              onClick={() => setContaSelecionada(c.id === contaSelecionada ? '' : c.id)}
              style={{
                background: 'var(--surface, #1e1d1a)',
                border: c.id === contaSelecionada ? '2px solid var(--green, #22c55e)' : '1px solid var(--line, rgba(255,255,255,.08))',
                borderRadius: 12,
                padding: '16px 18px',
                cursor: 'pointer',
                transition: 'all .15s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--cream, #f8f6f0)' }}>{c.nome}</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: c.pendentes ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: c.pendentes ? '#ef4444' : 'var(--green, #22c55e)'
                }}>
                  {c.pendentes ? `${c.pendentes} pendente(s)` : 'Em dia'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginBottom: 8 }}>
                {[c.banco && `Banco ${c.banco}`, c.agencia && `Ag. ${c.agencia}`, c.conta && `Cc. ${c.conta}`].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: c.saldoBanco >= 0 ? 'var(--green, #22c55e)' : '#ef4444' }}>
                {c.saldoBanco != null ? fmtR(c.saldoBanco) : 'Saldo a conciliar'}
              </div>
              {c.extratoAte && (
                <div style={{ fontSize: 10, color: 'var(--muted, #94a3b8)', marginTop: 4 }}>
                  Extrato até {fmtData(c.extratoAte)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Barra de Ações: Importador de OFX + Filtros de Visualização */}
      <div style={{
        background: 'var(--surface, #1e1d1a)',
        border: '1px solid var(--line, rgba(255,255,255,.08))',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <form onSubmit={handleImportarOfx} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream, #f8f6f0)' }}>
            Importar Extrato (.OFX):
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.OFX"
            onChange={e => setArquivoOfx(e.target.files?.[0] || null)}
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(0,0,0,.2)',
              border: '1px solid var(--line, rgba(255,255,255,.1))',
              color: 'var(--cream, #f8f6f0)'
            }}
          />
          <button
            type="submit"
            disabled={!arquivoOfx || enviandoImportacao}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: arquivoOfx ? 'var(--green, #22c55e)' : 'rgba(255,255,255,.08)',
              color: arquivoOfx ? '#fff' : 'var(--muted, #94a3b8)',
              border: 'none',
              fontWeight: 700,
              fontSize: 12,
              cursor: arquivoOfx ? 'pointer' : 'not-allowed'
            }}
          >
            {enviandoImportacao ? '⏳ Processando...' : '📥 Processar OFX'}
          </button>
        </form>

        {/* Filtros de Status */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', fontWeight: 600 }}>Visualizar:</span>
          {[
            { id: 'pendente', label: '⏳ Para Conciliar' },
            { id: 'conciliado', label: '✓ Conciliadas' },
            { id: 'ignorado', label: '✕ Ignoradas' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFiltro(f.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: statusFiltro === f.id ? '1px solid var(--green, #22c55e)' : '1px solid var(--line, rgba(255,255,255,.08))',
                background: statusFiltro === f.id ? 'rgba(34,197,94,.12)' : 'transparent',
                color: statusFiltro === f.id ? 'var(--green, #22c55e)' : 'var(--muted, #94a3b8)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Linhas do Extrato Bancário */}
      <div style={{
        background: 'var(--surface, #1e1d1a)',
        border: '1px solid var(--line, rgba(255,255,255,.08))',
        borderRadius: 14,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--line, rgba(255,255,255,.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontWeight: 800, color: 'var(--cream, #f8f6f0)', fontSize: 14 }}>
            📋 Linhas do Extrato ({linhas.length})
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
            Total no filtro: <strong style={{ color: totalLinhasValor >= 0 ? 'var(--green, #22c55e)' : '#ef4444' }}>{fmtR(totalLinhasValor)}</strong>
          </div>
        </div>

        {linhas.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted, #94a3b8)', fontSize: 13 }}>
            {statusFiltro === 'pendente' ? '🎉 Parabéns! Nenhuma linha pendente de conciliação para esta conta.' : 'Nenhuma linha encontrada para o filtro selecionado.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,.15)', borderBottom: '1px solid var(--line, rgba(255,255,255,.08))' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--muted, #94a3b8)', fontSize: 11, fontWeight: 700 }}>DATA</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--muted, #94a3b8)', fontSize: 11, fontWeight: 700 }}>DESCRIÇÃO NO BANCO</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--muted, #94a3b8)', fontSize: 11, fontWeight: 700 }}>VALOR</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--muted, #94a3b8)', fontSize: 11, fontWeight: 700 }}>SUGESTÃO DE CONTRAPARTIDA (RAZÃO)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted, #94a3b8)', fontSize: 11, fontWeight: 700 }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--line, rgba(255,255,255,.05))' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--cream, #f8f6f0)', whiteSpace: 'nowrap' }}>
                    {fmtData(l.data)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--cream, #f8f6f0)', fontWeight: 600 }}>
                    <div>{l.descricao || '—'}</div>
                    {l.documento && <span style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Doc: {l.documento}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: l.valor < 0 ? '#ef4444' : 'var(--green, #22c55e)' }}>
                    {fmtR(l.valor)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--cream, #f8f6f0)' }}>
                    {l.status === 'conciliado' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(34,197,94,.12)',
                        color: 'var(--green, #22c55e)',
                        fontWeight: 700,
                        fontSize: 11
                      }}>
                        ✓ Conciliado ({l.regra === 'automatica' ? 'Auto IA' : 'Manual'})
                      </span>
                    ) : l.status === 'ignorado' ? (
                      <span style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Ignorado do cálculo</span>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {(l.sugestoes || []).length > 0 ? (
                          l.sugestoes.map(s => (
                            <div key={s.lancamento.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'rgba(0,0,0,.2)', padding: '6px 10px', borderRadius: 6 }}>
                              <span style={{ fontSize: 12 }}>
                                {s.lancamento.descricao} · {s.lancamento.status === 'pendente' ? `Vence ${fmtData(s.lancamento.vencimento)}` : `Pago em ${fmtData(s.lancamento.pagoEm)}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleConciliarLinha(l.id, s.lancamento.id)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 5,
                                  background: 'var(--green, #22c55e)',
                                  border: 'none',
                                  color: '#fff',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {s.lancamento.status === 'pendente' ? 'Conciliar e Baixar' : 'Conciliar'}
                              </button>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                            Nenhum lançamento pendente encontrado com este valor exato.
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {l.status === 'conciliado' ? (
                      <button
                        type="button"
                        onClick={() => handleDesfazer(l.id)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          background: 'rgba(239,68,68,.1)',
                          border: '1px solid rgba(239,68,68,.25)',
                          color: '#ef4444',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Desfazer
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setModalLancar({
                            linha: l,
                            descricao: l.descricao || '',
                            categoria: l.valor < 0 ? 'Taxas de Cartão / Bancárias' : 'Outros'
                          })}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,.06)',
                            border: '1px solid var(--line, rgba(255,255,255,.12))',
                            color: 'var(--cream, #f8f6f0)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          + Criar Lançamento
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIgnorarLinha(l.id)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            background: 'transparent',
                            border: '1px solid var(--line, rgba(255,255,255,.08))',
                            color: 'var(--muted, #94a3b8)',
                            fontSize: 11,
                            cursor: 'pointer'
                          }}
                        >
                          Ignorar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Criar Lançamento da Linha */}
      {modalLancar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#1c1b18', border: '1px solid var(--line, rgba(255,255,255,.1))', borderRadius: 14, width: '100%', maxWidth: 460, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line, rgba(255,255,255,.1))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, color: 'var(--cream, #f8f6f0)', fontSize: 15 }}>
                Lançar Linha no Razão Financeiro
              </div>
              <button onClick={() => setModalLancar(null)} style={{ background: 'none', border: 'none', color: 'var(--muted, #94a3b8)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <form onSubmit={handleConfirmarLancamento} style={{ padding: 20 }}>
              <div style={{ background: 'rgba(0,0,0,.2)', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                Data: <strong>{fmtData(modalLancar.linha.data)}</strong> · Valor: <strong style={{ color: modalLancar.linha.valor < 0 ? '#ef4444' : 'var(--green, #22c55e)' }}>{fmtR(modalLancar.linha.valor)}</strong>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted, #94a3b8)', marginBottom: 6 }}>Descrição</label>
                <input
                  type="text"
                  required
                  value={modalLancar.descricao}
                  onChange={e => setModalLancar({ ...modalLancar, descricao: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#141412', border: '1px solid var(--line, rgba(255,255,255,.1))', color: '#fff', fontSize: 13 }}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted, #94a3b8)', marginBottom: 6 }}>Categoria Contábil</label>
                <select
                  value={modalLancar.categoria}
                  onChange={e => setModalLancar({ ...modalLancar, categoria: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#141412', border: '1px solid var(--line, rgba(255,255,255,.1))', color: '#fff', fontSize: 13 }}
                >
                  <option value="Taxas de Cartão / Bancárias">Taxas de Cartão / Bancárias</option>
                  <option value="Serviços & Cortes">Serviços & Cortes</option>
                  <option value="Venda de Revenda / Bar">Venda de Revenda / Bar</option>
                  <option value="Mensalidades / Planos">Mensalidades / Planos</option>
                  <option value="Pessoal/RH & Comissões">Pessoal/RH & Comissões</option>
                  <option value="Aluguel & Ocupação">Aluguel & Ocupação</option>
                  <option value="Produtos & Insumos">Produtos & Insumos</option>
                  <option value="Utilities (Água/Luz)">Utilities (Água/Luz)</option>
                  <option value="Internet & Telefonia">Internet & Telefonia</option>
                  <option value="Marketing & Tráfego">Marketing & Tráfego</option>
                  <option value="Impostos/Taxas">Impostos/Taxas</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalLancar(null)} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--line, rgba(255,255,255,.1))', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--green, #22c55e)', border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>Salvar e Conciliar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Conta Bancária */}
      {modalNovaConta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#1c1b18', border: '1px solid var(--line, rgba(255,255,255,.1))', borderRadius: 14, width: '100%', maxWidth: 440, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line, rgba(255,255,255,.1))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, color: 'var(--cream, #f8f6f0)', fontSize: 15 }}>
                + Nova Conta Bancária
              </div>
              <button onClick={() => setModalNovaConta(false)} style={{ background: 'none', border: 'none', color: 'var(--muted, #94a3b8)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <form onSubmit={handleSalvarConta} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted, #94a3b8)', marginBottom: 6 }}>Nome Identificador da Conta *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sicredi Principal / Itaú Movimento"
                  value={formNovaConta.nome}
                  onChange={e => setFormNovaConta({ ...formNovaConta, nome: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#141412', border: '1px solid var(--line, rgba(255,255,255,.1))', color: '#fff', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted, #94a3b8)', marginBottom: 6 }}>Banco</label>
                  <select
                    value={formNovaConta.banco}
                    onChange={e => setFormNovaConta({ ...formNovaConta, banco: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#141412', border: '1px solid var(--line, rgba(255,255,255,.1))', color: '#fff', fontSize: 13 }}
                  >
                    <option value="Sicredi">748 - Sicredi</option>
                    <option value="Sicoob">756 - Sicoob</option>
                    <option value="Itaú">341 - Itaú Unibanco</option>
                    <option value="Bradesco">237 - Bradesco</option>
                    <option value="Banco do Brasil">001 - Banco do Brasil</option>
                    <option value="Santander">033 - Santander</option>
                    <option value="Caixa">104 - Caixa Econômica</option>
                    <option value="Nubank">260 - Nubank</option>
                    <option value="Inter">077 - Banco Inter</option>
                    <option value="Outro">Outro Banco</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted, #94a3b8)', marginBottom: 6 }}>Agência</label>
                  <input
                    type="text"
                    placeholder="Ex: 0001"
                    value={formNovaConta.agencia}
                    onChange={e => setFormNovaConta({ ...formNovaConta, agencia: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#141412', border: '1px solid var(--line, rgba(255,255,255,.1))', color: '#fff', fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted, #94a3b8)', marginBottom: 6 }}>Número da Conta com Dígito</label>
                <input
                  type="text"
                  placeholder="Ex: 12345-6"
                  value={formNovaConta.conta}
                  onChange={e => setFormNovaConta({ ...formNovaConta, conta: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#141412', border: '1px solid var(--line, rgba(255,255,255,.1))', color: '#fff', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalNovaConta(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--line, rgba(255,255,255,.1))', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--green, #22c55e)', border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>Salvar Conta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
