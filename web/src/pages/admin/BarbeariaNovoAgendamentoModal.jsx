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
  salvando = false,
}) {
  if (!aberto) return null

  // Data do agendamento
  const [dataAgenda, setDataAgenda] = useState(dataInicial || new Date().toISOString().slice(0, 10))
  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false)
  const [recorrencia, setRecorrencia] = useState('nenhuma') // 'nenhuma', 'semanal', 'quinzenal', 'mensal'

  // Busca e seleção de cliente
  const [tipoBusca, setTipoBusca] = useState('nome') // 'nome' ou 'telefone'
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
      const ini = agendamentoEdicao.hora || horaInicial || '10:00'
      return [{
        id: 'linha-0',
        servicoId: agendamentoEdicao.servicoId || servicoPadrao.id,
        profissionalId: agendamentoEdicao.profissionalId || profissionalInicialId || '',
        semPreferencia: !agendamentoEdicao.profissionalId,
        tempo: dur,
        inicio: ini,
        fim: calcularHoraFim(ini, dur),
        valor: Number(agendamentoEdicao.valor || 0),
      }]
    }
    const ini = horaInicial || '10:00'
    const dur = servicoPadrao.duracaoMinutos || 30
    return [{
      id: 'linha-0',
      servicoId: servicoInicialId || servicoPadrao.id,
      profissionalId: profissionalInicialId || '',
      semPreferencia: !profissionalInicialId,
      tempo: dur,
      inicio: ini,
      fim: calcularHoraFim(ini, dur),
      valor: Number(servicoPadrao.preco || 0),
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
      // Quando não há termo digitado: exibe os primeiros 60 clientes ordenados alfabeticamente
      return lista.slice(0, 60)
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
      }

      if (matches.length >= 60) break
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
      linhasServicos: linhasServicos.map((l) => ({
        servicoId: l.servicoId,
        profissionalId: l.semPreferencia ? '' : l.profissionalId,
        duracaoMinutos: l.tempo,
        horaInicio: l.inicio,
        horaFim: l.fim,
        valor: l.valor,
      })),
      // Propriedades retrocompatíveis para a primeira linha de serviço
      servicoId: linhasServicos[0]?.servicoId,
      profissionalId: linhasServicos[0]?.semPreferencia ? '' : linhasServicos[0]?.profissionalId,
      hora: linhasServicos[0]?.inicio,
      duracaoMinutos: linhasServicos[0]?.tempo,
      valor: linhasServicos[0]?.valor,
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

        {/* CORPO DO FORMULÁRIO */}
        <form onSubmit={submeterAgendamento} className="bna-body">
          {/* 1. SELEÇÃO DE CLIENTE */}
          <div className="bna-cliente-section" ref={dropdownRef}>
            <label className="bna-cliente-label">
              <User size={15} color="#3b82f6" /> Cliente:
            </label>

            {clienteSelecionado ? (
              <div className="bna-cliente-selecionado-card">
                <div>
                  <strong style={{ fontSize: 15, color: '#ffffff', display: 'block' }}>
                    {clienteSelecionado.nome}
                  </strong>
                  <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'monospace' }}>
                    {clienteSelecionado.telefone ? formatarTelefoneBR(clienteSelecionado.telefone) : 'Sem telefone informado'}
                  </span>
                </div>
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
            ) : (
              <>
                <div className="bna-cliente-bar">
                  {/* Seletor Nome / Telefone (idêntico ao print) */}
                  <select
                    className="bna-tipo-select"
                    value={tipoBusca}
                    onChange={(e) => {
                      setTipoBusca(e.target.value)
                      setDropdownAberto(true)
                      inputBuscaRef.current?.focus()
                    }}
                  >
                    <option value="nome">Nome ▾</option>
                    <option value="telefone">Telefone ▾</option>
                  </select>

                  {/* Input de Busca */}
                  <div className="bna-search-box">
                    <input
                      ref={inputBuscaRef}
                      type="text"
                      className="bna-search-input"
                      placeholder={tipoBusca === 'nome' ? 'Pesquisar Cliente...' : 'Digite o telefone...'}
                      value={termoBusca}
                      onChange={(e) => {
                        setTermoBusca(e.target.value)
                        setDropdownAberto(true)
                      }}
                      onFocus={() => setDropdownAberto(true)}
                      onKeyDown={(e) => {
                        if (!dropdownAberto && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
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

                {/* DROPDOWN DINÂMICO QUE ABRE IMEDIATAMENTE */}
                {dropdownAberto && (
                  <div className="bna-dropdown-clientes">
                    <div className="bna-dropdown-header">
                      {termoBusca.trim()
                        ? `${clientesFiltrados.length} cliente(s) encontrado(s)`
                        : `Clientes cadastrados (${clientes.length || 0}) — selecione na lista ou digite:`}
                    </div>

                    {clientesFiltrados.length === 0 ? (
                      <div style={{ padding: '14px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                        Nenhum cliente encontrado para "{termoBusca}".
                        <button
                          type="button"
                          style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => {
                            if (tipoBusca === 'nome') setNovoClienteNome(termoBusca)
                            else setNovoClienteTelefone(termoBusca)
                            setFormCadastroAberto(true)
                            setDropdownAberto(false)
                          }}
                        >
                          + Cadastrar "{termoBusca}" agora
                        </button>
                      </div>
                    ) : (
                      clientesFiltrados.map((cli, idx) => (
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
                      ))
                    )}
                  </div>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>Data:</span>
              <input
                type="date"
                className="bna-input-data"
                value={dataAgenda}
                onChange={(e) => setDataAgenda(e.target.value)}
                required
              />
            </div>

            <button
              type="button"
              className="bna-recorrencia-link"
              onClick={() => setRecorrenciaAberta((v) => !v)}
            >
              Recorrência...
            </button>

            {recorrenciaAberta && (
              <select
                className="bna-input-data"
                style={{ fontSize: 13, padding: '6px 10px' }}
                value={recorrencia}
                onChange={(e) => setRecorrencia(e.target.value)}
              >
                <option value="nenhuma">Sem repetição (único)</option>
                <option value="semanal">Semanal (toda semana neste horário)</option>
                <option value="quinzenal">Quinzenal (a cada 15 dias)</option>
                <option value="mensal">Mensal (todo mês)</option>
              </select>
            )}
          </div>

          {/* 3. TABELA DE SERVIÇOS (COM TEMPO, INÍCIO, FIM E VALOR) */}
          <div className="bna-servicos-table-wrap">
            <table className="bna-servicos-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Serviço</th>
                  <th style={{ width: '28%' }}>Profissional</th>
                  <th style={{ width: '10%' }}>Tempo</th>
                  <th style={{ width: '12%' }}>Início</th>
                  <th style={{ width: '12%' }}>Fim</th>
                  <th style={{ width: '10%' }}>Valor (R$)</th>
                  {linhasServicos.length > 1 && <th style={{ width: '5%' }}></th>}
                </tr>
              </thead>
              <tbody>
                {linhasServicos.map((linha, index) => {
                  return (
                    <tr key={linha.id}>
                      {/* SERVIÇO */}
                      <td>
                        <select
                          className="bna-input-table"
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

                      {/* PROFISSIONAL + SEM PREFERÊNCIA */}
                      <td>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <select
                            className="bna-input-table"
                            disabled={linha.semPreferencia}
                            value={linha.profissionalId}
                            onChange={(e) => atualizarLinha(index, { profissionalId: e.target.value })}
                          >
                            <option value="">Sem profissional definido</option>
                            {profissionais
                              .filter((p) => p.ativo !== false)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nome}
                                </option>
                              ))}
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={linha.semPreferencia}
                              onChange={(e) => {
                                const checked = e.target.checked
                                atualizarLinha(index, {
                                  semPreferencia: checked,
                                  profissionalId: checked ? '' : linha.profissionalId,
                                })
                              }}
                            />
                            Sem Preferência
                          </label>
                        </div>
                      </td>

                      {/* TEMPO (MINUTOS) */}
                      <td>
                        <input
                          type="number"
                          min="5"
                          step="5"
                          className="bna-input-table"
                          value={linha.tempo}
                          onChange={(e) => atualizarLinha(index, { tempo: Number(e.target.value) || 30 })}
                          required
                        />
                      </td>

                      {/* INÍCIO */}
                      <td>
                        <input
                          type="time"
                          className="bna-input-table"
                          value={linha.inicio}
                          onChange={(e) => atualizarLinha(index, { inicio: e.target.value })}
                          required
                        />
                      </td>

                      {/* FIM (CALCULADO AUTOMATICAMENTE) */}
                      <td>
                        <input
                          type="time"
                          className="bna-input-table"
                          value={linha.fim}
                          readOnly
                          style={{ background: '#13161f', color: '#94a3b8', cursor: 'default' }}
                        />
                      </td>

                      {/* VALOR (R$) */}
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="bna-input-table"
                          value={linha.valor}
                          onChange={(e) => atualizarLinha(index, { valor: Number(e.target.value) || 0 })}
                        />
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
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <button
                type="button"
                className="bna-btn-adicionar-servico"
                onClick={adicionarServicoLinha}
              >
                <Plus size={16} /> Adicionar serviço
              </button>

              <label className="bna-encaixe-check">
                <input
                  type="checkbox"
                  checked={forcarEncaixe}
                  onChange={(e) => setForcarEncaixe(e.target.checked)}
                />
                Forçar Encaixe
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={usarPlano}
                  onChange={(e) => setUsarPlano(e.target.checked)}
                />
                Agendar pelo Pacote / Clube VIP
              </label>
            </div>

            <div className="bna-total-box">
              <span>Total (R$):</span>
              <strong className="bna-total-valor">
                {Number(totalGeral || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>
          </div>

          {/* 5. OBSERVAÇÕES OPCIONAIS */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
              Observações do atendimento:
            </label>
            <textarea
              rows={2}
              className="bna-input-table"
              style={{ resize: 'vertical' }}
              placeholder="Ex: Cliente prefere barba mais baixa, café expresso, etc."
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
      </div>
    </div>
  )
}
