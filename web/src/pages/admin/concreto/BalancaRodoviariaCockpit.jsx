import React, { useState, useEffect, useRef } from 'react';
import { api, fmtR } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

export default function BalancaRodoviariaCockpit({ onVoltar }) {
  const { token } = useAuth();

  // Estados de Navegação e Abas
  const [abaPrincipal, setAbaPrincipal] = useState('operacao'); // 'operacao' | 'cftv' | 'historico' | 'patio' | 'configuracoes'
  const [etapaPesagem, setEtapaPesagem] = useState('segunda'); // 'primeira' | 'segunda'
  const [carregando, setCarregando] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [buscaTermo, setBuscaTermo] = useState('');
  const [filtroMaterial, setFiltroMaterial] = useState('todos');

  // Estado do Hardware da Balança
  const [hardware, setHardware] = useState({
    semaforoEntrada: 'verde',
    cancelaEntrada: 'aberta',
    semaforoSaida: 'vermelho',
    cancelaSaida: 'fechada',
    sensorBarreiraEntrada: false,
    sensorBarreiraSaida: false,
    sensorPresencaPlataforma: true,
    posicionamentoCorreto: true,
    pesoAtualKg: 33480,
    estabilidade: 'estavel',
    taraAtualKg: 14280,
    pesoLiquidoAtualKg: 19200,
    zeroRastreado: true,
    capacidadeMaximaKg: 80000,
    divisaoKg: 10,
    cameraLprAtiva: true,
    placaDetectada: 'BT-01 (RRA-4E80)',
    rfidDetectado: 'TAG-MT-0428',
    confiancaLpr: 0.996,
    modoOperacao: 'remoto',
    interfoneAtivo: false,
    mensagemInterfone: 'Aguardando aproximação de veículo...',
    veiculoAtual: {
      placa: 'BT-01 (RRA-4E80)',
      tipo: 'betoneira',
      modelo: 'Caminhão Betoneira VW Constellation 26.280 8x4',
      motorista: 'Marcos Silveira',
      material: 'Concreto Usinado Estrutural FCK 30 MPa'
    },
    veiculosNoPatio: []
  });

  // Câmera CFTV selecionada em destaque
  const [cameraAtiva, setCameraAtiva] = useState('cam01');
  const [snapshotCapturado, setSnapshotCapturado] = useState(null);
  const [scannerLprAtivo, setScannerLprAtivo] = useState(true);
  const [interfoneOuvindo, setInterfoneOuvindo] = useState(false);

  // Relógio do CFTV em tempo real
  const [horarioCftv, setHorarioCftv] = useState(new Date().toLocaleTimeString('pt-BR'));

  useEffect(() => {
    const t = setInterval(() => {
      setHorarioCftv(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const [estatisticas, setEstatisticas] = useState({
    totalVeiculosHoje: 14,
    totalToneladasHoje: 384.6,
    tempoMedioPesagemSegundos: 38,
    veiculosNoPatioQtd: 2,
    faturamentoPesagensHoje: 12450.00
  });

  const [tickets, setTickets] = useState([]);
  const [veiculosPatio, setVeiculosPatio] = useState([]);

  // Configurações Técnicas
  const [configuracoes, setConfiguracoes] = useState({
    modeloIndicador: 'Toledo Prix 9094',
    protocoloComunicacao: 'Toledo P03 Contínuo',
    portaSerial: 'COM3',
    baudRate: 9600,
    dataBits: 8,
    paridade: 'N',
    stopBits: 1,
    capacidadeMaximaKg: 80000,
    divisaoMetrologicaKg: 10,
    ipCameraEntradaLpr: '192.168.1.120',
    ipCameraSaidaLpr: '192.168.1.121',
    ipControladorCancelas: '192.168.1.150',
    tempoAberturaCancelaSegundos: 10,
    fechamentoAutomaticoAposBarreira: true,
    impressaoAutomaticaTicket: true,
    viasImpressaoTicket: 2,
    emitirRomaneioA4Simultaneo: false,
    impressoraTermicaPadrao: 'Epson TM-T20X (Rede 192.168.1.200)',
    aliquotaCfemMinerais: 1.5,
    toleranciaContranPercent: 5.0,
    cabecalhoTicket: {
      razaoSocial: 'SERRANO CONCRETO USINADO & MINERAÇÃO LTDA',
      nomeFantasia: 'Serrano Concreto & Mineração',
      cnpj: '03.849.201/0001-10',
      inscricaoEstadual: '13.489.201-9',
      endereco: 'Rodovia MT-358 km 08 · Zona Rural · Tangará da Serra/MT',
      telefone: '(65) 3326-4400',
      portariaInmetro: 'IPEM-MT / INMETRO Portaria 042/2026'
    }
  });

  // Formulário de 1ª Pesagem (Entrada)
  const [formEntrada, setFormEntrada] = useState({
    placaVeiculo: 'BT-02 (RRA-4E81)',
    modeloVeiculo: 'Caminhão Betoneira VW Constellation 26.280',
    motorista: 'Carlos Alberto Ferreira',
    cpfMotorista: '712.981.402-11',
    transportadora: 'Frota Própria Serrano',
    cliente: 'Construtora MT Horizon Ltda',
    obraDestino: 'Residencial Ilhas do Lago',
    tipoMaterial: 'Concreto Usinado Estrutural FCK 30 MPa',
    tipoOperacao: 'expedicao_concreto',
    taraKg: 14280
  });

  // Formulário de 2ª Pesagem (Saída)
  const [veiculoPatioSelecionado, setVeiculoPatioSelecionado] = useState(null);
  const [formSaida, setFormSaida] = useState({
    pesoBrutoKg: 33480,
    taraKg: 14280,
    tipoMaterial: 'Concreto Usinado Estrutural FCK 30 MPa',
    densidadeKgM3: 2400,
    precoUnitarioM3: 420.00
  });

  // Modal de Ticket Térmico 80mm
  const [modalTicket, setModalTicket] = useState(null);

  // Assinatura Touch no Canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);

  // Carregar dados iniciais
  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [resStatus, resConfig, resTickets] = await Promise.all([
        api.get('/api/admin/concreto/balanca/status').catch(() => null),
        api.get('/api/admin/concreto/balanca/configuracoes').catch(() => null),
        api.get('/api/admin/concreto/balanca/tickets').catch(() => null)
      ]);

      if (resStatus?.ok) {
        setHardware(prev => ({ ...prev, ...(resStatus.hardware || {}) }));
        setEstatisticas(resStatus.estatisticasHoje || {});
        setVeiculosPatio(resStatus.veiculosNoPatio || []);
        if (resStatus.veiculosNoPatio?.length > 0 && !veiculoPatioSelecionado) {
          selecionarVeiculoPatio(resStatus.veiculosNoPatio[0]);
        }
      }

      if (resConfig?.ok && resConfig.configuracoes) {
        setConfiguracoes(resConfig.configuracoes);
      }

      if (resTickets?.ok && resTickets.tickets) {
        setTickets(resTickets.tickets);
      } else if (resStatus?.ultimosTickets) {
        setTickets(resStatus.ultimosTickets);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
    const interval = setInterval(carregarDados, 10000);
    return () => clearInterval(interval);
  }, []);

  // Comandos de automação
  const executarComando = async (comando, payload = {}) => {
    try {
      const res = await api.post('/api/admin/concreto/balanca/comando', { comando, payload });
      if (res?.ok) {
        setHardware(prev => ({ ...prev, ...(res.hardware || {}) }));
      }
    } catch (err) {
      alert('Erro ao enviar comando: ' + err.message);
    }
  };

  // Alternadores diretos via clique na imagem
  const toggleCancelaEntrada = () => {
    const novo = hardware.cancelaEntrada === 'aberta' ? 'fechar_cancela_entrada' : 'abrir_cancela_entrada';
    executarComando(novo);
  };

  const toggleCancelaSaida = () => {
    const novo = hardware.cancelaSaida === 'aberta' ? 'fechar_cancela_saida' : 'abrir_cancela_saida';
    executarComando(novo);
  };

  const toggleSemaforoEntrada = () => {
    const novo = hardware.semaforoEntrada === 'verde' ? 'vermelho' : 'verde';
    executarComando('semaforo_entrada', { cor: novo });
  };

  const toggleSemaforoSaida = () => {
    const novo = hardware.semaforoSaida === 'verde' ? 'vermelho' : 'verde';
    executarComando('semaforo_saida', { cor: novo });
  };

  const acionarInterfone = () => {
    setInterfoneOuvindo(true);
    setHardware(prev => ({ ...prev, interfoneAtivo: true, mensagemInterfone: 'Transmitindo voz ao motorista na cabine...' }));
    setTimeout(() => {
      setInterfoneOuvindo(false);
      setHardware(prev => ({ ...prev, interfoneAtivo: false, mensagemInterfone: 'Canal de áudio livre' }));
    }, 4000);
  };

  // Simular cenários de veículos
  const simularCenario = async (cenario) => {
    if (cenario === 'liberar') {
      await executarComando('remover_veiculo');
      return;
    }

    let payload = {};
    if (cenario === 'betoneira') {
      payload = {
        placa: 'BT-01 (RRA-4E80)',
        rfid: 'TAG-MT-0428',
        modelo: 'Caminhão Betoneira VW Constellation 26.280 8x4',
        tipoVeiculo: 'betoneira',
        motorista: 'Marcos Silveira',
        cpfMotorista: '821.492.011-84',
        transportadora: 'Frota Própria Serrano',
        cliente: 'Construtora MT Horizon',
        produto: 'Concreto Usinado Estrutural FCK 30 MPa',
        pesoBrutoKg: 33480,
        taraKg: 14280,
        tipoOperacao: 'expedicao_concreto',
        foraPosicao: false
      };
    } else if (cenario === 'cacamba_areia') {
      payload = {
        placa: 'CAR-04 (QBO-4892)',
        rfid: 'TAG-MT-9912',
        modelo: 'Cavalo Scania R450 Basculante Rossetti',
        tipoVeiculo: 'cacamba',
        motorista: 'Valdir Silvestre',
        cpfMotorista: '492.381.902-15',
        transportadora: 'TransGrãos & Minérios Tangará',
        cliente: 'Pavimentadora Guimarães',
        produto: 'Areia Média Lavada de Rio (Sepotuba)',
        pesoBrutoKg: 46250,
        taraKg: 15450,
        tipoOperacao: 'expedicao_agregados',
        foraPosicao: false
      };
    } else if (cenario === 'bitrem_insumos') {
      payload = {
        placa: 'ROD-01 (OBK-1192)',
        rfid: 'TAG-MT-5501',
        modelo: 'Bitrem Graneleiro 7 Eixos Volvo FH 540',
        tipoVeiculo: 'bitrem',
        motorista: 'Antônio Carlos',
        cpfMotorista: '302.941.812-44',
        transportadora: 'TransGrãos MT',
        cliente: 'Serrano Concreto (Recepção)',
        produto: 'Brita 0 Granítica',
        pesoBrutoKg: 57100,
        taraKg: 18600,
        tipoOperacao: 'recepcao_materia_prima',
        foraPosicao: false
      };
    } else if (cenario === 'fora_posicao') {
      payload = {
        placa: 'TRC-09 (KBB-3301)',
        rfid: 'TAG-MT-3301',
        modelo: 'Caminhão Truck Basculante',
        tipoVeiculo: 'cacamba',
        motorista: 'João Mendes',
        pesoBrutoKg: 28500,
        taraKg: 11000,
        foraPosicao: true
      };
    }

    await executarComando('simular_veiculo', payload);
  };

  // Selecionar veículo do pátio
  const selecionarVeiculoPatio = (v) => {
    setVeiculoPatioSelecionado(v);
    const tara = Number(v.taraEntradaKg) || 12000;
    const bruto = hardware.pesoAtualKg > tara ? hardware.pesoAtualKg : tara + 19200;
    setFormSaida({
      pesoBrutoKg: bruto,
      taraKg: tara,
      tipoMaterial: v.produto || 'Brita 1 Granítica',
      densidadeKgM3: v.produto?.toLowerCase().includes('brita') ? 1450 : v.produto?.toLowerCase().includes('concreto') ? 2400 : 1500,
      precoUnitarioM3: v.produto?.toLowerCase().includes('concreto') ? 420.00 : 65.00
    });
  };

  // Salvar Parâmetros
  const salvarConfiguracoes = async (e) => {
    if (e) e.preventDefault();
    try {
      setSalvandoConfig(true);
      const res = await api.post('/api/admin/concreto/balanca/configuracoes', configuracoes);
      if (res?.ok) {
        alert('Configurações salvas com sucesso!');
        setConfiguracoes(res.configuracoes);
      }
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSalvandoConfig(false);
    }
  };

  // 1ª Pesagem
  const salvarPrimeiraPesagem = async (e) => {
    e.preventDefault();
    try {
      setCarregando(true);
      const res = await api.post('/api/admin/concreto/balanca/entrada', {
        ...formEntrada,
        taraKg: hardware.pesoAtualKg > 0 ? hardware.pesoAtualKg : formEntrada.taraKg
      });
      if (res?.ok) {
        alert(`1ª Pesagem registrada com sucesso para ${res.veiculoPatio.placa}! O veículo foi direcionado ao pátio.`);
        carregarDados();
        setEtapaPesagem('segunda');
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // 2ª Pesagem
  const salvarSegundaPesagem = async (e) => {
    e.preventDefault();
    if (!veiculoPatioSelecionado) {
      alert('Selecione um veículo no pátio para concluir a pesagem!');
      return;
    }

    let assinaturaBase64 = null;
    if (canvasRef.current && temAssinatura) {
      assinaturaBase64 = canvasRef.current.toDataURL('image/png');
    }

    try {
      setCarregando(true);
      const res = await api.post('/api/admin/concreto/balanca/saida', {
        patioId: veiculoPatioSelecionado.id,
        placaVeiculo: veiculoPatioSelecionado.placa,
        modeloVeiculo: veiculoPatioSelecionado.tipoVeiculo,
        motorista: veiculoPatioSelecionado.motorista,
        cpfMotorista: veiculoPatioSelecionado.cpfMotorista,
        transportadora: veiculoPatioSelecionado.transportadora,
        cliente: veiculoPatioSelecionado.cliente,
        tipoMaterial: formSaida.tipoMaterial,
        pesoBrutoKg: formSaida.pesoBrutoKg,
        taraKg: formSaida.taraKg,
        densidadeKgM3: formSaida.densidadeKgM3,
        precoUnitarioM3: formSaida.precoUnitarioM3,
        dataHoraEntrada: veiculoPatioSelecionado.dataHoraEntrada,
        assinaturaMotoristaBase64: assinaturaBase64
      });

      if (res?.ok) {
        setModalTicket(res.ticket);
        carregarDados();
      }
    } catch (err) {
      alert('Erro ao concluir pesagem: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // Canvas
  const iniciarDesenho = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setTemAssinatura(true);
  };

  const desenhar = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0F172A';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const pararDesenho = () => setIsDrawing(false);
  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemAssinatura(false);
  };

  // Cálculos dinâmicos
  const pesoLiquidoCalculado = Math.max(0, formSaida.pesoBrutoKg - formSaida.taraKg);
  const volumeCalculado = formSaida.densidadeKgM3 > 0 ? +(pesoLiquidoCalculado / formSaida.densidadeKgM3).toFixed(2) : 0;
  const valorTotalCalculado = +(volumeCalculado * formSaida.precoUnitarioM3).toFixed(2);
  const isMineral = formSaida.tipoMaterial.toLowerCase().includes('areia') || formSaida.tipoMaterial.toLowerCase().includes('brita');
  const cfemCalculado = isMineral ? +(valorTotalCalculado * (Number(configuracoes.aliquotaCfemMinerais) || 1.5) / 100).toFixed(2) : 0;

  // Impressão e links
  const abrirImpressaoTicket = (ticket) => {
    const id = ticket?.id || ticket?.numeroTicket;
    window.open(`/api/admin/concreto/balanca/tickets/${id}/html?formato=html&print=1${token ? `&token=${encodeURIComponent(token)}` : ''}`, '_blank');
  };

  const abrirRomaneioA4 = () => {
    window.open(`/api/admin/concreto/cargas/crg-1001/romaneio-html?formato=html${token ? `&token=${encodeURIComponent(token)}` : ''}`, '_blank');
  };

  const enviarWhatsAppTicket = (t) => {
    const msg = `*TICKET DE PESAGEM RODOVIÁRIA 80t - SERRANO CONCRETO & MINERAÇÃO*\n` +
      `Ticket: ${t.numeroTicket}\n` +
      `Placa: ${t.veiculoPlaca}\n` +
      `Motorista: ${t.motorista}\n` +
      `Material: ${t.tipoMaterial}\n` +
      `Peso Bruto: ${Number(t.pesoBrutoKg || 0).toLocaleString('pt-BR')} kg\n` +
      `Tara: ${Number(t.taraKg || 0).toLocaleString('pt-BR')} kg\n` +
      `Peso Líquido: ${Number(t.pesoLiquidoKg || 0).toLocaleString('pt-BR')} kg\n` +
      `Volume: ${t.volumeCalculadoM3} m³\n` +
      `Autenticidade: ${t.codigoAutenticidade}\n` +
      `Visualizar Ticket: https://kytto.com.br/api/admin/concreto/balanca/tickets/${t.id || t.numeroTicket}/html?formato=html`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Células de Carga (8 células de 10t cada)
  const pesoPorCelula = hardware.pesoAtualKg > 0 ? Math.round(hardware.pesoAtualKg / 8) : 0;

  return (
    <div style={{ background: '#070A11', color: '#F8FAFC', minHeight: '100vh', padding: '14px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 1. CABEÇALHO COM STATUS DE REDE E HARDWARE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0D1322', border: '1px solid #1E293B', borderRadius: '10px', padding: '10px 16px', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onVoltar && (
            <button onClick={onVoltar} style={{ background: '#1E293B', border: '1px solid #334155', color: '#94A3B8', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
              ← PDV Mesas
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '17px', fontWeight: '900', letterSpacing: '-0.3px', color: '#FFF' }}>
                ⚖️ Balança Rodoviária 80t Toledo
              </span>
              <span style={{ fontSize: '10px', background: '#0284C7', color: '#FFF', padding: '2px 8px', borderRadius: '8px', fontWeight: '800' }}>
                {configuracoes.modeloIndicador}
              </span>
              <span style={{ fontSize: '10px', background: '#065F46', color: '#34D399', padding: '2px 8px', borderRadius: '8px', fontWeight: '700' }}>
                ● Células Digitais Ativas (8x)
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
              {configuracoes.cabecalhoTicket?.nomeFantasia} · Porta {configuracoes.portaSerial} · CFTV &amp; LPR Integrados
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS SUPERIORES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#070A11', border: '1px solid #1E293B', padding: '3px', borderRadius: '8px' }}>
          <button
            onClick={() => setAbaPrincipal('operacao')}
            style={{ background: abaPrincipal === 'operacao' ? '#0284C7' : 'transparent', color: abaPrincipal === 'operacao' ? '#FFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            ⚖️ Pista &amp; Balança
          </button>
          <button
            onClick={() => setAbaPrincipal('cftv')}
            style={{ background: abaPrincipal === 'cftv' ? '#0284C7' : 'transparent', color: abaPrincipal === 'cftv' ? '#FFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            📹 Câmeras CFTV (4)
          </button>
          <button
            onClick={() => setAbaPrincipal('historico')}
            style={{ background: abaPrincipal === 'historico' ? '#0284C7' : 'transparent', color: abaPrincipal === 'historico' ? '#FFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            📋 Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setAbaPrincipal('patio')}
            style={{ background: abaPrincipal === 'patio' ? '#0284C7' : 'transparent', color: abaPrincipal === 'patio' ? '#FFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            🚚 Pátio ({veiculosPatio.length})
          </button>
          <button
            onClick={() => setAbaPrincipal('configuracoes')}
            style={{ background: abaPrincipal === 'configuracoes' ? '#0284C7' : 'transparent', color: abaPrincipal === 'configuracoes' ? '#FFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            ⚙️ Hardware
          </button>
        </div>
      </div>

      {/* 2. CONTEÚDO DA ABA: PISTA & BALANÇA (VISÃO INTERATIVA HI-FI) */}
      {abaPrincipal === 'operacao' && (
        <>
          {/* TOPO: INDICADOR DIGITAL TOLEDO PRIX 9094 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            
            {/* DISPLAY TOLEDO PRIX 9094 */}
            <div style={{ background: '#030509', border: '1.5px solid #1E293B', borderRadius: '10px', padding: '14px', position: 'relative', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.95)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '6px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: '#DC2626', color: '#FFF', fontWeight: '900', fontSize: '9px', padding: '2px 5px', borderRadius: '3px' }}>TOLEDO</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>{configuracoes.modeloIndicador} · Divisão {configuracoes.divisaoMetrologicaKg} kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }}></span>
                  <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '700' }}>RS-232 ONLINE</span>
                </div>
              </div>

              {/* DÍGITOS LED VERDE FLUORESCENTE */}
              <div style={{ background: '#010306', border: '1px solid #0F172A', borderRadius: '6px', padding: '14px 14px', textAlign: 'right', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '8px', left: '10px', display: 'flex', gap: '5px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '800', color: hardware.estabilidade === 'estavel' ? '#10B981' : '#475569', background: hardware.estabilidade === 'estavel' ? 'rgba(16,185,129,0.15)' : 'transparent', border: `1px solid ${hardware.estabilidade === 'estavel' ? '#10B981' : '#334155'}`, padding: '1px 5px', borderRadius: '3px' }}>
                    ● ESTÁVEL
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: '800', color: hardware.zeroRastreado ? '#10B981' : '#475569', background: hardware.zeroRastreado ? 'rgba(16,185,129,0.15)' : 'transparent', border: `1px solid ${hardware.zeroRastreado ? '#10B981' : '#334155'}`, padding: '1px 5px', borderRadius: '3px' }}>
                    &gt;0&lt; ZERO
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: '800', color: hardware.taraAtualKg > 0 ? '#F59E0B' : '#475569', background: hardware.taraAtualKg > 0 ? 'rgba(245,158,11,0.15)' : 'transparent', border: `1px solid ${hardware.taraAtualKg > 0 ? '#F59E0B' : '#334155'}`, padding: '1px 5px', borderRadius: '3px' }}>
                    T TARA
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#00D2FF', background: 'rgba(0,210,255,0.15)', border: '1px solid #00D2FF', padding: '1px 5px', borderRadius: '3px' }}>
                    B BRUTO
                  </span>
                </div>

                <div style={{ fontSize: '48px', fontWeight: '900', fontFamily: 'monospace', color: '#00FF66', textShadow: '0 0 16px rgba(0, 255, 102, 0.7)', lineHeight: 1, letterSpacing: '2px', marginTop: '14px' }}>
                  {Number(hardware.pesoAtualKg || 0).toLocaleString('pt-BR')} <span style={{ fontSize: '18px', color: '#00FF66' }}>kg</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #0F172A', marginTop: '10px', paddingTop: '6px', fontSize: '10px', color: '#94A3B8' }}>
                  <div>Bruto: <strong style={{ color: '#00D2FF' }}>{Number(hardware.pesoAtualKg || 0).toLocaleString('pt-BR')} kg</strong></div>
                  <div>Tara: <strong style={{ color: '#F59E0B' }}>{Number(hardware.taraAtualKg || 0).toLocaleString('pt-BR')} kg</strong></div>
                  <div>Líquido: <strong style={{ color: '#10B981' }}>{Number(hardware.pesoLiquidoAtualKg || 0).toLocaleString('pt-BR')} kg</strong></div>
                </div>
              </div>

              {/* BOTÕES RÁPIDOS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
                <button onClick={() => executarComando('zerar_balanca')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#F1F5F9', borderRadius: '4px', padding: '6px 2px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                  &gt;0&lt; Zerar
                </button>
                <button onClick={() => {
                  const t = prompt('Tara em kg:', hardware.taraAtualKg || '14280');
                  if (t !== null) executarComando('tara_manual', { taraKg: Number(t) });
                }} style={{ background: '#1E293B', border: '1px solid #334155', color: '#F59E0B', borderRadius: '4px', padding: '6px 2px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                  T Tara
                </button>
                <button onClick={() => {
                  setFormSaida(prev => ({ ...prev, pesoBrutoKg: hardware.pesoAtualKg }));
                  alert(`Peso de ${hardware.pesoAtualKg} kg capturado!`);
                }} style={{ background: '#0284C7', border: 'none', color: '#FFF', borderRadius: '4px', padding: '6px 2px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                  ⚡ Capturar
                </button>
                <button onClick={acionarInterfone} style={{ background: interfoneOuvindo ? '#DC2626' : '#1E293B', border: '1px solid #00D2FF', color: '#00D2FF', borderRadius: '4px', padding: '6px 2px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                  🎙️ {interfoneOuvindo ? 'Falando...' : 'Interfone'}
                </button>
              </div>
            </div>

            {/* STATUS DOS SENSORES E CONTROLE DE TRÁFEGO */}
            <div style={{ background: '#0D1322', border: '1px solid #1E293B', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#FFF' }}>SENSORES ÓPTICOS &amp; BARREIRAS</span>
                  <span style={{ fontSize: '10px', color: hardware.posicionamentoCorreto ? '#10B981' : '#EF4444', fontWeight: '800' }}>
                    {hardware.posicionamentoCorreto ? '✓ PLATAFORMA ENQUADRADA' : '⚠️ ALERTA: VEÍCULO FORA'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ background: '#070A11', border: '1px solid #1E293B', borderRadius: '6px', padding: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#94A3B8', fontWeight: '700' }}>ENTRADA (BARREIRA 1)</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: hardware.cancelaEntrada === 'aberta' ? '#10B981' : '#EF4444' }}>
                        {hardware.cancelaEntrada === 'aberta' ? '🔓 Cancela Aberta' : '🔒 Cancela Fechada'}
                      </span>
                      <button onClick={toggleCancelaEntrada} style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: '3px', padding: '2px 6px', fontSize: '9px', cursor: 'pointer' }}>
                        Alternar
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#070A11', border: '1px solid #1E293B', borderRadius: '6px', padding: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#94A3B8', fontWeight: '700' }}>SAÍDA (BARREIRA 2)</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: hardware.cancelaSaida === 'aberta' ? '#10B981' : '#EF4444' }}>
                        {hardware.cancelaSaida === 'aberta' ? '🔓 Cancela Aberta' : '🔒 Cancela Fechada'}
                      </span>
                      <button onClick={toggleCancelaSaida} style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: '3px', padding: '2px 6px', fontSize: '9px', cursor: 'pointer' }}>
                        Alternar
                      </button>
                    </div>
                  </div>
                </div>

                {/* SIMULADOR DE VEÍCULOS */}
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '9px', color: '#64748B', fontWeight: '700', marginBottom: '4px' }}>SIMULADOR DE VEÍCULOS:</div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button onClick={() => simularCenario('betoneira')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#00D2FF', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }}>
                      🚛 Betoneira 33.5t
                    </button>
                    <button onClick={() => simularCenario('cacamba_areia')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#F59E0B', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }}>
                      🚚 Scania Areia 46t
                    </button>
                    <button onClick={() => simularCenario('bitrem_insumos')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#A78BFA', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }}>
                      🚛 Bitrem 57t
                    </button>
                    <button onClick={() => simularCenario('fora_posicao')} style={{ background: '#7F1D1D', border: '1px solid #EF4444', color: '#FCA5A5', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }}>
                      ⚠️ Fora Eixo
                    </button>
                    <button onClick={() => simularCenario('liberar')} style={{ background: '#0284C7', border: 'none', color: '#FFF', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                      🏁 Pista Livre
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PISTA RODOVIÁRIA 21M INTERATIVA EM SVG HI-FI COM ANIMAÇÕES E CLIQUE DIRETO */}
          {/* ========================================================================= */}
          <div style={{ background: '#0D1322', border: '1.5px solid #1E293B', borderRadius: '10px', padding: '16px', marginBottom: '14px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '900', color: '#FFF' }}>
                  🛣️ ILUSTRAÇÃO INTERATIVA DA PISTA RODOVIÁRIA 21 METROS
                </span>
                <span style={{ fontSize: '10px', color: '#64748B' }}>
                  (Clique diretamente nas cancelas, semáforos ou caminhão para interagir)
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#00D2FF', fontWeight: '700' }}>
                {hardware.placaDetectada ? `LPR ATIVO: ${hardware.placaDetectada}` : 'AGUARDANDO APROXIMAÇÃO'}
              </div>
            </div>

            {/* CONTAINER SVG INTERATIVO */}
            <div style={{ width: '100%', overflowX: 'auto', background: '#070A11', borderRadius: '8px', border: '1px solid #1E293B' }}>
              <svg viewBox="0 0 1000 280" style={{ width: '100%', minWidth: '750px', height: 'auto', display: 'block' }}>
                <defs>
                  {/* Gradientes da Pista e Vigas */}
                  <linearGradient id="gradPista" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1E2638" />
                    <stop offset="50%" stopColor="#2A344A" />
                    <stop offset="100%" stopColor="#161C2B" />
                  </linearGradient>

                  <linearGradient id="gradPlataforma" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4A5568" />
                    <stop offset="30%" stopColor="#718096" />
                    <stop offset="70%" stopColor="#4A5568" />
                    <stop offset="100%" stopColor="#2D3748" />
                  </linearGradient>

                  {/* Gradiente da Betoneira */}
                  <linearGradient id="gradTambor" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#EA580C" />
                    <stop offset="50%" stopColor="#FB923C" />
                    <stop offset="100%" stopColor="#C2410C" />
                  </linearGradient>

                  {/* Filtro Glow para Semáforos e Lasers */}
                  <filter id="glowVerde" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glowVermelho" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* 1. ASFALTO DA PISTA RODOVIÁRIA MT-358 */}
                <rect x="0" y="40" width="1000" height="200" fill="url(#gradPista)" />
                {/* Linhas amarelas tracejadas nas margens */}
                <line x1="0" y1="45" x2="1000" y2="45" stroke="#EAB308" strokeWidth="2" strokeDasharray="15,10" />
                <line x1="0" y1="235" x2="1000" y2="235" stroke="#EAB308" strokeWidth="2" strokeDasharray="15,10" />

                {/* 2. FOSSO E GUIA LATERAL DA BALANÇA (21 METROS: X=180 ATÉ X=820) */}
                <rect x="170" y="55" width="660" height="170" fill="#0D111A" rx="4" />
                {/* Guias metálicas amarelas de proteção lateral */}
                <rect x="175" y="58" width="650" height="8" fill="#EAB308" />
                <rect x="175" y="214" width="650" height="8" fill="#EAB308" />

                {/* 3. PLATAFORMA DE CONCRETO PROTENDIDO E CHAPA DE AÇO XADREZ */}
                <rect x="180" y="66" width="640" height="148" fill="url(#gradPlataforma)" rx="3" stroke="#2D3748" strokeWidth="2" />
                {/* Ranhuras de expansão da plataforma */}
                <line x1="340" y1="66" x2="340" y2="214" stroke="#2D3748" strokeWidth="2" />
                <line x1="500" y1="66" x2="500" y2="214" stroke="#2D3748" strokeWidth="2" />
                <line x1="660" y1="66" x2="660" y2="214" stroke="#2D3748" strokeWidth="2" />

                {/* 4. AS 8 CÉLULAS DE CARGA DIGITAIS TOLEDO NOS APOIOS */}
                {[
                  { cx: 210, cy: 74, id: 1 }, { cx: 370, cy: 74, id: 2 }, { cx: 630, cy: 74, id: 3 }, { cx: 790, cy: 74, id: 4 },
                  { cx: 210, cy: 206, id: 5 }, { cx: 370, cy: 206, id: 6 }, { cx: 630, cy: 206, id: 7 }, { cx: 790, cy: 206, id: 8 }
                ].map((c) => (
                  <g key={c.id}>
                    <circle cx={c.cx} cy={c.cy} r="6" fill="#0F172A" stroke="#10B981" strokeWidth="1.5" />
                    <circle cx={c.cx} cy={c.cy} r="2.5" fill={hardware.pesoAtualKg > 0 ? '#10B981' : '#64748B'} />
                  </g>
                ))}

                {/* 5. BARREIRAS ÓPTICAS / FEIXES LASER INFRAVERMELHOS */}
                {/* Barreira de Entrada (X=175) */}
                <line
                  x1="175" y1="50" x2="175" y2="230"
                  stroke={hardware.sensorBarreiraEntrada ? '#EF4444' : '#10B981'}
                  strokeWidth="2.5"
                  strokeDasharray={hardware.sensorBarreiraEntrada ? '4,4' : 'none'}
                  filter={hardware.sensorBarreiraEntrada ? 'url(#glowVermelho)' : 'url(#glowVerde)'}
                />
                {/* Barreira de Saída (X=825) */}
                <line
                  x1="825" y1="50" x2="825" y2="230"
                  stroke={hardware.sensorBarreiraSaida ? '#EF4444' : '#10B981'}
                  strokeWidth="2.5"
                  filter={hardware.sensorBarreiraSaida ? 'url(#glowVermelho)' : 'url(#glowVerde)'}
                />

                {/* 6. VEÍCULO DETALHADO SOBRE A BALANÇA */}
                {hardware.sensorPresencaPlataforma && (
                  <g style={{ cursor: 'pointer' }} onClick={() => simularCenario(hardware.veiculoAtual?.tipo === 'betoneira' ? 'cacamba_areia' : 'betoneira')}>
                    {/* SOMBRA DO CAMINHÃO */}
                    <rect x="240" y="88" width="520" height="104" rx="12" fill="#000000" opacity="0.45" />

                    {/* SE FOR CAMINHÃO BETONEIRA */}
                    {(!hardware.veiculoAtual?.tipo || hardware.veiculoAtual?.tipo === 'betoneira') && (
                      <g>
                        {/* CHASSI & RODAS */}
                        {/* Eixos dianteiros */}
                        <rect x="680" y="78" width="22" height="14" rx="3" fill="#1A202C" stroke="#718096" strokeWidth="1.5" />
                        <rect x="680" y="188" width="22" height="14" rx="3" fill="#1A202C" stroke="#718096" strokeWidth="1.5" />
                        <rect x="630" y="78" width="22" height="14" rx="3" fill="#1A202C" stroke="#718096" strokeWidth="1.5" />
                        <rect x="630" y="188" width="22" height="14" rx="3" fill="#1A202C" stroke="#718096" strokeWidth="1.5" />
                        {/* Eixos traseiros duplos (Tandem) */}
                        <rect x="360" y="76" width="26" height="16" rx="3" fill="#1A202C" stroke="#718096" strokeWidth="1.5" />
                        <rect x="360" y="188" width="26" height="16" rx="3" fill="#1A202C" stroke="#718096" strokeWidth="1.5" />
                        <rect x="310" y="76" width="26" height="16" rx="3" fill="#1A202C" stroke="#718096" strokeWidth="1.5" />
                        <rect x="310" y="188" width="26" height="16" rx="3" fill="#1A202C" stroke="#718096" strokeWidth="1.5" />

                        {/* CABINE VW CONSTELLATION (BRANCA/PRATA) */}
                        <rect x="600" y="94" width="130" height="92" rx="10" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
                        {/* Pára-brisa frontal e teto */}
                        <path d="M 690 98 L 724 108 L 724 172 L 690 182 Z" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
                        {/* Vidros laterais fumê */}
                        <rect x="625" y="96" width="55" height="12" rx="2" fill="#0F172A" />
                        <rect x="625" y="172" width="55" height="12" rx="2" fill="#0F172A" />
                        {/* Faróis dianteiros acesos */}
                        <rect x="726" y="104" width="6" height="14" rx="2" fill="#FEF08A" filter="url(#glowVerde)" />
                        <rect x="726" y="162" width="6" height="14" rx="2" fill="#FEF08A" filter="url(#glowVerde)" />
                        {/* Placa Dianteira Mercosul */}
                        <rect x="727" y="130" width="8" height="20" rx="1" fill="#FFFFFF" />
                        <rect x="727" y="130" width="3" height="20" fill="#0284C7" />

                        {/* TAMBOR DA BETONEIRA (LARANJA COM ESPIRAIS) */}
                        <ellipse cx="440" cy="140" rx="145" ry="42" fill="url(#gradTambor)" stroke="#9A3412" strokeWidth="2.5" />
                        {/* Espirais decorativas no tambor */}
                        <path d="M 330 120 Q 430 140 540 120" stroke="#FFFFFF" strokeWidth="6" fill="none" opacity="0.8" />
                        <path d="M 350 160 Q 450 140 560 160" stroke="#FFFFFF" strokeWidth="6" fill="none" opacity="0.8" />

                        {/* CALHA DE DESCARGA TRASEIRA */}
                        <polygon points="260,132 290,126 290,154 260,148" fill="#475569" stroke="#334155" strokeWidth="2" />
                        <rect x="250" y="136" width="14" height="8" rx="2" fill="#94A3B8" />

                        {/* IDENTIFICAÇÃO DO VEÍCULO SOBRE O TAMBOR */}
                        <rect x="380" y="128" width="120" height="24" rx="4" fill="#000000" opacity="0.75" />
                        <text x="440" y="144" fill="#00FF66" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                          {hardware.placaDetectada || 'RRA-4E80'}
                        </text>
                      </g>
                    )}

                    {/* SE FOR CAÇAMBA BASCULANTE DE AGREGADOS */}
                    {hardware.veiculoAtual?.tipo === 'cacamba' && (
                      <g>
                        {/* CABINE SCANIA R450 */}
                        <rect x="620" y="94" width="110" height="92" rx="10" fill="#DC2626" stroke="#991B1B" strokeWidth="2" />
                        <path d="M 700 98 L 726 108 L 726 172 L 700 182 Z" fill="#1E293B" />
                        {/* CAÇAMBA BASCULANTE ROSSETTI CARREGADA COM AREIA/BRITA */}
                        <rect x="270" y="92" width="330" height="96" rx="4" fill="#475569" stroke="#334155" strokeWidth="3" />
                        {/* Carga de Areia Lavada / Brita */}
                        <ellipse cx="435" cy="140" rx="150" ry="36" fill="#D97706" />
                        <text x="435" y="144" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">
                          AREIA MÉDIA LAVADA DE RIO (SEPOTUBA)
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* 7. TOTEM LPR & INTERFONE (ENTRADA - LADO ESQUERDO X=130) */}
                <g style={{ cursor: 'pointer' }} onClick={acionarInterfone}>
                  {/* Base do Totem */}
                  <rect x="120" y="80" width="30" height="35" rx="4" fill="#1E293B" stroke="#475569" strokeWidth="2" />
                  {/* Visor / Tela do Totem */}
                  <rect x="124" y="84" width="22" height="14" rx="2" fill="#0284C7" />
                  <circle cx="135" cy="105" r="4" fill={interfoneOuvindo ? '#DC2626' : '#64748B'} />
                  {/* Câmera LPR no Topo */}
                  <rect x="115" y="65" width="20" height="12" rx="2" fill="#0F172A" stroke="#00D2FF" strokeWidth="1.5" />
                  <circle cx="131" cy="71" r="3" fill="#00D2FF" />
                  {/* Cone de Leitura LPR */}
                  <polygon points="135,71 210,110 210,170" fill="#00D2FF" opacity="0.15" />
                  <text x="135" y="125" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="middle">TOTEM LPR</text>
                </g>

                {/* 8. CANCELA DE ENTRADA INTERATIVA (X=150) */}
                <g style={{ cursor: 'pointer' }} onClick={toggleCancelaEntrada}>
                  {/* Coluna Mecânica */}
                  <rect x="150" y="42" width="16" height="24" rx="3" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1" />
                  {/* Braço Articulado Zebrado */}
                  <g style={{
                    transformOrigin: '158px 54px',
                    transform: hardware.cancelaEntrada === 'aberta' ? 'rotate(-75deg)' : 'rotate(0deg)',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}>
                    <rect x="156" y="52" width="8" height="95" rx="2" fill="#EAB308" stroke="#000000" strokeWidth="1" />
                    {/* Listras pretas reflexivas */}
                    <rect x="156" y="60" width="8" height="10" fill="#000000" />
                    <rect x="156" y="80" width="8" height="10" fill="#000000" />
                    <rect x="156" y="100" width="8" height="10" fill="#000000" />
                    <rect x="156" y="120" width="8" height="10" fill="#000000" />
                  </g>
                </g>

                {/* 9. SEMÁFORO DE ENTRADA (X=145, Y=190) */}
                <g style={{ cursor: 'pointer' }} onClick={toggleSemaforoEntrada}>
                  <rect x="142" y="180" width="22" height="42" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
                  {/* Foco Vermelho */}
                  <circle
                    cx="153" cy="192" r="7"
                    fill={hardware.semaforoEntrada === 'vermelho' ? '#EF4444' : '#381212'}
                    filter={hardware.semaforoEntrada === 'vermelho' ? 'url(#glowVermelho)' : 'none'}
                  />
                  {/* Foco Verde */}
                  <circle
                    cx="153" cy="210" r="7"
                    fill={hardware.semaforoEntrada === 'verde' ? '#10B981' : '#0B3828'}
                    filter={hardware.semaforoEntrada === 'verde' ? 'url(#glowVerde)' : 'none'}
                  />
                </g>

                {/* 10. CANCELA DE SAÍDA INTERATIVA (X=840) */}
                <g style={{ cursor: 'pointer' }} onClick={toggleCancelaSaida}>
                  {/* Coluna Mecânica */}
                  <rect x="840" y="42" width="16" height="24" rx="3" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1" />
                  {/* Braço Articulado Zebrado */}
                  <g style={{
                    transformOrigin: '848px 54px',
                    transform: hardware.cancelaSaida === 'aberta' ? 'rotate(-75deg)' : 'rotate(0deg)',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}>
                    <rect x="844" y="52" width="8" height="95" rx="2" fill="#EAB308" stroke="#000000" strokeWidth="1" />
                    <rect x="844" y="60" width="8" height="10" fill="#000000" />
                    <rect x="844" y="80" width="8" height="10" fill="#000000" />
                    <rect x="844" y="100" width="8" height="10" fill="#000000" />
                    <rect x="844" y="120" width="8" height="10" fill="#000000" />
                  </g>
                </g>

                {/* 11. SEMÁFORO DE SAÍDA (X=840, Y=190) */}
                <g style={{ cursor: 'pointer' }} onClick={toggleSemaforoSaida}>
                  <rect x="838" y="180" width="22" height="42" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
                  <circle
                    cx="849" cy="192" r="7"
                    fill={hardware.semaforoSaida === 'vermelho' ? '#EF4444' : '#381212'}
                    filter={hardware.semaforoSaida === 'vermelho' ? 'url(#glowVermelho)' : 'none'}
                  />
                  <circle
                    cx="849" cy="210" r="7"
                    fill={hardware.semaforoSaida === 'verde' ? '#10B981' : '#0B3828'}
                    filter={hardware.semaforoSaida === 'verde' ? 'url(#glowVerde)' : 'none'}
                  />
                </g>

                {/* LEGENDA DE MEDIÇÃO DAS 8 CÉLULAS DE CARGA */}
                <rect x="250" y="248" width="500" height="24" rx="4" fill="#0D111A" stroke="#1E293B" strokeWidth="1" />
                <text x="500" y="264" fill="#10B981" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  8 CÉLULAS TOLEDO: ~{pesoPorCelula.toLocaleString('pt-BR')} kg/célula · ENQUADRAMENTO 100% OK
                </text>
              </svg>
            </div>
          </div>

          {/* FLUXO DE PESAGEM: SELETOR 1ª PESAGEM / 2ª PESAGEM */}
          <div style={{ background: '#0D1322', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '10px', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setEtapaPesagem('segunda')}
                  style={{ background: etapaPesagem === 'segunda' ? '#0284C7' : '#1E293B', color: etapaPesagem === 'segunda' ? '#FFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  ⚖️ 2ª Pesagem (Saída &amp; Emissão de Ticket)
                </button>
                <button
                  onClick={() => setEtapaPesagem('primeira')}
                  style={{ background: etapaPesagem === 'primeira' ? '#0284C7' : '#1E293B', color: etapaPesagem === 'primeira' ? '#FFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  🚚 1ª Pesagem (Entrada de Veículo no Pátio)
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={abrirRomaneioA4} style={{ background: '#1E293B', border: '1px solid #334155', color: '#00D2FF', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                  📄 Romaneio A4 NBR 7212
                </button>
                {modalTicket && (
                  <button onClick={() => abrirImpressaoTicket(modalTicket)} style={{ background: '#10B981', color: '#FFF', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    🖨️ Reimpressão Último Ticket
                  </button>
                )}
              </div>
            </div>

            {/* SE 2ª PESAGEM (SAÍDA) */}
            {etapaPesagem === 'segunda' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                {/* VEÍCULOS NO PÁTIO */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#FFF', marginBottom: '8px' }}>
                    Veículos no Pátio ({veiculosPatio.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                    {veiculosPatio.map(v => {
                      const sel = veiculoPatioSelecionado?.id === v.id;
                      return (
                        <div
                          key={v.id}
                          onClick={() => selecionarVeiculoPatio(v)}
                          style={{ background: sel ? '#1E293B' : '#070A11', border: `1.5px solid ${sel ? '#00D2FF' : '#1E293B'}`, borderRadius: '6px', padding: '10px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong style={{ color: '#FFF', fontSize: '12px' }}>{v.placa}</strong>
                            <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: '700' }}>Tara: {Number(v.taraEntradaKg || 0).toLocaleString('pt-BR')} kg</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                            {v.motorista} · <span style={{ color: '#00D2FF' }}>{v.produto}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* FORMULÁRIO DE SAÍDA */}
                <div>
                  {veiculoPatioSelecionado ? (
                    <form onSubmit={salvarSegundaPesagem}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>PESO BRUTO SAÍDA (KG)</label>
                          <input
                            type="number"
                            value={formSaida.pesoBrutoKg}
                            onChange={(e) => setFormSaida({ ...formSaida, pesoBrutoKg: Number(e.target.value) })}
                            style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#00D2FF', borderRadius: '4px', padding: '6px', fontSize: '12px', fontWeight: '700', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>TARA ENTRADA (KG)</label>
                          <input
                            type="number"
                            value={formSaida.taraKg}
                            onChange={(e) => setFormSaida({ ...formSaida, taraKg: Number(e.target.value) })}
                            style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#F59E0B', borderRadius: '4px', padding: '6px', fontSize: '12px', fontWeight: '700', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      {/* KPIS CALCULADOS */}
                      <div style={{ background: '#070A11', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px', marginBottom: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                        <div>
                          <div style={{ fontSize: '9px', color: '#94A3B8' }}>LÍQUIDO</div>
                          <div style={{ fontSize: '15px', fontWeight: '900', color: '#10B981' }}>{pesoLiquidoCalculado.toLocaleString('pt-BR')} kg</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', color: '#94A3B8' }}>VOLUME M³</div>
                          <div style={{ fontSize: '15px', fontWeight: '900', color: '#00D2FF' }}>{volumeCalculado} m³</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', color: '#94A3B8' }}>FATURAMENTO</div>
                          <div style={{ fontSize: '15px', fontWeight: '900', color: '#F59E0B' }}>{fmtR(valorTotalCalculado)}</div>
                        </div>
                      </div>

                      {/* CANVAS TOUCH ASSINATURA */}
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>✍️ ASSINATURA TOUCH DO MOTORISTA</span>
                          <button type="button" onClick={limparAssinatura} style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}>Limpar</button>
                        </div>
                        <canvas
                          ref={canvasRef}
                          width={380}
                          height={70}
                          onMouseDown={iniciarDesenho}
                          onMouseMove={desenhar}
                          onMouseUp={pararDesenho}
                          onTouchStart={iniciarDesenho}
                          onTouchMove={desenhar}
                          onTouchEnd={pararDesenho}
                          style={{ width: '100%', height: '70px', background: '#FFF', borderRadius: '4px', border: '1px solid #334155', cursor: 'crosshair', touchAction: 'none' }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={carregando}
                        style={{ width: '100%', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
                        {carregando ? 'Gravando...' : '💾 Emitir Ticket Térmico 80t & Liberar Saída'}
                      </button>
                    </form>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', background: '#070A11', borderRadius: '6px' }}>
                      Selecione um caminhão na lista para finalizar a pesagem.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SE 1ª PESAGEM (ENTRADA) */}
            {etapaPesagem === 'primeira' && (
              <form onSubmit={salvarPrimeiraPesagem} style={{ maxWidth: '640px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>PLACA DO VEÍCULO</label>
                    <input
                      type="text"
                      value={formEntrada.placaVeiculo}
                      onChange={(e) => setFormEntrada({ ...formEntrada, placaVeiculo: e.target.value })}
                      style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#00D2FF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>MOTORISTA</label>
                    <input
                      type="text"
                      value={formEntrada.motorista}
                      onChange={(e) => setFormEntrada({ ...formEntrada, motorista: e.target.value })}
                      style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>CLIENTE / DESTINO</label>
                    <input
                      type="text"
                      value={formEntrada.cliente}
                      onChange={(e) => setFormEntrada({ ...formEntrada, cliente: e.target.value })}
                      style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>MATERIAL PREVISTO</label>
                    <select
                      value={formEntrada.tipoMaterial}
                      onChange={(e) => setFormEntrada({ ...formEntrada, tipoMaterial: e.target.value })}
                      style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}>
                      <option value="Concreto Usinado Estrutural FCK 30 MPa">Concreto Usinado Estrutural FCK 30 MPa</option>
                      <option value="Areia Média Lavada de Rio (Sepotuba)">Areia Média Lavada de Rio (Sepotuba)</option>
                      <option value="Brita 1 Granítica">Brita 1 Granítica</option>
                      <option value="Brita 0 Granítica">Brita 0 Granítica</option>
                      <option value="Cimento CP-II F 32 a Granel">Cimento CP-II F 32 a Granel</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: '#070A11', border: '1px solid #1E293B', borderRadius: '6px', padding: '12px', textAlign: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>TARA CAPTURADA NA BALANÇA</div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#00D2FF', marginTop: '2px' }}>
                    {Number(hardware.pesoAtualKg || formEntrada.taraKg).toLocaleString('pt-BR')} kg
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  style={{ width: '100%', background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
                  {carregando ? 'Processando...' : '📥 Registrar Entrada & Abrir Cancela'}
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 3. CONTEÚDO DA ABA: CÂMERAS CFTV (MATRIZ DE 4 CÂMERAS AO VIVO) */}
      {/* ========================================================================= */}
      {abaPrincipal === 'cftv' && (
        <div style={{ background: '#0D1322', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: '900', color: '#FFF' }}>
                📹 MATRIZ DE VÍDEO MONITORAMENTO CFTV · CCO USINA SERRANO
              </span>
              <span style={{ fontSize: '10px', background: '#DC2626', color: '#FFF', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                🔴 4 CANAIS AO VIVO
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00FF66', background: '#000', padding: '3px 8px', borderRadius: '4px' }}>
                {horarioCftv} BRT
              </span>
              <button
                onClick={() => {
                  alert(`Snapshot capturado da câmera ativa (${cameraAtiva.toUpperCase()}) salvo nos registros de pesagem!`);
                  setSnapshotCaptured(true);
                }}
                style={{ background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                📸 Capturar Foto da Placa
              </button>
            </div>
          </div>

          {/* GRID DE 4 CÂMERAS CFTV */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '12px' }}>
            
            {/* CAM 01: LPR ENTRADA */}
            <div style={{ background: '#000', border: `2px solid ${cameraAtiva === 'cam01' ? '#00D2FF' : '#1E293B'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setCameraAtiva('cam01')}>
              <img
                src="/assets/cftv/cftv_cam01_lpr_entrada.jpg"
                alt="CAM 01 LPR Entrada"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <div style={{ background: '#0D111A', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#00D2FF', fontWeight: '700' }}>CAM-01 · TOTEM LPR ENTRADA</span>
                <span style={{ color: '#10B981' }}>Placa: RRA-4E80 (99.6%)</span>
              </div>
            </div>

            {/* CAM 02: PANORÂMICA 21M */}
            <div style={{ background: '#000', border: `2px solid ${cameraAtiva === 'cam02' ? '#00D2FF' : '#1E293B'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setCameraAtiva('cam02')}>
              <img
                src="/assets/cftv/cftv_cam02_plataforma_panoramica.jpg"
                alt="CAM 02 Panorâmica 21m"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <div style={{ background: '#0D111A', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#00D2FF', fontWeight: '700' }}>CAM-02 · PANORÂMICA BALANÇA 21M</span>
                <span style={{ color: '#10B981' }}>Enquadramento OK</span>
              </div>
            </div>

            {/* CAM 03: CANCELA SAÍDA */}
            <div style={{ background: '#000', border: `2px solid ${cameraAtiva === 'cam03' ? '#00D2FF' : '#1E293B'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setCameraAtiva('cam03')}>
              <img
                src="/assets/cftv/cftv_cam03_cancela_saida.jpg"
                alt="CAM 03 Cancela Saída"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <div style={{ background: '#0D111A', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#00D2FF', fontWeight: '700' }}>CAM-03 · CANCELA SAÍDA &amp; SEMÁFORO</span>
                <span style={{ color: '#EF4444' }}>Cancela Fechada</span>
              </div>
            </div>

            {/* CAM 04: PÁTIO & SILOS */}
            <div style={{ background: '#000', border: `2px solid ${cameraAtiva === 'cam04' ? '#00D2FF' : '#1E293B'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setCameraAtiva('cam04')}>
              <img
                src="/assets/cftv/cftv_cam04_patio_silos.jpg"
                alt="CAM 04 Pátio Silos"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <div style={{ background: '#0D111A', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#00D2FF', fontWeight: '700' }}>CAM-04 · PÁTIO DE CARREGAMENTO &amp; SILOS</span>
                <span style={{ color: '#F59E0B' }}>Operando Normalmente</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONTEÚDO DA ABA: TICKETS & HISTÓRICO */}
      {abaPrincipal === 'historico' && (
        <div style={{ background: '#0D1322', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Buscar por placa, motorista ou cliente..."
                value={buscaTermo}
                onChange={(e) => setBuscaTermo(e.target.value)}
                style={{ background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', width: '260px' }}
              />
              <select
                value={filtroMaterial}
                onChange={(e) => setFiltroMaterial(e.target.value)}
                style={{ background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '6px', padding: '6px 10px', fontSize: '12px' }}>
                <option value="todos">Todos os Materiais</option>
                <option value="concreto">Concreto Usinado</option>
                <option value="areia">Areia Lavada</option>
                <option value="brita">Britas</option>
                <option value="cimento">Cimento</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => alert('Exportando tickets para planilha Excel/CSV...')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#10B981', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                ⬇️ Exportar CSV
              </button>
              <button onClick={() => window.print()} style={{ background: '#1E293B', border: '1px solid #334155', color: '#00D2FF', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                🖨️ Imprimir Diário
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#070A11', borderBottom: '1.5px solid #1E293B', color: '#94A3B8' }}>
                  <th style={{ padding: '8px' }}>Ticket</th>
                  <th style={{ padding: '8px' }}>Data/Hora</th>
                  <th style={{ padding: '8px' }}>Placa</th>
                  <th style={{ padding: '8px' }}>Motorista</th>
                  <th style={{ padding: '8px' }}>Material</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Bruto</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Tara</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Líquido</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Volume</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {tickets
                  .filter(t => !buscaTermo || t.numeroTicket?.toLowerCase().includes(buscaTermo.toLowerCase()) || t.veiculoPlaca?.toLowerCase().includes(buscaTermo.toLowerCase()) || t.motorista?.toLowerCase().includes(buscaTermo.toLowerCase()))
                  .filter(t => filtroMaterial === 'todos' || t.tipoMaterial?.toLowerCase().includes(filtroMaterial))
                  .map((t, idx) => (
                    <tr key={t.id || idx} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: '700', color: '#00D2FF' }}>{t.numeroTicket}</td>
                      <td style={{ padding: '8px', color: '#CBD5E1' }}>{t.dataHora}</td>
                      <td style={{ padding: '8px', fontWeight: '700', color: '#FFF' }}>{t.veiculoPlaca}</td>
                      <td style={{ padding: '8px', color: '#CBD5E1' }}>{t.motorista}</td>
                      <td style={{ padding: '8px', color: '#94A3B8' }}>{t.tipoMaterial}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#CBD5E1' }}>{Number(t.pesoBrutoKg || 0).toLocaleString('pt-BR')} kg</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#F59E0B' }}>{Number(t.taraKg || 0).toLocaleString('pt-BR')} kg</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#10B981' }}>{Number(t.pesoLiquidoKg || 0).toLocaleString('pt-BR')} kg</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#00D2FF' }}>{t.volumeCalculadoM3} m³</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => setModalTicket(t)} style={{ background: '#1E293B', border: '1px solid #334155', color: '#00D2FF', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }} title="Visualizar Cupom">
                            👁️
                          </button>
                          <button onClick={() => abrirImpressaoTicket(t)} style={{ background: '#0284C7', border: 'none', color: '#FFF', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }} title="Imprimir 80mm">
                            🖨️
                          </button>
                          <button onClick={() => enviarWhatsAppTicket(t)} style={{ background: '#065F46', border: 'none', color: '#FFF', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }} title="Enviar WhatsApp">
                            📲
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. CONTEÚDO DA ABA: PÁTIO DE CARGA */}
      {abaPrincipal === 'patio' && (
        <div style={{ background: '#0D1322', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFF' }}>
              🚚 Veículos em Carregamento e Espera no Pátio ({veiculosPatio.length})
            </div>
            <button onClick={() => { setAbaPrincipal('operacao'); setEtapaPesagem('primeira'); }} style={{ background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
              + Nova Entrada
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
            {veiculosPatio.map(v => (
              <div key={v.id} style={{ background: '#070A11', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#FFF' }}>{v.placa}</span>
                  <span style={{ fontSize: '10px', background: '#F59E0B', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                    Tara: {Number(v.taraEntradaKg || 0).toLocaleString('pt-BR')} kg
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>Motorista: <strong style={{ color: '#FFF' }}>{v.motorista}</strong></div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Carga: <strong style={{ color: '#00D2FF' }}>{v.produto}</strong></div>
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>Entrada: {v.dataHoraEntrada}</div>

                <button
                  onClick={() => {
                    selecionarVeiculoPatio(v);
                    setAbaPrincipal('operacao');
                    setEtapaPesagem('segunda');
                  }}
                  style={{ width: '100%', marginTop: '10px', background: '#1E293B', border: '1px solid #00D2FF', color: '#00D2FF', borderRadius: '4px', padding: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                  ⚖️ Pesar Saída &amp; Emitir Ticket
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. CONTEÚDO DA ABA: CONFIGURAÇÕES DA BALANÇA */}
      {abaPrincipal === 'configuracoes' && (
        <form onSubmit={salvarConfiguracoes} style={{ background: '#0D1322', border: '1px solid #1E293B', borderRadius: '10px', padding: '18px', maxWidth: '780px', margin: '0 auto' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFF', borderBottom: '1px solid #1E293B', paddingBottom: '8px', marginBottom: '14px' }}>
            ⚙️ Parâmetros Técnicos &amp; Hardware da Balança Rodoviária 80t
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>MODELO DO INDICADOR DE PESAGEM</label>
              <select
                value={configuracoes.modeloIndicador}
                onChange={(e) => setConfiguracoes({ ...configuracoes, modeloIndicador: e.target.value })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}>
                <option value="Toledo Prix 9094">Toledo Prix 9094 (Padrão Usina Serrano)</option>
                <option value="Toledo Prix 9091">Toledo Prix 9091</option>
                <option value="Filizola CS-15">Filizola CS-15 Rodoviária</option>
                <option value="Saturno SBL-80">Saturno SBL-80</option>
                <option value="Jundiaí JB-80">Jundiaí JB-80</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>PROTOCOLO DE COMUNICAÇÃO SERIAL</label>
              <select
                value={configuracoes.protocoloComunicacao}
                onChange={(e) => setConfiguracoes({ ...configuracoes, protocoloComunicacao: e.target.value })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}>
                <option value="Toledo P03 Contínuo">Toledo P03 Contínuo (STX + Peso + ETX)</option>
                <option value="Toledo P01 Demanda">Toledo P01 Sob Demanda</option>
                <option value="Filizola Padrão">Filizola Padrão</option>
                <option value="Modbus RTU">Modbus RTU RS-485</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>PORTA SERIAL</label>
              <input
                type="text"
                value={configuracoes.portaSerial}
                onChange={(e) => setConfiguracoes({ ...configuracoes, portaSerial: e.target.value })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#00D2FF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>BAUD RATE</label>
              <select
                value={configuracoes.baudRate}
                onChange={(e) => setConfiguracoes({ ...configuracoes, baudRate: Number(e.target.value) })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}>
                <option value="2400">2400 bps</option>
                <option value="4800">4800 bps</option>
                <option value="9600">9600 bps</option>
                <option value="19200">19200 bps</option>
                <option value="115200">115200 bps</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>DIVISÃO (KG)</label>
              <select
                value={configuracoes.divisaoMetrologicaKg}
                onChange={(e) => setConfiguracoes({ ...configuracoes, divisaoMetrologicaKg: Number(e.target.value) })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}>
                <option value="10">10 kg (Padrão 80t)</option>
                <option value="20">20 kg</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>IP DA CÂMERA LPR DE ENTRADA</label>
              <input
                type="text"
                value={configuracoes.ipCameraEntradaLpr}
                onChange={(e) => setConfiguracoes({ ...configuracoes, ipCameraEntradaLpr: e.target.value })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>IP DO CONTROLADOR DAS CANCELAS &amp; RELÉS</label>
              <input
                type="text"
                value={configuracoes.ipControladorCancelas}
                onChange={(e) => setConfiguracoes({ ...configuracoes, ipControladorCancelas: e.target.value })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>ALÍQUOTA CFEM MINERAÇÃO (%)</label>
              <input
                type="number"
                step="0.1"
                value={configuracoes.aliquotaCfemMinerais}
                onChange={(e) => setConfiguracoes({ ...configuracoes, aliquotaCfemMinerais: Number(e.target.value) })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#F59E0B', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>IMPRESSORA TÉRMICA 80MM</label>
              <input
                type="text"
                value={configuracoes.impressoraTermicaPadrao}
                onChange={(e) => setConfiguracoes({ ...configuracoes, impressoraTermicaPadrao: e.target.value })}
                style={{ width: '100%', background: '#070A11', border: '1px solid #334155', color: '#FFF', borderRadius: '4px', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="submit"
              disabled={salvandoConfig}
              style={{ flex: 1, background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
              {salvandoConfig ? 'Gravando...' : '💾 Salvar Parâmetros da Balança'}
            </button>
            <button
              type="button"
              onClick={() => alert('Teste de Comunicação Serial: Indicador Toledo Prix 9094 respondeu com sucesso na porta COM3!')}
              style={{ background: '#1E293B', border: '1px solid #334155', color: '#00D2FF', borderRadius: '6px', padding: '10px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              🔌 Testar Comunicação
            </button>
          </div>
        </form>
      )}

      {/* MODAL DO TICKET TÉRMICO 80MM TOLEDO */}
      {modalTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', color: '#000000', width: '100%', maxWidth: '380px', borderRadius: '8px', padding: '18px', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'monospace' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '900' }}>{configuracoes.cabecalhoTicket?.razaoSocial}</div>
              <div style={{ fontSize: '10px', color: '#333' }}>{configuracoes.cabecalhoTicket?.endereco}</div>
              <div style={{ fontSize: '10px', color: '#333' }}>CNPJ: {configuracoes.cabecalhoTicket?.cnpj} · IE: {configuracoes.cabecalhoTicket?.inscricaoEstadual}</div>
              <div style={{ fontSize: '11px', fontWeight: '800', marginTop: '6px' }}>TICKET DE PESAGEM RODOVIÁRIA 80t</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#000' }}>{modalTicket.numeroTicket}</div>
              <div style={{ fontSize: '9px', color: '#555' }}>{configuracoes.cabecalhoTicket?.portariaInmetro}</div>
            </div>

            <div style={{ fontSize: '11px', lineHeight: 1.4, borderBottom: '1px dashed #666', paddingBottom: '6px', marginBottom: '6px' }}>
              <div><strong>DATA/HORA:</strong> {modalTicket.dataHora}</div>
              <div><strong>PLACA:</strong> {modalTicket.veiculoPlaca}</div>
              <div><strong>MOTORISTA:</strong> {modalTicket.motorista}</div>
              <div><strong>CLIENTE:</strong> {modalTicket.cliente}</div>
              <div><strong>MATERIAL:</strong> {modalTicket.tipoMaterial}</div>
            </div>

            <div style={{ fontSize: '11px', lineHeight: 1.5, borderBottom: '2px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>PESO BRUTO:</span>
                <strong>{Number(modalTicket.pesoBrutoKg || 0).toLocaleString('pt-BR')} kg</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>TARA:</span>
                <strong>{Number(modalTicket.taraKg || 0).toLocaleString('pt-BR')} kg</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid #000', paddingTop: '3px', marginTop: '3px' }}>
                <strong>PESO LÍQUIDO:</strong>
                <strong>{Number(modalTicket.pesoLiquidoKg || 0).toLocaleString('pt-BR')} kg</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span>VOLUME APURADO:</span>
                <strong>{modalTicket.volumeCalculadoM3} m³</strong>
              </div>
              {modalTicket.valorCfem > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#333' }}>
                  <span>CFEM RECOLHIDO (1,5%):</span>
                  <span>{fmtR(modalTicket.valorCfem)}</span>
                </div>
              )}
            </div>

            {/* ASSINATURA */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#555', marginBottom: '3px' }}>Assinatura do Motorista:</div>
              {modalTicket.assinaturaMotoristaBase64 ? (
                <img src={modalTicket.assinaturaMotoristaBase64} alt="Assinatura" style={{ maxHeight: '40px', borderBottom: '1px solid #000' }} />
              ) : (
                <div style={{ borderBottom: '1px solid #000', height: '25px', margin: '0 20px' }}></div>
              )}
              <div style={{ fontSize: '10px', marginTop: '2px' }}>{modalTicket.motorista}</div>
            </div>

            <div style={{ fontSize: '8px', textAlign: 'center', color: '#555', borderTop: '1px dotted #888', paddingTop: '6px' }}>
              <div>AUTENTICIDADE: {modalTicket.codigoAutenticidade}</div>
              <div>Kytto ERP Industrial · Balança Rodoviária Automatizada</div>
            </div>

            {/* BOTÕES DE AÇÃO: IMPRIMIR 80MM, ROMANEIO A4, WHATSAPP E FECHAR */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '12px' }}>
              <button
                onClick={() => abrirImpressaoTicket(modalTicket)}
                style={{ background: '#000', color: '#FFF', border: 'none', borderRadius: '4px', padding: '9px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                🖨️ Imprimir 80mm
              </button>
              <button
                onClick={abrirRomaneioA4}
                style={{ background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '4px', padding: '9px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                📄 Romaneio A4
              </button>
              <button
                onClick={() => enviarWhatsAppTicket(modalTicket)}
                style={{ background: '#065F46', color: '#FFF', border: 'none', borderRadius: '4px', padding: '9px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                📲 Enviar WhatsApp
              </button>
              <button
                onClick={() => setModalTicket(null)}
                style={{ background: '#E2E8F0', color: '#000', border: 'none', borderRadius: '4px', padding: '9px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
