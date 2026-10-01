import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { Badge, Table } from '../customer360/shared'
import { dateTime, downloadCsv } from './format'
import '../customer360.css'
import './dino-admin.css'

// Tradução das ações mais comuns para leitura humana (o código original fica no detalhe).
const ACOES = [
  [/^VIEW CUSTOMER360/, 'Abriu ficha de cliente'], [/^REVEAL CUSTOMER360/, 'Revelou dado de cliente'], [/^EXPORT CUSTOMER360/, 'Exportou dados de cliente'],
  [/^ANONYMIZE CUSTOMER360|customer_360\.anonymize/, 'Anonimizou cliente'], [/customer_360\.view/, 'Abriu ficha de cliente'], [/customer_360\.reveal/, 'Revelou dado de cliente'], [/customer_360\.export/, 'Exportou dados de cliente'],
  [/^FINANCEIRO LANCAMENTO/, 'Lançamento financeiro'], [/^FINANCEIRO ATUALIZACAO/, 'Alterou lançamento'], [/^FINANCEIRO CANCELAMENTO/, 'Cancelou lançamento'],
  [/^WHATSAPP CONEXAO QR/, 'Gerou QR do WhatsApp'], [/^WHATSAPP CONEXAO DESCONECTAR/, 'Desconectou o WhatsApp'], [/^WHATSAPP CONEXAO TESTE/, 'Enviou teste de WhatsApp'], [/^WHATSAPP CONEXAO CONFIG/, 'Alterou conexão do WhatsApp'],
  [/whatsapp_ai_channel/, 'Configuração do atendente IA'], [/^POST .*\/agenda/, 'Criou/alterou agendamento'], [/^PATCH .*\/agenda/, 'Alterou agendamento'],
  [/^POST .*\/comandas/, 'Movimentou comanda'], [/^PATCH .*\/comandas/, 'Alterou comanda'], [/^POST .*\/clientes/, 'Cadastrou cliente'], [/^PATCH .*\/clientes/, 'Alterou cliente'],
  [/^(POST|PATCH|PUT|DELETE) .*\/(servicos|profissionais|planos)/, 'Alterou catálogo/equipe'], [/^(POST|PATCH|PUT|DELETE) .*\/(caixas|operacao)/, 'Movimentou caixa'],
]
const traduzir = (acao) => ACOES.find(([regex]) => regex.test(acao))?.[1] || acao

export default function AuditoriaEmpresa() {
  const { empresaAtiva } = useAuth()
  const [dados, setDados] = useState({ itens: [], fontes: {} })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [q, setQ] = useState('')
  const [fonte, setFonte] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { setDados(await api.get('/api/admin/barbearia/auditoria?limite=500')); setErro('') }
    catch (error) { setErro(error.message || 'Não foi possível carregar a auditoria.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load, empresaAtiva?.id])

  const itens = useMemo(() => (dados.itens || []).filter((item) => (!fonte || item.fonte === fonte)
    && (!q || `${item.user} ${item.acao} ${traduzir(item.acao)} ${item.detalhe}`.toLowerCase().includes(q.toLowerCase()))), [dados, q, fonte])

  const columns = [
    { key: 'ts', label: 'Quando', render: (item) => <span style={{ whiteSpace: 'nowrap' }}>{dateTime(item.ts)}</span> },
    { key: 'user', label: 'Quem' },
    { key: 'acao', label: 'Ação', render: (item) => <div><strong>{traduzir(item.acao)}</strong>{traduzir(item.acao) !== item.acao && <div className="dadm-muted">{item.acao}</div>}</div> },
    { key: 'detalhe', label: 'Detalhe', render: (item) => <span className="dadm-muted" style={{ overflowWrap: 'anywhere' }}>{item.detalhe || '—'}</span> },
    { key: 'fonte', label: 'Origem', render: (item) => <Badge tone={item.fonte === 'banco' ? 'info' : 'muted'}>{item.fonte === 'banco' ? 'Banco (permanente)' : 'Sistema'}</Badge> },
  ]

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Gestão · {empresaAtiva?.nome || 'Empresa'}</div><h1>Auditoria</h1><p>Quem fez o quê nesta empresa: acessos a fichas de clientes (LGPD), mudanças de agenda, comandas, financeiro e WhatsApp. Registros de outras empresas da plataforma não aparecem aqui.</p></div>
      <div className="dadm-actions">
        <button type="button" className="c360-btn ghost" onClick={load}>Atualizar</button>
        <button type="button" className="c360-btn ghost" disabled={!itens.length} onClick={() => downloadCsv(`auditoria_${new Date().toISOString().slice(0, 10)}.csv`, itens.map((item) => ({ quando: item.ts, quem: item.user, acao: traduzir(item.acao), codigo: item.acao, detalhe: item.detalhe, origem: item.fonte })))}>Exportar CSV</button>
      </div>
    </header>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {!dados.fontes?.banco && !loading && <p className="dadm-note">Mostrando a trilha do sistema. A trilha permanente do banco aparece quando a loja online (Commerce) está ativa para o seu perfil.</p>}
    <section className="dadm-card">
      <div className="dadm-filters">
        <input className="c360-input" type="search" placeholder="Buscar pessoa, ação ou detalhe" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Buscar na auditoria" />
        <select className="c360-input" value={fonte} onChange={(event) => setFonte(event.target.value)} aria-label="Origem"><option value="">Todas as origens</option><option value="sistema">Sistema</option><option value="banco">Banco (permanente)</option></select>
        <span className="dadm-muted">{itens.length} registro(s)</span>
      </div>
      {loading ? <p className="dadm-muted">Carregando…</p> : <Table caption="Registros de auditoria" columns={columns} rows={itens} empty="Nenhum registro encontrado." />}
    </section>
  </div>
}
