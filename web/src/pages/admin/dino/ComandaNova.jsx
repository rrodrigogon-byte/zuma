import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import {
  aplicarPreviaPlanos, buscarClientes, filtrarCatalogo, itensParaApi, linkInstagram, nomeRelacao, planosDoServico, totaisCarrinho,
} from './comanda-nova'
import './comanda-nova.css'

const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Campo de cliente com busca: digite o nome, telefone ou e-mail e escolha com o mouse ou o teclado. */
export function BuscaCliente({ clientes, clienteId, onSelecionar, onNomeEventual, nomeEventual = '', permitirEventual = true }) {
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const selecionado = useMemo(() => (clientes || []).find((c) => c.id === clienteId) || null, [clientes, clienteId])
  const resultados = useMemo(() => buscarClientes(clientes, termo), [clientes, termo])
  const caixa = useRef(null)

  useEffect(() => { setAtivo(0) }, [termo])

  function escolher(cliente) {
    onSelecionar(cliente)
    setTermo('')
    setAberto(false)
  }

  function teclado(event) {
    if (!aberto && ['ArrowDown', 'ArrowUp'].includes(event.key)) setAberto(true)
    if (event.key === 'ArrowDown') { event.preventDefault(); setAtivo((i) => Math.min(i + 1, Math.max(0, resultados.length - (permitirEventual ? 0 : 1)))) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setAtivo((i) => Math.max(0, i - 1)) }
    if (event.key === 'Enter' && aberto) {
      event.preventDefault()
      if (resultados[ativo]) escolher(resultados[ativo])
      else if (termo.trim() && permitirEventual) { onNomeEventual(termo.trim()); setTermo(''); setAberto(false) }
    }
    if (event.key === 'Escape') setAberto(false)
  }

  if (selecionado) {
    return (
      <div className="cn-cliente-escolhido">
        <div>
          <strong>{selecionado.nome}</strong>
          <small>{[selecionado.telefone, selecionado.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}</small>
        </div>
        <button type="button" className="cn-link" onClick={() => onSelecionar(null)}>Trocar</button>
      </div>
    )
  }

  return (
    <div className="cn-busca" ref={caixa} onBlur={(event) => { if (!caixa.current?.contains(event.relatedTarget)) setAberto(false) }}>
      <input
        role="combobox" aria-labelledby="cn-rotulo-cliente" aria-expanded={aberto} aria-controls="cn-clientes-lista" aria-autocomplete="list"
        placeholder={nomeEventual ? `Eventual: ${nomeEventual}` : 'Digite o nome, telefone ou e-mail'}
        value={termo} onChange={(event) => { setTermo(event.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)} onKeyDown={teclado} className="cn-input" autoComplete="off"
      />
      {aberto && termo.trim().length >= 2 && (
        <ul id="cn-clientes-lista" role="listbox" className="cn-lista">
          {resultados.map((cliente, indice) => (
            <li key={cliente.id} role="option" aria-selected={indice === ativo}>
              <button type="button" className={indice === ativo ? 'cn-opcao ativa' : 'cn-opcao'} onMouseDown={(event) => event.preventDefault()} onClick={() => escolher(cliente)}>
                <strong>{cliente.nome}</strong>
                <small>{[cliente.telefone, cliente.email].filter(Boolean).join(' · ') || 'Sem contato'}</small>
              </button>
            </li>
          ))}
          {!permitirEventual && !resultados.length && <li className="cn-opcao"><small>Nenhum cliente encontrado.</small></li>}
          {permitirEventual && <li role="option" aria-selected={ativo === resultados.length}>
            <button type="button" className={ativo === resultados.length ? 'cn-opcao ativa' : 'cn-opcao'} onMouseDown={(event) => event.preventDefault()} onClick={() => { onNomeEventual(termo.trim()); setTermo(''); setAberto(false) }}>
              <strong>Usar "{termo.trim()}" como cliente eventual</strong>
              <small>Sem cadastro; com telefone válido o sistema cadastra sozinho.</small>
            </button>
          </li>}
        </ul>
      )}
    </div>
  )
}

/** Resumo do cliente escolhido: planos, preferências, família e redes. */
export function PainelCliente({ cliente, planos, carregando, profissionais = [] }) {
  if (!cliente) return null
  const pref = cliente.preferencias || {}
  const preferido = profissionais.find((p) => p.id === pref.profissionalPreferidoId)
  const itensPref = [
    pref.corte && `Corte: ${pref.corte}`, pref.barba && `Barba: ${pref.barba}`, pref.bebida && `Bebida: ${pref.bebida}`,
    pref.perfumes && `Perfumes: ${pref.perfumes}`, pref.horario && `Horário: ${pref.horario}`, preferido && `Prefere: ${preferido.nome}`,
  ].filter(Boolean)
  const familia = cliente.familia || []
  const instagram = cliente.redesSociais?.instagram
  const linkedin = cliente.redesSociais?.linkedin
  return (
    <div className="cn-painel-cliente">
      <div className="cn-bloco">
        <span className="cn-rotulo">Plano do cliente</span>
        {carregando ? <small>Consultando planos…</small> : !planos.length ? <small>Sem plano ativo. Os serviços serão cobrados avulsos.</small> : planos.map((plano) => (
          <div key={plano.assinaturaId} className={plano.utilizavel ? 'cn-plano ok' : 'cn-plano alerta'}>
            <strong>{plano.planoNome}</strong>
            <small>
              {plano.utilizavel ? `${plano.sessoesRestantes} de ${plano.sessoesNoCiclo} sessão(ões) disponível(is)` : `Não cobre agora: ${plano.motivo}`}
              {' · '}{plano.todosOsServicos ? 'qualquer serviço' : (plano.servicosNomes || []).join(', ')}
            </small>
          </div>
        ))}
      </div>
      {(itensPref.length > 0 || (pref.tags || []).length > 0 || pref.observacoes) && (
        <div className="cn-bloco">
          <span className="cn-rotulo">Preferências</span>
          <div className="cn-chips">{itensPref.map((t) => <span key={t} className="cn-chip">{t}</span>)}{(pref.tags || []).map((t) => <span key={t} className="cn-chip suave">{t}</span>)}</div>
          {pref.observacoes && <small>{pref.observacoes}</small>}
        </div>
      )}
      {(familia.length > 0 || instagram || linkedin) && (
        <div className="cn-bloco">
          <span className="cn-rotulo">Família e redes</span>
          {familia.length > 0 && <small>{familia.map((f) => `${nomeRelacao(f.relacao)}: ${f.nome}`).join(' · ')}</small>}
          <div className="cn-chips">
            {instagram && <a className="cn-chip link" href={linkInstagram(instagram)} target="_blank" rel="noopener noreferrer">Instagram @{instagram}</a>}
            {linkedin && <a className="cn-chip link" href={linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
          </div>
        </div>
      )}
    </div>
  )
}

const ABAS = [['servico', 'Serviços'], ['produto', 'Revenda da barbearia'], ['loja', 'Loja Dino']]

/** Busca de itens nas três origens e lista do que vai entrar na comanda. */
export function SeletorItens({ servicos, produtosRevenda, planos, carrinho, setCarrinho, profissionais, profissionalPadrao }) {
  const [aba, setAba] = useState('servico')
  const [termo, setTermo] = useState('')
  const [loja, setLoja] = useState({ itens: [], carregando: false, erro: '' })

  useEffect(() => {
    if (aba !== 'loja') return undefined
    let cancelado = false
    setLoja((atual) => ({ ...atual, carregando: true, erro: '' }))
    const t = setTimeout(async () => {
      try {
        const resposta = await api.get(`/api/admin/barbearia/comandas/catalogo-loja?q=${encodeURIComponent(termo.trim())}&limite=20`)
        if (!cancelado) setLoja({ itens: resposta?.itens || [], carregando: false, erro: '' })
      } catch (error) {
        if (!cancelado) setLoja({ itens: [], carregando: false, erro: error.message || 'Loja indisponível.' })
      }
    }, 250)
    return () => { cancelado = true; clearTimeout(t) }
  }, [aba, termo])

  const resultados = useMemo(() => {
    if (aba === 'servico') return filtrarCatalogo((servicos || []).filter((s) => s.ativo !== false), termo, ['nome', 'categoria']).map((s) => ({ tipo: 'servico', itemId: s.id, nome: s.nome, preco: Number(s.preco || 0), detalhe: s.duracaoMinutos ? `${s.duracaoMinutos} min` : '' }))
    if (aba === 'produto') return filtrarCatalogo((produtosRevenda || []).filter((p) => p.ativo !== false && Number(p.estoqueAtual || 0) > 0), termo, ['nome', 'sku', 'ean', 'categoria']).map((p) => ({ tipo: 'produto', itemId: p.id, nome: p.nome, preco: Number(p.precoVenda || 0), detalhe: `${p.estoqueAtual} em estoque`, estoque: Number(p.estoqueAtual || 0) }))
    return loja.itens.map((p) => ({ tipo: 'loja', itemId: p.variantId, nome: p.nome, preco: p.preco, detalhe: `${p.disponivel} na loja${p.sku ? ` · ${p.sku}` : ''}`, estoque: p.disponivel, imagem: p.imagem, precoCheio: p.precoCheio }))
  }, [aba, termo, servicos, produtosRevenda, loja.itens])

  function adicionar(item) {
    setCarrinho((atual) => {
      const existente = item.tipo !== 'servico' ? atual.find((linha) => linha.tipo === item.tipo && linha.itemId === item.itemId) : null
      if (existente) {
        if (item.estoque && existente.quantidade >= item.estoque) return atual
        return aplicarPreviaPlanos(planos, atual.map((linha) => linha === existente ? { ...linha, quantidade: linha.quantidade + 1 } : linha))
      }
      return aplicarPreviaPlanos(planos, [...atual, { chave: `${item.tipo}-${item.itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...item, quantidade: 1, usarPlano: true, profissionalId: item.tipo === 'servico' ? profissionalPadrao : '' }])
    })
  }

  function alterar(linha, campos) {
    setCarrinho((atual) => aplicarPreviaPlanos(planos, atual.map((l) => (l === linha ? { ...l, ...campos } : l))))
  }

  return (
    <div className="cn-itens">
      <div className="cn-abas" role="tablist">
        {ABAS.map(([valor, rotulo]) => <button key={valor} type="button" role="tab" aria-selected={aba === valor} className={aba === valor ? 'cn-aba ativa' : 'cn-aba'} onClick={() => { setAba(valor); setTermo('') }}>{rotulo}</button>)}
      </div>
      <input className="cn-input" placeholder={aba === 'loja' ? 'Buscar na loja por nome, SKU ou código de barras' : aba === 'produto' ? 'Buscar produto de revenda' : 'Buscar serviço'} value={termo} onChange={(event) => setTermo(event.target.value)} />
      {aba === 'loja' && loja.erro && <small className="cn-erro">{loja.erro}</small>}
      <div className="cn-resultados">
        {aba === 'loja' && loja.carregando && <small>Consultando a loja…</small>}
        {!resultados.length && !(aba === 'loja' && loja.carregando) && <small>Nada encontrado.</small>}
        {resultados.map((item) => {
          const planosQueCobrem = item.tipo === 'servico' ? planosDoServico(planos, item.itemId) : []
          return (
            <button key={`${item.tipo}-${item.itemId}`} type="button" className="cn-resultado" onClick={() => adicionar(item)}>
              {item.imagem ? <img src={item.imagem} alt="" loading="lazy" /> : <span className="cn-resultado-icone" aria-hidden="true">{item.tipo === 'servico' ? '✂' : '◆'}</span>}
              <span className="cn-resultado-texto"><strong>{item.nome}</strong><small>{item.detalhe}</small>{planosQueCobrem.length > 0 && <small className="cn-tag-plano">No plano: {planosQueCobrem.map((p) => p.planoNome).join(', ')}</small>}</span>
              <span className="cn-resultado-preco">{moeda(item.preco)}{item.precoCheio > item.preco && <s>{moeda(item.precoCheio)}</s>}</span>
            </button>
          )
        })}
      </div>

      <div className="cn-carrinho" aria-label="Itens da comanda">
        {!carrinho.length ? <div className="cn-vazio">Nenhum item. Busque acima e clique para adicionar.</div> : carrinho.map((linha) => {
          const coberto = linha.tipo === 'servico' && linha.planoPrevisto
          const temPlano = linha.tipo === 'servico' && planosDoServico(planos, linha.itemId).length > 0
          return (
            <div key={linha.chave} className={coberto ? 'cn-linha coberta' : 'cn-linha'}>
              <div className="cn-linha-nome">
                <strong>{linha.nome}</strong>
                <small>{linha.tipo === 'servico' ? 'Serviço' : linha.tipo === 'produto' ? 'Revenda da barbearia' : 'Loja Dino'}{coberto ? ` · coberto pelo ${linha.planoNome}` : ''}</small>
              </div>
              {linha.tipo === 'servico' && (
                <select className="cn-input cn-mini" value={linha.profissionalId || ''} onChange={(event) => alterar(linha, { profissionalId: event.target.value })} aria-label="Profissional do serviço">
                  <option value="">Profissional da comanda</option>
                  {profissionais.filter((p) => p.ativo !== false).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              )}
              {temPlano && (
                <label className="cn-usar-plano"><input type="checkbox" style={{ width: 'auto' }} checked={linha.usarPlano !== false} onChange={(event) => alterar(linha, { usarPlano: event.target.checked })} /> Usar o plano</label>
              )}
              <div className="cn-qtd">
                <button type="button" aria-label="Diminuir" disabled={coberto || linha.quantidade <= 1} onClick={() => alterar(linha, { quantidade: linha.quantidade - 1 })}>−</button>
                <span>{linha.quantidade}</span>
                <button type="button" aria-label="Aumentar" disabled={coberto || (linha.estoque && linha.quantidade >= linha.estoque)} onClick={() => alterar(linha, { quantidade: linha.quantidade + 1 })}>+</button>
              </div>
              <div className="cn-valor" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {coberto ? (
                  <><s>{moeda(linha.preco)}</s><strong>Plano</strong></>
                ) : (
                  <>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="cn-input cn-mini"
                      style={{ width: 70, textAlign: 'right', padding: '4px 6px', height: 28 }}
                      value={linha.precoEditado !== undefined ? linha.precoEditado : linha.preco}
                      onChange={(event) => alterar(linha, { precoEditado: event.target.value, preco: Number(event.target.value || 0) })}
                      aria-label={`Preço unitário para ${linha.nome}`}
                    />
                  </>
                )}
              </div>
              <button type="button" className="cn-remover" aria-label={`Remover ${linha.nome}`} onClick={() => setCarrinho((atual) => aplicarPreviaPlanos(planos, atual.filter((l) => l !== linha)))}>×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function usePlanosDoCliente(clienteId) {
  const [estado, setEstado] = useState({ planos: [], carregando: false })
  useEffect(() => {
    if (!clienteId) { setEstado({ planos: [], carregando: false }); return undefined }
    let cancelado = false
    setEstado({ planos: [], carregando: true })
    api.get(`/api/admin/barbearia/clientes/${encodeURIComponent(clienteId)}/planos`)
      .then((r) => { if (!cancelado) setEstado({ planos: r?.planos || [], carregando: false }) })
      .catch(() => { if (!cancelado) setEstado({ planos: [], carregando: false }) })
    return () => { cancelado = true }
  }, [clienteId])
  return estado
}

/** Tela completa de abertura da comanda. */
export default function ComandaNova({ clientes, profissionais, servicos, produtosRevenda, agendamentoId = '', clienteInicial = '', nomeInicial = '', telefoneInicial = '', profissionalInicial = '', servicoInicialId = '', observacoesIniciais = '', onCancelar, onCriada, toast }) {
  const [clienteId, setClienteId] = useState(clienteInicial)
  const [nomeEventual, setNomeEventual] = useState(clienteInicial ? '' : nomeInicial)
  const [telefoneEventual, setTelefoneEventual] = useState(clienteInicial ? '' : telefoneInicial)
  const [profissionalId, setProfissionalId] = useState(profissionalInicial)
  // Vindo de um agendamento, o serviço agendado já entra na comanda.
  const [carrinho, setCarrinho] = useState(() => {
    const servico = agendamentoId && servicoInicialId ? (servicos || []).find((s) => s.id === servicoInicialId) : null
    return servico ? [{ chave: `servico-${servico.id}-inicial`, tipo: 'servico', itemId: servico.id, nome: servico.nome, preco: Number(servico.preco || 0), quantidade: 1, usarPlano: true, profissionalId: profissionalInicial }] : []
  })
  const [extras, setExtras] = useState({ gorjeta: '', desconto: '', descontoMotivo: '', observacoes: observacoesIniciais })
  const [salvando, setSalvando] = useState(false)
  const cliente = (clientes || []).find((c) => c.id === clienteId) || null
  const { planos, carregando } = usePlanosDoCliente(clienteId)

  useEffect(() => { setCarrinho((atual) => aplicarPreviaPlanos(planos, atual)) }, [planos])
  const totais = totaisCarrinho(carrinho, extras)

  async function salvar(event) {
    event.preventDefault()
    if (!carrinho.length) { toast?.('Inclua ao menos um item na comanda.', 'error'); return }
    if (totais.desconto > 0 && !extras.descontoMotivo.trim()) { toast?.('Informe o motivo do desconto.', 'error'); return }
    setSalvando(true)
    try {
      const resposta = await api.post('/api/admin/barbearia/comandas', {
        clienteId: cliente?.id || '', clienteNome: cliente?.nome || nomeEventual, clienteTelefone: cliente?.telefone || telefoneEventual,
        profissionalId, agendamentoId, gorjeta: Number(extras.gorjeta || 0), desconto: Number(extras.desconto || 0), descontoMotivo: extras.descontoMotivo, observacoes: extras.observacoes,
        itens: itensParaApi(carrinho, profissionalId),
      })
      await onCriada?.(resposta?.comanda, resposta?.avisos || [])
    } catch (error) {
      toast?.(error.message || 'Comanda não aberta.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="cn-form">
      <div className="cn-aviso"><strong>Fluxo seguro</strong><span>Abrir a comanda não recebe pagamento nem baixa estoque. Serviços do plano do cliente entram abatidos; o uso do plano só é registrado no fechamento.</span></div>
      <div className="cn-topo">
        {/* div (e não label): um label repassaria o clique para o botão "Trocar" e desfaria a escolha. */}
        <div className="cn-campo" role="group" aria-labelledby="cn-rotulo-cliente"><span id="cn-rotulo-cliente">Cliente</span>
          <BuscaCliente clientes={clientes} clienteId={clienteId} nomeEventual={nomeEventual} onSelecionar={(c) => { setClienteId(c?.id || ''); setNomeEventual('') }} onNomeEventual={(nome) => { setClienteId(''); setNomeEventual(nome) }} />
        </div>
        {!cliente && nomeEventual && <label className="cn-campo"><span>Telefone do eventual (opcional)</span><input className="cn-input" inputMode="tel" value={telefoneEventual} onChange={(e) => setTelefoneEventual(e.target.value)} placeholder="(65) 9 9999-9999" /></label>}
        <label className="cn-campo"><span>Profissional responsável</span>
          <select className="cn-input" value={profissionalId} onChange={(event) => setProfissionalId(event.target.value)}>
            <option value="">Sem profissional atribuído</option>
            {(profissionais || []).filter((p) => p.ativo !== false).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
      </div>
      <PainelCliente cliente={cliente} planos={planos} carregando={carregando} profissionais={profissionais} />
      <SeletorItens servicos={servicos} produtosRevenda={produtosRevenda} planos={planos} carrinho={carrinho} setCarrinho={setCarrinho} profissionais={profissionais} profissionalPadrao={profissionalId} />
      <div className="cn-rodape">
        <div className="cn-extras">
          <label className="cn-campo"><span>Gorjeta (R$)</span><input className="cn-input" type="number" min="0" step="0.01" value={extras.gorjeta} onChange={(e) => setExtras((a) => ({ ...a, gorjeta: e.target.value }))} /></label>
          <label className="cn-campo"><span>Desconto (R$)</span><input className="cn-input" type="number" min="0" step="0.01" value={extras.desconto} onChange={(e) => setExtras((a) => ({ ...a, desconto: e.target.value }))} /></label>
          {Number(extras.desconto) > 0 && <label className="cn-campo"><span>Motivo do desconto</span><input className="cn-input" value={extras.descontoMotivo} onChange={(e) => setExtras((a) => ({ ...a, descontoMotivo: e.target.value }))} /></label>}
          <label className="cn-campo cn-largo"><span>Observações</span><textarea className="cn-input" rows={2} value={extras.observacoes} onChange={(e) => setExtras((a) => ({ ...a, observacoes: e.target.value }))} /></label>
        </div>
        <dl className="cn-totais">
          <div><dt>Itens pela tabela</dt><dd>{moeda(totais.tabela)}</dd></div>
          {totais.abatido > 0 && <div className="cn-abatido"><dt>Abatido pelo plano</dt><dd>− {moeda(totais.abatido)}</dd></div>}
          {totais.desconto > 0 && <div><dt>Desconto</dt><dd>− {moeda(totais.desconto)}</dd></div>}
          {Number(extras.gorjeta) > 0 && <div><dt>Gorjeta</dt><dd>{moeda(Number(extras.gorjeta))}</dd></div>}
          <div className="cn-total"><dt>Total a receber</dt><dd>{moeda(totais.total)}</dd></div>
        </dl>
      </div>
      <div className="cn-acoes">
        <button type="button" className="cn-botao secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="cn-botao" disabled={salvando || !carrinho.length}>{salvando ? 'Abrindo…' : `Abrir comanda${carrinho.length ? ` · ${carrinho.length} item(ns)` : ''}`}</button>
      </div>
    </form>
  )
}

/** Adicionar itens a uma comanda já aberta, com a mesma busca e o mesmo plano. */
export function AdicionarItensComanda({ comanda, clientes, profissionais, servicos, produtosRevenda, onAdicionados, toast }) {
  const [carrinho, setCarrinho] = useState([])
  const [salvando, setSalvando] = useState(false)
  const { planos } = usePlanosDoCliente(comanda?.clienteId || '')
  useEffect(() => { setCarrinho((atual) => aplicarPreviaPlanos(planos, atual)) }, [planos])
  async function salvar() {
    if (!carrinho.length) return
    setSalvando(true)
    try {
      const resposta = await api.post(`/api/admin/barbearia/comandas/${comanda.id}/itens`, { itens: itensParaApi(carrinho, comanda.profissionalId) })
      setCarrinho([])
      await onAdicionados?.(resposta?.comanda, resposta?.avisos || [])
    } catch (error) {
      toast?.(error.message || 'Itens não adicionados.', 'error')
    } finally {
      setSalvando(false)
    }
  }
  return (
    <div className="cn-form cn-compacto">
      <SeletorItens servicos={servicos} produtosRevenda={produtosRevenda} planos={planos} carrinho={carrinho} setCarrinho={setCarrinho} profissionais={profissionais} profissionalPadrao={comanda?.profissionalId || ''} />
      {carrinho.length > 0 && <div className="cn-acoes"><button type="button" className="cn-botao" disabled={salvando} onClick={salvar}>{salvando ? 'Adicionando…' : `Adicionar ${carrinho.length} item(ns) à comanda`}</button></div>}
    </div>
  )
}
