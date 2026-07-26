/**
 * Loja de Moda — SetPoint Ultra
 * Grade Cor×Tamanho, Crediário próprio, Condicional (malinha), Vale-presente, Comissões
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TABS = ['Produtos', 'Grade', 'Crediário', 'Condicional', 'Vale-Presente', 'Comissões']

// Tamanhos padrão por categoria
const TAMANHOS_ADULTO = ['PP', 'P', 'M', 'G', 'GG', 'XGG', '3G', '4G']
const TAMANHOS_CALCADO = ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']
const TAMANHOS_INFANTIL = ['1', '2', '3', '4', '6', '8', '10', '12', '14', '16']
const CORES_PADRAO = ['Preto', 'Branco', 'Azul', 'Vermelho', 'Verde', 'Amarelo', 'Rosa', 'Cinza', 'Marrom', 'Bege', 'Laranja', 'Roxo']

export default function LojaModa() {
  const { toast } = useToast()
  const [tab, setTab] = useState('Produtos')
  const [produtos, setProdutos] = useState([])
  const [crediariosClientes, setCrediariosClientes] = useState([])
  const [condicionais, setCondicionais] = useState([])
  const [vales, setVales] = useState([])
  const [comissoes, setComissoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  // Grade builder
  const [gradeConfig, setGradeConfig] = useState({
    produto_nome: '', referencia: '', categoria: 'adulto',
    cores: [], tamanhos: [], preco_custo: '', preco_venda: ''
  })
  const [coresSelecionadas, setCoresSelecionadas] = useState([])
  const [tamanhosSelecionados, setTamanhosSelecionados] = useState([])
  const [precoGrade, setPrecoGrade] = useState({}) // { 'Preto-M': { custo: '', venda: '' } }

  // Crediário
  const [formCrediario, setFormCrediario] = useState({
    cliente_nome: '', cliente_cpf: '', cliente_telefone: '',
    valor_total: '', entrada: '', num_parcelas: 3, dia_vencimento: 10
  })

  // Condicional
  const [formCondicional, setFormCondicional] = useState({
    cliente_nome: '', cliente_telefone: '', vendedor_nome: '',
    prazo_devolucao_dias: 3, observacoes: '',
    itens: []
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [prodData, credData, condData, valeData, comData] = await Promise.all([
        api.get('/api/v1/loja-moda/produtos').catch(() => ({ produtos: [] })),
        api.get('/api/v1/loja-moda/crediario').catch(() => ({ clientes: [] })),
        api.get('/api/v1/loja-moda/condicionais').catch(() => ({ condicionais: [] })),
        api.get('/api/v1/loja-moda/vales').catch(() => ({ vales: [] })),
        api.get('/api/v1/loja-moda/comissoes').catch(() => ({ comissoes: [] }))
      ])
      setProdutos(prodData.produtos || [])
      setCrediariosClientes(credData.clientes || [])
      setCondicionais(condData.condicionais || [])
      setVales(valeData.vales || [])
      setComissoes(comData.comissoes || [])
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const tamanhosPorCategoria = gradeConfig.categoria === 'calcado' ? TAMANHOS_CALCADO
    : gradeConfig.categoria === 'infantil' ? TAMANHOS_INFANTIL : TAMANHOS_ADULTO

  function toggleCor(cor) {
    setCoresSelecionadas(p => p.includes(cor) ? p.filter(c => c !== cor) : [...p, cor])
  }

  function toggleTamanho(tam) {
    setTamanhosSelecionados(p => p.includes(tam) ? p.filter(t => t !== tam) : [...p, tam])
  }

  const totalCombinacoes = coresSelecionadas.length * tamanhosSelecionados.length

  async function criarGrade() {
    if (!gradeConfig.produto_nome || coresSelecionadas.length === 0 || tamanhosSelecionados.length === 0) {
      return toast('Preencha o nome do produto e selecione ao menos 1 cor e 1 tamanho', 'error')
    }
    try {
      await api.post('/api/v1/loja-moda/grade', {
        ...gradeConfig,
        cores: coresSelecionadas,
        tamanhos: tamanhosSelecionados,
        precos_por_variante: precoGrade
      })
      toast(`Grade criada! ${totalCombinacoes} variantes geradas.`, 'success')
      setModal(null)
      setCoresSelecionadas([])
      setTamanhosSelecionados([])
      setPrecoGrade({})
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function criarCrediario() {
    const valorEntrada = parseFloat(formCrediario.entrada) || 0
    const valorTotal = parseFloat(formCrediario.valor_total) || 0
    const saldo = valorTotal - valorEntrada
    const parcela = saldo / parseInt(formCrediario.num_parcelas)
    if (parcela < 1) return toast('Valor inválido para parcelamento', 'error')
    try {
      await api.post('/api/v1/loja-moda/crediario', formCrediario)
      toast('Crediário criado! Carnê gerado.', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function criarCondicional() {
    try {
      await api.post('/api/v1/loja-moda/condicionais', formCondicional)
      toast('Condicional (malinha) registrada!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function emitirVale(valor) {
    try {
      await api.post('/api/v1/loja-moda/vales', { valor })
      toast('Vale-presente emitido!', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  const valorEntrada = parseFloat(formCrediario.entrada) || 0
  const valorTotal = parseFloat(formCrediario.valor_total) || 0
  const saldoCrediario = valorTotal - valorEntrada
  const valorParcela = formCrediario.num_parcelas > 0 ? saldoCrediario / parseInt(formCrediario.num_parcelas) : 0

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>👗 Loja de Moda</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {produtos.length} produtos · {crediariosClientes.length} clientes no crediário
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'Grade' && <button className="btn-primary" onClick={() => setModal('nova-grade')}>+ Nova Grade</button>}
          {tab === 'Crediário' && <button className="btn-primary" onClick={() => setModal('novo-crediario')}>+ Novo Crediário</button>}
          {tab === 'Condicional' && <button className="btn-primary" onClick={() => setModal('nova-condicional')}>+ Nova Malinha</button>}
          {tab === 'Vale-Presente' && <button className="btn-primary" onClick={() => setModal('novo-vale')}>+ Emitir Vale</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card)', borderRadius: 10, padding: 4, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, transition: 'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando...</div> : (
        <>
          {/* Produtos */}
          {tab === 'Produtos' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Referência</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Produto</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Variantes</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Preço Venda</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Estoque Total</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                      Nenhum produto. Crie uma grade na aba "Grade".
                    </td></tr>
                  ) : produtos.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--muted)' }}>{p.referencia}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.nome}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(p.cores || []).map(c => (
                            <span key={c} style={{ background: 'var(--card2)', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>{c}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                          Tamanhos: {(p.tamanhos || []).join(', ')}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmtR(p.preco_venda || 0)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ background: (p.estoque_total || 0) > 0 ? '#5FB33522' : '#e05c5c22', color: (p.estoque_total || 0) > 0 ? '#5FB335' : '#e05c5c', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {p.estoque_total || 0} un
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Grade */}
          {tab === 'Grade' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
                <h3 style={{ margin: '0 0 16px' }}>Como funciona a Grade</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
                  A grade cria automaticamente todas as combinações de <strong>Cor × Tamanho</strong> para um produto.
                  Por exemplo, uma camiseta com 3 cores e 5 tamanhos gera <strong>15 variantes</strong> no estoque,
                  cada uma com seu próprio controle de quantidade.
                </p>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Exemplo de grade:</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '4px 8px', background: 'var(--card2)', textAlign: 'left' }}>Cor / Tam</th>
                        {['P', 'M', 'G'].map(t => <th key={t} style={{ padding: '4px 8px', background: 'var(--card2)', textAlign: 'center' }}>{t}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {['Preto', 'Branco', 'Azul'].map(cor => (
                        <tr key={cor}>
                          <td style={{ padding: '4px 8px', fontWeight: 600 }}>{cor}</td>
                          {['P', 'M', 'G'].map(t => (
                            <td key={t} style={{ padding: '4px 8px', textAlign: 'center', color: '#5FB335' }}>✓</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn-primary" style={{ marginTop: 20, width: '100%' }} onClick={() => setModal('nova-grade')}>
                  + Criar Nova Grade
                </button>
              </div>
              <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
                <h3 style={{ margin: '0 0 16px' }}>Grades Recentes</h3>
                {produtos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma grade criada ainda</div>
                ) : produtos.slice(0, 5).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(p.cores || []).length} cores × {(p.tamanhos || []).length} tamanhos = {(p.cores || []).length * (p.tamanhos || []).length} variantes</div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#5FB335' }}>{fmtR(p.preco_venda || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crediário */}
          {tab === 'Crediário' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Pago</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Saldo</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Próx. Vencimento</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {crediariosClientes.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum crediário ativo</td></tr>
                  ) : crediariosClientes.map(c => {
                    const saldo = (c.valor_total || 0) - (c.valor_pago || 0)
                    const atrasado = c.dias_atraso > 0
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{c.cliente_nome}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.cliente_cpf}</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtR(c.valor_total || 0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#5FB335' }}>{fmtR(c.valor_pago || 0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: saldo > 0 ? '#e05c5c' : '#5FB335' }}>{fmtR(saldo)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: atrasado ? '#e05c5c' : 'var(--muted)' }}>
                          {c.proximo_vencimento ? fmtDate(c.proximo_vencimento) : '-'}
                          {atrasado && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700 }}>({c.dias_atraso}d atraso)</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: atrasado ? '#e05c5c22' : '#5FB33522', color: atrasado ? '#e05c5c' : '#5FB335', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                            {atrasado ? 'Atrasado' : 'Em dia'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Condicional */}
          {tab === 'Condicional' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', background: '#f59e0b11' }}>
                <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>
                  ⚠️ Condicional (Malinha): Itens saem da loja para aprovação do cliente. Prazo máximo de devolução deve ser monitorado.
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Vendedor</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Saída</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prazo Devolução</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {condicionais.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma malinha em aberto</td></tr>
                  ) : condicionais.map(c => {
                    const vencido = c.dias_restantes < 0
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--line)', background: vencido ? '#e05c5c08' : 'transparent' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{c.cliente_nome}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.cliente_telefone}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{c.vendedor_nome}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{fmtDate(c.data_saida)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: vencido ? '#e05c5c' : 'var(--fg)', fontWeight: vencido ? 700 : 400 }}>
                          {fmtDate(c.data_devolucao_prevista)}
                          {vencido && <span style={{ marginLeft: 6, fontSize: 11 }}>({Math.abs(c.dias_restantes)}d atrasado!)</span>}
                          {!vencido && c.dias_restantes <= 1 && <span style={{ marginLeft: 6, fontSize: 11, color: '#f59e0b' }}>(vence hoje!)</span>}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmtR(c.valor_total || 0)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: vencido ? '#e05c5c22' : '#f59e0b22', color: vencido ? '#e05c5c' : '#f59e0b', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                            {vencido ? 'Vencido' : 'Em aberto'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Vale-Presente */}
          {tab === 'Vale-Presente' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {/* Card emitir novo vale */}
              <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, border: '2px dashed var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', minHeight: 160 }} onClick={() => setModal('novo-vale')}>
                <span style={{ fontSize: 36 }}>🎁</span>
                <div style={{ fontWeight: 700, color: 'var(--accent)' }}>Emitir Vale-Presente</div>
              </div>
              {vales.map(v => (
                <div key={v.id} style={{ background: 'var(--card)', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>🎁</span>
                    <span style={{ background: v.status === 'ativo' ? '#5FB33522' : '#88888822', color: v.status === 'ativo' ? '#5FB335' : '#888', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {v.status === 'ativo' ? 'Ativo' : 'Utilizado'}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{v.codigo}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#5FB335' }}>{fmtR(v.valor || 0)}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Emitido em {fmtDate(v.created_at)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Comissões */}
          {tab === 'Comissões' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Vendedor</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Vendas</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>% Comissão</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Comissão</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Período</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comissoes.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma comissão calculada</td></tr>
                  ) : comissoes.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.vendedor_nome}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtR(c.total_vendas || 0)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{c.percentual_comissao}%</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#5FB335' }}>{fmtR(c.valor_comissao || 0)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{c.periodo}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: c.pago ? '#5FB33522' : '#f59e0b22', color: c.pago ? '#5FB335' : '#f59e0b', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {c.pago ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal: Nova Grade */}
      {modal === 'nova-grade' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>👗 Criar Grade de Produto</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Nome do Produto *</label>
                <input placeholder="Ex: Camiseta Polo Masculina" value={gradeConfig.produto_nome} onChange={e => setGradeConfig(p => ({ ...p, produto_nome: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Referência</label>
                <input placeholder="REF-001" value={gradeConfig.referencia} onChange={e => setGradeConfig(p => ({ ...p, referencia: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Categoria</label>
                <select value={gradeConfig.categoria} onChange={e => { setGradeConfig(p => ({ ...p, categoria: e.target.value })); setTamanhosSelecionados([]) }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }}>
                  <option value="adulto">Adulto (PP ao 4G)</option>
                  <option value="calcado">Calçado (33 ao 45)</option>
                  <option value="infantil">Infantil (1 ao 16)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Preço de Custo (R$)</label>
                <input type="number" placeholder="0,00" value={gradeConfig.preco_custo} onChange={e => setGradeConfig(p => ({ ...p, preco_custo: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Preço de Venda (R$)</label>
                <input type="number" placeholder="0,00" value={gradeConfig.preco_venda} onChange={e => setGradeConfig(p => ({ ...p, preco_venda: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Seleção de Cores */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                Cores ({coresSelecionadas.length} selecionadas)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CORES_PADRAO.map(cor => (
                  <button key={cor} onClick={() => toggleCor(cor)}
                    style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${coresSelecionadas.includes(cor) ? 'var(--accent)' : 'var(--line)'}`, background: coresSelecionadas.includes(cor) ? 'var(--accent)22' : 'transparent', color: coresSelecionadas.includes(cor) ? 'var(--accent)' : 'var(--fg)', cursor: 'pointer', fontSize: 13, fontWeight: coresSelecionadas.includes(cor) ? 700 : 400, transition: 'all 0.15s' }}>
                    {cor}
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de Tamanhos */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                Tamanhos ({tamanhosSelecionados.length} selecionados)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tamanhosPorCategoria.map(tam => (
                  <button key={tam} onClick={() => toggleTamanho(tam)}
                    style={{ width: 52, height: 40, borderRadius: 8, border: `2px solid ${tamanhosSelecionados.includes(tam) ? 'var(--accent)' : 'var(--line)'}`, background: tamanhosSelecionados.includes(tam) ? 'var(--accent)' : 'transparent', color: tamanhosSelecionados.includes(tam) ? '#fff' : 'var(--fg)', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.15s' }}>
                    {tam}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview da grade */}
            {totalCombinacoes > 0 && (
              <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Preview da Grade</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#5FB335', marginBottom: 8 }}>
                  {coresSelecionadas.length} cores × {tamanhosSelecionados.length} tamanhos = <span style={{ fontSize: 20 }}>{totalCombinacoes}</span> variantes
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '4px 10px', background: 'var(--bg)', textAlign: 'left', minWidth: 80 }}>Cor \ Tam</th>
                        {tamanhosSelecionados.map(t => <th key={t} style={{ padding: '4px 10px', background: 'var(--bg)', textAlign: 'center', minWidth: 40 }}>{t}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {coresSelecionadas.map(cor => (
                        <tr key={cor}>
                          <td style={{ padding: '4px 10px', fontWeight: 600 }}>{cor}</td>
                          {tamanhosSelecionados.map(t => (
                            <td key={t} style={{ padding: '4px 10px', textAlign: 'center', color: '#5FB335', fontSize: 16 }}>✓</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { setModal(null); setCoresSelecionadas([]); setTamanhosSelecionados([]) }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={criarGrade} className="btn-primary" disabled={totalCombinacoes === 0}>
                Criar Grade ({totalCombinacoes} variantes)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Crediário */}
      {modal === 'novo-crediario' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>💳 Novo Crediário</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Nome do Cliente *', key: 'cliente_nome', full: true },
                { label: 'CPF', key: 'cliente_cpf', placeholder: '000.000.000-00' },
                { label: 'Telefone', key: 'cliente_telefone', placeholder: '(65) 99999-9999' },
                { label: 'Valor Total (R$) *', key: 'valor_total', type: 'number' },
                { label: 'Entrada (R$)', key: 'entrada', type: 'number' },
                { label: 'Nº de Parcelas', key: 'num_parcelas', type: 'number' },
                { label: 'Dia de Vencimento', key: 'dia_vencimento', type: 'number', placeholder: '10' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formCrediario[f.key] || ''} onChange={e => setFormCrediario(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            {/* Preview do carnê */}
            {valorTotal > 0 && formCrediario.num_parcelas > 0 && (
              <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, marginTop: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Resumo do Carnê</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Entrada</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#5FB335' }}>{fmtR(valorEntrada)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formCrediario.num_parcelas}x de</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#4a9eff' }}>{fmtR(valorParcela)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtR(valorTotal)}</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={criarCrediario} className="btn-primary">Criar Crediário</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Condicional */}
      {modal === 'nova-condicional' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 520 }}>
            <h2 style={{ margin: '0 0 24px' }}>👜 Nova Malinha (Condicional)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Nome do Cliente *', key: 'cliente_nome', full: true },
                { label: 'Telefone', key: 'cliente_telefone', placeholder: '(65) 99999-9999' },
                { label: 'Vendedor Responsável', key: 'vendedor_nome' },
                { label: 'Prazo de Devolução (dias)', key: 'prazo_devolucao_dias', type: 'number', placeholder: '3' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formCondicional[f.key] || ''} onChange={e => setFormCondicional(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Observações</label>
                <textarea placeholder="Itens levados, condições..." value={formCondicional.observacoes} onChange={e => setFormCondicional(p => ({ ...p, observacoes: e.target.value }))} rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={criarCondicional} className="btn-primary">Registrar Malinha</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Vale */}
      {modal === 'novo-vale' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 400, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
            <h2 style={{ margin: '0 0 24px' }}>Emitir Vale-Presente</h2>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
              {[50, 100, 150, 200, 300, 500].map(v => (
                <button key={v} onClick={() => emitirVale(v)}
                  style={{ padding: '12px 20px', borderRadius: 10, border: '2px solid var(--accent)', background: 'var(--accent)22', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
                  {fmtR(v)}
                </button>
              ))}
            </div>
            <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
