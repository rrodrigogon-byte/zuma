import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { Table } from '../customer360/shared'
import { money, dateTime } from '../dino/format'
import { MigracaoJson } from './FinanceiroRazao'
import '../customer360.css'
import '../dino/dino-admin.css'

// Conciliação financeira de todas as empresas, antes de ligar o Financeiro novo (razão único).
// Mostra, por empresa, o que está no financeiro antigo (JSON, inclui o histórico Avec), nas contas
// a receber do A2 e no razão. "Conferir" é só leitura; "Liberar" importa para o razão sem apagar
// nada do antigo. As telas de hoje só passam a ler o razão quando FINANCEIRO_RAZAO for ligado.
export default function ConciliacaoFinanceiraPlataforma() {
  const { toast } = useToast()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [aberta, setAberta] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try { setDados(await api.get('/api/admin/platform/razao/empresas')) }
    catch (error) { toast(error.message || 'Não foi possível carregar as empresas.', 'error') }
    finally { setCarregando(false) }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])

  const empresas = dados?.empresas || []
  return <div className="page dadm-page" style={{ display: 'grid', gap: 16 }}>
    <section className="dadm-card">
      <h1 style={{ marginTop: 0 }}>Conciliação financeira · todas as empresas</h1>
      <p className="dadm-muted">Contas a receber, contas a pagar e lançamentos de cada empresa, nas três bases: financeiro antigo, contas a receber do A2 e razão único (Financeiro novo). Conferir não grava nada. Liberar importa o financeiro antigo para o razão sem apagar nada.</p>
      <p className={dados?.ativo ? 'dadm-note' : 'dadm-note danger'}>{dados?.ativo ? 'Financeiro novo ligado: as telas de contas a pagar e a receber já leem o razão.' : 'Financeiro novo desligado (FINANCEIRO_RAZAO): as telas de hoje continuam lendo as bases antigas até a liberação de todas as empresas e o OK para ligar.'}</p>
      <div className="dadm-actions"><button type="button" className="c360-btn ghost" disabled={carregando} onClick={carregar}>{carregando ? 'Carregando…' : 'Atualizar'}</button></div>
    </section>
    <section className="dadm-card">
      <Table caption="Empresas" rows={empresas.map((e) => ({ ...e, id: e.empresaId }))} empty={carregando ? 'Carregando…' : 'Nenhuma empresa ativa.'} columns={[
        { key: 'nome', label: 'Empresa' },
        { key: 'antigo', label: 'Financeiro antigo', render: (e) => !e.financeiroAntigo ? <span className="dadm-muted">sem dados</span> : e.financeiroAntigo.erro ? <span className="dadm-neg">{e.financeiroAntigo.erro}</span> : <span>{e.financeiroAntigo.quantidade} lanç. · a receber {money(e.financeiroAntigo.receitaPendente)} · a pagar {money(e.financeiroAntigo.despesaPendente)}{e.financeiroAntigo.semUnidade ? ` · ${e.financeiroAntigo.semUnidade} sem unidade` : ''}</span> },
        { key: 'a2', label: 'A receber (A2)', render: (e) => e.a2ContasReceber ? `${e.a2ContasReceber.quantidade} · aberto ${money(e.a2ContasReceber.aberto)}` : '—' },
        { key: 'razao', label: 'Razão', render: (e) => e.razao ? `${e.razao.quantidade} lanç. · a receber ${money(e.razao.receber)} · a pagar ${money(e.razao.pagar)}` : '—' },
        { key: 'liberado', label: 'Liberação', render: (e) => e.config?.jsonLiberadoEm ? `liberado ${dateTime(e.config.jsonLiberadoEm)}` : (e.financeiroAntigo && !e.financeiroAntigo.erro ? 'pendente' : '—') },
        { key: 'acao', label: '', render: (e) => e.financeiroAntigo && !e.financeiroAntigo.erro ? <button type="button" className="c360-btn ghost" onClick={() => setAberta(aberta === e.empresaId ? '' : e.empresaId)}>{aberta === e.empresaId ? 'Fechar' : 'Conferir'}</button> : null },
      ]} />
    </section>
    {aberta && <div key={aberta}><h2 style={{ margin: '4px 0' }}>{empresas.find((e) => e.empresaId === aberta)?.nome}</h2><MigracaoJson empresaId={aberta} toast={toast} onMudou={carregar} /></div>}
  </div>
}
