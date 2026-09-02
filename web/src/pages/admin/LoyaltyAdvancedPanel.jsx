import { useEffect, useMemo, useState } from 'react'
import { api, fmtDate, fmtNum } from '../../lib/api'

const LOYALTY_API = '/api/admin/fidelidade/avancada'

const EMPTY_REWARD = {
  codigo: '', nome: '', descricao: '', custo_pontos: '', estoque_total: '',
  limite_por_cliente: '', inicio_em: '', fim_em: '', status: 'rascunho',
}

const EMPTY_SETTINGS = { ativo: false, pontos_por_real: 1, valor_minimo_compra: 0, validade_dias: '' }

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function idempotencyKey() {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `loyalty-reward:${suffix}`
}

function benefitsText(value) {
  return Array.isArray(value) ? value.join('\n') : String(value || '')
}

function RewardStatusEditor({ reward, busy, onSaved, notify }) {
  const [status, setStatus] = useState(reward.status)

  useEffect(() => setStatus(reward.status), [reward.status])

  const save = async () => {
    try {
      await api.put(`${LOYALTY_API}/recompensas/${reward.id}`, {
        ...reward,
        status,
        estoque_total: reward.estoque_total ?? null,
        limite_por_cliente: reward.limite_por_cliente ?? null,
      })
      notify('sucesso', 'Status da recompensa atualizado.')
      await onSaved()
    } catch (error) {
      notify('erro', error.message || 'Não foi possível atualizar a recompensa.')
    }
  }

  const available = reward.estoque_disponivel === null || reward.estoque_disponivel === undefined
    ? 'Ilimitado'
    : fmtNum(reward.estoque_disponivel)

  return (
    <article className="omni-reward-card">
      <div>
        <span className={`omni-status omni-status--${reward.status}`}>{reward.status}</span>
        <h4>{reward.nome}</h4>
        <p>{reward.descricao || 'Sem descrição operacional.'}</p>
      </div>
      <dl>
        <div><dt>Custo</dt><dd>{fmtNum(reward.custo_pontos)} pts</dd></div>
        <div><dt>Disponível</dt><dd>{available}</dd></div>
        <div><dt>Limite/cliente</dt><dd>{reward.limite_por_cliente ? fmtNum(reward.limite_por_cliente) : 'Sem limite'}</dd></div>
      </dl>
      <div className="omni-reward-actions">
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={`Status de ${reward.nome}`}>
          <option value="rascunho">Rascunho</option>
          <option value="ativa">Ativa</option>
          <option value="pausada">Pausada</option>
          <option value="encerrada">Encerrada</option>
        </select>
        <button type="button" onClick={save} disabled={busy || status === reward.status}>Salvar status</button>
      </div>
    </article>
  )
}

