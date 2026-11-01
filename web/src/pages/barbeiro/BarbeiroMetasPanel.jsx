import { useState } from 'react'
import { api } from '../../lib/api'

const t = {
  bg: '#0E1014',
  surface: '#161922',
  card: '#1C202B',
  line: '#2B3140',
  cream: '#E8EAF2',
  muted: '#A4AABE',
  accent: '#6E7CE0',
  green: '#3CC48B',
  yellow: '#E0B24B',
  red: '#F27A89',
}

const card = { background: t.card, border: `1px solid ${t.line}`, borderRadius: 16, padding: 14 }
const btn = { minHeight: 44, padding: '10px 14px', borderRadius: 12, border: `1px solid ${t.accent}`, background: t.accent, color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }
const btn2 = { ...btn, background: 'transparent', color: t.cream, borderColor: t.line }
const input = { width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: `1px solid ${t.line}`, background: t.surface, color: t.cream, font: 'inherit', fontSize: 15, boxSizing: 'border-box' }
const reais = (v) => `R$\u00a0${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PainelVisaoEquipeAdmin({ visaoGeralEquipe, profissionais = [], profissionalSelecionadoId, onSelectProfissional, onIrMetas }) {
  const [expandido, setExpandido] = useState(true)
  const lista = visaoGeralEquipe?.profissionais?.length ? visaoGeralEquipe.profissionais : profissionais
  const tot = visaoGeralEquipe?.totais || null
  if (!lista.length) return null

  return (
    <section
      aria-label="Visão Consolidada da Equipe (Modo Gestor)"
      style={{
        ...card,
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%)',
        borderColor: 'rgba(110, 124, 224, 0.45)',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            👑 Modo Gestor / Admin · Visão de Todos os Profissionais
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2 }}>
            Equipe Ativa ({lista.length} profissionais)
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          style={{ ...btn2, minHeight: 34, padding: '4px 10px', fontSize: 12 }}
        >
          {expandido ? 'Recolher ▲' : 'Expandir ▼'}
        </button>
      </div>

      {tot && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 6px', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 700 }}>AGENDA HOJE</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginTop: 2 }}>{tot.concluidosHoje}/{tot.agendamentosHoje}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 6px', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 700 }}>PREVISTO DIA</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: t.green, marginTop: 2 }}>{reais(tot.previstoHoje)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 6px', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 700 }}>PRODUÇÃO MÊS</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#93c5fd', marginTop: 2 }}>{reais(tot.faturamentoMes)}</div>
          </div>
          <div
            onClick={onIrMetas}
            style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '8px 6px', borderRadius: 10, textAlign: 'center', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>GIROS ROLETA</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>{tot.girosPendentes || 0} 🎡</div>
          </div>
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: 12, color: t.muted, fontWeight: 700, marginBottom: 6 }}>
          Selecionar profissional para inspecionar e operar:
        </label>
        <select
          aria-label="Selecionar profissional"
          style={{ ...input, background: t.bg, borderColor: t.accent, fontWeight: 700 }}
          value={profissionalSelecionadoId || ''}
          onChange={(e) => onSelectProfissional(e.target.value)}
        >
          {lista.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} {p.agendamentosHoje !== undefined ? `· ${p.agendamentosHoje} ag. hoje · ${reais(p.previstoHoje || 0)}` : ''}
            </option>
          ))}
        </select>
      </div>

      {expandido && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {lista.map((p) => {
            const selecionado = p.id === profissionalSelecionadoId
            const iniciais = String(p.apelido || p.nome || 'P').slice(0, 2).toUpperCase()
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProfissional(p.id)}
                style={{
                  textAlign: 'left',
                  background: selecionado ? 'rgba(110, 124, 224, 0.22)' : 'rgba(255,255,255,0.03)',
                  border: selecionado ? `2px solid ${t.accent}` : `1px solid ${t.line}`,
                  borderRadius: 12,
                  padding: 10,
                  color: t.cream,
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: selecionado ? t.accent : '#334155',
                    color: '#fff', fontWeight: 800, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {iniciais}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>
                      {p.apelido || p.nome.split(' ')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: t.muted }}>
                      {p.agendamentosHoje ?? 0} ag. · {reais(p.previstoHoje || 0)}
                    </div>
                  </div>
                  {p.girosPendentesCount > 0 && (
                    <span style={{ background: '#f59e0b', color: '#000', fontWeight: 900, fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>
                      {p.girosPendentesCount}🎡
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: t.muted }}>
                    <span>✂️ Extras: {p.servicosExtrasHoje || 0}/{p.metaExtrasAlvo || 6}</span>
                    <span>🧴 Prod: {p.produtosQtdHoje || 0}/{p.metaProdutosAlvo || 2}</span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(p.metaExtrasProgresso || 0, p.metaProdutosProgresso || 0, p.progressoSemana || 0)}%`,
                      background: 'linear-gradient(90deg, #6E7CE0, #3CC48B)',
                    }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function BarbeiroMetasPanel({ painel, onLancarVenda, onAtualizar, tocarSom }) {
  const [subAba, setSubAba] = useState('hoje') // 'hoje' | 'mes' | 'roleta' | 'ranking'
  const [girando, setGirando] = useState(false)
  const [anguloRoleta, setAnguloRoleta] = useState(0)
  const [premioSorteado, setPremioSorteado] = useState(null)
  const [erroGiro, setErroGiro] = useState('')

  const g = painel?.gamificacao || {}
  const config = g.config || {}
  const dia = g.dia || {}
  const semana = g.semana || {}
  const mes = g.mes || {}
  const girosPendentes = g.girosPendentes || []
  const girosAguardando = g.girosAguardandoEntrega || []
  const girosEntregues = g.girosEntregues || []
  const ranking = g.ranking || []
  const premios = (config.premiosRoleta || []).filter((p) => p.ativo !== false)

  const extrasHoje = dia.servicosExtras || 0
  const extrasAlvo = config.metasDiarias?.servicosExtrasQtd || dia.metaExtrasAlvo || 6
  const extrasPct = Math.min(100, Math.round((extrasHoje / Math.max(1, extrasAlvo)) * 100))
  const faltamExtras = Math.max(0, extrasAlvo - extrasHoje)

  const prodHoje = dia.produtosQtd || 0
  const prodAlvo = config.metasDiarias?.produtosQtd || dia.metaProdutosAlvo || 2
  const prodPct = Math.min(100, Math.round((prodHoje / Math.max(1, prodAlvo)) * 100))
  const faltamProd = Math.max(0, prodAlvo - prodHoje)

  async function girarRoletaReal() {
    if (girando) return
    setErroGiro('')
    setPremioSorteado(null)
    setGirando(true)
    tocarSom?.('iniciar')

    const giroAlvo = girosPendentes[0] || null
    const listaPremios = premios.length > 0 ? premios : [
      { id: 'p1', nome: 'R$ 50 no Pix', cor: '#10b981' },
      { id: 'p2', nome: 'R$ 20 no Pix', cor: '#3b82f6' },
      { id: 'p3', nome: 'Vale Consumo R$ 30', cor: '#f59e0b' },
      { id: 'p4', nome: 'Produto Linha Dino', cor: '#8b5cf6' },
      { id: 'p5', nome: 'R$ 100 no Pix', cor: '#ec4899' },
    ]
    const idxSorteado = Math.floor(Math.random() * listaPremios.length)
    const premioEscolhido = listaPremios[idxSorteado]
    const fatiaGraus = 360 / listaPremios.length
    const novoAngulo = anguloRoleta + 1800 + (360 - idxSorteado * fatiaGraus - fatiaGraus / 2)
    setAnguloRoleta(novoAngulo)

    setTimeout(async () => {
      try {
        if (giroAlvo?.id) {
          const resp = await api.post('/api/admin/barbearia/gamificacao/giros/executar', {
            giroId: giroAlvo.id,
            premioId: premioEscolhido.id,
            premioNome: premioEscolhido.nome,
          })
          setPremioSorteado({
            nome: resp?.giro?.premioGanho || premioEscolhido.nome,
            cor: premioEscolhido.cor || '#f59e0b',
            oficial: true,
          })
          await onAtualizar?.()
        } else {
          setPremioSorteado({
            nome: premioEscolhido.nome,
            cor: premioEscolhido.cor || '#f59e0b',
            oficial: false,
          })
        }
        tocarSom?.('meta')
      } catch (e) {
        setErroGiro(e.message || 'Não foi possível registrar o giro.')
      } finally {
        setGirando(false)
      }
    }, 3600)
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* HEADER RESUMO DE METAS DO PROFISSIONAL */}
      <div style={{
        ...card,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
        borderColor: '#6366f1',
        display: 'grid',
        gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🎯 Central de Metas & Gamificação
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: '#fff' }}>
              {painel?.profissional?.nome}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSubAba('roleta')}
            style={{
              background: girosPendentes.length > 0 ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)',
              color: girosPendentes.length > 0 ? '#000' : '#fbbf24',
              border: '1px solid #f59e0b',
              borderRadius: 20,
              padding: '6px 12px',
              fontWeight: 900,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            🎡 {girosPendentes.length} Giro(s)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: 10, borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#cbd5e1' }}>Produção Hoje</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2 }}>
              {reais(Math.max(dia.faturamentoTotal || 0, painel?.resumo?.previsto || 0))}
            </div>
            <div style={{ fontSize: 10, color: t.green }}>Comissão: {reais(painel?.comissao?.dia?.previsaoTotal || 0)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: 10, borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#cbd5e1' }}>Semana Atual</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>
              {reais(semana.faturamentoTotal || 0)}
            </div>
            <div style={{ fontSize: 10, color: '#cbd5e1' }}>{semana.progressoFaturamento || 0}% da meta</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: 10, borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#cbd5e1' }}>Acumulado Mês</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
              {reais(mes.faturamentoRealizado || painel?.comissao?.mes?.bruto || 0)}
            </div>
            <div style={{ fontSize: 10, color: '#cbd5e1' }}>{mes.progressoFaturamentoMensal || 0}% da meta</div>
          </div>
        </div>

        {/* SUB-NAVEGAÇÃO INTERATIVA DENTRO DE METAS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            ['hoje', '⚡ Hoje & Semana'],
            ['mes', '📈 Meta Mês'],
            ['roleta', `🎡 Roleta (${girosPendentes.length})`],
            ['ranking', '🏆 Ranking'],
          ].map(([id, rotulo]) => {
            const ativo = subAba === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSubAba(id)}
                style={{
                  padding: '8px 4px',
                  borderRadius: 10,
                  border: ativo ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.12)',
                  background: ativo ? '#4f46e5' : 'rgba(15, 23, 42, 0.6)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {rotulo}
              </button>
            )
          })}
        </div>
      </div>

      {/* ABA 1: METAS DE HOJE & DESAFIO DA SEMANA */}
      {subAba === 'hoje' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {/* CARD 1: META DIÁRIA DE SERVIÇOS EXTRAS */}
          <div style={{ ...card, display: 'grid', gap: 10, borderLeft: `4px solid ${dia.metaExtrasAtingida ? t.green : t.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>✂️ Meta Diária: Serviços Extras</div>
                <div style={{ fontSize: 12, color: t.muted }}>Sobrancelha, barba, hidratação, pigmentação, selagem…</div>
              </div>
              <span style={{
                background: dia.metaExtrasAtingida ? 'rgba(60, 196, 139, 0.2)' : 'rgba(110, 124, 224, 0.2)',
                color: dia.metaExtrasAtingida ? t.green : '#a5b4fc',
                padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 900,
              }}>
                {extrasHoje} / {extrasAlvo}
              </span>
            </div>

            <div style={{ height: 12, background: t.surface, borderRadius: 99, overflow: 'hidden', border: `1px solid ${t.line}` }}>
              <div style={{
                height: '100%',
                width: `${extrasPct}%`,
                background: dia.metaExtrasAtingida ? t.green : 'linear-gradient(90deg, #6E7CE0, #8b5cf6)',
                transition: 'width 0.4s ease',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: dia.metaExtrasAtingida ? t.green : t.cream, fontWeight: 700 }}>
                {dia.metaExtrasAtingida
                  ? '🎉 Meta batida! +1 Giro na Roleta conquistado hoje!'
                  : `Faltam ${faltamExtras} serviço(s) extra(s) hoje para liberar +1 Giro na Roleta!`}
              </span>
              <span style={{ color: t.muted, fontWeight: 800 }}>{extrasPct}%</span>
            </div>

            {Array.isArray(dia.servicosExtrasLista) && dia.servicosExtrasLista.length > 0 && (
              <div style={{ background: t.surface, padding: 10, borderRadius: 10, display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: t.muted }}>Extras contabilizados hoje:</div>
                {dia.servicosExtrasLista.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{item.quantidade}x {item.nome} ({item.cliente})</span>
                    <strong style={{ color: t.green }}>{reais(item.valor)}</strong>
                  </div>
                ))}
              </div>
            )}

            <button type="button" style={{ ...btn2, padding: '8px 12px', fontSize: 13 }} onClick={onLancarVenda}>
              + Lançar Serviço Extra em Comanda
            </button>
          </div>

          {/* CARD 2: META DIÁRIA DE PRODUTOS */}
          <div style={{ ...card, display: 'grid', gap: 10, borderLeft: `4px solid ${dia.metaProdutosAtingida ? t.green : '#10b981'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>🧴 Meta Diária: Venda de Produtos</div>
                <div style={{ fontSize: 12, color: t.muted }}>Pomadas, perfumes, óleos para barba, shampoos…</div>
              </div>
              <span style={{
                background: dia.metaProdutosAtingida ? 'rgba(60, 196, 139, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                color: t.green,
                padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 900,
              }}>
                {prodHoje} / {prodAlvo} un
              </span>
            </div>

            <div style={{ height: 12, background: t.surface, borderRadius: 99, overflow: 'hidden', border: `1px solid ${t.line}` }}>
              <div style={{
                height: '100%',
                width: `${prodPct}%`,
                background: 'linear-gradient(90deg, #10b981, #34d399)',
                transition: 'width 0.4s ease',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: dia.metaProdutosAtingida ? t.green : t.cream, fontWeight: 700 }}>
                {dia.metaProdutosAtingida
                  ? `🎉 Meta de produtos batida (${reais(dia.produtosValor || 0)})! +1 Giro liberado!`
                  : `Falta(m) ${faltamProd} produto(s) hoje para liberar +1 Giro na Roleta!`}
              </span>
              <span style={{ color: t.muted, fontWeight: 800 }}>{reais(dia.produtosValor || 0)}</span>
            </div>

            {Array.isArray(dia.produtosLista) && dia.produtosLista.length > 0 && (
              <div style={{ background: t.surface, padding: 10, borderRadius: 10, display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: t.muted }}>Produtos vendidos hoje:</div>
                {dia.produtosLista.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{item.quantidade}x {item.nome} ({item.cliente})</span>
                    <strong style={{ color: t.green }}>{reais(item.valor)}</strong>
                  </div>
                ))}
              </div>
            )}

            <button type="button" style={{ ...btn2, padding: '8px 12px', fontSize: 13 }} onClick={onLancarVenda}>
              + Lançar Venda de Produto
            </button>
          </div>

          {/* CARD 3: DESAFIO SEMANAL */}
          <div style={{
            ...card,
            background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.12) 0%, rgba(28, 32, 43, 0.98) 100%)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            display: 'grid',
            gap: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase' }}>
                  🔥 {config.metasSemanais?.tituloDesafio || 'Desafio Semanal da Equipe'}
                </div>
                <div style={{ fontSize: 13, color: t.cream, marginTop: 2 }}>
                  {config.metasSemanais?.descricaoDesafio || 'Bata a meta semanal e ganhe premiação extra!'}
                </div>
              </div>
              <span style={{ background: '#f59e0b', color: '#000', fontWeight: 900, fontSize: 11, padding: '4px 8px', borderRadius: 8 }}>
                {semana.progressoDesafio || 0}%
              </span>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>💰 Faturamento na Semana</span>
                  <strong>{reais(semana.faturamentoTotal || 0)} / {reais(config.metasSemanais?.faturamentoValor || 2500)}</strong>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${semana.progressoFaturamento || 0}%`, background: '#f59e0b' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>🧴 Produtos na Semana ({semana.produtosQtd || 0}/{config.metasSemanais?.produtosQtd || 10} un)</span>
                  <strong>{reais(semana.produtosValor || 0)} / {reais(config.metasSemanais?.produtosValor || 500)}</strong>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${semana.progressoProdutos || 0}%`, background: '#10b981' }} />
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 10, fontSize: 12, color: '#fde68a' }}>
              🏆 <strong>Prêmio da Semana:</strong> {config.metasSemanais?.premiacaoDescricao || 'R$ 100,00 no Pix + 2 Giros na Roleta'}
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: METAS DO MÊS & SIMULADOR "O QUE FALTA PARA BATER A META" */}
      {subAba === 'mes' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...card, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                  📈 Meta Mensal Individual
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginTop: 2 }}>
                  Faturamento & Comissões no Mês
                </div>
              </div>
              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: 99, fontWeight: 900, fontSize: 13 }}>
                {mes.progressoFaturamentoMensal || 0}%
              </span>
            </div>

            <div style={{ height: 14, background: t.surface, borderRadius: 99, overflow: 'hidden', border: `1px solid ${t.line}` }}>
              <div style={{
                height: '100%',
                width: `${mes.progressoFaturamentoMensal || 0}%`,
                background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
              }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <div style={{ background: t.surface, padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: t.muted }}>Realizado no Mês</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 2 }}>{reais(mes.faturamentoRealizado || 0)}</div>
                <div style={{ fontSize: 11, color: t.green }}>Minha comissão: {reais(mes.comissaoAcumulada || 0)}</div>
              </div>
              <div style={{ background: t.surface, padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: t.muted }}>Meta do Mês</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>{reais(mes.metaFaturamentoMensal || 0)}</div>
                <div style={{ fontSize: 11, color: t.muted }}>Faltam: {reais(mes.faltaFaturamentoMensal || 0)}</div>
              </div>
              <div style={{ background: t.surface, padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: t.muted }}>Atendimentos no Mês</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 2 }}>
                  {mes.atendimentosRealizados || 0} / {mes.metaAtendimentosMensal || 40}
                </div>
                <div style={{ fontSize: 11, color: t.muted }}>{mes.progressoAtendimentosMensal || 0}% concluído</div>
              </div>
              <div style={{ background: t.surface, padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: t.muted }}>Ticket Médio</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: (mes.ticketMedioRealizado || 0) >= (mes.metaTicketMedio || 110) ? t.green : t.yellow, marginTop: 2 }}>
                  {reais(mes.ticketMedioRealizado || 0)}
                </div>
                <div style={{ fontSize: 11, color: t.muted }}>Meta: {reais(mes.metaTicketMedio || 110)}</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 12,
              padding: 12,
              display: 'grid',
              gap: 6,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#7dd3fc' }}>
                💡 Plano de Ação — O que falta para bater sua meta mensal:
              </div>
              <div style={{ fontSize: 13, color: t.cream, lineHeight: 1.5 }}>
                Restam <strong>{mes.diasRestantesMes || 1} dia(s)</strong> no mês. Para atingir 100% da meta mensal, você precisa produzir em média{' '}
                <strong style={{ color: '#fbbf24' }}>{reais(mes.metaDiariaNecessaria || 0)}/dia</strong> (cerca de{' '}
                <strong>{Math.max(1, Math.ceil((mes.metaDiariaNecessaria || 0) / Math.max(50, mes.ticketMedioRealizado || 80)))} atendimentos/dia</strong> ou incluir 1 produto + 1 barba/sobrancelha extra a cada 2 clientes).
              </div>
              <div style={{ fontSize: 12, color: t.muted }}>
                Projeção no ritmo atual: <strong style={{ color: '#fff' }}>{reais(mes.projecaoFechamentoMes || 0)}</strong> até o fim do mês.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: ROLETA DE PRÊMIOS INTERATIVA */}
      {subAba === 'roleta' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...card, textAlign: 'center', display: 'grid', gap: 14, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
              🎡 Roleta Oficial de Prêmios Dino
            </div>
            <div style={{ fontSize: 14, color: t.cream }}>
              {girosPendentes.length > 0
                ? `Você tem ${girosPendentes.length} giro(s) liberado(s) para rodar agora!`
                : 'Bata a meta diária de 6 serviços extras ou 2 produtos vendidos para liberar giros automáticos!'}
            </div>

            {/* RODA VISUAL INTERATIVA */}
            <div style={{ position: 'relative', width: 230, height: 230, margin: '6px auto' }}>
              <div style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                zIndex: 5, fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
              }}>
                🔻
              </div>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '6px solid #fbbf24',
                  boxShadow: '0 0 30px rgba(245, 158, 11, 0.35)',
                  transition: girando ? 'transform 3.5s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                  transform: `rotate(${anguloRoleta}deg)`,
                  background: 'conic-gradient(#10b981 0deg 60deg, #3b82f6 60deg 120deg, #f59e0b 120deg 180deg, #8b5cf6 180deg 240deg, #ec4899 240deg 300deg, #06b6d4 300deg 360deg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: '#0f172a',
                  border: '4px solid #fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 900, color: '#fbbf24',
                }}>
                  🎡
                </div>
              </div>
            </div>

            {premioSorteado && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: `2px solid ${premioSorteado.cor || t.green}`,
                borderRadius: 14,
                padding: 14,
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#a7f3d0', textTransform: 'uppercase' }}>
                  {premioSorteado.oficial ? '🎉 Prêmio Oficial Registrado!' : '✨ Simulação de Giro:'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                  {premioSorteado.nome}
                </div>
                <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>
                  {premioSorteado.oficial
                    ? 'Seu prêmio já entrou na fila de entrega da gerência!'
                    : 'Conclua sua meta do dia para valer prêmio real na gerência!'}
                </div>
              </div>
            )}

            {erroGiro && <div role="alert" style={{ color: t.red, fontSize: 13, fontWeight: 700 }}>{erroGiro}</div>}

            <button
              type="button"
              disabled={girando}
              onClick={girarRoletaReal}
              style={{
                ...btn,
                background: girosPendentes.length > 0 ? '#f59e0b' : '#4f46e5',
                borderColor: girosPendentes.length > 0 ? '#f59e0b' : '#6366f1',
                color: girosPendentes.length > 0 ? '#000' : '#fff',
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              {girando
                ? 'Girando a Roleta…'
                : girosPendentes.length > 0
                  ? `🎡 GIRAR ROLETA OFICIAL (${girosPendentes.length})`
                  : '🎡 Testar / Simular Giro na Roleta'}
            </button>

            {/* LISTA DE PRÊMIOS CONFIGURADOS */}
            <div style={{ textAlign: 'left', display: 'grid', gap: 6, marginTop: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.muted }}>Prêmios ativos na Roleta:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(premios.length ? premios : [
                  { id: '1', nome: 'R$ 50 no Pix', cor: '#10b981' },
                  { id: '2', nome: 'R$ 20 no Pix', cor: '#3b82f6' },
                  { id: '3', nome: 'Vale Consumo R$ 30', cor: '#f59e0b' },
                  { id: '4', nome: 'Produto Linha Dino', cor: '#8b5cf6' },
                  { id: '5', nome: 'R$ 100 no Pix', cor: '#ec4899' },
                ]).map((p) => (
                  <span key={p.id || p.nome} style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${p.cor || t.line}`, color: '#fff',
                  }}>
                    🎁 {p.nome}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* HISTÓRICO DE PRÊMIOS DO PROFISSIONAL */}
          {(girosAguardando.length > 0 || girosEntregues.length > 0) && (
            <div style={{ ...card, display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>🎁 Meus Prêmios Conquistados</div>
              {girosAguardando.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surface, padding: 10, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: 14 }}>{item.premioGanho}</div>
                    <div style={{ fontSize: 11, color: t.muted }}>{item.motivo}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '3px 8px', borderRadius: 99 }}>
                    Aguardando entrega
                  </span>
                </div>
              ))}
              {girosEntregues.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surface, padding: 10, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: t.green, fontSize: 14 }}>{item.premioGanho}</div>
                    <div style={{ fontSize: 11, color: t.muted }}>{item.motivo}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: t.green }}>✓ Entregue</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 4: RANKING DA EQUIPE NA SEMANA */}
      {subAba === 'ranking' && (
        <div style={{ ...card, display: 'grid', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>🏆 Ranking da Equipe na Semana</div>
            <div style={{ fontSize: 12, color: t.muted }}>Classificação por produção semanal, extras e produtos</div>
          </div>

          {ranking.length === 0 ? (
            <div style={{ color: t.muted, fontSize: 13, padding: 12, textAlign: 'center' }}>
              Sem dados de ranking nesta semana ainda.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {ranking.map((item, idx) => {
                const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`
                const ehAtual = item.profissionalId === painel?.profissional?.id || item.nome === painel?.profissional?.nome
                return (
                  <div
                    key={item.profissionalId || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: ehAtual ? 'rgba(110, 124, 224, 0.18)' : t.surface,
                      border: `1px solid ${ehAtual ? t.accent : t.line}`,
                      borderRadius: 12,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, fontWeight: 900, minWidth: 26 }}>{medalha}</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>
                          {item.nome} {ehAtual ? '(Selecionado)' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: t.muted }}>
                          ✂️ {item.servicosExtrasSemana || 0} extras · 🧴 {reais(item.produtosValorSemana || 0)} prod.
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: 14, color: t.green }}>{reais(item.faturamentoSemana || 0)}</div>
                      <div style={{ fontSize: 10, color: '#fbbf24' }}>{item.progressoDesafio || 0}% desafio</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
