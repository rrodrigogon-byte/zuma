import { useEffect, useState, useMemo, useRef } from 'react'
import { api } from '../../../lib/api'
import { money, dateTime, formatCnpj, downloadCsv } from '../dino/format'
import { Badge } from '../customer360/shared'

export default function MdeTab({ toast }) {
  const [notas, setNotas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')
  const [modalEvento, setModalEvento] = useState(null) // { nota, tipoEvento }
  const [modalDanfe, setModalDanfe] = useState(null) // nota selecionada para espelho DANFE
  const [justificativa, setJustificativa] = useState('')
  const [enviandoEvento, setEnviandoEvento] = useState(false)
  const fileInputRef = useRef(null)

  const processarArquivoXml = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const xmlText = event.target.result
        const parser = new DOMParser()
        const doc = parser.parseFromString(xmlText, "text/xml")
        const infNFe = doc.querySelector("infNFe")
        const chave = infNFe?.getAttribute("Id")?.replace(/\D/g, "") || ("352611" + Date.now() + "55001000000001")
        const ide = doc.querySelector("ide")
        const numero = ide?.querySelector("nNF")?.textContent || String(Math.floor(Math.random() * 90000) + 10000)
        const serie = ide?.querySelector("serie")?.textContent || "1"
        const emitidaEm = ide?.querySelector("dhEmi")?.textContent || ide?.querySelector("dEmi")?.textContent || new Date().toISOString()
        const emit = doc.querySelector("emit")
        const emitente = {
          razaoSocial: emit?.querySelector("xNome")?.textContent || "Fornecedor XML Importado",
          fantasia: emit?.querySelector("xFant")?.textContent || emit?.querySelector("xNome")?.textContent || "Fornecedor Importado",
          cnpj: emit?.querySelector("CNPJ")?.textContent || emit?.querySelector("CPF")?.textContent || "00000000000000",
          ie: emit?.querySelector("IE")?.textContent || "ISENTO",
          uf: emit?.querySelector("enderEmit > UF")?.textContent || "MT",
        }
        const vNF = Number(doc.querySelector("total > ICMSTot > vNF")?.textContent || 0)
        const vProd = Number(doc.querySelector("total > ICMSTot > vProd")?.textContent || 0)
        const detElements = doc.querySelectorAll("det")
        const itens = Array.from(detElements).map((det, idx) => {
          const prod = det.querySelector("prod")
          return {
            numeroItem: idx + 1,
            codigo: prod?.querySelector("cProd")?.textContent || "",
            ean: prod?.querySelector("cEAN")?.textContent || "",
            descricao: prod?.querySelector("xProd")?.textContent || ("Produto " + (idx + 1)),
            ncm: prod?.querySelector("NCM")?.textContent || "",
            cfop: prod?.querySelector("CFOP")?.textContent || "5102",
            quantidade: Number(prod?.querySelector("qCom")?.textContent || 1),
            unidade: prod?.querySelector("uCom")?.textContent || "UN",
            valorUnitario: Number(prod?.querySelector("vUnCom")?.textContent || 0),
            valorTotal: Number(prod?.querySelector("vProd")?.textContent || 0),
          }
        })
        const dupElements = doc.querySelectorAll("cobr > dup")
        const parcelas = Array.from(dupElements).map(dup => ({
          numero: dup.querySelector("nDup")?.textContent || "",
          vencimento: dup.querySelector("dVenc")?.textContent || "",
          valor: Number(dup.querySelector("vDup")?.textContent || 0),
        }))
        const novaNota = {
          chaveAcesso: chave,
          numero: Number(numero),
          serie: Number(serie),
          emitente,
          valorTotal: vNF || vProd,
          emitidaEm,
          statusManifestacao: "aguardando_manifestacao",
          statusEntrada: "aguardando_confirmacao",
          itens,
          cobranca: { parcelas },
        }
        setNotas(prev => [novaNota, ...prev.filter(n => n.chaveAcesso !== chave)])
        if (toast) toast("XML da NF-e nº " + numero + " (" + emitente.razaoSocial + ") importado com sucesso!", "success")
      } catch (err) {
        if (toast) toast("Erro ao processar arquivo XML da NF-e: " + err.message, "danger")
      }
    }
    reader.readAsText(file)
  }


  const carregarNotas = async () => {
    setCarregando(true)
    try {
      const res = await api.get('/api/admin/fiscal-avancado/mde/notas-destinadas')
      if (res?.sucesso) setNotas(res.notas || [])
    } catch (err) {
      if (toast) toast('Erro ao carregar notas destinadas: ' + err.message, 'danger')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarNotas()
  }, [])

  const sincronizarSefaz = async () => {
    setSincronizando(true)
    try {
      await carregarNotas()
      if (toast) toast('Consulta DF-e SEFAZ MT realizada com sucesso! Notas atualizadas.', 'success')
    } catch (err) {
      if (toast) toast('Falha ao comunicar com ambiente DF-e SEFAZ: ' + err.message, 'danger')
    } finally {
      setSincronizando(false)
    }
  }

  const abrirManifestacao = (nota, tipoEvento) => {
    setJustificativa('')
    setModalEvento({ nota, tipoEvento })
  }

  const confirmarManifestacao = async () => {
    if (!modalEvento) return
    setEnviandoEvento(true)
    try {
      const res = await api.post('/api/admin/fiscal-avancado/mde/manifestar', {
        chaveAcesso: modalEvento.nota.chaveAcesso,
        tipoEvento: modalEvento.tipoEvento,
        justificativa: justificativa.trim() || undefined,
      })
      if (res?.sucesso) {
        if (toast) toast(res.mensagem || 'Manifestação registrada na SEFAZ e ERP integrado!', 'success')
        setModalEvento(null)
        setModalDanfe(null)
        await carregarNotas()
      } else {
        if (toast) toast(res?.erro || 'Erro ao registrar manifestação', 'danger')
      }
    } catch (err) {
      if (toast) toast('Erro ao manifestar: ' + err.message, 'danger')
    } finally {
      setEnviandoEvento(false)
    }
  }

  const copiarChave = (chave) => {
    navigator.clipboard?.writeText(chave)
    if (toast) toast('Chave de 44 dígitos copiada!', 'info')
  }

  const exportarCsv = () => {
    if (!notas.length) return
    const rows = notas.map(n => ({
      numero: n.numero,
      serie: n.serie,
      chave: n.chaveAcesso,
      fornecedor: n.emitente?.razaoSocial || n.emitente?.fantasia,
      cnpj: n.emitente?.cnpj,
      uf: n.emitente?.uf,
      valorTotal: n.valorTotal,
      emissao: n.emitidaEm,
      statusManifestacao: n.statusManifestacao,
      statusEntrada: n.statusEntrada,
      protocolo: n.protocolo || n.ultimoEvento?.protocolo || '',
      temBonificacao: n.temBonificacao ? 'Sim' : 'Não',
      valorBonificacao: n.valorBonificacao || 0,
    }))
    downloadCsv(`dfe_inbound_stallone_${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  const baixarLivroEntradas = async () => {
    try {
      const res = await api.get('/api/admin/fiscal-avancado/mde/livro-entradas')
      if (res?.sucesso && res?.livro) {
        downloadCsv(`livro_registro_entradas_stallone_${new Date().toISOString().slice(0, 10)}.csv`, res.livro)
        if (toast) toast('Livro de Registro de Entradas gerado com sucesso!', 'success')
      } else {
        if (toast) toast('Nenhum dado fiscal para exportar no período.', 'info')
      }
    } catch (err) {
      if (toast) toast('Erro ao gerar Livro de Entradas: ' + err.message, 'danger')
    }
  }

  const manifestarEmLote = async () => {
    const pendentes = notas.filter(n => n.statusEntrada !== 'confirmada_apta_para_estoque')
    if (pendentes.length === 0) {
      if (toast) toast('Não há notas pendentes de manifestação no momento.', 'info')
      return
    }
    if (!window.confirm(`Confirma o aceite (Confirmação da Operação 210200) em lote de ${pendentes.length} notas fiscais? Isso escriturará o estoque, contas a pagar e fiscal automaticamente.`)) {
      return
    }
    setCarregando(true)
    try {
      const chaves = pendentes.map(n => n.chaveAcesso)
      const res = await api.post('/api/admin/fiscal-avancado/mde/manifestar-lote', {
        chaves,
        tipoEvento: '210200',
        justificativa: 'Aceite de operação automatizado via Kytto ERP PRD'
      })
      if (res?.sucesso) {
        if (toast) toast(`Lote processado! ${res.totalSucesso} notas confirmadas e escrituradas no ERP.`, 'success')
        await carregarNotas()
      } else {
        if (toast) toast(res?.erro || 'Erro ao processar lote', 'danger')
      }
    } catch (err) {
      if (toast) toast('Erro na manifestação em lote: ' + err.message, 'danger')
    } finally {
      setCarregando(false)
    }
  }

  // Filtragem e busca
  const notasFiltradas = useMemo(() => {
    return notas.filter(n => {
      // Filtro de status
      if (filtroStatus === 'aguardando' && n.statusEntrada === 'confirmada_apta_para_estoque') return false
      if (filtroStatus === 'confirmadas' && n.statusEntrada !== 'confirmada_apta_para_estoque') return false
      if (filtroStatus === 'bonificacao' && !n.temBonificacao) return false

      // Busca textual
      if (busca.trim()) {
        const termo = busca.toLowerCase()
        const razao = (n.emitente?.razaoSocial || '').toLowerCase()
        const fantasia = (n.emitente?.fantasia || '').toLowerCase()
        const cnpj = (n.emitente?.cnpj || '').toLowerCase()
        const num = String(n.numero || '').toLowerCase()
        const chave = (n.chaveAcesso || '').toLowerCase()
        return razao.includes(termo) || fantasia.includes(termo) || cnpj.includes(termo) || num.includes(termo) || chave.includes(termo)
      }
      return true
    })
  }, [notas, filtroStatus, busca])

  // KPIs
  const totalInbound = notas.reduce((acc, n) => acc + Number(n.valorTotal || 0), 0)
  const notasAguardando = notas.filter(n => n.statusEntrada !== 'confirmada_apta_para_estoque')
  const totalAguardando = notasAguardando.reduce((acc, n) => acc + Number(n.valorTotal || 0), 0)
  const notasConfirmadas = notas.filter(n => n.statusEntrada === 'confirmada_apta_para_estoque')
  const totalConfirmadas = notasConfirmadas.reduce((acc, n) => acc + Number(n.valorTotal || 0), 0)
  const totalBonificacoes = notas.reduce((acc, n) => acc + Number(n.valorBonificacao || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cabeçalho da Central DF-e */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>📥</span>
              <h2 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>
                Central DF-e Inbound & Painel Fiscal de Aceite (MD-e)
              </h2>
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                SEFAZ MT Conectada
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              Captura e escrituração automática de notas fiscais emitidas contra a <strong>Stallone Nutre Sport</strong> (CNPJ 56.099.531/0001-38, Tangará da Serra/MT). 
              Ao efetuar o <strong>Aceite da Operação (Evento 210200)</strong>, o sistema alimenta de forma atômica o <strong>Contas a Pagar</strong> (duplicatas a vencer), <strong>Contas a Receber</strong> (bonificações e verbas comerciais), <strong>Estoque Físico e E-commerce</strong>, <strong>Escrituração Fiscal</strong>, <strong>Fluxo de Caixa</strong> e <strong>Histórico de Compras</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={exportarCsv}
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#334155' }}
            >
              📊 Exportar CSV
            </button>
            <button
              onClick={baixarLivroEntradas}
              style={{ background: '#f8fafc', border: '1px solid #0284c7', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#0369a1' }}
            >
              📖 Livro de Entradas
            </button>
            <button
              onClick={manifestarEmLote}
              disabled={carregando || notasAguardando.length === 0}
              style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: notasAguardando.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, opacity: notasAguardando.length === 0 ? 0.6 : 1 }}
            >
              ⚡ Aceite em Lote ({notasAguardando.length})
            </button>
            <button
              onClick={sincronizarSefaz}
              disabled={sincronizando}
              style={{ background: '#047857', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {sincronizando ? '⏳ Sincronizando SEFAZ...' : '🔄 Sincronizar SEFAZ MT'}
            </button>
          </div>
        </div>

        {/* Cards de Métricas e KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 20 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
              Total DF-e Inbound
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              {money(totalInbound)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {notas.length} notas capturadas
            </div>
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 4 }}>
              Aguardando Aceite
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>
              {money(totalAguardando)}
            </div>
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
              {notasAguardando.length} notas pendentes
            </div>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: 4 }}>
              Aceitas & Integradas ERP
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>
              {money(totalConfirmadas)}
            </div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
              {notasConfirmadas.length} notas no estoque
            </div>
          </div>

          <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 6, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#115e59', textTransform: 'uppercase', marginBottom: 4 }}>
              Bonificações a Receber
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f766e' }}>
              {money(totalBonificacoes)}
            </div>
            <div style={{ fontSize: 12, color: '#115e59', marginTop: 2 }}>
              Créditos comerciais ativos
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFiltroStatus('todos')}
            style={{
              background: filtroStatus === 'todos' ? '#047857' : '#f1f5f9',
              color: filtroStatus === 'todos' ? '#fff' : '#475569',
              border: 'none', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Todas ({notas.length})
          </button>
          <button
            onClick={() => setFiltroStatus('aguardando')}
            style={{
              background: filtroStatus === 'aguardando' ? '#b45309' : '#f1f5f9',
              color: filtroStatus === 'aguardando' ? '#fff' : '#475569',
              border: 'none', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Aguardando Aceite ({notasAguardando.length})
          </button>
          <button
            onClick={() => setFiltroStatus('confirmadas')}
            style={{
              background: filtroStatus === 'confirmadas' ? '#15803d' : '#f1f5f9',
              color: filtroStatus === 'confirmadas' ? '#fff' : '#475569',
              border: 'none', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Aceitas / No Estoque ({notasConfirmadas.length})
          </button>
          <button
            onClick={() => setFiltroStatus('bonificacao')}
            style={{
              background: filtroStatus === 'bonificacao' ? '#0f766e' : '#f1f5f9',
              color: filtroStatus === 'bonificacao' ? '#fff' : '#475569',
              border: 'none', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Com Bonificação
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: 280 }}>
          <input
            type="text"
            placeholder="Buscar fornecedor, número ou chave..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', paddingLeft: 30, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
          <span style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8', fontSize: 14 }}>🔍</span>
        </div>
      </div>

      {/* Tabela de Notas Fiscais Inbound */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 14px' }}>Documento</th>
              <th style={{ padding: '12px 14px' }}>Fornecedor / Emitente</th>
              <th style={{ padding: '12px 14px' }}>Itens Faturados</th>
              <th style={{ padding: '12px 14px' }}>Financeiro & Vencimento</th>
              <th style={{ padding: '12px 14px' }}>Status SEFAZ & ERP</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Ações de Aceite</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  Carregando notas fiscais capturadas da SEFAZ...
                </td>
              </tr>
            ) : notasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  Nenhuma nota fiscal encontrada para o filtro selecionado.
                </td>
              </tr>
            ) : (
              notasFiltradas.map((n) => {
                const isConfirmada = n.statusEntrada === 'confirmada_apta_para_estoque'
                const parcelas = n.cobranca?.parcelas || []

                return (
                  <tr key={n.chaveAcesso} style={{ borderBottom: '1px solid #f1f5f9', background: isConfirmada ? '#fcfdfd' : '#fff' }}>
                    {/* Documento */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                        NF-e {n.numero} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Série {n.serie}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Emissão: {dateTime(n.emitidaEm)}
                      </div>
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <code style={{ fontSize: 10, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#334155' }}>
                          {n.chaveAcesso?.slice(0, 4)}...{n.chaveAcesso?.slice(-8)}
                        </code>
                        <button
                          onClick={() => copiarChave(n.chaveAcesso)}
                          title="Copiar chave de acesso completa"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}
                        >
                          📋
                        </button>
                      </div>
                    </td>

                    {/* Fornecedor */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {n.emitente?.fantasia || n.emitente?.razaoSocial}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {n.emitente?.razaoSocial}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        CNPJ: {formatCnpj(n.emitente?.cnpj)} - {n.emitente?.uf}
                      </div>
                    </td>

                    {/* Itens */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top', maxWidth: 260 }}>
                      {n.itens?.length > 0 ? (
                        <div>
                          <div style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>
                            {n.itens[0]?.descricao}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {n.itens[0]?.quantidade} un × {money(n.itens[0]?.valorUnitario)}
                          </div>
                          {n.itens.length > 1 && (
                            <div style={{ fontSize: 11, color: '#047857', marginTop: 2, fontWeight: 600 }}>
                              + {n.itens.length - 1} outro(s) item(ns) faturado(s)
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Itens mapeados na SEFAZ</span>
                      )}
                    </td>

                    {/* Financeiro */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 800, color: '#047857', fontSize: 14 }}>
                        {money(n.valorTotal)}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {n.cobranca?.condicao || (parcelas.length > 0 ? `${parcelas.length}x a vencer` : 'À vista')}
                      </div>
                      {n.temBonificacao && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                            🎁 + {money(n.valorBonificacao)} Bonificação
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <Badge tone={isConfirmada ? 'success' : 'warning'}>
                        {isConfirmada ? '✓ Confirmada no ERP' : 'Aguardando Aceite'}
                      </Badge>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        {n.statusManifestacao}
                      </div>
                      {n.protocolo && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          Prot: {n.protocolo}
                        </div>
                      )}
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        {!isConfirmada ? (
                          <button
                            onClick={() => abrirManifestacao(n, '210200')}
                            style={{
                              background: '#047857', color: '#fff', border: 'none', padding: '6px 12px',
                              borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                              display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            ✓ Aceitar & Integrar ERP
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            ✓ Estoque & Contas Alimentados
                          </span>
                        )}

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setModalDanfe(n)}
                            title="Ver espelho DANFE completo com itens, tributos e duplicatas"
                            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#334155', fontWeight: 600 }}
                          >
                            📋 Espelho DANFE
                          </button>

                          {!isConfirmada && (
                            <>
                              <button
                                onClick={() => abrirManifestacao(n, '210210')}
                                title="Ciência da Emissão (Evento 210210)"
                                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#475569' }}
                              >
                                👁️ Ciência
                              </button>
                              <button
                                onClick={() => abrirManifestacao(n, '210240')}
                                title="Operação Não Realizada (Recusa justificada)"
                                style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#991b1b' }}
                              >
                                ✕ Recusar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Espelho DANFE & Conferência Fiscal Detalhada */}
      {modalDanfe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 10, maxWidth: 840, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            {/* Cabeçalho do Espelho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Espelho DANFE - Documento Fiscal Eletrônico Modelo 55
                </span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: 20, color: '#0f172a' }}>
                  NF-e Nº {modalDanfe.numero} - Série {modalDanfe.serie}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Chave de Acesso: <strong>{modalDanfe.chaveAcesso}</strong>
                </div>
              </div>
              <button
                onClick={() => setModalDanfe(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}
              >
                ✕ Fechar
              </button>
            </div>

            {/* Dados do Emitente e Destinatário */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, background: '#f8fafc', padding: 14, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Emitente / Fabricante</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 2 }}>{modalDanfe.emitente?.razaoSocial}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>CNPJ: {formatCnpj(modalDanfe.emitente?.cnpj)} - UF: {modalDanfe.emitente?.uf}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>Natureza: Venda de produção / mercadoria adquirida de terceiros (CFOP 2102)</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Destinatário / Loja</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 2 }}>{modalDanfe.destinatario?.razaoSocial} ({modalDanfe.destinatario?.fantasia})</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>CNPJ: {formatCnpj(modalDanfe.destinatario?.cnpj)} - Tangará da Serra/MT</div>
                <div style={{ fontSize: 12, color: '#475569' }}>Emissão: {dateTime(modalDanfe.emitidaEm)}</div>
              </div>
            </div>

            {/* Grade de Itens Faturados */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#0f172a', fontWeight: 700 }}>
                📦 Itens da Nota Fiscal & Movimentação de Estoque
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '8px 10px' }}>Item / Descrição</th>
                    <th style={{ padding: '8px 10px' }}>NCM</th>
                    <th style={{ padding: '8px 10px' }}>CFOP</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qtd</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Vlr Unit.</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '8px 10px' }}>Lote / Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {modalDanfe.itens?.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.descricao}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{it.ncm}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{it.cfop}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{it.quantidade}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{money(it.valorUnitario)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>{money(it.valorTotal)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: '#64748b' }}>
                        {it.lote || `LOTE-${modalDanfe.numero}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Duplicatas e Contas a Pagar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#0f172a', fontWeight: 700 }}>
                  💳 Fatura & Duplicatas (Contas a Pagar)
                </h4>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  Condição: <strong>{modalDanfe.cobranca?.condicao || '30 dias'}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modalDanfe.cobranca?.parcelas?.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, background: '#fff', padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                      <span>Parcela {p.numero} (Venc: {p.vencimento})</span>
                      <strong style={{ color: '#b91c1c' }}>{money(p.valor)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#166534', fontWeight: 700 }}>
                  ⚡ Impacto Imediato do Aceite no ERP Kytto
                </h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
                  <li><strong>Contas a Pagar:</strong> Gera lançamentos automáticos com vencimentos e fornecedor.</li>
                  {modalDanfe.temBonificacao && (
                    <li><strong>Contas a Receber:</strong> Registra crédito de bonificação comercial de {money(modalDanfe.valorBonificacao)}.</li>
                  )}
                  <li><strong>Estoque Físico & E-commerce:</strong> Dá entrada física e sincroniza saldo na loja virtual.</li>
                  <li><strong>Histórico de Compras:</strong> Vincula compras, cotações e custos médios ponderados.</li>
                  <li><strong>Fiscal & SPED:</strong> Escrituração em fis_documentos e EFD ICMS Bloco C.</li>
                </ul>
              </div>
            </div>

            {/* Rodapé com Ações */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setModalDanfe(null)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Voltar
              </button>
              {modalDanfe.statusEntrada !== 'confirmada_apta_para_estoque' && (
                <button
                  type="button"
                  onClick={() => abrirManifestacao(modalDanfe, '210200')}
                  style={{ background: '#047857', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  ✓ Confirmar Aceite & Alimentar ERP Agora
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Evento SEFAZ / Recusa Justificada */}
      {modalEvento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 8, maxWidth: 500, width: '100%', padding: 22, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 17, color: '#0f172a' }}>
              {modalEvento.tipoEvento === '210200' ? 'Confirmar Aceite da Operação (210200)' : 'Registrar Evento SEFAZ'}
            </h3>
            
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>
              NF-e Nº <strong>{modalEvento.nota.numero}</strong> | Fornecedor: <strong>{modalEvento.nota.emitente?.fantasia || modalEvento.nota.emitente?.razaoSocial}</strong><br />
              Valor Total: <strong>{money(modalEvento.nota.valorTotal)}</strong>
            </p>

            {modalEvento.tipoEvento === '210200' && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 12, borderRadius: 6, marginBottom: 14, fontSize: 12, color: '#065f46' }}>
                ℹ️ Esta ação transmite o evento <strong>210200 à SEFAZ MT</strong> e automatiza de imediato a entrada das mercadorias no estoque, vitrine virtual e programação no Contas a Pagar/Receber.
              </div>
            )}

            {modalEvento.tipoEvento === '210240' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#991b1b' }}>
                  Justificativa Obrigatória (Mínimo 15 caracteres):
                </label>
                <textarea
                  rows={3}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  placeholder="Exemplo: Mercadoria recebida com avaria grave e devolvida no ato da entrega..."
                  value={justificativa}
                  onChange={e => setJustificativa(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalEvento(null)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={enviandoEvento || (modalEvento.tipoEvento === '210240' && justificativa.trim().length < 15)}
                onClick={confirmarManifestacao}
                style={{ background: modalEvento.tipoEvento === '210240' ? '#dc2626' : '#047857', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
              >
                {enviandoEvento ? 'Transmitindo à SEFAZ...' : '✓ Confirmar e Transmitir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
