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
  
  // Abas internas: 'extrato' | 'tef_cartoes' | 'tef_simulador' | 'bancos_info'
  const [subAba, setSubAba] = useState('extrato')

  // Estado Extrato Bancário
  const [contas, setContas] = useState([])
  const [contaSelecionada, setContaSelecionada] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('pendente') // 'pendente' | 'conciliado' | 'ignorado'
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [arquivoOfx, setArquivoOfx] = useState(null)
  const [enviandoImportacao, setEnviandoImportacao] = useState(false)
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [modalLancar, setModalLancar] = useState(null)
  const [formNovaConta, setFormNovaConta] = useState({ nome: '', banco: 'Sicredi', agencia: '', conta: '' })
  const fileInputRef = useRef(null)

  // Estado Bancos e TEF
  const [bancosLista, setBancosLista] = useState([])
  const [adquirentes, setAdquirentes] = useState([])
  const [bandeiras, setBandeiras] = useState([])
  const [transacoesTef, setTransacoesTef] = useState([])
  const [resumoRecebiveis, setResumoRecebiveis] = useState(null)
  const [modalComprovante, setModalComprovante] = useState(null)

  // Estado Formulário TEF Balcão
  const [formTef, setFormTef] = useState({
    valor: '',
    modalidade: 'debito',
    parcelas: 1,
    adquirenteId: 'stone',
    bandeiraId: 'mastercard',
    clienteNome: 'Cliente Balcão Dino',
    operador: 'Dino Balcão'
  })
  const [processandoTef, setProcessandoTef] = useState(false)

  // Carregar dados de conciliação bancária
  const carregarDadosBancarios = useCallback(async () => {
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

  // Carregar dados de TEF e Bancos
  const carregarDadosTefEBancos = useCallback(async () => {
    try {
      const [resBancos, resAdq, resBand, resTrx, resPrevisao] = await Promise.all([
        api.get('/api/admin/tef/bancos').catch(() => ({ bancos: [] })),
        api.get('/api/admin/tef/adquirentes').catch(() => ({ adquirentes: [] })),
        api.get('/api/admin/tef/bandeiras').catch(() => ({ bandeiras: [] })),
        api.get('/api/admin/tef/transacoes').catch(() => ({ transacoes: [] })),
        api.get('/api/admin/tef/resumo-previsoes').catch(() => ({ resumo: null }))
      ])

      if (resBancos?.bancos) setBancosLista(resBancos.bancos)
      if (resAdq?.adquirentes) setAdquirentes(resAdq.adquirentes)
      if (resBand?.bandeiras) setBandeiras(resBand.bandeiras)
      if (resTrx?.transacoes) setTransacoesTef(resTrx.transacoes)
      if (resPrevisao?.resumo) setResumoRecebiveis(resPrevisao.resumo)
    } catch (err) {
      console.warn('Erro ao carregar ecossistema TEF:', err)
    }
  }, [])

  useEffect(() => {
    carregarDadosBancarios()
    carregarDadosTefEBancos()
  }, [carregarDadosBancarios, carregarDadosTefEBancos])

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
      carregarDadosBancarios()
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
      carregarDadosBancarios()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Erro ao executar conciliação automática', true)
    } finally {
      setCarregando(false)
    }
  }

  // Conciliar Linha Manualmente
  async function handleConciliarLinha(linhaId, lancamentoId) {
    try {
      const res = await api.post(`/api/admin/razao/conciliacao/linhas/${linhaId}/conciliar`, {
        lancamentoId
      })
      toast(res.baixado ? 'Linha conciliada e conta baixada com sucesso!' : 'Linha conciliada com sucesso!')
      carregarDadosBancarios()
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
      carregarDadosBancarios()
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
      carregarDadosBancarios()
    } catch (err) {
      toast(err.message || 'Erro ao ignorar linha', true)
    }
  }

  // Desfazer Conciliação
  async function handleDesfazer(linhaId) {
    try {
      await api.post(`/api/admin/razao/conciliacao/linhas/${linhaId}/desfazer`, {})
      toast('Conciliação desfeita!')
      carregarDadosBancarios()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Erro ao desfazer conciliação', true)
    }
  }

  // Criar Nova Conta
  async function handleCriarConta(e) {
    e.preventDefault()
    if (!formNovaConta.nome.trim()) {
      toast('Informe o nome de identificação da conta', true)
      return
    }
    try {
      const res = await api.post('/api/admin/razao/conciliacao/contas', formNovaConta)
      toast('Conta bancária cadastrada com sucesso!')
      setModalNovaConta(false)
      setFormNovaConta({ nome: '', banco: 'Sicredi', agencia: '', conta: '' })
      carregarDadosBancarios()
      if (res?.id) setContaSelecionada(res.id)
    } catch (err) {
      toast(err.message || 'Erro ao cadastrar conta bancária', true)
    }
  }

  // Processar Pagamento TEF no Balcão
  async function handleProcessarTef(e) {
    e.preventDefault()
    const val = Number(String(formTef.valor).replace(',', '.'))
    if (!val || val <= 0) {
      toast('Informe um valor válido para a transação TEF', true)
      return
    }
    setProcessandoTef(true)
    try {
      const res = await api.post('/api/admin/tef/processar', {
        valor: val,
        modalidade: formTef.modalidade,
        parcelas: Number(formTef.parcelas) || 1,
        adquirenteId: formTef.adquirenteId,
        bandeiraId: formTef.bandeiraId,
        clienteNome: formTef.clienteNome,
        operador: formTef.operador
      })

      toast(`Transação TEF Autorizada! NSU: ${res.transacao.nsu} · AUT: ${res.transacao.codigoAutorizacao}`)
      setModalComprovante(res.transacao)
      setFormTef(prev => ({ ...prev, valor: '' }))
      carregarDadosTefEBancos()
    } catch (err) {
      toast(err.message || 'Erro ao comunicar com a maquininha TEF', true)
    } finally {
      setProcessandoTef(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Barra de Sub-Navegação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: 'var(--card)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`c360-btn ${subAba === 'extrato' ? 'primary' : 'ghost'}`}
            style={{ fontSize: 13, padding: '6px 12px' }}
            onClick={() => setSubAba('extrato')}
          >
            🏦 Extratos & Conciliação OFX
          </button>
          <button
            type="button"
            className={`c360-btn ${subAba === 'tef_cartoes' ? 'primary' : 'ghost'}`}
            style={{ fontSize: 13, padding: '6px 12px' }}
            onClick={() => setSubAba('tef_cartoes')}
          >
            💳 TEF & Maquininhas de Cartão
          </button>
          <button
            type="button"
            className={`c360-btn ${subAba === 'tef_simulador' ? 'primary' : 'ghost'}`}
            style={{ fontSize: 13, padding: '6px 12px' }}
            onClick={() => setSubAba('tef_simulador')}
          >
            ⚡ Terminal Pinpad / Balcão
          </button>
          <button
            type="button"
            className={`c360-btn ${subAba === 'bancos_info' ? 'primary' : 'ghost'}`}
            style={{ fontSize: 13, padding: '6px 12px' }}
            onClick={() => setSubAba('bancos_info')}
          >
            🌐 Bancos & Adquirentes Homologados
          </button>
        </div>

        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
          {subAba === 'extrato' && 'Cruze o extrato bancário com o financeiro'}
          {subAba === 'tef_cartoes' && 'Gestão de taxas MDR e agenda de recebíveis'}
          {subAba === 'tef_simulador' && 'Cobrança integrada com comprovante fiscal'}
          {subAba === 'bancos_info' && 'Suporte a Sicredi, Sicoob, Itaú, Stone, Cielo e outros'}
        </span>
      </div>

      {/* SUB-ABA 1: EXTRATOS & CONCILIAÇÃO BANCÁRIA */}
      {subAba === 'extrato' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Header e Ações Principais */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🏦 Conciliação Bancária OFX & PIX</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Extrato Inteligente vs Razão Financeiro. Importe o extrato do Sicredi, Sicoob, Itaú, Bradesco, Santander ou Nubank.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="c360-btn ghost"
                style={{ fontSize: 12 }}
                onClick={() => setModalNovaConta(true)}
              >
                + Cadastrar Conta
              </button>
              <button
                type="button"
                className="c360-btn primary"
                style={{ fontSize: 12, background: 'var(--accent, #b0892e)', borderColor: 'var(--accent, #b0892e)' }}
                onClick={handleConciliarAutomatico}
                disabled={carregando}
              >
                {carregando ? 'Conciliando…' : '⚡ Conciliar com IA / Razão'}
              </button>
            </div>
          </div>

          {/* Cards de Contas Bancárias Cadastradas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <div
              onClick={() => setContaSelecionada('')}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: contaSelecionada === '' ? 'var(--card2, rgba(176, 137, 46, 0.12))' : 'var(--card)',
                border: contaSelecionada === '' ? '2px solid var(--accent, #b0892e)' : '1px solid var(--line)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Todas as Contas</span>
              <strong style={{ fontSize: 16, display: 'block', margin: '4px 0 2px' }}>Visão Global</strong>
              <small style={{ fontSize: 11, color: 'var(--muted)' }}>{contas.length} conta(s) ativa(s)</small>
            </div>

            {contas.map(c => (
              <div
                key={c.id}
                onClick={() => setContaSelecionada(c.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: contaSelecionada === c.id ? 'var(--card2, rgba(176, 137, 46, 0.12))' : 'var(--card)',
                  border: contaSelecionada === c.id ? '2px solid var(--accent, #b0892e)' : '1px solid var(--line)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>{c.banco || 'Banco'}</span>
                  {c.saldoAtual != null && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: Number(c.saldoAtual) >= 0 ? '#10b981' : '#e05c5c' }}>
                      {fmtR(c.saldoAtual)}
                    </span>
                  )}
                </div>
                <strong style={{ fontSize: 15, display: 'block', margin: '4px 0 2px' }}>{c.nome}</strong>
                <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {c.agencia ? `Ag. ${c.agencia}` : ''} {c.conta ? `CC ${c.conta}` : ''}
                </small>
              </div>
            ))}
          </div>

          {/* Importador de Extrato OFX */}
          <div style={{ padding: '14px 16px', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <form onSubmit={handleImportarOfx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Importar Extrato (.OFX):</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,.OFX"
                  onChange={(e) => setArquivoOfx(e.target.files?.[0] || null)}
                  style={{ fontSize: 12 }}
                />
                {arquivoOfx && (
                  <button
                    type="submit"
                    className="c360-btn primary"
                    style={{ fontSize: 12, padding: '4px 12px' }}
                    disabled={enviandoImportacao}
                  >
                    {enviandoImportacao ? 'Processando…' : '📥 Processar OFX'}
                  </button>
                )}
              </div>

              {/* Filtro de Status das Linhas */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4 }}>Visualizar:</span>
                {[
                  ['pendente', '⏳ Para Conciliar'],
                  ['conciliado', '✓ Conciliadas'],
                  ['ignorado', '✕ Ignoradas']
                ].map(([st, label]) => (
                  <button
                    key={st}
                    type="button"
                    className={`c360-btn ${statusFiltro === st ? 'primary' : 'ghost'}`}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => setStatusFiltro(st)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </form>
          </div>

          {/* Tabela de Linhas do Extrato Bancário */}
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--card2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>Data</th>
                  <th style={{ padding: '10px 14px' }}>Descrição no Extrato</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor</th>
                  <th style={{ padding: '10px 14px' }}>Sugestão IA / Correspondência</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--muted)' }}>
                      Nenhuma linha encontrada para o filtro selecionado. Importe um extrato bancário para iniciar a conciliação.
                    </td>
                  </tr>
                ) : (
                  linhas.map(linha => {
                    const isCredito = Number(linha.valor) >= 0
                    return (
                      <tr key={linha.id} style={{ borderBottom: '1px solid var(--line)', transition: 'background 0.15s ease' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {fmtData(linha.data)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{linha.texto || linha.descricao || 'Sem descrição'}</div>
                          <small style={{ color: 'var(--muted)', fontSize: 11 }}>FITID: {linha.fitid || '—'}</small>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 800, color: isCredito ? '#10b981' : '#e05c5c' }}>
                          {isCredito ? '+' : ''} {fmtR(linha.valor)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {linha.lancamentoVinculado ? (
                            <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              ✓ Vinculado a: {linha.lancamentoVinculado.descricao || 'Lançamento'}
                            </span>
                          ) : linha.sugestao ? (
                            <div style={{ fontSize: 12, padding: '4px 8px', background: 'var(--card2)', borderRadius: 6, border: '1px solid var(--line)' }}>
                              <strong style={{ color: 'var(--accent, #b0892e)' }}>💡 Sugestão: </strong>
                              {linha.sugestao.descricao} ({fmtR(linha.sugestao.valor)})
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Aguardando vínculo</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {statusFiltro === 'pendente' && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              {linha.sugestao && (
                                <button
                                  type="button"
                                  className="c360-btn primary"
                                  style={{ fontSize: 11, padding: '3px 8px' }}
                                  onClick={() => handleConciliarLinha(linha.id, linha.sugestao.id)}
                                  title="Confirmar vínculo com o lançamento sugerido"
                                >
                                  ✓ Conciliar
                                </button>
                              )}
                              <button
                                type="button"
                                className="c360-btn ghost"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => setModalLancar({
                                  linha,
                                  descricao: linha.texto || linha.descricao || '',
                                  categoria: isCredito ? 'Serviços' : 'Outros'
                                })}
                                title="Criar novo lançamento no financeiro para esta linha do extrato"
                              >
                                + Lançar
                              </button>
                              <button
                                type="button"
                                className="c360-btn ghost"
                                style={{ fontSize: 11, padding: '3px 8px', color: 'var(--muted)' }}
                                onClick={() => handleIgnorarLinha(linha.id)}
                                title="Ignorar esta linha do extrato"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          {statusFiltro === 'conciliado' && (
                            <button
                              type="button"
                              className="c360-btn ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => handleDesfazer(linha.id)}
                              title="Desfazer conciliação"
                            >
                              ↩ Desfazer
                            </button>
                          )}
                          {statusFiltro === 'ignorado' && (
                            <button
                              type="button"
                              className="c360-btn ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => handleDesfazer(linha.id)}
                              title="Restaurar para pendente"
                            >
                              Restaurar
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-ABA 2: CONCILIAÇÃO DE CARTÕES TEF & MAQUININHAS */}
      {subAba === 'tef_cartoes' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Header e KPIs de Cartão */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>💳 Conciliação de Cartões TEF & Maquininhas</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Auditoria de taxas MDR, agenda de depósitos futuros e conciliação automática com o extrato bancário
              </p>
            </div>
            <button
              type="button"
              className="c360-btn primary"
              style={{ fontSize: 12 }}
              onClick={() => setSubAba('tef_simulador')}
            >
              + Passar Cartão no Terminal Balcão
            </button>
          </div>

          {/* Cards de Resumo da Agenda de Cartões */}
          {resumoRecebiveis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Vendas em Cartão</span>
                <strong style={{ fontSize: 20, color: 'var(--fg)', display: 'block', margin: '4px 0 2px' }}>
                  {fmtR(resumoRecebiveis.totalBrutoPendente)}
                </strong>
                <small style={{ fontSize: 11, color: 'var(--muted)' }}>{resumoRecebiveis.totalTransacoesPendentes} transação(ões) ativa(s)</small>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Taxas Maquininhas (MDR)</span>
                <strong style={{ fontSize: 20, color: '#e05c5c', display: 'block', margin: '4px 0 2px' }}>
                  - {fmtR(resumoRecebiveis.totalTaxasMdr)}
                </strong>
                <small style={{ fontSize: 11, color: 'var(--muted)' }}>Retidas pela adquirente</small>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid #10b981' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Líquido a Cair no Banco</span>
                <strong style={{ fontSize: 20, color: '#10b981', display: 'block', margin: '4px 0 2px' }}>
                  {fmtR(resumoRecebiveis.totalLiquidoPendente)}
                </strong>
                <small style={{ fontSize: 11, color: 'var(--muted)' }}>Previsão de depósito em conta</small>
              </div>
            </div>
          )}

          {/* Adquirentes e Repasses por Maquininha */}
          {resumoRecebiveis?.porAdquirente && Object.keys(resumoRecebiveis.porAdquirente).length > 0 && (
            <div style={{ padding: '14px', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>Repasses Previstos por Adquirente / Maquininha:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {Object.entries(resumoRecebiveis.porAdquirente).map(([adqNome, dados]) => (
                  <div key={adqNome} style={{ padding: '10px 12px', background: 'var(--card2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13 }}>{adqNome}</strong>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{dados.quantidade} vendas</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>Líquido:</span>
                      <strong style={{ color: '#10b981' }}>{fmtR(dados.liquido)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      <span>Taxa: -{fmtR(dados.taxa)}</span>
                      <span>Bruto: {fmtR(dados.bruto)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela de Transações TEF */}
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--card2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>Data/Hora</th>
                  <th style={{ padding: '10px 14px' }}>Maquininha & Bandeira</th>
                  <th style={{ padding: '10px 14px' }}>Modalidade</th>
                  <th style={{ padding: '10px 14px' }}>NSU / Autorização</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Bruto</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Taxa MDR</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Líquido</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Depósito Previsto</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Comprovante</th>
                </tr>
              </thead>
              <tbody>
                {transacoesTef.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--muted)' }}>
                      Nenhuma transação TEF capturada ainda. Use a aba "Terminal Pinpad / Balcão" para passar pagamentos.
                    </td>
                  </tr>
                ) : (
                  transacoesTef.map(trx => (
                    <tr key={trx.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{fmtData(trx.data)}</div>
                        <small style={{ color: 'var(--muted)' }}>{trx.hora}</small>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700 }}>{trx.adquirenteNome}</div>
                        <small style={{ color: 'var(--muted)' }}>{trx.bandeiraNome}</small>
                      </td>
                      <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--card2)', border: '1px solid var(--line)', fontSize: 11 }}>
                          {trx.modalidade.replace('_', ' ')} {trx.parcelas > 1 ? `(${trx.parcelas}x)` : ''}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>
                        <div>NSU: {trx.nsu}</div>
                        <small style={{ color: 'var(--muted)' }}>AUT: {trx.codigoAutorizacao}</small>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>
                        {fmtR(trx.valor)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#e05c5c', fontSize: 12 }}>
                        -{fmtR(trx.valorTaxaMdr)} ({trx.taxaMdrPercentual}%)
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                        {fmtR(trx.valorLiquido)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent, #b0892e)' }}>
                          {fmtData(trx.previsaoLiquidacao)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="c360-btn ghost"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => setModalComprovante(trx)}
                        >
                          📄 Ver Via
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-ABA 3: TERMINAL PINPAD / BALCÃO (SIMULADOR TEF) */}
      {subAba === 'tef_simulador' && (
        <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, border: '1px solid var(--line)', padding: '20px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 4 }}>📟</div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Terminal TEF Oficial / Balcão</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Cobrança direta com Pinpad / Maquininha física (Stone, PagBank, Cielo, Rede, SiTef)
              </p>
            </div>

            <form onSubmit={handleProcessarTef} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Valor a Cobrar (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ex: 150.00"
                  value={formTef.valor}
                  onChange={(e) => setFormTef(prev => ({ ...prev, valor: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 18, fontWeight: 800, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Maquininha / Adquirente:</label>
                  <select
                    value={formTef.adquirenteId}
                    onChange={(e) => setFormTef(prev => ({ ...prev, adquirenteId: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                  >
                    {adquirentes.map(a => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Bandeira do Cartão:</label>
                  <select
                    value={formTef.bandeiraId}
                    onChange={(e) => setFormTef(prev => ({ ...prev, bandeiraId: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                  >
                    {bandeiras.map(b => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Modalidade:</label>
                  <select
                    value={formTef.modalidade}
                    onChange={(e) => setFormTef(prev => ({ ...prev, modalidade: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                  >
                    <option value="debito">Débito (D+1)</option>
                    <option value="credito_avista">Crédito à Vista (D+30)</option>
                    <option value="credito_parcelado">Crédito Parcelado</option>
                    <option value="voucher">Voucher / Benefício</option>
                    <option value="pix">Pix no Pinpad (Instantâneo D+0)</option>
                  </select>
                </div>

                {formTef.modalidade === 'credito_parcelado' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Número de Parcelas:</label>
                    <select
                      value={formTef.parcelas}
                      onChange={(e) => setFormTef(prev => ({ ...prev, parcelas: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Nome do Cliente / Identificação:</label>
                <input
                  type="text"
                  value={formTef.clienteNome}
                  onChange={(e) => setFormTef(prev => ({ ...prev, clienteNome: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                />
              </div>

              <button
                type="submit"
                className="c360-btn primary"
                style={{ padding: '12px', fontSize: 15, fontWeight: 800, marginTop: 8 }}
                disabled={processandoTef}
              >
                {processandoTef ? 'Enviando ao Pinpad…' : '💳 Processar e Capturar no Pinpad'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUB-ABA 4: BANCOS & ADQUIRENTES HOMOLOGADOS */}
      {subAba === 'bancos_info' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Bancos Brasileiros */}
          <div style={{ background: 'var(--card)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--line)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>🌐 Bancos Brasileiros com Conciliação Completa</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
              Identificação automática de cabeçalhos OFX, código COMPE, extratos PIX e tarifas bancárias
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {bancosLista.map(b => (
                <div key={b.codigo} style={{ padding: '12px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: b.cor, color: '#fff' }}>
                      CÓD {b.codigo}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>ISPB {b.ispb}</span>
                  </div>
                  <strong style={{ fontSize: 14, display: 'block', margin: '6px 0 2px' }}>{b.nome}</strong>
                  <small style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{b.razaoSocial}</small>
                </div>
              ))}
            </div>
          </div>

          {/* Adquirentes e Maquininhas */}
          <div style={{ background: 'var(--card)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--line)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>💳 Adquirentes, Maquininhas e Bandeiras Homologadas</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
              Comunicação com Pinpad, geração de comprovantes de transação com NSU, taxas MDR e agenda de liquidação
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {adquirentes.map(a => (
                <div key={a.id} style={{ padding: '14px', borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--line)' }}>
                  <strong style={{ fontSize: 15, color: a.cor, display: 'block' }}>{a.nome}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 8px' }}>{a.razaoSocial}</div>
                  
                  <div style={{ fontSize: 11, display: 'grid', gap: 3, background: 'var(--card)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                    <div><strong>Protocolo:</strong> {a.protocolo}</div>
                    <div><strong>Maquininhas:</strong> {a.modelosMaquininhas.join(', ')}</div>
                    <div><strong>Taxa Débito:</strong> {a.taxasPadrao.debito}% (D+1)</div>
                    <div><strong>Taxa Crédito:</strong> {a.taxasPadrao.credito_avista}% (D+30)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMPROVANTE TEF */}
      {modalComprovante && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', color: '#000', width: '100%', maxWidth: 400, borderRadius: 12, padding: 20, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.4, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: 8, marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>VIA DO CLIENTE & LOJA</strong>
              <button
                type="button"
                onClick={() => setModalComprovante(null)}
                style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}>
              {modalComprovante.comprovanteCliente}
              {'\n\n'}
              {modalComprovante.comprovanteEstabelecimento}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ padding: '6px 12px', background: '#1e293b', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                🖨️ Imprimir Térmica
              </button>
              <button
                type="button"
                onClick={() => setModalComprovante(null)}
                style={{ padding: '6px 12px', background: '#e2e8f0', color: '#000', borderRadius: 6, border: 'none', cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA CONTA BANCÁRIA */}
      {modalNovaConta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--card)', width: '100%', maxWidth: 440, borderRadius: 12, padding: 20, border: '1px solid var(--line)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>+ Cadastrar Conta Bancária</h3>
            <form onSubmit={handleCriarConta} style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Nome de Identificação:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sicredi Principal Dino"
                  value={formNovaConta.nome}
                  onChange={(e) => setFormNovaConta(prev => ({ ...prev, nome: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Banco Brasileiro:</label>
                <select
                  value={formNovaConta.banco}
                  onChange={(e) => setFormNovaConta(prev => ({ ...prev, banco: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                >
                  {bancosLista.map(b => (
                    <option key={b.codigo} value={b.nome}>{b.codigo} - {b.nome}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Agência:</label>
                  <input
                    type="text"
                    placeholder="Ex: 0812"
                    value={formNovaConta.agencia}
                    onChange={(e) => setFormNovaConta(prev => ({ ...prev, agencia: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Conta Corrente:</label>
                  <input
                    type="text"
                    placeholder="Ex: 12345-6"
                    value={formNovaConta.conta}
                    onChange={(e) => setFormNovaConta(prev => ({ ...prev, conta: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="c360-btn ghost"
                  onClick={() => setModalNovaConta(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="c360-btn primary"
                >
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LANÇAR NO FINANCEIRO */}
      {modalLancar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--card)', width: '100%', maxWidth: 440, borderRadius: 12, padding: 20, border: '1px solid var(--line)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>Lançar no Financeiro & Conciliar</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
              Crie uma conta a receber ou pagar a partir desta linha do extrato de {fmtR(modalLancar.linha.valor)}.
            </p>

            <form onSubmit={handleConfirmarLancamento} style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Descrição:</label>
                <input
                  type="text"
                  required
                  value={modalLancar.descricao}
                  onChange={(e) => setModalLancar(prev => ({ ...prev, descricao: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Categoria:</label>
                <input
                  type="text"
                  required
                  value={modalLancar.categoria}
                  onChange={(e) => setModalLancar(prev => ({ ...prev, categoria: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="c360-btn ghost"
                  onClick={() => setModalLancar(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="c360-btn primary"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
