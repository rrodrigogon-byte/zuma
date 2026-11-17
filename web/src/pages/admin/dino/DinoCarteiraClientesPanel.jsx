import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '../../../lib/api'
import { Scissors, Users, Clock, MessageSquare, AlertCircle, RefreshCw, UserCheck, PhoneCall, ChevronRight, ExternalLink } from 'lucide-react'
import { refHistoricoCliente, urlHistoricoCliente, abrirHistoricoEmNovaGuia } from './historico-cliente'
import './DinoCarteiraClientesPanel.css'

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—')

export default function DinoCarteiraClientesPanel({ onNovoCliente }) {
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState(null)
  const [clientes, setClientes] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [barbeiroSelecionadoId, setBarbeiroSelecionadoId] = useState('') // '' = todos
  const [filtroRetorno, setFiltroRetorno] = useState('todos')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [modalReatribuir, setModalReatribuir] = useState(null) // { cliente, novoBarbeiroId }
  const [salvandoVinculo, setSalvandoVinculo] = useState(false)
  const [unificando, setUnificando] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => { setBuscaDebounced(busca) }, 350)
    return () => clearTimeout(timer)
  }, [busca])

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const [resResumo, resLista] = await Promise.all([
        api.get('/api/admin/barbearia/carteira-clientes/resumo'),
        api.get(`/api/admin/barbearia/carteira-clientes?profissionalId=${encodeURIComponent(barbeiroSelecionadoId)}&filtroRetorno=${encodeURIComponent(filtroRetorno)}&busca=${encodeURIComponent(buscaDebounced)}`),
      ])
      setResumo(resResumo)
      setClientes(resLista.clientes || [])
      setProfissionais(resLista.profissionais || [])
    } catch (err) {
      console.error('Erro ao carregar carteiras:', err)
    } finally {
      setLoading(false)
    }
  }, [barbeiroSelecionadoId, filtroRetorno, buscaDebounced])



  const autoUnificarDuplicados = useCallback(async () => {
    const confirmou = window.confirm(
      "Deseja iniciar a varredura e unificação inteligente de cadastros duplicados da barbearia?\n\n" +
      "O sistema irá localizar cadastros com o mesmo celular (com ou sem código 55), histórico comum ou nomes idênticos, consolidando comandas, assinaturas e histórico sob o cadastro principal sem perda de informações fiscais."
    )
    if (!confirmou) return
    setUnificando(true)
    try {
      const res = await api.post('/api/admin/barbearia/clientes/auto-unificar')
      alert(`Varredura concluída! ${res.gruposUnificados || 0} grupo(s) de clientes duplicados foram unificados com sucesso.`)
      carregarDados()
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Falha na unificação automática.")
    } finally {
      setUnificando(false)
    }
  }, [carregarDados])


  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Barbeiro ativo atualmente
  const barbeiroAtivo = useMemo(() => {
    if (!barbeiroSelecionadoId) return null
    return profissionais.find((p) => p.id === barbeiroSelecionadoId) || null
  }, [barbeiroSelecionadoId, profissionais])

  // KPIs da carteira selecionada
  const kpisCarteira = useMemo(() => {
    if (!resumo) {
      return { total: 0, emDia: 0, idealRetorno: 0, atrasados: 0, sumidos: 0, faturamento: 0 }
    }
    if (barbeiroSelecionadoId) {
      const bResumo = (resumo.carteiras || []).find((c) => c.profissionalId === barbeiroSelecionadoId)
      if (bResumo) {
        return {
          total: bResumo.totalClientes,
          emDia: bResumo.emDia,
          idealRetorno: bResumo.idealRetorno,
          atrasados: bResumo.atrasados,
          sumidos: bResumo.sumidos,
          faturamento: bResumo.faturamentoTotal,
        }
      }
    }
    // Visão Geral (Soma de todos)
    const total = resumo.totalGeralClientes || 0
    let emDia = 0, idealRetorno = 0, atrasados = 0, sumidos = 0, faturamento = 0
    for (const c of resumo.carteiras || []) {
      emDia += c.emDia || 0
      idealRetorno += c.idealRetorno || 0
      atrasados += c.atrasados || 0
      sumidos += c.sumidos || 0
      faturamento += c.faturamentoTotal || 0
    }
    return { total, emDia, idealRetorno, atrasados, sumidos, faturamento }
  }, [resumo, barbeiroSelecionadoId])

  async function handleVincularBarbeiro(e) {
    e.preventDefault()
    if (!modalReatribuir || !modalReatribuir.novoBarbeiroId) return
    setSalvandoVinculo(true)
    try {
      const profEscolhido = profissionais.find((p) => p.id === modalReatribuir.novoBarbeiroId)
      await api.patch(`/api/admin/barbearia/clientes/${modalReatribuir.cliente.clienteId}/vincular-barbeiro`, {
        profissionalId: modalReatribuir.novoBarbeiroId,
        profissionalNome: profEscolhido?.nome || '',
      })
      setModalReatribuir(null)
      await carregarDados()
    } catch (err) {
      alert('Erro ao vincular barbeiro: ' + (err.message || 'tente novamente.'))
    } finally {
      setSalvandoVinculo(false)
    }
  }

  function gerarLinkWhatsapp(cliente) {
    const tel = String(cliente.telefone || '').replace(/\D/g, '')
    if (tel.length < 10) return '#'
    const telCompleto = tel.startsWith('55') ? tel : `55${tel}`
    const primeiroNome = String(cliente.nome || '').trim().split(/\s+/)[0] || 'amigo'
    const barbeiroNome = cliente.barbeiroApelido || cliente.barbeiroNome?.split(' ')[0] || 'Dino'
    const servico = cliente.servicoFavorito || 'corte'
    const dias = cliente.diasSemRetorno

    const tempoFrase = dias > 0 ? `já faz ${dias} dias do seu último ${servico}` : `está na hora de renovar o visual`
    const msg = encodeURIComponent(
      `Fala ${primeiroNome}, tudo bem? Aqui é o ${barbeiroNome} da Barbearia Dino! 💈\n\nVi aqui que ${tempoFrase}. Vamos dar aquele talento no visual essa semana?\n\nJá separei sua cadeira! Pode me avisar por aqui ou escolher o melhor horário no link: https://kytto.com.br/clube-vip`
    )
    return `https://wa.me/${telCompleto}?text=${msg}`
  }

  return (
    <div className="carteira-container">
      {/* CABEÇALHO E SELETOR DE BARBEIROS */}
      <div className="carteira-header-card">
        <div className="carteira-title-row">
          <div>
            <div className="carteira-kicker">Relacionamento & Fidelização</div>
            <h2 className="carteira-h2">
              <Users size={26} color="#f59e0b" />
              Carteira de Clientes por Profissional
            </h2>
            <p className="carteira-sub">
              Acompanhe a base exclusiva de clientes de cada barbeiro (Dino, Nat, Bruno, David e equipe).
              Identifique clientes que estão na hora de voltar e reative o contato com mensagens diretas pelo WhatsApp.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="carteira-prof-pill"
              style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', color: '#10b981', fontWeight: 600 }}
              onClick={autoUnificarDuplicados}
              disabled={unificando}
              title="Detectar e unificar automaticamente clientes duplicados com e sem DDI 55"
            >
              <Users size={14} />
              {unificando ? 'Unificando…' : 'Unificar Duplicados'}
            </button>
            <button
              type="button"
              className="carteira-prof-pill"
              onClick={carregarDados}
              title="Recarregar dados"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Atualizar
            </button>
            {onNovoCliente && (
              <button
                type="button"
                className="carteira-prof-pill active"
                onClick={onNovoCliente}
              >
                + Novo Cliente
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE SELEÇÃO DE BARBEIROS */}
        <div className="carteira-profs-bar">
          <button
            type="button"
            className={`carteira-prof-pill ${barbeiroSelecionadoId === '' ? 'active' : ''}`}
            onClick={() => setBarbeiroSelecionadoId('')}
          >
            <div className="carteira-prof-avatar">👥</div>
            <span>Todos os Barbeiros</span>
            <span className="carteira-count-badge">{resumo?.totalGeralClientes || 0}</span>
          </button>

          {(resumo?.carteiras || []).map((b) => (
            <button
              key={b.profissionalId}
              type="button"
              className={`carteira-prof-pill ${barbeiroSelecionadoId === b.profissionalId ? 'active' : ''}`}
              onClick={() => setBarbeiroSelecionadoId(b.profissionalId)}
            >
              <div className="carteira-prof-avatar">
                {b.profissionalApelido ? b.profissionalApelido.slice(0, 2).toUpperCase() : '💈'}
              </div>
              <span>{b.profissionalApelido || b.profissionalNome}</span>
              <span className="carteira-count-badge">{b.totalClientes}</span>
            </button>
          ))}
        </div>

        {/* INDICADORES DA CARTEIRA SELECIONADA */}
        <div className="carteira-kpis-grid">
          <div className="carteira-kpi-card">
            <span className="carteira-kpi-label">Carteira Ativa</span>
            <span className="carteira-kpi-val" style={{ color: '#38bdf8' }}>{kpisCarteira.total}</span>
            <span className="carteira-kpi-sub">
              {barbeiroAtivo ? `Clientes do ${barbeiroAtivo.nome}` : 'Base total de clientes'}
            </span>
          </div>

          <div className="carteira-kpi-card">
            <span className="carteira-kpi-label">🟢 Em dia (&le; 15 dias)</span>
            <span className="carteira-kpi-val" style={{ color: '#34d399' }}>{kpisCarteira.emDia}</span>
            <span className="carteira-kpi-sub">Visitaram recentemente</span>
          </div>

          <div className="carteira-kpi-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
            <span className="carteira-kpi-label">🟡 Hora de Voltar (16 a 30d)</span>
            <span className="carteira-kpi-val" style={{ color: '#fbbf24' }}>{kpisCarteira.idealRetorno}</span>
            <span className="carteira-kpi-sub">Momento ideal para retorno</span>
          </div>

          <div className="carteira-kpi-card">
            <span className="carteira-kpi-label">🔴 Em Atraso (&gt; 30 dias)</span>
            <span className="carteira-kpi-val" style={{ color: '#f87171' }}>{kpisCarteira.atrasados + kpisCarteira.sumidos}</span>
            <span className="carteira-kpi-sub">Risco de perda / Reativação</span>
          </div>

          <div className="carteira-kpi-card">
            <span className="carteira-kpi-label">Faturamento Acumulado</span>
            <span className="carteira-kpi-val" style={{ color: '#f59e0b', fontSize: 22 }}>
              {moeda(kpisCarteira.faturamento)}
            </span>
            <span className="carteira-kpi-sub">Total gerado pelos clientes</span>
          </div>
        </div>

        {/* FILTROS E BUSCA */}
        <div className="carteira-actions-row">
          <div className="carteira-search-box">
            <input
              type="text"
              className="carteira-input"
              placeholder="Buscar cliente por nome ou telefone…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <select
              className="carteira-select"
              value={filtroRetorno}
              onChange={(e) => setFiltroRetorno(e.target.value)}
            >
              <option value="todos">Todos os status de retorno</option>
              <option value="ideal_retorno">🟡 Hora de Voltar (16 a 30 dias)</option>
              <option value="atrasado">🔴 Em Atraso (31 a 60 dias)</option>
              <option value="sumido">⚠️ Sumidos (&gt; 60 dias)</option>
              <option value="em_dia">🟢 Em Dia (&le; 15 dias)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE CLIENTES DA CARTEIRA */}
      <div className="carteira-table-wrap">
        <table className="carteira-table">
          <thead>
            <tr>
              <th className="carteira-th">Cliente</th>
              <th className="carteira-th">Barbeiro Titular</th>
              <th className="carteira-th">Última Visita</th>
              <th className="carteira-th">Status de Retorno</th>
              <th className="carteira-th">Atendimentos</th>
              <th className="carteira-th">Ação de Relacionamento</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Carregando carteira de clientes…
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Nenhum cliente encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              clientes.map((c) => {
                const linkWpp = gerarLinkWhatsapp(c)
                const urlHistorico = urlHistoricoCliente(refHistoricoCliente(c))
                return (
                  <tr key={c.clienteId} className="carteira-row">
                    <td className="carteira-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <a
                          href={urlHistorico}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="carteira-cliente-link"
                          title="Abrir ficha completa 360° e histórico do cliente em nova guia"
                        >
                          <span className="carteira-cliente-nome">{c.nome}</span>
                          <ExternalLink size={13} className="carteira-link-icon" />
                        </a>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{c.telefone || 'Sem telefone'}</div>
                    </td>

                    <td className="carteira-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                          {c.barbeiroApelido || c.barbeiroNome || 'Sem barbeiro'}
                        </span>
                        {c.barbeiroFonte === 'manual' ? (
                          <span style={{ fontSize: 10, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                            Fixado
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', padding: '1px 6px', borderRadius: 4 }}>
                            Habitual
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn-vincular-barbeiro"
                          onClick={() => setModalReatribuir({ cliente: c, novoBarbeiroId: c.barbeiroId || '' })}
                          title="Alterar barbeiro responsável"
                        >
                          <Scissors size={12} />
                          Trocar
                        </button>
                      </div>
                    </td>

                    <td className="carteira-td">
                      <div style={{ fontWeight: 600 }}>{dataBR(c.ultimaVisita)}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{c.servicoFavorito || 'Serviço'}</div>
                    </td>

                    <td className="carteira-td">
                      <span className={`retorno-badge retorno-${c.statusRetorno}`}>
                        {c.statusRetorno === 'em_dia' && '🟢 Em dia'}
                        {c.statusRetorno === 'ideal_retorno' && `🟡 Voltar (${c.diasSemRetorno}d)`}
                        {c.statusRetorno === 'atrasado' && `🔴 Atrasado (${c.diasSemRetorno}d)`}
                        {c.statusRetorno === 'sumido' && `⚠️ Sumido (${c.diasSemRetorno}d)`}
                      </span>
                    </td>

                    <td className="carteira-td">
                      <div style={{ fontWeight: 700 }}>{c.totalAtendimentosComBarbeiro} visita(s)</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{moeda(c.totalGastoComBarbeiro)}</div>
                    </td>

                    <td className="carteira-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <a
                          href={urlHistorico}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ficha-carteira"
                          title="Abrir ficha completa 360° com histórico de atendimentos, consumos, preferências e dados do cliente em nova guia"
                        >
                          <ExternalLink size={13} />
                          Ficha 360°
                        </a>
                        {linkWpp !== '#' ? (
                          <a
                            href={linkWpp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-whatsapp-carteira"
                            title="Enviar mensagem personalizada pelo WhatsApp"
                          >
                            <MessageSquare size={13} />
                            WhatsApp
                          </a>
                        ) : (
                          <span style={{ fontSize: 12, color: '#64748b' }}>Sem WhatsApp</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL PARA REATRIBUIR BARBEIRO DA CARTEIRA */}
      {modalReatribuir && (
        <div className="modal-overlay-carteira" onClick={() => setModalReatribuir(null)}>
          <div className="modal-content-carteira" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-carteira">
              <h3 className="modal-title-carteira">
                <UserCheck size={20} color="#f59e0b" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Vincular Cliente a um Barbeiro
              </h3>
              <button
                type="button"
                onClick={() => setModalReatribuir(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVincularBarbeiro} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 700 }}>
                  Cliente
                </label>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                  {modalReatribuir.cliente.nome}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {modalReatribuir.cliente.telefone}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 700 }}>
                  Barbeiro Responsável pela Carteira
                </label>
                <select
                  required
                  className="carteira-select"
                  style={{ width: '100%' }}
                  value={modalReatribuir.novoBarbeiroId}
                  onChange={(e) => setModalReatribuir({ ...modalReatribuir, novoBarbeiroId: e.target.value })}
                >
                  <option value="">Selecione o profissional…</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.apelido || p.nome.split(' ')[0]})
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
                  Ao fixar o barbeiro, todas as notificações de retorno e campanhas personalizadas levarão o nome deste profissional.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="carteira-prof-pill"
                  onClick={() => setModalReatribuir(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="carteira-prof-pill active"
                  disabled={salvandoVinculo}
                >
                  {salvandoVinculo ? 'Salvando…' : 'Salvar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
