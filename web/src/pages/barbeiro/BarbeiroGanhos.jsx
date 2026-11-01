import { useState } from 'react'
import { abrirHtmlAutenticado } from '../admin/dino/RepassesPanel'

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

import { useToast } from '../../hooks/useToast';
export default function BarbeiroGanhos({ painel, onAtualizar }) {
  const { toast } = useToast();
  const [solicitandoSaque, setSolicitandoSaque] = useState(false);
  const [periodoSel, setPeriodoSel] = useState('dia') // 'dia', 'semana', 'mes'
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
  const ticketMedio = atendimentos > 0 ? bruto / atendimentos : 0

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
            <div style={{ fontSize: 32, fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>
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
            Líquido a Receber
          </span>
        </div>

        {periodoSel === 'dia' && pendenteEstimado > 0 && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#D1FAE5' }}>
              🚀 <strong>Previsão ao concluir os agendados de hoje:</strong>
            </span>
            <strong style={{ color: t.green, fontSize: 14 }}>{reais(previsaoTotal)}</strong>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Faturado na Cadeira</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.cream }}>{reais(bruto)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Atendimentos</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.cream }}>{atendimentos} realizados</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Ticket Médio</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.cream }}>{reais(ticketMedio)}</div>
          </div>
        </div>
      </div>

      {/* QUEBRA: SERVIÇOS VS PRODUTOS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* SERVIÇOS */}
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

        {/* PRODUTOS */}
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

      {/* DICA DE GANHOS DINO */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.15) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 14,
          padding: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 24 }}>💡</span>
        <div style={{ fontSize: 11.5, color: '#FEF3C7', lineHeight: 1.45 }}>
          <strong>Dica para Maximizar seus Ganhos:</strong> Cada pomada ou óleo vendido na finalização acrescenta comissão pura ao seu bolso e te aproxima de girar a <strong>Roleta de Prêmios</strong> da Dino!
        </div>
      </div>
    </div>
  )
}
