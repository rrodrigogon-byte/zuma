import React, { useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { DinoRoletaModal } from './DinoRoletaModal'
import { DinoMetasGamificacaoModalConfig } from './DinoMetasGamificacaoModalConfig'
import './DinoMetasRoletaPanel.css'

function fmtR(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataHojeIso() {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function DinoMetasRoletaPanel() {
  const { toast } = useToast()

  const [dataSel, setDataSel] = useState(dataHojeIso())
  const [carregando, setCarregando] = useState(true)
  const [dadosPainel, setDadosPainel] = useState(null)
  const [historico, setHistorico] = useState([])
  const [filtroHistorico, setFiltroHistorico] = useState('todos') // 'todos' | 'pendente_giro' | 'aguardando_entrega' | 'entregue'
  const [abaAtiva, setAbaAtiva] = useState('acompanhamento') // 'acompanhamento' | 'historico' | 'relatorio'

  // Modais
  const [modalConfigAberto, setModalConfigAberto] = useState(false)
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  const [modalRoletaAberto, setModalRoletaAberto] = useState(false)
  const [giroSelecionado, setGiroSelecionado] = useState(null)

  const [modalBonusAberto, setModalBonusAberto] = useState(false)
  const [formBonus, setFormBonus] = useState({ profissionalId: '', motivo: 'Destaque no atendimento e vendas' })
  const [salvandoBonus, setSalvandoBonus] = useState(false)

  async function carregarDados() {
    setCarregando(true)
    try {
      const resPainel = await api.get(`/api/admin/barbearia/gamificacao/painel?data=${dataSel}`)
      setDadosPainel(resPainel)

      const resHist = await api.get('/api/admin/barbearia/gamificacao/historico')
      setHistorico(resHist.historico || [])
    } catch (e) {
      toast(e.message || 'Erro ao carregar dados de metas e roleta', true)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [dataSel])

  async function salvarConfig(novaConfig) {
    setSalvandoConfig(true)
    try {
      await api.put('/api/admin/barbearia/gamificacao/config', novaConfig)
      toast('Metas e prêmios da roleta salvos com sucesso!')
      setModalConfigAberto(false)
      carregarDados()
    } catch (e) {
      toast(e.message || 'Erro ao salvar configuração', true)
    } finally {
      setSalvandoConfig(false)
    }
  }

  async function handleGiroConcluido({ giroId, premioNome, premioId }) {
    try {
      await api.post('/api/admin/barbearia/gamificacao/giros/executar', {
        giroId,
        premioNome,
        premioId,
      })
      toast(`🎉 Prêmio "${premioNome}" registrado para o profissional!`)
      carregarDados()
    } catch (e) {
      toast(e.message || 'Erro ao registrar giro da roleta', true)
    }
  }

  async function confirmarEntrega(giroId) {
    if (!window.confirm('Confirmar a entrega/pagamento deste prêmio ao profissional?')) return
    try {
      await api.patch(`/api/admin/barbearia/gamificacao/giros/${giroId}/entrega`, {})
      toast('Entrega de premiação confirmada com sucesso!')
      carregarDados()
    } catch (e) {
      toast(e.message || 'Erro ao confirmar entrega', true)
    }
  }

  async function concederBonus(e) {
    e.preventDefault()
    if (!formBonus.profissionalId) {
      toast('Selecione um profissional', true)
      return
    }
    setSalvandoBonus(true)
    try {
      const prof = (dadosPainel?.apuracao?.profissionais || []).find((p) => p.profissionalId === formBonus.profissionalId)
      await api.post('/api/admin/barbearia/gamificacao/giros/bonus', {
        profissionalId: formBonus.profissionalId,
        profissionalNome: prof?.nome || 'Profissional',
        motivo: formBonus.motivo,
      })
      toast('Giro bônus concedido com sucesso!')
      setModalBonusAberto(false)
      setFormBonus({ profissionalId: '', motivo: 'Destaque no atendimento e vendas' })
      carregarDados()
    } catch (err) {
      toast(err.message || 'Erro ao conceder bônus', true)
    } finally {
      setSalvandoBonus(false)
    }
  }

  function abrirRoletaParaProfissional(prof) {
    const giroPendente = prof.girosPendentes?.[0]
    if (giroPendente) {
      setGiroSelecionado(giroPendente)
      setModalRoletaAberto(true)
    } else {
      toast('Este profissional não possui giros pendentes no momento.', true)
    }
  }

  const config = dadosPainel?.config || {}
  const profissionais = dadosPainel?.apuracao?.profissionais || []
  const semana = dadosPainel?.apuracao?.semana || {}
  const resumoGiros = dadosPainel?.resumoGiros || {}

  const historicoFiltrado = historico.filter((item) => {
    if (filtroHistorico === 'pendente_giro') return item.status === 'pendente_giro'
    if (filtroHistorico === 'aguardando_entrega') return item.status === 'girado' && !item.entregueEm
    if (filtroHistorico === 'entregue') return item.status === 'entregue' || Boolean(item.entregueEm)
    return true
  })

  return (
    <div className="dino-metas-panel">
      {/* HEADER PRINCIPAL */}
      <header className="dino-metas-header">
        <div className="dino-metas-title-group">
          <h1>
            <span>🎯</span> Metas, Desafios & Roleta de Prêmios
          </h1>
          <p className="dino-metas-subtitle">
            Cadastre e altere metas diárias de serviços extras, metas semanais de produtos e controle os giros e entregas da roleta.
          </p>
        </div>

        <div className="dino-metas-actions">
          {/* Seletor de Data */}
          <div className="dino-date-picker-box">
            <span style={{ fontSize: 12, color: 'var(--muted, #64748b)', fontWeight: 600 }}>Dia:</span>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dataSel}
              onChange={(e) => setDataSel(e.target.value)}
              style={{ padding: '2px 8px', fontSize: 12, border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface, #ffffff)', color: 'var(--text, #0f172a)' }}
            />
            {dataSel !== dataHojeIso() && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => setDataSel(dataHojeIso())}
              >
                Hoje
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setModalBonusAberto(true)}
          >
            🎁 Conceder Giro Bônus
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setModalConfigAberto(true)}
          >
            ⚙️ Configurar Metas & Roleta
          </button>
        </div>
      </header>

      {/* BANNER DO DESAFIO SEMANAL */}
      {config.metasSemanais?.ativo && (
        <section className="dino-desafio-banner">
          <div>
            <div className="dino-desafio-badge">🔥 Desafio da Semana · {semana.rotulo || 'Esta Semana'}</div>
            <h3>{config.metasSemanais.tituloDesafio || 'Desafio Semanal de Vendas'}</h3>
            <p className="dino-desafio-desc">
              {config.metasSemanais.descricaoDesafio || 'Atinja a meta de produtos ou faturamento e ganhe prêmios exclusivos!'}
            </p>
            <div className="dino-desafio-metricas-grid">
              {config.metasSemanais.produtosQtd > 0 && (
                <span className="dino-desafio-metrica-pill">🧴 Meta Produtos: <strong>{config.metasSemanais.produtosQtd} un</strong></span>
              )}
              {config.metasSemanais.produtosValor > 0 && (
                <span className="dino-desafio-metrica-pill">💰 Valor Produtos: <strong>{fmtR(config.metasSemanais.produtosValor)}</strong></span>
              )}
              {config.metasSemanais.faturamentoValor > 0 && (
                <span className="dino-desafio-metrica-pill">💰 Meta Faturamento: <strong>{fmtR(config.metasSemanais.faturamentoValor)}</strong></span>
              )}
            </div>
          </div>

          <div className="dino-desafio-premiacao">
            <div className="dino-desafio-premio-label">Premiação do Desafio</div>
            <div className="dino-desafio-premio-val">
              {config.metasSemanais.premiacaoDesafio || 'Premiação Especial + Giros na Roleta'}
            </div>
          </div>
        </section>
      )}

      {/* CARDS RESUMO DAS REGRAS DIÁRIAS ATIVAS */}
      <section className="dino-regras-grid">
        <div className="dino-regra-card">
          <div className="dino-regra-icon">✂️</div>
          <div className="dino-regra-info">
            <h4>Serviços Extras Diários</h4>
            <p>
              Meta: <strong>{config.metasDiarias?.servicosExtrasQtd || 6} extras no dia</strong>
            </p>
            <span className="dino-regra-tag extras">
              Ganhe {config.metasDiarias?.servicosExtrasGiros || 1} Giro na Roleta
            </span>
          </div>
        </div>

        <div className="dino-regra-card">
          <div className="dino-regra-icon">🧴</div>
          <div className="dino-regra-info">
            <h4>Venda Diária de Produtos</h4>
            <p>
              Meta: <strong>{config.metasDiarias?.produtosQtd ?? 2} produtos vendidos no dia</strong>
            </p>
            <span className="dino-regra-tag produtos">
              Ganhe {config.metasDiarias?.produtosGiros || 1} Giro na Roleta
            </span>
          </div>
        </div>

        <div className="dino-regra-card">
          <div className="dino-regra-icon">🎡</div>
          <div className="dino-regra-info">
            <h4>Controle da Roleta</h4>
            <p>
              {resumoGiros.totalPendentesGiro || 0} giros pendentes · {resumoGiros.totalAguardandoEntrega || 0} aguardando entrega
            </p>
            <span className="dino-regra-tag roleta">
              {config.premiosRoleta?.length || 8} prêmios cadastrados
            </span>
          </div>
        </div>
      </section>

      {/* SUB-ABAS DE NAVEGAÇÃO */}
      <nav className="dino-metas-tabs">
        <button
          type="button"
          className={`dino-metas-tab-btn ${abaAtiva === 'acompanhamento' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('acompanhamento')}
        >
          🎯 Acompanhamento da Equipe
        </button>
        <button
          type="button"
          className={`dino-metas-tab-btn ${abaAtiva === 'historico' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('historico')}
        >
          📜 Giros & Entregas de Premiações ({historico.length})
        </button>
      </nav>

      {/* ABA 1: ACOMPANHAMENTO DA EQUIPE */}
      {abaAtiva === 'acompanhamento' && (
        <section>
          {carregando && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              Carregando dados dos profissionais e apuração das metas...
            </div>
          )}

          {!carregando && profissionais.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: 'var(--surface)', borderRadius: 16 }}>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                Nenhum profissional encontrado para a unidade ou empresa selecionada.
              </p>
            </div>
          )}

          {!carregando && profissionais.length > 0 && (
            <div className="dino-barbeiros-grid">
              {profissionais.map((prof) => {
                const temGiros = (prof.girosPendentes || []).length > 0
                const extrasProg = prof.dia.metaExtrasProgresso || 0
                const prodProg = prof.dia.metaProdutosProgresso || 0
                const desafioProg = prof.semana.progressoProdutos || 0

                return (
                  <article
                    key={prof.profissionalId}
                    className={`dino-barbeiro-card ${temGiros ? 'has-spins' : ''}`}
                  >
                    {/* Topo do Card */}
                    <div className="dino-barbeiro-top">
                      <div className="dino-barbeiro-perfil">
                        <div className="dino-barbeiro-avatar">
                          {prof.apelido?.slice(0, 2) || prof.nome?.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="dino-barbeiro-nome">{prof.nome}</h3>
                          <p className="dino-barbeiro-cargo">
                            {prof.dia.comandasAtendidas} atendimentos hoje
                          </p>
                        </div>
                      </div>

                      {temGiros && (
                        <div className="dino-spin-badge">
                          🎡 {prof.girosPendentes.length} {prof.girosPendentes.length > 1 ? 'Giros' : 'Giro'}!
                        </div>
                      )}
                    </div>

                    {/* Barras de Metas */}
                    <div className="dino-metas-track-list">
                      {/* Meta Diária: Serviços Extras */}
                      {config.metasDiarias?.servicosExtrasAtivo && (
                        <div className="dino-meta-item">
                          <div className="dino-meta-item-head">
                            <span className="dino-meta-label">
                              ✂️ Extras Hoje {prof.dia.metaExtrasAtingida && <span className="dino-meta-batida-badge">✓ BATEU A META!</span>}
                            </span>
                            <span className="dino-meta-values">
                              {prof.dia.servicosExtras} de {config.metasDiarias.servicosExtrasQtd} extras
                            </span>
                          </div>
                          <div className="dino-meta-prog-bar">
                            <div
                              className={`dino-meta-prog-fill extras ${prof.dia.metaExtrasAtingida ? 'batida' : ''}`}
                              style={{ width: `${extrasProg}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Meta Diária: Venda de Produtos */}
                      {config.metasDiarias?.produtosAtivo && (
                        <div className="dino-meta-item">
                          <div className="dino-meta-item-head">
                            <span className="dino-meta-label">
                              🧴 Produtos Hoje {prof.dia.metaProdutosAtingida && <span className="dino-meta-batida-badge">✓ BATEU A META!</span>}
                            </span>
                            <span className="dino-meta-values">
                              {prof.dia.produtosQtd || 0} de {config.metasDiarias?.produtosQtd ?? 2} produtos {prof.dia.produtosValor > 0 ? `(${fmtR(prof.dia.produtosValor)})` : ''}
                            </span>
                          </div>
                          <div className="dino-meta-prog-bar">
                            <div
                              className={`dino-meta-prog-fill produtos ${prof.dia.metaProdutosAtingida ? 'batida' : ''}`}
                              style={{ width: `${prodProg}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Desafio Semanal */}
                      {config.metasSemanais?.ativo && (
                        <div className="dino-meta-item">
                          <div className="dino-meta-item-head">
                            <span className="dino-meta-label">
                              🔥 Desafio Semanal {prof.semana.metaDesafioAtingida && <span className="dino-meta-batida-badge">✓ DESAFIO BATIDO!</span>}
                            </span>
                            <span className="dino-meta-values">
                              {fmtR(prof.semana.produtosValor)} ({prof.semana.produtosQtd} un)
                            </span>
                          </div>
                          <div className="dino-meta-prog-bar">
                            <div
                              className={`dino-meta-prog-fill desafio ${prof.semana.metaDesafioAtingida ? 'batida' : ''}`}
                              style={{ width: `${desafioProg}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rodapé do Card com Ação da Roleta ou Premiação */}
                    <footer className="dino-barbeiro-footer">
                      {temGiros && (
                        <button
                          type="button"
                          className="dino-btn-girar-roleta"
                          onClick={() => abrirRoletaParaProfissional(prof)}
                        >
                          🎡 GIRAR ROLETA ({prof.girosPendentes.length} disponível)
                        </button>
                      )}

                      {/* Prêmios aguardando entrega */}
                      {(prof.girosAguardandoEntrega || []).map((giro) => (
                        <div key={giro.id} className="dino-premio-ganho-card">
                          <div className="dino-premio-info">
                            <span className="dino-premio-nome">🎁 Ganhou: {giro.premioGanho}</span>
                            <span className="dino-premio-status">{giro.motivo}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => confirmarEntrega(giro.id)}
                          >
                            ✓ Entregar
                          </button>
                        </div>
                      ))}

                      {!temGiros && (prof.girosAguardandoEntrega || []).length === 0 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '4px 0' }}>
                          Faturamento semana: <strong>{fmtR(prof.semana.faturamentoTotal)}</strong> · {prof.semana.servicosTotal} serviços
                        </div>
                      )}
                    </footer>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ABA 2: HISTÓRICO DE GIROS E ENTREGAS */}
      {abaAtiva === 'historico' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filtros de Histórico */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Filtrar status:</span>
            <button
              type="button"
              className={`btn btn-sm ${filtroHistorico === 'todos' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltroHistorico('todos')}
            >
              Todos ({historico.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filtroHistorico === 'pendente_giro' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltroHistorico('pendente_giro')}
            >
              Aguardando Giro ({historico.filter((h) => h.status === 'pendente_giro').length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filtroHistorico === 'aguardando_entrega' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltroHistorico('aguardando_entrega')}
            >
              Pendente de Entrega ({historico.filter((h) => h.status === 'girado' && !h.entregueEm).length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filtroHistorico === 'entregue' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltroHistorico('entregue')}
            >
              Entregues ({historico.filter((h) => h.status === 'entregue' || h.entregueEm).length})
            </button>
          </div>

          <div className="dino-historico-table-wrap">
            <table className="dino-historico-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Profissional</th>
                  <th>Origem / Motivo da Meta</th>
                  <th>Prêmio Conquistado</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {historicoFiltrado.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                      Nenhum registro de giro ou premiação encontrado neste filtro.
                    </td>
                  </tr>
                )}
                {historicoFiltrado.map((h) => (
                  <tr key={h.id}>
                    <td>{h.dataReferencia || (h.criadoEm || '').slice(0, 10)}</td>
                    <td>
                      <strong>{h.profissionalNome}</strong>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{h.motivo}</div>
                      {h.concedidoPor && (
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Bônus por: {h.concedidoPor}</div>
                      )}
                    </td>
                    <td>
                      {h.premioGanho ? (
                        <strong style={{ color: '#10b981' }}>{h.premioGanho}</strong>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>Ainda não girou</span>
                      )}
                    </td>
                    <td>
                      {h.status === 'pendente_giro' && (
                        <span className="dino-status-pill pendente">Aguardando Giro</span>
                      )}
                      {h.status === 'girado' && !h.entregueEm && (
                        <span className="dino-status-pill girado">Aguardando Entrega</span>
                      )}
                      {(h.status === 'entregue' || h.entregueEm) && (
                        <span className="dino-status-pill entregue">
                          Entregue ✓ {h.entreguePor ? `por ${h.entreguePor}` : ''}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {h.status === 'pendente_giro' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setGiroSelecionado(h)
                            setModalRoletaAberto(true)
                          }}
                        >
                          🎡 Girar
                        </button>
                      )}
                      {h.status === 'girado' && !h.entregueEm && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.4)' }}
                          onClick={() => confirmarEntrega(h.id)}
                        >
                          ✓ Confirmar Entrega
                        </button>
                      )}
                      {(h.status === 'entregue' || h.entregueEm) && (
                        <span style={{ fontSize: 11, color: '#10b981' }}>Concluído</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL DE ROLETA DA SORTE */}
      <DinoRoletaModal
        open={modalRoletaAberto}
        onClose={() => setModalRoletaAberto(false)}
        giro={giroSelecionado}
        premios={config.premiosRoleta || []}
        onGiroConcluido={handleGiroConcluido}
      />

      {/* MODAL DE CONFIGURAÇÃO AUTÔNOMA DAS METAS */}
      <DinoMetasGamificacaoModalConfig
        open={modalConfigAberto}
        onClose={() => setModalConfigAberto(false)}
        configAtual={config}
        onSalvar={salvarConfig}
        salvando={salvandoConfig}
      />

      {/* MODAL DE GIRO BÔNUS */}
      {modalBonusAberto && (
        <div className="dino-roleta-modal-backdrop" onClick={() => setModalBonusAberto(false)}>
          <div className="dino-roleta-modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <header className="dino-roleta-header">
              <div>
                <span className="dino-roleta-badge">🎁 Reconhecimento & Mérito</span>
                <h2>Conceder Giro Bônus</h2>
                <p className="dino-roleta-motivo">Presenteie um profissional com um giro extra na roleta.</p>
              </div>
              <button type="button" className="dino-roleta-close-btn" onClick={() => setModalBonusAberto(false)}>
                ✕
              </button>
            </header>

            <form onSubmit={concederBonus} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600 }}>Profissional *</label>
                <select
                  className="form-control"
                  value={formBonus.profissionalId}
                  onChange={(e) => setFormBonus({ ...formBonus, profissionalId: e.target.value })}
                  required
                >
                  <option value="">Selecione o profissional...</option>
                  {profissionais.map((p) => (
                    <option key={p.profissionalId} value={p.profissionalId}>
                      {p.nome} ({p.apelido})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600 }}>Motivo do Bônus</label>
                <input
                  type="text"
                  className="form-control"
                  value={formBonus.motivo}
                  onChange={(e) => setFormBonus({ ...formBonus, motivo: e.target.value })}
                  placeholder="Ex.: Elogio de cliente, recorde de vendas no dia"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setModalBonusAberto(false)}
                  disabled={salvandoBonus}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvandoBonus}>
                  {salvandoBonus ? 'Salvando...' : 'Conceder Giro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default DinoMetasRoletaPanel
