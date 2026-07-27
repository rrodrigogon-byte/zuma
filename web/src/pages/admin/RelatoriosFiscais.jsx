/**
 * Relatórios Fiscais — SetPoint Ultra
 * SPED Fiscal, SPED Contribuições, SINTEGRA, Livros Fiscais, DAS Simples
 * Rota: /admin/fiscal/relatorios
 */
import { useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const T = {
  bg: '#0f1117', surface: '#1a1d27', card: '#22263a',
  green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df',
  line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff',
}

const RELATORIOS = [
  {
    grupo: 'SPED',
    icon: '📁',
    items: [
      { id: 'sped_fiscal', nome: 'SPED Fiscal (EFD ICMS/IPI)', desc: 'Escrituração Fiscal Digital — Bloco A ao K', endpoint: '/api/v1/fiscal/sped/fiscal', formato: 'txt' },
      { id: 'sped_contribuicoes', nome: 'SPED Contribuições (EFD-Contribuições)', desc: 'PIS/COFINS — Regime Cumulativo e Não-Cumulativo', endpoint: '/api/v1/fiscal/sped/contribuicoes', formato: 'txt' },
      { id: 'sped_ecf', nome: 'ECF — Escrituração Contábil Fiscal', desc: 'IRPJ e CSLL — Lucro Real/Presumido', endpoint: '/api/v1/fiscal/sped/ecf', formato: 'txt' },
    ]
  },
  {
    grupo: 'SINTEGRA',
    icon: '📊',
    items: [
      { id: 'sintegra', nome: 'SINTEGRA', desc: 'Sistema Integrado de Informações sobre Operações Interestaduais', endpoint: '/api/v1/fiscal/sintegra', formato: 'txt' },
    ]
  },
  {
    grupo: 'Livros Fiscais',
    icon: '📒',
    items: [
      { id: 'livro_entradas', nome: 'Livro de Entradas', desc: 'Registro de todas as notas de entrada (NF-e recebidas)', endpoint: '/api/v1/fiscal/livros/entradas', formato: 'pdf' },
      { id: 'livro_saidas', nome: 'Livro de Saídas', desc: 'Registro de todas as notas de saída emitidas', endpoint: '/api/v1/fiscal/livros/saidas', formato: 'pdf' },
      { id: 'livro_apuracao', nome: 'Livro de Apuração do ICMS', desc: 'Débitos, créditos e saldo do ICMS por período', endpoint: '/api/v1/fiscal/livros/apuracao-icms', formato: 'pdf' },
      { id: 'livro_inventario', nome: 'Livro de Inventário', desc: 'Estoque valorado no final do período', endpoint: '/api/v1/fiscal/livros/inventario', formato: 'pdf' },
    ]
  },
  {
    grupo: 'Simples Nacional',
    icon: '🟢',
    items: [
      { id: 'das', nome: 'DAS — Documento de Arrecadação', desc: 'Cálculo e geração do DAS mensal', endpoint: '/api/v1/fiscal/simples/das', formato: 'pdf' },
      { id: 'pgdas', nome: 'PGDAS-D — Declaração Mensal', desc: 'Programa Gerador do Documento de Arrecadação', endpoint: '/api/v1/fiscal/simples/pgdas', formato: 'pdf' },
      { id: 'defis', nome: 'DEFIS — Declaração Anual', desc: 'Declaração de Informações Socioeconômicas e Fiscais', endpoint: '/api/v1/fiscal/simples/defis', formato: 'pdf' },
    ]
  },
  {
    grupo: 'Relatórios de NF',
    icon: '🧾',
    items: [
      { id: 'nfce_dia', nome: 'NFC-e por Período', desc: 'Listagem de todas as NFC-e emitidas com status SEFAZ', endpoint: '/api/v1/fiscal/relatorios/nfce', formato: 'pdf' },
      { id: 'nfe_periodo', nome: 'NF-e por Período', desc: 'Listagem de todas as NF-e emitidas', endpoint: '/api/v1/fiscal/relatorios/nfe', formato: 'pdf' },
      { id: 'nfse_periodo', nome: 'NF-Se por Período', desc: 'Notas de serviço emitidas', endpoint: '/api/v1/fiscal/relatorios/nfse', formato: 'pdf' },
      { id: 'xml_lote', nome: 'Download XML em Lote', desc: 'Baixar todos os XMLs do período em .zip', endpoint: '/api/v1/fiscal/xml/lote', formato: 'zip' },
    ]
  },
]

export default function RelatoriosFiscais() {
  const { toast } = useToast()
  const [periodo, setPeriodo] = useState({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear() })
  const [gerando, setGerando] = useState({})
  const [regime, setRegime] = useState('simples')

  const gerarRelatorio = async (rel) => {
    setGerando(g => ({ ...g, [rel.id]: true }))
    try {
      const params = new URLSearchParams({ mes: periodo.mes, ano: periodo.ano, regime })
      const response = await fetch(`${rel.endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erro ao gerar relatório')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${rel.id}_${periodo.ano}_${String(periodo.mes).padStart(2, '0')}.${rel.formato}`
      a.click()
      URL.revokeObjectURL(url)
      toast(`${rel.nome} gerado com sucesso!`, 'success')
    } catch (e) {
      toast(e.message || 'Erro ao gerar relatório', 'error')
    } finally {
      setGerando(g => ({ ...g, [rel.id]: false }))
    }
  }

  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  return (
    <div style={{ padding: '20px 24px', color: T.cream }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>📑 Relatórios Fiscais</h1>
        <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>SPED, SINTEGRA, Livros Fiscais e Simples Nacional</div>
      </div>

      {/* Filtros */}
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20, marginBottom: 24, display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 6 }}>MÊS DE REFERÊNCIA</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {meses.map((m, i) => (
              <button key={i} onClick={() => setPeriodo(p => ({ ...p, mes: i + 1 }))} style={{
                padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: periodo.mes === i + 1 ? T.green : T.surface,
                color: periodo.mes === i + 1 ? '#fff' : T.muted,
              }}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 6 }}>ANO</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[2024, 2025, 2026].map(a => (
              <button key={a} onClick={() => setPeriodo(p => ({ ...p, ano: a }))} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: periodo.ano === a ? T.green : T.surface,
                color: periodo.ano === a ? '#fff' : T.muted,
              }}>{a}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 6 }}>REGIME TRIBUTÁRIO</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { v: 'simples', l: 'Simples Nacional' },
              { v: 'presumido', l: 'Lucro Presumido' },
              { v: 'real', l: 'Lucro Real' },
            ].map(r => (
              <button key={r.v} onClick={() => setRegime(r.v)} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: regime === r.v ? T.blue : T.surface,
                color: regime === r.v ? '#fff' : T.muted,
              }}>{r.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Grupos de relatórios */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {RELATORIOS.map(grupo => (
          <div key={grupo.grupo} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{grupo.icon}</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{grupo.grupo}</span>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {grupo.items.map(rel => (
                <div key={rel.id} style={{ background: T.surface, borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{rel.nome}</div>
                    <div style={{ color: T.muted, fontSize: 11, marginTop: 3 }}>{rel.desc}</div>
                    <div style={{ marginTop: 6, display: 'inline-block', padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,.06)', fontSize: 10, color: T.muted, fontWeight: 700 }}>
                      .{rel.formato.toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={() => gerarRelatorio(rel)}
                    disabled={gerando[rel.id]}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: 'none', cursor: gerando[rel.id] ? 'not-allowed' : 'pointer',
                      background: gerando[rel.id] ? T.surface : T.green,
                      color: gerando[rel.id] ? T.muted : '#fff',
                      fontSize: 12, fontWeight: 700, flexShrink: 0, minWidth: 90,
                    }}
                  >
                    {gerando[rel.id] ? '⏳ Gerando...' : '⬇ Gerar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Aviso SEFAZ */}
      <div style={{ marginTop: 20, background: 'rgba(245,166,35,.08)', border: `1px solid ${T.yellow}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 700, color: T.yellow, fontSize: 13 }}>Importante sobre os arquivos SPED</div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
            Os arquivos SPED gerados devem ser validados no <strong style={{ color: T.cream }}>Validador e Assinador (PVA)</strong> disponível no portal SPED antes de transmissão.
            Verifique sempre com seu contador as datas de entrega: SPED Fiscal (dia 15 do 2º mês subsequente), SPED Contribuições (dia 10 do 2º mês subsequente).
          </div>
        </div>
      </div>
    </div>
  )
}
