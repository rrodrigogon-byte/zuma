import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Building2, CheckCircle2, ExternalLink, Landmark, Loader2, MapPin, Phone, Plus, RefreshCw, ShieldCheck, Store } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import { mergeCepAddress } from '../../lib/cep.js'
import { useCepAutofill } from '../../lib/useCepAutofill.js'
import CepHint from '../../components/CepHint.jsx'

const EMPTY_TENANT = {
  nomeFantasia: '', razaoSocial: '', cnpj: '', tipoNegocio: 'outro',
  adminName: '', adminEmail: '', contactEmail: '', telefone: '',
  alias: '', brandKey: 'default', lojaCodigo: '', storefrontCodigo: '',
  tagline: '', cep: '', logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', uf: '', pickupInstructions: '', pickupLeadTimeHours: '24',
  confirmAdminAccess: false, confirmAddress: false,
}

function onlyDigits(value, max = 14) {
  return String(value || '').replace(/\D/g, '').slice(0, max)
}

function cnpjValido(value) {
  const digits = onlyDigits(value, 14)
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false
  const digit = (base, weights) => {
    const total = base.split('').reduce((sum, number, index) => sum + Number(number) * weights[index], 0)
    const result = 11 - (total % 11)
    return result >= 10 ? '0' : String(result)
  }
  const first = digit(digits.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2])
  const second = digit(`${digits.slice(0, 12)}${first}`, [6,5,4,3,2,9,8,7,6,5,4,3,2])
  return digits.endsWith(`${first}${second}`)
}

function formatCnpj(value) {
  const digits = onlyDigits(value, 14)
  return digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : digits
}

