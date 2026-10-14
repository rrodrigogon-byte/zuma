import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { minimizedGovernanceTree, knownGovernanceSchema, AVEC_GOVERNANCE_FILE_LIMIT } from '../../../../shared/avec-import-policy.js'

const VERSION = 'avec-dino-governance-v1'
const CATEGORIES = { products: 'Produtos', fees: 'Taxas', materials: 'Materiais dos serviços', fiscal: 'Cadastro fiscal', agenda: 'Agenda — 60 dias' }
const STATUS = { blocked: 'Bloqueado', ignored: 'Ignorado', ready_for_mapping: 'Estrutura válida — falta mapear' }
const BLOCKERS = ['SOURCE_ESTABLISHMENT_BINDING_REQUIRED', 'DESTINATION_BASELINE_AND_MAPPING_REQUIRED', 'FINAL_LOT_APPROVAL_REQUIRED', 'OFFICIAL_WRITER_NOT_ENABLED']

export function validGovernanceResponse(value, scope, category, size) {
  if (value?.mode !== 'read-only-avec-import-governance' || value.contractVersion !== VERSION || value.category !== category || value.write?.performed !== false || value.write?.enabled !== false || value.write?.endpoint !== null) return false
  if (!['empresaId', 'lojaId', 'storefrontId', 'locationId'].every(key => value.scope?.[key] === scope[key])) return false
  if (!/^[a-f0-9]{64}$/.test(value.previewHash || '') || !Array.isArray(value.rows) || value.rows.length !== size || value.summary?.total !== size || value.summary?.readyToApply !== 0) return false
  if (!Array.isArray(value.blockers) || !BLOCKERS.every(code => value.blockers.includes(code)) || value.policy?.agendaWindowDays !== 60) return false
  if (value.rows.some((row, index) => row.line !== index + 1 || !Object.hasOwn(STATUS, row.status) || !Array.isArray(row.reasons) || row.reasons.some(code => typeof code !== 'string' || !/^[A-Z0-9_]{1,100}$/.test(code)))) return false
  return value.summary.readyForMapping === value.rows.filter(row => row.status === 'ready_for_mapping').length && value.summary.blocked === value.rows.filter(row => row.status === 'blocked').length && value.summary.ignored === value.rows.filter(row => row.status === 'ignored').length
}

