import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const EMPTY_FISCAL = {
  ncm: '', cest: '', cfop: '5102', origem: '0', unidadeTributavel: 'UN',
  csosn: '102', cstIcms: '00', cstPis: '49', cstCofins: '49',
  aliquotaIcms: 0, aliquotaIcmsSt: 0, margemValorAgregadoSt: 0, aliquotaFcp: 0,
  aliquotaPis: 0, aliquotaCofins: 0, aliquotaIbptNacional: 0, aliquotaIbptImportado: 0,
  enquadramentoLegal: '',
}

const inputStyle = {
  width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box', fontSize: 13,
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>
    {label}
    <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder} style={inputStyle} />
  </label>
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseIbptCsv(text) {
  const linhas = String(text || '').split(/\r?\n/).map(linha => linha.trim()).filter(Boolean)
  if (linhas.length < 2) throw new Error('O arquivo IBPT deve conter cabeçalho e pelo menos uma linha de dados.')
  const separador = linhas[0].includes(';') ? ';' : ','
  const cabecalho = linhas[0].split(separador).map(item => item.trim().toLocaleLowerCase('pt-BR'))
  const indice = (opcoes) => cabecalho.findIndex(item => opcoes.includes(item))
  const ncmIndex = indice(['ncm', 'codigo_ncm', 'codigo'])
  const nacionalIndex = indice(['nacional', 'aliquota_nacional', 'percentual_nacional'])
  const importadoIndex = indice(['importado', 'aliquota_importado', 'percentual_importado'])
  const descricaoIndex = indice(['descricao', 'ex', 'descricao_ncm'])
  if (ncmIndex < 0 || nacionalIndex < 0 || importadoIndex < 0) throw new Error('O CSV IBPT deve ter as colunas ncm, nacional e importado.')
  return linhas.slice(1).map(linha => {
    const valores = linha.split(separador).map(item => item.trim().replace(/^"|"$/g, ''))
    return { ncm: valores[ncmIndex], nacional: valores[nacionalIndex].replace(',', '.'), importado: valores[importadoIndex].replace(',', '.'), descricao: descricaoIndex >= 0 ? valores[descricaoIndex] : '' }
  }).filter(linha => String(linha.ncm || '').replace(/\D/g, '').length === 8)
}

