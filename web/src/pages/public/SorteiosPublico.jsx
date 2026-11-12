import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  AlertCircle,
  Share2,
  Clock,
  ArrowRight,
  Scissors
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

  // Máscara de telefone
  const formatarTelefoneInput = (valor) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 11);
    if (limpo.length <= 2) return limpo;
    if (limpo.length <= 7) return `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  };

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

  // Cálculo da contagem regressiva
  const tempoRestante = useMemo(() => {
    if (!campanhaPrincipal?.dataSorteio) return null;
    const diff = new Date(campanhaPrincipal.dataSorteio).getTime() - new Date().getTime();
    if (diff <= 0) return { dias: 0, horas: 0, minutos: 0, expirado: true };
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutos = Math.floor((diff / (1000 * 60)) % 60);
    return { dias, horas, minutos, expirado: false };
  }, [campanhaPrincipal?.dataSorteio]);

  // Gerar link de compartilhamento no WhatsApp com os números do cliente
  const linkCompartilharBilhetes = useMemo(() => {
    if (!resultadoMeusBilhetes || resultadoMeusBilhetes.totalBilhetes === 0) return '';
    const numeros = (resultadoMeusBilhetes.campanhas || [])
      .flatMap(c => (c.bilhetes || []).map(b => b.numeroSorte))
      .slice(0, 10)
      .join(', ');
    const texto = `🎟️ Meus Números da Sorte no Sorteio Dino Barbearia & Perfumaria:\n${numeros}\n\n🏆 Concorra a Moto 0km e Prêmios de Luxo! Confira seus bilhetes em: https://kytto.com.br/sorteios/${slug}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
  }, [resultadoMeusBilhetes, slug]);

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

          {/* Atalhos Rápidos para Serviços e Perfumaria */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
            <Link
              to="/agendar/dino"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              <Scissors size={15} color="#fbbf24" /> Agendar Horário na Barbearia
            </Link>
            <Link
              to="/perfumaria/dino"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%)',
                color: '#fbbf24',
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: '700',
                border: '1px solid rgba(245, 158, 11, 0.4)'
              }}
            >
              <ShoppingBag size={15} /> Perfumaria com 2x Bilhetes
            </Link>
          </div>
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

                  {/* Contagem regressiva para o sorteio */}
                  {tempoRestante && !tempoRestante.expirado && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: '700', fontSize: '13px' }}>
                        <Clock size={16} /> Próximo Sorteio Oficial:
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ background: '#0f172a', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontWeight: '800', fontSize: '13px' }}>
                          {tempoRestante.dias}d
                        </span>
                        <span style={{ background: '#0f172a', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontWeight: '800', fontSize: '13px' }}>
                          {tempoRestante.horas}h
                        </span>
                        <span style={{ background: '#0f172a', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontWeight: '800', fontSize: '13px' }}>
                          {tempoRestante.minutos}m
                        </span>
                      </div>
                    </div>
                  )}

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

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '14px', fontSize: '12px', color: '#94a3b8', flexWrap: 'wrap', gap: '8px' }}>
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
                  onChange={(e) => setTelefoneBusca(formatarTelefoneInput(e.target.value))}
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
                  <div className="sorteio-pub-resultado-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>
                        Olá, {resultadoMeusBilhetes.clienteIdentificado}!
                      </h3>
                      <span style={{ fontSize: '12px', color: '#10b981' }}>
                        Você possui <strong>{resultadoMeusBilhetes.totalBilhetes} Número(s) da Sorte</strong> ativos!
                      </span>
                    </div>

                    {linkCompartilharBilhetes && (
                      <a
                        href={linkCompartilharBilhetes}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#25D366',
                          color: '#fff',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}
                      >
                        <Share2 size={14} /> Guardar no WhatsApp
                      </a>
                    )}
                  </div>

                  {resultadoMeusBilhetes.totalBilhetes === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#0f172a', borderRadius: '8px', marginTop: '14px' }}>
                      Nenhum bilhete emitido para este telefone ainda. Venha fazer a barba ou confira nossa perfumaria para ganhar seus números!
                    </div>
                  ) : (
                    resultadoMeusBilhetes.campanhas.map((item, idx) => (
                      <div key={idx} style={{ marginTop: '16px' }}>
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
