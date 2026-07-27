import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtDate } from '../../lib/api'
import { baixarFilaOffline, entregarFilaAoAgente, resumoFilaOffline } from '../../lib/pdvOffline'
import { useAuth } from '../../lib/auth'
import './PDVOffline.css'

const TIPOS_DISPOSITIVO = [
  ['impressora_termica', 'Impressora térmica'],
  ['leitor_codigo_barras', 'Leitor de código de barras'],
  ['balanca', 'Balança'],
  ['gaveta', 'Gaveta de dinheiro'],
  ['pinpad', 'Pinpad / TEF'],
  ['display_cliente', 'Display do cliente'],
  ['outro', 'Outro'],
]

function Status({ value }) {
  const label = {
    online: 'Online', offline: 'Offline', erro: 'Erro', desconhecido: 'Sem sinal',
    pendente: 'Pendente', processado: 'Processado', conflito: 'Conflito', falha: 'Falha',
  }[value] || value || '—'
  return <span className={`pdvo-status pdvo-status--${value || 'desconhecido'}`}>{label}</span>
}

function Modal({ titulo, children, onClose }) {
  return (
    <div className="pdvo-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="pdvo-modal" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>{titulo}</h2><button className="pdvo-icon-button" onClick={onClose} aria-label="Fechar">×</button></header>
        {children}
      </section>
    </div>
  )
}

const inicialTerminal = { loja_id: '', codigo: '', nome: '', identificador_dispositivo: '', modo_offline_habilitado: true }
const inicialDispositivo = { loja_id: '', terminal_id: '', tipo: 'impressora_termica', nome: '', fabricante: '', modelo: '', endereco_conexao: '', modo: 'diagnostico', host: '', porta: '9100' }

