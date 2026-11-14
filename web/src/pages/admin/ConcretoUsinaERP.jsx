import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';
import './ConcretoUsinaERP.css';
import ConcretoFinanceiroUsina from './concreto/ConcretoFinanceiroUsina';
import ConcretoVendasFaturamento from './concreto/ConcretoVendasFaturamento';
import ProgramacaoCargasAgenda from './concreto/ProgramacaoCargasAgenda';
import ConcretoKyttoIACopilot from './concreto/ConcretoKyttoIACopilot';
import ConcretoMapaGpsFrota from './concreto/ConcretoMapaGpsFrota';
import ConcretoChecklistFrota from './concreto/ConcretoChecklistFrota';
import ConcretoRecicladorSustentabilidade from './concreto/ConcretoRecicladorSustentabilidade';
import ConcretoAuditoriaMetrologica from './concreto/ConcretoAuditoriaMetrologica';
import ConcretoConectoresIndustriais from './concreto/ConcretoConectoresIndustriais';
import ConcretoCamerasVisionAI from './concreto/ConcretoCamerasVisionAI';
import ConcretoLaboratorioTecnologico from './concreto/ConcretoLaboratorioTecnologico';
import ConcretoAppCampoPainel from './concreto/ConcretoAppCampoPainel';
import HoldingGrupoPalatare from './concreto/HoldingGrupoPalatare';
import TorreDeControlePesagemSerrano from './concreto/TorreDeControlePesagemSerrano';
import { HOLDING_PALATARE_EMPRESA_ID, SERRANO_CONCRETO_EMPRESA_ID } from '../../lib/palatare-constants';


const CARGAS_PADRAO = [
  { id: "crg-1001", numero: 1001, obra: "Ed. Residencial Serra Dourada · lajes 4º pav.", cliente: "Construtora MT Horizon", fck: 30, brita: "Brita 1", slump: "14 ± 2 cm", volumeM3: 24, bomba: "BL-01 · Lança 32 m", valorTotal: 11160, status: "concluido",
    viagens: [{ veiculo: "BT-01", saidaUsina: "08:15", chegadaObra: "08:35", fimDescarga: "09:20", pegaMinutos: null }, { veiculo: "BT-02", saidaUsina: "08:50", chegadaObra: "09:10", fimDescarga: "10:00", pegaMinutos: null }, { veiculo: "BT-03", saidaUsina: "09:30", chegadaObra: "09:55", fimDescarga: "10:45", pegaMinutos: null }] },
  { id: "crg-1002", numero: 1002, obra: "Piso industrial galpão de cargas · etapa 2", cliente: "AgroLog Transportes & Logística", fck: 35, brita: "Brita 1 (fibras)", slump: "14 ± 2 cm", volumeM3: 32, bomba: "Direta · calha", valorTotal: 15360, status: "em_transito",
    viagens: [{ veiculo: "BT-01", saidaUsina: "13:10", chegadaObra: "13:25", fimDescarga: "14:15", pegaMinutos: null }, { veiculo: "BT-02", saidaUsina: "13:45", chegadaObra: "14:05", fimDescarga: "—", pegaMinutos: 65 }, { veiculo: "BT-04", saidaUsina: "14:20", chegadaObra: "—", fimDescarga: "—", pegaMinutos: 30 }, { veiculo: "BT-05", saidaUsina: "—", chegadaObra: "—", fimDescarga: "—", pegaMinutos: null }] },
  { id: "crg-1003", numero: 1003, obra: "Casa térrea lote 12 qd. 08 · vigas e baldrames", cliente: "Eng. Marcelo Dantas", fck: 25, brita: "Brita 1", slump: "12 ± 2 cm", volumeM3: 16, bomba: "BL-01 · Lança 32 m", valorTotal: 7310, status: "carregando",
    viagens: [{ veiculo: "BT-03", saidaUsina: "—", chegadaObra: "—", fimDescarga: "—", pegaMinutos: null }, { veiculo: "BT-04", saidaUsina: "—", chegadaObra: "—", fimDescarga: "—", pegaMinutos: null }] }
];

export const SUBMODULOS_TORRE = [
  { id: 'torre', label: 'Torre', icon: '🏢', badge: null, desc: 'Torre de Controle & Gêmeo Digital' },
  { id: 'pesagem', label: 'Pesagem', icon: '⚖️', badge: 'LIVE', badgeClass: 'serrano-badge-live', desc: 'Cockpit de Balança Operacional 80t' },
  { id: 'fila', label: 'Fila & agenda', icon: '📅', badge: null, desc: 'Fila de Caminhões & Concretagens' },
  { id: 'antifraude', label: 'Antifraude', icon: '🛡️', badge: '1', badgeClass: 'serrano-badge-alert', desc: 'Auditoria Inteligente Motor KyttoIA' },
  { id: 'clientes', label: 'Clientes', icon: '👥', badge: null, desc: 'Canteiros de Obras & Pedidos' },
  { id: 'fiscal', label: 'Fiscal & integrações', icon: '🧾', badge: 'SEFAZ', badgeClass: 'serrano-badge-sefaz', desc: 'MDF-e, NF-e e CT-e' },
  { id: 'relatorios', label: 'Relatórios', icon: '📊', badge: null, desc: 'Indicadores & Consumo de Insumos' },
  { id: 'cadastros', label: 'Cadastros & regras', icon: '🗄️', badge: null, desc: 'Traços NBR, Frotas e Balanças' },
];

