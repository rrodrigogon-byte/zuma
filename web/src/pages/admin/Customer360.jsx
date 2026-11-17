import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmtDate, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import useDialogFocus from '../../components/store/useDialogFocus'
import './customer360.css'
import { API, Badge, daysLabel, EmptyLine, FIELD_LABELS, fmtDay, REASONS, REVEAL_PRESETS, SEGMENTS, SOURCE_LABELS, statusLabel, Table, TIMELINE_ICONS } from './customer360/shared'
import Portfolio from './customer360/Portfolio'
import { AccessHistory, AnonymizePanel, ConsentEditor, IdentityPanel, NotesAndTags } from './customer360/Panels'
import AiMemoryPanel from './customer360/AiMemoryPanel'
import { ConsumoCliente, VisaoCliente } from './customer360/HistoricoCliente'

// ─────────────────────────── revelar ───────────────────────────

function RevealDialog({ field, onClose, onConfirm }) {
  const [preset, setPreset] = useState(REVEAL_PRESETS[0])
  const [other, setOther] = useState('')
  const [saving, setSaving] = useState(false)
  const firstRef = useRef(null)
  const dialogRef = useDialogFocus(Boolean(field), onClose, firstRef)
  if (!field) return null
  const motivo = preset === 'outro' ? other.trim() : preset
  async function submit(event) {
    event.preventDefault()
    if (motivo.length < 5 || saving) return
    setSaving(true)
    try { await onConfirm(field, motivo) } finally { setSaving(false) }
  }
  return <div className="c360-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form ref={dialogRef} className="c360-dialog" role="dialog" aria-modal="true" aria-labelledby="c360-reveal-title" onSubmit={submit}>
      <h2 id="c360-reveal-title">Revelar {FIELD_LABELS[field]}</h2>
      <p>O acesso a dado pessoal fica registrado na auditoria com seu usuário, data, hora e motivo (LGPD).</p>
      <fieldset>
        <legend>Motivo do acesso</legend>
        {REVEAL_PRESETS.map((item, index) => <label key={item} className="c360-radio"><input ref={index === 0 ? firstRef : undefined} type="radio" name="motivo" checked={preset === item} onChange={() => setPreset(item)} /> {item}</label>)}
        <label className="c360-radio"><input type="radio" name="motivo" checked={preset === 'outro'} onChange={() => setPreset('outro')} /> Outro</label>
        {preset === 'outro' && <input className="c360-input" value={other} onChange={(event) => setOther(event.target.value)} placeholder="Descreva o motivo" aria-label="Descreva o motivo" minLength={5} maxLength={200} autoFocus />}
      </fieldset>
      <div className="c360-dialog-actions">
        <button type="button" className="c360-btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="c360-btn primary" disabled={motivo.length < 5 || saving}>{saving ? 'Registrando…' : 'Revelar'}</button>
      </div>
    </form>
  </div>
}

// ─────────────────────────── ficha ───────────────────────────

const TABS = [
  ['visao', 'Visão do cliente'],
  ['consumo', 'Consumo'],
  ['timeline', 'Linha do tempo'],
  ['barbearia', 'Barbearia'],
  ['loja', 'Loja online'],
  ['relacionamento', 'Relacionamento'],
  ['cadastros', 'Cadastros'],
  ['privacidade', 'Privacidade (LGPD)'],
]