export default function PDVOffline() {
  const { lojaAtiva, lojasAcessiveis } = useAuth()
  const [terminais, setTerminais] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [conflitos, setConflitos] = useState([])
  const [resumoLocal, setResumoLocal] = useState({ total: 0, pendente: 0, entregue_ao_agente: 0, falha: 0 })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modal, setModal] = useState(null)
  const [terminalForm, setTerminalForm] = useState(inicialTerminal)
  const [dispositivoForm, setDispositivoForm] = useState(inicialDispositivo)
  const [tokenExibido, setTokenExibido] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const lojaSelecionada = terminalForm.loja_id || lojaAtiva?.id || ''
  const mapaLojas = useMemo(() => new Map((lojasAcessiveis || []).map((loja) => [loja.id, loja])), [lojasAcessiveis])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const [dadosTerminais, dadosDispositivos, dadosConflitos, fila] = await Promise.all([
        api.get('/api/pdv-offline/terminais'),
        lojaAtiva?.id ? api.get(`/api/pdv-offline/dispositivos?loja_id=${lojaAtiva.id}`) : Promise.resolve({ dispositivos: [] }),
        api.get('/api/pdv-offline/conflitos').catch(() => ({ conflitos: [] })),
        resumoFilaOffline(),
      ])
      setTerminais(dadosTerminais.terminais || [])
      setDispositivos(dadosDispositivos.dispositivos || [])
      setConflitos(dadosConflitos.conflitos || [])
      setResumoLocal(fila)
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar a central de PDV offline')
    } finally {
      setCarregando(false)
    }
  }, [lojaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  const abrirTerminal = () => {
    setTerminalForm({ ...inicialTerminal, loja_id: lojaAtiva?.id || lojasAcessiveis?.[0]?.id || '' })
    setModal('terminal')
  }

  const abrirDispositivo = () => {
    setDispositivoForm({ ...inicialDispositivo, loja_id: lojaAtiva?.id || lojasAcessiveis?.[0]?.id || '' })
    setModal('dispositivo')
  }

  const cadastrarTerminal = async (event) => {
    event.preventDefault()
    setSalvando(true); setErro('')
    try {
      const resposta = await api.post('/api/pdv-offline/terminais', terminalForm)
      setTokenExibido({ terminal: resposta.terminal, token: resposta.token_provisionamento })
      setModal('token')
      setMensagem(`Terminal ${resposta.terminal.codigo} provisionado com sucesso.`)
      await carregar()
    } catch (err) { setErro(err.message || 'Não foi possível criar o terminal') }
    finally { setSalvando(false) }
  }

  const cadastrarDispositivo = async (event) => {
    event.preventDefault()
    setSalvando(true); setErro('')
    try {
      const configuracoes = {
        modo: dispositivoForm.modo,
        ...(dispositivoForm.host ? { host: dispositivoForm.host } : {}),
        ...(dispositivoForm.porta ? { porta: Number(dispositivoForm.porta) } : {}),
      }
      await api.post('/api/pdv-offline/dispositivos', {
        loja_id: dispositivoForm.loja_id,
        terminal_id: dispositivoForm.terminal_id || null,
        tipo: dispositivoForm.tipo,
        nome: dispositivoForm.nome,
        fabricante: dispositivoForm.fabricante || null,
        modelo: dispositivoForm.modelo || null,
        endereco_conexao: dispositivoForm.endereco_conexao || null,
        configuracoes,
      })
      setMensagem('Periférico cadastrado. Use o modo de diagnóstico antes da ativação física.')
      setModal(null)
      await carregar()
    } catch (err) { setErro(err.message || 'Não foi possível cadastrar o periférico') }
    finally { setSalvando(false) }
  }

  const rotacionarToken = async (terminal) => {
    if (!window.confirm(`Rotacionar a credencial do terminal ${terminal.codigo}? O agente instalado deixará de autenticar até receber o novo token.`)) return
    setSalvando(true); setErro('')
    try {
      const resposta = await api.post(`/api/pdv-offline/terminais/${terminal.id}/rotacionar-token`, {})
      setTokenExibido({ terminal, token: resposta.token_provisionamento })
      setModal('token')
      setMensagem(`Credencial do terminal ${terminal.codigo} rotacionada.`)
    } catch (err) { setErro(err.message || 'Não foi possível rotacionar o token') }
    finally { setSalvando(false) }
  }

  const resolverConflito = async (conflito, resolucao) => {
    setSalvando(true); setErro('')
    try {
      await api.patch(`/api/pdv-offline/conflitos/${conflito.id}`, { resolucao })
      setMensagem('Conflito marcado para reconciliação.')
      await carregar()
    } catch (err) { setErro(err.message || 'Não foi possível resolver o conflito') }
    finally { setSalvando(false) }
  }

  const enviarFila = async () => {
    setSalvando(true); setErro('')
    try {
      const resultado = await entregarFilaAoAgente()
      setMensagem(resultado.entregue ? `${resultado.entregue} evento(s) transferido(s) ao agente local.` : 'Não há eventos pendentes na fila local.')
      setResumoLocal(await resumoFilaOffline())
    } catch (err) {
      setErro(`Não foi possível transferir a fila: ${err.message}. Confirme se o agente local está ativo neste terminal.`)
      setResumoLocal(await resumoFilaOffline())
    } finally { setSalvando(false) }
  }

  const copiarToken = async () => {
    try {
      await navigator.clipboard.writeText(tokenExibido?.token || '')
      setMensagem('Token copiado. Guarde-o no arquivo config.json do agente local.')
    } catch { setErro('Não foi possível copiar o token. Copie-o manualmente antes de fechar.') }
  }

  return (
    <main className="pdvo-page">
      <section className="pdvo-heading">
        <div>
          <p className="pdvo-kicker">Operação resiliente</p>
          <h1>PDV offline e periféricos</h1>
          <p>Gerencie terminais, impressão local, conflitos de sincronização e a fila de vendas capturadas sem conexão.</p>
        </div>
        <div className="pdvo-actions">
          <button className="pdvo-button pdvo-button--secondary" onClick={carregar} disabled={carregando}>Atualizar</button>
          <button className="pdvo-button" onClick={abrirTerminal}>Novo terminal</button>
        </div>
      </section>

      {erro && <div className="pdvo-alert pdvo-alert--error" role="alert">{erro}</div>}
      {mensagem && <div className="pdvo-alert pdvo-alert--success">{mensagem}<button onClick={() => setMensagem('')} aria-label="Fechar mensagem">×</button></div>}

      <section className="pdvo-cards" aria-label="Resumo operacional">
        <article><span>Terminais ativos</span><strong>{terminais.filter((terminal) => terminal.ativo).length}</strong><small>{terminais.filter((terminal) => terminal.ultimo_heartbeat_em).length} com sinal registrado</small></article>
        <article><span>Periféricos ativos</span><strong>{dispositivos.filter((dispositivo) => dispositivo.ativo).length}</strong><small>{dispositivos.filter((dispositivo) => dispositivo.ultimo_status === 'online').length} online na loja ativa</small></article>
        <article><span>Fila no navegador</span><strong>{resumoLocal.total}</strong><small>{resumoLocal.falha || 0} com falha de entrega</small></article>
        <article className={conflitos.length ? 'pdvo-card--warning' : ''}><span>Conflitos pendentes</span><strong>{conflitos.length}</strong><small>{conflitos.length ? 'Exigem decisão gerencial' : 'Sem divergências abertas'}</small></article>
      </section>

      <section className="pdvo-grid">
        <article className="pdvo-panel pdvo-panel--wide">
          <header className="pdvo-panel-header"><div><h2>Terminais provisionados</h2><p>Cada terminal recebe uma credencial independente e pode operar em uma única loja.</p></div><button className="pdvo-link-button" onClick={abrirTerminal}>Adicionar</button></header>
          <div className="pdvo-table-wrap">
            <table><thead><tr><th>Terminal</th><th>Loja</th><th>Agente</th><th>Último sinal</th><th>Periféricos</th><th>Ações</th></tr></thead>
              <tbody>{carregando ? <tr><td colSpan="6" className="pdvo-empty">Carregando terminais…</td></tr> : terminais.length === 0 ? <tr><td colSpan="6" className="pdvo-empty">Nenhum terminal provisionado.</td></tr> : terminais.map((terminal) => <tr key={terminal.id}>
                <td><strong>{terminal.nome}</strong><small>{terminal.codigo}</small></td><td>{terminal.loja_nome || mapaLojas.get(terminal.loja_id)?.nome || '—'}</td><td><Status value={terminal.ultimo_heartbeat_em ? 'online' : 'desconhecido'} /><small>{terminal.versao_agente || 'Não informado'}</small></td><td>{fmtDate(terminal.ultimo_heartbeat_em)}</td><td>{terminal.total_dispositivos || 0}</td><td><button className="pdvo-text-action" onClick={() => rotacionarToken(terminal)} disabled={salvando}>Rotacionar token</button></td>
              </tr>)}</tbody>
            </table>
          </div>
        </article>

        <article className="pdvo-panel">
          <header className="pdvo-panel-header"><div><h2>Fila offline local</h2><p>Eventos ficam no navegador até serem entregues de forma durável ao agente local.</p></div></header>
          <dl className="pdvo-definition-list"><div><dt>Pendentes</dt><dd>{resumoLocal.pendente || 0}</dd></div><div><dt>Falhas</dt><dd>{resumoLocal.falha || 0}</dd></div><div><dt>Entregues</dt><dd>{resumoLocal.entregue_ao_agente || 0}</dd></div></dl>
          <div className="pdvo-stacked-actions"><button className="pdvo-button" onClick={enviarFila} disabled={salvando || !resumoLocal.total}>Transferir ao agente local</button><button className="pdvo-button pdvo-button--secondary" onClick={baixarFilaOffline} disabled={!resumoLocal.total}>Exportar cópia de segurança</button></div>
          <p className="pdvo-note">Cartão exige autorização TEF local e Pix exige conexão. O navegador não repete operações financeiras automaticamente.</p>
        </article>

        <article className="pdvo-panel pdvo-panel--wide">
          <header className="pdvo-panel-header"><div><h2>Periféricos da loja ativa</h2><p>Cadastre em modo de diagnóstico e ative após validar a instalação física.</p></div><button className="pdvo-link-button" onClick={abrirDispositivo}>Cadastrar periférico</button></header>
          <div className="pdvo-device-grid">{dispositivos.length === 0 ? <p className="pdvo-empty">Nenhum periférico cadastrado para esta loja.</p> : dispositivos.map((dispositivo) => <article className="pdvo-device" key={dispositivo.id}><div className="pdvo-device-top"><span>{TIPOS_DISPOSITIVO.find(([id]) => id === dispositivo.tipo)?.[1] || dispositivo.tipo}</span><Status value={dispositivo.ultimo_status} /></div><strong>{dispositivo.nome}</strong><p>{[dispositivo.fabricante, dispositivo.modelo].filter(Boolean).join(' · ') || 'Modelo não informado'}</p><small>Terminal: {dispositivo.terminal_codigo || 'Compartilhado pela loja'}</small></article>)}</div>
        </article>

        <article className="pdvo-panel pdvo-panel--wide">
          <header className="pdvo-panel-header"><div><h2>Conflitos de sincronização</h2><p>Vendas que criaram saldo negativo ou divergência permanecem rastreáveis até a decisão de um gestor.</p></div></header>
          <div className="pdvo-conflict-list">{conflitos.length === 0 ? <p className="pdvo-empty">Não há conflitos pendentes.</p> : conflitos.map((conflito) => <article className="pdvo-conflict" key={conflito.id}><div><Status value="conflito" /><strong>{conflito.tipo_conflito.replaceAll('_', ' ')}</strong><p>Terminal {conflito.terminal_codigo || '—'} · {fmtDate(conflito.data_criacao)}</p></div><div className="pdvo-conflict-actions"><button onClick={() => resolverConflito(conflito, 'aceito_cliente')} disabled={salvando}>Aceitar operação</button><button onClick={() => resolverConflito(conflito, 'aceito_servidor')} disabled={salvando}>Manter servidor</button><button onClick={() => resolverConflito(conflito, 'descartado')} disabled={salvando}>Descartar</button></div></article>)}</div>
        </article>
      </section>

      {modal === 'terminal' && <Modal titulo="Provisionar terminal" onClose={() => setModal(null)}><form className="pdvo-form" onSubmit={cadastrarTerminal}>
        <label>Loja<select required value={terminalForm.loja_id} onChange={(event) => setTerminalForm({ ...terminalForm, loja_id: event.target.value })}><option value="">Selecione uma loja</option>{(lojasAcessiveis || []).map((loja) => <option key={loja.id} value={loja.id}>{loja.nome}</option>)}</select></label>
        <div className="pdvo-form-row"><label>Código<input required maxLength="60" placeholder="CAIXA-01" value={terminalForm.codigo} onChange={(event) => setTerminalForm({ ...terminalForm, codigo: event.target.value.toUpperCase() })} /></label><label>Nome<input required maxLength="120" placeholder="Caixa principal" value={terminalForm.nome} onChange={(event) => setTerminalForm({ ...terminalForm, nome: event.target.value })} /></label></div>
        <label>Identificador do computador<input maxLength="160" placeholder="Opcional — serial ou hostname" value={terminalForm.identificador_dispositivo} onChange={(event) => setTerminalForm({ ...terminalForm, identificador_dispositivo: event.target.value })} /></label>
        <label className="pdvo-checkbox"><input type="checkbox" checked={terminalForm.modo_offline_habilitado} onChange={(event) => setTerminalForm({ ...terminalForm, modo_offline_habilitado: event.target.checked })} /> Permitir sincronização offline neste terminal</label>
        <footer><button type="button" className="pdvo-button pdvo-button--secondary" onClick={() => setModal(null)}>Cancelar</button><button className="pdvo-button" disabled={salvando}>{salvando ? 'Provisionando…' : 'Provisionar e gerar token'}</button></footer>
      </form></Modal>}

      {modal === 'dispositivo' && <Modal titulo="Cadastrar periférico" onClose={() => setModal(null)}><form className="pdvo-form" onSubmit={cadastrarDispositivo}>
        <div className="pdvo-form-row"><label>Loja<select required value={dispositivoForm.loja_id} onChange={(event) => setDispositivoForm({ ...dispositivoForm, loja_id: event.target.value, terminal_id: '' })}><option value="">Selecione</option>{(lojasAcessiveis || []).map((loja) => <option key={loja.id} value={loja.id}>{loja.nome}</option>)}</select></label><label>Tipo<select value={dispositivoForm.tipo} onChange={(event) => setDispositivoForm({ ...dispositivoForm, tipo: event.target.value })}>{TIPOS_DISPOSITIVO.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label></div>
        <label>Terminal<select value={dispositivoForm.terminal_id} onChange={(event) => setDispositivoForm({ ...dispositivoForm, terminal_id: event.target.value })}><option value="">Compartilhado pela loja</option>{terminais.filter((terminal) => terminal.loja_id === dispositivoForm.loja_id).map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.codigo} — {terminal.nome}</option>)}</select></label>
        <div className="pdvo-form-row"><label>Nome<input required value={dispositivoForm.nome} onChange={(event) => setDispositivoForm({ ...dispositivoForm, nome: event.target.value })} /></label><label>Fabricante<input value={dispositivoForm.fabricante} onChange={(event) => setDispositivoForm({ ...dispositivoForm, fabricante: event.target.value })} /></label></div>
        <div className="pdvo-form-row"><label>Modelo<input value={dispositivoForm.modelo} onChange={(event) => setDispositivoForm({ ...dispositivoForm, modelo: event.target.value })} /></label><label>Modo<select value={dispositivoForm.modo} onChange={(event) => setDispositivoForm({ ...dispositivoForm, modo: event.target.value })}><option value="diagnostico">Diagnóstico</option><option value="rede">Rede TCP/ESC-POS</option></select></label></div>
        {dispositivoForm.modo === 'rede' && <div className="pdvo-form-row"><label>Host/IP<input required value={dispositivoForm.host} onChange={(event) => setDispositivoForm({ ...dispositivoForm, host: event.target.value, endereco_conexao: event.target.value })} /></label><label>Porta<input required type="number" value={dispositivoForm.porta} onChange={(event) => setDispositivoForm({ ...dispositivoForm, porta: event.target.value })} /></label></div>}
        <footer><button type="button" className="pdvo-button pdvo-button--secondary" onClick={() => setModal(null)}>Cancelar</button><button className="pdvo-button" disabled={salvando}>{salvando ? 'Salvando…' : 'Cadastrar periférico'}</button></footer>
      </form></Modal>}

      {modal === 'token' && <Modal titulo="Guarde a credencial do terminal" onClose={() => { setTokenExibido(null); setModal(null) }}><div className="pdvo-token"><p>Este token será exibido somente agora. Cole-o no <code>config.json</code> do agente local do terminal <strong>{tokenExibido?.terminal?.codigo}</strong>.</p><pre>{tokenExibido?.token}</pre><button className="pdvo-button" onClick={copiarToken}>Copiar token</button><p className="pdvo-note">Ao fechar esta janela, o token não poderá ser recuperado; apenas rotacionado.</p></div></Modal>}
    </main>
  )
}
