import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function ConcretoKyttoIACopilot({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [recomendacoes, setRecomendacoes] = useState(null);
  const [pergunta, setPergunta] = useState('');
  const [historico, setHistorico] = useState([
    {
      tipo: 'ia',
      texto: 'Olá! Sou o Copilot KyttoIA Industrial da Usina Serrano Concreto. Estou conectado aos sensores da Balança 80t, Central Convicta e Laboratório NBR 5738/5739. Como posso auxiliar na dosagem, controle térmico ou despacho hoje?'
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      carregarRecomendacoes();
    }
  }, [isOpen]);

  const carregarRecomendacoes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/concreto/ia/recomendacoes');
      if (res && res.ok) {
        setRecomendacoes(res);
      }
    } catch (e) {
      console.warn('Falha ao carregar recomendações KyttoIA:', e);
    } finally {
      setLoading(false);
    }
  };

  const enviarPergunta = async (textoPersonalizado) => {
    const p = textoPersonalizado || pergunta;
    if (!p.trim()) return;

    const novoHistorico = [...historico, { tipo: 'user', texto: p }];
    setHistorico(novoHistorico);
    if (!textoPersonalizado) setPergunta('');
    setLoading(true);

    try {
      const res = await api.post('/api/admin/concreto/ia/consultar', { pergunta: p });
      if (res && res.ok) {
        setHistorico([...novoHistorico, {
          tipo: 'ia',
          texto: res.resposta,
          normas: res.normasCitadas,
          params: res.parametrosSugeridos
        }]);
      } else {
        setHistorico([...novoHistorico, { tipo: 'ia', texto: 'Desculpe, ocorreu um erro ao consultar o motor KyttoIA.' }]);
      }
    } catch (e) {
      setHistorico([...novoHistorico, { tipo: 'ia', texto: 'Falha na comunicação com o motor KyttoIA: ' + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="serrano-modal-overlay" style={{ zIndex: 1200 }}>
      <div className="serrano-modal-card" style={{ maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Header do Copilot */}
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--serrano-orange)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(234, 88, 12, 0.2)', border: '1px solid #ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              🤖
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b style={{ fontSize: 16 }}>Copilot KyttoIA Industrial</b>
                <span style={{ fontSize: 10, background: '#ea580c', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                  Motor KyttoIA 2.5 Flash
                </span>
                <span style={{ fontSize: 11, color: '#38bdf8' }}>Tangará da Serra · 34°C</span>
              </div>
              <small style={{ color: '#94a3b8', fontSize: 11 }}>
                Assistência técnica e preditiva em dosagem NBR 7212, controle tecnológico e despacho
              </small>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Corpo com Grid: Diagnósticos e Chat */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden' }}>
          
          {/* Coluna Esquerda: Diagnósticos em Tempo Real */}
          <div style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--joint)', padding: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <b style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                Diagnósticos NBR 7212
              </b>
              <button 
                type="button" 
                onClick={carregarRecomendacoes} 
                style={{ background: 'none', border: 'none', color: 'var(--serrano-orange)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
              >
                ↻ Atualizar
              </button>
            </div>

            {loading && !recomendacoes && (
              <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--text-muted)' }}>
                Consultando sensores da usina...
              </div>
            )}

            {recomendacoes?.diagnosticos?.map(diag => (
              <div 
                key={diag.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--joint)',
                  borderLeft: `4px solid ${diag.severidade === 'atencao' ? '#f59e0b' : diag.severidade === 'sucesso' ? '#10b981' : '#38bdf8'}`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 10,
                  fontSize: 11
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{diag.titulo}</div>
                <div style={{ color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 6 }}>{diag.descricao}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{diag.norma}</span>
                  <button 
                    type="button" 
                    onClick={() => enviarPergunta(`Como aplicar a ação sugerida: "${diag.acaoSugerida}"?`)}
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {diag.acaoSugerida}
                  </button>
                </div>
              </div>
            ))}

            {/* Ações Rápidas */}
            <div style={{ marginTop: 16 }}>
              <b style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Consultas Rápidas:</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'Desconto de água para areia do Sepotuba com 5,8% de umidade',
                  'Qual o prazo máximo de pega NBR 7212 em dia quente?',
                  'Regras de aceitação estatística do lote NBR 12655'
                ].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => enviarPergunta(q)}
                    style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--joint)', padding: '6px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: 'var(--text)' }}
                  >
                    💬 {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Conversa Interativa */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {historico.map((msg, i) => (
                <div 
                  key={i}
                  style={{
                    alignSelf: msg.tipo === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: msg.tipo === 'user' ? 'var(--serrano-orange)' : 'var(--surface-2)',
                    color: msg.tipo === 'user' ? '#fff' : 'var(--text)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 12,
                    lineHeight: 1.5,
                    border: msg.tipo === 'user' ? 'none' : '1px solid var(--joint)'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, opacity: 0.8 }}>
                    {msg.tipo === 'user' ? 'Você (Operador/Engenheiro)' : 'Copilot KyttoIA Industrial'}
                  </div>
                  <div>{msg.texto}</div>
                  {msg.normas && msg.normas.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(0,0,0,0.1)', fontSize: 10, color: 'var(--text-muted)' }}>
                      Normas ABNT: <b>{msg.normas.join(' · ')}</b>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{ alignSelf: 'flex-start', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  Motor KyttoIA processando cálculos e referências normativas...
                </div>
              )}
            </div>

            {/* Input de Pergunta */}
            <div style={{ padding: 12, borderTop: '1px solid var(--joint)', background: 'var(--surface)', display: 'flex', gap: 8 }}>
              <input 
                type="text"
                className="serrano-input"
                placeholder="Pergunte ao KyttoIA sobre dosagem, slump loss, fck ou balanças..."
                value={pergunta}
                onChange={e => setPergunta(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviarPergunta()}
                style={{ flex: 1 }}
              />
              <button 
                type="button" 
                className="btn-serrano pri"
                onClick={() => enviarPergunta()}
                disabled={loading || !pergunta.trim()}
              >
                Enviar
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
