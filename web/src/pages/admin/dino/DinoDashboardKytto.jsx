import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../lib/auth'
import { api, fmtR } from '../../../lib/api'

// Painel de gestão da barbearia: meta do dia, realizado, projeção pela agenda,
// produção por categoria, ranking e detalhe por profissional, e o comparativo
// entre períodos. Dados reais da unidade (mesma apuração do Desempenho da equipe).

const ROTA = '/api/admin/barbearia/painel-gestao'
const COR = {
  verde: '#16a34a', verdeClaro: '#dcfce7', azul: '#3b82f6', laranja: '#f59e0b', laranjaEscuro: '#ea580c',
  vermelho: '#dc2626', dourado: '#c99a2e', douradoClaro: '#fdf3dc', cinza: '#94a3b8', trilho: '#e5e7eb',
}
const CORES_CATEGORIA = { 'Não detalhado no Avec': '#94a3b8', Cabelo: '#16a34a', Barba: '#22c55e', 'Cabelo e barba': '#15803d', 'Serviços extras': '#4ade80', Club: '#86efac', 'Outros serviços': '#a3e635', Produtos: '#65a30d' }

const card = { background: 'var(--card, #fff)', border: '1px solid var(--line, #e5e7eb)', borderRadius: 14, padding: 18, minWidth: 0 }
const rotulo = { fontSize: 12, color: 'var(--muted, #64748b)', fontWeight: 600 }
const titulo = { margin: 0, fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }
const botao = { padding: '8px 14px', borderRadius: 10, border: '1px solid var(--line, #e5e7eb)', background: 'var(--card, #fff)', color: 'var(--fg, #0f172a)', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700 }
const botaoMeta = { ...botao, background: COR.dourado, borderColor: COR.dourado, color: '#fff' }
const campo = { padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line, #e5e7eb)', background: 'var(--card, #fff)', color: 'var(--fg, #0f172a)', font: 'inherit', fontSize: 13 }

const CSS = `
.pgk-grid{display:grid;grid-template-columns:minmax(0,2.1fr) minmax(300px,1fr);gap:18px;align-items:start}
.pgk-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.pgk-meio{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
.pgk-meta{display:grid;grid-template-columns:200px minmax(0,1fr);gap:18px;align-items:center}
.pgk-rodape{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pgk-acoes{display:flex;gap:10px;flex-wrap:wrap}
.pgk-cmp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.pgk-cmp-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
.pgk-filtros{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:12px;align-items:end}
.pgk-linha{cursor:pointer;transition:background .15s}
.pgk-rank{grid-template-columns:28px minmax(70px,1fr) 90px minmax(80px,1fr) 92px}
.pgk-linha:hover{background:rgba(201,154,46,.08)}
@media (max-width:1180px){.pgk-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){.pgk-kpis,.pgk-cmp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pgk-meio,.pgk-cmp-2{grid-template-columns:minmax(0,1fr)}.pgk-filtros{grid-template-columns:minmax(0,1fr)}}
@media (max-width:620px){.pgk-rank{grid-template-columns:28px minmax(0,1fr) auto auto}.pgk-rank-barra{display:none}.pgk-meta{grid-template-columns:minmax(0,1fr)}.pgk-rodape{grid-template-columns:minmax(0,1fr)}.pgk-kpis,.pgk-cmp-kpis{grid-template-columns:minmax(0,1fr)}}
`

function hojeCuiaba() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function somarDias(data, dias) {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
function dataBR(data) {
  if (!data) return '—'
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}
function rs(valor) {
  if (valor === null || valor === undefined) return '—'
  return fmtR(valor).replace(',00', '')
}
function rsCurto(valor) {
  const n = Number(valor || 0)
  if (Math.abs(n) >= 1000) return `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}
function pctTexto(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return '—'
  return `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
function variacaoTexto(valor) {
  if (valor === null || valor === undefined) return '—'
  const n = Number(valor)
  return `${n > 0 ? '+' : ''}${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
function qtd(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
function abrirAgenda() {
  window.open('/admin/barbearia-erp?area=operacao&tab=Agenda&tela=cheia', '_blank', 'noopener')
}

export default function DinoDashboardKytto({ onOpenTab }) {
  const { user } = useAuth()
  const [abaAtiva, setAbaAtiva] = useState('painel')
  // Acesso restrito à gestão da loja (a API confere de novo).
  const isAdmin = ['admin', 'organizador', 'gerente'].includes(String(user?.role || '').toLowerCase())
  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Acesso restrito. Apenas administradores e gerentes da loja podem acessar o painel de gestão.
      </div>
    )
  }
  const aba = (id, texto) => (
    <button
      type="button"
      onClick={() => setAbaAtiva(id)}
      style={{ padding: '10px 4px', background: 'none', border: 'none', borderBottom: abaAtiva === id ? `3px solid ${COR.dourado}` : '3px solid transparent', color: abaAtiva === id ? 'var(--fg, #0f172a)' : 'var(--muted)', fontWeight: 800, fontSize: 14, cursor: 'pointer', font: 'inherit' }}
    >{texto}</button>
  )
  return (
    <div style={{ padding: '0 0 40px', maxWidth: 1480, margin: '0 auto' }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', gap: 22, marginBottom: 18, borderBottom: '1px solid var(--line, #e5e7eb)' }}>
        {aba('painel', 'Painel de gestão')}
        {aba('comparativo', 'Comparativo de períodos')}
      </div>
      {abaAtiva === 'painel' ? <VisaoPainelGestao onOpenTab={onOpenTab} /> : <VisaoComparativo />}
    </div>
  )
}

// ── Painel do dia ─────────────────────────────────────────────────────────────
function VisaoPainelGestao({ onOpenTab }) {
  const [periodo, setPeriodo] = useState('hoje')
  const [dataEscolhida, setDataEscolhida] = useState(hojeCuiaba())
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState('')
  const [rankingPor, setRankingPor] = useState('total')
  const [categoriaPor, setCategoriaPor] = useState('valor')
  const [editandoMeta, setEditandoMeta] = useState(false)
  const requisicao = useRef(0)

  const data = periodo === 'hoje' ? hojeCuiaba() : periodo === 'ontem' ? somarDias(hojeCuiaba(), -1) : dataEscolhida

  const carregar = useCallback(async ({ fresh = false, silencioso = false } = {}) => {
    const atual = ++requisicao.current
    if (!silencioso) setCarregando(true)
    try {
      const resposta = await api.get(`${ROTA}?data=${encodeURIComponent(data)}${fresh ? '&fresh=1' : ''}`)
      if (atual !== requisicao.current) return
      setDados(resposta)
      setErro('')
    } catch (e) {
      if (atual === requisicao.current) setErro(e?.message || 'Não foi possível carregar o painel.')
    } finally {
      if (atual === requisicao.current) setCarregando(false)
    }
  }, [data])

  useEffect(() => { carregar() }, [carregar])
  // Atualização automática a cada minuto enquanto o painel mostra o dia de hoje.
  useEffect(() => {
    if (periodo !== 'hoje') return undefined
    const id = setInterval(() => { if (document.visibilityState === 'visible') carregar({ silencioso: true }) }, 60_000)
    return () => clearInterval(id)
  }, [periodo, carregar])

  const ranking = useMemo(() => dados?.ranking || [], [dados])
  useEffect(() => {
    if (!ranking.length) { setSelecionado(''); return }
    if (!ranking.some((item) => item.profissionalId === selecionado)) setSelecionado(ranking[0].profissionalId)
  }, [ranking, selecionado])

  const rankingOrdenado = useMemo(() => {
    const chave = { total: 'total', extras: 'extrasValor', produtos: 'produtos' }[rankingPor]
    return [...ranking].sort((a, b) => (b[chave] || 0) - (a[chave] || 0) || (b.total || 0) - (a.total || 0))
  }, [ranking, rankingPor])

  if (carregando && !dados) return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Carregando o painel de gestão…</div>
  if (erro && !dados) {
    return (
      <div style={{ ...card, padding: 30, textAlign: 'center' }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>{erro}</div>
        <button type="button" style={botao} onClick={() => carregar({ fresh: true })}>Tentar de novo</button>
      </div>
    )
  }
  const k = dados.kpis
  const prof = ranking.find((item) => item.profissionalId === selecionado) || null
  const temMeta = Boolean(k.meta)
  const origemMeta = {
    meta_diaria: 'meta diária definida no painel',
    soma_individuais: 'soma das metas individuais do dia',
    meta_mensal_empresa: `meta mensal da empresa (${rs(k.metaMensal)}) dividida pelos dias do mês`,
  }[k.metaOrigem] || ''

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="pgk-grid">
        <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800 }}>Painel de gestão</h1>
              <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{dataBR(dados.data)}{dados.horaAtual ? ` • ${dados.horaAtual}` : ''}</span>
                {dados.ehHoje
                  ? <span style={{ color: COR.verde, fontWeight: 600 }}>● Atualização automática a cada minuto</span>
                  : <span>Dia fechado</span>}
                {carregando && <span>Atualizando…</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={campo} aria-label="Dia do painel">
                <option value="hoje">Hoje</option>
                <option value="ontem">Ontem</option>
                <option value="data">Escolher data</option>
              </select>
              {periodo === 'data' && <input type="date" value={dataEscolhida} max={somarDias(hojeCuiaba(), 30)} onChange={(e) => e.target.value && setDataEscolhida(e.target.value)} style={campo} aria-label="Data" />}
              <button type="button" style={botao} onClick={() => carregar({ fresh: true })} title="Atualizar agora">↻</button>
              <button type="button" style={botaoMeta} onClick={() => setEditandoMeta(true)}>🎯 Editar meta</button>
            </div>
          </div>

          {/* KPIs */}
          <div className="pgk-kpis">
            <Kpi icone="🎯" titulo="Meta do dia" valor={temMeta ? rs(k.meta) : 'Não definida'} cor={temMeta ? 'var(--fg, #0f172a)' : 'var(--muted)'} detalhe={temMeta ? origemMeta : 'Clique em Editar meta'} />
            <Kpi icone="📊" titulo="Realizado" valor={rs(k.realizado)} detalhe={`${rs(k.servicos)} serviços • ${rs(k.produtos)} produtos`} />
            <Kpi icone="📈" titulo="Falta para a meta" valor={temMeta ? rs(k.falta) : '—'} extra={temMeta ? pctTexto(k.percentualFalta) : null} detalhe={temMeta && k.falta === 0 ? 'Meta batida!' : ''} />
            <Kpi icone="👥" titulo="Atendimentos concluídos" valor={qtd(k.atendimentosConcluidos)} detalhe={k.ticketMedio ? `Ticket médio ${rs(k.ticketMedio)}` : ''} />
          </div>

          {/* Acompanhamento da meta */}
          <div style={card}>
            <h3 style={titulo}><span>🎯</span> Acompanhamento da meta</h3>
            <div className="pgk-meta" style={{ marginTop: 10 }}>
              <Rosca percentual={k.percentualMeta} temMeta={temMeta} />
              <CurvaDoDia curva={dados.curva} meta={k.meta} />
            </div>
            <div className="pgk-rodape" style={{ marginTop: 12, background: 'rgba(59,130,246,.06)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 26 }}>📅</span>
                <div>
                  <div style={rotulo}>Agenda restante:</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{rs(k.agendaRestante)} previstos</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{k.atendimentosPrevistos} agendamento(s) a atender</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 26 }}>📶</span>
                <div>
                  <div style={rotulo}>Gap estimado:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: temMeta && k.gapEstimado > 0 ? COR.laranjaEscuro : COR.verde }}>{temMeta ? rs(k.gapEstimado) : '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Fechamento previsto {rs(k.projecaoFechamento)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ fontSize: 20 }}>ⓘ</span>
                <span>Previsão sujeita a alterações: soma os agendamentos do dia ainda não concluídos.</span>
              </div>
            </div>
          </div>

          {/* Categorias e ranking */}
          <div className="pgk-meio">
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <h3 style={titulo}><span>📊</span> Produção do dia por categoria</h3>
                <Alternador opcoes={[['valor', 'Valor (R$)'], ['quantidade', 'Quantidade']]} valor={categoriaPor} onChange={setCategoriaPor} />
              </div>
              <Categorias categorias={dados.categorias} por={categoriaPor} />
              {dados.extras.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                  Extras: {dados.extras.slice(0, 5).map((item) => item.servico.toLowerCase()).join(', ')}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14, marginTop: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(148,163,184,.12)', borderRadius: 12, padding: '10px 12px' }}>
                  <span style={{ fontSize: 22 }}>📦</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Pacotes vendidos: {dados.pacotes.quantidade} • {rs(dados.pacotes.valor)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Separados do realizado para evitar duplicidade</div>
                  </div>
                </div>
                <div style={{ borderLeft: '1px solid var(--line, #e5e7eb)', paddingLeft: 14 }}>
                  <div style={rotulo}>Total realizado</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: COR.verde }}>{rs(k.realizado)}</div>
                </div>
              </div>
            </div>

            <div style={card}>
              <h3 style={{ ...titulo, marginBottom: 12 }}><span>🏆</span> Ranking de produção • {dados.ehHoje ? 'Hoje' : dataBR(dados.data)}</h3>
              <Alternador opcoes={[['total', 'Faturamento'], ['extras', 'Extras'], ['produtos', 'Produtos']]} valor={rankingPor} onChange={setRankingPor} cheio />
              <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                {rankingOrdenado.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, padding: 10 }}>Nenhum profissional com agenda ou produção neste dia.</div>}
                {rankingOrdenado.map((item, indice) => (
                  <LinhaRanking key={item.profissionalId} posicao={indice + 1} item={item} por={rankingPor} selecionado={item.profissionalId === selecionado} onClick={() => setSelecionado(item.profissionalId)} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                <span>Ranking por {rankingPor === 'total' ? 'faturamento realizado' : rankingPor === 'extras' ? 'valor de extras' : 'valor de produtos'}</span>
                <span>Clique para ver os detalhes ao lado</span>
              </div>
              {k.semProfissional > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{rs(k.semProfissional)} sem profissional atribuído (entra no total).</div>}
            </div>
          </div>
        </div>

        {/* Painel lateral do profissional */}
        <DetalheProfissional prof={prof} ehHoje={dados.ehHoje} horaAtual={dados.horaAtual} />
      </div>

      {/* Como buscar a meta */}
      <ComoBuscarMeta k={k} acoes={dados.acoes} ehHoje={dados.ehHoje} onOpenTab={onOpenTab} />

      {/* Alertas da agenda */}
      {dados.alertas.length > 0 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 12, padding: '12px 16px', fontSize: 13 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <strong>Agenda:</strong>
          {dados.alertas.map((alerta, indice) => (
            <span key={`${alerta.tipo}-${alerta.profissionalId}-${indice}`} style={{ display: 'inline-flex', gap: 6 }}>
              {indice > 0 && <span style={{ color: 'var(--muted)' }}>|</span>}
              <button type="button" onClick={() => setSelecionado(alerta.profissionalId)} style={{ background: 'none', border: 'none', padding: 0, color: COR.vermelho, fontWeight: 700, cursor: 'pointer', font: 'inherit' }}>{alerta.profissional}</button>
              <span style={{ color: COR.vermelho }}>• {alerta.texto}</span>
            </span>
          ))}
        </div>
      )}

      <details style={{ fontSize: 12, color: 'var(--muted)' }}>
        <summary style={{ cursor: 'pointer' }}>Como os números são calculados</summary>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          {dados.definicoes.map((texto) => <li key={texto}>{texto}</li>)}
        </ul>
      </details>

      {editandoMeta && (
        <EditarMeta
          dados={dados}
          onFechar={() => setEditandoMeta(false)}
          onSalvo={() => { setEditandoMeta(false); carregar({ fresh: true }) }}
        />
      )}
    </div>
  )
}

function Kpi({ icone, titulo: texto, valor, extra, detalhe, cor }) {
  return (
    <div style={{ ...card, display: 'flex', gap: 14, alignItems: 'center', padding: '16px 18px' }}>
      <div style={{ fontSize: 30 }}>{icone}</div>
      <div style={{ minWidth: 0 }}>
        <div style={rotulo}>{texto}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: cor || 'var(--fg, #0f172a)', whiteSpace: 'nowrap' }}>
          {valor}{extra && <span style={{ color: COR.laranjaEscuro }}> • {extra}</span>}
        </div>
        {detalhe && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{detalhe}</div>}
      </div>
    </div>
  )
}

function Alternador({ opcoes, valor, onChange, cheio }) {
  return (
    <div style={{ display: cheio ? 'grid' : 'inline-flex', gridTemplateColumns: cheio ? `repeat(${opcoes.length}, 1fr)` : undefined, border: '1px solid var(--line, #e5e7eb)', borderRadius: 10, overflow: 'hidden' }}>
      {opcoes.map(([id, texto]) => (
        <button key={id} type="button" onClick={() => onChange(id)} style={{ padding: '7px 14px', border: 'none', background: valor === id ? '#0f2a44' : 'transparent', color: valor === id ? '#fff' : 'var(--fg, #0f172a)', fontWeight: 700, fontSize: 12, cursor: 'pointer', font: 'inherit' }}>{texto}</button>
      ))}
    </div>
  )
}

function Rosca({ percentual, temMeta }) {
  const valor = Math.max(0, Math.min(100, Number(percentual || 0)))
  const raio = 70
  const circ = 2 * Math.PI * raio
  return (
    <div style={{ display: 'grid', placeItems: 'center' }}>
      <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label={temMeta ? `${pctTexto(percentual)} da meta atingida` : 'Meta não definida'}>
        <circle cx="90" cy="90" r={raio} fill="none" stroke={COR.trilho} strokeWidth="18" />
        {temMeta && <circle cx="90" cy="90" r={raio} fill="none" stroke={COR.verde} strokeWidth="18" strokeDasharray={`${(valor / 100) * circ} ${circ}`} transform="rotate(-90 90 90)" strokeLinecap="butt" />}
        <text x="90" y="88" textAnchor="middle" fontSize="34" fontWeight="800" fill="currentColor">{temMeta ? pctTexto(percentual).replace(',0', '') : '—'}</text>
        <text x="90" y="112" textAnchor="middle" fontSize="12" fill="#64748b">{temMeta ? 'da meta atingida' : 'sem meta'}</text>
      </svg>
    </div>
  )
}

function CurvaDoDia({ curva = [], meta }) {
  const L = 640
  const A = 220
  const m = { e: 46, d: 16, t: 28, b: 28 }
  const valores = curva.flatMap((p) => [p.realizado, p.projecao]).filter((v) => Number.isFinite(v))
  const maximo = Math.max(Number(meta || 0), ...valores, 100) * 1.08
  const minutos = curva.map((p) => p.minuto)
  const minX = Math.min(...minutos)
  const maxX = Math.max(...minutos)
  const x = (minuto) => m.e + ((minuto - minX) / Math.max(1, maxX - minX)) * (L - m.e - m.d)
  const y = (v) => A - m.b - (v / maximo) * (A - m.t - m.b)
  const realizados = curva.filter((p) => Number.isFinite(p.realizado))
  const projetados = curva.filter((p) => Number.isFinite(p.projecao))
  const caminho = (pontos, chave) => pontos.map((p, i) => `${i ? 'L' : 'M'}${x(p.minuto).toFixed(1)},${y(p[chave]).toFixed(1)}`).join(' ')
  const area = realizados.length ? `${caminho(realizados, 'realizado')} L${x(realizados.at(-1).minuto).toFixed(1)},${y(0)} L${x(realizados[0].minuto).toFixed(1)},${y(0)} Z` : ''
  const areaProj = projetados.length ? `${caminho(projetados, 'projecao')} L${x(projetados.at(-1).minuto).toFixed(1)},${y(0)} L${x(projetados[0].minuto).toFixed(1)},${y(0)} Z` : ''
  const ultimo = realizados.at(-1)
  const fimProj = projetados.at(-1)
  const marcas = curva.filter((p) => !p.agora && (p.minuto / 60) % 3 === (Math.round(minX / 60) % 3))
  const grade = [0, 0.5, 1].map((f) => maximo / 1.08 * f)
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, marginBottom: 4 }}>
        <strong style={{ fontSize: 13 }}>Faturamento ao longo do dia</strong>
        <span style={{ color: COR.verde }}>● Realizado</span>
        <span style={{ color: COR.azul }}>- - - Projeção</span>
        {meta ? <span style={{ color: COR.laranja }}>- - - Meta do dia</span> : null}
      </div>
      <svg viewBox={`0 0 ${L} ${A}`} width="100%" role="img" aria-label="Faturamento acumulado ao longo do dia">
        {grade.map((v) => (
          <g key={v}>
            <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity=".08" />
            <text x={m.e - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">{rsCurto(v)}</text>
          </g>
        ))}
        {marcas.map((p) => (
          <g key={p.minuto}>
            <line x1={x(p.minuto)} x2={x(p.minuto)} y1={m.t} y2={y(0)} stroke="currentColor" strokeOpacity=".06" />
            <text x={x(p.minuto)} y={A - 8} textAnchor="middle" fontSize="11" fill="#64748b">{p.hora}</text>
          </g>
        ))}
        {areaProj && <path d={areaProj} fill={COR.azul} fillOpacity=".07" />}
        {area && <path d={area} fill={COR.verde} fillOpacity=".14" />}
        {meta ? (
          <g>
            <line x1={m.e} x2={L - m.d} y1={y(meta)} y2={y(meta)} stroke={COR.laranja} strokeWidth="2" strokeDasharray="6 5" />
            <text x={L - m.d} y={y(meta) - 7} textAnchor="end" fontSize="12" fontWeight="700" fill={COR.laranjaEscuro}>Meta {rs(meta)}</text>
          </g>
        ) : null}
        {projetados.length > 1 && <path d={caminho(projetados, 'projecao')} fill="none" stroke={COR.azul} strokeWidth="2" strokeDasharray="6 5" />}
        {realizados.length > 0 && <path d={caminho(realizados, 'realizado')} fill="none" stroke={COR.verde} strokeWidth="3" />}
        {realizados.map((p) => <circle key={`r${p.minuto}`} cx={x(p.minuto)} cy={y(p.realizado)} r={p.agora ? 6 : 3} fill={COR.verde} />)}
        {ultimo && <text x={x(ultimo.minuto) + 8} y={y(ultimo.realizado) - 8} fontSize="13" fontWeight="800" fill={COR.verde}>{rs(ultimo.realizado)}</text>}
        {fimProj && projetados.length > 1 && (
          <g>
            <circle cx={x(fimProj.minuto)} cy={y(fimProj.projecao)} r="5" fill={COR.azul} />
            <text x={x(fimProj.minuto) - 8} y={y(fimProj.projecao) + 18} textAnchor="end" fontSize="12" fill={COR.azul}>Projeção {rs(fimProj.projecao)}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

function Categorias({ categorias = [], por }) {
  if (!categorias.length) return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '10px 0' }}>Ainda não há produção registrada neste dia.</div>
  const chave = por === 'valor' ? 'valor' : 'quantidade'
  const maximo = Math.max(...categorias.map((item) => item[chave]), 1)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {categorias.map((item) => (
        <div key={item.categoria} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 80px', gap: 12, alignItems: 'center', fontSize: 14 }}>
          <div style={{ fontWeight: 700 }}>{item.categoria}</div>
          <div style={{ height: 14, background: COR.trilho, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(item[chave] / maximo) * 100}%`, height: '100%', background: CORES_CATEGORIA[item.categoria] || COR.verde }} />
          </div>
          <div style={{ textAlign: 'right', fontWeight: 800 }}>{por === 'valor' ? rs(item.valor) : qtd(item.quantidade)}</div>
        </div>
      ))}
    </div>
  )
}

