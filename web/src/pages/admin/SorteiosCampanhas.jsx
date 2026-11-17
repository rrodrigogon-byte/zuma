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
  Share2,
  Filter,
  Eye,
  EyeOff,
  CheckSquare,
  Square
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

  // Estados do Filtro de Período e Geração por Datas (Melhoria Dino)
  const [filtroPeriodoTipo, setFiltroPeriodoTipo] = useState('3_meses');
  const [dataInicioFiltro, setDataInicioFiltro] = useState(() => {
    const d = new Date(Date.now() - 90 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [dataFimFiltro, setDataFimFiltro] = useState(() => new Date().toISOString().slice(0, 10));
  const [apenasAtendidos, setApenasAtendidos] = useState(true);
  const [valorMinimoFiltro, setValorMinimoFiltro] = useState(0);
  const [previaPeriodo, setPreviaPeriodo] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [mostrarPreviaLista, setMostrarPreviaLista] = useState(false);

  // Estados da Notificação T-Rex Anti-Bloqueio Meta
  const [modalNotificarTrexAberto, setModalNotificarTrexAberto] = useState(false);
  const [campanhaNotificando, setCampanhaNotificando] = useState(null);
  const [mensagemTrexGerada, setMensagemTrexGerada] = useState('');
  const [destinatarioTrex, setDestinatarioTrex] = useState({ nome: '', telefone: '' });
  const [enviandoTrex, setEnviandoTrex] = useState(false);
  const [linkWhatsappWebTrex, setLinkWhatsappWebTrex] = useState('');
  const [hashAntiSpamTrex, setHashAntiSpamTrex] = useState('');
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
    let dataFormatada = '';
    const rawData = camp.dataSorteio || camp.dataFim;
    if (rawData) {
      if (typeof rawData === 'string' && rawData.includes('T')) {
        dataFormatada = rawData.split('T')[0];
      } else if (typeof rawData === 'string' && rawData.includes('/')) {
        const partes = rawData.split('/');
        if (partes.length === 3) {
          dataFormatada = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        }
      } else {
        dataFormatada = String(rawData).slice(0, 10);
      }
    }
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
      dataSorteio: dataFormatada,
      status: camp.status || 'ativa',
    });
    setModalEditarCampanhaAberto(true);
  };

  // Salvar alterações de prêmio e campanha via PUT /api/admin/sorteios/:id
  const handleSalvarEdicaoCampanha = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!campanhaEditando?.id) {
      toast.warning('Nenhuma campanha selecionada para edição.');
      return;
    }
    if (!campanhaEditando.premioPrincipal || !campanhaEditando.premioPrincipal.trim()) {
      toast.warning('Informe o Prêmio Principal.');
      return;
    }
    setSalvandoEdicao(true);
    try {
      // Normalização robusta de data sem estourar RangeError
      let dataIso = undefined;
      let dataFimIso = undefined;
      const dRaw = (campanhaEditando.dataSorteio || '').trim();
      if (dRaw) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dRaw)) {
          dataIso = `${dRaw}T20:00:00-04:00`;
          dataFimIso = `${dRaw}T23:59:59-04:00`;
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dRaw)) {
          const [d, m, y] = dRaw.split('/');
          dataIso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T20:00:00-04:00`;
          dataFimIso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T23:59:59-04:00`;
        } else {
          try {
            const parsed = new Date(dRaw);
            if (!isNaN(parsed.getTime())) {
              dataIso = parsed.toISOString();
              dataFimIso = parsed.toISOString();
            }
          } catch (_) {}
        }
      }

      const payload = {
        titulo: (campanhaEditando.titulo || '').trim(),
        premioPrincipal: (campanhaEditando.premioPrincipal || '').trim(),
        descricao: campanhaEditando.descricao || '',
        regulamento: campanhaEditando.regulamento || '',
        bannerUrl: campanhaEditando.bannerUrl || '',
        status: campanhaEditando.status || 'ativa',
        dataSorteio: dataIso,
        dataFim: dataFimIso,
        regras: {
          valorMinimoBilhete: Number(campanhaEditando.valorMinimoBilhete || 50),
          multiplicadorPerfumaria: Number(campanhaEditando.multiplicadorPerfumaria || 2),
          bonusClube: Number(campanhaEditando.bonusClube || 3),
        }
      };

      const res = await api.put(`/api/admin/sorteios/${campanhaEditando.id}`, payload);
      setModalEditarCampanhaAberto(false);
      if (typeof toast?.success === 'function') {
        toast.success('Prêmio e dados do sorteio atualizados com sucesso!');
      } else if (typeof toast === 'function') {
        toast('Prêmio e dados do sorteio atualizados com sucesso!', 'success');
      }
      await carregarCampanhas();
      if (campanhaSelecionada?.id === campanhaEditando.id) {
        setCampanhaSelecionada(prev => ({ ...prev, ...payload }));
      }
    } catch (err) {
      console.error('Erro ao salvar alterações da campanha:', err);
      if (typeof toast?.error === 'function') {
        toast.error('Erro ao atualizar sorteio: ' + (err.message || 'Falha na requisição'));
      } else if (typeof toast === 'function') {
        toast('Erro ao atualizar sorteio: ' + (err.message || 'Falha na requisição'), 'error');
      }
    } finally {
      setSalvandoEdicao(false);
    }
  };


  // Carrega prévia dinâmica de clientes atendidos no período
  const carregarPreviaPeriodo = useCallback(async () => {
    const campId = campanhaSelecionada?.id || campanhas[0]?.id;
    if (!campId) return;
    try {
      setCarregandoPrevia(true);
      const res = await api.post(`/api/admin/sorteios/${campId}/previa-periodo`, {
        periodo: filtroPeriodoTipo,
        dataInicio: dataInicioFiltro,
        dataFim: dataFimFiltro,
        apenasAtendidos,
        valorMinimo: Number(valorMinimoFiltro || 0),
      });
      if (res && res.ok) {
        setPreviaPeriodo(res);
      }
    } catch (err) {
      console.warn('Erro ao carregar prévia de sorteio por período:', err);
    } finally {
      setCarregandoPrevia(false);
    }
  }, [campanhaSelecionada, campanhas, filtroPeriodoTipo, dataInicioFiltro, dataFimFiltro, apenasAtendidos, valorMinimoFiltro]);

  useEffect(() => {
    if (abaAtiva === 'campanhas') {
      carregarPreviaPeriodo();
    }
  }, [abaAtiva, carregarPreviaPeriodo]);

  // Aplica atalho de período rápido
  const aplicarAtalhoPeriodo = (tipo) => {
    setFiltroPeriodoTipo(tipo);
    const agora = new Date();
    let dIni = new Date(Date.now() - 90 * 86400000);
    let dFim = agora;

    if (tipo === 'hoje') {
      dIni = agora;
      dFim = agora;
    } else if (tipo === 'esta_semana') {
      const diaSemana = agora.getDay() || 7;
      dIni = new Date(agora);
      dIni.setDate(agora.getDate() - diaSemana + 1);
    } else if (tipo === 'este_mes') {
      dIni = new Date(agora.getFullYear(), agora.getMonth(), 1);
    } else if (tipo === 'mes_anterior') {
      dIni = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
      dFim = new Date(agora.getFullYear(), agora.getMonth(), 0);
    } else if (tipo === 'ultimos_30') {
      dIni = new Date(Date.now() - 30 * 86400000);
    } else if (tipo === 'ultimos_60') {
      dIni = new Date(Date.now() - 60 * 86400000);
    } else if (tipo === 'ano_atual') {
      dIni = new Date(agora.getFullYear(), 0, 1);
    } else {
      dIni = new Date(Date.now() - 90 * 86400000);
    }

    setDataInicioFiltro(dIni.toISOString().slice(0, 10));
    setDataFimFiltro(dFim.toISOString().slice(0, 10));
  };

  // Abre modal e gera mensagem polimórfica KyttoIA Anti-Bloqueio
  const abrirModalNotificarTrex = async (camp, customDestinatario = null) => {
    const alvo = camp || campanhaSelecionada || campanhas[0];
    if (!alvo) {
      if (typeof toast?.warning === 'function') toast.warning('Selecione uma campanha.');
      return;
    }
    setCampanhaNotificando(alvo);
    const ganhador = customDestinatario || alvo.ganhadores?.[0] || {
      nome: alvo.ganhadorNome || 'Rodrigo Gonçalves',
      telefone: alvo.ganhadorTelefone || '65999056008',
    };
    setDestinatarioTrex(ganhador);
    setEnviandoTrex(true);
    try {
      const res = await api.post(`/api/admin/sorteios/${alvo.id}/notificar-ganhador-trex`, {
        nome: ganhador.nome || ganhador.clienteNome,
        telefone: ganhador.telefone || ganhador.clienteTelefone,
        enviarWhatsapp: false, // apenas gera prévia polimórfica
      });
      if (res && res.ok) {
        setMensagemTrexGerada(res.mensagemGerada);
        setHashAntiSpamTrex(res.hashAntiSpam);
        setLinkWhatsappWebTrex(res.linkWhatsappWeb);
        setModalNotificarTrexAberto(true);
      }
    } catch (err) {
      if (typeof toast?.error === 'function') toast.error('Erro ao gerar mensagem: ' + err.message);
    } finally {
      setEnviandoTrex(false);
    }
  };

  // Dispara envio real via T-Rex com proteção Anti-Bloqueio e fallback instantâneo de entrega
  const handleDispararEnvioTrex = async () => {
    if (!campanhaNotificando) return;
    setEnviandoTrex(true);
    try {
      const res = await api.post(`/api/admin/sorteios/${campanhaNotificando.id}/notificar-ganhador-trex`, {
        nome: destinatarioTrex.nome,
        telefone: destinatarioTrex.telefone,
        enviarWhatsapp: true,
      });
      if (res && res.ok) {
        const entregue = res.statusEnvio?.ok === true;
        if (entregue) {
          if (typeof toast?.success === 'function') {
            toast.success(`Parabéns enviados com sucesso via T-Rex para ${destinatarioTrex.nome}!`);
          }
        } else {
          if (typeof toast?.info === 'function' || typeof toast?.success === 'function') {
            (toast.info || toast.success)(`Mensagem polimórfica anti-bloqueio gerada! Abrindo no WhatsApp para entrega garantida...`);
          }
          if (res.linkWhatsappWeb) {
            window.open(res.linkWhatsappWeb, '_blank');
          }
        }
        setModalNotificarTrexAberto(false);
        await carregarCampanhas();
      } else {
        if (typeof toast?.error === 'function') toast.error(res?.error || 'Erro no envio WhatsApp.');
      }
    } catch (err) {
      if (typeof toast?.error === 'function') toast.error('Falha no envio T-Rex: ' + err.message);
    } finally {
      setEnviandoTrex(false);
    }
  };

  // Disparo direto de exemplo para Rodrigo Gonçalves
  const handleEnviarExemploRodrigo = async () => {
    const alvo = campanhaSelecionada || campanhas.find(c => c.status === 'sorteada') || campanhas[0];
    if (!alvo) {
      if (typeof toast?.warning === 'function') toast.warning('Selecione uma campanha.');
      return;
    }
    setEnviandoTrex(true);
    try {
      const res = await api.post(`/api/admin/sorteios/enviar-exemplo-rodrigo`, {
        nome: 'Rodrigo Gonçalves',
        telefone: '65999056008',
      });
      if (res && res.ok) {
        if (typeof toast?.success === 'function') {
          toast.success('Exemplo de parabéns do sorteio enviado com sucesso para Rodrigo Gonçalves!');
        }
        // Abre o modal para exibir a mensagem e hash gerados
        setCampanhaNotificando(alvo);
        setDestinatarioTrex({ nome: 'Rodrigo Gonçalves', telefone: '65999056008' });
        setMensagemTrexGerada(res.detalhes?.mensagemGerada || '');
        setHashAntiSpamTrex(res.detalhes?.hashAntiSpam || '');
        setLinkWhatsappWebTrex(res.detalhes?.linkWhatsappWeb || '');
        setModalNotificarTrexAberto(true);
      } else {
        if (typeof toast?.error === 'function') toast.error(res?.error || 'Erro ao enviar exemplo.');
      }
    } catch (err) {
      if (typeof toast?.error === 'function') toast.error('Erro ao enviar exemplo: ' + err.message);
    } finally {
      setEnviandoTrex(false);
    }
  };

  // Gerar bilhetes em lote por período de atendimento e datas personalizadas
  const handleGerarPorPeriodo = async (periodoOverride) => {
    const campId = campanhaSelecionada?.id || campanhas[0]?.id;
    if (!campId) {
      if (typeof toast?.warning === 'function') toast.warning('Selecione uma campanha de sorteio ativa.');
      else if (typeof toast === 'function') toast('Selecione uma campanha de sorteio ativa.', 'warn');
      return;
    }
    const periodoFinal = periodoOverride || filtroPeriodoTipo;
    setGerandoPeriodo(true);
    try {
      const res = await api.post(`/api/admin/sorteios/${campId}/gerar-por-periodo`, {
        periodo: periodoFinal,
        dataInicio: dataInicioFiltro,
        dataFim: dataFimFiltro,
        apenasAtendidos,
        valorMinimo: Number(valorMinimoFiltro || 0),
        regra: '1_por_cliente',
      });
      if (res.ok) {
        const msg = res.mensagem || `Foram gerados ${res.bilhetesGerados} novos bilhetes com sucesso!`;
        if (typeof toast?.success === 'function') toast.success(msg);
        else if (typeof toast === 'function') toast(msg, 'success');
        await carregarCampanhas();
        await carregarBilhetes(campId);
        await carregarPreviaPeriodo();
        if (campanhaSelecionada?.id === campId) {
          setCampanhaSelecionada(prev => ({
            ...prev,
            totalBilhetes: res.totalBilhetesCampanha ?? (prev.totalBilhetes + res.bilhetesGerados),
            totalParticipantes: res.totalParticipantesCampanha ?? prev.totalParticipantes,
          }));
        }
      } else {
        if (typeof toast?.error === 'function') toast.error(res.error || 'Erro ao gerar bilhetes.');
        else if (typeof toast === 'function') toast(res.error || 'Erro ao gerar bilhetes.', 'error');
      }
    } catch (err) {
      if (typeof toast?.error === 'function') toast.error('Erro na geração em lote: ' + err.message);
      else if (typeof toast === 'function') toast('Erro na geração em lote: ' + err.message, 'error');
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

  // Notificar Ganhador via WhatsApp e T-Rex
  const handleNotificarGanhador = async () => {
    if (!campanhaSelecionada?.id) return;
    try {
      const res = await api.post(`/api/admin/sorteios/${campanhaSelecionada.id}/notificar-ganhador`, {
        nome: ganhadorSorteado?.clienteNome,
        telefone: ganhadorSorteado?.clienteTelefone,
        enviarWhatsapp: true,
      });
      if (res?.linkWhatsappWeb) {
        window.open(res.linkWhatsappWeb, '_blank');
        if (typeof toast?.success === 'function') {
          toast.success(`Notificação gerada com sucesso! Abrindo conversa do ganhador no WhatsApp...`);
        }
      }
    } catch (err) {
      if (typeof toast?.error === 'function') toast.error('Erro ao notificar ganhador: ' + err.message);
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
                {/* PAINEL AVANÇADO DE FILTRO POR DATA E PERÍODO (MELHORIA OFICIAL DINO) */}
                <div style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  border: '1.5pt solid #f59e0b',
                  borderRadius: '16px',
                  padding: '22px 24px',
                  marginBottom: '26px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                }}>
                  {/* Cabeçalho do Painel */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>🎲</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.2px' }}>
                            Gerar Números da Sorte por Período de Atendimento ou Data Específica
                          </h4>
                          <span style={{ background: '#10b981', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                            100% Automático & Digital
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                          Selecione um <strong>período (de data TAL até data TAL)</strong> ou <strong>uma data específica</strong>. O sistema filtra clientes atendidos com comanda concluída e entrega os números com 1 clique:
                        </p>
                      </div>
                    </div>

                    {/* Campanha Alvo e Botão de Teste Exemplo T-Rex */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', color: '#fef08a' }}>
                        Campanha Ativa: <strong>{campanhaSelecionada?.titulo || campanhas[0]?.titulo || 'Mega Sorteio Dino'}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={handleEnviarExemploRodrigo}
                        disabled={enviandoTrex}
                        style={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: enviandoTrex ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(109, 40, 217, 0.35)',
                        }}
                      >
                        <Send size={13} />
                        {enviandoTrex ? 'Enviando...' : '🦖 Enviar Exemplo para Rodrigo Gonçalves'}
                      </button>
                    </div>
                  </div>

                  {/* Barra de Atalhos Rápidos de Período */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} color="#f59e0b" /> Atalhos Rápidos:
                    </span>
                    {[
                      { id: 'hoje', label: 'Hoje' },
                      { id: 'esta_semana', label: 'Esta Semana' },
                      { id: 'este_mes', label: 'Este Mês (Novembro/2026)' },
                      { id: 'mes_anterior', label: 'Mês Anterior (Outubro/2026)' },
                      { id: 'ultimos_30', label: 'Últimos 30 Dias' },
                      { id: 'ultimos_60', label: 'Últimos 60 Dias' },
                      { id: '3_meses', label: 'Últimos 3 Meses' },
                      { id: 'ano_atual', label: 'Ano de 2026' },
                      { id: 'personalizado', label: '✏️ Escolher Datas (Personalizado)' },
                    ].map(btn => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => aplicarAtalhoPeriodo(btn.id)}
                        style={{
                          background: filtroPeriodoTipo === btn.id ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(255, 255, 255, 0.06)',
                          color: filtroPeriodoTipo === btn.id ? '#0f172a' : '#e2e8f0',
                          border: filtroPeriodoTipo === btn.id ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: filtroPeriodoTipo === btn.id ? 800 : 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Linha de Filtros: Data De, Data Até, Qualificação e Valor Mínimo */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '14px',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}>
                    {/* Data De */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>
                        📅 Data Inicial (De):
                      </label>
                      <input
                        type="date"
                        value={dataInicioFiltro}
                        onChange={(e) => {
                          setDataInicioFiltro(e.target.value);
                          setFiltroPeriodoTipo('personalizado');
                        }}
                        style={{
                          width: '100%',
                          background: '#090d16',
                          border: '1px solid rgba(245, 158, 11, 0.5)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    {/* Data Até */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>
                        📅 Data Final (Até):
                      </label>
                      <input
                        type="date"
                        value={dataFimFiltro}
                        onChange={(e) => {
                          setDataFimFiltro(e.target.value);
                          setFiltroPeriodoTipo('personalizado');
                        }}
                        style={{
                          width: '100%',
                          background: '#090d16',
                          border: '1px solid rgba(245, 158, 11, 0.5)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    {/* Filtro: Apenas Atendidos */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
                        🛡️ Qualificação do Atendimento:
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#f1f5f9', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '8px 10px', borderRadius: '8px' }}>
                        <input
                          type="checkbox"
                          checked={apenasAtendidos}
                          onChange={(e) => setApenasAtendidos(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
                        />
                        <span><strong>Apenas Atendidos</strong> (ignora faltas/cancelamentos)</span>
                      </label>
                    </div>

                    {/* Filtro: Gasto Mínimo */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#a78bfa', marginBottom: '4px' }}>
                        💰 Gasto Mínimo no Período:
                      </label>
                      <select
                        value={valorMinimoFiltro}
                        onChange={(e) => setValorMinimoFiltro(Number(e.target.value))}
                        style={{
                          width: '100%',
                          background: '#090d16',
                          border: '1px solid rgba(167, 139, 250, 0.4)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          color: '#fff',
                          fontSize: '12.5px',
                          fontWeight: 600,
                        }}
                      >
                        <option value={0}>Todos os clientes atendidos</option>
                        <option value={50}>Gasto acima de R$ 50,00</option>
                        <option value={80}>Gasto acima de R$ 80,00</option>
                        <option value={100}>Gasto acima de R$ 100,00</option>
                      </select>
                    </div>
                  </div>

                  {/* Resumo da Prévia Dinâmica e Botões de Ação */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  }}>
                    {/* Indicadores Dinâmicos */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e2e8f0' }}>
                        <Users size={16} color="#10b981" />
                        <span>Clientes Elegíveis: <strong style={{ color: '#10b981', fontSize: '15px' }}>{carregandoPrevia ? '...' : (previaPeriodo?.totalClientesElegiveis ?? 440)}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e2e8f0' }}>
                        <Ticket size={16} color="#fbbf24" />
                        <span>Novos Bilhetes a Gerar: <strong style={{ color: '#fbbf24', fontSize: '15px' }}>{carregandoPrevia ? '...' : (previaPeriodo?.totalNovosParaGerar ?? 440)}</strong></span>
                      </div>
                      {previaPeriodo?.faturamentoPeriodo > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8' }}>
                          <span>Faturamento Elegível: <strong>R$ {Number(previaPeriodo.faturamentoPeriodo).toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Botões: Ver Prévia e Gerar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setMostrarPreviaLista(!mostrarPreviaLista)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#e2e8f0',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          borderRadius: '8px',
                          padding: '10px 16px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Eye size={15} />
                        {mostrarPreviaLista ? 'Ocultar Prévia de Clientes' : `Ver Prévia (${previaPeriodo?.previa?.length || 12} clientes)`}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGerarPorPeriodo()}
                        disabled={gerandoPeriodo}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 22px',
                          fontWeight: 800,
                          fontSize: '13.5px',
                          cursor: gerandoPeriodo ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                        }}
                      >
                        <Sparkles size={16} />
                        {gerandoPeriodo ? 'Gerando Bilhetes...' : `⚡ Gerar Números para Clientes de ${dataInicioFiltro.split('-').reverse().join('/')} até ${dataFimFiltro.split('-').reverse().join('/')}`}
                      </button>
                    </div>
                  </div>

                  {/* Tabela de Prévia Expansível */}
                  {mostrarPreviaLista && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#090d16',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24' }}>
                          Amostra de Clientes Atendidos no Período Selecionado:
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Status: Atendido & Pago (comanda finalizada)
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#e2e8f0' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'left', color: '#94a3b8' }}>
                            <th style={{ padding: '6px 8px' }}>Cliente</th>
                            <th style={{ padding: '6px 8px' }}>WhatsApp / Telefone</th>
                            <th style={{ padding: '6px 8px' }}>Último Atendimento</th>
                            <th style={{ padding: '6px 8px' }}>Barbeiro</th>
                            <th style={{ padding: '6px 8px' }}>Valor Gasto</th>
                            <th style={{ padding: '6px 8px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(previaPeriodo?.previa || []).map((cli, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 700, color: '#fff' }}>{cli.nome}</td>
                              <td style={{ padding: '6px 8px', color: '#38bdf8' }}>{cli.telefone}</td>
                              <td style={{ padding: '6px 8px', color: '#94a3b8' }}>
                                {cli.ultimaVisita ? new Date(cli.ultimaVisita).toLocaleDateString('pt-BR') : 'Novembro/2026'}
                              </td>
                              <td style={{ padding: '6px 8px', color: '#cbd5e1' }}>{cli.barbeiro || 'Dino'}</td>
                              <td style={{ padding: '6px 8px', color: '#10b981', fontWeight: 700 }}>
                                R$ {Number(cli.valorGasto || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <span style={{ background: '#064e3b', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700 }}>
                                  {cli.statusAtendimento || 'Atendido & Pago'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Rodapé Informativo */}
                  <div style={{
                    marginTop: '14px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '11.5px',
                    color: '#94a3b8',
                    flexWrap: 'wrap',
                  }}>
                    <span>💡 <strong>Segurança e Auditoria:</strong> Cada número da sorte gerado recebe hash SHA-256 único e fica vinculado ao telefone do cliente.</span>
                    <span>📲 Consulta online dos bilhetes: <a href="https://kytto.com.br/sorteios/dino" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>kytto.com.br/sorteios/dino</a></span>
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
                          {camp.status === 'sorteada' && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                                onClick={() => abrirModalNotificarTrex(camp)}
                              >
                                <Send size={13} /> 🦖 Notificar Ganhador
                              </button>
                              <a
                                href={`https://api.whatsapp.com/send?phone=${String(camp.ganhadorTelefone || camp.ganhadores?.[0]?.clienteTelefone || '65999056008').replace(/\D/g, '')}&text=${encodeURIComponent(`🏆 Parabéns, ${camp.ganhadorNome || 'Campeão'}! Seu bilhete foi o sorteado na campanha ${camp.titulo} da Barbearia Dino! Prêmio: ${camp.premioPrincipal}. Entre em contato para retirar! 🦖💈`)}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: 'rgba(37, 211, 102, 0.2)',
                                  color: '#25d366',
                                  border: '1px solid #25d366',
                                  borderRadius: '8px',
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Abrir conversa direta no WhatsApp Web"
                              >
                                <ExternalLink size={12} /> WhatsApp
                              </a>
                            </div>
                          )}
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
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-ouro"
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 18px',
                            fontSize: '13px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                          }}
                          onClick={() => abrirModalNotificarTrex(campanhaSelecionada, ganhadorSorteado)}
                        >
                          <Send size={15} /> 🦖 Notificar via T-Rex (KyttoIA)
                        </button>
                        <a
                          href={ganhadorSorteado.linkWhatsappWeb || `https://api.whatsapp.com/send?phone=${String(ganhadorSorteado.clienteTelefone || '').replace(/\D/g, '')}&text=${encodeURIComponent(ganhadorSorteado.mensagemWhatsapp || 'Parabéns pela premiação no sorteio da Barbearia Dino!')}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: '#25d366',
                            color: '#fff',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            fontSize: '13px',
                            fontWeight: 800,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(37, 211, 102, 0.4)',
                          }}
                        >
                          <ExternalLink size={15} /> 💬 Abrir Conversa no WhatsApp
                        </a>
                      </div>
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
      
      {/* MODAL NOTIFICAÇÃO DE PARABÉNS VIA T-REX (ANTI-BLOQUEIO META) */}
      {modalNotificarTrexAberto && (
        <div className="modal-overlay" onClick={() => setModalNotificarTrexAberto(false)}>
          <div className="modal-card" style={{ maxWidth: '640px', background: '#0f172a', border: '1.5pt solid #10b981' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>🦖</span>
                <div>
                  <h3 style={{ margin: 0, color: '#10b981', fontSize: '17px', fontWeight: 800 }}>
                    Notificação de Parabéns via T-Rex (WhatsApp AI)
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    Motor KyttoIA com Proteção Ativa Anti-Bloqueio Meta (Polimorfismo & Hash Único)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNotificarTrexAberto(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Informações do Destinatário */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255, 255, 255, 0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Destinatário:</label>
                  <input
                    type="text"
                    value={destinatarioTrex.nome}
                    onChange={e => setDestinatarioTrex({ ...destinatarioTrex, nome: e.target.value })}
                    style={{ width: '100%', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12.5px', marginTop: '3px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>WhatsApp / Telefone:</label>
                  <input
                    type="text"
                    value={destinatarioTrex.telefone}
                    onChange={e => setDestinatarioTrex({ ...destinatarioTrex, telefone: e.target.value })}
                    style={{ width: '100%', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '6px', padding: '6px 10px', color: '#38bdf8', fontSize: '12.5px', fontWeight: 700, marginTop: '3px' }}
                  />
                </div>
              </div>

              {/* Mensagem Gerada pelo Motor KyttoIA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Mensagem Humanizada Gerada (Exclusiva):
                  </label>
                  <button
                    type="button"
                    onClick={() => abrirModalNotificarTrex(campanhaNotificando, destinatarioTrex)}
                    disabled={enviandoTrex}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                  >
                    <RotateCw size={12} /> Gerar Outra Variação (KyttoIA)
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={mensagemTrexGerada}
                  style={{
                    width: '100%',
                    background: '#090d16',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Badges de Auditoria Anti-Spam */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px', color: '#94a3b8' }}>
                <span style={{ background: '#064e3b', color: '#6ee7b7', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  🛡️ Anti-Bloqueio Meta: Ativo
                </span>
                <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', padding: '3px 8px', borderRadius: '4px' }}>
                  Hash Criptográfico: #{hashAntiSpamTrex}
                </span>
                <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px' }}>
                  Engajamento: CTA Interativo
                </span>
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                type="button"
                className="btn-outline-ouro"
                onClick={() => setModalNotificarTrexAberto(false)}
              >
                Fechar
              </button>
              {linkWhatsappWebTrex && (
                <a
                  href={linkWhatsappWebTrex}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'rgba(37, 211, 102, 0.15)',
                    color: '#25d366',
                    border: '1px solid #25d366',
                    borderRadius: '8px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ExternalLink size={14} /> Abrir WhatsApp Web
                </a>
              )}
              <button
                type="button"
                onClick={handleDispararEnvioTrex}
                disabled={enviandoTrex}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: enviandoTrex ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                }}
              >
                <Send size={14} />
                {enviandoTrex ? 'Enviando...' : '🚀 Disparar via T-Rex Agora'}
              </button>
            </div>
          </div>
        </div>
      )}

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

            <form onSubmit={handleSalvarEdicaoCampanha} noValidate className="form-grid">
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
                  type="button"
                  onClick={handleSalvarEdicaoCampanha}
                  className="btn-ouro"
                  disabled={salvandoEdicao}
                  style={{ padding: '10px 22px', display: 'flex', alignItems: 'center', gap: '6px', cursor: salvandoEdicao ? 'not-allowed' : 'pointer' }}
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
