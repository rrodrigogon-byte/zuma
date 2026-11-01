import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

export default function DinoCRMPreditivo() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ churn: [], retorno: [], risco: [] });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const resposta = await api.get('/api/admin/dino/crm/preditivo');
      // A resposta tem churn (dias > 90) e retorno (limite <= dias <= 90). O retorno tem .nivel ('lembrete' ou 'risco')
      const retornoNormal = (resposta.retorno || []).filter(c => c.nivel === 'lembrete');
      const risco = (resposta.retorno || []).filter(c => c.nivel === 'risco');
      
      setData({ churn: resposta.churn || [], retorno: retornoNormal, risco });
    } catch (e) {
      toast('Erro ao carregar CRM Preditivo', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function disparar(tipo) {
    const clientes = data[tipo];
    if (!clientes || !clientes.length) return;
    
    let msg = '';
    if (tipo === 'churn') {
       msg = 'Fala {Nome}, estamos com saudades! Vi que faz mais de 90 dias que você não vem. O Dino preparou um presente para você: *35% DE DESCONTO* em qualquer serviço para agendar essa semana! Vamos aproveitar? {Link Agendamento}';
    } else if (tipo === 'risco') {
       msg = 'Fala {Nome}, faz um tempinho que não te vejo por aqui! O Dino tá com horários abertos para essa semana. Que tal dar aquele trato no visual? {Link Agendamento}';
    } else { // retorno
       msg = 'Fala {Nome}, vi que já está na hora de dar aquele tapa no visual com o {Profissional}! Tenho opções de horário para você hoje ou amanhã. Quer que eu já reserve um horário? {Link Agendamento}';
    }
    
    if (!window.confirm(`Disparar mensagem para ${clientes.length} clientes da categoria ${tipo.toUpperCase()}?`)) return;
    
    setEnviando(true);
    try {
      await api.post('/api/admin/dino/crm/disparo', {
        clientesIds: clientes.map(c => c.id),
        mensagem: msg
      });
      toast('Campanha iniciada com sucesso!', 'success');
    } catch (e) {
      toast('Erro ao disparar campanha', 'error');
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return <div>Carregando IA Preditiva...</div>;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ background: 'var(--card)', padding: 20, borderRadius: 12, border: '1px solid var(--line)' }}>
        <h2>Clientes no Momento de Retorno (Até 60 Dias) - {data.retorno.length} clientes</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>A IA calculou a frequência média e eles estão no momento ideal. Lembrete simples com opções de horário.</p>
        {data.retorno.length > 0 && <p style={{ fontSize: 12, color: 'var(--accent)' }}>Exemplo: {data.retorno[0].nome} costuma vir a cada {data.retorno[0].frequenciaMedia} dias, e já faz {data.retorno[0].diasDesdeUltimaVisita} dias.</p>}
        <button disabled={enviando || !data.retorno.length} onClick={() => disparar('retorno')} style={{ background: 'var(--accent)', color: '#fff', padding: '10px 16px', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
          {enviando ? 'Iniciando...' : 'Disparar Lembrete (T-Rex IA)'}
        </button>
      </div>
      
      <div style={{ background: 'var(--card)', padding: 20, borderRadius: 12, border: '1px solid var(--line)' }}>
        <h2 style={{ color: '#f59e0b' }}>Clientes em Risco (61 a 90 Dias) - {data.risco.length} clientes</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Atrasados muito acima da frequência, mas ainda dentro de 90 dias. Ação de retenção moderada.</p>
        {data.risco.length > 0 && <p style={{ fontSize: 12, color: '#f59e0b' }}>Exemplo: {data.risco[0].nome} costuma vir a cada {data.risco[0].frequenciaMedia} dias, e já faz {data.risco[0].diasDesdeUltimaVisita} dias.</p>}
        <button disabled={enviando || !data.risco.length} onClick={() => disparar('risco')} style={{ background: '#f59e0b', color: '#fff', padding: '10px 16px', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
          {enviando ? 'Iniciando...' : 'Disparar Retenção (T-Rex IA)'}
        </button>
      </div>

      <div style={{ background: 'var(--card)', padding: 20, borderRadius: 12, border: '1px solid var(--line)' }}>
        <h2 style={{ color: '#e05c5c' }}>Clientes Inativos / Churn (+90 Dias) - {data.churn.length} clientes</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Acima de 90 dias inativos. A IA atuará de forma agressiva com <strong>35% DE DESCONTO</strong> para recuperá-los.</p>
        {data.churn.length > 0 && <p style={{ fontSize: 12, color: '#e05c5c' }}>Exemplo: {data.churn[0].nome} costuma vir a cada {data.churn[0].frequenciaMedia} dias, e já faz {data.churn[0].diasDesdeUltimaVisita} dias!</p>}
        <button disabled={enviando || !data.churn.length} onClick={() => disparar('churn')} style={{ background: '#e05c5c', color: '#fff', padding: '10px 16px', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
          {enviando ? 'Iniciando...' : 'Disparar Recuperação Agressiva (35% OFF)'}
        </button>
      </div>
    </div>
  );
}
