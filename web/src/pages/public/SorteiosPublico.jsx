import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Gift,
  Trophy,
  Ticket,
  Calendar,
  ShieldCheck,
  Search,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import './SorteiosPublico.css';

export default function SorteiosPublico() {
  const { slug = 'dino' } = useParams();

  const [carregando, setCarregando] = useState(true);
  const [dadosEmpresa, setDadosEmpresa] = useState(null);
  const [campanhasAtivas, setCampanhasAtivas] = useState([]);
  const [ganhadoresHistoricos, setGanhadoresHistoricos] = useState([]);

  // Consulta do cliente
  const [telefoneBusca, setTelefoneBusca] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [resultadoMeusBilhetes, setResultadoMeusBilhetes] = useState(null);
  const [erroConsulta, setErroConsulta] = useState('');

  // Carrega informações públicas da empresa e campanhas
  const carregarDadosPublicos = useCallback(async () => {
    try {
      setCarregando(true);
      const res = await fetch(`/api/publico/sorteios/${slug}`);
      const data = await res.json();
      if (data.ok) {
        setDadosEmpresa(data.empresa);
        setCampanhasAtivas(data.campanhasAtivas || []);
        setGanhadoresHistoricos(data.ganhadoresHistoricos || []);
      }
    } catch (err) {
      console.error('Erro ao carregar sorteios públicos:', err);
    } finally {
      setCarregando(false);
    }
  }, [slug]);

  useEffect(() => {
    carregarDadosPublicos();
  }, [carregarDadosPublicos]);

  // Consultar bilhetes por WhatsApp / Telefone
  const handleConsultar = async (e) => {
    e.preventDefault();
    const telLimpo = telefoneBusca.replace(/\D/g, '');
    if (!telLimpo || telLimpo.length < 8) {
      setErroConsulta('Digite seu número de WhatsApp completo com DDD.');
      return;
    }

    try {
      setConsultando(true);
      setErroConsulta('');
      setResultadoMeusBilhetes(null);

      const res = await fetch(`/api/publico/sorteios/${slug}/meus-bilhetes?telefone=${encodeURIComponent(telLimpo)}`);
      const data = await res.json();

      if (data.ok) {
        setResultadoMeusBilhetes(data);
      } else {
        setErroConsulta(data.error || 'Nenhum bilhete encontrado para este número.');
      }
    } catch (err) {
      setErroConsulta('Falha ao consultar bilhetes. Tente novamente.');
    } finally {
      setConsultando(false);
    }
  };

  const campanhaPrincipal = campanhasAtivas[0];

  return (
    <div className="sorteio-pub-page">
      <div className="sorteio-pub-container">
        {/* Header Oficial */}
        <div className="sorteio-pub-header">
          <div className="sorteio-pub-badge">
            <Sparkles size={14} /> Sorteios Oficiais Auditados
          </div>
          <h1 className="sorteio-pub-title">
            Mega Sorteios Dino Barbearia & Perfumaria
          </h1>
          <p className="sorteio-pub-subtitle">
            Concorra a prêmios incríveis a cada corte, barba ou compra de perfumes e cosméticos no balcão ou online!
          </p>
        </div>

        {carregando ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            Carregando sorteios e prêmios...
          </div>
        ) : (
          <>
            {/* Card Principal da Campanha */}
            {campanhaPrincipal && (
              <div className="sorteio-pub-hero-card">
                <div
                  className="sorteio-pub-hero-banner"
                  style={{
                    backgroundImage: campanhaPrincipal.bannerUrl
                      ? `url(${campanhaPrincipal.bannerUrl})`
                      : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  }}
                >
                  <div className="sorteio-pub-hero-content">
                    <span className="sorteio-pub-premio-tag">1º Lugar • Prêmio Principal</span>
                    <h2 className="sorteio-pub-premio-nome">{campanhaPrincipal.premioPrincipal}</h2>
                  </div>
                </div>

                <div className="sorteio-pub-body">
                  <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                    {campanhaPrincipal.descricao}
                  </p>

                  <h4 style={{ color: '#fbbf24', fontSize: '13px', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                    🎁 Outros Prêmios desta Edição:
                  </h4>

                  <div className="sorteio-pub-premios-lista">
                    {(campanhaPrincipal.premios || []).slice(1).map((p, idx) => (
                      <div key={idx} className="sorteio-pub-premio-subcard">
                        <span className="sorteio-pub-premio-subcard-icon">{p.icone || '🎁'}</span>
                        <div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>
                            {p.posicao}º Prêmio
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>
                            {p.nome}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '14px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>📅 Data do Sorteio: <strong style={{ color: '#fff' }}>{new Date(campanhaPrincipal.dataSorteio).toLocaleDateString('pt-BR')}</strong></span>
                    <span>🔒 Apuração: <strong style={{ color: '#10b981' }}>100% Criptográfica SHA-256</strong></span>
                  </div>
                </div>
              </div>
            )}

            {/* Caixa de Consulta do Cliente */}
            <div className="sorteio-pub-consulta-box">
              <h2 className="sorteio-pub-consulta-title">
                🎟️ Consulte seus Números da Sorte
              </h2>
              <p className="sorteio-pub-consulta-desc">
                Digite seu número de WhatsApp para ver todos os seus bilhetes gerados nos seus atendimentos e compras:
              </p>

              <form onSubmit={handleConsultar} className="sorteio-pub-form">
                <input
                  type="tel"
                  className="sorteio-pub-input"
                  placeholder="(65) 99999-9999"
                  value={telefoneBusca}
                  onChange={(e) => setTelefoneBusca(e.target.value)}
                />
                <button
                  type="submit"
                  className="sorteio-pub-btn-consultar"
                  disabled={consultando}
                >
                  {consultando ? 'Consultando...' : 'Ver Meus Bilhetes'}
                </button>
              </form>

              {erroConsulta && (
                <div style={{ marginTop: '16px', color: '#f87171', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <AlertCircle size={16} /> {erroConsulta}
                </div>
              )}

              {/* Resultado da Consulta */}
              {resultadoMeusBilhetes && (
                <div className="sorteio-pub-resultado">
                  <div className="sorteio-pub-resultado-header">
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>
                        Olá, {resultadoMeusBilhetes.clienteIdentificado}!
                      </h3>
                      <span style={{ fontSize: '12px', color: '#10b981' }}>
                        Você possui <strong>{resultadoMeusBilhetes.totalBilhetes} Número(s) da Sorte</strong> ativos!
                      </span>
                    </div>
                  </div>

                  {resultadoMeusBilhetes.totalBilhetes === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#0f172a', borderRadius: '8px' }}>
                      Nenhum bilhete emitido para este telefone ainda. Venha fazer a barba ou confira nossa perfumaria para ganhar seus números!
                    </div>
                  ) : (
                    resultadoMeusBilhetes.campanhas.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#fbbf24', marginBottom: '8px' }}>
                          {item.campanha.titulo}
                        </div>
                        <div className="sorteio-pub-bilhetes-grid">
                          {item.bilhetes.map((b, bIdx) => (
                            <div key={bIdx} className="sorteio-pub-bilhete-card">
                              <div className="sorteio-pub-bilhete-num">{b.numeroSorte}</div>
                              <div className="sorteio-pub-bilhete-origem">
                                {b.origem === 'barbearia_comanda' ? '💈 Barbearia' : b.origem === 'loja_perfumaria' ? '✨ Perfumaria' : '🎟️ Balcão'}
                              </div>
                              {b.premiado && (
                                <div style={{ background: '#10b981', color: '#fff', fontSize: '10px', fontWeight: '900', padding: '2px 4px', borderRadius: '4px', marginTop: '6px' }}>
                                  🏆 PREMIADO
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Regulamento Oficial e FAQ */}
            <div className="sorteio-pub-regulamento">
              <h3>
                <ShieldCheck size={20} className="text-amber-500" />
                Regulamento Oficial & Transparência
              </h3>
              <p>
                <strong>Como participar:</strong> A cada R$ 50,00 (cinquenta reais) gastos em serviços na Barbearia Dino (cabelo, barba, combos), você recebe automaticamente 1 (um) Número da Sorte.
              </p>
              <p>
                <strong>Pontuação em Dobro na Perfumaria:</strong> Compras de produtos da Perfumaria Dino e Cosméticos pontuam EM DOBRO (a cada R$ 50,00 = 2 Números da Sorte).
              </p>
              <p>
                <strong>Clube Dino:</strong> Assinantes ativos do Clube Dino ganham 3 bilhetes extras de bonificação de largada para concorrer a todas as edições.
              </p>
              <p>
                <strong>Apuração Justa e Auditável:</strong> Todos os sorteios são apurados via algoritmo criptográfico seguro (SHA-256 RFC 7518) garantindo probabilidade idêntica e verificação matemática pública imutável.
              </p>
            </div>

            {/* Hall de Ganhadores Anteriores */}
            {ganhadoresHistoricos.length > 0 && (
              <div className="sorteio-pub-regulamento" style={{ marginTop: '20px' }}>
                <h3>
                  <Trophy size={20} className="text-amber-500" />
                  Ganhadores dos Últimos Sorteios
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {ganhadoresHistoricos.map((g, idx) => (
                    <div key={idx} style={{ background: '#0f172a', padding: '12px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>{g.ganhadorNome}</div>
                        <div style={{ color: '#fbbf24', fontSize: '12px' }}>{g.premio}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '12px', color: '#94a3b8' }}>
                        <div>{g.numeroSorte}</div>
                        <div style={{ fontSize: '10px' }}>{new Date(g.sorteadoEm).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
