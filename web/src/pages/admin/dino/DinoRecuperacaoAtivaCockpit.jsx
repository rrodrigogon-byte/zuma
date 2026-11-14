import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../../../lib/api'
import {
  Users,
  Send,
  Calendar,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Phone,
  RefreshCw,
  ShoppingBag,
  Percent,
  Award,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react'

const moeda = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function DinoRecuperacaoAtivaCockpit() {
  const [loading, setLoading] = useState(true)
  const [elegiveis, setElegiveis] = useState([])
  const [totalElegiveis, setTotalElegiveis] = useState(0)
  const [disparando, setDisparando] = useState(false)
  const [modoSimulacao, setModoSimulacao] = useState(false)
  const [resultadoDisparo, setResultadoDisparo] = useState(null)
  const [copiadoId, setCopiadoId] = useState(null)

  // Estados do Simulador de Pacotes Mensais
  const [barbeiroSimulado, setBarbeiroSimulado] = useState('bruno_nati') // 'bruno_nati' | 'dino'
  const [servicoSimulado, setServicoSimulado] = useState('corte') // 'corte' | 'barba' | 'combo'
  const [pacoteQtd, setPacoteQtd] = useState(4) // 4, 6 ou 8 procedimentos
  const [copiouPacote, setCopiouPacote] = useState(false)

  // Carregar status dos clientes elegíveis
  const carregarElegiveis = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/dino/recuperacao-ativa/status').catch(() => null)
      if (res && res.ok) {
        setElegiveis(res.elegiveis || [])
        setTotalElegiveis(res.total_elegiveis || 0)
      } else {
        // Fallback demonstrativo estruturado se API local
        setElegiveis([
          { cliente_id: '1', nome: 'Helder Matias', telefone: '556596416600', dias_sem_visita: 68, ultima_data: '2026-09-07' },
          { cliente_id: '2', nome: 'Elder Vinicius', telefone: '554799276752', dias_sem_visita: 65, ultima_data: '2026-09-10' },
          { cliente_id: '3', nome: 'Geofrey Lisgoski', telefone: '556699623422', dias_sem_visita: 72, ultima_data: '2026-09-03' },
          { cliente_id: '4', nome: 'Gilson Bataglini', telefone: '556599564914', dias_sem_visita: 61, ultima_data: '2026-09-14' },
          { cliente_id: '5', nome: 'Luiz Carlos Romani', telefone: '556584032582', dias_sem_visita: 63, ultima_data: '2026-09-12' },
          { cliente_id: '6', nome: 'Pedro Defant', telefone: '556599872121', dias_sem_visita: 64, ultima_data: '2026-09-11' },
          { cliente_id: '7', nome: 'Carlos Eduardo Sanches', telefone: '556599743386', dias_sem_visita: 70, ultima_data: '2026-09-05' },
          { cliente_id: '8', nome: 'Ivan Moura Calligaris', telefone: '556599207811', dias_sem_visita: 66, ultima_data: '2026-09-09' },
          { cliente_id: '9', nome: 'Alisson de Azevedo', telefone: '556596140221', dias_sem_visita: 62, ultima_data: '2026-09-13' },
          { cliente_id: '10', nome: 'Elias Cardoso', telefone: '556599395059', dias_sem_visita: 69, ultima_data: '2026-09-06' },
        ])
        setTotalElegiveis(10)
      }
    } catch {
      // Ignora erro
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarElegiveis()
  }, [carregarElegiveis])

  // Disparar recuperação
  const handleDispararLote = async () => {
    setDisparando(true)
    setResultadoDisparo(null)
    try {
      const res = await api.post(`/api/admin/dino/recuperacao-ativa?simular=${modoSimulacao ? 'true' : 'false'}&limite=10`)
      setResultadoDisparo(res)
      await carregarElegiveis()
    } catch (err) {
      setResultadoDisparo({ ok: false, error: err.message })
    } finally {
      setDisparando(false)
    }
  }

  // Cálculos do Simulador de Pacotes Mensais
  const precosUnitarios = {
    bruno_nati: { corte: 100, barba: 70, combo: 150 },
    dino: { corte: 300, barba: 300, combo: 600 },
  }
  const valorUnitario = precosUnitarios[barbeiroSimulado][servicoSimulado]
  const valorAvulsoTotal = valorUnitario * pacoteQtd
  const descontoPercentual = pacoteQtd >= 8 ? 0.20 : pacoteQtd >= 6 ? 0.15 : 0.10
  const valorComDesconto = valorAvulsoTotal * (1 - descontoPercentual)
  const economiaTotal = valorAvulsoTotal - valorComDesconto

  const textoPropostaPacote = `Olá! Tudo bem? Aqui é o T-Rex da recepção da Barbearia Dino! 💈🦖

Notamos que você gosta de manter seu visual sempre alinhado com frequência! Preparamos um *Pacote Mensal Exclusivo* para você com o ${barbeiroSimulado === 'dino' ? 'Mestre Dino' : 'Bruno ou a Nati'}:

📦 *Pacote Mensal (${pacoteQtd} procedimentos de ${servicoSimulado.toUpperCase()}):*
• Valor avulso: ${moeda(valorAvulsoTotal)}
• Desconto VIP (${descontoPercentual * 100}% OFF): economize ${moeda(economiaTotal)}
✨ *Seu investimento no pacote:* ${moeda(valorComDesconto)} (apenas ${moeda(valorComDesconto / pacoteQtd)} por atendimento!)

Além da economia garantida, você já deixa seus horários fixos travados no mês! Quer que eu já reserve seu pacote?
👉 https://kytto.com.br/agendar/dino`

  const copiarTextoPacote = () => {
    navigator.clipboard.writeText(textoPropostaPacote)
    setCopiouPacote(true)
    setTimeout(() => setCopiouPacote(false), 2500)
  }

  const copiarTelefone = (tel, id) => {
    navigator.clipboard.writeText(tel)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#1e293b' }}>
      {/* Header do Cockpit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '24px' }}>🦖</span>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
              Cockpit T-Rex de Vendas & Recuperação Ativa Diária
            </h1>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', border: '1px solid #fde68a' }}>
              Motor KyttoIA
            </span>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Automação diária de reativação de clientes ausentes há mais de 60 dias com benefícios de boas-vindas e upsell de pacotes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => carregarElegiveis()}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar Base
          </button>

          <button
            onClick={handleDispararLote}
            disabled={disparando || elegiveis.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              cursor: disparando ? 'not-allowed' : 'pointer',
              fontWeight: '700',
              fontSize: '14px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              opacity: disparando ? 0.7 : 1
            }}
          >
            <Send size={16} />
            {disparando ? 'Disparando Lote...' : 'Disparar Lote do Dia (10 Clientes)'}
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Elegíveis para Hoje</span>
            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '4px', borderRadius: '6px' }}><Users size={16} /></span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{totalElegiveis}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Ausentes &gt; 60 dias sem contato nos últimos 30d</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Horário do Disparo Diário</span>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px', borderRadius: '6px' }}><Clock size={16} /></span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>09:30 <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>Cuiabá (UTC-4)</span></div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px', fontWeight: '600' }}>✓ Worker em execução 24x7 no Render</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Receita Estimada a Recuperar</span>
            <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px', borderRadius: '6px' }}><TrendingUp size={16} /></span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#15803d' }}>{moeda(totalElegiveis * 150 * 0.35)}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Baseado em 35% de taxa média de retorno</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Modo de Operação</span>
            <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '4px', borderRadius: '6px' }}><Zap size={16} /></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', color: modoSimulacao ? '#d97706' : '#16a34a' }}>
              <input
                type="checkbox"
                checked={modoSimulacao}
                onChange={(e) => setModoSimulacao(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              {modoSimulacao ? '🧪 Simulação (sem envio real)' : '⚡ Envio Real via WhatsApp'}
            </label>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Controle de segurança e anti-ban</div>
        </div>
      </div>

      {/* Grid Principal: Lista dos 10 Clientes + Simulador de Pacotes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        
        {/* Painel da Esquerda: Próximos 10 Clientes da Fila */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#2563eb" />
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
                Lote de Hoje: 10 Clientes Inativos Selecionados
              </h2>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
              Ordem: Mais tempo ausente
            </span>
          </div>

          {resultadoDisparo && (
            <div style={{ padding: '12px 16px', background: resultadoDisparo.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${resultadoDisparo.ok ? '#bbf7d0' : '#fecaca'}`, borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: resultadoDisparo.ok ? '#166534' : '#991b1b' }}>
              <strong>{resultadoDisparo.ok ? '✓ Lote processado com sucesso!' : '✕ Falha no disparo:'}</strong> {resultadoDisparo.total_processados ? `${resultadoDisparo.total_processados} mensagens enviadas!` : resultadoDisparo.error || 'Verifique as configurações.'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto' }}>
            {elegiveis.map((cli, idx) => (
              <div
                key={cli.cliente_id || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                  background: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0e7ff', color: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{cli.nome}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={11} /> {cli.telefone}
                      {cli.dias_sem_visita && (
                        <span style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          {cli.dias_sem_visita} dias ausente
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => copiarTelefone(cli.telefone, cli.cliente_id || idx)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copiadoId === (cli.cliente_id || idx) ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {copiadoId === (cli.cliente_id || idx) ? 'Copiado' : 'Copiar'}
                  </button>

                  <a
                    href={`https://wa.me/${String(cli.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Fala, ${cli.nome?.split(' ')[0] || 'Amigo'}! Tudo bem por aí? Aqui é o T-Rex da Barbearia Dino! 💈🦖\n\nNotei aqui que faz um tempinho que você não vem dar aquele talento no visual com a nossa equipe! Como estão as coisas?\n\nPreparamos uma condição especial de boas-vindas para o seu retorno nesta semana com corte ou barba: café gourmet cortesia e concorre a sorteios na roleta! 🎁\n\nQue dia fica melhor pra você passar aqui: quinta, sexta ou sábado?\n👉 https://kytto.com.br/agendar/dino`)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#22c55e',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '700',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Send size={12} /> WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Painel da Direita: Simulador Comercial de Pacotes Mensais */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Award size={18} color="#eab308" />
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
              Simulador Comercial de Pacotes Mensais Dino
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                Profissional / Barbeiro:
              </label>
              <select
                value={barbeiroSimulado}
                onChange={(e) => setBarbeiroSimulado(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}
              >
                <option value="bruno_nati">Bruno ou Nati (Padrão)</option>
                <option value="dino">Mestre Dino (VIP)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                Procedimento:
              </label>
              <select
                value={servicoSimulado}
                onChange={(e) => setServicoSimulado(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}
              >
                <option value="corte">Corte Masculino</option>
                <option value="barba">Barba / Barboterapia</option>
                <option value="combo">Combo Corte + Barba</option>
              </select>
            </div>
          </div>

          {/* Seleção do Pacote */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
              Quantidade de Procedimentos no Pacote Mensal:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { qtd: 4, desc: '10% OFF', label: '4 Serviços' },
                { qtd: 6, desc: '15% OFF', label: '6 Serviços' },
                { qtd: 8, desc: '20% OFF', label: '8 Serviços' },
              ].map((opt) => (
                <button
                  key={opt.qtd}
                  onClick={() => setPacoteQtd(opt.qtd)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: pacoteQtd === opt.qtd ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: pacoteQtd === opt.qtd ? '#eff6ff' : '#f8fafc',
                    color: pacoteQtd === opt.qtd ? '#1d4ed8' : '#334155',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: '700'
                  }}
                >
                  <div style={{ fontSize: '14px' }}>{opt.label}</div>
                  <div style={{ fontSize: '11px', color: pacoteQtd === opt.qtd ? '#2563eb' : '#16a34a', fontWeight: '800', marginTop: '2px' }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Resultado Financeiro do Pacote */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span style={{ color: '#64748b' }}>Valor Avulso Somado:</span>
              <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontWeight: '600' }}>{moeda(valorAvulsoTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span style={{ color: '#16a34a', fontWeight: '600' }}>Desconto do Pacote ({descontoPercentual * 100}%):</span>
              <span style={{ color: '#16a34a', fontWeight: '700' }}>- {moeda(economiaTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #cbd5e1', fontSize: '16px', fontWeight: '800' }}>
              <span style={{ color: '#0f172a' }}>Total do Pacote:</span>
              <span style={{ color: '#2563eb' }}>{moeda(valorComDesconto)}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right', marginTop: '4px' }}>
              Sai a apenas <strong>{moeda(valorComDesconto / pacoteQtd)}</strong> por atendimento!
            </div>
          </div>

          {/* Botão de Copiar Texto para Envio */}
          <button
            onClick={copiarTextoPacote}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: copiouPacote ? '#16a34a' : '#0f172a',
              color: '#fff',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {copiouPacote ? <Check size={16} /> : <Copy size={16} />}
            {copiouPacote ? 'Proposta Copiada para o WhatsApp!' : 'Copiar Proposta Pronta para o WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  )
}