function LinhaRanking({ posicao, item, por, selecionado, onClick }) {
  const valor = por === 'total' ? item.total : por === 'extras' ? item.extrasValor : item.produtos
  const detalhe = por === 'extras' ? `${qtd(item.extrasQuantidade)} extra(s)` : por === 'produtos' ? `${qtd(item.produtosQuantidade)} un.` : null
  const medalha = posicao === 1 ? COR.laranja : posicao === 2 ? '#94a3b8' : posicao === 3 ? '#c2410c' : '#64748b'
  const percentual = item.percentualMeta
  return (
    <div className="pgk-linha pgk-rank" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      style={{ display: 'grid', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 10, background: selecionado ? 'rgba(245,158,11,.12)' : undefined, border: selecionado ? '1px solid rgba(245,158,11,.4)' : '1px solid transparent' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: medalha, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>{posicao}</div>
      <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</div>
      <div style={{ fontWeight: 800 }}>{rs(valor)}</div>
      <div className="pgk-rank-barra" style={{ height: 9, background: COR.trilho, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, percentual || 0)}%`, height: '100%', background: COR.verde }} />
      </div>
      <div style={{ fontSize: 12, color: percentual !== null ? COR.verde : 'var(--muted)', fontWeight: 700, textAlign: 'right' }}>
        {detalhe || (percentual !== null ? `${pctTexto(percentual)} da meta` : 'sem meta')}
      </div>
    </div>
  )
}

function DetalheProfissional({ prof, ehHoje, horaAtual }) {
  const [aba, setAba] = useState('producao')
  if (!prof) {
    return <div style={{ ...card, color: 'var(--muted)', fontSize: 13 }}>Escolha um profissional no ranking para ver os detalhes.</div>
  }
  const temMeta = Boolean(prof.meta)
  const a = prof.agenda
  const totalExtras = prof.extras.reduce((soma, item) => soma + item.quantidade, 0)
  return (
    <aside style={{ ...card, position: 'sticky', top: 12, display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{prof.nome}</h2>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Detalhes do profissional</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{ehHoje ? `Hoje • atualizado às ${horaAtual}` : 'Dia selecionado'}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--line, #e5e7eb)' }}>
        {[['producao', 'Produção'], ['agenda', 'Agenda']].map(([id, texto]) => (
          <button key={id} type="button" onClick={() => setAba(id)} style={{ padding: '10px 0', background: 'none', border: 'none', borderBottom: aba === id ? `3px solid ${COR.dourado}` : '3px solid transparent', color: aba === id ? COR.dourado : 'var(--fg, #0f172a)', fontWeight: 800, fontSize: 15, cursor: 'pointer', font: 'inherit' }}>{texto}</button>
        ))}
      </div>

      {aba === 'producao' ? (
        <>
          <div style={{ ...card, padding: 14, background: 'rgba(148,163,184,.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={rotulo}>Total realizado {ehHoje ? 'hoje' : 'no dia'}</div>
              <div style={{ color: COR.verde, fontWeight: 800, fontSize: 20 }}>{temMeta ? pctTexto(prof.percentualMeta) : ''}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 30, fontWeight: 800 }}>{rs(prof.total)}</div>
              <div style={{ flex: 1, maxWidth: 160 }}>
                <div style={{ height: 10, background: COR.trilho, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, prof.percentualMeta || 0)}%`, height: '100%', background: COR.verde }} />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, textAlign: 'right', color: 'var(--muted)', marginTop: 4 }}>
              {temMeta ? <>Meta individual: <strong style={{ color: 'var(--fg, #0f172a)' }}>{rs(prof.meta)}</strong>{prof.metaOrigem === 'meta_mensal' ? ` (mensal ${rs(prof.metaMensal)})` : ''}</> : 'Sem meta individual'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ ...card, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ fontSize: 22 }}>✂️</span><div><div style={rotulo}>Serviços</div><div style={{ fontWeight: 800, fontSize: 18 }}>{rs(prof.servicos)}</div></div></div>
            <div style={{ ...card, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ fontSize: 22 }}>🧴</span><div><div style={rotulo}>Produtos</div><div style={{ fontWeight: 800, fontSize: 18 }}>{rs(prof.produtos)}</div></div></div>
          </div>
          
          {(prof.metasServico?.faixaAtual || prof.metasProduto?.faixaAtual) && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8, color: '#334155' }}>Bonificações progressivas</div>
              <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                {prof.metasServico?.faixaAtual && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>Serviços ({prof.metasServico.percentualEfetivo}%)</span>
                      <span style={{ color: prof.metasServico.faltaParaProxima > 0 ? '#f59e0b' : COR.verde, fontWeight: 700 }}>
                        {prof.metasServico.faltaParaProxima > 0 ? `Falta ${rs(prof.metasServico.faltaParaProxima)}` : 'Meta máxima!'}
                      </span>
                    </div>
                    {prof.metasServico.proximaFaixa && (
                      <div style={{ height: 6, background: COR.trilho, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, prof.metasServico.progressoPct)}%`, height: '100%', background: '#f59e0b' }} />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{prof.metasServico.mensagemStatus}</div>
                  </div>
                )}
                {prof.metasProduto?.faixaAtual && (
                  <div style={{ borderTop: prof.metasServico?.faixaAtual ? '1px dashed #cbd5e1' : 'none', paddingTop: prof.metasServico?.faixaAtual ? 8 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>Produtos ({prof.metasProduto.percentualEfetivo}%)</span>
                      <span style={{ color: prof.metasProduto.faltaParaProxima > 0 ? '#f59e0b' : COR.verde, fontWeight: 700 }}>
                        {prof.metasProduto.faltaParaProxima > 0 ? `Falta ${rs(prof.metasProduto.faltaParaProxima)}` : 'Meta máxima!'}
                      </span>
                    </div>
                    {prof.metasProduto.proximaFaixa && (
                      <div style={{ height: 6, background: COR.trilho, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, prof.metasProduto.progressoPct)}%`, height: '100%', background: '#f59e0b' }} />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{prof.metasProduto.mensagemStatus}</div>
                  </div>
                )}
              </div>
            </div>
          )}
