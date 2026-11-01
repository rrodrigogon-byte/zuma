import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const t = { bg: '#0E1014', surface: '#161922', card: '#1C202B', accent: '#6E7CE0', muted: '#A4AABE', cream: '#E8EAF2', line: '#2B3140', red: '#F27A89', green: '#3CC48B', yellow: '#E0B24B', blue: '#5AA9F0' };

function reais(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BarbeiroClienteDetalhe({ clienteId }) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [detalhes, setDetalhes] = useState(null);

  useEffect(() => {
    if (!clienteId) return;
    setLoading(true);
    // Tenta carregar os dados via api de clientes 360 se disponível para a equipe.
    // Como a rota 360 pode ser restrita, simularemos um prontuário básico buscando a API que o frontend tem acesso.
    // Ou usar a rota 360 direto se funcionar.
    api.get(`/api/admin/barbearia/clientes-360/${clienteId}`)
      .then(res => setDetalhes(res.cliente || res))
      .catch(err => {
         setErro('Não foi possível carregar os detalhes avançados deste cliente.');
         console.error(err);
      })
      .finally(() => setLoading(false));
  }, [clienteId]);

  if (loading) return <div style={{ color: t.muted, padding: 20, textAlign: 'center' }}>Carregando prontuário...</div>;
  if (erro) return <div style={{ color: t.red, padding: 20, textAlign: 'center' }}>{erro}</div>;
  if (!detalhes) return <div style={{ color: t.muted, padding: 20, textAlign: 'center' }}>Cliente não encontrado.</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
       <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 12, padding: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, color: t.cream }}>{detalhes.nome}</h2>
          <p style={{ margin: 0, color: t.muted, fontSize: 14 }}>{detalhes.telefone || 'Sem telefone'}</p>
          
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
             {detalhes.assinante && (
               <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800 }}>⭐ Assinante Clube</span>
             )}
             <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800 }}>✂️ {detalhes.visitasHistoricas || detalhes.visitas || 1} Visitas</span>
          </div>
       </div>

       {detalhes.preferencias && (
         <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 12, padding: 16 }}>
           <strong style={{ fontSize: 14, color: t.muted, display: 'block', marginBottom: 8 }}>PREFERÊNCIAS E NOTAS</strong>
           <div style={{ color: t.cream, fontSize: 14, lineHeight: 1.5 }}>
             {detalhes.preferencias}
           </div>
         </div>
       )}

       <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 12, padding: 16 }}>
          <strong style={{ fontSize: 14, color: t.muted, display: 'block', marginBottom: 8 }}>ÚLTIMOS SERVIÇOS</strong>
          {detalhes.historico && detalhes.historico.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {detalhes.historico.slice(0, 3).map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i === 2 ? 'none' : `1px solid ${t.line}` }}>
                   <div style={{ fontSize: 13, color: t.cream }}>{h.servicoNome}</div>
                   <div style={{ fontSize: 12, color: t.muted }}>{h.dataAgenda}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: t.muted, fontSize: 13 }}>Nenhum histórico recente.</div>
          )}
       </div>

       <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.15) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
         <span style={{ fontSize: 24 }}>💡</span>
         <div style={{ fontSize: 12, color: '#6ee7b7', lineHeight: 1.4 }}>
           <strong>Dica da IA:</strong> Este cliente costuma comprar <em>Pomada Modeladora</em>. Que tal oferecer uma no final do corte para aumentar sua comissão de hoje?
         </div>
       </div>
    </div>
  );
}
