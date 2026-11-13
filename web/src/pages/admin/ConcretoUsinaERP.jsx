import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';
import './ConcretoUsinaERP.css';

const CARGAS_PADRAO = [
  { id: "crg-1001", numero: 1001, obra: "Ed. Residencial Serra Dourada · lajes 4º pav.", cliente: "Construtora MT Horizon", fck: 30, brita: "Brita 1", slump: "14 ± 2 cm", volumeM3: 24, bomba: "BL-01 · Lança 32 m", valorTotal: 11160, status: "concluido",
    viagens: [{ veiculo: "BT-01", saidaUsina: "08:15", chegadaObra: "08:35", fimDescarga: "09:20", pegaMinutos: null }, { veiculo: "BT-02", saidaUsina: "08:50", chegadaObra: "09:10", fimDescarga: "10:00", pegaMinutos: null }, { veiculo: "BT-03", saidaUsina: "09:30", chegadaObra: "09:55", fimDescarga: "10:45", pegaMinutos: null }] },
  { id: "crg-1002", numero: 1002, obra: "Piso industrial galpão de cargas · etapa 2", cliente: "AgroLog Transportes & Logística", fck: 35, brita: "Brita 1 (fibras)", slump: "14 ± 2 cm", volumeM3: 32, bomba: "Direta · calha", valorTotal: 15360, status: "em_transito",
    viagens: [{ veiculo: "BT-01", saidaUsina: "13:10", chegadaObra: "13:25", fimDescarga: "14:15", pegaMinutos: null }, { veiculo: "BT-02", saidaUsina: "13:45", chegadaObra: "14:05", fimDescarga: "—", pegaMinutos: 65 }, { veiculo: "BT-04", saidaUsina: "14:20", chegadaObra: "—", fimDescarga: "—", pegaMinutos: 30 }, { veiculo: "BT-05", saidaUsina: "—", chegadaObra: "—", fimDescarga: "—", pegaMinutos: null }] },
  { id: "crg-1003", numero: 1003, obra: "Casa térrea lote 12 qd. 08 · vigas e baldrames", cliente: "Eng. Marcelo Dantas", fck: 25, brita: "Brita 1", slump: "12 ± 2 cm", volumeM3: 16, bomba: "BL-01 · Lança 32 m", valorTotal: 7310, status: "carregando",
    viagens: [{ veiculo: "BT-03", saidaUsina: "—", chegadaObra: "—", fimDescarga: "—", pegaMinutos: null }, { veiculo: "BT-04", saidaUsina: "—", chegadaObra: "—", fimDescarga: "—", pegaMinutos: null }] }
];