<div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Produção por categoria</div>
            {prof.categorias.length ? <Categorias categorias={prof.categorias} por="valor" /> : <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sem produção registrada.</div>}
          </div>
          <div style={{ background: COR.douradoClaro, border: '1px solid rgba(201,154,46,.35)', borderRadius: 12, padding: 12, color: '#3f2d06' }}>
            <div style={{ fontWeight: 800, color: '#8a5a00', marginBottom: 6 }}>Detalhamento dos extras</div>
            {prof.extras.length ? (
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead><tr style={{ color: '#7c6a45', fontSize: 11 }}><th style={{ textAlign: 'left', fontWeight: 600 }}>Serviço</th><th style={{ fontWeight: 600 }}>Qtd.</th><th style={{ textAlign: 'right', fontWeight: 600 }}>Valor</th></tr></thead>
                <tbody>
                  {prof.extras.map((item) => (
                    <tr key={item.servico}><td style={{ padding: '4px 0' }}>{item.servico}</td><td style={{ textAlign: 'center' }}>{qtd(item.quantidade)}</td><td style={{ textAlign: 'right' }}>{rs(item.valor)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <div style={{ fontSize: 13 }}>Nenhum extra vendido.</div>}
            <div style={{ textAlign: 'right', fontWeight: 800, marginTop: 6, borderTop: '1px solid rgba(201,154,46,.35)', paddingTop: 6 }}>{qtd(totalExtras)} extra(s) • {rs(prof.extrasValor)}</div>
          </div>
        </>
      ) : null}

      <div>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Agenda {ehHoje ? 'de hoje' : 'do dia'}</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 7, fontSize: 14 }}>
          <li>✅ <strong>{a.concluidos}</strong> atendimento(s) concluído(s)</li>
          <li>🕒 <strong>{a.proximos}</strong> próximo(s) atendimento(s){a.valorPrevisto ? ` • ${rs(a.valorPrevisto)} previstos` : ''}</li>
          <li style={{ color: a.cancelamentos ? COR.vermelho : undefined }}>❌ <strong>{a.cancelamentos}</strong> cancelamento(s)</li>
          {a.faltas > 0 && <li style={{ color: COR.vermelho }}>🚫 <strong>{a.faltas}</strong> falta(s)</li>}
          {a.pontualidade && <li style={{ color: a.pontualidade === 'em_dia' ? COR.verde : COR.laranjaEscuro }}>{a.pontualidade === 'em_dia' ? '✔️ Pontualidade: em dia' : `⏱️ Pontualidade: ${a.atrasos.length} atraso(s), maior de ${Math.max(...a.atrasos.map((x) => x.minutos))} min`}</li>}
        </ul>
        {aba === 'agenda' && a.proximosHorarios.length > 0 && (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 10 }}>
            <thead><tr style={{ color: 'var(--muted)', fontSize: 11 }}><th style={{ textAlign: 'left' }}>Hora</th><th style={{ textAlign: 'left' }}>Cliente</th><th style={{ textAlign: 'left' }}>Serviço</th><th style={{ textAlign: 'right' }}>Previsto</th></tr></thead>
            <tbody>
              {a.proximosHorarios.map((item) => (
                <tr key={item.agendamentoId} style={{ borderTop: '1px solid var(--line, #e5e7eb)' }}>
                  <td style={{ padding: '6px 0' }}>{item.horario || '—'}</td>
                  <td>{item.cliente || '—'}</td>
                  <td>{item.servico || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{item.valorPrevisto ? rs(item.valorPrevisto) : 'plano'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {aba === 'agenda' && a.listaCancelamentos.length > 0 && (
          <div style={{ fontSize: 12, color: COR.vermelho, marginTop: 8 }}>Cancelados: {a.listaCancelamentos.map((item) => `${item.horario || 's/ hora'}${item.cliente ? ` (${item.cliente})` : ''}`).join(', ')}</div>
        )}
      </div>
      {(ehHoje || prof.horarioLivre) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: COR.douradoClaro, border: '1px solid rgba(201,154,46,.35)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#3f2d06' }}>📅 {prof.horarioLivre ? `Horário disponível às ${prof.horarioLivre}` : 'Sem horário livre no restante do dia'}</div>
          <button type="button" onClick={abrirAgenda} style={{ ...botao, background: '#a16207', borderColor: '#a16207', color: '#fff', padding: '6px 12px' }}>Ver na agenda</button>
        </div>
      )}
    </aside>
  )
}

function ComoBuscarMeta({ k, acoes, ehHoje, onOpenTab }) {
  let mensagem
  if (!k.meta) mensagem = 'Defina a meta do dia em “Editar meta” para acompanhar quanto falta.'
  else if (k.realizado >= k.meta) mensagem = `Meta batida: ${rs(k.realizado)} de ${rs(k.meta)}.`
  else if (!k.gapEstimado) mensagem = `Com a agenda prevista (${rs(k.agendaRestante)}), a meta fecha. Garanta as confirmações.`
  else mensagem = <>Com a agenda prevista, faltam <strong style={{ color: COR.laranjaEscuro }}>{rs(k.gapEstimado)}</strong>.</>
  const descricao = Object.fromEntries((acoes || []).map((item) => [item.id, item.descricao]))
  const acao = (icone, texto, id, onClick) => (
    <button type="button" onClick={onClick} title={descricao[id] || ''} style={{ ...botao, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 14 }}>
      <span style={{ color: COR.azul, fontSize: 18 }}>{icone}</span> {texto}
    </button>
  )
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: COR.douradoClaro, border: '1px solid rgba(201,154,46,.35)', borderRadius: 14, padding: '14px 18px', color: '#3f2d06' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 30 }}>💡</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#9a3412' }}>Como buscar a meta {ehHoje ? 'hoje' : 'do dia'}</div>
          <div style={{ fontSize: 14 }}>{mensagem}</div>
          {acoes?.length > 0 && <div style={{ fontSize: 12, marginTop: 4, color: '#6b5420' }}>{acoes[0].descricao}</div>}
        </div>
      </div>
      <div className="pgk-acoes">
        {acao('📅', 'Preencher horários', 'preencher', abrirAgenda)}
        {acao('＋', 'Oferecer extras', 'extras', () => onOpenTab?.('Retorno previsto'))}
        {acao('🛒', 'Sugerir produtos', 'produtos', () => onOpenTab?.('Vendas de revenda'))}
      </div>
    </div>
  )
}

