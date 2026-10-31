import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

export default function DinoCRMPreditivo() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ churn: [], retorno: [] });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const resposta = await api.get('/api/admin/dino/crm/preditivo');
      setData(resposta);
    } catch (e) {
      toast('Erro ao carregar CRM Preditivo', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function disparar(tipo) {
    const clientes = tipo === 'churn' ? data.churn : data.retorno;
    if (!clientes.length) return;
    const msg = tipo === 'churn' 
      ? 'Fala {Nome}, faz um tempo que não te vejo por aqui! O Dino tá com horários abertos para essa semana. Vamos agendar aquele trato? {Link Agendamento}'
      : 'Fala {Nome}, vi que já está na hora de dar aquele tapa no visual com o {Profissional}! Quer que eu já reserve um horário pra você? {Link Agendamento}';
    
    if (!window.confirm(`Disparar mensagem para ${clientes.length} clientes?`)) return;
    
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
        <h2>Clientes no Momento de Retorno ({data.retorno.length})</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>A IA calculou a frequência média de corte de cada um e identificou que eles estão alguns dias atrasados. É a hora exata de chamar!</p>
        {data.retorno.length > 0 && <p style={{ fontSize: 12, color: 'var(--accent)' }}>Exemplo: {data.retorno[0].nome} costuma vir a cada {data.retorno[0].frequenciaMedia} dias, mas já faz {data.retorno[0].diasDesdeUltimaVisita} dias!</p>}
        <button disabled={enviando || !data.retorno.length} onClick={() => disparar('retorno')} style={{ background: 'var(--accent)', color: '#fff', padding: '10px 16px', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
          {enviando ? 'Iniciando...' : 'Disparar Lembrete (T-Rex IA)'}
        </button>
      </div>

      <div style={{ background: 'var(--card)', padding: 20, borderRadius: 12, border: '1px solid var(--line)' }}>
        <h2>Clientes Inativos / Churn ({data.churn.length})</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Atrasados muito acima de sua própria frequência. A IA atuará de forma incisiva para recuperá-los e evitar o Churn definitivo.</p>
        {data.churn.length > 0 && <p style={{ fontSize: 12, color: '#e05c5c' }}>Exemplo: {data.churn[0].nome} costuma vir a cada {data.churn[0].frequenciaMedia} dias, mas já faz {data.churn[0].diasDesdeUltimaVisita} dias!</p>}
        <button disabled={enviando || !data.churn.length} onClick={() => disparar('churn')} style={{ background: '#e05c5c', color: '#fff', padding: '10px 16px', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
          {enviando ? 'Iniciando...' : 'Disparar Recuperação (T-Rex IA)'}
        </button>
      </div>
    </div>
  );
}
