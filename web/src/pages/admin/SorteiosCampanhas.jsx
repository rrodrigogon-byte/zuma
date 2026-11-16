import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trophy,
  Edit3,
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
  AlertCircle,
  Download,
  Share2
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import './SorteiosCampanhas.css';

export default function SorteiosCampanhas({ embed = false }) {
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
  // Estados de Edição da Campanha e do Prêmio
  const [modalEditarCampanhaAberto, setModalEditarCampanhaAberto] = useState(false);
  const [campanhaEditando, setCampanhaEditando] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

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
  const [gerandoPeriodo, setGerandoPeriodo] = useState(false);
  const [ultimoBilheteEmitidoManual, setUltimoBilheteEmitidoManual] = useState(null);

  // Áudio Sintético Web Audio API (Roleta e Vitória)
  const tocarSomClickRoleta = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 + Math.random() * 200, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (_) {}
  };

  const tocarFanfarraVitoria = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notas = [523.25, 659.25, 783.99, 1046.50]; // Acorde Maior C - E - G - C
      notas.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.7);
      });
    } catch (_) {}
  };

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

  // Exportar Bilhetes para CSV
  const handleExportarCSV = () => {
    if (bilhetes.length === 0) {
      toast.warning('Nenhum bilhete disponível para exportar.');
      return;
    }
    const cabecalho = ['Numero da Sorte', 'Cliente', 'Telefone', 'Origem', 'Valor Venda (R$)', 'Data Emissao', 'Status', 'Premiado', 'Hash SHA-256'];
    const linhas = bilhetes.map(b => [
      `"${b.numeroSorte}"`,
      `"${b.clienteNome || ''}"`,
      `"${b.clienteTelefone || ''}"`,
      `"${b.origem || ''}"`,
      Number(b.valorCompra || 0).toFixed(2),
      `"${new Date(b.geradoEm).toLocaleString('pt-BR')}"`,
      `"${b.status || 'ativo'}"`,
      b.premiado ? 'SIM' : 'NAO',
      `"${b.hashAutenticidade || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [cabecalho.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sorteio_bilhetes_${campanhaSelecionada?.id || 'dino'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Arquivo CSV de bilhetes exportado com sucesso!');
  };

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

  // Abrir modal de edição de campanha e prêmio
  const handleAbrirEditarCampanha = (camp) => {
    setCampanhaEditando({
      id: camp.id,
      titulo: camp.titulo || '',
      premioPrincipal: camp.premioPrincipal || camp.premio_principal || (Array.isArray(camp.premios) && camp.premios[0]?.nome) || 'Moto Honda Fan 160 0km (ou R$ 18.000 no Pix direto)',
      descricao: camp.descricao || '',
      regulamento: camp.regulamento || '',
      bannerUrl: camp.bannerUrl || '',
      valorMinimoBilhete: camp.regras?.valorMinimoBilhete ?? 50,
      multiplicadorPerfumaria: camp.regras?.multiplicadorPerfumaria ?? 2,
      bonusClube: camp.regras?.bonusClube ?? 3,
      dataSorteio: camp.dataSorteio ? camp.dataSorteio.split('T')[0] : (camp.dataFim ? camp.dataFim.split('T')[0] : ''),
      status: camp.status || 'ativa',
    });
    setModalEditarCampanhaAberto(true);
  };

  // Salvar alterações de prêmio e campanha via PUT /api/admin/sorteios/:id
  const handleSalvarEdicaoCampanha = async (e) => {
    e.preventDefault();
    if (!campanhaEditando?.id) return;
    if (!campanhaEditando.premioPrincipal?.trim()) {
      toast.warning('Informe o Prêmio Principal.');
      return;
    }
    setSalvandoEdicao(true);
    try {
      const payload = {
        titulo: campanhaEditando.titulo,
        premioPrincipal: campanhaEditando.premioPrincipal,
        descricao: campanhaEditando.descricao,
        regulamento: campanhaEditando.regulamento,
        bannerUrl: campanhaEditando.bannerUrl,
        status: campanhaEditando.status,
        dataSorteio: campanhaEditando.dataSorteio ? new Date(`${campanhaEditando.dataSorteio}T20:00:00-04:00`).toISOString() : undefined,
        dataFim: campanhaEditando.dataSorteio ? new Date(`${campanhaEditando.dataSorteio}T23:59:59-04:00`).toISOString() : undefined,
        regras: {
          valorMinimoBilhete: Number(campanhaEditando.valorMinimoBilhete || 50),
          multiplicadorPerfumaria: Number(campanhaEditando.multiplicadorPerfumaria || 2),
          bonusClube: Number(campanhaEditando.bonusClube || 3),
        }
      };
      await api.put(`/api/admin/sorteios/${campanhaEditando.id}`, payload);
      toast.success('Prêmio e dados do sorteio atualizados com sucesso!');
      setModalEditarCampanhaAberto(false);
      await carregarCampanhas();
      if (campanhaSelecionada?.id === campanhaEditando.id) {
        setCampanhaSelecionada(prev => ({ ...prev, ...payload }));
      }
    } catch (err) {
      toast.error('Erro ao atualizar sorteio: ' + err.message);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Gerar bilhetes em lote por período de atendimento (3 meses ou este mês)
  const handleGerarPorPeriodo = async (periodo) => {
    const campId = campanhaSelecionada?.id || campanhas[0]?.id;
    if (!campId) {
      toast.warning('Selecione uma campanha de sorteio ativa.');
      return;
    }
    setGerandoPeriodo(true);
    try {
      const res = await api.post(`/api/admin/sorteios/${campId}/gerar-por-periodo`, {
        periodo,
        regra: '1_por_cliente',
      });
      if (res.ok) {
        toast.success(res.mensagem || `Foram gerados ${res.bilhetesGerados} novos bilhetes com sucesso!`);
        await carregarCampanhas();
        await carregarBilhetes(campId);
      } else {
        toast.error(res.error || 'Erro ao gerar bilhetes.');
      }
    } catch (err) {
      toast.error('Erro na geração em lote: ' + err.message);
    } finally {
      setGerandoPeriodo(false);
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
      setUltimoBilheteEmitidoManual({
        nome: formManual.clienteNome,
        telefone: formManual.clienteTelefone,
        quantidade: res.bilhetesGerados,
        mensagemWhats: res.mensagemWhatsapp,
        linkWhats: `https://api.whatsapp.com/send?phone=${formManual.clienteTelefone.replace(/\D/g, '')}&text=${encodeURIComponent(res.mensagemWhatsapp || '')}`
      });

      setFormManual({
        clienteNome: '',
        clienteTelefone: '',
        clienteCpf: '',
        quantidade: 1,
        motivo: 'Cortesia gerencial de balcão',
      });
      await carregarCampanhas();
      await carregarBilhetes(campanhaSelecionada.id);
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

    // Inicia efeito visual e sonoro de roleta girando
    let contador = 0;
    animacaoRef.current = setInterval(() => {
      const numAleatorio = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
      setNumeroAnimado(numAleatorio);
      tocarSomClickRoleta();
      contador++;
    }, 70);

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
        tocarFanfarraVitoria();
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
      toast.error('Erro ao gerar mensagem de notificação: ' + err.message);
    }
  };

  const totalCampanhasAtivas = campanhas.filter((c) => c.status === 'ativa').length;
  const totalBilhetesGeral = campanhas.reduce((s, c) => s + (c.totalBilhetes || 0), 0);

  return (
    <div className={`sorteios-container ${embed ? 'sorteios-embed' : ''}`}>
      {/* Topo do Módulo */}
      <div className="sorteios-header-area">
        <div className="sorteios-header-info">
          <div className="sorteios-tag-oficial">
            <Gift size={14} /> MÓDULO OFICIAL KYTTO
          </div>
          <h1 className="sorteios-titulo">Sorteios & Campanhas Premiadas</h1>
          <p className="sorteios-descricao">
            Crie sorteios oficiais para os clientes da <strong>Barbearia Dino</strong>, <strong>Loja & Perfumaria</strong> e <strong>E-commerce</strong> com emissão automática de Números da Sorte e apuração 100% auditável.
          </p>
        </div>

        <div className="sorteios-header-acoes">
          <a
            href="/sorteios/dino"
            target="_blank"
            rel="noreferrer"
            className="btn-outline-ouro"
          >
            <ExternalLink size={16} /> Portal do Cliente
          </a>
          <button
            type="button"
            className="btn-ouro"
            onClick={() => setModalNovaCampanhaAberto(true)}
          >
            <Plus size={16} /> Nova Campanha
          </button>
        </div>
      </div>

      {/* Cartões de Indicadores Rápidos */}
      <div className="sorteios-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box ouro">
            <Trophy size={20} />
          </div>
          <div>
            <div className="kpi-label">Campanhas Ativas</div>
            <div className="kpi-valor">{totalCampanhasAtivas}</div>
            <div className="kpi-sub">Disponíveis no caixa e loja</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box verde">
            <Ticket size={20} />
          </div>
          <div>
            <div className="kpi-label">Números da Sorte</div>
            <div className="kpi-valor">{totalBilhetesGeral}</div>
            <div className="kpi-sub">Bilhetes distribuídos</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box roxo">
            <ShoppingBag size={20} />
          </div>
          <div>
            <div className="kpi-label">Perfumaria & Compras</div>
            <div className="kpi-valor">2x Pontos</div>
            <div className="kpi-sub">Multiplicador automático</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box azul">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="kpi-label">Auditoria Kytto</div>
            <div className="kpi-valor">100% Cripto</div>
            <div className="kpi-sub">SHA-256 RFC 7518</div>
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="sorteios-tabs-nav">
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'campanhas' ? 'ativo' : ''}`}
          onClick={() => setAbaAtiva('campanhas')}
        >
          <Gift size={16} /> Campanhas & Prêmios ({campanhas.length})
        </button>
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'sorteador' ? 'ativo' : ''}`}
          onClick={() => setAbaAtiva('sorteador')}
        >
          <Sparkles size={16} /> Sorteador ao Vivo (Roleta & Apuração)
        </button>
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'bilhetes' ? 'ativo' : ''}`}
          onClick={() => setAbaAtiva('bilhetes')}
        >
          <Ticket size={16} /> Bilhetes & Participantes ({totalBilhetes})
        </button>
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'manual' ? 'ativo' : ''}`}
          onClick={() => setAbaAtiva('manual')}
        >
          <Plus size={16} /> Emitir Bilhete Manual (Balcão)
        </button>
        <button
          type="button"
          className={`sorteios-tab-btn ${abaAtiva === 'ganhadores' ? 'ativo' : ''}`}
          onClick={() => setAbaAtiva('ganhadores')}
        >
          <Trophy size={16} /> Ganhadores Históricos ({campanhas.filter(c => c.ganhadores?.length > 0 || c.ganhadorNome).length})
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <div className="sorteios-conteudo-aba">
        {carregando ? (
          <div className="sorteios-loading">
            <RotateCw className="animate-spin" size={28} />
            <span>Carregando dados de sorteios...</span>
          </div>
        ) : (
          <>
            {/* ABA 1: LISTAGEM DE CAMPANHAS */}
            {abaAtiva === 'campanhas' && (
              <div>
                {/* PAINEL DE IMPORTAÇÃO RÁPIDA POR PERÍODO (RESPOSTA AO CLIENTE) */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  marginBottom: '24px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '20px' }}>🎲</span>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fbbf24' }}>
                          Gerar Números da Sorte por Período de Atendimento (100% Automático)
                        </h4>
                        <span style={{ background: '#10b981', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                          Não precisa emitir em papel
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '780px', lineHeight: 1.5 }}>
                        O sistema seleciona os ganhadores <strong>automaticamente por sorteio digital auditado</strong>. Escolha o público que participará do sorteio (quem veio nos últimos 3 meses ou apenas este mês) e gere os bilhetes de todos com 1 clique:
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleGerarPorPeriodo('3_meses')}
                        disabled={gerandoPeriodo}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 18px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: gerandoPeriodo ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        <Sparkles size={16} />
                        {gerandoPeriodo ? 'Gerando...' : '⚡ Quem veio nos últimos 3 meses (415 clientes)'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGerarPorPeriodo('este_mes')}
                        disabled={gerandoPeriodo}
                        style={{
                          background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 18px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: gerandoPeriodo ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                        }}
                      >
                        <Calendar size={16} />
                        {gerandoPeriodo ? 'Gerando...' : '📅 Quem veio apenas este mês (295 clientes)'}
                      </button>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '12px',
                    color: '#cbd5e1',
                    flexWrap: 'wrap',
                  }}>
                    <span>💡 <strong>Como funciona:</strong> O Kytto ERP gera números da sorte com hash seguro para cada cliente.</span>
                    <span>📲 Os clientes podem consultar seus números em: <a href="https://kytto.com.br/sorteios/dino" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>kytto.com.br/sorteios/dino</a></span>
                  </div>
                </div>
                {campanhas.length === 0 ? (
                  <div className="sorteios-vazio">
                    <Gift size={48} className="text-amber-500" />
                    <h3>Nenhuma campanha criada ainda</h3>
                    <p>Crie o primeiro sorteio oficial para os clientes da Barbearia Dino e Perfumaria.</p>
                    <button
                      type="button"
                      className="btn-ouro"
                      onClick={() => setModalNovaCampanhaAberto(true)}
                    >
                      <Plus size={16} /> Criar Campanha Agora
                    </button>
                  </div>
                ) : (
                  <div className="campanhas-grid">
                    {campanhas.map((camp) => (
                      <div
                        key={camp.id}
                        className={`campanha-card ${campanhaSelecionada?.id === camp.id ? 'selecionada' : ''}`}
                      >
                        <div
                          className="campanha-card-banner"
                          style={{
                            backgroundImage: camp.bannerUrl
                              ? `url(${camp.bannerUrl})`
                              : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                          }}
                        >
                          <span className={`status-chip ${camp.status}`}>
                            {camp.status}
                          </span>
                          <span className="data-sorteio-chip">
                            📅 Sorteio: {new Date(camp.dataSorteio).toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        <div className="campanha-card-body">
                          <h3 className="campanha-card-title">{camp.titulo}</h3>

                          <div className="campanha-premio-destaque" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span className="campanha-premio-icone">🏆</span>
                              <div className="campanha-premio-texto">
                                <span className="campanha-premio-label">Prêmio Principal</span>
                                <span className="campanha-premio-nome">{camp.premioPrincipal}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAbrirEditarCampanha(camp)}
                              title="Clique para editar o prêmio deste sorteio"
                              style={{
                                background: 'rgba(245, 158, 11, 0.2)',
                                border: '1px solid #f59e0b',
                                color: '#fbbf24',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s',
                              }}
                            >
                              <Edit3 size={12} /> Editar Prêmio
                            </button>
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
                            style={{ fontSize: '12px', padding: '6px 12px', borderColor: '#f59e0b', color: '#fbbf24' }}
                            onClick={() => handleAbrirEditarCampanha(camp)}
                            title="Editar Prêmio, Título, Data e Regras"
                          >
                            <Edit3 size={14} /> ✍️ Editar Prêmio
                          </button>
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-outline-ouro"
                      style={{ fontSize: '13px', padding: '8px 14px' }}
                      onClick={handleExportarCSV}
                      title="Exportar todos os bilhetes em formato CSV para auditoria"
                    >
                      <Download size={16} /> Exportar CSV
                    </button>
                    <button
                      type="button"
                      className="btn-ouro"
                      style={{ fontSize: '13px', padding: '8px 14px' }}
                      onClick={() => setAbaAtiva('manual')}
                    >
                      <Plus size={16} /> Emitir Balcão
                    </button>
                  </div>
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

            {/* ABA 4: EMISSÃO MANUAL DE BILHETES NO BALCÃO */}
            {abaAtiva === 'manual' && (
              <div className="formulario-campanha-box">
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
                  🎟️ Emissão Rápida de Bilhetes no Balcão
                </h2>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
                  Emita bilhetes de cortesia ou bonificação para clientes presentes na Barbearia Dino ou compradores da loja física.
                </p>

                {ultimoBilheteEmitidoManual && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10b981',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#10b981', fontSize: '14px' }}>
                        🎉 Bilhete emitido com sucesso para {ultimoBilheteEmitidoManual.nome}!
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                        {ultimoBilheteEmitidoManual.quantidade} Número(s) da Sorte gerado(s).
                      </div>
                    </div>
                    <a
                      href={ultimoBilheteEmitidoManual.linkWhats}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#25D366',
                        color: '#fff',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: '700',
                        fontSize: '13px'
                      }}
                    >
                      <Share2 size={16} /> Enviar no WhatsApp do Cliente
                    </a>
                  </div>
                )}

                <form onSubmit={handleEmitirManual} className="form-grid">
                  <div className="form-group">
                    <label>Campanha Ativa</label>
                    <select
                      className="form-input"
                      value={campanhaSelecionada?.id || ''}
                      onChange={(e) => {
                        const selecionada = campanhas.find((c) => c.id === e.target.value);
                        setCampanhaSelecionada(selecionada);
                      }}
                    >
                      {campanhas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titulo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Nome Completo do Cliente *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: João da Silva"
                      value={formManual.clienteNome}
                      onChange={(e) => setFormManual({ ...formManual, clienteNome: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>WhatsApp / Telefone com DDD *</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="Ex: 65999056008"
                      value={formManual.clienteTelefone}
                      onChange={(e) => setFormManual({ ...formManual, clienteTelefone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Quantidade de Bilhetes a Emitir</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      className="form-input"
                      value={formManual.quantidade}
                      onChange={(e) => setFormManual({ ...formManual, quantidade: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Motivo da Emissão / Observação</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: Cortesia por compra de perfume importado no balcão"
                      value={formManual.motivo}
                      onChange={(e) => setFormManual({ ...formManual, motivo: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width" style={{ marginTop: '10px' }}>
                    <button
                      type="submit"
                      className="btn-ouro"
                      disabled={emitindoManual}
                      style={{ padding: '12px 24px', fontSize: '14px' }}
                    >
                      {emitindoManual ? 'Gerando Números...' : 'Gerar e Emitir Números da Sorte'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ABA 5: GANHADORES HISTÓRICOS */}
            {abaAtiva === 'ganhadores' && (
              <div className="sorteios-tabela-box">
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
                  🏆 Hall de Ganhadores dos Sorteios Dino
                </h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                  Histórico oficial e auditado de todos os clientes contemplados nas campanhas da Barbearia, Perfumaria e E-commerce.
                </p>

                <div style={{ overflowX: 'auto' }}>
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
                      {campanhas
                        .filter((c) => c.ganhadores?.length > 0 || c.ganhadorNome)
                        .flatMap((c) =>
                          (c.ganhadores?.length > 0 ? c.ganhadores : [{
                            clienteNome: c.ganhadorNome,
                            clienteTelefone: c.ganhadorTelefone,
                            numeroSorte: c.numeroSorte,
                            premio: c.premioPrincipal,
                            sorteadoEm: c.sorteadoEm,
                            hashAuditoria: c.hashAuditoria,
                          }]).map((g, gIdx) => (
                            <tr key={`${c.id}-${gIdx}`}>
                              <td style={{ fontWeight: '600', color: '#fbbf24' }}>{c.titulo}</td>
                              <td style={{ fontWeight: '700', color: '#fff' }}>{g.clienteNome}</td>
                              <td>
                                <span className="numero-sorte-tag">{g.numeroSorte}</span>
                              </td>
                              <td style={{ color: '#fff' }}>{g.premio}</td>
                              <td>{new Date(g.sorteadoEm || c.sorteadoEm).toLocaleDateString('pt-BR')}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                                {(g.hashAuditoria || '').slice(0, 16)}...
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn-outline-ouro"
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                    onClick={() => setCertificadoGanhador({ ...g, campanha: c })}
                                  >
                                    📜 Certificado A4
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-outline-ouro"
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                    onClick={async () => {
                                      setCampanhaSelecionada(c);
                                      handleNotificarGanhador();
                                    }}
                                  >
                                    <Send size={12} /> WhatsApp
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL NOVA CAMPANHA */}
      {modalNovaCampanhaAberto && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2 className="modal-titulo">Criar Nova Campanha de Sorteio</h2>
            <form onSubmit={handleSalvarCampanha} className="form-grid">
              <div className="form-group full-width">
                <label>Título da Campanha *</label>
                <input
                  type="text"
                  className="form-input"
                  value={novaCampanha.titulo}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Prêmio Principal *</label>
                <input
                  type="text"
                  className="form-input"
                  value={novaCampanha.premioPrincipal}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, premioPrincipal: e.target.value })}
                  placeholder="Ex: Moto Honda 0km ou R$ 18.000 no Pix"
                  required
                />
              </div>

              <div className="form-group">
                <label>R$ Mínimo por Bilhete (Serviços)</label>
                <input
                  type="number"
                  className="form-input"
                  value={novaCampanha.valorMinimoBilhete}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, valorMinimoBilhete: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Multiplicador Perfumaria / Loja</label>
                <input
                  type="number"
                  className="form-input"
                  value={novaCampanha.multiplicadorPerfumaria}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, multiplicadorPerfumaria: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Bônus Clube Dino (Bilhetes)</label>
                <input
                  type="number"
                  className="form-input"
                  value={novaCampanha.bonusClube}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, bonusClube: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Data Oficial do Sorteio</label>
                <input
                  type="date"
                  className="form-input"
                  value={novaCampanha.dataFim}
                  onChange={(e) => setNovaCampanha({ ...novaCampanha, dataFim: e.target.value })}
                  required
                />
              </div>

              <div className="modal-footer full-width">
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
                  {salvandoCampanha ? 'Salvando...' : 'Salvar e Publicar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL EDITAR CAMPANHA & PRÊMIO */}
      {modalEditarCampanhaAberto && campanhaEditando && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>✍️</span>
                <h2 className="modal-titulo" style={{ margin: 0 }}>Editar Prêmio & Campanha do Sorteio</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setModalEditarCampanhaAberto(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoCampanha} className="form-grid">
              <div className="form-group full-width" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px 16px', borderRadius: '8px' }}>
                <label style={{ color: '#fbbf24', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🏆 Prêmio Principal do Sorteio (O que o cliente vai ganhar) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '15px', fontWeight: 700, borderColor: '#f59e0b', background: '#0f172a', color: '#fbbf24', padding: '10px 14px' }}
                  value={campanhaEditando.premioPrincipal}
                  onChange={(e) => setCampanhaEditando({ ...campanhaEditando, premioPrincipal: e.target.value })}
                  placeholder="Ex: Moto Honda Fan 160 0km (ou R$ 18.000 no Pix), Kit Perfumaria Importada, iPhone 16..."
                  required
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  Este prêmio será exibido com destaque nos cards de sorteio, na roleta ao vivo e na consulta online dos clientes.
                </span>
              </div>

              <div className="form-group full-width">
                <label>Título Oficial da Campanha *</label>
                <input
                  type="text"
                  className="form-input"
                  value={campanhaEditando.titulo}
                  onChange={(e) => setCampanhaEditando({ ...campanhaEditando, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Status do Sorteio</label>
                <select
                  className="form-input"
                  value={campanhaEditando.status}
                  onChange={(e) => setCampanhaEditando({ ...campanhaEditando, status: e.target.value })}
                >
                  <option value="ativa">🟢 Ativa (Emitindo Bilhetes)</option>
                  <option value="pausada">🟡 Pausada</option>
                  <option value="sorteada">🏆 Sorteada / Concluída</option>
                  <option value="encerrada">🔴 Encerrada</option>
                </select>
              </div>

              <div className="form-group">
                <label>Data Oficial da Apuração / Sorteio</label>
                <input
                  type="date"
                  className="form-input"
                  value={campanhaEditando.dataSorteio}
                  onChange={(e) => setCampanhaEditando({ ...campanhaEditando, dataSorteio: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Gasto Mínimo p/ 1 Bilhete (Serviços R$)</label>
                <input
                  type="number"
                  className="form-input"
                  value={campanhaEditando.valorMinimoBilhete}
                  onChange={(e) => setCampanhaEditando({ ...campanhaEditando, valorMinimoBilhete: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Multiplicador Perfumaria / Loja</label>
                <input
                  type="number"
                  className="form-input"
                  value={campanhaEditando.multiplicadorPerfumaria}
                  onChange={(e) => setCampanhaEditando({ ...campanhaEditando, multiplicadorPerfumaria: e.target.value })}
                />
              </div>

              <div className="form-group full-width">
                <label>Descrição do Sorteio & Apresentação</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={campanhaEditando.descricao}
                  onChange={(e) => setCampanhaEditando({ ...campanhaEditando, descricao: e.target.value })}
                  placeholder="Ex: Sorteio oficial de fim de ano para todos os clientes da Barbearia Dino e Perfumaria."
                />
              </div>

              <div className="form-group full-width">
                <label>Regulamento do Sorteio</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={campanhaEditando.regulamento}
                  onChange={(e) => setCampanhaEditando({ ...campanhaEditando, regulamento: e.target.value })}
                  placeholder="Regras de participação, prazos, formas de apuração..."
                />
              </div>

              <div className="modal-footer full-width" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-outline-ouro"
                  onClick={() => setModalEditarCampanhaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-ouro"
                  disabled={salvandoEdicao}
                  style={{ padding: '10px 22px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit3 size={16} />
                  {salvandoEdicao ? 'Salvando Alterações...' : '💾 Salvar Alterações do Prêmio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
