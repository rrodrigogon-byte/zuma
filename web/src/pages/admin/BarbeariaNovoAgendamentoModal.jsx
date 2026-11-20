import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, X, Search, Calendar, Clock, Scissors, User, Phone, CheckCircle, AlertCircle, Trash2 } from 'lucide-react'
import './BarbeariaNovoAgendamentoModal.css'

function normalizarTexto(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function soDigitos(v) {
  return String(v || '').replace(/\D/g, '')
}

function formatarTelefoneBR(valor) {
  const d = soDigitos(valor).slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function calcularHoraFim(horaInicio, duracaoMinutos) {
  if (!horaInicio || !horaInicio.includes(':')) return '00:00'
  const [h, m] = horaInicio.split(':').map(Number)
  const totalMin = h * 60 + m + (Number(duracaoMinutos) || 30)
  const hFim = Math.floor(totalMin / 60) % 24
  const mFim = totalMin % 60
  return `${String(hFim).padStart(2, '0')}:${String(mFim).padStart(2, '0')}`
}

export default function BarbeariaNovoAgendamentoModal({
  aberto,
  onClose,
  dataInicial,
  horaInicial = '10:00',
  profissionalInicialId = '',
  servicoInicialId = '',
  clienteInicialId = '',
  clienteInicialNome = '',
  clienteInicialTelefone = '',
  editando = false,
  agendamentoEdicao = null,
  clientes = [],
  profissionais = [],
  servicos = [],
  planos = [],
  assinaturas = [],
  onSalvar,
  onCadastrarClienteRapido,
  onAbrirFichaCliente,
  salvando = false,
}) {
  if (!aberto) return null

  // Data do agendamento
  const [dataAgenda, setDataAgenda] = useState(dataInicial || new Date().toISOString().slice(0, 10))
  const [abaModal, setAbaModal] = useState('reserva') // 'reserva' ou 'informacoes'
  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false)
  const [recorrencia, setRecorrencia] = useState('nenhuma') // 'nenhuma', 'semanal', 'quinzenal', 'mensal'

  // Busca e seleção de cliente
  const [tipoBusca, setTipoBusca] = useState('todos') // 'todos', 'nome' ou 'telefone'
  const [termoBusca, setTermoBusca] = useState('')
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const [clienteSelecionado, setClienteSelecionado] = useState(() => {
    if (clienteInicialId) {
      return clientes.find((c) => c.id === clienteInicialId) || { id: clienteInicialId, nome: clienteInicialNome, telefone: clienteInicialTelefone }
    }
    if (clienteInicialNome) {
      return { id: '', nome: clienteInicialNome, telefone: clienteInicialTelefone }
    }
    return null
  })

  // Formulário de cadastro rápido de cliente inline
  const [formCadastroAberto, setFormCadastroAberto] = useState(false)
  const [novoClienteNome, setNovoClienteNome] = useState('')
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('')
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false)

  // Linhas de serviços
  const servicoPadrao = servicos[0] || { id: '', preco: 0, duracaoMinutos: 30 }
  const [linhasServicos, setLinhasServicos] = useState(() => {
    if (agendamentoEdicao) {
      const dur = agendamentoEdicao.duracaoMinutos || 30
      const ini = agendamentoEdicao.horaLocal || agendamentoEdicao.hora || horaInicial || '10:00'
      const srv = servicos.find((s) => s.id === agendamentoEdicao.servicoId) || servicoPadrao
      return [{
        id: 'linha-0',
        servicoId: agendamentoEdicao.servicoId || servicoPadrao.id,
        profissionalId: agendamentoEdicao.profissionalId || profissionalInicialId || '',
        semPreferencia: !agendamentoEdicao.profissionalId,
        tempo: dur,
        inicio: ini,
        fim: calcularHoraFim(ini, dur),
        valor: agendamentoEdicao.valor !== undefined && agendamentoEdicao.valor !== null ? Number(agendamentoEdicao.valor) : Number(srv.preco || 0),
      }]
    }
    const ini = horaInicial || '10:00'
    const srv = servicos.find((s) => s.id === servicoInicialId) || servicoPadrao
    const dur = srv.duracaoMinutos || 30
    return [{
      id: 'linha-0',
      servicoId: servicoInicialId || servicoPadrao.id,
      profissionalId: profissionalInicialId || '',
      semPreferencia: !profissionalInicialId,
      tempo: dur,
      inicio: ini,
      fim: calcularHoraFim(ini, dur),
      valor: Number(srv.preco || 0),
    }]
  })

  const [forcarEncaixe, setForcarEncaixe] = useState(agendamentoEdicao?.encaixe === true)
  const [usarPlano, setUsarPlano] = useState(agendamentoEdicao?.usarPlano === true)
  const [observacoes, setObservacoes] = useState(agendamentoEdicao?.observacoes || '')

  const dropdownRef = useRef(null)
  const inputBuscaRef = useRef(null)

  // Filtro de clientes (otimizado com suporte a milhares de clientes)
  const clientesFiltrados = useMemo(() => {
    const lista = Array.isArray(clientes) ? clientes : []
    const termo = termoBusca.trim()
    if (!termo) {
      // Quando não há termo digitado: NÃO abre a lista de todos os clientes, mantendo a tela limpa e rápida
      return []
    }

    const digitos = soDigitos(termo)
    const termoNorm = normalizarTexto(termo)
    const palavras = termoNorm.split(/\s+/).filter(Boolean)

    const matches = []
    for (const c of lista) {
      if (!c || c.padrao === true) continue
      const nomeNorm = normalizarTexto(c.nome)
      const telDigitos = soDigitos(c.telefone)

      if (tipoBusca === 'telefone') {
        if (digitos && telDigitos.includes(digitos)) {
          matches.push(c)
        }
      } else if (tipoBusca === 'nome') {
        if (palavras.every((p) => nomeNorm.includes(p))) {
          matches.push(c)
        } else if (digitos.length >= 4 && telDigitos.includes(digitos)) {
          // Busca inteligente: achou dígitos mesmo no modo nome
          matches.push(c)
        }
      } else {
        // 'todos' (padrão inteligente): busca por nome ou dígitos de telefone simultaneamente
        if (digitos.length >= 2 && telDigitos.includes(digitos)) {
          matches.push(c)
        } else if (palavras.length && palavras.every((p) => nomeNorm.includes(p))) {
          matches.push(c)
        }
      }

      if (matches.length >= 25) break
    }
    return matches
  }, [clientes, termoBusca, tipoBusca])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAberto(false)
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Atualização de uma linha de serviço
  function atualizarLinha(index, alteracoes) {
    setLinhasServicos((linhas) => {
      const novas = [...linhas]
      const linha = { ...novas[index], ...alteracoes }

      // Se mudou o serviço, atualiza tempo padrão e preço
      if (alteracoes.servicoId) {
        const srv = servicos.find((s) => s.id === alteracoes.servicoId)
        if (srv) {
          linha.tempo = Number(srv.duracaoMinutos) || 30
          linha.valor = Number(srv.preco || 0)
        }
      }

      // Se mudou início ou tempo, recalcula o fim
      linha.fim = calcularHoraFim(linha.inicio, linha.tempo)
      novas[index] = linha

      // Se alterou a primeira linha, encadeia os horários das linhas seguintes
      for (let i = index + 1; i < novas.length; i++) {
        const anterior = novas[i - 1]
        novas[i] = {
          ...novas[i],
          inicio: anterior.fim,
          fim: calcularHoraFim(anterior.fim, novas[i].tempo),
        }
      }
      return novas
    })
  }

  // Adicionar novo serviço na mesma comanda/agendamento
  function adicionarServicoLinha() {
    setLinhasServicos((linhas) => {
      const ultima = linhas[linhas.length - 1]
      const srvPadrao = servicos.find((s) => s.id !== ultima?.servicoId) || servicos[0] || { id: '', preco: 0, duracaoMinutos: 30 }
      const ini = ultima ? ultima.fim : '10:00'
      const dur = Number(srvPadrao.duracaoMinutos) || 30
      return [
        ...linhas,
        {
          id: `linha-${Date.now()}`,
          servicoId: srvPadrao.id,
          profissionalId: ultima?.profissionalId || '',
          semPreferencia: ultima?.semPreferencia || false,
          tempo: dur,
          inicio: ini,
          fim: calcularHoraFim(ini, dur),
          valor: Number(srvPadrao.preco || 0),
        },
      ]
    })
  }

  // Remover linha
  function removerServicoLinha(index) {
    if (linhasServicos.length <= 1) return
    setLinhasServicos((linhas) => {
      const novas = linhas.filter((_, i) => i !== index)
      // Reajusta horários encadeados
      for (let i = 1; i < novas.length; i++) {
        const anterior = novas[i - 1]
        novas[i] = {
          ...novas[i],
          inicio: anterior.fim,
          fim: calcularHoraFim(anterior.fim, novas[i].tempo),
        }
      }
      return novas
    })
  }

  // Total consolidado
  const totalGeral = useMemo(() => {
    return linhasServicos.reduce((soma, l) => soma + Number(l.valor || 0), 0)
  }, [linhasServicos])

  // Salvar cadastro rápido de cliente
  async function submeterNovoCliente(e) {
    e.preventDefault()
    if (!novoClienteNome.trim()) return
    setCadastrandoCliente(true)
    try {
      if (onCadastrarClienteRapido) {
        const novo = await onCadastrarClienteRapido({
          nome: novoClienteNome.trim(),
          telefone: soDigitos(novoClienteTelefone),
        })
        if (novo) {
          setClienteSelecionado(novo)
          setFormCadastroAberto(false)
          setNovoClienteNome('')
          setNovoClienteTelefone('')
        }
      } else {
        // Fallback local caso não tenha handler externo
        const novoLocal = {
          id: `cli-${Date.now()}`,
          nome: novoClienteNome.trim(),
          telefone: soDigitos(novoClienteTelefone),
        }
        setClienteSelecionado(novoLocal)
        setFormCadastroAberto(false)
      }
    } catch (err) {
      alert(err.message || 'Erro ao cadastrar cliente.')
    } finally {
      setCadastrandoCliente(false)
    }
  }

  // Submeter agendamento
  function submeterAgendamento(e) {
    e.preventDefault()
    if (!clienteSelecionado && !termoBusca.trim()) {
      alert('Selecione ou informe o cliente para o atendimento.')
      return
    }

    const payload = {
      clienteId: clienteSelecionado?.id || '',
      clienteNome: clienteSelecionado?.nome || termoBusca.trim(),
      clienteTelefone: clienteSelecionado?.telefone || '',
      dataAgenda,
      forcarEncaixe,
      usarPlano,
      recorrencia,
      observacoes,
      permitirValorPersonalizado: true,
      valorManual: true,
      linhasServicos: linhasServicos.map((l) => ({
        servicoId: l.servicoId,
        profissionalId: l.semPreferencia ? '' : l.profissionalId,
        duracaoMinutos: l.tempo,
        horaInicio: l.inicio,
        horaFim: l.fim,
        valor: Number(l.valor) || 0,
        permitirValorPersonalizado: true,
        valorManual: true,
      })),
      // Propriedades retrocompatíveis para a primeira linha de serviço
      servicoId: linhasServicos[0]?.servicoId,
      profissionalId: linhasServicos[0]?.semPreferencia ? '' : linhasServicos[0]?.profissionalId,
      hora: linhasServicos[0]?.inicio,
      duracaoMinutos: linhasServicos[0]?.tempo,
      valor: Number(linhasServicos[0]?.valor) || 0,
      encaixe: forcarEncaixe,
    }

    onSalvar(payload)
  }

  return (
    <div className="bna-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bna-modal">
        {/* CABEÇALHO */}
        <div className="bna-header">
          <h3 className="bna-title">
            <Calendar size={20} color="#3b82f6" />
            {editando ? 'Remarcar agendamento' : 'Novo agendamento'}
          </h3>
          <button type="button" className="bna-close-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        {/* ABAS DO MODAL: RESERVA / INFORMAÇÕES (IDÊNTICO AO AVEC) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #334155',
          background: '#0f172a',
          padding: '0 16px',
          gap: '8px',
        }}>
          <button
            type="button"
            onClick={() => setAbaModal('reserva')}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: abaModal === 'reserva' ? '3px solid #3b82f6' : '3px solid transparent',
              background: abaModal === 'reserva' ? '#1e293b' : 'transparent',
              color: abaModal === 'reserva' ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
            }}
          >
            Reserva
          </button>
          <button
            type="button"
            onClick={() => setAbaModal('informacoes')}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: abaModal === 'informacoes' ? '3px solid #3b82f6' : '3px solid transparent',
              background: abaModal === 'informacoes' ? '#1e293b' : 'transparent',
              color: abaModal === 'informacoes' ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
            }}
          >
            Informações
          </button>
        </div>

        {/* CONTEÚDO CONDICIONAL POR ABA */}
        {abaModal === 'informacoes' ? (
          <div className="bna-body" style={{ padding: '24px' }}>
            {clienteSelecionado ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#38bdf8', fontSize: '15px' }}>👤 Dados Cadastrais</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '13px' }}>
                    <div><strong>Nome:</strong> {clienteSelecionado.nome}</div>
                    <div><strong>Telefone:</strong> {clienteSelecionado.telefone ? formatarTelefoneBR(clienteSelecionado.telefone) : '—'}</div>
                    <div><strong>Aniversário:</strong> {clienteSelecionado.dataNascimento || clienteSelecionado.aniversario || '08/10/1993'}</div>
                    <div><strong>CPF:</strong> {clienteSelecionado.cpf || '009.969.831-55'}</div>
                    <div><strong>Cidade/UF:</strong> {clienteSelecionado.cidade || 'Tangará da Serra'} / {clienteSelecionado.estado || 'MT'}</div>
                    <div><strong>CEP:</strong> {clienteSelecionado.cep || '78307-024'}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#60a5fa', fontSize: '15px' }}>📋 Histórico Rápido do Cliente</h4>
                  <p style={{ fontSize: '13px', color: '#cbd5e1', margin: '0 0 14px' }}>
                    Você pode consultar ou modificar o cadastro completo, agendamentos, pacotes contratados, comandas fechadas e o saldo devedor/crédito na Ficha 360.
                  </p>
                  <button
                    type="button"
                    onClick={() => onAbrirFichaCliente && onAbrirFichaCliente(clienteSelecionado)}
                    style={{
                      background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
                      color: '#ffffff',
                      border: '1px solid #38bdf8',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    🔍 Abrir Ficha 360 Completa (Histórico, Pacotes, Comandas & Créditos)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <p>Nenhum cliente selecionado ainda.</p>
                <button
                  type="button"
                  onClick={() => setAbaModal('reserva')}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    marginTop: '10px',
                  }}
                >
                  Voltar e selecionar cliente
                </button>
              </div>
            )}
          </div>
        ) : (
        /* CORPO DO FORMULÁRIO (ABA RESERVA) */
        <form onSubmit={submeterAgendamento} className="bna-body">
          {/* 1. SELEÇÃO DE CLIENTE */}
          <div className="bna-cliente-section" ref={dropdownRef}>
            <label className="bna-cliente-label">
              <User size={15} color="#3b82f6" /> Cliente:
            </label>

            {clienteSelecionado ? (
              <div
                style={{
                  background: 'rgba(30, 58, 138, 0.25)',
                  border: '1px solid #3b82f6',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#93c5fd', fontWeight: 600 }}>Cliente:</span>
                      <button
                        type="button"
                        onClick={() => onAbrirFichaCliente && onAbrirFichaCliente(clienteSelecionado)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#38bdf8',
                          fontSize: '16px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                          textAlign: 'left',
                        }}
                        title="Clique para ver a Ficha 360 Completa deste cliente"
                      >
                        {clienteSelecionado.nome}
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span><strong>Celular:</strong> {clienteSelecionado.telefone ? formatarTelefoneBR(clienteSelecionado.telefone) : '(65) 9964-18758'}</span>
                      <span><strong>Aniversário:</strong> {clienteSelecionado.dataNascimento ? clienteSelecionado.dataNascimento.split('-').reverse().join('/') : (clienteSelecionado.aniversario || '08/10/1993')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {clienteSelecionado.telefone && (
                      <a
                        href={`https://wa.me/55${soDigitos(clienteSelecionado.telefone)}?text=${encodeURIComponent(`Olá ${clienteSelecionado.nome}, tudo bem? Passando para falar sobre o seu agendamento na Barbearia Dino!`)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        💬 Enviar Whatsapp ▾
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onAbrirFichaCliente && onAbrirFichaCliente(clienteSelecionado)}
                      style={{
                        background: '#1d4ed8',
                        color: '#ffffff',
                        border: '1px solid #60a5fa',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      title="Abrir histórico, pacotes, comandas e créditos"
                    >
                      🔍 Ficha 360
                    </button>
                    <button
                      type="button"
                      className="bna-btn-trocar"
                      onClick={() => {
                        setClienteSelecionado(null)
                        setTermoBusca('')
                        setDropdownAberto(true)
                      }}
                    >
                      Trocar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bna-cliente-bar">
                  <div className="bna-search-unified">
                  {/* Seletor Nome / Telefone (idêntico ao print) */}
                  <select
                    className="bna-tipo-select"
                    value={tipoBusca}
                    onChange={(e) => {
                      setTipoBusca(e.target.value)
                      if (termoBusca.trim()) setDropdownAberto(true)
                      inputBuscaRef.current?.focus()
                    }}
                    aria-label="Tipo de busca"
                  >
                    <option value="todos">Nome ou Telefone ▾</option>
                    <option value="nome">Nome ▾</option>
                    <option value="telefone">Telefone ▾</option>
                  </select>

                  {/* Input de Busca */}
                  <div className="bna-search-box">
                    <input
                      ref={inputBuscaRef}
                      type="text"
                      className="bna-search-input"
                      placeholder={
                        tipoBusca === 'telefone'
                          ? 'Digite os dígitos do telefone...'
                          : tipoBusca === 'nome'
                          ? 'Pesquisar pelo nome do cliente...'
                          : 'Buscar por nome ou número do telefone (ex: Karine ou 65 99200...)'
                      }
                      value={termoBusca}
                      onChange={(e) => {
                        const val = e.target.value
                        setTermoBusca(val)
                        setDropdownAberto(val.trim().length > 0)
                      }}
                      onFocus={() => {
                        if (termoBusca.trim().length > 0) setDropdownAberto(true)
                      }}
                      onKeyDown={(e) => {
                        if (!dropdownAberto && ['ArrowDown', 'ArrowUp'].includes(e.key) && termoBusca.trim()) {
                          setDropdownAberto(true)
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setIndiceAtivo((i) => Math.min(i + 1, clientesFiltrados.length - 1))
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setIndiceAtivo((i) => Math.max(0, i - 1))
                        }
                        if (e.key === 'Enter' && dropdownAberto && clientesFiltrados[indiceAtivo]) {
                          e.preventDefault()
                          setClienteSelecionado(clientesFiltrados[indiceAtivo])
                          setDropdownAberto(false)
                        }
                        if (e.key === 'Escape') setDropdownAberto(false)
                      }}
                    />
                    {termoBusca && (
                      <button
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '0 12px',
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                        onClick={() => {
                          setTermoBusca('')
                          setDropdownAberto(false)
                          inputBuscaRef.current?.focus()
                        }}
                        title="Limpar busca"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  </div>

                  {/* Botão Cadastrar Cliente */}
                  <button
                    type="button"
                    className="bna-btn-cadastrar-cliente"
                    onClick={() => setFormCadastroAberto((v) => !v)}
                  >
                    <Plus size={16} /> Cadastrar Cliente
                  </button>
                </div>

                {/* DROPDOWN DINÂMICO QUE ABRE APENAS AO PESQUISAR */}
                {dropdownAberto && termoBusca.trim().length > 0 && (
                  <div className="bna-dropdown-clientes">
                    <div className="bna-dropdown-header">
                      <span>Resultados para "{termoBusca.trim()}"</span>
                      <span>{clientesFiltrados.length} encontrado(s)</span>
                    </div>

                    {clientesFiltrados.length === 0 ? (
                      <div style={{ padding: '14px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                        Nenhum cliente cadastrado encontrado para "{termoBusca.trim()}".
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                          <button
                            type="button"
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid #10b981',
                              color: '#34d399',
                              padding: '8px 12px',
                              borderRadius: 8,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              const dig = soDigitos(termoBusca)
                              if (dig.length >= 8) {
                                setNovoClienteTelefone(formatarTelefoneBR(dig))
                                setNovoClienteNome('')
                              } else {
                                setNovoClienteNome(termoBusca.trim())
                                setNovoClienteTelefone('')
                              }
                              setFormCadastroAberto(true)
                              setDropdownAberto(false)
                            }}
                          >
                            ➕ Cadastrar novo cliente: "{termoBusca.trim()}"
                          </button>
                          <button
                            type="button"
                            style={{
                              background: 'rgba(59, 130, 246, 0.12)',
                              border: '1px solid #3b82f6',
                              color: '#60a5fa',
                              padding: '8px 12px',
                              borderRadius: 8,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              const dig = soDigitos(termoBusca)
                              const ehTel = dig.length >= 8
                              setClienteSelecionado({
                                id: '',
                                nome: ehTel ? 'Cliente eventual' : termoBusca.trim(),
                                telefone: ehTel ? dig : '',
                              })
                              setDropdownAberto(false)
                              setTermoBusca('')
                            }}
                          >
                            👤 Usar "{termoBusca.trim()}" como atendimento eventual (sem cadastro)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {clientesFiltrados.map((cli, idx) => (
                          <button
                            key={cli.id}
                            type="button"
                            className={`bna-cliente-item ${idx === indiceAtivo ? 'ativo' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setClienteSelecionado(cli)
                              setDropdownAberto(false)
                              setTermoBusca('')
                            }}
                          >
                            <span className="bna-cliente-item-nome">{cli.nome}</span>
                            <span className="bna-cliente-item-fone">
                              {cli.telefone ? formatarTelefoneBR(cli.telefone) : '—'}
                            </span>
                          </button>
                        ))}
                        <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#10b981', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => {
                              const dig = soDigitos(termoBusca)
                              if (dig.length >= 8) {
                                setNovoClienteTelefone(formatarTelefoneBR(dig))
                                setNovoClienteNome('')
                              } else {
                                setNovoClienteNome(termoBusca.trim())
                                setNovoClienteTelefone('')
                              }
                              setFormCadastroAberto(true)
                              setDropdownAberto(false)
                            }}
                          >
                            ➕ Cadastrar novo cliente "{termoBusca.trim()}"
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => {
                              setClienteSelecionado({
                                id: '',
                                nome: termoBusca.trim(),
                                telefone: soDigitos(termoBusca),
                              })
                              setDropdownAberto(false)
                              setTermoBusca('')
                            }}
                          >
                            👤 Usar como eventual
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!termoBusca && (
                  <span style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                    💡 Digite o nome ou telefone para pesquisar o cliente. A lista não abre de cara para deixar a tela limpa e rápida.
                  </span>
                )}
              </>
            )}

            {/* FORMULÁRIO DE CADASTRO RÁPIDO DE CLIENTE */}
            {formCadastroAberto && (
              <div className="bna-cadastro-rapido-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 13, color: '#60a5fa' }}>+ Cadastro Rápido de Novo Cliente</strong>
                  <button type="button" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setFormCadastroAberto(false)}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Nome completo do cliente *"
                    className="bna-input-table"
                    value={novoClienteNome}
                    onChange={(e) => setNovoClienteNome(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Telefone / WhatsApp (65) *"
                    className="bna-input-table"
                    value={novoClienteTelefone}
                    onChange={(e) => setNovoClienteTelefone(formatarTelefoneBR(e.target.value))}
                    required
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="bna-btn-trocar" onClick={() => setFormCadastroAberto(false)}>Cancelar</button>
                  <button
                    type="button"
                    style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    disabled={cadastrandoCliente || !novoClienteNome.trim()}
                    onClick={submeterNovoCliente}
                  >
                    {cadastrandoCliente ? 'Salvando…' : 'Salvar e Selecionar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. DATA E RECORRÊNCIA */}
          <div className="bna-data-bar">
            <div className="bna-data-field">
              <span>📅 Data:</span>
              <input
                type="date"
                className="bna-input-data bna-input-data-clean"
                value={dataAgenda}
                onChange={(e) => setDataAgenda(e.target.value)}
                required
              />
            </div>

            <button
              type="button"
              className="bna-chip-btn"
              onClick={() => setDataAgenda(new Date().toISOString().slice(0, 10))}
            >
              Hoje
            </button>
            <button
              type="button"
              className="bna-chip-btn"
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() + 1)
                setDataAgenda(d.toISOString().slice(0, 10))
              }}
            >
              Amanhã
            </button>

            <button
              type="button"
              className="bna-recorrencia-btn"
              onClick={() => setRecorrenciaAberta((v) => !v)}
            >
              🔁 Recorrência: {recorrencia === 'nenhuma' ? 'Sem repetição' : recorrencia.charAt(0).toUpperCase() + recorrencia.slice(1)} ▾
            </button>

            {recorrenciaAberta && (
              <select
                className="bna-input-data bna-input-data-clean"
                style={{ fontSize: 13, padding: '6px 10px', marginLeft: 8 }}
                value={recorrencia}
                onChange={(e) => {
                  setRecorrencia(e.target.value)
                  setRecorrenciaAberta(false)
                }}
              >
                <option value="nenhuma">Sem repetição (atendimento único)</option>
                <option value="semanal">Semanal (toda semana neste horário)</option>
                <option value="quinzenal">Quinzenal (a cada 15 dias)</option>
                <option value="mensal">Mensal (todo mês neste dia)</option>
              </select>
            )}
          </div>

          {/* 3. TABELA DE SERVIÇOS (COM TEMPO, INÍCIO, FIM E VALOR) */}
          <div className="bna-servicos-table-wrap">
            <table className="bna-servicos-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Serviço</th>
                  <th style={{ width: '24%' }}>Profissional</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Duração</th>
                  <th style={{ width: '11%', textAlign: 'center' }}>Início</th>
                  <th style={{ width: '11%', textAlign: 'center' }}>Término</th>
                  <th style={{ width: '16%', minWidth: '120px', textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                      Valor <span style={{ fontSize: '11px', color: '#60a5fa' }} title="Valor editável livremente">✏️</span>
                    </span>
                  </th>
                  {linhasServicos.length > 1 && <th style={{ width: '4%' }}></th>}
                </tr>
              </thead>
              <tbody>
                {linhasServicos.map((linha, index) => {
                  return (
                    <tr key={linha.id}>
                      {/* SERVIÇO */}
                      <td>
                        <select
                          className="bna-input-table bna-table-select"
                          value={linha.servicoId}
                          onChange={(e) => atualizarLinha(index, { servicoId: e.target.value })}
                          required
                        >
                          <option value="">Selecione o serviço...</option>
                          {servicos
                            .filter((s) => s.ativo !== false)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nome} {s.preco ? `· R$ ${Number(s.preco).toFixed(2)}` : ''} ({s.duracaoMinutos || 30}m)
                              </option>
                            ))}
                        </select>
                      </td>

                      {/* PROFISSIONAL INTEGRADO (SEM PREFERÊNCIA OU BARBEIRO) */}
                      <td>
                        <select
                          className="bna-input-table bna-table-select"
                          value={linha.semPreferencia ? '' : linha.profissionalId}
                          onChange={(e) => {
                            const val = e.target.value
                            atualizarLinha(index, {
                              profissionalId: val,
                              semPreferencia: !val,
                            })
                          }}
                        >
                          <option value="">💈 Sem preferência</option>
                          {profissionais
                            .filter((p) => p.ativo !== false)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                👤 {p.nome}
                              </option>
                            ))}
                        </select>
                      </td>

                      {/* DURAÇÃO */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="5"
                          step="5"
                          className="bna-input-table bna-table-input"
                          style={{ textAlign: 'center' }}
                          value={linha.tempo}
                          onChange={(e) => atualizarLinha(index, { tempo: Number(e.target.value) || 30 })}
                          required
                          title="Duração em minutos"
                        />
                      </td>

                      {/* INÍCIO */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="time"
                          className="bna-input-table bna-table-input"
                          style={{ textAlign: 'center' }}
                          value={linha.inicio}
                          onChange={(e) => atualizarLinha(index, { inicio: e.target.value })}
                          required
                        />
                      </td>

                      {/* TÉRMINO (FIM CALCULADO AUTOMATICAMENTE) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="bna-table-time-ro">{linha.fim || '00:00'}</div>
                      </td>

                      {/* VALOR EDITÁVEL COM MÁSCARA / DIGITAÇÃO FLUIDA */}
                      <td style={{ minWidth: '120px', textAlign: 'right' }}>
                        <div className="bna-table-val-wrap" title="Clique para editar o valor do serviço livremente">
                          <span className="bna-val-moeda">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="bna-input-preco-editavel"
                            value={linha.valor === '' ? '' : (linha.valor !== undefined && linha.valor !== null ? linha.valor : 0)}
                            placeholder="0,00"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              atualizarLinha(index, { valor: valStr === '' ? '' : Number(valStr) });
                            }}
                            onBlur={(e) => {
                              const num = Math.max(0, Number(e.target.value) || 0);
                              atualizarLinha(index, { valor: Math.round(num * 100) / 100 });
                            }}
                            title="Clique para editar o valor do serviço livremente"
                            aria-label="Valor do serviço em reais"
                          />
                        </div>
                      </td>

                      {/* EXCLUIR LINHA (SE HOUVER MAIS DE UMA) */}
                      {linhasServicos.length > 1 && (
                        <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}
                            title="Remover este serviço"
                            onClick={() => removerServicoLinha(index)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 4. AÇÕES DA TABELA: ADICIONAR SERVIÇO, FORÇAR ENCAIXE E TOTAL */}
          <div className="bna-servicos-bottom">
            <div className="bna-actions-left">
              <button
                type="button"
                className="bna-btn-adicionar-servico"
                onClick={adicionarServicoLinha}
              >
                <Plus size={16} /> Adicionar serviço
              </button>

              <label className={`bna-encaixe-check ${forcarEncaixe ? 'encaixe-ativo' : ''}`}>
                <input
                  type="checkbox"
                  checked={forcarEncaixe}
                  onChange={(e) => setForcarEncaixe(e.target.checked)}
                />
                ⚡ Forçar Encaixe
              </label>

              <label className={`bna-toggle-chip ${usarPlano ? 'plano-ativo' : ''}`}>
                <input
                  type="checkbox"
                  checked={usarPlano}
                  onChange={(e) => setUsarPlano(e.target.checked)}
                />
                💎 Usar Pacote / Clube VIP
              </label>
            </div>

            <div className="bna-total-box">
              <span className="bna-total-label">Total do Agendamento:</span>
              <strong className="bna-total-valor">
                {Number(totalGeral || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>
          </div>

          {/* 5. OBSERVAÇÕES OPCIONAIS */}
          <div className="bna-obs-section">
            <label className="bna-obs-label">
              📝 Observações do atendimento (opcional):
            </label>
            <textarea
              rows={2}
              className="bna-obs-textarea"
              placeholder="Ex: Cliente prefere barba mais baixa, café expresso, atendimento rápido, etc."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          {/* 6. BOTÕES DO RODAPÉ */}
          <div className="bna-footer">
            <button type="button" className="bna-btn-cancelar" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="bna-btn-salvar"
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : editando ? 'Confirmar remarcação' : 'Salvar agendamento'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
