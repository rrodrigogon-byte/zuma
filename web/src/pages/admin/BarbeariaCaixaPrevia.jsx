import { useEffect, useMemo, useRef, useState } from 'react'
import { api, fmtR } from '../../lib/api'

const MEIOS = [
  ['pix', 'PIX'],
  ['credito', 'Crédito'],
  ['debito', 'Débito'],
  ['cartao', 'Cartão'],
  ['dinheiro', 'Dinheiro'],
  ['transferencia', 'Transferência'],
]
const UNIDADES = ['un', 'g', 'ml', 'kg', 'l']
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit' }
const buttonStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--card2)', color: 'var(--fg)', cursor: 'pointer', font: 'inherit', fontSize: 12 }
const primaryStyle = { ...buttonStyle, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff', fontWeight: 800 }

function money(value) {
  return value === null || value === undefined ? 'Pendente' : fmtR(value)
}

function blankRate() {
  return { meio: 'pix', bandeira: '', parcelas: '', percentual: '', fixa: '', base: 'bruto', fonte: '' }
}

function blankMaterial(serviceId = '') {
  return { servicoId: serviceId, quantidade: '1', unidade: 'un', unidadeReferencia: 'un', custoUnitario: '', fonte: '' }
}

function blankSimulation(serviceId = '') {
  return { id: `linha-${Date.now().toString(36)}`, servicoId: serviceId, bruto: '', meio: 'pix', bandeira: '', parcelas: '', comissaoPercentual: '' }
}

export default function BarbeariaCaixaPrevia({ servicos = [], empresaId = '', lojaId = '' }) {
  const ativos = useMemo(() => servicos.filter((item) => item.ativo !== false && lojaId && String(item.lojaId || '') === String(lojaId)), [servicos, lojaId])
  const primeiroServico = ativos[0]?.id || ''
  const [taxas, setTaxas] = useState([blankRate()])
  const [materiais, setMateriais] = useState([blankMaterial(primeiroServico)])
  const [simulacoes, setSimulacoes] = useState([blankSimulation(primeiroServico)])
  const [idempotencyKey, setIdempotencyKey] = useState(() => `previa-${Date.now().toString(36)}`)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const requestVersion = useRef(0)
  const currentScope = `${empresaId}:${lojaId}`
  const liveScope = useRef(currentScope)
  liveScope.current = currentScope
  useEffect(() => {
    setTaxas([blankRate()])
    setMateriais([blankMaterial(primeiroServico)])
    setSimulacoes([blankSimulation(primeiroServico)])
  }, [currentScope])
  useEffect(() => {
    requestVersion.current += 1
    setResultado(null)
    setErro('')
    setCarregando(false)
    setIdempotencyKey(`previa-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`)
  }, [taxas, materiais, simulacoes, currentScope])
  useEffect(() => () => { requestVersion.current += 1 }, [])

  function atualizar(lista, setLista, index, campo, valor) {
    setLista((atual) => atual.map((item, itemIndex) => itemIndex === index ? { ...item, [campo]: valor } : item))
  }

  function prepararPayload() {
    return {
      empresaId,
      lojaId,
      idempotencyKey: idempotencyKey.trim(),
      taxas: taxas.map((item) => ({ ...item, parcelas: item.parcelas === '' ? undefined : Number(item.parcelas), percentual: item.percentual === '' ? undefined : Number(item.percentual), fixa: item.fixa === '' ? undefined : Number(item.fixa) })),
      materiais: materiais.map((item) => ({ ...item, quantidade: item.quantidade === '' ? undefined : Number(item.quantidade), custoUnitario: item.custoUnitario === '' ? undefined : Number(item.custoUnitario) })),
      simulacoes: simulacoes.map((item) => ({ ...item, bruto: item.bruto === '' ? undefined : Number(item.bruto), parcelas: item.parcelas === '' ? undefined : Number(item.parcelas), comissaoPercentual: item.comissaoPercentual === '' ? undefined : Number(item.comissaoPercentual) })),
    }
  }

  async function calcular(event) {
    event.preventDefault()
    if (!empresaId || !lojaId) { setErro('Selecione a empresa e a unidade antes de simular.'); return }
    if (!ativos.length) { setErro('Não há serviços com vínculo explícito à unidade selecionada. O cadastro legado precisa de revisão; nenhum dado foi enviado.'); return }
    const version = ++requestVersion.current
    const scope = currentScope
    const isCurrent = () => version === requestVersion.current && scope === liveScope.current
    setCarregando(true)
    setErro('')
    setResultado(null)
    try {
      const payload = await api.post('/api/admin/barbearia/caixa/previa-taxas-materiais', prepararPayload())
      if (!isCurrent()) return
      if (payload?.escopo?.empresaId !== empresaId || payload?.escopo?.lojaId !== lojaId || payload?.somenteLeitura !== true || payload?.gravacaoAplicada !== false) throw new Error('A resposta não corresponde à prévia da empresa/unidade selecionada.')
      setResultado(payload)
    } catch (error) {
      if (!isCurrent()) return
      setResultado(null)
      setErro(error.message || 'Não foi possível calcular a prévia.')
    } finally {
      if (isCurrent()) setCarregando(false)
    }
  }

  function renderTaxa(item, index) {
    return <div key={`taxa-${index}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, alignItems: 'end', padding: 10, border: '1px solid var(--line)', borderRadius: 9, background: 'var(--bg)' }}>
      <label><span>Meio</span><select value={item.meio} onChange={(event) => atualizar(taxas, setTaxas, index, 'meio', event.target.value)} style={inputStyle}>{MEIOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label><span>Bandeira</span><input placeholder="Visa, Elo…" value={item.bandeira} onChange={(event) => atualizar(taxas, setTaxas, index, 'bandeira', event.target.value)} style={inputStyle} /></label>
      <label><span>Parcelas</span><input type="number" min="1" max="24" placeholder="Todas" value={item.parcelas} onChange={(event) => atualizar(taxas, setTaxas, index, 'parcelas', event.target.value)} style={inputStyle} /></label>
      <label><span>%</span><input type="number" min="0" max="100" step="0.0001" placeholder="Ex.: 1,99" value={item.percentual} onChange={(event) => atualizar(taxas, setTaxas, index, 'percentual', event.target.value)} style={inputStyle} /></label>
      <label><span>Fixa (R$)</span><input type="number" min="0" step="0.01" placeholder="Ex.: 0,20" value={item.fixa} onChange={(event) => atualizar(taxas, setTaxas, index, 'fixa', event.target.value)} style={inputStyle} /></label>
      <label><span>Base</span><select value={item.base} onChange={(event) => atualizar(taxas, setTaxas, index, 'base', event.target.value)} style={inputStyle}><option value="bruto">Bruto</option><option value="liquido">Líquido</option></select></label>
      <label style={{ gridColumn: 'span 2' }}><span>Fonte</span><input placeholder="Contrato/extrato (obrigatório para aprovação)" value={item.fonte} onChange={(event) => atualizar(taxas, setTaxas, index, 'fonte', event.target.value)} style={inputStyle} /></label>
      <button type="button" style={buttonStyle} onClick={() => setTaxas((atual) => atual.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
    </div>
  }

  function renderMaterial(item, index) {
    return <div key={`material-${index}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8, alignItems: 'end', padding: 10, border: '1px solid var(--line)', borderRadius: 9, background: 'var(--bg)' }}>
      <label style={{ gridColumn: 'span 2' }}><span>Serviço</span><select value={item.servicoId} onChange={(event) => atualizar(materiais, setMateriais, index, 'servicoId', event.target.value)} style={inputStyle}><option value="">Selecionar serviço</option>{ativos.map((servico) => <option key={servico.id} value={servico.id}>{servico.nome}</option>)}</select></label>
      <label><span>Quantidade</span><input type="number" min="0.000001" step="0.000001" value={item.quantidade} onChange={(event) => atualizar(materiais, setMateriais, index, 'quantidade', event.target.value)} style={inputStyle} /></label>
      <label><span>Unidade</span><select value={item.unidade} onChange={(event) => atualizar(materiais, setMateriais, index, 'unidade', event.target.value)} style={inputStyle}>{UNIDADES.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}</select></label>
      <label><span>Custo por unidade de referência (R$)</span><input type="number" min="0" step="0.000001" placeholder="Vazio = pendente" value={item.custoUnitario} onChange={(event) => atualizar(materiais, setMateriais, index, 'custoUnitario', event.target.value)} style={inputStyle} /></label>
      <label><span>Unidade de referência do custo</span><select value={item.unidadeReferencia} onChange={(event) => atualizar(materiais, setMateriais, index, 'unidadeReferencia', event.target.value)} style={inputStyle}>{UNIDADES.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}</select></label>
      <label style={{ gridColumn: 'span 2' }}><span>Fonte</span><input placeholder="Ficha técnica/compra" value={item.fonte} onChange={(event) => atualizar(materiais, setMateriais, index, 'fonte', event.target.value)} style={inputStyle} /></label>
      <button type="button" style={buttonStyle} onClick={() => setMateriais((atual) => atual.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
    </div>
  }

  function renderSimulation(item, index) {
    return <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8, alignItems: 'end', padding: 10, border: '1px solid var(--line)', borderRadius: 9, background: 'var(--bg)' }}>
      <label style={{ gridColumn: 'span 2' }}><span>Serviço</span><select value={item.servicoId} onChange={(event) => atualizar(simulacoes, setSimulacoes, index, 'servicoId', event.target.value)} style={inputStyle}><option value="">Selecionar serviço</option>{ativos.map((servico) => <option key={servico.id} value={servico.id}>{servico.nome}</option>)}</select></label>
      <label><span>Bruto (R$)</span><input type="number" min="0" step="0.01" placeholder="Zero explícito aceito" value={item.bruto} onChange={(event) => atualizar(simulacoes, setSimulacoes, index, 'bruto', event.target.value)} style={inputStyle} /></label>
      <label><span>Meio</span><select value={item.meio} onChange={(event) => atualizar(simulacoes, setSimulacoes, index, 'meio', event.target.value)} style={inputStyle}>{MEIOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label><span>Bandeira</span><input placeholder="Opcional" value={item.bandeira} onChange={(event) => atualizar(simulacoes, setSimulacoes, index, 'bandeira', event.target.value)} style={inputStyle} /></label>
      <label><span>Parcelas</span><input type="number" min="1" max="24" placeholder="Todas" value={item.parcelas} onChange={(event) => atualizar(simulacoes, setSimulacoes, index, 'parcelas', event.target.value)} style={inputStyle} /></label>
      <label><span>Comissão %</span><input type="number" min="0" max="100" step="0.01" placeholder="Opcional" value={item.comissaoPercentual} onChange={(event) => atualizar(simulacoes, setSimulacoes, index, 'comissaoPercentual', event.target.value)} style={inputStyle} /></label>
      <button type="button" style={buttonStyle} onClick={() => setSimulacoes((atual) => atual.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
    </div>
  }

  const status = resultado?.status === 'calculado' ? '#14b87a' : '#f59e0b'
  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={{ padding: 18, borderRadius: 14, border: '1px solid color-mix(in srgb, #f59e0b 45%, var(--line))', background: 'color-mix(in srgb, #f59e0b 7%, var(--card))' }}>
      <div style={{ color: '#b45309', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Comandas · caixa · prévia</div>
      <h2 style={{ margin: '6px 0' }}>Simular taxas e materiais antes de gravar</h2>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Use esta tela para conferir bruto, taxa, material, líquido e divergências. A prévia é somente leitura: não cria cobrança, pagamento, ledger, comanda, conciliação ou documento fiscal. O comparativo com o cadastro só aparece quando o vínculo explícito com esta unidade é comprovado; registros legados sem unidade ficam bloqueados.</p>
    </section>
    {empresaId && lojaId && !ativos.length && <div role="status" style={{ padding: 12, border: '1px solid #f59e0b', borderRadius: 9 }}>Não há serviços com vínculo explícito à unidade selecionada. A simulação fica bloqueada até a revisão desse vínculo; serviços de outras unidades e registros sem unidade não aparecem nesta prévia.</div>}
    <form onSubmit={calcular} style={{ display: 'grid', gap: 16 }}>
      <section style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}><div><h3 style={{ margin: 0 }}>Plano e escopo</h3><small style={{ color: 'var(--muted)' }}>A chave impede replay divergente por empresa e unidade.</small></div><label style={{ minWidth: 260 }}><span>Chave de idempotência</span><input required value={idempotencyKey} onChange={(event) => { requestVersion.current += 1; setResultado(null); setCarregando(false); setIdempotencyKey(event.target.value) }} style={inputStyle} /></label></div>
      </section>
      <section style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div><h3 style={{ margin: 0 }}>Taxas por meio, bandeira e parcelas</h3><small style={{ color: 'var(--muted)' }}>Ausência fica pendente; zero só é aceito quando informado explicitamente.</small></div><button type="button" style={buttonStyle} onClick={() => setTaxas((atual) => [...atual, blankRate()])}>+ Adicionar taxa</button></div><div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{taxas.map(renderTaxa)}</div></section>
      <section style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div><h3 style={{ margin: 0 }}>Custo de material por serviço</h3><small style={{ color: 'var(--muted)' }}>Custo vazio permanece pendente; g/ml são validados como unidade.</small></div><button type="button" style={buttonStyle} onClick={() => setMateriais((atual) => [...atual, blankMaterial(primeiroServico)])}>+ Adicionar material</button></div><div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{materiais.map(renderMaterial)}</div></section>
      <section style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div><h3 style={{ margin: 0 }}>Linhas para cálculo assistido</h3><small style={{ color: 'var(--muted)' }}>Comissão é opcional e permanece indicativa.</small></div><button type="button" style={buttonStyle} onClick={() => setSimulacoes((atual) => [...atual, blankSimulation(primeiroServico)])}>+ Adicionar linha</button></div><div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{simulacoes.map(renderSimulation)}</div></section>
      {erro && <div role="alert" style={{ padding: 12, borderRadius: 9, color: '#b91c1c', background: '#fee2e2' }}>{erro}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="submit" style={primaryStyle} disabled={carregando || !empresaId || !lojaId || !ativos.length}>{carregando ? 'Calculando…' : 'Gerar prévia (não grava)'}</button></div>
    </form>
    {resultado && <section aria-live="polite" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, padding: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>{[['Bruto', resultado.totais?.bruto], ['Taxas', resultado.totais?.taxa], ['Material', resultado.totais?.material], ['Líquido assistido', resultado.totais?.liquido], ['Comissão indicativa', resultado.totais?.comissaoIndicativa]].map(([label, value]) => <div key={label} style={{ padding: 13, background: 'var(--card)' }}><small style={{ color: 'var(--muted)' }}>{label}</small><strong style={{ display: 'block', marginTop: 5, fontSize: 18 }}>{money(value)}</strong></div>)}</div>
      <div style={{ padding: 14, border: `1px solid ${status}`, borderRadius: 10, background: 'var(--card)' }}><strong style={{ color: status }}>{resultado.status === 'calculado' ? 'Prévia calculada' : 'Prévia pendente de revisão'}</strong><div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5, overflowWrap: 'anywhere' }}>Hash: {resultado.planHash} · {resultado.idempotente ? 'replay idempotente' : 'novo plano'} · gravação aplicada: não</div></div>
      {resultado.comparativo?.status === 'parcial_bloqueado' && <div role="status" style={{ padding: 14, border: '1px solid #f59e0b', borderRadius: 10, background: 'color-mix(in srgb, #f59e0b 8%, var(--card))' }}><strong style={{ color: '#b45309' }}>Comparativo unitário indisponível</strong><div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5 }}>O cadastro legado não comprova a unidade para todos os registros. Nenhum dado de outra unidade foi usado e a ausência não foi tratada como taxa ou material novo. Os valores enviados podem ser simulados, mas o plano permanece pendente de revisão.</div></div>}
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--card)' }}><table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}><thead><tr style={{ background: 'var(--card2)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>{['Serviço', 'Bruto', 'Taxa', 'Material', 'Líquido', 'Base comissão', 'Estado', 'Divergências'].map((item) => <th key={item} style={{ padding: '10px 12px', textAlign: 'left' }}>{item}</th>)}</tr></thead><tbody>{(resultado.linhas || []).map((linha) => <tr key={linha.id} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '11px 12px' }}>{linha.servicoNome || ativos.find((item) => item.id === linha.servicoId)?.nome || linha.servicoId}</td><td style={{ padding: '11px 12px' }}>{money(linha.bruto)}</td><td style={{ padding: '11px 12px' }}>{money(linha.taxa)}</td><td style={{ padding: '11px 12px' }}>{money(linha.material)}</td><td style={{ padding: '11px 12px' }}>{money(linha.liquido)}</td><td style={{ padding: '11px 12px' }}>{money(linha.baseComissao)}</td><td style={{ padding: '11px 12px', color: linha.status === 'calculado' ? '#14b87a' : '#f59e0b', fontWeight: 800 }}>{linha.status === 'calculado' ? 'Calculado' : 'Pendente'}</td><td style={{ padding: '11px 12px' }}>{linha.divergencias?.length ? linha.divergencias.map((item) => <div key={item.tipo}><strong>{item.tipo}</strong><div style={{ color: 'var(--muted)', fontSize: 11 }}>{item.mensagem}</div></div>) : 'Nenhuma'}</td></tr>)}</tbody></table></div>
      {!!resultado.divergencias?.length && <div style={{ display: 'grid', gap: 6, padding: 14, borderRadius: 10, background: 'color-mix(in srgb, #f59e0b 8%, var(--card))' }}><strong>Divergências do plano</strong>{resultado.divergencias.map((item, index) => <div key={`${item.tipo}-${item.chave}-${index}`} style={{ fontSize: 12 }}><strong>{item.tipo}</strong> · {item.mensagem}</div>)}</div>}
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Credenciais fiscais (certificado/senha) não são importáveis. A aprovação e eventual gravação de configuração não fazem parte desta prévia.</div>
    </section>}
  </div>
}
