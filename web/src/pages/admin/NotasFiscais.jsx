import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const STATUS = {
  rascunho: { label: 'Rascunho', cor: '#5B6B7B', bg: '#EEF2F5' },
  validado_local: { label: 'Validado localmente', cor: '#107A48', bg: '#E7F7EF' },
  rejeitado_local: { label: 'Rejeitado localmente', cor: '#B42318', bg: '#FEECEB' },
  autorizada: { label: 'Autorizada', cor: '#107A48', bg: '#E7F7EF' },
  contingencia: { label: 'Contingência', cor: '#B54708', bg: '#FFF1E6' },
  cancelada: { label: 'Cancelada', cor: '#5B6B7B', bg: '#EEF2F5' },
}
const statusFiscal = status => STATUS[status] || { label: status || 'Sem status', cor: '#5B6B7B', bg: '#EEF2F5' }

export default function NotasFiscais() {
  const { toast } = useToast()
  const [documentos, setDocumentos] = useState([])
  const [vendas, setVendas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [previsao, setPrevisao] = useState(null)
  const [busy, setBusy] = useState(null)

  const carregar = useCallback(async (quiet = false) => {
    try {
      const [docs, vendasResposta] = await Promise.all([
        api.get('/api/v1/fiscal/documentos'),
        api.get('/api/admin/vendas?hoje=1'),
      ])
      setDocumentos(Array.isArray(docs?.documentos) ? docs.documentos : [])
      setVendas(Array.isArray(vendasResposta?.vendas) ? vendasResposta.vendas : [])
    } catch (erro) {
      if (!quiet) toast(erro.message || 'Não foi possível carregar a central fiscal.', 'error')
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    carregar()
    const interval = setInterval(() => carregar(true), 30000)
    return () => clearInterval(interval)
  }, [carregar])

  const abrirPrevia = async (venda, modelo = '65') => {
    setBusy(`preview-${venda.id}`)
    try {
      const resposta = await api.get(`/api/v1/fiscal/comandas/${venda.id}/preview?modelo=${modelo}`)
      setPrevisao({ venda, ...resposta.previa })
    } catch (erro) { toast(erro.message || 'Não foi possível montar a prévia fiscal.', 'error') }
    finally { setBusy(null) }
  }

  const gerarRascunho = async () => {
    if (!previsao?.aptoParaRascunho) return
    setBusy(`draft-${previsao.comandaId}`)
    try {
      const resposta = await api.post(`/api/v1/fiscal/comandas/${previsao.comandaId}/rascunho`, { modelo: previsao.modelo })
      toast(resposta.mensagem || 'Rascunho fiscal validado localmente.')
      setPrevisao(null)
      await carregar(true)
    } catch (erro) {
      const pendencias = erro?.pendencias?.join(' ') || erro.message
      toast(pendencias || 'Não foi possível gerar o rascunho fiscal.', 'error')
    } finally { setBusy(null) }
  }

  const baixarXml = documento => {
    window.open(`/api/v1/fiscal/documentos/${documento.id}/xml`, '_blank', 'noopener,noreferrer')
  }

  const filtrados = useMemo(() => {
    const consulta = filtro.trim().toLowerCase()
    if (!consulta) return documentos
    return documentos.filter(doc => [doc.numero, doc.serie, doc.chaveAcesso, doc.status, doc.origemId].some(valor => String(valor || '').toLowerCase().includes(consulta)))
  }, [documentos, filtro])

  const kpis = useMemo(() => ({
    documentos: documentos.length,
    validados: documentos.filter(doc => doc.status === 'validado_local').length,
    pendentes: documentos.filter(doc => ['rascunho', 'rejeitado_local'].includes(doc.status)).length,
    valor: documentos.filter(doc => doc.status === 'validado_local').reduce((soma, doc) => soma + Number(doc.valorTotal || 0), 0),
  }), [documentos])

  return (
    <div className="page" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, color: '#12283F' }}>Central Fiscal</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>Prévia, assinatura local e validação XSD. Nenhum documento é transmitido à SEFAZ nesta etapa.</p>
        </div>
        <button className="btn" onClick={() => carregar()} disabled={loading}>Atualizar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          ['Documentos', kpis.documentos, '#12283F'],
          ['Validados localmente', kpis.validados, '#107A48'],
          ['Pendências locais', kpis.pendentes, '#B54708'],
          ['Valor validado', fmtR(kpis.valor), '#FF6B2C'],
        ].map(([label, valor, cor]) => <div key={label} className="card" style={{ padding: 14 }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div><div style={{ color: cor, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{valor}</div></div>)}
      </div>

      {previsao && (
        <section className="card" style={{ padding: 16, marginBottom: 18, border: '1px solid #FFB28E', background: '#FFF9F5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div><h2 style={{ margin: 0, fontSize: 17, color: '#12283F' }}>Prévia fiscal da comanda {previsao.comandaId}</h2><div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Modelo {previsao.modelo === '65' ? '65 — NFC-e' : '55 — NF-e'} · {fmtR(previsao.totais?.valorTotal || 0)} · emissão externa bloqueada</div></div>
            <button className="btn" onClick={() => setPrevisao(null)}>Fechar</button>
          </div>
          {(previsao.preflight?.pendencias?.length || previsao.pendencias?.length) ? (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#FFF1E6', color: '#8A3D00', fontSize: 13 }}>
              <strong>Pendências antes do rascunho:</strong>
              <ul style={{ margin: '7px 0 0', paddingLeft: 19 }}>{[...(previsao.preflight?.pendencias || []), ...(previsao.pendencias || [])].map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
            </div>
          ) : <div style={{ marginTop: 12, color: '#107A48', fontWeight: 700, fontSize: 13 }}>A prévia está pronta para gerar um rascunho assinado e validado localmente.</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn primary" disabled={!previsao.aptoParaRascunho || busy === `draft-${previsao.comandaId}`} onClick={gerarRascunho}>Gerar rascunho local</button>
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><h2 style={{ margin: 0, fontSize: 17, color: '#12283F' }}>Vendas fechadas para prévia</h2><div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>Somente comandas integralmente quitadas podem seguir para o fluxo fiscal.</div></div>
        </div>
        {vendas.length === 0 ? <div style={{ color: 'var(--muted)', marginTop: 14 }}>Não há vendas fechadas no recorte atual.</div> : <div className="table-wrap" style={{ marginTop: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}><th style={{ padding: 8 }}>Comanda</th><th style={{ padding: 8 }}>Cliente/Mesa</th><th style={{ padding: 8 }}>Total</th><th style={{ padding: 8, textAlign: 'right' }}>Ação</th></tr></thead><tbody>{vendas.slice(0, 20).map(venda => <tr key={venda.id} style={{ borderBottom: '1px solid var(--line)' }}><td style={{ padding: 8, fontWeight: 700 }}>{venda.id}</td><td style={{ padding: 8 }}>{venda.cliente || venda.mesa || 'Atendimento'}</td><td style={{ padding: 8, color: '#12283F', fontWeight: 700 }}>{fmtR(venda.total || 0)}</td><td style={{ padding: 8, textAlign: 'right' }}><button className="btn" disabled={busy === `preview-${venda.id}`} onClick={() => abrirPrevia(venda)}>Prévia NFC-e</button></td></tr>)}</tbody></table></div>}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><h2 style={{ margin: 0, fontSize: 17, color: '#12283F' }}>Documentos fiscais internos</h2><div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>XML disponível apenas para rascunhos validados localmente. Autorização SEFAZ permanece desligada.</div></div>
          <input className="input" placeholder="Buscar número, chave ou status" value={filtro} onChange={evento => setFiltro(evento.target.value)} style={{ maxWidth: 280 }} />
        </div>
        {loading ? <div style={{ padding: 28, textAlign: 'center' }}><div className="spinner" /></div> : filtrados.length === 0 ? <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>Nenhum rascunho fiscal foi criado ainda.</div> : <div className="table-wrap" style={{ marginTop: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}><th style={{ padding: 8 }}>Número/Série</th><th style={{ padding: 8 }}>Modelo</th><th style={{ padding: 8 }}>Valor</th><th style={{ padding: 8 }}>Criado</th><th style={{ padding: 8 }}>Status</th><th style={{ padding: 8, textAlign: 'right' }}>Ação</th></tr></thead><tbody>{filtrados.map(doc => { const badge = statusFiscal(doc.status); return <tr key={doc.id} style={{ borderBottom: '1px solid var(--line)' }}><td style={{ padding: 8, fontWeight: 700 }}>{doc.numero}/{doc.serie}</td><td style={{ padding: 8 }}>{doc.tipo || (doc.modelo === '65' ? 'NFC-e' : 'NF-e')}</td><td style={{ padding: 8, color: '#12283F', fontWeight: 700 }}>{fmtR(doc.valorTotal || 0)}</td><td style={{ padding: 8, color: 'var(--muted)' }}>{fmtDate ? fmtDate(doc.criadoEm) : String(doc.criadoEm || '').slice(0, 16).replace('T', ' ')}</td><td style={{ padding: 8 }}><span style={{ background: badge.bg, color: badge.cor, borderRadius: 20, padding: '3px 9px', fontWeight: 800, fontSize: 11 }}>{badge.label}</span></td><td style={{ padding: 8, textAlign: 'right' }}>{doc.xmlDisponivel && <button className="btn" onClick={() => baixarXml(doc)}>Baixar XML</button>}</td></tr> })}</tbody></table></div>}
      </section>
    </div>
  )
}
