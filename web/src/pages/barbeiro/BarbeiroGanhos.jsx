import { useState } from 'react'
import { useToast } from '../../hooks/useToast'

const t = {
  bg: '#0E1014',
  surface: '#161922',
  card: '#1C202B',
  accent: '#6E7CE0',
  muted: '#A4AABE',
  cream: '#E8EAF2',
  line: '#2B3140',
  red: '#F27A89',
  green: '#3CC48B',
  yellow: '#E0B24B',
  blue: '#5AA9F0',
  gold: '#F59E0B',
}

const reais = (v) => `R$\u00a0${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '')

export default function BarbeiroGanhos({ painel, onAtualizar, onAbrirExtrato }) {
  const { toast } = useToast()
  const [periodoSel, setPeriodoSel] = useState('dia') // 'dia', 'semana', 'mes'
  const [modalSaque, setModalSaque] = useState(false)
  const [chavePix, setChavePix] = useState(painel?.profissional?.email || '')
  const [valorSaque, setValorSaque] = useState('')
  const [historicoSaques, setHistoricoSaques] = useState([])

  // Simulador interativo de ganhos extras
  const [simExtrasDia, setSimExtrasDia] = useState(2)
  const [simProdutosDia, setSimProdutosDia] = useState(1)

  const comissao = painel?.comissao || {}
  const dadosPeriodo = periodoSel === 'dia' ? comissao.dia : periodoSel === 'semana' ? comissao.semana : comissao.mes

  const repasse = dadosPeriodo?.repasse || 0
  const bruto = dadosPeriodo?.bruto || 0
  const atendimentos = dadosPeriodo?.atendimentos || 0
  const vendasProdutos = dadosPeriodo?.vendasProdutos || 0
  const comissaoServicos = dadosPeriodo?.comissaoServicos || 0
  const comissaoProdutos = dadosPeriodo?.comissaoProdutos || 0
  const brutoServicos = dadosPeriodo?.brutoServicos || (bruto - (dadosPeriodo?.brutoProdutos || 0))
  const brutoProdutos = dadosPeriodo?.brutoProdutos || 0
  const linhas = dadosPeriodo?.linhas || []

  // Previsão do dia
  const previsaoTotal = comissao.dia?.previsaoTotal || repasse
  const pendenteEstimado = comissao.dia?.pendenteEstimado || 0
  const ticketMedio = atendimentos > 0 ? bruto / atendimentos : (painel?.resumo?.total > 0 ? (painel?.resumo?.previsto || 0) / painel.resumo.total : 0)

  const percServ = (comissao.percentualServicos || 50) / 100
  const percProd = (comissao.percentualProdutos || 20) / 100
  const ganhoExtraHoje = (simExtrasDia * 35 * percServ) + (simProdutosDia * 65 * percProd)
  const ganhoExtraMes = ganhoExtraHoje * 24

  function confirmarSolicitacaoSaque(e) {
    e.preventDefault()
    const val = Number(valorSaque || previsaoTotal || repasse || 100)
    const novo = {
      id: `saque-${Date.now()}`,
      valor: val,
      chave: chavePix || 'Chave cadastrada',
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      status: 'Em análise na gerência',
    }
    setHistoricoSaques((atual) => [novo, ...atual])
    setModalSaque(false)
    toast?.({
      title: 'Solicitação de Saque / Vale enviada!',
      description: `Pedido de ${reais(val)} via Pix enviado para aprovação do caixa.`,
      variant: 'success',
    })
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* SELETOR DE PERÍODO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          ['dia', 'Hoje'],
          ['semana', 'Esta Semana'],
          ['mes', 'Este Mês'],
        ].map(([id, label]) => {
          const ativo = periodoSel === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPeriodoSel(id)}
              style={{
                minHeight: 42,
                borderRadius: 12,
                border: `1.5px solid ${ativo ? t.accent : t.line}`,
                background: ativo ? t.accent : t.surface,
                color: ativo ? '#fff' : t.cream,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* HERO CARD DE GANHOS */}
      <div
        style={{
          background: 'linear-gradient(135deg, #182234 0%, #0F172A 100%)',
          border: '1.5px solid #2563EB',
          borderRadius: 18,
          padding: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#93C5FD', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Minha Comissão Líquida · {periodoSel === 'dia' ? 'Hoje' : periodoSel === 'semana' ? 'Esta Semana' : 'Este Mês'}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#38BDF8', marginTop: 4 }}>
              {reais(repasse)}
            </div>
          </div>
          <span
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38BDF8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: 20,
            }}
          >
            Líquido Confirmado
          </span>
        </div>

        {periodoSel === 'dia' && pendenteEstimado > 0 && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#D1FAE5' }}>
              🚀 <strong>Previsão com a agenda de hoje:</strong>
            </span>
            <strong style={{ color: t.green, fontSize: 15 }}>{reais(previsaoTotal)}</strong>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Produção Cadeira</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.cream }}>{reais(bruto || painel?.resumo?.previsto || 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Atendimentos</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.cream }}>{atendimentos || painel?.resumo?.total || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Ticket Médio</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.cream }}>{reais(ticketMedio)}</div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO FINANCEIRA DO BARBEIRO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
          <button
            type="button"
            onClick={() => {
              setValorSaque(String(Math.max(repasse, previsaoTotal, 100)))
              setModalSaque((v) => !v)
            }}
            style={{
              minHeight: 42,
              borderRadius: 10,
              border: 'none',
              background: '#10B981',
              color: '#052e16',
              fontWeight: 900,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            💸 Solicitar Saque / Vale Pix
          </button>
          {onAbrirExtrato && (
            <button
              type="button"
              onClick={onAbrirExtrato}
              style={{
                minHeight: 42,
                borderRadius: 10,
                border: '1px solid rgba(147, 197, 253, 0.4)',
                background: 'rgba(30, 58, 138, 0.35)',
                color: '#dbeafe',
                fontWeight: 800,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              📄 Extrato & Recibos
            </button>
          )}
        </div>
      </div>

      {/* MODAL INLINE DE SOLICITAÇÃO DE SAQUE / ADIANTAMENTO PIX */}
      {modalSaque && (
        <form
          onSubmit={confirmarSolicitacaoSaque}
          style={{
            background: t.card,
            border: `1.5px solid ${t.green}`,
            borderRadius: 16,
            padding: 16,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 15, color: '#fff' }}>💸 Solicitar Repasse / Vale via Pix</strong>
            <button
              type="button"
              onClick={() => setModalSaque(false)}
              style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', fontWeight: 800 }}
            >
              ✕
            </button>
          </div>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: t.muted, fontWeight: 700 }}>
            Valor desejado (R$)
            <input
              type="number"
              step="0.01"
              min="10"
              value={valorSaque}
              onChange={(e) => setValorSaque(e.target.value)}
              required
              style={{
                minHeight: 42,
                padding: '8px 12px',
                borderRadius: 10,
                border: `1px solid ${t.line}`,
                background: t.surface,
                color: '#fff',
                fontSize: 16,
                fontWeight: 800,
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: t.muted, fontWeight: 700 }}>
            Sua Chave Pix (CPF, Celular ou E-mail)
            <input
              type="text"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              placeholder="Informe sua chave Pix"
              required
              style={{
                minHeight: 42,
                padding: '8px 12px',
                borderRadius: 10,
                border: `1px solid ${t.line}`,
                background: t.surface,
                color: '#fff',
                fontSize: 14,
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              minHeight: 44,
              borderRadius: 12,
              border: 'none',
              background: t.green,
              color: '#052e16',
              fontWeight: 900,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ✓ Confirmar Pedido de Pix na Gerência
          </button>
        </form>
      )}

      {historicoSaques.length > 0 && (
        <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 12, display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.green }}>✓ Solicitações de Pix Enviadas Hoje</div>
          {historicoSaques.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: t.surface, padding: '8px 10px', borderRadius: 8 }}>
              <span><strong>{reais(s.valor)}</strong> · Pix: {s.chave} ({s.horario})</span>
              <span style={{ color: t.yellow, fontWeight: 800 }}>{s.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* QUEBRA: SERVIÇOS VS PRODUTOS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 14, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: t.cream }}>✂️ Serviços</span>
            <span style={{ fontSize: 10.5, background: 'rgba(110, 124, 224, 0.15)', color: t.accent, padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
              {comissao.percentualServicos || 50}%
            </span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.green }}>
            {reais(comissaoServicos)}
          </div>
          <div style={{ fontSize: 11, color: t.muted }}>
            {atendimentos} atendimentos · Bruto {reais(brutoServicos)}
          </div>
        </div>

        <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 14, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: t.cream }}>🧴 Produtos</span>
            <span style={{ fontSize: 10.5, background: 'rgba(245, 158, 11, 0.15)', color: t.gold, padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
              {comissao.percentualProdutos || 20}%
            </span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.gold }}>
            {reais(comissaoProdutos)}
          </div>
          <div style={{ fontSize: 11, color: t.muted }}>
            {vendasProdutos} produtos · Bruto {reais(brutoProdutos)}
          </div>
        </div>
      </div>

      {/* SIMULADOR INTERATIVO DE COMISSÃO EXTRA */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(110, 124, 224, 0.14) 0%, rgba(28, 32, 43, 0.96) 100%)',
        border: '1px solid rgba(110, 124, 224, 0.4)',
        borderRadius: 16,
        padding: 14,
        display: 'grid',
        gap: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase' }}>
              ⚡ Simulador Interativo de Ganhos
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>
              Quanto você ganha a mais oferecendo Extras + Produtos:
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>✂️ Serviços Extras por dia (Sobrancelha/Barba/Hidratação):</span>
              <strong style={{ color: '#a5b4fc' }}>{simExtrasDia} extra(s)/dia</strong>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={simExtrasDia}
              onChange={(e) => setSimExtrasDia(Number(e.target.value))}
              style={{ width: '100%', accentColor: t.accent }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>🧴 Produtos vendidos por dia (Pomada/Óleo/Perfume):</span>
              <strong style={{ color: '#fbbf24' }}>{simProdutosDia} produto(s)/dia</strong>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={simProdutosDia}
              onChange={(e) => setSimProdutosDia(Number(e.target.value))}
              style={{ width: '100%', accentColor: t.gold }}
            />
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          borderRadius: 12,
          padding: 12,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Comissão Extra Hoje</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: t.green }}>+{reais(ganhoExtraHoje)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Impacto em 24 dias</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24' }}>+{reais(ganhoExtraMes)}/mês</div>
          </div>
        </div>
      </div>

      {/* EXTRATO ITEM A ITEM */}
      <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 16, padding: 14, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: t.cream }}>
            📋 Extrato de Lançamentos ({linhas.length})
          </span>
          {onAtualizar && (
            <button
              type="button"
              onClick={onAtualizar}
              style={{ background: 'transparent', border: 'none', color: t.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Atualizar ↻
            </button>
          )}
        </div>

        {linhas.length === 0 ? (
          <div style={{ textAlign: 'center', color: t.muted, padding: '16px 0', fontSize: 13 }}>
            Nenhum lançamento faturado neste período ainda.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {linhas.map((l, i) => (
              <div
                key={`${l.origemId || i}-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: t.surface,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12.5,
                }}
              >
                <div style={{ minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontWeight: 700, color: t.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.descricao}
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                    {dataBR(l.data)} {l.cliente ? `· ${l.cliente}` : ''} · Bruto: {reais(l.base)} ({l.percentual}%)
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <strong style={{ color: t.green, fontSize: 13.5 }}>
                    +{reais(l.comissao)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
