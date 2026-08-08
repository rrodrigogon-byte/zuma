import React, { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth'

const REGIMES = [
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' }
]

const AMBIENTES = [
  { value: 'homologacao', label: 'Homologação (Testes)' },
  { value: 'producao', label: 'Produção' }
]

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export default function FiscalConfig() {
  const { user, token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [config, setConfig] = useState({
    cnpj: '',
    ie: '',
    im: '',
    razao_social: '',
    nome_fantasia: '',
    regime_tributario: 'simples',
    ambiente: 'homologacao',
    uf: 'MT',
    csc_id: '',
    csc: '',
    serie_nfce: 1,
    serie_nfe: 1,
    certificado_valido: false
  })

  const [certFile, setCertFile] = useState(null)
  const [certSenha, setCertSenha] = useState('')

  useEffect(() => {
    carregarConfig()
  }, [])

  async function carregarConfig() {
    try {
      setLoading(true)
      const res = await fetch('/api/v1/fiscal/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.config) setConfig(data.config)
      }
    } catch (err) {
      setError('Erro ao carregar configuração: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function salvarConfig() {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/v1/fiscal/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      })

      if (res.ok) {
        const data = await res.json()
        setConfig(data.config)
        setSuccess('Configuração fiscal salva com sucesso!')
      } else {
        const err = await res.json()
        setError(err.erro || 'Erro ao salvar configuração')
      }
    } catch (err) {
      setError('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadCertificado() {
    if (!certFile || !certSenha) {
      setError('Selecione um arquivo de certificado e informe a senha')
      return
    }

    try {
      setUploadingCert(true)
      setError('')
      setSuccess('')

      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1]

        const res = await fetch('/api/v1/fiscal/certificado', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            pfx_base64: base64,
            senha: certSenha
          })
        })

        if (res.ok) {
          const data = await res.json()
          setSuccess(data.mensagem || 'Certificado A1 configurado com sucesso!')
          setCertFile(null)
          setCertSenha('')
          await carregarConfig()
        } else {
          const err = await res.json()
          setError(err.erro || 'Erro ao fazer upload do certificado')
        }
      }
      reader.readAsDataURL(certFile)
    } catch (err) {
      setError('Erro: ' + err.message)
    } finally {
      setUploadingCert(false)
    }
  }

  if (loading) return <div className="p-4">Carregando...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">⚙️ Configuração Fiscal</h1>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      {/* Certificado A1 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">🔐 Certificado Digital A1</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Arquivo .p12 ou .pfx</label>
            <input
              type="file"
              accept=".p12,.pfx"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Senha do Certificado</label>
            <input
              type="password"
              value={certSenha}
              onChange={(e) => setCertSenha(e.target.value)}
              placeholder="Digite a senha do certificado"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <button
            onClick={uploadCertificado}
            disabled={uploadingCert || !certFile}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {uploadingCert ? 'Enviando...' : '📤 Enviar Certificado'}
          </button>

          {config.certificado_valido && (
            <div className="bg-green-50 border border-green-200 p-3 rounded text-green-700">
              ✅ Certificado configurado e válido
            </div>
          )}
        </div>
      </div>

      {/* Dados da Empresa */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">🏢 Dados da Empresa</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">CNPJ</label>
            <input
              type="text"
              value={config.cnpj}
              onChange={(e) => setConfig({ ...config, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Inscrição Estadual (IE)</label>
            <input
              type="text"
              value={config.ie}
              onChange={(e) => setConfig({ ...config, ie: e.target.value })}
              placeholder="IE"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Inscrição Municipal (IM)</label>
            <input
              type="text"
              value={config.im}
              onChange={(e) => setConfig({ ...config, im: e.target.value })}
              placeholder="IM"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">UF</label>
            <select
              value={config.uf}
              onChange={(e) => setConfig({ ...config, uf: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2">Razão Social</label>
            <input
              type="text"
              value={config.razao_social}
              onChange={(e) => setConfig({ ...config, razao_social: e.target.value })}
              placeholder="Razão Social da Empresa"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2">Nome Fantasia</label>
            <input
              type="text"
              value={config.nome_fantasia}
              onChange={(e) => setConfig({ ...config, nome_fantasia: e.target.value })}
              placeholder="Nome Fantasia"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Configuração Fiscal */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">📋 Configuração Fiscal</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Regime Tributário</label>
            <select
              value={config.regime_tributario}
              onChange={(e) => setConfig({ ...config, regime_tributario: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Ambiente</label>
            <select
              value={config.ambiente}
              onChange={(e) => setConfig({ ...config, ambiente: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {AMBIENTES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Série NFC-e</label>
            <input
              type="number"
              value={config.serie_nfce}
              onChange={(e) => setConfig({ ...config, serie_nfce: parseInt(e.target.value) })}
              min="1"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Série NF-e</label>
            <input
              type="number"
              value={config.serie_nfe}
              onChange={(e) => setConfig({ ...config, serie_nfe: parseInt(e.target.value) })}
              min="1"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2">CSC (Código de Segurança do Contribuinte)</label>
            <input
              type="text"
              value={config.csc}
              onChange={(e) => setConfig({ ...config, csc: e.target.value })}
              placeholder="CSC para NFC-e"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2">CSC ID</label>
            <input
              type="text"
              value={config.csc_id}
              onChange={(e) => setConfig({ ...config, csc_id: e.target.value })}
              placeholder="ID do CSC"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Botão Salvar */}
      <button
        onClick={salvarConfig}
        disabled={saving}
        className="w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 disabled:bg-gray-400 font-bold text-lg"
      >
        {saving ? '💾 Salvando...' : '💾 Salvar Configuração Fiscal'}
      </button>
    </div>
  )
}