function EditarMeta({ dados, onFechar, onSalvo }) {
  const [equipe, setEquipe] = useState(dados.metas.metaEquipe ?? '')
  const [individuais, setIndividuais] = useState(() => Object.fromEntries(dados.ranking.map((item) => [item.profissionalId, dados.metas.individuais[item.profissionalId] ?? ''])))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const somaIndividuais = Object.values(individuais).reduce((soma, valor) => soma + (Number(String(valor).replace(',', '.')) || 0), 0)
  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const conv = (v) => (v === '' || v === null ? null : Number(String(v).replace(',', '.')))
      await api.put(`${ROTA}/metas`, { metaEquipe: conv(equipe), individuais: Object.fromEntries(Object.entries(individuais).map(([id, v]) => [id, conv(v)])) })
      onSalvo()
    } catch (e) {
      setErro(e?.message || 'Não foi possível salvar as metas.')
      setSalvando(false)
    }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Editar meta do dia" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div style={{ ...card, width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto', display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={titulo}>🎯 Meta diária</h3>
          <button type="button" onClick={onFechar} style={{ ...botao, border: 'none' }} aria-label="Fechar">✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Vale para todos os dias até ser alterada. Sem meta diária, o painel usa a meta mensal (Ocupação e metas) dividida pelos dias de trabalho.</div>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700 }}>Meta da equipe por dia (R$)</span>
          <input type="number" min="0" step="50" value={equipe} onChange={(e) => setEquipe(e.target.value)} placeholder={somaIndividuais ? `Soma das individuais: ${somaIndividuais}` : 'Ex.: 3000'} style={campo} />
        </label>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Meta individual por dia (R$)</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {dados.ranking.map((item) => (
              <label key={item.profissionalId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: 10, alignItems: 'center' }}>
                <span>{item.nomeCompleto || item.nome}{item.metaOrigem === 'meta_mensal' ? <small style={{ color: 'var(--muted)' }}> • hoje {rs(item.meta)} pela meta mensal</small> : null}</span>
                <input type="number" min="0" step="50" value={individuais[item.profissionalId] ?? ''} onChange={(e) => setIndividuais((atual) => ({ ...atual, [item.profissionalId]: e.target.value }))} style={campo} aria-label={`Meta diária de ${item.nome}`} />
              </label>
            ))}
          </div>
        </div>
        {erro && <div style={{ color: COR.vermelho, fontSize: 13 }}>{erro}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" style={botao} onClick={onFechar}>Cancelar</button>
          <button type="button" style={botaoMeta} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar metas'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Comparativo de períodos ───────────────────────────────────────────────────
function periodosPadrao(tipo) {
  const hoje = hojeCuiaba()
  if (tipo === 'hoje') return { inicioA: hoje, fimA: hoje, inicioB: somarDias(hoje, -7), fimB: somarDias(hoje, -7) }
  if (tipo === 'semana') return { inicioA: somarDias(hoje, -6), fimA: hoje, inicioB: somarDias(hoje, -13), fimB: somarDias(hoje, -7) }
  // Mês: do dia 1 até hoje contra o mesmo trecho do mês anterior.
  const [ano, mes, dia] = hoje.split('-').map(Number)
  const inicioA = `${hoje.slice(0, 7)}-01`
  const anterior = new Date(Date.UTC(ano, mes - 2, 1))
  const ultimoDiaAnterior = new Date(Date.UTC(ano, mes - 1, 0)).getUTCDate()
  const inicioB = anterior.toISOString().slice(0, 10)
  const fimB = `${inicioB.slice(0, 7)}-${String(Math.min(dia, ultimoDiaAnterior)).padStart(2, '0')}`
  return { inicioA, fimA: hoje, inicioB, fimB }
}

function nomePeriodo(inicio, fim) {
  if (inicio === fim) return dataBR(inicio)
  return `${dataBR(inicio).slice(0, 5)} a ${dataBR(fim)}`
}

function VisaoComparativo() {
  const [preset, setPreset] = useState('mes')
  const [filtros, setFiltros] = useState(() => periodosPadrao('mes'))
  const [aplicado, setAplicado] = useState(() => periodosPadrao('mes'))
  const [profissionalId, setProfissionalId] = useState('')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState('')
  const requisicao = useRef(0)

  useEffect(() => {
    const atual = ++requisicao.current
    setCarregando(true)
    const q = new URLSearchParams({ ...aplicado, ...(profissionalId ? { profissionalId } : {}) })
    api.get(`${ROTA}/comparativo?${q}`)
      .then((resposta) => { if (atual === requisicao.current) { setDados(resposta); setErro('') } })
      .catch((e) => { if (atual === requisicao.current) setErro(e?.message || 'Não foi possível comparar os períodos.') })
      .finally(() => { if (atual === requisicao.current) setCarregando(false) })
  }, [aplicado, profissionalId])

  const profissionais = useMemo(() => dados?.profissionais || [], [dados])
  useEffect(() => {
    const reais = profissionais.filter((item) => !item.sintetico)
    if (reais.length && !reais.some((item) => item.profissionalId === selecionado)) setSelecionado(reais[0].profissionalId)
  }, [profissionais, selecionado])

  const escolherPreset = (tipo) => {
    setPreset(tipo)
    const p = periodosPadrao(tipo)
    setFiltros(p)
    setAplicado(p)
  }
  const rotA = dados ? nomePeriodo(dados.a.inicio, dados.a.fim) : ''
  const rotB = dados ? nomePeriodo(dados.b.inicio, dados.b.fim) : ''
  const individual = profissionais.find((item) => item.profissionalId === selecionado && !item.sintetico)
  const listaEquipe = dados?.a?.porProfissional || []

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Comparativo de períodos</h1>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Compare o desempenho da barbearia entre dois períodos</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['personalizado', 'Personalizado']].map(([id, texto]) => (
            <button key={id} type="button" onClick={() => (id === 'personalizado' ? setPreset(id) : escolherPreset(id))} style={preset === id ? { ...botao, background: COR.douradoClaro, borderColor: COR.dourado, color: '#8a5a00' } : botao}>{texto}</button>
          ))}
        </div>
      </div>

      <div style={card}>
        <div className="pgk-filtros">
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={rotulo}>Período A</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={filtros.inicioA} onChange={(e) => { setPreset('personalizado'); setFiltros((f) => ({ ...f, inicioA: e.target.value })) }} style={{ ...campo, flex: 1, minWidth: 0 }} aria-label="Início do período A" />
              <input type="date" value={filtros.fimA} onChange={(e) => { setPreset('personalizado'); setFiltros((f) => ({ ...f, fimA: e.target.value })) }} style={{ ...campo, flex: 1, minWidth: 0 }} aria-label="Fim do período A" />
            </div>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={rotulo}>Comparar com</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={filtros.inicioB} onChange={(e) => { setPreset('personalizado'); setFiltros((f) => ({ ...f, inicioB: e.target.value })) }} style={{ ...campo, flex: 1, minWidth: 0 }} aria-label="Início do período B" />
              <input type="date" value={filtros.fimB} onChange={(e) => { setPreset('personalizado'); setFiltros((f) => ({ ...f, fimB: e.target.value })) }} style={{ ...campo, flex: 1, minWidth: 0 }} aria-label="Fim do período B" />
            </div>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={rotulo}>Equipe</span>
            <select value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)} style={campo}>
              <option value="">Toda a equipe</option>
              {listaEquipe.filter((item) => item.ativo || item.faturamento > 0).map((item) => <option key={item.profissionalId} value={item.profissionalId}>{item.nome}</option>)}
            </select>
          </label>
          <button type="button" style={{ ...botaoMeta, height: 38 }} onClick={() => setAplicado({ ...filtros })}>⇌ Aplicar comparação</button>
        </div>
        {dados && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Período A: {dados.a.dias} dia(s) • Período B: {dados.b.dias} dia(s){dados.a.dias !== dados.b.dias ? ' • períodos de tamanhos diferentes' : ''}</div>}
      </div>

      {erro && <div style={{ ...card, color: COR.vermelho }}>{erro}</div>}
      {carregando && !dados && <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>Comparando períodos…</div>}
      {dados && (
        <>
          <div className="pgk-cmp-kpis" style={{ opacity: carregando ? 0.6 : 1 }}>
            <KpiComparativo icone="📊" titulo="Faturamento" a={rs(dados.kpis.faturamento.a)} b={rs(dados.kpis.faturamento.b)} variacao={dados.kpis.faturamento.variacao} diferenca={`${dados.kpis.faturamento.diferenca >= 0 ? '+' : '−'} ${rs(Math.abs(dados.kpis.faturamento.diferenca))}`} rotA={rotA} rotB={rotB} />
            <KpiComparativo icone="👥" titulo="Atendimentos" a={qtd(dados.kpis.atendimentos.a)} b={qtd(dados.kpis.atendimentos.b)} variacao={dados.kpis.atendimentos.variacao} diferenca={`${dados.kpis.atendimentos.diferenca >= 0 ? '+' : '−'} ${qtd(Math.abs(dados.kpis.atendimentos.diferenca))} atendimentos`} rotA={rotA} rotB={rotB} />
            <KpiComparativo icone="📈" titulo="Ticket médio (serviços)" a={rs(dados.kpis.ticketMedio.a)} b={rs(dados.kpis.ticketMedio.b)} variacao={dados.kpis.ticketMedio.variacao} diferenca={dados.kpis.ticketMedio.diferenca !== null ? `${dados.kpis.ticketMedio.diferenca >= 0 ? '+' : '−'} ${fmtR(Math.abs(dados.kpis.ticketMedio.diferenca))}` : ''} rotA={rotA} rotB={rotB} />
            <KpiComparativo icone="🕒" titulo="Ocupação da agenda" a={dados.kpis.ocupacao.a === null ? 'Sem dado' : pctTexto(dados.kpis.ocupacao.a)} b={dados.kpis.ocupacao.b === null ? 'Sem dado' : pctTexto(dados.kpis.ocupacao.b)} variacaoTexto={dados.kpis.ocupacao.diferencaPontos !== null ? `${dados.kpis.ocupacao.diferencaPontos >= 0 ? '+' : ''}${dados.kpis.ocupacao.diferencaPontos.toLocaleString('pt-BR')} p.p.` : '—'} positivo={dados.kpis.ocupacao.diferencaPontos >= 0} rotA={rotA} rotB={rotB} />
          </div>

          <div className="pgk-cmp-kpis" style={{ opacity: carregando ? 0.6 : 1 }}>
            <KpiComparativo icone="🙋" titulo="Clientes atendidos" a={qtd(dados.kpis.clientes?.a)} b={qtd(dados.kpis.clientes?.b)} variacao={dados.kpis.clientes?.variacao} diferenca={dados.kpis.clientes ? `${dados.kpis.clientes.diferenca >= 0 ? '+' : '−'} ${qtd(Math.abs(dados.kpis.clientes.diferenca))} clientes` : ''} rotA={rotA} rotB={rotB} />
            <KpiComparativo icone="➕" titulo="Serviços extras" a={rs(dados.kpis.extras?.a)} b={rs(dados.kpis.extras?.b)} variacao={dados.kpis.extras?.variacao} diferenca={dados.kpis.extras ? `${dados.kpis.extras.diferenca >= 0 ? '+' : '−'} ${rs(Math.abs(dados.kpis.extras.diferenca))}` : ''} rotA={rotA} rotB={rotB} />
            <KpiComparativo icone="🧴" titulo="Produtos" a={dados.kpis.produtos?.a === null ? 'Sem dado' : rs(dados.kpis.produtos?.a)} b={dados.kpis.produtos?.b === null ? 'Sem dado' : rs(dados.kpis.produtos?.b)} variacao={dados.kpis.produtos?.variacao} diferenca={dados.kpis.produtos?.diferenca !== null && dados.kpis.produtos?.diferenca !== undefined ? `${dados.kpis.produtos.diferenca >= 0 ? '+' : '−'} ${rs(Math.abs(dados.kpis.produtos.diferenca))}` : 'Avec não detalha produto'} rotA={rotA} rotB={rotB} />
            <KpiComparativo icone="🧾" titulo="Não detalhado no Avec" a={rs(dados.kpis.naoDetalhado?.a || 0)} b={rs(dados.kpis.naoDetalhado?.b || 0)} variacaoTexto="planos, pacotes e produtos" positivo diferenca="entra no faturamento" rotA={rotA} rotB={rotB} />
          </div>

          <div className="pgk-cmp-2">
            <div style={card}>
              <CabecalhoComparativo titulo="Receita por categoria" rotA={rotA} rotB={rotB} />
              <BarrasDuplas categorias={dados.categorias} />
            </div>
            <div style={card}>
              <CabecalhoComparativo titulo="Evolução do faturamento acumulado" rotA={rotA} rotB={rotB} />
              <Acumulado serieA={dados.a.serie} serieB={dados.b.serie} />
            </div>
          </div>

          <div className="pgk-cmp-2">
            <div style={card}>
              <CabecalhoComparativo titulo="Comparativo por profissional" rotA="A" rotB="B" />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--line, #e5e7eb)' }}>
                      <th style={{ padding: '0 0 8px', fontWeight: 600 }}>Profissional</th>
                      <th style={{ padding: '0 0 8px', fontWeight: 600 }}>Total A</th>
                      <th style={{ padding: '0 0 8px', fontWeight: 600 }}>Total B</th>
                      <th style={{ padding: '0 0 8px', fontWeight: 600, textAlign: 'right' }}>Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profissionais.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: 'var(--muted)' }}>Sem produção atribuída nos períodos.</td></tr>}
                    {profissionais.map((item) => {
                      const maximo = Math.max(...profissionais.map((p) => Math.max(p.a.faturamento, p.b.faturamento)), 1)
                      const ativo = item.profissionalId === selecionado
                      return (
                        <tr key={item.profissionalId} className={item.sintetico ? undefined : 'pgk-linha'} onClick={() => { if (!item.sintetico) setSelecionado(item.profissionalId) }} style={{ borderBottom: '1px solid var(--line, #e5e7eb)', background: ativo ? 'rgba(245,158,11,.1)' : undefined, color: item.sintetico ? 'var(--muted)' : undefined, fontStyle: item.sintetico ? 'italic' : undefined }}>
                          <td style={{ padding: '10px 0', fontWeight: ativo ? 800 : 600 }} title={item.sintetico ? 'Extrato do Avec não detalhado por profissional (planos, pacotes, produtos) e vendas sem profissional' : undefined}>{item.nome}</td>
                          <td><div style={{ fontWeight: 700 }}>{rs(item.a.faturamento)}</div><div style={{ height: 6, width: `${(item.a.faturamento / maximo) * 100}%`, background: COR.verde, borderRadius: 3, marginTop: 3 }} /></td>
                          <td><div>{rs(item.b.faturamento)}</div><div style={{ height: 6, width: `${(item.b.faturamento / maximo) * 100}%`, background: COR.azul, borderRadius: 3, marginTop: 3 }} /></td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: item.variacao === null ? 'var(--muted)' : item.variacao >= 0 ? COR.verde : COR.vermelho }}>{variacaoTexto(item.variacao)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...card, background: 'rgba(148,163,184,.06)' }}>
              {individual ? <ComparacaoIndividual item={individual} rotA={rotA} rotB={rotB} /> : <div style={{ color: 'var(--muted)', fontSize: 13 }}>Escolha um profissional na tabela.</div>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: COR.verdeClaro, border: '1px solid #a7f3d0', borderRadius: 12, padding: '12px 14px', color: '#065f46' }}>
            <span style={{ fontSize: 22 }}>💡</span>
            <div><strong>O que mudou na equipe: </strong>{dados.leitura}</div>
          </div>
          <details style={{ fontSize: 12, color: 'var(--muted)' }}>
            <summary style={{ cursor: 'pointer' }}>Como os números são calculados</summary>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>{dados.definicoes.map((texto) => <li key={texto}>{texto}</li>)}</ul>
          </details>
        </>
      )}
    </div>
  )
}

