import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate, fmtNum, fmtR } from '../../lib/api'
import './Omnichannel.css'

const ABAS = [
  { id: 'visao-geral', titulo: 'Visão geral' },
  { id: 'canais', titulo: 'Canais e delivery' },
  { id: 'fidelidade', titulo: 'Fidelidade e CRM' },
  { id: 'integracoes', titulo: 'Fila de integrações' },
]

const STATUS_PEDIDO = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  em_preparo: 'Em preparo',
  pronto: 'Pronto',
  despachado: 'Em rota',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  rejeitado: 'Rejeitado',
  falha: 'Com falha',
}

const ORIGENS = {
  ifood: 'iFood',
  uber_eats: 'Uber Eats',
  whatsapp: 'WhatsApp',
  web: 'Loja web',
  app: 'Aplicativo',
  telefone: 'Telefone',
  manual: 'Manual',
  outro: 'Outro',
}

const CONFIG_PADRAO = {
  ativo: false,
  pontos_por_real: 1,
  valor_minimo_compra: 0,
  pontos_por_real_resgate: 100,
  valor_por_bloco_resgate: 1,
  percentual_maximo_desconto: 30,
  validade_dias: '',
}

function numero(value, fallback = 0) {
  const valor = Number(value)
  return Number.isFinite(valor) ? valor : fallback
}

function statusClasse(status) {
  return `omni-status omni-status--${String(status || 'novo').replaceAll('_', '-')}`
}

function Mensagem({ mensagem }) {
  if (!mensagem?.texto) return null
  return <div className={`omni-message omni-message--${mensagem.tipo}`} role="status">{mensagem.texto}</div>
}

