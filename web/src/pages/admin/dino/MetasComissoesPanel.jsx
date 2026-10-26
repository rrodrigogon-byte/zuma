// KYTTO — Painel de Controle de Metas, Comissões, Bonificações e Produtividade Individual.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../../lib/api'

const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }
const h2 = { margin: 0, fontSize: 20, fontFamily: 'var(--font-display)' }
const h3 = { margin: 0, fontSize: 16 }
const sub = { margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '10px 12px', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }
const td = { padding: '11px 12px', borderBottom: '1px solid var(--line)', verticalAlign: 'middle' }
const btn = { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .15s' }
const btnPrimary = { ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
const btnActive = { ...btn, background: 'color-mix(in srgb, var(--accent) 18%, transparent)', borderColor: 'var(--accent)', color: 'var(--accent)' }
const input = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit', fontSize: 13, minWidth: 0 }
const kpi = { background: 'var(--card2, var(--card))', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }
const kpiLabel = { fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }
const kpiValue = { fontSize: 22, fontWeight: 800, marginTop: 6, fontFamily: 'var(--font-display)' }
const grid = (min = 160) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 12 })
const empty = { padding: 36, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }

const ok = '#14b87a'
const alerta = '#f59e0b'
const roxo = '#8b5cf6'
const azul = '#0ea5e9'
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

  // Filtros internos das abas
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [buscaExtra, setBuscaExtra] = useState('')
  const [buscaExtrato, setBuscaExtrato] = useState('')
  const [filtroTipoExtrato, setFiltroTipoExtrato] = useState('todos')

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
    } catch (e) {
      console.error('Erro ao carregar profissionais:', e)
    }
  }, [])

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
      console.error('Erro ao carregar relatório:', e)
      setErro(e?.message || 'Falha ao buscar dados do relatório.')
    } finally {
      setCarregando(false)
    }
  }, [periodoTipo, customInicio, customFim, profissionalId])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Abre modal de edição de metas
  const abrirModalMetas = (prof) => {
    if (!prof) return
    setFormMetas({
      percentualComissao: prof.percentualComissaoServico ?? prof.percentualComissao ?? 40,
      percentualComissaoProduto: prof.percentualComissaoProduto ?? 10,
      faixasComissaoServico: Array.isArray(prof.faixasComissaoServico) ? [...prof.faixasComissaoServico] : [],
      faixasComissaoProduto: Array.isArray(prof.faixasComissaoProduto) ? [...prof.faixasComissaoProduto] : [],
    })
    setModalMetasAberto(true)
  }

  // Salva configuração de metas do profissional
  const salvarMetas = async (e) => {
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

  // Dados filtrados de extras
  const extrasFiltrados = useMemo(() => {
    const lista = relatorioIndividual?.servicosExtras?.clientesAtendidos || []
    if (!buscaExtra) return lista
    const q = buscaExtra.toLowerCase()
    return lista.filter((it) => String(it.cliente || '').toLowerCase().includes(q) || String(it.servico || '').toLowerCase().includes(q))
  }, [relatorioIndividual, buscaExtra])

  // Dados filtrados de extrato
  const extratoFiltrado = useMemo(() => {
    const lista = relatorioIndividual?.extratoLinhas || []
    return lista.filter((l) => {
      if (filtroTipoExtrato === 'servico' && l.tipo !== 'servico') return false
      if (filtroTipoExtrato === 'produto' && l.tipo !== 'produto') return false
      if (filtroTipoExtrato === 'clube' && !l.club && Number(l.bruto || 0) > 0) return false
      if (filtroTipoExtrato === 'extras' && !l.descricao?.toLowerCase().includes('hidrat') && !l.descricao?.toLowerCase().includes('pigment') && !l.descricao?.toLowerCase().includes('sobrancelha') && !l.descricao?.toLowerCase().includes('selagem')) return false
      if (buscaExtrato) {
        const q = buscaExtrato.toLowerCase()
        return String(l.cliente || '').toLowerCase().includes(q) || String(l.descricao || '').toLowerCase().includes(q) || String(l.origemId || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [relatorioIndividual, buscaExtrato, filtroTipoExtrato])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ── BARRA SUPERIOR: PERÍODO E TÍTULO ─────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={h2}>Metas, Comissões e Bonificações</h2>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontWeight: 800 }}>
                DINO ERP
              </span>
            </div>
            <p style={sub}>Controle de metas progressivas individuais, bonificações automáticas por faturamento e relatórios de produtividade.</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={periodoTipo === 'tudo' ? btnActive : btn} onClick={() => setPeriodoTipo('tudo')}>📅 Todo o Histórico</button>
            <button type="button" style={periodoTipo === 'mes' ? btnActive : btn} onClick={() => setPeriodoTipo('mes')}>📅 Este Mês</button>
            <button type="button" style={periodoTipo === 'quinzena' ? btnActive : btn} onClick={() => setPeriodoTipo('quinzena')}>📅 Esta Quinzena</button>
            <button type="button" style={periodoTipo === 'semana' ? btnActive : btn} onClick={() => setPeriodoTipo('semana')}>📅 Esta Semana</button>
            <button type="button" style={periodoTipo === 'dia' ? btnActive : btn} onClick={() => setPeriodoTipo('dia')}>📅 Hoje (Dia)</button>
            <button type="button" style={periodoTipo === 'custom' ? btnActive : btn} onClick={() => setPeriodoTipo('custom')}>⚙ Personalizado</button>
            <button type="button" style={btn} onClick={() => window.print()} title="Imprimir relatório">🖨 Imprimir</button>
          </div>
        </div>

        {/* Badge do período ativo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap', gap: 8 }}>
          <span>
            📍 <strong>Intervalo Apurado:</strong> {relatorioIndividual?.periodo?.label || relatorioEquipe?.periodo?.label || 'Carregando período...'}
          </span>
          <span style={{ fontSize: 11, background: 'var(--card2)', padding: '2px 8px', borderRadius: 6 }}>
            {relatorioIndividual ? 'Visualização Individual do Barbeiro' : 'Consolidado Geral da Equipe'}
          </span>
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
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: ativo ? 'var(--accent)' : 'var(--card2)',
                  borderColor: ativo ? 'var(--accent)' : 'var(--line)',
                  color: ativo ? '#fff' : 'var(--fg)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: ativo ? 'rgba(255,255,255,0.25)' : 'var(--line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                  {p.nome.slice(0, 1)}
                </span>
                <span>{p.nome}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── CONTEÚDO PRINCIPAL (INDIVIDUAL OU EQUIPE) ────────────────────── */}
      {carregando ? (
        <div style={{ ...card, ...empty }}>Carregando dados das metas e comissões...</div>
      ) : erro ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: '#ef4444' }}>
          <strong>Aviso:</strong> {erro}
          <div style={{ marginTop: 10 }}>
            <button type="button" style={btnPrimary} onClick={carregarDados}>Tentar novamente</button>
          </div>
        </div>
      ) : profissionalId && relatorioIndividual ? (
        /* ── VISÃO INDIVIDUAL DO PROFISSIONAL ──────────────────────────── */
        <>
          {/* CABEÇALHO DO PROFISSIONAL & CONFIGURAR METAS */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, border: '2px solid var(--accent)' }}>
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

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
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
                      <div style={{ height: '100%', width: `${ms.progressoPct || 0}%`, background: ms.bonusPercentual > 0 ? ok : 'var(--accent)', borderRadius: 5, transition: 'width .3s' }} />
                    </div>
                  </div>

                  {/* Frase em tempo real */}
                  <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--card2)', borderRadius: 10, fontSize: 13, borderLeft: '3px solid var(--accent)' }}>
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
                      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                        {moeda(mp.faturamento)} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>vendidos ({relatorioIndividual.produtos?.unidadesVendidas || 0} un)</span>
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

          {/* ── NAVEGAÇÃO ENTRE OS 6 RELATÓRIOS ANALÍTICOS COM CONTADORES ───── */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
            {[
              ['faturamento', '1. Faturamento Total', null],
              ['servicos', '2. Serviços por Categoria', relatorioIndividual.servicosPorCategoria?.length],
              ['planos', '3. Pacotes & Planos', relatorioIndividual.pacotesEPlanos?.totalAtendimentosClube || 0],
              ['extras', '4. Serviços Extras & Clientes', relatorioIndividual.servicosExtras?.quantidadeTotal || 0],
              ['produtos', '5. Venda de Produtos', relatorioIndividual.produtos?.unidadesVendidas || 0],
              ['extrato', '6. Extrato Cronológico', relatorioIndividual.extratoLinhas?.length || 0],
            ].map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                style={abaRelatorio === id ? btnActive : btn}
                onClick={() => setAbaRelatorio(id)}
              >
                <span>{label}</span>
                {count != null && (
                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: abaRelatorio === id ? 'var(--accent)' : 'var(--card2)', color: abaRelatorio === id ? '#fff' : 'var(--muted)', fontWeight: 800 }}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── ABA 1: FATURAMENTO TOTAL BRUTO E CONCILIAÇÃO CONTÁBIL ──────── */}
          {abaRelatorio === 'faturamento' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={grid(160)}>
                <div style={kpi}>
                  <div style={kpiLabel}>Faturamento Total Bruto</div>
                  <div style={kpiValue}>{moeda(relatorioIndividual.faturamento.brutoTotal)}</div>
                  <div style={sub}>{relatorioIndividual.faturamento.totalAtendimentos} atendimentos · {relatorioIndividual.faturamento.totalVendasProdutos} produtos</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Produção em Serviços</div>
                  <div style={{ ...kpiValue, color: 'var(--accent)' }}>{moeda(relatorioIndividual.faturamento.brutoServicos)}</div>
                  <div style={sub}>Ticket médio {moeda(relatorioIndividual.faturamento.ticketMedioServicos)}</div>
                </div>
                <div style={kpi}>
                  <div style={kpiLabel}>Vendas de Produtos</div>
                  <div style={{ ...kpiValue, color: roxo }}>{moeda(relatorioIndividual.faturamento.brutoProdutos)}</div>
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

              {/* CARD DE DETALHAMENTO CONTÁBIL DO REPASSE */}
              <div style={card}>
                <h3 style={h3}>Demonstrativo Contábil de Fechamento da Cadeira</h3>
                <p style={sub}>Visão conciliada de receitas brutas, deduções legais e cálculo do repasse líquido do barbeiro.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 14, marginTop: 14 }}>
                  <div style={{ padding: 14, background: 'var(--card2)', borderRadius: 10 }}>
                    <span style={kpiLabel}>Composição da Receita Bruta</span>
                    <div style={{ marginTop: 8, display: 'grid', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Serviços Avulsos ({relatorioIndividual.faturamento.totalAtendimentosAvulsos || 0}x)</span>
                        <strong>{moeda(relatorioIndividual.faturamento.brutoServicos)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Produtos Revenda ({relatorioIndividual.produtos.unidadesVendidas || 0} un)</span>
                        <strong style={{ color: roxo }}>{moeda(relatorioIndividual.faturamento.brutoProdutos)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Atendimentos do Clube ({relatorioIndividual.faturamento.totalAtendimentosClube || 0}x)</span>
                        <span>{moeda(relatorioIndividual.faturamento.brutoPlanos)} (Pote)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6, fontWeight: 800 }}>
                        <span>Total Bruto Produzido</span>
                        <span style={{ color: 'var(--accent)' }}>{moeda(relatorioIndividual.faturamento.brutoTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 14, background: 'var(--card2)', borderRadius: 10 }}>
                    <span style={kpiLabel}>Cálculo das Comissões & Bonificações</span>
                    <div style={{ marginTop: 8, display: 'grid', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Comissão Serviços ({relatorioIndividual.metasEvolucao.servicos.percentualEfetivo}%)</span>
                        <strong>{moeda(relatorioIndividual.faturamento.comissaoServicos)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Comissão Produtos ({relatorioIndividual.metasEvolucao.produtos.percentualEfetivo}%)</span>
                        <strong style={{ color: roxo }}>{moeda(relatorioIndividual.faturamento.comissaoProdutos)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Comissão Planos / Pote</span>
                        <strong>{moeda(relatorioIndividual.faturamento.comissaoPlanos)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6, fontWeight: 800 }}>
                        <span>Total Bruto das Comissões</span>
                        <span style={{ color: ok }}>{moeda(relatorioIndividual.faturamento.comissaoTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 14, background: 'var(--card2)', borderRadius: 10 }}>
                    <span style={kpiLabel}>Deduções & Repasse Líquido</span>
                    <div style={{ marginTop: 8, display: 'grid', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                        <span>Taxas de Cartão/Maquininha</span>
                        <span>-{moeda(relatorioIndividual.faturamento.taxas)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                        <span>Materiais Descontados</span>
                        <span>-{moeda(relatorioIndividual.faturamento.materiais)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: alerta }}>
                        <span>Vales / Adiantamentos</span>
                        <span>-{moeda(relatorioIndividual.faturamento.valesAbertos)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6, fontWeight: 800 }}>
                        <span>Repasse Líquido Final</span>
                        <span style={{ fontSize: 16, color: 'var(--accent)' }}>{moeda(relatorioIndividual.faturamento.repasseLiquido)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ABA 2: RELATÓRIO DE SERVIÇOS POR CATEGORIA (RECONCILIAÇÃO) ── */}
          {abaRelatorio === 'servicos' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={h3}>Quantidade e Faturamento por Categoria de Procedimento</h3>
                    <p style={sub}>Cortes, barbas e procedimentos executados no período com quantidades e valores reais.</p>
                  </div>
                  {categoriaFiltro && (
                    <button
                      type="button"
                      style={{ ...btn, padding: '4px 10px', fontSize: 11 }}
                      onClick={() => setCategoriaFiltro('')}
                    >
                      ✖ Limpar Filtro ({categoriaFiltro})
                    </button>
                  )}
                </div>

                {/* Cards das categorias refinadas (clicáveis para filtrar) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12, marginTop: 16 }}>
                  {relatorioIndividual.servicosPorCategoria.map((cat) => {
                    const ativo = categoriaFiltro === cat.categoria
                    return (
                      <div
                        key={cat.categoria}
                        onClick={() => setCategoriaFiltro(ativo ? '' : cat.categoria)}
                        style={{
                          padding: 14,
                          background: ativo ? 'color-mix(in srgb, var(--accent) 12%, var(--card2))' : 'var(--card2)',
                          borderRadius: 12,
                          border: ativo ? '2px solid var(--accent)' : '1px solid var(--line)',
                          cursor: 'pointer',
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 14 }}>{cat.categoria}</strong>
                          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--card)', fontSize: 11, fontWeight: 700 }}>
                            {cat.quantidadeTotal} realizado(s)
                          </span>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, color: 'var(--accent)' }}>
                          {moeda(cat.faturamento)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{cat.quantidadePaga} avulsos · {cat.quantidadeClube} clube</span>
                          <span>{cat.quantidadePaga > 0 ? `TM ${moeda(cat.ticketMedio)}` : 'Clube'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Tabela de procedimentos e serviços */}
                <div style={{ overflowX: 'auto', marginTop: 18 }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Categoria</th>
                        <th style={th}>Procedimento / Serviço</th>
                        <th style={th}>Total Realizado</th>
                        <th style={th}>Avulsos vs Clube</th>
                        <th style={th}>Valor Médio</th>
                        <th style={th}>Faturamento Bruto</th>
                        <th style={th}>% da Produção</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorioIndividual.servicosPorCategoria
                        .filter((c) => !categoriaFiltro || c.categoria === categoriaFiltro)
                        .flatMap((cat) =>
                          cat.itens.map((it) => {
                            const pctProducao = relatorioIndividual.faturamento.brutoServicos > 0
                              ? Math.round((it.faturamento / relatorioIndividual.faturamento.brutoServicos) * 100)
                              : 0
                            return (
                              <tr key={`${cat.categoria}-${it.nome}`}>
                                <td style={td}>
                                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--card2)', fontSize: 11, fontWeight: 700 }}>
                                    {cat.categoria}
                                  </span>
                                </td>
                                <td style={td}><strong>{it.nome}</strong></td>
                                <td style={td}>
                                  <span style={{ fontWeight: 700 }}>{it.quantidadeTotal}</span>
                                </td>
                                <td style={td}>
                                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {it.quantidadePaga} avulso(s) {it.quantidadeClube > 0 ? `· ${it.quantidadeClube} clube` : ''}
                                  </span>
                                </td>
                                <td style={td}>
                                  {it.quantidadePaga > 0 ? moeda(it.ticketMedio) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>Coberto pelo Clube</span>}
                                </td>
                                <td style={td}><strong>{moeda(it.faturamento)}</strong></td>
                                <td style={td}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ flex: 1, height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pctProducao}%`, background: 'var(--accent)', borderRadius: 3 }} />
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 32 }}>{pctProducao}%</span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ABA 3: RELATÓRIO DE PACOTES E PLANOS (CLUBE DINO) ─────────── */}
          {abaRelatorio === 'planos' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={card}>
                <h3 style={h3}>Pacotes, Assinaturas e Pote dos Planos</h3>
                <p style={sub}>Atendimentos cobertos pelos planos do clube, faturamento gerado e rateio de pote.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12, marginTop: 14 }}>
                  <div style={kpi}>
                    <div style={kpiLabel}>Atendimentos do Clube</div>
                    <div style={{ ...kpiValue, color: 'var(--accent)' }}>{relatorioIndividual.pacotesEPlanos.totalAtendimentosClube}</div>
                    <div style={sub}>Sessões executadas pelo barbeiro</div>
                  </div>
                  <div style={kpi}>
                    <div style={kpiLabel}>Rateio do Pote Recebido</div>
                    <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioIndividual.pacotesEPlanos.totalValorPote)}</div>
                    <div style={sub}>Comissão de planos</div>
                  </div>
                  <div style={kpi}>
                    <div style={kpiLabel}>Assinaturas Ativas na Barbearia</div>
                    <div style={kpiValue}>{relatorioIndividual.pacotesEPlanos.assinaturasAtivasTotal}</div>
                    <div style={sub}>Clientes no clube</div>
                  </div>
                </div>

                {/* Explicação transparente */}
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--card2)', borderRadius: 10, fontSize: 13, borderLeft: '3px solid var(--accent)' }}>
                  <strong>Como funciona o Clube Dino:</strong> Os atendimentos dos membros do clube entram com valor zerado no caixa diário para o cliente, e o barbeiro é remunerado na apuração pelo rateio do <strong>Pote dos Planos</strong> conforme o percentual e a quantidade de atendimentos realizados.
                </div>

                {/* Tabela dos atendimentos do clube */}
                <h4 style={{ ...h3, marginTop: 20 }}>Atendimentos Recentes Cobertos pelo Clube</h4>
                <div style={{ overflowX: 'auto', marginTop: 10 }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Data</th>
                        <th style={th}>Cliente Membro</th>
                        <th style={th}>Procedimento Realizado</th>
                        <th style={th}>Status do Plano</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!relatorioIndividual.pacotesEPlanos.linhasClube || relatorioIndividual.pacotesEPlanos.linhasClube.length === 0) ? (
                        <tr><td colSpan={4} style={empty}>Nenhum atendimento pelo clube registrado neste período.</td></tr>
                      ) : (
                        relatorioIndividual.pacotesEPlanos.linhasClube.map((l, i) => (
                          <tr key={i}>
                            <td style={td}>{dataBR(l.data)}</td>
                            <td style={td}><strong>{l.cliente}</strong></td>
                            <td style={td}>{l.servico}</td>
                            <td style={td}><span style={{ padding: '2px 8px', borderRadius: 6, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontSize: 11, fontWeight: 700 }}>Coberto pelo Clube</span></td>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={h3}>Serviços Extras e Procedimentos Adicionais</h3>
                    <p style={sub}>Hidratações, sobrancelhas, pigmentações, selagens, botox e químicas com a lista nominal de clientes atendidos.</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: ok }}>{moeda(relatorioIndividual.servicosExtras.faturamentoTotal)}</span>
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

                {/* Campo de pesquisa rápida de clientes */}
                <div style={{ marginTop: 16 }}>
                  <input
                    type="text"
                    placeholder="🔍 Filtrar por nome do cliente ou procedimento..."
                    value={buscaExtra}
                    onChange={(e) => setBuscaExtra(e.target.value)}
                    style={{ ...input, width: '100%', maxWidth: 400 }}
                  />
                </div>

                {/* Lista nominal de clientes que fizeram serviços extras */}
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
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
                      {extrasFiltrados.length === 0 ? (
                        <tr><td colSpan={5} style={empty}>Nenhum serviço extra encontrado com os critérios de busca.</td></tr>
                      ) : (
                        extrasFiltrados.map((item, idx) => (
                          <tr key={idx}>
                            <td style={td}>{dataBR(item.data)}</td>
                            <td style={td}><strong>{item.cliente}</strong></td>
                            <td style={td}>
                              <span style={{ padding: '3px 8px', borderRadius: 6, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontWeight: 700 }}>
                                {item.servico}
                              </span>
                            </td>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={h3}>Relatório de Venda de Produtos</h3>
                    <p style={sub}>Produtos vendidos pelo profissional com comissão calculada separadamente dos serviços.</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: roxo }}>{moeda(relatorioIndividual.produtos.faturamentoBruto)}</span>
                    <div style={sub}>Comissão ganha: {moeda(relatorioIndividual.produtos.comissaoTotal)} ({relatorioIndividual.produtos.percentualEfetivo}%)</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12, marginTop: 14 }}>
                  <div style={kpi}>
                    <div style={kpiLabel}>Total Faturado em Produtos</div>
                    <div style={{ ...kpiValue, color: roxo }}>{moeda(relatorioIndividual.produtos.faturamentoBruto)}</div>
                    <div style={sub}>{relatorioIndividual.produtos.unidadesVendidas} unidade(s) vendida(s)</div>
                  </div>
                  <div style={kpi}>
                    <div style={kpiLabel}>Comissão Efetiva de Varejo</div>
                    <div style={{ ...kpiValue, color: ok }}>{relatorioIndividual.produtos.percentualEfetivo}%</div>
                    <div style={sub}>Base {relatorioIndividual.produtos.percentualComissaoBase}% {relatorioIndividual.produtos.bonusPercentual > 0 ? `+ ${relatorioIndividual.produtos.bonusPercentual}% bônus` : ''}</div>
                  </div>
                  <div style={kpi}>
                    <div style={kpiLabel}>Comissão Ganha em Produtos</div>
                    <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioIndividual.produtos.comissaoTotal)}</div>
                    <div style={sub}>Separada da comissão de serviços</div>
                  </div>
                </div>

                {relatorioIndividual.produtos.itens.length === 0 ? (
                  <div style={{ marginTop: 16, padding: '24px 20px', background: 'var(--card2)', borderRadius: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🧴</div>
                    <strong style={{ fontSize: 15 }}>Nenhum produto de revenda registrado neste período</strong>
                    <p style={{ ...sub, maxWidth: 480, margin: '6px auto 14px' }}>
                      Quando o barbeiro vende pomadas, óleos, shampoos ou tônicos na comanda ou no balcão, a comissão de varejo (10% padrão ou configurada) é calculada separadamente aqui.
                    </p>
                    <button type="button" style={btnPrimary} onClick={() => abrirModalMetas(relatorioIndividual.profissional)}>
                      Configurar Metas de Produtos
                    </button>
                  </div>
                ) : (
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
                        {relatorioIndividual.produtos.itens.map((p, i) => (
                          <tr key={i}>
                            <td style={td}><strong>{p.nome}</strong></td>
                            <td style={td}>{p.quantidade} un</td>
                            <td style={td}>{moeda(p.valorUnitarioMedio)}</td>
                            <td style={td}><strong style={{ color: roxo }}>{moeda(p.faturamentoBruto)}</strong></td>
                            <td style={td}><strong style={{ color: ok }}>{moeda(p.comissaoTotal)}</strong></td>
                            <td style={td}>
                              {p.clientes && p.clientes.length > 0 ? (
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.clientes.join(', ')}</span>
                              ) : (
                                <span style={{ color: 'var(--muted)' }}>—</span>
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

          {/* ── ABA 6: EXTRATO COMPLETO CRONOLÓGICO ────────────────────────── */}
          {abaRelatorio === 'extrato' && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={h3}>Extrato Cronológico do Período</h3>
                  <p style={sub}>Todos os atendimentos, vendas e movimentações apuradas para o profissional.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="🔍 Buscar no extrato..."
                    value={buscaExtrato}
                    onChange={(e) => setBuscaExtrato(e.target.value)}
                    style={{ ...input, width: 200 }}
                  />
                  <select
                    value={filtroTipoExtrato}
                    onChange={(e) => setFiltroTipoExtrato(e.target.value)}
                    style={input}
                  >
                    <option value="todos">Todos os tipos ({relatorioIndividual.extratoLinhas.length})</option>
                    <option value="servico">Apenas Serviços</option>
                    <option value="produto">Apenas Produtos</option>
                    <option value="clube">Apenas Clube</option>
                    <option value="extras">Apenas Extras</option>
                  </select>
                </div>
              </div>

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
                    {extratoFiltrado.length === 0 ? (
                      <tr><td colSpan={10} style={empty}>Nenhuma linha de movimento encontrada com os filtros atuais.</td></tr>
                    ) : (
                      extratoFiltrado.slice(0, 300).map((l, idx) => (
                        <tr key={idx}>
                          <td style={td}>{dataBR(l.data)}</td>
                          <td style={td}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: l.tipo === 'produto' ? '#ede9fe' : (l.club || Number(l.bruto || 0) === 0) ? '#fef3c7' : '#e0f2fe',
                              color: l.tipo === 'produto' ? '#6b21a8' : (l.club || Number(l.bruto || 0) === 0) ? '#b45309' : '#0369a1',
                              fontSize: 11,
                              fontWeight: 700,
                            }}>
                              {l.club || Number(l.bruto || 0) === 0 ? 'clube' : l.tipo}
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
                {extratoFiltrado.length > 300 && (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                    Mostrando os primeiros 300 lançamentos de {extratoFiltrado.length}. Use a busca acima para filtrar datas ou clientes específicos.
                  </div>
                )}
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
              <div style={{ ...kpiValue, color: roxo }}>{moeda(relatorioEquipe.totaisGerais?.faturamentoProdutos)}</div>
              <div style={sub}>Comissão separada</div>
            </div>
            <div style={kpi}>
              <div style={kpiLabel}>Comissões Totais a Pagar</div>
              <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioEquipe.totaisGerais?.comissaoTotalGeral)}</div>
              <div style={sub}>Inclui bonificações</div>
            </div>
            <div style={kpi}>
              <div style={kpiLabel}>Bônus de Metas Distribuídos</div>
              <div style={{ ...kpiValue, color: ok }}>{moeda(relatorioEquipe.totaisGerais?.bonusTotalGeral)}</div>
              <div style={sub}>Bonificações conquistadas</div>
            </div>
          </div>

          {/* TABELA DE RANKING E METAS DA EQUIPE */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={h3}>Ranking de Produtividade, Faturamento e Bonificações</h3>
                <p style={sub}>Acompanhamento individual de cada barbeiro com faturamento em serviços, vendas e comissões calculadas.</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>Profissional</th>
                    <th style={th}>Faturamento Serviços</th>
                    <th style={th}>Venda Produtos</th>
                    <th style={th}>Total Bruto</th>
                    <th style={th}>Comissão Efetiva</th>
                    <th style={th}>Bônus Atingido</th>
                    <th style={th}>Comissão a Pagar</th>
                    <th style={th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorioEquipe.equipe.map((item) => (
                    <tr key={item.profissional.id}>
                      <td style={td}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: item.posicao <= 3 ? 'var(--accent)' : 'var(--card2)', color: item.posicao <= 3 ? '#fff' : 'var(--fg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                          {item.posicao}
                        </span>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, border: '1px solid var(--line)' }}>
                            {item.profissional.nome.slice(0, 1)}
                          </div>
                          <div>
                            <strong>{item.profissional.nome}</strong>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.profissional.especialidade}</div>
                          </div>
                        </div>
                      </td>
                      <td style={td}>{moeda(item.faturamento.brutoServicos)}</td>
                      <td style={td}><span style={{ color: roxo }}>{moeda(item.faturamento.brutoProdutos)}</span></td>
                      <td style={td}><strong style={{ fontSize: 14 }}>{moeda(item.faturamento.brutoTotal)}</strong></td>
                      <td style={td}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: item.metasEvolucao.servicos.bonusPercentual > 0 ? ok : 'var(--card2)', color: item.metasEvolucao.servicos.bonusPercentual > 0 ? '#fff' : 'var(--fg)', fontSize: 12, fontWeight: 700 }}>
                          {item.metasEvolucao.servicos.percentualEfetivo}%
                        </span>
                      </td>
                      <td style={td}>
                        {item.metasEvolucao.servicos.bonusPercentual > 0 ? (
                          <span style={{ color: ok, fontWeight: 700 }}>+{item.metasEvolucao.servicos.bonusPercentual}% ({moeda(item.faturamento.bonusTotalValor)})</span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>Base</span>
                        )}
                      </td>
                      <td style={td}><strong style={{ color: ok, fontSize: 14 }}>{moeda(item.faturamento.comissaoTotal)}</strong></td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            style={{ ...btn, padding: '4px 10px', fontSize: 11 }}
                            onClick={() => setProfissionalId(item.profissional.id)}
                          >
                            Ver Relatório
                          </button>
                          <button
                            type="button"
                            style={{ ...btn, padding: '4px 8px', fontSize: 11 }}
                            onClick={() => abrirModalMetas(item.profissional)}
                            title="Ajustar metas"
                          >
                            ⚙
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── MODAL: CADASTRAR / AJUSTAR METAS E BONIFICAÇÕES INDIVIDUAIS ──── */}
      {modalMetasAberto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, border: '1px solid var(--line)', maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
              <div>
                <h3 style={{ ...h3, fontSize: 18 }}>Cadastrar Metas e Comissões Individuais</h3>
                <p style={sub}>Configuração de escalonamento progressivo de metas de serviços e produtos.</p>
              </div>
              <button type="button" style={{ ...btn, padding: '4px 10px' }} onClick={() => setModalMetasAberto(false)}>✕</button>
            </div>

            <form onSubmit={salvarMetas} style={{ display: 'grid', gap: 18 }}>
              {/* SEÇÃO 1: METAS DE SERVIÇOS */}
              <div style={{ padding: 14, background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>1. Comissão e Metas de Serviços</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ex: Base 40% + 5% ao bater R$ 10k = 45%</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Base:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formMetas.percentualComissao}
                      onChange={(e) => setFormMetas({ ...formMetas, percentualComissao: Number(e.target.value) })}
                      style={{ ...input, width: 70, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 12 }}>%</span>
                  </div>
                </div>

                {/* Faixas de serviços */}
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {formMetas.faixasComissaoServico.map((faixa, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 60 }}>Meta {i + 1}:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Faturamento R$:</span>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={faixa.metaFaturamento}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setFormMetas((atual) => ({
                              ...atual,
                              faixasComissaoServico: atual.faixasComissaoServico.map((f, idx) => idx === i ? { ...f, metaFaturamento: val } : f),
                            }))
                          }}
                          style={{ ...input, width: 95 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Bônus:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="50"
                          value={faixa.bonusPercentual}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setFormMetas((atual) => ({
                              ...atual,
                              faixasComissaoServico: atual.faixasComissaoServico.map((f, idx) => idx === i ? { ...f, bonusPercentual: val } : f),
                            }))
                          }}
                          style={{ ...input, width: 65, textAlign: 'center' }}
                        />
                        <span style={{ fontSize: 11 }}>%</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ok }}>
                        = {(Number(formMetas.percentualComissao) || 40) + (Number(faixa.bonusPercentual) || 0)}%
                      </span>
                      <button type="button" style={{ ...btn, padding: '2px 8px', fontSize: 11, color: '#ef4444', marginLeft: 'auto' }} onClick={() => removerFaixaServico(i)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10 }}>
                  <button type="button" style={{ ...btn, fontSize: 11 }} onClick={adicionarFaixaServico}>
                    + Adicionar Faixa de Meta de Serviços
                  </button>
                </div>
              </div>

              {/* SEÇÃO 2: METAS DE PRODUTOS (SEPARADAS) */}
              <div style={{ padding: 14, background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <strong style={{ fontSize: 14, color: roxo }}>2. Comissão e Metas de Produtos (Separada)</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ex: Base 10% + 2% ao vender R$ 1.000 = 12%</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Base:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formMetas.percentualComissaoProduto}
                      onChange={(e) => setFormMetas({ ...formMetas, percentualComissaoProduto: Number(e.target.value) })}
                      style={{ ...input, width: 70, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 12 }}>%</span>
                  </div>
                </div>

                {/* Faixas de produtos */}
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {formMetas.faixasComissaoProduto.map((faixa, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 60 }}>Meta {i + 1}:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Vendas R$:</span>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={faixa.metaFaturamento}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setFormMetas((atual) => ({
                              ...atual,
                              faixasComissaoProduto: atual.faixasComissaoProduto.map((f, idx) => idx === i ? { ...f, metaFaturamento: val } : f),
                            }))
                          }}
                          style={{ ...input, width: 95 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Bônus:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="50"
                          value={faixa.bonusPercentual}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setFormMetas((atual) => ({
                              ...atual,
                              faixasComissaoProduto: atual.faixasComissaoProduto.map((f, idx) => idx === i ? { ...f, bonusPercentual: val } : f),
                            }))
                          }}
                          style={{ ...input, width: 65, textAlign: 'center' }}
                        />
                        <span style={{ fontSize: 11 }}>%</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: roxo }}>
                        = {(Number(formMetas.percentualComissaoProduto) || 10) + (Number(faixa.bonusPercentual) || 0)}%
                      </span>
                      <button type="button" style={{ ...btn, padding: '2px 8px', fontSize: 11, color: '#ef4444', marginLeft: 'auto' }} onClick={() => removerFaixaProduto(i)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10 }}>
                  <button type="button" style={{ ...btn, fontSize: 11 }} onClick={adicionarFaixaProduto}>
                    + Adicionar Faixa de Meta de Produtos
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <button type="button" style={btn} onClick={() => setModalMetasAberto(false)}>Cancelar</button>
                <button type="submit" style={btnPrimary} disabled={salvandoMetas}>
                  {salvandoMetas ? 'Salvando...' : 'Salvar Configurações de Metas'}
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
