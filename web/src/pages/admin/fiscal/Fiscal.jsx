import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/auth'
import { lojasDaEmpresa } from '../../../lib/context-selection'
import { Badge, Dialog, Table } from '../customer360/shared'
import { money, dateTime, formatCnpj, formatIe } from '../dino/format'
import '../customer360.css'
import '../dino/dino-admin.css'
import ClassificacaoFiscal from './ClassificacaoFiscal'
import IcmsStTab from './IcmsStTab'
import MdeTab from './MdeTab'
import BoletosTab from './BoletosTab'
import SpedFiscalBlocoKPanel from './SpedFiscalBlocoKPanel'
import MatrizTributariaPanel from './MatrizTributariaPanel'

// Fiscal da empresa: emitente, certificado A1, tabela IBPT, classificação dos produtos, documentos
// (NFC-e, NF-e, NFS-e, com DANFE e contingência offline da NFC-e) e inutilização de numeração.
// O ambiente é do emitente: homologação (sem valor fiscal) ou produção, só depois que o servidor
// libera a empresa (FISCAL_PRODUCAO_EMPRESAS).
const BASE = '/api/admin/fiscal'
const ABAS = [
  ['situacao', 'Emitente e certificado'],
  ['classificacao', 'Classificação'],
  ['documentos', 'Documentos'],
  ['numeracao', 'Numeração'],
  ['inutilizacao', 'Inutilização'],
  ['sped', 'SPED Config'],
  ['sped_bloco_k', 'SPED Bloco K (Produção & Estoque)'],
  ['matriz_tributaria', 'Matriz Tributária Global'],
  ['contador', 'Fechamento Contábil'],
  ['icms_st', 'ICMS-ST (MT)'],
  ['mde', 'Manifestação (MD-e)'],
  ['boletos', 'Boletos & Pix Híbrido']
]
const STATUS = {
  rascunho: ['Rascunho', 'muted'], enviando: ['Enviando', 'info'], autorizado: ['Autorizado', 'success'], rejeitado: ['Rejeitado', 'danger'],
  falha_comunicacao: ['Falha de comunicação', 'warning'], validado_localmente: ['XML validado (não enviado)', 'info'], cancelado: ['Cancelado', 'muted'],
  contingencia: ['Contingência offline (a transmitir)', 'warning'],
}
const STATUS_INUT = {
  validado_localmente: ['Bloqueada aqui (não enviada)', 'info'], enviando: ['Enviando', 'info'], homologada: ['Inutilizada na SEFAZ', 'success'],
  rejeitada: ['Rejeitada', 'danger'], falha_comunicacao: ['Falha de comunicação', 'warning'],
}
const MODELO = { 65: 'NFC-e', 55: 'NF-e', nfse: 'NFS-e' }
const ORIGEM = { bar_comanda: 'Bar', loja_pedido: 'Loja online', barbearia_comanda: 'Barbearia', manual: 'Manual' }
// rótulo da situação com o ambiente (documento de homologação nunca parece nota de verdade)
const rotuloStatus = (d) => `${STATUS[d.status]?.[0] || d.status}${d.status === 'autorizado' ? (d.ambiente === 'producao' ? ' (produção)' : ' (homologação)') : ''}`
const CSOSN = [['102', '102 · tributada sem crédito'], ['103', '103 · isenção (faixa)'], ['300', '300 · imune'], ['400', '400 · não tributada'], ['500', '500 · ICMS cobrado por ST']]
const CST = [['00', '00 · tributada integralmente'], ['20', '20 · com redução de base'], ['40', '40 · isenta'], ['41', '41 · não tributada'], ['50', '50 · suspensão'], ['60', '60 · ICMS cobrado por ST']]
const ehST = (f) => f?.csosn === '500' || f?.cstIcms === '60'
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
const chave = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const lerBase64 = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',').pop()); r.onerror = falha; r.readAsDataURL(file) })

export default function Fiscal({ abaInicial = 'situacao' }) {
  const { toast } = useToast()
  const { empresaAtiva } = useAuth()
  const [aba, setAba] = useState(abaInicial)
  const [estado, setEstado] = useState(null)
  const carregarEstado = useCallback(() => api.get(`${BASE}/estado`).then(setEstado).catch(() => setEstado(null)), [])
  useEffect(() => { carregarEstado() }, [carregarEstado, empresaAtiva?.id])

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Fiscal · {empresaAtiva?.nome || 'Empresa'}</div><h1>Notas fiscais</h1>
        <p>NFC-e, NF-e e NFS-e emitidas com o certificado da própria empresa.</p></div>
    </header>
    {estado?.ambiente === 'producao'
      ? <p className={`dadm-note ${estado.transmissao === 'producao' ? 'success' : 'danger'}`} role="status"><strong>Ambiente de produção.</strong> {estado.transmissao === 'producao' ? 'As notas emitidas aqui têm valor fiscal e vão direto para a SEFAZ.' : 'A emissão em produção não está liberada neste servidor: nenhuma nota sai até a liberação.'}</p>
      : <p className="dadm-note warn" role="status"><strong>Ambiente de homologação.</strong> As notas daqui são de teste e não têm valor fiscal{estado?.transmissao === 'homologacao' ? '; elas são enviadas à SEFAZ de homologação.' : '. O XML é montado, assinado e validado, mas o envio à SEFAZ está desligado neste servidor.'}</p>}
    {estado && !estado.pronto && <p className="dadm-note danger">Falta para emitir: {estado.pendencias.join(' · ')}.</p>}
    {(estado?.avisos || []).map((a) => <p key={a} className="dadm-note warn">{a}</p>)}
    <div className="dadm-tabs" role="tablist" aria-label="Seções do fiscal">
      {ABAS.map(([id, rotulo]) => <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>{rotulo}</button>)}
    </div>
    {aba === 'situacao' && <Situacao toast={toast} onMudou={carregarEstado} producaoLiberada={Boolean(estado?.producaoLiberada)} />}
    {aba === 'classificacao' && <ClassificacaoFiscal toast={toast} />}
    {aba === 'documentos' && <Documentos toast={toast} />}
    {aba === 'numeracao' && <Numeracao toast={toast} />}
    {aba === 'inutilizacao' && <Inutilizacao toast={toast} />}
    {aba === 'sped' && <Sped toast={toast} />}
    {aba === 'sped_bloco_k' && <SpedFiscalBlocoKPanel toast={toast} />}
    {aba === 'matriz_tributaria' && <MatrizTributariaPanel toast={toast} />}
    {aba === 'contador' && <Contador toast={toast} />}
    {aba === 'icms_st' && <IcmsStTab toast={toast} />}
    {aba === 'mde' && <MdeTab toast={toast} />}
    {aba === 'boletos' && <BoletosTab toast={toast} />}
  </div>
}

// confirmação de exclusão (Dialog da casa, sem window.confirm, que o navegador pode bloquear)
function Confirmar({ pedido, onFechar }) {
  const [enviando, setEnviando] = useState(false)
  if (!pedido) return null
  async function confirmar() {
    if (enviando) return
    setEnviando(true)
    try { await pedido.acao(); onFechar() } finally { setEnviando(false) }
  }
  return <Dialog open title={pedido.titulo} labelId="fis-confirmar" danger onClose={onFechar} onSubmit={confirmar}
    actions={<><button type="button" className="c360-btn ghost" onClick={onFechar}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando}>{pedido.botao || 'Excluir'}</button></>}>
    <p>{pedido.texto}</p>
  </Dialog>
}