export default function ConcretoUsinaERP() {
  const { empresaAtiva, trocarEmpresa } = useAuth();
  const { toast } = useToast();

  // Estados de layout e tema
  const [themeDark, setThemeDark] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const secaoParam = searchParams.get('secao') || searchParams.get('tab') || 'operacao-despacho';
  const secaoAtiva = (secaoParam === 'app-campo' || secaoParam === 'app-campo-assinatura') ? 'app-campo-assinatura' : (secaoParam === 'torre' || secaoParam === 'torre-controle' || secaoParam === 'torre-pesagem') ? 'torre-pesagem' : secaoParam;
  
  // Submenu integrado da Torre de Controle & Pesagem
  const subsecaoParam = searchParams.get('subsecao') || searchParams.get('subtab') || searchParams.get('view') || 'torre';
  const [subsecaoTorre, setSubsecaoTorre] = useState(subsecaoParam);

  useEffect(() => {
    const s = searchParams.get('subsecao') || searchParams.get('subtab') || searchParams.get('view');
    if (s && s !== subsecaoTorre) {
      setSubsecaoTorre(s);
    }
  }, [searchParams]);

  const setSubsecaoAtivaTorre = (subId) => {
    setSubsecaoTorre(subId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('secao', 'torre-pesagem');
      next.set('subsecao', subId);
      return next;
    });
  };

  const setSecaoAtiva = (s) => {
    const sNorm = (s === 'app-campo' || s === 'app-campo-assinatura') ? 'app-campo-assinatura' : s;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('secao', sNorm);
      if (sNorm === 'torre-pesagem' || sNorm === 'torre-controle' || sNorm === 'torre') {
        next.set('subsecao', subsecaoTorre || 'torre');
      } else {
        next.delete('subsecao');
      }
      return next;
    });
    if (trocarEmpresa) {
      if (sNorm === 'empresa-holding') {
        trocarEmpresa(HOLDING_PALATARE_EMPRESA_ID);
      } else if (empresaAtiva?.id === HOLDING_PALATARE_EMPRESA_ID) {
        trocarEmpresa(SERRANO_CONCRETO_EMPRESA_ID);
      }
    }
  };

  // Sincronização automática de empresa ativa conforme a aba
  useEffect(() => {
    if (!trocarEmpresa) return;
    if (secaoAtiva === 'empresa-holding') {
      if (empresaAtiva?.id !== HOLDING_PALATARE_EMPRESA_ID) {
        trocarEmpresa(HOLDING_PALATARE_EMPRESA_ID);
      }
    } else {
      if (empresaAtiva?.id !== SERRANO_CONCRETO_EMPRESA_ID && empresaAtiva?.id !== HOLDING_PALATARE_EMPRESA_ID) {
        trocarEmpresa(SERRANO_CONCRETO_EMPRESA_ID);
      }
    }
  }, [secaoAtiva, empresaAtiva?.id]);

  const [busca, setBusca] = useState('');
  const [cargasAbertas, setCargasAbertas] = useState({ '#1002': true });
  const [copilotAberto, setCopilotAberto] = useState(false);
  const [subAbaFrota, setSubAbaFrota] = useState('telemetria'); // 'telemetria', 'gps', 'checklist'
  const [subAbaCentral, setSubAbaCentral] = useState('dosadora'); // 'dosadora', 'auditoria'


  // Estados de dados da usina
  const [cargas, setCargas] = useState(CARGAS_PADRAO);
  const [catalogo, setCatalogo] = useState([]);
  const [frota, setFrota] = useState([]);
  const [ensaios, setEnsaios] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [silos, setSilos] = useState([]);
  const [baias, setBaias] = useState([]);
  const [tanques, setTanques] = useState([]);
  const [entradasSuprimentos, setEntradasSuprimentos] = useState([]);
  const [bateladas, setBateladas] = useState([]);
  const [subAbaSuprimentos, setSubAbaSuprimentos] = useState('silos-patio'); // 'silos-patio' | 'central-processo' | 'balanca-entradas' | 'tanques-aditivos'
  const [modalReabastecerAberto, setModalReabastecerAberto] = useState(false);
  const [formReabastecer, setFormReabastecer] = useState({
    destinoId: 'silo-01',
    tipoDestino: 'silo',
    produto: 'Cimento Portland CP II-F-32',
    quantidade: 32,
    ticketBalanca: 'TKT-80T-8942',
    placa: 'RBD-4E80',
    motorista: 'Valdir Silveira',
    transportadora: 'TransSerrano Cargas Pesadas'
  });
  const [modalDoseBateladaAberto, setModalDoseBateladaAberto] = useState(false);
  const [formDoseBatelada, setFormDoseBatelada] = useState({
    fck: 25,
    volumeM3: 8,
    betoneira: 'BT-01',
    umidadeAreiaPercentual: 4.5,
    britaTipo: 'Brita 1',
    slumpAlvo: '14 ± 2 cm'
  });
  const [modalTicketBateladaAberto, setModalTicketBateladaAberto] = useState(null);
  const [salvandoSuprimento, setSalvandoSuprimento] = useState(false);
  const [compras, setCompras] = useState([]);
  const [ordensProducao, setOrdensProducao] = useState([]);
  const [dragas, setDragas] = useState([]);
  const [patiosMineracao, setPatiosMineracao] = useState([]);
  const [vendasAgregados, setVendasAgregados] = useState([]);
  const [cameras, setCameras] = useState([]);
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

  // Formulário e Estados do Laboratório NBR 5738 / NBR 5739
  const [abaLaboratorio, setAbaLaboratorio] = useState('lotes'); // 'lotes' | 'curva' | 'camara' | 'estatistica'
  const [filtroFrotaTipo, setFiltroFrotaTipo] = useState('todos'); // 'todos' | 'betoneira' | 'bomba_lanca'
  const [salvandoRuptura, setSalvandoRuptura] = useState(false);
  const [simuladorSlump, setSimuladorSlump] = useState({
    temperaturaAmbienteC: 33,
    tempoViagemMin: 35,
    slumpInicialCm: 14.0,
    usoRetardador: true
  });
  const [formRuptura, setFormRuptura] = useState({
    loteId: '',
    cpId: 'CP-1',
    idadeDias: 7,
    diametroMm: 100.0,
    alturaMm: 200.0,
    forcaKn: 200.0,
    tensaoMpa: 25.5,
    tipoRuptura: 'A',
    tipoPreparoBase: 'retificacao_diamantada'
  });

  const calcularTensaoCP = (forcaKn, diametroMm = 100.0, alturaMm = 200.0) => {
    const f = Number(forcaKn) || 0;
    const d = Number(diametroMm) || 100.0;
    const h = Number(alturaMm) || 200.0;
    const area = (Math.PI * Math.pow(d, 2)) / 4.0;
    const hd = h / d;
    let fatorHd = 1.0;
    if (hd < 1.94) {
      if (hd <= 1.0) fatorHd = 0.86;
      else if (hd <= 1.25) fatorHd = 0.86 + (hd - 1.0) * (0.93 - 0.86) / 0.25;
      else if (hd <= 1.50) fatorHd = 0.93 + (hd - 1.25) * (0.96 - 0.93) / 0.25;
      else if (hd <= 1.75) fatorHd = 0.96 + (hd - 1.50) * (0.98 - 0.96) / 0.25;
      else fatorHd = 0.98 + (hd - 1.75) * (1.00 - 0.98) / 0.25;
    }
    return +(((f * 1000) / area * fatorHd).toFixed(1));
  };

  const abrirModalRuptura = (ensaio, cpAlvo = null) => {
    const cp = cpAlvo || ensaio.corposProva?.find(c => c.tensaoMpa == null) || ensaio.corposProva?.[0] || { id: 'CP-1', idadeDias: 7 };
    const forcaPadrao = +(ensaio.fckProjeto * 0.85 * 7.854).toFixed(1);
    const diametro = cp.diametroMm || 100.0;
    const altura = cp.alturaMm || 200.0;
    const forca = cp.forcaKn || forcaPadrao;
    const tensao = cp.tensaoMpa || calcularTensaoCP(forca, diametro, altura);

    setFormRuptura({
      loteId: ensaio.id || ensaio.lote,
      cpId: cp.id,
      idadeDias: cp.idadeDias || 7,
      diametroMm: diametro,
      alturaMm: altura,
      forcaKn: forca,
      tensaoMpa: tensao,
      tipoRuptura: cp.tipoRuptura || 'A',
      tipoPreparoBase: cp.tipoPreparoBase || 'retificacao_diamantada'
    });
    setModalRupturaAberto(ensaio);
  };

  const handleSalvarRupturaPrensa = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!modalRupturaAberto) return;
    setSalvandoRuptura(true);
    try {
      const loteId = formRuptura.loteId || modalRupturaAberto.id || modalRupturaAberto.lote;
      const res = await api.post(`/api/admin/concreto/ensaios/${loteId}/ruptura`, {
        cpId: formRuptura.cpId,
        idadeDias: Number(formRuptura.idadeDias),
        forcaKn: Number(formRuptura.forcaKn),
        tensaoMpa: Number(formRuptura.tensaoMpa),
        diametroMm: Number(formRuptura.diametroMm),
        alturaMm: Number(formRuptura.alturaMm),
        tipoRuptura: formRuptura.tipoRuptura,
        tipoPreparoBase: formRuptura.tipoPreparoBase
      });
      if (res.data?.ok || res.data?.ensaio) {
        toast ? toast.success(`Ruptura do ${formRuptura.cpId} gravada com sucesso! (${formRuptura.tensaoMpa} MPa)`) : alert(`Ruptura gravada com sucesso!`);
        setModalRupturaAberto(null);
        await carregarDados();
      }
    } catch (err) {
      console.error('Erro ao registrar ruptura:', err);
      const msg = err.response?.data?.error || err.message;
      toast ? toast.error('Falha ao salvar ensaio de ruptura: ' + msg) : alert('Erro: ' + msg);
    } finally {
      setSalvandoRuptura(false);
    }
  };

  // Handlers de Suprimentos, Silos e Controle de Processo
  const handleSalvarUmidadeBaia = async (baiaId, umidadePercentual) => {
    try {
      const res = await api.put('/api/admin/concreto/suprimentos-silos/umidade', {
        baiaId,
        umidadePercentual: Number(umidadePercentual)
      });
      if (res?.ok) {
        setBaias(prev => prev.map(b => b.id === baiaId ? { ...b, ...res.baia } : b));
        toast ? toast.success(res.mensagem || 'Umidade atualizada e compensação de água recalculada!') : alert('Umidade atualizada!');
      }
    } catch (err) {
      console.error('Erro ao atualizar umidade:', err);
      toast ? toast.error('Falha ao atualizar umidade: ' + (err.message || 'Erro')) : alert('Erro');
    }
  };

  const handleConfirmarReabastecimento = async (e) => {
    e.preventDefault();
    setSalvandoSuprimento(true);
    try {
      const res = await api.post('/api/admin/concreto/suprimentos-silos/reabastecer', {
        ...formReabastecer,
        quantidade: Number(formReabastecer.quantidade)
      });
      if (res?.ok) {
        toast ? toast.success(res.mensagem || 'Reabastecimento registrado e estoque atualizado!') : alert('Sucesso!');
        setModalReabastecerAberto(false);
        carregarDados();
      }
    } catch (err) {
      console.error('Erro no reabastecimento:', err);
      toast ? toast.error('Falha no reabastecimento: ' + (err.message || 'Erro')) : alert('Erro');
    } finally {
      setSalvandoSuprimento(false);
    }
  };

  const handleExecutarDosagemBatelada = async (e) => {
    if (e) e.preventDefault();
    setSalvandoSuprimento(true);
    try {
      const res = await api.post('/api/admin/concreto/processo-producao/dosar-batelada', {
        ...formDoseBatelada,
        fck: Number(formDoseBatelada.fck),
        volumeM3: Number(formDoseBatelada.volumeM3),
        umidadeAreiaPercentual: Number(formDoseBatelada.umidadeAreiaPercentual)
      });
      if (res?.ok) {
        toast ? toast.success(res.mensagem || 'Batelada dosada com sucesso! NBR 7212 certificada.') : alert('Batelada dosada!');
        setModalDoseBateladaAberto(false);
        setModalTicketBateladaAberto(res.batelada);
        carregarDados();
      }
    } catch (err) {
      console.error('Erro na dosagem da batelada:', err);
      toast ? toast.error('Falha na dosagem: ' + (err.message || 'Erro')) : alert('Erro');
    } finally {
      setSalvandoSuprimento(false);
    }
  };

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
        setBaias(res.baias || []);
        setTanques(res.tanques || []);
        setEntradasSuprimentos(res.entradasSuprimentos || []);
        setBateladas(res.bateladas || []);
        setCompras(res.compras || []);
        setOrdensProducao(res.ordensProducao || []);
        setDragas(res.dragas || []);
        setPatiosMineracao(res.patiosMineracao || []);
        setVendasAgregados(res.vendasAgregados || []);
        setCameras(res.cameras || []);
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
      <main className={`serrano-main ${secaoAtiva === "torre-pesagem" ? "serrano-main-torre-full" : ""}`}>

        
        {/* Topbar Limpa */}
        <header className="serrano-topbar">
          <span className="serrano-crumb">
            Operação / <b>{secaoAtiva === 'torre-pesagem' ? 'TORRE DE CONTROLE' : (secaoAtiva.split('-')[1]?.toUpperCase() || 'DESPACHO AO VIVO')}</b>
            {secaoAtiva === 'torre-pesagem' && (
              <> / <span style={{ color: 'var(--serrano-orange)', fontWeight: 700 }}>
                {(SUBMODULOS_TORRE.find(m => m.id === subsecaoTorre)?.label || 'Torre').toUpperCase()}
              </span></>
            )}
          </span>

          {secaoAtiva !== 'torre-pesagem' ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ser-dim, #64748B)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 4, color: '#10B981', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }}></span>
                Telemetria CCO Ativa
              </span>
            </div>
          )}

          <span className="serrano-sync">
            <span className="serrano-dot-sync"></span>
            SEFAZ sincronizado
          </span>

          <button 
            type="button" 
            className="btn-serrano pri"
            onClick={() => setCopilotAberto(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '6px 14px', borderRadius: 6, fontSize: 12, boxShadow: '0 2px 6px rgba(234, 88, 12, 0.4)' }}
            title="Abrir Assistente Técnico KyttoIA para dosagem, pega e normas NBR"
          >
            <span>🤖</span>
            <span>Copilot KyttoIA</span>
            <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.25)', padding: '2px 4px', borderRadius: 4 }}>NBR 7212</span>
          </button>
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
            { id: "torre-pesagem", label: "Torre de Controle & Balança", icon: "🗼" },
            { id: "app-campo-assinatura", label: "App PWA & Canhoto em Campo", icon: "📱", count: cargas.filter(c => !c.assinaturaEntrega).length },
            { id: "operacao-programacao", label: "Programação de Cargas", icon: "📅" },
            { id: "operacao-frota", label: "Frota & Telemetria", icon: "🚛", count: frota.length },
            { id: "producao-central", label: "Central Dosadora NBR 7212", icon: "🏭" },
            { id: "producao-op", label: "Ordens de Produção", icon: "📋" },
            { id: "producao-laboratorio", label: "Laboratório & CPs (NBR 5739)", icon: "🔬", count: ensaios.length },
            { id: "suprimentos-silos", label: "Mineração & Silos 96t", icon: "⛏️", count: silos.length },
            { id: "financeiro-usina", label: "Financeiro & Fluxo de Caixa", icon: "💰" },
            { id: "vendas-faturamento", label: "Vendas & Notas Fiscais", icon: "📑" },
            { id: "comercial-propostas", label: "Orçamentos & Propostas", icon: "💼", count: propostas.length },
            { id: "empresa-holding", label: "Holding & Dados Fiscais", icon: "🏢" },
            { id: "cameras-cftv", label: "Câmeras IP & Vision AI", icon: "📹", count: cameras.length },
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

        {/* ─── SUBMENU INTEGRADO DA TORRE DE CONTROLE (SUB-ABAS NATIVAS) ─── */}
        {(secaoAtiva === 'torre-pesagem' || secaoAtiva === 'torre-controle') && (
          <nav className="serrano-subnav-tabs" aria-label="Submenu Torre de Controle e Pesagem">
            {SUBMODULOS_TORRE.map(sub => (
              <button
                key={sub.id}
                type="button"
                className={`serrano-subtab-pill ${subsecaoTorre === sub.id ? "ativo" : ""}`}
                onClick={() => setSubsecaoAtivaTorre(sub.id)}
                title={sub.desc}
              >
                <span>{sub.icon}</span>
                <span>{sub.label}</span>
                {sub.badge && (
                  <span className={`serrano-subtab-badge ${sub.badgeClass || ""}`}>
                    {sub.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}

        {secaoAtiva === "operacao-despacho" && (
          <>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--joint)' }}>
              <button
                type="button"
                className="btn-serrano"
                style={{
                  background: subAbaCentral === 'dosadora' ? 'var(--serrano-orange)' : 'transparent',
                  color: subAbaCentral === 'dosadora' ? '#fff' : 'var(--text)',
                  borderColor: subAbaCentral === 'dosadora' ? 'var(--serrano-orange)' : 'var(--joint)',
                  fontWeight: 600,
                  fontSize: 12
                }}
                onClick={() => setSubAbaCentral('dosadora')}
              >
                🏭 Central Dosadora Convicta NBR 7212
              </button>
              <button
                type="button"
                className="btn-serrano"
                style={{
                  background: subAbaCentral === 'auditoria' ? 'var(--serrano-orange)' : 'transparent',
                  color: subAbaCentral === 'auditoria' ? '#fff' : 'var(--text)',
                  borderColor: subAbaCentral === 'auditoria' ? 'var(--serrano-orange)' : 'var(--joint)',
                  fontWeight: 600,
                  fontSize: 12
                }}
                onClick={() => setSubAbaCentral('auditoria')}
              >
                📊 Auditoria Metrológica das 4 Balanças (NBR 7212)
              </button>
              <button
                type="button"
                className="btn-serrano"
                style={{
                  background: subAbaCentral === 'conectores' ? 'var(--serrano-orange)' : 'transparent',
                  color: subAbaCentral === 'conectores' ? '#fff' : 'var(--text)',
                  borderColor: subAbaCentral === 'conectores' ? 'var(--serrano-orange)' : 'var(--joint)',
                  fontWeight: 600,
                  fontSize: 12
                }}
                onClick={() => setSubAbaCentral('conectores')}
              >
                🔌 Conectores Industriais Modbus TCP &amp; Balanças
              </button>
            </div>

            {subAbaCentral === 'conectores' ? (
              <ConcretoConectoresIndustriais onVoltar={() => setSubAbaCentral('dosadora')} />
            ) : subAbaCentral === 'auditoria' ? (
              <ConcretoAuditoriaMetrologica />
            ) : (
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
          </div>
        )}

        {/* ─── ABA 3: LABORATÓRIO TECNOLÓGICO NBR 12655 / SHEWHART / CUSUM / BOxCrete / ASTM C1074 ─── */}
        {secaoAtiva === 'producao-laboratorio' && (
          <ConcretoLaboratorioTecnologico
            ensaios={ensaios}
            onAtualizarDados={carregarDados}
            onAbrirRomaneio={(c) => { setModalRomaneioAberto(c); setAbaRomaneio('romaneio'); }}
          />
        )}

        {/* ─── ABA 4: SUPRIMENTOS, SILOS & CONTROLE DE PROCESSO NBR 7212 ─── */}
        {secaoAtiva === 'suprimentos-silos' && (
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Header com KPIs e Ações Rápida */}
            <div className="serrano-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
                      Serrano Usina de Concreto · Suprimentos, Silos &amp; Controle de Processo
                    </h2>
                    <span className="serrano-pill serrano-p-ok" style={{ fontWeight: 700 }}>
                      NBR 7212 / NBR 6118
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    Telemetria de silos 96t, pátio de agregados, compensação de umidade e central dosadora computadorizada Convicta.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className="btn-serrano"
                    onClick={() => carregarDados()}
                    title="Atualizar telemetria e balanças"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.7L21 8"/><path d="M21 3v5h-5"/></svg>
                    Telemetria
                  </button>
                  <button 
                    type="button" 
                    className="btn-serrano"
                    onClick={() => setModalReabastecerAberto(true)}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                    Receber Carreta (Balança 80t)
                  </button>
                  <button 
                    type="button" 
                    className="btn-serrano pri"
                    onClick={() => setModalDoseBateladaAberto(true)}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    Dosar Batelada NBR 7212
                  </button>
                </div>
              </div>

              {/* 4 Cards de Métricas Industriais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 20 }}>
                <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <small style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Cimento em Silos 96t</small>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--serrano-orange-text)' }}>
                    {((silos.length > 0 ? silos : [
                      { estoqueAtualKg: 58400 }, { estoqueAtualKg: 22100 }, { estoqueAtualKg: 44500 }
                    ]).reduce((acc, s) => acc + (Number(s.nivelAtualKg || s.estoqueAtualKg || (s.estoqueAtualToneladas ? s.estoqueAtualToneladas * 1000 : 0)) / 1000), 0)).toFixed(1)} <span style={{ fontSize: 16 }}>ton</span>
                  </div>
                  <small style={{ color: 'var(--status-ok)', fontSize: 11 }}>● Pressão despoeiramento: 0.35 bar (Normal)</small>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <small style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Agregados no Pátio</small>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>
                    {((baias.length > 0 ? baias : [
                      { estoqueAtualToneladas: 320 }, { estoqueAtualToneladas: 285 }, { estoqueAtualToneladas: 190 }
                    ]).reduce((acc, b) => acc + (Number(b.estoqueAtualToneladas || b.nivelAtualTon || 0)), 0)).toFixed(0)} <span style={{ fontSize: 16 }}>ton</span>
                  </div>
                  <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Areia Sepotuba + Britas 0, 1 e 2</small>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <small style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Água Chiller 18°C</small>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--status-info)' }}>
                    48.500 <span style={{ fontSize: 16 }}>Litros</span>
                  </div>
                  <small style={{ color: 'var(--status-ok)', fontSize: 11 }}>● Temp: 18.2°C (Controle de hidratação)</small>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <small style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Bateladas NBR 7212 Hoje</small>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--status-ok)' }}>
                    {bateladas.length > 0 ? bateladas.length : 12} <span style={{ fontSize: 16 }}>cargas</span>
                  </div>
                  <small style={{ color: 'var(--status-ok)', fontSize: 11 }}>100% de conformidade metrológica</small>
                </div>
              </div>

              {/* Sub-Navegação em Abas Industriais */}
              <div style={{ display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid var(--joint)', paddingBottom: 10, flexWrap: 'wrap' }}>
                {[
                  { id: 'silos-patio', label: 'Silos 96t & Pátio de Agregados', icon: '🏭' },
                  { id: 'central-processo', label: 'Central Dosadora & Bateladas', icon: '⚡' },
                  { id: 'balanca-entradas', label: 'Entradas na Balança Rodoviária 80t', icon: '⚖️' },
                  { id: 'tanques-aditivos', label: 'Aditivos Químicos & Água Chiller', icon: '🧪' },
                  { id: 'reciclador-ecologico', label: 'Reciclador Ecológico & Sobras (CONAMA)', icon: '♻️' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    className={`btn-serrano ${subAbaSuprimentos === sub.id ? 'pri' : ''}`}
                    style={{ fontSize: 12, padding: '7px 14px' }}
                    onClick={() => setSubAbaSuprimentos(sub.id)}
                  >
                    <span>{sub.icon}</span> {sub.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SUB-ABA 1: SILOS & PÁTIO DE AGREGADOS */}
            {subAbaSuprimentos === 'silos-patio' && (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* Silos de Cimento */}
                <div className="serrano-card">
                  <div className="serrano-card-h">
                    <h3>Silos Verticais Metálicos Convicta 96t (Cimento &amp; Pozolana)</h3>
                    <small style={{ color: 'var(--text-muted)' }}>Sensores de nível por ultrassom e filtro de manga</small>
                  </div>
                  <div className="serrano-silos-grid">
                    {((silos.filter(s => (s.tipo === 'silo' || !s.tipo || (s.nome && s.nome.toLowerCase().includes('silo'))) && !s.id?.startsWith('patio-') && !s.id?.startsWith('box-') && !s.id?.startsWith('tanque-'))).length > 0 ? (silos.filter(s => (s.tipo === 'silo' || !s.tipo || (s.nome && s.nome.toLowerCase().includes('silo'))) && !s.id?.startsWith('patio-') && !s.id?.startsWith('box-') && !s.id?.startsWith('tanque-'))) : [
                      { id: 'sil-01', nome: 'Silo Cimento CP II-F-32', capacidadeToneladas: 96, nivelAtualToneladas: 68, pressaoDespoeiramento: '0.35 bar', produto: 'Cimento CP II-F-32' },
                      { id: 'sil-02', nome: 'Silo Cimento CP V-ARI', capacidadeToneladas: 60, nivelAtualToneladas: 42, pressaoDespoeiramento: '0.32 bar', produto: 'Cimento CP V Alta Resistência' },
                      { id: 'sil-03', nome: 'Silo Sílica Ativa / Pozolana', capacidadeToneladas: 40, nivelAtualToneladas: 24, pressaoDespoeiramento: '0.28 bar', produto: 'Adição Mineral Pozolânica' }
                    ]).map((s, idx) => {
                      const cap = Number(s.capacidadeTotalTon || s.capacidadeToneladas || s.capacidadeTon || 96);
                      const niv = Number(s.estoqueAtualTon || s.nivelAtualToneladas || s.nivelAtualTon || 0);
                      const perc = Number(s.nivelPercent || Math.min(100, Math.round((niv / cap) * 100)));
                      return (
                        <div key={s.id || idx} className="serrano-silo-card">
                          <div className="serrano-silo-bar-wrap">
                            <div className="serrano-silo-fill" style={{ height: `${perc}%` }}></div>
                          </div>
                          <b style={{ fontSize: 13 }}>{s.nome}</b>
                          <div style={{ fontFamily: 'var(--font-data)', fontSize: 16, fontWeight: 700, color: 'var(--serrano-orange-text)' }}>
                            {niv} / {cap} ton
                          </div>
                          <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>{perc}% de ocupação</small>
                          <div style={{ fontSize: 11, color: 'var(--status-ok)', marginTop: 4 }}>
                            Filtro: {s.pressaoDespoeiramento || '0.35 bar'}
                          </div>
                          <button
                            type="button"
                            className="btn-serrano"
                            style={{ marginTop: 10, fontSize: 11, padding: '4px 8px', width: '100%' }}
                            onClick={() => {
                              setFormReabastecer(prev => ({
                                ...prev,
                                destinoId: s.id,
                                tipoDestino: 'silo',
                                produto: s.produto || s.nome,
                                quantidade: 32
                              }));
                              setModalReabastecerAberto(true);
                            }}
                          >
                            + Abastecer Silo
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pátio de Agregados e Controle de Umidade */}
                <div className="serrano-card">
                  <div className="serrano-card-h">
                    <h3>Pátio de Agregados &amp; Correção de Umidade da Areia (NBR 7212)</h3>
                    <small style={{ color: 'var(--text-muted)' }}>Compensação automática no hidrômetro de dosagem</small>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                      {(baias.length > 0 ? baias : [
                        { id: 'baia-01', nome: 'Baia 01 · Areia Média Lavada', material: 'Areia de Dragagem Rio Sepotuba', estoqueAtualToneladas: 320, capacidadeToneladas: 450, umidadePercentual: 4.5, aguaContidaLitros: 14400 },
                        { id: 'baia-02', nome: 'Baia 02 · Areia Fina', material: 'Areia Fina Rio Sepotuba', estoqueAtualToneladas: 180, capacidadeToneladas: 300, umidadePercentual: 3.2, aguaContidaLitros: 5760 },
                        { id: 'baia-03', nome: 'Baia 03 · Brita 0 (Pedrisco)', material: 'Pedrisco Basáltico 4,75 a 9,5mm', estoqueAtualToneladas: 190, capacidadeToneladas: 300, umidadePercentual: 1.0, aguaContidaLitros: 1900 },
                        { id: 'baia-04', nome: 'Baia 04 · Brita 1 Granítica', material: 'Brita 1 Granítica 9,5 a 19mm', estoqueAtualToneladas: 285, capacidadeToneladas: 400, umidadePercentual: 0.8, aguaContidaLitros: 2280 },
                        { id: 'baia-05', nome: 'Baia 05 · Brita 2', material: 'Brita 2 Granítica 19 a 25mm', estoqueAtualToneladas: 300, capacidadeToneladas: 400, umidadePercentual: 0.5, aguaContidaLitros: 1500 }
                      ]).map(baia => (
                        <div key={baia.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <b style={{ fontSize: 13 }}>{baia.nome}</b>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{baia.material}</div>
                            </div>
                            <span className="serrano-pill serrano-p-ok" style={{ fontSize: 11 }}>
                              {baia.estoqueAtualToneladas} ton
                            </span>
                          </div>

                          <div style={{ marginTop: 12, padding: 10, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--joint)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>Teor de Umidade:</span>
                              <b style={{ fontFamily: 'var(--font-data)', fontSize: 14, color: 'var(--serrano-orange-text)' }}>
                                {baia.umidadePercentual}%
                              </b>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.1"
                              className="serrano-slider"
                              value={baia.umidadePercentual || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setBaias(prev => prev.map(b => b.id === baia.id ? { ...b, umidadePercentual: val } : b));
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                              <span>Água Contida: <b>{Math.round(baia.estoqueAtualToneladas * (baia.umidadePercentual / 100) * 1000).toLocaleString('pt-BR')} L</b></span>
                              <button
                                type="button"
                                className="btn-serrano"
                                style={{ fontSize: 10, padding: '3px 8px' }}
                                onClick={() => handleSalvarUmidadeBaia(baia.id, baia.umidadePercentual)}
                              >
                                Salvar Umidade
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-ABA 2: CENTRAL DOSADORA & BATELADAS NBR 7212 */}
            {subAbaSuprimentos === 'central-processo' && (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* Simulador / Dosador Rápido */}
                <div className="serrano-grid-2col">
                  <div className="serrano-card">
                    <div className="serrano-card-h">
                      <h3>Central Dosadora Automatizada Convicta NBR 7212</h3>
                      <span className="serrano-pill serrano-p-ok">Online · Automação CLP</span>
                    </div>
                    <div style={{ padding: 20 }}>
                      <div className="serrano-form-row">
                        <label>Traço / Resistência Característica (FCK)</label>
                        <select 
                          className="serrano-input"
                          value={calcFck}
                          onChange={e => setCalcFck(Number(e.target.value))}
                        >
                          <option value={15}>FCK 15 MPa · Concreto Magro / Lastro</option>
                          <option value={20}>FCK 20 MPa · Pisos e Baldrames</option>
                          <option value={25}>FCK 25 MPa · Lajes, Vigas e Pilares Convencionais</option>
                          <option value={30}>FCK 30 MPa · Estrutural Pesado / Bombeado</option>
                          <option value={35}>FCK 35 MPa · Pisos Industriais de Alta Abrasão</option>
                          <option value={40}>FCK 40 MPa · Obras Especiais e Pontes</option>
                          <option value={45}>FCK 45 MPa · Concreto de Alto Desempenho (CAD)</option>
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                          <label>Umidade da Areia (%)</label>
                          <input 
                            type="number" 
                            className="serrano-input"
                            value={calcUmidadeAreia}
                            step="0.1"
                            onChange={e => setCalcUmidadeAreia(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                        💡 <b>Compensação Automática NBR 7212:</b> Com a areia a <b>{calcUmidadeAreia}%</b> de umidade, a central abate automaticamente <b>{dosagemCalculada.aguaDescontadaL} Litros</b> de água líquida da pesagem para manter o Fator a/c exato.
                      </div>

                      <button
                        type="button"
                        className="btn-serrano pri"
                        style={{ width: '100%', marginTop: 16, padding: '12px', fontSize: 14, fontWeight: 700 }}
                        onClick={() => {
                          setFormDoseBatelada({
                            fck: calcFck,
                            volumeM3: calcVolume,
                            betoneira: 'BT-01',
                            umidadeAreiaPercentual: calcUmidadeAreia,
                            britaTipo: 'Brita 1',
                            slumpAlvo: '14 ± 2 cm'
                          });
                          setModalDoseBateladaAberto(true);
                        }}
                      >
                        ⚡ Disparar Dosagem Automática desta Carga
                      </button>
                    </div>
                  </div>

                  {/* 4 Balanças da Central ao Vivo */}
                  <div className="serrano-card">
                    <div className="serrano-card-h">
                      <h3>Balanças Eletrônicas da Central (Pesagem Teórica)</h3>
                    </div>
                    <div style={{ padding: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--joint)' }}>
                          <small style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Balança 1 · Cimento CP II</small>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>
                            {dosagemCalculada.cimentoTotalKg.toLocaleString('pt-BR')} kg
                          </div>
                          <small style={{ color: 'var(--status-ok)', fontSize: 11 }}>Tolerância NBR: ±1.0%</small>
                        </div>

                        <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--joint)' }}>
                          <small style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Balança 2 · Areia Úmida</small>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>
                            {dosagemCalculada.areiaUmidaKg || dosagemCalculada.areiaTotalKg} kg
                          </div>
                          <small style={{ color: 'var(--status-ok)', fontSize: 11 }}>Água na areia: {dosagemCalculada.aguaDescontadaL} L</small>
                        </div>

                        <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--joint)' }}>
                          <small style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Balança 3 · Brita 1 Basáltica</small>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>
                            {dosagemCalculada.brita1Kg || dosagemCalculada.britaTotalKg} kg
                          </div>
                          <small style={{ color: 'var(--status-ok)', fontSize: 11 }}>Tolerância NBR: ±2.0%</small>
                        </div>

                        <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--joint)' }}>
                          <small style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Balança 4 · Água Líquida Efetiva</small>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--status-info)' }}>
                            {dosagemCalculada.aguaTotalL.toLocaleString('pt-BR')} L
                          </div>
                          <small style={{ color: 'var(--status-ok)', fontSize: 11 }}>Fator a/c alvo: {dosagemCalculada.fatorAc}</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Histórico de Bateladas Realizadas */}
                <div className="serrano-card">
                  <div className="serrano-card-h">
                    <h3>Registro de Bateladas NBR 7212 (Rastreabilidade de Usina)</h3>
                    <small style={{ color: 'var(--text-muted)' }}>Pesagens registradas por célula de carga com lacre metrológico</small>
                  </div>
                  <div className="serrano-table-wrap">
                    <table className="serrano-table">
                      <thead>
                        <tr>
                          <th>Ticket NBR</th>
                          <th>Data/Hora</th>
                          <th>Betoneira</th>
                          <th>FCK</th>
                          <th>Volume</th>
                          <th>Cimento (kg)</th>
                          <th>Água (L)</th>
                          <th>Fator a/c</th>
                          <th>Conformidade</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(bateladas.length > 0 ? bateladas : [
                          { id: 'bat-01', numeroTicket: 'BAT-2026-10491', dataHora: '2026-11-12 14:15', betoneiraCodigo: 'BT-01', fck: 30, volumeM3: 8, cimentoPesadoKg: 2802, aguaLiquidaPesadaLitros: 1118, fatorAcReal: 0.49, conformidadeNBR7212: 'TOTALMENTE_CONFORME', motorista: 'Valdir Silveira' }
                        ]).map(b => (
                          <tr key={b.id}>
                            <td><b style={{ fontFamily: 'var(--font-data)' }}>{b.numeroTicket || b.id}</b></td>
                            <td style={{ fontSize: 11 }}>{b.dataHora || b.horario || '12/11 14:00'}</td>
                            <td><span className="serrano-pill">{b.betoneiraCodigo || b.betoneira?.split(' ')[0] || 'BT-01'}</span></td>
                            <td><b>{typeof b.fck === 'number' ? `FCK ${b.fck}` : b.fck}</b></td>
                            <td>{b.volumeM3 || b.volumeBateladaM3 || 8} m³</td>
                            <td style={{ fontFamily: 'var(--font-data)' }}>{b.cimentoPesadoKg || b.cimentoKg || 2800} kg</td>
                            <td style={{ fontFamily: 'var(--font-data)' }}>{b.aguaLiquidaPesadaLitros || b.aguaRealAdicionadaLitros || b.aguaLitros || 1050} L</td>
                            <td style={{ fontFamily: 'var(--font-data)' }}>{b.fatorAcReal || b.fatorAc || 0.48}</td>
                            <td>
                              <span className="serrano-pill serrano-p-ok" style={{ fontSize: 10 }}>
                                {b.conformidadeNBR7212}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-serrano"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => setModalTicketBateladaAberto(b)}
                              >
                                Ver Ticket
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-ABA 3: ENTRADAS NA BALANÇA RODOVIÁRIA 80T */}
            {subAbaSuprimentos === 'balanca-entradas' && (
              <div className="serrano-card">
                <div className="serrano-card-h">
                  <h3>Descargas &amp; Entradas de Matéria-Prima na Balança Rodoviária 80t</h3>
                  <button 
                    type="button" 
                    className="btn-serrano pri"
                    onClick={() => setModalReabastecerAberto(true)}
                  >
                    + Receber Carreta
                  </button>
                </div>
                <div className="serrano-table-wrap">
                  <table className="serrano-table">
                    <thead>
                      <tr>
                        <th>Ticket Balança</th>
                        <th>Data/Hora</th>
                        <th>Insumo</th>
                        <th>Destino</th>
                        <th>Placa / Motorista</th>
                        <th>Bruto (kg)</th>
                        <th>Tara (kg)</th>
                        <th>Líquido (ton)</th>
                        <th>Fornecedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(entradasSuprimentos.length > 0 ? entradasSuprimentos : [
                        { id: 'ent-01', ticketBalanca: 'TKT-80T-8941', dataHora: '2026-11-12 09:30', insumo: 'Cimento Portland CP II-F-32', destinoNome: 'Silo 01', placaVeiculo: 'RBD-4E80', motorista: 'Valdir Silveira', pesoBrutoKg: 49500, pesoTaraKg: 17500, pesoLiquidoToneladas: 32.0, fornecedor: 'Votorantim Cimentos S.A.' }
                      ]).map(e => (
                        <tr key={e.id}>
                          <td><b style={{ fontFamily: 'var(--font-data)' }}>{e.ticketBalanca || e['ticketBalança'] || e.ticket || e.id}</b></td>
                          <td style={{ fontSize: 11 }}>{e.dataHora || '12/11/2026 09:15'}</td>
                          <td><b>{e.insumo || e.material}</b></td>
                          <td><span className="serrano-pill">{e.destinoNome || e.destino}</span></td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{e.placaVeiculo || e.placaCarreta || e.placa}</div>
                            <small style={{ color: 'var(--text-muted)' }}>{e.motorista}</small>
                          </td>
                          <td style={{ fontFamily: 'var(--font-data)' }}>{(e.pesoBrutoKg || e.pesoBruto)?.toLocaleString('pt-BR')}</td>
                          <td style={{ fontFamily: 'var(--font-data)' }}>{(e.pesoTaraKg || e.tara)?.toLocaleString('pt-BR')}</td>
                          <td>
                            <b style={{ fontFamily: 'var(--font-data)', color: 'var(--serrano-orange-text)', fontSize: 14 }}>
                              {e.pesoLiquidoToneladas || (e.pesoLiquido ? (Number(e.pesoLiquido) / 1000).toFixed(1) : '32.0')} ton
                            </b>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.fornecedor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-ABA 4: ADITIVOS QUÍMICOS & ÁGUA CHILLER */}
            {subAbaSuprimentos === 'tanques-aditivos' && (
              <div className="serrano-card">
                <div className="serrano-card-h">
                  <h3>Tanques de Aditivos Químicos &amp; Reservatório de Água Chiller (18°C)</h3>
                  <small style={{ color: 'var(--text-muted)' }}>Dosagem eletropneumática automática por m³ de concreto</small>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    {(tanques.length > 0 ? tanques : [
                      { id: 'tq-01', nome: 'Tanque 01 · Plastificante Polifuncional', produto: 'Aditivo Plastificante TecFlow', capacidadeLitros: 5000, nivelAtualLitros: 3800, dosagemKgPorM3: '0.8 a 1.2 kg/m³' },
                      { id: 'tq-02', nome: 'Tanque 02 · Superplastificante', produto: 'Policarboxilato de 3ª Geração', capacidadeLitros: 5000, nivelAtualLitros: 4100, dosagemKgPorM3: '0.6 a 1.0 kg/m³' },
                      { id: 'tq-03', nome: 'Tanque 03 · Retardador de Pega', produto: 'Retardador para Clima Quente >32°C', capacidadeLitros: 3000, nivelAtualLitros: 1950, dosagemKgPorM3: '0.3 a 0.5 kg/m³' },
                      { id: 'tq-04', nome: 'Tanque 04 · Água Resfriada (Chiller)', produto: 'Água a 18°C p/ controle de calor de hidratação', capacidadeLitros: 60000, nivelAtualLitros: 48500, dosagemKgPorM3: 'Conforme traço NBR' }
                    ]).map(t => {
                      const perc = Math.round((t.nivelAtualLitros / t.capacidadeLitros) * 100);
                      return (
                        <div key={t.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16 }}>
                          <b style={{ fontSize: 13, display: 'block' }}>{t.nome}</b>
                          <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>{t.produto}</small>
                          
                          <div style={{ background: 'var(--joint)', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                            <div style={{ background: t.id === 'tq-04' ? 'var(--status-info)' : 'var(--serrano-orange)', width: `${perc}%`, height: '100%' }}></div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b style={{ fontFamily: 'var(--font-data)', fontSize: 15 }}>
                              {t.nivelAtualLitros?.toLocaleString('pt-BR')} / {t.capacidadeLitros?.toLocaleString('pt-BR')} L
                            </b>
                            <span className="serrano-pill serrano-p-ok">{perc}%</span>
                          </div>
                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                            Dosagem padrão: <b>{t.dosagemKgPorM3}</b>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
        
        {/* ─── ABA: TORRE DE CONTROLE DE PESAGEM & GÊMEO DIGITAL ─── */}
        {(secaoAtiva === 'torre-pesagem' || secaoAtiva === 'torre-controle') && (
          <TorreDeControlePesagemSerrano
            subsecao={subsecaoTorre}
            onSubsecaoChange={setSubsecaoAtivaTorre}
            onVoltar={() => setSecaoAtiva('operacao-despacho')}
          />
        )}

        {/* ─── ABA 11: CÂMERAS IP INDUSTRIAIS & VISION AI (LPR / BALANÇA / SILOS) ─── */}
        {secaoAtiva === 'cameras-cftv' && (
          <ConcretoCamerasVisionAI
            empresaAtivaId={empresaAtiva || empresa?.id}
            onVoltar={() => setSecaoAtiva('operacao-despacho')}
          />
        )}

        {/* ─── ABA: APP PWA & CANHOTO DIGITAL EM CAMPO (APK / TOUCH) ─── */}
        {(secaoAtiva === 'app-campo-assinatura' || secaoAtiva === 'app-campo') && (
          <ConcretoAppCampoPainel
            cargas={cargas}
            frota={frota}
            onRecarregar={carregarDados}
          />
        )}

        {secaoAtiva === 'empresa-holding' && (
          <HoldingGrupoPalatare setSecaoAtiva={setSecaoAtiva} />
        )}


        {/* ─── ABA 1B: PROGRAMAÇÃO DE CONCRETAGENS & AGENDA INTERATIVA ─── */}
        {secaoAtiva === 'operacao-programacao' && (
          <ProgramacaoCargasAgenda
            cargas={cargas}
            frota={frota}
            onAtualizarDados={carregarDados}
            onAbrirRomaneio={(c) => { setModalRomaneioAberto(c); setAbaRomaneio('romaneio'); }}
            onAbrirTicketBalanca={(c) => { setModalRomaneioAberto(c); setAbaRomaneio('balanca'); }}
          />
        )}

        {/* ─── ABA 1C: FROTA & TELEMETRIA ─── */}
        {secaoAtiva === 'operacao-frota' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Sub-navegação da Frota */}
            <div style={{ display: 'flex', gap: 8, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--joint)', flexWrap: 'wrap' }}>
              {[
                { id: 'telemetria', label: 'Telemetria de Sensores (RPM)', icon: '🚛' },
                { id: 'gps', label: 'Rastreamento GPS Tangará da Serra', icon: '🗺️' },
                { id: 'checklist', label: 'Checklist Pré-Operacional NR-11/12', icon: '📋' },
                { id: 'bombas-nbr15649', label: 'Bombas Lança & Vento NBR 15649', icon: '⚡' }
              ].map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  className="btn-serrano"
                  style={{
                    background: subAbaFrota === sub.id ? 'var(--serrano-orange)' : 'transparent',
                    color: subAbaFrota === sub.id ? '#fff' : 'var(--text)',
                    borderColor: subAbaFrota === sub.id ? 'var(--serrano-orange)' : 'var(--joint)',
                    fontWeight: 600,
                    fontSize: 12
                  }}
                  onClick={() => setSubAbaFrota(sub.id)}
                >
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>

            {subAbaFrota === 'gps' && <ConcretoMapaGpsFrota />}
            {subAbaFrota === 'checklist' && <ConcretoChecklistFrota />}
            {subAbaFrota === 'bombas-nbr15649' && (
              <div className="serrano-card" style={{ padding: 20 }}>
                <div className="serrano-card-h" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Telemetria de Bombas Lança 36m/42m & Segurança Operacional (ABNT NBR 15649)</h3>
                    <small style={{ color: 'var(--text-muted)' }}>
                      Anemômetro ultrassônico com trava por vento crítico (> 48 km/h), pressão hidráulica e cálculo contínuo de vida útil da tubulação 5'.
                    </small>
                  </div>
                  <span className="serrano-pill serrano-p-ok" style={{ fontWeight: 800 }}>
                    Motor KyttoIA 2.5 Flash
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                  {/* Card 1: Vento e Anemômetro */}
                  <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, border: '1px solid var(--joint)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Velocidade do Vento na Lança</span>
                      <span className="serrano-pill serrano-p-ok" style={{ fontSize: 10, fontWeight: 800 }}>ESTÁVEL</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, color: '#0284c7', margin: '8px 0 4px' }}>
                      32 <span style={{ fontSize: 16 }}>km/h</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Limite Normativo NBR 15649: <b>48 km/h</b> (Corte Elétrico Automático)
                    </div>
                    <div style={{ marginTop: 10, background: '#e2e8f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: '66%', height: '100%', background: '#0284c7' }}></div>
                    </div>
                  </div>

                  {/* Card 2: Pressão Hidráulica */}
                  <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, border: '1px solid var(--joint)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Circuito Hidráulico Principal</span>
                      <span className="serrano-pill serrano-p-ok" style={{ fontSize: 10, fontWeight: 800 }}>NOMINAL</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, color: 'var(--status-ok)', margin: '8px 0 4px' }}>
                      220 <span style={{ fontSize: 16 }}>bar</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Pressão nominal de bombeamento (Alívio aos 280 bar)
                    </div>
                    <div style={{ marginTop: 10, background: '#e2e8f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: '78%', height: '100%', background: '#10b981' }}></div>
                    </div>
                  </div>

                  {/* Card 3: Tubulação 5'' e Desgaste */}
                  <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, border: '1px solid var(--joint)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tubulação Aço Especial 5'</span>
                      <span className="serrano-pill serrano-p-load" style={{ fontSize: 10, fontWeight: 800 }}>26.2% VIDA ÚTIL</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, color: 'var(--serrano-orange-text)', margin: '8px 0 4px' }}>
                      2.65 <span style={{ fontSize: 16 }}>mm</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Original: 4.5 mm · Limite de Descarte: <b>2.0 mm</b> (~6.550 m³ restantes)
                    </div>
                    <div style={{ marginTop: 10, background: '#e2e8f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: '26%', height: '100%', background: 'var(--serrano-orange)' }}></div>
                    </div>
                  </div>
                </div>

                {/* Caixa de Ação Autônoma da Bomba */}
                <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid var(--joint)', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <b style={{ fontSize: 13, color: '#0f172a' }}>Equipamento Escalado: Bomba Lança Schwing S36X (36m / 4 seções)</b>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Telemetria via sensor CAN bus J1939 e anemômetro Gill WindSonic integrado ao CCO da Usina MT-358.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-serrano pri"
                    onClick={async () => {
                      try {
                        const res = await api.post('/api/concreto-torre/bombas/auditar-desgaste', { velocidadeVentoKmh: 34, pressaoHidraulicaBar: 225, volumeBombeadoM3: 88 });
                        if (res?.data?.ok) {
                        }
                      } catch (e) {
                        alert('Erro ao auditar bomba: ' + e.message);
                      }
                    }}
                  >
                    ⚡ Auditar Desgaste & Segurança NBR 15649
                  </button>
                </div>
              </div>
            )}
            {subAbaFrota === 'telemetria' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <div>
                <h3>Telemetria de Frota em Tempo Real · Betoneiras &amp; Bombas Lança</h3>
                <small style={{ color: 'var(--text-muted)' }}>Tacômetro de rotação do balão (RPM), temperatura da massa, sensor de água e cronômetro de pega NBR 7212</small>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['todos', 'betoneira', 'bomba_lanca'].map(tp => (
                  <button
                    key={tp}
                    type="button"
                    className="btn-serrano"
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      background: filtroFrotaTipo === tp ? 'var(--serrano-orange)' : 'transparent',
                      color: filtroFrotaTipo === tp ? '#fff' : 'var(--text)',
                      borderColor: filtroFrotaTipo === tp ? 'var(--serrano-orange)' : 'var(--joint)'
                    }}
                    onClick={() => setFiltroFrotaTipo(tp)}
                  >
                    {tp === 'todos' ? 'Todos os Veículos' : tp === 'betoneira' ? 'Betoneiras (8 a 10m³)' : 'Bombas Lança'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {(frota.length > 0 ? frota : []).filter(f => filtroFrotaTipo === 'todos' || f.tipo === filtroFrotaTipo).map((f, idx) => {
                  const isBetoneira = f.tipo === 'betoneira';
                  const rpm = f.rpmTambor != null ? f.rpmTambor : 3.2;
                  const tempoPega = f.tempoDesdeAdicaoAguaMin || 38;
                  const limitePega = f.limitePegaMin || 150;
                  const percPega = Math.min(100, Math.round((tempoPega / limitePega) * 100));

                  return (
                    <div key={f.id || idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <b style={{ fontFamily: 'var(--font-data)', fontSize: 16, color: 'var(--serrano-orange-text)' }}>{f.codigo || f.id}</b>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Placa: <b>{f.placa}</b></span>
                        </div>
                        <span className={`serrano-pill ${f.status === 'em_transito' || f.status === 'em_rota' ? 'serrano-p-live' : f.status === 'na_obra' ? 'serrano-p-ok' : f.status === 'carregando' ? 'serrano-p-load' : 'serrano-p-ok'}`}>
                          {f.status === 'em_transito' || f.status === 'em_rota' ? 'Em Trânsito' : f.status === 'na_obra' ? 'Operando na Obra' : f.status === 'carregando' ? 'Carregando na Usina' : 'Disponível no Pátio'}
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{f.modelo}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {isBetoneira ? `Capacidade: ${f.capacidadeM3 || 8} m³` : `Alcance Lança: ${f.alcanceMetros || 32} metros`}
                        {' · '}Motorista: <b>{f.motorista || f.operador}</b>
                      </div>

                      {/* BLOCO ESPECÍFICO DE BETONEIRA */}
                      {isBetoneira && (
                        <div style={{ marginTop: 12, background: 'var(--surface)', padding: 10, borderRadius: 6, border: '1px solid var(--joint)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <small style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Rotação do Balão (RPM)</small>
                              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: rpm > 8 ? '#0284c7' : rpm > 0 ? '#10b981' : 'var(--text-muted)' }}>
                                {rpm > 0 ? `${rpm} RPM` : '0.0 RPM (Parado)'}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, background: 'var(--surface-2)', padding: '4px 8px', borderRadius: 4, fontWeight: 600 }}>
                              {rpm > 8 ? '⚡ Mistura Rápida' : rpm > 0 ? '🔄 Agitação em Trânsito' : '⏹️ Estacionado'}
                            </span>
                          </div>

                          {/* Temperatura da Massa e Sensor de Água */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: 11 }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Temp. da Massa:</span>{' '}
                              <b>{f.temperaturaMassa ? `${f.temperaturaMassa} °C` : 'Ambiente'}</b>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Água no Trajeto:</span>{' '}
                              <b style={{ color: 'var(--status-ok)' }}>0 Litros (Inviolável)</b>
                            </div>
                          </div>

                          {/* Cronômetro de Pega NBR 7212 (Máx 150 min) */}
                          <div style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                              <span>Tempo desde adição de água (NBR 7212):</span>
                              <b>{tempoPega} min / {limitePega} min</b>
                            </div>
                            <div style={{ width: '100%', height: 6, background: 'var(--surface-2)', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${percPega}%`, height: '100%', background: percPega > 80 ? 'var(--status-danger)' : percPega > 60 ? 'var(--status-warn)' : 'var(--status-ok)' }}></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* BLOCO ESPECÍFICO DE BOMBA LANÇA */}
                      {!isBetoneira && (
                        <div style={{ marginTop: 12, background: 'var(--surface)', padding: 10, borderRadius: 6, border: '1px solid var(--joint)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Pressão Hidráulica:</span>{' '}
                              <b>{f.pressaoHidraulicaBar ? `${f.pressaoHidraulicaBar} bar` : '0 bar'}</b>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Vazão Efetiva:</span>{' '}
                              <b>{f.vazaoM3Hora ? `${f.vazaoM3Hora} m³/h` : '0 m³/h'}</b>
                            </div>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Estabilização Sapatas:</span>{' '}
                            <b style={{ color: 'var(--status-ok)' }}>{f.estabilizacaoSapatas || '100% Ancorado'}</b>
                          </div>
                        </div>
                      )}

                      {/* Destino Atual */}
                      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--joint)', paddingTop: 8 }}>
                        Destino: <b>{f.obraDestino || f.obraAtual || 'Pátio Central da Usina Serrano'}</b>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
            )}
          </div>
        )}
{/* ─── ABA 2B: ORDENS DE PRODUÇÃO (OPS) ─── */}
        {secaoAtiva === 'producao-op' && (
          <div className="serrano-card">
            <div className="serrano-card-h">
              <div>
                <h3>Ordens de Produção (Bateladas Industriais &amp; Pesagem dos Silos)</h3>
                <small style={{ color: 'var(--text-muted)' }}>Rastreabilidade de bateladas NBR 7212 com consumo real de cimento e agregados</small>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {(ordensProducao.length > 0 ? ordensProducao : [
                  { numero: 'OP-2026-091', dataHora: '2026-11-12 08:30:00', obra: 'Edifício Residencial Serra Dourada · Lajes 4º Pav.', cliente: 'Construtora MT Horizon', fck: 30, volumeM3: 24, totalBateladas: 3, betoneirasEscaladas: ['BT-01', 'BT-02', 'BT-03'], status: 'concluida' },
                  { numero: 'OP-2026-092', dataHora: '2026-11-12 13:45:00', obra: 'Piso Industrial Galpão de Cargas · Etapa 2', cliente: 'AgroLog Transportes & Logística', fck: 35, volumeM3: 32, totalBateladas: 4, betoneirasEscaladas: ['BT-04', 'BT-05'], status: 'em_pesagem' },
                  { numero: 'OP-2026-093', dataHora: '2026-11-12 16:15:00', obra: 'Casa Térrea Lote 12 Qd. 08 · Vigas e Baldrames', cliente: 'Eng. Marcelo Dantas', fck: 25, volumeM3: 16, totalBateladas: 2, betoneirasEscaladas: ['BT-03'], status: 'programada' }
                ]).map((op, idx) => (
                  <div key={op.numero || idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ fontFamily: 'var(--font-data)', fontSize: 15, color: 'var(--serrano-orange-text)' }}>{op.numero}</b>
                        <span className={`serrano-pill ${op.status === 'concluida' ? 'serrano-p-ok' : op.status === 'em_pesagem' ? 'serrano-p-live' : 'serrano-p-load'}`}>
                          {op.status === 'concluida' ? 'Concluída' : op.status === 'em_pesagem' ? 'Pesagem dos Silos' : 'Programada'}
                        </span>
                        <small style={{ color: 'var(--text-muted)' }}>{op.dataHora}</small>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{op.obra}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cliente: {op.cliente}</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        Traço: <b>FCK {op.fck} MPa</b> · Volume: <b>{op.volumeM3} m³</b> ({op.totalBateladas} bateladas de usina) · Veículos: <b>{(op.betoneirasEscaladas || []).join(', ')}</b>
                      </div>
                    </div>
                    <div>
                      <button 
                        type="button" 
                        className="btn-serrano"
                        onClick={() => alert(`Ordem de Produção ${op.numero} impressa com sucesso!`)}
                      >
                        Imprimir Ordem
                      </button>
                    </div>
                  </div>
                ))}
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

        {/* ─── ABA 10: VENDAS, FATURAMENTO & NOTAS FISCAIS (NF-e / NFS-e) ─── */}
        {(secaoAtiva === 'vendas-faturamento' || secaoAtiva === 'vendas') && (
          <ConcretoVendasFaturamento
            cargas={cargas}
            onAbrirRomaneio={(c) => { setModalRomaneioAberto(c); setAbaRomaneio('romaneio'); }}
            onAbrirTicketBalanca={(c) => { setModalRomaneioAberto(c); setAbaRomaneio('balanca'); }}
          />
        )}

        {/* ─── ABA 11: FINANCEIRO, FLUXO DE CAIXA & MEDIÇÕES DE OBRAS ─── */}
        {(secaoAtiva === 'financeiro-usina' || secaoAtiva === 'financeiro') && (
          <ConcretoFinanceiroUsina cargas={cargas} />
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

      {/* ─── MODAL REABASTECIMENTO DE SILO / BAIA (BALANÇA 80T) ─── */}
      {modalReabastecerAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 520 }}>
            <h2>Receber Carreta de Matéria-Prima · Balança 80t</h2>
            <form onSubmit={handleConfirmarReabastecimento} style={{ marginTop: 14 }}>
              <div className="serrano-form-row">
                <label>Destino de Descarga</label>
                <select 
                  className="serrano-input"
                  value={formReabastecer.destinoId}
                  onChange={e => {
                    const id = e.target.value;
                    const isSilo = id.startsWith('sil') || id.startsWith('silo');
                    setFormReabastecer(prev => ({
                      ...prev,
                      destinoId: id,
                      tipoDestino: isSilo ? 'silo' : 'baia',
                      produto: isSilo ? 'Cimento Portland CP II-F-32' : 'Areia de Dragagem Rio Sepotuba'
                    }));
                  }}
                >
                  <option value="silo-01">Silo 01 · Cimento CP II-F-32 (96t)</option>
                  <option value="silo-02">Silo 02 · Cimento CP V-ARI (60t)</option>
                  <option value="silo-03">Silo 03 · Pozolana / Sílica (40t)</option>
                  <option value="baia-01">Baia 01 · Areia Média Lavada</option>
                  <option value="baia-02">Baia 02 · Areia Fina Rio Sepotuba</option>
                  <option value="baia-03">Baia 03 · Brita 0 (Pedrisco)</option>
                  <option value="baia-04">Baia 04 · Brita 1 Granítica</option>
                  <option value="baia-05">Baia 05 · Brita 2 Granítica</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="serrano-form-row">
                  <label>Peso Líquido (toneladas)</label>
                  <input 
                    type="number"
                    step="0.1"
                    className="serrano-input"
                    value={formReabastecer.quantidade}
                    onChange={e => setFormReabastecer(prev => ({ ...prev, quantidade: e.target.value }))}
                    required
                  />
                </div>
                <div className="serrano-form-row">
                  <label>Ticket Balança Rodoviária</label>
                  <input 
                    type="text"
                    className="serrano-input"
                    value={formReabastecer.ticketBalanca}
                    onChange={e => setFormReabastecer(prev => ({ ...prev, ticketBalanca: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="serrano-form-row">
                  <label>Placa do Veículo</label>
                  <input 
                    type="text"
                    className="serrano-input"
                    value={formReabastecer.placa}
                    onChange={e => setFormReabastecer(prev => ({ ...prev, placa: e.target.value }))}
                  />
                </div>
                <div className="serrano-form-row">
                  <label>Motorista</label>
                  <input 
                    type="text"
                    className="serrano-input"
                    value={formReabastecer.motorista}
                    onChange={e => setFormReabastecer(prev => ({ ...prev, motorista: e.target.value }))}
                  />
                </div>
              </div>

              <div className="serrano-form-row">
                <label>Transportadora / Fornecedor</label>
                <input 
                  type="text"
                  className="serrano-input"
                  value={formReabastecer.transportadora}
                  onChange={e => setFormReabastecer(prev => ({ ...prev, transportadora: e.target.value }))}
                />
              </div>

              <div className="serrano-modal-footer">
                <button type="button" className="btn-serrano" onClick={() => setModalReabastecerAberto(false)}>Cancelar</button>
                <button type="submit" className="btn-serrano pri" disabled={salvandoSuprimento}>
                  {salvandoSuprimento ? 'Gravando...' : 'Confirmar Descarga & Reabastecer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DISPARO DE BATELADA AUTOMATIZADA NBR 7212 ─── */}
      {modalDoseBateladaAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 540 }}>
            <h2>Acionar Dosagem Automatizada · NBR 7212</h2>
            <form onSubmit={handleExecutarDosagemBatelada} style={{ marginTop: 14 }}>
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
                ⚡ <b>Central Convicta:</b> O acionamento executará o ciclo de pesagem nas 4 balanças digitais e iniciará a descarga direta na betoneira selecionada com compensação metrológica de umidade.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="serrano-form-row">
                  <label>FCK Alvo (MPa)</label>
                  <select 
                    className="serrano-input"
                    value={formDoseBatelada.fck}
                    onChange={e => setFormDoseBatelada(prev => ({ ...prev, fck: Number(e.target.value) }))}
                  >
                    <option value={20}>FCK 20 MPa</option>
                    <option value={25}>FCK 25 MPa</option>
                    <option value={30}>FCK 30 MPa</option>
                    <option value={35}>FCK 35 MPa</option>
                    <option value={40}>FCK 40 MPa</option>
                  </select>
                </div>
                <div className="serrano-form-row">
                  <label>Volume da Carga (m³)</label>
                  <input 
                    type="number"
                    className="serrano-input"
                    value={formDoseBatelada.volumeM3}
                    min={1}
                    max={12}
                    onChange={e => setFormDoseBatelada(prev => ({ ...prev, volumeM3: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="serrano-form-row">
                  <label>Caminhão Betoneira</label>
                  <select 
                    className="serrano-input"
                    value={formDoseBatelada.betoneira}
                    onChange={e => setFormDoseBatelada(prev => ({ ...prev, betoneira: e.target.value }))}
                  >
                    <option value="BT-01">BT-01 · 10 m³ (Em operação)</option>
                    <option value="BT-02">BT-02 · 10 m³ (Pátio usina)</option>
                    <option value="BT-03">BT-03 · 8 m³ (Pátio usina)</option>
                    <option value="BT-04">BT-04 · 8 m³ (Disponível)</option>
                    <option value="BT-05">BT-05 · 10 m³ (Disponível)</option>
                  </select>
                </div>
                <div className="serrano-form-row">
                  <label>Umidade da Areia Média (%)</label>
                  <input 
                    type="number"
                    step="0.1"
                    className="serrano-input"
                    value={formDoseBatelada.umidadeAreiaPercentual}
                    onChange={e => setFormDoseBatelada(prev => ({ ...prev, umidadeAreiaPercentual: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>

              <div className="serrano-form-row">
                <label>Slump de Abatimento</label>
                <input 
                  type="text"
                  className="serrano-input"
                  value={formDoseBatelada.slumpAlvo}
                  onChange={e => setFormDoseBatelada(prev => ({ ...prev, slumpAlvo: e.target.value }))}
                />
              </div>

              <div className="serrano-modal-footer">
                <button type="button" className="btn-serrano" onClick={() => setModalDoseBateladaAberto(false)}>Cancelar</button>
                <button type="submit" className="btn-serrano pri" disabled={salvandoSuprimento}>
                  {salvandoSuprimento ? 'Dosando...' : '⚡ Confirmar e Iniciar Dosagem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL VISUALIZAÇÃO DE TICKET DE BATELADA NBR 7212 ─── */}
      {modalTicketBateladaAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 520 }}>
            <h2>Ticket de Batelada NBR 7212</h2>
            <div style={{ marginTop: 14 }}>
              <div style={{ border: '2px dashed var(--joint)', padding: 16, borderRadius: 8, background: 'var(--surface-2)', fontFamily: 'var(--font-data)' }}>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <b style={{ fontSize: 16, display: 'block' }}>SERRANO CONCRETO USINADO LTDA</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>USINA DOSADORA CONVICTA · NBR 7212</span>
                  <div style={{ marginTop: 6, fontWeight: 700, color: 'var(--serrano-orange-text)', fontSize: 14 }}>
                    {modalTicketBateladaAberto.numeroTicket}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 12, borderTop: '1px solid var(--joint)', borderBottom: '1px solid var(--joint)', padding: '8px 0' }}>
                  <div>Data/Hora: <b>{modalTicketBateladaAberto.dataHora}</b></div>
                  <div>Betoneira: <b>{modalTicketBateladaAberto.betoneiraCodigo}</b></div>
                  <div>Traço FCK: <b>{modalTicketBateladaAberto.fck} MPa</b></div>
                  <div>Volume: <b>{modalTicketBateladaAberto.volumeM3} m³</b></div>
                  <div>Motorista: <b>{modalTicketBateladaAberto.motorista}</b></div>
                  <div>Lacre Usina: <b>{modalTicketBateladaAberto.lacreSeguranca}</b></div>
                </div>

                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  <b>PESAGENS EFETIVADAS (kg / L):</b>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4, fontSize: 11 }}>
                    <div>Cimento CP II: <b>{modalTicketBateladaAberto.cimentoPesadoKg} kg</b></div>
                    <div>Areia Média Úmida: <b>{modalTicketBateladaAberto.areiaPesadaKg} kg</b></div>
                    <div>Brita 1 Granítica: <b>{modalTicketBateladaAberto.britaPesadaKg} kg</b></div>
                    <div>Água Líquida: <b>{modalTicketBateladaAberto.aguaLiquidaPesadaLitros} L</b></div>
                    <div>Aditivo Plastificante: <b>{modalTicketBateladaAberto.aditivoPesadoLitros} L</b></div>
                    <div>Fator a/c Real: <b>{modalTicketBateladaAberto.fatorAcReal}</b></div>
                  </div>
                </div>

                <div style={{ background: 'var(--status-ok-bg)', color: 'var(--status-ok)', padding: 8, borderRadius: 6, textAlign: 'center', fontWeight: 700, fontSize: 12 }}>
                  ✓ CONFORMIDADE METROLÓGICA ABNT NBR 7212 APROVADA
                </div>
              </div>

              <div className="serrano-modal-footer">
                <button type="button" className="btn-serrano" onClick={() => setModalTicketBateladaAberto(null)}>Fechar</button>
                <button type="button" className="btn-serrano pri" onClick={() => window.print()}>Imprimir Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ROMPIMENTO DE CP NA PRENSA DIGITAL NBR 5739 ─── */}
      {modalRupturaAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--joint)', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }}>
                  Rompimento Digital de Corpo de Prova · ABNT NBR 5739
                </h2>
                <small style={{ color: 'var(--text-muted)' }}>
                  Prensa eletro-hidráulica microprocessada · Taxa 0,45 ± 0,15 MPa/s
                </small>
              </div>
              <button 
                type="button" 
                className="btn-serrano"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setModalRupturaAberto(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarRupturaPrensa}>
              {/* Informações do Lote */}
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>Lote de Amostragem: <b>{modalRupturaAberto.lote}</b></div>
                  <div>FCK de Projeto: <b>{modalRupturaAberto.fckProjeto} MPa</b></div>
                  <div>Obra: <b>{modalRupturaAberto.obra}</b></div>
                  <div>Cliente: <b>{modalRupturaAberto.cliente}</b></div>
                </div>
              </div>

              {/* Seletor de Corpo de Prova e Idade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="serrano-form-row">
                  <label>Corpo de Prova Alvo</label>
                  <select 
                    className="serrano-input"
                    value={formRuptura.cpId}
                    onChange={e => {
                      const cp = modalRupturaAberto.corposProva?.find(c => c.id === e.target.value);
                      setFormRuptura(prev => ({
                        ...prev,
                        cpId: e.target.value,
                        idadeDias: cp ? cp.idadeDias : prev.idadeDias
                      }));
                    }}
                  >
                    {(modalRupturaAberto.corposProva || []).map(cp => (
                      <option key={cp.id} value={cp.id}>
                        {cp.id} · Idade {cp.idadeDias} dias {cp.tensaoMpa ? `(${cp.tensaoMpa} MPa)` : '(Em cura)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="serrano-form-row">
                  <label>Idade do Ensaio (Dias de Cura)</label>
                  <select 
                    className="serrano-input"
                    value={formRuptura.idadeDias}
                    onChange={e => setFormRuptura(prev => ({ ...prev, idadeDias: Number(e.target.value) }))}
                  >
                    <option value={3}>3 dias (Desforma rápida)</option>
                    <option value={7}>7 dias (Controle intermediário)</option>
                    <option value={14}>14 dias (Avanço executivo)</option>
                    <option value={28}>28 dias (Aceitação oficial NBR 12655)</option>
                  </select>
                </div>
              </div>

              {/* Geometria do Cilindro */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="serrano-form-row">
                  <label>Diâmetro Médio D (mm)</label>
                  <input 
                    type="number"
                    step="0.1"
                    className="serrano-input"
                    value={formRuptura.diametroMm}
                    onChange={e => {
                      const d = Number(e.target.value);
                      const tensao = calcularTensaoCP(formRuptura.forcaKn, d, formRuptura.alturaMm);
                      setFormRuptura(prev => ({ ...prev, diametroMm: d, tensaoMpa: tensao }));
                    }}
                  />
                </div>
                <div className="serrano-form-row">
                  <label>Altura h (mm)</label>
                  <input 
                    type="number"
                    step="0.1"
                    className="serrano-input"
                    value={formRuptura.alturaMm}
                    onChange={e => {
                      const h = Number(e.target.value);
                      const tensao = calcularTensaoCP(formRuptura.forcaKn, formRuptura.diametroMm, h);
                      setFormRuptura(prev => ({ ...prev, alturaMm: h, tensaoMpa: tensao }));
                    }}
                  />
                </div>
              </div>

              {/* Força na Prensa e Tensão Calculada */}
              <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, marginBottom: 14 }}>
                <div className="serrano-form-row">
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Força Máxima Aplicada pela Prensa (kN)</span>
                    <b style={{ color: 'var(--serrano-orange-text)' }}>{formRuptura.forcaKn} kN</b>
                  </label>
                  <input 
                    type="range"
                    min="50"
                    max="450"
                    step="0.5"
                    className="serrano-slider"
                    value={formRuptura.forcaKn}
                    onChange={e => {
                      const f = Number(e.target.value);
                      const tensao = calcularTensaoCP(f, formRuptura.diametroMm, formRuptura.alturaMm);
                      setFormRuptura(prev => ({ ...prev, forcaKn: f, tensaoMpa: tensao }));
                    }}
                  />
                </div>

                {/* Display da Tensão Calculada em Tempo Real */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--joint)' }}>
                  <div>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Tensão de Ruptura (fc)</small>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: formRuptura.tensaoMpa >= modalRupturaAberto.fckProjeto ? 'var(--status-ok)' : 'var(--status-info)' }}>
                      {formRuptura.tensaoMpa} MPa
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>% do FCK do Projeto</small>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: formRuptura.tensaoMpa >= modalRupturaAberto.fckProjeto ? 'var(--status-ok)' : 'var(--text)' }}>
                      {((formRuptura.tensaoMpa / modalRupturaAberto.fckProjeto) * 100).toFixed(1)} %
                    </div>
                  </div>
                </div>
              </div>

              {/* Tipo de Ruptura NBR 5739 e Preparo da Base */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="serrano-form-row">
                  <label>Tipo de Ruptura (NBR 5739)</label>
                  <select 
                    className="serrano-input"
                    value={formRuptura.tipoRuptura}
                    onChange={e => setFormRuptura(prev => ({ ...prev, tipoRuptura: e.target.value }))}
                  >
                    <option value="A">Tipo A · Cones bem formados em ambas extremidades (&lt; 25mm)</option>
                    <option value="B">Tipo B · Cone bem formado em uma ponta e bipartição</option>
                    <option value="C">Tipo C · Cone em uma ponta e plano inclinado</option>
                    <option value="D">Tipo D · Cisalhamento diagonal de ponta a ponta</option>
                    <option value="E">Tipo E · Fissuras colunares verticais paralelas</option>
                    <option value="F">Tipo F / G · Ruptura no topo ou cantos (falha capeamento)</option>
                  </select>
                </div>

                <div className="serrano-form-row">
                  <label>Preparo das Bases (NBR 5738)</label>
                  <select 
                    className="serrano-input"
                    value={formRuptura.tipoPreparoBase}
                    onChange={e => setFormRuptura(prev => ({ ...prev, tipoPreparoBase: e.target.value }))}
                  >
                    <option value="retificacao_diamantada">Retificação Diamantada Mecânica</option>
                    <option value="argamassa_enxofre">Capeamento com Argamassa de Enxofre</option>
                    <option value="neoprene">Almofadas de Neoprene (ASTM C1231)</option>
                  </select>
                </div>
              </div>

              {/* Footer do Modal */}
              <div className="serrano-modal-footer">
                <button 
                  type="button" 
                  className="btn-serrano"
                  onClick={() => setModalRupturaAberto(null)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-serrano pri"
                  disabled={salvandoRuptura}
                >
                  {salvandoRuptura ? 'Gravando Ensaio...' : 'Confirmar Ruptura na Prensa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: LAUDO NBR 5739 COMPLETO ─── */}
      {modalLaudoAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--joint)', paddingBottom: 12, marginBottom: 14 }}>
              <div>
                <b style={{ fontSize: 16, display: 'block' }}>SERRANO CONCRETO USINADO &amp; MINERAÇÃO LTDA</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>LABORATÓRIO DE CONTROLE TECNOLÓGICO · ABNT NBR 5739 / 12655</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="serrano-pill serrano-p-ok">{modalLaudoAberto.laudoNumero || 'LAUDO OFICIAL'}</span>
              </div>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>Cliente: <b>{modalLaudoAberto.cliente}</b></div>
                <div>Obra: <b>{modalLaudoAberto.obra}</b></div>
                <div>Lote: <b>{modalLaudoAberto.lote}</b></div>
                <div>Data Moldagem: <b>{modalLaudoAberto.dataMoldagem}</b></div>
                <div>FCK Projeto: <b>{modalLaudoAberto.fckProjeto} MPa</b></div>
                <div>Slump Test: <b>{modalLaudoAberto.slumpMedidoCm} cm (Conforme)</b></div>
              </div>

              {/* Tabela de Ensaio de Compressão */}
              <div style={{ marginTop: 12, borderTop: '1px solid var(--joint)', paddingTop: 10 }}>
                <b>RESULTADOS DOS CORPOS DE PROVA CILINDRICOS (NBR 5739):</b>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--joint)' }}>
                      <th style={{ padding: 6, textAlign: 'left' }}>CP</th>
                      <th style={{ padding: 6, textAlign: 'center' }}>Idade</th>
                      <th style={{ padding: 6, textAlign: 'center' }}>Força (kN)</th>
                      <th style={{ padding: 6, textAlign: 'center' }}>Tensão (MPa)</th>
                      <th style={{ padding: 6, textAlign: 'center' }}>% FCK</th>
                      <th style={{ padding: 6, textAlign: 'center' }}>Tipo Ruptura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modalLaudoAberto.corposProva || []).map(cp => (
                      <tr key={cp.id} style={{ borderBottom: '1px solid var(--joint)' }}>
                        <td style={{ padding: 6 }}><b>{cp.id}</b></td>
                        <td style={{ padding: 6, textAlign: 'center' }}>{cp.idadeDias} d</td>
                        <td style={{ padding: 6, textAlign: 'center' }}>{cp.forcaKn ? `${cp.forcaKn} kN` : '-'}</td>
                        <td style={{ padding: 6, textAlign: 'center', fontWeight: 700, color: cp.tensaoMpa >= modalLaudoAberto.fckProjeto ? 'var(--status-ok)' : 'var(--text)' }}>
                          {cp.tensaoMpa ? `${cp.tensaoMpa} MPa` : 'Em cura'}
                        </td>
                        <td style={{ padding: 6, textAlign: 'center' }}>{cp.percentualFck ? `${cp.percentualFck}%` : '-'}</td>
                        <td style={{ padding: 6, textAlign: 'center' }}>{cp.tipoRuptura ? `Tipo ${cp.tipoRuptura}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, background: 'var(--surface)', padding: 10, borderRadius: 6, borderLeft: '4px solid var(--status-ok)' }}>
                <b>PARECER CONCLUSIVO NBR 12655:</b>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  O concreto usinado fornecido satisfaz integralmente as especificações de resistência característica à compressão aos 28 dias conforme NBR 6118 e NBR 12655.
                </p>
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--joint)', paddingTop: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Responsável Técnica: <b>Engª Karin Prestes (CREA-MT 027300)</b> · ART nº 2026/0491823-MT
                </span>
              </div>
            </div>

            <div className="serrano-modal-footer">
              <button 
                type="button" 
                className="btn-serrano"
                onClick={() => setModalLaudoAberto(null)}
              >
                Fechar
              </button>
              <button 
                type="button" 
                className="btn-serrano pri"
                onClick={() => {
                  window.open(`/api/admin/concreto/ensaios/${modalLaudoAberto.id || modalLaudoAberto.lote}/laudo/html`, '_blank');
                }}
              >
                🖨️ Abrir Laudo Oficial A4 / Salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}
      {/* COPILOT KYTTOIA INDUSTRIAL MODAL */}
      <ConcretoKyttoIACopilot 
        isOpen={copilotAberto} 
        onClose={() => setCopilotAberto(false)} 
      />

    </div>
  );
}
