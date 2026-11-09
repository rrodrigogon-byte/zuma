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
  
  // Abas internas: 'extrato' | 'tef_cartoes' | 'tef_simulador' | 'bancos_info' | 'tef_config'
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

  // Estado Parametrização TEF & Terminais
  const [tefConfig, setTefConfig] = useState(null)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [modalNovoTerminal, setModalNovoTerminal] = useState(false)
  const [formTerminal, setFormTerminal] = useState({
    nome: '',
    adquirenteId: 'stone',
    modelo: 'Stone Smart P2 / Gertec PPC930',
    serialNumber: '',
    localizacao: 'Balcão de Atendimento',
    tipoConexao: 'usb_tcp',
    ipPorta: '192.168.1.150:4000',
    merchantId: '984210772',
    suportaPix: true,
    suportaVoucher: true
  })
  const [resultadoPing, setResultadoPing] = useState({})
  const [testandoPingId, setTestandoPingId] = useState(null)

  // Estado Formulário TEF Balcão
  const [formTef, setFormTef] = useState({
    valor: '',
    modalidade: 'debito',
    parcelas: 1,
    adquirenteId: 'stone',
    bandeiraId: 'mastercard',
    terminalId: '',
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
      const [resBancos, resAdq, resBand, resTrx, resPrevisao, resConfig] = await Promise.all([
        api.get('/api/admin/tef/bancos').catch(() => ({ bancos: [] })),
        api.get('/api/admin/tef/adquirentes').catch(() => ({ adquirentes: [] })),
        api.get('/api/admin/tef/bandeiras').catch(() => ({ bandeiras: [] })),
        api.get('/api/admin/tef/transacoes').catch(() => ({ transacoes: [] })),
        api.get('/api/admin/tef/resumo-previsoes').catch(() => ({ resumo: null })),
        api.get('/api/admin/tef/configuracoes').catch(() => ({ config: null }))
      ])

      if (resBancos?.bancos) setBancosLista(resBancos.bancos)
      if (resAdq?.adquirentes) setAdquirentes(resAdq.adquirentes)
      if (resBand?.bandeiras) setBandeiras(resBand.bandeiras)
      if (resTrx?.transacoes) setTransacoesTef(resTrx.transacoes)
      if (resPrevisao?.resumo) setResumoRecebiveis(resPrevisao.resumo)
      if (resConfig?.config) {
        setTefConfig(resConfig.config)
        if (resConfig.config.terminais?.length && !formTef.terminalId) {
          setFormTef(prev => ({ ...prev, terminalId: resConfig.config.terminais[0].id }))
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar ecossistema TEF:', err)
    }
  }, [formTef.terminalId])

  useEffect(() => {
    carregarDadosBancarios()
  }, [carregarDadosBancarios])

  useEffect(() => {
    carregarDadosTefEBancos()
  }, [carregarDadosTefEBancos])

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
    const { linha, tipo, descricao, categoriaId } = modalLancar
    try {
      await api.post(`/api/admin/razao/conciliacao/linhas/${linha.id}/lancar-e-conciliar`, {
        tipo,
        descricao,
        categoriaId: categoriaId || null
      })
      toast('Conta lançada no financeiro e linha conciliada com sucesso!')
      setModalLancar(null)
      carregarDadosBancarios()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Erro ao lançar conta a partir do extrato', true)
    }
  }

  // Ignorar Linha
  async function handleIgnorarLinha(linhaId) {
    try {
      await api.post(`/api/admin/razao/conciliacao/linhas/${linhaId}/ignorar`)
      toast('Linha do extrato ignorada.')
      carregarDadosBancarios()
    } catch (err) {
      toast(err.message || 'Erro ao ignorar linha', true)
    }
  }

  // Desconciliar Linha
  async function handleDesconciliarLinha(linhaId) {
    try {
      await api.post(`/api/admin/razao/conciliacao/linhas/${linhaId}/desconciliar`)
      toast('Vínculo desfeito com sucesso.')
      carregarDadosBancarios()
      onAtualizarFinanceiro?.()
    } catch (err) {
      toast(err.message || 'Erro ao desconciliar', true)
    }
  }

  // Cadastrar Nova Conta Bancária
  async function handleSalvarNovaConta(e) {
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
        terminalId: formTef.terminalId,
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

  // Salvar Parametrização TEF
  async function handleSalvarTefConfig(e) {
    e.preventDefault()
    if (!tefConfig) return
    setSalvandoConfig(true)
    try {
      const res = await api.put('/api/admin/tef/configuracoes', tefConfig)
      toast('Parametrização do TEF e taxas MDR salvas com sucesso!')
      if (res?.config) setTefConfig(res.config)
      carregarDadosTefEBancos()
    } catch (err) {
      toast(err.message || 'Erro ao salvar parametrização TEF', true)
    } finally {
      setSalvandoConfig(false)
    }
  }

  // Restaurar Padrões Barbearia Dino
  async function handleRestaurarPadraoDino() {
    if (!confirm('Deseja restaurar as configurações oficiais homologadas da Barbearia Dino (Stone Code 984210772, Terminais e Taxas)?')) return
    setSalvandoConfig(true)
    try {
      const res = await api.post('/api/admin/tef/restaurar-padrao-dino')
      toast('Configurações oficiais da Barbearia Dino restauradas!')
      if (res?.config) setTefConfig(res.config)
      carregarDadosTefEBancos()
    } catch (err) {
      toast(err.message || 'Erro ao restaurar padrões', true)
    } finally {
      setSalvandoConfig(false)
    }
  }

  // Testar Conexão / Ping do Terminal
  async function handleTestarPing(terminalId) {
    setTestandoPingId(terminalId)
    try {
      const res = await api.post(`/api/admin/tef/terminais/${terminalId}/testar-conexao`)
      setResultadoPing(prev => ({ ...prev, [terminalId]: res }))
      toast(`Terminal ${res.terminalNome}: Conectado com sucesso (${res.latenciaMs}ms)!`)
    } catch (err) {
      toast(err.message || 'Falha ao conectar com o terminal', true)
    } finally {
      setTestandoPingId(null)
    }
  }

  // Cadastrar Novo Terminal Pinpad
  async function handleSalvarNovoTerminal(e) {
    e.preventDefault()
    if (!formTerminal.nome.trim()) {
      toast('Informe o nome do terminal pinpad', true)
      return
    }
    try {
      await api.post('/api/admin/tef/terminais', formTerminal)
      toast('Terminal pinpad provisionado com sucesso!')
      setModalNovoTerminal(false)
      setFormTerminal({
        nome: '',
        adquirenteId: 'stone',
        modelo: 'Stone Smart P2 / Gertec PPC930',
        serialNumber: '',
        localizacao: 'Balcão de Atendimento',
        tipoConexao: 'usb_tcp',
        ipPorta: '192.168.1.150:4000',
        merchantId: '984210772',
        suportaPix: true,
        suportaVoucher: true
      })
      carregarDadosTefEBancos()
    } catch (err) {
      toast(err.message || 'Erro ao cadastrar terminal', true)
    }
  }

  // Excluir Terminal
  async function handleExcluirTerminal(terminalId) {
    if (!confirm('Deseja desativar este terminal pinpad?')) return
    try {
      await api.delete(`/api/admin/tef/terminais/${terminalId}`)
      toast('Terminal pinpad removido com sucesso.')
      carregarDadosTefEBancos()
    } catch (err) {
      toast(err.message || 'Erro ao remover terminal', true)
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
            className={`c360-btn ${subAba === 'tef_config' ? 'primary' : 'ghost'}`}
            style={{ fontSize: 13, padding: '6px 12px' }}
            onClick={() => setSubAba('tef_config')}
          >
            ⚙️ Parametrização TEF & Terminais
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
          {subAba === 'tef_config' && 'Parametrize taxas MDR, adquirentes e pinpads'}
          {subAba === 'bancos_info' && 'Suporte a Sicredi, Sicoob, Itaú, Stone, Cielo e outros'}
        </span>
      </div>

      {/* SUB-ABA 1: EXTRATOS & CONCILIAÇÃO BANCÁRIA */}
      {subAba === 'extrato' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Header e Ações Principais */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700 }}>Conciliação de Extratos Bancários (OFX)</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                Importe os extratos bancários das suas contas correntes (Sicredi, Sicoob, Itaú, Bradesco, etc.) e concilie em lote com os lançamentos do sistema.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="c360-btn ghost"
                style={{ fontSize: 13 }}
                onClick={() => setModalNovaConta(true)}
              >
                + Nova Conta Bancária
              </button>
              <button
                type="button"
                className="c360-btn primary"
                style={{ fontSize: 13 }}
                onClick={handleConciliarAutomatico}
                disabled={carregando}
              >
                ⚡ Conciliar Tudo Automaticamente (IA)
              </button>
            </div>
          </div>

          {/* Upload e Filtros de Conta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, background: 'var(--card)', padding: 14, borderRadius: 12, border: '1px solid var(--line)' }}>
            <form onSubmit={handleImportarOfx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.OFX"
                onChange={e => setArquivoOfx(e.target.files[0] || null)}
                style={{ fontSize: 13 }}
              />
              <button
                type="submit"
                className="c360-btn primary"
                disabled={!arquivoOfx || enviandoImportacao}
                style={{ whiteSpace: 'nowrap', fontSize: 13 }}
              >
                {enviandoImportacao ? 'Importando...' : '📥 Importar Extrato OFX'}
              </button>
            </form>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Filtrar Conta:</label>
              <select
                className="c360-input"
                style={{ width: 180, fontSize: 13 }}
                value={contaSelecionada}
                onChange={e => setContaSelecionada(e.target.value)}
              >
                <option value="">Todas as Contas ({contas.length})</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>
                ))}
              </select>

              <select
                className="c360-input"
                style={{ width: 140, fontSize: 13 }}
                value={statusFiltro}
                onChange={e => setStatusFiltro(e.target.value)}
              >
                <option value="pendente">⏳ Pendentes</option>
                <option value="conciliado">✅ Conciliados</option>
                <option value="ignorado">🚫 Ignorados</option>
              </select>
            </div>
          </div>

          {/* Tabela de Linhas do Extrato */}
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Linhas do Extrato Bancário ({linhas.length})</strong>
              {carregando && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Atualizando...</span>}
            </div>

            {linhas.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                Nenhuma linha de extrato encontrada para o filtro selecionado. Importe um arquivo <strong>.OFX</strong> acima para começar.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)' }}>
                      <th style={{ padding: '10px 14px' }}>Data</th>
                      <th style={{ padding: '10px 14px' }}>Descrição Extrato</th>
                      <th style={{ padding: '10px 14px' }}>Documento / FITID</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{fmtData(l.data)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <strong>{l.descricao}</strong>
                          {l.memo && l.memo !== l.descricao && (
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.memo}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)' }}>
                          {l.documento || l.fitid || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: Number(l.valor) >= 0 ? '#10B981' : '#EF4444', whiteSpace: 'nowrap' }}>
                          {fmtR(l.valor)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: l.status === 'conciliado' ? 'rgba(16, 185, 129, 0.15)' : (l.status === 'ignorado' ? 'rgba(100, 116, 139, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                            color: l.status === 'conciliado' ? '#10B981' : (l.status === 'ignorado' ? '#64748B' : '#D97706')
                          }}>
                            {l.status === 'conciliado' ? 'CONCILIADO' : (l.status === 'ignorado' ? 'IGNORADO' : 'PENDENTE')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {l.status === 'pendente' && (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="c360-btn primary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => setModalLancar({
                                  linha: l,
                                  tipo: Number(l.valor) >= 0 ? 'receita' : 'despesa',
                                  descricao: l.descricao,
                                  categoriaId: ''
                                })}
                              >
                                + Lançar Conta
                              </button>
                              <button
                                type="button"
                                className="c360-btn ghost"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => handleIgnorarLinha(l.id)}
                              >
                                Ignorar
                              </button>
                            </div>
                          )}
                          {l.status === 'conciliado' && (
                            <button
                              type="button"
                              className="c360-btn ghost"
                              style={{ fontSize: 11, padding: '4px 8px', color: '#EF4444' }}
                              onClick={() => handleDesconciliarLinha(l.id)}
                            >
                              Desconciliar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 2: TEF & MAQUININHAS DE CARTÃO */}
      {subAba === 'tef_cartoes' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Header e Métricas */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700 }}>💳 Conciliação de Cartões TEF & Maquininhas</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                Auditoria de taxas MDR, agenda de depósitos futuros e conciliação automática com o extrato bancário
              </p>
            </div>

            <button
              type="button"
              className="c360-btn primary"
              style={{ fontSize: 13 }}
              onClick={() => setSubAba('tef_simulador')}
            >
              + Passar Cartão no Terminal Balcão
            </button>
          </div>

          {/* Cards de Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ background: 'var(--card)', padding: 16, borderRadius: 12, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>Vendas em Cartão</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{fmtR(resumoRecebiveis?.totalBrutoPendente || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{resumoRecebiveis?.totalTransacoesPendentes || 0} transação(ões) ativa(s)</div>
            </div>

            <div style={{ background: 'var(--card)', padding: 16, borderRadius: 12, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>Taxas Maquininhas (MDR)</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: '#EF4444' }}>- {fmtR(resumoRecebiveis?.totalTaxasMdr || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Retidas pela adquirente</div>
            </div>

            <div style={{ background: 'var(--card)', padding: 16, borderRadius: 12, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#10B981', fontWeight: 700 }}>Líquido a Cair no Banco</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: '#10B981' }}>{fmtR(resumoRecebiveis?.totalLiquidoPendente || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Previsão de depósito em conta</div>
            </div>
          </div>

          {/* Detalhamento por Adquirente */}
          {resumoRecebiveis?.porAdquirente && Object.keys(resumoRecebiveis.porAdquirente).length > 0 && (
            <div style={{ background: 'var(--card)', padding: 16, borderRadius: 12, border: '1px solid var(--line)' }}>
              <strong style={{ fontSize: 14 }}>Repasses Previstos por Adquirente / Maquininha:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
                {Object.entries(resumoRecebiveis.porAdquirente).map(([nome, d]) => (
                  <div key={nome} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{nome}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>Líquido:</span>
                      <strong style={{ color: '#10B981' }}>{fmtR(d.liquido)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                      <span>Taxa: -{fmtR(d.taxa)}</span>
                      <span>Bruto: {fmtR(d.bruto)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela de Transações TEF */}
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Transações de Cartão Registradas ({transacoesTef.length})</strong>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Captura com NSU e código de autorização</span>
            </div>

            {transacoesTef.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                Nenhuma transação de cartão capturada ainda. Use a aba <strong>Terminal Pinpad / Balcão</strong> para processar pagamentos na maquininha.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)' }}>
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
                    {transacoesTef.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div>{fmtData(t.data)}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.hora}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 700 }}>{t.adquirenteNome}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.bandeiraNome} {t.terminalNome ? `· ${t.terminalNome}` : ''}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, background: 'var(--bg)', fontSize: 11, border: '1px solid var(--line)' }}>
                            {t.modalidade === 'debito' ? 'Débito' : (t.modalidade === 'pix' ? 'Pix Pinpad' : `Crédito ${t.parcelas}x`)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11 }}>
                          <div>NSU: {t.nsu}</div>
                          <div style={{ color: 'var(--muted)' }}>AUT: {t.codigoAutorizacao}</div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtR(t.valor)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#EF4444' }}>-{fmtR(t.valorTaxaMdr)} ({t.taxaMdrPercentual}%)</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmtR(t.valorLiquido)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: 11 }}>
                          {fmtData(t.previsaoLiquidacao)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="c360-btn ghost"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => setModalComprovante(t)}
                          >
                            📄 Ver Via
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 3: TERMINAL PINPAD / BALCÃO */}
      {subAba === 'tef_simulador' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700 }}>⚡ Terminal Pinpad de Balcão (Cobrança Integrada)</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Envie a cobrança diretamente para a maquininha física no balcão da barbearia, capture com autorização em tempo real e emita a via do cliente.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Formulário de Cobrança */}
            <form onSubmit={handleProcessarTef} style={{ background: 'var(--card)', padding: 20, borderRadius: 12, border: '1px solid var(--line)', display: 'grid', gap: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                Dados da Transação no Balcão
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Terminal Pinpad Físico:</label>
                <select
                  className="c360-input"
                  style={{ width: '100%' }}
                  value={formTef.terminalId}
                  onChange={e => setFormTef(prev => ({ ...prev, terminalId: e.target.value }))}
                >
                  {(tefConfig?.terminais || []).map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({t.modelo} · {t.serialNumber})</option>
                  ))}
                  {(!tefConfig?.terminais || tefConfig.terminais.length === 0) && (
                    <option value="">Pinpad Balcão Principal (Padrão Dino)</option>
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Valor a Cobrar (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    className="c360-input"
                    style={{ width: '100%', fontSize: 18, fontWeight: 700, color: '#10B981' }}
                    placeholder="0,00"
                    value={formTef.valor}
                    onChange={e => setFormTef(prev => ({ ...prev, valor: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Modalidade:</label>
                  <select
                    className="c360-input"
                    style={{ width: '100%' }}
                    value={formTef.modalidade}
                    onChange={e => setFormTef(prev => ({ ...prev, modalidade: e.target.value }))}
                  >
                    <option value="debito">Débito (D+1)</option>
                    <option value="credito_avista">Crédito à Vista (D+30)</option>
                    <option value="credito_parcelado">Crédito Parcelado</option>
                    <option value="voucher">Voucher / Benefício (VR/Alelo)</option>
                    <option value="pix">Pix no Pinpad (QR Code D+0)</option>
                  </select>
                </div>
              </div>

              {formTef.modalidade === 'credito_parcelado' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Quantidade de Parcelas:</label>
                  <select
                    className="c360-input"
                    style={{ width: '100%' }}
                    value={formTef.parcelas}
                    onChange={e => setFormTef(prev => ({ ...prev, parcelas: e.target.value }))}
                  >
                    {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>{n}x vezes</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Maquininha / Adquirente:</label>
                  <select
                    className="c360-input"
                    style={{ width: '100%' }}
                    value={formTef.adquirenteId}
                    onChange={e => setFormTef(prev => ({ ...prev, adquirenteId: e.target.value }))}
                  >
                    {adquirentes.map(a => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Bandeira do Cartão:</label>
                  <select
                    className="c360-input"
                    style={{ width: '100%' }}
                    value={formTef.bandeiraId}
                    onChange={e => setFormTef(prev => ({ ...prev, bandeiraId: e.target.value }))}
                  >
                    {bandeiras.map(b => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome do Cliente / Identificação:</label>
                <input
                  type="text"
                  className="c360-input"
                  style={{ width: '100%' }}
                  value={formTef.clienteNome}
                  onChange={e => setFormTef(prev => ({ ...prev, clienteNome: e.target.value }))}
                />
              </div>

              <button
                type="submit"
                className="c360-btn primary"
                disabled={processandoTef || !formTef.valor}
                style={{ padding: '12px 18px', fontSize: 14, fontWeight: 700, marginTop: 8 }}
              >
                {processandoTef ? '⏳ Enviando ao Pinpad...' : '💳 Processar e Capturar no Pinpad'}
              </button>
            </form>

            {/* Simulação Visual do Pinpad de Balcão */}
            <div style={{ background: '#1E293B', color: '#F8FAFC', padding: 24, borderRadius: 16, border: '2px solid #334155', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>📟</span>
                    <div>
                      <strong style={{ fontSize: 14, color: '#38BDF8' }}>TERMINAL TEF DE BALCÃO</strong>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>DINO BARBEARIA · PROTOCOLO INTEGRADO</div>
                    </div>
                  </div>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                </div>

                <div style={{ background: '#0F172A', padding: 18, borderRadius: 10, marginTop: 16, fontFamily: 'monospace', textAlign: 'center', border: '1px solid #1E293B' }}>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>VALOR DA TRANSAÇÃO</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#F8FAFC', margin: '8px 0' }}>
                    {formTef.valor ? fmtR(formTef.valor) : 'R$ 0,00'}
                  </div>
                  <div style={{ fontSize: 12, color: '#38BDF8' }}>
                    {formTef.modalidade.toUpperCase()} · {formTef.adquirenteId.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>
                    APROXIME, INSIRA OU PASSE O CARTÃO
                  </div>
                </div>

                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                  {['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => (
                    <div key={k} style={{ background: '#334155', padding: '10px 0', borderRadius: 6, fontWeight: 700, fontSize: 14 }}>
                      {k}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16, borderTop: '1px solid #334155', paddingTop: 10, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                Suporta Chip EMV, Contactless (NFC), Tarja Magnética, Apple Pay, Google Pay e Pix QR Code no display
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 4: PARAMETRIZAÇÃO TEF & TERMINAIS */}
      {subAba === 'tef_config' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700 }}>⚙️ Parametrização TEF & Gestão de Pinpads</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                Configure as adquirentes ativas, taxas MDR negociadas, terminais físicos provisionados e parâmetros de comunicação da Barbearia Dino.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="c360-btn ghost"
                style={{ fontSize: 13 }}
                onClick={handleRestaurarPadraoDino}
                disabled={salvandoConfig}
              >
                🔄 Restaurar Padrões da Barbearia Dino
              </button>
              <button
                type="button"
                className="c360-btn primary"
                style={{ fontSize: 13 }}
                onClick={() => setModalNovoTerminal(true)}
              >
                + Provisionar Novo Pinpad
              </button>
            </div>
          </div>

          {/* Dados do Estabelecimento & Adquirente Primária */}
          <div style={{ background: 'var(--card)', padding: 18, borderRadius: 12, border: '1px solid var(--line)', display: 'grid', gap: 14 }}>
            <strong style={{ fontSize: 14 }}>🏢 Identificação do Estabelecimento & Adquirente Padrão</strong>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block' }}>Razão Social:</label>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{tefConfig?.razaoSocial || 'DINO BARBEARIA LTDA'}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block' }}>CNPJ Oficial:</label>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{tefConfig?.cnpj || '50.073.355/0002-60'}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block' }}>Inscrição Municipal (IM):</label>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, color: '#10B981' }}>{tefConfig?.inscricaoMunicipal || '30297'} (Tangará da Serra / MT)</div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block' }}>Adquirente Padrão do Caixa:</label>
                <select
                  className="c360-input"
                  style={{ width: '100%', marginTop: 2, fontSize: 13 }}
                  value={tefConfig?.adquirentePadrao || 'stone'}
                  onChange={e => setTefConfig(prev => ({ ...prev, adquirentePadrao: e.target.value }))}
                >
                  {adquirentes.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Lista de Terminais Pinpad Provisionados */}
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Terminais Pinpads Provisionados ({tefConfig?.terminais?.length || 0})</strong>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Comunicação direta com as maquininhas de balcão</span>
            </div>

            {(!tefConfig?.terminais || tefConfig.terminais.length === 0) ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                Nenhum terminal cadastrado. Clique no botão acima para provisionar o primeiro pinpad.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)' }}>
                      <th style={{ padding: '10px 14px' }}>Nome do Terminal</th>
                      <th style={{ padding: '10px 14px' }}>Adquirente & Modelo</th>
                      <th style={{ padding: '10px 14px' }}>Serial / StoneCode</th>
                      <th style={{ padding: '10px 14px' }}>Localização</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tefConfig.terminais.map(t => {
                      const pingInfo = resultadoPing[t.id]
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700 }}>{t.nome}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>ID: {t.id}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div>{t.modelo}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.adquirenteId.toUpperCase()} · {t.tipoConexao}</div>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>
                            <div>{t.serialNumber}</div>
                            {t.merchantId && <div style={{ fontSize: 10, color: 'var(--muted)' }}>MID: {t.merchantId}</div>}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>
                            {t.localizacao}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.status === 'ativo' ? '#10B981' : '#EAB308' }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: t.status === 'ativo' ? '#10B981' : '#EAB308' }}>
                                {t.status === 'ativo' ? 'CONECTADO' : 'CONTINGÊNCIA'}
                              </span>
                            </div>
                            {pingInfo && (
                              <div style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>
                                Ping OK: {pingInfo.latenciaMs}ms ({pingInfo.status})
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="c360-btn primary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => handleTestarPing(t.id)}
                                disabled={testandoPingId === t.id}
                              >
                                {testandoPingId === t.id ? 'Testando...' : '⚡ Testar Ping'}
                              </button>
                              <button
                                type="button"
                                className="c360-btn ghost"
                                style={{ fontSize: 11, padding: '4px 8px', color: '#EF4444' }}
                                onClick={() => handleExcluirTerminal(t.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Matriz de Taxas MDR Negociadas */}
          <div style={{ background: 'var(--card)', padding: 18, borderRadius: 12, border: '1px solid var(--line)', display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <strong style={{ fontSize: 14 }}>📊 Taxas MDR Negociadas por Adquirente da Barbearia Dino</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--muted)' }}>
                  As taxas abaixo são utilizadas para abater o custo da maquininha e projetar o valor líquido exato de cada fechamento de comanda.
                </p>
              </div>

              <button
                type="button"
                className="c360-btn primary"
                onClick={handleSalvarTefConfig}
                disabled={salvandoConfig}
                style={{ fontSize: 13, padding: '6px 14px' }}
              >
                {salvandoConfig ? 'Salvando...' : '💾 Salvar Parametrização TEF'}
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Adquirente</th>
                    <th style={{ padding: '8px 12px' }}>Débito %</th>
                    <th style={{ padding: '8px 12px' }}>Crédito Vista %</th>
                    <th style={{ padding: '8px 12px' }}>Crédito 2-6x %</th>
                    <th style={{ padding: '8px 12px' }}>Crédito 7-12x %</th>
                    <th style={{ padding: '8px 12px' }}>Pix %</th>
                    <th style={{ padding: '8px 12px' }}>Prazo Débito</th>
                    <th style={{ padding: '8px 12px' }}>Prazo Crédito</th>
                  </tr>
                </thead>
                <tbody>
                  {adquirentes.slice(0, 5).map(adq => {
                    const custom = tefConfig?.taxasCustomizadas?.[adq.id] || adq.taxasPadrao
                    return (
                      <tr key={adq.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                          {adq.nome}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="c360-input"
                            style={{ width: 70, fontSize: 12, padding: '4px 6px' }}
                            value={custom.debito ?? adq.taxasPadrao.debito}
                            onChange={e => {
                              const val = Number(e.target.value)
                              setTefConfig(prev => ({
                                ...prev,
                                taxasCustomizadas: {
                                  ...prev.taxasCustomizadas,
                                  [adq.id]: { ...(prev.taxasCustomizadas?.[adq.id] || adq.taxasPadrao), debito: val }
                                }
                              }))
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="c360-input"
                            style={{ width: 70, fontSize: 12, padding: '4px 6px' }}
                            value={custom.credito_avista ?? adq.taxasPadrao.credito_avista}
                            onChange={e => {
                              const val = Number(e.target.value)
                              setTefConfig(prev => ({
                                ...prev,
                                taxasCustomizadas: {
                                  ...prev.taxasCustomizadas,
                                  [adq.id]: { ...(prev.taxasCustomizadas?.[adq.id] || adq.taxasPadrao), credito_avista: val }
                                }
                              }))
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="c360-input"
                            style={{ width: 70, fontSize: 12, padding: '4px 6px' }}
                            value={custom.credito_parcelado_2_6 ?? adq.taxasPadrao.credito_parcelado_2_6}
                            onChange={e => {
                              const val = Number(e.target.value)
                              setTefConfig(prev => ({
                                ...prev,
                                taxasCustomizadas: {
                                  ...prev.taxasCustomizadas,
                                  [adq.id]: { ...(prev.taxasCustomizadas?.[adq.id] || adq.taxasPadrao), credito_parcelado_2_6: val }
                                }
                              }))
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="c360-input"
                            style={{ width: 70, fontSize: 12, padding: '4px 6px' }}
                            value={custom.credito_parcelado_7_12 ?? adq.taxasPadrao.credito_parcelado_7_12}
                            onChange={e => {
                              const val = Number(e.target.value)
                              setTefConfig(prev => ({
                                ...prev,
                                taxasCustomizadas: {
                                  ...prev.taxasCustomizadas,
                                  [adq.id]: { ...(prev.taxasCustomizadas?.[adq.id] || adq.taxasPadrao), credito_parcelado_7_12: val }
                                }
                              }))
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="c360-input"
                            style={{ width: 70, fontSize: 12, padding: '4px 6px' }}
                            value={custom.pix ?? adq.taxasPadrao.pix}
                            onChange={e => {
                              const val = Number(e.target.value)
                              setTefConfig(prev => ({
                                ...prev,
                                taxasCustomizadas: {
                                  ...prev.taxasCustomizadas,
                                  [adq.id]: { ...(prev.taxasCustomizadas?.[adq.id] || adq.taxasPadrao), pix: val }
                                }
                              }))
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>
                          {adq.prazoLiquidacao.debito}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>
                          {adq.prazoLiquidacao.credito_avista}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 5: BANCOS & ADQUIRENTES HOMOLOGADOS */}
      {subAba === 'bancos_info' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700 }}>🌐 Catálogo de Bancos e Adquirentes Homologadas no Brasil</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Instituições financeiras nacionais homologadas no ERP Kytto para conciliação automática de extratos OFX, PIX e maquininhas TEF.
            </p>
          </div>

          {/* Bancos */}
          <div style={{ background: 'var(--card)', padding: 18, borderRadius: 12, border: '1px solid var(--line)' }}>
            <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>🌐 Bancos Brasileiros com Conciliação Completa</strong>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px 0' }}>
              Identificação automática de cabeçalhos OFX, código COMPE, extratos PIX e tarifas bancárias
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {bancosLista.map(b => (
                <div key={b.codigo} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', background: b.cor || '#0284C7', color: '#FFF', borderRadius: 4 }}>
                      CÓD {b.codigo}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>ISPB {b.ispb}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>{b.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{b.razaoSocial}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Adquirentes */}
          <div style={{ background: 'var(--card)', padding: 18, borderRadius: 12, border: '1px solid var(--line)' }}>
            <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>💳 Adquirentes, Maquininhas e Bandeiras Homologadas</strong>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px 0' }}>
              Comunicação com Pinpad, geração de comprovantes de transação com NSU, taxas MDR e agenda de liquidação
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {adquirentes.map(a => (
                <div key={a.id} style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--line)', display: 'grid', gap: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: a.cor || 'var(--text)' }}>{a.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.razaoSocial}</div>
                  <div style={{ fontSize: 11, background: 'var(--card)', padding: 8, borderRadius: 6, border: '1px solid var(--line)', marginTop: 4 }}>
                    <div><strong>Protocolo:</strong> {a.protocolo}</div>
                    <div style={{ marginTop: 4 }}><strong>Maquininhas:</strong> {a.modelosMaquininhas.join(', ')}</div>
                    <div style={{ marginTop: 4 }}><strong>Taxa Débito:</strong> {a.taxasPadrao.debito}% ({a.prazoLiquidacao.debito})</div>
                    <div><strong>Taxa Crédito:</strong> {a.taxasPadrao.credito_avista}% ({a.prazoLiquidacao.credito_avista})</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROVISIONAR NOVO TERMINAL PINPAD */}
      {modalNovoTerminal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <form onSubmit={handleSalvarNovoTerminal} style={{ background: 'var(--card)', padding: 22, borderRadius: 14, width: '100%', maxWidth: 480, border: '1px solid var(--line)', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>Provisionar Novo Terminal Pinpad</strong>
              <button type="button" className="c360-btn ghost" onClick={() => setModalNovoTerminal(false)}>✕</button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome de Identificação:</label>
              <input
                type="text"
                className="c360-input"
                style={{ width: '100%' }}
                placeholder="Ex: Pinpad Caixa 02 / Balcão Extra"
                value={formTerminal.nome}
                onChange={e => setFormTerminal(prev => ({ ...prev, nome: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Adquirente:</label>
                <select
                  className="c360-input"
                  style={{ width: '100%' }}
                  value={formTerminal.adquirenteId}
                  onChange={e => setFormTerminal(prev => ({ ...prev, adquirenteId: e.target.value }))}
                >
                  {adquirentes.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Modelo do Equipamento:</label>
                <input
                  type="text"
                  className="c360-input"
                  style={{ width: '100%' }}
                  value={formTerminal.modelo}
                  onChange={e => setFormTerminal(prev => ({ ...prev, modelo: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Número de Série (Serial):</label>
                <input
                  type="text"
                  className="c360-input"
                  style={{ width: '100%' }}
                  placeholder="STN-MT-50073-XX"
                  value={formTerminal.serialNumber}
                  onChange={e => setFormTerminal(prev => ({ ...prev, serialNumber: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Localização / Setor:</label>
                <input
                  type="text"
                  className="c360-input"
                  style={{ width: '100%' }}
                  placeholder="Caixa 2 / Bar"
                  value={formTerminal.localizacao}
                  onChange={e => setFormTerminal(prev => ({ ...prev, localizacao: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tipo de Conexão:</label>
                <select
                  className="c360-input"
                  style={{ width: '100%' }}
                  value={formTerminal.tipoConexao}
                  onChange={e => setFormTerminal(prev => ({ ...prev, tipoConexao: e.target.value }))}
                >
                  <option value="usb_tcp">USB / Serial + TCP</option>
                  <option value="tcp_ip">Rede TCP/IP Local</option>
                  <option value="wifi_cloud">Wi-Fi / Nuvem</option>
                  <option value="bluetooth_app">Bluetooth Mobile</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>IP / Porta ou Canal:</label>
                <input
                  type="text"
                  className="c360-input"
                  style={{ width: '100%' }}
                  value={formTerminal.ipPorta}
                  onChange={e => setFormTerminal(prev => ({ ...prev, ipPorta: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="c360-btn ghost" onClick={() => setModalNovoTerminal(false)}>Cancelar</button>
              <button type="submit" className="c360-btn primary">Provisionar Pinpad</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: COMPROVANTE TEF */}
      {modalComprovante && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--card)', padding: 20, borderRadius: 14, width: '100%', maxWidth: 440, border: '1px solid var(--line)', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>Comprovante TEF Autorizado</strong>
              <button type="button" className="c360-btn ghost" onClick={() => setModalComprovante(null)}>✕</button>
            </div>

            <div style={{ background: '#0F172A', color: '#F8FAFC', padding: 14, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 380, overflowY: 'auto' }}>
              {modalComprovante.comprovanteCliente}
              {'\n\n'}
              {modalComprovante.comprovanteEstabelecimento}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="c360-btn primary"
                onClick={() => {
                  window.print()
                }}
              >
                🖨️ Imprimir Térmica (80mm)
              </button>
              <button type="button" className="c360-btn ghost" onClick={() => setModalComprovante(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA CONTA BANCÁRIA */}
      {modalNovaConta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <form onSubmit={handleSalvarNovaConta} style={{ background: 'var(--card)', padding: 20, borderRadius: 14, width: '100%', maxWidth: 420, border: '1px solid var(--line)', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>Cadastrar Conta Bancária</strong>
              <button type="button" className="c360-btn ghost" onClick={() => setModalNovaConta(false)}>✕</button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome / Descrição da Conta:</label>
              <input
                type="text"
                className="c360-input"
                style={{ width: '100%' }}
                placeholder="Ex: Sicredi PJ Principal"
                value={formNovaConta.nome}
                onChange={e => setFormNovaConta(prev => ({ ...prev, nome: e.target.value }))}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Banco:</label>
              <select
                className="c360-input"
                style={{ width: '100%' }}
                value={formNovaConta.banco}
                onChange={e => setFormNovaConta(prev => ({ ...prev, banco: e.target.value }))}
              >
                {bancosLista.map(b => (
                  <option key={b.codigo} value={b.nome}>{b.nome} ({b.codigo})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Agência:</label>
                <input
                  type="text"
                  className="c360-input"
                  style={{ width: '100%' }}
                  placeholder="0812"
                  value={formNovaConta.agencia}
                  onChange={e => setFormNovaConta(prev => ({ ...prev, agencia: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Conta Corrente:</label>
                <input
                  type="text"
                  className="c360-input"
                  style={{ width: '100%' }}
                  placeholder="12345-6"
                  value={formNovaConta.conta}
                  onChange={e => setFormNovaConta(prev => ({ ...prev, conta: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="c360-btn ghost" onClick={() => setModalNovaConta(false)}>Cancelar</button>
              <button type="submit" className="c360-btn primary">Salvar Conta</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: LANÇAR CONTA A PARTIR DO EXTRATO */}
      {modalLancar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <form onSubmit={handleConfirmarLancamento} style={{ background: 'var(--card)', padding: 20, borderRadius: 14, width: '100%', maxWidth: 440, border: '1px solid var(--line)', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>Lançar no Financeiro e Conciliar</strong>
              <button type="button" className="c360-btn ghost" onClick={() => setModalLancar(null)}>✕</button>
            </div>

            <div style={{ background: 'var(--bg)', padding: 10, borderRadius: 8, fontSize: 12 }}>
              <div><strong>Data:</strong> {fmtData(modalLancar.linha.data)}</div>
              <div><strong>Valor:</strong> <span style={{ fontWeight: 700, color: Number(modalLancar.linha.valor) >= 0 ? '#10B981' : '#EF4444' }}>{fmtR(modalLancar.linha.valor)}</span></div>
              <div><strong>Original no Extrato:</strong> {modalLancar.linha.descricao}</div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Descrição do Lançamento:</label>
              <input
                type="text"
                className="c360-input"
                style={{ width: '100%' }}
                value={modalLancar.descricao}
                onChange={e => setModalLancar(prev => ({ ...prev, descricao: e.target.value }))}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tipo:</label>
              <select
                className="c360-input"
                style={{ width: '100%' }}
                value={modalLancar.tipo}
                onChange={e => setModalLancar(prev => ({ ...prev, tipo: e.target.value }))}
              >
                <option value="receita">Receita (Entrada)</option>
                <option value="despesa">Despesa (Saída)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="c360-btn ghost" onClick={() => setModalLancar(null)}>Cancelar</button>
              <button type="submit" className="c360-btn primary">Confirmar e Baixar Conta</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