export default function Omnichannel() {
  const [aba, setAba] = useState('visao-geral')
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [mensagem, setMensagem] = useState(null)
  const [canais, setCanais] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [fila, setFila] = useState({ tarefas: [], acoes: [] })
  const [configuracao, setConfiguracao] = useState(CONFIG_PADRAO)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientes, setClientes] = useState([])
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [detalheCliente, setDetalheCliente] = useState(null)
  const [novoCanal, setNovoCanal] = useState({
    provedor: 'ifood', nome: '', status: 'rascunho', modo_operacao: 'webhook',
    algoritmo_assinatura: 'hmac_sha256', cabecalho_assinatura: 'x-signature', segredo_env: '', api_base_url: '',
  })

  const notificar = useCallback((tipo, texto) => {
    setMensagem({ tipo, texto })
    window.setTimeout(() => setMensagem(null), 5500)
  }, [])

  const carregarBase = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCarregando(true)
    try {
      const [listaCanais, listaPedidos, tarefas, regra] = await Promise.all([
        api.get('/api/omnichannel/canais'),
        api.get('/api/omnichannel/pedidos?limit=100'),
        api.get('/api/omnichannel/integracoes/tarefas'),
        api.get('/api/omnichannel/fidelidade/configuracao'),
      ])
      setCanais(listaCanais.canais || listaCanais || [])
      setPedidos(Array.isArray(listaPedidos) ? listaPedidos : (listaPedidos.pedidos || []))
      setFila({ tarefas: tarefas.tarefas || [], acoes: tarefas.acoes || [] })
      setConfiguracao({ ...CONFIG_PADRAO, ...(regra.configuracao || {}) })
    } catch (erro) {
      notificar('erro', erro.message || 'Não foi possível carregar a central omnichannel.')
    } finally {
      setCarregando(false)
    }
  }, [notificar])

  useEffect(() => { carregarBase() }, [carregarBase])

  const indicadores = useMemo(() => {
    const abertos = pedidos.filter((pedido) => !['concluido', 'cancelado', 'rejeitado'].includes(pedido.status))
    const pendentes = pedidos.filter((pedido) => pedido.status === 'novo').length
    const valorAberto = abertos.reduce((soma, pedido) => soma + numero(pedido.valor_total), 0)
    const comFalha = fila.tarefas.filter((tarefa) => tarefa.status === 'falha').length
      + fila.acoes.filter((acao) => acao.status === 'falha').length
    return { abertos: abertos.length, pendentes, valorAberto, comFalha }
  }, [pedidos, fila])

  const salvarCanal = async (evento) => {
    evento.preventDefault()
    if (!novoCanal.nome.trim()) return notificar('erro', 'Informe um nome para o canal.')
    if (novoCanal.status === 'ativo' && novoCanal.algoritmo_assinatura !== 'nenhum' && !novoCanal.segredo_env.trim()) {
      return notificar('erro', 'Um canal ativo exige a referência da variável de ambiente que contém o segredo.')
    }
    setAtualizando(true)
    try {
      const resposta = await api.post('/api/omnichannel/canais', {
        ...novoCanal,
        nome: novoCanal.nome.trim(),
        segredo_env: novoCanal.segredo_env.trim(),
        api_base_url: novoCanal.api_base_url.trim(),
      })
      const webhook = resposta.webhook_url ? ` Webhook: ${window.location.origin}${resposta.webhook_url}` : ''
      notificar('sucesso', `Canal cadastrado com segurança.${webhook}`)
      setNovoCanal({ provedor: 'ifood', nome: '', status: 'rascunho', modo_operacao: 'webhook', algoritmo_assinatura: 'hmac_sha256', cabecalho_assinatura: 'x-signature', segredo_env: '', api_base_url: '' })
      await carregarBase({ silencioso: true })
    } catch (erro) {
      notificar('erro', erro.message || 'Não foi possível cadastrar o canal.')
    } finally {
      setAtualizando(false)
    }
  }

  const salvarConfiguracao = async (evento) => {
    evento.preventDefault()
    setAtualizando(true)
    try {
      const resposta = await api.put('/api/omnichannel/fidelidade/configuracao', {
        ...configuracao,
        pontos_por_real: numero(configuracao.pontos_por_real),
        valor_minimo_compra: numero(configuracao.valor_minimo_compra),
        pontos_por_real_resgate: numero(configuracao.pontos_por_real_resgate),
        valor_por_bloco_resgate: numero(configuracao.valor_por_bloco_resgate),
        percentual_maximo_desconto: numero(configuracao.percentual_maximo_desconto),
        validade_dias: configuracao.validade_dias === '' ? null : Number(configuracao.validade_dias),
      })
      setConfiguracao({ ...CONFIG_PADRAO, ...(resposta.configuracao || {}) })
      notificar('sucesso', 'Configuração de fidelidade salva para a loja ativa.')
    } catch (erro) {
      notificar('erro', erro.message || 'Não foi possível salvar a configuração de fidelidade.')
    } finally {
      setAtualizando(false)
    }
  }

  const pesquisarClientes = async (evento) => {
    evento?.preventDefault()
    try {
      const resposta = await api.get(`/api/omnichannel/clientes?busca=${encodeURIComponent(buscaCliente)}&limit=40`)
      setClientes(resposta.clientes || [])
      if (!resposta.clientes?.length) notificar('info', 'Nenhum cliente encontrado para a busca informada.')
    } catch (erro) {
      notificar('erro', erro.message || 'Não foi possível consultar os clientes.')
    }
  }

  const abrirCliente = async (cliente) => {
    setClienteSelecionado(cliente)
    setDetalheCliente(null)
    try {
      const resposta = await api.get(`/api/omnichannel/clientes/${cliente.id}/fidelidade`)
      setDetalheCliente(resposta)
    } catch (erro) {
      notificar('erro', erro.message || 'Não foi possível carregar o histórico de fidelidade.')
    }
  }

  const atualizarConsentimento = async (canal, finalidade, concedido) => {
    if (!clienteSelecionado) return
    try {
      await api.put(`/api/omnichannel/clientes/${clienteSelecionado.id}/consentimentos`, { canal, finalidade, concedido, evidencia: { origem: 'central_omnichannel' } })
      await abrirCliente(clienteSelecionado)
      notificar('sucesso', 'Consentimento atualizado e registrado na trilha LGPD.')
    } catch (erro) {
      notificar('erro', erro.message || 'Não foi possível atualizar o consentimento.')
    }
  }

  if (carregando) {
    return <div className="omni-loading">Carregando operação omnichannel da loja ativa…</div>
  }

  return (
    <main className="omnichannel-page">
      <header className="omni-header">
        <div>
          <p className="omni-eyebrow">Operação integrada</p>
          <h1>Central omnichannel</h1>
          <p className="omni-subtitle">Canais de venda, delivery, pedidos, fidelidade e integrações consolidados por loja.</p>
        </div>
        <div className="omni-header-actions">
          <Link className="omni-button omni-button--secondary" to="/loja-atendimento">Abrir atendimento</Link>
          <button className="omni-button" type="button" onClick={() => carregarBase()} disabled={carregando || atualizando}>Atualizar dados</button>
        </div>
      </header>

      <Mensagem mensagem={mensagem} />

      <section className="omni-kpis" aria-label="Resumo operacional">
        <article><span>Pedidos abertos</span><strong>{fmtNum(indicadores.abertos)}</strong><small>{fmtNum(indicadores.pendentes)} aguardando aceite</small></article>
        <article><span>Valor em operação</span><strong>{fmtR(indicadores.valorAberto)}</strong><small>Pedidos ainda não concluídos</small></article>
        <article><span>Canais ativos</span><strong>{fmtNum(canais.filter((canal) => canal.status === 'ativo').length)}</strong><small>{fmtNum(canais.length)} configurados nesta loja</small></article>
        <article className={indicadores.comFalha ? 'omni-kpi--attention' : ''}><span>Integrações com falha</span><strong>{fmtNum(indicadores.comFalha)}</strong><small>Exigem revisão operacional</small></article>
      </section>

      <nav className="omni-tabs" aria-label="Seções da central">
        {ABAS.map((item) => <button type="button" key={item.id} className={aba === item.id ? 'is-active' : ''} onClick={() => setAba(item.id)}>{item.titulo}</button>)}
      </nav>

      {aba === 'visao-geral' && (
        <section className="omni-grid omni-grid--overview">
          <article className="omni-panel omni-panel--wide">
            <div className="omni-panel-heading"><div><h2>Pedidos recentes</h2><p>Todos os canais são tratados no mesmo fluxo operacional.</p></div><Link to="/loja-atendimento">Gerenciar pedidos</Link></div>
            <div className="omni-table-wrap">
              <table className="omni-table"><thead><tr><th>Pedido</th><th>Canal</th><th>Cliente</th><th>Status</th><th>Total</th><th>Recebido</th></tr></thead>
                <tbody>{pedidos.slice(0, 8).map((pedido) => <tr key={pedido.id}><td><strong>{pedido.numero_interno || '—'}</strong></td><td>{ORIGENS[pedido.origem] || pedido.origem}</td><td>{pedido.cliente_nome || pedido.cliente?.nome || 'Consumidor'}</td><td><span className={statusClasse(pedido.status)}>{STATUS_PEDIDO[pedido.status] || pedido.status}</span></td><td>{fmtR(pedido.valor_total)}</td><td>{fmtDate(pedido.recebido_em || pedido.data_criacao)}</td></tr>)}
                  {!pedidos.length && <tr><td colSpan="6" className="omni-empty">Ainda não há pedidos omnichannel nesta loja.</td></tr>}</tbody>
              </table>
            </div>
          </article>
          <article className="omni-panel">
            <div className="omni-panel-heading"><div><h2>Saúde das integrações</h2><p>Filas desacopladas evitam bloqueio do recebimento de pedidos.</p></div></div>
            <dl className="omni-health"><div><dt>Tarefas pendentes</dt><dd>{fmtNum(fila.tarefas.filter((tarefa) => ['pendente', 'processando'].includes(tarefa.status)).length)}</dd></div><div><dt>Ações de retorno</dt><dd>{fmtNum(fila.acoes.filter((acao) => ['pendente', 'processando'].includes(acao.status)).length)}</dd></div><div><dt>Falhas</dt><dd className={indicadores.comFalha ? 'is-alert' : ''}>{fmtNum(indicadores.comFalha)}</dd></div></dl>
            <button type="button" className="omni-link-button" onClick={() => setAba('integracoes')}>Ver fila de integração</button>
          </article>
        </section>
      )}

      {aba === 'canais' && (
        <section className="omni-grid omni-grid--channels">
          <article className="omni-panel">
            <div className="omni-panel-heading"><div><h2>Canais configurados</h2><p>Credenciais sensíveis ficam somente nas variáveis de ambiente.</p></div></div>
            <div className="omni-channel-list">
              {canais.map((canal) => <article className="omni-channel-card" key={canal.id}><div><h3>{canal.nome}</h3><p>{ORIGENS[canal.provedor] || canal.provedor} · {canal.modo_operacao}</p></div><span className={`omni-status omni-status--${canal.status}`}>{canal.status}</span><dl><div><dt>Assinatura</dt><dd>{canal.algoritmo_assinatura}</dd></div><div><dt>Webhook</dt><dd className="omni-code">/omnichannel/webhooks/{canal.codigo_publico}</dd></div></dl></article>)}
              {!canais.length && <p className="omni-empty omni-empty--card">Nenhum canal cadastrado. Comece por um canal em rascunho.</p>}
            </div>
          </article>
          <article className="omni-panel">
            <div className="omni-panel-heading"><div><h2>Novo canal</h2><p>Cadastre primeiro em rascunho e ative apenas após provisionar a credencial.</p></div></div>
            <form className="omni-form" onSubmit={salvarCanal}>
              <label>Provedor<select value={novoCanal.provedor} onChange={(e) => setNovoCanal({ ...novoCanal, provedor: e.target.value })}><option value="ifood">iFood</option><option value="uber_eats">Uber Eats</option><option value="whatsapp">WhatsApp</option><option value="web">Loja web</option><option value="app">Aplicativo</option><option value="telefone">Telefone</option><option value="outro">Outro</option></select></label>
              <label>Nome operacional<input required value={novoCanal.nome} placeholder="Ex.: iFood — Unidade Centro" onChange={(e) => setNovoCanal({ ...novoCanal, nome: e.target.value })} /></label>
              <div className="omni-form-grid"><label>Status<select value={novoCanal.status} onChange={(e) => setNovoCanal({ ...novoCanal, status: e.target.value })}><option value="rascunho">Rascunho</option><option value="ativo">Ativo</option><option value="pausado">Pausado</option></select></label><label>Modo<select value={novoCanal.modo_operacao} onChange={(e) => setNovoCanal({ ...novoCanal, modo_operacao: e.target.value })}><option value="webhook">Webhook</option><option value="polling">Consulta periódica</option><option value="manual">Manual</option><option value="misto">Misto</option></select></label></div>
              <div className="omni-form-grid"><label>Algoritmo<select value={novoCanal.algoritmo_assinatura} onChange={(e) => setNovoCanal({ ...novoCanal, algoritmo_assinatura: e.target.value })}><option value="hmac_sha256">HMAC SHA-256</option><option value="token_estatico">Token estático</option><option value="nenhum">Nenhum (somente desenvolvimento)</option></select></label><label>Cabeçalho de assinatura<input value={novoCanal.cabecalho_assinatura} onChange={(e) => setNovoCanal({ ...novoCanal, cabecalho_assinatura: e.target.value })} /></label></div>
              <label>Nome da variável de segredo<input value={novoCanal.segredo_env} placeholder="IFOOD_WEBHOOK_SECRET" onChange={(e) => setNovoCanal({ ...novoCanal, segredo_env: e.target.value.toUpperCase() })} /><small>O valor do segredo nunca é digitado nem armazenado nesta tela.</small></label>
              <label>URL base da API (opcional)<input type="url" value={novoCanal.api_base_url} placeholder="https://api.exemplo.com" onChange={(e) => setNovoCanal({ ...novoCanal, api_base_url: e.target.value })} /></label>
              <button className="omni-button" disabled={atualizando} type="submit">{atualizando ? 'Salvando…' : 'Cadastrar canal'}</button>
            </form>
          </article>
        </section>
      )}

      {aba === 'fidelidade' && (
        <section className="omni-grid omni-grid--loyalty">
          <article className="omni-panel">
            <div className="omni-panel-heading"><div><h2>Programa de fidelidade</h2><p>As regras são isoladas por loja e todo crédito ou resgate tem extrato.</p></div></div>
            <form className="omni-form" onSubmit={salvarConfiguracao}>
              <label className="omni-switch"><input type="checkbox" checked={Boolean(configuracao.ativo)} onChange={(e) => setConfiguracao({ ...configuracao, ativo: e.target.checked })} /><span>Programa ativo nesta loja</span></label>
              <div className="omni-form-grid"><label>Pontos por R$ 1<input type="number" min="0" step="0.0001" value={configuracao.pontos_por_real} onChange={(e) => setConfiguracao({ ...configuracao, pontos_por_real: e.target.value })} /></label><label>Compra mínima (R$)<input type="number" min="0" step="0.01" value={configuracao.valor_minimo_compra} onChange={(e) => setConfiguracao({ ...configuracao, valor_minimo_compra: e.target.value })} /></label></div>
              <div className="omni-form-grid"><label>Pontos por R$ 1 de resgate<input type="number" min="0.0001" step="0.0001" value={configuracao.pontos_por_real_resgate} onChange={(e) => setConfiguracao({ ...configuracao, pontos_por_real_resgate: e.target.value })} /></label><label>Valor do bloco de resgate (R$)<input type="number" min="0.01" step="0.01" value={configuracao.valor_por_bloco_resgate} onChange={(e) => setConfiguracao({ ...configuracao, valor_por_bloco_resgate: e.target.value })} /></label></div>
              <div className="omni-form-grid"><label>Máximo de desconto (%)<input type="number" min="0" max="100" step="0.01" value={configuracao.percentual_maximo_desconto} onChange={(e) => setConfiguracao({ ...configuracao, percentual_maximo_desconto: e.target.value })} /></label><label>Validade dos pontos (dias)<input type="number" min="1" step="1" value={configuracao.validade_dias ?? ''} placeholder="Sem expiração" onChange={(e) => setConfiguracao({ ...configuracao, validade_dias: e.target.value })} /></label></div>
              <button className="omni-button" disabled={atualizando} type="submit">{atualizando ? 'Salvando…' : 'Salvar regras'}</button>
            </form>
          </article>
          <article className="omni-panel">
            <div className="omni-panel-heading"><div><h2>Consulta de cliente</h2><p>Confira saldo, extrato e consentimentos registrados.</p></div></div>
            <form className="omni-search" onSubmit={pesquisarClientes}><input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Nome, telefone ou e-mail" /><button type="submit">Buscar</button></form>
            <div className="omni-customer-list">{clientes.map((cliente) => <button type="button" className={clienteSelecionado?.id === cliente.id ? 'is-selected' : ''} key={cliente.id} onClick={() => abrirCliente(cliente)}><span><strong>{cliente.nome}</strong><small>{cliente.telefone || cliente.email || 'Sem contato informado'}</small></span><b>{fmtNum(cliente.pontos)} pts</b></button>)}</div>
            {clienteSelecionado && <section className="omni-customer-detail"><h3>{clienteSelecionado.nome}</h3>{!detalheCliente ? <p>Carregando extrato…</p> : <><p><strong>{fmtNum(detalheCliente.programa?.pontos || 0)} pontos disponíveis</strong></p><div className="omni-consents"><h4>Consentimentos</h4>{['whatsapp', 'email'].map((canal) => { const atual = detalheCliente.consentimentos?.find((item) => item.canal === canal && item.finalidade === 'marketing'); return <label key={canal} className="omni-switch"><input type="checkbox" checked={Boolean(atual?.concedido)} onChange={(e) => atualizarConsentimento(canal, 'marketing', e.target.checked)} /><span>Marketing por {canal}</span></label> })}</div><div className="omni-extract"><h4>Extrato recente</h4>{detalheCliente.extrato?.slice(0, 5).map((item) => <div key={item.id}><span>{item.descricao || item.tipo}</span><b className={numero(item.pontos) >= 0 ? 'is-credit' : 'is-debit'}>{numero(item.pontos) >= 0 ? '+' : ''}{fmtNum(item.pontos)} pts</b></div>)}{!detalheCliente.extrato?.length && <p>Não há movimentações de pontos.</p>}</div></>}</section>}
          </article>
        </section>
      )}

      {aba === 'integracoes' && (
        <section className="omni-grid omni-grid--integration">
          <article className="omni-panel">
            <div className="omni-panel-heading"><div><h2>Tarefas de integração</h2><p>Eventos são processados de forma idempotente, com retentativas controladas.</p></div></div>
            <div className="omni-table-wrap"><table className="omni-table"><thead><tr><th>Canal</th><th>Tipo</th><th>Status</th><th>Tentativas</th><th>Próxima tentativa</th><th>Erro</th></tr></thead><tbody>{fila.tarefas.map((tarefa) => <tr key={tarefa.id}><td>{tarefa.canal_nome || tarefa.canal_id}</td><td>{tarefa.tipo}</td><td><span className={`omni-status omni-status--${tarefa.status}`}>{tarefa.status}</span></td><td>{fmtNum(tarefa.tentativas)}</td><td>{fmtDate(tarefa.proxima_tentativa_em)}</td><td className="omni-error-cell">{tarefa.erro || '—'}</td></tr>)}{!fila.tarefas.length && <tr><td colSpan="6" className="omni-empty">Nenhuma tarefa na fila.</td></tr>}</tbody></table></div>
          </article>
          <article className="omni-panel">
            <div className="omni-panel-heading"><div><h2>Ações externas</h2><p>Atualizações enviadas de volta aos parceiros de delivery.</p></div></div>
            <div className="omni-table-wrap"><table className="omni-table"><thead><tr><th>Pedido</th><th>Ação</th><th>Canal</th><th>Status</th><th>Solicitada em</th></tr></thead><tbody>{fila.acoes.map((acao) => <tr key={acao.id}><td>{acao.numero_interno || '—'}</td><td>{acao.acao}</td><td>{acao.canal_nome || 'Canal interno'}</td><td><span className={`omni-status omni-status--${acao.status}`}>{acao.status}</span></td><td>{fmtDate(acao.solicitado_em)}</td></tr>)}{!fila.acoes.length && <tr><td colSpan="5" className="omni-empty">Nenhuma ação externa pendente.</td></tr>}</tbody></table></div>
          </article>
        </section>
      )}
    </main>
  )
}