export function governanceTemplate(category, scope) {
  const shared = { sourceId: '', lojaId: scope.lojaId }
  const rows = {
    products: { sourceId: '', sku: '', ean: '', ncm: '', custo: '', custoNature: '', unidade: '' },
    fees: { ...shared, acquirer: '', method: '', brand: '', installments: null, percent: null, fixedCents: null, anticipationMode: 'unknown', settlementDays: null, validFrom: '', validTo: '', contractRef: '' },
    materials: { ...shared, sourceServiceId: '', sourceProductId: '', quantity: null, consumptionUnit: '', referenceUnit: '', referenceQuantity: null, costCents: null, costEvidence: '', serviceUnitConfirmed: false },
    fiscal: { lojaId: scope.lojaId, cnpj: '', razaoSocial: '', nomeFantasia: '', inscricaoEstadual: { state: '', value: '' }, inscricaoMunicipal: { state: '', value: '' }, regime: '', address: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' }, fiscalReviewConfirmed: false, reviewScope: { empresaId: scope.empresaId, lojaId: scope.lojaId }, dataFormat: '', sourceRef: '' },
    agenda: { sourceAppointmentId: '', sourceClientId: '', sourceProfessionalId: '', sourceServiceId: '', lojaId: scope.lojaId, startAt: '', endAt: '', durationMinutes: null, timezone: 'America/Cuiaba', status: '', individualEventVerified: false, originalIdsVerified: false },
  }
  return { source: 'avec', contractVersion: VERSION, category, sourceEstablishmentId: '', ...scope, extractedAt: '', cutoff: '', rows: [rows[category]] }
}

export default function AvecImportGovernancePreview({ empresaId, unitId, storefrontId, locationId }) {
  const [category, setCategory] = useState('products')
  const [payload, setPayload] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [page, setPage] = useState(1)
  const request = useRef(0), abort = useRef(null)
  const key = JSON.stringify([empresaId, unitId, storefrontId, locationId, category])
  const current = useRef(key); current.current = key
  const scope = { empresaId, lojaId: unitId, storefrontId, locationId }
  const complete = Object.values(scope).every(Boolean)
  useEffect(() => { request.current++; abort.current?.abort(); setPayload(null); setLoaded(false); setBusy(false); setError(''); setResult(null); setPage(1) }, [key])
  useEffect(() => () => { request.current++; abort.current?.abort() }, [])

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(governanceTemplate(category, scope), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `modelo-avec-${category}-somente-previa.json`; link.click(); URL.revokeObjectURL(url)
  }
  async function select(event) {
    const target = event.target, file = target.files?.[0], generation = ++request.current, selection = key
    abort.current?.abort(); setBusy(false); setPayload(null); setLoaded(false); setResult(null); setError(''); setPage(1)
    if (!file) return
    try {
      if (file.size > AVEC_GOVERNANCE_FILE_LIMIT) throw new Error('limit')
      const data = JSON.parse(await file.text())
      if (generation !== request.current || current.current !== selection) return
      if (data.source !== 'avec' || data.contractVersion !== VERSION || data.category !== category || !Array.isArray(data.rows) || !data.rows.length || data.rows.length > 500) throw new Error('contract')
      if (!minimizedGovernanceTree(data) || !knownGovernanceSchema(data)) throw new Error('sensitive')
      if (!['empresaId', 'lojaId', 'storefrontId', 'locationId'].every(field => data[field] === scope[field])) throw new Error('scope')
      setPayload(data); setLoaded(true)
    } catch (_) {
      if (generation === request.current && current.current === selection) setError('Arquivo JSON inválido, acima de 512 KiB, com campos sensíveis proibidos/desconhecidos ou fora do contrato/escopo selecionado. Nenhum dado foi enviado.')
    } finally { target.value = '' }
  }
  async function validate() {
    if (!complete || !payload) return
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller
    const generation = ++request.current, selection = key
    setBusy(true); setResult(null); setError('')
    try {
      const response = await api.post('/api/admin/commerce/catalog/avec/governance/preview', payload, { signal: controller.signal })
      if (generation !== request.current || current.current !== selection || controller.signal.aborted) return
      if (!validGovernanceResponse(response, scope, category, payload.rows.length)) throw new Error('invalid-response')
      setResult(response); setPage(1)
    } catch (_) {
      if (generation === request.current && current.current === selection && !controller.signal.aborted) setError('Não foi possível validar o contrato no escopo selecionado. A prévia foi descartada; nenhuma gravação foi executada.')
    } finally { if (generation === request.current) setBusy(false) }
  }
  return <section className="commerce-avec-preview" aria-labelledby="avec-governance-title">
    <div className="ecommerce-admin-panel-heading"><div>
      <span className="ecommerce-admin-kicker"><FileSpreadsheet size={14} /> Preparação AVEC — sem carga</span>
      <h3 id="avec-governance-title">Conferir os dados mínimos antes do mapeamento</h3>
      <p className="commerce-admin-help">60 dias de agenda. Preserve preço, saldo, reservas e publicação. Campos ausentes permanecem pendentes; cancelados/faltas são ignorados e conflitos bloqueiam. Estrutura válida não significa lote apto.</p>
      <p className="commerce-admin-help">Este JSON é um contrato de preparação, não exportação nativa AVEC. Não inclua nomes/contatos de clientes, observações livres, certificados, senhas ou tokens. Dados empresariais fiscais exigem revisão restrita.</p>
      <p className="commerce-admin-help">Máximo 512 KiB. Preencha extração, corte e demais fatos com evidência da origem: o modelo não gera datas, custos ou inscrições.</p>
    </div></div>
    <div className="ecommerce-admin-header-actions">
      <label>Categoria <select aria-label="Categoria de preparação AVEC" value={category} onChange={event => setCategory(event.target.value)}>{Object.entries(CATEGORIES).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      <button type="button" className="ecommerce-admin-button ghost" disabled={!complete} onClick={downloadTemplate}>Baixar contrato vazio</button>
      <label className="ecommerce-admin-button ghost"><Upload size={15} /> Selecionar JSON minimizado<input type="file" accept=".json,application/json" onChange={select} hidden /></label>
      <button type="button" className="ecommerce-admin-button primary" onClick={validate} disabled={busy || !loaded || !complete}>{busy && <Loader2 size={15} />} Conferir estrutura (não grava)</button>
    </div>
    {loaded && <p className="commerce-admin-help">{payload.rows.length} linhas carregadas apenas em memória. Limite: 500 por lote.</p>}
    {error && <div className="ecommerce-admin-alert error" role="alert"><AlertTriangle size={16} /> {error}</div>}
    {result && <div className="commerce-import-preview" aria-live="polite">
      <div className="commerce-import-summary"><span><b>{result.summary.total}</b> total</span><span><b>{result.summary.readyForMapping}</b> estruturas para mapear</span><span><b>{result.summary.blocked}</b> bloqueadas</span><span><b>{result.summary.ignored}</b> ignoradas</span><span><b>0</b> aptas para gravar</span></div>
      <p className="commerce-admin-help"><strong>Carga bloqueada:</strong> confirmar vínculo do estabelecimento de origem, baseline e mapeamentos destino, aprovação final do lote e writer oficial. Nenhuma alteração foi executada.</p>
      <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Linha</th><th>Estado estrutural</th><th>Motivos</th></tr></thead><tbody>{result.rows.slice((page - 1) * 25, page * 25).map(row => <tr key={row.line}><td>{row.line}</td><td>{STATUS[row.status]}</td><td>{row.reasons.join(', ') || 'Ainda exige mapeamento e revisão do lote'}</td></tr>)}</tbody></table></div>
      {result.rows.length > 25 && <nav className="ecommerce-admin-header-actions" aria-label="Paginação da estrutura AVEC"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {Math.ceil(result.rows.length / 25)}</span><button type="button" disabled={page >= Math.ceil(result.rows.length / 25)} onClick={() => setPage(value => value + 1)}>Próxima</button></nav>}
    </div>}
  </section>
}
