import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { money } from './dino/format'
import './customer360.css'
import './dino/dino-admin.css'

// Painel inicial de uma empresa sem painel de marca próprio: o dia da empresa a partir dos
// módulos por empresa (Financeiro, estoque, reservas e PDV offline). Cada bloco só aparece com a
// permissão da pessoa e some sozinho se o módulo não responder; nada aqui lê o banco global.
const pode = (permissoes, codigo) => !Array.isArray(permissoes) || permissoes.includes(codigo)

export default function PainelEmpresa() {
  const { empresaAtiva, lojaAtiva, permissoes } = useAuth()
  const [dados, setDados] = useState(null)

  useEffect(() => {
    if (permissoes === undefined) return undefined
    let vivo = true
    const loja = lojaAtiva?.id ? `lojaId=${encodeURIComponent(lojaAtiva.id)}` : ''
    const talvez = (ok, consulta) => (ok ? consulta().catch(() => null) : Promise.resolve(null))
    Promise.all([
      talvez(pode(permissoes, 'payments.read'), () => api.get(`/api/admin/razao/estado`)),
      talvez(pode(permissoes, 'payments.read'), () => api.get(`/api/admin/razao/resumo${loja ? `?${loja}` : ''}`)),
      talvez(pode(permissoes, 'inventory.read'), () => api.get(`/api/admin/suprimentos/itens?abaixoDoMinimo=true${loja ? `&${loja}` : ''}`)),
      talvez(pode(permissoes, 'customers.read'), () => api.get('/api/admin/salao/reservas/visao')),
      talvez(pode(permissoes, 'payments.read'), () => api.get('/api/pdv-offline/conflitos')),
    ]).then(([estado, resumo, faltando, salao, pdv]) => {
      if (vivo) setDados({ estado, resumo: estado?.ativo ? resumo : null, faltando: Array.isArray(faltando) ? faltando : null, salao, conflitos: pdv?.conflitos || null })
    })
    return () => { vivo = false }
  }, [empresaAtiva?.id, lojaAtiva?.id, permissoes])

  const r = dados?.resumo
  const nada = dados && !r && !dados.faltando && !dados.salao && !dados.conflitos
  return <section className="dadm-page" aria-labelledby="painel-empresa-titulo">
    <header className="dadm-head"><div>
      <div className="dadm-eyebrow">{empresaAtiva?.nome || 'Empresa'}{lojaAtiva?.nome ? ` · ${lojaAtiva.nome}` : ''}</div>
      <h1 id="painel-empresa-titulo">Painel</h1>
      <p>O dia da empresa: dinheiro, estoque, salão e caixa.</p>
    </div></header>

    {!dados && <p className="dadm-muted">Carregando…</p>}

    {r && <section className="dadm-kpis" aria-label="Financeiro">
      <article><span>Recebido no mês</span><strong>{money(r.recMes)}</strong><small><Link to="/admin/financeiro">Abrir o Financeiro</Link></small></article>
      <article className={r.resultadoMes < 0 ? 'is-alert' : ''}><span>Resultado do mês</span><strong>{money(r.resultadoMes)}</strong><small>Recebido − pago</small></article>
      <article className={r.receberVencidos ? 'is-alert' : ''}><span>A receber</span><strong>{money(r.aReceber)}</strong><small>{r.receberVencidos ? `${r.receberVencidos} vencida(s)` : 'Nada vencido'}</small></article>
      <article className={r.pagarVencidos ? 'is-alert' : ''}><span>A pagar</span><strong>{money(r.aPagar)}</strong><small>{r.pagarVencidos ? `${r.pagarVencidos} vencida(s)` : r.vencendo3Dias ? `${r.vencendo3Dias} vencem em 3 dias` : 'Nada vencido'}</small></article>
    </section>}
    {dados?.estado && !dados.estado.ativo && <p className="dadm-note">O Financeiro novo ainda não está ligado nesta instalação. <Link to="/admin/financeiro">Abrir o Financeiro</Link></p>}

    {(dados?.faltando || dados?.salao || dados?.conflitos) && <section className="dadm-kpis" aria-label="Operação">
      {dados.faltando && <article className={dados.faltando.length ? 'is-alert' : ''}><span>Abaixo do mínimo</span><strong>{dados.faltando.length}</strong><small>{dados.faltando.length ? <Link to="/admin/compras">{dados.faltando.slice(0, 2).map((i) => i.nome).join(', ')}{dados.faltando.length > 2 ? '…' : ''}</Link> : 'Estoque em dia'}</small></article>}
      {dados.salao && <article><span>Reservas hoje</span><strong>{dados.salao.ocupacao?.totalReservas ?? 0}</strong><small><Link to="/admin/reservas">{dados.salao.ocupacao?.pessoasPrevistas ?? 0} pessoa(s) previstas</Link></small></article>}
      {dados.conflitos && <article className={dados.conflitos.length ? 'is-alert' : ''}><span>PDV offline</span><strong>{dados.conflitos.length}</strong><small>{dados.conflitos.length ? <Link to="/admin/pdv-offline">conflito(s) para decidir</Link> : 'Sem pendências'}</small></article>}
    </section>}

    {nada && <p className="dadm-note">Ainda não há módulos com dados para mostrar aqui. Use o menu ao lado para começar.</p>}
  </section>
}