function CabecalhoComparativo({ titulo: texto, rotA, rotB }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <h3 style={titulo}>{texto}</h3>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: COR.verde, borderRadius: 2 }} /> {rotA}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: COR.azul, borderRadius: 2 }} /> {rotB}</span>
      </div>
    </div>
  )
}

function KpiComparativo({ icone, titulo: texto, a, b, variacao, variacaoTexto: textoVariacao, positivo, diferenca, rotA, rotB }) {
  const sobe = textoVariacao ? positivo : variacao === null || variacao === undefined ? null : variacao >= 0
  return (
    <div style={{ ...card, display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20 }}>{icone}</span>{texto}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-end' }}>
        <div><div style={{ fontSize: 11, color: COR.verde, fontWeight: 600 }}>A • {rotA}</div><div style={{ fontSize: 22, fontWeight: 800, color: COR.verde }}>{a}</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: COR.azul, fontWeight: 600 }}>B • {rotB}</div><div style={{ fontSize: 17, fontWeight: 700, color: COR.azul }}>{b}</div></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line, #e5e7eb)', paddingTop: 8, fontSize: 13 }}>
        <strong style={{ color: sobe === null ? 'var(--muted)' : sobe ? COR.verde : COR.vermelho }}>{sobe === null ? '—' : sobe ? '▲' : '▼'} {textoVariacao || variacaoTexto(variacao)}</strong>
        <span style={{ color: 'var(--muted)' }}>{diferenca}</span>
      </div>
    </div>
  )
}