function formatPhone(value) {
  const digits = onlyDigits(value, 13).replace(/^55/, '')
  if (digits.length === 11) return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`
  return value || '—'
}

function addressLine(address = {}) {
  return [
    [address.street, address.number].filter(Boolean).join(', '),
    address.complement,
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join('/'),
    address.postalCode,
  ].filter(Boolean).join(' · ')
}

function TenantCard({ tenant, groups = [], onChangeGroup, changingGroup = false }) {
  const storefronts = Array.isArray(tenant.storefronts) ? tenant.storefronts : []
  return (
    <article className="card" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="badge" style={{ marginBottom: 8 }}>{tenant.tipo_negocio || 'empresa'}</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{tenant.nome}</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 12 }}>{tenant.razao_social || 'Razão social não informada'} · CNPJ {formatCnpj(tenant.cnpj) || '—'}</p>
          {tenant.grupo_nome && <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 800, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Landmark size={13} /> {tenant.grupo_nome}</p>}
        </div>
        <span className="badge" style={{ color: tenant.ativa === false ? 'var(--bad)' : 'var(--good)', background: tenant.ativa === false ? 'var(--bad-wash)' : 'var(--good-wash)' }}>
          {tenant.ativa === false ? 'Inativa' : 'Ativa'}
        </span>
      </div>
      {onChangeGroup && (
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700 }}>
          Grupo empresarial
          <select value={tenant.grupo_id || ''} disabled={changingGroup} onChange={(event) => onChangeGroup(tenant, event.target.value || null)}>
            <option value="">Independente (sem grupo)</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.nome}</option>)}
          </select>
        </label>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {storefronts.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum storefront Commerce associado.</div> : storefronts.map((storefront) => {
          const aliases = Array.isArray(storefront.aliases) ? storefront.aliases : []
          const publicConfig = aliases[0]?.publicConfig || {}
          return (
            <div key={storefront.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--surface-2)', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Store size={16} /> {storefront.nome}</strong>
                <span className="badge">{storefront.status}</span>
              </div>
              <small style={{ color: 'var(--muted)' }}>Código: {storefront.codigo} · Loja: {storefront.lojaId || 'tenant-wide'}</small>
              {publicConfig.contact?.phone && <small style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}><Phone size={13} /> {formatPhone(publicConfig.contact.phone)}</small>}
              {addressLine(publicConfig.address) && <small style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6, color: 'var(--muted)' }}><MapPin size={13} style={{ marginTop: 2 }} /> {addressLine(publicConfig.address)}</small>}
              {aliases.map((item) => (
                <a key={item.alias} href={`/ecommerce/${encodeURIComponent(item.alias)}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--accent)', fontWeight: 800, fontSize: 12 }}>
                  /ecommerce/{item.alias} · {item.brandKey} {item.ativo === false ? '(inativo)' : ''} <ExternalLink size={13} />
                </a>
              ))}
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default function AdminPlataforma() {
  const { toast } = useToast()
  const { atualizarContextoLojas } = useAuth()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [form, setForm] = useState(EMPTY_TENANT)
  // CEP de qualquer lugar do Brasil preenche rua, bairro, cidade e UF.
  const cepInfo = useCepAutofill(found => setForm(current => mergeCepAddress(current, found, { cep: false, estado: 'uf', ibge: false })))
  const [result, setResult] = useState(null)
  const [groups, setGroups] = useState([])
  const [groupForm, setGroupForm] = useState({ nome: '', cnpj: '', razaoSocial: '' })
  const [savingGroup, setSavingGroup] = useState(false)
  const [changingGroupFor, setChangingGroupFor] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [response, groupResponse] = await Promise.all([
        api.get('/api/admin/platform/commerce-tenants'),
        api.get('/api/admin/platform/business-groups').catch(() => ({ items: [] })),
      ])
      setTenants(Array.isArray(response?.items) ? response.items : [])
      setGroups(Array.isArray(groupResponse?.items) ? groupResponse.items : [])
    } catch (error) {
      toast(error.message || 'Não foi possível carregar os tenants do Commerce.', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const aliasValido = /^[a-z0-9][a-z0-9_-]{1,79}$/.test(form.alias)
  const telefoneValido = onlyDigits(form.telefone, 13).replace(/^55/, '').length >= 10
  const enderecoCompleto = Boolean(form.cep.trim() && form.logradouro.trim() && form.numero.trim() && form.bairro.trim() && form.cidade.trim() && /^[A-Za-z]{2}$/.test(form.uf.trim()))
  const formValido = useMemo(() => (
    Boolean(
      form.nomeFantasia.trim() && form.razaoSocial.trim() && cnpjValido(form.cnpj) &&
      form.adminEmail.trim() && telefoneValido && aliasValido && enderecoCompleto &&
      form.lojaCodigo.trim() && form.storefrontCodigo.trim() &&
      form.confirmAdminAccess && form.confirmAddress
    )
  ), [form, aliasValido, telefoneValido, enderecoCompleto])

  async function criarGrupo(event) {
    event.preventDefault()
    if (groupForm.nome.trim().length < 2 || savingGroup) return
    setSavingGroup(true)
    try {
      await api.post('/api/admin/platform/business-groups', { nome: groupForm.nome.trim(), cnpj: onlyDigits(groupForm.cnpj), razaoSocial: groupForm.razaoSocial.trim() })
      toast(`Grupo ${groupForm.nome.trim()} criado.`)
      setGroupForm({ nome: '', cnpj: '', razaoSocial: '' })
      await carregar()
    } catch (error) {
      toast(error.message || 'Não foi possível criar o grupo.', true)
    } finally {
      setSavingGroup(false)
    }
  }

  async function mudarGrupo(tenant, grupoId) {
    setChangingGroupFor(tenant.id)
    try {
      await api.patch(`/api/admin/platform/commerce-tenants/${tenant.id}/group`, { grupoId })
      toast(grupoId ? `${tenant.nome} vinculada ao grupo.` : `${tenant.nome} agora é independente.`)
      await carregar()
    } catch (error) {
      toast(error.message || 'Não foi possível alterar o grupo.', true)
    } finally {
      setChangingGroupFor('')
    }
  }

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setResult(null)
  }

  async function provisionar(event) {
    event.preventDefault()
    if (!formValido) return toast('Revise identidade, CNPJ válido, administrador, telefone, endereço, códigos e confirmações.', true)
    setCreating(true)
    setResult(null)
    try {
      const address = {
        postalCode: onlyDigits(form.cep, 8), street: form.logradouro.trim(), number: form.numero.trim(),
        complement: form.complemento.trim(), neighborhood: form.bairro.trim(), city: form.cidade.trim(), uf: form.uf.trim().toUpperCase(),
      }
      const pickup = { instructions: form.pickupInstructions.trim(), leadTimeHours: Number(form.pickupLeadTimeHours) || 0 }
      const response = await api.post('/api/admin/platform/commerce-tenants', {
        nomeFantasia: form.nomeFantasia.trim(), razaoSocial: form.razaoSocial.trim(), cnpj: onlyDigits(form.cnpj),
        tipoNegocio: form.tipoNegocio, adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim().toLowerCase(),
        contactEmail: (form.contactEmail || form.adminEmail).trim().toLowerCase(), telefone: form.telefone,
        alias: form.alias.trim().toLowerCase(), brandKey: form.brandKey.trim().toLowerCase(),
        lojaCodigo: form.lojaCodigo.trim().toUpperCase(), storefrontCodigo: form.storefrontCodigo.trim().toLowerCase(),
        address, pickup,
        publicConfig: {
          displayName: form.nomeFantasia.trim(), tagline: form.tagline.trim(), phone: form.telefone,
          email: (form.contactEmail || form.adminEmail).trim().toLowerCase(), address, pickup,
          colors: { accent: '#6E7CE0', accentStrong: '#4B57A6', background: '#101114', surface: '#181A20', text: '#F4F5F7' },
        },
        confirmAdminAccess: form.confirmAdminAccess,
        confirmPublicContact: form.confirmAddress,
      })
      const session = await api.get('/api/admin/commerce-session')
      atualizarContextoLojas(session)
      setResult(response)
      toast(response.created ? `Tenant ${response.empresa?.nome || form.nomeFantasia} criado em modo rascunho.` : `Tenant ${response.empresa?.nome || form.nomeFantasia} reconciliado com segurança.`)
      await carregar()
    } catch (error) {
      toast(error.message || 'Não foi possível provisionar o tenant.', true)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="page" style={{ display: 'grid', gap: 22 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div className="badge" style={{ color: 'var(--accent)', background: 'var(--accent-soft)', marginBottom: 8 }}>ADMINISTRAÇÃO DA PLATAFORMA</div>
          <h1 className="page-title" style={{ margin: 0 }}>Empresas e Commerce</h1>
          <p style={{ color: 'var(--muted)', maxWidth: 760, lineHeight: 1.6, margin: '8px 0 0' }}>Cadastre múltiplas empresas com identidade, administrador, loja, endereço, retirada e storefront isolados. Catálogo, saldo e credenciais exigem etapas governadas posteriores.</p>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={carregar} disabled={loading}><RefreshCw size={15} /> Atualizar</button>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate((value) => !value)}><Plus size={15} /> Nova empresa</button>
        </div>
      </header>

      <section className="card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 13, alignItems: 'start', borderColor: 'var(--accent)' }}>
        <ShieldCheck size={24} color="var(--accent)" />
        <div><strong>Provisionamento seguro e idempotente</strong><p style={{ color: 'var(--muted)', margin: '5px 0 0', lineHeight: 1.55, fontSize: 13 }}>CNPJ, alias e códigos são validados antes da transação. Um vínculo com outro tenant bloqueia toda a operação, sem gravação parcial.</p></div>
      </section>

      {showCreate && (
        <form className="card" onSubmit={provisionar} style={{ display: 'grid', gap: 17 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Building2 size={20} color="var(--accent)" /><div><h2 style={{ margin: 0, fontSize: 19 }}>Provisionar empresa isolada</h2><small style={{ color: 'var(--muted)' }}>Informe somente dados reais e aprovados pelo responsável.</small></div></div>

          <div className="form-grid">
            <label className="form-group"><span>Nome fantasia</span><input value={form.nomeFantasia} onChange={(event) => change('nomeFantasia', event.target.value)} required /></label>
            <label className="form-group"><span>Razão social</span><input value={form.razaoSocial} onChange={(event) => change('razaoSocial', event.target.value)} required /></label>
            <label className="form-group"><span>CNPJ</span><input value={form.cnpj} onChange={(event) => change('cnpj', onlyDigits(event.target.value))} inputMode="numeric" placeholder="14 dígitos" required /><small style={{ color: cnpjValido(form.cnpj) ? 'var(--good)' : 'var(--muted)' }}>{cnpjValido(form.cnpj) ? 'CNPJ válido' : `${onlyDigits(form.cnpj).length}/14 dígitos`}</small></label>
            <label className="form-group"><span>Tipo de negócio</span><select value={form.tipoNegocio} onChange={(event) => change('tipoNegocio', event.target.value)}><option value="barbearia">Barbearia e perfumaria</option><option value="loja">Loja</option><option value="bar">Bar</option><option value="restaurante">Restaurante</option><option value="clube">Clube</option><option value="supermercado">Supermercado</option><option value="outro">Outro</option></select></label>
            <label className="form-group"><span>Nome do administrador</span><input value={form.adminName} onChange={(event) => change('adminName', event.target.value)} /></label>
            <label className="form-group"><span>E-mail de acesso existente</span><input type="email" value={form.adminEmail} onChange={(event) => change('adminEmail', event.target.value)} required /><small>O e-mail já deve conseguir entrar no SetPoint.</small></label>
            <label className="form-group"><span>E-mail comercial</span><input type="email" value={form.contactEmail} onChange={(event) => change('contactEmail', event.target.value)} placeholder="Se vazio, usa o e-mail do administrador" /></label>
            <label className="form-group"><span>Telefone com DDD</span><input value={form.telefone} onChange={(event) => change('telefone', event.target.value)} inputMode="tel" placeholder="+55 65 99999-9999" required /><small style={{ color: telefoneValido ? 'var(--good)' : 'var(--muted)' }}>{telefoneValido ? formatPhone(form.telefone) : 'Informe DDD e número'}</small></label>
          </div>

          <fieldset style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'grid', gap: 13 }}>
            <legend style={{ padding: '0 6px', fontWeight: 800 }}>Endereço e retirada</legend>
            <div className="form-grid">
              <label className="form-group"><span>CEP</span><input value={form.cep} onChange={(event) => { const cep = onlyDigits(event.target.value, 8); change('cep', cep); cepInfo.onCepInput(cep) }} inputMode="numeric" autoComplete="postal-code" placeholder="00000000" required /><CepHint info={cepInfo} /></label>
              <label className="form-group"><span>Logradouro</span><input value={form.logradouro} onChange={(event) => change('logradouro', event.target.value)} required /></label>
              <label className="form-group"><span>Número</span><input value={form.numero} onChange={(event) => change('numero', event.target.value)} required /></label>
              <label className="form-group"><span>Complemento</span><input value={form.complemento} onChange={(event) => change('complemento', event.target.value)} /></label>
              <label className="form-group"><span>Bairro</span><input value={form.bairro} onChange={(event) => change('bairro', event.target.value)} required /></label>
              <label className="form-group"><span>Cidade</span><input value={form.cidade} onChange={(event) => change('cidade', event.target.value)} required /></label>
              <label className="form-group"><span>UF</span><input value={form.uf} onChange={(event) => change('uf', event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} required /></label>
              <label className="form-group"><span>Prazo de preparação (h)</span><input type="number" min="0" max="720" value={form.pickupLeadTimeHours} onChange={(event) => change('pickupLeadTimeHours', event.target.value)} /></label>
              <label className="form-group" style={{ gridColumn: '1 / -1' }}><span>Instruções de retirada</span><textarea rows="2" value={form.pickupInstructions} onChange={(event) => change('pickupInstructions', event.target.value)} placeholder="Como e quando o cliente poderá retirar" /></label>
            </div>
          </fieldset>

          <div className="form-grid">
            <label className="form-group"><span>Alias público</span><input value={form.alias} onChange={(event) => change('alias', event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} required /><small style={{ color: aliasValido ? 'var(--good)' : 'var(--bad)' }}>/ecommerce/{form.alias || 'alias'}</small></label>
            <label className="form-group"><span>Identidade</span><input value={form.brandKey} onChange={(event) => change('brandKey', event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} required /></label>
            <label className="form-group"><span>Código da unidade</span><input value={form.lojaCodigo} onChange={(event) => change('lojaCodigo', event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} required /></label>
            <label className="form-group"><span>Código do storefront</span><input value={form.storefrontCodigo} onChange={(event) => change('storefrontCodigo', event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} required /></label>
            <label className="form-group" style={{ gridColumn: '1 / -1' }}><span>Mensagem pública</span><textarea rows="3" value={form.tagline} onChange={(event) => change('tagline', event.target.value)} /></label>
          </div>

          <button type="button" className="btn btn-secondary" onClick={() => setShowPreview((value) => !value)} disabled={!form.nomeFantasia.trim()}>{showPreview ? 'Ocultar preview' : 'Revisar preview antes de criar'}</button>
          {showPreview && <section aria-label="Preview do tenant" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--surface-2)', display: 'grid', gap: 7 }}>
            <strong>{form.nomeFantasia || 'Empresa sem nome'} · {formatCnpj(form.cnpj) || 'CNPJ pendente'}</strong>
            <span>{form.razaoSocial || 'Razão social pendente'}</span>
            <span>{formatPhone(form.telefone)}</span>
            <span>{addressLine({ street: form.logradouro, number: form.numero, complement: form.complemento, neighborhood: form.bairro, city: form.cidade, state: form.uf, postalCode: form.cep }) || 'Endereço pendente'}</span>
            <span>Administrador: {form.adminEmail || 'pendente'} · Alias: /ecommerce/{form.alias || 'pendente'}</span>
            <small style={{ color: 'var(--muted)' }}>Storefront e retirada nascerão em rascunho. Catálogo, estoque, pagamento e entrega não são criados por este formulário.</small>
          </section>}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 13, border: '1px solid var(--line)', borderRadius: 11, background: 'var(--surface-2)', fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={form.confirmAdminAccess} onChange={(event) => change('confirmAdminAccess', event.target.checked)} style={{ width: 18, height: 18, flex: '0 0 18px', marginTop: 1 }} />
            <span>Confirmo que o titular de <strong>{form.adminEmail || 'e-mail informado'}</strong> foi autorizado a administrar este tenant.</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 13, border: '1px solid var(--line)', borderRadius: 11, background: 'var(--surface-2)', fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={form.confirmAddress} onChange={(event) => change('confirmAddress', event.target.checked)} style={{ width: 18, height: 18, flex: '0 0 18px', marginTop: 1 }} />
            <span>Confirmo que o endereço e o telefone foram revisados para uso público e retirada. O provisionamento não cria produtos, saldos ou credenciais.</span>
          </label>

          {!formValido && <div role="status" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', color: 'var(--warn)', background: 'var(--warn-wash)', padding: 12, borderRadius: 10 }}><AlertTriangle size={18} style={{ marginTop: 1 }} /> O botão será liberado após todos os dados obrigatórios, CNPJ válido e as duas confirmações.</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <small style={{ color: 'var(--muted)' }}>O storefront nasce em <strong>rascunho</strong>; a publicação comercial ocorre em etapa separada.</small>
            <button type="submit" className="btn btn-primary" disabled={creating || !formValido}>{creating ? <><Loader2 className="spin" size={15} /> Provisionando…</> : <>Criar empresa isolada</>}</button>
          </div>
          {result && <div role="status" style={{ display: 'flex', gap: 9, alignItems: 'center', color: 'var(--good)', background: 'var(--good-wash)', padding: 12, borderRadius: 10 }}><CheckCircle2 size={18} /> Empresa {result.empresa?.nome} vinculada ao alias /ecommerce/{result.alias}.</div>}
        </form>
      )}

      <section style={{ marginBottom: 28 }} aria-labelledby="grupos-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}><div><h2 id="grupos-title" style={{ margin: 0, fontSize: 20 }}>Grupos empresariais</h2><small style={{ color: 'var(--muted)' }}>Holdings donas de várias empresas. Cada empresa segue isolada; o grupo só organiza e consolida.</small></div><span className="badge">{groups.length} grupo(s)</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {groups.map((group) => (
            <article key={group.id} className="card" style={{ display: 'grid', gap: 8 }}>
              <strong style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 17 }}><Landmark size={17} /> {group.nome}</strong>
              <small style={{ color: 'var(--muted)' }}>{group.cnpj ? `CNPJ ${formatCnpj(group.cnpj)}` : 'CNPJ da holding ainda não informado'}</small>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(group.empresas || []).length ? group.empresas.map((empresa) => <span key={empresa.id} className="badge">{empresa.nome}</span>) : <small style={{ color: 'var(--muted)' }}>Nenhuma empresa vinculada.</small>}</div>
            </article>
          ))}
          <form className="card" onSubmit={criarGrupo} style={{ display: 'grid', gap: 8 }}>
            <strong>Novo grupo</strong>
            <input aria-label="Nome do grupo" placeholder="Nome do grupo (ex.: Silvester Holding)" value={groupForm.nome} onChange={(event) => setGroupForm((current) => ({ ...current, nome: event.target.value }))} />
            <input aria-label="CNPJ da holding (opcional)" placeholder="CNPJ da holding (opcional)" value={groupForm.cnpj} onChange={(event) => setGroupForm((current) => ({ ...current, cnpj: formatCnpj(event.target.value) }))} />
            <input aria-label="Razão social (opcional)" placeholder="Razão social (opcional)" value={groupForm.razaoSocial} onChange={(event) => setGroupForm((current) => ({ ...current, razaoSocial: event.target.value }))} />
            <button type="submit" className="btn btn-primary" disabled={savingGroup || groupForm.nome.trim().length < 2}>{savingGroup ? 'Criando…' : 'Criar grupo'}</button>
          </form>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}><div><h2 style={{ margin: 0, fontSize: 20 }}>Empresas do Commerce</h2><small style={{ color: 'var(--muted)' }}>Visão global exclusiva do administrador da plataforma.</small></div><span className="badge">{tenants.length} empresa(s)</span></div>
        {loading ? <div className="card" role="status" style={{ color: 'var(--muted)' }}><Loader2 className="spin" size={16} /> Carregando empresas…</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>{tenants.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} groups={groups} onChangeGroup={mudarGrupo} changingGroup={changingGroupFor === tenant.id} />)}{!tenants.length && <div className="card" style={{ color: 'var(--muted)' }}>Nenhuma empresa Commerce disponível.</div>}</div>}
      </section>
    </main>
  )
}
