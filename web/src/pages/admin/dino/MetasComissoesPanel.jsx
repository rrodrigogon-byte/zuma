// KYTTO — Painel de Controle de Metas, Comissões, Bonificações e Produtividade Individual.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../../lib/api'

const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }
const h2 = { margin: 0, fontSize: 20, fontFamily: 'var(--font-display)' }
const h3 = { margin: 0, fontSize: 16 }
const sub = { margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '9px 12px', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }
const td = { padding: '10px 12px', borderBottom: '1px solid var(--line)', verticalAlign: 'middle' }
const btn = { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .15s' }
const btnPrimary = { ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
const btnActive = { ...btn, background: 'color-mix(in srgb, var(--accent) 18%, transparent)', borderColor: 'var(--accent)', color: 'var(--accent)' }
const input = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit', fontSize: 13, minWidth: 0 }
const kpi = { background: 'var(--card2, var(--card))', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }
const kpiLabel = { fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }
const kpiValue = { fontSize: 22, fontWeight: 800, marginTop: 6, fontFamily: 'var(--font-display)' }
const grid = (min = 160) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 12 })
const empty = { padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }

const ok = '#14b87a'
const alerta = '#f59e0b'
const moeda = (v) => fmtR(Number(v || 0))
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—')

export function MetasComissoesPanel({ onOpenTab }) {
  const [profissionais, setProfissionais] = useState([])
  const [profissionalId, setProfissionalId] = useState('') // '' = Equipe inteira
  const [buscaNome, setBuscaNome] = useState('')
  const [periodoTipo, setPeriodoTipo] = useState('tudo') // 'tudo' | 'mes' | 'quinzena' | 'semana' | 'dia' | 'custom'
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [abaRelatorio, setAbaRelatorio] = useState('faturamento') // 'faturamento' | 'servicos' | 'planos' | 'extras' | 'produtos' | 'extrato'

  const [relatorioIndividual, setRelatorioIndividual] = useState(null)
  const [relatorioEquipe, setRelatorioEquipe] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // Modal de edição de metas do profissional
  const [modalMetasAberto, setModalMetasAberto] = useState(false)
  const [formMetas, setFormMetas] = useState({
    percentualComissao: 40,
    percentualComissaoProduto: 10,
    faixasComissaoServico: [],
    faixasComissaoProduto: [],
  })
  const [salvandoMetas, setSalvandoMetas] = useState(false)

  // Carrega catálogo de profissionais
  const carregarProfissionais = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/barbearia/profissionais?incluirInativos=false')
      const lista = res?.profissionais || []
      setProfissionais(lista)
      if (lista.length > 0 && !profissionalId) {
        // Pré-seleciona primeiro profissional ativo ou mantém equipe
      }
    } catch (e) {
      console.error('Erro ao carregar profissionais:', e)
    }
  }, [profissionalId])

  useEffect(() => {
    carregarProfissionais()
  }, [carregarProfissionais])

  // Carrega dados do relatório de acordo com período e profissional selecionado
  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const queryParams = new URLSearchParams()
      queryParams.set('periodo', periodoTipo)
      if (periodoTipo === 'custom') {
        if (customInicio) queryParams.set('inicio', customInicio)
        if (customFim) queryParams.set('fim', customFim)
      }

      if (profissionalId) {
        // Relatório individual
        const res = await api.get(`/api/admin/barbearia/profissionais/${encodeURIComponent(profissionalId)}/relatorio-individual?${queryParams.toString()}`)
        setRelatorioIndividual(res?.relatorio || null)
        setRelatorioEquipe(null)
      } else {
        // Relatório da equipe inteira
        const res = await api.get(`/api/admin/barbearia/equipe/metas-comissoes?${queryParams.toString()}`)
        setRelatorioEquipe(res || null)
        setRelatorioIndividual(null)
      }
    } catch (e) {
      setErro(e?.message || 'Erro ao carregar dados de metas e comissões.')
    } finally {
      setCarregando(false)
    }
  }, [profissionalId, periodoTipo, customInicio, customFim])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Abre modal de configuração de metas
  const abrirModalMetas = (prof) => {
    const alvo = prof || relatorioIndividual?.profissional
    if (!alvo) return
    setFormMetas({
      percentualComissao: Number(alvo.percentualComissaoServico ?? alvo.percentualComissao ?? 40),
      percentualComissaoProduto: Number(alvo.percentualComissaoProduto ?? 10),
      faixasComissaoServico: Array.isArray(alvo.faixasComissaoServico) ? [...alvo.faixasComissaoServico] : [],
      faixasComissaoProduto: Array.isArray(alvo.faixasComissaoProduto) ? [...alvo.faixasComissaoProduto] : [],
    })
    setModalMetasAberto(true)
  }

  // Salva metas e bonificações no cadastro do barbeiro
  const salvarMetasProfissional = async (e) => {
    e.preventDefault()
    const id = profissionalId || relatorioIndividual?.profissional?.id
    if (!id) return
    setSalvandoMetas(true)
    try {
      await api.put(`/api/admin/barbearia/profissionais/${encodeURIComponent(id)}/metas-comissoes`, formMetas)
      setModalMetasAberto(false)
      await carregarProfissionais()
      await carregarDados()
    } catch (err) {
      alert(err?.message || 'Erro ao salvar metas.')
    } finally {
      setSalvandoMetas(false)
    }
  }

  // Profissionais filtrados pela busca
  const profissionaisFiltrados = useMemo(() => {
    if (!buscaNome) return profissionais
    const q = buscaNome.toLowerCase()
    return profissionais.filter((p) => p.nome.toLowerCase().includes(q) || (p.especialidade && p.especialidade.toLowerCase().includes(q)))
  }, [profissionais, buscaNome])

  // Helpers para manipular faixas no formulário
  const adicionarFaixaServico = () => {
    setFormMetas((atual) => ({
      ...atual,
      faixasComissaoServico: [
        ...atual.faixasComissaoServico,
        { metaFaturamento: 10000, bonusPercentual: 5, descricao: `Meta (${(Number(atual.percentualComissao) || 40) + 5}%)` },
      ],
    }))
  }

  const removerFaixaServico = (index) => {
    setFormMetas((atual) => ({
      ...atual,
      faixasComissaoServico: atual.faixasComissaoServico.filter((_, i) => i !== index),
    }))
  }

  const adicionarFaixaProduto = () => {
    setFormMetas((atual) => ({
      ...atual,
      faixasComissaoProduto: [
        ...atual.faixasComissaoProduto,
        { metaFaturamento: 1000, bonusPercentual: 2, descricao: `Meta Prod (${(Number(atual.percentualComissaoProduto) || 10) + 2}%)` },
      ],
    }))
  }

  const removerFaixaProduto = (index) => {
    setFormMetas((atual) => ({
      ...atual,
      faixasComissaoProduto: atual.faixasComissaoProduto.filter((_, i) => i !== index),
    }))
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ── BARRA SUPERIOR: PERÍODO E TÍTULO ─────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={h2}>Metas, Comissões e Bonificações</h2>
            <p style={sub}>Controle de metas progressivas individuais, bonificações automáticas por faturamento e relatórios de produtividade.</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={periodoTipo === 'tudo' ? btnActive : btn} onClick={() => setPeriodoTipo('tudo')}>Todo o Histórico</button>
            <button type="button" style={periodoTipo === 'mes' ? btnActive : btn} onClick={() => setPeriodoTipo('mes')}>Este Mês</button>
            <button type="button" style={periodoTipo === 'quinzena' ? btnActive : btn} onClick={() => setPeriodoTipo('quinzena')}>Esta Quinzena</button>
            <button type="button" style={periodoTipo === 'semana' ? btnActive : btn} onClick={() => setPeriodoTipo('semana')}>Esta Semana</button>
            <button type="button" style={periodoTipo === 'dia' ? btnActive : btn} onClick={() => setPeriodoTipo('dia')}>Hoje (Dia)</button>
            <button type="button" style={periodoTipo === 'custom' ? btnActive : btn} onClick={() => setPeriodoTipo('custom')}>Personalizado</button>
            <button type="button" style={btn} onClick={() => window.print()} title="Imprimir relatório">🖨 Imprimir</button>
          </div>
        </div>

        {periodoTipo === 'custom' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--card2)', borderRadius: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Intervalo:</span>
            <input type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)} style={input} />
            <span style={{ color: 'var(--muted)' }}>até</span>
            <input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} style={input} />
            <button type="button" style={btnPrimary} onClick={carregarDados}>Aplicar</button>
          </div>
        )}
      </div>

      {/* ── SELETOR DE PROFISSIONAL (BUSCA E CHIPS) ────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 260px' }}>
            <input
              type="text"
              placeholder="🔍 Pesquisar barbeiro (ex: Naty, Bruno, Dino)..."
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
              style={{ ...input, width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={!profissionalId ? btnPrimary : btn}
              onClick={() => setProfissionalId('')}
            >
              ★ Toda a Equipe ({profissionais.length})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
          {profissionaisFiltrados.map((p) => {
            const ativo = profissionalId === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProfissionalId(p.id)}
                style={{
                  ...btn,
                  padding: '6px 12px',
                  borderRadius: 20,
                  background: ativo ? 'var(--accent)' : 'var(--card2)',
                  borderColor: ativo ? 'var(--accent)' : 'var(--line)',
                  color: ativo ? '#fff' : 'var(--fg)',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.fotoUrl ? (
                  <img src={p.fotoUrl} alt={p.nome} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'color-mix(in srgb, currentColor 20%, transparent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                    {p.nome.slice(0, 1)}
                  </span>
                )}
                <span>{p.nome}</span>
                <span style={{ opacity: 0.75, fontSize: 11 }}>({p.percentualComissao || 40}%)</span>
              </button>
            )
          })}
        </div>
      </div>

      {erro && (
        <div style={{ ...card, background: '#fee2e2', borderColor: '#f87171', color: '#991b1b' }}>
          <strong>Erro:</strong> {erro}
        </div>
      )}

      {carregando ? (
        <div style={card}><div style={empty}>Carregando metas e dados de produção…</div></div>
      ) : profissionalId && relatorioIndividual ? (
        /* ── VISÃO INDIVIDUAL DO PROFISSIONAL ──────────────────────────── */
        <>
          {/* CABEÇALHO DO PROFISSIONAL & CONFIGURAR METAS */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, border: '2px solid var(--accent)' }}>
                  {relatorioIndividual.profissional.fotoUrl ? (
                    <img src={relatorioIndividual.profissional.fotoUrl} alt={relatorioIndividual.profissional.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    relatorioIndividual.profissional.nome.slice(0, 1)
                  )}
                </div>
                <div>
                  <h3 style={{ ...h3, fontSize: 20 }}>{relatorioIndividual.profissional.nome}</h3>
                  <div style={sub}>
                    {relatorioIndividual.profissional.especialidade} · {relatorioIndividual.profissional.tipo} · {relatorioIndividual.periodo?.label}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={btnPrimary}
                  onClick={() => abrirModalMetas(relatorioIndividual.profissional)}
                >
                  ⚙ Cadastrar / Ajustar Metas deste Barbeiro
                </button>
              </div>
            </div>
          </div>

          {/* CARDS DE METAS EM TEMPO REAL: SERVIÇOS & PRODUTOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 14 }}>
            {/* CARD METAS DE SERVIÇOS */}
            {(() => {
              const ms = relatorioIndividual.metasEvolucao?.servicos || {}
              const temFaixas = ms.todasFaixas && ms.todasFaixas.length > 0
              return (
                <div style={{ ...card, borderTop: '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={kpiLabel}>Metas de Faturamento em Serviços</span>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                        {moeda(ms.faturamento)} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>faturados</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, background: ms.bonusPercentual > 0 ? ok : 'var(--card2)', color: ms.bonusPercentual > 0 ? '#fff' : 'var(--fg)', fontSize: 13, fontWeight: 800 }}>
                        {ms.percentualEfetivo}% de comissão
                      </span>
                      {ms.bonusPercentual > 0 && (
                        <div style={{ fontSize: 11, color: ok, fontWeight: 700, marginTop: 2 }}>
                          +{ms.bonusPercentual}% de bônus atingido!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>
                        {ms.faixaAtual ? ms.faixaAtual.descricao : `Base: ${ms.percentualBase}%`}
                      </span>
                      <span style={{ fontWeight: 700 }}>
                        {ms.proximaFaixa ? `Próxima: ${moeda(ms.proximaFaixa.metaFaturamento)} (${ms.percentualBase + ms.proximaFaixa.bonusPercentual}%)` : 'Teto Máximo Atingido!'}
                      </span>
                    </div>
                    <div style={{ height: 10, background: 'var(--line)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${ms.progressoPct || 0}%`, background: ms.proximaFaixa ? 'var(--accent)' : ok, borderRadius: 5, transition: 'width .3s' }} />
                    </div>
                  </div>

                  {/* Frase em tempo real */}
                  <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--card2)', borderRadius: 10, fontSize: 13, borderLeft: `3px solid ${ms.proximaFaixa ? 'var(--accent)' : ok}` }}>
                    <strong>Ritmo em tempo real:</strong> {ms.mensagemStatus}
                  </div>

                  {!temFaixas && (
                    <div style={{ marginTop: 10, fontSize: 12, color: alerta }}>
                      Nenhuma faixa configurada para este barbeiro. Clique em "Cadastrar Metas" acima para configurar as faixas de escalonamento (ex.: 40% + 5% ao atingir R$ 10k).
                    </div>
                  )}
                </div>
              )
            })()}

            {/* CARD METAS DE PRODUTOS */}
            {(() => {
              const mp = relatorioIndividual.metasEvolucao?.produtos || {}
              const temFaixas = mp.todasFaixas && mp.todasFaixas.length > 0
              return (
                <div style={{ ...card, borderTop: '4px solid #8b5cf6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={kpiLabel}>Metas de Faturamento em Produtos</span>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                        {moeda(mp.faturamento)} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>vendidos</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, background: mp.bonusPercentual > 0 ? '#8b5cf6' : 'var(--card2)', color: mp.bonusPercentual > 0 ? '#fff' : 'var(--fg)', fontSize: 13, fontWeight: 800 }}>
                        {mp.percentualEfetivo}% de comissão
                      </span>
                      {mp.bonusPercentual > 0 && (
                        <div style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700, marginTop: 2 }}>
                          +{mp.bonusPercentual}% de bônus em produtos!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>
                        {mp.faixaAtual ? mp.faixaAtual.descricao : `Base: ${mp.percentualBase}%`}
                      </span>
                      <span style={{ fontWeight: 700 }}>
                        {mp.proximaFaixa ? `Próxima: ${moeda(mp.proximaFaixa.metaFaturamento)} (${mp.percentualBase + mp.proximaFaixa.bonusPercentual}%)` : 'Teto Máximo Atingido!'}
                      </span>
                    </div>
                    <div style={{ height: 10, background: 'var(--line)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${mp.progressoPct || 0}%`, background: '#8b5cf6', borderRadius: 5, transition: 'width .3s' }} />
                    </div>
                  </div>

                  {/* Frase em tempo real */}
                  <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--card2)', borderRadius: 10, fontSize: 13, borderLeft: '3px solid #8b5cf6' }}>
                    <strong>Comissão separada:</strong> {mp.mensagemStatus}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── NAVEGAÇÃO ENTRE OS 5 RELATÓRIOS SOLICITADOS ───────────────── */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            {[
              ['faturamento', '1. Faturamento Total'],
              ['servicos', '2. Serviços por Categoria'],
              ['planos', '3. Pacotes & Planos'],
              ['extras', '4. Serviços Extras & Clientes'],
              ['produtos', '5. Venda de Produtos'],
              ['extrato', '6. Extrato Cronológico'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                style={abaRelatorio === id ? btnActive : btn}
                onClick={() => setAbaRelatorio(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── ABA 1: FATURAMENTO TOTAL BRUTO E COMISSÕES SEPARADAS ──────── */}
          {abaRelatorio === 'faturamento' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={grid(150)}>
                <div style={kpi}>
                  <div style={kpiLabel}>Faturamento Total Bruto</div>
                  <div style={kpiValue}>{moeda(relatorioIndividual.faturamento.brutoTotal)}</div>
                  <div style={sub}>{relatorioIndividual.faturamento.totalAtendimentos} serviços · {relatorioIndividual.faturamento.totalVendasProdutos} vendas</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Produção em Serviços</div>
                  <div style={{ ...kpiValue, color: 'var(--accent)' }}>{moeda(relatorioIndividual.faturamento.brutoServicos)}</div>
                  <div style={sub}>Ticket médio {moeda(relatorioIndividual.faturamento.ticketMedioServicos)}</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Vendas de Produtos</div>
                  <div style={{ ...kpiValue, color: '#8b5cf6' }}>{moeda(relatorioIndividual.faturamento.brutoProdutos)}</div>
                  <div style={sub}>Comissão separada</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Rateio de Planos / Pote</div>
                  <div style={kpiValue}>{moeda(relatorioIndividual.faturamento.brutoPlanos)}</div>
                  <div style={sub}>Assinaturas ativas</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Taxas & Materiais</div>
                  <div style={{ ...kpiValue, color: 'var(--muted)' }}>{moeda(relatorioIndividual.faturamento.taxas + relatorioIndividual.faturamento.materiais)}</div>
                  <div style={sub}>taxa {moeda(relatorioIndividual.faturamento.taxas)} · material {moeda(relatorioIndividual.faturamento.materiais)}</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Comissão Total</div>
                  <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioIndividual.faturamento.comissaoTotal)}</div>
                  <div style={sub}>serviços {moeda(relatorioIndividual.faturamento.comissaoServicos)} · produtos {moeda(relatorioIndividual.faturamento.comissaoProdutos)}</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Bônus de Metas Conquistado</div>
                  <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioIndividual.faturamento.bonusTotalValor)}</div>
                  <div style={sub}>serviços {moeda(relatorioIndividual.faturamento.bonusServicosValor)} · produtos {moeda(relatorioIndividual.faturamento.bonusProdutosValor)}</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Líquido a Receber</div>
                  <div style={{ ...kpiValue, color: 'var(--accent)' }}>{moeda(relatorioIndividual.faturamento.repasseLiquido)}</div>
                  <div style={sub}>vales abatidos {moeda(relatorioIndividual.faturamento.valesAbertos)}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── ABA 2: RELATÓRIO DE SERVIÇOS POR CATEGORIA ────────────────── */}
          {abaRelatorio === 'servicos' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={card}>
                <h3 style={h3}>Quantidade e Faturamento por Categoria de Procedimento</h3>
                <p style={sub}>Cortes, barbas e procedimentos executados no período com quantidades e valores.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12, marginTop: 16 }}>
                  {relatorioIndividual.servicosPorCategoria.map((cat) => (
                    <div key={cat.categoria} style={{ padding: 14, background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 15 }}>{cat.categoria}</strong>
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--card)', fontSize: 12, fontWeight: 700 }}>
                          {cat.quantidade} realizado(s)
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, color: 'var(--accent)' }}>
                        {moeda(cat.faturamento)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Ticket médio: {moeda(cat.ticketMedio)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ overflowX: 'auto', marginTop: 18 }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Categoria</th>
                        <th style={th}>Procedimento / Serviço</th>
                        <th style={th}>Qtd</th>
                        <th style={th}>Valor Médio</th>
                        <th style={th}>Faturamento Bruto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorioIndividual.servicosPorCategoria.flatMap((cat) =>
                        cat.itens.map((it) => (
                          <tr key={`${cat.categoria}-${it.nome}`}>
                            <td style={td}><span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--card2)', fontSize: 11, fontWeight: 700 }}>{cat.categoria}</span></td>
                            <td style={td}><strong>{it.nome}</strong></td>
                            <td style={td}>{it.quantidade}</td>
                            <td style={td}>{moeda(it.ticketMedio)}</td>
                            <td style={td}><strong>{moeda(it.faturamento)}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ABA 3: RELATÓRIO DE PACOTES E PLANOS ───────────────────────── */}
          {abaRelatorio === 'planos' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={card}>
                <h3 style={h3}>Pacotes, Assinaturas e Pote dos Planos</h3>
                <p style={sub}>Atendimentos cobertos pelos planos do clube, faturamento gerado e rateio de pote.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12, marginTop: 14 }}>
                  <div style={kpi}>
                    <div style={kpiLabel}>Atendimentos pelo Plano</div>
                    <div style={kpiValue}>{relatorioIndividual.pacotesEPlanos.atendimentosPeloPlano.reduce((s, it) => s + (it.usos || 0), 0)}</div>
                    <div style={sub}>Sessões consumidas</div>
                  </div>
                  <div style={kpi}>
                    <div style={kpiLabel}>Rateio do Pote Recebido</div>
                    <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioIndividual.pacotesEPlanos.totalValorPote)}</div>
                    <div style={sub}>Comissão de planos</div>
                  </div>
                  <div style={kpi}>
                    <div style={kpiLabel}>Assinaturas Ativas na Loja</div>
                    <div style={kpiValue}>{relatorioIndividual.pacotesEPlanos.assinaturasAtivasTotal}</div>
                    <div style={sub}>Clientes no clube</div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', marginTop: 18 }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Plano / Pacote</th>
                        <th style={th}>Usos / Atendimentos</th>
                        <th style={th}>Pontos / Tabela</th>
                        <th style={th}>Valor Fixo por Uso</th>
                        <th style={th}>Comissão do Pote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorioIndividual.pacotesEPlanos.atendimentosPeloPlano.length === 0 ? (
                        <tr><td colSpan={5} style={empty}>Nenhum atendimento pelo plano realizado neste período.</td></tr>
                      ) : (
                        relatorioIndividual.pacotesEPlanos.atendimentosPeloPlano.map((pl, i) => (
                          <tr key={i}>
                            <td style={td}><strong>{pl.planoNome}</strong></td>
                            <td style={td}>{pl.usos} atendimento(s)</td>
                            <td style={td}>{pl.pontos}</td>
                            <td style={td}>{moeda(pl.valorFixo)}</td>
                            <td style={td}><strong>{moeda(pl.valorTotal)}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ABA 4: RELATÓRIO DE SERVIÇOS EXTRAS E CLIENTES NOMINAIS ───── */}
          {abaRelatorio === 'extras' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={h3}>Serviços Extras e Procedimentos Adicionais</h3>
                    <p style={sub}>Hidratações, sobrancelhas, pigmentações, selagens, botox e químicas com a lista de clientes atendidos.</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: ok }}>{moeda(relatorioIndividual.servicosExtras.faturamentoTotal)}</span>
                    <div style={sub}>{relatorioIndividual.servicosExtras.quantidadeTotal} procedimento(s) extra(s)</div>
                  </div>
                </div>

                {/* Resumo por tipo de extra */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                  {relatorioIndividual.servicosExtras.resumo.map((ex) => (
                    <div key={ex.nome} style={{ padding: '8px 12px', background: 'var(--card2)', borderRadius: 10, border: '1px solid var(--line)', fontSize: 13 }}>
                      <strong>{ex.nome}</strong>: {ex.quantidade}x · <span style={{ color: ok, fontWeight: 700 }}>{moeda(ex.faturamento)}</span>
                    </div>
                  ))}
                </div>

                {/* Lista nominal de clientes que fizeram serviços extras */}
                <div style={{ overflowX: 'auto', marginTop: 16 }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Data</th>
                        <th style={th}>Cliente</th>
                        <th style={th}>Procedimento Extra</th>
                        <th style={th}>Valor Cobrado</th>
                        <th style={th}>Comissão Gerada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorioIndividual.servicosExtras.clientesAtendidos.length === 0 ? (
                        <tr><td colSpan={5} style={empty}>Nenhum serviço extra realizado no período selecionado.</td></tr>
                      ) : (
                        relatorioIndividual.servicosExtras.clientesAtendidos.map((item, idx) => (
                          <tr key={idx}>
                            <td style={td}>{dataBR(item.data)}</td>
                            <td style={td}><strong>{item.cliente}</strong></td>
                            <td style={td}><span style={{ padding: '3px 8px', borderRadius: 6, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontWeight: 700 }}>{item.servico}</span></td>
                            <td style={td}>{moeda(item.valor)}</td>
                            <td style={td}><strong style={{ color: ok }}>{moeda(item.comissao)}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ABA 5: RELATÓRIO DE PRODUTOS VENDIDOS ───────────────────────── */}
          {abaRelatorio === 'produtos' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={h3}>Relatório de Venda de Produtos</h3>
                    <p style={sub}>Produtos vendidos pelo profissional com comissão calculada separadamente dos serviços.</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6' }}>{moeda(relatorioIndividual.produtos.faturamentoBruto)}</span>
                    <div style={sub}>Comissão ganha: {moeda(relatorioIndividual.produtos.comissaoTotal)} ({relatorioIndividual.produtos.percentualEfetivo}%)</div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', marginTop: 16 }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Produto</th>
                        <th style={th}>Quantidade</th>
                        <th style={th}>Preço Médio</th>
                        <th style={th}>Faturamento Bruto</th>
                        <th style={th}>Comissão ({relatorioIndividual.produtos.percentualEfetivo}%)</th>
                        <th style={th}>Clientes Compradores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorioIndividual.produtos.itens.length === 0 ? (
                        <tr><td colSpan={6} style={empty}>Nenhum produto vendido no período selecionado.</td></tr>
                      ) : (
                        relatorioIndividual.produtos.itens.map((p, i) => (
                          <tr key={i}>
                            <td style={td}><strong>{p.nome}</strong></td>
                            <td style={td}>{p.quantidade} un</td>
                            <td style={td}>{moeda(p.valorUnitarioMedio)}</td>
                            <td style={td}><strong style={{ color: '#8b5cf6' }}>{moeda(p.faturamentoBruto)}</strong></td>
                            <td style={td}><strong style={{ color: ok }}>{moeda(p.comissaoTotal)}</strong></td>
                            <td style={td}>
                              {p.clientes && p.clientes.length > 0 ? (
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.clientes.join(', ')}</span>
                              ) : (
                                <span style={{ color: 'var(--muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ABA 6: EXTRATO COMPLETO CRONOLÓGICO ────────────────────────── */}
          {abaRelatorio === 'extrato' && (
            <div style={card}>
              <h3 style={h3}>Extrato Cronológico do Período</h3>
              <p style={sub}>Todos os atendimentos, vendas e movimentações apuradas para o profissional.</p>

              <div style={{ overflowX: 'auto', marginTop: 16 }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Data</th>
                      <th style={th}>Tipo</th>
                      <th style={th}>Descrição</th>
                      <th style={th}>Cliente</th>
                      <th style={th}>Bruto</th>
                      <th style={th}>Taxa</th>
                      <th style={th}>Material</th>
                      <th style={th}>Base</th>
                      <th style={th}>%</th>
                      <th style={th}>Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorioIndividual.extratoLinhas.length === 0 ? (
                      <tr><td colSpan={10} style={empty}>Nenhuma linha de movimento encontrada.</td></tr>
                    ) : (
                      relatorioIndividual.extratoLinhas.map((l, idx) => (
                        <tr key={idx}>
                          <td style={td}>{dataBR(l.data)}</td>
                          <td style={td}>
                            <span style={{ padding: '2px 6px', borderRadius: 4, background: l.tipo === 'produto' ? '#ede9fe' : '#e0f2fe', color: l.tipo === 'produto' ? '#6b21a8' : '#0369a1', fontSize: 11, fontWeight: 700 }}>
                              {l.tipo}
                            </span>
                          </td>
                          <td style={td}><strong>{l.descricao}</strong></td>
                          <td style={td}>{l.cliente || '—'}</td>
                          <td style={td}>{moeda(l.bruto)}</td>
                          <td style={td}>{moeda(l.taxa)}</td>
                          <td style={td}>{moeda(l.material)}</td>
                          <td style={td}>{moeda(l.base)}</td>
                          <td style={td}>{l.percentual}%</td>
                          <td style={td}><strong style={{ color: ok }}>{moeda(l.comissao)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : relatorioEquipe ? (
        /* ── VISÃO GERAL DA EQUIPE INTEIRA (RANKING & METAS) ────────────── */
        <div style={{ display: 'grid', gap: 16 }}>
          {/* TOTAIS DA EQUIPE */}
          <div style={grid(160)}>
            <div style={kpi}>
              <div style={kpiLabel}>Faturamento Total da Equipe</div>
              <div style={kpiValue}>{moeda(relatorioEquipe.totaisGerais?.faturamentoBrutoTotal)}</div>
              <div style={sub}>{relatorioEquipe.totaisGerais?.totalAtendimentos} serviços · {relatorioEquipe.totaisGerais?.totalProdutosVendidos} produtos</div>
            </div>
            <div style={kpi}>
              <div style={kpiLabel}>Produção em Serviços</div>
              <div style={{ ...kpiValue, color: 'var(--accent)' }}>{moeda(relatorioEquipe.totaisGerais?.faturamentoServicos)}</div>
              <div style={sub}>Toda a equipe</div>
            </div>
            <div style={kpi}>
              <div style={kpiLabel}>Venda de Produtos</div>
              <div style={{ ...kpiValue, color: '#8b5cf6' }}>{moeda(relatorioEquipe.totaisGerais?.faturamentoProdutos)}</div>
              <div style={sub}>Comissão separada</div>
            </div>
            <div style={kpi}>
              <div style={kpiLabel}>Comissões Totais a Pagar</div>
              <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioEquipe.totaisGerais?.comissaoTotalGeral)}</div>
              <div style={sub}>Inclui bonificações</div>
            </div>
            <div style={kpi}>
              <div style={kpiLabel}>Total em Bonificações</div>
              <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioEquipe.totaisGerais?.bonusTotalGeral)}</div>
              <div style={sub}>Metas alcançadas</div>
            </div>
          </div>

          {/* TABELA COMPARATIVA E RANKING */}
          <div style={card}>
            <h3 style={h3}>Ranking de Produtividade e Atingimento de Metas da Equipe</h3>
            <p style={sub}>Clique em qualquer barbeiro para ver o relatório individual completo com as 5 seções analíticas.</p>

            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Posição</th>
                    <th style={th}>Profissional</th>
                    <th style={th}>Faturamento Serviços</th>
                    <th style={th}>Meta de Serviço</th>
                    <th style={th}>Faturamento Produtos</th>
                    <th style={th}>Meta de Produtos</th>
                    <th style={th}>Faturamento Total</th>
                    <th style={th}>Comissão Total</th>
                    <th style={th}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorioEquipe.equipe?.map((item) => {
                    const ms = item.metasEvolucao?.servicos || {}
                    const mp = item.metasEvolucao?.produtos || {}
                    return (
                      <tr key={item.profissional.id} style={{ cursor: 'pointer' }} onClick={() => setProfissionalId(item.profissional.id)}>
                        <td style={td}>
                          <span style={{ width: 26, height: 26, borderRadius: '50%', background: item.posicao === 1 ? '#fef08a' : item.posicao === 2 ? '#e2e8f0' : item.posicao === 3 ? '#fed7aa' : 'var(--card2)', color: '#000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                            {item.posicao}º
                          </span>
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--card2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                              {item.profissional.fotoUrl ? <img src={item.profissional.fotoUrl} alt={item.profissional.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : item.profissional.nome.slice(0, 1)}
                            </div>
                            <div>
                              <strong>{item.profissional.nome}</strong>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.profissional.especialidade}</div>
                            </div>
                          </div>
                        </td>
                        <td style={td}>{moeda(item.faturamento.brutoServicos)}</td>
                        <td style={td}>
                          <span style={{ padding: '2px 6px', borderRadius: 4, background: ms.bonusPercentual > 0 ? ok : 'var(--card2)', color: ms.bonusPercentual > 0 ? '#fff' : 'inherit', fontSize: 11, fontWeight: 700 }}>
                            {ms.percentualEfetivo}% {ms.bonusPercentual > 0 ? `(+${ms.bonusPercentual}%)` : ''}
                          </span>
                        </td>
                        <td style={td}>{moeda(item.faturamento.brutoProdutos)}</td>
                        <td style={td}>
                          <span style={{ padding: '2px 6px', borderRadius: 4, background: mp.bonusPercentual > 0 ? '#8b5cf6' : 'var(--card2)', color: mp.bonusPercentual > 0 ? '#fff' : 'inherit', fontSize: 11, fontWeight: 700 }}>
                            {mp.percentualEfetivo}% {mp.bonusPercentual > 0 ? `(+${mp.bonusPercentual}%)` : ''}
                          </span>
                        </td>
                        <td style={td}><strong>{moeda(item.faturamento.brutoTotal)}</strong></td>
                        <td style={td}><strong style={{ color: ok }}>{moeda(item.faturamento.comissaoTotal)}</strong></td>
                        <td style={td}>
                          <button
                            type="button"
                            style={{ ...btn, padding: '4px 8px', fontSize: 11 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setProfissionalId(item.profissional.id)
                            }}
                          >
                            Ver Relatório ›
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── MODAL: CADASTRAR / AJUSTAR METAS E BONIFICAÇÕES ───────────── */}
      {modalMetasAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...card, width: '100%', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={h3}>Configuração de Metas e Bonificações</h3>
                <p style={sub}>Defina as comissões base e os degraus de faturamento para bonificar este barbeiro automaticamente.</p>
              </div>
              <button type="button" style={{ ...btn, padding: '4px 8px' }} onClick={() => setModalMetasAberto(false)}>✕</button>
            </div>

            <form onSubmit={salvarMetasProfissional} style={{ display: 'grid', gap: 18 }}>
              {/* SEÇÃO 1: SERVIÇOS */}
              <div style={{ padding: 14, background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 14, color: 'var(--accent)' }}>1. Metas e Comissões de Serviços</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Comissão Base:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formMetas.percentualComissao}
                      onChange={(e) => setFormMetas((a) => ({ ...a, percentualComissao: Number(e.target.value) }))}
                      style={{ ...input, width: 60 }}
                    />
                    <span>%</span>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
                  Conforme o barbeiro atinge metas de faturamento em serviços, a comissão aumenta automaticamente.
                </p>

                <div style={{ display: 'grid', gap: 8 }}>
                  {formMetas.faixasComissaoServico.map((faixa, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 10px', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, width: 60 }}>Meta {idx + 1}:</span>
                      <span style={{ fontSize: 12 }}>A partir de R$</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={faixa.metaFaturamento}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setFormMetas((a) => ({
                            ...a,
                            faixasComissaoServico: a.faixasComissaoServico.map((f, i) => i === idx ? { ...f, metaFaturamento: val } : f),
                          }))
                        }}
                        style={{ ...input, width: 95 }}
                        placeholder="10000"
                      />
                      <span style={{ fontSize: 12 }}>Bônus: +</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={faixa.bonusPercentual}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setFormMetas((a) => ({
                            ...a,
                            faixasComissaoServico: a.faixasComissaoServico.map((f, i) => i === idx ? { ...f, bonusPercentual: val } : f),
                          }))
                        }}
                        style={{ ...input, width: 60 }}
                        placeholder="5"
                      />
                      <span style={{ fontSize: 12 }}>% = <strong>{(Number(formMetas.percentualComissao) || 0) + (Number(faixa.bonusPercentual) || 0)}%</strong></span>
                      <button
                        type="button"
                        style={{ ...btn, color: '#e05c5c', padding: '2px 8px', marginLeft: 'auto' }}
                        onClick={() => removerFaixaServico(idx)}
                      >
                        Excluir
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    style={{ ...btn, alignSelf: 'flex-start', marginTop: 4 }}
                    onClick={adicionarFaixaServico}
                  >
                    + Adicionar Meta de Serviços
                  </button>
                </div>
              </div>

              {/* SEÇÃO 2: PRODUTOS */}
              <div style={{ padding: 14, background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 14, color: '#8b5cf6' }}>2. Metas e Comissões de Produtos (Separada)</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Comissão Base:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formMetas.percentualComissaoProduto}
                      onChange={(e) => setFormMetas((a) => ({ ...a, percentualComissaoProduto: Number(e.target.value) }))}
                      style={{ ...input, width: 60 }}
                    />
                    <span>%</span>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
                  A comissão de produtos é independente dos serviços e pode ter faixas de bonificação exclusivas.
                </p>

                <div style={{ display: 'grid', gap: 8 }}>
                  {formMetas.faixasComissaoProduto.map((faixa, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 10px', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, width: 60 }}>Meta {idx + 1}:</span>
                      <span style={{ fontSize: 12 }}>A partir de R$</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={faixa.metaFaturamento}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setFormMetas((a) => ({
                            ...a,
                            faixasComissaoProduto: a.faixasComissaoProduto.map((f, i) => i === idx ? { ...f, metaFaturamento: val } : f),
                          }))
                        }}
                        style={{ ...input, width: 95 }}
                        placeholder="1000"
                      />
                      <span style={{ fontSize: 12 }}>Bônus: +</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={faixa.bonusPercentual}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setFormMetas((a) => ({
                            ...a,
                            faixasComissaoProduto: a.faixasComissaoProduto.map((f, i) => i === idx ? { ...f, bonusPercentual: val } : f),
                          }))
                        }}
                        style={{ ...input, width: 60 }}
                        placeholder="2"
                      />
                      <span style={{ fontSize: 12 }}>% = <strong>{(Number(formMetas.percentualComissaoProduto) || 0) + (Number(faixa.bonusPercentual) || 0)}%</strong></span>
                      <button
                        type="button"
                        style={{ ...btn, color: '#e05c5c', padding: '2px 8px', marginLeft: 'auto' }}
                        onClick={() => removerFaixaProduto(idx)}
                      >
                        Excluir
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    style={{ ...btn, alignSelf: 'flex-start', marginTop: 4 }}
                    onClick={adicionarFaixaProduto}
                  >
                    + Adicionar Meta de Produtos
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" style={btn} onClick={() => setModalMetasAberto(false)}>Cancelar</button>
                <button type="submit" style={btnPrimary} disabled={salvandoMetas}>
                  {salvandoMetas ? 'Salvando…' : 'Salvar Metas e Bonificações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default MetasComissoesPanel
