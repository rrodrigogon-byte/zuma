import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, ExternalLink, Loader2, Plus, RefreshCw, ShieldCheck, Store } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const EMPTY_TENANT = {
  nomeFantasia: 'Dino',
  razaoSocial: '',
  cnpj: '',
  tipoNegocio: 'barbearia',
  adminName: '',
  adminEmail: '',
  alias: 'dino',
  brandKey: 'dino',
  lojaCodigo: 'DINO-MATRIZ',
  storefrontCodigo: 'dino-web',
  tagline: 'Barbearia, perfumaria e autocuidado em uma experiência integrada.',
  confirmAdminAccess: false,
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 14)
}

function TenantCard({ tenant }) {
  const storefronts = Array.isArray(tenant.storefronts) ? tenant.storefronts : []
  return (
    <article className="card" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="badge" style={{ marginBottom: 8 }}>{tenant.tipo_negocio || 'empresa'}</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{tenant.nome}</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 12 }}>{tenant.razao_social || 'Razão social não informada'} · CNPJ {tenant.cnpj || '—'}</p>
        </div>
        <span className="badge" style={{ color: tenant.ativa === false ? 'var(--bad)' : 'var(--good)', background: tenant.ativa === false ? 'var(--bad-wash)' : 'var(--good-wash)' }}>
          {tenant.ativa === false ? 'Inativa' : 'Ativa'}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {storefronts.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum storefront Commerce associado.</div> : storefronts.map((storefront) => {
          const aliases = Array.isArray(storefront.aliases) ? storefront.aliases : []
          return (
            <div key={storefront.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--surface-2)', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Store size={16} /> {storefront.nome}</strong>
                <span className="badge">{storefront.status}</span>
              </div>
              <small style={{ color: 'var(--muted)' }}>Código: {storefront.codigo} · Loja: {storefront.lojaId || 'tenant-wide'}</small>
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
  const [form, setForm] = useState(EMPTY_TENANT)
  const [result, setResult] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/admin/platform/commerce-tenants')
      setTenants(Array.isArray(response?.items) ? response.items : [])
    } catch (error) {
      toast(error.message || 'Não foi possível carregar os tenants do Commerce.', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const aliasValido = /^[a-z0-9][a-z0-9_-]{1,79}$/.test(form.alias)
  const formValido = useMemo(() => (
    Boolean(form.nomeFantasia.trim() && form.razaoSocial.trim() && onlyDigits(form.cnpj).length === 14 && form.adminEmail.trim() && aliasValido && form.confirmAdminAccess)
  ), [form, aliasValido])

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setResult(null)
  }

  async function provisionar(event) {
    event.preventDefault()
    if (!formValido) return toast('Revise nome, razão social, CNPJ, administrador e alias.', true)
    setCreating(true)
    setResult(null)
    try {
      const response = await api.post('/api/admin/platform/commerce-tenants', {
        nomeFantasia: form.nomeFantasia.trim(),
        razaoSocial: form.razaoSocial.trim(),
        cnpj: onlyDigits(form.cnpj),
        tipoNegocio: form.tipoNegocio,
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        alias: form.alias.trim().toLowerCase(),
        brandKey: form.brandKey.trim().toLowerCase(),
        lojaCodigo: form.lojaCodigo.trim().toUpperCase(),
        storefrontCodigo: form.storefrontCodigo.trim().toLowerCase(),
        publicConfig: { displayName: form.nomeFantasia.trim(), tagline: form.tagline.trim(), colors: { accent: '#6E7CE0', accentStrong: '#4B57A6', background: '#101114', surface: '#181A20', text: '#F4F5F7' } },
        confirmAdminAccess: form.confirmAdminAccess,
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
          <p style={{ color: 'var(--muted)', maxWidth: 760, lineHeight: 1.6, margin: '8px 0 0' }}>Cada empresa recebe identidade, usuários, lojas, catálogo, estoque, pedidos e pagamentos isolados. O provisionamento não cria produtos, preços, saldo ou credenciais.</p>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={carregar} disabled={loading}><RefreshCw size={15} /> Atualizar</button>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate((value) => !value)}><Plus size={15} /> Novo tenant</button>
        </div>
      </header>

      <section className="card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 13, alignItems: 'start', borderColor: 'var(--accent)' }}>
        <ShieldCheck size={24} color="var(--accent)" />
        <div><strong>Provisionamento seguro e idempotente</strong><p style={{ color: 'var(--muted)', margin: '5px 0 0', lineHeight: 1.55, fontSize: 13 }}>O alias público é único em toda a plataforma. Um CNPJ ou alias já ligado a outro tenant bloqueia a operação inteira, sem gravação parcial.</p></div>
      </section>

      {showCreate && (
        <form className="card" onSubmit={provisionar} style={{ display: 'grid', gap: 17 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Building2 size={20} color="var(--accent)" /><div><h2 style={{ margin: 0, fontSize: 19 }}>Provisionar tenant Dino</h2><small style={{ color: 'var(--muted)' }}>Informe somente dados reais e aprovados pelo responsável.</small></div></div>
          <div className="form-grid">
            <label className="form-group"><span>Nome fantasia</span><input value={form.nomeFantasia} onChange={(event) => change('nomeFantasia', event.target.value)} required /></label>
            <label className="form-group"><span>Razão social</span><input value={form.razaoSocial} onChange={(event) => change('razaoSocial', event.target.value)} required /></label>
            <label className="form-group"><span>CNPJ</span><input value={form.cnpj} onChange={(event) => change('cnpj', onlyDigits(event.target.value))} inputMode="numeric" placeholder="14 dígitos" required /><small>{onlyDigits(form.cnpj).length}/14 dígitos</small></label>
            <label className="form-group"><span>Tipo de negócio</span><select value={form.tipoNegocio} onChange={(event) => change('tipoNegocio', event.target.value)}><option value="barbearia">Barbearia e perfumaria</option><option value="loja">Loja</option><option value="outro">Outro</option></select></label>
            <label className="form-group"><span>Nome do administrador</span><input value={form.adminName} onChange={(event) => change('adminName', event.target.value)} /></label>
            <label className="form-group"><span>E-mail de acesso existente</span><input type="email" value={form.adminEmail} onChange={(event) => change('adminEmail', event.target.value)} required /><small>O e-mail já deve conseguir entrar no SetPoint.</small></label>
            <label className="form-group"><span>Alias público</span><input value={form.alias} onChange={(event) => change('alias', event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} required /><small style={{ color: aliasValido ? 'var(--good)' : 'var(--bad)' }}>/ecommerce/{form.alias || 'alias'}</small></label>
            <label className="form-group"><span>Identidade</span><input value={form.brandKey} onChange={(event) => change('brandKey', event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} required /></label>
            <label className="form-group"><span>Código da unidade</span><input value={form.lojaCodigo} onChange={(event) => change('lojaCodigo', event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} required /></label>
            <label className="form-group"><span>Código do storefront</span><input value={form.storefrontCodigo} onChange={(event) => change('storefrontCodigo', event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} required /></label>
            <label className="form-group" style={{ gridColumn: '1 / -1' }}><span>Mensagem pública</span><textarea rows="3" value={form.tagline} onChange={(event) => change('tagline', event.target.value)} /></label>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 13, border: '1px solid var(--line)', borderRadius: 11, background: 'var(--surface-2)', fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={form.confirmAdminAccess} onChange={(event) => change('confirmAdminAccess', event.target.checked)} style={{ width: 18, height: 18, flex: '0 0 18px', marginTop: 1 }} />
            <span>Confirmo que o titular de <strong>{form.adminEmail || 'e-mail informado'}</strong> foi autorizado a administrar o tenant e que a operação não cria produtos, saldos ou credenciais.</span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <small style={{ color: 'var(--muted)' }}>O storefront nasce em <strong>rascunho</strong>. Catálogo, estoque, pagamento e entrega exigem configuração própria.</small>
            <button type="submit" className="btn btn-primary" disabled={creating || !formValido}>{creating ? <><Loader2 className="spin" size={15} /> Provisionando…</> : <>Criar tenant isolado</>}</button>
          </div>
          {result && <div role="status" style={{ display: 'flex', gap: 9, alignItems: 'center', color: 'var(--good)', background: 'var(--good-wash)', padding: 12, borderRadius: 10 }}><CheckCircle2 size={18} /> Tenant {result.empresa?.nome} vinculado ao alias /ecommerce/{result.alias}.</div>}
        </form>
      )}

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}><div><h2 style={{ margin: 0, fontSize: 20 }}>Tenants do Commerce</h2><small style={{ color: 'var(--muted)' }}>Visão global exclusiva do administrador da plataforma.</small></div><span className="badge">{tenants.length} empresa(s)</span></div>
        {loading ? <div className="card" role="status" style={{ color: 'var(--muted)' }}><Loader2 className="spin" size={16} /> Carregando empresas…</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>{tenants.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} />)}{!tenants.length && <div className="card" style={{ color: 'var(--muted)' }}>Nenhum tenant Commerce disponível.</div>}</div>}
      </section>
    </main>
  )
}