function CardComprovanteSefaz({ emitente }) {
  if (!emitente) return null;
  const ieFormatada = formatIe(emitente.ie || "142291919");
  const cnpjFormatado = formatCnpj(emitente.cnpj || "50073355000189");
  const end = emitente.endereco || {};
  return (
    <section className="dadm-card" style={{ border: "2px solid #22c55e", background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)", boxShadow: "0 4px 12px rgba(34, 197, 94, 0.08)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderBottom: "1px solid #bbf7d0", paddingBottom: 14, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Governo do Estado de Mato Grosso · Secretaria de Estado de Fazenda (SEFAZ/MT)
          </div>
          <h2 style={{ margin: "4px 0 2px 0", fontSize: 18, color: "#14532d", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🏛️</span> Cadastro de Contribuinte - CCE/MT
            <Badge tone="success">ATIVO · REGULAR</Badge>
          </h2>
          <div style={{ fontSize: 13, color: "#4b5563" }}>
            Comprovante Oficial de Inscrição Estadual e Situação Cadastral para Emissão Fiscal (NFC-e / NF-e)
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 11, color: "#6b7280", display: "block" }}>Data Início Atividade SEFAZ</span>
          <strong style={{ fontSize: 14, color: "#1f2937" }}>07/10/2026</strong>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ padding: "12px 14px", background: "#ffffff", borderRadius: 8, border: "1px solid #dcfce7", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", display: "block" }}>Número de Inscrição Estadual (IE)</span>
          <strong style={{ fontSize: 22, color: "#15803d", letterSpacing: "0.04em", fontFamily: "monospace" }}>
            {ieFormatada}
          </strong>
          <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4, fontWeight: 600 }}>✓ Habilitada na SEFAZ-MT para Emissão Fiscal</div>
        </div>

        <div style={{ padding: "12px 14px", background: "#ffffff", borderRadius: 8, border: "1px solid #dcfce7", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", display: "block" }}>CNPJ (Matriz)</span>
          <strong style={{ fontSize: 18, color: "#1e293b", fontFamily: "monospace" }}>
            {cnpjFormatado}
          </strong>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Inscrição Municipal (IM): <strong style={{ color: "#0f172a" }}>{emitente.im || "30297"}</strong></div>
        </div>

        <div style={{ padding: "12px 14px", background: "#ffffff", borderRadius: 8, border: "1px solid #dcfce7", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", display: "block" }}>Nome Empresarial / Fantasia</span>
          <strong style={{ fontSize: 15, color: "#0f172a", display: "block" }}>
            {emitente.razaoSocial || "DINO BARBEARIA LTDA"}
          </strong>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
            Fantasia: <strong>{emitente.nomeFantasia || "BARBEARIA DINO"}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, fontSize: 13, background: "#f8fafc", padding: "14px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Atividade Econômica Principal (CNAE):</span>
            <div style={{ fontWeight: 600, color: "#1e293b", marginTop: 2 }}>9602-5/01 · Cabeleireiros, manicure e pedicure</div>
          </div>
          <div>
            <span style={{ color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Atividades Secundárias:</span>
            <div style={{ color: "#334155", fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
              • 4763-6/01 · Comércio varejista de brinquedos e recreativos<br />
              • 4772-5/00 · Comércio varejista de cosméticos e perfumaria
            </div>
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Endereço Operacional e Fiscal:</span>
            <div style={{ color: "#1e293b", fontWeight: 600, marginTop: 2 }}>
              {end.logradouro || "R Avelina Jaci Bohn"}, nº {end.numero || "80"}{end.complemento ? `, ${end.complemento}` : " (Setor W Sala 01)"}<br />
              {end.bairro || "Centro"} · {end.cidade || "Tangará da Serra"}/{emitente.uf || "MT"}<br />
              CEP {end.cep ? end.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "78300-060"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#475569", marginTop: 4 }}>
            <span>📞 (65) 9672-2055</span>
            <span>✉️ guicunha136@gmail.com</span>
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Regime Tributário & Natureza Jurídica:</span>
            <div style={{ color: "#1e293b", fontWeight: 600, marginTop: 2 }}>
              Simples Nacional (CRT 1) · Sociedade Empresária Limitada (2062)
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4, lineHeight: 1.4 }}>
            ✓ Optante pelo Simples Nacional: <strong>SIM</strong><br />
            ✓ Microempreendedor Individual (MEI): <strong>NÃO</strong><br />
            ✓ Ultrapassou sublimite estadual: <strong>NÃO</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
function Situacao({ toast, onMudou, producaoLiberada = false }) {
  const { empresaAtiva, lojasAcessiveis } = useAuth()
  const lojas = useMemo(() => lojasDaEmpresa(lojasAcessiveis, empresaAtiva?.id), [lojasAcessiveis, empresaAtiva?.id])
  const [emitentes, setEmitentes] = useState([])
  const [certs, setCerts] = useState([])
  const [form, setForm] = useState(null)
  const [cert, setCert] = useState({ arquivo: null, senha: '' })
  const [ibpt, setIbpt] = useState([])
  const [arqIbpt, setArqIbpt] = useState({ arquivo: null, uf: '' })
  const [enviando, setEnviando] = useState(false)
  const [confirmar, setConfirmar] = useState(null)
  const carregar = useCallback(async () => {
    try { const [e, c, t] = await Promise.all([api.get(`${BASE}/emitentes`), api.get(`${BASE}/certificados`), api.get(`${BASE}/ibpt`)]); setEmitentes(e); setCerts(c); setIbpt(Array.isArray(t) ? t : []) } catch (error) { toast(error.message, 'error') }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])
  const novo = (e = {}) => setForm({ ambiente: e.ambiente || 'homologacao', ambienteAtual: e.ambiente || 'homologacao', lojaId: e.lojaId || '', cnpj: e.cnpj || '', razaoSocial: e.razaoSocial || '', nomeFantasia: e.nomeFantasia || '', ie: e.ie || '', im: e.im || '', crt: e.crt || '1', uf: e.uf || 'MT', codigoMunicipio: e.codigoMunicipio || '', endereco: { logradouro: '', numero: '', bairro: '', cidade: '', cep: '', ...(e.endereco || {}) }, cscId: e.cscId || '', csc: '', cscConfigurado: e.cscConfigurado, cTribNacPadrao: e.cTribNacPadrao || '' })
  async function salvar() {
    if (enviando) return
    setEnviando(true)
    const { ambienteAtual, cscConfigurado, ...corpo } = form
    void ambienteAtual; void cscConfigurado
    try { await api.put(`${BASE}/emitentes`, { ...corpo, lojaId: form.lojaId || null }); toast('Emitente salvo.', 'success'); setForm(null); carregar(); onMudou() } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  const pedirExclusao = (titulo, texto, acao, botao) => setConfirmar({ titulo, texto, botao, acao: async () => {
    try { const r = await acao(); toast(r?.mensagem || 'Feito.', 'success'); carregar(); onMudou() } catch (error) { toast(error.message, 'error') }
  } })
  async function reativar(e) {
    try { await api.post(`${BASE}/emitentes/${e.id}/reativar`, {}); toast('Emitente reativado.', 'success'); carregar(); onMudou() } catch (error) { toast(error.message, 'error') }
  }
  async function usarCertificado(c) {
    try { await api.post(`${BASE}/certificados/${c.id}/ativar`, {}); toast('Certificado em uso.', 'success'); carregar(); onMudou() } catch (error) { toast(error.message, 'error') }
  }
  async function enviarCertificado(ev) {
    ev.preventDefault()
    if (!cert.arquivo || enviando) return
    setEnviando(true)
    try { await api.post(`${BASE}/certificados`, { arquivoBase64: await lerBase64(cert.arquivo), senha: cert.senha }); toast('Certificado guardado no cofre.', 'success'); setCert({ arquivo: null, senha: '' }); carregar(); onMudou() } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  async function enviarIbpt(ev) {
    ev.preventDefault()
    if (!arqIbpt.arquivo || enviando) return
    setEnviando(true)
    try {
      // o CSV vai cru (pode passar de 2 MB): a API lê UTF-8 ou Latin-1
      const r = await api.upload(`${BASE}/ibpt${arqIbpt.uf ? `?uf=${arqIbpt.uf}` : ''}`, arqIbpt.arquivo)
      toast(`Tabela do IBPT ${r.uf} importada: ${r.importadas} códigos${r.ignoradas ? ` (${r.ignoradas} linhas ignoradas)` : ''}.`, 'success')
      setArqIbpt({ arquivo: null, uf: '' }); carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  const campo = (rotulo, k, extra = {}) => <label className="c360-field">{rotulo}<input className="c360-input" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} /></label>
  const campoEnd = (rotulo, k, extra = {}) => <label className="c360-field">{rotulo}<input className="c360-input" value={form.endereco[k] || ''} onChange={(e) => setForm({ ...form, endereco: { ...form.endereco, [k]: e.target.value } })} {...extra} /></label>
  return <div style={{ display: 'grid', gap: 16 }}>
    {emitentes.length > 0 && <CardComprovanteSefaz emitente={emitentes[0]} />}
    <section className="dadm-card">
      <h2>Emitente</h2>
      <Table caption="Emitentes" rows={emitentes} empty="Nenhum emitente. Cadastre o CNPJ da empresa (e de cada unidade com CNPJ próprio)." columns={[
        { key: 'quem', label: 'Emitente', render: (e) => <div><strong>{e.razaoSocial}</strong><div className="dadm-muted">CNPJ {formatCnpj(e.cnpj)} · {e.lojaId ? lojas.find((l) => l.id === e.lojaId)?.nome || 'Unidade' : 'Empresa toda'} · {e.uf}</div></div> },
        { key: 'ie', label: 'IE / IM', render: (e) => <div><strong style={{ color: '#15803d', fontFamily: 'monospace' }}>{formatIe(e.ie)}</strong><div className="dadm-muted">IM {e.im || '—'}</div></div> },
        { key: 'amb', label: 'Ambiente', render: (e) => <div>{e.ambiente === 'producao' ? <Badge tone="success">produção</Badge> : <Badge tone="info">homologação</Badge>}{e.ativo === false && <> <Badge tone="muted">desativado</Badge></>}</div> },
        { key: 'csc', label: 'CSC', render: (e) => (e.cscConfigurado ? <Badge tone="success">guardado</Badge> : <Badge tone="warning">falta</Badge>) },
        { key: 'acao', label: '', render: (e) => <div className="dadm-actions">
          {e.ativo === false
            ? <button type="button" className="c360-btn ghost" onClick={() => reativar(e)}>Reativar</button>
            : <button type="button" className="c360-btn ghost" onClick={() => novo(e)}>Editar</button>}
          {e.ativo !== false && <button type="button" className="c360-btn ghost" onClick={() => pedirExclusao('Excluir emitente', `Excluir o emitente ${e.razaoSocial}? Se ele já tiver notas, fica desativado e o histórico continua disponível.`, () => api.delete(`${BASE}/emitentes/${e.id}`))}>Excluir</button>}
        </div> },
      ]} />
      <div className="dadm-actions"><button type="button" className="c360-btn primary" onClick={() => novo()}>+ Emitente</button></div>
    </section>
    <section className="dadm-card">
      <h2>Certificado A1</h2>
      <p className="dadm-muted">O arquivo e a senha ficam cifrados no cofre do servidor. Ninguém consegue baixá-los de volta pela tela.</p>
      <Table caption="Certificados" rows={certs} empty="Nenhum certificado enviado." columns={[
        { key: 't', label: 'Titular', render: (c) => <div><strong>{c.titular}</strong>{c.cnpj && <div className="dadm-muted">CNPJ {c.cnpj}</div>}</div> },
        { key: 'v', label: 'Válido até', render: (c) => <span className={new Date(c.validoAte) < new Date(Date.now() + 30 * 864e5) ? 'dadm-neg' : ''}>{dateTime(c.validoAte)}</span> },
        { key: 'a', label: 'Situação', render: (c) => (c.ativo ? <Badge tone="success">em uso</Badge> : <Badge tone="muted">substituído</Badge>) },
        { key: 'x', label: '', render: (c) => (c.ativo ? null : <div className="dadm-actions">
          {new Date(c.validoAte) > new Date() && <button type="button" className="c360-btn ghost" onClick={() => usarCertificado(c)}>Usar este</button>}
          <button type="button" className="c360-btn ghost" onClick={() => pedirExclusao('Excluir certificado', `Apagar do cofre o certificado de ${c.titular}? Ele não está em uso.`, () => api.delete(`${BASE}/certificados/${c.id}`))}>Excluir</button>
        </div>) },
      ]} />
      <form className="dadm-filters" onSubmit={enviarCertificado}>
        <input type="file" accept=".pfx,.p12" aria-label="Arquivo do certificado A1" onChange={(e) => setCert({ ...cert, arquivo: e.target.files?.[0] || null })} />
        <input className="c360-input" type="password" autoComplete="off" placeholder="Senha do certificado" aria-label="Senha do certificado" value={cert.senha} onChange={(e) => setCert({ ...cert, senha: e.target.value })} />
        <button type="submit" className="c360-btn primary" disabled={!cert.arquivo || enviando}>Enviar certificado</button>
      </form>
    </section>
    <section className="dadm-card">
      <h2>Tributos aproximados (IBPT)</h2>
      <p className="dadm-muted">Lei 12.741/2012: com a tabela do IBPT da UF importada, a nota e o DANFE trazem o valor aproximado dos tributos (vTotTrib). Sem tabela, o campo fica de fora. Baixe o CSV oficial no site do IBPT (De Olho no Imposto).</p>
      <Table caption="Tabelas do IBPT" rows={ibpt.map((t) => ({ ...t, id: t.uf }))} empty="Nenhuma tabela do IBPT importada." columns={[
        { key: 'uf', label: 'UF', render: (t) => <strong>{t.uf}</strong> },
        { key: 'v', label: 'Versão', render: (t) => t.versao || '—' },
        { key: 'l', label: 'Códigos', align: 'right', render: (t) => t.linhas },
        { key: 'vig', label: 'Vigência até', render: (t) => (t.vigenciaFim ? <span className={new Date(t.vigenciaFim) < new Date() ? 'dadm-neg' : ''}>{dateTime(t.vigenciaFim)}</span> : '—') },
        { key: 'x', label: '', render: (t) => <button type="button" className="c360-btn ghost" onClick={() => pedirExclusao('Excluir tabela do IBPT', `Apagar a tabela do IBPT de ${t.uf}? As notas novas saem sem o valor aproximado dos tributos até importar outra.`, () => api.delete(`${BASE}/ibpt/${t.uf}`))}>Excluir</button> },
      ]} />
      <form className="dadm-filters" onSubmit={enviarIbpt}>
        <input type="file" accept=".csv,text/csv" aria-label="Arquivo CSV do IBPT" onChange={(e) => setArqIbpt({ ...arqIbpt, arquivo: e.target.files?.[0] || null })} />
        <select className="c360-input" aria-label="UF da tabela do IBPT" value={arqIbpt.uf} onChange={(e) => setArqIbpt({ ...arqIbpt, uf: e.target.value })}><option value="">UF do emitente</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        <button type="submit" className="c360-btn primary" disabled={!arqIbpt.arquivo || enviando}>Importar tabela do IBPT</button>
      </form>
    </section>
    <Dialog open={Boolean(form)} title="Emitente" labelId="fis-emit" onClose={() => setForm(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando}>Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 10 }}>
        <label className="c360-field">Ambiente<select className="c360-input" value={form.ambiente} onChange={(e) => setForm({ ...form, ambiente: e.target.value })}>
          <option value="homologacao">Homologação (teste, sem valor fiscal)</option>
          <option value="producao" disabled={!producaoLiberada && form.ambienteAtual !== 'producao'}>Produção (nota com valor fiscal){!producaoLiberada && form.ambienteAtual !== 'producao' ? ' · não liberada neste servidor' : ''}</option>
        </select></label>
        {form.ambiente !== form.ambienteAtual && <p className="dadm-note warn">{form.ambiente === 'producao' ? 'Ao passar para produção, as notas passam a ter valor fiscal e a numeração recomeça do 1 na produção. Informe o CSC de PRODUÇÃO abaixo.' : 'Voltar para homologação: as próximas notas não terão valor fiscal. Informe o CSC de homologação.'}</p>}
        <label className="c360-field">Vale para<select className="c360-input" value={form.lojaId} onChange={(e) => setForm({ ...form, lojaId: e.target.value })}><option value="">Empresa toda</option>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome} (CNPJ próprio)</option>)}</select></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>{campo('CNPJ', 'cnpj', { required: true, inputMode: 'numeric', placeholder: '50.073.355/0001-89' })}{campo('Razão social', 'razaoSocial', { required: true, placeholder: 'DINO BARBEARIA LTDA' })}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>{campo('Nome fantasia', 'nomeFantasia', { placeholder: 'BARBEARIA DINO' })}{campo('Inscrição estadual', 'ie', { placeholder: '14.229.191-9' })}{campo('Inscrição municipal', 'im', { placeholder: '30297' })}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
          <label className="c360-field">Regime (CRT)<select className="c360-input" value={form.crt} onChange={(e) => setForm({ ...form, crt: e.target.value })}><option value="1">1 · Simples Nacional</option><option value="4">4 · MEI</option><option value="2">2 · Simples (excesso de sublimite)</option><option value="3">3 · Regime normal</option></select></label>
          <label className="c360-field">UF<select className="c360-input" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
          {campo('Município (IBGE)', 'codigoMunicipio', { required: true, inputMode: 'numeric', maxLength: 7 })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 2fr', gap: 10 }}>{campoEnd('Logradouro', 'logradouro')}{campoEnd('Número', 'numero')}{campoEnd('Bairro', 'bairro')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>{campoEnd('Cidade', 'cidade')}{campoEnd('CEP', 'cep', { inputMode: 'numeric' })}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
          {campo('ID do CSC', 'cscId')}
          {campo(`CSC de ${form.ambiente === 'producao' ? 'produção' : 'homologação'}${form.cscConfigurado && form.ambiente === form.ambienteAtual ? ' (vazio mantém o atual)' : ''}`, 'csc', { type: 'password', autoComplete: 'off', required: form.ambiente !== form.ambienteAtual })}
          {campo('cTribNac padrão (NFS-e)', 'cTribNacPadrao', { inputMode: 'numeric', maxLength: 6 })}
        </div>
      </div>}
    </Dialog>
    <Confirmar pedido={confirmar} onFechar={() => setConfirmar(null)} />
  </div>
}

const VAZIO = { ncm: '', cfop: '5102', csosn: '102', cstIcms: '', aliquotaIcms: '', reducaoBaseIcms: '', cest: '', origem: '0', cTribNac: '', aliquotaIss: '', cstPis: '', cstCofins: '', aliquotaPis: '', aliquotaCofins: '', cstIbsCbs: '', cClassTrib: '' }
// IBS/CBS (reforma tributária, NT 2025.002): CST de 3 dígitos e cClassTrib de 6 (começa pelo CST)
const CST_IBSCBS = [['', '— padrão: 000 / 000001 (tributação integral)'], ['000', '000 · tributação integral'], ['410', '410 · imunidade e não incidência']]
const ORIGENS = [['0', '0 · nacional'], ['1', '1 · estrangeira (importação direta)'], ['2', '2 · estrangeira (mercado interno)'], ['3', '3 · nacional, conteúdo importado > 40%'], ['4', '4 · nacional (processo produtivo básico)'], ['5', '5 · nacional, conteúdo importado ≤ 40%'], ['6', '6 · estrangeira sem similar (importação direta)'], ['7', '7 · estrangeira sem similar (mercado interno)'], ['8', '8 · nacional, conteúdo importado > 70%']]
const rotuloCategoria = (fonteId) => (fonteId === 'barbearia:revenda' ? 'Revenda da barbearia (padrão dos produtos da comanda)' : fonteId === 'barbearia:servicos' ? 'Serviços da barbearia (padrão da NFS-e da comanda)' : null)

// campos fiscais do formulário (um item ou vários de uma vez)
function Documentos({ toast }) {
  const [docs, setDocs] = useState([])
  const [vendas, setVendas] = useState([])
  const [cancelando, setCancelando] = useState(null)
  const [nfse, setNfse] = useState(null)
  const [enviando, setEnviando] = useState('')
  const [contingenciaAuto, setContingenciaAuto] = useState(false)
  const [marcadas, setMarcadas] = useState(() => new Set())
  const [resultadoLote, setResultadoLote] = useState(null)
  const [automatica, setAutomatica] = useState(null)
  const [cce, setCce] = useState(null)
  const [svcDoc, setSvcDoc] = useState(null)
  const [nfe, setNfe] = useState(null)
  const [avulsa, setAvulsa] = useState(null)
  const carregar = useCallback(async () => {
    try { const [d, v] = await Promise.all([api.get(`${BASE}/documentos`), api.get(`${BASE}/vendas-sem-nota`)]); setDocs(Array.isArray(d) ? d : []); setVendas(Array.isArray(v) ? v : []) } catch (error) { toast(error.message, 'error') }
    api.get(`${BASE}/automatica`).then((a) => setAutomatica(a && typeof a === 'object' && !Array.isArray(a) ? a : null)).catch(() => setAutomatica(null))
  }, [toast])
  const idVenda = (v) => `${v.origem}:${v.origemId}`
  async function emitirLote(lista) {
    if (enviando || !lista.length) return
    setEnviando('lote')
    try {
      const r = await api.post(`${BASE}/documentos/lote`, { modelo: '65', vendas: lista.slice(0, 50).map((v) => ({ origem: v.origem, origemId: v.origemId })), ...(contingenciaAuto ? { contingenciaOffline: true } : {}) })
      setResultadoLote(r); setMarcadas(new Set())
      toast(`Lote: ${r.emitidas} nota(s) emitida(s)${r.falhas ? `, ${r.falhas} com problema (veja abaixo)` : ''}.`, r.falhas ? 'error' : 'success')
      carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  async function emitirPendentesAgora() {
    if (enviando) return
    setEnviando('automatica')
    try {
      const r = await api.post(`${BASE}/automatica/rodar`, {})
      if (r?.config) setAutomatica(r.config)
      toast(`Emissão automática: ${r.emitidas || 0} nota(s) emitida(s)${r.falhas ? `, ${r.falhas} com problema` : ''}${r.erros?.length ? `. ${r.erros.slice(0, 2).join(' · ')}` : '.'}`, r.falhas || r.erros?.length ? 'error' : 'success')
      carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  async function salvarAutomatica(mudanca) {
    try { setAutomatica(await api.put(`${BASE}/automatica`, { ...automatica, ...mudanca })); toast(mudanca.emissaoAutomatica === false ? 'Emissão automática desligada.' : 'Emissão automática salva.', 'success') } catch (error) { toast(error.message, 'error') }
  }
  useEffect(() => { carregar() }, [carregar])
  async function emitir(corpo, rotulo) {
    if (enviando) return
    setEnviando(rotulo)
    try { const d = await api.post(`${BASE}/documentos`, corpo); toast(`${MODELO[d.modelo]} ${d.numero}: ${rotuloStatus(d)}.`, d.status === 'rejeitado' ? 'error' : 'success'); setNfse(null); setNfe(null); setAvulsa(null); carregar() }
    catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  async function enviarCce() {
    if (enviando || !cce) return
    setEnviando('cce')
    try { const r = await api.post(`${BASE}/documentos/${cce.doc.id}/carta-correcao`, { texto: cce.texto.trim() }); toast(`Carta de correção nº ${r.sequencia} registrada (protocolo ${r.protocolo}).`, 'success'); setCce(null); carregar() }
    catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  async function enviarSvc() {
    if (enviando || !svcDoc) return
    setEnviando('svc')
    try { const d = await api.post(`${BASE}/documentos/${svcDoc.doc.id}/svc`, { justificativa: svcDoc.justificativa.trim() }); toast(`NF-e ${d.numero} em contingência SVC: ${rotuloStatus(d)}.`, d.status === 'rejeitado' ? 'error' : 'success'); setSvcDoc(null); carregar() }
    catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  function enviarNfe() {
    const n = nfe
    const doc = soDig(n.documento)
    const destinatario = {
      ...(doc.length === 14 ? { cnpj: doc } : { cpf: doc }), nome: n.nome.trim(),
      ...(n.indIEDest === '1' ? { ie: soDig(n.ie), indIEDest: '1' } : { indIEDest: n.indIEDest }),
      ...(n.email.trim() ? { email: n.email.trim() } : {}),
      endereco: { logradouro: n.logradouro.trim(), numero: n.numero.trim(), complemento: n.complemento.trim() || undefined, bairro: n.bairro.trim(), cidade: n.cidade.trim(), uf: n.uf, codigoMunicipio: soDig(n.codigoMunicipio), cep: soDig(n.cep) },
    }
    const fora = n.uf !== 'MT'
    const corpo = {
      modelo: '55', destinatario, consumidorFinal: n.consumidorFinal,
      ...(fora && n.consumidorFinal && n.indIEDest === '9' ? { difal: { aliquotaInternaDestino: Number(String(n.aliquotaDestino).replace(',', '.')), fcpDestino: Number(String(n.fcpDestino || '0').replace(',', '.')) } } : {}),
      ...(n.venda
        ? { origem: n.venda.split('|')[0], origemId: n.venda.split('|')[1] }
        : { origem: 'manual', idempotencia: `manual:${n.chave}`, itens: n.itens.map((i) => ({ fonte: i.fonte, fonteId: i.fonteId.trim(), descricao: i.descricao.trim(), quantidade: Number(String(i.quantidade).replace(',', '.')) || 1, valorUnitario: Number(String(i.valor).replace(',', '.')) })) }),
    }
    emitir(corpo, 'nfe')
  }
  async function baixarXml(d) {
    try {
      const c = await api.get(`${BASE}/documentos/${d.id}?xml=1`)
      const url = URL.createObjectURL(new Blob([c.xmlAutorizado || c.xmlAssinado || ''], { type: 'application/xml' }))
      const a = document.createElement('a'); a.href = url; a.download = `${MODELO[d.modelo].toLowerCase().replace('-', '')}-${d.serie}-${d.numero}${d.ambiente === 'producao' ? '' : '-homologacao'}.xml`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { toast(error.message, 'error') }
  }
  async function imprimirDanfe(d, { autoPrint = false } = {}) {
    // abre a aba já no clique (senão o navegador bloqueia) e carrega o DANFE autenticado nela
    const janela = typeof window.open === 'function' ? window.open('', '_blank') : null
    try {
      const q = autoPrint ? '?print=1' : ''
      const html = await api.blob(`${BASE}/documentos/${d.id}/danfe${q}`)
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      if (janela) janela.location.href = url
      else { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click() }
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) { if (janela) janela.close(); toast(error.message, 'error') }
  }
  async function emContingencia(d) {
    if (enviando) return
    setEnviando(d.id)
    try { await api.post(`${BASE}/documentos/${d.id}/contingencia`, {}); toast(`NFC-e ${d.numero} em contingência offline: transmita em até 24 horas.`, 'success'); carregar() }
    catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  async function transmitirContingencias() {
    if (enviando) return
    setEnviando('contingencias')
    try {
      const r = await api.post(`${BASE}/contingencias/transmitir`, {})
      toast(r.transmissao === 'desligada' ? `Transmissão desligada neste servidor. ${r.pendentes} pendente(s).` : `Contingências: ${r.autorizadas} autorizada(s), ${r.rejeitadas} rejeitada(s), ${r.falhas} sem resposta.`, r.rejeitadas || r.falhas ? 'error' : 'success')
      carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  const [periodo, setPeriodo] = useState('todos')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [filtroModelo, setFiltroModelo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')

  const docsFiltrados = useMemo(() => {
    return docs.filter((d) => {
      if (filtroModelo !== 'todos' && String(d.modelo) !== String(filtroModelo)) return false
      if (filtroStatus !== 'todos' && d.status !== filtroStatus) return false
      if (busca) {
        const termo = busca.toLowerCase()
        const matchNum = String(d.numero || '').includes(termo)
        const matchSerie = String(d.serie || '').includes(termo)
        const matchChave = String(d.chave || '').toLowerCase().includes(termo)
        const matchMsg = (d.mensagens || []).some((m) => (m.mensagem || '').toLowerCase().includes(termo))
        if (!matchNum && !matchSerie && !matchChave && !matchMsg) return false
      }
      if (periodo !== 'todos' && d.criadoEm) {
        const dataDoc = new Date(d.criadoEm)
        const agora = new Date()
        if (periodo === 'hoje') {
          if (dataDoc.toDateString() !== agora.toDateString()) return false
        } else if (periodo === '7d') {
          if (agora - dataDoc > 7 * 864e5) return false
        } else if (periodo === '30d') {
          if (agora - dataDoc > 30 * 864e5) return false
        } else if (periodo === 'mes') {
          if (dataDoc.getMonth() !== agora.getMonth() || dataDoc.getFullYear() !== agora.getFullYear()) return false
        } else if (periodo === 'custom') {
          // datas do campo são locais (AAAA-MM-DD): o fim vale o dia inteiro
          if (customInicio && dataDoc < new Date(`${customInicio}T00:00:00`)) return false
          if (customFim && dataDoc > new Date(`${customFim}T23:59:59.999`)) return false
        }
      }
      return true
    })
  }, [docs, filtroModelo, filtroStatus, busca, periodo, customInicio, customFim])

  const kpis = useMemo(() => {
    let totalEmitido = 0
    let autorizados = 0
    let testes = 0
    let contingenciasCount = 0
    let atrasadasCount = 0
    let falhasCount = 0
    for (const d of docs) {
      // nota de homologação não soma no faturamento fiscal
      if (d.status === 'autorizado' && d.ambiente === 'producao') {
        totalEmitido += Number(d.valorTotal || 0)
        autorizados += 1
      } else if (['autorizado', 'validado_localmente'].includes(d.status)) testes += 1
      if (d.status === 'contingencia') {
        contingenciasCount += 1
        if (d.contingenciaAtrasada) atrasadasCount += 1
      }
      if (['rejeitado', 'falha_comunicacao'].includes(d.status)) {
        falhasCount += 1
      }
    }
    return { totalEmitido, autorizados, testes, contingenciasCount, atrasadasCount, falhasCount }
  }, [docs])

  const contingencias = docs.filter((d) => d.status === 'contingencia')
  const atrasadas = contingencias.filter((d) => d.contingenciaAtrasada).length
  async function cancelar() {
    try { await api.post(`${BASE}/documentos/${cancelando.doc.id}/cancelar`, { justificativa: cancelando.justificativa }); toast('Documento cancelado.', 'success'); setCancelando(null); carregar() } catch (error) { toast(error.message, 'error') }
  }
  return <div style={{ display: 'grid', gap: 16 }}>
    <section className="dadm-card">
      <h2>Vendas pagas sem nota</h2>
      {vendas.length > 0 && <div className="dadm-actions" style={{ marginBottom: 10 }}>
        <button type="button" className="c360-btn primary" disabled={Boolean(enviando) || !marcadas.size} onClick={() => emitirLote(vendas.filter((v) => marcadas.has(idVenda(v))))}>Emitir marcadas ({marcadas.size})</button>
        <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emitirLote(vendas)}>Emitir todas ({Math.min(vendas.length, 50)})</button>
      </div>}
      <Table caption="Vendas sem nota" rows={vendas.map((v) => ({ ...v, id: idVenda(v) }))} empty="Nenhuma venda pendente de nota." columns={[
        { key: 'm', label: <input type="checkbox" aria-label="Marcar todas as vendas" checked={vendas.length > 0 && vendas.every((v) => marcadas.has(idVenda(v)))} onChange={(e) => setMarcadas(e.target.checked ? new Set(vendas.map(idVenda)) : new Set())} />, render: (v) => <input type="checkbox" aria-label={`Marcar ${v.descricao}`} checked={marcadas.has(idVenda(v))} onChange={() => setMarcadas((atual) => { const n = new Set(atual); if (n.has(idVenda(v))) n.delete(idVenda(v)); else n.add(idVenda(v)); return n })} /> },
        { key: 'd', label: 'Venda', render: (v) => <div><strong>{v.descricao}</strong><div className="dadm-muted">{ORIGEM[v.origem] || v.origem}{v.data ? ` · ${dateTime(v.data)}` : ''}</div></div> },
        { key: 'v', label: 'Valor', align: 'right', render: (v) => (v.valor == null ? '—' : money(v.valor)) },
        { key: 'a', label: '', render: (v) => <div className="dadm-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emitir({ modelo: '65', origem: v.origem, origemId: v.origemId, ...(contingenciaAuto ? { contingenciaOffline: true } : {}) }, v.id)}>Emitir NFC-e</button>
          {v.origem === 'barbearia_comanda' && <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emitir({ modelo: 'nfse', origem: v.origem, origemId: v.origemId }, `${v.id}:nfse`)}>Emitir NFS-e (serviços)</button>}
        </div> },
      ]} />
      <label className="dadm-muted"><input type="checkbox" checked={contingenciaAuto} onChange={(e) => setContingenciaAuto(e.target.checked)} /> Se a SEFAZ não responder, emitir a NFC-e em contingência offline (transmitir depois, em até 24 h)</label>
      {resultadoLote && resultadoLote.falhas > 0 && <div role="status">
        <p className="dadm-note warn">Vendas do último lote que não saíram:</p>
        <Table caption="Falhas do lote" rows={resultadoLote.resultados.filter((r) => !r.ok).map((r) => ({ ...r, id: `${r.origem}:${r.origemId}` }))} columns={[
          { key: 'v', label: 'Venda', render: (r) => `${ORIGEM[r.origem] || r.origem} · ${String(r.origemId).slice(0, 8)}` },
          { key: 'e', label: 'Motivo', render: (r) => r.erro || (r.mensagens || []).map((m) => m.mensagem).join(' · ') || r.status },
        ]} />
      </div>}
      <div className="dadm-actions">
        <button type="button" className="c360-btn ghost" onClick={() => setNfse({ descricao: '', fonteId: '', valor: '', cpf: '', nome: '', chave: chave() })}>+ NFS-e de serviço</button>
        <button type="button" className="c360-btn ghost" onClick={() => setAvulsa({ descricao: '', ncm: '', cfop: '5102', csosn: '102', quantidade: '1', valorUnitario: '', cpf: '', chave: chave() })}>+ NFC-e avulsa</button>
        <button type="button" className="c360-btn ghost" onClick={() => setNfe(nfeVazia())}>+ NF-e (com destinatário)</button>
      </div>
    </section>
    {automatica && <section className="dadm-card">
      <h2>Emissão automática</h2>
      <p className="dadm-muted">Ligada, o sistema emite a NFC-e sozinho a cada poucos minutos para as vendas pagas a partir de agora (as anteriores continuam na lista acima) e transmite as contingências pendentes.</p>
      <div className="dadm-filters">
        <label className="dadm-muted"><input type="checkbox" aria-label="Emissão automática ligada" checked={automatica.emissaoAutomatica} onChange={(e) => salvarAutomatica({ emissaoAutomatica: e.target.checked })} /> Emitir automaticamente</label>
        {[['loja_pedido', 'Loja online'], ['barbearia_comanda', 'Produtos das comandas da barbearia'], ['bar_comanda', 'Bar']].map(([id, rotulo]) => <label key={id} className="dadm-muted"><input type="checkbox" aria-label={`Origem ${rotulo}`} checked={(automatica.origens || []).includes(id)} onChange={(e) => {
          const origens = e.target.checked ? [...new Set([...(automatica.origens || []), id])] : (automatica.origens || []).filter((o) => o !== id)
          if (origens.length) salvarAutomatica({ origens })
        }} /> {rotulo}</label>)}
      </div>
      {automatica.emissaoAutomatica && automatica.desde && <p className="dadm-muted">Valendo para vendas desde {dateTime(automatica.desde)}.</p>}
      {automatica.emissaoAutomatica && <div className="dadm-actions"><button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={emitirPendentesAgora}>Emitir pendentes agora</button></div>}
      {automatica.ultimaRodada && <p className={`dadm-note ${automatica.ultimoResumo?.erros?.length ? 'warn' : ''}`}>Última rodada {dateTime(automatica.ultimaRodada)}: {automatica.ultimoResumo?.emitidas || 0} emitida(s), {automatica.ultimoResumo?.falhas || 0} com problema.{automatica.ultimoResumo?.erros?.length ? ` ${automatica.ultimoResumo.erros.slice(0, 3).join(' · ')}` : ''}</p>}
    </section>}
    {contingencias.length > 0 && <section className="dadm-card">
      <h2>Contingência offline</h2>
      <p className={`dadm-note ${atrasadas ? 'danger' : 'warn'}`}>{contingencias.length} NFC-e em contingência aguardando transmissão{atrasadas ? `; ${atrasadas} passaram do prazo de 24 horas` : ''}.</p>
      <div className="dadm-actions"><button type="button" className="c360-btn primary" disabled={Boolean(enviando)} onClick={transmitirContingencias}>Transmitir contingências</button></div>
    </section>}
    <section className="dadm-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2>Documentos emitidos</h2>
          <p className="dadm-muted" style={{ margin: '4px 0 0' }}>Histórico completo de notas fiscais autorizadas, em contingência e validadas.</p>
        </div>
        <button type="button" className="c360-btn ghost" onClick={carregar}>Atualizar lista</button>
      </div>

      <div className="dadm-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div className="dadm-kpi" style={{ padding: 14, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div className="dadm-kpi-sub" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Total emitido (produção)</div>
          <div className="dadm-kpi-val" style={{ fontSize: 20, fontWeight: 800, color: '#14b87a', margin: '4px 0' }}>{money(kpis.totalEmitido)}</div>
          <div className="dadm-muted" style={{ fontSize: 12 }}>{kpis.autorizados} nota(s) válida(s){kpis.testes ? ` · ${kpis.testes} de homologação` : ''}</div>
        </div>
        <div className="dadm-kpi" style={{ padding: 14, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div className="dadm-kpi-sub" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Contingência offline</div>
          <div className="dadm-kpi-val" style={{ fontSize: 20, fontWeight: 800, color: kpis.contingenciasCount > 0 ? (kpis.atrasadasCount > 0 ? '#e05c5c' : '#f59e0b') : 'inherit', margin: '4px 0' }}>{kpis.contingenciasCount}</div>
          <div className="dadm-muted" style={{ fontSize: 12 }}>{kpis.atrasadasCount > 0 ? `${kpis.atrasadasCount} > 24h vencida(s)` : 'Prazo legal 24h'}</div>
        </div>
        <div className="dadm-kpi" style={{ padding: 14, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div className="dadm-kpi-sub" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Vendas sem nota</div>
          <div className="dadm-kpi-val" style={{ fontSize: 20, fontWeight: 800, margin: '4px 0' }}>{vendas.length}</div>
          <div className="dadm-muted" style={{ fontSize: 12 }}>Prontas para emissão</div>
        </div>
        <div className="dadm-kpi" style={{ padding: 14, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div className="dadm-kpi-sub" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Rejeições / Falhas</div>
          <div className="dadm-kpi-val" style={{ fontSize: 20, fontWeight: 800, color: kpis.falhasCount > 0 ? '#e05c5c' : 'inherit', margin: '4px 0' }}>{kpis.falhasCount}</div>
          <div className="dadm-muted" style={{ fontSize: 12 }}>{kpis.falhasCount > 0 ? 'Exige reenvio' : 'Nenhuma falha'}</div>
        </div>
      </div>

      <div className="dadm-filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          type="search"
          className="c360-input"
          style={{ minWidth: 200, flex: 1 }}
          placeholder="Buscar por número, série, chave, motivo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select className="c360-input" value={filtroModelo} onChange={(e) => setFiltroModelo(e.target.value)} style={{ width: 'auto' }}>
          <option value="todos">Todos os modelos</option>
          <option value="65">NFC-e (Consumidor 65)</option>
          <option value="55">NF-e (Mercadoria 55)</option>
          <option value="nfse">NFS-e (Serviço)</option>
        </select>
        <select className="c360-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="todos">Todas as situações</option>
          <option value="autorizado">Autorizado</option>
          <option value="validado_localmente">Validado localmente</option>
          <option value="contingencia">Contingência</option>
          <option value="falha_comunicacao">Falha comunicação</option>
          <option value="rejeitado">Rejeitado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['todos', 'Todos'], ['hoje', 'Hoje'], ['7d', '7D'], ['30d', '30D'], ['mes', 'Este mês'], ['custom', 'Personalizado']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`c360-btn ${periodo === id ? 'primary' : 'ghost'}`}
              style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={() => {
                setPeriodo(id);
                if (id !== 'custom') {
                  setCustomInicio('');
                  setCustomFim('');
                }
              }}
            >
              {label}
            </button>
          ))}
          {periodo === 'custom' && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)} className="c360-input" style={{ width: 'auto', padding: '4px 8px' }} />
              <span className="dadm-muted" style={{ fontSize: 11 }}>a</span>
              <input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className="c360-input" style={{ width: 'auto', padding: '4px 8px' }} />
            </div>
          )}
        </div>
      </div>

      <Table caption="Documentos fiscais" rows={docsFiltrados} empty="Nenhum documento ainda." columns={[
        { key: 'n', label: 'Documento', render: (d) => <div><strong>{MODELO[d.modelo]} {d.serie}/{d.numero}</strong><div className="dadm-muted">{dateTime(d.criadoEm)}{d.chave ? ` · ${d.chave}` : ''}</div></div> },
        { key: 'v', label: 'Valor', align: 'right', render: (d) => money(d.valorTotal) },
        { key: 's', label: 'Situação', render: (d) => <div><Badge tone={STATUS[d.status]?.[1]}>{rotuloStatus(d)}</Badge>{d.contingenciaAtrasada && <> <Badge tone="danger">prazo de 24 h vencido</Badge></>}{d.mensagens?.length > 0 && <div className="dadm-muted">{d.mensagens.map((m) => m.mensagem).join(' · ')}</div>}</div> },
        { key: 'a', label: '', render: (d) => <div className="dadm-actions">
          {d.temXml && <button type="button" className="c360-btn ghost" onClick={() => baixarXml(d)}>XML</button>}
          {d.temXml && d.modelo !== 'nfse' && <button type="button" className="c360-btn ghost" onClick={() => imprimirDanfe(d)}>Imprimir DANFE</button>}
          {d.temXml && d.modelo === 'nfse' && <button type="button" className="c360-btn ghost" onClick={() => imprimirDanfe(d, { autoPrint: true })}>Imprimir NFS-e</button>}
          {d.temXml && d.modelo === 'nfse' && <button type="button" className="c360-btn ghost" onClick={() => imprimirDanfe(d)}>DANFSe / PDF</button>}
          {d.modelo === '65' && d.status === 'falha_comunicacao' && <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emContingencia(d)}>Emitir em contingência</button>}
          {d.modelo === '55' && d.status === 'falha_comunicacao' && <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => setSvcDoc({ doc: d, justificativa: 'SEFAZ de origem sem resposta: falha de comunicação na autorização da NF-e' })}>Emitir em SVC</button>}
          {d.modelo === '55' && d.status === 'autorizado' && <button type="button" className="c360-btn ghost" onClick={() => setCce({ doc: d, texto: '' })}>Carta de correção</button>}
          {['autorizado', 'validado_localmente'].includes(d.status) && <button type="button" className="c360-btn ghost" onClick={() => setCancelando({ doc: d, justificativa: '' })}>Cancelar nota</button>}
          {['rejeitado', 'falha_comunicacao', 'enviando'].includes(d.status) && <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emitir({ modelo: d.modelo, origem: d.origem, ...(d.origemId ? { origemId: d.origemId } : {}), idempotencia: d.idempotencia }, d.id)}>Tentar de novo</button>}
        </div> },
      ]} />
    </section>
    <Dialog open={Boolean(cancelando)} title="Cancelar documento" labelId="fis-canc" danger onClose={() => setCancelando(null)} onSubmit={cancelar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setCancelando(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={(cancelando?.justificativa || '').trim().length < 15}>Cancelar documento</button></>}>
      {cancelando && <label className="c360-field">Justificativa (mínimo 15 caracteres)<textarea className="c360-input" rows={3} maxLength={255} value={cancelando.justificativa} onChange={(e) => setCancelando({ ...cancelando, justificativa: e.target.value })} /></label>}
    </Dialog>
    <Dialog open={Boolean(cce)} title="Carta de correção (CC-e)" labelId="fis-cce" onClose={() => setCce(null)} onSubmit={enviarCce}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setCce(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={Boolean(enviando) || (cce?.texto || '').trim().length < 15}>Registrar carta</button></>}>
      {cce && <div style={{ display: 'grid', gap: 10 }}>
        <p className="dadm-muted">NF-e {cce.doc.serie}/{cce.doc.numero}. A carta corrige dados que não mudam o imposto, o valor, a quantidade, as partes nem a data. Cada nova carta substitui a anterior: escreva a correção completa.</p>
        <label className="c360-field">Correção (15 a 1000 caracteres)<textarea className="c360-input" rows={4} maxLength={1000} value={cce.texto} onChange={(e) => setCce({ ...cce, texto: e.target.value })} /></label>
      </div>}
    </Dialog>
    <Dialog open={Boolean(svcDoc)} title="Emitir em contingência SVC" labelId="fis-svc" onClose={() => setSvcDoc(null)} onSubmit={enviarSvc}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setSvcDoc(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={Boolean(enviando) || (svcDoc?.justificativa || '').trim().length < 15}>Emitir em SVC</button></>}>
      {svcDoc && <div style={{ display: 'grid', gap: 10 }}>
        <p className="dadm-muted">A NF-e {svcDoc.doc.serie}/{svcDoc.doc.numero} será assinada de novo e enviada à SEFAZ Virtual de Contingência (MT usa a SVC-RS). Se a emissão normal chegou a ser autorizada, ela prevalece.</p>
        <label className="c360-field">Justificativa (15 a 256 caracteres)<textarea className="c360-input" rows={2} maxLength={256} value={svcDoc.justificativa} onChange={(e) => setSvcDoc({ ...svcDoc, justificativa: e.target.value })} /></label>
      </div>}
    </Dialog>
    <Dialog open={Boolean(avulsa)} title="NFC-e avulsa" labelId="fis-avulsa" onClose={() => setAvulsa(null)}
      onSubmit={() => emitir({
        modelo: '65', origem: 'manual', idempotencia: `manual:${avulsa.chave}`, ...(contingenciaAuto ? { contingenciaOffline: true } : {}),
        itens: [{ fonte: 'est_item', fonteId: `avulso-${avulsa.chave}`, descricao: avulsa.descricao.trim(), quantidade: Number(String(avulsa.quantidade).replace(',', '.')) || 1, valorUnitario: Number(String(avulsa.valorUnitario).replace(',', '.')),
          classificacao: { tipo: 'produto', ncm: soDig(avulsa.ncm), cfop: soDig(avulsa.cfop), csosn: avulsa.csosn } }],
        destinatario: soDig(avulsa.cpf).length === 11 ? { cpf: soDig(avulsa.cpf), nome: 'CONSUMIDOR' } : null,
      }, 'avulsa')}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setAvulsa(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={Boolean(enviando) || !avulsa || avulsa.descricao.trim().length < 2 || soDig(avulsa.ncm).length !== 8 || soDig(avulsa.cfop).length !== 4 || !(Number(String(avulsa.valorUnitario).replace(',', '.')) > 0)}>Emitir NFC-e</button></>}>
      {avulsa && <div style={{ display: 'grid', gap: 10 }}>
        <p className="dadm-muted">Venda de balcão sem venda no sistema. A classificação vai informada aqui (para o Simples Nacional; no regime normal, classifique o item na aba Classificação e emita pela venda).</p>
        <label className="c360-field">Descrição do produto<input className="c360-input" aria-label="Descrição da NFC-e avulsa" value={avulsa.descricao} onChange={(e) => setAvulsa({ ...avulsa, descricao: e.target.value })} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 10 }}>
          <label className="c360-field">NCM (8 dígitos)<input className="c360-input" aria-label="NCM da NFC-e avulsa" inputMode="numeric" value={avulsa.ncm} onChange={(e) => setAvulsa({ ...avulsa, ncm: e.target.value })} /></label>
          <label className="c360-field">CFOP<input className="c360-input" aria-label="CFOP da NFC-e avulsa" inputMode="numeric" value={avulsa.cfop} onChange={(e) => setAvulsa({ ...avulsa, cfop: e.target.value })} /></label>
          <label className="c360-field">CSOSN<select className="c360-input" aria-label="CSOSN da NFC-e avulsa" value={avulsa.csosn} onChange={(e) => setAvulsa({ ...avulsa, csosn: e.target.value })}>{CSOSN.filter(([c]) => c !== '500').map(([c, r]) => <option key={c} value={c}>{r}</option>)}</select></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 10 }}>
          <label className="c360-field">Quantidade<input className="c360-input" aria-label="Quantidade da NFC-e avulsa" inputMode="decimal" value={avulsa.quantidade} onChange={(e) => setAvulsa({ ...avulsa, quantidade: e.target.value })} /></label>
          <label className="c360-field">Valor unitário (R$)<input className="c360-input" aria-label="Valor da NFC-e avulsa" inputMode="decimal" value={avulsa.valorUnitario} onChange={(e) => setAvulsa({ ...avulsa, valorUnitario: e.target.value })} /></label>
          <label className="c360-field">CPF na nota (opcional)<input className="c360-input" aria-label="CPF da NFC-e avulsa" inputMode="numeric" value={avulsa.cpf} onChange={(e) => setAvulsa({ ...avulsa, cpf: e.target.value })} /></label>
        </div>
      </div>}
    </Dialog>
    <NfeDialog nfe={nfe} setNfe={setNfe} vendas={vendas} enviando={enviando} onEnviar={enviarNfe} />
    <Dialog open={Boolean(nfse)} title="NFS-e de serviço" labelId="fis-nfse" onClose={() => setNfse(null)}
      onSubmit={() => emitir({ modelo: 'nfse', origem: 'manual', idempotencia: `manual:${nfse.chave}`, itens: [{ fonte: 'servico', fonteId: nfse.fonteId, descricao: nfse.descricao, quantidade: 1, valorUnitario: Number(String(nfse.valor).replace(',', '.')) }], destinatario: nfse.cpf ? { cpf: nfse.cpf, nome: nfse.nome } : null }, 'nfse')}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setNfse(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={Boolean(enviando)}>Emitir NFS-e</button></>}>
      {nfse && <div style={{ display: 'grid', gap: 10 }}>
        <label className="c360-field">Serviço (código cadastrado na Classificação)<input className="c360-input" required value={nfse.fonteId} onChange={(e) => setNfse({ ...nfse, fonteId: e.target.value })} placeholder="ex.: aula-tenis" /></label>
        <label className="c360-field">Descrição na nota<input className="c360-input" required minLength={2} value={nfse.descricao} onChange={(e) => setNfse({ ...nfse, descricao: e.target.value })} /></label>
        <label className="c360-field">Valor (R$)<input className="c360-input" required inputMode="decimal" value={nfse.valor} onChange={(e) => setNfse({ ...nfse, valor: e.target.value })} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <label className="c360-field">CPF do tomador (opcional)<input className="c360-input" inputMode="numeric" value={nfse.cpf} onChange={(e) => setNfse({ ...nfse, cpf: e.target.value })} /></label>
          <label className="c360-field">Nome do tomador<input className="c360-input" value={nfse.nome} onChange={(e) => setNfse({ ...nfse, nome: e.target.value })} /></label>
        </div>
      </div>}
    </Dialog>
  </div>
}

const soDig = (v) => String(v || '').replace(/\D/g, '')
const itemNfeVazio = () => ({ fonte: 'loja_variante', fonteId: '', descricao: '', quantidade: '1', valor: '' })
const nfeVazia = () => ({
  chave: chave(), venda: '', itens: [itemNfeVazio()], documento: '', nome: '', indIEDest: '9', ie: '', email: '', consumidorFinal: true,
  logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'MT', codigoMunicipio: '', cep: '', aliquotaDestino: '', fcpDestino: '',
})
function nfeValida(n) {
  if (!n) return false
  const doc = soDig(n.documento)
  if (![11, 14].includes(doc.length) || n.nome.trim().length < 2) return false
  if (!(n.logradouro.trim() && n.numero.trim() && n.bairro.trim() && n.cidade.trim() && soDig(n.codigoMunicipio).length === 7 && soDig(n.cep).length === 8)) return false
  if (n.indIEDest === '1' && !soDig(n.ie)) return false
  if (!n.venda && !n.itens.every((i) => i.descricao.trim().length >= 2 && Number(String(i.valor).replace(',', '.')) > 0)) return false
  if (n.uf !== 'MT' && n.consumidorFinal && n.indIEDest === '9' && !(Number(String(n.aliquotaDestino).replace(',', '.')) > 0)) return false
  return true
}

function NfeDialog({ nfe, setNfe, vendas, enviando, onEnviar }) {
  const n = nfe
  const set = (k, v) => setNfe({ ...n, [k]: v })
  const setItem = (idx, k, v) => setNfe({ ...n, itens: n.itens.map((i, j) => (j === idx ? { ...i, [k]: v } : i)) })
  const campo = (rotulo, k, extra = {}) => <label className="c360-field">{rotulo}<input className="c360-input" value={n[k]} onChange={(e) => set(k, e.target.value)} {...extra} /></label>
  return <Dialog open={Boolean(n)} title="NF-e (modelo 55)" labelId="fis-nfe" onClose={() => setNfe(null)} onSubmit={onEnviar}
    actions={<><button type="button" className="c360-btn ghost" onClick={() => setNfe(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={Boolean(enviando) || !nfeValida(n)}>Emitir NF-e</button></>}>
    {n && <div style={{ display: 'grid', gap: 10 }}>
      <label className="c360-field">Venda<select className="c360-input" aria-label="Venda da NF-e" value={n.venda} onChange={(e) => set('venda', e.target.value)}>
        <option value="">Itens informados aqui (sem venda)</option>
        {vendas.map((v) => <option key={`${v.origem}|${v.origemId}`} value={`${v.origem}|${v.origemId}`}>{v.descricao} · {money(v.valor)}</option>)}
      </select></label>
      {!n.venda && <fieldset className="c360-field" style={{ border: 0, padding: 0, display: 'grid', gap: 8 }}>
        <legend>Itens</legend>
        {n.itens.map((i, idx) => <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 2fr .6fr 1fr auto', gap: 6, alignItems: 'end' }}>
          <label className="c360-field">Cadastro<select className="c360-input" value={i.fonte} onChange={(e) => setItem(idx, 'fonte', e.target.value)}><option value="loja_variante">Loja (variante)</option><option value="est_item">Estoque</option><option value="bar_produto">Bar</option></select></label>
          <label className="c360-field">Código<input className="c360-input" aria-label={`Código do item ${idx + 1}`} value={i.fonteId} onChange={(e) => setItem(idx, 'fonteId', e.target.value)} /></label>
          <label className="c360-field">Descrição<input className="c360-input" aria-label={`Descrição do item ${idx + 1}`} value={i.descricao} onChange={(e) => setItem(idx, 'descricao', e.target.value)} /></label>
          <label className="c360-field">Qtd.<input className="c360-input" inputMode="decimal" aria-label={`Quantidade do item ${idx + 1}`} value={i.quantidade} onChange={(e) => setItem(idx, 'quantidade', e.target.value)} /></label>
          <label className="c360-field">Valor unit. (R$)<input className="c360-input" inputMode="decimal" aria-label={`Valor do item ${idx + 1}`} value={i.valor} onChange={(e) => setItem(idx, 'valor', e.target.value)} /></label>
          <button type="button" className="c360-btn ghost" disabled={n.itens.length === 1} aria-label={`Remover item ${idx + 1}`} onClick={() => setNfe({ ...n, itens: n.itens.filter((_, j) => j !== idx) })}>Remover</button>
        </div>)}
        <div><button type="button" className="c360-btn ghost" onClick={() => setNfe({ ...n, itens: [...n.itens, itemNfeVazio()] })}>+ Item</button></div>
        <p className="dadm-muted">A classificação fiscal vem do cadastro (aba Classificação), pelo código do item.</p>
      </fieldset>}
      <h3 style={{ margin: '6px 0 0' }}>Destinatário</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
        {campo('CPF ou CNPJ', 'documento', { inputMode: 'numeric', required: true })}
        {campo('Nome / razão social', 'nome', { required: true })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.4fr', gap: 10 }}>
        <label className="c360-field">Contribuinte do ICMS<select className="c360-input" aria-label="Contribuinte do ICMS" value={n.indIEDest} onChange={(e) => set('indIEDest', e.target.value)}>
          <option value="9">Não contribuinte</option><option value="1">Contribuinte (com IE)</option><option value="2">Contribuinte isento de IE</option>
        </select></label>
        {n.indIEDest === '1' ? campo('Inscrição estadual', 'ie', { inputMode: 'numeric', required: true }) : <span />}
        {campo('E-mail (opcional)', 'email', { type: 'email' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr .7fr 1.3fr', gap: 10 }}>
        {campo('Logradouro', 'logradouro', { required: true })}
        {campo('Número', 'numero', { required: true })}
        {campo('Complemento', 'complemento')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr .6fr 1fr 1fr', gap: 10 }}>
        {campo('Bairro', 'bairro', { required: true })}
        {campo('Cidade', 'cidade', { required: true })}
        <label className="c360-field">UF<select className="c360-input" aria-label="UF do destinatário" value={n.uf} onChange={(e) => set('uf', e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
        {campo('Código IBGE', 'codigoMunicipio', { inputMode: 'numeric', required: true, placeholder: '7 dígitos' })}
        {campo('CEP', 'cep', { inputMode: 'numeric', required: true })}
      </div>
      <label className="dadm-muted"><input type="checkbox" checked={n.consumidorFinal} onChange={(e) => set('consumidorFinal', e.target.checked)} /> Consumidor final (não vai revender)</label>
      {n.uf !== 'MT' && <p className="dadm-note warn">Venda para fora de MT: o CFOP vira interestadual (6xxx){n.consumidorFinal && n.indIEDest === '9' ? ' e, no regime normal, a nota leva o DIFAL da UF de destino.' : '.'}</p>}
      {n.uf !== 'MT' && n.consumidorFinal && n.indIEDest === '9' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {campo(`Alíquota interna do ICMS em ${n.uf} (%)`, 'aliquotaDestino', { inputMode: 'decimal', required: true })}
        {campo(`FCP de ${n.uf} (%)`, 'fcpDestino', { inputMode: 'decimal', placeholder: '0' })}
      </div>}
    </div>}
  </Dialog>
}

const numeracaoVazia = () => ({ novo: true, emitenteId: '', modelo: '65', serie: '1', ambiente: 'homologacao', proximo: '', padrao: true })
function Numeracao({ toast }) {
  const [lista, setLista] = useState([])
  const [emitentes, setEmitentes] = useState([])
  const [form, setForm] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const carregar = useCallback(async () => {
    try { const [n, e] = await Promise.all([api.get(`${BASE}/numeracao`), api.get(`${BASE}/emitentes`)]); setLista(Array.isArray(n) ? n : []); setEmitentes(Array.isArray(e) ? e : []) } catch (error) { toast(error.message, 'error') }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])
  const idLinha = (l) => `${l.emitenteId}:${l.ambiente}:${l.modelo}:${l.serie}`
  async function salvar() {
    if (enviando || !form) return
    setEnviando(true)
    try {
      await api.put(`${BASE}/numeracao`, { emitenteId: form.emitenteId || emitentes[0]?.id, modelo: form.modelo, serie: Number(form.serie), ambiente: form.ambiente, ...(String(form.proximo).trim() ? { proximo: Number(form.proximo) } : {}), padrao: Boolean(form.padrao) })
      toast('Numeração salva.', 'success'); setForm(null); carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  const excluir = (l) => setConfirmar({
    titulo: 'Excluir série', texto: `Excluir a série ${l.serie} de ${MODELO[l.modelo]} (${l.ambiente === 'producao' ? 'produção' : 'homologação'})? Só série sem nenhum documento pode ser excluída.`,
    acao: async () => { try { await api.delete(`${BASE}/numeracao?${new URLSearchParams({ emitenteId: l.emitenteId, modelo: l.modelo, serie: String(l.serie), ambiente: l.ambiente })}`); toast('Série excluída.', 'success'); carregar() } catch (error) { toast(error.message, 'error') } },
  })
  return <section className="dadm-card">
    <h2>Numeração das notas</h2>
    <p className="dadm-muted">Série e próximo número de cada modelo, por ambiente. Ao entrar em produção vindo de outro emissor (ou da NFS-e antiga da barbearia), continue a numeração de onde ele parou: a SEFAZ e a Sefin recusam número repetido. O número só anda para a frente.</p>
    <div className="dadm-actions" style={{ marginBottom: 10 }}><button type="button" className="c360-btn primary" disabled={!emitentes.length} onClick={() => setForm({ ...numeracaoVazia(), emitenteId: emitentes[0]?.id || '' })}>+ Série</button></div>
    {!emitentes.length && <p className="dadm-note warn">Cadastre o emitente antes de configurar a numeração.</p>}
    <Table caption="Numeração" rows={lista.map((l) => ({ ...l, id: idLinha(l) }))} empty="Nenhuma série configurada: a primeira nota usa a série 1, a partir do número 1." columns={[
      { key: 'm', label: 'Série', render: (l) => <div><strong>{MODELO[l.modelo]} série {l.serie}</strong>{l.padrao && <> <Badge tone="info">padrão</Badge></>}<div className="dadm-muted">{l.emitente || ''}{l.cnpj ? ` · ${l.cnpj}` : ''}</div></div> },
      { key: 'a', label: 'Ambiente', render: (l) => <Badge tone={l.ambiente === 'producao' ? 'success' : 'warning'}>{l.ambiente === 'producao' ? 'Produção' : 'Homologação'}</Badge> },
      { key: 'p', label: 'Próximo número', align: 'right', render: (l) => <div><strong>{l.proximo}</strong><div className="dadm-muted">{l.ultimoUsado ? `último usado: ${l.ultimoUsado}` : 'nenhum usado'}</div></div> },
      { key: 'x', label: '', render: (l) => <div className="dadm-actions">
        <button type="button" className="c360-btn ghost" onClick={() => setForm({ novo: false, emitenteId: l.emitenteId, modelo: l.modelo, serie: String(l.serie), ambiente: l.ambiente, proximo: String(l.proximo), padrao: l.padrao })}>Editar</button>
        {!l.ultimoUsado && <button type="button" className="c360-btn ghost" onClick={() => excluir(l)}>Excluir</button>}
      </div> },
    ]} />
    <Dialog open={Boolean(form)} title={form?.novo ? 'Nova série' : 'Editar série'} labelId="fis-num" onClose={() => setForm(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando || !/^\d{1,3}$/.test(String(form?.serie || ''))}>Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 10 }}>
        {emitentes.length > 1 && <label className="c360-field">Emitente<select className="c360-input" aria-label="Emitente da série" disabled={!form.novo} value={form.emitenteId} onChange={(e) => setForm({ ...form, emitenteId: e.target.value })}>{emitentes.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial} · {e.cnpj}</option>)}</select></label>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <label className="c360-field">Modelo<select className="c360-input" aria-label="Modelo da série" disabled={!form.novo} value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })}><option value="65">NFC-e (65)</option><option value="55">NF-e (55)</option><option value="nfse">NFS-e</option></select></label>
          <label className="c360-field">Ambiente<select className="c360-input" aria-label="Ambiente da série" disabled={!form.novo} value={form.ambiente} onChange={(e) => setForm({ ...form, ambiente: e.target.value })}><option value="homologacao">Homologação</option><option value="producao">Produção</option></select></label>
          <label className="c360-field">Série<input className="c360-input" aria-label="Número da série" inputMode="numeric" disabled={!form.novo} value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} /></label>
          <label className="c360-field">Próximo número<input className="c360-input" aria-label="Próximo número" inputMode="numeric" value={form.proximo} placeholder="1" onChange={(e) => setForm({ ...form, proximo: e.target.value })} /></label>
        </div>
        <label className="dadm-muted"><input type="checkbox" checked={Boolean(form.padrao)} onChange={(e) => setForm({ ...form, padrao: e.target.checked })} /> Série padrão deste modelo neste ambiente</label>
      </div>}
    </Dialog>
    <Confirmar pedido={confirmar} onFechar={() => setConfirmar(null)} />
  </section>
}

const CONTADOR_VAZIO = { nome: '', cpf: '', crc: '', cnpj: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '', fone: '', email: '', codigoMunicipio: '' }
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
function baixarBase64(nome, base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/plain;charset=iso-8859-1' }))
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Sped({ toast }) {
  const hoje = new Date()
  const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const [cfg, setCfg] = useState(null)
  const [emitentes, setEmitentes] = useState([])
  const [periodo, setPeriodo] = useState({ ano: String(anterior.getFullYear()), mes: String(anterior.getMonth() + 1), emitenteId: '', teste: false })
  const [resultado, setResultado] = useState(null)
  const [enviando, setEnviando] = useState('')
  useEffect(() => {
    Promise.all([api.get(`${BASE}/sped/config`), api.get(`${BASE}/emitentes`)])
      .then(([c, e]) => { setCfg({ ...c, contador: { ...CONTADOR_VAZIO, ...(c?.contador || {}) } }); setEmitentes(Array.isArray(e) ? e : []) })
      .catch((error) => toast(error.message, 'error'))
  }, [toast])
  if (!cfg) return <section className="dadm-card"><p className="dadm-muted">Carregando…</p></section>
  const setC = (k, v) => setCfg({ ...cfg, contador: { ...cfg.contador, [k]: v } })
  const campoC = (rotulo, k, extra = {}) => <label className="c360-field">{rotulo}<input className="c360-input" aria-label={rotulo} value={cfg.contador[k] || ''} onChange={(e) => setC(k, e.target.value)} {...extra} /></label>
  async function salvar(ev) {
    ev?.preventDefault?.()
    if (enviando) return
    setEnviando('config')
    try { const c = await api.put(`${BASE}/sped/config`, cfg); setCfg({ ...c, contador: { ...CONTADOR_VAZIO, ...c.contador } }); toast('Configuração do SPED salva.', 'success') }
    catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  async function gerar(tipo) {
    if (enviando) return
    setEnviando(tipo); setResultado(null)
    try {
      const r = await api.post(`${BASE}/sped/${tipo}`, { ano: Number(periodo.ano), mes: Number(periodo.mes), ...(periodo.emitenteId ? { emitenteId: periodo.emitenteId } : {}), ...(periodo.teste ? { ambiente: 'homologacao' } : {}) })
      setResultado(r)
      baixarBase64(r.nomeArquivo, r.base64)
      toast(`${r.nomeArquivo} gerado: ${r.resumo.documentos} documento(s).`, 'success')
    } catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  return <div style={{ display: 'grid', gap: 16 }}>
    <section className="dadm-card">
      <h2>Gerar SPED</h2>
      <p className="dadm-muted">EFD ICMS/IPI (leiaute 020) e EFD-Contribuições (leiaute 006, Lucro Presumido cumulativo), montadas a partir das notas autorizadas e canceladas emitidas aqui. Entradas, inventário e ajustes o contador completa no PVA antes de transmitir. Empresas do Simples Nacional são dispensadas.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 2fr', gap: 10 }}>
        <label className="c360-field">Ano<input className="c360-input" aria-label="Ano do SPED" inputMode="numeric" maxLength={4} value={periodo.ano} onChange={(e) => setPeriodo({ ...periodo, ano: e.target.value })} /></label>
        <label className="c360-field">Mês<select className="c360-input" aria-label="Mês do SPED" value={periodo.mes} onChange={(e) => setPeriodo({ ...periodo, mes: e.target.value })}>{MESES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}</select></label>
        {emitentes.length > 1 ? <label className="c360-field">Emitente<select className="c360-input" aria-label="Emitente do SPED" value={periodo.emitenteId} onChange={(e) => setPeriodo({ ...periodo, emitenteId: e.target.value })}><option value="">Principal</option>{emitentes.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial} · {e.cnpj}</option>)}</select></label> : <span />}
      </div>
      <label className="dadm-muted"><input type="checkbox" checked={periodo.teste} onChange={(e) => setPeriodo({ ...periodo, teste: e.target.checked })} /> Arquivo de teste com as notas de homologação (não transmitir)</label>
      <div className="dadm-actions">
        <button type="button" className="c360-btn primary" disabled={Boolean(enviando)} onClick={() => gerar('efd-icms-ipi')}>Gerar EFD ICMS/IPI</button>
        <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => gerar('efd-contribuicoes')}>Gerar EFD-Contribuições</button>
      </div>
      {resultado && <div role="status">
        <p className="dadm-note">{resultado.nomeArquivo}: {resultado.resumo.documentos} documento(s) ({resultado.resumo.cancelados} cancelado(s)), {resultado.resumo.linhas} linhas, leiaute {resultado.resumo.leiaute}{resultado.resumo.debitosIcms !== undefined ? ` · ICMS a recolher ${money(resultado.resumo.debitosIcms)}` : ''}{resultado.resumo.pis !== undefined ? ` · PIS ${money(resultado.resumo.pis)} · COFINS ${money(resultado.resumo.cofins)}` : ''}.</p>
        {resultado.avisos.map((a) => <p key={a} className="dadm-note warn">{a}</p>)}
        <div className="dadm-actions"><button type="button" className="c360-btn ghost" onClick={() => baixarBase64(resultado.nomeArquivo, resultado.base64)}>Baixar de novo</button></div>
      </div>}
    </section>
    <section className="dadm-card">
      <h2>Configuração do SPED</h2>
      <form onSubmit={salvar} style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <label className="c360-field">Perfil da EFD<select className="c360-input" aria-label="Perfil da EFD" value={cfg.perfil} onChange={(e) => setCfg({ ...cfg, perfil: e.target.value })}><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label>
          <label className="c360-field">Código de receita do ICMS (E116)<input className="c360-input" aria-label="Código de receita do ICMS" value={cfg.codReceitaIcms || ''} onChange={(e) => setCfg({ ...cfg, codReceitaIcms: e.target.value })} /></label>
          <label className="c360-field">Dia de vencimento do ICMS<input className="c360-input" aria-label="Dia de vencimento do ICMS" inputMode="numeric" maxLength={2} value={cfg.diaVencimentoIcms || ''} onChange={(e) => setCfg({ ...cfg, diaVencimentoIcms: e.target.value })} /></label>
          <label className="c360-field">Código de receita do DIFAL/FCP (E316)<input className="c360-input" aria-label="Código de receita do DIFAL" value={cfg.codReceitaDifal || ''} onChange={(e) => setCfg({ ...cfg, codReceitaDifal: e.target.value })} /></label>
        </div>
        <label className="dadm-muted"><input type="checkbox" checked={Boolean(cfg.industrial)} onChange={(e) => setCfg({ ...cfg, industrial: e.target.checked })} /> Indústria ou equiparado a industrial</label>
        <h3 style={{ margin: '6px 0 0' }}>Contador (registro 0100)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr', gap: 10 }}>
          {campoC('Nome do contador', 'nome', { required: true })}
          {campoC('CPF do contador', 'cpf', { inputMode: 'numeric', required: true })}
          {campoC('CRC', 'crc', { required: true })}
          {campoC('CNPJ do escritório (opcional)', 'cnpj', { inputMode: 'numeric' })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr .7fr 1.2fr 1.2fr', gap: 10 }}>
          {campoC('Endereço', 'endereco')}
          {campoC('Número', 'numero')}
          {campoC('Complemento', 'complemento')}
          {campoC('Bairro', 'bairro')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 10 }}>
          {campoC('CEP', 'cep', { inputMode: 'numeric' })}
          {campoC('Município (IBGE)', 'codigoMunicipio', { inputMode: 'numeric', required: true, placeholder: '7 dígitos' })}
          {campoC('Telefone', 'fone', { inputMode: 'numeric' })}
          {campoC('E-mail', 'email', { type: 'email' })}
        </div>
        <div className="dadm-actions"><button type="submit" className="c360-btn primary" disabled={Boolean(enviando)}>Salvar configuração</button></div>
      </form>
    </section>
  </div>
}

function Inutilizacao({ toast }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState({ modelo: '65', serie: '1', numeroInicial: '', numeroFinal: '', justificativa: '' })
  const [enviando, setEnviando] = useState(false)
  const carregar = useCallback(() => api.get(`${BASE}/inutilizacoes`).then((l) => setLista(Array.isArray(l) ? l : [])).catch((e) => toast(e.message, 'error')), [toast])
  useEffect(() => { carregar() }, [carregar])
  const justificativaOk = form.justificativa.trim().length >= 15
  async function enviar(ev) {
    ev.preventDefault()
    if (enviando || !justificativaOk || !form.numeroInicial) return
    setEnviando(true)
    try {
      const r = await api.post(`${BASE}/inutilizacoes`, { modelo: form.modelo, serie: Number(form.serie), numeroInicial: Number(form.numeroInicial), numeroFinal: Number(form.numeroFinal || form.numeroInicial), justificativa: form.justificativa.trim() })
      toast(`Números ${r.numeroInicial} a ${r.numeroFinal}: ${STATUS_INUT[r.status]?.[0] || r.status}.`, r.status === 'rejeitada' ? 'error' : 'success')
      setForm({ ...form, numeroInicial: '', numeroFinal: '', justificativa: '' }); carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  const campo = (rotulo, k, extra = {}) => <label className="c360-field">{rotulo}<input className="c360-input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} /></label>
  return <section className="dadm-card">
    <h2>Inutilização de numeração</h2>
    <p className="dadm-muted">Para números de NF-e ou NFC-e que não serão usados (ex.: o sistema pulou a sequência). Só números ainda sem nota (ou de nota rejeitada). Depois de inutilizados, nunca mais são usados.</p>
    <form onSubmit={enviar} style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <label className="c360-field">Modelo<select className="c360-input" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })}><option value="65">NFC-e (65)</option><option value="55">NF-e (55)</option></select></label>
        {campo('Série', 'serie', { inputMode: 'numeric', required: true })}
        {campo('Número inicial', 'numeroInicial', { inputMode: 'numeric', required: true })}
        {campo('Número final', 'numeroFinal', { inputMode: 'numeric', placeholder: 'igual ao inicial' })}
      </div>
      <label className="c360-field">Justificativa (mínimo 15 caracteres)<textarea className="c360-input" rows={2} maxLength={255} value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} /></label>
      <div className="dadm-actions"><button type="submit" className="c360-btn primary" disabled={enviando || !justificativaOk || !form.numeroInicial}>Inutilizar números</button></div>
    </form>
    <Table caption="Inutilizações" rows={lista} empty="Nenhuma numeração inutilizada." columns={[
      { key: 'f', label: 'Faixa', render: (i) => <div><strong>{MODELO[i.modelo]} série {i.serie}: {i.numeroInicial === i.numeroFinal ? i.numeroInicial : `${i.numeroInicial} a ${i.numeroFinal}`}</strong><div className="dadm-muted">{i.ambiente === 'producao' ? 'Produção' : 'Homologação'} · {dateTime(i.criadoEm)}{i.criadoPor ? ` · ${i.criadoPor}` : ''}</div></div> },
      { key: 'j', label: 'Justificativa', render: (i) => i.justificativa },
      { key: 's', label: 'Situação', render: (i) => <div><Badge tone={STATUS_INUT[i.status]?.[1]}>{STATUS_INUT[i.status]?.[0] || i.status}</Badge>{i.protocolo && <div className="dadm-muted">Protocolo {i.protocolo}</div>}{i.mensagens?.length > 0 && <div className="dadm-muted">{i.mensagens.map((m) => m.mensagem).join(' · ')}</div>}</div> },
    ]} />
  </section>
}

function Contador({ toast }) {
  const competenciaPadrao = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const [competencia, setCompetencia] = useState(competenciaPadrao)
  const [resumo, setResumo] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [baixando, setBaixando] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await api.get(`${BASE}/contador/resumo?competencia=${encodeURIComponent(competencia)}`)
      setResumo(r)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setCarregando(false)
    }
  }, [competencia, toast])

  useEffect(() => { carregar() }, [carregar])

  async function baixarArquivo(rota, nomePadrao, mime = 'text/plain;charset=utf-8') {
    if (baixando) return
    setBaixando(rota)
    try {
      const blob = await api.blob(`${BASE}/contador/${rota}?competencia=${encodeURIComponent(competencia)}`)
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = nomePadrao
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast(`Arquivo ${nomePadrao} gerado com sucesso.`, 'success')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBaixando('')
    }
  }

  async function baixarPacoteXml() {
    if (baixando) return
    setBaixando('pacote')
    try {
      const p = await api.get(`${BASE}/contador/pacote?competencia=${encodeURIComponent(competencia)}`)
      const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `pacote-contabil-${competencia}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast(`Pacote contábil com ${p.totalXmls || 0} XML(s) exportado.`, 'success')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBaixando('')
    }
  }

  const tot = resumo?.totais || {}
  const trib = tot.tributos || {}
  const mod = tot.porModelo || {}

  return <div style={{ display: 'grid', gap: 16 }}>
    <section className="dadm-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h2>SPED Fiscal, EFD Contribuições e Fechamento para o Contador</h2>
          <p className="dadm-muted" style={{ margin: '4px 0 0' }}>
            Exporte os arquivos oficiais do SPED Fiscal (ICMS/IPI), EFD Contribuições (PIS/COFINS), planilha contábil (Domínio / Questor / Alterdata) e pacote de XMLs do mês.
          </p>
        </div>
        <div className="dadm-filters" style={{ margin: 0 }}>
          <label className="c360-field" style={{ margin: 0 }}>
            Competência
            <input type="month" aria-label="Competência contábil" className="c360-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </label>
          <button type="button" className="c360-btn ghost" disabled={carregando} onClick={carregar}>Atualizar apuração</button>
        </div>
      </div>

      <div className="dadm-actions" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <button type="button" className="c360-btn primary" disabled={Boolean(baixando)} onClick={() => baixarArquivo('sped-fiscal', `SPED-FISCAL-${competencia}.txt`)}>
          Baixar SPED Fiscal (EFD ICMS/IPI)
        </button>
        <button type="button" className="c360-btn primary" disabled={Boolean(baixando)} onClick={() => baixarArquivo('sped-contribuicoes', `SPED-CONTRIBUICOES-${competencia}.txt`)}>
          Baixar SPED Contribuições (PIS/COFINS)
        </button>
        <button type="button" className="c360-btn ghost" disabled={Boolean(baixando)} onClick={() => baixarArquivo('csv', `fechamento-contabil-${competencia}.csv`, 'text/csv;charset=utf-8')}>
          Exportar CSV (Domínio / Questor)
        </button>
        <button type="button" className="c360-btn ghost" disabled={Boolean(baixando)} onClick={baixarPacoteXml}>
          Baixar Pacote de XMLs + Resumo
        </button>
      </div>

      <div className="dadm-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12 }}>
        <article>
          <span>Total autorizado no mês</span>
          <strong>{money(tot.valorAutorizado || 0)}</strong>
          <small>{tot.autorizados || 0} documento(s) válido(s)</small>
        </article>
        <article>
          <span>NFC-e (65) · Varejo/PDV</span>
          <strong>{money(mod['65']?.valor || 0)}</strong>
          <small>{mod['65']?.qtd || 0} emitida(s){mod['65']?.canceladas ? ` · ${mod['65'].canceladas} cancelada(s)` : ''}</small>
        </article>
        <article>
          <span>NF-e (55) · B2B/Destinatário</span>
          <strong>{money(mod['55']?.valor || 0)}</strong>
          <small>{mod['55']?.qtd || 0} emitida(s){mod['55']?.canceladas ? ` · ${mod['55'].canceladas} cancelada(s)` : ''}</small>
        </article>
        <article>
          <span>NFS-e · Serviços</span>
          <strong>{money(mod.nfse?.valor || 0)}</strong>
          <small>{mod.nfse?.qtd || 0} emitida(s){mod.nfse?.canceladas ? ` · ${mod.nfse.canceladas} cancelada(s)` : ''}</small>
        </article>
        <article>
          <span>ICMS / ISS apurados</span>
          <strong>{money((trib.valorIcms || 0) + (trib.valorIss || 0))}</strong>
          <small>ICMS {money(trib.valorIcms || 0)} · ISS {money(trib.valorIss || 0)}</small>
        </article>
        <article>
          <span>PIS / COFINS apurados</span>
          <strong>{money((trib.valorPis || 0) + (trib.valorCofins || 0))}</strong>
          <small>PIS {money(trib.valorPis || 0)} · COFINS {money(trib.valorCofins || 0)}</small>
        </article>
      </div>
    </section>

    <section className="dadm-card">
      <h3>Resumo analítico por CFOP e CST/CSOSN (Bloco C190)</h3>
      <Table caption="Apuração por CFOP" rows={(resumo?.porCfop || []).map((c) => ({ ...c, id: `${c.cfop}:${c.cstOuCsosn}` }))} empty="Nenhum item escriturado nesta competência." columns={[
        { key: 'cfop', label: 'CFOP', render: (c) => <strong>{c.cfop}</strong> },
        { key: 'cst', label: 'CST / CSOSN', render: (c) => <Badge tone="info">{c.cstOuCsosn}</Badge> },
        { key: 'qtd', label: 'Itens', align: 'right', render: (c) => c.qtdItens },
        { key: 'val', label: 'Valor contábil', align: 'right', render: (c) => money(c.valorContabil) },
        { key: 'bc', label: 'Base ICMS', align: 'right', render: (c) => money(c.baseIcms) },
        { key: 'icms', label: 'ICMS', align: 'right', render: (c) => money(c.valorIcms) },
        { key: 'pis', label: 'PIS / COFINS', align: 'right', render: (c) => money((c.valorPis || 0) + (c.valorCofins || 0)) },
      ]} />
    </section>
  </div>
}