function CustomerProfile({ reference }) {
  const { toast } = useToast()
  const [state, setState] = useState({ loading: true, data: null, error: '', status: 0 })
  const [tab, setTab] = useState('visao')
  const [revealed, setRevealed] = useState({})
  const [revealField, setRevealField] = useState('')
  const [exporting, setExporting] = useState(false)

  
  const [modalEditar, setModalEditar] = useState(null);
  const [formEditar, setFormEditar] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [unificando, setUnificando] = useState(false);

  function abrirModalEditar(cliente) {
    const cliBarbeariaId = cliente.clienteBarbeariaId || (cliente.canonicalRef || cliente.ref || '').replace(/^[a-z]+:/i, '') || cliente.id;
    setFormEditar({
      nome: cliente.perfil?.nome || cliente.nome || '',
      telefone: (cliente.perfil?.telefone || cliente.telefone || '').replace(/\D/g, '').slice(-11),
      email: cliente.perfil?.email || cliente.email || '',
      documento: cliente.perfil?.documento || cliente.documento || cliente.cpfCnpj || '',
      observacao: cliente.perfil?.observacao || cliente.observacao || '',
      limiteCreditoMensal: Number(cliente.indicadores?.limiteCredito || cliente.limiteCreditoMensal || 500),
      diasVencimento: Number(cliente.diasVencimento || 30),
      clienteBarbeariaId: cliBarbeariaId,
      original: cliente
    });
    setModalEditar(cliente);
  }

  async function salvarEdicao(event) {
    if (event) event.preventDefault();
    if (!formEditar.clienteBarbeariaId) {
      toast("Identificador de cliente inválido para edição.", "error");
      return;
    }
    setSalvando(true);
    try {
      await api.patch(`/api/admin/barbearia/clientes/${encodeURIComponent(formEditar.clienteBarbeariaId)}`, {
        nome: formEditar.nome,
        telefone: formEditar.telefone,
        email: formEditar.email,
        cpfCnpj: formEditar.documento,
        observacao: formEditar.observacao,
        limiteCreditoMensal: Number(formEditar.limiteCreditoMensal || 0),
        diasVencimento: Number(formEditar.diasVencimento || 30)
      });
      setModalEditar(null);
      toast("Cadastro atualizado com sucesso!", "success");
      load();
    } catch (e) {
      toast(e.response?.data?.error || e.message || "Falha ao salvar alterações.", "error");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirCadastro() {
    if (!formEditar.clienteBarbeariaId) return;
    const confirmou = window.confirm(
      `Deseja realmente inativar o cadastro de "${formEditar.nome}"?\n\nO histórico de comandas e atendimentos será preservado de acordo com as normas fiscais.`
    );
    if (!confirmou) return;
    setSalvando(true);
    try {
      await api.delete(`/api/admin/barbearia/clientes/${encodeURIComponent(formEditar.clienteBarbeariaId)}`);
      setModalEditar(null);
      toast("Cadastro inativado com sucesso.", "success");
      setTimeout(() => {
        window.location.href = '/admin/clientes-360';
      }, 800);
    } catch (e) {
      toast(e.response?.data?.error || e.message || "Falha ao inativar cliente.", "error");
    } finally {
      setSalvando(false);
    }
  }

  async function unificarCadastrosDuplicados() {
    if (!data) return;
    const principalId = data.clienteBarbeariaId || (data.canonicalRef || data.ref || '').replace(/^[a-z]+:/i, '');
    const registrosLocais = (data.registros || []).filter(r => r.fonte === 'barbearia');
    const secundarioIds = registrosLocais
      .map(r => r.ref.replace(/^dino:/, ''))
      .filter(id => id && id !== principalId);

    if (secundarioIds.length === 0) {
      toast("Não há outros cadastros duplicados detectados para este contato.", "info");
      return;
    }

    const confirmou = window.confirm(
      `Deseja unificar os ${secundarioIds.length + 1} cadastros encontrados para este cliente?\n\n` +
      `Principal: ${data.perfil?.nome || 'Cliente Atual'}\n` +
      `Secundários que serão consolidados: ${secundarioIds.join(', ')}\n\n` +
      `Todas as visitas, comandas e assinaturas serão consolidadas sob o mesmo cadastro sem perda de dados.`
    );
    if (!confirmou) return;

    setUnificando(true);
    try {
      const res = await api.post('/api/admin/barbearia/clientes/unificar', {
        principalId,
        secundarioIds
      });
      toast(`Cadastros unificados com sucesso! (${res.unificados || secundarioIds.length} mesclado(s))`, "success");
      load();
    } catch (e) {
      toast(e.response?.data?.error || e.message || "Falha ao unificar cadastros.", "error");
    } finally {
      setUnificando(false);
    }
  }

const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    setRevealed({})
    api.get(`${API}/${encodeURIComponent(reference)}`)
      .then((data) => setState({ loading: false, data, error: '', status: 200 }))
      .catch((error) => setState({ loading: false, data: null, error: error.message || 'Não foi possível carregar o cliente.', status: error.status || 0 }))
  }, [reference])
  useEffect(() => { load() }, [load])

  const data = state.data
  const kpis = data?.indicadores
  const segment = SEGMENTS[kpis?.segmento] || SEGMENTS.sem_historico
  const unavailableSources = useMemo(() => (data?.fontes || []).filter((item) => !item.disponivel), [data])
  const storeWhollyDown = unavailableSources.length >= 7 && new Set(unavailableSources.map((item) => item.motivo)).size === 1

  async function confirmReveal(field, motivo) {
    try {
      const result = await api.post(`${API}/${encodeURIComponent(reference)}/revelar`, { campo: field, motivo })
      setRevealed((current) => ({ ...current, [field]: result.valor || '(vazio)' }))
      setRevealField('')
      toast('Dado revelado. Acesso registrado na auditoria.', 'info')
    } catch (error) {
      toast(error.message || 'Não foi possível revelar o dado.', 'error')
    }
  }

  async function exportData() {
    if (exporting) return
    setExporting(true)
    try {
      const payload = await api.get(`${API}/${encodeURIComponent(reference)}/exportar`)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `titular-${reference.replace(/[^A-Za-z0-9_-]/g, '_')}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('Exportação gerada. Entregue ao titular por canal seguro.', 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível exportar os dados.', 'error')
    } finally { setExporting(false) }
  }

  if (state.loading && !data) return <section className="c360" aria-busy="true"><div className="c360-skeleton head" /><div className="c360-kpis">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="c360-skeleton kpi" />)}</div><div className="c360-skeleton block" /></section>
  if (state.error) return <section className="c360"><Link className="c360-back" to="/admin/clientes-360">‹ Carteira de clientes</Link><div className="c360-empty-state" role="alert"><strong>{state.status === 404 ? 'Cliente não encontrado' : 'Não foi possível carregar a ficha'}</strong><span>{state.error}</span>{state.status !== 404 && <button type="button" className="c360-btn primary" onClick={load}>Tentar novamente</button>}</div></section>

  const profile = data.perfil
  const canReveal = data.permissoes?.revelar
  const contact = (field, masked) => {
    if (!masked && !revealed[field]) return null
    const value = revealed[field] || masked
    const revealable = canReveal && profile.camposRevelaveis?.includes(field) && !revealed[field]
    return <div className="c360-contact" key={field}>
      <span>{FIELD_LABELS[field]}</span>
      <strong className={revealed[field] ? 'is-revealed' : ''}>{value}</strong>
      {revealable && <button type="button" className="c360-link" onClick={() => setRevealField(field)} aria-label={`Revelar ${FIELD_LABELS[field]}`}>Revelar</button>}
      {revealed[field] && <small>revelado · auditado</small>}
    </div>
  }


  return <section className="c360" aria-labelledby="c360-name">
    {modalEditar && (
      <div className="c360-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModalEditar(null)}>
        <form className="c360-dialog" role="dialog" aria-modal="true" style={{ maxWidth: 560 }} onSubmit={salvarEdicao}>
          <h2>Editar Cadastro do Cliente</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <label style={{ display: 'block', gridColumn: 'span 2' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>Nome completo *</span>
              <input required value={formEditar.nome || ''} onChange={(e) => setFormEditar(c => ({...c, nome: e.target.value}))} className="c360-input" />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>Celular / WhatsApp *</span>
              <input required type="tel" value={formEditar.telefone || ''} onChange={(e) => setFormEditar(c => ({...c, telefone: e.target.value}))} className="c360-input" placeholder="DDD + Número" />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>CPF / Documento</span>
              <input value={formEditar.documento || ''} onChange={(e) => setFormEditar(c => ({...c, documento: e.target.value}))} className="c360-input" placeholder="000.000.000-00" />
            </label>
            <label style={{ display: 'block', gridColumn: 'span 2' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>E-mail</span>
              <input type="email" value={formEditar.email || ''} onChange={(e) => setFormEditar(c => ({...c, email: e.target.value}))} className="c360-input" placeholder="cliente@exemplo.com" />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>Limite de Crédito Mensal (R$)</span>
              <input type="number" min="0" step="0.01" value={formEditar.limiteCreditoMensal || 0} onChange={(e) => setFormEditar(c => ({...c, limiteCreditoMensal: e.target.value}))} className="c360-input" />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>Prazo Padrão (Dias)</span>
              <input type="number" min="1" step="1" value={formEditar.diasVencimento || 30} onChange={(e) => setFormEditar(c => ({...c, diasVencimento: e.target.value}))} className="c360-input" />
            </label>
            <label style={{ display: 'block', gridColumn: 'span 2' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>Observações e Preferências</span>
              <textarea rows={2} value={formEditar.observacao || ''} onChange={(e) => setFormEditar(c => ({...c, observacao: e.target.value}))} className="c360-input" style={{ width: '100%', resize: 'vertical' }} placeholder="Preferências de corte, barba ou observações internas..." />
            </label>
          </div>
          <div className="c360-dialog-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="c360-btn ghost" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }} onClick={excluirCadastro} disabled={salvando} title="Inativar este cliente">
              Excluir Cliente
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="c360-btn ghost" onClick={() => setModalEditar(null)}>Cancelar</button>
              <button type="submit" className="c360-btn primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar Cadastro'}</button>
            </div>
          </div>
        </form>
      </div>
    )}

    <Link className="c360-back" to="/admin/clientes-360">‹ Carteira de clientes</Link>
    <header className="c360-hero">
      <span className="c360-avatar big" aria-hidden="true">{String(profile.nome || '?').trim().charAt(0).toUpperCase()}</span>
      <div className="c360-hero-main">
        <span className="c360-eyebrow">Customer 360</span>
        <h1 id="c360-name">{profile.nome}</h1>
        <div className="c360-tags">
          <Badge tone={segment.tone} title={segment.hint}>{segment.label}</Badge>
          {kpis.nivel && <Badge tone="accent">Fidelidade {kpis.nivel}</Badge>}
          {data.identidade.fontes.map((fonte) => <Badge key={fonte} tone={fonte === 'loja' ? 'info' : 'muted'}>{fonte === 'loja' ? 'Cliente da loja' : 'Cliente da barbearia'}</Badge>)}
          {profile.bloqueadoNaLoja && <Badge tone="danger">Bloqueado na loja</Badge>}
          {data.anonimizado && <Badge tone="danger">Titular anonimizado</Badge>}
        </div>
        {data.identidade.fontes.length > 1 && <p className="c360-link-note">Cadastros ligados por {data.identidade.vinculadoPor.join(' e ')}.{data.identidade.possivelDuplicidade ? ' Nomes ou cadastros diferentes: confira se é a mesma pessoa.' : ''}</p>}
        {data.identidade.fontes.length <= 1 && data.identidade.possivelDuplicidade && <p className="c360-link-note">Mais de um cadastro com o mesmo contato. Confira duplicidade.</p>}
      </div>
      <div className="c360-hero-actions">
        {data.identidade?.registros?.barbearia > 1 && (
          <button type="button" className="c360-btn primary" style={{ background: '#059669', borderColor: '#059669', color: '#fff' }} onClick={unificarCadastrosDuplicados} disabled={unificando} title="Mesclar cadastros duplicados com o mesmo telefone ou histórico">
            {unificando ? 'Unificando…' : '🔗 Unificar Cadastros'}
          </button>
        )}
        {!data.anonimizado && <Link className="c360-btn primary" to={`/admin/barbearia-erp?area=operacao&tab=Agenda${data.clienteBarbeariaId ? `&agendarCliente=${encodeURIComponent(data.clienteBarbeariaId)}` : ''}`}>Agendar</Link>}
        {!data.anonimizado && <button type="button" className="c360-btn ghost" onClick={() => abrirModalEditar(data)} title="Editar dados cadastrais, celular, e-mail, observações ou excluir">✏️ Editar Cadastro</button>}
        {data.permissoes?.exportar && <button type="button" className="c360-btn ghost" onClick={exportData} disabled={exporting} title="Exporta todos os dados deste titular (LGPD, art. 18)">{exporting ? 'Gerando…' : 'Exportar dados (LGPD)'}</button>}
      </div>
    </header>

    <div className="c360-contacts">
      {contact('telefone', profile.telefone)}
      {contact('email', profile.email)}
      {contact('documento', profile.documento)}
      {contact('endereco', profile.endereco)}
      {!profile.telefone && !profile.email && !profile.documento && <EmptyLine>Sem dados de contato cadastrados.</EmptyLine>}
      {profile.mascarado && !canReveal && (profile.camposRevelaveis || []).length > 0 && <small className="c360-muted">Dados mascarados. Somente administradores e organizadores podem revelar.</small>}
    </div>

    {unavailableSources.length > 0 && <p className="c360-note" role="status">{storeWhollyDown
      ? `Dados da loja online, WhatsApp e campanhas indisponíveis (${REASONS[unavailableSources[0].motivo] || unavailableSources[0].motivo}). A ficha mostra só a barbearia.`
      : `Algumas fontes não responderam e a ficha pode estar incompleta: ${unavailableSources.map((item) => `${SOURCE_LABELS[item.fonte] || item.fonte} (${REASONS[item.motivo] || item.motivo})`).join(', ')}.`}</p>}

    <div className="c360-kpis">
      <article><span>Valor vitalício</span><strong>{fmtR(kpis.valorVitalicio)}</strong><small>Barbearia {fmtR(kpis.receitaBarbearia)} · Loja {fmtR(kpis.receitaLoja)}</small></article>
      <article><span>Ticket médio</span><strong>{fmtR(kpis.ticketMedio)}</strong><small>{kpis.pedidosPagos} pedido(s) pago(s) na loja</small></article>
      <article><span>Visitas</span><strong>{kpis.visitas}</strong><small>{kpis.faltas ? `${kpis.faltas} falta(s)` : 'Nenhuma falta'}{kpis.retornoMedioDias ? ` · volta a cada ${kpis.retornoMedioDias} dias` : ''}</small></article>
      <article><span>Última atividade</span><strong>{daysLabel(kpis.diasSemAtividade)}</strong><small>{kpis.ultimaVisitaEm ? `Última visita ${fmtDay(kpis.ultimaVisitaEm)}` : 'Sem visita concluída'}</small></article>
      <article><span>Pontos</span><strong>{Number(kpis.pontos || 0).toLocaleString('pt-BR')}</strong><small>{kpis.nivel ? `Nível ${kpis.nivel}` : 'Fora do programa na barbearia'}</small></article>
      <article className={kpis.aReceber > 0 ? 'is-alert' : ''}><span>A receber</span><strong>{fmtR(kpis.aReceber)}</strong><small>Limite de crédito {fmtR(kpis.limiteCredito)}</small></article>
    </div>

    {(data.proximos.length > 0 || kpis.carrinhosAbertos > 0) && <div className="c360-highlights">
      {data.proximos.length > 0 && <div><strong>Próximo atendimento</strong><span>{fmtDate(data.proximos[0].dataHora)} · {data.proximos[0].servico || 'Serviço'}{data.proximos[0].profissional ? ` com ${data.proximos[0].profissional}` : ''}</span></div>}
      {kpis.carrinhosAbertos > 0 && <div><strong>Carrinho em aberto</strong><span>{kpis.carrinhosAbertos} carrinho(s) na loja online sem finalizar</span></div>}
    </div>}

    {!data.anonimizado && <NotesAndTags reference={reference} notas={data.notas} etiquetas={data.etiquetas} disponiveis={data.etiquetasDisponiveis} onChange={load} />}

    <div className="c360-tabs" role="tablist" aria-label="Seções da ficha do cliente">
      {TABS.map(([key, label]) => <button key={key} type="button" role="tab" id={`c360-tab-${key}`} aria-controls={`c360-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}
        onKeyDown={(event) => {
          if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return
          const index = TABS.findIndex(([item]) => item === tab)
          const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0]
          setTab(next)
          document.getElementById(`c360-tab-${next}`)?.focus()
        }}>{label}</button>)}
    </div>

    <div className="c360-panel" role="tabpanel" id={`c360-panel-${tab}`} aria-labelledby={`c360-tab-${tab}`} tabIndex={0}>
      {tab === 'visao' && <VisaoCliente historico={data.historico} agendarHref={!data.anonimizado ? `/admin/barbearia-erp?area=operacao&tab=Agenda${data.clienteBarbeariaId ? `&agendarCliente=${encodeURIComponent(data.clienteBarbeariaId)}` : ''}` : ''} />}

      {tab === 'consumo' && <ConsumoCliente historico={data.historico} />}

      {tab === 'timeline' && (data.linhaDoTempo.length ? <ol className="c360-timeline">
        {data.linhaDoTempo.map((item, index) => <li key={`${item.tipo}-${item.em}-${index}`}>
          <span className={`c360-dot type-${item.tipo}`} aria-hidden="true">{TIMELINE_ICONS[item.tipo] || '•'}</span>
          <div><strong>{item.titulo}</strong><small>{fmtDate(item.em)} · {item.detalhe ? statusLabel(item.detalhe.split(' · ')[0]) + (item.detalhe.includes(' · ') ? ` · ${item.detalhe.split(' · ').slice(1).join(' · ')}` : '') : ''}</small></div>
          {item.valor != null && item.valor > 0 && <b>{fmtR(item.valor)}</b>}
        </li>)}
      </ol> : <EmptyLine>Nenhuma interação registrada ainda.</EmptyLine>)}

      {tab === 'barbearia' && <div className="c360-stack">
        <h3>Atendimentos</h3>
        <Table caption="Atendimentos" rows={data.barbearia.agendamentos} empty="Nenhum atendimento." columns={[
          { key: 'dataHora', label: 'Data', render: (row) => fmtDate(row.dataHora) }, { key: 'servico', label: 'Serviço' }, { key: 'profissional', label: 'Profissional' },
          { key: 'status', label: 'Status', render: (row) => <span>{statusLabel(row.status)}{row.motivoCancelamento === 'falta_confirmacao' ? ' · cancelado por falta de confirmação' : ''}</span> }, { key: 'valor', label: 'Valor', align: 'right', render: (row) => row.valor ? fmtR(row.valor) : '—' },
        ]} />
        <h3>Histórico individual de serviços</h3>
        <Table caption="Última realização por serviço" rows={data.barbearia.historicoServicos || []} empty="Nenhum serviço concluído ligado ao cadastro individual deste cliente." columns={[
          { key: 'nome', label: 'Serviço' }, { key: 'ultimaRealizacaoEm', label: 'Última realização', render: (row) => fmtDay(row.ultimaRealizacaoEm) },
          { key: 'diasDesdeUltima', label: 'Há', render: (row) => row.diasDesdeUltima === 0 ? 'hoje' : `${row.diasDesdeUltima} dia(s)` },
          { key: 'atendimentos', label: 'Ocorrências' }, { key: 'origens', label: 'Fontes', render: (row) => (row.origens || []).join(' · ') || '—' }, { key: 'unidadeIndefinida', label: 'Unidade', render: (row) => row.unidadeIndefinida ? 'Não identificada' : 'Escopo atual' }, { key: 'intervaloRecomendacaoDias', label: 'Intervalo (dias)', render: (row) => row.intervaloRecomendacaoDias || 'Não configurado' },
        ]} />
        <h3>Produtos comprados na barbearia</h3>
        <Table caption="Última compra por produto" rows={data.barbearia.historicoProdutos || []} empty="Nenhuma compra local de revenda/comanda ligada ao cadastro individual." columns={[
          { key: 'nome', label: 'Produto' }, { key: 'ultimaCompraEm', label: 'Última compra', render: (row) => fmtDay(row.ultimaCompraEm) },
          { key: 'diasDesdeUltima', label: 'Há', render: (row) => row.diasDesdeUltima === 0 ? 'hoje' : `${row.diasDesdeUltima} dia(s)` },
          { key: 'compras', label: 'Compras' }, { key: 'quantidadeTotal', label: 'Unidades' }, { key: 'origens', label: 'Fontes', render: (row) => (row.origens || []).join(' · ') || '—' }, { key: 'unidadeIndefinida', label: 'Unidade', render: (row) => row.unidadeIndefinida ? 'Não identificada' : 'Escopo atual' }, { key: 'emEstoque', label: 'Estoque', render: (row) => row.emEstoque ? 'Disponível' : 'Indisponível' }, { key: 'intervaloRecompraDias', label: 'Recompra (dias)', render: (row) => row.intervaloRecompraDias || 'Não configurado' },
        ]} />
        <h3>Assistente de atendimento</h3>
        <p className="c360-muted">Sugestões determinísticas explicadas por histórico e periodicidade configurada. Confirme a necessidade com o cliente; não há venda ou mensagem automática.</p>
        {data.barbearia.assistenteAtendimento?.disponivel === false && <EmptyLine>{data.barbearia.assistenteAtendimento.motivo === 'unidade_nao_selecionada' ? 'Recomendações ocultadas: selecione a unidade do atendimento para restringir o histórico à loja correta.' : 'Recomendações ocultadas: o vínculo individual do cliente não foi confirmado.'}</EmptyLine>}
        {data.barbearia.assistenteAtendimento?.disponivel === true && <>
          <Table caption="Serviços no período para nova avaliação" rows={data.barbearia.assistenteAtendimento.servicosParaOferecer || []} empty="Nenhum serviço com intervalo atingido." columns={[
            { key: 'nome', label: 'Serviço' }, { key: 'ultimaRealizacaoEm', label: 'Última realização', render: (row) => fmtDay(row.ultimaRealizacaoEm) },
            { key: 'diasDesdeUltima', label: 'Dias desde a última' }, { key: 'intervaloDias', label: 'Intervalo' }, { key: 'motivo', label: 'Motivo', render: (row) => row.motivo === 'intervalo_recomendado_atingido' ? 'Periodicidade atingida' : row.motivo },
          ]} />
          <Table caption="Serviços recentes a não repetir automaticamente" rows={data.barbearia.assistenteAtendimento.servicosRecentes || []} empty="Nenhum procedimento recente encontrado." columns={[
            { key: 'nome', label: 'Serviço' }, { key: 'ultimaRealizacaoEm', label: 'Última realização', render: (row) => fmtDay(row.ultimaRealizacaoEm) },
            { key: 'diasDesdeUltima', label: 'Dias desde a última' }, { key: 'intervaloDias', label: 'Intervalo configurado', render: (row) => row.intervaloDias || 'Não configurado' }, { key: 'motivo', label: 'Observação', render: (row) => row.motivo === 'unidade_nao_identificada' ? 'Sem oferta automática: unidade de origem desconhecida' : row.motivo === 'ainda_dentro_do_intervalo' ? 'Ainda dentro da periodicidade' : 'Periodicidade não configurada' },
          ]} />
          <Table caption="Oportunidades de recompra de produtos" rows={data.barbearia.assistenteAtendimento.oportunidadesProdutos || []} empty="Nenhuma recompra vencida com produto em estoque." columns={[
            { key: 'nome', label: 'Produto' }, { key: 'ultimaCompraEm', label: 'Última compra', render: (row) => fmtDay(row.ultimaCompraEm) },
            { key: 'diasDesdeUltima', label: 'Dias desde a compra' }, { key: 'intervaloDias', label: 'Intervalo' }, { key: 'motivo', label: 'Motivo', render: (row) => row.motivo === 'recompra_periodica' ? 'Periodicidade atingida' : row.motivo },
          ]} />
        </>}
        <h3>Comandas e compras no balcão</h3>
        <Table caption="Comandas" rows={[...data.barbearia.comandas.map((row) => ({ ...row, tipo: 'Comanda' })), ...data.barbearia.revenda.map((row) => ({ ...row, tipo: 'Balcão' }))]} empty="Nenhuma comanda ou compra." columns={[
          { key: 'em', label: 'Data', render: (row) => fmtDate(row.em) }, { key: 'tipo', label: 'Tipo' }, { key: 'status', label: 'Status', render: (row) => statusLabel(row.status) },
          { key: 'total', label: 'Total', align: 'right', render: (row) => fmtR(row.total) },
        ]} />
        <h3>Pagar na conta</h3>
        {data.barbearia.credito && <p className="c360-muted">Limite {fmtR(data.barbearia.credito.limite)} · saldo devedor {fmtR(data.barbearia.credito.saldoDevedor)}{data.barbearia.credito.diasVencimento ? ` · vence em ${data.barbearia.credito.diasVencimento} dias` : ''}</p>}
        <Table caption="Contas a receber" rows={data.barbearia.contas} empty="Nenhuma conta em aberto." columns={[
          { key: 'descricao', label: 'Descrição' }, { key: 'vencimento', label: 'Vencimento', render: (row) => fmtDay(row.vencimento) },
          { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'atrasada' ? 'danger' : row.status === 'paga' ? 'success' : 'warning'}>{statusLabel(row.status)}{row.diasAtraso ? ` · ${row.diasAtraso}d` : ''}</Badge> },
          { key: 'valor', label: 'Valor', align: 'right', render: (row) => fmtR(row.valor) },
        ]} />
        <h3>Fidelidade e planos</h3>
        {data.barbearia.fidelidade ? <p className="c360-muted">{data.barbearia.fidelidade.pontos.toLocaleString('pt-BR')} pontos disponíveis · {data.barbearia.fidelidade.acumulados.toLocaleString('pt-BR')} acumulados · nível {data.barbearia.fidelidade.nivel}</p> : <EmptyLine>Cliente fora do programa de fidelidade da barbearia.</EmptyLine>}
        <Table caption="Planos" rows={data.barbearia.planos} empty="Sem plano ou assinatura." columns={[
          { key: 'plano', label: 'Plano' }, { key: 'status', label: 'Status', render: (row) => statusLabel(row.status) }, { key: 'desde', label: 'Desde', render: (row) => fmtDay(row.desde) },
        ]} />
      </div>}

      {tab === 'loja' && <div className="c360-stack">
        <h3>Pedidos</h3>
        <Table caption="Pedidos da loja" rows={data.loja.pedidos} empty="Nenhum pedido na loja online." columns={[
          { key: 'codigo', label: 'Pedido' }, { key: 'em', label: 'Data', render: (row) => fmtDate(row.em) }, { key: 'itens', label: 'Itens', align: 'right' },
          { key: 'status', label: 'Status', render: (row) => statusLabel(row.status) }, { key: 'total', label: 'Total', align: 'right', render: (row) => fmtR(row.total) },
        ]} />
        <h3>Carrinhos</h3>
        <Table caption="Carrinhos" rows={data.loja.carrinhos} empty="Nenhum carrinho registrado." columns={[
          { key: 'atualizadoEm', label: 'Última atividade', render: (row) => fmtDate(row.atualizadoEm) }, { key: 'status', label: 'Status', render: (row) => statusLabel(row.status) },
          { key: 'itens', label: 'Itens', align: 'right' }, { key: 'subtotal', label: 'Subtotal', align: 'right', render: (row) => fmtR(row.subtotal) },
        ]} />
        <h3>Crediário e pontos da loja</h3>
        <Table caption="Crediário da loja" rows={data.loja.crediario} empty="Sem crediário na loja." columns={[
          { key: 'limite', label: 'Limite', align: 'right', render: (row) => fmtR(row.limite) }, { key: 'saldoDevedor', label: 'Saldo devedor', align: 'right', render: (row) => fmtR(row.saldoDevedor) },
          { key: 'prazoDias', label: 'Prazo', render: (row) => `${row.prazoDias} dias` }, { key: 'status', label: 'Status', render: (row) => statusLabel(row.status) },
        ]} />
        {data.loja.pontos.length > 0 && <p className="c360-muted">Pontos na loja: {data.loja.pontos.reduce((sum, item) => sum + item.saldo, 0).toLocaleString('pt-BR')} disponíveis.</p>}
      </div>}

      {tab === 'relacionamento' && <div className="c360-stack">
        <h3>Consentimentos da barbearia</h3>
        {data.permissoes?.gerenciar && !data.anonimizado ? <ConsentEditor clienteId={data.clienteBarbeariaId} consentimentos={data.relacionamento.consentimentos} onChange={load} /> : <p className="c360-muted">Somente administradores e organizadores alteram consentimentos.</p>}
        <h3>Todos os consentimentos registrados</h3>
        <Table caption="Consentimentos" rows={data.relacionamento.consentimentos.map((row, index) => ({ ...row, id: index }))} empty="Nenhum consentimento registrado." columns={[
          { key: 'canal', label: 'Canal', render: (row) => row.canal === 'email' ? 'E-mail' : 'WhatsApp' }, { key: 'finalidade', label: 'Finalidade', render: (row) => statusLabel(row.finalidade) },
          { key: 'concedido', label: 'Situação', render: (row) => <Badge tone={row.concedido ? 'success' : 'muted'}>{row.concedido ? 'Autorizado' : 'Não autorizado'}</Badge> },
          { key: 'origem', label: 'Origem', render: (row) => `${row.origem === 'loja' ? 'Loja' : 'Barbearia'}${row.fonte ? ` · ${row.fonte}` : ''}` },
          { key: 'atualizadoEm', label: 'Atualizado', render: (row) => row.atualizadoEm ? fmtDate(row.atualizadoEm) : '—' },
        ]} />
        <h3>Conversas no WhatsApp</h3>
        <Table caption="Conversas WhatsApp" rows={data.relacionamento.whatsapp} empty="Nenhuma conversa com o atendente IA." columns={[
          { key: 'ultimaInteracaoEm', label: 'Última interação', render: (row) => fmtDate(row.ultimaInteracaoEm) }, { key: 'status', label: 'Status', render: (row) => statusLabel(row.status) },
          { key: 'mensagens', label: 'Mensagens', align: 'right' },
        ]} />
        <h3>Memória do atendente</h3>
        {!data.anonimizado ? <AiMemoryPanel reference={reference} canManage={Boolean(data.permissoes?.gerenciar)} /> : <p className="c360-muted">Cliente anonimizado.</p>}
        <h3>Campanhas recebidas</h3>
        <Table caption="Campanhas" rows={data.relacionamento.campanhas} empty="Nenhuma campanha enviada." columns={[
          { key: 'campanha', label: 'Campanha' }, { key: 'enviadoEm', label: 'Enviada', render: (row) => row.enviadoEm ? fmtDate(row.enviadoEm) : '—' },
          { key: 'status', label: 'Status', render: (row) => statusLabel(row.status) }, { key: 'receita', label: 'Receita atribuída', align: 'right', render: (row) => row.receita ? fmtR(row.receita) : '—' },
        ]} />
      </div>}

      {tab === 'cadastros' && <div className="c360-stack">
        <IdentityPanel reference={reference} registros={data.registros} vinculadoPor={data.identidade.vinculadoPor} canManage={data.permissoes?.gerenciar && !data.anonimizado} onChange={load} />
        <h3>De onde vêm os dados</h3>
        <ul className="c360-sources">{data.fontes.map((item) => <li key={item.fonte}><Badge tone={item.disponivel ? 'success' : 'warning'}>{item.disponivel ? 'OK' : 'Indisponível'}</Badge> {SOURCE_LABELS[item.fonte] || item.fonte}{item.motivo ? ` · ${REASONS[item.motivo] || item.motivo}` : ''}</li>)}</ul>
        <p className="c360-muted">Ficha gerada em {fmtDate(data.geradoEm)}.</p>
      </div>}

      {tab === 'privacidade' && <div className="c360-stack">
        <h3>Controles LGPD desta ficha</h3>
        <ul className="c360-privacy">
          <li>Toda abertura desta ficha é registrada na auditoria.</li>
          <li>Telefone, e-mail, documento e endereço aparecem mascarados. Revelar exige motivo e fica registrado.</li>
          <li>Exportação dos dados do titular (art. 18, II e V) e anonimização (art. 18, IV e VI) restritas a administradores.</li>
        </ul>
        {data.permissoes?.verAcessos ? <><h3>Quem acessou esta ficha</h3><AccessHistory reference={reference} /></> : <p className="c360-muted">O histórico de acessos é visível para administradores.</p>}
        {data.permissoes?.anonimizar && !data.anonimizado && <AnonymizePanel reference={reference} nome={profile.nome} onDone={load} />}
        {data.anonimizado && <p className="c360-note" role="status">Este titular foi anonimizado. Restam apenas registros financeiros e fiscais sem dados pessoais.</p>}
      </div>}
    </div>

    <RevealDialog field={revealField} onClose={() => setRevealField('')} onConfirm={confirmReveal} />
  </section>
}

export default function Customer360() {
  const { ref } = useParams()
  return ref ? <CustomerProfile key={ref} reference={decodeURIComponent(ref)} /> : <Portfolio />
}