export default function ClassificacaoFiscal() {
  const { toast } = useToast()
  const [itens, setItens] = useState([])
  const [query, setQuery] = useState('')
  const [selecionado, setSelecionado] = useState(null)
  const [form, setForm] = useState(EMPTY_FISCAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [simulacao, setSimulacao] = useState(null)
  const [simulando, setSimulando] = useState(false)
  const [tabelasIbpt, setTabelasIbpt] = useState([])
  const [arquivoIbpt, setArquivoIbpt] = useState(null)
  const [versaoIbpt, setVersaoIbpt] = useState('')
  const [vigenciaInicio, setVigenciaInicio] = useState('')
  const [vigenciaFim, setVigenciaFim] = useState('')
  const [importandoIbpt, setImportandoIbpt] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [result, ibpt] = await Promise.all([
        api.get('/api/v1/fiscal/produtos/classificacao'),
        api.get('/api/v1/fiscal/ibpt'),
      ])
      setItens(result.itens || [])
      setTabelasIbpt(ibpt.tabelas || [])
    } catch (error) {
      toast(error.message || 'Não foi possível carregar as classificações fiscais.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = useMemo(() => {
    const termo = query.trim().toLocaleLowerCase('pt-BR')
    return !termo ? itens : itens.filter(item => `${item.nome} ${item.categoria} ${item.fiscal?.ncm || ''} ${item.fiscal?.cfop || ''}`.toLocaleLowerCase('pt-BR').includes(termo))
  }, [itens, query])

  const resumo = useMemo(() => ({
    total: itens.length,
    comNcm: itens.filter(item => String(item.fiscal?.ncm || '').length === 8).length,
    pendentes: itens.filter(item => item.pendencias?.length).length,
  }), [itens])

  function abrir(item) {
    setSelecionado(item)
    setForm({ ...EMPTY_FISCAL, ...(item.fiscal || {}) })
    setSimulacao(null)
  }

  function update(chave, valor) {
    setForm(atual => ({ ...atual, [chave]: valor }))
  }

  async function salvar() {
    if (!selecionado) return
    setSaving(true)
    try {
      const result = await api.patch(`/api/v1/fiscal/produtos/${selecionado.id}/classificacao`, { fiscal: form })
      const atualizado = result.produto
      setItens(atuais => atuais.map(item => item.id === atualizado.id ? { ...item, fiscal: atualizado.fiscal, pendencias: result.validacao?.pendencias || [], classificacaoCompleta: result.validacao?.valido } : item))
      setSelecionado(atual => ({ ...atual, fiscal: atualizado.fiscal, pendencias: result.validacao?.pendencias || [] }))
      setForm({ ...EMPTY_FISCAL, ...atualizado.fiscal })
      toast('Classificação fiscal salva. Nenhum documento foi emitido.', 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível salvar a classificação.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function importarIbpt() {
    if (!arquivoIbpt || !versaoIbpt.trim()) {
      toast('Informe a versão de referência e selecione o CSV oficial da tabela IBPT.', 'error')
      return
    }
    setImportandoIbpt(true)
    try {
      const linhas = parseIbptCsv(await arquivoIbpt.text())
      const result = await api.post('/api/v1/fiscal/ibpt/importar', { versao: versaoIbpt, vigenciaInicio: vigenciaInicio || null, vigenciaFim: vigenciaFim || null, linhas })
      setTabelasIbpt(atuais => [result.tabela, ...atuais.map(tabela => ({ ...tabela, ativa: false }))])
      setArquivoIbpt(null); setVersaoIbpt(''); setVigenciaInicio(''); setVigenciaFim('')
      toast(`Tabela IBPT importada com ${result.tabela.quantidadeLinhas} NCMs.`, 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível importar a tabela IBPT.', 'error')
    } finally {
      setImportandoIbpt(false)
    }
  }

  async function simular() {
    if (!selecionado) return
    setSimulando(true)
    try {
      const result = await api.post('/api/v1/fiscal/calcular', {
        operacao: 'venda_presencial',
        itens: [{ produtoId: selecionado.id, quantidade: 1, valorUnitario: selecionado.preco, fiscal: form }],
      })
      setSimulacao(result)
    } catch (error) {
      toast(error.message || 'Não foi possível calcular a simulação tributária.', 'error')
    } finally {
      setSimulando(false)
    }
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Carregando classificação tributária…</div>

  return <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
    <header style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap' }}>
      <div>
        <p style={{ margin: 0, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1.1, fontSize: 11, fontWeight: 800 }}>Fiscal · Prompt 10.2</p>
        <h1 style={{ margin: '5px 0 6px', fontSize: 27, fontWeight: 850 }}>Classificação Tributária de Produtos</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, maxWidth: 780, lineHeight: 1.55 }}>Mantenha NCM, CFOP, origem, CST/CSOSN, PIS, COFINS, FCP e tributos aproximados por produto. A simulação é local e não transmite documentos à SEFAZ.</p>
      </div>
      <Link to="/admin/fiscal/config" className="btn-ghost" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>Configuração do emitente</Link>
    </header>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 20 }}>
      {[
        ['Produtos', resumo.total, '#12283F'],
        ['NCM configurado', resumo.comNcm, '#FF6B2C'],
        ['Pendências', resumo.pendentes, resumo.pendentes ? '#c0392b' : '#18864b'],
      ].map(([label, value, color]) => <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
        <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>{label}</div>
        <div style={{ color, fontSize: 26, fontWeight: 850, marginTop: 5 }}>{value}</div>
      </div>)}
    </div>

    <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
        <div><h2 style={{ margin: 0, fontSize: 16 }}>Tabela IBPT versionada</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>Importe o CSV oficial com as colunas <strong>ncm</strong>, <strong>nacional</strong> e <strong>importado</strong>. A nova versão substitui a ativa apenas para a empresa atual.</p></div>
        {tabelasIbpt.find(tabela => tabela.ativa) && <span style={{ color: '#18864b', fontSize: 12, fontWeight: 800 }}>ATIVA: {tabelasIbpt.find(tabela => tabela.ativa).versao}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(130px,.6fr) minmax(130px,.6fr) minmax(220px,1.2fr) auto', gap: 10, alignItems: 'end' }}>
        <Field label="Versão / referência" value={versaoIbpt} onChange={e => setVersaoIbpt(e.target.value)} placeholder="Ex.: IBPT 25.2.A" />
        <Field label="Início vigência" type="date" value={vigenciaInicio} onChange={e => setVigenciaInicio(e.target.value)} />
        <Field label="Fim vigência" type="date" value={vigenciaFim} onChange={e => setVigenciaFim(e.target.value)} />
        <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>CSV oficial IBPT<input type="file" accept=".csv,text/csv" onChange={e => setArquivoIbpt(e.target.files?.[0] || null)} style={inputStyle} /></label>
        <button type="button" className="btn-ghost" onClick={importarIbpt} disabled={importandoIbpt} style={{ minHeight: 39, whiteSpace: 'nowrap' }}>{importandoIbpt ? 'Importando…' : 'Importar CSV'}</button>
      </div>
      {tabelasIbpt.length > 0 && <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12 }}>{tabelasIbpt.slice(0, 3).map(tabela => <span key={tabela.id} style={{ marginRight: 12 }}>{tabela.ativa ? '●' : '○'} {tabela.versao} · {tabela.quantidadeLinhas} NCMs · {new Date(tabela.criadaEm).toLocaleDateString('pt-BR')}</span>)}</div>}
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,0.9fr) minmax(0,1.5fr)', gap: 20, alignItems: 'start' }}>
      <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: 15, borderBottom: '1px solid var(--line)' }}>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto, NCM ou CFOP" style={inputStyle} />
        </div>
        <div style={{ maxHeight: '67vh', overflowY: 'auto' }}>
          {filtrados.map(item => <button key={item.id} type="button" onClick={() => abrir(item)} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', background: selecionado?.id === item.id ? 'rgba(255,107,44,.10)' : 'transparent', color: 'var(--fg)', padding: '13px 15px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong style={{ fontSize: 13 }}>{item.nome}</strong><span style={{ fontSize: 11, color: item.pendencias?.length ? '#c0392b' : '#18864b', fontWeight: 800 }}>{item.pendencias?.length ? 'PENDENTE' : 'OK'}</span></div>
            <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12 }}>{item.categoria} · {money(item.preco)} · NCM {item.fiscal?.ncm || 'não informado'}</div>
          </button>)}
          {!filtrados.length && <p style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Nenhum produto encontrado.</p>}
        </div>
      </section>

      <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
        {!selecionado ? <div style={{ padding: '70px 15px', textAlign: 'center', color: 'var(--muted)' }}>Selecione um produto para configurar e simular sua classificação tributária.</div> : <>
          <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 16, marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>{selecionado.nome}</h2>
            <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 13 }}>{selecionado.categoria} · Preço atual: <strong>{money(selecionado.preco)}</strong></p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            <Field label="NCM (8 dígitos)" value={form.ncm} onChange={e => update('ncm', e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000000" />
            <Field label="CEST" value={form.cest} onChange={e => update('cest', e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="0000000" />
            <Field label="CFOP" value={form.cfop} onChange={e => update('cfop', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="5102" />
            <div><label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Origem<select value={form.origem} onChange={e => update('origem', e.target.value)} style={inputStyle}><option value="0">0 — Nacional</option><option value="1">1 — Importação direta</option><option value="2">2 — Estrangeira mercado interno</option></select></label></div>
            <Field label="Unidade tributável" value={form.unidadeTributavel} onChange={e => update('unidadeTributavel', e.target.value.toUpperCase())} placeholder="UN" />
            <Field label="CSOSN (Simples)" value={form.csosn} onChange={e => update('csosn', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="102" />
            <Field label="CST ICMS (Normal)" value={form.cstIcms} onChange={e => update('cstIcms', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="00" />
            <Field label="CST PIS" value={form.cstPis} onChange={e => update('cstPis', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="49" />
            <Field label="CST COFINS" value={form.cstCofins} onChange={e => update('cstCofins', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="49" />
            <Field label="ICMS (%)" type="number" value={form.aliquotaIcms} onChange={e => update('aliquotaIcms', e.target.value)} placeholder="0" />
            <Field label="ICMS ST (%)" type="number" value={form.aliquotaIcmsSt} onChange={e => update('aliquotaIcmsSt', e.target.value)} placeholder="0" />
            <Field label="MVA ST (%)" type="number" value={form.margemValorAgregadoSt} onChange={e => update('margemValorAgregadoSt', e.target.value)} placeholder="0" />
            <Field label="FCP (%)" type="number" value={form.aliquotaFcp} onChange={e => update('aliquotaFcp', e.target.value)} placeholder="0" />
            <Field label="PIS (%)" type="number" value={form.aliquotaPis} onChange={e => update('aliquotaPis', e.target.value)} placeholder="0" />
            <Field label="COFINS (%)" type="number" value={form.aliquotaCofins} onChange={e => update('aliquotaCofins', e.target.value)} placeholder="0" />
            <Field label="IBPT nacional (%)" type="number" value={form.aliquotaIbptNacional} onChange={e => update('aliquotaIbptNacional', e.target.value)} placeholder="0" />
            <Field label="IBPT importado (%)" type="number" value={form.aliquotaIbptImportado} onChange={e => update('aliquotaIbptImportado', e.target.value)} placeholder="0" />
          </div>
          <div style={{ marginTop: 12 }}><Field label="Enquadramento legal / observação" value={form.enquadramentoLegal} onChange={e => update('enquadramentoLegal', e.target.value)} placeholder="Referência validada com o contador" /></div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar classificação'}</button>
            <button type="button" className="btn-ghost" onClick={simular} disabled={simulando}>{simulando ? 'Calculando…' : 'Simular tributos'}</button>
          </div>

          {simulacao && <div style={{ marginTop: 20, padding: 16, background: 'rgba(18,40,63,.05)', border: '1px solid var(--line)', borderRadius: 10 }}>
            <strong style={{ color: '#12283F' }}>Simulação local — nenhum documento transmitido</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginTop: 12, fontSize: 13 }}>
              <div><span style={{ color: 'var(--muted)' }}>Total do item</span><br /><b>{money(simulacao.totais?.valorTotal)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>ICMS</span><br /><b>{money(simulacao.totais?.valorIcms)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>ICMS ST</span><br /><b>{money(simulacao.totais?.valorSt)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>PIS</span><br /><b>{money(simulacao.totais?.valorPis)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>COFINS</span><br /><b>{money(simulacao.totais?.valorCofins)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>IBPT aprox.</span><br /><b>{money(simulacao.totais?.valorTributosAproximados)}</b></div>
            </div>
            {simulacao.pendencias?.length > 0 && <ul style={{ margin: '13px 0 0', paddingLeft: 18, color: '#a94442', fontSize: 12 }}>{simulacao.pendencias.map((item, index) => <li key={`${item.item}-${index}`}>Item {item.item}: {item.pendencia}</li>)}</ul>}
          </div>}
        </>}
      </section>
    </div>
  </div>
}