function BarrasDuplas({ categorias = [] }) {
  if (!categorias.length) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sem receita nos períodos.</div>
  const maximo = Math.max(...categorias.flatMap((item) => [item.a, item.b]), 1)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', gap: 10, height: 230, borderBottom: '1px solid var(--line, #e5e7eb)', paddingTop: 20 }}>
      {categorias.map((item) => (
        <div key={item.categoria} style={{ display: 'grid', justifyItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 170 }}>
            {[['a', COR.verde], ['b', COR.azul]].map(([chave, cor]) => (
              <div key={chave} style={{ display: 'grid', justifyItems: 'center', alignContent: 'end', gap: 3 }}>
                <span style={{ fontSize: 10, color: cor, fontWeight: 700 }}>{rsCurto(item[chave])}</span>
                <div title={rs(item[chave])} style={{ width: 22, height: Math.max(2, (item[chave] / maximo) * 145), background: cor, borderRadius: '3px 3px 0 0' }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{item.categoria}</div>
          <div style={{ fontSize: 10, color: item.variacao === null ? 'var(--muted)' : item.variacao >= 0 ? COR.verde : COR.vermelho }}>{variacaoTexto(item.variacao)}</div>
        </div>
      ))}
    </div>
  )
}

function Acumulado({ serieA = [], serieB = [] }) {
  const L = 560
  const A = 230
  const m = { e: 52, d: 80, t: 14, b: 26 }
  const dias = Math.max(serieA.length, serieB.length, 2)
  const maximo = Math.max(...serieA.map((p) => p.acumulado), ...serieB.map((p) => p.acumulado), 100) * 1.08
  const x = (dia) => m.e + ((dia - 1) / Math.max(1, dias - 1)) * (L - m.e - m.d)
  const y = (v) => A - m.b - (v / maximo) * (A - m.t - m.b)
  const caminho = (serie) => serie.map((p, i) => `${i ? 'L' : 'M'}${x(p.dia).toFixed(1)},${y(p.acumulado).toFixed(1)}`).join(' ')
  const marcas = [...new Set([1, Math.ceil(dias / 4), Math.ceil(dias / 2), Math.ceil((dias * 3) / 4), dias])]
  const fimA = serieA.at(-1)
  const fimB = serieB.at(-1)
  return (
    <svg viewBox={`0 0 ${L} ${A}`} width="100%" role="img" aria-label="Faturamento acumulado por dia nos dois períodos">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={m.e} x2={L - m.d} y1={y((maximo / 1.08) * f)} y2={y((maximo / 1.08) * f)} stroke="currentColor" strokeOpacity=".08" />
          <text x={m.e - 6} y={y((maximo / 1.08) * f) + 4} textAnchor="end" fontSize="11" fill="#64748b">{rsCurto((maximo / 1.08) * f)}</text>
        </g>
      ))}
      {marcas.map((dia) => <text key={dia} x={x(dia)} y={A - 6} textAnchor="middle" fontSize="11" fill="#64748b">Dia {dia}</text>)}
      {serieB.length > 0 && <path d={caminho(serieB)} fill="none" stroke={COR.azul} strokeWidth="2.5" />}
      {serieA.length > 0 && <path d={caminho(serieA)} fill="none" stroke={COR.verde} strokeWidth="2.5" />}
      {fimA && <g><circle cx={x(fimA.dia)} cy={y(fimA.acumulado)} r="4" fill={COR.verde} /><text x={x(fimA.dia) + 8} y={y(fimA.acumulado) + 4} fontSize="12" fontWeight="700" fill={COR.verde}>{rs(fimA.acumulado)}</text></g>}
      {fimB && <g><circle cx={x(fimB.dia)} cy={y(fimB.acumulado)} r="4" fill={COR.azul} /><text x={x(fimB.dia) + 8} y={y(fimB.acumulado) + 16} fontSize="12" fontWeight="700" fill={COR.azul}>{rs(fimB.acumulado)}</text></g>}
    </svg>
  )
}

function ComparacaoIndividual({ item, rotA, rotB }) {
  const [aba, setAba] = useState('faturamento')
  const v = (a, b) => (b ? Number((((a - b) / b) * 100).toFixed(1)) : null)
  const linhas = {
    faturamento: [['📊', 'Faturamento', rs(item.a.faturamento), rs(item.b.faturamento), v(item.a.faturamento, item.b.faturamento)], ['🧴', 'Produtos', rs(item.a.produtos), rs(item.b.produtos), v(item.a.produtos, item.b.produtos)], ['➕', 'Extras', rs(item.a.extras), rs(item.b.extras), v(item.a.extras, item.b.extras)]],
    servicos: [['✂️', 'Serviços (R$)', rs(item.a.servicos), rs(item.b.servicos), v(item.a.servicos, item.b.servicos)], ['👥', 'Atendimentos', qtd(item.a.atendimentos), qtd(item.b.atendimentos), v(item.a.atendimentos, item.b.atendimentos)], ['🎟️', 'Ticket médio', rs(item.a.atendimentos ? item.a.servicos / item.a.atendimentos : null), rs(item.b.atendimentos ? item.b.servicos / item.b.atendimentos : null), v(item.a.atendimentos ? item.a.servicos / item.a.atendimentos : 0, item.b.atendimentos ? item.b.servicos / item.b.atendimentos : 0)]],
    agenda: [['👥', 'Atendimentos', qtd(item.a.atendimentos), qtd(item.b.atendimentos), v(item.a.atendimentos, item.b.atendimentos)], ['🙋', 'Clientes atendidos', qtd(item.a.clientes), qtd(item.b.clientes), v(item.a.clientes || 0, item.b.clientes || 0)], ['🕒', 'Ocupação', item.a.ocupacao === null ? 'Sem dado' : pctTexto(item.a.ocupacao), item.b.ocupacao === null ? 'Sem dado' : pctTexto(item.b.ocupacao), null]],
  }[aba]
  const mudou = []
  const cmp = (rot, a, b) => { const x = v(a, b); if (x !== null && Math.abs(x) >= 5) mudou.push(`${rot} ${x > 0 ? 'cresceu' : 'caiu'} ${variacaoTexto(x)}`) }
  cmp('Faturamento', item.a.faturamento, item.b.faturamento)
  cmp('Produtos', item.a.produtos, item.b.produtos)
  cmp('Extras', item.a.extras, item.b.extras)
  cmp('Atendimentos', item.a.atendimentos, item.b.atendimentos)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={titulo}>{item.nome} • comparação individual</h3>
        <Alternador opcoes={[['faturamento', 'Faturamento'], ['servicos', 'Serviços'], ['agenda', 'Agenda']]} valor={aba} onChange={setAba} />
      </div>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', background: 'var(--card, #fff)', borderRadius: 10, overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: 'rgba(148,163,184,.12)', color: 'var(--muted)', textAlign: 'left' }}>
            <th style={{ padding: '8px 10px', fontWeight: 600 }}>Métrica</th>
            <th style={{ padding: '8px 10px', fontWeight: 600, color: COR.verde, textAlign: 'center' }}>Período A<br /><small style={{ fontWeight: 400 }}>{rotA}</small></th>
            <th style={{ padding: '8px 10px', fontWeight: 600, color: COR.azul, textAlign: 'center' }}>Período B<br /><small style={{ fontWeight: 400 }}>{rotB}</small></th>
            <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Variação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([icone, nome, a, b, variacao]) => (
            <tr key={nome} style={{ borderTop: '1px solid var(--line, #e5e7eb)' }}>
              <td style={{ padding: '9px 10px' }}><span style={{ marginRight: 8 }}>{icone}</span>{nome}</td>
              <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700 }}>{a}</td>
              <td style={{ padding: '9px 10px', textAlign: 'center' }}>{b}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: variacao === null ? 'var(--muted)' : variacao >= 0 ? COR.verde : COR.vermelho }}>{variacao === null ? '—' : `${variacao >= 0 ? '▲' : '▼'} ${variacaoTexto(variacao)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Ocupação • {item.nome}</div>
          {[['A', item.a.ocupacao, COR.verde], ['B', item.b.ocupacao, COR.azul]].map(([rot, valor, cor]) => (
            <div key={rot} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, width: 18 }}>{rot}</div>
              <div style={{ flex: 1, background: COR.trilho, height: 12, borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, valor || 0)}%`, height: '100%', background: cor }} /></div>
              <div style={{ fontSize: 12, fontWeight: 800, width: 64, textAlign: 'right' }}>{valor === null || valor === undefined ? 'Sem dado' : pctTexto(valor)}</div>
            </div>
          ))}
        </div>
        <div style={{ background: COR.verdeClaro, border: '1px solid #a7f3d0', borderRadius: 10, padding: 10, display: 'flex', gap: 8, alignItems: 'center', color: '#065f46' }}>
          <span style={{ fontSize: 22 }}>💡</span>
          <div><div style={{ fontSize: 11, fontWeight: 800 }}>O que mudou</div><div style={{ fontSize: 12 }}>{mudou.length ? `${mudou.join('; ')}.` : 'Sem mudança relevante entre os períodos.'}</div></div>
        </div>
      </div>
    </div>
  )
}
