import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import {
  aplicarPreviaPlanos, buscarClientes, filtrarCatalogo, itensParaApi, linkInstagram, nomeRelacao, planosDoServico, totaisCarrinho,
} from './comanda-nova'
import './comanda-nova.css'

const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Campo de cliente com busca: digite o nome, telefone ou e-mail e escolha com o mouse ou o teclado. */
export function BuscaCliente({ clientes, clienteId, onSelecionar, onNomeEventual, onAbrirCadastro, nomeEventual = '', permitirEventual = true }) {
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
          <strong
            style={onAbrirCadastro ? { cursor: 'pointer', textDecoration: 'underline' } : {}}
            onClick={() => onAbrirCadastro?.(selecionado)}
            title="Acessar cadastro e ficha do cliente"
          >
            {selecionado.nome}
          </strong>
          <small>{[selecionado.telefone, selecionado.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}</small>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onAbrirCadastro && (
            <button
              type="button"
              className="cn-link"
              style={{
                fontWeight: 700,
                color: 'var(--accent, #1d4ed8)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                background: 'rgba(59, 130, 246, 0.08)',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
              onClick={() => onAbrirCadastro(selecionado)}
              title="Acessar / editar cadastro completo do cliente"
            >
              👤 Cadastro do cliente
            </button>
          )}
          <button type="button" className="cn-link" onClick={() => onSelecionar(null)}>Trocar</button>
        </div>
      </div>
    )
  }

  if (nomeEventual) {
    return (
      <div className="cn-cliente-escolhido">
        <div>
          <strong
            style={onAbrirCadastro ? { cursor: 'pointer', textDecoration: 'underline' } : {}}
            onClick={() => onAbrirCadastro?.({ nome: nomeEventual })}
            title="Acessar / vincular cadastro do cliente"
          >
            {nomeEventual}
          </strong>
          <small>Cliente eventual (sem cadastro vinculado)</small>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onAbrirCadastro && (
            <button
              type="button"
              className="cn-link"
              style={{
                fontWeight: 700,
                color: 'var(--accent, #1d4ed8)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                background: 'rgba(59, 130, 246, 0.08)',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
              onClick={() => onAbrirCadastro({ nome: nomeEventual })}
              title="Criar cadastro ou abrir ficha 360"
            >
              👤 Cadastro do cliente
            </button>
          )}
          <button type="button" className="cn-link" onClick={() => { onNomeEventual(''); onSelecionar(null); }}>Trocar</button>
        </div>
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

const BEBIDAS_PADRAO_DINO = [
  { itemId: 'beb-hein-330', nome: 'Cerveja Heineken Long Neck 330ml', preco: 12.00, detalhe: '330ml gelada · Long Neck', icone: '🍺' },
  { itemId: 'beb-cor-330', nome: 'Cerveja Corona Extra Long Neck 330ml', preco: 14.00, detalhe: '330ml gelada · com limão', icone: '🍺' },
  { itemId: 'beb-bud-330', nome: 'Cerveja Budweiser Long Neck 330ml', preco: 10.00, detalhe: '330ml gelada · Long Neck', icone: '🍺' },
  { itemId: 'beb-ste-330', nome: 'Cerveja Stella Artois Long Neck 330ml', preco: 12.00, detalhe: '330ml gelada · Puro Malte', icone: '🍺' },
  { itemId: 'beb-coca-350', nome: 'Refrigerante Coca-Cola Lata 350ml', preco: 7.00, detalhe: 'Lata 350ml gelada', icone: '🥤' },
  { itemId: 'beb-cocaz-350', nome: 'Refrigerante Coca-Cola Zero Lata 350ml', preco: 7.00, detalhe: 'Lata 350ml sem açúcar', icone: '🥤' },
  { itemId: 'beb-guar-350', nome: 'Refrigerante Guaraná Antarctica 350ml', preco: 7.00, detalhe: 'Lata 350ml gelada', icone: '🥤' },
  { itemId: 'beb-agua-500', nome: 'Água Mineral sem Gás 500ml', preco: 5.00, detalhe: 'Garrafa 500ml', icone: '💧' },
  { itemId: 'beb-aguag-500', nome: 'Água Mineral com Gás 500ml', preco: 6.00, detalhe: 'Garrafa 500ml', icone: '🫧' },
  { itemId: 'beb-redb-250', nome: 'Energético Red Bull 250ml', preco: 16.00, detalhe: 'Lata 250ml', icone: '⚡' },
  { itemId: 'beb-cafe-01', nome: 'Café Expresso Gourmet', preco: 5.00, detalhe: 'Xícara moída na hora', icone: '☕' },
  { itemId: 'beb-dose-01', nome: 'Dose Whisky / Destilado Especial', preco: 25.00, detalhe: 'Dose 50ml no copo com gelo', icone: '🥃' },
];

const PERFUMARIA_DECANTS_PADRAO_DINO = [
  { itemId: 'perf-dec-khamrah', nome: 'Khamrah Lattafa - Decant Oficial 10ml (~150 borrifadas)', preco: 79.00, comissaoBarbeiro: 7.90, detalhe: 'Oriental Especiado · Canela, Tâmaras e Baunilha · Sucesso em MT', icone: '✨', categoria: 'Decant 10ml' },
  { itemId: 'perf-fras-khamrah', nome: 'Khamrah Lattafa EDP 100ml - Frasco Lacrado Original', preco: 490.00, comissaoBarbeiro: 49.00, detalhe: 'Frasco Lacrado 100ml · Selo KyttoIA Originalidade', icone: '👑', categoria: 'Frasco Lacrado' },
  { itemId: 'perf-dec-clubnuit', nome: 'Club de Nuit Intense Man - Decant Oficial 10ml', preco: 89.00, comissaoBarbeiro: 8.90, detalhe: 'Chipre Frutado · O Rei dos Elogios em Tangará · Limão e Bétula', icone: '✨', categoria: 'Decant 10ml' },
  { itemId: 'perf-fras-clubnuit', nome: 'Club de Nuit Intense Man EDT 105ml - Frasco Lacrado', preco: 520.00, comissaoBarbeiro: 52.00, detalhe: 'Frasco Lacrado 105ml Armaf · Projeção Marcante', icone: '👑', categoria: 'Frasco Lacrado' },
  { itemId: 'perf-dec-asad', nome: 'Asad Lattafa - Decant Oficial 10ml (~150 borrifadas)', preco: 79.00, comissaoBarbeiro: 7.90, detalhe: 'Âmbar Especiado · Pimenta Preta, Café e Tabaco · Noites e Rodeio', icone: '✨', categoria: 'Decant 10ml' },
  { itemId: 'perf-fras-asad', nome: 'Asad Lattafa EDP 100ml - Frasco Lacrado Original', preco: 480.00, comissaoBarbeiro: 48.00, detalhe: 'Frasco Lacrado 100ml · Clone de Luxo do Elixir', icone: '👑', categoria: 'Frasco Lacrado' },
  { itemId: 'perf-dec-hacivat', nome: 'Nishane Hacivat Extrait - Decant Oficial 10ml', preco: 139.00, comissaoBarbeiro: 13.90, detalhe: 'Nicho Puro · Extrait de Parfum 10ml · Abacaxi, Musgo e Cedro · Fixação 14h+', icone: '🌟', categoria: 'Decant 10ml' },
  { itemId: 'perf-fras-hacivat', nome: 'Nishane Hacivat Extrait 100ml - Frasco de Colecionador', preco: 1690.00, comissaoBarbeiro: 169.00, detalhe: 'Alta Perfumaria Turca · Joia da Coleção Dino', icone: '💎', categoria: 'Frasco Lacrado' },
  { itemId: 'perf-dec-elysium', nome: 'Roja Elysium Parfum Cologne - Decant Oficial 10ml', preco: 139.00, comissaoBarbeiro: 13.90, detalhe: 'Alta Perfumaria Britânica · Frescor Cítrico Aristocrático para 38°C', icone: '🌟', categoria: 'Decant 10ml' },
  { itemId: 'perf-dec-sauvage', nome: 'Dior Sauvage Elixir - Decant Oficial 10ml', preco: 129.00, comissaoBarbeiro: 12.90, detalhe: 'Concentração Máxima · Lavanda e Alcaçuz · O Ícone Masculino', icone: '🌟', categoria: 'Decant 10ml' },
  { itemId: 'perf-dec-aventus', nome: 'Creed Aventus EDP - Decant Oficial 10ml', preco: 139.00, comissaoBarbeiro: 13.90, detalhe: 'O Rei Supremo da Perfumaria Mundial · Abacaxi Real e Bétula', icone: '👑', categoria: 'Decant 10ml' },
  { itemId: 'perf-combo-corte-decant', nome: 'Combo Corte VIP + Decant 10ml à Escolha', preco: 135.00, comissaoBarbeiro: 15.00, detalhe: 'Corte Visagista Completo + Borrifada de Degustação + Leve 1 Decant 10ml', icone: '🔥', categoria: 'Combo Especial' }
];

const ABAS = [
  ['perfumaria', '✨ Perfumaria & Decants LTK'],
  ['bebidas', '🍺 Bebidas & Bar'],
  ['servico', 'Serviços'],
  ['pacote', 'Pacotes e Planos'],
  ['produto', 'Produtos de Revenda'],
  ['loja', 'Loja Dino'],
  ['outro', 'Outro item / Taxa'],
]

/** Busca de itens em serviços, pacotes, revenda, loja e itens personalizados/avulsos. */
export function SeletorItens({ servicos, produtosRevenda, planos, catalogoPlanos = [], carrinho, setCarrinho, profissionais, profissionalPadrao }) {
  const [aba, setAba] = useState('servico')
  const [termo, setTermo] = useState('')
  const [loja, setLoja] = useState({ itens: [], carregando: false, erro: '' })
  const [listaPlanos, setListaPlanos] = useState(catalogoPlanos || [])
  const [outroNome, setOutroNome] = useState('')
  const [outroValor, setOutroValor] = useState('')
  const [outroQtd, setOutroQtd] = useState(1)
  const [outroProf, setOutroProf] = useState('')
  const [outroObs, setOutroObs] = useState('')

  useEffect(() => {
    if (catalogoPlanos?.length) { setListaPlanos(catalogoPlanos); return }
    let cancelado = false
    api.get('/api/admin/barbearia/planos')
      .then((r) => {
        if (!cancelado) {
          const dados = Array.isArray(r?.planos) ? r.planos : Array.isArray(r) ? r : []
          if (dados.length) setListaPlanos(dados)
        }
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [catalogoPlanos])

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
    if (aba === 'perfumaria') {
      const cadastradas = (produtosRevenda || []).filter((p) => {
        if (p.ativo === false) return false;
        const cat = String(p.categoria || '').toLowerCase();
        const n = String(p.nome || '').toLowerCase();
        return cat.includes('perfum') || cat.includes('decant') || cat.includes('árabe') || cat.includes('arabe') || /khamrah|club de nuit|asad|hacivat|elysium|aventus|sauvage|lattafa|armaf|nishane|creed|roja/.test(n);
      });
      if (cadastradas.length > 0) {
        return filtrarCatalogo(cadastradas, termo, ['nome', 'categoria', 'sku']).map((p) => ({
          tipo: 'produto',
          itemId: p.id,
          nome: p.nome,
          preco: Number(p.precoVenda || 0),
          detalhe: `${p.estoqueAtual !== undefined ? p.estoqueAtual : 'Livre'} em estoque · Perfumaria & Decants LTK (Comissão Barbeiro: 10%)`,
          estoque: p.estoqueAtual !== undefined ? Number(p.estoqueAtual) : undefined,
        }));
      }
      return filtrarCatalogo(PERFUMARIA_DECANTS_PADRAO_DINO, termo, ['nome', 'detalhe', 'categoria']).map((b) => ({
        tipo: 'produto',
        itemId: b.itemId,
        nome: b.nome,
        preco: b.preco,
        detalhe: `${b.detalhe} · Comissão Barbeiro: R$ ${b.comissaoBarbeiro.toFixed(2).replace('.', ',')}`,
      }));
    }
    if (aba === 'bebidas') {
      const cadastradas = (produtosRevenda || []).filter((p) => {
        if (p.ativo === false) return false;
        const cat = String(p.categoria || '').toLowerCase();
        const n = String(p.nome || '').toLowerCase();
        return cat.includes('bebida') || cat.includes('bar') || /cerveja|heineken|corona|budweiser|stella|coca|guarana|agua|refri|red bull|energetico|cafe|dose|whisky|gin|chopp/.test(n);
      });
      if (cadastradas.length > 0) {
        return filtrarCatalogo(cadastradas, termo, ['nome', 'categoria', 'sku']).map((p) => ({
          tipo: 'produto',
          itemId: p.id,
          nome: p.nome,
          preco: Number(p.precoVenda || 0),
          detalhe: `${p.estoqueAtual !== undefined ? p.estoqueAtual : 'Livre'} em estoque · Bebidas & Bar`,
          estoque: p.estoqueAtual !== undefined ? Number(p.estoqueAtual) : undefined,
        }));
      }
      return filtrarCatalogo(BEBIDAS_PADRAO_DINO, termo, ['nome', 'detalhe']).map((b) => ({
        tipo: 'produto',
        itemId: b.itemId,
        nome: b.nome,
        preco: b.preco,
        detalhe: b.detalhe,
      }));
    }
    if (aba === 'servico') return filtrarCatalogo((servicos || []).filter((s) => s.ativo !== false), termo, ['nome', 'categoria']).map((s) => ({ tipo: 'servico', itemId: s.id, nome: s.nome, preco: Number(s.preco || 0), detalhe: s.duracaoMinutos ? `${s.duracaoMinutos} min` : '' }))
    if (aba === 'pacote') {
      const basePlanos = (listaPlanos || []).filter((p) => p.ativo !== false)
      return filtrarCatalogo(basePlanos, termo, ['nome', 'descricao', 'categoriaPlano']).map((p) => ({
        tipo: 'pacote',
        itemId: p.id,
        planoId: p.id,
        nome: p.nome,
        preco: Number(p.preco || 0),
        detalhe: `${p.sessoesIncluidas || 4} procedimentos · ${p.validadeDias || 30} dias`,
        categoria: p.categoriaPlano || 'Pacote',
        profissionalId: p.profissionalId || '',
      }))
    }
    if (aba === 'produto') return filtrarCatalogo((produtosRevenda || []).filter((p) => p.ativo !== false), termo, ['nome', 'sku', 'ean', 'codigoBarras', 'categoria']).map((p) => ({ tipo: 'produto', itemId: p.id, nome: p.nome, preco: Number(p.precoVenda || 0), detalhe: Number(p.estoqueAtual || 0) > 0 ? `${p.estoqueAtual} em estoque` : 'Estoque a confirmar (0 un)', estoque: Number(p.estoqueAtual || 0) }))
    return loja.itens.map((p) => ({ tipo: 'loja', itemId: p.variantId, nome: p.nome, preco: p.preco, detalhe: `${p.disponivel} na loja${p.sku ? ` · ${p.sku}` : ''}`, estoque: p.disponivel, imagem: p.imagem, precoCheio: p.precoCheio }))
  }, [aba, termo, servicos, produtosRevenda, listaPlanos, loja.itens])

  function adicionar(item) {
    setCarrinho((atual) => {
      const existente = (item.tipo !== 'servico' && item.tipo !== 'pacote' && item.tipo !== 'outro') ? atual.find((linha) => linha.tipo === item.tipo && linha.itemId === item.itemId) : null
      if (existente) {
        if (item.estoque && existente.quantidade >= item.estoque) return atual
        return aplicarPreviaPlanos(planos, atual.map((linha) => linha === existente ? { ...linha, quantidade: linha.quantidade + 1 } : linha))
      }
      return aplicarPreviaPlanos(planos, [...atual, {
        chave: `${item.tipo}-${item.itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...item,
        quantidade: Math.max(1, Number(item.quantidade || 1)),
        usarPlano: true,
        profissionalId: item.profissionalId || profissionalPadrao || '',
      }])
    })
  }

  function adicionarOutroItem(e) {
    e?.preventDefault()
    if (!outroNome.trim()) return
    const valor = Number(String(outroValor).replace(',', '.') || 0)
    adicionar({
      tipo: 'outro',
      itemId: `outro-${Date.now()}`,
      nome: outroNome.trim(),
      preco: valor,
      quantidade: Math.max(1, Number(outroQtd || 1)),
      profissionalId: outroProf || profissionalPadrao || '',
      detalhe: outroObs.trim() || 'Lançamento avulso / taxa',
      obs: outroObs.trim(),
    })
    setOutroNome('')
    setOutroValor('')
    setOutroQtd(1)
    setOutroObs('')
  }

  function alterar(linha, campos) {
    setCarrinho((atual) => aplicarPreviaPlanos(planos, atual.map((l) => (l === linha ? { ...l, ...campos } : l))))
  }

  return (
    <div className="cn-itens">
      <div className="cn-abas" role="tablist">
        {ABAS.map(([valor, rotulo]) => <button key={valor} type="button" role="tab" aria-selected={aba === valor} className={aba === valor ? 'cn-aba ativa' : 'cn-aba'} onClick={() => { setAba(valor); setTermo('') }}>{rotulo}</button>)}
      </div>
      {aba === 'outro' ? (
        <div style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--card)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>Adicionar Item Avulso / Taxa / Personalizado</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) 120px 80px', gap: 8 }}>
            <input
              className="cn-input"
              placeholder="Descrição (ex: Taxa de deslocamento, Barba Terapia, etc.)"
              value={outroNome}
              onChange={(e) => setOutroNome(e.target.value)}
            />
            <input
              className="cn-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor (R$)"
              value={outroValor}
              onChange={(e) => setOutroValor(e.target.value)}
            />
            <input
              className="cn-input"
              type="number"
              min="1"
              step="1"
              placeholder="Qtd"
              value={outroQtd}
              onChange={(e) => setOutroQtd(e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <select
              className="cn-input"
              value={outroProf}
              onChange={(e) => setOutroProf(e.target.value)}
            >
              <option value="">Profissional responsável (opcional)</option>
              {(profissionais || []).filter((p) => p.ativo !== false).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            <input
              className="cn-input"
              placeholder="Observação (opcional)"
              value={outroObs}
              onChange={(e) => setOutroObs(e.target.value)}
            />
            <button
              type="button"
              className="cn-botao"
              disabled={!outroNome.trim()}
              onClick={adicionarOutroItem}
              style={{ padding: '8px 16px', fontSize: 13, background: 'var(--accent)', color: '#fff' }}
            >
              ➕ Adicionar
            </button>
          </div>
        </div>
      ) : (
        <>
          <input
            className="cn-input"
            placeholder={
              aba === 'perfumaria'
                ? 'Buscar decant, perfume árabe ou combo de cadeira...'
                : aba === 'loja'
                ? 'Buscar na loja por nome, SKU ou código de barras'
                : aba === 'produto'
                ? 'Buscar produto de revenda'
                : aba === 'pacote'
                ? 'Buscar pacote ou plano (ex: 4 procedimentos, VIP, etc.)'
                : 'Buscar serviço'
            }
            value={termo}
            onChange={(event) => setTermo(event.target.value)}
          />
          {aba === 'loja' && loja.erro && <small className="cn-erro">{loja.erro}</small>}
          <div className="cn-resultados">
            {aba === 'loja' && loja.carregando && <small>Consultando a loja…</small>}
            {!resultados.length && !(aba === 'loja' && loja.carregando) && <small>Nada encontrado.</small>}
            {resultados.map((item) => {
              const planosQueCobrem = item.tipo === 'servico' ? planosDoServico(planos, item.itemId) : []
              return (
                <button key={`${item.tipo}-${item.itemId}`} type="button" className="cn-resultado" onClick={() => adicionar(item)}>
                  {item.imagem ? <img src={item.imagem} alt="" loading="lazy" /> : <span className="cn-resultado-icone" aria-hidden="true">{item.tipo === 'servico' ? '✂' : item.tipo === 'pacote' ? '📦' : '◆'}</span>}
                  <span className="cn-resultado-texto"><strong>{item.nome}</strong><small>{item.detalhe}</small>{planosQueCobrem.length > 0 && <small className="cn-tag-plano">No plano: {planosQueCobrem.map((p) => p.planoNome).join(', ')}</small>}</span>
                  <span className="cn-resultado-preco">{moeda(item.preco)}{item.precoCheio > item.preco && <s>{moeda(item.precoCheio)}</s>}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {carrinho.some((i) => i.unificadoAuto || i.agendamentoId) && (
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#3b82f6' }}>
          <span style={{ fontSize: 16 }}>👥</span>
          <div>
            <strong>Serviços Unificados:</strong> Agendamentos reconhecidos para este cliente/família foram consolidados nesta mesma comanda. Cada procedimento mantém seu profissional responsável para fins de comissão.
          </div>
        </div>
      )}
      <div className="cn-carrinho" aria-label="Itens da comanda">
        {!carrinho.length ? <div className="cn-vazio">Nenhum item. Busque acima e clique para adicionar.</div> : carrinho.map((linha) => {
          const coberto = linha.tipo === 'servico' && linha.planoPrevisto
          const temPlano = linha.tipo === 'servico' && planosDoServico(planos, linha.itemId).length > 0
          return (
            <div key={linha.chave} className={coberto ? 'cn-linha coberta' : 'cn-linha'}>
              <div className="cn-linha-nome">
                <strong>{linha.nome}</strong>
                <small>
                  {linha.tipo === 'servico'
                    ? 'Serviço'
                    : (linha.tipo === 'pacote' || linha.tipo === 'plano')
                    ? 'Pacote / Plano'
                    : linha.tipo === 'produto'
                    ? 'Revenda da barbearia'
                    : linha.tipo === 'loja'
                    ? 'Loja Dino'
                    : 'Outro item / Taxa'}
                  {coberto ? ` · coberto pelo ${linha.planoNome}` : ''}
                  {linha.detalhe ? ` · ${linha.detalhe}` : ''}
                </small>
              </div>
              {['servico', 'pacote', 'outro'].includes(linha.tipo) && (
                <select className="cn-input cn-mini" value={linha.profissionalId || ''} onChange={(event) => alterar(linha, { profissionalId: event.target.value })} aria-label="Profissional responsável">
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
export default function ComandaNova({ clientes, profissionais, servicos, produtosRevenda, catalogoPlanos = [], agendamentos = [], agendamentoId = '', clienteInicial = '', nomeInicial = '', telefoneInicial = '', profissionalInicial = '', servicoInicialId = '', observacoesIniciais = '', dataInicial = '', onCancelar, onCriada, onAbrirCadastroCliente, toast }) {
  const [dataComanda, setDataComanda] = useState(() => dataInicial || new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState(clienteInicial)
  const [nomeEventual, setNomeEventual] = useState(clienteInicial ? '' : nomeInicial)
  const [telefoneEventual, setTelefoneEventual] = useState(clienteInicial ? '' : telefoneInicial)
  const [profissionalId, setProfissionalId] = useState(profissionalInicial)
  // Vindo de um agendamento, o serviço agendado já entra na comanda.
  const [carrinho, setCarrinho] = useState(() => {
    const itens = [];
    const agendamentoAtual = agendamentoId ? (agendamentos || []).find((a) => a.id === agendamentoId) : null;
    const servico = agendamentoId && servicoInicialId ? (servicos || []).find((s) => s.id === servicoInicialId) : null;
    if (servico) {
      const precoInicialEfetivo = agendamentoAtual?.valor !== undefined && agendamentoAtual?.valor !== null && !isNaN(Number(agendamentoAtual.valor))
        ? Number(agendamentoAtual.valor)
        : Number(servico.preco || 0);
      itens.push({ chave: `servico-${servico.id}-${agendamentoId}-inicial`, tipo: 'servico', itemId: servico.id, nome: servico.nome, preco: precoInicialEfetivo, precoEditado: precoInicialEfetivo, quantidade: 1, usarPlano: true, profissionalId: profissionalInicial || agendamentoAtual?.profissionalId, agendamentoId });
    }
    if (clienteInicial && agendamentos?.length) {
      const outros = agendamentos.filter((a) => a.clienteId === clienteInicial && a.id !== agendamentoId && ['pendente', 'atrasado', 'em_atendimento'].includes(a.status));
      for (const a of outros) {
        const s = (servicos || []).find((x) => x.id === a.servicoId);
        if (s) itens.push({ chave: `servico-${s.id}-${a.id}-auto`, tipo: 'servico', itemId: s.id, nome: s.nome, preco: Number(a.valor || s.preco || 0), quantidade: 1, usarPlano: true, profissionalId: a.profissionalId, agendamentoId: a.id });
      }
    }
    return itens;
  })
  const [extras, setExtras] = useState({ gorjeta: '', desconto: '', descontoMotivo: '', observacoes: observacoesIniciais })
  const [salvando, setSalvando] = useState(false)
  const cliente = (clientes || []).find((c) => c.id === clienteId) || null
  const { planos, carregando } = usePlanosDoCliente(clienteId)

  useEffect(() => { setCarrinho((atual) => aplicarPreviaPlanos(planos, atual)) }, [planos])

  // Sincroniza e unifica múltiplos agendamentos do mesmo cliente/família na mesma comanda
  useEffect(() => {
    if (!clienteId || !agendamentos?.length) return;
    const agendamentosDoCliente = agendamentos.filter((a) => {
      const matchId = a.clienteId === clienteId;
      const matchTel = cliente?.telefone && a.clienteTelefone && a.clienteTelefone.replace(/\D/g, '') === String(cliente.telefone).replace(/\D/g, '');
      return (matchId || matchTel) && ['pendente', 'agendado', 'atrasado', 'em_atendimento', 'confirmado'].includes(a.status);
    });

    if (agendamentosDoCliente.length > 0) {
      setCarrinho((atual) => {
        const agendamentoIdsNoCarrinho = new Set(atual.map((i) => i.agendamentoId).filter(Boolean));
        const novosItens = [];
        for (const a of agendamentosDoCliente) {
          if (!agendamentoIdsNoCarrinho.has(a.id)) {
            const s = (servicos || []).find((x) => x.id === a.servicoId);
            if (s) {
              novosItens.push({
                chave: `servico-${s.id}-${a.id}-unificado-${Date.now()}`,
                tipo: 'servico',
                itemId: s.id,
                nome: s.nome,
                preco: Number(a.valor || s.preco || 0),
                quantidade: 1,
                usarPlano: true,
                profissionalId: a.profissionalId || profissionalId || '',
                agendamentoId: a.id,
                unificadoAuto: true,
              });
            }
          }
        }
        if (!novosItens.length) return atual;
        return aplicarPreviaPlanos(planos, [...atual, ...novosItens]);
      });
    }
  }, [clienteId, agendamentos, servicos, cliente?.telefone]);
  const totais = totaisCarrinho(carrinho, extras)

  async function salvar(event) {
    event.preventDefault()
    if (!carrinho.length) { toast?.('Inclua ao menos um item na comanda.', 'error'); return }
    if (totais.desconto > 0 && !extras.descontoMotivo.trim()) { toast?.('Informe o motivo do desconto.', 'error'); return }
    setSalvando(true)
    try {
      const resposta = await api.post('/api/admin/barbearia/comandas', {
        clienteId: cliente?.id || '', clienteNome: cliente?.nome || nomeEventual, clienteTelefone: cliente?.telefone || telefoneEventual,
        profissionalId, agendamentoId,
        dataAtendimento: dataComanda,
        data: dataComanda,
        gorjeta: Number(extras.gorjeta || 0), desconto: Number(extras.desconto || 0), descontoMotivo: extras.descontoMotivo, observacoes: extras.observacoes,
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
      {carrinho.length > 0 && <div className="cn-acoes" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}><button type="button" className="cn-botao" disabled={salvando} onClick={salvar} style={{ background: 'var(--accent)', color: '#fff' }}>{salvando ? 'Salvando...' : 'Conferir comanda e receber'}</button></div>}
      <div className="cn-aviso"><strong>Fluxo seguro</strong><span>Abrir a comanda não recebe pagamento nem baixa estoque. Serviços do plano do cliente entram abatidos; o uso do plano só é registrado no fechamento.</span></div>
      <div className="cn-topo">
        <label className="cn-campo" style={{ minWidth: 160 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent, #1d4ed8)' }}>📅 Data da Comanda</span>
          <input
            type="date"
            value={dataComanda}
            onChange={(e) => setDataComanda(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', fontSize: 14, fontWeight: 700, background: 'var(--bg, #fff)', color: 'var(--fg, #0f172a)' }}
          />
        </label>
        {/* div (e não label): um label repassaria o clique para o botão "Trocar" e desfaria a escolha. */}
        <div className="cn-campo" role="group" aria-labelledby="cn-rotulo-cliente"><span id="cn-rotulo-cliente">Cliente</span>
          <BuscaCliente
            clientes={clientes}
            clienteId={clienteId}
            nomeEventual={nomeEventual}
            onSelecionar={(c) => { setClienteId(c?.id || ''); setNomeEventual('') }}
            onNomeEventual={(nome) => { setClienteId(''); setNomeEventual(nome) }}
            onAbrirCadastro={(c) => {
              onAbrirCadastroCliente?.(c || cliente || (clienteId ? (clientes || []).find((item) => item.id === clienteId) : null) || { nome: nomeEventual, telefone: telefoneEventual });
            }}
          />
          {!cliente && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--muted, #64748b)' }}>Atalho de consumo rápido:</span>
              <button
                type="button"
                onClick={() => { setClienteId(''); setNomeEventual('Cliente Balcão'); }}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line, #cbd5e1)', background: nomeEventual === 'Cliente Balcão' ? '#dbeafe' : '#f8fafc', color: nomeEventual === 'Cliente Balcão' ? '#1d4ed8' : '#334155', cursor: 'pointer', fontWeight: 600 }}
              >
                🍺 Cliente Balcão
              </button>
              <button
                type="button"
                onClick={() => { setClienteId(''); setNomeEventual('Mesa Bar'); }}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line, #cbd5e1)', background: nomeEventual === 'Mesa Bar' ? '#dbeafe' : '#f8fafc', color: nomeEventual === 'Mesa Bar' ? '#1d4ed8' : '#334155', cursor: 'pointer', fontWeight: 600 }}
              >
                🍻 Mesa Bar
              </button>
            </div>
          )}
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
      <SeletorItens servicos={servicos} produtosRevenda={produtosRevenda} planos={planos} catalogoPlanos={catalogoPlanos} carrinho={carrinho} setCarrinho={setCarrinho} profissionais={profissionais} profissionalPadrao={profissionalId} />
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
        <button type="submit" className="cn-botao" disabled={salvando || !carrinho.length}>
          {salvando ? 'Abrindo…' : carrinho.length > 0 && carrinho.every(i => i.tipo === 'produto' || i.tipo === 'bebida') ? `🍺 Abrir comanda de bar · ${carrinho.length} item(ns)` : `Abrir comanda${carrinho.length ? ` · ${carrinho.length} item(ns)` : ''}`}
        </button>
      </div>
    </form>
  )
}

/** Adicionar itens a uma comanda já aberta, com a mesma busca e o mesmo plano. */
export function AdicionarItensComanda({ comanda, clientes, profissionais, servicos, produtosRevenda, catalogoPlanos = [], agendamentos = [], onAdicionados, toast }) {
  const [carrinho, setCarrinho] = useState(() => {
    const itens = [];
    if (comanda?.clienteId && agendamentos?.length) {
      const naComanda = new Set((comanda.itens || []).map(i => i.agendamentoId).filter(Boolean));
      if (comanda.agendamentoId) naComanda.add(comanda.agendamentoId);
      
      const outros = agendamentos.filter((a) => a.clienteId === comanda.clienteId && !naComanda.has(a.id) && ['pendente', 'atrasado', 'em_atendimento'].includes(a.status));
      for (const a of outros) {
        const s = (servicos || []).find((x) => x.id === a.servicoId);
        if (s) itens.push({ chave: `servico-${s.id}-${a.id}-auto`, tipo: 'servico', itemId: s.id, nome: s.nome, preco: Number(a.valor || s.preco || 0), quantidade: 1, usarPlano: true, profissionalId: a.profissionalId, agendamentoId: a.id });
      }
    }
    return itens;
  })
  const [salvando, setSalvando] = useState(false)
  const { planos } = usePlanosDoCliente(comanda?.clienteId || '')
  useEffect(() => { setCarrinho((atual) => aplicarPreviaPlanos(planos, atual)) }, [planos])
  async function salvar() {
    if (!carrinho.length) return
    setSalvando(true)
    try {
      const payload = { itens: itensParaApi(carrinho, comanda.profissionalId) }
      let resposta
      try {
        resposta = await api.post(`/api/admin/barbearia/comandas/${comanda.id}/itens`, payload)
      } catch (errPost) {
        if (errPost.message?.includes('gerente') || errPost.status === 403) {
          const senha = window.prompt('A comanda está finalizada. Digite a senha da Gerente Jhenyffer Andrade (ou senha master) para autorizar a inclusão de itens:')
          if (senha) {
            resposta = await api.post(`/api/admin/barbearia/comandas/${comanda.id}/itens`, { ...payload, senhaGerente: senha.trim() })
          } else {
            throw errPost
          }
        } else {
          throw errPost
        }
      }
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
      <SeletorItens servicos={servicos} produtosRevenda={produtosRevenda} planos={planos} catalogoPlanos={catalogoPlanos} carrinho={carrinho} setCarrinho={setCarrinho} profissionais={profissionais} profissionalPadrao={comanda?.profissionalId || ''} />
      {carrinho.length > 0 && <div className="cn-acoes"><button type="button" className="cn-botao" disabled={salvando} onClick={salvar}>{salvando ? 'Adicionando…' : `Adicionar ${carrinho.length} item(ns) à comanda`}</button></div>}
    </div>
  )
}
