import React, { useState } from 'react'
import {
  Crown,
  Scissors,
  Users,
  Copy,
  Check,
  Share2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Link as LinkIcon,
  X,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import './BarbeariaPlanosAssinaturasPanel.css'

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ehProfissionalDino(nomeOuApelido = '') {
  const n = String(nomeOuApelido).toLowerCase()
  return n.includes('dino') || n.includes('guilherme')
}

export default function BarbeariaPlanosAssinaturasPanel({
  planos = [],
  assinaturas = [],
  profissionais = [],
  clientes = [],
  servicos = [],
  salvando = false,
  onSalvarPlano,
  onSalvarAssinatura,
  onAlterarStatusAssinatura,
  onAtivarAssinatura,
  onExcluirPlano,
  onReativarPlano,
}) {
  const [copiadoId, setCopiadoId] = useState(null)
  const [modalLink, setModalLink] = useState(null)
  const [modalPlanoAberto, setModalPlanoAberto] = useState(false)
  const [planoEmEdicao, setPlanoEmEdicao] = useState(null)

  // Formulário de Criação/Edição de Plano
  const [formPlano, setFormPlano] = useState({
    nome: '',
    descricao: '',
    ciclo: 'mensal',
    regraRenovacao: 'aniversario',
    preco: '',
    sessoesIncluidas: 4,
    validadeDias: 30,
    servicosIds: [],
    ehVip: false,
    tipoProfissional: 'todos',
    profissionalId: '',
    profissionaisIds: [],
    precosPorProfissional: {},
  })

  // Formulário de Nova Assinatura
  const [formAssinatura, setFormAssinatura] = useState({
    clienteId: '',
    clienteNome: '',
    planoId: '',
    profissionalId: '',
    profissionalNome: '',
    regraRenovacao: 'aniversario',
    inicio: new Date().toISOString().slice(0, 10),
    observacoes: '',
  })

  function copiarTexto(texto, id) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(texto).catch(() => {})
    }
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 2500)
  }

  function abrirModalCriarPlano(planoExistente = null) {
    if (planoExistente) {
      setPlanoEmEdicao(planoExistente)
      setFormPlano({
        nome: planoExistente.nome || '',
        descricao: planoExistente.descricao || '',
        ciclo: planoExistente.ciclo || 'mensal',
        regraRenovacao: planoExistente.regraRenovacao || 'aniversario',
        preco: planoExistente.preco ?? '',
        sessoesIncluidas: planoExistente.sessoesIncluidas || 4,
        validadeDias: planoExistente.validadeDias || 30,
        servicosIds: Array.isArray(planoExistente.servicosIds) ? [...planoExistente.servicosIds] : [],
        ehVip: Boolean(planoExistente.ehVip),
        tipoProfissional: planoExistente.tipoProfissional || (planoExistente.profissionalId ? 'especifico' : 'todos'),
        profissionalId: planoExistente.profissionalId || '',
        profissionaisIds: Array.isArray(planoExistente.profissionaisIds) ? [...planoExistente.profissionaisIds] : [],
        precosPorProfissional: { ...(planoExistente.precosPorProfissional || {}) },
      })
    } else {
      setPlanoEmEdicao(null)
      setFormPlano({
        nome: '',
        descricao: '',
        ciclo: 'mensal',
        regraRenovacao: 'aniversario',
        preco: '',
        sessoesIncluidas: 4,
        validadeDias: 30,
        servicosIds: servicos.slice(0, 2).map((s) => s.id),
        ehVip: false,
        tipoProfissional: 'todos',
        profissionalId: '',
        profissionaisIds: [],
        precosPorProfissional: {},
      })
    }
    setModalPlanoAberto(true)
  }

  async function handleSubmeterPlano(e) {
    e.preventDefault()
    if (!onSalvarPlano) return
    const profSel = profissionais.find((p) => p.id === formPlano.profissionalId)
    await onSalvarPlano({
      ...formPlano,
      id: planoEmEdicao?.id,
      profissionalNome: profSel?.nome || '',
      preco: Number(formPlano.preco),
      sessoesIncluidas: Number(formPlano.sessoesIncluidas),
      validadeDias: Number(formPlano.validadeDias),
      ehVip: Boolean(formPlano.ehVip),
    })
    setModalPlanoAberto(false)
  }

  async function handleSubmeterAssinatura(e) {
    e.preventDefault()
    if (!onSalvarAssinatura) return
    const cli = clientes.find((c) => c.id === formAssinatura.clienteId)
    const prof = profissionais.find((p) => p.id === formAssinatura.profissionalId)
    const plano = planos.find((p) => p.id === formAssinatura.planoId)
    const precoFinal =
      formAssinatura.profissionalId && plano?.precosPorProfissional?.[formAssinatura.profissionalId]
        ? Number(plano.precosPorProfissional[formAssinatura.profissionalId])
        : Number(plano?.preco || 0)

    await onSalvarAssinatura({
      ...formAssinatura,
      clienteNome: cli?.nome || '',
      profissionalNome: prof?.nome || '',
      precoContratado: precoFinal,
      ehVip: Boolean(plano?.ehVip),
    })

    setFormAssinatura({
      clienteId: '',
      clienteNome: '',
      planoId: '',
      profissionalId: '',
      profissionalNome: '',
      regraRenovacao: 'aniversario',
      inicio: new Date().toISOString().slice(0, 10),
      observacoes: '',
    })
  }

  const planoAssinaturaSelecionado = planos.find((p) => p.id === formAssinatura.planoId)
  const precoDiferenciadoProfSelecionado =
    formAssinatura.profissionalId &&
    planoAssinaturaSelecionado?.precosPorProfissional?.[formAssinatura.profissionalId]
      ? Number(planoAssinaturaSelecionado.precosPorProfissional[formAssinatura.profissionalId])
      : null

  return (
    <div className="planos-container">
      {/* SEÇÃO 1: CABEÇALHO E CATÁLOGO DE PLANOS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crown size={22} color="#D4AF37" /> Planos VIP & Recorrência por Profissional
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Defina planos exclusivos do Mestre Dino, da equipe ou com preços diferenciados por profissional.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrirModalCriarPlano()}
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
            color: '#121212',
            border: 0,
            borderRadius: 10,
            padding: '10px 18px',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(212, 175, 55, 0.3)',
          }}
        >
          <Sparkles size={16} /> + Novo Plano VIP ou Recorrência
        </button>
      </div>

      {/* GRID DE CARDS DOS PLANOS */}
      <div className="planos-grid">
        {planos
          .filter((p) => !p.removidoEm)
          .map((plano) => {
            const ehVip = Boolean(plano.ehVip)
            const profExclusivo = profissionais.find((p) => p.id === plano.profissionalId)
            const ehDino = ehProfissionalDino(plano.profissionalNome || profExclusivo?.nome || plano.nome)
            const linkAdesao = `https://kytto.com.br/clube?plano=${encodeURIComponent(plano.id)}${
              plano.profissionalId ? `&prof=${encodeURIComponent(plano.profissionalId)}` : ''
            }`
            const linkAdmin = `https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas&planoId=${encodeURIComponent(
              plano.id
            )}`
            const textoWhats = `Olá! Conheça nosso ${ehVip ? '👑 Plano VIP' : 'Plano de Recorrência'} na Barbearia Dino:\n\n*${
              plano.nome
            }*\n${plano.sessoesIncluidas} procedimentos por ciclo ${plano.ciclo}\n${
              plano.profissionalNome ? `Profissional: ${plano.profissionalNome}\n` : ''
            }Valor: ${moeda(plano.preco)}\n\nAssine agora e garanta seus benefícios exclusivos: ${linkAdesao}`
            const linkWhatsUrl = `https://wa.me/?text=${encodeURIComponent(textoWhats)}`

            const precosProfEntries = Object.entries(plano.precosPorProfissional || {})

            return (
              <div key={plano.id} className={`plano-card ${ehVip ? 'vip' : ''}`}>
                <div>
                  <div className="plano-header">
                    <div className="plano-titulo-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {ehVip && (
                          <span className="vip-badge">
                            <Crown size={12} /> VIP
                          </span>
                        )}
                        {plano.tipoProfissional === 'especifico' ? (
                          <span className={`prof-badge ${ehDino ? 'dino' : ''}`}>
                            <Scissors size={12} /> {plano.profissionalNome || profExclusivo?.nome || 'Profissional'}
                          </span>
                        ) : plano.tipoProfissional === 'selecionados' ? (
                          <span className="prof-badge">
                            <Users size={12} /> Equipe Selecionada ({plano.profissionaisIds?.length || 0})
                          </span>
                        ) : (
                          <span className="prof-badge">
                            <Users size={12} /> Toda a Equipe
                          </span>
                        )}
                      </div>
                      <h3 className="plano-nome">{plano.nome}</h3>
                    </div>
                    <div className="plano-preco-box">
                      <div className="plano-preco-valor">{moeda(plano.preco)}</div>
                      <div className="plano-preco-ciclo">por {plano.ciclo}</div>
                    </div>
                  </div>

                  {plano.descricao && (
                    <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 }}>
                      {plano.descricao}
                    </p>
                  )}

                  <div className="plano-detalhes">
                    <div>
                      <strong>{plano.sessoesIncluidas} procedimentos</strong> por ciclo {plano.ciclo} ·{' '}
                      {plano.regraRenovacao === 'aniversario'
                        ? 'renovação no dia de adesão'
                        : `validade de ${plano.validadeDias} dias`}
                    </div>
                    <div>
                      Assinaturas ativas:{' '}
                      <strong style={{ color: '#14b87a' }}>
                        {assinaturas.filter((a) => a.planoId === plano.id && a.status === 'ativa').length}
                      </strong>
                    </div>

                    {/* Preços diferenciados por profissional se houver */}
                    {precosProfEntries.length > 0 && (
                      <div className="tabela-precos-box">
                        <div className="tabela-precos-titulo">Valores por Profissional:</div>
                        <div className="tabela-precos-lista">
                          {precosProfEntries.map(([profId, valor]) => {
                            const prof = profissionais.find((p) => p.id === profId)
                            const nome = prof?.nome || profId
                            const profEhDino = ehProfissionalDino(nome)
                            return (
                              <div key={profId} className={`tabela-precos-item ${profEhDino ? 'dino' : ''}`}>
                                <span>{profEhDino ? `👑 ${nome}` : `✂️ ${nome}`}</span>
                                <strong>{moeda(valor)}</strong>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTÕES DE COMPARTILHAMENTO, LINK E GESTÃO */}
                <div className="plano-actions">
                  <button
                    type="button"
                    className="btn-link-adesao"
                    onClick={() => copiarTexto(linkAdesao, `link-${plano.id}`)}
                    title="Copiar link de adesão para enviar ao cliente"
                  >
                    {copiadoId === `link-${plano.id}` ? (
                      <>
                        <Check size={14} color="#14b87a" /> Link Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copiar Link de Adesão
                      </>
                    )}
                  </button>

                  <a
                    href={linkWhatsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-whatsapp-share"
                    title="Compartilhar proposta no WhatsApp"
                  >
                    <MessageSquare size={14} /> WhatsApp
                  </a>

                  <button
                    type="button"
                    className="btn-link-adesao"
                    onClick={() =>
                      setModalLink({
                        titulo: `Link de Adesão · ${plano.nome}`,
                        linkAdesao,
                        linkAdmin,
                        plano,
                      })
                    }
                    title="Ver detalhes do link e do vínculo"
                  >
                    <LinkIcon size={14} /> Detalhes do Vínculo
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirModalCriarPlano(plano)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--fg)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      
                        onExcluirPlano && onExcluirPlano(plano);
                    }}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid #fee2e2',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginLeft: 8
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      {/* SEÇÃO 2: FORMULÁRIO DE NOVA ASSINATURA COM VÍNCULO DE PROFISSIONAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        <div
          style={{
            background: 'var(--card, #1c202b)',
            border: '1.5px solid var(--line, #2b3140)',
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} color="#6E7CE0" /> Nova Assinatura & Vínculo com Profissional
            </h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              Vincule um cliente a um plano. O sistema respeita o valor e o profissional indicado.
            </p>
          </div>

          <form onSubmit={handleSubmeterAssinatura} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Cliente Cadastrado *
              </label>
              <select
                required
                value={formAssinatura.clienteId}
                onChange={(e) => setFormAssinatura((prev) => ({ ...prev, clienteId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--surface, #161922)',
                  border: '1px solid var(--line, #2b3140)',
                  borderRadius: 10,
                  color: 'var(--fg, #e8eaf2)',
                }}
              >
                <option value="">Selecionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.telefone ? `(${c.telefone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Plano Selecionado *
              </label>
              <select
                required
                value={formAssinatura.planoId}
                onChange={(e) => {
                  const selPlano = planos.find((p) => p.id === e.target.value)
                  setFormAssinatura((prev) => ({
                    ...prev,
                    planoId: e.target.value,
                    profissionalId: selPlano?.profissionalId || prev.profissionalId,
                  }))
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--surface, #161922)',
                  border: '1px solid var(--line, #2b3140)',
                  borderRadius: 10,
                  color: 'var(--fg, #e8eaf2)',
                }}
              >
                <option value="">Selecionar plano...</option>
                {planos
                  .filter((p) => p.ativo !== false && !p.removidoEm)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ehVip ? '👑 ' : ''}
                      {p.nome} · {moeda(p.preco)}/{p.ciclo}
                    </option>
                  ))}
              </select>
            </div>

            {/* Vínculo de Profissional na Assinatura */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Profissional Vinculado à Assinatura
              </label>
              <select
                value={formAssinatura.profissionalId}
                onChange={(e) => setFormAssinatura((prev) => ({ ...prev, profissionalId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--surface, #161922)',
                  border: '1px solid var(--line, #2b3140)',
                  borderRadius: 10,
                  color: 'var(--fg, #e8eaf2)',
                }}
              >
                <option value="">Qualquer profissional da equipe (Sem exclusividade)</option>
                {profissionais
                  .filter((p) => p.ativo !== false)
                  .map((p) => {
                    const isDino = ehProfissionalDino(p.nome)
                    const precoEspecial = planoAssinaturaSelecionado?.precosPorProfissional?.[p.id]
                    return (
                      <option key={p.id} value={p.id}>
                        {isDino ? '👑 ' : '✂️ '}
                        {p.nome} {precoEspecial ? `(Valor especial: ${moeda(precoEspecial)})` : ''}
                      </option>
                    )
                  })}
              </select>
            </div>

            {/* Aviso de Preço Diferenciado do Profissional */}
            {precoDiferenciadoProfSelecionado !== null && (
              <div
                style={{
                  background: 'rgba(212, 175, 55, 0.12)',
                  border: '1.5px solid rgba(212, 175, 55, 0.45)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: '#F5CF53',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <Crown size={18} />
                <span>
                  Valor ajustado para este profissional: {moeda(precoDiferenciadoProfSelecionado)}/{' '}
                  {planoAssinaturaSelecionado?.ciclo || 'mês'}.
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Data de Início
                </label>
                <input
                  type="date"
                  required
                  value={formAssinatura.inicio}
                  onChange={(e) => setFormAssinatura((prev) => ({ ...prev, inicio: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--surface, #161922)',
                    border: '1px solid var(--line, #2b3140)',
                    borderRadius: 10,
                    color: 'var(--fg, #e8eaf2)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Renovação
                </label>
                <select
                  value={formAssinatura.regraRenovacao}
                  onChange={(e) => setFormAssinatura((prev) => ({ ...prev, regraRenovacao: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--surface, #161922)',
                    border: '1px solid var(--line, #2b3140)',
                    borderRadius: 10,
                    color: 'var(--fg, #e8eaf2)',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="aniversario">Dia da contratação</option>
                  <option value="dias">Período fixo em dias</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={salvando || !formAssinatura.clienteId || !formAssinatura.planoId}
              style={{
                marginTop: 6,
                padding: '12px 18px',
                borderRadius: 10,
                border: 0,
                background: 'var(--accent, #6E7CE0)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                opacity: salvando ? 0.7 : 1,
              }}
            >
              {salvando ? 'Criando Assinatura…' : 'Criar Assinatura & Gerar Vínculo'}
            </button>
          </form>
        </div>

        {/* LISTA DE ASSINATURAS ATIVAS E VÍNCULOS */}
        <div
          style={{
            background: 'var(--card, #1c202b)',
            border: '1.5px solid var(--line, #2b3140)',
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={20} color="#14b87a" /> Assinaturas & Vínculos Ativos ({assinaturas.length})
              </h3>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                Acompanhe o profissional vinculado a cada sócio e copie o link de acompanhamento direto.
              </p>
            </div>

            {assinaturas.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>
                Nenhuma assinatura cadastrada até o momento.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {assinaturas.map((ass) => {
                  const plano = planos.find((p) => p.id === ass.planoId)
                  const ehVip = Boolean(ass.ehVip || plano?.ehVip)
                  const linkVinculo = `https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas&assinaturaId=${encodeURIComponent(
                    ass.id
                  )}`
                  const linkExtrato = `https://kytto.com.br/perfil?aba=pacotes&assinatura=${encodeURIComponent(ass.id)}`
                  const textoWhats = `Olá ${ass.clienteNome || 'Cliente'}! Segue o link de acompanhamento do seu *${
                    plano?.nome || 'Plano VIP'
                  }* na Barbearia Dino${ass.profissionalNome ? ` com o profissional *${ass.profissionalNome}*` : ''}:\n\nConsulte suas sessões no link: ${linkExtrato}`
                  const linkWhatsUrl = `https://wa.me/?text=${encodeURIComponent(textoWhats)}`

                  return (
                    <div
                      key={ass.id}
                      style={{
                        background: 'var(--surface, #161922)',
                        border: `1px solid ${ehVip ? '#D4AF37' : 'var(--line, #2b3140)'}`,
                        borderRadius: 12,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {ehVip && (
                              <span className="vip-badge" style={{ fontSize: 10, padding: '2px 6px' }}>
                                <Crown size={10} /> VIP
                              </span>
                            )}
                            <strong style={{ fontSize: 14 }}>{ass.clienteNome || 'Cliente'}</strong>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {plano?.nome || 'Plano'} · {ass.sessoesUsadas}/{ass.sessoesContratadas} sessões usadas
                          </div>
                          {ass.profissionalNome && (
                            <div style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, marginTop: 2 }}>
                              ✂️ Profissional vinculado: {ass.profissionalNome}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 800,
                              background:
                                ass.status === 'ativa'
                                  ? 'rgba(20, 184, 122, 0.15)'
                                  : 'rgba(245, 158, 11, 0.15)',
                              color: ass.status === 'ativa' ? '#14b87a' : '#f59e0b',
                            }}
                          >
                            {ass.status}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          borderTop: '1px solid var(--line, #2b3140)',
                          paddingTop: 8,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-link-adesao"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => copiarTexto(linkVinculo, `ass-${ass.id}`)}
                            title="Copiar link interno do vínculo"
                          >
                            {copiadoId === `ass-${ass.id}` ? (
                              <>
                                <Check size={12} color="#14b87a" /> Copiado!
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Link Vínculo
                              </>
                            )}
                          </button>

                          <a
                            href={linkWhatsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-whatsapp-share"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            title="Enviar extrato para o cliente pelo WhatsApp"
                          >
                            <MessageSquare size={12} /> Extrato WhatsApp
                          </a>
                        </div>

                        <div style={{ display: 'flex', gap: 4 }}>
                          {ass.status === 'pendente_ativacao' && onAtivarAssinatura && (
                            <button
                              type="button"
                              onClick={() => onAtivarAssinatura(ass)}
                              style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                borderRadius: 6,
                                border: '1px solid var(--line)',
                                background: 'var(--card2)',
                                color: 'var(--fg)',
                                cursor: 'pointer',
                              }}
                            >
                              Ativar
                            </button>
                          )}
                          {ass.status === 'ativa' && onAlterarStatusAssinatura && (
                            <button
                              type="button"
                              onClick={() => onAlterarStatusAssinatura(ass, 'pausada')}
                              style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                borderRadius: 6,
                                border: '1px solid var(--line)',
                                background: 'var(--card2)',
                                color: 'var(--fg)',
                                cursor: 'pointer',
                              }}
                            >
                              Pausar
                            </button>
                          )}
                          {ass.status === 'pausada' && onAlterarStatusAssinatura && (
                            <button
                              type="button"
                              onClick={() => onAlterarStatusAssinatura(ass, 'ativa')}
                              style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                borderRadius: 6,
                                border: '1px solid var(--line)',
                                background: 'var(--card2)',
                                color: 'var(--fg)',
                                cursor: 'pointer',
                              }}
                            >
                              Retomar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE PLANO COM SUPORTE TOTAL A PROFISSIONAL & VIP */}
      {modalPlanoAberto && (
        <div className="modal-link-backdrop">
          <div className="modal-link-box" style={{ maxWidth: 640 }}>
            <div className="modal-link-header">
              <h3 className="modal-link-titulo">
                {formPlano.ehVip ? <Crown size={22} color="#D4AF37" /> : <Scissors size={20} />}
                {planoEmEdicao ? 'Editar Plano' : 'Novo Plano de Recorrência & VIP'}
              </h3>
              <button
                type="button"
                onClick={() => setModalPlanoAberto(false)}
                style={{ background: 'transparent', border: 0, color: 'var(--muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmeterPlano} style={{ display: 'grid', gap: 14 }}>
              {/* Checkbox Destaque VIP */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: formPlano.ehVip ? 'rgba(212, 175, 55, 0.15)' : 'var(--card2, #161922)',
                  border: `1.5px solid ${formPlano.ehVip ? '#D4AF37' : 'var(--line, #2b3140)'}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: formPlano.ehVip ? '#FFD700' : 'var(--fg)',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={formPlano.ehVip}
                  onChange={(e) => setFormPlano((prev) => ({ ...prev, ehVip: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <Crown size={18} color="#D4AF37" />
                <span>Marcar como Plano VIP (Tratamento Executivo & Destaque Dourado)</span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    Nome do Plano *
                  </label>
                  <input
                    required
                    value={formPlano.nome}
                    onChange={(e) => setFormPlano((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Plano VIP Gold — Mestre Dino"
                    className="input-link-readonly"
                    style={{ fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    Preço Base (R$) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    value={formPlano.preco}
                    onChange={(e) => setFormPlano((prev) => ({ ...prev, preco: e.target.value }))}
                    placeholder="600.00"
                    className="input-link-readonly"
                    style={{ fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              {/* SELEÇÃO DO TIPO DE PROFISSIONAL */}
              <div style={{ background: 'var(--card2, #161922)', padding: 12, borderRadius: 12, border: '1px solid var(--line)' }}>
                <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                  Abrangência de Profissionais
                </label>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="tipoProfissional"
                      value="todos"
                      checked={formPlano.tipoProfissional === 'todos'}
                      onChange={() => setFormPlano((prev) => ({ ...prev, tipoProfissional: 'todos', profissionalId: '' }))}
                    />
                    Toda a Equipe
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="tipoProfissional"
                      value="especifico"
                      checked={formPlano.tipoProfissional === 'especifico'}
                      onChange={() => setFormPlano((prev) => ({ ...prev, tipoProfissional: 'especifico' }))}
                    />
                    Exclusivo de um Profissional (Ex: Dino)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="tipoProfissional"
                      value="selecionados"
                      checked={formPlano.tipoProfissional === 'selecionados'}
                      onChange={() => setFormPlano((prev) => ({ ...prev, tipoProfissional: 'selecionados' }))}
                    />
                    Profissionais Selecionados
                  </label>
                </div>

                {/* Dropdown se for profissional específico */}
                {formPlano.tipoProfissional === 'especifico' && (
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                      Selecione o Profissional Exclusivo:
                    </label>
                    <select
                      required
                      value={formPlano.profissionalId}
                      onChange={(e) => setFormPlano((prev) => ({ ...prev, profissionalId: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'var(--surface, #161922)',
                        border: '1px solid var(--line, #2b3140)',
                        borderRadius: 10,
                        color: 'var(--fg, #e8eaf2)',
                      }}
                    >
                      <option value="">Selecione o profissional...</option>
                      {profissionais
                        .filter((p) => p.ativo !== false)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {ehProfissionalDino(p.nome) ? '👑 ' : '✂️ '}
                            {p.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Checkboxes se forem profissionais selecionados */}
                {formPlano.tipoProfissional === 'selecionados' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
                    {profissionais
                      .filter((p) => p.ativo !== false)
                      .map((p) => {
                        const checked = formPlano.profissionaisIds.includes(p.id)
                        return (
                          <label
                            key={p.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 8px',
                              background: checked ? 'rgba(110, 124, 224, 0.15)' : 'var(--card)',
                              border: '1px solid var(--line)',
                              borderRadius: 8,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [...formPlano.profissionaisIds, p.id]
                                  : formPlano.profissionaisIds.filter((id) => id !== p.id)
                                setFormPlano((prev) => ({ ...prev, profissionaisIds: ids }))
                              }}
                            />
                            {ehProfissionalDino(p.nome) ? '👑 ' : '✂️ '}
                            {p.nome}
                          </label>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* SEÇÃO DE PREÇOS DIFERENCIADOS POR PROFISSIONAL */}
              <div className="secao-precos-prof">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    Preços Diferenciados por Profissional (Opcional)
                  </label>
                  <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                    Permite cobrar um valor com o Dino e outro valor com os demais barbeiros.
                  </small>
                </div>

                <div className="grid-precos-prof">
                  {profissionais
                    .filter((p) => p.ativo !== false)
                    .map((p) => {
                      const isDino = ehProfissionalDino(p.nome)
                      const valorAtual = formPlano.precosPorProfissional?.[p.id] ?? ''
                      return (
                        <div key={p.id} className={`card-preco-prof ${isDino ? 'dino' : ''}`}>
                          <span style={{ fontSize: 12, fontWeight: isDino ? 800 : 600 }}>
                            {isDino ? '👑 ' : '✂️ '}
                            {p.nome}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="R$ Padrão"
                            value={valorAtual}
                            onChange={(e) => {
                              const val = e.target.value
                              setFormPlano((prev) => {
                                const precos = { ...prev.precosPorProfissional }
                                if (val) {
                                  precos[p.id] = Number(val)
                                } else {
                                  delete precos[p.id]
                                }
                                return { ...prev, precosPorProfissional: precos }
                              })
                            }}
                            style={{
                              width: 85,
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--line)',
                              background: 'var(--surface)',
                              color: 'var(--fg)',
                              fontSize: 12,
                              textAlign: 'right',
                            }}
                          />
                        </div>
                      )
                    })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    Sessões Incluídas no Ciclo
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formPlano.sessoesIncluidas}
                    onChange={(e) => setFormPlano((prev) => ({ ...prev, sessoesIncluidas: e.target.value }))}
                    className="input-link-readonly"
                    style={{ fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    Ciclo de Cobrança
                  </label>
                  <select
                    value={formPlano.ciclo}
                    onChange={(e) => setFormPlano((prev) => ({ ...prev, ciclo: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--surface, #161922)',
                      border: '1px solid var(--line, #2b3140)',
                      borderRadius: 10,
                      color: 'var(--fg, #e8eaf2)',
                    }}
                  >
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                  Descrição Comercial
                </label>
                <textarea
                  rows={2}
                  value={formPlano.descricao}
                  onChange={(e) => setFormPlano((prev) => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: 4 procedimentos mensais (corte, barba ou visagismo), flexibilidade e atendimento exclusivo."
                  className="input-link-readonly"
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalPlanoAberto(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--fg)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 0,
                    background: formPlano.ehVip
                      ? 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)'
                      : 'var(--accent, #6E7CE0)',
                    color: formPlano.ehVip ? '#121212' : '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {salvando ? 'Salvando…' : planoEmEdicao ? 'Salvar Alterações' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DE LINK E VÍNCULO */}
      {modalLink && (
        <div className="modal-link-backdrop">
          <div className="modal-link-box">
            <div className="modal-link-header">
              <h3 className="modal-link-titulo">
                <LinkIcon size={20} color="#D4AF37" /> {modalLink.titulo}
              </h3>
              <button
                type="button"
                onClick={() => setModalLink(null)}
                style={{ background: 'transparent', border: 0, color: 'var(--muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Link de Adesão Pública (Enviar para o Cliente)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={modalLink.linkAdesao} className="input-link-readonly" />
                <button
                  type="button"
                  className="btn-link-adesao"
                  onClick={() => copiarTexto(modalLink.linkAdesao, 'modal-adesao')}
                >
                  {copiadoId === 'modal-adesao' ? <Check size={16} color="#14b87a" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Link Administrativo de Gestão do Vínculo
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={modalLink.linkAdmin} className="input-link-readonly" />
                <button
                  type="button"
                  className="btn-link-adesao"
                  onClick={() => copiarTexto(modalLink.linkAdmin, 'modal-admin')}
                >
                  {copiadoId === 'modal-admin' ? <Check size={16} color="#14b87a" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Olá! Segue o link de adesão do nosso *${modalLink.plano?.nome || 'Plano'}*: ${modalLink.linkAdesao}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="btn-whatsapp-share"
                style={{ padding: '9px 16px' }}
              >
                <MessageSquare size={16} /> Enviar via WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setModalLink(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--fg)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