export default function ConcretoUsinaERP() {
  const { empresaAtiva } = useAuth();
  const { toast } = useToast();

  // Estados de layout e tema
  const [themeDark, setThemeDark] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const secaoAtiva = searchParams.get('secao') || 'operacao-despacho';
  const setSecaoAtiva = (s) => setSearchParams({ secao: s });
  const [busca, setBusca] = useState('');
  const [cargasAbertas, setCargasAbertas] = useState({ '#1002': true });

  // Estados de dados da usina
  const [cargas, setCargas] = useState(CARGAS_PADRAO);
  const [catalogo, setCatalogo] = useState([]);
  const [frota, setFrota] = useState([]);
  const [ensaios, setEnsaios] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [silos, setSilos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [ordensProducao, setOrdensProducao] = useState([]);
  const [dragas, setDragas] = useState([]);
  const [patiosMineracao, setPatiosMineracao] = useState([]);
  const [vendasAgregados, setVendasAgregados] = useState([]);
  const [medicoesObras, setMedicoesObras] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modais
  const [modalNovaCargaAberto, setModalNovaCargaAberto] = useState(false);
  const [modalRomaneioAberto, setModalRomaneioAberto] = useState(null);
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(null);
  const [modalRupturaAberto, setModalRupturaAberto] = useState(null);
  const [modalNovaPropostaAberto, setModalNovaPropostaAberto] = useState(false);
  const [modalLaudoAberto, setModalLaudoAberto] = useState(null);
  
  // Modais de Ordens de Produção (OP)
  const [modalOpFormAberto, setModalOpFormAberto] = useState(null); // null | { modo: 'criar' | 'editar', op?: object }
  const [modalOpVisualizarAberto, setModalOpVisualizarAberto] = useState(null); // null | op
  const [modalOpApontamentoAberto, setModalOpApontamentoAberto] = useState(null); // null | op
  const [filtroOpStatus, setFiltroOpStatus] = useState('todos');
  const [buscaOpTermo, setBuscaOpTermo] = useState('');
  const [salvandoOp, setSalvandoOp] = useState(false);
  const [salvandoApontamento, setSalvandoApontamento] = useState(false);

  // Formulários de OP
  const [formOp, setFormOp] = useState({
    numero: '',
    cliente: '',
    obra: '',
    endereco: '',
    fck: 25,
    volumeM3: 8,
    slumpPrevistoCm: '12 ± 2 cm',
    betoneirasEscaladas: ['BT-01'],
    operador: 'Carlos Eduardo',
    motorista: '',
    dataHora: '',
    status: 'programada',
    observacoes: ''
  });

  const [formApontamentoOp, setFormApontamentoOp] = useState({
    cimentoKg: '',
    areiaKg: '',
    britaKg: '',
    aguaL: '',
    aditivoL: '',
    slumpMedidoCm: '12.0',
    lacreCarga: '',
    status: 'concluida'
  });

  // Estados de Assinatura Digital do Cliente e Romaneio
  const [abaRomaneio, setAbaRomaneio] = useState('romaneio'); // 'romaneio' | 'balanca'
  const [assinaturaForm, setAssinaturaForm] = useState({
    recebedorNome: 'Eng. Marcelo Dantas de Souza',
    recebedorDocumento: '045.892.110-34',
    recebedorCargo: 'Engenheiro Residente (Fiscal da Obra)',
    slumpMedidoCm: '14.5',
    aguaAdicionadaObraLitros: '0',
    observacoes: 'Concreto recebido nas condições normativas NBR 7212. Abatimento e consistência aprovados.'
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [salvandoAssinatura, setSalvandoAssinatura] = useState(false);
  const canvasRef = useRef(null);

  // Handlers do Canvas Touch e Caneta Digital
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F172A';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = (e) => {
    if (isDrawing) {
      if (e) e.preventDefault();
      setIsDrawing(false);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const abrirColetaAssinatura = (carga) => {
    setModalAssinaturaAberto(carga);
    setAssinaturaForm({
      recebedorNome: carga.assinaturaEntrega?.recebedorNome || 'Eng. Marcelo Dantas de Souza',
      recebedorDocumento: carga.assinaturaEntrega?.recebedorDocumento || '045.892.110-34',
      recebedorCargo: carga.assinaturaEntrega?.recebedorCargo || 'Engenheiro Residente (Fiscal da Obra)',
      slumpMedidoCm: String(carga.assinaturaEntrega?.slumpMedidoCm || '14.5'),
      aguaAdicionadaObraLitros: String(carga.assinaturaEntrega?.aguaAdicionadaObraLitros || '0'),
      observacoes: carga.assinaturaEntrega?.observacoes || 'Concreto recebido nas condições normativas NBR 7212. Abatimento e consistência aprovados.'
    });
    setHasSignature(false);
    setTimeout(() => {
      clearSignature();
    }, 150);
  };

  const handleSalvarAssinatura = async (e) => {
    e.preventDefault();
    if (!hasSignature) {
      toast ? toast.error('Por favor, colete a assinatura do cliente no quadro abaixo antes de confirmar.') : alert('Por favor, colete a assinatura do cliente no quadro abaixo.');
      return;
    }
    const canvas = canvasRef.current;
    const assinaturaBase64 = canvas ? canvas.toDataURL('image/png') : null;
    setSalvandoAssinatura(true);
    try {
      const res = await api.post(`/api/admin/concreto/cargas/${modalAssinaturaAberto.id}/assinar-entrega`, {
        assinaturaBase64,
        recebedorNome: assinaturaForm.recebedorNome,
        recebedorDocumento: assinaturaForm.recebedorDocumento,
        recebedorCargo: assinaturaForm.recebedorCargo,
        slumpMedidoCm: Number(assinaturaForm.slumpMedidoCm),
        aguaAdicionadaObraLitros: Number(assinaturaForm.aguaAdicionadaObraLitros),
        observacoes: assinaturaForm.observacoes
      });
      if (res.data?.ok) {
        setCargas(prev => prev.map(c => (c.id === modalAssinaturaAberto.id || c.numero === modalAssinaturaAberto.numero) ? res.data.carga : c));
        setModalRomaneioAberto(res.data.carga);
        setModalAssinaturaAberto(null);
        toast && toast.success('Assinatura digital registrada e entrega confirmada com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao salvar assinatura:', err);
      const msg = err.response?.data?.error || err.message;
      toast ? toast.error('Erro ao registrar assinatura: ' + msg) : alert('Erro: ' + msg);
    } finally {
      setSalvandoAssinatura(false);
    }
  };

  // Calculadora NBR 7212
  const [calcFck, setCalcFck] = useState(25);
  const [calcVolume, setCalcVolume] = useState(8);
  const [calcUmidadeAreia, setCalcUmidadeAreia] = useState(4.5);
  const [calcBrita, setCalcBrita] = useState('Brita 1');

  // Formulário Nova Carga
  const [formCarga, setFormCarga] = useState({
    cliente: '',
    obra: '',
    endereco: '',
    fck: 25,
    volumeM3: 8,
    slump: '14 ± 2 cm',
    brita: 'Brita 1',
    bomba: 'BL-01 · Lança 32 m',
    horarioAgendado: '08:30',
    dataAgendada: new Date().toISOString().slice(0, 10),
    observacoes: ''
  });

  // Formulário Registro de Ruptura
  const [formRuptura, setFormRuptura] = useState({
    cpId: 'CP-1',
    idadeDias: 7,
    tensaoMpa: '',
    forcaKn: ''
  });

  // Formulário Nova Proposta
  const [formProposta, setFormProposta] = useState({
    cliente: '',
    contato: '',
    telefone: '',
    obra: '',
    endereco: '',
    fck: 25,
    volumeM3: 16,
    tipoBomba: 'Bomba Lança 32m',
    freteKm: 0,
    condicaoPagamento: 'Boleto faturado 14/28 DDL',
    observacoes: ''
  });

  // Cálculo dinâmico estequiométrico em tempo real no formulário de OP (NBR 7212)
  const calculoTeoricoFormOp = useMemo(() => {
    const f = Number(formOp.fck) || 25;
    const v = Number(formOp.volumeM3) || 8;
    const tracosBase = {
      20: { cimentoKg: 300, areiaKg: 975, britaKg: 1230, aguaL: 180, aditivoL: 2.4 },
      25: { cimentoKg: 340, areiaKg: 930, britaKg: 1190, aguaL: 175, aditivoL: 2.7 },
      30: { cimentoKg: 380, areiaKg: 870, britaKg: 1160, aguaL: 170, aditivoL: 3.0 },
      35: { cimentoKg: 420, areiaKg: 825, britaKg: 1130, aguaL: 165, aditivoL: 3.4 },
      40: { cimentoKg: 460, areiaKg: 780, britaKg: 1090, aguaL: 160, aditivoL: 3.8 }
    };
    const b = tracosBase[f] || tracosBase[25];
    return {
      totalBateladas: Math.ceil(v / 8),
      cimentoKg: Math.round(b.cimentoKg * v),
      areiaKg: Math.round(b.areiaKg * v),
      britaKg: Math.round(b.britaKg * v),
      aguaL: Math.round(b.aguaL * v),
      aditivoL: +(b.aditivoL * v).toFixed(1),
      pesoTotalKg: Math.round((b.cimentoKg + b.areiaKg + b.britaKg + b.aguaL) * v)
    };
  }, [formOp.fck, formOp.volumeM3]);

  // Handlers para Operações de Ordens de Produção (OP)
  const abrirCriarOp = () => {
    const proximoNum = (ordensProducao || []).reduce((max, op) => {
      const num = parseInt(String(op.numero || '').replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 93) + 1;
    const numOp = `OP-2026-${String(proximoNum).padStart(3, '0')}`;
    setFormOp({
      numero: numOp,
      cliente: '',
      obra: '',
      endereco: 'Tangará da Serra - MT',
      fck: 25,
      volumeM3: 8,
      slumpPrevistoCm: '12 ± 2 cm',
      betoneirasEscaladas: ['BT-01'],
      operador: 'Carlos Eduardo',
      motorista: '',
      dataHora: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'programada',
      observacoes: 'Dosagem padrão NBR 7212. Ensaios de slump na obra e moldagem de CPs.'
    });
    setModalOpFormAberto({ modo: 'criar' });
  };

  const abrirEditarOp = (op) => {
    setFormOp({
      id: op.id,
      numero: op.numero,
      cliente: op.cliente || '',
      obra: op.obra || '',
      endereco: op.endereco || 'Tangará da Serra - MT',
      fck: op.fck || 25,
      volumeM3: op.volumeM3 || 8,
      slumpPrevistoCm: op.slumpPrevistoCm || '12 ± 2 cm',
      betoneirasEscaladas: op.betoneirasEscaladas && op.betoneirasEscaladas.length > 0 ? op.betoneirasEscaladas : ['BT-01'],
      operador: op.operador || 'Carlos Eduardo',
      motorista: op.motorista || '',
      dataHora: op.dataHora || '',
      status: op.status || 'programada',
      observacoes: op.observacoes || ''
    });
    setModalOpFormAberto({ modo: 'editar', op });
  };

  const abrirVisualizarOp = (op) => {
    setModalOpVisualizarAberto(op);
  };

  const abrirApontamentoOp = (op) => {
    const teo = op.consumoTeorico || {};
    const real = op.consumoRealBalança || {};
    setFormApontamentoOp({
      id: op.id,
      numero: op.numero,
      cimentoKg: real.cimentoKg || teo.cimentoKg || '',
      areiaKg: real.areiaKg || teo.areiaKg || '',
      britaKg: real.britaKg || teo.britaKg || '',
      aguaL: real.aguaL || teo.aguaL || '',
      aditivoL: real.aditivoL || teo.aditivoL || '',
      slumpMedidoCm: real.slumpMedidoCm || op.slumpMedidoCm || '12.0',
      lacreCarga: real.lacreCarga || 'LAC-2026-098',
      status: 'concluida'
    });
    setModalOpApontamentoAberto(op);
  };

  const handleSalvarOp = async (e) => {
    e.preventDefault();
    if (!formOp.cliente || !formOp.obra) {
      toast ? toast.warning('Informe o cliente e a obra!') : alert('Informe o cliente e a obra!');
      return;
    }
    setSalvandoOp(true);
    try {
      if (modalOpFormAberto?.modo === 'editar') {
        const res = await api.put(`/api/admin/concreto/ordens-producao/${formOp.id || formOp.numero}`, formOp);
        if (res?.ok) {
          setOrdensProducao(prev => prev.map(o => (o.id === res.ordemProducao.id || o.numero === res.ordemProducao.numero) ? res.ordemProducao : o));
          toast ? toast.success(`Ordem de Produção ${res.ordemProducao.numero} atualizada com sucesso!`) : alert('OP atualizada com sucesso!');
          setModalOpFormAberto(null);
        }
      } else {
        const res = await api.post('/api/admin/concreto/ordens-producao', formOp);
        if (res?.ok) {
          setOrdensProducao(prev => [res.ordemProducao, ...prev]);
          toast ? toast.success(`Ordem de Produção ${res.ordemProducao.numero} criada e programada!`) : alert('OP criada com sucesso!');
          setModalOpFormAberto(null);
        }
      }
    } catch (err) {
      console.error('Erro ao salvar OP:', err);
      toast ? toast.error('Erro ao salvar OP: ' + (err.message || 'Falha de conexão')) : alert('Erro ao salvar OP');
    } finally {
      setSalvandoOp(false);
    }
  };

  const handleSalvarApontamento = async (e) => {
    e.preventDefault();
    setSalvandoApontamento(true);
    try {
      const opId = modalOpApontamentoAberto.id || modalOpApontamentoAberto.numero;
      const res = await api.post(`/api/admin/concreto/ordens-producao/${opId}/apontamento`, formApontamentoOp);
      if (res?.ok) {
        setOrdensProducao(prev => prev.map(o => (o.id === res.ordemProducao.id || o.numero === res.ordemProducao.numero) ? res.ordemProducao : o));
        toast ? toast.success(`Pesagem real da balança para ${res.ordemProducao.numero} registrada com sucesso!`) : alert('Pesagem registrada!');
        setModalOpApontamentoAberto(null);
        carregarDados();
      }
    } catch (err) {
      console.error('Erro ao registrar pesagem:', err);
      toast ? toast.error('Erro ao registrar pesagem: ' + err.message) : alert('Erro: ' + err.message);
    } finally {
      setSalvandoApontamento(false);
    }
  };

  const handleMudarStatusOp = async (op, novoStatus) => {
    try {
      const res = await api.put(`/api/admin/concreto/ordens-producao/${op.id || op.numero}`, { status: novoStatus });
      if (res?.ok) {
        setOrdensProducao(prev => prev.map(o => (o.id === res.ordemProducao.id || o.numero === res.ordemProducao.numero) ? res.ordemProducao : o));
        toast ? toast.success(`Status da ${op.numero} alterado para ${novoStatus.toUpperCase()}!`) : alert('Status alterado!');
      }
    } catch (err) {
      toast ? toast.error('Erro ao alterar status: ' + err.message) : alert('Erro: ' + err.message);
    }
  };

  const handleExcluirOp = async (op) => {
    if (!window.confirm(`Tem certeza que deseja cancelar e excluir a Ordem de Produção ${op.numero}?`)) {
      return;
    }
    try {
      const res = await api.delete(`/api/admin/concreto/ordens-producao/${op.id || op.numero}`);
      if (res?.ok) {
        setOrdensProducao(prev => prev.filter(o => o.id !== op.id && o.numero !== op.numero));
        toast ? toast.success(`Ordem de Produção ${op.numero} excluída com sucesso!`) : alert('OP excluída com sucesso!');
      }
    } catch (err) {
      toast ? toast.error('Erro ao excluir OP: ' + err.message) : alert('Erro: ' + err.message);
    }
  };

  const handleImprimirOp = (op) => {
    const token = localStorage.getItem('sp_token') || '';
    window.open(`/api/admin/concreto/ordens-producao/${op.id || op.numero}/impressao?token=${encodeURIComponent(token)}`, '_blank');
  };

  useEffect(() => {
    carregarDados();
  }, [empresaAtiva]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/concreto/dados');
      if (res?.ok) {
        setEmpresa(res.empresa);
        setCargas(res.cargas && res.cargas.length > 0 ? res.cargas : CARGAS_PADRAO);
        setCatalogo(res.catalogo || []);
        setFrota(res.frota || []);
        setEnsaios(res.ensaios || []);
        setPropostas(res.propostas || []);
        setSilos(res.silos || []);
        setCompras(res.compras || []);
        setOrdensProducao(res.ordensProducao || []);
        setDragas(res.dragas || []);
        setPatiosMineracao(res.patiosMineracao || []);
        setVendasAgregados(res.vendasAgregados || []);
        setMedicoesObras(res.medicoesObras || []);
      }
    } catch (e) {
      toast('Erro ao carregar dados da Usina Serrano: ' + (e.message || 'Falha de conexão'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // KPIs de Alta Legibilidade (WCAG 6.4:1 / 17:1)
  const kpis = useMemo(() => {
    const volProgramado = cargas.reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
    const volConcluido = cargas.filter(c => c.status === 'concluido').reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
    const frotaOperacao = frota.filter(f => f.status !== 'disponivel').length;
    const fatTotal = cargas.reduce((acc, c) => acc + (Number(c.valorTotal) || 0), 0);
    const viagensAtivas = cargas.reduce((acc, c) => {
      const vAtivas = (c.viagens || []).filter(v => v.status === 'em_transito' || v.status === 'descarregando').length;
      return acc + vAtivas;
    }, 0);
    const percEntregue = volProgramado > 0 ? Math.round((volConcluido / volProgramado) * 100) : 0;

    return { volProgramado, volConcluido, frotaOperacao, fatTotal, viagensAtivas, percEntregue };
  }, [cargas, frota]);

  // Cargas filtradas pela busca
  const cargasFiltradas = useMemo(() => {
    if (!busca) return cargas;
    const b = busca.toLowerCase();
    return cargas.filter(c => 
      String(c.numero || '').includes(b) ||
      (c.cliente || '').toLowerCase().includes(b) ||
      (c.obra || '').toLowerCase().includes(b) ||
      (c.traco || '').toLowerCase().includes(b)
    );
  }, [cargas, busca]);

  // Toggle expansão da carga
  const toggleCarga = (id) => {
    setCargasAbertas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Linhas do Gantt da Frota (07h às 17h, 11 colunas)
  const H0 = 7;
  const SPAN = 11;
  const ganttRows = [
    { id: 'BT-01', sub: 'Marcos S.', segs: [{ a: 8, b: 10, k: 'done', t: '#1001' }, { a: 13.17, b: 14.4, k: 'done', t: '#1002' }] },
    { id: 'BT-02', sub: 'Carlos E.', segs: [{ a: 8.8, b: 10, k: 'done', t: '#1001' }, { a: 13.75, b: 15, k: 'live', t: '#1002' }] },
    { id: 'BT-03', sub: 'Valdemir O.', segs: [{ a: 9.5, b: 10.75, k: 'done', t: '#1001' }, { a: 16, b: 17, k: 'plan', t: '#1003' }] },
    { id: 'BT-04', sub: 'Roberto L.', segs: [{ a: 14.33, b: 15.3, k: 'live', t: '#1002' }, { a: 16.2, b: 17, k: 'plan', t: '#1003' }] },
    { id: 'BT-05', sub: 'Fernando S.', segs: [{ a: 15.2, b: 16.2, k: 'plan', t: '#1002' }] },
    { id: 'BL-01', sub: 'Gilberto R. · 32 m', segs: [{ a: 8, b: 10.9, k: 'pump', t: 'Laje 4º pav · #1001' }, { a: 16, b: 17, k: 'plan', t: '#1003' }] },
    { id: 'BL-02', sub: 'Claudemir C. · 36 m', segs: [{ a: 13, b: 16, k: 'plan', t: 'Deslocando' }] }
  ];

  const calcGanttPct = (h) => `${Math.max(0, Math.min(100, ((h - H0) / SPAN) * 100)).toFixed(2)}%`;
  const calcGanttWidth = (a, b) => `calc(${(((b - a) / SPAN) * 100).toFixed(2)}% - 3px)`;

  // Horário atual de Tangará da Serra (ex: 14:40 = 14 + 40/60)
  const nowHour = 14 + 40 / 60;
  const nowLeft = calcGanttPct(nowHour);

  // Dosagem NBR 7212 com compensação de água por umidade da areia
  const dosagemCalculada = useMemo(() => {
    const f = Number(calcFck) || 25;
    const v = Number(calcVolume) || 1;
    const u = Number(calcUmidadeAreia) || 0;

    const tracosBase = {
      15: { cimentoKg: 260, areiaM3: 0.68, britaM3: 0.88, aguaL: 185, aditivoL: 2.0, fatorAc: 0.65 },
      20: { cimentoKg: 300, areiaM3: 0.65, britaM3: 0.85, aguaL: 180, aditivoL: 2.4, fatorAc: 0.55 },
      25: { cimentoKg: 340, areiaM3: 0.62, britaM3: 0.82, aguaL: 175, aditivoL: 2.7, fatorAc: 0.50 },
      30: { cimentoKg: 380, areiaM3: 0.58, britaM3: 0.80, aguaL: 170, aditivoL: 3.0, fatorAc: 0.45 },
      35: { cimentoKg: 420, areiaM3: 0.55, britaM3: 0.78, aguaL: 165, aditivoL: 3.4, fatorAc: 0.42 },
      40: { cimentoKg: 460, areiaM3: 0.52, britaM3: 0.75, aguaL: 160, aditivoL: 3.8, fatorAc: 0.38 },
      45: { cimentoKg: 500, areiaM3: 0.50, britaM3: 0.72, aguaL: 155, aditivoL: 4.2, fatorAc: 0.35 }
    };
    const b = tracosBase[f] || tracosBase[25];

    const cimentoKgM3 = b.cimentoKg;
    const areiaSecaKgM3 = Math.round(b.areiaM3 * 1500);
    const britaSecaKgM3 = Math.round(b.britaM3 * 1450);
    const aguaLitrosM3 = b.aguaL;
    const aditivoLitrosM3 = b.aditivoL;

    // Correção NBR 7212
    const aguaContidaAreiaM3 = Math.round(areiaSecaKgM3 * (u / 100));
    const areiaCorrigidaM3 = Math.round(areiaSecaKgM3 * (1 + u / 100));
    const aguaCorrigidaM3 = Math.max(80, Math.round(aguaLitrosM3 - aguaContidaAreiaM3));

    return {
      cimentoTotalKg: Math.round(cimentoKgM3 * v),
      cimentoSacos50: Math.round((cimentoKgM3 * v) / 50),
      areiaTotalKg: Math.round(areiaCorrigidaM3 * v),
      areiaTotalM3: (b.areiaM3 * v).toFixed(2),
      britaTotalKg: Math.round(britaSecaKgM3 * v),
      britaTotalM3: (b.britaM3 * v).toFixed(2),
      aguaTotalL: Math.round(aguaCorrigidaM3 * v),
      aguaDescontadaL: Math.round(aguaContidaAreiaM3 * v),
      aditivoTotalL: (aditivoLitrosM3 * v).toFixed(1),
      fatorAc: b.fatorAc,
      pesoTotalCargaKg: Math.round((cimentoKgM3 + areiaCorrigidaM3 + britaSecaKgM3 + aguaCorrigidaM3) * v)
    };
  }, [calcFck, calcVolume, calcUmidadeAreia, calcBrita]);

  // Ações operacionais
  const handleCriarCarga = async (e) => {
    e.preventDefault();
    if (!formCarga.cliente || !formCarga.obra) {
      toast('Informe o cliente e o nome da obra!', 'warning');
      return;
    }
    try {
      const res = await api.post('/api/admin/concreto/cargas', formCarga);
      if (res?.ok) {
        toast(`Carga #${res.carga.numero} programada com sucesso!`, 'success');
        setModalNovaCargaAberto(false);
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao agendar carga: ' + err.message, 'error');
    }
  };

  const handleCriarProposta = async (e) => {
    e.preventDefault();
    if (!formProposta.cliente || !formProposta.obra) {
      toast('Informe o cliente e a obra para a proposta!', 'warning');
      return;
    }
    try {
      const res = await api.post('/api/admin/concreto/propostas', formProposta);
      if (res?.ok) {
        toast(`Proposta #${res.proposta.numero} gerada com sucesso!`, 'success');
        setModalNovaPropostaAberto(false);
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao criar proposta: ' + err.message, 'error');
    }
  };

  const enviarPropostaWhatsApp = (prop) => {
    const tel = String(prop.telefone || '').replace(/\D/g, '');
    const msg = `*SERRANO CONCRETO USINADO & MINERAÇÃO* 🚚\nTangará da Serra - MT\n\nOlá ${prop.contato || prop.cliente}! Segue a proposta oficial de concretagem:\n\n📋 *Proposta Comercial Nº ${prop.numero}*\n🏗️ *Obra:* ${prop.obra}\n📍 *Local:* ${prop.endereco}\n🧪 *Traço:* FCK ${prop.fck} MPa\n📊 *Volume:* ${prop.volumeM3} m³\n🚀 *Bombeamento:* ${prop.tipoBomba}\n💰 *Valor Total:* R$ ${Number(prop.totalProposta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n💳 *Condição:* ${prop.condicaoPagamento}\n\nIncluso ensaio de slump test na obra e moldagem de 4 corpos de prova com laudo assinado por nossa RT Engª Karin Prestes (CREA-MT 027300).\n\nPodemos confirmar a programação da sua concretagem?`;
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className={`serrano-wrapper ${themeDark ? 'serrano-theme-dark' : ''}`}>
      
      {/* ─── BARRA LATERAL ESPECIALIZADA DA USINA (5 ÁREAS FÍSICAS) ─── */}
      

      {/* ─── ÁREA PRINCIPAL ─── */}
      <main className="serrano-main">
        
        {/* Topbar Limpa */}
        <header className="serrano-topbar">
          <span className="serrano-crumb">
            Operação / <b>{secaoAtiva.split('-')[1]?.toUpperCase() || 'DESPACHO AO VIVO'}</b>
          </span>

          <div className="serrano-search-box">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
            <input 
              type="text" 
              placeholder="Buscar carga, cliente, obra, placa..." 
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            <kbd>Ctrl K</kbd>
          </div>

          <span className="serrano-sync">
            <span className="serrano-dot-sync"></span>
            SEFAZ sincronizado
          </span>

          <button 
            type="button" 
            className="serrano-theme-toggle"
            onClick={() => setThemeDark(prev => !prev)}
            title="Alternar entre Modo Dia e Sala de Controle"
          >
            {themeDark ? '☀️ Modo Claro' : '🌙 Sala de Controle'}
          </button>
        </header>

        {/* Page Header (Título + Ações) */}
                {/* BARRA DE NAVEGAÇÃO DE FLUXO DA USINA */}
        <nav className="serrano-nav-tabs" aria-label="Navegação da Usina">
          {[
            { id: "operacao-despacho", label: "Despacho ao Vivo", icon: "🚚", count: cargas.length },
            { id: "operacao-programacao", label: "Programação de Cargas", icon: "📅" },
            { id: "operacao-frota", label: "Frota & Telemetria", icon: "🚛", count: frota.length },
            { id: "producao-central", label: "Central Dosadora NBR 7212", icon: "🏭" },
            { id: "producao-op", label: "Ordens de Produção", icon: "📋" },
            { id: "producao-laboratorio", label: "Laboratório & CPs (NBR 5739)", icon: "🔬", count: ensaios.length },
            { id: "suprimentos-silos", label: "Mineração & Silos 96t", icon: "⛏️", count: silos.length },
            { id: "comercial-propostas", label: "Orçamentos & Propostas", icon: "💼", count: propostas.length },
            { id: "empresa-holding", label: "Holding & Dados Fiscais", icon: "🏢" },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`serrano-tab-pill ${secaoAtiva === tab.id ? "ativo" : ""}`}
              onClick={() => setSecaoAtiva(tab.id)}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="serrano-tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="serrano-ph">
          <div>
            <h1>Despacho ao vivo</h1>
            <p>Quinta-feira · {cargas.length} concretagens programadas · Prazo de pega NBR 7212: máximo 150 min após adição de água</p>
          </div>

          <div className="serrano-ph-actions">
            <button 
              type="button" 
              className="btn-serrano"
              onClick={() => setModalRomaneioAberto(cargas[0] || null)}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" strokeWidth="2"><path d="M6 3h9l4 4v14H6z"/></svg>
              Romaneios
            </button>
            <button 
              type="button" 
              className="btn-serrano pri"
              onClick={() => setModalNovaCargaAberto(true)}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Nova concretagem
            </button>
          </div>
        </div>

        {/* ─── 4 KPIS DE ALTA VISIBILIDADE ─── */}
        <div className="serrano-kpis">
          <div className="serrano-kpi">
            <small>Volume do dia</small>
            <b>{kpis.volConcluido}<em>/ {kpis.volProgramado} m³</em></b>
            <div className="serrano-bar">
              <i style={{ width: `${kpis.percEntregue}%` }}></i>
            </div>
            <span>{kpis.percEntregue}% do volume entregue</span>
          </div>

          <div className="serrano-kpi">
            <small>Frota em operação</small>
            <b>{kpis.frotaOperacao}<em>/ {frota.length}</em></b>
            <div className="serrano-bar">
              <i style={{ width: `${Math.round((kpis.frotaOperacao / Math.max(1, frota.length)) * 100)}%` }}></i>
            </div>
            <span>5 betoneiras · 2 bombas lança</span>
          </div>

          <div className="serrano-kpi">
            <small>Viagens em rota</small>
            <b>{kpis.viagensAtivas}</b>
            <span><span className="serrano-pill serrano-p-ok">todas no prazo</span></span>
          </div>

          <div className="serrano-kpi">
            <small>Faturamento do dia</small>
            <b>R$ {kpis.fatTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b>
            <span>Usinado + bombeamento</span>
          </div>
        </div>

        {/* ─── ESCALA DA FROTA / GANTT INDUSTRIAL (07h às 17h) ─── */}
        {secaoAtiva === 'operacao-despacho' && (
          <>
            <div className="serrano-card">
              <div className="serrano-card-h">
                <h3>Escala da frota</h3>
                <div className="serrano-legend">
                  <span><i className="serrano-lg-box" style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)' }}></i>Concluído</span>
                  <span><i className="serrano-lg-box" style={{ background: 'var(--serrano-orange)' }}></i>Em rota / descarregando</span>
                  <span><i className="serrano-lg-box" style={{ background: 'var(--carbon)' }}></i>Bomba na obra</span>
                  <span><i className="serrano-lg-box" style={{ border: '1.5px dashed var(--text-muted)' }}></i>Programado</span>
                </div>
              </div>

              <div className="serrano-gantt">
                {/* Cabeçalho de Horas */}
                <div></div>
                <div className="serrano-g-hours">
                  {Array.from({ length: SPAN }, (_, i) => (
                    <span key={i}>{String(H0 + i).padStart(2, '0')}h</span>
                  ))}
                </div>

                {/* Linhas de Cada Veículo */}
                {ganttRows.map((r, ri) => (
                  <React.Fragment key={r.id}>
                    <div className="serrano-g-lab">
                      <b>{r.id}</b>
                      <small>{r.sub}</small>
                    </div>
                    <div className="serrano-g-track">
                      {r.segs.map((s, si) => (
                        <div
                          key={si}
                          className={`serrano-seg ${s.k}`}
                          style={{
                            left: calcGanttPct(s.a),
                            width: calcGanttWidth(s.a, s.b)
                          }}
                          title={s.t}
                        >
                          {s.t}
                        </div>
                      ))}
                      {/* Marcador Vermelho da Hora Atual */}
                      <div 
                        className="serrano-now-line" 
                        style={{ left: nowLeft }} 
                        data-time={ri === 0 ? '14:40' : ''}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* ─── TABELA DE CARGAS DE HOJE (EXPANSÍVEL) ─── */}
            <div className="serrano-card">
              <div className="serrano-card-h">
                <h3>Cargas de hoje</h3>
                <span className="serrano-legend" style={{ marginLeft: 'auto' }}>
                  Prazo de pega: 
                  <span><i className="serrano-lg-box" style={{ background: 'var(--status-ok)' }}></i>&lt; 90 min</span>
                  <span><i className="serrano-lg-box" style={{ background: 'var(--status-warn)' }}></i>90–120 min</span>
                  <span><i className="serrano-lg-box" style={{ background: 'var(--status-crit)' }}></i>&gt; 120 min (limite 150m)</span>
                </span>
              </div>

              <div className="serrano-loads-table">
                {/* Header da Tabela */}
                <div className="serrano-row head">
                  <span>Carga</span>
                  <span>Obra / cliente</span>
                  <span>Traço</span>
                  <span className="serrano-num">Volume</span>
                  <span>Descarga</span>
                  <span className="serrano-num">Valor</span>
                  <span>Status</span>
                  <span></span>
                </div>

                {/* Linhas de Cargas */}
                {cargasFiltradas.map((c, i) => {
                  const idCode = `#${c.numero || 1001 + i}`;
                  const isOpen = !!cargasAbertas[idCode];
                  const statusPillClass = 
                    c.status === 'concluido' ? 'serrano-p-ok' :
                    c.status === 'em_transito' ? 'serrano-p-live' :
                    c.status === 'carregando' ? 'serrano-p-load' : 'serrano-p-warn';

                  return (
                    <React.Fragment key={c.id || i}>
                      <button
                        type="button"
                        className="serrano-row"
                        aria-expanded={isOpen}
                        onClick={() => toggleCarga(idCode)}
                      >
                        <span className="id-code">{idCode}</span>
                        <span className="obra-info">
                          <b>{c.obra}</b>
                          <small>{c.cliente}</small>
                        </span>
                        <span>
                          {String(c.fck || '').startsWith('FCK') ? c.fck : `FCK ${c.fck} MPa · ${c.brita || 'Brita 1'}`}
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>slump {c.slump || '14 ± 2 cm'}</small>
                        </span>
                        <span className="serrano-num">{c.volumeM3} m³</span>
                        <span>{c.bomba || 'Direta · calha'}</span>
                        <span className="serrano-num">
                          R$ {Number(c.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span>
                          <span className={`serrano-pill ${statusPillClass}`}>
                            {c.status === 'concluido' ? 'Concluída' : c.status === 'em_transito' ? 'Em trânsito' : c.status === 'carregando' ? 'Carregando' : 'Agendada'}
                          </span>
                        </span>
                        <svg className="serrano-chev" viewBox="0 0 24 24">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>

                      {/* Painel Expansível de Viagens da Carga */}
                      {isOpen && (
                        <div className="serrano-trips-panel">
                          {(c.viagens && c.viagens.length > 0 ? c.viagens : [
                            { veiculo: 'BT-01', saidaUsina: '08:15', chegadaObra: '08:35', fimDescarga: '09:20', pegaMinutos: null },
                            { veiculo: 'BT-02', saidaUsina: '08:50', chegadaObra: '09:10', fimDescarga: '10:00', pegaMinutos: null },
                            { veiculo: 'BT-03', saidaUsina: '09:30', chegadaObra: '09:55', fimDescarga: '10:45', pegaMinutos: null }
                          ]).map((v, vi) => {
                            const isDone = v.fimDescarga && v.fimDescarga !== '—';
                            const step = !v.saidaUsina || v.saidaUsina === '—' ? 0 : !v.chegadaObra || v.chegadaObra === '—' ? 1 : !v.fimDescarga || v.fimDescarga === '—' ? 2 : 3;
                            const pegaMin = v.pegaMinutos || (v.veiculo === 'BT-02' ? 65 : v.veiculo === 'BT-04' ? 30 : null);
                            const pegaClass = pegaMin < 90 ? 'ok' : pegaMin <= 120 ? 'warn' : 'crit';

                            return (
                              <div key={vi} className="serrano-trip-card">
                                <div className="serrano-trip-h">
                                  <b>{v.veiculo}</b>
                                  <span className={`serrano-pill ${isDone ? 'serrano-p-ok' : step === 0 ? 'serrano-p-load' : 'serrano-p-live'}`}>
                                    {isDone ? 'Retornou' : step === 0 ? 'Aguardando' : step === 1 ? 'Em rota' : 'Descarregando'}
                                  </span>
                                </div>

                                <div className="serrano-steps">
                                  <div className={step > 0 ? (step === 1 && !isDone ? 'cur' : 'ok') : ''}>
                                    Saída<b>{v.saidaUsina || '—'}</b>
                                  </div>
                                  <div className={step > 1 ? (step === 2 && !isDone ? 'cur' : 'ok') : ''}>
                                    Chegada<b>{v.chegadaObra || '—'}</b>
                                  </div>
                                  <div className={step > 2 ? 'ok' : ''}>
                                    Descarga<b>{v.fimDescarga || '—'}</b>
                                  </div>
                                </div>

                                {/* Medidor de Pega NBR 7212 */}
                                {pegaMin !== null && (
                                  <div className="serrano-pega">
                                    <span>Pega NBR 7212</span>
                                    <div className="serrano-bar">
                                      <i className={pegaClass} style={{ width: `${Math.min(100, (pegaMin / 150) * 100)}%` }}></i>
                                    </div>
                                    <b style={{ fontFamily: 'var(--font-data)' }}>{pegaMin}/150 min</b>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* BARRA DE AÇÕES OPERACIONAIS DA CARGA (ROMANEIO & ASSINATURA) */}
                          <div style={{ gridColumn: '1 / -1', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--joint)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {c.assinaturaEntrega?.status === 'assinado' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#DCFCE7', color: '#15803D', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                                  ✓ Assinado na Entrega ({c.assinaturaEntrega.recebedorNome})
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEF3C7', color: '#92400E', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                                  ⏳ Aguardando Assinatura do Cliente
                                </span>
                              )}
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Balança Toledo 80t: <b>{c.ticketPesagem?.numeroTicket || `TKT-BAL-${c.numero}`}</b>
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="btn-serrano"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                onClick={() => setModalRomaneioAberto(c)}
                              >
                                📄 Romaneio &amp; Balança
                              </button>

                              <button
                                type="button"
                                className="btn-serrano pri"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                onClick={() => abrirColetaAssinatura(c)}
                              >
                                ✍️ {c.assinaturaEntrega?.status === 'assinado' ? 'Reassinar / Visualizar' : 'Assinar Entrega'}
                              </button>

                              <button
                                type="button"
                              className="btn-serrano"
                              style={{ padding: '6px 12px', fontSize: 12 }}
                              onClick={() => {
                                const token = localStorage.getItem('sp_token') || '';
                                window.open(`/api/admin/concreto/cargas/${c.id}/romaneio-html?formato=html&token=${encodeURIComponent(token)}`, '_blank');
                              }}
                              title="Imprimir Romaneio Oficial A4"
                            >
                                🖨️ Imprimir
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ─── ABA 2: PRODUÇÃO & CENTRAL DOSADORA NBR 7212 ─── */}
        {secaoAtiva === 'producao-central' && (
          <div className="serrano-grid-2col">
            <div className="serrano-card">
              <div className="serrano-card-h">
                <h3>Central Dosadora Automatizada NBR 7212</h3>
              </div>
              <div style={{ padding: 20 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                  Simulador de pesagem e compensação de água por umidade da areia em conformidade com as normas ABNT NBR 7212 e NBR 6118.
                </p>

                <div className="serrano-form-row">
                  <label>Resistência Característica (FCK)</label>
                  <select 
                    className="serrano-input"
                    value={calcFck}
                    onChange={e => setCalcFck(Number(e.target.value))}
                  >
                    <option value={15}>FCK 15 MPa · Concreto Magro</option>
                    <option value={20}>FCK 20 MPa · Pisos e Baldrames</option>
                    <option value={25}>FCK 25 MPa · Lajes, Vigas e Pilares</option>
                    <option value={30}>FCK 30 MPa · Estrutural Pesado</option>
                    <option value={35}>FCK 35 MPa · Pisos Industriais de Alta Abrasão</option>
                    <option value={40}>FCK 40 MPa · Obras Especiais e Pontes</option>
                    <option value={45}>FCK 45 MPa · Concreto de Alto Desempenho (CAD)</option>
                  </select>
                </div>

                <div className="serrano-form-row">
                  <label>Volume do Carregamento (m³)</label>
                  <input 
                    type="number" 
                    className="serrano-input"
                    value={calcVolume}
                    min={1}
                    max={12}
                    onChange={e => setCalcVolume(Number(e.target.value))}
                  />
                </div>

                <div className="serrano-form-row">
                  <label>
                    Umidade da Areia (%): <b>{calcUmidadeAreia}%</b>
                    <small style={{ marginLeft: 8, color: 'var(--serrano-orange-text)' }}>
                      (Desconta {dosagemCalculada.aguaDescontadaL}L de água automaticamente)
                    </small>
                  </label>
                  <input 
                    type="range" 
                    className="serrano-slider"
                    min="0" 
                    max="10" 
                    step="0.5"
                    value={calcUmidadeAreia}
                    onChange={e => setCalcUmidadeAreia(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Resultado da Dosagem */}
            <div className="serrano-card">
              <div className="serrano-card-h">
                <h3>Ordem de Pesagem dos Silos (Traço Corrigido)</h3>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Cimento CP II-F-32</small>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>
                      {dosagemCalculada.cimentoTotalKg.toLocaleString('pt-BR')} kg
                    </div>
                    <small style={{ color: 'var(--text-muted)' }}>{dosagemCalculada.cimentoSacos50} sacos de 50kg</small>
                  </div>

                  <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Areia Média Lavada (Corrigida)</small>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>
                      {dosagemCalculada.areiaTotalKg.toLocaleString('pt-BR')} kg
                    </div>
                    <small style={{ color: 'var(--text-muted)' }}>{dosagemCalculada.areiaTotalM3} m³</small>
                  </div>

                  <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Brita 1 Granítica</small>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>
                      {dosagemCalculada.britaTotalKg.toLocaleString('pt-BR')} kg
                    </div>
                    <small style={{ color: 'var(--text-muted)' }}>{dosagemCalculada.britaTotalM3} m³</small>
                  </div>

                  <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Água Efetiva (Hidrômetro)</small>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--status-info)' }}>
                      {dosagemCalculada.aguaTotalL.toLocaleString('pt-BR')} L
                    </div>
                    <small style={{ color: 'var(--status-warn)' }}>Descontados {dosagemCalculada.aguaDescontadaL}L da umidade</small>
                  </div>
                </div>

                <div style={{ marginTop: 18, borderTop: '1px solid var(--joint)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Peso Total da Carga:</span>
                  <b style={{ fontFamily: 'var(--font-data)', fontSize: 16 }}>
                    {(dosagemCalculada.pesoTotalCargaKg / 1000).toFixed(2)} toneladas
                  </b>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 3: LABORATÓRIO & CPS NBR 5738/5739 ─── */}
        {secaoAtiva === 'producao-laboratorio' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <h3>Controle Tecnológico &amp; Ensaios de Ruptura (NBR 5738 e 5739)</h3>
              <span className="serrano-legend">
                RT: <b>Engª Karin Prestes (CREA-MT 027300)</b>
              </span>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {ensaios.map(ens => (
                  <div key={ens.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <b style={{ fontFamily: 'var(--font-data)', fontSize: 14 }}>{ens.lote}</b>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ens.obra}</div>
                        <small style={{ color: 'var(--text-muted)' }}>Cliente: {ens.cliente}</small>
                      </div>
                      <span className={`serrano-pill ${ens.status === 'aprovado' ? 'serrano-p-ok' : 'serrano-p-warn'}`}>
                        {ens.status === 'aprovado' ? 'Aprovado 28d' : 'Em cura'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '14px 0' }}>
                      {ens.corposProva.map(cp => (
                        <div key={cp.id} style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 6, padding: 8, textAlign: 'center' }}>
                          <small style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-muted)' }}>{cp.id} ({cp.idadeDias}d)</small>
                          <div style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                            {cp.tensaoMpa ? `${cp.tensaoMpa} MPa` : 'Em cura'}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--joint)', paddingTop: 10, marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>FCK Projeto: <b>{ens.fckProjeto} MPa</b></span>
                      <button 
                        type="button" 
                        className="btn-serrano"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={() => setModalLaudoAberto(ens)}
                      >
                        Ver Laudo NBR 5739
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 4: SUPRIMENTOS & SILOS 96T ─── */}
        {secaoAtiva === 'suprimentos-silos' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <h3>Serrano Mineração &amp; Silos Convicta 96t (Pátio da Usina)</h3>
            </div>
            <div className="serrano-silos-grid">
              {(silos.length > 0 ? silos : [
                { id: 'sil-01', nome: 'Silo Cimento CP II-F-32', capacidadeTon: 96, nivelAtualTon: 68, percentual: 71, produto: 'Cimento CP II-F-32' },
                { id: 'sil-02', nome: 'Silo Cimento CP V-ARI', capacidadeTon: 60, nivelAtualTon: 42, percentual: 70, produto: 'Cimento CP V Alta Resistência' },
                { id: 'bx-01', nome: 'Baia Areia Média Lavada', capacidadeTon: 450, nivelAtualTon: 320, percentual: 71, produto: 'Areia de Dragagem Rio Sepotuba' },
                { id: 'bx-02', nome: 'Baia Brita 1 Basáltica', capacidadeTon: 400, nivelAtualTon: 285, percentual: 71, produto: 'Brita 1 Granítica 9,5 a 19mm' },
                { id: 'bx-03', nome: 'Baia Brita 0 (Pedrisco)', capacidadeTon: 300, nivelAtualTon: 190, percentual: 63, produto: 'Pedrisco para Bombeamento' }
              ]).map((s, idx) => (
                <div key={s.id || idx} className="serrano-silo-card">
                  <div className="serrano-silo-bar-wrap">
                    <div className="serrano-silo-fill" style={{ height: `${s.percentual || 70}%` }}></div>
                  </div>
                  <b style={{ fontSize: 12 }}>{s.nome}</b>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 14, fontWeight: 700, color: 'var(--serrano-orange-text)' }}>
                    {s.nivelAtualTon} / {s.capacidadeTon} ton
                  </div>
                  <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>{s.percentual || 70}% de ocupação</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── ABA 5: COMERCIAL & ORÇAMENTOS ─── */}
        {secaoAtiva === 'comercial-propostas' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <h3>Orçamentos &amp; Propostas Comerciais de Concretagem</h3>
              <button 
                type="button" 
                className="btn-serrano pri"
                style={{ marginLeft: 'auto' }}
                onClick={() => setModalNovaPropostaAberto(true)}
              >
                + Nova Proposta
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {propostas.map(p => (
                  <div key={p.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ fontFamily: 'var(--font-data)', fontSize: 14 }}>Proposta #{p.numero}</b>
                        <span className="serrano-pill serrano-p-ok">Aprovada</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{p.obra}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cliente: {p.cliente} · {p.contato} ({p.telefone})</div>
                      <small style={{ color: 'var(--text-muted)' }}>
                        FCK {p.fck} MPa · {p.volumeM3} m³ · {p.tipoBomba}
                      </small>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>
                        R$ {Number(p.totalProposta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <button 
                        type="button" 
                        className="btn-serrano"
                        style={{ background: '#25D366', color: '#FFFFFF', borderColor: '#25D366', fontWeight: 700 }}
                        onClick={() => enviarPropostaWhatsApp(p)}
                      >
                        Enviar WhatsApp
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 6: HOLDING & DADOS FISCAIS SEFAZ ─── */}
        {secaoAtiva === 'empresa-holding' && (
          <div className="serrano-grid-2col">
            <div className="serrano-card">
              <div className="serrano-card-h">
                <h3>Serrano Concreto &amp; Mineração · Dados Oficiais</h3>
              </div>
              <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                <div><small style={{ color: 'var(--text-muted)' }}>Razão Social:</small> <b style={{ display: 'block' }}>SERRANO CONCRETO USINADO &amp; MINERAÇÃO LTDA</b></div>
                <div><small style={{ color: 'var(--text-muted)' }}>CNPJ Matriz:</small> <b style={{ display: 'block', fontFamily: 'var(--font-data)' }}>51.499.928/0001-01</b></div>
                <div><small style={{ color: 'var(--text-muted)' }}>CNPJ Usinado:</small> <b style={{ display: 'block', fontFamily: 'var(--font-data)' }}>53.798.485/0001-77</b></div>
                <div><small style={{ color: 'var(--text-muted)' }}>Inscrição Estadual (SEFAZ-MT):</small> <b style={{ display: 'block', fontFamily: 'var(--font-data)' }}>14.229.191-9</b></div>
                <div><small style={{ color: 'var(--text-muted)' }}>Registro ANTT (RNTRC):</small> <b style={{ display: 'block', fontFamily: 'var(--font-data)' }}>056256077</b></div>
                <div><small style={{ color: 'var(--text-muted)' }}>Responsável Técnica (RT):</small> <b style={{ display: 'block', color: 'var(--status-ok)' }}>Engª Karin Prestes (CREA-MT 027300)</b></div>
              </div>
            </div>

            <div className="serrano-card">
              <div className="serrano-card-h">
                <h3>Holding Serrano &amp; Palatare Participações S/A</h3>
              </div>
              <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Consolidação corporativa do Grupo Serrano &amp; Palatare, unificando a usina dosadora de concreto, mineração de agregados do Rio Sepotuba e a rede de restaurantes e food service em Tangará da Serra/MT.
                </p>
                <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                  <b style={{ display: 'block', fontSize: 14 }}>Barramento SEFAZ-MT: Ativo e Sincronizado</b>
                  <small style={{ color: 'var(--status-ok)' }}>● Emissão autorizada de CT-e, Romaneios NBR 7212 e MDF-e de frota própria</small>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ─── ABA 1B: PROGRAMAÇÃO DE CONCRETAGENS ─── */}
        {secaoAtiva === 'operacao-programacao' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <div>
                <h3>Programação de Concretagens Futuras &amp; Calendário de Obras</h3>
                <small style={{ color: 'var(--text-muted)' }}>Escalação antecipada de frotas e reserva de traços estruturais</small>
              </div>
              <button 
                type="button" 
                className="btn-serrano pri"
                style={{ marginLeft: 'auto' }}
                onClick={() => setModalNovaCargaAberto(true)}
              >
                + Nova Concretagem
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {cargas.map((c, i) => (
                  <div key={c.id || i} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ fontFamily: 'var(--font-data)', fontSize: 14 }}>#{c.numero || 1001 + i}</b>
                        <span className="serrano-pill serrano-p-ok">{c.status === 'concluido' ? 'Concluída' : 'Agendada'}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>Horário: {c.horarioAgendado || '08:30'}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{c.obra}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cliente: {c.cliente} · {c.endereco}</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        <b>{String(c.fck || '').startsWith('FCK') ? c.fck : `FCK ${c.fck} MPa`}</b> · Volume: <b>{c.volumeM3} m³</b> · Bomba: <b>{c.bomba || 'Calha Direta'}</b>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                        R$ {Number(c.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <button 
                        type="button" 
                        className="btn-serrano"
                        style={{ marginTop: 6 }}
                        onClick={() => setModalRomaneioAberto(c)}
                      >
                        Romaneio NBR 7212
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 1C: FROTA & TELEMETRIA ─── */}
        {secaoAtiva === 'operacao-frota' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <div>
                <h3>Frota Ativa · Betoneiras &amp; Caminhões Bomba Lança</h3>
                <small style={{ color: 'var(--text-muted)' }}>Telemetria em tempo real, horímetro e status operacional em Tangará da Serra</small>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {(frota.length > 0 ? frota : [
                  { id: 'BT-01', tipo: 'Betoneira 8 m³', placa: 'RRA-4E80', chassi: 'VW Constellation 26.280', motorista: 'Marcos Silveira', status: 'em_rota', km: 48250, horimetro: '3.120h' },
                  { id: 'BT-02', tipo: 'Betoneira 8 m³', placa: 'RRA-4E81', chassi: 'VW Constellation 26.280', motorista: 'Carlos Eduardo Santos', status: 'em_rota', km: 51320, horimetro: '3.450h' },
                  { id: 'BT-03', tipo: 'Betoneira 8 m³', placa: 'RRA-4E82', chassi: 'VW Constellation 26.280', motorista: 'Valdemir Oliveira', status: 'disponivel', km: 42100, horimetro: '2.890h' },
                  { id: 'BT-04', tipo: 'Betoneira 10 m³', placa: 'RRB-1A10', chassi: 'Mercedes-Benz Axor 3131', motorista: 'Roberto Lima', status: 'em_rota', km: 38400, horimetro: '2.410h' },
                  { id: 'BT-05', tipo: 'Betoneira 10 m³', placa: 'RRB-1A11', chassi: 'Mercedes-Benz Axor 3131', motorista: 'Fernando Souza', status: 'carregando', km: 35100, horimetro: '2.150h' },
                  { id: 'BL-01', tipo: 'Bomba Lança 32 m', placa: 'RRC-9F32', chassi: 'Scania P310 8x4', motorista: 'Gilberto Ramos (Operador RT)', status: 'na_obra', km: 29800, horimetro: '1.980h' },
                  { id: 'BL-02', tipo: 'Bomba Lança 36 m', placa: 'RRC-9F36', chassi: 'Scania P360 8x4', motorista: 'Claudemir Castro (Operador RT)', status: 'deslocando', km: 21400, horimetro: '1.450h' }
                ]).map((f, idx) => (
                  <div key={f.id || idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontFamily: 'var(--font-data)', fontSize: 16, color: 'var(--serrano-orange-text)' }}>{f.id}</b>
                      <span className={`serrano-pill ${f.status === 'em_rota' ? 'serrano-p-live' : f.status === 'na_obra' ? 'serrano-p-ok' : 'serrano-p-load'}`}>
                        {f.status === 'em_rota' ? 'Em Rota' : f.status === 'na_obra' ? 'Bomba na Obra' : f.status === 'carregando' ? 'Carregando' : 'Disponível'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{f.tipo}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.chassi} · Placa: <b>{f.placa}</b></div>
                    <div style={{ fontSize: 12, marginTop: 8 }}>Motorista / Operador: <b>{f.motorista}</b></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--joint)', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>Horímetro: <b>{f.horimetro || '2.800h'}</b></span>
                      <span>Odômetro: <b>{f.km ? `${Number(f.km).toLocaleString('pt-BR')} km` : '42.000 km'}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 2B: ORDENS DE PRODUÇÃO (OPS) ─── */}
        {secaoAtiva === 'producao-op' && (
          <div className="serrano-card">
            <div className="serrano-card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3>📋 Central de Ordens de Produção (OP) · Dosagem NBR 7212</h3>
                <small style={{ color: 'var(--text-muted)' }}>Planejamento, edição, pesagem estequiométrica dos silos e rastreabilidade total de concreto</small>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-serrano pri"
                  onClick={abrirCriarOp}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
                >
                  <span>+</span> Nova Ordem de Produção (OP)
                </button>
              </div>
            </div>

            {/* KPIs de Produção */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--joint)', background: 'var(--surface-2)' }}>
              <div style={{ background: 'var(--card-bg, #fff)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--joint)' }}>
                <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Total de OPs Hoje</small>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--serrano-orange-text)' }}>
                  {(ordensProducao && ordensProducao.length > 0 ? ordensProducao : [1,2,3]).length} OPs
                </div>
              </div>
              <div style={{ background: 'var(--card-bg, #fff)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--joint)' }}>
                <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Volume Programado</small>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>
                  {(ordensProducao && ordensProducao.length > 0 ? ordensProducao : [
                    { volumeM3: 24 }, { volumeM3: 32 }, { volumeM3: 16 }
                  ]).reduce((acc, o) => acc + (Number(o.volumeM3) || 0), 0)} m³
                </div>
              </div>
              <div style={{ background: 'var(--card-bg, #fff)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--joint)' }}>
                <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Bateladas em Usina</small>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#2563EB' }}>
                  {(ordensProducao && ordensProducao.length > 0 ? ordensProducao : [
                    { totalBateladas: 3 }, { totalBateladas: 4 }, { totalBateladas: 2 }
                  ]).reduce((acc, o) => acc + (Number(o.totalBateladas) || Math.ceil((Number(o.volumeM3) || 8) / 8)), 0)} Bateladas
                </div>
              </div>
              <div style={{ background: 'var(--card-bg, #fff)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--joint)' }}>
                <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Concluídas</small>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#16A34A' }}>
                  {(ordensProducao || []).filter(o => o.status === 'concluida').length} OPs
                </div>
              </div>
            </div>

            {/* Filtros e Busca Rápida */}
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--joint)' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'todos', label: 'Todas as OPs' },
                  { id: 'programada', label: 'Programadas' },
                  { id: 'em_pesagem', label: 'Pesagem Silos' },
                  { id: 'concluida', label: 'Concluídas' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`btn-serrano ${filtroOpStatus === f.id ? 'pri' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setFiltroOpStatus(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ minWidth: 260, flex: '1 1 auto', maxWidth: 400 }}>
                <input
                  type="text"
                  className="serrano-input"
                  placeholder="🔍 Buscar por OP, obra, cliente ou betoneira..."
                  value={buscaOpTermo}
                  onChange={e => setBuscaOpTermo(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {((ordensProducao.length > 0 ? ordensProducao : [
                  { id: 'op-091', numero: 'OP-2026-091', dataHora: '2026-11-12 08:30:00', obra: 'Edifício Residencial Serra Dourada · Lajes 4º Pav.', cliente: 'Construtora MT Horizon', endereco: 'Rua das Flores, 1400 · Tangará da Serra/MT', fck: 30, volumeM3: 24, totalBateladas: 3, betoneirasEscaladas: ['BT-01', 'BT-02', 'BT-03'], status: 'concluida', operador: 'Carlos Eduardo', motorista: 'Marcos Silveira', consumoTeorico: { cimentoKg: 9120, areiaKg: 20880, britaKg: 27840, aguaL: 4080, aditivoL: 72 }, consumoRealBalança: { cimentoKg: 9150, areiaKg: 20900, britaKg: 27800, aguaL: 4080, aditivoL: 72, slumpMedidoCm: 14.0 } },
                  { id: 'op-092', numero: 'OP-2026-092', dataHora: '2026-11-12 13:45:00', obra: 'Piso Industrial Galpão de Cargas · Etapa 2', cliente: 'AgroLog Transportes & Logística', endereco: 'Distrito Industrial · Tangará da Serra/MT', fck: 35, volumeM3: 32, totalBateladas: 4, betoneirasEscaladas: ['BT-04', 'BT-05'], status: 'em_pesagem', operador: 'Carlos Eduardo', motorista: 'Roberto Lima', consumoTeorico: { cimentoKg: 13440, areiaKg: 26400, britaKg: 36160, aguaL: 5280, aditivoL: 108.8 } },
                  { id: 'op-093', numero: 'OP-2026-093', dataHora: '2026-11-12 16:15:00', obra: 'Casa Térrea Lote 12 Qd. 08 · Vigas e Baldrames', cliente: 'Eng. Marcelo Dantas', endereco: 'Jardim dos Ipês · Tangará da Serra/MT', fck: 25, volumeM3: 16, totalBateladas: 2, betoneirasEscaladas: ['BT-03'], status: 'programada', operador: 'Marcos Vinicius', motorista: 'Valdemir Oliveira', consumoTeorico: { cimentoKg: 5440, areiaKg: 14880, britaKg: 19040, aguaL: 2800, aditivoL: 43.2 } }
                ])).filter(op => {
                  if (filtroOpStatus !== 'todos') {
                    if (filtroOpStatus === 'em_pesagem' && op.status !== 'em_pesagem') return false;
                    if (filtroOpStatus === 'concluida' && op.status !== 'concluida') return false;
                    if (filtroOpStatus === 'programada' && (op.status !== 'programada' && op.status !== 'planejada')) return false;
                  }
                  if (buscaOpTermo.trim()) {
                    const t = buscaOpTermo.toLowerCase();
                    const n = String(op.numero || '').toLowerCase();
                    const c = String(op.cliente || '').toLowerCase();
                    const o = String(op.obra || '').toLowerCase();
                    const v = (op.betoneirasEscaladas || []).join(' ').toLowerCase();
                    return n.includes(t) || c.includes(t) || o.includes(t) || v.includes(t);
                  }
                  return true;
                }).map((op, idx) => {
                  const teo = op.consumoTeorico || {};
                  const real = op.consumoRealBalança || null;
                  return (
                    <div key={op.id || op.numero || idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      {/* Cabeçalho da Linha */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-data)', fontSize: 16, fontWeight: 900, color: 'var(--serrano-orange-text)', background: 'rgba(234, 88, 12, 0.08)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(234, 88, 12, 0.2)' }}>
                            {op.numero}
                          </span>
                          <span className={`serrano-pill ${op.status === 'concluida' ? 'serrano-p-ok' : op.status === 'em_pesagem' ? 'serrano-p-live' : 'serrano-p-load'}`}>
                            {op.status === 'concluida' ? 'Concluída' : op.status === 'em_pesagem' ? 'Pesagem dos Silos' : op.status === 'cancelada' ? 'Cancelada' : 'Programada'}
                          </span>
                          <small style={{ color: 'var(--text-muted)' }}>🕒 {op.dataHora}</small>
                          <small style={{ color: 'var(--text-muted)', background: 'var(--card-bg, #fff)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--joint)' }}>
                            👤 Operador: <b>{op.operador || 'Carlos Eduardo'}</b>
                          </small>
                        </div>

                        {/* Ações da OP */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => abrirVisualizarOp(op)}
                            title="Visualizar ficha técnica e dosagem estequiométrica"
                          >
                            👁️ Detalhes
                          </button>
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => abrirEditarOp(op)}
                            title="Editar / Modificar dados da Ordem de Produção"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }}
                            onClick={() => abrirApontamentoOp(op)}
                            title="Registrar pesagem real dos silos na balança e slump medido"
                          >
                            ⚖️ Apontar Silos
                          </button>
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleImprimirOp(op)}
                            title="Imprimir Ficha Técnica Oficial NBR 7212 (A4)"
                          >
                            🖨️ Ficha A4
                          </button>
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ padding: '6px 8px', fontSize: 12, color: '#DC2626' }}
                            onClick={() => handleExcluirOp(op)}
                            title="Cancelar / Excluir OP"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Dados da Obra & Cliente */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>{op.obra}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                            Cliente: <b>{op.cliente}</b> {op.endereco ? `· ${op.endereco}` : ''}
                          </div>
                        </div>

                        <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div>
                            Traço: <b style={{ color: 'var(--serrano-orange-text)' }}>FCK {op.fck} MPa</b> · Volume: <b>{op.volumeM3} m³</b> ({op.totalBateladas || Math.ceil(op.volumeM3 / 8)} batelada(s) de 8m³)
                          </div>
                          <div>
                            🚚 Betoneiras: <b>{(op.betoneirasEscaladas || []).join(', ') || 'BT-01'}</b> {op.motorista ? `(Motorista: ${op.motorista})` : ''}
                          </div>
                          <div>
                            📐 Slump Test: Previsto: <b>{op.slumpPrevistoCm || '12 ± 2 cm'}</b>
                            {real?.slumpMedidoCm && (
                              <span style={{ marginLeft: 8, color: '#16A34A', fontWeight: 700 }}>
                                · Medido na Carga: {real.slumpMedidoCm} cm ✓
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quadro Rápido de Pesagem Teórica vs Real */}
                      <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--joint)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <b style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--text-muted)' }}>
                            Balança dos Silos &amp; Insumos Estequiométricos (NBR 7212):
                          </b>
                          {real ? (
                            <span style={{ color: '#16A34A', fontWeight: 800, fontSize: 11 }}>✓ Pesagem Real Apontada</span>
                          ) : (
                            <span style={{ color: '#92400E', fontWeight: 700, fontSize: 11 }}>⏳ Aguardando Pesagem na Balança</span>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Cimento CP II:</span><br />
                            <b>{Number(teo.cimentoKg || 0).toLocaleString('pt-BR')} kg</b>
                            {real?.cimentoKg && <span style={{ color: '#16A34A', fontSize: 11 }}> → {Number(real.cimentoKg).toLocaleString('pt-BR')} kg</span>}
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Areia Média:</span><br />
                            <b>{Number(teo.areiaKg || 0).toLocaleString('pt-BR')} kg</b>
                            {real?.areiaKg && <span style={{ color: '#16A34A', fontSize: 11 }}> → {Number(real.areiaKg).toLocaleString('pt-BR')} kg</span>}
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Brita 1:</span><br />
                            <b>{Number(teo.britaKg || 0).toLocaleString('pt-BR')} kg</b>
                            {real?.britaKg && <span style={{ color: '#16A34A', fontSize: 11 }}> → {Number(real.britaKg).toLocaleString('pt-BR')} kg</span>}
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Água Potável:</span><br />
                            <b>{Number(teo.aguaL || 0).toLocaleString('pt-BR')} L</b>
                            {real?.aguaL && <span style={{ color: '#16A34A', fontSize: 11 }}> → {Number(real.aguaL).toLocaleString('pt-BR')} L</span>}
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Aditivo Plastificante:</span><br />
                            <b>{Number(teo.aditivoL || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L</b>
                            {real?.aditivoL && <span style={{ color: '#16A34A', fontSize: 11 }}> → {Number(real.aditivoL).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L</span>}
                          </div>
                        </div>
                      </div>

                      {/* Avanço Rápido de Status */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '1px solid var(--joint)', paddingTop: 10 }}>
                        <small style={{ color: 'var(--text-muted)' }}>Mudar Status:</small>
                        {op.status !== 'programada' && (
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => handleMudarStatusOp(op, 'programada')}
                          >
                            Programada
                          </button>
                        )}
                        {op.status !== 'em_pesagem' && (
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ padding: '4px 8px', fontSize: 11, background: '#EFF6FF', color: '#1E40AF', borderColor: '#3B82F6' }}
                            onClick={() => handleMudarStatusOp(op, 'em_pesagem')}
                          >
                            Em Pesagem Silos
                          </button>
                        )}
                        {op.status !== 'concluida' && (
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ padding: '4px 8px', fontSize: 11, background: '#DCFCE7', color: '#166534', borderColor: '#22C55E' }}
                            onClick={() => handleMudarStatusOp(op, 'concluida')}
                          >
                            ✓ Concluir OP
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 3B: COMPRAS DE INSUMOS ─── */}
        {secaoAtiva === 'suprimentos-compras' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <div>
                <h3>Compras de Insumos &amp; Reposição de Silos (Suprimentos da Usina)</h3>
                <small style={{ color: 'var(--text-muted)' }}>Cimento a granel, agregados graúdos, aditivos e sílica ativa</small>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {(compras.length > 0 ? compras : [
                  { numero: 'PC-2026-041', fornecedor: 'Votorantim Cimentos (Nobres/MT)', insumo: 'Cimento CP II-F-32 Granel', quantidade: '36 ton', precoUnitario: 520, valorTotal: 18720, status: 'entregue', siloDestino: 'Silo 01' },
                  { numero: 'PC-2026-042', fornecedor: 'Basf Master Builders Solutions', insumo: 'Aditivo Plastificante MasterPozzolith', quantidade: '1.000 L', precoUnitario: 14.50, valorTotal: 14500, status: 'entregue', siloDestino: 'Reservatório Aditivos' },
                  { numero: 'PC-2026-043', fornecedor: 'Pedreira Serra Dourada (Tangará/MT)', insumo: 'Brita 1 Granítica 9,5 a 19mm', quantidade: '120 ton', precoUnitario: 68.00, valorTotal: 8160, status: 'em_transito', siloDestino: 'Baia Brita 1' },
                  { numero: 'PC-2026-044', fornecedor: 'Votorantim Cimentos (Nobres/MT)', insumo: 'Cimento CP V Alta Resistência', quantidade: '32 ton', precoUnitario: 590, valorTotal: 18880, status: 'em_transito', siloDestino: 'Silo 02' }
                ]).map((pc, idx) => (
                  <div key={pc.numero || idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ fontFamily: 'var(--font-data)', fontSize: 14 }}>{pc.numero}</b>
                        <span className={`serrano-pill ${pc.status === 'entregue' ? 'serrano-p-ok' : 'serrano-p-live'}`}>
                          {pc.status === 'entregue' ? 'Entregue no Silo' : 'Em Trânsito'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Destino: <b>{pc.siloDestino}</b></span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{pc.insumo}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fornecedor: {pc.fornecedor}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Quantidade: <b>{pc.quantidade}</b> · Unitário: <b>R$ {Number(pc.precoUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                        R$ {Number(pc.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 4B: CUSTOS & PREÇOS ─── */}
        {secaoAtiva === 'comercial-custos' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <div>
                <h3>Cálculo de Custos Industriais &amp; Precificação de Concreto (Tangará da Serra)</h3>
                <small style={{ color: 'var(--text-muted)' }}>Custo direto de insumos (BOM), frete, energia, bombeamento e margem de contribuição</small>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--joint)' }}>
                      <th style={{ padding: 10 }}>Traço / FCK</th>
                      <th style={{ padding: 10 }}>Cimento (kg)</th>
                      <th style={{ padding: 10 }}>Areia (m³)</th>
                      <th style={{ padding: 10 }}>Brita (m³)</th>
                      <th style={{ padding: 10 }}>Aditivo (L)</th>
                      <th style={{ padding: 10 }}>Custo Direto / m³</th>
                      <th style={{ padding: 10 }}>Preço Tabela / m³</th>
                      <th style={{ padding: 10 }}>Margem Bruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { fck: 'FCK 20 MPa', cim: '300 kg', areia: '0.65 m³', brita: '0.85 m³', adit: '2.4 L', custo: 248.50, preco: 380.00, margem: '34.6%' },
                      { fck: 'FCK 25 MPa (Padrão)', cim: '340 kg', areia: '0.62 m³', brita: '0.82 m³', adit: '2.7 L', custo: 274.20, preco: 410.00, margem: '33.1%' },
                      { fck: 'FCK 30 MPa (Estrutural)', cim: '380 kg', areia: '0.58 m³', brita: '0.80 m³', adit: '3.0 L', custo: 301.80, preco: 440.00, margem: '31.4%' },
                      { fck: 'FCK 35 MPa (Piso Industrial)', cim: '420 kg', areia: '0.55 m³', brita: '0.78 m³', adit: '3.4 L', custo: 332.10, preco: 480.00, margem: '30.8%' },
                      { fck: 'FCK 40 MPa (Alta Resistência)', cim: '460 kg', areia: '0.52 m³', brita: '0.75 m³', adit: '3.8 L', custo: 365.40, preco: 530.00, margem: '31.1%' }
                    ].map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--joint)' }}>
                        <td style={{ padding: 10, fontWeight: 700 }}>{row.fck}</td>
                        <td style={{ padding: 10 }}>{row.cim}</td>
                        <td style={{ padding: 10 }}>{row.areia}</td>
                        <td style={{ padding: 10 }}>{row.brita}</td>
                        <td style={{ padding: 10 }}>{row.adit}</td>
                        <td style={{ padding: 10, fontFamily: 'var(--font-data)', fontWeight: 600 }}>R$ {row.custo.toFixed(2)}</td>
                        <td style={{ padding: 10, fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--serrano-orange-text)' }}>R$ {row.preco.toFixed(2)}</td>
                        <td style={{ padding: 10 }}><span className="serrano-pill serrano-p-ok">{row.margem}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ─── MODAL: NOVA CONCRETAGEM ─── */}
      {modalNovaCargaAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card">
            <h2>Nova Concretagem (Programação de Carga)</h2>
            <form onSubmit={handleCriarCarga}>
              <div className="serrano-form-row">
                <label>Cliente / Construtora *</label>
                <input 
                  type="text" 
                  className="serrano-input"
                  required
                  placeholder="Ex: Construtora MT Horizon"
                  value={formCarga.cliente}
                  onChange={e => setFormCarga({ ...formCarga, cliente: e.target.value })}
                />
              </div>

              <div className="serrano-form-row">
                <label>Obra / Local *</label>
                <input 
                  type="text" 
                  className="serrano-input"
                  required
                  placeholder="Ex: Edifício Residencial Serra Dourada · Lajes 4º pav."
                  value={formCarga.obra}
                  onChange={e => setFormCarga({ ...formCarga, obra: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="serrano-form-row">
                  <label>Resistência (FCK)</label>
                  <select 
                    className="serrano-input"
                    value={formCarga.fck}
                    onChange={e => setFormCarga({ ...formCarga, fck: Number(e.target.value) })}
                  >
                    <option value={20}>FCK 20 MPa</option>
                    <option value={25}>FCK 25 MPa (Padrão)</option>
                    <option value={30}>FCK 30 MPa (Estrutural)</option>
                    <option value={35}>FCK 35 MPa (Piso Industrial)</option>
                  </select>
                </div>

                <div className="serrano-form-row">
                  <label>Volume Total (m³)</label>
                  <input 
                    type="number" 
                    className="serrano-input"
                    value={formCarga.volumeM3}
                    min={1}
                    onChange={e => setFormCarga({ ...formCarga, volumeM3: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="serrano-form-row">
                <label>Bomba / Tipo de Descarga</label>
                <select 
                  className="serrano-input"
                  value={formCarga.bomba}
                  onChange={e => setFormCarga({ ...formCarga, bomba: e.target.value })}
                >
                  <option value="BL-01 · Lança 32 m">BL-01 · Caminhão Bomba Lança 32m</option>
                  <option value="BL-02 · Lança 36 m">BL-02 · Caminhão Bomba Lança 36m</option>
                  <option value="Direta · calha">Descarga Direta (Calha da Betoneira)</option>
                </select>
              </div>

              <div className="serrano-modal-footer">
                <button 
                  type="button" 
                  className="btn-serrano"
                  onClick={() => setModalNovaCargaAberto(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-serrano pri"
                >
                  Programar Carga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL COMPLETO: ROMANEIO NBR 7212 & TICKET DE PESAGEM ─── */}
      {modalRomaneioAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 840, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Romaneio &amp; Ticket de Pesagem</h2>
                <small style={{ color: 'var(--text-muted)' }}>Carga #{modalRomaneioAberto.numero || 1001} · Conformidade ABNT NBR 7212</small>
              </div>
              <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', padding: 4, borderRadius: 8 }}>
                <button
                  type="button"
                  className={`btn-serrano ${abaRomaneio === 'romaneio' ? 'pri' : ''}`}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={() => setAbaRomaneio('romaneio')}
                >
                  📄 Romaneio NBR 7212
                </button>
                <button
                  type="button"
                  className={`btn-serrano ${abaRomaneio === 'balanca' ? 'pri' : ''}`}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={() => setAbaRomaneio('balanca')}
                >
                  ⚖️ Ticket Balança 80t
                </button>
              </div>
            </div>

            {abaRomaneio === 'romaneio' && (
              <div style={{ background: '#FFFFFF', color: '#16181B', padding: 22, borderRadius: 8, border: '1px solid var(--joint)', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12, lineHeight: 1.5 }}>
                {/* Cabeçalho */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #FF7000', paddingBottom: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#16181B' }}>SERRANO CONCRETO USINADO &amp; MINERAÇÃO LTDA</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>Rodovia MT-358 km 08 · Distrito Industrial · Tangará da Serra/MT</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>CNPJ Usinado: 53.798.485/0001-77 · Matriz: 51.499.928/0001-01 · IE: 14.229.191-9</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>RT: <b>Engª Karin Prestes (CREA-MT 027300)</b> · Central: (65) 99946-4899</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#FF7000' }}>ROMANEIO NBR 7212</div>
                    <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace' }}>#{modalRomaneioAberto.numero || 1001}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>Data: {new Date().toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>

                {/* Cliente & Obra */}
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, marginBottom: 10, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>1. Destinatário &amp; Local da Concretagem</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <div><b>Cliente:</b> {modalRomaneioAberto.cliente}</div>
                    <div><b>Obra:</b> {modalRomaneioAberto.obra}</div>
                    <div style={{ gridColumn: 'span 2' }}><b>Endereço:</b> {modalRomaneioAberto.endereco || 'Tangará da Serra/MT'}</div>
                  </div>
                </div>

                {/* Traço FCK */}
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, marginBottom: 10, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>2. Especificação do Concreto NBR 8953 / NBR 7212</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
                    <div><b>Resistência:</b> <span style={{ color: '#FF7000', fontWeight: 800 }}>{String(modalRomaneioAberto.fck).startsWith('FCK') ? modalRomaneioAberto.fck : `FCK ${modalRomaneioAberto.fck} MPa`}</span></div>
                    <div><b>Abatimento:</b> {modalRomaneioAberto.slump || '14 ± 2 cm'}</div>
                    <div><b>Volume Total:</b> {modalRomaneioAberto.volumeM3} m³</div>
                    <div><b>Descarga:</b> {modalRomaneioAberto.bomba || 'Bomba Lança'}</div>
                    <div><b>Agregado:</b> {modalRomaneioAberto.brita || 'Brita 1 (19mm)'}</div>
                    <div><b>Lote CP:</b> {modalRomaneioAberto.laudoCp || 'CP-2026-089'}</div>
                    <div><b>Corpos de Prova:</b> 4 unidades (7d/28d)</div>
                    <div><b>Aditivo:</b> Multiflux Plastificante</div>
                  </div>
                </div>

                {/* Ticket de Pesagem Integrado */}
                <div style={{ background: '#F0F9FF', padding: 10, borderRadius: 6, marginBottom: 10, border: '1px solid #BAE6FD', borderLeft: '4px solid #0284C7' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase' }}>3. Pesagem na Balança Rodoviária 80t Toledo Usina</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
                    <div><b>Ticket Balança:</b> {modalRomaneioAberto.ticketPesagem?.numeroTicket || `TKT-BAL-${modalRomaneioAberto.numero}`}</div>
                    <div><b>Peso Bruto:</b> 33.480 kg</div>
                    <div><b>Tara Betoneira:</b> 14.280 kg</div>
                    <div><b>Peso Líquido Concreto:</b> <span style={{ color: '#0284C7', fontWeight: 800 }}>19.200 kg</span></div>
                  </div>
                </div>

                {/* Telemetria e Horários */}
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, marginBottom: 10, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>4. Telemetria &amp; Limite de Pega (NBR 7212)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
                    <div><b>Veículo:</b> {modalRomaneioAberto.viagens?.[0]?.veiculo || 'BT-01'} (RRA-4E80)</div>
                    <div><b>Motorista:</b> {modalRomaneioAberto.viagens?.[0]?.motorista || 'Marcos Silveira'}</div>
                    <div><b>Adição Água Usina:</b> {modalRomaneioAberto.viagens?.[0]?.saidaUsina || '08:15'}</div>
                    <div><b>Limite 150 min:</b> <span style={{ color: '#DC2626', fontWeight: 700 }}>Conforme NBR 7212</span></div>
                  </div>
                </div>

                {/* Assinatura Digital Coletada */}
                <div style={{ marginTop: 14, border: '1px solid #CBD5E1', borderRadius: 8, padding: 14, background: '#F8FAFC' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                    5. Validação Digital de Recebimento na Obra
                  </div>

                  {modalRomaneioAberto.assinaturaEntrega?.imagemBase64 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
                      <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>Assinatura Digital Coletada Touch / Caneta</div>
                        <img 
                          src={modalRomaneioAberto.assinaturaEntrega.imagemBase64} 
                          alt="Assinatura Digital" 
                          style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
                        />
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#15803D', marginTop: 4 }}>
                          ✓ AUTENTICADA ELETRONICAMENTE (NBR 7212)
                        </div>
                      </div>

                      <div>
                        <div><b>Recebedor:</b> {modalRomaneioAberto.assinaturaEntrega.recebedorNome}</div>
                        <div><b>CPF:</b> {modalRomaneioAberto.assinaturaEntrega.recebedorDocumento}</div>
                        <div><b>Função na Obra:</b> {modalRomaneioAberto.assinaturaEntrega.recebedorCargo}</div>
                        <div><b>Data/Hora:</b> {modalRomaneioAberto.assinaturaEntrega.dataHoraAssinatura}</div>
                        <div><b>Slump Medido na Obra:</b> {modalRomaneioAberto.assinaturaEntrega.slumpMedidoCm} cm</div>
                        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace', marginTop: 4 }}>
                          Hash SHA-256: {modalRomaneioAberto.assinaturaEntrega.codigoAutenticidade || modalRomaneioAberto.assinaturaEntrega.hashSha256?.slice(0, 20)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <p style={{ color: '#92400E', fontSize: 12, margin: '0 0 10px' }}>
                        Esta carga ainda não possui assinatura digital coletada do cliente na entrega.
                      </p>
                      <button
                        type="button"
                        className="btn-serrano pri"
                        onClick={() => {
                          setModalRomaneioAberto(null);
                          abrirColetaAssinatura(modalRomaneioAberto);
                        }}
                      >
                        ✍️ Coletar Assinatura Digital do Cliente Agora
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {abaRomaneio === 'balanca' && (
              <div style={{ background: '#FFFFFF', color: '#111', padding: 24, borderRadius: 8, border: '1px solid var(--joint)', fontFamily: 'Courier New, monospace', fontSize: 12, lineHeight: 1.6 }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>SERRANO CONCRETO &amp; MINERAÇÃO LTDA</div>
                <div style={{ textAlign: 'center', fontSize: 11 }}>Rodovia MT-358 km 08 · Tangará da Serra/MT</div>
                <div style={{ textAlign: 'center', fontSize: 10 }}>CNPJ: 51.499.928/0001-01 · IE: 13.567.890-3</div>
                <div style={{ borderTop: '1px dashed #333', margin: '10px 0' }} />
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 13, color: '#EA580C' }}>
                  TICKET DE PESAGEM RODOVIÁRIA · {modalRomaneioAberto.ticketPesagem?.numeroTicket || `TKT-BAL-${modalRomaneioAberto.numero}`}
                </div>
                <div style={{ borderTop: '1px dashed #333', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Data/Hora:</span><b>12/11/2026 08:12</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Balança:</span><span>Toledo 80t (Plataforma 21m)</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Operador:</span><span>Paulo Cezar (Matrícula 042 - IPEM-MT)</span></div>
                <div style={{ borderTop: '1px dashed #333', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Veículo/Placa:</span><b>BT-01 (VW Constellation 26.280 · RRA-4E80)</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Motorista:</span><span>Marcos Silveira</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cliente:</span><b>{modalRomaneioAberto.cliente}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Material:</span><span>Concreto Usinado Estrutural {modalRomaneioAberto.fck}</span></div>
                <div style={{ borderTop: '1px dashed #333', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>PESO BRUTO:</span><b>33.480 kg</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>TARA VEÍCULO:</span><b>14.280 kg</b></div>
                <div style={{ borderTop: '1px dashed #333', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>
                  <span>PESO LÍQUIDO CONCRETO:</span><span>19.200 kg</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Volume Equivalente (2.400 kg/m³):</span><b>8.00 m³</b></div>
                <div style={{ borderTop: '1px dashed #333', margin: '10px 0' }} />
                <div style={{ border: '2px solid #16A34A', color: '#16A34A', fontWeight: 'bold', textAlign: 'center', padding: 8, borderRadius: 4, fontSize: 11 }}>
                  ✓ PESAGEM AUTOMÁTICA REGISTRADA NO SISTEMA KYTTO ERP<br />
                  <small>Aferição Portaria INMETRO/IPEM-MT nº 148/2026</small>
                </div>
              </div>
            )}

            <div className="serrano-modal-footer">
              <button
                type="button"
                className="btn-serrano"
                onClick={() => {
                  setModalRomaneioAberto(null);
                  abrirColetaAssinatura(modalRomaneioAberto);
                }}
              >
                ✍️ {modalRomaneioAberto.assinaturaEntrega?.imagemBase64 ? 'Reassinar Entrega' : 'Coletar Assinatura'}
              </button>

              <button
                type="button"
                className="btn-serrano"
                onClick={() => {
                  const token = localStorage.getItem('sp_token') || '';
                  window.open(`/api/admin/concreto/cargas/${modalRomaneioAberto.id}/romaneio-html?formato=html&token=${encodeURIComponent(token)}`, '_blank');
                }}
              >
                🖨️ Imprimir Romaneio A4
              </button>

              <button
                type="button"
                className="btn-serrano"
                onClick={() => {
                  const token = localStorage.getItem('sp_token') || '';
                  window.open(`/api/admin/concreto/balanca/tickets/tkt-bal-${modalRomaneioAberto.numero}/html?formato=html&token=${encodeURIComponent(token)}`, '_blank');
                }}
              >
                ⚖️ Imprimir Ticket 80mm
              </button>

              <button 
                type="button" 
                className="btn-serrano pri"
                onClick={() => setModalRomaneioAberto(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE ASSINATURA DIGITAL TOUCH / CANETA DO CLIENTE ─── */}
      {modalAssinaturaAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 640, width: '100%' }}>
            <h2>✍️ Assinatura Digital do Cliente na Entrega</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
              Coleta eletrônica da assinatura do engenheiro ou responsável no ato do descarregamento da betoneira (NBR 7212).
            </p>

            <form onSubmit={handleSalvarAssinatura}>
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{modalAssinaturaAberto.obra}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cliente: <b>{modalAssinaturaAberto.cliente}</b> · Volume: <b>{modalAssinaturaAberto.volumeM3} m³</b> · Traço: <b>{modalAssinaturaAberto.fck}</b></div>
              </div>

              <div className="serrano-grid-2col" style={{ gap: 12, marginBottom: 12 }}>
                <div className="serrano-form-row">
                  <label>Nome do Recebedor na Obra *</label>
                  <input
                    type="text"
                    required
                    className="serrano-input"
                    value={assinaturaForm.recebedorNome}
                    onChange={e => setAssinaturaForm({ ...assinaturaForm, recebedorNome: e.target.value })}
                    placeholder="Ex: Eng. Marcelo Dantas"
                  />
                </div>

                <div className="serrano-form-row">
                  <label>CPF / Documento *</label>
                  <input
                    type="text"
                    required
                    className="serrano-input"
                    value={assinaturaForm.recebedorDocumento}
                    onChange={e => setAssinaturaForm({ ...assinaturaForm, recebedorDocumento: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="serrano-grid-2col" style={{ gap: 12, marginBottom: 12 }}>
                <div className="serrano-form-row">
                  <label>Cargo / Função na Obra *</label>
                  <select
                    className="serrano-input"
                    value={assinaturaForm.recebedorCargo}
                    onChange={e => setAssinaturaForm({ ...assinaturaForm, recebedorCargo: e.target.value })}
                  >
                    <option value="Engenheiro Residente (Fiscal da Obra)">Engenheiro Residente (Fiscal da Obra)</option>
                    <option value="Mestre de Obras Geral">Mestre de Obras Geral</option>
                    <option value="Encarregado de Concretagem">Encarregado de Concretagem</option>
                    <option value="Técnico em Edificações">Técnico em Edificações</option>
                    <option value="Proprietário da Obra">Proprietário da Obra</option>
                  </select>
                </div>

                <div className="serrano-form-row">
                  <label>Slump Medido na Chegada (cm) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    className="serrano-input"
                    value={assinaturaForm.slumpMedidoCm}
                    onChange={e => setAssinaturaForm({ ...assinaturaForm, slumpMedidoCm: e.target.value })}
                    placeholder="14.5"
                  />
                </div>
              </div>

              <div className="serrano-form-row" style={{ marginBottom: 14 }}>
                <label>Água Suplementar Adicionada na Obra (Litros - Requer Autorização RT)</label>
                <input
                  type="number"
                  className="serrano-input"
                  value={assinaturaForm.aguaAdicionadaObraLitros}
                  onChange={e => setAssinaturaForm({ ...assinaturaForm, aguaAdicionadaObraLitros: e.target.value })}
                  placeholder="0 (Padrão: Proibido adicionar água sem RT)"
                />
              </div>

              {/* QUADRO DO CANVAS TOUCH / MOUSE */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontWeight: 700, fontSize: 13 }}>
                    Assine com o dedo ou caneta no quadro abaixo *
                  </label>
                  <button
                    type="button"
                    className="btn-serrano"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={clearSignature}
                  >
                    🗑️ Limpar Traço
                  </button>
                </div>

                <div style={{ border: '2px dashed var(--joint)', borderRadius: 8, background: '#FFFFFF', padding: 4, touchAction: 'none' }}>
                  <canvas
                    ref={canvasRef}
                    width={580}
                    height={160}
                    style={{ width: '100%', height: 160, display: 'block', cursor: 'crosshair', background: '#FFFFFF', borderRadius: 6 }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                  {hasSignature ? '✓ Assinatura capturada com sucesso!' : 'Por favor, desenhe a assinatura legível no retângulo branco.'}
                </small>
              </div>

              <div style={{ background: '#FFFBEB', borderLeft: '4px solid #F59E0B', padding: '10px 14px', borderRadius: 4, fontSize: 11, color: '#92400E', marginBottom: 16 }}>
                <b>Termo de Recebimento NBR 7212:</b> Ao assinar, o recebedor atesta que o concreto foi recebido em conformidade com o FCK e abatimento especificados, sem início de pega, com ticket de pesagem da balança rodoviária 80t conferido.
              </div>

              <div className="serrano-modal-footer">
                <button
                  type="button"
                  className="btn-serrano"
                  onClick={() => setModalAssinaturaAberto(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoAssinatura}
                  className="btn-serrano pri"
                >
                  {salvandoAssinatura ? 'Validando Hash SHA-256...' : '✓ Confirmar Assinatura Digital & Finalizar Entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: LAUDO NBR 5739 ─── */}
      {modalLaudoAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card">
            <h2>Laudo Tecnológico de Ruptura · ABNT NBR 5739</h2>
            <div style={{ background: 'var(--surface-2)', padding: 18, borderRadius: 8, fontFamily: 'var(--font-data)', fontSize: 12, lineHeight: 1.6 }}>
              <div><b>SERRANO CONCRETO · LABORATÓRIO DE CONTROLE TECNOLÓGICO</b></div>
              <div>Certificado: {modalLaudoAberto.laudoNumero}</div>
              <div>Obra: {modalLaudoAberto.obra}</div>
              <div>Cliente: {modalLaudoAberto.cliente}</div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--joint)', margin: '10px 0' }} />
              <div>FCK de Projeto: <b>{modalLaudoAberto.fckProjeto} MPa</b></div>
              <div>Slump Test no Recebimento: <b>{modalLaudoAberto.slumpMedidoCm} cm (Conforme)</b></div>
              <div>Resistência Aferida aos 28 dias: <b style={{ color: 'var(--status-ok)', fontSize: 14 }}>{modalLaudoAberto.fckEstimado28d || '34.2'} MPa (114% do FCK)</b></div>
              <div>Parecer Técnico: <b>CONCRETO ESTRUTURAL APROVADO</b></div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--joint)', margin: '10px 0' }} />
              <div>Responsável Técnica: <b>Engª Karin Prestes (CREA-MT 027300)</b></div>
            </div>
            <div className="serrano-modal-footer">
              <button 
                type="button" 
                className="btn-serrano pri"
                onClick={() => setModalLaudoAberto(null)}
              >
                Concluir Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CRIAR OU EDITAR ORDEM DE PRODUÇÃO (OP) ─── */}
      {modalOpFormAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 760, width: '100%' }}>
            <h2>
              {modalOpFormAberto.modo === 'editar' ? `✏️ Editar Ordem de Produção ${formOp.numero}` : '📋 Nova Ordem de Produção (OP) · Dosagem NBR 7212'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
              Planejamento de bateladas industriais, especificação de FCK, alocação de betoneiras e cálculo estequiométrico dos silos.
            </p>

            <form onSubmit={handleSalvarOp}>
              <div className="serrano-grid-3col" style={{ gap: 12, marginBottom: 12 }}>
                <div className="serrano-form-row">
                  <label>Número da OP</label>
                  <input
                    type="text"
                    required
                    className="serrano-input"
                    value={formOp.numero}
                    onChange={e => setFormOp({ ...formOp, numero: e.target.value })}
                  />
                </div>

                <div className="serrano-form-row">
                  <label>Status da Produção</label>
                  <select
                    className="serrano-input"
                    value={formOp.status}
                    onChange={e => setFormOp({ ...formOp, status: e.target.value })}
                  >
                    <option value="programada">Programada</option>
                    <option value="em_pesagem">Em Pesagem Silos</option>
                    <option value="concluida">Concluída / Dosada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div className="serrano-form-row">
                  <label>Data &amp; Hora Programada</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formOp.dataHora}
                    onChange={e => setFormOp({ ...formOp, dataHora: e.target.value })}
                    placeholder="2026-11-12 14:00"
                  />
                </div>
              </div>

              <div className="serrano-grid-2col" style={{ gap: 12, marginBottom: 12 }}>
                <div className="serrano-form-row">
                  <label>Cliente / Construtora *</label>
                  <input
                    type="text"
                    required
                    className="serrano-input"
                    value={formOp.cliente}
                    onChange={e => setFormOp({ ...formOp, cliente: e.target.value })}
                    placeholder="Ex: Construtora MT Horizon"
                  />
                </div>

                <div className="serrano-form-row">
                  <label>Obra &amp; Etapa Concretagem *</label>
                  <input
                    type="text"
                    required
                    className="serrano-input"
                    value={formOp.obra}
                    onChange={e => setFormOp({ ...formOp, obra: e.target.value })}
                    placeholder="Ex: Edifício Belvedere · Lajes 3º Pav."
                  />
                </div>
              </div>

              <div className="serrano-form-row" style={{ marginBottom: 12 }}>
                <label>Endereço / Local de Descarga</label>
                <input
                  type="text"
                  className="serrano-input"
                  value={formOp.endereco}
                  onChange={e => setFormOp({ ...formOp, endereco: e.target.value })}
                  placeholder="Rua, Bairro e Município (Ex: Av. Brasil, 1500 · Tangará da Serra/MT)"
                />
              </div>

              <div className="serrano-grid-3col" style={{ gap: 12, marginBottom: 14 }}>
                <div className="serrano-form-row">
                  <label>Resistência (FCK MPa) *</label>
                  <select
                    className="serrano-input"
                    value={formOp.fck}
                    onChange={e => setFormOp({ ...formOp, fck: Number(e.target.value) })}
                  >
                    <option value={20}>FCK 20 MPa (Piso / Magro)</option>
                    <option value={25}>FCK 25 MPa (Estrutural Padrão)</option>
                    <option value={30}>FCK 30 MPa (Lajes / Pilares)</option>
                    <option value={35}>FCK 35 MPa (Piso Industrial)</option>
                    <option value={40}>FCK 40 MPa (Alta Resistência)</option>
                  </select>
                </div>

                <div className="serrano-form-row">
                  <label>Volume Total (m³) *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    className="serrano-input"
                    value={formOp.volumeM3}
                    onChange={e => setFormOp({ ...formOp, volumeM3: Number(e.target.value) })}
                  />
                </div>

                <div className="serrano-form-row">
                  <label>Slump Test Previsto (Abatimento)</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formOp.slumpPrevistoCm}
                    onChange={e => setFormOp({ ...formOp, slumpPrevistoCm: e.target.value })}
                    placeholder="12 ± 2 cm"
                  />
                </div>
              </div>

              {/* Quadro Estequiométrico Teórico Calculado em Tempo Real */}
              <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <b style={{ fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                    🧪 Previsão Estequiométrica de Insumos NBR 7212 ({formOp.volumeM3 || 0} m³ · FCK {formOp.fck} MPa):
                  </b>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>
                    {calculoTeoricoFormOp.totalBateladas} batelada(s) de usina
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, fontSize: 11 }}>
                  <div>Cimento CP II:<br /><b style={{ fontSize: 13, color: '#0F172A' }}>{Number(calculoTeoricoFormOp.cimentoKg).toLocaleString('pt-BR')} kg</b></div>
                  <div>Areia Média:<br /><b style={{ fontSize: 13, color: '#0F172A' }}>{Number(calculoTeoricoFormOp.areiaKg).toLocaleString('pt-BR')} kg</b></div>
                  <div>Brita 1:<br /><b style={{ fontSize: 13, color: '#0F172A' }}>{Number(calculoTeoricoFormOp.britaKg).toLocaleString('pt-BR')} kg</b></div>
                  <div>Água Dosagem:<br /><b style={{ fontSize: 13, color: '#0F172A' }}>{Number(calculoTeoricoFormOp.aguaL).toLocaleString('pt-BR')} L</b></div>
                  <div>Aditivo Plast.:<br /><b style={{ fontSize: 13, color: '#0F172A' }}>{calculoTeoricoFormOp.aditivoL} L</b></div>
                  <div>Peso Total:<br /><b style={{ fontSize: 13, color: 'var(--serrano-orange-text)' }}>{Number(calculoTeoricoFormOp.pesoTotalKg).toLocaleString('pt-BR')} kg</b></div>
                </div>
              </div>

              <div className="serrano-grid-3col" style={{ gap: 12, marginBottom: 14 }}>
                <div className="serrano-form-row">
                  <label>Betoneiras Escaladas</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {['BT-01', 'BT-02', 'BT-03', 'BT-04', 'BT-05', 'BT-06'].map(v => {
                      const sel = (formOp.betoneirasEscaladas || []).includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          className={`btn-serrano ${sel ? 'pri' : ''}`}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => {
                            const atual = formOp.betoneirasEscaladas || [];
                            const novo = sel ? atual.filter(x => x !== v) : [...atual, v];
                            setFormOp({ ...formOp, betoneirasEscaladas: novo.length > 0 ? novo : [v] });
                          }}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="serrano-form-row">
                  <label>Operador da Central de Dosagem</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formOp.operador}
                    onChange={e => setFormOp({ ...formOp, operador: e.target.value })}
                    placeholder="Carlos Eduardo"
                  />
                </div>

                <div className="serrano-form-row">
                  <label>Motorista / Condutor</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formOp.motorista}
                    onChange={e => setFormOp({ ...formOp, motorista: e.target.value })}
                    placeholder="Ex: Marcos Silveira"
                  />
                </div>
              </div>

              <div className="serrano-form-row" style={{ marginBottom: 16 }}>
                <label>Observações Técnicas &amp; Rastreabilidade</label>
                <textarea
                  className="serrano-input"
                  rows={2}
                  value={formOp.observacoes}
                  onChange={e => setFormOp({ ...formOp, observacoes: e.target.value })}
                  placeholder="Instruções de mistura, tipo de brita, cuidados na descarga..."
                />
              </div>

              <div className="serrano-modal-footer">
                <button
                  type="button"
                  className="btn-serrano"
                  onClick={() => setModalOpFormAberto(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoOp}
                  className="btn-serrano pri"
                >
                  {salvandoOp ? 'Salvando OP no Datastore...' : '✓ Salvar Ordem de Produção'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: VISUALIZAR DETALHES COMPLETOS DA OP ─── */}
      {modalOpVisualizarAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 740, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--serrano-orange)', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Ficha Técnica · {modalOpVisualizarAberto.numero}</h2>
                <small style={{ color: 'var(--text-muted)' }}>Rastreabilidade de Usina e Controle Tecnológico NBR 7212:2021</small>
              </div>
              <span className={`serrano-pill ${modalOpVisualizarAberto.status === 'concluida' ? 'serrano-p-ok' : modalOpVisualizarAberto.status === 'em_pesagem' ? 'serrano-p-live' : 'serrano-p-load'}`}>
                {modalOpVisualizarAberto.status === 'concluida' ? 'Concluída' : modalOpVisualizarAberto.status === 'em_pesagem' ? 'Pesagem Silos' : 'Programada'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                <b style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Destino &amp; Obra</b>
                <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>{modalOpVisualizarAberto.obra}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>Cliente: <b>{modalOpVisualizarAberto.cliente}</b></div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{modalOpVisualizarAberto.endereco || 'Tangará da Serra - MT'}</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Data/Hora: <b>{modalOpVisualizarAberto.dataHora}</b></div>
              </div>

              <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
                <b style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Especificação do Traço</b>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--serrano-orange-text)', marginTop: 4 }}>
                  FCK {modalOpVisualizarAberto.fck} MPa · {modalOpVisualizarAberto.volumeM3} m³
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>Bateladas Usina: <b>{modalOpVisualizarAberto.totalBateladas || Math.ceil(modalOpVisualizarAberto.volumeM3 / 8)} de 8m³</b></div>
                <div style={{ fontSize: 12, marginTop: 2 }}>Betoneiras: <b>{(modalOpVisualizarAberto.betoneirasEscaladas || []).join(', ')}</b></div>
                <div style={{ fontSize: 12, marginTop: 2 }}>Operador Central: <b>{modalOpVisualizarAberto.operador || 'Carlos Eduardo'}</b></div>
                <div style={{ fontSize: 12, marginTop: 2 }}>Slump Previsto: <b>{modalOpVisualizarAberto.slumpPrevistoCm || '12 ± 2 cm'}</b></div>
              </div>
            </div>

            {/* Tabela de Insumos da Balança dos Silos */}
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <b style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Dosagem Estequiométrica &amp; Pesagem Balança dos Silos (NBR 7212)
              </b>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--joint)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Insumo</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Teórico (kg/L)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Real Balança</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Status NBR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 8px' }}>Cimento CP II-F-32</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(modalOpVisualizarAberto.consumoTeorico?.cimentoKg || 0).toLocaleString('pt-BR')} kg</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                      {modalOpVisualizarAberto.consumoRealBalança?.cimentoKg ? `${Number(modalOpVisualizarAberto.consumoRealBalança.cimentoKg).toLocaleString('pt-BR')} kg` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16A34A' }}>±2.0% Tolerância</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 8px' }}>Areia Média Lavada</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(modalOpVisualizarAberto.consumoTeorico?.areiaKg || 0).toLocaleString('pt-BR')} kg</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                      {modalOpVisualizarAberto.consumoRealBalança?.areiaKg ? `${Number(modalOpVisualizarAberto.consumoRealBalança.areiaKg).toLocaleString('pt-BR')} kg` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16A34A' }}>±3.0% Tolerância</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 8px' }}>Brita 1 Granítica</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(modalOpVisualizarAberto.consumoTeorico?.britaKg || 0).toLocaleString('pt-BR')} kg</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                      {modalOpVisualizarAberto.consumoRealBalança?.britaKg ? `${Number(modalOpVisualizarAberto.consumoRealBalança.britaKg).toLocaleString('pt-BR')} kg` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16A34A' }}>±3.0% Tolerância</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 8px' }}>Água Potável de Dosagem</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(modalOpVisualizarAberto.consumoTeorico?.aguaL || 0).toLocaleString('pt-BR')} L</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                      {modalOpVisualizarAberto.consumoRealBalança?.aguaL ? `${Number(modalOpVisualizarAberto.consumoRealBalança.aguaL).toLocaleString('pt-BR')} L` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16A34A' }}>±1.0% Tolerância</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 8px' }}>Aditivo Plastificante</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(modalOpVisualizarAberto.consumoTeorico?.aditivoL || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                      {modalOpVisualizarAberto.consumoRealBalança?.aditivoL ? `${Number(modalOpVisualizarAberto.consumoRealBalança.aditivoL).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16A34A' }}>±3.0% Tolerância</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              <b>Observações:</b> {modalOpVisualizarAberto.observacoes || 'Sem observações adicionais para esta OP.'}
            </div>

            <div className="serrano-modal-footer">
              <button
                type="button"
                className="btn-serrano"
                onClick={() => {
                  const op = modalOpVisualizarAberto;
                  setModalOpVisualizarAberto(null);
                  abrirEditarOp(op);
                }}
              >
                ✏️ Editar Dados
              </button>
              <button
                type="button"
                className="btn-serrano"
                onClick={() => {
                  const op = modalOpVisualizarAberto;
                  setModalOpVisualizarAberto(null);
                  abrirApontamentoOp(op);
                }}
              >
                ⚖️ Apontar Pesagem Silos
              </button>
              <button
                type="button"
                className="btn-serrano"
                onClick={() => handleImprimirOp(modalOpVisualizarAberto)}
              >
                🖨️ Imprimir Ficha A4
              </button>
              <button
                type="button"
                className="btn-serrano pri"
                onClick={() => setModalOpVisualizarAberto(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: APONTAMENTO DE PESAGEM REAL DA BALANÇA DOS SILOS ─── */}
      {modalOpApontamentoAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 620, width: '100%' }}>
            <h2>⚖️ Apontar Pesagem da Balança dos Silos · {modalOpApontamentoAberto.numero}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
              Lançamento dos quilos e litros efetivamente medidos na balança automática da central de dosagem (NBR 7212).
            </p>

            <form onSubmit={handleSalvarApontamento}>
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{modalOpApontamentoAberto.obra}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Cliente: <b>{modalOpApontamentoAberto.cliente}</b> · Volume: <b>{modalOpApontamentoAberto.volumeM3} m³</b> · Traço: <b>FCK {modalOpApontamentoAberto.fck} MPa</b>
                </div>
              </div>

              <div className="serrano-grid-2col" style={{ gap: 12, marginBottom: 12 }}>
                <div className="serrano-form-row">
                  <label>Cimento CP II Balança (kg) *</label>
                  <input
                    type="number"
                    required
                    className="serrano-input"
                    value={formApontamentoOp.cimentoKg}
                    onChange={e => setFormApontamentoOp({ ...formApontamentoOp, cimentoKg: e.target.value })}
                    placeholder="Ex: 9150"
                  />
                </div>

                <div className="serrano-form-row">
                  <label>Areia Média Silo (kg) *</label>
                  <input
                    type="number"
                    required
                    className="serrano-input"
                    value={formApontamentoOp.areiaKg}
                    onChange={e => setFormApontamentoOp({ ...formApontamentoOp, areiaKg: e.target.value })}
                    placeholder="Ex: 20900"
                  />
                </div>
              </div>

              <div className="serrano-grid-2col" style={{ gap: 12, marginBottom: 12 }}>
                <div className="serrano-form-row">
                  <label>Brita 1 Granítica Balança (kg) *</label>
                  <input
                    type="number"
                    required
                    className="serrano-input"
                    value={formApontamentoOp.britaKg}
                    onChange={e => setFormApontamentoOp({ ...formApontamentoOp, britaKg: e.target.value })}
                    placeholder="Ex: 27800"
                  />
                </div>

                <div className="serrano-form-row">
                  <label>Água de Dosagem (Litros) *</label>
                  <input
                    type="number"
                    required
                    className="serrano-input"
                    value={formApontamentoOp.aguaL}
                    onChange={e => setFormApontamentoOp({ ...formApontamentoOp, aguaL: e.target.value })}
                    placeholder="Ex: 4080"
                  />
                </div>
              </div>

              <div className="serrano-grid-3col" style={{ gap: 12, marginBottom: 14 }}>
                <div className="serrano-form-row">
                  <label>Aditivo Plastificante (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="serrano-input"
                    value={formApontamentoOp.aditivoL}
                    onChange={e => setFormApontamentoOp({ ...formApontamentoOp, aditivoL: e.target.value })}
                    placeholder="Ex: 72.0"
                  />
                </div>

                <div className="serrano-form-row">
                  <label>Slump Medido na Carga (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="serrano-input"
                    value={formApontamentoOp.slumpMedidoCm}
                    onChange={e => setFormApontamentoOp({ ...formApontamentoOp, slumpMedidoCm: e.target.value })}
                    placeholder="12.0"
                  />
                </div>

                <div className="serrano-form-row">
                  <label>Lacre do Caminhão</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formApontamentoOp.lacreCarga}
                    onChange={e => setFormApontamentoOp({ ...formApontamentoOp, lacreCarga: e.target.value })}
                    placeholder="LAC-2026-098"
                  />
                </div>
              </div>

              <div className="serrano-form-row" style={{ marginBottom: 16 }}>
                <label>Status da OP após apontamento</label>
                <select
                  className="serrano-input"
                  value={formApontamentoOp.status}
                  onChange={e => setFormApontamentoOp({ ...formApontamentoOp, status: e.target.value })}
                >
                  <option value="concluida">✓ Concluir OP &amp; Dar Baixa nos Silos</option>
                  <option value="em_pesagem">Manter em Pesagem</option>
                </select>
              </div>

              <div className="serrano-modal-footer">
                <button
                  type="button"
                  className="btn-serrano"
                  onClick={() => setModalOpApontamentoAberto(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoApontamento}
                  className="btn-serrano pri"
                >
                  {salvandoApontamento ? 'Gravando Pesagem...' : '✓ Confirmar Pesagem & Atualizar Silos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
