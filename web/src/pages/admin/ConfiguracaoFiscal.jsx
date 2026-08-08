/**
 * Configuração Fiscal — KYTTO Clube (Motor Fiscal Próprio)
 * Upload de Certificado A1, configuração SEFAZ, CSC, ambiente
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export default function ConfiguracaoFiscal() {
  const { toast } = useToast()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formConfig, setFormConfig] = useState({
    cnpj: '', ie: '', razao_social: '', nome_fantasia: '', uf: 'MT',
    regime_tributario: 'simples', ambiente: 'homologacao',
    csc_id: '', csc: '', serie_nfce: 1, serie_nfe: 1
  })
  const [certSenha, setCertSenha] = useState('')
  const [certFile, setCertFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const cfgData = await api.get('/api/v1/fiscal/config')
      if (cfgData.config) {
        setConfig(cfgData.config)
        setFormConfig(c => ({ ...c, ...cfgData.config }))
      }
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvarConfig() {
    try {
      await api.post('/api/v1/fiscal/config', formConfig)
      toast('Configuração fiscal salva!', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function uploadCertificado() {
    if (!certFile || !certSenha) return toast('Selecione o arquivo .pfx e informe a senha', 'error')
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(e.target.result)))
        await api.post('/api/v1/fiscal/certificado', { pfx_base64: base64, senha: certSenha })
        toast('Certificado A1 configurado com sucesso!', 'success')
        setCertFile(null)
        setCertSenha('')
        carregar()
        setUploading(false)
      }
      reader.readAsArrayBuffer(certFile)
    } catch (err) {
      toast(err.message, 'error')
      setUploading(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando...</div>

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>⚙️ Configuração Fiscal</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          Motor fiscal próprio — comunicação direta com a SEFAZ, sem provedores externos
        </p>
      </div>

      {/* Status do Certificado */}
      <div style={{ background: config?.certificado_valido ? '#FF6B2C18' : '#e05c5c18', border: `1px solid ${config?.certificado_valido ? '#FF6B2C' : '#e05c5c'}`, borderRadius: 10, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>{config?.certificado_valido ? '✅' : '⚠️'}</span>
        <div>
          <div style={{ fontWeight: 700, color: config?.certificado_valido ? '#FF6B2C' : '#e05c5c' }}>
            {config?.certificado_valido ? 'Certificado A1 configurado e válido' : 'Certificado A1 não configurado'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {config?.certificado_valido
              ? 'O sistema está pronto para emitir NFC-e, NF-e e NF-Se diretamente na SEFAZ'
              : 'Configure o certificado digital A1 (.pfx) para habilitar a emissão de documentos fiscais'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', background: config?.ambiente === 'producao' ? '#FF6B2C22' : '#f59e0b22', color: config?.ambiente === 'producao' ? '#FF6B2C' : '#f59e0b', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          {config?.ambiente === 'producao' ? '🟢 PRODUÇÃO' : '🟡 HOMOLOGAÇÃO'}
        </div>
      </div>

      {/* Dados da Empresa */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, border: '1px solid var(--line)', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>🏢 Dados da Empresa</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'CNPJ *', key: 'cnpj', placeholder: '00.000.000/0001-00' },
            { label: 'Inscrição Estadual', key: 'ie', placeholder: '0000000000-0' },
            { label: 'UF *', key: 'uf', placeholder: 'MT' },
            { label: 'Razão Social *', key: 'razao_social', placeholder: 'Empresa Ltda' },
            { label: 'Nome Fantasia', key: 'nome_fantasia', placeholder: 'Empresa' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
              <input placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => setFormConfig(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Regime Tributário</label>
            <select value={formConfig.regime_tributario} onChange={e => setFormConfig(p => ({ ...p, regime_tributario: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg)' }}>
              <option value="simples">Simples Nacional (CRT 1)</option>
              <option value="lucro_presumido">Lucro Presumido (CRT 3)</option>
              <option value="lucro_real">Lucro Real (CRT 3)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Ambiente SEFAZ</label>
            <select value={formConfig.ambiente} onChange={e => setFormConfig(p => ({ ...p, ambiente: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg)' }}>
              <option value="homologacao">Homologação (Testes)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
          {[
            { label: 'CSC ID (NFC-e)', key: 'csc_id', placeholder: '000001' },
            { label: 'CSC Token (NFC-e)', key: 'csc', placeholder: 'Token do SEFAZ MT' },
            { label: 'Série NFC-e', key: 'serie_nfce', type: 'number' },
            { label: 'Série NF-e', key: 'serie_nfe', type: 'number' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
              <input type={f.type || 'text'} placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => setFormConfig(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <button onClick={salvarConfig} className="btn-primary" style={{ marginTop: 20 }}>Salvar Configuração</button>
      </div>

      {/* Upload Certificado A1 */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>🔐 Certificado Digital A1 (.pfx / .p12)</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 14 }}>
          O arquivo do certificado é armazenado de forma segura no servidor. Nunca é transmitido para provedores externos.
          A senha é usada apenas para extrair a chave privada na hora da assinatura.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Arquivo do Certificado (.pfx ou .p12)</label>
            <input type="file" accept=".pfx,.p12" onChange={e => setCertFile(e.target.files[0])}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Senha do Certificado</label>
            <input type="password" placeholder="Senha do .pfx" value={certSenha} onChange={e => setCertSenha(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box' }} />
          </div>
          <button onClick={uploadCertificado} disabled={uploading} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
            {uploading ? 'Enviando...' : '🔐 Enviar Certificado'}
          </button>
        </div>
      </div>
    </div>
  )
}
