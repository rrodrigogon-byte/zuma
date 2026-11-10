import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  Copy,
  Send,
  RefreshCw,
  Sliders,
  Sparkles,
  Info,
  Radio,
  Layers,
  Check,
  AlertCircle
} from 'lucide-react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'

export default function WhatsappCloudApiPanel({ empresaId, lojaId }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviandoTeste, setEnviandoTeste] = useState(false)
  const [status, setStatus] = useState(null)
  const [copiado, setCopiado] = useState('')

  // Form de credenciais
  const [token, setToken] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [verifyToken, setVerifyToken] = useState('kytto_meta_webhook_2026')
  const [ativo, setAtivo] = useState(false)

  // Form de teste
  const [telefoneTeste, setTelefoneTeste] = useState('')
  const [comBotoes, setComBotoes] = useState(true)
  const [mensagemTeste, setMensagemTeste] = useState(
    'Olá! Seu agendamento está reservado na Barbearia Dino. Por favor, confirme abaixo:'
  )

  const carregarStatus = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/api/admin/whatsapp-cloud/status?empresaId=${empresaId || ''}`)
      setStatus(data)
      if (data?.config) {
        setPhoneNumberId(data.config.phoneNumberId || '')
        setWabaId(data.config.wabaId || '')
        setVerifyToken(data.config.verifyToken || 'kytto_meta_webhook_2026')
      }
    } catch (err) {
      toast({
        title: 'Aviso',
        description: 'Não foi possível carregar o status da Meta Cloud API: ' + err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarStatus()
  }, [empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSalvar = async (e) => {
    e?.preventDefault()
    setSalvando(true)
    try {
      await api.post('/api/admin/whatsapp-cloud/config', {
        empresaId,
        token: token || undefined,
        phoneNumberId,
        wabaId,
        verifyToken,
        ativo: true,
      })
      toast({
        title: 'Sucesso',
        description: 'Configurações oficiais da Meta WhatsApp Business salvas com sucesso!',
      })
      setToken('') // limpa o input por segurança
      carregarStatus()
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleEnviarTeste = async () => {
    if (!telefoneTeste) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe um número de telefone com DDD para testar.',
        variant: 'destructive',
      })
      return
    }

    setEnviandoTeste(true)
    try {
      const res = await api.post('/api/admin/whatsapp-cloud/teste', {
        empresaId,
        telefone: telefoneTeste,
        mensagem: mensagemTeste,
        comBotoes,
      })
      toast({
        title: 'Mensagem Enviada!',
        description: `Enviado com sucesso via Meta Cloud API! ID: ${res.messageId || 'OK'}`,
      })
    } catch (err) {
      toast({
        title: 'Falha no envio',
        description: err.message || 'Verifique as credenciais da Meta.',
        variant: 'destructive',
      })
    } finally {
      setEnviandoTeste(false)
    }
  }

  const copiarTexto = (txt, id) => {
    navigator.clipboard.writeText(txt)
    setCopiado(id)
    setTimeout(() => setCopiado(''), 2500)
    toast({ title: 'Copiado', description: 'Copiado para a área de transferência!' })
  }

  const webhookUrl = status?.config?.webhookUrl || `${window.location.origin}/api/webhooks/whatsapp-cloud`

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white">WhatsApp Business Oficial (Meta Cloud API)</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PROVEDOR OFICIAL
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Conexão direta com a Meta Graph API v22.0. Zero risco de banimento de chip, selo verde oficial e botões interativos.
            </p>
          </div>
        </div>

        <button
          onClick={carregarStatus}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Status
        </button>
      </div>

      {/* Banner de Status Operacional */}
      {status?.conectado ? (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-emerald-300">Linha Oficial Verificada e Ativa na Meta</span>
            <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300">
              <div>
                <span className="text-slate-400 block">Nome Verificado:</span>
                <strong className="text-white">{status.detalhes?.verifiedName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Número de Envio:</span>
                <strong className="text-white">{status.detalhes?.displayPhoneNumber || 'Configurado'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Qualidade da Linha:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  {status.detalhes?.qualityRating || 'ALTA (VERDE)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Status Meta:</span>
                <strong className="text-emerald-400">OPERACIONAL</strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-amber-300">Meta Cloud API em Modo de Configuração</span>
            <p className="text-xs text-slate-400 mt-1">
              Insira o Token Permanente (System User Token), Phone Number ID e WABA ID gerados no Meta Business Manager para ativar o canal oficial.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Formulário de Credenciais + Dados do Webhook */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: Credenciais Meta */}
        <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            Credenciais do Meta for Developers
          </h4>

          <form onSubmit={handleSalvar} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Token Permanente da Meta (System User Token)
              </label>
              <input
                type="password"
                placeholder={status?.config?.hasToken ? '•••••••••••••••• (Token já salvo no servidor)' : 'Cole o token EAAB...'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Gerado em Meta Business Suite → Usuários do Sistema → Gerar Token (escopos: whatsapp_business_messaging e whatsapp_business_management).
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  ID do Número de Telefone (Phone Number ID)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 104928172938472"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  ID da Conta WhatsApp (WABA ID)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 509281729384721"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg transition shadow-md flex items-center justify-center gap-2"
            >
              {salvando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Salvando Credenciais...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar e Conectar Linha Oficial
                </>
              )}
            </button>
          </form>
        </div>

        {/* Coluna 2: Dados do Webhook para cadastrar na Meta */}
        <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Webhook da Meta (Copie para o Painel de Desenvolvedores)
            </h4>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">URL de Retorno de Chamada (Callback URL)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400 select-all"
                />
                <button
                  onClick={() => copiarTexto(webhookUrl, 'url')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  {copiado === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado === 'url' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Token de Verificação (Verify Token)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={verifyToken}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400 select-all"
                />
                <button
                  onClick={() => copiarTexto(verifyToken, 'token')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  {copiado === 'token' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado === 'token' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
            <strong className="text-slate-300 block">Campos a assinar na Meta:</strong>
            <span>Marque <code>messages</code> e <code>message_template_status_update</code> no painel de Webhooks da Meta.</span>
          </div>
        </div>
      </div>

      {/* Seção de Teste de Envio com Botões Interativos */}
      <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-3">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-400" />
          Testar Envio Oficial em Tempo Real (com Botões Interativos)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Número de Telefone de Teste (com DDD)</label>
            <input
              type="text"
              placeholder="(65) 99905-6008"
              value={telefoneTeste}
              onChange={(e) => setTelefoneTeste(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-300 block mb-1">Texto da Mensagem</label>
            <input
              type="text"
              value={mensagemTeste}
              onChange={(e) => setMensagemTeste(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={comBotoes}
              onChange={(e) => setComBotoes(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span>Incluir Botões Interativos de Ação Rápida (CONFIRMAR / REMARCAR / FALAR COM ATENDENTE)</span>
          </label>

          <button
            onClick={handleEnviarTeste}
            disabled={enviandoTeste}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition shadow flex items-center gap-2 shrink-0"
          >
            {enviandoTeste ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Disparar Teste Oficial
          </button>
        </div>
      </div>
    </div>
  )
}
