import './ConcretoUsinaERP.css';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';

const STATUS_CORES = {
  agendado: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', label: 'Agendado' },
  carregando: { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D', label: 'Carregando na Usina' },
  em_transito: { bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD', label: 'Em Trânsito' },
  na_obra: { bg: '#FAF5FF', text: '#7E22CE', border: '#D8B4FE', label: 'Descarregando na Obra' },
  concluido: { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC', label: 'Concluído' },
  cancelado: { bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5', label: 'Cancelado' }
};

export default function ConcretoUsinaERP() {
  const { empresaAtiva } = useAuth();
  const { toast } = useToast();

  const [abaAtiva, setAbaAtiva] = useState('cargas');
  const [cargas, setCargas] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [frota, setFrota] = useState([]);
  const [ensaios, setEnsaios] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [silos, setSilos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [ordensProducao, setOrdensProducao] = useState([]);
  const [listasTecnicas, setListasTecnicas] = useState([]);
  const [insumosCatalogo, setInsumosCatalogo] = useState([]);
  // Estados de Mineração e Medições
  const [dragas, setDragas] = useState([]);
  const [patiosMineracao, setPatiosMineracao] = useState([]);
  const [vendasAgregados, setVendasAgregados] = useState([]);
  const [medicoesObras, setMedicoesObras] = useState([]);
  const [modalVendaAgregadoAberto, setModalVendaAgregadoAberto] = useState(false);
  const [modalNovaMedicaoAberto, setModalNovaMedicaoAberto] = useState(false);
  const [formVendaAgregado, setFormVendaAgregado] = useState({
    cliente: '',
    cnpjCliente: '',
    obraDestino: '',
    veiculoPlaca: '',
    motorista: '',
    produtoId: 'ins-areia-med',
    produtoNome: 'Areia Média Lavada de Rio (Serrano Mineração)',
    pesoBrutoKg: 28000,
    taraKg: 12000,
    precoUnitarioM3: 65.00
  });
  const [formMedicao, setFormMedicao] = useState({
    cliente: '',
    cnpjCliente: '',
    obra: '',
    periodoInicio: new Date().toISOString().slice(0, 10),
    periodoFim: new Date().toISOString().slice(0, 10),
    volumeTotalM3: 40,
    precoMedioM3: 440.00,
    taxaBombaTotal: 750.00,
    retencaoTecnicaPercent: 5.0,
    engenheiroFiscalObra: ''
  });

  // Modais de Compras e Ordens de Produção
  const [modalNovaCompraAberto, setModalNovaCompraAberto] = useState(false);
  const [modalRecebimentoAberto, setModalRecebimentoAberto] = useState(null);
  const [modalNovaOpAberto, setModalNovaOpAberto] = useState(false);
  const [modalConcluirOpAberto, setModalConcluirOpAberto] = useState(null);

  // Form Nova Compra de Insumo
  const [formCompra, setFormCompra] = useState({
    insumoId: 'ins-cim-cp2',
    quantidade: 40,
    precoUnitario: 580.00,
    fornecedor: 'Votorantim Cimentos S/A (Nobres/MT)',
    formaPagamento: 'Boleto 30 DDL',
    notaFiscal: '',
    observacoes: ''
  });

  // Form Recebimento e Pesagem na Balança
  const [formRecebimento, setFormRecebimento] = useState({
    pesoBalançaEntradaTon: '',
    notaFiscal: '',
    responsavelRecebimento: 'Carlos Eduardo (Operador de Usina)'
  });

  // Form Nova OP
  const [formOp, setFormOp] = useState({
    cliente: '',
    obra: '',
    fck: 25,
    volumeM3: 16,
    betoneirasEscaladas: ['BT-01', 'BT-02'],
    operador: 'Carlos Eduardo'
  });

  // Simulador de Custos Industriais
  const [custoFck, setCustoFck] = useState(25);
  const [custoVolume, setCustoVolume] = useState(16);
  const [custoDistancia, setCustoDistancia] = useState(12);
  const [custoTipoBomba, setCustoTipoBomba] = useState('Bomba Lança 32m');
  const [custoMargemDesejada, setCustoMargemDesejada] = useState(18);
  const [simulacaoCustos, setSimulacaoCustos] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modais
  const [modalNovaCargaAberto, setModalNovaCargaAberto] = useState(false);
  const [modalRomaneioAberto, setModalRomaneioAberto] = useState(null);
  const [modalRupturaAberto, setModalRupturaAberto] = useState(null);
  const [modalNovaPropostaAberto, setModalNovaPropostaAberto] = useState(false);
  const [modalLaudoAberto, setModalLaudoAberto] = useState(null);

  // Calculadora de dosagem NBR 7212
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
    bomba: 'BL-01 (Bomba Lança 32m)',
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

  useEffect(() => {
    carregarDados();
  }, [empresaAtiva]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/concreto/dados');
      if (res?.ok) {
        setEmpresa(res.empresa);
        setCargas(res.cargas || []);
        setCatalogo(res.catalogo || []);
        setFrota(res.frota || []);
        setEnsaios(res.ensaios || []);
        setPropostas(res.propostas || []);
        setSilos(res.silos || []);
        setCompras(res.compras || []);
        setOrdensProducao(res.ordensProducao || []);
        setListasTecnicas(res.listasTecnicas || []);
        setInsumosCatalogo(res.insumosCatalogo || []);
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

  // KPIs dinâmicos
  const kpis = useMemo(() => {
    const volProgramado = cargas.reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
    const volConcluido = cargas.filter(c => c.status === 'concluido').reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
    const emOperacao = frota.filter(f => f.status !== 'disponivel').length;
    const fatTotal = cargas.reduce((acc, c) => acc + (Number(c.valorTotal) || 0), 0);
    const ensaiosAprovados = ensaios.filter(e => e.status === 'aprovado').length;
    return { volProgramado, volConcluido, emOperacao, fatTotal, ensaiosAprovados };
  }, [cargas, frota, ensaios]);

  // Cálculo de dosagem NBR 7212 em tempo real com correção de umidade da areia
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

  // Ações Operacionais
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
        setFormCarga({
          cliente: '',
          obra: '',
          endereco: '',
          fck: 25,
          volumeM3: 8,
          slump: '14 ± 2 cm',
          brita: 'Brita 1',
          bomba: 'BL-01 (Bomba Lança 32m)',
          horarioAgendado: '08:30',
          dataAgendada: new Date().toISOString().slice(0, 10),
          observacoes: ''
        });
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao agendar carga: ' + err.message, 'error');
    }
  };

  const handleEventoViagem = async (cargaId, index, evento) => {
    try {
      const res = await api.post(`/api/admin/concreto/cargas/${cargaId}/viagens/${index}/evento`, { evento });
      if (res?.ok) {
        toast(`Evento '${evento.replace('_', ' ')}' registrado com sucesso!`, 'success');
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao registrar telemetria: ' + err.message, 'error');
    }
  };

  const handleAtualizarStatusCarga = async (cargaId, status) => {
    try {
      const res = await api.put(`/api/admin/concreto/cargas/${cargaId}/status`, { status });
      if (res?.ok) {
        toast(`Status da carga atualizado para '${status}'!`, 'success');
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao atualizar carga: ' + err.message, 'error');
    }
  };

  const handleRegistrarRuptura = async (e) => {
    e.preventDefault();
    if (!modalRupturaAberto) return;
    try {
      const res = await api.post(`/api/admin/concreto/ensaios/${modalRupturaAberto.lote}/ruptura`, formRuptura);
      if (res?.ok) {
        toast(`Ruptura do ${formRuptura.cpId} aos ${formRuptura.idadeDias} dias registrada (${formRuptura.tensaoMpa} MPa)!`, 'success');
        setModalRupturaAberto(null);
        setFormRuptura({ cpId: 'CP-1', idadeDias: 7, tensaoMpa: '', forcaKn: '' });
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao registrar rompimento: ' + err.message, 'error');
    }
  };

  const handleCriarCompra = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/admin/concreto/compras', formCompra);
      if (res?.ok) {
        toast(`Pedido de compra #${res.pedido.numero} registrado com sucesso!`, 'success');
        setModalNovaCompraAberto(false);
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao criar pedido de compra: ' + err.message, 'error');
    }
  };

  const handleRegistrarRecebimento = async (e) => {
    e.preventDefault();
    if (!modalRecebimentoAberto) return;
    try {
      const res = await api.post(`/api/admin/concreto/compras/${modalRecebimentoAberto.id}/recebimento`, formRecebimento);
      if (res?.ok) {
        toast(`Entrada do pedido #${res.pedido.numero} confirmada! Silo abastecido.`, 'success');
        setModalRecebimentoAberto(null);
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao registrar pesagem na balança: ' + err.message, 'error');
    }
  };

  const handleCriarOp = async (e) => {
    e.preventDefault();
    if (!formOp.cliente || !formOp.obra) {
      toast('Informe o cliente e a obra para a Ordem de Produção!', 'warning');
      return;
    }
    try {
      const res = await api.post('/api/admin/concreto/ordens-producao', formOp);
      if (res?.ok) {
        toast(`Ordem de Produção #${res.ordemProducao.numero} criada!`, 'success');
        setModalNovaOpAberto(false);
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao gerar Ordem de Produção: ' + err.message, 'error');
    }
  };

  const handleConcluirOp = async (opId) => {
    try {
      const res = await api.post(`/api/admin/concreto/ordens-producao/${opId}/concluir`, {});
      if (res?.ok) {
        toast(`OP #${res.ordemProducao.numero} concluída e baixa realizada nos silos!`, 'success');
        setModalConcluirOpAberto(null);
        carregarDados();
      }
    } catch (err) {
      toast('Erro ao concluir OP: ' + err.message, 'error');
    }
  };

  const carregarSimulacaoCustos = async () => {
    try {
      const res = await api.post('/api/admin/concreto/custos/calcular', {
        fck: custoFck,
        volumeM3: custoVolume,
        distanciaKm: custoDistancia,
        tipoBomba: custoTipoBomba,
        margemDesejadaPercent: custoMargemDesejada
      });
      if (res?.ok) {
        setSimulacaoCustos(res.custos);
      }
    } catch (err) {
      console.error('Erro na simulação de custos:', err);
    }
  };

  useEffect(() => {
    if (abaAtiva === 'custos') {
      carregarSimulacaoCustos();
    }
  }, [abaAtiva, custoFck, custoVolume, custoDistancia, custoTipoBomba, custoMargemDesejada]);

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
        setFormProposta({
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
    <div className="concreto-page-wrapper">
      
      {/* BANNER INSTITUCIONAL OFICIAL SERRANO CONCRETO */}
            {/* BANNER INSTITUCIONAL OFICIAL SERRANO CONCRETO CLEAN */}
      <div className="concreto-banner-clean">
        <div className="concreto-banner-left">
          <div className="concreto-banner-icon">
            <span style={{ fontSize: 34 }}>🚚</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <span className="concreto-badge-primary">
                Usina Dosadora Automatizada & Mineração Própria
              </span>
              <span className="concreto-badge-city">Tangará da Serra - MT</span>
              <a
                href="https://www.instagram.com/serrano_concreto/"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: '#EA580C', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                📸 @serrano_concreto
              </a>
            </div>
            <h1 style={{ margin: '4px 0', fontSize: 26, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px' }}>
              Serrano Concreto Usinado & Mineração
            </h1>
            <p className="concreto-banner-subtitle">
              "Da produção da areia até o concreto entregue na sua obra." · Central dosadora Convicta 96t, 8 betoneiras, bombas lança 32m/36m e controle tecnológico NBR 7212 / NBR 5738.
            </p>
            <div className="concreto-banner-meta">
              <span className="concreto-meta-chip">CNPJ Matriz: <strong>51.499.928/0001-01</strong></span>
              <span className="concreto-meta-chip">CNPJ Usinado: <strong>53.798.485/0001-77</strong></span>
              <span className="concreto-meta-chip">IE: <strong>13.567.890-3</strong></span>
              <span className="concreto-meta-chip">ANTT: <strong>056256077</strong></span>
              <span className="concreto-meta-chip">RT: <strong>Engª Karin Prestes (CREA-MT 027300)</strong></span>
              <span className="concreto-meta-chip">Central: <strong>(65) 99946-4899 / (65) 99996-3795</strong></span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="concreto-btn-secondary" onClick={() => setAbaAtiva('propostas')}>
            📋 Nova Proposta
          </button>
          <button className="concreto-btn-primary" onClick={() => setModalNovaCargaAberto(true)}>
            + Agendar Carga
          </button>
        </div>
      </div>

      {/* GRID DE KPIS OPERACIONAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Volume Programado Hoje</span>
            <span style={{ fontSize: 20 }}>📋</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#F59E0B' }}>
            {kpis.volProgramado} <span style={{ fontSize: 16, fontWeight: 600, color: '#64748B' }}>m³</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Total de concreto escalado para hoje</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Volume Concluído</span>
            <span style={{ fontSize: 20 }}>✅</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#10B981' }}>
            {kpis.volConcluido} <span style={{ fontSize: 16, fontWeight: 600, color: '#64748B' }}>m³</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
            {kpis.volProgramado > 0 ? `${Math.round((kpis.volConcluido / kpis.volProgramado) * 100)}% das obras entregues` : 'Aguardando despacho'}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Frota em Operação</span>
            <span style={{ fontSize: 20 }}>🚛</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#38BDF8' }}>
            {kpis.emOperacao} <span style={{ fontSize: 16, fontWeight: 600, color: '#64748B' }}>/ {frota.length} unidades</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Betoneiras e caminhões bomba ativos</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Faturamento do Dia</span>
            <span style={{ fontSize: 20 }}>💰</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#FCD34D' }}>
            R$ {kpis.fatTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Concreto Usinado + Bombeamento</div>
        </div>
      </div>

      {/* NAVEGAÇÃO POR ABAS ESPECIALIZADAS CLEAN */}
      <div className="concreto-tabs-bar">
        {[
          { id: 'cargas', label: '🚚 Cargas & Despacho ao Vivo', count: cargas.length },
          { id: 'central', label: '🏭 Central Dosadora (NBR 7212)' },
          { id: 'lista_tecnica', label: '📋 Lista Técnica (BOM) & Fichas FCK', count: listasTecnicas.length || 7 },
          { id: 'compras', label: '🛒 Compras de Insumos & Silos', count: compras.length },
          { id: 'custos', label: '💡 Cálculo de Custos & Precificação' },
          { id: 'ordens_producao', label: '⚙️ Ordens de Produção (OP)', count: ordensProducao.length },
          { id: 'tracos', label: '📊 Catálogo Comercial FCK', count: catalogo.filter(c => c.categoria === 'Concreto Usinado' || c.categoria === 'Concretos Especiais').length },
          { id: 'laboratorio', label: '🔬 Laboratório & CPs (NBR 5738/5739)', count: ensaios.length },
          { id: 'frota', label: '🚛 Frota & Telemetria', count: frota.length },
          { id: 'mineracao', label: '⛏️ Serrano Mineração & Silos 96t', count: silos.length },
          { id: 'medicoes', label: '📐 Medições de Obras Construtora', count: medicoesObras.length || 2 },
          { id: 'propostas', label: '📋 Orçamentos & Propostas', count: propostas.length },
          { id: 'holding', label: '🏢 Holding Serrano & Palatare' },
        ].map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`concreto-tab-btn ${abaAtiva === aba.id ? 'active' : ''}`}
          >
            {aba.label} {aba.count !== undefined && <span className="concreto-tab-count">{aba.count}</span>}
          </button>
        ))}
      </div>

            {/* ABA 1: PROGRAMAÇÃO DE CARGAS & DESPACHO AO VIVO */}
      {abaAtiva === 'cargas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: '#0F172A' }}>
                Programação de Concretagens & Despacho em Tempo Real
              </h2>
              <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
                Acompanhamento de cada viagem das betoneiras com telemetria, controle de tempo de pega NBR 7212 e emissão de romaneio oficial.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => setAbaAtiva('central')}
                className="concreto-btn-secondary"
              >
                🏭 Central Dosadora
              </button>
              <button
                onClick={() => setModalNovaCargaAberto(true)}
                className="concreto-btn-primary"
              >
                + Agendar Nova Concretagem
              </button>
            </div>
          </div>

          {/* QUADRO DE ESCALAÇÃO & GANTT DAS BETONEIRAS */}
          <div className="concreto-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⏱️ Escalação da Frota & Linha do Tempo das Viagens
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>
                  Monitoramento de trânsito em tempo real com controle de validade do concreto NBR 7212 (máximo 150 minutos desde a adição de água).
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 700 }}>
                <span className="concreto-alerta-pega ok">● No Prazo (&lt; 90 min)</span>
                <span className="concreto-alerta-pega aviso">▲ Atenção (90-120 min)</span>
                <span className="concreto-alerta-pega critico">⚠️ Crítico (&gt; 120 min)</span>
              </div>
            </div>
            {/* Timeline Horizontal */}
            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, background: '#F8FAFC' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px repeat(11, 1fr)', gap: 4, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0', paddingBottom: 6 }}>
                <div style={{ textAlign: 'left', paddingLeft: 4 }}>Veículo / Motorista</div>
                <div>07h</div><div>08h</div><div>09h</div><div>10h</div><div>11h</div><div>12h</div><div>13h</div><div>14h</div><div>15h</div><div>16h</div><div>17h</div>
              </div>
              {[
                { id: 'BT-01', nome: 'Volvo VM 330', cap: '8 m³', motorista: 'Marcos Silveira', ocupado: [8, 9], status: 'Concluído', cor: '#16A34A', carga: 'Carga #1001 (Serra Dourada)' },
                { id: 'BT-02', nome: 'Mercedes Axor', cap: '8 m³', motorista: 'Carlos Eduardo', ocupado: [8, 9, 10], status: 'Concluído', cor: '#16A34A', carga: 'Carga #1001' },
                { id: 'BT-03', nome: 'Scania P310', cap: '8 m³', motorista: 'Valdemir Oliveira', ocupado: [9, 10], status: 'Concluído', cor: '#16A34A', carga: 'Carga #1001' },
                { id: 'BT-04', nome: 'Volvo VM 330', cap: '8 m³', motorista: 'José Cláudio', ocupado: [13, 14], status: 'Em Trânsito', cor: '#0284C7', carga: 'Carga #1002 (Belvedere Tower)' },
                { id: 'BT-05', nome: 'Mercedes Axor', cap: '8 m³', motorista: 'Rogério Matos', ocupado: [14, 15], status: 'Programado', cor: '#D97706', carga: 'Carga #1002' },
                { id: 'BL-01', nome: 'Bomba Lança 32m', cap: '90 m³/h', motorista: 'Gilberto Ramos', ocupado: [8, 9, 10], status: 'Laje 4º Pav.', cor: '#9333EA', carga: 'Serra Dourada' },
                { id: 'BL-02', nome: 'Bomba Lança 36m', cap: '110 m³/h', motorista: 'Claudemir Costa', ocupado: [13, 14, 15], status: 'Deslocando', cor: '#0284C7', carga: 'Belvedere Tower' }
              ].map(f => (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '130px repeat(11, 1fr)', gap: 4, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0F172A', display: 'flex', flexDirection: 'column', textAlign: 'left', paddingLeft: 4 }}>
                    <span>{f.id} <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B' }}>({f.cap})</span></span>
                    <span style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>{f.motorista}</span>
                  </div>
                  {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(h => {
                    const ativo = f.ocupado.includes(h);
                    return (
                      <div
                        key={h}
                        style={{
                          height: 28,
                          borderRadius: 4,
                          background: ativo ? f.cor : '#FFFFFF',
                          border: ativo ? `1px solid ${f.cor}` : '1px dashed #E2E8F0',
                          color: '#FFFFFF',
                          fontSize: 9.5,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={ativo ? `${f.id}: ${f.carga} (${f.status})` : 'Disponível no Pátio'}
                      >
                        {ativo ? f.status : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cargas.map(carga => {
              const st = STATUS_CORES[carga.status] || STATUS_CORES.agendado;
              return (
                <div
                  key={carga.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: '#F59E0B' }}>Carga #{carga.numero}</span>
                        <span style={{
                          background: st.bg,
                          color: st.text,
                          border: `1px solid ${st.border}`,
                          padding: '3px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: 'uppercase'
                        }}>
                          {st.label}
                        </span>
                        <span style={{ fontSize: 13, color: '#475569' }}>Horário: <strong>{carga.horarioAgendado}</strong> ({carga.dataAgendada || 'Hoje'})</span>
                      </div>
                      <h3 style={{ margin: '6px 0 2px', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                        {carga.obra}
                      </h3>
                      <div style={{ fontSize: 13, color: '#64748B' }}>
                        Cliente: <strong style={{ color: '#1E293B' }}>{carga.cliente}</strong> · Endereço: {carga.endereco}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setModalRomaneioAberto(carga)}
                        style={{
                          background: '#F8FAFC',
                          color: '#334155',
                          border: '1px solid #E2E8F0',
                          padding: '8px 16px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        📄 Romaneio Oficial
                      </button>

                      {carga.status !== 'concluido' && (
                        <button
                          onClick={() => handleAtualizarStatusCarga(carga.id, 'concluido')}
                          style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10B981',
                            border: '1px solid #10B981',
                            padding: '8px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Concluir Carga
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detalhes técnicos do concreto */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    background: '#F8FAFC',
                    padding: '12px 16px',
                    borderRadius: 10,
                    marginBottom: 14,
                    border: '1px solid #E2E8F0'
                  }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748B' }}>Resistência / Traço:</span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#F59E0B' }}>{carga.fck}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748B' }}>Slump de Projeto:</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{carga.slump}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748B' }}>Volume Total:</span>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#38BDF8' }}>{carga.volumeM3} m³</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748B' }}>Sistema de Descarga:</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{carga.bomba}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748B' }}>Valor Faturado:</span>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#FCD34D' }}>
                        R$ {Number(carga.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748B' }}>Laboratório / CP:</span>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>{carga.laudoCp}</div>
                    </div>
                  </div>

                  {/* Viagens das betoneiras & Telemetria em tempo real */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                      Viagens Escaladas & Telemetria da Frota na Obra
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                      {carga.viagens.map((v, i) => (
                        <div
                          key={i}
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            padding: '12px 16px',
                            borderRadius: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                              🚚 {v.betoneira} · {v.volume} m³
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>
                              Motorista: <strong style={{ color: '#1E293B' }}>{v.motorista}</strong>
                            </div>
                          </div>

                          {/* Timestamps da viagem */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11, color: '#475569', borderTop: '1px solid #E2E8F0', paddingTop: 6 }}>
                            <div>Saída Usina: <strong style={{ color: v.saida ? '#38BDF8' : '#64748B' }}>{v.saida || '—'}</strong></div>
                            <div>Chegada Obra: <strong style={{ color: v.chegada ? '#F59E0B' : '#64748B' }}>{v.chegada || '—'}</strong></div>
                            <div>Fim Descarga: <strong style={{ color: v.fimDescarga ? '#10B981' : '#64748B' }}>{v.fimDescarga || '—'}</strong></div>
                          </div>

                          {/* Alerta de tempo de espera e hora parada */}
                          {v.tempoEsperaMin > 0 && (
                            <div style={{ fontSize: 11, color: v.tempoEsperaMin > 60 ? '#EF4444' : '#94A3B8', background: '#FFFFFF', padding: '4px 8px', borderRadius: 6 }}>
                              Tempo na obra: <strong>{v.tempoEsperaMin} min</strong>
                              {v.horaParadaCobranca > 0 && (
                                <span style={{ marginLeft: 6, fontWeight: 800 }}>
                                  ⚠️ Hora Parada Excedente: R$ {v.horaParadaCobranca.toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Botões rápidos de telemetria */}
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            {!v.saida && (
                              <button
                                onClick={() => handleEventoViagem(carga.id, i, 'saida_usina')}
                                style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                🚀 Saída Usina
                              </button>
                            )}
                            {v.saida && !v.chegada && (
                              <button
                                onClick={() => handleEventoViagem(carga.id, i, 'chegada_obra')}
                                style={{ background: '#D97706', color: '#FFFFFF', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                📍 Chegou na Obra
                              </button>
                            )}
                            {v.chegada && !v.fimDescarga && (
                              <button
                                onClick={() => handleEventoViagem(carga.id, i, 'fim_descarga')}
                                style={{ background: '#16A34A', color: '#FFFFFF', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                ✅ Fim Descarga
                              </button>
                            )}
                            {v.fimDescarga && !v.retorno && (
                              <button
                                onClick={() => handleEventoViagem(carga.id, i, 'retorno_usina')}
                                style={{ background: '#475569', color: '#FFFFFF', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                🔄 Retornou ao Pátio
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA NOVA: LISTA TÉCNICA (BOM) & FICHAS DE FABRICAÇÃO */}
      {abaAtiva === 'lista_tecnica' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Lista Técnica (BOM) & Fichas de Fabricação de Concreto Usinado
              </h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                Engenharia de dosagem NBR 7212 / NBR 8953 / NBR 6118 com proporção em massa, consumo por m³ e apuração do custo direto de matéria-prima.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#10B981', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                ✓ 7 Traços Homologados pela RT Engª Karin Prestes
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
            {listasTecnicas.map(bom => (
              <div key={bom.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: '#D97706', color: '#FFFFFF', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                        {bom.codigo}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>{bom.normaReferencia}</span>
                    </div>
                    <h3 style={{ margin: '6px 0 2px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
                      {bom.nome}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>{bom.descricao}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase' }}>Custo Insumos / m³</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#F59E0B' }}>
                      R$ {bom.custoDiretoInsumosM3?.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: '#10B981' }}>Tabela: R$ {bom.precoSugeridoVendaM3?.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: '#F8FAFC', padding: 10, borderRadius: 10, marginBottom: 14, textAlign: 'center', fontSize: 11 }}>
                  <div>
                    <div style={{ color: '#64748B' }}>Traço em Massa</div>
                    <div style={{ fontWeight: 800, color: '#1E293B', marginTop: 2 }}>{bom.proporcaoMassa}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>Slump Alvo</div>
                    <div style={{ fontWeight: 800, color: '#38BDF8', marginTop: 2 }}>{bom.slumpPadrao}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>Fator a/c</div>
                    <div style={{ fontWeight: 800, color: '#A78BFA', marginTop: 2 }}>{bom.fatorAguaCimento}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>Perda Aderência</div>
                    <div style={{ fontWeight: 800, color: '#F87171', marginTop: 2 }}>{bom.perdaAderenciaPercent}%</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
                    Composição Estequiométrica de Matérias-Primas por m³:
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ textAlign: 'left', padding: '4px 0' }}>Componente</th>
                        <th style={{ textAlign: 'center', padding: '4px 0' }}>Consumo</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Custo Unit.</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Subtotal / m³</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bom.componentes.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)', color: '#1E293B' }}>
                          <td style={{ padding: '6px 0' }}>{c.nome}</td>
                          <td style={{ padding: '6px 0', textAlign: 'center', fontWeight: 700, color: '#38BDF8' }}>
                            {c.consumo} {c.unidade} {c.consumoKg && <span style={{ color: '#64748B', fontSize: 10 }}>({c.consumoKg} kg)</span>}
                          </td>
                          <td style={{ padding: '6px 0', textAlign: 'right', color: '#64748B' }}>
                            R$ {c.custoUnitarioKg ? `${c.custoUnitarioKg.toFixed(2)}/kg` : `${c.custoUnitario.toFixed(2)}/${c.unidade}`}
                          </td>
                          <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800, color: '#FCD34D' }}>
                            R$ {c.subtotalCusto?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA NOVA: COMPRAS DE MATÉRIAS-PRIMAS */}
      {abaAtiva === 'compras' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Gestão de Compras de Matérias-Primas & Abastecimento de Silos
              </h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                Pedidos de cimento a granel em bitrem (Votorantim Nobres), carretas de brita, aditivos químicos e óleo diesel com pesagem na balança.
              </p>
            </div>
            <button
              onClick={() => setModalNovaCompraAberto(true)}
              style={{
                background: '#10B981',
                color: '#0F172A',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              + Novo Pedido de Compra
            </button>
          </div>

          {/* Cards de Insumos Homologados */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
            {insumosCatalogo.slice(0, 4).map(ins => (
              <div key={ins.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, background: '#334155', color: '#1E293B', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                    {ins.categoria}
                  </span>
                  <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 800 }}>Lead Time: {ins.leadTimeDias}d</span>
                </div>
                <h4 style={{ margin: '8px 0 4px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{ins.nome}</h4>
                <div style={{ fontSize: 11, color: '#64748B' }}>{ins.fornecedorPadrao}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
                  <span style={{ fontSize: 11, color: '#64748B' }}>Custo Homologado:</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#10B981' }}>R$ {ins.custoUnitario.toFixed(2)} / {ins.unidade}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Tabela de Pedidos de Compra */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Histórico de Pedidos de Compra & Entradas na Balança</span>
              <span style={{ fontSize: 12, color: '#64748B' }}>{compras.length} pedidos registrados</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#FFFFFF', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pedido</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fornecedor</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Insumo / Destino</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Quantidade</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {compras.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#1E293B' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#F59E0B' }}>{c.numero}</td>
                    <td style={{ padding: '12px 16px' }}>{c.data}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.fornecedor}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{c.insumoNome}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Destino: {c.siloDestinoNome}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#38BDF8' }}>
                      {c.quantidade} {c.unidade}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#FCD34D' }}>
                      R$ {c.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 800,
                        background: c.status === 'entregue_pesado' ? 'rgba(16, 185, 129, 0.15)' : c.status === 'em_transito' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: c.status === 'entregue_pesado' ? '#10B981' : c.status === 'em_transito' ? '#60A5FA' : '#F59E0B',
                        border: `1px solid ${c.status === 'entregue_pesado' ? '#10B981' : c.status === 'em_transito' ? '#3B82F6' : '#D97706'}`
                      }}>
                        {c.status === 'entregue_pesado' ? '✓ Entregue & Pesado' : c.status === 'em_transito' ? '🚛 Em Trânsito' : '⏳ Solicitado'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {c.status !== 'entregue_pesado' && (
                        <button
                          onClick={() => {
                            setModalRecebimentoAberto(c);
                            setFormRecebimento({ pesoBalançaEntradaTon: c.quantidade, notaFiscal: '', responsavelRecebimento: 'Carlos Eduardo' });
                          }}
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #10B981',
                            color: '#10B981',
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ⚖️ Pesar & Abastecer Silo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA NOVA: CÁLCULO DE CUSTOS & FORMAÇÃO DE PREÇO */}
      {abaAtiva === 'custos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Simulador Industrial de Custos, Frete & Formação de Preço
              </h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                Decomposição analítica do CPV de matérias-primas, custos operacionais da central Convicta, frete por raio rodoviário e BDI/margem líquida.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
            {/* Painel de Parâmetros de Simulação */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                Parâmetros da Concretagem
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Resistência FCK (MPa):</label>
                  <select
                    value={custoFck}
                    onChange={e => setCustoFck(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 800 }}
                  >
                    <option value={15}>FCK 15 MPa (Magro)</option>
                    <option value={20}>FCK 20 MPa (Pisos e Baldrames)</option>
                    <option value={25}>FCK 25 MPa (Lajes e Vigas)</option>
                    <option value={30}>FCK 30 MPa (Estrutural Pesado)</option>
                    <option value={35}>FCK 35 MPa (Piso Industrial c/ Fibras)</option>
                    <option value={40}>FCK 40 MPa (Obras Especiais / Pontes)</option>
                    <option value={45}>FCK 45 MPa (CAD Pré-Moldado)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Volume Solicitado (m³):</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={custoVolume}
                    onChange={e => setCustoVolume(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 800 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Distância da Obra (km da Usina):</label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={custoDistancia}
                    onChange={e => setCustoDistancia(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 800 }}
                  />
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Até 15 km: raio urbano. Acima: adicional R$ 1,80/km/m³</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Método de Lançamento:</label>
                  <select
                    value={custoTipoBomba}
                    onChange={e => setCustoTipoBomba(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 800 }}
                  >
                    <option value="Descarga Direta (Calha)">Descarga Direta por Calha</option>
                    <option value="Bomba Lança 32m">Bomba Lança 32m Schwing</option>
                    <option value="Bomba Lança 36m">Bomba Lança 36m Schwing</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                    <span>Margem Líquida Alvo:</span>
                    <strong style={{ color: '#10B981' }}>{custoMargemDesejada}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="30"
                    step="1"
                    value={custoMargemDesejada}
                    onChange={e => setCustoMargemDesejada(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Resultado da Decomposição de Custos e Precificação */}
            {simulacaoCustos && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                    Decomposição dos Custos Industriais por m³:
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>1. CPV Insumos</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#F59E0B', marginTop: 4 }}>
                        R$ {simulacaoCustos.decomposicaoCustosM3.cpvInsumos.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>Cimento, Areia, Brita, Aditivos</div>
                    </div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>2. Usinagem Central</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#38BDF8', marginTop: 4 }}>
                        R$ {simulacaoCustos.decomposicaoCustosM3.usinagemCentral.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>Energia, Operador, Manutenção</div>
                    </div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>3. Frete Betoneira</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#A78BFA', marginTop: 4 }}>
                        R$ {simulacaoCustos.decomposicaoCustosM3.freteBetoneira.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>Diesel S10, Pneus, Motorista</div>
                    </div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>4. Bombeamento</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#EC4899', marginTop: 4 }}>
                        R$ {simulacaoCustos.decomposicaoCustosM3.servicoBomba.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>Bomba Lança Schwing</div>
                    </div>
                  </div>
                </div>

                {/* Formação de Preço e BDI */}
                <div style={{ background: '#F8FAFC', border: '1.5pt solid #F59E0B', borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0F172A' }}>
                        Formação de Preço de Venda Recomendada (BDI Industrial)
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>
                        Tributos: ISSQN 3% + PIS/COFINS 3,65% + IRPJ/CSLL 4,8% (Total 11,45%) · Despesas Adm: 5%
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase' }}>Preço Sugerido / m³</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#10B981' }}>
                        R$ {simulacaoCustos.precificacao.precoSugeridoVendaM3.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Valor Total do Lote ({custoVolume} m³):</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#FCD34D' }}>
                        R$ {simulacaoCustos.precificacao.totalPrecoSugerido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Margem de Contribuição / m³:</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981' }}>
                        R$ {simulacaoCustos.precificacao.margemContribuicaoM3.toFixed(2)} ({simulacaoCustos.precificacao.margemContribuicaoPercent}%)
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Custo Direto Industrial Total:</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1E293B' }}>
                        R$ {simulacaoCustos.totaisLote.totalCustoDireto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA NOVA: ORDENS DE PRODUÇÃO (OP) */}
      {abaAtiva === 'ordens_producao' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Ordens de Produção (OP) & Baixa Automatizada nos Silos
              </h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                Controle de bateladas da central Convicta, comparação entre consumo teórico e pesagem real nas células de carga e baixa nos estoques.
              </p>
            </div>
            <button
              onClick={() => setModalNovaOpAberto(true)}
              style={{
                background: '#3B82F6',
                color: '#0F172A',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              + Nova Ordem de Produção
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ordensProducao.map(op => (
              <div key={op.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: '#3B82F6', color: '#FFFFFF', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                        {op.numero}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>{op.dataHora}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                        background: op.status === 'concluida' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: op.status === 'concluida' ? '#10B981' : '#60A5FA'
                      }}>
                        {op.status === 'concluida' ? '✓ Produção Concluída' : '⚙️ Em Produção'}
                      </span>
                    </div>
                    <h3 style={{ margin: '6px 0 2px', fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                      {op.obra} · {op.cliente}
                    </h3>
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      Traço: <strong style={{ color: '#F59E0B' }}>FCK {op.fck} MPa</strong> · Volume: <strong style={{ color: '#38BDF8' }}>{op.volumeM3} m³</strong> ({op.totalBateladas} bateladas de ~8m³) · Operador: {op.operador}
                    </div>
                  </div>

                  {op.status !== 'concluida' && (
                    <button
                      onClick={() => handleConcluirOp(op.id)}
                      style={{
                        background: '#10B981',
                        color: '#0F172A',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Concluir & Baixar Silos
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, background: '#F8FAFC', padding: 12, borderRadius: 10, marginTop: 12, fontSize: 11 }}>
                  <div>
                    <div style={{ color: '#64748B' }}>Cimento (Teórico / Real)</div>
                    <div style={{ fontWeight: 800, color: '#1E293B', marginTop: 2 }}>
                      {op.consumoTeorico.cimentoKg} kg / <span style={{ color: '#F59E0B' }}>{op.consumoRealBalança ? `${op.consumoRealBalança.cimentoKg} kg` : 'Pesando...'}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>Areia Média (Teórico / Real)</div>
                    <div style={{ fontWeight: 800, color: '#1E293B', marginTop: 2 }}>
                      {op.consumoTeorico.areiaKg} kg / <span style={{ color: '#F59E0B' }}>{op.consumoRealBalança ? `${op.consumoRealBalança.areiaKg} kg` : 'Pesando...'}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>Brita 1 (Teórico / Real)</div>
                    <div style={{ fontWeight: 800, color: '#1E293B', marginTop: 2 }}>
                      {op.consumoTeorico.britaKg} kg / <span style={{ color: '#F59E0B' }}>{op.consumoRealBalança ? `${op.consumoRealBalança.britaKg} kg` : 'Pesando...'}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>Aditivo Plastificante</div>
                    <div style={{ fontWeight: 800, color: '#A78BFA', marginTop: 2 }}>
                      {op.consumoTeorico.aditivoL} L
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 2: CENTRAL DOSADORA & CALCULADORA NBR 7212 */}
      {abaAtiva === 'central' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Central Dosadora Automatizada · Balança de Precisão (NBR 7212)
            </h2>
            <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
              Cálculo estequiométrico das células de carga com correção em tempo real da umidade superficial da areia da Serrano Mineração.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
            {/* Parâmetros de Entrada */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', color: '#F59E0B' }}>
                1. Parâmetros de Batelada da Usina
              </h3>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 6 }}>
                  Volume a Carregar na Betoneira (m³):
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="0.5"
                  value={calcVolume}
                  onChange={e => setCalcVolume(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A', fontSize: 16, fontWeight: 800 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 6 }}>
                  Resistência de Projeto (FCK):
                </label>
                <select
                  value={calcFck}
                  onChange={e => setCalcFck(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A', fontSize: 14, fontWeight: 800 }}
                >
                  <option value={15}>FCK 15 MPa · Concreto Magro / Regularização</option>
                  <option value={20}>FCK 20 MPa · Pisos e Baldrames</option>
                  <option value={25}>FCK 25 MPa · Lajes, Vigas e Pilares Residenciais</option>
                  <option value={30}>FCK 30 MPa · Estrutural Pesado / Edifícios</option>
                  <option value={35}>FCK 35 MPa · Pisos Industriais e Alto Tráfego</option>
                  <option value={40}>FCK 40 MPa · Obras Especiais / Pontes</option>
                  <option value={45}>FCK 45 MPa · Concreto de Altíssimo Desempenho (CAD)</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: '#64748B' }}>
                    Umidade Superficial da Areia (%):
                  </label>
                  <strong style={{ color: '#38BDF8', fontSize: 13 }}>{calcUmidadeAreia}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={calcUmidadeAreia}
                  onChange={e => setCalcUmidadeAreia(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38BDF8' }}
                />
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  Média atual no pátio da Serrano Mineração: 4,5% a 5,5%. A água livre contida na areia é subtraída automaticamente da água de amassamento.
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, fontSize: 12, color: '#475569', border: '1px solid #E2E8F0' }}>
                <div>Fator Água/Cimento (A/C): <strong style={{ color: '#F59E0B' }}>{dosagemCalculada.fatorAc}</strong></div>
                <div style={{ marginTop: 4 }}>Água Descontada da Areia: <strong style={{ color: '#10B981' }}>{dosagemCalculada.aguaDescontadaL} litros</strong></div>
                <div style={{ marginTop: 4 }}>Peso Total Estimado: <strong style={{ color: '#1E293B' }}>{(dosagemCalculada.pesoTotalCargaKg / 1000).toFixed(2)} Toneladas</strong></div>
              </div>
            </div>

            {/* Display de Pesagem das Células de Carga */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#38BDF8' }}>
                  2. Pesagem Automatizada nas Células de Carga ({calcVolume} m³)
                </h3>
                <span style={{ fontSize: 11, background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                  BALANÇA PRONTA
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>🧱 Cimento CP II-F-32 (Silo Convicta 96t)</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Pesagem por célula de carga</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#F59E0B' }}>{dosagemCalculada.cimentoTotalKg.toLocaleString('pt-BR')} kg</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{dosagemCalculada.cimentoSacos50} sacos de 50kg</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>🏖️ Areia Média Lavada (Serrano Mineração)</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Corrigida para {calcUmidadeAreia}% de umidade</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#1E293B' }}>{dosagemCalculada.areiaTotalKg.toLocaleString('pt-BR')} kg</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{dosagemCalculada.areiaTotalM3} m³</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>🪨 Brita 1 Granítica Selecionada</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Agregado graúdo 9,5 a 19 mm</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#1E293B' }}>{dosagemCalculada.britaTotalKg.toLocaleString('pt-BR')} kg</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{dosagemCalculada.britaTotalM3} m³</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>💧 Água Dosada pelo Hidrômetro Digital</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Descontados {dosagemCalculada.aguaDescontadaL}L da umidade da areia</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#38BDF8' }}>{dosagemCalculada.aguaTotalL.toLocaleString('pt-BR')} litros</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>🧪 Aditivo Plastificante Polifuncional NBR 11768</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Injeção automática no ciclo de mistura</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#A78BFA' }}>{dosagemCalculada.aditivoTotalL} litros</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: TABELA DE TRAÇOS & CATÁLOGO */}
      {abaAtiva === 'tracos' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 16px', color: '#0F172A' }}>
            Catálogo Oficial de Concreto Usinado & Traços FCK
          </h2>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  <th style={{ padding: '14px 18px' }}>Produto / Traço Normatizado</th>
                  <th style={{ padding: '14px 18px' }}>FCK (MPa)</th>
                  <th style={{ padding: '14px 18px' }}>Slump (cm)</th>
                  <th style={{ padding: '14px 18px' }}>Agregado</th>
                  <th style={{ padding: '14px 18px' }}>Aplicação Típica em Tangará</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Preço / m³</th>
                </tr>
              </thead>
              <tbody>
                {catalogo.filter(c => c.categoria === 'Concreto Usinado' || c.categoria === 'Concretos Especiais').map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 800, color: '#0F172A' }}>{item.nome}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{item.descricao}</div>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 900, color: '#F59E0B' }}>
                      {item.fck ? `${item.fck} MPa` : '—'}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#1E293B' }}>{item.slump || '14 ± 2 cm'}</td>
                    <td style={{ padding: '14px 18px', color: '#475569' }}>{item.brita || 'Brita 1'}</td>
                    <td style={{ padding: '14px 18px', color: '#64748B', fontSize: 12 }}>{item.traco || 'Dosagem NBR 7212'}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 900, color: '#FCD34D', fontSize: 16 }}>
                      R$ {item.preco.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 4: LABORATÓRIO TECNOLÓGICO & ENSAIOS (NBR 5738 / NBR 5739) */}
      {abaAtiva === 'laboratorio' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Laboratório Tecnológico · Controle de Corpos de Prova (CP)
              </h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                Moldagem conforme NBR 5738 e ensaio de compressão axial conforme NBR 5739 com câmara úmida de cura a 23°C.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {ensaios.map(ensaio => {
              const isAprovado = ensaio.status === 'aprovado';
              return (
                <div
                  key={ensaio.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 14,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#F59E0B' }}>{ensaio.lote}</span>
                      <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8 }}>Moldagem: {ensaio.dataMoldagem}</span>
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: isAprovado ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: isAprovado ? '#4ADE80' : '#60A5FA',
                      border: `1px solid ${isAprovado ? '#16A34A' : '#2563EB'}`
                    }}>
                      {ensaio.status}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{ensaio.obra}</h3>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Cliente: {ensaio.cliente}</div>
                  </div>

                  {/* Parâmetros do ensaio */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#F8FAFC', padding: '10px 12px', borderRadius: 8, fontSize: 11 }}>
                    <div>FCK Projeto: <strong style={{ color: '#F59E0B' }}>{ensaio.fckProjeto} MPa</strong></div>
                    <div>Slump Medido: <strong style={{ color: '#38BDF8' }}>{ensaio.slumpMedidoCm} cm</strong></div>
                    <div>Resultado 28d: <strong style={{ color: isAprovado ? '#10B981' : '#FCD34D' }}>{ensaio.fckEstimado28d ? `${ensaio.fckEstimado28d} MPa` : 'Em cura'}</strong></div>
                  </div>

                  {/* Detalhes dos 4 corpos de prova */}
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 800, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                      Rupturas de Corpos de Prova Cilíndricos (10x20cm):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {ensaio.corposProva.map((cp, idx) => (
                        <div key={idx} style={{ background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{cp.id} ({cp.idadeDias} dias)</strong>
                            <span style={{ color: cp.tensaoMpa ? '#4ADE80' : '#94A3B8' }}>
                              {cp.tensaoMpa ? `${cp.tensaoMpa} MPa (${cp.percentualFck}%)` : 'Aguardando'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                    <button
                      onClick={() => setModalRupturaAberto(ensaio)}
                      style={{
                        flex: 1,
                        background: '#334155',
                        color: '#0F172A',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      🔨 Registrar Rompimento
                    </button>
                    <button
                      onClick={() => setModalLaudoAberto(ensaio)}
                      style={{
                        flex: 1,
                        background: '#D97706',
                        color: '#0F172A',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      📄 Laudo NBR 5739
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 5: FROTA & TELEMETRIA */}
      {abaAtiva === 'frota' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Frota de Caminhões Betoneira & Bombas Lança
            </h2>
            <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
              8 caminhões betoneira e 2 caminhões bomba lança com alcance de 32m e 36m para obras de grande porte em Tangará da Serra e região.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {frota.map(caminhao => {
              const isDisp = caminhao.status === 'disponivel';
              return (
                <div
                  key={caminhao.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#F59E0B' }}>
                      {caminhao.codigo}
                    </span>
                    <span style={{
                      background: isDisp ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: isDisp ? '#4ADE80' : '#60A5FA',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase'
                    }}>
                      {caminhao.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{caminhao.modelo}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      Placa: <strong>{caminhao.placa}</strong> · {caminhao.capacidadeM3 ? `Capacidade: ${caminhao.capacidadeM3} m³` : `Alcance: ${caminhao.alcanceMetros}m`}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 8, fontSize: 12, color: '#475569' }}>
                    <div>Operador/Motorista: <strong>{caminhao.motorista || caminhao.operador}</strong></div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Contato: {caminhao.telefone} · Horímetro: {caminhao.horimetro} h
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 6: SERRANO MINERAÇÃO & SILOS DE INSUMOS */}
      {abaAtiva === 'mineracao' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Serrano Mineração & Silos de Armazenamento Industrial
            </h2>
            <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
              Dragagem própria de areia média e grossa de rio, silo Convicta vertical de 96 Toneladas e pátio de agregados.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {silos.map(silo => {
              const alerta = silo.nivelPercent < 25;
              return (
                <div
                  key={silo.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 14,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#F59E0B' }}>{silo.codigo}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: alerta ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: alerta ? '#EF4444' : '#10B981'
                    }}>
                      {alerta ? 'NÍVEL BAIXO' : 'NÍVEL REGULAR'}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{silo.nome}</h3>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{silo.insumo}</div>
                  </div>

                  {/* Barra visual de nível */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: '#64748B' }}>Nível de Armazenamento:</span>
                      <strong style={{ color: alerta ? '#EF4444' : '#38BDF8' }}>{silo.nivelPercent}%</strong>
                    </div>
                    <div style={{ background: '#F8FAFC', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                      <div style={{
                        width: `${silo.nivelPercent}%`,
                        height: '100%',
                        background: alerta ? 'linear-gradient(90deg, #EF4444, #DC2626)' : 'linear-gradient(90deg, #F59E0B, #10B981)',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 8, fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Estoque Atual:</span>
                    <strong style={{ color: '#0F172A', fontSize: 14 }}>
                      {silo.estoqueAtualTon ? `${silo.estoqueAtualTon} Ton / ${silo.capacidadeTotalTon} Ton` : `${silo.estoqueAtualM3} m³ / ${silo.capacidadeTotalM3} m³`}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* EXPEDIÇÃO DE AGREGADOS NA BALANÇA COM CFEM */}
          <div style={{ marginTop: 24, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                  ⚖️ Romaneios de Expedição de Agregados na Balança Rodoviária & Tributação CFEM (1,5%)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
                  Pesagem automática de caçambas, apuração do peso líquido e recolhimento da Compensação Financeira (Lei 13.540/2017).
                </p>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ padding: 10, textAlign: 'left', color: '#475569' }}>Romaneio</th>
                  <th style={{ padding: 10, textAlign: 'left', color: '#475569' }}>Data/Hora</th>
                  <th style={{ padding: 10, textAlign: 'left', color: '#475569' }}>Cliente / Destino</th>
                  <th style={{ padding: 10, textAlign: 'left', color: '#475569' }}>Produto</th>
                  <th style={{ padding: 10, textAlign: 'right', color: '#475569' }}>Peso Líquido</th>
                  <th style={{ padding: 10, textAlign: 'right', color: '#475569' }}>Volume</th>
                  <th style={{ padding: 10, textAlign: 'right', color: '#475569' }}>Valor Total</th>
                  <th style={{ padding: 10, textAlign: 'right', color: '#475569' }}>CFEM (1,5%)</th>
                  <th style={{ padding: 10, textAlign: 'center', color: '#475569' }}>NF-e</th>
                </tr>
              </thead>
              <tbody>
                {(vendasAgregados.length > 0 ? vendasAgregados : [
                  {
                    id: 'vda-501', numeroRomaneio: 'ROM-AGR-501', data: '2026-11-12 09:15',
                    cliente: 'Construtora MT Horizon', obraDestino: 'Pavimentação Jardim dos Ipês',
                    produtoNome: 'Areia Média Lavada Rio', pesoLiquidoKg: 16200, volumeM3: 10.8,
                    valorTotal: 702.00, valorCfem: 10.53, nfeNumero: '004819'
                  },
                  {
                    id: 'vda-502', numeroRomaneio: 'ROM-AGR-502', data: '2026-11-12 10:40',
                    cliente: 'Loteamento Residencial Tangará', obraDestino: 'Base para Asfalto e Drenagem',
                    produtoNome: 'Brita 1 Granítica Estrutural', pesoLiquidoKg: 18700, volumeM3: 12.9,
                    valorTotal: 1612.50, valorCfem: 24.19, nfeNumero: '004820'
                  }
                ]).map((vda, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: 10, fontWeight: 800, color: '#EA580C' }}>{vda.numeroRomaneio}</td>
                    <td style={{ padding: 10, color: '#64748B' }}>{vda.data}</td>
                    <td style={{ padding: 10 }}><strong>{vda.cliente}</strong><div style={{ fontSize: 11, color: '#64748B' }}>{vda.obraDestino}</div></td>
                    <td style={{ padding: 10, color: '#0F172A' }}>{vda.produtoNome}</td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 700 }}>{(vda.pesoLiquidoKg / 1000).toFixed(2)} t</td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 700, color: '#0284C7' }}>{vda.volumeM3} m³</td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 800, color: '#D97706' }}>R$ {Number(vda.valorTotal).toFixed(2)}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#16A34A', fontWeight: 700 }}>R$ {Number(vda.valorCfem).toFixed(2)}</td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <span style={{ background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                        NF-e {vda.nfeNumero}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA ESPECIALIZADA: MEDIÇÕES DE OBRAS CONSTRUTORA & FATURAMENTO */}
      {abaAtiva === 'medicoes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                📐 Medições Periódicas de Concretagem por Construtora
              </h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                Fechamento quinzenal e mensal com conciliação de romaneios assinados na obra, dedução de retenções técnicas e emissão de boletos.
              </p>
            </div>
            <button
              onClick={() => setModalNovaMedicaoAberto(true)}
              style={{
                background: '#EA580C',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              + Nova Medição de Obra
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {(medicoesObras.length > 0 ? medicoesObras : [
              {
                id: 'med-01', numero: 'MED-2026/01', cliente: 'Construtora MT Horizon',
                obra: 'Edifício Residencial Serra Dourada', periodoInicio: '2026-11-01', periodoFim: '2026-11-15',
                volumeTotalM3: 56.0, eventosBombeamento: 2, valorBrutoTotal: 26520.00,
                retencaoTecnicaPercent: 5.0, valorRetencaoTecnica: 1326.00, valorLiquidoFaturar: 25194.00,
                status: 'aguardando_aprovacao_engenheiro', engenheiroFiscalObra: 'Eng. Marcelo Tavares (CREA-MT 039820)'
              },
              {
                id: 'med-02', numero: 'MED-2026/02', cliente: 'Grupo Moradda Incorporadora',
                obra: 'Edifício Residencial Belvedere Tower', periodoInicio: '2026-11-01', periodoFim: '2026-11-10',
                volumeTotalM3: 40.0, eventosBombeamento: 1, valorBrutoTotal: 18400.00,
                retencaoTecnicaPercent: 0, valorRetencaoTecnica: 0, valorLiquidoFaturar: 18400.00,
                status: 'faturado_boleto', engenheiroFiscalObra: 'Eng. Roberto Alcantara (CREA-MT 028114)'
              }
            ]).map(med => (
              <div key={med.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#EA580C' }}>{med.numero}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 6,
                    background: med.status === 'faturado_boleto' ? '#DCFCE7' : '#FEF3C7',
                    color: med.status === 'faturado_boleto' ? '#16A34A' : '#D97706'
                  }}>
                    {med.status === 'faturado_boleto' ? 'FATURADO (BOLETO GERADO)' : 'AGUARDANDO APROVAÇÃO'}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{med.obra}</h3>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Cliente: <strong>{med.cliente}</strong></div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Período: {med.periodoInicio} a {med.periodoFim} · Fiscal: {med.engenheiroFiscalObra}</div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#F8FAFC', padding: 12, borderRadius: 8, margin: '14px 0', fontSize: 11 }}>
                  <div>Volume Entregue: <div style={{ fontSize: 14, fontWeight: 800, color: '#0284C7' }}>{med.volumeTotalM3} m³</div></div>
                  <div>Bombeamentos: <div style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>{med.eventosBombeamento} viagens</div></div>
                  <div>Retenção (5%): <div style={{ fontSize: 14, fontWeight: 800, color: '#64748B' }}>R$ {Number(med.valorRetencaoTecnica).toFixed(2)}</div></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                  <div>
                    <span style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase' }}>Valor Líquido da Medição</span>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#16A34A' }}>R$ {Number(med.valorLiquidoFaturar).toFixed(2)}</div>
                  </div>
                  {med.status !== 'faturado_boleto' ? (
                    <button
                      onClick={() => faturarMedicao(med.id)}
                      style={{ background: '#16A34A', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                    >
                      💳 Faturar no ERP
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 800 }}>✓ Boleto Emitido</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 7: ORÇAMENTOS & PROPOSTAS COMERCIAIS */}
      {abaAtiva === 'propostas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Orçamentos & Propostas Comerciais de Concretagem
              </h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                Simulações rápidas e envio de propostas comerciais em 1 clique via WhatsApp para engenheiros e construtoras.
              </p>
            </div>
            <button
              onClick={() => setModalNovaPropostaAberto(true)}
              style={{
                background: '#F59E0B',
                color: '#0F172A',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              + Nova Proposta Comercial
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {propostas.map(prop => (
              <div
                key={prop.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#F59E0B' }}>Proposta #{prop.numero}</span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: prop.status === 'aprovada' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: prop.status === 'aprovada' ? '#4ADE80' : '#60A5FA'
                  }}>
                    {prop.status}
                  </span>
                </div>

                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{prop.obra}</h3>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    Cliente: <strong>{prop.cliente}</strong> ({prop.contato}) · {prop.telefone}
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div>FCK: <strong>{prop.fck} MPa</strong> · Volume: <strong>{prop.volumeM3} m³</strong></div>
                    <div style={{ color: '#64748B', marginTop: 2 }}>{prop.tipoBomba}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#FCD34D' }}>
                      R$ {Number(prop.totalProposta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{prop.condicaoPagamento}</div>
                  </div>
                </div>

                <button
                  onClick={() => enviarPropostaWhatsApp(prop)}
                  style={{
                    background: '#16A34A',
                    color: '#0F172A',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  📲 Enviar via WhatsApp em 1 Clique
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 8: HOLDING SERRANO & PALATARE */}
      {abaAtiva === 'holding' && (
        <div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 12px', color: '#0F172A' }}>
              Holding Serrano & Palatare Participações S/A
            </h2>
            <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 20px' }}>
              Sinergia corporativa consolidada no Kytto ERP entre a indústria de base (Serrano Concreto & Mineração) e a gastronomia premium (Palatare Pizzaria & Restaurante) em Tangará da Serra/MT.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🚚</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#F59E0B', margin: '0 0 6px' }}>
                  Serrano Concreto Usinado & Mineração
                </h3>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
                  CNPJ: 51.499.928/0001-01 · Av. Inácio Bittencourt Cardoso 4451 E
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Central automatizada de concreto, pátio de mineração de areia e brita, frota de 8 betoneiras e bombas lança 32m/36m.
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🍕</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#E11D48', margin: '0 0 6px' }}>
                  Palatare Pizzaria & Restaurante
                </h3>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
                  CNPJ: 31.002.650/0001-08 · Rua 14 nº 307 W, Centro
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
                  Gastronomia refinada, forno a lenha 400°C, rodízio inteligente, KDS 4 praças e delivery em Tangará da Serra.
                </div>
                <a
                  href="/admin/palatare"
                  style={{
                    display: 'inline-block',
                    background: '#E11D48',
                    color: '#0F172A',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    textDecoration: 'none'
                  }}
                >
                  Acessar Suíte Palatare 🍕
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA CARGA */}
      {modalNovaCargaAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, maxWidth: 600, width: '100%', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
              Agendar Nova Carga de Concretagem
            </h3>
            <form onSubmit={handleCriarCarga} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Cliente / Construtora:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Construtora Tangará Prime"
                  value={formCarga.cliente}
                  onChange={e => setFormCarga({ ...formCarga, cliente: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Nome da Obra / Etapa:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Edifício Residencial · Lajes do 3º Pavimento"
                  value={formCarga.obra}
                  onChange={e => setFormCarga({ ...formCarga, obra: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Endereço em Tangará da Serra/região:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rua 26 nº 450, Jardim Europa"
                  value={formCarga.endereco}
                  onChange={e => setFormCarga({ ...formCarga, endereco: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Resistência (FCK):</label>
                  <select
                    value={formCarga.fck}
                    onChange={e => setFormCarga({ ...formCarga, fck: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  >
                    <option value={20}>FCK 20 MPa</option>
                    <option value={25}>FCK 25 MPa</option>
                    <option value={30}>FCK 30 MPa</option>
                    <option value={35}>FCK 35 MPa</option>
                    <option value={40}>FCK 40 MPa</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Volume Total (m³):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={formCarga.volumeM3}
                    onChange={e => setFormCarga({ ...formCarga, volumeM3: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Sistema de Descarga:</label>
                  <select
                    value={formCarga.bomba}
                    onChange={e => setFormCarga({ ...formCarga, bomba: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  >
                    <option value="BL-01 (Bomba Lança 32m)">BL-01 (Bomba Lança 32m)</option>
                    <option value="BL-02 (Bomba Lança 36m)">BL-02 (Bomba Lança 36m)</option>
                    <option value="Descarga Direta (Calha)">Descarga Direta (Calha)</option>
                    <option value="Bomba Estacionária 100m">Bomba Estacionária 100m</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Horário Despacho:</label>
                  <input
                    type="time"
                    value={formCarga.horarioAgendado}
                    onChange={e => setFormCarga({ ...formCarga, horarioAgendado: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setModalNovaCargaAberto(false)}
                  style={{ padding: '10px 16px', borderRadius: 8, background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: 8, background: '#F59E0B', color: '#0F172A', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  Confirmar Programação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR RUPTURA CP */}
      {modalRupturaAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, maxWidth: 480, width: '100%', padding: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
              Ensaio de Compressão Axial (NBR 5739)
            </h3>
            <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 16px' }}>
              Lote: <strong style={{ color: '#F59E0B' }}>{modalRupturaAberto.lote}</strong> · Obra: {modalRupturaAberto.obra}
            </p>

            <form onSubmit={handleRegistrarRuptura} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Corpo de Prova:</label>
                  <select
                    value={formRuptura.cpId}
                    onChange={e => setFormRuptura({ ...formRuptura, cpId: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  >
                    <option value="CP-1">CP-1 (7 dias)</option>
                    <option value="CP-2">CP-2 (7 dias)</option>
                    <option value="CP-3">CP-3 (28 dias)</option>
                    <option value="CP-4">CP-4 (28 dias)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Idade de Cura:</label>
                  <select
                    value={formRuptura.idadeDias}
                    onChange={e => setFormRuptura({ ...formRuptura, idadeDias: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  >
                    <option value={7}>7 dias</option>
                    <option value={14}>14 dias</option>
                    <option value={28}>28 dias</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Tensão de Ruptura (MPa):</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="Ex: 26.5"
                  value={formRuptura.tensaoMpa}
                  onChange={e => {
                    const mpa = Number(e.target.value);
                    setFormRuptura({
                      ...formRuptura,
                      tensaoMpa: e.target.value,
                      forcaKn: (mpa * 7.854).toFixed(1)
                    });
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontSize: 16, fontWeight: 800 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Força Aplicada na Prensa (kN):</label>
                <input
                  type="number"
                  step="0.1"
                  value={formRuptura.forcaKn}
                  onChange={e => setFormRuptura({ ...formRuptura, forcaKn: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setModalRupturaAberto(null)}
                  style={{ padding: '8px 14px', borderRadius: 8, background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#10B981', color: '#0F172A', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  Salvar Ensaio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA PROPOSTA COMERCIAL */}
      {modalNovaPropostaAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, maxWidth: 600, width: '100%', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
              Gerar Proposta Comercial de Concretagem
            </h3>
            <form onSubmit={handleCriarProposta} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Cliente / Construtora:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Grupo Moradda Incorporadora"
                  value={formProposta.cliente}
                  onChange={e => setFormProposta({ ...formProposta, cliente: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Nome do Contato:</label>
                  <input
                    type="text"
                    placeholder="Ex: Danilo Moraes"
                    value={formProposta.contato}
                    onChange={e => setFormProposta({ ...formProposta, contato: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>WhatsApp / Telefone:</label>
                  <input
                    type="text"
                    required
                    placeholder="(65) 99999-0000"
                    value={formProposta.telefone}
                    onChange={e => setFormProposta({ ...formProposta, telefone: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Nome da Obra:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lajes e Vigas Edifício Belvedere"
                  value={formProposta.obra}
                  onChange={e => setFormProposta({ ...formProposta, obra: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Resistência (FCK):</label>
                  <select
                    value={formProposta.fck}
                    onChange={e => setFormProposta({ ...formProposta, fck: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  >
                    <option value={20}>FCK 20 MPa (R$ 380/m³)</option>
                    <option value={25}>FCK 25 MPa (R$ 410/m³)</option>
                    <option value={30}>FCK 30 MPa (R$ 440/m³)</option>
                    <option value={35}>FCK 35 MPa (R$ 480/m³)</option>
                    <option value={40}>FCK 40 MPa (R$ 520/m³)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Volume Estimado (m³):</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formProposta.volumeM3}
                    onChange={e => setFormProposta({ ...formProposta, volumeM3: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Sistema de Bombeamento:</label>
                <select
                  value={formProposta.tipoBomba}
                  onChange={e => setFormProposta({ ...formProposta, tipoBomba: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                >
                  <option value="Bomba Lança 32m">Bomba Lança 32m (R$ 750 até 25m³ + R$ 25/m³ excedente)</option>
                  <option value="Bomba Lança 36m">Bomba Lança 36m Schwing (R$ 850 até 25m³)</option>
                  <option value="Descarga Direta (Calha)">Descarga Direta / Calha (Sem taxa de bomba)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setModalNovaPropostaAberto(false)}
                  style={{ padding: '8px 14px', borderRadius: 8, background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#F59E0B', color: '#0F172A', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  Gerar Proposta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LAUDO TECNOLÓGICO NBR 5739 */}
      {modalLaudoAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', width: '100%', maxWidth: 760, borderRadius: 14, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#D97706' }}>SERRANO CONCRETO & MINERAÇÃO</div>
                <div style={{ fontSize: 11, color: '#475569' }}>CONTROLE TECNOLÓGICO DE CONCRETO · NBR 5738 / NBR 5739</div>
                <div style={{ fontSize: 11, color: '#475569' }}>CNPJ: 51.499.928/0001-01 · Av. Inácio Bittencourt Cardoso, 4451 E · Tangará da Serra/MT</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>LAUDO DE RESISTÊNCIA</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#2563EB' }}>{modalLaudoAberto.laudoNumero || `LAUDO-${modalLaudoAberto.lote}`}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Data Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 12, border: '1px solid #E2E8F0' }}>
              <div><strong>CLIENTE:</strong> {modalLaudoAberto.cliente}</div>
              <div style={{ marginTop: 4 }}><strong>OBRA:</strong> {modalLaudoAberto.obra}</div>
              <div style={{ marginTop: 4 }}><strong>LOCAL:</strong> {modalLaudoAberto.endereco}</div>
              <div style={{ marginTop: 4 }}><strong>DATA DA MOLDAGEM:</strong> {modalLaudoAberto.dataMoldagem} · <strong>SLUMP:</strong> {modalLaudoAberto.slumpMedidoCm} cm</div>
            </div>

            <h4 style={{ margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase' }}>
              Resultados dos Ensaios de Compressão Axial (Corpos de Prova 10x20cm):
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20 }}>
              <thead>
                <tr style={{ background: '#E2E8F0', borderBottom: '1px solid #94A3B8' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>CP ID</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Idade</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Data Ruptura</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Força (kN)</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Tensão (MPa)</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>% do FCK</th>
                </tr>
              </thead>
              <tbody>
                {modalLaudoAberto.corposProva.map((cp, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: 8 }}><strong>{cp.id}</strong></td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{cp.idadeDias} dias</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{cp.dataRuptura || 'Aguardando'}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{cp.forcaKn || '—'}</td>
                    <td style={{ padding: 8, textAlign: 'center', fontWeight: 700 }}>{cp.tensaoMpa ? `${cp.tensaoMpa} MPa` : '—'}</td>
                    <td style={{ padding: 8, textAlign: 'center', color: cp.percentualFck >= 100 ? '#16A34A' : '#D97706', fontWeight: 800 }}>
                      {cp.percentualFck ? `${cp.percentualFck}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 12, borderRadius: 8, fontSize: 12, color: '#065F46', marginBottom: 24 }}>
              <strong>PARECER TÉCNICO:</strong> O concreto ensaiado atingiu a resistência característica especificada de projeto ({modalLaudoAberto.fckProjeto} MPa), estando em estrita conformidade com as exigências da norma ABNT NBR 6118 / NBR 12655.
            </div>

            <div style={{ borderTop: '1px dashed #94A3B8', paddingTop: 20, textAlign: 'center', fontSize: 11 }}>
              <div style={{ fontWeight: 800 }}>{modalLaudoAberto.responsavelTecnico || 'Engª Karin Prestes (CREA-MT 027300)'}</div>
              <div style={{ color: '#64748B' }}>Responsável Técnica · Serrano Concreto & Artefatos de Cimento LTDA</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setModalLaudoAberto(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
              >
                🖨️ Imprimir Laudo Oficial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO PEDIDO DE COMPRA DE MATÉRIA-PRIMA */}
      {modalNovaCompraAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, maxWidth: 520, width: '100%', padding: 24 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
              Novo Pedido de Compra de Matéria-Prima
            </h3>
            <form onSubmit={handleCriarCompra} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Insumo Desejado:</label>
                <select
                  value={formCompra.insumoId}
                  onChange={e => {
                    const sel = insumosCatalogo.find(i => i.id === e.target.value);
                    setFormCompra({
                      ...formCompra,
                      insumoId: e.target.value,
                      fornecedor: sel ? sel.fornecedorPadrao : formCompra.fornecedor,
                      precoUnitario: sel ? sel.custoUnitario : formCompra.precoUnitario
                    });
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                >
                  {insumosCatalogo.map(ins => (
                    <option key={ins.id} value={ins.id}>{ins.nome} ({ins.unidade})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Quantidade:</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formCompra.quantidade}
                    onChange={e => setFormCompra({ ...formCompra, quantidade: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Preço Unitário (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formCompra.precoUnitario}
                    onChange={e => setFormCompra({ ...formCompra, precoUnitario: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Fornecedor Homologado:</label>
                <input
                  type="text"
                  required
                  value={formCompra.fornecedor}
                  onChange={e => setFormCompra({ ...formCompra, fornecedor: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Condição de Pagamento:</label>
                <select
                  value={formCompra.formaPagamento}
                  onChange={e => setFormCompra({ ...formCompra, formaPagamento: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                >
                  <option value="Boleto 30 DDL">Boleto 30 DDL</option>
                  <option value="Boleto 14/28 DDL">Boleto 14/28 DDL</option>
                  <option value="PIX à Vista c/ Desconto">PIX à Vista com Desconto</option>
                  <option value="Faturado 15 DDL">Faturado 15 DDL</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setModalNovaCompraAberto(false)}
                  style={{ padding: '8px 14px', borderRadius: 8, background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#10B981', color: '#0F172A', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  Emitir Pedido de Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR RECEBIMENTO E PESAGEM NA BALANÇA */}
      {modalRecebimentoAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, maxWidth: 480, width: '100%', padding: 24 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
              Pesagem e Recebimento na Balança Rodoviária
            </h3>
            <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>
              Pedido: <strong style={{ color: '#F59E0B' }}>{modalRecebimentoAberto.numero}</strong> · {modalRecebimentoAberto.insumoNome}
            </p>

            <form onSubmit={handleRegistrarRecebimento} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                  Peso Líquido Apurado na Balança ({modalRecebimentoAberto.unidade}):
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formRecebimento.pesoBalançaEntradaTon}
                  onChange={e => setFormRecebimento({ ...formRecebimento, pesoBalançaEntradaTon: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontSize: 16, fontWeight: 800 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Número da NF-e de Entrada:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: NF-e 109.845"
                  value={formRecebimento.notaFiscal}
                  onChange={e => setFormRecebimento({ ...formRecebimento, notaFiscal: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Responsável pelo Recebimento:</label>
                <input
                  type="text"
                  required
                  value={formRecebimento.responsavelRecebimento}
                  onChange={e => setFormRecebimento({ ...formRecebimento, responsavelRecebimento: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, fontSize: 11, color: '#64748B' }}>
                💡 Ao confirmar, o estoque no <strong>{modalRecebimentoAberto.siloDestinoNome}</strong> será incrementado automaticamente e o custo médio atualizado.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setModalRecebimentoAberto(null)}
                  style={{ padding: '8px 14px', borderRadius: 8, background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#10B981', color: '#0F172A', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  Confirmar Entrada no Silo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA ORDEM DE PRODUÇÃO (OP) */}
      {modalNovaOpAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, maxWidth: 520, width: '100%', padding: 24 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
              Criar Nova Ordem de Produção (OP)
            </h3>
            <form onSubmit={handleCriarOp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Cliente / Construtora:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Construtora Moradda"
                  value={formOp.cliente}
                  onChange={e => setFormOp({ ...formOp, cliente: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Obra / Elemento Estrutural:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Edifício Garden - Vigas e Pilares"
                  value={formOp.obra}
                  onChange={e => setFormOp({ ...formOp, obra: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Traço FCK (MPa):</label>
                  <select
                    value={formOp.fck}
                    onChange={e => setFormOp({ ...formOp, fck: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 800 }}
                  >
                    <option value={15}>FCK 15 MPa</option>
                    <option value={20}>FCK 20 MPa</option>
                    <option value={25}>FCK 25 MPa</option>
                    <option value={30}>FCK 30 MPa</option>
                    <option value={35}>FCK 35 MPa</option>
                    <option value={40}>FCK 40 MPa</option>
                    <option value={45}>FCK 45 MPa</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Volume Total (m³):</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    required
                    value={formOp.volumeM3}
                    onChange={e => setFormOp({ ...formOp, volumeM3: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 800 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Operador da Central Convicta:</label>
                <input
                  type="text"
                  required
                  value={formOp.operador}
                  onChange={e => setFormOp({ ...formOp, operador: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setModalNovaOpAberto(false)}
                  style={{ padding: '8px 14px', borderRadius: 8, background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#3B82F6', color: '#FFFFFF', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  Gerar Ordem de Produção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ROMANEIO OFICIAL NBR 7212 */}

      {/* MODAL NOVO ROMANEIO DE VENDA DE AGREGADOS NA BALANÇA */}
      {modalVendaAgregadoAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', width: '100%', maxWidth: 580, borderRadius: 14, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>⚖️ Pesar & Emitir Romaneio de Agregados</h3>
              <button onClick={() => setModalVendaAgregadoAberto(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <form onSubmit={salvarVendaAgregado}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Cliente / Construtora</label>
                  <input required value={formVendaAgregado.cliente} onChange={e => setFormVendaAgregado({ ...formVendaAgregado, cliente: e.target.value })} placeholder="Ex: Construtora MT Horizon" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Obra / Destino</label>
                  <input required value={formVendaAgregado.obraDestino} onChange={e => setFormVendaAgregado({ ...formVendaAgregado, obraDestino: e.target.value })} placeholder="Ex: Pavimentação Av. Brasil" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Veículo / Placa</label>
                  <input required value={formVendaAgregado.veiculoPlaca} onChange={e => setFormVendaAgregado({ ...formVendaAgregado, veiculoPlaca: e.target.value })} placeholder="Ex: RAQ-3E89 (Caçamba)" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Motorista</label>
                  <input required value={formVendaAgregado.motorista} onChange={e => setFormVendaAgregado({ ...formVendaAgregado, motorista: e.target.value })} placeholder="Ex: Claudemir Gomes" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Produto / Agregado</label>
                <select value={formVendaAgregado.produtoId} onChange={e => {
                  const id = e.target.value;
                  const isBrita = id.includes('brita');
                  setFormVendaAgregado({
                    ...formVendaAgregado,
                    produtoId: id,
                    produtoNome: isBrita ? 'Brita 1 Granítica Estrutural' : 'Areia Média Lavada Rio (Serrano Mineração)',
                    precoUnitarioM3: isBrita ? 125.00 : 65.00
                  });
                }} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }}>
                  <option value="ins-areia-med">Areia Média Lavada Rio (Mineração Própria) - R$ 65,00/m³</option>
                  <option value="ins-areia-gros">Areia Grossa de Dragagem (Mineração Própria) - R$ 72,00/m³</option>
                  <option value="ins-brita-0">Pedrisco / Brita 0 - R$ 115,00/m³</option>
                  <option value="ins-brita-1">Brita 1 Granítica Estrutural - R$ 125,00/m³</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>Peso Bruto (kg)</label>
                  <input type="number" value={formVendaAgregado.pesoBrutoKg} onChange={e => setFormVendaAgregado({ ...formVendaAgregado, pesoBrutoKg: Number(e.target.value) })} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>Tara (kg)</label>
                  <input type="number" value={formVendaAgregado.taraKg} onChange={e => setFormVendaAgregado({ ...formVendaAgregado, taraKg: Number(e.target.value) })} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>Líquido Estimado</label>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>
                    {((formVendaAgregado.pesoBrutoKg - formVendaAgregado.taraKg) / 1000).toFixed(2)} ton
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setModalVendaAgregadoAberto(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#EA580C', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>⚖️ Confirmar Pesagem & Emitir NF-e</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA MEDIÇÃO DE OBRA */}
      {modalNovaMedicaoAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', width: '100%', maxWidth: 580, borderRadius: 14, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>📐 Fechamento de Medição de Obra</h3>
              <button onClick={() => setModalNovaMedicaoAberto(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <form onSubmit={salvarNovaMedicao}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Construtora / Cliente</label>
                  <input required value={formMedicao.cliente} onChange={e => setFormMedicao({ ...formMedicao, cliente: e.target.value })} placeholder="Ex: Construtora MT Horizon" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Nome da Obra</label>
                  <input required value={formMedicao.obra} onChange={e => setFormMedicao({ ...formMedicao, obra: e.target.value })} placeholder="Ex: Edifício Serra Dourada" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Volume Medido (m³)</label>
                  <input type="number" required value={formMedicao.volumeTotalM3} onChange={e => setFormMedicao({ ...formMedicao, volumeTotalM3: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Preço Médio (R$/m³)</label>
                  <input type="number" required value={formMedicao.precoMedioM3} onChange={e => setFormMedicao({ ...formMedicao, precoMedioM3: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Retenção Técnica (%)</label>
                  <input type="number" required value={formMedicao.retencaoTecnicaPercent} onChange={e => setFormMedicao({ ...formMedicao, retencaoTecnicaPercent: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Engenheiro Fiscal da Obra</label>
                <input value={formMedicao.engenheiroFiscalObra} onChange={e => setFormMedicao({ ...formMedicao, engenheiroFiscalObra: e.target.value })} placeholder="Ex: Eng. Marcelo Tavares (CREA-MT)" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', color: '#0F172A' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setModalNovaMedicaoAberto(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#EA580C', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>Salvar Medição de Obra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalRomaneioAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', width: '100%', maxWidth: 760, borderRadius: 14, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#D97706' }}>SERRANO CONCRETO USINADO</div>
                <div style={{ fontSize: 11, color: '#475569' }}>SERRANO CONCRETO E ARTEFATOS DE CIMENTO LTDA</div>
                <div style={{ fontSize: 11, color: '#475569' }}>CNPJ: 51.499.928/0001-01 · RNTRC: 056256077 · IE: 13.567.890-3</div>
                <div style={{ fontSize: 11, color: '#475569' }}>Av. Inácio Bittencourt Cardoso, 4451 - E · Tangará da Serra/MT · Tel: (65) 99946-4899</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>ROMANEIO DE ENTREGA</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#DC2626' }}>Nº {modalRomaneioAberto.numero}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Emissão: {new Date().toLocaleDateString('pt-BR')} {modalRomaneioAberto.horarioAgendado}</div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 12, border: '1px solid #E2E8F0' }}>
              <div><strong>CLIENTE:</strong> {modalRomaneioAberto.cliente}</div>
              <div style={{ marginTop: 4 }}><strong>OBRA:</strong> {modalRomaneioAberto.obra}</div>
              <div style={{ marginTop: 4 }}><strong>ENDEREÇO DA OBRA:</strong> {modalRomaneioAberto.endereco}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 12 }}>
              <div style={{ border: '1px solid #CBD5E1', padding: 10, borderRadius: 6 }}>
                <div><strong>RESISTÊNCIA ESPECIFICADA:</strong> {modalRomaneioAberto.fck}</div>
                <div style={{ marginTop: 4 }}><strong>SLUMP DE PROJETO:</strong> {modalRomaneioAberto.slump}</div>
                <div style={{ marginTop: 4 }}><strong>AGREGADO:</strong> {modalRomaneioAberto.brita}</div>
              </div>
              <div style={{ border: '1px solid #CBD5E1', padding: 10, borderRadius: 6 }}>
                <div><strong>VOLUME TOTAL DA OBRA:</strong> {modalRomaneioAberto.volumeM3} m³</div>
                <div style={{ marginTop: 4 }}><strong>SISTEMA DE DESCARGA:</strong> {modalRomaneioAberto.bomba}</div>
                <div style={{ marginTop: 4 }}><strong>CONTROLE TECNOLÓGICO:</strong> {modalRomaneioAberto.laudoCp}</div>
              </div>
            </div>

            <h4 style={{ margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase' }}>
              Escala de Viagens & Caminhões Betoneira (NBR 7212):
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20 }}>
              <thead>
                <tr style={{ background: '#E2E8F0', borderBottom: '1px solid #94A3B8' }}>
                  <th style={{ padding: 6, textAlign: 'left' }}>Betoneira</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Motorista</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Volume</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Saída Usina</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Chegada Obra</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Fim Descarga</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Espera</th>
                </tr>
              </thead>
              <tbody>
                {modalRomaneioAberto.viagens.map((v, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: 6 }}><strong>{v.betoneira}</strong></td>
                    <td style={{ padding: 6 }}>{v.motorista}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.volume} m³</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.saida || '—'}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.chegada || '—'}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.fimDescarga || '—'}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.tempoEsperaMin ? `${v.tempoEsperaMin} min` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: 11, color: '#475569', marginBottom: 24 }}>
              <strong>Declaração NBR 7212:</strong> Declaramos que o concreto acima foi dosado em central automatizada de acordo com os traços normatizados. É expressamente proibida a adição de água à betoneira na obra sem prévia autorização da usina dosadora. A franquia legal de permanência na obra é de 60 minutos após a chegada.
            </div>

            <div style={{ borderTop: '1px dashed #94A3B8', paddingTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 11, textAlign: 'center' }}>
              <div style={{ width: '45%' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>Assinatura do Motorista / Usina</div>
              </div>
              <div style={{ width: '45%' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>Assinatura do Responsável na Obra</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setModalRomaneioAberto(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#D97706', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
              >
                🖨️ Imprimir Romaneio NBR 7212
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