export default function LoyaltyAdvancedPanel({ data, customer, customerDetail, busy, setBusy, notify, onRefresh, onCustomerRefresh }) {
  const [levels, setLevels] = useState([])
  const [settings, setSettings] = useState(EMPTY_SETTINGS)
  const [reward, setReward] = useState(EMPTY_REWARD)
  const [redemption, setRedemption] = useState({ rewardId: '', quantity: 1, confirmed: false, note: '', idempotencyKey: idempotencyKey() })

  useEffect(() => {
    setLevels((data?.levels || []).map(item => ({ ...item, beneficios_texto: benefitsText(item.beneficios) })))
  }, [data?.levels])

  useEffect(() => {
    setSettings({
      ativo: data?.settings?.ativo === true,
      pontos_por_real: data?.settings?.pontos_por_real ?? 1,
      valor_minimo_compra: data?.settings?.valor_minimo_compra ?? 0,
      validade_dias: data?.settings?.validade_dias ?? '',
    })
  }, [data?.settings])

  const activeRewards = useMemo(
    () => (data?.rewards || []).filter(item => item.status === 'ativa' && (item.estoque_disponivel === null || Number(item.estoque_disponivel) > 0)),
    [data?.rewards],
  )

  useEffect(() => {
    if (redemption.rewardId && !activeRewards.some(item => item.id === redemption.rewardId)) {
      setRedemption(current => ({ ...current, rewardId: '', confirmed: false }))
    }
  }, [activeRewards, redemption.rewardId])

  const saveSettings = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.put(`${LOYALTY_API}/configuracao`, {
        ativo: settings.ativo,
        pontos_por_real: Number(settings.pontos_por_real),
        valor_minimo_compra: Number(settings.valor_minimo_compra),
        validade_dias: numberOrNull(settings.validade_dias),
      })
      notify('sucesso', settings.ativo ? 'Programa de fidelidade ativado para a loja.' : 'Programa de fidelidade mantido inativo.')
      await onRefresh()
    } catch (error) {
      notify('erro', error.message || 'Não foi possível salvar a configuração de fidelidade.')
    } finally {
      setBusy(false)
    }
  }

  const saveLevels = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.put(`${LOYALTY_API}/niveis`, {
        niveis: levels.map(item => ({
          codigo: item.codigo,
          nome: item.nome,
          pontos_minimos: Number(item.pontos_minimos),
          beneficios: item.beneficios_texto.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
          ativo: item.ativo !== false,
        })),
      })
      notify('sucesso', 'Níveis salvos para a loja ativa.')
      await onRefresh()
    } catch (error) {
      notify('erro', error.message || 'Não foi possível salvar os níveis.')
    } finally {
      setBusy(false)
    }
  }

  const addLevel = () => {
    if (levels.length >= 10) return notify('erro', 'O limite é de 10 níveis por loja.')
    const last = levels.at(-1)
    const order = levels.length + 1
    setLevels(current => [...current, {
      codigo: `nivel-${order}`,
      nome: `Nível ${order}`,
      pontos_minimos: Number(last?.pontos_minimos || 0) + 1000,
      beneficios_texto: '',
      ativo: true,
      persistido: false,
    }])
  }

  const removeLevel = (index) => {
    if (levels.length === 1) return notify('erro', 'O programa precisa manter pelo menos um nível.')
    setLevels(current => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const createReward = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post(`${LOYALTY_API}/recompensas`, {
        ...reward,
        custo_pontos: Number(reward.custo_pontos),
        estoque_total: numberOrNull(reward.estoque_total),
        limite_por_cliente: numberOrNull(reward.limite_por_cliente),
        inicio_em: reward.inicio_em ? new Date(reward.inicio_em).toISOString() : null,
        fim_em: reward.fim_em ? new Date(reward.fim_em).toISOString() : null,
      })
      setReward(EMPTY_REWARD)
      notify('sucesso', 'Recompensa cadastrada para a loja ativa.')
      await onRefresh()
    } catch (error) {
      notify('erro', error.message || 'Não foi possível cadastrar a recompensa.')
    } finally {
      setBusy(false)
    }
  }

  const redeem = async (event) => {
    event.preventDefault()
    if (!customer) return notify('erro', 'Selecione um cliente antes de resgatar.')
    if (!redemption.confirmed) return notify('erro', 'Confirme o débito de pontos antes do resgate.')
    setBusy(true)
    try {
      await api.post(`${LOYALTY_API}/recompensas/${redemption.rewardId}/resgatar`, {
        cliente_id: customer.id,
        quantidade: Number(redemption.quantity),
        confirmar: true,
        observacao: redemption.note.trim() || null,
        idempotency_key: redemption.idempotencyKey,
      })
      setRedemption({ rewardId: '', quantity: 1, confirmed: false, note: '', idempotencyKey: idempotencyKey() })
      notify('sucesso', 'Recompensa resgatada com débito registrado no extrato.')
      await Promise.all([onRefresh(), onCustomerRefresh?.()])
    } catch (error) {
      notify('erro', error.message || 'Não foi possível resgatar a recompensa.')
    } finally {
      setBusy(false)
    }
  }

  const deliver = async (item) => {
    if (!globalThis.confirm(`Confirmar a entrega de “${item.recompensa_nome}” para ${item.cliente_nome}?`)) return
    setBusy(true)
    try {
      await api.patch(`${LOYALTY_API}/resgates/${item.id}/entregar`, { confirmar: true })
      notify('sucesso', 'Entrega da recompensa confirmada.')
      await onRefresh()
    } catch (error) {
      notify('erro', error.message || 'Não foi possível confirmar a entrega.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (item) => {
    const reason = globalThis.prompt(`Informe o motivo do cancelamento de “${item.recompensa_nome}”. Os pontos e o estoque serão estornados.`)
    if (!reason?.trim()) return
    if (!globalThis.confirm('Confirmar o cancelamento e o estorno dos pontos?')) return
    setBusy(true)
    try {
      await api.post(`${LOYALTY_API}/resgates/${item.id}/cancelar`, { confirmar: true, motivo: reason.trim() })
      notify('sucesso', 'Resgate cancelado com pontos e estoque estornados.')
      await Promise.all([onRefresh(), onCustomerRefresh?.()])
    } catch (error) {
      notify('erro', error.message || 'Não foi possível cancelar o resgate.')
    } finally {
      setBusy(false)
    }
  }

  const metrics = data?.metrics || {}

  return (
    <section className="omni-loyalty-advanced" aria-label="Fidelidade avançada">
      <header className="omni-panel-heading omni-panel-heading--stack">
        <div><h2>Fidelidade avançada</h2><p>Níveis, recompensas e ranking usam o mesmo saldo e extrato canônicos.</p></div>
        <div className="omni-loyalty-metrics">
          <span><strong>{fmtNum(metrics.customersRanked || 0)}</strong> clientes no ranking</span>
          <span><strong>{fmtNum(metrics.activeRewards || 0)}</strong> recompensas ativas</span>
          <span><strong>{fmtNum(metrics.confirmedRedemptions || 0)}</strong> resgates pendentes</span>
          <span><strong>{fmtNum(metrics.pointsRedeemed || 0)}</strong> pontos resgatados</span>
        </div>
      </header>

      <article className="omni-panel omni-loyalty-settings">
        <div className="omni-panel-heading"><div><h3>Acúmulo de pontos</h3><p>O crédito ocorre uma única vez quando o pedido Commerce é confirmado como pago.</p></div><span className={`omni-status omni-status--${settings.ativo ? 'ativa' : 'pausada'}`}>{settings.ativo ? 'Ativo' : 'Inativo'}</span></div>
        <form className="omni-form" onSubmit={saveSettings}>
          <div className="omni-form-grid">
            <label>Pontos por R$ 1,00<input required type="number" min="0" max="1000" step="0.0001" value={settings.pontos_por_real} onChange={event => setSettings(current => ({ ...current, pontos_por_real: event.target.value }))} /></label>
            <label>Compra mínima (R$)<input required type="number" min="0" step="0.01" value={settings.valor_minimo_compra} onChange={event => setSettings(current => ({ ...current, valor_minimo_compra: event.target.value }))} /></label>
            <label>Validade em dias<input type="number" min="1" max="3650" step="1" value={settings.validade_dias} placeholder="Sem expiração" onChange={event => setSettings(current => ({ ...current, validade_dias: event.target.value }))} /></label>
          </div>
          <label className="omni-switch"><input type="checkbox" checked={settings.ativo} onChange={event => setSettings(current => ({ ...current, ativo: event.target.checked }))} /><span>Ativar o crédito automático de pontos para pedidos pagos desta loja.</span></label>
          <button className="omni-button" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar regra de acúmulo'}</button>
        </form>
      </article>

      <div className="omni-loyalty-advanced-grid">
        <article className="omni-panel">
          <div className="omni-panel-heading"><div><h3>Níveis da loja</h3><p>{data?.levelsPersisted ? 'Configuração persistida.' : 'Sugestão padrão ainda não salva.'}</p></div><button type="button" className="omni-link-button" onClick={addLevel}>Adicionar nível</button></div>
          <form className="omni-level-form" onSubmit={saveLevels}>
            {levels.map((level, index) => (
              <fieldset key={`${level.codigo}-${index}`}>
                <legend>Nível {index + 1}</legend>
                <div className="omni-form-grid"><label>Nome<input required maxLength="80" value={level.nome} onChange={event => setLevels(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, nome: event.target.value } : item))} /></label><label>Pontos mínimos<input required type="number" min="0" step="1" value={level.pontos_minimos} onChange={event => setLevels(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, pontos_minimos: event.target.value } : item))} /></label></div>
                <label>Benefícios informativos<textarea rows="2" value={level.beneficios_texto} placeholder="Um benefício por linha; não aplica desconto automático." onChange={event => setLevels(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, beneficios_texto: event.target.value } : item))} /></label>
                <button type="button" className="omni-danger-link" onClick={() => removeLevel(index)}>Remover nível</button>
              </fieldset>
            ))}
            <button className="omni-button" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar níveis'}</button>
          </form>
        </article>

        <article className="omni-panel">
          <div className="omni-panel-heading"><div><h3>Nova recompensa</h3><p>Cadastre em rascunho e ative somente quando a operação estiver pronta.</p></div></div>
          <form className="omni-form" onSubmit={createReward}>
            <div className="omni-form-grid"><label>Nome<input required maxLength="140" value={reward.nome} onChange={event => setReward(current => ({ ...current, nome: event.target.value }))} /></label><label>Código opcional<input maxLength="60" value={reward.codigo} placeholder="gerado pelo nome" onChange={event => setReward(current => ({ ...current, codigo: event.target.value }))} /></label></div>
            <label>Descrição<textarea maxLength="500" rows="3" value={reward.descricao} onChange={event => setReward(current => ({ ...current, descricao: event.target.value }))} /></label>
            <div className="omni-form-grid"><label>Custo em pontos<input required type="number" min="1" step="1" value={reward.custo_pontos} onChange={event => setReward(current => ({ ...current, custo_pontos: event.target.value }))} /></label><label>Estoque opcional<input type="number" min="0" step="1" value={reward.estoque_total} placeholder="Ilimitado" onChange={event => setReward(current => ({ ...current, estoque_total: event.target.value }))} /></label></div>
            <div className="omni-form-grid"><label>Limite por cliente<input type="number" min="1" step="1" value={reward.limite_por_cliente} placeholder="Sem limite" onChange={event => setReward(current => ({ ...current, limite_por_cliente: event.target.value }))} /></label><label>Status<select value={reward.status} onChange={event => setReward(current => ({ ...current, status: event.target.value }))}><option value="rascunho">Rascunho</option><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="encerrada">Encerrada</option></select></label></div>
            <div className="omni-form-grid"><label>Início opcional<input type="datetime-local" value={reward.inicio_em} onChange={event => setReward(current => ({ ...current, inicio_em: event.target.value }))} /></label><label>Fim opcional<input type="datetime-local" value={reward.fim_em} onChange={event => setReward(current => ({ ...current, fim_em: event.target.value }))} /></label></div>
            <button className="omni-button" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Cadastrar recompensa'}</button>
          </form>
        </article>
      </div>

      <article className="omni-panel">
        <div className="omni-panel-heading"><div><h3>Catálogo de recompensas</h3><p>Estoque e limite por cliente são conferidos dentro da transação de resgate.</p></div></div>
        <div className="omni-reward-grid">{(data?.rewards || []).map(item => <RewardStatusEditor key={item.id} reward={item} busy={busy} onSaved={onRefresh} notify={notify} />)}{!data?.rewards?.length && <p className="omni-empty omni-empty--card">Nenhuma recompensa cadastrada nesta loja.</p>}</div>
      </article>

      <div className="omni-loyalty-advanced-grid">
        <article className="omni-panel">
          <div className="omni-panel-heading"><div><h3>Resgatar recompensa</h3><p>Requer cliente selecionado, confirmação humana e chave idempotente.</p></div></div>
          {!customer ? <p className="omni-empty omni-empty--card">Selecione um cliente na consulta acima para iniciar um resgate.</p> : (
            <form className="omni-form" onSubmit={redeem}>
              <p><strong>{customer.nome}</strong> · {fmtNum(customerDetail?.saldo_pontos ?? customer.pontos ?? 0)} pontos disponíveis</p>
              <label>Recompensa<select required value={redemption.rewardId} onChange={event => setRedemption(current => ({ ...current, rewardId: event.target.value, confirmed: false, idempotencyKey: idempotencyKey() }))}><option value="">Selecione</option>{activeRewards.map(item => <option key={item.id} value={item.id}>{item.nome} — {fmtNum(item.custo_pontos)} pts</option>)}</select></label>
              <label>Quantidade<input required type="number" min="1" max="20" step="1" value={redemption.quantity} onChange={event => setRedemption(current => ({ ...current, quantity: event.target.value, confirmed: false, idempotencyKey: idempotencyKey() }))} /></label>
              <label>Observação opcional<textarea rows="2" maxLength="500" value={redemption.note} onChange={event => setRedemption(current => ({ ...current, note: event.target.value }))} /></label>
              <label className="omni-switch"><input type="checkbox" checked={redemption.confirmed} onChange={event => setRedemption(current => ({ ...current, confirmed: event.target.checked }))} /><span>Confirmo o débito dos pontos e a reserva da recompensa.</span></label>
              <button className="omni-button" type="submit" disabled={busy || !redemption.rewardId || !redemption.confirmed}>Confirmar resgate</button>
            </form>
          )}
        </article>

        <article className="omni-panel">
          <div className="omni-panel-heading"><div><h3>Ranking da loja</h3><p>Somente nome, nível e pontos; nenhum contato é exposto.</p></div></div>
          <div className="omni-table-wrap"><table className="omni-table"><thead><tr><th>Posição</th><th>Cliente</th><th>Nível</th><th>Acumulado</th><th>Saldo total</th><th>A expirar</th></tr></thead><tbody>{(data?.ranking || []).map(item => <tr key={item.cliente_id}><td>#{item.posicao}</td><td>{item.nome}</td><td>{item.nivel_nome || 'Bronze'}</td><td>{fmtNum(item.pontos_acumulados)}</td><td>{fmtNum(item.saldo_total)}</td><td>{fmtNum(item.pontos_a_expirar_30d)}</td></tr>)}{!data?.ranking?.length && <tr><td colSpan="6" className="omni-empty">Ainda não há créditos de pontos nesta loja.</td></tr>}</tbody></table></div>
        </article>
      </div>

      <article className="omni-panel">
        <div className="omni-panel-heading"><div><h3>Resgates recentes</h3><p>Entrega e cancelamento exigem confirmação; cancelamento estorna pontos e estoque.</p></div></div>
        <div className="omni-table-wrap"><table className="omni-table"><thead><tr><th>Cliente</th><th>Recompensa</th><th>Pontos</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>{(data?.redemptions || []).map(item => <tr key={item.id}><td>{item.cliente_nome}</td><td>{item.recompensa_nome} × {item.quantidade}</td><td>{fmtNum(item.pontos_resgatados)}</td><td><span className={`omni-status omni-status--${item.status}`}>{item.status}</span></td><td>{fmtDate(item.criado_em)}</td><td><div className="omni-table-actions">{item.status === 'confirmado' && <><button type="button" onClick={() => deliver(item)} disabled={busy}>Entregar</button><button type="button" className="is-danger" onClick={() => cancel(item)} disabled={busy}>Cancelar</button></>}</div></td></tr>)}{!data?.redemptions?.length && <tr><td colSpan="6" className="omni-empty">Nenhum resgate registrado nesta loja.</td></tr>}</tbody></table></div>
      </article>
    </section>
  )
}
