import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trophy,
  Gift,
  Ticket,
  Users,
  Calendar,
  Sparkles,
  Play,
  RotateCw,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  Printer,
  ChevronRight,
  Store,
  Scissors,
  ShoppingBag,
  Award,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import './SorteiosCampanhas.css';

export default function SorteiosCampanhas() {
  const { empresaAtiva } = useAuth();
  const toast = useToast();

  const [abaAtiva, setAbaAtiva] = useState('campanhas'); // 'campanhas' | 'sorteador' | 'bilhetes' | 'manual' | 'ganhadores'
  const [carregando, setCarregando] = useState(true);
  const [campanhas, setCampanhas] = useState([]);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState(null);

  // Estados dos bilhetes
  const [bilhetes, setBilhetes] = useState([]);
  const [termoBuscaBilhete, setTermoBuscaBilhete] = useState('');
  const [totalBilhetes, setTotalBilhetes] = useState(0);

  // Estados do Sorteador ao Vivo
  const [sorteando, setSorteando] = useState(false);
  const [numeroAnimado, setNumeroAnimado] = useState('000000');
  const [ganhadorSorteado, setGanhadorSorteado] = useState(null);
  const [certificadoAuditoria, setCertificadoAuditoria] = useState(null);
  const animacaoRef = useRef(null);

  // Modais
  const [modalNovaCampanhaAberto, setModalNovaCampanhaAberto] = useState(false);
  const [salvandoCampanha, setSalvandoCampanha] = useState(false);

  // Formulário Nova Campanha
  const [novaCampanha, setNovaCampanha] = useState({
    titulo: 'Mega Sorteio de Fim de Ano Dino: Moto 0km & Kit Perfumes',
    descricao: 'Sorteio oficial para clientes da Barbearia Dino, Perfumaria e Loja Online.',
    regulamento: 'A cada R$ 50 gastos em serviços = 1 Número da Sorte. Compras de produtos de perfumaria pontuam em dobro (R$ 50 = 2 bilhetes). Membros do Clube ganham 3 bilhetes extras de largada.',
    premioPrincipal: 'Moto Honda Fan 160 0km (ou R$ 18.000 no Pix)',
    valorMinimoBilhete: 50,
    multiplicadorPerfumaria: 2,
    bonusClube: 3,
    dataFim: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
  });

  // Formulário Emissão Manual
  const [formManual, setFormManual] = useState({
    clienteNome: '',
    clienteTelefone: '',
    clienteCpf: '',
    quantidade: 1,
    motivo: 'Cortesia gerencial de balcão',
  });
  const [emitindoManual, setEmitindoManual] = useState(false);

  // Carrega as campanhas
  const carregarCampanhas = useCallback(async () => {
    try {
      setCarregando(true);
      const res = await api.get('/api/admin/sorteios');
      const lista = res?.campanhas || [];
      setCampanhas(lista);
      if (lista.length > 0 && !campanhaSelecionada) {
        setCampanhaSelecionada(lista[0]);
      }
    } catch (err) {
      toast.error('Erro ao carregar campanhas de sorteio: ' + err.message);
    } finally {
      setCarregando(false);
    }
  }, [campanhaSelecionada, toast]);

  // Carrega bilhetes da campanha selecionada
  const carregarBilhetes = useCallback(async (campanhaId, busca = '') => {
    if (!campanhaId) return;
    try {
      const res = await api.get(`/api/admin/sorteios/${campanhaId}/bilhetes?busca=${encodeURIComponent(busca)}&limit=100`);
      setBilhetes(res?.bilhetes || []);
      setTotalBilhetes(res?.total || 0);
    } catch (err) {
      console.error('Erro ao listar bilhetes:', err);
    }
  }, []);

  useEffect(() => {
    carregarCampanhas();
  }, [carregarCampanhas]);

  useEffect(() => {
    if (campanhaSelecionada?.id && (abaAtiva === 'bilhetes' || abaAtiva === 'sorteador')) {
      carregarBilhetes(campanhaSelecionada.id, termoBuscaBilhete);
    }
  }, [campanhaSelecionada, abaAtiva, termoBuscaBilhete, carregarBilhetes]);

  // Salvar nova campanha
  const handleSalvarCampanha = async (e) => {
    e.preventDefault();
    if (!novaCampanha.titulo || !novaCampanha.premioPrincipal) {
      toast.warning('Título e Prêmio Principal são obrigatórios.');
      return;
    }
    try {
      setSalvandoCampanha(true);
      const payload = {
        titulo: novaCampanha.titulo,
        descricao: novaCampanha.descricao,
        regulamento: novaCampanha.regulamento,
        premioPrincipal: novaCampanha.premioPrincipal,
        premios: [
          { posicao: 1, nome: novaCampanha.premioPrincipal, icone: '🏆' },
          { posicao: 2, nome: '1 Ano de Barba & Cabelo Grátis', icone: '💈' },
          { posicao: 3, nome: 'Kit Exclusivo Perfumaria Fina Dino', icone: '✨' },
        ],
        dataFim: new Date(`${novaCampanha.dataFim}T23:59:59-04:00`).toISOString(),
        dataSorteio: new Date(`${novaCampanha.dataFim}T20:00:00-04:00`).toISOString(),
        status: 'ativa',
        regras: {
          valorMinimoBilhete: Number(novaCampanha.valorMinimoBilhete || 50),
          multiplicadorPerfumaria: Number(novaCampanha.multiplicadorPerfumaria || 2),
          bonusClube: Number(novaCampanha.bonusClube || 3),
          permitirManual: true,
        },
      };

      const res = await api.post('/api/admin/sorteios', payload);
      toast.success('Campanha de sorteio criada com sucesso!');
      setModalNovaCampanhaAberto(false);
      await carregarCampanhas();
      if (res?.campanha) setCampanhaSelecionada(res.campanha);
    } catch (err) {
      toast.error('Falha ao criar campanha: ' + err.message);
    } finally {
      setSalvandoCampanha(false);
    }
  };

  // Emitir bilhete manual
  const handleEmitirManual = async (e) => {
    e.preventDefault();
    if (!formManual.clienteNome || !formManual.clienteTelefone) {
      toast.warning('Nome e Telefone do cliente são obrigatórios.');
      return;
    }
    if (!campanhaSelecionada?.id) {
      toast.warning('Selecione uma campanha de sorteio ativa.');
      return;
    }
    try {
      setEmitindoManual(true);
      const res = await api.post(`/api/admin/sorteios/${campanhaSelecionada.id}/emitir-manual`, {
        clienteNome: formManual.clienteNome,
        clienteTelefone: formManual.clienteTelefone,
        clienteCpf: formManual.clienteCpf,
        quantidade: Number(formManual.quantidade || 1),
        motivo: formManual.motivo,
      });

      toast.success(`🎉 ${res.bilhetesGerados} Número(s) da Sorte gerado(s) com sucesso!`);
      setFormManual({
        clienteNome: '',
        clienteTelefone: '',
        clienteCpf: '',
        quantidade: 1,
        motivo: 'Cortesia gerencial de balcão',
      });
      await carregarCampanhas();
      await carregarBilhetes(campanhaSelecionada.id);
      setAbaAtiva('bilhetes');
    } catch (err) {
      toast.error('Erro ao emitir bilhete manual: ' + err.message);
    } finally {
      setEmitindoManual(false);
    }
  };

  // Executar Sorteio ao Vivo (Roleta Auditada)
  const handleExecutarSorteio = async () => {
    if (!campanhaSelecionada?.id) return;
    if (bilhetes.length === 0) {
      toast.warning('Esta campanha ainda não possui bilhetes emitidos para sortear.');
      return;
    }

    setSorteando(true);
    setGanhadorSorteado(null);
    setCertificadoAuditoria(null);

    // Inicia efeito visual de roleta girando
    let contador = 0;
    animacaoRef.current = setInterval(() => {
      const numAleatorio = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
      setNumeroAnimado(numAleatorio);
      contador++;
    }, 60);

    try {
      // Chama o backend para computar a semente e o bilhete seguro
      const res = await api.post(`/api/admin/sorteios/${campanhaSelecionada.id}/sortear`, {
        premioIndex: 0,
      });

      // Aguarda 3 segundos de suspense visual
      setTimeout(() => {
        clearInterval(animacaoRef.current);
        const numeroVencedor = res.ganhador.numeroSorte.replace(/\D/g, '').slice(-6) || '000001';
        setNumeroAnimado(numeroVencedor);
        setGanhadorSorteado(res.ganhador);
        setCertificadoAuditoria(res.certificadoAuditoria);
        setSorteando(false);
        toast.success(`🎉 GANHADOR SORTEADO: ${res.ganhador.clienteNome}!`);
        carregarCampanhas();
      }, 3000);
    } catch (err) {
      clearInterval(animacaoRef.current);
      setSorteando(false);
      toast.error('Erro na execução do sorteio: ' + err.message);
    }
  };

  // Notificar Ganhador via WhatsApp
  const handleNotificarGanhador = async () => {
    if (!campanhaSelecionada?.id) return;
    try {
      const res = await api.post(`/api/admin/sorteios/${campanhaSelecionada.id}/notificar-ganhador`);
      if (res?.linkWhatsappWeb) {
        window.open(res.linkWhatsappWeb, '_blank');
        toast.success('Notificação aberta no WhatsApp Web!');
      }
    } catch (err) {
      toast.error('Falha ao gerar notificação: ' + err.message);
    }
  };

  // Métricas Consolidadas
  const totalCampanhasAtivas = campanhas.filter(c => c.status === 'ativa').length;
  const totalBilhetesEmitidosGeral = campanhas.reduce((sum, c) => sum + (c.totalBilhetes || 0), 0);
  const totalGanhadoresGeral = campanhas.reduce((sum, c) => sum + (c.ganhadores?.length || (c.ganhadorNome ? 1 : 0)), 0);

  return (
    <div className="sorteios-container">
      {/* Header Executivo */}
      <div className="sorteios-header">
        <div className="sorteios-title">
          <h1>
            <Gift className="text-amber-500" size={30} />
            Sorteios & Campanhas Premiadas
          </h1>
          <p className="sorteios-subtitle">
            Crie sorteios oficiais para os clientes da <strong>Barbearia Dino</strong>, <strong>Loja & Perfumaria</strong> e <strong>E-commerce</strong> com emissão automática de Números da Sorte e apuração 100% auditável.
          </p>
        </div>
        <div className="sorteios-actions">
          <a
            href="/sorteios/dino"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline-ouro"
          >
            <ExternalLink size={16} /> Portal do Cliente
          </a>
          <button
            type="button"
            className="btn-ouro"
            onClick={() => setModalNovaCampanhaAberto(true)}
          >
            <Plus size={18} /> Nova Campanha
          </button>
        </div>
      </div>

      {/* Grid de KPIs */}
      <div className="sorteios-kpis">
        <div className="sorteio-kpi-card">
          <div className="sorteio-kpi-icon">
            <Trophy size={26} />
          </div>
          <div className="sorteio-kpi-info">
            <span className="sorteio-kpi-label">Campanhas Ativas</span>
            <span className="sorteio-kpi-val">{totalCampanhasAtivas}</span>
            <span className="sorteio-kpi-desc">Disponíveis no caixa e loja</span>
          </div>
        </div>

        <div className="sorteio-kpi-card">
          <div className="sorteio-kpi-icon">
            <Ticket size={26} />
          </div>
          <div className="sorteio-kpi-info">
            <span className="sorteio-kpi-label">Números da Sorte</span>
            <span className="sorteio-kpi-val">{totalBilhetesEmitidosGeral.toLocaleString('pt-BR')}</span>
            <span className="sorteio-kpi-desc">Bilhetes distribuídos</span>
          </div>
        </div>

        <div className="sorteio-kpi-card">
          <div className="sorteio-kpi-icon">
            <ShoppingBag size={26} />
          </div>
          <div className="sorteio-kpi-info">
            <span className="sorteio-kpi-label">Perfumaria & Compras</span>
            <span className="sorteio-kpi-val">2x Pontos</span>
            <span className="sorteio-kpi-desc">Multiplicador automático</span>
          </div>
        </div>

        <div className="sorteio-kpi-card">
          <div className="sorteio-kpi-icon">
            <ShieldCheck size={26} />
          </div>
          <div className="sorteio-kpi-info">
            <span className="sorteio-kpi-label">Auditoria Kytto</span>
            <span className="sorteio-kpi-val">100% Cripto</span>
            <span className="sorteio-kpi-desc">SHA-256 RFC 7518</span>
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="sorteios-tabs">
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'campanhas' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('campanhas')}
        >
          <Gift size={16} /> Campanhas & Prêmios ({campanhas.length})
        </button>
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'sorteador' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('sorteador')}
        >
          <Sparkles size={16} /> Sorteador ao Vivo (Roleta & Apuração)
        </button>
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'bilhetes' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('bilhetes')}
        >
          <Ticket size={16} /> Bilhetes & Participantes ({totalBilhetes})
        </button>
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'manual' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('manual')}
        >
          <Plus size={16} /> Emitir Bilhete Manual (Balcão)
        </button>
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'ganhadores' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('ganhadores')}
        >
          <Trophy size={16} /> Ganhadores Históricos ({totalGanhadoresGeral})
        </button>
      </div>

      {/* Conteúdo das Abas */}
      {carregando ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <RotateCw className="animate-spin text-amber-500" size={36} style={{ margin: '0 auto 16px' }} />
          Carregando sorteios e campanhas do Dino...
        </div>
      ) : (
        <>
          {/* ABA 1: CAMPANHAS */}
          {abaAtiva === 'campanhas' && (
            <div>
              {campanhas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', background: '#1e293b', borderRadius: '12px' }}>
                  <Gift size={48} className="text-amber-500" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>Nenhuma campanha de sorteio criada ainda</h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '500px', margin: '0 auto 20px' }}>
                    Crie sua primeira campanha para começar a emitir Números da Sorte automaticamente nas vendas da Barbearia e Perfumaria!
                  </p>
                  <button type="button" className="btn-ouro" onClick={() => setModalNovaCampanhaAberto(true)}>
                    <Plus size={18} /> Criar Campanha Inaugural
                  </button>
                </div>
              ) : (
                <div className="campanhas-grid">
                  {campanhas.map((camp) => (
                    <div key={camp.id} className="campanha-card">
                      <div
                        className="campanha-card-banner"
                        style={{
                          backgroundImage: camp.bannerUrl
                            ? `linear-gradient(to bottom, rgba(15,23,42,0.4), rgba(15,23,42,0.85)), url(${camp.bannerUrl})`
                            : undefined,
                        }}
                      >
                        <span className={`campanha-badge-status ${camp.status}`}>{camp.status}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ fontSize: '11px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', color: '#fbbf24' }}>
                            📅 Sorteio: {new Date(camp.dataSorteio).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="campanha-card-body">
                        <h3 className="campanha-card-title">{camp.titulo}</h3>

                        <div className="campanha-premio-destaque">
                          <span className="campanha-premio-icone">🏆</span>
                          <div className="campanha-premio-texto">
                            <span className="campanha-premio-label">Prêmio Principal</span>
                            <span className="campanha-premio-nome">{camp.premioPrincipal}</span>
                          </div>
                        </div>

                        <div className="campanha-regras-resumo">
                          💡 <strong>Regras:</strong> A cada R$ {camp.regras?.valorMinimoBilhete || 50} em serviços = 1 bilhete.
                          {camp.regras?.multiplicadorPerfumaria && (
                            <span> Perfumaria e Loja = <strong>{camp.regras.multiplicadorPerfumaria}x bilhetes</strong>.</span>
                          )}
                          {camp.regras?.bonusClube && (
                            <span> Assinantes do Clube = <strong>+{camp.regras.bonusClube} bilhetes</strong>.</span>
                          )}
                        </div>

                        <div className="campanha-metricas-row">
                          <div className="campanha-metrica-item">
                            <span style={{ color: '#94a3b8' }}>Bilhetes Emitidos</span>
                            <span className="campanha-metrica-num">{camp.totalBilhetes || 0}</span>
                          </div>
                          <div className="campanha-metrica-item">
                            <span style={{ color: '#94a3b8' }}>Participantes</span>
                            <span className="campanha-metrica-num">{camp.totalParticipantes || 0}</span>
                          </div>
                          <div className="campanha-metrica-item">
                            <span style={{ color: '#94a3b8' }}>Negócios</span>
                            <span className="campanha-metrica-num" style={{ fontSize: '13px', color: '#fbbf24' }}>
                              Barbearia + Perfumaria
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="campanha-card-footer">
                        <button
                          type="button"
                          className="btn-outline-ouro"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                          onClick={() => {
                            setCampanhaSelecionada(camp);
                            setAbaAtiva('bilhetes');
                          }}
                        >
                          <Ticket size={14} /> Ver Bilhetes
                        </button>
                        <button
                          type="button"
                          className="btn-ouro"
                          style={{ fontSize: '12px', padding: '6px 14px' }}
                          onClick={() => {
                            setCampanhaSelecionada(camp);
                            setAbaAtiva('sorteador');
                          }}
                        >
                          <Sparkles size={14} /> Ir para Roleta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: SORTEADOR AO VIVO */}
          {abaAtiva === 'sorteador' && (
            <div>
              <div className="sorteador-palco">
                <h2 className="sorteador-titulo">
                  {campanhaSelecionada?.titulo || 'Sorteio Oficial Dino'}
                </h2>
                <p className="sorteador-subtitulo">
                  Prêmio: <strong>{campanhaSelecionada?.premioPrincipal}</strong> • Apuração Criptograficamente Segura
                </p>

                {/* Display do Tambor de Números */}
                <div className="tambor-box">
                  <div className="tambor-display">
                    SÉRIE 01 - Nº {numeroAnimado}
                  </div>
                </div>

                <div className="sorteador-controles">
                  <button
                    type="button"
                    className="btn-sortear-gigante"
                    onClick={handleExecutarSorteio}
                    disabled={sorteando}
                  >
                    {sorteando ? (
                      <>
                        <RotateCw className="animate-spin" size={24} />
                        GIRANDO ROLETA E APURANDO...
                      </>
                    ) : (
                      <>
                        <Sparkles size={24} />
                        REALIZAR SORTEIO AO VIVO
                      </>
                    )}
                  </button>
                </div>

                <div style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
                  Total de bilhetes elegíveis concorrendo agora: <strong>{totalBilhetes} bilhetes</strong>
                </div>
              </div>

              {/* Card do Ganhador com Confirmação e Notificação */}
              {ganhadorSorteado && (
                <div className="ganhador-card-revelado">
                  <div className="ganhador-header">
                    <div>
                      <span className="ganhador-badge">🏆 GRANDE GANHADOR OFICIAL</span>
                      <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', margin: '8px 0 0' }}>
                        {ganhadorSorteado.clienteNome}
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="btn-ouro"
                      onClick={handleNotificarGanhador}
                    >
                      <Send size={16} /> Notificar no WhatsApp
                    </button>
                  </div>

                  <div className="ganhador-detalhes-grid">
                    <div className="ganhador-item">
                      <span className="ganhador-item-label">Bilhete Sorteado</span>
                      <span className="ganhador-item-val destaque">{ganhadorSorteado.numeroSorte}</span>
                    </div>
                    <div className="ganhador-item">
                      <span className="ganhador-item-label">Prêmio Conquistado</span>
                      <span className="ganhador-item-val">{ganhadorSorteado.premio}</span>
                    </div>
                    <div className="ganhador-item">
                      <span className="ganhador-item-label">Telefone / WhatsApp</span>
                      <span className="ganhador-item-val">{ganhadorSorteado.clienteTelefone}</span>
                    </div>
                    <div className="ganhador-item">
                      <span className="ganhador-item-label">Origem da Compra</span>
                      <span className="ganhador-item-val" style={{ textTransform: 'capitalize' }}>
                        {ganhadorSorteado.origemCompra?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="auditoria-box">
                    <strong>🔒 Comprovante Imutável de Auditoria (RFC 7518):</strong>
                    <br />
                    Hash SHA-256: {ganhadorSorteado.hashAuditoria}
                    <br />
                    Data/Hora Oficial: {new Date(ganhadorSorteado.sorteadoEm).toLocaleString('pt-BR')} | Responsável: {ganhadorSorteado.sorteadoPor}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 3: BILHETES & PARTICIPANTES */}
          {abaAtiva === 'bilhetes' && (
            <div className="sorteios-tabela-box">
              <div className="sorteios-tabela-busca">
                <input
                  type="text"
                  className="input-busca-bilhetes"
                  placeholder="Buscar por cliente, telefone ou número da sorte..."
                  value={termoBuscaBilhete}
                  onChange={(e) => setTermoBuscaBilhete(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-ouro"
                  style={{ fontSize: '13px', padding: '8px 14px' }}
                  onClick={() => setAbaAtiva('manual')}
                >
                  <Plus size={16} /> Emitir Balcão
                </button>
              </div>

              {bilhetes.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  Nenhum bilhete encontrado para esta campanha ou filtro de busca.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="sorteios-tabela">
                    <thead>
                      <tr>
                        <th>Número da Sorte</th>
                        <th>Cliente</th>
                        <th>WhatsApp / Telefone</th>
                        <th>Origem</th>
                        <th>Valor da Venda</th>
                        <th>Data Emissão</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bilhetes.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <span className="numero-sorte-tag">{b.numeroSorte}</span>
                          </td>
                          <td style={{ fontWeight: '600', color: '#fff' }}>{b.clienteNome}</td>
                          <td>{b.clienteTelefone || '—'}</td>
                          <td>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', background: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                              {b.origem === 'barbearia_comanda' ? '💈 Barbearia' : b.origem === 'loja_perfumaria' ? '✨ Perfumaria' : b.origem === 'manual_balcao' ? '🎟️ Balcão' : b.origem}
                            </span>
                          </td>
                          <td>{b.valorCompra ? `R$ ${Number(b.valorCompra).toFixed(2)}` : 'Cortesia'}</td>
                          <td>{new Date(b.geradoEm).toLocaleString('pt-BR')}</td>
                          <td>
                            {b.premiado ? (
                              <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                🏆 PREMIADO
                              </span>
                            ) : (
                              <span style={{ color: '#10b981', fontSize: '12px' }}>● Ativo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ABA 4: EMISSÃO MANUAL */}
          {abaAtiva === 'manual' && (
            <div style={{ maxWidth: '650px', margin: '0 auto', background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '28px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: '0 0 8px' }}>
                🎟️ Emissão Manual de Bilhetes de Cortesia
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 24px' }}>
                Utilize este formulário para conceder Números da Sorte para clientes especiais, ações de balcão, parcerias ou cortesias da gerência do Dino.
              </p>

              <form onSubmit={handleEmitirManual}>
                <div className="form-group">
                  <label className="form-label">Campanha Ativa</label>
                  <select
                    className="form-select"
                    value={campanhaSelecionada?.id || ''}
                    onChange={(e) => {
                      const c = campanhas.find(item => item.id === e.target.value);
                      if (c) setCampanhaSelecionada(c);
                    }}
                  >
                    {campanhas.map(c => (
                      <option key={c.id} value={c.id}>{c.titulo}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Nome Completo do Cliente *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Ex: Carlos Eduardo Silveira"
                    value={formManual.clienteNome}
                    onChange={(e) => setFormManual({ ...formManual, clienteNome: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">WhatsApp / Celular com DDD *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Ex: 65999056008"
                      value={formManual.clienteTelefone}
                      onChange={(e) => setFormManual({ ...formManual, clienteTelefone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantidade de Bilhetes *</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      className="form-input"
                      value={formManual.quantidade}
                      onChange={(e) => setFormManual({ ...formManual, quantidade: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Motivo da Concessão</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Ação Promocional de Inauguração da Loja Dino"
                    value={formManual.motivo}
                    onChange={(e) => setFormManual({ ...formManual, motivo: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-ouro"
                  style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: '12px' }}
                  disabled={emitindoManual}
                >
                  {emitindoManual ? 'Gerando Números...' : '🎟️ Gerar e Entregar Números da Sorte'}
                </button>
              </form>
            </div>
          )}

          {/* ABA 5: GANHADORES HISTÓRICOS */}
          {abaAtiva === 'ganhadores' && (
            <div className="sorteios-tabela-box">
              <div style={{ padding: '20px', borderBottom: '1px solid #334155' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>🏆 Hall de Ganhadores dos Sorteios Dino</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  Histórico oficial e auditado de todos os clientes contemplados nas campanhas da Barbearia, Perfumaria e E-commerce.
                </p>
              </div>

              {campanhas.flatMap(c => c.ganhadores || []).length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  Ainda não há sorteios encerrados com ganhadores registrados.
                </div>
              ) : (
                <table className="sorteios-tabela">
                  <thead>
                    <tr>
                      <th>Campanha</th>
                      <th>Ganhador</th>
                      <th>Bilhete Premiado</th>
                      <th>Prêmio</th>
                      <th>Data do Sorteio</th>
                      <th>Auditoria</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campanhas.flatMap(c => (c.ganhadores || []).map(g => ({ ...g, campanhaTitulo: c.titulo, campId: c.id }))).map((g, idx) => (
                      <tr key={idx}>
                        <td style={{ color: '#fbbf24', fontWeight: '600' }}>{g.campanhaTitulo}</td>
                        <td style={{ color: '#fff', fontWeight: '700' }}>{g.clienteNome}</td>
                        <td>
                          <span className="numero-sorte-tag">{g.numeroSorte}</span>
                        </td>
                        <td>{g.premio}</td>
                        <td>{new Date(g.sorteadoEm).toLocaleDateString('pt-BR')}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                          {g.hashAuditoria?.slice(0, 16)}...
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-outline-ouro"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            onClick={() => {
                              const textoWhats = `Fala, ${g.clienteNome}! Sua premiação do sorteio Dino (${g.premio}) está pronta para retirada! 🦖🎉`;
                              window.open(`https://api.whatsapp.com/send?phone=${String(g.clienteTelefone).replace(/\D/g, '')}&text=${encodeURIComponent(textoWhats)}`, '_blank');
                            }}
                          >
                            <Send size={12} /> WhatsApp
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Criar Nova Campanha */}
      {modalNovaCampanhaAberto && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>🎁 Nova Campanha de Sorteio</h2>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                onClick={() => setModalNovaCampanhaAberto(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarCampanha}>
              <div className="form-group">
                <label className="form-label">Título da Campanha *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={novaCampanha.titulo}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, titulo: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prêmio Principal *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Ex: Moto Honda Fan 160 0km ou R$ 18.000 no Pix"
                  value={novaCampanha.premioPrincipal}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, premioPrincipal: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descrição Chamativa</label>
                <textarea
                  rows="2"
                  className="form-textarea"
                  value={novaCampanha.descricao}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, descricao: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Valor Mínimo p/ 1 Bilhete (R$)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={novaCampanha.valorMinimoBilhete}
                    onChange={(e) => setNovaCampanha({ ...novaCampanha, valorMinimoBilhete: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Multiplicador Perfumaria / Loja</label>
                  <select
                    className="form-select"
                    value={novaCampanha.multiplicadorPerfumaria}
                    onChange={(e) => setNovaCampanha({ ...novaCampanha, multiplicadorPerfumaria: Number(e.target.value) })}
                  >
                    <option value={1}>1x (Pontuação Normal)</option>
                    <option value={2}>2x (Pontuação em Dobro!)</option>
                    <option value={3}>3x (Triplo de Bilhetes!)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Bônus Assinantes Clube Dino</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={novaCampanha.bonusClube}
                    onChange={(e) => setNovaCampanha({ ...novaCampanha, bonusClube: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data Prevista do Sorteio</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={novaCampanha.dataFim}
                    onChange={(e) => setNovaCampanha({ ...novaCampanha, dataFim: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-outline-ouro"
                  onClick={() => setModalNovaCampanhaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-ouro"
                  disabled={salvandoCampanha}
                >
                  {salvandoCampanha ? 'Salvando...' : 'Criar e Ativar Sorteio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
